/**
 * Optimization Algorithms
 * Features:
 * - Gradient Descent (vanilla, momentum, Nesterov)
 * - Adam optimizer
 * - RMSprop
 * - Learning rate schedules
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BASE OPTIMIZER INTERFACE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface Optimizer {
  update(params: number[], gradients: number[]): number[];
  reset(): void;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GRADIENT DESCENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class GradientDescentOptimizer implements Optimizer {
  private learningRate: number;
  private momentum: number;
  private velocity: Map<number, number> = new Map();
  private nesterov: boolean;

  constructor(
    learningRate: number = 0.01,
    momentum: number = 0,
    nesterov: boolean = false
  ) {
    this.learningRate = learningRate;
    this.momentum = momentum;
    this.nesterov = nesterov;
  }

  update(params: number[], gradients: number[]): number[] {
    const updated = [...params];

    for (let i = 0; i < params.length; i++) {
      if (this.momentum > 0) {
        // Momentum or Nesterov momentum
        const v = (this.velocity.get(i) || 0) * this.momentum + gradients[i];
        this.velocity.set(i, v);

        if (this.nesterov) {
          // Nesterov: look ahead
          updated[i] -= this.learningRate * (this.momentum * v + gradients[i]);
        } else {
          // Standard momentum
          updated[i] -= this.learningRate * v;
        }
      } else {
        // Vanilla gradient descent
        updated[i] -= this.learningRate * gradients[i];
      }
    }

    return updated;
  }

  reset(): void {
    this.velocity.clear();
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADAM OPTIMIZER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class AdamOptimizer implements Optimizer {
  private learningRate: number;
  private beta1: number;
  private beta2: number;
  private epsilon: number;
  private m: Map<number, number> = new Map(); // First moment estimate
  private v: Map<number, number> = new Map(); // Second moment estimate
  private t: number = 0; // Time step

  constructor(
    learningRate: number = 0.001,
    beta1: number = 0.9,
    beta2: number = 0.999,
    epsilon: number = 1e-8
  ) {
    this.learningRate = learningRate;
    this.beta1 = beta1;
    this.beta2 = beta2;
    this.epsilon = epsilon;
  }

  update(params: number[], gradients: number[]): number[] {
    this.t++;
    const updated = [...params];

    for (let i = 0; i < params.length; i++) {
      // Update biased first moment estimate
      const mPrev = this.m.get(i) || 0;
      const mCurr = this.beta1 * mPrev + (1 - this.beta1) * gradients[i];
      this.m.set(i, mCurr);

      // Update biased second moment estimate
      const vPrev = this.v.get(i) || 0;
      const vCurr = this.beta2 * vPrev + (1 - this.beta2) * gradients[i] ** 2;
      this.v.set(i, vCurr);

      // Compute bias-corrected moment estimates
      const mHat = mCurr / (1 - Math.pow(this.beta1, this.t));
      const vHat = vCurr / (1 - Math.pow(this.beta2, this.t));

      // Update parameters
      updated[i] -= (this.learningRate * mHat) / (Math.sqrt(vHat) + this.epsilon);
    }

    return updated;
  }

  reset(): void {
    this.m.clear();
    this.v.clear();
    this.t = 0;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RMSPROP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class RMSpropOptimizer implements Optimizer {
  private learningRate: number;
  private decay: number;
  private epsilon: number;
  private cache: Map<number, number> = new Map();

  constructor(learningRate: number = 0.001, decay: number = 0.9, epsilon: number = 1e-8) {
    this.learningRate = learningRate;
    this.decay = decay;
    this.epsilon = epsilon;
  }

  update(params: number[], gradients: number[]): number[] {
    const updated = [...params];

    for (let i = 0; i < params.length; i++) {
      // Update cache (exponential moving average of squared gradients)
      const cachePrev = this.cache.get(i) || 0;
      const cacheCurr = this.decay * cachePrev + (1 - this.decay) * gradients[i] ** 2;
      this.cache.set(i, cacheCurr);

      // Update parameters
      updated[i] -= (this.learningRate * gradients[i]) / (Math.sqrt(cacheCurr) + this.epsilon);
    }

    return updated;
  }

  reset(): void {
    this.cache.clear();
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADAGRAD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class AdagradOptimizer implements Optimizer {
  private learningRate: number;
  private epsilon: number;
  private cache: Map<number, number> = new Map();

  constructor(learningRate: number = 0.01, epsilon: number = 1e-8) {
    this.learningRate = learningRate;
    this.epsilon = epsilon;
  }

  update(params: number[], gradients: number[]): number[] {
    const updated = [...params];

    for (let i = 0; i < params.length; i++) {
      // Accumulate squared gradients
      const cachePrev = this.cache.get(i) || 0;
      const cacheCurr = cachePrev + gradients[i] ** 2;
      this.cache.set(i, cacheCurr);

      // Update parameters with adaptive learning rate
      updated[i] -= (this.learningRate * gradients[i]) / (Math.sqrt(cacheCurr) + this.epsilon);
    }

    return updated;
  }

  reset(): void {
    this.cache.clear();
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LEARNING RATE SCHEDULES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface LearningRateSchedule {
  getLearningRate(epoch: number): number;
}

/**
 * Step decay: Reduce LR by factor every N epochs
 */
export class StepDecaySchedule implements LearningRateSchedule {
  private initialLR: number;
  private decayFactor: number;
  private decayEpochs: number;

  constructor(initialLR: number, decayFactor: number = 0.5, decayEpochs: number = 10) {
    this.initialLR = initialLR;
    this.decayFactor = decayFactor;
    this.decayEpochs = decayEpochs;
  }

