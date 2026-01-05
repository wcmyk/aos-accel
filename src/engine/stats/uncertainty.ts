/**
 * Uncertainty Propagation
 * Features:
 * - Analytical error propagation (derivatives)
 * - Monte Carlo simulation
 * - Correlation handling
 * - Measurement uncertainty combining
 */

import { Vector, Distribution } from '../types-advanced';
import { gradient } from '../math/calculus';
import { MultivariateFunction } from '../math/calculus';
import { SeededRandom } from './distributions';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MEASUREMENT WITH UNCERTAINTY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface Measurement {
  value: number;
  uncertainty: number;
  unit?: string;
  type: 'random' | 'systematic' | 'combined';
}

/**
 * Create measurement with uncertainty
 */
export function createMeasurement(
  value: number,
  uncertainty: number,
  unit?: string,
  type: 'random' | 'systematic' | 'combined' = 'combined'
): Measurement {
  return { value, uncertainty, unit, type };
}

/**
 * Relative uncertainty (%)
 */
export function relativeUncertainty(m: Measurement): number {
  return (m.uncertainty / Math.abs(m.value)) * 100;
}

/**
 * Significant figures based on uncertainty
 */
export function significantFigures(m: Measurement): number {
  if (m.uncertainty === 0) return Infinity;

  const log10Unc = Math.floor(Math.log10(m.uncertainty));
  const log10Val = Math.floor(Math.log10(Math.abs(m.value)));

  return Math.max(1, log10Val - log10Unc + 1);
}

/**
 * Format measurement with appropriate precision
 */
