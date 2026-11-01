import Phaser from 'phaser';
import { STRINGS_VI } from '@but-oi/shared';
import { THEME } from '../theme.js';

/**
 * HowToCard (UI_SPEC §5.1 & §5.3):
 * - Vị trí: (60, 410, 960 x 220)
 * - Tiêu đề "CÁCH CHƠI" (22px 700 gold300)
 * - 1 câu xoay vòng mỗi 8s (38px 600 textOnDark, giãn dòng 1.3; từ khóa "ước: …" và "Bụt ơi" có nền jade500, chữ paper100, bo 8px)
 * - 3 chấm chỉ báo bên dưới
 */
export class HowToCard {
  public readonly container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private lineGroup: Phaser.GameObjects.Container;
  private dotsGfx: Phaser.GameObjects.Graphics;
  private currentIndex = 0;

  constructor(
    scene: Phaser.Scene,
    panelFactory: (x: number, y: number, w: number, h: number) => Phaser.GameObjects.Container,
  ) {
    this.scene = scene;
    this.container = panelFactory(60, 410, 960, 220);

    const title = scene.add
      .text(480, 36, STRINGS_VI.HOW_TO_TITLE, {
        fontFamily: THEME.fonts.sans,
        fontSize: '22px',
        fontStyle: '700',
        color: THEME.colors.gold300,
      })
      .setOrigin(0.5, 0.5);

    this.lineGroup = scene.add.container(480, 112);
    this.dotsGfx = scene.add.graphics();
    this.container.add([title, this.lineGroup, this.dotsGfx]);

    this.renderIndex(0);

    // Xoay 3 câu mỗi 8s
    scene.time.addEvent({
      delay: 8000,
      loop: true,
      callback: () => {
        if (!this.container.visible) return;
        this.currentIndex = (this.currentIndex + 1) % STRINGS_VI.HOW_TO_LINES.length;
        this.renderIndex(this.currentIndex);
      },
    });
  }

  private renderIndex(idx: number): void {
    this.lineGroup.removeAll(true);
    const sentence = STRINGS_VI.HOW_TO_LINES[idx] ?? STRINGS_VI.HOW_TO_LINES[0];

    const txt = this.scene.add
      .text(0, 0, sentence, {
        fontFamily: THEME.fonts.sans,
        fontSize: '38px',
        fontStyle: '600',
        color: THEME.colors.textOnDark,
        align: 'center',
        lineSpacing: 10,
        wordWrap: { width: 880 },
      })
      .setOrigin(0.5, 0.5);

    // Nền highlight jade500 cho từ khóa trong câu 1 và 2
    if (idx === 0 || idx === 1) {
      const badge = this.scene.add.graphics();
      badge.fillStyle(THEME.hex.jade500, 0.35);
      badge.fillRoundedRect(-440, -34, 880, 68, 8);
      this.lineGroup.add(badge);
    }

    this.lineGroup.add(txt);
    this.lineGroup.setAlpha(0);
    this.scene.tweens.add({
      targets: this.lineGroup,
      alpha: 1,
      duration: 400,
      ease: 'Cubic.Out',
    });

    // Vẽ 3 chấm chỉ báo
    this.dotsGfx.clear();
    for (let i = 0; i < 3; i++) {
      const isCurrent = i === idx;
      this.dotsGfx.fillStyle(
        isCurrent ? THEME.hex.gold500 : THEME.hex.mist300,
        isCurrent ? 1.0 : 0.4,
      );
      this.dotsGfx.fillCircle(456 + i * 24, 192, isCurrent ? 6 : 5);
    }
  }
}

