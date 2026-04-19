// Mars Trail — travel system
// Pure functions. advanceSol(state) → newState.

import { landmarkName, PART_TYPES } from '../state.js';
import { rollEvent } from './events.js';
import { rollMultiStageEvent } from './multiStage.js';
import { shouldFireEmergency, afterEmergencyFired } from './clickMetrics.js';
import { pickEmergency } from '../content/emergencies.js';
import { applyDamage, checkAllDead } from './crew.js';
import { makeLandmarkEncounter } from '../content/landmarks.js';
import { WAYPOINTS } from '../content/waypoints.js';
import { advanceAwayTeam, MIN_CREW_FOR_DIVERT } from './awayTeam.js';
import { beginMedicalEmergency } from './medicalEmergency.js';

// Total carried weight in pounds. Persistent parts (MECH/EVA/CELL) plus any
// corpses the crew is carrying back (180 LB each by default).
function cargoPounds(state) {
  let lbs = 0;
  for (const t of PART_TYPES) {
    if (!t.supply) lbs += (state.resources[t.key] || 0) * t.lbs;
  }
  for (const c of state.corpses) lbs += c.weightLbs;
  return lbs;
}

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
const H2O_PER_SOL = 2.2;

// Life-support draw multiplier by pace. Slower rover = less energy used
// = less O₂/H₂O consumption per sol. Does not touch food (rations lever).
const LIFE_SUPPORT_MULT_BY_PACE = {
  cautious: 0.56,
  steady:   0.80,
  push:     1.15
};

// Per-sol health drain (radiation, fatigue). Scales with pace:
// careful driving = less crew fatigue.
const BACKGROUND_DAMAGE_BY_PACE = {
  cautious: 0,
  steady:   1,
  push:     3
};

// Critical resource threshold — damage kicks in when resource < this value.
const LOW_RESOURCE_THRESHOLD = 25;

// Health drain when a resource is critical (< threshold), per crew per sol.
const HYPOXIA_DAMAGE    = 12;
const DEHYDRATION_DAMAGE = 6;
const LOW_FOOD_DAMAGE   = 4;

// Power systems
// Hybrid power: RTG trickle (always) + solar bonus (when panels are clean).
// RTG = radioisotope thermoelectric generator; mirrors Curiosity/Perseverance.
const RTG_RECHARGE_PER_SOL   = 1.5;  // reliable RTG baseline, weather-independent
const SOLAR_RECHARGE_PER_SOL = 2;    // clean-panel solar bonus
const PANEL_WIND_RECOVERY    = 3;    // % efficiency recovered naturally per sol
const NO_POWER_DAMAGE        = 8;    // life support failure when batteries dead
const REPAIR_POWER_GAIN      = 25;
const REPAIR_CELL_COST       = 1;    // one power cell per REPAIR
const CLEAN_EVA_COST         = 1;    // one EVA kit per panel cleaning
const CARGO_WEIGHT_POWER     = 0.005;  // +PWR drain per sol per lb carried
const CARGO_WEIGHT_SPEED     = 0.00035;// −km/sol multiplier per lb carried

const PILOT_KM_BONUS = 0.10;   // +10% travel if pilot alive
const NO_PILOT_VARIANCE_MULT = 1.5;   // wider day-to-day swings without a pilot

