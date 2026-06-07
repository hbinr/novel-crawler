// FileBrowser — 目录树选择器
// 用法：<FileBrowser mode="dir"|"file" onPick={(path) => ...} onClose={...} />
//
// 设计要点：
//  - 懒加载：进入目录时 fetch /api/fs/browse?path=...
//  - breadcrumb 路径可点：直接跳转到任意祖先
//  - 模式：dir = 选中目录；file = 选中文件（双击或点"使用此文件"）
//  - 排序：目录靠前、文件靠后
import { useCallback, useEffect, useState } from "react";
import { api, type FsEntry } from "../lib/api.ts";
import { Modal } from "./Modal.tsx";
import { Button } from "./Button.tsx";
import "./FileBrowser.css";

type Mode = "dir" | "file";

export function FileBrowser({
  mode,
  initialPath,
  open,
  onClose,
  onPick,
}: {
  mode: Mode;
  initialPath?: string;
  open: boolean;
  onClose: () => void;
  onPick: (path: string) => void;
}) {
  const [path, setPath] = useState<string>(initialPath ?? "");
  const [parent, setParent] = useState<string | null>(null);
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [roots, setRoots] = useState<{ name: string; path: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 打开时拉根目录 + 初次路径
  useEffect(() => {
    if (!open) return;
    setErr(null);
    api.fsRoots().then((r) => setRoots(r.roots)).catch(() => setRoots([]));
    if (initialPath) {
      setPath(initialPath);
    }
  }, [open, initialPath]);

  const navigate = useCallback(
    async (p: string) => {
      setLoading(true);
      setErr(null);
      try {
        const r = await api.fsBrowse(p);
        setPath(r.path);
        setParent(r.parent);
        // 根据 mode 过滤：dir 模式隐藏文件，file 模式隐藏目录
        setEntries(
          mode === "dir" ? r.entries.filter((e) => e.isDir) : r.entries,
        );
      } catch (e) {
        setErr((e as Error).message);
        setEntries([]);
      } finally {
        setLoading(false);
      }
    },
    [mode],
  );

  // path 变化时拉取
  useEffect(() => {
    if (!open) return;
    if (!path) return;
    void navigate(path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, open]);

  // 手动输入路径跳转
  const [pathInput, setPathInput] = useState("");
  useEffect(() => {
    setPathInput(path);
  }, [path]);

  const onSubmitPath = (e: React.FormEvent) => {
    e.preventDefault();
    if (pathInput.trim()) setPath(pathInput.trim());
  };

  // breadcrumb segments
  const segments = path.split("/").filter(Boolean);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "dir" ? "选择目录" : "选择文件"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button
            variant="primary"
            disabled={!path}
            onClick={() => path && onPick(path)}
          >
            {mode === "dir" ? `使用此目录` : `使用此文件`}
          </Button>
        </>
      }
    >
      {/* 路径输入 */}
      <form className="fb-path" onSubmit={onSubmitPath}>
        <span className="lbl">路径</span>
        <input
          className="input"
          value={pathInput}
          onChange={(e) => setPathInput(e.target.value)}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          placeholder="/Users/.../books"
        />
        <Button type="submit" size="sm" variant="ghost">跳转</Button>
      </form>

      {/* breadcrumb */}
      <div className="fb-crumb">
        <button
          className="seg"
          onClick={() => roots[0] && setPath(roots[0].path)}
          title="根目录"
        >
          /
        </button>
        {segments.map((seg, i) => {
          const p = "/" + segments.slice(0, i + 1).join("/");
          return (
            <span key={p} className="seg-wrap">
              <span className="sep">/</span>
              <button className="seg" onClick={() => setPath(p)}>
                {seg}
              </button>
            </span>
          );
        })}
      </div>

      {/* 根快捷 */}
      {roots.length > 0 && (
        <div className="fb-roots">
          {roots.map((r) => (
            <button
              key={r.path}
              className="root-chip"
              onClick={() => setPath(r.path)}
              title={r.path}
            >
              {r.name}
            </button>
          ))}
          {parent && (
            <button className="root-chip" onClick={() => setPath(parent)}>
              ..
            </button>
          )}
        </div>
      )}

      {/* 列表 */}
      <div className="fb-list">
        {loading ? (
          <div className="fb-empty">加载中…</div>
        ) : err ? (
          <div className="fb-empty err">{err}</div>
        ) : entries.length === 0 ? (
          <div className="fb-empty">
            {mode === "dir" ? "空目录" : "没有文件"}
          </div>
        ) : (
          entries.map((e) => (
            <div
              key={e.path}
              className={`fb-row ${e.isDir ? "dir" : "file"}`}
              onDoubleClick={() => {
                if (e.isDir) setPath(e.path);
                else if (mode === "file") onPick(e.path);
              }}
              onClick={() => {
                if (e.isDir) setPath(e.path);
              }}
              title={e.path}
            >
              <span className="ico">{e.isDir ? "▸" : "·"}</span>
              <span className="name">{e.name}</span>
              {e.isFile && e.size > 0 && (
                <span className="size">{fmtSize(e.size)}</span>
              )}
            </div>
          ))
        )}
      </div>

      {/* 选中态 */}
      <div className="fb-current">
        <span className="lbl">已选</span>
        <span className="val mono">{path || "—"}</span>
      </div>
    </Modal>
  );
}

function fmtSize(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}K`;
  return `${(n / 1024 / 1024).toFixed(1)}M`;
}
