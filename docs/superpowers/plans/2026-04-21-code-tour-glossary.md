# Code-Tour Glossary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline clickable term definitions to the Mars Trail code-tour slideshow so entry-level devs can expand 1–3-sentence definitions on any marked term in slide prose.

**Architecture:** A new trusted in-repo data file (`glossary.js`) holds `{ slug: { term, def } }` entries. Slide prose marks terms via `<span class="term" data-term="slug">…</span>`. A new wire helper in `tour.js` renders those spans as `<button class="term">` at render time, and on click toggles a sibling `<div class="term-def">` with the definition. Theming via `currentColor` + existing CSS variables. Smoke-test extension asserts the data shape.

**Tech Stack:** Vanilla JS (ES modules), vanilla CSS, `node --test`. No build step.

**Spec:** `docs/superpowers/specs/2026-04-21-code-tour-glossary-design.md`
**Issue:** #67 (extends #65 / PR #66)

---

## File structure

**New:**
- `docs/walkthrough/glossary.js` — exports `GLOSSARY` object.

**Modified:**
- `docs/walkthrough/tour.js` — import `GLOSSARY`; add `wireGlossaryTerms(stage)`; call from `render()`.
- `docs/walkthrough/tour.css` — `.term` + `.term-def` styles.
- `docs/walkthrough/slides.js` — mark up term occurrences.
- `sim/walkthroughSmoke.test.mjs` — extend with glossary-shape test.

**Untouched:** everything under `src/`, `styles/`, other sim tests, the game.

---

## Task 1: Create `glossary.js` with initial terms

**Files:**
- Create: `docs/walkthrough/glossary.js`

- [ ] **Step 1: Author the file with the full initial term set**

Create `docs/walkthrough/glossary.js`:

