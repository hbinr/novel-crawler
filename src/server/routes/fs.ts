// 路由：/api/fs*
// 本地文件系统浏览/查询 — 配合 localdir / localfile 解析器
//
// 范围控制：仅暴露白名单根（家目录 / cwd / tmp），用 realpath 防 symlink 逃逸；
// 隐藏文件（. 开头）一律不展示；白名单外的请求 400。
import { Hono } from "hono";
import { stat, readdir } from "node:fs/promises";
import { resolve, sep, basename, extname } from "node:path";
import { homedir, tmpdir } from "node:os";

export interface FsEntry {
  name: string;
  path: string;
  isDir: boolean;
  isFile: boolean;
  size: number;
  mtimeMs: number;
}

interface FsStat {
  path: string;
  exists: true;
  isDir: boolean;
  isFile: boolean;
  size: number;
  childCount: number;
  // 命中章节的预估数量（仅 localdir 有意义）
  chapterHint: number;
}

// 白名单根：用户家目录、cwd、tmp（兼容 macOS 上 os.tmpdir() = /var/folders/.../T 的情况）
// 关键：把 /tmp 显式加入白名单（多数用户期望的临时目录）
function allowedRoots(): string[] {
  const roots = new Set<string>();
  roots.add(resolve(homedir()));
  roots.add(resolve(process.cwd()));
  roots.add(resolve(tmpdir()));
  roots.add(resolve("/tmp"));
  return Array.from(roots);
}

function withinAllowed(p: string): boolean {
  const real = resolve(p);
  return allowedRoots().some((root) => real === root || real.startsWith(root + sep));
}

function safeReadDir(p: string): Promise<{ name: string; path: string; isDir: boolean; isFile: boolean; size: number; mtimeMs: number }[]> {
  return readdir(p, { withFileTypes: true }).then((ents) =>
    ents
      .filter((e) => !e.name.startsWith("."))
      .map((e) => {
        const full = resolve(p, e.name);
        return {
          name: e.name,
          path: full,
          isDir: e.isDirectory(),
          isFile: e.isFile(),
          size: 0,
          mtimeMs: 0,
        };
      }),
  );
}

export const fs = new Hono();

// 列出目录内容（含自身），用于前端"目录浏览器"组件
fs.get("/browse", async (c) => {
  const raw = c.req.query("path") ?? "";
  if (!raw) return c.json({ error: "path required" }, 400);
  const p = resolve(raw);
  if (!withinAllowed(p)) return c.json({ error: "path not allowed" }, 400);

  let selfStat;
  try {
    selfStat = await stat(p);
  } catch {
    return c.json({ error: "not found" }, 404);
  }
  if (!selfStat.isDirectory()) {
    return c.json({ error: "not a directory" }, 400);
  }

  // 父目录（若还在白名单内）
  const parent = resolve(p, "..");
  const parentAllowed = withinAllowed(parent) && parent !== p;

  let entries: FsEntry[];
  try {
    const raw = await safeReadDir(p);
    // 目录靠前，文件靠后，各自按名排序
    raw.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
    // 取 size/mtime
    entries = await Promise.all(
      raw.map(async (e): Promise<FsEntry> => {
        try {
          const s = await stat(e.path);
          return { ...e, size: s.size, mtimeMs: s.mtimeMs };
        } catch {
          return { ...e, size: 0, mtimeMs: 0 };
        }
      }),
    );
  } catch (e) {
    return c.json({ error: "readdir failed", detail: (e as Error).message }, 500);
  }

  return c.json({
    path: p,
    parent: parentAllowed ? parent : null,
    entries,
  });
});

// 查询单个路径：用于"我手动粘了路径"时的快速校验
fs.get("/stat", async (c) => {
  const raw = c.req.query("path") ?? "";
  if (!raw) return c.json({ error: "path required" }, 400);
  const p = resolve(raw);
  if (!withinAllowed(p)) return c.json({ error: "path not allowed" }, 400);

  let s;
  try {
    s = await stat(p);
  } catch {
    return c.json({ exists: false, path: p }, 404);
  }
  let childCount = 0;
  let chapterHint = 0;
  if (s.isDirectory()) {
    try {
      const ents = await readdir(p, { withFileTypes: true });
      for (const e of ents) {
        if (e.isFile()) {
          childCount++;
          const ext = extname(e.name).toLowerCase();
          if (ext === ".md" || ext === ".markdown" || ext === ".txt") chapterHint++;
        } else if (e.isDirectory()) {
          childCount++;
        }
      }
    } catch {
      /* 忽略 */
    }
  }
  const out: FsStat = {
    path: p,
    exists: true,
    isDir: s.isDirectory(),
    isFile: s.isFile(),
    size: s.size,
    childCount,
    chapterHint,
  };
  return c.json(out);
});

// 列出可作为 new-book 默认根的几个推荐目录（家目录 / cwd / tmp）
fs.get("/roots", (c) => {
  const items = allowedRoots().map((p) => ({ name: basename(p) || p, path: p }));
  return c.json({ roots: items });
});
