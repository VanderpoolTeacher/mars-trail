// Mars Trail — travel system
// Pure functions. advanceSol(state) → newState.

import { landmarkName } from '../state.js';
import { rollEvent } from './events.js';
import { applyDamage, checkAllDead } from './crew.js';
import { makeLandmarkEncounter } from '../content/landmarks.js';

// Tunable per-sol values. Balanced for a ~17-sol clean trek at steady pace.

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
  cautious: 2.0,
  steady:   3.5,
  push:     5.0
};

const FOOD_PER_SOL = {
  meager:   1.3,
  standard: 2.3,
  full:     3.3
};

const O2_PER_SOL  = 2.0;
const H2O_PER_SOL = 2.0;

// Background per-sol health drain (radiation, fatigue). Always present.
const BACKGROUND_DAMAGE = 1;

// Health drain when a resource is critical (< 20%), per crew per sol.
const STARVATION_DAMAGE = 3;
const HYPOXIA_DAMAGE    = 10;
const DEHYDRATION_DAMAGE = 5;
const LOW_FOOD_DAMAGE   = 3;

// Power systems
const SOLAR_RECHARGE_PER_SOL = 2;    // passive trickle from clean solar panels
const PANEL_WIND_RECOVERY    = 3;    // % efficiency recovered naturally per sol
const NO_POWER_DAMAGE        = 8;    // life support failure when batteries dead
const REPAIR_POWER_GAIN      = 25;
const REPAIR_CELL_COST       = 1;    // one power cell per REPAIR
const CLEAN_EVA_COST         = 1;    // one EVA kit per panel cleaning
const CARGO_WEIGHT_POWER     = 0.15; // +PWR drain per sol per part carried (lighter = faster)

const PILOT_KM_BONUS = 0.10;   // +10% travel if pilot alive
const NO_PILOT_VARIANCE_MULT = 1.5;   // wider day-to-day swings without a pilot

