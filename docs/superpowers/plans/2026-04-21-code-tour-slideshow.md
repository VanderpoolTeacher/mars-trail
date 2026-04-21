# Code Tour Slideshow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, interactive, theme-toggleable HTML slideshow at `docs/walkthrough/index.html` that walks programmer-literate readers through the Mars Trail codebase in ~15 minutes.

**Architecture:** Vanilla ES modules (matches game). `index.html` loads the game's existing stylesheets for theming. `tour.js` is the engine (routing, keyboard, chrome); `slides.js` is a plain data module declaring the linear spine + hub branches. Demos live under `demos/` and import real game modules to stay honest. Routing-related logic is written as pure functions so it can be unit-tested with `node --test`.

**Tech Stack:** Vanilla JS (ES modules), vanilla CSS, `node --test` for unit tests. No build step. No server. Open the file directly in a browser.

**Spec:** `docs/superpowers/specs/2026-04-21-code-tour-slideshow-design.md`
**Issue:** #65

---

## File structure

**New:**
- `docs/walkthrough/index.html` — entry HTML; loads stylesheets, `tour.js`.
- `docs/walkthrough/tour.css` — layout primitives only (slide frame, nav bar, hub tiles, code block, progress).
- `docs/walkthrough/tour.js` — engine: boot, routing, keyboard, chrome, code-block wiring, demo dispatch.
- `docs/walkthrough/router.js` — **pure** routing helpers: `parseHash`, `hashFor`, `routeToSlide`, `routeForward`, `routeBack`. Unit-testable.
- `docs/walkthrough/slides.js` — content manifest: `spine` array (16 slides), hub slide `branches` array (8), each branch has `sub` array.
- `docs/walkthrough/repo.js` — single source of truth for `OWNER`, `REPO`, `BRANCH`, and `githubUrl(path, lineStart, lineEnd)` helper.
- `docs/walkthrough/demos/loop.js` — game-loop animation (no real-module import; explanatory).
- `docs/walkthrough/demos/eventPreview.js` — imports `src/content/events.js` + `src/ui/modals.js`; renders a random event card.
- `docs/walkthrough/demos/mashEmergency.js` — imports `src/systems/medicalEmergency.js` + `src/ui/modals.js`; runs a seeded click-mash rescue.
- `sim/walkthroughSmoke.test.mjs` — smoke test: imports each demo module under a minimal DOM shim and asserts init functions exist and don't throw.
- `sim/walkthroughRouter.test.mjs` — unit tests for `router.js` pure helpers.

**Modified:**
- `README.md` — one-line link to `docs/walkthrough/index.html` near the top.

**Untouched:** everything in `src/`, `styles/`, `assets/`, the game's `index.html`, and `sim/play.mjs`.

---

## Task 1: Scaffold project skeleton

**Files:**
- Create: `docs/walkthrough/index.html`
- Create: `docs/walkthrough/tour.css`
- Create: `docs/walkthrough/tour.js`
- Create: `docs/walkthrough/slides.js`
- Create: `docs/walkthrough/repo.js`

- [ ] **Step 1: Create the entry HTML**

Create `docs/walkthrough/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mars Trail · Code Tour</title>
  <link rel="stylesheet" href="../../styles/theme.css">
  <link rel="stylesheet" href="../../styles/layout.css">
  <link rel="stylesheet" href="../../styles/components.css">
  <link rel="stylesheet" href="../../styles/modals.css">
  <link rel="stylesheet" href="../../styles/theme-lcars.css">
  <link rel="stylesheet" href="../../styles/theme-voltron.css">
  <link rel="stylesheet" href="../../styles/theme-starfighter.css">
  <link rel="stylesheet" href="tour.css">
</head>
<body>
  <div class="scanlines" aria-hidden="true"></div>

  <header class="tour-topbar">
    <span class="tour-brand">MARS TRAIL · CODE TOUR</span>
    <span class="tour-topbar-right">
      <span class="tour-progress" id="tour-progress"></span>
      <select id="theme-select" class="theme-select" aria-label="Interface theme"></select>
    </span>
  </header>

  <main class="tour-stage" id="tour-stage" aria-live="polite"></main>

  <footer class="tour-nav">
    <button id="tour-prev" type="button" class="btn-secondary">← PREV</button>
    <button id="tour-next" type="button" class="btn-primary">NEXT →</button>
  </footer>

  <div id="modal-root"></div>

  <script type="module" src="tour.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create minimal tour.css**

Create `docs/walkthrough/tour.css`:

```css
/* Layout primitives. Colors and decoration come from styles/theme-*.css via CSS vars. */

.tour-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--panel-border, #0a8);
}

.tour-brand { font-weight: 700; letter-spacing: 0.08em; }

.tour-topbar-right {
  display: flex;
  gap: 12px;
  align-items: center;
}

.tour-progress { font-size: 0.9em; opacity: 0.85; }

.tour-stage {
  padding: 24px;
  max-width: 920px;
  margin: 0 auto;
  min-height: calc(100vh - 140px);
}

.tour-nav {
  display: flex;
  justify-content: space-between;
  padding: 12px 24px;
  border-top: 1px solid var(--panel-border, #0a8);
}

.tour-slide h1 { margin-top: 0; }
.tour-slide p { line-height: 1.5; max-width: 70ch; }
```

- [ ] **Step 3: Create repo constants module**

Create `docs/walkthrough/repo.js`:

```js
// Single source of truth for GitHub links. package.json has no `repository` field,
// so bake it here. Update BRANCH if main is ever renamed.
export const OWNER = 'VanderpoolTeacher';
export const REPO = 'mars-trail';
export const BRANCH = 'main';

export function githubUrl(path, lineStart, lineEnd) {
  const base = `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/${path}`;
  if (typeof lineStart !== 'number') return base;
  if (typeof lineEnd !== 'number' || lineEnd === lineStart) return `${base}#L${lineStart}`;
  return `${base}#L${lineStart}-L${lineEnd}`;
}
```

- [ ] **Step 4: Create slides.js with a single welcome slide**

Create `docs/walkthrough/slides.js`:

```js
// Slide manifest. Populated across tasks 6, 7, 9, 10, 12, 13.
export const spine = [
  {
    id: 'welcome',
    title: 'Welcome to the Mars Trail code tour',
    body: '<p>Press → or click NEXT to begin.</p>',
  },
];
```

- [ ] **Step 5: Create minimal tour.js that renders the first slide**

Create `docs/walkthrough/tour.js`:

```js
import { spine } from './slides.js';

function renderSlide(slide) {
  const stage = document.getElementById('tour-stage');
  stage.innerHTML = `
    <section class="tour-slide">
      <h1>${slide.title}</h1>
      ${slide.body}
    </section>
  `;
}

renderSlide(spine[0]);
```

- [ ] **Step 6: Manually verify the page loads**

Open `docs/walkthrough/index.html` in a browser.
Expected: page shows "MARS TRAIL · CODE TOUR" topbar, "Welcome to the Mars Trail code tour" as the heading, "Press → or click NEXT to begin." as body, and PREV/NEXT buttons at the bottom. No console errors.

- [ ] **Step 7: Commit**

```bash
git add docs/walkthrough/
git commit -m "Scaffold code tour: entry HTML, stylesheet, empty engine (refs #65)"
```

---

## Task 2: Pure router helpers + unit tests

**Files:**
- Create: `docs/walkthrough/router.js`
- Create: `sim/walkthroughRouter.test.mjs`

- [ ] **Step 1: Write the failing test file**

Create `sim/walkthroughRouter.test.mjs`:

```js
// Unit tests for docs/walkthrough/router.js. Run: node --test sim/walkthroughRouter.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseHash,
  hashFor,
  routeForward,
  routeBack,
} from '../docs/walkthrough/router.js';

// Minimal slide set used by all tests.
const slides = {
  spine: [
    { id: 'welcome' },
    { id: 'pitch' },
    {
      id: 'hub',
      branches: [
        { id: 'travel', sub: [{ id: 's1' }, { id: 's2' }] },
        { id: 'events', sub: [{ id: 's1' }] },
      ],
    },
    { id: 'credits' },
  ],
};

test('parseHash returns spine location for empty / slide hash', () => {
  assert.deepEqual(parseHash(''),        { kind: 'spine', index: 0 });
  assert.deepEqual(parseHash('#slide-0'), { kind: 'spine', index: 0 });
  assert.deepEqual(parseHash('#slide-2'), { kind: 'spine', index: 2 });
});

test('parseHash returns branch location for branch hash', () => {
  assert.deepEqual(parseHash('#branch-travel-0'), { kind: 'branch', branchId: 'travel', subIndex: 0 });
  assert.deepEqual(parseHash('#branch-events-0'), { kind: 'branch', branchId: 'events', subIndex: 0 });
});

test('parseHash clamps invalid input to spine index 0', () => {
  assert.deepEqual(parseHash('#gibberish'),  { kind: 'spine', index: 0 });
  assert.deepEqual(parseHash('#slide-999'),  { kind: 'spine', index: 0 });
  assert.deepEqual(parseHash('#slide--1'),   { kind: 'spine', index: 0 });
});

