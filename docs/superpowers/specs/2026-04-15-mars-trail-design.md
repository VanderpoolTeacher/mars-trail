# Mars Trail — Design Spec

**Date:** 2026-04-15
**Status:** Approved for implementation planning
**Scope:** v1 (single playable scenario + unlock infrastructure for two more)

---

## 1. Overview

**Mars Trail** is a browser-based survival/strategy game — a modernized Oregon Trail set on Mars. The player commands a 3-4 person crew on a one-way trek across the Martian surface, managing resources (O₂, water, power, food, spare parts) across ~8 landmark waypoints over ~20-30 in-game sols. Each playthrough is **15-25 minutes**, single session, auto-saved to localStorage.

The game has two distinct rhythms:

- **The trek** — at each landmark, the player chooses pace, rations, and rest. Random events (dust storms, equipment failures, radiation events, comms blackouts) force tradeoff decisions. Crew members can be permanently injured or killed.
- **Science encounters** — periodically the crew "meets a phenomenon" (recurring slope lineae, methane plume, dust devil, polar ice deposit, etc.). The player picks which crew member runs the experiment and how to approach it. Outcomes award **science points** + a real Mars fact + a possible resource/risk side effect.

Three scenarios exist in code, but only one (**Trek**) is unlocked at first launch. **Survey** and **Distress** unlock as the player accumulates lifetime science points across runs.

**Visual identity:** green-on-black mission-control terminal, telemetry readouts, grid overlays, mini-map. Pure CSS — no canvas, no framework.

**Win condition:** crew arrives alive at the destination.
**Loss condition:** entire crew dies, or critical resource (O₂) hits zero.

**Tone:** serious sci-fi survival with educational depth. Real Mars facts surface organically through science encounters and landmark flavor text.

---

## 2. Architecture & File Structure

A flat, no-build-step layout. Open `index.html` directly in a browser (served via `python3 -m http.server` so ES modules load) and it runs.

```
Mars Trail/
├── index.html              # single page; all UI panels in semantic <section>s
├── styles/
│   ├── theme.css           # mission-control palette, fonts, grid bg
│   ├── layout.css          # dashboard grid, panel positioning
│   └── components.css      # buttons, modals, readouts, mini-map
├── src/
│   ├── main.js             # entry: bootstraps state, mounts renderer, wires input
│   ├── state.js            # game state shape + reducer-style mutations
│   ├── render.js           # top-level render(state) → updates DOM panels
│   ├── systems/
│   │   ├── travel.js       # advance sol, consume resources, check arrivals
│   │   ├── events.js       # roll random events at each tick
│   │   ├── crew.js         # health, injury, death, specialty checks
│   │   ├── experiments.js  # phenomenon encounter resolution
│   │   └── scoring.js      # final score, unlock progression
│   ├── content/
│   │   ├── scenarios.js    # trek / survey / distress definitions
│   │   ├── landmarks.js    # named waypoints with flavor text
│   │   ├── events.js       # random event table (~20 entries)
│   │   ├── phenomena.js    # ~15-20 science encounters (data-driven)
│   │   └── crew-classes.js # specialties: engineer, biologist, medic, pilot
│   ├── ui/
│   │   ├── modals.js       # event modals, encounter modals, end-of-run
│   │   └── panels.js       # status panel, mini-map, log feed renderers
│   └── persistence.js      # localStorage save/load + unlock progression
├── tests/
│   ├── index.html          # zero-dep test runner
│   ├── harness.js          # tiny assert + it()
│   └── *.test.js           # one file per system tested
├── assets/                 # SVG icons if needed; most "art" is CSS
└── docs/superpowers/specs/2026-04-15-mars-trail-design.md
```

**Design constraints:**

