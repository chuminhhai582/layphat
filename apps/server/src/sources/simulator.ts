import type { FastifyInstance } from 'fastify';
import type { LiveEvent, SourceStatusState } from '@but-oi/shared';
import { EventNormalizer, toViewer, type RawIncomingEvent } from '../core/normalizer.js';
import type { EventSource } from './index.js';

export const SIMULATOR_SAMPLE_USERS: Array<{
  userId: string;
  uniqueId: string;
  nickname: string;
}> = [
  { userId: 'sim_01', uniqueId: 'minh_anh_99', nickname: 'Minh Anh' },
  { userId: 'sim_02', uniqueId: 'hoang_nam', nickname: 'Hoàng Nam' },
  { userId: 'sim_03', uniqueId: 'thanh_truc', nickname: 'Thanh Trúc' },
  { userId: 'sim_04', uniqueId: 'bao_ngoc_🌸', nickname: '🌸 Bảo Ngọc 2004 🌸' },
  { userId: 'sim_05', uniqueId: 'user_987654321', nickname: '9876543210' },
  {
    userId: 'sim_06',
    uniqueId: 'ten_rat_dai_test',
    nickname: 'Nguyễn Hoàng Phương Trang Anh Thư Bảo Ngọc Linh Đan',
  },
  { userId: 'sim_07', uniqueId: 'duc_thinh', nickname: 'Đức Thịnh' },
  { userId: 'sim_08', uniqueId: 'khanh_vy', nickname: 'Khánh Vy' },
  { userId: 'sim_09', uniqueId: 'tuan_kiet', nickname: 'Tuấn Kiệt' },
  { userId: 'sim_10', uniqueId: 'mai_huong_✨', nickname: '✨ Mai Hương 123456 ✨' },
  { userId: 'sim_11', uniqueId: 'quoc_bao', nickname: 'Quốc Bảo' },
  { userId: 'sim_12', uniqueId: 'thao_nguyen', nickname: 'Thảo Nguyên' },
  { userId: 'sim_13', uniqueId: 'gia_huy', nickname: 'Gia Huy' },
  { userId: 'sim_14', uniqueId: 'ngoc_bich', nickname: 'Ngọc Bích' },
  { userId: 'sim_15', uniqueId: 'van_hau', nickname: 'Văn Hậu' },
  { userId: 'sim_16', uniqueId: 'phuong_linh', nickname: 'Phương Linh' },
  { userId: 'sim_17', uniqueId: 'dinh_phong', nickname: 'Đình Phong' },
  { userId: 'sim_18', uniqueId: 'cam_tu', nickname: 'Cẩm Tú' },
  { userId: 'sim_19', uniqueId: 'hai_dang_🔥', nickname: '🔥 Hải Đăng 88888 🔥' },
  { userId: 'sim_20', uniqueId: 'ha_my', nickname: 'Hà My' },
];

export type SimRequestPayload = {
  type: 'join' | 'like' | 'chat' | 'follow' | 'share' | 'gift';
  user?: string | { userId?: string; uniqueId?: string; nickname?: string };
  text?: string;
  coins?: number;
  count?: number;
  repeat?: number;
  useComboWindow?: boolean;
};

export type SimBurstPayload = {
  kind: 'gifts' | 'joins';
  n: number;
  seconds: number;
};

export class SimulatorSource implements EventSource {
  public readonly name = 'simulator' as const;
  private eventHandlers: Array<(e: LiveEvent) => void> = [];
  private statusHandlers: Array<(s: SourceStatusState, detail?: string) => void> = [];
  private normalizer: EventNormalizer;
  private connected = false;
  private burstTimers: Array<ReturnType<typeof setTimeout>> = [];
  private userCursor = 0;

  constructor(normalizer?: EventNormalizer) {
    this.normalizer = normalizer ?? new EventNormalizer();
    this.normalizer.onEvent((e) => this.emitEvent(e));
  }

  public async connect(): Promise<void> {
    this.emitStatus('connecting');
    this.connected = true;
    this.emitStatus('live', 'Bộ giả lập sẵn sàng');
  }

  public disconnect(): void {
    this.connected = false;
    for (const t of this.burstTimers) {
      clearTimeout(t);
    }
    this.burstTimers = [];
    this.emitStatus('offline', 'Đã ngắt bộ giả lập');
  }

  public on(handler: (e: LiveEvent) => void): void {
    this.eventHandlers.push(handler);
  }

  public onStatus(handler: (s: SourceStatusState, detail?: string) => void): void {
    this.statusHandlers.push(handler);
  }

  private emitEvent(e: LiveEvent): void {
    for (const h of this.eventHandlers) {
      h(e);
    }
  }

  private emitStatus(s: SourceStatusState, detail?: string): void {
    for (const h of this.statusHandlers) {
      h(s, detail);
    }
  }

  public pickRandomUser(
    custom?: string | { userId?: string; uniqueId?: string; nickname?: string },
  ): { userId: string; uniqueId: string; nickname: string } {
    if (typeof custom === 'string' && custom.trim()) {
      const clean = custom.trim();
      const id = `sim_${clean.toLowerCase().replace(/\s+/g, '_')}`;
      return { userId: id, uniqueId: id, nickname: clean };
    }
    if (custom && typeof custom === 'object' && (custom.nickname || custom.userId)) {
      const id = custom.userId ?? `sim_${Date.now()}`;
      return {
        userId: id,
        uniqueId: custom.uniqueId ?? id,
        nickname: custom.nickname ?? id,
      };
    }
    const picked =
      SIMULATOR_SAMPLE_USERS[this.userCursor % SIMULATOR_SAMPLE_USERS.length]!;
    this.userCursor++;
    return picked;
  }

