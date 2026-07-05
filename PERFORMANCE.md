# Performance Notes

A short, accurate account of what keeps Radix responsive. (An earlier version
of this file was an aspirational essay comparing Radix to Excel's internal
architecture and claiming 10–100× rewrites and million-row scale. That was not
grounded in the shipped code and has been removed. The orchestrator may delete
this file entirely — the substance below is small.)

## What actually keeps the UI fast

- **Virtualized grid.** The 1000 × 52 grid renders only the rows/columns in the
  viewport (plus a small overscan), so scrolling cost is bounded by visible
  cells, not sheet size. See `src/components/SpreadsheetGrid.tsx`.
- **Debounced/coalesced slider drags.** Parameter drags commit on a short
  debounce (~45ms) as well as on release, so dragging a slider does not fire a
  recalculation on every pointer move.
- **Graph render cache.** `GraphRenderer` caches sampled points and only
  re-samples when a referenced cell's version changes, so unchanged curves are
  not recomputed on every repaint.
- **Memoized components + stable callbacks.** Grid cells and panels use
  `React.memo` and `useCallback` so unrelated state changes don't cascade into
  full re-renders.

## Known costs / honest caveats

- **Undo snapshots.** Each discrete mutation captures a full workbook snapshot
  (`serializeEngine()`), bounded to 100 entries. This is O(cells) per edit —
  fine for typical workbooks; on very large sheets a keystroke pays a serialize.
  Slider drags are coalesced so they don't. Could move to command/diff history
  if profiling ever shows it matters.
- **Recalculation** walks the dependency graph in topological order; there is no
  compiled-formula/bytecode layer — formulas are interpreted from the AST.
- **Scale.** The grid is intentionally capped at 1000 × 52. Radix is not tuned
  for spreadsheets with hundreds of thousands of populated cells.

There is no formal benchmark suite; these are architectural facts, not measured
numbers.
