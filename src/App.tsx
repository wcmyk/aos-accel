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
    <div className="app-shell">
      <header className="hero">
        <div className="hero__brand">
          <div className="hero__icon">🧮</div>
          <div>
            <p className="eyebrow">Accel</p>
            <h1>Unified Spreadsheet + Graphing Workspace</h1>
            <p className="hero__subtitle">
              Microsoft-grade clarity with live formulas, tunable parameters, and graphing powered by a single calculation engine.
            </p>
          </div>
        </div>
        <div className="hero__meta">
          <div className="badge">Live Recalc</div>
          <div className="badge">Excel-Style Grid</div>
          <div className="badge">Shared AST Graphs</div>
        </div>
      </header>

      <main className="workspace">
        <section className="workspace__row">
          <div className="panel panel--primary">
            <div className="panel__header">
              <div>
                <h2>Workbook</h2>
                <p>Enter values or formulas (e.g. <code>=SUM(A1:A5)</code>) and drive graphs directly.</p>
              </div>
              <div className="panel__actions">
                <a className="btn ghost" href="#graph-controls">Add graph</a>
                <a className="btn ghost" href="#parameters">Create parameter</a>
              </div>
            </div>
            <SpreadsheetGrid />
          </div>

          <div className="panel panel--graph" id="graph-controls">
            <div className="panel__header">
              <div>
                <h2>Graphing</h2>
                <p>Same formulas, instantly visualized. Zoom or reset with one tap.</p>
              </div>
              <Toolbar />
            </div>
            <GraphCanvas />
          </div>
        </section>

        <section className="workspace__row workspace__row--secondary" id="parameters">
          <div className="panel">
            <div className="panel__header">
              <div>
                <h3>Parameters</h3>
                <p>Turn any numeric cell into a slider to simulate and tune.</p>
              </div>
            </div>
            <ParameterPanel />
          </div>

          <div className="panel">
            <div className="panel__header">
              <div>
                <h3>Automation</h3>
                <p>Run prebuilt sweeps and simulations against the same grid + graphs.</p>
              </div>
            </div>
            <AutomationPanel />
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
