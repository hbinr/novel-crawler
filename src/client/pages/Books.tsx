import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.ts";
import { fmtDateTime } from "../lib/format.ts";
import { t } from "../lib/i18n.ts";
import { EmptyState, PageHeader } from "../components/AppShell.tsx";
import { Button } from "../components/Button.tsx";
import { DataTable, type Column } from "../components/Table.tsx";
import { Field, Input, Select } from "../components/Input.tsx";
import { Modal } from "../components/Modal.tsx";
import { FileBrowser } from "../components/FileBrowser.tsx";
import { ImportLocalModal } from "../components/ImportLocalModal.tsx";
import { useToast } from "../components/Toast.tsx";
import { Breadcrumb } from "../components/Breadcrumb.tsx";
import { IconBook, IconEye, IconFolder, IconPlus, IconPlay, IconRefresh, IconTrash } from "../components/Icons.tsx";
import { PARSER_OPTIONS, type Book, type BookInput } from "@shared/types.ts";
import "./Books.css";

export function Books() {
  const [books, setBooks] = useState<Book[]>([]);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState<Book | null>(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const refresh = useCallback(() => {
    api.listBooks().then(setBooks).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRun = useCallback(
    async (b: Book) => {
      const tk = await api.createTask({ bookId: b.id });
      toast.push({ kind: "success", msg: `Task #${tk.id} queued` });
      navigate(`/tasks/${tk.id}`);
    },
    [navigate, toast],
  );

  const handleRefreshIndex = useCallback(
    async (b: Book) => {
      try {
        const r = await api.refreshIndex(b.id);
        toast.push({ kind: "success", msg: t.pages.books.chaptersIndexed(r.total) });
        refresh();
      } catch (e) {
        toast.push({ kind: "error", msg: (e as Error).message });
      }
    },
    [refresh, toast],
  );

  const handleDelete = useCallback(
    async (b: Book) => {
      setDeleting(true);
      try {
        await api.deleteBook(b.id);
        toast.push({ kind: "success", msg: t.pages.books.deleted });
        setConfirmingDelete(null);
        refresh();
      } catch (e) {
        toast.push({ kind: "error", msg: (e as Error).message });
      } finally {
        setDeleting(false);
      }
    },
    [refresh, toast],
  );

  const columns = useMemo<Column<Book>[]>(
    () => [
      {
        key: "id",
        header: "ID",
        width: "60px",
        mono: true,
        align: "right",
        render: (b) => `#${b.id}`,
      },
      { key: "name", header: "名称", render: (b) => <strong>{b.name}</strong> },
      {
        key: "url",
        header: "来源",
        render: (b) => {
          const isUrl = !b.bookUrl.startsWith("/");
          return isUrl ? (
            <a href={b.bookUrl} target="_blank" rel="noreferrer" className="muted mono">
              {b.bookUrl}
            </a>
          ) : (
            <span className="muted mono" title={b.bookUrl}>
              {b.bookUrl}
            </span>
          );
        },
      },
      {
        key: "parser",
        header: "解析器",
        width: "110px",
        render: (b) => (
          <span className="parser-tag" data-kind={parserKindOf(b.parser)}>
            {parserLabelOf(b.parser)}
          </span>
        ),
      },
      {
        key: "out",
        header: "输出目录",
        render: (b) => <span className="muted mono">{b.outputDir}</span>,
      },
      {
        key: "created",
        header: "创建时间",
        width: "150px",
        render: (b) => <span className="muted mono">{fmtDateTime(b.createdAt)}</span>,
      },
      {
        key: "act",
        header: "",
        width: "260px",
        align: "right",
        render: (b) => {
          const kind = parserKindOf(b.parser);
          const isLocal = kind === "dir" || kind === "file";
          return (
            <div className="row" style={{ justifyContent: "flex-end" }}>
              {isLocal ? (
                // 本地书源：没有"抓取"概念，直接阅读
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => navigate(`/preview?bookId=${b.id}`)}
                  title="去阅读"
                >
                  <IconEye size={12} /> 去阅读
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRefreshIndex(b)}
                    title={t.pages.books.refresh}
                  >
                    <IconRefresh size={12} /> {t.pages.books.refresh}
                  </Button>
                  <Button size="sm" variant="primary" onClick={() => handleRun(b)}>
                    <IconPlay size={10} /> {t.pages.books.run}
                  </Button>
                </>
              )}
              <Button size="sm" variant="danger" onClick={() => setConfirmingDelete(b)}>
                <IconTrash size={12} />
              </Button>
            </div>
          );
        },
      },
    ],
    [handleDelete, handleRefreshIndex, handleRun],
  );

  return (
    <>
      <PageHeader
        title={t.pages.books.title}
        subtitle={`${books.length} 个书源`}
        icon={<IconBook size={18} />}
        breadcrumb={
          <Breadcrumb
            items={[
              { label: "运行" },
              { label: t.pages.books.title, icon: <IconBook size={11} /> },
            ]}
          />
        }
        actions={
          <div className="row" style={{ gap: 6 }}>
            <Button variant="ghost" onClick={() => setImportOpen(true)}>
              <IconFolder size={12} /> 导入本地
            </Button>
            <Button variant="primary" onClick={() => setOpen(true)}>
              <IconPlus size={12} /> {t.pages.books.newBtn}
            </Button>
          </div>
        }
      />
      {books.length === 0 ? (
        <EmptyState
          icon={<IconBook size={28} />}
          title={t.pages.books.empty}
          desc="导入一个本地目录里的章节文件，或填入小说站点的章节目录 URL 批量抓取"
          hint="支持 .md / .markdown / .txt 文件，或 yuebiqu 站点"
          action={
            <div className="row" style={{ gap: 8 }}>
              <Button variant="ghost" onClick={() => setImportOpen(true)}>
                <IconFolder size={12} /> 导入本地
              </Button>
              <Button variant="primary" onClick={() => setOpen(true)}>
                <IconPlus size={12} /> {t.pages.books.newBtn}
              </Button>
            </div>
          }
        />
      ) : (
        <DataTable<Book>
          rows={books}
          rowKey={(b) => b.id}
          columns={columns}
          emptyIcon={<IconBook size={20} />}
          emptyTitle={t.pages.books.empty}
          emptyHint="导入一个本地目录或新建一个站点书源"
        />
      )}
      <BookFormModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={() => {
          setOpen(false);
          refresh();
        }}
      />
      <ImportLocalModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          refresh();
        }}
      />
      <Modal
        open={confirmingDelete !== null}
        onClose={() => (deleting ? null : setConfirmingDelete(null))}
        title="删除书源"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmingDelete(null)} disabled={deleting}>
              取消
            </Button>
            <Button
              variant="primary"
              loading={deleting}
              onClick={() => confirmingDelete && handleDelete(confirmingDelete)}
            >
              删除
            </Button>
          </>
        }
      >
        <div className="col" style={{ gap: 8, fontSize: 13 }}>
          <div>
            确定删除书源 <strong>{confirmingDelete?.name}</strong>？已抓取的章节会保留，
            后续无法再为此书源新建任务。
          </div>
        </div>
      </Modal>
    </>
  );
}

function BookFormModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<BookInput>({
    name: "",
    bookUrl: "",
    parser: "yuebiqu",
    outputDir: "",
  });
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (open) {
      api.getSettings().then((s) => {
        setForm((f) => ({
          ...f,
          outputDir: f.outputDir || `${s.defaultOutputRoot}/${Date.now()}`,
          minCn: f.minCn ?? s.defaultMinCn,
          pad: f.pad ?? s.defaultPad,
          intervalLo: f.intervalLo ?? s.defaultIntervalLo,
          intervalHi: f.intervalHi ?? s.defaultIntervalHi,
          retries: f.retries ?? s.defaultRetries,
          ua: f.ua ?? s.defaultUa,
        }));
      });
    }
  }, [open]);

  const update = useCallback(
    <K extends keyof BookInput>(k: K) =>
      (e: { target: { value: string } }) =>
        setForm((f) => ({ ...f, [k]: e.target.value as BookInput[K] })),
    [],
  );

  // 切解析器时，bookUrl 清空（避免无意义的 URL 串）
  const onParserChange = useCallback((e: { target: { value: string } }) => {
    const next = e.target.value;
    setForm((f) => ({
      ...f,
      parser: next,
      // 切换种类时 bookUrl 重置
      bookUrl: next === f.parser ? f.bookUrl : "",
    }));
  }, []);

  const onPickPath = useCallback(
    (picked: string) => {
      setForm((f) => ({ ...f, bookUrl: picked }));
      setPickerOpen(false);
    },
    [],
  );

  const submit = useCallback(async () => {
    setLoading(true);
    try {
      await api.createBook(form);
      toast.push({ kind: "success", msg: t.pages.books.created });
      onCreated();
    } catch (e) {
      toast.push({ kind: "error", msg: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [form, onCreated, toast]);

  const parserName = form.parser ?? "yuebiqu";
  const parserKind =
    PARSER_OPTIONS.find((p) => p.id === parserName)?.kind ?? "url";
  const sourceLabel =
    parserKind === "url"
      ? t.pages.books.url
      : parserKind === "dir"
        ? "目录路径"
        : "文件路径";
  const sourcePlaceholder =
    parserKind === "url"
      ? "https://www.yuebiqu.com/1612/"
      : parserKind === "dir"
        ? "/Users/.../books/wudong"
        : "/Users/.../books/wudong/chapter-1.md";
  const sourceHint =
    parserKind === "url"
      ? t.pages.books.urlHint
      : parserKind === "dir"
        ? "目录下 .md / .markdown / .txt 都视作章节，按文件名排序"
        : "该文件作为唯一的章节（idx=1）";

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={t.pages.books.createTitle}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              {t.pages.books.cancel}
            </Button>
            <Button variant="primary" loading={loading} onClick={submit}>
              {t.pages.books.create}
            </Button>
          </>
        }
      >
        <div className="col" style={{ gap: 12 }}>
          <Field label={t.pages.books.name}>
            <Input value={form.name} onChange={update("name")} placeholder="武动乾坤" />
          </Field>

          <div className="row" style={{ gap: 12 }}>
            <Field label={t.pages.books.parser} hint={t.pages.books.parserHint}>
              <Select value={parserName} onChange={onParserChange}>
                {PARSER_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.pages.books.pad} hint={t.pages.books.padHint}>
              <Input
                type="number"
                value={form.pad ?? 4}
                onChange={update("pad")}
              />
            </Field>
          </div>

          <Field label={sourceLabel} hint={sourceHint}>
            <div className="row" style={{ gap: 6 }}>
              <Input
                value={form.bookUrl}
                onChange={update("bookUrl")}
                placeholder={sourcePlaceholder}
                style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
              />
              {parserKind !== "url" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPickerOpen(true)}
                  title="浏览本地文件"
                >
                  <IconFolder size={12} /> 浏览
                </Button>
              )}
            </div>
          </Field>

          <Field label={t.pages.books.outputDir}>
            <Input
              value={form.outputDir}
              onChange={update("outputDir")}
              placeholder="/Users/.../data/books/wudong"
            />
          </Field>

          <div className="row" style={{ gap: 12 }}>
            <Field label={t.pages.books.intervalLo}>
              <Input
                type="number"
                step="0.1"
                value={form.intervalLo ?? 0.3}
                onChange={update("intervalLo")}
              />
            </Field>
            <Field label={t.pages.books.intervalHi}>
              <Input
                type="number"
                step="0.1"
                value={form.intervalHi ?? 0.6}
                onChange={update("intervalHi")}
              />
            </Field>
            <Field label={t.pages.books.retries}>
              <Input
                type="number"
                value={form.retries ?? 3}
                onChange={update("retries")}
              />
            </Field>
            <Field label={t.pages.books.minCn} hint={t.pages.books.minCnHint}>
              <Input
                type="number"
                value={form.minCn ?? 1000}
                onChange={update("minCn")}
              />
            </Field>
          </div>
        </div>
      </Modal>

      <FileBrowser
        open={pickerOpen}
        mode={parserKind === "file" ? "file" : "dir"}
        initialPath={form.bookUrl}
        onClose={() => setPickerOpen(false)}
        onPick={onPickPath}
      />
    </>
  );
}

function parserKindOf(p: string): "url" | "dir" | "file" {
  if (p === "localdir") return "dir";
  if (p === "localfile") return "file";
  return "url";
}

function parserLabelOf(p: string): string {
  switch (p) {
    case "localdir":
      return "本地目录";
    case "localfile":
      return "本地文件";
    case "yuebiqu":
    default:
      return p;
  }
}
