// 站点解析器 — 决定：章节列表抓取、分页识别、内容清洗
// 与 Python novel_crawler.py 的 BaseParser / YuebiQuParser 行为一致
//
// 性能要点：
//  - CHAP_LINK_RE / CONTENT_BLOCK_RE 等正则提升到模块顶层（js-hoist-regexp）
//  - listChapters 把 filter+map 合并成单次循环（js-combine-iterations）
//  - nextPage 内的分页正则按 articleId 用 Map 缓存，避免每次重新 new RegExp
//  - 早返回：listChapters 在解析完直接 return，nextPage 在不匹配时立即 null
//
// 本地解析器（localdir / localfile）：
//  - 读盘：readdir 一次性返回；用 basename 排序而不是全 stat
//  - 解析 articleId：对文件名做 0-pad-friendly 提取（兼容 1.md, 001.md, 第一章.md）
//  - 读内容：单次 readFile，UTF-8；不缓存（流式读）
import { fetchText, cnCount } from "./fetch.ts";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, basename, extname } from "node:path";

export interface ChapterMeta {
  idx: number;          // 1-based 输出序号
  articleId: string;    // 站点内文章 id / 本地文件名
  title: string;
}

export interface Parser {
  readonly name: string;
  /** 列出全部章节元信息（一次性返回；可能上千条） */
  listChapters(): Promise<ChapterMeta[]>;
  /** 拉取 articleId 的第 page 页内容；本地解析器忽略 page 始终返回全文 */
  extractContent(articleId: string, page: number): Promise<string>;
  /** 判定是否有下一页；本地解析器始终 null */
  nextPage(html: string, articleId: string, currentPage: number): number | null;
  /** 解析器类型 — 给前端用来切换 UI（url / dir / file） */
  readonly kind: "url" | "dir" | "file";
}

abstract class BaseParser implements Parser {
  abstract readonly name: string;
  abstract readonly kind: "url" | "dir" | "file";
  protected bookUrl: string;
  constructor(bookUrl: string) {
    this.bookUrl = bookUrl.replace(/\/$/, "");
  }

  abstract listChapters(): Promise<ChapterMeta[]>;
  abstract extractContent(articleId: string, page: number): Promise<string>;
  abstract nextPage(html: string, articleId: string, currentPage: number): number | null;

  protected chapterUrl(articleId: string, page: number): string {
    return `${this.bookUrl}/${articleId}/${page}.html`;
  }
}

// ---- yuebiqu.com 系列站点 ----

const NOISE = [
  /喜欢\S*乾坤/,
  /喜欢\S*小说/,
  /阅笔趣更新速度/,
  /本章还未完/,
  /请大家收藏/,
  /请点击下一页/,
  /点击下一页/,
  /后面更精彩/,
  /精彩[小小说]/,
  /一秒记住/,
  /无弹窗/,
  /手机看小说/,
];

const TAG_RE = /<[^>]+>/g;

// 全局正则有可变 lastIndex 状态 — 在使用前重置，避免跨调用污染
const CHAP_LINK_RE = /<a href="\/\d+\/(\d+)\/1\.html">([^<]+)<\/a>/g;
const CONTENT_BLOCK_RE = /<div id="content">(.*?)<\/div>/is;
const BR_RE = /<br\s*\/?>/gi;
const P_END_RE = /<\/p>/gi;

// 通用 HTML entity 解码 — 用单次 replace chain
const ENTITIES: ReadonlyArray<readonly [RegExp, string]> = [
  [/&nbsp;/g, " "],
  [/&amp;/g, "&"],
  [/&lt;/g, "<"],
  [/&gt;/g, ">"],
  [/&quot;/g, '"'],
  [/&#39;/g, "'"],
];

const REGEX_ESCAPE_RE = /[.*+?^${}()|[\]\\]/g;
function escapeRegex(s: string): string {
  return s.replace(REGEX_ESCAPE_RE, "\\$&");
}

class YuebiQuParser extends BaseParser {
  readonly name = "yuebiqu";
  readonly kind = "url" as const;

  // 按 articleId 缓存分页正则 — 一个章节只构建一次
  private nextPageReCache = new Map<string, RegExp>();

  private nextPageRe(articleId: string): RegExp {
    let re = this.nextPageReCache.get(articleId);
    if (!re) {
      re = new RegExp(
        `pager_next"[^>]*href="[^"]*\\/${escapeRegex(articleId)}\\/(\\d+)\\.html"`,
      );
      this.nextPageReCache.set(articleId, re);
    }
    return re;
  }

  async listChapters(): Promise<ChapterMeta[]> {
    let html: string;
    try {
      html = await fetchText(`${this.bookUrl}/dir.html`);
    } catch {
      // 退化：根 URL
      html = await fetchText(`${this.bookUrl}/`);
    }
    const marker = html.indexOf("章节列表");
    const block = marker >= 0 ? html.slice(marker) : html;

    // 单次循环：去重 + 过滤 + 编号
    CHAP_LINK_RE.lastIndex = 0;
    const seen = new Set<string>();
    const out: ChapterMeta[] = [];
    let m: RegExpExecArray | null;
    while ((m = CHAP_LINK_RE.exec(block)) !== null) {
      const aid = m[1]!;
      const title = m[2]!.trim();
      if (seen.has(aid)) continue;
      if (!title.startsWith("第") || !title.includes("章")) continue;
      seen.add(aid);
      out.push({ idx: out.length + 1, articleId: aid, title });
    }
    return out;
  }

  async extractContent(articleId: string, page: number): Promise<string> {
    const html = await fetchText(this.chapterUrl(articleId, page));
    return this._clean(html);
  }

  nextPage(html: string, articleId: string, currentPage: number): number | null {
    const m = this.nextPageRe(articleId).exec(html);
    if (!m) return null;
    const n = parseInt(m[1]!, 10);
    if (!Number.isFinite(n) || n <= currentPage) return null;
    return n;
  }

  private _clean(html: string): string {
    const m = CONTENT_BLOCK_RE.exec(html);
    if (!m) return "";
    let block = m[1]!;
    // 用一个长正则一次性替换所有 br/p 闭合为换行
    block = block.replace(/<br\s*\/?>|<\/p>/gi, "\n");
    block = block.replace(TAG_RE, "");
    for (const [re, val] of ENTITIES) block = block.replace(re, val);
    const out: string[] = [];
    for (const raw of block.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      if (NOISE.some((p) => p.test(line))) continue;
      out.push(line);
    }
    return out.join("\n");
  }
}

// ---- 本地解析器 ----

// 接受 .md / .markdown / .txt — 提模块顶层
const LOCAL_EXTS = new Set([".md", ".markdown", ".txt"]);
// 标题提取：去掉前导 # / 序号前缀 "001" / "第N章" / "Chapter N"，trim
const TITLE_HASH_PREFIX_RE = /^#+\s*/;
const TITLE_NUMBER_PREFIX_RE = /^(?:\d+|[第(（]?\s*\d+\s*[\.)、章回节讲)）]?)\s*[.、:：_\-—\s]*/;

