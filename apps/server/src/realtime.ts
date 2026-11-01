import { Server as SocketIOServer } from 'socket.io';
import type { FastifyInstance } from 'fastify';
import {
  SOCKET_NAMESPACES,
  type AdminManualPayload,
  type AdminStatePayload,
  type LiveEvent,
  type OverlayToServerEvents,
  type ServerToAdminEvents,
  type ServerToOverlayEvents,
  type AdminToServerEvents,
  type Settings,
  type SourceName,
} from '@but-oi/shared';
import { getSettings, updateSettings } from './config.js';
import { getRepo, type Repo } from './db/repo.js';
import { SeatManager } from './core/seats.js';
import { VisitQueue } from './core/queue.js';
import { VisitPreparer } from './core/preparer.js';
import { GroupVisitScheduler } from './core/groupVisit.js';
import { SourceManager } from './sources/index.js';
import { stripVietnameseAccents } from './blessing/bannedWords.js';
import { toViewer } from './core/normalizer.js';

export type RealtimeHubOptions = {
  app: FastifyInstance;
  repo?: Repo;
  seats?: SeatManager;
  queue?: VisitQueue;
  preparer?: VisitPreparer;
  groupScheduler?: GroupVisitScheduler;
  sources?: SourceManager;
  adminPin?: string;
};

export class RealtimeHub {
  public readonly io: SocketIOServer;
  public readonly seats: SeatManager;
  public readonly queue: VisitQueue;
  public readonly preparer: VisitPreparer;
  public readonly groupScheduler: GroupVisitScheduler;
  public readonly sources: SourceManager;
  private readonly repo: Repo;
  private adminPin: string;
  private lastBudShadowAt = 0;
  private lastPerformedVisitId: string | null = null;

  constructor(opts: RealtimeHubOptions) {
    this.repo = opts.repo ?? getRepo();
    this.seats = opts.seats ?? new SeatManager();
    this.queue = opts.queue ?? new VisitQueue();
    this.preparer =
      opts.preparer ??
      new VisitPreparer({
        queue: this.queue,
        repo: this.repo,
      });
    this.groupScheduler =
      opts.groupScheduler ??
      new GroupVisitScheduler({
        queue: this.queue,
      });
    this.sources = opts.sources ?? new SourceManager();
    this.adminPin = (opts.adminPin ?? process.env.ADMIN_PIN ?? '').trim();

    this.io = new SocketIOServer(opts.app.server, {
      cors: { origin: '*' },
    });

    this.setupNamespaces();
    this.bindInternalEvents();
  }

  public setAdminPin(pin: string): void {
    this.adminPin = pin.trim();
  }

  public checkPin(providedPin?: string): boolean {
    if (!this.adminPin) return true;
    return providedPin === this.adminPin;
  }

