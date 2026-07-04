/**
 * Stock market data provider for the STOCK() formula.
 *
 * Data flows through the same unified engine as everything else: STOCK() is
 * an ordinary formula function that returns an array, so it can be summed,
 * averaged, referenced by cells, and fed straight into PLOT() — the graph and
 * the grid recalculate from the same AST.
 *
 * Fetching strategy: formulas are synchronous, network is not. STOCK() reads
 * from an in-memory cache; on a miss it kicks off ONE wide fetch per ticker
 * (daily bars, all fields, up to ~10 years) and returns a "Loading…"
 * placeholder. When the data lands, registered listeners (the store) trigger
 * a recalculation and every dependent cell and graph updates. Because the
 * full history is cached per ticker, changing the day-count parameter (e.g.
 * via a slider) slices locally and costs zero additional API calls — free
 * API tiers are rate-limited, so this matters.
 *
 * Provider: Polygon.io daily aggregates. Configure via VITE_STOCK_API_KEY
 * (see .env.example). Without a key, or if the request fails, STOCK()
 * falls back to deterministic synthetic data (seeded by ticker) so the
 * feature remains demoable offline — flagged via isSyntheticData().
 */

export interface StockBar {
  t: number; // epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TickerCache {
  bars: StockBar[];
  synthetic: boolean;
}

const MAX_HISTORY_DAYS = 3650;
const DAY_MS = 24 * 60 * 60 * 1000;

const cache = new Map<string, TickerCache>();
const pending = new Set<string>();
const failed = new Set<string>();
const listeners = new Set<() => void>();

/** Register a callback fired whenever new stock data arrives. */
export function onStockData(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  listeners.forEach((l) => l());
}

export function getApiKey(): string {
  return (import.meta.env?.VITE_STOCK_API_KEY as string | undefined)?.trim() || '';
}

/** True when the cached series for a ticker is synthetic demo data. */
export function isSyntheticData(ticker: string): boolean {
  return cache.get(normalizeTicker(ticker))?.synthetic ?? false;
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

/**
 * Synchronously read a field series for the last `days` trading days.
 * Returns undefined on a cache miss (caller should requestTicker()).
 */
export function getStockSeries(
  ticker: string,
  field: string,
  days: number
): number[] | undefined {
  const entry = cache.get(normalizeTicker(ticker));
  if (!entry) return undefined;

  const f = field.trim().toLowerCase();
  const bars = entry.bars.slice(-Math.max(1, Math.min(days, entry.bars.length)));

  switch (f) {
    case 'open':
      return bars.map((b) => b.open);
    case 'high':
      return bars.map((b) => b.high);
    case 'low':
      return bars.map((b) => b.low);
    case 'volume':
      return bars.map((b) => b.volume);
    case 'close':
    default:
      return bars.map((b) => b.close);
  }
}

/** Last close as a single number (for =STOCK("AAPL", "price")). */
export function getLastPrice(ticker: string): number | undefined {
  const entry = cache.get(normalizeTicker(ticker));
  if (!entry || entry.bars.length === 0) return undefined;
  return entry.bars[entry.bars.length - 1].close;
}

export function isTickerLoaded(ticker: string): boolean {
  return cache.has(normalizeTicker(ticker));
}

/**
 * Ensure daily bars for a ticker are (being) loaded.
 * Deduplicates in-flight requests; failed tickers fall back to synthetic
 * data exactly once instead of hammering the API.
 */
export function requestTicker(ticker: string): void {
  const t = normalizeTicker(ticker);
  if (!t || cache.has(t) || pending.has(t)) return;

  pending.add(t);
  void fetchTicker(t)
    .then((bars) => {
      cache.set(t, { bars, synthetic: false });
    })
    .catch(() => {
      failed.add(t);
      cache.set(t, { bars: syntheticBars(t), synthetic: true });
    })
    .finally(() => {
      pending.delete(t);
      notify();
    });
}

/** True if the last load for this ticker fell back to synthetic data. */
export function didTickerFail(ticker: string): boolean {
  return failed.has(normalizeTicker(ticker));
}

async function fetchTicker(ticker: string): Promise<StockBar[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('No VITE_STOCK_API_KEY configured');
  }

  const to = new Date();
  const from = new Date(to.getTime() - MAX_HISTORY_DAYS * DAY_MS);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const url =
    `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}` +
    `/range/1/day/${fmt(from)}/${fmt(to)}` +
    `?adjusted=true&sort=asc&limit=50000&apiKey=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Stock API error: HTTP ${res.status}`);
  }

  const json = await res.json();
  const results = json?.results;
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error(`No data for ticker ${ticker}`);
  }

  return results.map((r: Record<string, number>) => ({
    t: r.t,
    open: r.o,
    high: r.h,
    low: r.l,
    close: r.c,
    volume: r.v,
  }));
}

/**
 * Deterministic synthetic daily bars (seeded random walk from the ticker
 * string), so STOCK() stays demoable with no key and no network.
 */
function syntheticBars(ticker: string): StockBar[] {
  let seed = 0;
  for (let i = 0; i < ticker.length; i++) {
    seed = (seed * 31 + ticker.charCodeAt(i)) >>> 0;
  }
  // mulberry32 PRNG
  const rand = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let z = seed;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };

  const bars: StockBar[] = [];
  const count = 2520; // ~10 trading years
  let price = 50 + rand() * 250;
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const drift = 0.0003;
    const shock = (rand() - 0.5) * 0.04;
    const open = price;
    price = Math.max(1, price * (1 + drift + shock));
    const close = price;
    const high = Math.max(open, close) * (1 + rand() * 0.01);
    const low = Math.min(open, close) * (1 - rand() * 0.01);
    bars.push({
      t: now - (count - i) * DAY_MS,
      open,
      high,
      low,
      close,
      volume: Math.round(1e6 + rand() * 5e6),
    });
  }
  return bars;
}

/** Test-only helper: seed the cache directly. */
export function __setTickerData(ticker: string, bars: StockBar[], synthetic = false): void {
  cache.set(normalizeTicker(ticker), { bars, synthetic });
}

/** Test-only helper: reset all module state. */
export function __resetStockData(): void {
  cache.clear();
  pending.clear();
  failed.clear();
}
