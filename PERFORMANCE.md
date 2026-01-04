/**
 * PERFORMANCE OPTIMIZATION GUIDE
 * Keeping Accel fast (not "Deccel")
 */

## Critical Performance Issues & Fixes

### 1. VIRTUAL SCROLLING (Highest Impact)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Problem:** SpreadsheetGrid renders ALL 2,600 cells (100×26) on every render
**Impact:** ~100ms+ render time, laggy interactions
**Solution:** Only render visible cells

```tsx
// BEFORE (src/components/SpreadsheetGrid.tsx:98):
{Array.from({ length: ROWS }, (_, i) => i + 1).map((row) => (
  // Renders ALL 100 rows
))}

// AFTER: Use react-window or react-virtualized
import { FixedSizeGrid } from 'react-window';

<FixedSizeGrid
  columnCount={COLS}
  columnWidth={CELL_WIDTH}
  height={600}
  rowCount={ROWS}
  rowHeight={CELL_HEIGHT}
  width={800}
>
  {({ columnIndex, rowIndex, style }) => (
    <Cell row={rowIndex + 1} col={columnIndex + 1} style={style} />
  )}
</FixedSizeGrid>
```

**Speedup:** 10-20x faster rendering (only ~40 visible cells rendered)

---

### 2. DEBOUNCE PARAMETER SLIDERS (High Impact)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Problem:** ParameterPanel.tsx:62-64 calls updateParameter + refresh on EVERY onChange
**Impact:** Slider drag fires 60+ updates/second → 60 recalculations + redraws/second
**Solution:** Debounce or use onMouseUp

```tsx
// BEFORE (src/components/ParameterPanel.tsx:62):
onChange={(e) => {
  updateParameter(cell.address.row, cell.address.col, parseFloat(e.target.value));
  refresh();  // ← Triggers full re-render 60 times/sec!
}}

// AFTER: Debounce updates
import { useMemo, useCallback, useRef } from 'react';
import { debounce } from 'lodash'; // or custom debounce

const debouncedUpdate = useMemo(
  () => debounce((row, col, value) => {
    updateParameter(row, col, value);
    refresh();
  }, 16), // ~60fps
  [updateParameter, refresh]
);

// OR better: Use controlled input + onMouseUp
const [localValue, setLocalValue] = useState(value);

<input
  value={localValue}
  onChange={(e) => setLocalValue(parseFloat(e.target.value))} // Fast local update
  onMouseUp={(e) => {
    updateParameter(row, col, localValue); // Only update engine on release
    refresh();
  }}
/>
```

**Speedup:** 60x fewer engine updates while dragging

---

### 3. MEMOIZE GRAPH RENDERING (High Impact)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Problem:** GraphCanvas.tsx:122-162 re-renders ALL graphs on every state change
**Impact:** Recalculates 1000+ points even when data hasn't changed
**Solution:** Memoize graph data, use requestAnimationFrame

```tsx
// BEFORE (src/components/GraphCanvas.tsx:36):
const evaluator = new Evaluator(this.worksheet); // Created every time
for (let i = 0; i <= resolution; i++) {
  const y = evaluator.evaluate(graph.ast, { x }); // 1000+ evaluations
}

// AFTER: Cache graph points
class GraphRenderer {
  private cache: Map<string, { data: Point[], version: number }> = new Map();
  private worksheetVersion: number = 0;

  renderFunction(graph: GraphDefinition, resolution: number = 1000): Point[] {
    const cacheKey = `${graph.id}-${resolution}`;
    const cached = this.cache.get(cacheKey);

    if (cached && cached.version === this.worksheetVersion) {
      return cached.data; // Return cached points
    }

    const points = this.computePoints(graph, resolution);
    this.cache.set(cacheKey, { data: points, version: this.worksheetVersion });
    return points;
  }

  invalidateCache() {
    this.worksheetVersion++;
  }
}
```

**Speedup:** 100x faster when graphs haven't changed

---

### 4. THROTTLE CANVAS REDRAWS (Medium Impact)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Problem:** useEffect redraws canvas on every tiny change
**Solution:** Use requestAnimationFrame for smooth 60fps

