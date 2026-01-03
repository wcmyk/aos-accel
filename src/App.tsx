/**
 * Main Accel Application
 * Full-featured Excel replacement
 */

import { SpreadsheetGrid } from './components/SpreadsheetGrid';
import { Ribbon } from './components/Ribbon';
import './App.css';

function App() {
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
            <span>Excel Replacement - Humanity's Last Hope</span>
          </div>
        </div>
        <div className="title-bar__right">
          <span className="status-dot" />
          AutoSave Off
        </div>
      </div>

      <Ribbon />

      <div className="workspace-fullwidth">
        <SpreadsheetGrid />
      </div>

      <footer className="status-bar">
        <span>Ready</span>
        <span>Sheet1</span>
        <span>Average: - | Count: - | Sum: -</span>
      </footer>
    </div>
  );
}

export default App;
