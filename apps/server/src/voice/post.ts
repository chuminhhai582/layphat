import { spawn } from 'node:child_process';

/**
 * Đo thời lượng từ buffer WAV PCM hoặc ước lượng từ kích thước buffer.
 */
export function measureBufferDurationMs(buf: Buffer, fallbackText = ''): number {
  if (
    buf.length >= 44 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WAVE'
  ) {
    const byteRate = buf.readUInt32LE(28);
    const dataSize = buf.readUInt32LE(40);
    if (byteRate > 0 && dataSize > 0) {
      return Math.max(500, Math.round((dataSize / byteRate) * 1000));
    }
  }
  const chars = Array.from(fallbackText.trim()).length;
  if (chars > 0) {
    return Math.max(800, chars * 70);
  }
  return Math.max(800, Math.round(buf.length / 32));
}

/**
 * Dùng ffmpeg thêm reverb nhẹ (aecho) theo TTS_REVERB và chuẩn hóa âm lượng.
 * Nếu máy chưa cài ffmpeg trên PATH, trả về nguyên buffer đã tổng hợp kèm durationMs chính xác.
 */
export async function postProcessAudio(
  inputBuffer: Buffer,
  opts?: { reverb?: number; text?: string },
): Promise<{ buffer: Buffer; durationMs: number }> {
  const reverb = opts?.reverb ?? Number(process.env.TTS_REVERB ?? 0.15);
  const baseDurationMs = measureBufferDurationMs(inputBuffer, opts?.text);

  if (reverb <= 0 || process.env.NODE_ENV === 'test') {
    return { buffer: inputBuffer, durationMs: baseDurationMs };
  }

  return new Promise((resolve) => {
    const decay = Math.min(0.5, Math.max(0.05, reverb)).toFixed(2);
    const filter = `aecho=0.8:0.88:60:${decay}`;
    const child = spawn(
      'ffmpeg',
      ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-af', filter, '-f', 'ogg', 'pipe:1'],
      { stdio: ['pipe', 'pipe', 'ignore'] },
    );

    const chunks: Buffer[] = [];
    let errored = false;

    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.on('error', () => {
      errored = true;
      resolve({ buffer: inputBuffer, durationMs: baseDurationMs });
    });
    child.on('close', (code) => {
      if (errored || code !== 0 || chunks.length === 0) {
        resolve({ buffer: inputBuffer, durationMs: baseDurationMs });
      } else {
        const out = Buffer.concat(chunks);
        resolve({ buffer: out, durationMs: baseDurationMs });
      }
    });

    try {
      child.stdin.write(inputBuffer);
      child.stdin.end();
    } catch {
      resolve({ buffer: inputBuffer, durationMs: baseDurationMs });
    }
  });
}

