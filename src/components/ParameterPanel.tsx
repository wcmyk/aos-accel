/**
 * Parameter Panel Component
 * Interactive sliders for parameters
 */

import React, { useState } from 'react';
import { useAccelStore } from '../store/accel-store';
import { Cell } from '../engine/types';

export const ParameterPanel: React.FC = React.memo(() => {
  const { engine, updateParameter, refresh } = useAccelStore();

  const worksheet = engine.getWorksheet();
  const parameters: Array<{ key: string; cell: Cell }> = [];

  worksheet.cells.forEach((cell, key) => {
    if (cell.isParameter && cell.parameterConfig) {
      parameters.push({ key, cell });
    }
  });

  if (parameters.length === 0) {
    return (
      <div className="parameter-panel empty">
        <p>No parameters defined.</p>
        <p className="hint">Select a cell and mark it as a parameter to create interactive sliders.</p>
      </div>
    );
  }

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

  return (
    <div className="parameter-panel">
      <h3>Parameters</h3>
      {parameters.map(({ key, cell }) => {
        const config = cell.parameterConfig!;
        const value = typeof cell.value === 'number' ? cell.value : config.min;
        const cellRef = `${colToLetter(cell.address.col)}${cell.address.row}`;

        return (
          <ParameterSlider
            key={key}
            cellRef={cellRef}
            cell={cell}
            config={config}
            value={value}
            updateParameter={updateParameter}
            refresh={refresh}
          />
        );
      })}
    </div>
  );
});

// Optimized slider component with local state
const ParameterSlider: React.FC<{
  cellRef: string;
  cell: Cell;
  config: { min: number; max: number; step: number };
  value: number;
  updateParameter: (row: number, col: number, value: number) => void;
  refresh: () => void;
}> = React.memo(({ cellRef, cell, config, value, updateParameter, refresh }) => {
  const [localValue, setLocalValue] = useState(value);
  const [isDragging, setIsDragging] = useState(false);

  // Update local value immediately for smooth slider
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(parseFloat(e.target.value));
  };

  // Only update engine when user releases slider (debounced)
  const handleMouseUp = () => {
    if (isDragging && localValue !== value) {
      updateParameter(cell.address.row, cell.address.col, localValue);
      refresh();
    }
    setIsDragging(false);
  };

  // Sync local value when prop changes (from automation or other sources)
  React.useEffect(() => {
    if (!isDragging) {
      setLocalValue(value);
    }
  }, [value, isDragging]);

  return (
    <div className="parameter-item">
      <div className="parameter-header">
        <span className="parameter-name">{cellRef}</span>
        <span className="parameter-value">{localValue.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={config.min}
        max={config.max}
        step={config.step}
        value={localValue}
        onChange={handleChange}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={handleMouseUp}
        onTouchStart={() => setIsDragging(true)}
        onTouchEnd={handleMouseUp}
        className="parameter-slider"
      />
      <div className="parameter-range">
        <span>{config.min}</span>
        <span>{config.max}</span>
      </div>
    </div>
  );
});