test('hashFor round-trips a spine location', () => {
  assert.equal(hashFor({ kind: 'spine', index: 0 }), '#slide-0');
  assert.equal(hashFor({ kind: 'spine', index: 3 }), '#slide-3');
});

test('hashFor round-trips a branch location', () => {
  assert.equal(hashFor({ kind: 'branch', branchId: 'travel', subIndex: 1 }), '#branch-travel-1');
});

test('routeForward on spine advances to next spine slide', () => {
  assert.deepEqual(
    routeForward({ kind: 'spine', index: 0 }, slides),
    { kind: 'spine', index: 1 }
  );
});

test('routeForward on last spine slide is a no-op', () => {
  assert.deepEqual(
    routeForward({ kind: 'spine', index: 3 }, slides),
    { kind: 'spine', index: 3 }
  );
});

test('routeForward on last sub-slide of a branch returns to hub', () => {
  // hub is index 2 in the slides spine above
  assert.deepEqual(
    routeForward({ kind: 'branch', branchId: 'travel', subIndex: 1 }, slides),
    { kind: 'spine', index: 2 }
  );
});

test('routeForward inside a multi-sub branch advances sub-index', () => {
  assert.deepEqual(
    routeForward({ kind: 'branch', branchId: 'travel', subIndex: 0 }, slides),
    { kind: 'branch', branchId: 'travel', subIndex: 1 }
  );
});

test('routeBack on first spine slide is a no-op', () => {
  assert.deepEqual(
    routeBack({ kind: 'spine', index: 0 }, slides),
    { kind: 'spine', index: 0 }
  );
});

test('routeBack on first sub-slide of a branch returns to hub', () => {
  assert.deepEqual(
    routeBack({ kind: 'branch', branchId: 'travel', subIndex: 0 }, slides),
    { kind: 'spine', index: 2 }
  );
});

