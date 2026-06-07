#!/usr/bin/env python3
"""novel_crawler — 通用网络小说爬虫

Usage:
    python3 novel_crawler.py <book_url> <output_dir> [options]

Examples:
    # 武动乾坤 (yuebiqu)
    python3 novel_crawler.py https://www.yuebiqu.com/1612/ /Users/rui/Data/novel/武动乾坤

    # 自定义起始章 / 结束章
    python3 novel_crawler.py https://www.yuebiqu.com/1612/ ./wudong --start 1 --end 200

    # 干跑，只列章不下载
    python3 novel_crawler.py https://www.yuebiqu.com/1612/ ./wudong --dry-run

设计:
- Site parser 决定：章节目录抓取、分页识别、内容清洗
- 内置 yuebiqu parser；其它站点可继承 BaseParser
- 反爬：随机 0.3-0.6s 间隔 + 3 次重试 + 浏览器 UA
- 失败跳过不中断；末尾汇总报告
- 跳过已足量文件（>=1000 中文字），支持断点续传
"""
from __future__ import annotations

import argparse
import gzip
import io
import random
import re
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Iterable, List, Optional

CN_RE = re.compile(r'[\u4e00-\u9fff]')

DEFAULT_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------

def fetch(url: str, *,
          ua: str = DEFAULT_UA,
          timeout: int = 20,
          retries: int = 3) -> str:
    """GET URL with retries; auto-decode gzip / utf-8."""
    last_err: Optional[Exception] = None
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": ua,
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                "Accept-Encoding": "gzip, deflate",
            })
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = r.read()
                enc = r.headers.get("Content-Encoding", "")
                if enc == "gzip":
                    data = gzip.decompress(data)
                cset = r.headers.get_content_charset() or "utf-8"
                return data.decode(cset, errors="ignore")
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
            last_err = e
            if i + 1 >= retries:
                break
            wait = 1.5 * (i + 1) + random.uniform(0, 0.5)
            print(f"    retry {i+1}/{retries} after {wait:.1f}s ({e})", flush=True)
            time.sleep(wait)
    raise RuntimeError(f"fetch failed: {url} ({last_err})")


# ---------------------------------------------------------------------------
# Parsers
# ---------------------------------------------------------------------------

@dataclass
class Chapter:
    idx: int            # 1-based output index
    article_id: str     # site-specific id
    title: str


class BaseParser:
    """子类必须实现：list_chapters, extract_content, next_page."""
    name: str = "base"

    def __init__(self, book_url: str):
        self.book_url = book_url.rstrip("/")

    # -- list chapters --
    def list_chapters(self, html: str) -> List[Chapter]:
        raise NotImplementedError

    # -- page content extraction --
    def extract_content(self, html: str) -> str:
        raise NotImplementedError

    # -- pagination: returns next page number, or None --
    def next_page(self, html: str, article_id: str, current_page: int) -> Optional[int]:
        raise NotImplementedError


# ----- yuebiqu.com -----

