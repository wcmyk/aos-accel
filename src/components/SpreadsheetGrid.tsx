/**
 * Spreadsheet Grid
 *
 * Rendering is split in two layers so interaction stays cheap:
 *
 *  - The cell layer (<GridRow>, memoized per row) depends only on cell data,
 *    the visible window and column widths. Selecting, dragging, and typing
 *    never re-render it.
 *  - The overlay layer (active-cell box, range highlight, fill handle, fill
 *    preview, in-cell editor) is a handful of absolutely positioned elements
 *    computed from fixed grid geometry. Moving the selection only moves these.
 *
 * Pointer drags (range selection and the fill handle) are tracked on the
 * document and mapped from coordinates to cells, so they keep working outside
 * the grid and auto-scroll near its edges.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { flushSync } from 'react-dom';
import { useAccelStore } from '../store/accel-store';
import type { AccelEngine } from '../engine/engine';
import { CellValue, CellFormat } from '../engine/types';
import './SpreadsheetGrid.css';

const ROWS = 1000;
const COLS = 52; // A-AZ
// Grid geometry. CSS in google-theme.css pins cells to exactly these sizes;
// the overlay and pointer hit-testing rely on them matching.
const ROW_HEIGHT = 21;
const HEADER_HEIGHT = 24;
const ROW_HEADER_WIDTH = 46;
const COL_WIDTH = 100;
const MIN_COL_WIDTH = 32;
const OVERSCAN_ROWS = 8;
const OVERSCAN_COLS = 3;
const DEFAULT_VIEWPORT_HEIGHT = 600;
const DEFAULT_VIEWPORT_WIDTH = 1200;
const AUTOSCROLL_EDGE = 24; // px from the viewport edge where drag auto-scroll kicks in

type CellPos = { row: number; col: number };
type Rect = { left: number; top: number; width: number; height: number };

// Grid lines sit on each cell's right/bottom edge, so a box drawn around a
// block must start 1px up/left to cover the neighbouring line too.
function outset(r: Rect): Rect {
  return { left: r.left - 1, top: r.top - 1, width: r.width + 1, height: r.height + 1 };
}

function boxStyle(r: Rect): React.CSSProperties {
  return { transform: `translate(${r.left}px, ${r.top}px)`, width: r.width, height: r.height };
}

// Recognized formula error markers. A cell whose evaluation failed stores its
// value as a string starting with one of these tokens; we render a compact
// badge (never a raw exception) with the full text as a tooltip.
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

// Whether a cell reference is grammatically valid at the caret — the nearest
// non-space character before it is an operator, '(', ',', ':' or the leading
// '='. This distinguishes "point mode" (clicking a cell inserts its reference
// while building a formula) from a click meant to leave the formula.
function formulaExpectsReference(text: string, caret: number): boolean {
  if (!text.startsWith('=')) return false;
  let i = Math.min(caret, text.length) - 1;
  while (i >= 0 && text[i] === ' ') i--;
  if (i < 0) return false;
  return '=+-*/^(,:<>&%'.includes(text[i]);
}

