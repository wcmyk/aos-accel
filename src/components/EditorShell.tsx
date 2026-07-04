import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SpreadsheetGrid } from './SpreadsheetGrid';
import { Ribbon } from './Ribbon';
import { GraphCanvas } from './GraphCanvas';
import { StockPanel } from './StockPanel';
import { ParameterPanel } from './ParameterPanel';
import { SheetTabs } from './SheetTabs';
import { ShareButton } from './ShareButton';
import { useAccelStore } from '../store/accel-store';
import { isCloudEnabled } from '../lib/supabase';

function saveStatusLabel(status: 'idle' | 'saving' | 'saved' | 'error', isReadOnly: boolean): string {
  if (isReadOnly) return 'Read-only (shared view)';
  if (!isCloudEnabled) return 'Local only';
  switch (status) {
    case 'saving':
      return 'Saving…';
    case 'saved':
      return 'Saved';
    case 'error':
      return 'Save failed';
    default:
      return 'AutoSave Off';
  }
}

export function EditorShell() {
  const navigate = useNavigate();
  const activeSheet = useAccelStore((state) => state.activeSheet);
  const workbookTitle = useAccelStore((state) => state.workbookTitle);
  const setWorkbookTitle = useAccelStore((state) => state.setWorkbookTitle);
  const isReadOnly = useAccelStore((state) => state.isReadOnly);
  const saveStatus = useAccelStore((state) => state.saveStatus);
  const workbookId = useAccelStore((state) => state.workbookId);
  const canEditTitle = isCloudEnabled && Boolean(workbookId) && !isReadOnly;
  const [graphCollapsed, setGraphCollapsed] = useState(false);

  // Live selection statistics for the status bar, like Excel's.
  const selectedCell = useAccelStore((state) => state.selectedCell);
  const selectionRange = useAccelStore((state) => state.selectionRange);
  const docVersion = useAccelStore((state) => state.docVersion);
  const getCell = useAccelStore((state) => state.getCell);

  const selectionStats = useMemo(() => {
    void docVersion; // recompute when any cell changes
    const range = selectionRange
      ? selectionRange
      : selectedCell
        ? { start: selectedCell, end: selectedCell }
        : null;
    if (!range) return null;

    const r1 = Math.min(range.start.row, range.end.row);
    const r2 = Math.max(range.start.row, range.end.row);
    const c1 = Math.min(range.start.col, range.end.col);
    const c2 = Math.max(range.start.col, range.end.col);
    if ((r2 - r1 + 1) * (c2 - c1 + 1) > 20000) return null; // keep the UI snappy

    let sum = 0;
    let numeric = 0;
    let count = 0;
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const v = getCell(r, c);
        if (v === null || v === undefined || v === '') continue;
        count++;
        const n = typeof v === 'number' ? v : Number(v);
        if (typeof v !== 'boolean' && !Array.isArray(v) && isFinite(n)) {
          sum += n;
          numeric++;
        }
      }
    }
    if (count === 0) return null;
    return { sum, count, average: numeric > 0 ? sum / numeric : null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCell, selectionRange, docVersion, getCell]);

  const fmt = (n: number) =>
    Math.abs(n) >= 1e12 || (Math.abs(n) < 1e-6 && n !== 0)
      ? n.toExponential(4)
      : Number(n.toFixed(6)).toLocaleString('en-US', { maximumFractionDigits: 6 });

  return (
    <div className="excel-shell">
      <div className="title-bar">
        <div className="title-bar__left">
          <div className="traffic-lights">
            <span className="light red" />
            <span className="light yellow" />
            <span className="light green" />
          </div>
          <div className="title">
            {canEditTitle ? (
              <input
                className="title-input"
                value={workbookTitle}
                onChange={(e) => setWorkbookTitle(e.target.value)}
              />
            ) : (
              <strong>{workbookTitle || 'Radix.xlsx'}</strong>
            )}
            <span>Professional Spreadsheet Application</span>
          </div>
        </div>
        <div className="title-bar__right">
          {canEditTitle && <ShareButton workbookId={workbookId as string} />}
          {isCloudEnabled && (
            <button className="link-button" onClick={() => navigate('/')}>My workbooks</button>
          )}
          <span className={`status-dot ${saveStatus === 'error' ? 'status-dot--error' : ''}`} />
          {saveStatusLabel(saveStatus, isReadOnly)}
        </div>
      </div>

      {isReadOnly && (
        <div className="read-only-banner">
          You're viewing a shared, read-only copy of this workbook.
        </div>
      )}

      <Ribbon />

      <div className={`workspace${graphCollapsed ? ' workspace--graph-collapsed' : ''}`}>
        <div className="sheet-panel">
          <SpreadsheetGrid />
        </div>
        {graphCollapsed ? (
          <button
            className="graph-reopen"
            onClick={() => setGraphCollapsed(false)}
            title="Show graph panel"
          >
            <span className="graph-reopen__chevron">‹</span>
            <span className="graph-reopen__text">Graph</span>
          </button>
        ) : (
          <div className="insight-panel">
            <div className="card">
              <div className="card__header">
                <span className="label">Market</span>
                <button
                  className="icon-btn"
                  onClick={() => setGraphCollapsed(true)}
                  title="Hide side panel"
                  aria-label="Hide side panel"
                >
                  ›
                </button>
              </div>
              <StockPanel />
            </div>
            <div className="card">
              <div className="card__header">
                <span className="label">Graph</span>
              </div>
              <GraphCanvas />
            </div>
            <div className="card">
              <ParameterPanel />
            </div>
          </div>
        )}
      </div>

      <SheetTabs />

      <footer className="status-bar">
        <span>Ready</span>
        <span>{activeSheet}</span>
        <span>
          {selectionStats
            ? `Average: ${selectionStats.average !== null ? fmt(selectionStats.average) : '-'} | Count: ${selectionStats.count} | Sum: ${fmt(selectionStats.sum)}`
            : 'Average: - | Count: - | Sum: -'}
        </span>
      </footer>
    </div>
  );
}
