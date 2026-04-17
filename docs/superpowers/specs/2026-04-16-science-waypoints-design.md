# Science Waypoints — Side-Expeditions Design (issue #7 Part 1)

**Date:** 2026-04-16
**Status:** Draft — pending user review
**Related issue:** #7 (part 1 only — advanced facts via side-expeditions)
**Scope note:** Part 2 (cross-run career progression) will be a separate spec / PR / issue. This spec is strictly within-run.

## Problem

All Mars-fact content in the game is reached through routine random events that fire during travel. There's no way to earn rare/advanced content, no reason to chase science beyond clicking through event modals, and no gameplay reward for exploration-minded play. Every mission samples from the same fact pool.

## Goal

Add an optional, costly, rewarding side-activity: scientific waypoints detected off the main route. A player who wants to chase science can detour for exclusive advanced facts and a chunky SCI bonus, paying in sols and life-support burn. A player who just wants to reach Olympus Base can decline every waypoint and never lose pace.

Two success criteria:
1. Players who detour earn content they can't get any other way.
2. Declining every waypoint is still a perfectly valid strategy — no fear-of-missing-out design.

## Approach — random-pool waypoints, flat-cost deterministic rewards

Pre-roll waypoints at run start, show them on the minimap from sol 1, offer them at segment start as yes/no decisions. Accept = pay sols; reward lands at the next landmark. No skill checks, no hazard events — the sol cost alone is the strategic decision (supplies are finite, pace matters, time equals damage).

Selected from brainstorm:
- **Q1 — split from Part 2:** yes, Part 1 ships as its own PR.
- **Q2 — selection model:** random pool (~12–14 authored waypoints, 6 segments each rolls one with 40% probability).
- **Q3 — cost/risk:** flat cost, guaranteed reward. Supplies + sols = the decision texture.

## Architecture

**New files:**

- `src/content/waypoints.js` — pure data. The `WAYPOINTS` pool with ~12–14 entries.
- `src/content/advancedFacts.js` — parallel fact pools (`ADVANCED_GEOLOGY_FACTS`, `ADVANCED_WATER_FACTS`, etc.) reachable only from waypoints.
- `src/systems/waypoints.js` — pure functions: `rollWaypoints(state)`, `acceptWaypoint(state, segmentIdx)`, `resolveWaypoint(state)`.

**Modified files:**

- `src/state.js` — three new state fields populated at run start: `waypoints`, `pendingWaypoint`, `firedWaypoints`. Call `rollWaypoints` inside `createInitialState`.
- `src/systems/travel.js` — landmark-arrival hook in `advanceSol` checks for pending-waypoint (fire reward modal) and for segment-waypoint (fire offer modal). Modal chaining via existing `activeModal` mechanism.
- `src/ui/modals.js` — two new modal renderers: `showWaypointOfferModal`, `showWaypointRewardModal`.
- `src/main.js` — wire the two new modals into the event handler that processes `activeModal`.
- `src/render.js` — `renderMinimap` draws waypoint markers along segments with three visual states (pending/accepted/fired).
- `styles/components.css` — waypoint marker styling + pulse animation.

**Untouched:** `src/systems/events.js` (routine events still pull from the non-advanced fact pool), `src/systems/scoring.js`, the sim harness (waypoints are pure logic; can be exercised later if desired, not in scope here).

## Waypoint data shape

```js
// src/content/waypoints.js
export const WAYPOINTS = [
  {
    id:           'olivine_outcrop',
    name:         'Olivine Outcrop',
    briefing:     'Sensors pinged Mg-rich olivine 40 km off-route. Volcanic history here runs deeper than the literature suggests.',
    detourKm:      80,         // round-trip; added to current segment's km
    detourSols:    4,          // estimate shown in offer modal
    sciencePoints: 50,         // will be jittered ±15% at reward time
    factPool:     'GEOLOGY',   // → pulls from ADVANCED_GEOLOGY_FACTS
    image:        'assets/images/waypoint-olivine.jpg'  // optional
  }
  // …~12–14 total. Suggested themes:
  //   subsurface ice, lander wreckage, recurring-slope lineae,
  //   polar layered deposit, methane seep, lava tube, banded deposit,
  //   dust-devil corridor, meteorite field, ancient rille, crater central peak,
  //   rootless cone, volcanic vent.
];
```

One waypoint object per site. No per-waypoint skill-check variety in v1 (brainstorm Q3 chose flat cost).

## Advanced facts

