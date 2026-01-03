/**
 * Dependency Graph
 * Tracks dependencies between cells for efficient recalculation
 */

import { ASTNode, Cell, CellAddress } from './types';

export class DependencyGraph {
  private cells: Map<string, Cell>;

  constructor(cells: Map<string, Cell>) {
    this.cells = cells;
  }

  /**
   * Extract all cell references from an AST
   */
  extractDependencies(ast: ASTNode): Set<string> {
    const deps = new Set<string>();
    this.extractDepsRecursive(ast, deps);
    return deps;
  }

  private extractDepsRecursive(node: ASTNode, deps: Set<string>): void {
    switch (node.type) {
      case 'cell':
        deps.add(this.cellKey(node.ref.row, node.ref.col));
        break;

      case 'range':
        for (let row = node.start.row; row <= node.end.row; row++) {
          for (let col = node.start.col; col <= node.end.col; col++) {
            deps.add(this.cellKey(row, col));
          }
        }
        break;

      case 'function':
        node.args.forEach((arg) => this.extractDepsRecursive(arg, deps));
        break;

      case 'binary':
        this.extractDepsRecursive(node.left, deps);
        this.extractDepsRecursive(node.right, deps);
        break;

      case 'unary':
        this.extractDepsRecursive(node.arg, deps);
        break;

      // literals and variables don't have dependencies
      case 'literal':
      case 'variable':
        break;
    }
  }

  /**
   * Build dependency links between cells
   */
  buildDependencies(cellKey: string, dependencies: Set<string>): void {
    const cell = this.cells.get(cellKey);
    if (!cell) return;

    // Clear old dependencies
    cell.dependencies.forEach((depKey) => {
      const depCell = this.cells.get(depKey);
      if (depCell) {
        depCell.dependents.delete(cellKey);
      }
    });

    // Set new dependencies
    cell.dependencies = dependencies;

    // Update dependents
    dependencies.forEach((depKey) => {
      const depCell = this.cells.get(depKey);
      if (depCell) {
        depCell.dependents.add(cellKey);
      }
    });
  }

  /**
   * Get all cells that need to be recalculated when a cell changes
   * Returns cells in topological order
   */
  getRecalculationOrder(changedCellKeys: Set<string>): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (cellKey: string) => {
      if (visited.has(cellKey)) return;
      visited.add(cellKey);

      const cell = this.cells.get(cellKey);
      if (!cell) return;

      // Visit dependencies first (depth-first)
      cell.dependencies.forEach((depKey) => {
        visit(depKey);
      });

      result.push(cellKey);
    };

    // Visit all changed cells and their dependents
    const toVisit = new Set(changedCellKeys);
    const addDependents = (cellKey: string) => {
      const cell = this.cells.get(cellKey);
      if (!cell) return;

      cell.dependents.forEach((depKey) => {
        toVisit.add(depKey);
        addDependents(depKey);
      });
    };

    changedCellKeys.forEach((key) => addDependents(key));
    toVisit.forEach((key) => visit(key));

    return result;
  }

  /**
   * Detect circular dependencies
   */
  hasCircularDependency(cellKey: string): boolean {
    const visited = new Set<string>();
    const stack = new Set<string>();

    const hasCycle = (key: string): boolean => {
      if (stack.has(key)) return true;
      if (visited.has(key)) return false;

      visited.add(key);
      stack.add(key);

      const cell = this.cells.get(key);
      if (cell) {
        for (const depKey of cell.dependencies) {
          if (hasCycle(depKey)) return true;
        }
      }

      stack.delete(key);
      return false;
    };

    return hasCycle(cellKey);
  }

  private cellKey(row: number, col: number): string {
    return `${col},${row}`;
  }
}