test('routeBack inside a multi-sub branch decrements sub-index', () => {
  assert.deepEqual(
    routeBack({ kind: 'branch', branchId: 'travel', subIndex: 1 }, slides),
    { kind: 'branch', branchId: 'travel', subIndex: 0 }
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test sim/walkthroughRouter.test.mjs`
Expected: FAIL — module `../docs/walkthrough/router.js` cannot be resolved.

- [ ] **Step 3: Implement router.js to make tests pass**

Create `docs/walkthrough/router.js`:

```js
// Pure routing helpers for the code tour. No DOM, no side effects.
//
// A "location" is one of:
//   { kind: 'spine',  index: number }              -- position on the spine
//   { kind: 'branch', branchId: string, subIndex: number } -- inside a hub branch

const SLIDE_HASH = /^#slide-(\d+)$/;
const BRANCH_HASH = /^#branch-([a-zA-Z0-9_-]+)-(\d+)$/;

export function parseHash(hash) {
  if (!hash || hash === '#') return { kind: 'spine', index: 0 };
  const m1 = SLIDE_HASH.exec(hash);
  if (m1) {
    const idx = Number(m1[1]);
    if (idx < 0 || !Number.isFinite(idx)) return { kind: 'spine', index: 0 };
    return { kind: 'spine', index: idx };
  }
  const m2 = BRANCH_HASH.exec(hash);
  if (m2) return { kind: 'branch', branchId: m2[1], subIndex: Number(m2[2]) };
  return { kind: 'spine', index: 0 };
}

export function hashFor(location) {
  if (location.kind === 'spine') return `#slide-${location.index}`;
  return `#branch-${location.branchId}-${location.subIndex}`;
}

function hubIndex(slides) {
  return slides.spine.findIndex(s => s.id === 'hub');
}

function findBranch(slides, branchId) {
  const hub = slides.spine.find(s => s.id === 'hub');
  if (!hub || !hub.branches) return null;
  return hub.branches.find(b => b.id === branchId) || null;
}

export function routeForward(location, slides) {
  if (location.kind === 'spine') {
    const next = location.index + 1;
    if (next >= slides.spine.length) return location;
    return { kind: 'spine', index: next };
  }
  // kind === 'branch'
  const branch = findBranch(slides, location.branchId);
  if (!branch) return { kind: 'spine', index: hubIndex(slides) };
  if (location.subIndex + 1 < branch.sub.length) {
    return { kind: 'branch', branchId: location.branchId, subIndex: location.subIndex + 1 };
  }
  return { kind: 'spine', index: hubIndex(slides) };
}

export function routeBack(location, slides) {
  if (location.kind === 'spine') {
    if (location.index === 0) return location;
    return { kind: 'spine', index: location.index - 1 };
  }
  // kind === 'branch'
  if (location.subIndex === 0) return { kind: 'spine', index: hubIndex(slides) };
  return { kind: 'branch', branchId: location.branchId, subIndex: location.subIndex - 1 };
}

// Validate a parsed hash against a concrete slides manifest.
// Returns a valid location. Out-of-range hashes fall back to spine 0.
export function routeToSlide(location, slides) {
  if (location.kind === 'spine') {
    if (location.index < 0 || location.index >= slides.spine.length) {
      return { kind: 'spine', index: 0 };
    }
    return location;
  }
  const branch = findBranch(slides, location.branchId);
  if (!branch) return { kind: 'spine', index: 0 };
  if (location.subIndex < 0 || location.subIndex >= branch.sub.length) {
    return { kind: 'branch', branchId: location.branchId, subIndex: 0 };
  }
  return location;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test sim/walkthroughRouter.test.mjs`
Expected: PASS — all 11 tests green.

- [ ] **Step 5: Commit**

```bash
git add docs/walkthrough/router.js sim/walkthroughRouter.test.mjs
git commit -m "Code tour: pure router helpers with unit tests (refs #65)"
```

---

## Task 3: Wire tour.js to the router (spine navigation working end-to-end)

**Files:**
- Modify: `docs/walkthrough/tour.js`
- Modify: `docs/walkthrough/slides.js` (add a second spine slide so navigation is observable)

- [ ] **Step 1: Add a second spine slide so forward/back is observable**

Replace the contents of `docs/walkthrough/slides.js`:

```js
export const spine = [
  {
    id: 'welcome',
    title: 'Welcome to the Mars Trail code tour',
    body: '<p>Press → or click NEXT to begin.</p>',
  },
  {
    id: 'pitch',
    title: 'What is Mars Trail?',
    body: '<p>Placeholder — real content arrives in Task 6.</p>',
  },
];
```

- [ ] **Step 2: Rewrite tour.js with routing wired in**

Replace the contents of `docs/walkthrough/tour.js`:

```js
import { spine } from './slides.js';
import { parseHash, hashFor, routeForward, routeBack, routeToSlide } from './router.js';

const slides = { spine };
let current = routeToSlide(parseHash(window.location.hash), slides);

function slideAt(location) {
  if (location.kind === 'spine') return slides.spine[location.index];
  const hub = slides.spine.find(s => s.id === 'hub');
  const branch = hub.branches.find(b => b.id === location.branchId);
  return branch.sub[location.subIndex];
}

function renderProgress(location) {
  const el = document.getElementById('tour-progress');
  if (!el) return;
  if (location.kind === 'spine') {
    el.textContent = `SPINE ${location.index + 1} / ${slides.spine.length}`;
  } else {
    el.textContent = `HUB › ${location.branchId} › ${location.subIndex + 1}`;
  }
}

function render(location) {
  const slide = slideAt(location);
  document.getElementById('tour-stage').innerHTML = `
    <section class="tour-slide">
      <h1>${slide.title}</h1>
      ${slide.body}
    </section>
  `;
  renderProgress(location);
}

function go(nextLocation) {
  current = nextLocation;
  const hash = hashFor(nextLocation);
  if (window.location.hash !== hash) {
    window.history.pushState(null, '', hash);
  }
  render(current);
}

function onKey(e) {
  if (e.key === 'ArrowRight')      go(routeForward(current, slides));
  else if (e.key === 'ArrowLeft')  go(routeBack(current, slides));
  else if (e.key === 'Home')       go({ kind: 'spine', index: 0 });
  else if (e.key === 'End')        go({ kind: 'spine', index: slides.spine.length - 1 });
}

document.addEventListener('keydown', onKey);
document.getElementById('tour-next').addEventListener('click', () => go(routeForward(current, slides)));
document.getElementById('tour-prev').addEventListener('click', () => go(routeBack(current, slides)));
window.addEventListener('hashchange', () => {
  current = routeToSlide(parseHash(window.location.hash), slides);
  render(current);
});

render(current);
```

- [ ] **Step 3: Manually verify navigation works**

Open `docs/walkthrough/index.html` in a browser.
Expected:
- Welcome slide loads, progress reads "SPINE 1 / 2".
- Click NEXT or press → : pitch slide loads, progress reads "SPINE 2 / 2", URL hash becomes `#slide-1`.
- Click PREV or press ← : welcome slide loads, hash becomes `#slide-0`.
- Open directly to `…/index.html#slide-1` : pitch slide loads immediately.
- Browser back button returns to previous slide.

- [ ] **Step 4: Commit**

```bash
git add docs/walkthrough/
git commit -m "Code tour: spine navigation + hash routing (refs #65)"
```

---

## Task 4: Theme-toggle dropdown

**Files:**
- Modify: `docs/walkthrough/tour.js`

- [ ] **Step 1: Add theme wiring to tour.js**

Insert these imports at the top of `docs/walkthrough/tour.js`, just below the existing imports:

```js
import { THEMES, resolveTheme } from '../../src/theme.js';
```

Insert this block in `tour.js` anywhere before the final `render(current)` call:

```js
function initTourTheme() {
  const select = document.getElementById('theme-select');
  if (!select) return;
  select.innerHTML = '';
  for (const t of THEMES) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.label;
    select.appendChild(opt);
  }
  const applyTheme = (raw) => {
    const theme = resolveTheme(raw);
    if (theme === 'mc') document.body.removeAttribute('data-theme');
    else document.body.setAttribute('data-theme', theme);
    select.value = theme;
  };
  applyTheme('mc'); // slideshow always starts in mc; tour does NOT read localStorage
  select.addEventListener('change', (e) => applyTheme(e.target.value));
}

initTourTheme();
```

- [ ] **Step 2: Manually verify theme switching works**

Open `docs/walkthrough/index.html` in a browser.
Expected:
- Dropdown in top-right shows four options: Mission Control, LCARS / TNG, Voltron HUD, Last Starfighter.
- Changing selection repaints the page (colors, borders, fonts change).
- Refreshing the page always returns to Mission Control (no localStorage persistence for the tour).

- [ ] **Step 3: Commit**

```bash
git add docs/walkthrough/tour.js
git commit -m "Code tour: theme-toggle dropdown reusing src/theme.js (refs #65)"
```

---

## Task 5: Code-snippet component

**Files:**
- Modify: `docs/walkthrough/tour.js`
- Modify: `docs/walkthrough/tour.css`

- [ ] **Step 1: Add snippet CSS**

Append to `docs/walkthrough/tour.css`:

```css
.tour-snippets { margin-top: 16px; }

.tour-snippet {
  border: 1px solid var(--panel-border, #0a8);
  border-radius: 4px;
  margin-bottom: 10px;
  overflow: hidden;
}

.tour-snippet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  background: var(--panel-header-bg, rgba(0, 170, 136, 0.1));
  cursor: pointer;
  user-select: none;
  font-size: 0.85em;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.tour-snippet-header .tour-snippet-label { font-weight: 600; }
.tour-snippet-header .tour-snippet-links { display: flex; gap: 10px; font-size: 0.9em; }

.tour-snippet-body {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.2s ease;
}

.tour-snippet.is-open .tour-snippet-body { max-height: 800px; overflow: auto; }

.tour-snippet pre {
  margin: 0;
  padding: 10px 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85em;
  line-height: 1.45;
  white-space: pre;
  background: var(--code-bg, #000);
  color: var(--code-fg, inherit);
}
```

- [ ] **Step 2: Add snippet rendering + wiring to tour.js**

Add this import near the top of `docs/walkthrough/tour.js`:

```js
import { githubUrl } from './repo.js';
```

Replace the `render` function in `tour.js` with one that emits snippets when the slide declares them:

```js
function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderSnippet(snippet) {
  const [a, b] = snippet.lines || [];
  const label = `${snippet.path}${a ? ` : ${a}${b && b !== a ? `–${b}` : ''}` : ''}`;
  const url = githubUrl(snippet.path, a, b);
  return `
    <div class="tour-snippet" data-snippet>
      <div class="tour-snippet-header" data-snippet-toggle>
        <span class="tour-snippet-label">${escapeHtml(label)}${snippet.caption ? ` — ${escapeHtml(snippet.caption)}` : ''}</span>
        <span class="tour-snippet-links">
          <a href="${url}" target="_blank" rel="noopener">View on GitHub ↗</a>
          <span class="tour-snippet-chevron">▾</span>
        </span>
      </div>
      <div class="tour-snippet-body">
        <pre><code>${escapeHtml(snippet.code)}</code></pre>
      </div>
    </div>
  `;
}

function render(location) {
  const slide = slideAt(location);
  const snippetsHtml = slide.snippets?.length
    ? `<div class="tour-snippets">${slide.snippets.map(renderSnippet).join('')}</div>`
    : '';
  document.getElementById('tour-stage').innerHTML = `
    <section class="tour-slide">
      <h1>${slide.title}</h1>
      ${slide.body}
      ${snippetsHtml}
    </section>
  `;
  // Wire expand/collapse.
  for (const header of document.querySelectorAll('[data-snippet-toggle]')) {
    header.addEventListener('click', () => header.parentElement.classList.toggle('is-open'));
  }
  renderProgress(location);
}
```

- [ ] **Step 3: Add a snippet to the pitch slide for visual verification**

Replace the `pitch` slide in `docs/walkthrough/slides.js` with:

```js
  {
    id: 'pitch',
    title: 'What is Mars Trail?',
    body: '<p>Placeholder — real content arrives in Task 6.</p>',
    snippets: [
      {
        path: 'src/main.js',
        lines: [1, 10],
        caption: 'Placeholder snippet (replaced in Task 7)',
        code: '// first lines of main.js will go here\nconsole.log("hello mars");',
      },
    ],
  },
```

- [ ] **Step 4: Manually verify**

Open `docs/walkthrough/index.html#slide-1` in a browser.
Expected:
- A collapsed snippet box appears below the body text, labeled `src/main.js : 1–10 — Placeholder snippet …`.
- Clicking the header expands it to reveal the code.
- The "View on GitHub ↗" link opens `https://github.com/VanderpoolTeacher/mars-trail/blob/main/src/main.js#L1-L10` in a new tab.

- [ ] **Step 5: Commit**

```bash
git add docs/walkthrough/tour.js docs/walkthrough/tour.css docs/walkthrough/slides.js
git commit -m "Code tour: expandable code-snippet component (refs #65)"
```

---

## Task 6: Spine content — slides 1–4 (pre-code)

**Files:**
- Modify: `docs/walkthrough/slides.js`

- [ ] **Step 1: Author the first four spine slides**

Replace `docs/walkthrough/slides.js` with:

```js
export const spine = [
  {
    id: 'welcome',
    title: 'Welcome to the Mars Trail code tour',
    body: `
      <p class="subtitle">A ~15-minute guided tour of how this game is organized.</p>
      <p>Use <strong>← →</strong> to navigate. <strong>Esc</strong> returns from a hub branch. Theme selector in the top-right repaints everything — the tour itself is a live demo of the game's theme system.</p>
      <p>Press <strong>→</strong> or click <strong>NEXT</strong> to begin.</p>
    `,
  },
  {
    id: 'pitch',
    title: 'What is Mars Trail?',
    body: `
      <p>An Oregon-Trail-style survival sim set on Mars, built for a game jam. You captain a rover across Acidalia Planitia, rationing power and EVA suits, managing crew, responding to emergencies, and diverting for side missions ("away teams") that chase science points.</p>
      <p>Runs are short (~10–20 sols of play), most of the difficulty is in the event system, and a run ends when you reach the goal or lose the crew.</p>
    `,
  },
  {
    id: 'stack',
    title: 'Tech stack',
    body: `
      <p><strong>Vanilla ES modules.</strong> No framework, no bundler, no build step. Open <code>index.html</code> in a browser and you're running the game.</p>
      <p>This is deliberate: the project is small enough that a build toolchain would be more complexity than feature. It also makes the code unusually easy to read — what you see in the file is what runs.</p>
      <p>Testing uses Node's built-in <code>node --test</code> runner (see <code>sim/</code>). The simulation harness at <code>sim/play.mjs</code> runs thousands of AI-driven playthroughs to validate balance.</p>
    `,
  },
  {
    id: 'layout',
    title: 'Repo layout',
    body: `
      <p>The whole project fits in a handful of folders. Each has one job.</p>
      <pre style="line-height:1.35;font-size:0.9em"><code>Mars Trail/
├── index.html          — game entry point
├── src/
│   ├── main.js         — boots the game, wires UI
│   ├── state.js        — single source of truth
│   ├── render.js       — state → DOM
│   ├── theme.js        — theme switcher
│   ├── audio.js        — music + mute
│   ├── systems/        — game logic (pure where possible)
│   ├── content/        — data: events, emergencies, facts, waypoints
│   └── ui/             — modals, codex overlay
├── styles/             — theme.css + per-theme overlays
├── sim/                — unit tests + playtest harness
├── assets/             — images, music
└── docs/superpowers/   — per-feature specs + implementation plans
</code></pre>
      <p>The rest of the tour follows the data flow: entry point → state → render → systems (via a hub) → content → UI → themes → audio → tests → workflow.</p>
    `,
  },
  // Slides 5–8 added in Task 7, slide 9 (hub) in Task 9, 10–16 in Task 13.
];
```

- [ ] **Step 2: Manually verify**

Open `docs/walkthrough/index.html` in a browser, click through all four slides.
Expected: readable prose, clean layout, progress counter reads 1/4 through 4/4, no broken markup.

- [ ] **Step 3: Commit**

```bash
git add docs/walkthrough/slides.js
git commit -m "Code tour: pre-code spine content (welcome, pitch, stack, layout) (refs #65)"
```

---

## Task 7: Spine content — slides 6–8 (entry point, state, render) with real code snippets

**Files:**
- Modify: `docs/walkthrough/slides.js`

- [ ] **Step 1: Read the real code that each slide references**

Run: `head -40 src/main.js`; `head -30 src/state.js`; `head -30 src/render.js`

This gives you the lines each snippet will quote verbatim. The `lines` field in each snippet must match the actual line numbers at the time of writing.

- [ ] **Step 2: Append slides 5–8 to the spine**

(Slide 5 — game loop diagram — gets its demo in Task 8; stub its body for now.)

Append to the `spine` array in `docs/walkthrough/slides.js`, between the existing `layout` slide and the trailing comment:

```js
  {
    id: 'loop',
    title: 'The game loop',
    body: `
      <p>Every turn (a "sol") follows the same four-phase rhythm:</p>
      <ol>
        <li><strong>Input</strong> — player picks pace / rations / actions.</li>
        <li><strong>Systems</strong> — <code>travel.js</code>, <code>events.js</code>, and friends mutate state.</li>
        <li><strong>Render</strong> — <code>render.js</code> rebuilds the DOM from state.</li>
        <li><strong>Log</strong> — mission log entries appear for what just happened.</li>
      </ol>
      <p>There is <em>no</em> observer pattern, <em>no</em> virtual DOM, <em>no</em> reactive framework. On every change, <code>render()</code> rebuilds the parts of the DOM it owns from scratch.</p>
      <div id="demo-loop-mount"></div>
    `,
    demo: 'loop',
  },
  {
    id: 'entry',
    title: 'Entry point',
    body: `
      <p><code>index.html</code> loads stylesheets and calls into <code>src/main.js</code>, which boots the game: builds initial state, wires event listeners, paints the first frame.</p>
      <p>Follow the imports at the top of <code>main.js</code> and you get a one-page map of the whole app.</p>
    `,
    snippets: [
      {
        path: 'src/main.js',
        lines: [1, 20],
        caption: 'Boot imports',
        code: `// Top of src/main.js — the imports are the table of contents.
// (Paste the actual current lines 1–20 of src/main.js here.
//  Update the line range in the lines: [1, 20] above to match.)`,
      },
    ],
  },
  {
    id: 'state',
    title: 'State',
    body: `
      <p><code>src/state.js</code> exports a single function, <code>createInitialState()</code>, that returns a plain JS object. That object <em>is</em> the game. Everything else reads it; systems mutate it; <code>render()</code> projects it to DOM.</p>
      <p>Keeping state in one place is what makes tests easy to write: seed a state, call a system, assert on the resulting state.</p>
    `,
    snippets: [
      {
        path: 'src/state.js',
        lines: [1, 30],
        caption: 'State shape overview',
        code: `// Top of src/state.js — structural overview of the game object.
// (Paste actual lines 1–30 of src/state.js here at implementation time,
//  and update the lines: [1, 30] field to match whatever subset you pasted.)`,
      },
    ],
  },
  {
    id: 'render',
    title: 'Render',
    body: `
      <p><code>src/render.js</code> is a pure <code>state → DOM</code> projection. It exports one function — <code>render(state)</code> — that is called after every state change. No partial updates, no diffing; just rebuild the panels it owns.</p>
      <p>This stays cheap because the DOM is small: a few panels, a crew list, a log. The simplicity is the feature.</p>
    `,
    snippets: [
      {
        path: 'src/render.js',
        lines: [1, 30],
        caption: 'Render entry',
        code: `// Top of src/render.js — the projection entry point.
// (Paste actual lines 1–30 of src/render.js here at implementation time,
//  and update the lines: [1, 30] field to match.)`,
      },
    ],
  },
```

**IMPORTANT:** Before committing, replace each snippet's `code:` string with the actual current contents of the referenced file range. The placeholder comments above are authoring instructions, not finished content. Update the `lines:` tuple if your chosen range differs.

- [ ] **Step 3: Manually verify**

Open `docs/walkthrough/index.html` in a browser, click to slides 5–8.
Expected: readable content on each; snippet on entry/state/render slides expands to show real code; "View on GitHub" link opens the correct file and line range.

- [ ] **Step 4: Commit**

```bash
git add docs/walkthrough/slides.js
git commit -m "Code tour: entry / state / render slides with real code snippets (refs #65)"
```

---

## Task 8: Game-loop demo (demos/loop.js)

**Files:**
- Create: `docs/walkthrough/demos/loop.js`
- Modify: `docs/walkthrough/tour.js` (add demo dispatch)

- [ ] **Step 1: Create the loop demo module**

Create `docs/walkthrough/demos/loop.js`:

```js
// Explanatory animation of the game loop. No real-module imports —
// this one is a visualization, not a behavior proof.
//
// Exports init(mount) which renders a 4-step cycle: Input → Systems → Render → Log.

const PHASES = ['INPUT', 'SYSTEMS', 'RENDER', 'LOG'];

export function init(mount) {
  mount.innerHTML = `
    <div class="loop-demo" style="margin-top:16px;padding:14px;border:1px solid var(--panel-border,#0a8);border-radius:4px">
      <div style="display:flex;gap:10px;justify-content:center;align-items:center">
        ${PHASES.map((p, i) => `
          <div class="loop-phase" data-phase-index="${i}" style="padding:10px 14px;border:1px solid var(--panel-border,#0a8);border-radius:4px;min-width:80px;text-align:center;font-family:ui-monospace,monospace;transition:all 0.2s">${p}</div>
          ${i < PHASES.length - 1 ? '<span style="opacity:0.6">→</span>' : ''}
        `).join('')}
      </div>
      <div style="text-align:center;margin-top:12px;font-size:0.85em;opacity:0.8" id="loop-caption">Each sol runs through these four phases, in order.</div>
    </div>
  `;
  const phases = mount.querySelectorAll('.loop-phase');
  let active = 0;
  const tick = () => {
    phases.forEach((p, i) => {
      p.style.background = i === active ? 'var(--panel-header-bg, rgba(0,170,136,0.3))' : 'transparent';
      p.style.fontWeight = i === active ? '700' : '400';
    });
    active = (active + 1) % phases.length;
  };
  tick();
  const id = setInterval(tick, 700);
  return () => clearInterval(id); // cleanup on teardown
}
```

- [ ] **Step 2: Add demo dispatch to tour.js**

Insert near the top of `docs/walkthrough/tour.js`:

```js
const demoLoaders = {
  loop:          () => import('./demos/loop.js'),
  eventPreview:  () => import('./demos/eventPreview.js'),     // wired in Task 11
  mashEmergency: () => import('./demos/mashEmergency.js'),    // wired in Task 12
};

let currentDemoCleanup = null;

async function mountDemo(slide) {
  if (currentDemoCleanup) { currentDemoCleanup(); currentDemoCleanup = null; }
  if (!slide.demo) return;
  const loader = demoLoaders[slide.demo];
  if (!loader) return;
  const mod = await loader();
  const mount = document.getElementById(`demo-${slide.demo}-mount`);
  if (!mount || typeof mod.init !== 'function') return;
  const cleanup = mod.init(mount);
  if (typeof cleanup === 'function') currentDemoCleanup = cleanup;
}
```

Update `render(location)` to mount the demo after innerHTML is set. Replace the final `renderProgress(location);` line with:

```js
  renderProgress(location);
  mountDemo(slide);
```

- [ ] **Step 3: Manually verify**

Open `docs/walkthrough/index.html#slide-4` in a browser (the "loop" slide).
Expected: four phase boxes labelled INPUT → SYSTEMS → RENDER → LOG; one highlighted at a time, rotating every 0.7 s. Navigate away and back — animation restarts cleanly (no doubled intervals).

- [ ] **Step 4: Commit**

```bash
git add docs/walkthrough/demos/loop.js docs/walkthrough/tour.js
git commit -m "Code tour: animated game-loop demo (refs #65)"
```

---

## Task 9: Hub slide + branch navigation

**Files:**
- Modify: `docs/walkthrough/slides.js` (add the hub slide with an initial stub for each of the 8 branches)
- Modify: `docs/walkthrough/tour.js` (hub tile rendering, Esc handler, digit shortcuts)
- Modify: `docs/walkthrough/tour.css` (hub tile grid)

- [ ] **Step 1: Add hub slide to slides.js with stub branches**

Append to the `spine` array, after the `render` slide:

```js
  {
    id: 'hub',
    title: 'Systems architecture',
    body: `
      <p>The game logic lives under <code>src/systems/</code>. Click any tile below to take a short tour of that module and return here. Press <strong>Esc</strong> to come back. Digit keys <strong>1–8</strong> jump to a tile.</p>
    `,
    branches: [
      { id: 'travel',      label: 'travel.js',                         sub: [{ id: 's1', title: 'travel.js — placeholder', body: '<p>Branch content arrives in Task 10.</p>' }] },
      { id: 'events',      label: 'events.js + content/events.js',     sub: [{ id: 's1', title: 'events.js — placeholder', body: '<p>Branch content arrives in Task 10.</p>' }] },
      { id: 'multistage',  label: 'multiStage.js + multi-stage events', sub: [{ id: 's1', title: 'multiStage.js — placeholder', body: '<p>Branch content arrives in Task 10.</p>' }] },
      { id: 'medical',     label: 'medicalEmergency.js',               sub: [{ id: 's1', title: 'medicalEmergency.js — placeholder', body: '<p>Branch content arrives in Task 12.</p>' }] },
      { id: 'clickmetrics',label: 'clickMetrics.js',                   sub: [{ id: 's1', title: 'clickMetrics.js — placeholder', body: '<p>Branch content arrives in Task 13.</p>' }] },
      { id: 'awayteam',    label: 'awayTeam.js',                       sub: [{ id: 's1', title: 'awayTeam.js — placeholder', body: '<p>Branch content arrives in Task 13.</p>' }] },
      { id: 'smallsys',    label: 'crew / corpse / waypoints',         sub: [{ id: 's1', title: 'Small systems — placeholder', body: '<p>Branch content arrives in Task 13.</p>' }] },
      { id: 'scoring',     label: 'career.js + scoring.js',            sub: [{ id: 's1', title: 'Career & scoring — placeholder', body: '<p>Branch content arrives in Task 13.</p>' }] },
    ],
  },
```

- [ ] **Step 2: Add hub tile CSS**

Append to `docs/walkthrough/tour.css`:

```css
.hub-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-top: 20px;
}

.hub-tile {
  padding: 14px;
  border: 1px solid var(--panel-border, #0a8);
  border-radius: 4px;
  cursor: pointer;
  font-family: ui-monospace, monospace;
  background: transparent;
  color: inherit;
  text-align: left;
  transition: background 0.15s;
}

.hub-tile:hover, .hub-tile:focus {
  background: var(--panel-header-bg, rgba(0, 170, 136, 0.15));
  outline: none;
}

.hub-tile-key {
  display: inline-block;
  font-size: 0.75em;
  opacity: 0.7;
  margin-right: 8px;
}

.tour-breadcrumb {
  font-size: 0.85em;
  opacity: 0.75;
  margin-bottom: 12px;
  font-family: ui-monospace, monospace;
}
```

- [ ] **Step 3: Render hub tiles + breadcrumb in tour.js**

Locate the `render(location)` function in `docs/walkthrough/tour.js`. Replace its body with:

```js
function render(location) {
  const slide = slideAt(location);
  const stage = document.getElementById('tour-stage');
  const hub = slides.spine.find(s => s.id === 'hub');

  // Breadcrumb for branch slides.
  const breadcrumb = location.kind === 'branch'
    ? `<div class="tour-breadcrumb">HUB › ${escapeHtml(location.branchId)} › ${location.subIndex + 1} / ${hub.branches.find(b => b.id === location.branchId).sub.length}</div>`
    : '';

  // Hub tile grid when we're on the hub slide.
  const hubTiles = (location.kind === 'spine' && slide.id === 'hub')
    ? `<div class="hub-tiles" role="navigation" aria-label="Systems">
         ${slide.branches.map((b, i) => `
           <button class="hub-tile" data-branch-id="${b.id}" type="button">
             <span class="hub-tile-key">${i + 1}</span>${escapeHtml(b.label)}
           </button>
         `).join('')}
       </div>`
    : '';

  const snippetsHtml = slide.snippets?.length
    ? `<div class="tour-snippets">${slide.snippets.map(renderSnippet).join('')}</div>`
    : '';

  stage.innerHTML = `
    <section class="tour-slide">
      ${breadcrumb}
      <h1>${slide.title}</h1>
      ${slide.body}
      ${hubTiles}
      ${snippetsHtml}
    </section>
  `;

  for (const header of stage.querySelectorAll('[data-snippet-toggle]')) {
    header.addEventListener('click', () => header.parentElement.classList.toggle('is-open'));
  }
  for (const tile of stage.querySelectorAll('.hub-tile')) {
    tile.addEventListener('click', () => {
      go({ kind: 'branch', branchId: tile.dataset.branchId, subIndex: 0 });
    });
  }

  renderProgress(location);
  mountDemo(slide);
}
```

Replace the `onKey` function with:

```js
function onKey(e) {
  if (e.key === 'ArrowRight')      return go(routeForward(current, slides));
  if (e.key === 'ArrowLeft')       return go(routeBack(current, slides));
  if (e.key === 'Home')            return go({ kind: 'spine', index: 0 });
  if (e.key === 'End')             return go({ kind: 'spine', index: slides.spine.length - 1 });
  if (e.key === 'Escape' && current.kind === 'branch') {
    const hubIdx = slides.spine.findIndex(s => s.id === 'hub');
    return go({ kind: 'spine', index: hubIdx });
  }
  // Digit 1–8 on hub → open corresponding branch.
  if (current.kind === 'spine' && slideAt(current).id === 'hub' && /^[1-9]$/.test(e.key)) {
    const hub = slides.spine.find(s => s.id === 'hub');
    const idx = Number(e.key) - 1;
    if (idx < hub.branches.length) {
      return go({ kind: 'branch', branchId: hub.branches[idx].id, subIndex: 0 });
    }
  }
}
```

- [ ] **Step 4: Manually verify**

Open the tour in a browser and navigate to the hub slide (the one after "render").
Expected:
- Eight tiles render in a grid. Each tile shows `1 travel.js`, `2 events.js ...`, etc.
- Clicking a tile navigates into the branch's first sub-slide; breadcrumb reads "HUB › travel › 1 / 1".
- Pressing Esc returns to the hub.
- Pressing `3` from the hub jumps directly to the third branch.
- Clicking NEXT on a branch sub-slide (with only one sub-slide) returns to the hub.

- [ ] **Step 5: Commit**

```bash
git add docs/walkthrough/
git commit -m "Code tour: hub slide + branch navigation (refs #65)"
```

---

## Task 10: Branch content — travel, events, multiStage

**Files:**
- Modify: `docs/walkthrough/slides.js`

- [ ] **Step 1: Read the current state of the three systems before authoring**

Run: `head -40 src/systems/travel.js`; `head -40 src/systems/events.js`; `head -40 src/systems/multiStage.js`; `head -10 src/content/events.js`

- [ ] **Step 2: Replace the three placeholder branches with real content**

In `docs/walkthrough/slides.js`, replace the `travel`, `events`, and `multistage` branch entries in the hub's `branches` array with:

```js
      {
        id: 'travel',
        label: 'travel.js',
        sub: [
          {
            id: 's1',
            title: 'travel.js — pace, tick, arrival',
            body: `
              <p><code>src/systems/travel.js</code> owns the per-sol resource tick. It advances the rover by pace-dependent km, consumes power, rations, EVA charges, and decides when the rover arrives at the next landmark.</p>
              <p>The module is (mostly) pure: given a state and a pace, it returns a new state. That purity is what lets <code>sim/playtest1000.mjs</code> run thousands of simulated runs in ~10 seconds.</p>
            `,
            snippets: [
              {
                path: 'src/systems/travel.js',
                lines: [1, 30],
                caption: 'Module overview',
                code: `// Paste actual src/systems/travel.js lines 1–30 here at implementation time.\n// Update lines: [1, 30] to match the chosen range.`,
              },
            ],
          },
          {
            id: 's2',
            title: 'travel.js — the sol tick',
            body: `
              <p>The heart of travel is <code>advanceSol()</code>: one function that runs once per "NEXT SOL" button press. It consumes resources, maybe rolls an event, maybe arrives at a landmark, and writes log lines.</p>
              <p>If you're looking for where a gameplay decision lives, start here and trace outward.</p>
            `,
            snippets: [
              {
                path: 'src/systems/travel.js',
                lines: [80, 140],
                caption: 'advanceSol body (subset)',
                code: `// Paste a representative subset of advanceSol (~40-60 lines) here at implementation time.\n// Update lines: to match.`,
              },
            ],
          },
        ],
      },
      {
        id: 'events',
        label: 'events.js + content/events.js',
        sub: [
          {
            id: 's1',
            title: 'events.js — rolling an event',
            body: `
              <p><code>src/systems/events.js</code> picks which event fires on a given sol, based on segment, pace, and weighting. Event <em>data</em> lives separately in <code>src/content/events.js</code>: each entry has a title, body, and a set of choices with effects.</p>
              <p>This split (system vs. content) is the dominant pattern in the codebase: logic in <code>src/systems/</code>, data in <code>src/content/</code>. Content can grow without touching logic.</p>
            `,
            snippets: [
              {
                path: 'src/systems/events.js',
                lines: [1, 40],
                caption: 'Event selection',
                code: `// Paste src/systems/events.js lines 1–40 here at implementation time.`,
              },
            ],
          },
          {
            id: 's2',
            title: 'Live: a random event card',
            body: `
              <p>Here is an event card, rendered by the <em>real</em> modal renderer against data from <code>src/content/events.js</code>. Click "Roll another" to re-roll. Choice buttons are real but don't apply effects — this preview is read-only.</p>
              <div id="demo-eventPreview-mount"></div>
            `,
            demo: 'eventPreview',
          },
        ],
      },
      {
        id: 'multistage',
        label: 'multiStage.js + multi-stage events',
        sub: [
          {
            id: 's1',
            title: 'multiStage.js — authored chains',
            body: `
              <p>A multi-stage event is an authored chain: each choice points to the next stage, or to an outcome. <code>src/systems/multiStage.js</code> is a tiny engine that walks that graph. <code>src/content/multiStageEvents.js</code> (and <code>emergencies.js</code>) are the authored data.</p>
              <p>The medical emergency (hub branch <strong>4</strong>) is the flagship example — a three-stage diagnosis-treatment-disposal chain.</p>
            `,
            snippets: [
              {
                path: 'src/systems/multiStage.js',
                lines: [1, 40],
                caption: 'Engine shape',
                code: `// Paste src/systems/multiStage.js lines 1–40 here at implementation time.`,
              },
            ],
          },
        ],
      },