```js
// Glossary for the code-tour slideshow.
// Each entry's `def` is trusted HTML — rendered unescaped when a term is clicked.
// Definitions authored in-repo for entry-level devs: 1–3 sentences, plain language.
// Keys are kebab-case; `term` is the display label; `def` is short HTML.

export const GLOSSARY = {
  'es-modules': {
    term: 'ES modules',
    def: `<p>The official JavaScript module system (<code>import</code> / <code>export</code>). Each file is its own scope, and the browser loads imports on demand. No bundler or build step needed.</p>`,
  },
  'dom': {
    term: 'DOM',
    def: `<p>The "Document Object Model" — the live tree of HTML elements in your browser tab. JavaScript reads and mutates it to change what the user sees.</p>`,
  },
  'pure-function': {
    term: 'pure function',
    def: `<p>A function whose output depends only on its arguments and that doesn't touch the outside world. Same inputs always give the same outputs, which makes them trivial to unit-test.</p>`,
  },
  'single-source-of-truth': {
    term: 'single source of truth',
    def: `<p>A pattern where one object (here, <code>state.js</code>'s state tree) is the only place a given piece of data lives. Everything else reads from it and writes through well-defined paths, so there's never a "which copy is right?" question.</p>`,
  },
  'virtual-dom': {
    term: 'virtual DOM',
    def: `<p>A technique popularized by React where the framework keeps a JS-object copy of the DOM, diffs new versus old on each change, and applies only the minimum updates. Mars Trail deliberately doesn't use one — it just rebuilds from scratch.</p>`,
  },
  'reactive-framework': {
    term: 'reactive framework',
    def: `<p>A library (React, Vue, Svelte, Solid, …) that automatically re-renders UI when the data it depends on changes. Mars Trail doesn't use one; <code>render(state)</code> is called manually after every state change.</p>`,
  },
  'css-variable': {
    term: 'CSS variable',
    def: `<p>Also called a "custom property." A value you define once (<code>--panel-border: #0a8;</code>) and reuse with <code>var(--panel-border)</code>. Themes override the variables so every element using them repaints automatically.</p>`,
  },
  'hash-routing': {
    term: 'hash-based routing',
    def: `<p>Using the part of a URL after <code>#</code> (like <code>#slide-5</code>) as the page's current "location." It never hits the server, works with browser back/forward, and needs no backend — perfect for a single-file app.</p>`,
  },
  'factory-function': {
    term: 'factory function',
    def: `<p>A plain function that builds and returns a fresh object. <code>createInitialState()</code> is the example here: call it to get a new game state without touching any existing ones.</p>`,
  },
  'dispatch': {
    term: 'dispatch',
    def: `<p>In this codebase, a callback passed down into UI so it can say "the user chose X." The UI doesn't mutate state directly — it calls <code>dispatch</code> and lets the system decide what to do. Keeps the flow one-directional.</p>`,
  },
  'local-storage': {
    term: 'localStorage',
    def: `<p>A browser key-value store that persists across tabs and page reloads on the same origin. The game uses it for theme choice and best-run score; the tour intentionally does not.</p>`,
  },
  'dynamic-import': {
    term: 'dynamic import',
    def: `<p>An <code>import()</code> call inside a function (not at the top of the file). It returns a promise, so the module only loads when that code runs — useful for demos that shouldn't load until the user opens the slide.</p>`,
  },
  'try-finally': {
    term: 'try/finally',
    def: `<p>A JS block that guarantees the <code>finally</code> branch runs whether the <code>try</code> succeeded or threw. The tour uses it to restore DOM ids even if a real game modal blows up while rendering a demo.</p>`,
  },
  'heuristic': {
    term: 'heuristic',
    def: `<p>A rule-of-thumb that's usually right but not guaranteed. The anti-mashing detector uses heuristics (response time + bucket patterns) — it might flag a thoughtful-but-fast player, but in aggregate it catches careless clicking.</p>`,
  },
  'multi-stage-event': {
    term: 'multi-stage event',
    def: `<p>An in-game event with more than one screen: each choice can point to another stage (e.g., diagnose → treat → dispose), rather than resolving immediately. The engine that walks these chains is <code>src/systems/multiStage.js</code>.</p>`,
  },
  'sol': {
    term: 'sol',
    def: `<p>A Martian day — about 24 hours 39 minutes. The game's turn unit. "Sol 5" = day 5 of the mission.</p>`,
  },
  'eva': {
    term: 'EVA',
    def: `<p>Extravehicular activity — a crewed trip outside the rover (spacewalk, surface work). The game tracks EVA suit charges as a limited resource.</p>`,
  },
  'lmst': {
    term: 'LMST',
    def: `<p>Local Mean Solar Time — the clock that keeps the rover's day aligned with the Martian sun, used by NASA mission planners. Shown in the tour's header clock for flavor.</p>`,
  },
  'waypoint': {
    term: 'waypoint',
    def: `<p>An optional off-route detour along the mission path. Accepting one dispatches an "away team" of 1–3 crew while the rover camps; the chain plays out over a few sols, then the team returns (or doesn't).</p>`,
  },
  'anti-mashing': {
    term: 'anti-mashing',
    def: `<p>Detection that a player is clicking through event modals too fast or always-first to actually have read them. If the score gets high enough, the game rolls a punitive emergency — the only path you can't button-mash through.</p>`,
  },
};
```

- [ ] **Step 2: Verify the file parses and imports**

Run:
```bash
node --check docs/walkthrough/glossary.js
node --input-type=module -e "import('./docs/walkthrough/glossary.js').then(m => console.log('entries:', Object.keys(m.GLOSSARY).length))"
```
Expected: no syntax errors; prints `entries: 20`.

- [ ] **Step 3: Commit**

```bash
git add docs/walkthrough/glossary.js
git commit -m "Code tour: glossary data with 20 initial term definitions (refs #67)"
```

---

## Task 2: Smoke-test the glossary shape

**Files:**
- Modify: `sim/walkthroughSmoke.test.mjs`

- [ ] **Step 1: Append the glossary test block**

Add these tests at the bottom of `sim/walkthroughSmoke.test.mjs` (before the last closing brace of whatever existing file structure — just append at EOF, the file is a flat list of `test()` calls):

```js
test('glossary module imports and exposes a non-empty GLOSSARY object', async () => {
  const mod = await import('../docs/walkthrough/glossary.js');
  assert.equal(typeof mod.GLOSSARY, 'object');
  assert.ok(mod.GLOSSARY !== null);
  const keys = Object.keys(mod.GLOSSARY);
  assert.ok(keys.length > 0, 'GLOSSARY must have at least one entry');
});

