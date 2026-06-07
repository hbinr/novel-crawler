// 路由：/api/stats — dashboard 汇总
import { Hono } from "hono";
import { db, getSetting } from "../db/index.ts";

export const stats = new Hono();

stats.get("/", (c) => {
  const uid = c.get("user").id;
  const maxConcurrent = parseInt(getSetting("max_concurrent_tasks", uid) ?? "2", 10);
  const running = (db
    .query("SELECT COUNT(*) AS n FROM tasks WHERE uid=? AND status='running'")
    .get(uid) as { n: number }).n;
  return c.json({
    books: (db.query("SELECT COUNT(*) AS n FROM books WHERE uid=?").get(uid) as { n: number }).n,
    running,
    queued: (db
      .query("SELECT COUNT(*) AS n FROM tasks WHERE uid=? AND status='queued'")
      .get(uid) as { n: number }).n,
    maxConcurrent,
    slotsAvailable: Math.max(0, maxConcurrent - running),
    chapters: (db
      .query("SELECT COUNT(*) AS n FROM chapters WHERE uid=?")
      .get(uid) as { n: number }).n,
    done: (db
      .query("SELECT COUNT(*) AS n FROM chapters WHERE uid=? AND status='done'")
      .get(uid) as { n: number }).n,
    failed: (db
      .query("SELECT COUNT(*) AS n FROM chapters WHERE uid=? AND status='failed'")
      .get(uid) as { n: number }).n,
  });
});
