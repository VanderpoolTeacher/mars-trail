# Science Waypoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional, costly side-expedition waypoints to each run. Players can detour from the main route for exclusive advanced Mars facts and a chunky SCI bonus.

**Architecture:** Random pool of ~12 waypoints pre-rolled at run start. Offer modal fires at each landmark arrival if the upcoming segment has a rolled waypoint. Accept adds km to the segment; reward (advanced fact + SCI) lands at the next landmark. Declines are permanent. No skill checks.

**Tech Stack:** Vanilla ES modules. `node --test` for unit tests. No new dependencies.

**Related:** Spec at `docs/superpowers/specs/2026-04-16-science-waypoints-design.md`. Closes Part 1 of issue #7. Ships as `v0.4.0`. Part 2 (career progression) will be a separate spec/plan/PR.

---

## File Structure

**Create:**
- `src/content/waypoints.js` — pure data pool (`WAYPOINTS` array, 12 entries).
- `src/content/advancedFacts.js` — advanced fact pools (5–8 per category, 4 categories = ~24 facts).
- `src/systems/waypoints.js` — pure functions: `rollWaypoints`, `acceptWaypoint`, `declineWaypoint`, `resolveWaypoint`, plus helper `WAYPOINT_ROLL_PROB`.
- `sim/waypoints.test.mjs` — Node `--test` unit tests for the pure systems.

**Modify:**
- `src/state.js` — add three fields to `createInitialState()`; call `rollWaypoints` at the end.
- `src/systems/travel.js` — extend landmark-arrival block in `advanceSol` to handle waypoint reward + offer before landmark encounter.
- `src/ui/modals.js` — add `showWaypointOfferModal` and `showWaypointRewardModal` renderers.
- `src/main.js` — add two modal-dispatch branches (`waypoint_offer`, `waypoint_reward`).
- `src/render.js` — extend `renderMinimap` to draw waypoint markers.
- `styles/components.css` — waypoint marker styles + pulse animation.
- `package.json` — bump version to `0.4.0` in the final commit.

**Untouched:** `src/systems/events.js`, `src/systems/scoring.js`, `sim/play.mjs`, `sim/scoring.test.mjs`.

---

## Task 1: Waypoint + advanced-fact content

**Files:**
- Create: `src/content/waypoints.js`
- Create: `src/content/advancedFacts.js`

Pure data. No logic. No tests for this task — content files are self-explanatory and get exercised by subsequent tasks.

- [ ] **Step 1: Write `src/content/waypoints.js`**

```js
// Mars Trail — science waypoint pool (issue #7 part 1).
// Side-expeditions detected off the main route. Accepting a waypoint
// adds detourKm to the current segment and grants a reward (advanced
// fact + jittered sciencePoints) on arrival at the next landmark.
//
// Each entry:
//   id             unique string
//   name           short display name
//   briefing       1–2 sentences shown in the offer modal
//   detourKm       km added to the segment when accepted
//   detourSols     estimate shown in the offer (not enforced)
//   sciencePoints  reward before jitter
//   factPool       'GEOLOGY' | 'WATER' | 'ATMOSPHERE' | 'ASTROBIOLOGY'

export const WAYPOINTS = [
  {
    id: 'olivine_outcrop',
    name: 'Olivine Outcrop',
    briefing: 'Sensors pinged Mg-rich olivine 40 km north. Primitive volcanic rock, nearly unweathered — volcanic history here runs deeper than the literature suggests.',
    detourKm: 80, detourSols: 3, sciencePoints: 50, factPool: 'GEOLOGY'
  },
  {
    id: 'subsurface_ice',
    name: 'Subsurface Ice Lens',
    briefing: 'Ground-penetrating radar shows a shallow ice lens under a nearby ridge. A core sample could resolve the age debate.',
    detourKm: 60, detourSols: 3, sciencePoints: 55, factPool: 'WATER'
  },
  {
    id: 'lander_wreckage',
    name: 'Lander Wreckage Site',
    briefing: 'Catalog says a Soviet probe went silent in this region in 1971. The crash site might still hold recoverable data tapes.',
    detourKm: 100, detourSols: 4, sciencePoints: 60, factPool: 'GEOLOGY'
  },
  {
    id: 'rsl_observation',
    name: 'Recurring Slope Lineae',
    briefing: 'Dark streaks on a south-facing slope — possible transient briny flows. Seasonal timing lines up. Worth a close look.',
    detourKm: 70, detourSols: 3, sciencePoints: 55, factPool: 'WATER'
  },
  {
    id: 'polar_layered',
    name: 'Polar Layered Transect',
    briefing: 'A cliff face exposes millions of years of ice-dust layering. A vertical transect would read like tree rings for Mars climate.',
    detourKm: 90, detourSols: 4, sciencePoints: 55, factPool: 'ATMOSPHERE'
  },
  {
    id: 'methane_seep',
    name: 'Methane Plume',
    briefing: 'Atmospheric sensors flagged an intermittent methane pocket nearby. Source unknown — biogenic or geological? Either answer changes everything.',
    detourKm: 75, detourSols: 3, sciencePoints: 60, factPool: 'ASTROBIOLOGY'
  },
  {
    id: 'lava_tube',
    name: 'Lava Tube Entrance',
    briefing: 'A collapsed pit nearby opens into an intact lava tube. Radiation-shielded interior — candidate site for future habitat surveys.',
    detourKm: 85, detourSols: 4, sciencePoints: 55, factPool: 'GEOLOGY'
  },
  {
    id: 'banded_deposit',
    name: 'Banded Sedimentary Deposit',
    briefing: 'Layered clays and sulfates exposed along a crater wall. Wet-era chemistry preserved in the banding pattern.',
    detourKm: 65, detourSols: 3, sciencePoints: 50, factPool: 'WATER'
  },
  {
    id: 'dust_devil_corridor',
    name: 'Dust-Devil Corridor',
    briefing: 'Tracks in the regolith mark a high-frequency dust-devil path. Electrostatic sensor deployment would log the charge profile in real time.',
    detourKm: 55, detourSols: 2, sciencePoints: 45, factPool: 'ATMOSPHERE'
  },
  {
    id: 'meteorite_field',
    name: 'Meteorite Field',
    briefing: 'MRO imagery shows a scatter of iron-nickel meteorites — preserved here because Mars has no plate tectonics to recycle them.',
    detourKm: 70, detourSols: 3, sciencePoints: 50, factPool: 'GEOLOGY'
  },
  {
    id: 'ancient_rille',
    name: 'Ancient River Rille',
    briefing: 'A dry channel network carved into basalt. The junction angles suggest sustained fluvial flow, not catastrophic outflow.',
    detourKm: 80, detourSols: 3, sciencePoints: 55, factPool: 'WATER'
  },
  {
    id: 'biosig_deposit',
    name: 'Potential Biosignature Deposit',
    briefing: 'Ancient lakebed sediments with organic carbon concentrations just above instrument noise. Confirming would be the find of the century.',
    detourKm: 95, detourSols: 4, sciencePoints: 70, factPool: 'ASTROBIOLOGY'
  }
];
```

