# Theme Dropdown + Last Starfighter Skin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the cycling theme button to a proper dropdown and add a fourth theme ("Last Starfighter" neon-vector arcade) alongside the existing Mission Control, LCARS, and Voltron skins. Closes issues #51 (Voltron — phase 2 polish via the dropdown) and #54 (Starfighter).

**Architecture:** The theme system is already data-attribute-driven (`body[data-theme="..."]`) with per-theme CSS files. This plan (a) extracts the theme registry into a pure module so we can unit-test it, (b) swaps the topbar cycling button for a `<select>` that reads from that registry, and (c) adds a new `styles/theme-starfighter.css` that follows the same scoping pattern as `theme-lcars.css` and `theme-voltron.css`.

**Tech Stack:** Vanilla ES modules, CSS custom properties, inline SVG. Tests use `node --test` (no DOM — we test the pure state helpers only). No new runtime deps.

---

## File Structure

**Modify:**
- `src/theme.js` — extract registry + pure helpers, add dropdown wire-up
- `index.html:26` — replace `<button id="theme-toggle-btn">` with `<select id="theme-select">`; add `<link>` for the new theme CSS
- `package.json` — bump version to `0.9.0`

**Create:**
- `styles/theme-starfighter.css` — the new skin, scoped under `body[data-theme="starfighter"]`
- `sim/theme.test.mjs` — node tests for the pure helpers in `src/theme.js`

**No changes:**
- `styles/theme.css` (default Mission Control) — stays the baseline
- `styles/theme-lcars.css`, `styles/theme-voltron.css` — existing themes already compatible
- `src/main.js` and gameplay modules — theme is independent of game logic

---

## Task 0: Branch setup

**Files:** none

- [ ] **Step 1: Create feature branch**

Run from repo root:
```bash
git checkout -b feat/theme-dropdown-starfighter
git status
```
Expected: clean working tree, on new branch.

---

## Task 1: Extract pure theme registry + helpers (TDD)

**Goal:** Make the "which themes exist / what's stored / how to resolve" logic testable without a DOM, so the dropdown work in Task 2 can reuse it and we have a regression gate on the registry shape.

**Files:**
- Modify: `src/theme.js`
- Create: `sim/theme.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `sim/theme.test.mjs`:
```js
// Tests for src/theme.js pure helpers. Run: node --test sim/theme.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, resolveTheme, STORAGE_KEY } from '../src/theme.js';

test('THEMES exposes the four supported skins in display order', () => {
  assert.deepEqual(
    THEMES.map(t => t.id),
    ['mc', 'lcars', 'voltron', 'starfighter']
  );
});

test('each theme has an id and a human label', () => {
  for (const t of THEMES) {
    assert.equal(typeof t.id, 'string');
    assert.ok(t.id.length > 0);
    assert.equal(typeof t.label, 'string');
    assert.ok(t.label.length > 0);
  }
});

test('resolveTheme returns mc for unknown / missing input', () => {
  assert.equal(resolveTheme(null), 'mc');
  assert.equal(resolveTheme(undefined), 'mc');
  assert.equal(resolveTheme(''), 'mc');
  assert.equal(resolveTheme('bogus'), 'mc');
});

test('resolveTheme returns the id unchanged for known themes', () => {
  assert.equal(resolveTheme('mc'), 'mc');
  assert.equal(resolveTheme('lcars'), 'lcars');
  assert.equal(resolveTheme('voltron'), 'voltron');
  assert.equal(resolveTheme('starfighter'), 'starfighter');
});

test('STORAGE_KEY is stable (migrations would break existing users)', () => {
  assert.equal(STORAGE_KEY, 'marsTrail.theme');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test sim/theme.test.mjs`
Expected: FAIL — `THEMES` / `resolveTheme` are not currently exported (module uses DOM at top-level, so the import itself may also fail with `document is not defined`).

- [ ] **Step 3: Refactor `src/theme.js` to split pure helpers from DOM code**

Replace the full contents of `src/theme.js` with:
```js
// Tractus Martis — theme switcher.
// Pure helpers (THEMES, resolveTheme, STORAGE_KEY) are importable in Node
// for testing. DOM wiring only runs when `document` is defined.

export const STORAGE_KEY = 'marsTrail.theme';

export const THEMES = [
  { id: 'mc',          label: 'Mission Control' },
  { id: 'lcars',       label: 'LCARS / TNG' },
  { id: 'voltron',     label: 'Voltron HUD' },
  { id: 'starfighter', label: 'Last Starfighter' }
];

export function resolveTheme(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return 'mc';
  return THEMES.some(t => t.id === raw) ? raw : 'mc';
}

function load() {
  if (typeof localStorage === 'undefined') return 'mc';
  return resolveTheme(localStorage.getItem(STORAGE_KEY));
}

function save(theme) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, theme);
}

