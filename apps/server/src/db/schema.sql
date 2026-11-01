CREATE TABLE IF NOT EXISTS blessings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  length TEXT NOT NULL CHECK (length IN ('short', 'full', 'opener', 'reject', 'group', 'grand')),
  text TEXT NOT NULL UNIQUE,
  occasion TEXT DEFAULT NULL CHECK (occasion IN ('trung_thu', 'tet', 'cuoi_nam') OR occasion IS NULL),
  weight INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  audio_path TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_blessings_lookup ON blessings(category, length, active, occasion);

CREATE TABLE IF NOT EXISTS wishes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  used_visit_id TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_wishes_user_created ON wishes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wishes_created_at ON wishes(created_at);

CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  tier TEXT NOT NULL,
  total_coins INTEGER NOT NULL,
  blessing_source TEXT NOT NULL,
  category TEXT NOT NULL,
  wish_rejected INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits(created_at DESC);

CREATE TABLE IF NOT EXISTS banned_words (
  word TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

