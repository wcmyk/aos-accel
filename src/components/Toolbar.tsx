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
        <h4>Graph</h4>
        <button onClick={() => setShowGraphDialog(true)}>Add Graph</button>
        <div className="graph-list">
          {graphs.map((graph) => (
            <div key={graph.id} className="graph-item">
              <span style={{ color: graph.color }}>●</span>
              <span className="graph-formula">{graph.formula}</span>
              <button onClick={() => removeGraph(graph.id)}>×</button>
            </div>
          ))}
        </div>
      </div>

      <div className="toolbar-section">
        <h4>Parameters</h4>
        <button onClick={() => setShowParamDialog(true)} disabled={!selectedCell}>
          Make Parameter
        </button>
      </div>

      {showGraphDialog && (
        <div className="dialog">
          <div className="dialog-content">
            <h3>Add Graph</h3>
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
              <button onClick={handleAddGraph}>Add</button>
              <button onClick={() => setShowGraphDialog(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showParamDialog && (
        <div className="dialog">
          <div className="dialog-content">
            <h3>Create Parameter</h3>
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
              <button onClick={handleAddParameter}>Create</button>
              <button onClick={() => setShowParamDialog(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
