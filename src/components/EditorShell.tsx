import { useNavigate } from 'react-router-dom';
import { SpreadsheetGrid } from './SpreadsheetGrid';
import { Ribbon } from './Ribbon';
import { GraphCanvas } from './GraphCanvas';
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
          {isCloudEnabled && !isReadOnly && (
            <button className="link-button" onClick={() => navigate('/dashboard')}>My workbooks</button>
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

      <div className="workspace">
        <div className="sheet-panel">
          <SpreadsheetGrid />
        </div>
        <div className="insight-panel">
          <div className="card">
            <GraphCanvas />
          </div>
        </div>
      </div>

      <SheetTabs />

      <footer className="status-bar">
        <span>Ready</span>
        <span>{activeSheet}</span>
        <span>Average: - | Count: - | Sum: -</span>
      </footer>
    </div>
  );
}
