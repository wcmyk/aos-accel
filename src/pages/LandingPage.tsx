/**
 * Tessera landing page — the public marketing entry point.
 *
 * Built on the shared Lumina Suite design standard
 * (docs/LUMINA_SUITE_DESIGN_STANDARD.md). Section order follows the shared
 * landing skeleton so Tessera, Argus, and Vellum read as one suite; only copy and
 * the product accent (emerald) differ here.
 *
 * Self-contained and route-safe: it renders under its own `.lumina-suite
 * product-tessera` scope so the suite tokens never leak into the editor's theme.
 */

import { Link } from 'react-router-dom';
import '../styles/lumina-tokens.css';
import './LandingPage.css';

// The three products of the Lumina Suite. Tessera is "self"; the others link out
// (external URLs are placeholders until Argus/Vellum ship public pages).
const SUITE = [
  {
    key: 'tessera',
    name: 'Tessera',
    tagline: 'Compute',
    blurb: 'The spreadsheet + graphing engine. Excel muscle, Desmos-grade plots.',
    href: null as string | null, // self
  },
  {
    key: 'argus',
    name: 'Argus',
    tagline: 'Quant Research',
    blurb: 'Event studies, Pegasus signals, and a research log — powered by the Tessera engine.',
    href: 'https://github.com/connectserverlab-del/argus',
  },
  {
    key: 'vellum',
    name: 'Vellum',
    tagline: 'Docs & Mind-mapping',
    blurb: 'Google-Docs ease, Obsidian calm, clean math typing, and living mind maps.',
    href: '#',
  },
];

const FEATURES = [
  {
    title: 'A grid that feels like Excel',
    body: 'Fill series, freeze panes, right-click menus, find, and formulas you already know — with the keyboard-first flow you expect.',
  },
  {
    title: 'Graphing built in',
    body: 'Plot functions, parametrics, and live cell ranges on full-canvas graph sheets. No second tool, no export dance.',
  },
  {
    title: 'MATLAB & Python, both ways',
    body: 'Bring models in and take them out. Tessera speaks the languages your analysis already lives in.',
  },
];

const DEEP_DIVES = [
  {
    kicker: 'Precision compute',
    title: 'A calculation engine you can trust with a model',
    body: 'Dependency-tracked recalculation, tabular numerals, and serialization that round-trips every formula, format, and freeze pane. Your workbook is data, not a screenshot.',
  },
  {
    kicker: 'Obsidian-calm surface',
    title: 'Dense information without the noise',
    body: 'Near-black canvas, hairline dividers, one confident accent. The chrome recedes so the numbers, formulas, and graphs are the interface.',
  },
];

export function LandingPage() {
  return (
    <div className="lumina-suite product-tessera tessera-landing">
      {/* 1. Top bar */}
      <header className="tl-topbar">
        <div className="tl-wordmark">
          Tessera<span className="tl-dot" aria-hidden="true">.</span>
        </div>
        <nav className="tl-switcher" aria-label="Lumina Suite">
          {SUITE.map((p) => (
            <a
              key={p.key}
              className={`tl-switch-link${p.key === 'tessera' ? ' is-active' : ''}`}
              href={p.href ?? '#top'}
            >
              {p.name}
            </a>
          ))}
        </nav>
        <Link className="tl-btn tl-btn-primary tl-topbar-cta" to="/">
          Open Tessera
        </Link>
      </header>

      {/* 2. Hero */}
      <section className="tl-hero" id="top">
        <p className="tl-eyebrow">Part of the Lumina Suite</p>
        <h1 className="tl-hero-title">
          The spreadsheet that thinks like a graphing calculator.
        </h1>
        <p className="tl-hero-sub">
          Tessera pairs Excel-grade grids with built-in plotting and MATLAB/Python
          conversion — one calm, Obsidian-dark workspace for numbers, formulas,
          and models.
        </p>
        <div className="tl-hero-cta">
          <Link className="tl-btn tl-btn-primary" to="/">
            Open Tessera
          </Link>
          <a className="tl-btn tl-btn-secondary" href="#features">
            See what's inside
          </a>
        </div>
        <div className="tl-hero-visual" role="img" aria-label="Tessera workspace preview">
          <div className="tl-mock-grid">
            {Array.from({ length: 36 }).map((_, i) => (
              <span key={i} className="tl-mock-cell" />
            ))}
            <span className="tl-mock-curve" aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* 3. Part of the Lumina Suite */}
      <section className="tl-suite-strip">
        <h2 className="tl-section-title">Partners in crime</h2>
        <p className="tl-section-sub">
          Tessera is one island in a bridged archipelago. Each product does one
          thing beautifully — and hands off cleanly to the next.
        </p>
        <div className="tl-suite-cards">
          {SUITE.map((p) => (
            <a
              key={p.key}
              className={`tl-suite-card product-${p.key}${p.key === 'tessera' ? ' is-self' : ''}`}
              href={p.href ?? '#top'}
            >
              <span className="tl-suite-tag">{p.tagline}</span>
              <span className="tl-suite-name">{p.name}</span>
              <span className="tl-suite-blurb">{p.blurb}</span>
              {p.key === 'tessera' && <span className="tl-suite-here">You are here</span>}
            </a>
          ))}
        </div>
      </section>

      {/* 4. Feature triad */}
      <section className="tl-features" id="features">
        {FEATURES.map((f) => (
          <div key={f.title} className="tl-feature">
            <h3 className="tl-feature-title">{f.title}</h3>
            <p className="tl-feature-body">{f.body}</p>
          </div>
        ))}
      </section>

      {/* 5. Deep-dive rows */}
      <section className="tl-deepdives">
        {DEEP_DIVES.map((d, i) => (
          <div key={d.title} className={`tl-deepdive${i % 2 === 1 ? ' is-reversed' : ''}`}>
            <div className="tl-deepdive-copy">
              <p className="tl-kicker">{d.kicker}</p>
              <h3 className="tl-deepdive-title">{d.title}</h3>
              <p className="tl-deepdive-body">{d.body}</p>
            </div>
            <div className="tl-deepdive-visual" aria-hidden="true" />
          </div>
        ))}
      </section>

      {/* 6. Integration callout */}
      <section className="tl-integration">
        <h2 className="tl-section-title">One engine, three products</h2>
        <p className="tl-section-sub">
          Argus runs its event studies on the Tessera compute engine. Vellum embeds
          live Tessera models inside documents and mind maps. Build a model once —
          use it everywhere across the suite.
        </p>
        <a className="tl-btn tl-btn-secondary" href="https://github.com/connectserverlab-del/argus">
          Explore the suite
        </a>
      </section>

      {/* 7. Footer */}
      <footer className="tl-footer">
        <div className="tl-footer-brand">
          Tessera<span className="tl-dot" aria-hidden="true">.</span>
          <span className="tl-footer-suite"> — a Lumina Suite product</span>
        </div>
        <nav className="tl-switcher" aria-label="Lumina Suite">
          {SUITE.map((p) => (
            <a key={p.key} className="tl-switch-link" href={p.href ?? '#top'}>
              {p.name}
            </a>
          ))}
        </nav>
      </footer>
    </div>
  );
}

export default LandingPage;
