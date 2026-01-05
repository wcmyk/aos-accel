/**
 * Statistical Inference
 * Features:
 * - Hypothesis testing (t-test, z-test, chi-square, F-test)
 * - Confidence intervals
 * - Effect sizes
 * - Power analysis
 */

import { Vector } from '../types-advanced';
import { mean, variance, standardDeviation } from './distributions';
import { createVector } from '../math/linalg';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATISTICAL DISTRIBUTIONS (Critical Values)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Standard normal CDF (Φ)
 */
function normalCDF(z: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = z >= 0 ? 1 : -1;
  const x = Math.abs(z) / Math.sqrt(2);

  const t = 1 / (1 + p * x);
  const erf =
    1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1 + sign * erf);
}

/**
 * Standard normal PDF (φ)
 */
function normalPDF(z: number): number {
  return Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI);
}

/**
 * Inverse normal CDF (approximation)
 */
function normalInverseCDF(p: number): number {
  if (p <= 0 || p >= 1) {
    throw new Error('Probability must be between 0 and 1');
  }

  // Rational approximation for central region
  const c0 = 2.515517;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;

  const q = p < 0.5 ? p : 1 - p;
  const t = Math.sqrt(-2 * Math.log(q));

  const numerator = c0 + c1 * t + c2 * t * t;
  const denominator = 1 + d1 * t + d2 * t * t + d3 * t * t * t;

  const z = t - numerator / denominator;

  return p < 0.5 ? -z : z;
}

/**
 * t-distribution CDF (approximation using Cornish-Fisher expansion)
 */
function tCDF(t: number, df: number): number {
  if (df > 30) {
    // Use normal approximation for large df
    return normalCDF(t);
  }

  // For small df, use numerical integration (simplified)
  // This is a rough approximation - real implementation would use betainc
  const x = df / (df + t * t);
  return 1 - 0.5 * betaIncomplete(df / 2, 0.5, x);
}

/**
 * Incomplete beta function (simplified approximation)
 */
function betaIncomplete(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  // Continued fraction approximation (simplified)
  let result = Math.pow(x, a) * Math.pow(1 - x, b) / a;
  let term = result;

  for (let i = 1; i < 100; i++) {
    term *= ((a + b + i - 1) * x) / (a + i);
    result += term;
    if (Math.abs(term) < 1e-10) break;
  }

  return result;
}

/**
 * t-distribution inverse CDF (critical values)
 */
