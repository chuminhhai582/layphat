import { describe, it, expect } from 'vitest';
import { runModerationEvaluation } from '../scripts/evalModeration.js';
import { getActiveBlessingsFromBank } from './bank.js';
import {
  containsBannedWord,
  containsForbiddenReligiousTerm,
} from './bannedWords.js';

describe('T27 & T30 - Bank 150 Blessings & 200 Troll Moderation Suite', () => {
  it('T27: content/blessings.json contains exactly 150 valid blessings with zero banned/religious terms', () => {
    const blessings = getActiveBlessingsFromBank();
    expect(blessings).toHaveLength(150);

    for (const b of blessings) {
      expect({ text: b.text, res: containsBannedWord(b.text) }).toEqual({
        text: b.text,
        res: { matched: false },
      });
      expect(containsForbiddenReligiousTerm(b.text)).toBe(false);
    }
  });

  it('T30: blocks >= 95% of 200 bad wishes and has < 5% false positives on 50 good wishes', async () => {
    const summary = await runModerationEvaluation();
    expect(summary.totalBad).toBe(200);
    expect(summary.totalGood).toBe(50);
    expect(summary.blockRate).toBeGreaterThanOrEqual(0.95);
    expect(summary.falsePositiveRate).toBeLessThan(0.05);
  });
});
