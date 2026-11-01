import Phaser from 'phaser';
import { STRINGS_VI, type TierId, type Visit } from '@but-oi/shared';
import { THEME } from '../theme.js';

/**
 * NameBanner (UI_SPEC §5.1):
 * - Vị trí: (80, 236, 920 x 128)
 * - Trạng thái chờ: Logo "Làng Bụt Ơi" (Noto Serif 600, 56px, gold500) + Đồng hồ "Bụt ghé làng sau" (22px textMuted + 44px 700 textOnDark)
 * - Trạng thái lượt:
 *   - Trái: avatar tròn 92px viền vàng 3px (chữ cái đầu)
 *   - Giữa: nhãn "ÔNG BỤT ĐANG THĂM" (Be Vietnam Pro 700, 24px, gold300) + tên (Noto Serif 600, 60px, textOnDark, tối đa 16 ký tự, quá cắt "…")
 *   - Phải: con dấu bậc 150 x 56 ("Bụt hiện" / "Phép màu" / "Đại phép", nền teal600 / jade500 / vermilion600, chữ paper100)
 */
export class NameBanner {
  public readonly container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private idleGroup: Phaser.GameObjects.Container;
  private visitGroup: Phaser.GameObjects.Container;

  private countdownText: Phaser.GameObjects.Text;
  private avatarInitialText: Phaser.GameObjects.Text;
  private viewerNameText: Phaser.GameObjects.Text;
  private sealBg: Phaser.GameObjects.Graphics;
  private sealText: Phaser.GameObjects.Text;

  private nextGroupVisitAt = Date.now() + 240_000;

  constructor(
    scene: Phaser.Scene,
    panelFactory: (x: number, y: number, w: number, h: number) => Phaser.GameObjects.Container,
  ) {
    this.scene = scene;
    this.container = panelFactory(80, 236, 920, 128);

    // --- IDLE GROUP ---
    this.idleGroup = scene.add.container(0, 0);
    const logoCloud = scene.add
      .image(54, 64, 'ui.ornament_corner')
      .setDisplaySize(44, 44);
    const logoTitle = scene.add
      .text(92, 64, STRINGS_VI.IDLE_LOGO_TITLE, {
        fontFamily: THEME.fonts.serif,
        fontSize: '56px',
        fontStyle: '600',
        color: THEME.colors.gold500,
      })
      .setOrigin(0, 0.5);

    const countdownLabel = scene.add
      .text(884, 38, STRINGS_VI.GROUP_VISIT_COUNTDOWN_LABEL, {
        fontFamily: THEME.fonts.sans,
        fontSize: '22px',
        fontStyle: '500',
        color: THEME.colors.textMuted,
      })
      .setOrigin(1, 0.5);

    this.countdownText = scene.add
      .text(884, 82, '04:00', {
        fontFamily: THEME.fonts.sans,
        fontSize: '44px',
        fontStyle: '700',
        color: THEME.colors.textOnDark,
      })
      .setOrigin(1, 0.5);

    this.idleGroup.add([logoCloud, logoTitle, countdownLabel, this.countdownText]);

    // --- VISIT GROUP ---
    this.visitGroup = scene.add.container(0, 0);
    this.visitGroup.setVisible(false);

    const avatarCircle = scene.add.graphics();
    avatarCircle.fillStyle(THEME.hex.teal800, 1);
    avatarCircle.fillCircle(74, 64, 46);
    avatarCircle.lineStyle(3, THEME.hex.gold500, 1);
    avatarCircle.strokeCircle(74, 64, 46);

    this.avatarInitialText = scene.add
      .text(74, 64, 'B', {
        fontFamily: THEME.fonts.serif,
        fontSize: '42px',
        fontStyle: '600',
        color: THEME.colors.gold300,
      })
      .setOrigin(0.5, 0.5);

    const visitingLabel = scene.add
      .text(142, 34, STRINGS_VI.BANNER_VISITING_LABEL, {
        fontFamily: THEME.fonts.sans,
        fontSize: '24px',
        fontStyle: '700',
        color: THEME.colors.gold300,
      })
      .setOrigin(0, 0.5);

    this.viewerNameText = scene.add
      .text(142, 84, '', {
        fontFamily: THEME.fonts.serif,
        fontSize: '60px',
        fontStyle: '600',
        color: THEME.colors.textOnDark,
      })
      .setOrigin(0, 0.5);

    this.sealBg = scene.add.graphics();
    this.sealText = scene.add
      .text(815, 64, '', {
        fontFamily: THEME.fonts.sans,
        fontSize: '24px',
        fontStyle: '700',
        color: THEME.colors.paper100,
      })
      .setOrigin(0.5, 0.5);

    this.visitGroup.add([
      avatarCircle,
      this.avatarInitialText,
      visitingLabel,
      this.viewerNameText,
      this.sealBg,
      this.sealText,
    ]);

    this.container.add([this.idleGroup, this.visitGroup]);
  }

  public setNextGroupVisitAt(ts: number): void {
    this.nextGroupVisitAt = ts;
  }

  public updateCountdown(now = Date.now()): void {
    const remainSec = Math.max(0, Math.ceil((this.nextGroupVisitAt - now) / 1000));
    const mm = String(Math.floor(remainSec / 60)).padStart(2, '0');
    const ss = String(remainSec % 60).padStart(2, '0');
    this.countdownText.setText(`${mm}:${ss}`);
  }

  public showVisit(visit: Visit): void {
    const rawName = visit.viewer.displayName || STRINGS_VI.DEFAULT_VIEWER_PRONOUN;
    const chars = Array.from(rawName);
    const truncated =
      chars.length > 16 ? `${chars.slice(0, 15).join('')}…` : rawName;

    this.viewerNameText.setText(truncated);
    this.avatarInitialText.setText((chars[0] ?? 'B').toUpperCase());
    this.drawTierSeal(visit.tier);

    this.idleGroup.setVisible(false);
    this.visitGroup.setVisible(true);
    this.visitGroup.setAlpha(0);
    this.scene.tweens.add({
      targets: this.visitGroup,
      alpha: 1,
      duration: 400,
      ease: 'Cubic.Out',
    });
  }

  public showIdle(): void {
    this.visitGroup.setVisible(false);
    this.idleGroup.setVisible(true);
    this.idleGroup.setAlpha(0);
    this.scene.tweens.add({
      targets: this.idleGroup,
      alpha: 1,
      duration: 400,
      ease: 'Cubic.Out',
    });
  }

  private drawTierSeal(tier: TierId): void {
    const colorMap: Record<TierId, number> = {
      firefly: THEME.hex.teal600,
      visit: THEME.hex.teal600,
      miracle: THEME.hex.jade500,
      grand: THEME.hex.vermilion600,
    };

    this.sealBg.clear();
    this.sealBg.fillStyle(colorMap[tier], 1);
    // Con dấu bậc 150 x 56 bên phải trong băng rôn
    this.sealBg.fillRoundedRect(740, 36, 150, 56, 8);
    this.sealBg.lineStyle(1.5, THEME.hex.gold500, 0.85);
    this.sealBg.strokeRoundedRect(740, 36, 150, 56, 8);

    this.sealText.setText(STRINGS_VI.TIER_LABELS[tier]);
  }
}

