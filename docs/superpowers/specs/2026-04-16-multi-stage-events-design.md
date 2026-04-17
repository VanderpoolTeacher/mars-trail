# Multi-Stage Event Framework Design (issue #17 prerequisite)

**Date:** 2026-04-16
**Status:** Draft — pending user review
**Related issues:** #17 (Away-team waypoints — downstream consumer), #6 (Crew medical emergency — downstream consumer)
**Ships as:** v0.6.0

## Problem

Every event in the game resolves in a single player choice: pick an option, outcome applies, modal closes, play resumes. This is fine for tactical flavor ("push through a dust storm") but can't express narrative beats that need multiple decisions — diagnosing a medical emergency, dispatching an away team, negotiating a multi-step hazard.

Both open issues #17 (away-team waypoints) and #6 (crew medical emergency) have the same shape: diagnose → choose treatment/approach → resolve outcome with optional branching. Rather than bespoke state machines for each, build a reusable multi-stage event framework once.

## Goal

A minimal, well-scoped framework that:

1. Supports **linear + keyed-branching** chains. No full state-machine expressiveness in v1.
2. Reuses the existing event outcome system (resource deltas, skill checks, crew damage, fact awards) — no new outcome field types.
3. Does not change existing single-choice events — they keep working.
4. Ships with ONE small demo event (`drill_bit_seized`) that proves the framework end-to-end before stake-ier features ride on it.

## Scope

**In:**
- Multi-stage event data shape (`stages` dict, `startStage` key, per-choice `nextStage`).
- Pure resolution function `applyStageChoice`.
- New modal type `multi_stage` with dedicated renderer.
- Main.js dispatch branch chaining stages without intermediate outcome modals.
- Final-stage outcome summary (reuse existing `showOutcomeModal`).
- Parallel rolling pool + integration into `advanceSol`.
- One demo event (`drill_bit_seized`) exercising branching + skill checks.
- Tests for resolution, rolling, and demo-event data shape.

