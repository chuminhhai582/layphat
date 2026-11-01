import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VisitQueue } from './queue.js';
import { VisitPreparer } from './preparer.js';
import { Repo, setRepo } from '../db/repo.js';
import { VoiceService } from '../voice/index.js';
import { VoiceCache } from '../voice/cache.js';
import type { TtsProvider } from '../voice/tts/types.js';
import type { Viewer, Visit } from '@but-oi/shared';

function makeViewer(id: string): Viewer {
  return {
    userId: id,
    uniqueId: id,
    nickname: `Dân làng ${id}`,
    displayName: `Dân làng ${id}`,
    avatarSeed: 1,
  };
}

describe('T26 - VisitPreparer', () => {
  let repo: Repo;
  let tempDir: string;

  beforeEach(() => {
    repo = new Repo(':memory:');
    setRepo(repo);
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'but-oi-prep-'));
  });

  afterEach(() => {
    setRepo(null);
    repo.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('never emits visit:start before blessing and audio are ready, and still runs when TTS fails', async () => {
    const queue = new VisitQueue();
    const failingProvider: TtsProvider = {
      name: 'fpt',
      async synth() {
        throw new Error('TTS service down');
      },
    };
    const voice = new VoiceService({
      provider: failingProvider,
      cache: new VoiceCache(tempDir),
    });

    const started: Visit[] = [];
    const preparer = new VisitPreparer({
      queue,
      repo,
      voice,
      skipGraceDelay: true,
    });
    preparer.onVisitStart((v) => started.push(v));

    // Enqueue 10 gifts rapidly
    for (let i = 1; i <= 10; i++) {
      queue.enqueue(makeViewer(`u${i}`), 50, i * 10);
    }

    // Wait for async preparation
    await new Promise((r) => setTimeout(r, 100));

    expect(started.length).toBe(1);
    const first = started[0]!;
    expect(first.blessing).toBeDefined();
    expect(first.blessing?.text.length).toBeGreaterThan(5);
    // Because TTS failed and no bank audio exists, fallback is subtitle-only (audioUrl = '', durationMs >= 1500)
    expect(first.blessing?.audioUrl).toBe('');
    expect(first.blessing?.durationMs).toBeGreaterThanOrEqual(1500);

    preparer.dispose();
  });
});