```

**IMPORTANT:** Before committing, replace each snippet's `code:` string with the actual current contents of the referenced file range, and update the `lines:` tuple to match what you pasted.

- [ ] **Step 3: Manually verify**

Navigate into each of the three branches (`1`, `2`, `3` from the hub).
Expected:
- All sub-slides render readable content and show their snippets.
- The "Live: a random event card" sub-slide has an empty mount (the demo is wired in Task 11; until then the mount stays empty and a console warning is fine).
- Breadcrumbs and NEXT/PREV navigation round-trip through the hub.

- [ ] **Step 4: Commit**

```bash
git add docs/walkthrough/slides.js
git commit -m "Code tour: travel/events/multistage branch content (refs #65)"
```

---

## Task 11: Event-card preview demo

**Files:**
- Create: `docs/walkthrough/demos/eventPreview.js`

- [ ] **Step 1: Find the existing modal entry point**

Run: `grep -n "export" src/ui/modals.js | head -20`
Locate the function that renders an event card (likely `showEventModal` or similar). Note its signature and which DOM element it targets (likely `#modal-root`).

- [ ] **Step 2: Create the demo module**

Create `docs/walkthrough/demos/eventPreview.js`:

```js
// Real-module demo: imports the game's event content and modal renderer
// to render a random event card as a read-only preview.
//
// NOTE: imports below must stay in sync with src/content/events.js and src/ui/modals.js.
// If those files move or rename exports, update here and the smoke test will flag the break.

import { events as ALL_EVENTS } from '../../../src/content/events.js';
import * as Modals from '../../../src/ui/modals.js';

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Adapt this to whatever the real modal entry is named in src/ui/modals.js.
// Document the expectation so the smoke test can assert it.
export const REQUIRED_MODAL_EXPORT = 'showEventModal';

export function init(mount) {
  const showFn = Modals[REQUIRED_MODAL_EXPORT];
  if (typeof showFn !== 'function') {
    mount.innerHTML = `<p style="color:#f66">Event preview unavailable: src/ui/modals.js does not export ${REQUIRED_MODAL_EXPORT}.</p>`;
    return () => {};
  }

  mount.innerHTML = `
    <div style="margin-top:12px">
      <button id="event-preview-roll" class="btn-primary" type="button">Roll another</button>
    </div>
    <div id="event-preview-target" style="margin-top:12px"></div>
  `;

  const roll = () => {
    const target = document.getElementById('event-preview-target');
    target.innerHTML = '';
    const evt = pickRandom(ALL_EVENTS.filter(e => !e.multiStage && !e.stages));
    // Render via real modal function, but neuter side effects by passing a no-op dispatch
    // and an explicit preview=true flag. Adapt flags to the real signature at implementation time.
    try {
      showFn({
        event: evt,
        container: target,
        preview: true,
        onChoice: () => {},
      });
    } catch (err) {
      target.innerHTML = `<p style="color:#f66">Could not render event "${evt?.id}": ${err.message}</p>`;
    }
  };

  document.getElementById('event-preview-roll').addEventListener('click', roll);
  roll();

  return () => {}; // no interval/listener to clean up beyond DOM replacement on next render
}
```

