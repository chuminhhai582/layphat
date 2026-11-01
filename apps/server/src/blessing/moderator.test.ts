import { describe, it, expect } from 'vitest';
import { WishModerator, type AnthropicClientLike } from './moderator.js';

describe('T23 - WishModerator', () => {
  it('immediately rejects banned words without calling AI', async () => {
    let called = false;
    const mockClient: AnthropicClientLike = {
      messages: {
        async create() {
          called = true;
          return { content: [] };
        },
      },
    };
    const mod = new WishModerator({ client: mockClient });
    const res = await mod.check('Minh', 'ước gì chiều nay trúng số đề');
    expect(res?.allowed).toBe(false);
    expect(called).toBe(false);
  });

  it('returns null when no ANTHROPIC_API_KEY is configured (bank-only mode)', async () => {
    const mod = new WishModerator({ apiKey: '' });
    const res = await mod.check('Minh', 'ước thi đỗ đại học');
    expect(res).toBeNull();
  });

  it('parses valid AI approval response', async () => {
    const mockClient: AnthropicClientLike = {
      messages: {
        async create() {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  allowed: true,
                  category: 'hoc_hanh',
                  blessing: 'Bụt chúc {ten} ôn bài sáng suốt, đi thi bình tĩnh.',
                  reason: 'Hợp lệ',
                }),
              },
            ],
          };
        },
      },
    };
    const mod = new WishModerator({ client: mockClient });
    const res = await mod.check('Lan', 'ước mai thi tốt');
    expect(res).toEqual({
      allowed: true,
      category: 'hoc_hanh',
      blessing: 'Bụt chúc {ten} ôn bài sáng suốt, đi thi bình tĩnh.',
      reason: 'Hợp lệ',
    });
  });

  it('handles AI rejection response', async () => {
    const mockClient: AnthropicClientLike = {
      messages: {
        async create() {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  allowed: false,
                  category: 'khac',
                  blessing: '',
                  reason: 'Trù ẻo người khác',
                }),
              },
            ],
          };
        },
      },
    };
    const mod = new WishModerator({ client: mockClient });
    const res = await mod.check('Lan', 'ước kẻ thù gặp xui xẻo');
    expect(res?.allowed).toBe(false);
  });

  it('returns null on malformed JSON or timeout', async () => {
    const badJsonClient: AnthropicClientLike = {
      messages: {
        async create() {
          return { content: [{ type: 'text', text: 'Not valid JSON' }] };
        },
      },
    };
    const modBad = new WishModerator({ client: badJsonClient });
    expect(await modBad.check('Lan', 'ước bình an')).toBeNull();

    const slowClient: AnthropicClientLike = {
      messages: {
        async create() {
          await new Promise((r) => setTimeout(r, 200));
          return { content: [] };
        },
      },
    };
    const modSlow = new WishModerator({ client: slowClient, timeoutMs: 30 });
    expect(await modSlow.check('Lan', 'ước bình an')).toBeNull();
  });

  it('returns null if AI blessing output contains forbidden religious terms or banned words', async () => {
    const religiousClient: AnthropicClientLike = {
      messages: {
        async create() {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  allowed: true,
                  category: 'binh_an',
                  blessing: 'Nam mô A Di Đà Phật, chúc {ten} bình an.',
                  reason: 'ok',
                }),
              },
            ],
          };
        },
      },
    };
    const mod = new WishModerator({ client: religiousClient });
    expect(await mod.check('Lan', 'ước bình an')).toBeNull();
  });
});

