import { type ReactNode, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { t } from "../lib/i18n.ts";
import {
  IconActivity,
  IconBook,
  IconChevronLeft,
  IconChevronRight,
  IconCircleDot,
  IconEye,
  IconLog,
  IconLogout,
  IconSearch,
  IconSettings,
  IconTask,
} from "./Icons.tsx";
import { useAuth } from "../lib/auth.tsx";
import { NotificationBell } from "./NotificationBell.tsx";
import { ThemeSwitcher } from "./ThemeSwitcher.tsx";
import "./AppShell.css";

interface NavStat {
  running: number;
  queued: number;
}

const NAV_GROUPS: Array<{
  label: string;
  items: Array<{
    to: string;
    labelKey: keyof typeof t.nav;
    Icon: typeof IconActivity;
    end?: boolean;
    showBadge: null | "running" | "queued";
    shortcut: string;
  }>;
}> = [
  {
    label: "运行",
    items: [
      { to: "/", labelKey: "dashboard", Icon: IconActivity, end: true, showBadge: null, shortcut: "1" },
      { to: "/books", labelKey: "books", Icon: IconBook, showBadge: null, shortcut: "2" },
      { to: "/tasks", labelKey: "tasks", Icon: IconTask, showBadge: "running", shortcut: "3" },
      { to: "/logs", labelKey: "logs", Icon: IconLog, showBadge: "queued", shortcut: "4" },
    ],
  },
  {
    label: "资源",
    items: [
      { to: "/preview", labelKey: "preview", Icon: IconEye, showBadge: null, shortcut: "5" },
      { to: "/settings", labelKey: "settings", Icon: IconSettings, showBadge: null, shortcut: "6" },
    ],
  },
];

const STORAGE_KEY = "shell.collapsed";

export function AppShell({ running, queued }: { running: number; queued: number }) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  });
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const h = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [userMenuOpen]);

  const stats: NavStat = { running, queued };
  const initial = user?.displayName?.charAt(0) ?? user?.username.charAt(0).toUpperCase() ?? "U";

  return (
    <div className={`shell ${collapsed ? "collapsed" : ""}`}>
      <header className="topbar">
        <div className="topbar-brand-wrap">
          <div className="topbar-brand">
            <div className="logo">
              <IconBook size={16} />
            </div>
            <span className="name">{t.app.title}</span>
            <span className="tag">· {t.app.tagline}</span>
          </div>
        </div>
        <button
          type="button"
          className="topbar-collapse"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
          title={collapsed ? "展开" : "折叠"}
        >
          {collapsed ? <IconChevronRight size={14} /> : <IconChevronLeft size={14} />}
        </button>
        <div className="topbar-spacer" />
        <div className="topbar-search" tabIndex={0}>
          <span className="ico">
            <IconSearch size={14} />
          </span>
          <span className="placeholder">搜索书源 / 任务…</span>
          <span className="kbd">⌘K</span>
        </div>
        <ThemeSwitcher />
        <NotificationBell />
        <div className={`topbar-status ${running > 0 ? "running" : ""}`}>
          <span className="dot" />
          <span className="label">{running > 0 ? t.status.running : t.status.idle}</span>
          <span className="num">{running}</span>
        </div>
        {user && (
          <div className="user-menu" ref={userMenuRef}>
            <button
              type="button"
              className="user-button"
              onClick={() => setUserMenuOpen((v) => !v)}
              title={user.displayName}
            >
              <span className="avatar">{initial}</span>
              <span className="uname">{user.displayName}</span>
            </button>
            {userMenuOpen && (
              <div className="user-dropdown">
                <div className="user-info">
                  <div className="user-name">{user.displayName}</div>
                  <div className="user-meta">
                    @{user.username} · {user.role === "admin" ? "管理员" : "用户"}
                  </div>
                </div>
                <button
                  type="button"
                  className="user-action"
                  onClick={async () => {
                    setUserMenuOpen(false);
                    await logout();
                    nav("/login", { replace: true });
                  }}
                >
                  <IconLogout size={13} /> 退出登录
                </button>
              </div>
            )}
          </div>
        )}
      </header>
      <nav className="sidebar">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className="nav-group">
            {!collapsed && (
              <div className="nav-group-label">
                <span>{group.label}</span>
              </div>
            )}
            {group.items.map((n) => {
              const Icon = n.Icon;
              const label = t.nav[n.labelKey].label;
              const badgeVal = n.showBadge ? stats[n.showBadge] : 0;
              return (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  title={collapsed ? label : undefined}
                  style={{ animationDelay: `${(gi * 4 + group.items.indexOf(n)) * 24}ms` }}
                  className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                >
                  <span className="nav-icon-box" aria-hidden="true">
                    <Icon size={15} />
                  </span>
                  <span className="label">{label}</span>
                  {n.showBadge && badgeVal > 0 && (
                    <span className={`badge ${n.showBadge === "running" ? "live" : ""}`}>
                      {badgeVal}
                    </span>
                  )}
                  {!collapsed && <kbd className="nav-shortcut">{n.shortcut}</kbd>}
                </NavLink>
              );
            })}
          </div>
        ))}
        <div className="sidebar-footer">
          <div className="sidebar-status" title={running > 0 ? "爬虫正在运行" : "当前空闲"}>
            <span className={`status-dot ${running > 0 ? "live" : "idle"}`} />
            <div className="status-text">
              <div className="status-line">{running > 0 ? t.status.running : t.status.idle}</div>
              <div className="status-sub">
                {running} 运行 · {queued} 排队
              </div>
            </div>
          </div>
          <div className="sidebar-meta">
            <span className="lbl">版本</span>
            <span className="v mono">0.1.0</span>
          </div>
        </div>
      </nav>
      <main className="main" id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  icon,
  eyebrow,
  breadcrumb,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  /** 小型 "eyebrow" 标签（在标题上方，dim + uppercase + small） */
  eyebrow?: ReactNode;
  /** 面包屑：传入 Breadcrumb 节点，渲染在标题上方 */
  breadcrumb?: ReactNode;
}) {
  return (
    <div className="page-header">
      {breadcrumb && <div className="page-breadcrumb">{breadcrumb}</div>}
      <div className="page-header-main">
        {icon && <div className="ico">{icon}</div>}
        <div className="page-title-block">
          {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
          <div className="page-title-row">
            <h1 className="page-title">{title}</h1>
          </div>
          {subtitle && <div className="page-subtitle">{subtitle}</div>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  foot,
  icon,
  accent = "primary",
  trend,
}: {
  label: ReactNode;
  value: ReactNode;
  foot?: ReactNode;
  icon?: ReactNode;
  accent?: "primary" | "success" | "warning" | "info" | "running";
  trend?: { kind: "up" | "down" | "neutral"; text: string };
}) {
  const accentMap = {
    primary: { color: "var(--primary)", bg: "var(--primary-soft)", glow: "rgba(124, 92, 255, 0.22)" },
    success: { color: "var(--success)", bg: "rgba(52, 211, 153, 0.12)", glow: "rgba(52, 211, 153, 0.24)" },
    warning: { color: "var(--warning)", bg: "rgba(251, 191, 36, 0.12)", glow: "rgba(251, 191, 36, 0.24)" },
    info: { color: "var(--info)", bg: "rgba(96, 165, 250, 0.12)", glow: "rgba(96, 165, 250, 0.24)" },
    running: { color: "var(--running)", bg: "var(--primary-soft)", glow: "rgba(124, 92, 255, 0.24)" },
  }[accent];
  return (
    <div
      className="stat-card"
      style={
        {
          ["--accent" as string]: accentMap.color,
          ["--accent-bg" as string]: accentMap.bg,
          ["--accent-glow" as string]: accentMap.glow,
          ["--accent-border" as string]: accentMap.color,
        } as React.CSSProperties
      }
    >
      <div className="stat-card-head">
        {icon && <div className="ico">{icon}</div>}
        <div className="stat-label">{label}</div>
        {trend && <div className={`stat-trend ${trend.kind}`}>{trend.text}</div>}
      </div>
      <div className="stat-value">{value}</div>
      {foot && <div className="stat-foot">{foot}</div>}
    </div>
  );
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="progress">
      <div className="progress-bar" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  desc,
  hint,
  action,
}: {
  icon: ReactNode;
  title: ReactNode;
  desc?: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="ico">{icon}</div>
      <div className="title">{title}</div>
      {desc && <div className="desc">{desc}</div>}
      {hint && <div className="hint">{hint}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function Hero({
  greeting,
  title,
  subtitle,
  actions,
  stats,
}: {
  greeting?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  stats?: Array<{ v: ReactNode; l: string }>;
}) {
  return (
    <section className="hero">
      <div className="hero-content">
        {greeting && <div className="hero-greeting">{greeting}</div>}
        <h2 className="hero-title">{title}</h2>
        {subtitle && <div className="hero-sub">{subtitle}</div>}
        {stats && (
          <div className="hero-stats">
            {stats.map((s, i) => (
              <div key={i} className="hero-stat">
                <div className="v">{s.v}</div>
                <div className="l">{s.l}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {actions && <div className="hero-actions">{actions}</div>}
    </section>
  );
}
