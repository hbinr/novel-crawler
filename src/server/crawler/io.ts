// 文件系统工具 + 跳过已足量文件
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { cnCount } from "./fetch.ts";

export async function ensureDir(p: string): Promise<void> {
  await mkdir(p, { recursive: true });
}

export function paddedName(idx: number, pad: number): string {
  return `${String(idx).padStart(pad, "0")}.md`;
}

export async function chapterPath(outputDir: string, idx: number, pad: number): Promise<string> {
  await ensureDir(outputDir);
  return join(outputDir, paddedName(idx, pad));
}

export async function alreadyOk(path: string, threshold: number): Promise<boolean> {
  try {
    const s = await stat(path);
    if (s.size < 1500) return false;
    const text = await readFile(path, "utf8");
    return cnCount(text) >= threshold;
  } catch {
    return false;
  }
}

export async function writeChapter(path: string, title: string, body: string): Promise<number> {
  // 确保父目录存在 — 用户导入本地书源时，outputDir 经常是新建空目录
  await ensureDir(dirname(path));
  const header = `# ${title}\n\n`;
  const content = header + body + "\n";
  await writeFile(path, content, "utf8");
  const s = await stat(path);
  return s.size;
}
