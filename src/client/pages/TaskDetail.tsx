import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api.ts";
import { ws } from "../lib/ws.ts";
import { fmtBytes, fmtDateTime, fmtDuration, fmtTime } from "../lib/format.ts";
import { t } from "../lib/i18n.ts";
import { PageHeader, ProgressBar } from "../components/AppShell.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { VirtualList } from "../components/VirtualList.tsx";
import { LogStream } from "../components/LogStream.tsx";
import { Select } from "../components/Input.tsx";
import { Button } from "../components/Button.tsx";
import { Breadcrumb } from "../components/Breadcrumb.tsx";
import { SectionTitle, Toolbar } from "../components/Toolbar.tsx";
import {
  IconRefresh,
  IconTask,
} from "../components/Icons.tsx";
import type { Chapter, ChapterStatus, LogLine, Task } from "@shared/types.ts";
import "../components/VirtualList.css";

const PAGE_SIZE = 200;
const ROW_H = 36;

export function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const taskId = parseInt(id ?? "0", 10);
  const [task, setTask] = useState<Task | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const loadingRef = useRef(false);

  const loadPage = useCallback(
    async (bookId: number, status: string | null, offset: number, replace = false) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      try {
        const page = await api.listChapters(bookId, {
          status: status ?? undefined,
          limit: PAGE_SIZE,
          offset,
          includeCount: offset === 0,
        });
        setChapters((prev) => (replace ? page.items : [...prev, ...page.items]));
        if (page.total != null) setTotal(page.total);
        // 到达末尾：返回的数量 < 页大小 或 已加载数 ≥ total
        setHasMore(
          page.items.length === PAGE_SIZE && (page.total == null || offset + page.items.length < page.total),
        );
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [],
  );

  const refresh = useCallback(async () => {
    const t = await api.listTasks();
    const me = t.find((x) => x.id === taskId) ?? null;
    setTask(me);
    if (me) {
      const cnt = await api.chapterCount(me.bookId);
      setCounts(cnt.byStatus);
      // 重置：清空 chapters 走第一页
      setChapters([]);
      setTotal(cnt.total);
      setHasMore(true);
      await loadPage(me.bookId, filter === "all" ? null : filter, 0, true);
    }
  }, [filter, loadPage, taskId]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // 切换 filter 时重载
  useEffect(() => {
    if (!task) return;
    setChapters([]);
    setHasMore(true);
    loadPage(task.bookId, filter === "all" ? null : filter, 0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    api.listLogs({ taskId, limit: 200 }).then(setLogs).catch(() => {});
  }, [taskId]);

  useEffect(() => {
    ws.connect();
    ws.subscribeTask(taskId);
    const offT = ws.onTask((t) => {
      if (t.id !== taskId) return;
      setTask(t);
      // 不再重载全表；只更新单条
    });
    const offC = ws.onChapter((c) => {
      // 实时更新：用 db id 匹配替换
      setChapters((prev) => {
        const i = prev.findIndex((x) => x.id === c.id);
        if (i < 0) {
          // 新章节（首次刷新索引时新增）— 仅当 status filter 匹配才插入
          if (filter !== "all" && filter !== c.status) return prev;
          return [...prev, c];
        }
        const next = prev.slice();
        next[i] = c;
        return next;
      });
      // 更新 counts
      setCounts((prev) => {
        const old = prev[c.status] ?? 0;
        return { ...prev, [c.status]: old + 1 };
      });
    });
    return () => {
      offT();
      offC();
      ws.subscribeTask(null);
    };
  }, [filter, taskId]);

  const loadMore = useCallback(() => {
    if (!task || !hasMore || loading) return;
    loadPage(task.bookId, filter === "all" ? null : filter, chapters.length);
  }, [chapters.length, filter, hasMore, loading, loadPage, task]);

  if (!task) return <PageHeader title={t.pages.taskDetail.title(taskId)} subtitle="loading…" />;

  // 进度条用 task.done / task.total（覆盖全量，不只是已加载）
  const displayTotal = task.total || total || 0;

  return (
    <>
      <PageHeader
        eyebrow={<span className="mono">#{task.id}</span>}
        title={t.pages.taskDetail.title(task.id)}
        subtitle={
          <span className="row" style={{ gap: 12, flexWrap: "wrap" }}>
            <StatusBadge status={task.status} />
            <span>{t.pages.taskDetail.book(task.bookId)}</span>
            <span className="muted">
              {fmtDateTime(task.startedAt)} ·{" "}
              {fmtDuration(
                task.finishedAt && task.startedAt
                  ? task.finishedAt - task.startedAt
                  : task.startedAt
                    ? Date.now() - task.startedAt
                    : null,
              )}
            </span>
          </span>
        }
        breadcrumb={
          <Breadcrumb
            items={[
              { label: "任务", to: "/tasks", icon: <IconTask size={11} /> },
              { label: `#${task.id}` },
            ]}
          />
        }
        actions={
          <Button size="sm" variant="ghost" onClick={refresh} disabled={loading}>
            <IconRefresh size={12} /> 刷新
          </Button>
        }
      />

      <div className="card" style={{ marginBottom: 20 }}>
        <Toolbar
          title={t.pages.taskDetail.progress}
          hint={
            <span className="mono">
              {task.done} / {displayTotal} · 失败 {task.failed}
              {total != null && total > chapters.length && (
                <span style={{ marginLeft: 8, color: "var(--text-lo)" }}>
                  · 已加载 {chapters.length}
                </span>
              )}
            </span>
          }
        />
        <ProgressBar value={task.done + task.failed} max={displayTotal || 1} />
        {task.currentChapter && (
          <div className="muted mono" style={{ marginTop: 10, fontSize: 12 }}>
            ↳ {task.currentChapter}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 20, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px 12px" }}>
          <Toolbar
            title={t.pages.taskDetail.chapters}
            hint={total != null ? <>共 {total} 章</> : undefined}
            actions={
              <Select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="select-sm"
              >
                <option value="all">
                  全部 ({Object.values(counts).reduce((a, b) => a + b, 0)})
                </option>
                {Object.entries(counts).map(([k, v]) => (
                  <option key={k} value={k}>
                    {statusLabel(k as ChapterStatus)} ({v})
                  </option>
                ))}
              </Select>
            }
          />
        </div>

        <div className="chapter-grid-head">
          <div>#</div>
          <div>标题</div>
          <div>文章ID</div>
          <div>状态</div>
          <div className="right">页数</div>
          <div className="right">字数</div>
          <div className="right">大小</div>
        </div>

        <div style={{ height: 480 }}>
          {chapters.length === 0 && !loading ? (
            <div className="empty-mini">{t.pages.taskDetail.empty}</div>
          ) : (
            <VirtualList<Chapter>
              items={chapters}
              rowKey={(c) => c.id}
              rowHeight={ROW_H}
              height="100%"
              renderRow={(c) => (
                <div className={`chapter-row row-${c.status}`}>
                  <div className="num right">{String(c.idx).padStart(4, "0")}</div>
                  <div className="title">
                    {c.title}
                    {c.error && <span className="muted"> — {c.error}</span>}
                  </div>
                  <div className="mono muted">{c.articleId}</div>
                  <div className={`status ${c.status}`}>
                    <span className="dot" />
                    <span style={{ fontSize: 11 }}>{statusLabel(c.status)}</span>
                  </div>
                  <div className="right num">{c.pages}</div>
                  <div className="right num">{c.cnCount}</div>
                  <div className="right num">{fmtBytes(c.bytes)}</div>
                </div>
              )}
              footer={
                hasMore ? (
                  <div className="loadmore-row">
                    {loading ? "加载中…" : (
                      <Button size="sm" variant="ghost" onClick={loadMore} disabled={loading}>
                        加载更多 ({chapters.length}
                        {total != null ? ` / ${total}` : ""})
                      </Button>
                    )}
                  </div>
                ) : chapters.length > 0 ? (
                  <div className="loaded-all">已加载全部 {chapters.length} 章</div>
                ) : null
              }
            />
          )}
        </div>
      </div>

      <SectionTitle title={t.pages.taskDetail.liveLogs} />
      <LogStream initial={logs} />
    </>
  );
}

function statusLabel(s: ChapterStatus): string {
  switch (s) {
    case "pending": return "待处理";
    case "downloading": return "下载中";
    case "done": return "完成";
    case "failed": return "失败";
    case "skipped": return "已跳过";
  }
}
