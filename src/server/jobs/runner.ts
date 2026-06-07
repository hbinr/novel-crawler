// 任务运行器：消费 queued 任务，下载章节，更新进度，发送日志
import { db, getSetting } from "../db/index.ts";
import { logBus } from "./log-bus.ts";
import { makeParser, cnCount } from "../crawler/parsers.ts";
import { alreadyOk, writeChapter } from "../crawler/io.ts";
import { notify } from "../notify.ts";
import type { Book, Chapter, Task } from "@shared/types.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
}

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
    createdAt: 0,
    updatedAt: 0,
  };
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

class Runner {
  private busy = new Set<number>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private currentPollMs = 0;

  start() {
    this.scheduleNextPoll();
  }

  stop() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  trigger(taskId: number) {
    if (this.busy.has(taskId)) return;
    if (this.busy.size >= this.getMaxConcurrent()) {
      return;
    }
    this.runTask(taskId).catch((e) => {
      // 触发失败只能从 task 表读 uid
      const t = db.query("SELECT uid FROM tasks WHERE id=?").get(taskId) as
        | { uid: number }
        | undefined;
      if (t) {
        logBus.emit(
          {
            ts: Date.now(),
            level: "error",
            taskId,
            bookId: null,
            msg: `trigger error: ${(e as Error).message}`,
          },
          t.uid,
        );
      }
    });
  }

