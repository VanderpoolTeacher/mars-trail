# Multi-Stage Events Framework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable multi-stage event framework with keyed branching. Ships with one demo event (`drill_bit_seized`) that exercises the engine end-to-end.

**Architecture:** New pure module `src/systems/multiStage.js` that reuses the existing `applyOutcome` helper (exported from `events.js`). New modal type `multi_stage` with its own renderer + main.js dispatch branch. New content pool `multiStageEvents.js`. `advanceSol` rolls the new pool as a fallback when `rollEvent` returns null.

**Tech Stack:** Vanilla ES modules. `node --test` for tests. No new dependencies.

**Related:** Spec at `docs/superpowers/specs/2026-04-16-multi-stage-events-design.md`. Enables #17 (away-team waypoints, v0.7.0) and #6 (crew medical emergency, v0.6.1). Ships as `v0.6.0`.

---

## File Structure

**Create:**
- `src/content/multiStageEvents.js` — content pool. Single entry (`drill_bit_seized`) for v0.6.0.
- `src/systems/multiStage.js` — `applyStageChoice`, `rollMultiStageEvent`. ~60 lines.
- `sim/multiStage.test.mjs` — 9 TDD tests.

**Modify:**
- `src/systems/events.js` — add `export` keyword to `applyOutcome`. No other changes.
- `src/systems/travel.js` — `advanceSol` rolls multi-stage as fallback.
- `src/ui/modals.js` — `showMultiStageModal` renderer.
- `src/main.js` — `multi_stage` dispatch branch.
- `sim/play.mjs` — skip-through handler for `multi_stage` modals (prevents sim stall).
- `package.json` — version 0.5.1 → 0.6.0.

**Untouched:** existing event modal, existing event rolling, waypoints, scoring, career, state default shape.

---

## Task 1: Content + pure systems + tests

**Files:**
- Create: `src/content/multiStageEvents.js`
- Create: `src/systems/multiStage.js`
- Create: `sim/multiStage.test.mjs`
- Modify: `src/systems/events.js` (add one `export` keyword)

TDD flow: write tests + data first, implement, commit.

- [ ] **Step 1: Add `export` to `applyOutcome` in `src/systems/events.js`**

Find the function declaration:
```js
function applyOutcome(state, outcome) {
```

Change to:
```js
export function applyOutcome(state, outcome) {
```

No other changes in this file. Do NOT alter `applyOutcome`'s body.

- [ ] **Step 2: Create the content file**

Create `src/content/multiStageEvents.js`:

```js
// Mars Trail — multi-stage event pool (issue #17 prerequisite).
// Events with branching stages. Engine in src/systems/multiStage.js.

export const MULTI_STAGE_EVENTS = [
  {
    id:         'drill_bit_seized',
    multiStage: true,
    weight:     4,
    severity:   'moderate',
    oneShot:    true,
    startStage: 'discover',
    stages: {
      discover: {
        title:       'Drill Bit Seized',
        description: 'Regolith drill bound up mid-sample. Motor housing climbing toward thermal cutoff. Clock is live.',
        choices: [
          { label:     'Attempt hot-swap (engineer on station)',
            nextStage: 'swap_attempt' },
          { label:     'Bypass the drill, limp on',
            outcome:   { power: -10, mech: -1 },
            nextStage: null }
        ]
      },
      swap_attempt: {
        title:       'Replacing the Bit',
        description: 'Motor still hot. Engineer is gloved up, new bit in hand. Go or wait?',
        choices: [
          { label:          'Swap now — engineer check',
            skillCheck:     { role: 'engineer', successP: 0.75 },
            successOutcome: { mech: -1, sciencePoints: 10 },
            failOutcome:    { mech: -2, crewDamage: { role: 'engineer', amount: 15 } },
            nextStage:      null },
          { label:     'Let it cool — sit for 2 sols',
            outcome:   { oxygen: -3, water: -3, food: -3 },
            nextStage: null }
        ]
      }
    }
  }
];
```

- [ ] **Step 3: Write the test file**

Create `sim/multiStage.test.mjs`:

