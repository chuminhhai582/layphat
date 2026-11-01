import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventNormalizer } from './normalizer.js';
import type { LiveEvent } from '@but-oi/shared';

describe('T05 - EventNormalizer', () => {
  let normalizer: EventNormalizer;
  let events: LiveEvent[];

  beforeEach(() => {
    vi.useFakeTimers();
    events = [];
    normalizer = new EventNormalizer({ comboWindowMs: 5000 });
    normalizer.onEvent((e) => events.push(e));
  });

  afterEach(() => {
    normalizer.dispose();
    vi.useRealTimers();
  });

  it('1. handles single non-streak gift after comboWindowMs', () => {
    normalizer.ingest({
      type: 'gift',
      userId: 'u1',
      nickname: 'Minh',
      diamondCount: 50,
      repeatCount: 1,
      giftType: 0,
    });
    expect(events).toHaveLength(0);
    vi.advanceTimersByTime(5000);
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('gift');
    if (events[0]?.type === 'gift') {
      expect(events[0].totalCoins).toBe(50);
    }
  });

  it('2. ignores intermediate streak events (giftType=1, repeatEnd=false) and only counts repeatEnd=true', () => {
    for (let i = 1; i <= 9; i++) {
      normalizer.ingest({
        type: 'gift',
        userId: 'u1',
        nickname: 'Lan',
        diamondCount: 5,
        repeatCount: i,
        giftType: 1,
        repeatEnd: false,
      });
    }
    normalizer.ingest({
      type: 'gift',
      userId: 'u1',
      nickname: 'Lan',
      diamondCount: 5,
      repeatCount: 10,
      giftType: 1,
      repeatEnd: true,
    });
    vi.advanceTimersByTime(5000);
    expect(events).toHaveLength(1);
    if (events[0]?.type === 'gift') {
      expect(events[0].totalCoins).toBe(50);
    }
  });

  it('3. combines 2 different gifts from the same user within comboWindowMs into 1 gift event', () => {
    normalizer.ingest({
      type: 'gift',
      userId: 'u1',
      nickname: 'Hùng',
      giftId: 1,
      diamondCount: 20,
      repeatCount: 1,
    });
    vi.advanceTimersByTime(2000);
    normalizer.ingest({
      type: 'gift',
      userId: 'u1',
      nickname: 'Hùng',
      giftId: 2,
      diamondCount: 30,
      repeatCount: 1,
    });
    vi.advanceTimersByTime(3000);
    expect(events).toHaveLength(1);
    if (events[0]?.type === 'gift') {
      expect(events[0].totalCoins).toBe(50);
    }
  });

  it('4. keeps gifts from 2 different users separate', () => {
    normalizer.ingest({
      type: 'gift',
      userId: 'u1',
      nickname: 'An',
      diamondCount: 30,
    });
    normalizer.ingest({
      type: 'gift',
      userId: 'u2',
      nickname: 'Bình',
      diamondCount: 300,
    });
    vi.advanceTimersByTime(5000);
    expect(events).toHaveLength(2);
  });

  it('5. emits a second gift event when sent after comboWindowMs expires', () => {
    normalizer.ingest({
      type: 'gift',
      userId: 'u1',
      nickname: 'Mai',
      diamondCount: 30,
    });
    vi.advanceTimersByTime(5001);
    expect(events).toHaveLength(1);

    normalizer.ingest({
      type: 'gift',
      userId: 'u1',
      nickname: 'Mai',
      diamondCount: 100,
    });
    vi.advanceTimersByTime(5000);
    expect(events).toHaveLength(2);
  });

  it('6. deduplicates join events from the same userId within 60s and merges likes within 2s', () => {
    const t0 = Date.now();
    normalizer.ingest({ type: 'join', userId: 'u1', nickname: 'Tâm', at: t0 });
    normalizer.ingest({ type: 'join', userId: 'u1', nickname: 'Tâm', at: t0 + 15000 });
    expect(events.filter((e) => e.type === 'join')).toHaveLength(1);

    normalizer.ingest({ type: 'join', userId: 'u1', nickname: 'Tâm', at: t0 + 61000 });
    expect(events.filter((e) => e.type === 'join')).toHaveLength(2);

    normalizer.ingest({ type: 'like', userId: 'u1', nickname: 'Tâm', count: 3 });
    normalizer.ingest({ type: 'like', userId: 'u1', nickname: 'Tâm', count: 5 });
    vi.advanceTimersByTime(2000);
    const likes = events.filter((e) => e.type === 'like');
    expect(likes).toHaveLength(1);
    if (likes[0]?.type === 'like') {
      expect(likes[0].count).toBe(8);
    }
  });
});

