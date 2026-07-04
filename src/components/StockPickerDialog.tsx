/**
 * Stock & Date Range picker.
 * Search or type any ticker, optionally choose a start date and number of
 * trading days to observe, and it lands on the Market chart. Opened from the
 * Market ribbon tab or the Market panel.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useAccelStore } from '../store/accel-store';
import { searchTickersLocal, searchTickersRemote, TickerMatch, getApiKey } from '../engine/stock-data';

export const StockPickerDialog: React.FC = () => {
  const open = useAccelStore((s) => s.stockPickerOpen);
  const setOpen = useAccelStore((s) => s.setStockPickerOpen);
  const addWatchedTicker = useAccelStore((s) => s.addWatchedTicker);
  const setMarketCustomRange = useAccelStore((s) => s.setMarketCustomRange);
  const setMarketTimeframe = useAccelStore((s) => s.setMarketTimeframe);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TickerMatch[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [days, setDays] = useState(90);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<number | null>(null);

  // Search as you type. Local curated matches render instantly; the
  // provider's full-universe search (when a key is configured) is debounced
  // and merged in when it lands, so the picker never sits on a spinner.
  useEffect(() => {
    if (!open) return;
    setResults(searchTickersLocal(query));
    setSearching(false);

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    let stale = false;
    debounceRef.current = window.setTimeout(() => {
      setSearching(true);
      searchTickersRemote(query).then((remote) => {
        if (stale) return;
        setSearching(false);
        if (remote && remote.length > 0) {
          const seen = new Set(remote.map((r) => r.symbol));
          setResults([...remote, ...searchTickersLocal(query).filter((l) => !seen.has(l.symbol))]);
        }
      });
    }, 300);
    return () => {
      stale = true;
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  if (!open) return null;

  const effectiveSymbol = (selected || query).trim().toUpperCase();
  const canAdd = /^[A-Z.\-:]{1,10}$/.test(effectiveSymbol);

  const handleAdd = () => {
    if (!canAdd) return;
    addWatchedTicker(effectiveSymbol);
    if (startDate) {
      const startMs = new Date(`${startDate}T00:00:00`).getTime();
      setMarketCustomRange(startMs, Math.max(1, days));
    } else {
      // No explicit date: keep whatever timeframe is active, but make sure
      // a stale custom window doesn't hide the new ticker's recent data.
      setMarketTimeframe('3M');
    }
    setOpen(false);
    setQuery('');
    setSelected('');
    setStartDate('');
  };

  return (
    <div className="dialog" onClick={() => setOpen(false)}>
      <div className="dialog-content stock-picker" onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="eyebrow">Market Data</p>
          <h3>Choose a stock & date range</h3>
          <p className="dialog-subtitle">
            {getApiKey()
              ? 'Search any listed symbol, then optionally pick a start date and how many trading days to observe.'
              : 'No market API key configured — searching a curated list; any symbol you type is charted with simulated data.'}
          </p>
        </div>

        <label>
          Stock (symbol or company name):
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="e.g. NVDA or Nvidia"
          />
        </label>

        <div className="stock-picker__results" role="listbox">
          {results.length === 0 && !searching && (
            <div className="stock-picker__hint">No matches — you can still add “{effectiveSymbol}” directly.</div>
          )}
          {results.slice(0, 8).map((r) => (
              <button
                key={r.symbol}
                role="option"
                aria-selected={selected === r.symbol}
                className={`stock-picker__row ${selected === r.symbol ? 'active' : ''}`}
                onClick={() => setSelected(r.symbol)}
                onDoubleClick={() => {
                  setSelected(r.symbol);
                  handleAdd();
                }}
              >
                <strong>{r.symbol}</strong>
                <span>{r.name}</span>
              </button>
            ))}
        </div>

        <div className="stock-picker__range">
          <label>
            Start date (optional):
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            Days of observation:
            <input
              type="number"
              min={1}
              max={3650}
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value, 10) || 90)}
            />
          </label>
        </div>

        <div className="dialog-buttons">
          <button className="btn" onClick={handleAdd} disabled={!canAdd}>
            {startDate ? 'Add & Show Range' : 'Add to Watchlist'}
          </button>
          <button className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </div>
    </div>
  );
};
