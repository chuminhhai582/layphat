import dotenv from 'dotenv';
import { z } from 'zod';
import { STRINGS_VI, type Settings } from '@but-oi/shared';

dotenv.config();

export const EnvSchema = z
  .object({
    TIKTOK_USERNAME: z.string().optional().default(''),
    EVENT_SOURCE: z.enum(['connector', 'tikfinity', 'simulator']).default('simulator'),
    TIKFINITY_WS: z.string().default('ws://127.0.0.1:21213'),
    ANTHROPIC_API_KEY: z.string().optional().default(''),
    AI_MODEL: z.string().default('claude-haiku-5-5'),
    AI_TIMEOUT_MS: z.coerce.number().int().positive().default(2500),
    TTS_PROVIDER: z.enum(['fpt', 'vbee', 'viettel', 'google']).default('fpt'),
    TTS_API_KEY: z.string().optional().default(''),
    TTS_VOICE: z.string().optional().default(''),
    TTS_SPEED: z.coerce.number().min(0.5).max(2.0).default(0.85),
    TTS_REVERB: z.coerce.number().min(0).max(1.0).default(0.15),
    PORT: z.coerce.number().int().positive().default(7777),
    ADMIN_PIN: z.string().optional().default(''),
    DB_PATH: z.string().optional().default('data/but-oi-live.db'),
  })
  .superRefine((val, ctx) => {
    if (val.EVENT_SOURCE === 'connector' && !val.TIKTOK_USERNAME.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TIKTOK_USERNAME'],
        message: STRINGS_VI.ENV_MISSING_TIKTOK_USERNAME,
      });
    }
  });

export type AppEnv = z.infer<typeof EnvSchema>;

export function validateEnv(
  rawEnv: Record<string, string | undefined> = process.env,
  exitOnError = false,
): AppEnv {
  const parsed = EnvSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || 'env'}: ${i.message}`)
      .join('\n');
    const fullMsg = `${STRINGS_VI.ENV_VALIDATION_ERROR_HEADER}\n${details}`;
    if (exitOnError) {
      console.error(fullMsg);
      process.exit(1);
    }
    throw new Error(fullMsg);
  }
  return parsed.data;
}

const MiracleIdSchema = z.enum([
  'glowing_book',
  'well_water',
  'golden_rice',
  'lit_cottage',
  'sparrow_pair',
  'lotus_bloom',
]);

const TierSettingSchema = z.object({
  id: z.enum(['firefly', 'visit', 'miracle', 'grand']),
  minCoins: z.number().int().min(1),
  durationMs: z.number().int().min(1000),
  appear: z.boolean(),
  blessingLength: z.enum(['short', 'full']),
  miracle: z.boolean().optional(),
  villageBook: z.boolean().optional(),
  blessWholeVillage: z.boolean().optional(),
});

export const SettingsSchema = z.object({
  tiers: z.array(TierSettingSchema).min(1),
  miracleByCategory: z
    .object({
      hoc_hanh: MiracleIdSchema,
      suc_khoe: MiracleIdSchema,
      cong_viec: MiracleIdSchema,
      gia_dao: MiracleIdSchema,
      tinh_duyen: MiracleIdSchema,
      default: MiracleIdSchema,
    })
    .catchall(MiracleIdSchema),
  giftGraceMs: z.object({
    visit: z.number().int().min(0),
    miracle: z.number().int().min(0),
    grand: z.number().int().min(0),
  }),
  comboWindowMs: z.number().int().min(100),
  maxWaitMs: z.number().int().min(1000),
  shortenWhenQueueOver: z.number().int().min(1),
  groupVisitEveryMs: z.number().int().min(5000),
  seatCount: z.number().int().min(1).max(100),
  wishPrefixes: z.array(z.string().min(1)).min(1),
  wishTtlMs: z.number().int().min(1000),
  budShadowCooldownMs: z.number().int().min(0),
  volumes: z
    .object({
      bgm: z.number().min(0).max(1),
      sfx: z.number().min(0).max(1),
      voice: z.number().min(0).max(1),
    })
    .optional(),
  webcamEnabled: z.boolean().optional(),
  ttsVoice: z.string().optional(),
  ttsSpeed: z.number().min(0.5).max(2.0).optional(),
});

export const DEFAULT_SETTINGS: Settings = {
  tiers: [
    {
      id: 'firefly',
      minCoins: 1,
      durationMs: 5000,
      appear: false,
      blessingLength: 'short',
    },
    {
      id: 'visit',
      minCoins: 30,
      durationMs: 20000,
      appear: true,
      blessingLength: 'full',
    },
    {
      id: 'miracle',
      minCoins: 300,
      durationMs: 28000,
      appear: true,
      blessingLength: 'full',
      miracle: true,
      villageBook: true,
    },
    {
      id: 'grand',
      minCoins: 3000,
      durationMs: 45000,
      appear: true,
      blessingLength: 'full',
      villageBook: true,
      blessWholeVillage: true,
    },
  ],
  miracleByCategory: {
    hoc_hanh: 'glowing_book',
    suc_khoe: 'well_water',
    cong_viec: 'golden_rice',
    gia_dao: 'lit_cottage',
    tinh_duyen: 'sparrow_pair',
    default: 'lotus_bloom',
  },
  giftGraceMs: {
    visit: 1500,
    miracle: 2500,
    grand: 3500,
  },
  comboWindowMs: 5000,
  maxWaitMs: 90000,
  shortenWhenQueueOver: 8,
  groupVisitEveryMs: 240000,
  seatCount: 36,
  wishPrefixes: ['ước:', 'uoc:', '#uoc'],
  wishTtlMs: 1800000,
  budShadowCooldownMs: 30000,
  volumes: {
    bgm: 0.35,
    sfx: 0.8,
    voice: 1.0,
  },
  webcamEnabled: false,
  ttsVoice: 'banmai',
  ttsSpeed: 0.85,
};

let currentSettings: Settings = structuredClone(DEFAULT_SETTINGS);
let persistHooks: {
  save?: (s: Settings) => void;
} = {};

export function registerSettingsPersistence(hooks: { save?: (s: Settings) => void }): void {
  persistHooks = hooks;
}

export function setMemorySettings(settings: Settings): void {
  const parsed = SettingsSchema.parse(settings);
  currentSettings = structuredClone(parsed);
}

export function getSettings(): Settings {
  return structuredClone(currentSettings);
}

export function updateSettings(partial: Partial<Settings>): Settings {
  const merged: Settings = {
    ...currentSettings,
    ...partial,
    miracleByCategory: partial.miracleByCategory
      ? { ...currentSettings.miracleByCategory, ...partial.miracleByCategory }
      : currentSettings.miracleByCategory,
    giftGraceMs: partial.giftGraceMs
      ? { ...currentSettings.giftGraceMs, ...partial.giftGraceMs }
      : currentSettings.giftGraceMs,
    volumes: partial.volumes
      ? { ...(currentSettings.volumes ?? { bgm: 0.35, sfx: 0.8, voice: 1.0 }), ...partial.volumes }
      : currentSettings.volumes,
  };

  const result = SettingsSchema.safeParse(merged);
  if (!result.success) {
    throw new Error(`${STRINGS_VI.SETTINGS_VALIDATION_ERROR}: ${result.error.message}`);
  }

  currentSettings = structuredClone(result.data);
  if (persistHooks.save) {
    persistHooks.save(currentSettings);
  }
  return getSettings();
}

export function resetSettings(): Settings {
  currentSettings = structuredClone(DEFAULT_SETTINGS);
  if (persistHooks.save) {
    persistHooks.save(currentSettings);
  }
  return getSettings();
}