test('every glossary entry has non-empty term + def strings', async () => {
  const { GLOSSARY } = await import('../docs/walkthrough/glossary.js');
  for (const [slug, entry] of Object.entries(GLOSSARY)) {
    assert.equal(typeof entry.term, 'string', `${slug}: term must be a string`);
    assert.ok(entry.term.length > 0, `${slug}: term must be non-empty`);
    assert.equal(typeof entry.def, 'string', `${slug}: def must be a string`);
    assert.ok(entry.def.length > 0, `${slug}: def must be non-empty`);
  }
});

test('every glossary slug is kebab-case (lowercase letters, digits, hyphens)', async () => {
  const { GLOSSARY } = await import('../docs/walkthrough/glossary.js');
  const kebab = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  for (const slug of Object.keys(GLOSSARY)) {
    assert.match(slug, kebab, `${slug} is not kebab-case`);
  }
});
```

- [ ] **Step 2: Run the tests**

Run:
```bash
node --test sim/walkthroughSmoke.test.mjs
```
Expected: all smoke tests pass (previously 5; now 8).

Run the full suite:
```bash
node --test sim/*.test.mjs
```
Expected: 136 + 3 = **139 tests**, all passing.

- [ ] **Step 3: Commit**

```bash
git add sim/walkthroughSmoke.test.mjs
git commit -m "Code tour: smoke-test the glossary data shape (refs #67)"
```

---

## Task 3: Wire the glossary into `tour.js` + add CSS

**Files:**
- Modify: `docs/walkthrough/tour.js`
- Modify: `docs/walkthrough/tour.css`

- [ ] **Step 1: Add CSS for `.term` and `.term-def`**

Append to `docs/walkthrough/tour.css`:

```css
/* Glossary term buttons. Inherit the themed text color. */
.term {
  background: none;
  border: 0;
  padding: 0;
  margin: 0;
  font: inherit;
  color: currentColor;
  cursor: pointer;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
}

.term:hover,
.term:focus-visible {
  opacity: 0.75;
  outline: none;
}

.term[aria-expanded="true"] {
  font-weight: 600;
}

.term-def {
  margin: 6px 0 10px 14px;
  padding: 8px 12px;
  border-left: 3px solid var(--panel-border, currentColor);
  opacity: 0.9;
  font-size: 0.95em;
}

