/**
 * Accel State Management
 * Zustand store for reactive UI updates
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { AccelEngine } from '../engine/engine';
import { CellValue, Cell, GraphDefinition } from '../engine/types';

interface AccelState {
  engine: AccelEngine;
  selectedCell: { row: number; col: number } | null;

  // Actions
  setCell: (row: number, col: number, value: string | number | boolean) => void;
  getCell: (row: number, col: number) => CellValue;
  getCellObject: (row: number, col: number) => Cell | undefined;
  selectCell: (row: number, col: number) => void;

  // Parameters
  setParameter: (row: number, col: number, min: number, max: number, step: number) => void;
  updateParameter: (row: number, col: number, value: number) => void;

  // Graphs
  addGraph: (id: string, formula: string) => void;
  removeGraph: (id: string) => void;
  getGraphs: () => GraphDefinition[];

  // Force re-render
  refresh: () => void;
}

export const useAccelStore = create<AccelState>()(
  immer((set, get) => ({
    engine: new AccelEngine(),
    selectedCell: null,

    setCell: (row, col, value) => {
      const { engine } = get();
      engine.setCell(row, col, value);
      set((state) => {
        // Trigger re-render by updating reference
        state.engine = engine;
      });
    },

    getCell: (row, col) => {
      const { engine } = get();
      return engine.getCell(row, col);
    },

    getCellObject: (row, col) => {
      const { engine } = get();
      return engine.getCellObject(row, col);
    },

    selectCell: (row, col) => {
      set((state) => {
        state.selectedCell = { row, col };
      });
    },

    setParameter: (row, col, min, max, step) => {
      const { engine } = get();
      engine.setParameter(row, col, min, max, step);
      set((state) => {
        state.engine = engine;
      });
    },

    updateParameter: (row, col, value) => {
      const { engine } = get();
      engine.updateParameter(row, col, value);
      set((state) => {
        state.engine = engine;
      });
    },

    addGraph: (id, formula) => {
      const { engine } = get();
      engine.addGraph(id, formula);
      set((state) => {
        state.engine = engine;
      });
    },

    removeGraph: (id) => {
      const { engine } = get();
      engine.removeGraph(id);
      set((state) => {
        state.engine = engine;
      });
    },

    getGraphs: () => {
      const { engine } = get();
      return engine.getGraphs();
    },

    refresh: () => {
      set((state) => {
        // Force re-render
      });
    },
  }))
);
