import Phaser from 'phaser';
import {
  STRINGS_VI,
  type MiracleId,
  type Settings,
  type WishCategory,
} from '@but-oi/shared';
import { THEME } from '../theme.js';
import { audioBus } from '../audio/AudioBus.js';
import { FXController } from './FX.js';

/**
 * MiraclesController (T19):
 * - 6 phép theo miracleByCategory:
 *   glowing_book (hoc_hanh), well_water (suc_khoe), golden_rice (cong_viec),
 *   lit_cottage (gia_dao), sparrow_pair (tinh_duyen), lotus_bloom (default)
 * - Huy hiệu "Đã ghi vào Sổ làng" (x760, y1000, 280x110) cho bậc miracle
 * - Đại phép (grand): trăng lớn (560, 860, Ø380 + quầng Ø600), mưa cánh hoa (<= 80 cánh)
 */
export class MiraclesController {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private fx: FXController;

  constructor(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    fx: FXController,
  ) {
    this.scene = scene;
    this.container = container;
    this.fx = fx;
  }

  public resolveMiracleId(category: WishCategory, settings?: Settings): MiracleId {
    const map = settings?.miracleByCategory;
    if (map && map[category]) {
      return map[category]!;
    }
    switch (category) {
      case 'hoc_hanh':
        return 'glowing_book';
      case 'suc_khoe':
        return 'well_water';
      case 'cong_viec':
        return 'golden_rice';
      case 'gia_dao':
        return 'lit_cottage';
      case 'tinh_duyen':
        return 'sparrow_pair';
      default:
        return 'lotus_bloom';
    }
  }

  public async playMiracle(
    miracleId: MiracleId,
    durationMs: number,
    showVillageBookBadge = true,
  ): Promise<void> {
    const objects: Phaser.GameObjects.GameObject[] = [];

    if (showVillageBookBadge) {
      const badge = this.createVillageBookBadge();
      objects.push(badge);
    }

    switch (miracleId) {
      case 'glowing_book': {
        audioBus.playSfx('page_glow');
        // Cuốn sách bay ra từ tay áo Bụt tới tâm (240, 900)
        const book = this.scene.add
          .image(460, 820, 'fx.book_glow')
          .setDisplaySize(180, 140)
          .setAlpha(0);
        this.container.add(book);
        objects.push(book);

        this.scene.tweens.add({
          targets: book,
          x: 240,
          y: 900,
          alpha: 1,
          scaleX: 1.15,
          scaleY: 1.15,
          duration: 800,
          ease: 'Cubic.Out',
        });
        break;
      }

      case 'well_water': {
        audioBus.playSfx('water_bloop');
        const water = this.scene.add
          .image(190, 1080, 'fx.well_water')
          .setDisplaySize(200, 200)
          .setAlpha(0);
        this.container.add(water);
        objects.push(water);

        this.scene.tweens.add({
          targets: water,
          x: 240,
          y: 900,
          alpha: 1,
          duration: 900,
          ease: 'Sine.Out',
        });
        break;
      }

      case 'golden_rice': {
        audioBus.playSfx('wind_gust');
        const rice = this.scene.add
          .image(540, 1080, 'fx.rice_wave')
          .setDisplaySize(960, 220)
          .setAlpha(0);
        this.container.add(rice);
        objects.push(rice);

        this.scene.tweens.add({
          targets: rice,
          alpha: 0.9,
          x: { from: 520, to: 560 },
          duration: 1200,
          yoyo: true,
          repeat: Math.floor(durationMs / 2400),
          ease: 'Sine.InOut',
        });
        break;
      }

      case 'lit_cottage': {
        audioBus.playSfx('chime_soft');
        const cottage = this.scene.add
          .image(240, 900, 'fx.cottage')
          .setDisplaySize(280, 210)
          .setAlpha(0);
        this.container.add(cottage);
        objects.push(cottage);

        this.scene.tweens.add({
          targets: cottage,
          alpha: 1,
          duration: 700,
          ease: 'Cubic.Out',
        });
        break;
      }

      case 'sparrow_pair': {
        audioBus.playSfx('sparrow');
        const pair = this.scene.add
          .image(-80, 720, 'fx.sparrow_pair')
          .setDisplaySize(160, 110);
        this.container.add(pair);
        objects.push(pair);

        this.scene.tweens.add({
          targets: pair,
          x: 340,
          y: 780,
          duration: 1000,
          ease: 'Cubic.Out',
        });
        break;
      }

      case 'lotus_bloom':
      default: {
        audioBus.playSfx('water_bloop');
        for (let i = 0; i < 4; i++) {
          const lotus = this.scene.add
            .image(700 + i * 75, 1210 + (i % 2) * 28, 'fx.lotus_bloom')
            .setDisplaySize(96, 96)
            .setScale(0.2)
            .setAlpha(0);
          this.container.add(lotus);
          objects.push(lotus);

          this.scene.tweens.add({
            targets: lotus,
            scaleX: 1,
            scaleY: 1,
            alpha: 1,
            delay: i * 180,
            duration: 650,
            ease: 'Back.Out',
          });
        }
        break;
      }
    }

    await new Promise((r) => setTimeout(r, durationMs));

    for (const obj of objects) {
      this.scene.tweens.add({
        targets: obj,
        alpha: 0,
        duration: 300,
        onComplete: () => obj.destroy(),
      });
    }
  }

