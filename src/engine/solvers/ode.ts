/**
 * Ordinary Differential Equation Solvers
 * Features:
 * - Euler method
 * - Runge-Kutta methods (RK2, RK4)
 * - Adaptive step size
 * - Systems of ODEs
 * - Boundary value problems
 */

import { Vector } from '../types-advanced';
import { createVector } from '../math/linalg';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type ODEFunction = (t: number, y: number) => number;
export type ODESystemFunction = (t: number, y: number[]) => number[];

export interface ODESolution {
  t: number[];
  y: number[];
}

export interface ODESystemSolution {
  t: number[];
  y: number[][];
}

export interface SolverOptions {
  method?: 'euler' | 'rk2' | 'rk4' | 'adaptive';
  stepSize?: number;
  tolerance?: number;
  maxSteps?: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SINGLE ODE SOLVERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Euler's method: y_{n+1} = y_n + h f(t_n, y_n)
 */
export function eulerMethod(
  f: ODEFunction,
  t0: number,
  y0: number,
  tFinal: number,
  h: number = 0.01
): ODESolution {
  const t: number[] = [t0];
  const y: number[] = [y0];

  let tCurrent = t0;
  let yCurrent = y0;

  while (tCurrent < tFinal) {
    const stepSize = Math.min(h, tFinal - tCurrent);
    const dydt = f(tCurrent, yCurrent);

    yCurrent += stepSize * dydt;
    tCurrent += stepSize;

    t.push(tCurrent);
    y.push(yCurrent);
  }

  return { t, y };
}

/**
 * Runge-Kutta 2nd order (Midpoint method)
 */
export function rk2Method(
  f: ODEFunction,
  t0: number,
  y0: number,
  tFinal: number,
  h: number = 0.01
): ODESolution {
  const t: number[] = [t0];
  const y: number[] = [y0];

  let tCurrent = t0;
  let yCurrent = y0;

  while (tCurrent < tFinal) {
    const stepSize = Math.min(h, tFinal - tCurrent);

    const k1 = f(tCurrent, yCurrent);
    const k2 = f(tCurrent + stepSize / 2, yCurrent + (stepSize / 2) * k1);

    yCurrent += stepSize * k2;
    tCurrent += stepSize;

    t.push(tCurrent);
    y.push(yCurrent);
  }

  return { t, y };
}

/**
 * Runge-Kutta 4th order (RK4)
 */
export function rk4Method(
  f: ODEFunction,
  t0: number,
  y0: number,
  tFinal: number,
  h: number = 0.01
): ODESolution {
  const t: number[] = [t0];
  const y: number[] = [y0];

  let tCurrent = t0;
  let yCurrent = y0;

  while (tCurrent < tFinal) {
    const stepSize = Math.min(h, tFinal - tCurrent);

    const k1 = f(tCurrent, yCurrent);
    const k2 = f(tCurrent + stepSize / 2, yCurrent + (stepSize / 2) * k1);
    const k3 = f(tCurrent + stepSize / 2, yCurrent + (stepSize / 2) * k2);
    const k4 = f(tCurrent + stepSize, yCurrent + stepSize * k3);

    yCurrent += (stepSize / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    tCurrent += stepSize;

    t.push(tCurrent);
    y.push(yCurrent);
  }

  return { t, y };
}

/**
 * Adaptive Runge-Kutta (RK45 - Dormand-Prince)
 */
export function adaptiveRK(
  f: ODEFunction,
  t0: number,
  y0: number,
  tFinal: number,
  options: { tolerance?: number; initialStep?: number; maxSteps?: number } = {}
): ODESolution {
  const { tolerance = 1e-6, initialStep = 0.01, maxSteps = 10000 } = options;

  const t: number[] = [t0];
  const y: number[] = [y0];

  let tCurrent = t0;
  let yCurrent = y0;
  let h = initialStep;
  let steps = 0;

  while (tCurrent < tFinal && steps < maxSteps) {
    // RK4 step
    const k1 = f(tCurrent, yCurrent);
    const k2 = f(tCurrent + h / 2, yCurrent + (h / 2) * k1);
    const k3 = f(tCurrent + h / 2, yCurrent + (h / 2) * k2);
    const k4 = f(tCurrent + h, yCurrent + h * k3);

    const yNext4 = yCurrent + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);

    // RK5 step (for error estimation)
    const k5 = f(tCurrent + h, yNext4);
    const yNext5 = yCurrent + (h / 90) * (7 * k1 + 32 * k2 + 12 * k3 + 32 * k4 + 7 * k5);

    // Error estimate
    const error = Math.abs(yNext5 - yNext4);

    if (error <= tolerance || h < 1e-12) {
      // Accept step
      yCurrent = yNext4;
      tCurrent += h;

      t.push(tCurrent);
      y.push(yCurrent);
      steps++;
    }

    // Adjust step size
    if (error > 0) {
      h *= 0.9 * Math.pow(tolerance / error, 0.2);
    } else {
      h *= 2;
    }

    h = Math.max(1e-12, Math.min(h, tFinal - tCurrent));
  }

  return { t, y };
}

/**
 * General ODE solver (chooses method based on options)
 */
export function solveODE(
  f: ODEFunction,
  t0: number,
  y0: number,
  tFinal: number,
  options: SolverOptions = {}
): ODESolution {
  const { method = 'rk4', stepSize = 0.01, tolerance = 1e-6 } = options;

  switch (method) {
    case 'euler':
      return eulerMethod(f, t0, y0, tFinal, stepSize);
    case 'rk2':
      return rk2Method(f, t0, y0, tFinal, stepSize);
    case 'rk4':
      return rk4Method(f, t0, y0, tFinal, stepSize);
    case 'adaptive':
      return adaptiveRK(f, t0, y0, tFinal, { tolerance, initialStep: stepSize });
    default:
      return rk4Method(f, t0, y0, tFinal, stepSize);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SYSTEMS OF ODEs
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Euler method for systems
 */
export function eulerMethodSystem(
  f: ODESystemFunction,
  t0: number,
  y0: number[],
  tFinal: number,
  h: number = 0.01
): ODESystemSolution {
  const t: number[] = [t0];
  const y: number[][] = [y0];

  let tCurrent = t0;
  let yCurrent = [...y0];

  while (tCurrent < tFinal) {
    const stepSize = Math.min(h, tFinal - tCurrent);
    const dydt = f(tCurrent, yCurrent);

    yCurrent = yCurrent.map((yi, i) => yi + stepSize * dydt[i]);
    tCurrent += stepSize;

    t.push(tCurrent);
    y.push([...yCurrent]);
  }

  return { t, y };
}

/**
 * RK4 method for systems
 */
export function rk4MethodSystem(
  f: ODESystemFunction,
  t0: number,
  y0: number[],
  tFinal: number,
  h: number = 0.01
): ODESystemSolution {
  const t: number[] = [t0];
  const y: number[][] = [y0];

  let tCurrent = t0;
  let yCurrent = [...y0];
  const n = y0.length;

  while (tCurrent < tFinal) {
    const stepSize = Math.min(h, tFinal - tCurrent);

    const k1 = f(tCurrent, yCurrent);
    const k2 = f(
      tCurrent + stepSize / 2,
      yCurrent.map((yi, i) => yi + (stepSize / 2) * k1[i])
    );
    const k3 = f(
      tCurrent + stepSize / 2,
      yCurrent.map((yi, i) => yi + (stepSize / 2) * k2[i])
    );
    const k4 = f(
      tCurrent + stepSize,
      yCurrent.map((yi, i) => yi + stepSize * k3[i])
    );

    yCurrent = yCurrent.map(
      (yi, i) => yi + (stepSize / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])
    );
    tCurrent += stepSize;

    t.push(tCurrent);
    y.push([...yCurrent]);
  }

  return { t, y };
}

/**
 * General system ODE solver
 */
export function solveODESystem(
  f: ODESystemFunction,
  t0: number,
  y0: number[],
  tFinal: number,
  options: SolverOptions = {}
): ODESystemSolution {
  const { method = 'rk4', stepSize = 0.01 } = options;

  switch (method) {
    case 'euler':
      return eulerMethodSystem(f, t0, y0, tFinal, stepSize);
    case 'rk4':
    default:
      return rk4MethodSystem(f, t0, y0, tFinal, stepSize);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BOUNDARY VALUE PROBLEMS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Shooting method for 2-point BVP
 */
export function shootingMethod(
  f: (t: number, y: number, yPrime: number) => number,
  t0: number,
  tFinal: number,
  y0: number,
  yFinal: number,
  options: { tolerance?: number; maxIterations?: number } = {}
): ODESolution {
  const { tolerance = 1e-6, maxIterations = 100 } = options;

  // Convert to system: y' = z, z' = f(t, y, z)
  const system = (t: number, state: number[]) => {
    const [y, z] = state;
    return [z, f(t, y, z)];
  };

  // Shooting method: guess initial slope, adjust until final value matches
  let slopeLow = -10;
  let slopeHigh = 10;
  let iteration = 0;

  while (iteration < maxIterations) {
    const slopeGuess = (slopeLow + slopeHigh) / 2;

    // Solve IVP with guessed slope
    const solution = rk4MethodSystem(system, t0, [y0, slopeGuess], tFinal, 0.01);

    const yEnd = solution.y[solution.y.length - 1][0];
    const error = yEnd - yFinal;

    if (Math.abs(error) < tolerance) {
      // Success - extract y values
      return {
        t: solution.t,
        y: solution.y.map((state) => state[0]),
      };
    }

    // Adjust bounds
    if (error > 0) {
      slopeHigh = slopeGuess;
    } else {
      slopeLow = slopeGuess;
    }

    iteration++;
  }

  throw new Error('Shooting method did not converge');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMMON PHYSICS EXAMPLES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Simple harmonic oscillator: d²x/dt² = -ω²x
 */
export function harmonicOscillator(
  omega: number,
  x0: number,
  v0: number,
  tFinal: number
): ODESystemSolution {
  const f = (_t: number, state: number[]) => {
    const [x, v] = state;
    return [v, -omega * omega * x];
  };

  return rk4MethodSystem(f, 0, [x0, v0], tFinal, 0.01);
}

/**
 * Damped harmonic oscillator: d²x/dt² = -2γdx/dt - ω²x
 */
export function dampedOscillator(
  omega: number,
  gamma: number,
  x0: number,
  v0: number,
  tFinal: number
): ODESystemSolution {
  const f = (_t: number, state: number[]) => {
    const [x, v] = state;
    return [v, -2 * gamma * v - omega * omega * x];
  };

  return rk4MethodSystem(f, 0, [x0, v0], tFinal, 0.01);
}

/**
 * Driven harmonic oscillator
 */
export function drivenOscillator(
  omega: number,
  gamma: number,
  F0: number,
  omegaD: number,
  x0: number,
  v0: number,
  tFinal: number
): ODESystemSolution {
  const f = (t: number, state: number[]) => {
    const [x, v] = state;
    return [v, -2 * gamma * v - omega * omega * x + F0 * Math.cos(omegaD * t)];
  };

  return rk4MethodSystem(f, 0, [x0, v0], tFinal, 0.01);
}

/**
 * Projectile with drag: d²r/dt² = -g ŷ - (b/m) v
 */
export function projectileWithDrag(
  v0: number,
  angle: number,
  b: number,
  m: number,
  g: number = 9.81,
  tFinal: number = 10
): ODESystemSolution {
  const v0x = v0 * Math.cos(angle);
  const v0y = v0 * Math.sin(angle);

  const f = (_t: number, state: number[]) => {
    const [_x, _y, vx, vy] = state;
    const speed = Math.sqrt(vx * vx + vy * vy);
    return [vx, vy, -(b / m) * speed * vx, -g - (b / m) * speed * vy];
  };

  return rk4MethodSystem(f, 0, [0, 0, v0x, v0y], tFinal, 0.01);
}

/**
 * Pendulum (large angle): d²θ/dt² = -(g/L) sin(θ)
 */
export function pendulum(
  L: number,
  theta0: number,
  omega0: number = 0,
  g: number = 9.81,
  tFinal: number = 10
): ODESystemSolution {
  const f = (_t: number, state: number[]) => {
    const [theta, omega] = state;
    return [omega, -(g / L) * Math.sin(theta)];
  };

  return rk4MethodSystem(f, 0, [theta0, omega0], tFinal, 0.01);
}

/**
 * Lorenz attractor (chaos)
 */
export function lorenzAttractor(
  sigma: number = 10,
  rho: number = 28,
  beta: number = 8 / 3,
  x0: number = 1,
  y0: number = 1,
  z0: number = 1,
  tFinal: number = 50
): ODESystemSolution {
  const f = (_t: number, state: number[]) => {
    const [x, y, z] = state;
    return [sigma * (y - x), x * (rho - z) - y, x * y - beta * z];
  };

  return rk4MethodSystem(f, 0, [x0, y0, z0], tFinal, 0.01);
}

/**
 * Van der Pol oscillator (limit cycle)
 */
export function vanDerPolOscillator(
  mu: number,
  x0: number = 1,
  v0: number = 0,
  tFinal: number = 50
): ODESystemSolution {
  const f = (_t: number, state: number[]) => {
    const [x, v] = state;
    return [v, mu * (1 - x * x) * v - x];
  };

  return rk4MethodSystem(f, 0, [x0, v0], tFinal, 0.01);
}

/**
 * SIR epidemic model
 */
export function sirModel(
  beta: number,
  gamma: number,
  S0: number,
  I0: number,
  R0: number,
  tFinal: number = 100
): ODESystemSolution {
  const N = S0 + I0 + R0;

  const f = (_t: number, state: number[]) => {
    const [S, I, _R] = state;
    return [-(beta * S * I) / N, (beta * S * I) / N - gamma * I, gamma * I];
  };

  return rk4MethodSystem(f, 0, [S0, I0, R0], tFinal, 0.1);
}

/**
 * Lotka-Volterra (predator-prey)
 */
export function lotkaVolterra(
  alpha: number,
  beta: number,
  delta: number,
  gamma: number,
  x0: number,
  y0: number,
  tFinal: number = 100
): ODESystemSolution {
  const f = (_t: number, state: number[]) => {
    const [x, y] = state;
    return [alpha * x - beta * x * y, delta * x * y - gamma * y];
  };

  return rk4MethodSystem(f, 0, [x0, y0], tFinal, 0.1);
}
