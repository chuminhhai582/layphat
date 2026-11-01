import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { WishCategory } from '@but-oi/shared';
import { containsBannedWord, containsForbiddenReligiousTerm } from './bannedWords.js';

/**
 * Prompt hệ thống NGUYÊN VĂN theo IMPLEMENTATION_PLAN.md mục 7.2
 */
export const MODERATOR_SYSTEM_PROMPT = `Bạn đóng vai Ông Bụt trong truyện cổ tích Việt Nam: một ông lão hiền hậu, hóm hỉnh, hiện ra giúp người tốt.
Đây là trò chơi giải trí trên livestream, KHÔNG phải nghi lễ tôn giáo.
Đầu vào: tên người xem và lời ước họ gõ (có thể sai chính tả, viết tắt, không dấu, teencode).
Nhiệm vụ: quyết định có dùng được không, rồi viết lại thành lời Bụt chúc.

TỪ CHỐI (allowed=false) nếu lời ước: tục tĩu; xúc phạm bất kỳ tôn giáo, dân tộc, nhóm người nào; trù ẻo, mong người khác gặp hại; bùa yêu, ép người khác yêu mình; chính trị, người nổi tiếng có thật; xin số đề, kết quả cá cược; quảng cáo, link; nội dung tình dục; nhắc tới tự hại.

VỚI LỜI ƯỚC HỢP LỆ, viết lời Bụt:
- 2 đến 4 câu, tổng dưới 70 từ, tiếng Việt có dấu.
- Bụt xưng "Bụt", gọi người nhận là "con" và nhắc tên bằng {ten} (giữ nguyên placeholder này).
- Giọng ông già ấm áp, mộc mạc, có thể hóm hỉnh nhẹ; được dùng hình ảnh làng quê (lúa, giếng, gốc đa, trăng).
- Là lời CHÚC, không phải lời HỨA: "Bụt chúc", "Bụt mong"; không khẳng định điều ước chắc chắn thành.
- Không dùng từ ngữ Phật giáo hay nghi lễ: không "Nam mô", "A Di Đà", "Phật", "công đức", "cúng dường", "siêu độ", "giải hạn", "phù hộ độ trì".
- Sức khỏe, bệnh tật: không nhắc tên bệnh cụ thể, chỉ nói "người thân đang mệt"; chúc mau khỏe, an tâm điều trị; không nói thay thầy thuốc.
- Người thân đã mất: an ủi người đang nhớ thương, không nói về kiếp sau hay siêu thoát.
- Không nhắc tên người thứ ba có trong lời ước; dùng "người con thương", "mẹ con".
- Không nhắc tiền hay quà tặng.
Phân loại category: binh_an | suc_khoe | hoc_hanh | cong_viec | gia_dao | tinh_duyen | tai_loc | tuong_nho | khac.
Chỉ trả về JSON: {"allowed": bool, "category": string, "blessing": string, "reason": string}`;

export const ModerationResponseSchema = z.object({
  allowed: z.boolean(),
  category: z
    .enum([
      'binh_an',
      'suc_khoe',
      'hoc_hanh',
      'cong_viec',
      'gia_dao',
      'tinh_duyen',
      'tai_loc',
      'tuong_nho',
      'khac',
    ])
    .catch('khac'),
  blessing: z.string().default(''),
  reason: z.string().default(''),
});

export type ModerationResult = {
  allowed: boolean;
  category: WishCategory;
  blessing: string;
  reason: string;
};

export interface AnthropicClientLike {
  messages: {
    create: (params: {
      model: string;
      max_tokens: number;
      system: string;
      messages: Array<{ role: 'user'; content: string }>;
    }) => Promise<{
      content: Array<{ type: string; text?: string }>;
    }>;
  };
}

export class WishModerator {
  private client: AnthropicClientLike | null = null;
  private apiKey: string;
  private model: string;
  private timeoutMs: number;

  constructor(opts?: {
    apiKey?: string;
    model?: string;
    timeoutMs?: number;
    client?: AnthropicClientLike;
  }) {
    this.apiKey = (opts?.apiKey ?? process.env.ANTHROPIC_API_KEY ?? '').trim();
    this.model = opts?.model ?? process.env.AI_MODEL ?? 'claude-haiku-5-5';
    this.timeoutMs =
      opts?.timeoutMs ?? Number(process.env.AI_TIMEOUT_MS ?? 2500);

    if (opts?.client) {
      this.client = opts.client;
    } else if (this.apiKey) {
      this.client = new Anthropic({ apiKey: this.apiKey }) as unknown as AnthropicClientLike;
    }
  }

  public async check(
    displayName: string,
    rawWish: string,
  ): Promise<ModerationResult | null> {
    const cleanWish = rawWish.trim();
    if (!cleanWish) return null;

    // 1. Lọc nhanh bằng bannedWords trước; trúng -> trả allowed=false ngay, không gọi AI
    const bannedCheck = containsBannedWord(cleanWish);
    if (bannedCheck.matched) {
      return {
        allowed: false,
        category: 'khac',
        blessing: '',
        reason: `Chứa nội dung bị cấm: ${bannedCheck.word ?? 'banned'}`,
      };
    }

    // 2. Nếu không có ANTHROPIC_API_KEY (và không truyền mock client) -> trả null (chế độ chỉ dùng kho)
    if (!this.client) {
      return null;
    }

    // 3. Gọi Claude với timeout AI_TIMEOUT_MS
    try {
      const userPrompt = JSON.stringify({
        ten: displayName,
        loi_uoc: cleanWish,
      });

      const response = await Promise.race([
        this.client.messages.create({
          model: this.model,
          max_tokens: 300,
          system: MODERATOR_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('AI_TIMEOUT')), this.timeoutMs),
        ),
      ]);

      const firstBlock = response.content.find((b) => b.type === 'text');
      const rawText = firstBlock?.text?.trim() ?? '';
      if (!rawText) return null;

      // Trích xuất JSON nếu model bọc trong markdown fence
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : rawText;

      const parsedJson = JSON.parse(jsonStr) as unknown;
      const validated = ModerationResponseSchema.safeParse(parsedJson);
      if (!validated.success) {
        return null;
      }

      const data = validated.data;
      if (!data.allowed) {
        return {
          allowed: false,
          category: data.category,
          blessing: '',
          reason: data.reason || 'AI rejected',
        };
      }

      // 4. Kiểm tra lại lời chúc AI sinh ra không chứa từ cấm hoặc từ ngữ tôn giáo bị cấm
      if (!data.blessing.trim()) {
        return null;
      }
      if (
        containsBannedWord(data.blessing).matched ||
        containsForbiddenReligiousTerm(data.blessing)
      ) {
        return null;
      }

      return {
        allowed: true,
        category: data.category,
        blessing: data.blessing.trim(),
        reason: data.reason,
      };
    } catch {
      return null;
    }
  }
}

export const defaultModerator = new WishModerator();

