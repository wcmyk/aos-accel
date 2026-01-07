/**
 * Spreadsheet Grid Component
 * Excel-like grid interface with full keyboard support
 */

import React, { useState, useCallback, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { useAccelStore } from '../store/accel-store';
import { useShallow } from 'zustand/react/shallow';
import { CellValue, CellFormat } from '../engine/types';

const ROWS = 1000;
const COLS = 52; // A-AZ (52 columns)
const ROW_HEIGHT = 24;
const COL_WIDTH = 100; // Width of each column in pixels
const OVERSCAN = 2; // Increased slightly for smoother scrolling without lag
const DEFAULT_VIEWPORT_HEIGHT = 600;
const DEFAULT_VIEWPORT_WIDTH = 1200;

interface GridCellProps {
  row: number;
  col: number;
  displayValue: string;
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

  return (
    <td
      data-row={row}
      data-col={col}
      className={`cell ${isSelected ? 'selected' : ''} ${isParameter ? 'parameter' : ''} ${isInFillRange ? 'fill-range' : ''} ${isInSelectionRange ? 'in-selection' : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={onMouseEnter}
      onMouseDown={onMouseDown}
      style={cellFormat?.backgroundColor ? { backgroundColor: cellFormat.backgroundColor } : undefined}
    >
      {!isEditing && (
        <div className="cell-content" style={cellStyle}>
          {displayValue}
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
  const version = useAccelStore((state) => state.version);

  // Actions - stable references, don't cause re-renders
  const setCell = useAccelStore((state) => state.setCell);
  const getCell = useAccelStore((state) => state.getCell);
  const getCellObject = useAccelStore((state) => state.getCellObject);
  const selectCell = useAccelStore((state) => state.selectCell);
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
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isDraggingFill, setIsDraggingFill] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const pendingFillTarget = useRef<{ row: number; col: number } | null>(null);
  const fillRangeRaf = useRef<number | null>(null);
  const [virtualWindow, setVirtualWindow] = useState({ startRow: 1, startCol: 1 });
  const [viewportHeight, setViewportHeight] = useState(DEFAULT_VIEWPORT_HEIGHT);
  const [viewportWidth, setViewportWidth] = useState(DEFAULT_VIEWPORT_WIDTH);
  const scrollRaf = useRef<number | null>(null);
  const caretPositionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const lastInsertedRef = useRef<{ start: number; end: number } | null>(null);

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
      const nextStartCol = Math.max(1, Math.floor(scrollLeft / COL_WIDTH) + 1 - OVERSCAN);
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

  // Grid keyboard navigation
  const handleGridKeyDown = useCallback((e: React.KeyboardEvent) => {
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
  }, [selectedCell, editingCell, selectCell, copyCell, pasteCell, cutCell, setCell, startEditing]);

  const handleGridScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (scrollRaf.current !== null) {
      cancelAnimationFrame(scrollRaf.current);
    }
    scrollRaf.current = requestAnimationFrame(() => {
      const nextStartRow = Math.max(1, Math.floor(target.scrollTop / ROW_HEIGHT) + 1 - OVERSCAN);
      const nextStartCol = Math.max(1, Math.floor(target.scrollLeft / COL_WIDTH) + 1 - OVERSCAN);
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

  const totalGridHeight = ROWS * ROW_HEIGHT;
  const totalGridWidth = COLS * COL_WIDTH;

  const estimatedVisibleRowCount = viewportHeight > 0
    ? Math.ceil(viewportHeight / ROW_HEIGHT)
    : ROWS;
  const startRow = Math.max(1, Math.min(ROWS, virtualWindow.startRow));
  const endRow = Math.min(ROWS, startRow + estimatedVisibleRowCount + OVERSCAN * 2 - 1);
  const topSpacerHeight = (startRow - 1) * ROW_HEIGHT;
  const bottomSpacerHeight = Math.max(totalGridHeight - endRow * ROW_HEIGHT, 0);

  const estimatedVisibleColCount = viewportWidth > 0
    ? Math.ceil(viewportWidth / COL_WIDTH)
    : COLS;
  const startCol = Math.max(1, Math.min(COLS, virtualWindow.startCol));
  const endCol = Math.min(COLS, startCol + estimatedVisibleColCount + OVERSCAN * 2 - 1);
  const leftSpacerWidth = (startCol - 1) * COL_WIDTH;
  const rightSpacerWidth = Math.max(totalGridWidth - endCol * COL_WIDTH, 0);

  const visibleRows = useMemo(
    () => Array.from({ length: endRow - startRow + 1 }, (_, i) => startRow + i),
    [startRow, endRow]
  );
  const visibleColumns = useMemo(
    () => Array.from({ length: endCol - startCol + 1 }, (_, i) => startCol + i),
    [startCol, endCol]
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

    // Create range reference if rangeStart is provided
    let refString: string;
    if (rangeStart) {
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

    // Pass range start if there's a selection range
    const rangeStart = selectionRange ? selectionRange.start : undefined;
    applyReferenceToFormula(targetRow, targetCol, Boolean(selectionRange) || Boolean(lastInsertedRef.current), rangeStart);
  }, [applyReferenceToFormula, editingCell, selectedCell, selectionRange]);

  // Helper function to get cell state (computed on-demand, not stored)
  // Memoized with version to only update when cells actually change
  const getCellDisplayData = useCallback((row: number, col: number) => {
    const cellObj = getCellObject(row, col);
    const value = getCell(row, col);

    return {
      displayValue: formatCellValue(value),
      isParameter: cellObj?.isParameter || false,
      format: cellObj?.format,
    };
  }, [getCellObject, getCell, formatCellValue, version]);

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
      className="spreadsheet-container"
      ref={gridRef}
      tabIndex={0}
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
          value={formulaBarValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            caretPositionRef.current = {
              start: e.target.selectionStart ?? 0,
              end: e.target.selectionEnd ?? 0,
            };
            lastInsertedRef.current = null;
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
      </div>

      <div
        className="grid-wrapper"
        ref={gridWrapperRef}
        onScroll={handleGridScroll}
      >
        <table className="spreadsheet-grid">
          <thead>
            <tr>
              <th className="row-header"></th>
              {leftSpacerWidth > 0 && (
                <th style={{ width: leftSpacerWidth }} />
              )}
              {visibleColumns.map((col) => (
                <th key={col} className="col-header">
                  {columnLabels[col - 1] || colToLetter(col)}
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
