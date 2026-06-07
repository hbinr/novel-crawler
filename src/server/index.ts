// 服务端入口：Hono + Bun.serve，REST + WebSocket
import "./context.ts"; // 类型扩展
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { logBus } from "./jobs/log-bus.ts";
import { runner } from "./jobs/runner.ts";
import { books } from "./routes/books.ts";
import { tasks } from "./routes/tasks.ts";
import { chapters } from "./routes/chapters.ts";
import { logs } from "./routes/logs.ts";
import { settings } from "./routes/settings.ts";
import { stats } from "./routes/stats.ts";
import { auth } from "./routes/auth.ts";
import { notifications } from "./routes/notifications.ts";
import { fs } from "./routes/fs.ts";
import { onNotification } from "./notify.ts";
import { requireAuth, type WSData } from "./auth.ts";
import type { WSClientMsg, WSServerMsg } from "@shared/types.ts";

const api = new Hono();

api.route("/auth", auth);

api.use("/books/*", requireAuth);
api.use("/tasks/*", requireAuth);
api.use("/chapters/*", requireAuth);
api.use("/logs/*", requireAuth);
api.use("/settings/*", requireAuth);
api.use("/stats/*", requireAuth);
api.use("/notifications/*", requireAuth);
api.use("/fs/*", requireAuth);

api.route("/books", books);
api.route("/tasks", tasks);
api.route("/chapters", chapters);
api.route("/logs", logs);
api.route("/settings", settings);
api.route("/stats", stats);
api.route("/notifications", notifications);
api.route("/fs", fs);

const app = new Hono();
app.route("/api", api);

runner.start();
console.log("[server] runner started");

import { existsSync } from "node:fs";
import { join } from "node:path";
const clientDist = join(process.cwd(), "dist", "client");
if (existsSync(clientDist)) {
  app.use("/*", serveStatic({ root: "./dist/client" }));
  app.get("/*", serveStatic({ path: "./dist/client/index.html" }));
}

const port = parseInt(process.env.PORT ?? "3000", 10);

const server = Bun.serve({
  port,
  async fetch(req, srv) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      const ok = srv.upgrade(req, {
        data: { taskFilter: null, userId: null, rawCookie: req.headers.get("cookie") ?? "" } as WSData,
      });
      if (ok) return undefined;
      return new Response("upgrade failed", { status: 400 });
    }
    return app.fetch(req);
  },
  websocket: {
    data: {} as WSData,
    async open(ws) {
      const cookie = ws.data.rawCookie ?? "";
      const m = cookie.match(/(?:^|;\s*)crawler_session=([^;]+)/);
      if (m) {
        const { getUserByToken } = await import("./db/index.ts");
        const u = getUserByToken(decodeURIComponent(m[1]!));
        if (u) ws.data.userId = u.id;
      }
      ws.send(JSON.stringify({ type: "hello", ok: true } satisfies WSServerMsg));
      const unsubLog = logBus.subscribe((msg) => {
        if (!ws.data.userId) return;
        if (msg.type === "task" && ws.data.taskFilter != null && msg.task.id !== ws.data.taskFilter) {
          return;
        }
        try {
          ws.send(JSON.stringify(msg));
        } catch {
          /* closed */
        }
      });
      const unsubNotif = onNotification((uid, notif) => {
        if (ws.data.userId !== uid) return;
        try {
          ws.send(JSON.stringify({ type: "notification", notification: notif } satisfies WSServerMsg));
        } catch {
          /* closed */
        }
      });
      ws.data.unsub = () => {
        unsubLog();
        unsubNotif();
      };
    },
    message(ws, raw) {
      try {
        const msg = JSON.parse(raw.toString()) as WSClientMsg;
        if (msg.type === "subscribe") {
          ws.data.taskFilter = msg.taskId ?? null;
        } else if (msg.type === "unsubscribe") {
          ws.data.taskFilter = null;
        }
      } catch {
        /* ignore */
      }
    },
    close(ws) {
      ws.data.unsub?.();
    },
  },
});

console.log(`[server] listening on http://localhost:${server.port}`);
