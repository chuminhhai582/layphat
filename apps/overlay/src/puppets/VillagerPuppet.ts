import Phaser from 'phaser';
import type { Viewer } from '@but-oi/shared';
import { THEME } from '../theme.js';

/**
 * VillagerPuppet theo UI_SPEC.md §7.3:
 * - Lớp: body_{1..6}, head_{1..3}, hat_{non|khan|none}, arm_l, arm_r chọn theo avatarSeed.
 * - Animation: sit_idle (nhún 1px, 3s), wave (tay xoay 0 -> -35° lặp 3 lần), walk_to(x,y) (nhảy nhẹ theo đường cong 1,2s), cheer.
 */
export class VillagerPuppet {
  public readonly container: Phaser.GameObjects.Container;
  public readonly viewer: Viewer;
  public seatX: number;
  public seatY: number;

  private scene: Phaser.Scene;
  private bodySprite: Phaser.GameObjects.Image;
  private headSprite: Phaser.GameObjects.Image;
  private hatSprite: Phaser.GameObjects.Image;
  private armLSprite: Phaser.GameObjects.Image;
  private armRSprite: Phaser.GameObjects.Image;
  private nameLabel: Phaser.GameObjects.Text;
  private wishLeaf: Phaser.GameObjects.Image | null = null;
  private labelExpireTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, viewer: Viewer, seatX: number, seatY: number) {
    this.scene = scene;
    this.viewer = viewer;
    this.seatX = seatX;
    this.seatY = seatY;

    this.container = scene.add.container(seatX, seatY);

    const seed = Math.abs(viewer.avatarSeed || 1);
    const bodyIdx = (seed % 6) + 1;
    const headIdx = (seed % 3) + 1;
    const hats = ['hat_non', 'hat_khan', 'hat_none'] as const;
    const hatKey = hats[seed % 3]!;

    this.armLSprite = scene.add.image(-22, 36, 'char.villager.arm_l').setOrigin(0.5, 0.15);
    this.bodySprite = scene.add
      .image(0, 56, `char.villager.body_${bodyIdx}`)
      .setOrigin(0.5, 0.5);
    this.armRSprite = scene.add.image(22, 36, 'char.villager.arm_r').setOrigin(0.5, 0.15);
    this.headSprite = scene.add
      .image(0, 18, `char.villager.head_${headIdx}`)
      .setOrigin(0.5, 0.5);
    this.hatSprite = scene.add.image(0, 4, `char.villager.${hatKey}`).setOrigin(0.5, 0.5);

    // Nhãn tên theo UI_SPEC §5.1: tên rút gọn 12 ký tự, Be Vietnam Pro 600, 26px, textOnDark, viền 5px ink900
    const shortName = this.truncateName(viewer.displayName, 12);
    this.nameLabel = scene.add
      .text(0, -24, shortName, {
        fontFamily: THEME.fonts.sans,
        fontSize: '26px',
        fontStyle: '600',
        color: THEME.colors.textOnDark,
        stroke: THEME.colors.ink900,
        strokeThickness: 5,
      })
      .setOrigin(0.5, 1);

    this.container.add([
      this.armLSprite,
      this.bodySprite,
      this.armRSprite,
      this.headSprite,
      this.hatSprite,
      this.nameLabel,
    ]);

    this.showLabelFor60s();
    this.playSitIdle();
  }

  private truncateName(name: string, maxLen: number): string {
    const chars = Array.from(name.trim());
    if (chars.length <= maxLen) return name.trim();
    return `${chars.slice(0, maxLen - 1).join('')}…`;
  }

  public showLabelFor60s(): void {
    this.nameLabel.setVisible(true);
    this.nameLabel.setAlpha(1);
    if (this.labelExpireTimer) clearTimeout(this.labelExpireTimer);
    this.labelExpireTimer = setTimeout(() => {
      if (!this.nameLabel.scene) return;
      this.scene.tweens.add({
        targets: this.nameLabel,
        alpha: 0,
        duration: 350,
        onComplete: () => this.nameLabel.setVisible(false),
      });
    }, 60_000);
  }

  public playSitIdle(): void {
    if (this.idleTween) this.idleTween.stop();
    this.idleTween = this.scene.tweens.add({
      targets: [this.bodySprite, this.headSprite, this.hatSprite],
      y: '+=1',
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  public playWave(): void {
    this.showLabelFor60s();
    this.scene.tweens.add({
      targets: this.armRSprite,
      angle: { from: 0, to: -35 },
      duration: 220,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.InOut',
      onComplete: () => {
        this.armRSprite.setAngle(0);
      },
    });
  }

  public playCheer(): void {
    this.showLabelFor60s();
    this.scene.tweens.add({
      targets: [this.armLSprite, this.armRSprite],
      angle: { from: 0, to: -45 },
      duration: 250,
      yoyo: true,
      repeat: 3,
      ease: 'Quad.Out',
    });
  }

  public async walkTo(targetX: number, targetY: number, scale = 1, durationMs = 1200): Promise<void> {
    this.showLabelFor60s();
    const startX = this.container.x;
    const startY = this.container.y;

    await new Promise<void>((resolve) => {
      const state = { t: 0 };
      this.scene.tweens.add({
        targets: state,
        t: 1,
        duration: durationMs,
        ease: 'Sine.InOut',
        onUpdate: () => {
          const curX = Phaser.Math.Linear(startX, targetX, state.t);
          // Nhảy nhẹ theo đường cong
          const hop = Math.abs(Math.sin(state.t * Math.PI * 4)) * -14;
          const curY = Phaser.Math.Linear(startY, targetY, state.t) + hop;
          this.container.setPosition(curX, curY);
        },
        onComplete: () => {
          this.container.setPosition(targetX, targetY);
          resolve();
        },
      });

      this.scene.tweens.add({
        targets: this.container,
        scaleX: scale,
        scaleY: scale,
        duration: durationMs,
        ease: 'Cubic.Out',
      });
    });
  }

  public attachWishLeaf(): void {
    this.showLabelFor60s();
    if (this.wishLeaf) return;
    this.wishLeaf = this.scene.add
      .image(0, -52, 'fx.leaf_wish')
      .setDisplaySize(44, 44)
      .setOrigin(0.5, 0.9);
    this.container.add(this.wishLeaf);

    this.scene.tweens.add({
      targets: this.wishLeaf,
      angle: { from: -8, to: 8 },
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  public detachWishLeaf(): { x: number; y: number } | null {
    if (!this.wishLeaf) return null;
    const worldX = this.container.x;
    const worldY = this.container.y - 52 * this.container.scaleY;
    this.wishLeaf.destroy();
    this.wishLeaf = null;
    return { x: worldX, y: worldY };
  }

  public destroy(): void {
    if (this.labelExpireTimer) clearTimeout(this.labelExpireTimer);
    if (this.idleTween) this.idleTween.stop();
    this.container.destroy(true);
  }
}

