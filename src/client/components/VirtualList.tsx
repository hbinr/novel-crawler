// 虚拟列表 — 手动实现，零依赖
// 解决 1000+ 行章节列表的渲染性能
//
// 原理：固定行高 + 容器内 absolute 定位
//  - container: overflow:auto, height 固定
//  - inner spacer: height = totalCount * rowHeight （撑出可滚动条）
//  - 仅渲染视口内 ± buffer 的行
//
// 为什么不引入 react-window：
//  - 一次性 1000 行的需求，固定行高手动实现 ~50 行就够
//  - 不增加 deps，类型与项目一致
//
// 性能要点：
//  - 用 ResizeObserver 跟踪容器尺寸变化（自适应）
//  - 用 rAF 节流 scroll 事件（避免一帧内多次 setState）
//  - 行渲染不 memo 化（每行 cell 是简单 span，React 重渲染 cost 极低；
//    memo 化每个 cell 的回调比较反而更贵）
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export interface VirtualListProps<T> {
  items: T[];
  rowKey: (item: T, i: number) => string | number;
  rowHeight: number;
  /** 容器高度；可被外部 CSS 覆盖，留空时由父容器决定 */
  height?: number | string;
  /** 视口外上下各预渲染的行数（避免快速滚动出现空白） */
  overscan?: number;
  renderRow: (item: T, i: number) => ReactNode;
  /** 列表底部"加载更多"占位，触发 loadMore 时显示 */
  footer?: ReactNode;
  className?: string;
  /** 外部 ref 暴露给父组件（用于 scroll-to） */
  innerRef?: React.MutableRefObject<HTMLDivElement | null>;
  /** 数据更新时是否保持当前滚动位置（默认 true） */
  preserveScroll?: boolean;
}

export function VirtualList<T>({
  items,
  rowKey,
  rowHeight,
  height = "100%",
  overscan = 6,
  renderRow,
  footer,
  className,
  innerRef,
  preserveScroll = true,
}: VirtualListProps<T>) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(0);
  const lastItemsLenRef = useRef(items.length);
  const lastScrollTopRef = useRef(0);

  // 暴露给父组件
  useEffect(() => {
    if (innerRef) innerRef.current = scrollerRef.current;
  });

  // 跟踪容器尺寸 — 用 ResizeObserver 替代 window resize
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setViewportH(el.clientHeight);
    });
    ro.observe(el);
    setViewportH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  // 数据变长时保持滚动位置（避免新增页后被弹回顶部）
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (lastItemsLenRef.current !== items.length && preserveScroll) {
      const before = lastItemsLenRef.current;
      const after = items.length;
      if (after > before) {
        const newRows = after - before;
        el.scrollTop = lastScrollTopRef.current + newRows * rowHeight;
      }
    }
    lastItemsLenRef.current = items.length;
  }, [items.length, rowHeight, preserveScroll]);

  // scroll 节流到 rAF
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      lastScrollTopRef.current = el.scrollTop;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setScrollTop(el.scrollTop);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const total = items.length;
  const vh = viewportH || 600; // SSR / 首次渲染兜底
  const startIdx = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIdx = Math.min(total, Math.ceil((scrollTop + vh) / rowHeight) + overscan);
  const visible = items.slice(startIdx, endIdx);

  return (
    <div
      ref={scrollerRef}
      className={`virtual-list ${className ?? ""}`}
      style={{
        position: "relative",
        overflow: "auto",
        height,
        contain: "strict",
      }}
    >
      <div
        style={{
          height: total * rowHeight,
          position: "relative",
        }}
      >
        {visible.map((item, j) => {
          const i = startIdx + j;
          return (
            <div
              key={rowKey(item, i)}
              style={{
                position: "absolute",
                top: i * rowHeight,
                left: 0,
                right: 0,
                height: rowHeight,
              }}
            >
              {renderRow(item, i)}
            </div>
          );
        })}
      </div>
      {footer && (
        <div
          style={{
            position: "absolute",
            top: total * rowHeight,
            left: 0,
            right: 0,
            padding: "12px 0",
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