  private setupNamespaces(): void {
    const overlayNs = this.io.of(SOCKET_NAMESPACES.OVERLAY);
    const adminNs = this.io.of(SOCKET_NAMESPACES.ADMIN);

    // Xác thực mã PIN cho namespace /admin
    adminNs.use((socket, next) => {
      const authPin =
        (socket.handshake.auth?.pin as string | undefined) ??
        (socket.handshake.query?.pin as string | undefined) ??
        '';
      if (!this.checkPin(String(authPin))) {
        next(new Error('INVALID_PIN'));
        return;
      }
      next();
    });

    overlayNs.on('connection', (socket) => {
      // Gửi lại toàn bộ chỗ ngồi hiện tại, hàng chờ và trạng thái khi overlay kết nối/kết nối lại
      const seated = this.seats.getSeatedList();
      const totalJoined = this.seats.getTotalJoined();
      socket.emit('state:sync', {
        seats: seated,
        totalJoined,
        queue: this.queue.getPendingSorted().slice(0, 5),
        currentVisit: this.queue.getPerformingVisit(),
        paused: this.queue.isPaused(),
        nextGroupVisitAt: this.groupScheduler.getNextGroupVisitAt(),
        settings: getSettings(),
      });

      for (const s of seated) {
        socket.emit('seat:add', {
          ...s.viewer,
          seatIndex: s.seatIndex,
          totalJoined,
        });
      }
      socket.emit('queue:update', this.queue.getPendingSorted().slice(0, 5));
      socket.emit('state:pause', this.queue.isPaused());
      const current = this.queue.getPerformingVisit();
      if (current) {
        socket.emit('visit:start', current);
      }

      socket.on('visit:done', (visitId: string) => {
        this.preparer.notifyVisitDone(visitId);
        void this.groupScheduler.checkDeferredOnIdle();
        this.broadcastAdminState();
      });
    });

    adminNs.on('connection', (socket) => {
      socket.emit('admin:state', this.getAdminState());
      socket.emit('queue:update', this.queue.getPendingSorted().slice(0, 5));

      socket.on('admin:skip', (visitId: string) => {
        this.queue.skip(visitId);
        void this.preparer.tick();
        this.broadcastAdminState();
      });

      socket.on('admin:promote', (visitId: string) => {
        this.queue.promote(visitId);
        void this.preparer.tick();
        this.broadcastAdminState();
      });

      socket.on('admin:replay', (visitId?: string) => {
        const current = this.queue.getPerformingVisit();
        if (current && (!visitId || current.id === visitId)) {
          overlayNs.emit('visit:start', current);
        }
      });

      socket.on('admin:pause', (paused: boolean) => {
        this.queue.setPaused(paused);
        overlayNs.emit('state:pause', paused);
        adminNs.emit('state:pause', paused);
        this.broadcastAdminState();
      });

      socket.on('admin:manual', (payload: AdminManualPayload) => {
        this.triggerManualVisit(payload);
      });

      socket.on('admin:switchSource', (source: SourceName) => {
        void this.sources.switchSource(source).then(() => {
          this.broadcastAdminState();
        });
      });

      socket.on('admin:replaceBlessing', (visitId: string) => {
        void this.preparer.replaceWithBankBlessing(visitId).then(() => {
          this.broadcastAdminState();
        });
      });

      socket.on('admin:settingsUpdate', (partial: Partial<Settings>) => {
        const updated = updateSettings(partial);
        overlayNs.emit('settings:update', updated);
        this.broadcastAdminState();
      });
    });
  }

  private bindInternalEvents(): void {
    const overlayNs = this.io.of(SOCKET_NAMESPACES.OVERLAY) as unknown as {
      emit: <K extends keyof ServerToOverlayEvents>(
        ev: K,
        ...args: Parameters<ServerToOverlayEvents[K]>
      ) => void;
    };
    const adminNs = this.io.of(SOCKET_NAMESPACES.ADMIN) as unknown as {
      emit: <K extends keyof ServerToAdminEvents>(
        ev: K,
        ...args: Parameters<ServerToAdminEvents[K]>
      ) => void;
    };

    this.seats.onSeatAdd((payload) => {
      overlayNs.emit('seat:add', payload);
      this.broadcastAdminState();
    });

    this.seats.onSeatRemove((userId) => {
      overlayNs.emit('seat:remove', userId);
    });

    this.queue.onChange((top5) => {
      overlayNs.emit('queue:update', top5);
      adminNs.emit('queue:update', top5);
      this.broadcastAdminState();
    });

    this.preparer.onVisitStart((visit) => {
      this.lastPerformedVisitId = visit.id;
      overlayNs.emit('visit:start', visit);
      this.broadcastAdminState();
    });

    this.preparer.onFireflyBurst((payload) => {
      overlayNs.emit('visit:firefly', payload);
    });

    this.preparer.onAdminPreview((preview) => {
      adminNs.emit('admin:preview', preview);
    });

    this.groupScheduler.onGroupVisit((payload) => {
      overlayNs.emit('visit:group', payload);
    });

    this.groupScheduler.onCountdownUpdate((nextAt) => {
      overlayNs.emit('group:countdown', { nextGroupVisitAt: nextAt });
    });

    this.sources.onStatus(() => {
      this.broadcastAdminState();
    });

    this.sources.onEvent((ev) => {
      this.handleLiveEvent(ev);
    });
  }

