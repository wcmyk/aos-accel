# Accel

## Project Overview

Accel is a next-generation computational environment that unifies spreadsheet capabilities with native graphing functionality. Unlike traditional tools that treat charts as visual outputs or graphing as a separate mode, Accel provides a single, coherent calculation engine where data, formulas, and graphs are synchronized representations of the same computational state.

---

# 🧮 Accel — Unified Spreadsheet + Graphing Environment

## Core Definition (Authoritative)

**Accel is not "Excel with charts."**
**Accel is a unified computational environment that fully replaces both Excel *and* Desmos.**

There is **no separation** between:

* Spreadsheet data
* Formulas
* Graphs
* Parameters
* Automation

They are all **first-class views of the same calculation engine**.

---

## Non-Negotiable Product Principle

> **If something can be expressed numerically in Accel, it must be both:**
>
> 1. **Tabular (Excel-like)**
> 2. **Graphable (Desmos-like)**

There is no mode switch between "spreadsheet" and "graphing."
They are synchronized representations of the same state.

---

## What Accel Replaces

| Existing Tool | How Accel Replaces It                                          |
| ------------- | -------------------------------------------------------------- |
| Excel         | Full spreadsheet functionality, formulas, tables, automation   |
| Desmos        | Native, reactive, parametric graphing tied directly to cells   |
| Excel Charts  | **Explicitly superseded** (snapshot charts are not acceptable) |

---

## Unified Engine Model

Accel has **one** engine, not two:

```
Single Calculation Engine
────────────────────────
• Cells & Tables
• Formula AST
• Dependency Graph
• Automation Runtime
• Graph View
```

* Graphs do **not** re-parse expressions
* Graphs do **not** maintain their own math logic
* Graphs consume the **same Formula AST** as cells

---

## Required Capabilities (Excel + Desmos Combined)

### 1️⃣ Spreadsheet Capabilities (Excel Parity)

* All Excel 365 formulas (~350–400)
* Dynamic arrays & spill behavior
* Named ranges
* Structured tables
* Conditional formatting
* Large-scale performance (1M+ rows)

---

### 2️⃣ Native Graphing Capabilities (Desmos Parity)

Graphs must support:

* Explicit functions

  ```text
  y = A1 * x + B1
  ```

* Cell-bound parameters (live)

* Multiple curves per graph

* Domain control

* Color & visibility toggles

* Zoom & pan

* Real-time updates

**Graphs update instantly when:**

* Cells change
* Formulas recalc
* Automation runs

---

### 3️⃣ Interactive Parameters (Critical Feature)

Any numeric cell can be:

* Marked as a **slider**
* Given min/max/step
* Used directly in formulas and graphs

This enables:

* Modeling
* Simulation
* Education
* Scenario analysis

This feature is **not optional**.

---

## What Is Explicitly Rejected

❌ Excel-style static charts
❌ Separate "Graphing mode"
❌ Embedded Desmos or third-party math engines
❌ Duplicate parsers or evaluators
❌ Graphs as UI-only artifacts

If graphing is implemented as a plugin or secondary feature, it is considered incorrect.

---

## Automation + Graphing (Must Work Together)

Automation must be able to:

* Change parameters
* Trigger recalculation
* Update graphs
* Export graphs

Example automation use cases:

* Parameter sweeps
* Monte Carlo simulation
* Report generation
* Educational demonstrations

---

## Engineering Rule (Must Be Followed)

> **There must be no value in Accel that can be calculated but not graphed.
> There must be no graph that is not backed by the calculation engine.**

This rule governs architecture decisions.

---

## Summary (for SWE Alignment)

Accel is:

* A **spreadsheet**
* A **graphing calculator**
* A **simulation environment**
* A **computational engine**

All at once.

It should feel natural to:

* Write formulas
* Drag sliders
* Watch graphs respond
* Automate scenarios

Without ever leaving the same environment.

---

# Implementation

This repository contains the **full implementation** of Accel as specified above.

## Architecture

### Core Engine (`src/engine/`)

**Single Unified Calculation Engine:**
- `types.ts` - Core type definitions (Cell, AST, Graph, etc.)
- `parser.ts` - Formula parser (Excel syntax → AST)
- `evaluator.ts` - AST evaluator (executes formulas AND graphs)
- `formulas.ts` - Excel formula library (~50+ functions implemented, extensible to 350-400)
- `dependency-graph.ts` - Dependency tracking for efficient recalculation
- `engine.ts` - Main Accel engine coordinating everything
- `graph-renderer.ts` - Graph rendering using shared AST (NO duplicate parsing)
- `automation.ts` - Automation runtime for scripted scenarios

