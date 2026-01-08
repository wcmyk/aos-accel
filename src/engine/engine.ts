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
    if (this.workbook.sheets.has(name)) {
      throw new Error(`Worksheet already exists: ${name}`);
    }
    const worksheet: Worksheet = {
      name,
      cells: new Map(),
      graphs: new Map(),
      namedRanges: new Map(),
    };
    this.workbook.sheets.set(name, worksheet);
    this.workbook.activeSheet = name;
  }

  deleteWorksheet(name: string): void {
    if (!this.workbook.sheets.has(name)) {
      throw new Error(`Worksheet not found: ${name}`);
    }
    if (this.workbook.sheets.size === 1) {
      throw new Error('Cannot delete the last worksheet');
    }

    this.workbook.sheets.delete(name);

    if (this.workbook.activeSheet === name) {
      // Move active sheet to the first available sheet
      const [firstSheet] = this.workbook.sheets.keys();
      this.workbook.activeSheet = firstSheet;
    }
  }

  setActiveWorksheet(name: string): void {
    if (!this.workbook.sheets.has(name)) {
      throw new Error(`Worksheet not found: ${name}`);
    }
    this.workbook.activeSheet = name;
  }

  getSheetNames(): string[] {
    return Array.from(this.workbook.sheets.keys());
  }

  getActiveSheetName(): string {
    return this.workbook.activeSheet;
  }

  private seedDemoWorkbook(): void {
    // Demo data removed - start with empty spreadsheet
    // Users can add their own data
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

    // Lazy cleanup: remove empty cells with no dependencies
    const existingCell = worksheet.cells.get(cellKey);
    if ((input === '' || input === null) && existingCell) {
      if (existingCell.dependencies.size === 0 &&
          existingCell.dependents.size === 0 &&
          !existingCell.isParameter) {
        worksheet.cells.delete(cellKey);
        return;
      }
    }

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
    type: 'function' | 'parametric' | 'implicit' | 'scatter' | 'plot' = 'function',
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

  private updateGraphs(_cellKey: string, worksheet: Worksheet): void {
    // Graphs update automatically because they evaluate AST on-demand.
    // Synchronize any embedded PLOT formulas into graph definitions.
    this.syncPlotGraphs(worksheet);
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
   * Insert a row at the specified position, shifting rows down
   */
  insertRow(row: number, sheetName?: string): void {
    const worksheet = this.getWorksheet(sheetName);
    const cellsToMove: Array<[string, Cell]> = [];

    // Find all cells at or after the insert row
    worksheet.cells.forEach((cell, key) => {
      if (cell.address.row >= row) {
        cellsToMove.push([key, cell]);
      }
    });

    // Delete old cells
    cellsToMove.forEach(([key]) => worksheet.cells.delete(key));

    // Re-insert cells with updated row numbers
    cellsToMove.forEach(([, cell]) => {
      const newRow = cell.address.row + 1;
      const newKey = this.cellKey(newRow, cell.address.col);
      const newCell = {
        ...cell,
        address: { row: newRow, col: cell.address.col },
      };
      worksheet.cells.set(newKey, newCell);
    });
  }

  /**
   * Delete a row, shifting rows up
   */
  deleteRow(row: number, sheetName?: string): void {
    const worksheet = this.getWorksheet(sheetName);
    const cellsToMove: Array<[string, Cell]> = [];

    // Delete all cells in the target row
    worksheet.cells.forEach((cell, key) => {
      if (cell.address.row === row) {
        worksheet.cells.delete(key);
      } else if (cell.address.row > row) {
        cellsToMove.push([key, cell]);
      }
    });

    // Delete old cells
    cellsToMove.forEach(([key]) => worksheet.cells.delete(key));

    // Re-insert cells with updated row numbers
    cellsToMove.forEach(([, cell]) => {
      const newRow = cell.address.row - 1;
      const newKey = this.cellKey(newRow, cell.address.col);
      const newCell = {
        ...cell,
        address: { row: newRow, col: cell.address.col },
      };
      worksheet.cells.set(newKey, newCell);
    });
  }

  /**
   * Insert a column at the specified position, shifting columns right
   */
  insertColumn(col: number, sheetName?: string): void {
    const worksheet = this.getWorksheet(sheetName);
    const cellsToMove: Array<[string, Cell]> = [];

    // Find all cells at or after the insert column
    worksheet.cells.forEach((cell, key) => {
      if (cell.address.col >= col) {
        cellsToMove.push([key, cell]);
      }
    });

    // Delete old cells
    cellsToMove.forEach(([key]) => worksheet.cells.delete(key));

    // Re-insert cells with updated column numbers
    cellsToMove.forEach(([, cell]) => {
      const newCol = cell.address.col + 1;
      const newKey = this.cellKey(cell.address.row, newCol);
      const newCell = {
        ...cell,
        address: { row: cell.address.row, col: newCol },
      };
      worksheet.cells.set(newKey, newCell);
    });
  }

  /**
   * Delete a column, shifting columns left
   */
  deleteColumn(col: number, sheetName?: string): void {
    const worksheet = this.getWorksheet(sheetName);
    const cellsToMove: Array<[string, Cell]> = [];

    // Delete all cells in the target column
    worksheet.cells.forEach((cell, key) => {
      if (cell.address.col === col) {
        worksheet.cells.delete(key);
      } else if (cell.address.col > col) {
        cellsToMove.push([key, cell]);
      }
    });

    // Delete old cells
    cellsToMove.forEach(([key]) => worksheet.cells.delete(key));

    // Re-insert cells with updated column numbers
    cellsToMove.forEach(([, cell]) => {
      const newCol = cell.address.col - 1;
      const newKey = this.cellKey(cell.address.row, newCol);
      const newCell = {
        ...cell,
        address: { row: cell.address.row, col: newCol },
      };
      worksheet.cells.set(newKey, newCell);
    });
  }

  /**
   * Export worksheet as CSV
   */
  exportCSV(sheetName?: string): string {
    const worksheet = this.getWorksheet(sheetName);
    const rows: string[][] = [];

    // Find the bounds of the data
    let maxRow = 0;
    let maxCol = 0;
    worksheet.cells.forEach((cell) => {
      maxRow = Math.max(maxRow, cell.address.row);
      maxCol = Math.max(maxCol, cell.address.col);
    });

    // Create CSV rows
    for (let row = 1; row <= maxRow; row++) {
      const rowData: string[] = [];
      for (let col = 1; col <= maxCol; col++) {
        const cell = this.getCellObject(row, col, sheetName);
        const value = cell?.value ?? '';

        // Escape CSV values
        let csvValue = String(value);
        if (csvValue.includes(',') || csvValue.includes('"') || csvValue.includes('\n')) {
          csvValue = `"${csvValue.replace(/"/g, '""')}"`;
        }

        rowData.push(csvValue);
      }
      rows.push(rowData);
    }

    return rows.map(row => row.join(',')).join('\n');
  }

  /**
   * Get all cells that depend on the given cell (for dirty tracking)
   */
  getDependents(row: number, col: number, sheetName?: string): Array<{ row: number; col: number }> {
    const worksheet = this.getWorksheet(sheetName);
    const cellKey = this.cellKey(row, col);
    const cell = worksheet.cells.get(cellKey);

    if (!cell) {
      return [];
    }

    const dependents: Array<{ row: number; col: number }> = [];
    cell.dependents.forEach(depKey => {
      const depCell = worksheet.cells.get(depKey);
      if (depCell) {
        dependents.push({ row: depCell.address.row, col: depCell.address.col });
      }
    });

    return dependents;
  }

  /**
   * Export workbook state
   */
  export(): Workbook {
    return this.workbook;
  }

  /**
   * Synchronize graphs generated from PLOT formulas embedded in cells.
   * Each cell that contains a top-level PLOT(...) formula is treated as a graph definition.
   */
  private syncPlotGraphs(worksheet: Worksheet): void {
    const depGraph = new DependencyGraph(worksheet.cells);
    const plotGraphIds = new Set<string>();

    worksheet.cells.forEach((cell, key) => {
      if (cell.ast && cell.ast.type === 'function' && cell.ast.name === 'PLOT') {
        const graphId = `plot-${key}`;
        plotGraphIds.add(graphId);
        const existing = worksheet.graphs.get(graphId);

        const graph: GraphDefinition = {
          id: graphId,
          type: 'plot',
          formula: cell.formula || '=PLOT()',
          ast: cell.ast,
          color: existing?.color || this.generateColor(),
          visible: existing?.visible ?? true,
          domain: existing?.domain,
          range: existing?.range,
          cellBindings: depGraph.extractDependencies(cell.ast),
          dimensions: cell.ast.args.length,
        };

        worksheet.graphs.set(graphId, graph);
      }
    });

    // Remove plot graphs that no longer have a backing cell
    worksheet.graphs.forEach((graph, id) => {
      if (graph.type === 'plot' && !plotGraphIds.has(id)) {
        worksheet.graphs.delete(id);
      }
    });
  }
}
