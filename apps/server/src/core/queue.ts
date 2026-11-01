import { nanoid } from 'nanoid';
import type { Settings, TierId, Viewer, Visit } from '@but-oi/shared';
import { getSettings } from '../config.js';
import { TIER_RANK, durationFor, tierFor } from './tiers.js';

export type FireflyEmitPayload = {
  viewer: Viewer;
  coins: number;
};

export class VisitQueue {
  private items: Visit[] = [];
  private performingVisit: Visit | null = null;
  private lastFinishedAt = 0;
  private paused = false;
  private restTimer: ReturnType<typeof setTimeout> | null = null;
  private promotedIds = new Set<string>();

  private changeListeners: Array<(queue: Visit[]) => void> = [];
  private fireflyListeners: Array<(payload: FireflyEmitPayload) => void> = [];
  private performListeners: Array<(visit: Visit) => void> = [];

  public static readonly MIN_REST_MS = 1500;

  private getCfg(): Settings {
    return getSettings();
  }

  public onChange(fn: (queue: Visit[]) => void): void {
    this.changeListeners.push(fn);
  }

  public onFirefly(fn: (payload: FireflyEmitPayload) => void): void {
    this.fireflyListeners.push(fn);
  }

  public onPerform(fn: (visit: Visit) => void): void {
    this.performListeners.push(fn);
  }

  private notifyChange(): void {
    const top = this.getPendingSorted().slice(0, 5);
    for (const fn of this.changeListeners) {
      fn(top);
    }
  }

  public enqueue(v: Viewer, coins: number, now = Date.now()): Visit | null {
    const cfg = this.getCfg();
    const initialTier = tierFor(coins, cfg);
    if (!initialTier) return null;

    // Kiểm tra người này đã có lượt đang chờ trong hàng chưa
    const existing = this.items.find(
      (x) =>
        x.viewer.userId === v.userId &&
        ['queued', 'preparing', 'ready'].includes(x.status),
    );
    if (existing) {
      existing.totalCoins += coins;
      const upgraded = tierFor(existing.totalCoins, cfg);
      if (upgraded && TIER_RANK[upgraded] > TIER_RANK[existing.tier]) {
        existing.tier = upgraded;
      }
      this.notifyChange();
      return existing;
    }

    // Bậc firefly không vào hàng chờ mà phát ngay sự kiện riêng
    if (initialTier === 'firefly') {
      for (const fn of this.fireflyListeners) {
        fn({ viewer: v, coins });
      }
      return null;
    }

    const item: Visit = {
      id: nanoid(),
      viewer: v,
      totalCoins: coins,
      tier: initialTier,
      enqueuedAt: now,
      status: 'queued',
      hadWish: false,
      wishRejected: false,
    };
    this.items.push(item);
    this.notifyChange();
    return item;
  }

  public enqueueManual(v: Viewer, tier: TierId, now = Date.now()): Visit {
    const cfg = this.getCfg();
    const tierCfg = cfg.tiers.find((t) => t.id === tier);
    const coins = tierCfg?.minCoins ?? 30;
    const item: Visit = {
      id: nanoid(),
      viewer: v,
      totalCoins: coins,
      tier,
      enqueuedAt: now,
      status: 'queued',
      hadWish: false,
      wishRejected: false,
    };
    this.items.push(item);
    this.notifyChange();
    return item;
  }

  public getPendingSorted(now = Date.now()): Visit[] {
    const cfg = this.getCfg();
    const pending = this.items.filter((x) =>
      ['queued', 'preparing', 'ready'].includes(x.status),
    );
    return [...pending].sort((a, b) => {
      const aPromoted = this.promotedIds.has(a.id) ? 1 : 0;
      const bPromoted = this.promotedIds.has(b.id) ? 1 : 0;
      if (aPromoted !== bPromoted) return bPromoted - aPromoted;

      const aStarving = now - a.enqueuedAt > cfg.maxWaitMs ? 1 : 0;
      const bStarving = now - b.enqueuedAt > cfg.maxWaitMs ? 1 : 0;
      if (aStarving !== bStarving) return bStarving - aStarving;
      if (aStarving && bStarving) return a.enqueuedAt - b.enqueuedAt;

      return TIER_RANK[b.tier] - TIER_RANK[a.tier] || a.enqueuedAt - b.enqueuedAt;
    });
  }

