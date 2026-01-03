/**
 * Spreadsheet Grid Component
 * Excel-like grid interface with full keyboard support
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAccelStore } from '../store/accel-store';
import { CellValue } from '../engine/types';

const ROWS = 1000;
const COLS = 52; // A-AZ (52 columns)

export const SpreadsheetGrid: React.FC = () => {
  const { setCell, getCell, getCellObject, selectCell, selectedCell, copyCell, pasteCell, cutCell, fillRange, setFillRange, clearFillRange, executeFill } = useAccelStore();
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isDraggingFill, setIsDraggingFill] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Focus grid on mount for keyboard navigation
  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.focus();
    }
  }, []);

  const handleCellClick = useCallback((row: number, col: number) => {
    selectCell(row, col);
    setEditingCell(null);
    setEditValue('');
  }, [selectCell]);

  const startEditing = useCallback((row: number, col: number, initialValue: string = '') => {
    setEditingCell({ row, col });
    const cellObj = getCellObject(row, col);
    const value = initialValue || cellObj?.formula || String(cellObj?.value ?? '');
    setEditValue(value);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [getCellObject]);

  const handleCellDoubleClick = useCallback((row: number, col: number) => {
    selectCell(row, col);
    startEditing(row, col);
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
    setIsDraggingFill(true);
  }, []);

  const handleCellMouseEnter = useCallback((row: number, col: number) => {
    if (isDraggingFill && selectedCell) {
      // Only allow filling in the same row or column as the source
      if (row === selectedCell.row || col === selectedCell.col) {
        setFillRange(row, col);
      }
    }
  }, [isDraggingFill, selectedCell, setFillRange]);

  const handleMouseUp = useCallback(() => {
    if (isDraggingFill) {
      executeFill();
      setIsDraggingFill(false);
      clearFillRange();
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
          value={editingCell ? editValue : (selectedCell ? (getCellObject(selectedCell.row, selectedCell.col)?.formula || String(getCellObject(selectedCell.row, selectedCell.col)?.value ?? '')) : '')}
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

      <div className="grid-wrapper">
        <table className="spreadsheet-grid">
          <thead>
            <tr>
              <th className="row-header"></th>
              {Array.from({ length: COLS }, (_, i) => i + 1).map((col) => (
                <th key={col} className="col-header">
                  {colToLetter(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }, (_, i) => i + 1).map((row) => (
              <tr key={row}>
                <td className="row-header">{row}</td>
                {Array.from({ length: COLS }, (_, i) => i + 1).map((col) => {
                  const cellObj = getCellObject(row, col);
                  const value = getCell(row, col);
                  const isSelected = selectedCell?.row === row && selectedCell?.col === col;
                  const isEditing = editingCell?.row === row && editingCell?.col === col;
                  const isParameter = cellObj?.isParameter;
                  const isInFillRange = fillRange && selectedCell && (
                    (selectedCell.row === row && col >= Math.min(selectedCell.col, fillRange.col) && col <= Math.max(selectedCell.col, fillRange.col)) ||
                    (selectedCell.col === col && row >= Math.min(selectedCell.row, fillRange.row) && row <= Math.max(selectedCell.row, fillRange.row))
                  );

                  const cellFormat = cellObj?.format;
                  const cellStyle: React.CSSProperties = {
                    ...(cellFormat?.bold && { fontWeight: 'bold' }),
                    ...(cellFormat?.italic && { fontStyle: 'italic' }),
                    ...(cellFormat?.underline && { textDecoration: 'underline' }),
                    ...(cellFormat?.fontColor && { color: cellFormat.fontColor }),
                    ...(cellFormat?.backgroundColor && { backgroundColor: cellFormat.backgroundColor }),
                  };

                  return (
                    <td
                      key={col}
                      className={`cell ${isSelected ? 'selected' : ''} ${isParameter ? 'parameter' : ''} ${isInFillRange ? 'fill-range' : ''}`}
                      onClick={() => handleCellClick(row, col)}
                      onDoubleClick={() => handleCellDoubleClick(row, col)}
                      onMouseEnter={() => handleCellMouseEnter(row, col)}
                      style={cellFormat?.backgroundColor ? { backgroundColor: cellFormat.backgroundColor } : undefined}
                    >
                      {!isEditing && (
                        <div className="cell-content" style={cellStyle}>
                          {formatCellValue(value)}
                        </div>
                      )}
                      {isSelected && !isEditing && (
                        <div
                          className="fill-handle"
                          onMouseDown={handleFillHandleMouseDown}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