**IMPORTANT:** The modal signature above is a best-effort guess. At implementation time, open `src/ui/modals.js`, find the real event-modal function, and adapt `init()` to call it correctly. If the real function has no "preview" mode, write a thin wrapper here that renders the event's title, body, and choices as static buttons (not via the real function). Update `REQUIRED_MODAL_EXPORT` and the call shape accordingly.

- [ ] **Step 3: Manually verify**

Navigate to hub → branch 2 (events) → second sub-slide ("Live: a random event card").
Expected:
- An event card renders. Title + body + choice buttons visible.
- Clicking "Roll another" swaps in a different random event.
- No thrown errors in the console.
- Switching themes while the demo is visible repaints it.

- [ ] **Step 4: Commit**

```bash
git add docs/walkthrough/demos/eventPreview.js
git commit -m "Code tour: real-module event-card preview demo (refs #65)"
```

---

## Task 12: Medical emergency branch + mash-emergency demo

**Files:**
- Create: `docs/walkthrough/demos/mashEmergency.js`
- Modify: `docs/walkthrough/slides.js` (replace the `medical` placeholder branch)

- [ ] **Step 1: Find the existing mash-emergency UI entry**

Run: `grep -n "export" src/systems/medicalEmergency.js | head -20`; `grep -n "mash\|medical" src/ui/modals.js`
Identify the modal function that shows the click-mash UI and the state it expects. Note the signature.

