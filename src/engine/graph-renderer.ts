/**
 * Graph Renderer
 * Uses the same AST as spreadsheet formulas - NO duplicate parsing!
 */

import { GraphDefinition, Worksheet } from './types';
import { Evaluator } from './evaluator';

export interface Point {
  coords: number[];
}

export interface GraphData {
  id: string;
  points: Point[];
  color: string;
  visible: boolean;
  dimensions: number;
  type: GraphDefinition['type'];
}

interface CacheEntry {
  points: Point[];
  cellVersions: Map<string, number>;
}

export class GraphRenderer {
  private worksheet: Worksheet;
  private cache: Map<string, CacheEntry> = new Map();
  private cellVersions: Map<string, number> = new Map();

  constructor(worksheet: Worksheet) {
    this.worksheet = worksheet;
  }

  /**
   * Invalidate cache for specific cells
   */
  invalidateCache(cellKeys: string[]): void {
    for (const key of cellKeys) {
      const currentVersion = this.cellVersions.get(key) || 0;
      this.cellVersions.set(key, currentVersion + 1);
    }
  }

  /**
   * Check if cached data is still valid
   */
  private isCacheValid(graph: GraphDefinition, cacheKey: string): boolean {
    const cached = this.cache.get(cacheKey);
    if (!cached) return false;

    // Check if any cell dependencies have changed
    for (const cellKey of graph.cellBindings) {
      const cachedVersion = cached.cellVersions.get(cellKey) || 0;
      const currentVersion = this.cellVersions.get(cellKey) || 0;
      if (cachedVersion !== currentVersion) {
        return false;
      }
    }

    return true;
  }

  /**
   * Render a function graph: y = f(x)
   * OPTIMIZED: Caches results if cell dependencies haven't changed
   */
  renderFunction(graph: GraphDefinition, resolution: number = 1000): Point[] {
    const cacheKey = `${graph.id}-${resolution}-${graph.domain?.min}-${graph.domain?.max}`;

    // Check cache
    if (this.isCacheValid(graph, cacheKey)) {
      return this.cache.get(cacheKey)!.points;
    }

    // Cache miss - compute points
    const points: Point[] = [];
    const { min, max } = graph.domain || { min: -10, max: 10 };
    const step = (max - min) / resolution;

    const evaluator = new Evaluator(this.worksheet);

    for (let i = 0; i <= resolution; i++) {
      const x = min + i * step;

      try {
        const y = evaluator.evaluate(graph.ast, { x });

        if (typeof y === 'number' && isFinite(y)) {
          points.push({ coords: [x, y] });
        } else {
          // Discontinuity - add break in the line
          if (points.length > 0 && !points[points.length - 1]) {
            continue;
          }
          points.push(null as any); // Mark discontinuity
        }
      } catch {
        // Evaluation error - skip point
        if (points.length > 0 && points[points.length - 1] !== null) {
          points.push(null as any);
        }
      }
    }

    const filteredPoints = points.filter((p) => p !== null);

    // Store in cache
    const cellVersions = new Map<string, number>();
    for (const cellKey of graph.cellBindings) {
      cellVersions.set(cellKey, this.cellVersions.get(cellKey) || 0);
    }
    this.cache.set(cacheKey, { points: filteredPoints, cellVersions });

    return filteredPoints;
  }

