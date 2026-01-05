/**
 * Statistical Distributions (First-class objects, not just functions)
 * Supports sampling, PDF, CDF, and uncertainty propagation
 */

import { Distribution, RandomVariable, Vector } from '../types-advanced';
import { createVector } from '../math/linalg';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RANDOM NUMBER GENERATOR (Seeded for reproducibility)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class SeededRandom {
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed;
  }

  /**
   * Linear congruential generator
   */
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  /**
   * Normal distribution using Box-Muller transform
   */
  nextNormal(mu: number = 0, sigma: number = 1): number {
    const u1 = this.next();
    const u2 = this.next();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * sigma + mu;
  }

  setSeed(seed: number): void {
    this.seed = seed;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DISTRIBUTION INTERFACE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface DistributionMethods {
  sample(rng: SeededRandom): number;
  pdf(x: number): number;
  cdf(x: number): number;
  mean(): number;
  variance(): number;
  stddev(): number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NORMAL DISTRIBUTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class NormalDistribution implements DistributionMethods {
  constructor(
    public mu: number,
    public sigma: number
  ) {
    if (sigma <= 0) {
      throw new Error('Sigma must be positive');
    }
  }

  sample(rng: SeededRandom): number {
    return rng.nextNormal(this.mu, this.sigma);
  }

  pdf(x: number): number {
    const exponent = -0.5 * Math.pow((x - this.mu) / this.sigma, 2);
    return (1 / (this.sigma * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);
  }

  cdf(x: number): number {
    // Approximation using error function
    const z = (x - this.mu) / (this.sigma * Math.sqrt(2));
    return 0.5 * (1 + erf(z));
  }

  mean(): number {
    return this.mu;
  }

  variance(): number {
    return this.sigma * this.sigma;
  }

  stddev(): number {
    return this.sigma;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UNIFORM DISTRIBUTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class UniformDistribution implements DistributionMethods {
  constructor(
    public min: number,
    public max: number
  ) {
    if (max <= min) {
      throw new Error('Max must be greater than min');
    }
  }

  sample(rng: SeededRandom): number {
    return this.min + rng.next() * (this.max - this.min);
  }

  pdf(x: number): number {
    if (x < this.min || x > this.max) return 0;
    return 1 / (this.max - this.min);
  }

  cdf(x: number): number {
    if (x < this.min) return 0;
    if (x > this.max) return 1;
    return (x - this.min) / (this.max - this.min);
  }

  mean(): number {
    return (this.min + this.max) / 2;
  }

  variance(): number {
    return Math.pow(this.max - this.min, 2) / 12;
  }

  stddev(): number {
    return Math.sqrt(this.variance());
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPONENTIAL DISTRIBUTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class ExponentialDistribution implements DistributionMethods {
  constructor(public lambda: number) {
    if (lambda <= 0) {
      throw new Error('Lambda must be positive');
    }
  }

  sample(rng: SeededRandom): number {
    return -Math.log(1 - rng.next()) / this.lambda;
  }

  pdf(x: number): number {
    if (x < 0) return 0;
    return this.lambda * Math.exp(-this.lambda * x);
  }

  cdf(x: number): number {
    if (x < 0) return 0;
    return 1 - Math.exp(-this.lambda * x);
  }

  mean(): number {
    return 1 / this.lambda;
  }

  variance(): number {
    return 1 / (this.lambda * this.lambda);
  }

  stddev(): number {
    return 1 / this.lambda;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BINOMIAL DISTRIBUTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class BinomialDistribution implements DistributionMethods {
  constructor(
    public n: number,
    public p: number
  ) {
    if (n < 0 || !Number.isInteger(n)) {
      throw new Error('n must be a non-negative integer');
    }
    if (p < 0 || p > 1) {
      throw new Error('p must be between 0 and 1');
    }
  }

  sample(rng: SeededRandom): number {
    let successes = 0;
    for (let i = 0; i < this.n; i++) {
      if (rng.next() < this.p) {
        successes++;
      }
    }
    return successes;
  }

  pdf(k: number): number {
    if (k < 0 || k > this.n || !Number.isInteger(k)) return 0;
    return binomialCoefficient(this.n, k) * Math.pow(this.p, k) * Math.pow(1 - this.p, this.n - k);
  }

  cdf(k: number): number {
    if (k < 0) return 0;
    if (k >= this.n) return 1;

    let sum = 0;
    for (let i = 0; i <= Math.floor(k); i++) {
      sum += this.pdf(i);
    }
    return sum;
  }

  mean(): number {
    return this.n * this.p;
  }

  variance(): number {
    return this.n * this.p * (1 - this.p);
  }

  stddev(): number {
    return Math.sqrt(this.variance());
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POISSON DISTRIBUTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class PoissonDistribution implements DistributionMethods {
  constructor(public lambda: number) {
    if (lambda <= 0) {
      throw new Error('Lambda must be positive');
    }
  }

  sample(rng: SeededRandom): number {
    // Knuth's algorithm
    const L = Math.exp(-this.lambda);
    let k = 0;
    let p = 1;

    do {
      k++;
      p *= rng.next();
    } while (p > L);

    return k - 1;
  }

  pdf(k: number): number {
    if (k < 0 || !Number.isInteger(k)) return 0;
    return (Math.pow(this.lambda, k) * Math.exp(-this.lambda)) / factorial(k);
  }

  cdf(k: number): number {
    if (k < 0) return 0;

    let sum = 0;
    for (let i = 0; i <= Math.floor(k); i++) {
      sum += this.pdf(i);
    }
    return sum;
  }

  mean(): number {
    return this.lambda;
  }

  variance(): number {
    return this.lambda;
  }

  stddev(): number {
    return Math.sqrt(this.lambda);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RANDOM VARIABLE CLASS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class RandomVariableClass {
  private distribution: DistributionMethods;
  private rng: SeededRandom;

  constructor(distribution: Distribution, seed?: number) {
    this.distribution = this.createDistribution(distribution);
    this.rng = new SeededRandom(seed);
  }

  private createDistribution(dist: Distribution): DistributionMethods {
    switch (dist.type) {
      case 'normal':
        return new NormalDistribution(dist.mu, dist.sigma);
      case 'uniform':
        return new UniformDistribution(dist.min, dist.max);
      case 'exponential':
        return new ExponentialDistribution(dist.lambda);
      case 'binomial':
        return new BinomialDistribution(dist.n, dist.p);
      case 'poisson':
        return new PoissonDistribution(dist.lambda);
      default:
        throw new Error(`Unknown distribution type: ${(dist as any).type}`);
    }
  }

  sample(): number {
    return this.distribution.sample(this.rng);
  }

  samples(n: number): Vector {
    const data = [];
    for (let i = 0; i < n; i++) {
      data.push(this.sample());
    }
    return createVector(data);
  }

  pdf(x: number): number {
    return this.distribution.pdf(x);
  }

  cdf(x: number): number {
    return this.distribution.cdf(x);
  }

  mean(): number {
    return this.distribution.mean();
  }

  variance(): number {
    return this.distribution.variance();
  }

  stddev(): number {
    return this.distribution.stddev();
  }

  setSeed(seed: number): void {
    this.rng.setSeed(seed);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function factorial(n: number): number {
  if (n === 0 || n === 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

function binomialCoefficient(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;

  // Use multiplicative formula
  let result = 1;
  for (let i = 0; i < k; i++) {
    result *= (n - i) / (i + 1);
  }
  return Math.round(result);
}

/**
 * Error function (erf) approximation
 */
function erf(x: number): number {
  // Abramowitz and Stegun approximation
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

/**
 * Inverse error function (for quantiles)
 */
export function erfInv(x: number): number {
  if (x < -1 || x > 1) {
    throw new Error('erfInv input must be in [-1, 1]');
  }

  // Approximation (rational approximation)
  const a = 0.147;
  const b = 2 / (Math.PI * a) + Math.log(1 - x * x) / 2;
  const sign = x >= 0 ? 1 : -1;

  return sign * Math.sqrt(Math.sqrt(b * b - Math.log(1 - x * x) / a) - b);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATISTICAL HELPERS FOR VECTORS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Compute mean of a vector
 */
export function mean(v: Vector): number {
  return v.data.reduce((sum, x) => sum + x, 0) / v.length;
}

/**
 * Compute variance of a vector (sample variance)
 */
export function variance(v: Vector): number {
  const m = mean(v);
  return v.data.reduce((sum, x) => sum + (x - m) ** 2, 0) / (v.length - 1);
}

/**
 * Compute standard deviation of a vector
 */
export function standardDeviation(v: Vector): number {
  return Math.sqrt(variance(v));
}
