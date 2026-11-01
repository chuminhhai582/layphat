import { describe, it, expect } from 'vitest';
import { sanitizeSpokenName, formatUiDisplayName } from './nameSanitizer.js';
import { containsBannedWord, containsForbiddenReligiousTerm } from './bannedWords.js';

describe('T22 - Name Sanitizer & Banned Words', () => {
  it('sanitizes emoji, special chars, trailing long numbers, and all-number names', () => {
    expect(sanitizeSpokenName('🌸 Nguyễn Minh 123456 🌸')).toBe('Nguyễn Minh');
    expect(sanitizeSpokenName('999888777')).toBe('con');
    expect(sanitizeSpokenName('🔥💎👑')).toBe('con');
    expect(sanitizeSpokenName('   Trần   Thị   Thanh   Hương   ')).toBe('Trần Thị Thanh Hương');

    const longName = 'Nguyễn Hoàng Phương Trang Anh Thư Bảo Ngọc Linh';
    const spoken = sanitizeSpokenName(longName);
    expect(Array.from(spoken).length).toBeLessThanOrEqual(24);

    const uiName = formatUiDisplayName(longName);
    expect(Array.from(uiName).length).toBeLessThanOrEqual(16);
    expect(uiName.endsWith('…')).toBe(true);
  });

  it('detects banned words across accented, unaccented, and obfuscated variants', () => {
    expect(containsBannedWord('cho con xin số đề hôm nay').matched).toBe(true);
    expect(containsBannedWord('xin so de chieu nay').matched).toBe(true);
    expect(containsBannedWord('xin b.ù.a y.ê.u').matched).toBe(true);
    expect(containsBannedWord('đ.m cuộc đời').matched).toBe(true);
    expect(containsBannedWord('d.k.m').matched).toBe(true);
    expect(containsBannedWord('vào web https://nhacai88.com nhé').matched).toBe(true);

    // Lời ước lành mạnh không bị chặn
    expect(containsBannedWord('ước: kỳ thi sắp tới làm bài thật tốt').matched).toBe(false);
    expect(containsBannedWord('ước: mẹ con mau khỏe lại').matched).toBe(false);
    expect(containsBannedWord('ước: gia đình bình an hạnh phúc').matched).toBe(false);
  });

  it('detects forbidden religious terms', () => {
    expect(containsForbiddenReligiousTerm('Nam mô A Di Đà Phật')).toBe(true);
    expect(containsForbiddenReligiousTerm('Chúc con giải hạn thành công')).toBe(true);
    expect(containsForbiddenReligiousTerm('Bụt chúc con bình an dưới gốc đa')).toBe(false);
  });
});

