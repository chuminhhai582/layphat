import Phaser from 'phaser';
import { STRINGS_VI } from '@but-oi/shared';
import { THEME } from '../theme.js';
import { SeatGrid } from './SeatGrid.js';
import { audioBus } from '../audio/AudioBus.js';

/**
 * FXController (T17):
 * - fx:firefly (đom đóm bay lên + chữ nổi "may mắn +1" theo §5.1)
 * - fx:wave (dân làng vẫy tay + bóng Bụt mờ trên ngọn đa 1,5s)
 * - fx:leaf (lá ước treo trên đầu), lá ước rơi xuống ao + gợn nước (wishRejected)
 * - fx:fish (cá bống ngoi lên ao), fx:sparrow (chim sẻ bay đến đậu cạnh người)
 * - Bộ đếm toàn cục giới hạn <= 150 hạt cùng lúc; vượt hạn mức thì bỏ qua.
 * - dimBackgroundFx(true/false) giảm 50% tốc độ và độ sáng khi Bụt nói.
 */
export class FXController {
  public static readonly MAX_PARTICLES = 150;

  private scene: Phaser.Scene;
  private fxContainer: Phaser.GameObjects.Container;
  private seatGrid: SeatGrid;
  private activeParticleCount = 0;
  private isDimmed = false;

  constructor(
    scene: Phaser.Scene,
    fxContainer: Phaser.GameObjects.Container,
    seatGrid: SeatGrid,
  ) {
    this.scene = scene;
    this.fxContainer = fxContainer;
    this.seatGrid = seatGrid;
  }

  public getActiveParticles(): number {
    return this.activeParticleCount;
  }

  public tryAcquireParticles(n = 1): number {
    const available = Math.max(0, FXController.MAX_PARTICLES - this.activeParticleCount);
    const granted = Math.min(n, available);
    this.activeParticleCount += granted;
    return granted;
  }

  public releaseParticles(n = 1): void {
    this.activeParticleCount = Math.max(0, this.activeParticleCount - n);
  }

  public dimBackgroundFx(dim: boolean): void {
    this.isDimmed = dim;
    this.scene.tweens.add({
      targets: this.fxContainer,
      alpha: dim ? 0.5 : 1.0,
      duration: 300,
    });
  }

  private getSpeedScale(): number {
    return this.isDimmed ? 2.0 : 1.0; // Khi dim: giảm 50% tốc độ -> thời gian dài gấp đôi
  }

  public playFirefly(userId: string, count = 1): void {
    const puppet = this.seatGrid.getPuppet(userId);
    const startX = puppet ? puppet.container.x : 540;
    const startY = puppet ? puppet.container.y - 20 : 1400;

    if (puppet) {
      puppet.showLabelFor60s();
    }

    const numParticles = this.tryAcquireParticles(Math.min(5, Math.max(1, count)));
    if (numParticles === 0) return;

    audioBus.playSfx('firefly_twinkle');

    for (let i = 0; i < numParticles; i++) {
      const ff = this.scene.add
        .image(
          startX + (Math.random() - 0.5) * 40,
          startY,
          'fx.firefly',
        )
        .setDisplaySize(32, 32);
      this.fxContainer.add(ff);

      this.scene.tweens.add({
        targets: ff,
        x: ff.x + (Math.random() - 0.5) * 80,
        y: startY - 120 - Math.random() * 100,
        alpha: 0,
        duration: 1200 * this.getSpeedScale(),
        ease: 'Cubic.Out',
        onComplete: () => {
          ff.destroy();
          this.releaseParticles(1);
        },
      });
    }

    // Chữ nổi "may mắn +1" (UI_SPEC §5.1: 28px 700 gold300, viền 5px ink900, bay lên 60px rồi mờ trong 1,2s)
    if (this.tryAcquireParticles(1) > 0) {
      const txt = this.scene.add
        .text(startX, startY - 36, STRINGS_VI.FLOATING_LUCK_PLUS_ONE, {
          fontFamily: THEME.fonts.sans,
          fontSize: '28px',
          fontStyle: '700',
          color: THEME.colors.gold300,
          stroke: THEME.colors.ink900,
          strokeThickness: 5,
        })
        .setOrigin(0.5, 0.5);
      this.fxContainer.add(txt);

      this.scene.tweens.add({
        targets: txt,
        y: startY - 96,
        alpha: 0,
        duration: 1200,
        ease: 'Cubic.Out',
        onComplete: () => {
          txt.destroy();
          this.releaseParticles(1);
        },
      });
    }
  }