/**
 * 本地目录解析器
 *  - bookUrl 存目录绝对路径
 *  - 把目录下"可识别为章节"的文件视作章节，按文件名自然排序
 *  - articleId = 文件 basename（不含扩展名），路径由内部 name→path 映射维护
 *
 * 性能/扩展性：
 *  - listChapters 用 withFileTypes 一次 readdir，跳过 stat（OS 缓存命中快）
 *  - 章节列表的 articleId 不暴露绝对路径给前端；由解析器在内部用 pathIndex 反查
 */
export class LocalDirParser extends BaseParser {
  readonly name = "localdir";
  readonly kind = "dir" as const;

  // articleId(basename without ext) → 完整文件名（保留原始扩展名）
  // 读盘阶段一次性填好，extractContent 时 O(1) 查表
  private pathIndex = new Map<string, string>();

  async listChapters(): Promise<ChapterMeta[]> {
    const entries = await readdir(this.bookUrl, { withFileTypes: true });
    // 单次循环：过滤 + 构造 articleId + 排序键
    const files: { name: string; articleId: string; sortKey: string }[] = [];
    for (const ent of entries) {
      if (!ent.isFile()) continue;
      const name = ent.name;
      const ext = extname(name).toLowerCase();
      if (!LOCAL_EXTS.has(ext)) continue;
      // 跳过隐藏文件 (.开头)
      if (name.startsWith(".")) continue;
      const stem = name.slice(0, name.length - ext.length);
      files.push({ name, articleId: stem, sortKey: name.toLowerCase() });
    }
    // 自然排序：localeCompare 配 numeric:true 让 "2.md" < "10.md"
    files.sort((a, b) => a.sortKey.localeCompare(b.sortKey, undefined, { numeric: true }));

    this.pathIndex.clear();
    const out: ChapterMeta[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i]!;
      this.pathIndex.set(f.articleId, f.name);
      out.push({ idx: i + 1, articleId: f.articleId, title: f.articleId });
    }
    return out;
  }

  async extractContent(articleId: string, _page: number): Promise<string> {
    const fname = this.pathIndex.get(articleId);
    if (!fname) throw new Error(`chapter not found: ${articleId}`);
    return readFile(join(this.bookUrl, fname), "utf8");
  }

  nextPage(_html: string, _articleId: string, _currentPage: number): number | null {
    return null;
  }
}

/**
 * 本地单文件解析器
 *  - bookUrl 存文件绝对路径
 *  - 永远只产出一个章节（idx=1）
 *  - 用于：用户拿到一个合集文件，但还没拆章；或单文件测试
 */
export class LocalFileParser extends BaseParser {
  readonly name = "localfile";
  readonly kind = "file" as const;

  async listChapters(): Promise<ChapterMeta[]> {
    const st = await stat(this.bookUrl);
    if (!st.isFile()) {
      throw new Error(`not a file: ${this.bookUrl}`);
    }
    const name = basename(this.bookUrl);
    const ext = extname(name);
    const stem = ext ? name.slice(0, -ext.length) : name;
    return [{ idx: 1, articleId: stem || "chapter", title: stem || "chapter" }];
  }

  async extractContent(_articleId: string, _page: number): Promise<string> {
    return readFile(this.bookUrl, "utf8");
  }

  nextPage(_html: string, _articleId: string, _currentPage: number): number | null {
    return null;
  }
}

const PARSERS: Record<string, new (url: string) => Parser> = {
  yuebiqu: YuebiQuParser,
  localdir: LocalDirParser,
  localfile: LocalFileParser,
};

export function makeParser(name: string, bookUrl: string): Parser {
  const Cls = PARSERS[name];
  if (!Cls) {
    throw new Error(
      `unknown parser: ${name} (available: ${Object.keys(PARSERS).join(", ")})`,
    );
  }
  return new Cls(bookUrl);
}

export { cnCount, TITLE_HASH_PREFIX_RE, TITLE_NUMBER_PREFIX_RE };
