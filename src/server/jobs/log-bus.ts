// 事件总线：日志 + 任务 + 章节 状态广播给 WS 订阅者
// 事件携带 uid，WS 端按 uid 过滤
import { db } from "../db/index.ts";
import type { Chapter, LogLine, Task } from "@shared/types.ts";

type Listener = (msg:
  | { type: "log"; line: LogLine }
  | { type: "task"; task: Task }
  | { type: "chapter"; chapter: Chapter }) => void;

class LogBus {
  private listeners = new Set<Listener>();

  emit(line: Omit<LogLine, "id">, uid: number) {
    const id = Number(
      (db
        .query(
          "INSERT INTO logs(uid, ts, level, task_id, book_id, msg) VALUES(?, ?, ?, ?, ?, ?) RETURNING id",
        )
        .get(uid, line.ts, line.level, line.taskId, line.bookId, line.msg) as { id: number }).id,
    );
    const full: LogLine = { id, ...line };
    this.broadcast({ type: "log", line: full });
  }

  emitTask(task: Task, _uid: number) {
    this.broadcast({ type: "task", task });
  }

  emitChapter(chapter: Chapter, _uid: number) {
    this.broadcast({ type: "chapter", chapter });
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private broadcast(msg: Parameters<Listener>[0]) {
    for (const l of this.listeners) {
      try {
        l(msg);
      } catch {
        /* ignore */
      }
    }
  }
}

export const logBus = new LogBus();
