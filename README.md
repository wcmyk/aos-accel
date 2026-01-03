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
