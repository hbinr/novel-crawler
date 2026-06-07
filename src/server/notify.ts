// 通知助手：插入 DB + 通过内部 listener 广播给 WS
import { db } from "./db/index.ts";
import type { Notification } from "@shared/types.ts";

export interface NotifyInput {
  kind: string;
  level: "info" | "warn" | "error";
  title: string;
  msg: string;
  link?: string | null;
}

type NotifListener = (uid: number, notif: Notification) => void;
const listeners = new Set<NotifListener>();

export function onNotification(fn: NotifListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify(uid: number, n: NotifyInput): Notification {
  const now = Date.now();
  const id = Number(
    (db
      .query(
        `INSERT INTO notifications(uid, kind, title, msg, link, level, created_at)
         VALUES(?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      )
      .get(uid, n.kind, n.title, n.msg, n.link ?? null, n.level, now) as { id: number }).id,
  );
  const notif: Notification = {
    id,
    uid,
    kind: n.kind,
    title: n.title,
    msg: n.msg,
    link: n.link ?? null,
    level: n.level,
    readAt: null,
    createdAt: now,
  };
  for (const l of listeners) {
    try {
      l(uid, notif);
    } catch {
      /* ignore */
    }
  }
  return notif;
}
