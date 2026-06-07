import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.ts";
import { ws } from "../lib/ws.ts";
import { fmtDateTime } from "../lib/format.ts";
import {
  IconBell,
  IconCheck,
  IconCircleDot,
  IconSettings,
  IconTask,
  IconTrash,
} from "./Icons.tsx";
import type { Notification } from "@shared/types.ts";
import "./NotificationBell.css";

const KIND_ICON: Record<string, typeof IconTask> = {
  task_done: IconCheck,
  task_failed: IconCircleDot,
  task_partial: IconSettings,
  chapter_error: IconTrash,
  system: IconSettings,
};

function levelFor(n: Notification): "info" | "success" | "warn" | "error" {
  if (n.level === "warn") return "warn";
  if (n.level === "error") return "error";
  if (n.kind === "task_done") return "success";
  return "info";
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const nav = useNavigate();

  const refresh = useCallback(() => {
    api
      .listNotifications()
      .then(({ items, unread }) => {
        setItems(items);
        setUnread(unread);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const off = ws.onNotification(() => {
      refresh();
    });
    return () => {
      off();
    };
  }, [refresh]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleClick = useCallback(
    async (n: Notification) => {
      if (!n.readAt) {
        api.markRead(n.id).then(refresh).catch(() => {});
      }
      setOpen(false);
      if (n.link) nav(n.link);
    },
    [nav, refresh],
  );

  const markAll = useCallback(() => {
    api.markAllRead().then(refresh).catch(() => {});
  }, [refresh]);

  const clearUnread = useCallback(() => {
    api.clearUnread().then(refresh).catch(() => {});
  }, [refresh]);

  const headerActions = useMemo(() => {
    if (unread === 0) return null;
    return (
      <div className="actions">
        <button type="button" className="link" onClick={clearUnread}>
          清空未读
        </button>
        <button type="button" className="link primary" onClick={markAll}>
          全部已读
        </button>
      </div>
    );
  }, [unread, clearUnread, markAll]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="notif-bell"
        onClick={() => setOpen((v) => !v)}
        aria-label="通知"
      >
        <IconBell size={15} />
        {unread > 0 && <span className="count">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel" role="dialog">
          <div className="notif-header">
            <h3>通知</h3>
            {headerActions}
          </div>
          <div className="notif-list">
            {items.length === 0 ? (
              <div className="notif-empty">暂无通知</div>
            ) : (
              items.map((n) => {
                const lvl = levelFor(n);
                const Icon = KIND_ICON[n.kind] ?? IconTask;
                return (
                  <div
                    key={n.id}
                    className={`notif-item ${lvl} ${n.readAt ? "" : "unread"}`}
                    onClick={() => handleClick(n)}
                    role="button"
                  >
                    <div className="ico">
                      <Icon size={14} />
                    </div>
                    <div className="body">
                      <div className="title">{n.title}</div>
                      <div className="msg">{n.msg}</div>
                      <div className="time">{fmtDateTime(n.createdAt)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
