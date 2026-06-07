import { memo, type ReactNode } from "react";
import "./Table.css";

export interface Column<T> {
  key: string;
  header: ReactNode;
  width?: string;
  align?: "left" | "right";
  mono?: boolean;
  render: (row: T, i: number) => ReactNode;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, i: number) => string | number;
  rowClassName?: (row: T) => string | undefined;
  emptyText?: string;
  /** empty 状态时显示在文字上方的图标节点 */
  emptyIcon?: ReactNode;
  /** empty 状态主标题（默认 emptyText） */
  emptyTitle?: ReactNode;
  /** empty 状态次要说明 */
  emptyHint?: ReactNode;
  onRowClick?: (row: T) => void;
}

// 优化：用 React.memo 包装表格 — 当父组件 re-render 但 rows/columns 引用未变时跳过整张表的 diff。
// 行级点击 handler 在父组件用 useCallback 后才稳定；这里内联 onClick 会因每次 render 新建闭包，
// 但点击 handler 只在用户点击时调用，开销可忽略。
function DataTableImpl<T>({
  columns,
  rows,
  rowKey,
  rowClassName,
  emptyText = "暂无数据",
  emptyIcon,
  emptyTitle,
  emptyHint,
  onRowClick,
}: Props<T>) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={c.width ? { width: c.width } : undefined}
                className={c.align === "right" ? "right" : undefined}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="data-table-empty" colSpan={columns.length}>
                {emptyIcon && <div className="ico">{emptyIcon}</div>}
                {emptyTitle ? (
                  <>
                    <div style={{ color: "var(--text-hi)", fontWeight: 500, marginBottom: 4 }}>
                      {emptyTitle}
                    </div>
                    {emptyHint && <div style={{ fontSize: 12 }}>{emptyHint}</div>}
                  </>
                ) : (
                  emptyText
                )}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr
                key={rowKey(r, i)}
                className={rowClassName ? rowClassName(r) : undefined}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                style={onRowClick ? { cursor: "pointer" } : undefined}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={[
                      c.align === "right" || c.mono ? "num" : "",
                      c.align === "right" ? "right" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {c.render(r, i)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// 默认 shallow compare 即可：rows / columns 引用变化时重渲染，rowKey/emptyText 是函数/字符串（浅比较 ok）
export const DataTable = memo(DataTableImpl) as typeof DataTableImpl;
