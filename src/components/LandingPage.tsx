import { Link } from 'react-router-dom';
import { isCloudEnabled } from '../lib/supabase';
import { useAuthStore } from '../store/auth-store';

const FEATURES = [
  {
    title: 'One engine, not two',
    body: 'Formulas and graphs share the same calculation engine. Drag a slider and watch every dependent cell and chart update instantly — no separate "charting mode."',
  },
  {
    title: 'Built for real research',
    body: 'Linear algebra, calculus, statistics, ODE/PDE solvers, and physics models are built in — not bolted on. This is a scientific computing environment, not a spreadsheet with trend lines.',
  },
  {
    title: 'Share without losing control',
    body: 'Save your workbooks, generate a read-only share link when you want feedback, and revoke it any time without breaking your own copy.',
  },
];

export function LandingPage() {
  const user = useAuthStore((state) => state.user);
  const primaryCta = !isCloudEnabled
    ? { to: '/app', label: 'Launch Radix' }
    : user
      ? { to: '/dashboard', label: 'Go to my workbooks' }
      : { to: '/login', label: 'Get started' };

  return (
    <div className="landing">
      <header className="landing__nav">
        <span className="landing__logo">Radix</span>
        <Link className="landing__nav-cta" to={primaryCta.to}>{primaryCta.label}</Link>
      </header>

      <section className="landing__hero">
        <h1>Spreadsheets, graphing, and scientific computing — unified.</h1>
        <p>
          Radix replaces the Excel-plus-Desmos-plus-MATLAB shuffle with one workspace:
          the same formula engine drives your tables and your graphs, with the numerical
          methods researchers and quants actually need built in from day one.
        </p>
        <Link className="landing__cta" to={primaryCta.to}>{primaryCta.label}</Link>
      </section>

      <section className="landing__features">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="landing__feature">
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
