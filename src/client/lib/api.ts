// API 客户端 — fetch 包装，类型安全
import type {
  Book,
  BookInput,
  Chapter,
  ChapterPreview,
  LogLine,
  Notification,
  Settings,
  Task,
  TaskInput,
} from "@shared/types.ts";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText} — ${body}`);
  }
  return res.json() as Promise<T>;
}

export interface SessionUser {
  id: number;
  username: string;
  displayName: string;
  role: string;
}

export interface FsEntry {
  name: string;
  path: string;
  isDir: boolean;
  isFile: boolean;
  size: number;
  mtimeMs: number;
}

export interface FsBrowse {
  path: string;
  parent: string | null;
  entries: FsEntry[];
}

export interface FsStat {
  path: string;
  exists: boolean;
  isDir: boolean;
  isFile: boolean;
  size: number;
  childCount: number;
  chapterHint: number;
}

export interface ChapterPage {
  items: Chapter[];
  total: number | null;
}

export interface ChapterCount {
  total: number;
  byStatus: Record<string, number>;
}

export const api = {
  // Auth
  me: () => fetch("/api/auth/me", { credentials: "same-origin" })
    .then(jsonOrThrow<{ user: SessionUser | null }>)
    .then((r) => r.user),
  login: (username: string, password: string) =>
    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ username, password }),
    }).then(jsonOrThrow<{ user: SessionUser }>),
  logout: () =>
    fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" })
      .then(jsonOrThrow<{ ok: true }>),

  stats: () => fetch("/api/stats", { credentials: "same-origin" }).then((r) => jsonOrThrow<{
    books: number;
    running: number;
    queued: number;
    maxConcurrent: number;
    slotsAvailable: number;
    chapters: number;
    done: number;
    failed: number;
  }>(r)),

  // Books
  listBooks: () => fetch("/api/books", { credentials: "same-origin" }).then((r) => jsonOrThrow<Book[]>(r)),
  getBook: (id: number) => fetch(`/api/books/${id}`, { credentials: "same-origin" }).then((r) => jsonOrThrow<Book>(r)),
  createBook: (b: BookInput) =>
    fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(b),
    }).then((r) => jsonOrThrow<Book>(r)),
  updateBook: (id: number, b: Partial<BookInput>) =>
    fetch(`/api/books/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(b),
    }).then((r) => jsonOrThrow<Book>(r)),
  deleteBook: (id: number) =>
    fetch(`/api/books/${id}`, { method: "DELETE", credentials: "same-origin" }).then((r) => jsonOrThrow<{ ok: true }>(r)),
  refreshIndex: (id: number) =>
    fetch(`/api/books/${id}/refresh-index`, { method: "POST", credentials: "same-origin" })
      .then((r) => jsonOrThrow<{ ok: true; total: number }>(r)),

  // Tasks
  listTasks: (bookId?: number) =>
    fetch(`/api/tasks${bookId ? `?bookId=${bookId}` : ""}`, { credentials: "same-origin" })
      .then((r) => jsonOrThrow<Task[]>(r)),
  createTask: (t: TaskInput) =>
    fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(t),
    }).then((r) => jsonOrThrow<Task>(r)),
  cancelTask: (id: number) =>
    fetch(`/api/tasks/${id}/cancel`, { method: "POST", credentials: "same-origin" })
      .then((r) => jsonOrThrow<Task>(r)),
  deleteTask: (id: number) =>
    fetch(`/api/tasks/${id}`, { method: "DELETE", credentials: "same-origin" })
      .then((r) => jsonOrThrow<{ ok: true }>(r)),

  // Chapters — 分页接口，total 为 null 时表示未知
  listChapters: (
    bookId: number,
    opts: { status?: string; limit?: number; offset?: number; includeCount?: boolean } = {},
  ) => {
    const q = new URLSearchParams({ bookId: String(bookId) });
    if (opts.status) q.set("status", opts.status);
    if (opts.limit != null) q.set("limit", String(opts.limit));
    if (opts.offset != null) q.set("offset", String(opts.offset));
    if (opts.includeCount) q.set("include", "count");
    return fetch(`/api/chapters?${q}`, { credentials: "same-origin" })
      .then((r) => jsonOrThrow<ChapterPage>(r));
  },
  chapterCount: (bookId: number) =>
    fetch(`/api/chapters/count?bookId=${bookId}`, { credentials: "same-origin" })
      .then((r) => jsonOrThrow<ChapterCount>(r)),
  chapterContent: (id: number) =>
    fetch(`/api/chapters/${id}/content`, { credentials: "same-origin" })
      .then((r) => jsonOrThrow<ChapterPreview>(r)),

  // Logs
  listLogs: (opts: { taskId?: number; bookId?: number; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (opts.taskId) q.set("taskId", String(opts.taskId));
    if (opts.bookId) q.set("bookId", String(opts.bookId));
    q.set("limit", String(opts.limit ?? 200));
    return fetch(`/api/logs?${q}`, { credentials: "same-origin" }).then((r) => jsonOrThrow<LogLine[]>(r));
  },

  // Settings
  getSettings: () => fetch("/api/settings", { credentials: "same-origin" }).then((r) => jsonOrThrow<Settings>(r)),
  updateSettings: (s: Partial<Settings>) =>
    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(s),
    }).then((r) => jsonOrThrow<Settings>(r)),

  // Notifications
  listNotifications: () =>
    fetch("/api/notifications", { credentials: "same-origin" })
      .then((r) => jsonOrThrow<{ items: Notification[]; unread: number }>(r)),
  markRead: (id: number) =>
    fetch(`/api/notifications/${id}/read`, { method: "POST", credentials: "same-origin" })
      .then((r) => jsonOrThrow<{ ok: true }>(r)),
  markAllRead: () =>
    fetch(`/api/notifications/read-all`, { method: "POST", credentials: "same-origin" })
      .then((r) => jsonOrThrow<{ ok: true }>(r)),
  clearUnread: () =>
    fetch(`/api/notifications/clear-unread`, { method: "POST", credentials: "same-origin" })
      .then((r) => jsonOrThrow<{ ok: true }>(r)),
  deleteNotification: (id: number) =>
    fetch(`/api/notifications/${id}`, { method: "DELETE", credentials: "same-origin" })
      .then((r) => jsonOrThrow<{ ok: true }>(r)),

  // Local filesystem
  fsBrowse: (path: string) =>
    fetch(`/api/fs/browse?path=${encodeURIComponent(path)}`, { credentials: "same-origin" })
      .then((r) => jsonOrThrow<FsBrowse>(r)),
  fsStat: (path: string) =>
    fetch(`/api/fs/stat?path=${encodeURIComponent(path)}`, { credentials: "same-origin" })
      .then((r) => jsonOrThrow<FsStat>(r)),
  fsRoots: () =>
    fetch("/api/fs/roots", { credentials: "same-origin" })
      .then((r) => jsonOrThrow<{ roots: { name: string; path: string }[] }>(r)),
};

export const safeListTasks = () =>
  api.listTasks().catch(() => [] as Awaited<ReturnType<typeof api.listTasks>>);
