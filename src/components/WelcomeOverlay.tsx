import { useEffect, useState } from 'react';
import './WelcomeOverlay.css';

const DISMISS_KEY = 'radix:welcome-dismissed:v1';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    // Storage unavailable — treat as "already seen" so we never nag on every
    // render in environments where we can't persist the choice.
    return true;
  }
}

const STEPS: { icon: string; title: string; body: string }[] = [
  {
    icon: 'ƒ',
    title: 'Type a formula',
    body: 'Click any cell and enter =SIN(A1) or =2*B1+3. Tessera recalculates instantly, just like a spreadsheet.',
  },
  {
    icon: '◉',
    title: 'Bind a slider parameter',
    body: 'Select a numeric cell, then use Insert ▸ Parameter to turn it into a live slider with a min, max, and step.',
  },
  {
    icon: '📈',
    title: 'Watch the graph react',
    body: 'Plot a formula in the Graph card and drag the slider — the curve and market panel update in real time.',
  },
];

/**
 * First-run onboarding overlay. Teaches the core loop in one glance and
 * remembers dismissal in localStorage so it only greets a user once. Rendered
 * inside the editor so it sits above the workspace, not the auth/dashboard.
 */
export function WelcomeOverlay() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!readDismissed()) setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Non-fatal: the overlay still closes for this session.
    }
    setVisible(false);
  };

  return (
    <div className="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome-card">
        <button className="welcome-close" onClick={dismiss} aria-label="Dismiss welcome">
          ×
        </button>
        <div className="welcome-header">
          <span className="welcome-badge" aria-hidden="true">R</span>
          <div>
            <h2 id="welcome-title" className="welcome-title">Welcome to Tessera</h2>
            <p className="welcome-subtitle">
              A spreadsheet, live graphing, and market data — wired together.
            </p>
          </div>
        </div>

        <ol className="welcome-steps">
          {STEPS.map((step, i) => (
            <li key={step.title} className="welcome-step">
              <span className="welcome-step__icon" aria-hidden="true">{step.icon}</span>
              <div className="welcome-step__text">
                <span className="welcome-step__title">
                  <span className="welcome-step__num">{i + 1}</span>
                  {step.title}
                </span>
                <span className="welcome-step__body">{step.body}</span>
              </div>
            </li>
          ))}
        </ol>

        <div className="welcome-actions">
          <button className="welcome-btn welcome-btn--primary" onClick={dismiss}>
            Start building
          </button>
        </div>
      </div>
    </div>
  );
}