- [ ] **Step 2: Create the demo module**

Create `docs/walkthrough/demos/mashEmergency.js`:

```js
// Real-module demo: imports the medical-emergency system and runs a seeded
// click-mash rescue in an isolated modal container.

import * as MedicalEmergency from '../../../src/systems/medicalEmergency.js';
import * as Modals from '../../../src/ui/modals.js';

export const REQUIRED_MEDICAL_EXPORTS = ['startMedicalEmergency'];
export const REQUIRED_MODAL_EXPORT    = 'showMashEmergencyModal';

function missingExports() {
  const medMissing = REQUIRED_MEDICAL_EXPORTS.filter(k => typeof MedicalEmergency[k] !== 'function');
  const modMissing = typeof Modals[REQUIRED_MODAL_EXPORT] !== 'function' ? [REQUIRED_MODAL_EXPORT] : [];
  return { medMissing, modMissing };
}

export function init(mount) {
  const { medMissing, modMissing } = missingExports();
  if (medMissing.length || modMissing.length) {
    mount.innerHTML = `<p style="color:#f66">Mash demo unavailable — missing exports: ${[...medMissing, ...modMissing].join(', ')}</p>`;
    return () => {};
  }

  mount.innerHTML = `
    <div style="margin-top:12px">
      <button id="mash-demo-start" class="btn-primary" type="button">Start emergency</button>
      <div id="mash-demo-target" style="margin-top:12px"></div>
    </div>
  `;

  const start = () => {
    const target = document.getElementById('mash-demo-target');
    target.innerHTML = '';
    // Seed a minimal state the real system will accept. Adapt fields at implementation
    // time to whatever medicalEmergency.js actually needs.
    const seededState = {
      sol: 5,
      crew: [{ id: 'c1', name: 'Chen', alive: true, damage: 0 }],
      log: [],
    };
    try {
      Modals[REQUIRED_MODAL_EXPORT]({
        state: seededState,
        container: target,
        preview: true,                  // prevent applying to global state
        onResolve: () => {},
      });
    } catch (err) {
      target.innerHTML = `<p style="color:#f66">Demo failed: ${err.message}</p>`;
    }
  };

  document.getElementById('mash-demo-start').addEventListener('click', start);
  return () => {};
}
```

**IMPORTANT:** At implementation time, open `src/systems/medicalEmergency.js` and `src/ui/modals.js` and adapt `REQUIRED_*_EXPORT*` and the call shape to the real API. If the real modal has no "preview" mode, wrap it with a local function here that does the DOM rendering directly rather than mutating global state. Update the constants so the smoke test can assert the right expectations.

- [ ] **Step 3: Replace the medical placeholder branch**

In `docs/walkthrough/slides.js`, replace the `medical` branch entry in the hub's `branches` array with:

```js
      {
        id: 'medical',
        label: 'medicalEmergency.js',
        sub: [
          {
            id: 's1',
            title: 'medicalEmergency.js — the three-act chain',
            body: `
              <p>The medical emergency is the project's flagship multi-stage event: <strong>Diagnosis → Treatment → Disposal</strong>. Each stage branches on the player's choice and on crew damage. It's the first real stress-test of the <code>multiStage.js</code> engine.</p>
              <p>Authored data lives in <code>src/content/medicalEmergency.js</code>. The system module wires stage transitions and computes outcomes (including the "leave the body or haul it" disposal beat).</p>
            `,
            snippets: [
              {
                path: 'src/systems/medicalEmergency.js',
                lines: [1, 40],
                caption: 'Module overview',
                code: `// Paste src/systems/medicalEmergency.js lines 1–40 here at implementation time.`,
              },
            ],
          },
          {
            id: 's2',
            title: 'Live: the mash-rescue UI',
            body: `
              <p>Click <strong>Start emergency</strong> below to run a seeded mash-rescue against the real modal renderer. The anti-mashing detection fires exactly as it does in the game — mash too fast and the outcome turns bad.</p>
              <p>This demo imports <code>src/systems/medicalEmergency.js</code> and <code>src/ui/modals.js</code> directly; no mock reimplementation.</p>
              <div id="demo-mashEmergency-mount"></div>
            `,
            demo: 'mashEmergency',
          },
        ],
      },
