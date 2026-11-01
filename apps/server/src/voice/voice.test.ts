import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VoiceService } from './index.js';
import { VoiceCache } from './cache.js';
import { generateSyntheticVoiceBuffer, type TtsProvider } from './tts/types.js';

describe('T25 - VoiceService & Cache', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'but-oi-voice-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('synthesizes audio on first call and serves from cache on second call without calling provider', async () => {
    let synthCalls = 0;
    const mockProvider: TtsProvider = {
      name: 'fpt',
      async synth(text, _voice, speed) {
        synthCalls++;
        return generateSyntheticVoiceBuffer(text, speed);
      },
    };

    const cache = new VoiceCache(tempDir);
    const service = new VoiceService({ provider: mockProvider, cache });

    const r1 = await service.render('Bụt chúc Minh bình an dưới gốc đa.');
    expect(r1.fromCache).toBe(false);
    expect(r1.url).toMatch(/^\/voice\/[a-f0-9]{40}\.ogg$/);
    expect(r1.durationMs).toBeGreaterThan(800);
    expect(synthCalls).toBe(1);

    const r2 = await service.render('Bụt chúc Minh bình an dưới gốc đa.');
    expect(r2.fromCache).toBe(true);
    expect(r2.key).toBe(r1.key);
    expect(synthCalls).toBe(1);
  });
});

