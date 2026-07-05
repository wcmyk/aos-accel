import { useCallback, useState } from 'react';
import { useAccelStore } from '../store/accel-store';
import './StartScreen.css';

const DISMISS_KEY = 'radix:start-dismissed';

/**
 * First-run entry point. Instead of dropping the user onto a bare grid, offer
 * live modeling workflows to start from. Picking one applies its template and
 * closes; "blank workbook" just closes. Only shown when the workbook is empty
 * and hasn't been dismissed before.
 */
export function StartScreen() {
  const isReadOnly = useAccelStore((s) => s.isReadOnly);
  const docVersion = useAccelStore((s) => s.docVersion);
  const engine = useAccelStore((s) => s.engine);
  const insertMonteCarloModel = useAccelStore((s) => s.insertMonteCarloModel);
  const insertStockTemplate = useAccelStore((s) => s.insertStockTemplate);
  const insertEngineeringModel = useAccelStore((s) => s.insertEngineeringModel);
  const insertDataExploration = useAccelStore((s) => s.insertDataExploration);

  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  void docVersion; // re-check emptiness after any edit
  const isEmpty = engine.getSheetNames().every((n) => engine.getWorksheet(n).cells.size === 0);

  const close = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* storage unavailable — dismiss for this session only */
    }
  }, []);

  const pick = useCallback(
    (action: () => void) => {
      action();
      close();
    },
    [close]
  );

  if (isReadOnly || dismissed || !isEmpty) return null;

  const cards = [
    {
      key: 'mc',
      icon: '📈',
      title: 'Stock Risk Model',
      desc: 'Monte Carlo simulation of a stock — forecast range, probability of loss, Value at Risk, and the terminal-price distribution. Drag any assumption and watch it all update.',
      action: insertMonteCarloModel,
      accent: true,
    },
    {
      key: 'eng',
      icon: '🚀',
      title: 'Engineering Calc',
      desc: 'A projectile-motion calculator: set launch speed and angle, get range, height, and flight time with a live trajectory plot.',
      action: insertEngineeringModel,
      accent: false,
    },
    {
      key: 'data',
      icon: '📊',
      title: 'Data Exploration',
      desc: 'A sample dataset with instant summary statistics and a distribution chart — a starting point for exploring your own numbers.',
      action: insertDataExploration,
      accent: false,
    },
    {
      key: 'stock',
      icon: '💹',
      title: 'Live Market',
      desc: 'A ticker, a timeframe slider, and a live price chart driven by real market data.',
      action: insertStockTemplate,
      accent: false,
    },
  ];

  return (
    <div className="start-screen" role="dialog" aria-modal="true" aria-label="Choose a starting point">
      <div className="start-screen__panel">
        <header className="start-screen__head">
          <h1 className="start-screen__title">What do you want to build?</h1>
          <p className="start-screen__sub">
            Start from a live model — every input, calculation, and chart stays connected. Or open a blank workbook.
          </p>
        </header>
        <div className="start-screen__cards">
          {cards.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`start-card${c.accent ? ' start-card--accent' : ''}`}
              onClick={() => pick(c.action)}
            >
              <span className="start-card__icon" aria-hidden="true">{c.icon}</span>
              <span className="start-card__title">{c.title}</span>
              <span className="start-card__desc">{c.desc}</span>
            </button>
          ))}
        </div>
        <button type="button" className="start-screen__blank" onClick={close}>
          Start with a blank workbook →
        </button>
      </div>
    </div>
  );
}
