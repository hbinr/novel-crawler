// 路由：/api/auth/*
import { Hono } from "hono";
import {
  createSession,
  destroySession,
  verifyCredentials,
  getUserByToken,
} from "../db/index.ts";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  getSessionToken,
} from "../auth.ts";

export const auth = new Hono();

auth.post("/login", async (c) => {
  const body = (await c.req.json().catch(() => null)) as
    | { username?: string; password?: string }
    | null;
  if (!body || !body.username || !body.password) {
    return c.json({ error: "用户名和密码必填" }, 400);
  }
  const u = await verifyCredentials(body.username, body.password);
  if (!u) return c.json({ error: "用户名或密码错误" }, 401);
  const token = createSession(u.id);
  c.header(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`,
  );
  return c.json({ user: u });
});

auth.post("/logout", (c) => {
  const token = getSessionToken(c);
  if (token) destroySession(token);
  c.header("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return c.json({ ok: true });
});

auth.get("/me", (c) => {
  const token = getSessionToken(c);
  const u = token ? getUserByToken(token) : null;
  if (!u) return c.json({ user: null }, 401);
  return c.json({ user: u });
});
