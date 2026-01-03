/**
 * Formula parser - converts Excel-like formulas to AST
 * This AST is used by BOTH spreadsheet cells AND graphs
 */

import { ASTNode, CellAddress } from './types';

export class FormulaParser {
  private input: string = '';
  private pos: number = 0;

  parse(formula: string): ASTNode {
    this.input = formula.trim();
    this.pos = 0;

    if (this.input.startsWith('=')) {
      this.input = this.input.substring(1);
    }

    return this.parseExpression();
  }

  private parseExpression(): ASTNode {
    return this.parseAdditive();
  }

  private parseAdditive(): ASTNode {
    let left = this.parseMultiplicative();

    while (this.pos < this.input.length) {
      this.skipWhitespace();
      const char = this.peek();

      if (char === '+' || char === '-') {
        const op = this.consume();
        const right = this.parseMultiplicative();
        left = { type: 'binary', op, left, right };
      } else {
        break;
      }
    }

    return left;
  }

  private parseMultiplicative(): ASTNode {
    let left = this.parsePower();

    while (this.pos < this.input.length) {
      this.skipWhitespace();
      const char = this.peek();

      if (char === '*' || char === '/') {
        const op = this.consume();
        const right = this.parsePower();
        left = { type: 'binary', op, left, right };
      } else {
        break;
      }
    }

    return left;
  }

  private parsePower(): ASTNode {
    let left = this.parseUnary();

    while (this.pos < this.input.length) {
      this.skipWhitespace();
      const char = this.peek();

      if (char === '^') {
        const op = this.consume();
        const right = this.parseUnary();
        left = { type: 'binary', op, left, right };
      } else {
        break;
      }
    }

    return left;
  }

  private parseUnary(): ASTNode {
    this.skipWhitespace();
    const char = this.peek();

    if (char === '-' || char === '+') {
      const op = this.consume();
      const arg = this.parseUnary();
      return { type: 'unary', op, arg };
    }

    return this.parsePrimary();
  }

  private parsePrimary(): ASTNode {
    this.skipWhitespace();
    const char = this.peek();

    // Parentheses
    if (char === '(') {
      this.consume();
      const expr = this.parseExpression();
      this.skipWhitespace();
      if (this.peek() !== ')') {
        throw new Error('Expected closing parenthesis');
      }
      this.consume();
      return expr;
    }

    // Numbers
    if (this.isDigit(char) || char === '.') {
      return this.parseNumber();
    }

    // Strings
    if (char === '"') {
      return this.parseString();
    }

    // Functions, cell references, or variables
    if (this.isAlpha(char)) {
      return this.parseIdentifier();
    }

    throw new Error(`Unexpected character: ${char}`);
  }

  private parseNumber(): ASTNode {
    let numStr = '';
    while (this.pos < this.input.length && (this.isDigit(this.peek()) || this.peek() === '.')) {
      numStr += this.consume();
    }
    return { type: 'literal', value: parseFloat(numStr) };
  }

  private parseString(): ASTNode {
    this.consume(); // opening quote
    let str = '';
    while (this.pos < this.input.length && this.peek() !== '"') {
      str += this.consume();
    }
    this.consume(); // closing quote
    return { type: 'literal', value: str };
  }

  private parseIdentifier(): ASTNode {
    let ident = '';
    while (this.pos < this.input.length && (this.isAlpha(this.peek()) || this.isDigit(this.peek()))) {
      ident += this.consume();
    }

    this.skipWhitespace();

    // Check if it's a function call
    if (this.peek() === '(') {
      return this.parseFunction(ident);
    }

    // Check if it's a cell reference (e.g., A1, B10)
    const cellMatch = ident.match(/^([A-Z]+)([0-9]+)$/);
    if (cellMatch) {
      const col = this.columnToNumber(cellMatch[1]);
      const row = parseInt(cellMatch[2], 10);
      return { type: 'cell', ref: { row, col } };
    }

    // Check for range (e.g., A1:B10)
    if (this.peek() === ':') {
      this.consume(); // ':'
      const endCell = this.parseIdentifier();
      if (endCell.type === 'cell') {
        const startMatch = ident.match(/^([A-Z]+)([0-9]+)$/);
        if (startMatch) {
          const startCol = this.columnToNumber(startMatch[1]);
          const startRow = parseInt(startMatch[2], 10);
          return {
            type: 'range',
            start: { row: startRow, col: startCol },
            end: endCell.ref,
          };
        }
      }
    }

    // Otherwise, treat as variable (for graphing: x, y, etc.)
    return { type: 'variable', name: ident };
  }

  private parseFunction(name: string): ASTNode {
    this.consume(); // '('
    const args: ASTNode[] = [];

    this.skipWhitespace();
    if (this.peek() !== ')') {
      args.push(this.parseExpression());

      while (this.peek() === ',') {
        this.consume(); // ','
        args.push(this.parseExpression());
      }
    }

    this.skipWhitespace();
    if (this.peek() !== ')') {
      throw new Error('Expected closing parenthesis in function call');
    }
    this.consume(); // ')'

    return { type: 'function', name: name.toUpperCase(), args };
  }

  private columnToNumber(col: string): number {
    let num = 0;
    for (let i = 0; i < col.length; i++) {
      num = num * 26 + (col.charCodeAt(i) - 64);
    }
    return num;
  }

  private peek(): string {
    return this.input[this.pos] || '';
  }

  private consume(): string {
    return this.input[this.pos++] || '';
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      this.pos++;
    }
  }

  private isDigit(char: string): boolean {
    return /[0-9]/.test(char);
  }

  private isAlpha(char: string): boolean {
    return /[A-Za-z]/.test(char);
  }
}
