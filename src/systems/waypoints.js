// Mars Trail — science waypoints system (issue #7 part 1; rebuilt for #17 in v0.7.0).
// Pure functions over state. No DOM, no localStorage, no side effects.
//
// The old "accept → detour km added → resolve at next landmark" flow was
// removed in v0.7.0. Acceptance now dispatches to the away-team picker
// (see src/systems/awayTeam.js). Declining and pre-roll of waypoints
// still live here.

import { WAYPOINTS } from '../content/waypoints.js';

export const WAYPOINT_ROLL_PROB = 0.4;   // per non-final segment

// ---- Run-start roll ----
// Picks at most one waypoint per eligible segment. segmentIdx matches the
// currentLandmarkIndex at which the offer fires (arrival at landmark N →
// offer segment N waypoint). Skip 0 (origin — never "arrived at") and the
// final landmark (mission complete — no encounter). Issue #22.
export function rollWaypoints(state) {
  const used = new Set();
  const waypoints = [];
  for (let segmentIdx = 1; segmentIdx < state.route.length - 1; segmentIdx++) {
    if (Math.random() >= WAYPOINT_ROLL_PROB) continue;
    const candidates = WAYPOINTS.filter(w => !used.has(w.id));
    if (candidates.length === 0) break;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    used.add(pick.id);
    waypoints.push({ waypointId: pick.id, segmentIdx });
  }
  return { ...state, waypoints };
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
