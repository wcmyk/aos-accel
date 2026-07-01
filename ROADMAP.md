# Radix Advanced Features Roadmap

> Transforming Radix from "Excel + Desmos" into a **scientific computing platform**

## Vision

Radix becomes a **unified computational environment** for:
- Mathematics (calculus, linear algebra, numerical methods)
- Physics (classical, quantum, waves, thermo)
- Statistics (inference, uncertainty propagation, distributions)
- Machine Learning (physics-informed, transparent training)
- Simulations (parameter sweeps, experiments, reproducibility)
- Natural Language → Model generation

---

## Implementation Strategy

### Phase 1: Foundation (Weeks 1-4)
**Core Engine Upgrades**
- ✅ Current: Basic dependency tracking
- 🔄 Enhanced DAG with dirty tracking
- 🔄 Partial recomputation
- 🔄 Value typing system (constant, parameter, derived, measurement)
- 🔄 Vector/matrix blocks
- 🔄 Background execution (Web Workers)

**Mathematics Core**
- 🔄 Vector operations
- 🔄 Matrix operations
- 🔄 Linear algebra (inverse, eigenvalues, SVD)
- 🔄 Units & dimensional analysis

### Phase 2: Advanced Math & Physics (Weeks 5-8)
**Calculus & Differential Operators**
- Gradient, Jacobian, Hessian
- Finite difference schemes
- Numerical integration
- Differential equation solvers

**Physics Models**
- Classical mechanics templates
- Wave equation solver
- Quantum mechanics (TISE)
- Thermodynamics state functions

### Phase 3: Statistics & ML (Weeks 9-12)
**Statistics**
- Distribution objects (not just functions)
- Uncertainty propagation
- Inference (hypothesis tests, confidence intervals)
- Multivariate statistics (PCA, covariance)

**Machine Learning**
- Linear/logistic models
- Loss functions
- Gradient descent optimizer
- Training control with diagnostics

### Phase 4: Simulation & Experiments (Weeks 13-16)
**Experiment System**
- Multi-parameter sweeps
- Batch execution
- Result tables with metadata
- Reproducibility (seeds, snapshots)

**Visualization**
- Heatmaps
- Phase diagrams
- Uncertainty bands
- Animation controls

### Phase 5: Chat Interface (Weeks 17-20)
**Natural Language → Model**
- Intent detection
- Model templates
- IR generation
- Sheet generation with editable blocks

### Phase 6: Export & Interop (Weeks 21-24)
- LaTeX equations
- Python/NumPy code generation
- Report generation
- Citation support

---

## Architecture Changes

### Current Architecture
```
Formula: =A1 * x + B1
    ↓ (parsed once)
   AST
    ↓
┌───┴───┐
│       │
Cell    Graph
Eval    Render
```

### Enhanced Architecture
```
Input (Formula/Matrix/Distribution)
    ↓
  Parser (extended)
    ↓
  AST + Type Info
    ↓
DAG Engine (dirty tracking, partial recompute)
    ↓
┌────────┬────────┬────────┬────────┐
│ Scalar │ Vector │ Matrix │ Solver │
│  Cell  │ Block  │ Block  │ Block  │
└────────┴────────┴────────┴────────┘
    ↓
Execution (main thread or worker)
    ↓
┌────────┬────────┬────────┐
│ Graph  │ Table  │ Viz    │
│ Render │ View   │ Widget │
└────────┴────────┴────────┘
```

---

## Key Principles (Unchanged)

✅ **Single Unified Engine** - No separate math engines
✅ **Everything is Editable** - No black boxes
✅ **Transparency** - Show all assumptions
✅ **Reproducibility** - Deterministic execution
✅ **Performance** - Lazy evaluation, caching, workers

---

## Implementation Priority

### Must Have (Foundation)
1. Enhanced value typing
2. Vector/matrix blocks
3. Linear algebra operations
4. Parameter sweep system
5. Result tables

### Should Have (Core Features)
6. Differential operators
7. Distribution objects
8. Uncertainty propagation
9. Basic ML (linear regression, gradient descent)
10. Advanced visualization

### Nice to Have (Polish)
11. Chat interface
12. Code export
13. Advanced solvers (PDE, optimization)
14. Quantum mechanics templates

---

## File Structure

```
src/
├── engine/
│   ├── types.ts (ENHANCED: value types, blocks)
│   ├── parser.ts (ENHANCED: matrix syntax)
│   ├── evaluator.ts (ENHANCED: operators)
│   ├── dag.ts (NEW: advanced dependency graph)
│   ├── blocks/
│   │   ├── scalar-block.ts
│   │   ├── vector-block.ts
│   │   ├── matrix-block.ts
│   │   ├── solver-block.ts
│   │   └── plot-block.ts
│   ├── math/
│   │   ├── linalg.ts (linear algebra)
│   │   ├── calculus.ts (derivatives, integration)
│   │   ├── units.ts (dimensional analysis)
│   │   └── constants.ts
│   ├── stats/
│   │   ├── distributions.ts (distribution objects)
│   │   ├── inference.ts
│   │   ├── uncertainty.ts
│   │   └── multivariate.ts
│   ├── ml/
│   │   ├── models.ts
│   │   ├── losses.ts
│   │   ├── optimizers.ts
│   │   └── training.ts
│   ├── physics/
│   │   ├── mechanics.ts
│   │   ├── waves.ts
│   │   ├── quantum.ts
│   │   └── thermo.ts
│   └── simulation/
│       ├── sweeps.ts
│       ├── experiments.ts
│       └── results.ts
├── chat/
│   ├── parser.ts (NL → IR)
│   ├── templates.ts
│   └── generator.ts
└── export/
    ├── latex.ts
    ├── python.ts
    └── reports.ts
```

---

## Breaking Changes

### Minimal Breaking Changes
- Existing formulas still work
- Cell references unchanged
- Graph syntax compatible

### New Capabilities
- Matrix literals: `[1, 2; 3, 4]`
- Vector operators: `dot(A, B)`, `cross(A, B)`
- Distribution syntax: `Normal(mu=A1, sigma=A2)`
- Solver blocks: `solve(f(x) = 0, x)`

---

## Next Steps

1. **Implement enhanced type system** (1-2 days)
2. **Add vector/matrix blocks** (3-5 days)
3. **Build linear algebra operations** (1 week)
4. **Create parameter sweep system** (3-5 days)
5. **Add result tables** (2-3 days)

Then iterate through phases 2-6.

---

This roadmap maintains Radix's core vision while expanding it into a **true scientific computing platform**.
