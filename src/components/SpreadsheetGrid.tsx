/**
 * Spreadsheet Grid Component
 * Excel-like grid interface with full keyboard support
 */

import React, { useState, useCallback, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { useAccelStore } from '../store/accel-store';
import { CellValue, CellFormat } from '../engine/types';
import './SpreadsheetGrid.css';

const ROWS = 1000;
const COLS = 52; // A-AZ (52 columns)
const ROW_HEIGHT = 24;
const COL_WIDTH = 120; // Default column width in pixels (matches CSS)
const MIN_COL_WIDTH = 48; // Smallest a column can be dragged
const OVERSCAN = 10; // Increased significantly to prevent cells disappearing during scroll
const DEFAULT_VIEWPORT_HEIGHT = 600;
const DEFAULT_VIEWPORT_WIDTH = 1200;

// Recognized formula error markers. A cell whose evaluation failed stores its
// value as a string starting with one of these tokens; we render a compact,
// trustworthy badge (never a raw exception) with the full text as a tooltip.
interface ErrorInfo {
  label: string;
  title: string;
}
function getErrorInfo(value: string): ErrorInfo | null {
  if (!value || value[0] !== '#') return null;
  if (value.startsWith('#ERROR')) {
    const message = value.replace(/^#ERROR:?\s*/, '').trim();
    return { label: '#ERROR!', title: message || 'Formula error' };
  }
  if (/^#(N\/A|REF|VALUE|DIV\/0|NAME|NULL|NUM|CIRC)\b/i.test(value)) {
    return { label: value.split(/\s+/)[0], title: value };
  }
  return null;
}

// Left edge (x) of a 1-based column given a cumulative-offset table. colLeft[c]
// is the pixel offset of column c; returns the last column whose left edge is at
// or before scrollLeft (the first column that should render). Only 52 columns,
// so a linear scan is cheaper than the machinery a binary search would need.
function firstColAt(colLeft: number[], scrollLeft: number): number {
  let col = 1;
  for (let c = 1; c <= COLS; c++) {
    if (colLeft[c] <= scrollLeft) col = c;
    else break;
  }
  return col;
}

interface GridCellProps {
  row: number;
  col: number;
  displayValue: string;
  colWidth: number;
  cellFormat?: CellFormat;
  isSelected: boolean;
  isEditing: boolean;
  isParameter?: boolean;
  isInFillRange: boolean;
  isInSelectionRange?: boolean;
  onClick: (e: React.MouseEvent<HTMLTableCellElement>) => void;
  onDoubleClick: (e: React.MouseEvent<HTMLTableCellElement>) => void;
  onMouseEnter: (e: React.MouseEvent<HTMLTableCellElement>) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLTableCellElement>) => void;
  onFillHandleMouseDown: (e: React.MouseEvent) => void;
}

const GridCell: React.FC<GridCellProps> = React.memo(({
  row,
  col,
  displayValue,
  colWidth,
  cellFormat,
  isSelected,
  isEditing,
  isParameter,
  isInFillRange,
  isInSelectionRange,
  onClick,
  onDoubleClick,
  onMouseEnter,
  onMouseDown,
  onFillHandleMouseDown,
}) => {
  const cellStyle: React.CSSProperties = useMemo(() => ({
    ...(cellFormat?.bold && { fontWeight: 'bold' }),
    ...(cellFormat?.italic && { fontStyle: 'italic' }),
    ...(cellFormat?.underline && { textDecoration: 'underline' }),
    ...(cellFormat?.fontColor && { color: cellFormat.fontColor }),
    ...(cellFormat?.backgroundColor && { backgroundColor: cellFormat.backgroundColor }),
  }), [cellFormat]);

  const tdStyle: React.CSSProperties = useMemo(() => ({
    width: colWidth,
    ...(cellFormat?.backgroundColor && { backgroundColor: cellFormat.backgroundColor }),
  }), [colWidth, cellFormat?.backgroundColor]);

  const errorInfo = getErrorInfo(displayValue);

  return (
    <td
      data-row={row}
      data-col={col}
      role="gridcell"
      aria-selected={isSelected || undefined}
      className={`cell ${isSelected ? 'selected' : ''} ${isParameter ? 'parameter' : ''} ${isInFillRange ? 'fill-range' : ''} ${isInSelectionRange ? 'in-selection' : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={onMouseEnter}
      onMouseDown={onMouseDown}
      style={tdStyle}
    >
      {!isEditing && (
        <div
          className={`cell-content${errorInfo ? ' cell-error' : ''}`}
          style={cellStyle}
          title={errorInfo ? errorInfo.title : undefined}
        >
          {errorInfo ? errorInfo.label : displayValue}
        </div>
      )}
      {isSelected && !isEditing && (
        <div
          className="fill-handle"
          onMouseDown={onFillHandleMouseDown}
        />
      )}
    </td>
  );
}, (prev, next) => {
  // Skip event handler comparison - they're stable via useCallback
  return (
    prev.row === next.row &&
    prev.col === next.col &&
    prev.displayValue === next.displayValue &&
    prev.colWidth === next.colWidth &&
    prev.isSelected === next.isSelected &&
    prev.isEditing === next.isEditing &&
    prev.isParameter === next.isParameter &&
    prev.isInFillRange === next.isInFillRange &&
    prev.isInSelectionRange === next.isInSelectionRange &&
    prev.cellFormat?.bold === next.cellFormat?.bold &&
    prev.cellFormat?.italic === next.cellFormat?.italic &&
    prev.cellFormat?.underline === next.cellFormat?.underline &&
    prev.cellFormat?.fontColor === next.cellFormat?.fontColor &&
    prev.cellFormat?.backgroundColor === next.cellFormat?.backgroundColor
  );
});

export const SpreadsheetGrid: React.FC = () => {
  // Split selectors: actions don't trigger re-renders, only data changes do
  const selectedCell = useAccelStore((state) => state.selectedCell);
  const fillRange = useAccelStore((state) => state.fillRange);
  const selectionRange = useAccelStore((state) => state.selectionRange);
  const isSelecting = useAccelStore((state) => state.isSelecting);
  // Dirty cell tracking (Excel-grade optimization)
  const dirtyValues = useAccelStore((state) => state.dirtyValues);
  const dirtyFormulas = useAccelStore((state) => state.dirtyFormulas);

  // Actions - stable references, don't cause re-renders
  const setCell = useAccelStore((state) => state.setCell);
  const getCell = useAccelStore((state) => state.getCell);
  const getCellObject = useAccelStore((state) => state.getCellObject);
  const selectCell = useAccelStore((state) => state.selectCell);
  const clearDirty = useAccelStore((state) => state.clearDirty);
  const startSelection = useAccelStore((state) => state.startSelection);
  const updateSelection = useAccelStore((state) => state.updateSelection);
  const endSelection = useAccelStore((state) => state.endSelection);
  const clearSelection = useAccelStore((state) => state.clearSelection);
  const copyCell = useAccelStore((state) => state.copyCell);
  const pasteCell = useAccelStore((state) => state.pasteCell);
  const cutCell = useAccelStore((state) => state.cutCell);
  const setFillRange = useAccelStore((state) => state.setFillRange);
  const clearFillRange = useAccelStore((state) => state.clearFillRange);
  const executeFill = useAccelStore((state) => state.executeFill);
  const undo = useAccelStore((state) => state.undo);
  const redo = useAccelStore((state) => state.redo);
  // engine + docVersion power the fresh-sheet empty-state hint; docVersion
  // bumps on every mutation so the reactive read stays current.
  const engine = useAccelStore((state) => state.engine);
  const docVersion = useAccelStore((state) => state.docVersion);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isDraggingFill, setIsDraggingFill] = useState(false);
  const [formulaHint, setFormulaHint] = useState<{ func: string; params: string[]; currentParam: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const pendingFillTarget = useRef<{ row: number; col: number } | null>(null);
  const fillRangeRaf = useRef<number | null>(null);
  const [virtualWindow, setVirtualWindow] = useState({ startRow: 1, startCol: 1 });
  const [viewportHeight, setViewportHeight] = useState(DEFAULT_VIEWPORT_HEIGHT);
  const [viewportWidth, setViewportWidth] = useState(DEFAULT_VIEWPORT_WIDTH);
  // Per-column widths (all default to COL_WIDTH -> geometry is byte-identical to
  // the fixed-width grid until the user drags a column border).
  const [colWidths, setColWidths] = useState<number[]>(() => new Array(COLS).fill(COL_WIDTH));
  const [resizingCol, setResizingCol] = useState<number | null>(null);
  const colResizeRef = useRef<{ col: number; startX: number; startWidth: number } | null>(null);
  // Cumulative left-edge offsets (1-based; colLeftRef.current[c] = x of column c,
  // [COLS+1] = total width). Kept in a ref so the stable scroll/measure callbacks
  // always read the latest widths without re-subscribing.
  const colLeftRef = useRef<number[]>((() => {
    const arr = new Array<number>(COLS + 2);
    arr[1] = 0;
    for (let c = 1; c <= COLS; c++) arr[c + 1] = arr[c] + COL_WIDTH;
    return arr;
  })());
  const scrollRaf = useRef<number | null>(null);
  const caretPositionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const lastInsertedRef = useRef<{ start: number; end: number } | null>(null);

  // Formula signatures for parameter hints
  const formulaSignatures: Record<string, string[]> = useMemo(() => ({
    SUM: ['number1', 'number2', '...'],
    AVERAGE: ['number1', 'number2', '...'],
    COUNT: ['value1', 'value2', '...'],
    MAX: ['number1', 'number2', '...'],
    MIN: ['number1', 'number2', '...'],
    IF: ['logical_test', 'value_if_true', 'value_if_false'],
    VLOOKUP: ['lookup_value', 'table_array', 'col_index_num', '[range_lookup]'],
    HLOOKUP: ['lookup_value', 'table_array', 'row_index_num', '[range_lookup]'],
    INDEX: ['array', 'row_num', '[column_num]'],
    MATCH: ['lookup_value', 'lookup_array', '[match_type]'],
    CONCATENATE: ['text1', 'text2', '...'],
    LEFT: ['text', '[num_chars]'],
    RIGHT: ['text', '[num_chars]'],
    MID: ['text', 'start_num', 'num_chars'],
    LEN: ['text'],
    TRIM: ['text'],
    UPPER: ['text'],
    LOWER: ['text'],
    ROUND: ['number', 'num_digits'],
    ROUNDUP: ['number', 'num_digits'],
    ROUNDDOWN: ['number', 'num_digits'],
    ABS: ['number'],
    POWER: ['number', 'power'],
    SQRT: ['number'],
    SIN: ['number'],
    COS: ['number'],
    TAN: ['number'],
    PLOT: ['y_values', '[x_values]'],
    DATE: ['year', 'month', 'day'],
    NOW: [],
    TODAY: [],
  }), []);

  // Focus grid on mount for keyboard navigation
  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.focus();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (fillRangeRaf.current !== null) {
        cancelAnimationFrame(fillRangeRaf.current);
      }
      if (scrollRaf.current !== null) {
        cancelAnimationFrame(scrollRaf.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (!gridWrapperRef.current) return;

    const measure = () => {
      if (!gridWrapperRef.current) return;
      setViewportHeight(gridWrapperRef.current.clientHeight || DEFAULT_VIEWPORT_HEIGHT);
      setViewportWidth(gridWrapperRef.current.clientWidth || DEFAULT_VIEWPORT_WIDTH);
      const scrollTop = gridWrapperRef.current.scrollTop;
      const scrollLeft = gridWrapperRef.current.scrollLeft;
      const nextStartRow = Math.max(1, Math.floor(scrollTop / ROW_HEIGHT) + 1 - OVERSCAN);
      const nextStartCol = Math.max(1, firstColAt(colLeftRef.current, scrollLeft) - OVERSCAN);
      setVirtualWindow((prev) => {
        if (prev.startRow === nextStartRow && prev.startCol === nextStartCol) {
          return prev;
        }
        return { startRow: nextStartRow, startCol: nextStartCol };
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(gridWrapperRef.current);
    return () => observer.disconnect();
  }, []);

  const handleCellClick = useCallback((e: React.MouseEvent<HTMLTableCellElement>) => {
    const row = parseInt(e.currentTarget.dataset.row || '0', 10);
    const col = parseInt(e.currentTarget.dataset.col || '0', 10);
    if (row && col) {
      selectCell(row, col);
    }
  }, [selectCell]);

  const startEditing = useCallback((row: number, col: number, initialValue: string = '') => {
    setEditingCell({ row, col });
    const cellObj = getCellObject(row, col);
    const value = initialValue || cellObj?.formula || String(cellObj?.value ?? '');
    setEditValue(value);
    lastInsertedRef.current = null;
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const pos = inputRef.current.value.length;
        inputRef.current.setSelectionRange(pos, pos);
        caretPositionRef.current = { start: pos, end: pos };
      }
    }, 0);
  }, [getCellObject]);

  const handleCellDoubleClick = useCallback((e: React.MouseEvent<HTMLTableCellElement>) => {
    const row = parseInt(e.currentTarget.dataset.row || '0', 10);
    const col = parseInt(e.currentTarget.dataset.col || '0', 10);
    if (row && col) {
      selectCell(row, col);
      startEditing(row, col);
    }
  }, [selectCell, startEditing]);

  const handleCellMouseDown = useCallback((e: React.MouseEvent<HTMLTableCellElement>) => {
    if (e.button !== 0) return; // Only left click
    const row = parseInt(e.currentTarget.dataset.row || '0', 10);
    const col = parseInt(e.currentTarget.dataset.col || '0', 10);

    if (row && col) {
      if (e.shiftKey && selectedCell) {
        // Shift+click to extend selection
        startSelection(selectedCell.row, selectedCell.col);
        updateSelection(row, col);
        endSelection();
      } else {
        // Start new selection
        startSelection(row, col);
      }
    }
  }, [selectedCell, startSelection, updateSelection, endSelection]);

  // Global mouse up handler for selection
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isSelecting) {
        endSelection();
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isSelecting, endSelection]);

  const handleCellSubmit = useCallback(() => {
    if (editingCell) {
      setCell(editingCell.row, editingCell.col, editValue);
      setEditingCell(null);
      setEditValue('');
      lastInsertedRef.current = null;
      gridRef.current?.focus();
    }
  }, [editingCell, editValue, setCell]);

  const handleFormulaKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCellSubmit();
      if (selectedCell && selectedCell.row < ROWS) {
        selectCell(selectedCell.row + 1, selectedCell.col);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingCell(null);
      setEditValue('');
      gridRef.current?.focus();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleCellSubmit();
      if (selectedCell) {
        const nextCol = e.shiftKey
          ? (selectedCell.col > 1 ? selectedCell.col - 1 : COLS)
          : (selectedCell.col < COLS ? selectedCell.col + 1 : 1);
        selectCell(selectedCell.row, nextCol);
      }
    }
  }, [handleCellSubmit, selectedCell, selectCell]);

  // AutoFill drag handlers
  const handleFillHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    pendingFillTarget.current = null;
    setIsDraggingFill(true);
  }, []);

  const handleCellMouseEnter = useCallback((e: React.MouseEvent<HTMLTableCellElement>) => {
    const row = parseInt(e.currentTarget.dataset.row || '0', 10);
    const col = parseInt(e.currentTarget.dataset.col || '0', 10);
    if (!row || !col) return;

    if (isDraggingFill && selectedCell) {
      // Only allow filling in the same row or column as the source
      if (row === selectedCell.row || col === selectedCell.col) {
        const targetChanged = !pendingFillTarget.current || pendingFillTarget.current.row !== row || pendingFillTarget.current.col !== col;
        if (targetChanged) {
          pendingFillTarget.current = { row, col };
          if (fillRangeRaf.current === null) {
            fillRangeRaf.current = requestAnimationFrame(() => {
              if (pendingFillTarget.current) {
                setFillRange(pendingFillTarget.current.row, pendingFillTarget.current.col);
              }
              fillRangeRaf.current = null;
            });
          }
        }
      }
    } else if (isSelecting) {
      updateSelection(row, col);
    }
  }, [isDraggingFill, selectedCell, setFillRange, isSelecting, updateSelection]);

  const handleMouseUp = useCallback(() => {
    if (isDraggingFill) {
      executeFill();
      setIsDraggingFill(false);
      clearFillRange();
      pendingFillTarget.current = null;
      if (fillRangeRaf.current !== null) {
        cancelAnimationFrame(fillRangeRaf.current);
        fillRangeRaf.current = null;
      }
    }
  }, [isDraggingFill, executeFill, clearFillRange]);

  // Add global mouse up listener
  useEffect(() => {
    if (isDraggingFill) {
      document.addEventListener('mouseup', handleMouseUp);
      return () => document.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isDraggingFill, handleMouseUp]);

  // Clear dirty tracking after render (Excel-grade optimization)
  useLayoutEffect(() => {
    if (dirtyValues.size > 0 || dirtyFormulas.size > 0) {
      clearDirty();
    }
  }, [dirtyValues, dirtyFormulas, clearDirty]);

  // Grid keyboard navigation
  const handleGridKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Escape always cancels an in-progress edit, like Excel — even when the
    // grid (not the formula input) has focus. Leaving the edit active meant
    // the NEXT commit silently landed in the stale editing cell.
    if (e.key === 'Escape') {
      e.preventDefault();
      setEditingCell(null);
      setEditValue('');
      clearSelection();
      return;
    }

    // Undo / Redo. Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z or Ctrl+Y redoes.
    // Handled BEFORE the selected-cell guard: undo() clears the selection, so
    // gating these on selectedCell would swallow every keystroke after the
    // first undo. Skipped while editing, where the input owns its text history.
    // Store actions are no-ops when there is nothing to undo/redo or the
    // workbook is read-only, so we can call them unconditionally.
    if (!editingCell && (e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
      return;
    }
    if (!editingCell && (e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
      e.preventDefault();
      redo();
      return;
    }

    if (!selectedCell || editingCell) return;

    const { row, col } = selectedCell;

    // Copy/Paste/Cut shortcuts
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      e.preventDefault();
      copyCell(row, col);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      e.preventDefault();
      pasteCell(row, col);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
      e.preventDefault();
      cutCell(row, col);
      return;
    }
    // Ctrl+Arrow: jump to the edge of the data region, like Excel
    if ((e.ctrlKey || e.metaKey) && e.key.startsWith('Arrow')) {
      e.preventDefault();
      const dr = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
      const dc = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      const isEmpty = (r: number, c: number) => {
        const v = getCell(r, c);
        return v === null || v === undefined || v === '';
      };
      let r = row;
      let c = col;
      const inBounds = (rr: number, cc: number) => rr >= 1 && rr <= ROWS && cc >= 1 && cc <= COLS;
      if (inBounds(r + dr, c + dc) && !isEmpty(r + dr, c + dc)) {
        // Inside a data run: go to its far edge
        while (inBounds(r + dr, c + dc) && !isEmpty(r + dr, c + dc)) { r += dr; c += dc; }
      } else {
        // In empty space: go to the next occupied cell, or the sheet edge
        while (inBounds(r + dr, c + dc) && isEmpty(r + dr, c + dc)) { r += dr; c += dc; }
        if (!inBounds(r + dr, c + dc)) {
          // hit the boundary
        } else { r += dr; c += dc; }
      }
      selectCell(r, c);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Home') {
      e.preventDefault();
      selectCell(1, 1);
      return;
    }
    if (e.key === 'PageDown') {
      e.preventDefault();
      selectCell(Math.min(ROWS, row + 20), col);
      return;
    }
    if (e.key === 'PageUp') {
      e.preventDefault();
      selectCell(Math.max(1, row - 20), col);
      return;
    }

    // Arrow key navigation
    if (e.key === 'ArrowUp' && row > 1) {
      e.preventDefault();
      selectCell(row - 1, col);
    } else if (e.key === 'ArrowDown' && row < ROWS) {
      e.preventDefault();
      selectCell(row + 1, col);
    } else if (e.key === 'ArrowLeft' && col > 1) {
      e.preventDefault();
      selectCell(row, col - 1);
    } else if (e.key === 'ArrowRight' && col < COLS) {
      e.preventDefault();
      selectCell(row, col + 1);
    }
    // Enter key - start editing or move down
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey && row > 1) {
        selectCell(row - 1, col);
      } else if (!e.shiftKey && row < ROWS) {
        selectCell(row + 1, col);
      }
    }
    // Tab key - move right/left
    else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey && col > 1) {
        selectCell(row, col - 1);
      } else if (!e.shiftKey && col < COLS) {
        selectCell(row, col + 1);
      }
    }
    // F2 key - start editing
    else if (e.key === 'F2') {
      e.preventDefault();
      startEditing(row, col);
    }
    // Delete key - clear cell
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      setCell(row, col, '');
    }
    // Any other key - start typing
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      startEditing(row, col, e.key);
    }
  }, [selectedCell, editingCell, selectCell, copyCell, pasteCell, cutCell, setCell, startEditing, undo, redo, clearSelection, getCell]);

  const handleGridScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (scrollRaf.current !== null) {
      cancelAnimationFrame(scrollRaf.current);
    }
    scrollRaf.current = requestAnimationFrame(() => {
      const nextStartRow = Math.max(1, Math.floor(target.scrollTop / ROW_HEIGHT) + 1 - OVERSCAN);
      const nextStartCol = Math.max(1, firstColAt(colLeftRef.current, target.scrollLeft) - OVERSCAN);
      setVirtualWindow((prev) => {
        if (prev.startRow === nextStartRow && prev.startCol === nextStartCol) {
          return prev;
        }
        return { startRow: nextStartRow, startCol: nextStartCol };
      });
      scrollRaf.current = null;
    });
  }, []);

  const colToLetter = useCallback((col: number): string => {
    let letter = '';
    let c = col;
    while (c > 0) {
      const remainder = (c - 1) % 26;
      letter = String.fromCharCode(65 + remainder) + letter;
      c = Math.floor((c - 1) / 26);
    }
    return letter;
  }, []);

  const columnLabels = useMemo(
    () => Array.from({ length: COLS }, (_, idx) => colToLetter(idx + 1)),
    [colToLetter]
  );

  // Cumulative left-edge offsets for the current column widths. Reduces to the
  // uniform fixed-width table when no column has been resized. Assigned to the
  // ref during render so the scroll/measure callbacks always read fresh values.
  const colLeft = useMemo(() => {
    const arr = new Array<number>(COLS + 2);
    arr[1] = 0;
    for (let c = 1; c <= COLS; c++) arr[c + 1] = arr[c] + colWidths[c - 1];
    return arr;
  }, [colWidths]);
  colLeftRef.current = colLeft;

  // Begin dragging a column border. Global listeners (installed by the effect
  // below while resizingCol is set) do the actual width tracking.
  const handleResizeMouseDown = useCallback((e: React.MouseEvent, col: number) => {
    e.preventDefault();
    e.stopPropagation();
    colResizeRef.current = { col, startX: e.clientX, startWidth: colWidths[col - 1] };
    setResizingCol(col);
  }, [colWidths]);

  useEffect(() => {
    if (resizingCol === null) return;

    const handleMove = (ev: MouseEvent) => {
      const state = colResizeRef.current;
      if (!state) return;
      const next = Math.max(MIN_COL_WIDTH, Math.round(state.startWidth + (ev.clientX - state.startX)));
      setColWidths((prev) => {
        if (prev[state.col - 1] === next) return prev;
        const copy = prev.slice();
        copy[state.col - 1] = next;
        return copy;
      });
    };
    const handleEnd = () => {
      colResizeRef.current = null;
      setResizingCol(null);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
    };
  }, [resizingCol]);

  const formatCellValue = useCallback((value: CellValue): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
      // Fast number formatting - toLocaleString is VERY slow
      // Only use it for numbers that need special formatting
      if (Number.isInteger(value) && Math.abs(value) < 1000000) {
        return String(value);
      }
      // For decimals, use toFixed for better performance
      const str = value.toFixed(10);
      return str.replace(/\.?0+$/, ''); // Remove trailing zeros
    }
    return String(value);
  }, []);

  // Parse formula to detect function and current parameter for hints
  const updateFormulaHint = useCallback((formula: string, caretPos: number) => {
    if (!formula.startsWith('=')) {
      setFormulaHint(null);
      return;
    }

    // Find the function call that contains the caret
    const beforeCaret = formula.substring(0, caretPos);

    // Match function name and opening parenthesis
    const funcMatch = beforeCaret.match(/([A-Z_]+)\(([^)]*)$/);
    if (!funcMatch) {
      setFormulaHint(null);
      return;
    }

    const funcName = funcMatch[1];
    const params = formulaSignatures[funcName];

    if (!params) {
      setFormulaHint(null);
      return;
    }

    // Count commas to determine current parameter (ignoring commas in quotes)
    const argsText = funcMatch[2];
    let currentParam = 0;
    let inQuotes = false;
    let parenDepth = 0;

    for (let i = 0; i < argsText.length; i++) {
      const char = argsText[i];
      if (char === '"' && (i === 0 || argsText[i - 1] !== '\\')) {
        inQuotes = !inQuotes;
      } else if (!inQuotes) {
        if (char === '(') {
          parenDepth++;
        } else if (char === ')') {
          parenDepth--;
        } else if (char === ',' && parenDepth === 0) {
          currentParam++;
        }
      }
    }

    setFormulaHint({ func: funcName, params, currentParam });
  }, [formulaSignatures]);

  const totalGridHeight = ROWS * ROW_HEIGHT;
  const totalGridWidth = colLeft[COLS + 1];

  const estimatedVisibleRowCount = viewportHeight > 0
    ? Math.ceil(viewportHeight / ROW_HEIGHT)
    : ROWS;
  const startRow = Math.max(1, Math.min(ROWS, virtualWindow.startRow));
  const endRow = Math.min(ROWS, startRow + estimatedVisibleRowCount + OVERSCAN * 2 - 1);
  const topSpacerHeight = (startRow - 1) * ROW_HEIGHT;
  const bottomSpacerHeight = Math.max(totalGridHeight - endRow * ROW_HEIGHT, 0);

  const startCol = Math.max(1, Math.min(COLS, virtualWindow.startCol));
  // startCol already sits OVERSCAN columns behind the true first visible column,
  // so measure the viewport from that true first column, walk until it is fully
  // covered, then pad another OVERSCAN so cells never blank out during scroll.
  const firstVisibleCol = Math.min(COLS, startCol + OVERSCAN);
  const rightBound = colLeft[firstVisibleCol] + (viewportWidth > 0 ? viewportWidth : DEFAULT_VIEWPORT_WIDTH);
  let coverCol = firstVisibleCol;
  while (coverCol < COLS && colLeft[coverCol + 1] < rightBound) coverCol++;
  const endCol = Math.min(COLS, coverCol + OVERSCAN);
  const leftSpacerWidth = colLeft[startCol];
  const rightSpacerWidth = Math.max(totalGridWidth - colLeft[endCol + 1], 0);

  const visibleRows = useMemo(
    () => Array.from({ length: endRow - startRow + 1 }, (_, i) => startRow + i),
    [startRow, endRow]
  );
  const visibleColumns = useMemo(
    () => Array.from({ length: endCol - startCol + 1 }, (_, i) => startCol + i),
    [startCol, endCol]
  );

  // Fresh-sheet hint: a workbook with no populated cells. Empty cells are pruned
  // from the engine's map, so size === 0 is an exact "nothing typed yet" signal.
  // docVersion bumps on every mutation, keeping this in sync without polling.
  // docVersion is an intentional trigger: it bumps on every mutation so the
  // empty-state check re-runs when cells change (engine ref stays stable).
  const isSheetEmpty = useMemo(
    () => engine.getWorksheet().cells.size === 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engine, docVersion]
  );

  // Memoize selected cell data for formula bar to avoid duplicate getCellObject calls
  const selectedCellData = useMemo(() => {
    if (!selectedCell) return null;
    const cellObj = getCellObject(selectedCell.row, selectedCell.col);
    return {
      formula: cellObj?.formula,
      value: cellObj?.value ?? '',
    };
  }, [selectedCell, getCellObject]);

  const formulaBarValue = useMemo(() => {
    if (editingCell) return editValue;
    if (!selectedCellData) return '';
    return selectedCellData.formula || String(selectedCellData.value);
  }, [editingCell, editValue, selectedCellData]);

  const applyReferenceToFormula = useCallback((row: number, col: number, replaceExisting: boolean, rangeStart?: { row: number; col: number }) => {
    if (!editingCell) return;

    // Create range reference if rangeStart is provided; a range that starts
    // and ends on the same cell is a plain reference (C4, never C4:C4).
    let refString: string;
    if (rangeStart && (rangeStart.row !== row || rangeStart.col !== col)) {
      const startRef = `${colToLetter(rangeStart.col)}${rangeStart.row}`;
      const endRef = `${colToLetter(col)}${row}`;
      refString = `${startRef}:${endRef}`;
    } else {
      refString = `${colToLetter(col)}${row}`;
    }

    const selection = replaceExisting && lastInsertedRef.current
      ? lastInsertedRef.current
      : caretPositionRef.current;

    const start = Math.max(0, selection.start ?? 0);
    const end = Math.max(start, selection.end ?? start);

    setEditValue((prev) => {
      const nextValue = prev.slice(0, start) + refString + prev.slice(end);
      const caretPos = start + refString.length;
      caretPositionRef.current = { start: caretPos, end: caretPos };
      lastInsertedRef.current = { start, end: caretPos };

      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(caretPos, caretPos);
        }
      });

      return nextValue;
    });
  }, [colToLetter, editingCell]);

  useEffect(() => {
    if (!editingCell) {
      lastInsertedRef.current = null;
    }
  }, [editingCell]);

  useEffect(() => {
    if (!editingCell || !selectedCell) return;

    const targetRow = selectionRange ? selectionRange.end.row : selectedCell.row;
    const targetCol = selectionRange ? selectionRange.end.col : selectedCell.col;

    if (targetRow === editingCell.row && targetCol === editingCell.col) return;

    // Only insert references when actively selecting (not during passive scrolling)
    // This prevents unwanted L#:L# insertions when just scrolling the sheet
    if (!isSelecting && !selectionRange && !lastInsertedRef.current) return;

    // Reference insertion is a FORMULA-building affordance. Without this
    // guard, dragging a multi-cell selection while a non-formula edit was
    // active spliced raw references into the value ("C4:C4B2:B2…").
    if (!editValue.startsWith('=')) return;

    // Pass range start if there's a selection range
    const rangeStart = selectionRange ? selectionRange.start : undefined;
    applyReferenceToFormula(targetRow, targetCol, Boolean(selectionRange) || Boolean(lastInsertedRef.current), rangeStart);
  }, [applyReferenceToFormula, editingCell, selectedCell, selectionRange, isSelecting, editValue]);

  // Helper function to get cell state (computed on-demand, not stored)
  // Memoized with dirty tracking to only update when cells actually change
  const getCellDisplayData = useCallback((row: number, col: number) => {
    const cellObj = getCellObject(row, col);
    const value = getCell(row, col);

    return {
      displayValue: formatCellValue(value),
      isParameter: cellObj?.isParameter || false,
      format: cellObj?.format,
    };
    // dirtyValues/dirtyFormulas are intentional triggers: they change identity
    // when cells recalc, forcing affected cells to repaint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getCellObject, getCell, formatCellValue, dirtyValues, dirtyFormulas]);

  // Helper function to get cell state (computed on-demand, not stored)
  const getCellStateData = useCallback((row: number, col: number) => {
    const isSelected = selectedCell?.row === row && selectedCell?.col === col;
    const isEditing = editingCell?.row === row && editingCell?.col === col;

    // Check if cell is in selection range
    const isInSelectionRange = selectionRange ? (
      row >= Math.min(selectionRange.start.row, selectionRange.end.row) &&
      row <= Math.max(selectionRange.start.row, selectionRange.end.row) &&
      col >= Math.min(selectionRange.start.col, selectionRange.end.col) &&
      col <= Math.max(selectionRange.start.col, selectionRange.end.col)
    ) : false;

    const isInFillRange = fillRange && selectedCell ? (
      (selectedCell.row === row && col >= Math.min(selectedCell.col, fillRange.col) && col <= Math.max(selectedCell.col, fillRange.col)) ||
      (selectedCell.col === col && row >= Math.min(selectedCell.row, fillRange.row) && row <= Math.max(selectedCell.row, fillRange.row))
    ) : false;

    return { isSelected, isEditing, isInSelectionRange, isInFillRange };
  }, [selectedCell, editingCell, selectionRange, fillRange]);

  return (
    <div
      className={`spreadsheet-container${resizingCol !== null ? ' resizing-col' : ''}`}
      ref={gridRef}
      tabIndex={0}
      role="grid"
      aria-label="Spreadsheet"
      aria-rowcount={ROWS}
      aria-colcount={COLS}
      onKeyDown={handleGridKeyDown}
    >
      <div className="formula-bar">
        <div className="cell-reference">
          {selectedCell && `${colToLetter(selectedCell.col)}${selectedCell.row}`}
        </div>
        <input
          ref={inputRef}
          type="text"
          className="formula-input"
          aria-label="Formula bar"
          value={formulaBarValue}
          onChange={(e) => {
            const value = e.target.value;
            const caretPos = e.target.selectionStart ?? 0;
            setEditValue(value);
            caretPositionRef.current = {
              start: caretPos,
              end: e.target.selectionEnd ?? 0,
            };
            lastInsertedRef.current = null;
            updateFormulaHint(value, caretPos);
          }}
          onSelect={(e) => {
            caretPositionRef.current = {
              start: e.currentTarget.selectionStart ?? 0,
              end: e.currentTarget.selectionEnd ?? 0,
            };
          }}
          onKeyDown={handleFormulaKeyDown}
          onFocus={() => {
            if (selectedCell && !editingCell) {
              startEditing(selectedCell.row, selectedCell.col);
            }
          }}
          placeholder="Enter formula or value"
        />
        {formulaHint && (
          <div className="formula-hint">
            <strong>{formulaHint.func}(</strong>
            {formulaHint.params.map((param, idx) => (
              <span key={idx} className={idx === formulaHint.currentParam ? 'current-param' : ''}>
                {idx > 0 && ', '}
                {param}
              </span>
            ))}
            <strong>)</strong>
          </div>
        )}
      </div>

      <div
        className="grid-wrapper"
        ref={gridWrapperRef}
        onScroll={handleGridScroll}
      >
        {isSheetEmpty && (
          <div className="grid-empty-hint" aria-hidden="true">
            <div className="grid-empty-title">This sheet is empty</div>
            <div className="grid-empty-sub">
              Click any cell and start typing. Begin a formula with <code>=</code>,
              drag the fill handle to extend a series, and press <kbd>Ctrl</kbd>+<kbd>Z</kbd> to undo.
            </div>
          </div>
        )}
        <table className="spreadsheet-grid">
          <thead>
            <tr>
              <th className="row-header"></th>
              {leftSpacerWidth > 0 && (
                <th style={{ width: leftSpacerWidth }} />
              )}
              {visibleColumns.map((col) => (
                <th
                  key={col}
                  className={`col-header${resizingCol === col ? ' resizing' : ''}`}
                  style={{ width: colWidths[col - 1] }}
                >
                  <span className="col-label">{columnLabels[col - 1] || colToLetter(col)}</span>
                  <span
                    className="col-resize-handle"
                    role="separator"
                    aria-orientation="vertical"
                    aria-label={`Resize column ${columnLabels[col - 1] || colToLetter(col)}`}
                    onMouseDown={(e) => handleResizeMouseDown(e, col)}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                  />
                </th>
              ))}
              {rightSpacerWidth > 0 && (
                <th style={{ width: rightSpacerWidth }} />
              )}
            </tr>
          </thead>
          <tbody>
            {topSpacerHeight > 0 && (
              <tr className="spacer-row" style={{ height: topSpacerHeight }}>
                <td colSpan={COLS + 1} />
              </tr>
            )}

            {visibleRows.map((row) => (
              <tr key={row}>
                <td className="row-header">{row}</td>
                {leftSpacerWidth > 0 && (
                  <td style={{ width: leftSpacerWidth }} />
                )}
                {visibleColumns.map((col) => {
                  // Compute cell data on-demand to avoid storing massive Maps in memory
                  const cellData = getCellDisplayData(row, col);
                  const cellState = getCellStateData(row, col);

                  return (
                    <GridCell
                      key={col}
                      row={row}
                      col={col}
                      displayValue={cellData.displayValue}
                      colWidth={colWidths[col - 1]}
                      cellFormat={cellData.format}
                      isSelected={cellState.isSelected}
                      isEditing={cellState.isEditing}
                      isParameter={cellData.isParameter}
                      isInFillRange={cellState.isInFillRange}
                      isInSelectionRange={cellState.isInSelectionRange}
                      onClick={handleCellClick}
                      onDoubleClick={handleCellDoubleClick}
                      onMouseDown={handleCellMouseDown}
                      onMouseEnter={handleCellMouseEnter}
                      onFillHandleMouseDown={handleFillHandleMouseDown}
                    />
                  );
                })}
                {rightSpacerWidth > 0 && (
                  <td style={{ width: rightSpacerWidth }} />
                )}
              </tr>
            ))}

            {bottomSpacerHeight > 0 && (
              <tr className="spacer-row" style={{ height: bottomSpacerHeight }}>
                <td colSpan={COLS + 1} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
