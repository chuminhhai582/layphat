import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VisitQueue, type FireflyEmitPayload } from './queue.js';
import { resetSettings } from '../config.js';
import type { Viewer } from '@but-oi/shared';

function makeViewer(id: string, name = id): Viewer {
  return {
    userId: id,
    uniqueId: id,
    nickname: name,
    displayName: name,
    avatarSeed: 1,
  };
}

describe('T07 - VisitQueue', () => {
  let q: VisitQueue;

  beforeEach(() => {
    vi.useFakeTimers();
    resetSettings();
    q = new VisitQueue();
  });

  afterEach(() => {
    q.clear();
    vi.useRealTimers();
  });

  it('1. prioritizes higher tier first (grand > miracle > visit)', () => {
    const v1 = q.enqueue(makeViewer('u1'), 30, 1000)!;
    const v2 = q.enqueue(makeViewer('u2'), 300, 1100)!;
    const v3 = q.enqueue(makeViewer('u3'), 3000, 1200)!;
    v1.status = 'ready';
    v2.status = 'ready';
    v3.status = 'ready';

    expect(q.pickNext(2000)?.id).toBe(v3.id);
  });

  it('2. uses FIFO within the same tier', () => {
    const v1 = q.enqueue(makeViewer('u1'), 50, 1000)!;
    const v2 = q.enqueue(makeViewer('u2'), 80, 1200)!;
    v1.status = 'ready';
    v2.status = 'ready';

    expect(q.pickNext(2000)?.id).toBe(v1.id);
  });

  it('3. promotes starving items waiting longer than maxWaitMs (90s) ahead of higher tiers', () => {
    const vVisit = q.enqueue(makeViewer('u1'), 30, 1000)!;
    const vGrand = q.enqueue(makeViewer('u2'), 3000, 50_000)!;
    vVisit.status = 'ready';
    vGrand.status = 'ready';

    // At t = 92_000 (91s > 90s maxWaitMs), vVisit is starving
    expect(q.pickNext(92_000)?.id).toBe(vVisit.id);
  });

  it('4. upgrades existing waiting item when same user gifts more instead of creating a new entry', () => {
    const v1 = q.enqueue(makeViewer('u1'), 50, 1000)!;
    expect(v1.tier).toBe('visit');

    const v1After = q.enqueue(makeViewer('u1'), 300, 1500)!;
    expect(v1After.id).toBe(v1.id);
    expect(v1After.totalCoins).toBe(350);
    expect(v1After.tier).toBe('miracle');
    expect(q.getActiveCount()).toBe(1);
  });

  it('5. shortens visit duration to 12000ms when queue length > 8', () => {
    for (let i = 1; i <= 8; i++) {
      q.enqueue(makeViewer(`u${i}`), 30, i * 100);
    }
    expect(q.durationFor('visit')).toBe(20000);

    q.enqueue(makeViewer('u9'), 30, 900);
    expect(q.durationFor('visit')).toBe(12000);
  });

  it('6. does not enqueue firefly tier and emits immediate firefly event instead', () => {
    const fireflies: FireflyEmitPayload[] = [];
    q.onFirefly((f) => fireflies.push(f));

    const res = q.enqueue(makeViewer('u_ff'), 10, 1000);
    expect(res).toBeNull();
    expect(q.getActiveCount()).toBe(0);
    expect(fireflies).toHaveLength(1);
    expect(fireflies[0]?.coins).toBe(10);
  });

  it('7. enforces a minimum 1.5s rest between two consecutive visits', () => {
    const performed: string[] = [];
    q.onPerform((v) => performed.push(v.id));

    const t0 = 10_000;
    vi.setSystemTime(t0);

    const v1 = q.enqueue(makeViewer('u1'), 50, t0)!;
    const v2 = q.enqueue(makeViewer('u2'), 50, t0 + 100)!;
    v1.status = 'ready';
    v2.status = 'ready';

    q.tryDispatchNext(t0);
    expect(performed).toEqual([v1.id]);

    // Finish v1 at t0 + 20_000
    const tDone = t0 + 20_000;
    vi.setSystemTime(tDone);
    q.markDone(v1.id, tDone);

    // Immediately after markDone, v2 must not start yet (< 1500ms rest)
    expect(performed).toEqual([v1.id]);

    // Advance 1499ms -> still resting
    vi.advanceTimersByTime(1499);
    expect(performed).toEqual([v1.id]);

    // Advance 1ms more (total 1500ms) -> v2 starts
    vi.advanceTimersByTime(1);
    expect(performed).toEqual([v1.id, v2.id]);
  });
});

