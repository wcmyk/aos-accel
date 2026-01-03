/**
 * Graph Canvas Component
 * Renders graphs using the same AST as spreadsheet formulas
 */

import React, { useEffect, useRef, useState } from 'react';
import { useAccelStore } from '../store/accel-store';
import { GraphRenderer } from '../engine/graph-renderer';

export const GraphCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { engine, getGraphs } = useAccelStore();
  const [viewport, setViewport] = useState({
    xMin: -10,
    xMax: 10,
    yMin: -10,
    yMax: 10,
  });

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
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw axes
    drawAxes(ctx, canvas.width, canvas.height, viewport);

    // Render graphs
    const worksheet = engine.getWorksheet();
    const renderer = new GraphRenderer(worksheet);
    const graphsData = renderer.renderAll(1000);

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
  }, [engine, viewport, getGraphs, drawAxes, mapToScreen]);

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
        <button onClick={() => handleZoom(1)}>Zoom In</button>
        <button onClick={() => handleZoom(-1)}>Zoom Out</button>
        <button onClick={handleReset}>Reset</button>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="graph-canvas"
        onWheel={(e) => {
          e.preventDefault();
          handleZoom(e.deltaY);
        }}
      />
    </div>
  );
};