- **Content is data, not code** — `landmarks.js`, `events.js`, `phenomena.js` are arrays of plain objects. Adding new content = adding an entry, no logic change.
- **Systems are pure-ish functions** — `travel.advanceSol(state)` returns a new state. Easy to test, easy to reason about.
- **`render(state)` is idempotent** — pass current state, DOM reflects it. No two-way binding tangles.
- **`main.js` is the only file that touches both state mutations *and* the DOM.**
- **No build step.** ES modules load natively from a static server.
- **No external runtime dependencies.** No CDN scripts, no npm packages.
- **No persistence beyond localStorage.** No backend, no auth, no leaderboard server.

---

## 3. Game State Model

A single `state` object, mutated through reducer-style functions in `systems/`. No classes — plain objects + functions.

```js
state = {
  // Run metadata
  schemaVersion: 1,
  runId: "uuid",
  scenario: "trek",              // "trek" | "survey" | "distress"
  startedAt: 1776267000,
  sol: 1,
  status: "active",              // "active" | "won" | "lost"
  lossReason: null,              // "all_dead" | "no_oxygen" | null

  // Geography
  route: ["jezero","syrtis","arabia","meridiani","gale","elysium","tharsis","olympus_base"],
  currentLandmarkIndex: 0,
  kmToNextLandmark: 220,
  totalKmTraveled: 0,

  // Resources
  resources: {
    oxygen: 78,        // % of tank
    water: 61,
    power: 43,
    food: 52,
    spareParts: 5      // discrete units
  },

  // Crew (3-4 named astronauts)
  crew: [
    { id:"c1", name:"Alex",  role:"engineer", health:100, status:"healthy", alive:true },
    { id:"c2", name:"Riya",  role:"biologist", health:100, status:"healthy", alive:true },
    { id:"c3", name:"Tomás", role:"medic",     health:100, status:"healthy", alive:true },
    { id:"c4", name:"Mei",   role:"pilot",     health:100, status:"healthy", alive:true }
  ],

  // Run choices
  pace: "steady",         // "cautious" | "steady" | "push"
  rations: "full",        // "meager" | "standard" | "full"

  // Score & log
  sciencePoints: 0,
  factsLearned: [],
  log: [{sol:1, text:"Mission begins. Crew nominal."}],

  // UI ephemeral
  activeModal: null,
}
```

**Persistence keys (localStorage):**

- `marsTrail.run` — full current state, written every sol-tick. Cleared on run end.
- `marsTrail.profile` — `{ schemaVersion, lifetimeSciencePoints, unlockedScenarios:["trek"], runsCompleted, runsWon, bestScore, factsLearned:[] }` — survives across runs.

**Mutations are explicit and centralized.** `state.js` exports:

```js
applyEvent(state, eventOutcome)   → newState
advanceSol(state)                  → newState
resolveEncounter(state, choice)    → newState
killCrew(state, crewId, reason)    → newState
```

Each returns a new state (shallow clone of changed branches). `render(state)` runs after every mutation; `persistence.save(state)` runs after every sol-tick and modal resolution.

**Crew specialty modifiers:**

- **Engineer** — fewer equipment failures, better repair outcomes (+30% repair success).
- **Biologist** — bonus science points on biological phenomena.
- **Medic** — all crew damage reduced 30% while alive.
- **Pilot** — faster travel (+10% km/sol), fewer navigation events.

When a specialist dies, runs become noticeably harder. That is the strategic weight of permadeath.

---

## 4. Core Systems

Five small modules, each with a clear job. All take `state` and return new `state`.

### `travel.js` — the heartbeat

`advanceSol(state)` runs once per **NEXT SOL** click:

1. Compute km traveled this sol from `pace` and pilot bonus.
2. Subtract resource consumption (rations / pace / crew-size dependent).
3. Decrement crew health if `rations="meager"` or `oxygen < 20%`.
4. If `kmToNextLandmark <= 0` → arrive at next landmark, append log, possibly trigger encounter.
5. Roll for random event (see `events.js`); if hit, set `activeModal`.
6. Check loss conditions (all crew dead, O₂ at 0).
7. Auto-save.

### `events.js` — random adversity