```

**IMPORTANT:** Update the snippet `code:` to real file contents at implementation time.

- [ ] **Step 4: Manually verify**

Navigate to hub → branch 4 (medical) → second sub-slide ("Live: the mash-rescue UI").
Expected:
- "Start emergency" button renders. Clicking it mounts the real mash-rescue modal.
- Mashing the button fires the anti-mash penalty per the live game behavior.
- Switching themes repaints the demo.

- [ ] **Step 5: Commit**

```bash
git add docs/walkthrough/demos/mashEmergency.js docs/walkthrough/slides.js
git commit -m "Code tour: medical branch content + real-module mash demo (refs #65)"
```

---

## Task 13: Remaining branch content — clickMetrics, awayTeam, small systems, scoring

**Files:**
- Modify: `docs/walkthrough/slides.js`

- [ ] **Step 1: Read source before authoring**

Run:
```bash
head -40 src/systems/clickMetrics.js
head -40 src/systems/awayTeam.js
head -20 src/content/awayTeamChains.js
head -30 src/systems/crew.js
head -30 src/systems/corpse.js
head -30 src/systems/waypoints.js
head -30 src/systems/career.js
head -30 src/systems/scoring.js
```

- [ ] **Step 2: Replace the remaining placeholder branches**

Replace the `clickmetrics`, `awayteam`, `smallsys`, and `scoring` entries in the hub `branches` array with:

```js
      {
        id: 'clickmetrics',
        label: 'clickMetrics.js',
        sub: [
          {
            id: 's1',
            title: 'clickMetrics.js — anti-mash detection',
            body: `
              <p>Every click through an event modal is timed and pattern-analyzed. Three signals drive the "you're not reading" flag: response time, always-first-option patterns, and near-zero variance. Above a threshold, the game rolls an anti-mash catastrophic emergency.</p>
              <p>The module is small and intentionally standalone so its thresholds can be tuned in one place.</p>
            `,
            snippets: [
              { path: 'src/systems/clickMetrics.js', lines: [1, 40], caption: 'Detection helpers',
                code: `// Paste src/systems/clickMetrics.js lines 1–40 here at implementation time.` },
            ],
          },
        ],
      },
      {
        id: 'awayteam',
        label: 'awayTeam.js',
        sub: [
          {
            id: 's1',
            title: 'awayTeam.js — divert and camp',
            body: `
              <p>Waypoint diverts dispatch an "away team" of 1–3 crew. The rover camps (does not advance km) while authored chains in <code>src/content/awayTeamChains.js</code> fire stage-per-sol. The reunion modal handles survivors, injuries, and body recovery.</p>
              <p>Built on the same <code>multiStage.js</code> engine as medical emergencies.</p>
            `,
            snippets: [
              { path: 'src/systems/awayTeam.js', lines: [1, 40], caption: 'Lifecycle entry',
                code: `// Paste src/systems/awayTeam.js lines 1–40 here at implementation time.` },
            ],
          },
          {
            id: 's2',
            title: 'Authored chains',
            body: `
              <p>Per-waypoint chains live in <code>src/content/awayTeamChains.js</code>, keyed by waypoint id. Each is a small state machine: stages with choices, some choices mutating <code>returnSolDelta</code> to extend or shorten the camp.</p>
            `,
            snippets: [
              { path: 'src/content/awayTeamChains.js', lines: [1, 40], caption: 'Chain shape',
                code: `// Paste src/content/awayTeamChains.js lines 1–40 here at implementation time.` },
            ],
          },
        ],
      },
      {
        id: 'smallsys',
        label: 'crew / corpse / waypoints',
        sub: [
          {
            id: 's1',
            title: 'Small systems grouped',
            body: `
              <p>Three small modules that share state:</p>
              <ul>
                <li><code>crew.js</code> — damage, status, death bookkeeping.</li>
                <li><code>corpse.js</code> — dead-but-present crew; feeds extra weight into cargo.</li>
                <li><code>waypoints.js</code> — rolling optional diverts along the route.</li>
              </ul>
              <p>None of them own much state by themselves; they're coordinators between <code>state.js</code> and the higher-level systems.</p>
            `,
            snippets: [
              { path: 'src/systems/crew.js',      lines: [1, 20], caption: 'crew.js entry',
                code: `// Paste src/systems/crew.js lines 1–20 here at implementation time.` },
              { path: 'src/systems/corpse.js',    lines: [1, 20], caption: 'corpse.js entry',
                code: `// Paste src/systems/corpse.js lines 1–20 here at implementation time.` },
              { path: 'src/systems/waypoints.js', lines: [1, 20], caption: 'waypoints.js entry',
                code: `// Paste src/systems/waypoints.js lines 1–20 here at implementation time.` },
            ],
          },
        ],
      },
      {
        id: 'scoring',
        label: 'career.js + scoring.js',
        sub: [
          {
            id: 's1',
            title: 'End-of-run scoring',
            body: `
              <p>When a run ends, <code>scoring.js</code> computes a score from science collected, sols survived, crew outcome, and modifiers. <code>career.js</code> persists science across runs for the long-term meta-progression.</p>
              <p>Both modules are pure — they take state in, return numbers out. Easy to unit-test under <code>sim/</code>.</p>
            `,
            snippets: [
              { path: 'src/systems/scoring.js', lines: [1, 30], caption: 'scoring.js entry',
                code: `// Paste src/systems/scoring.js lines 1–30 here at implementation time.` },
              { path: 'src/systems/career.js',  lines: [1, 30], caption: 'career.js entry',
                code: `// Paste src/systems/career.js lines 1–30 here at implementation time.` },
            ],
          },
        ],
      },
```

**IMPORTANT:** Replace each snippet's `code:` with the actual file contents and adjust `lines:` to match.

- [ ] **Step 3: Manually verify**

Walk through all four updated branches from the hub.
Expected: readable content, snippets expand and show real code, breadcrumbs accurate.

- [ ] **Step 4: Commit**

```bash
git add docs/walkthrough/slides.js
git commit -m "Code tour: clickMetrics/awayTeam/small-systems/scoring branch content (refs #65)"
```

---

## Task 14: Post-hub spine content — slides 10–16

**Files:**
- Modify: `docs/walkthrough/slides.js`

- [ ] **Step 1: Append the final seven spine slides**

Append to the end of the `spine` array (after the `hub` entry):

```js
  {
    id: 'content-vs-systems',
    title: 'Content vs. systems',
    body: `
      <p>Across the branches you just walked, one pattern repeats: <strong>logic in <code>src/systems/</code>, data in <code>src/content/</code></strong>. A system module knows <em>how</em>; a content module knows <em>what</em>.</p>
      <p>This split is why adding a new event, emergency, fact, or waypoint is usually a one-file change in <code>content/</code>. The systems stay stable; the world grows.</p>
    `,
  },
  {
    id: 'ui',
    title: 'UI layer',
    body: `
      <p><code>src/ui/modals.js</code> renders event cards, multi-stage dialogs, mash-rescue, codex pages, and so on. It is DOM-heavy but state-light — every modal receives the game state and a dispatch function, and returns nothing. All flow lives in <code>main.js</code>.</p>
      <p><code>src/ui/codex.js</code> handles the in-game encyclopedia of Mars facts that players unlock by playing.</p>
    `,
    snippets: [
      { path: 'src/ui/modals.js', lines: [1, 30], caption: 'Modal registry / entry',
        code: `// Paste src/ui/modals.js lines 1–30 here at implementation time.` },
    ],
  },
  {
    id: 'theme',
    title: 'Theme system',
    body: `
      <p>Three themes (plus Mission Control default): LCARS, Voltron HUD, Last Starfighter. Each is a stylesheet under <code>styles/theme-*.css</code> that overrides a shared set of CSS variables defined in <code>styles/theme.css</code>. <code>src/theme.js</code> is a 68-line switcher that sets <code>data-theme</code> on <code>&lt;body&gt;</code> and remembers the last choice in localStorage.</p>
      <p><strong>Live proof:</strong> this slideshow reuses those exact stylesheets. Change the theme dropdown in the top-right right now — every frame, chrome, and demo repaints instantly.</p>
    `,
    snippets: [
      { path: 'src/theme.js', lines: [1, 40], caption: 'Switcher core',
        code: `// Paste src/theme.js lines 1–40 here at implementation time.` },
    ],
  },
  {
    id: 'audio',
    title: 'Audio',
    body: `
      <p><code>src/audio.js</code> is a minimal music player: a shuffled playlist, a mute toggle, a manual track dropdown. It never auto-plays — users have to click first, per browser policy. The module exposes four functions and holds one <code>Audio</code> object; that's the entire surface.</p>
    `,
    snippets: [
      { path: 'src/audio.js', lines: [1, 30], caption: 'Player entry',
        code: `// Paste src/audio.js lines 1–30 here at implementation time.` },
    ],
  },
  {
    id: 'tests',
    title: 'Testing',
    body: `
      <p>Two kinds of test code:</p>
      <ul>
        <li><strong>Unit tests</strong> — <code>sim/*.test.mjs</code>, each uses <code>node --test</code>. Exercise pure functions from <code>src/systems/</code> and <code>src/theme.js</code>. Run one file: <code>node --test sim/theme.test.mjs</code>.</li>
        <li><strong>Playtest harness</strong> — <code>sim/play.mjs</code> and <code>sim/playtest1000.mjs</code>. Runs thousands of AI-driven playthroughs with various strategies, prints a balance table. This catches difficulty regressions that unit tests can't.</li>
      </ul>
      <p>Both paths depend on keeping system modules pure (no DOM imports in <code>src/systems/</code>).</p>
    `,
  },
  {
    id: 'workflow',
    title: 'Workflow',
    body: `
      <p>Every change follows the same trail:</p>
      <ol>
        <li><strong>GitHub issue</strong> — describes problem + acceptance criteria.</li>
        <li><strong>Spec</strong> — <code>docs/superpowers/specs/YYYY-MM-DD-&lt;topic&gt;-design.md</code>.</li>
        <li><strong>Plan</strong> — <code>docs/superpowers/plans/YYYY-MM-DD-&lt;topic&gt;.md</code> (this tour is one).</li>
        <li><strong>Implementation</strong> — small commits, each referencing the issue.</li>
        <li><strong>Release</strong> — SemVer git tag + GitHub release.</li>
      </ol>
      <p>The <code>docs/superpowers/</code> directory is the repository of all past specs and plans, and is a great read in its own right.</p>
    `,
  },
  {
    id: 'credits',
    title: 'End of tour',
    body: `
      <p>Thanks for walking through. Suggested next steps:</p>
      <ul>
        <li>Play a run — <code>index.html</code> in the repo root.</li>
        <li>Skim the most recent spec in <code>docs/superpowers/specs/</code> to see the current frontier.</li>
        <li>Pick any system that caught your eye and read its test file under <code>sim/</code>.</li>
      </ul>
      <p>Press <strong>Home</strong> to return to the start of the tour, or close the tab.</p>
    `,
  },
