import Phaser from 'phaser';
import type { Settings, Visit } from '@but-oi/shared';
import { THEME } from '../theme.js';
import { NameBanner } from './NameBanner.js';
import { QueueChipView } from './QueueChip.js';
import { HowToCard } from './HowToCard.js';
import { SubtitleView } from './Subtitle.js';
import { DisclaimerBar } from './Disclaimer.js';
import { VillagerCounterAndWebcam } from './Counter.js';

/**
 * Tạo khung trang trí cổ phong theo đúng UI_SPEC.md §5.2:
 * - Nền panelBg, bo góc 10px
 * - Viền ngoài 1.5px gold500 (70%), viền trong 1px gold300 (25%, cách vào 6px)
 * - Dựng bằng NineSlice từ ui.panel_9slice (96x96, cắt 24px) + 4 góc vân mây (ui.ornament_corner 48x48 xoay 0/90/180/270 độ)
 */
export function createOrnamentPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);

  // Đổ bóng mềm
  const shadow = scene.add.graphics();
  shadow.fillStyle(0x000000, 0.45);
  shadow.fillRoundedRect(0, 10, w, h, 10);
  container.add(shadow);

  if (scene.textures.exists('ui.panel_9slice')) {
    const nine = scene.add
      .nineslice(0, 0, 'ui.panel_9slice', undefined, w, h, 24, 24, 24, 24)
      .setOrigin(0, 0);
    container.add(nine);
  } else {
    const bg = scene.add.graphics();
    bg.fillStyle(THEME.hex.ink900, 0.8);
    bg.fillRoundedRect(0, 0, w, h, 10);
    bg.lineStyle(1.5, THEME.hex.gold500, 0.7);
    bg.strokeRoundedRect(0, 0, w, h, 10);
    bg.lineStyle(1, THEME.hex.gold300, 0.25);
    bg.strokeRoundedRect(6, 6, w - 12, h - 12, 6);
    container.add(bg);
  }

  // 4 góc gắn họa tiết vân mây 48x48 xoay 0/90/180/270 độ
  if (scene.textures.exists('ui.ornament_corner')) {
    const corners: Array<{ cx: number; cy: number; angle: number }> = [
      { cx: 24, cy: 24, angle: 0 },
      { cx: w - 24, cy: 24, angle: 90 },
      { cx: w - 24, cy: h - 24, angle: 180 },
      { cx: 24, cy: h - 24, angle: 270 },
    ];
    for (const c of corners) {
      const sp = scene.add
        .image(c.cx, c.cy, 'ui.ornament_corner')
        .setDisplaySize(32, 32)
        .setAngle(c.angle)
        .setAlpha(0.75);
      container.add(sp);
    }
  }

  return container;
}

export class HudController {
  public readonly container: Phaser.GameObjects.Container;
  public readonly banner: NameBanner;
  public readonly disclaimer: DisclaimerBar;
  public readonly howTo: HowToCard;
  public readonly subtitle: SubtitleView;
  public readonly queueChip: QueueChipView;
  public readonly counter: VillagerCounterAndWebcam;

  constructor(scene: Phaser.Scene, parentContainer: Phaser.GameObjects.Container) {
    this.container = parentContainer;
    const factory = (x: number, y: number, w: number, h: number) =>
      createOrnamentPanel(scene, x, y, w, h);

    this.banner = new NameBanner(scene, factory);
    this.disclaimer = new DisclaimerBar(scene);
    this.howTo = new HowToCard(scene, factory);
    this.subtitle = new SubtitleView(scene, factory);
    this.queueChip = new QueueChipView(scene, factory);
    this.counter = new VillagerCounterAndWebcam(scene, factory);

    this.container.add([
      this.banner.container,
      this.disclaimer.container,
      this.howTo.container,
      this.subtitle.container,
      this.queueChip.container,
      this.counter.container,
    ]);
  }

  public enterVisitState(visit: Visit): void {
    const isGrand = visit.tier === 'grand';
    this.banner.showVisit(visit);
    this.howTo.container.setVisible(false);
    this.queueChip.setBudSpeaking(true);
    // Đại phép: ẩn mọi HUD trừ băng rôn tên, chú thích và phụ đề (UI_SPEC §4.2)
    this.queueChip.setHiddenForGrand(isGrand);
    this.counter.setHiddenForGrand(isGrand);
  }

  public enterIdleState(): void {
    this.subtitle.stop();
    this.banner.showIdle();
    this.howTo.container.setVisible(true);
    this.queueChip.setBudSpeaking(false);
    this.queueChip.setHiddenForGrand(false);
    this.counter.setHiddenForGrand(false);
  }

  public applySettings(settings: Settings): void {
    this.counter.setWebcamEnabled(Boolean(settings.webcamEnabled));
  }

  public update(now = Date.now()): void {
    this.banner.updateCountdown(now);
  }
}

