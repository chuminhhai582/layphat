import Phaser from 'phaser';
import type { Viewer } from '@but-oi/shared';
import { VillagerPuppet } from '../puppets/VillagerPuppet.js';

/**
 * SeatGrid (T16) theo UI_SPEC.md §4.3:
 * - 6 hàng x 6 cột (36 chỗ):
 *   x = 60 + c * 170 + (r % 2 ? 85 : 0)
 *   y = 1270 + r * 72
 * - seat:add -> đi vào từ mép phải (x = 1140) rồi ngồi tại vị trí ghế.
 * - seat:remove -> đứng dậy đi ra mép phải rồi hủy.
 */
export class SeatGrid {
  public readonly container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private puppetsByUser = new Map<string, { seatIndex: number; puppet: VillagerPuppet }>();
  private occupiedSeats = new Map<number, string>();

  constructor(scene: Phaser.Scene, parentContainer: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.container = parentContainer;
  }

  public static computeSeatPosition(seatIndex: number): { x: number; y: number } {
    const safeIdx = Math.max(0, seatIndex % 36);
    const r = Math.floor(safeIdx / 6);
    const c = safeIdx % 6;
    const x = 60 + c * 170 + (r % 2 ? 85 : 0);
    const y = 1270 + r * 72;
    return { x, y };
  }

  public addOrUpdateVillager(
    viewer: Viewer & { seatIndex?: number },
    animateWalkIn = true,
  ): VillagerPuppet {
    const existing = this.puppetsByUser.get(viewer.userId);
    if (existing) {
      existing.puppet.showLabelFor60s();
      return existing.puppet;
    }

    let seatIndex = viewer.seatIndex;
    if (seatIndex === undefined) {
      for (let i = 0; i < 36; i++) {
        if (!this.occupiedSeats.has(i)) {
          seatIndex = i;
          break;
        }
      }
      if (seatIndex === undefined) seatIndex = 0;
    }

    const prevOwner = this.occupiedSeats.get(seatIndex);
    if (prevOwner && prevOwner !== viewer.userId) {
      this.removeVillager(prevOwner, false);
    }

    const pos = SeatGrid.computeSeatPosition(seatIndex);
    const startX = animateWalkIn ? 1140 : pos.x;
    const puppet = new VillagerPuppet(this.scene, viewer, startX, pos.y);
    puppet.seatX = pos.x;
    puppet.seatY = pos.y;

    this.container.add(puppet.container);
    this.container.sort('y');

    this.puppetsByUser.set(viewer.userId, { seatIndex, puppet });
    this.occupiedSeats.set(seatIndex, viewer.userId);

    if (animateWalkIn) {
      void puppet.walkTo(pos.x, pos.y, 1, 900);
    }

    return puppet;
  }

  public removeVillager(userId: string, animateWalkOut = true): void {
    const entry = this.puppetsByUser.get(userId);
    if (!entry) return;

    this.puppetsByUser.delete(userId);
    if (this.occupiedSeats.get(entry.seatIndex) === userId) {
      this.occupiedSeats.delete(entry.seatIndex);
    }

    if (!animateWalkOut) {
      entry.puppet.destroy();
      return;
    }

    void entry.puppet.walkTo(1140, entry.puppet.seatY, 1, 800).then(() => {
      entry.puppet.destroy();
    });
  }

  public getPuppet(userId: string): VillagerPuppet | undefined {
    return this.puppetsByUser.get(userId)?.puppet;
  }

  public clear(): void {
    for (const entry of this.puppetsByUser.values()) {
      entry.puppet.destroy();
    }
    this.puppetsByUser.clear();
    this.occupiedSeats.clear();
  }
}

