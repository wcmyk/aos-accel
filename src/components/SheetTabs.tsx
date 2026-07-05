import React, { useCallback } from 'react';
import { useAccelStore } from '../store/accel-store';
import './Ribbon.css';

export const SheetTabs: React.FC = React.memo(() => {
  const {
    activeSheet,
    setActiveSheet,
    addSheet,
    addGraphSheet,
    deleteSheet,
    sheetNames,
    sheetKinds,
    isReadOnly,
  } = useAccelStore();

  const canDelete = sheetNames.length > 1 && !isReadOnly;

  const handleDelete = useCallback((name: string) => {
    if (sheetNames.length <= 1 || isReadOnly) return;
    // Guard against accidental loss of sheet contents.
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    deleteSheet(name);
  }, [sheetNames.length, isReadOnly, deleteSheet]);

  return (
    <div className="sheet-tabs">
      <div className="sheet-tabs__list" role="tablist" aria-label="Worksheets">
        {sheetNames.map((sheet) => {
          const isActive = sheet === activeSheet;
          return (
            <button
              key={sheet}
              role="tab"
              aria-selected={isActive}
              title={isActive ? sheet : `Switch to ${sheet}`}
              className={`sheet-tab ${isActive ? 'active' : ''}`}
              onClick={() => setActiveSheet(sheet)}
            >
              {(sheetKinds[sheet] ?? 'grid') === 'graph' && (
                <span className="sheet-tab__kind" aria-hidden="true" title="Graph sheet">📈 </span>
              )}
              {sheet}
              {canDelete && (
                <span
                  className="sheet-tab__close"
                  role="button"
                  tabIndex={0}
                  title={`Delete ${sheet}`}
                  aria-label={`Delete ${sheet}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(sheet);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(sheet);
                    }
                  }}
                >
                  ×
                </span>
              )}
            </button>
          );
        })}
        <button
          className="sheet-tab add-tab"
          onClick={addSheet}
          disabled={isReadOnly}
          title="Add a new sheet"
          aria-label="Add a new sheet"
        >
          ＋ Add Sheet
        </button>
        <button
          className="sheet-tab add-tab"
          onClick={() => addGraphSheet(false)}
          disabled={isReadOnly}
          title="Add a new graph sheet"
          aria-label="Add a new graph sheet"
        >
          📈 Graph Sheet
        </button>
      </div>
    </div>
  );
});

SheetTabs.displayName = 'SheetTabs';
