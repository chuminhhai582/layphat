import type {
  LiveEvent,
  SourceName,
  SourceStatusInfo,
  SourceStatusState,
} from '@but-oi/shared';
import { SimulatorSource } from './simulator.js';
import { TikTokConnectorSource } from './tiktokConnector.js';
import { TikFinitySource } from './tikfinity.js';

export interface EventSource {
  readonly name: SourceName;
  connect(): Promise<void>;
  disconnect(): void;
  on(handler: (e: LiveEvent) => void): void;
  onStatus(handler: (s: SourceStatusState, detail?: string) => void): void;
}

export async function connectWithRetry(
  src: EventSource,
  opts?: {
    signal?: { aborted: boolean };
    sleepFn?: (ms: number) => Promise<void>;
    onRetry?: (delayMs: number, err: unknown) => void;
  },
): Promise<void> {
  const sleep =
    opts?.sleepFn ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  let delay = 2000;
  for (;;) {
    if (opts?.signal?.aborted) return;
    try {
      await src.connect();
      delay = 2000;
      return;
    } catch (err) {
      if (opts?.signal?.aborted) return;
      opts?.onRetry?.(delay, err);
      await sleep(delay);
      delay = Math.min(delay * 2, 30000);
    }
  }
}

export class SourceManager {
  private sources: Record<SourceName, EventSource>;
  private activeSource: EventSource;
  private abortToken = { aborted: false };
  private eventHandlers: Array<(e: LiveEvent) => void> = [];
  private statusHandlers: Array<(info: SourceStatusInfo) => void> = [];
  private currentStatus: SourceStatusInfo;

  constructor(customSources?: Partial<Record<SourceName, EventSource>>, initialSource?: SourceName) {
    const sim = (customSources?.simulator as SimulatorSource | undefined) ?? new SimulatorSource();
    const conn = customSources?.connector ?? new TikTokConnectorSource();
    const tf = customSources?.tikfinity ?? new TikFinitySource();

    this.sources = {
      simulator: sim,
      connector: conn,
      tikfinity: tf,
    };

    const chosenName =
      initialSource ??
      ((process.env.EVENT_SOURCE as SourceName | undefined) || 'simulator');
    this.activeSource = this.sources[chosenName] ?? sim;
    this.currentStatus = {
      source: this.activeSource.name,
      status: 'offline',
      updatedAt: Date.now(),
    };

    for (const src of Object.values(this.sources)) {
      src.on((ev) => {
        // Luôn cho phép simulator bắn sự kiện thử nghiệm hoặc nguồn đang active
        if (src === this.activeSource || src.name === 'simulator') {
          for (const h of this.eventHandlers) {
            h(ev);
          }
        }
      });

      src.onStatus((state, detail) => {
        if (src === this.activeSource) {
          this.currentStatus = {
            source: src.name,
            status: state,
            detail,
            updatedAt: Date.now(),
          };
          for (const h of this.statusHandlers) {
            h(this.currentStatus);
          }
        }
      });
    }
  }

  public getSimulator(): SimulatorSource {
    return this.sources.simulator as SimulatorSource;
  }

  public getStatus(): SourceStatusInfo {
    return { ...this.currentStatus };
  }

  public onEvent(handler: (e: LiveEvent) => void): void {
    this.eventHandlers.push(handler);
  }

  public onStatus(handler: (info: SourceStatusInfo) => void): void {
    this.statusHandlers.push(handler);
  }

  public async start(): Promise<void> {
    this.abortToken = { aborted: false };
    await connectWithRetry(this.activeSource, { signal: this.abortToken });
  }

  public async switchSource(name: SourceName): Promise<SourceStatusInfo> {
    const target = this.sources[name];
    if (!target) {
      throw new Error(`Nguồn sự kiện không hợp lệ: ${name}`);
    }
    this.abortToken.aborted = true;
    this.activeSource.disconnect();

    this.activeSource = target;
    this.abortToken = { aborted: false };
    this.currentStatus = {
      source: target.name,
      status: 'connecting',
      updatedAt: Date.now(),
    };
    for (const h of this.statusHandlers) {
      h(this.currentStatus);
    }

    void connectWithRetry(this.activeSource, { signal: this.abortToken });
    return this.getStatus();
  }

  public stop(): void {
    this.abortToken.aborted = true;
    this.activeSource.disconnect();
  }
}