function apply(theme) {
  if (typeof document === 'undefined') return;
  if (theme === 'mc') {
    document.body.removeAttribute('data-theme');
  } else {
    document.body.setAttribute('data-theme', theme);
  }
  const select = document.getElementById('theme-select');
  if (select && select.value !== theme) select.value = theme;
}

export function initTheme() {
  if (typeof document === 'undefined') return;
  apply(load());
  const select = document.getElementById('theme-select');
  if (select) {
    select.addEventListener('change', (e) => {
      const next = resolveTheme(e.target.value);
      save(next);
      apply(next);
    });
  }
}

if (typeof document !== 'undefined') {
  initTheme();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test sim/theme.test.mjs`
Expected: PASS — 5 tests ok.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `node --test sim/*.test.mjs`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/theme.js sim/theme.test.mjs
git commit -m "Theme registry: extract pure helpers; add starfighter to the list (refs #51 #54)"
```

---

## Task 2: Swap topbar button for dropdown

**Goal:** Replace the cycling button with a `<select>`. The registry from Task 1 drives the option list, so adding future themes is a one-line change.

**Files:**
- Modify: `index.html:11-13` (stylesheet links) and `index.html:26` (button)
- Modify: `src/theme.js` (add a helper that populates the `<select>`)

- [ ] **Step 1: Add the starfighter stylesheet link and replace the toggle button in `index.html`**

In `index.html`, find:
```html
  <link rel="stylesheet" href="styles/theme-lcars.css">
  <link rel="stylesheet" href="styles/theme-voltron.css">
```
and replace with:
```html
  <link rel="stylesheet" href="styles/theme-lcars.css">
  <link rel="stylesheet" href="styles/theme-voltron.css">
  <link rel="stylesheet" href="styles/theme-starfighter.css">
```

Then find:
```html
      <button id="theme-toggle-btn" class="theme-toggle" type="button">TNG SKIN</button>
```
and replace with:
```html
      <select id="theme-select" class="theme-select" aria-label="Interface theme"></select>
```

- [ ] **Step 2: Populate the dropdown from the registry in `src/theme.js`**

In `src/theme.js`, replace the `initTheme` function with:
```js
function populate(select) {
  select.innerHTML = '';
  for (const t of THEMES) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.label;
    select.appendChild(opt);
  }
}

export function initTheme() {
  if (typeof document === 'undefined') return;
  const current = load();
  const select = document.getElementById('theme-select');
  if (select) {
    populate(select);
    select.value = current;
    select.addEventListener('change', (e) => {
      const next = resolveTheme(e.target.value);
      save(next);
      apply(next);
    });
  }
  apply(current);
}
```

- [ ] **Step 3: Style the dropdown so it reads cleanly in all four themes**

Append to `styles/theme.css`:
```css
.theme-select {
  font-family: inherit;
  font-size: 10px;
  letter-spacing: 0.1em;
  background: transparent;
  color: var(--fg);
  border: 1px solid var(--fg-faint);
  padding: 3px 8px;
  margin-left: 12px;
  cursor: pointer;
}
.theme-select:focus-visible {
  outline: 1px solid var(--fg);
  outline-offset: 2px;
}
.theme-select option {
  background: var(--bg);
  color: var(--fg);
}
```

Append to `styles/theme-lcars.css` (the tan topbar needs black text, same logic the existing sci-counter uses):
```css
body[data-theme="lcars"] .theme-select {
  color: #000;
  background: rgba(0, 0, 0, 0.06);
  border-color: rgba(0, 0, 0, 0.35);
}
body[data-theme="lcars"] .theme-select option {
  color: var(--fg);
  background: #000;
}
```

Append to `styles/theme-voltron.css` (match the existing music-select treatment):
```css
body[data-theme="voltron"] .theme-select {
  color: var(--fg-dim);
  background: rgba(8, 24, 40, 0.5);
  border-color: rgba(75, 216, 255, 0.35);
}
body[data-theme="voltron"] .theme-select option {
  background: var(--bg);
  color: var(--fg);
}
```

- [ ] **Step 4: Visual smoke-test in browser**

Start the dev server in one terminal:
```bash
python3 -m http.server 8080
```
Open `http://localhost:8080` in a browser. Verify:
- The dropdown appears in the topbar with 4 options: Mission Control, LCARS / TNG, Voltron HUD, Last Starfighter.
- Selecting each option applies the correct theme (Starfighter will currently fall back to the default look — that's fine; Task 3 adds the styles).
- Reload the page — the last-selected theme persists.
- The dropdown itself is readable in every theme (black text on LCARS orange strip, cyan on Voltron, phosphor green on MC).

- [ ] **Step 5: Run tests to confirm nothing regressed**

Run: `node --test sim/theme.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add index.html src/theme.js styles/theme.css styles/theme-lcars.css styles/theme-voltron.css
git commit -m "Theme picker: swap cycling button for a dropdown (closes #51 phase 2)"
```

---

## Task 3: Starfighter skin — palette, panels, topbar, buttons

**Goal:** Get the core Starfighter look on screen: pure-black backdrop, red corner brackets framing each panel, neon accent palette, arcade-condensed typography. Matches the HUD portion of issue #54's spec (everything except the central polar radar, which is Task 4).

**Files:**
- Create: `styles/theme-starfighter.css`

- [ ] **Step 1: Create the file with palette + base scoping**

Create `styles/theme-starfighter.css`:
```css
/* Mars Trail — Last Starfighter cockpit HUD skin (#54).
   Neon-vector arcade: pure-black void, red corner brackets, green radar,
   yellow crest emblems, segmented meters. Distinct from Voltron's
   monochrome cyan hologram look — this one is multi-color. */

body[data-theme="starfighter"] {
  --bg:        #000000;
  --bg-panel:  rgba(0, 0, 0, 0.92);
  --grid:      transparent;

  --fg:        #ffd21a;               /* arcade yellow — headlines / emblems */
  --fg-dim:    #3bff7a;               /* neon green — body text / positive */
  --fg-faint:  #55e6ff;               /* cyan — secondary labels / ticks */

  --sf-red:    #ff2840;               /* primary frame / warning */
  --sf-red-dim:rgba(255, 40, 64, 0.55);

  --warn:      #ffd21a;
  --crit:      #ff2840;
  --healthy:   #3bff7a;

  --glow:        0 0 4px rgba(255, 210, 26, 0.7);
  --glow-strong: 0 0 8px rgba(255, 40, 64, 0.8),
                 0 0 16px rgba(255, 40, 64, 0.35);

  --font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  --font-size: 13px;
  --line-h:    1.4;

  background: var(--bg);
  background-image: none;
  color: var(--fg-dim);
  letter-spacing: 0.08em;
}

/* Stronger CRT scanlines — arcade monitor feel */
body[data-theme="starfighter"] .scanlines {
  background: repeating-linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0) 0,
    rgba(0, 0, 0, 0) 2px,
    rgba(0, 0, 0, 0.28) 3px,
    rgba(0, 0, 0, 0) 4px
  );
}

