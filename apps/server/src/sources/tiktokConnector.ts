import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';
import type { LiveEvent, SourceStatusState } from '@but-oi/shared';
import { EventNormalizer } from '../core/normalizer.js';
import type { EventSource } from './index.js';

function toRecord(val: unknown): Record<string, unknown> {
  if (val && typeof val === 'object') {
    return val as Record<string, unknown>;
  }
  return {};
}

function extractUser(data: Record<string, unknown>): {
  userId: string;
  uniqueId: string;
  nickname: string;
} {
  const userObj = toRecord(data.user);
  const userId = String(userObj.userId ?? data.userId ?? userObj.uniqueId ?? data.uniqueId ?? 'anon');
  const uniqueId = String(userObj.uniqueId ?? data.uniqueId ?? '');
  const nickname = String(userObj.nickname ?? data.nickname ?? uniqueId);
  return { userId, uniqueId, nickname };
}

export class TikTokConnectorSource implements EventSource {
  public readonly name = 'connector' as const;
  private username: string;
  private connection: TikTokLiveConnection | null = null;
  private normalizer: EventNormalizer;
  private eventHandlers: Array<(e: LiveEvent) => void> = [];
  private statusHandlers: Array<(s: SourceStatusState, detail?: string) => void> = [];

  constructor(username = process.env.TIKTOK_USERNAME ?? '', normalizer?: EventNormalizer) {
    this.username = username.trim();
    this.normalizer = normalizer ?? new EventNormalizer();
    this.normalizer.onEvent((e) => {
      for (const fn of this.eventHandlers) {
        fn(e);
      }
    });
  }

  public async connect(): Promise<void> {
    if (!this.username) {
      this.emitStatus('error', 'Thiếu TIKTOK_USERNAME');
      throw new Error('Thiếu TIKTOK_USERNAME cho TikTok-Live-Connector');
    }

    this.emitStatus('connecting', `Đang kết nối @${this.username}`);
    const conn = new TikTokLiveConnection(this.username, {
      processInitialData: false,
    });
    this.connection = conn;

    conn.on(WebcastEvent.MEMBER, (raw: unknown) => {
      const data = toRecord(raw);
      const u = extractUser(data);
      this.normalizer.ingest({
        type: 'join',
        userId: u.userId,
        uniqueId: u.uniqueId,
        nickname: u.nickname,
      });
    });

    conn.on(WebcastEvent.LIKE, (raw: unknown) => {
      const data = toRecord(raw);
      const u = extractUser(data);
      this.normalizer.ingest({
        type: 'like',
        userId: u.userId,
        uniqueId: u.uniqueId,
        nickname: u.nickname,
        count: Number(data.likeCount ?? 1),
      });
    });

    conn.on(WebcastEvent.CHAT, (raw: unknown) => {
      const data = toRecord(raw);
      const u = extractUser(data);
      this.normalizer.ingest({
        type: 'chat',
        userId: u.userId,
        uniqueId: u.uniqueId,
        nickname: u.nickname,
        text: String(data.comment ?? ''),
      });
    });

    conn.on(WebcastEvent.FOLLOW, (raw: unknown) => {
      const data = toRecord(raw);
      const u = extractUser(data);
      this.normalizer.ingest({
        type: 'follow',
        userId: u.userId,
        uniqueId: u.uniqueId,
        nickname: u.nickname,
      });
    });

    conn.on(WebcastEvent.SHARE, (raw: unknown) => {
      const data = toRecord(raw);
      const u = extractUser(data);
      this.normalizer.ingest({
        type: 'share',
        userId: u.userId,
        uniqueId: u.uniqueId,
        nickname: u.nickname,
      });
    });

    conn.on(WebcastEvent.GIFT, (raw: unknown) => {
      const data = toRecord(raw);
      const u = extractUser(data);
      const giftDetails = toRecord(data.giftDetails);
      this.normalizer.ingest({
        type: 'gift',
        userId: u.userId,
        uniqueId: u.uniqueId,
        nickname: u.nickname,
        giftId: Number(data.giftId ?? 1),
        giftName: String(giftDetails.giftName ?? data.giftName ?? 'Gift'),
        diamondCount: Number(giftDetails.diamondCount ?? data.diamondCount ?? 1),
        repeatCount: Number(data.repeatCount ?? 1),
        giftType: Number(giftDetails.giftType ?? data.giftType ?? 0),
        repeatEnd: Boolean(data.repeatEnd),
      });
    });

    conn.on(WebcastEvent.STREAM_END, () => {
      this.emitStatus('offline', 'Phiên live đã kết thúc');
    });

    conn.on(ControlEvent.DISCONNECTED, () => {
      this.emitStatus('offline', 'Mất kết nối tới TikTok LIVE');
    });

    conn.on(ControlEvent.ERROR, (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      this.emitStatus('error', msg);
    });

    try {
      await conn.connect();
      this.emitStatus('live', `Đang nghe @${this.username}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.emitStatus('offline', msg);
      throw err;
    }
  }

  public disconnect(): void {
    if (this.connection) {
      try {
        this.connection.disconnect();
      } catch {
        // ignore disconnect errors
      }
      this.connection = null;
    }
    this.emitStatus('offline', 'Đã ngắt kết nối TikTok-Live-Connector');
  }

  public on(handler: (e: LiveEvent) => void): void {
    this.eventHandlers.push(handler);
  }

  public onStatus(handler: (s: SourceStatusState, detail?: string) => void): void {
    this.statusHandlers.push(handler);
  }

  private emitStatus(s: SourceStatusState, detail?: string): void {
    for (const fn of this.statusHandlers) {
      fn(s, detail);
    }
  }
}
