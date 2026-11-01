import { nanoid } from 'nanoid';
import type { GroupVisitPayload, Viewer } from '@but-oi/shared';
import { getSettings } from '../config.js';
import { defaultPicker, fillName, type BlessingPicker } from '../blessing/picker.js';
import { defaultVoiceService, type VoiceService } from '../voice/index.js';
import { VisitQueue } from './queue.js';

export class GroupVisitScheduler {
  private queue: VisitQueue;
  private picker: BlessingPicker;
  private voice: VoiceService;
  private recentUnblessedViewers: Viewer[] = [];
  private blessedUserIds = new Set<string>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextGroupVisitAt: number;
  private pendingDeferred = false;

  private groupListeners: Array<(payload: GroupVisitPayload) => void> = [];
  private countdownListeners: Array<(nextAt: number) => void> = [];

  constructor(opts: {
    queue: VisitQueue;
    picker?: BlessingPicker;
    voice?: VoiceService;
    now?: number;
  }) {
    this.queue = opts.queue;
    this.picker = opts.picker ?? defaultPicker;
    this.voice = opts.voice ?? defaultVoiceService;
    this.nextGroupVisitAt = (opts.now ?? Date.now()) + getSettings().groupVisitEveryMs;
  }

  public onGroupVisit(fn: (payload: GroupVisitPayload) => void): void {
    this.groupListeners.push(fn);
  }

  public onCountdownUpdate(fn: (nextAt: number) => void): void {
    this.countdownListeners.push(fn);
  }

  public getNextGroupVisitAt(): number {
    return this.nextGroupVisitAt;
  }

  public recordViewerJoin(viewer: Viewer): void {
    if (this.blessedUserIds.has(viewer.userId)) return;
    this.recentUnblessedViewers = this.recentUnblessedViewers.filter(
      (v) => v.userId !== viewer.userId,
    );
    this.recentUnblessedViewers.push(viewer);
    if (this.recentUnblessedViewers.length > 50) {
      this.recentUnblessedViewers.shift();
    }
  }

  public start(): void {
    this.stop();
    const intervalMs = getSettings().groupVisitEveryMs;
    this.nextGroupVisitAt = Date.now() + intervalMs;
    this.emitCountdown();

    this.timer = setInterval(() => {
      void this.triggerOrDefer(Date.now());
    }, intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public canRunNow(): boolean {
    if (this.queue.isPaused()) return false;
    if (this.queue.getPerformingVisit() !== null) return false;
    if (this.queue.getActiveCount() > 3) return false;
    return true;
  }

  public async triggerOrDefer(now = Date.now()): Promise<GroupVisitPayload | null> {
    if (!this.canRunNow()) {
      this.pendingDeferred = true;
      return null;
    }
    return this.executeGroupVisit(now);
  }

  public async checkDeferredOnIdle(now = Date.now()): Promise<GroupVisitPayload | null> {
    if (this.pendingDeferred && this.canRunNow()) {
      return this.executeGroupVisit(now);
    }
    return null;
  }

  private async executeGroupVisit(now = Date.now()): Promise<GroupVisitPayload> {
    this.pendingDeferred = false;
    const intervalMs = getSettings().groupVisitEveryMs;
    this.nextGroupVisitAt = now + intervalMs;
    this.emitCountdown();

    // Chọn 3-5 người vào gần nhất chưa được chúc
    const pickedViewers = this.recentUnblessedViewers.slice(-5);
    const names =
      pickedViewers.length > 0
        ? pickedViewers.map((v) => v.displayName)
        : ['các con mới ghé', 'bà con đầu xóm', 'dân làng mình'];

    for (const v of pickedViewers) {
      this.blessedUserIds.add(v.userId);
    }
    this.recentUnblessedViewers = this.recentUnblessedViewers.filter(
      (v) => !this.blessedUserIds.has(v.userId),
    );

    const template = this.picker.pick({ length: 'group' });
    const text = fillName(template, names[0] ?? 'con', names);

    let audioUrl = '';
    let durationMs = Math.max(3000, Array.from(text).length * 70);
    try {
      const rendered = await this.voice.render(text);
      audioUrl = rendered.url;
      durationMs = rendered.durationMs;
    } catch {
      // Fallback subtitle-only
    }

    const payload: GroupVisitPayload = {
      id: nanoid(),
      names,
      text,
      audioUrl,
      durationMs,
    };

    for (const fn of this.groupListeners) {
      fn(payload);
    }
    return payload;
  }

  private emitCountdown(): void {
    for (const fn of this.countdownListeners) {
      fn(this.nextGroupVisitAt);
    }
  }
}

