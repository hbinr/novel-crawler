// 主题切换器 — 顶栏放置
// 单击按钮在 light/dark 间快切；点击小箭头打开菜单可切到"跟随系统"。
// 不直接渲染 settings 页面里的所有偏好，只暴露最常用的三态。

import { useCallback, useEffect, useRef, useState } from "react";
import { IconCheck, IconChevronDown, IconMonitor, IconMoon, IconSun } from "./Icons.tsx";
import { t } from "../lib/i18n.ts";
import { useTheme, type ThemeChoice } from "../lib/useTheme.ts";
import "./ThemeSwitcher.css";

const OPTIONS: Array<{ value: ThemeChoice; label: string; Icon: typeof IconSun }> = [
  { value: "light", label: t.theme.light, Icon: IconSun },
  { value: "dark", label: t.theme.dark, Icon: IconMoon },
  { value: "system", label: t.theme.system, Icon: IconMonitor },
];

export function ThemeSwitcher() {
  const { choice, resolved, setChoice, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleMainClick = useCallback(() => {
    // 主按钮单击 = 在 light/dark 间切换
    toggle();
  }, [toggle]);

  const handleArrowClick = useCallback(() => {
    setOpen((v) => !v);
  }, []);

  const handlePick = useCallback(
    (c: ThemeChoice) => {
      setChoice(c);
      setOpen(false);
    },
    [setChoice],
  );

  // 当前 resolved 决定主按钮显示的图标
  const ResolvedIcon = resolved === "light" ? IconSun : IconMoon;

  return (
    <div ref={wrapRef} className="theme-switcher">
      <button
        type="button"
        className="ts-main"
        onClick={handleMainClick}
        aria-label={t.theme.toggleLabel}
        title={`${t.theme.label}: ${t.theme[resolved === "light" ? "light" : "dark"]}（点击切换）`}
      >
        <ResolvedIcon size={15} />
      </button>
      <button
        type="button"
        className="ts-arrow"
        onClick={handleArrowClick}
        aria-label={`${t.theme.label} 选项`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${t.theme.label} 选项`}
      >
        <IconChevronDown size={11} />
      </button>
      {open && (
        <div className="ts-menu" role="menu">
          {OPTIONS.map(({ value, label, Icon }) => {
            const isCurrent = choice === value;
            // system 模式下，"system" 标为当前；如果 resolved 跟某项一致，也高亮它
            const isResolved = resolved === value;
            return (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={isCurrent}
                className={`ts-item ${isCurrent ? "current" : ""}`}
                onClick={() => handlePick(value)}
              >
                <span className="ts-ico">
                  <Icon size={14} />
                </span>
                <span className="ts-label">{label}</span>
                <span className="ts-mark">
                  {isCurrent ? <IconCheck size={13} /> : isResolved ? <span className="ts-dot" /> : null}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
