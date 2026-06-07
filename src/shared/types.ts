// 全栈共享类型

export type TaskStatus =
  | "queued"
  | "running"
  | "success"
  | "partial"
  | "failed"
  | "canceled";

export type ChapterStatus = "pending" | "downloading" | "done" | "failed" | "skipped";

export interface Book {
  id: number;
  name: string;
  bookUrl: string;
  parser: string;
  outputDir: string;
  minCn: number;
  pad: number;
  intervalLo: number;
  intervalHi: number;
  retries: number;
  ua: string;
  createdAt: number;
  updatedAt: number;
}

export interface BookInput {
  name: string;
  bookUrl: string;
  /** 解析器 id；yuebiqu=URL, localdir=本地目录, localfile=本地文件 */
  parser?: string;
  outputDir: string;
  minCn?: number;
  pad?: number;
  intervalLo?: number;
  intervalHi?: number;
  retries?: number;
  ua?: string;
}

/** 后端支持的解析器（前端用来做下拉 + 切换 UI） */
export const PARSER_OPTIONS = [
  { id: "yuebiqu", label: "yuebiqu · URL", kind: "url" as const, hint: "HTTP 站点根 URL" },
  { id: "localdir", label: "本地目录", kind: "dir" as const, hint: "目录下 .md/.txt 视为章节" },
  { id: "localfile", label: "本地文件", kind: "file" as const, hint: "单个文件作为唯一章节" },
];

export interface Chapter {
  id: number;
  bookId: number;
  idx: number;
  articleId: string;
  title: string;
  status: ChapterStatus;
  pages: number;
  cnCount: number;
  bytes: number;
  error: string | null;
  updatedAt: number;
}

export interface Task {
  id: number;
  bookId: number;
  status: TaskStatus;
  startIdx: number;
  endIdx: number | null;
  total: number;
  done: number;
  failed: number;
  currentChapter: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  createdAt: number;
}

export interface TaskInput {
  bookId: number;
  startIdx?: number;
  endIdx?: number | null;
}

export interface LogLine {
  id: number;
  ts: number;
  level: "info" | "warn" | "error" | "debug";
  taskId: number | null;
  bookId: number | null;
  msg: string;
}

export interface Settings {
  defaultIntervalLo: number;
  defaultIntervalHi: number;
  defaultRetries: number;
  defaultUa: string;
  defaultMinCn: number;
  defaultPad: number;
  defaultOutputRoot: string;
  maxConcurrentTasks: number;
  pollIntervalMs: number;
}

export interface ApiError {
  error: string;
  detail?: string;
}

export type ChapterPreview = {
  chapter: Chapter;
  content: string;
};

export type WSClientMsg =
  | { type: "subscribe"; taskId?: number | null }
  | { type: "unsubscribe"; taskId?: number };

export type WSServerMsg =
  | { type: "log"; line: LogLine }
  | { type: "task"; task: Task }
  | { type: "chapter"; chapter: Chapter }
  | { type: "notification"; notification: Notification }
  | { type: "hello"; ok: true };

export interface Notification {
  id: number;
  uid: number;
  kind: string;
  title: string;
  msg: string;
  link: string | null;
  level: "info" | "warn" | "error";
  readAt: number | null;
  createdAt: number;
}
