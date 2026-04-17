# End-of-Run Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every completed run a letter rank (S/A/B/C/D/F), a point score with breakdown, and a localStorage-persisted best-run shown on the title screen.

**Architecture:** One new pure module (`src/systems/scoring.js`) with `computeScore`, `loadBestRun`, `saveBestRun`. Two thin UI integrations (end-of-run modal, title screen). One CSS pass. Game-state pipeline (travel/events/state) untouched.

**Tech Stack:** Vanilla ES modules. Tests via Node's built-in `node --test` runner (no new dependencies). Target Node 18+ (have 25.6.1).

**Related:** Spec at `docs/superpowers/specs/2026-04-16-end-of-run-scoring-design.md`. Closes issue #9. Ships as `v0.3.0`.

---

## File Structure

**Create:**
- `src/systems/scoring.js` — pure scoring module. ~70 lines.
- `sim/scoring.test.mjs` — Node-built-in tests. ~120 lines.

**Modify:**
- `src/ui/modals.js` — add rank block to `showEndOfRunModal`; add BEST caption to title-screen rendering. ~40 lines changed total.
- `styles/modals.css` — rank block (letter, breakdown) + BEST caption. ~50 lines added.

**Untouched:** `src/state.js`, `src/systems/travel.js`, `src/systems/events.js`, all content modules, `sim/play.mjs`.

---

## Task 1: `computeScore` — pure function with tests

**Files:**
- Create: `src/systems/scoring.js`
- Create: `sim/scoring.test.mjs`

TDD approach: write all tests first (they'll fail because the module doesn't exist), then implement to pass.

- [ ] **Step 1: Create the test file with six initial tests**

Create `sim/scoring.test.mjs`:

