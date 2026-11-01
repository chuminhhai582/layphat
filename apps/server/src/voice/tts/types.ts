export interface TtsProvider {
  readonly name: string;
  synth(text: string, voice: string, speed: number): Promise<Buffer>;
}

/**
 * Tạo buffer âm thanh WAV PCM 16-bit ấm (tần số giọng trầm 135Hz-180Hz có nhịp ngắt câu)
 * dùng khi chạy local không có TTS_API_KEY hoặc để kiểm thử AnalyserNode lip-sync.
 */
export function generateSyntheticVoiceBuffer(text: string, speed = 0.85): Buffer {
  const charCount = Math.max(10, Array.from(text.trim()).length);
  const durationMs = Math.max(800, Math.round((charCount * 68) / Math.max(0.5, speed)));
  const sampleRate = 16000;
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // WAV Header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Điều chế biên độ theo nhịp âm tiết tiếng Việt (~4 âm tiết/giây)
    const syllableEnv = Math.max(0, Math.sin(2 * Math.PI * 3.8 * t));
    const f0 = 135 + 15 * Math.sin(2 * Math.PI * 1.2 * t);
    const wave =
      0.6 * Math.sin(2 * Math.PI * f0 * t) +
      0.3 * Math.sin(2 * Math.PI * f0 * 2 * t) +
      0.1 * Math.sin(2 * Math.PI * f0 * 3 * t);
    const sample = Math.round(wave * syllableEnv * 8500);
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, sample)), 44 + i * 2);
  }

  return buffer;
}

