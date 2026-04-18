// Mars Trail — science waypoints system (issue #7 part 1; rebuilt for #17 in v0.7.0).
// Pure functions over state. No DOM, no localStorage, no side effects.
//
// The old "accept → detour km added → resolve at next landmark" flow was
// removed in v0.7.0. Acceptance now dispatches to the away-team picker
// (see src/systems/awayTeam.js). Declining and pre-roll of waypoints
// still live here.

import { WAYPOINTS } from '../content/waypoints.js';

export const WAYPOINT_ROLL_PROB = 0.4;   // per non-final segment
export const MIN_WAYPOINTS_PER_RUN = 2;  // issue #34

// ---- Run-start roll ----
// Picks at most one waypoint per eligible segment. segmentIdx matches the
// currentLandmarkIndex at which the offer fires (arrival at landmark N →
// offer segment N waypoint). Skip 0 (origin — never "arrived at") and the
// final landmark (mission complete — no encounter). Issue #22.
//
// Two-pass roll: probabilistic per-segment pass as normal, then a top-up
// pass that fills empty segments until MIN_WAYPOINTS_PER_RUN is reached
// (issue #34) — a run without a science path would lock the player at B.
export function rollWaypoints(state) {
  const usedIds = new Set();
  const usedSegments = new Set();
  const waypoints = [];

  // Pass 1: probabilistic roll per eligible segment.
  for (let segmentIdx = 1; segmentIdx < state.route.length - 1; segmentIdx++) {
    if (Math.random() >= WAYPOINT_ROLL_PROB) continue;
    const candidates = WAYPOINTS.filter(w => !usedIds.has(w.id));
    if (candidates.length === 0) break;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    usedIds.add(pick.id);
    usedSegments.add(segmentIdx);
    waypoints.push({ waypointId: pick.id, segmentIdx });
  }

  // Pass 2: top-up until we hit the per-run floor (or run out of room).
  while (waypoints.length < MIN_WAYPOINTS_PER_RUN) {
    const empty = [];
    for (let segmentIdx = 1; segmentIdx < state.route.length - 1; segmentIdx++) {
      if (!usedSegments.has(segmentIdx)) empty.push(segmentIdx);
    }
    const candidates = WAYPOINTS.filter(w => !usedIds.has(w.id));
    if (empty.length === 0 || candidates.length === 0) break;
    const segmentIdx = empty[Math.floor(Math.random() * empty.length)];
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    usedIds.add(pick.id);
    usedSegments.add(segmentIdx);
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
