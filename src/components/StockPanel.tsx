/**
 * Market Panel
 * A stock-app style chart over the same market data layer that powers the
 * STOCK() formula: watchlist with selectable tickers, timeframe switching,
 * date axis, price axis, crosshair tooltip, and per-ticker change badges.
 * All series come from the shared per-ticker bar cache, so the panel, the
 * grid formulas, and PLOT graphs always agree.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAccelStore } from '../store/accel-store';
import { StockPickerDialog } from './StockPickerDialog';
import {
  getStockBars,
  getStockBarsFrom,
  requestTicker,
  isTickerLoaded,
  isSyntheticData,
  getSyntheticReason,
  getTickerStatus,
  StockBar,
} from '../engine/stock-data';
import './StockPanel.css';

const TIMEFRAMES: Array<{ label: string; bars: number }> = [
  { label: '1M', bars: 21 },
  { label: '3M', bars: 63 },
  { label: '6M', bars: 126 },
  { label: '1Y', bars: 252 },
  { label: '5Y', bars: 1260 },
  { label: 'All', bars: 0 },
];

const UP = '#16a34a';
const DOWN = '#dc2626';

// Chart insets. Module-scoped so it is a stable reference (keeps the draw
// effect's dependency list honest instead of silencing exhaustive-deps).
const PAD = { left: 10, right: 58, top: 12, bottom: 24 };

interface SeriesData {
  symbol: string;
  color: string;
  bars: StockBar[];
  values: number[]; // close, or % change in compare mode
  synthetic: boolean;
}

function formatPrice(v: number): string {
  return v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : v.toFixed(2);
}

function formatDate(t: number, longRange: boolean): string {
  const d = new Date(t);
  return longRange
    ? d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Round tick steps to 1/2/5 × 10^n so axis labels look intentional. */
function niceStep(range: number, targetTicks: number): number {
  const raw = range / Math.max(1, targetTicks);
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(raw) || 1)));
  const norm = raw / mag;
  const step = norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1;
  return step * mag;
}

