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

  it('increments a single numeric source cell (behavior unchanged)', () => {
    const store = useAccelStore.getState();
    store.setCell(1, 1, 5); // A1

    store.selectCell(1, 1);
    store.setFillRange(3, 1);
    store.executeFill();

    expect(store.getCell(2, 1)).toBe(6);
    expect(store.getCell(3, 1)).toBe(7);
  });
});

describe('two-cell series fill', () => {
  beforeEach(() => {
    resetStore();
  });

  const selectRange = (r1: number, c1: number, r2: number, c2: number) => {
    const store = useAccelStore.getState();
    store.startSelection(r1, c1);
    store.updateSelection(r2, c2);
    store.endSelection();
  };

  it('extends a vertical numeric series by the common difference', () => {
    const store = useAccelStore.getState();
    store.setCell(1, 3, 1); // C1
    store.setCell(2, 3, 2); // C2

    selectRange(1, 3, 2, 3);
    store.setFillRange(5, 3); // drag down to C5
    store.executeFill();

    expect(store.getCell(3, 3)).toBe(3);
    expect(store.getCell(4, 3)).toBe(4);
    expect(store.getCell(5, 3)).toBe(5);
  });

  it('honors a non-unit step (5,10 -> 15,20,25)', () => {
    const store = useAccelStore.getState();
    store.setCell(1, 1, 5);
    store.setCell(1, 2, 10);

    selectRange(1, 1, 1, 2);
    store.setFillRange(1, 5); // drag right to E1
    store.executeFill();

    expect(store.getCell(1, 3)).toBe(15);
    expect(store.getCell(1, 4)).toBe(20);
    expect(store.getCell(1, 5)).toBe(25);
  });

  it('extends a series upward when dragging above the selection', () => {
    const store = useAccelStore.getState();
    store.setCell(5, 1, 10); // A5
    store.setCell(6, 1, 20); // A6

    selectRange(5, 1, 6, 1);
    store.setFillRange(3, 1); // drag up to A3
    store.executeFill();

    expect(store.getCell(4, 1)).toBe(0);   // 10 - 10
    expect(store.getCell(3, 1)).toBe(-10); // 0 - 10
  });

  it('falls back to pattern-repeat for non-numeric selections', () => {
    const store = useAccelStore.getState();
    store.setCell(1, 1, 'Mon');
    store.setCell(2, 1, 'Tue');

    selectRange(1, 1, 2, 1);
    store.setFillRange(4, 1);
    store.executeFill();

    // Not a numeric series: continue from the facing edge cell ("Tue").
    expect(store.getCell(3, 1)).toBe('Wed');
    expect(store.getCell(4, 1)).toBe('Thu');
  });

  it('participates in undo (a filled series reverts in one step)', () => {
    const store = useAccelStore.getState();
    store.setCell(1, 3, 1);
    store.setCell(2, 3, 2);

    selectRange(1, 3, 2, 3);
    store.setFillRange(5, 3);
    store.executeFill();
    expect(store.getCell(4, 3)).toBe(4);

    useAccelStore.getState().undo();
    expect(store.getCell(4, 3)).toBe(null);
    // The source cells survive the undo.
    expect(store.getCell(2, 3)).toBe(2);
  });
});