- Weighted table of ~20 event types: dust storm, solar flare, bearing seizure, comms blackout, dust devil, leak, micrometeorite hit, etc.
- Each event = `{ id, weight, severity, prereq?, modal:{title, description, choices:[{label, outcome}]} }`.
- Choices may specify resource costs, health effects, time delays, or specialty skill checks (e.g., "Repair (Engineer)" succeeds 90% with engineer alive, 40% without).

### `crew.js` — health & death

- Health 0–100 per crew member. Statuses: `healthy / injured / sick / critical / dead`.
- `applyDamage(crew, amount, cause)` handles status transitions and logs deaths narratively ("Tomás succumbed to radiation poisoning, sol 14").
- Medic alive → all damage reduced 30%.

### `experiments.js` — phenomenon encounters

- Triggered at certain landmarks or at random with low probability.
- Loads phenomenon definition from `content/phenomena.js`.
- Modal presents: phenomenon description + crew member assignment + 3 method choices.
- Resolution: science points + a true Mars fact appended to the log + possible side effect.

### `scoring.js` — end of run

- Triggered when `status` flips to `won` or `lost`.
- See formula in §7.
- Updates profile in localStorage: lifetime science, runsCompleted, bestScore, **unlock checks**.

### Game loop

```
user clicks "Next Sol" → advanceSol(state) → render(state) → persist(state)
                                ↓
                     (if modal triggered, wait for choice)
                                ↓
                     applyChoice(state) → render(state) → persist(state)
```

No game timer, no animation loop. Turn-based, click-driven. `requestAnimationFrame` is used only for tiny cosmetic touches (cursor blink, log fade-in).

---

## 5. UI Layout

Single dashboard screen, CSS Grid, mission-control aesthetic. No scene switching — modals overlay the dashboard for events / encounters / end-of-run.

```
┌──────────────────────────────────────────────────────────────────┐
│ MARS TRAIL · MISSION CTRL              SOL 127 · 14:22 LMST      │ ← top bar
├──────────────────────┬───────────────────┬───────────────────────┤
│   ROUTE / MAP        │    TELEMETRY      │      CREW             │
│   (mini-map +        │    O2 ▓▓▓▓▓░ 78%  │   ┌─ Alex (ENG)  ●   │
│    landmark list)    │    H2O ▓▓▓░░ 61%  │   ├─ Riya (BIO)  ●   │
│                      │    PWR ▓▓░░░ 43%  │   ├─ Tomás(MED)  ◐   │ ← injured
│   ▶ Jezero          │   FOOD ▓▓▓░░ 52%  │   └─ Mei (PILOT)●   │
│     Arabia          │   PARTS    5      │                       │
│     Meridiani       │                   │   PACE: ◯ ● ◯         │
│     Gale            │                   │   RATIONS: ◯ ● ◯      │
│     Olympus Base    │                   │                       │
├──────────────────────┴───────────────────┴───────────────────────┤
│   MISSION LOG                                                    │
│   > SOL 126 · Dust storm cleared. -8% PWR.                       │
│   > SOL 126 · Riya logged methane reading at Arabia.             │
│   > SOL 127 · Departing for Meridiani. 340 km.                   │
│   > _                                                            │
├──────────────────────────────────────────────────────────────────┤
│              [ NEXT SOL → ]                                      │
└──────────────────────────────────────────────────────────────────┘
```

**Six panels:**

1. **Top bar** — mission name, current sol, Mars Local Mean Solar Time (cosmetic).
2. **Route panel (left)** — landmark list with current position highlighted, tiny SVG mini-map.
3. **Telemetry panel (center)** — resource bars (green → amber → red as they deplete), discrete part count.
4. **Crew panel (right)** — name, role icon, health dot (●healthy ◐injured ○critical ✕dead). Pace/rations selectors.
5. **Mission log (bottom-wide)** — terminal-style scrolling text feed with `>` prompts; latest entries at bottom; fades in.
6. **Action bar** — single primary button: **NEXT SOL** (or **RESOLVE** when a modal is active).

**Modal types:**

