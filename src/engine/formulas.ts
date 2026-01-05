/**
 * Excel formula library
 * Implements ~350-400 Excel functions + Scientific Computing
 */

import { CellValue } from './types';

// Scientific Computing Imports
import * as Mechanics from './physics/mechanics';
import * as Quantum from './physics/quantum';
import * as Waves from './physics/waves';
import * as Thermo from './physics/thermodynamics';
import * as LinAlg from './math/linalg';
import * as Calculus from './math/calculus';
import * as Stats from './stats/distributions';
import * as Inference from './stats/inference';
import * as Models from './ml/models';
import { createVector, createMatrix } from './math/linalg';

type FormulaFunction = (...args: CellValue[]) => CellValue;

export const FORMULAS: Record<string, FormulaFunction> = {
  // ===== MATH FUNCTIONS =====
  SUM: (...args) => {
    const values = flattenArgs(args);
    return values.reduce((sum: number, val) => sum + toNumber(val), 0);
  },

  AVERAGE: (...args) => {
    const values = flattenArgs(args).map(toNumber);
    if (values.length === 0) return 0;
    return values.reduce((sum: number, val) => sum + toNumber(val), 0) / values.length;
  },

  MIN: (...args) => {
    const values = flattenArgs(args).map(toNumber);
    return values.length > 0 ? Math.min(...values) : 0;
  },

  MAX: (...args) => {
    const values = flattenArgs(args).map(toNumber);
    return values.length > 0 ? Math.max(...values) : 0;
  },

  ABS: (value) => Math.abs(toNumber(value)),

  SQRT: (value) => Math.sqrt(toNumber(value)),

  POWER: (base, exponent) => Math.pow(toNumber(base), toNumber(exponent)),

  EXP: (value) => Math.exp(toNumber(value)),

  LN: (value) => Math.log(toNumber(value)),

  LOG: (value, base = 10) => Math.log(toNumber(value)) / Math.log(toNumber(base)),

  LOG10: (value) => Math.log10(toNumber(value)),

  ROUND: (value, digits = 0) => {
    const multiplier = Math.pow(10, toNumber(digits));
    return Math.round(toNumber(value) * multiplier) / multiplier;
  },

  FLOOR: (value, significance = 1) => {
    const num = toNumber(value);
    const sig = toNumber(significance);
    return Math.floor(num / sig) * sig;
  },

  CEILING: (value, significance = 1) => {
    const num = toNumber(value);
    const sig = toNumber(significance);
    return Math.ceil(num / sig) * sig;
  },

  MOD: (dividend, divisor) => toNumber(dividend) % toNumber(divisor),

  PI: () => Math.PI,

  RAND: () => Math.random(),

  RANDBETWEEN: (bottom, top) => {
    const min = Math.ceil(toNumber(bottom));
    const max = Math.floor(toNumber(top));
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  // ===== TRIGONOMETRIC FUNCTIONS =====
  SIN: (value) => Math.sin(toNumber(value)),

  COS: (value) => Math.cos(toNumber(value)),

  TAN: (value) => Math.tan(toNumber(value)),

  ASIN: (value) => Math.asin(toNumber(value)),

  ACOS: (value) => Math.acos(toNumber(value)),

  ATAN: (value) => Math.atan(toNumber(value)),

  ATAN2: (x, y) => Math.atan2(toNumber(y), toNumber(x)),

  SINH: (value) => Math.sinh(toNumber(value)),

  COSH: (value) => Math.cosh(toNumber(value)),

  TANH: (value) => Math.tanh(toNumber(value)),

  DEGREES: (radians) => (toNumber(radians) * 180) / Math.PI,

  RADIANS: (degrees) => (toNumber(degrees) * Math.PI) / 180,

  // ===== STATISTICAL FUNCTIONS =====
  COUNT: (...args) => {
    return flattenArgs(args).filter(v => typeof v === 'number').length;
  },

  COUNTA: (...args) => {
    return flattenArgs(args).filter(v => v !== null && v !== '').length;
  },

  COUNTBLANK: (...args) => {
    return flattenArgs(args).filter(v => v === null || v === '').length;
  },

  STDEV: (...args) => {
    const values = flattenArgs(args).map(toNumber);
    if (values.length < 2) return 0;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
  },

  VAR: (...args) => {
    const values = flattenArgs(args).map(toNumber);
    if (values.length < 2) return 0;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / (values.length - 1);
  },

  MEDIAN: (...args) => {
    const values = flattenArgs(args).map(toNumber).sort((a, b) => a - b);
    if (values.length === 0) return 0;
    const mid = Math.floor(values.length / 2);
    return values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
  },

  // ===== LOGICAL FUNCTIONS =====
  IF: (condition, valueIfTrue, valueIfFalse = null) => {
    return toBoolean(condition) ? valueIfTrue : valueIfFalse;
  },

  AND: (...args) => {
    return flattenArgs(args).every(toBoolean);
  },

  OR: (...args) => {
    return flattenArgs(args).some(toBoolean);
  },

  NOT: (value) => !toBoolean(value),

  TRUE: () => true,

  FALSE: () => false,

  // ===== TEXT FUNCTIONS =====
  CONCATENATE: (...args) => {
    return flattenArgs(args).map(String).join('');
  },

  CONCAT: (...args) => {
    return flattenArgs(args).map(String).join('');
  },

  LEN: (text) => String(text).length,

  UPPER: (text) => String(text).toUpperCase(),

  LOWER: (text) => String(text).toLowerCase(),

  PROPER: (text) => {
    return String(text)
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  },

  TRIM: (text) => String(text).trim(),

  LEFT: (text, numChars = 1) => String(text).substring(0, toNumber(numChars)),

  RIGHT: (text, numChars = 1) => {
    const str = String(text);
    return str.substring(str.length - toNumber(numChars));
  },

  MID: (text, startNum, numChars) => {
    return String(text).substring(toNumber(startNum) - 1, toNumber(startNum) - 1 + toNumber(numChars));
  },

  FIND: (findText, withinText, startNum = 1) => {
    const pos = String(withinText).indexOf(String(findText), toNumber(startNum) - 1);
    return pos === -1 ? null : pos + 1;
  },

  SUBSTITUTE: (text, oldText, newText, instanceNum?) => {
    let str = String(text);
    const old = String(oldText);
    const replacement = String(newText);

    if (instanceNum !== undefined) {
      let count = 0;
      let index = -1;
      while ((index = str.indexOf(old, index + 1)) !== -1) {
        count++;
        if (count === toNumber(instanceNum)) {
          str = str.substring(0, index) + replacement + str.substring(index + old.length);
          break;
        }
      }
    } else {
      str = str.split(old).join(replacement);
    }

    return str;
  },

  TEXT: (value, _format?) => {
    // Basic text formatting
    return String(value);
  },

  VALUE: (text) => {
    const num = parseFloat(String(text));
    return isNaN(num) ? null : num;
  },

  // ===== DATE/TIME FUNCTIONS =====
  NOW: () => new Date().getTime(),

  TODAY: () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  },

  YEAR: (dateValue) => new Date(toNumber(dateValue)).getFullYear(),

  MONTH: (dateValue) => new Date(toNumber(dateValue)).getMonth() + 1,

  DAY: (dateValue) => new Date(toNumber(dateValue)).getDate(),

  HOUR: (dateValue) => new Date(toNumber(dateValue)).getHours(),

  MINUTE: (dateValue) => new Date(toNumber(dateValue)).getMinutes(),

  SECOND: (dateValue) => new Date(toNumber(dateValue)).getSeconds(),

  // ===== LOOKUP/REFERENCE FUNCTIONS =====
  VLOOKUP: (lookupValue, tableArray, colIndexNum, _rangeLookup = true) => {
    // Simplified implementation
    if (!Array.isArray(tableArray)) return null;

    const rows = tableArray as CellValue[][];
    const colIndex = toNumber(colIndexNum) - 1;

    for (const row of rows) {
      if (Array.isArray(row) && row[0] === lookupValue) {
        return row[colIndex] ?? null;
      }
    }

    return null;
  },

  HLOOKUP: (lookupValue, tableArray, rowIndexNum, _rangeLookup = true) => {
    if (!Array.isArray(tableArray)) return null;

    const rows = tableArray as CellValue[][];
    const rowIndex = toNumber(rowIndexNum) - 1;

    if (rows.length === 0) return null;

    const firstRow = rows[0];
    if (!Array.isArray(firstRow)) return null;

    const colIndex = firstRow.indexOf(lookupValue);
    if (colIndex === -1) return null;

    return rows[rowIndex]?.[colIndex] ?? null;
  },

  INDEX: (array, rowNum, colNum?) => {
    if (!Array.isArray(array)) return array;

    const row = toNumber(rowNum) - 1;

    if (colNum === undefined) {
      return array[row] ?? null;
    }

    const col = toNumber(colNum) - 1;
    const rowData = array[row];

    if (Array.isArray(rowData)) {
      return rowData[col] ?? null;
    }

    return null;
  },

  MATCH: (lookupValue, lookupArray, _matchType = 1) => {
    if (!Array.isArray(lookupArray)) return null;

    const index = lookupArray.indexOf(lookupValue);
    return index === -1 ? null : index + 1;
  },

  // ===== FINANCIAL FUNCTIONS =====
  PMT: (rate, nper, pv, fv = 0, type = 0) => {
    const r = toNumber(rate);
    const n = toNumber(nper);
    const p = toNumber(pv);
    const f = toNumber(fv);
    const t = toNumber(type);

    if (r === 0) return -(p + f) / n;

    const pvif = Math.pow(1 + r, n);
    const pmt = (r * (f + pvif * p)) / ((t === 1 ? 1 + r : 1) * (1 - pvif));

    return -pmt;
  },

  FV: (rate, nper, pmt, pv = 0, type = 0) => {
    const r = toNumber(rate);
    const n = toNumber(nper);
    const p = toNumber(pmt);
    const v = toNumber(pv);
    const t = toNumber(type);

    if (r === 0) return -v - p * n;

    const pvif = Math.pow(1 + r, n);
    return -(v * pvif + (p * (1 + r * t) * (pvif - 1)) / r);
  },

  PV: (rate, nper, pmt, fv = 0, type = 0) => {
    const r = toNumber(rate);
    const n = toNumber(nper);
    const p = toNumber(pmt);
    const f = toNumber(fv);
    const t = toNumber(type);

    if (r === 0) return -f - p * n;

    const pvif = Math.pow(1 + r, n);
    return -(f + (p * (1 + r * t) * (pvif - 1)) / r) / pvif;
  },

  NPV: (rate, ...values) => {
    const r = toNumber(rate);
    const vals = flattenArgs(values).map(toNumber);

    return vals.reduce((npv, val, i) => {
      return npv + val / Math.pow(1 + r, i + 1);
    }, 0);
  },

  IRR: (values, guess = 0.1) => {
    const vals = flattenArgs([values]).map(toNumber);

    // Newton-Raphson method
    let rate = toNumber(guess);
    const maxIterations = 100;
    const tolerance = 1e-6;

    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let dnpv = 0;

      for (let j = 0; j < vals.length; j++) {
        npv += vals[j] / Math.pow(1 + rate, j);
        dnpv -= j * vals[j] / Math.pow(1 + rate, j + 1);
      }

      const newRate = rate - npv / dnpv;

      if (Math.abs(newRate - rate) < tolerance) {
        return newRate;
      }

      rate = newRate;
    }

    return rate;
  },

  // ===== CONDITIONAL AGGREGATION =====
  SUMIF: (range, criteria, sumRange?) => {
    const rangeVals = flattenArgs([range]);
    const sumVals = sumRange ? flattenArgs([sumRange]) : rangeVals;
    let sum = 0;
    for (let i = 0; i < rangeVals.length; i++) {
      if (meetsCriteria(rangeVals[i], criteria)) {
        sum += toNumber(sumVals[i] ?? 0);
      }
    }
    return sum;
  },

  COUNTIF: (range, criteria) => {
    const vals = flattenArgs([range]);
    return vals.filter(v => meetsCriteria(v, criteria)).length;
  },

  AVERAGEIF: (range, criteria, avgRange?) => {
    const rangeVals = flattenArgs([range]);
    const avgVals = avgRange ? flattenArgs([avgRange]) : rangeVals;
    let sum = 0, count = 0;
    for (let i = 0; i < rangeVals.length; i++) {
      if (meetsCriteria(rangeVals[i], criteria)) {
        sum += toNumber(avgVals[i] ?? 0);
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
  },

  SUMIFS: (sumRange, ...pairs) => {
    const sumVals = flattenArgs([sumRange]);
    const criteriaList: Array<{range: CellValue[], criteria: CellValue}> = [];
    for (let i = 0; i < pairs.length; i += 2) {
      criteriaList.push({ range: flattenArgs([pairs[i]]), criteria: pairs[i + 1] });
    }
    let sum = 0;
    for (let i = 0; i < sumVals.length; i++) {
      if (criteriaList.every(p => meetsCriteria(p.range[i], p.criteria))) {
        sum += toNumber(sumVals[i]);
      }
    }
    return sum;
  },

  COUNTIFS: (...pairs) => {
    const criteriaList: Array<{range: CellValue[], criteria: CellValue}> = [];
    for (let i = 0; i < pairs.length; i += 2) {
      criteriaList.push({ range: flattenArgs([pairs[i]]), criteria: pairs[i + 1] });
    }
    if (criteriaList.length === 0) return 0;
    const length = criteriaList[0].range.length;
    let count = 0;
    for (let i = 0; i < length; i++) {
      if (criteriaList.every(p => meetsCriteria(p.range[i], p.criteria))) count++;
    }
    return count;
  },

  AVERAGEIFS: (avgRange, ...pairs) => {
    const avgVals = flattenArgs([avgRange]);
    const criteriaList: Array<{range: CellValue[], criteria: CellValue}> = [];
    for (let i = 0; i < pairs.length; i += 2) {
      criteriaList.push({ range: flattenArgs([pairs[i]]), criteria: pairs[i + 1] });
    }
    let sum = 0, count = 0;
    for (let i = 0; i < avgVals.length; i++) {
      if (criteriaList.every(p => meetsCriteria(p.range[i], p.criteria))) {
        sum += toNumber(avgVals[i]);
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
  },

  MAXIFS: (maxRange, ...pairs) => {
    const maxVals = flattenArgs([maxRange]);
    const criteriaList: Array<{range: CellValue[], criteria: CellValue}> = [];
    for (let i = 0; i < pairs.length; i += 2) {
      criteriaList.push({ range: flattenArgs([pairs[i]]), criteria: pairs[i + 1] });
    }
    const matching: number[] = [];
    for (let i = 0; i < maxVals.length; i++) {
      if (criteriaList.every(p => meetsCriteria(p.range[i], p.criteria))) {
        matching.push(toNumber(maxVals[i]));
      }
    }
    return matching.length > 0 ? Math.max(...matching) : 0;
  },

  MINIFS: (minRange, ...pairs) => {
    const minVals = flattenArgs([minRange]);
    const criteriaList: Array<{range: CellValue[], criteria: CellValue}> = [];
    for (let i = 0; i < pairs.length; i += 2) {
      criteriaList.push({ range: flattenArgs([pairs[i]]), criteria: pairs[i + 1] });
    }
    const matching: number[] = [];
    for (let i = 0; i < minVals.length; i++) {
      if (criteriaList.every(p => meetsCriteria(p.range[i], p.criteria))) {
        matching.push(toNumber(minVals[i]));
      }
    }
    return matching.length > 0 ? Math.min(...matching) : 0;
  },

  // ===== MORE MATH =====
  PRODUCT: (...args) => flattenArgs(args).map(toNumber).reduce((a, b) => a * b, 1),
  SUMPRODUCT: (...arrays) => {
    const arrs = arrays.map(a => flattenArgs([a]).map(toNumber));
    const length = Math.min(...arrs.map(a => a.length));
    let sum = 0;
    for (let i = 0; i < length; i++) {
      let product = 1;
      for (const arr of arrs) product *= arr[i];
      sum += product;
    }
    return sum;
  },
  SUMSQ: (...args) => flattenArgs(args).map(toNumber).reduce((sum, v) => sum + v * v, 0),
  QUOTIENT: (num, denom) => Math.trunc(toNumber(num) / toNumber(denom)),
  INT: (number) => Math.floor(toNumber(number)),
  GCD: (...args) => {
    const gcd2 = (a: number, b: number): number => b === 0 ? a : gcd2(b, a % b);
    return flattenArgs(args).map(toNumber).reduce(gcd2);
  },
  LCM: (...args) => {
    const gcd2 = (a: number, b: number): number => b === 0 ? a : gcd2(b, a % b);
    const lcm2 = (a: number, b: number) => (a * b) / gcd2(a, b);
    return flattenArgs(args).map(toNumber).reduce(lcm2);
  },
  COMBIN: (n, k) => {
    const num = toNumber(n), choose = toNumber(k);
    if (choose > num || choose < 0) return 0;
    let result = 1;
    for (let i = 0; i < choose; i++) {
      result *= (num - i) / (i + 1);
    }
    return Math.round(result);
  },

  // ===== MORE STAT =====
  LARGE: (arr, k) => flattenArgs([arr]).map(toNumber).sort((a, b) => b - a)[toNumber(k) - 1] ?? null,
  SMALL: (arr, k) => flattenArgs([arr]).map(toNumber).sort((a, b) => a - b)[toNumber(k) - 1] ?? null,
  PERCENTILE: (arr, k) => {
    const v = flattenArgs([arr]).map(toNumber).sort((a, b) => a - b);
    const i = toNumber(k) * (v.length - 1);
    const l = Math.floor(i), u = Math.ceil(i), w = i - l;
    return v[l] * (1 - w) + v[u] * w;
  },
  QUARTILE: (arr, quart) => {
    const q = toNumber(quart);
    if (q === 0) return FORMULAS.MIN(arr);
    if (q === 4) return FORMULAS.MAX(arr);
    return FORMULAS.PERCENTILE(arr, q / 4);
  },
  RANK: (number, ref, order = 0) => {
    const num = toNumber(number);
    const vals = flattenArgs([ref]).map(toNumber);
    const sorted = toNumber(order) === 0 ? vals.sort((a, b) => b - a) : vals.sort((a, b) => a - b);
    return sorted.indexOf(num) + 1;
  },

  // ===== MORE TEXT =====
  TEXTJOIN: (delim, ignoreEmpty, ...texts) => {
    const vals = flattenArgs(texts);
    const filtered = toBoolean(ignoreEmpty) ? vals.filter(v => v !== null && v !== '') : vals;
    return filtered.map(String).join(String(delim));
  },
  REPT: (text, times) => String(text).repeat(toNumber(times)),
  EXACT: (a, b) => String(a) === String(b),
  CHAR: (n) => String.fromCharCode(toNumber(n)),
  CODE: (text) => String(text).charCodeAt(0),

  // ===== DATE/TIME =====
  DAYS: (end, start) => Math.floor((toNumber(end) - toNumber(start)) / 86400000),
  WEEKDAY: (date, type = 1) => {
    const d = new Date(toNumber(date)).getDay();
    const t = toNumber(type);
    if (t === 1) return d + 1;
    if (t === 2) return d === 0 ? 7 : d;
    return d === 0 ? 6 : d - 1;
  },

  // ===== LOGICAL =====
  XOR: (...args) => flattenArgs(args).filter(toBoolean).length % 2 === 1,
  IFERROR: (val, ifErr) => (typeof val === 'string' && val.startsWith('#ERROR')) ? ifErr : val,
  IFNA: (val, ifNA) => (val === null || val === undefined) ? ifNA : val,

  // ===== INFORMATION =====
  ISBLANK: (v) => v === null || v === '',
  ISERROR: (v) => typeof v === 'string' && v.startsWith('#ERROR'),
  ISTEXT: (v) => typeof v === 'string',
  ISNUMBER: (v) => typeof v === 'number',
  ISLOGICAL: (v) => typeof v === 'boolean',
  ISEVEN: (v) => toNumber(v) % 2 === 0,
  ISODD: (v) => toNumber(v) % 2 !== 0,

  // ===== MATRIX FUNCTIONS =====

  /**
   * TRANSPOSE - Returns the transpose of an array or range
   * Example: TRANSPOSE([[1,2],[3,4]]) => [[1,3],[2,4]]
   */
  TRANSPOSE: (matrix) => {
    const mat = toMatrix(matrix);
    if (!mat || mat.length === 0) return [];

    const rows = mat.length;
    const cols = mat[0].length;
    const result: number[][] = [];

    for (let c = 0; c < cols; c++) {
      const newRow: number[] = [];
      for (let r = 0; r < rows; r++) {
        newRow.push(mat[r][c]);
      }
      result.push(newRow);
    }

    return result;
  },

  /**
   * MMULT - Returns the matrix product of two arrays
   * Example: MMULT([[1,2],[3,4]], [[5,6],[7,8]]) => [[19,22],[43,50]]
   */
  MMULT: (matrix1, matrix2) => {
    const mat1 = toMatrix(matrix1);
    const mat2 = toMatrix(matrix2);

    if (!mat1 || !mat2 || mat1.length === 0 || mat2.length === 0) {
      return '#VALUE!';
    }

    const rows1 = mat1.length;
    const cols1 = mat1[0].length;
    const rows2 = mat2.length;
    const cols2 = mat2[0].length;

    // Matrix multiplication requires cols1 === rows2
    if (cols1 !== rows2) {
      return '#VALUE!';
    }

    const result: number[][] = [];

    for (let i = 0; i < rows1; i++) {
      const row: number[] = [];
      for (let j = 0; j < cols2; j++) {
        let sum = 0;
        for (let k = 0; k < cols1; k++) {
          sum += mat1[i][k] * mat2[k][j];
        }
        row.push(sum);
      }
      result.push(row);
    }

    return result;
  },

  /**
   * MDETERM - Returns the matrix determinant of an array
   * Example: MDETERM([[1,2],[3,4]]) => -2
   */
  MDETERM: (matrix) => {
    const mat = toMatrix(matrix);

    if (!mat || mat.length === 0) {
      return '#VALUE!';
    }

    const rows = mat.length;
    const cols = mat[0].length;

    // Determinant only defined for square matrices
    if (rows !== cols) {
      return '#VALUE!';
    }

    return determinant(mat);
  },

  /**
   * MINVERSE - Returns the inverse matrix of an array
   * Example: MINVERSE([[1,2],[3,4]]) => [[-2,1],[1.5,-0.5]]
   */
  MINVERSE: (matrix) => {
    const mat = toMatrix(matrix);

    if (!mat || mat.length === 0) {
      return '#VALUE!';
    }

    const n = mat.length;
    const cols = mat[0].length;

    // Inverse only defined for square matrices
    if (n !== cols) {
      return '#VALUE!';
    }

    const det = determinant(mat);

    // Matrix is singular (not invertible)
    if (Math.abs(det) < 1e-10) {
      return '#NUM!';
    }

    return matrixInverse(mat);
  },

  // ===== PHYSICS: MECHANICS =====

  /**
   * PROJECTILE - Calculate projectile motion
   * Args: v0 (initial velocity), angle (radians), [g=9.81], [h0=0]
   * Returns: Array [maxHeight, range, flightTime]
   */
  PROJECTILE: (v0, angle, g = 9.81, h0 = 0) => {
    const result = Mechanics.projectileMotion(
      toNumber(v0),
      toNumber(angle),
      toNumber(g),
      toNumber(h0)
    );
    return [result.maxHeight, result.range, result.flightTime];
  },

  /**
   * KINETIC_ENERGY - Calculate kinetic energy: KE = 1/2 mv²
   * Args: mass, velocity (can be vector array)
   */
  KINETIC_ENERGY: (mass, ...velocityComponents) => {
    const m = toNumber(mass);
    const vData = velocityComponents.map(toNumber);
    const v = createVector(vData);
    return Mechanics.kineticEnergy(m, v);
  },

  /**
   * POTENTIAL_ENERGY - Calculate gravitational potential energy: PE = mgh
   * Args: mass, height, [g=9.81]
   */
  POTENTIAL_ENERGY: (mass, height, g = 9.81) => {
    return Mechanics.gravitationalPotentialEnergy(
      toNumber(mass),
      toNumber(height),
      toNumber(g)
    );
  },

  /**
   * SPRING_FORCE - Calculate spring force: F = -kx
   * Args: spring_constant, displacement
   */
  SPRING_FORCE: (k, x) => {
    return Mechanics.springForce(toNumber(k), toNumber(x));
  },

  /**
   * PENDULUM_PERIOD - Calculate period of simple pendulum: T = 2π√(L/g)
   * Args: length, [g=9.81]
   */
  PENDULUM_PERIOD: (L, g = 9.81) => {
    const omega = Math.sqrt(toNumber(g) / toNumber(L));
    return 2 * Math.PI / omega;
  },

  /**
   * ANGULAR_VELOCITY - Calculate angular velocity: ω = v/r
   * Args: velocity, radius
   */
  ANGULAR_VELOCITY: (v, r) => {
    return Mechanics.angularVelocity(toNumber(v), toNumber(r));
  },

  // ===== PHYSICS: QUANTUM MECHANICS =====

  /**
   * PARTICLE_IN_BOX - Calculate energy of particle in infinite square well
   * Args: n (quantum number), L (box length), [mass=electron mass]
   * Returns: energy in Joules
   */
  PARTICLE_IN_BOX: (n, L, mass = Quantum.m_e) => {
    const result = Quantum.particleInBox(
      Math.floor(toNumber(n)),
      toNumber(L),
      toNumber(mass)
    );
    return result.energy;
  },

  /**
   * QUANTUM_HO - Calculate energy of quantum harmonic oscillator
   * Args: n (quantum number), omega (angular frequency), [mass=electron mass]
   * Returns: energy = ħω(n + 1/2)
   */
  QUANTUM_HO: (n, omega, mass = Quantum.m_e) => {
    const result = Quantum.quantumHarmonicOscillator(
      Math.floor(toNumber(n)),
      toNumber(omega),
      toNumber(mass)
    );
    return result.energy;
  },

  /**
   * DE_BROGLIE - Calculate de Broglie wavelength: λ = h/p
   * Args: momentum
   */
  DE_BROGLIE: (momentum) => {
    return Quantum.deBroglieWavelength(toNumber(momentum));
  },

  /**
   * PHOTOELECTRIC - Calculate photoelectric effect
   * Args: wavelength (m), work_function (J)
   * Returns: Array [kineticEnergy, stoppingVoltage, canEject]
   */
  PHOTOELECTRIC: (wavelength, workFunction) => {
    const result = Quantum.photoelectricEffect(
      toNumber(wavelength),
      toNumber(workFunction)
    );
    return [result.kineticEnergy, result.stoppingVoltage, result.canEject ? 1 : 0];
  },

  /**
   * BOHR_ENERGY - Calculate energy of electron in Bohr model
   * Args: n (principal quantum number)
   * Returns: energy in Joules (negative = bound state)
   */
  BOHR_ENERGY: (n) => {
    const result = Quantum.bohrModel(Math.floor(toNumber(n)));
    return result.energy;
  },

  /**
   * PLANCK_CONSTANT - Returns Planck's constant in J·s
   */
  PLANCK: () => Quantum.h,

  /**
   * HBAR - Returns reduced Planck's constant in J·s
   */
  HBAR: () => Quantum.hbar,

  // ===== MATH: CALCULUS =====

  /**
   * DERIVATIVE - Numerical derivative at a point
   * Args: formula_reference, x_value, [h=1e-5]
   * Note: formula_reference should be a cell with a formula
   */
  DERIVATIVE: (fx, x, h = 1e-5) => {
    // Simple numerical derivative for scalar values
    // In practice, this would need to evaluate a formula at different points
    return '#N/A'; // Placeholder - requires formula evaluation context
  },

  /**
   * INTEGRATE - Numerical integration using Simpson's rule
   * Args: start, end, num_points, ...values
   * Note: values should be an array of function values at equally spaced points
   */
  INTEGRATE: (a, b, n, ...values) => {
    const start = toNumber(a);
    const end = toNumber(b);
    const points = toNumber(n);

    if (values.length === 0) return 0;

    const h = (end - start) / (points - 1);
    const vals = flattenArgs(values).map(toNumber);

    // Simpson's rule
    let sum = vals[0] + vals[vals.length - 1];
    for (let i = 1; i < vals.length - 1; i++) {
      sum += (i % 2 === 0 ? 2 : 4) * vals[i];
    }

    return (h / 3) * sum;
  },

  // ===== MATH: LINEAR ALGEBRA =====

  /**
   * DOT_PRODUCT - Calculate dot product of two vectors
   * Args: vector1, vector2 (arrays or ranges)
   */
  DOT_PRODUCT: (...args) => {
    const values = flattenArgs(args).map(toNumber);
    const mid = Math.floor(values.length / 2);
    const v1 = createVector(values.slice(0, mid));
    const v2 = createVector(values.slice(mid));
    return LinAlg.dotProduct(v1, v2);
  },

  /**
   * VECTOR_NORM - Calculate norm (magnitude) of a vector
   * Args: ...components or array
   */
  VECTOR_NORM: (...args) => {
    const values = flattenArgs(args).map(toNumber);
    const v = createVector(values);
    return LinAlg.magnitude(v);
  },

  /**
   * MATRIX_RANK - Calculate rank of a matrix
   * Args: matrix (2D array)
   */
  MATRIX_RANK: (matrix) => {
    const mat = toMatrix(matrix);
    if (!mat || mat.length === 0) return '#VALUE!';

    const m = createMatrix(mat);
    return LinAlg.rank(m);
  },

  /**
   * MATRIX_TRACE - Calculate trace (sum of diagonal) of a matrix
   * Args: matrix (square 2D array)
   */
  MATRIX_TRACE: (matrix) => {
    const mat = toMatrix(matrix);
    if (!mat || mat.length === 0) return '#VALUE!';

    const m = createMatrix(mat);
    return LinAlg.trace(m);
  },

  /**
   * CONDITION_NUMBER - Calculate condition number of a matrix
   * Args: matrix (square 2D array)
   */
  CONDITION_NUMBER: (matrix) => {
    const mat = toMatrix(matrix);
    if (!mat || mat.length === 0) return '#VALUE!';

    const m = createMatrix(mat);
    try {
      return LinAlg.conditionNumber(m);
    } catch (e) {
      return '#NUM!';
    }
  },

  // ===== STATISTICS: DISTRIBUTIONS =====

  /**
   * NORMAL_PDF - Normal distribution probability density function
   * Args: x, mean, std_dev
   */
  NORMAL_PDF: (x, mu, sigma) => {
    const dist = new Stats.NormalDistribution(toNumber(mu), toNumber(sigma));
    return dist.pdf(toNumber(x));
  },

  /**
   * NORMAL_CDF - Normal distribution cumulative distribution function
   * Args: x, mean, std_dev
   */
  NORMAL_CDF: (x, mu, sigma) => {
    const dist = new Stats.NormalDistribution(toNumber(mu), toNumber(sigma));
    return dist.cdf(toNumber(x));
  },

  /**
   * EXPONENTIAL_PDF - Exponential distribution PDF
   * Args: x, lambda
   */
  EXPONENTIAL_PDF: (x, lambda) => {
    const dist = new Stats.ExponentialDistribution(toNumber(lambda));
    return dist.pdf(toNumber(x));
  },

  /**
   * UNIFORM_PDF - Uniform distribution PDF
   * Args: x, min, max
   */
  UNIFORM_PDF: (x, min, max) => {
    const dist = new Stats.UniformDistribution(toNumber(min), toNumber(max));
    return dist.pdf(toNumber(x));
  },

  // ===== STATISTICS: INFERENCE =====

  /**
   * T_TEST - Perform one-sample t-test
   * Args: hypothesized_mean, alpha, ...data_values
   * Returns: Array [t-statistic, p-value, significant (1/0)]
   */
  T_TEST: (mu0, alpha, ...dataValues) => {
    const values = flattenArgs(dataValues).map(toNumber);
    const data = createVector(values);

    try {
      const result = Inference.oneSampleTTest(data, toNumber(mu0), toNumber(alpha));
      return [result.statistic, result.pValue, result.significant ? 1 : 0];
    } catch (e) {
      return '#NUM!';
    }
  },

  /**
   * T_TEST_TWO - Perform two-sample t-test
   * Args: alpha, ...data_values (first half = group1, second half = group2)
   * Returns: Array [t-statistic, p-value, significant (1/0)]
   */
  T_TEST_TWO: (alpha, ...dataValues) => {
    const values = flattenArgs(dataValues).map(toNumber);
    const mid = Math.floor(values.length / 2);
    const data1 = createVector(values.slice(0, mid));
    const data2 = createVector(values.slice(mid));

    try {
      const result = Inference.twoSampleTTest(data1, data2, toNumber(alpha));
      return [result.statistic, result.pValue, result.significant ? 1 : 0];
    } catch (e) {
      return '#NUM!';
    }
  },

  /**
   * CONFIDENCE_INTERVAL - Calculate confidence interval for mean
   * Args: confidence_level, ...data_values
   * Returns: Array [lower_bound, upper_bound]
   */
  CONFIDENCE_INTERVAL: (confidence, ...dataValues) => {
    const values = flattenArgs(dataValues).map(toNumber);
    const data = createVector(values);

    try {
      const result = Inference.meanConfidenceInterval(data, toNumber(confidence));
      return [result.lower, result.upper];
    } catch (e) {
      return '#NUM!';
    }
  },

  // ===== MACHINE LEARNING =====

  /**
   * LINEAR_REGRESSION - Perform linear regression
   * Args: y_values, x_values (same length)
   * Returns: Array [slope, intercept, r_squared]
   * Note: Simplified for single variable regression
   */
  LINEAR_REGRESSION: (...args) => {
    const values = flattenArgs(args).map(toNumber);
    const mid = Math.floor(values.length / 2);
    const yData = values.slice(0, mid);
    const xData = values.slice(mid);

    if (yData.length !== xData.length) return '#VALUE!';

    const n = yData.length;
    const sumX = xData.reduce((a, b) => a + b, 0);
    const sumY = yData.reduce((a, b) => a + b, 0);
    const sumXY = xData.reduce((sum, x, i) => sum + x * yData[i], 0);
    const sumX2 = xData.reduce((sum, x) => sum + x * x, 0);
    const sumY2 = yData.reduce((sum, y) => sum + y * y, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R²
    const meanY = sumY / n;
    const ssTotal = sumY2 - n * meanY * meanY;
    const ssRes = yData.reduce((sum, y, i) => {
      const pred = slope * xData[i] + intercept;
      return sum + (y - pred) ** 2;
    }, 0);
    const rSquared = 1 - ssRes / ssTotal;

    return [slope, intercept, rSquared];
  },

  // ===== PHYSICAL CONSTANTS =====

  /**
   * SPEED_OF_LIGHT - Speed of light in m/s
   */
  SPEED_OF_LIGHT: () => Quantum.c,

  /**
   * ELECTRON_MASS - Electron rest mass in kg
   */
  ELECTRON_MASS: () => Quantum.m_e,

  /**
   * ELEMENTARY_CHARGE - Elementary charge in Coulombs
   */
  ELEMENTARY_CHARGE: () => Quantum.e,

  /**
   * BOLTZMANN - Boltzmann constant in J/K
   */
  BOLTZMANN: () => Quantum.k_B,
};

// ===== HELPER FUNCTIONS =====

/**
 * Flatten nested arrays into a single array of values
 */
function flattenArgs(args: CellValue[]): CellValue[] {
  const result: CellValue[] = [];
  for (const arg of args) {
    if (Array.isArray(arg)) {
      result.push(...flattenArgs(arg));
    } else {
      result.push(arg);
    }
  }
  return result;
}

/**
 * Convert a value to a number
 */
function toNumber(value: CellValue): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

/**
 * Convert a value to a boolean
 */
function toBoolean(value: CellValue): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.toLowerCase() === 'true' || value !== '';
  return false;
}

/**
 * Check if a value meets criteria (for SUMIF, COUNTIF, etc.)
 * Supports operators: >, >=, <, <=, =, <>, and wildcards (* ?)
 */
function meetsCriteria(value: CellValue, criteria: CellValue): boolean {
  if (typeof criteria === 'string') {
    const criteriaStr = String(criteria);

    // Check for comparison operators
    const match = criteriaStr.match(/^([<>=!]+)(.*)$/);
    if (match) {
      const op = match[1];
      const compareValue = match[2];
      const numValue = toNumber(value);
      const numCompare = toNumber(compareValue);

      switch (op) {
        case '>': return numValue > numCompare;
        case '>=': return numValue >= numCompare;
        case '<': return numValue < numCompare;
        case '<=': return numValue <= numCompare;
        case '=': return value === compareValue || numValue === numCompare;
        case '<>':
        case '!=': return value !== compareValue && numValue !== numCompare;
      }
    }

    // Check for wildcard matching
    if (criteriaStr.includes('*') || criteriaStr.includes('?')) {
      const regex = new RegExp('^' + criteriaStr.replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
      return regex.test(String(value));
    }
  }

  return value === criteria;
}

/**
 * Convert a value to a matrix (2D array of numbers)
 */
function toMatrix(value: CellValue): number[][] | null {
  // If it's already a 2D array, convert to numbers
  if (Array.isArray(value)) {
    // Check if it's a 2D array
    if (Array.isArray(value[0])) {
      return (value as CellValue[][]).map(row =>
        row.map(cell => toNumber(cell))
      );
    }
    // If it's a 1D array, treat as a single row
    return [(value as CellValue[]).map(cell => toNumber(cell))];
  }

  // If it's a single value, treat as 1x1 matrix
  return [[toNumber(value)]];
}

/**
 * Calculate the determinant of a square matrix using Laplace expansion
 */
function determinant(matrix: number[][]): number {
  const n = matrix.length;

  // Base case: 1x1 matrix
  if (n === 1) {
    return matrix[0][0];
  }

  // Base case: 2x2 matrix
  if (n === 2) {
    return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
  }

  // Recursive case: Use Laplace expansion along first row
  let det = 0;
  for (let j = 0; j < n; j++) {
    const minor = getMinor(matrix, 0, j);
    const cofactor = Math.pow(-1, j) * matrix[0][j] * determinant(minor);
    det += cofactor;
  }

  return det;
}

/**
 * Get the minor matrix by removing row i and column j
 */
function getMinor(matrix: number[][], rowToRemove: number, colToRemove: number): number[][] {
  const result: number[][] = [];

  for (let i = 0; i < matrix.length; i++) {
    if (i === rowToRemove) continue;

    const row: number[] = [];
    for (let j = 0; j < matrix[i].length; j++) {
      if (j === colToRemove) continue;
      row.push(matrix[i][j]);
    }
    result.push(row);
  }

  return result;
}

/**
 * Calculate the inverse of a square matrix using Gauss-Jordan elimination
 */
function matrixInverse(matrix: number[][]): number[][] {
  const n = matrix.length;

  // Create augmented matrix [A | I]
  const augmented: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [...matrix[i]];
    for (let j = 0; j < n; j++) {
      row.push(i === j ? 1 : 0);
    }
    augmented.push(row);
  }

  // Forward elimination
  for (let i = 0; i < n; i++) {
    // Find pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k;
      }
    }

    // Swap rows
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

    // Make diagonal element 1
    const pivot = augmented[i][i];
    if (Math.abs(pivot) < 1e-10) {
      throw new Error('Matrix is singular');
    }

    for (let j = 0; j < 2 * n; j++) {
      augmented[i][j] /= pivot;
    }

    // Eliminate column
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = augmented[k][i];
      for (let j = 0; j < 2 * n; j++) {
        augmented[k][j] -= factor * augmented[i][j];
      }
    }
  }

  // Extract inverse from right half of augmented matrix
  const inverse: number[][] = [];
  for (let i = 0; i < n; i++) {
    inverse.push(augmented[i].slice(n));
  }

  return inverse;
}
