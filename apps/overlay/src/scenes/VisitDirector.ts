import Phaser from 'phaser';
import type {
  FireflyBurstPayload,
  GroupVisitPayload,
  Settings,
  Visit,
} from '@but-oi/shared';
import { BudPuppet } from '../puppets/BudPuppet.js';
import { SeatGrid } from './SeatGrid.js';
import { FXController } from './FX.js';
import { MiraclesController } from './Miracles.js';
import { DayNightController } from './DayNight.js';
import { HudController } from '../ui/Hud.js';
import { audioBus } from '../audio/AudioBus.js';

export type Phase =
  | 'IDLE'
  | 'SUMMON'
  | 'APPEAR'
  | 'ASK'
  | 'SPEAK'
  | 'MIRACLE'
  | 'LEAVE';

export const PLAN = {
  visit: {
    SUMMON: 2000,
    APPEAR: 2000,
    ASK: 2000,
    SPEAK: 'audio' as const,
    MIRACLE: 2000,
    LEAVE: 2000,
  },
  miracle: {
    SUMMON: 2500,
    APPEAR: 2000,
    ASK: 2000,
    SPEAK: 'audio' as const,
    MIRACLE: 6000,
    LEAVE: 2500,
  },
  grand: {
    SUMMON: 5000,
    APPEAR: 3000,
    ASK: 2000,
    SPEAK: 'audio' as const,
    MIRACLE: 15000,
    LEAVE: 5000,
  },
} as const;

export function totalOf(v: Visit): number {
  const tierKey = v.tier === 'firefly' ? 'visit' : v.tier;
  const plan = PLAN[tierKey];
  const speakMs = v.blessing?.durationMs ?? 5000;
  return (
    plan.SUMMON +
    plan.APPEAR +
    plan.ASK +
    speakMs +
    plan.MIRACLE +
    plan.LEAVE
  );
}

/**
 * VisitDirector (T18):
 * - Máy trạng thái 7 pha theo đúng IMPLEMENTATION_PLAN.md mục 6.5.
 * - Nhận visit:start, gửi visit:done; watchdog tự hủy sau tổng thời lượng + 10s.
 * - SUMMON: tiếng gió 0,3s trước, dim 25%, mây kéo đến, dân làng được chọn walk_to (210, 1180) và phóng to 1,8x.
 * - APPEAR: Bụt appear tại neo (540, 1230).
 * - wishRejected -> lá rơi xuống ao trước ASK.
 * - LEAVE: Bụt leave, dân làng về chỗ, bỏ dim.
 */
export class VisitDirector {
  public currentPhase: Phase = 'IDLE';

  private scene: Phaser.Scene;
  private bud: BudPuppet;
  private seatGrid: SeatGrid;
  private fx: FXController;
  private miracles: MiraclesController;
  private dayNight: DayNightController;
  private hud: HudController;
  private setDimFn: (value: number, ms: number) => void;
  private onVisitDoneFn: (visitId: string) => void;
  private getSettingsFn: () => Settings | undefined;

  private guardTimer: ReturnType<typeof setTimeout> | null = null;
  private aborted = false;
  private activeGrandCleanup: (() => void) | null = null;

  constructor(opts: {
    scene: Phaser.Scene;
    bud: BudPuppet;
    seatGrid: SeatGrid;
    fx: FXController;
    miracles: MiraclesController;
    dayNight: DayNightController;
    hud: HudController;
    setDim: (value: number, ms: number) => void;
    onVisitDone: (visitId: string) => void;
    getSettings: () => Settings | undefined;
  }) {
    this.scene = opts.scene;
    this.bud = opts.bud;
    this.seatGrid = opts.seatGrid;
    this.fx = opts.fx;
    this.miracles = opts.miracles;
    this.dayNight = opts.dayNight;
    this.hud = opts.hud;
    this.setDimFn = opts.setDim;
    this.onVisitDoneFn = opts.onVisitDone;
    this.getSettingsFn = opts.getSettings;
  }

