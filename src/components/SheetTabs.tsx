import React from 'react';
import { useAccelStore } from '../store/accel-store';

export const SheetTabs: React.FC = React.memo(() => {
  const {
    activeSheet,
    setActiveSheet,
    addSheet,
    deleteSheet,
    sheetNames,
  } = useAccelStore();

  const sheets = sheetNames;

  return (
    <div className="sheet-tabs">
      <div className="sheet-tabs__list">
        {sheets.map((sheet) => (
          <button
            key={sheet}
            className={`sheet-tab ${sheet === activeSheet ? 'active' : ''}`}
            onClick={() => setActiveSheet(sheet)}
          >
            {sheet}
            {sheets.length > 1 && (
              <span
                className="sheet-tab__close"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSheet(sheet);
                }}
              >
                ×
              </span>
            )}
          </button>
        ))}
        <button className="sheet-tab add-tab" onClick={addSheet}>＋ Add Sheet</button>
      </div>
    </div>
  );
});
