# Tessera

Tessera is a unified computational workspace that puts a **spreadsheet**, a
**live function graph**, **cell-bound slider parameters**, and a **live
market-data panel** on top of a single calculation engine. Type a formula,
mark a cell as a slider, and watch the grid, the graph, and the stats update
together — no mode switching, no separate "chart object," no second math
engine.

The core idea: **anything you can compute in a cell, you can graph; every
graph is backed by the same engine that evaluates your cells.** Formulas are
parsed once into an AST that both the grid and the graph renderer consume.

> Tessera is an early, focused tool (v0.1). It does a specific loop well. It is
> **not** a drop-in Excel or Desmos replacement — see
> [Honest limits](#honest-limits) below.

---

## The core loop

1. Put numbers and formulas in the grid (`=A1*2`, `=AVERAGE(A1:A10)`, …).
2. Mark a numeric cell as a **parameter** and give it a min / max / step.
3. Add a **graph** that references those cells: `A1 * x + B1`.
4. **Drag the slider.** The cell recalculates, dependent cells recalculate,
   and the graph redraws in the same pass.

The status bar shows live Average / Count / Sum for the current selection, so
the sheet doubles as a quick calculator.

---

## What's actually here

### Spreadsheet
- A **1000-row × 52-column (A–AZ)** grid with virtualized rendering.
- Formula bar, `=`-prefixed formulas, cell references (`A1`), and ranges
  (`A1:B10`).
- Dependency tracking with automatic recalculation and circular-reference
  detection.
- **~150 formula functions** (counted in `src/engine/formulas.ts`): math,
  statistics, text, logic, lookup (`VLOOKUP`/`HLOOKUP`/`INDEX`/`MATCH`),
  finance (`PV`/`FV`/`NPV`/`IRR`/`PMT`), matrix ops (`MMULT`/`MINVERSE`/
  `MDETERM`/`TRANSPOSE`), plus a reachable slice of scientific functions
  (mechanics, quantum, linear algebra, distributions, inference).
- Cut / copy / paste, fill, column sort, insert/delete row & column,
  per-cell formatting, resizable columns, and **CSV export**.
- Multiple sheets via bottom tabs.
- **Undo / redo** — Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y (history bounded to
  100 steps).

### Graphing
- **Explicit function graphs**: `y = A1 * x + B1`, `SIN(x)`, `A1*POWER(x,2)`.
- Cell-bound parameters — graphs update live when referenced cells change.
- Multiple curves, per-series color and visibility toggles, zoom & pan.
- **Plot Selection** (Graphing tab): plot selected cells directly — one column
  plots as a series, two columns plot as x/y pairs. Edit the cells and the
  plot follows.
- Graphs share the spreadsheet's parsed AST — no duplicate parser, no second
  math engine.

### Interactive parameters
- Mark any numeric cell as a slider with min / max / step.
- Dragging recalculates cells, selection stats, and graphs in one pass
  (drag updates are debounced/coalesced so large sheets stay responsive).

### Automation (basic)
- A small scripted-scenario runner (Automation tab): `set-cell`,
  `set-parameter`, `sweep`, `loop`, `wait`, and `export-graph` steps.
- Ships three example scripts: Parameter Sweep, Monte Carlo Simulation, and
  Animated Graph.

### Market data
- A stock-app-style **Market** panel: watchlist (add/toggle/remove tickers,
  each chip shows last price and day change), timeframe switching
  (1M/3M/6M/1Y/5Y/All, served from a per-ticker cache), a dated hover
  crosshair, trend-colored line with area fill, and automatic %-change
  comparison when several tickers are visible.
- The `STOCK()` formula pulls the same data into the engine, so market series
  can be summed, averaged, plotted, and bound to sliders like any other data.

---

## Quickstart

```bash
npm install
npm run dev      # opens on http://localhost:3000
npm test         # run the Vitest suite
npm run build    # type-check + production build
```

Out of the box Tessera runs in **local-only mode**: no account required. Your
workbook is autosaved to `localStorage` (key `radix:workbook:v1`) so it
survives reloads on the same browser. A first-run welcome overlay walks you
through the core loop; a crash guard offers Reload / Reset if anything throws.

---

## Live market data (`STOCK` formula)

```text
=STOCK("AAPL")                  → last 90 daily closes (array)
=STOCK("AAPL", "close", B2)     → closes for the last B2 days
=STOCK("AAPL", "price")         → latest close (single number)
=PLOT(STOCK(B1, "close", B2))   → live chart driven by cells B1 and B2
```

Fields: `close` (default), `open`, `high`, `low`, `volume`, `price`.
`MARKETDAYS()` returns the Market chart's active timeframe as a formula, so
clicking 1M/1Y on the chart recalculates every cell built on it.

Setup: get a free key at [polygon.io](https://polygon.io), copy
`.env.example` to `.env`, and set `VITE_STOCK_API_KEY=your_key`. Without a key
(or if the API is unreachable) `STOCK()` falls back to **deterministic
synthetic demo data**, so workbooks stay functional offline — the Market panel
labels which tickers are synthetic.

> Any key shipped in a client-side bundle is visible to visitors. Use a
> rotatable free-tier key, or proxy requests through your own backend for
> production.

---

## Optional cloud mode (accounts, save/load, sharing)

Cloud features are **off by default** and require a free Supabase project:

1. Create a project at [supabase.com](https://supabase.com).
2. Run [`supabase/schema.sql`](./supabase/schema.sql) in its SQL editor.
3. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
4. Restart `npm run dev`.

Once configured, signed-in users get a workbook dashboard, cloud autosave, and
a **Share** button that mints a read-only `/#/share/:token` link. Sharing does
not grant edit access, and "Revoke link" invalidates a shared URL immediately.
Note: sharing serves a read-only snapshot; there is no live multi-user
co-editing, and concurrent edits from two devices are last-writer-wins.

For the deployed GitHub Pages build, add `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, and `VITE_STOCK_API_KEY` as Actions repository
secrets — `.github/workflows/deploy.yml` passes them through.

---

## How the pieces connect

- **Sheet → Market**: `=STOCK("TSLA", …)` in any cell adds TSLA to the Market
  watchlist automatically — the chart tracks the symbols your workbook uses.
- **Market → Sheet**: `MARKETDAYS()` exposes the chart's active timeframe as a
  formula; each watchlist ticker has a **→Sheet** button that drops in a live
  stats block wired to that timeframe.
- **Selection → Graph**: select cells and hit **Plot Selection** for a
  live-bound plot.
- **Parameters ↔ everything**: sliders sit beside the graphs; dragging one
  recalculates cells, stats, and plots at once.

---

## Architecture

```
src/
├── engine/
│   ├── types.ts           Core types (Cell, AST, GraphDefinition, …)
│   ├── parser.ts          Formula parser (Excel-style syntax → AST)
│   ├── evaluator.ts       AST evaluator (cells AND graphs)
│   ├── formulas.ts        ~150-function formula library
│   ├── dependency-graph.ts Dependency tracking + recalculation
│   ├── engine.ts          Coordinates cells, deps, sheets, CSV
│   ├── graph-renderer.ts  Graph sampling from the shared AST
│   ├── automation.ts      Scripted-scenario runner
│   ├── stock-data.ts      Market data + synthetic fallback
│   ├── serialization.ts   Workbook (de)serialization + validation
│   ├── math/ · stats/ · physics/   Scientific formula backing
│   └── ...
├── components/            Grid, GraphCanvas, ParameterPanel, Ribbon,
│                          StockPanel, error boundary, onboarding, …
├── store/                 Zustand + Immer store (accel-store.ts)
├── hooks/                 Local + cloud autosave
└── lib/                   Supabase client + workbooks API
```

The same parsed AST drives both cell evaluation and graph rendering:

```
Formula: =A1 * x + B1
    │ parsed once
    ▼
   AST ──┬── Cell evaluation
         └── Graph rendering
```

---

## Honest limits

Tessera does its core loop well, but it is deliberately scoped:

- **Not full Excel.** ~150 functions, not the ~400+ of Excel 365. No dynamic
  arrays / spill, no named ranges, no conditional formatting, no pivot tables,
  no VBA/macros. The grid is 1000 × 52, not "1M rows."
- **Not full Desmos.** Graphing supports explicit `y = f(x)` functions and data
  plots only — no parametric, implicit, polar, scatter, or 3D graphing yet
  (the type system reserves those, but they aren't wired).
- **Single-user.** Local-only by default; cloud mode adds accounts, autosave,
  and read-only share links, but not live collaborative editing.
- **Client-side market data.** `STOCK()` uses a client-side API key and falls
  back to synthetic data offline; not intended as a market-data source of
  record.

See [ROADMAP.md](./ROADMAP.md) for what's planned next and
[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for what's done today.

---

## Tech stack

React 18 · TypeScript (strict) · Zustand + Immer · Vite · Vitest ·
HTML5 Canvas. Optional: Supabase (cloud), polygon.io (market data).

## Examples

See [EXAMPLES.md](./EXAMPLES.md) for ten worked walkthroughs — every example
uses formulas and features that work in the app today.