```js
// Tests for src/systems/scoring.js. Run: node --test sim/scoring.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeScore } from '../src/systems/scoring.js';

// --- Helper: build a minimal end-of-run state for tests ---
function makeState(overrides = {}) {
  return {
    status: 'won',
    sol: 24,
    totalKmTraveled: 2550,
    currentLandmarkIndex: 7,              // destination reached
    route: ['jezero','syrtis','arabia','meridiani','gale','elysium','tharsis','olympus_base'],
    routeKm: [330, 420, 290, 360, 460, 315, 375],   // sum 2550
    sciencePoints: 240,
    resources: { oxygen: 40, water: 50, food: 35, power: 80, panels: 100, mech: 1, eva: 1, cell: 1 },
    crew: [
      { id:'c1', alive:true  },
      { id:'c2', alive:true  },
      { id:'c3', alive:true  },
      { id:'c4', alive:true  },
      { id:'c5', alive:false }
    ],
    ...overrides
  };
}

test('won run with 4/5 crew, moderate speed, 240 sci → A rank', () => {
  const { points, rank, breakdown } = computeScore(makeState());
  // Expected:
  //   outcome 500 + crew 400 + sci 240 + resources round((40+50+35+80)/4)=51 cap100 → 51
  //   + speed max(0, 300-24*10)=60 + landmarks 7*20=140 = 1391
  assert.equal(rank, 'A');
  assert.equal(points, 1391);
  assert.equal(breakdown.length, 6);
});

test('perfect won run (5/5 crew, fast, high sci, full resources) → S rank', () => {
  const s = makeState({
    sol: 12,
    sciencePoints: 500,
    resources: { oxygen: 90, water: 90, food: 90, power: 90, panels: 100, mech: 1, eva: 1, cell: 1 },
    crew: [
      { id:'c1', alive:true }, { id:'c2', alive:true }, { id:'c3', alive:true },
      { id:'c4', alive:true }, { id:'c5', alive:true }
    ]
  });
  const { points, rank } = computeScore(s);
  // 500 + 500 + 300 (capped) + 90 + 180 (300-120) + 140 = 1710
  assert.equal(rank, 'S');
  assert.equal(points, 1710);
});

test('won run with only 2/5 crew and low sci → B rank', () => {
  const s = makeState({
    sciencePoints: 50,
    crew: [
      { id:'c1', alive:true }, { id:'c2', alive:true },
      { id:'c3', alive:false }, { id:'c4', alive:false }, { id:'c5', alive:false }
    ]
  });
  const { points, rank } = computeScore(s);
  // 500 + 200 + 50 + 51 + 60 + 140 = 1001 → B (≥900)
  assert.equal(rank, 'B');
  assert.equal(points, 1001);
});

test('lost run at >80% distance → C rank (near-miss loss)', () => {
  const s = makeState({
    status: 'lost',
    totalKmTraveled: 2100,                 // 2100/2550 = 82%
    currentLandmarkIndex: 5,
    sol: 30,
    sciencePoints: 180,
    crew: [
      { id:'c1', alive:true }, { id:'c2', alive:false }, { id:'c3', alive:false },
      { id:'c4', alive:false }, { id:'c5', alive:false }
    ]
  });
  const { points, rank } = computeScore(s);
  // outcome 100 (≥80%) + crew 100 + sci 180 + resources 51 + speed 0 (lost) + landmarks 5*20=100
  // = 531. Lost with 531 → D (<700).
  assert.equal(points, 531);
  assert.equal(rank, 'D');
});

test('early-wipe lost run → F rank', () => {
  const s = makeState({
    status: 'lost',
    totalKmTraveled: 100,
    currentLandmarkIndex: 0,
    sol: 4,
    sciencePoints: 5,
    resources: { oxygen: 0, water: 0, food: 0, power: 0, panels: 0, mech: 0, eva: 0, cell: 0 },
    crew: [ { id:'c1', alive:false }, { id:'c2', alive:false }, { id:'c3', alive:false },
            { id:'c4', alive:false }, { id:'c5', alive:false } ]
  });
  const { points, rank } = computeScore(s);
  // 0 + 0 + 5 + 0 + 0 (lost) + 0 = 5 → F
  assert.equal(points, 5);
  assert.equal(rank, 'F');
});

test('won run with very low score still at least C', () => {
  const s = makeState({
    sol: 80,                               // speed bonus = max(0, 300-800) = 0
    sciencePoints: 0,
    resources: { oxygen: 0, water: 0, food: 0, power: 0, panels: 0, mech: 0, eva: 0, cell: 0 },
    crew: [ { id:'c1', alive:true }, { id:'c2', alive:false }, { id:'c3', alive:false },
            { id:'c4', alive:false }, { id:'c5', alive:false } ]
  });
  const { points, rank } = computeScore(s);
  // 500 + 100 + 0 + 0 + 0 + 140 = 740 → B (≥900 no), C floor for won
  assert.equal(points, 740);
  assert.equal(rank, 'C');
});
```

- [ ] **Step 2: Run tests — should fail on import**

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node --test sim/scoring.test.mjs`

Expected: all six tests fail with something like `Error: Cannot find module '../src/systems/scoring.js'`. The file doesn't exist yet.

- [ ] **Step 3: Write minimal `computeScore`**

Create `src/systems/scoring.js`:

```js
// Mars Trail — end-of-run scoring + best-run persistence.
// Pure module. Import from game systems or UI; no state mutation.

const RANK_THRESHOLDS_WON  = [['S', 1500], ['A', 1200], ['B', 900]];  // fall through to 'C'
const RANK_THRESHOLDS_LOST = [['C', 700], ['D', 400]];                // fall through to 'F'

function totalRouteKm(state) {
  return (state.routeKm || []).reduce((sum, km) => sum + km, 0);
}

function rankFor(points, won) {
  const table = won ? RANK_THRESHOLDS_WON : RANK_THRESHOLDS_LOST;
  for (const [rank, min] of table) {
    if (points >= min) return rank;
  }
  return won ? 'C' : 'F';
}

