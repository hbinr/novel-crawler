// 路由：/api/tasks*
import { Hono } from "hono";
import { db } from "../db/index.ts";
import { runner } from "../jobs/runner.ts";
import { logBus } from "../jobs/log-bus.ts";
import type { Task, TaskInput } from "@shared/types.ts";

interface TaskRow {
  id: number;
  uid: number;
  book_id: number;
  status: string;
  start_idx: number;
  end_idx: number | null;
  total: number;
  done: number;
  failed: number;
  current_chapter: string | null;
  started_at: number | null;
  finished_at: number | null;
  created_at: number;
}

function rowToTask(r: TaskRow): Task {
  return {
    id: r.id,
    bookId: r.book_id,
    status: r.status as Task["status"],
    startIdx: r.start_idx,
    endIdx: r.end_idx,
    total: r.total,
    done: r.done,
    failed: r.failed,
    currentChapter: r.current_chapter,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    createdAt: r.created_at,
  };
}

export const tasks = new Hono();

tasks.get("/", (c) => {
  const uid = c.get("user").id;
  const bookId = c.req.query("bookId");
  const where = bookId
    ? "WHERE uid=? AND book_id=?"
    : "WHERE uid=?";
  const params = bookId ? [uid, parseInt(bookId, 10)] : [uid];
  const rows = (
    bookId
      ? (db
          .query(`SELECT * FROM tasks ${where} ORDER BY id DESC`)
          .all(...(params as (string | number)[])) as TaskRow[])
      : (db.query(`SELECT * FROM tasks ${where} ORDER BY id DESC`).all(...(params as (string | number)[])) as TaskRow[])
  ).map(rowToTask);
  return c.json(rows);
});

tasks.post("/", async (c) => {
  const uid = c.get("user").id;
  const body = (await c.req.json().catch(() => null)) as Partial<TaskInput> | null;
  if (!body || typeof body.bookId !== "number")
    return c.json({ error: "bookId required" }, 400);
  const book = db
    .query("SELECT id FROM books WHERE id=? AND uid=?")
    .get(body.bookId, uid);
  if (!book) return c.json({ error: "book not found" }, 404);
  const now = Date.now();
  const info = db
    .query(
      `INSERT INTO tasks(uid, book_id, status, start_idx, end_idx, total, done, failed, created_at)
       VALUES(?, ?, 'queued', ?, ?, 0, 0, 0, ?)`,
    )
    .run(uid, body.bookId, body.startIdx ?? 1, body.endIdx ?? null, now);
  const id = Number(info.lastInsertRowid);
  const row = db.query("SELECT * FROM tasks WHERE id=?").get(id) as TaskRow;
  logBus.emit(
    {
      ts: now,
      level: "info",
      taskId: id,
      bookId: body.bookId,
      msg: `task queued: range=${body.startIdx ?? 1}..${body.endIdx ?? "all"}`,
    },
    uid,
  );
  runner.trigger(id);
  return c.json(rowToTask(row));
});

tasks.get("/:id", (c) => {
  const uid = c.get("user").id;
  const id = parseInt(c.req.param("id"), 10);
  const row = db
    .query("SELECT * FROM tasks WHERE id=? AND uid=?")
    .get(id, uid) as TaskRow | undefined;
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(rowToTask(row));
});

tasks.post("/:id/cancel", (c) => {
  const uid = c.get("user").id;
  const id = parseInt(c.req.param("id"), 10);
  const row = db
    .query("SELECT * FROM tasks WHERE id=? AND uid=?")
    .get(id, uid) as TaskRow | undefined;
  if (!row) return c.json({ error: "not found" }, 404);
  if (row.status === "running" || row.status === "queued") {
    db.query("UPDATE tasks SET status='canceled', finished_at=? WHERE id=?").run(Date.now(), id);
    logBus.emit(
      {
        ts: Date.now(),
        level: "warn",
        taskId: id,
        bookId: row.book_id,
        msg: "task canceled by user",
      },
      uid,
    );
  }
  const r2 = db
    .query("SELECT * FROM tasks WHERE id=? AND uid=?")
    .get(id, uid) as TaskRow;
  return c.json(rowToTask(r2));
});

tasks.delete("/:id", (c) => {
  const uid = c.get("user").id;
  const id = parseInt(c.req.param("id"), 10);
  db.query("DELETE FROM tasks WHERE id=? AND uid=?").run(id, uid);
  return c.json({ ok: true });
});
