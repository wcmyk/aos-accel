import { Component, ErrorInfo, ReactNode } from 'react';
import './ErrorBoundary.css';

// Key must match the local persistence key used by useAutosave.
const LOCAL_WORKBOOK_KEY = 'radix:workbook:v1';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Root-level crash guard. A thrown render/lifecycle error anywhere below this
 * boundary is caught here and shown as a friendly recovery screen instead of a
 * blank white page. Offers a plain reload and a "Reset workbook" escape hatch
 * for the case where a corrupt persisted workbook is what's crashing on load.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface for anyone watching the console; no external logger in scope.
    console.error('Tessera crashed:', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleReset = (): void => {
    try {
      localStorage.removeItem(LOCAL_WORKBOOK_KEY);
    } catch {
      // Storage unavailable (private mode) — nothing to clear; reload anyway.
    }
    window.location.reload();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="crash-screen" role="alert">
        <div className="crash-card">
          <div className="crash-card__glyph" aria-hidden="true">⚠</div>
          <h1 className="crash-card__title">Something went wrong</h1>
          <p className="crash-card__body">
            Tessera hit an unexpected error and had to stop. Your saved work is
            usually safe — reloading fixes most hiccups.
          </p>
          {error.message && (
            <pre className="crash-card__detail">{error.message}</pre>
          )}
          <div className="crash-card__actions">
            <button className="crash-btn crash-btn--primary" onClick={this.handleReload}>
              Reload
            </button>
            <button className="crash-btn" onClick={this.handleReset}>
              Reset workbook
            </button>
          </div>
          <p className="crash-card__note">
            "Reset workbook" clears the locally stored workbook, then reloads —
            use it only if reloading keeps crashing.
          </p>
        </div>
      </div>
    );
  }
}
