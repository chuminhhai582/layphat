import { describe, it, expect, beforeEach } from 'vitest';
import { tierFor, durationFor } from './tiers.js';
import { getSettings, resetSettings, updateSettings } from '../config.js';

describe('T06 - Gift Tiers', () => {
  beforeEach(() => {
    resetSettings();
  });

  it('maps boundary coin counts accurately (0, 1, 29, 30, 299, 300, 2999, 3000)', () => {
    expect(tierFor(0)).toBeNull();
    expect(tierFor(-10)).toBeNull();
    expect(tierFor(1)).toBe('firefly');
    expect(tierFor(29)).toBe('firefly');
    expect(tierFor(30)).toBe('visit');
    expect(tierFor(299)).toBe('visit');
    expect(tierFor(300)).toBe('miracle');
    expect(tierFor(2999)).toBe('miracle');
    expect(tierFor(3000)).toBe('grand');
    expect(tierFor(10000)).toBe('grand');
  });

  it('respects updated tier thresholds in settings', () => {
    const s = getSettings();
    const customTiers = s.tiers.map((t) =>
      t.id === 'visit' ? { ...t, minCoins: 50 } : t,
    );
    updateSettings({ tiers: customTiers });

    expect(tierFor(30)).toBe('firefly');
    expect(tierFor(49)).toBe('firefly');
    expect(tierFor(50)).toBe('visit');
  });

  it('calculates durationFor and shortens visit when queue > shortenWhenQueueOver', () => {
    expect(durationFor('visit', 5)).toBe(20000);
    expect(durationFor('visit', 8)).toBe(20000);
    expect(durationFor('visit', 9)).toBe(12000);
    expect(durationFor('miracle', 12)).toBe(28000);
    expect(durationFor('grand', 12)).toBe(45000);
  });
});