export const StockPanel: React.FC = React.memo(() => {
  const watchlist = useAccelStore((s) => s.watchlist);
  const addWatchedTicker = useAccelStore((s) => s.addWatchedTicker);
  const removeWatchedTicker = useAccelStore((s) => s.removeWatchedTicker);
  const toggleWatchedTicker = useAccelStore((s) => s.toggleWatchedTicker);
  // Bumped whenever async market data lands, so the chart redraws itself.
  const docVersion = useAccelStore((s) => s.docVersion);
  const timeframe = useAccelStore((s) => s.marketTimeframe);
  const setTimeframe = useAccelStore((s) => s.setMarketTimeframe);
  const customRange = useAccelStore((s) => s.marketCustomRange);
  const setStockPickerOpen = useAccelStore((s) => s.setStockPickerOpen);

  const [tickerInput, setTickerInput] = useState('');
  const [hover, setHover] = useState<{ index: number; px: number; py: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 600, height: 260 });

  // Kick off loads for anything on the watchlist that is not cached yet.
  useEffect(() => {
    watchlist.forEach((w) => {
      if (!isTickerLoaded(w.symbol)) requestTicker(w.symbol);
    });
  }, [watchlist]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const measure = () => {
      const rect = shell.getBoundingClientRect();
      setSize({ width: Math.max(280, rect.width), height: 260 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(shell);
    return () => observer.disconnect();
  }, []);

  const barCount = TIMEFRAMES.find((t) => t.label === timeframe)?.bars ?? 63;
  const visible = watchlist.filter((w) => w.visible);
  const compareMode = visible.length > 1;

  const series: SeriesData[] = useMemo(() => {
    void docVersion; // re-derive when data arrives
    const out: SeriesData[] = [];
    for (const w of visible) {
      const bars =
        timeframe === 'Custom' && customRange
          ? getStockBarsFrom(w.symbol, customRange.startMs, customRange.days)
          : getStockBars(w.symbol, barCount);
      if (!bars || bars.length === 0) continue;
      const closes = bars.map((b) => b.close);
      const values = compareMode
        ? closes.map((c) => (c / closes[0] - 1) * 100)
        : closes;
      out.push({ symbol: w.symbol, color: w.color, bars, values, synthetic: isSyntheticData(w.symbol) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist, barCount, compareMode, docVersion, timeframe, customRange]);

  // Single-ticker charts color by period performance, like trading apps.
  const singleTrendColor = useMemo(() => {
    if (compareMode || series.length === 0) return null;
    const v = series[0].values;
    return v[v.length - 1] >= v[0] ? UP : DOWN;
  }, [series, compareMode]);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    ctx.scale(dpr, dpr);

    const isDark = document.documentElement.getAttribute('data-theme')?.includes('dark');
    const axisText = isDark ? '#9ca3af' : '#6b7280';
    const gridColor = isDark ? 'rgba(148,163,184,0.15)' : 'rgba(100,116,139,0.15)';
    const crossColor = isDark ? 'rgba(148,163,184,0.5)' : 'rgba(100,116,139,0.5)';

    ctx.clearRect(0, 0, size.width, size.height);

    const plotW = size.width - PAD.left - PAD.right;
    const plotH = size.height - PAD.top - PAD.bottom;
    // Empty / loading / error states are rendered as an accessible HTML
    // overlay (see below) rather than as canvas text a screen reader can't
    // reach — here we just leave the canvas cleared.
    if (series.length === 0 || plotW <= 0) {
      return;
    }

    let vMin = Infinity;
    let vMax = -Infinity;
    let maxLen = 0;
    for (const s of series) {
      maxLen = Math.max(maxLen, s.values.length);
      for (const v of s.values) {
        if (v < vMin) vMin = v;
        if (v > vMax) vMax = v;
      }
    }
    if (vMin === vMax) {
      vMin -= 1;
      vMax += 1;
    }
    const vPad = (vMax - vMin) * 0.08;
    vMin -= vPad;
    vMax += vPad;

    const xAt = (i: number, len: number) =>
      PAD.left + (len <= 1 ? plotW / 2 : (i / (len - 1)) * plotW);
    const yAt = (v: number) => PAD.top + (1 - (v - vMin) / (vMax - vMin)) * plotH;

    // Horizontal gridlines + right-side value labels
    ctx.font = '11px sans-serif';
    const step = niceStep(vMax - vMin, 4);
    const firstTick = Math.ceil(vMin / step) * step;
    for (let v = firstTick; v <= vMax; v += step) {
      const y = yAt(v);
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + plotW, y);
      ctx.stroke();
      ctx.fillStyle = axisText;
      ctx.textAlign = 'left';
      ctx.fillText(compareMode ? `${v.toFixed(1)}%` : formatPrice(v), PAD.left + plotW + 6, y + 3);
    }

    // Date labels along the bottom (from the longest series)
    const longest = series.reduce((a, b) => (a.bars.length >= b.bars.length ? a : b));
    const len = longest.bars.length;
    const longRange = len > 300;
    const dateTickCount = Math.min(5, len);
    ctx.fillStyle = axisText;
    ctx.textAlign = 'center';
    for (let k = 0; k < dateTickCount; k++) {
      const i = Math.round((k / Math.max(1, dateTickCount - 1)) * (len - 1));
      const x = xAt(i, len);
      ctx.fillText(formatDate(longest.bars[i].t, longRange), x, size.height - 8);
    }

    // Series lines (area fill + trend color when a single ticker is shown)
    for (const s of series) {
      const color = compareMode ? s.color : singleTrendColor || s.color;
      const n = s.values.length;

      if (!compareMode) {
        const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + plotH);
        grad.addColorStop(0, color + '33');
        grad.addColorStop(1, color + '00');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(xAt(0, n), yAt(s.values[0]));
        for (let i = 1; i < n; i++) ctx.lineTo(xAt(i, n), yAt(s.values[i]));
        ctx.lineTo(xAt(n - 1, n), PAD.top + plotH);
        ctx.lineTo(xAt(0, n), PAD.top + plotH);
        ctx.closePath();
        ctx.fill();
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = xAt(i, n);
        const y = yAt(s.values[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Last-value dot
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(xAt(n - 1, n), yAt(s.values[n - 1]), 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crosshair
    if (hover && maxLen > 1) {
      const i = Math.min(hover.index, maxLen - 1);
      const x = xAt(i, maxLen);
      ctx.strokeStyle = crossColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, PAD.top);
      ctx.lineTo(x, PAD.top + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const s of series) {
        const si = Math.min(i, s.values.length - 1);
        ctx.fillStyle = compareMode ? s.color : singleTrendColor || s.color;
        ctx.beginPath();
        ctx.arc(xAt(si, s.values.length), yAt(s.values[si]), 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [series, size, hover, compareMode, singleTrendColor, visible.length]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (series.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const plotW = size.width - PAD.left - PAD.right;
    const maxLen = Math.max(...series.map((s) => s.values.length));
    const frac = Math.min(1, Math.max(0, (x - PAD.left) / Math.max(1, plotW)));
    const index = Math.round(frac * (maxLen - 1));
    setHover({ index, px: x, py: e.clientY - rect.top });
  };

  const handleAdd = () => {
    if (tickerInput.trim()) {
      addWatchedTicker(tickerInput);
      setTickerInput('');
    }
  };

  const maxLen = series.length > 0 ? Math.max(...series.map((s) => s.values.length)) : 0;
  const hoverIndex = hover ? Math.min(hover.index, Math.max(0, maxLen - 1)) : null;
  const anySynthetic = series.some((s) => s.synthetic);

  // Honest demo indicator: distinguish "no API key" (expected) from a real
  // live-fetch failure so we never silently mislead the user.
  const demoReason: 'offline' | 'error' | null = anySynthetic
    ? (series.find((s) => getSyntheticReason(s.symbol) === 'error') ? 'error' : 'offline')
    : null;

  // Chart status drives the overlay so a data-less card is never blank.
  const anyLoading = visible.some((w) => {
    const st = getTickerStatus(w.symbol);
    return st === 'loading' || st === 'missing';
  });
  let chartStatus: 'ok' | 'empty' | 'hidden' | 'loading' | 'norange' = 'ok';
  if (series.length === 0) {
    if (watchlist.length === 0) chartStatus = 'empty';
    else if (visible.length === 0) chartStatus = 'hidden';
    else if (anyLoading) chartStatus = 'loading';
    else chartStatus = 'norange';
  }
  const overlayMessage =
    chartStatus === 'empty'
      ? 'No tickers yet. Add a symbol above to chart its price history.'
      : chartStatus === 'hidden'
        ? 'All tickers are hidden. Click a chip to show it on the chart.'
        : chartStatus === 'loading'
          ? 'Loading market data…'
          : chartStatus === 'norange'
            ? 'No price data in the selected range. Try a different timeframe.'
            : '';

  return (
    <div className="stock-panel">
      <div className="stock-watchlist">
        {watchlist.map((w) => {
          const bars = getStockBars(w.symbol, 2);
          const last = bars && bars.length > 0 ? bars[bars.length - 1].close : null;
          const prev = bars && bars.length > 1 ? bars[bars.length - 2].close : null;
          const change = last !== null && prev !== null ? ((last / prev - 1) * 100) : null;
          return (
            <div
              key={w.symbol}
              role="button"
              tabIndex={0}
              aria-pressed={w.visible}
              aria-label={`${w.symbol}${last !== null ? `, ${formatPrice(last)}` : ''}, ${
                w.visible ? 'shown' : 'hidden'
              }. Press to ${w.visible ? 'hide' : 'show'} on the chart.`}
              className={`stock-chip ${w.visible ? '' : 'stock-chip--off'}`}
              onClick={() => toggleWatchedTicker(w.symbol)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleWatchedTicker(w.symbol);
                }
              }}
              title={w.visible ? 'Click to hide' : 'Click to show'}
            >
              <span className="stock-chip__dot" style={{ background: w.color }} />
              <span className="stock-chip__symbol">{w.symbol}</span>
              {last !== null ? (
                <>
                  <span className="stock-chip__price">{formatPrice(last)}</span>
                  {change !== null && (
                    <span className={`stock-chip__change ${change >= 0 ? 'up' : 'down'}`}>
                      {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
                    </span>
                  )}
                </>
              ) : (
                <span className="stock-chip__price">…</span>
              )}
              <button
                className="stock-chip__remove"
                onClick={(e) => {
                  e.stopPropagation();
                  removeWatchedTicker(w.symbol);
                }}
                title={`Remove ${w.symbol}`}
                aria-label={`Remove ${w.symbol}`}
              >
                ×
              </button>
            </div>
          );
        })}
        <div className="stock-add">
          <input
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Add ticker"
            maxLength={10}
            aria-label="Add ticker to watchlist"
          />
          <button className="btn ghost" onClick={handleAdd}>+</button>
          <button
            className="btn ghost"
            onClick={() => setStockPickerOpen(true)}
            title="Search stocks and pick a date range"
          >
            Browse…
          </button>
        </div>
      </div>

      <div className="stock-timeframes" role="group" aria-label="Chart timeframe">
        {TIMEFRAMES.map((t) => (
          <button
            key={t.label}
            className={`stock-tf ${timeframe === t.label ? 'active' : ''}`}
            aria-pressed={timeframe === t.label}
            onClick={() => setTimeframe(t.label)}
          >
            {t.label}
          </button>
        ))}
        {customRange && (
          <button
            className={`stock-tf ${timeframe === 'Custom' ? 'active' : ''}`}
            aria-pressed={timeframe === 'Custom'}
            onClick={() => setTimeframe('Custom')}
            title={`${new Date(customRange.startMs).toLocaleDateString()} + ${customRange.days} trading days`}
          >
            Custom
          </button>
        )}
        {compareMode && <span className="stock-mode-note">% change comparison</span>}
        {anySynthetic && (
          <span
            className={`stock-demo-note ${demoReason === 'error' ? 'is-error' : ''}`}
            title={
              demoReason === 'error'
                ? 'Live market data was unavailable (network, rate limit, or unknown symbol) — showing generated placeholder prices.'
                : 'No market API key configured — showing generated placeholder prices.'
            }
          >
            demo data
          </span>
        )}
      </div>

      <div className="stock-chart-shell" ref={shellRef}>
        <canvas
          ref={canvasRef}
          className="stock-chart"
          role="img"
          aria-label={
            series.length > 0
              ? `Price chart for ${series.map((s) => s.symbol).join(', ')}`
              : overlayMessage
          }
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHover(null)}
        />
        {series.length === 0 && (
          <div className="stock-chart-overlay" role="status" aria-live="polite">
            {chartStatus === 'loading' && <div className="stock-spinner" aria-hidden="true" />}
            <div className="stock-chart-overlay__msg">{overlayMessage}</div>
            {chartStatus === 'empty' && (
              <button
                className="btn ghost stock-chart-overlay__cta"
                onClick={() => setStockPickerOpen(true)}
              >
                Browse stocks
              </button>
            )}
          </div>
        )}
        {hover && hoverIndex !== null && series.length > 0 && (
          <div
            className="stock-tooltip"
            style={{
              left: Math.min(hover.px + 12, size.width - 150),
              top: 10,
            }}
          >
            <div className="stock-tooltip__date">
              {(() => {
                const longest = series.reduce((a, b) => (a.bars.length >= b.bars.length ? a : b));
                const bi = Math.min(hoverIndex, longest.bars.length - 1);
                return new Date(longest.bars[bi].t).toLocaleDateString('en-US', {
                  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                });
              })()}
            </div>
            {series.map((s) => {
              const si = Math.min(hoverIndex, s.values.length - 1);
              return (
                <div key={s.symbol} className="stock-tooltip__row">
                  <span className="stock-chip__dot" style={{ background: compareMode ? s.color : singleTrendColor || s.color }} />
                  <span>{s.symbol}</span>
                  <strong>
                    {compareMode ? `${s.values[si] >= 0 ? '+' : ''}${s.values[si].toFixed(2)}%` : formatPrice(s.values[si])}
                  </strong>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <StockPickerDialog />
    </div>
  );
});