  public async run(v: Visit): Promise<void> {
    if (this.currentPhase !== 'IDLE') {
      this.abort();
    }
    this.aborted = false;
    const totalMs = totalOf(v);

    this.guardTimer = setTimeout(() => {
      console.warn(`[VisitDirector] Watchdog timeout cho lượt ${v.id}`);
      this.abort();
      this.onVisitDoneFn(v.id);
    }, totalMs + 10_000);

    try {
      await this.phase('SUMMON', v);
      if (this.aborted) return;

      await this.phase('APPEAR', v);
      if (this.aborted) return;

      if (v.wishRejected) {
        await this.leafDrop(v);
        if (this.aborted) return;
      }

      await this.phase('ASK', v);
      if (this.aborted) return;

      await this.phase('SPEAK', v);
      if (this.aborted) return;

      await this.phase('MIRACLE', v);
      if (this.aborted) return;

      await this.phase('LEAVE', v);
    } finally {
      if (this.guardTimer) {
        clearTimeout(this.guardTimer);
        this.guardTimer = null;
      }
      this.cleanupToIdle();
      this.onVisitDoneFn(v.id);
    }
  }

  private async phase(p: Exclude<Phase, 'IDLE'>, v: Visit): Promise<void> {
    this.currentPhase = p;
    console.log(`[VisitDirector] Pha ${p} — lượt ${v.id} (${v.tier})`);

    const tierKey = v.tier === 'firefly' ? 'visit' : v.tier;
    const plan = PLAN[tierKey];
    const puppet =
      this.seatGrid.getPuppet(v.viewer.userId) ??
      this.seatGrid.addOrUpdateVillager(v.viewer, false);

    switch (p) {
      case 'SUMMON': {
        // Tiếng gió 0,3s trước
        audioBus.playSfx('wind_gust');
        await this.sleep(300);
        if (this.aborted) return;

        this.hud.enterVisitState(v);
        this.fx.dimBackgroundFx(true);

        if (v.tier === 'grand') {
          this.dayNight.forceNight(totalOf(v));
          this.setDimFn(0.35, 1000);
          this.activeGrandCleanup = this.miracles.spawnGrandMoonAndPetals(totalOf(v));
        } else {
          this.setDimFn(0.25, 600);
        }

        // Dân làng được chọn bước lên điểm neo (210, 1180) và phóng to 1,8x
        await Promise.all([
          puppet.walkTo(210, 1180, 1.8, Math.min(1200, plan.SUMMON - 300)),
          this.sleep(Math.max(400, plan.SUMMON - 300)),
        ]);
        return;
      }

      case 'APPEAR': {
        this.bud.root.setPosition(540, 1230);
        await Promise.all([
          this.bud.play('appear'),
          this.sleep(plan.APPEAR),
        ]);
        return;
      }

      case 'ASK': {
        const openerText =
          v.blessing?.openerText ?? `Ồ, ${v.viewer.displayName} đấy à. Lại đây Bụt bảo.`;
        const openerUrl = v.blessing?.openerAudioUrl ?? '';
        const openerDur = v.blessing?.openerDurationMs ?? plan.ASK;

        await this.bud.play('talk');
        this.hud.subtitle.play(openerText, openerDur);
        await audioBus.playVoice(openerUrl, plan.ASK);
        await this.bud.play('idle');
        return;
      }

      case 'SPEAK': {
        const text =
          v.blessing?.text ??
          `Bụt chúc ${v.viewer.displayName} một tối thật bình yên dưới gốc đa làng.`;
        const audioUrl = v.blessing?.audioUrl ?? '';
        const durationMs = v.blessing?.durationMs ?? 5000;

        await this.bud.play('talk');
        this.hud.subtitle.play(text, durationMs);
        await audioBus.playVoice(audioUrl, durationMs);
        await this.bud.play('idle');
        return;
      }

      case 'MIRACLE': {
        await this.bud.play('bless');
        puppet.playCheer();

        if (v.tier === 'grand') {
          // Đại phép: Bụt bay một vòng quanh làng trên mây
          await this.flyBudAroundVillage(plan.MIRACLE);
        } else if (v.tier === 'miracle') {
          const miracleId = this.miracles.resolveMiracleId(
            v.blessing?.category ?? 'binh_an',
            this.getSettingsFn(),
          );
          await this.miracles.playMiracle(miracleId, plan.MIRACLE, true);
        } else {
          // Bậc visit: hoa cỏ nở nhẹ
          await this.miracles.playMiracle('lotus_bloom', plan.MIRACLE, false);
        }
        return;
      }

      case 'LEAVE': {
        this.hud.subtitle.stop();
        this.setDimFn(0, 600);
        this.fx.dimBackgroundFx(false);

        await Promise.all([
          this.bud.play('leave'),
          puppet.walkTo(puppet.seatX, puppet.seatY, 1.0, 1100),
          this.sleep(plan.LEAVE),
        ]);
        return;
      }
    }
  }

