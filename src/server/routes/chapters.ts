// 路由：/api/chapters*
//
// 大列表性能策略（千章/万章级别）：
//  - listChapters 已经支持 limit/offset，索引 idx ASC 单方向扫描
//  - 单独的 /count 端点用 COUNT(*) + GROUP BY status 一次给齐"每个状态多少"
//  - listChapters 加 ?include=count 把总数塞进响应，避免第二次 round trip
//  - 不返回 bytes > 0 / cn_count > 0 之外的全文；content 端点单章按需读盘
import { Hono } from "hono";
import { readFile, stat } from "node:fs/promises";
import { db } from "../db/index.ts";
import type { Chapter } from "@shared/types.ts";

interface ChapterRow {
  id: number;
  uid: number;
  book_id: number;
  idx: number;
  article_id: string;
  title: string;
  status: string;
  pages: number;
  cn_count: number;
  bytes: number;
  error: string | null;
  updated_at: number;
}

function rowToChapter(r: ChapterRow): Chapter {
  return {
    id: r.id,
    bookId: r.book_id,
    idx: r.idx,
    articleId: r.article_id,
    title: r.title,
    status: r.status as Chapter["status"],
    pages: r.pages,
    cnCount: r.cn_count,
    bytes: r.bytes,
    error: r.error,
    updatedAt: r.updated_at,
  };
}

export const chapters = new Hono();

// 章节数聚合 — 前端用来显示"X 章 / 已完成 Y"等
chapters.get("/count", (c) => {
  const uid = c.get("user").id;
  const bookId = parseInt(c.req.query("bookId") ?? "", 10);
  if (!bookId) return c.json({ error: "bookId required" }, 400);
  const rows = db
    .query(
      `SELECT status, COUNT(*) AS n FROM chapters WHERE uid=? AND book_id=? GROUP BY status`,
    )
    .all(uid, bookId) as { status: string; n: number }[];
  const counts: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    counts[r.status] = r.n;
    total += r.n;
  }
  return c.json({ total, byStatus: counts });
});

chapters.get("/", (c) => {
  const uid = c.get("user").id;
  const bookId = parseInt(c.req.query("bookId") ?? "", 10);
  if (!bookId) return c.json({ error: "bookId required" }, 400);
  // 单次拉取上限 1000；超过的需要分页
  const limit = Math.min(parseInt(c.req.query("limit") ?? "200", 10), 1000);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);
  const status = c.req.query("status");
  const includeCount = c.req.query("include") === "count";
  const where = status
    ? "WHERE uid=? AND book_id=? AND status=?"
    : "WHERE uid=? AND book_id=?";
  const params = status ? [uid, bookId, status, limit, offset] : [uid, bookId, limit, offset];
  const rows = db
    .query(`SELECT * FROM chapters ${where} ORDER BY idx ASC LIMIT ? OFFSET ?`)
    .all(...(params as (string | number)[])) as ChapterRow[];

  if (!includeCount) {
    return c.json({ items: rows.map(rowToChapter), total: null });
  }
  const cnt = db
    .query(
      `SELECT COUNT(*) AS n FROM chapters ${
        status ? "WHERE uid=? AND book_id=? AND status=?" : "WHERE uid=? AND book_id=?"
      }`,
    )
    .get(...(status ? [uid, bookId, status] : [uid, bookId])) as { n: number };
  return c.json({ items: rows.map(rowToChapter), total: cnt.n });
});

chapters.get("/:id", (c) => {
  const uid = c.get("user").id;
  const id = parseInt(c.req.param("id"), 10);
  const row = db
    .query("SELECT * FROM chapters WHERE id=? AND uid=?")
    .get(id, uid) as ChapterRow | undefined;
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(rowToChapter(row));
});

chapters.get("/:id/content", async (c) => {
  const uid = c.get("user").id;
  const id = parseInt(c.req.param("id"), 10);
  const row = db
    .query(
      `SELECT ch.*, b.output_dir, b.pad FROM chapters ch
       JOIN books b ON b.id = ch.book_id
       WHERE ch.id=? AND ch.uid=?`,
    )
    .get(id, uid) as
    | (ChapterRow & { output_dir: string; pad: number })
    | undefined;
  if (!row) return c.json({ error: "not found" }, 404);
  const path = `${row.output_dir}/${String(row.idx).padStart(row.pad, "0")}.md`;
  try {
    const s = await stat(path);
    const text = await readFile(path, "utf8");
    return c.json({ path, size: s.size, content: text });
  } catch {
    return c.json({ error: "file not found", path }, 404);
  }
});