/* ---- Topbar ---- */

body[data-theme="starfighter"] .topbar {
  background: #000;
  color: var(--fg);
  border-bottom: 1px solid var(--sf-red);
  box-shadow: 0 2px 0 var(--sf-red-dim);
  letter-spacing: 0.22em;
  font-weight: 600;
  text-transform: uppercase;
}
body[data-theme="starfighter"] .topbar .brand {
  color: var(--fg);
  text-shadow: var(--glow);
}
body[data-theme="starfighter"] .topbar .clock {
  color: var(--fg-dim);
  text-shadow: 0 0 4px rgba(59, 255, 122, 0.6);
}
body[data-theme="starfighter"] .topbar .sci-counter {
  color: var(--fg);
  background: rgba(255, 210, 26, 0.08);
  border-color: rgba(255, 210, 26, 0.45);
  text-shadow: var(--glow);
}
body[data-theme="starfighter"] .topbar #music-select,
body[data-theme="starfighter"] .topbar #music-mute,
body[data-theme="starfighter"] .topbar .theme-select {
  color: var(--fg-dim);
  background: #000;
  border-color: var(--sf-red-dim);
}
body[data-theme="starfighter"] .topbar #music-select option,
body[data-theme="starfighter"] .topbar .theme-select option {
  background: #000;
  color: var(--fg-dim);
}

