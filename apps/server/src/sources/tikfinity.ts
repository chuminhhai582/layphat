import WebSocket from 'ws';
import type { LiveEvent, SourceStatusState } from '@but-oi/shared';
import { EventNormalizer } from '../core/normalizer.js';
import type { EventSource } from './index.js';

export class TikFinitySource implements EventSource {
  public readonly name = 'tikfinity' as const;
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private normalizer: EventNormalizer;
  private eventHandlers: Array<(e: LiveEvent) => void> = [];
  private statusHandlers: Array<(s: SourceStatusState, detail?: string) => void> = [];

  constructor(
    wsUrl = process.env.TIKFINITY_WS ?? 'ws://127.0.0.1:21213',
    normalizer?: EventNormalizer,
  ) {
    this.wsUrl = wsUrl;
    this.normalizer = normalizer ?? new EventNormalizer();
    this.normalizer.onEvent((e) => {
      for (const fn of this.eventHandlers) {
        fn(e);
      }
    });
  }

  public async connect(): Promise<void> {
    this.emitStatus('connecting', `Đang kết nối TikFinity (${this.wsUrl})`);

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const socket = new WebSocket(this.wsUrl);
      this.ws = socket;

      socket.on('open', () => {
        settled = true;
        this.emitStatus('live', 'Đã kết nối TikFinity');
        resolve();
      });

      socket.on('message', (rawBuf) => {
        this.handleRawMessage(rawBuf.toString());
      });

      socket.on('close', () => {
        this.emitStatus('offline', 'TikFinity đã đóng kết nối');
        if (!settled) {
          settled = true;
          reject(new Error('TikFinity WebSocket đóng khi đang kết nối'));
        }
      });

      socket.on('error', (err) => {
        this.emitStatus('offline', `Không kết nối được TikFinity: ${err.message}`);
        if (!settled) {
          settled = true;
          reject(err);
        }
      });
    });
  }

  public handleRawMessage(jsonStr: string): void {
    let parsed: { event?: string; data?: Record<string, unknown> };
    try {
      parsed = JSON.parse(jsonStr) as { event?: string; data?: Record<string, unknown> };
    } catch {
      return;
    }

    const evName = (parsed.event ?? '').toLowerCase();
    const d = parsed.data ?? {};
    const userId = String(d.userId ?? d.uniqueId ?? 'anon');
    const uniqueId = String(d.uniqueId ?? userId);
    const nickname = String(d.nickname ?? uniqueId);

    switch (evName) {
      case 'member':
      case 'join':
        this.normalizer.ingest({ type: 'join', userId, uniqueId, nickname });
        break;
      case 'like':
        this.normalizer.ingest({
          type: 'like',
          userId,
          uniqueId,
          nickname,
          count: Number(d.likeCount ?? d.count ?? 1),
        });
        break;
      case 'chat':
      case 'comment':
        this.normalizer.ingest({
          type: 'chat',
          userId,
          uniqueId,
          nickname,
          text: String(d.comment ?? d.text ?? ''),
        });
        break;
      case 'follow':
        this.normalizer.ingest({ type: 'follow', userId, uniqueId, nickname });
        break;
      case 'share':
        this.normalizer.ingest({ type: 'share', userId, uniqueId, nickname });
        break;
      case 'gift':
        this.normalizer.ingest({
          type: 'gift',
          userId,
          uniqueId,
          nickname,
          giftId: Number(d.giftId ?? 1),
          giftName: String(d.giftName ?? 'Gift'),
          diamondCount: Number(d.diamondCount ?? d.coins ?? 1),
          repeatCount: Number(d.repeatCount ?? 1),
          giftType: Number(d.giftType ?? 0),
          repeatEnd: d.repeatEnd === undefined ? true : Boolean(d.repeatEnd),
        });
        break;
      default:
        break;
    }
  }

  public disconnect(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.emitStatus('offline', 'Đã ngắt kết nối TikFinity');
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

