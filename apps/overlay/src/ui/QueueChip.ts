import Phaser from 'phaser';
import { STRINGS_VI, formatViString, type Visit } from '@but-oi/shared';
import { THEME } from '../theme.js';

/**
 * QueueChip & Thẻ hàng chờ (UI_SPEC §5.1):
 * - Chip hàng chờ (790, 660, 260 x 64): 3 avatar chồng nhau + "+{n} đang chờ" (26px 700 textOnDark) khi có hàng chờ và Bụt đang nói.
 * - Thẻ hàng chờ (790, 660, 260 x 260): "Bụt sắp ghé thăm" (22px gold300) + tối đa 5 tên (28px textOnDark) giữa hai lượt.
 */
export class QueueChipView {
  public readonly container: Phaser.GameObjects.Container;
  private chipPanel: Phaser.GameObjects.Container;
  private cardPanel: Phaser.GameObjects.Container;
  private chipText: Phaser.GameObjects.Text;
  private nameTexts: Phaser.GameObjects.Text[] = [];

  private queueItems: Visit[] = [];
  private isBudSpeaking = false;
  private isPaused = false;
  private isHiddenForGrand = false;

  constructor(
    scene: Phaser.Scene,
    panelFactory: (x: number, y: number, w: number, h: number) => Phaser.GameObjects.Container,
  ) {
    this.container = scene.add.container(0, 0);

    // Chip thu gọn (790, 660, 260 x 64)
    this.chipPanel = panelFactory(790, 660, 260, 64);
    const avatarsGfx = scene.add.graphics();
    for (let i = 0; i < 3; i++) {
      avatarsGfx.fillStyle(THEME.hex.teal600, 1);
      avatarsGfx.fillCircle(32 + i * 18, 32, 14);
      avatarsGfx.lineStyle(1.5, THEME.hex.gold500, 1);
      avatarsGfx.strokeCircle(32 + i * 18, 32, 14);
    }
    this.chipText = scene.add
      .text(92, 32, '', {
        fontFamily: THEME.fonts.sans,
        fontSize: '26px',
        fontStyle: '700',
        color: THEME.colors.textOnDark,
      })
      .setOrigin(0, 0.5);
    this.chipPanel.add([avatarsGfx, this.chipText]);

    // Thẻ mở rộng (790, 660, 260 x 260)
    this.cardPanel = panelFactory(790, 660, 260, 260);
    const cardTitle = scene.add
      .text(20, 26, STRINGS_VI.QUEUE_CARD_TITLE, {
        fontFamily: THEME.fonts.sans,
        fontSize: '22px',
        fontStyle: '700',
        color: THEME.colors.gold300,
      })
      .setOrigin(0, 0.5);
    this.cardPanel.add(cardTitle);

    for (let i = 0; i < 5; i++) {
      const nt = scene.add
        .text(20, 68 + i * 38, '', {
          fontFamily: THEME.fonts.sans,
          fontSize: '28px',
          fontStyle: '500',
          color: THEME.colors.textOnDark,
        })
        .setOrigin(0, 0.5);
      this.nameTexts.push(nt);
      this.cardPanel.add(nt);
    }

    this.container.add([this.chipPanel, this.cardPanel]);
    this.refresh();
  }

  public updateQueue(items: Visit[]): void {
    this.queueItems = items.slice(0, 5);
    this.refresh();
  }

  public setBudSpeaking(speaking: boolean): void {
    this.isBudSpeaking = speaking;
    this.refresh();
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    this.refresh();
  }

  public setHiddenForGrand(hidden: boolean): void {
    this.isHiddenForGrand = hidden;
    this.refresh();
  }

  private refresh(): void {
    if (this.isPaused || this.isHiddenForGrand || this.queueItems.length === 0) {
      this.chipPanel.setVisible(false);
      this.cardPanel.setVisible(false);
      return;
    }

    if (this.isBudSpeaking) {
      this.cardPanel.setVisible(false);
      this.chipPanel.setVisible(true);
      this.chipText.setText(
        formatViString(STRINGS_VI.QUEUE_CHIP_WAITING, {
          n: this.queueItems.length,
        }),
      );
    } else {
      this.chipPanel.setVisible(false);
      this.cardPanel.setVisible(true);
      for (let i = 0; i < 5; i++) {
        const item = this.queueItems[i];
        const nt = this.nameTexts[i]!;
        if (item) {
          const chars = Array.from(item.viewer.displayName);
          const short =
            chars.length > 12 ? `${chars.slice(0, 11).join('')}…` : item.viewer.displayName;
          nt.setText(`${i + 1}. ${short}`);
          nt.setVisible(true);
        } else {
          nt.setVisible(false);
        }
      }
    }
  }
}