```js
// src/content/advancedFacts.js
export const ADVANCED_GEOLOGY_FACTS      = [ /* 5–8 strings */ ];
export const ADVANCED_WATER_FACTS        = [ /* 5–8 */ ];
export const ADVANCED_ATMOSPHERE_FACTS   = [ /* 5–8 */ ];
export const ADVANCED_ASTROBIOLOGY_FACTS = [ /* 5–8 */ ];
// …one per category used by waypoints.
```

These pools are **exclusive to waypoints** — routine events (`src/content/events.js` / `src/systems/events.js`) never reference them. Creates a visible progression: the player sees advanced facts in their codex and knows they came from a detour.

Fact-selection helper (shared with routine-facts code):

```js
// In src/systems/waypoints.js
const ADVANCED_POOLS = {
  GEOLOGY:      ADVANCED_GEOLOGY_FACTS,
  WATER:        ADVANCED_WATER_FACTS,
  ATMOSPHERE:   ADVANCED_ATMOSPHERE_FACTS,
  ASTROBIOLOGY: ADVANCED_ASTROBIOLOGY_FACTS,
  // ...
};

function pickAdvancedFact(waypoint) {
  const pool = ADVANCED_POOLS[waypoint.factPool];
  if (!pool || pool.length === 0) return '';
  return pool[Math.floor(Math.random() * pool.length)];
}
```

## State shape changes

```js
// src/state.js — inside createInitialState()
waypoints:        [],     // [{ waypointId, segmentIdx }] — populated by rollWaypoints
pendingWaypoint:  null,   // full waypoint object while detour is in progress
firedWaypoints:   []      // [waypointId] — done OR declined; prevents re-offer
```

After `createInitialState` assembles the rest, it calls `state = rollWaypoints(state)` to populate `waypoints`.

### `rollWaypoints(state)` — run-start roll

```js
const WAYPOINT_ROLL_PROB = 0.4;   // per non-final segment

export function rollWaypoints(state) {
  const nonFinalSegments = state.route.length - 1;  // 7 segments; segments 0..6, but segment 6 ends at the final destination — exclude it
  const eligibleSegments = nonFinalSegments - 1;    // 0..5 inclusive → 6 segments
  const used = new Set();
  const waypoints = [];
  for (let segmentIdx = 0; segmentIdx < eligibleSegments; segmentIdx++) {
    if (Math.random() < WAYPOINT_ROLL_PROB) {
      const candidates = WAYPOINTS.filter(w => !used.has(w.id));
      if (candidates.length === 0) break;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      used.add(pick.id);
      waypoints.push({ waypointId: pick.id, segmentIdx });
    }
  }
  return { ...state, waypoints };
}
```

**Segment indexing convention:** `segmentIdx` is the index of the route-leg you are ABOUT TO TRAVEL after arriving at `route[segmentIdx]`. So a waypoint with `segmentIdx: 2` is offered at arrival at the 3rd landmark (Arabia Terra) and its reward lands at the 4th (Meridiani Planum).

**Why exclude the final segment?** The last leg lands at Olympus Base which has no landmark-encounter (mission ends on arrival). Fitting a waypoint + reward + landmark-encounter into that window doesn't make narrative sense. Keep it clean.

**Expected density:** `6 × 0.4 = 2.4` waypoints/run on average. Variance: 0 with probability `0.6⁶ ≈ 4.7%`; all 6 with probability `0.4⁶ ≈ 0.4%`. Bell around 2–3.

### `acceptWaypoint(state, segmentIdx)` — player accepts the offer

```js
export function acceptWaypoint(state, segmentIdx) {
  const entry = state.waypoints.find(w => w.segmentIdx === segmentIdx);
  if (!entry) return state;  // defensive — shouldn't happen if offer was wired correctly
  const waypoint = WAYPOINTS.find(w => w.id === entry.waypointId);
  if (!waypoint) return state;
  return {
    ...state,
    pendingWaypoint:   { ...waypoint },
    kmToNextLandmark:  state.kmToNextLandmark + waypoint.detourKm,
    log: [...state.log, { sol: state.sol, text: `Diverting to ${waypoint.name}. +${waypoint.detourKm} km added.` }]
  };
}
```

### `declineWaypoint(state, waypointId)` — player declines

```js
export function declineWaypoint(state, waypointId) {
  return {
    ...state,
    firedWaypoints: [...state.firedWaypoints, waypointId],
    log: [...state.log, { sol: state.sol, text: 'Detour declined. Pressing on.' }]
  };
}
```

### `resolveWaypoint(state)` — called at landmark arrival if pending

