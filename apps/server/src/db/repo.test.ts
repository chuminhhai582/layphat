import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Repo, setRepo } from './repo.js';
import { getSettings, updateSettings } from '../config.js';

describe('T03 - SQLite Repo', () => {
  let repo: Repo;

  beforeEach(() => {
    repo = new Repo(':memory:');
    setRepo(repo);
  });

  afterEach(() => {
    setRepo(null);
    repo.close();
  });

  it('performs CRUD on blessings without duplicating on upsert', () => {
    const b1 = repo.upsertBlessing({
      category: 'binh_an',
      length: 'full',
      text: 'Bụt chúc {ten} bình an.',
      weight: 2,
    });
    expect(b1.id).toBeGreaterThan(0);

    // Upsert same text should not duplicate
    const b1Dup = repo.upsertBlessing({
      category: 'binh_an',
      length: 'full',
      text: 'Bụt chúc {ten} bình an.',
      weight: 5,
    });
    expect(b1Dup.id).toBe(b1.id);
    expect(b1Dup.weight).toBe(5);
    expect(repo.listBlessings()).toHaveLength(1);

    const updated = repo.updateBlessing(b1.id, { active: 0 });
    expect(updated?.active).toBe(0);
    expect(repo.listBlessings({ activeOnly: true })).toHaveLength(0);
  });

  it('stores wishes and respects TTL and markWishUsed', () => {
    const t0 = 1_000_000;
    repo.addWish('u1', 'ước: thi đỗ', t0);
    const w2 = repo.addWish('u1', 'ước: mẹ khỏe mạnh', t0 + 5000);

    // Within 30 mins TTL -> returns latest wish w2
    const found = repo.latestWish('u1', 1800000, t0 + 10000);
    expect(found?.id).toBe(w2.id);
    expect(found?.raw_text).toBe('ước: mẹ khỏe mạnh');

    // Past TTL -> returns null
    const expired = repo.latestWish('u1', 1800000, t0 + 1805001);
    expect(expired).toBeNull();

    // Mark used -> returns previous unused wish if still within TTL
    repo.markWishUsed(w2.id, 'visit-1');
    const fallback = repo.latestWish('u1', 1800000, t0 + 10000);
    expect(fallback?.raw_text).toBe('ước: thi đỗ');
  });

  it('persists settings to SQLite when updateSettings is called', () => {
    expect(getSettings().seatCount).toBe(36);
    updateSettings({ seatCount: 42 });
    expect(repo.loadSettings().seatCount).toBe(42);
  });

  it('manages banned words and visits', () => {
    repo.addBannedWordsBulk(['số đề', 'lô đề', 'bùa yêu', 'số đề']);
    expect(repo.listBannedWords()).toEqual(['bùa yêu', 'lô đề', 'số đề']);
    expect(repo.removeBannedWord('lô đề')).toBe(true);
    expect(repo.listBannedWords()).toEqual(['bùa yêu', 'số đề']);

    repo.insertVisit({
      id: 'v1',
      user_id: 'u1',
      nickname: 'Lan',
      tier: 'miracle',
      total_coins: 500,
      blessing_source: 'ai',
      category: 'hoc_hanh',
      wish_rejected: false,
      created_at: 123456,
    });
    const visits = repo.listRecentVisits();
    expect(visits).toHaveLength(1);
    expect(visits[0]?.nickname).toBe('Lan');
  });
});

