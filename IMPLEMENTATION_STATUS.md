# Radix Implementation Status

Honest snapshot of what ships today (v0.1) vs. what's genuinely still TODO.
Earlier versions of this file claimed a "scientific computing platform" with
ML, ODE/PDE solvers, uncertainty propagation, and parameter-sweep experiment
systems. Those modules were **removed** during de-sprawl because they were not
reachable from the app. This file now reflects the actual shipped product.

**Last updated:** 2026-07-05 · **Overall:** the core loop is complete and
stable; remaining work is breadth (more formulas, more graph types) and polish.

---

## ✅ Done and working

### Spreadsheet engine
- ✅ Formula parser (Excel-style syntax → AST)
- ✅ Evaluator shared by both cells and graphs (single engine)
- ✅ ~150 formula functions (`src/engine/formulas.ts`) — math, stats, text,
  logic, lookup, finance, matrix ops, and a reachable scientific slice
  (mechanics, quantum, linear algebra, distributions, inference)
- ✅ Dependency graph with topological recalculation
- ✅ Circular-reference detection (`#CIRC`) and Excel-style error tokens
- ✅ Cut/copy/paste, fill, column sort, insert/delete row & column
- ✅ Per-cell formatting, resizable columns, CSV export
- ✅ Multiple sheets (bottom tabs)
- ✅ Undo / redo (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y), history bounded to 100

### Grid UI
- ✅ 1000 × 52 (A–AZ) virtualized grid
- ✅ Formula bar, in-cell editing, reference highlighting
- ✅ `#ERROR!` badges with full-message tooltips
- ✅ Status bar: live Average / Count / Sum for the selection

### Graphing
- ✅ Explicit function graphs `y = f(x)` with cell-bound parameters
- ✅ Multiple curves, per-series color + visibility toggles, zoom & pan
- ✅ Real-time updates when referenced cells change
- ✅ Plot Selection (`PLOT`) — 1 column as a series, 2 columns as x/y
- ✅ Discontinuity handling; graph render cache keyed on cell versions

### Interactive parameters
- ✅ Mark any numeric cell as a slider (min / max / step)
- ✅ Drag updates cells, stats, and graphs in one pass
- ✅ Drag commits are debounced/coalesced for responsiveness

### Automation (basic)
- ✅ Scripted runner: `set-cell`, `set-parameter`, `sweep`, `loop`, `wait`,
  `export-graph`
- ✅ Example scripts: Parameter Sweep, Monte Carlo, Animated Graph

### Market data
- ✅ Market panel: watchlist, timeframes (cached), hover crosshair, trend line,
  multi-ticker %-change comparison
- ✅ `STOCK()` formula + `MARKETDAYS()`; per-ticker live/synthetic status
- ✅ Deterministic synthetic fallback when offline / no API key

### State, persistence, and safety
- ✅ Zustand + Immer store
- ✅ Local autosave to `localStorage` with structural validation on load
- ✅ Optional Supabase cloud: auth, dashboard, autosave, read-only share links
- ✅ Root error boundary (Reload / Reset workbook) + first-run welcome overlay

### Build & CI
- ✅ Vite build, Vitest suite (36 tests passing), ESLint
- ✅ GitHub Actions CI (build + test + lint) and Pages deploy

---

## 🚧 Genuinely TODO

### Spreadsheet breadth
- ⏳ More formula functions toward broader Excel coverage
- ⏳ Dynamic arrays / spill ranges
- ⏳ Named ranges
- ⏳ Conditional formatting
- ⏳ CSV / Excel import (export is CSV-only today)

### Graphing
- ⏳ Parametric plots (`x=f(t), y=g(t)`)
- ⏳ Implicit / contour plots
- ⏳ Scatter plots and 3D surfaces
- ⏳ Click-to-trace, PNG/SVG graph export

### Collaboration & persistence
- ⏳ Live multi-user co-editing (share links are read-only snapshots today)
- ⏳ Server-side conflict detection (cloud saves are last-writer-wins)
- ⏳ Column-width persistence (widths are currently component-local)

---

## Removed (intentionally cut, not planned)

The following modules were deleted because nothing in the running app imported
them. Do not reference them in docs, tests, or new features:

- `ml/models.ts`, `ml/optimizers.ts` (regression, neural nets, optimizers)
- `solvers/ode.ts`, `solvers/pde.ts`
- `simulation/sweeps.ts`, `stats/uncertainty.ts`
- `physics/waves.ts`, `physics/thermodynamics.ts`
- `dag.ts` (DAGExecutor)
- The `DERIVATIVE()` formula (was a non-functional stub — use `INTEGRATE` or
  cell-based numeric differences)

The scientific formulas that remain reachable (mechanics, quantum, linalg,
distributions, inference) are still exported via `FORMULAS` and work.
