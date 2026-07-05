/**
 * Graph Canvas Component
 * Renders graphs using the same AST as spreadsheet formulas
 */

import React, { useEffect, useRef, useState } from 'react';
import { useAccelStore } from '../store/accel-store';
import './GraphCanvas.css';
export const GraphCanvas: React.FC = React.memo(() => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const { getGraphs, getGraphRenderer, removeGraph } = useAccelStore();
  // Per-series visibility toggled from the legend. Kept as local UI state so
  // we never mutate the store's graph definitions (which stay visible:true).
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  // Any engine mutation (cell edit, slider drag, async STOCK() data arrival)
  // bumps docVersion — the draw effect keys off it so the canvas actually
  // repaints. Without this the effect deps never change on recalculation.
  const docVersion = useAccelStore((state) => state.docVersion);
  const [viewport, setViewport] = useState({
    xMin: -10,
    xMax: 10,
    yMin: -10,
    yMax: 10,
  });
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 540 });
  const [axisSelection, setAxisSelection] = useState({ xIndex: 0, yIndex: 1 });
  // Once the user zooms/pans/resets we stop auto-fitting to plot data.
  const userAdjustedViewportRef = useRef(false);
  const lastPlotBoundsRef = useRef<{ xMin: number; xMax: number; yMin: number; yMax: number } | null>(null);
  // Cursor tracing: nearest point per visible series at the hovered x.
  const [trace, setTrace] = useState<{
    cssX: number;
    dataX: number;
    entries: Array<{ color: string; label: string; x: number; y: number }>;
  } | null>(null);

  const graphs = getGraphs();
  const plotDimensions = graphs
    .filter((g) => g.type === 'plot')
    .reduce((max, g) => Math.max(max, g.dimensions || 2), 2);
  // Always expose at least X, Y and Z so a Z plane can be selected even
  // before a 3-D PLOT exists; grow further for higher-dimensional plots.
  const maxDimensions = Math.max(3, plotDimensions);
  const axisLabel = (i: number) =>
    i === 0 ? 'X' : i === 1 ? 'Y' : i === 2 ? 'Z' : `Axis ${i + 1}`;

  useEffect(() => {
    setAxisSelection((prev) => {
      const cappedX = Math.min(prev.xIndex, Math.max(0, maxDimensions - 1));
      const cappedY = Math.min(prev.yIndex, Math.max(0, maxDimensions - 1));
      if (cappedX === prev.xIndex && cappedY === prev.yIndex) return prev;
      return { xIndex: cappedX, yIndex: cappedY };
    });
  }, [maxDimensions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;

    const resize = () => {
      const parentRect = canvas.parentElement!.getBoundingClientRect();
      const width = parentRect.width;
      // In a fill card (sibling view hidden) the shell has a definite flexed
      // height — use all of it. Otherwise derive height from width.
      const filled = canvas.parentElement!.closest('.card--fill');
      const base = Math.max(420, Math.min(720, width * 0.6));
      // Fill mode absorbs the hidden sibling's space — grow, never shrink.
      const height = filled ? Math.max(base, parentRect.height) : base;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      setCanvasSize({ width: canvas.width, height: canvas.height });
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement);
    window.addEventListener('resize', resize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  const mapToScreen = (
    value: number,
    min: number,
    max: number,
    screenMin: number,
    screenMax: number
  ): number => {
    return screenMin + ((value - min) / (max - min)) * (screenMax - screenMin);
  };

  const drawAxes = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    vp: { xMin: number; xMax: number; yMin: number; yMax: number }
  ) => {
    // Theme-aware colors (dark/light) for axes and gridlines.
    const isDark = document.documentElement.getAttribute('data-theme')?.includes('dark');
    const axisColor = isDark ? '#d4d4d4' : '#333';
    const gridColor = isDark ? '#3e3e42' : '#e0e0e0';

    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1;

    // X-axis
    const yZero = mapToScreen(0, vp.yMin, vp.yMax, height, 0);
    if (yZero >= 0 && yZero <= height) {
      ctx.beginPath();
      ctx.moveTo(0, yZero);
      ctx.lineTo(width, yZero);
      ctx.stroke();
    }

    // Y-axis
    const xZero = mapToScreen(0, vp.xMin, vp.xMax, 0, width);
    if (xZero >= 0 && xZero <= width) {
      ctx.beginPath();
      ctx.moveTo(xZero, 0);
      ctx.lineTo(xZero, height);
      ctx.stroke();
    }

    // Grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;

    // Vertical grid lines
    const xStep = (vp.xMax - vp.xMin) / 10;
    for (let i = 0; i <= 10; i++) {
      const x = vp.xMin + i * xStep;
      const screenX = mapToScreen(x, vp.xMin, vp.xMax, 0, width);
      ctx.beginPath();
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, height);
      ctx.stroke();
    }

    // Horizontal grid lines
    const yStep = (vp.yMax - vp.yMin) / 10;
    for (let i = 0; i <= 10; i++) {
      const y = vp.yMin + i * yStep;
      const screenY = mapToScreen(y, vp.yMin, vp.yMax, height, 0);
      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(width, screenY);
      ctx.stroke();
    }

    // Numeric tick labels along the edges. These stay visible no matter
    // where the viewport is — previously only the zero-axis lines were
    // drawn, so panning/fitting to data far from the origin left the chart
    // with no readable scale at all.
    const fmtTick = (v: number) =>
      Math.abs(v) >= 1e5 || (v !== 0 && Math.abs(v) < 1e-3)
        ? v.toExponential(1)
        : String(parseFloat(v.toFixed(2)));

    ctx.fillStyle = axisColor;
    ctx.font = `${Math.round(11 * (window.devicePixelRatio || 1))}px sans-serif`;
    for (let i = 0; i <= 10; i += 2) {
      const xVal = vp.xMin + (i * (vp.xMax - vp.xMin)) / 10;
      const screenX = mapToScreen(xVal, vp.xMin, vp.xMax, 0, width);
      ctx.textAlign = i === 0 ? 'left' : i === 10 ? 'right' : 'center';
      ctx.fillText(fmtTick(xVal), screenX, height - 8);

      const yVal = vp.yMin + (i * (vp.yMax - vp.yMin)) / 10;
      const screenY = mapToScreen(yVal, vp.yMin, vp.yMax, height, 0);
      ctx.textAlign = 'left';
      ctx.fillText(fmtTick(yVal), 8, Math.min(height - 22, Math.max(30, screenY + 4)));
    }
    ctx.textAlign = 'left';

    // Axis names in the corners
    ctx.fillText(axisLabel(axisSelection.xIndex), width - 18, height - 26);
    ctx.fillText(axisLabel(axisSelection.yIndex), 8, 14);
  };

  /**
   * Bounds of all visible data-driven (plot) points, padded 10%.
   * Function graphs are excluded: they sample across whatever viewport is
   * active, so "fitting" to them is circular.
   */
  const plotBounds = (graphsData: { type: string; visible: boolean; points: { x: number; y: number }[] }[]) => {
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    let found = false;
    for (const g of graphsData) {
      if (!g.visible || g.type !== 'plot') continue;
      for (const p of g.points) {
        if (!isFinite(p.x) || !isFinite(p.y)) continue;
        found = true;
        if (p.x < xMin) xMin = p.x;
        if (p.x > xMax) xMax = p.x;
        if (p.y < yMin) yMin = p.y;
        if (p.y > yMax) yMax = p.y;
      }
    }
    if (!found) return null;
    const xPad = (xMax - xMin) * 0.1 || 1;
    const yPad = (yMax - yMin) * 0.1 || 1;
    return { xMin: xMin - xPad, xMax: xMax + xPad, yMin: yMin - yPad, yMax: yMax + yPad };
  };

  useEffect(() => {
    // Cancel previous RAF if exists
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Get cached renderer from store
      const graphRenderer = getGraphRenderer();
      const graphsData = graphRenderer
        .renderAll(1000, axisSelection)
        .filter((g) => !hiddenIds.has(g.id));

      // Auto-fit data plots (e.g. stock series living at y≈200, x≈1..90)
      // that would otherwise be invisible in the default ±10 viewport.
      // Only until the user takes over the viewport themselves; setViewport
      // re-runs this effect once with the fitted bounds, which then contain
      // the data, so this cannot loop.
      lastPlotBoundsRef.current = plotBounds(graphsData);
      if (!userAdjustedViewportRef.current && lastPlotBoundsRef.current) {
        const b = lastPlotBoundsRef.current;
        const outside =
          b.xMin < viewport.xMin || b.xMax > viewport.xMax ||
          b.yMin < viewport.yMin || b.yMax > viewport.yMax;
        if (outside) {
          setViewport(b);
          return;
        }
      }

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw axes
      drawAxes(ctx, canvas.width, canvas.height, viewport);

      for (const graphData of graphsData) {
        if (!graphData.visible || graphData.points.length === 0) continue;

        ctx.strokeStyle = graphData.color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        let first = true;
        for (const point of graphData.points) {
          const screenX = mapToScreen(point.x, viewport.xMin, viewport.xMax, 0, canvas.width);
          const screenY = mapToScreen(point.y, viewport.yMin, viewport.yMax, canvas.height, 0);

          if (first) {
            ctx.moveTo(screenX, screenY);
            first = false;
          } else {
            ctx.lineTo(screenX, screenY);
          }
        }

        ctx.stroke();
      }

      // Cursor trace: dashed vertical at the hovered x plus a marker dot on
      // each series at its nearest sampled point.
      if (trace) {
        const isDark = document.documentElement.getAttribute('data-theme')?.includes('dark');
        const lineX = mapToScreen(trace.dataX, viewport.xMin, viewport.xMax, 0, canvas.width);
        ctx.strokeStyle = isDark ? 'rgba(148,163,184,0.55)' : 'rgba(100,116,139,0.55)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(lineX, 0);
        ctx.lineTo(lineX, canvas.height);
        ctx.stroke();
        ctx.setLineDash([]);
        for (const entry of trace.entries) {
          const px = mapToScreen(entry.x, viewport.xMin, viewport.xMax, 0, canvas.width);
          const py = mapToScreen(entry.y, viewport.yMin, viewport.yMax, canvas.height, 0);
          ctx.fillStyle = entry.color;
          ctx.beginPath();
          ctx.arc(px, py, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
    // drawAxes is a stable local helper; the effect intentionally re-runs only
    // on data/viewport changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport, getGraphRenderer, canvasSize, axisSelection, docVersion, trace, hiddenIds]);

  const handleTraceMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / Math.max(1, rect.width);
    const dataX = viewport.xMin + frac * (viewport.xMax - viewport.xMin);

    const graphsData = getGraphRenderer()
      .renderAll(1000, axisSelection)
      .filter((g) => !hiddenIds.has(g.id));
    const formulas = new Map(getGraphs().map((g) => [g.id, g.formula]));
    const entries: Array<{ color: string; label: string; x: number; y: number }> = [];
    for (const g of graphsData) {
      if (!g.visible || g.points.length === 0) continue;
      let best = g.points[0];
      let bestDist = Math.abs(best.x - dataX);
      for (const p of g.points) {
        const d = Math.abs(p.x - dataX);
        if (d < bestDist) {
          best = p;
          bestDist = d;
        }
      }
      entries.push({ color: g.color, label: formulas.get(g.id) || g.id, x: best.x, y: best.y });
    }

    if (entries.length > 0) {
      setTrace({ cssX: e.clientX - rect.left, dataX, entries });
    } else if (trace) {
      setTrace(null);
    }
  };

  const handleZoom = (delta: number) => {
    userAdjustedViewportRef.current = true;
    setViewport((prev) => {
      const zoomFactor = delta > 0 ? 0.9 : 1.1;
      const xRange = (prev.xMax - prev.xMin) * zoomFactor;
      const yRange = (prev.yMax - prev.yMin) * zoomFactor;
      const xCenter = (prev.xMin + prev.xMax) / 2;
      const yCenter = (prev.yMin + prev.yMax) / 2;

      return {
        xMin: xCenter - xRange / 2,
        xMax: xCenter + xRange / 2,
        yMin: yCenter - yRange / 2,
        yMax: yCenter + yRange / 2,
      };
    });
  };

  const handleReset = () => {
    userAdjustedViewportRef.current = true;
    setViewport({
      xMin: -10,
      xMax: 10,
      yMin: -10,
      yMax: 10,
    });
  };

  const handleFitData = () => {
    if (lastPlotBoundsRef.current) {
      setViewport(lastPlotBoundsRef.current);
    }
  };

  const toggleHidden = (id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="graph-container">
      <div className="graph-controls">
        <div className="control-stack">
          <p className="graph-label">Viewport</p>
          <div className="chip">{axisLabel(axisSelection.xIndex)}: [{viewport.xMin.toFixed(1)}, {viewport.xMax.toFixed(1)}]</div>
          <div className="chip">{axisLabel(axisSelection.yIndex)}: [{viewport.yMin.toFixed(1)}, {viewport.yMax.toFixed(1)}]</div>
        </div>
        <div className="axis-picker">
          <p className="graph-label">View Plane</p>
          <div className="plane-buttons">
            <button
              className={`btn ${axisSelection.xIndex === 0 && axisSelection.yIndex === 1 ? 'active' : 'ghost'}`}
              onClick={() => setAxisSelection({ xIndex: 0, yIndex: 1 })}
              title="View X-Y plane"
            >
              X-Y
            </button>
            <button
              className={`btn ${axisSelection.xIndex === 0 && axisSelection.yIndex === 2 ? 'active' : 'ghost'}`}
              onClick={() => setAxisSelection({ xIndex: 0, yIndex: 2 })}
              title="View X-Z plane"
            >
              X-Z
            </button>
            <button
              className={`btn ${axisSelection.xIndex === 1 && axisSelection.yIndex === 2 ? 'active' : 'ghost'}`}
              onClick={() => setAxisSelection({ xIndex: 1, yIndex: 2 })}
              title="View Y-Z plane"
            >
              Y-Z
            </button>
          </div>
          <div className="axis-selectors">
            <label>
              Horizontal
              <select
                value={axisSelection.xIndex}
                onChange={(e) => setAxisSelection({ ...axisSelection, xIndex: Number(e.target.value) })}
              >
                {Array.from({ length: maxDimensions }, (_, i) => (
                  <option key={`x-${i}`} value={i}>{axisLabel(i)}</option>
                ))}
              </select>
            </label>
            <label>
              Vertical
              <select
                value={axisSelection.yIndex}
                onChange={(e) => setAxisSelection({ ...axisSelection, yIndex: Number(e.target.value) })}
              >
                {Array.from({ length: maxDimensions }, (_, i) => (
                  <option key={`y-${i}`} value={i}>{axisLabel(i)}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="control-actions">
          <button className="btn" onClick={() => handleZoom(1)}>Zoom In</button>
          <button className="btn ghost" onClick={() => handleZoom(-1)}>Zoom Out</button>
          <button className="btn ghost" onClick={handleFitData} title="Fit the viewport to the plotted data">Fit Data</button>
          <button className="btn ghost" onClick={handleReset}>Reset</button>
        </div>
      </div>
      {graphs.length > 0 && (
        <div className="graph-legend" role="group" aria-label="Graph series">
          {graphs.map((g) => {
            const hidden = hiddenIds.has(g.id);
            return (
              <div
                key={g.id}
                className={`graph-legend__item${hidden ? ' is-hidden' : ''}`}
              >
                <button
                  type="button"
                  className="graph-legend__toggle"
                  onClick={() => toggleHidden(g.id)}
                  aria-pressed={!hidden}
                  title={hidden ? 'Show this series' : 'Hide this series'}
                >
                  <span className="graph-legend__dot" style={{ background: g.color }} />
                  <span className="graph-legend__label">{g.formula || g.id}</span>
                </button>
                <button
                  type="button"
                  className="graph-legend__remove"
                  onClick={() => removeGraph(g.id)}
                  title="Remove this series"
                  aria-label={`Remove ${g.formula || g.id}`}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div className="graph-canvas-shell">
        {graphs.length === 0 && (
          <div className="graph-empty">
            <div className="graph-empty__card">
              <p className="graph-empty__title">No graphs yet</p>
              <p className="graph-empty__body">
                Plot a formula like <code>y = A1*x + B1</code>, or select a range
                of cells and choose <strong>Plot Selection</strong>.
              </p>
            </div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="graph-canvas"
          onWheel={(e) => {
            // A trackpad pinch arrives as a wheel event with ctrlKey set; a
            // plain two-finger scroll does not. Only intercept the pinch so
            // ordinary scrolling still moves the surrounding UI instead of the
            // graph fighting it. Ctrl/Cmd+wheel on a mouse zooms too; the
            // on-canvas Zoom In/Out buttons cover plain-mouse users.
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              handleZoom(e.deltaY);
            }
          }}
          onMouseMove={handleTraceMove}
          onMouseLeave={() => setTrace(null)}
        />
        {trace && (
          <div
            className="graph-trace-tooltip"
            style={{ left: Math.max(8, Math.min(trace.cssX + 14, canvasSize.width / (window.devicePixelRatio || 1) - 170)), top: 8 }}
          >
            <div className="graph-trace-tooltip__x">
              {axisLabel(axisSelection.xIndex)} = {trace.dataX.toFixed(3)}
            </div>
            {trace.entries.map((entry, i) => (
              <div key={i} className="graph-trace-tooltip__row">
                <span className="stock-chip__dot" style={{ background: entry.color }} />
                <span className="graph-trace-tooltip__label">{entry.label}</span>
                <strong>{entry.y.toFixed(4)}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
