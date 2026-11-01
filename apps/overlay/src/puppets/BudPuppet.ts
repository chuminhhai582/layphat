import Phaser from 'phaser';
import { THEME } from '../theme.js';
import { audioBus } from '../audio/AudioBus.js';

export type BudAnimName = 'idle' | 'appear' | 'talk' | 'bless' | 'leave';

/**
 * BudPuppet theo đúng UI_SPEC.md §7.1 và §7.2:
 * - Neo chân tại (540, 1230), chiều cao nhân vật ~720px.
 * - Cây phân cấp cha-con đúng §7.1:
 *   cloud_back, robe (thân), sleeve_l/r -> robe, arm_staff -> robe, staff -> arm_staff, gourd -> staff,
 *   head -> robe, hair_l/r -> head, brow_l/r -> head, eyes_open/closed -> head,
 *   beard_1 -> head, beard_2 -> beard_1, beard_3 -> beard_2, mustache -> head, cloud_front.
 */
export class BudPuppet {
  public readonly root: Phaser.GameObjects.Container;
  public readonly cloudBack: Phaser.GameObjects.Image;
  public readonly cloudFront: Phaser.GameObjects.Image;

  private scene: Phaser.Scene;
  private robeContainer: Phaser.GameObjects.Container;
  private robeImg: Phaser.GameObjects.Image;
  private sleeveL: Phaser.GameObjects.Image;
  private sleeveR: Phaser.GameObjects.Image;
  private armStaffContainer: Phaser.GameObjects.Container;
  private staffContainer: Phaser.GameObjects.Container;
  private gourdImg: Phaser.GameObjects.Image;
  private headContainer: Phaser.GameObjects.Container;
  private eyesOpen: Phaser.GameObjects.Image;
  private eyesClosed: Phaser.GameObjects.Image;
  private browL: Phaser.GameObjects.Image;
  private browR: Phaser.GameObjects.Image;
  private beard1: Phaser.GameObjects.Container;
  private beard2: Phaser.GameObjects.Container;
  private beard3: Phaser.GameObjects.Container;

