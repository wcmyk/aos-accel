/**
 * Tests for the snapshot-based undo/redo history added to the store.
 *
 * The public read surface is canUndo/canRedo (reactive) and the undo()/redo()
 * actions. History is recorded automatically inside mutations, so these tests
 * drive the real store API and never call any private record helper.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { AccelEngine } from '../engine/engine';
import { useAccelStore } from './accel-store';

/** Fully reset the singleton store, including the history fields. */
const resetStore = () => {
  useAccelStore.setState({
    engine: new AccelEngine(),
    selectedCell: null,
    clipboard: null,
    fillRange: null,
    dirtyValues: new Set<string>(),
    dirtyFormulas: new Set<string>(),
    graphRenderer: null,
    activeSheet: 'Sheet1',
    sheetNames: ['Sheet1'],
    selectionRange: null,
    isSelecting: false,
    isReadOnly: false,
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,
  });
};

// Convenience: always read the freshest slice off the singleton.
const state = () => useAccelStore.getState();

describe('store undo/redo', () => {
  beforeEach(() => {
    resetStore();
  });

  it('starts with an empty, disabled history', () => {
    expect(state().canUndo).toBe(false);
    expect(state().canRedo).toBe(false);
    expect(state().undoStack).toHaveLength(0);
    expect(state().redoStack).toHaveLength(0);
  });

  it('undo restores the prior value and redo re-applies it', () => {
    state().setCell(1, 1, 5);
    expect(state().getCell(1, 1)).toBe(5);
    expect(state().canUndo).toBe(true);
    expect(state().canRedo).toBe(false);

    state().undo();
    expect(state().getCell(1, 1)).toBeNull();
    expect(state().canUndo).toBe(false);
    expect(state().canRedo).toBe(true);

    state().redo();
    expect(state().getCell(1, 1)).toBe(5);
    expect(state().canUndo).toBe(true);
    expect(state().canRedo).toBe(false);
  });

  it('walks back through several discrete edits in order', () => {
    state().setCell(1, 1, 10);
    state().setCell(1, 1, 20);
    state().setCell(1, 1, 30);
    expect(state().getCell(1, 1)).toBe(30);

    state().undo();
    expect(state().getCell(1, 1)).toBe(20);
    state().undo();
    expect(state().getCell(1, 1)).toBe(10);
    state().undo();
    expect(state().getCell(1, 1)).toBeNull();
    expect(state().canUndo).toBe(false);

    // Redo the whole chain forward again.
    state().redo();
    expect(state().getCell(1, 1)).toBe(10);
    state().redo();
    state().redo();
    expect(state().getCell(1, 1)).toBe(30);
    expect(state().canRedo).toBe(false);
  });

  it('undo/redo are no-ops at the ends of the history', () => {
    // Nothing recorded yet: both are safe no-ops.
    expect(() => state().undo()).not.toThrow();
    expect(() => state().redo()).not.toThrow();
    expect(state().getCell(1, 1)).toBeNull();

    state().setCell(2, 2, 7);
    state().undo();
    // Extra undo past the start does nothing.
    state().undo();
    expect(state().getCell(2, 2)).toBeNull();
    expect(state().canUndo).toBe(false);

    state().redo();
    // Extra redo past the end does nothing.
    state().redo();
    expect(state().getCell(2, 2)).toBe(7);
    expect(state().canRedo).toBe(false);
  });

  it('a fresh edit clears the redo stack', () => {
    state().setCell(1, 1, 1);
    state().setCell(1, 1, 2);
    state().undo(); // value back to 1, redo now available
    expect(state().canRedo).toBe(true);

    state().setCell(1, 1, 99); // diverging edit
    expect(state().canRedo).toBe(false);
    expect(state().redoStack).toHaveLength(0);

    // The old redo target (2) is unreachable; undo goes to the divergence point.
    state().undo();
    expect(state().getCell(1, 1)).toBe(1);
  });

  it('coalesces a continuous parameter drag into a single undo step', () => {
    state().setParameter(1, 1, 0, 10, 1); // discrete: one checkpoint
    const afterParam = state().undoStack.length;

    state().updateParameter(1, 1, 3);
    state().updateParameter(1, 1, 5);
    state().updateParameter(1, 1, 8);

    // Only the first drag tick adds a checkpoint; the rest coalesce.
    expect(state().undoStack.length).toBe(afterParam + 1);

    state().undo(); // undo the whole drag at once
    expect(state().getCellObject(1, 1)?.value).toBe(0);
  });

  it('respects read-only mode for both undo and redo', () => {
    state().setCell(1, 1, 42);
    useAccelStore.setState({ isReadOnly: true });

    state().undo();
    expect(state().getCell(1, 1)).toBe(42); // undo blocked

    useAccelStore.setState({ isReadOnly: false });
    state().undo();
    expect(state().getCell(1, 1)).toBeNull();

    useAccelStore.setState({ isReadOnly: true });
    state().redo();
    expect(state().getCell(1, 1)).toBeNull(); // redo blocked
  });

  it('bounds the undo stack to at most 100 checkpoints', () => {
    for (let i = 1; i <= 130; i++) {
      state().setCell(1, 1, i);
    }
    expect(state().undoStack.length).toBeLessThanOrEqual(100);
    expect(state().getCell(1, 1)).toBe(130);
  });
});