  public simulate(payload: SimRequestPayload): LiveEvent | LiveEvent[] {
    const rawUser = this.pickRandomUser(payload.user);
    const viewer = toViewer(rawUser);
    const now = Date.now();

    if (payload.type === 'gift') {
      const repeat = Math.max(1, payload.repeat ?? 1);
      const coinsEach = Math.max(1, payload.coins ?? 30);

      // Nếu giả lập quà dạng chuỗi (repeat > 1) hoặc yêu cầu qua normalizer
      if (repeat > 1 || payload.useComboWindow) {
        for (let i = 1; i < repeat; i++) {
          const intermediate: RawIncomingEvent = {
            type: 'gift',
            ...rawUser,
            giftId: 1,
            giftName: 'Hoa hồng',
            diamondCount: coinsEach,
            repeatCount: i,
            giftType: 1,
            repeatEnd: false,
            at: now,
          };
          this.normalizer.ingest(intermediate);
        }
        const finalRaw: RawIncomingEvent = {
          type: 'gift',
          ...rawUser,
          giftId: 1,
          giftName: 'Hoa hồng',
          diamondCount: coinsEach,
          repeatCount: repeat,
          giftType: repeat > 1 ? 1 : 0,
          repeatEnd: true,
          at: now,
        };
        if (payload.useComboWindow) {
          this.normalizer.ingest(finalRaw);
        } else {
          // Phát ngay sự kiện cuối của chuỗi để phản hồi tức thì khi bấm nút test
          const ev: LiveEvent = {
            type: 'gift',
            viewer,
            giftId: 1,
            giftName: 'Hoa hồng',
            coinsEach,
            repeatCount: repeat,
            totalCoins: coinsEach * repeat,
            at: now,
          };
          this.emitEvent(ev);
          return ev;
        }
      }

      const ev: LiveEvent = {
        type: 'gift',
        viewer,
        giftId: 1,
        giftName: 'Quà giả lập',
        coinsEach,
        repeatCount: repeat,
        totalCoins: coinsEach * repeat,
        at: now,
      };
      this.emitEvent(ev);
      return ev;
    }

    switch (payload.type) {
      case 'join': {
        const ev: LiveEvent = { type: 'join', viewer, at: now };
        this.emitEvent(ev);
        return ev;
      }
      case 'like': {
        const ev: LiveEvent = {
          type: 'like',
          viewer,
          count: Math.max(1, payload.count ?? 5),
          at: now,
        };
        this.emitEvent(ev);
        return ev;
      }
      case 'chat': {
        const ev: LiveEvent = {
          type: 'chat',
          viewer,
          text: payload.text ?? 'Bụt ơi',
          at: now,
        };
        this.emitEvent(ev);
        return ev;
      }
      case 'follow': {
        const ev: LiveEvent = { type: 'follow', viewer, at: now };
        this.emitEvent(ev);
        return ev;
      }
      case 'share': {
        const ev: LiveEvent = { type: 'share', viewer, at: now };
        this.emitEvent(ev);
        return ev;
      }
    }
  }

  public simulateBurst(payload: SimBurstPayload): { scheduled: number } {
    const n = Math.min(500, Math.max(1, payload.n || 10));
    const totalMs = Math.max(0, (payload.seconds ?? 0) * 1000);
    const stepMs = n > 1 ? Math.floor(totalMs / n) : 0;
    const sampleTierCoins = [5, 30, 50, 100, 300, 500, 3000];

    for (let i = 0; i < n; i++) {
      const delay = i * stepMs;
      const timer = setTimeout(() => {
        if (!this.connected && totalMs > 0) return;
        const baseUser =
          SIMULATOR_SAMPLE_USERS[i % SIMULATOR_SAMPLE_USERS.length]!;
        const burstUser = {
          userId: `${baseUser.userId}_b${i + 1}`,
          uniqueId: `${baseUser.uniqueId}_${i + 1}`,
          nickname:
            i < SIMULATOR_SAMPLE_USERS.length
              ? baseUser.nickname
              : `${baseUser.nickname} ${i + 1}`,
        };

        if (payload.kind === 'joins') {
          this.simulate({ type: 'join', user: burstUser });
        } else {
          const coins = sampleTierCoins[i % sampleTierCoins.length] ?? 30;
          this.simulate({ type: 'gift', user: burstUser, coins });
        }
      }, delay);
      if (totalMs === 0) {
        clearTimeout(timer);
        const baseUser =
          SIMULATOR_SAMPLE_USERS[i % SIMULATOR_SAMPLE_USERS.length]!;
        const burstUser = {
          userId: `${baseUser.userId}_b${i + 1}`,
          uniqueId: `${baseUser.uniqueId}_${i + 1}`,
          nickname:
            i < SIMULATOR_SAMPLE_USERS.length
              ? baseUser.nickname
              : `${baseUser.nickname} ${i + 1}`,
        };
        if (payload.kind === 'joins') {
          this.simulate({ type: 'join', user: burstUser });
        } else {
          const coins = sampleTierCoins[i % sampleTierCoins.length] ?? 30;
          this.simulate({ type: 'gift', user: burstUser, coins });
        }
      } else {
        this.burstTimers.push(timer);
      }
    }

    return { scheduled: n };
  }
}

export function registerSimRoutes(
  app: FastifyInstance,
  simulator: SimulatorSource,
): void {
  app.post<{ Body: SimRequestPayload }>('/sim', async (req) => {
    const ev = simulator.simulate(req.body);
    return { ok: true, event: ev };
  });

  app.post<{ Body: SimBurstPayload }>('/sim/burst', async (req) => {
    const res = simulator.simulateBurst(req.body);
    return { ok: true, ...res };
  });
}