/* ---- Panels: black rectangles with red corner brackets ---- */

body[data-theme="starfighter"] .panel {
  position: relative;
  background: var(--bg-panel);
  border: 1px solid rgba(255, 40, 64, 0.22);   /* faint side hint; brackets carry the frame */
  border-radius: 0;
  box-shadow: inset 0 0 22px rgba(0, 0, 0, 0.6);
}

/* Red right-angle corner brackets — the signature Starfighter frame. */
body[data-theme="starfighter"] .panel::before,
body[data-theme="starfighter"] .panel::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  pointer-events: none;
  filter: drop-shadow(0 0 3px rgba(255, 40, 64, 0.9));
}
body[data-theme="starfighter"] .panel::before {
  top: -1px;
  left: -1px;
  border-top: 3px solid var(--sf-red);
  border-left: 3px solid var(--sf-red);
}
body[data-theme="starfighter"] .panel::after {
  bottom: -1px;
  right: -1px;
  border-bottom: 3px solid var(--sf-red);
  border-right: 3px solid var(--sf-red);
}

body[data-theme="starfighter"] .panel-title {
  color: var(--fg);
  text-shadow: var(--glow);
  border-bottom: 1px solid rgba(255, 210, 26, 0.35);
  letter-spacing: 0.3em;
  text-transform: uppercase;
  font-weight: 600;
}

/* ---- Segmented telemetry bars ---- */