```tsx
// AFTER: Throttle redraws
useEffect(() => {
  let rafId: number;

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ... drawing logic ...
  };

  rafId = requestAnimationFrame(draw);

  return () => cancelAnimationFrame(rafId);
}, [engine, viewport, getGraphs]);
```

---

### 5. LAZY CELL CREATION (Medium Impact)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Problem:** Empty cells still create objects in memory
**Solution:** Only create cells when they have values

```tsx
// BEFORE (src/engine/engine.ts:50):
let cell = worksheet.cells.get(cellKey);
if (!cell) {
  cell = { /* always create */ };
  worksheet.cells.set(cellKey, cell);
}

// AFTER: Don't create for null values
if (input === null || input === '') {
  worksheet.cells.delete(cellKey); // Remove empty cells
  return;
}
```

**Speedup:** 90% memory reduction for sparse spreadsheets

---

### 6. REACT.MEMO COMPONENTS (Medium Impact)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Problem:** All components re-render on any state change
**Solution:** Wrap expensive components in React.memo

```tsx
// BEFORE:
export const GraphCanvas: React.FC = () => { ... }

// AFTER:
export const GraphCanvas: React.FC = React.memo(() => {
  // ... component logic ...
}, (prev, next) => {
  // Custom comparison
  return prev.engine === next.engine && prev.viewport === next.viewport;
});

// Same for:
export const SpreadsheetGrid = React.memo(...);
export const ParameterPanel = React.memo(...);
```

---

### 7. WEB WORKERS FOR HEAVY CALCULATIONS (Future)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**For large datasets:**
```tsx
// Offload graph calculations to worker
const worker = new Worker('./graph-worker.ts');
worker.postMessage({ ast, xMin, xMax, resolution });
worker.onmessage = (e) => {
  const points = e.data;
  // Update canvas
};
```

---

## Performance Checklist

### ✅ Quick Wins (Implement Now)
- [ ] Add debounce to parameter sliders (2 min fix)
- [ ] Use React.memo on GraphCanvas (1 min fix)
- [ ] Use React.memo on SpreadsheetGrid (1 min fix)
- [ ] Use useCallback for event handlers (5 min fix)
- [ ] Throttle canvas redraws with RAF (5 min fix)

### 🔄 Medium Effort (Next Week)
- [ ] Implement virtual scrolling for spreadsheet (2-3 hours)
- [ ] Cache graph point calculations (1-2 hours)
- [ ] Lazy cell creation for empty cells (30 min)
- [ ] Batch state updates in Zustand (1 hour)

### 🚀 Advanced (Future)
- [ ] Web Workers for graph calculations
- [ ] OffscreenCanvas for graph rendering
- [ ] Incremental AST parsing
- [ ] Compile formulas to JS functions

---

## Benchmarking

### Current Performance (Estimated)
- Spreadsheet render: ~100ms (2,600 cells)
- Parameter slider drag: ~16ms per update × 60/sec = **960ms/sec** 🔴
- Graph render: ~50ms (1000 points)
- Total frame time: **~166ms** (6 fps) 🔴

### After Optimizations (Target)
- Spreadsheet render: ~5ms (40 visible cells) ✅
- Parameter slider drag: ~16ms per final update ✅
- Graph render (cached): ~1ms ✅
- Total frame time: **~6ms** (166 fps) ✅

---

## Implementation Priority

**Week 1 (Quick Wins):**
1. Debounce parameter sliders → 60x improvement
2. React.memo components → 3-5x improvement
3. useCallback handlers → 2x improvement

**Week 2 (Big Wins):**
1. Virtual scrolling → 20x improvement
2. Graph caching → 100x improvement (when unchanged)

**Result:** Accel stays fast at **60fps** even with:
- 100,000 row spreadsheets (virtual scrolling)
- 10 graphs with 10,000 points each (caching)
- 50 parameters (debounced sliders)

---

## Code Review Guidelines

**Before merging any PR, check:**
1. ❌ Does it render all cells? → Use virtual scrolling
2. ❌ Does it call setState in a loop? → Batch updates
3. ❌ Does it create new objects in render? → useMemo/useCallback
4. ❌ Does it recalculate unchanged data? → Add caching
5. ❌ Does it update 60 times/sec? → Debounce/throttle

---

This keeps Accel = Excel + Desmos, NOT Deccel!
