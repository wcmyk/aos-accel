/**
 * Formula parser - converts Excel-like formulas to AST
 * This AST is used by BOTH spreadsheet cells AND graphs
 */

import { ASTNode } from './types';

export class FormulaParser {
  private input: string = '';
  private pos: number = 0;

  parse(formula: string): ASTNode {
    this.input = formula.trim();
    this.pos = 0;

    if (this.input.startsWith('=')) {
      this.input = this.input.substring(1);
    }

    this.input = FormulaParser.expandMathShortcuts(this.input);

    return this.parseExpression();
  }

  /**
   * Convenience math notation, expanded before tokenizing:
   *   e^^      → Euler's number (2.71828…), so  e^^^5  means  e to the 5th
   *   pi       → π (PI() keeps working; only the bare word is replaced)
   * Function names are case-insensitive elsewhere in the parser, so ln(x),
   * log(x), sqrt(x), sin(x)… already work as typed.
   */
  private static expandMathShortcuts(input: string): string {
    let out = '';
    let inString = false;
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (ch === '"') inString = !inString;
      if (!inString) {
        // e^^ → Euler constant (the remaining ^ becomes the power operator)
        if (
          (ch === 'e' || ch === 'E') &&
          input[i + 1] === '^' && input[i + 2] === '^' &&
          !/[A-Za-z0-9_.]/.test(input[i - 1] || '')
        ) {
          out += String(Math.E);
          i += 2;
          continue;
        }
        // bare pi → π (but leave PI( — the function call — untouched)
        if (
          (ch === 'p' || ch === 'P') &&
          (input[i + 1] === 'i' || input[i + 1] === 'I') &&
          !/[A-Za-z0-9_.]/.test(input[i - 1] || '') &&
          !/[A-Za-z0-9_.(]/.test(input[i + 2] || '')
        ) {
          out += String(Math.PI);
          i += 1;
          continue;
        }
      }
      out += ch;
    }
    return out;
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
    // Allow underscores so multi-word function names (SPEED_OF_LIGHT,
    // NORMAL_CDF, LINEAR_REGRESSION, T_TEST, KINETIC_ENERGY, …) tokenize as a
    // single identifier. Without this the lexer stopped at '_', leaving those
    // registered formulas unreachable ("Unknown variable: SPEED").
    while (
      this.pos < this.input.length &&
      (this.isAlpha(this.peek()) || this.isDigit(this.peek()) || this.peek() === '_')
    ) {
      ident += this.consume();
    }

    this.skipWhitespace();

    // Sheet-qualified reference: SheetName!A1 or SheetName!A1:B10. The name is
    // an ordinary identifier (letters, digits, underscores) — generated sheet
    // names (Sheet1, Graph1, Market1) never contain spaces, so quoting isn't
    // needed yet. The cell/range that follows is parsed normally, then stamped
    // with the sheet so the evaluator resolves it against that worksheet.
    if (this.peek() === '!') {
      this.consume(); // '!'
      this.skipWhitespace();
      const ref = this.parseIdentifier();
      if (ref.type === 'cell') {
        ref.ref.sheet = ident;
      } else if (ref.type === 'range') {
        ref.start.sheet = ident;
        ref.end.sheet = ident;
      } else {
        throw new Error(`Expected a cell or range after ${ident}!`);
      }
      return ref;
    }

    // Check if it's a function call
    if (this.peek() === '(') {
      return this.parseFunction(ident);
    }

    // Check if it's a cell reference (e.g., A1, B10 — case-insensitive).
    // The range check MUST happen before returning the cell: bailing out
    // early here left "A1:A5" parsed as just "A1", making every ranged
    // function call (SUM(A1:A10), PLOT(A1:A5), …) a parse error.
    const cellMatch = ident.match(/^([A-Za-z]+)([0-9]+)$/);
    if (cellMatch) {
      const col = this.columnToNumber(cellMatch[1].toUpperCase());
      const row = parseInt(cellMatch[2], 10);

      if (this.peek() === ':') {
        this.consume(); // ':'
        this.skipWhitespace();
        const endCell = this.parseIdentifier();
        if (endCell.type !== 'cell') {
          throw new Error(`Invalid range end after ${ident}:`);
        }
        return {
          type: 'range',
          start: { row, col },
          end: endCell.ref,
        };
      }

      return { type: 'cell', ref: { row, col } };
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
