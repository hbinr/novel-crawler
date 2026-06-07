import { Database } from "bun:sqlite";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATA_DIR = process.env.NOVEL_DATA_DIR ?? join(process.cwd(), "data");
mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = join(DATA_DIR, "console.db");

export const db = new Database(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

// migrate
const schema = readFileSync(join(__dirname, "schema.sql"), "utf8");
db.exec(schema);

// === 初始化 mock 用户 ===
// 如果 users 表为空，插入 3 个测试账号
const userCount = (db.query("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
if (userCount === 0) {
  // 使用 Bun 自带的 password 哈希（scrypt）
  const seed = [
    { username: "admin", password: "admin123", display: "管理员", role: "admin" },
    { username: "user", password: "user123", display: "普通用户", role: "user" },
    { username: "demo", password: "demo123", display: "Demo 账号", role: "user" },
  ];
  const insertUser = db.prepare(
    `INSERT INTO users(username, password_hash, display_name, role, created_at) VALUES(?, ?, ?, ?, ?)`,
  );
  const insertSetting = db.prepare(
    `INSERT INTO settings(uid, k, v) VALUES(?, ?, ?)`,
  );
  const defaults: [string, string][] = [
    ["default_interval_lo", "0.3"],
    ["default_interval_hi", "0.6"],
    ["default_retries", "3"],
    ["default_ua", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"],
    ["default_min_cn", "1000"],
    ["default_pad", "4"],
    ["default_output_root", join(process.cwd(), "data", "books")],
    ["max_concurrent_tasks", "2"],
    ["poll_interval_ms", "1500"],
  ];
  for (const u of seed) {
    const hash = await Bun.password.hash(u.password, { algorithm: "bcrypt", cost: 4 });
    const info = insertUser.run(u.username, hash, u.display, u.role, Date.now());
    const uid = Number(info.lastInsertRowid);
    for (const [k, v] of defaults) insertSetting.run(uid, k, v);
  }
  console.log("[db] seeded 3 mock users: admin/admin123, user/user123, demo/demo123");
}

// === Auth helpers ===
export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  display_name: string;
  role: string;
  created_at: number;
}

export interface SessionUser {
  id: number;
  username: string;
  displayName: string;
  role: string;
}

const SESSION_TTL_MS = 30 * 24 * 3600 * 1000; // 30 天

function randomToken(): string {
  const buf = new Uint8Array(24);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyCredentials(
  username: string,
  password: string,
): Promise<SessionUser | null> {
  const row = db
    .query("SELECT * FROM users WHERE username = ?")
    .get(username) as UserRow | undefined;
  if (!row) {
    // 防时序攻击：仍跑一次 hash
    await Bun.password.verify(password, "$2a$04$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi");
    return null;
  }
  const ok = await Bun.password.verify(password, row.password_hash);
  if (!ok) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
  };
}

export function createSession(userId: number): string {
  const token = randomToken();
  const now = Date.now();
  db.query(
    "INSERT INTO sessions(token, user_id, created_at, expires_at) VALUES(?, ?, ?, ?)",
  ).run(token, userId, now, now + SESSION_TTL_MS);
  return token;
}

export function destroySession(token: string) {
  db.query("DELETE FROM sessions WHERE token = ?").run(token);
}

export function getUserByToken(token: string): SessionUser | null {
  const row = db
    .query(
      `SELECT u.id, u.username, u.display_name, u.role, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`,
    )
    .get(token) as
    | { id: number; username: string; display_name: string; role: string; expires_at: number }
    | undefined;
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    destroySession(token);
    return null;
  }
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
  };
}

// === Settings helpers (now per-user) ===
export function getSetting(k: string, uid: number): string | undefined {
  const r = db
    .query("SELECT v FROM settings WHERE uid = ? AND k = ?")
    .get(uid, k) as { v: string } | undefined;
  return r?.v;
}

export function setSetting(k: string, v: string, uid: number) {
  db.query(
    "INSERT INTO settings(uid, k, v) VALUES(?, ?, ?) ON CONFLICT(uid, k) DO UPDATE SET v = excluded.v",
  ).run(uid, k, v);
}

export function getAllSettings(uid: number): Record<string, string> {
  const rows = db
    .query("SELECT k, v FROM settings WHERE uid = ?")
    .all(uid) as { k: string; v: string }[];
  return Object.fromEntries(rows.map((r) => [r.k, r.v]));
}
