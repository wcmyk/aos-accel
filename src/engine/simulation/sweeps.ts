/**
 * Parameter Sweep & Experiment System
 * Features:
 * - Single & multi-parameter sweeps
 * - Grid, partial, and filtered sweeps
 * - Batch execution
 * - Result collection & export
 * - Reproducibility (seeds, snapshots)
 */

import {
  ParameterSweep,
  MultiParameterSweep,
  ExperimentRun,
  ExperimentResults,
  AdvancedCellValue,
} from '../types-advanced';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SWEEP GENERATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function generateLinearSweep(
  min: number,
  max: number,
  steps: number
): number[] {
  const values: number[] = [];
  const step = (max - min) / (steps - 1);

  for (let i = 0; i < steps; i++) {
    values.push(min + i * step);
  }

  return values;
}

export function generateLogSweep(
  min: number,
  max: number,
  steps: number
): number[] {
  if (min <= 0 || max <= 0) {
    throw new Error('Log sweep requires positive bounds');
  }

  const values: number[] = [];
  const logMin = Math.log10(min);
  const logMax = Math.log10(max);
  const step = (logMax - logMin) / (steps - 1);

  for (let i = 0; i < steps; i++) {
    values.push(Math.pow(10, logMin + i * step));
  }

  return values;
}

