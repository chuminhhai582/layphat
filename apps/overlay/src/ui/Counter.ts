import Phaser from 'phaser';
import { STRINGS_VI, formatViString } from '@but-oi/shared';
import { THEME } from '../theme.js';

/**
 * Counter & Khung webcam (UI_SPEC §5.1):
 * - Bộ đếm dân làng (790, 1584, 260 x 52): "+{n} dân làng" (26px 600 textOnDark trên panelBg) khi > 36 người.
 * - Khung webcam: tâm (910, 1410), Ø 260, tùy chọn trong admin.
 */
export class VillagerCounterAndWebcam {
  public readonly container: Phaser.GameObjects.Container;
  private counterGroup: Phaser.GameObjects.Container;
  private counterText: Phaser.GameObjects.Text;
  private webcamGroup: Phaser.GameObjects.Container;
  private totalJoined = 0;
  private isHiddenForGrand = false;

  constructor(
    scene: Phaser.Scene,
    panelFactory: (x: number, y: number, w: number, h: number) => Phaser.GameObjects.Container,
  ) {
    this.container = scene.add.container(0, 0);

    // Bộ đếm dân làng (790, 1584, 260 x 52)
    this.counterGroup = panelFactory(790, 1584, 260, 52);
    this.counterText = scene.add
      .text(130, 26, '', {
        fontFamily: THEME.fonts.sans,
        fontSize: '26px',
        fontStyle: '600',
        color: THEME.colors.textOnDark,
      })
      .setOrigin(0.5, 0.5);
    this.counterGroup.add(this.counterText);
    this.counterGroup.setVisible(false);

    // Khung webcam tâm (910, 1410), Ø 260
    this.webcamGroup = scene.add.container(910, 1410);
    const ring = scene.add.graphics();
    ring.lineStyle(4, THEME.hex.gold500, 0.9);
    ring.strokeCircle(0, 0, 130);
    ring.lineStyle(1.5, THEME.hex.gold300, 0.45);
    ring.strokeCircle(0, 0, 122);
    this.webcamGroup.add(ring);
    this.webcamGroup.setVisible(false);

    this.container.add([this.counterGroup, this.webcamGroup]);
  }

  public setTotalJoined(total: number): void {
    this.totalJoined = total;
    this.refreshCounter();
  }

  public setWebcamEnabled(enabled: boolean): void {
    this.webcamGroup.setVisible(enabled && !this.isHiddenForGrand);
  }

  public setHiddenForGrand(hidden: boolean): void {
    this.isHiddenForGrand = hidden;
    this.refreshCounter();
  }

  private refreshCounter(): void {
    if (this.isHiddenForGrand || this.totalJoined <= 36) {
      this.counterGroup.setVisible(false);
      return;
    }
    this.counterGroup.setVisible(true);
    this.counterText.setText(
      formatViString(STRINGS_VI.VILLAGER_COUNTER_SHORT, {
        n: this.totalJoined,
      }),
    );
  }
}

