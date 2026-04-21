// Slide manifest. All HTML in `title`, `body`, and `snippets[].caption` is
// authored in-repo and trusted — rendered unescaped. Snippet `code` contains
// literal source text and is escaped at render time. Do not route user input
// through this file.
export const spine = [
  {
    id: 'welcome',
    title: 'Welcome to the Mars Trail code tour',
    body: `
      <p class="subtitle">A ~15-minute guided tour of how this game is organized.</p>
      <p>Use <strong>← →</strong> to navigate. <strong>Esc</strong> returns from a hub branch. Theme selector in the top-right repaints everything — the tour itself is a live demo of the game's theme system.</p>
      <p>Press <strong>→</strong> or click <strong>NEXT</strong> to begin.</p>
    `,
  },
  {
    id: 'pitch',
    title: 'What is Mars Trail?',
    body: `
      <p>An Oregon-Trail-style survival sim set on Mars, built for a game jam. You captain a rover from Jezero Crater to a colony site near Olympus Mons, rationing power and EVA suits, managing crew, responding to emergencies, and diverting for side missions ("away teams") that chase science points.</p>
      <p>Runs typically take ~15–30 sols (2–3 weeks of in-game time), most of the difficulty is in the event system, and a run ends when you reach the goal or lose the crew.</p>
    `,
  },
  {
    id: 'stack',
    title: 'Tech stack',
    body: `
      <p><strong>Vanilla ES modules.</strong> No framework, no bundler, no build step. Open <code>index.html</code> in a browser and you're running the game.</p>
      <p>This is deliberate: the project is small enough that a build toolchain would be more complexity than feature. It also makes the code unusually easy to read — what you see in the file is what runs.</p>
      <p>Testing uses Node's built-in <code>node --test</code> runner (see <code>sim/</code>). The simulation harness at <code>sim/play.mjs</code> runs thousands of AI-driven playthroughs to validate balance.</p>
    `,
  },
  {
    id: 'layout',
    title: 'Repo layout',
    body: `
      <p>The whole project fits in a handful of folders. Each has one job.</p>
      <pre style="line-height:1.35;font-size:0.9em"><code>Mars Trail/
├── index.html          — game entry point
├── src/
│   ├── main.js         — boots the game, wires UI
│   ├── state.js        — single source of truth
│   ├── render.js       — state → DOM
│   ├── theme.js        — theme switcher
│   ├── audio.js        — music + mute
│   ├── systems/        — game logic (pure where possible)
│   ├── content/        — data: events, emergencies, facts, waypoints
│   └── ui/             — modals, codex overlay
├── styles/             — theme.css + per-theme overlays
├── sim/                — unit tests + playtest harness
├── assets/             — images, music
└── docs/
    ├── superpowers/    — per-feature specs + implementation plans
    ├── walkthrough/    — this interactive tour
    └── reports/        — session reports
</code></pre>
      <p>The rest of the tour follows the data flow: entry point → state → render → systems (via a hub) → content → UI → themes → audio → tests → workflow.</p>
    `,
  },
  {
    id: 'loop',
    title: 'The game loop',
    body: `
      <p>Every turn (a "sol") follows the same four-phase rhythm:</p>
      <ol>
        <li><strong>Input</strong> — player picks pace / rations / actions.</li>
        <li><strong>Systems</strong> — <code>travel.js</code>, <code>events.js</code>, and friends mutate state.</li>
        <li><strong>Render</strong> — <code>render.js</code> rebuilds the DOM from state.</li>
        <li><strong>Log</strong> — mission log entries appear for what just happened.</li>
      </ol>
      <p>There is <em>no</em> observer pattern, <em>no</em> virtual DOM, <em>no</em> reactive framework. On every change, <code>render()</code> rebuilds the parts of the DOM it owns from scratch.</p>
      <div id="demo-loop-mount"></div>
    `,
    demo: 'loop',
  },
  {
    id: 'entry',
    title: 'Entry point',
    body: `
      <p><code>index.html</code> loads stylesheets and calls into <code>src/main.js</code>, which boots the game: builds initial state, wires event listeners, paints the first frame.</p>
      <p>Follow the imports at the top of <code>main.js</code> and you get a one-page map of the whole app.</p>
    `,
    snippets: [
      {
        path: 'src/main.js',
        lines: [1, 17],
        caption: 'Boot imports',
        code: `// Mars Trail — entry point
// Builds initial state, runs first render, wires UI events.

import { createInitialState, CARGO_BUDGET, PART_TYPES } from './state.js';
import { render } from './render.js';
import { advanceSol, setPace, setRations, repairBattery, cleanPanels } from './systems/travel.js';
import { applyEventChoice } from './systems/events.js';
import { recordDecision } from './systems/clickMetrics.js';
import { showEventModal, showOutcomeModal, showBriefingModal, showLoadoutModal, showTitleLayer, dimTitleStart, hideTitleLayer, showEndOfRunModal, closeModal, showWaypointOfferModal, showMultiStageModal, showAwayTeamPickerModal, showAwayTeamReunionModal, showDeathDialog } from './ui/modals.js';
import { declineWaypoint } from './systems/waypoints.js';
import { applyStageChoice } from './systems/multiStage.js';
import { acceptAwayTeam, resolveAwayTeamStage, finalizeReunion } from './systems/awayTeam.js';
import { resolveMedicalStage, getMedicalStageView } from './systems/medicalEmergency.js';
import { WAYPOINTS } from './content/waypoints.js';
import { makeLandmarkEncounter } from './content/landmarks.js';
import './ui/codex.js';   // registers global click handler for codex terms
import { GAMEPLAY_TRACKS, getSelectedTrackId, isMuted, playTitle, playGameplay, selectTrack, toggleMute, fadeOut, fadeInGameplay, cycleTrack, onTrackChange } from './audio.js';`,
      },
    ],
  },
  {
    id: 'state',
    title: 'State',
    body: `
      <p><code>src/state.js</code>'s central export is a factory, <code>createInitialState()</code>, that returns a plain JS object. That object <em>is</em> the game. Everything else reads it; systems mutate it; <code>render()</code> projects it to DOM. (The module also exports a few shared constants and lookup tables — see the file itself.)</p>
      <p>Keeping state in one place is what makes tests easy to write: seed a state, call a system, assert on the resulting state.</p>
    `,
    snippets: [
      {
        path: 'src/state.js',
        lines: [43, 70],
        caption: 'State shape (excerpt)',
        code: `  const baseState = {
    schemaVersion: 1,
    runId: uuid(),
    scenario: 'trek',
    startedAt: Date.now(),
    sol: 1,
    status: 'active',          // 'active' | 'won' | 'lost'
    lossReason: null,

    // Geography
    route: TREK_ROUTE.ids,
    routeKm: TREK_ROUTE.kms,
    currentLandmarkIndex: 0,
    kmToNextLandmark: TREK_ROUTE.kms[0],
    totalKmTraveled: 0,

    // Resources. % values (except panels which is efficiency, and parts which
    // are discrete). Base levels are lower — supply loadout items bring them up.
    resources: {
      oxygen: 76,     // base; +8% per O₂ canister (default 3 = 100%)
      water:  76,     // base; +8% per H₂O tank (default 3 = 100%)
      power:  100,
      food:   76,     // base; +8% per ration pack (default 3 = 100%)
      panels: 100,
      mech: 4,
      eva:  4,
      cell: 3
    },`,
      },
    ],
  },
  {
    id: 'render',
    title: 'Render',
    body: `
      <p><code>src/render.js</code> is a pure <code>state → DOM</code> projection. It exports one function — <code>render(state)</code> — that is called after every state change. No partial updates, no diffing; just rebuild the panels it owns.</p>
      <p>This stays cheap because the DOM is small: a few panels, a crew list, a log. The simplicity is the feature.</p>
    `,
    snippets: [
      {
        path: 'src/render.js',
        lines: [345, 357],
        caption: 'Render entry',
        code: `// ---------- Top-level render ----------

let bound = false;
export function render(state) {
  if (!bound) { bindDom(); bound = true; }
  renderTopbar(state);
  renderRoute(state);
  renderTelemetry(state);
  renderCrew(state);
  renderControls(state);
  renderLog(state);
  renderActionBar(state);
}`,
      },
    ],
  },
  {
    id: 'hub',
    title: 'Systems architecture',
    body: `
      <p>The game logic lives under <code>src/systems/</code>. Click any tile below to take a short tour of that module and return here. Press <strong>Esc</strong> to come back. Digit keys <strong>1–8</strong> jump to a tile.</p>
    `,
    branches: [
      {
        id: 'travel',
        label: 'travel.js',
        sub: [
          {
            id: 's1',
            title: 'travel.js — pace, tick, arrival',
            body: `
              <p><code>src/systems/travel.js</code> owns the per-sol resource tick. It advances the rover by pace-dependent km, consumes power, rations, EVA charges, and decides when the rover arrives at the next landmark.</p>
              <p>The module is (mostly) pure: given a state and a pace, it returns a new state. That purity is what lets <code>sim/playtest1000.mjs</code> run thousands of simulated runs in a couple of seconds.</p>
            `,
            snippets: [
              {
                path: 'src/systems/travel.js',
                lines: [26, 54],
                caption: 'Pace-driven tunables',
                code: `// Tunable per-sol values. Balanced for a ~17-sol clean trek at steady pace.

const KM_PER_SOL = {
  cautious: 70,
  steady:   100,
  push:     150
};

// ± variance per sol. Cautious is predictable; push swings wide.
const KM_VARIANCE = {
  cautious: 0.10,   // ±10%
  steady:   0.18,   // ±18%
  push:     0.30    // ±30% — sometimes great, sometimes you hit a rut
};

const POWER_PER_SOL = {
  cautious: 2.5,
  steady:   4.2,
  push:     5.8
};

const FOOD_PER_SOL = {
  meager:   1.0,
  standard: 2.2,
  full:     3.2
};

const O2_PER_SOL  = 2.2;
const H2O_PER_SOL = 2.2;`,
              },
            ],
          },
          {
            id: 's2',
            title: 'travel.js — the sol tick',
            body: `
              <p>The heart of travel is <code>advanceSol()</code>: one function that runs once per "NEXT SOL" button press. It consumes resources, maybe rolls an event, maybe arrives at a landmark, and writes log lines.</p>
              <p>This excerpt covers the opening: clone-on-write, camp-mode guard, and the km math for a travel sol. Resource drain, arrival handling, and event rolls live further down in the same function.</p>
            `,
            snippets: [
              {
                path: 'src/systems/travel.js',
                lines: [96, 132],
                caption: 'advanceSol — setup and km math',
                code: `export function advanceSol(state, mode = 'travel') {
  if (state.status !== 'active') return state;

  // Camp mode: if an away team is out, the rover stays parked at the
  // detour turn-off. Resources drain and crew damage accrue as usual,
  // but km/travel/event-rolling are suppressed — the stage modal IS
  // the event for that sol.
  if (state.awayTeam && mode === 'travel') mode = 'camp';

  // Shallow clone the branches we'll mutate.
  let s = { ...state,
    resources: { ...state.resources },
    crew: state.crew.map(c => ({ ...c })),
    log: [...state.log],
    crewDialogue: null   // clear yesterday's speech bubble
  };

  s.sol = state.sol + 1;
  const powerDead = s.resources.power === 0;

  // ---- Travel (skipped on repair/clean/camp sols and when batteries are dead) ----
  let usableKm = 0;
  if (mode === 'travel' && !powerDead) {
    const pilotAlive = s.crew.some(c => c.role === 'pilot' && c.alive);
    const baseKm     = KM_PER_SOL[s.pace];
    const variance   = KM_VARIANCE[s.pace] * (pilotAlive ? 1 : NO_PILOT_VARIANCE_MULT);
    const jitter     = (Math.random() * 2 - 1) * variance;
    const pilotMult  = pilotAlive ? 1 + PILOT_KM_BONUS : 1;
    const lbs        = cargoPounds(s);
    const weightMult = Math.max(0.5, 1 - lbs * CARGO_WEIGHT_SPEED);
    const kmMult     = state.careerBonuses?.kmMult || 1;
    const km         = Math.max(0, baseKm * pilotMult * weightMult * kmMult * (1 + jitter));
    usableKm         = Math.min(km, s.kmToNextLandmark);

    s.totalKmTraveled += usableKm;
    s.kmToNextLandmark -= usableKm;
  }`,
              },
            ],
          },
        ],
      },
      {
        id: 'events',
        label: 'events.js + content/events.js',
        sub: [
          {
            id: 's1',
            title: 'events.js — rolling an event',
            body: `
              <p><code>src/systems/events.js</code> picks which event fires on a given sol, based on pace and per-event weighting. Event <em>data</em> lives separately in <code>src/content/events.js</code>: each entry has a title, body, and a set of choices with effects.</p>
              <p>This split (system vs. content) is the dominant pattern in the codebase: logic in <code>src/systems/</code>, data in <code>src/content/</code>. Content can grow without touching logic.</p>
            `,
            snippets: [
              {
                path: 'src/systems/events.js',
                lines: [23, 45],
                caption: 'Event selection',
                code: `// P(event per sol) by pace. Careful driving = fewer incidents.
const EVENT_BASE_RATE_BY_PACE = {
  cautious: 0.20,
  steady:   0.25,
  push:     0.78
};

// Pick a random event using weighted selection. One-shot events that have
// already fired this run are filtered out. Returns an event object or null.
export function rollEvent(state) {
  const rate = EVENT_BASE_RATE_BY_PACE[state.pace];
  if (Math.random() > rate) return null;
  const fired = state.firedEvents || [];
  const eligible = EVENTS.filter(e => !(e.oneShot && fired.includes(e.id)));
  if (eligible.length === 0) return null;
  const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
  let r = Math.random() * totalWeight;
  for (const e of eligible) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return eligible[eligible.length - 1];
}`,
              },
            ],
          },
          {
            id: 's2',
            title: 'Live: a random event card',
            body: `
              <p>Here is an event card, rendered by the <em>real</em> modal renderer against data from <code>src/content/events.js</code>. Click "Roll another" to re-roll. Choice buttons are real but don't apply effects — this preview is read-only.</p>
              <div id="demo-eventPreview-mount"></div>
            `,
            demo: 'eventPreview',
          },
        ],
      },
      {
        id: 'multistage',
        label: 'multiStage.js + multi-stage events',
        sub: [
          {
            id: 's1',
            title: 'multiStage.js — authored chains',
            body: `
              <p>A multi-stage event is an authored chain: each choice points to the next stage, or to an outcome. <code>src/systems/multiStage.js</code> is a tiny engine that walks that graph. <code>src/content/multiStageEvents.js</code> (and <code>emergencies.js</code>) are the authored data.</p>
              <p>The medical emergency (hub branch <strong>4</strong>) is the flagship example — a three-stage diagnosis-treatment-disposal chain.</p>
            `,
            snippets: [
              {
                path: 'src/systems/multiStage.js',
                lines: [10, 45],
                caption: 'Engine shape — resolving a stage choice',
                code: `// ---- Resolve a chosen option on a given stage ----
//
// Returns { state, nextStage, skillResult, damageTarget, applied, returnSolDelta }.
// state:          new state after outcome application.
// nextStage:      key of the next stage, or null to end the chain.
// skillResult:    present when the choice had a skillCheck.
// returnSolDelta: number to shift an away-team return sol by; 0 for non-away contexts.
export function applyStageChoice(state, event, stageId, choiceIdx) {
  const stage  = event.stages[stageId];
  const choice = stage?.choices[choiceIdx];
  if (!choice) return { state, nextStage: null, skillResult: null, damageTarget: null, applied: {}, returnSolDelta: 0 };

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
    applied,
    returnSolDelta: choice.returnSolDelta ?? 0
  };
}`,
              },
            ],
          },
        ],
      },
      { id: 'medical',     label: 'medicalEmergency.js',               sub: [{ id: 's1', title: 'medicalEmergency.js — placeholder', body: '<p>Branch content arrives in Task 12.</p>' }] },
      { id: 'clickmetrics',label: 'clickMetrics.js',                   sub: [{ id: 's1', title: 'clickMetrics.js — placeholder', body: '<p>Branch content arrives in Task 13.</p>' }] },
      { id: 'awayteam',    label: 'awayTeam.js',                       sub: [{ id: 's1', title: 'awayTeam.js — placeholder', body: '<p>Branch content arrives in Task 13.</p>' }] },
      { id: 'smallsys',    label: 'crew / corpse / waypoints',         sub: [{ id: 's1', title: 'Small systems — placeholder', body: '<p>Branch content arrives in Task 13.</p>' }] },
      { id: 'scoring',     label: 'career.js + scoring.js',            sub: [{ id: 's1', title: 'Career & scoring — placeholder', body: '<p>Branch content arrives in Task 13.</p>' }] },
    ],
  },
  // Slide 9 (hub) in Task 9, 10–16 in Task 13.
];