  getLearningRate(epoch: number): number {
    const drops = Math.floor(epoch / this.decayEpochs);
    return this.initialLR * Math.pow(this.decayFactor, drops);
  }
}

/**
 * Exponential decay: LR = initial * exp(-decay * epoch)
 */
export class ExponentialDecaySchedule implements LearningRateSchedule {
  private initialLR: number;
  private decayRate: number;

  constructor(initialLR: number, decayRate: number = 0.01) {
    this.initialLR = initialLR;
    this.decayRate = decayRate;
  }

  getLearningRate(epoch: number): number {
    return this.initialLR * Math.exp(-this.decayRate * epoch);
  }
}

/**
 * Cosine annealing: Smooth decay following cosine curve
 */
export class CosineAnnealingSchedule implements LearningRateSchedule {
  private initialLR: number;
  private minLR: number;
  private totalEpochs: number;

  constructor(initialLR: number, totalEpochs: number, minLR: number = 0) {
    this.initialLR = initialLR;
    this.totalEpochs = totalEpochs;
    this.minLR = minLR;
  }

  getLearningRate(epoch: number): number {
    const progress = Math.min(epoch / this.totalEpochs, 1);
    const cosineDecay = 0.5 * (1 + Math.cos(Math.PI * progress));
    return this.minLR + (this.initialLR - this.minLR) * cosineDecay;
  }
}

/**
 * Polynomial decay: LR = initial * (1 - epoch/total)^power
 */
export class PolynomialDecaySchedule implements LearningRateSchedule {
  private initialLR: number;
  private totalEpochs: number;
  private power: number;
  private minLR: number;

  constructor(initialLR: number, totalEpochs: number, power: number = 1, minLR: number = 0) {
    this.initialLR = initialLR;
    this.totalEpochs = totalEpochs;
    this.power = power;
    this.minLR = minLR;
  }

  getLearningRate(epoch: number): number {
    const progress = Math.min(epoch / this.totalEpochs, 1);
    const decay = Math.pow(1 - progress, this.power);
    return this.minLR + (this.initialLR - this.minLR) * decay;
  }
}

/**
 * Warm-up + decay schedule
 */
export class WarmupSchedule implements LearningRateSchedule {
  private initialLR: number;
  private warmupEpochs: number;
  private baseSchedule: LearningRateSchedule;

  constructor(initialLR: number, warmupEpochs: number, baseSchedule: LearningRateSchedule) {
    this.initialLR = initialLR;
    this.warmupEpochs = warmupEpochs;
    this.baseSchedule = baseSchedule;
  }

  getLearningRate(epoch: number): number {
    if (epoch < this.warmupEpochs) {
      // Linear warmup
      return (this.initialLR * (epoch + 1)) / this.warmupEpochs;
    } else {
      // Base schedule after warmup
      return this.baseSchedule.getLearningRate(epoch - this.warmupEpochs);
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GRADIENT CLIPPING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Clip gradients by value
 */
export function clipGradientsByValue(gradients: number[], clipValue: number): number[] {
  return gradients.map((g) => Math.max(-clipValue, Math.min(clipValue, g)));
}

/**
 * Clip gradients by norm
 */
export function clipGradientsByNorm(gradients: number[], maxNorm: number): number[] {
  const norm = Math.sqrt(gradients.reduce((sum, g) => sum + g * g, 0));

  if (norm > maxNorm) {
    const scale = maxNorm / norm;
    return gradients.map((g) => g * scale);
  }

  return gradients;
}

/**
 * Clip gradients by global norm (for multiple parameter groups)
 */
export function clipGradientsByGlobalNorm(
  gradientGroups: number[][],
  maxNorm: number
): number[][] {
  // Compute global norm
  let globalNormSq = 0;
  for (const grads of gradientGroups) {
    globalNormSq += grads.reduce((sum, g) => sum + g * g, 0);
  }
  const globalNorm = Math.sqrt(globalNormSq);

  if (globalNorm > maxNorm) {
    const scale = maxNorm / globalNorm;
    return gradientGroups.map((grads) => grads.map((g) => g * scale));
  }

  return gradientGroups;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OPTIMIZER WITH SCHEDULE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Wrapper that applies learning rate schedule to any optimizer
 */
export class ScheduledOptimizer implements Optimizer {
  private baseOptimizer: Optimizer;
  private schedule: LearningRateSchedule;
  private epoch: number = 0;

  constructor(baseOptimizer: Optimizer, schedule: LearningRateSchedule) {
    this.baseOptimizer = baseOptimizer;
    this.schedule = schedule;
  }

  update(params: number[], gradients: number[]): number[] {
    // Update learning rate based on schedule
    const lr = this.schedule.getLearningRate(this.epoch);

    // Update base optimizer's learning rate
    if (this.baseOptimizer instanceof GradientDescentOptimizer) {
      (this.baseOptimizer as any).learningRate = lr;
    } else if (this.baseOptimizer instanceof AdamOptimizer) {
      (this.baseOptimizer as any).learningRate = lr;
    } else if (this.baseOptimizer instanceof RMSpropOptimizer) {
      (this.baseOptimizer as any).learningRate = lr;
    } else if (this.baseOptimizer instanceof AdagradOptimizer) {
      (this.baseOptimizer as any).learningRate = lr;
    }

    return this.baseOptimizer.update(params, gradients);
  }

  stepEpoch(): void {
    this.epoch++;
  }

  reset(): void {
    this.baseOptimizer.reset();
    this.epoch = 0;
  }
}
