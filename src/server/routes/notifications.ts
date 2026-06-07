// 路由：/api/notifications*
import { Hono } from "hono";
import { db } from "../db/index.ts";
import type { Notification } from "@shared/types.ts";

interface NotifRow {
  id: number;
  uid: number;
  kind: string;
  title: string;
  msg: string;
  link: string | null;
  level: string;
  read_at: number | null;
  created_at: number;
}

function rowToNotification(r: NotifRow): Notification {
  return {
    id: r.id,
    uid: r.uid,
    kind: r.kind,
    title: r.title,
    msg: r.msg,
    link: r.link,
    level: r.level as Notification["level"],
    readAt: r.read_at,
    createdAt: r.created_at,
  };
}

export const notifications = new Hono();

notifications.get("/", (c) => {
  const uid = c.get("user" as never) as { id: number };
  const limit = Math.min(parseInt(c.req.query("limit") ?? "100", 10), 500);
  const rows = db
    .query("SELECT * FROM notifications WHERE uid=? ORDER BY id DESC LIMIT ?")
    .all(uid.id, limit) as NotifRow[];
  const unread = (db
    .query("SELECT COUNT(*) AS n FROM notifications WHERE uid=? AND read_at IS NULL")
    .get(uid.id) as { n: number }).n;
  return c.json({ items: rows.map(rowToNotification), unread });
});

notifications.post("/:id/read", (c) => {
  const uid = c.get("user" as never) as { id: number };
  const id = parseInt(c.req.param("id"), 10);
  db.query("UPDATE notifications SET read_at=? WHERE uid=? AND id=? AND read_at IS NULL").run(
    Date.now(),
    uid.id,
    id,
  );
  return c.json({ ok: true });
});

notifications.post("/read-all", (c) => {
  const uid = c.get("user" as never) as { id: number };
  db.query("UPDATE notifications SET read_at=? WHERE uid=? AND read_at IS NULL").run(
    Date.now(),
    uid.id,
  );
  return c.json({ ok: true });
});

notifications.post("/clear-unread", (c) => {
  const uid = c.get("user" as never) as { id: number };
  db.query("DELETE FROM notifications WHERE uid=? AND read_at IS NULL").run(uid.id);
  return c.json({ ok: true });
});

notifications.delete("/:id", (c) => {
  const uid = c.get("user" as never) as { id: number };
  const id = parseInt(c.req.param("id"), 10);
  db.query("DELETE FROM notifications WHERE uid=? AND id=?").run(uid.id, id);
  return c.json({ ok: true });
});