function tInverseCDF(p: number, df: number): number {
  if (df > 30) {
    return normalInverseCDF(p);
  }

  // Approximation for t-distribution quantiles
  const z = normalInverseCDF(p);
  const g1 = (z * z * z + z) / 4;
  const g2 = (5 * z ** 5 + 16 * z ** 3 + 3 * z) / 96;
  const g3 = (3 * z ** 7 + 19 * z ** 5 + 17 * z ** 3 - 15 * z) / 384;

  return z + g1 / df + g2 / (df * df) + g3 / (df ** 3);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HYPOTHESIS TESTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface TestResult {
  statistic: number;
  pValue: number;
  significant: boolean;
  alpha: number;
  method: string;
}

/**
 * One-sample t-test
 */
export function oneSampleTTest(
  data: Vector,
  mu0: number,
  alpha: number = 0.05,
  alternative: 'two-sided' | 'less' | 'greater' = 'two-sided'
): TestResult {
  const n = data.length;
  const xBar = mean(data);
  const s = standardDeviation(data);

  const t = (xBar - mu0) / (s / Math.sqrt(n));
  const df = n - 1;

  let pValue: number;
  if (alternative === 'two-sided') {
    pValue = 2 * (1 - tCDF(Math.abs(t), df));
  } else if (alternative === 'less') {
    pValue = tCDF(t, df);
  } else {
    pValue = 1 - tCDF(t, df);
  }

  return {
    statistic: t,
    pValue,
    significant: pValue < alpha,
    alpha,
    method: 'One-sample t-test',
  };
}

/**
 * Two-sample t-test (independent samples)
 */
export function twoSampleTTest(
  data1: Vector,
  data2: Vector,
  alpha: number = 0.05,
  equalVariance: boolean = true
): TestResult {
  const n1 = data1.length;
  const n2 = data2.length;
  const mean1 = mean(data1);
  const mean2 = mean(data2);
  const var1 = variance(data1);
  const var2 = variance(data2);

  let t: number;
  let df: number;

  if (equalVariance) {
    // Pooled variance
    const pooledVar = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
    t = (mean1 - mean2) / Math.sqrt(pooledVar * (1 / n1 + 1 / n2));
    df = n1 + n2 - 2;
  } else {
    // Welch's t-test
    t = (mean1 - mean2) / Math.sqrt(var1 / n1 + var2 / n2);
    const numerator = (var1 / n1 + var2 / n2) ** 2;
    const denominator = var1 ** 2 / (n1 ** 2 * (n1 - 1)) + var2 ** 2 / (n2 ** 2 * (n2 - 1));
    df = numerator / denominator;
  }

  const pValue = 2 * (1 - tCDF(Math.abs(t), df));

  return {
    statistic: t,
    pValue,
    significant: pValue < alpha,
    alpha,
    method: equalVariance ? "Student's t-test" : "Welch's t-test",
  };
}

/**
 * Paired t-test
 */
export function pairedTTest(
  data1: Vector,
  data2: Vector,
  alpha: number = 0.05
): TestResult {
  if (data1.length !== data2.length) {
    throw new Error('Paired data must have same length');
  }

  const differences = data1.data.map((x, i) => x - data2.data[i]);
  const diffVector = createVector(differences);

  return oneSampleTTest(diffVector, 0, alpha);
}

/**
 * Z-test (known variance)
 */
export function zTest(
  data: Vector,
  mu0: number,
  sigma: number,
  alpha: number = 0.05,
  alternative: 'two-sided' | 'less' | 'greater' = 'two-sided'
): TestResult {
  const n = data.length;
  const xBar = mean(data);

  const z = (xBar - mu0) / (sigma / Math.sqrt(n));

  let pValue: number;
  if (alternative === 'two-sided') {
    pValue = 2 * (1 - normalCDF(Math.abs(z)));
  } else if (alternative === 'less') {
    pValue = normalCDF(z);
  } else {
    pValue = 1 - normalCDF(z);
  }

  return {
    statistic: z,
    pValue,
    significant: pValue < alpha,
    alpha,
    method: 'Z-test',
  };
}

/**
 * Chi-square goodness of fit test
 */
export function chiSquareTest(
  observed: Vector,
  expected: Vector,
  alpha: number = 0.05
): TestResult {
  if (observed.length !== expected.length) {
    throw new Error('Observed and expected must have same length');
  }

  let chiSquare = 0;
  for (let i = 0; i < observed.length; i++) {
    const diff = observed.data[i] - expected.data[i];
    chiSquare += (diff * diff) / expected.data[i];
  }

  const df = observed.length - 1;

  // Chi-square CDF approximation (using gamma distribution relationship)
  const pValue = 1 - gammaIncomplete(df / 2, chiSquare / 2);

  return {
    statistic: chiSquare,
    pValue,
    significant: pValue < alpha,
    alpha,
    method: 'Chi-square goodness of fit',
  };
}

/**
 * Incomplete gamma function (simplified)
 */
function gammaIncomplete(a: number, x: number): number {
  if (x <= 0) return 0;

  let sum = 0;
  let term = 1 / a;

  for (let i = 0; i < 100; i++) {
    sum += term;
    term *= x / (a + i + 1);
    if (Math.abs(term) < 1e-10) break;
  }

  return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
}

/**
 * Log gamma function (Stirling's approximation)
 */
function logGamma(x: number): number {
  const g = 7;
  const coef = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];

  if (x < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * x)) - logGamma(1 - x);
  }

  x -= 1;
  let a = coef[0];
  for (let i = 1; i < g + 2; i++) {
    a += coef[i] / (x + i);
  }

  const t = x + g + 0.5;
  return Math.log(Math.sqrt(2 * Math.PI)) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIDENCE INTERVALS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  confidence: number;
  method: string;
}

/**
 * Confidence interval for mean (t-distribution)
 */
export function meanConfidenceInterval(
  data: Vector,
  confidence: number = 0.95
): ConfidenceInterval {
  const n = data.length;
  const xBar = mean(data);
  const s = standardDeviation(data);
  const df = n - 1;

  const alpha = 1 - confidence;
  const tCrit = tInverseCDF(1 - alpha / 2, df);

  const margin = tCrit * (s / Math.sqrt(n));

  return {
    lower: xBar - margin,
    upper: xBar + margin,
    confidence,
    method: 't-interval',
  };
}

