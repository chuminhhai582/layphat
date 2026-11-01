import Phaser from 'phaser';
import { io, type Socket } from 'socket.io-client';
import {
  SOCKET_NAMESPACES,
  type OverlayToServerEvents,
  type ServerToOverlayEvents,
  type Settings,
  type Visit,
} from '@but-oi/shared';
import { SAFE_ZONES, THEME } from '../theme.js';
import { DayNightController } from './DayNight.js';
import { SeatGrid } from './SeatGrid.js';
import { FXController } from './FX.js';
import { BudPuppet } from '../puppets/BudPuppet.js';
import { MiraclesController } from './Miracles.js';
import { HudController } from '../ui/Hud.js';
import { VisitDirector } from './VisitDirector.js';
import { audioBus } from '../audio/AudioBus.js';

type ManifestSchema = {
  images: Record<
    string,
    { src: string; placeholder: { w: number; h: number; color: string } }
  >;
  atlases: Record<string, { src: string; data: string }>;
  audio: Record<string, { src: string; loop?: boolean; volume?: number }>;
};

/**
 * VillageScene (T14):
 * - Thứ tự đủ 20 lớp theo đúng UI_SPEC.md §4.1 (sau -> trước).
 * - Parallax núi xa (6px/10s), sương tầng 1 (20px/10s), sương tầng 2 ngược chiều (30px/10s).
 * - Lớp grain 3-4% phủ toàn cảnh; lá đa phía trước rung nhẹ.
 * - Lớp dim (0-60%) điều khiển bằng setDim(value, ms).
 * - ?debug=safe vẽ 10 vùng UI_SPEC §3 (viền đỏ nét đứt, nhãn số) + ?debug=safe&ref=/ref.png độ mờ 50%.
 */
export class VillageScene extends Phaser.Scene {
  private manifest: ManifestSchema | null = null;
  private mountains!: Phaser.GameObjects.TileSprite;
  private mist1!: Phaser.GameObjects.TileSprite;
  private mist2!: Phaser.GameObjects.TileSprite;
  private dimRect!: Phaser.GameObjects.Rectangle;

  private dayNight!: DayNightController;
  private seatGrid!: SeatGrid;
  private fx!: FXController;
  private bud!: BudPuppet;
  private miracles!: MiraclesController;
  private hud!: HudController;
  private director!: VisitDirector;
  private settings?: Settings;

  private socket: Socket<ServerToOverlayEvents, OverlayToServerEvents> | null = null;

  constructor() {
    super({ key: 'VillageScene' });
  }

  public preload(): void {
    this.load.json('asset_manifest', '/assets/manifest.json');
  }

  public async create(): Promise<void> {
    // Đảm bảo phông chữ Google Fonts đã sẵn sàng trước khi tạo Text (T13)
    if (typeof document !== 'undefined' && document.fonts) {
      try {
        await Promise.race([
          Promise.all([
            document.fonts.load('600 48px "Noto Serif"'),
            document.fonts.load('500 38px "Be Vietnam Pro"'),
            document.fonts.load('700 26px "Be Vietnam Pro"'),
          ]),
          new Promise((r) => setTimeout(r, 1200)),
        ]);
      } catch {
        // ignore font load timeout
      }
    }

    this.manifest = (this.cache.json.get('asset_manifest') as ManifestSchema | undefined) ?? {
      images: {},
      atlases: {},
      audio: {},
    };

    await this.loadManifestTextures(this.manifest);
    audioBus.init(this.manifest.audio ?? {});

    this.buildLayeredVillage();
    this.connectSocket();
    this.checkDemoQuery();
  }

  private async loadManifestTextures(manifest: ManifestSchema): Promise<void> {
    const missingOrFailed = new Set<string>();

    this.load.on('loaderror', (fileObj: { key?: string }) => {
      if (fileObj?.key) {
        missingOrFailed.add(fileObj.key);
        console.warn(`[Overlay Loader] Không tải được ${fileObj.key}, dùng placeholder.`);
      }
    });

    for (const [key, item] of Object.entries(manifest.images)) {
      // Tạo sẵn placeholder trong bộ nhớ trước để đảm bảo không bao giờ thiếu texture
      this.createCanvasPlaceholder(
        `${key}__ph`,
        item.placeholder.w,
        item.placeholder.h,
        item.placeholder.color,
        key,
      );
      this.load.image(key, item.src);
    }

    const params = new URLSearchParams(window.location.search);
    const refUrl = params.get('ref');
    if (refUrl) {
      this.load.image('__debug_ref', refUrl);
    }

    await new Promise<void>((resolve) => {
      this.load.once('complete', () => resolve());
      this.load.start();
    });

    for (const [key, item] of Object.entries(manifest.images)) {
      if (missingOrFailed.has(key) || !this.textures.exists(key)) {
        this.createCanvasPlaceholder(
          key,
          item.placeholder.w,
          item.placeholder.h,
          item.placeholder.color,
          key,
        );
      }
    }
  }

