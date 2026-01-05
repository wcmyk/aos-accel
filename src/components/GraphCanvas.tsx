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
    zMin: -10,
    zMax: 10,
  });
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 540 });
  const [axisSelection, setAxisSelection] = useState({ xIndex: 0, yIndex: 1, zIndex: 2 });
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');

  const graphs = getGraphs();
  const maxDimensions = graphs.reduce((max, g) => Math.max(max, g.dimensions || 2), 2);

  useEffect(() => {
    setAxisSelection((prev) => {
      const cappedX = Math.min(prev.xIndex, Math.max(0, maxDimensions - 1));
      const cappedY = Math.min(prev.yIndex, Math.max(0, maxDimensions - 1));
      const cappedZ = Math.min(prev.zIndex, Math.max(0, maxDimensions - 1));
      if (cappedX === prev.xIndex && cappedY === prev.yIndex && cappedZ === prev.zIndex) return prev;
      return { xIndex: cappedX, yIndex: cappedY, zIndex: cappedZ };
    });
  }, [maxDimensions]);

  useEffect(() => {
    if (maxDimensions > 2 && viewMode === '2d') {
      setViewMode('3d');
    } else if (maxDimensions <= 2 && viewMode === '3d') {
      setViewMode('2d');
    }
  }, [maxDimensions, viewMode]);

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
    if (max === min) return (screenMin + screenMax) / 2;
    return screenMin + ((value - min) / (max - min)) * (screenMax - screenMin);
  };

  const pickCoord = (coords: number[], index: number, fallbackIndex: number = 0): number => {
    const candidate = coords[index];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
    const fallback = coords[fallbackIndex];
    return typeof fallback === 'number' && Number.isFinite(fallback) ? fallback : 0;
  };

  const drawAxes2D = (
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

  const projectPoint3D = (
    coords: number[],
    width: number,
    height: number
  ) => {
    const xVal = pickCoord(coords, axisSelection.xIndex, 0);
    const yVal = pickCoord(coords, axisSelection.yIndex, 1);
    const zVal = pickCoord(coords, axisSelection.zIndex, 2);

    const normalize = (value: number, min: number, max: number) => {
      if (max === min) return 0;
      return ((value - (min + max) / 2) / (max - min)) * 2;
    };

    let nx = normalize(xVal, viewport.xMin, viewport.xMax);
    let ny = normalize(yVal, viewport.yMin, viewport.yMax);
    let nz = normalize(zVal, viewport.zMin, viewport.zMax);

    // Rotate for an isometric-style view
    const angleY = 0.8;
    const angleX = -0.7;
    const cosY = Math.cos(angleY);
    const sinY = Math.sin(angleY);
    const cosX = Math.cos(angleX);
    const sinX = Math.sin(angleX);

    const rotatedX = nx * cosY + nz * sinY;
    let rotatedZ = -nx * sinY + nz * cosY;
    const rotatedY = ny * cosX - rotatedZ * sinX;
    rotatedZ = ny * sinX + rotatedZ * cosX;

    const distance = 3;
    const perspective = 1 / (distance + rotatedZ + 1e-3);
    const scale = Math.min(width, height) * 0.45;

    return {
      x: width / 2 + rotatedX * scale * perspective,
      y: height / 2 - rotatedY * scale * perspective,
      depth: rotatedZ,
      coords: { x: xVal, y: yVal, z: zVal },
    };
  };

  const drawAxes3D = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#444';
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#333';

    const origin = projectPoint3D([0, 0, 0], width, height);
    const xEnd = projectPoint3D([viewport.xMax, 0, 0], width, height);
    const yEnd = projectPoint3D([0, viewport.yMax, 0], width, height);
    const zEnd = projectPoint3D([0, 0, viewport.zMax], width, height);

    const axes = [
      { end: xEnd, label: `X (Axis ${axisSelection.xIndex + 1})` },
      { end: yEnd, label: `Y (Axis ${axisSelection.yIndex + 1})` },
      { end: zEnd, label: `Z (Axis ${axisSelection.zIndex + 1})` },
    ];

    for (const axis of axes) {
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(axis.end.x, axis.end.y);
      ctx.stroke();
      ctx.fillText(axis.label, axis.end.x + 6, axis.end.y - 6);
    }

    ctx.fillText(
      `Z: [${viewport.zMin.toFixed(1)}, ${viewport.zMax.toFixed(1)}]`,
      10,
      20
    );
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

      // Get cached renderer from store
      const graphRenderer = getGraphRenderer();
      const graphsData = graphRenderer.renderAll(1000);

      const is3D = viewMode === '3d' && maxDimensions > 2;
      if (is3D) {
        drawAxes3D(ctx, canvas.width, canvas.height);
      } else {
        drawAxes2D(ctx, canvas.width, canvas.height, viewport);
      }

      for (const graphData of graphsData) {
        if (!graphData.visible || graphData.points.length === 0) continue;

        const isScatter = graphData.type === 'plot' || graphData.type === 'scatter';
        ctx.strokeStyle = graphData.color;
        ctx.lineWidth = 2;

        if (is3D) {
          const projected = graphData.points
            .map((point) => projectPoint3D(point.coords, canvas.width, canvas.height))
            .filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y));

          if (projected.length === 0) continue;

          if (!isScatter) {
            ctx.beginPath();
            projected.forEach((pt, idx) => {
              if (idx === 0) {
                ctx.moveTo(pt.x, pt.y);
              } else {
                ctx.lineTo(pt.x, pt.y);
              }
            });
            ctx.stroke();
          }

          const markers = isScatter ? projected : projected.slice(0, Math.min(projected.length, 300));
          markers.sort((a, b) => a.depth - b.depth);

          ctx.fillStyle = graphData.color;
          ctx.strokeStyle = '#111';
          ctx.lineWidth = 1;
          markers.forEach((pt, idx) => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            if (idx < 40 && isScatter) {
              const { x, y, z } = pt.coords;
              ctx.fillText(`(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`, pt.x + 6, pt.y - 6);
            }
          });
        } else {
          ctx.beginPath();
          let hasPath = false;
          const markers: Array<{ x: number; y: number; label: string }> = [];

          graphData.points.forEach((point, idx) => {
            const xVal = pickCoord(point.coords, axisSelection.xIndex, 0);
            const yVal = pickCoord(point.coords, axisSelection.yIndex, 1);
            if (!Number.isFinite(xVal) || !Number.isFinite(yVal)) return;

            const screenX = mapToScreen(xVal, viewport.xMin, viewport.xMax, 0, canvas.width);
            const screenY = mapToScreen(yVal, viewport.yMin, viewport.yMax, canvas.height, 0);

            if (!isScatter) {
              if (!hasPath) {
                ctx.moveTo(screenX, screenY);
                hasPath = true;
              } else {
                ctx.lineTo(screenX, screenY);
              }
            }

            if (isScatter) {
              markers.push({
                x: screenX,
                y: screenY,
                label: `(${xVal.toFixed(2)}, ${yVal.toFixed(2)})`,
              });
            } else if (idx % 80 === 0) {
              markers.push({
                x: screenX,
                y: screenY,
                label: '',
              });
            }
          });

          if (!isScatter && hasPath) {
            ctx.stroke();
          }

          ctx.fillStyle = graphData.color;
          ctx.strokeStyle = '#111';
          ctx.lineWidth = 1;
          markers.forEach((marker, idx) => {
            ctx.beginPath();
            ctx.arc(marker.x, marker.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            if (marker.label && idx < 50) {
              ctx.fillText(marker.label, marker.x + 6, marker.y - 6);
            }
          });
        }
      }
    });

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [viewport, getGraphRenderer, canvasSize, axisSelection, viewMode, maxDimensions]);

  const handleZoom = (delta: number) => {
    setViewport((prev) => {
      const zoomFactor = delta > 0 ? 0.9 : 1.1;
      const xRange = (prev.xMax - prev.xMin) * zoomFactor;
      const yRange = (prev.yMax - prev.yMin) * zoomFactor;
      const zRange = (prev.zMax - prev.zMin) * zoomFactor;
      const xCenter = (prev.xMin + prev.xMax) / 2;
      const yCenter = (prev.yMin + prev.yMax) / 2;
      const zCenter = (prev.zMin + prev.zMax) / 2;

      return {
        xMin: xCenter - xRange / 2,
        xMax: xCenter + xRange / 2,
        yMin: yCenter - yRange / 2,
        yMax: yCenter + yRange / 2,
        zMin: zCenter - zRange / 2,
        zMax: zCenter + zRange / 2,
      };
    });
  };

  const handleReset = () => {
    setViewport({
      xMin: -10,
      xMax: 10,
      yMin: -10,
      yMax: 10,
      zMin: -10,
      zMax: 10,
    });
  };

  return (
    <div className="graph-container">
      <div className="graph-controls">
        <div className="control-stack">
          <p className="graph-label">Viewport</p>
          <div className="chip">X: [{viewport.xMin.toFixed(1)}, {viewport.xMax.toFixed(1)}]</div>
          <div className="chip">Y: [{viewport.yMin.toFixed(1)}, {viewport.yMax.toFixed(1)}]</div>
          {maxDimensions > 2 && (
            <div className="chip emphasis">Z: [{viewport.zMin.toFixed(1)}, {viewport.zMax.toFixed(1)}]</div>
          )}
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
            {maxDimensions > 2 && (
              <label>
                Depth Axis
                <select
                  value={axisSelection.zIndex}
                  onChange={(e) => setAxisSelection({ ...axisSelection, zIndex: Number(e.target.value) })}
                >
                  {Array.from({ length: maxDimensions }, (_, i) => (
                    <option key={`z-${i}`} value={i}>Axis {i + 1}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
        <div className="control-actions">
          <button
            className={`btn ${viewMode === '2d' ? '' : 'ghost'}`}
            onClick={() => setViewMode('2d')}
          >
            2D
          </button>
          {maxDimensions > 2 && (
            <button
              className={`btn ${viewMode === '3d' ? '' : 'ghost'}`}
              onClick={() => setViewMode('3d')}
            >
              3D (X/Y/Z)
            </button>
          )}
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