**Key Architectural Principle:**
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

The same AST is used for BOTH spreadsheet evaluation AND graph rendering.

### UI Components (`src/components/`)

- `SpreadsheetGrid.tsx` - Excel-like grid with formula bar
- `GraphCanvas.tsx` - Real-time graph rendering (HTML5 Canvas)
- `ParameterPanel.tsx` - Interactive sliders for parameters
- `Toolbar.tsx` - Controls for graphs and parameters
- `AutomationPanel.tsx` - Automation script execution

### State Management (`src/store/`)

- `accel-store.ts` - Zustand store with Immer for reactive updates

## Features Implemented

### ✅ Spreadsheet (Excel Parity)

- [x] Cell values (numbers, strings, booleans)
- [x] Formulas with `=` prefix
- [x] Cell references (A1, B2, etc.)
- [x] Range references (A1:B10)
- [x] Dependency tracking
- [x] Automatic recalculation
- [x] Formula bar
- [x] 50+ Excel functions (SUM, AVERAGE, SIN, COS, etc.)
- [x] Extensible formula library (add more easily)

### ✅ Graphing (Desmos Parity)

- [x] Function graphs: `y = f(x)`
- [x] Cell-bound parameters: `y = A1 * x + B1`
- [x] Multiple curves with different colors
- [x] Zoom & pan controls
- [x] Real-time updates when cells change
- [x] Shared AST with spreadsheet (no duplicate parsing)

### ✅ Interactive Parameters

- [x] Mark any cell as parameter
- [x] Min/max/step configuration
- [x] Interactive sliders
- [x] Real-time updates to formulas AND graphs
- [x] Visual indication of parameter cells

### ✅ Automation

- [x] Parameter sweeps
- [x] Loops
- [x] Wait commands
- [x] Batch operations
- [x] Example scripts (Monte Carlo, parameter sweep, etc.)

### ✅ Unified Experience

- [x] No mode switching
- [x] Single calculation engine
- [x] Real-time synchronization
- [x] Formulas and graphs use same syntax
- [x] Changes propagate instantly

## Running the Project

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

Visit `http://localhost:3000` to use Accel.

By default this runs in **local-only mode**: no accounts, nothing persists
across reloads. To enable accounts, save/load, and shareable read-only links:

1. Create a free project at [supabase.com](https://supabase.com).
2. Run [`supabase/schema.sql`](./supabase/schema.sql) in that project's SQL editor.
3. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` from Project Settings → API.
4. Restart `npm run dev`.

Once configured, signed-in users get a workbook dashboard, autosave, and a
"Share" button that generates a read-only `/#/share/:token` link. Sharing a
workbook does not grant edit access, and revoking a share link (via
"Revoke link" in the Share panel) immediately invalidates previously shared
URLs without affecting the workbook's normal `/w/:id` URL.

To enable cloud features on the deployed GitHub Pages build, add
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository secrets
(Settings → Secrets and variables → Actions) — `.github/workflows/deploy.yml`
already passes them through to the build.

## Example Usage

See [EXAMPLES.md](./EXAMPLES.md) for 10 detailed examples demonstrating:
- Linear functions with sliders
- Trigonometric functions
- Quadratic equations
- Statistical analysis
- Multiple curves
- Parameter sweeps
- Monte Carlo simulation
- Physics simulations
- Exponential growth
- Financial modeling

## Testing

Run the test suite:

```bash
npm test
```

Tests verify:
- Core engine functionality
- Formula parsing and evaluation
- Dependency graph correctness
- Graph rendering with cell bindings
- Parameter updates
- Real-time synchronization
- Unified AST usage

## Technology Stack

- **TypeScript** - Type-safe development
- **React** - UI framework
- **Zustand** - State management
- **Vite** - Build tool
- **Vitest** - Testing framework
- **HTML5 Canvas** - Graph rendering

## Non-Goals (Explicitly Rejected)

❌ Static charts (like Excel charts)
❌ Separate graphing mode
❌ Third-party math engines (e.g., embedded Desmos)
❌ Duplicate parsers or evaluators
❌ Plugin-based graphing

## Future Enhancements

- [ ] Complete Excel 365 formula library (350-400 functions)
- [ ] Dynamic arrays & spill behavior
- [ ] Named ranges
- [ ] Parametric graphing (x=f(t), y=g(t))
- [ ] Implicit graphing
- [ ] Scatter plots
- [ ] 3D graphing
- [ ] Touch/gesture support for mobile
- [ ] Graph export (PNG, SVG)
- [x] Workbook save/load (optional Supabase-backed cloud mode; see "Running the Project")
- [ ] Collaborative editing

---
