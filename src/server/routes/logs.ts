// 路由：/api/logs*
import { Hono } from "hono";
import { db } from "../db/index.ts";
import type { LogLine } from "@shared/types.ts";

interface LogRow {
  id: number;
  uid: number;
  ts: number;
  level: string;
  task_id: number | null;
  book_id: number | null;
  msg: string;
}

function rowToLog(r: LogRow): LogLine {
  return {
    id: r.id,
    ts: r.ts,
    level: r.level as LogLine["level"],
    taskId: r.task_id,
    bookId: r.book_id,
    msg: r.msg,
  };
}

export const logs = new Hono();

logs.get("/", (c) => {
  const uid = c.get("user").id;
  const limit = Math.min(parseInt(c.req.query("limit") ?? "200", 10), 1000);
  const taskId = c.req.query("taskId");
  const where: string[] = ["uid=?"];
  const params: (string | number)[] = [uid];
  if (taskId) {
    where.push("task_id=?");
    params.push(parseInt(taskId, 10));
  }
  const sql = `SELECT * FROM logs WHERE ${where.join(" AND ")} ORDER BY id DESC LIMIT ?`;
  params.push(limit);
  const rows = db.query(sql).all(...params) as LogRow[];
  return c.json(rows.map(rowToLog).reverse());
});
