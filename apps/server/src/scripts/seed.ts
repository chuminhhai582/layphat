import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRepo, type NewBlessingInput } from '../db/repo.js';
import { DEFAULT_SETTINGS } from '../config.js';
import { DEFAULT_BANNED_WORDS } from '../blessing/bannedWords.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLESSINGS_JSON_PATH = path.resolve(__dirname, '../../../../content/blessings.json');

export function seedDatabase(dbPath?: string): {
  blessingsCount: number;
  bannedWordsCount: number;
} {
  const repo = getRepo(dbPath);
  const raw = fs.readFileSync(BLESSINGS_JSON_PATH, 'utf8');
  const items = JSON.parse(raw) as NewBlessingInput[];

  const tx = repo.db.transaction(() => {
    for (const item of items) {
      repo.upsertBlessing(item);
    }
    repo.addBannedWordsBulk(DEFAULT_BANNED_WORDS);
    // Load or initialize default settings without overwriting existing custom settings
    const existingRow = repo.db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get('app_settings') as { value: string } | undefined;
    if (!existingRow) {
      repo.saveSettings(DEFAULT_SETTINGS);
    }
  });

  tx();

  return {
    blessingsCount: repo.listBlessings().length,
    bannedWordsCount: repo.listBannedWords().length,
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const res = seedDatabase();
  console.log(
    `[seed] Hoàn tất nạp CSDL: ${res.blessingsCount} câu chúc, ${res.bannedWordsCount} từ cấm.`,
  );
}