```

**IMPORTANT:** Replace each snippet's `code:` with actual file contents and adjust `lines:` to match.

- [ ] **Step 2: Manually verify**

Walk the spine end-to-end.
Expected:
- 16 total spine slides. Progress counter reads "SPINE N / 16".
- All post-hub slides render cleanly.
- Theme slide's callout still matches live behavior.
- Home key returns to slide 1; End key jumps to slide 16.

- [ ] **Step 3: Commit**

```bash
git add docs/walkthrough/slides.js
git commit -m "Code tour: post-hub spine slides — content, UI, theme, audio, tests, workflow, credits (refs #65)"
```

---

## Task 15: Smoke test + README link

**Files:**
- Create: `sim/walkthroughSmoke.test.mjs`
- Modify: `README.md`

- [ ] **Step 1: Write the smoke test**

Create `sim/walkthroughSmoke.test.mjs`:

```js
// Smoke test for the code-tour demos.
// Asserts each demo module imports cleanly under Node and exposes the expected surface.
// Does NOT exercise DOM behavior — only catches import-path drift and top-level export rot.
//
// Run: node --test sim/walkthroughSmoke.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Install a minimal DOM shim for modules that touch document at import time.
// If a demo imports src/ui/modals.js and that file touches document at module top,
// this prevents a ReferenceError. Adapt the shim if a demo needs more.
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: () => ({ style: {}, appendChild() {}, addEventListener() {}, setAttribute() {}, removeAttribute() {}, querySelectorAll: () => [], classList: { add() {}, remove() {}, toggle() {} } }),
    getElementById: () => null,
    addEventListener: () => {},
    querySelectorAll: () => [],
    body: { setAttribute() {}, removeAttribute() {}, appendChild() {} },
  };
}
if (typeof globalThis.window === 'undefined') {
  globalThis.window = { location: { hash: '' }, history: { pushState() {} }, addEventListener() {} };
}
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = { getItem: () => null, setItem() {} };
}

test('loop demo module imports and exposes init()', async () => {
  const mod = await import('../docs/walkthrough/demos/loop.js');
  assert.equal(typeof mod.init, 'function');
});

test('eventPreview demo module imports, exposes init() and its documented export constant', async () => {
  const mod = await import('../docs/walkthrough/demos/eventPreview.js');
  assert.equal(typeof mod.init, 'function');
  assert.equal(typeof mod.REQUIRED_MODAL_EXPORT, 'string');
  assert.ok(mod.REQUIRED_MODAL_EXPORT.length > 0);
});

test('mashEmergency demo module imports, exposes init() and its documented export constants', async () => {
  const mod = await import('../docs/walkthrough/demos/mashEmergency.js');
  assert.equal(typeof mod.init, 'function');
  assert.ok(Array.isArray(mod.REQUIRED_MEDICAL_EXPORTS));
  assert.ok(mod.REQUIRED_MEDICAL_EXPORTS.every(k => typeof k === 'string' && k.length > 0));
  assert.equal(typeof mod.REQUIRED_MODAL_EXPORT, 'string');
});

test('eventPreview declared modal export exists on src/ui/modals.js', async () => {
  const demo = await import('../docs/walkthrough/demos/eventPreview.js');
  const modals = await import('../src/ui/modals.js');
  assert.equal(
    typeof modals[demo.REQUIRED_MODAL_EXPORT],
    'function',
    `src/ui/modals.js must export ${demo.REQUIRED_MODAL_EXPORT}; update either the source or demos/eventPreview.js.`
  );
});

test('mashEmergency declared exports exist on their source modules', async () => {
  const demo = await import('../docs/walkthrough/demos/mashEmergency.js');
  const med = await import('../src/systems/medicalEmergency.js');
  for (const k of demo.REQUIRED_MEDICAL_EXPORTS) {
    assert.equal(typeof med[k], 'function',
      `src/systems/medicalEmergency.js must export ${k}; update either source or demos/mashEmergency.js.`);
  }
  const modals = await import('../src/ui/modals.js');
  assert.equal(
    typeof modals[demo.REQUIRED_MODAL_EXPORT],
    'function',
    `src/ui/modals.js must export ${demo.REQUIRED_MODAL_EXPORT}.`
  );
});
```

- [ ] **Step 2: Run the smoke test**

Run: `node --test sim/walkthroughSmoke.test.mjs`
Expected: PASS. If an import fails, adjust the DOM shim or the `REQUIRED_*` constants in the demo files until the test passes. The shim should be kept minimal — don't add methods just to silence an error; understand why the real code needs them first.

- [ ] **Step 3: Add README link**

Open `README.md` and add one line near the top of the project description (below the title / first paragraph):

```markdown
**New to this repo?** Open [`docs/walkthrough/index.html`](docs/walkthrough/index.html) for an interactive code tour.
```

Adapt phrasing / placement to the existing README style.

- [ ] **Step 4: Full-spine manual smoke**

Open the tour in a browser. Quickly:
- Click through the full spine (← → all the way, both directions)
- Open every hub branch, reach the last sub-slide, confirm NEXT returns to hub
- Confirm all three real demos load and accept interaction
- Switch each of the four themes; confirm chrome + demos repaint
- Deep-link directly to `index.html#slide-8`, `#branch-medical-1` — both should open straight to that spot

- [ ] **Step 5: Commit**

```bash
git add sim/walkthroughSmoke.test.mjs README.md
git commit -m "Code tour: smoke test for demo imports + README link (closes #65)"
```

---

## Self-Review

**Spec coverage:**

- Standalone `docs/walkthrough/index.html`, no build step — Task 1.
- Linear spine of 16 slides — Tasks 6, 7, 14.
- Hub slide (slide 9) with 8 branches — Tasks 9, 10, 12, 13.
- Four live demos (three real + always-on theme toggle) — Tasks 4 (theme), 8 (loop), 11 (event preview), 12 (mash).
- Expandable code snippets with filename+line labels and "View on GitHub" — Task 5.
- Keyboard nav (← → Esc Home End digits) — Tasks 3, 9.
- Theme toggle using `src/theme.js` + four themes (mc/lcars/voltron/starfighter) — Task 4.
- Progress indicator on spine + breadcrumb in branches — Tasks 3, 9.
- Hash-based deep-linking with browser back/forward — Task 3.
- Session-only theme (no localStorage read) — Task 4.
- `sim/walkthroughSmoke.test.mjs` asserting import-path health — Task 15.
- README link — Task 15.

**Placeholder scan:** Every content-bearing task has `IMPORTANT:` notes where real file contents must be inlined and line ranges updated. That's not a placeholder — it's the acknowledged authoring step for content slides, called out loudly each time. No TBDs, TODOs, or "implement later" left in the plan.

**Type consistency:** `parseHash`, `hashFor`, `routeForward`, `routeBack`, `routeToSlide` are named the same in the test, in `router.js`, and in `tour.js`. The demo registry uses `loop` / `eventPreview` / `mashEmergency` consistently in `tour.js`, in each demo file, in the mount-id convention (`demo-<key>-mount`), and in the smoke test. `REQUIRED_MODAL_EXPORT` / `REQUIRED_MEDICAL_EXPORTS` are constants in the demo files and asserted by the same names in the smoke test.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-21-code-tour-slideshow.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
