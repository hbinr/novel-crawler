// ImportLocalModal — 一键导入本地目录/文件
// 设计意图：用户已经有一堆 .md 文件想入库时，比"新建"少填两个字段
// 流程：选路径 → 自动检测类型 → 自动取名 → 创建书源 + 抓章节
//
// 关键 UX：
//  - 选完路径立刻 stat，给出"目录 / 文件"提示和章节数预估
//  - 名字从 basename 自动填，可改
//  - 输出目录自动拼好（基于 settings.defaultOutputRoot）
//  - 一次性把 create + refresh-index 串起来，结果弹 toast
import { useCallback, useEffect, useState } from "react";
import { api, type FsStat } from "../lib/api.ts";
import { Modal } from "./Modal.tsx";
import { Button } from "./Button.tsx";
import { Field, Input } from "./Input.tsx";
import { FileBrowser } from "./FileBrowser.tsx";
import { useToast } from "./Toast.tsx";
import { IconFile, IconFolder, IconRefresh } from "./Icons.tsx";
import "./ImportLocalModal.css";

/** 取 path 最后一段 — 简单实现，跨平台够用 */
function basename(p: string): string {
  if (!p) return "";
  const s = p.replace(/\/+$/, "");
  const i = s.lastIndexOf("/");
  return i < 0 ? s : s.slice(i + 1);
}

type Phase = "idle" | "creating" | "indexing" | "done" | "error";

interface ImportResult {
  bookId: number;
  total: number;
  path: string;
}

