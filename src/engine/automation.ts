/**
 * Automation Runtime
 * Allows scripted control of parameters, calculations, and graphs
 */

import { AccelEngine } from './engine';

export type AutomationStep =
  | { type: 'set-cell'; row: number; col: number; value: string | number }
  | { type: 'set-parameter'; row: number; col: number; value: number }
  | { type: 'wait'; ms: number }
  | { type: 'loop'; count: number; steps: AutomationStep[] }
  | { type: 'sweep'; row: number; col: number; from: number; to: number; step: number; delay?: number }
  | { type: 'export-graph'; id: string; filename: string };

export interface AutomationScript {
  name: string;
  description?: string;
  steps: AutomationStep[];
}

export class AutomationRunner {
  private engine: AccelEngine;
  private running: boolean = false;
  private onUpdate?: () => void;

  constructor(engine: AccelEngine, onUpdate?: () => void) {
    this.engine = engine;
    this.onUpdate = onUpdate;
  }

  async run(script: AutomationScript): Promise<void> {
    if (this.running) {
      throw new Error('Automation already running');
    }

    this.running = true;

    try {
      await this.executeSteps(script.steps);
    } finally {
      this.running = false;
    }
  }

  stop(): void {
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  private async executeSteps(steps: AutomationStep[]): Promise<void> {
    for (const step of steps) {
      if (!this.running) break;

      await this.executeStep(step);
    }
  }

  private async executeStep(step: AutomationStep): Promise<void> {
    switch (step.type) {
      case 'set-cell':
        this.engine.setCell(step.row, step.col, step.value);
        this.onUpdate?.();
        break;

      case 'set-parameter':
        this.engine.updateParameter(step.row, step.col, step.value);
        this.onUpdate?.();
        break;

      case 'wait':
        await this.wait(step.ms);
        break;

      case 'loop':
        for (let i = 0; i < step.count; i++) {
          if (!this.running) break;
          await this.executeSteps(step.steps);
        }
        break;

      case 'sweep': {
        const { row, col, from, to, step: stepSize, delay = 50 } = step;
        const steps = Math.floor((to - from) / stepSize) + 1;

        for (let i = 0; i < steps; i++) {
          if (!this.running) break;

          const value = from + i * stepSize;
          this.engine.updateParameter(row, col, value);
          this.onUpdate?.();

          if (delay > 0) {
            await this.wait(delay);
          }
        }
        break;
      }

      case 'export-graph':
        // Export graph data (would need implementation based on platform)
        console.log(`Export graph ${step.id} to ${step.filename}`);
        break;
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Example automation scripts
export const EXAMPLE_SCRIPTS: AutomationScript[] = [
  {
    name: 'Parameter Sweep',
    description: 'Walk a parameter across a range to watch the graph respond.',
    steps: [
      { type: 'sweep', row: 1, col: 1, from: 0, to: 10, step: 0.5, delay: 100 },
    ],
  },
  {
    name: 'Monte Carlo Simulation',
    description: 'Feed random values into two cells repeatedly.',
    steps: [
      {
        type: 'loop',
        count: 100,
        steps: [
          { type: 'set-cell', row: 1, col: 1, value: '=RAND()' },
          { type: 'set-cell', row: 2, col: 1, value: '=RAND()' },
          { type: 'wait', ms: 50 },
        ],
      },
    ],
  },
  {
    name: 'Animated Graph',
    description: 'Drive a sine-style input to animate a curve.',
    steps: [
      {
        type: 'loop',
        count: 50,
        steps: [
          { type: 'sweep', row: 1, col: 1, from: 0, to: 6.28, step: 0.1, delay: 50 },
        ],
      },
    ],
  },
];
