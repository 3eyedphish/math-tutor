-- Everyone allowed in by Cloudflare Access is one family and sees the same player profiles.
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  pin_hash TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0
);
-- Latest learner state (levels, teaching-style scores, stickers…) as JSON.
CREATE TABLE IF NOT EXISTS progress (
  profile_id TEXT PRIMARY KEY REFERENCES profiles(id),
  state TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
-- Completion history: one row per answered question.
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  t INTEGER NOT NULL,
  skill TEXT NOT NULL,
  level INTEGER NOT NULL,
  approach TEXT NOT NULL,
  correct INTEGER NOT NULL,
  first_try INTEGER NOT NULL,
  hint INTEGER NOT NULL,
  ms INTEGER NOT NULL,
  question TEXT,
  given TEXT,
  answer TEXT,
  UNIQUE (profile_id, t)
);
CREATE INDEX IF NOT EXISTS events_profile_t ON events (profile_id, t);
-- Daily AI-call counter so a runaway loop can't run up the Anthropic bill.
CREATE TABLE IF NOT EXISTS ai_usage (day TEXT PRIMARY KEY, calls INTEGER NOT NULL);
