import type { TtsProvider } from './tts/types.js';
import { FptTtsProvider } from './tts/fpt.js';
import { VbeeTtsProvider } from './tts/vbee.js';
import { ViettelTtsProvider } from './tts/viettel.js';
import { GoogleTtsProvider } from './tts/google.js';
import { VoiceCache } from './cache.js';
import { postProcessAudio } from './post.js';
import { getSettings } from '../config.js';

export type VoiceRenderResult = {
  url: string;
  key: string;
  durationMs: number;
  fromCache: boolean;
};

export function createTtsProvider(name = process.env.TTS_PROVIDER ?? 'fpt'): TtsProvider {
  switch (name) {
    case 'vbee':
      return new VbeeTtsProvider();
    case 'viettel':
      return new ViettelTtsProvider();
    case 'google':
      return new GoogleTtsProvider();
    case 'fpt':
    default:
      return new FptTtsProvider();
  }
}

export class VoiceService {
  private provider: TtsProvider;
  public readonly cache: VoiceCache;

  constructor(opts?: { provider?: TtsProvider; cache?: VoiceCache }) {
    this.provider = opts?.provider ?? createTtsProvider();
    this.cache = opts?.cache ?? new VoiceCache();
  }

  public async render(
    text: string,
    opts?: { voice?: string; speed?: number },
  ): Promise<VoiceRenderResult> {
    const cfg = getSettings();
    const voice = opts?.voice ?? cfg.ttsVoice ?? process.env.TTS_VOICE ?? 'banmai';
    const speed = opts?.speed ?? cfg.ttsSpeed ?? Number(process.env.TTS_SPEED ?? 0.85);
    const cleanText = text.replace(/\{ten(_\d)?\}/g, 'con').trim();

    const key = this.cache.computeKey(this.provider.name, voice, speed, cleanText);
    const cached = this.cache.get(key);
    if (cached) {
      return {
        url: `/voice/${key}.ogg`,
        key,
        durationMs: cached.durationMs,
        fromCache: true,
      };
    }

    const rawBuf = await this.provider.synth(cleanText, voice, speed);
    const processed = await postProcessAudio(rawBuf, { text: cleanText });
    this.cache.set(key, processed.buffer, processed.durationMs);

    return {
      url: `/voice/${key}.ogg`,
      key,
      durationMs: processed.durationMs,
      fromCache: false,
    };
  }
}

export const defaultVoiceService = new VoiceService();

