/**
 * Accel Calculation Engine
 * The unified engine that powers BOTH spreadsheet and graphing
 */

import { Cell, CellValue, Worksheet, Workbook, GraphDefinition } from './types';
import { FormulaParser } from './parser';
import { Evaluator } from './evaluator';
import { DependencyGraph } from './dependency-graph';

export class AccelEngine {
  private workbook: Workbook;
  private parser: FormulaParser;

  constructor() {
    this.workbook = {
      sheets: new Map(),
      activeSheet: 'Sheet1',
    };
    this.parser = new FormulaParser();

    // Create default worksheet
    this.addWorksheet('Sheet1');
    this.seedDemoWorkbook();
  }

  addWorksheet(name: string): void {
    const worksheet: Worksheet = {
      name,
      cells: new Map(),
      graphs: new Map(),
      namedRanges: new Map(),
    };
    this.workbook.sheets.set(name, worksheet);
  }

  private seedDemoWorkbook(): void {
    const worksheet = this.getWorksheet();

    // Seed a small table of values
    const rows = [
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
      [5, 5],
    ];

    rows.forEach((rowValues, rowIndex) => {
      rowValues.forEach((value, colIndex) => {
        this.setCell(rowIndex + 1, colIndex + 1, value, worksheet.name);
      });
    });

    // Create tunable slope/intercept parameters
    this.setCell(1, 3, 1, worksheet.name); // C1 intercept
    this.setParameter(1, 2, -5, 5, 0.25, worksheet.name); // B1 slope
    this.setParameter(1, 3, -10, 10, 0.5, worksheet.name); // C1 intercept parameter

    // Keep graphing disabled for now (Desmos-style visuals paused)
  }

  getWorksheet(name?: string): Worksheet {
    const sheetName = name || this.workbook.activeSheet;
    const sheet = this.workbook.sheets.get(sheetName);
    if (!sheet) {
      throw new Error(`Worksheet not found: ${sheetName}`);
    }
    return sheet;
  }

  /**
   * Set cell value or formula
   */
  setCell(row: number, col: number, input: string | number | boolean, sheetName?: string): void {
    const worksheet = this.getWorksheet(sheetName);
    const cellKey = this.cellKey(row, col);

    let cell = worksheet.cells.get(cellKey);
    if (!cell) {
      cell = {
        address: { row, col },
        value: null,
        dependencies: new Set(),
        dependents: new Set(),
      };
      worksheet.cells.set(cellKey, cell);
    }

    // Check if input is a formula
    if (typeof input === 'string' && input.startsWith('=')) {
      try {
        cell.formula = input;
        cell.ast = this.parser.parse(input);

        // Extract dependencies
        const depGraph = new DependencyGraph(worksheet.cells);
        const dependencies = depGraph.extractDependencies(cell.ast);
        depGraph.buildDependencies(cellKey, dependencies);

        // Check for circular references
        if (depGraph.hasCircularDependency(cellKey)) {
          throw new Error('Circular reference detected');
        }

        // Calculate value
        this.recalculateCell(cellKey, worksheet);
      } catch (error) {
        cell.value = `#ERROR: ${(error as Error).message}`;
      }
    } else {
      // Direct value
      cell.formula = undefined;
      cell.ast = undefined;
      cell.value = input;
      cell.dependencies.clear();

      // Update dependents
      const depGraph = new DependencyGraph(worksheet.cells);
      depGraph.buildDependencies(cellKey, new Set());
    }

    // Recalculate dependent cells
    this.recalculateDependents(cellKey, worksheet);

    // Update graphs that depend on this cell
    this.updateGraphs(cellKey, worksheet);
  }

  /**
   * Get cell value
   */
  getCell(row: number, col: number, sheetName?: string): CellValue {
    const worksheet = this.getWorksheet(sheetName);
    const cellKey = this.cellKey(row, col);
    const cell = worksheet.cells.get(cellKey);
    return cell?.value ?? null;
  }