export function createParameterSweep(
  parameter: string,
  bounds: { min: number; max: number },
  steps: number,
  spacing: 'linear' | 'log' = 'linear'
): ParameterSweep {
  const values =
    spacing === 'log'
      ? generateLogSweep(bounds.min, bounds.max, steps)
      : generateLinearSweep(bounds.min, bounds.max, steps);

  return {
    parameter,
    values,
    spacing,
    bounds,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MULTI-PARAMETER SWEEP GENERATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function generateGridSweep(sweeps: ParameterSweep[]): Record<string, number>[] {
  if (sweeps.length === 0) return [];

  // Generate all combinations (Cartesian product)
  const result: Record<string, number>[] = [];

  function generate(index: number, current: Record<string, number>) {
    if (index === sweeps.length) {
      result.push({ ...current });
      return;
    }

    const sweep = sweeps[index];
    for (const value of sweep.values) {
      current[sweep.parameter] = value;
      generate(index + 1, current);
    }
  }

  generate(0, {});
  return result;
}

export function generatePartialSweep(
  sweeps: ParameterSweep[]
): Record<string, number>[] {
  if (sweeps.length === 0) return [];

  // All sweeps must have same number of points
  const numPoints = sweeps[0].values.length;
  for (const sweep of sweeps) {
    if (sweep.values.length !== numPoints) {
      throw new Error('Partial sweep requires all parameters to have same number of points');
    }
  }

  const result: Record<string, number>[] = [];

  for (let i = 0; i < numPoints; i++) {
    const point: Record<string, number> = {};
    for (const sweep of sweeps) {
      point[sweep.parameter] = sweep.values[i];
    }
    result.push(point);
  }

  return result;
}

export function generateFilteredSweep(
  multiSweep: MultiParameterSweep
): Record<string, number>[] {
  const gridPoints = generateGridSweep(multiSweep.sweeps);

  if (!multiSweep.filter) {
    return gridPoints;
  }

  return gridPoints.filter(multiSweep.filter);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPERIMENT RUNNER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type ComputeFunction = (
  parameters: Record<string, number>
) => Promise<Record<string, AdvancedCellValue>>;

export class ExperimentRunner {
  private experimentId: string;
  private seed?: number;

  constructor(experimentId: string = `exp_${Date.now()}`, seed?: number) {
    this.experimentId = experimentId;
    this.seed = seed;
  }

  /**
   * Run single-parameter sweep
   */
  async runSweep(
    sweep: ParameterSweep,
    compute: ComputeFunction,
    options: { deterministic?: boolean; parallel?: boolean } = {}
  ): Promise<ExperimentResults> {
    const parameterSets = sweep.values.map(value => ({
      [sweep.parameter]: value,
    }));

    return this.runBatch(parameterSets, compute, options);
  }

  /**
   * Run multi-parameter sweep
   */
  async runMultiSweep(
    multiSweep: MultiParameterSweep,
    compute: ComputeFunction,
    options: { deterministic?: boolean; parallel?: boolean } = {}
  ): Promise<ExperimentResults> {
    let parameterSets: Record<string, number>[];

    switch (multiSweep.mode) {
      case 'grid':
        parameterSets = generateGridSweep(multiSweep.sweeps);
        break;
      case 'partial':
        parameterSets = generatePartialSweep(multiSweep.sweeps);
        break;
      case 'filtered':
        parameterSets = generateFilteredSweep(multiSweep);
        break;
      default:
        throw new Error(`Unknown sweep mode: ${multiSweep.mode}`);
    }

    return this.runBatch(parameterSets, compute, options);
  }

  /**
   * Run batch of parameter sets
   */
  async runBatch(
    parameterSets: Record<string, number>[],
    compute: ComputeFunction,
    options: { deterministic?: boolean; parallel?: boolean } = {}
  ): Promise<ExperimentResults> {
    const runs: ExperimentRun[] = [];
    const startTime = Date.now();

    // Collect parameter names
    const parameters = parameterSets.length > 0 ? Object.keys(parameterSets[0]) : [];

    if (options.parallel) {
      // Parallel execution
      const promises = parameterSets.map((params, index) =>
        this.runSingle(params, compute, index)
      );
      runs.push(...(await Promise.all(promises)));
    } else {
      // Sequential execution
      for (let index = 0; index < parameterSets.length; index++) {
        const run = await this.runSingle(parameterSets[index], compute, index);
        runs.push(run);
      }
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Collect output names
    const outputs = runs.length > 0 ? Object.keys(runs[0].results) : [];

    // Calculate summary stats
    const successfulRuns = runs.filter(r => !r.metadata.warnings || r.metadata.warnings.length === 0);
    const successRate = runs.length > 0 ? successfulRuns.length / runs.length : 0;
    const avgExecutionTime = runs.length > 0
      ? runs.reduce((sum, r) => sum + r.metadata.executionTime, 0) / runs.length
      : 0;

    return {
      experimentId: this.experimentId,
      runs,
      parameters,
      outputs,
      summary: {
        totalRuns: runs.length,
        successRate,
        avgExecutionTime,
      },
    };
  }

  /**
   * Run single parameter set
   */
  private async runSingle(
    parameters: Record<string, number>,
    compute: ComputeFunction,
    index: number
  ): Promise<ExperimentRun> {
    const runId = `${this.experimentId}_${index}`;
    const timestamp = Date.now();
    const startTime = performance.now();

    const warnings: string[] = [];
    let results: Record<string, AdvancedCellValue> = {};
    let converged: boolean | undefined;

    try {
      results = await compute(parameters);

      // Check for convergence indicators in results
      if ('converged' in results && typeof results.converged === 'boolean') {
        converged = results.converged as boolean;
      }
    } catch (error) {
      warnings.push(`Execution failed: ${(error as Error).message}`);
    }

    const endTime = performance.now();
    const executionTime = endTime - startTime;

    return {
      id: runId,
      timestamp,
      parameters,
      results,
      metadata: {
        seed: this.seed,
        executionTime,
        converged,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
    };
  }

  /**
   * Export results to CSV
   */
  exportToCSV(results: ExperimentResults): string {
    const headers = [...results.parameters, ...results.outputs];
    const rows: string[][] = [headers];

    for (const run of results.runs) {
      const row: string[] = [];

      // Add parameter values
      for (const param of results.parameters) {
        row.push(String(run.parameters[param]));
      }

      // Add output values
      for (const output of results.outputs) {
        const value = run.results[output];
        if (typeof value === 'number') {
          row.push(value.toString());
        } else if (typeof value === 'string') {
          row.push(value);
        } else {
          row.push(JSON.stringify(value));
        }
      }

      rows.push(row);
    }

    return rows.map(row => row.join(',')).join('\n');
  }

  /**
   * Export results to JSON
   */
  exportToJSON(results: ExperimentResults): string {
    return JSON.stringify(results, null, 2);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RESULT ANALYSIS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function findOptimum(
  results: ExperimentResults,
  outputName: string,
  mode: 'min' | 'max'
): { parameters: Record<string, number>; value: number } | null {
  let bestRun: ExperimentRun | null = null;
  let bestValue: number = mode === 'min' ? Infinity : -Infinity;

  for (const run of results.runs) {
    const value = run.results[outputName];
    if (typeof value !== 'number') continue;

    if ((mode === 'min' && value < bestValue) || (mode === 'max' && value > bestValue)) {
      bestValue = value;
      bestRun = run;
    }
  }

  if (!bestRun) return null;

  return {
    parameters: bestRun.parameters,
    value: bestValue,
  };
}

export function analyzeConvergence(results: ExperimentResults): {
  convergedRuns: number;
  convergenceRate: number;
  unconvergedParameters: Record<string, number>[];
} {
  const convergedRuns = results.runs.filter(
    r => r.metadata.converged === true
  ).length;

  const convergenceRate = results.runs.length > 0 ? convergedRuns / results.runs.length : 0;

  const unconvergedParameters = results.runs
    .filter(r => r.metadata.converged === false)
    .map(r => r.parameters);

  return {
    convergedRuns,
    convergenceRate,
    unconvergedParameters,
  };
}

export function computeSensitivity(
  results: ExperimentResults,
  parameter: string,
  outputName: string
): { correlation: number; values: Array<{ x: number; y: number }> } {
  const values: Array<{ x: number; y: number }> = [];

  for (const run of results.runs) {
    const x = run.parameters[parameter];
    const y = run.results[outputName];

    if (typeof x === 'number' && typeof y === 'number') {
      values.push({ x, y });
    }
  }

  // Compute Pearson correlation
  if (values.length === 0) {
    return { correlation: 0, values: [] };
  }

  const meanX = values.reduce((sum, v) => sum + v.x, 0) / values.length;
  const meanY = values.reduce((sum, v) => sum + v.y, 0) / values.length;

  const numerator = values.reduce((sum, v) => sum + (v.x - meanX) * (v.y - meanY), 0);
  const denomX = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v.x - meanX, 2), 0));
  const denomY = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v.y - meanY, 2), 0));

  const correlation = denomX * denomY !== 0 ? numerator / (denomX * denomY) : 0;

  return { correlation, values };
}