class YuebiQuParser(BaseParser):
    """适配 yuebiqu.com 系列站点。
    章节目录: GET <book_url>/dir.html
    分页:      GET <book_url>/<article_id>/<page>.html
    内容:      <div id="content">...</div>
    """
    name = "yuebiqu"

    # 噪声行（站点固定提示）
    NOISE = [
        re.compile(r'喜欢\S*乾坤'), re.compile(r'喜欢\S*小说'),
        re.compile(r'阅笔趣更新速度'),
        re.compile(r'本章还未完'), re.compile(r'请大家收藏'),
        re.compile(r'请点击下一页'), re.compile(r'点击下一页'),
        re.compile(r'后面更精彩'), re.compile(r'精彩[小小说]'),
        re.compile(r'一秒记住'), re.compile(r'无弹窗'),
        re.compile(r'手机看小说'),
    ]
    TAG = re.compile(r'<[^>]+>')

    def list_chapters(self, html: str) -> List[Chapter]:
        # 章节列表区块以 "章节列表" 标记为界
        m = re.search(r'章节列表', html)
        if not m:
            # 退化：全文匹配
            block = html
        else:
            block = html[m.start():]
        pat = re.compile(r'<a href="/\d+/(\d+)/1\.html">([^<]+)</a>')
        seen = set()
        ordered: list[tuple[str, str]] = []
        for aid, title in pat.findall(block):
            if aid in seen:
                continue
            seen.add(aid)
            ordered.append((aid, title.strip()))
        # 过滤仅保留"第N章"格式
        kept = [(a, t) for a, t in ordered
                if t.startswith("第") and "章" in t]
        return [Chapter(idx=i, article_id=a, title=t)
                for i, (a, t) in enumerate(kept, 1)]

    def extract_content(self, html: str) -> str:
        m = re.search(r'<div id="content">(.*?)</div>',
                      html, re.DOTALL | re.IGNORECASE)
        if not m:
            return ""
        block = m.group(1)
        block = re.sub(r'<br\s*/?>', '\n', block, flags=re.I)
        block = re.sub(r'</p>', '\n', block, flags=re.I)
        text = self.TAG.sub('', block)
        text = (text.replace('&nbsp;', ' ')
                    .replace('&amp;', '&')
                    .replace('&lt;', '<')
                    .replace('&gt;', '>')
                    .replace('&quot;', '"')
                    .replace('&#39;', "'"))
        lines = []
        for ln in text.splitlines():
            ln = ln.strip()
            if not ln:
                continue
            if any(p.search(ln) for p in self.NOISE):
                continue
            lines.append(ln)
        return "\n".join(lines)

    def next_page(self, html: str, article_id: str, current_page: int) -> Optional[int]:
        m = re.search(
            r'pager_next"[^>]*href="[^"]*/' + re.escape(article_id) +
            r'/(\d+)\.html"', html)
        if not m:
            return None
        try:
            nxt = int(m.group(1))
            return nxt if nxt > current_page else None
        except ValueError:
            return None


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

@dataclass
class CrawlerConfig:
    book_url: str
    output_dir: Path
    start: int = 1
    end: Optional[int] = None      # None = all
    parser: str = "yuebiqu"
    min_cn: int = 1000              # skip threshold
    pad: int = 4                    # 0001.md padding
    interval_lo: float = 0.3
    interval_hi: float = 0.6
    page_interval_lo: float = 0.15
    page_interval_hi: float = 0.25
    dry_run: bool = False
    retries: int = 3


def make_parser(name: str, book_url: str) -> BaseParser:
    parsers = {
        "yuebiqu": YuebiQuParser,
    }
    if name not in parsers:
        raise SystemExit(f"unknown parser: {name} "
                         f"(available: {', '.join(parsers)})")
    return parsers[name](book_url)


def cn_count(s: str) -> int:
    return len(CN_RE.findall(s))


def already_ok(out: Path, threshold: int) -> bool:
    if not out.exists() or out.stat().st_size < 1500:
        return False
    try:
        s = out.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return False
    return cn_count(s) >= threshold


def download_chapter(parser: BaseParser, article_id: str,
                     cfg: CrawlerConfig) -> tuple[str, int]:
    """Returns (body, page_count)."""
    page = 1
    parts: list[str] = []
    while True:
        url = f"{parser.book_url}/{article_id}/{page}.html"
        html = fetch(url, retries=cfg.retries)
        text = parser.extract_content(html)
        if not text:
            if page == 1:
                raise RuntimeError("empty content page 1")
            break
        parts.append(text)
        nxt = parser.next_page(html, article_id, page)
        if not nxt:
            break
        page = nxt
        time.sleep(cfg.page_interval_lo
                   + random.uniform(0, cfg.page_interval_hi - cfg.page_interval_lo))
    return "\n\n".join(parts), len(parts)


