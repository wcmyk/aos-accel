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

export class GraphRenderer {
  private worksheet: Worksheet;

  constructor(worksheet: Worksheet) {
    this.worksheet = worksheet;
  }

  /**
   * Render a function graph: y = f(x)
   */
  renderFunction(graph: GraphDefinition, resolution: number = 1000): Point[] {
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

    return points.filter((p) => p !== null);
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
          // TODO: Implement parametric rendering
          break;

        case 'implicit':
          // TODO: Implement implicit rendering
          break;

        case 'scatter':
          // TODO: Implement scatter plot
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
