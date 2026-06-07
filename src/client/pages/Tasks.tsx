import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.ts";
import { ws } from "../lib/ws.ts";
import { fmtDateTime, fmtDuration } from "../lib/format.ts";
import { t } from "../lib/i18n.ts";
import { EmptyState, PageHeader } from "../components/AppShell.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { DataTable, type Column } from "../components/Table.tsx";
import { Button } from "../components/Button.tsx";
import { useToast } from "../components/Toast.tsx";
import { Breadcrumb } from "../components/Breadcrumb.tsx";
import { IconPlay, IconTask } from "../components/Icons.tsx";
import type { Task } from "@shared/types.ts";

export function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const toast = useToast();

  const refresh = useCallback(() => {
    api.listTasks().then(setTasks).catch(() => {});
  }, []);

  useEffect(() => {
    ws.connect();
    refresh();
    const off = ws.onTask(() => {
      refresh();
    });
    return () => {
      off();
    };
  }, [refresh]);

  const handleCancel = useCallback(
    async (tk: Task) => {
      await api.cancelTask(tk.id);
      toast.push({ kind: "warn", msg: t.pages.tasks.canceled(tk.id) });
      refresh();
    },
    [refresh, toast],
  );

  const handleDelete = useCallback(
    async (tk: Task) => {
      if (!confirm(t.pages.tasks.deleteConfirm(tk.id))) return;
      await api.deleteTask(tk.id);
      refresh();
    },
    [refresh],
  );

  const columns = useMemo<Column<Task>[]>(
    () => [
      {
        key: "id",
        header: "ID",
        width: "60px",
        mono: true,
        align: "right",
        render: (tk) => (
          <Link to={`/tasks/${tk.id}`} className="mono">
            #{tk.id}
          </Link>
        ),
      },
      {
        key: "status",
        header: "状态",
        width: "90px",
        render: (tk) => <StatusBadge status={tk.status} />,
      },
      {
        key: "book",
        header: "书源",
        render: (tk) => <Link to={`/books`}>#{tk.bookId}</Link>,
      },
      {
        key: "range",
        header: "范围",
        width: "100px",
        render: (tk) => (
          <span className="mono">
            {tk.startIdx}..{tk.endIdx ?? "∞"}
          </span>
        ),
      },
      {
        key: "progress",
        header: "进度",
        render: (tk) => (
          <span className="mono">
            {tk.done}/{tk.total} · 失败 {tk.failed}
          </span>
        ),
      },
      {
        key: "elapsed",
        header: "耗时",
        width: "80px",
        align: "right",
        mono: true,
        render: (tk) => (
          <span>
            {fmtDuration(
              tk.finishedAt && tk.startedAt
                ? tk.finishedAt - tk.startedAt
                : tk.startedAt
                  ? Date.now() - tk.startedAt
                  : null,
            )}
          </span>
        ),
      },
      {
        key: "created",
        header: "创建时间",
        width: "150px",
        render: (tk) => <span className="muted mono">{fmtDateTime(tk.createdAt)}</span>,
      },
      {
        key: "act",
        header: "",
        width: "140px",
        align: "right",
        render: (tk) =>
          tk.status === "running" || tk.status === "queued" ? (
            <Button size="sm" variant="danger" onClick={() => handleCancel(tk)}>
              {t.pages.tasks.cancel}
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => handleDelete(tk)}>
              {t.pages.tasks.delete}
            </Button>
          ),
      },
    ],
    [handleCancel, handleDelete],
  );

  return (
    <>
      <PageHeader
        title={t.pages.tasks.title}
        subtitle={`${tasks.length} 个任务`}
        icon={<IconTask size={18} />}
        breadcrumb={
          <Breadcrumb
            items={[
              { label: "运行" },
              { label: t.pages.tasks.title, icon: <IconTask size={11} /> },
            ]}
          />
        }
      />
      {tasks.length === 0 ? (
        <EmptyState
          icon={<IconTask size={28} />}
          title={t.pages.tasks.empty}
          desc="先到「书源」页面创建一个书源，再点击「开始爬」即可生成任务"
          action={
            <Link to="/books" style={{ textDecoration: "none" }}>
              <Button variant="primary">
                <IconPlay size={10} /> 去书源页面
              </Button>
            </Link>
          }
        />
      ) : (
        <DataTable<Task>
          rows={tasks}
          rowKey={(tk) => tk.id}
          columns={columns}
          rowClassName={(tk) => `row-${tk.status}`}
          emptyIcon={<IconTask size={20} />}
          emptyTitle={t.pages.tasks.empty}
        />
      )}
    </>
  );
}
