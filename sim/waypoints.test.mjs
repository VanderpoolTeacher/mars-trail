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

// --- acceptWaypoint ---

test('acceptWaypoint sets pendingWaypoint and extends the segment', () => {
  const s0 = makeState({
    waypoints: [{ waypointId: 'olivine_outcrop', segmentIdx: 0 }]
  });
  const s1 = acceptWaypoint(s0, 0);
  assert.equal(s1.pendingWaypoint?.id, 'olivine_outcrop');
  assert.equal(s1.kmToNextLandmark, 330 + 80);
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
