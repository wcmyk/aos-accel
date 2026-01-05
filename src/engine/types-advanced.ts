/**
 * Advanced Types for Scientific Computing
 * Extends core types with vector/matrix support, value typing, and blocks
 */

import { CellAddress, CellValue, ASTNode } from './types';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VALUE TYPING SYSTEM (Critical)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type ValueType =
  | 'constant'           // Fixed value (e.g., π, c, g)
  | 'parameter'          // Sweepable parameter
  | 'measurement'        // Value with uncertainty
  | 'random'             // Random variable (distribution)
  | 'learnable'          // ML parameter (trainable)
  | 'derived';           // Computed from other values

export interface ValueMetadata {
  type: ValueType;
  unit?: Unit;
  uncertainty?: Uncertainty;
  distribution?: Distribution;
  constraints?: Constraint[];
  isDirty?: boolean;
  lastComputed?: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UNITS & DIMENSIONAL ANALYSIS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface Unit {
  dimension: string;      // "length", "mass", "time", "temperature"
  symbol: string;         // "m", "kg", "s", "K"
  factor: number;         // Conversion factor to SI base unit
  offset?: number;        // Offset (for Celsius, Fahrenheit)
}

export const SI_UNITS: Record<string, Unit> = {
  meter: { dimension: 'length', symbol: 'm', factor: 1 },
  kilogram: { dimension: 'mass', symbol: 'kg', factor: 1 },
  second: { dimension: 'time', symbol: 's', factor: 1 },
  kelvin: { dimension: 'temperature', symbol: 'K', factor: 1 },
  ampere: { dimension: 'current', symbol: 'A', factor: 1 },
  mole: { dimension: 'amount', symbol: 'mol', factor: 1 },
  candela: { dimension: 'luminosity', symbol: 'cd', factor: 1 },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UNCERTAINTY & MEASUREMENTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface Uncertainty {
  type: 'absolute' | 'relative' | 'distribution';
  value: number;
  confidenceLevel?: number;  // e.g., 0.95 for 95% CI
}

export interface Measurement {
  value: number;
  uncertainty: Uncertainty;
  unit?: Unit;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DISTRIBUTIONS (First-class objects, not functions)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type Distribution =
  | { type: 'normal'; mu: number; sigma: number }
  | { type: 'uniform'; min: number; max: number }
  | { type: 'binomial'; n: number; p: number }
  | { type: 'poisson'; lambda: number }
  | { type: 'exponential'; lambda: number }
  | { type: 'student-t'; df: number; mu?: number; sigma?: number }
  | { type: 'chi-square'; df: number }
  | { type: 'multivariate-normal'; mu: Vector; cov: Matrix };

export interface RandomVariable {
  name: string;
  distribution: Distribution;
  seed?: number;
  samples?: number[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VECTOR & MATRIX TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface Vector {
  type: 'vector';
  data: number[];
  length: number;
  unit?: Unit;
}

export interface Matrix {
  type: 'matrix';
  data: number[][];
  rows: number;
  cols: number;
  sparse?: boolean;
  unit?: Unit;
}

export interface BlockMatrix {
  type: 'block-matrix';
  blocks: Matrix[][];
  blockRows: number;
  blockCols: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADVANCED CELL VALUE (Unified type)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type AdvancedCellValue =
  | number
  | string
  | boolean
  | null
  | Vector
  | Matrix
  | Measurement
  | RandomVariable
  | Distribution;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BLOCK SYSTEM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type BlockType =
  | 'scalar'             // Single value
  | 'vector'             // 1D array
  | 'matrix'             // 2D array
  | 'operator'           // Differential operator
  | 'solver'             // Equation solver
  | 'plot'               // Graph/visualization
  | 'table'              // Result table
  | 'hidden';            // Engine-generated (internal)

export interface Block {
  id: string;
  type: BlockType;
  address?: CellAddress;
  formula?: string;
  ast?: ASTNode;
  value: AdvancedCellValue;
  metadata: ValueMetadata;
  dependencies: Set<string>;
  dependents: Set<string>;
  hidden?: boolean;
}

export interface VectorBlock extends Block {
  type: 'vector';
  value: Vector;
  dimension: number;
}

export interface MatrixBlock extends Block {
  type: 'matrix';
  value: Matrix;
  shape: [number, number];
}

export interface SolverBlock extends Block {
  type: 'solver';
  equation: ASTNode;
  variable: string;
  method: 'newton' | 'bisection' | 'gradient-descent';
  tolerance: number;
  maxIterations: number;
  solution?: number | Vector | Matrix;
  converged?: boolean;
}

export interface PlotBlock extends Block {
  type: 'plot';
  plotType: 'line' | 'scatter' | 'heatmap' | 'contour' | 'vector-field';
  xData: Vector;
  yData: Vector;
  zData?: Matrix;
  options: PlotOptions;
}

export interface TableBlock extends Block {
  type: 'table';
  columns: string[];
  rows: AdvancedCellValue[][];
  metadata: {
    experimentId?: string;
    timestamp?: number;
    parameters?: Record<string, any>;
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VISUALIZATION OPTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface PlotOptions {
  title?: string;
  xlabel?: string;
  ylabel?: string;
  zlabel?: string;
  color?: string;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  markerStyle?: 'circle' | 'square' | 'triangle';
  showErrorBars?: boolean;
  showConfidenceBand?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTRAINTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type Constraint =
  | { type: 'range'; min: number; max: number }
  | { type: 'positive' }
  | { type: 'negative' }
  | { type: 'integer' }
  | { type: 'normalized' }                    // Sum to 1
  | { type: 'orthogonal' }                    // For vectors
  | { type: 'positive-definite' }             // For matrices
  | { type: 'custom'; check: (value: any) => boolean };

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DAG NODE (Enhanced for dirty tracking)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface DAGNode {
  id: string;
  block: Block;
  isDirty: boolean;
  lastComputed: number;
  computationTime: number;
  dependencies: Set<string>;
  dependents: Set<string>;
  level: number;  // Topological level
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXECUTION CONTEXT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ExecutionContext {
  deterministic: boolean;
  seed?: number;
  precision: 'single' | 'double' | 'arbitrary';
  maxIterations?: number;
  tolerance?: number;
  parallel?: boolean;
  useWorkers?: boolean;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPERIMENT SYSTEM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ParameterSweep {
  parameter: string;
  values: number[];
  spacing: 'linear' | 'log' | 'custom';
  bounds?: { min: number; max: number };
}

export interface MultiParameterSweep {
  sweeps: ParameterSweep[];
  mode: 'grid' | 'partial' | 'filtered';
  filter?: (params: Record<string, number>) => boolean;
}

export interface ExperimentRun {
  id: string;
  timestamp: number;
  parameters: Record<string, number>;
  results: Record<string, AdvancedCellValue>;
  metadata: {
    seed?: number;
    executionTime: number;
    converged?: boolean;
    warnings?: string[];
  };
}

export interface ExperimentResults {
  experimentId: string;
  runs: ExperimentRun[];
  parameters: string[];
  outputs: string[];
  summary: {
    totalRuns: number;
    successRate: number;
    avgExecutionTime: number;
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ML TYPES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface Model {
  type: 'linear' | 'logistic' | 'neural' | 'physics-informed';
  parameters: Matrix | Vector;
  hyperparameters: Record<string, number>;
  trained: boolean;
  trainingHistory?: TrainingHistory;
}

export interface TrainingHistory {
  epochs: number[];
  losses: number[];
  validationLosses?: number[];
  metrics?: Record<string, number[]>;
  convergence: boolean;
}

export interface LossFunction {
  type: 'mse' | 'mae' | 'cross-entropy' | 'custom';
  regularization?: {
    type: 'l1' | 'l2' | 'elastic-net';
    lambda: number;
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CHAT → MODEL IR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ModelIR {
  intent: 'physics' | 'math' | 'stats' | 'ml';
  template: string;
  variables: Record<string, { type: ValueType; unit?: string; default?: any }>;
  equations: string[];
  parameters: string[];
  outputs: string[];
  constraints?: Constraint[];
  assumptions: string[];
}

export interface SheetTemplate {
  name: string;
  blocks: Block[];
  layout: {
    blockId: string;
    position: { row: number; col: number };
  }[];
  instructions: string[];
}
