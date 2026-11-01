import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VisitQueue } from './queue.js';
import { GroupVisitScheduler } from './groupVisit.js';
import { resetSettings } from '../config.js';
import type { GroupVisitPayload, Viewer } from '@but-oi/shared';

function makeViewer(id: string, name: string): Viewer {
  return {
    userId: id,
    uniqueId: id,
    nickname: name,
    displayName: name,
    avatarSeed: 1,
  };
}

describe('T28 - GroupVisitScheduler', () => {
  let queue: VisitQueue;
  let scheduler: GroupVisitScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    resetSettings();
    queue = new VisitQueue();
    scheduler = new GroupVisitScheduler({ queue });
  });

  afterEach(() => {
    scheduler.stop();
    queue.clear();
    vi.useRealTimers();
  });

  it('triggers 3 group visits over 15 minutes when idle, and defers when busy or queue > 3', async () => {
    const visits: GroupVisitPayload[] = [];
    scheduler.onGroupVisit((p) => visits.push(p));

    scheduler.recordViewerJoin(makeViewer('u1', 'An'));
    scheduler.recordViewerJoin(makeViewer('u2', 'Bình'));
    scheduler.recordViewerJoin(makeViewer('u3', 'Châu'));

    scheduler.start();

    // Advance 15 minutes (3 x 4 minutes = 12 mins -> 3 triggers)
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
    expect(visits).toHaveLength(3);
    expect(visits[0]?.names).toEqual(['An', 'Bình', 'Châu']);

    // Now simulate queue > 3 items -> group visit should be deferred
    for (let i = 1; i <= 4; i++) {
      queue.enqueue(makeViewer(`g${i}`, `Guest ${i}`), 50);
    }
    const deferredResult = await scheduler.triggerOrDefer();
    expect(deferredResult).toBeNull();
    expect(visits).toHaveLength(3);

    // Clear queue and checkDeferredOnIdle -> executes deferred group visit immediately
    queue.clear();
    const resumed = await scheduler.checkDeferredOnIdle();
    expect(resumed).not.toBeNull();
    expect(visits).toHaveLength(4);
  });
});

