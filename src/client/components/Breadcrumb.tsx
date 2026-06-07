// 面包屑 — 用于 detail / nested 页面
// 用 <a> + <span>，当前项用 aria-current="page"；非当前项用 Link 跳转。

import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconChevronRight } from "./Icons.tsx";
import "./Breadcrumb.css";

export interface BreadcrumbItem {
  /** 显示文本 */
  label: ReactNode;
  /** 跳转路径；不传则视为当前页（不可点） */
  to?: string;
  /** 可选：左侧小图标 */
  icon?: ReactNode;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="breadcrumb" aria-label="面包屑导航">
      <ol>
        {items.map((it, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} className={isLast ? "last" : undefined}>
              {it.to && !isLast ? (
                <Link to={it.to} className="crumb">
                  {it.icon && <span className="crumb-ico">{it.icon}</span>}
                  <span>{it.label}</span>
                </Link>
              ) : (
                <span className="crumb current" aria-current="page">
                  {it.icon && <span className="crumb-ico">{it.icon}</span>}
                  <span>{it.label}</span>
                </span>
              )}
              {!isLast && (
                <span className="sep" aria-hidden="true">
                  <IconChevronRight size={11} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
