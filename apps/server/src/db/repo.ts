import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import type {
  BlessingLength,
  BlessingRecord,
  OccasionType,
  Settings,
  TierId,
  WishCategory,
} from '@but-oi/shared';
import {
  DEFAULT_SETTINGS,
  SettingsSchema,
  registerSettingsPersistence,
  setMemorySettings,
} from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

export type NewBlessingInput = {
  category: WishCategory;
  length: BlessingLength;
  text: string;
  occasion?: OccasionType;
  weight?: number;
  active?: number;
  audio_path?: string | null;
};

export type WishRecord = {
  id: string;
  user_id: string;
  raw_text: string;
  created_at: number;
  used_visit_id: string | null;
};

export type VisitRecordInput = {
  id: string;
  user_id: string;
  nickname: string;
  tier: TierId;
  total_coins: number;
  blessing_source: 'ai' | 'bank';
  category: WishCategory;
  wish_rejected: boolean;
  created_at?: number;
};

export type VisitRecordRow = {
  id: string;
  user_id: string;
  nickname: string;
  tier: TierId;
  total_coins: number;
  blessing_source: 'ai' | 'bank';
  category: WishCategory;
  wish_rejected: number;
  created_at: number;
};

export class Repo {
  public readonly db: Database.Database;

  constructor(dbPath = process.env.DB_PATH ?? 'data/but-oi-live.db') {
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  public initSchema(): void {
    const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
    this.db.exec(sql);
  }

  public close(): void {
    this.db.close();
  }

  // --- Blessings CRUD ---
  public listBlessings(filter?: {
    category?: WishCategory;
    length?: BlessingLength;
    occasion?: OccasionType;
    activeOnly?: boolean;
  }): BlessingRecord[] {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filter?.category) {
      clauses.push('category = ?');
      params.push(filter.category);
    }
    if (filter?.length) {
      clauses.push('length = ?');
      params.push(filter.length);
    }
    if (filter?.occasion !== undefined) {
      if (filter.occasion === null) {
        clauses.push('occasion IS NULL');
      } else {
        clauses.push('occasion = ?');
        params.push(filter.occasion);
      }
    }
    if (filter?.activeOnly) {
      clauses.push('active = 1');
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const stmt = this.db.prepare(`SELECT * FROM blessings ${where} ORDER BY id ASC`);
    return stmt.all(...params) as BlessingRecord[];
  }

  public getBlessingById(id: number): BlessingRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM blessings WHERE id = ?');
    return stmt.get(id) as BlessingRecord | undefined;
  }

  public upsertBlessing(input: NewBlessingInput): BlessingRecord {
    const stmt = this.db.prepare(`
      INSERT INTO blessings (category, length, text, occasion, weight, active, audio_path)
      VALUES (@category, @length, @text, @occasion, @weight, @active, @audio_path)
      ON CONFLICT(text) DO UPDATE SET
        category = excluded.category,
        length = excluded.length,
        occasion = excluded.occasion,
        weight = excluded.weight,
        active = excluded.active,
        audio_path = COALESCE(excluded.audio_path, blessings.audio_path)
    `);
    stmt.run({
      category: input.category,
      length: input.length,
      text: input.text,
      occasion: input.occasion ?? null,
      weight: input.weight ?? 1,
      active: input.active ?? 1,
      audio_path: input.audio_path ?? null,
    });
    const row = this.db
      .prepare('SELECT * FROM blessings WHERE text = ?')
      .get(input.text) as BlessingRecord;
    return row;
  }

  public updateBlessing(
    id: number,
    patch: Partial<Omit<NewBlessingInput, 'active'> & { active: number | boolean }>,
  ): BlessingRecord | undefined {
    const existing = this.getBlessingById(id);
    if (!existing) return undefined;

    const updated = {
      category: patch.category ?? existing.category,
      length: patch.length ?? existing.length,
      text: patch.text ?? existing.text,
      occasion: patch.occasion !== undefined ? patch.occasion : existing.occasion,
      weight: patch.weight ?? existing.weight,
      active:
        patch.active !== undefined ? (patch.active ? 1 : 0) : existing.active,
      audio_path: patch.audio_path !== undefined ? patch.audio_path : existing.audio_path,
      id,
    };

    this.db
      .prepare(
        `UPDATE blessings
         SET category = @category,
             length = @length,
             text = @text,
             occasion = @occasion,
             weight = @weight,
             active = @active,
             audio_path = @audio_path
         WHERE id = @id`,
      )
      .run(updated);

    return this.getBlessingById(id);
  }

  public deleteBlessing(id: number): boolean {
    const info = this.db.prepare('DELETE FROM blessings WHERE id = ?').run(id);
    return info.changes > 0;
  }

