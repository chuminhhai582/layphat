import type { Settings, TierId } from '@but-oi/shared';
import { getSettings } from '../config.js';

export const TIER_RANK: Record<TierId, number> = {
  firefly: 0,
  visit: 1,
  miracle: 2,
  grand: 3,
};

export function tierFor(coins: number, settings: Settings = getSettings()): TierId | null {
  if (!Number.isFinite(coins) || coins < 1) {
    return null;
  }

  const sorted = [...settings.tiers].sort((a, b) => b.minCoins - a.minCoins);
  for (const tier of sorted) {
    if (coins >= tier.minCoins) {
      return tier.id;
    }
  }
  return null;
}

export function durationFor(
  tier: TierId,
  queueLength: number,
  settings: Settings = getSettings(),
): number {
  if (tier === 'visit' && queueLength > settings.shortenWhenQueueOver) {
    return 12000;
  }
  const found = settings.tiers.find((t) => t.id === tier);
  if (found) {
    return found.durationMs;
  }
  switch (tier) {
    case 'firefly':
      return 5000;
    case 'visit':
      return 20000;
    case 'miracle':
      return 28000;
    case 'grand':
      return 45000;
  }
}

