/**
 * AST Evaluator
 * Executes AST nodes for both spreadsheet formulas AND graph functions
 */

import { ASTNode, CellValue, Worksheet } from './types';
import { FORMULAS } from './formulas';

export class Evaluator {
  private worksheet: Worksheet;
  private graphContext?: { x?: number; y?: number; t?: number };

  constructor(worksheet: Worksheet) {
    this.worksheet = worksheet;
  }

  evaluate(node: ASTNode, context?: { x?: number; y?: number; t?: number }): CellValue {
    this.graphContext = context;
    return this.evaluateNode(node);
  }

  private evaluateNode(node: ASTNode): CellValue {
    switch (node.type) {
      case 'literal':
        return node.value;

      case 'cell': {
        const cellKey = this.cellKey(node.ref.row, node.ref.col);
        const cell = this.worksheet.cells.get(cellKey);
        return cell?.value ?? null;
      }

      case 'range': {
        const values: CellValue[] = [];
        for (let row = node.start.row; row <= node.end.row; row++) {
          const rowValues: CellValue[] = [];
          for (let col = node.start.col; col <= node.end.col; col++) {
            const cellKey = this.cellKey(row, col);
            const cell = this.worksheet.cells.get(cellKey);
            rowValues.push(cell?.value ?? null);
          }
          values.push(rowValues);
        }
        return values;
      }

      case 'variable': {
        // For graphing: x, y, t variables
        if (this.graphContext) {
          const varName = node.name.toLowerCase();
          if (varName === 'x' && this.graphContext.x !== undefined) {
            return this.graphContext.x;
          }
          if (varName === 'y' && this.graphContext.y !== undefined) {
            return this.graphContext.y;
          }
          if (varName === 't' && this.graphContext.t !== undefined) {
            return this.graphContext.t;
          }
        }

        // Check named ranges
        const namedRange = this.worksheet.namedRanges.get(node.name);
        if (namedRange) {
          return this.evaluateNode({
            type: 'range',
            start: namedRange.start,
            end: namedRange.end,
          });
        }

        throw new Error(`Unknown variable: ${node.name}`);
      }

      case 'function': {
        const func = FORMULAS[node.name];
        if (!func) {
          throw new Error(`Unknown function: ${node.name}`);
        }

        const args = node.args.map((arg) => this.evaluateNode(arg));
        return func(...args);
      }

      case 'binary': {
        const left = this.evaluateNode(node.left);
        const right = this.evaluateNode(node.right);

        switch (node.op) {
          case '+':
            return this.toNumber(left) + this.toNumber(right);
          case '-':
            return this.toNumber(left) - this.toNumber(right);
          case '*':
            return this.toNumber(left) * this.toNumber(right);
          case '/': {
            const divisor = this.toNumber(right);
            if (divisor === 0) throw new Error('Division by zero');
            return this.toNumber(left) / divisor;
          }
          case '^':
            return Math.pow(this.toNumber(left), this.toNumber(right));
          case '=':
            return left === right;
          case '<>':
            return left !== right;
          case '<':
            return this.toNumber(left) < this.toNumber(right);
          case '>':
            return this.toNumber(left) > this.toNumber(right);
          case '<=':
            return this.toNumber(left) <= this.toNumber(right);
          case '>=':
            return this.toNumber(left) >= this.toNumber(right);
          case '&':
            return String(left) + String(right);
          default:
            throw new Error(`Unknown binary operator: ${node.op}`);
        }
      }

      case 'unary': {
        const arg = this.evaluateNode(node.arg);

        switch (node.op) {
          case '-':
            return -this.toNumber(arg);
          case '+':
            return this.toNumber(arg);
          default:
            throw new Error(`Unknown unary operator: ${node.op}`);
        }
      }

      default:
        throw new Error(`Unknown node type: ${(node as unknown as { type: string }).type}`);
    }
  }

  private toNumber(value: CellValue): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? 0 : num;
    }
    if (value === null) return 0;
    if (Array.isArray(value)) {
      return value.length > 0 ? this.toNumber(value[0]) : 0;
    }
    return 0;
  }

  private cellKey(row: number, col: number): string {
    return `${col},${row}`;
  }
}