- [ ] **Step 2: Write `src/content/advancedFacts.js`**

```js
// Mars Trail — advanced Mars facts, reachable only via science waypoints.
// Routine event-driven facts live in src/content/marsFacts.js; these
// exist in a separate namespace so the player can distinguish
// waypoint-earned content in the codex.

export const ADVANCED_GEOLOGY_FACTS = [
  "Olivine (Mg,Fe)2SiO4 is thermodynamically unstable in the presence of liquid water. Its widespread preservation on Mars is one of the strongest constraints on how DRY the surface has been for most of Martian history — much drier than the Amazonian fluvial features alone would imply.",
  "Mars's banded iron formations — if confirmed — would be some of the oldest sedimentary rocks in the solar system. Similar formations on Earth mark the Great Oxidation Event; their Martian analogs would require either transient oxygen or a fundamentally different iron-cycling chemistry.",
  "Perseverance's SHERLOC instrument has detected organic compounds in Jezero Crater sediments, but distinguishing biotic from abiotic origin requires context that can only come from sample return. Every waypoint sample you log narrows the interpretation window.",
  "The Tharsis volcanic complex is so massive (roughly 2% of Mars's total mass) that it physically reoriented the planet's spin axis. The current poles are not where they would be without Tharsis.",
  "Mars's oldest preserved rocks are ~4.4 billion years old — older than any rocks on Earth. Earth's plate tectonics recycled its earliest crust; Mars's lack of plates froze its ancient surface in place.",
  "Iron-nickel meteorites on Mars survive erosion longer than silicate rocks because oxidation proceeds more slowly in the thin atmosphere. Some 'Martian' meteorites we collect have been on the surface for >1 million years."
];

export const ADVANCED_WATER_FACTS = [
  "Subsurface ice on Mars isn't just locked in permafrost — radar reveals 'pore ice' dispersed through regolith at depths from 1 meter to several hundred meters. Extracting it for a crewed base is far more efficient than electrolysis from atmospheric CO2.",
  "Recurring slope lineae (RSL) flow DOWNHILL seasonally, but their composition is debated. Perchlorate brines would remain liquid well below 0°C; granular flows would not need liquid at all. The current consensus leans dry — but nobody's taken a direct sample.",
  "Polar layered deposits preserve a 4-million-year climate record in alternating ice and dust bands. Sampling a vertical transect would resolve Mars's obliquity-driven ice-age cycles with unprecedented resolution.",
  "The Valles Marineris canyon system shows water-carved tributaries on its walls — but the main canyon is tectonic, not fluvial. Mars eroded its own Grand Canyon into an older rift.",
  "Ancient rille networks near the equator show a power-law relationship between tributary count and main-channel width. This is characteristic of sustained rainfall, not catastrophic flooding — a data point in favor of a once-warmer Mars.",
  "Banded iron-sulfur deposits require cycling oxidation states. On Earth that's usually biological. On Mars it's the unresolved question of the decade."
];

export const ADVANCED_ATMOSPHERE_FACTS = [
  "Mars's polar ice caps are ~85% CO2 ice seasonally and ~100% water ice at the base. During summer at each pole, enough CO2 sublimates to change global atmospheric pressure by ~25%.",
  "Dust devils on Mars reach 8 km tall and can persist for hours. Their electrostatic discharges — up to 20 kV/m — complicate any EVA near active corridors.",
  "The Martian ionosphere has its own weather, driven by solar wind penetration through the weak magnetic field. Radio blackouts during solar events can last longer than any telecom redundancy plans account for.",
  "Methane on Mars varies seasonally in ways that are genuinely unexplained. Curiosity has measured it; the Trace Gas Orbiter has looked for it in the upper atmosphere and can't find it — the discrepancy is the mystery.",
  "Argon-36/argon-38 isotopic ratios in the atmosphere are 40% of the solar nebula value. That number tells us Mars has lost ~60% of its original atmosphere to space over 4 billion years.",
  "Dust-storm-suspended particles on Mars carry ~10× more static charge per unit mass than terrestrial dust. A global dust storm is an electrical hazard, not just an optical one."
];

export const ADVANCED_ASTROBIOLOGY_FACTS = [
  "Perchlorate salts are abundant in Martian regolith (up to 1% by mass). Perchlorates depress water's freezing point to -70°C — making liquid brines plausible even at mid-latitudes — but they're also cytotoxic, complicating any biosignature interpretation and any crew food-safety protocol.",
  "The best candidate locations for preserved microbial biosignatures on Mars are not where liquid water currently exists — they're where liquid water existed 3.5 billion years ago AND subsequent conditions were stable (no ionizing radiation at depth, no repeated freeze-thaw). Jezero's lake-delta sediments fit this profile precisely.",
  "If life ever existed on Mars, the strongest expected biosignature isn't a fossil — it's an isotopic anomaly. Life fractionates carbon and sulfur isotopes in patterns that purely geological processes rarely match. Detecting a δ13C anomaly in a waypoint sample would rewrite every textbook.",
  "Lava tubes on Mars are the most radiation-shielded natural environments known off-Earth. Surface cosmic-ray exposure runs ~250 mSv/year; a few meters of basalt roof cuts that by >99%. Any long-duration microbial survival would have happened underground.",
  "Mars atmospheric methane COULD be biogenic. It could also be serpentinization, cometary delivery, or Mars-clathrate release. The scientific community has been unable to rule out biology for 20 years. Every new waypoint measurement matters.",
  "Chirality — the handedness of organic molecules — is the cleanest biosignature available. Non-living processes produce 50/50 racemic mixtures; life produces enantiomer-biased distributions. A single waypoint sample with detectable chirality bias would be historic."
];
```

