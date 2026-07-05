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

/**
 * Why a series is synthetic:
 *  - 'offline': no VITE_STOCK_API_KEY is configured (expected demo mode).
 *  - 'error':   a key exists but the live request failed (network, rate
 *               limit, bad symbol, or malformed response).
 * This lets the UI be honest about *why* it is showing placeholder prices.
 */
export type SyntheticReason = 'offline' | 'error';

/** Coarse load state for a single ticker, for status UI. */
export type TickerStatus = 'missing' | 'loading' | 'live' | 'synthetic';

interface TickerCache {
  bars: StockBar[];
  synthetic: boolean;
  reason?: SyntheticReason;
}

const MAX_HISTORY_DAYS = 3650;
const DAY_MS = 24 * 60 * 60 * 1000;

const cache = new Map<string, TickerCache>();
const pending = new Set<string>();
const failed = new Set<string>();
const listeners = new Set<() => void>();

/**
 * The Market chart's active timeframe, exposed to the formula engine as
 * MARKETDAYS(). This is the bridge that makes the chart's timeframe buttons
 * and the grid two views of the same state: cells written against
 * MARKETDAYS() recalculate whenever the user clicks 1M/3M/1Y/etc.
 */
let marketTimeframeDays = 63; // matches the default '3M'

export function setMarketTimeframeDays(days: number): void {
  marketTimeframeDays = Math.max(1, Math.round(days));
}

export function getMarketTimeframeDays(): number {
  return marketTimeframeDays;
}

/** Trading-day counts for the Market panel timeframe buttons. */
export const TIMEFRAME_BARS: Record<string, number> = {
  '1M': 21,
  '3M': 63,
  '6M': 126,
  '1Y': 252,
  '5Y': 1260,
  'All': 3650,
};

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

/**
 * Why the cached series is synthetic, or null when it is live (or not yet
 * loaded). Lets the Market panel explain demo mode honestly.
 */
export function getSyntheticReason(ticker: string): SyntheticReason | null {
  const entry = cache.get(normalizeTicker(ticker));
  if (!entry || !entry.synthetic) return null;
  return entry.reason ?? 'offline';
}

