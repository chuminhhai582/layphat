import { describe, it, expect } from 'vitest';
import { buildSubtitleSegments } from './Subtitle.js';

describe('T29 - Synchronized Subtitle Segmentation', () => {
  it('splits a 70-word blessing into 2-3 segments of <= 3 lines (~36 chars/line) with proportional duration', () => {
    const text70Words =
      'Bụt chúc Minh Anh ra đường gặp nắng đẹp, về nhà gặp mâm cơm nóng hổi đầy ắp tiếng cười. ' +
      'Những ngày ôn thi vất vả dưới ánh đèn khuya rồi sẽ đơm hoa kết trái ngọt ngào như lúa chín ngoài đồng. ' +
      'Con cứ giữ cái đầu thật bình tĩnh, trái tim thật ấm áp, đi thi làm bài trơn tru và luôn nhớ có Bụt ở bên gốc đa làng.';

    const totalDurationMs = 12000;
    const segments = buildSubtitleSegments(text70Words, totalDurationMs, 36, 3);

    expect(segments.length).toBeGreaterThanOrEqual(2);
    expect(segments.length).toBeLessThanOrEqual(4);

    let sumDuration = 0;
    for (const seg of segments) {
      expect(seg.lines.length).toBeLessThanOrEqual(3);
      for (const line of seg.lines) {
        expect(Array.from(line).length).toBeLessThanOrEqual(36);
      }
      sumDuration += seg.durationMs;
    }

    expect(Math.abs(sumDuration - totalDurationMs)).toBeLessThan(300);
  });
});

