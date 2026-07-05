/**
 * Correctness + regression tests for the reachable scientific formula slice
 * and the removal of the dead DERIVATIVE stub.
 *
 * Wave 1 deleted DERIVATIVE (it always returned #N/A) and kept a curated set
 * of physics/linear-algebra/stats formulas that actually evaluate. These
 * tests lock in a representative subset with trivially verifiable math, and
 * assert that DERIVATIVE now surfaces an honest "unknown function" error
 * instead of silently pretending to work.
 */

import { describe, it, expect } from 'vitest';
import { AccelEngine } from '../engine';

/** Evaluate a single formula in a fresh engine and return the cell value. */
function evalFormula(formula: string) {
  const engine = new AccelEngine();
  engine.setCell(1, 1, formula);
  return engine.getCell(1, 1);
}

describe('reachable scientific formulas', () => {
  it('KINETIC_ENERGY computes ½mv²', () => {
    // ½ · 2 · 3² = 9
    expect(evalFormula('=KINETIC_ENERGY(2, 3)')).toBeCloseTo(9, 10);
  });

  it('POTENTIAL_ENERGY computes mgh with an explicit g', () => {
    // 2 · 10 · 5 = 100
    expect(evalFormula('=POTENTIAL_ENERGY(2, 5, 10)')).toBeCloseTo(100, 10);
  });

  it('SPRING_FORCE computes -kx (Hooke\'s law)', () => {
    expect(evalFormula('=SPRING_FORCE(4, 2)')).toBeCloseTo(-8, 10);
  });

  it('PENDULUM_PERIOD returns 2π when L = g', () => {
    expect(evalFormula('=PENDULUM_PERIOD(9.81, 9.81)')).toBeCloseTo(2 * Math.PI, 6);
  });

  it('DOT_PRODUCT splits its flattened args into two vectors', () => {
    // [1,2] · [3,4] = 3 + 8 = 11
    expect(evalFormula('=DOT_PRODUCT(1, 2, 3, 4)')).toBeCloseTo(11, 10);
  });

  it('VECTOR_NORM computes Euclidean magnitude', () => {
    // |(3,4)| = 5
    expect(evalFormula('=VECTOR_NORM(3, 4)')).toBeCloseTo(5, 10);
  });

  it('SPEED_OF_LIGHT returns the CODATA constant', () => {
    expect(evalFormula('=SPEED_OF_LIGHT()')).toBe(299792458);
  });

  it('PLANCK returns Planck\'s constant', () => {
    expect(evalFormula('=PLANCK()')).toBe(6.62607015e-34);
  });

  it('NORMAL_CDF is 0.5 at the mean and monotonic', () => {
    const atMean = evalFormula('=NORMAL_CDF(0, 0, 1)') as number;
    const above = evalFormula('=NORMAL_CDF(1, 0, 1)') as number;
    const below = evalFormula('=NORMAL_CDF(-1, 0, 1)') as number;
    expect(atMean).toBeCloseTo(0.5, 6);
    expect(above).toBeGreaterThan(atMean);
    expect(below).toBeLessThan(atMean);
  });

  it('INTEGRATE approximates the area of a constant via Simpson\'s rule', () => {
    // 3 sample points over [0,2] (2 intervals, h=1) of f=1 → area = 2
    const area = evalFormula('=INTEGRATE(0, 2, 3, 1, 1, 1)') as number;
    expect(area).toBeCloseTo(2, 6);
  });
});

describe('removed DERIVATIVE stub', () => {
  it('surfaces an honest unknown-function error instead of a fake result', () => {
    const result = evalFormula('=DERIVATIVE(A2, 0.1)');
    expect(typeof result).toBe('string');
    expect(result as string).toContain('#ERROR');
    expect(result as string).toContain('DERIVATIVE');
  });
});
