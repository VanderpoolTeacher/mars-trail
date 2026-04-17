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

// Specialist role by science category — who interprets the sample.
const WAYPOINT_ROLE_BY_POOL = {
  GEOLOGY:      'engineer',
  WATER:        'biologist',
  ATMOSPHERE:   'pilot',
  ASTROBIOLOGY: 'biologist'
};

// Base skill-check probability: 75% with specialist alive, 35% without.
// Career tier 3 (methodology) adds +skillBonus, capped at 95%.
const WAYPOINT_BASE_P          = 0.75;
const WAYPOINT_NO_SPECIALIST_P = 0.35;
const WAYPOINT_MAX_P           = 0.95;
const WAYPOINT_FAIL_SCI_FRAC   = 0.5;

// ---- Detour reached: roll skill check, apply reward, queue reward modal ----
export function resolveWaypoint(state) {
  const w = state.pendingWaypoint;
  if (!w) return state;

  const role = WAYPOINT_ROLE_BY_POOL[w.factPool] || 'biologist';
  const specialistAlive = state.crew.some(c => c.role === role && c.alive);
  const baseP = specialistAlive ? WAYPOINT_BASE_P : WAYPOINT_NO_SPECIALIST_P;
  const bonus = state.careerBonuses?.skillBonus || 0;
  const effectiveP = Math.min(WAYPOINT_MAX_P, baseP + bonus);
  const success = Math.random() < effectiveP;

  const jitter = 1 + (Math.random() * 2 - 1) * SCIENCE_JITTER_FRAC;
  const fullReward = Math.max(0, Math.round(w.sciencePoints * jitter));
  const sciencePointsGained = success
    ? fullReward
    : Math.floor(fullReward * WAYPOINT_FAIL_SCI_FRAC);

  // Advanced fact only on success.
  const pool = ADVANCED_POOLS[w.factPool] || [];
  const fact = (success && pool.length) ? pool[Math.floor(Math.random() * pool.length)] : '';

  const alreadyLearned = fact && state.factsLearned.includes(fact);
  const factsLearned = fact && !alreadyLearned
    ? [...state.factsLearned, fact]
    : state.factsLearned;

  const logText = success
    ? `${w.name}: ${role} analysis conclusive. +${sciencePointsGained} SCI.`
    : `${w.name}: ${role} analysis inconclusive — data partial. +${sciencePointsGained} SCI.`;

  return {
    ...state,
    sciencePoints: state.sciencePoints + sciencePointsGained,
    factsLearned,
    firedWaypoints: [...state.firedWaypoints, w.id],
    pendingWaypoint: null,
    log: [
      ...state.log,
      { sol: state.sol, text: logText }
    ],
    activeModal: {
      type: 'waypoint_reward',
      payload: { waypoint: w, sciencePointsGained, fact, success, role, specialistAlive }
    }
  };
}
