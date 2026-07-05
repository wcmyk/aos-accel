import { describe, it, expect } from 'vitest';
import { AccelEngine } from '../engine';

describe('cross-sheet references', () => {
  it('reads a single cell from another sheet', () => {
    const e = new AccelEngine();
    e.addWorksheet('Data');
    e.setCell(1, 1, 5, 'Data'); // Data!A1
    e.addWorksheet('Calc');
    e.setCell(1, 1, '=Data!A1 + 10', 'Calc');
    expect(e.getCell(1, 1, 'Calc')).toBe(15);
  });

  it('reads a range from another sheet through a function', () => {
    const e = new AccelEngine();
    e.addWorksheet('Data');
    e.setCell(1, 1, 2, 'Data');
    e.setCell(2, 1, 3, 'Data');
    e.setCell(3, 1, 4, 'Data');
    e.addWorksheet('Calc');
    e.setCell(1, 1, '=SUM(Data!A1:A3)', 'Calc');
    expect(e.getCell(1, 1, 'Calc')).toBe(9);
  });

  it('does not treat a cross-sheet ref as a self-dependency', () => {
    const e = new AccelEngine();
    e.addWorksheet('Data');
    e.setCell(1, 1, 42, 'Data');
    e.addWorksheet('Calc');
    // Calc!A1 references Data!A1 (same col,row) — must not become circular.
    expect(() => e.setCell(1, 1, '=Data!A1', 'Calc')).not.toThrow();
    expect(e.getCell(1, 1, 'Calc')).toBe(42);
  });

  it('resolves against the current sheet when no sheet is qualified', () => {
    const e = new AccelEngine();
    e.setCell(1, 1, 8);
    e.setCell(1, 2, '=A1 * 2'); // B1 on the default sheet
    expect(e.getCell(1, 2)).toBe(16);
  });

  it('falls back gracefully when the referenced sheet is unknown', () => {
    const e = new AccelEngine();
    // Ghost!A1 doesn't exist; the reference resolves to null, not a crash.
    expect(() => e.setCell(1, 1, '=Ghost!A1 + 1')).not.toThrow();
    expect(e.getCell(1, 1)).toBe(1); // null + 1 -> 1
  });
});