```js
// Tests for src/systems/multiStage.js. Run: node --test sim/multiStage.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MULTI_STAGE_EVENTS } from '../src/content/multiStageEvents.js';
import {
  applyStageChoice,
  rollMultiStageEvent,
  MULTI_STAGE_BASE_RATE
} from '../src/systems/multiStage.js';

// --- Shared helpers ---

function makeState(overrides = {}) {
  return {
    status: 'active',
    sol: 1,
    route: ['jezero','syrtis','arabia','meridiani','gale','elysium','tharsis','olympus_base'],
    routeKm: [330, 420, 290, 360, 460, 315, 375],
    currentLandmarkIndex: 0,
    kmToNextLandmark: 330,
    resources: { oxygen: 100, water: 100, food: 100, power: 100, panels: 100, mech: 4, eva: 4, cell: 3 },
    crew: [
      { id: 'c1', name: 'A', role: 'engineer',  health: 100, status: 'healthy', alive: true },
      { id: 'c2', name: 'B', role: 'biologist', health: 100, status: 'healthy', alive: true },
      { id: 'c3', name: 'C', role: 'medic',     health: 100, status: 'healthy', alive: true },
      { id: 'c4', name: 'D', role: 'pilot',     health: 100, status: 'healthy', alive: true },
      { id: 'c5', name: 'E', role: 'security',  health: 100, status: 'healthy', alive: true }
    ],
    sciencePoints: 0,
    factsLearned: [],
    firedEvents: [],
    log: [],
    ...overrides
  };
}

function withRandom(values, fn) {
  const original = Math.random;
  let i = 0;
  Math.random = () => values[i++ % values.length];
  try { return fn(); }
  finally { Math.random = original; }
}

const drill = MULTI_STAGE_EVENTS.find(e => e.id === 'drill_bit_seized');

// --- Shape validation ---

test('demo event shape: startStage exists; every nextStage resolves or is null', () => {
  for (const event of MULTI_STAGE_EVENTS) {
    assert.ok(event.stages[event.startStage], `${event.id}: startStage "${event.startStage}" missing from stages`);
    for (const [stageId, stage] of Object.entries(event.stages)) {
      for (const choice of stage.choices) {
        if (choice.nextStage !== null) {
          assert.ok(event.stages[choice.nextStage],
            `${event.id}.${stageId}: nextStage "${choice.nextStage}" missing from stages`);
        }
        const hasOutcome = 'outcome' in choice || ('successOutcome' in choice && 'failOutcome' in choice);
        assert.ok(hasOutcome,
          `${event.id}.${stageId}: choice must have outcome OR skillCheck with success/fail outcomes`);
      }
    }
  }
});

// --- applyStageChoice ---

test('applyStageChoice: simple outcome applies and returns nextStage', () => {
  const s0 = makeState();
  // discover stage, choice 1 ("Bypass") — direct outcome, nextStage: null
  const r = applyStageChoice(s0, drill, 'discover', 1);
  assert.equal(r.nextStage, null);
  assert.equal(r.state.resources.power, 100 - 10);
  assert.equal(r.state.resources.mech, 4 - 1);
  assert.equal(r.skillResult, null);
});

test('applyStageChoice: branching choice returns nextStage key', () => {
  const s0 = makeState();
  // discover stage, choice 0 ("Attempt hot-swap") — no outcome, branches to swap_attempt
  const r = applyStageChoice(s0, drill, 'discover', 0);
  assert.equal(r.nextStage, 'swap_attempt');
  // No outcome applied on this choice.
  assert.equal(r.state.resources.power, 100);
  assert.equal(r.state.resources.mech, 4);
});

test('applyStageChoice: skill-check success applies successOutcome', () => {
  const s0 = makeState();
  // swap_attempt choice 0 — skill check (engineer 0.75). Roll 0.01 → success.
  const r = withRandom([0.01], () => applyStageChoice(s0, drill, 'swap_attempt', 0));
  assert.equal(r.skillResult.success, true);
  assert.equal(r.skillResult.role, 'engineer');
  assert.equal(r.state.resources.mech, 4 - 1);
  assert.equal(r.state.sciencePoints >= 8 && r.state.sciencePoints <= 12, true,
    'sciencePoints ~10 after jitter');
});

test('applyStageChoice: skill-check failure applies failOutcome', () => {
  const s0 = makeState();
  // swap_attempt choice 0 — skill check. Roll 0.99 → fail.
  const r = withRandom([0.99], () => applyStageChoice(s0, drill, 'swap_attempt', 0));
  assert.equal(r.skillResult.success, false);
  assert.equal(r.state.resources.mech, 4 - 2);
  // Crew damage went to engineer.
  const engineer = r.state.crew.find(c => c.role === 'engineer');
  assert.ok(engineer.health < 100, 'engineer took damage on skill-check failure');
});

test('applyStageChoice: careerBonuses.skillBonus lifts success rate', () => {
  const s0 = makeState({ careerBonuses: { skillBonus: 0.10 } });
  // Base engineer P = 0.75 → effective 0.85 with career bonus.
  // Roll 0.80 would fail without bonus, succeed with it.
  const r = withRandom([0.80], () => applyStageChoice(s0, drill, 'swap_attempt', 0));
  assert.equal(r.skillResult.success, true);
});

test('applyStageChoice: invalid choiceIdx is a defensive no-op', () => {
  const s0 = makeState();
  const r = applyStageChoice(s0, drill, 'discover', 99);
  assert.equal(r.state, s0);
  assert.equal(r.nextStage, null);
  assert.equal(r.skillResult, null);
});

test('applyStageChoice: chain traversal (discover → swap_attempt → null)', () => {
  let s = makeState();
  // Stage 1: branch to swap_attempt.
  let r1 = applyStageChoice(s, drill, 'discover', 0);
  assert.equal(r1.nextStage, 'swap_attempt');
  s = r1.state;
  // Stage 2: "let it cool" direct outcome, ends chain.
  let r2 = applyStageChoice(s, drill, 'swap_attempt', 1);
  assert.equal(r2.nextStage, null);
  assert.equal(r2.state.resources.oxygen, 100 - 3);
  assert.equal(r2.state.resources.water,  100 - 3);
  assert.equal(r2.state.resources.food,   100 - 3);
});

// --- rollMultiStageEvent ---

test('rollMultiStageEvent: returns null when random is above base rate', () => {
  const s = makeState();
  const event = withRandom([MULTI_STAGE_BASE_RATE + 0.01], () => rollMultiStageEvent(s));
  assert.equal(event, null);
});

test('rollMultiStageEvent: respects firedEvents for oneShot', () => {
  const s = makeState({ firedEvents: ['drill_bit_seized'] });
  // Force low random so the rate check passes; result still null because pool empty after filter.
  const event = withRandom([0.01, 0.5], () => rollMultiStageEvent(s));
  assert.equal(event, null);
});
```