function colToLetter(col: number): string {
  let letter = '';
  let c = col;
  while (c > 0) {
    const remainder = (c - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    c = Math.floor((c - 1) / 26);
  }
  return letter;
}
const COLUMN_LABELS = Array.from({ length: COLS }, (_, i) => colToLetter(i + 1));

function formatCellValue(value: CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (Number.isInteger(value) && Math.abs(value) < 1e15) return String(value);
    if (!Number.isFinite(value)) return String(value);
    if (Math.abs(value) >= 1e15 || (Math.abs(value) < 1e-9 && value !== 0)) return value.toExponential(4);
    return value.toFixed(10).replace(/\.?0+$/, '');
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (Array.isArray(value)) return '';
  return String(value);
}

// Last column whose left edge is at or before x (1-based). 52 columns, so a
// linear scan beats anything cleverer.
function colAtX(colLeft: number[], x: number): number {
  let col = 1;
  for (let c = 1; c <= COLS; c++) {
    if (colLeft[c] <= x) col = c;
    else break;
  }
  return col;
}

function normRange(a: CellPos, b: CellPos) {
  return {
    r1: Math.min(a.row, b.row),
    r2: Math.max(a.row, b.row),
    c1: Math.min(a.col, b.col),
    c2: Math.max(a.col, b.col),
  };
}

let measureCtx: CanvasRenderingContext2D | null = null;
function measureText(text: string): number {
  if (!measureCtx) {
    measureCtx = document.createElement('canvas').getContext('2d');
    if (measureCtx) measureCtx.font = '13px Roboto, Arial, sans-serif';
  }
  return measureCtx ? measureCtx.measureText(text).width : text.length * 7;
}

// ---------------------------------------------------------------------------
// Cell layer
// ---------------------------------------------------------------------------

interface GridRowProps {
  row: number;
  startCol: number;
  endCol: number;
  hasLeftSpacer: boolean;
  hasRightSpacer: boolean;
  engine: AccelEngine;
  /** Changes whenever cell data may have changed; forces a repaint. */
  version: string;
  headerActive: boolean;
}

const GridRow = React.memo(function GridRow({
  row,
  startCol,
  endCol,
  hasLeftSpacer,
  hasRightSpacer,
  engine,
  headerActive,
}: GridRowProps) {
  const cells: React.ReactNode[] = [];
  for (let col = startCol; col <= endCol; col++) {
    const cell = engine.getCellObject(row, col);
    const value = cell ? engine.getCell(row, col) : null;
    const format: CellFormat | undefined = cell?.format;
    const text = formatCellValue(value);
    const error = typeof value === 'string' ? getErrorInfo(value) : null;

    let className = 'cell';
    if (cell?.isParameter) className += ' parameter';
    if (error) className += ' cell--error';
    else if (typeof value === 'number') className += ' cell--num';
    else if (typeof value === 'boolean') className += ' cell--bool';

    let style: React.CSSProperties | undefined;
    if (format && (format.bold || format.italic || format.underline || format.fontColor || format.backgroundColor)) {
      style = {
        fontWeight: format.bold ? 700 : undefined,
        fontStyle: format.italic ? 'italic' : undefined,
        textDecoration: format.underline ? 'underline' : undefined,
        color: format.fontColor || undefined,
        backgroundColor: format.backgroundColor || undefined,
      };
    }

    cells.push(
      <td key={col} data-row={row} data-col={col} role="gridcell" className={className} style={style}>
        {text !== '' && (
          <div className="cell-content" title={error ? error.title : undefined}>
            {error ? error.label : text}
          </div>
        )}
      </td>
    );
  }

  return (
    <tr>
      <td className={`row-header${headerActive ? ' header--active' : ''}`} data-row-header={row}>
        {row}
      </td>
      {hasLeftSpacer && <td className="spacer-cell" />}
      {cells}
      {hasRightSpacer && <td className="spacer-cell" />}
    </tr>
  );
});

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

const FORMULA_SIGNATURES: Record<string, string[]> = {
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
};

type FormulaHint = { func: string; params: string[]; currentParam: number };

function computeFormulaHint(formula: string, caretPos: number): FormulaHint | null {
  if (!formula.startsWith('=')) return null;
  const beforeCaret = formula.substring(0, caretPos);
  const funcMatch = beforeCaret.match(/([A-Za-z_]+)\(([^)]*)$/);
  if (!funcMatch) return null;
  const funcName = funcMatch[1].toUpperCase();
  const params = FORMULA_SIGNATURES[funcName];
  if (!params) return null;
  const argsText = funcMatch[2];
  let currentParam = 0;
  let inQuotes = false;
  let depth = 0;
  for (let i = 0; i < argsText.length; i++) {
    const ch = argsText[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ',' && depth === 0) currentParam++;
    }
  }
  return { func: funcName, params, currentParam };
}

