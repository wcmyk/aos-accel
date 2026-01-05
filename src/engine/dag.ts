/**
 * Enhanced DAG (Directed Acyclic Graph) Engine
 * Features:
 * - Node-level dirty tracking
 * - Partial recomputation
 * - Topological execution order
 * - Caching & memoization
 * - Background execution support
 */

import { DAGNode, Block, ExecutionContext } from './types-advanced';

export class DAG {
  private nodes: Map<string, DAGNode> = new Map();
  private executionOrder: string[] = [];
  private needsReorder: boolean = true;

  /**
   * Add a node to the DAG
   */
  addNode(block: Block): void {
    const node: DAGNode = {
      id: block.id,
      block,
      isDirty: true,
      lastComputed: 0,
      computationTime: 0,
      dependencies: new Set(block.dependencies),
      dependents: new Set(block.dependents),
      level: 0,
    };

    this.nodes.set(block.id, node);
    this.needsReorder = true;
  }

  /**
   * Remove a node from the DAG
   */
  removeNode(id: string): void {
    const node = this.nodes.get(id);
    if (!node) return;

    // Remove from dependents
    for (const depId of node.dependencies) {
      const depNode = this.nodes.get(depId);
      if (depNode) {
        depNode.dependents.delete(id);
      }
    }

    // Remove from dependencies
    for (const depId of node.dependents) {
      const depNode = this.nodes.get(depId);
      if (depNode) {
        depNode.dependencies.delete(id);
      }
    }

    this.nodes.delete(id);
    this.needsReorder = true;
  }

  /**
   * Update dependencies for a node
   */
  updateDependencies(id: string, newDependencies: Set<string>): void {
    const node = this.nodes.get(id);
    if (!node) return;

    // Remove old dependency links
    for (const oldDep of node.dependencies) {
      const depNode = this.nodes.get(oldDep);
      if (depNode) {
        depNode.dependents.delete(id);
      }
    }

    // Add new dependency links
    for (const newDep of newDependencies) {
      const depNode = this.nodes.get(newDep);
      if (depNode) {
        depNode.dependents.add(id);
      }
    }

    node.dependencies = newDependencies;
    this.needsReorder = true;
  }

  /**
   * Mark a node as dirty (needs recomputation)
   */
  markDirty(id: string, propagate: boolean = true): void {
    const node = this.nodes.get(id);
    if (!node) return;

    node.isDirty = true;

    // Propagate to dependents
    if (propagate) {
      for (const depId of node.dependents) {
        this.markDirty(depId, true);
      }
    }
  }

  /**
   * Mark a node as clean (computed)
   */
  markClean(id: string): void {
    const node = this.nodes.get(id);
    if (!node) return;

    node.isDirty = false;
    node.lastComputed = Date.now();
  }

  /**
   * Get nodes that need recomputation
   */
  getDirtyNodes(): DAGNode[] {
    return Array.from(this.nodes.values()).filter(node => node.isDirty);
  }

  /**
   * Compute topological order using Kahn's algorithm
   */
  private computeTopologicalOrder(): string[] {
    const inDegree = new Map<string, number>();
    const queue: string[] = [];

    // Initialize in-degrees
    for (const [id, node] of this.nodes) {
      inDegree.set(id, node.dependencies.size);
      if (node.dependencies.size === 0) {
        queue.push(id);
      }
    }

    const order: string[] = [];

    while (queue.length > 0) {
      const id = queue.shift()!;
      order.push(id);

      const node = this.nodes.get(id)!;
      for (const depId of node.dependents) {
        const newDegree = (inDegree.get(depId) || 0) - 1;
        inDegree.set(depId, newDegree);

        if (newDegree === 0) {
          queue.push(depId);
        }
      }
    }

    // Check for cycles
    if (order.length !== this.nodes.size) {
      throw new Error('Cycle detected in dependency graph');
    }

    return order;
  }

  /**
   * Assign topological levels to nodes
   */
  private assignLevels(): void {
    const order = this.computeTopologicalOrder();

    for (const id of order) {
      const node = this.nodes.get(id)!;
      let maxLevel = 0;

      for (const depId of node.dependencies) {
        const depNode = this.nodes.get(depId);
        if (depNode) {
          maxLevel = Math.max(maxLevel, depNode.level + 1);
        }
      }

      node.level = maxLevel;
    }
  }

  /**
   * Get execution order (topological sort)
   */
  getExecutionOrder(): string[] {
    if (this.needsReorder) {
      this.executionOrder = this.computeTopologicalOrder();
      this.assignLevels();
      this.needsReorder = false;
    }

    return this.executionOrder;
  }