  public playWave(userId: string, showBudShadow = true): void {
    const puppet = this.seatGrid.getPuppet(userId);
    if (puppet) {
      puppet.playWave();
    }

    if (showBudShadow && this.tryAcquireParticles(1) > 0) {
      // Bóng Bụt mờ trên ngọn đa trong 1,5s
      const shadow = this.scene.add
        .image(540, 740, 'char.bud.robe')
        .setDisplaySize(140, 210)
        .setTint(THEME.hex.gold300)
        .setAlpha(0);
      this.fxContainer.add(shadow);

      this.scene.tweens.add({
        targets: shadow,
        alpha: 0.32,
        duration: 500,
        yoyo: true,
        hold: 500,
        ease: 'Sine.InOut',
        onComplete: () => {
          shadow.destroy();
          this.releaseParticles(1);
        },
      });
    }
  }

  public playLeafWish(userId: string): void {
    const puppet = this.seatGrid.getPuppet(userId);
    if (puppet) {
      puppet.attachWishLeaf();
    }
  }

  /**
   * Lá ước rơi xuống ao + gợn nước trong 1,5s (dùng khi wishRejected = true; không chữ, không tên)
   */
  public async playLeafDropToPond(userId: string): Promise<void> {
    const puppet = this.seatGrid.getPuppet(userId);
    const origin = puppet?.detachWishLeaf() ?? { x: 240, y: 1100 };
    const pondX = 820;
    const pondY = 1220;

    const leaf = this.scene.add
      .image(origin.x, origin.y, 'fx.leaf_wish')
      .setDisplaySize(54, 54);
    this.fxContainer.add(leaf);

    await new Promise<void>((resolve) => {
      this.scene.tweens.add({
        targets: leaf,
        x: pondX,
        y: pondY,
        angle: 140,
        alpha: 0.2,
        duration: 1000,
        ease: 'Quad.In',
        onComplete: () => {
          leaf.destroy();
          audioBus.playSfx('water_bloop');
          // Gợn nước 500ms
          const ripple = this.scene.add.graphics();
          ripple.setPosition(pondX, pondY);
          ripple.lineStyle(3, THEME.hex.mist300, 0.8);
          ripple.strokeEllipse(0, 0, 40, 18);
          this.fxContainer.add(ripple);

          this.scene.tweens.add({
            targets: ripple,
            scaleX: 2.8,
            scaleY: 2.8,
            alpha: 0,
            duration: 500,
            ease: 'Cubic.Out',
            onComplete: () => {
              ripple.destroy();
              resolve();
            },
          });
        },
      });
    });
  }

  public playFish(userId: string): void {
    if (this.tryAcquireParticles(1) === 0) return;
    const puppet = this.seatGrid.getPuppet(userId);
    if (puppet) puppet.showLabelFor60s();

    audioBus.playSfx('water_bloop');
    const pondX = 800 + (Math.random() - 0.5) * 120;
    const pondY = 1210;

    const fish = this.scene.add.graphics();
    fish.fillStyle(THEME.hex.gold500, 0.95);
    fish.fillEllipse(0, 0, 36, 16);
    fish.setPosition(pondX, pondY);
    this.fxContainer.add(fish);

    this.scene.tweens.add({
      targets: fish,
      y: pondY - 70,
      angle: -30,
      duration: 450 * this.getSpeedScale(),
      yoyo: true,
      ease: 'Quad.Out',
      onComplete: () => {
        fish.destroy();
        this.releaseParticles(1);
      },
    });
  }

  public playSparrow(userId: string): void {
    if (this.tryAcquireParticles(1) === 0) return;
    const puppet = this.seatGrid.getPuppet(userId);
    const targetX = puppet ? puppet.container.x + 28 : 540;
    const targetY = puppet ? puppet.container.y - 10 : 1350;
    if (puppet) puppet.showLabelFor60s();

    audioBus.playSfx('sparrow');
    const bird = this.scene.add
      .image(-60, 720, 'fx.sparrow_pair')
      .setDisplaySize(56, 38);
    this.fxContainer.add(bird);

    this.scene.tweens.add({
      targets: bird,
      x: targetX,
      y: targetY,
      duration: 900 * this.getSpeedScale(),
      ease: 'Cubic.Out',
      onComplete: () => {
        setTimeout(() => {
          if (!bird.scene) {
            this.releaseParticles(1);
            return;
          }
          this.scene.tweens.add({
            targets: bird,
            x: 1140,
            y: 650,
            alpha: 0,
            duration: 800,
            onComplete: () => {
              bird.destroy();
              this.releaseParticles(1);
            },
          });
        }, 1800);
      },
    });
  }
}

