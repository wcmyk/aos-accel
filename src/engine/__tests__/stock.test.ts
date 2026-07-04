/**
 * Tests for the STOCK() formula and its async-arrival recalculation flow.
 * Uses the test-only cache seeding helpers so no network is involved.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AccelEngine } from '../engine';
import { __setTickerData, __resetStockData, StockBar } from '../stock-data';

function bars(closes: number[]): StockBar[] {
  return closes.map((close, i) => ({
    t: i,
    open: close - 1,
    high: close + 1,
    low: close - 2,
    close,
    volume: 1000 + i,
  }));
}

describe('STOCK formula', () => {
  beforeEach(() => {
    __resetStockData();
  });

  it('returns the last N closes as an array', () => {
    __setTickerData('TEST', bars([10, 11, 12, 13, 14]));
    const engine = new AccelEngine();
    engine.setCell(1, 1, '=STOCK("TEST", "close", 3)');
    expect(engine.getCell(1, 1)).toEqual([12, 13, 14]);
  });

  it('supports open/high/low/volume fields and the price shorthand', () => {
    __setTickerData('TEST', bars([10, 20]));
    const engine = new AccelEngine();
    engine.setCell(1, 1, '=STOCK("TEST", "open", 2)');
    engine.setCell(2, 1, '=STOCK("TEST", "price")');
    expect(engine.getCell(1, 1)).toEqual([9, 19]);
    expect(engine.getCell(2, 1)).toBe(20);
  });

  it('composes with ordinary formulas from the same engine', () => {
    __setTickerData('TEST', bars([10, 20, 30]));
    const engine = new AccelEngine();
    engine.setCell(1, 1, '=AVERAGE(STOCK("TEST", "close", 3))');
    expect(engine.getCell(1, 1)).toBe(20);
  });

  it('reads the day count from a cell (slider parameter pattern)', () => {
    __setTickerData('TEST', bars([1, 2, 3, 4, 5]));
    const engine = new AccelEngine();
    engine.setCell(1, 2, 2); // B1 = days
    engine.setCell(1, 1, '=STOCK("TEST", "close", B1)');
    expect(engine.getCell(1, 1)).toEqual([4, 5]);

    engine.setCell(1, 2, 4);
    expect(engine.getCell(1, 1)).toEqual([2, 3, 4, 5]);
  });

  it('shows Loading… before data arrives, then resolves via recalculateStockCells', () => {
    const engine = new AccelEngine();
    engine.setCell(1, 1, '=STOCK("LATER", "close", 2)');
    engine.setCell(2, 1, '=SUM(A1)');
    expect(engine.getCell(1, 1)).toBe('Loading…');

    // Simulate the async fetch landing.
    __setTickerData('LATER', bars([7, 8]));
    const affected = engine.recalculateStockCells();

    expect(engine.getCell(1, 1)).toEqual([7, 8]);
    expect(engine.getCell(2, 1)).toBe(15); // dependent recalculated too
    expect(affected).toContain('1,1');
  });
});

describe('MARKETDAYS bridge', () => {
  it('exposes the market timeframe to formulas and recalculates on change', async () => {
    const { setMarketTimeframeDays } = await import('../stock-data');
    __setTickerData('TEST', bars([10, 20, 30, 40]));

    setMarketTimeframeDays(2);
    const engine = new AccelEngine();
    engine.setCell(1, 1, '=MARKETDAYS()');
    engine.setCell(2, 1, '=AVERAGE(STOCK("TEST", "close", MARKETDAYS()))');
    expect(engine.getCell(1, 1)).toBe(2);
    expect(engine.getCell(2, 1)).toBe(35); // last 2 closes: 30, 40

    // Chart timeframe changes → engine-visible state changes → recalc
    setMarketTimeframeDays(4);
    engine.recalculateStockCells();
    expect(engine.getCell(1, 1)).toBe(4);
    expect(engine.getCell(2, 1)).toBe(25); // all 4 closes
  });
});