  // --- Wishes ---
  public addWish(userId: string, rawText: string, now = Date.now()): WishRecord {
    const id = nanoid();
    this.db
      .prepare(
        'INSERT INTO wishes (id, user_id, raw_text, created_at, used_visit_id) VALUES (?, ?, ?, ?, NULL)',
      )
      .run(id, userId, rawText, now);
    return {
      id,
      user_id: userId,
      raw_text: rawText,
      created_at: now,
      used_visit_id: null,
    };
  }

  public latestWish(userId: string, ttlMs: number, now = Date.now()): WishRecord | null {
    const minCreatedAt = now - ttlMs;
    const row = this.db
      .prepare(
        `SELECT * FROM wishes
         WHERE user_id = ?
           AND used_visit_id IS NULL
           AND created_at >= ?
         ORDER BY created_at DESC, rowid DESC
         LIMIT 1`,
      )
      .get(userId, minCreatedAt) as WishRecord | undefined;
    return row ?? null;
  }

  public markWishUsed(wishId: string, visitId: string): void {
    this.db
      .prepare('UPDATE wishes SET used_visit_id = ? WHERE id = ?')
      .run(visitId, wishId);
  }

  public deleteExpiredWishes(olderThanMs = 24 * 60 * 60 * 1000, now = Date.now()): number {
    const cutoff = now - olderThanMs;
    const info = this.db.prepare('DELETE FROM wishes WHERE created_at < ?').run(cutoff);
    return info.changes;
  }

  // --- Visits ---
  public insertVisit(v: VisitRecordInput): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO visits
         (id, user_id, nickname, tier, total_coins, blessing_source, category, wish_rejected, created_at)
         VALUES (@id, @user_id, @nickname, @tier, @total_coins, @blessing_source, @category, @wish_rejected, @created_at)`,
      )
      .run({
        id: v.id,
        user_id: v.user_id,
        nickname: v.nickname,
        tier: v.tier,
        total_coins: v.total_coins,
        blessing_source: v.blessing_source,
        category: v.category,
        wish_rejected: v.wish_rejected ? 1 : 0,
        created_at: v.created_at ?? Date.now(),
      });
  }

  public listRecentVisits(limit = 50): VisitRecordRow[] {
    return this.db
      .prepare('SELECT * FROM visits ORDER BY created_at DESC LIMIT ?')
      .all(limit) as VisitRecordRow[];
  }

  // --- Banned Words ---
  public listBannedWords(): string[] {
    const rows = this.db
      .prepare('SELECT word FROM banned_words ORDER BY word ASC')
      .all() as Array<{ word: string }>;
    return rows.map((r) => r.word);
  }

  public addBannedWord(word: string): void {
    const clean = word.trim().toLowerCase();
    if (!clean) return;
    this.db.prepare('INSERT OR IGNORE INTO banned_words (word) VALUES (?)').run(clean);
  }

  public addBannedWordsBulk(words: string[]): number {
    const insert = this.db.prepare('INSERT OR IGNORE INTO banned_words (word) VALUES (?)');
    let added = 0;
    const tx = this.db.transaction((items: string[]) => {
      for (const w of items) {
        const clean = w.trim().toLowerCase();
        if (!clean) continue;
        const res = insert.run(clean);
        added += res.changes;
      }
    });
    tx(words);
    return added;
  }

  public removeBannedWord(word: string): boolean {
    const clean = word.trim().toLowerCase();
    const res = this.db.prepare('DELETE FROM banned_words WHERE word = ?').run(clean);
    return res.changes > 0;
  }

  // --- Settings ---
  public loadSettings(): Settings {
    const row = this.db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get('app_settings') as { value: string } | undefined;

    if (!row) {
      this.saveSettings(DEFAULT_SETTINGS);
      setMemorySettings(DEFAULT_SETTINGS);
      return structuredClone(DEFAULT_SETTINGS);
    }

    try {
      const parsed = SettingsSchema.parse(JSON.parse(row.value));
      setMemorySettings(parsed);
      return structuredClone(parsed);
    } catch {
      this.saveSettings(DEFAULT_SETTINGS);
      setMemorySettings(DEFAULT_SETTINGS);
      return structuredClone(DEFAULT_SETTINGS);
    }
  }

  public saveSettings(settings: Settings): void {
    const validated = SettingsSchema.parse(settings);
    this.db
      .prepare(
        `INSERT INTO settings (key, value) VALUES ('app_settings', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(JSON.stringify(validated));
  }

  public bindConfigPersistence(): void {
    this.loadSettings();
    registerSettingsPersistence({
      save: (s) => this.saveSettings(s),
    });
  }
}

let defaultRepo: Repo | null = null;

export function getRepo(dbPath?: string): Repo {
  if (!defaultRepo) {
    defaultRepo = new Repo(dbPath);
    defaultRepo.bindConfigPersistence();
  }
  return defaultRepo;
}

export function setRepo(repo: Repo | null): void {
  defaultRepo = repo;
  if (repo) {
    repo.bindConfigPersistence();
  } else {
    registerSettingsPersistence({});
  }
}

