// 路由：/api/books*
import { Hono } from "hono";
import { stat } from "node:fs/promises";
import { resolve, basename, extname } from "node:path";
import { db, getSetting } from "../db/index.ts";
import type { Book, BookInput } from "@shared/types.ts";

interface BookRow {
  id: number;
  uid: number;
  name: string;
  book_url: string;
  parser: string;
  output_dir: string;
  min_cn: number;
  pad: number;
  interval_lo: number;
  interval_hi: number;
  retries: number;
  ua: string;
  created_at: number;
  updated_at: number;
}

function rowToBook(r: BookRow): Book {
  return {
    id: r.id,
    name: r.name,
    bookUrl: r.book_url,
    parser: r.parser,
    outputDir: r.output_dir,
    minCn: r.min_cn,
    pad: r.pad,
    intervalLo: r.interval_lo,
    intervalHi: r.interval_hi,
    retries: r.retries,
    ua: r.ua,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function defaults(uid: number): BookInput {
  return {
    name: "",
    bookUrl: "",
    parser: "yuebiqu",
    outputDir: "",
    minCn: parseInt(getSetting("default_min_cn", uid) ?? "1000", 10),
    pad: parseInt(getSetting("default_pad", uid) ?? "4", 10),
    intervalLo: parseFloat(getSetting("default_interval_lo", uid) ?? "0.3"),
    intervalHi: parseFloat(getSetting("default_interval_hi", uid) ?? "0.6"),
    retries: parseInt(getSetting("default_retries", uid) ?? "3", 10),
    ua: getSetting("default_ua", uid) ?? "",
  };
}

// 解析器类型 → 对 bookUrl 含义的约束
//   "url"     : HTTP 根 URL（默认）
//   "dir"     : 本地目录绝对路径
//   "file"    : 本地文件绝对路径
function parserKind(name: string): "url" | "dir" | "file" {
  if (name === "localdir") return "dir";
  if (name === "localfile") return "file";
  return "url";
}

async function validateBookUrl(parser: string, bookUrl: string): Promise<string | null> {
  const kind = parserKind(parser);
  if (kind === "url") {
    if (!/^https?:\/\//.test(bookUrl)) return "URL 必须以 http:// 或 https:// 开头";
    return null;
  }
  // 本地路径：必须在白名单根内、存在、类型与 kind 匹配
  // 白名单沿用 fs 浏览端点（家目录 / cwd / tmp），防止用户越权访问系统目录
  const p = resolve(bookUrl);
  const allowedRoots = [
    process.env.HOME ?? "/",
    process.cwd(),
    "/tmp",
  ];
  const inAllowed = allowedRoots.some((root) => p === root || p.startsWith(root + "/"));
  if (!inAllowed) return "路径不允许（仅限家目录 / 当前目录 / /tmp）";
  try {
    const s = await stat(p);
    if (kind === "dir" && !s.isDirectory()) return "该路径不是目录";
    if (kind === "file" && !s.isFile()) return "该路径不是文件";
  } catch {
    return "路径不存在或无法访问";
  }
  return null;
}

export const books = new Hono();

books.get("/", (c) => {
  const uid = c.get("user").id;
  const rows = db.query("SELECT * FROM books WHERE uid=? ORDER BY id DESC").all(uid) as BookRow[];
  return c.json(rows.map(rowToBook));
});

books.post("/", async (c) => {
  const uid = c.get("user").id;
  const body = (await c.req.json().catch(() => null)) as Partial<BookInput> | null;
  if (!body) return c.json({ error: "invalid json" }, 400);
  const d = defaults(uid);
  const name = (body.name ?? "").trim();
  const bookUrl = (body.bookUrl ?? "").trim();
  const outputDir = (body.outputDir ?? d.outputDir ?? "").trim();
  if (!name) return c.json({ error: "name required" }, 400);
  if (!bookUrl) return c.json({ error: "bookUrl required" }, 400);
  if (!outputDir) return c.json({ error: "outputDir required" }, 400);

  const parserName = body.parser ?? d.parser ?? "yuebiqu";
  const urlErr = await validateBookUrl(parserName, bookUrl);
  if (urlErr) return c.json({ error: urlErr }, 400);

  const now = Date.now();
  try {
    const info = db
      .query(
        `INSERT INTO books(uid, name, book_url, parser, output_dir, min_cn, pad,
         interval_lo, interval_hi, retries, ua, created_at, updated_at)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        uid,
        name,
        bookUrl,
        parserName,
        outputDir,
        body.minCn ?? d.minCn ?? 1000,
        body.pad ?? d.pad ?? 4,
        body.intervalLo ?? d.intervalLo ?? 0.3,
        body.intervalHi ?? d.intervalHi ?? 0.6,
        body.retries ?? d.retries ?? 3,
        body.ua ?? d.ua ?? "",
        now,
        now,
      );
    const row = db
      .query("SELECT * FROM books WHERE id=?")
      .get(Number(info.lastInsertRowid)) as BookRow;
    return c.json(rowToBook(row));
  } catch (e) {
    return c.json({ error: "create failed", detail: (e as Error).message }, 400);
  }
});

books.get("/:id", (c) => {
  const uid = c.get("user").id;
  const id = parseInt(c.req.param("id"), 10);
  const row = db
    .query("SELECT * FROM books WHERE id=? AND uid=?")
    .get(id, uid) as BookRow | undefined;
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(rowToBook(row));
});

books.put("/:id", async (c) => {
  const uid = c.get("user").id;
  const id = parseInt(c.req.param("id"), 10);
  const body = (await c.req.json().catch(() => null)) as Partial<BookInput> | null;
  if (!body) return c.json({ error: "invalid json" }, 400);
  const cur = db
    .query("SELECT * FROM books WHERE id=? AND uid=?")
    .get(id, uid) as BookRow | undefined;
  if (!cur) return c.json({ error: "not found" }, 404);
  const merged = rowToBook(cur);
  const nextParser = body.parser ?? merged.parser;
  if (body.bookUrl !== undefined || body.parser !== undefined) {
    const urlErr = await validateBookUrl(nextParser, body.bookUrl ?? merged.bookUrl);
    if (urlErr) return c.json({ error: urlErr }, 400);
  }
  const next: Book = {
    ...merged,
    name: body.name ?? merged.name,
    bookUrl: body.bookUrl ?? merged.bookUrl,
    parser: nextParser,
    outputDir: body.outputDir ?? merged.outputDir,
    minCn: body.minCn ?? merged.minCn,
    pad: body.pad ?? merged.pad,
    intervalLo: body.intervalLo ?? merged.intervalLo,
    intervalHi: body.intervalHi ?? merged.intervalHi,
    retries: body.retries ?? merged.retries,
    ua: body.ua ?? merged.ua,
  };
  db.query(
    `UPDATE books SET name=?, book_url=?, parser=?, output_dir=?, min_cn=?, pad=?,
     interval_lo=?, interval_hi=?, retries=?, ua=?, updated_at=? WHERE id=? AND uid=?`,
  ).run(
    next.name,
    next.bookUrl,
    next.parser,
    next.outputDir,
    next.minCn,
    next.pad,
    next.intervalLo,
    next.intervalHi,
    next.retries,
    next.ua,
    Date.now(),
    id,
    uid,
  );
  const row = db
    .query("SELECT * FROM books WHERE id=? AND uid=?")
    .get(id, uid) as BookRow;
  return c.json(rowToBook(row));
});

books.delete("/:id", (c) => {
  const uid = c.get("user").id;
  const id = parseInt(c.req.param("id"), 10);
  db.query("DELETE FROM books WHERE id=? AND uid=?").run(id, uid);
  return c.json({ ok: true });
});

books.post("/:id/refresh-index", async (c) => {
  const uid = c.get("user").id;
  const id = parseInt(c.req.param("id"), 10);
  const row = db
    .query("SELECT * FROM books WHERE id=? AND uid=?")
    .get(id, uid) as BookRow | undefined;
  if (!row) return c.json({ error: "not found" }, 404);
  const { makeParser } = await import("../crawler/parsers.ts");
  const parser = makeParser(row.parser, row.book_url);
  const list = await parser.listChapters();
  const ts = Date.now();
  const stmt = db.prepare(
    `INSERT INTO chapters(uid, book_id, idx, article_id, title, status, updated_at)
     VALUES(?, ?, ?, ?, ?, 'pending', ?)
     ON CONFLICT(book_id, idx) DO UPDATE SET
       article_id = excluded.article_id,
       title = excluded.title`,
  );
  let n = 0;
  for (const ch of list) {
    stmt.run(uid, id, ch.idx, ch.articleId, ch.title, ts);
    n++;
  }
  return c.json({ ok: true, total: n });
});
