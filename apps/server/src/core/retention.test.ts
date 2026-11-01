import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DataRetentionManager } from './retention.js';
import { Repo, setRepo } from '../db/repo.js';
import { VoiceService } from '../voice/index.js';
import { VoiceCache } from '../voice/cache.js';

describe('T37 - DataRetentionManager', () => {
  let repo: Repo;
  let tempDir: string;
  let logsDir: string;
  let voiceDir: string;

  beforeEach(() => {
    vi.useFakeTimers();
    repo = new Repo(':memory:');
    setRepo(repo);
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'but-oi-retention-'));
    logsDir = path.join(tempDir, 'logs');
    voiceDir = path.join(tempDir, 'voice');
    fs.mkdirSync(logsDir, { recursive: true });
    fs.mkdirSync(voiceDir, { recursive: true });
  });

  afterEach(() => {
    setRepo(null);
    repo.close();
    vi.useRealTimers();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('deletes wishes older than 24h, logs older than 14d, and non-bank voice cache older than 30d', () => {
    const now = 1_700_000_000_000;
    vi.setSystemTime(now);

    // Old wish (25h ago) vs recent wish (2h ago)
    repo.addWish('u_old', 'ước cũ 25h', now - 25 * 3600 * 1000);
    repo.addWish('u_new', 'ước mới 2h', now - 2 * 3600 * 1000);

    // Old log (15 days ago) vs recent log (1 day ago)
    const oldLog = path.join(logsDir, '2026-10-01.log');
    const newLog = path.join(logsDir, '2026-10-30.log');
    fs.writeFileSync(oldLog, 'old log');
    fs.writeFileSync(newLog, 'new log');
    const oldLogDate = new Date(now - 15 * 24 * 3600 * 1000);
    fs.utimesSync(oldLog, oldLogDate, oldLogDate);

    // Voice cache: 1 bank key (35d old, protected) + 1 custom key (35d old, should be deleted)
    const cache = new VoiceCache(voiceDir);
    const bankKey = 'a'.repeat(40);
    const customKey = 'b'.repeat(40);
    cache.set(bankKey, Buffer.from('bank_audio'), 2000);
    cache.set(customKey, Buffer.from('custom_audio'), 2000);
    const oldVoiceDate = new Date(now - 35 * 24 * 3600 * 1000);
    fs.utimesSync(cache.getFilePath(bankKey), oldVoiceDate, oldVoiceDate);
    fs.utimesSync(cache.getFilePath(customKey), oldVoiceDate, oldVoiceDate);

    repo.upsertBlessing({
      category: 'binh_an',
      length: 'full',
      text: 'Bụt chúc {ten} bình an.',
      audio_path: `/voice/${bankKey}.ogg`,
    });

    const voice = new VoiceService({ cache });
    const manager = new DataRetentionManager({ repo, voice, logsDir });

    const res = manager.runOnce(now);
    expect(res.deletedWishes).toBe(1);
    expect(res.deletedLogs).toBe(1);
    expect(res.deletedVoices).toBe(1);

    expect(repo.latestWish('u_old', 48 * 3600 * 1000, now)).toBeNull();
    expect(repo.latestWish('u_new', 48 * 3600 * 1000, now)).not.toBeNull();
    expect(fs.existsSync(oldLog)).toBe(false);
    expect(fs.existsSync(newLog)).toBe(true);
    expect(fs.existsSync(cache.getFilePath(bankKey))).toBe(true);
    expect(fs.existsSync(cache.getFilePath(customKey))).toBe(false);
  });
});

