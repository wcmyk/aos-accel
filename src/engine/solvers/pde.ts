/**
 * Partial Differential Equation Solvers
 * Features:
 * - Heat equation (parabolic)
 * - Wave equation (hyperbolic)
 * - Laplace equation (elliptic)
 * - Finite difference methods
 * - Boundary conditions
 */

import { Matrix, Vector } from '../types-advanced';
import { createMatrix, createVector } from '../math/linalg';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type BoundaryCondition = 'dirichlet' | 'neumann' | 'periodic';

export interface Grid1D {
  x: number[];
  dx: number;
  nx: number;
}

export interface Grid2D {
  x: number[];
  y: number[];
  dx: number;
  dy: number;
  nx: number;
  ny: number;
}

export interface PDESolution1D {
  grid: Grid1D;
  u: number[][];  // u[time][space]
  t: number[];
}

export interface PDESolution2D {
  grid: Grid2D;
  u: number[][][];  // u[time][y][x]
  t: number[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GRID GENERATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function createGrid1D(xMin: number, xMax: number, nx: number): Grid1D {
  const dx = (xMax - xMin) / (nx - 1);
  const x = Array.from({ length: nx }, (_, i) => xMin + i * dx);
  return { x, dx, nx };
}

export function createGrid2D(
  xMin: number,
  xMax: number,
  nx: number,
  yMin: number,
  yMax: number,
  ny: number
): Grid2D {
  const dx = (xMax - xMin) / (nx - 1);
  const dy = (yMax - yMin) / (ny - 1);

  const x = Array.from({ length: nx }, (_, i) => xMin + i * dx);
  const y = Array.from({ length: ny }, (_, j) => yMin + j * dy);

  return { x, y, dx, dy, nx, ny };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HEAT EQUATION (1D): ∂u/∂t = α ∂²u/∂x²
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Heat equation solver using explicit finite difference (FTCS)
 */
export function heatEquation1D(
  alpha: number,
  grid: Grid1D,
  u0: (x: number) => number,
  tFinal: number,
  dt: number,
  bc: BoundaryCondition = 'dirichlet',
  bcLeft: number = 0,
  bcRight: number = 0
): PDESolution1D {
  const { x, dx, nx } = grid;

  // Stability condition: r = α dt / dx² <= 0.5
  const r = (alpha * dt) / (dx * dx);
  if (r > 0.5) {
    console.warn(`Stability criterion violated: r = ${r} > 0.5. Solution may be unstable.`);
  }

  // Initialize
  const u: number[][] = [];
  const t: number[] = [];

  let uCurrent = x.map(u0);
  u.push([...uCurrent]);
  t.push(0);

  // Time stepping
  let tCurrent = 0;
  while (tCurrent < tFinal) {
    const uNext = new Array(nx);

    // Interior points
    for (let i = 1; i < nx - 1; i++) {
      uNext[i] = uCurrent[i] + r * (uCurrent[i + 1] - 2 * uCurrent[i] + uCurrent[i - 1]);
    }

    // Boundary conditions
    if (bc === 'dirichlet') {
      uNext[0] = bcLeft;
      uNext[nx - 1] = bcRight;
    } else if (bc === 'neumann') {
      uNext[0] = uNext[1] - bcLeft * dx;
      uNext[nx - 1] = uNext[nx - 2] + bcRight * dx;
    } else if (bc === 'periodic') {
      uNext[0] = uCurrent[0] + r * (uCurrent[1] - 2 * uCurrent[0] + uCurrent[nx - 2]);
      uNext[nx - 1] = uNext[0];
    }

    uCurrent = uNext;
    tCurrent += dt;

    u.push([...uCurrent]);
    t.push(tCurrent);
  }

  return { grid, u, t };
}

/**
 * Heat equation solver using implicit finite difference (backward Euler)
 */
export function heatEquation1DImplicit(
  alpha: number,
  grid: Grid1D,
  u0: (x: number) => number,
  tFinal: number,
  dt: number,
  bc: BoundaryCondition = 'dirichlet',
  bcLeft: number = 0,
  bcRight: number = 0
): PDESolution1D {
  const { x, dx, nx } = grid;
  const r = (alpha * dt) / (dx * dx);

  // Initialize
  const u: number[][] = [];
  const t: number[] = [];

  let uCurrent = x.map(u0);
  u.push([...uCurrent]);
  t.push(0);

  // Build tridiagonal matrix
  const A = Array.from({ length: nx }, () => new Array(nx).fill(0));

  for (let i = 0; i < nx; i++) {
    if (i === 0 || i === nx - 1) {
      A[i][i] = 1; // Boundary conditions
    } else {
      A[i][i - 1] = -r;
      A[i][i] = 1 + 2 * r;
      A[i][i + 1] = -r;
    }
  }

  // Time stepping
  let tCurrent = 0;
  while (tCurrent < tFinal) {
    const b = [...uCurrent];

    // Apply boundary conditions
    b[0] = bcLeft;
    b[nx - 1] = bcRight;

    // Solve tridiagonal system
    const uNext = solveTridiagonal(A, b);

    uCurrent = uNext;
    tCurrent += dt;

    u.push([...uCurrent]);
    t.push(tCurrent);
  }

  return { grid, u, t };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WAVE EQUATION (1D): ∂²u/∂t² = c² ∂²u/∂x²
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Wave equation solver using explicit finite difference
 */
export function waveEquation1D(
  c: number,
  grid: Grid1D,
  u0: (x: number) => number,
  v0: (x: number) => number,
  tFinal: number,
  dt: number,
  bc: BoundaryCondition = 'dirichlet',
  bcLeft: number = 0,
  bcRight: number = 0
): PDESolution1D {
  const { x, dx, nx } = grid;

  // Stability condition: c dt / dx <= 1 (CFL condition)
  const cfl = (c * dt) / dx;
  if (cfl > 1) {
    console.warn(`CFL condition violated: c dt/dx = ${cfl} > 1. Solution may be unstable.`);
  }

  const r = (c * dt / dx) ** 2;

  // Initialize
  const u: number[][] = [];
  const t: number[] = [];

  // Initial condition at t = 0
  let uPrev = x.map(u0);
  u.push([...uPrev]);
  t.push(0);

  // First step (t = dt) using initial velocity
  const uCurrent = new Array(nx);
  for (let i = 1; i < nx - 1; i++) {
    uCurrent[i] =
      uPrev[i] +
      dt * v0(x[i]) +
      0.5 * r * (uPrev[i + 1] - 2 * uPrev[i] + uPrev[i - 1]);
  }

  uCurrent[0] = bcLeft;
  uCurrent[nx - 1] = bcRight;

  u.push([...uCurrent]);
  t.push(dt);

  // Time stepping
  let tCurrent = dt;
  while (tCurrent < tFinal) {
    const uNext = new Array(nx);

    // Interior points
    for (let i = 1; i < nx - 1; i++) {
      uNext[i] =
        2 * uCurrent[i] - uPrev[i] + r * (uCurrent[i + 1] - 2 * uCurrent[i] + uCurrent[i - 1]);
    }

    // Boundary conditions
    uNext[0] = bcLeft;
    uNext[nx - 1] = bcRight;

    uPrev = uCurrent;
    tCurrent += dt;

    u.push([...uNext]);
    t.push(tCurrent);
  }

  return { grid, u, t };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LAPLACE EQUATION (2D): ∂²u/∂x² + ∂²u/∂y² = 0
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Laplace equation solver using Jacobi iteration
 */
export function laplaceEquation2D(
  grid: Grid2D,
  bcTop: (x: number) => number,
  bcBottom: (x: number) => number,
  bcLeft: (y: number) => number,
  bcRight: (y: number) => number,
  tolerance: number = 1e-6,
  maxIterations: number = 10000
): Matrix {
  const { x, y, dx, dy, nx, ny } = grid;

  // Initialize
  let u = Array.from({ length: ny }, () => new Array(nx).fill(0));

  // Apply boundary conditions
  for (let i = 0; i < nx; i++) {
    u[0][i] = bcBottom(x[i]);
    u[ny - 1][i] = bcTop(x[i]);
  }

  for (let j = 0; j < ny; j++) {
    u[j][0] = bcLeft(y[j]);
    u[j][nx - 1] = bcRight(y[j]);
  }

  // Jacobi iteration
  for (let iter = 0; iter < maxIterations; iter++) {
    const uNew = u.map((row) => [...row]);
    let maxChange = 0;

    // Interior points
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        uNew[j][i] =
          0.25 * (u[j][i + 1] + u[j][i - 1] + u[j + 1][i] + u[j - 1][i]);

        maxChange = Math.max(maxChange, Math.abs(uNew[j][i] - u[j][i]));
      }
    }

    u = uNew;

    if (maxChange < tolerance) {
      console.log(`Laplace solver converged in ${iter} iterations`);
      break;
    }
  }

  return createMatrix(u);
}

/**
 * Laplace equation using Gauss-Seidel (faster convergence)
 */
export function laplaceEquation2DGaussSeidel(
  grid: Grid2D,
  bcTop: (x: number) => number,
  bcBottom: (x: number) => number,
  bcLeft: (y: number) => number,
  bcRight: (y: number) => number,
  tolerance: number = 1e-6,
  maxIterations: number = 10000
): Matrix {
  const { x, y, nx, ny } = grid;

  // Initialize
  const u = Array.from({ length: ny }, () => new Array(nx).fill(0));

  // Apply boundary conditions
  for (let i = 0; i < nx; i++) {
    u[0][i] = bcBottom(x[i]);
    u[ny - 1][i] = bcTop(x[i]);
  }

  for (let j = 0; j < ny; j++) {
    u[j][0] = bcLeft(y[j]);
    u[j][nx - 1] = bcRight(y[j]);
  }

  // Gauss-Seidel iteration (update in-place)
  for (let iter = 0; iter < maxIterations; iter++) {
    let maxChange = 0;

    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const uOld = u[j][i];
        u[j][i] = 0.25 * (u[j][i + 1] + u[j][i - 1] + u[j + 1][i] + u[j - 1][i]);

        maxChange = Math.max(maxChange, Math.abs(u[j][i] - uOld));
      }
    }

    if (maxChange < tolerance) {
      console.log(`Laplace solver converged in ${iter} iterations`);
      break;
    }
  }

  return createMatrix(u);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POISSON EQUATION (2D): ∂²u/∂x² + ∂²u/∂y² = f(x,y)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Poisson equation solver
 */
export function poissonEquation2D(
  grid: Grid2D,
  source: (x: number, y: number) => number,
  bcTop: (x: number) => number,
  bcBottom: (x: number) => number,
  bcLeft: (y: number) => number,
  bcRight: (y: number) => number,
  tolerance: number = 1e-6,
  maxIterations: number = 10000
): Matrix {
  const { x, y, dx, dy, nx, ny } = grid;

  // Initialize
  const u = Array.from({ length: ny }, () => new Array(nx).fill(0));

  // Source term
  const f = Array.from({ length: ny }, (_, j) =>
    Array.from({ length: nx }, (_, i) => source(x[i], y[j]))
  );

  // Apply boundary conditions
  for (let i = 0; i < nx; i++) {
    u[0][i] = bcBottom(x[i]);
    u[ny - 1][i] = bcTop(x[i]);
  }

  for (let j = 0; j < ny; j++) {
    u[j][0] = bcLeft(y[j]);
    u[j][nx - 1] = bcRight(y[j]);
  }

  // Gauss-Seidel iteration
  const dx2 = dx * dx;
  const dy2 = dy * dy;
  const factor = 0.5 / (1 / dx2 + 1 / dy2);

  for (let iter = 0; iter < maxIterations; iter++) {
    let maxChange = 0;

    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const uOld = u[j][i];

        u[j][i] =
          factor *
          ((u[j][i + 1] + u[j][i - 1]) / dx2 + (u[j + 1][i] + u[j - 1][i]) / dy2 - f[j][i]);

        maxChange = Math.max(maxChange, Math.abs(u[j][i] - uOld));
      }
    }

    if (maxChange < tolerance) {
      console.log(`Poisson solver converged in ${iter} iterations`);
      break;
    }
  }

