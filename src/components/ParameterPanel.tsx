/**
 * Parameter Panel Component
 * Interactive sliders for parameters
 */

import React, { useEffect, useRef, useState } from 'react';
import { useAccelStore } from '../store/accel-store';
import { Cell } from '../engine/types';
import './ParameterPanel.css';

// Number of decimal places implied by a slider step (e.g. 0.05 -> 2), so the
// value/labels read crisply instead of dumping float noise like 3.1400000004.
const decimalsForStep = (step: number): number => {
  if (!isFinite(step) || step <= 0) return 2;
  const s = String(step);
  const dot = s.indexOf('.');
  if (dot < 0) return 0;
  return Math.min(6, s.length - dot - 1);
};

// Trim trailing zeros for min/max/step labels.
const fmtEdge = (n: number): string => {
  if (!isFinite(n)) return String(n);
  if (Number.isInteger(n)) return String(n);
  return parseFloat(n.toFixed(6)).toString();
};

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
      <div className="parameter-panel empty parameter-empty">
        <p className="hint-title">No parameters yet</p>
        <p className="hint">
          Turn a numeric cell into a live slider that drives your formulas and graphs.
        </p>
        <ol className="parameter-empty__steps">
          <li>
            <span className="parameter-empty__num">1</span>
            <span>Select a cell that holds a plain number.</span>
          </li>
          <li>
            <span className="parameter-empty__num">2</span>
            <span>
              Click <strong>Make Parameter from Selection</strong> in the ribbon.
            </span>
          </li>
          <li>
            <span className="parameter-empty__num">3</span>
            <span>Drag the slider and watch the sheet and graph update instantly.</span>
          </li>
        </ol>
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
      <h3 className="parameter-panel__title">Parameters</h3>
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
  // Debounce timer used only during a pointer drag so the graph tracks the
  // slider live (feels instant) without a full recalc on every pixel.
  const commitTimer = useRef<number | null>(null);

  const decimals = decimalsForStep(config.step);

  const commit = (next: number) => {
    if (next !== value) {
      updateParameter(cell.address.row, cell.address.col, next);
      refresh();
    }
  };

  const scheduleCommit = (next: number) => {
    if (commitTimer.current !== null) {
      window.clearTimeout(commitTimer.current);
    }
    commitTimer.current = window.setTimeout(() => {
      commitTimer.current = null;
      commit(next);
    }, 45);
  };

  // Local value updates immediately for a smooth slider. During a drag the
  // engine update is debounced (live graph, no recalc storm); keyboard and
  // programmatic changes commit right away so they can't be lost.
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = parseFloat(e.target.value);
    setLocalValue(next);
    if (isDragging) {
      scheduleCommit(next);
    } else {
      commit(next);
    }
  };

  // Flush the final value on release so the engine always ends on exactly
  // where the user let go, even if a debounce was still pending.
  const handleRelease = () => {
    if (commitTimer.current !== null) {
      window.clearTimeout(commitTimer.current);
      commitTimer.current = null;
    }
    if (isDragging) {
      commit(localValue);
    }
    setIsDragging(false);
  };

  // Sync local value when prop changes (from automation or other sources)
  useEffect(() => {
    if (!isDragging) {
      setLocalValue(value);
    }
  }, [value, isDragging]);

  // Clear any pending debounce if the slider unmounts mid-drag.
  useEffect(() => {
    return () => {
      if (commitTimer.current !== null) {
        window.clearTimeout(commitTimer.current);
      }
    };
  }, []);

  const displayValue = localValue.toFixed(decimals);

  return (
    <div className="parameter-item">
      <div className="parameter-header">
        <span className="parameter-name">{cellRef}</span>
        <span className="parameter-value">{displayValue}</span>
      </div>
      <input
        type="range"
        min={config.min}
        max={config.max}
        step={config.step}
        value={localValue}
        onChange={handleChange}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={handleRelease}
        onTouchStart={() => setIsDragging(true)}
        onTouchEnd={handleRelease}
        className="parameter-slider"
        aria-label={`${cellRef} parameter`}
        aria-valuetext={displayValue}
      />
      <div className="parameter-range">
        <span>{fmtEdge(config.min)}</span>
        <span className="parameter-range__step">step {fmtEdge(config.step)}</span>
        <span>{fmtEdge(config.max)}</span>
      </div>
    </div>
  );
});
