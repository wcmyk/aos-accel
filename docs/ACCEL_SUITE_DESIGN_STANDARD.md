# Accel Suite — Design Standard

_The shared visual + interaction language for every product in the Accel Suite:
**Radix** (compute), **Argus** (quant research), **Lumina** (docs & mind-mapping)._

This document is the single source of truth for how our services look and feel.
Each product ships its own landing page and app UI, but all of them draw from the
tokens, type scale, and component conventions defined here. The goal: three
distinct products that unmistakably read as **one suite** — "partners in crime"
that bridge into each other.

Reference implementation of these tokens lives in
[`src/styles/accel-tokens.css`](../src/styles/accel-tokens.css). Copy that file
into each repo (Radix / Argus / Lumina) so the suite stays in lockstep. When a
token changes, it changes here first, then propagates to every repo's copy.

---

## 1. Design DNA

Our aesthetic is **Obsidian, sharpened**: a calm, dark, low-chroma canvas that
gets out of the way of dense information (grids, equations, graphs, documents),
punctuated by a single confident accent per product. We borrow Obsidian's
restraint and its "your data is the interface" ethos, and we borrow the ease and
warmth of Google Docs / Excel for the interactions.

Principles:

1. **Content is the hero.** Chrome recedes. Backgrounds are near-black, borders
   are hairlines, and color is spent only where it earns attention.
2. **One suite, three voices.** A shared neutral palette + typography binds the
   suite; each product owns exactly one accent hue.
3. **Calm density.** Information-dense without feeling loud. Generous line-height,
   quiet dividers, no gratuitous shadows.
4. **Motion with intent.** Transitions are short (120–200ms) and functional —
   never decorative bounce.
5. **Legible math & data.** Numerals are tabular, code/formula is monospace, and
   contrast clears WCAG AA for body text.

---

## 2. Color Tokens

### Suite neutrals (shared by all three products)

| Token | Value | Use |
| --- | --- | --- |
| `--suite-bg` | `#0f1014` | App / page background (the "canvas") |
| `--suite-surface` | `#16181f` | Cards, panels, ribbons |
| `--suite-surface-2` | `#1e212b` | Raised surface, hover fills |
| `--suite-border` | `#2a2e3a` | Hairline dividers, cell borders |
| `--suite-border-strong` | `#3a4050` | Emphasized borders, focus outline base |
| `--suite-text` | `#e6e8ee` | Primary text |
| `--suite-text-dim` | `#a0a6b8` | Secondary text, labels |
| `--suite-text-faint` | `#6b7180` | Tertiary text, placeholders |
| `--suite-accent` | `#8b7cf6` | **Suite** accent (violet) — used on the suite hub, cross-product links |

### Per-product accents

Each product overrides `--product-accent` (and its soft/contrast variants). This
is the ONLY color that changes between products — everything else is shared.

| Product | `--product-accent` | Soft (`-soft`) | Character |
| --- | --- | --- | --- |
| **Radix** | `#2ecc71` (emerald) | `#123524` | Spreadsheet-green heritage; compute, precision |
| **Argus** | `#f4b740` (amber) | `#3a2c0e` | The watchful eye; signal, vigilance |
| **Lumina** | `#8b7cf6` (violet) | `#241f3d` | Light, ideas, connection |

`--product-accent-contrast` is the text color that sits on top of a filled
accent button — always `#0f1014` (the canvas) for our light accents.

### Semantic

| Token | Value | Use |
| --- | --- | --- |
| `--status-ok` | `#2ecc71` | Success, passing, up |
| `--status-warn` | `#f4b740` | Warning, pending |
| `--status-err` | `#ef5f5f` | Error, failing, down |

---

## 3. Typography

- **UI / body:** `Inter`, then system stack
  (`-apple-system, "Segoe UI", Roboto, sans-serif`).
- **Numerals & data:** enable `font-feature-settings: "tnum" 1` (tabular) so
  columns of numbers align — mandatory in grids and tables.
- **Formula / code / math:** `"JetBrains Mono", "SF Mono", "Cascadia Code",
  ui-monospace, monospace`.

### Type scale (1.25 ratio, 16px base)