export function computeScore(state) {
  const won = state.status === 'won';
  const breakdown = [];

  const outcomePts = won
    ? 500
    : state.totalKmTraveled >= 0.8 * totalRouteKm(state) ? 100 : 0;
  breakdown.push({ label: 'Mission outcome', value: state.status, points: outcomePts });

  const alive = state.crew.filter(c => c.alive).length;
  breakdown.push({ label: 'Crew survived', value: `${alive}/${state.crew.length}`, points: alive * 100 });

  const sciPts = Math.min(state.sciencePoints, 300);
  breakdown.push({ label: 'Science points', value: state.sciencePoints, points: sciPts });

  const r = state.resources;
  const rawResPts = Math.round((r.oxygen + r.water + r.food + r.power) / 4);
  const resPts = Math.min(rawResPts, 100);
  breakdown.push({ label: 'Resources remaining', value: `${rawResPts}%`, points: resPts });

  const speedPts = won ? Math.max(0, 300 - state.sol * 10) : 0;
  breakdown.push({ label: 'Speed bonus', value: `sol ${state.sol}`, points: speedPts });

  const stops = Math.max(0, state.currentLandmarkIndex);
  breakdown.push({ label: 'Landmark stops', value: stops, points: stops * 20 });

  const points = breakdown.reduce((sum, b) => sum + b.points, 0);
  return { points, breakdown, rank: rankFor(points, won) };
}
```

- [ ] **Step 4: Run tests — all six should pass**

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node --test sim/scoring.test.mjs`

Expected: `# tests 6`, `# pass 6`, `# fail 0`. If a test fails, read the assertion output, verify your arithmetic matches the comment in the test, and fix the implementation. Do NOT change the test to match a wrong implementation.

- [ ] **Step 5: Commit**

```bash
git add src/systems/scoring.js sim/scoring.test.mjs
git commit -m "$(cat <<'EOF'
Add computeScore pure function with 6 TDD tests (refs #9)

Produces {points, breakdown, rank} from end-of-run state. Six tests
cover the rank bands (S/A/B/C won, C/D/F lost) and the key edges
(perfect run → S, early wipe → F, low-score won → C floor).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `loadBestRun` + `saveBestRun` — localStorage persistence

**Files:**
- Modify: `src/systems/scoring.js` (add two functions)
- Modify: `sim/scoring.test.mjs` (add 4 tests for persistence)

The functions read/write `localStorage`, which is a browser API. For Node tests, we polyfill it before each test.

- [ ] **Step 1: Add persistence tests**

At the bottom of `sim/scoring.test.mjs`, add:

```js
// ---- Persistence tests: stub localStorage before each test ----

import { loadBestRun, saveBestRun } from '../src/systems/scoring.js';

function installLocalStorage() {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; }
  };
}

test('loadBestRun returns null when nothing is stored', () => {
  installLocalStorage();
  assert.equal(loadBestRun(), null);
});

test('loadBestRun returns null on malformed JSON (no throw)', () => {
  installLocalStorage();
  localStorage.setItem('marsTrail.bestRun', '{not json');
  assert.equal(loadBestRun(), null);
});

test('saveBestRun writes on first save', () => {
  installLocalStorage();
  const score = { points: 1200, rank: 'A' };
  const state = { sol: 24, status: 'won' };
  saveBestRun(score, state);
  const loaded = loadBestRun();
  assert.equal(loaded.points, 1200);
  assert.equal(loaded.rank, 'A');
  assert.equal(loaded.sol, 24);
  assert.equal(loaded.won, true);
  assert.match(loaded.date, /^\d{4}-\d{2}-\d{2}$/);
});

test('saveBestRun skips when new score is not higher', () => {
  installLocalStorage();
  saveBestRun({ points: 1500, rank: 'S' }, { sol: 12, status: 'won' });
  saveBestRun({ points: 1200, rank: 'A' }, { sol: 24, status: 'won' });
  const loaded = loadBestRun();
  assert.equal(loaded.points, 1500);
  assert.equal(loaded.rank, 'S');
});

test('saveBestRun overwrites when new score is higher', () => {
  installLocalStorage();
  saveBestRun({ points: 900, rank: 'B' }, { sol: 35, status: 'won' });
  saveBestRun({ points: 1400, rank: 'A' }, { sol: 20, status: 'won' });
  const loaded = loadBestRun();
  assert.equal(loaded.points, 1400);
});
```

- [ ] **Step 2: Run tests — five new ones should fail**

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node --test sim/scoring.test.mjs`

