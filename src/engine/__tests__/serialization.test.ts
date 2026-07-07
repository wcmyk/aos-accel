import { describe, it, expect } from 'vitest';
import { AccelEngine } from '../engine';
import { serializeEngine, deserializeEngine } from '../serialization';

describe('workbook serialization', () => {
  it('round-trips formulas, values, formatting, parameters, and graphs', () => {
    const engine = new AccelEngine();
    engine.setCell(1, 1, 5);
    engine.setCell(1, 2, '=A1*2');
    engine.formatCell(2, 1, { bold: true, fontColor: '#ff0000' });
    engine.setParameter(3, 1, 0, 10, 0.5);
    engine.addGraph('g1', 'A1 * x + 1');

    const json = JSON.parse(JSON.stringify(serializeEngine(engine)));
    const restored = deserializeEngine(json);

    expect(restored.getCell(1, 1)).toBe(5);
    expect(restored.getCell(1, 2)).toBe(10);
    expect(restored.getCellObject(1, 2)?.formula).toBe('=A1*2');
    expect(restored.getCellObject(2, 1)?.format).toEqual({ bold: true, fontColor: '#ff0000' });
    expect(restored.getCellObject(3, 1)?.isParameter).toBe(true);
    expect(restored.getCellObject(3, 1)?.parameterConfig).toEqual({ min: 0, max: 10, step: 0.5, showSlider: true });
    expect(restored.getGraphs().map((g) => g.id)).toContain('g1');
  });

  it('round-trips multiple sheets and the active sheet pointer', () => {
    const engine = new AccelEngine();
    engine.addWorksheet('Data');
    engine.setCell(1, 1, 'hello', 'Data');
    engine.setActiveWorksheet('Data');

    const json = JSON.parse(JSON.stringify(serializeEngine(engine)));
    const restored = deserializeEngine(json);

    expect(restored.getSheetNames().sort()).toEqual(['Data', 'Sheet1'].sort());
    expect(restored.getActiveSheetName()).toBe('Data');
    expect(restored.getCell(1, 1, 'Data')).toBe('hello');
  });

  it('round-trips per-sheet freeze panes', () => {
    const engine = new AccelEngine();
    engine.addWorksheet('Data');
    engine.setFreeze(1, 2, 'Sheet1');
    engine.setFreeze(3, 0, 'Data');

    const json = JSON.parse(JSON.stringify(serializeEngine(engine)));
    const restored = deserializeEngine(json);

    expect(restored.getFreeze('Sheet1')).toEqual({ rows: 1, cols: 2 });
    expect(restored.getFreeze('Data')).toEqual({ rows: 3, cols: 0 });
  });

  it('omits freeze for sheets with nothing frozen', () => {
    const engine = new AccelEngine();
    const serialized = serializeEngine(engine);
    expect(serialized.sheets[0].freeze).toBeUndefined();
    // A default (unfrozen) restore still reports zeros.
    const restored = deserializeEngine(JSON.parse(JSON.stringify(serialized)));
    expect(restored.getFreeze('Sheet1')).toEqual({ rows: 0, cols: 0 });
  });

  it('preserves an empty formatted cell with no value', () => {
    const engine = new AccelEngine();
    engine.formatCell(5, 5, { backgroundColor: '#eeeeee' });

    const json = JSON.parse(JSON.stringify(serializeEngine(engine)));
    const restored = deserializeEngine(json);

    const cell = restored.getCellObject(5, 5);
    expect(cell?.value).toBeNull();
    expect(cell?.format).toEqual({ backgroundColor: '#eeeeee' });
  });
});
