/**
 * Linear Algebra Core
 * Vector and matrix operations for scientific computing
 */

import { Vector, Matrix } from '../types-advanced';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VECTOR OPERATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function createVector(data: number[]): Vector {
  return {
    type: 'vector',
    data,
    length: data.length,
  };
}

export function vectorAdd(a: Vector, b: Vector): Vector {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }
  return createVector(a.data.map((val, i) => val + b.data[i]));
}

export function vectorSubtract(a: Vector, b: Vector): Vector {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }
  return createVector(a.data.map((val, i) => val - b.data[i]));
}

export function vectorScale(v: Vector, scalar: number): Vector {
  return createVector(v.data.map(val => val * scalar));
}

export function dotProduct(a: Vector, b: Vector): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }
  return a.data.reduce((sum, val, i) => sum + val * b.data[i], 0);
}

export function crossProduct(a: Vector, b: Vector): Vector {
  if (a.length !== 3 || b.length !== 3) {
    throw new Error('Cross product only defined for 3D vectors');
  }
  return createVector([
    a.data[1] * b.data[2] - a.data[2] * b.data[1],
    a.data[2] * b.data[0] - a.data[0] * b.data[2],
    a.data[0] * b.data[1] - a.data[1] * b.data[0],
  ]);
}

export function vectorNorm(v: Vector, p: number = 2): number {
  if (p === Infinity) {
    return Math.max(...v.data.map(Math.abs));
  }
  if (p === 1) {
    return v.data.reduce((sum, val) => sum + Math.abs(val), 0);
  }
  if (p === 2) {
    return Math.sqrt(v.data.reduce((sum, val) => sum + val * val, 0));
  }
  return Math.pow(
    v.data.reduce((sum, val) => sum + Math.pow(Math.abs(val), p), 0),
    1 / p
  );
}

export function normalize(v: Vector): Vector {
  const norm = vectorNorm(v, 2);
  if (norm === 0) {
    throw new Error('Cannot normalize zero vector');
  }
  return vectorScale(v, 1 / norm);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MATRIX OPERATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function createMatrix(data: number[][]): Matrix {
  const rows = data.length;
  const cols = rows > 0 ? data[0].length : 0;

  // Validate rectangular matrix
  for (const row of data) {
    if (row.length !== cols) {
      throw new Error('Matrix must be rectangular');
    }
  }

  return {
    type: 'matrix',
    data,
    rows,
    cols,
  };
}

export function zeros(rows: number, cols: number): Matrix {
  return createMatrix(
    Array.from({ length: rows }, () => Array(cols).fill(0))
  );
}

export function ones(rows: number, cols: number): Matrix {
  return createMatrix(
    Array.from({ length: rows }, () => Array(cols).fill(1))
  );
}

export function identity(n: number): Matrix {
  const data = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
  return createMatrix(data);
}

export function matrixAdd(a: Matrix, b: Matrix): Matrix {
  if (a.rows !== b.rows || a.cols !== b.cols) {
    throw new Error(`Matrix dimension mismatch: [${a.rows}×${a.cols}] vs [${b.rows}×${b.cols}]`);
  }
  const data = a.data.map((row, i) =>
    row.map((val, j) => val + b.data[i][j])
  );
  return createMatrix(data);
}

export function matrixSubtract(a: Matrix, b: Matrix): Matrix {
  if (a.rows !== b.rows || a.cols !== b.cols) {
    throw new Error(`Matrix dimension mismatch: [${a.rows}×${a.cols}] vs [${b.rows}×${b.cols}]`);
  }
  const data = a.data.map((row, i) =>
    row.map((val, j) => val - b.data[i][j])
  );
  return createMatrix(data);
}

export function matrixScale(m: Matrix, scalar: number): Matrix {
  const data = m.data.map(row => row.map(val => val * scalar));
  return createMatrix(data);
}

export function matrixMultiply(a: Matrix, b: Matrix): Matrix {
  if (a.cols !== b.rows) {
    throw new Error(`Matrix dimension mismatch: [${a.rows}×${a.cols}] × [${b.rows}×${b.cols}]`);
  }

  const result = zeros(a.rows, b.cols);

  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < b.cols; j++) {
      let sum = 0;
      for (let k = 0; k < a.cols; k++) {
        sum += a.data[i][k] * b.data[k][j];
      }
      result.data[i][j] = sum;
    }
  }

  return result;
}