  public handleLiveEvent(ev: LiveEvent): void {
    const overlayNs = this.io.of(SOCKET_NAMESPACES.OVERLAY);
    const now = ev.at || Date.now();

    if (ev.type === 'join') {
      this.seats.handleJoin(ev.viewer, now);
      this.groupScheduler.recordViewerJoin(ev.viewer);
      return;
    }

    // Mọi tương tác khác đều cập nhật lastActiveAt (và cấp chỗ nếu chưa ngồi)
    this.seats.touch(ev.viewer, now);

    switch (ev.type) {
      case 'like': {
        overlayNs.emit('fx:firefly', {
          userId: ev.viewer.userId,
          count: ev.count,
        });
        return;
      }

      case 'follow': {
        overlayNs.emit('fx:fish', { userId: ev.viewer.userId });
        return;
      }

      case 'share': {
        overlayNs.emit('fx:sparrow', { userId: ev.viewer.userId });
        return;
      }

      case 'chat': {
        this.handleChatEvent(ev.viewer.userId, ev.text, now);
        return;
      }

      case 'gift': {
        const cfg = getSettings();
        const tier = this.queue.enqueue(ev.viewer, ev.totalCoins, now);
        if (!tier) {
          // Firefly cũng kích hoạt hiệu ứng đom đóm tại chỗ ngồi
          overlayNs.emit('fx:firefly', {
            userId: ev.viewer.userId,
            count: Math.min(5, Math.max(1, ev.totalCoins)),
          });
        }
        void cfg;
        void this.preparer.tick();
        return;
      }
    }
  }

  private handleChatEvent(userId: string, rawText: string, now: number): void {
    const overlayNs = this.io.of(SOCKET_NAMESPACES.OVERLAY);
    const cfg = getSettings();
    const trimmed = rawText.trim();
    if (!trimmed) return;

    const lower = trimmed.toLowerCase().normalize('NFC');
    const unaccented = stripVietnameseAccents(lower);

    // 1. Kiểm tra lời ước bắt đầu bằng wishPrefixes (vd: "ước:", "uoc:", "#uoc")
    for (const prefix of cfg.wishPrefixes) {
      const pLower = prefix.toLowerCase().normalize('NFC');
      if (lower.startsWith(pLower)) {
        const body = trimmed.slice(prefix.length).trim();
        if (body) {
          // Ràng buộc: Không ghi nội dung lời ước gốc vào log mức info
          this.repo.addWish(userId, body, now);
          overlayNs.emit('fx:leaf', { userId });
        }
        return;
      }
    }

    // 2. Nhận diện "Bụt ơi" (không phân biệt dấu / hoa thường)
    if (/\bbut\s+oi\b/i.test(unaccented)) {
      const canShowShadow =
        now - this.lastBudShadowAt >= cfg.budShadowCooldownMs;
      if (canShowShadow) {
        this.lastBudShadowAt = now;
      }
      overlayNs.emit('fx:wave', { userId, showBudShadow: canShowShadow });
    }
  }

  public triggerManualVisit(payload: AdminManualPayload): void {
    const viewer = toViewer({
      userId: `manual_${Date.now()}`,
      uniqueId: payload.name.trim() || 'dan_lang',
      nickname: payload.name.trim() || 'con',
    });
    this.seats.touch(viewer);
    if (payload.wish && payload.wish.trim()) {
      this.repo.addWish(viewer.userId, payload.wish.trim());
    }
    if (payload.tier === 'firefly') {
      this.queue.enqueue(viewer, 10);
    } else {
      const visit = this.queue.enqueueManual(viewer, payload.tier);
      this.queue.promote(visit.id);
    }
    void this.preparer.tick();
    this.broadcastAdminState();
  }

  public getAdminState(): AdminStatePayload {
    return {
      sourceStatus: this.sources.getStatus(),
      queue: this.queue.getPendingSorted().slice(0, 10),
      currentVisit: this.queue.getPerformingVisit(),
      paused: this.queue.isPaused(),
      totalJoined: this.seats.getTotalJoined(),
      seatedCount: this.seats.getSeatedList().length,
      settings: getSettings(),
    };
  }

  public broadcastAdminState(): void {
    this.io.of(SOCKET_NAMESPACES.ADMIN).emit('admin:state', this.getAdminState());
  }

  public async close(): Promise<void> {
    this.groupScheduler.stop();
    this.preparer.dispose();
    this.sources.stop();
    await this.io.close();
  }
}

export type { OverlayToServerEvents, AdminToServerEvents };