- **Event modal** — title + flavor text + 2-4 choice buttons.
- **Encounter modal** — phenomenon description + crew picker + method picker + "Begin experiment".
- **End-of-run modal** — survival summary, science points, facts learned this run, unlock progress, "New Run" button.
- **Title screen** — shown on first load and after a finished run. Scenario picker (locked scenarios shown but disabled with unlock requirement text), crew naming.

**Aesthetic:**

- Background: pure black (`#000`).
- Primary text: phosphor green (`#0f0` important; `#0a8` secondary).
- Warning amber: `#fbbf24`. Critical red: `#ef4444`.
- Font: free monospace web font (JetBrains Mono or Fira Code via `@font-face`); fallback `ui-monospace`.
- Subtle scanline overlay (CSS gradient) — toggleable in case it's annoying.
- Faint 20px grid background, very low opacity.
- Panel borders: 1px solid green, slightly glowing via `box-shadow: 0 0 4px rgba(0,255,100,.3)`.

**Responsive:** desktop-first. Mobile collapses to vertical stacking. Min width 360px.

**Accessibility:** semantic HTML (`<button>`, `<dialog>`, `<section>`), keyboard navigable (Tab + Enter), `aria-live` on the mission log so screen readers hear updates. Color is never the sole signal — icons + text everywhere.

---

## 6. Content Model

Everything player-facing is plain JS data. Adding content is editing one file.

### `content/scenarios.js`

```js
export const scenarios = {
  trek: {
    id: "trek", name: "The Trek", unlocked: true,
    description: "Land at Jezero, drive to Olympus Base. ~1700 km.",
    routeKm: [220, 280, 195, 240, 305, 210, 250],   // 7 segments between 8 landmarks
    routeIds: ["jezero","syrtis","arabia","meridiani","gale","elysium","tharsis","olympus_base"],
    eventBaseRate: 0.35,
    encounterBaseRate: 0.20,
    scoreMultiplier: 1.0
  },
  survey:   { /* unlocked at 500 lifetime SP */ },
  distress: { /* unlocked at 1500 lifetime SP + at least 1 survey completion */ }
};
```

### `content/landmarks.js`

~12 named real Mars locations with brief flavor.

```js
{ id:"jezero", name:"Jezero Crater", lat:18.4, lon:77.5,
  flavor:"Ancient river delta. Perseverance landed here in 2021.",
  encounterBias:["sediment_layers","carbonate_outcrop"] }
```

### `content/events.js`

~20 random events. Each is a self-contained data object.

```js
{
  id: "dust_storm",
  weight: 8,
  severity: "major",
  modal: {
    title: "Regional Dust Storm",
    description: "Visibility drops. Solar panels cake over. Travel halts.",
    choices: [
      { label: "Wait it out (2 sols)",
        outcome: { sols:+2, power:-15, water:-4, food:-4 } },
      { label: "Push through (Pilot check)",
        skillCheck: { role:"pilot", successP:0.6 },
        successOutcome: { sols:+0, power:-25, parts:-1 },
        failOutcome:    { sols:+1, power:-30, parts:-2,
                          crewDamage:{role:"pilot", amount:15} } },
      { label: "Shelter and run experiments",
        outcome: { sols:+2, power:-12, sciencePoints:+25 } }
    ]
  }
}
```

### `content/phenomena.js`

~15-20 phenomenon encounters; each carries a real Mars fact for the log.

```js
{
  id: "recurring_slope_lineae",
  name: "Recurring Slope Lineae",
  description: "Dark streaks creep down a crater wall. Possibly briny water seeps.",
  methodChoices: [
    { label:"Spectrometer scan from rover (safe)",
      outcome:{ sciencePoints:+30 } },
    { label:"Send crew on foot to sample (risky)",
      skillCheck:{ role:"biologist", successP:0.7 },
      successOutcome:{ sciencePoints:+80, water:+5 },
      failOutcome:{ sciencePoints:+20,
                    crewDamage:{ role:"biologist", amount:20 } } },
    { label:"Skip — log a note and move on",
      outcome:{ sciencePoints:+5 } }
  ],
  factOnSuccess: "RSL were first imaged by HiRISE in 2011. Their cause is still debated — possibly briny water flow, possibly dry granular movement."
}
```