export function matrixVectorMultiply(m: Matrix, v: Vector): Vector {
  if (m.cols !== v.length) {
    throw new Error(`Dimension mismatch: [${m.rows}×${m.cols}] × [${v.length}]`);
  }

  const result = new Array(m.rows).fill(0);

  for (let i = 0; i < m.rows; i++) {
    for (let j = 0; j < m.cols; j++) {
      result[i] += m.data[i][j] * v.data[j];
    }
  }

  return createVector(result);
}

export function transpose(m: Matrix): Matrix {
  const data = Array.from({ length: m.cols }, (_, j) =>
    Array.from({ length: m.rows }, (_, i) => m.data[i][j])
  );
  return createMatrix(data);
}

export function trace(m: Matrix): number {
  if (m.rows !== m.cols) {
    throw new Error('Trace only defined for square matrices');
  }
  let sum = 0;
  for (let i = 0; i < m.rows; i++) {
    sum += m.data[i][i];
  }
  return sum;
}

export function determinant(m: Matrix): number {
  if (m.rows !== m.cols) {
    throw new Error('Determinant only defined for square matrices');
  }

  const n = m.rows;

  // Base cases
  if (n === 1) return m.data[0][0];
  if (n === 2) {
    return m.data[0][0] * m.data[1][1] - m.data[0][1] * m.data[1][0];
  }

  // Use LU decomposition for larger matrices (more stable)
  const lu = luDecomposition(m);

  // Det(A) = Det(L) * Det(U) = 1 * product of U diagonal
  let det = 1;
  for (let i = 0; i < n; i++) {
    det *= lu.U.data[i][i];
  }

  return lu.permutationSign * det;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MATRIX DECOMPOSITIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface LUDecomposition {
  L: Matrix;  // Lower triangular
  U: Matrix;  // Upper triangular
  P: Matrix;  // Permutation matrix
  permutationSign: number;
}

export function luDecomposition(m: Matrix): LUDecomposition {
  if (m.rows !== m.cols) {
    throw new Error('LU decomposition requires square matrix');
  }

  const n = m.rows;
  const L = zeros(n, n);
  const U = zeros(n, n);
  const P = identity(n);

  // Copy matrix
  const A = createMatrix(m.data.map(row => [...row]));

  let permutationSign = 1;

  for (let i = 0; i < n; i++) {
    L.data[i][i] = 1;
  }

  for (let k = 0; k < n; k++) {
    // Find pivot
    let maxRow = k;
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(A.data[i][k]) > Math.abs(A.data[maxRow][k])) {
        maxRow = i;
      }
    }

    // Swap rows if needed
    if (maxRow !== k) {
      [A.data[k], A.data[maxRow]] = [A.data[maxRow], A.data[k]];
      [P.data[k], P.data[maxRow]] = [P.data[maxRow], P.data[k]];
      permutationSign *= -1;
    }

    // LU factorization
    for (let i = k; i < n; i++) {
      U.data[k][i] = A.data[k][i];
      for (let j = 0; j < k; j++) {
        U.data[k][i] -= L.data[k][j] * U.data[j][i];
      }
    }

    for (let i = k + 1; i < n; i++) {
      L.data[i][k] = A.data[i][k];
      for (let j = 0; j < k; j++) {
        L.data[i][k] -= L.data[i][j] * U.data[j][k];
      }
      if (Math.abs(U.data[k][k]) < 1e-10) {
        throw new Error('Matrix is singular or nearly singular');
      }
      L.data[i][k] /= U.data[k][k];
    }
  }

  return { L, U, P, permutationSign };
}

