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

describe('range fill, clear, and selection', () => {
  beforeEach(() => {
    resetStore();
  });

  const selectRange = (r1: number, c1: number, r2: number, c2: number) => {
    const store = useAccelStore.getState();
    store.startSelection(r1, c1);
    store.updateSelection(r2, c2);
    store.endSelection();
  };

  it('extends a numeric run as a linear series', () => {
    const store = useAccelStore.getState();
    store.setCell(1, 1, 5);
    store.setCell(2, 1, 10);
    selectRange(1, 1, 2, 1);
    store.setFillRange(5, 1);
    store.executeFill();
    expect([3, 4, 5].map((r) => store.getCell(r, 1))).toEqual([15, 20, 25]);
  });

  it('fills every column of a multi-column block', () => {
    const store = useAccelStore.getState();
    store.setCell(1, 1, 1);
    store.setCell(2, 1, 2);
    store.setCell(1, 2, 'x');
    store.setCell(2, 2, 'y');
    selectRange(1, 1, 2, 2);
    store.setFillRange(4, 1);
    store.executeFill();
    expect([store.getCell(3, 1), store.getCell(4, 1)]).toEqual([3, 4]);
    // Non-numeric blocks repeat.
    expect([store.getCell(3, 2), store.getCell(4, 2)]).toEqual(['x', 'y']);
  });

  it('selects the filled block after filling', () => {
    const store = useAccelStore.getState();
    store.setCell(1, 1, 1);
    store.selectCell(1, 1);
    store.setFillRange(3, 1);
    store.executeFill();
    expect(useAccelStore.getState().selectionRange).toEqual({ start: { row: 1, col: 1 }, end: { row: 3, col: 1 } });
  });

  it('fills day names upward without a negative index', () => {
    const store = useAccelStore.getState();
    store.setCell(3, 1, 'Monday');
    store.selectCell(3, 1);
    store.setFillRange(1, 1);
    store.executeFill();
    expect([store.getCell(2, 1), store.getCell(1, 1)]).toEqual(['Sunday', 'Saturday']);
  });

  it('clearRange empties a block in one undo step', () => {
    const store = useAccelStore.getState();
    store.setCell(1, 1, 1);
    store.setCell(2, 1, 2);
    const before = useAccelStore.getState().undoStack.length;
    store.clearRange(1, 1, 2, 1);
    expect(store.getCell(1, 1) || null).toBeNull();
    expect(store.getCell(2, 1) || null).toBeNull();
    expect(useAccelStore.getState().undoStack.length).toBe(before + 1);
    useAccelStore.getState().undo();
    expect(useAccelStore.getState().getCell(2, 1)).toBe(2);
  });

  it('selectCell drops a stale range selection', () => {
    selectRange(1, 1, 3, 3);
    useAccelStore.getState().selectCell(5, 5);
    expect(useAccelStore.getState().selectionRange).toBeNull();
  });
});
