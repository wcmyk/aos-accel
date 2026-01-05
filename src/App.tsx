/**
 * Main Accel Application
 * Full-featured Excel replacement
 */

import { SpreadsheetGrid } from './components/SpreadsheetGrid';
import { Ribbon } from './components/Ribbon';
import { GraphCanvas } from './components/GraphCanvas';
import { SheetTabs } from './components/SheetTabs';
import { useAccelStore } from './store/accel-store';
import './App.css';

function App() {
  const activeSheet = useAccelStore((state) => state.activeSheet);

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
            <strong>Accel.xlsx</strong>
            <span>Professional Spreadsheet Application</span>
          </div>
        </div>
        <div className="title-bar__right">
          <span className="status-dot" />
          AutoSave Off
        </div>
      </div>

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

export default App;
