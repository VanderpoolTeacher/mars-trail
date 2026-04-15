// Mars Trail — travel system
// Pure functions. advanceSol(state) → newState.

import { landmarkName } from '../state.js';
import { rollEvent } from './events.js';

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
  cautious: 1.5,
  steady:   2.5,
  push:     4.0
};

const FOOD_PER_SOL = {
  meager:   1.0,
  standard: 2.0,
  full:     3.0
};

const O2_PER_SOL  = 1.5;
const H2O_PER_SOL = 1.5;

const PILOT_KM_BONUS = 0.10;   // +10% travel if pilot alive

export function advanceSol(state) {
  if (state.status !== 'active') return state;

  // Shallow clone the branches we'll mutate.
  const s = { ...state,
    resources: { ...state.resources },
    crew: state.crew.map(c => ({ ...c })),
    log: [...state.log]
  };

  s.sol = state.sol + 1;

  // ---- Travel ----
  const pilotAlive = s.crew.some(c => c.role === 'pilot' && c.alive);
  const baseKm     = KM_PER_SOL[s.pace];
  const variance   = KM_VARIANCE[s.pace];
  const jitter     = (Math.random() * 2 - 1) * variance;   // [-variance, +variance]
  const pilotMult  = pilotAlive ? 1 + PILOT_KM_BONUS : 1;
  const km         = Math.max(0, baseKm * pilotMult * (1 + jitter));
  const usableKm   = Math.min(km, s.kmToNextLandmark);

  s.totalKmTraveled += usableKm;
  s.kmToNextLandmark -= usableKm;

  // ---- Resource consumption ----
  s.resources.oxygen = clamp(s.resources.oxygen - O2_PER_SOL,                0, 100);
  s.resources.water  = clamp(s.resources.water  - H2O_PER_SOL,               0, 100);
  s.resources.food   = clamp(s.resources.food   - FOOD_PER_SOL[s.rations],   0, 100);
  s.resources.power  = clamp(s.resources.power  - POWER_PER_SOL[s.pace],     0, 100);

  // ---- Crew health effects (no death yet — slice 5) ----
  if (s.rations === 'meager') {
    s.crew.forEach(c => { if (c.alive) c.health = clamp(c.health - 1, 0, 100); });
  }
  if (s.resources.oxygen < 20) {
    s.crew.forEach(c => { if (c.alive) c.health = clamp(c.health - 5, 0, 100); });
  }

  // ---- Landmark arrival ----
  if (s.kmToNextLandmark === 0) {
    s.currentLandmarkIndex += 1;
    const arrived = s.route[s.currentLandmarkIndex];
    s.log.push({ sol: s.sol, text: `Arrived at ${landmarkName(arrived)}.` });

    if (s.currentLandmarkIndex >= s.route.length - 1) {
      s.status = 'won';
      const survived = s.crew.filter(c => c.alive).length;
      s.log.push({ sol: s.sol, text: `Mission accomplished. ${survived}/${s.crew.length} crew survived.` });
    } else {
      const segmentKm = s.routeKm[s.currentLandmarkIndex];
      s.kmToNextLandmark = segmentKm;
      const nextName = landmarkName(s.route[s.currentLandmarkIndex + 1]);
      s.log.push({ sol: s.sol, text: `Departing for ${nextName}. ${segmentKm} km.` });
    }
  } else {
    const nextName = landmarkName(s.route[s.currentLandmarkIndex + 1]);
    s.log.push({
      sol: s.sol,
      text: `Traveled ${Math.round(usableKm)} km. ${Math.round(s.kmToNextLandmark)} km to ${nextName}.`
    });
  }

  // ---- Loss check ----
  if (s.resources.oxygen === 0 && s.status === 'active') {
    s.status = 'lost';
    s.lossReason = 'no_oxygen';
    s.log.push({ sol: s.sol, text: 'Oxygen tanks depleted. Mission lost.' });
  }

  // ---- Roll for random event (only if still active) ----
  if (s.status === 'active') {
    const event = rollEvent(s);
    if (event) {
      s.activeModal = { type: 'event', payload: event };
    }
  }

  return s;
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
