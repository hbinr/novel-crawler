import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api.ts";
import { EmptyState, PageHeader } from "../components/AppShell.tsx";
import { Button } from "../components/Button.tsx";
import { Field, Select } from "../components/Input.tsx";
import { VirtualList } from "../components/VirtualList.tsx";
import { useToast } from "../components/Toast.tsx";
import { Breadcrumb } from "../components/Breadcrumb.tsx";
import {
  IconBook,
  IconChevronLeft,
  IconChevronRight,
  IconEmpty,
  IconEye,
  IconPlus,
  IconRefresh,
} from "../components/Icons.tsx";
import type { Book, Chapter } from "@shared/types.ts";
import "../styles/reader.css";
import "../components/VirtualList.css";

type ColorScheme = "paper" | "sepia" | "green" | "gray" | "dark";
type FontFamily = "song" | "hei" | "kai" | "mono";

interface ColorPreset {
  id: ColorScheme;
  label: string;
  bg: string;
  fg: string;
  border: string;
}
const COLORS: ColorPreset[] = [
  { id: "paper", label: "羊皮纸", bg: "#f7f5ee", fg: "#2a2620", border: "rgba(0, 0, 0, 0.08)" },
  { id: "sepia", label: "护眼", bg: "#e8e0cc", fg: "#3d362c", border: "rgba(0, 0, 0, 0.1)" },
  { id: "green", label: "豆绿", bg: "#cce8cf", fg: "#1f2a1f", border: "rgba(0, 0, 0, 0.1)" },
  { id: "gray", label: "米灰", bg: "#dad6cf", fg: "#2c2a26", border: "rgba(0, 0, 0, 0.1)" },
  { id: "dark", label: "暗夜", bg: "#1a1c22", fg: "#d6d3cc", border: "rgba(255, 255, 255, 0.08)" },
];

const FONT_FAMILY: Record<FontFamily, string> = {
  song: '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", "SimSun", serif',
  hei: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  kai: '"Kaiti SC", "STKaiti", "KaiTi", serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
};

interface ReaderSettings {
  color: ColorScheme;
  fontSize: number; // 14–28
  lineHeight: number; // 0.5–2.5，乘 10px 作为行间像素距
  font: FontFamily;
  width: number; // 600–1400
}

const SETTINGS_KEY = "preview.reader.settings";
const LAST_BOOK_KEY = "preview.lastBookId";
const LAST_CHAPTER_KEY = "preview.lastChapterId";

const DEFAULT_SETTINGS: ReaderSettings = {
  color: "sepia",
  fontSize: 18,
  lineHeight: 1.5,
  font: "song",
  width: 1500,
};

