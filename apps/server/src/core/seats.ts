import type { Viewer } from '@but-oi/shared';
import { getSettings } from '../config.js';

export type SeatSlot = {
  seatIndex: number;
  viewer: Viewer;
  lastActiveAt: number;
};

export class SeatManager {
  private slots = new Map<number, SeatSlot>();
  private userToSeat = new Map<string, number>();
  private seenUserIds = new Set<string>();

  private addListeners: Array<
    (payload: Viewer & { seatIndex: number; totalJoined: number }) => void
  > = [];
  private removeListeners: Array<(userId: string) => void> = [];

  private getMaxSeats(): number {
    return getSettings().seatCount;
  }

  public onSeatAdd(
    fn: (payload: Viewer & { seatIndex: number; totalJoined: number }) => void,
  ): void {
    this.addListeners.push(fn);
  }

  public onSeatRemove(fn: (userId: string) => void): void {
    this.removeListeners.push(fn);
  }

  public handleJoin(viewer: Viewer, now = Date.now()): SeatSlot {
    this.seenUserIds.add(viewer.userId);
    const existingSeat = this.userToSeat.get(viewer.userId);
    if (existingSeat !== undefined) {
      const slot = this.slots.get(existingSeat)!;
      slot.viewer = viewer;
      slot.lastActiveAt = now;
      return slot;
    }

    const maxSeats = this.getMaxSeats();
    // Tìm ghế trống đầu tiên
    for (let i = 0; i < maxSeats; i++) {
      if (!this.slots.has(i)) {
        const slot: SeatSlot = { seatIndex: i, viewer, lastActiveAt: now };
        this.slots.set(i, slot);
        this.userToSeat.set(viewer.userId, i);
        this.emitAdd(slot);
        return slot;
      }
    }

    // Hết chỗ -> thay người có lastActiveAt cũ nhất
    let oldestSlot: SeatSlot | null = null;
    for (const slot of this.slots.values()) {
      if (!oldestSlot || slot.lastActiveAt < oldestSlot.lastActiveAt) {
        oldestSlot = slot;
      }
    }

    const targetIndex = oldestSlot ? oldestSlot.seatIndex : 0;
    if (oldestSlot) {
      this.userToSeat.delete(oldestSlot.viewer.userId);
      this.emitRemove(oldestSlot.viewer.userId);
    }

    const newSlot: SeatSlot = {
      seatIndex: targetIndex,
      viewer,
      lastActiveAt: now,
    };
    this.slots.set(targetIndex, newSlot);
    this.userToSeat.set(viewer.userId, targetIndex);
    this.emitAdd(newSlot);
    return newSlot;
  }

  public touch(viewer: Viewer, now = Date.now()): void {
    this.seenUserIds.add(viewer.userId);
    const existingSeat = this.userToSeat.get(viewer.userId);
    if (existingSeat !== undefined) {
      const slot = this.slots.get(existingSeat);
      if (slot) {
        slot.viewer = viewer;
        slot.lastActiveAt = now;
      }
      return;
    }
    this.handleJoin(viewer, now);
  }

  public getSeatedList(): SeatSlot[] {
    return Array.from(this.slots.values()).sort((a, b) => a.seatIndex - b.seatIndex);
  }

  public getTotalJoined(): number {
    return Math.max(this.seenUserIds.size, this.slots.size);
  }

  public hasSeat(userId: string): boolean {
    return this.userToSeat.has(userId);
  }

  public clear(): void {
    this.slots.clear();
    this.userToSeat.clear();
    this.seenUserIds.clear();
  }

  private emitAdd(slot: SeatSlot): void {
    const totalJoined = this.getTotalJoined();
    for (const fn of this.addListeners) {
      fn({ ...slot.viewer, seatIndex: slot.seatIndex, totalJoined });
    }
  }

  private emitRemove(userId: string): void {
    for (const fn of this.removeListeners) {
      fn(userId);
    }
  }
}

