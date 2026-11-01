import { getRepo } from '../db/repo.js';

export const DEFAULT_BANNED_WORDS: string[] = [
  // Cờ bạc, mê tín, bùa ngải
  'số đề',
  'lô đề',
  'bùa yêu',
  'bùa ngải',
  'đánh đề',
  'bạch thủ lô',
  'soi cầu',
  'cá độ',
  'nhà cái',
  'tài xỉu',
  'nổ hũ',
  'cờ bạc',
  'xóc đĩa',
  'con lô',
  'con đề',
  'đánh con gì',
  'về bao nhiêu',
  'xổ số miền bắc',
  'xổ số miền nam',
  'xsmb',
  'xsmn',
  'kết quả bóng đá',
  'kèo bóng',
  'bắt kèo',
  'cá cược',
  'kubet',
  'f8bet',
  'hi88',
  'shbet',
  'sunwin',
  'go88',
  'b52',
  'rikvip',
  // Từ tục tĩu tiếng Việt & viết tắt phổ biến
  'địt',
  'đụ',
  'lồn',
  'cặc',
  'buồi',
  'đéo',
  'đĩ',
  'chó đẻ',
  'mẹ mày',
  'má mày',
  'bố mày',
  'cha mày',
  'vãi lồn',
  'vãi cặc',
  'đm',
  'đkm',
  'đcm',
  'vcl',
  'vl',
  'cc',
  'clm',
  'đmm',
  'dmm',
  'dkm',
  'dcm',
  'óc chó',
  'ngu lồn',
  'xạo lồn',
  'cứt',
  'ăn cứt',
  // Nội dung tình dục / khiêu dâm
  'sex',
  'khiêu dâm',
  'hiếp dâm',
  'ấu dâm',
  'loạn luân',
  'jav',
  'xnxx',
  'pornhub',
  'onlyfans',
  'kích dục',
  'thủ dâm',
  // Trù ẻo, bạo lực, tự hại
  'chết đi',
  'chết chóc',
  'giết người',
  'tự tử',
  'tự sát',
  'nhảy cầu',
  'rạch tay',
  'uống thuốc sâu',
  'tông xe',
  'ung thư chết',
  'cả nhà chết',
  'trù ẻo',
  'bị tai nạn',
  'chặt đầu',
  'đâm chết',
  'ngập nợ',
  'phá sản',
  'gãy chân',
  'gãy tay',
  'mù mắt',
  'câm điếc',
  'rớt đại học',
  'thi trượt',
  'bị đuổi việc',
  'tan cửa nát nhà',
  'vỡ nợ',
  'nhảy lầu',
  'treo cổ',
  'uống thuốc ngủ',
  'kết thúc cuộc đời',
  'không muốn sống nữa',
  'bỏ bùa',
  'ngải yêu',
  'ép yêu',
  'phải yêu tao',
  'bắt nó yêu',
  // Chính trị nhạy cảm / xúc phạm vùng miền, tôn giáo, dân tộc
  'phản động',
  'lật đổ',
  'ba que',
  'cali',
  'bò đỏ',
  'bắc kỳ',
  'nam kỳ',
  'trung kỳ',
  'thanh nghệ tĩnh',
  'khủng bố',
  'chế độ',
  'đảng cộng sản',
  'việt tân',
  'tổng thống',
  'chủ tịch nước',
  'thủ tướng',
  'bộ công an',
  'xúc phạm tôn giáo',
  'bọn mọi',
  'dân tộc thiểu số ngu',
  // Quảng cáo, lừa đảo, link
  'http://',
  'https://',
  'www.',
  '.com',
  '.vn',
  '.net',
  'zalo.me',
  't.me/',
  'telegram',
  'ib zalo',
  'vay tiền nhanh',
  'tuyển cộng tác viên',
];

export const FORBIDDEN_RELIGIOUS_TERMS: string[] = [
  'nam mô',
  'a di đà',
  'phật',
  'công đức',
  'cúng dường',
  'siêu độ',
  'giải hạn',
  'phù hộ độ trì',
  'bồ tát',
  'như lai',
  'tòa sen',
  'cà sa',
];

export function stripVietnameseAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Kiểm tra văn bản có chứa từ cấm hay biến thể chèn dấu chấm/khoảng trắng/ký tự đặc biệt.
 */
