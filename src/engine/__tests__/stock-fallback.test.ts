/**
 * Tests for the synthetic-data fallback in stock-data.ts.
 *
 * With no VITE_STOCK_API_KEY configured (the default in tests/CI), the live
 * fetch is never attempted: requestTicker() rejects internally and seeds a
 * deterministic, ticker-seeded synthetic series so STOCK() stays demoable
 * offline. These tests assert that fallback is deterministic, correctly
 * shaped, and honestly flagged — with no real network involved.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  requestTicker,
  onStockData,
  getStockSeries,
  getStockBars,
  getTickerStatus,
  getSyntheticReason,
  isSyntheticData,
  didTickerFail,
  getApiKey,
  __resetStockData,
} from '../stock-data';

/** Fire requestTicker and resolve once the async fallback has landed. */
function loadSynthetic(ticker: string): Promise<void> {
  return new Promise((resolve) => {
    const off = onStockData(() => {
      off();
      resolve();
    });
    requestTicker(ticker);
  });
}

describe('synthetic stock fallback', () => {
  beforeEach(() => {
    __resetStockData();
  });

  it('runs in offline demo mode (no API key) so no network is used', () => {
    // Guards the hermetic premise of the rest of the suite.
    expect(getApiKey()).toBe('');
  });

  it('falls back to synthetic data flagged as offline when no key is set', async () => {
    await loadSynthetic('DEMO');

    expect(getTickerStatus('DEMO')).toBe('synthetic');
    expect(isSyntheticData('DEMO')).toBe(true);
    expect(didTickerFail('DEMO')).toBe(true);
    expect(getSyntheticReason('DEMO')).toBe('offline');
  });

  it('produces a well-shaped OHLCV series', async () => {
    await loadSynthetic('SHAPE');

    const closes = getStockSeries('SHAPE', 'close', 30);
    expect(closes).toBeDefined();
    expect(closes).toHaveLength(30);
    for (const c of closes!) {
      expect(Number.isFinite(c)).toBe(true);
      expect(c).toBeGreaterThan(0);
    }

    const bars = getStockBars('SHAPE', 15);
    expect(bars).toBeDefined();
    expect(bars).toHaveLength(15);
    for (const b of bars!) {
      // OHLC invariants: high is the top, low is the bottom, volume non-negative.
      expect(b.high).toBeGreaterThanOrEqual(Math.max(b.open, b.close) - 1e-9);
      expect(b.low).toBeLessThanOrEqual(Math.min(b.open, b.close) + 1e-9);
      expect(b.volume).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(b.t)).toBe(true);
    }
    // Bars are chronologically ordered.
    for (let i = 1; i < bars!.length; i++) {
      expect(bars![i].t).toBeGreaterThan(bars![i - 1].t);
    }
  });

  it('is deterministic: the same ticker reproduces the same closes', async () => {
    await loadSynthetic('SEED');
    const first = getStockSeries('SEED', 'close', 50)!.slice();

    __resetStockData();
    await loadSynthetic('SEED');
    const second = getStockSeries('SEED', 'close', 50)!.slice();

    expect(second).toEqual(first);
  });

  it('is ticker-seeded: different symbols produce different series', async () => {
    await loadSynthetic('AAAA');
    const a = getStockSeries('AAAA', 'close', 50)!.slice();
    await loadSynthetic('ZZZZ');
    const z = getStockSeries('ZZZZ', 'close', 50)!.slice();

    expect(z).not.toEqual(a);
  });

  it('normalizes ticker case when reading back synthetic data', async () => {
    await loadSynthetic('mixed');
    expect(getTickerStatus('MIXED')).toBe('synthetic');
    expect(getStockSeries('MIXED', 'close', 5)).toEqual(getStockSeries('mixed', 'close', 5));
  });
});
