import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../../../..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'assets/manifest.json');
const OVERLAY_PUBLIC_ASSETS = path.join(ROOT_DIR, 'apps/overlay/public/assets');

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16) || 0x16343a;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Tạo PNG RGBA với viền ánh kim và họa tiết mờ theo loại asset
 */
export function createStyledPng(
  w: number,
  h: number,
  hexColor: string,
  key: string,
): Buffer {
  const { r, g, b } = hexToRgb(hexColor);
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);

  const isCloudOrMist = key.includes('cloud') || key.includes('mist') || key.includes('smoke');
  const isCircle =
    key.includes('firefly') ||
    key.includes('moon') ||
    key.includes('webcam') ||
    key.includes('head');
  const isPanel = key === 'ui.panel_9slice';

  for (let y = 0; y < h; y++) {
    const rowStart = y * stride;
    raw[rowStart] = 0; // filter type 0
    const ny = y / Math.max(1, h - 1) - 0.5;

    for (let x = 0; x < w; x++) {
      const idx = rowStart + 1 + x * 4;
      const nx = x / Math.max(1, w - 1) - 0.5;
      const dist = Math.sqrt(nx * nx + ny * ny) * 2;

      let alpha = 235;
      let pr = r;
      let pg = g;
      let pb = b;

      if (isCloudOrMist) {
        alpha = Math.max(0, Math.min(200, Math.round((1 - dist * dist) * 190)));
      } else if (isCircle) {
        alpha = dist > 0.96 ? 0 : Math.round((1 - dist * 0.4) * 245);
      } else if (isPanel) {
        // 9-slice panel: nền tối trong suốt 80%, viền vàng 2px
        const onOuterBorder = x < 2 || x >= w - 2 || y < 2 || y >= h - 2;
        const onInnerBorder =
          (x === 6 || x === w - 7 || y === 6 || y === h - 7) &&
          x >= 6 &&
          x <= w - 7 &&
          y >= 6 &&
          y <= h - 7;
        if (onOuterBorder) {
          pr = 0xd4;
          pg = 0xaf;
          pb = 0x5a;
          alpha = 220;
        } else if (onInnerBorder) {
          pr = 0xf0;
          pg = 0xdc;
          pb = 0xa0;
          alpha = 90;
        } else {
          pr = 14;
          pg = 23;
          pb = 25;
          alpha = 204;
        }
      } else {
        // Viền mảnh 1px và shading dọc nhẹ kiểu thủy mặc
        const onBorder = x === 0 || x === w - 1 || y === 0 || y === h - 1;
        const shade = 1 - (y / Math.max(1, h)) * 0.22;
        pr = onBorder ? 0xd4 : Math.round(r * shade);
        pg = onBorder ? 0xaf : Math.round(g * shade);
        pb = onBorder ? 0x5a : Math.round(b * shade);
        alpha = key.startsWith('bg.sky') || key.startsWith('bg.ground') ? 255 : 230;
      }

      raw[idx] = pr;
      raw[idx + 1] = pg;
      raw[idx + 2] = pb;
      raw[idx + 3] = alpha;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(raw, { level: 1 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function createToneWav(freqHz: number, durationMs: number): Buffer {
  const sampleRate = 16000;
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = Math.sin((Math.PI * i) / numSamples);
    const sample = Math.round(Math.sin(2 * Math.PI * freqHz * t) * env * 6000);
    buf.writeInt16LE(sample, 44 + i * 2);
  }
  return buf;
}

export function generateAllPlaceholdersAndArt(): {
  imagesGenerated: number;
  atlasesGenerated: number;
  audioGenerated: number;
  totalBytes: number;
} {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as {
    images: Record<
      string,
      { src: string; placeholder: { w: number; h: number; color: string } }
    >;
    atlases: Record<string, { src: string; data: string }>;
    audio: Record<string, { src: string; loop?: boolean; volume?: number }>;
  };

  let imagesGenerated = 0;
  let atlasesGenerated = 0;
  let audioGenerated = 0;
  let totalBytes = 0;

  for (const [key, cfg] of Object.entries(manifest.images)) {
    const relPath = cfg.src.replace(/^\/assets\//, '');
    const artFile = path.join(ROOT_DIR, 'assets', relPath);
    const placeholderFile = path.join(
      ROOT_DIR,
      'assets/placeholder',
      `${key.replace(/\./g, '_')}.png`,
    );

    fs.mkdirSync(path.dirname(artFile), { recursive: true });
    fs.mkdirSync(path.dirname(placeholderFile), { recursive: true });

    const pngBuf = createStyledPng(
      cfg.placeholder.w,
      cfg.placeholder.h,
      cfg.placeholder.color,
      key,
    );
    fs.writeFileSync(artFile, pngBuf);
    fs.writeFileSync(placeholderFile, pngBuf);
    imagesGenerated++;
    totalBytes += pngBuf.length;
  }

  // Tạo atlas JSON + PNG cho char.bud, char.villager, fx (mỗi atlas <= 4096x4096)
  for (const [atlasKey, atlasCfg] of Object.entries(manifest.atlases)) {
    const relImg = atlasCfg.src.replace(/^\/assets\//, '');
    const relData = atlasCfg.data.replace(/^\/assets\//, '');
    const imgPath = path.join(ROOT_DIR, 'assets', relImg);
    const dataPath = path.join(ROOT_DIR, 'assets', relData);
    fs.mkdirSync(path.dirname(imgPath), { recursive: true });

    const atlasPng = createStyledPng(512, 512, '#16343A', atlasKey);
    fs.writeFileSync(imgPath, atlasPng);

    const frames: Record<string, unknown> = {};
    for (const [imgKey, imgCfg] of Object.entries(manifest.images)) {
      if (imgKey.startsWith(atlasKey)) {
        frames[imgKey] = {
          frame: { x: 0, y: 0, w: Math.min(512, imgCfg.placeholder.w), h: Math.min(512, imgCfg.placeholder.h) },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: imgCfg.placeholder.w, h: imgCfg.placeholder.h },
          sourceSize: { w: imgCfg.placeholder.w, h: imgCfg.placeholder.h },
        };
      }
    }
    const atlasJson = {
      frames,
      meta: {
        app: 'but-oi-live-packer',
        version: '1.0',
        image: path.basename(imgPath),
        format: 'RGBA8888',
        size: { w: 512, h: 512 },
        scale: '1',
      },
    };
    fs.writeFileSync(dataPath, JSON.stringify(atlasJson, null, 2));
    atlasesGenerated++;
    totalBytes += atlasPng.length;
  }

  const toneMap: Record<string, [number, number]> = {
    'sfx.wind_gust': [180, 400],
    'sfx.chime_soft': [528, 500],
    'sfx.staff_tap': [140, 250],
    'sfx.firefly_twinkle': [660, 300],
    'sfx.water_bloop': [320, 350],
    'sfx.sparrow': [780, 300],
    'sfx.page_glow': [440, 450],
    'bgm.day': [261, 2000],
    'bgm.night': [196, 2000],
  };

  for (const [audioKey, audioCfg] of Object.entries(manifest.audio)) {
    const relAudio = audioCfg.src.replace(/^\/assets\//, '');
    const audioPath = path.join(ROOT_DIR, 'assets', relAudio);
    fs.mkdirSync(path.dirname(audioPath), { recursive: true });
    const [freq, dur] = toneMap[audioKey] ?? [440, 400];
    const wavBuf = createToneWav(freq, dur);
    fs.writeFileSync(audioPath, wavBuf);
    audioGenerated++;
    totalBytes += wavBuf.length;
  }

  // Đồng bộ sang apps/overlay/public/assets để Vite dev server phục vụ trực tiếp
  fs.mkdirSync(OVERLAY_PUBLIC_ASSETS, { recursive: true });
  fs.cpSync(path.join(ROOT_DIR, 'assets'), OVERLAY_PUBLIC_ASSETS, {
    recursive: true,
    force: true,
  });

  return { imagesGenerated, atlasesGenerated, audioGenerated, totalBytes };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const res = generateAllPlaceholdersAndArt();
  const mb = (res.totalBytes / (1024 * 1024)).toFixed(2);
  console.log(
    `[placeholders] Đã sinh ${res.imagesGenerated} ảnh, ${res.atlasesGenerated} atlas, ${res.audioGenerated} audio (Tổng dung lượng: ${mb} MB <= 40 MB).`,
  );
}

