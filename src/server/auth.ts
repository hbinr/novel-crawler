// 鉴权中间件：从 cookie 拿 session token → 查 user
import type { Context, MiddlewareHandler, Next } from "hono";
import { getUserByToken, type SessionUser } from "./db/index.ts";

const COOKIE_NAME = "crawler_session";

export function getSessionToken(c: Context): string | null {
  const cookie = c.req.header("cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return m ? decodeURIComponent(m[1]!) : null;
}

export async function currentUser(c: Context): Promise<SessionUser | null> {
  const token = getSessionToken(c);
  if (!token) return null;
  return getUserByToken(token);
}

/** 鉴权中间件：未登录返回 401 */
export const requireAuth: MiddlewareHandler = async (c: Context, next: Next) => {
  const u = await currentUser(c);
  if (!u) return c.json({ error: "unauthorized" }, 401);
  c.set("user" as never, u as never);
  await next();
};

/** 解析当前用户；不强制失败（用于可选鉴权） */
export const attachUser: MiddlewareHandler = async (c: Context, next: Next) => {
  const u = await currentUser(c);
  if (u) c.set("user" as never, u as never);
  await next();
};

export const SESSION_COOKIE = COOKIE_NAME;
export const SESSION_MAX_AGE = 30 * 24 * 3600; // 30 天（秒）

/** WebSocket 连接上的用户态（升级时携带） */
export interface WSData {
  taskFilter: number | null;
  userId: number | null;
  rawCookie?: string;
  unsub?: () => void;
}
