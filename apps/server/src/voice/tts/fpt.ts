import { generateSyntheticVoiceBuffer, type TtsProvider } from './types.js';

export class FptTtsProvider implements TtsProvider {
  public readonly name = 'fpt';
  private apiKey: string;

  constructor(apiKey = process.env.TTS_API_KEY ?? '') {
    this.apiKey = apiKey.trim();
  }

  public async synth(text: string, voice: string, speed: number): Promise<Buffer> {
    if (!this.apiKey) {
      return generateSyntheticVoiceBuffer(text, speed);
    }

    const mappedSpeed = String(Math.round((speed - 1) * 3));
    const res = await fetch('https://api.fpt.ai/hmi/tts/v5', {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        voice: voice || 'leminh',
        speed: mappedSpeed,
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: text,
    });

    if (!res.ok) {
      throw new Error(`FPT.AI TTS HTTP ${res.status}`);
    }

    const json = (await res.json()) as { async?: string; error?: number; message?: string };
    if (!json.async) {
      throw new Error(`FPT.AI TTS error: ${json.message ?? 'missing async url'}`);
    }

    // FPT.AI trả URL file audio bất đồng bộ, thử tải tối đa 5 lần
    for (let attempt = 0; attempt < 5; attempt++) {
      const audioRes = await fetch(json.async);
      if (audioRes.ok) {
        const arr = await audioRes.arrayBuffer();
        return Buffer.from(arr);
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    throw new Error('FPT.AI TTS audio download timeout');
  }
}

