/**
 * Automation Panel Component
 * UI for running automation scripts
 */

import React, { useState } from 'react';
import { useAccelStore } from '../store/accel-store';
import { AutomationRunner, EXAMPLE_SCRIPTS, AutomationScript } from '../engine/automation';

export const AutomationPanel: React.FC = () => {
  const { engine, refresh } = useAccelStore();
  const [runner] = useState(() => new AutomationRunner(engine, refresh));
  const [running, setRunning] = useState(false);

  const handleRunScript = async (script: AutomationScript) => {
    if (running) return;

    setRunning(true);
    try {
      await runner.run(script);
    } catch (error) {
      alert(`Automation error: ${(error as Error).message}`);
    } finally {
      setRunning(false);
    }
  };

  const handleStop = () => {
    runner.stop();
    setRunning(false);
  };

  return (
    <div className="automation-panel">
      <h4>Automation</h4>
      <div className="script-list">
        {EXAMPLE_SCRIPTS.map((script, idx) => (
          <div key={idx} className="script-item">
            <span>{script.name}</span>
            <button onClick={() => handleRunScript(script)} disabled={running}>
              Run
            </button>
          </div>
        ))}
      </div>
      {running && (
        <button className="stop-button" onClick={handleStop}>
          Stop
        </button>
      )}
    </div>
  );
};
