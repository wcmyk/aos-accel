import React, { useCallback } from 'react';
import { useAccelStore } from '../store/accel-store';
import { useShallow } from 'zustand/react/shallow';
import { Icon, IconButton } from './Icons';
import './Ribbon.css';

/** Bottom sheet bar. `children` render on the right (selection summary). */
export const SheetTabs: React.FC<{ children?: React.ReactNode }> = React.memo(({ children }) => {
  const {
    activeSheet,
    setActiveSheet,
    addSheet,
    addGraphSheet,
    deleteSheet,
    sheetNames,
    sheetKinds,
    isReadOnly,
  } = useAccelStore(
    useShallow((s) => ({ activeSheet: s.activeSheet, setActiveSheet: s.setActiveSheet, addSheet: s.addSheet, addGraphSheet: s.addGraphSheet, deleteSheet: s.deleteSheet, sheetNames: s.sheetNames, sheetKinds: s.sheetKinds, isReadOnly: s.isReadOnly }))
  );

  const canDelete = sheetNames.length > 1 && !isReadOnly;

  const handleDelete = useCallback((name: string) => {
    if (sheetNames.length <= 1 || isReadOnly) return;
    // Guard against accidental loss of sheet contents.
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    deleteSheet(name);
  }, [sheetNames.length, isReadOnly, deleteSheet]);

  return (
    <div className="sheet-tabs">
      <IconButton icon="add" className="sheet-tabs__btn" tooltip="Add sheet" onClick={addSheet} disabled={isReadOnly} />
      <IconButton icon="show_chart" className="sheet-tabs__btn" tooltip="Add graph sheet" onClick={() => addGraphSheet(false)} disabled={isReadOnly} />
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
                <Icon name="show_chart" size={16} className="sheet-tab__kind" />
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
                  <Icon name="close" size={14} />
                </span>
              )}
            </button>
          );
        })}

      </div>
      {children}
    </div>
  );
});

SheetTabs.displayName = 'SheetTabs';
