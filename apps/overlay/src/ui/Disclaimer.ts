import Phaser from 'phaser';
import { STRINGS_VI } from '@but-oi/shared';
import { THEME } from '../theme.js';

/**
 * Disclaimer & Dòng báo tạm dừng (UI_SPEC §4.2 & §5.1):
 * - Chú thích: căn giữa, y 372, cao 32, "Trò chơi giải trí lấy cảm hứng từ truyện cổ tích",
 *   Be Vietnam Pro 500, 22px, textMuted, nền panelBg bo 16. Luôn hiện!
 * - Khi tạm dừng (state:pause): hiện thêm dòng nhỏ "Bụt đang nghỉ chân một lát" dưới vùng ②.
 */
export class DisclaimerBar {
  public readonly container: Phaser.GameObjects.Container;
  private pauseBadge: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.container = scene.add.container(540, 372);

    const bg = scene.add.graphics();
    bg.fillStyle(THEME.hex.ink900, 0.8);
    bg.fillRoundedRect(-290, 0, 580, 32, 16);

    const text = scene.add
      .text(0, 16, STRINGS_VI.DISCLAIMER_TEXT, {
        fontFamily: THEME.fonts.sans,
        fontSize: '22px',
        fontStyle: '500',
        color: THEME.colors.textMuted,
      })
      .setOrigin(0.5, 0.5);

    this.pauseBadge = scene.add.container(0, 38);
    const pauseBg = scene.add.graphics();
    pauseBg.fillStyle(THEME.hex.ink900, 0.88);
    pauseBg.fillRoundedRect(-190, 0, 380, 32, 16);
    pauseBg.lineStyle(1, THEME.hex.gold500, 0.7);
    pauseBg.strokeRoundedRect(-190, 0, 380, 32, 16);

    const pauseTxt = scene.add
      .text(0, 16, STRINGS_VI.PAUSE_NOTICE, {
        fontFamily: THEME.fonts.sans,
        fontSize: '22px',
        fontStyle: '600',
        color: THEME.colors.gold300,
      })
      .setOrigin(0.5, 0.5);
    this.pauseBadge.add([pauseBg, pauseTxt]);
    this.pauseBadge.setVisible(false);

    this.container.add([bg, text, this.pauseBadge]);
  }

  public setPaused(paused: boolean): void {
    this.pauseBadge.setVisible(paused);
  }
}