def run(cfg: CrawlerConfig) -> int:
    cfg.output_dir.mkdir(parents=True, exist_ok=True)
    parser = make_parser(cfg.parser, cfg.book_url)

    # 拉章节目录
    index_url = f"{parser.book_url}/dir.html"
    print(f"fetching index: {index_url}", flush=True)
    try:
        html = fetch(index_url, retries=cfg.retries)
    except RuntimeError:
        # 部分站点章节目录即在根 URL
        print(f"  fallback to root: {parser.book_url}/", flush=True)
        html = fetch(parser.book_url + "/", retries=cfg.retries)
    chapters = parser.list_chapters(html)
    print(f"parser={cfg.parser} chapters={len(chapters)}", flush=True)
    if not chapters:
        raise SystemExit("no chapters parsed — check parser / book_url")

    end = cfg.end or len(chapters)
    end = min(end, len(chapters))
    start = max(1, cfg.start)

    if cfg.dry_run:
        print(f"[dry-run] plan: {start}..{end}", flush=True)
        for c in chapters[start - 1:end]:
            print(f"  {c.idx:04d}  aid={c.article_id}  {c.title}", flush=True)
        return 0

    fail: list[tuple[int, str, str, str]] = []
    t_start = time.time()
    for ch in chapters[start - 1:end]:
        out = cfg.output_dir / f"{ch.idx:0{cfg.pad}d}.md"
        if already_ok(out, cfg.min_cn):
            print(f"[{ch.idx}/{len(chapters)}] skip {out.name} "
                  f"({out.stat().st_size}B)", flush=True)
            continue
        try:
            t0 = time.time()
            body, pages = download_chapter(parser, ch.article_id, cfg)
            header = f"# {ch.title}\n\n"
            out.write_text(header + body + "\n", encoding="utf-8")
            cnc = cn_count(body)
            print(f"[{ch.idx}/{len(chapters)}] {out.name} aid={ch.article_id} "
                  f"pages={pages} cn={cnc} bytes={out.stat().st_size} "
                  f"t={time.time()-t0:.1f}s", flush=True)
        except Exception as e:
            print(f"[{ch.idx}/{len(chapters)}] {out.name} aid={ch.article_id} "
                  f"FAIL: {e}", flush=True)
            fail.append((ch.idx, ch.article_id, ch.title, str(e)))
        time.sleep(cfg.interval_lo
                   + random.uniform(0, cfg.interval_hi - cfg.interval_lo))

    print("=" * 40, flush=True)
    print(f"done: range {start}..{end}  failed={len(fail)}  "
          f"elapsed={time.time()-t_start:.0f}s", flush=True)
    for f_ in fail[:20]:
        print(" ", f_, flush=True)
    return 0 if not fail else 1


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description="Generic Chinese novel crawler.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument("book_url", help="e.g. https://www.yuebiqu.com/1612/")
    ap.add_argument("output_dir", help="chapter md files output dir")
    ap.add_argument("--parser", default="yuebiqu",
                    help="site parser (default: yuebiqu)")
    ap.add_argument("--start", type=int, default=1)
    ap.add_argument("--end", type=int, default=0,
                    help="0 = all parsed chapters")
    ap.add_argument("--min-cn", type=int, default=1000,
                    help="min Chinese chars to consider file complete (skip)")
    ap.add_argument("--pad", type=int, default=4,
                    help="filename zero-pad (default 4 → 0001.md)")
    ap.add_argument("--interval", type=float, nargs=2, default=[0.3, 0.6],
                    metavar=("LO", "HI"),
                    help="anti-ban interval seconds between chapters")
    ap.add_argument("--dry-run", action="store_true",
                    help="list chapters only, no download")
    ap.add_argument("--retries", type=int, default=3)
    args = ap.parse_args(argv)

    cfg = CrawlerConfig(
        book_url=args.book_url,
        output_dir=Path(args.output_dir).expanduser(),
        start=args.start,
        end=args.end or None,
        parser=args.parser,
        min_cn=args.min_cn,
        pad=args.pad,
        interval_lo=args.interval[0],
        interval_hi=args.interval[1],
        dry_run=args.dry_run,
        retries=args.retries,
    )
    return run(cfg)


if __name__ == "__main__":
    sys.exit(main())