export function inverse(m: Matrix): Matrix {
  if (m.rows !== m.cols) {
    throw new Error('Inverse only defined for square matrices');
  }

  const n = m.rows;
  const lu = luDecomposition(m);

  // Solve LU * X = P for each column of identity
  const inv = zeros(n, n);

  for (let col = 0; col < n; col++) {
    // Create b vector (column of identity after permutation)
    const b = createVector(Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      b.data[i] = lu.P.data[i][col];
    }

    // Solve Ly = b (forward substitution)
    const y = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      y[i] = b.data[i];
      for (let j = 0; j < i; j++) {
        y[i] -= lu.L.data[i][j] * y[j];
      }
    }

    // Solve Ux = y (backward substitution)
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = y[i];
      for (let j = i + 1; j < n; j++) {
        x[i] -= lu.U.data[i][j] * x[j];
      }
      x[i] /= lu.U.data[i][i];
    }

    // Store in inverse matrix
    for (let i = 0; i < n; i++) {
      inv.data[i][col] = x[i];
    }
  }

  return inv;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EIGENVALUES (Power iteration for dominant eigenvalue)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface EigenResult {
  eigenvalue: number;
  eigenvector: Vector;
  converged: boolean;
  iterations: number;
}

export function powerIteration(
  m: Matrix,
  maxIterations: number = 1000,
  tolerance: number = 1e-6
): EigenResult {
  if (m.rows !== m.cols) {
    throw new Error('Eigenvalue computation requires square matrix');
  }

  const n = m.rows;

  // Start with random vector
  let v = createVector(Array.from({ length: n }, () => Math.random()));
  v = normalize(v);

  let eigenvalue = 0;
  let converged = false;
  let iterations = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    iterations = iter + 1;

    // v_new = A * v
    const vNew = matrixVectorMultiply(m, v);

    // Compute eigenvalue (Rayleigh quotient)
    const newEigenvalue = dotProduct(vNew, v) / dotProduct(v, v);

    // Normalize
    v = normalize(vNew);

    // Check convergence
    if (Math.abs(newEigenvalue - eigenvalue) < tolerance) {
      converged = true;
      eigenvalue = newEigenvalue;
      break;
    }

    eigenvalue = newEigenvalue;
  }

  return {
    eigenvalue,
    eigenvector: v,
    converged,
    iterations,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NORMS & CONDITION NUMBER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function matrixNorm(m: Matrix, type: 'frobenius' | '1' | 'inf' = 'frobenius'): number {
  if (type === 'frobenius') {
    let sum = 0;
    for (const row of m.data) {
      for (const val of row) {
        sum += val * val;
      }
    }
    return Math.sqrt(sum);
  }

  if (type === '1') {
    // Maximum absolute column sum
    let max = 0;
    for (let j = 0; j < m.cols; j++) {
      let colSum = 0;
      for (let i = 0; i < m.rows; i++) {
        colSum += Math.abs(m.data[i][j]);
      }
      max = Math.max(max, colSum);
    }
    return max;
  }

  if (type === 'inf') {
    // Maximum absolute row sum
    let max = 0;
    for (const row of m.data) {
      const rowSum = row.reduce((sum, val) => sum + Math.abs(val), 0);
      max = Math.max(max, rowSum);
    }
    return max;
  }

  throw new Error(`Unknown norm type: ${type}`);
}

export function conditionNumber(m: Matrix): number {
  const inv = inverse(m);
  return matrixNorm(m, 'frobenius') * matrixNorm(inv, 'frobenius');
}

export function rank(m: Matrix, tolerance: number = 1e-10): number {
  // Use SVD or row reduction (simplified here with LU)
  const lu = luDecomposition(m);

  let r = 0;
  for (let i = 0; i < Math.min(m.rows, m.cols); i++) {
    if (Math.abs(lu.U.data[i][i]) > tolerance) {
      r++;
    }
  }

  return r;
}
