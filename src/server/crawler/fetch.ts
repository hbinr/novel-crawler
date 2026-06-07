// HTTP fetch with retries, gzip, UA — port of Python fetch()
const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export interface FetchOpts {
  ua?: string;
  timeoutMs?: number;
  retries?: number;
}

export async function fetchText(url: string, opts: FetchOpts = {}): Promise<string> {
  const ua = opts.ua || DEFAULT_UA;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const retries = opts.retries ?? 3;
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), timeoutMs);
      const r = await fetch(url, {
        signal: ctl.signal,
        headers: {
          "User-Agent": ua,
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
          "Accept-Encoding": "gzip, deflate",
        },
      });
      clearTimeout(t);
      if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
      const buf = new Uint8Array(await r.arrayBuffer());
      // Bun's fetch already decodes gzip/br/deflate when Accept-Encoding is set
      return new TextDecoder("utf-8", { fatal: false }).decode(buf);
    } catch (e) {
      lastErr = e;
      if (i + 1 >= retries) break;
      const wait = 1.5 * (i + 1) + Math.random() * 0.5;
      await new Promise((r) => setTimeout(r, wait * 1000));
    }
  }
  throw new Error(`fetch failed: ${url} (${(lastErr as Error)?.message ?? lastErr})`);
}

export function cnCount(text: string): number {
  let n = 0;
  for (const ch of text) if (ch >= "\u4e00" && ch <= "\u9fff") n++;
  return n;
}
