/**
 * Calculus & Differential Operators
 * Features:
 * - Numerical differentiation (finite differences)
 * - Gradient, Jacobian, Hessian
 * - Numerical integration
 * - Differential operators for PDEs
 */

import { Vector, Matrix } from '../types-advanced';
import { createVector, createMatrix } from './linalg';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NUMERICAL DERIVATIVES (Finite Differences)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type DerivativeFunction = (x: number) => number;
export type MultivariateFunction = (x: number[]) => number;

/**
 * First derivative using central difference
 */
export function derivative(
  f: DerivativeFunction,
  x: number,
  h: number = 1e-5
): number {
  return (f(x + h) - f(x - h)) / (2 * h);
}

/**
 * Second derivative
 */
export function secondDerivative(
  f: DerivativeFunction,
  x: number,
  h: number = 1e-5
): number {
  return (f(x + h) - 2 * f(x) + f(x - h)) / (h * h);
}

/**
 * Partial derivative with respect to variable i
 */
export function partialDerivative(
  f: MultivariateFunction,
  x: number[],
  i: number,
  h: number = 1e-5
): number {
  const xPlus = [...x];
  const xMinus = [...x];

  xPlus[i] += h;
  xMinus[i] -= h;

  return (f(xPlus) - f(xMinus)) / (2 * h);
}

/**
 * Gradient (vector of partial derivatives)
 */
export function gradient(
  f: MultivariateFunction,
  x: number[],
  h: number = 1e-5
): Vector {
  const grad = new Array(x.length);

  for (let i = 0; i < x.length; i++) {
    grad[i] = partialDerivative(f, x, i, h);
  }

  return createVector(grad);
}

/**
 * Jacobian matrix (for vector-valued functions)
 */
export function jacobian(
  f: (x: number[]) => number[],
  x: number[],
  h: number = 1e-5
): Matrix {
  const fx = f(x);
  const m = fx.length;  // output dimension
  const n = x.length;   // input dimension

  const jac = Array.from({ length: m }, () => new Array(n).fill(0));

  for (let j = 0; j < n; j++) {
    const xPlus = [...x];
    const xMinus = [...x];

    xPlus[j] += h;
    xMinus[j] -= h;

    const fPlus = f(xPlus);
    const fMinus = f(xMinus);

    for (let i = 0; i < m; i++) {
      jac[i][j] = (fPlus[i] - fMinus[i]) / (2 * h);
    }
  }

  return createMatrix(jac);
}

/**
 * Hessian matrix (matrix of second partial derivatives)
 */
export function hessian(
  f: MultivariateFunction,
  x: number[],
  h: number = 1e-4
): Matrix {
  const n = x.length;
  const hess = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      if (i === j) {
        // Diagonal: pure second derivative
        const xPlus = [...x];
        const xMinus = [...x];
        xPlus[i] += h;
        xMinus[i] -= h;

        hess[i][i] = (f(xPlus) - 2 * f(x) + f(xMinus)) / (h * h);
      } else {
        // Off-diagonal: mixed partial
        const xPP = [...x];
        const xPM = [...x];
        const xMP = [...x];
        const xMM = [...x];

        xPP[i] += h; xPP[j] += h;
        xPM[i] += h; xPM[j] -= h;
        xMP[i] -= h; xMP[j] += h;
        xMM[i] -= h; xMM[j] -= h;

        const mixed = (f(xPP) - f(xPM) - f(xMP) + f(xMM)) / (4 * h * h);

        hess[i][j] = mixed;
        hess[j][i] = mixed;  // Symmetry
      }
    }
  }

  return createMatrix(hess);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NUMERICAL INTEGRATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Trapezoidal rule
 */
export function trapezoidalRule(
  f: DerivativeFunction,
  a: number,
  b: number,
  n: number = 1000
): number {
  const h = (b - a) / n;
  let sum = (f(a) + f(b)) / 2;

  for (let i = 1; i < n; i++) {
    sum += f(a + i * h);
  }

  return h * sum;
}

/**
 * Simpson's rule (more accurate)
 */
export function simpsonsRule(
  f: DerivativeFunction,
  a: number,
  b: number,
  n: number = 1000
): number {
  if (n % 2 !== 0) n += 1;  // Must be even

  const h = (b - a) / n;
  let sum = f(a) + f(b);

  for (let i = 1; i < n; i++) {
    const coef = i % 2 === 0 ? 2 : 4;
    sum += coef * f(a + i * h);
  }

  return (h / 3) * sum;
}

/**
 * Adaptive integration (automatically adjusts step size)
 */