```js
export function resolveWaypoint(state) {
  const w = state.pendingWaypoint;
  if (!w) return state;
  const fact = pickAdvancedFact(w);
  const jitteredSci = Math.round(w.sciencePoints * (1 + (Math.random() * 2 - 1) * 0.15));
  const newFactsLearned = fact && !state.factsLearned.includes(fact)
    ? [...state.factsLearned, fact]
    : state.factsLearned;
  return {
    ...state,
    sciencePoints:  state.sciencePoints + jitteredSci,
    factsLearned:   newFactsLearned,
    firedWaypoints: [...state.firedWaypoints, w.id],
    pendingWaypoint: null,
    log: [...state.log, { sol: state.sol, text: `${w.name}: sample returned. +${jitteredSci} SCI.` }],
    activeModal: { type: 'waypoint_reward', payload: { waypoint: w, sciencePointsGained: jitteredSci, fact } }
  };
}
```

## Travel integration — landmark arrival flow

In `advanceSol` (`src/systems/travel.js`), the landmark-arrival block currently:
1. Increments `currentLandmarkIndex`.
2. Logs the arrival.
3. Either sets `status: 'won'` (final destination) or opens a `landmark_encounter` modal.

**New sequence** (pseudocode; actual integration uses the existing `activeModal` pattern):

```js
// After incrementing currentLandmarkIndex and logging arrival:

if (s.currentLandmarkIndex >= s.route.length - 1) {
  // Final destination — unchanged, mission ends.
  s.status = 'won';
  ...
} else {
  // Set up next segment.
  s.kmToNextLandmark = s.routeKm[s.currentLandmarkIndex];

  // Step A: Resolve pending waypoint reward, if any.
  if (s.pendingWaypoint) {
    s = resolveWaypoint(s);
    // resolveWaypoint sets activeModal = waypoint_reward. Landmark modal chains after.
    // Store the pending landmark encounter on the state so it opens next.
    s._pendingLandmarkId = s.route[s.currentLandmarkIndex];
    return s;
  }

  // Step B: Offer waypoint for the NEXT segment, if one exists and not yet fired.
  const segmentWp = s.waypoints.find(w => w.segmentIdx === s.currentLandmarkIndex);
  if (segmentWp && !s.firedWaypoints.includes(segmentWp.waypointId)) {
    const waypoint = WAYPOINTS.find(w => w.id === segmentWp.waypointId);
    s.activeModal = { type: 'waypoint_offer', payload: { waypoint, segmentIdx: s.currentLandmarkIndex } };
    s._pendingLandmarkId = s.route[s.currentLandmarkIndex];
    return s;
  }

  // Step C: Normal landmark encounter.
  s.activeModal = { type: 'event', payload: makeLandmarkEncounter(arrivedId) };
}
```