export function advanceSol(state, mode = 'travel') {
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
  }

  // ---- Resource consumption (life support always; travel power only when moving) ----
  // Camp mode (issue #25): rover life-support scales with rover-side crew share —
  // the away team runs off EVA-kit supplies, not the shared rover reserve. Uses
  // crew.length (max) as denominator so permanent deaths don't paradoxically
  // reduce rover drain.
  const roverShare = (mode === 'camp' && state.awayTeam)
    ? (state.crew.length - state.awayTeam.crewIds.length) / state.crew.length
    : 1;
  const careerLifeMult  = state.careerBonuses?.lifeSupportMult || 1;
  const lifeSupportMult = LIFE_SUPPORT_MULT_BY_PACE[s.pace] * careerLifeMult * roverShare;
  s.resources.oxygen = Math.max(0, s.resources.oxygen - O2_PER_SOL  * lifeSupportMult);
  s.resources.water  = Math.max(0, s.resources.water  - H2O_PER_SOL * lifeSupportMult);
  s.resources.food   = Math.max(0, s.resources.food   - FOOD_PER_SOL[s.rations] * roverShare);

  // Net power: RTG baseline + solar bonus (×panel efficiency) − travel − cargo weight.
  const panelMult   = s.resources.panels / 100;
  const cargoWeight = cargoPounds(s) * CARGO_WEIGHT_POWER;
  let powerDelta    = RTG_RECHARGE_PER_SOL + (SOLAR_RECHARGE_PER_SOL * panelMult) - cargoWeight;
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
  s.resources.power = clamp(s.resources.power + powerDelta, 0, 100);

  // ---- Crew health drain (can now kill) ----
  // Snapshot ids first so applyDamage's new crew array doesn't break iteration.
  const aliveIds = s.crew.filter(c => c.alive).map(c => c.id);

  // Background wear: always present. Medic mitigates 30% via applyDamage.
  const bgDamage = BACKGROUND_DAMAGE_BY_PACE[s.pace];
  for (const id of aliveIds) s = applyDamage(s, id, bgDamage, 'fatigue').state;

  if (s.resources.oxygen < LOW_RESOURCE_THRESHOLD) {
    for (const id of aliveIds) s = applyDamage(s, id, HYPOXIA_DAMAGE,     'hypoxia').state;
  }
  if (s.resources.water < LOW_RESOURCE_THRESHOLD) {
    for (const id of aliveIds) s = applyDamage(s, id, DEHYDRATION_DAMAGE, 'dehydration').state;
  }
  if (s.resources.food < LOW_RESOURCE_THRESHOLD) {
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
      s.log.push({ sol: s.sol, text: `Arrived at ${landmarkName(arrivedId)} before dusk. Parking for EVA prep.` });

      if (s.currentLandmarkIndex >= s.route.length - 1) {
        // Final destination — no stop encounter, mission complete.
        s.status = 'won';
        const survived = s.crew.filter(c => c.alive).length;
        s.log.push({ sol: s.sol, text: `Mission accomplished. ${survived}/${s.crew.length} crew survived.` });
      } else {
        // Set up the next segment's base distance.
        s.kmToNextLandmark = s.routeKm[s.currentLandmarkIndex];

        // Step A — If this segment has a rolled waypoint not yet offered, open the
        // offer (only when enough crew are alive to safely dispatch an away team).
        const aliveCrewCount = s.crew.filter(c => c.alive).length;
        const segmentWp = s.waypoints.find(w => w.segmentIdx === s.currentLandmarkIndex);
        if (segmentWp
            && !s.firedWaypoints.includes(segmentWp.waypointId)
            && aliveCrewCount >= MIN_CREW_FOR_DIVERT) {
          const waypoint = WAYPOINTS.find(w => w.id === segmentWp.waypointId);
          if (waypoint) {
            s.activeModal = {
              type: 'waypoint_offer',
              payload: { waypoint, segmentIdx: s.currentLandmarkIndex }
            };
            return s;
          }
        }

        // Step B — Normal landmark encounter.
        s.activeModal = { type: 'event', payload: makeLandmarkEncounter(arrivedId) };
      }
    } else {
      // Sol rhythm flavor — rotate through dawn/midday/dusk phrasing.
      const phrase = travelPhrase(s.sol, Math.round(usableKm));
      const nextName = landmarkName(s.route[s.currentLandmarkIndex + 1]);
      s.log.push({
        sol: s.sol,
        text: `${phrase} ${Math.round(s.kmToNextLandmark)} km to ${nextName}.`
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
    // Mash-detection emergency: pre-empts the normal event roll when the
    // click-metrics heuristic has flagged sustained click-through behavior.
    if (shouldFireEmergency(s.clickMetrics)) {
      const emergency = pickEmergency();
      s.activeModal = { type: 'multi_stage', payload: { event: emergency, stageId: emergency.startStage } };
      s.clickMetrics = afterEmergencyFired(s.clickMetrics);
      s.log = [...s.log, { sol: s.sol, text: '⚠ ANOMALY — systems flag inattentive operator. Emergency scenario.' }];
    } else {
      const event = rollEvent(s);
      if (event) {
        s.activeModal = { type: 'event', payload: event };
        if (event.oneShot) s.firedEvents = [...s.firedEvents, event.id];
      } else {
        const msEvent = rollMultiStageEvent(s);
        if (msEvent) {
          if (msEvent.customResolver === 'medical') {
            s = beginMedicalEmergency(s);
          } else {
            s.activeModal = { type: 'multi_stage', payload: { event: msEvent, stageId: msEvent.startStage } };
            if (msEvent.oneShot) s.firedEvents = [...s.firedEvents, msEvent.id];
          }
        }
      }
    }
  }

  // ---- Camp-mode tick: advance the away-team lifecycle ----
  if (mode === 'camp' && s.status === 'active') {
    s = advanceAwayTeam(s);
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

// Sol-phase flavor. Cycles through the daily rhythm: dawn prep →
// morning drive → midday EVA → afternoon push → dusk park.
function travelPhrase(sol, km) {
  const phrases = [
    `Dawn sys-check, drove ${km} km through morning light.`,
    `Rolled ${km} km. Midday thermal radiators dumped cabin heat.`,
    `Traversed ${km} km; stopped at noon for wheel inspection.`,
    `Drove ${km} km into late afternoon, parked facing east for dawn charge.`,
    `${km} km on steady power. Comms window with Earth at dusk — 18m delay.`,
    `Skirted regolith drift; ${km} km logged. Night watch rotation begins.`,
    `${km} km of basalt washboard. RTG steady; batteries at nominal.`,
    `Covered ${km} km. Panel wipedown at parking. Perchlorate dust logged.`
  ];
  return phrases[sol % phrases.length];
}
