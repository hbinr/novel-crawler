// Theme: "light" | "dark" | "system"
// - 用户的偏好（choice）存到 localStorage
// - "system" 跟随 prefers-color-scheme，并监听变化
// - 实际生效的（resolved）会写到 <html data-theme="...">，由 tokens.css 消费
//
// 防 FOUC：index.html <head> 里的 inline init script 会同步设置 data-theme；
// 本 hook 主要负责在 React 挂载后保持偏好与系统变化同步，并暴露 setter 给 switcher。

import { useCallback, useEffect, useMemo, useState } from "react";

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "theme";
const DEFAULT_CHOICE: ThemeChoice = "dark";

function readStoredChoice(): ThemeChoice {
  if (typeof window === "undefined") return DEFAULT_CHOICE;
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === "light" || v === "dark" || v === "system") return v;
  return DEFAULT_CHOICE;
}

function systemPref(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function resolve(choice: ThemeChoice): ResolvedTheme {
  return choice === "system" ? systemPref() : choice;
}

function applyToDocument(t: ResolvedTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", t);
}

function writeStorage(c: ThemeChoice) {
  try {
    window.localStorage.setItem(STORAGE_KEY, c);
  } catch {
    /* localStorage 满 / 隐私模式 — 静默失败 */
  }
}

interface ThemeApi {
  /** 用户选择（"system" 尚未解析） */
  choice: ThemeChoice;
  /** 实际生效的主题 */
  resolved: ResolvedTheme;
  setChoice: (c: ThemeChoice) => void;
  /** 切到另一种 resolved（light ↔ dark），并写入存储；常用于顶栏快捷按钮 */
  toggle: () => void;
}

export function useTheme(): ThemeApi {
  // 从 DOM 读 init script 已设置的 data-theme 作为初始值，避免 hydration 闪烁
  const [choice, setChoiceState] = useState<ThemeChoice>(() => {
    if (typeof document === "undefined") return DEFAULT_CHOICE;
    const initial = document.documentElement.getAttribute("data-theme");
    // init script 一定写了 "light" 或 "dark"，但读不到 storage 时它是 "dark"
    // 通过 storage 区分 "system" 和显式 "dark"
    const stored = readStoredChoice();
    if (stored === "system" && (initial === "light" || initial === "dark")) {
      return "system";
    }
    if (initial === "light") return "light";
    return "dark";
  });

  const [resolved, setResolved] = useState<ResolvedTheme>(() => {
    if (typeof document === "undefined") return "dark";
    return (document.documentElement.getAttribute("data-theme") as ResolvedTheme) || "dark";
  });

  // 同步 choice → resolved + DOM + storage
  const setChoice = useCallback((c: ThemeChoice) => {
    setChoiceState(c);
    const r = resolve(c);
    setResolved(r);
    applyToDocument(r);
    writeStorage(c);
  }, []);

  // 顶栏快速切换：light ↔ dark
  const toggle = useCallback(() => {
    setChoice(resolved === "dark" ? "light" : "dark");
  }, [resolved, setChoice]);

  // 监听系统偏好变化（仅在 "system" 时影响实际显示）
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      if (choice === "system") {
        const r: ResolvedTheme = mq.matches ? "light" : "dark";
        setResolved(r);
        applyToDocument(r);
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  // 跨标签页同步
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const c = readStoredChoice();
      setChoiceState(c);
      const r = resolve(c);
      setResolved(r);
      applyToDocument(r);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return useMemo(
    () => ({ choice, resolved, setChoice, toggle }),
    [choice, resolved, setChoice, toggle],
  );
}