  public pickNext(now = Date.now()): Visit | undefined {
    const cfg = this.getCfg();
    const ready = this.items.filter((x) => x.status === 'ready');
    if (ready.length === 0) return undefined;

    const promoted = ready.find((x) => this.promotedIds.has(x.id));
    if (promoted) return promoted;

    const starving = ready
      .filter((x) => now - x.enqueuedAt > cfg.maxWaitMs)
      .sort((a, b) => a.enqueuedAt - b.enqueuedAt);
    if (starving[0]) return starving[0];

    return ready.sort(
      (a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier] || a.enqueuedAt - b.enqueuedAt,
    )[0];
  }

  public durationFor(tier: TierId): number {
    const activeLen = this.items.filter((x) =>
      ['queued', 'preparing', 'ready'].includes(x.status),
    ).length;
    return durationFor(tier, activeLen, this.getCfg());
  }

  public tryDispatchNext(now = Date.now()): Visit | null {
    if (this.paused || this.performingVisit) {
      return null;
    }

    const next = this.pickNext(now);
    if (!next) return null;

    const elapsedSinceLast = this.lastFinishedAt > 0 ? now - this.lastFinishedAt : Infinity;
    if (elapsedSinceLast < VisitQueue.MIN_REST_MS) {
      const waitMs = VisitQueue.MIN_REST_MS - elapsedSinceLast;
      if (!this.restTimer) {
        this.restTimer = setTimeout(() => {
          this.restTimer = null;
          this.tryDispatchNext(Date.now());
        }, waitMs);
      }
      return null;
    }

    next.status = 'performing';
    this.performingVisit = next;
    this.promotedIds.delete(next.id);
    this.notifyChange();
    for (const fn of this.performListeners) {
      fn(next);
    }
    return next;
  }

  public markDone(visitId: string, now = Date.now()): void {
    const item = this.items.find((x) => x.id === visitId);
    if (item) {
      item.status = 'done';
    }
    if (this.performingVisit?.id === visitId) {
      this.performingVisit = null;
      this.lastFinishedAt = now;
    }
    this.items = this.items.filter((x) => !['done', 'skipped'].includes(x.status));
    this.notifyChange();
    this.tryDispatchNext(now);
  }

  public skip(visitId: string, now = Date.now()): boolean {
    const item = this.items.find((x) => x.id === visitId);
    if (!item) return false;
    item.status = 'skipped';
    this.promotedIds.delete(visitId);
    if (this.performingVisit?.id === visitId) {
      this.performingVisit = null;
      this.lastFinishedAt = now;
    }
    this.items = this.items.filter((x) => !['done', 'skipped'].includes(x.status));
    this.notifyChange();
    this.tryDispatchNext(now);
    return true;
  }

  public promote(visitId: string): boolean {
    const item = this.items.find((x) => x.id === visitId);
    if (!item) return false;
    this.promotedIds.add(visitId);
    this.notifyChange();
    return true;
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (!paused) {
      this.tryDispatchNext(Date.now());
    }
  }

  public isPaused(): boolean {
    return this.paused;
  }

  public getPerformingVisit(): Visit | null {
    return this.performingVisit;
  }

  public getAllItems(): Visit[] {
    return [...this.items];
  }

  public getActiveCount(): number {
    return this.items.filter((x) => ['queued', 'preparing', 'ready'].includes(x.status)).length;
  }

  public clear(): void {
    if (this.restTimer) {
      clearTimeout(this.restTimer);
      this.restTimer = null;
    }
    this.items = [];
    this.performingVisit = null;
    this.promotedIds.clear();
  }
}

