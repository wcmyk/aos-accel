import { useMemo } from 'react';
import { useAccelStore } from '../store/accel-store';
import type { CellValue } from '../engine/types';
import './Inspector.css';

function colToLetter(col: number): string {
  let s = '';
  let c = col;
  while (c > 0) {
    const m = (c - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    c = Math.floor((c - 1) / 26);
  }
  return s;
}
const keyToRef = (key: string): string => {
  const [c, r] = key.split(',').map(Number);
  return `${colToLetter(c)}${r}`;
};
const keyToRC = (key: string): { row: number; col: number } => {
  const [c, r] = key.split(',').map(Number);
  return { row: r, col: c };
};

function formatValue(v: CellValue): string {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return `[${(v as unknown[]).flat(Infinity).length.toLocaleString()} values]`;
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : Number(v.toFixed(6)).toString();
  return String(v);
}

/**
 * Contextual inspector: the right panel responds to what's selected instead of
 * being a fixed wall of tools. It shows a cell's value, its formula, the cells
 * it reads (inputs) and the cells that read it (used by), and offers the two
 * highest-value actions inline — turn a number into a slider, or plot a series.
 */
export function Inspector() {
  const selectedCell = useAccelStore((s) => s.selectedCell);
  const docVersion = useAccelStore((s) => s.docVersion);
  const engine = useAccelStore((s) => s.engine);
  const getCellObject = useAccelStore((s) => s.getCellObject);
  const selectCell = useAccelStore((s) => s.selectCell);
  const setParameter = useAccelStore((s) => s.setParameter);
  const updateParameter = useAccelStore((s) => s.updateParameter);
  const addGraph = useAccelStore((s) => s.addGraph);
  const isReadOnly = useAccelStore((s) => s.isReadOnly);

  const info = useMemo(() => {
    void docVersion; // recompute as cells/formulas change
    if (!selectedCell) return null;
    const { row, col } = selectedCell;
    const cell = getCellObject(row, col);
    const inputs = cell?.dependencies ? Array.from(cell.dependencies) : [];
    const usedBy = engine.getDependents(row, col).map((d) => `${d.col},${d.row}`);
    return {
      row,
      col,
      ref: `${colToLetter(col)}${row}`,
      value: (cell?.value ?? null) as CellValue,
      formula: cell?.formula,
      isParam: cell?.isParameter ?? false,
      param: cell?.parameterConfig,
      inputs,
      usedBy,
      isArray: Array.isArray(cell?.value),
      isNumber: typeof cell?.value === 'number' && !cell?.formula,
    };
  }, [selectedCell, docVersion, getCellObject, engine]);

  if (!info) {
    return (
      <div className="inspector inspector--empty">
        <p className="inspector__hint">
          Select a cell to see its value, what it depends on, and what depends on it — and to turn
          it into a slider or a plot.
        </p>
      </div>
    );
  }

  const makeSlider = () => {
    const v = typeof info.value === 'number' ? info.value : 0;
    const span = Math.max(Math.abs(v), 1);
    const step = span > 10 ? 1 : span > 1 ? 0.1 : 0.01;
    setParameter(info.row, info.col, Math.floor(v - span), Math.ceil(v + span), step);
  };

  const plot = () => {
    addGraph(`insp_${Date.now()}`, `PLOT(${info.ref})`, 'plot');
  };

  return (
    <div className="inspector">
      <div className="inspector__head">
        <span className="inspector__ref">{info.ref}</span>
        <span className="inspector__value" title={String(info.value)}>{formatValue(info.value)}</span>
      </div>

      {info.formula && (
        <div className="inspector__row">
          <span className="inspector__label">Formula</span>
          <code className="inspector__formula">{info.formula}</code>
        </div>
      )}

      {info.isParam && info.param && (
        <div className="inspector__slider">
          <input
            type="range"
            min={info.param.min}
            max={info.param.max}
            step={info.param.step}
            value={typeof info.value === 'number' ? info.value : info.param.min}
            disabled={isReadOnly}
            onChange={(e) => updateParameter(info.row, info.col, Number(e.target.value))}
            aria-label={`Adjust ${info.ref}`}
          />
          <div className="inspector__slider-scale">
            <span>{info.param.min}</span>
            <span>step {info.param.step}</span>
            <span>{info.param.max}</span>
          </div>
        </div>
      )}

      {info.formula && info.inputs.length > 0 && (
        <div className="inspector__row">
          <span className="inspector__label">Inputs</span>
          <div className="inspector__chips">
            {info.inputs.map((k) => (
              <button
                key={k}
                className="inspector__chip"
                onClick={() => {
                  const { row, col } = keyToRC(k);
                  selectCell(row, col);
                }}
                title={`Go to ${keyToRef(k)}`}
              >
                {keyToRef(k)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="inspector__row">
        <span className="inspector__label">Used by</span>
        {info.usedBy.length > 0 ? (
          <div className="inspector__chips">
            {info.usedBy.map((k) => (
              <button
                key={k}
                className="inspector__chip"
                onClick={() => {
                  const { row, col } = keyToRC(k);
                  selectCell(row, col);
                }}
                title={`Go to ${keyToRef(k)}`}
              >
                {keyToRef(k)}
              </button>
            ))}
          </div>
        ) : (
          <span className="inspector__muted">Nothing depends on this yet.</span>
        )}
      </div>

      {!isReadOnly && (info.isNumber || info.isArray) && (
        <div className="inspector__actions">
          {info.isNumber && !info.isParam && (
            <button className="btn" onClick={makeSlider} title="Turn this number into an adjustable slider">
              Make slider
            </button>
          )}
          {info.isArray && (
            <button className="btn ghost" onClick={plot} title="Plot this series on the graph">
              Plot
            </button>
          )}
        </div>
      )}
    </div>
  );
}
