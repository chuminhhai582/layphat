import fs from 'node:fs';
import path from 'node:path';
import { getRepo, type Repo } from '../db/repo.js';
import { defaultVoiceService, type VoiceService } from '../voice/index.js';

export class DataRetentionManager {
  private repo: Repo;
  private voice: VoiceService;
  private logsDir: string;
  private timer: ReturnType<typeof setInterval> | null = null;

  public static readonly WISH_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 giờ
  public static readonly LOG_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 ngày
  public static readonly VOICE_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 ngày
  public static readonly JOB_INTERVAL_MS = 60 * 60 * 1000; // Mỗi 1 giờ

  constructor(opts?: {
    repo?: Repo;
    voice?: VoiceService;
    logsDir?: string;
  }) {
    this.repo = opts?.repo ?? getRepo();
    this.voice = opts?.voice ?? defaultVoiceService;
    this.logsDir = opts?.logsDir ?? path.resolve(process.cwd(), 'logs');
  }

  public runOnce(now = Date.now()): {
    deletedWishes: number;
    deletedLogs: number;
    deletedVoices: number;
  } {
    // 1. Xóa lời ước cũ hơn 24 giờ
    const deletedWishes = this.repo.deleteExpiredWishes(
      DataRetentionManager.WISH_MAX_AGE_MS,
      now,
    );

    // 2. Xoay log giữ 14 ngày
    let deletedLogs = 0;
    if (fs.existsSync(this.logsDir)) {
      const files = fs.readdirSync(this.logsDir);
      for (const file of files) {
        if (!file.endsWith('.log')) continue;
        const fullPath = path.join(this.logsDir, file);
        try {
          const stat = fs.statSync(fullPath);
          if (now - stat.mtimeMs > DataRetentionManager.LOG_MAX_AGE_MS) {
            fs.unlinkSync(fullPath);
            deletedLogs++;
          }
        } catch {
          // ignore
        }
      }
    }

    // 3. Dọn cache giọng đọc không dùng quá 30 ngày (trừ câu kho)
    const protectedKeys = new Set<string>();
    for (const b of this.repo.listBlessings()) {
      if (b.audio_path) {
        const match = b.audio_path.match(/\/voice\/([a-f0-9]{40})\.ogg/i);
        if (match?.[1]) {
          protectedKeys.add(match[1]);
        }
      }
    }
    const deletedVoices = this.voice.cache.pruneOldFiles(
      DataRetentionManager.VOICE_CACHE_MAX_AGE_MS,
      protectedKeys,
      now,
    );

    return { deletedWishes, deletedLogs, deletedVoices };
  }

  public start(): void {
    this.stop();
    this.runOnce(Date.now());
    this.timer = setInterval(() => {
      this.runOnce(Date.now());
    }, DataRetentionManager.JOB_INTERVAL_MS);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

