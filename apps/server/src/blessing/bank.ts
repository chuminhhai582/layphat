import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BlessingRecord } from '@but-oi/shared';
import { getRepo, type NewBlessingInput } from '../db/repo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLESSINGS_JSON_PATH = path.resolve(__dirname, '../../../../content/blessings.json');

let fallbackMemoryBank: BlessingRecord[] | null = null;

export function getActiveBlessingsFromBank(): BlessingRecord[] {
  try {
    const repo = getRepo();
    const list = repo.listBlessings({ activeOnly: true });
    if (list.length > 0) {
      return list;
    }
  } catch {
    // Fallback to JSON file if DB is not initialized yet
  }

  if (!fallbackMemoryBank) {
    const raw = fs.readFileSync(BLESSINGS_JSON_PATH, 'utf8');
    const items = JSON.parse(raw) as NewBlessingInput[];
    fallbackMemoryBank = items.map((item, idx) => ({
      id: idx + 1,
      category: item.category,
      length: item.length,
      text: item.text,
      occasion: item.occasion ?? null,
      weight: item.weight ?? 1,
      active: item.active ?? 1,
      audio_path: item.audio_path ?? null,
    }));
  }
  return fallbackMemoryBank.filter((b) => b.active === 1);
}

