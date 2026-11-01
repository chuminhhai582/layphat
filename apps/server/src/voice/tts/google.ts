import { generateSyntheticVoiceBuffer, type TtsProvider } from './types.js';

export class GoogleTtsProvider implements TtsProvider {
  public readonly name = 'google';
  private apiKey: string;

  constructor(apiKey = process.env.TTS_API_KEY ?? '') {
    this.apiKey = apiKey.trim();
  }

  public async synth(text: string, _voice: string, speed: number): Promise<Buffer> {
    if (!this.apiKey) {
      return generateSyntheticVoiceBuffer(text, speed);
    }
    return generateSyntheticVoiceBuffer(text, speed);
  }
}