export function containsBannedWord(text: string, customWordList?: string[]): {
  matched: boolean;
  word?: string;
} {
  if (!text || !text.trim()) return { matched: false };

  let words = customWordList;
  if (!words) {
    try {
      const dbWords = getRepo().listBannedWords();
      words =
        dbWords.length > 0
          ? [...new Set([...DEFAULT_BANNED_WORDS, ...dbWords])]
          : DEFAULT_BANNED_WORDS;
    } catch {
      words = DEFAULT_BANNED_WORDS;
    }
  }

  const lower = text.toLowerCase().normalize('NFC');
  const unaccented = stripVietnameseAccents(lower);

  // Kiểm tra link / tên miền quảng cáo
  if (/(https?:\/\/|www\.|[a-z0-9-]+\.(com|vn|net|org|xyz|me|io)\b)/i.test(lower)) {
    return { matched: true, word: 'link' };
  }

  for (const rawWord of words) {
    const w = rawWord.trim().toLowerCase().normalize('NFC');
    if (!w) continue;

    // Nếu là mẫu URL/domain
    if (/[^a-z0-9\p{L}\s]/u.test(w)) {
      if (lower.includes(w)) {
        return { matched: true, word: w };
      }
      continue;
    }

    const wUnaccented = stripVietnameseAccents(w);
    const wTokens = wUnaccented.split(/\s+/).filter(Boolean);
    const accentedTokens = w.split(/\s+/).filter(Boolean);

    // 1. Khớp có dấu chính xác theo ranh giới từ
    const accentedPattern = accentedTokens.map((t) => escapeRegex(t)).join('[\\s.\\-_]+');
    const accentedRegex = new RegExp(
      `(?:^|[^\\p{L}\\p{N}])${accentedPattern}(?:$|[^\\p{L}\\p{N}])`,
      'iu',
    );
    if (accentedRegex.test(lower)) {
      return { matched: true, word: w };
    }

    // 2. Khớp không dấu theo ranh giới từ (dành cho câu gõ không dấu hoặc từ viết tắt không dấu)
    // Nếu văn bản đầu vào đã có dấu tiếng Việt đầy đủ tại vị trí đó, không biến "con để"/"con lo" thành "con đề"/"con lô"
    const AMBIGUOUS_UNACCENTED = new Set([
      'du',
      'di',
      'cac',
      'lon',
      'deo',
      'cut',
      'buoi',
      'sex',
      'con de',
      'con lo',
      'bo do',
      'che do',
      'ca do',
      'no hu',
      'pha san',
      'vo no',
      'ngap no',
    ]);
    const isAmbiguousUnaccented = AMBIGUOUS_UNACCENTED.has(wUnaccented);

    if (!isAmbiguousUnaccented) {
      const unaccentedPattern = wTokens.map((t) => escapeRegex(t)).join('[\\s.\\-_]+');
      const unaccentedRegex = new RegExp(
        `(?:^|[^a-z0-9])${unaccentedPattern}(?:$|[^a-z0-9])`,
        'i',
      );
      if (unaccentedRegex.test(unaccented)) {
        return { matched: true, word: w };
      }
    }

    // 3. Khớp biến thể cố tình chèn dấu chấm / gạch ngang / gạch dưới giữa các ký tự trong từ
    // (vd: "đ.m", "s.ố đ.ề", "b.u.a y.e.u", "d.i.t", "đ.é.o", "l.o d.e")
    if (/[a-z\p{L}][.\-_][a-z\p{L}]/iu.test(lower)) {
      const wordObfPatterns = wTokens.map((tok) =>
        Array.from(tok)
          .map((c) => escapeRegex(c))
          .join('[.\\-_]*'),
      );
      const obfPattern = wordObfPatterns.join('[\\s.\\-_]+');
      const obfRegex = new RegExp(`(?:^|[^a-z0-9])${obfPattern}(?:$|[^a-z0-9])`, 'i');
      if (obfRegex.test(unaccented)) {
        return { matched: true, word: w };
      }
    }
  }

  return { matched: false };
}

/**
 * Kiểm tra lời chúc không vi phạm từ ngữ tôn giáo (Ràng buộc 1 & 2, mục 7.2)
 */
export function containsForbiddenReligiousTerm(text: string): boolean {
  const lower = text.toLowerCase().normalize('NFC');
  for (const term of FORBIDDEN_RELIGIOUS_TERMS) {
    const escaped = escapeRegex(term.toLowerCase().normalize('NFC'));
    const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`, 'iu');
    if (re.test(lower)) {
      return true;
    }
  }
  return false;
}