**Out (deferred to v0.6.1 / v0.7.0 / later):**
- Medical emergency content (#6) — v0.6.1.
- Away-team waypoints rebuild (#17) — v0.7.0.
- Stage-to-stage accumulated outcomes (outcomes already apply per-stage; no batch application at end).
- Loopable/re-entrant stages.
- State-conditional branching (e.g., "if crew count < 3, go to stage X").
- New outcome field types.
- New CSS (reuses existing modal styling).

## Architecture

**New files:**
- `src/systems/multiStage.js` — pure module. Exports `applyStageChoice`, `rollMultiStageEvent`.
- `src/content/multiStageEvents.js` — pool, initially with one entry.
- `sim/multiStage.test.mjs` — unit tests.

**Modified files:**
- `src/systems/events.js` — `applyOutcome` becomes a named export so `multiStage.js` can reuse it. No logic changes to existing functions.
- `src/systems/travel.js` — `advanceSol`'s event-rolling block adds a fallback to `rollMultiStageEvent` when `rollEvent` returns null.
- `src/ui/modals.js` — new renderer `showMultiStageModal`.
- `src/main.js` — new dispatch branch for `activeModal.type === 'multi_stage'`.
- `package.json` — version bump to 0.6.0 in the final commit.

**Untouched:** waypoint flow, scoring, career, state-shape defaults beyond what advanceSol writes via `firedEvents`.

## Data shape

```js
// src/content/multiStageEvents.js
export const MULTI_STAGE_EVENTS = [
  {
    id:         'drill_bit_seized',
    multiStage: true,              // discriminant flag
    weight:     4,                 // relative weight within the multiStage pool
    severity:   'moderate',
    oneShot:    true,
    startStage: 'discover',
    stages: {
      discover: {
        title:       'Drill Bit Seized',
        description: 'Regolith drill bound up mid-sample. Motor housing climbing toward thermal cutoff. Clock is live.',
        choices: [
          { label: 'Attempt hot-swap (engineer on station)',
            nextStage: 'swap_attempt' },
          { label: 'Bypass the drill, limp on',
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

**Contract:**
- `multiStage: true` discriminates this shape from single-choice events for the dispatcher.
- `startStage` is the key into `stages` where the chain begins.
- Each stage has `{ title, description, image?, choices[] }`.
- Each choice either has a direct `outcome` OR a `skillCheck` + `successOutcome` + `failOutcome` (same pattern as existing events).
- `nextStage` is the key of the next stage OR `null` to end the chain. Required on every choice.
- No new outcome field types — reuses the full set understood by existing `applyOutcome`.

## Engine

### `applyStageChoice(state, event, stageId, choiceIdx)`

Pure function. Applies the chosen outcome and returns the resolution:

```js
import { applyOutcome } from './events.js';

export function applyStageChoice(state, event, stageId, choiceIdx) {
  const stage  = event.stages[stageId];
  const choice = stage?.choices[choiceIdx];
  if (!choice) return { state, nextStage: null, skillResult: null };

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
  return { state: s, nextStage: choice.nextStage ?? null, skillResult, damageTarget, applied };
}
```

### `rollMultiStageEvent(state)`

Separate roller with its own base rate. Called by `advanceSol` only when `rollEvent` returned null:

```js
const MULTI_STAGE_BASE_RATE = 0.08;

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

The 0.08 rate is intentionally conservative — with one event in the pool for v0.6.0, a typical 22-sol push run will fire it ~1.76 times on average. `oneShot: true` caps actual firings at one per run.

### `advanceSol` integration

Replace the existing event-rolling block:

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

## State + modal flow

### State shape

No new top-level fields. All chain progress lives in `activeModal.payload`:

```js
state.activeModal = {
  type:    'multi_stage',
  payload: { event, stageId }
}
```

When a stage resolves, main.js either:
- **Continues:** sets `activeModal = { type: 'multi_stage', payload: { event, stageId: nextStageKey } }` — modal re-renders with next stage.
- **Ends:** clears `activeModal` and opens the existing outcome summary modal for the final choice's outcome.

### Main.js dispatch

Add above the existing `event` branch in the modal-dispatch switch:

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
      // Chain ended — show outcome summary.
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

**Why no outcome modal between stages:** continuity. The player experiences the chain as a conversation, not a series of resolve-confirm-resolve-confirm prompts. Dashboard state is visible behind the modal throughout so applied outcomes still register. Final-stage summary gives closure at the end.

## UI rendering

```js
// src/ui/modals.js
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
        <div class="modal-severity severity-${sev}">${eventLabel}</div>
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

Reuses `.modal-panel`, `.modal-choice`, `.modal-description`, severity-class styling from existing event modal. No new CSS rules in v0.6.0.

## Tests

`sim/multiStage.test.mjs` covers:

1. **Shape validation** — `drill_bit_seized` has `startStage` that exists in `stages`; every `nextStage` value references an existing stage key or is `null`; every choice has either `outcome` or `skillCheck`+`successOutcome`+`failOutcome`.
2. **`applyStageChoice` — simple outcome** — a choice with direct `outcome` returns the expected next stage and applied state.
3. **`applyStageChoice` — skill check success** — force `Math.random` to return below the threshold; assert `successOutcome` was applied.
4. **`applyStageChoice` — skill check failure** — force `Math.random` to return above the threshold; assert `failOutcome` was applied.
5. **`applyStageChoice` — career skillBonus** — pass `state.careerBonuses = { skillBonus: 0.10 }`; verify the threshold shifts by 0.10.
6. **`applyStageChoice` — invalid choiceIdx** — returns unchanged state + `nextStage: null` (defensive).
7. **Chain traversal** — run the full drill_bit_seized chain along one branch (discover → swap_attempt → null) and verify `nextStage` values across both calls.
8. **`rollMultiStageEvent` — returns null most of the time** — Math.random forced above base rate returns null.
9. **`rollMultiStageEvent` — respects oneShot** — event id in `firedEvents` → filtered out.

All tests run in Node via `node --test sim/multiStage.test.mjs`. No new dependencies.

## Validation

- **Automated:** `node --test sim/*.test.mjs` — all suites (including new multiStage tests) pass.
- **Sim harness:** `node sim/play.mjs` — pace bands for Balanced strategy stay within ±3pp of v0.5.1. The sim's game loop needs a small patch to handle `multi_stage` modals the same way it handles waypoint modals — skip-through, declining via picking choice 0. A future sim iteration could add a thoughtful multi-stage strategy; not in scope.
- **Manual:** Play to a sol where the drill event fires. Take branch A (bypass) — verify single-choice flow ends immediately with summary. Restart, take branch B (swap_attempt), then try both sub-choices. Verify skill check resolves correctly and outcome summary shows the final stage's label.

## Sequencing

Three commits on `feat/multi-stage-events`:

1. **Pure systems + tests** — `src/systems/multiStage.js`, `src/content/multiStageEvents.js`, `sim/multiStage.test.mjs`. Export `applyOutcome` from `src/systems/events.js`. Sim patch for modal skip-through.
2. **Travel integration + modal dispatch + renderer** — `src/systems/travel.js` (rollMultiStageEvent fallback), `src/ui/modals.js` (showMultiStageModal), `src/main.js` (dispatch branch).
3. **Version bump + release prep** — `package.json` to 0.6.0.

After merge: tag `v0.6.0`, create GitHub Release, post status to #17 and #6 (framework available; each can now be built on top).

## Interaction with shipped features

- **Existing events** — untouched. Still roll first via `rollEvent`, still resolve via existing `applyEventChoice`.
- **Waypoints (v0.4.0 + v0.5.0)** — untouched for v0.6.0. v0.7.0 will rebuild them on this framework.
- **Scoring (v0.3.0)** — multi-stage events contribute `sciencePoints` and `crewDamage` through the same `applyOutcome` path, so end-of-run rank + breakdown reflect them automatically.
- **Career (v0.5.0)** — `skillBonus` applies to multi-stage skill checks exactly as it does to event skill checks.
- **Meager rations (v0.5.1)** — no interaction.

## Scope boundary

This spec is **framework only**. It explicitly does NOT:
- Add medical-emergency content (v0.6.1 will, as a separate spec).
- Rebuild waypoints (v0.7.0 — separate spec).
- Add new outcome types, new CSS animations, or accumulated-outcomes mechanics.
- Support state-conditional stage branching.

If any of those feel necessary mid-implementation, stop and open a follow-up issue rather than widening this PR.
