/**
 * Spreadsheet Grid Component
 * Excel-like grid interface
 */

import React, { useState, useCallback, useRef } from 'react';
import { useAccelStore } from '../store/accel-store';
import { CellValue } from '../engine/types';

const ROWS = 100;
const COLS = 26;
const CELL_WIDTH = 100;
const CELL_HEIGHT = 30;

export const SpreadsheetGrid: React.FC = () => {
  const { setCell, getCell, getCellObject, selectCell, selectedCell } = useAccelStore();
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCellClick = useCallback((row: number, col: number) => {
    selectCell(row, col);
    setEditingCell({ row, col });

    const cellObj = getCellObject(row, col);
    setEditValue(cellObj?.formula || String(cellObj?.value ?? ''));

    setTimeout(() => inputRef.current?.focus(), 0);
  }, [selectCell, getCellObject]);

  const handleCellSubmit = useCallback(() => {
    if (editingCell) {
      setCell(editingCell.row, editingCell.col, editValue);
      setEditingCell(null);
      setEditValue('');
    }
  }, [editingCell, editValue, setCell]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellSubmit();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
  }, [handleCellSubmit]);

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
    <div className="spreadsheet-container">
      <div className="formula-bar">
        <div className="cell-reference">
          {selectedCell && `${colToLetter(selectedCell.col)}${selectedCell.row}`}
        </div>
        <input
          ref={inputRef}
          type="text"
          className="formula-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleCellSubmit}
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

                  return (
                    <td
                      key={col}
                      className={`cell ${isSelected ? 'selected' : ''} ${isParameter ? 'parameter' : ''}`}
                      onClick={() => handleCellClick(row, col)}
                      style={{
                        width: CELL_WIDTH,
                        height: CELL_HEIGHT,
                      }}
                    >
                      {!isEditing && (
                        <div className="cell-content">
                          {formatCellValue(value)}
                        </div>
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
