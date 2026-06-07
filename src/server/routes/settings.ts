// 路由：/api/settings*
import { Hono } from "hono";
import { getAllSettings, setSetting } from "../db/index.ts";
import { runner } from "../jobs/runner.ts";
import type { Settings } from "@shared/types.ts";

const NUMERIC_KEYS = new Set<keyof Settings>([
  "defaultIntervalLo",
  "defaultIntervalHi",
  "defaultRetries",
  "defaultMinCn",
  "defaultPad",
  "maxConcurrentTasks",
  "pollIntervalMs",
]);

function toSettings(all: Record<string, string>): Settings {
  return {
    defaultIntervalLo: parseFloat(all.default_interval_lo ?? "0.3"),
    defaultIntervalHi: parseFloat(all.default_interval_hi ?? "0.6"),
    defaultRetries: parseInt(all.default_retries ?? "3", 10),
    defaultUa: all.default_ua ?? "",
    defaultMinCn: parseInt(all.default_min_cn ?? "1000", 10),
    defaultPad: parseInt(all.default_pad ?? "4", 10),
    defaultOutputRoot: all.default_output_root ?? "",
    maxConcurrentTasks: parseInt(all.max_concurrent_tasks ?? "2", 10),
    pollIntervalMs: parseInt(all.poll_interval_ms ?? "1500", 10),
  };
}

export const settings = new Hono();

settings.get("/", (c) => {
  return c.json(toSettings(getAllSettings(c.get("user").id)));
});

settings.put("/", async (c) => {
  const uid = c.get("user").id;
  const body = (await c.req.json().catch(() => null)) as Partial<Settings> | null;
  if (!body) return c.json({ error: "invalid json" }, 400);
  for (const k of Object.keys(body) as (keyof Settings)[]) {
    if (!(k in body)) continue;
    const v = body[k];
    if (v === undefined) continue;
    const stored = NUMERIC_KEYS.has(k) ? String(v) : (v as string);
    const dbKey = k.replace(/[A-Z]/g, (m, i) => (i === 0 ? m.toLowerCase() : "_" + m.toLowerCase()));
    setSetting(dbKey, stored, uid);
  }
  runner.refresh();
  return c.json(toSettings(getAllSettings(uid)));
});