function loadSettings(): ReaderSettings {
  if (typeof localStorage === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const saved = JSON.parse(raw);
    // 老版本 lineHeight 是 fontSize 倍数（1.4–2.4），新版本是 10px 倍数（0.5–3.0）
    // 检测到旧值则丢掉，沿用新默认
    if (typeof saved.lineHeight === "number" && (saved.lineHeight >= 1.4 || saved.lineHeight < 1.5)) {
      delete saved.lineHeight;
    }
    // 老版本 width 默认 1000/1100/1300，新版本 1500 — 旧值偏窄，升级时直接给新默认
    if (typeof saved.width === "number" && saved.width < 1500) {
      delete saved.width;
    }
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function Preview() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState<number | null>(() => {
    // 优先级：URL ?bookId= > localStorage
    const fromUrl = searchParams.get("bookId");
    if (fromUrl) {
      const n = parseInt(fromUrl, 10);
      if (Number.isFinite(n)) return n;
    }
    const v = localStorage.getItem(LAST_BOOK_KEY);
    return v ? parseInt(v, 10) : null;
  });
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapterId, setChapterId] = useState<number | null>(() => {
    const v = localStorage.getItem(LAST_CHAPTER_KEY);
    return v ? parseInt(v, 10) : null;
  });
  const [content, setContent] = useState<string>("");
  const [loadingContent, setLoadingContent] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [settings, setSettings] = useState<ReaderSettings>(loadSettings);
  const toast = useToast();
  const readerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    api.listBooks().then((bs) => {
      setBooks(bs);
      if (!bookId && bs.length > 0) selectBook(bs[0]!.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切换书源：同步到 URL（便于深链 / 分享）+ localStorage
  const selectBook = useCallback(
    (id: number) => {
      setBookId(id);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("bookId", String(id));
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (bookId) localStorage.setItem(LAST_BOOK_KEY, String(bookId));
  }, [bookId]);
  useEffect(() => {
    if (chapterId) localStorage.setItem(LAST_CHAPTER_KEY, String(chapterId));
  }, [chapterId]);

  // 切换 bookId：拉第一页 + 自动选章
  useEffect(() => {
    if (!bookId) return;
    setChapters([]);
    setHasMore(true);
    api
      .listChapters(bookId, { limit: 200, offset: 0, includeCount: true })
      .then((page) => {
        setChapters(page.items);
        if (page.total != null) setHasMore(page.items.length < page.total);
        else setHasMore(page.items.length === 200);
        if (page.items.length > 0 && !page.items.find((c) => c.id === chapterId)) {
          const first = page.items.find((c) => c.status === "done" || c.status === "skipped") ?? page.items[0]!;
          setChapterId(first.id);
        }
      })
      .catch((e) => toast.push({ kind: "error", msg: (e as Error).message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  // 加载下一页（"已下载"标签下还有内容时）
  const loadMore = useCallback(() => {
    if (!bookId || !hasMore || loadingMore) return;
    setLoadingMore(true);
    api
      .listChapters(bookId, { limit: 200, offset: chapters.length })
      .then((page) => {
        setChapters((prev) => [...prev, ...page.items]);
        if (page.items.length < 200) setHasMore(false);
      })
      .catch((e) => toast.push({ kind: "error", msg: (e as Error).message }))
      .finally(() => setLoadingMore(false));
  }, [bookId, chapters.length, hasMore, loadingMore, toast]);

  // 切换章节时，确保在列表里
  useEffect(() => {
    if (!chapterId) return;
    const idx = chapters.findIndex((c) => c.id === chapterId);
    if (idx < 0) return;
    const el = listRef.current;
    if (!el) return;
    const rowH = 34;
    const top = idx * rowH;
    const bottom = top + rowH;
    if (top < el.scrollTop || bottom > el.scrollTop + el.clientHeight) {
      el.scrollTop = Math.max(0, top - el.clientHeight / 2 + rowH);
    }
  }, [chapterId, chapters]);

  useEffect(() => {
    if (!chapterId) {
      setContent("");
      return;
    }
    setLoadingContent(true);
    api
      .chapterContent(chapterId)
      .then((r) => setContent(r.content))
      .catch((e) => {
        setContent("");
        toast.push({ kind: "error", msg: `加载失败：${(e as Error).message}` });
      })
      .finally(() => setLoadingContent(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSetting = useCallback(
    <K extends keyof ReaderSettings>(k: K, v: ReaderSettings[K]) => {
      setSettings((s) => ({ ...s, [k]: v }));
    },
    [],
  );

  const currentBook = useMemo(() => books.find((b) => b.id === bookId) ?? null, [books, bookId]);
  const currentChapter = useMemo(
    () => chapters.find((c) => c.id === chapterId) ?? null,
    [chapters, chapterId],
  );
  const currentIdx = useMemo(
    () => chapters.findIndex((c) => c.id === chapterId),
    [chapters, chapterId],
  );

  const goPrev = useCallback(() => {
    if (currentIdx > 0) setChapterId(chapters[currentIdx - 1]!.id);
  }, [currentIdx, chapters]);
  const goNext = useCallback(() => {
    if (currentIdx >= 0 && currentIdx < chapters.length - 1)
      setChapterId(chapters[currentIdx + 1]!.id);
  }, [currentIdx, chapters]);

  // 键盘左右切换章节
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      // 忽略在 input/textarea 中的按键
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") return;
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [goPrev, goNext]);

  const currentColor = COLORS.find((c) => c.id === settings.color) ?? COLORS[1]!;
  const readerStyle = {
    ["--reader-bg" as string]: currentColor.bg,
    ["--reader-fg" as string]: currentColor.fg,
    ["--reader-border" as string]: currentColor.border,
    ["--reader-size" as string]: `${settings.fontSize}px`,
    ["--reader-lh" as string]: String(settings.lineHeight),
  } as React.CSSProperties;

  const readerFontStyle = { fontFamily: FONT_FAMILY[settings.font] } as React.CSSProperties;

  if (books.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow="预览"
          title="阅读预览"
          subtitle="选择一个书源后即可预览章节内容"
          icon={<IconEye size={18} />}
          breadcrumb={
            <Breadcrumb
              items={[
                { label: "资源" },
                { label: "阅读预览", icon: <IconEye size={11} /> },
              ]}
            />
          }
        />
        <EmptyState
          icon={<IconBook size={28} />}
          title="还没有任何书源"
          desc="先到「书源」页面添加一个，再回到这里预览抓取的章节"
          action={
            <a href="/books" style={{ textDecoration: "none" }}>
              <Button variant="primary">
                <IconPlus size={12} /> 去新建书源
              </Button>
            </a>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="预览"
        title={currentBook ? currentBook.name : "阅读预览"}
        subtitle={currentBook ? "选择左侧章节开始阅读" : "选择一个书源"}
        icon={<IconEye size={18} />}
        breadcrumb={
          <Breadcrumb
            items={[
              { label: "资源" },
              { label: "阅读预览", icon: <IconEye size={11} /> },
            ]}
          />
        }
      />
      <div className="preview-page">
        <aside className="preview-sidebar">
          <div className="preview-book-picker">
            <label>书源</label>
            <Select
              value={bookId ?? ""}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                selectBook(v);
                setChapterId(null);
              }}
            >
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="preview-chapter-list">
            {chapters.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-lo)", fontSize: 12 }}>
                暂无章节
              </div>
            ) : (
              <VirtualList<Chapter>
                items={chapters}
                rowKey={(c) => c.id}
                rowHeight={34}
                height="100%"
                innerRef={listRef}
                renderRow={(c) => (
                  <div
                    className={`preview-chapter-row ${c.id === chapterId ? "active" : ""}`}
                    onClick={() => setChapterId(c.id)}
                  >
                    <span className="idx">{String(c.idx).padStart(4, "0")}</span>
                    <span className="title">{c.title}</span>
                    <span className={`status-dot ${c.status}`} title={c.status} />
                  </div>
                )}
                footer={
                  hasMore ? (
                    <div
                      style={{
                        textAlign: "center",
                        color: "var(--text-lo)",
                        fontSize: 11,
                        cursor: "pointer",
                        padding: "8px 0",
                      }}
                      onClick={loadMore}
                    >
                      {loadingMore ? "加载中…" : `加载更多 (${chapters.length})`}
                    </div>
                  ) : null
                }
              />
            )}
          </div>
        </aside>

        <main className="preview-main">
          <div className="preview-toolbar">
            <div className="group" title="字号">
              <button
                onClick={() => updateSetting("fontSize", Math.max(14, settings.fontSize - 1))}
                aria-label="缩小"
              >
                A−
              </button>
              <span className="v">{settings.fontSize}</span>
              <button
                onClick={() => updateSetting("fontSize", Math.min(28, settings.fontSize + 1))}
                aria-label="放大"
              >
                A+
              </button>
            </div>
            <div className="group" title="行距 (×10px)">
              <button
                onClick={() =>
                  updateSetting("lineHeight", Math.max(0.5, +(settings.lineHeight - 0.1).toFixed(2)))
                }
                aria-label="紧凑"
              >
                −
              </button>
              <span className="v">{settings.lineHeight.toFixed(1)}</span>
              <button
                onClick={() =>
                  updateSetting("lineHeight", Math.min(3.0, +(settings.lineHeight + 0.1).toFixed(2)))
                }
                aria-label="宽松"
              >
                +
              </button>
            </div>
            <div className="group" title="字体">
              <button onClick={() => updateSetting("font", "song")} aria-label="宋体">宋</button>
              <button onClick={() => updateSetting("font", "hei")} aria-label="黑体">黑</button>
              <button onClick={() => updateSetting("font", "kai")} aria-label="楷体">楷</button>
            </div>
            <div className="color-picker" title="护眼色">
              {COLORS.map((c) => (
                <div
                  key={c.id}
                  className={`swatch ${settings.color === c.id ? "active" : ""}`}
                  style={{ background: c.bg, borderColor: c.border }}
                  onClick={() => updateSetting("color", c.id)}
                  title={c.label}
                />
              ))}
            </div>
            <div className="spacer" />
            <Button
              size="sm"
              variant="ghost"
              onClick={goPrev}
              disabled={currentIdx <= 0}
              title="上一章 (←)"
            >
              <IconChevronLeft size={12} /> 上一章
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={goNext}
              disabled={currentIdx < 0 || currentIdx >= chapters.length - 1}
              title="下一章 (→)"
            >
              下一章 <IconChevronRight size={12} />
            </Button>
          </div>

          <div ref={readerRef} className="preview-reader" style={readerStyle}>
            {loadingContent ? (
              <div className="preview-reader-empty">
                <div className="ico">…</div>
                <div>加载中…</div>
              </div>
            ) : !currentChapter ? (
              <div className="preview-reader-empty">
                <IconEmpty size={32} />
                <div style={{ marginTop: 12 }}>从左侧选一章开始阅读</div>
              </div>
            ) : content ? (
              <ReaderBody text={content} fontStyle={readerFontStyle} title={currentChapter.title} />
            ) : (
              <div className="preview-reader-empty">
                <IconEmpty size={32} />
                <div style={{ marginTop: 12 }}>该章节还没有内容（可能未抓取）</div>
              </div>
            )}
          </div>

          {currentChapter && content && (
            <div className="preview-pagination">
              <span>
                第 <strong style={{ color: "var(--text-hi)" }}>{currentIdx + 1}</strong> / {chapters.length} 章
              </span>
              <span className="pos">
                {String(currentChapter.idx).padStart(4, "0")} · {currentChapter.title}
              </span>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

function ReaderBody({
  text,
  fontStyle,
  title,
}: {
  text: string;
  fontStyle: React.CSSProperties;
  title: string;
}) {
  // 按原文本 \n 拆行渲染，每一行独占一行、保持 10px 行间距
  const lines = text.split(/\r?\n/);
  const titleLine = lines.find((l) => l.startsWith("# "));
  const bodyLines = lines.filter((l) => !l.startsWith("# "));
  return (
    <article style={fontStyle}>
      <h1>{titleLine ? titleLine.slice(2).trim() : title}</h1>
      {bodyLines.map((line, i) => (
        // 空行用   占位，保证行高不被折叠
        <div key={i} className="preview-reader-line">{line || " "}</div>
      ))}
    </article>
  );
}