### `content/crew-classes.js`

Four roles with specialty modifiers and a stock name pool for quick-start.

```js
{ role:"engineer",
  bonuses:{ repairSuccessBonus:0.3, equipmentEventChance:-0.2 },
  defaultName:"Alex Park" }
```

### Content quantities for v1

- 1 scenario fully playable (Trek), 2 stubbed
- 8 landmarks for the Trek route (~12 defined in `landmarks.js`; extras reserved for Survey/Distress)
- ~20 events
- ~15 phenomena
- 4 crew classes, ~12 stock first names in a gender-neutral pool

Two consecutive runs feel meaningfully different. Adding more is purely additive.

---

## 7. Persistence, Scoring & Unlocks

### Persistence (`persistence.js`)

- Two localStorage keys, both JSON-encoded:
  - `marsTrail.run` — full state of active run. Written after every sol-tick and modal resolution. Cleared when a run ends.
  - `marsTrail.profile` — `{ schemaVersion, lifetimeSciencePoints, runsCompleted, runsWon, unlockedScenarios:["trek"], bestScore, factsLearned:[] }`.
- On page load: if `marsTrail.run` exists → show "Resume / Abandon" prompt. Otherwise show title screen.
- Schema versioning: each saved object has `schemaVersion: 1`. Future incompatible changes either migrate or politely discard with a notice.

### Scoring formula

```
score = ( (crewSurvived × 1000)
        + sciencePoints
        + (kmTraveled × 0.5)
        + (factsLearned.length × 50)
        + (won ? 2000 : 0) )
      × scenario.scoreMultiplier
```

### Unlocks

- **Survey** unlocks at **500 lifetime science points**.
- **Distress** unlocks at **1500 lifetime science points** AND at least one Survey completion.
- Locked scenarios appear on the title screen as locked tiles with a progress bar — the lock itself is part of the motivation.

### End-of-run modal shows

- Outcome (Mission Success / Lost) + cause if lost
- Days survived, km traveled, crew lost (with their names — the moment that stings)
- Science points this run + lifetime total
- Facts learned this run (the player's "souvenir" from the Mars trip)
- Unlock progress bars
- New Run / Title Screen buttons

---

## 8. Out of Scope for v1

Deliberate cuts to keep the build shippable:

- Multiplayer / leaderboards (no backend)
- Sound design (silence is on-brand for mission control; can add later)
- Cutscenes / animations beyond CSS transitions
- Real geographic accuracy of distances (we use plausible but not literal km)
- Save slots (single active run only)
- Difficulty settings (one balanced difficulty for v1)
- Localization
- Mini-games (deferred per design discussion — choice-driven encounters only)
- Survey & Distress scenarios as fully playable content (stubbed; unlocked via SP, but content drops in v1.1)

---

## 9. Testing Strategy

This is a small client-side game with no backend. Manual playtesting is the primary verification, supported by targeted unit tests for the systems most likely to silently break:

- **`systems/travel.advanceSol`** — resource consumption math, landmark arrival logic, loss-condition detection.
- **`systems/scoring.calculate`** — formula correctness across edge cases (all dead, full crew, zero science).
- **`systems/crew.applyDamage`** — status transitions and death detection.
- **`persistence.save` / `load`** — round-trip preservation and schema-version handling.

Tests live in `tests/` and run with a single-file zero-dep test harness (a tiny `assert` + `it()` pair, no Jest, no Vitest, no toolchain). Run via `python3 -m http.server` and open `tests/index.html` in a browser.

UI rendering, modal flow, and content variety are validated by playtesting.

---

## 10. Open Questions

None blocking. Items the implementation may iterate on after first playable build:

- Final balance of event weights and resource consumption rates (tuned by playtesting).
- Whether the scanline CSS overlay should default on or off.
- Whether to surface the Mars fact in-modal at experiment resolution, or only in the log (current plan: both — modal celebrates the discovery, log archives it).
