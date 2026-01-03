/**
 * Main Accel Application
 * Unified spreadsheet + graphing environment
 */

import { SpreadsheetGrid } from './components/SpreadsheetGrid';
import { GraphCanvas } from './components/GraphCanvas';
import { ParameterPanel } from './components/ParameterPanel';
import { Toolbar } from './components/Toolbar';
import { AutomationPanel } from './components/AutomationPanel';
import './App.css';

function App() {
  return (
    <div className="accel-app">
      <header className="app-header">
        <h1>🧮 Accel</h1>
        <p className="tagline">Unified Spreadsheet + Graphing Environment</p>
      </header>

      <div className="app-layout">
        <div className="left-panel">
          <Toolbar />
          <ParameterPanel />
          <AutomationPanel />
        </div>

        <div className="main-content">
          <div className="spreadsheet-section">
            <SpreadsheetGrid />
          </div>

          <div className="graph-section">
            <GraphCanvas />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
