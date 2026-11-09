/**
 * Automation Panel Component
 * UI for running automation scripts
 */

import React, { useState } from 'react';
import { useAccelStore } from '../store/accel-store';
import { useShallow } from 'zustand/react/shallow';
import { IconButton } from './Icons';
import { AutomationRunner, EXAMPLE_SCRIPTS, AutomationScript } from '../engine/automation';

export const AutomationPanel: React.FC = () => {
  const { engine, refresh , docVersion} = useAccelStore(
    useShallow((s) => ({ engine: s.engine, refresh: s.refresh, docVersion: s.docVersion }))
  );
  void docVersion; // re-render when cells change (parameter values live in the engine)
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
    <div className="ribbon-controls">
      {EXAMPLE_SCRIPTS.map((script) => (
        <IconButton
          key={script.name}
          icon="play_arrow"
          label={script.name}
          tooltip={script.description ? `Run: ${script.description}` : `Run ${script.name}`}
          onClick={() => handleRunScript(script)}
          disabled={running}
        />
      ))}
      {running && <IconButton icon="stop" label="Stop" tooltip="Stop the running script" onClick={handleStop} />}
    </div>
  );
};