  private isTalking = false;
  private blinkTimer: ReturnType<typeof setTimeout> | null = null;
  private talkTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, x = 540, y = 1230) {
    this.scene = scene;
    this.root = scene.add.container(x, y);
    this.root.setVisible(false);
    this.root.setAlpha(0);

    // 1. cloud_back (pivot giữa)
    this.cloudBack = scene.add.image(0, -180, 'char.bud.cloud_back').setOrigin(0.5, 0.5);

    // 2. robe (pivot giữa đáy)
    this.robeContainer = scene.add.container(0, -40);
    this.robeImg = scene.add.image(0, 0, 'char.bud.robe').setOrigin(0.5, 1.0);

    // 3. sleeve_l, sleeve_r (pivot vai, cha: robe)
    this.sleeveL = scene.add.image(-125, -410, 'char.bud.sleeve_l').setOrigin(0.5, 0.1);
    this.sleeveR = scene.add.image(125, -410, 'char.bud.sleeve_r').setOrigin(0.5, 0.1);

    // 4. arm_staff (pivot vai phải, cha: robe) -> staff (pivot tay nắm) -> gourd (pivot đỉnh dây buộc)
    this.armStaffContainer = scene.add.container(135, -410);
    const armStaffImg = scene.add.image(0, 0, 'char.bud.arm_staff').setOrigin(0.5, 0.15);

    this.staffContainer = scene.add.container(35, 95);
    const staffImg = scene.add.image(0, 0, 'char.bud.staff').setOrigin(0.5, 0.35);

    this.gourdImg = scene.add.image(-18, -140, 'char.bud.gourd').setOrigin(0.5, 0.05);
    this.staffContainer.add([staffImg, this.gourdImg]);
    this.armStaffContainer.add([armStaffImg, this.staffContainer]);

    // 5. head (pivot cổ, cha: robe)
    this.headContainer = scene.add.container(0, -475);
    const headImg = scene.add.image(0, 0, 'char.bud.head').setOrigin(0.5, 0.9);
    const hairL = scene.add.image(-68, -95, 'char.bud.hair_l').setOrigin(0.5, 0.1);
    const hairR = scene.add.image(68, -95, 'char.bud.hair_r').setOrigin(0.5, 0.1);

    this.browL = scene.add.image(-30, -102, 'char.bud.brow_l').setOrigin(1.0, 0.5);
    this.browR = scene.add.image(30, -102, 'char.bud.brow_r').setOrigin(0.0, 0.5);
    this.eyesOpen = scene.add.image(0, -82, 'char.bud.eyes_open').setOrigin(0.5, 0.5);
    this.eyesClosed = scene.add
      .image(0, -82, 'char.bud.eyes_closed')
      .setOrigin(0.5, 0.5)
      .setVisible(false);

    const mustache = scene.add.image(0, -45, 'char.bud.mustache').setOrigin(0.5, 0.5);

    // Chuỗi râu beard_1 -> beard_2 -> beard_3 (pivot mép trên từng đoạn)
    this.beard1 = scene.add.container(0, -35);
    const b1Img = scene.add.image(0, 0, 'char.bud.beard_1').setOrigin(0.5, 0.05);
    this.beard2 = scene.add.container(0, 65);
    const b2Img = scene.add.image(0, 0, 'char.bud.beard_2').setOrigin(0.5, 0.05);
    this.beard3 = scene.add.container(0, 65);
    const b3Img = scene.add.image(0, 0, 'char.bud.beard_3').setOrigin(0.5, 0.05);

    this.beard3.add(b3Img);
    this.beard2.add([b2Img, this.beard3]);
    this.beard1.add([b1Img, this.beard2]);

    this.headContainer.add([
      hairL,
      hairR,
      headImg,
      this.eyesOpen,
      this.eyesClosed,
      this.browL,
      this.browR,
      this.beard1,
      mustache,
    ]);

    this.robeContainer.add([
      this.sleeveL,
      this.sleeveR,
      this.robeImg,
      this.headContainer,
      this.armStaffContainer,
    ]);

    // 6. cloud_front (pivot giữa)
    this.cloudFront = scene.add.image(0, -30, 'char.bud.cloud_front').setOrigin(0.5, 0.5);

    this.root.add([this.cloudBack, this.robeContainer, this.cloudFront]);

    this.setupIdleTweens();
    this.scheduleNextBlink();
  }

  private setupIdleTweens(): void {
    // robe.scaleY 1 -> 1.012, 4s, yoyo, sine
    this.scene.tweens.add({
      targets: this.robeContainer,
      scaleY: 1.012,
      duration: 4000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    // head.y -2px
    this.scene.tweens.add({
      targets: this.headContainer,
      y: -477,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    // beard_1..3 xoay +-2 độ lệch pha 0 / 200 / 400ms
    [this.beard1, this.beard2, this.beard3].forEach((b, idx) => {
      this.scene.tweens.add({
        targets: b,
        angle: { from: -2, to: 2 },
        duration: 2400,
        delay: idx * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    });

    // gourd xoay +-4 độ, 2,6s
    this.scene.tweens.add({
      targets: this.gourdImg,
      angle: { from: -4, to: 4 },
      duration: 2600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  private scheduleNextBlink(): void {
    if (this.blinkTimer) clearTimeout(this.blinkTimer);
    const nextInMs = 3000 + Math.random() * 3000;
    this.blinkTimer = setTimeout(() => {
      if (!this.eyesOpen.scene) return;
      this.eyesOpen.setVisible(false);
      this.eyesClosed.setVisible(true);
      setTimeout(() => {
        if (!this.eyesOpen.scene) return;
        this.eyesOpen.setVisible(true);
        this.eyesClosed.setVisible(false);
        this.scheduleNextBlink();
      }, 120);
    }, nextInMs);
  }

  public update(): void {
    if (this.isTalking) {
      // beard_2 xoay theo biên độ âm thanh (AnalyserNode RMS -> 0-4 độ)
      const rms = audioBus.getVoiceRms();
      this.beard2.setAngle(rms * 4);
    }
  }

  public async play(name: BudAnimName): Promise<void> {
    switch (name) {
      case 'idle': {
        this.isTalking = false;
        if (this.talkTween) {
          this.talkTween.stop();
          this.talkTween = null;
        }
        this.headContainer.setAngle(0);
        return;
      }

      case 'appear': {
        this.isTalking = false;
        this.root.setVisible(true);
        this.root.setAlpha(0);
        const targetY = 1230;
        this.root.setY(targetY + 40);
        this.cloudBack.setScale(0.6);
        this.cloudFront.setScale(0.6);

        // 30 hạt khói bung ra
        this.spawnAppearSmoke(30);
        audioBus.playSfx('chime_soft');

        this.scene.tweens.add({
          targets: [this.cloudBack, this.cloudFront],
          scaleX: 1,
          scaleY: 1,
          duration: 600,
          ease: 'Cubic.Out',
        });

        await new Promise<void>((resolve) => {
          this.scene.tweens.add({
            targets: this.root,
            alpha: 1,
            y: targetY,
            duration: 900,
            ease: 'Cubic.Out',
            onComplete: () => resolve(),
          });
        });
        return;
      }

      case 'talk': {
        this.isTalking = true;
        if (this.talkTween) this.talkTween.stop();
        // head xoay +-1,5 độ chu kỳ 0,8s
        this.talkTween = this.scene.tweens.add({
          targets: this.headContainer,
          angle: { from: -1.5, to: 1.5 },
          duration: 400,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut',
        });
        return;
      }

      case 'bless': {
        await this.play('idle');
        // arm_staff xoay -18 độ 500ms -> gõ gậy xuống 200ms + vòng sóng sáng tại đầu gậy -> về 400ms
        await new Promise<void>((resolve) => {
          this.scene.tweens.add({
            targets: this.armStaffContainer,
            angle: -18,
            duration: 500,
            ease: 'Sine.Out',
            onComplete: () => {
              this.scene.tweens.add({
                targets: this.armStaffContainer,
                angle: 8,
                duration: 200,
                ease: 'Quad.In',
                onComplete: () => {
                  audioBus.playSfx('staff_tap');
                  this.spawnStaffRipple();
                  this.scene.tweens.add({
                    targets: this.armStaffContainer,
                    angle: 0,
                    duration: 400,
                    ease: 'Cubic.Out',
                    onComplete: () => resolve(),
                  });
                },
              });
            },
          });
        });
        return;
      }

      case 'leave': {
        await this.play('idle');
        const startY = this.root.y;
        await new Promise<void>((resolve) => {
          this.scene.tweens.add({
            targets: this.root,
            alpha: 0,
            y: startY - 30,
            duration: 1200,
            ease: 'Quad.In',
            onComplete: () => {
              this.root.setVisible(false);
              this.root.setY(1230);
              resolve();
            },
          });
        });
        return;
      }
    }
  }

  private spawnAppearSmoke(count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const dist = 80 + Math.random() * 140;
      const p = this.scene.add
        .image(this.root.x, this.root.y - 180, 'fx.smoke')
        .setDisplaySize(72, 72)
        .setAlpha(0.65)
        .setDepth(this.root.depth - 1);

      this.scene.tweens.add({
        targets: p,
        x: this.root.x + Math.cos(angle) * dist,
        y: this.root.y - 180 + Math.sin(angle) * dist * 0.5,
        alpha: 0,
        scaleX: 1.5,
        scaleY: 1.5,
        duration: 850,
        ease: 'Cubic.Out',
        onComplete: () => p.destroy(),
      });
    }
  }

  private spawnStaffRipple(): void {
    const ring = this.scene.add.graphics();
    ring.setPosition(this.root.x + 170, this.root.y - 40);
    ring.setDepth(this.root.depth + 1);
    ring.lineStyle(4, THEME.hex.gold300, 0.9);
    ring.strokeCircle(0, 0, 24);

    this.scene.tweens.add({
      targets: ring,
      scaleX: 5,
      scaleY: 2.5,
      alpha: 0,
      duration: 700,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    });
  }
}