export function adaptiveIntegration(
  f: DerivativeFunction,
  a: number,
  b: number,
  tolerance: number = 1e-6,
  maxDepth: number = 20
): number {
  function integrate(a: number, b: number, depth: number): number {
    const mid = (a + b) / 2;

    const whole = simpsonsRule(f, a, b, 10);
    const left = simpsonsRule(f, a, mid, 10);
    const right = simpsonsRule(f, mid, b, 10);

    const error = Math.abs(whole - (left + right));

    if (error < tolerance || depth >= maxDepth) {
      return left + right;
    }

    return integrate(a, mid, depth + 1) + integrate(mid, b, depth + 1);
  }

  return integrate(a, b, 0);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DIFFERENTIAL OPERATORS FOR DISCRETE GRIDS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * First derivative on grid using finite differences
 */
export function gridDerivative(
  u: Vector,
  dx: number,
  order: number = 2
): Vector {
  const n = u.length;
  const du = new Array(n).fill(0);

  if (order === 1) {
    // Forward difference at start
    du[0] = (u.data[1] - u.data[0]) / dx;

    // Central difference in middle
    for (let i = 1; i < n - 1; i++) {
      du[i] = (u.data[i + 1] - u.data[i - 1]) / (2 * dx);
    }

    // Backward difference at end
    du[n - 1] = (u.data[n - 1] - u.data[n - 2]) / dx;
  } else if (order === 2) {
    // Second-order accurate central differences
    du[0] = (-3 * u.data[0] + 4 * u.data[1] - u.data[2]) / (2 * dx);

    for (let i = 1; i < n - 1; i++) {
      du[i] = (u.data[i + 1] - u.data[i - 1]) / (2 * dx);
    }

    du[n - 1] = (u.data[n - 3] - 4 * u.data[n - 2] + 3 * u.data[n - 1]) / (2 * dx);
  }

  return createVector(du);
}

/**
 * Second derivative on grid (Laplacian in 1D)
 */
export function gridSecondDerivative(
  u: Vector,
  dx: number
): Vector {
  const n = u.length;
  const d2u = new Array(n).fill(0);

  // Central difference: (u[i+1] - 2*u[i] + u[i-1]) / dx^2
  for (let i = 1; i < n - 1; i++) {
    d2u[i] = (u.data[i + 1] - 2 * u.data[i] + u.data[i - 1]) / (dx * dx);
  }

  // Boundary conditions (Neumann: zero gradient)
  d2u[0] = (2 * u.data[1] - 2 * u.data[0]) / (dx * dx);
  d2u[n - 1] = (2 * u.data[n - 2] - 2 * u.data[n - 1]) / (dx * dx);

  return createVector(d2u);
}

/**
 * Laplacian operator on 2D grid
 */
export function laplacian2D(
  u: Matrix,
  dx: number,
  dy: number
): Matrix {
  const m = u.rows;
  const n = u.cols;
  const lap = Array.from({ length: m }, () => new Array(n).fill(0));

  for (let i = 1; i < m - 1; i++) {
    for (let j = 1; j < n - 1; j++) {
      const dxx = (u.data[i][j + 1] - 2 * u.data[i][j] + u.data[i][j - 1]) / (dx * dx);
      const dyy = (u.data[i + 1][j] - 2 * u.data[i][j] + u.data[i - 1][j]) / (dy * dy);
      lap[i][j] = dxx + dyy;
    }
  }

  // Boundary conditions (zero)
  // Can be customized based on physics

  return createMatrix(lap);
}

/**
 * Divergence operator (∇·F) for 2D vector field
 */
export function divergence2D(
  Fx: Matrix,  // x-component of vector field
  Fy: Matrix,  // y-component of vector field
  dx: number,
  dy: number
): Matrix {
  const m = Fx.rows;
  const n = Fx.cols;
  const div = Array.from({ length: m }, () => new Array(n).fill(0));

  for (let i = 1; i < m - 1; i++) {
    for (let j = 1; j < n - 1; j++) {
      const dFx_dx = (Fx.data[i][j + 1] - Fx.data[i][j - 1]) / (2 * dx);
      const dFy_dy = (Fy.data[i + 1][j] - Fy.data[i - 1][j]) / (2 * dy);
      div[i][j] = dFx_dx + dFy_dy;
    }
  }

  return createMatrix(div);
}

/**
 * Curl operator (∇×F) for 2D vector field (returns scalar)
 */
export function curl2D(
  Fx: Matrix,
  Fy: Matrix,
  dx: number,
  dy: number
): Matrix {
  const m = Fx.rows;
  const n = Fx.cols;
  const curl = Array.from({ length: m }, () => new Array(n).fill(0));

  for (let i = 1; i < m - 1; i++) {
    for (let j = 1; j < n - 1; j++) {
      const dFy_dx = (Fy.data[i][j + 1] - Fy.data[i][j - 1]) / (2 * dx);
      const dFx_dy = (Fx.data[i + 1][j] - Fx.data[i - 1][j]) / (2 * dy);
      curl[i][j] = dFy_dx - dFx_dy;
    }
  }

  return createMatrix(curl);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OPTIMIZATION HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Line search (find step size for gradient descent)
 */
export function lineSearch(
  f: MultivariateFunction,
  x: number[],
  direction: Vector,
  maxAlpha: number = 1.0,
  c: number = 0.5
): number {
  let alpha = maxAlpha;
  const f0 = f(x);

  for (let i = 0; i < 20; i++) {
    const xNew = x.map((xi, j) => xi + alpha * direction.data[j]);
    const fNew = f(xNew);

    // Armijo condition
    if (fNew <= f0 + c * alpha) {
      return alpha;
    }

    alpha *= 0.5;
  }

  return alpha;
}

/**
 * Check if point is a critical point
 */
export function isCriticalPoint(
  f: MultivariateFunction,
  x: number[],
  tolerance: number = 1e-6
): boolean {
  const grad = gradient(f, x);
  const gradNorm = Math.sqrt(grad.data.reduce((sum, g) => sum + g * g, 0));
  return gradNorm < tolerance;
}

/**
 * Classify critical point using Hessian
 */
export function classifyCriticalPoint(
  f: MultivariateFunction,
  x: number[]
): 'minimum' | 'maximum' | 'saddle' | 'unknown' {
  const hess = hessian(f, x);

  // Check eigenvalues (simplified: just check determinant and trace for 2D)
  if (hess.rows === 2 && hess.cols === 2) {
    const det = hess.data[0][0] * hess.data[1][1] - hess.data[0][1] * hess.data[1][0];
    const trace = hess.data[0][0] + hess.data[1][1];

    if (det > 0 && trace > 0) return 'minimum';
    if (det > 0 && trace < 0) return 'maximum';
    if (det < 0) return 'saddle';
  }

  return 'unknown';
}
