import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WishModerator } from '../blessing/moderator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TROLL_JSON_PATH = path.resolve(__dirname, '../../../../test/fixtures/troll.json');

export type EvalFixtureItem = {
  id: number;
  kind: 'bad' | 'good';
  category: string;
  text: string;
};

export type EvalSummary = {
  totalBad: number;
  blockedBad: number;
  blockRate: number;
  totalGood: number;
  falsePositives: number;
  falsePositiveRate: number;
  missedBad: EvalFixtureItem[];
  wronglyBlockedGood: EvalFixtureItem[];
};

export async function runModerationEvaluation(
  moderator = new WishModerator(),
): Promise<EvalSummary> {
  const raw = fs.readFileSync(TROLL_JSON_PATH, 'utf8');
  const items = JSON.parse(raw) as EvalFixtureItem[];

  const badItems = items.filter((i) => i.kind === 'bad');
  const goodItems = items.filter((i) => i.kind === 'good');

  const missedBad: EvalFixtureItem[] = [];
  const wronglyBlockedGood: EvalFixtureItem[] = [];

  for (const item of badItems) {
    const res = await moderator.check('Minh', item.text);
    // Bị chặn khi res?.allowed === false
    if (res?.allowed !== false) {
      missedBad.push(item);
    }
  }

  for (const item of goodItems) {
    const res = await moderator.check('Minh', item.text);
    // Chặn nhầm khi res?.allowed === false
    if (res?.allowed === false) {
      wronglyBlockedGood.push(item);
    }
  }

  const blockedBad = badItems.length - missedBad.length;
  const blockRate = badItems.length > 0 ? blockedBad / badItems.length : 1;
  const falsePositiveRate =
    goodItems.length > 0 ? wronglyBlockedGood.length / goodItems.length : 0;

  return {
    totalBad: badItems.length,
    blockedBad,
    blockRate,
    totalGood: goodItems.length,
    falsePositives: wronglyBlockedGood.length,
    falsePositiveRate,
    missedBad,
    wronglyBlockedGood,
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  runModerationEvaluation()
    .then((summary) => {
      console.log('=== KẾT QUẢ ĐÁNH GIÁ KIỂM DUYỆT (T30) ===');
      console.log(
        `Câu xấu bị chặn: ${summary.blockedBad}/${summary.totalBad} (${(summary.blockRate * 100).toFixed(1)}%)`,
      );
      console.log(
        `Câu tốt bị chặn nhầm: ${summary.falsePositives}/${summary.totalGood} (${(summary.falsePositiveRate * 100).toFixed(1)}%)`,
      );
      if (summary.missedBad.length > 0) {
        console.log('Danh sách câu xấu lọt:', summary.missedBad);
      }
      if (summary.wronglyBlockedGood.length > 0) {
        console.log('Danh sách câu tốt bị chặn nhầm:', summary.wronglyBlockedGood);
      }
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

