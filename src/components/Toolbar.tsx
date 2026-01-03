/**
 * Toolbar Component
 * Controls for graphs, parameters, and automation
 */

import React, { useState } from 'react';
import { useAccelStore } from '../store/accel-store';

export const Toolbar: React.FC = () => {
  const { selectedCell, setParameter, addGraph, getGraphs, removeGraph } = useAccelStore();
  const [showGraphDialog, setShowGraphDialog] = useState(false);
  const [showParamDialog, setShowParamDialog] = useState(false);
  const [graphFormula, setGraphFormula] = useState('');
  const [paramConfig, setParamConfig] = useState({ min: 0, max: 10, step: 0.1 });

  const handleAddParameter = () => {
    if (!selectedCell) {
      alert('Please select a cell first');
      return;
    }

    setParameter(
      selectedCell.row,
      selectedCell.col,
      paramConfig.min,
      paramConfig.max,
      paramConfig.step
    );

    setShowParamDialog(false);
  };

  const handleAddGraph = () => {
    if (!graphFormula.trim()) {
      alert('Please enter a formula');
      return;
    }

    try {
      const id = `graph_${Date.now()}`;
      addGraph(id, graphFormula);
      setGraphFormula('');
      setShowGraphDialog(false);
    } catch (error) {
      alert(`Error adding graph: ${(error as Error).message}`);
    }
  };

  const graphs = getGraphs();

  return (
    <div className="toolbar">
      <div className="toolbar-section">
        <button className="btn" onClick={() => setShowGraphDialog(true)}>Add Graph</button>
        <div className="graph-list">
          {graphs.map((graph) => (
            <div key={graph.id} className="graph-item">
              <span className="dot" style={{ color: graph.color }}>●</span>
              <span className="graph-formula">{graph.formula}</span>
              <button className="icon-btn" onClick={() => removeGraph(graph.id)}>×</button>
            </div>
          ))}
        </div>
      </div>

      <div className="toolbar-section">
        <button className="btn ghost" onClick={() => setShowParamDialog(true)} disabled={!selectedCell}>
          Make Parameter from Selection
        </button>
      </div>

      {showGraphDialog && (
        <div className="dialog">
          <div className="dialog-content">
            <div>
              <p className="eyebrow">Add Graph</p>
              <h3>Bind a formula to the graph</h3>
              <p className="dialog-subtitle">Reference grid cells directly to keep graphs and cells in sync.</p>
            </div>
            <label>
              Formula (e.g., A1 * x + B1):
              <input
                type="text"
                value={graphFormula}
                onChange={(e) => setGraphFormula(e.target.value)}
                placeholder="y = f(x)"
              />
            </label>
            <div className="dialog-buttons">
              <button className="btn" onClick={handleAddGraph}>Add</button>
              <button className="btn ghost" onClick={() => setShowGraphDialog(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showParamDialog && (
        <div className="dialog">
          <div className="dialog-content">
            <div>
              <p className="eyebrow">Parameter</p>
              <h3>Create a slider from the selected cell</h3>
              <p className="dialog-subtitle">Min, max, and step will drive graph recalculation instantly.</p>
            </div>
            <label>
              Min:
              <input
                type="number"
                value={paramConfig.min}
                onChange={(e) => setParamConfig({ ...paramConfig, min: parseFloat(e.target.value) })}
              />
            </label>
            <label>
              Max:
              <input
                type="number"
                value={paramConfig.max}
                onChange={(e) => setParamConfig({ ...paramConfig, max: parseFloat(e.target.value) })}
              />
            </label>
            <label>
              Step:
              <input
                type="number"
                value={paramConfig.step}
                onChange={(e) => setParamConfig({ ...paramConfig, step: parseFloat(e.target.value) })}
                step="0.01"
              />
            </label>
            <div className="dialog-buttons">
              <button className="btn" onClick={handleAddParameter}>Create</button>
              <button className="btn ghost" onClick={() => setShowParamDialog(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
