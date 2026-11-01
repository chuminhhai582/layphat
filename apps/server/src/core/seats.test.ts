import { describe, it, expect, beforeEach } from 'vitest';
import { SeatManager } from './seats.js';
import { resetSettings, updateSettings } from '../config.js';
import type { Viewer } from '@but-oi/shared';

function makeViewer(id: string): Viewer {
  return {
    userId: id,
    uniqueId: id,
    nickname: `User ${id}`,
    displayName: `User ${id}`,
    avatarSeed: 1,
  };
}

describe('T08 - SeatManager', () => {
  let seats: SeatManager;

  beforeEach(() => {
    resetSettings();
    seats = new SeatManager();
  });

  it('allocates up to seatCount (36) seats and does not duplicate seat for existing user', () => {
    const added: string[] = [];
    const removed: string[] = [];
    seats.onSeatAdd((v) => added.push(v.userId));
    seats.onSeatRemove((id) => removed.push(id));

    const slot0 = seats.handleJoin(makeViewer('u1'), 1000);
    expect(slot0.seatIndex).toBe(0);

    // Re-joining updates lastActiveAt without emitting another seat:add
    const slot0Again = seats.handleJoin(makeViewer('u1'), 2000);
    expect(slot0Again.seatIndex).toBe(0);
    expect(added).toEqual(['u1']);
    expect(removed).toHaveLength(0);
  });

  it('evicts the viewer with oldest lastActiveAt when full, and updates lastActiveAt on touch', () => {
    updateSettings({ seatCount: 3 });

    const removed: string[] = [];
    seats.onSeatRemove((id) => removed.push(id));

    seats.handleJoin(makeViewer('u1'), 1000);
    seats.handleJoin(makeViewer('u2'), 2000);
    seats.handleJoin(makeViewer('u3'), 3000);

    // u1 interacts at t=4000 -> now u2 has oldest lastActiveAt (2000)
    seats.touch(makeViewer('u1'), 4000);

    const slot4 = seats.handleJoin(makeViewer('u4'), 5000);
    expect(removed).toEqual(['u2']);
    expect(slot4.seatIndex).toBe(1);
    expect(seats.hasSeat('u2')).toBe(false);
    expect(seats.hasSeat('u4')).toBe(true);
    expect(seats.getTotalJoined()).toBe(4);
  });
});

