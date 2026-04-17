# Pace Balance Design (issues #2, #4)

**Date:** 2026-04-16
**Author:** Brainstorm session
**Status:** Draft — pending user review
**Related issues:** #2 (pace imbalance), #4 (sim harness)

## Problem

500-game simulation results found that at present:

| Strategy | Win% |
|---|---|
| Balanced / push / standard | 95.4% |
| Safe / steady / standard | 0.0% |
| Safe / cautious / standard | 0.0% |

The pace UI is effectively decorative: only push is winnable. Dominant loss mode at slower paces is `all_dead` (crew attrition from background damage + event rolls compounding over the extra sols a slow trip takes). See issue #2 for full root-cause write-up.

## Goal

Rebalance so all three paces are viable strategic choices with distinct risk profiles. Target curve (with the "Balanced" reference strategy as a proxy for thoughtful play):

- **Cautious** ~70% win — safest choice
- **Steady** ~60% win — reasonable default
- **Push** ~40–50% win with higher variance — gamble for speed

Also require: `FirstChoice` strategy (naive click-through) does not exceed ~80% win at any pace, so the game still rewards reading the events.

## Approach — Pace-scaled attrition

Two flat constants become pace-indexed tables. No new mechanics, no UI changes, no schema changes.

### Code changes

**`src/systems/travel.js`**

```js
// Replace:
// const BACKGROUND_DAMAGE = 2;

const BACKGROUND_DAMAGE_BY_PACE = {
  cautious: 1,
  steady:   2,
  push:     3
};

// At call site in advanceSol:
// applyDamage(s, id, BACKGROUND_DAMAGE_BY_PACE[s.pace], 'fatigue')
```

**`src/systems/events.js`**

```js
// Replace:
// const EVENT_BASE_RATE = 0.65;

const EVENT_BASE_RATE_BY_PACE = {
  cautious: 0.45,
  steady:   0.60,
  push:     0.78
};

export function rollEvent(state) {
  const rate = EVENT_BASE_RATE_BY_PACE[state.pace];
  if (Math.random() > rate) return null;
  // ...rest unchanged
}
```

The table values above are **starting guesses** — final values will be chosen by iterating against the sim harness.

### Why this design

- **Minimal surface area:** ~10–15 lines modified across 2 files. Low regression risk.
- **Two clean dials:** one per-sol damage lever, one per-sol event rate lever. Easy to reason about during tuning.
- **Thematic:** "slower driving means fewer accidents and less crew fatigue" matches real rover-ops framing.
- **Composes with existing cost structure:** slow paces still burn more total life-support supplies (longer trip), so pace retains a supplies-vs-safety tradeoff independent of this change.

### Rejected alternatives

1. **Nerf push only** (leave slow paces untouched). Insufficient — the sim showed slow paces already lose 100% of runs, so reducing push alone just makes the game unwinnable.
2. **Pilot fatigue mechanic** (track accumulated fatigue, trigger events). Richer simulation but introduces new state, new UI surface, and new regression risk. Overkill for a tuning pass; revisit in a future issue if needed.
3. **Shorten route or raise base km/sol.** Structural fix but changes the geography/identity of the game; pace levers are preferable to keep the ~25-sol trip length.

## Sim harness (issue #4)

Built and committed **first**, before any balance change, so every tuning iteration can be validated.

### Layout

