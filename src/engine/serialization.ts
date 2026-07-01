/**
 * Workbook <-> plain JSON conversion.
 *
 * The engine's live Workbook uses Map/Set internally (see types.ts), which
 * isn't JSON-serializable and shouldn't be persisted directly anyway: AST,
 * dependency edges, and 'plot' graphs are all derived from formulas and are
 * rebuilt by replaying cell input through the engine's public API rather
 * than reconstructed by hand, so invariants (dependency graph, dirty
 * tracking) stay correct.
 */

import { AccelEngine } from './engine';
import { CellFormat } from './types';

export interface SerializedCell {
  row: number;
  col: number;
  input?: string | number | boolean;
  format?: CellFormat;
  parameter?: { min: number; max: number; step: number };
}

export interface SerializedGraph {
  id: string;
  formula: string;
  type: 'function' | 'parametric' | 'implicit' | 'scatter';
}

export interface SerializedWorksheet {
  name: string;
  cells: SerializedCell[];
  graphs: SerializedGraph[];
}

export interface SerializedWorkbook {
  version: 1;
  activeSheet: string;
  sheets: SerializedWorksheet[];
}

export function serializeEngine(engine: AccelEngine): SerializedWorkbook {
  const sheets: SerializedWorksheet[] = engine.getSheetNames().map((name) => {
    const worksheet = engine.getWorksheet(name);
    const cells: SerializedCell[] = [];

    worksheet.cells.forEach((cell) => {
      const input = cell.formula ?? cell.value;
      const hasInput = input !== null && input !== undefined && !Array.isArray(input);

      if (!hasInput && !cell.format && !cell.isParameter) {
        return;
      }

      const serialized: SerializedCell = { row: cell.address.row, col: cell.address.col };
      if (hasInput) {
        serialized.input = input as string | number | boolean;
      }
      if (cell.format) {
        serialized.format = cell.format;
      }
      if (cell.isParameter && cell.parameterConfig) {
        serialized.parameter = {
          min: cell.parameterConfig.min,
          max: cell.parameterConfig.max,
          step: cell.parameterConfig.step,
        };
      }
      cells.push(serialized);
    });

    const graphs: SerializedGraph[] = engine
      .getGraphs(name)
      .filter((graph): graph is typeof graph & { type: SerializedGraph['type'] } => graph.type !== 'plot')
      .map((graph) => ({ id: graph.id, formula: graph.formula, type: graph.type }));

    return { name, cells, graphs };
  });

  return {
    version: 1,
    activeSheet: engine.getActiveSheetName(),
    sheets,
  };
}

export function deserializeEngine(data: SerializedWorkbook): AccelEngine {
  const engine = new AccelEngine();
  const defaultSheet = engine.getSheetNames()[0];
  const incomingNames = new Set(data.sheets.map((sheet) => sheet.name));

  for (const sheet of data.sheets) {
    if (sheet.name !== defaultSheet) {
      engine.addWorksheet(sheet.name);
    }
  }

  if (!incomingNames.has(defaultSheet) && engine.getSheetNames().length > 1) {
    engine.deleteWorksheet(defaultSheet);
  }

  for (const sheet of data.sheets) {
    for (const cell of sheet.cells) {
      if (cell.input !== undefined) {
        engine.setCell(cell.row, cell.col, cell.input, sheet.name);
      }
      if (cell.format) {
        engine.formatCell(cell.row, cell.col, cell.format, sheet.name);
      }
      if (cell.parameter) {
        engine.setParameter(cell.row, cell.col, cell.parameter.min, cell.parameter.max, cell.parameter.step, sheet.name);
      }
    }

    for (const graph of sheet.graphs) {
      engine.addGraph(graph.id, graph.formula, graph.type, sheet.name);
    }
  }

  if (incomingNames.has(data.activeSheet)) {
    engine.setActiveWorksheet(data.activeSheet);
  }

  return engine;
}
