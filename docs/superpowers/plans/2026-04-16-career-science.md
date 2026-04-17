# Career Science Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist cumulative `sciencePoints` across runs as career SCI; unlock five tiered efficiency bonuses that modify the same game (no new content, no new physical equipment).

**Architecture:** One new pure module (`src/systems/career.js`) handles localStorage persistence, tier lookup, and bonus computation. `state.careerBonuses` (a flat object) is stamped onto state at `createInitialState`. Game systems read bonuses at use-time via defensive `state.careerBonuses?.foo || fallback`.

**Tech Stack:** Vanilla ES modules. `node --test` for unit tests. No new dependencies.

**Related:** Spec at `docs/superpowers/specs/2026-04-16-career-science-design.md`. Closes #13 (Part 2 of #7). Ships as `v0.5.0`. Unblocks #8.

---

## File Structure

**Create:**
- `src/systems/career.js` — career module (~80 lines).
- `sim/career.test.mjs` — Node unit tests (~150 lines).

**Modify:**
- `src/state.js` — `createInitialState` loads career, computes bonuses, optionally rolls an event preview.
- `src/systems/travel.js` — reads `careerBonuses.kmMult` and `careerBonuses.lifeSupportMult`.
- `src/systems/events.js` — reads `careerBonuses.skillBonus` in the skill-check branch with a 95% cap.
- `src/ui/modals.js` — title caption, loadout sidebar, end-of-run line (with persist call), briefing preview, waypoint-offer signature change.
- `src/main.js` — pass `state` into `showWaypointOfferModal`.
- `styles/components.css` — title caption + loadout active-bonuses block.
- `package.json` — bump to `0.5.0` in the final commit.

**Untouched:** scoring module, waypoints module, sim harness, game-state flow beyond the files above.

---

## Task 1: Career module + tests

**Files:**
- Create: `src/systems/career.js`
- Create: `sim/career.test.mjs`

TDD: tests first, fail, implement, pass, commit.

- [ ] **Step 1: Write the test file**

Create `sim/career.test.mjs`:

