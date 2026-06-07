import type { ChapterStatus, LogLine, TaskStatus } from "@shared/types.ts";
import { t } from "../lib/i18n.ts";
import "./StatusBadge.css";

type Status = TaskStatus | ChapterStatus | LogLine["level"] | string;

const LABEL_TASK: Record<TaskStatus, string> = {
  queued: t.taskStatus.queued,
  running: t.taskStatus.running,
  success: t.taskStatus.success,
  partial: t.taskStatus.partial,
  failed: t.taskStatus.failed,
  canceled: t.taskStatus.canceled,
};
const LABEL_CHAPTER: Record<ChapterStatus, string> = {
  pending: t.chapterStatus.pending,
  downloading: t.chapterStatus.downloading,
  done: t.chapterStatus.done,
  failed: t.chapterStatus.failed,
  skipped: t.chapterStatus.skipped,
};
const LABEL_LOG: Record<LogLine["level"], string> = {
  info: t.logLevel.info,
  warn: t.logLevel.warn,
  error: t.logLevel.error,
  debug: t.logLevel.debug,
};

function labelFor(s: string): string {
  if (s in LABEL_TASK) return LABEL_TASK[s as TaskStatus];
  if (s in LABEL_CHAPTER) return LABEL_CHAPTER[s as ChapterStatus];
  if (s in LABEL_LOG) return LABEL_LOG[s as LogLine["level"]];
  return s;
}

export function StatusBadge({ status }: { status: Status }) {
  const s = String(status).toLowerCase();
  return (
    <span className={`badge badge-${s}`}>
      <span className="badge-dot" />
      {labelFor(s)}
    </span>
  );
}
