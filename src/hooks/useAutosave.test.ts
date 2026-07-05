/**
 * Tests for local workbook persistence (loadLocalWorkbook).
 *
 * The autosave hook mirrors a serialized workbook into localStorage under
 * 'radix:workbook:v1' as { title, data }. These tests exercise the load side
 * of that contract by writing the exact persisted shape and asserting a clean
 * round-trip through deserializeEngine, plus rejection of corrupt/oversized
 * payloads. A tiny in-memory localStorage stub keeps the test hermetic (the
 * default Vitest node environment has no DOM storage).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccelEngine } from '../engine/engine';
import { serializeEngine, deserializeEngine, SerializedWorkbook } from '../engine/serialization';
import { loadLocalWorkbook } from './useAutosave';

const LOCAL_KEY = 'radix:workbook:v1';

/** Minimal, deterministic localStorage stub backed by a Map. */
function makeLocalStorageStub() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
}

/** Write a workbook in the exact shape saveLocalWorkbook would produce. */
function persist(title: string, wb: SerializedWorkbook) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify({ title, data: wb }));
}

let originalLocalStorage: PropertyDescriptor | undefined;

beforeEach(() => {
  originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    value: makeLocalStorageStub(),
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  if (originalLocalStorage) {
    Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
  } else {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  }
  vi.restoreAllMocks();
});

describe('loadLocalWorkbook', () => {
  it('round-trips a persisted workbook (values, formulas, format, params, graphs)', () => {
    const engine = new AccelEngine();
    engine.setCell(1, 1, 5);
    engine.setCell(1, 2, '=A1*2');
    engine.formatCell(2, 1, { bold: true, fontColor: '#ff0000' });
    engine.setParameter(3, 1, 0, 10, 0.5);
    engine.addGraph('g1', 'A1 * x + 1');

    persist('My Sheet', serializeEngine(engine));

    const restored = loadLocalWorkbook();
    expect(restored).not.toBeNull();
    expect(restored!.title).toBe('My Sheet');

    const engine2 = deserializeEngine(restored!.data);
    expect(engine2.getCell(1, 1)).toBe(5);
    expect(engine2.getCell(1, 2)).toBe(10);
    expect(engine2.getCellObject(1, 2)?.formula).toBe('=A1*2');
    expect(engine2.getCellObject(2, 1)?.format).toEqual({ bold: true, fontColor: '#ff0000' });
    expect(engine2.getCellObject(3, 1)?.isParameter).toBe(true);
    expect(engine2.getGraphs().map((g) => g.id)).toContain('g1');
  });

  it('round-trips multiple sheets and the active-sheet pointer', () => {
    const engine = new AccelEngine();
    engine.addWorksheet('Data');
    engine.setCell(1, 1, 'hello', 'Data');
    engine.setActiveWorksheet('Data');

    persist('Multi', serializeEngine(engine));

    const restored = loadLocalWorkbook();
    const engine2 = deserializeEngine(restored!.data);
    expect(engine2.getSheetNames().sort()).toEqual(['Data', 'Sheet1'].sort());
    expect(engine2.getActiveSheetName()).toBe('Data');
    expect(engine2.getCell(1, 1, 'Data')).toBe('hello');
  });

  it('falls back to a default title when the persisted title is blank', () => {
    persist('   ', serializeEngine(new AccelEngine()));
    const restored = loadLocalWorkbook();
    expect(restored).not.toBeNull();
    expect(restored!.title).toBe('Untitled workbook');
  });

  it('returns null when nothing is persisted', () => {
    expect(loadLocalWorkbook()).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    localStorage.setItem(LOCAL_KEY, '{ not valid json');
    expect(loadLocalWorkbook()).toBeNull();
  });

  it('returns null when the stored data is not a valid workbook', () => {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ title: 'x', data: { version: 2 } }));
    expect(loadLocalWorkbook()).toBeNull();

    localStorage.setItem(LOCAL_KEY, JSON.stringify({ title: 'x', data: { hello: 'world' } }));
    expect(loadLocalWorkbook()).toBeNull();
  });

  it('rejects an oversized payload instead of loading it', () => {
    // Build a syntactically valid-but-huge record (> 4,000,000 chars).
    const bigTitle = 'x'.repeat(4_000_001);
    localStorage.setItem(
      LOCAL_KEY,
      JSON.stringify({ title: bigTitle, data: serializeEngine(new AccelEngine()) })
    );
    expect(loadLocalWorkbook()).toBeNull();
  });

  it('survives storage throwing (e.g. private-mode getItem)', () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error('storage disabled');
      },
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: throwingStorage,
      configurable: true,
      writable: true,
    });
    expect(loadLocalWorkbook()).toBeNull();
  });
});
