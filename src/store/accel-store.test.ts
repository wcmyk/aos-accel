import { beforeEach, describe, expect, it } from 'vitest';
import { AccelEngine } from '../engine/engine';
import { useAccelStore } from './accel-store';

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
  });
};

describe('formula fill behavior', () => {
  beforeEach(() => {
    resetStore();
  });

  it('copies formulas with adjusted references when filling vertically', () => {
    const store = useAccelStore.getState();

    store.setCell(1, 1, 1); // A1
    store.setCell(1, 2, 2); // B1
    store.setCell(1, 3, '=A1+B1'); // C1

    store.selectCell(1, 3);
    store.setFillRange(3, 3);
    store.executeFill();

    expect(store.getCellObject(2, 3)?.formula).toBe('=A2+B2');
    expect(store.getCellObject(3, 3)?.formula).toBe('=A3+B3');
  });

  it('keeps cell-like text inside string literals unchanged when filling', () => {
    const store = useAccelStore.getState();

    store.setCell(1, 3, '=LEN("A1")');

    store.selectCell(1, 3);
    store.setFillRange(2, 3);
    store.executeFill();

    expect(store.getCellObject(2, 3)?.formula).toBe('=LEN("A1")');
  });
});