  /**
   * Get cell object
   */
  getCellObject(row: number, col: number, sheetName?: string): Cell | undefined {
    const worksheet = this.getWorksheet(sheetName);
    const cellKey = this.cellKey(row, col);
    return worksheet.cells.get(cellKey);
  }

  /**
   * Apply formatting to a cell
   */
  formatCell(row: number, col: number, format: Partial<import('./types').CellFormat>, sheetName?: string): void {
    const worksheet = this.getWorksheet(sheetName);
    const cellKey = this.cellKey(row, col);

    let cell = worksheet.cells.get(cellKey);
    if (!cell) {
      cell = {
        address: { row, col },
        value: null,
        dependencies: new Set(),
        dependents: new Set(),
      };
      worksheet.cells.set(cellKey, cell);
    }

    // Merge format properties
    cell.format = {
      ...cell.format,
      ...format,
    };
  }

  /**
   * Set cell as parameter with slider config
   */
  setParameter(row: number, col: number, min: number, max: number, step: number, sheetName?: string): void {
    const worksheet = this.getWorksheet(sheetName);
    const cellKey = this.cellKey(row, col);

    let cell = worksheet.cells.get(cellKey);
    if (!cell) {
      cell = {
        address: { row, col },
        value: min,
        dependencies: new Set(),
        dependents: new Set(),
      };
      worksheet.cells.set(cellKey, cell);
    }

    cell.isParameter = true;
    cell.parameterConfig = {
      min,
      max,
      step,
      showSlider: true,
    };

    // Set initial value if not set
    if (cell.value === null || typeof cell.value !== 'number') {
      cell.value = min;
    }
  }

  /**
   * Update parameter value (triggers recalculation)
   */
  updateParameter(row: number, col: number, value: number, sheetName?: string): void {
    const worksheet = this.getWorksheet(sheetName);
    const cellKey = this.cellKey(row, col);
    const cell = worksheet.cells.get(cellKey);

    if (!cell || !cell.isParameter) {
      throw new Error('Cell is not a parameter');
    }

    cell.value = value;

    // Recalculate dependents
    this.recalculateDependents(cellKey, worksheet);

    // Update graphs
    this.updateGraphs(cellKey, worksheet);
  }

  /**
   * Add a graph
   */
  addGraph(
    id: string,
    formula: string,
    type: 'function' | 'parametric' | 'implicit' | 'scatter' = 'function',
    sheetName?: string
  ): void {
    const worksheet = this.getWorksheet(sheetName);

    try {
      const ast = this.parser.parse(formula);
      const depGraph = new DependencyGraph(worksheet.cells);
      const cellBindings = depGraph.extractDependencies(ast);

      const graph: GraphDefinition = {
        id,
        type,
        formula,
        ast,
        color: this.generateColor(),
        visible: true,
        cellBindings,
        domain: { min: -10, max: 10 },
        range: { min: -10, max: 10 },
      };

      worksheet.graphs.set(id, graph);
    } catch (error) {
      throw new Error(`Failed to add graph: ${(error as Error).message}`);
    }
  }

  /**
   * Remove a graph
   */
  removeGraph(id: string, sheetName?: string): void {
    const worksheet = this.getWorksheet(sheetName);
    worksheet.graphs.delete(id);
  }

  /**
   * Get all graphs
   */
  getGraphs(sheetName?: string): GraphDefinition[] {
    const worksheet = this.getWorksheet(sheetName);
    return Array.from(worksheet.graphs.values());
  }

  /**
   * Evaluate graph at a specific x value
   */
  evaluateGraph(id: string, x: number, sheetName?: string): number | null {
    const worksheet = this.getWorksheet(sheetName);
    const graph = worksheet.graphs.get(id);

    if (!graph) {
      throw new Error(`Graph not found: ${id}`);
    }

    try {
      const evaluator = new Evaluator(worksheet);
      const result = evaluator.evaluate(graph.ast, { x });

      if (typeof result === 'number') {
        return result;
      }

      return null;
    } catch {
      return null;
    }
  }

