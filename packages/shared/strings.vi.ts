import type { TierId, WishCategory } from './types.js';

export const STRINGS_VI = {
  // Tiêu đề & chung
  APP_NAME: 'Bụt Ơi Live',
  ADMIN_TITLE: 'Bụt Ơi Live – Admin',
  DEFAULT_VIEWER_PRONOUN: 'con',

  // Băng rôn & Con dấu bậc (UI_SPEC §5.1)
  BANNER_VISITING_LABEL: 'ÔNG BỤT ĐANG THĂM',
  IDLE_LOGO_TITLE: 'Làng Bụt Ơi',
  GROUP_VISIT_COUNTDOWN_LABEL: 'Bụt ghé làng sau',
  TIER_LABELS: {
    firefly: 'Đom đóm ước',
    visit: 'Bụt hiện',
    miracle: 'Phép màu',
    grand: 'Đại phép',
  } satisfies Record<TierId, string>,

  // Chú thích bắt buộc (UI_SPEC §5.1 & Ràng buộc 4)
  DISCLAIMER_TEXT: 'Trò chơi giải trí lấy cảm hứng từ truyện cổ tích',

  // Thẻ hướng dẫn (UI_SPEC §5.1 & §5.3)
  HOW_TO_TITLE: 'CÁCH CHƠI',
  HOW_TO_LINES: [
    'Gõ "ước: …" để treo một lá ước lên cây đa.',
    'Thả tim để thả đom đóm, gõ "Bụt ơi" để gọi Bụt.',
    'Bụt ghé thăm cả làng mỗi 4 phút, và hay hiện ra thăm người tặng quà.',
  ] as const,
  HOW_TO_HIGHLIGHTS: ['"ước: …"', '"Bụt ơi"'] as const,

  // Hàng chờ & Trạng thái (UI_SPEC §4.2 & §5.1)
  QUEUE_CARD_TITLE: 'Bụt sắp ghé thăm',
  QUEUE_CHIP_WAITING: '+{n} đang chờ',
  PAUSE_NOTICE: 'Bụt đang nghỉ chân một lát',
  VILLAGER_COUNTER_SHORT: '+{n} dân làng',
  VILLAGER_COUNTER_FULL: '+{n} dân làng đang ghé chơi',
  FLOATING_LUCK_PLUS_ONE: 'may mắn +1',
  VILLAGE_BOOK_BADGE: 'Đã ghi vào Sổ làng',

  // Âm thanh (T21)
  ENABLE_AUDIO_BUTTON: 'Bật âm thanh',

  // Danh mục điều ước
  CATEGORY_LABELS: {
    binh_an: 'Bình an',
    suc_khoe: 'Sức khỏe',
    hoc_hanh: 'Học hành',
    cong_viec: 'Công việc',
    gia_dao: 'Gia đạo',
    tinh_duyen: 'Tình duyên',
    tai_loc: 'Tài lộc',
    tuong_nho: 'Tưởng nhớ',
    khac: 'Khác',
  } satisfies Record<WishCategory, string>,

  // Thông báo lỗi cấu hình (T02)
  ENV_VALIDATION_ERROR_HEADER: 'Lỗi cấu hình biến môi trường (.env):',
  ENV_MISSING_TIKTOK_USERNAME:
    'Thiếu biến bắt buộc TIKTOK_USERNAME khi EVENT_SOURCE là connector.',
  SETTINGS_VALIDATION_ERROR: 'Dữ liệu cấu hình (settings) không hợp lệ',

  // Giao diện Admin (T31 - T34)
  ADMIN: {
    PIN_TITLE: 'Đăng nhập Quản trị',
    PIN_PLACEHOLDER: 'Nhập mã PIN quản trị',
    PIN_SUBMIT: 'Vào bảng điều khiển',
    PIN_ERROR: 'Mã PIN không đúng hoặc mất kết nối',
    NAV_LIVE: 'Trực tiếp',
    NAV_MANUAL: 'Gọi Bụt',
    NAV_BANK: 'Kho câu',
    NAV_WORDS: 'Từ cấm',
    NAV_SETTINGS: 'Cấu hình',
    NAV_SIMULATOR: 'Giả lập',
    SOURCE_STATUS_TITLE: 'Nguồn sự kiện',
    SOURCE_SWITCH_LABEL: 'Đổi nguồn',
    STATUS_LIVE: 'Đang phát',
    STATUS_CONNECTING: 'Đang kết nối',
    STATUS_OFFLINE: 'Ngoại tuyến',
    STATUS_ERROR: 'Lỗi kết nối',
    LATENCY_LABEL: 'Độ trễ',
    PAUSE_BUD: 'Tạm dừng Bụt',
    RESUME_BUD: 'Tiếp tục Bụt',
    CURRENT_VISIT_TITLE: 'Lượt đang diễn',
    NO_CURRENT_VISIT: 'Đang ở trạng thái chờ',
    QUEUE_TITLE: 'Hàng chờ Bụt hiện',
    QUEUE_EMPTY: 'Chưa có lượt nào trong hàng chờ',
    BTN_SKIP: 'Bỏ qua',
    BTN_PROMOTE: 'Đưa lên đầu',
    BTN_REPLAY: 'Đọc lại',
    BTN_CHANGE_BLESSING: 'Đổi câu',
    PREVIEW_POPUP_TITLE: 'Xem trước lời Bụt (AI viết)',
    MANUAL_TITLE: 'Tạo lượt Bụt hiện thủ công',
    MANUAL_NAME_LABEL: 'Tên người nhận',
    MANUAL_TIER_LABEL: 'Bậc xuất hiện',
    MANUAL_WISH_LABEL: 'Lời ước (tùy chọn)',
    MANUAL_SUBMIT: 'Gọi Bụt ngay',
    BANK_TITLE: 'Kho lời chúc của Bụt',
    BANK_ADD: 'Thêm câu mới',
    BANK_PREVIEW_VOICE: 'Nghe thử',
    BANK_REGEN_VOICE: 'Tạo lại giọng',
    WORDS_TITLE: 'Danh sách từ cấm',
    WORDS_BULK_PLACEHOLDER: 'Mỗi dòng một từ hoặc cụm từ cấm...',
    WORDS_ADD_BTN: 'Thêm từ cấm',
    SETTINGS_TITLE: 'Cấu hình hệ thống',
    SETTINGS_SAVE: 'Lưu cấu hình',
    SETTINGS_SAVED: 'Đã lưu cấu hình thành công',
    SIM_TITLE: 'Bộ giả lập sự kiện Live',
    SIM_VIEWER_NAME_PLACEHOLDER: 'Tên người xem tùy chọn (để trống = ngẫu nhiên)',
    SIM_JOIN: 'Vào xem',
    SIM_LIKE: 'Thả tim',
    SIM_CALL_BUD: 'Gõ "Bụt ơi"',
    SIM_GOOD_WISH: 'Lời ước tốt',
    SIM_BAD_WISH: 'Lời ước xấu',
    SIM_FOLLOW: 'Theo dõi',
    SIM_SHARE: 'Chia sẻ',
    SIM_BURST_GIFTS: 'Mưa quà 50 lượt',
    SIM_BURST_JOINS: 'Mưa người vào 100',
  },
} as const;

export function formatViString(template: string, params: Record<string, string | number>): string {
  let out = template;
  for (const [key, value] of Object.entries(params)) {
    out = out.replaceAll(`{${key}}`, String(value));
  }
  return out;
}
