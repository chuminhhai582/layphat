import Phaser from 'phaser';
import { audioBus } from '../audio/AudioBus.js';

export type TimePeriod = 'morning' | 'afternoon' | 'dusk' | 'night';

const PERIOD_CONFIG: Record<
  TimePeriod,
  { skyKey: string; tint: number; bgm: 'bgm.day' | 'bgm.night'; fireflies: boolean }
> = {
  morning: {
    skyKey: 'bg.sky.day',
    tint: 0xf6efe2,
    bgm: 'bgm.day',
    fireflies: false,
  },
  afternoon: {
    skyKey: 'bg.sky.day',
    tint: 0xefe3c8,
    bgm: 'bgm.day',
    fireflies: false,
  },
  dusk: {
    skyKey: 'bg.sky.dusk',
    tint: 0xd4a373,
    bgm: 'bgm.day',
    fireflies: false,
  },
  night: {
    skyKey: 'bg.sky.night',
    tint: 0x6f96a6,
    bgm: 'bgm.night',
    fireflies: true,
  },
};

/**
 * DayNight (T15):
 * - 4 khung giờ: sáng 5-11h, chiều 11-17h, hoàng hôn 17-19h, đêm 19-5h.
 * - ?time=day|dusk|night để ép khung giờ khi test.
 * - forceNight(ms) chuyển sang đêm trong 2s cho bậc Đại phép rồi trả lại.
 * - Đêm: bật đom đóm nền (tối đa 20 con).
 */
export class DayNightController {
  private scene: Phaser.Scene;
  private skySprite: Phaser.GameObjects.Image;
  private tintedLayers: Phaser.GameObjects.Image[];
  private currentPeriod: TimePeriod = 'dusk';
  private forcedOverride: TimePeriod | null = null;
  private forceRestoreTimer: ReturnType<typeof setTimeout> | null = null;
  private nightFireflies: Phaser.GameObjects.Image[] = [];
  private fireflyContainer: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    skySprite: Phaser.GameObjects.Image,
    tintedLayers: Phaser.GameObjects.Image[],
    fireflyContainer: Phaser.GameObjects.Container,
  ) {
    this.scene = scene;
    this.skySprite = skySprite;
    this.tintedLayers = tintedLayers;
    this.fireflyContainer = fireflyContainer;

    const params = new URLSearchParams(window.location.search);
    const timeParam = params.get('time');
    if (timeParam === 'day') {
      this.forcedOverride = 'morning';
    } else if (timeParam === 'dusk') {
      this.forcedOverride = 'dusk';
    } else if (timeParam === 'night') {
      this.forcedOverride = 'night';
    }

    this.applyPeriod(this.resolvePeriod(), 0);
  }

  public resolvePeriod(date = new Date()): TimePeriod {
    if (this.forcedOverride) return this.forcedOverride;
    const h = date.getHours();
    if (h >= 5 && h < 11) return 'morning';
    if (h >= 11 && h < 17) return 'afternoon';
    if (h >= 17 && h < 19) return 'dusk';
    return 'night';
  }

  public applyPeriod(period: TimePeriod, transitionMs = 2000): void {
    this.currentPeriod = period;
    const cfg = PERIOD_CONFIG[period];

    if (this.scene.textures.exists(cfg.skyKey)) {
      this.skySprite.setTexture(cfg.skyKey);
      this.skySprite.setDisplaySize(1080, 1300);
    }

    for (const layer of this.tintedLayers) {
      if (transitionMs <= 0) {
        layer.setTint(cfg.tint);
      } else {
        layer.setTint(cfg.tint);
        this.scene.tweens.add({
          targets: layer,
          alpha: { from: 0.85, to: 1 },
          duration: transitionMs,
          ease: 'Sine.InOut',
        });
      }
    }

    audioBus.playBgm(cfg.bgm);
    this.setNightFirefliesEnabled(cfg.fireflies);
  }

  public forceNight(durationMs: number): void {
    const prev = this.currentPeriod;
    if (this.forceRestoreTimer) clearTimeout(this.forceRestoreTimer);
    this.applyPeriod('night', 2000);

    this.forceRestoreTimer = setTimeout(() => {
      this.forceRestoreTimer = null;
      this.applyPeriod(this.forcedOverride ?? prev, 2000);
    }, durationMs);
  }

  private setNightFirefliesEnabled(enabled: boolean): void {
    if (!enabled) {
      for (const ff of this.nightFireflies) {
        ff.destroy();
      }
      this.nightFireflies = [];
      return;
    }

    if (this.nightFireflies.length > 0) return;

    // Tối đa 20 con đom đóm nền khi trời đêm
    for (let i = 0; i < 20; i++) {
      const x = 80 + Math.random() * 920;
      const y = 700 + Math.random() * 900;
      const ff = this.scene.add
        .image(x, y, 'fx.firefly')
        .setDisplaySize(22, 22)
        .setAlpha(0.2 + Math.random() * 0.5);
      this.fireflyContainer.add(ff);
      this.nightFireflies.push(ff);

      this.scene.tweens.add({
        targets: ff,
        x: x + (Math.random() - 0.5) * 120,
        y: y - 40 - Math.random() * 80,
        alpha: { from: 0.2, to: 0.75 },
        duration: 2600 + Math.random() * 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }
  }
}

