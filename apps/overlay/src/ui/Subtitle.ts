import type Phaser from 'phaser';
import { THEME } from '../theme.js';

export type SubtitleSegment = {
  text: string;
  lines: string[];
  words: string[];
  durationMs: number;
  startMs: number;
};

/**
 * Chia lời chúc thành các đoạn <= 3 dòng (~36 ký tự/dòng), ưu tiên ngắt theo câu/dấu phẩy,
 * không bao giờ cắt giữa từ. Thời lượng mỗi đoạn tỉ lệ theo số ký tự trên tổng durationMs.
 */
export function buildSubtitleSegments(
  fullText: string,
  totalDurationMs: number,
  maxCharsPerLine = 36,
  maxLinesPerSegment = 3,
): SubtitleSegment[] {
  const cleaned = fullText.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  // Tách thành các mệnh đề nhỏ theo dấu câu (., !, ?, ;, ,) nếu câu dài
  const words = cleaned.split(' ').filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
      continue;
    }
    const candidate = `${currentLine} ${word}`;
    if (Array.from(candidate).length <= maxCharsPerLine) {
      currentLine = candidate;
      // Nếu kết thúc bằng dấu chấm câu kết thúc câu và dòng đã đủ dài (> 20 ký tự), ngắt dòng tự nhiên
      if (/[.!?]$/.test(word) && Array.from(currentLine).length >= 20) {
        lines.push(currentLine);
        currentLine = '';
      }
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  // Gom các dòng thành từng đoạn tối đa 3 dòng
  const rawSegments: Array<{ lines: string[]; text: string; charCount: number }> = [];
  for (let i = 0; i < lines.length; i += maxLinesPerSegment) {
    const segLines = lines.slice(i, i + maxLinesPerSegment);
    const segText = segLines.join('\n');
    const charCount = Math.max(1, Array.from(segLines.join(' ')).length);
    rawSegments.push({ lines: segLines, text: segText, charCount });
  }

  const totalChars = rawSegments.reduce((sum, s) => sum + s.charCount, 0);
  const safeTotalMs = Math.max(800, totalDurationMs);

  let elapsedMs = 0;
  return rawSegments.map((seg, idx) => {
    const isLast = idx === rawSegments.length - 1;
    const dur = isLast
      ? Math.max(300, safeTotalMs - elapsedMs)
      : Math.max(300, Math.round((seg.charCount / totalChars) * safeTotalMs));
    const startMs = elapsedMs;
    elapsedMs += dur;
    return {
      text: seg.text,
      lines: seg.lines,
      words: seg.lines.join(' ').split(/\s+/).filter(Boolean),
      durationMs: dur,
      startMs,
    };
  });
}

export class SubtitleView {
  public readonly container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private wordTexts: Phaser.GameObjects.Text[] = [];
  private wordContainer: Phaser.GameObjects.Container;
  private timers: Array<ReturnType<typeof setTimeout>> = [];

  constructor(scene: Phaser.Scene, panelFactory: (x: number, y: number, w: number, h: number) => Phaser.GameObjects.Container) {
    this.scene = scene;
    // Vị trí theo UI_SPEC §5.1: (60, 410, 960 x 224)
    this.container = panelFactory(60, 410, 960, 224);
    this.container.setVisible(false);

    // Vạch phân cách hình lá phía trên
    if (scene.textures.exists('ui.leaf_divider')) {
      const divider = scene.add.image(480, 22, 'ui.leaf_divider');
      divider.setDisplaySize(360, 24);
      this.container.add(divider);
    }

    this.wordContainer = scene.add.container(480, 122);
    this.container.add(this.wordContainer);
  }

  public play(text: string, durationMs: number): void {
    this.stop();
    const segments = buildSubtitleSegments(text, durationMs, 36, 3);
    if (segments.length === 0) return;

    this.container.setVisible(true);
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 300,
      ease: 'Cubic.Out',
    });

    for (const seg of segments) {
      const t = setTimeout(() => {
        this.renderSegmentWords(seg);
      }, seg.startMs);
      this.timers.push(t);
    }
  }

  private renderSegmentWords(seg: SubtitleSegment): void {
    this.clearWords();

    const lineHeight = 58; // 42px * 1.38
    const totalHeight = (seg.lines.length - 1) * lineHeight;
    const startY = -totalHeight / 2;

    const allWordNodes: Phaser.GameObjects.Text[] = [];

    seg.lines.forEach((lineStr, lineIdx) => {
      const y = startY + lineIdx * lineHeight;
      const lineWords = lineStr.split(/\s+/).filter(Boolean);

      // Tạo tạm các từ để đo chiều rộng tổng của dòng
      const createdWords = lineWords.map((w) => {
        const t = this.scene.add.text(0, y, w, {
          fontFamily: THEME.fonts.sans,
          fontSize: '42px',
          fontStyle: '500',
          color: THEME.colors.textOnDark,
        });
        t.setOrigin(0, 0.5);
        t.setAlpha(0);
        this.wordContainer.add(t);
        allWordNodes.push(t);
        return t;
      });

      const spaceWidth = 12;
      const lineWidth =
        createdWords.reduce((sum, node) => sum + node.width, 0) +
        Math.max(0, createdWords.length - 1) * spaceWidth;

      let cursorX = -lineWidth / 2;
      for (const node of createdWords) {
        node.setX(cursorX);
        cursorX += node.width + spaceWidth;
      }
    });

    this.wordTexts = allWordNodes;
    const wordStepMs =
      allWordNodes.length > 0
        ? Math.max(40, Math.floor((seg.durationMs * 0.85) / allWordNodes.length))
        : 100;

    allWordNodes.forEach((node, idx) => {
      const t = setTimeout(() => {
        if (!node.scene) return;
        this.scene.tweens.add({
          targets: node,
          alpha: 1,
          duration: 120,
          ease: 'Quad.Out',
        });
      }, idx * wordStepMs);
      this.timers.push(t);
    });
  }

  private clearWords(): void {
    for (const w of this.wordTexts) {
      w.destroy();
    }
    this.wordTexts = [];
    this.wordContainer.removeAll(true);
  }

  public stop(): void {
    for (const t of this.timers) {
      clearTimeout(t);
    }
    this.timers = [];
    this.clearWords();
    this.container.setVisible(false);
  }
}