**Modal chaining** uses a `_pendingLandmarkId` field on state. When the UI resolves a waypoint_reward or waypoint_offer modal (in `src/main.js`'s modal-dispatch), the handler checks for `_pendingLandmarkId` and opens the landmark_encounter next.

**Declined flow:** decline-handler calls `declineWaypoint(state, id)` and opens the pending landmark_encounter immediately.

**Accepted flow:** accept-handler calls `acceptWaypoint(state, segmentIdx)` (adding detour km) and opens the pending landmark_encounter so the current leg's stop plays out normally. Reward modal fires at the NEXT arrival.

## UI

### Waypoint-offer modal

```
┌────────────────────────────────────────┐
│   ⚡ ANOMALOUS SENSOR RETURN           │
│                                        │
│   [image — optional, 100×100]          │
│                                        │
│   Olivine Outcrop                      │
│                                        │
│   Sensors pinged Mg-rich olivine 40 km │
│   off-route. Volcanic history here     │
│   runs deeper than the literature      │
│   suggests.                            │
│                                        │
│   COST:   ~4 sols · +80 km detour      │
│   REWARD: ~50 SCI + advanced data      │
│                                        │
│   [ DIVERT → ]    [ CONTINUE ON ]      │
└────────────────────────────────────────┘
```

Rendered by `showWaypointOfferModal(waypoint, segmentIdx, onAccept, onDecline)` in `src/ui/modals.js`. Reuses existing `.modal-panel` classes; a distinct `.modal-severity.severity-waypoint` tag sits at the top with the "ANOMALOUS SENSOR RETURN" string.

### Waypoint-reward modal

```
┌────────────────────────────────────────┐
│   ⎋ DATA RECOVERED                     │
│                                        │
│   [image — optional]                   │
│                                        │
│   Olivine Outcrop — sample returned.   │
│                                        │
│   +52 SCI                              │
│                                        │
│   ⎋ ADVANCED DATA                      │
│   Olivine dissolution in Martian       │
│   brines produces hydrogen gas, which  │
│   microbial communities could use as   │
│   an electron donor — a chemo-         │
│   autotrophic niche.                   │
│                                        │
│   [ CONTINUE → ]                       │
└────────────────────────────────────────┘
```

One button. Reads data from `state.activeModal.payload`.

### Minimap waypoint markers

`src/render.js::renderMinimap` gets a new rendering step. For each entry in `state.waypoints`:

- Compute the segment's midpoint in minimap coordinates.
- Offset perpendicular to the segment by a fixed amount (e.g., 8 px) to render "off-route".
- Draw a small circle with a state-dependent class:
  - `.waypoint-marker.pending` — pulsing purple (CSS `@keyframes waypoint-pulse`).
  - `.waypoint-marker.accepted` — solid brighter purple, scaled +20%.
  - `.waypoint-marker.fired` — dim grey, no pulse.
- State detection logic:
  - `fired` if `state.firedWaypoints.includes(waypointId)`.
  - `accepted` if `state.pendingWaypoint?.id === waypointId`.
  - `pending` otherwise.

No click interaction on the marker — it's indicator-only. Decisions happen at landmark arrival via the offer modal.

### CSS

New rules at the end of `styles/components.css`:

```css
.waypoint-marker {
  position: absolute;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--waypoint, #cc88ff);
  transform: translate(-50%, -50%);
}
.waypoint-marker.pending {
  animation: waypoint-pulse 2s ease-in-out infinite;
}
.waypoint-marker.accepted {
  background: var(--waypoint-active, #ee99ff);
  width: 8px; height: 8px;
  box-shadow: 0 0 8px var(--waypoint-active, #ee99ff);
}
.waypoint-marker.fired {
  background: var(--fg-dim, #cc99cc);
  opacity: 0.3;
}
@keyframes waypoint-pulse {
  0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
  50%      { opacity: 1;   transform: translate(-50%, -50%) scale(1.4); }
}
```

Uses existing LCARS var fallback pattern.

## Validation

- **Manual:** Start a run. Observe minimap — expect 1–4 pulsing purple dots along the route. Arrive at a landmark that has a waypoint for the next segment — expect offer modal BEFORE landmark encounter. Accept — observe "+80 km detour" log line. Travel the extended segment. On arrival at next landmark — expect reward modal BEFORE landmark encounter, showing advanced fact and SCI gained. Verify the waypoint's minimap marker is now greyed out. Decline the NEXT offer — verify it greys out immediately and never re-prompts.
- **Automated (optional, in scope):** `sim/play.mjs` strategy "AlwaysAccept" can be added to the sim — accept every waypoint offer. Expected effect: average sols per run increases ~10 at push pace; SCI increases ~100. No regression to the pace-balance win-rate curve (waypoints are optional; declining should produce the same numbers as before this PR).

## Scope boundary

**Explicitly in scope:**
- Pre-rolled random pool of waypoints per run.
- Minimap markers with three visual states.
- Offer + reward modals.
- Advanced-facts pool separate from routine facts.
- Flat-cost detour (no skill checks, no hazards).

**Explicitly out of scope (defer to follow-ups):**
- Per-waypoint skill checks / hazard variety (brainstorm C).
- Career science progression across runs (Part 2 — separate issue/spec).
- Event tiers by experience (#8 — depends on Part 2).
- Hardcoded-per-segment flagship waypoints (brainstorm Q2 option A; revisit when content budget grows).
- Codex/encyclopedia highlighting "advanced" facts visually (can be a small follow-up once Part 2's codex UI work lands).

## Interaction with shipped features

- **v0.2.0 pace balance:** accepting a waypoint burns more life support (extra sols × `LIFE_SUPPORT_MULT_BY_PACE[pace]`). A cautious run that accepts all 4+ waypoints may push into O₂-critical territory — intended tension.
- **v0.3.0 scoring:** waypoint SCI rolls into the end-of-run science total, which rewards accepting waypoints with +points on the rank breakdown. No special scoring category — advanced SCI is just SCI.
- **Event system:** waypoint_offer and waypoint_reward are NEW modal types. They do NOT replace or modify the existing `event` modal type. Routine-event flow is unchanged.

## Sequencing

Two or three atomic commits on `feat/science-waypoints`:

1. Content + pure systems: `src/content/waypoints.js`, `src/content/advancedFacts.js`, `src/systems/waypoints.js`. State shape additions. Closes most of the backend.
2. Travel + modal integration: `src/systems/travel.js` arrival flow, `src/ui/modals.js` offer/reward renderers, `src/main.js` modal-dispatch wiring.
3. Minimap + styling: `src/render.js` waypoint markers, `styles/components.css` rules.

After merge: tag `v0.4.0` (minor — new feature, no breaking changes), GitHub Release summarizing waypoints. Bump `package.json` version in the last commit so the title screen auto-reflects it.
