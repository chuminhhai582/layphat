import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

export type CachedVoiceMeta = {
  key: string;
  filePath: string;
  durationMs: number;
};

export class VoiceCache {
  public readonly cacheDir: string;

  constructor(cacheDir = path.resolve(process.cwd(), 'data/voice')) {
    this.cacheDir = cacheDir;
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  public computeKey(
    provider: string,
    voice: string,
    speed: number,
    text: string,
  ): string {
    return crypto
      .createHash('sha1')
      .update(`${provider}|${voice}|${speed}|${text.trim()}`)
      .digest('hex');
  }

  public getFilePath(key: string): string {
    return path.join(this.cacheDir, `${key}.ogg`);
  }

  public getMetaPath(key: string): string {
    return path.join(this.cacheDir, `${key}.json`);
  }

  public get(key: string): { buffer: Buffer; durationMs: number; filePath: string } | null {
    const filePath = this.getFilePath(key);
    if (!fs.existsSync(filePath)) return null;

    try {
      const now = new Date();
      fs.utimesSync(filePath, now, now);
      const buffer = fs.readFileSync(filePath);
      const metaPath = this.getMetaPath(key);
      let durationMs = Math.max(800, Math.round(buffer.length / 32));
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as { durationMs?: number };
        if (meta.durationMs) durationMs = meta.durationMs;
      }
      return { buffer, durationMs, filePath };
    } catch {
      return null;
    }
  }

  public set(key: string, buffer: Buffer, durationMs: number): string {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    const filePath = this.getFilePath(key);
    const metaPath = this.getMetaPath(key);
    fs.writeFileSync(filePath, buffer);
    fs.writeFileSync(metaPath, JSON.stringify({ durationMs, updatedAt: Date.now() }));
    return filePath;
  }

  /**
   * Xóa các file cache không dùng quá maxAgeMs (trừ danh sách key thuộc câu kho).
   */
  public pruneOldFiles(maxAgeMs = 30 * 24 * 60 * 60 * 1000, protectedKeys = new Set<string>(), now = Date.now()): number {
    if (!fs.existsSync(this.cacheDir)) return 0;
    let removed = 0;
    const files = fs.readdirSync(this.cacheDir);
    for (const file of files) {
      if (!file.endsWith('.ogg')) continue;
      const key = file.slice(0, -4);
      if (protectedKeys.has(key)) continue;

      const fullPath = path.join(this.cacheDir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (now - stat.mtimeMs > maxAgeMs) {
          fs.unlinkSync(fullPath);
          const metaPath = this.getMetaPath(key);
          if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
          removed++;
        }
      } catch {
        // ignore
      }
    }
    return removed;
  }
}

export function registerVoiceRoutes(app: FastifyInstance, cache: VoiceCache): void {
  app.get<{ Params: { file: string } }>('/voice/:file', async (req, reply) => {
    const rawFile = req.params.file;
    const key = rawFile.endsWith('.ogg') ? rawFile.slice(0, -4) : rawFile;
    if (!/^[a-f0-9]{40}$/i.test(key)) {
      return reply.code(404).send({ error: 'Not found' });
    }
    const hit = cache.get(key);
    if (!hit) {
      return reply.code(404).send({ error: 'Voice not found' });
    }
    const isWav =
      hit.buffer.length >= 12 &&
      hit.buffer.toString('ascii', 0, 4) === 'RIFF' &&
      hit.buffer.toString('ascii', 8, 12) === 'WAVE';
    reply.header('Content-Type', isWav ? 'audio/wav' : 'audio/ogg');
    reply.header('Cache-Control', 'public, max-age=86400');
    return reply.send(hit.buffer);
  });
}