Expected: six original tests still pass; five new tests fail with `loadBestRun is not a function` / `saveBestRun is not a function`.

- [ ] **Step 3: Add the two functions to scoring.js**

Append to `src/systems/scoring.js`:

```js
// ---- Best-run persistence ----

const BEST_RUN_KEY = 'marsTrail.bestRun';

export function loadBestRun() {
  try {
    const raw = localStorage.getItem(BEST_RUN_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveBestRun(score, state) {
  const existing = loadBestRun();
  if (existing && existing.points >= score.points) return;
  const record = {
    points: score.points,
    rank:   score.rank,
    sol:    state.sol,
    won:    state.status === 'won',
    date:   new Date().toISOString().slice(0, 10)
  };
  try {
    localStorage.setItem(BEST_RUN_KEY, JSON.stringify(record));
  } catch {
    // Quota full, disabled localStorage, etc. — silently skip.
  }
}
```

- [ ] **Step 4: Run tests — all 11 should pass**

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node --test sim/scoring.test.mjs`

Expected: `# tests 11`, `# pass 11`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add src/systems/scoring.js sim/scoring.test.mjs
git commit -m "$(cat <<'EOF'
Add loadBestRun/saveBestRun localStorage persistence (refs #9)

Save-on-beat policy: only writes when new points > existing.points.
Load returns null on missing key OR malformed JSON — never throws.
Five new TDD tests covering first-save, skip-on-tie, overwrite-on-beat,
and malformed-JSON recovery.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Rank block in end-of-run modal

**Files:**
- Modify: `src/ui/modals.js` (add import, insert rank block in `showEndOfRunModal`)

- [ ] **Step 1: Read current end-of-run modal**

Run: `grep -n "showEndOfRunModal" src/ui/modals.js`

Note the line number of the function definition. Read from there to the end of the function (roughly lines 313–390).

- [ ] **Step 2: Add the import**

At the top of `src/ui/modals.js`, find the existing import block and add:

```js
import { computeScore, saveBestRun } from '../systems/scoring.js';
```

If there's already an import from `'../systems/'`, match its style.

- [ ] **Step 3: Insert the rank block in `showEndOfRunModal`**

Inside `showEndOfRunModal`, after the `const` declarations and before the `r.innerHTML = ...` assignment, add:

```js
  const score = computeScore(state);
  saveBestRun(score, state);

  const rankClass =
    score.rank === 'S' || score.rank === 'A' ? 'rank-gold'
    : score.rank === 'B' || score.rank === 'C' ? 'rank-neutral'
    : 'rank-red';

  const rankBlock = `
    <div class="eor-rank">
      <div class="eor-rank-label">MISSION RANK</div>
      <div class="eor-rank-letter ${rankClass}">${score.rank}</div>
      <div class="eor-rank-points">${score.points.toLocaleString()} points</div>
      <table class="eor-rank-breakdown">
        ${score.breakdown.map(b => `
          <tr>
            <td class="eor-rank-bd-label">${b.label}</td>
            <td class="eor-rank-bd-value">${escapeHtml(String(b.value))}</td>
            <td class="eor-rank-bd-points">${b.points}</td>
          </tr>
        `).join('')}
      </table>
    </div>
  `;
```

- [ ] **Step 4: Insert `${rankBlock}` into the innerHTML**

Find the existing template that starts `r.innerHTML = \`...` inside `showEndOfRunModal`. Locate the `<div class="eor-stats">` block. Insert `${rankBlock}` on the line ABOVE `<div class="eor-stats">` so the rank block renders above the existing sols/km/crew/science grid.

Result (schematic):

```js
  r.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-panel eor-panel ${won ? 'eor-won' : 'eor-lost'}" ...>
        ...existing severity / title / reason...

        ${rankBlock}

        <div class="eor-stats">
          ...existing stats grid...
        </div>

        ${deadBlock}
        ${factsBlock}
        ...
      </div>
    </div>
  `;
```

- [ ] **Step 5: Sanity check — tests still pass**

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node --test sim/scoring.test.mjs`

Expected: all 11 tests still pass (we only added an import and rendering — no logic change to scoring.js).

- [ ] **Step 6: Manual browser check**

Restart the dev server if not running: `python3 -m http.server 8001`
Open `http://localhost:8001/`. Start a run. Either win it (slow way) or force a quick loss by setting pace to push and ignoring events — whichever gets you to the end-of-run modal fastest.

Verify:
- Rank letter renders prominently (probably unstyled/big at this point — styling comes in Task 5).
- Points total shows, formatted with comma (e.g., "1,391 points").
- Breakdown table lists all 6 rows with correct labels and points.
- Existing stats grid (SOLS / KM / CREW / SCIENCE) still renders below.

If HTML structure is broken (e.g., everything on one line, no spacing), that's expected — it'll look bad until CSS lands in Task 5. Focus this check on "the data is correct and the HTML structure is intact."

- [ ] **Step 7: Commit**

```bash
git add src/ui/modals.js
git commit -m "$(cat <<'EOF'
Wire computeScore + saveBestRun into end-of-run modal (refs #9)

Rank block renders above the existing stats grid with a big letter,
points total, and per-factor breakdown. saveBestRun is called before
render so a new best is persisted even if the player immediately
reloads the page.

Styling in a follow-up commit — structure is usable but unstyled
at this point.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: BEST caption on the title screen

**Files:**
- Modify: `src/ui/modals.js` (find `showTitleModal` or the title-rendering function; add BEST caption)

- [ ] **Step 1: Locate the title-screen rendering**

Run: `grep -n "showTitle\|title-modal\|class=\"title" src/ui/modals.js`

Find the function that renders the title-screen modal. Read enough of it to identify the `<div>` that holds the subtitle / mission-label content.

- [ ] **Step 2: Add the `loadBestRun` import**

Update the import line from Task 3:

```js
import { computeScore, loadBestRun, saveBestRun } from '../systems/scoring.js';
```

- [ ] **Step 3: Compute the BEST caption inside the title function**

Inside the title-rendering function, before the `r.innerHTML = ...` assignment, add:

```js
  const best = loadBestRun();
  const bestCaption = best
    ? `<div class="title-best">BEST: RANK ${best.rank} · ${best.points.toLocaleString()} pts · sol ${best.sol} · ${best.won ? 'won' : 'lost'}</div>`
    : '';
```

- [ ] **Step 4: Insert `${bestCaption}` in the title template**

Find the title-modal's `innerHTML` template. Locate where the subtitle or mission-label text sits (schematically `<p class="title-subtitle">...</p>` or similar). Insert `${bestCaption}` on the line directly below the subtitle line so it renders underneath.

- [ ] **Step 5: Manual browser check**

Reload `http://localhost:8001/`.

If you haven't finished a run yet in this browser, the title screen shows no BEST caption — correct behavior.

Finish a run (from Task 3 check), then reload. Verify the BEST caption now appears under the subtitle with: rank letter, points (comma-formatted), sol number, and "won"/"lost".

Negative test: open browser devtools → Application → Local Storage → delete `marsTrail.bestRun` → reload. BEST caption should disappear.

- [ ] **Step 6: Commit**

```bash
git add src/ui/modals.js
git commit -m "$(cat <<'EOF'
Show BEST caption on title screen when a best run exists (refs #9)

Loads via loadBestRun(); omits the caption entirely when null
(no placeholder — cleaner first-run UX). Re-reads on every title
render so the player sees their new best immediately after a run.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Styling — rank block + BEST caption

**Files:**
- Modify: `styles/modals.css` (append new rules)

- [ ] **Step 1: Read existing LCARS color tokens**

Run: `grep -n "\\-\\-gold\\|\\-\\-tan\\|\\-\\-red\\|\\-\\-lcars" styles/theme-lcars.css | head -20`

Note the variable names used for gold, neutral tan, and red. You'll reuse them for the rank colors. If the project uses `--lcars-gold`, `--lcars-tan`, `--lcars-red` or similar, match the existing naming.

If no suitable tokens exist, use the actual colors defined in the LCARS palette — find them in `styles/theme-lcars.css`.

- [ ] **Step 2: Append rank-block styles to `styles/modals.css`**

At the end of the file, add (adjust var names to match what Step 1 found):

```css
/* ---- End-of-run rank block (issue #9) ---- */

.eor-rank {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin: 1rem 0 1.5rem;
  padding: 1rem 1.25rem;
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.eor-rank-label {
  font-size: 0.75rem;
  letter-spacing: 0.15em;
  color: var(--lcars-tan, #d6a970);
  opacity: 0.85;
}

.eor-rank-letter {
  font-size: 6rem;
  line-height: 1;
  font-weight: 700;
  letter-spacing: 0.05em;
  margin: 0.25rem 0;
}

.eor-rank-letter.rank-gold    { color: var(--lcars-gold, #ffaa33); text-shadow: 0 0 16px rgba(255, 170, 51, 0.35); }
.eor-rank-letter.rank-neutral { color: var(--lcars-tan,  #d6a970); }
.eor-rank-letter.rank-red     { color: var(--lcars-red,  #e26863); }

.eor-rank-points {
  font-size: 1.1rem;
  letter-spacing: 0.05em;
  color: var(--lcars-text, #e8e3d8);
}

.eor-rank-breakdown {
  margin-top: 0.75rem;
  width: 100%;
  max-width: 28rem;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.eor-rank-breakdown tr + tr td {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.eor-rank-bd-label  { padding: 0.35rem 0.5rem 0.35rem 0; text-align: left;  opacity: 0.8; }
.eor-rank-bd-value  { padding: 0.35rem 0.5rem;           text-align: left;  opacity: 0.7; font-variant-numeric: tabular-nums; }
.eor-rank-bd-points { padding: 0.35rem 0 0.35rem 0.5rem; text-align: right; font-variant-numeric: tabular-nums; color: var(--lcars-tan, #d6a970); }

/* ---- Title-screen BEST caption (issue #9) ---- */

.title-best {
  margin-top: 0.75rem;
  font-size: 0.8rem;
  letter-spacing: 0.12em;
  color: var(--lcars-tan, #d6a970);
  opacity: 0.75;
  text-align: center;
}
```

- [ ] **Step 3: Manual browser check**

Reload `http://localhost:8001/`. View a completed run end-of-run modal. Verify:
- Rank letter renders large and colored (gold for S/A, tan for B/C, red for D/F).
- Breakdown table rows align cleanly with tabular numerals.
- Title screen BEST caption is small, understated, and centered.

If the rank letter color looks wrong (e.g., no gold tint for an A-rank), the CSS var names don't match the project's tokens. Open devtools, inspect `.eor-rank-letter`, find the computed color, and map the var name correctly.

- [ ] **Step 4: Commit**

```bash
git add styles/modals.css
git commit -m "$(cat <<'EOF'
Style rank block + title-screen BEST caption (refs #9)

Big letter with LCARS gold/tan/red by rank tier. Breakdown table uses
tabular numerals. Title BEST caption sits small and understated under
the subtitle.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: PR → merge → tag v0.3.0 → release

**Files:** none modified — publishing only.

- [ ] **Step 1: Final test + sim sanity**

Run:
```bash
cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail"
node --test sim/scoring.test.mjs
node sim/play.mjs
```

Expected: 11/11 tests pass. Sim still prints a 12-row table with pace-balance numbers in their bands (verifies we didn't break travel/events).

- [ ] **Step 2: Push the branch**

Run: `git push -u origin feat/scoring`

- [ ] **Step 3: Open the PR**

```bash
gh pr create --base main --head feat/scoring --title "End-of-run scoring + ranking (v0.3.0)" --body "$(cat <<'EOF'
## Summary

- New rank system: every completed run gets S/A/B/C/D/F based on a weighted point score (~0–1740 ceiling).
- End-of-run modal shows the rank letter, point total, and a 6-row breakdown above the existing stats grid.
- Best run persists to localStorage; title screen shows \`BEST: RANK A · 1,483 pts · sol 24 · won\` when a record exists.
- Closes #9.

## What changed

- New pure module \`src/systems/scoring.js\` (computeScore / loadBestRun / saveBestRun).
- New tests at \`sim/scoring.test.mjs\` — 11 cases via \`node --test\`.
- \`src/ui/modals.js\` — rank block in end-of-run modal; BEST caption on title screen.
- \`styles/modals.css\` — rank letter tinted by tier (LCARS gold/tan/red); BEST caption styling.

Game-state systems (travel/events/state) untouched.

## Out of scope (C-scope per spec)

Animated breakdown reveal, new-best celebratory flourish, sim-harness rank distribution output. Deferred to a later issue if desired.

## Test plan

- [ ] \`node --test sim/scoring.test.mjs\` — 11/11 pass
- [ ] \`node sim/play.mjs\` — sim still prints balanced 12-row table
- [ ] Play a won run — verify rank block with correct breakdown
- [ ] Play a lost run — verify rank block + IN MEMORIAM + rank color (red for F)
- [ ] Reload title screen — verify BEST caption appears under subtitle
- [ ] Clear \`marsTrail.bestRun\` in devtools → reload title — caption disappears

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: User review + merge**

Pause here for user to test locally and merge the PR via `gh pr merge <N> --rebase --delete-branch` when satisfied. If user requests changes, address them in new commits on `feat/scoring`.

- [ ] **Step 5: After merge — sync local main + tag v0.3.0**

```bash
cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail"
git checkout main
git fetch --prune
git reset --hard origin/main
git tag -a v0.3.0 -m "v0.3.0 — End-of-run scoring and ranking

Every completed run now gets a letter rank (S/A/B/C/D/F), a point
score with breakdown, and a persisted best-run shown on the title
screen. Closes #9."
git push origin v0.3.0
```

- [ ] **Step 6: Create GitHub Release**

```bash
gh release create v0.3.0 --title "v0.3.0 — End-of-Run Ranking" --notes "$(cat <<'EOF'
## Mission rankings

Every completed run now earns a letter rank: **S / A / B / C / D / F**.

Score is the sum of six weighted factors — outcome, crew survived, science, resources remaining, speed, and landmark stops. Won runs top out near 1,740 points (S requires 1,500+); lost runs cap at C regardless of points, with D/F below that.

## Best-run tracking

Your highest-scoring run persists in \`localStorage\` and shows on the title screen as a caption:

\`BEST: RANK A · 1,483 pts · sol 24 · won\`

Beats-only saves — a lower-score run never overwrites your best.

## Closed issue

- #9 — End-of-run scoring and mission ranking (S/A/B/C/D)
EOF
)"
```

- [ ] **Step 7: Verify**

Run:
```bash
gh release view v0.3.0
gh issue view 9
```

Expected: release page renders; issue #9 shows status `CLOSED`.

---

## Self-Review (already completed)

**Spec coverage:**
- §Architecture (scoring.js module) → Tasks 1 + 2 ✓
- §Scoring formula → Task 1 Step 3 (implementation matches spec) ✓
- §Rank thresholds → Task 1 Step 3 (`rankFor` matches spec table) ✓
- §End-of-run modal rank block → Task 3 ✓
- §Best-run persistence → Task 2 ✓
- §Title-screen BEST readout → Task 4 ✓
- §Validation (manual browser) → Tasks 3 Step 6, 4 Step 5, 5 Step 3 ✓
- §Sequencing (tag v0.3.0, release) → Task 6 ✓

**Placeholder scan:** No TBDs, TODOs, or vague directives. Every code step has complete code. Every command has expected output.

**Type consistency:** `computeScore` signature matches across tasks. Breakdown row shape `{label, value, points}` used consistently. `saveBestRun(score, state)` parameter order consistent. Test file import path `'../src/systems/scoring.js'` consistent.

**Ambiguities:** Task 4 Step 1 uses `grep` to find the title-rendering function rather than hardcoding a line number, because the structure may vary. Task 5 Step 1 does the same for CSS var names. Both are intentional — they're exploration steps with a clear success condition.