  /**
   * Huy hiệu "Đã ghi vào Sổ làng" (UI_SPEC §4.2: x760, y1000, 280x110)
   */
  public createVillageBookBadge(): Phaser.GameObjects.Container {
    const c = this.scene.add.container(760, 1000);
    const bg = this.scene.add.graphics();
    bg.fillStyle(THEME.hex.ink900, 0.88);
    bg.fillRoundedRect(0, 0, 280, 110, 10);
    bg.lineStyle(2, THEME.hex.gold500, 0.9);
    bg.strokeRoundedRect(0, 0, 280, 110, 10);

    const txt = this.scene.add
      .text(140, 55, STRINGS_VI.VILLAGE_BOOK_BADGE, {
        fontFamily: THEME.fonts.sans,
        fontSize: '26px',
        fontStyle: '700',
        color: THEME.colors.gold300,
        align: 'center',
        wordWrap: { width: 240 },
      })
      .setOrigin(0.5, 0.5);

    c.add([bg, txt]);
    c.setAlpha(0);
    this.container.add(c);

    this.scene.tweens.add({
      targets: c,
      alpha: 1,
      duration: 450,
      ease: 'Cubic.Out',
    });

    return c;
  }

  /**
   * Đại phép (grand):
   * - Trăng lớn tâm (560, 860), Ø380 + quầng Ø600
   * - Mưa cánh hoa (<= 80 cánh)
   */
  public spawnGrandMoonAndPetals(durationMs: number): () => void {
    // Quầng Ø600 + Trăng Ø380 tại (560, 860)
    const moonGroup = this.scene.add.container(560, 860);
    const halo = this.scene.add.graphics();
    halo.fillStyle(THEME.hex.gold300, 0.16);
    halo.fillCircle(0, 0, 300);

    const moon = this.scene.add.image(0, 0, 'fx.moon').setDisplaySize(380, 380);
    moonGroup.add([halo, moon]);
    moonGroup.setAlpha(0);
    this.container.add(moonGroup);

    this.scene.tweens.add({
      targets: moonGroup,
      alpha: 1,
      duration: 1500,
      ease: 'Sine.InOut',
    });

    // Mưa cánh hoa tối đa 80 cánh, tuân thủ hạn mức hạt toàn cục
    const requestedPetals = Math.min(80, this.fx.tryAcquireParticles(80));
    const petals: Phaser.GameObjects.Image[] = [];

    for (let i = 0; i < requestedPetals; i++) {
      const pIdx = (i % 4) + 1;
      const startX = Math.random() * 1080;
      const startY = -50 - Math.random() * 600;
      const petal = this.scene.add
        .image(startX, startY, `fx.petal.${pIdx}`)
        .setDisplaySize(28, 22)
        .setAlpha(0.85);
      this.container.add(petal);
      petals.push(petal);

      this.scene.tweens.add({
        targets: petal,
        x: startX + (Math.random() - 0.5) * 260,
        y: 1950,
        angle: 360,
        duration: 4500 + Math.random() * 3500,
        repeat: -1,
        delay: Math.random() * 2000,
      });
    }

    const cleanup = () => {
      for (const p of petals) {
        p.destroy();
      }
      this.fx.releaseParticles(requestedPetals);
      this.scene.tweens.add({
        targets: moonGroup,
        alpha: 0,
        duration: 800,
        onComplete: () => moonGroup.destroy(),
      });
    };

    const autoCleanTimer = setTimeout(cleanup, durationMs + 2000);
    return () => {
      clearTimeout(autoCleanTimer);
      cleanup();
    };
  }
}

