import type {
  AdminPreviewPayload,
  FireflyBurstPayload,
  Viewer,
  Visit,
  WishCategory,
} from '@but-oi/shared';
import { nanoid } from 'nanoid';
import { getSettings } from '../config.js';
import { getRepo, type Repo } from '../db/repo.js';
import { defaultModerator, type WishModerator } from '../blessing/moderator.js';
import { defaultPicker, fillName, type BlessingPicker } from '../blessing/picker.js';
import { defaultVoiceService, type VoiceService } from '../voice/index.js';
import { VisitQueue } from './queue.js';

export class VisitPreparer {
  private queue: VisitQueue;
  private repo: Repo;
  private moderator: WishModerator;
  private picker: BlessingPicker;
  private voice: VoiceService;
  private activeCount = 0;
  private readonly maxConcurrency = 2;
  private readonly skipGraceDelay: boolean;
  private readonly previewDelayMs: number;
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private graceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  private startListeners: Array<(visit: Visit) => void> = [];
  private fireflyBurstListeners: Array<(payload: FireflyBurstPayload) => void> = [];
  private previewListeners: Array<(payload: AdminPreviewPayload) => void> = [];

  private pendingFireflyViewers: Viewer[] = [];
  private fireflyFlushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: {
    queue: VisitQueue;
    repo?: Repo;
    moderator?: WishModerator;
    picker?: BlessingPicker;
    voice?: VoiceService;
    skipGraceDelay?: boolean;
    previewDelayMs?: number;
  }) {
    this.queue = opts.queue;
    this.repo = opts.repo ?? getRepo();
    this.moderator = opts.moderator ?? defaultModerator;
    this.picker = opts.picker ?? defaultPicker;
    this.voice = opts.voice ?? defaultVoiceService;
    this.skipGraceDelay = opts.skipGraceDelay ?? false;
    this.previewDelayMs = opts.previewDelayMs ?? 3000;

    this.queue.onChange(() => {
      void this.tick();
    });

    this.queue.onFirefly(({ viewer }) => {
      this.enqueueFireflyViewer(viewer);
    });

    this.queue.onPerform((visit) => {
      this.scheduleStartWithGrace(visit);
    });
  }

  public onVisitStart(fn: (visit: Visit) => void): void {
    this.startListeners.push(fn);
  }

  public onFireflyBurst(fn: (payload: FireflyBurstPayload) => void): void {
    this.fireflyBurstListeners.push(fn);
  }

  public onAdminPreview(fn: (payload: AdminPreviewPayload) => void): void {
    this.previewListeners.push(fn);
  }

  private enqueueFireflyViewer(viewer: Viewer): void {
    if (!this.pendingFireflyViewers.some((v) => v.userId === viewer.userId)) {
      this.pendingFireflyViewers.push(viewer);
    }
    if (this.pendingFireflyViewers.length >= 5) {
      if (this.fireflyFlushTimer) {
        clearTimeout(this.fireflyFlushTimer);
        this.fireflyFlushTimer = null;
      }
      void this.flushFireflyBatch();
      return;
    }
    if (!this.fireflyFlushTimer) {
      this.fireflyFlushTimer = setTimeout(() => {
        this.fireflyFlushTimer = null;
        void this.flushFireflyBatch();
      }, 600);
    }
  }

  private async flushFireflyBatch(): Promise<void> {
    if (this.pendingFireflyViewers.length === 0) return;
    const batch = this.pendingFireflyViewers.splice(0, 5);
    const names = batch.map((v) => v.displayName);
    const joinedNames = names.join(', ');
    const template = this.picker.pick({ tier: 'firefly', length: 'short' });
    const text = fillName(template, joinedNames);
    const rendered = await this.safeRenderVoice(text);

    const payload: FireflyBurstPayload = {
      id: nanoid(),
      names,
      text,
      audioUrl: rendered.url,
      durationMs: rendered.durationMs,
    };
    for (const fn of this.fireflyBurstListeners) {
      fn(payload);
    }
  }

  public async tick(): Promise<void> {
    if (this.activeCount >= this.maxConcurrency) {
      this.queue.tryDispatchNext();
      return;
    }

    const sorted = this.queue.getPendingSorted();
    // Chỉ chuẩn bị lượt đầu hàng và lượt kế tiếp (tối đa 2 lượt đầu)
    const topTwo = sorted.slice(0, 2);
    for (const item of topTwo) {
      if (item.status === 'queued' && this.activeCount < this.maxConcurrency) {
        void this.prepareItem(item);
      }
    }

    this.queue.tryDispatchNext();
  }

  public async prepareItem(item: Visit): Promise<void> {
    if (item.status !== 'queued') return;
    item.status = 'preparing';
    this.activeCount++;

    try {
      const cfg = getSettings();
      const wish = this.repo.latestWish(item.viewer.userId, cfg.wishTtlMs);
      const modResult = wish
        ? await this.moderator.check(item.viewer.displayName, wish.raw_text)
        : null;

      item.hadWish = Boolean(wish);
      item.wishRejected = Boolean(wish && modResult?.allowed === false);

      if (wish) {
        this.repo.markWishUsed(wish.id, item.id);
      }

      let rawTemplateText: string;
      let source: 'ai' | 'bank' = 'bank';
      let category: WishCategory = modResult?.category ?? 'binh_an';

      if (item.wishRejected) {
        rawTemplateText = this.picker.pick({ length: 'reject' });
        source = 'bank';
        category = 'khac';
      } else if (modResult?.allowed && modResult.blessing) {
        rawTemplateText = modResult.blessing;
        source = 'ai';
        category = modResult.category;
      } else if (item.tier === 'grand') {
        rawTemplateText = this.picker.pick({ length: 'grand' });
        source = 'bank';
        category = 'binh_an';
      } else {
        const rec = this.picker.pickRecord({
          category: modResult?.category,
          tier: item.tier,
        });
        rawTemplateText = rec.text;
        source = 'bank';
        category = rec.category;
      }

      const finalText = fillName(rawTemplateText, item.viewer.displayName);
      const openerTemplate = this.picker.pick({ length: 'opener' });
      const openerText = fillName(openerTemplate, item.viewer.displayName);

      const [mainVoice, openerVoice] = await Promise.all([
        this.safeRenderVoice(finalText),
        this.safeRenderVoice(openerText),
      ]);

      item.blessing = {
        text: finalText,
        openerText,
        openerAudioUrl: openerVoice.url,
        openerDurationMs: openerVoice.durationMs,
        source,
        category,
        audioUrl: mainVoice.url,
        durationMs: mainVoice.durationMs,
      };

      // T32: Nếu bậc miracle/grand và lời do AI viết -> gửi preview 3s cho admin trước khi ready
      if (
        source === 'ai' &&
        (item.tier === 'miracle' || item.tier === 'grand') &&
        this.previewListeners.length > 0 &&
        this.previewDelayMs > 0
      ) {
        const previewPayload: AdminPreviewPayload = {
          visitId: item.id,
          viewerName: item.viewer.displayName,
          tier: item.tier,
          blessingText: item.blessing.text,
          category: item.blessing.category,
          expiresAt: Date.now() + this.previewDelayMs,
        };
        for (const fn of this.previewListeners) {
          fn(previewPayload);
        }
        await new Promise((r) => setTimeout(r, this.previewDelayMs));
      }

      if ((item.status as string) !== 'skipped') {
        item.status = 'ready';
      }
    } finally {
      this.activeCount = Math.max(0, this.activeCount - 1);
      this.queue.tryDispatchNext();
      void this.tick();
    }
  }

  /**
   * T32: Admin bấm "Đổi câu" trong 3 giây xem trước -> thay lời AI bằng câu kho
   */
  public async replaceWithBankBlessing(visitId: string): Promise<Visit | null> {
    const item = this.queue.getAllItems().find((x) => x.id === visitId);
    if (!item) return null;

    const rec = this.picker.pickRecord({
      category: item.blessing?.category ?? 'binh_an',
      tier: item.tier,
    });
    const finalText = fillName(rec.text, item.viewer.displayName);
    const rendered = await this.safeRenderVoice(finalText);

    item.blessing = {
      ...item.blessing,
      text: finalText,
      source: 'bank',
      category: rec.category,
      audioUrl: rendered.url,
      durationMs: rendered.durationMs,
    };
    return item;
  }

  private async safeRenderVoice(
    text: string,
  ): Promise<{ url: string; durationMs: number }> {
    try {
      const res = await this.voice.render(text);
      return { url: res.url, durationMs: res.durationMs };
    } catch {
      // Dự phòng 1: tìm câu kho đã có sẵn audio_path
      try {
        const bankWithAudio = this.repo
          .listBlessings({ activeOnly: true })
          .find((b) => b.audio_path);
        if (bankWithAudio?.audio_path) {
          return {
            url: bankWithAudio.audio_path,
            durationMs: Math.max(1500, Array.from(text).length * 70),
          };
        }
      } catch {
        // ignore
      }
      // Dự phòng 2: lượt chỉ có phụ đề (audioUrl rỗng, durationMs ước lượng 70ms/ký tự)
      return {
        url: '',
        durationMs: Math.max(1500, Array.from(text).length * 70),
      };
    }
  }

  private scheduleStartWithGrace(visit: Visit): void {
    const cfg = getSettings();
    const graceMs = this.skipGraceDelay
      ? 0
      : visit.tier === 'grand'
        ? cfg.giftGraceMs.grand
        : visit.tier === 'miracle'
          ? cfg.giftGraceMs.miracle
          : cfg.giftGraceMs.visit;

    const dispatchNow = () => {
      this.graceTimers.delete(visit.id);
      if (visit.status !== 'performing') return;

      // Ghi log vào bảng visits
      try {
        this.repo.insertVisit({
          id: visit.id,
          user_id: visit.viewer.userId,
          nickname: visit.viewer.nickname,
          tier: visit.tier,
          total_coins: visit.totalCoins,
          blessing_source: visit.blessing?.source ?? 'bank',
          category: visit.blessing?.category ?? 'binh_an',
          wish_rejected: visit.wishRejected,
        });
      } catch {
        // ignore db error
      }

      // Đặt watchdog tự chuyển lượt nếu overlay không báo visit:done sau durationMs + 10s
      if (this.watchdogTimer) {
        clearTimeout(this.watchdogTimer);
      }
      const totalDuration =
        this.queue.durationFor(visit.tier) +
        (visit.blessing?.durationMs ?? 5000) +
        10_000;
      this.watchdogTimer = setTimeout(() => {
        if (this.queue.getPerformingVisit()?.id === visit.id) {
          this.queue.markDone(visit.id);
        }
      }, totalDuration);

      for (const fn of this.startListeners) {
        fn(visit);
      }
    };

    if (graceMs <= 0) {
      dispatchNow();
    } else {
      const timer = setTimeout(dispatchNow, graceMs);
      this.graceTimers.set(visit.id, timer);
    }
  }

  public notifyVisitDone(visitId: string): void {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    const gTimer = this.graceTimers.get(visitId);
    if (gTimer) {
      clearTimeout(gTimer);
      this.graceTimers.delete(visitId);
    }
    this.queue.markDone(visitId);
    void this.tick();
  }

  public dispose(): void {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.fireflyFlushTimer) {
      clearTimeout(this.fireflyFlushTimer);
      this.fireflyFlushTimer = null;
    }
    for (const t of this.graceTimers.values()) {
      clearTimeout(t);
    }
    this.graceTimers.clear();
  }
}