  /**
   * Get nodes at a specific level (for parallel execution)
   */
  getNodesAtLevel(level: number): DAGNode[] {
    return Array.from(this.nodes.values()).filter(node => node.level === level);
  }

  /**
   * Get maximum level (depth of DAG)
   */
  getMaxLevel(): number {
    if (this.needsReorder) {
      this.assignLevels();
    }

    let maxLevel = 0;
    for (const node of this.nodes.values()) {
      maxLevel = Math.max(maxLevel, node.level);
    }

    return maxLevel;
  }

  /**
   * Get execution plan (only dirty nodes in topological order)
   */
  getExecutionPlan(): string[] {
    const fullOrder = this.getExecutionOrder();
    const dirtyIds = new Set(this.getDirtyNodes().map(n => n.id));

    return fullOrder.filter(id => dirtyIds.has(id));
  }

  /**
   * Get node by ID
   */
  getNode(id: string): DAGNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Get all nodes
   */
  getAllNodes(): DAGNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalNodes: number;
    dirtyNodes: number;
    maxLevel: number;
    avgComputationTime: number;
  } {
    const dirty = this.getDirtyNodes();
    const totalTime = Array.from(this.nodes.values()).reduce(
      (sum, node) => sum + node.computationTime,
      0
    );

    return {
      totalNodes: this.nodes.size,
      dirtyNodes: dirty.length,
      maxLevel: this.getMaxLevel(),
      avgComputationTime: this.nodes.size > 0 ? totalTime / this.nodes.size : 0,
    };
  }

  /**
   * Check for cycles
   */
  hasCycle(): boolean {
    try {
      this.computeTopologicalOrder();
      return false;
    } catch {
      return true;
    }
  }

  /**
   * Get path between two nodes
   */
  getPath(fromId: string, toId: string): string[] | null {
    const visited = new Set<string>();
    const path: string[] = [];

    const dfs = (current: string): boolean => {
      if (current === toId) {
        path.push(current);
        return true;
      }

      if (visited.has(current)) {
        return false;
      }

      visited.add(current);
      path.push(current);

      const node = this.nodes.get(current);
      if (node) {
        for (const depId of node.dependents) {
          if (dfs(depId)) {
            return true;
          }
        }
      }

      path.pop();
      return false;
    };

    return dfs(fromId) ? path : null;
  }

  /**
   * Get subgraph (node and all its dependencies)
   */
  getSubgraph(id: string): Set<string> {
    const subgraph = new Set<string>();

    const collect = (nodeId: string) => {
      if (subgraph.has(nodeId)) return;

      subgraph.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (node) {
        for (const depId of node.dependencies) {
          collect(depId);
        }
      }
    };

    collect(id);
    return subgraph;
  }

  /**
   * Clear all dirty flags
   */
  clearDirtyFlags(): void {
    for (const node of this.nodes.values()) {
      node.isDirty = false;
    }
  }

  /**
   * Export DAG to JSON
   */
  export(): object {
    const nodes = Array.from(this.nodes.values()).map(node => ({
      id: node.id,
      level: node.level,
      isDirty: node.isDirty,
      dependencies: Array.from(node.dependencies),
      dependents: Array.from(node.dependents),
    }));

    return {
      nodes,
      executionOrder: this.executionOrder,
      stats: this.getStats(),
    };
  }
}

/**
 * Executor - Runs computation in topological order
 */
export class DAGExecutor {
  private dag: DAG;

  constructor(dag: DAG) {
    this.dag = dag;
  }

  /**
   * Execute all dirty nodes
   */
  async execute(
    computeFunction: (block: Block) => Promise<void>,
    context: ExecutionContext = { deterministic: true, precision: 'double' }
  ): Promise<void> {
    const plan = this.dag.getExecutionPlan();

    for (const id of plan) {
      const node = this.dag.getNode(id);
      if (!node) continue;

      const startTime = performance.now();

      await computeFunction(node.block);

      const endTime = performance.now();
      node.computationTime = endTime - startTime;

      this.dag.markClean(id);
    }
  }

  /**
   * Execute with parallel execution at each level
   */
  async executeParallel(
    computeFunction: (block: Block) => Promise<void>,
    context: ExecutionContext = { deterministic: true, precision: 'double', parallel: true }
  ): Promise<void> {
    const maxLevel = this.dag.getMaxLevel();

    for (let level = 0; level <= maxLevel; level++) {
      const nodesAtLevel = this.dag.getNodesAtLevel(level).filter(n => n.isDirty);

      // Execute all nodes at this level in parallel
      await Promise.all(
        nodesAtLevel.map(async (node) => {
          const startTime = performance.now();

          await computeFunction(node.block);

          const endTime = performance.now();
          node.computationTime = endTime - startTime;

          this.dag.markClean(node.id);
        })
      );
    }
  }
}
