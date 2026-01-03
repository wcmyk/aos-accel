/**
 * Tests for Accel Engine
 * Ensures unified calculation and graphing work correctly
 */

import { describe, it, expect } from 'vitest';
import { AccelEngine } from '../engine';
import { FormulaParser } from '../parser';

describe('AccelEngine', () => {
  describe('Basic Operations', () => {
    it('should set and get cell values', () => {
      const engine = new AccelEngine();
      engine.setCell(1, 1, 42);
      expect(engine.getCell(1, 1)).toBe(42);
    });

    it('should evaluate simple formulas', () => {
      const engine = new AccelEngine();
      engine.setCell(1, 1, 10);
      engine.setCell(1, 2, 20);
      engine.setCell(1, 3, '=A1 + B1');
      expect(engine.getCell(1, 3)).toBe(30);
    });

    it('should handle formula dependencies', () => {
      const engine = new AccelEngine();
      engine.setCell(1, 1, 5);
      engine.setCell(2, 1, '=A1 * 2');
      engine.setCell(3, 1, '=A2 + 10');

      expect(engine.getCell(2, 1)).toBe(10);
      expect(engine.getCell(3, 1)).toBe(20);

      // Update A1 and check cascade
      engine.setCell(1, 1, 10);
      expect(engine.getCell(2, 1)).toBe(20);
      expect(engine.getCell(3, 1)).toBe(30);
    });
  });

  describe('Excel Functions', () => {
    it('should evaluate SUM function', () => {
      const engine = new AccelEngine();
      engine.setCell(1, 1, 10);
      engine.setCell(2, 1, 20);
      engine.setCell(3, 1, 30);
      engine.setCell(4, 1, '=SUM(A1, A2, A3)');
      expect(engine.getCell(4, 1)).toBe(60);
    });

    it('should evaluate trigonometric functions', () => {
      const engine = new AccelEngine();
      engine.setCell(1, 1, '=SIN(0)');
      engine.setCell(2, 1, '=COS(0)');
      engine.setCell(3, 1, '=PI()');

      expect(engine.getCell(1, 1)).toBe(0);
      expect(engine.getCell(2, 1)).toBe(1);
      expect(engine.getCell(3, 1)).toBeCloseTo(Math.PI);
    });

    it('should evaluate statistical functions', () => {
      const engine = new AccelEngine();
      engine.setCell(1, 1, 10);
      engine.setCell(2, 1, 20);
      engine.setCell(3, 1, 30);
      engine.setCell(4, 1, '=AVERAGE(A1, A2, A3)');
      expect(engine.getCell(4, 1)).toBe(20);
    });
  });

  describe('Parameters', () => {
    it('should create parameters with sliders', () => {
      const engine = new AccelEngine();
      engine.setParameter(1, 1, 0, 10, 0.5);

      const cell = engine.getCellObject(1, 1);
      expect(cell?.isParameter).toBe(true);
      expect(cell?.parameterConfig).toEqual({
        min: 0,
        max: 10,
        step: 0.5,
        showSlider: true,
      });
    });

    it('should update parameter values and trigger recalculation', () => {
      const engine = new AccelEngine();
      engine.setParameter(1, 1, 0, 10, 1);
      engine.setCell(1, 1, 5);
      engine.setCell(2, 1, '=A1 * 2');

      expect(engine.getCell(2, 1)).toBe(10);

      engine.updateParameter(1, 1, 8);
      expect(engine.getCell(1, 1)).toBe(8);
      expect(engine.getCell(2, 1)).toBe(16);
    });
  });

  describe('Graphing', () => {
    it('should add graphs using same AST as formulas', () => {
      const engine = new AccelEngine();
      engine.addGraph('graph1', 'x * 2 + 1');

      const graphs = engine.getGraphs();
      expect(graphs.length).toBe(1);
      expect(graphs[0].formula).toBe('x * 2 + 1');
    });

    it('should evaluate graphs at specific x values', () => {
      const engine = new AccelEngine();
      engine.addGraph('graph1', 'x * 2 + 1');

      expect(engine.evaluateGraph('graph1', 0)).toBe(1);
      expect(engine.evaluateGraph('graph1', 5)).toBe(11);
      expect(engine.evaluateGraph('graph1', -3)).toBe(-5);
    });

    it('should bind graphs to cell values', () => {
      const engine = new AccelEngine();
      engine.setCell(1, 1, 2); // A1 = slope
      engine.setCell(1, 2, 3); // B1 = intercept (row 1, col 2)
      engine.addGraph('graph1', 'A1 * x + B1');

      expect(engine.evaluateGraph('graph1', 0)).toBe(3);
      expect(engine.evaluateGraph('graph1', 5)).toBe(13); // 2*5 + 3

      // Update cell - graph should reflect change
      engine.setCell(1, 1, 5);
      expect(engine.evaluateGraph('graph1', 5)).toBe(28); // 5*5 + 3
    });

    it('should update graphs when parameters change', () => {
      const engine = new AccelEngine();
      engine.setParameter(1, 1, -10, 10, 0.1);
      engine.setCell(1, 1, 2);
      engine.addGraph('graph1', 'A1 * x');

      expect(engine.evaluateGraph('graph1', 3)).toBe(6); // 2*3

      engine.updateParameter(1, 1, 4);
      expect(engine.evaluateGraph('graph1', 3)).toBe(12); // 4*3
    });
  });

  describe('Parser', () => {
    it('should parse arithmetic expressions', () => {
      const parser = new FormulaParser();

      const ast1 = parser.parse('2 + 3');
      expect(ast1.type).toBe('binary');

      const ast2 = parser.parse('x * 2 + 1');
      expect(ast2.type).toBe('binary');
    });

    it('should parse cell references', () => {
      const parser = new FormulaParser();

      const ast = parser.parse('A1 + B2');
      expect(ast.type).toBe('binary');

      if (ast.type === 'binary') {
        expect(ast.left.type).toBe('cell');
        expect(ast.right.type).toBe('cell');
      }
    });

    it('should parse function calls', () => {
      const parser = new FormulaParser();

      const ast = parser.parse('SUM(A1, B1, C1)');
      expect(ast.type).toBe('function');

      if (ast.type === 'function') {
        expect(ast.name).toBe('SUM');
        expect(ast.args.length).toBe(3);
      }
    });
  });

  describe('Integration: Unified Engine', () => {
    it('should demonstrate Excel + Desmos replacement', () => {
      const engine = new AccelEngine();

      // Setup spreadsheet data (Excel part)
      engine.setParameter(1, 1, 0, 10, 0.5); // A1 = amplitude
      engine.setParameter(1, 2, 0, 6.28, 0.1); // B1 = frequency (row 1, col 2)
      engine.setCell(1, 1, 2);
      engine.setCell(1, 2, 1);

      // Create graph using cell references (Desmos part)
      engine.addGraph('sine', 'A1 * SIN(B1 * x)');

      // Verify both work together
      const value = engine.evaluateGraph('sine', Math.PI);
      expect(value).toBeDefined();

      // Change parameter - both spreadsheet AND graph update
      engine.updateParameter(1, 1, 5);
      expect(engine.getCell(1, 1)).toBe(5);

      const newValue = engine.evaluateGraph('sine', Math.PI);
      expect(newValue).not.toBe(value); // Graph reflects new parameter
    });

    it('should handle complex formulas in graphs', () => {
      const engine = new AccelEngine();

      engine.setCell(1, 1, 3); // A1 = a
      engine.setCell(1, 2, 2); // B1 = b (row 1, col 2)
      engine.setCell(1, 3, 1); // C1 = c (row 1, col 3)

      // Quadratic: ax^2 + bx + c
      engine.addGraph('quadratic', 'A1 * POWER(x, 2) + B1 * x + C1');

      expect(engine.evaluateGraph('quadratic', 0)).toBe(1); // c
      expect(engine.evaluateGraph('quadratic', 1)).toBe(6); // 3 + 2 + 1
      expect(engine.evaluateGraph('quadratic', 2)).toBe(17); // 12 + 4 + 1
    });
  });
});
