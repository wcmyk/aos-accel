/**
 * Ribbon Component
 *
 * The primary action surface. Every control here performs a real operation
 * against the store — there are no decorative buttons. Tabs are limited to the
 * capabilities the engine actually supports (formatting, structure edits,
 * export, market data, automation, graphing, and theming).
 */

import React, { useState, useCallback } from 'react';
import { useAccelStore } from '../store/accel-store';
import { useShallow } from 'zustand/react/shallow';
import { CellFormat } from '../engine/types';
import { ParameterPanel } from './ParameterPanel';
import { AutomationPanel } from './AutomationPanel';
import { IconButton, ColorButton } from './Icons';
import './Ribbon.css';

type TabName = 'Home' | 'Insert' | 'Data' | 'Market' | 'Automation' | 'Graphing' | 'View';

const TABS: TabName[] = ['Home', 'Insert', 'Data', 'Market', 'Automation', 'Graphing', 'View'];

const colToLetter = (col: number): string => {
  let letter = '';
  let c = col;
  while (c > 0) {
    const remainder = (c - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    c = Math.floor((c - 1) / 26);
  }
  return letter;
};

export const Ribbon: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabName>('Home');
  const {
    selectedCell,
    selectionRange,
    copyCell,
    cutCell,
    pasteCell,
    formatCell,
    getCell,
    getCellObject,
    setCell,
    sortColumn,
    insertRow,
    deleteRow,
    insertColumn,
    deleteColumn,
    exportCSV,
    setParameter,
    addGraph,
    removeGraph,
    getGraphs,
    watchlist,
    removeWatchedTicker,
    toggleWatchedTicker,
    setStockPickerOpen,
    undo,
    redo,
    canUndo,
    canRedo,
    isReadOnly,
  } = useAccelStore(
    useShallow((s) => ({ selectedCell: s.selectedCell, selectionRange: s.selectionRange, copyCell: s.copyCell, cutCell: s.cutCell, pasteCell: s.pasteCell, formatCell: s.formatCell, getCell: s.getCell, getCellObject: s.getCellObject, setCell: s.setCell, sortColumn: s.sortColumn, insertRow: s.insertRow, deleteRow: s.deleteRow, insertColumn: s.insertColumn, deleteColumn: s.deleteColumn, exportCSV: s.exportCSV, setParameter: s.setParameter, addGraph: s.addGraph, removeGraph: s.removeGraph, getGraphs: s.getGraphs, watchlist: s.watchlist, removeWatchedTicker: s.removeWatchedTicker, toggleWatchedTicker: s.toggleWatchedTicker, setStockPickerOpen: s.setStockPickerOpen, undo: s.undo, redo: s.redo, canUndo: s.canUndo, canRedo: s.canRedo, isReadOnly: s.isReadOnly }))
  );

  // Theme is managed locally to avoid triggering re-renders across the whole app.
  const [localTheme, setLocalTheme] = useState<string>(() => {
    return document.documentElement.getAttribute('data-theme') || 'default';
  });

  // Dialog states for parameter and graph management.
  const [showParamDialog, setShowParamDialog] = useState(false);
  const [paramConfig, setParamConfig] = useState({ min: 0, max: 10, step: 0.1 });
  const [showGraphDialog, setShowGraphDialog] = useState(false);
  const [graphFormula, setGraphFormula] = useState('');

  const activeFormat = selectedCell
    ? getCellObject(selectedCell.row, selectedCell.col)?.format
    : undefined;

  const handleThemeChange = useCallback((newTheme: string) => {
    if (newTheme === localTheme) return;

    // Reuse or create the transition-disable style element so the theme swap
    // doesn't animate every element at once.
    let style = document.getElementById('disable-transitions') as HTMLStyleElement;
    if (!style) {
      style = document.createElement('style');
      style.id = 'disable-transitions';
      style.textContent = '* { transition: none !important; }';
      document.head.appendChild(style);
    }

    requestAnimationFrame(() => {
      document.documentElement.setAttribute('data-theme', newTheme);
      setLocalTheme(newTheme);
      requestAnimationFrame(() => {
        setTimeout(() => {
          const disableStyle = document.getElementById('disable-transitions');
          if (disableStyle) {
            document.head.removeChild(disableStyle);
          }
        }, 50);
      });
    });
  }, [localTheme]);

  const toggleFormat = useCallback((key: 'bold' | 'italic' | 'underline') => {
    if (!selectedCell) return;
    const cell = getCellObject(selectedCell.row, selectedCell.col);
    const next: Partial<CellFormat> = { [key]: !cell?.format?.[key] };
    formatCell(selectedCell.row, selectedCell.col, next);
  }, [selectedCell, getCellObject, formatCell]);

  const handleAddParameter = useCallback(() => {
    if (!selectedCell) return;
    setParameter(selectedCell.row, selectedCell.col, paramConfig.min, paramConfig.max, paramConfig.step);
    setShowParamDialog(false);
  }, [selectedCell, paramConfig, setParameter]);

  const handleAddGraph = useCallback(() => {
    if (!graphFormula.trim()) {
      alert('Please enter a formula');
      return;
    }
    try {
      addGraph(`graph_${Date.now()}`, graphFormula);
      setGraphFormula('');
      setShowGraphDialog(false);
    } catch (error) {
      alert(`Error adding graph: ${(error as Error).message}`);
    }
  }, [graphFormula, addGraph]);

  // AutoSum: write =SUM(...) over the run of numeric cells directly above the
  // selected cell. Falls back to no-op when there is nothing numeric to total.
  const handleAutoSum = useCallback(() => {
    if (!selectedCell) return;
    const { row, col } = selectedCell;
    let top = row - 1;
    while (top >= 1 && typeof getCell(top, col) === 'number') top -= 1;
    const startRow = top + 1;
    if (startRow > row - 1) return; // no numeric cells above
    const letter = colToLetter(col);
    setCell(row, col, `=SUM(${letter}${startRow}:${letter}${row - 1})`);
  }, [selectedCell, getCell, setCell]);

  // Clear contents of the current selection (or the single selected cell).
  const handleClear = useCallback(() => {
    const range = selectionRange
      ? selectionRange
      : selectedCell
        ? { start: selectedCell, end: selectedCell }
        : null;
    if (!range) return;
    const r1 = Math.min(range.start.row, range.end.row);
    const r2 = Math.max(range.start.row, range.end.row);
    const c1 = Math.min(range.start.col, range.end.col);
    const c2 = Math.max(range.start.col, range.end.col);
    for (let r = r1; r <= r2; r += 1) {
      for (let c = c1; c <= c2; c += 1) {
        setCell(r, c, '');
      }
    }
  }, [selectionRange, selectedCell, setCell]);

  const handleInsertStockTemplate = useCallback(() => {
    // Live market data template: a ticker cell, a timeframe slider, summary
    // formulas, and a chart — all bound to the same cells, so dragging the
    // slider re-slices the series and updates every view at once.
    setCell(1, 1, 'Ticker');
    setCell(1, 2, 'AAPL');
    setCell(2, 1, 'Days');
    setCell(2, 2, 90);
    setParameter(2, 2, 5, 365, 1);
    setCell(3, 1, 'Last price');
    setCell(3, 2, '=STOCK(B1, "price")');
    setCell(4, 1, 'Avg close');
    setCell(4, 2, '=AVERAGE(STOCK(B1, "close", B2))');
    setCell(5, 1, 'Chart');
    setCell(5, 2, '=PLOT(STOCK(B1, "close", B2))');
  }, [setCell, setParameter]);

  // Selection -> Graph bridge: turn the selected cells into a live plot.
  // One column (or row) plots as a single series; exactly two columns plot
  // as x/y pairs. The graph stays bound to the cells — edit them and the
  // plot follows, like everything else in the engine.
  const handlePlotSelection = useCallback(() => {
    const range = selectionRange
      ? selectionRange
      : selectedCell
        ? { start: selectedCell, end: selectedCell }
        : null;
    if (!range) return;

    const r1 = Math.min(range.start.row, range.end.row);
    const r2 = Math.max(range.start.row, range.end.row);
    const c1 = Math.min(range.start.col, range.end.col);
    const c2 = Math.max(range.start.col, range.end.col);

    let formula: string;
    if (c2 - c1 === 1) {
      formula = `PLOT(${colToLetter(c1)}${r1}:${colToLetter(c1)}${r2}, ${colToLetter(c2)}${r1}:${colToLetter(c2)}${r2})`;
    } else {
      formula = `PLOT(${colToLetter(c1)}${r1}:${colToLetter(c2)}${r2})`;
    }
    addGraph(`graph_${Date.now()}`, formula, 'plot');
  }, [selectionRange, selectedCell, addGraph]);

  // Market -> Sheet bridge: drop a live stats block for a watched ticker.
  // Every formula uses MARKETDAYS(), so the block recalculates when the
  // Market chart's timeframe changes.
  const handleInsertTickerBlock = useCallback((symbol: string) => {
    const anchor = selectedCell ?? { row: 1, col: 1 };
    const r = anchor.row;
    const c = anchor.col;
    setCell(r, c, symbol);
    setCell(r, c + 1, `=STOCK("${symbol}", "price")`);
    setCell(r + 1, c, 'Average');
    setCell(r + 1, c + 1, `=AVERAGE(STOCK("${symbol}", "close", MARKETDAYS()))`);
    setCell(r + 2, c, 'High');
    setCell(r + 2, c + 1, `=MAX(STOCK("${symbol}", "high", MARKETDAYS()))`);
    setCell(r + 3, c, 'Low');
    setCell(r + 3, c + 1, `=MIN(STOCK("${symbol}", "low", MARKETDAYS()))`);
    setCell(r + 4, c, 'Chart');
    setCell(r + 4, c + 1, `=PLOT(STOCK("${symbol}", "close", MARKETDAYS()))`);
  }, [selectedCell, setCell]);

  const hasSelection = !!(selectedCell || selectionRange);
  const canEdit = !isReadOnly;
  const cellDisabled = !selectedCell || !canEdit;

  const renderHomeTab = () => (
    <>
      <div className="ribbon-group">
        <p className="ribbon-title">Clipboard</p>
        <div className="ribbon-controls">
          <IconButton icon="content_cut" tooltip="Cut (Ctrl+X)" disabled={cellDisabled}
            onClick={() => selectedCell && cutCell(selectedCell.row, selectedCell.col)} />
          <IconButton icon="content_copy" tooltip="Copy (Ctrl+C)" disabled={!selectedCell}
            onClick={() => selectedCell && copyCell(selectedCell.row, selectedCell.col)} />
          <IconButton icon="content_paste" tooltip="Paste (Ctrl+V)" disabled={cellDisabled}
            onClick={() => selectedCell && pasteCell(selectedCell.row, selectedCell.col)} />
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Text</p>
        <div className="ribbon-controls">
          <IconButton icon="format_bold" tooltip="Bold (Ctrl+B)" disabled={cellDisabled}
            active={!!activeFormat?.bold} onClick={() => toggleFormat('bold')} />
          <IconButton icon="format_italic" tooltip="Italic (Ctrl+I)" disabled={cellDisabled}
            active={!!activeFormat?.italic} onClick={() => toggleFormat('italic')} />
          <IconButton icon="format_underlined" tooltip="Underline (Ctrl+U)" disabled={cellDisabled}
            active={!!activeFormat?.underline} onClick={() => toggleFormat('underline')} />
          <ColorButton icon="format_color_text" tooltip="Text color" disabled={cellDisabled}
            value={activeFormat?.fontColor ?? '#000000'}
            onChange={(v) => selectedCell && formatCell(selectedCell.row, selectedCell.col, { fontColor: v })} />
          <ColorButton icon="format_color_fill" tooltip="Fill color" disabled={cellDisabled}
            value={activeFormat?.backgroundColor ?? '#ffffff'}
            onChange={(v) => selectedCell && formatCell(selectedCell.row, selectedCell.col, { backgroundColor: v })} />
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Editing</p>
        <div className="ribbon-controls">
          <IconButton icon="functions" tooltip="Sum the numbers above the selected cell" disabled={cellDisabled}
            onClick={handleAutoSum} />
          <IconButton icon="backspace" tooltip="Clear contents of the selection (Delete)"
            disabled={!hasSelection || !canEdit} onClick={handleClear} />
        </div>
      </div>
    </>
  );

  const renderInsertTab = () => (
    <>
      <div className="ribbon-group">
        <p className="ribbon-title">Rows &amp; Columns</p>
        <div className="ribbon-controls">
          <IconButton icon="table_rows" label="Insert row" tooltip="Insert a row above the selected cell" disabled={cellDisabled}
            onClick={() => selectedCell && insertRow(selectedCell.row)} />
          <IconButton icon="delete" label="Delete row" tooltip="Delete the selected row" disabled={cellDisabled}
            onClick={() => selectedCell && deleteRow(selectedCell.row)} />
          <IconButton icon="view_column" label="Insert column" tooltip="Insert a column left of the selected cell" disabled={cellDisabled}
            onClick={() => selectedCell && insertColumn(selectedCell.col)} />
          <IconButton icon="delete" label="Delete column" tooltip="Delete the selected column" disabled={cellDisabled}
            onClick={() => selectedCell && deleteColumn(selectedCell.col)} />
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Charts</p>
        <div className="ribbon-controls">
          <IconButton icon="show_chart" label="Graph a formula" tooltip="Add a graph bound to a formula"
            onClick={() => setShowGraphDialog(true)} />
          <IconButton icon="insert_chart" label="Plot selection" disabled={!hasSelection} onClick={handlePlotSelection}
            tooltip="Plot the selected cells as a live graph (two columns = x/y pairs)" />
        </div>
      </div>
    </>
  );

  const renderDataTab = () => (
    <>
      <div className="ribbon-group">
        <p className="ribbon-title">Export</p>
        <div className="ribbon-controls">
          <IconButton icon="download" label="Download CSV" tooltip="Download the active sheet as a CSV file"
            onClick={exportCSV} />
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Sort</p>
        <div className="ribbon-controls">
          <IconButton icon="arrow_upward" label="Sort A → Z" tooltip="Sort the selected column ascending" disabled={cellDisabled}
            onClick={() => selectedCell && sortColumn(selectedCell.col, true)} />
          <IconButton icon="arrow_downward" label="Sort Z → A" tooltip="Sort the selected column descending" disabled={cellDisabled}
            onClick={() => selectedCell && sortColumn(selectedCell.col, false)} />
        </div>
      </div>
    </>
  );

  const renderMarketTab = () => (
    <>
      <div className="ribbon-group">
        <p className="ribbon-title">Stocks</p>
        <div className="ribbon-controls">
          <IconButton icon="search" label="Add stock…" tooltip="Choose a ticker and date range"
            onClick={() => setStockPickerOpen(true)} />
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Watchlist</p>
        <div className="ribbon-watchlist">
          {watchlist.length === 0 && <span className="dim-note">No stocks yet — add one on the left.</span>}
          {watchlist.map((w) => (
            <div key={w.symbol} className={`ribbon-watch-row ${w.visible ? '' : 'off'}`}>
              <span className="stock-chip__dot" style={{ background: w.color }} />
              <button className="ribbon-watch-name" onClick={() => toggleWatchedTicker(w.symbol)} title={w.visible ? 'Click to hide from chart' : 'Click to show on chart'}>
                {w.symbol}
              </button>
              <IconButton icon="table_rows" tooltip={`Insert a live ${w.symbol} stats block at the selected cell`} disabled={!canEdit}
                onClick={() => handleInsertTickerBlock(w.symbol)} />
              <IconButton icon="close" tooltip={`Remove ${w.symbol}`} onClick={() => removeWatchedTicker(w.symbol)} />
            </div>
          ))}
        </div>
      </div>

      <div className="ribbon-group">
        <p className="ribbon-title">Templates</p>
        <div className="ribbon-controls">
          <IconButton icon="candlestick_chart" label="Stock template" disabled={!canEdit} onClick={handleInsertStockTemplate}
            tooltip="Insert a live stock worksheet: ticker cell, timeframe slider, and a chart driven by =PLOT(STOCK(...))" />
        </div>
      </div>
    </>
  );

  const renderAutomationTab = () => (
    <div className="ribbon-group">
      <p className="ribbon-title">Automation</p>
      <AutomationPanel />
    </div>
  );

  const renderGraphingTab = () => {
    const graphs = getGraphs();

    return (
      <>
        <div className="ribbon-group">
          <p className="ribbon-title">Graph Settings</p>
          <div className="ribbon-controls">
            <IconButton icon="show_chart" label="Graph a formula" tooltip="Add a graph bound to a formula"
              onClick={() => setShowGraphDialog(true)} />
            <IconButton icon="insert_chart" label="Plot selection" disabled={!hasSelection} onClick={handlePlotSelection}
              tooltip="Plot the selected cells as a live graph (two columns = x/y pairs)" />
          </div>
          {graphs.length > 0 && (
            <div className="ribbon-graph-list">
              {graphs.map((graph) => (
                <div key={graph.id} className="ribbon-graph-item">
                  <span className="stock-chip__dot" style={{ background: graph.color }} />
                  <span className="ribbon-graph-formula">{graph.formula}</span>
                  <IconButton icon="close" tooltip="Remove graph" onClick={() => removeGraph(graph.id)} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ribbon-group">
          <p className="ribbon-title">Parameters</p>
          <div className="ribbon-controls">
            <IconButton icon="tune" label="Make slider" disabled={cellDisabled} onClick={() => setShowParamDialog(true)}
              tooltip="Turn the selected cell into a slider that drives recalculation" />
          </div>
          <ParameterPanel />
        </div>
      </>
    );
  };

  const renderViewTab = () => (
    <div className="ribbon-group">
      <p className="ribbon-title">Theme</p>
      <div className="ribbon-controls">
        <span className="ribbon-label">Theme</span>
        <select
          className="ribbon-input"
          value={localTheme}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleThemeChange(e.target.value)}
          title="Change the workbook color theme"
          aria-label="Color theme"
        >
          <option value="default">Default (Google)</option>
          <option value="pastel-yellow">Pastel Yellow</option>
          <option value="pastel-blue">Pastel Blue</option>
          <option value="pastel-brown">Pastel Brown</option>
          <option value="pastel-red">Pastel Red</option>
          <option value="pastel-pink">Pastel Pink</option>
          <option value="pastel-green">Pastel Green</option>
          <option value="pastel-purple">Pastel Purple</option>
          <option value="dark">Dark</option>
          <option value="dark-blue">Dark Blue</option>
          <option value="dark-green">Dark Green</option>
          <option value="dark-purple">Dark Purple</option>
        </select>
      </div>
    </div>
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'Home':
        return renderHomeTab();
      case 'Insert':
        return renderInsertTab();
      case 'Data':
        return renderDataTab();
      case 'Market':
        return renderMarketTab();
      case 'Automation':
        return renderAutomationTab();
      case 'Graphing':
        return renderGraphingTab();
      case 'View':
        return renderViewTab();
      default:
        return null;
    }
  };

  return (
    <>
      <div className="ribbon-tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            aria-pressed={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="ribbon" role="toolbar" aria-label={`${activeTab} tools`}>
        <div className="ribbon-group">
          <p className="ribbon-title">History</p>
          <div className="ribbon-controls">
            <IconButton icon="undo" tooltip="Undo (Ctrl+Z)" disabled={!canUndo || isReadOnly} onClick={undo} />
            <IconButton icon="redo" tooltip="Redo (Ctrl+Y)" disabled={!canRedo || isReadOnly} onClick={redo} />
          </div>
        </div>
        {renderActiveTab()}
      </div>

      {showGraphDialog && (
        <div className="dialog" role="dialog" aria-modal="true" onKeyDown={(e) => e.key === 'Escape' && setShowGraphDialog(false)}>
          <div className="dialog-content">
            <h3>Graph a formula</h3>
            <p className="dialog-subtitle">Use x as the variable. Reference cells to keep the graph in sync with the sheet.</p>
            <label>
              Formula
              <input
                type="text"
                value={graphFormula}
                onChange={(e) => setGraphFormula(e.target.value)}
                placeholder="A1 * x + B1"
                onKeyDown={(e) => e.key === 'Enter' && handleAddGraph()}
                autoFocus
              />
            </label>
            <div className="dialog-buttons">
              <button className="btn text" onClick={() => setShowGraphDialog(false)}>Cancel</button>
              <button className="btn primary" onClick={handleAddGraph}>Add graph</button>
            </div>
          </div>
        </div>
      )}

      {showParamDialog && (
        <div className="dialog" role="dialog" aria-modal="true" onKeyDown={(e) => e.key === 'Escape' && setShowParamDialog(false)}>
          <div className="dialog-content">
            <h3>Make a slider</h3>
            <p className="dialog-subtitle">The selected cell becomes a slider. Dragging it recalculates the sheet and graphs.</p>
            <label>
              Minimum
              <input
                type="number"
                value={paramConfig.min}
                onChange={(e) => setParamConfig({ ...paramConfig, min: parseFloat(e.target.value) })}
              />
            </label>
            <label>
              Maximum
              <input
                type="number"
                value={paramConfig.max}
                onChange={(e) => setParamConfig({ ...paramConfig, max: parseFloat(e.target.value) })}
              />
            </label>
            <label>
              Step
              <input
                type="number"
                value={paramConfig.step}
                step="0.01"
                onChange={(e) => setParamConfig({ ...paramConfig, step: parseFloat(e.target.value) })}
              />
            </label>
            <div className="dialog-buttons">
              <button className="btn text" onClick={() => setShowParamDialog(false)}>Cancel</button>
              <button className="btn primary" onClick={handleAddParameter}>Create slider</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
