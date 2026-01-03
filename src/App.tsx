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
            <span>Unified Spreadsheet + Graphing</span>
          </div>
        </div>
        <div className="title-bar__right">
          <span className="status-dot" />
          AutoSave Off
        </div>
      </div>

      <div className="ribbon-tabs">
        <button className="tab active">Home</button>
        <button className="tab">Insert</button>
        <button className="tab">Page Layout</button>
        <button className="tab">Formulas</button>
        <button className="tab">Data</button>
        <button className="tab">Review</button>
        <button className="tab">View</button>
      </div>

      <div className="ribbon">
        <div className="ribbon-group">
          <p className="ribbon-title">Graph</p>
          <Toolbar />
        </div>
        <div className="ribbon-group">
          <p className="ribbon-title">Automation</p>
          <AutomationPanel />
        </div>
      </div>

      <div className="workspace">
        <div className="sheet-panel">
          <SpreadsheetGrid />
        </div>
        <div className="insight-panel">
          <div className="card">
            <div className="card__header">
              <p className="label">Chart</p>
              <span className="dim-note">Driven by grid cells</span>
            </div>
            <GraphCanvas />
          </div>
          <div className="card">
            <div className="card__header">
              <p className="label">Parameters</p>
              <span className="dim-note">Live sliders</span>
            </div>
            <ParameterPanel />
          </div>
        </div>
      </div>

      <footer className="status-bar">
        <span>Ready</span>
        <span>Pastel Theme</span>
        <span>Shared AST Graphs</span>
      </footer>
    </div>
  );
}

export default App;