- [ ] **Step 4: Run tests — should fail on import of multiStage.js**

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node --test sim/multiStage.test.mjs`

Expected: all tests fail with `Cannot find module '../src/systems/multiStage.js'`.

- [ ] **Step 5: Create `src/systems/multiStage.js`**

```js
// Mars Trail — multi-stage event resolution + rolling (issue #17 prerequisite).
// Pure module. Reuses applyOutcome from events.js.

import { MULTI_STAGE_EVENTS } from '../content/multiStageEvents.js';
import { applyOutcome } from './events.js';

export const MULTI_STAGE_BASE_RATE = 0.08;

// ---- Resolve a chosen option on a given stage ----
//
// Returns { state, nextStage, skillResult, damageTarget, applied }.
// state:       new state after outcome application.
// nextStage:   key of the next stage, or null to end the chain.
// skillResult: present when the choice had a skillCheck.
export function applyStageChoice(state, event, stageId, choiceIdx) {
  const stage  = event.stages[stageId];
  const choice = stage?.choices[choiceIdx];
  if (!choice) return { state, nextStage: null, skillResult: null, damageTarget: null, applied: {} };

  let outcome = choice.outcome;
  let skillResult = null;

  if (choice.skillCheck) {
    const { role, successP } = choice.skillCheck;
    const specialistAlive = state.crew.some(c => c.role === role && c.alive);
    const baseP = specialistAlive ? successP : Math.max(0.2, successP - 0.4);
    const bonus = state.careerBonuses?.skillBonus || 0;
    const effectiveP = Math.min(0.95, baseP + bonus);
    const success = Math.random() < effectiveP;
    outcome = success ? choice.successOutcome : choice.failOutcome;
    skillResult = { role, success, specialistAlive };
  }

  const { state: s, damageTarget, applied } = applyOutcome(state, outcome);
  return {
    state: s,
    nextStage: choice.nextStage ?? null,
    skillResult,
    damageTarget,
    applied
  };
}

