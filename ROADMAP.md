# Radix Roadmap

An honest, near-term plan. Radix v0.1 does one thing well: a spreadsheet, a
live function graph, cell-bound sliders, and a market panel over a single
engine. This roadmap grows the breadth and polish of that core loop — it is
not a plan to become a full scientific-computing platform. (An earlier version
of this file described a 24-week program for ML, ODE/PDE solvers, uncertainty
propagation, a chat-to-model interface, and LaTeX/Python export. That was
aspiration, not commitment; those modules were removed and are not planned.)

For what already ships, see [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md).

---

## Now (shipped in v0.1)

Spreadsheet (1000×52, ~150 functions, undo/redo, sort, formatting, CSV,
multi-sheet) · function graphs with cell-bound sliders · Plot Selection ·
basic automation runner · Market panel + `STOCK()` · local autosave · optional
Supabase cloud (auth, save/load, read-only sharing) · crash guard + onboarding.

---

## Next (highest value, near-term)

1. **More formulas** — extend coverage toward common Excel functions users
   actually reach for (date/time, text, lookup edge cases).
2. **Graph export** — PNG/SVG export of the current graph.
3. **CSV import** — round-trip the export path.
4. **Scatter plots** — the most-requested missing graph type; small step from
   the existing Plot Selection path.
5. **Column-width persistence** — persist widths into serialization.

## Later (bigger, still in-scope)

- Parametric and implicit/contour graphing.
- Named ranges.
- Conditional formatting.
- Dynamic arrays / spill ranges.
- Click-to-trace on graphs.

## Out of scope (for now)

- Live multi-user co-editing (current sharing is read-only snapshots).
- Full Excel parity (pivot tables, VBA/macros, 1M-row sheets).
- The removed scientific-computing modules (ML, ODE/PDE, uncertainty, sweeps).

---

## Guiding principles

- **One engine.** No second parser or math engine; graphs consume the same AST
  as cells.
- **Everything live.** If a value can be computed, it should be graphable and
  slider-drivable.
- **Under-promise, over-deliver.** Ship narrow and solid before wide.
