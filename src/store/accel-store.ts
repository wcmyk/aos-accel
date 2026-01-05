/**
 * Accel State Management
 * Zustand store for reactive UI updates
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { AccelEngine } from '../engine/engine';
import { CellValue, Cell, GraphDefinition } from '../engine/types';

export type Theme = 'default' | 'pastel-yellow' | 'pastel-blue' | 'pastel-brown' | 'pastel-red' | 'pastel-pink' | 'pastel-green' | 'pastel-purple';

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
  // Match cell references like A1, B2, $A$1, A$1, $A1
  return formula.replace(/(\$?)([A-Z]+)(\$?)(\d+)/g, (match, colAbs, col, rowAbs, row) => {
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
  });
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

  // Actions
  setCell: (row: number, col: number, value: string | number | boolean) => void;
  getCell: (row: number, col: number) => CellValue;
  getCellObject: (row: number, col: number) => Cell | undefined;
  selectCell: (row: number, col: number) => void;

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

  // Export
  exportCSV: () => void;

  // Force re-render
  refresh: () => void;
}

export const useAccelStore = create<AccelState>()(
  immer((set, get) => ({
    engine: new AccelEngine(),
    selectedCell: null,
    clipboard: null,
    fillRange: null,

    setCell: (row, col, value) => {
      const { engine } = get();
      engine.setCell(row, col, value);
      set((state) => {
        // Trigger re-render by updating reference
        state.engine = engine;
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
          const fillValue = calculateFillValue(sourceValue, i, sourceCell?.formula, true);
          engine.setCell(targetRow, startCol, fillValue);
        }
      } else if (isHorizontal) {
        // Fill horizontally
        const direction = endCol > startCol ? 1 : -1;
        const steps = Math.abs(endCol - startCol);

        for (let i = 1; i <= steps; i++) {
          const targetCol = startCol + i * direction;
          const fillValue = calculateFillValue(sourceValue, i, sourceCell?.formula, false);
          engine.setCell(startRow, targetCol, fillValue);
        }
      }

      set((state) => {
        state.engine = engine;
        state.fillRange = null;
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
  }))
);