| Token | Size / line-height | Use |
| --- | --- | --- |
| `--fs-display` | 48 / 1.1 | Landing hero |
| `--fs-h1` | 34 / 1.15 | Page title |
| `--fs-h2` | 26 / 1.2 | Section |
| `--fs-h3` | 20 / 1.3 | Subsection |
| `--fs-body` | 16 / 1.6 | Body |
| `--fs-sm` | 14 / 1.5 | Secondary, captions |
| `--fs-xs` | 12 / 1.4 | Labels, chips, meta |

Weights: 400 body, 500 UI labels, 600 headings, 700 display. Never bolder than
700; we lean on size and color for hierarchy, not weight.

---

## 4. Spacing, Radius, Elevation

- **Spacing scale (4px base):** `--sp-1: 4px`, `--sp-2: 8px`, `--sp-3: 12px`,
  `--sp-4: 16px`, `--sp-6: 24px`, `--sp-8: 32px`, `--sp-12: 48px`, `--sp-16: 64px`.
- **Radius:** `--radius-sm: 6px` (inputs, chips), `--radius-md: 10px` (cards,
  buttons), `--radius-lg: 16px` (modals, hero panels), `--radius-full: 999px`.
- **Elevation:** dark UIs use borders + subtle glows, not drop shadows.
  - `--elev-1: 0 1px 0 rgba(255,255,255,0.03) inset, 0 1px 2px rgba(0,0,0,0.4)`
  - `--elev-accent-glow: 0 0 0 1px var(--product-accent), 0 8px 30px -12px var(--product-accent)`

---

## 5. Components

### Buttons
- **Primary:** filled `--product-accent`, text `--product-accent-contrast`,
  radius `--radius-md`, `--sp-3`/`--sp-6` padding, 120ms ease on hover (lift via
  `--elev-accent-glow`).
- **Secondary:** transparent fill, `1px solid --suite-border-strong`, text
  `--suite-text`; hover fills `--suite-surface-2`.
- **Ghost:** no border, text `--suite-text-dim`; hover text `--suite-text`.

### Cards / Panels
`--suite-surface` background, `1px solid --suite-border`, `--radius-lg`, padding
`--sp-6`. Hover (if interactive): border → `--product-accent`, subtle glow.

### Inputs
`--suite-surface-2` background, `1px solid --suite-border-strong`,
`--radius-sm`; focus → `2px` outline in `--product-accent` at 40% opacity.

### Chips / Tags
`--radius-full`, `--fs-xs`, `--suite-surface-2` bg, `--suite-text-dim` text.
Accent chip = `--product-accent-soft` bg + `--product-accent` text.

### Navigation / Suite switcher
Every product surfaces a **suite switcher** (Radix · Argus · Lumina) so the
products visibly bridge into each other. Active product uses its accent; the
others are `--suite-text-dim` until hover.

---

## 6. Landing Page Anatomy (shared skeleton)

Every product landing page follows the same section order so the suite feels
coherent. Only copy and accent change.

1. **Top bar** — product wordmark (left) + suite switcher + primary CTA (right).
2. **Hero** — one-line promise (`--fs-display`), one-sentence subhead, primary +
   secondary CTA, and a product visual (screenshot/animation placeholder).
3. **"Part of the Accel Suite" strip** — three linked cards (Radix / Argus /
   Lumina) showing how this product bridges into the others.
4. **Feature triad** — three columns of the product's headline capabilities.
5. **Deep-dive rows** — alternating text/visual rows for 2–3 flagship features.
6. **Integration callout** — the cross-product story (e.g. "Argus runs on the
   Radix compute engine").
7. **Footer** — links, suite switcher again, subtle wordmark.

---

## 7. Accessibility & Motion

- Body text meets **WCAG AA** (≥ 4.5:1) on `--suite-bg`.
- Focus is always visible (accent outline); never remove outlines without a
  replacement.
- Respect `prefers-reduced-motion`: disable non-essential transitions/animation.
- Hit targets ≥ 40×40px on touch.

---

## 8. Governance

- This file is versioned in **Radix** (`aos-accel`) as the canonical copy.
- `accel-tokens.css` is mirrored into Argus and Lumina. A change lands here,
  then a follow-up PR syncs each repo's copy (tracked in Jira under each
  project's landing/standard epic: ACE-22 shared, ACE-23 Radix, ARQ-8 Argus,
  and the Lumina equivalent once LUM exists).
- Any new token is added here **before** it is used in a product.