```js
// Tests for src/systems/career.js. Run: node --test sim/career.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAREER_TIERS,
  loadCareerScience,
  addCareerScience,
  computeActiveBonuses,
  nextTier,
  currentTier
} from '../src/systems/career.js';

function installLocalStorage() {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; }
  };
}

// --- CAREER_TIERS shape ---

test('CAREER_TIERS has exactly 6 entries (rookie + 5 unlocks)', () => {
  assert.equal(CAREER_TIERS.length, 6);
  assert.equal(CAREER_TIERS[0].id, 'rookie');
  assert.equal(CAREER_TIERS[0].minSci, 0);
});

test('CAREER_TIERS is ordered by ascending minSci', () => {
  for (let i = 1; i < CAREER_TIERS.length; i++) {
    assert.ok(CAREER_TIERS[i].minSci > CAREER_TIERS[i - 1].minSci);
  }
});

test('CAREER_TIERS thresholds match spec (0, 30, 100, 225, 400, 700)', () => {
  assert.deepEqual(
    CAREER_TIERS.map(t => t.minSci),
    [0, 30, 100, 225, 400, 700]
  );
});

// --- loadCareerScience ---

test('loadCareerScience returns 0 when nothing is stored', () => {
  installLocalStorage();
  assert.equal(loadCareerScience(), 0);
});

test('loadCareerScience returns the stored integer', () => {
  installLocalStorage();
  localStorage.setItem('marsTrail.careerScience', '437');
  assert.equal(loadCareerScience(), 437);
});

test('loadCareerScience returns 0 on malformed data (no throw)', () => {
  installLocalStorage();
  localStorage.setItem('marsTrail.careerScience', 'not-a-number');
  assert.equal(loadCareerScience(), 0);
});

// --- addCareerScience ---

test('addCareerScience credits full SCI on a won run', () => {
  installLocalStorage();
  const runState = { status: 'won', sciencePoints: 150 };
  const { credit, total } = addCareerScience(runState);
  assert.equal(credit, 150);
  assert.equal(total, 150);
  assert.equal(loadCareerScience(), 150);
});

test('addCareerScience credits 20-60% on a lost run (bounded range)', () => {
  installLocalStorage();
  const runState = { status: 'lost', sciencePoints: 200 };
  // Run many times to verify the range.
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < 100; i++) {
    installLocalStorage();
    const { credit } = addCareerScience(runState);
    if (credit < min) min = credit;
    if (credit > max) max = credit;
  }
  // With 200 SCI, range should be [40, 120]. Allow some floor() slack.
  assert.ok(min >= 40, `min credit ${min} should be >= 40`);
  assert.ok(max <= 120, `max credit ${max} should be <= 120`);
});

test('addCareerScience credits 0 when sciencePoints is 0', () => {
  installLocalStorage();
  for (const status of ['won', 'lost']) {
    installLocalStorage();
    const { credit, total } = addCareerScience({ status, sciencePoints: 0 });
    assert.equal(credit, 0);
    assert.equal(total, 0);
  }
});

test('addCareerScience accumulates on repeated calls', () => {
  installLocalStorage();
  addCareerScience({ status: 'won', sciencePoints: 100 });
  addCareerScience({ status: 'won', sciencePoints: 50 });
  assert.equal(loadCareerScience(), 150);
});

// --- computeActiveBonuses ---

test('computeActiveBonuses returns empty at 0 SCI', () => {
  assert.deepEqual(computeActiveBonuses(0), {});
});

test('computeActiveBonuses merges earned tiers additively', () => {
  // 225 SCI earns tiers at 0, 30, 100, 225 — so calibration + navigation + methodology.
  const bonuses = computeActiveBonuses(225);
  assert.equal(bonuses.exactWaypointReward, true);
  assert.equal(bonuses.kmMult, 1.05);
  assert.equal(bonuses.skillBonus, 0.10);
  assert.ok(!('lifeSupportMult' in bonuses));
  assert.ok(!('eventPreview' in bonuses));
});

test('computeActiveBonuses at max SCI includes all effects', () => {
  const bonuses = computeActiveBonuses(9999);
  assert.equal(bonuses.exactWaypointReward, true);
  assert.equal(bonuses.kmMult, 1.05);
  assert.equal(bonuses.skillBonus, 0.10);
  assert.equal(bonuses.lifeSupportMult, 0.90);
  assert.equal(bonuses.eventPreview, true);
});

// --- nextTier ---

test('nextTier returns the first unearned tier', () => {
  const t = nextTier(50);  // earned 0 + 30; next is 100
  assert.equal(t.minSci, 100);
  assert.equal(t.id, 'navigation');
});

test('nextTier at max returns null', () => {
  assert.equal(nextTier(9999), null);
});

test('nextTier at 0 returns calibration (first unlock)', () => {
  const t = nextTier(0);
  assert.equal(t.id, 'calibration');
});

// --- currentTier ---

test('currentTier returns rookie at 0', () => {
  assert.equal(currentTier(0).id, 'rookie');
});

test('currentTier returns the highest earned tier', () => {
  assert.equal(currentTier(50).id, 'calibration');   // 30 earned, 100 not yet
  assert.equal(currentTier(100).id, 'navigation');
  assert.equal(currentTier(9999).id, 'intel_synthesis');
});
```

- [ ] **Step 2: Run tests — should fail on import**

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node --test sim/career.test.mjs`

Expected: all tests fail with `Cannot find module '../src/systems/career.js'`.

- [ ] **Step 3: Create `src/systems/career.js`**

```js
// Mars Trail — cross-run career science progression (issue #13).
// Pure module. localStorage reads/writes isolated here; game systems
// consume the flat `bonuses` object via defensive reads.

const CAREER_KEY = 'marsTrail.careerScience';

export const CAREER_TIERS = [
  { minSci:   0, id: 'rookie',          name: 'Rookie',
    description: 'No bonuses yet.',
    effect: {} },
  { minSci:  30, id: 'calibration',     name: 'Calibration Data Analysis',
    description: 'Waypoint offers show exact reward estimates.',
    effect: { exactWaypointReward: true } },
  { minSci: 100, id: 'navigation',      name: 'Navigation Pattern Analysis',
    description: 'Rover base km/sol +5% at every pace.',
    effect: { kmMult: 1.05 } },
  { minSci: 225, id: 'methodology',     name: 'Field Methodology Training',
    description: 'Skill-check success +10 percentage points across all events.',
    effect: { skillBonus: 0.10 } },
  { minSci: 400, id: 'life_support',    name: 'Life-Support Optimization',
    description: 'O₂ and H₂O consumption −10% at every pace.',
    effect: { lifeSupportMult: 0.90 } },
  { minSci: 700, id: 'intel_synthesis', name: 'Mission Intel Synthesis',
    description: 'One upcoming event previewed on the briefing screen each run.',
    effect: { eventPreview: true } }
];