export function advanceSol(state, mode = 'travel') {
  if (state.status !== 'active') return state;

  // Shallow clone the branches we'll mutate.
  let s = { ...state,
    resources: { ...state.resources },
    crew: state.crew.map(c => ({ ...c })),
    log: [...state.log]
  };

  s.sol = state.sol + 1;
  const powerDead = s.resources.power === 0;

  // ---- Travel (skipped on repair sols and when batteries are dead) ----
  let usableKm = 0;
  if (mode === 'travel' && !powerDead) {
    const pilotAlive = s.crew.some(c => c.role === 'pilot' && c.alive);
    const baseKm     = KM_PER_SOL[s.pace];
    const variance   = KM_VARIANCE[s.pace] * (pilotAlive ? 1 : NO_PILOT_VARIANCE_MULT);
    const jitter     = (Math.random() * 2 - 1) * variance;
    const pilotMult  = pilotAlive ? 1 + PILOT_KM_BONUS : 1;
    const km         = Math.max(0, baseKm * pilotMult * (1 + jitter));
    usableKm         = Math.min(km, s.kmToNextLandmark);

    s.totalKmTraveled += usableKm;
    s.kmToNextLandmark -= usableKm;
  }

  // ---- Resource consumption (life support always; travel power only when moving) ----
  s.resources.oxygen = Math.max(0, s.resources.oxygen - O2_PER_SOL);
  s.resources.water  = Math.max(0, s.resources.water  - H2O_PER_SOL);
  s.resources.food   = Math.max(0, s.resources.food   - FOOD_PER_SOL[s.rations]);

  // Net power: travel-power + cargo weight penalty + solar recharge (×panel efficiency).
  const panelMult   = s.resources.panels / 100;
  const cargoWeight = (s.resources.mech + s.resources.eva + s.resources.cell) * CARGO_WEIGHT_POWER;
  let powerDelta    = SOLAR_RECHARGE_PER_SOL * panelMult - cargoWeight;
  if (mode === 'travel' && !powerDead) powerDelta -= POWER_PER_SOL[s.pace];
  if (mode === 'repair') {
    powerDelta += REPAIR_POWER_GAIN;
    s.resources.cell = Math.max(0, s.resources.cell - REPAIR_CELL_COST);
  }
  if (mode === 'clean') {
    s.resources.panels = 100;
    s.resources.eva = Math.max(0, s.resources.eva - CLEAN_EVA_COST);
  } else {
    // Natural wind cleaning a bit each sol (tops out at 100).
    s.resources.panels = clamp(s.resources.panels + PANEL_WIND_RECOVERY, 0, 100);
  }
  s.resources.power = clamp(s.resources.power + powerDelta, 0, 200);

  // ---- Crew health drain (can now kill) ----
  // Snapshot ids first so applyDamage's new crew array doesn't break iteration.
  const aliveIds = s.crew.filter(c => c.alive).map(c => c.id);

  // Background wear: always present. Medic mitigates 30% via applyDamage.
  for (const id of aliveIds) s = applyDamage(s, id, BACKGROUND_DAMAGE, 'fatigue').state;

  if (s.rations === 'meager') {
    for (const id of aliveIds) s = applyDamage(s, id, STARVATION_DAMAGE,  'starvation').state;
  }
  if (s.resources.oxygen < 20) {
    for (const id of aliveIds) s = applyDamage(s, id, HYPOXIA_DAMAGE,     'hypoxia').state;
  }
  if (s.resources.water < 20) {
    for (const id of aliveIds) s = applyDamage(s, id, DEHYDRATION_DAMAGE, 'dehydration').state;
  }
  if (s.resources.food < 20) {
    for (const id of aliveIds) s = applyDamage(s, id, LOW_FOOD_DAMAGE,    'malnutrition').state;
  }
  if (powerDead) {
    for (const id of aliveIds) s = applyDamage(s, id, NO_POWER_DAMAGE,    'life support failure').state;
  }

  // ---- Sol-narrative log line (mode-dependent) ----
  if (mode === 'repair') {
    s.log.push({ sol: s.sol, text: `Power cell installed: +${REPAIR_POWER_GAIN}% PWR, -${REPAIR_CELL_COST} CELL. Rover stationary.` });
  } else if (mode === 'clean') {
    s.log.push({ sol: s.sol, text: `Panels scrubbed: PANELS restored to 100%, -${CLEAN_EVA_COST} EVA. Rover stationary.` });
  } else if (powerDead) {
    s.log.push({ sol: s.sol, text: 'Batteries dead. Rover stationary. Life support failing.' });
  }

  // ---- Landmark arrival / travel log (travel mode only) ----
  if (mode === 'travel' && usableKm > 0) {
    if (s.kmToNextLandmark === 0) {
      s.currentLandmarkIndex += 1;
      const arrivedId = s.route[s.currentLandmarkIndex];
      s.log.push({ sol: s.sol, text: `Arrived at ${landmarkName(arrivedId)}.` });

      if (s.currentLandmarkIndex >= s.route.length - 1) {
        // Final destination — no stop encounter, mission complete.
        s.status = 'won';
        const survived = s.crew.filter(c => c.alive).length;
        s.log.push({ sol: s.sol, text: `Mission accomplished. ${survived}/${s.crew.length} crew survived.` });
      } else {
        // Set up next segment and open a landmark-stop encounter.
        s.kmToNextLandmark = s.routeKm[s.currentLandmarkIndex];
        s.activeModal = { type: 'event', payload: makeLandmarkEncounter(arrivedId) };
      }
    } else {
      const nextName = landmarkName(s.route[s.currentLandmarkIndex + 1]);
      s.log.push({
        sol: s.sol,
        text: `Traveled ${Math.round(usableKm)} km. ${Math.round(s.kmToNextLandmark)} km to ${nextName}.`
      });
    }
  }

  // ---- Loss checks (no instant loss on power=0; rover halts and crew take damage instead) ----
  if (s.resources.oxygen === 0 && s.status === 'active') {
    s.status = 'lost';
    s.lossReason = 'no_oxygen';
    s.log.push({ sol: s.sol, text: 'Oxygen tanks depleted. Mission lost.' });
  }
  s = checkAllDead(s);

  // ---- Roll for random event (travel sols only, only if not already in a modal) ----
  if (mode === 'travel' && s.status === 'active' && !s.activeModal) {
    const event = rollEvent(s);
    if (event) {
      s.activeModal = { type: 'event', payload: event };
    }
  }

  return s;
}

// Convenience: dedicate a sol to repair instead of travel.
export function repairBattery(state) {
  if (state.status !== 'active') return state;
  if (state.resources.cell < REPAIR_CELL_COST) return state;
  if (state.resources.power >= 100) return state;
  return advanceSol(state, 'repair');
}

// Dedicate a sol to scrubbing the solar panels clean.
export function cleanPanels(state) {
  if (state.status !== 'active') return state;
  if (state.resources.eva < CLEAN_EVA_COST) return state;
  if (state.resources.panels >= 100) return state;
  return advanceSol(state, 'clean');
}

export function canRepair(state) {
  return state.status === 'active'
      && state.activeModal == null
      && state.resources.cell >= REPAIR_CELL_COST
      && state.resources.power < 100;
}

export function canClean(state) {
  return state.status === 'active'
      && state.activeModal == null
      && state.resources.eva >= CLEAN_EVA_COST
      && state.resources.panels < 100;
}

export function setPace(state, pace) {
  if (state.pace === pace) return state;
  const log = [...state.log, { sol: state.sol, text: `Pace set to ${pace}.` }];
  return { ...state, pace, log };
}

export function setRations(state, rations) {
  if (state.rations === rations) return state;
  const log = [...state.log, { sol: state.sol, text: `Rations set to ${rations}.` }];
  return { ...state, rations, log };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