  private createCanvasPlaceholder(
    key: string,
    w: number,
    h: number,
    color: string,
    label: string,
  ): void {
    if (this.textures.exists(key)) {
      this.textures.remove(key);
    }
    const canvasTex = this.textures.createCanvas(key, w, h);
    if (!canvasTex) return;
    const ctx = canvasTex.getContext();
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = THEME.colors.gold500;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
    ctx.fillStyle = THEME.colors.textOnDark;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, w / 2, h / 2);
    canvasTex.refresh();
  }

  private buildLayeredVillage(): void {
    // 1. Trời (sky)
    const sky = this.add.image(540, 650, 'bg.sky.dusk').setDisplaySize(1080, 1300).setDepth(1);

    // 2. Trăng/mặt trời
    const ambientMoon = this.add
      .image(820, 320, 'fx.moon')
      .setDisplaySize(160, 160)
      .setAlpha(0.55)
      .setDepth(2);

    // 3. Núi mực xa (parallax 6px/10s)
    this.mountains = this.add
      .tileSprite(540, 740, 1080, 700, 'bg.mountains')
      .setDepth(3);

    // 4. Sương tầng 1 (trôi chậm 20px/10s)
    this.mist1 = this.add
      .tileSprite(540, 920, 1080, 300, 'bg.mist.a')
      .setAlpha(0.45)
      .setDepth(4);

    // 5. Đồi, ruộng lúa + nền đất làng
    const ground = this.add
      .image(540, 1510, 'bg.ground')
      .setDisplaySize(1080, 820)
      .setDepth(5);
    const hillsRice = this.add
      .image(540, 1120, 'bg.hills_rice')
      .setDisplaySize(1300, 420)
      .setDepth(5);

    // 6. Giếng, ao (nước lấp lánh)
    const well = this.add.image(190, 1160, 'bg.well').setDisplaySize(260, 200).setDepth(6);
    const pond = this.add.image(820, 1210, 'bg.pond').setDisplaySize(440, 170).setDepth(6);

    // 7. Tán đa phía sau
    const banyanBack = this.add
      .image(540, 680, 'bg.banyan.back')
      .setDisplaySize(1200, 900)
      .setDepth(7);

    // 8. Thân đa
    const banyanTrunk = this.add
      .image(540, 920, 'bg.banyan.trunk')
      .setDisplaySize(520, 720)
      .setDepth(8);

    // 9. Dân làng ngồi
    const seatContainer = this.add.container(0, 0).setDepth(9);
    this.seatGrid = new SeatGrid(this, seatContainer);

    // 10-13. Mây sau Bụt, Bụt, Dân làng được chọn, Mây trước
    this.bud = new BudPuppet(this, 540, 1230);
    this.bud.root.setDepth(11);

    // 14. Hiệu ứng phép màu
    const miracleContainer = this.add.container(0, 0).setDepth(14);

    // 15. Sương tầng 2 (ngược chiều 30px/10s) + tán lá rủ phía trước rung nhẹ
    this.mist2 = this.add
      .tileSprite(540, 1220, 1080, 300, 'bg.mist.b')
      .setAlpha(0.32)
      .setDepth(15);
    const banyanFront = this.add
      .image(540, 420, 'bg.banyan.front')
      .setDisplaySize(1200, 500)
      .setOrigin(0.5, 0)
      .setDepth(15);

    this.tweens.add({
      targets: banyanFront,
      angle: { from: -0.8, to: 0.8 },
      duration: 3800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    // 16. Đom đóm, cánh hoa
    const fxContainer = this.add.container(0, 0).setDepth(16);
    this.fx = new FXController(this, fxContainer, this.seatGrid);
    this.miracles = new MiraclesController(this, miracleContainer, this.fx);

    // 17. Lớp làm tối (dim 0-60%)
    this.dimRect = this.add
      .rectangle(540, 960, 1080, 1920, THEME.hex.ink900, 1)
      .setAlpha(0)
      .setDepth(17);

    // 18. Lớp hạt (grain 3-4%) phủ toàn cảnh
    this.createGrainLayer(18);

    // 19. HUD
    const hudContainer = this.add.container(0, 0).setDepth(19);
    this.hud = new HudController(this, hudContainer);

    // 20. Debug vùng an toàn (?debug=safe)
    this.setupDebugOverlay(20);

    // Khởi tạo DayNight và VisitDirector
    this.dayNight = new DayNightController(
      this,
      sky,
      [ground, hillsRice, well, pond, banyanBack, banyanTrunk, banyanFront, ambientMoon],
      fxContainer,
    );

    this.director = new VisitDirector({
      scene: this,
      bud: this.bud,
      seatGrid: this.seatGrid,
      fx: this.fx,
      miracles: this.miracles,
      dayNight: this.dayNight,
      hud: this.hud,
      setDim: (val, ms) => this.setDim(val, ms),
      onVisitDone: (visitId) => {
        this.socket?.emit('visit:done', visitId);
      },
      getSettings: () => this.settings,
    });
  }

  /**
   * Điều khiển lớp làm tối (0 - 0.60)
   */
  public setDim(value: number, ms = 400): void {
    const clamped = Math.max(0, Math.min(0.6, value));
    this.tweens.add({
      targets: this.dimRect,
      alpha: clamped,
      duration: ms,
      ease: 'Sine.InOut',
    });
  }

  private createGrainLayer(depth: number): void {
    const grainKey = '__film_grain';
    const canvasTex = this.textures.createCanvas(grainKey, 256, 256);
    if (!canvasTex) return;
    const ctx = canvasTex.getContext();
    const imgData = ctx.createImageData(256, 256);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.random() * 255;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    canvasTex.refresh();

    this.add
      .tileSprite(540, 960, 1080, 1920, grainKey)
      .setAlpha(0.035) // 3.5% grain
      .setDepth(depth);
  }

  private setupDebugOverlay(depth: number): void {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') !== 'safe') return;

    const debugContainer = this.add.container(0, 0).setDepth(depth);

    if (params.get('ref') && this.textures.exists('__debug_ref')) {
      const refImg = this.add
        .image(540, 960, '__debug_ref')
        .setDisplaySize(1080, 1920)
        .setAlpha(0.5);
      debugContainer.add(refImg);
    }

    const gfx = this.add.graphics();
    debugContainer.add(gfx);

    for (const zone of SAFE_ZONES) {
      this.drawDashedRect(gfx, zone.x, zone.y, zone.w, zone.h, 0xff3b30);
      const label = this.add.text(zone.x + 12, zone.y + 8, zone.name, {
        fontFamily: THEME.fonts.sans,
        fontSize: '20px',
        fontStyle: '700',
        color: '#FF3B30',
        backgroundColor: 'rgba(14,23,25,0.85)',
        padding: { x: 6, y: 3 },
      });
      debugContainer.add(label);
    }
  }

  private drawDashedRect(
    gfx: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
  ): void {
    gfx.lineStyle(2, color, 0.9);
    const dash = 12;
    const gap = 8;

    const drawSegment = (x1: number, y1: number, x2: number, y2: number) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const steps = Math.floor(len / (dash + gap));
      for (let i = 0; i <= steps; i++) {
        const startRatio = (i * (dash + gap)) / len;
        const endRatio = Math.min(1, (i * (dash + gap) + dash) / len);
        gfx.beginPath();
        gfx.moveTo(x1 + dx * startRatio, y1 + dy * startRatio);
        gfx.lineTo(x1 + dx * endRatio, y1 + dy * endRatio);
        gfx.strokePath();
      }
    };

    drawSegment(x, y, x + w, y);
    drawSegment(x + w, y, x + w, y + h);
    drawSegment(x + w, y + h, x, y + h);
    drawSegment(x, y + h, x, y);
  }

  private connectSocket(): void {
    const serverOrigin =
      window.location.port === '5173'
        ? `${window.location.protocol}//${window.location.hostname}:7777`
        : window.location.origin;

    const socket: Socket<ServerToOverlayEvents, OverlayToServerEvents> = io(
      `${serverOrigin}${SOCKET_NAMESPACES.OVERLAY}`,
      {
        transports: ['websocket', 'polling'],
      },
    );
    this.socket = socket;

    socket.on('state:sync', (data) => {
      this.seatGrid.clear();
      for (const s of data.seats) {
        this.seatGrid.addOrUpdateVillager(
          { ...s.viewer, seatIndex: s.seatIndex },
          false,
        );
      }
      this.hud.counter.setTotalJoined(data.totalJoined);
      this.hud.queueChip.updateQueue(data.queue);
      this.hud.queueChip.setPaused(data.paused);
      this.hud.disclaimer.setPaused(data.paused);
      this.hud.banner.setNextGroupVisitAt(data.nextGroupVisitAt);
      this.settings = data.settings;
      this.hud.applySettings(data.settings);
      if (data.settings.volumes) {
        audioBus.setVolumes(data.settings.volumes);
      }
    });

    socket.on('seat:add', (viewer) => {
      this.seatGrid.addOrUpdateVillager(viewer, true);
      if (viewer.totalJoined !== undefined) {
        this.hud.counter.setTotalJoined(viewer.totalJoined);
      }
    });

    socket.on('seat:remove', (userId) => {
      this.seatGrid.removeVillager(userId, true);
    });

    socket.on('fx:firefly', ({ userId, count }) => {
      this.fx.playFirefly(userId, count);
    });

    socket.on('fx:wave', ({ userId, showBudShadow }) => {
      this.fx.playWave(userId, showBudShadow ?? true);
    });

    socket.on('fx:leaf', ({ userId }) => {
      this.fx.playLeafWish(userId);
    });

    socket.on('fx:fish', ({ userId }) => {
      this.fx.playFish(userId);
    });

    socket.on('fx:sparrow', ({ userId }) => {
      this.fx.playSparrow(userId);
    });

    socket.on('queue:update', (nextVisits) => {
      this.hud.queueChip.updateQueue(nextVisits);
    });

    socket.on('state:pause', (paused) => {
      this.hud.queueChip.setPaused(paused);
      this.hud.disclaimer.setPaused(paused);
    });

    socket.on('group:countdown', ({ nextGroupVisitAt }) => {
      this.hud.banner.setNextGroupVisitAt(nextGroupVisitAt);
    });

    socket.on('settings:update', (settings) => {
      this.settings = settings;
      this.hud.applySettings(settings);
      if (settings.volumes) {
        audioBus.setVolumes(settings.volumes);
      }
    });

    socket.on('visit:start', (visit) => {
      void this.director.run(visit);
    });

    socket.on('visit:firefly', (payload) => {
      void this.director.runFireflyBurst(payload);
    });

    socket.on('visit:group', (payload) => {
      void this.director.runGroupVisit(payload);
    });
  }

  /**
   * ?demo=visit chạy một lượt mẫu không cần server (T18)
   */
  private checkDemoQuery(): void {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') !== 'visit') return;

    const demoViewer = {
      userId: 'demo_user',
      uniqueId: 'minh_anh',
      nickname: 'Minh Anh',
      displayName: 'Minh Anh',
      avatarSeed: 3,
    };
    this.seatGrid.addOrUpdateVillager({ ...demoViewer, seatIndex: 8 }, false);

    const demoVisit: Visit = {
      id: 'demo_visit_1',
      viewer: demoViewer,
      tier: 'miracle',
      totalCoins: 300,
      enqueuedAt: Date.now(),
      hadWish: true,
      wishRejected: false,
      blessing: {
        openerText: 'Ồ, Minh Anh đấy à. Lại đây Bụt bảo.',
        openerAudioUrl: '',
        openerDurationMs: 2000,
        text: 'Học hành vất vả lắm hả Minh Anh? Bụt chúc con đầu óc sáng như trăng rằm, đi thi bình tĩnh, làm bài trơn tru.',
        source: 'bank',
        category: 'hoc_hanh',
        audioUrl: '',
        durationMs: 5000,
      },
      status: 'performing',
    };

    setTimeout(() => {
      void this.director.run(demoVisit);
    }, 600);
  }

  public update(_time: number, delta: number): void {
    const dtSec = delta / 1000;
    // Parallax theo UI_SPEC §6: núi xa 6px/10s (0.6px/s), sương 1 20px/10s (2px/s), sương 2 ngược chiều 30px/10s (-3px/s)
    if (this.mountains) this.mountains.tilePositionX += 0.6 * dtSec;
    if (this.mist1) this.mist1.tilePositionX += 2.0 * dtSec;
    if (this.mist2) this.mist2.tilePositionX -= 3.0 * dtSec;

    if (this.bud) this.bud.update();
    if (this.hud) this.hud.update(Date.now());
  }
}

