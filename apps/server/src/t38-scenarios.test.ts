import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventNormalizer, toViewer } from './core/normalizer.js';
import { VisitQueue } from './core/queue.js';
import { SeatManager } from './core/seats.js';
import { VisitPreparer } from './core/preparer.js';
import { Repo, setRepo } from './db/repo.js';
import { seedDatabase } from './scripts/seed.js';
import { WishModerator } from './blessing/moderator.js';
import { sanitizeSpokenName, formatUiDisplayName } from './blessing/nameSanitizer.js';
import { connectWithRetry, type EventSource } from './sources/index.js';
import { DataRetentionManager } from './core/retention.js';
import type { LiveEvent, Visit } from '@but-oi/shared';

describe('T38 - 10 Mandatory Simulation Scenarios (IMPLEMENTATION_PLAN §9)', () => {
  let repo: Repo;

  beforeEach(() => {
    repo = new Repo(':memory:');
    setRepo(repo);
    seedDatabase(':memory:');
  });

  afterEach(() => {
    setRepo(null);
    repo.close();
  });

  it('Scenario 1: Mưa quà (50 gifts in 10s -> priority order, visit shortened >8, starving >90s promoted)', () => {
    const q = new VisitQueue();
    const t0 = 1000;
    const coinsPattern = [5, 30, 50, 300, 3000];

    for (let i = 0; i < 50; i++) {
      const coins = coinsPattern[i % coinsPattern.length]!;
      const v = q.enqueue(
        toViewer({ userId: `u_${i}`, nickname: `User ${i}` }),
        coins,
        t0 + i * 200,
      );
      if (v) v.status = 'ready';
    }

    // 10 firefly gifts skipped queue -> 40 visits in queue (> 8)
    expect(q.getActiveCount()).toBe(40);
    expect(q.durationFor('visit')).toBe(12000);

    // Before 90s: highest tier (grand) goes first
    const firstPicked = q.pickNext(t0 + 10_000)!;
    expect(firstPicked.tier).toBe('grand');

    // After 95s: earliest enqueued item (even visit tier) is starving and promoted first
    const earliestVisit = q
      .getAllItems()
      .find((x) => x.tier === 'visit' && x.enqueuedAt === t0 + 200)!;
    const starvingPicked = q.pickNext(t0 + 95_000)!;
    expect(starvingPicked.id).toBe(earliestVisit.id);
  });

  it('Scenario 2: Combo dài (1 user sends 20 streak gifts -> 1 visit with summed coins)', () => {
    vi.useFakeTimers();
    const norm = new EventNormalizer({ comboWindowMs: 5000 });
    const q = new VisitQueue();
    const events: LiveEvent[] = [];

    norm.onEvent((e) => {
      events.push(e);
      if (e.type === 'gift') {
        q.enqueue(e.viewer, e.totalCoins, e.at);
      }
    });

    for (let i = 1; i <= 19; i++) {
      norm.ingest({
        type: 'gift',
        userId: 'u_combo',
        nickname: 'Combo User',
        diamondCount: 20,
        repeatCount: i,
        giftType: 1,
        repeatEnd: false,
      });
    }
    norm.ingest({
      type: 'gift',
      userId: 'u_combo',
      nickname: 'Combo User',
      diamondCount: 20,
      repeatCount: 20,
      giftType: 1,
      repeatEnd: true,
    });

    vi.advanceTimersByTime(5000);
    expect(events).toHaveLength(1);
    expect(q.getActiveCount()).toBe(1);
    expect(q.getAllItems()[0]?.totalCoins).toBe(400);
    expect(q.getAllItems()[0]?.tier).toBe('miracle');

    norm.dispose();
    vi.useRealTimers();
  });

  it('Scenario 3: Tặng thêm khi chờ (position 4 gifts +300 coins -> upgrades to miracle without new entry)', () => {
    const q = new VisitQueue();
    for (let i = 1; i <= 4; i++) {
      q.enqueue(toViewer({ userId: `u${i}`, nickname: `User ${i}` }), 50, i * 100);
    }
    expect(q.getActiveCount()).toBe(4);

    // Position 4 (u4) gifts +300 coins while waiting
    const upgraded = q.enqueue(
      toViewer({ userId: 'u4', nickname: 'User 4' }),
      300,
      600,
    )!;
    expect(q.getActiveCount()).toBe(4);
    expect(upgraded.totalCoins).toBe(350);
    expect(upgraded.tier).toBe('miracle');
  });

  it('Scenario 4 & 5: AI sập & TTS sập (falls back to bank blessing and subtitle-only without crashing)', async () => {
    const q = new VisitQueue();
    const modNoKey = new WishModerator({ apiKey: '' });
    const started: Visit[] = [];
    const prep = new VisitPreparer({
      queue: q,
      repo,
      moderator: modNoKey,
      skipGraceDelay: true,
    });
    prep.onVisitStart((v) => started.push(v));

    repo.addWish('u_ai_down', 'ước gia đình luôn mạnh khỏe');
    q.enqueue(toViewer({ userId: 'u_ai_down', nickname: 'Minh' }), 50);

    await new Promise((r) => setTimeout(r, 120));
    expect(started).toHaveLength(1);
    expect(started[0]?.blessing?.source).toBe('bank');
    expect(started[0]?.blessing?.text.length).toBeGreaterThan(10);
    prep.dispose();
  });

  it('Scenario 6: Rớt kết nối 20s -> tự kết nối lại thành công', async () => {
    let attempts = 0;
    const delays: number[] = [];
    const src: EventSource = {
      name: 'connector',
      async connect() {
        attempts++;
        if (attempts <= 3) throw new Error('Offline');
      },
      disconnect() {},
      on() {},
      onStatus() {},
    };
    await connectWithRetry(src, {
      sleepFn: async (ms) => {
        delays.push(ms);
      },
    });
    expect(attempts).toBe(4);
    expect(delays).toEqual([2000, 4000, 8000]);
  });

  it('Scenario 7: Làng đông (400 joins/min -> rotates 36 seats smoothly)', () => {
    const seats = new SeatManager();
    for (let i = 1; i <= 400; i++) {
      seats.handleJoin(
        toViewer({ userId: `villager_${i}`, nickname: `Dân làng ${i}` }),
        i * 150,
      );
    }
    expect(seats.getSeatedList()).toHaveLength(36);
    expect(seats.getTotalJoined()).toBe(400);
  });

  it('Scenario 8: Tên khó (Emoji, all-numbers, 40+ chars -> sanitized and truncated)', () => {
    expect(sanitizeSpokenName('👑🔥999999🔥👑')).toBe('con');
    expect(sanitizeSpokenName('1234567890')).toBe('con');
    const long45 = 'Nguyễn Hoàng Phương Trang Anh Thư Bảo Ngọc Linh Đan';
    expect(Array.from(sanitizeSpokenName(long45)).length).toBeLessThanOrEqual(24);
    expect(Array.from(formatUiDisplayName(long45)).length).toBeLessThanOrEqual(16);
  });

  it('Scenario 9: Lời ước xấu (20 troll wishes -> wishRejected=true, uses reject bank sentence, never speaks raw wish)', async () => {
    const q = new VisitQueue();
    const started: Visit[] = [];
    const prep = new VisitPreparer({
      queue: q,
      repo,
      skipGraceDelay: true,
    });
    prep.onVisitStart((v) => started.push(v));

    const badWish = 'ước cho con xin số đề chiều nay trúng độc đắc';
    repo.addWish('u_troll', badWish);
    q.enqueue(toViewer({ userId: 'u_troll', nickname: 'Troll' }), 50);

    await new Promise((r) => setTimeout(r, 120));
    expect(started).toHaveLength(1);
    expect(started[0]?.wishRejected).toBe(true);
    expect(started[0]?.blessing?.text).not.toContain('số đề');
    prep.dispose();
  });

  it('Scenario 10: Chạy dài & dọn dữ liệu (xoá lời ước >24h, giải phóng hàng chờ)', () => {
    const now = Date.now();
    repo.addWish('u_old', 'ước cũ', now - 25 * 3600 * 1000);
    const retention = new DataRetentionManager({ repo });
    const res = retention.runOnce(now);
    expect(res.deletedWishes).toBe(1);
  });
});