// ---- Roll a multi-stage event ----
//
// Called by advanceSol only when rollEvent returned null. Lower base rate
// keeps the pool from flooding single-choice events.
export function rollMultiStageEvent(state) {
  if (Math.random() > MULTI_STAGE_BASE_RATE) return null;
  const fired = state.firedEvents || [];
  const eligible = MULTI_STAGE_EVENTS.filter(e => !(e.oneShot && fired.includes(e.id)));
  if (!eligible.length) return null;
  const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
  let r = Math.random() * totalWeight;
  for (const e of eligible) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return eligible[eligible.length - 1];
}
```

- [ ] **Step 6: Run tests — all pass**

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node --test sim/multiStage.test.mjs`

Expected: `# tests 10`, `# pass 10`, `# fail 0`.

- [ ] **Step 7: Run full test suite**

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node --test sim/*.test.mjs 2>&1 | tail -5`

Expected: all existing suites still pass alongside the new multiStage tests.

- [ ] **Step 8: Commit**

```bash
git add src/systems/multiStage.js src/systems/events.js src/content/multiStageEvents.js sim/multiStage.test.mjs
git commit -m "$(cat <<'EOF'
Multi-stage events framework: pure systems + demo event (refs #17, #6)

New module src/systems/multiStage.js with applyStageChoice and
rollMultiStageEvent. Reuses applyOutcome from events.js (now an
exported named export).

Demo event drill_bit_seized exercises branching + skill checks end
to end. Ten TDD tests cover shape validation, simple outcomes,
branch transitions, skill-check success/failure, career skillBonus
application, invalid-input defense, full chain traversal, and
rolling with oneShot semantics.

No UI or integration yet — next task.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Travel integration + modal dispatch + renderer + sim patch

**Files:**
- Modify: `src/systems/travel.js`
- Modify: `src/ui/modals.js`
- Modify: `src/main.js`
- Modify: `sim/play.mjs`

- [ ] **Step 1: Add rollMultiStageEvent fallback to `advanceSol`**

Open `src/systems/travel.js`. Find the event-rolling block inside `advanceSol` (near the end of the function, after loss checks):

```js
  if (mode === 'travel' && s.status === 'active' && !s.activeModal) {
    const event = rollEvent(s);
    if (event) {
      s.activeModal = { type: 'event', payload: event };
      if (event.oneShot) s.firedEvents = [...s.firedEvents, event.id];
    }
  }
```

Replace with:

```js
  if (mode === 'travel' && s.status === 'active' && !s.activeModal) {
    const event = rollEvent(s);
    if (event) {
      s.activeModal = { type: 'event', payload: event };
      if (event.oneShot) s.firedEvents = [...s.firedEvents, event.id];
    } else {
      const msEvent = rollMultiStageEvent(s);
      if (msEvent) {
        s.activeModal = { type: 'multi_stage', payload: { event: msEvent, stageId: msEvent.startStage } };
        if (msEvent.oneShot) s.firedEvents = [...s.firedEvents, msEvent.id];
      }
    }
  }
```

Also at the top of `src/systems/travel.js`, add the import:
```js
import { rollMultiStageEvent } from './multiStage.js';
```

- [ ] **Step 2: Add `showMultiStageModal` to `src/ui/modals.js`**

At the end of `src/ui/modals.js` (after existing modal exports), add:

```js
// ---- Multi-stage event modal (issue #17 prerequisite) ----

export function showMultiStageModal(event, stageId, onChoose) {
  const r = root();
  if (!r) return;

  const stage = event.stages[stageId];
  const imgBlock = stage.image
    ? `<img class="modal-image" src="${stage.image}" alt="" />`
    : '';
  const sev = event.severity || 'moderate';
  const eventLabel = (event.id || '').replace(/_/g, ' ').toUpperCase();

  const choicesHtml = stage.choices.map((c, i) => `
    <button type="button" class="modal-choice" data-idx="${i}">
      ${escapeHtml(c.label)}${c.skillCheck ? ` <span class="skill-check-badge">${c.skillCheck.role}</span>` : ''}
    </button>
  `).join('');

  r.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-panel modal-multistage" role="dialog" aria-modal="true">
        <div class="modal-severity severity-${sev}">${escapeHtml(eventLabel)}</div>
        <h2 class="modal-title">${escapeHtml(stage.title)}</h2>
        ${imgBlock}
        <p class="modal-description">${escapeHtml(stage.description)}</p>
        <div class="modal-choices">
          ${choicesHtml}
        </div>
      </div>
    </div>
  `;

  r.querySelectorAll('[data-idx]').forEach(btn => {
    btn.addEventListener('click', () => onChoose(Number(btn.dataset.idx)));
  });
}
```

- [ ] **Step 3: Add the main.js dispatch branch**

Open `src/main.js`. At the top, extend the imports. Find:

```js
import { showEventModal, showOutcomeModal, ... } from './ui/modals.js';
```

Add `showMultiStageModal` to that list.

Then add a new import line near the top:

```js
import { applyStageChoice } from './systems/multiStage.js';
```

Find the existing `waypoint_offer` branch in the modal-dispatch section (it's in the same switch area as `event`, `waypoint_reward`, etc.). ABOVE the `event` branch (and near the waypoint branches), insert:

```js
  if (modal.type === 'multi_stage') {
    const { event, stageId } = modal.payload;
    showMultiStageModal(event, stageId, (choiceIdx) => {
      const { state: next, nextStage, skillResult, damageTarget, applied } = applyStageChoice(state, event, stageId, choiceIdx);
      state = next;
      render(state);

      if (nextStage !== null) {
        state = { ...state, activeModal: { type: 'multi_stage', payload: { event, stageId: nextStage } } };
        renderAll();
      } else {
        const choice = event.stages[stageId].choices[choiceIdx];
        const outcome = choice.outcome || (skillResult?.success ? choice.successOutcome : choice.failOutcome);
        const resolution = {
          event: { ...event, modal: event.stages[stageId] },
          choice, outcome, applied, skillResult, damageTarget
        };
        showOutcomeModal(resolution, () => { closeModal(); renderAll(); });
      }
    });
    return;
  }
```

- [ ] **Step 4: Patch the sim to skip multi-stage modals**

Open `sim/play.mjs`. Find the existing skip-through handlers for `waypoint_offer` / `waypoint_reward` inside the `playGame` loop. They look like:

```js
    if (s.activeModal && s.activeModal.type === 'waypoint_offer') {
      s = { ...s, firedWaypoints: [...s.firedWaypoints, s.activeModal.payload.waypoint.id], activeModal: null };
      continue;
    }
    if (s.activeModal && s.activeModal.type === 'waypoint_reward') {
      s = { ...s, activeModal: null };
      continue;
    }
```

Directly AFTER those blocks, add:

```js
    // Multi-stage events: sim picks choice 0 on every stage (simplest "always take first").
    // Sim isn't a strategy-rich multi-stage runner; this just keeps the game loop from stalling.
    if (s.activeModal && s.activeModal.type === 'multi_stage') {
      const { event, stageId } = s.activeModal.payload;
      const { applyStageChoice } = await import('../src/systems/multiStage.js');
      const { state: next, nextStage } = applyStageChoice(s, event, stageId, 0);
      if (nextStage !== null) {
        s = { ...next, activeModal: { type: 'multi_stage', payload: { event, stageId: nextStage } } };
      } else {
        s = { ...next, activeModal: null };
      }
      continue;
    }
```

If the `playGame` function isn't `async`, upgrade it to `async` and convert its caller accordingly. Check by running:

```bash
grep -n "function playGame\|playGame(" sim/play.mjs
```

If `playGame` is not async, use a top-of-file static import instead:

```js
import { applyStageChoice } from '../src/systems/multiStage.js';
```

…and use it directly without `await import`. Simpler.

- [ ] **Step 5: Syntax check + full tests + sim**

```bash
cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail"
node --check src/systems/travel.js
node --check src/ui/modals.js
node --check src/main.js
node --check sim/play.mjs
node --test sim/*.test.mjs 2>&1 | tail -3
node sim/play.mjs 2>&1 | tail -13
```

Expected: all syntax clean; all tests pass; sim prints 12-row table with pace bands within ±3pp of v0.5.1.

- [ ] **Step 6: Commit**

```bash
git add src/systems/travel.js src/ui/modals.js src/main.js sim/play.mjs
git commit -m "$(cat <<'EOF'
Multi-stage events: travel integration + UI renderer + dispatch (refs #17, #6)

advanceSol rolls multi-stage events as a fallback when rollEvent
returns null. New showMultiStageModal renderer reuses existing modal
styling. main.js dispatch branch chains stages without intermediate
outcome modals (summary fires only at chain end via existing
showOutcomeModal). Sim harness patched to step through multi-stage
modals so pace-band measurements stay clean.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Version bump + final checks + commit

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Bump package.json to 0.6.0**

Open `package.json`. Change `"version": "0.5.1"` to `"version": "0.6.0"`.

Final shape:
```json
{
  "type": "module",
  "private": true,
  "version": "0.6.0"
}
```

- [ ] **Step 2: Full test + sim sanity**

```bash
cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail"
node --test sim/*.test.mjs 2>&1 | tail -3
node sim/play.mjs 2>&1 | tail -13
```

Expected: all tests pass, Balanced cautious/steady/push rows within ±3pp of v0.5.1 values.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "$(cat <<'EOF'
Bump to v0.6.0 — multi-stage events framework

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: PR → merge → tag v0.6.0 → release

**Files:** none modified.

- [ ] **Step 1: Push branch**

```bash
cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail"
git push -u origin feat/multi-stage-events
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --base main --head feat/multi-stage-events --title "Multi-stage events framework (v0.6.0)" --body "$(cat <<'EOF'
## Summary

New reusable framework for chained events with keyed branching. Ships with one demo event (\`drill_bit_seized\`) that exercises the engine end to end. Unblocks:
- #17 (away-team waypoints — v0.7.0)
- #6 (crew medical emergency — v0.6.1)

## What changed

- **New:** \`src/systems/multiStage.js\` (pure module), \`src/content/multiStageEvents.js\` (demo event), \`sim/multiStage.test.mjs\` (10 tests).
- **Modified:** \`src/systems/events.js\` adds \`export\` keyword to \`applyOutcome\`. \`src/systems/travel.js\` rolls multi-stage as fallback. \`src/ui/modals.js\` adds \`showMultiStageModal\`. \`src/main.js\` adds \`multi_stage\` dispatch branch. \`sim/play.mjs\` skip-through.
- **Package:** 0.5.1 → 0.6.0.

## Demo event

\`drill_bit_seized\` (one-shot, weight 4). Stage 1 branches: hot-swap attempt OR bypass-and-limp. Stage 2 (if you chose hot-swap): engineer skill check OR 2-sol cool-down. Exercises linear branching, skill-check success/failure, direct-outcome path, and chain-ends-mid-tree.

## Test plan

- [x] \`node --test sim/*.test.mjs\` — all pass (10 new multi-stage tests + prior suites).
- [x] \`node sim/play.mjs\` — pace bands within ±3pp of v0.5.1 (sim auto-takes choice 0 through multi-stage events).
- [ ] Browser: title shows \`v0.6.0 · 2026\`.
- [ ] Browser: play until drill event fires. Take bypass branch — single stage, ends with outcome summary showing −10 PWR.
- [ ] Browser: restart, take hot-swap branch — second stage fires with continuous narrative (no interstitial summary). Pick skill check or cool-down; summary fires at chain end.
- [ ] Browser: no regression in existing events (dust storm, bearing seizure, etc. still fire normally).

## Out of scope (next releases)

- #6 medical emergency content — v0.6.1 (uses this framework).
- #17 away-team rebuild — v0.7.0 (uses this framework + adds crew-split state).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: User review + merge**

Hand to the user to test. Standard flow: `gh pr merge <N> --rebase --delete-branch`.

- [ ] **Step 4: Post-merge — sync, tag, release**

```bash
cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail"
git checkout main
git fetch --prune
git reset --hard origin/main
git branch -D feat/multi-stage-events 2>/dev/null

git tag -a v0.6.0 -m "v0.6.0 — Multi-stage event framework

New reusable framework for chained events with keyed branching.
Demo event (drill_bit_seized) exercises the engine. Unblocks
#6 and #17 for follow-up releases."
git push origin v0.6.0

gh release create v0.6.0 --title "v0.6.0 — Multi-Stage Event Framework" --notes "$(cat <<'EOF'
## Chained events land

New framework in \`src/systems/multiStage.js\` supports events with multiple stages and keyed branching. Each stage has its own title, description, and choices; each choice either ends the chain or routes to another stage by key.

## Demo event: Drill Bit Seized

Ships with one event exercising the framework:

**Stage 1.** Drill is bound, motor overheating. Choose: attempt hot-swap (branches to stage 2) OR bypass and limp (ends chain with power + mech cost).

**Stage 2** (if hot-swap chosen). Engineer skill check — success grants science; failure takes mech + injures the engineer. OR let it cool for 2 sols (resource burn, no risk).

## What's next

- **v0.6.1** — crew medical emergency (#6) built on this framework.
- **v0.7.0** — away-team waypoints (#17) built on this framework + crew-split state.

## Closed

Framework itself has no user-facing issue to close. It's infrastructure; the feature issues (#6, #17) close when each consumer ships.
EOF
)"
```

- [ ] **Step 5: Verify + post status**

```bash
gh release view v0.6.0
gh issue comment 17 --body "Multi-stage event framework landed in v0.6.0. This issue is now implementable on top of it — next up."
gh issue comment 6 --body "Multi-stage event framework landed in v0.6.0. This issue is now implementable on top of it (queued behind #17 in the v0.6.1 slot)."
```

---

## Self-Review

**Spec coverage:**
- §Architecture (new + modified files) → Tasks 1, 2 ✓
- §Data shape (MULTI_STAGE_EVENTS + drill_bit_seized) → Task 1 Step 2 ✓
- §Engine (applyStageChoice + rollMultiStageEvent + applyOutcome export) → Task 1 Steps 1, 5 ✓
- §State + modal flow (activeModal payload + dispatch chaining) → Task 2 Step 3 ✓
- §UI rendering (showMultiStageModal) → Task 2 Step 2 ✓
- §Tests (shape validation + 9 behavior tests) → Task 1 Step 3 ✓
- §Validation (sim patch + run) → Task 2 Steps 4, 5 ✓
- §Sequencing (3 commits + version bump + release) → Tasks 1, 2, 3, 4 ✓

**Placeholder scan:** No TBDs/TODOs. Task 2 Step 4's fallback to static import ("If `playGame` is not async…") is a resolvable-at-implementation note, not a placeholder.

**Type consistency:**
- `applyStageChoice` signature `(state, event, stageId, choiceIdx)` and return `{ state, nextStage, skillResult, damageTarget, applied }` consistent across Task 1 (test + implementation) and Task 2 (main.js caller).
- `state.careerBonuses?.skillBonus` guard pattern matches shipped v0.5.0 usage in events.js.
- `activeModal` payload `{ event, stageId }` shape consistent across travel.js setter and main.js reader.
- `MULTI_STAGE_BASE_RATE` exported from `multiStage.js`, imported only in the test for assertion. No leakage.
