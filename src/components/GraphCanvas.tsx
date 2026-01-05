/**
 * Graph Canvas Component
 * Renders graphs using the same AST as spreadsheet formulas
 */

import React, { useEffect, useRef, useState } from 'react';
import { useAccelStore } from '../store/accel-store';
export const GraphCanvas: React.FC = React.memo(() => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const { getGraphs, getGraphRenderer } = useAccelStore();
  const [viewport, setViewport] = useState({
    xMin: -10,
    xMax: 10,
    yMin: -10,
    yMax: 10,
  });
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 540 });
  const [axisSelection, setAxisSelection] = useState({ xIndex: 0, yIndex: 1 });

  const graphs = getGraphs();
  const maxDimensions = graphs
    .filter((g) => g.type === 'plot')
    .reduce((max, g) => Math.max(max, g.dimensions || 2), 2);

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
      const height = Math.max(420, Math.min(720, width * 0.6));
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
    ctx.strokeStyle = '#333';
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
    ctx.strokeStyle = '#e0e0e0';
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

    // Labels
    ctx.fillStyle = '#333';
    ctx.font = '12px sans-serif';
    ctx.fillText(`X: [${vp.xMin.toFixed(1)}, ${vp.xMax.toFixed(1)}]`, 10, height - 10);
    ctx.fillText(`Y: [${vp.yMin.toFixed(1)}, ${vp.yMax.toFixed(1)}]`, 10, 20);
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

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw axes
      drawAxes(ctx, canvas.width, canvas.height, viewport);

      // Get cached renderer from store
      const graphRenderer = getGraphRenderer();
      const graphsData = graphRenderer.renderAll(1000, axisSelection);

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
    });

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [viewport, getGraphRenderer, canvasSize, axisSelection]);

  const handleZoom = (delta: number) => {
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
    setViewport({
      xMin: -10,
      xMax: 10,
      yMin: -10,
      yMax: 10,
    });
  };

  return (
    <div className="graph-container">
      <div className="graph-controls">
        <div className="control-stack">
          <p className="graph-label">Viewport</p>
          <div className="chip">X: [{viewport.xMin.toFixed(1)}, {viewport.xMax.toFixed(1)}]</div>
          <div className="chip">Y: [{viewport.yMin.toFixed(1)}, {viewport.yMax.toFixed(1)}]</div>
        </div>
        {maxDimensions > 1 && (
          <div className="axis-picker">
            <label>
              Horizontal Axis
              <select
                value={axisSelection.xIndex}
                onChange={(e) => setAxisSelection({ ...axisSelection, xIndex: Number(e.target.value) })}
              >
                {Array.from({ length: maxDimensions }, (_, i) => (
                  <option key={`x-${i}`} value={i}>Axis {i + 1}</option>
                ))}
              </select>
            </label>
            <label>
              Vertical Axis
              <select
                value={axisSelection.yIndex}
                onChange={(e) => setAxisSelection({ ...axisSelection, yIndex: Number(e.target.value) })}
              >
                {Array.from({ length: maxDimensions }, (_, i) => (
                  <option key={`y-${i}`} value={i}>Axis {i + 1}</option>
                ))}
              </select>
            </label>
          </div>
        )}
        <div className="control-actions">
          <button className="btn" onClick={() => handleZoom(1)}>Zoom In</button>
          <button className="btn ghost" onClick={() => handleZoom(-1)}>Zoom Out</button>
          <button className="btn ghost" onClick={handleReset}>Reset</button>
        </div>
      </div>
      <div className="graph-canvas-shell">
        <canvas
          ref={canvasRef}
          className="graph-canvas"
          onWheel={(e) => {
            e.preventDefault();
            handleZoom(e.deltaY);
          }}
        />
      </div>
    </div>
  );
});
