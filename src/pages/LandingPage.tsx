/**
 * Radix landing page — the public marketing entry point.
 *
 * Built on the shared Accel Suite design standard
 * (docs/ACCEL_SUITE_DESIGN_STANDARD.md). Section order follows the shared
 * landing skeleton so Radix, Argus, and Lumina read as one suite; only copy and
 * the product accent (emerald) differ here.
 *
 * Self-contained and route-safe: it renders under its own `.accel-suite
 * product-radix` scope so the suite tokens never leak into the editor's theme.
 */

import { Link } from 'react-router-dom';
import '../styles/accel-tokens.css';
import './LandingPage.css';

// The three products of the Accel Suite. Radix is "self"; the others link out
// (external URLs are placeholders until Argus/Lumina ship public pages).
const SUITE = [
  {
    key: 'radix',
    name: 'Radix',
    tagline: 'Compute',
    blurb: 'The spreadsheet + graphing engine. Excel muscle, Desmos-grade plots.',
    href: null as string | null, // self
  },
  {
    key: 'argus',
    name: 'Argus',
    tagline: 'Quant Research',
    blurb: 'Event studies, Pegasus signals, and a research log — powered by the Radix engine.',
    href: 'https://github.com/connectserverlab-del/argus',
  },
  {
    key: 'lumina',
    name: 'Lumina',
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
    body: 'Bring models in and take them out. Radix speaks the languages your analysis already lives in.',
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
    <div className="accel-suite product-radix radix-landing">
      {/* 1. Top bar */}
      <header className="rl-topbar">
        <div className="rl-wordmark">
          Radix<span className="rl-dot" aria-hidden="true">.</span>
        </div>
        <nav className="rl-switcher" aria-label="Accel Suite">
          {SUITE.map((p) => (
            <a
              key={p.key}
              className={`rl-switch-link${p.key === 'radix' ? ' is-active' : ''}`}
              href={p.href ?? '#top'}
            >
              {p.name}
            </a>
          ))}
        </nav>
        <Link className="rl-btn rl-btn-primary rl-topbar-cta" to="/">
          Open Radix
        </Link>
      </header>

      {/* 2. Hero */}
      <section className="rl-hero" id="top">
        <p className="rl-eyebrow">Part of the Accel Suite</p>
        <h1 className="rl-hero-title">
          The spreadsheet that thinks like a graphing calculator.
        </h1>
        <p className="rl-hero-sub">
          Radix pairs Excel-grade grids with built-in plotting and MATLAB/Python
          conversion — one calm, Obsidian-dark workspace for numbers, formulas,
          and models.
        </p>
        <div className="rl-hero-cta">
          <Link className="rl-btn rl-btn-primary" to="/">
            Open Radix
          </Link>
          <a className="rl-btn rl-btn-secondary" href="#features">
            See what's inside
          </a>
        </div>
        <div className="rl-hero-visual" role="img" aria-label="Radix workspace preview">
          <div className="rl-mock-grid">
            {Array.from({ length: 36 }).map((_, i) => (
              <span key={i} className="rl-mock-cell" />
            ))}
            <span className="rl-mock-curve" aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* 3. Part of the Accel Suite */}
      <section className="rl-suite-strip">
        <h2 className="rl-section-title">Partners in crime</h2>
        <p className="rl-section-sub">
          Radix is one island in a bridged archipelago. Each product does one
          thing beautifully — and hands off cleanly to the next.
        </p>
        <div className="rl-suite-cards">
          {SUITE.map((p) => (
            <a
              key={p.key}
              className={`rl-suite-card product-${p.key}${p.key === 'radix' ? ' is-self' : ''}`}
              href={p.href ?? '#top'}
            >
              <span className="rl-suite-tag">{p.tagline}</span>
              <span className="rl-suite-name">{p.name}</span>
              <span className="rl-suite-blurb">{p.blurb}</span>
              {p.key === 'radix' && <span className="rl-suite-here">You are here</span>}
            </a>
          ))}
        </div>
      </section>

      {/* 4. Feature triad */}
      <section className="rl-features" id="features">
        {FEATURES.map((f) => (
          <div key={f.title} className="rl-feature">
            <h3 className="rl-feature-title">{f.title}</h3>
            <p className="rl-feature-body">{f.body}</p>
          </div>
        ))}
      </section>

      {/* 5. Deep-dive rows */}
      <section className="rl-deepdives">
        {DEEP_DIVES.map((d, i) => (
          <div key={d.title} className={`rl-deepdive${i % 2 === 1 ? ' is-reversed' : ''}`}>
            <div className="rl-deepdive-copy">
              <p className="rl-kicker">{d.kicker}</p>
              <h3 className="rl-deepdive-title">{d.title}</h3>
              <p className="rl-deepdive-body">{d.body}</p>
            </div>
            <div className="rl-deepdive-visual" aria-hidden="true" />
          </div>
        ))}
      </section>

      {/* 6. Integration callout */}
      <section className="rl-integration">
        <h2 className="rl-section-title">One engine, three products</h2>
        <p className="rl-section-sub">
          Argus runs its event studies on the Radix compute engine. Lumina embeds
          live Radix models inside documents and mind maps. Build a model once —
          use it everywhere across the suite.
        </p>
        <a className="rl-btn rl-btn-secondary" href="https://github.com/connectserverlab-del/argus">
          Explore the suite
        </a>
      </section>

      {/* 7. Footer */}
      <footer className="rl-footer">
        <div className="rl-footer-brand">
          Radix<span className="rl-dot" aria-hidden="true">.</span>
          <span className="rl-footer-suite"> — an Accel Suite product</span>
        </div>
        <nav className="rl-switcher" aria-label="Accel Suite">
          {SUITE.map((p) => (
            <a key={p.key} className="rl-switch-link" href={p.href ?? '#top'}>
              {p.name}
            </a>
          ))}
        </nav>
      </footer>
    </div>
  );
}

export default LandingPage;
