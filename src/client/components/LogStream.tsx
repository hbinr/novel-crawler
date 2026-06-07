// 实时日志流组件 — 订阅 WS 推送，自动滚到底，新行高亮 1.5s
// 优化点：
//  - fresh 集合用 useState<Set> 而非 ref+额外 tick state（rerender-derived-state-no-effect）
//  - 行追加用函数式 setState，避免读到旧 lines（rerender-functional-setstate）
//  - 滚动用 useCallback 稳定句柄 + passive 监听（client-passive-event-listeners）
//  - ws 回调用 functional 更新闭包（rerender-functional-setstate）
import { useCallback, useEffect, useRef, useState } from "react";
import type { LogLine } from "@shared/types.ts";
import { fmtTime } from "../lib/format.ts";
import { t } from "../lib/i18n.ts";
import { ws } from "../lib/ws.ts";
import "./LogStream.css";

const MAX_LINES = 2000;
const TRIM_TO = 1500;
const FRESH_MS = 1500;

const LEVEL_LABEL: Record<LogLine["level"], string> = {
  info: t.logLevel.info,
  warn: t.logLevel.warn,
  error: t.logLevel.error,
  debug: t.logLevel.debug,
};

export function LogStream({ initial = [] }: { initial?: LogLine[] }) {
  const [lines, setLines] = useState<LogLine[]>(initial);
  // fresh 状态：仅用于驱动 .fresh class 的添加/移除（CSS 自己处理 1.5s 动画）
  const [freshIds, setFreshIds] = useState<ReadonlySet<number>>(() => new Set());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    ws.connect();
    const off = ws.onLog((line) => {
      setLines((prev) =>
        prev.length >= MAX_LINES ? [...prev.slice(prev.length - TRIM_TO), line] : [...prev, line],
      );
      setFreshIds((prev) => {
        if (prev.has(line.id)) return prev;
        const next = new Set(prev);
        next.add(line.id);
        return next;
      });
      setTimeout(() => {
        setFreshIds((prev) => {
          if (!prev.has(line.id)) return prev;
          const next = new Set(prev);
          next.delete(line.id);
          return next;
        });
      }, FRESH_MS);
    });
    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    if (stickToBottom.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  // passive scroll — 我们从不 preventDefault，可以安全 passive
  // React 的 onScroll 在 scroll 容器上是 passive，但 useEffect 注册到容器更显式
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
  }, []);

  return (
    <div className="log-stream" ref={containerRef} onScroll={handleScroll}>
      {lines.length === 0 ? (
        <div className="log-empty">暂无日志</div>
      ) : (
        lines.map((l) => (
          <div key={l.id} className={`log-line ${freshIds.has(l.id) ? "fresh" : ""}`}>
            <span className="ts">{fmtTime(l.ts)}</span>
            <span className={`lvl lvl-${l.level}`}>{LEVEL_LABEL[l.level]}</span>
            <span className="msg">{l.msg}</span>
          </div>
        ))
      )}
    </div>
  );
}
