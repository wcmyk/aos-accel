/**
 * Accel State Management
 * Zustand store for reactive UI updates
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import { AccelEngine } from '../engine/engine';
import { CellValue, Cell, GraphDefinition } from '../engine/types';
import { GraphRenderer } from '../engine/graph-renderer';
import { deserializeEngine, SerializedWorkbook } from '../engine/serialization';
import { onStockData } from '../engine/stock-data';

// dirtyValues/dirtyFormulas are Sets mutated inside immer producers below.
enableMapSet();

export type Theme = 'default' | 'pastel-yellow' | 'pastel-blue' | 'pastel-brown' | 'pastel-red' | 'pastel-pink' | 'pastel-green' | 'pastel-purple' | 'dark' | 'dark-blue' | 'dark-green' | 'dark-purple';

interface ClipboardCell {
  value: number | string | boolean | null;
  formula?: string;
  isCut: boolean;
}

export interface WatchedTicker {
  symbol: string;
  color: string;
  visible: boolean;
}

const WATCH_COLORS = ['#3b82f6', '#f59e0b', '#a855f7', '#14b8a6', '#ef4444', '#84cc16', '#ec4899'];

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
  // Dirty cell tracking (Excel-grade performance optimization)
  dirtyValues: Set<string>;      // Cells that changed value
  dirtyFormulas: Set<string>;    // Formulas that need recalc
  graphRenderer: GraphRenderer | null;
  activeSheet: string;
  sheetNames: string[];

  // Multi-cell selection
  selectionRange: {
    start: { row: number; col: number };
    end: { row: number; col: number };
  } | null;
  isSelecting: boolean;

  // Cloud persistence (Phase 0)
  workbookId: string | null;
  workbookTitle: string;
  isReadOnly: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: number | null;
  docVersion: number;
  loadWorkbook: (data: SerializedWorkbook, meta: { id: string | null; title: string; readOnly: boolean }) => void;
  setWorkbookTitle: (title: string) => void;
  setSaveStatus: (status: 'idle' | 'saving' | 'saved' | 'error', savedAt?: number) => void;

  // Actions
  setCell: (row: number, col: number, value: string | number | boolean) => void;
  getCell: (row: number, col: number) => CellValue;
  getCellObject: (row: number, col: number) => Cell | undefined;
  selectCell: (row: number, col: number) => void;
  clearDirty: () => void;  // Clear dirty sets after render

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
  refreshStockData: () => void;

  // Market watchlist (drives the Market panel chart)
  watchlist: WatchedTicker[];
  addWatchedTicker: (symbol: string) => void;
  removeWatchedTicker: (symbol: string) => void;
  toggleWatchedTicker: (symbol: string) => void;
  marketTimeframe: string; // '1M' | '3M' | ... | 'Custom'
  marketCustomRange: { startMs: number; days: number } | null;
  setMarketTimeframe: (label: string) => void;
  setMarketCustomRange: (startMs: number, days: number) => void;
  stockPickerOpen: boolean;
  setStockPickerOpen: (open: boolean) => void;

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
    dirtyValues: new Set<string>(),
    dirtyFormulas: new Set<string>(),
    graphRenderer: null,
    activeSheet: 'Sheet1',
    sheetNames: ['Sheet1'],
    selectionRange: null,
    isSelecting: false,

    workbookId: null,
    workbookTitle: 'Untitled workbook',
    isReadOnly: false,
    saveStatus: 'idle',
    lastSavedAt: null,
    docVersion: 0,

    loadWorkbook: (data, meta) => {
      const engine = deserializeEngine(data);
      set((state) => {
        state.engine = engine;
        state.activeSheet = engine.getActiveSheetName();
        state.sheetNames = engine.getSheetNames();
        state.selectedCell = null;
        state.selectionRange = null;
        state.fillRange = null;
        state.graphRenderer = null;
        state.dirtyValues.clear();
        state.dirtyFormulas.clear();
        state.workbookId = meta.id;
        state.workbookTitle = meta.title;
        state.isReadOnly = meta.readOnly;
        state.saveStatus = 'saved';
        state.lastSavedAt = Date.now();
        state.docVersion = 0;
      });
    },

    setWorkbookTitle: (title) => {
      set((state) => {
        state.workbookTitle = title;
        state.docVersion += 1;
      });
    },

    setSaveStatus: (status, savedAt) => {
      set((state) => {
        state.saveStatus = status;
        if (savedAt !== undefined) {
          state.lastSavedAt = savedAt;
        }
      });
    },

    setCell: (row, col, value) => {
      if (get().isReadOnly) return;
      const { engine } = get();
      const cellKey = `${col},${row}`;

      engine.setCell(row, col, value);

      // Invalidate graph cache for changed cell
      get().invalidateGraphCache([cellKey]);

      // Mark this cell and all dependents as dirty (Excel-grade optimization)
      set((state) => {
        state.dirtyValues.add(cellKey);

        // Mark all dependent formulas as dirty
        const dependents = engine.getDependents(row, col);
        dependents.forEach(dep => {
          state.dirtyFormulas.add(`${dep.col},${dep.row}`);
        });
        state.docVersion += 1;
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

    clearDirty: () => {
      set((state) => {
        state.dirtyValues.clear();
        state.dirtyFormulas.clear();
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
      if (get().isReadOnly) return;
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
        state.docVersion += 1;
      });
    },

    pasteCell: (row, col) => {
      if (get().isReadOnly) return;
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
        state.docVersion += 1;
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
      if (get().isReadOnly) return;
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

      // Mark all filled cells as dirty
      set((state) => {
        state.fillRange = null;

        // Mark all cells in the fill range as dirty
        if (isVertical) {
          const direction = endRow > startRow ? 1 : -1;
          const steps = Math.abs(endRow - startRow);
          for (let i = 1; i <= steps; i++) {
            const targetRow = startRow + i * direction;
            const targetKey = `${startCol},${targetRow}`;
            state.dirtyValues.add(targetKey);
          }
        } else if (isHorizontal) {
          const direction = endCol > startCol ? 1 : -1;
          const steps = Math.abs(endCol - startCol);
          for (let i = 1; i <= steps; i++) {
            const targetCol = startCol + i * direction;
            const targetKey = `${targetCol},${startRow}`;
            state.dirtyValues.add(targetKey);
          }
        }
        state.docVersion += 1;
      });
    },

    formatCell: (row, col, format) => {
      if (get().isReadOnly) return;
      const { engine } = get();
      engine.formatCell(row, col, format);
      set((state) => {
        state.engine = engine;
        state.docVersion += 1;
      });
    },

    sortColumn: (col, ascending) => {
      if (get().isReadOnly) return;
      const { engine } = get();
      engine.sortColumn(col, ascending);
      set((state) => {
        state.engine = engine;
        state.docVersion += 1;
      });
    },

    insertRow: (row) => {
      if (get().isReadOnly) return;
      const { engine } = get();
      engine.insertRow(row);
      set((state) => {
        state.engine = engine;
        state.docVersion += 1;
      });
    },

    deleteRow: (row) => {
      if (get().isReadOnly) return;
      const { engine } = get();
      engine.deleteRow(row);
      set((state) => {
        state.engine = engine;
        state.docVersion += 1;
      });
    },

    insertColumn: (col) => {
      if (get().isReadOnly) return;
      const { engine } = get();
      engine.insertColumn(col);
      set((state) => {
        state.engine = engine;
        state.docVersion += 1;
      });
    },

    deleteColumn: (col) => {
      if (get().isReadOnly) return;
      const { engine } = get();
      engine.deleteColumn(col);
      set((state) => {
        state.engine = engine;
        state.docVersion += 1;
      });
    },

    setParameter: (row, col, min, max, step) => {
      if (get().isReadOnly) return;
      const { engine } = get();
      engine.setParameter(row, col, min, max, step);
      set((state) => {
        state.engine = engine;
        state.docVersion += 1;
      });
    },

    updateParameter: (row, col, value) => {
      if (get().isReadOnly) return;
      const { engine } = get();
      engine.updateParameter(row, col, value);
      // Bump cached graph point versions for this cell, exactly like setCell
      // does — otherwise plots bound to the parameter repaint stale points.
      get().invalidateGraphCache([`${col},${row}`]);
      set((state) => {
        state.engine = engine;
        state.dirtyValues.add(`${col},${row}`);
        state.docVersion += 1;
      });
    },

    addGraph: (id, formula) => {
      if (get().isReadOnly) return;
      const { engine } = get();
      engine.addGraph(id, formula);
      set((state) => {
        state.engine = engine;
        state.docVersion += 1;
      });
    },

    removeGraph: (id) => {
      if (get().isReadOnly) return;
      const { engine } = get();
      engine.removeGraph(id);
      set((state) => {
        state.engine = engine;
        state.docVersion += 1;
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
      if (get().isReadOnly) return;
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
        // New sheet - clear dirty tracking
        state.dirtyValues.clear();
        state.dirtyFormulas.clear();
        state.docVersion += 1;
      });
    },

    deleteSheet: (name) => {
      if (get().isReadOnly) return;
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
        // Sheet deleted - clear dirty tracking
        state.dirtyValues.clear();
        state.dirtyFormulas.clear();
        state.docVersion += 1;
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
        // Switched sheet - clear dirty tracking
        state.dirtyValues.clear();
        state.dirtyFormulas.clear();
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

    watchlist: [{ symbol: 'AAPL', color: WATCH_COLORS[0], visible: true }],

    addWatchedTicker: (symbol) => {
      const sym = symbol.trim().toUpperCase();
      if (!sym || !/^[A-Z.\-:]{1,10}$/.test(sym)) return;
      if (get().watchlist.some((w) => w.symbol === sym)) return;
      set((state) => {
        const used = new Set(state.watchlist.map((w) => w.color));
        const color = WATCH_COLORS.find((c) => !used.has(c)) || WATCH_COLORS[state.watchlist.length % WATCH_COLORS.length];
        state.watchlist.push({ symbol: sym, color, visible: true });
      });
    },

    removeWatchedTicker: (symbol) => {
      set((state) => {
        state.watchlist = state.watchlist.filter((w) => w.symbol !== symbol);
      });
    },

    toggleWatchedTicker: (symbol) => {
      set((state) => {
        const entry = state.watchlist.find((w) => w.symbol === symbol);
        if (entry) entry.visible = !entry.visible;
      });
    },

    marketTimeframe: '3M',
    marketCustomRange: null,

    setMarketTimeframe: (label) => {
      set((state) => {
        state.marketTimeframe = label;
      });
    },

    setMarketCustomRange: (startMs, days) => {
      set((state) => {
        state.marketCustomRange = { startMs, days };
        state.marketTimeframe = 'Custom';
      });
    },

    stockPickerOpen: false,

    setStockPickerOpen: (open) => {
      set((state) => {
        state.stockPickerOpen = open;
      });
    },

    refreshStockData: () => {
      const { engine, graphRenderer } = get();
      // Re-evaluate every STOCK() cell (and its dependents) now that the
      // async market data is in the cache, then drop cached graph points so
      // plots re-sample from the same, freshly evaluated AST.
      const affected = engine.recalculateStockCells();
      if (graphRenderer) {
        graphRenderer.clearCache();
      }
      set((state) => {
        affected.forEach((key) => state.dirtyValues.add(key));
        state.docVersion += 1;
      });
    },

    batchUpdate: (operations) => {
      // Execute all operations
      operations.forEach(op => op());
      // Dirty tracking handles state updates automatically
      // No need for manual version increment
    },
  }))
);

// When asynchronously fetched market data lands, resolve every "Loading…"
// STOCK() cell and repaint dependent graphs — one recalculation, same engine.
onStockData(() => useAccelStore.getState().refreshStockData());