  /**
   * Render data-driven plots created via PLOT formulas.
   * Supports both axis-aligned arguments (e.g., PLOT(Xs, Ys, Zs)) and tuple-style
   * inputs such as COORD(x,y,z).
   */
  private renderPlot(graph: GraphDefinition): Point[] {
    if (!graph.ast || graph.ast.type !== 'function') {
      return [];
    }

    const evaluator = new Evaluator(this.worksheet);
    const axisData: number[][] = [];
    const tuplePoints: number[][] = [];

    for (const arg of graph.ast.args) {
      try {
        const value = evaluator.evaluate(arg);
        const flattened = this.flattenValues(value);
        const tuples = this.extractTuples(value);

        if (tuples.length > 0) {
          tuplePoints.push(...tuples);
        } else if (flattened.length > 0) {
          axisData.push(flattened);
        }
      } catch {
        axisData.push([]);
      }
    }

    // If tuples were provided (e.g., COORD outputs), return them directly.
    if (tuplePoints.length > 0) {
      return tuplePoints
        .filter((tuple) => tuple.length >= 2)
        .map((coords) => ({ coords }));
    }

    if (axisData.length < 2) {
      return [];
    }

    const primaryAxisLength = Math.min(...axisData.map((axis) => axis.length));
    const points: Point[] = [];

    for (let i = 0; i < primaryAxisLength; i++) {
      const coords: number[] = [];
      for (const axis of axisData) {
        const value = axis[i];
        coords.push(isFinite(value) ? value : NaN);
      }
      if (coords.length >= 2 && coords.every((v) => Number.isFinite(v))) {
        points.push({ coords });
      }
    }

    return points;
  }

  private flattenValues(value: any): number[] {
    if (Array.isArray(value)) {
      const result: number[] = [];
      for (const v of value) {
        result.push(...this.flattenValues(v));
      }
      return result;
    }
    if (typeof value === 'number') {
      return [value];
    }
    if (typeof value === 'boolean') {
      return [value ? 1 : 0];
    }
    const num = Number(value);
    return Number.isFinite(num) ? [num] : [];
  }

  private extractTuples(value: any): number[][] {
    if (!Array.isArray(value)) {
      return [];
    }

    // Single tuple such as COORD(x,y,z)
    if (value.every((v) => typeof v === 'number' && Number.isFinite(v))) {
      return [value as number[]];
    }

    const tuples: number[][] = [];
    for (const entry of value) {
      if (Array.isArray(entry)) {
        const flattened = this.flattenValues(entry);
        if (flattened.length >= 2) {
          tuples.push(flattened);
        }
      }
    }
    return tuples;
  }