.term-def p:first-child { margin-top: 0; }
.term-def p:last-child  { margin-bottom: 0; }
```

- [ ] **Step 2: Import `GLOSSARY` in tour.js**

Add near the top of `docs/walkthrough/tour.js`, after the existing imports:

```js
import { GLOSSARY } from './glossary.js';
```

- [ ] **Step 3: Add `wireGlossaryTerms` helper**

Insert this function in `docs/walkthrough/tour.js` near the other wire helpers (after `wireHubTiles`):

```js
// Promote authored <span class="term" data-term="slug"> markers to interactive
// buttons that toggle an inline definition pane. GLOSSARY.def is trusted HTML.
function wireGlossaryTerms(stage) {
  let counter = 0;
  for (const span of stage.querySelectorAll('span.term[data-term]')) {
    const slug = span.dataset.term;
    const entry = GLOSSARY[slug];
    if (!entry) {
      console.warn(`Unknown term: "${slug}" — check data-term against glossary.js`);
      continue;
    }
    const defId = `term-def-${slug}-${++counter}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'term';
    button.dataset.term = slug;
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', defId);
    button.textContent = span.textContent;
    span.replaceWith(button);

    button.addEventListener('click', () => {
      const isOpen = button.getAttribute('aria-expanded') === 'true';
      if (isOpen) {
        const existing = document.getElementById(defId);
        if (existing) existing.remove();
        button.setAttribute('aria-expanded', 'false');
        return;
      }
      const def = document.createElement('div');
      def.className = 'term-def';
      def.id = defId;
      def.setAttribute('role', 'region');
      def.innerHTML = entry.def;
      button.insertAdjacentElement('afterend', def);
      button.setAttribute('aria-expanded', 'true');
    });
  }
}
```

- [ ] **Step 4: Call it from `render()`**

Locate `render(location)` in `tour.js`. After the existing `wireHubTiles(stage);` line, add `wireGlossaryTerms(stage);`:

The final render body should look like:

```js
function render(location) {
  const slide = slideAt(location);
  const stage = document.getElementById('tour-stage');
  stage.innerHTML = renderSlideHtml(slide, location);
  wireSnippetToggles(stage);
  wireHubTiles(stage);
  wireGlossaryTerms(stage);
  renderProgress(location);
  mountDemo(slide);
}
```

- [ ] **Step 5: Sanity-check**

Run:
```bash
node --check docs/walkthrough/tour.js
node --test sim/*.test.mjs
```
Expected: no syntax errors; 139 tests passing.

Until Task 4 actually marks up terms in slides, the wire helper's `querySelectorAll` returns nothing and this commit has no visible effect — that's fine.

- [ ] **Step 6: Commit**

```bash
git add docs/walkthrough/tour.js docs/walkthrough/tour.css
git commit -m "Code tour: wire glossary term markup into tour.js + CSS (refs #67)"
```

---

## Task 4: Mark up terms in slides.js

**Files:**
- Modify: `docs/walkthrough/slides.js`

- [ ] **Step 1: Apply term markup across slide bodies**

Go through `docs/walkthrough/slides.js` and wrap term occurrences in `<span class="term" data-term="<slug>">display text</span>`. Rules:

- Only wrap **the first** occurrence of each term per slide (avoid every paragraph turning into a click-maze).
- Only wrap terms where the surrounding prose actually uses them; don't force-insert definitions to show them off.
- Don't wrap terms inside `<code>` blocks or snippet `code:` strings.
- Don't wrap terms inside captions or labels that already use `<code>` formatting for code identifiers.

Concrete replacements (exhaustive list — grep for each original phrase and replace once per slide):

1. **loop slide body:**
   - `<em>no</em> observer pattern, <em>no</em> virtual DOM, <em>no</em> <span class="term" data-term="reactive-framework">reactive framework</span>`
   - (Wrap only "reactive framework" — "virtual DOM" is a separate term, wrap it too:)
   - `<em>no</em> <span class="term" data-term="virtual-dom">virtual DOM</span>, <em>no</em> <span class="term" data-term="reactive-framework">reactive framework</span>`

2. **stack slide body:**
   - `<strong>Vanilla <span class="term" data-term="es-modules">ES modules</span>.</strong>`

3. **state slide body:**
   - `central export is a <span class="term" data-term="factory-function">factory</span>, <code>createInitialState()</code>`

4. **render slide body:**
   - `<code>src/render.js</code> is a <span class="term" data-term="pure-function">pure</span> <code>state → DOM</code> projection.`
   - Also wrap "DOM" elsewhere in the same slide body if it appears outside a `<code>` — check the text; if it only appears inside `<code>` tags, skip.

5. **travel s1 body:**
   - `The module is (mostly) <span class="term" data-term="pure-function">pure</span>`
   - `<span class="term" data-term="sol">sol</span>` on first "per-sol" or "sol" usage in prose.

6. **travel s2 body:**
   - If there's a "NEXT SOL" phrase, don't wrap (that's UI chrome). If prose says "a sol" unqualified, wrap `<span class="term" data-term="sol">sol</span>`.

7. **events s1 body:**
   - `based on segment, pace, and weighting` — no term here.

8. **multistage s1 body:**
   - `A <span class="term" data-term="multi-stage-event">multi-stage event</span> is an authored chain`

9. **medical s1 body:**
   - `first real stress-test of the <code>multiStage.js</code> engine.` — no term.

10. **medical s2 body:**
    - `<span class="term" data-term="anti-mashing">anti-mashing</span> detection fires exactly as it does in the game`

11. **clickmetrics s1 body:**
    - `the actual classifier (buckets vs expected read duration)` — wrap `<span class="term" data-term="heuristic">classifier</span>` if the word "heuristic" or "classifier" appears; otherwise add "heuristic" near the description.
    - Simpler target: `Three signals drive the "you're not reading" flag` or similar — check the current text. If the word "heuristic" is there, wrap it; if not, skip and rely on the anti-mashing term in the medical slide.

12. **awayteam s1 body:**
    - `an "away team" of 1–3 crew` — consider wrapping `<span class="term" data-term="waypoint">waypoint</span>` if the slide mentions waypoint diverts. Target the first "waypoint" occurrence.
    - First mention of `<span class="term" data-term="sol">sol</span>` in prose.

13. **smallsys s1 body:**
    - No obvious terms to wrap.

14. **scoring s1 body:**
    - `Both modules are <span class="term" data-term="pure-function">pure</span>` — first word.

15. **content-vs-systems slide body:**
    - No new terms (concepts already covered).

16. **ui slide body:**
    - `every modal receives the game state and a <span class="term" data-term="dispatch">dispatch</span> function` — wrap "dispatch".

17. **theme slide body:**
    - `overrides a shared set of <span class="term" data-term="css-variable">CSS variables</span>`
    - `remembers the last choice in <span class="term" data-term="local-storage">localStorage</span>`

18. **audio slide body:**
    - No obvious terms unless "localStorage" appears.

19. **tests slide body:**
    - No obvious terms (the audience for this slide already knows what a unit test is).

20. **workflow slide body:**
    - No obvious terms.

21. **credits slide body:**
    - No new terms.

**Also check spine headers and branches for term opportunities** — but keep the "first occurrence per slide" rule.

Terms not yet wrapped after this pass (because no natural prose hosts them): `dom`, `hash-routing`, `single-source-of-truth`, `dynamic-import`, `try-finally`, `eva`, `lmst`. If the current slide prose has them, wrap; if not, leave the entry in the glossary for future use.

**The wrapping rule of thumb:** if reading the slide prose aloud would make an entry-level dev pause and say "wait, what's X?", wrap X. Otherwise don't.

Do not rewrite slide prose just to host a term. If the natural prose doesn't use a glossary term, skip it.

- [ ] **Step 2: Verify parse + tests**

Run:
```bash
node --check docs/walkthrough/slides.js
node --test sim/*.test.mjs
```
Expected: clean parse; 139 tests passing.

- [ ] **Step 3: Visually verify term markup (optional — requires local HTTP server)**

If a browser check is possible: start `python3 -m http.server 8765` from the worktree, open `http://localhost:8765/docs/walkthrough/`, and spot-check that each marked term is dotted-underlined, clickable, and toggles a definition. Close definitions, switch themes, confirm repaint. If no browser access, skip — static checks are enough.

- [ ] **Step 4: Commit**

```bash
git add docs/walkthrough/slides.js
git commit -m "Code tour: mark up glossary terms in slide prose (refs #67)"
```

---

## Self-Review

**Spec coverage:**

- `glossary.js` with 20 initial entries — Task 1.
- `GLOSSARY` keyed by slug with `term` + `def` (trusted HTML) — Task 1.
- `.term` markup in slide prose — Task 4.
- `wireGlossaryTerms(stage)` helper, called from `render()` — Task 3.
- Inline toggle behavior (click opens / click closes, multiple open simultaneously) — Task 3 (via `aria-expanded` check + insertAdjacentElement / removeElement).
- Unknown-slug warning without crash — Task 3 (`console.warn` + `continue`).
- Accessibility (real `<button>`, `aria-expanded`, `aria-controls`, free keyboard) — Task 3.
- `.term` / `.term-def` styled with `currentColor` + `var(--panel-border)` — Task 3.
- Smoke-test for glossary shape — Task 2.

**Placeholder scan:** No "TBD", "TODO", "Add error handling" text. The Task 4 markup list is exhaustive per slide.

**Type consistency:** `GLOSSARY` keys kebab-case; `data-term` values match slugs; `id="term-def-${slug}-${counter}"` matches `aria-controls`.

**Known soft spots:**
- Task 4's markup list names concrete occurrences, but since slide prose may have drifted since spec-time, the implementer should search for the quoted substrings and apply edits; if a substring doesn't match exactly, apply the spirit of the instruction rather than skipping.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-21-code-tour-glossary.md`. Two execution options:

1. **Subagent-Driven** — fresh subagent per task with two-stage review.
2. **Inline Execution** — execute tasks in this session with checkpoints.

Given this is a 4-task plan, tightly scoped, and immediately follows completed work in the same branch, **inline execution is probably the right fit** — less overhead, and the controller (me) can iterate directly on the handful of edits. But I'll let you pick.

Which approach?
