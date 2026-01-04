/**
 * Spreadsheet Grid Component
 * Excel-like grid interface with full keyboard support
 */

import React, { useState, useCallback, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { useAccelStore } from '../store/accel-store';
import { CellValue, CellFormat } from '../engine/types';

const ROWS = 1000;
const COLS = 52; // A-AZ (52 columns)
const ROW_HEIGHT = 24;
const OVERSCAN = 8;
const DEFAULT_VIEWPORT_HEIGHT = 600;

interface GridCellProps {
  row: number;
  col: number;
  displayValue: string;
  cellFormat?: CellFormat;
  isSelected: boolean;
  isEditing: boolean;
  isParameter?: boolean;
  isInFillRange: boolean;
  onClick: (e: React.MouseEvent<HTMLTableCellElement>) => void;
  onDoubleClick: (e: React.MouseEvent<HTMLTableCellElement>) => void;
  onMouseEnter: (e: React.MouseEvent<HTMLTableCellElement>) => void;
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
  onClick,
  onDoubleClick,
  onMouseEnter,
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
      className={`cell ${isSelected ? 'selected' : ''} ${isParameter ? 'parameter' : ''} ${isInFillRange ? 'fill-range' : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onMouseEnter={onMouseEnter}
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
}, (prev, next) => (
  prev.row === next.row &&
  prev.col === next.col &&
  prev.displayValue === next.displayValue &&
  prev.isSelected === next.isSelected &&
  prev.isEditing === next.isEditing &&
  prev.isParameter === next.isParameter &&
  prev.isInFillRange === next.isInFillRange &&
  prev.cellFormat?.bold === next.cellFormat?.bold &&
  prev.cellFormat?.italic === next.cellFormat?.italic &&
  prev.cellFormat?.underline === next.cellFormat?.underline &&
  prev.cellFormat?.fontColor === next.cellFormat?.fontColor &&
  prev.cellFormat?.backgroundColor === next.cellFormat?.backgroundColor &&
  prev.onClick === next.onClick &&
  prev.onDoubleClick === next.onDoubleClick &&
  prev.onMouseEnter === next.onMouseEnter &&
  prev.onFillHandleMouseDown === next.onFillHandleMouseDown
));

export const SpreadsheetGrid: React.FC = () => {
  const { setCell, getCell, getCellObject, selectCell, selectedCell, copyCell, pasteCell, cutCell, fillRange, setFillRange, clearFillRange, executeFill } = useAccelStore();
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isDraggingFill, setIsDraggingFill] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const pendingFillTarget = useRef<{ row: number; col: number } | null>(null);
  const fillRangeRaf = useRef<number | null>(null);
  const [scrollPosition, setScrollPosition] = useState({ top: 0, left: 0 });
  const [viewportHeight, setViewportHeight] = useState(DEFAULT_VIEWPORT_HEIGHT);
  const scrollRaf = useRef<number | null>(null);

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
      setScrollPosition({
        top: gridWrapperRef.current.scrollTop,
        left: gridWrapperRef.current.scrollLeft,
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
      setEditingCell(null);
      setEditValue('');
    }
  }, [selectCell]);

  const startEditing = useCallback((row: number, col: number, initialValue: string = '') => {
    setEditingCell({ row, col });
    const cellObj = getCellObject(row, col);
    const value = initialValue || cellObj?.formula || String(cellObj?.value ?? '');
    setEditValue(value);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [getCellObject]);

  const handleCellDoubleClick = useCallback((e: React.MouseEvent<HTMLTableCellElement>) => {
    const row = parseInt(e.currentTarget.dataset.row || '0', 10);
    const col = parseInt(e.currentTarget.dataset.col || '0', 10);
    if (row && col) {
      selectCell(row, col);
      startEditing(row, col);
    }
  }, [selectCell, startEditing]);

  const handleCellSubmit = useCallback(() => {
    if (editingCell) {
      setCell(editingCell.row, editingCell.col, editValue);
      setEditingCell(null);
      setEditValue('');
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
    if (!isDraggingFill || !selectedCell) return;

    const row = parseInt(e.currentTarget.dataset.row || '0', 10);
    const col = parseInt(e.currentTarget.dataset.col || '0', 10);
    if (!row || !col) return;

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
  }, [isDraggingFill, selectedCell, setFillRange]);

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
      setScrollPosition({ top: target.scrollTop, left: target.scrollLeft });
      scrollRaf.current = null;
    });
  }, []);

  const colToLetter = (col: number): string => {
    let letter = '';
    let c = col;
    while (c > 0) {
      const remainder = (c - 1) % 26;
      letter = String.fromCharCode(65 + remainder) + letter;
      c = Math.floor((c - 1) / 26);
    }
    return letter;
  };

  const formatCellValue = (value: CellValue): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
      return value.toLocaleString(undefined, { maximumFractionDigits: 10 });
    }
    return String(value);
  };

  const totalGridHeight = ROWS * ROW_HEIGHT;
  const estimatedVisibleRowCount = viewportHeight > 0
    ? Math.ceil(viewportHeight / ROW_HEIGHT)
    : ROWS;
  const startRow = Math.max(1, Math.floor(scrollPosition.top / ROW_HEIGHT) + 1 - OVERSCAN);
  const endRow = Math.min(ROWS, startRow + estimatedVisibleRowCount + OVERSCAN * 2 - 1);
  const topSpacerHeight = (startRow - 1) * ROW_HEIGHT;
  const bottomSpacerHeight = Math.max(totalGridHeight - endRow * ROW_HEIGHT, 0);
  const visibleRows = useMemo(
    () => Array.from({ length: endRow - startRow + 1 }, (_, i) => startRow + i),
    [startRow, endRow]
  );
  const columns = useMemo(() => Array.from({ length: COLS }, (_, i) => i + 1), []);

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

  // Pre-compute all visible cell data to avoid repeated getCellObject/getCell calls in render loop
  const visibleCellData = useMemo(() => {
    const cellData = new Map<string, {
      cellObj: ReturnType<typeof getCellObject>;
      value: CellValue;
      displayValue: string;
      isParameter: boolean;
      isSelected: boolean;
      isEditing: boolean;
      isInFillRange: boolean;
    }>();

    for (const row of visibleRows) {
      for (const col of columns) {
        const key = `${row}-${col}`;
        const cellObj = getCellObject(row, col);
        const value = getCell(row, col);
        const isSelected = selectedCell?.row === row && selectedCell?.col === col;
        const isEditing = editingCell?.row === row && editingCell?.col === col;
        const isParameter = cellObj?.isParameter || false;
        const isInFillRange = fillRange && selectedCell ? (
          (selectedCell.row === row && col >= Math.min(selectedCell.col, fillRange.col) && col <= Math.max(selectedCell.col, fillRange.col)) ||
          (selectedCell.col === col && row >= Math.min(selectedCell.row, fillRange.row) && row <= Math.max(selectedCell.row, fillRange.row))
        ) : false;

        cellData.set(key, {
          cellObj,
          value,
          displayValue: formatCellValue(value),
          isParameter,
          isSelected,
          isEditing,
          isInFillRange,
        });
      }
    }

    return cellData;
  }, [visibleRows, columns, getCellObject, getCell, selectedCell, editingCell, fillRange]);

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
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleFormulaKeyDown}
          onBlur={handleCellSubmit}
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
              {columns.map((col) => (
                <th key={col} className="col-header">
                  {colToLetter(col)}
                </th>
              ))}
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
                {columns.map((col) => {
                  const key = `${row}-${col}`;
                  const cellData = visibleCellData.get(key);

                  if (!cellData) return null;

                  return (
                    <GridCell
                      key={col}
                      row={row}
                      col={col}
                      displayValue={cellData.displayValue}
                      cellFormat={cellData.cellObj?.format}
                      isSelected={cellData.isSelected}
                      isEditing={cellData.isEditing}
                      isParameter={cellData.isParameter}
                      isInFillRange={cellData.isInFillRange}
                      onClick={handleCellClick}
                      onDoubleClick={handleCellDoubleClick}
                      onMouseEnter={handleCellMouseEnter}
                      onFillHandleMouseDown={handleFillHandleMouseDown}
                    />
                  );
                })}
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
