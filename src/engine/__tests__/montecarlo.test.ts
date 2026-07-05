import { describe, it, expect } from 'vitest';
import { FORMULAS } from '../formulas';

const mc = FORMULAS.MC_TERMINAL as (...a: unknown[]) => number[];
const pct = FORMULAS.PERCENTILE as (...a: unknown[]) => number;
const probBelow = FORMULAS.PROB_BELOW as (...a: unknown[]) => number;
const es = FORMULAS.EXPECTED_SHORTFALL as (...a: unknown[]) => number;
const varf = FORMULAS.VALUE_AT_RISK as (...a: unknown[]) => number;
const hist = FORMULAS.HISTOGRAM as (...a: unknown[]) => number[][];

describe('Monte Carlo & risk formulas', () => {
  it('MC_TERMINAL returns n prices and is deterministic', () => {
    const a = mc(100, 0.08, 0.2, 252, 500);
    const b = mc(100, 0.08, 0.2, 252, 500);
    expect(a).toHaveLength(500);
    expect(a).toEqual(b); // fixed seed -> reproducible
    expect(a.every((x) => x > 0 && isFinite(x))).toBe(true);
  });

  it('MC_TERMINAL mean is near the GBM expectation S0*e^(muT)', () => {
    const S0 = 100;
    const mu = 0.1;
    const term = mc(S0, mu, 0.2, 252, 20000);
    const mean = term.reduce((s, x) => s + x, 0) / term.length;
    const expected = S0 * Math.exp(mu * 1); // T = 252/252 = 1
    expect(Math.abs(mean - expected) / expected).toBeLessThan(0.05);
  });

  it('PERCENTILE interpolates known data', () => {
    const data = [1, 2, 3, 4, 5];
    expect(pct(data, 0)).toBe(1);
    expect(pct(data, 1)).toBe(5);
    expect(pct(data, 0.5)).toBe(3);
  });

  it('PROB_BELOW is the fraction under the threshold', () => {
    expect(probBelow([1, 2, 3, 4], 3)).toBeCloseTo(0.5, 10);
    expect(probBelow([10, 20, 30], 5)).toBe(0);
  });

  it('EXPECTED_SHORTFALL averages the worst tail', () => {
    // worst 25% of 1..8 is just {1,2} -> mean 1.5
    expect(es([1, 2, 3, 4, 5, 6, 7, 8], 0.25)).toBeCloseTo(1.5, 10);
  });

  it('VALUE_AT_RISK is a positive loss from baseline', () => {
    // 5% quantile of 1..100 ~= 5.95; VaR at 95% from baseline 100 ~= 94
    const v = varf(Array.from({ length: 100 }, (_, i) => i + 1), 100, 0.95);
    expect(v).toBeGreaterThan(90);
    expect(v).toBeLessThan(96);
  });

  it('HISTOGRAM returns [center, count] rows that sum to the sample size', () => {
    const rows = hist([1, 1, 2, 2, 2, 3], 3);
    expect(rows.length).toBe(3);
    const total = rows.reduce((s, r) => s + r[1], 0);
    expect(total).toBe(6);
    expect(rows.every((r) => r.length === 2)).toBe(true);
  });
});
