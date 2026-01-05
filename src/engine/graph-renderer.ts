/**
 * Graph Renderer
 * Uses the same AST as spreadsheet formulas - NO duplicate parsing!
 */

import { GraphDefinition, Worksheet } from './types';
import { Evaluator } from './evaluator';

export interface Point {
  x: number;
  y: number;
}

export interface GraphData {
  id: string;
  points: Point[];
  color: string;
  visible: boolean;
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
          points.push({ x, y });
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
   * Render parametric equations: x = f(t), y = g(t)
   */
  renderParametric(graph: GraphDefinition, resolution: number = 1000): Point[] {
    const cacheKey = `${graph.id}-parametric-${resolution}`;

    if (this.isCacheValid(graph, cacheKey)) {
      return this.cache.get(cacheKey)!.points;
    }

    const points: Point[] = [];
    const { min, max } = graph.domain || { min: 0, max: 2 * Math.PI };
    const step = (max - min) / resolution;

    const evaluator = new Evaluator(this.worksheet);

    // Parametric requires two ASTs: one for x(t) and one for y(t)
    // For now, treat the main AST as y(t) and use t as x
    // Full implementation would parse "x(t), y(t)" format

    for (let i = 0; i <= resolution; i++) {
      const t = min + i * step;

      try {
        const x = t; // Simplified - would evaluate x(t) AST
        const y = evaluator.evaluate(graph.ast, { t });

        if (typeof y === 'number' && isFinite(y)) {
          points.push({ x, y });
        }
      } catch {
        // Skip evaluation errors
      }
    }

    const cellVersions = new Map<string, number>();
    for (const cellKey of graph.cellBindings) {
      cellVersions.set(cellKey, this.cellVersions.get(cellKey) || 0);
    }
    this.cache.set(cacheKey, { points, cellVersions });

    return points;
  }

  /**
   * Render implicit equations: f(x,y) = 0
   * Uses marching squares algorithm
   */
  renderImplicit(graph: GraphDefinition, resolution: number = 100): Point[] {
    const cacheKey = `${graph.id}-implicit-${resolution}`;

    if (this.isCacheValid(graph, cacheKey)) {
      return this.cache.get(cacheKey)!.points;
    }

    const points: Point[] = [];
    const { min: xMin = -10, max: xMax = 10 } = graph.domain || {};
    const yMin = xMin;
    const yMax = xMax;

    const evaluator = new Evaluator(this.worksheet);
    const gridSize = resolution;
    const dx = (xMax - xMin) / gridSize;
    const dy = (yMax - yMin) / gridSize;

    // Marching squares: find zero crossings
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const x = xMin + i * dx;
        const y = yMin + j * dy;

        try {
          const val = evaluator.evaluate(graph.ast, { x, y });

          if (typeof val === 'number' && Math.abs(val) < 0.1) {
            points.push({ x, y });
          }
        } catch {
          // Skip evaluation errors
        }
      }
    }

    const cellVersions = new Map<string, number>();
    for (const cellKey of graph.cellBindings) {
      cellVersions.set(cellKey, this.cellVersions.get(cellKey) || 0);
    }
    this.cache.set(cacheKey, { points, cellVersions });

    return points;
  }

  /**
   * Render scatter plot from cell data
   */
  renderScatter(graph: GraphDefinition): Point[] {
    const cacheKey = `${graph.id}-scatter`;

    if (this.isCacheValid(graph, cacheKey)) {
      return this.cache.get(cacheKey)!.points;
    }

    const points: Point[] = [];

    // Scatter plots read data from cell ranges
    // For simplicity, assume x-values in column A and y-values in column B
    // Full implementation would parse data range from graph definition

    const maxRows = 100;
    for (let row = 1; row <= maxRows; row++) {
      const xKey = `1-${row}`; // Column A
      const yKey = `2-${row}`; // Column B

      const xCell = this.worksheet.cells.get(xKey);
      const yCell = this.worksheet.cells.get(yKey);

      if (xCell && yCell) {
        const x = typeof xCell.value === 'number' ? xCell.value : null;
        const y = typeof yCell.value === 'number' ? yCell.value : null;

        if (x !== null && y !== null && isFinite(x) && isFinite(y)) {
          points.push({ x, y });
        }
      }
    }

    const cellVersions = new Map<string, number>();
    for (const cellKey of graph.cellBindings) {
      cellVersions.set(cellKey, this.cellVersions.get(cellKey) || 0);
    }
    this.cache.set(cacheKey, { points, cellVersions });

    return points;
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

        case 'parametric':
          points = this.renderParametric(graph, resolution);
          break;

        case 'implicit':
          points = this.renderImplicit(graph, Math.min(resolution / 10, 100));
          break;

        case 'scatter':
          points = this.renderScatter(graph);
          break;
      }

      graphsData.push({
        id: graph.id,
        points,
        color: graph.color,
        visible: graph.visible,
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
