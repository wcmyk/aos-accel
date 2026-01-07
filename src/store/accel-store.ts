/**
 * Accel State Management
 * Zustand store for reactive UI updates
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { AccelEngine } from '../engine/engine';
import { CellValue, Cell, GraphDefinition } from '../engine/types';
import { GraphRenderer } from '../engine/graph-renderer';

export type Theme = 'default' | 'pastel-yellow' | 'pastel-blue' | 'pastel-brown' | 'pastel-red' | 'pastel-pink' | 'pastel-green' | 'pastel-purple' | 'dark' | 'dark-blue' | 'dark-green' | 'dark-purple';

interface ClipboardCell {
  value: number | string | boolean | null;
  formula?: string;
  isCut: boolean;
}

/**
 * Adjust cell references in formulas for fill operations
 * Example: A1 → A2, A3, etc. when filling down
 */
function adjustFormulaReferences(formula: string, rowOffset: number, colOffset: number): string {
  const referenceRegex = /(\$?)([A-Z]+)(\$?)(\d+)/g;

  // Match cell references like A1, B2, $A$1, A$1, $A1
  const replaceReference = (_match: string, colAbs: string, col: string, rowAbs: string, row: string) => {
    const rowNum = parseInt(row, 10);
    const newRow = rowAbs ? rowNum : rowNum + rowOffset;

    // Convert column letters to number, adjust, and convert back
    let colNum = 0;
    for (let i = 0; i < col.length; i++) {
      colNum = colNum * 26 + (col.charCodeAt(i) - 64);
    }
    const newColNum = colAbs ? colNum : colNum + colOffset;

    // Convert number back to letters
    let newCol = '';
    let n = newColNum;
    while (n > 0) {
      const remainder = (n - 1) % 26;
      newCol = String.fromCharCode(65 + remainder) + newCol;
      n = Math.floor((n - 1) / 26);
    }

    return `${colAbs}${newCol}${rowAbs}${newRow}`;
  };

  let result = '';
  let segmentStart = 0;
  let inString = false;

  for (let i = 0; i < formula.length; i++) {
    const char = formula[i];
    if (char === '"') {
      if (inString) {
        // Handle escaped quote ("")
        if (formula[i + 1] === '"') {
          i++; // Skip the escaped quote
          continue;
        }
        // Close string: append untouched string segment
        result += formula.slice(segmentStart, i + 1);
        segmentStart = i + 1;
        inString = false;
      } else {
        // Process non-string segment before entering a string
        result += formula.slice(segmentStart, i).replace(referenceRegex, replaceReference);
        segmentStart = i;
        inString = true;
      }
    }
  }

  // Process trailing segment
  if (segmentStart < formula.length) {
    const tail = formula.slice(segmentStart);
    result += inString ? tail : tail.replace(referenceRegex, replaceReference);
  }

  return result;
}

/**
 * Calculate the fill value based on the source value and step
 * Handles numbers, text with numbers, formulas with relative references, dates, and patterns
 */
function calculateFillValue(sourceValue: CellValue, step: number, sourceFormula?: string, isVertical: boolean = true): string | number {
  // Handle formulas with relative reference adjustment
  if (sourceFormula) {
    return adjustFormulaReferences(sourceFormula, isVertical ? step : 0, isVertical ? 0 : step);
  }

  // If it's a number, increment it
  if (typeof sourceValue === 'number') {
    return sourceValue + step;
  }

  // If it's a string, try various patterns
  if (typeof sourceValue === 'string') {
    // Check for day names
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayIndex = days.findIndex(d => d.toLowerCase() === sourceValue.toLowerCase());
    if (dayIndex !== -1) {
      return days[(dayIndex + step) % 7];
    }

    // Check for short day names
    const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const shortDayIndex = shortDays.findIndex(d => d.toLowerCase() === sourceValue.toLowerCase());
    if (shortDayIndex !== -1) {
      return shortDays[(shortDayIndex + step) % 7];
    }

    // Check for month names
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'];
    const monthIndex = months.findIndex(m => m.toLowerCase() === sourceValue.toLowerCase());
    if (monthIndex !== -1) {
      return months[(monthIndex + step) % 12];
    }

    // Check for short month names
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const shortMonthIndex = shortMonths.findIndex(m => m.toLowerCase() === sourceValue.toLowerCase());
    if (shortMonthIndex !== -1) {
      return shortMonths[(shortMonthIndex + step) % 12];
    }

    // Check for text ending with number (e.g., "Item1" → "Item2")
    const match = sourceValue.match(/^(.*?)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const num = parseInt(match[2], 10);
      return `${prefix}${num + step}`;
    }
  }

  // Otherwise, just return the source value (repeat it)
  return sourceValue as string | number;
}

