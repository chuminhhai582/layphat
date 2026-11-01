import { fileURLToPath } from 'node:url';
import { getRepo } from '../db/repo.js';
import { seedDatabase } from './seed.js';
import { defaultVoiceService } from '../voice/index.js';
import {
  containsBannedWord,
  containsForbiddenReligiousTerm,
} from '../blessing/bannedWords.js';

export async function generateBankVoices(dbPath?: string): Promise<{
  total: number;
  cachedCount: number;
  renderedCount: number;
  violations: string[];
}> {
  seedDatabase(dbPath);
  const repo = getRepo(dbPath);
  const blessings = repo.listBlessings();

  let cachedCount = 0;
  let renderedCount = 0;
  const violations: string[] = [];

  for (const b of blessings) {
    if (
      containsBannedWord(b.text).matched ||
      containsForbiddenReligiousTerm(b.text)
    ) {
      violations.push(`ID ${b.id}: ${b.text}`);
    }

    const res = await defaultVoiceService.render(b.text);
    if (res.fromCache) {
      cachedCount++;
    } else {
      renderedCount++;
    }

    if (b.audio_path !== res.url) {
      repo.updateBlessing(b.id, { audio_path: res.url });
    }
  }

  return {
    total: blessings.length,
    cachedCount,
    renderedCount,
    violations,
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  generateBankVoices()
    .then((res) => {
      console.log(
        `[voices] Hoàn tất ${res.total} câu (mới: ${res.renderedCount}, từ cache: ${res.cachedCount}, vi phạm: ${res.violations.length}).`,
      );
      if (res.violations.length > 0) {
        console.error('Phát hiện câu vi phạm quy tắc:', res.violations);
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

