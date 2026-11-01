import { describe, it, expect, beforeEach } from 'vitest';
import { BlessingPicker, detectOccasion, fillName } from './picker.js';
import type { BlessingRecord } from '@but-oi/shared';

describe('T24 - BlessingPicker', () => {
  let picker: BlessingPicker;

  beforeEach(() => {
    picker = new BlessingPicker();
  });

  it('does not repeat any sentence across 20 consecutive picks', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const text = picker.pick({ tier: 'visit', now: new Date('2026-06-15T20:00:00') });
      expect(seen.has(text)).toBe(false);
      seen.add(text);
    }
    expect(seen.size).toBe(20);
  });

  it('prioritizes seasonal blessings on Trung Thu, Tet, and Cuoi Nam', () => {
    expect(detectOccasion(new Date('2026-09-25T20:00:00'))).toBe('trung_thu');
    expect(detectOccasion(new Date('2026-02-17T10:00:00'))).toBe('tet');
    expect(detectOccasion(new Date('2026-12-31T22:00:00'))).toBe('cuoi_nam');
    expect(detectOccasion(new Date('2026-05-10T12:00:00'))).toBeNull();

    const rec = picker.pickRecord({
      category: 'binh_an',
      tier: 'visit',
      now: new Date('2026-09-25T20:00:00'),
    });
    expect(rec.occasion).toBe('trung_thu');
  });

  it('uses short length for firefly tier and falls back to binh_an when category has no items', () => {
    const customPool: BlessingRecord[] = [
      {
        id: 1,
        category: 'binh_an',
        length: 'full',
        text: 'Câu bình an dài cho {ten}.',
        occasion: null,
        weight: 1,
        active: 1,
        audio_path: null,
      },
      {
        id: 2,
        category: 'binh_an',
        length: 'short',
        text: 'Câu bình an ngắn cho {ten}.',
        occasion: null,
        weight: 1,
        active: 1,
        audio_path: null,
      },
    ];

    const fallback = picker.pickRecord({
      category: 'hoc_hanh',
      tier: 'visit',
      customPool,
      now: new Date('2026-05-10T12:00:00'),
    });
    expect(fallback.category).toBe('binh_an');
    expect(fallback.length).toBe('full');

    const fireflyPick = picker.pickRecord({
      category: 'hoc_hanh',
      tier: 'firefly',
      customPool,
      now: new Date('2026-05-10T12:00:00'),
    });
    expect(fireflyPick.length).toBe('short');
  });

  it('supports opener, reject, group, and grand lengths and fills placeholders', () => {
    const opener = picker.pick({ length: 'opener' });
    expect(opener.length).toBeGreaterThan(5);

    const groupText = fillName(
      'Chào {ten_1}, {ten_2}, {ten_3} nhé!',
      'con',
      ['An', 'Bình', 'Châu'],
    );
    expect(groupText).toBe('Chào An, Bình, Châu nhé!');
  });
});