/**
 * Confidence interval for proportion
 */
export function proportionConfidenceInterval(
  successes: number,
  trials: number,
  confidence: number = 0.95
): ConfidenceInterval {
  const p = successes / trials;
  const alpha = 1 - confidence;
  const zCrit = normalInverseCDF(1 - alpha / 2);

  const se = Math.sqrt((p * (1 - p)) / trials);
  const margin = zCrit * se;

  return {
    lower: Math.max(0, p - margin),
    upper: Math.min(1, p + margin),
    confidence,
    method: 'Normal approximation',
  };
}

/**
 * Confidence interval for variance (chi-square)
 */
export function varianceConfidenceInterval(
  data: Vector,
  confidence: number = 0.95
): ConfidenceInterval {
  const n = data.length;
  const s2 = variance(data);
  const df = n - 1;

  const alpha = 1 - confidence;

  // Chi-square critical values (approximation)
  const chiLower = df * (1 - 2 / (9 * df) - normalInverseCDF(1 - alpha / 2) * Math.sqrt(2 / (9 * df))) ** 3;
  const chiUpper = df * (1 - 2 / (9 * df) + normalInverseCDF(1 - alpha / 2) * Math.sqrt(2 / (9 * df))) ** 3;

  return {
    lower: (df * s2) / chiUpper,
    upper: (df * s2) / chiLower,
    confidence,
    method: 'Chi-square interval',
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EFFECT SIZES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Cohen's d (standardized mean difference)
 */
export function cohensD(data1: Vector, data2: Vector): number {
  const mean1 = mean(data1);
  const mean2 = mean(data2);
  const var1 = variance(data1);
  const var2 = variance(data2);
  const n1 = data1.length;
  const n2 = data2.length;

  const pooledSD = Math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2));

  return (mean1 - mean2) / pooledSD;
}

/**
 * Pearson correlation coefficient
 */
export function correlation(data1: Vector, data2: Vector): number {
  if (data1.length !== data2.length) {
    throw new Error('Data must have same length');
  }

  const n = data1.length;
  const mean1 = mean(data1);
  const mean2 = mean(data2);

  let numerator = 0;
  let sumSq1 = 0;
  let sumSq2 = 0;

  for (let i = 0; i < n; i++) {
    const diff1 = data1.data[i] - mean1;
    const diff2 = data2.data[i] - mean2;
    numerator += diff1 * diff2;
    sumSq1 += diff1 * diff1;
    sumSq2 += diff2 * diff2;
  }

  return numerator / Math.sqrt(sumSq1 * sumSq2);
}

/**
 * R-squared (coefficient of determination)
 */
export function rSquared(observed: Vector, predicted: Vector): number {
  if (observed.length !== predicted.length) {
    throw new Error('Observed and predicted must have same length');
  }

  const yBar = mean(observed);
  let ssTotal = 0;
  let ssResidual = 0;

  for (let i = 0; i < observed.length; i++) {
    ssTotal += (observed.data[i] - yBar) ** 2;
    ssResidual += (observed.data[i] - predicted.data[i]) ** 2;
  }

  return 1 - ssResidual / ssTotal;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POWER ANALYSIS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Required sample size for t-test
 */
export function sampleSizeForTTest(
  effectSize: number,
  alpha: number = 0.05,
  power: number = 0.8,
  alternative: 'two-sided' | 'one-sided' = 'two-sided'
): number {
  const zAlpha = alternative === 'two-sided'
    ? normalInverseCDF(1 - alpha / 2)
    : normalInverseCDF(1 - alpha);

  const zBeta = normalInverseCDF(power);

  const n = 2 * ((zAlpha + zBeta) / effectSize) ** 2;

  return Math.ceil(n);
}

/**
 * Statistical power for t-test
 */
export function powerForTTest(
  effectSize: number,
  sampleSize: number,
  alpha: number = 0.05,
  alternative: 'two-sided' | 'one-sided' = 'two-sided'
): number {
  const zAlpha = alternative === 'two-sided'
    ? normalInverseCDF(1 - alpha / 2)
    : normalInverseCDF(1 - alpha);

  const ncp = effectSize * Math.sqrt(sampleSize / 2); // Non-centrality parameter
  const zBeta = ncp - zAlpha;

  return normalCDF(zBeta);
}