  return createMatrix(u);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Solve tridiagonal system Ax = b using Thomas algorithm
 */
function solveTridiagonal(A: number[][], b: number[]): number[] {
  const n = b.length;
  const x = new Array(n);
  const c = new Array(n);
  const d = new Array(n);

  // Forward sweep
  c[0] = A[0][1] / A[0][0];
  d[0] = b[0] / A[0][0];

  for (let i = 1; i < n; i++) {
    const denom = A[i][i] - A[i][i - 1] * c[i - 1];
    c[i] = i < n - 1 ? A[i][i + 1] / denom : 0;
    d[i] = (b[i] - A[i][i - 1] * d[i - 1]) / denom;
  }

  // Back substitution
  x[n - 1] = d[n - 1];
  for (let i = n - 2; i >= 0; i--) {
    x[i] = d[i] - c[i] * x[i + 1];
  }

  return x;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHYSICS EXAMPLES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Heat diffusion in a rod
 */
export function heatDiffusionRod(
  L: number,
  alpha: number,
  T_left: number,
  T_right: number,
  T_initial: (x: number) => number,
  tFinal: number
): PDESolution1D {
  const grid = createGrid1D(0, L, 100);
  const dt = 0.0001;

  return heatEquation1D(alpha, grid, T_initial, tFinal, dt, 'dirichlet', T_left, T_right);
}

/**
 * Vibrating string
 */
export function vibratingString(
  L: number,
  c: number,
  initialDisplacement: (x: number) => number,
  initialVelocity: (x: number) => number,
  tFinal: number
): PDESolution1D {
  const grid = createGrid1D(0, L, 100);
  const dt = 0.001;

  return waveEquation1D(c, grid, initialDisplacement, initialVelocity, tFinal, dt, 'dirichlet', 0, 0);
}

/**
 * Electric potential in a rectangular region
 */
export function electricPotential(
  width: number,
  height: number,
  V_top: number,
  V_bottom: number,
  V_left: number,
  V_right: number
): Matrix {
  const grid = createGrid2D(0, width, 50, 0, height, 50);

  return laplaceEquation2DGaussSeidel(
    grid,
    (_x) => V_top,
    (_x) => V_bottom,
    (_y) => V_left,
    (_y) => V_right
  );
}