  private recalculateCell(cellKey: string, worksheet: Worksheet): void {
    const cell = worksheet.cells.get(cellKey);
    if (!cell || !cell.ast) return;

    try {
      const evaluator = new Evaluator(worksheet);
      cell.value = evaluator.evaluate(cell.ast);
    } catch (error) {
      cell.value = `#ERROR: ${(error as Error).message}`;
    }
  }

  private recalculateDependents(cellKey: string, worksheet: Worksheet): void {
    const depGraph = new DependencyGraph(worksheet.cells);
    const recalcOrder = depGraph.getRecalculationOrder(new Set([cellKey]));

    // Recalculate in topological order
    for (const key of recalcOrder) {
      if (key !== cellKey) {
        this.recalculateCell(key, worksheet);
      }
    }
  }

  private updateGraphs(_cellKey: string, _worksheet: Worksheet): void {
    // Graphs update automatically because they evaluate AST on-demand
    // No action needed here, but we could trigger UI updates
  }

  private cellKey(row: number, col: number): string {
    return `${col},${row}`;
  }

  private generateColor(): string {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Get all cells in a range
   */
  getRange(startRow: number, startCol: number, endRow: number, endCol: number, sheetName?: string): CellValue[][] {
    const worksheet = this.getWorksheet(sheetName);
    const result: CellValue[][] = [];

    for (let row = startRow; row <= endRow; row++) {
      const rowData: CellValue[] = [];
      for (let col = startCol; col <= endCol; col++) {
        const cellKey = this.cellKey(row, col);
        const cell = worksheet.cells.get(cellKey);
        rowData.push(cell?.value ?? null);
      }
      result.push(rowData);
    }

    return result;
  }

  /**
   * Sort a column and rearrange adjacent columns to maintain row integrity
   */
  sortColumn(col: number, ascending: boolean = true, sheetName?: string): void {
    const worksheet = this.getWorksheet(sheetName);

    // Find the data range (rows with values in the sorted column)
    const rowsWithData: Array<{ row: number; cells: Map<number, Cell> }> = [];

    for (const [key, cell] of worksheet.cells) {
      const [cellCol, cellRow] = key.split(',').map(Number);

      // Find existing row or create new one
      let rowData = rowsWithData.find(r => r.row === cellRow);
      if (!rowData) {
        rowData = { row: cellRow, cells: new Map() };
        rowsWithData.push(rowData);
      }
      rowData.cells.set(cellCol, cell);
    }

    // Filter to only rows that have a value in the sort column
    const dataRows = rowsWithData.filter(r => r.cells.has(col));

    // Sort rows by the value in the sort column
    dataRows.sort((a, b) => {
      const aVal = a.cells.get(col)?.value ?? null;
      const bVal = b.cells.get(col)?.value ?? null;

      // Handle null/undefined values
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return ascending ? 1 : -1;
      if (bVal === null) return ascending ? -1 : 1;

      // Compare values
      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return ascending ? comparison : -comparison;
    });

    // Clear the old cells in the sorted range
    const sortedRows = dataRows.map(r => r.row);
    const allCols = new Set<number>();
    dataRows.forEach(r => r.cells.forEach((_, c) => allCols.add(c)));

    for (const row of sortedRows) {
      for (const c of allCols) {
        const key = this.cellKey(row, c);
        worksheet.cells.delete(key);
      }
    }

    // Write the sorted data back
    dataRows.forEach((rowData, index) => {
      const newRow = sortedRows[index];
      rowData.cells.forEach((cell, cellCol) => {
        const newKey = this.cellKey(newRow, cellCol);
        const newCell = {
          ...cell,
          address: { row: newRow, col: cellCol },
        };
        worksheet.cells.set(newKey, newCell);
      });
    });
  }

  /**
   * Export workbook state
   */
  export(): Workbook {
    return this.workbook;
  }
}
