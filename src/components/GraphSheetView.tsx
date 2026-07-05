import { useState, useCallback } from 'react';
import { useAccelStore } from '../store/accel-store';
import { GraphCanvas } from './GraphCanvas';
import './GraphSheetView.css';

/**
 * Full-canvas graph sheet. The plots live on this (data-less) worksheet and
 * are authored as formulas that reference the grid sheets via cross-sheet
 * references, e.g. PLOT(Sheet1!A2:A100, Sheet1!B2:B100) or an equation like
 * Sheet1!A1 * x + Sheet1!B1. GraphCanvas renders the active sheet's graphs, so
 * it needs no special wiring here.
 */
export function GraphSheetView() {
  const activeSheet = useAccelStore((s) => s.activeSheet);
  const sheetNames = useAccelStore((s) => s.sheetNames);
  const sheetKinds = useAccelStore((s) => s.sheetKinds);
  const addGraph = useAccelStore((s) => s.addGraph);
  const getGraphs = useAccelStore((s) => s.getGraphs);
  const removeGraph = useAccelStore((s) => s.removeGraph);
  const docVersion = useAccelStore((s) => s.docVersion);
  const isReadOnly = useAccelStore((s) => s.isReadOnly);

  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Grid sheets are the data sources the user references from here.
  const gridSheets = sheetNames.filter((n) => (sheetKinds[n] ?? 'grid') === 'grid');
  const firstGrid = gridSheets[0] ?? 'Sheet1';

  void docVersion; // re-read graphs when they change
  const graphs = getGraphs();

  const addPlot = useCallback(() => {
    const raw = draft.trim();
    if (!raw) return;
    // Normalize: drop a leading '=' and an optional 'y =' so users can paste
    // formulas in any of the shapes the app uses elsewhere.
    const normalized = raw.replace(/^=/, '').replace(/^y\s*=\s*/i, '').trim();
    if (!normalized) return;
    const isPlot = /^PLOT\s*\(/i.test(normalized);
    try {
      addGraph(`gs_${activeSheet}_${graphs.length + 1}_${normalized.length}`, normalized, isPlot ? 'plot' : 'function');
      setDraft('');
      setError(null);
    } catch (e) {
      setError((e as Error).message || 'Could not add that plot');
    }
  }, [draft, addGraph, activeSheet, graphs.length]);

  return (
    <div className="graph-sheet">
      {!isReadOnly && (
        <div className="graph-sheet__bar">
          <input
            className="graph-sheet__input"
            value={draft}
            placeholder={`Add a plot — e.g. PLOT(${firstGrid}!A2:A100, ${firstGrid}!B2:B100) or ${firstGrid}!A1 * x + ${firstGrid}!B1`}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addPlot();
            }}
            aria-label="Add a plot to this graph sheet"
          />
          <button className="btn" onClick={addPlot} disabled={!draft.trim()}>
            Add plot
          </button>
        </div>
      )}
      {error && <div className="graph-sheet__error">{error}</div>}
      {graphs.length > 0 && (
        <div className="graph-sheet__plots">
          {graphs.map((g) => (
            <span className="graph-sheet__chip" key={g.id}>
              <span className="graph-sheet__chip-dot" style={{ background: g.color }} />
              <code>{g.formula}</code>
              {!isReadOnly && (
                <button
                  className="graph-sheet__chip-remove"
                  onClick={() => removeGraph(g.id)}
                  title="Remove plot"
                  aria-label={`Remove plot ${g.formula}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="graph-sheet__canvas">
        <GraphCanvas />
      </div>
      {graphs.length === 0 && (
        <div className="graph-sheet__hint">
          This is a graph sheet. Add a plot above that references your data, like{' '}
          <code>PLOT({firstGrid}!A2:A100, {firstGrid}!B2:B100)</code>. Edit those cells on{' '}
          <strong>{firstGrid}</strong> and the plot updates live.
        </div>
      )}
    </div>
  );
}