  private async leafDrop(v: Visit): Promise<void> {
    await this.fx.playLeafDropToPond(v.viewer.userId);
  }

  private async flyBudAroundVillage(durationMs: number): Promise<void> {
    const waypoints = [
      { x: 260, y: 960 },
      { x: 540, y: 780 },
      { x: 820, y: 960 },
      { x: 540, y: 1230 },
    ];
    const stepMs = Math.floor(durationMs / waypoints.length);
    for (const wp of waypoints) {
      if (this.aborted) return;
      await new Promise<void>((resolve) => {
        this.scene.tweens.add({
          targets: this.bud.root,
          x: wp.x,
          y: wp.y,
          duration: stepMs,
          ease: 'Sine.InOut',
          onComplete: () => resolve(),
        });
      });
    }
  }

  /**
   * Bậc firefly: đom đóm + giọng vọng từ xa, không dim, không Bụt hiện
   */
  public async runFireflyBurst(payload: FireflyBurstPayload): Promise<void> {
    this.hud.subtitle.play(payload.text, payload.durationMs);
    await audioBus.playVoice(payload.audioUrl, payload.durationMs);
    if (this.currentPhase === 'IDLE') {
      this.hud.subtitle.stop();
    }
  }

  /**
   * Lượt Bụt ghé làng (visit:group): Bụt lướt ngang trái -> phải, dừng giữa chúc 3-5 tên, không dim
   */
  public async runGroupVisit(payload: GroupVisitPayload): Promise<void> {
    if (this.currentPhase !== 'IDLE') return;
    this.bud.root.setPosition(-160, 1150);
    this.bud.root.setVisible(true);
    this.bud.root.setAlpha(1);

    await new Promise<void>((resolve) => {
      this.scene.tweens.add({
        targets: this.bud.root,
        x: 540,
        duration: 1500,
        ease: 'Sine.Out',
        onComplete: () => resolve(),
      });
    });

    await this.bud.play('talk');
    this.hud.subtitle.play(payload.text, payload.durationMs);
    await audioBus.playVoice(payload.audioUrl, payload.durationMs);
    await this.bud.play('idle');
    this.hud.subtitle.stop();

    await new Promise<void>((resolve) => {
      this.scene.tweens.add({
        targets: this.bud.root,
        x: 1240,
        alpha: 0,
        duration: 1500,
        ease: 'Sine.In',
        onComplete: () => {
          this.bud.root.setVisible(false);
          this.bud.root.setPosition(540, 1230);
          resolve();
        },
      });
    });
  }

  public abort(): void {
    this.aborted = true;
    audioBus.stopCurrentVoice();
    this.cleanupToIdle();
  }

  private cleanupToIdle(): void {
    this.currentPhase = 'IDLE';
    if (this.activeGrandCleanup) {
      this.activeGrandCleanup();
      this.activeGrandCleanup = null;
    }
    this.bud.root.setVisible(false);
    this.setDimFn(0, 300);
    this.fx.dimBackgroundFx(false);
    this.hud.enterIdleState();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