/** Coarse load state for status UI: missing, loading, live, or synthetic. */
export function getTickerStatus(ticker: string): TickerStatus {
  const t = normalizeTicker(ticker);
  const entry = cache.get(t);
  if (entry) return entry.synthetic ? 'synthetic' : 'live';
  if (pending.has(t)) return 'loading';
  return 'missing';
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
  const want = Number.isFinite(days) ? days : entry.bars.length;
  const bars = entry.bars.slice(-Math.max(1, Math.min(want, entry.bars.length)));

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

/**
 * Raw daily bars (with timestamps) for the last `count` trading days.
 * Used by the Market panel chart; returns undefined on a cache miss.
 */
export function getStockBars(ticker: string, count: number): StockBar[] | undefined {
  const entry = cache.get(normalizeTicker(ticker));
  if (!entry) return undefined;
  if (count <= 0 || count >= entry.bars.length) return entry.bars;
  return entry.bars.slice(-count);
}

/**
 * Bars for a custom window: the first `days` trading days starting at
 * `startMs` (inclusive). Returns whatever overlaps the cached history.
 */
export function getStockBarsFrom(ticker: string, startMs: number, days: number): StockBar[] | undefined {
  const entry = cache.get(normalizeTicker(ticker));
  if (!entry) return undefined;
  const from = entry.bars.filter((b) => b.t >= startMs);
  return from.slice(0, Math.max(1, days));
}

export interface TickerMatch {
  symbol: string;
  name: string;
}

const POPULAR_TICKERS: TickerMatch[] = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'META', name: 'Meta Platforms Inc.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'NFLX', name: 'Netflix Inc.' },
  { symbol: 'AMD', name: 'Advanced Micro Devices' },
  { symbol: 'INTC', name: 'Intel Corporation' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
  { symbol: 'V', name: 'Visa Inc.' },
  { symbol: 'DIS', name: 'The Walt Disney Company' },
  { symbol: 'KO', name: 'The Coca-Cola Company' },
  { symbol: 'WMT', name: 'Walmart Inc.' },
  { symbol: 'BA', name: 'The Boeing Company' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF' },
  { symbol: 'QQQ', name: 'Invesco QQQ (Nasdaq-100 ETF)' },
];

/**
 * Instant, synchronous search over the curated list — shown immediately
 * while the (optional) provider search is in flight, so the picker never
 * feels dead. Any symbol can always be added directly regardless of
 * search results.
 */
export function searchTickersLocal(query: string): TickerMatch[] {
  const q = query.trim().toLowerCase();
  if (!q) return POPULAR_TICKERS;
  return POPULAR_TICKERS.filter(
    (t) => t.symbol.toLowerCase().startsWith(q) || t.name.toLowerCase().includes(q)
  );
}

/**
 * Full-universe search via the provider's reference API. Resolves to null
 * when no key is configured or the request fails — callers keep whatever
 * local results they already show.
 */
export async function searchTickersRemote(query: string): Promise<TickerMatch[] | null> {
  const q = query.trim();
  const apiKey = getApiKey();
  if (!q || !apiKey) return null;

  try {
    const url =
      `https://api.polygon.io/v3/reference/tickers?search=${encodeURIComponent(q)}` +
      `&market=stocks&active=true&limit=10&apiKey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { status?: string; results?: unknown };
    if (json?.status === 'ERROR') return null;
    const results = Array.isArray(json?.results) ? json.results : [];
    return results
      .map((r) => r as { ticker?: unknown; name?: unknown })
      .filter((r) => typeof r.ticker === 'string' && r.ticker.length > 0)
      .map((r) => ({ symbol: String(r.ticker), name: String(r.name ?? r.ticker) }));
  } catch {
    return null;
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
      // No key → expected offline demo mode; a key present → a genuine
      // fetch failure (network, rate limit, bad symbol, malformed data).
      const reason: SyntheticReason = getApiKey() ? 'error' : 'offline';
      cache.set(t, { bars: syntheticBars(t), synthetic: true, reason });
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
    // 429 = free-tier rate limit; surface it distinctly for debuggability.
    const detail = res.status === 429 ? 'rate limited (HTTP 429)' : `HTTP ${res.status}`;
    throw new Error(`Stock API error: ${detail}`);
  }

  const json = (await res.json()) as { status?: string; error?: string; results?: unknown };
  // Polygon can answer 200 with an error envelope (bad symbol, throttling).
  if (json?.status === 'ERROR') {
    throw new Error(json.error || `Stock API error for ${ticker}`);
  }

  const bars = sanitizeBars(json?.results);
  if (bars.length === 0) {
    throw new Error(`No usable data for ticker ${ticker}`);
  }
  return bars;
}

/**
 * Coerce a raw provider payload into clean, chronologically ordered bars.
 * Drops any row with a non-finite timestamp or non-positive close, and
 * backfills missing OHLC fields from the close so a partial row is still
 * usable rather than poisoning the series with NaN.
 */
function sanitizeBars(raw: unknown): StockBar[] {
  if (!Array.isArray(raw)) return [];
  const out: StockBar[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as Record<string, unknown>;
    const t = Number(rec.t);
    const close = Number(rec.c);
    if (!Number.isFinite(t) || !Number.isFinite(close) || close <= 0) continue;
    const open = Number(rec.o);
    const high = Number(rec.h);
    const low = Number(rec.l);
    const volume = Number(rec.v);
    out.push({
      t,
      open: Number.isFinite(open) && open > 0 ? open : close,
      high: Number.isFinite(high) && high > 0 ? high : close,
      low: Number.isFinite(low) && low > 0 ? low : close,
      close,
      volume: Number.isFinite(volume) && volume >= 0 ? volume : 0,
    });
  }
  // Defensive: guarantee ascending time order even if the API sort changes.
  out.sort((a, b) => a.t - b.t);
  return out;
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
