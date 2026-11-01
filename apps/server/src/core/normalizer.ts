import type { LiveEvent, Viewer } from '@but-oi/shared';
import { getSettings } from '../config.js';
import { sanitizeSpokenName } from '../blessing/nameSanitizer.js';

export type RawUser = {
  userId: string;
  uniqueId?: string;
  nickname?: string;
};

export type RawIncomingEvent =
  | ({ type: 'join'; at?: number } & RawUser)
  | ({ type: 'like'; count?: number; at?: number } & RawUser)
  | ({ type: 'chat'; text: string; at?: number } & RawUser)
  | ({ type: 'follow'; at?: number } & RawUser)
  | ({ type: 'share'; at?: number } & RawUser)
  | ({
      type: 'gift';
      giftId?: number;
      giftName?: string;
      diamondCount: number;
      repeatCount?: number;
      giftType?: number;
      repeatEnd?: boolean;
      at?: number;
    } & RawUser);

export function computeAvatarSeed(userId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

export function toViewer(u: RawUser): Viewer {
  const userId = String(u.userId || 'anon');
  const uniqueId = String(u.uniqueId || userId);
  const nickname = String(u.nickname || uniqueId);
  return {
    userId,
    uniqueId,
    nickname,
    displayName: sanitizeSpokenName(nickname),
    avatarSeed: computeAvatarSeed(userId),
  };
}

type PendingGift = {
  viewer: Viewer;
  giftId: number;
  giftName: string;
  coinsEach: number;
  repeatCount: number;
  totalCoins: number;
  timer: ReturnType<typeof setTimeout>;
};

type PendingLike = {
  viewer: Viewer;
  count: number;
  timer: ReturnType<typeof setTimeout>;
};

export class EventNormalizer {
  private listeners: Array<(e: LiveEvent) => void> = [];
  private pendingGifts = new Map<string, PendingGift>();
  private pendingLikes = new Map<string, PendingLike>();
  private recentJoins = new Map<string, number>();

  private readonly joinDedupMs: number;
  private readonly likeWindowMs: number;
  private readonly comboWindowMsOverride?: number;

  constructor(opts?: {
    joinDedupMs?: number;
    likeWindowMs?: number;
    comboWindowMs?: number;
  }) {
    this.joinDedupMs = opts?.joinDedupMs ?? 60_000;
    this.likeWindowMs = opts?.likeWindowMs ?? 2_000;
    this.comboWindowMsOverride = opts?.comboWindowMs;
  }

  public onEvent(handler: (e: LiveEvent) => void): void {
    this.listeners.push(handler);
  }

  private emit(event: LiveEvent): void {
    for (const fn of this.listeners) {
      fn(event);
    }
  }

  private getComboWindowMs(): number {
    return this.comboWindowMsOverride ?? getSettings().comboWindowMs;
  }

  public ingest(raw: RawIncomingEvent): void {
    const now = raw.at ?? Date.now();
    const viewer = toViewer(raw);

    switch (raw.type) {
      case 'join': {
        const lastJoin = this.recentJoins.get(viewer.userId);
        if (lastJoin !== undefined && now - lastJoin < this.joinDedupMs) {
          return;
        }
        this.recentJoins.set(viewer.userId, now);
        this.emit({ type: 'join', viewer, at: now });
        return;
      }

      case 'like': {
        const count = Math.max(1, raw.count ?? 1);
        const existing = this.pendingLikes.get(viewer.userId);
        if (existing) {
          existing.count += count;
          existing.viewer = viewer;
          return;
        }
        const timer = setTimeout(() => {
          this.flushLike(viewer.userId);
        }, this.likeWindowMs);
        this.pendingLikes.set(viewer.userId, { viewer, count, timer });
        return;
      }

      case 'chat': {
        this.emit({
          type: 'chat',
          viewer,
          text: String(raw.text ?? ''),
          at: now,
        });
        return;
      }

      case 'follow': {
        this.emit({ type: 'follow', viewer, at: now });
        return;
      }

      case 'share': {
        this.emit({ type: 'share', viewer, at: now });
        return;
      }

      case 'gift': {
        // Quà dạng chuỗi (giftType === 1) chỉ tính khi repeatEnd === true
        if (raw.giftType === 1 && !raw.repeatEnd) {
          return;
        }
        const coinsEach = Math.max(0, raw.diamondCount);
        const repeatCount = Math.max(1, raw.repeatCount ?? 1);
        const coins = coinsEach * repeatCount;
        if (coins <= 0) return;

        const existing = this.pendingGifts.get(viewer.userId);
        if (existing) {
          existing.totalCoins += coins;
          existing.repeatCount += repeatCount;
          existing.viewer = viewer;
          return;
        }

        const timer = setTimeout(() => {
          this.flushGift(viewer.userId);
        }, this.getComboWindowMs());

        this.pendingGifts.set(viewer.userId, {
          viewer,
          giftId: raw.giftId ?? 1,
          giftName: raw.giftName ?? 'Gift',
          coinsEach,
          repeatCount,
          totalCoins: coins,
          timer,
        });
        return;
      }
    }
  }

  private flushGift(userId: string): void {
    const p = this.pendingGifts.get(userId);
    if (!p) return;
    this.pendingGifts.delete(userId);
    this.emit({
      type: 'gift',
      viewer: p.viewer,
      giftId: p.giftId,
      giftName: p.giftName,
      coinsEach: p.coinsEach,
      repeatCount: p.repeatCount,
      totalCoins: p.totalCoins,
      at: Date.now(),
    });
  }

  private flushLike(userId: string): void {
    const p = this.pendingLikes.get(userId);
    if (!p) return;
    this.pendingLikes.delete(userId);
    this.emit({
      type: 'like',
      viewer: p.viewer,
      count: p.count,
      at: Date.now(),
    });
  }

  public dispose(): void {
    for (const p of this.pendingGifts.values()) {
      clearTimeout(p.timer);
    }
    for (const p of this.pendingLikes.values()) {
      clearTimeout(p.timer);
    }
    this.pendingGifts.clear();
    this.pendingLikes.clear();
    this.recentJoins.clear();
  }
}