export function formatMeasurement(m: Measurement): string {
  const sf = Math.min(significantFigures(m), 6);
  const precision = Math.max(0, sf - Math.floor(Math.log10(Math.abs(m.value))) - 1);

  const valueStr = m.value.toFixed(precision);
  const uncStr = m.uncertainty.toFixed(precision);
  const unit = m.unit ? ` ${m.unit}` : '';

  return `${valueStr} ± ${uncStr}${unit}`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ANALYTICAL PROPAGATION (First-order Taylor expansion)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface UncertaintyResult {
  value: number;
  uncertainty: number;
  contributions: Map<string, number>; // Which inputs contribute most
  method: 'analytical' | 'monte-carlo';
}

/**
 * Propagate uncertainty through function (uncorrelated inputs)
 *
 * Uses first-order error propagation:
 * σ_f² = Σ (∂f/∂x_i)² σ_i²
 */
export function propagateUncertainty(
  f: MultivariateFunction,
  inputs: Measurement[],
  inputNames?: string[]
): UncertaintyResult {
  const x = inputs.map((m) => m.value);
  const uncertainties = inputs.map((m) => m.uncertainty);

  // Compute gradient at the point
  const grad = gradient(f, x);

  // Compute combined uncertainty
  let varTotal = 0;
  const contributions = new Map<string, number>();

  for (let i = 0; i < inputs.length; i++) {
    const partialDerivative = grad.data[i];
    const contribution = (partialDerivative * uncertainties[i]) ** 2;
    varTotal += contribution;

    const name = inputNames?.[i] || `x${i}`;
    contributions.set(name, Math.sqrt(contribution));
  }

  const value = f(x);
  const uncertainty = Math.sqrt(varTotal);

  return {
    value,
    uncertainty,
    contributions,
    method: 'analytical',
  };
}

/**
 * Propagate uncertainty with correlations
 *
 * σ_f² = Σ_i Σ_j (∂f/∂x_i)(∂f/∂x_j) Cov(x_i, x_j)
 */
export function propagateUncertaintyWithCorrelation(
  f: MultivariateFunction,
  inputs: Measurement[],
  covarianceMatrix: number[][],
  inputNames?: string[]
): UncertaintyResult {
  const x = inputs.map((m) => m.value);
  const grad = gradient(f, x);

  // Compute variance: grad^T * Cov * grad
  let varTotal = 0;
  const n = inputs.length;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      varTotal += grad.data[i] * grad.data[j] * covarianceMatrix[i][j];
    }
  }

  const contributions = new Map<string, number>();
  for (let i = 0; i < inputs.length; i++) {
    const name = inputNames?.[i] || `x${i}`;
    // Marginal contribution (diagonal terms)
    contributions.set(name, Math.abs(grad.data[i] * Math.sqrt(covarianceMatrix[i][i])));
  }

  return {
    value: f(x),
    uncertainty: Math.sqrt(varTotal),
    contributions,
    method: 'analytical',
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MONTE CARLO PROPAGATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface MonteCarloOptions {
  samples: number;
  seed?: number;
  confidenceLevel?: number;
}

export interface MonteCarloResult extends UncertaintyResult {
  distribution: number[];
  percentiles: {
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
  histogram: {
    bins: number[];
    counts: number[];
  };
}

/**
 * Monte Carlo uncertainty propagation
 * More accurate than analytical, especially for non-linear functions
 */
export function monteCarloUncertainty(
  f: MultivariateFunction,
  inputs: Measurement[],
  options: MonteCarloOptions = { samples: 10000 },
  inputNames?: string[]
): MonteCarloResult {
  const { samples, seed, confidenceLevel = 0.95 } = options;
  const rng = new SeededRandom(seed);

  const results: number[] = [];

  // Generate random samples
  for (let i = 0; i < samples; i++) {
    const sample = inputs.map((m) => {
      // Assume normal distribution for each input
      return rng.nextNormal(m.value, m.uncertainty);
    });

    try {
      const result = f(sample);
      if (isFinite(result)) {
        results.push(result);
      }
    } catch {
      // Skip invalid samples
    }
  }

  if (results.length === 0) {
    throw new Error('Monte Carlo simulation produced no valid results');
  }

  // Sort for percentile calculation
  results.sort((a, b) => a - b);

  const value = results.reduce((sum, r) => sum + r, 0) / results.length;
  const variance = results.reduce((sum, r) => sum + (r - value) ** 2, 0) / (results.length - 1);
  const uncertainty = Math.sqrt(variance);

  // Compute percentiles
  const getPercentile = (p: number) => {
    const index = Math.floor((p / 100) * results.length);
    return results[index];
  };

  const percentiles = {
    p5: getPercentile(5),
    p25: getPercentile(25),
    p50: getPercentile(50),
    p75: getPercentile(75),
    p95: getPercentile(95),
  };

  // Create histogram
  const nBins = Math.min(50, Math.ceil(Math.sqrt(results.length)));
  const min = Math.min(...results);
  const max = Math.max(...results);
  const binWidth = (max - min) / nBins;

  const bins: number[] = [];
  const counts: number[] = Array(nBins).fill(0);

  for (let i = 0; i < nBins; i++) {
    bins.push(min + i * binWidth);
  }

  for (const result of results) {
    const binIndex = Math.min(Math.floor((result - min) / binWidth), nBins - 1);
    counts[binIndex]++;
  }

  // Compute contributions (sensitivity analysis)
  const contributions = new Map<string, number>();
  for (let paramIdx = 0; paramIdx < inputs.length; paramIdx++) {
    const paramName = inputNames?.[paramIdx] || `x${paramIdx}`;

    // Vary this parameter, hold others constant
    const variedResults: number[] = [];
    for (let i = 0; i < Math.min(1000, samples); i++) {
      const sample = inputs.map((m, idx) =>
        idx === paramIdx ? rng.nextNormal(m.value, m.uncertainty) : m.value
      );

      try {
        const result = f(sample);
        if (isFinite(result)) {
          variedResults.push(result);
        }
      } catch {
        // Skip
      }
    }

    if (variedResults.length > 0) {
      const variedVar = variedResults.reduce(
        (sum, r) => sum + (r - value) ** 2,
        0
      ) / variedResults.length;
      contributions.set(paramName, Math.sqrt(variedVar));
    }
  }

  return {
    value,
    uncertainty,
    contributions,
    method: 'monte-carlo',
    distribution: results,
    percentiles,
    histogram: { bins, counts },
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UNCERTAINTY COMBINING (Type A & Type B)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Combine Type A (statistical) and Type B (systematic) uncertainties
 */
export function combineUncertainties(
  typeA: number,
  typeB: number
): { combined: number; expandedK2: number; expandedK3: number } {
  const combined = Math.sqrt(typeA ** 2 + typeB ** 2);

  return {
    combined,
    expandedK2: 2 * combined, // ~95% confidence
    expandedK3: 3 * combined, // ~99.7% confidence
  };
}

/**
 * Weighted mean with uncertainties
 */
export function weightedMean(measurements: Measurement[]): Measurement {
  let sumWeights = 0;
  let sumWeightedValues = 0;

  for (const m of measurements) {
    const weight = 1 / (m.uncertainty ** 2);
    sumWeights += weight;
    sumWeightedValues += weight * m.value;
  }

  const value = sumWeightedValues / sumWeights;
  const uncertainty = Math.sqrt(1 / sumWeights);

  return {
    value,
    uncertainty,
    type: 'combined',
  };
}

/**
 * Standard uncertainty from repeated measurements (Type A)
 */
export function typeAUncertainty(measurements: number[]): number {
  const n = measurements.length;
  const mean = measurements.reduce((sum, m) => sum + m, 0) / n;
  const variance = measurements.reduce((sum, m) => sum + (m - mean) ** 2, 0) / (n - 1);

  return Math.sqrt(variance / n); // Standard error of the mean
}

/**
 * Type B uncertainty from bounds (rectangular distribution)
 */
export function typeBRectangular(bounds: number): number {
  return bounds / Math.sqrt(3);
}

/**
 * Type B uncertainty from bounds (triangular distribution)
 */
export function typeBTriangular(bounds: number): number {
  return bounds / Math.sqrt(6);
}

/**
 * Type B uncertainty from bounds (U-shaped distribution)
 */
export function typeBUShaped(bounds: number): number {
  return bounds / Math.sqrt(2);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMMON OPERATIONS WITH UNCERTAINTY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Add measurements
 */
export function add(a: Measurement, b: Measurement): Measurement {
  return {
    value: a.value + b.value,
    uncertainty: Math.sqrt(a.uncertainty ** 2 + b.uncertainty ** 2),
    type: 'combined',
  };
}

/**
 * Subtract measurements
 */
export function subtract(a: Measurement, b: Measurement): Measurement {
  return {
    value: a.value - b.value,
    uncertainty: Math.sqrt(a.uncertainty ** 2 + b.uncertainty ** 2),
    type: 'combined',
  };
}

/**
 * Multiply measurements
 */
export function multiply(a: Measurement, b: Measurement): Measurement {
  const value = a.value * b.value;
  const relUncA = a.uncertainty / Math.abs(a.value);
  const relUncB = b.uncertainty / Math.abs(b.value);
  const relUnc = Math.sqrt(relUncA ** 2 + relUncB ** 2);

  return {
    value,
    uncertainty: Math.abs(value) * relUnc,
    type: 'combined',
  };
}

/**
 * Divide measurements
 */
export function divide(a: Measurement, b: Measurement): Measurement {
  const value = a.value / b.value;
  const relUncA = a.uncertainty / Math.abs(a.value);
  const relUncB = b.uncertainty / Math.abs(b.value);
  const relUnc = Math.sqrt(relUncA ** 2 + relUncB ** 2);

  return {
    value,
    uncertainty: Math.abs(value) * relUnc,
    type: 'combined',
  };
}

/**
 * Power (x^n)
 */
export function power(m: Measurement, n: number): Measurement {
  const value = Math.pow(m.value, n);
  const relUnc = Math.abs(n) * (m.uncertainty / Math.abs(m.value));

  return {
    value,
    uncertainty: Math.abs(value) * relUnc,
    type: 'combined',
  };
}

/**
 * Exponential
 */
export function exp(m: Measurement): Measurement {
  const value = Math.exp(m.value);
  const uncertainty = value * m.uncertainty;

  return {
    value,
    uncertainty,
    type: 'combined',
  };
}

/**
 * Natural logarithm
 */
export function log(m: Measurement): Measurement {
  const value = Math.log(m.value);
  const uncertainty = m.uncertainty / Math.abs(m.value);

  return {
    value,
    uncertainty,
    type: 'combined',
  };
}

/**
 * Sine
 */
export function sin(m: Measurement): Measurement {
  const value = Math.sin(m.value);
  const uncertainty = Math.abs(Math.cos(m.value)) * m.uncertainty;

  return {
    value,
    uncertainty,
    type: 'combined',
  };
}

/**
 * Cosine
 */
export function cos(m: Measurement): Measurement {
  const value = Math.cos(m.value);
  const uncertainty = Math.abs(Math.sin(m.value)) * m.uncertainty;

  return {
    value,
    uncertainty,
    type: 'combined',
  };
}
