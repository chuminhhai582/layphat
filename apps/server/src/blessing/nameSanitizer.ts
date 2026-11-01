import { STRINGS_VI } from '@but-oi/shared';

/**
 * Chuẩn hóa tên người xem để Ông Bụt đọc lên sóng (tối đa 24 ký tự).
 * - Bỏ emoji, ký tự đặc biệt
 * - Bỏ số đuôi dài (> 3 chữ số) hoặc tên toàn số
 * - Giữ chữ Việt có dấu, chữ Latin và khoảng trắng đơn
 * - Nếu rỗng sau khi lọc -> trả về "con"
 */
export function sanitizeSpokenName(rawName: string | undefined | null): string {
  if (!rawName) return STRINGS_VI.DEFAULT_VIEWER_PRONOUN;

  // Chuẩn hóa Unicode NFC để giữ nguyên dấu tiếng Việt
  let cleaned = rawName.normalize('NFC');

  // Xóa emoji và ký tự biểu tượng
  cleaned = cleaned.replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu, ' ');

  // Thay thế ký tự đặc biệt (không phải chữ cái Unicode hoặc chữ số) bằng khoảng trắng
  cleaned = cleaned.replace(/[^\p{L}\p{N}\s]/gu, ' ');

  // Bỏ các cụm số dài (> 3 chữ số) ở cuối từ hoặc đứng riêng
  cleaned = cleaned.replace(/\d{4,}/g, ' ');

  // Gom khoảng trắng thừa
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Nếu chỉ còn toàn chữ số và khoảng trắng -> trả về "con"
  if (!cleaned || /^[\d\s]+$/.test(cleaned)) {
    return STRINGS_VI.DEFAULT_VIEWER_PRONOUN;
  }

  // Bỏ số đuôi gắn liền sau chữ nếu dài > 3 đã xử lý, nhưng nếu từ đầu là số lẻ vô nghĩa thì lọc bớt
  cleaned = cleaned.replace(/^\d+\s*/, '').trim();

  if (!cleaned || !/\p{L}/u.test(cleaned)) {
    return STRINGS_VI.DEFAULT_VIEWER_PRONOUN;
  }

  // Giới hạn tối đa 24 ký tự để đọc (ưu tiên cắt theo từ nếu được)
  const chars = Array.from(cleaned);
  if (chars.length > 24) {
    cleaned = chars.slice(0, 24).join('').trim();
  }

  return cleaned || STRINGS_VI.DEFAULT_VIEWER_PRONOUN;
}

/**
 * Chuẩn hóa tên hiển thị trên HUD:
 * - Tối đa 16 ký tự (quá 16 ký tự cắt và thêm "…" theo UI_SPEC §5.1)
 */
export function formatUiDisplayName(rawOrSpokenName: string, maxChars = 16): string {
  const base = sanitizeSpokenName(rawOrSpokenName);
  const chars = Array.from(base);
  if (chars.length <= maxChars) {
    return base;
  }
  return `${chars.slice(0, maxChars - 1).join('').trimEnd()}…`;
}

