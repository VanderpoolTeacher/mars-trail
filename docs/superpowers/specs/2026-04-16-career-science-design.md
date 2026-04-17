# Career Science Progression — Cross-Run Persistence + Tiered Efficiency Unlocks (issue #13)

**Date:** 2026-04-16
**Status:** Draft — pending user review
**Related issue:** #13 (Part 2 of the original #7)
**Ships as:** v0.5.0

## Problem

Every mission starts from the same baseline. Players who put 10 hours into the game have no tangible accumulation; the 20th run plays identically to the 1st. The only cross-run persistence today is best-run rank (#9). Playing more doesn't make the game play any differently.

## Goal

Total `sciencePoints` earned over a player's career persists in `localStorage` as career SCI. Career SCI unlocks **tiered efficiency bonuses** — not new physical equipment, not new crew, not new content. Every unlock is a digital/behavioral improvement to the *same* game: better calibration, sharper methodology, lower resource burn, clearer intel.

Two constraints shape the design:

1. **Every unlock must be thematically science/learning-derived.** No "+1 cargo slot at 50 SCI" — that's an agency funding decision, not a research outcome. Unlocks are instrument calibration, methodology training, efficiency research, intel synthesis.
2. **Every run must progress the career.** Won runs credit full earned SCI; lost runs credit a random 20–60% of what was earned in-run. A quick wipe at sol 3 with zero SCI earned grants zero to career.

## Approach — Small pure module, defensive reads at use-sites

One new pure module (`src/systems/career.js`) handles persistence and tier computation. Bonuses are a flat object on state (`state.careerBonuses`) computed once at `createInitialState`. Game systems read the bonuses at use-time via `state.careerBonuses?.foo || fallback` — no systems are *required* to be career-aware; pre-career logic paths are preserved.

Choices already settled in brainstorm:
- **Q1 — accrual on losses:** random 20–60% of in-run SCI (rewards effort, keeps surprise).
- **Q2 — tier thresholds:** softer curve (30 / 100 / 225 / 400 / 700). Each run meaningfully progresses career; top tier is ~3–7 runs of real play.
- **Q2b — unlock roster:** 5 digital/efficiency unlocks, all science-themed (see table below).
- **Q3 — locked-tier visibility:** one-ahead teaser (player sees earned + next-unearned).

## Architecture

**New files:**
- `src/systems/career.js` — pure module. Exports `CAREER_TIERS`, `loadCareerScience`, `addCareerScience`, `computeActiveBonuses`, `nextTier`, `currentTier`.
- `sim/career.test.mjs` — Node unit tests.

**Modified files:**
- `src/state.js` — imports career module, adds `careerSci` + `careerBonuses` (+ optional `eventPreview`) to state at `createInitialState`.
- `src/systems/travel.js` — reads `careerBonuses.kmMult` (travel speed) and `careerBonuses.lifeSupportMult` (O₂/H₂O).
- `src/systems/events.js` — reads `careerBonuses.skillBonus` (caps at 95% success).
- `src/ui/modals.js` — title, loadout, end-of-run, briefing, and waypoint-offer modals read career display data. Waypoint offer signature changes to accept state for exact-reward rendering.
- `src/main.js` — passes `state` into `showWaypointOfferModal` (signature change). No role in career accrual — that happens inside `showEndOfRunModal`.
- `package.json` — bump to `0.5.0` in final commit.

**Untouched:** sim harness (`sim/play.mjs`), scoring module, waypoints module, pace-balance constants.

## Tier table

| Career SCI | Tier ID | Name | Effect |
|---|---|---|---|
| 0 | `rookie` | Rookie | no bonuses |
| 30 | `calibration` | Calibration Data Analysis | `exactWaypointReward: true` |
| 100 | `navigation` | Navigation Pattern Analysis | `kmMult: 1.05` |
| 225 | `methodology` | Field Methodology Training | `skillBonus: 0.10` |
| 400 | `life_support` | Life-Support Optimization | `lifeSupportMult: 0.90` |
| 700 | `intel_synthesis` | Mission Intel Synthesis | `eventPreview: true` |

Each unlock is additive — reaching tier 3 keeps tiers 1 and 2 active. The "effect" column is merged into `state.careerBonuses` at `createInitialState`.

### Why these specific effects

- **30 — Calibration:** The offer modal reads `~50 SCI` today. Removing the `~` is a pure UI change that reflects "our instruments got better at estimating field data." First tier = easy; appears in the player's first handful of runs.
- **100 — Navigation:** `kmMult: 1.05` is a multiplicative bump on `KM_PER_SOL` applied before jitter. Rover travels 5% further per sol on average. Thematic: analyzing past route data leads to optimal-pace selection.
- **225 — Methodology:** `skillBonus: 0.10` adds 10 percentage points to every skill-check's effective probability (capped at 95% to prevent trivializing events). Thematic: veteran crew inherits best practices from all past specialists' notes.
- **400 — Life Support:** `lifeSupportMult: 0.90` is a second multiplier on top of the pace-based O₂/H₂O rate. A cautious-pace run that previously burned 1.65%/sol now burns 1.49%/sol. Thematic: closed-loop life-support research compounds across missions.
- **700 — Intel:** `eventPreview: true` causes `createInitialState` to roll a sample event from `EVENTS`, stash it on `state.eventPreview`, and the briefing modal renders one italic line hinting at it ("Orbital analysis flags X likely in first 5 sols"). The event still rolls normally during play; the preview is flavor, not a guarantee. Thematic: earned agency trust = shared orbital intel.

## Persistence + accrual

**Storage key:** `marsTrail.careerScience` (integer string).

**`loadCareerScience()`** — `parseInt(localStorage.getItem(KEY), 10) || 0`, wrapped in try/catch. Any error → 0.

**`addCareerScience(state)`** — called once from within `showEndOfRunModal` at render time (the run is over; crediting is correct regardless of what the player clicks next). Computes credit based on `state.status`:
- Won: `credit = state.sciencePoints` (full).
- Lost: `credit = Math.floor(state.sciencePoints * (0.2 + Math.random() * 0.4))` (random 20–60%).
- Zero-SCI runs (won or lost) credit zero.

Writes `current + credit` to localStorage. Returns `{ credit, total }` for the end-of-run modal to display.

**No in-game reset button** — player clears `marsTrail.careerScience` in devtools if they want to reset. Debug only.

## Bonus-application points

### `src/state.js`

```js
import { loadCareerScience, computeActiveBonuses } from './systems/career.js';
import { EVENTS } from './content/events.js';

// Inside createInitialState(), just before the return:
const careerSci = loadCareerScience();
const careerBonuses = computeActiveBonuses(careerSci);

let eventPreview = null;
if (careerBonuses.eventPreview) {
  // Roll a sample event for briefing-screen preview (flavor only).
  const pool = EVENTS.filter(e => !e.oneShot);
  if (pool.length) {
    eventPreview = pool[Math.floor(Math.random() * pool.length)];
  }
}

const baseState = {
  // ...existing fields...
  careerSci,
  careerBonuses,
  eventPreview,
  activeModal: { type: 'title' }
};
return rollWaypoints(baseState);
```

### `src/systems/travel.js`

Two changes in `advanceSol`:

```js
// Existing line:
//   const km = Math.max(0, baseKm * pilotMult * weightMult * (1 + jitter));
// Becomes:
const kmMult = state.careerBonuses?.kmMult || 1;
const km = Math.max(0, baseKm * pilotMult * weightMult * kmMult * (1 + jitter));

// Existing line (inside resource-consumption block):
//   const lifeSupportMult = LIFE_SUPPORT_MULT_BY_PACE[s.pace];
// Becomes:
const careerMult = state.careerBonuses?.lifeSupportMult || 1;
const lifeSupportMult = LIFE_SUPPORT_MULT_BY_PACE[s.pace] * careerMult;
```

### `src/systems/events.js`

One change in `applyEventChoice`, inside the skill-check branch:

```js
// Existing:
//   const effectiveP = specialistAlive ? successP : Math.max(0.2, successP - 0.4);
// Becomes:
const bonus = state.careerBonuses?.skillBonus || 0;
const baseP = specialistAlive ? successP : Math.max(0.2, successP - 0.4);
const effectiveP = Math.min(0.95, baseP + bonus);
```

The 95% cap prevents skill checks from becoming formalities at high career levels — preserves tension.

### `src/ui/modals.js`

**Waypoint offer signature change.** Currently:

```js
showWaypointOfferModal(waypoint, { onAccept, onDecline })
```

Becomes:

```js
showWaypointOfferModal(waypoint, state, { onAccept, onDecline })
```

The `state` parameter is used to read `state.careerBonuses?.exactWaypointReward`. Call site in `main.js` updates accordingly.

Inside the modal:

```js
const showExact = state?.careerBonuses?.exactWaypointReward;
const rewardText = showExact
  ? `${waypoint.sciencePoints} SCI + advanced data`
  : `~${waypoint.sciencePoints} SCI + advanced data`;
```

## UI surfaces

### Title screen (inside `showTitleLayer`)

Add a caption under the existing BEST caption:

```
CAREER: 437 SCI · TIER 3 · FIELD METHODOLOGY
NEXT: 400 SCI — Life-Support Optimization (−37)
```

When career is 0:

```
CAREER: 0 SCI · TIER 0 · ROOKIE
NEXT: 30 SCI — Calibration Data Analysis
```

Shown always (even on a zero career — to surface the progression concept from run 1). Small LCARS-neutral caption, de-emphasized relative to the BEST line. Hidden entirely when at max tier (`nextTier` returns null → drop the NEXT line; keep the CAREER line).

### Loadout screen — new sidebar block

Under the existing CARGO / ROLES / RATIONS blocks, add:

```
ACTIVE BONUSES
✓ Calibration Data Analysis     Exact waypoint rewards
✓ Navigation Pattern Analysis   Speed +5%
✓ Field Methodology             Skill checks +10pp
□ Life-Support Optimization     Locked (need 400 SCI)
```

Rendered by iterating `CAREER_TIERS`: earned tiers get ✓; the *next* locked tier gets □ with its threshold; further locked tiers are hidden. Skips the rookie tier (no bonus to list).

### End-of-run modal — new line

Between the rank block and the existing stats grid:

**Won run:**
```
+87 SCI earned this mission → career total 437
```

**Lost run:**
```
Lost run: +34 SCI credited (random 20–60% of earned) → career total 384
```

**Zero-SCI run:**
```
No career credit this mission. Career total 384
```

Reads `{ credit, total }` computed by `addCareerScience`, which is called from within `showEndOfRunModal` at render time (before the `innerHTML =` assignment). The returned credit/total are interpolated into the displayed line. Persistence happens immediately — if the player reloads the page without clicking NEW MISSION, career stays updated. The run is already over; crediting it is correct regardless of what the player does next.

### Briefing modal — tier-5 flavor line

When `state.eventPreview` is non-null and `careerBonuses.eventPreview` is active:

```
ORBITAL ANALYSIS FLAGS: Dust storm likely in first 5 sols.
```

The flavor text uses the sampled event's `modal.title` — e.g., "Dust storm likely" — plus "first 5 sols" is flavor; no actual sol-gating. This is intel, not a guarantee.

## Validation

- **Automated:** `sim/career.test.mjs` covers tier computation (`computeActiveBonuses` at several SCI levels), accrual math (won = full, lost = bounded range), persistence round-trip, malformed-storage recovery.
- **Sim regression:** run `node sim/play.mjs`. The sim doesn't read localStorage (career defaults to 0 for fresh states), so win-rate bands should stay in v0.4.0 ranges. If they drift, that's a regression somewhere in the career-bonus reads (likely a fallback-to-default bug).
- **Manual:**
  - Play a won run, verify end-of-run modal shows credit + total. Reload page → title shows new career total.
  - Manually set `localStorage.setItem('marsTrail.careerScience', '400')` in devtools, reload, verify title says Tier 4 Life-Support Optimization, loadout shows 4 ✓ + 1 □ with 700-SCI teaser, briefing does NOT yet show event preview.
  - Set to 700, reload, verify briefing shows orbital preview line.
  - Set to 0 (or delete), reload, verify title caption shows Tier 0 + 30-SCI teaser.
  - Play a full run at Tier 3 (225+), verify skill checks actually succeed more often — watch outcome-modal success/fail ratios compared to a Tier 0 baseline.

## Scope boundary

**In scope:**
- Persistence, accrual (won + lost), tier computation.
- Five tier unlocks with their effects applied at use-sites.
- Title / loadout / end-of-run / waypoint-offer / briefing display changes.
- Tests in `sim/career.test.mjs`.

**Out of scope (deferred):**
- Tier-unlock celebration pop-up when crossing a threshold (follow-up issue).
- In-game reset button.
- Career-SCI-aware sim-harness strategies (the sim still runs at career 0).
- Visible tier icons / badges on the crew panel or dashboard.
- Per-tier sound cues.
- Any "prestige" mechanic where career resets for a multiplier.

## Interaction with shipped features

- **v0.3.0 scoring:** rank and career are orthogonal. Rank measures single-run quality; career measures cumulative effort. Both show on the title screen.
- **v0.4.0 waypoints:** waypoints are an in-run SCI multiplier — accepted waypoints bump per-run SCI, which bumps career accrual. Tier 1 makes waypoint decisions slightly less gambly (exact vs. ~). Career and waypoints compound naturally.
- **#8 (event tiers by experience):** unblocked by this. `state.careerSci` becomes the experience metric. Tier table in #8 will derive from the career SCI the player brings into the run.

## Sequencing

Three commits on `feat/career-science`:

1. Pure module + tests: `src/systems/career.js` + `sim/career.test.mjs`.
2. State integration + systems wiring: `src/state.js`, `src/systems/travel.js`, `src/systems/events.js`, `src/ui/modals.js` (waypoint offer signature).
3. UI surfaces: title caption, loadout sidebar, end-of-run line, briefing preview. `package.json` version bump.

After merge: tag `v0.5.0`, create Release, close #13, comment on #8 that it's unblocked.
