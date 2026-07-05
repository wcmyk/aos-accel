/**
 * Accel State Management
 * Zustand store for reactive UI updates
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import { AccelEngine } from '../engine/engine';
import { CellValue, Cell, GraphDefinition, CellFormat } from '../engine/types';
import { GraphRenderer } from '../engine/graph-renderer';
import { deserializeEngine, serializeEngine, SerializedWorkbook } from '../engine/serialization';
import { onStockData, setMarketTimeframeDays, TIMEFRAME_BARS } from '../engine/stock-data';

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

// Rewrite bare cell/range references in a formula to point at a specific sheet,
// so a graph copied onto a (data-less) graph sheet still reads the original
// data: PLOT(A1:A100, B1:B100) -> PLOT(Sheet1!A1:A100, Sheet1!B1:B100). Skips
// text inside double quotes, references already sheet-qualified (preceded by
// '!'), and function names (a name followed by '(' — e.g. LOG10(...)).
function qualifyFormulaRefs(formula: string, sheet: string): string {
  if (!formula || !formula.startsWith('=')) return formula;
  const refPattern = /(?<![A-Za-z0-9_!])([A-Za-z]{1,3}[0-9]+(?::[A-Za-z]{1,3}[0-9]+)?)(?!\s*\()/g;
  // Odd indices are quoted string literals — leave them untouched.
  return formula
    .split(/("(?:[^"\\]|\\.)*")/)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(refPattern, (m) => `${sheet}!${m}`)))
    .join('');
}

// Upper bound on retained undo checkpoints. Snapshots are serialized workbooks
// (plain JSON), so 100 is cheap in memory while covering any realistic session.
const MAX_HISTORY = 100;

// Tracks the originating action of the most recent undo checkpoint so that a
// burst of same-target edits (e.g. dragging a parameter slider) collapses into
// a single undo step instead of flooding the stack. Module-level (not store
// state) because it never needs to drive a re-render.
let lastCoalesceKey: string | null = null;

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
  // Per-sheet kind, mirrored from the engine for reactive UI (tab icons,
  // grid-vs-graph rendering). Absent entries are treated as 'grid'.
  sheetKinds: Record<string, 'grid' | 'graph'>;

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

  // Undo / redo (snapshot-based history over workbook content)
  undoStack: SerializedWorkbook[];
  redoStack: SerializedWorkbook[];
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  // Formatting
  formatCell: (row: number, col: number, format: Partial<CellFormat>) => void;

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
  addGraph: (id: string, formula: string, type?: 'function' | 'plot') => void;
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
  addGraphSheet: (seedFromActive?: boolean) => string;
  // Guided templates (used by the start screen and the ribbon).
  insertMonteCarloModel: () => void;
  insertStockTemplate: () => void;
  insertEngineeringModel: () => void;
  insertDataExploration: () => void;
  deleteSheet: (name: string) => void;
  setActiveSheet: (name: string) => void;
  getSheetNames: () => string[];
}

export const useAccelStore = create<AccelState>()(
  immer((set, get) => {
    // Capture the CURRENT workbook as an undo checkpoint. Must be called
    // BEFORE the mutating engine call so the snapshot reflects the pre-edit
    // state. Passing a coalesceKey collapses consecutive same-key edits into
    // one step (e.g. a slider drag); omit it for discrete edits.
    const recordHistory = (coalesceKey?: string) => {
      if (coalesceKey && lastCoalesceKey === coalesceKey) return;
      const snapshot = serializeEngine(get().engine);
      lastCoalesceKey = coalesceKey ?? null;
      set((state) => {
        state.undoStack.push(snapshot);
        if (state.undoStack.length > MAX_HISTORY) state.undoStack.shift();
        state.redoStack.length = 0;
        state.canUndo = true;
        state.canRedo = false;
      });
    };

    return {
    engine: new AccelEngine(),
    selectedCell: null,
    clipboard: null,
    fillRange: null,
    dirtyValues: new Set<string>(),
    dirtyFormulas: new Set<string>(),
    graphRenderer: null,
    activeSheet: 'Sheet1',
    sheetNames: ['Sheet1'],
    sheetKinds: { Sheet1: 'grid' },
    selectionRange: null,
    isSelecting: false,

    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,

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
        state.sheetKinds = Object.fromEntries(
          engine.getSheetNames().map((n) => [n, engine.getSheetKind(n)])
        );
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
        // A freshly loaded workbook starts with a clean history.
        state.undoStack.length = 0;
        state.redoStack.length = 0;
        state.canUndo = false;
        state.canRedo = false;
      });
      lastCoalesceKey = null;
    },

    undo: () => {
      const { undoStack, engine, isReadOnly } = get();
      if (isReadOnly || undoStack.length === 0) return;
      const current = serializeEngine(engine);
      const previous = undoStack[undoStack.length - 1];
      const restored = deserializeEngine(previous);
      lastCoalesceKey = null;
      set((state) => {
        state.undoStack.pop();
        state.redoStack.push(current);
        if (state.redoStack.length > MAX_HISTORY) state.redoStack.shift();
        state.engine = restored;
        state.activeSheet = restored.getActiveSheetName();
        state.sheetNames = restored.getSheetNames();
        state.graphRenderer = null;
        state.selectedCell = null;
        state.selectionRange = null;
        state.fillRange = null;
        state.isSelecting = false;
        state.dirtyValues.clear();
        state.dirtyFormulas.clear();
        state.canUndo = state.undoStack.length > 0;
        state.canRedo = true;
        state.docVersion += 1;
      });
    },

    redo: () => {
      const { redoStack, engine, isReadOnly } = get();
      if (isReadOnly || redoStack.length === 0) return;
      const current = serializeEngine(engine);
      const next = redoStack[redoStack.length - 1];
      const restored = deserializeEngine(next);
      lastCoalesceKey = null;
      set((state) => {
        state.redoStack.pop();
        state.undoStack.push(current);
        if (state.undoStack.length > MAX_HISTORY) state.undoStack.shift();
        state.engine = restored;
        state.activeSheet = restored.getActiveSheetName();
        state.sheetNames = restored.getSheetNames();
        state.graphRenderer = null;
        state.selectedCell = null;
        state.selectionRange = null;
        state.fillRange = null;
        state.isSelecting = false;
        state.dirtyValues.clear();
        state.dirtyFormulas.clear();
        state.canUndo = true;
        state.canRedo = state.redoStack.length > 0;
        state.docVersion += 1;
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

      recordHistory();
      engine.setCell(row, col, value);

      // Sheet -> Market bridge: any ticker referenced literally in a STOCK()
      // formula joins the watchlist, so the Market chart is always a live
      // view of the symbols the workbook actually uses.
      if (typeof value === 'string' && /\bSTOCK\s*\(/i.test(value)) {
        const tickerLiterals = value.matchAll(/\bSTOCK\s*\(\s*"([A-Za-z.\-:]{1,10})"/gi);
        for (const match of tickerLiterals) {
          get().addWatchedTicker(match[1]);
        }
      }

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
      recordHistory();
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

      recordHistory();
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

      recordHistory();
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
      recordHistory();
      engine.formatCell(row, col, format);
      set((state) => {
        state.engine = engine;
        state.docVersion += 1;
      });
    },

    sortColumn: (col, ascending) => {
      if (get().isReadOnly) return;
      const { engine } = get();
      recordHistory();
      engine.sortColumn(col, ascending);
      set((state) => {
        state.engine = engine;
        state.docVersion += 1;
      });
    },

    insertRow: (row) => {
      if (get().isReadOnly) return;
      const { engine } = get();
      recordHistory();
      engine.insertRow(row);
      set((state) => {
        state.engine = engine;
        state.docVersion += 1;
      });
    },

    deleteRow: (row) => {
      if (get().isReadOnly) return;
      const { engine } = get();
      recordHistory();
      engine.deleteRow(row);
      set((state) => {
        state.engine = engine;
        state.docVersion += 1;
      });
    },

    insertColumn: (col) => {
      if (get().isReadOnly) return;
      const { engine } = get();
      recordHistory();
      engine.insertColumn(col);
      set((state) => {
        state.engine = engine;
        state.docVersion += 1;
      });
    },

    deleteColumn: (col) => {
      if (get().isReadOnly) return;
      const { engine } = get();
      recordHistory();
      engine.deleteColumn(col);
      set((state) => {
        state.engine = engine;
        state.docVersion += 1;
      });
    },

    setParameter: (row, col, min, max, step) => {
      if (get().isReadOnly) return;
      const { engine } = get();
      recordHistory();
      engine.setParameter(row, col, min, max, step);
      set((state) => {
        state.engine = engine;
        state.docVersion += 1;
      });
    },

    updateParameter: (row, col, value) => {
      if (get().isReadOnly) return;
      const { engine } = get();
      // Coalesce a continuous drag on one parameter into a single undo step.
      recordHistory(`param:${col},${row}`);
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

    addGraph: (id, formula, type = 'function') => {
      if (get().isReadOnly) return;
      const { engine } = get();
      recordHistory();
      engine.addGraph(id, formula, type);
      set((state) => {
        state.engine = engine;
        state.docVersion += 1;
      });
    },

    removeGraph: (id) => {
      if (get().isReadOnly) return;
      const { engine } = get();
      recordHistory();
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
        state.sheetKinds = { ...state.sheetKinds, [name]: 'grid' };
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

    // Create a full-canvas graph sheet and switch to it. When seedFromActive is
    // set, the plots/functions on the current sheet are copied in (rewritten to
    // reference the source sheet, e.g. PLOT(A:A) -> PLOT(Sheet1!A:A)) so
    // "open graph as a sheet" carries the graphs you were already looking at.
    addGraphSheet: (seedFromActive = false) => {
      if (get().isReadOnly) return '';
      const { engine, sheetNames, activeSheet } = get();
      const sourceSheet = activeSheet;
      const sourceGraphs = seedFromActive ? engine.getGraphs(sourceSheet) : [];

      let suffix = 1;
      let name = `Graph${suffix}`;
      while (sheetNames.includes(name)) {
        suffix += 1;
        name = `Graph${suffix}`;
      }

      engine.addWorksheet(name, 'graph');
      // Re-anchor each seeded graph's cell references to the source sheet so it
      // still resolves once the active sheet is the (data-less) graph sheet.
      sourceGraphs.forEach((graph, i) => {
        const formula = qualifyFormulaRefs(graph.formula, sourceSheet);
        engine.addGraph(`${name}-g${i + 1}`, formula, graph.type === 'plot' ? 'plot' : 'function', name);
      });
      engine.setActiveWorksheet(name);

      set((state) => {
        state.engine = engine;
        state.activeSheet = name;
        state.sheetNames = [...sheetNames, name];
        state.sheetKinds = { ...state.sheetKinds, [name]: 'graph' };
        state.selectedCell = null;
        state.selectionRange = null;
        state.fillRange = null;
        state.graphRenderer = null;
        state.dirtyValues.clear();
        state.dirtyFormulas.clear();
        state.docVersion += 1;
      });
      return name;
    },

    // ---- Guided templates ----
    // Each writes a ready-to-explore model onto the active sheet, wiring inputs
    // (as slider parameters), formulas, and a chart so the result is live the
    // moment it lands. Shared by the start screen and the ribbon.

    insertMonteCarloModel: () => {
      const s = get();
      if (s.isReadOnly) return;
      s.setCell(1, 1, 'Monte Carlo Stock Model');
      s.setCell(2, 1, 'Ticker'); s.setCell(2, 2, 'AAPL');
      s.setCell(3, 1, 'Start price'); s.setCell(3, 2, '=STOCK(B2, "price")');
      s.setCell(4, 1, 'Horizon (days)'); s.setCell(4, 2, 252); s.setParameter(4, 2, 5, 504, 1);
      s.setCell(5, 1, 'Expected return (annual)'); s.setCell(5, 2, 0.08); s.setParameter(5, 2, -0.5, 0.5, 0.01);
      s.setCell(6, 1, 'Volatility (annual)'); s.setCell(6, 2, 0.25); s.setParameter(6, 2, 0.05, 1, 0.01);
      s.setCell(7, 1, 'Simulations'); s.setCell(7, 2, 5000); s.setParameter(7, 2, 500, 20000, 500);
      s.setCell(9, 1, 'Simulated prices'); s.setCell(9, 2, '=MC_TERMINAL(B3, B5, B6, B4, B7)');
      s.setCell(11, 1, 'Expected value'); s.setCell(11, 2, '=AVERAGE(B9)');
      s.setCell(12, 1, 'Median'); s.setCell(12, 2, '=MEDIAN(B9)');
      s.setCell(13, 1, 'Probability of loss'); s.setCell(13, 2, '=PROB_BELOW(B9, B3)');
      s.setCell(14, 1, '5th percentile'); s.setCell(14, 2, '=PERCENTILE(B9, 0.05)');
      s.setCell(15, 1, '95th percentile'); s.setCell(15, 2, '=PERCENTILE(B9, 0.95)');
      s.setCell(16, 1, 'Value at Risk (95%)'); s.setCell(16, 2, '=VALUE_AT_RISK(B9, B3, 0.95)');
      s.setCell(17, 1, 'Expected shortfall (5%)'); s.setCell(17, 2, '=EXPECTED_SHORTFALL(B9, 0.05)');
      s.addGraph(`mc_hist_${Date.now()}`, 'PLOT(HISTOGRAM(B9, 40))', 'plot');
    },

    insertStockTemplate: () => {
      const s = get();
      if (s.isReadOnly) return;
      s.setCell(1, 1, 'Ticker'); s.setCell(1, 2, 'AAPL');
      s.setCell(2, 1, 'Days'); s.setCell(2, 2, 90); s.setParameter(2, 2, 5, 365, 1);
      s.setCell(3, 1, 'Last price'); s.setCell(3, 2, '=STOCK(B1, "price")');
      s.setCell(4, 1, 'Avg close'); s.setCell(4, 2, '=AVERAGE(STOCK(B1, "close", B2))');
      s.setCell(5, 1, 'Chart'); s.setCell(5, 2, '=PLOT(STOCK(B1, "close", B2))');
    },

    insertEngineeringModel: () => {
      const s = get();
      if (s.isReadOnly) return;
      s.setCell(1, 1, 'Projectile Motion');
      s.setCell(2, 1, 'Launch speed (m/s)'); s.setCell(2, 2, 30); s.setParameter(2, 2, 1, 100, 1);
      s.setCell(3, 1, 'Launch angle (deg)'); s.setCell(3, 2, 45); s.setParameter(3, 2, 0, 90, 1);
      s.setCell(4, 1, 'Gravity (m/s^2)'); s.setCell(4, 2, 9.81);
      s.setCell(6, 1, 'Range (m)'); s.setCell(6, 2, '=B2^2 * SIN(2*B3*PI()/180) / B4');
      s.setCell(7, 1, 'Max height (m)'); s.setCell(7, 2, '=(B2*SIN(B3*PI()/180))^2 / (2*B4)');
      s.setCell(8, 1, 'Flight time (s)'); s.setCell(8, 2, '=2*B2*SIN(B3*PI()/180)/B4');
      // Trajectory y(x); a function graph that reshapes as the sliders move.
      s.addGraph(
        `traj_${Date.now()}`,
        'TAN(B3*PI()/180)*x - B4*x^2/(2*(B2*COS(B3*PI()/180))^2)',
        'function'
      );
    },

    insertDataExploration: () => {
      const s = get();
      if (s.isReadOnly) return;
      s.setCell(1, 1, 'Data Exploration');
      s.setCell(1, 4, 'Sample');
      // Deterministic sample series in D2:D21 (bell-ish spread around 50).
      const sample = [42, 55, 48, 61, 50, 47, 58, 53, 44, 62, 49, 51, 46, 57, 52, 45, 60, 54, 43, 56];
      sample.forEach((v, i) => s.setCell(2 + i, 4, v));
      s.setCell(2, 1, 'Count'); s.setCell(2, 2, '=COUNT(D2:D21)');
      s.setCell(3, 1, 'Average'); s.setCell(3, 2, '=AVERAGE(D2:D21)');
      s.setCell(4, 1, 'Std dev'); s.setCell(4, 2, '=STDEV(D2:D21)');
      s.setCell(5, 1, 'Min'); s.setCell(5, 2, '=MIN(D2:D21)');
      s.setCell(6, 1, 'Max'); s.setCell(6, 2, '=MAX(D2:D21)');
      s.setCell(7, 1, 'Median'); s.setCell(7, 2, '=MEDIAN(D2:D21)');
      s.addGraph(`data_hist_${Date.now()}`, 'PLOT(HISTOGRAM(D2:D21, 12))', 'plot');
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
        const nextKinds = { ...state.sheetKinds };
        delete nextKinds[name];
        state.sheetKinds = nextKinds;
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
        const newRenderer = new GraphRenderer(worksheet, engine.getSheets());
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
      // The chart's timeframe is engine state too: cells using MARKETDAYS()
      // (e.g. =AVERAGE(STOCK("AAPL","close",MARKETDAYS()))) follow along.
      const days = label === 'Custom'
        ? get().marketCustomRange?.days ?? 63
        : TIMEFRAME_BARS[label] ?? 63;
      setMarketTimeframeDays(days);
      get().refreshStockData();
    },

    setMarketCustomRange: (startMs, days) => {
      set((state) => {
        state.marketCustomRange = { startMs, days };
        state.marketTimeframe = 'Custom';
      });
      setMarketTimeframeDays(days);
      get().refreshStockData();
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
    };
  })
);

// When asynchronously fetched market data lands, resolve every "Loading…"
// STOCK() cell and repaint dependent graphs — one recalculation, same engine.
onStockData(() => useAccelStore.getState().refreshStockData());