interface AccelState {
  engine: AccelEngine;
  selectedCell: { row: number; col: number } | null;
  clipboard: ClipboardCell | null;
  fillRange: { row: number; col: number } | null;
  version: number; // Version counter to force re-renders
  graphRenderer: GraphRenderer | null;
  activeSheet: string;
  sheetNames: string[];

  // Multi-cell selection
  selectionRange: {
    start: { row: number; col: number };
    end: { row: number; col: number };
  } | null;
  isSelecting: boolean;

  // Actions
  setCell: (row: number, col: number, value: string | number | boolean) => void;
  getCell: (row: number, col: number) => CellValue;
  getCellObject: (row: number, col: number) => Cell | undefined;
  selectCell: (row: number, col: number) => void;

  // Selection actions
  startSelection: (row: number, col: number) => void;
  updateSelection: (row: number, col: number) => void;
  endSelection: () => void;
  clearSelection: () => void;

  // Clipboard operations
  copyCell: (row: number, col: number) => void;
  cutCell: (row: number, col: number) => void;
  pasteCell: (row: number, col: number) => void;

  // AutoFill operations
  setFillRange: (row: number, col: number) => void;
  clearFillRange: () => void;
  executeFill: () => void;

  // Formatting
  formatCell: (row: number, col: number, format: any) => void;

  // Sorting
  sortColumn: (col: number, ascending: boolean) => void;

  // Insert/Delete
  insertRow: (row: number) => void;
  deleteRow: (row: number) => void;
  insertColumn: (col: number) => void;
  deleteColumn: (col: number) => void;

  // Parameters
  setParameter: (row: number, col: number, min: number, max: number, step: number) => void;
  updateParameter: (row: number, col: number, value: number) => void;

  // Graphs
  addGraph: (id: string, formula: string) => void;
  removeGraph: (id: string) => void;
  getGraphs: () => GraphDefinition[];
  getGraphRenderer: () => GraphRenderer;
  invalidateGraphCache: (cellKeys: string[]) => void;

  // Batch operations
  batchUpdate: (operations: Array<() => void>) => void;

  // Export
  exportCSV: () => void;

  // Force re-render
  refresh: () => void;

  // Worksheets
  addSheet: () => void;
  deleteSheet: (name: string) => void;
  setActiveSheet: (name: string) => void;
  getSheetNames: () => string[];
}