  /**
   * Render all graphs in the worksheet
   */
  renderAll(resolution: number = 1000): GraphData[] {
    const graphsData: GraphData[] = [];

    for (const graph of this.worksheet.graphs.values()) {
      if (!graph.visible) continue;

      let points: Point[] = [];

      switch (graph.type) {
        case 'function':
          points = this.renderFunction(graph, resolution);
          break;

        case 'plot': {
          const cacheKey = `${graph.id}-plot-${graph.ast.args.length}`;
          if (this.isCacheValid(graph, cacheKey)) {
            points = this.cache.get(cacheKey)!.points;
          } else {
            points = this.renderPlot(graph);
            const cellVersions = new Map<string, number>();
            for (const cellKey of graph.cellBindings) {
              cellVersions.set(cellKey, this.cellVersions.get(cellKey) || 0);
            }
            this.cache.set(cacheKey, { points, cellVersions });
          }
          break;
        }

        case 'parametric': {
          // Parametric plots: x = f(t), y = g(t)
          const cacheKey = `${graph.id}-${resolution}`;

          // Check cache
          if (this.isCacheValid(graph, cacheKey)) {
            points = this.cache.get(cacheKey)!.points;
          } else {
            const { min, max } = graph.domain || { min: 0, max: 2 * Math.PI };
            const step = (max - min) / resolution;
            const evaluator = new Evaluator(this.worksheet);

            for (let i = 0; i <= resolution; i++) {
              const t = min + i * step;
              try {
                // Evaluate formula with parameter t
                const result = evaluator.evaluate(graph.ast, { t });

                // Expect result to be an array [x, y] or object with x, y properties
                if (Array.isArray(result) && result.length >= 2) {
                  const [x, y] = result;
                  if (typeof x === 'number' && typeof y === 'number' && isFinite(x) && isFinite(y)) {
                    const coords: number[] = [x, y];
                    if (typeof result[2] === 'number' && isFinite(result[2])) {
                      coords.push(result[2]);
                    }
                    points.push({ coords });
                  }
                }
              } catch {
                // Skip on error
              }
            }

            // Cache result
            const cellVersions = new Map<string, number>();
            for (const cellKey of graph.cellBindings) {
              cellVersions.set(cellKey, this.cellVersions.get(cellKey) || 0);
            }
            this.cache.set(cacheKey, { points, cellVersions });
          }
          break;
        }

        case 'implicit': {
          // Implicit plots: f(x,y) = 0
          // Simplified approach: sample grid and find near-zero values
          const cacheKey = `${graph.id}-${resolution}`;

          // Check cache
          if (this.isCacheValid(graph, cacheKey)) {
            points = this.cache.get(cacheKey)!.points;
          } else {
            const { min: xMin, max: xMax } = graph.domain || { min: -10, max: 10 };
            const { min: yMin, max: yMax } = graph.range || { min: -10, max: 10 };
            const gridRes = Math.floor(Math.sqrt(resolution)); // e.g., 30x30 grid for 900 resolution
            const xStep = (xMax - xMin) / gridRes;
            const yStep = (yMax - yMin) / gridRes;
            const evaluator = new Evaluator(this.worksheet);

            // Sample grid and find zero crossings
            for (let xi = 0; xi <= gridRes; xi++) {
              for (let yi = 0; yi <= gridRes; yi++) {
                const x = xMin + xi * xStep;
                const y = yMin + yi * yStep;

                try {
                  const val = evaluator.evaluate(graph.ast, { x, y });
                  // Plot points where f(x,y) is close to zero
                  if (typeof val === 'number' && Math.abs(val) < 0.1) {
                    points.push({ coords: [x, y] });
                  }
                } catch {
                  // Skip on error
                }
              }
            }

            // Cache result
            const cellVersions = new Map<string, number>();
            for (const cellKey of graph.cellBindings) {
              cellVersions.set(cellKey, this.cellVersions.get(cellKey) || 0);
            }
            this.cache.set(cacheKey, { points, cellVersions });
          }
          break;
        }

        case 'scatter': {
          // Scatter plots: plot discrete points from cell ranges
          // Extract x and y values from cell bindings
          const xValues: number[] = [];
          const yValues: number[] = [];

          // Sort cell keys to ensure consistent ordering
          const sortedCellKeys = Array.from(graph.cellBindings).sort();

          for (const cellKey of sortedCellKeys) {
            const cell = this.worksheet.cells.get(cellKey);
            if (cell && typeof cell.value === 'number') {
              // Alternate between x and y values
              if (xValues.length === yValues.length) {
                xValues.push(cell.value);
              } else {
                yValues.push(cell.value);
              }
            }
          }

          // Create points from paired values
          for (let i = 0; i < Math.min(xValues.length, yValues.length); i++) {
            points.push({ coords: [xValues[i], yValues[i]] });
          }
          break;
        }
      }

      graphsData.push({
        id: graph.id,
        points,
        color: graph.color,
        visible: graph.visible,
        dimensions: Math.max(graph.dimensions || 2, points[0]?.coords.length || 0, 2),
        type: graph.type,
      });
    }

    return graphsData;
  }

  /**
   * Get the bounding box for all visible graphs
   */
  getBounds(): { xMin: number; xMax: number; yMin: number; yMax: number } {
    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;

    for (const graph of this.worksheet.graphs.values()) {
      if (!graph.visible) continue;

      if (graph.domain) {
        xMin = Math.min(xMin, graph.domain.min);
        xMax = Math.max(xMax, graph.domain.max);
      }

      if (graph.range) {
        yMin = Math.min(yMin, graph.range.min);
        yMax = Math.max(yMax, graph.range.max);
      }
    }

    if (!isFinite(xMin)) {
      return { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
    }

    return { xMin, xMax, yMin, yMax };
  }
}
