import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, safeListTasks } from "../lib/api.ts";
import { ws } from "../lib/ws.ts";
import { fmtDateTime } from "../lib/format.ts";
import { t } from "../lib/i18n.ts";
import { Hero, PageHeader, StatCard, ProgressBar, EmptyState } from "../components/AppShell.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { DataTable, type Column } from "../components/Table.tsx";
import { Button } from "../components/Button.tsx";
import { Breadcrumb } from "../components/Breadcrumb.tsx";
import {
  IconActivity,
  IconBolt,
  IconCheck,
  IconCircleDot,
  IconLayers,
  IconPlus,
  IconSparkle,
  IconTarget,
  IconTask,
} from "../components/Icons.tsx";
import type { Task } from "@shared/types.ts";

interface Stats {
  books: number;
  running: number;
  queued: number;
  maxConcurrent: number;
  slotsAvailable: number;
  chapters: number;
  done: number;
  failed: number;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "夜深了";
  if (h < 11) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  if (h < 22) return "晚上好";
  return "夜深了";
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

  const refresh = useCallback(() => {
    Promise.all([api.stats(), safeListTasks()])
      .then(([s, t]) => {
        setStats(s);
        setTasks(t);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    ws.connect();
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    const off = ws.onTask(() => {
      refresh();
    });
    return () => {
      off();
    };
  }, [refresh]);

  const active = useMemo(
    () => tasks.filter((t) => t.status === "running" || t.status === "queued"),
    [tasks],
  );
  const recent = useMemo(() => tasks.slice(0, 8), [tasks]);

  const successRate =
    stats && stats.chapters > 0 ? ((stats.done / stats.chapters) * 100).toFixed(1) : null;
  const totalChapters = stats?.chapters ?? 0;
  const failureRate =
    stats && stats.chapters > 0 ? ((stats.failed / stats.chapters) * 100).toFixed(1) : null;

  return (
    <>
      <Hero
        greeting={
          <>
            <IconSparkle size={12} />
            {greeting()} · {fmtDateTime(Date.now()).split(" ").slice(0, 1).join(" ")}
          </>
        }
        title={
          stats && stats.running > 0 ? (
            <>
              正在并发抓取 <span className="accent">{stats.running}</span> 个任务
            </>
          ) : (
            <>一切就绪</>
          )
        }
        subtitle={
          stats && stats.running > 0
            ? `${stats.queued} 个排队中 · ${stats.slotsAvailable}/${stats.maxConcurrent} 槽空闲`
            : "点击「书源」新建一个爬取任务，控制台会实时显示进度"
        }
        actions={
          <>
            <Link to="/logs" style={{ textDecoration: "none" }}>
              <Button variant="ghost" size="md">
                查看实时日志
              </Button>
            </Link>
            <Link to="/books" style={{ textDecoration: "none" }}>
              <Button variant="primary">
                <IconPlus size={12} /> 新建任务
              </Button>
            </Link>
          </>
        }
        stats={
          stats
            ? [
                { v: stats.books, l: "书源" },
                { v: totalChapters, l: "章节总数" },
                { v: stats.done, l: "已抓取" },
              ]
            : undefined
        }
      />

      <PageHeader
        title={t.pages.dashboard.title}
        subtitle={t.pages.dashboard.subtitle}
        breadcrumb={
          <Breadcrumb
            items={[
              { label: "运行" },
              { label: t.pages.dashboard.title, icon: <IconActivity size={11} /> },
            ]}
          />
        }
      />

      <div className="stat-grid">
        <StatCard
          icon={<IconBolt size={16} />}
          label={t.pages.dashboard.statActive}
          value={(stats?.running ?? 0) + (stats?.queued ?? 0)}
          foot={`${t.pages.dashboard.concurrencyRunning} ${stats?.running ?? 0} · ${t.pages.dashboard.concurrencyQueued} ${stats?.queued ?? 0}`}
          accent="primary"
        />
        <StatCard
          icon={<IconLayers size={16} />}
          label={t.pages.dashboard.statConcurrency}
          value={`${stats?.running ?? 0} / ${stats?.maxConcurrent ?? "—"}`}
          foot={
            stats
              ? stats.slotsAvailable > 0
                ? `${stats.slotsAvailable} ${t.pages.dashboard.concurrencySlots}`
                : t.pages.dashboard.concurrencyFull
              : "—"
          }
          accent="info"
        />
        <StatCard
          icon={<IconCheck size={16} />}
          label={t.pages.dashboard.statSuccessRate}
          value={successRate ? `${successRate}%` : "—"}
          foot={failureRate ? `失败 ${failureRate}%` : "—"}
          accent="success"
        />
        <StatCard
          icon={<IconTarget size={16} />}
          label="失败章节"
          value={stats?.failed ?? 0}
          foot={stats ? `${totalChapters} 总数` : "—"}
          accent="warning"
        />
      </div>

      {active.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title">{t.pages.dashboard.runningTitle}</div>
          <div className="col" style={{ gap: 14 }}>
            {active.map((t) => (
              <Link
                key={t.id}
                to={`/tasks/${t.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="col" style={{ gap: 6 }}>
                  <div className="row">
                    <span className="row" style={{ gap: 8 }}>
                      <IconCircleDot size={10} className={t.status === "running" ? "running" : ""} />
                      <strong className="mono">#{t.id}</strong>
                      <StatusBadge status={t.status} />
                    </span>
                    <span className="muted mono">
                      {t.done}/{t.total} · 失败 {t.failed}
                    </span>
                    <div className="spacer" />
                    <span className="muted mono" style={{ fontSize: 12 }}>
                      {t.currentChapter ?? ""}
                    </span>
                  </div>
                  <ProgressBar value={t.done + t.failed} max={t.total || 1} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="row" style={{ marginBottom: 12, alignItems: "center" }}>
        <div className="card-title" style={{ margin: 0 }}>
          {t.pages.dashboard.recentTitle}
        </div>
        <div className="spacer" />
        {tasks.length > 0 && (
          <Link to="/tasks" className="muted" style={{ fontSize: 12 }}>
            查看全部 →
          </Link>
        )}
      </div>
      {tasks.length === 0 ? (
        <EmptyState
          icon={<IconTask size={28} />}
          title="还没有任何任务"
          desc="从「书源」页面新建一个爬取任务，所有任务都会在这里显示实时进度"
          action={
            <Link to="/books" style={{ textDecoration: "none" }}>
              <Button variant="primary">
                <IconPlus size={12} /> 去新建书源
              </Button>
            </Link>
          }
        />
      ) : (
        <DataTable<Task>
          rows={recent}
          rowKey={(r) => r.id}
          columns={TASK_COLUMNS}
          emptyIcon={<IconTask size={20} />}
          emptyTitle="还没有任何任务"
          emptyHint="从书源页面新建一个爬取任务"
        />
      )}
    </>
  );
}

const TASK_COLUMNS: Column<Task>[] = [
  {
    key: "id",
    header: "ID",
    width: "60px",
    mono: true,
    align: "right",
    render: (t) => (
      <Link to={`/tasks/${t.id}`} className="mono">
        #{t.id}
      </Link>
    ),
  },
  {
    key: "status",
    header: "状态",
    width: "100px",
    render: (t) => <StatusBadge status={t.status} />,
  },
  {
    key: "progress",
    header: "进度",
    render: (t) => (
      <span className="mono">
        {t.done}/{t.total} · 失败 {t.failed}
      </span>
    ),
  },
  {
    key: "chapter",
    header: "当前章节",
    render: (t) => <span className="muted">{t.currentChapter ?? "—"}</span>,
  },
  {
    key: "started",
    header: "开始时间",
    width: "160px",
    render: (t) => <span className="muted mono">{fmtDateTime(t.startedAt)}</span>,
  },
];