- **`/package.json`** (new, 3 lines) — `{"type":"module","private":true}`. Enables Node ESM import of `src/*.js`. No effect on browser behavior (browsers use `<script type="module">` tags; they don't read `package.json`).
- **`/sim/play.mjs`** (new) — the harness. Imports pure game modules directly:
  - `createInitialState` from `src/state.js`
  - `advanceSol`, `repairBattery`, `cleanPanels`, `canRepair`, `canClean` from `src/systems/travel.js`
  - `applyEventChoice` from `src/systems/events.js`
- **`/sim/README.md`** (new, short) — usage note: `node sim/play.mjs`, expected output shape.

### Harness behavior

- Defines four reference strategies: `FirstChoice`, `Safe`, `Skilled`, `Balanced`. Each is a function `(state, event) → choiceIndex`.
- Top-of-file array defines the configurations to test: `{ name, pace, rations, pick }` per row.
- Per configuration: runs 500 games, tallies win%, avg sols (total + wins only), avg crew survived, avg science points, loss-reason breakdown.
- Prints a single summary table to stdout.
- No CLI args — edit the strategy array to change what gets run.

### Non-goals

Not a test suite. No CI hook. No assertions. Purely a dev tool for balance playtesting.

## Tuning procedure for issue #2

Once the harness is in place:

1. Apply starting-guess constants from above.
2. Run `node sim/play.mjs`, capture table.
3. Compare Balanced-strategy win rates to target: cautious ~70 / steady ~60 / push 40–50 (±5%).
4. If a pace is too lethal → lower that pace's `BACKGROUND_DAMAGE_BY_PACE` entry by 1, or drop its `EVENT_BASE_RATE_BY_PACE` entry by ~0.05. If too easy → reverse. Adjust one lever at a time.
5. Stop when all three paces hit target ±5% for Balanced strategy AND FirstChoice ≤ 80% at every pace AND Skilled beats Balanced by ~5–10pp.
6. Budget: ~4–6 iterations expected. Each sim run <10s.

**Escape hatch:** if the two-lever design cannot hit target after ~10 iterations, stop and open a follow-up issue proposing additional levers (e.g., `KM_VARIANCE` bump on push, medic mitigation scaling). Do not silently expand scope.

## Validation

- **Automated:** `node sim/play.mjs` curve hits target per tuning procedure above.
- **Manual browser check:** Play one game at each pace, confirm the feel matches intent (cautious feels grinding but safe; push feels tense).
- **Regression check:** Confirm resource consumption (O2/H2O/food per sol) and event modal behavior are unchanged outside of the two tuned levers. Grep for `EVENT_BASE_RATE` and `BACKGROUND_DAMAGE` to ensure no stray references.

## Amendment — 2026-04-16 (mid-implementation)

**Added a third lever** after Task 5 revealed a structural problem. The two-lever design (background damage + event rate) cannot move cautious off 0% win rate because cautious's ~38-sol trip runs O₂ below the 25% critical threshold in the last ~4 sols regardless of attrition tuning. The critical-resource damage (hypoxia 12 hp/crew/sol) alone is enough to kill the crew.

**Third lever:** `LIFE_SUPPORT_MULT_BY_PACE = { cautious: 0.75, steady: 1.0, push: 1.35 }` — multiplies the base `O2_PER_SOL` and `H2O_PER_SOL` rates in `src/systems/travel.js`. Thematic: slower rover draws less life-support power, faster rover works harder. Does not touch `FOOD_PER_SOL` (already indexed by rations, not pace).

**Starting guesses at cautious × 0.75 multiplier:** 1.65% O₂/sol × 38 sols = 62.7% burned; ends at 37%, above the 25% crit threshold. Cautious becomes survivable on supplies, then the two-lever levers handle crew attrition.

Scope cost: one new constant, two modified call sites in `travel.js`. No new state, no UI, no new mechanics.

## Scope boundary

This spec covers **only** pace balance (issue #2) and the sim harness (issue #4). The related meager-rations trap (issue #3) is explicitly out of scope — it can be tuned independently in a follow-up using the same harness.

## Sequencing

Two commits, each closes one issue:

1. **Commit 1 → closes #4.** Adds `package.json`, `sim/play.mjs`, `sim/README.md`.
2. **Commit 2 → closes #2.** Modifies `src/systems/travel.js` and `src/systems/events.js` with tuned values. Commit message includes the final sim table as evidence.

After commit 2 merges, tag **`v0.2.0`** (minor bump — gameplay behavior change) and create a GitHub Release.