  private getMaxConcurrent(): number {
    // 用 admin 用户的设置作为全局上限（v1 简化）
    const n = parseInt(getSetting("max_concurrent_tasks", 1) ?? "2", 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  private getPollMs(): number {
    const n = parseInt(getSetting("poll_interval_ms", 1) ?? "1500", 10);
    return Number.isFinite(n) && n >= 250 ? n : 1500;
  }

  private scheduleNextPoll() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    const ms = this.getPollMs();
    this.currentPollMs = ms;
    this.pollTimer = setInterval(() => this.poll().catch(() => {}), ms);
  }

  refresh() {
    if (this.currentPollMs !== this.getPollMs()) this.scheduleNextPoll();
    this.poll().catch(() => {});
  }

  private async poll() {
    const cap = this.getMaxConcurrent();
    const slots = cap - this.busy.size;
    if (slots <= 0) return;
    const rows = db
      .query("SELECT id FROM tasks WHERE status='queued' ORDER BY created_at ASC LIMIT ?")
      .all(slots) as { id: number }[];
    for (const r of rows) {
      if (this.busy.has(r.id)) continue;
      this.runTask(r.id).catch(() => {});
    }
  }

  private async runTask(taskId: number) {
    if (this.busy.has(taskId)) return;
    this.busy.add(taskId);

    const task = db
      .query("SELECT * FROM tasks WHERE id = ?")
      .get(taskId) as TaskRow | undefined;
    if (!task) {
      this.busy.delete(taskId);
      return;
    }
    if (task.status !== "queued") {
      this.busy.delete(taskId);
      return;
    }
    const uid = task.uid;

    const book = db
      .query("SELECT * FROM books WHERE id = ?")
      .get(task.book_id) as BookRow | undefined;
    if (!book) {
      this.markFailed(taskId, uid, "book not found");
      this.busy.delete(taskId);
      return;
    }

    const now = Date.now();
    db.query("UPDATE tasks SET status='running', started_at=? WHERE id=?").run(now, taskId);
    this.emitTaskUpdate(taskId, uid);

    logBus.emit(
      {
        ts: now,
        level: "info",
        taskId,
        bookId: book.id,
        msg: `task start: book=${book.name} url=${book.book_url}`,
      },
      uid,
    );

    try {
      const parser = makeParser(book.parser, book.book_url);
      const all = await parser.listChapters();
      const start = Math.max(1, task.start_idx);
      const end = Math.min(task.end_idx ?? all.length, all.length);
      const chapters = all.slice(start - 1, end);

      // 持久化章节表 — 携带 uid
      const insertCh = db.prepare(
        `INSERT INTO chapters(uid, book_id, idx, article_id, title, status, updated_at)
         VALUES(?, ?, ?, ?, ?, 'pending', ?)
         ON CONFLICT(book_id, idx) DO UPDATE SET
           article_id = excluded.article_id,
           title = excluded.title,
           updated_at = excluded.updated_at`,
      );
      const ts0 = Date.now();
      for (const c of chapters) insertCh.run(uid, book.id, c.idx, c.articleId, c.title, ts0);

      db.query("UPDATE tasks SET total=? WHERE id=?").run(chapters.length, taskId);
      this.emitTaskUpdate(taskId, uid);

      const cfg = rowToBook(book);
      let done = 0;
      let failed = 0;

      for (const c of chapters) {
        const cur = db.query("SELECT status FROM tasks WHERE id=?").get(taskId) as
          | { status: string }
          | undefined;
        if (!cur || cur.status === "canceled") {
          logBus.emit(
            {
              ts: Date.now(),
              level: "warn",
              taskId,
              bookId: book.id,
              msg: "task canceled",
            },
            uid,
          );
          this.busy.delete(taskId);
          return;
        }

        db.query("UPDATE tasks SET current_chapter=? WHERE id=?").run(
          `${String(c.idx).padStart(cfg.pad, "0")} ${c.title}`,
          taskId,
        );
        this.emitTaskUpdate(taskId, uid);

        const chRow = db
          .query("SELECT id FROM chapters WHERE book_id=? AND idx=?")
          .get(book.id, c.idx) as { id: number } | undefined;
        if (!chRow) continue;
        const chDbId = chRow.id;

        const fname = `${String(c.idx).padStart(cfg.pad, "0")}.md`;
        const outPath = `${cfg.outputDir}/${fname}`;

        if (await alreadyOk(outPath, cfg.minCn)) {
          const cn = cfg.minCn;
          const s = await import("node:fs/promises").then((m) => m.stat(outPath));
          db.query(
            "UPDATE chapters SET status='skipped', pages=0, cn_count=?, bytes=?, error=NULL, updated_at=? WHERE id=?",
          ).run(cn, s.size, Date.now(), chDbId);
          logBus.emit(
            {
              ts: Date.now(),
              level: "info",
              taskId,
              bookId: book.id,
              msg: `skip ${fname} (${s.size}B)`,
            },
            uid,
          );
          this.emitChapterUpdate(uid, chDbId);
          done++;
          db.query("UPDATE tasks SET done=? WHERE id=?").run(done, taskId);
          this.emitTaskUpdate(taskId, uid);
          continue;
        }

        db.query("UPDATE chapters SET status='downloading', updated_at=? WHERE id=?").run(
          Date.now(),
          chDbId,
        );
        this.emitChapterUpdate(uid, chDbId);

        try {
          const t0 = Date.now();
          const { body, pages } = await this.downloadChapter(parser, c.articleId, cfg);
          const bytes = await writeChapter(outPath, c.title, body);
          const cn = cnCount(body);
          db.query(
            "UPDATE chapters SET status='done', pages=?, cn_count=?, bytes=?, error=NULL, updated_at=? WHERE id=?",
          ).run(pages, cn, bytes, Date.now(), chDbId);
          logBus.emit(
            {
              ts: Date.now(),
              level: "info",
              taskId,
              bookId: book.id,
              msg: `${fname} aid=${c.articleId} pages=${pages} cn=${cn} bytes=${bytes} t=${(
                (Date.now() - t0) /
                1000
              ).toFixed(1)}s`,
            },
            uid,
          );
          this.emitChapterUpdate(uid, chDbId);
          done++;
        } catch (e) {
          const err = (e as Error).message;
          db.query(
            "UPDATE chapters SET status='failed', error=?, updated_at=? WHERE id=?",
          ).run(err, Date.now(), chDbId);
          logBus.emit(
            {
              ts: Date.now(),
              level: "error",
              taskId,
              bookId: book.id,
              msg: `${fname} aid=${c.articleId} FAIL: ${err}`,
            },
            uid,
          );
          this.emitChapterUpdate(uid, chDbId);
          failed++;
        }

        db.query("UPDATE tasks SET done=?, failed=? WHERE id=?").run(done, failed, taskId);
        this.emitTaskUpdate(taskId, uid);

        const wait =
          cfg.intervalLo + Math.random() * Math.max(0, cfg.intervalHi - cfg.intervalLo);
        await sleep(wait * 1000);
      }

      const final = failed === 0 ? "success" : done === 0 ? "failed" : "partial";
      db.query(
        "UPDATE tasks SET status=?, finished_at=?, current_chapter=NULL WHERE id=?",
      ).run(final, Date.now(), taskId);
      this.emitTaskUpdate(taskId, uid);
      logBus.emit(
        {
          ts: Date.now(),
          level: final === "success" ? "info" : "warn",
          taskId,
          bookId: book.id,
          msg: `task done: status=${final} done=${done} failed=${failed}`,
        },
        uid,
      );

      // 触发通知
      const kind = final === "success" ? "task_done" : final === "partial" ? "task_partial" : "task_failed";
      const level = final === "success" ? "info" : final === "partial" ? "warn" : "error";
      const title =
        final === "success"
          ? `《${book.name}》抓取完成`
          : final === "partial"
            ? `《${book.name}》部分完成`
            : `《${book.name}》抓取失败`;
      const msg = `done ${done} · failed ${failed} · total ${chapters.length}`;
      notify(uid, { kind, level, title, msg, link: `/tasks/${taskId}` });
    } catch (e) {
      this.markFailed(taskId, uid, (e as Error).message);
    } finally {
      this.busy.delete(taskId);
    }
  }

  private async downloadChapter(
    parser: ReturnType<typeof makeParser>,
    articleId: string,
    cfg: Book,
  ): Promise<{ body: string; pages: number }> {
    let page = 1;
    const parts: string[] = [];
    while (true) {
      const text = await parser.extractContent(articleId, page);
      if (!text) {
        if (page === 1) throw new Error("empty content page 1");
        break;
      }
      parts.push(text);
      const nxt = await this.nextPageHtml(parser, articleId, page);
      if (!nxt) break;
      page = nxt;
      const wait = 0.15 + Math.random() * 0.1;
      await sleep(wait * 1000);
    }
    return { body: parts.join("\n\n"), pages: parts.length };
  }

  private async nextPageHtml(
    parser: ReturnType<typeof makeParser>,
    articleId: string,
    currentPage: number,
  ): Promise<number | null> {
    const { fetchText } = await import("../crawler/fetch.ts");
    const url = `${parser["bookUrl" as keyof typeof parser]}/${articleId}/${currentPage}.html`;
    try {
      const html = await fetchText(url);
      return parser.nextPage(html, articleId, currentPage);
    } catch {
      return null;
    }
  }

  private markFailed(taskId: number, uid: number, reason: string) {
    db.query(
      "UPDATE tasks SET status='failed', finished_at=?, current_chapter=NULL WHERE id=?",
    ).run(Date.now(), taskId);
    this.emitTaskUpdate(taskId, uid);
    logBus.emit(
      {
        ts: Date.now(),
        level: "error",
        taskId,
        bookId: null,
        msg: `task failed: ${reason}`,
      },
      uid,
    );
    // 通知：抓取失败
    const t = db.query("SELECT book_id FROM tasks WHERE id=?").get(taskId) as
      | { book_id: number }
      | undefined;
    if (t) {
      const book = db.query("SELECT name FROM books WHERE id=?").get(t.book_id) as
        | { name: string }
        | undefined;
      notify(uid, {
        kind: "task_failed",
        level: "error",
        title: book ? `《${book.name}》抓取失败` : "任务失败",
        msg: reason,
        link: `/tasks/${taskId}`,
      });
    }
  }

  private emitTaskUpdate(taskId: number, uid: number) {
    const r = db.query("SELECT * FROM tasks WHERE id=?").get(taskId) as TaskRow | undefined;
    if (!r) return;
    logBus.emitTask(rowToTask(r), uid);
  }

  private emitChapterUpdate(uid: number, chapterDbId: number) {
    const r = db
      .query("SELECT * FROM chapters WHERE id=?")
      .get(chapterDbId) as
      | (Chapter & { book_id: number })
      | undefined;
    if (!r) return;
    logBus.emitChapter(r, uid);
  }
}

export const runner = new Runner();
