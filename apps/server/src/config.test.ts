import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateEnv,
  getSettings,
  updateSettings,
  resetSettings,
  DEFAULT_SETTINGS,
} from './config.js';
import { STRINGS_VI } from '@but-oi/shared';

describe('T02 - Config & Settings', () => {
  beforeEach(() => {
    resetSettings();
  });

  it('validates env when EVENT_SOURCE=simulator without TIKTOK_USERNAME', () => {
    const env = validateEnv({
      EVENT_SOURCE: 'simulator',
      TIKTOK_USERNAME: '',
    });
    expect(env.EVENT_SOURCE).toBe('simulator');
    expect(env.PORT).toBe(7777);
    expect(env.AI_MODEL).toBe('claude-haiku-5-5');
  });

  it('throws clear Vietnamese error when EVENT_SOURCE=connector and TIKTOK_USERNAME is missing', () => {
    expect(() =>
      validateEnv({
        EVENT_SOURCE: 'connector',
        TIKTOK_USERNAME: '   ',
      }),
    ).toThrow(STRINGS_VI.ENV_MISSING_TIKTOK_USERNAME);
  });

  it('validates env when EVENT_SOURCE=connector and TIKTOK_USERNAME is provided', () => {
    const env = validateEnv({
      EVENT_SOURCE: 'connector',
      TIKTOK_USERNAME: 'but_oi_channel',
      PORT: '8080',
    });
    expect(env.TIKTOK_USERNAME).toBe('but_oi_channel');
    expect(env.PORT).toBe(8080);
  });

  it('returns default settings matching section 4.4', () => {
    const s = getSettings();
    expect(s.seatCount).toBe(36);
    expect(s.comboWindowMs).toBe(5000);
    expect(s.tiers).toHaveLength(4);
    expect(s.tiers[0]?.id).toBe('firefly');
    expect(s.miracleByCategory.hoc_hanh).toBe('glowing_book');
  });

  it('updates valid partial settings and rejects invalid values', () => {
    const updated = updateSettings({ seatCount: 48, comboWindowMs: 3000 });
    expect(updated.seatCount).toBe(48);
    expect(updated.comboWindowMs).toBe(3000);

    expect(() => updateSettings({ seatCount: -5 })).toThrow(STRINGS_VI.SETTINGS_VALIDATION_ERROR);
    expect(() =>
      updateSettings({
        // @ts-expect-error testing runtime rejection of invalid type
        comboWindowMs: 'invalid',
      }),
    ).toThrow(STRINGS_VI.SETTINGS_VALIDATION_ERROR);

    // Ensure previous valid state remains intact
    expect(getSettings().seatCount).toBe(48);
    expect(DEFAULT_SETTINGS.seatCount).toBe(36);
  });
});