export function ImportLocalModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [stat, setStat] = useState<FsStat | null>(null);
  const [statLoading, setStatLoading] = useState(false);
  const [statErr, setStatErr] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const toast = useToast();

  // 重置
  useEffect(() => {
    if (!open) {
      setPath("");
      setName("");
      setOutputDir("");
      setStat(null);
      setStatErr(null);
      setPhase("idle");
      setResult(null);
    } else {
      // 拉默认输出根
      api.getSettings().then((s) => setOutputDir(s.defaultOutputRoot)).catch(() => {});
    }
  }, [open]);

  // 选完路径：stat + 自动填名字
  useEffect(() => {
    if (!open || !path) return;
    let alive = true;
    setStatLoading(true);
    setStatErr(null);
    setStat(null);
    api
      .fsStat(path)
      .then((s) => {
        if (!alive) return;
        setStat(s);
        // 自动填名字（用 basename，去扩展名）
        if (!name) {
          const base = basename(path);
          const dot = base.lastIndexOf(".");
          const stem = s.isFile && dot > 0 ? base.slice(0, dot) : base;
          setName(stem);
        }
      })
      .catch((e) => {
        if (!alive) return;
        setStatErr((e as Error).message);
      })
      .finally(() => {
        if (alive) setStatLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, open]);

  // 输出目录：用户没改过时，根据 name 自动拼
  const [outputDirTouched, setOutputDirTouched] = useState(false);
  useEffect(() => {
    if (!open) return;
    setOutputDirTouched(false);
  }, [open, path]);
  useEffect(() => {
    if (!open || !name || outputDirTouched) return;
    // 自动拼：取 defaultOutputRoot + 清理过的 name
    api
      .getSettings()
      .then((s) => {
        const safe = name.trim().replace(/[^\w一-鿿\-]+/g, "-");
        setOutputDir(`${s.defaultOutputRoot}/${safe}`);
      })
      .catch(() => {});
  }, [name, open, outputDirTouched]);

  const onPickPath = useCallback((p: string) => {
    setPath(p);
    setName(""); // 重置名字，让 useEffect 重新算
    setPickerOpen(false);
  }, []);

  const submit = useCallback(async () => {
    if (!path) return;
    if (!stat || (!stat.isDir && !stat.isFile)) {
      toast.push({ kind: "error", msg: "请选择有效的目录或文件路径" });
      return;
    }
    if (!name.trim()) {
      toast.push({ kind: "error", msg: "请填写书源名称" });
      return;
    }
    const parser = stat.isDir ? "localdir" : "localfile";
    const outDir = outputDir.trim() || `${name.trim()}-out`;
    setPhase("creating");
    try {
      const book = await api.createBook({
        name: name.trim(),
        bookUrl: path,
        parser,
        outputDir: outDir,
      });
      setPhase("indexing");
      const r = await api.refreshIndex(book.id);
      setResult({ bookId: book.id, total: r.total, path });
      setPhase("done");
      toast.push({
        kind: "success",
        msg: `已导入《${book.name}》，共 ${r.total} 章`,
      });
      onImported();
    } catch (e) {
      setPhase("error");
      toast.push({ kind: "error", msg: (e as Error).message });
    }
  }, [name, onImported, outputDir, path, stat, toast]);

  const busy = phase === "creating" || phase === "indexing";

  return (
    <>
      <Modal
        open={open}
        onClose={busy ? () => {} : onClose}
        title="导入本地书源"
        footer={
          phase === "done" ? (
            <Button variant="primary" onClick={onClose}>
              完成
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose} disabled={busy}>
                取消
              </Button>
              <Button
                variant="primary"
                onClick={submit}
                disabled={!path || !stat || !name.trim() || busy}
                loading={busy}
              >
                {phase === "creating"
                  ? "创建中…"
                  : phase === "indexing"
                    ? "导入中…"
                    : "导入"}
              </Button>
            </>
          )
        }
      >
        <div className="col" style={{ gap: 14 }}>
          {/* 路径 */}
          <Field
            label="选择目录或文件"
            hint="支持 .md / .markdown / .txt；只允许家目录、当前目录、/tmp"
          >
            <div className="row" style={{ gap: 6 }}>
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/Users/.../books/wudong"
                style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPickerOpen(true)}
                disabled={busy}
              >
                <IconFolder size={12} /> 浏览
              </Button>
            </div>
          </Field>

          {/* 自动检测结果 */}
          {statLoading && (
            <div className="imp-hint muted">检测中…</div>
          )}
          {statErr && (
            <div className="imp-hint err">⚠ {statErr}</div>
          )}
          {stat && !statErr && (
            <div className={`imp-hint ${stat.isDir ? "dir" : "file"}`}>
              {stat.isDir ? (
                <>
                  <IconFolder size={14} />
                  <span>
                    检测到<strong>目录</strong>
                    {stat.chapterHint > 0 && (
                      <>，预估 <strong className="num">{stat.chapterHint}</strong> 章</>
                    )}
                    {stat.childCount > 0 && (
                      <span className="muted">（共 {stat.childCount} 个条目）</span>
                    )}
                  </span>
                </>
              ) : (
                <>
                  <IconFile size={14} />
                  <span>
                    检测到<strong>单个文件</strong>（{formatSize(stat.size)}），将作为唯一章节导入
                  </span>
                </>
              )}
            </div>
          )}

          {/* 书源名 */}
          <Field label="书源名称" hint="自动从路径填，可改">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="武动乾坤"
              disabled={busy}
            />
          </Field>

          {/* 输出目录 */}
          <Field
            label="输出目录"
            hint="原文件不动；这里是后续爬取/重新生成的写入位置，不存在会自动建"
          >
            <Input
              value={outputDir}
              onChange={(e) => {
                setOutputDir(e.target.value);
                setOutputDirTouched(true);
              }}
              placeholder="/Users/.../data/books/wudong"
              style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
              disabled={busy}
            />
          </Field>

          {/* 结果区 */}
          {phase === "done" && result && (
            <div className="imp-result">
              <div className="imp-result-head">✓ 导入完成</div>
              <div className="imp-result-body mono">
                <div>
                  <span className="lbl">书源</span>
                  <span>#{result.bookId}</span>
                </div>
                <div>
                  <span className="lbl">章节数</span>
                  <span className="num">{result.total}</span>
                </div>
                <div>
                  <span className="lbl">来源</span>
                  <span className="path">{result.path}</span>
                </div>
              </div>
            </div>
          )}

          {/* 进度区 */}
          {busy && (
            <div className="imp-progress">
              <div className={`step ${phase === "creating" ? "on" : "ok"}`}>
                1. 创建书源
              </div>
              <div className={`step ${phase === "indexing" ? "on" : ""}`}>
                <IconRefresh size={11} /> 2. 登记章节
              </div>
            </div>
          )}
        </div>
      </Modal>

      <FileBrowser
        open={pickerOpen}
        mode="dir"
        initialPath={path}
        onClose={() => setPickerOpen(false)}
        onPick={onPickPath}
      />
    </>
  );
}

function formatSize(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}K`;
  return `${(n / 1024 / 1024).toFixed(1)}M`;
}