body[data-theme="starfighter"] .bar {
  background: transparent;
  border: 1px solid rgba(59, 255, 122, 0.4);
  border-radius: 0;
  box-shadow: none;
  /* cells drawn with a 10-segment gradient mask on .bar-fill */
}
body[data-theme="starfighter"] .bar-fill {
  background:
    repeating-linear-gradient(
      to right,
      var(--fg-dim) 0,
      var(--fg-dim) 8%,
      transparent 8%,
      transparent 10%
    );
  box-shadow: 0 0 4px rgba(59, 255, 122, 0.6);
}
body[data-theme="starfighter"] .readout.warn .bar-fill {
  background:
    repeating-linear-gradient(to right, var(--warn) 0, var(--warn) 8%, transparent 8%, transparent 10%);
  box-shadow: 0 0 4px rgba(255, 210, 26, 0.6);
}
body[data-theme="starfighter"] .readout.crit .bar-fill {
  background:
    repeating-linear-gradient(to right, var(--crit) 0, var(--crit) 8%, transparent 8%, transparent 10%);
  box-shadow: 0 0 4px rgba(255, 40, 64, 0.7);
}
body[data-theme="starfighter"] .readout-label {
  color: var(--fg-faint);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
body[data-theme="starfighter"] .readout-value {
  color: var(--fg);
  text-shadow: var(--glow);
  font-variant-numeric: tabular-nums;
}

/* ---- Buttons ---- */

body[data-theme="starfighter"] button {
  background: #000;
  color: var(--fg-dim);
  border: 1px solid var(--sf-red);
  border-radius: 0;
  padding: 6px 14px;
  font-family: var(--font-mono);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  text-shadow: 0 0 3px rgba(59, 255, 122, 0.5);
  transition: all 100ms ease;
}
body[data-theme="starfighter"] button:hover:not(:disabled) {
  background: var(--sf-red);
  color: #000;
  box-shadow: var(--glow-strong);
  text-shadow: none;
}
body[data-theme="starfighter"] button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

body[data-theme="starfighter"] .btn-primary {
  background: var(--sf-red);
  color: #000;
  border-color: var(--sf-red);
  box-shadow: var(--glow-strong);
  font-weight: 700;
}
body[data-theme="starfighter"] .btn-primary:hover:not(:disabled) {
  background: var(--fg);
  color: #000;
  border-color: var(--fg);
}
body[data-theme="starfighter"] .btn-secondary {
  background: #000;
  color: var(--fg);
  border-color: var(--fg);
}
body[data-theme="starfighter"] .btn-secondary:hover:not(:disabled) {
  background: var(--fg);
  color: #000;
}
```

- [ ] **Step 2: Visual smoke-test**

Ensure the dev server from Task 2 Step 4 is still running (or restart `python3 -m http.server 8080`). Select "Last Starfighter" in the dropdown. Verify:
- Background is pure black.
- Every panel has red corner brackets on the top-left and bottom-right.
- Panel titles are yellow with a soft glow.
- Telemetry bars render as segmented green cells (red/yellow in warn/crit).
- Buttons are black with red borders; primary CTAs are solid red.
- The topbar reads yellow + green + red, not the MC phosphor green.
- Switching back to MC / LCARS / Voltron still works and looks correct.

- [ ] **Step 3: Commit**

```bash
git add styles/theme-starfighter.css
git commit -m "Starfighter theme: base palette, red corner brackets, segmented meters (refs #54)"
```

---

## Task 4: Starfighter skin — central polar radar

**Goal:** Replace the default rectangular minimap styling with the Starfighter circular-radar look: concentric rings, clock-position numerals, faint radial spokes, a rotating green sweep line, and a green dot/reticle for the current position. The underlying SVG (`#minimap-path`, `#minimap-trail`, etc.) stays — we just restyle and overlay.

**Files:**
- Modify: `styles/theme-starfighter.css` (append)

- [ ] **Step 1: Re-skin the minimap rectangle to read as a polar display**

The existing minimap is a 200×100 SVG. We can't make it truly circular without changing HTML, but we can hide the default rect, overlay a radar graphic via CSS/SVG background on the containing `.panel-route .minimap` wrapper, and re-style the built-in trail/position markers in the red/green palette.

Append to `styles/theme-starfighter.css`:
```css
/* ---- Minimap re-skinned as polar radar ---- */

body[data-theme="starfighter"] .minimap {
  /* kill the default dark-green fill rect */
  background: #000;
  filter: drop-shadow(0 0 4px rgba(59, 255, 122, 0.6));
}
body[data-theme="starfighter"] .minimap > rect:first-child {
  fill: #000;
  stroke: var(--sf-red-dim);
  stroke-width: 0.6;
}
body[data-theme="starfighter"] #minimap-path {
  stroke: var(--sf-red-dim);
  stroke-dasharray: 2, 2;
}
body[data-theme="starfighter"] #minimap-trail {
  stroke: var(--fg-dim);
  filter: drop-shadow(0 0 3px rgba(59, 255, 122, 0.8));
}
body[data-theme="starfighter"] #minimap-position {
  fill: var(--fg-dim);
  stroke: #000;
}
body[data-theme="starfighter"] .landmark-dot         { fill: none; stroke: var(--fg); stroke-width: 0.8; }
body[data-theme="starfighter"] .landmark-dot.visited { stroke: var(--fg-dim); }
body[data-theme="starfighter"] .landmark-dot.current { fill: var(--fg-dim); stroke: #000; stroke-width: 0.5; }
body[data-theme="starfighter"] .landmark-dot.dest    { stroke: var(--sf-red); stroke-width: 1.2; }

/* Polar overlay: concentric rings + radial spokes + sweep line.
   Rendered as a CSS background on the route-section that contains the
   minimap so it reads as a round radar sitting in a rectangular panel. */
body[data-theme="starfighter"] .route-section:has(.minimap) {
  position: relative;
}
body[data-theme="starfighter"] .route-section:has(.minimap)::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(80%, 180px);
  aspect-ratio: 1 / 1;
  transform: translate(-50%, -50%);
  pointer-events: none;
  border-radius: 50%;
  background:
    /* outer ring */
    radial-gradient(circle, transparent 0 48%, rgba(255, 40, 64, 0.35) 48% 49%, transparent 49%),
    /* middle ring */
    radial-gradient(circle, transparent 0 32%, rgba(59, 255, 122, 0.25) 32% 33%, transparent 33%),
    /* inner ring */
    radial-gradient(circle, transparent 0 16%, rgba(59, 255, 122, 0.25) 16% 17%, transparent 17%),
    /* vertical crosshair */
    linear-gradient(to right, transparent 49.7%, rgba(59, 255, 122, 0.2) 49.7% 50.3%, transparent 50.3%),
    /* horizontal crosshair */
    linear-gradient(to bottom, transparent 49.7%, rgba(59, 255, 122, 0.2) 49.7% 50.3%, transparent 50.3%);
}

/* Rotating sweep line */
body[data-theme="starfighter"] .route-section:has(.minimap)::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(80%, 180px);
  aspect-ratio: 1 / 1;
  transform: translate(-50%, -50%);
  pointer-events: none;
  border-radius: 50%;
  background:
    conic-gradient(
      from 0deg,
      rgba(59, 255, 122, 0.45) 0deg,
      rgba(59, 255, 122, 0.15) 20deg,
      transparent 60deg,
      transparent 360deg
    );
  mask: radial-gradient(circle, black 48%, transparent 48.5%);
  -webkit-mask: radial-gradient(circle, black 48%, transparent 48.5%);
  mix-blend-mode: screen;
  animation: sf-radar-sweep 4s linear infinite;
}

@keyframes sf-radar-sweep {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to   { transform: translate(-50%, -50%) rotate(360deg); }
}

/* Respect reduced-motion preference */
@media (prefers-reduced-motion: reduce) {
  body[data-theme="starfighter"] .route-section:has(.minimap)::after {
    animation: none;
  }
}
```

- [ ] **Step 2: Visual smoke-test the radar**

With the dev server running, switch to Starfighter theme. In the ROUTE panel, under NAVIGATION, verify:
- The minimap sits inside a circular radar overlay with two concentric rings and a faint crosshair.
- A green sweep line rotates clockwise once every ~4 seconds.
- The route trail still draws in green; the planned path is faint red-dashed.
- The current-position dot is green and readable against the radar.
- Other themes (MC / LCARS / Voltron) are unaffected — no radar overlay, no sweep.

If the `:has()` selector shows compatibility issues in the user's browser (Safari ≥ 15.4, Chrome ≥ 105, Firefox ≥ 121), note it but proceed — modern browsers are the target.

- [ ] **Step 3: Commit**

```bash
git add styles/theme-starfighter.css
git commit -m "Starfighter theme: polar radar overlay with rotating sweep (refs #54)"
```

---

## Task 5: Starfighter skin — log, crew, modals, segmented controls

**Goal:** Cover the remaining UI surfaces so the theme is internally consistent. Nothing novel — just palette application following the patterns already set by `theme-lcars.css` and `theme-voltron.css`.

**Files:**
- Modify: `styles/theme-starfighter.css` (append)

- [ ] **Step 1: Append styles for log, crew, modals, segmented controls**

Append to `styles/theme-starfighter.css`:
```css
/* ---- Modal ---- */

body[data-theme="starfighter"] .modal-backdrop {
  background: rgba(0, 0, 0, 0.9);
}
body[data-theme="starfighter"] .modal-panel {
  background: #000;
  border: 1px solid var(--sf-red);
  border-radius: 0;
  box-shadow:
    0 0 24px rgba(255, 40, 64, 0.35),
    inset 0 0 40px rgba(0, 0, 0, 0.6);
  color: var(--fg-dim);
  position: relative;
}
/* modal gets corner brackets too */
body[data-theme="starfighter"] .modal-panel::before,
body[data-theme="starfighter"] .modal-panel::after {
  content: '';
  position: absolute;
  width: 22px;
  height: 22px;
  pointer-events: none;
  filter: drop-shadow(0 0 3px rgba(255, 40, 64, 0.9));
}
body[data-theme="starfighter"] .modal-panel::before {
  top: -1px; left: -1px;
  border-top: 3px solid var(--sf-red);
  border-left: 3px solid var(--sf-red);
}
body[data-theme="starfighter"] .modal-panel::after {
  bottom: -1px; right: -1px;
  border-bottom: 3px solid var(--sf-red);
  border-right: 3px solid var(--sf-red);
}
body[data-theme="starfighter"] .modal-title {
  color: var(--fg);
  text-shadow: var(--glow);
  text-transform: uppercase;
  letter-spacing: 0.3em;
}
body[data-theme="starfighter"] .modal-description { color: var(--fg-dim); }
body[data-theme="starfighter"] .modal-choice {
  background: #000;
  border: 1px solid var(--fg-dim);
  color: var(--fg-dim);
  border-radius: 0;
}
body[data-theme="starfighter"] .modal-choice:hover {
  background: var(--fg-dim);
  color: #000;
}
body[data-theme="starfighter"] .modal-choice.primary {
  background: var(--sf-red);
  border-color: var(--sf-red);
  color: #000;
  box-shadow: var(--glow-strong);
}
body[data-theme="starfighter"] .modal-choice.primary:hover {
  background: var(--fg);
  border-color: var(--fg);
  color: #000;
}

/* ---- Log ---- */

body[data-theme="starfighter"] .log { color: var(--fg-dim); }
body[data-theme="starfighter"] .log-entry {
  color: var(--fg-dim);
  border-left: 2px solid var(--sf-red-dim);
  padding-left: 6px;
}
body[data-theme="starfighter"] .log-entry::before {
  content: "►";
  color: var(--sf-red);
  margin-right: 4px;
}
body[data-theme="starfighter"] .log-entry .log-sol { color: var(--fg); }
body[data-theme="starfighter"] .log-entry.latest  { color: var(--fg); text-shadow: var(--glow); }
body[data-theme="starfighter"] .cursor { color: var(--sf-red); }

/* ---- Crew ---- */

body[data-theme="starfighter"] .crew-row { color: var(--fg-dim); }
body[data-theme="starfighter"] .crew-name { color: var(--fg); text-shadow: var(--glow); }
body[data-theme="starfighter"] .crew-role {
  background: rgba(255, 40, 64, 0.12);
  border: 1px solid var(--sf-red-dim);
  color: var(--fg);
  border-radius: 0;
}
body[data-theme="starfighter"] .crew-hp-text { color: var(--fg-dim); }
body[data-theme="starfighter"] .crew-hp-bar {
  background: transparent;
  border: 1px solid rgba(59, 255, 122, 0.35);
  border-radius: 0;
}
body[data-theme="starfighter"] .crew-hp-fill {
  background: var(--healthy);
  border-radius: 0;
  box-shadow: 0 0 4px rgba(59, 255, 122, 0.7);
}
body[data-theme="starfighter"] .crew-row[data-status="injured"]  .crew-hp-fill { background: var(--warn); box-shadow: 0 0 4px rgba(255, 210, 26, 0.7); }
body[data-theme="starfighter"] .crew-row[data-status="critical"] .crew-hp-fill { background: var(--crit); box-shadow: 0 0 4px rgba(255, 40, 64, 0.8); }
body[data-theme="starfighter"] .crew-row[data-status="dead"]     .crew-hp-fill { background: var(--fg-faint); box-shadow: none; opacity: 0.5; }

/* ---- Segmented controls (PACE / RATIONS) ---- */

body[data-theme="starfighter"] .control-label {
  color: var(--fg);
  letter-spacing: 0.15em;
  text-transform: uppercase;
}
body[data-theme="starfighter"] .seg {
  border: 1px solid var(--sf-red);
  border-radius: 0;
  gap: 0;
}
body[data-theme="starfighter"] .seg-btn {
  background: #000;
  color: var(--fg-dim);
  border: none;
  border-right: 1px solid var(--sf-red-dim);
  border-radius: 0;
  padding: 4px 10px;
  letter-spacing: 0.12em;
}
body[data-theme="starfighter"] .seg-btn:last-child { border-right: none; }
body[data-theme="starfighter"] .seg-btn.active {
  background: var(--sf-red);
  color: #000;
  text-shadow: none;
}

/* ---- Landmarks / itinerary ---- */

body[data-theme="starfighter"] .landmark { color: var(--fg-dim); }
body[data-theme="starfighter"] .landmark.current {
  color: var(--fg);
  text-shadow: var(--glow);
}
body[data-theme="starfighter"] .landmark.current .marker { color: var(--sf-red); }

body[data-theme="starfighter"] .route-section-header {
  color: var(--fg);
  border-bottom: 1px solid var(--sf-red-dim);
  text-transform: uppercase;
  letter-spacing: 0.18em;
}
body[data-theme="starfighter"] .route-location-name {
  color: var(--fg);
  text-shadow: var(--glow);
}
body[data-theme="starfighter"] .route-image {
  border: 1px solid var(--sf-red-dim);
  border-radius: 0;
}
```

- [ ] **Step 2: Visual smoke-test every screen**

With dev server running and Starfighter selected, click through:
- **Main dashboard** — crew rows, telemetry, log entries, PACE/RATIONS seg controls all legible and on-palette.
- **Trigger a modal** — play forward one sol to force a random event; verify modal has red corner brackets, yellow title, red primary button.
- **Away-team chain** — if one fires, confirm modal chain readable.
- **NEXT SOL** button — should be solid red (primary), CLEAN / REPAIR should be black with yellow borders.

Cross-check every theme still renders: flip through MC → LCARS → Voltron → Starfighter and back. No theme should have leaked styles.

- [ ] **Step 3: Commit**

```bash
git add styles/theme-starfighter.css
git commit -m "Starfighter theme: log, crew, modal, seg controls (closes #54)"
```

---

## Task 6: Version bump, verification, and PR

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Bump version**

In `package.json`, change `"version": "0.8.0"` to `"version": "0.9.0"`. This matches the "v0.9.x skin/polish pass" note from both issues.

- [ ] **Step 2: Run the full test suite one more time**

Run: `node --test sim/*.test.mjs`
Expected: all tests pass, including the new theme tests.

- [ ] **Step 3: Final visual pass**

With dev server running, for each of the four themes in turn:
- Reload the page; confirm the selected theme persists across reloads.
- Advance at least 3 sols; trigger an event modal; confirm log scroll and crew hp bars all look right.
- Watch for any hardcoded color that leaks through from a previous theme (red on MC, cyan on Starfighter, etc.).

- [ ] **Step 4: Commit version bump and tag**

```bash
git add package.json
git commit -m "v0.9.0: theme dropdown + Last Starfighter skin"
git tag v0.9.0
```

- [ ] **Step 5: Push branch and open PR**

```bash
git push -u origin feat/theme-dropdown-starfighter
gh pr create --title "Theme dropdown + Last Starfighter skin (closes #51 #54)" --body "$(cat <<'EOF'
## Summary
- Converts the cycling theme button to a proper `<select>` dropdown driven by a registry.
- Adds the Last Starfighter (neon-vector arcade) theme as the fourth skin — pure-black void, red corner brackets, central polar radar with rotating sweep, segmented meters, arcade typography.
- Extracts `THEMES` / `resolveTheme` / `STORAGE_KEY` from `src/theme.js` so the registry is unit-testable via `node --test`.
- Bumps to v0.9.0.

Closes #51 (phase 2: dropdown), closes #54.

## Test plan
- [ ] `node --test sim/*.test.mjs` — all tests pass (new `sim/theme.test.mjs` covers registry + resolver).
- [ ] Load page, confirm dropdown shows 4 options in order: Mission Control, LCARS / TNG, Voltron HUD, Last Starfighter.
- [ ] Flip through every theme — no hardcoded-color leaks between themes.
- [ ] Selected theme persists across reload (`localStorage` round-trip).
- [ ] Starfighter radar sweep animates at ~4s/rev; honors `prefers-reduced-motion`.
- [ ] Event modal reads correctly in every theme (backdrop, title, primary/secondary choices).
EOF
)"
```

Expected: PR URL returned — report it back to the user.

---

## Out of scope (explicitly not doing here)

- Lion / Gunstar / character art (licensing — called out in both issues).
- Additional CSS refactor to migrate any remaining hardcoded colors in `components.css` / `layout.css` / `modals.css` to variables. If leaks show up during visual QA in Task 5/6, fix them inline; otherwise defer.
- Alternate CRT scanline toggle as a user preference (the issue mentions it as toggleable — deferred; scanlines are on in Starfighter by default via the existing `.scanlines` div).
- A preview thumbnail per theme in the dropdown. Nice-to-have; not in spec.

---

## Self-review checklist (already completed)

- **Spec coverage:** Dropdown (#51 phase 2) → Task 2. Starfighter palette + panels + brackets → Task 3. Polar radar → Task 4. Log/crew/modal/seg polish → Task 5. Version + PR → Task 6. Both issues closed.
- **No placeholders:** every code block is complete; no "TBD" or "similar to above".
- **Type consistency:** `THEMES`, `resolveTheme`, `STORAGE_KEY`, `initTheme` are referenced with identical names in Task 1 (definition), the test file, and the init wire-up in Task 2.