// ---- Persistence ----

export function loadCareerScience() {
  try {
    const raw = localStorage.getItem(CAREER_KEY);
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function addCareerScience(runState) {
  const earned = runState.sciencePoints || 0;
  let credit;
  if (runState.status === 'won') {
    credit = earned;
  } else {
    // Lost: random 20–60% of earned, floored. Zero in = zero out.
    const frac = 0.2 + Math.random() * 0.4;
    credit = Math.floor(earned * frac);
  }
  const current = loadCareerScience();
  const total = current + credit;
  try {
    localStorage.setItem(CAREER_KEY, String(total));
  } catch { /* quota/disabled — silent */ }
  return { credit, total };
}

// ---- Tier computation ----

export function computeActiveBonuses(careerSci) {
  const bonuses = {};
  for (const tier of CAREER_TIERS) {
    if (careerSci >= tier.minSci) Object.assign(bonuses, tier.effect);
  }
  return bonuses;
}

export function nextTier(careerSci) {
  return CAREER_TIERS.find(t => t.minSci > careerSci) || null;
}

export function currentTier(careerSci) {
  let earned = CAREER_TIERS[0];
  for (const tier of CAREER_TIERS) {
    if (careerSci >= tier.minSci) earned = tier;
  }
  return earned;
}
```

- [ ] **Step 4: Run tests — all pass**

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node --test sim/career.test.mjs`

Expected: `# tests 17`, `# pass 17`, `# fail 0`.

- [ ] **Step 5: Confirm other suites still pass**

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node --test sim/*.test.mjs 2>&1 | tail -5`

Expected: all tests across scoring/waypoints/career pass. Total depends on prior tasks (19 pre-career + 17 career = 36).

- [ ] **Step 6: Commit**

```bash
git add src/systems/career.js sim/career.test.mjs
git commit -m "$(cat <<'EOF'
Add career-science module with 17 TDD tests (refs #13)

Pure module. CAREER_TIERS table (rookie + 5 unlocks: calibration,
navigation, methodology, life-support, intel). loadCareerScience /
addCareerScience / computeActiveBonuses / nextTier / currentTier
covered by tests including won/lost accrual, range bounds, malformed-
storage recovery, and tier boundary edges.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: State integration + systems wiring

**Files:**
- Modify: `src/state.js`
- Modify: `src/systems/travel.js`
- Modify: `src/systems/events.js`

Career bonuses applied at three use-sites. No UI yet.

- [ ] **Step 1: Read current state.js structure**

Run: `grep -n "createInitialState\|rollWaypoints\|activeModal" src/state.js`

You need to know where the function's `return` is and which fields it currently sets. The existing file calls `rollWaypoints(baseState)` at the end — career integration sits just before that.

- [ ] **Step 2: Modify `src/state.js`**

Add two imports near the top (below existing imports):

```js
import { loadCareerScience, computeActiveBonuses } from './systems/career.js';
import { EVENTS } from './content/events.js';
```

Inside `createInitialState`, find the `return rollWaypoints(baseState);` line (or the equivalent). Just BEFORE the `const baseState = { ... }` construction, add:

```js
  const careerSci = loadCareerScience();
  const careerBonuses = computeActiveBonuses(careerSci);

  // If tier 5 is active, sample one non-one-shot event for briefing preview.
  let eventPreview = null;
  if (careerBonuses.eventPreview) {
    const pool = EVENTS.filter(e => !e.oneShot);
    if (pool.length) {
      eventPreview = pool[Math.floor(Math.random() * pool.length)];
    }
  }
```

Inside the `baseState` object literal, add these three fields (alongside existing fields like `sciencePoints`, `factsLearned`, etc.):

```js
    careerSci,
    careerBonuses,
    eventPreview,
```

- [ ] **Step 3: Modify `src/systems/travel.js` — kmMult**

Find the travel-distance calculation in `advanceSol`:

```js
    const km         = Math.max(0, baseKm * pilotMult * weightMult * (1 + jitter));
```

Replace with:

```js
    const kmMult     = state.careerBonuses?.kmMult || 1;
    const km         = Math.max(0, baseKm * pilotMult * weightMult * kmMult * (1 + jitter));
```

- [ ] **Step 4: Modify `src/systems/travel.js` — lifeSupportMult**

Find the resource-consumption block:

```js
  const lifeSupportMult = LIFE_SUPPORT_MULT_BY_PACE[s.pace];
```

Replace with:

```js
  const careerLifeMult  = state.careerBonuses?.lifeSupportMult || 1;
  const lifeSupportMult = LIFE_SUPPORT_MULT_BY_PACE[s.pace] * careerLifeMult;
```

- [ ] **Step 5: Modify `src/systems/events.js` — skillBonus**

Find the skill-check branch inside `applyEventChoice`:

```js
  if (choice.skillCheck) {
    const { role, successP } = choice.skillCheck;
    const specialistAlive = state.crew.some(c => c.role === role && c.alive);
    const effectiveP = specialistAlive ? successP : Math.max(0.2, successP - 0.4);
    const success = Math.random() < effectiveP;
```

Replace with:

```js
  if (choice.skillCheck) {
    const { role, successP } = choice.skillCheck;
    const specialistAlive = state.crew.some(c => c.role === role && c.alive);
    const baseP = specialistAlive ? successP : Math.max(0.2, successP - 0.4);
    const bonus = state.careerBonuses?.skillBonus || 0;
    const effectiveP = Math.min(0.95, baseP + bonus);
    const success = Math.random() < effectiveP;
```

- [ ] **Step 6: Verify tests + sim**

Run:
```bash
cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail"
node --test sim/*.test.mjs 2>&1 | tail -3
node sim/play.mjs 2>&1 | tail -13
```

Expected: all tests pass. Sim's pace bands are within ~2pp of their v0.4.0 values — the sim never sets up career SCI, so `state.careerBonuses` stays `{}` and all fallbacks (`|| 1`, `|| 0`) preserve pre-career behavior.

If pace bands drifted by more than ~3pp, the career integration leaked into a no-career run. Recheck the `|| 1` / `|| 0` fallback operators.

- [ ] **Step 7: Commit**

```bash
git add src/state.js src/systems/travel.js src/systems/events.js
git commit -m "$(cat <<'EOF'
Wire career bonuses into state, travel, and events (refs #13)

createInitialState now loads career SCI, computes active bonuses,
and optionally samples an event for tier-5 briefing preview. Travel
reads kmMult (speed bump) and lifeSupportMult (O₂/H₂O reduction).
Events clamp skill-check success to 95% after adding skillBonus.

All reads use defensive fallbacks (|| 1, || 0), so runs without
career SCI behave identically to v0.4.0 — sim confirms pace bands
unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: UI surfaces + waypoint modal signature + styling

**Files:**
- Modify: `src/ui/modals.js`
- Modify: `src/main.js`
- Modify: `styles/components.css`

All five display surfaces plus the modal signature change.

- [ ] **Step 1: Add career module import to `src/ui/modals.js`**

Near the top of `src/ui/modals.js`, add:

```js
import { CAREER_TIERS, currentTier, nextTier, addCareerScience } from '../systems/career.js';
```

- [ ] **Step 2: Update title screen caption in `showTitleLayer`**

Find the existing `bestCaption` computation in `src/ui/modals.js::showTitleLayer`:

```js
  const best = loadBestRun();
  const bestCaption = best
    ? `<div class="title-best">BEST: RANK ${best.rank} · ${best.points.toLocaleString()} pts · sol ${best.sol} · ${best.won ? 'won' : 'lost'}</div>`
    : '';
```

Directly BELOW that, add:

```js
  const careerSci = loadCareerScience();
  const cur = currentTier(careerSci);
  const next = nextTier(careerSci);
  const careerLine1 = `<div class="title-career">CAREER: ${careerSci.toLocaleString()} SCI · TIER ${CAREER_TIERS.indexOf(cur)} · ${escapeHtml(cur.name.toUpperCase())}</div>`;
  const careerLine2 = next
    ? `<div class="title-career-next">NEXT: ${next.minSci.toLocaleString()} SCI — ${escapeHtml(next.name)} (−${(next.minSci - careerSci).toLocaleString()})</div>`
    : '';
  const careerCaption = careerLine1 + careerLine2;
```

Also at the top of the file, import `loadCareerScience` if not already imported. Extend the earlier import:

```js
import { CAREER_TIERS, currentTier, nextTier, addCareerScience, loadCareerScience } from '../systems/career.js';
```

Find the title template (innerHTML assignment) and add `${careerCaption}` directly after `${bestCaption}`. Example:

```js
    <h1 class="title-heading">MARS TRAIL</h1>
    <p class="title-tagline">The colony is waiting. Earth cannot help you from here.</p>
    ${bestCaption}
    ${careerCaption}
    <button class="title-start" ...
```

- [ ] **Step 3: Add active-bonuses block to loadout screen**

Find `showLoadoutModal` in `src/ui/modals.js`. Locate where it renders the sidebar/stats area.

Inside the function, before the `r.innerHTML = ...` template, add:

```js
  const loadoutCareerSci = loadCareerScience();
  const nonRookieTiers = CAREER_TIERS.filter(t => t.id !== 'rookie');
  const earnedTiers = nonRookieTiers.filter(t => loadoutCareerSci >= t.minSci);
  const nextLocked = nonRookieTiers.find(t => loadoutCareerSci < t.minSci);

  const activeBonusesBlock = (earnedTiers.length === 0 && !nextLocked)
    ? ''
    : `
      <div class="loadout-bonuses">
        <div class="loadout-bonuses-title">ACTIVE BONUSES</div>
        ${earnedTiers.map(t => `
          <div class="loadout-bonus earned">
            <span class="loadout-bonus-check">✓</span>
            <span class="loadout-bonus-name">${escapeHtml(t.name)}</span>
            <span class="loadout-bonus-desc">${escapeHtml(t.description)}</span>
          </div>
        `).join('')}
        ${nextLocked ? `
          <div class="loadout-bonus locked">
            <span class="loadout-bonus-check">□</span>
            <span class="loadout-bonus-name">${escapeHtml(nextLocked.name)}</span>
            <span class="loadout-bonus-desc">Locked — need ${nextLocked.minSci.toLocaleString()} SCI</span>
          </div>` : ''}
      </div>
    `;
```

Insert `${activeBonusesBlock}` into the loadout modal's innerHTML template, near the stats/sidebar block (below the existing CARGO/ROLES/RATIONS content). Ask for clarification if the existing loadout template structure isn't obvious — otherwise pick a sensible location and note it in your report.

- [ ] **Step 4: Wire career credit into `showEndOfRunModal`**

Find `showEndOfRunModal` in `src/ui/modals.js`. Near the top of the function, AFTER the existing `const score = computeScore(state); saveBestRun(score, state);` block (or equivalent — just after the scoring code, before `r.innerHTML`), add:

```js
  // Persist career SCI — credits full on win, random 20-60% on loss.
  const careerResult = addCareerScience(state);
  let careerCreditLine;
  if (state.sciencePoints === 0) {
    careerCreditLine = `<div class="eor-career">No career credit this mission. Career total ${careerResult.total.toLocaleString()}.</div>`;
  } else if (state.status === 'won') {
    careerCreditLine = `<div class="eor-career">+${careerResult.credit.toLocaleString()} SCI earned this mission → career total ${careerResult.total.toLocaleString()}.</div>`;
  } else {
    careerCreditLine = `<div class="eor-career">Lost run: +${careerResult.credit.toLocaleString()} SCI credited (random 20–60% of earned) → career total ${careerResult.total.toLocaleString()}.</div>`;
  }
```

In the innerHTML template, insert `${careerCreditLine}` between the rank block and the `<div class="eor-stats">` grid. Example schematic:

```js
    ${rankBlock}
    ${careerCreditLine}
    <div class="eor-stats">
```

- [ ] **Step 5: Briefing preview (tier 5)**

Find `showBriefingModal` in `src/ui/modals.js`. It currently renders a mission briefing with no dynamic content.

If the function signature does NOT already accept state, you need to change the caller in `src/main.js`. Check:

```bash
grep -n "showBriefingModal" src/main.js src/ui/modals.js
```

If `showBriefingModal` is called like `showBriefingModal(onBegin)`, change the caller in `src/main.js` to `showBriefingModal(state, onBegin)` and update the function signature accordingly.

Inside `showBriefingModal`, add:

```js
  const previewLine = state?.eventPreview && state.careerBonuses?.eventPreview
    ? `<p class="briefing-intel"><em>ORBITAL ANALYSIS FLAGS: ${escapeHtml(state.eventPreview.modal.title)} likely in the coming sols.</em></p>`
    : '';
```

In the briefing template, insert `${previewLine}` at a natural place (below the main briefing paragraph, above the BEGIN LOADOUT button). Ask if unclear.

- [ ] **Step 6: Change `showWaypointOfferModal` signature**

Find `showWaypointOfferModal` in `src/ui/modals.js`:

```js
export function showWaypointOfferModal(waypoint, { onAccept, onDecline }) {
```

Change to:

```js
export function showWaypointOfferModal(waypoint, state, { onAccept, onDecline }) {
```

Inside the function, find the reward-text line in the template (or wherever `~${waypoint.sciencePoints} SCI` appears). Change it to:

```js
  const showExact = state?.careerBonuses?.exactWaypointReward;
  const rewardText = showExact
    ? `${waypoint.sciencePoints} SCI + advanced data`
    : `~${waypoint.sciencePoints} SCI + advanced data`;
```

Use `${rewardText}` where the old hardcoded text was.

- [ ] **Step 7: Update the waypoint-offer caller in `src/main.js`**

In `src/main.js`, find the waypoint_offer dispatch:

```js
    showWaypointOfferModal(waypoint, {
      onAccept: () => { ... },
      onDecline: () => { ... }
    });
```

Change to:

```js
    showWaypointOfferModal(waypoint, state, {
      onAccept: () => { ... },
      onDecline: () => { ... }
    });
```

- [ ] **Step 8: Style the new UI bits in `styles/components.css`**

At the end of `styles/components.css`, append:

```css
/* ---- Career-SCI title caption (issue #13) ---- */

.title-career {
  margin-top: 0.35rem;
  font-size: 0.8rem;
  letter-spacing: 0.12em;
  color: var(--fg-dim, #cc99cc);
  opacity: 0.8;
  text-align: center;
}

.title-career-next {
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  color: var(--fg-dim, #cc99cc);
  opacity: 0.55;
  text-align: center;
  margin-top: 0.15rem;
}

/* ---- Loadout active-bonuses block (issue #13) ---- */

.loadout-bonuses {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 0.35rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.loadout-bonuses-title {
  font-size: 0.72rem;
  letter-spacing: 0.15em;
  color: var(--fg-dim, #cc99cc);
  opacity: 0.85;
  margin-bottom: 0.5rem;
}

.loadout-bonus {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.35rem 0.5rem;
  padding: 0.3rem 0;
  font-size: 0.8rem;
}

.loadout-bonus + .loadout-bonus {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.loadout-bonus-check {
  grid-row: span 2;
  align-self: center;
  font-size: 1.1rem;
}

.loadout-bonus.earned .loadout-bonus-check {
  color: var(--warn, #ffcc00);
}

.loadout-bonus.locked {
  opacity: 0.5;
}

.loadout-bonus-name {
  color: var(--fg, #ff9900);
}

.loadout-bonus-desc {
  grid-column: 2;
  font-size: 0.72rem;
  opacity: 0.7;
}

/* ---- End-of-run career credit line (issue #13) ---- */

.eor-career {
  margin: 0.75rem 0 1rem;
  font-size: 0.9rem;
  text-align: center;
  color: var(--fg-dim, #cc99cc);
  letter-spacing: 0.05em;
}

/* ---- Briefing tier-5 intel line (issue #13) ---- */

.briefing-intel {
  margin-top: 0.75rem;
  font-size: 0.85rem;
  color: var(--fg-dim, #cc99cc);
  opacity: 0.85;
}
```

- [ ] **Step 9: Bump package.json version**

Change `"version": "0.4.0"` to `"version": "0.5.0"`.

- [ ] **Step 10: Verify everything**

```bash
cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail"
node --check src/ui/modals.js
node --check src/main.js
node --test sim/*.test.mjs 2>&1 | tail -3
node sim/play.mjs 2>&1 | tail -13
```

Expected: syntax OK, tests pass, sim bands hold.

- [ ] **Step 11: Commit**

```bash
git add src/ui/modals.js src/main.js styles/components.css package.json
git commit -m "$(cat <<'EOF'
Add career UI surfaces + waypoint signature change (refs #13)

Title caption shows career SCI + current tier + next-unlock teaser.
Loadout sidebar lists earned tiers with a preview of the next
locked tier. End-of-run modal credits career SCI (full on win,
random 20–60% on loss) and shows the running total. Briefing adds
a tier-5 orbital-intel preview line when available. Waypoint-offer
modal shows exact vs. ~ rewards based on tier 1.

Bumps package.json to 0.5.0.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: PR → merge → tag v0.5.0 → release

**Files:** none modified.

- [ ] **Step 1: Final sanity**

```bash
cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail"
node --test sim/*.test.mjs 2>&1 | tail -3
node sim/play.mjs 2>&1 | tail -13
```

Expected: all tests pass, pace bands within ~2pp of v0.4.0.

- [ ] **Step 2: Push the branch**

```bash
git push -u origin feat/career-science
```

- [ ] **Step 3: Open the PR**

```bash
gh pr create --base main --head feat/career-science --title "Career science progression (v0.5.0)" --body "$(cat <<'EOF'
## Summary

- Total \`sciencePoints\` across runs persists to \`localStorage\` as career SCI.
- Five tiered efficiency unlocks (30 / 100 / 225 / 400 / 700 SCI). Every unlock is digital/behavioral: instrument calibration, navigation analysis, methodology training, life-support research, mission intel. No new physical equipment or content.
- Won runs credit full earned SCI. Lost runs credit a random 20–60% of earned (rewards effort, keeps surprise).
- Title shows career + current tier + next-unlock teaser. Loadout lists active bonuses. End-of-run shows the mission's career credit and running total.
- Closes #13. Unblocks #8.

## Tier table

| Career SCI | Unlock | Effect |
|---|---|---|
| 30 | Calibration Data Analysis | Waypoint offers show exact reward |
| 100 | Navigation Pattern Analysis | Rover km/sol +5% at every pace |
| 225 | Field Methodology Training | Skill-check success +10pp (capped at 95%) |
| 400 | Life-Support Optimization | O₂/H₂O consumption −10% |
| 700 | Mission Intel Synthesis | Briefing previews one upcoming event |

## What changed

- **New:** \`src/systems/career.js\` (pure module). \`sim/career.test.mjs\` (17 tests).
- **Modified:** \`src/state.js\` (loads career at init), \`src/systems/travel.js\` (kmMult + lifeSupportMult reads), \`src/systems/events.js\` (skillBonus + 95% cap), \`src/ui/modals.js\` (title/loadout/end-of-run/briefing/waypoint-offer), \`src/main.js\` (waypoint-offer signature), \`styles/components.css\` (new display rules), \`package.json\` (0.5.0).

## Test plan

- [x] \`node --test sim/*.test.mjs\` — all pass.
- [x] \`node sim/play.mjs\` — pace bands hold (sim doesn't persist career, so fresh runs stay at career 0 → no bonuses → identical numbers).
- [ ] Browser: title shows \`v0.5.0 · 2026\`.
- [ ] Browser: on a fresh profile, title caption shows \`CAREER: 0 SCI · TIER 0 · ROOKIE · NEXT: 30 SCI — Calibration Data Analysis\`.
- [ ] Browser: complete a run with any SCI earned → end-of-run shows credit line → reload title shows updated total.
- [ ] Devtools set \`marsTrail.careerScience\` to \`400\` → reload → title shows Tier 4, loadout shows 4 ✓ + 1 □, waypoint-offer shows exact SCI (no ~).
- [ ] Devtools set to \`700\` → briefing screen shows the orbital intel preview line.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Pause for user test + merge**

Hand back to the user. Standard flow: `gh pr merge <N> --rebase --delete-branch` when satisfied.

- [ ] **Step 5: Post-merge — sync, tag, release, close issue, unblock #8**

```bash
cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail"
git checkout main
git fetch --prune
git reset --hard origin/main
git branch -D feat/career-science 2>/dev/null

git tag -a v0.5.0 -m "v0.5.0 — Career science progression

Cross-run science persistence with five tiered efficiency unlocks.
Closes #13; unblocks #8."
git push origin v0.5.0

gh release create v0.5.0 --title "v0.5.0 — Career Science Progression" --notes "$(cat <<'EOF'
## Your mission log carries forward

Every completed run now credits science points to a persistent career total. Career SCI unlocks five efficiency bonuses — each a digital or behavioral improvement derived from accumulated research, never new physical equipment:

| Career SCI | Unlock |
|---|---|
| 30 | Calibration Data Analysis — waypoint offers show exact reward |
| 100 | Navigation Pattern Analysis — rover km/sol +5% |
| 225 | Field Methodology Training — skill checks +10 pp |
| 400 | Life-Support Optimization — O₂/H₂O −10% |
| 700 | Mission Intel Synthesis — briefing previews an upcoming event |

Won runs credit the full science they earned. Lost runs credit a random 20–60% — rewarding effort, keeping surprise.

## Where it shows

- **Title screen:** current career, current tier, and the next unlock teaser.
- **Loadout:** active bonuses listed with ✓, next locked tier shown with threshold.
- **End-of-run modal:** the mission's credit and updated career total.
- **Waypoint offer (tier 1):** exact reward instead of \`~50 SCI\`.
- **Briefing (tier 5):** orbital analysis preview of an upcoming event.

## Closed

- #13 — Career science progression (Part 2 of #7).
EOF
)"

gh issue comment 8 --body "Unblocked by v0.5.0 (#13 closed). Career SCI is now the experience metric this issue needs; \`state.careerSci\` is available during \`createInitialState\`."
```

- [ ] **Step 6: Verify**

```bash
gh release view v0.5.0
gh issue view 13
gh issue view 8
```

Expected: release renders; #13 closed; #8 has the new unblocking comment.

---

## Self-Review (run before dispatching subagents)

**Spec coverage:**
- §Architecture (career.js module, state field) → Task 1 + Task 2 Step 2 ✓
- §Tier table → Task 1 Step 3 ✓
- §Persistence + accrual (won/lost) → Task 1 Step 3 (implementation) + Step 1 (tests) ✓
- §Bonus-application: kmMult → Task 2 Step 3 ✓
- §Bonus-application: lifeSupportMult → Task 2 Step 4 ✓
- §Bonus-application: skillBonus + 95% cap → Task 2 Step 5 ✓
- §Bonus-application: exactWaypointReward → Task 3 Steps 6–7 ✓
- §Bonus-application: eventPreview → Task 2 Step 2 (state init) + Task 3 Step 5 (briefing render) ✓
- §UI title → Task 3 Step 2 ✓
- §UI loadout → Task 3 Step 3 ✓
- §UI end-of-run + persist → Task 3 Step 4 ✓
- §UI briefing → Task 3 Step 5 ✓
- §UI waypoint → Task 3 Step 6 ✓
- §Validation (tests + sim) → Task 2 Step 6, Task 4 Step 1 ✓

**Placeholder scan:** A few "Ask if unclear" escape hatches (Task 3 Steps 3 and 5 — loadout sidebar location and briefing template location). Those are existing-code exploration steps; implementer asks if the file's current structure doesn't match the plan. No vague directives elsewhere.

**Type consistency:**
- `state.careerBonuses` shape: `{ exactWaypointReward?, kmMult?, skillBonus?, lifeSupportMult?, eventPreview? }`. Used consistently across Tasks 2 and 3.
- `addCareerScience` returns `{ credit, total }`. Used in Task 3 Step 4.
- `CAREER_TIERS` entries have `{ minSci, id, name, description, effect }`. Used in Task 1 + Task 3 Steps 2, 3.
- `loadCareerScience()` returns a number; tests + title caption + loadout all consume integer. ✓
- `nextTier(careerSci)` returns tier object or null; title caption handles null. ✓
