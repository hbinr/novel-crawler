-- SQLite schema for novel-crawler console
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  display_name  TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'user',
  created_at    INTEGER NOT NULL
);

-- 会话表（httpOnly cookie 关联）
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS books (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  uid          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL,
  book_url     TEXT    NOT NULL,
  parser       TEXT    NOT NULL DEFAULT 'yuebiqu',
  output_dir   TEXT    NOT NULL,
  min_cn       INTEGER NOT NULL DEFAULT 1000,
  pad          INTEGER NOT NULL DEFAULT 4,
  interval_lo  REAL    NOT NULL DEFAULT 0.3,
  interval_hi  REAL    NOT NULL DEFAULT 0.6,
  retries      INTEGER NOT NULL DEFAULT 3,
  ua           TEXT    NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  UNIQUE(uid, book_url)
);

CREATE TABLE IF NOT EXISTS chapters (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  uid          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id      INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  idx          INTEGER NOT NULL,
  article_id   TEXT    NOT NULL,
  title        TEXT    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'pending',
  pages        INTEGER NOT NULL DEFAULT 0,
  cn_count     INTEGER NOT NULL DEFAULT 0,
  bytes        INTEGER NOT NULL DEFAULT 0,
  error        TEXT,
  updated_at   INTEGER NOT NULL,
  UNIQUE(book_id, idx)
);

CREATE INDEX IF NOT EXISTS idx_chapters_book ON chapters(book_id);
CREATE INDEX IF NOT EXISTS idx_chapters_uid ON chapters(uid);

CREATE TABLE IF NOT EXISTS tasks (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  uid             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id         INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  status          TEXT    NOT NULL DEFAULT 'queued',
  start_idx       INTEGER NOT NULL DEFAULT 1,
  end_idx         INTEGER,
  total           INTEGER NOT NULL DEFAULT 0,
  done            INTEGER NOT NULL DEFAULT 0,
  failed          INTEGER NOT NULL DEFAULT 0,
  current_chapter TEXT,
  started_at      INTEGER,
  finished_at     INTEGER,
  created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_book ON tasks(book_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_uid ON tasks(uid);
CREATE INDEX IF NOT EXISTS idx_tasks_status_created ON tasks(status, created_at);

CREATE TABLE IF NOT EXISTS logs (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  uid      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ts       INTEGER NOT NULL,
  level    TEXT    NOT NULL,
  task_id  INTEGER,
  book_id  INTEGER,
  msg      TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_ts ON logs(ts DESC);
CREATE INDEX IF NOT EXISTS idx_logs_task ON logs(task_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_logs_uid ON logs(uid);

CREATE TABLE IF NOT EXISTS settings (
  uid INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  k   TEXT NOT NULL,
  v   TEXT NOT NULL,
  PRIMARY KEY(uid, k)
);

-- 通知表
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  uid        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT    NOT NULL,           -- 'task_done' | 'task_failed' | 'chapter_error' | 'system'
  title      TEXT    NOT NULL,
  msg        TEXT    NOT NULL,
  link       TEXT,                        -- e.g. /tasks/5
  level      TEXT    NOT NULL DEFAULT 'info',  -- info | warn | error
  read_at    INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notif_uid_unread ON notifications(uid, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_uid_created ON notifications(uid, created_at DESC);