export const useAccelStore = create<AccelState>()(
  immer((set, get) => ({
    engine: new AccelEngine(),
    selectedCell: null,
    clipboard: null,
    fillRange: null,
    version: 0,
    graphRenderer: null,
    activeSheet: 'Sheet1',
    sheetNames: ['Sheet1'],
    selectionRange: null,
    isSelecting: false,

    setCell: (row, col, value) => {
      const { engine } = get();
      engine.setCell(row, col, value);
      // Invalidate graph cache for changed cell
      const cellKey = `${col},${row}`;
      get().invalidateGraphCache([cellKey]);
      set((state) => {
        state.version = (state.version || 0) + 1;
      });
    },

    getCell: (row, col) => {
      const { engine } = get();
      return engine.getCell(row, col);
    },

    getCellObject: (row, col) => {
      const { engine } = get();
      return engine.getCellObject(row, col);
    },

    selectCell: (row, col) => {
      set((state) => {
        state.selectedCell = { row, col };
      });
    },

    startSelection: (row, col) => {
      set((state) => {
        state.selectionRange = { start: { row, col }, end: { row, col } };
        state.isSelecting = true;
        state.selectedCell = { row, col };
      });
    },

    updateSelection: (row, col) => {
      set((state) => {
        if (state.isSelecting && state.selectionRange) {
          state.selectionRange.end = { row, col };
        }
      });
    },

    endSelection: () => {
      set((state) => {
        state.isSelecting = false;
      });
    },

    clearSelection: () => {
      set((state) => {
        state.selectionRange = null;
        state.isSelecting = false;
      });
    },

    copyCell: (row, col) => {
      const { engine } = get();
      const cell = engine.getCellObject(row, col);
      const cellValue = cell?.value ?? null;
      set((state) => {
        state.clipboard = {
          value: Array.isArray(cellValue) ? null : cellValue,
          formula: cell?.formula,
          isCut: false,
        };
      });
    },

    cutCell: (row, col) => {
      const { engine } = get();
      const cell = engine.getCellObject(row, col);
      const cellValue = cell?.value ?? null;
      set((state) => {
        state.clipboard = {
          value: Array.isArray(cellValue) ? null : cellValue,
          formula: cell?.formula,
          isCut: true,
        };
      });
      engine.setCell(row, col, '');
      set((state) => {
        state.engine = engine;
      });
    },

    pasteCell: (row, col) => {
      const { clipboard, engine } = get();
      if (!clipboard) return;

      if (clipboard.formula) {
        engine.setCell(row, col, clipboard.formula);
      } else if (clipboard.value !== null) {
        engine.setCell(row, col, clipboard.value);
      }

      set((state) => {
        state.engine = engine;
        if (clipboard.isCut) {
          state.clipboard = null;
        }
      });
    },

    setFillRange: (row, col) => {
      set((state) => {
        state.fillRange = { row, col };
      });
    },

    clearFillRange: () => {
      set((state) => {
        state.fillRange = null;
      });
    },

    executeFill: () => {
      const { selectedCell, fillRange, engine } = get();
      if (!selectedCell || !fillRange) return;

      const startRow = selectedCell.row;
      const startCol = selectedCell.col;
      const endRow = fillRange.row;
      const endCol = fillRange.col;

      // Get the source cell value
      const sourceCell = engine.getCellObject(startRow, startCol);
      const sourceValue = sourceCell?.value ?? '';

      // Determine fill direction
      const isVertical = startCol === endCol;
      const isHorizontal = startRow === endRow;

      if (isVertical) {
        // Fill vertically
        const direction = endRow > startRow ? 1 : -1;
        const steps = Math.abs(endRow - startRow);

        for (let i = 1; i <= steps; i++) {
          const targetRow = startRow + i * direction;
          const fillValue = calculateFillValue(sourceValue, i * direction, sourceCell?.formula, true);
          engine.setCell(targetRow, startCol, fillValue);
        }
      } else if (isHorizontal) {
        // Fill horizontally
        const direction = endCol > startCol ? 1 : -1;
        const steps = Math.abs(endCol - startCol);

        for (let i = 1; i <= steps; i++) {
          const targetCol = startCol + i * direction;
          const fillValue = calculateFillValue(sourceValue, i * direction, sourceCell?.formula, false);
          engine.setCell(startRow, targetCol, fillValue);
        }
      }

      // Force state update by creating new reference
      set((state) => {
        state.fillRange = null;
        state.version = (state.version || 0) + 1; // Increment version to force update
      });
    },

    formatCell: (row, col, format) => {
      const { engine } = get();
      engine.formatCell(row, col, format);
      set((state) => {
        state.engine = engine;
      });
    },

    sortColumn: (col, ascending) => {
      const { engine } = get();
      engine.sortColumn(col, ascending);
      set((state) => {
        state.engine = engine;
      });
    },

    insertRow: (row) => {
      const { engine } = get();
      engine.insertRow(row);
      set((state) => {
        state.engine = engine;
      });
    },

    deleteRow: (row) => {
      const { engine } = get();
      engine.deleteRow(row);
      set((state) => {
        state.engine = engine;
      });
    },

    insertColumn: (col) => {
      const { engine } = get();
      engine.insertColumn(col);
      set((state) => {
        state.engine = engine;
      });
    },

    deleteColumn: (col) => {
      const { engine } = get();
      engine.deleteColumn(col);
      set((state) => {
        state.engine = engine;
      });
    },

    setParameter: (row, col, min, max, step) => {
      const { engine } = get();
      engine.setParameter(row, col, min, max, step);
      set((state) => {
        state.engine = engine;
      });
    },

    updateParameter: (row, col, value) => {
      const { engine } = get();
      engine.updateParameter(row, col, value);
      set((state) => {
        state.engine = engine;
      });
    },

    addGraph: (id, formula) => {
      const { engine } = get();
      engine.addGraph(id, formula);
      set((state) => {
        state.engine = engine;
      });
    },

    removeGraph: (id) => {
      const { engine } = get();
      engine.removeGraph(id);
      set((state) => {
        state.engine = engine;
      });
    },

    getGraphs: () => {
      const { engine } = get();
      return engine.getGraphs();
    },

    exportCSV: () => {
      const { engine } = get();
      const csv = engine.exportCSV();

      // Download the CSV file
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', 'spreadsheet.csv');
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },

    refresh: () => {
      set(() => ({}));
    },

    addSheet: () => {
      const { engine, sheetNames } = get();
      let suffix = sheetNames.length + 1;
      let name = `Sheet${suffix}`;
      while (sheetNames.includes(name)) {
        suffix += 1;
        name = `Sheet${suffix}`;
      }

      engine.addWorksheet(name);
      set((state) => {
        state.engine = engine;
        state.activeSheet = name;
        state.sheetNames = [...sheetNames, name];
        state.selectedCell = null;
        state.selectionRange = null;
        state.fillRange = null;
        state.graphRenderer = null;
        state.version = (state.version || 0) + 1;
      });
    },

    deleteSheet: (name) => {
      const { engine, sheetNames, activeSheet } = get();
      if (sheetNames.length === 1) {
        return;
      }
      engine.deleteWorksheet(name);
      const remaining = sheetNames.filter((sheet) => sheet !== name);
      const nextActive = activeSheet === name ? remaining[0] : activeSheet;
      engine.setActiveWorksheet(nextActive);

      set((state) => {
        state.engine = engine;
        state.activeSheet = nextActive;
        state.sheetNames = remaining;
        state.selectedCell = null;
        state.selectionRange = null;
        state.fillRange = null;
        state.graphRenderer = null;
        state.version = (state.version || 0) + 1;
      });
    },

    setActiveSheet: (name) => {
      const { engine } = get();
      engine.setActiveWorksheet(name);
      set((state) => {
        state.activeSheet = name;
        state.graphRenderer = null;
        state.selectedCell = null;
        state.selectionRange = null;
        state.fillRange = null;
        state.version = (state.version || 0) + 1;
      });
    },

    getSheetNames: () => {
      const { sheetNames } = get();
      return sheetNames;
    },

    getGraphRenderer: () => {
      const { engine, graphRenderer } = get();
      if (!graphRenderer) {
        const worksheet = engine.getWorksheet();
        const newRenderer = new GraphRenderer(worksheet);
        set((state) => {
          state.graphRenderer = newRenderer;
        });
        return newRenderer;
      }
      return graphRenderer;
    },

    invalidateGraphCache: (cellKeys) => {
      const { graphRenderer } = get();
      if (graphRenderer) {
        graphRenderer.invalidateCache(cellKeys);
      }
    },

    batchUpdate: (operations) => {
      const { engine } = get();
      // Execute all operations
      operations.forEach(op => op());
      // Single state update to trigger one re-render
      set((state) => {
        state.version = (state.version || 0) + 1;
      });
    },
  }))
);
