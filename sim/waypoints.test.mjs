// Tests for src/systems/waypoints.js. Run: node --test sim/waypoints.test.mjs
//
// Scope: rollWaypoints + declineWaypoint. The old resolveWaypoint /
// acceptWaypoint flow was removed in v0.7.0 when waypoints became
// away-team missions — see sim/awayTeam.test.mjs for the replacement
// coverage.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rollWaypoints,
  declineWaypoint,
  WAYPOINT_ROLL_PROB
} from '../src/systems/waypoints.js';

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
    firedWaypoints: [],
    log: [],
    ...overrides
  };
}

// --- rollWaypoints ---

test('rollWaypoints produces 0–6 waypoints on a standard route', () => {
  for (let i = 0; i < 50; i++) {
    const s = rollWaypoints(makeState());
    assert.ok(s.waypoints.length >= 0 && s.waypoints.length <= 6,
      `waypoints.length=${s.waypoints.length} out of range`);
    const segs = s.waypoints.map(w => w.segmentIdx);
    assert.equal(new Set(segs).size, segs.length, 'duplicate segmentIdx');
    const ids = s.waypoints.map(w => w.waypointId);
    assert.equal(new Set(ids).size, ids.length, 'duplicate waypoint id');
    for (const entry of s.waypoints) {
      assert.ok(entry.segmentIdx < s.route.length - 2,
        `segmentIdx ${entry.segmentIdx} should be < ${s.route.length - 2}`);
    }
  }
});

test('rollWaypoints gives every segment a fair chance over many runs', () => {
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

// --- declineWaypoint ---

test('declineWaypoint pushes the waypoint id to firedWaypoints', () => {
  const s0 = makeState({ firedWaypoints: [] });
  const s1 = declineWaypoint(s0, 'olivine_outcrop');
  assert.deepEqual(s1.firedWaypoints, ['olivine_outcrop']);
  assert.ok(s1.log.some(l => l.text.includes('Detour declined')));
});
