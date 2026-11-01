import type {
  BlessingLength,
  BlessingRecord,
  OccasionType,
  TierId,
  WishCategory,
} from '@but-oi/shared';
import { getActiveBlessingsFromBank } from './bank.js';

const SEASON_RANGES: Array<{
  occasion: Exclude<OccasionType, null>;
  start: string;
  end: string;
}> = [
  // 2026
  { occasion: 'tet', start: '2026-02-10', end: '2026-02-23' },
  { occasion: 'trung_thu', start: '2026-09-22', end: '2026-09-28' },
  // 2027
  { occasion: 'tet', start: '2027-01-30', end: '2027-02-12' },
  { occasion: 'trung_thu', start: '2027-09-12', end: '2027-09-18' },
  // 2028
  { occasion: 'tet', start: '2028-01-19', end: '2028-02-01' },
  { occasion: 'trung_thu', start: '2028-09-30', end: '2028-10-06' },
  // 2029
  { occasion: 'tet', start: '2029-02-06', end: '2029-02-19' },
  { occasion: 'trung_thu', start: '2029-09-19', end: '2029-09-25' },
  // 2030
  { occasion: 'tet', start: '2030-01-26', end: '2030-02-08' },
  { occasion: 'trung_thu', start: '2030-09-09', end: '2030-09-15' },
];

export function detectOccasion(now: Date = new Date()): OccasionType {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const ymd = `${yyyy}-${mm}-${dd}`;

  if (mm === '12' && dd === '31') {
    return 'cuoi_nam';
  }

  for (const r of SEASON_RANGES) {
    if (ymd >= r.start && ymd <= r.end) {
      return r.occasion;
    }
  }
  return null;
}

export function fillName(
  template: string,
  displayName: string,
  groupNames?: string[],
): string {
  let out = template.replaceAll('{ten}', displayName || 'con');
  if (groupNames && groupNames.length > 0) {
    out = out.replaceAll('{ten_1}', groupNames[0] ?? 'con');
    out = out.replaceAll('{ten_2}', groupNames[1] ?? groupNames[0] ?? 'con');
    out = out.replaceAll(
      '{ten_3}',
      groupNames[2] ?? groupNames[1] ?? groupNames[0] ?? 'con',
    );
  }
  return out;
}

export type PickOptions = {
  category?: WishCategory;
  tier?: TierId;
  length?: BlessingLength;
  now?: Date;
  customPool?: BlessingRecord[];
};

export class BlessingPicker {
  private recentTexts: string[] = [];
  private readonly maxRecent = 20;

  public pickRecord(opts: PickOptions = {}): BlessingRecord {
    const pool = opts.customPool ?? getActiveBlessingsFromBank();
    const now = opts.now ?? new Date();
    const occasion = detectOccasion(now);

    const targetLength: BlessingLength =
      opts.length ?? (opts.tier === 'firefly' ? 'short' : 'full');

    // Nhóm đặc biệt: opener, reject, group, grand
    if (['opener', 'reject', 'group', 'grand'].includes(targetLength)) {
      const specialCandidates = pool.filter((b) => b.length === targetLength);
      if (specialCandidates.length > 0) {
        return this.selectWeightedWithHistory(specialCandidates, now);
      }
    }

    const desiredCategory: WishCategory = opts.category ?? 'binh_an';

    // 1. Ưu tiên mùa đặc biệt hôm nay (occasion)
    if (occasion) {
      const seasonalByCat = pool.filter(
        (b) =>
          b.occasion === occasion &&
          b.length === targetLength &&
          b.category === desiredCategory,
      );
      const nonRepeatedSeasonalCat = seasonalByCat.filter(
        (b) => !this.recentTexts.includes(b.text),
      );
      if (nonRepeatedSeasonalCat.length > 0) {
        return this.selectWeightedWithHistory(nonRepeatedSeasonalCat, now);
      }

      const seasonalAnyCat = pool.filter(
        (b) => b.occasion === occasion && b.length === targetLength,
      );
      const nonRepeatedSeasonalAny = seasonalAnyCat.filter(
        (b) => !this.recentTexts.includes(b.text),
      );
      if (nonRepeatedSeasonalAny.length > 0) {
        return this.selectWeightedWithHistory(nonRepeatedSeasonalAny, now);
      }
    }

    // 2. Câu theo category được yêu cầu (occasion = null)
    let candidates = pool.filter(
      (b) =>
        b.occasion === null &&
        b.length === targetLength &&
        b.category === desiredCategory,
    );

    // 3. Nếu category không có câu -> rơi về binh_an
    if (candidates.length === 0) {
      candidates = pool.filter(
        (b) =>
          b.occasion === null &&
          b.length === targetLength &&
          b.category === 'binh_an',
      );
    }

    // 4. Nếu tất cả câu trong category đã nằm trong 20 lượt gần nhất -> mở rộng sang các câu cùng độ dài chưa lặp
    const unrepeatedInCat = candidates.filter(
      (b) => !this.recentTexts.includes(b.text),
    );
    if (unrepeatedInCat.length > 0) {
      return this.selectWeightedWithHistory(unrepeatedInCat, now);
    }

    const allSameLength = pool.filter(
      (b) => b.occasion === null && b.length === targetLength,
    );
    const unrepeatedSameLength = allSameLength.filter(
      (b) => !this.recentTexts.includes(b.text),
    );
    if (unrepeatedSameLength.length > 0) {
      return this.selectWeightedWithHistory(unrepeatedSameLength, now);
    }

    // Fallback cuối cùng
    const fallbackList = candidates.length > 0 ? candidates : pool;
    return this.selectWeightedWithHistory(fallbackList, now);
  }

  public pick(opts: PickOptions = {}): string {
    return this.pickRecord(opts).text;
  }

  private selectWeightedWithHistory(
    candidates: BlessingRecord[],
    now: Date,
  ): BlessingRecord {
    const nonRepeated = candidates.filter(
      (b) => !this.recentTexts.includes(b.text),
    );
    const activeSet = nonRepeated.length > 0 ? nonRepeated : candidates;

    const hour = now.getHours();
    const isNight = hour >= 19 || hour < 5;
    const isMorning = hour >= 5 && hour < 11;

    // Tính trọng số kết hợp khung giờ
    const weights = activeSet.map((b) => {
      let w = Math.max(1, b.weight || 1);
      const lower = b.text.toLowerCase();
      if (isNight && (lower.includes('đêm') || lower.includes('tối') || lower.includes('trăng') || lower.includes('ngủ'))) {
        w *= 1.5;
      } else if (isMorning && (lower.includes('sớm') || lower.includes('nắng') || lower.includes('mai'))) {
        w *= 1.5;
      }
      return w;
    });

    const totalWeight = weights.reduce((acc, w) => acc + w, 0);
    let r = Math.random() * totalWeight;
    let chosen = activeSet[0]!;

    for (let i = 0; i < activeSet.length; i++) {
      r -= weights[i]!;
      if (r <= 0) {
        chosen = activeSet[i]!;
        break;
      }
    }

    this.recordHistory(chosen.text);
    return chosen;
  }

  private recordHistory(text: string): void {
    this.recentTexts.push(text);
    if (this.recentTexts.length > this.maxRecent) {
      this.recentTexts.shift();
    }
  }

  public clearHistory(): void {
    this.recentTexts = [];
  }
}

export const defaultPicker = new BlessingPicker();

