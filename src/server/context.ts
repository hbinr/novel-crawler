// Hono context 扩展：在 c.get("user") 时拿到 SessionUser
import type { SessionUser } from "./db/index.ts";

declare module "hono" {
  interface ContextVariableMap {
    user: SessionUser;
  }
}

export {};
