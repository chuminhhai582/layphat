/**
 * Token màu và chữ theo đúng UI_SPEC.md §2.2 và §2.3
 */
export const THEME = {
  colors: {
    ink900: '#0E1719',
    teal800: '#16343A',
    teal600: '#2C5A5E',
    mist300: '#9DB5AE',
    paper100: '#F3EAD7',
    gold500: '#D4AF5A',
    gold300: '#F0DCA0',
    vermilion600: '#A9362A',
    jade500: '#5E9C80',
    textOnDark: '#F6F1E4',
    textMuted: '#C9C1AE',
    panelBg: 'rgba(14,23,25,0.80)',
    clouds: ['#E8B9B0', '#EED9A2', '#A9CDB8', '#B9B0D6', '#A9C4D8'] as const,
  },
  hex: {
    ink900: 0x0e1719,
    teal800: 0x16343a,
    teal600: 0x2c5a5e,
    mist300: 0x9db5ae,
    paper100: 0xf3ead7,
    gold500: 0xd4af5a,
    gold300: 0xf0dca0,
    vermilion600: 0xa9362a,
    jade500: 0x5e9c80,
    textOnDark: 0xf6f1e4,
    textMuted: 0xc9c1ae,
    clouds: [0xe8b9b0, 0xeed9a2, 0xa9cdb8, 0xb9b0d6, 0xa9c4d8] as const,
  },
  fonts: {
    serif: '"Noto Serif", Georgia, serif',
    sans: '"Be Vietnam Pro", system-ui, sans-serif',
  },
  canvas: {
    width: 1080,
    height: 1920,
    fps: 30,
  },
} as const;

export const SAFE_ZONES = [
  { id: 1, name: '① Thanh trên TikTok', x: 0, y: 0, w: 1080, h: 220 },
  { id: 2, name: '② Băng rôn tên', x: 80, y: 230, w: 920, h: 160 },
  { id: 3, name: '③ Ô thông điệp', x: 60, y: 400, w: 960, h: 240 },
  { id: 4, name: '④ Sân khấu', x: 0, y: 650, w: 1080, h: 530 },
  { id: 5, name: '⑤ Chip/thẻ hàng chờ', x: 790, y: 660, w: 260, h: 260 },
  { id: 6, name: '⑥ Thông báo quà TikTok', x: 0, y: 1050, w: 620, h: 200 },
  { id: 7, name: '⑦ Làng (chỗ ngồi)', x: 0, y: 1180, w: 1080, h: 540 },
  { id: 8, name: '⑧ Bình luận TikTok', x: 0, y: 1250, w: 700, h: 470 },
  { id: 9, name: '⑨ Webcam (Ø260)', x: 780, y: 1280, w: 260, h: 260 },
  { id: 10, name: '⑩ Thanh nhập + nút quà', x: 0, y: 1720, w: 1080, h: 200 },
] as const;
