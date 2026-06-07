// Toolbar — 卡片内/页面顶部的副标题行
// 用途：标题 + 过滤/排序控件、分页摘要、操作按钮
// 变体：plain | bordered（卡片内用 bordered，跟卡片内容区分）

import { type ReactNode } from "react";
import "./Toolbar.css";

interface ToolbarProps {
  /** 主标题（左侧） */
  title?: ReactNode;
  /** 标题下的小说明（可选，dim） */
  hint?: ReactNode;
  /** 标题旁的"eyebrow"小标签（可选，dim + small caps） */
  eyebrow?: ReactNode;
  /** 右侧操作区（按钮 / select / pager 等） */
  actions?: ReactNode;
  /** 中间柔性内容（如筛选 chips） */
  children?: ReactNode;
  /** 是否在卡片内 — 卡片内带底部边框与卡片标题区分 */
  bordered?: boolean;
}

export function Toolbar({
  title,
  hint,
  eyebrow,
  actions,
  children,
  bordered = false,
}: ToolbarProps) {
  return (
    <div className={`toolbar ${bordered ? "bordered" : ""}`}>
      <div className="tb-head">
        {eyebrow && <div className="tb-eyebrow">{eyebrow}</div>}
        <div className="tb-title-row">
          {title && <div className="tb-title">{title}</div>}
          {hint && <div className="tb-hint">{hint}</div>}
        </div>
        {actions && <div className="tb-actions">{actions}</div>}
      </div>
      {children && <div className="tb-extra">{children}</div>}
    </div>
  );
}

/** 卡片内的章节列表/表头样式：左边竖条 + 标题 + 计数/副标 + 操作 */
export function SectionTitle({
  title,
  count,
  hint,
  actions,
}: {
  title: ReactNode;
  count?: ReactNode;
  hint?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="section-title">
      <span className="bar" aria-hidden="true" />
      <span className="label">{title}</span>
      {count != null && <span className="count">{count}</span>}
      {hint != null && <span className="hint">{hint}</span>}
      {actions && <span className="actions">{actions}</span>}
    </div>
  );
}