export const SpreadsheetGrid: React.FC = () => {
  const selectedCell = useAccelStore((s) => s.selectedCell);
  const fillRange = useAccelStore((s) => s.fillRange);
  const selectionRange = useAccelStore((s) => s.selectionRange);
  const isSelecting = useAccelStore((s) => s.isSelecting);
  const isReadOnly = useAccelStore((s) => s.isReadOnly);
  const engine = useAccelStore((s) => s.engine);
  const docVersion = useAccelStore((s) => s.docVersion);
  const activeSheet = useAccelStore((s) => s.activeSheet);

  const setCell = useAccelStore((s) => s.setCell);
  const getCell = useAccelStore((s) => s.getCell);
  const getCellObject = useAccelStore((s) => s.getCellObject);
  const selectCell = useAccelStore((s) => s.selectCell);
  const clearDirty = useAccelStore((s) => s.clearDirty);
  const startSelection = useAccelStore((s) => s.startSelection);
  const updateSelection = useAccelStore((s) => s.updateSelection);
  const endSelection = useAccelStore((s) => s.endSelection);
  const clearSelection = useAccelStore((s) => s.clearSelection);
  const copyCell = useAccelStore((s) => s.copyCell);
  const pasteCell = useAccelStore((s) => s.pasteCell);
  const cutCell = useAccelStore((s) => s.cutCell);
  const clearRange = useAccelStore((s) => s.clearRange);
  const setFillRange = useAccelStore((s) => s.setFillRange);
  const clearFillRange = useAccelStore((s) => s.clearFillRange);
  const executeFill = useAccelStore((s) => s.executeFill);
  const undo = useAccelStore((s) => s.undo);
  const redo = useAccelStore((s) => s.redo);

  const [editingCell, setEditingCell] = useState<CellPos | null>(null);
  const [editValue, setEditValue] = useState('');
  const [formulaHint, setFormulaHint] = useState<FormulaHint | null>(null);
  const [hintAnchor, setHintAnchor] = useState<'bar' | 'cell'>('cell');
  const [virtualWindow, setVirtualWindow] = useState({ startRow: 1, startCol: 1 });
  const [viewportHeight, setViewportHeight] = useState(DEFAULT_VIEWPORT_HEIGHT);
  const [viewportWidth, setViewportWidth] = useState(DEFAULT_VIEWPORT_WIDTH);
  const [colWidths, setColWidths] = useState<number[]>(() => new Array(COLS).fill(COL_WIDTH));
  const [resizingCol, setResizingCol] = useState<number | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const barInputRef = useRef<HTMLInputElement>(null);
  const cellInputRef = useRef<HTMLInputElement>(null);
  // Whichever editor (formula bar or in-cell) last had focus; reference
  // insertion and caret restore target it.
  const activeEditorRef = useRef<HTMLInputElement | null>(null);
  // 'enter': editing began by typing over the cell, so arrow keys commit and
  // move (like Sheets). 'edit': F2 / double-click / formula bar, arrows move
  // the caret.
  const editModeRef = useRef<'enter' | 'edit'>('edit');
  const originalValueRef = useRef('');
  const colResizeRef = useRef<{ col: number; startX: number; startWidth: number } | null>(null);
  const scrollRaf = useRef<number | null>(null);
  const caretPositionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const lastInsertedRef = useRef<{ start: number; end: number } | null>(null);
  const lastPointedKeyRef = useRef<string | null>(null);
  const dragRef = useRef<{
    mode: 'select' | 'fill';
    clientX: number;
    clientY: number;
    last: CellPos | null;
    raf: number | null;
  } | null>(null);

  // Cumulative left offsets: colLeft[c] = x of column c (1-based), [COLS+1] = total.
  const colLeft = useMemo(() => {
    const arr = new Array<number>(COLS + 2);
    arr[1] = 0;
    for (let c = 1; c <= COLS; c++) arr[c + 1] = arr[c] + colWidths[c - 1];
    return arr;
  }, [colWidths]);
  const colLeftRef = useRef(colLeft);
  colLeftRef.current = colLeft;

  const computeWindow = useCallback((scrollTop: number, scrollLeft: number) => ({
    startRow: Math.max(1, Math.floor(scrollTop / ROW_HEIGHT) + 1 - OVERSCAN_ROWS),
    startCol: Math.max(1, colAtX(colLeftRef.current, scrollLeft) - OVERSCAN_COLS),
  }), []);

  useEffect(() => {
    gridRef.current?.focus({ preventScroll: true });
  }, []);

  useLayoutEffect(() => {
    const wrapper = gridWrapperRef.current;
    if (!wrapper) return;
    const measure = () => {
      setViewportHeight(wrapper.clientHeight || DEFAULT_VIEWPORT_HEIGHT);
      setViewportWidth(wrapper.clientWidth || DEFAULT_VIEWPORT_WIDTH);
      const next = computeWindow(wrapper.scrollTop, wrapper.scrollLeft);
      setVirtualWindow((prev) => (prev.startRow === next.startRow && prev.startCol === next.startCol ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [computeWindow]);

  const handleGridScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (scrollRaf.current !== null) return;
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = null;
      const next = computeWindow(target.scrollTop, target.scrollLeft);
      setVirtualWindow((prev) => (prev.startRow === next.startRow && prev.startCol === next.startCol ? prev : next));
    });
  }, [computeWindow]);

  useEffect(() => () => {
    if (scrollRaf.current !== null) cancelAnimationFrame(scrollRaf.current);
    if (dragRef.current?.raf != null) cancelAnimationFrame(dragRef.current.raf);
  }, []);

  // Dirty sets are no longer read by the grid (docVersion drives repaints);
  // clear them so they don't grow without bound.
  useEffect(() => {
    clearDirty();
  }, [docVersion, clearDirty]);

  // ----- geometry ---------------------------------------------------------

  const rectOf = useCallback((r1: number, c1: number, r2: number, c2: number): Rect => ({
    left: ROW_HEADER_WIDTH + colLeft[c1],
    top: HEADER_HEIGHT + (r1 - 1) * ROW_HEIGHT,
    width: colLeft[c2 + 1] - colLeft[c1],
    height: (r2 - r1 + 1) * ROW_HEIGHT,
  }), [colLeft]);

  /** Map viewport coordinates to the nearest cell (clamped to the sheet). */
  const cellAtPoint = useCallback((clientX: number, clientY: number): CellPos | null => {
    const wrapper = gridWrapperRef.current;
    if (!wrapper) return null;
    const box = wrapper.getBoundingClientRect();
    const x = clientX - box.left + wrapper.scrollLeft - ROW_HEADER_WIDTH;
    const y = clientY - box.top + wrapper.scrollTop - HEADER_HEIGHT;
    const row = Math.min(ROWS, Math.max(1, Math.floor(y / ROW_HEIGHT) + 1));
    const col = Math.min(COLS, Math.max(1, colAtX(colLeftRef.current, Math.max(0, x))));
    return { row, col };
  }, []);

  /** Scroll the minimum amount so a cell is fully visible below/right of the sticky headers. */
  const scrollCellIntoView = useCallback((row: number, col: number) => {
    const wrapper = gridWrapperRef.current;
    if (!wrapper) return;
    const left = colLeftRef.current[col];
    const right = colLeftRef.current[col + 1];
    const top = (row - 1) * ROW_HEIGHT;
    const bottom = row * ROW_HEIGHT;
    const viewW = wrapper.clientWidth - ROW_HEADER_WIDTH;
    const viewH = wrapper.clientHeight - HEADER_HEIGHT;
    if (top < wrapper.scrollTop) wrapper.scrollTop = top;
    else if (bottom > wrapper.scrollTop + viewH) wrapper.scrollTop = bottom - viewH;
    if (left < wrapper.scrollLeft) wrapper.scrollLeft = left;
    else if (right > wrapper.scrollLeft + viewW) wrapper.scrollLeft = right - viewW;
  }, []);

  // ----- editing ----------------------------------------------------------

  const startEditing = useCallback((
    row: number,
    col: number,
    initialValue: string | null,
    opts: { mode: 'enter' | 'edit'; focus: 'cell' | 'bar' | 'none' } = { mode: 'edit', focus: 'cell' },
  ) => {
    if (isReadOnly) return;
    // Editing targets the active cell; drop any range so the selection-change
    // effect below doesn't read the range end as "user clicked elsewhere".
    if (useAccelStore.getState().selectionRange) clearSelection();
    const cellObj = getCellObject(row, col);
    const existing = cellObj?.formula ?? (cellObj?.value != null ? formatCellValue(cellObj.value as CellValue) : '');
    const value = initialValue ?? existing;
    originalValueRef.current = existing;
    editModeRef.current = opts.mode;
    lastInsertedRef.current = null;
    lastPointedKeyRef.current = null;
    // Commit the editor to the DOM synchronously so the very next keystroke
    // lands in it — deferring focus dropped fast-typed characters.
    flushSync(() => {
      setEditingCell({ row, col });
      setEditValue(value);
      setFormulaHint(computeFormulaHint(value, value.length));
      setHintAnchor(opts.focus === 'bar' ? 'bar' : 'cell');
    });
    const target = opts.focus === 'cell' ? cellInputRef.current : opts.focus === 'bar' ? barInputRef.current : null;
    if (target) {
      activeEditorRef.current = target;
      target.focus({ preventScroll: true });
      const pos = value.length;
      target.setSelectionRange(pos, pos);
      caretPositionRef.current = { start: pos, end: pos };
    }
  }, [getCellObject, isReadOnly, clearSelection]);

  const stopEditing = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
    setFormulaHint(null);
    lastInsertedRef.current = null;
    lastPointedKeyRef.current = null;
    activeEditorRef.current = null;
  }, []);

  const commitEdit = useCallback(() => {
    if (!editingCell) return;
    if (editValue !== originalValueRef.current) {
      setCell(editingCell.row, editingCell.col, editValue);
    }
    stopEditing();
    gridRef.current?.focus({ preventScroll: true });
  }, [editingCell, editValue, setCell, stopEditing]);

  const cancelEdit = useCallback(() => {
    stopEditing();
    gridRef.current?.focus({ preventScroll: true });
  }, [stopEditing]);

  const moveTo = useCallback((row: number, col: number) => {
    const r = Math.min(ROWS, Math.max(1, row));
    const c = Math.min(COLS, Math.max(1, col));
    selectCell(r, c);
    scrollCellIntoView(r, c);
  }, [selectCell, scrollCellIntoView]);

  const handleEditorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const caretPos = e.target.selectionStart ?? value.length;
    setEditValue(value);
    caretPositionRef.current = { start: caretPos, end: e.target.selectionEnd ?? caretPos };
    lastInsertedRef.current = null;
    lastPointedKeyRef.current = null;
    setFormulaHint(computeFormulaHint(value, caretPos));
  }, []);

  const handleEditorSelect = useCallback((e: React.SyntheticEvent<HTMLInputElement>) => {
    caretPositionRef.current = {
      start: e.currentTarget.selectionStart ?? 0,
      end: e.currentTarget.selectionEnd ?? 0,
    };
  }, []);

  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!editingCell) return;
    const { row, col } = editingCell;
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
      moveTo(e.shiftKey ? row - 1 : row + 1, col);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit();
      moveTo(row, e.shiftKey ? col - 1 : col + 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    } else if (
      editModeRef.current === 'enter' &&
      e.key.startsWith('Arrow') &&
      !e.shiftKey &&
      !(editValue.startsWith('=') && formulaExpectsReference(editValue, caretPositionRef.current.start))
    ) {
      e.preventDefault();
      commitEdit();
      const dr = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
      const dc = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      moveTo(row + dr, col + dc);
    }
  }, [editingCell, editValue, commitEdit, cancelEdit, moveTo]);

  const applyReferenceToFormula = useCallback((row: number, col: number, replaceExisting: boolean, rangeStart?: CellPos) => {
    if (!editingCell) return;
    const refString = rangeStart && (rangeStart.row !== row || rangeStart.col !== col)
      ? `${colToLetter(rangeStart.col)}${rangeStart.row}:${colToLetter(col)}${row}`
      : `${colToLetter(col)}${row}`;
    const selection = replaceExisting && lastInsertedRef.current ? lastInsertedRef.current : caretPositionRef.current;
    const start = Math.max(0, selection.start ?? 0);
    const end = Math.max(start, selection.end ?? start);

    setEditValue((prev) => {
      const nextValue = prev.slice(0, start) + refString + prev.slice(end);
      const caretPos = start + refString.length;
      caretPositionRef.current = { start: caretPos, end: caretPos };
      lastInsertedRef.current = { start, end: caretPos };
      requestAnimationFrame(() => {
        const el = activeEditorRef.current ?? cellInputRef.current;
        if (el) {
          el.focus({ preventScroll: true });
          el.setSelectionRange(caretPos, caretPos);
        }
      });
      return nextValue;
    });
  }, [editingCell]);

  // Selection changes while editing: either point mode (insert a reference)
  // or "leave the cell" (commit).
  useEffect(() => {
    if (!editingCell || !selectedCell) return;
    const targetRow = selectionRange ? selectionRange.end.row : selectedCell.row;
    const targetCol = selectionRange ? selectionRange.end.col : selectedCell.col;
    if (targetRow === editingCell.row && targetCol === editingCell.col && !lastInsertedRef.current) return;
    if (!isSelecting && !selectionRange && !lastInsertedRef.current) return;

    const inPointMode = lastInsertedRef.current !== null;
    if (!editValue.startsWith('=') || (!inPointMode && !formulaExpectsReference(editValue, caretPositionRef.current.start))) {
      commitEdit();
      return;
    }

    const rangeStart = selectionRange ? selectionRange.start : undefined;
    const pointKey = `${rangeStart ? `${rangeStart.col},${rangeStart.row}:` : ''}${targetCol},${targetRow}`;
    if (lastPointedKeyRef.current === pointKey) return;
    lastPointedKeyRef.current = pointKey;
    applyReferenceToFormula(targetRow, targetCol, inPointMode || Boolean(selectionRange), rangeStart);
  }, [applyReferenceToFormula, editingCell, selectedCell, selectionRange, isSelecting, editValue, commitEdit]);

  // ----- pointer: selection + fill drags ----------------------------------

  const applyDragTarget = useCallback((cell: CellPos) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.last && drag.last.row === cell.row && drag.last.col === cell.col) return;
    drag.last = cell;
    if (drag.mode === 'select') {
      updateSelection(cell.row, cell.col);
      return;
    }
    // Fill: extend along whichever axis the pointer has moved further on,
    // measured from the source block (the selection, or the active cell).
    const state = useAccelStore.getState();
    const anchor = state.selectedCell;
    if (!anchor) return;
    const src = state.selectionRange ? normRange(state.selectionRange.start, state.selectionRange.end) : { r1: anchor.row, r2: anchor.row, c1: anchor.col, c2: anchor.col };
    const dRow = cell.row > src.r2 ? cell.row - src.r2 : cell.row < src.r1 ? cell.row - src.r1 : 0;
    const dCol = cell.col > src.c2 ? cell.col - src.c2 : cell.col < src.c1 ? cell.col - src.c1 : 0;
    if (dRow === 0 && dCol === 0) {
      if (state.fillRange) clearFillRange();
      return;
    }
    if (Math.abs(dRow) >= Math.abs(dCol)) setFillRange(cell.row, anchor.col);
    else setFillRange(anchor.row, cell.col);
  }, [updateSelection, setFillRange, clearFillRange]);

  // One rAF loop per drag: hit-test the latest pointer position and auto-scroll
  // when the pointer is near or past the viewport edge.
  const dragTick = useCallback(() => {
    const drag = dragRef.current;
    const wrapper = gridWrapperRef.current;
    if (!drag || !wrapper) return;
    drag.raf = null;
    const box = wrapper.getBoundingClientRect();
    const top = box.top + HEADER_HEIGHT;
    const left = box.left + ROW_HEADER_WIDTH;
    let dy = 0;
    let dx = 0;
    if (drag.clientY < top + AUTOSCROLL_EDGE) dy = drag.clientY - (top + AUTOSCROLL_EDGE);
    else if (drag.clientY > box.bottom - AUTOSCROLL_EDGE) dy = drag.clientY - (box.bottom - AUTOSCROLL_EDGE);
    if (drag.clientX < left + AUTOSCROLL_EDGE) dx = drag.clientX - (left + AUTOSCROLL_EDGE);
    else if (drag.clientX > box.right - AUTOSCROLL_EDGE) dx = drag.clientX - (box.right - AUTOSCROLL_EDGE);
    const scrolling = dx !== 0 || dy !== 0;
    if (scrolling) {
      wrapper.scrollTop += Math.max(-40, Math.min(40, dy / 2));
      wrapper.scrollLeft += Math.max(-40, Math.min(40, dx / 2));
    }
    const cell = cellAtPoint(drag.clientX, drag.clientY);
    if (cell) applyDragTarget(cell);
    if (scrolling) drag.raf = requestAnimationFrame(dragTick);
  }, [cellAtPoint, applyDragTarget]);

  const handleDocMouseMove = useCallback((ev: MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    drag.clientX = ev.clientX;
    drag.clientY = ev.clientY;
    if (drag.raf === null) drag.raf = requestAnimationFrame(dragTick);
  }, [dragTick]);

  const handleDocMouseUp = useCallback(() => {
    const drag = dragRef.current;
    document.removeEventListener('mousemove', handleDocMouseMove);
    document.removeEventListener('mouseup', handleDocMouseUp);
    if (!drag) return;
    if (drag.raf !== null) cancelAnimationFrame(drag.raf);
    // Apply the final pointer position synchronously so a fast release still lands.
    const cell = cellAtPoint(drag.clientX, drag.clientY);
    if (cell) applyDragTarget(cell);
    dragRef.current = null;
    if (drag.mode === 'select') {
      endSelection();
    } else if (useAccelStore.getState().fillRange) {
      executeFill();
      clearFillRange();
    }
  }, [handleDocMouseMove, cellAtPoint, applyDragTarget, endSelection, executeFill, clearFillRange]);

  const beginDrag = useCallback((mode: 'select' | 'fill', ev: React.MouseEvent) => {
    dragRef.current = { mode, clientX: ev.clientX, clientY: ev.clientY, last: null, raf: null };
    document.addEventListener('mousemove', handleDocMouseMove);
    document.addEventListener('mouseup', handleDocMouseUp);
  }, [handleDocMouseMove, handleDocMouseUp]);

  useEffect(() => () => {
    document.removeEventListener('mousemove', handleDocMouseMove);
    document.removeEventListener('mouseup', handleDocMouseUp);
  }, [handleDocMouseMove, handleDocMouseUp]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.col-resize-handle') || target.closest('.cell-editor')) return;

    if (target.closest('.fill-handle')) {
      e.preventDefault();
      e.stopPropagation();
      if (editingCell) commitEdit();
      beginDrag('fill', e);
      return;
    }

    // Header clicks select a whole column or row.
    const colHeader = target.closest('th[data-col-header]') as HTMLElement | null;
    const rowHeader = target.closest('td[data-row-header]') as HTMLElement | null;
    if (colHeader || rowHeader) {
      e.preventDefault();
      if (editingCell) commitEdit();
      if (colHeader) {
        const col = Number(colHeader.dataset.colHeader);
        startSelection(1, col);
        updateSelection(ROWS, col);
      } else if (rowHeader) {
        const row = Number(rowHeader.dataset.rowHeader);
        startSelection(row, 1);
        updateSelection(row, COLS);
      }
      endSelection();
      gridRef.current?.focus({ preventScroll: true });
      return;
    }

    const td = target.closest('td[data-row]') as HTMLElement | null;
    if (!td) return;
    const row = Number(td.dataset.row);
    const col = Number(td.dataset.col);
    if (!row || !col) return;

    // Keep focus in the editor while pointing at references; otherwise the
    // grid takes focus for keyboard navigation.
    e.preventDefault();
    const pointing = editingCell && editValue.startsWith('=');
    if (!pointing) gridRef.current?.focus({ preventScroll: true });

    const state = useAccelStore.getState();
    if (e.shiftKey && state.selectedCell) {
      const anchor = state.selectedCell;
      startSelection(anchor.row, anchor.col);
      updateSelection(row, col);
    } else {
      startSelection(row, col);
    }
    beginDrag('select', e);
  }, [editingCell, editValue, commitEdit, beginDrag, startSelection, updateSelection, endSelection]);

  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const td = (e.target as HTMLElement).closest('td[data-row]') as HTMLElement | null;
    if (!td) return;
    const row = Number(td.dataset.row);
    const col = Number(td.dataset.col);
    if (!row || !col || (editingCell && editingCell.row === row && editingCell.col === col)) return;
    selectCell(row, col);
    startEditing(row, col, null, { mode: 'edit', focus: 'cell' });
  }, [editingCell, selectCell, startEditing]);

  // ----- keyboard ---------------------------------------------------------

  const extendSelection = useCallback((dr: number, dc: number) => {
    const state = useAccelStore.getState();
    const anchor = state.selectedCell;
    if (!anchor) return;
    const end = state.selectionRange ? state.selectionRange.end : anchor;
    const nr = Math.min(ROWS, Math.max(1, end.row + dr));
    const nc = Math.min(COLS, Math.max(1, end.col + dc));
    startSelection(anchor.row, anchor.col);
    updateSelection(nr, nc);
    endSelection();
    scrollCellIntoView(nr, nc);
  }, [startSelection, updateSelection, endSelection, scrollCellIntoView]);

  const handleGridKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (editingCell) return; // the editor input owns keys while editing
    const mod = e.ctrlKey || e.metaKey;

    if (e.key === 'Escape') {
      e.preventDefault();
      clearSelection();
      return;
    }
    if (mod && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if (mod && (e.key === 'y' || e.key === 'Y')) {
      e.preventDefault();
      redo();
      return;
    }
    if (mod && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      startSelection(1, 1);
      updateSelection(ROWS, COLS);
      endSelection();
      return;
    }

    if (!selectedCell) return;
    const { row, col } = selectedCell;

    if (mod && e.key === 'c') { e.preventDefault(); copyCell(row, col); return; }
    if (mod && e.key === 'v') { e.preventDefault(); pasteCell(row, col); return; }
    if (mod && e.key === 'x') { e.preventDefault(); cutCell(row, col); return; }

    if (mod && e.key.startsWith('Arrow')) {
      // Jump to the edge of the data region.
      e.preventDefault();
      const dr = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
      const dc = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      const isEmpty = (r: number, c: number) => {
        const v = getCell(r, c);
        return v === null || v === undefined || v === '';
      };
      const inBounds = (r: number, c: number) => r >= 1 && r <= ROWS && c >= 1 && c <= COLS;
      let r = row;
      let c = col;
      if (inBounds(r + dr, c + dc) && !isEmpty(r + dr, c + dc)) {
        while (inBounds(r + dr, c + dc) && !isEmpty(r + dr, c + dc)) { r += dr; c += dc; }
      } else {
        while (inBounds(r + dr, c + dc) && isEmpty(r + dr, c + dc)) { r += dr; c += dc; }
        if (inBounds(r + dr, c + dc)) { r += dr; c += dc; }
      }
      moveTo(r, c);
      return;
    }
    if (mod && e.key === 'Home') { e.preventDefault(); moveTo(1, 1); return; }

    if (e.shiftKey && e.key.startsWith('Arrow')) {
      e.preventDefault();
      const dr = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
      const dc = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      extendSelection(dr, dc);
      return;
    }

    switch (e.key) {
      case 'ArrowUp': e.preventDefault(); moveTo(row - 1, col); return;
      case 'ArrowDown': e.preventDefault(); moveTo(row + 1, col); return;
      case 'ArrowLeft': e.preventDefault(); moveTo(row, col - 1); return;
      case 'ArrowRight': e.preventDefault(); moveTo(row, col + 1); return;
      case 'PageDown': e.preventDefault(); moveTo(row + 20, col); return;
      case 'PageUp': e.preventDefault(); moveTo(row - 20, col); return;
      case 'Home': e.preventDefault(); moveTo(row, 1); return;
      case 'Enter': e.preventDefault(); moveTo(e.shiftKey ? row - 1 : row + 1, col); return;
      case 'Tab': e.preventDefault(); moveTo(row, e.shiftKey ? col - 1 : col + 1); return;
      case 'F2': e.preventDefault(); startEditing(row, col, null, { mode: 'edit', focus: 'cell' }); return;
      case 'Delete':
      case 'Backspace': {
        e.preventDefault();
        const range = useAccelStore.getState().selectionRange;
        if (range) {
          const { r1, r2, c1, c2 } = normRange(range.start, range.end);
          clearRange(r1, c1, r2, c2);
        } else {
          clearRange(row, col, row, col);
        }
        return;
      }
      default:
        break;
    }

    if (e.key.length === 1 && !mod && !e.altKey) {
      e.preventDefault();
      startEditing(row, col, e.key, { mode: 'enter', focus: 'cell' });
    }
  }, [editingCell, selectedCell, clearSelection, undo, redo, startSelection, updateSelection, endSelection, copyCell, pasteCell, cutCell, getCell, moveTo, extendSelection, startEditing, clearRange]);

  // ----- column resize ----------------------------------------------------

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

  // ----- virtual window ---------------------------------------------------

  const totalGridWidth = colLeft[COLS + 1];
  const visibleRowCount = Math.ceil((viewportHeight || DEFAULT_VIEWPORT_HEIGHT) / ROW_HEIGHT);
  const startRow = Math.max(1, Math.min(ROWS, virtualWindow.startRow));
  const endRow = Math.min(ROWS, startRow + visibleRowCount + OVERSCAN_ROWS * 2);
  const topSpacerHeight = (startRow - 1) * ROW_HEIGHT;
  const bottomSpacerHeight = Math.max((ROWS - endRow) * ROW_HEIGHT, 0);

  const startCol = Math.max(1, Math.min(COLS, virtualWindow.startCol));
  const firstVisibleCol = Math.min(COLS, startCol + OVERSCAN_COLS);
  const rightBound = colLeft[firstVisibleCol] + (viewportWidth || DEFAULT_VIEWPORT_WIDTH);
  let coverCol = firstVisibleCol;
  while (coverCol < COLS && colLeft[coverCol + 1] < rightBound) coverCol++;
  const endCol = Math.min(COLS, coverCol + OVERSCAN_COLS);
  const leftSpacerWidth = colLeft[startCol];
  const rightSpacerWidth = Math.max(totalGridWidth - colLeft[endCol + 1], 0);

  const visibleColumns = useMemo(
    () => Array.from({ length: endCol - startCol + 1 }, (_, i) => startCol + i),
    [startCol, endCol]
  );

  const version = `${docVersion}|${activeSheet}`;

  // ----- selection-derived overlay state ------------------------------------

  const range = selectionRange ? normRange(selectionRange.start, selectionRange.end) : null;
  const hl = range ?? (selectedCell ? { r1: selectedCell.row, r2: selectedCell.row, c1: selectedCell.col, c2: selectedCell.col } : null);
  const isMultiRange = range !== null && (range.r1 !== range.r2 || range.c1 !== range.c2);

  const activeRect = selectedCell ? rectOf(selectedCell.row, selectedCell.col, selectedCell.row, selectedCell.col) : null;
  const rangeRect = isMultiRange && range ? rectOf(range.r1, range.c1, range.r2, range.c2) : null;
  const sourceBlock = isMultiRange && range ? range : hl;
  const handleRect = sourceBlock ? rectOf(sourceBlock.r2, sourceBlock.c2, sourceBlock.r2, sourceBlock.c2) : null;

  let fillRect: Rect | null = null;
  if (fillRange && sourceBlock) {
    fillRect = rectOf(
      Math.min(sourceBlock.r1, fillRange.row),
      Math.min(sourceBlock.c1, fillRange.col),
      Math.max(sourceBlock.r2, fillRange.row),
      Math.max(sourceBlock.c2, fillRange.col),
    );
  }

  let editorRect: Rect | null = null;
  if (editingCell) {
    const base = rectOf(editingCell.row, editingCell.col, editingCell.row, editingCell.col);
    const maxWidth = totalGridWidth + ROW_HEADER_WIDTH - base.left;
    editorRect = { ...base, width: Math.min(maxWidth, Math.max(base.width, measureText(editValue) + 16)) };
  }

  const cellReference = range && isMultiRange
    ? `${colToLetter(range.c1)}${range.r1}:${colToLetter(range.c2)}${range.r2}`
    : selectedCell ? `${colToLetter(selectedCell.col)}${selectedCell.row}` : '';

  const selectedCellData = useMemo(() => {
    if (!selectedCell) return null;
    const cellObj = getCellObject(selectedCell.row, selectedCell.col);
    return cellObj?.formula ?? (cellObj?.value != null ? formatCellValue(cellObj.value as CellValue) : '');
    // docVersion: the cell object is mutated in place by the engine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCell, getCellObject, docVersion]);

  const formulaBarValue = editingCell ? editValue : selectedCellData ?? '';

  const hintNode = formulaHint && (
    <div className={`formula-hint${hintAnchor === 'cell' ? ' formula-hint--cell' : ''}`}>
      <strong>{formulaHint.func}(</strong>
      {formulaHint.params.map((param, idx) => (
        <span key={idx} className={idx === formulaHint.currentParam ? 'current-param' : ''}>
          {idx > 0 && ', '}
          {param}
        </span>
      ))}
      <strong>)</strong>
    </div>
  );

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
        <div className="cell-reference" aria-label="Selected range">{cellReference}</div>
        <span className="formula-bar__fx" aria-hidden="true">fx</span>
        <input
          ref={barInputRef}
          type="text"
          className="formula-input"
          aria-label="Formula bar"
          value={formulaBarValue}
          readOnly={isReadOnly}
          onChange={handleEditorChange}
          onSelect={handleEditorSelect}
          onKeyDown={handleEditorKeyDown}
          onFocus={(e) => {
            activeEditorRef.current = e.currentTarget;
            setHintAnchor('bar');
            if (selectedCell && !editingCell) {
              startEditing(selectedCell.row, selectedCell.col, null, { mode: 'edit', focus: 'none' });
            }
          }}
        />
        {hintAnchor === 'bar' && hintNode}
      </div>

      <div className="grid-wrapper" ref={gridWrapperRef} onScroll={handleGridScroll}>
        <div
          className="grid-canvas"
          style={{ width: ROW_HEADER_WIDTH + totalGridWidth, height: HEADER_HEIGHT + ROWS * ROW_HEIGHT }}
          onMouseDown={handleCanvasMouseDown}
          onDoubleClick={handleCanvasDoubleClick}
        >
          <table className="spreadsheet-grid" style={{ width: ROW_HEADER_WIDTH + totalGridWidth }}>
            <colgroup>
              <col style={{ width: ROW_HEADER_WIDTH }} />
              {leftSpacerWidth > 0 && <col style={{ width: leftSpacerWidth }} />}
              {visibleColumns.map((col) => (
                <col key={col} style={{ width: colWidths[col - 1] }} />
              ))}
              {rightSpacerWidth > 0 && <col style={{ width: rightSpacerWidth }} />}
            </colgroup>
            <thead>
              <tr>
                <th className="corner-header" />
                {leftSpacerWidth > 0 && <th className="spacer-cell" />}
                {visibleColumns.map((col) => (
                  <th
                    key={col}
                    data-col-header={col}
                    className={`col-header${resizingCol === col ? ' resizing' : ''}${hl && col >= hl.c1 && col <= hl.c2 ? ' header--active' : ''}`}
                  >
                    <span className="col-label">{COLUMN_LABELS[col - 1]}</span>
                    <span
                      className="col-resize-handle"
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize column ${COLUMN_LABELS[col - 1]}`}
                      onMouseDown={(e) => handleResizeMouseDown(e, col)}
                    />
                  </th>
                ))}
                {rightSpacerWidth > 0 && <th className="spacer-cell" />}
              </tr>
            </thead>
            <tbody>
              {topSpacerHeight > 0 && (
                <tr className="spacer-row" style={{ height: topSpacerHeight }}>
                  <td colSpan={visibleColumns.length + 3} />
                </tr>
              )}
              {Array.from({ length: endRow - startRow + 1 }, (_, i) => {
                const row = startRow + i;
                return (
                  <GridRow
                    key={row}
                    row={row}
                    startCol={startCol}
                    endCol={endCol}
                    hasLeftSpacer={leftSpacerWidth > 0}
                    hasRightSpacer={rightSpacerWidth > 0}
                    engine={engine}
                    version={version}
                    headerActive={hl !== null && row >= hl.r1 && row <= hl.r2}
                  />
                );
              })}
              {bottomSpacerHeight > 0 && (
                <tr className="spacer-row" style={{ height: bottomSpacerHeight }}>
                  <td colSpan={visibleColumns.length + 3} />
                </tr>
              )}
            </tbody>
          </table>

          {/* Overlay layer */}
          {rangeRect && <div className="sel-range" style={boxStyle(outset(rangeRect))} />}
          {activeRect && !editingCell && <div className="sel-active" style={boxStyle(outset(activeRect))} />}
          {fillRect && <div className="sel-fill-preview" style={boxStyle(outset(fillRect))} />}
          {handleRect && !editingCell && !isReadOnly && !fillRange && (
            <div
              className="fill-handle"
              title="Drag to fill"
              style={{ transform: `translate(${handleRect.left + handleRect.width - 4}px, ${handleRect.top + handleRect.height - 4}px)` }}
            />
          )}
          {editorRect && (
            <div className="cell-editor" style={boxStyle(outset(editorRect))}>
              <input
                ref={cellInputRef}
                className="cell-editor__input"
                aria-label="Cell editor"
                value={editValue}
                spellCheck={false}
                autoComplete="off"
                onChange={handleEditorChange}
                onSelect={handleEditorSelect}
                onKeyDown={handleEditorKeyDown}
                onFocus={(e) => {
                  activeEditorRef.current = e.currentTarget;
                  setHintAnchor('cell');
                }}
              />
              {hintAnchor === 'cell' && hintNode}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