- [ ] **Step 3: Verify files parse**

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node -e 'import("./src/content/waypoints.js").then(m => console.log("waypoints:", m.WAYPOINTS.length)); import("./src/content/advancedFacts.js").then(m => console.log("pools:", Object.keys(m).length))'`

Expected:
```
waypoints: 12
pools: 4
```

- [ ] **Step 4: Commit**

```bash
git add src/content/waypoints.js src/content/advancedFacts.js
git commit -m "$(cat <<'EOF'
Add waypoint pool + advanced Mars-fact pools (refs #7 part 1)

12 authored waypoints covering geology, water, atmosphere, and
astrobiology themes. Each has a detour cost (km + est. sols), a
sciencePoints reward, and a fact pool reference. Advanced facts
(~6 per category, 24 total) live in a parallel namespace so they
only surface via waypoints — never via routine events.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Pure systems + state + tests

**Files:**
- Create: `src/systems/waypoints.js`
- Create: `sim/waypoints.test.mjs`
- Modify: `src/state.js`

TDD: write tests first for each pure function. Implement. Verify. Commit.

- [ ] **Step 1: Write the test file**

Create `sim/waypoints.test.mjs`:

```js
// Tests for src/systems/waypoints.js. Run: node --test sim/waypoints.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WAYPOINTS } from '../src/content/waypoints.js';
import {
  rollWaypoints,
  acceptWaypoint,
  declineWaypoint,
  resolveWaypoint,
  WAYPOINT_ROLL_PROB
} from '../src/systems/waypoints.js';

// --- Helper: minimal state shape used by the waypoint functions ---
function makeState(overrides = {}) {
  return {
    status: 'active',
    sol: 1,
    route: ['jezero','syrtis','arabia','meridiani','gale','elysium','tharsis','olympus_base'],
    routeKm: [330, 420, 290, 360, 460, 315, 375],
    currentLandmarkIndex: 0,
    kmToNextLandmark: 330,
    sciencePoints: 0,
    factsLearned: [],
    waypoints: [],
    pendingWaypoint: null,
    firedWaypoints: [],
    log: [],
    ...overrides
  };
}

// --- rollWaypoints ---

test('rollWaypoints produces 0–6 waypoints on a standard route', () => {
  // With 40% probability × 6 eligible segments, every sample lies in 0..6.
  for (let i = 0; i < 50; i++) {
    const s = rollWaypoints(makeState());
    assert.ok(s.waypoints.length >= 0 && s.waypoints.length <= 6,
      `waypoints.length=${s.waypoints.length} out of range`);
    // No duplicate segmentIdx
    const segs = s.waypoints.map(w => w.segmentIdx);
    assert.equal(new Set(segs).size, segs.length, 'duplicate segmentIdx');
    // No duplicate waypoint id
    const ids = s.waypoints.map(w => w.waypointId);
    assert.equal(new Set(ids).size, ids.length, 'duplicate waypoint id');
    // segmentIdx never points to the final leg (index = route.length - 2 is the last eligible)
    for (const entry of s.waypoints) {
      assert.ok(entry.segmentIdx < s.route.length - 2,
        `segmentIdx ${entry.segmentIdx} should be < ${s.route.length - 2}`);
    }
  }
});

test('rollWaypoints gives every segment a fair chance over many runs', () => {
  // Force RNG-friendly expectation: over 200 runs, each eligible segment
  // should have a waypoint at least a few times.
  const counts = Array(6).fill(0);
  for (let i = 0; i < 200; i++) {
    const s = rollWaypoints(makeState());
    for (const w of s.waypoints) counts[w.segmentIdx]++;
  }
  for (let idx = 0; idx < 6; idx++) {
    assert.ok(counts[idx] > 10, `segment ${idx} rarely rolled (count=${counts[idx]})`);
  }
});

test('rollWaypoints respects WAYPOINT_ROLL_PROB exported constant', () => {
  assert.equal(typeof WAYPOINT_ROLL_PROB, 'number');
  assert.ok(WAYPOINT_ROLL_PROB > 0 && WAYPOINT_ROLL_PROB < 1);
});

// --- acceptWaypoint ---

test('acceptWaypoint sets pendingWaypoint and extends the segment', () => {
  const s0 = makeState({
    waypoints: [{ waypointId: 'olivine_outcrop', segmentIdx: 0 }]
  });
  const s1 = acceptWaypoint(s0, 0);
  assert.equal(s1.pendingWaypoint?.id, 'olivine_outcrop');
  assert.equal(s1.kmToNextLandmark, 330 + 80);  // olivine_outcrop.detourKm = 80
  assert.ok(s1.log.some(l => l.text.includes('Diverting')));
});

test('acceptWaypoint is a no-op when no matching segment', () => {
  const s0 = makeState({ waypoints: [] });
  const s1 = acceptWaypoint(s0, 0);
  assert.equal(s1, s0);
});

// --- declineWaypoint ---

test('declineWaypoint pushes the waypoint id to firedWaypoints', () => {
  const s0 = makeState({ firedWaypoints: [] });
  const s1 = declineWaypoint(s0, 'olivine_outcrop');
  assert.deepEqual(s1.firedWaypoints, ['olivine_outcrop']);
  assert.equal(s1.pendingWaypoint, null);
  assert.ok(s1.log.some(l => l.text.includes('Detour declined')));
});

// --- resolveWaypoint ---

test('resolveWaypoint grants SCI, adds fact, and queues a reward modal', () => {
  const olivine = WAYPOINTS.find(w => w.id === 'olivine_outcrop');
  const s0 = makeState({
    pendingWaypoint: { ...olivine },
    sciencePoints: 10,
    factsLearned: []
  });
  const s1 = resolveWaypoint(s0);
  assert.ok(s1.sciencePoints > 10, 'sciencePoints should increase');
  assert.ok(s1.sciencePoints <= 10 + Math.ceil(olivine.sciencePoints * 1.15 + 0.5),
    'sciencePoints within jittered bound');
  assert.equal(s1.factsLearned.length, 1, 'one advanced fact learned');
  assert.ok(s1.firedWaypoints.includes('olivine_outcrop'));
  assert.equal(s1.pendingWaypoint, null);
  assert.equal(s1.activeModal?.type, 'waypoint_reward');
  assert.ok(s1.activeModal.payload.waypoint);
  assert.ok(typeof s1.activeModal.payload.fact === 'string');
  assert.ok(typeof s1.activeModal.payload.sciencePointsGained === 'number');
});

test('resolveWaypoint is a no-op when no pendingWaypoint', () => {
  const s0 = makeState({ pendingWaypoint: null });
  const s1 = resolveWaypoint(s0);
  assert.equal(s1, s0);
});
```

- [ ] **Step 2: Run tests — should fail on import**

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node --test sim/waypoints.test.mjs`

Expected: All tests fail with `Cannot find module '../src/systems/waypoints.js'`.

- [ ] **Step 3: Create `src/systems/waypoints.js`**

```js
// Mars Trail — science waypoints system (issue #7 part 1).
// Pure functions over state. No DOM, no localStorage, no side effects.

import { WAYPOINTS } from '../content/waypoints.js';
import {
  ADVANCED_GEOLOGY_FACTS,
  ADVANCED_WATER_FACTS,
  ADVANCED_ATMOSPHERE_FACTS,
  ADVANCED_ASTROBIOLOGY_FACTS
} from '../content/advancedFacts.js';

export const WAYPOINT_ROLL_PROB = 0.4;   // per non-final segment
const SCIENCE_JITTER_FRAC = 0.15;

const ADVANCED_POOLS = {
  GEOLOGY:      ADVANCED_GEOLOGY_FACTS,
  WATER:        ADVANCED_WATER_FACTS,
  ATMOSPHERE:   ADVANCED_ATMOSPHERE_FACTS,
  ASTROBIOLOGY: ADVANCED_ASTROBIOLOGY_FACTS
};

// ---- Run-start roll ----
// Picks at most one waypoint per eligible segment (every segment except the
// final one, which lands at the destination and has no landmark encounter).
export function rollWaypoints(state) {
  const eligibleSegments = state.route.length - 2;  // e.g. 8 landmarks → 6 eligible
  const used = new Set();
  const waypoints = [];
  for (let segmentIdx = 0; segmentIdx < eligibleSegments; segmentIdx++) {
    if (Math.random() >= WAYPOINT_ROLL_PROB) continue;
    const candidates = WAYPOINTS.filter(w => !used.has(w.id));
    if (candidates.length === 0) break;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    used.add(pick.id);
    waypoints.push({ waypointId: pick.id, segmentIdx });
  }
  return { ...state, waypoints };
}

// ---- Player accepts the offer ----
export function acceptWaypoint(state, segmentIdx) {
  const entry = state.waypoints.find(w => w.segmentIdx === segmentIdx);
  if (!entry) return state;
  const waypoint = WAYPOINTS.find(w => w.id === entry.waypointId);
  if (!waypoint) return state;
  return {
    ...state,
    pendingWaypoint: { ...waypoint },
    kmToNextLandmark: state.kmToNextLandmark + waypoint.detourKm,
    log: [
      ...state.log,
      { sol: state.sol, text: `Diverting to ${waypoint.name}. +${waypoint.detourKm} km added.` }
    ]
  };
}

// ---- Player declines the offer ----
export function declineWaypoint(state, waypointId) {
  return {
    ...state,
    firedWaypoints: [...state.firedWaypoints, waypointId],
    log: [
      ...state.log,
      { sol: state.sol, text: 'Detour declined. Pressing on.' }
    ]
  };
}

// ---- Detour reached: apply reward, queue reward modal ----
export function resolveWaypoint(state) {
  const w = state.pendingWaypoint;
  if (!w) return state;
  const pool = ADVANCED_POOLS[w.factPool] || [];
  const fact = pool.length ? pool[Math.floor(Math.random() * pool.length)] : '';
  const jitter = 1 + (Math.random() * 2 - 1) * SCIENCE_JITTER_FRAC;
  const sciencePointsGained = Math.max(0, Math.round(w.sciencePoints * jitter));

  const alreadyLearned = fact && state.factsLearned.includes(fact);
  const factsLearned = fact && !alreadyLearned
    ? [...state.factsLearned, fact]
    : state.factsLearned;

  return {
    ...state,
    sciencePoints: state.sciencePoints + sciencePointsGained,
    factsLearned,
    firedWaypoints: [...state.firedWaypoints, w.id],
    pendingWaypoint: null,
    log: [
      ...state.log,
      { sol: state.sol, text: `${w.name}: sample returned. +${sciencePointsGained} SCI.` }
    ],
    activeModal: {
      type: 'waypoint_reward',
      payload: { waypoint: w, sciencePointsGained, fact }
    }
  };
}
```

- [ ] **Step 4: Run tests — all should pass**

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node --test sim/waypoints.test.mjs`

Expected: `# tests 8`, `# pass 8`, `# fail 0`.

- [ ] **Step 5: Add state-shape fields and wire rollWaypoints**

Open `src/state.js`. Find the `createInitialState` function. Add three fields near the existing `firedEvents: []` line:

Find:
```js
    firedEvents: [],   // IDs of one-shot events already triggered this run
```

Add directly after:
```js
    waypoints:       [],    // [{ waypointId, segmentIdx }] — rolled at run start
    pendingWaypoint: null,  // full waypoint object while detour is in progress
    firedWaypoints:  [],    // ids already resolved or declined
```

Then, at the top of the file, add the import:
```js
import { rollWaypoints } from './systems/waypoints.js';
```

At the end of `createInitialState`, just before the function's `return` statement, wrap the return value with `rollWaypoints`:

Find the return statement (ends with `};`) and change:
```js
  return {
    schemaVersion: 1,
    ...
    activeModal: { type: 'title' }
  };
}
```

to:
```js
  const baseState = {
    schemaVersion: 1,
    ...
    activeModal: { type: 'title' }
  };
  return rollWaypoints(baseState);
}
```

- [ ] **Step 6: Verify the existing sim harness still runs**

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node sim/play.mjs | head -5`

Expected: sim runs without errors, prints the header + some rows. The `rollWaypoints` call in `createInitialState` shouldn't break anything because waypoints are inert until travel.js integrates them (Task 3).

- [ ] **Step 7: Run both test suites for sanity**

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node --test sim/waypoints.test.mjs sim/scoring.test.mjs 2>&1 | tail -5`

Expected: `pass 19` (8 waypoint + 11 scoring).

- [ ] **Step 8: Commit**

```bash
git add src/systems/waypoints.js sim/waypoints.test.mjs src/state.js
git commit -m "$(cat <<'EOF'
Add waypoint systems, state fields, and tests (refs #7 part 1)

Pure functions — rollWaypoints, acceptWaypoint, declineWaypoint,
resolveWaypoint — plus 8 TDD tests covering run-start rolling,
accept/decline side effects, and reward resolution with advanced
fact + jittered SCI. State gains waypoints, pendingWaypoint, and
firedWaypoints fields; createInitialState calls rollWaypoints to
populate them.

No UI or travel integration yet — that's the next task.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Travel integration — landmark-arrival flow

**Files:**
- Modify: `src/systems/travel.js` (extend the landmark-arrival block in `advanceSol`)

- [ ] **Step 1: Read the current landmark-arrival block**

Run: `grep -n "kmToNextLandmark === 0\|Final destination\|currentLandmarkIndex += 1" src/systems/travel.js`

Note the line numbers. The landmark-arrival block currently lives inside `advanceSol` (around lines 165–195). You will extend this block in Step 3.

- [ ] **Step 2: Add imports and helper reference at the top of `src/systems/travel.js`**

Open `src/systems/travel.js`. Find the existing import block (near the top) and add:

```js
import { WAYPOINTS } from '../content/waypoints.js';
import { resolveWaypoint } from './waypoints.js';
```

- [ ] **Step 3: Replace the landmark-arrival block**

Find the existing block starting with `if (s.kmToNextLandmark === 0) {` inside `advanceSol`. Replace the entire block (through the closing `}` that matches that `if`) with this:

```js
    if (s.kmToNextLandmark === 0) {
      s.currentLandmarkIndex += 1;
      const arrivedId = s.route[s.currentLandmarkIndex];
      s.log.push({ sol: s.sol, text: `Arrived at ${landmarkName(arrivedId)} before dusk. Parking for EVA prep.` });

      if (s.currentLandmarkIndex >= s.route.length - 1) {
        // Final destination — no stop encounter, mission complete.
        s.status = 'won';
        const survived = s.crew.filter(c => c.alive).length;
        s.log.push({ sol: s.sol, text: `Mission accomplished. ${survived}/${s.crew.length} crew survived.` });
      } else {
        // Set up the next segment's base distance.
        s.kmToNextLandmark = s.routeKm[s.currentLandmarkIndex];

        // Step A — If a waypoint detour was in progress, fire the reward modal.
        // It will chain to the offer (or the landmark encounter) when dismissed.
        if (s.pendingWaypoint) {
          s = resolveWaypoint(s);
          return s;
        }

        // Step B — If this segment has a rolled waypoint not yet offered, open the offer.
        const segmentWp = s.waypoints.find(w => w.segmentIdx === s.currentLandmarkIndex);
        if (segmentWp && !s.firedWaypoints.includes(segmentWp.waypointId)) {
          const waypoint = WAYPOINTS.find(w => w.id === segmentWp.waypointId);
          if (waypoint) {
            s.activeModal = {
              type: 'waypoint_offer',
              payload: { waypoint, segmentIdx: s.currentLandmarkIndex }
            };
            return s;
          }
        }

        // Step C — Normal landmark encounter.
        s.activeModal = { type: 'event', payload: makeLandmarkEncounter(arrivedId) };
      }
    } else {
```

(The `} else {` at the end preserves the existing `else` branch that handles travel-phrase logging when the rover didn't arrive this sol — do not modify that branch.)

- [ ] **Step 4: Run all tests — should all pass**

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node --test sim/*.test.mjs 2>&1 | tail -3`

Expected: `pass 19`, `fail 0`.

- [ ] **Step 5: Smoke-test the sim**

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node sim/play.mjs 2>&1 | head -20`

Expected: sim runs without errors. You may see slightly unusual numbers (e.g., longer sols if the sim's strategies happen to accept waypoints when the modal fires) — but no exceptions.

NOTE: the sim's strategies don't handle `waypoint_offer`/`waypoint_reward` modals yet. The sim's game-loop treats any `activeModal` as an event and calls `applyEventChoice`, which will fail silently on a non-event modal (returns state unchanged). That means the sim will loop forever on a waypoint offer — the game won't progress.

To keep the sim from stalling, do a quick patch in Step 6.

- [ ] **Step 6: Patch the sim's game loop to ignore waypoint modals**

Open `sim/play.mjs`. Find the main game loop inside `playGame`. Locate:

```js
    // Resolve any open event modal FIRST.
    if (s.activeModal && s.activeModal.type === 'event') {
      const event = s.activeModal.payload;
      const idx = pickChoice(s, event);
      const { state: next } = applyEventChoice(s, event, idx);
      s = next;
      continue;
    }
```

Add immediately after this block (but before the maintenance + advanceSol calls):

```js
    // Waypoints: sim always declines (sim treats them as overhead, not strategy).
    // A future sim iteration could add an AcceptAll strategy; not in scope here.
    if (s.activeModal && s.activeModal.type === 'waypoint_offer') {
      s = { ...s, firedWaypoints: [...s.firedWaypoints, s.activeModal.payload.waypoint.id], activeModal: null };
      continue;
    }
    if (s.activeModal && s.activeModal.type === 'waypoint_reward') {
      s = { ...s, activeModal: null };
      continue;
    }
```

- [ ] **Step 7: Confirm sim still prints a 12-row table and pace bands hold**

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node sim/play.mjs 2>&1 | tail -13`

Expected: 12 rows. Balanced / cautious / steady / push rows stay near the v0.3.0 values (cautious ~70%, steady ~60%, push ~50%) because the sim declines every waypoint → no behavior change from waypoint rolls.

If win rates have shifted by more than a few pp, that's a regression — stop and report.

- [ ] **Step 8: Commit**

```bash
git add src/systems/travel.js sim/play.mjs
git commit -m "$(cat <<'EOF'
Integrate waypoint offer and reward into advanceSol (refs #7 part 1)

Landmark-arrival block now fires a waypoint_reward modal if a detour
was pending, then a waypoint_offer modal if the next segment has a
rolled waypoint, and falls through to the normal landmark encounter
otherwise. Modal chaining is handled by main.js in the next task.

Patches the sim harness to decline every waypoint — prevents the
game loop from stalling on the new modal types until the sim
grows a real waypoint strategy.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Modal renderers + main.js dispatch

**Files:**
- Modify: `src/ui/modals.js` (add two new modal renderers)
- Modify: `src/main.js` (add two modal-type dispatch branches)

- [ ] **Step 1: Add the two modal renderers to `src/ui/modals.js`**

Open `src/ui/modals.js`. At the end of the file (before any trailing exports), add:

```js
// ---- Waypoint offer modal (issue #7 part 1) ----

export function showWaypointOfferModal(waypoint, { onAccept, onDecline }) {
  const r = root();
  if (!r) return;

  const imgBlock = waypoint.image
    ? `<img class="modal-image" src="${waypoint.image}" alt="" />`
    : '';

  r.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-panel modal-waypoint-offer" role="dialog" aria-modal="true">
        <div class="modal-severity severity-waypoint">⚡ ANOMALOUS SENSOR RETURN</div>
        <h2 class="modal-title">${escapeHtml(waypoint.name)}</h2>
        ${imgBlock}
        <p class="modal-description">${escapeHtml(waypoint.briefing)}</p>
        <div class="waypoint-costs">
          <div class="waypoint-cost"><span class="wp-label">COST</span><span class="wp-value">~${waypoint.detourSols} sols · +${waypoint.detourKm} km</span></div>
          <div class="waypoint-cost"><span class="wp-label">REWARD</span><span class="wp-value">~${waypoint.sciencePoints} SCI + advanced data</span></div>
        </div>
        <div class="modal-choices">
          <button class="modal-choice primary" id="wp-accept" type="button">DIVERT →</button>
          <button class="modal-choice" id="wp-decline" type="button">CONTINUE ON</button>
        </div>
      </div>
    </div>
  `;
  r.querySelector('#wp-accept').addEventListener('click', onAccept);
  r.querySelector('#wp-decline').addEventListener('click', onDecline);
}

// ---- Waypoint reward modal (issue #7 part 1) ----

export function showWaypointRewardModal(payload, onContinue) {
  const r = root();
  if (!r) return;

  const { waypoint, sciencePointsGained, fact } = payload;
  const imgBlock = waypoint.image
    ? `<img class="modal-image" src="${waypoint.image}" alt="" />`
    : '';
  const factBlock = fact
    ? `
      <div class="waypoint-fact">
        <div class="waypoint-fact-label">⎋ ADVANCED DATA</div>
        <p>${linkifyCodex(escapeHtml(fact))}</p>
      </div>`
    : '';

  r.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-panel modal-waypoint-reward" role="dialog" aria-modal="true">
        <div class="modal-severity severity-waypoint">⎋ DATA RECOVERED</div>
        <h2 class="modal-title">${escapeHtml(waypoint.name)}</h2>
        ${imgBlock}
        <p class="modal-description">Sample returned. Crew back aboard, data logged.</p>
        <div class="waypoint-sci">+${sciencePointsGained} SCI</div>
        ${factBlock}
        <button class="modal-continue primary" id="wp-continue" type="button">CONTINUE →</button>
      </div>
    </div>
  `;
  r.querySelector('#wp-continue').addEventListener('click', onContinue);
}
```

- [ ] **Step 2: Add dispatch branches in `src/main.js`**

Open `src/main.js`. Find the line `import { showEventModal, showOutcomeModal, ... } from './ui/modals.js';` and extend:

```js
import { showEventModal, showOutcomeModal, showBriefingModal, showLoadoutModal, showTitleLayer, dimTitleStart, hideTitleLayer, showEndOfRunModal, closeModal, showWaypointOfferModal, showWaypointRewardModal } from './ui/modals.js';
```

Also add these imports near the top:

```js
import { acceptWaypoint, declineWaypoint } from './systems/waypoints.js';
import { WAYPOINTS } from './content/waypoints.js';
import { makeLandmarkEncounter } from './content/landmarks.js';
```

(The existing file already imports `makeLandmarkEncounter` indirectly via `travel.js`, but we need a direct reference here to chain into the landmark encounter after a waypoint modal. If `src/content/landmarks.js` doesn't export `makeLandmarkEncounter`, check its exports and adjust the import to match.)

- [ ] **Step 3: Add the two dispatch branches**

In `src/main.js`, find the block that handles event modals:

```js
  if (modal.type === 'event') {
    const event = modal.payload;
    showEventModal(event, (choiceIdx) => {
      ...
    });
    return;
  }
```

Directly ABOVE this block, add:

```js
  if (modal.type === 'waypoint_offer') {
    const { waypoint, segmentIdx } = modal.payload;
    showWaypointOfferModal(waypoint, {
      onAccept: () => {
        state = acceptWaypoint(state, segmentIdx);
        // Chain: proceed to the landmark encounter for the CURRENT arrival.
        const arrivedId = state.route[state.currentLandmarkIndex];
        state = { ...state, activeModal: { type: 'event', payload: makeLandmarkEncounter(arrivedId) } };
        renderAll();
      },
      onDecline: () => {
        state = declineWaypoint(state, waypoint.id);
        const arrivedId = state.route[state.currentLandmarkIndex];
        state = { ...state, activeModal: { type: 'event', payload: makeLandmarkEncounter(arrivedId) } };
        renderAll();
      }
    });
    return;
  }

  if (modal.type === 'waypoint_reward') {
    showWaypointRewardModal(modal.payload, () => {
      // Chain: if the next segment also has a waypoint offer, fire it; else landmark encounter.
      const segmentWp = state.waypoints.find(w => w.segmentIdx === state.currentLandmarkIndex);
      if (segmentWp && !state.firedWaypoints.includes(segmentWp.waypointId)) {
        const nextWaypoint = WAYPOINTS.find(w => w.id === segmentWp.waypointId);
        state = { ...state, activeModal: { type: 'waypoint_offer', payload: { waypoint: nextWaypoint, segmentIdx: state.currentLandmarkIndex } } };
      } else {
        const arrivedId = state.route[state.currentLandmarkIndex];
        state = { ...state, activeModal: { type: 'event', payload: makeLandmarkEncounter(arrivedId) } };
      }
      renderAll();
    });
    return;
  }
```

- [ ] **Step 4: Verify no syntax errors**

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node --check src/ui/modals.js && node --check src/main.js`

Expected: both exit with no output (syntactically valid).

- [ ] **Step 5: Run tests**

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node --test sim/*.test.mjs 2>&1 | tail -3`

Expected: `pass 19`, `fail 0`.

- [ ] **Step 6: Commit**

```bash
git add src/ui/modals.js src/main.js
git commit -m "$(cat <<'EOF'
Wire waypoint offer and reward modals into the UI (refs #7 part 1)

Two new modal types — waypoint_offer and waypoint_reward — get
renderers in ui/modals.js and dispatch branches in main.js. Accept
chains to the landmark encounter for the CURRENT arrival; reward
chains to either another offer (for the next segment) or the
landmark encounter, whichever is queued.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Minimap markers + styling + version bump

**Files:**
- Modify: `src/render.js` (extend `renderMinimap`)
- Modify: `styles/components.css` (append waypoint marker rules)
- Modify: `package.json` (bump to 0.4.0)

- [ ] **Step 1: Read the current renderMinimap function**

Run: `grep -n "renderMinimap\|minimapPath\|minimapTrail\|minimapLands" src/render.js`

Identify the section that positions landmarks on the minimap. You'll add a parallel loop for waypoints using the same coordinate system.

- [ ] **Step 2: Extend `renderMinimap` with waypoint markers**

Inside `renderMinimap`, after the existing loop that positions landmarks on the minimap, add a waypoint-marker loop. The exact code depends on the existing structure — ask for clarification or read the function end-to-end if the structure is ambiguous.

Pattern (adapt to the actual coordinate/positioning logic in the file):

```js
  // ---- Waypoint markers (issue #7 part 1) ----
  if (!$.minimapLands) return;  // defensive
  // Remove any stale waypoint markers from a prior render.
  $.minimapLands.querySelectorAll('.waypoint-marker').forEach(el => el.remove());
  for (const entry of state.waypoints) {
    const waypoint = WAYPOINTS.find(w => w.id === entry.waypointId);
    if (!waypoint) continue;
    // Marker position: midpoint of segment[entry.segmentIdx], nudged perpendicular by ~8px.
    const startIdx = entry.segmentIdx;
    const endIdx   = entry.segmentIdx + 1;
    const startPos = landmarkPos(state, startIdx);   // existing helper or inline calc
    const endPos   = landmarkPos(state, endIdx);
    const midX = (startPos.x + endPos.x) / 2;
    const midY = (startPos.y + endPos.y) / 2;
    // Perpendicular offset for off-route feel.
    const dx = endPos.x - startPos.x;
    const dy = endPos.y - startPos.y;
    const len = Math.max(1, Math.sqrt(dx*dx + dy*dy));
    const px = -dy / len * 8;
    const py = dx / len * 8;

    const stateClass =
      state.firedWaypoints.includes(waypoint.id) ? 'fired'
      : state.pendingWaypoint?.id === waypoint.id ? 'accepted'
      : 'pending';

    const marker = document.createElement('div');
    marker.className = `waypoint-marker ${stateClass}`;
    marker.style.left = `${midX + px}px`;
    marker.style.top  = `${midY + py}px`;
    marker.title = waypoint.name;
    $.minimapLands.appendChild(marker);
  }
```

Add the import at the top of `src/render.js`:
```js
import { WAYPOINTS } from './content/waypoints.js';
```

**Note:** If there is no existing `landmarkPos(state, idx)` helper and the minimap uses a different positioning approach (e.g., percentage-based along a polyline), adapt by reading how landmarks are currently positioned and using the same convention for waypoints. Ask the user if the minimap structure doesn't match the pattern above.

- [ ] **Step 3: Append waypoint CSS to `styles/components.css`**

Open `styles/components.css`. At the end of the file, add:

```css
/* ---- Waypoint markers on minimap (issue #7 part 1) ---- */

.waypoint-marker {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #cc88ff;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.waypoint-marker.pending {
  animation: waypoint-pulse 2s ease-in-out infinite;
}

.waypoint-marker.accepted {
  background: #ee99ff;
  width: 8px;
  height: 8px;
  box-shadow: 0 0 8px #ee99ff;
}

.waypoint-marker.fired {
  background: var(--fg-dim, #cc99cc);
  opacity: 0.3;
}

@keyframes waypoint-pulse {
  0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
  50%      { opacity: 1;   transform: translate(-50%, -50%) scale(1.4); }
}

/* ---- Waypoint modal content (issue #7 part 1) ---- */

.modal-severity.severity-waypoint {
  color: #cc88ff;
  border-color: #cc88ff;
}

.modal-waypoint-offer .waypoint-costs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin: 0.75rem 0 1rem;
}

.waypoint-cost {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.35rem;
  background: rgba(204, 136, 255, 0.06);
  border: 1px solid rgba(204, 136, 255, 0.2);
}

.waypoint-cost .wp-label {
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  opacity: 0.75;
}

.waypoint-cost .wp-value {
  font-size: 0.95rem;
  font-variant-numeric: tabular-nums;
}

.modal-waypoint-reward .waypoint-sci {
  font-size: 1.5rem;
  font-weight: 700;
  color: #cc88ff;
  text-align: center;
  margin: 0.75rem 0;
}

.waypoint-fact {
  margin: 0.75rem 0;
  padding: 0.75rem 1rem;
  border-radius: 0.35rem;
  background: rgba(204, 136, 255, 0.06);
  border-left: 3px solid #cc88ff;
}

.waypoint-fact-label {
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  opacity: 0.8;
  margin-bottom: 0.35rem;
}
```

- [ ] **Step 4: Bump `package.json` version**

Open `package.json`. Change:

```json
{
  "type": "module",
  "private": true,
  "version": "0.3.0"
}
```

to:

```json
{
  "type": "module",
  "private": true,
  "version": "0.4.0"
}
```

(The title-screen version will auto-reflect this via the JSON import wired in #10.)

- [ ] **Step 5: Run all tests**

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node --test sim/*.test.mjs 2>&1 | tail -3 && node sim/play.mjs 2>&1 | tail -5`

Expected: 19/19 tests pass; sim still prints the 12-row table.

- [ ] **Step 6: Commit**

```bash
git add src/render.js styles/components.css package.json
git commit -m "$(cat <<'EOF'
Render waypoint markers on minimap + style waypoint modals (refs #7 part 1)

Three visual states per marker: pulsing purple (pending), solid
brighter purple (accepted), dim grey (fired/declined). Modal styling
keeps the waypoint purple accent consistent across offer/reward
displays.

Also bumps package.json to 0.4.0 for the release.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: PR → merge → tag v0.4.0 → release

**Files:** none modified.

- [ ] **Step 1: Final sanity checks**

Run:
```bash
cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail"
node --test sim/*.test.mjs 2>&1 | tail -5
node sim/play.mjs 2>&1 | tail -14
```

Expected: 19/19 tests pass. Sim table's Balanced rows stay near v0.3.0 values (cautious ~65–75%, steady ~55–65%, push ~40–55%) because the sim declines every waypoint (patched in Task 3 Step 6).

- [ ] **Step 2: Push the branch**

Run: `git push -u origin feat/science-waypoints`

- [ ] **Step 3: Open the PR**

```bash
gh pr create --base main --head feat/science-waypoints --title "Science waypoints (v0.4.0)" --body "$(cat <<'EOF'
## Summary

- 12 authored side-expedition waypoints scattered along the route. 40% chance per segment = ~2.4 waypoints per run on average.
- Accept a waypoint → add 55–100 km to the current segment + burn the extra sols of life support. Reward lands at the next landmark: 45–70 SCI + an advanced Mars fact not reachable any other way.
- Decline → waypoint permanently closed. No re-prompt.
- Minimap shows pulsing purple markers for every rolled waypoint. State changes visually as you interact (pulsing → solid-bright when accepted, dim when fired/declined).
- Closes #7 Part 1. (Part 2 — cross-run career progression — will be a separate PR.)

## What changed

- **New content:** \`src/content/waypoints.js\` (12 waypoints), \`src/content/advancedFacts.js\` (~24 advanced facts across 4 categories).
- **New systems:** \`src/systems/waypoints.js\` with \`rollWaypoints\`, \`acceptWaypoint\`, \`declineWaypoint\`, \`resolveWaypoint\`. 8 TDD tests in \`sim/waypoints.test.mjs\`.
- **Travel integration:** landmark-arrival block in \`advanceSol\` chains waypoint reward → waypoint offer → landmark encounter.
- **UI:** two new modal types (\`waypoint_offer\`, \`waypoint_reward\`) in \`src/ui/modals.js\`; dispatch in \`src/main.js\`.
- **Map:** \`src/render.js\` draws waypoint markers along segment midpoints with three visual states.
- **Styling:** \`styles/components.css\` waypoint marker + modal rules.
- \`package.json\` bumped to 0.4.0.

## Test plan

- [ ] \`node --test sim/*.test.mjs\` — 19/19 pass.
- [ ] \`node sim/play.mjs\` — pace bands unchanged (sim declines all waypoints).
- [ ] Browser: title shows \`v0.4.0 · 2026\`.
- [ ] Browser: start a run. Minimap should show 0–4 pulsing purple dots.
- [ ] Browser: travel to a landmark with a pending-segment waypoint. Offer modal should fire BEFORE the landmark encounter.
- [ ] Browser: accept — watch \`+80 km detour\` log line. Travel across extended segment. On next arrival, reward modal fires first.
- [ ] Browser: decline — waypoint marker greys out immediately, no re-prompt.
- [ ] Browser: final segment (Tharsis → Olympus Base) should never prompt a waypoint offer.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Pause for user review + merge**

Hand back to the user to test locally and merge when satisfied. Standard flow: `gh pr merge <N> --rebase --delete-branch`.

- [ ] **Step 5: After merge — sync main + tag + release**

```bash
cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail"
git checkout main
git fetch --prune
git reset --hard origin/main
git branch -D feat/science-waypoints 2>/dev/null

git tag -a v0.4.0 -m "v0.4.0 — Science waypoints (side-expeditions)

Optional off-route science sites. Accepting a detour costs sols
and life-support burn; reward is an advanced Mars fact + SCI
bonus unavailable via routine play. Closes #7 Part 1."
git push origin v0.4.0

gh release create v0.4.0 --title "v0.4.0 — Science Waypoints" --notes "$(cat <<'EOF'
## Side-expeditions detected

Every run rolls 0–4 science waypoints scattered along the route. Pulsing purple dots on the minimap mark them from sol 1.

At each landmark arrival, if the next leg holds a waypoint, you decide: **divert** (pay extra sols + km + life-support burn) or **continue on** (no cost, no reward). Decline once and it's closed forever.

Accept, and at the next landmark you unlock an **advanced Mars fact** — curated content that's out of reach via routine events — plus a 45–70 SCI boost that rolls into your end-of-run ranking.

## Content

12 authored waypoints covering geology, water, atmosphere, and astrobiology themes — olivine outcrops, lava tubes, methane plumes, potential biosignature deposits. 24 advanced facts in a parallel pool, ~6 per category.

## Strategy

On a cautious run, accepting every waypoint you roll can push you into O₂-critical territory before Olympus Base. On a push run, you may have slack. Every detour is a real trade-off — never free.

## Closed issue

- #7 Part 1 — Advanced science facts via side-expeditions
EOF
)"
```

- [ ] **Step 6: Verify**

Run:
```bash
gh release view v0.4.0
gh issue view 7
```

Expected: release page renders. Issue #7 — you may need to either close it manually (with a comment noting "Part 1 done; Part 2 tracked separately") OR leave it open and file a new Part 2 issue. Prefer the latter — it keeps the existing issue open as an umbrella until Part 2 also ships.

---

## Self-Review (run before dispatching subagents)

**Spec coverage:**
- §Architecture → Task 2 + 4 + 5 ✓
- §Waypoint data shape → Task 1 ✓
- §Advanced facts → Task 1 ✓
- §State shape changes → Task 2 Step 5 ✓
- §rollWaypoints / acceptWaypoint / declineWaypoint / resolveWaypoint → Task 2 Steps 1–4 ✓
- §Travel integration → Task 3 ✓
- §Waypoint-offer modal → Task 4 Step 1 ✓
- §Waypoint-reward modal → Task 4 Step 1 ✓
- §Minimap markers → Task 5 Step 2 ✓
- §CSS → Task 5 Step 3 ✓
- §Validation → PR test plan in Task 6 Step 3 ✓
- §Sequencing → Task 6 ✓

**Placeholder scan:** The minimap positioning in Task 5 Step 2 uses a `landmarkPos` pattern with an "ask user if structure doesn't match" escape — that's acceptable because minimap structure is an existing-code dependency the plan can't fully pin without more context. No TBDs/TODOs in the main flow.

**Type consistency:**
- `waypoint.id` vs `waypointId` — the state stores `{ waypointId, segmentIdx }` entries; the full waypoint object is looked up from the `WAYPOINTS` array by id. Consistent across tasks.
- `pendingWaypoint` is the full waypoint object; `firedWaypoints` is a list of ids. Consistent.
- `activeModal.payload` shape for `waypoint_offer`: `{ waypoint, segmentIdx }`. For `waypoint_reward`: `{ waypoint, sciencePointsGained, fact }`. Consistent.
