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

// Helper: stub Math.random with a sequence of values (auto-cycles).
function withRandom(values, fn) {
  const original = Math.random;
  let i = 0;
  Math.random = () => values[i++ % values.length];
  try { return fn(); }
  finally { Math.random = original; }
}

test('resolveWaypoint on SUCCESS: full SCI + advanced fact + success flag', () => {
  const olivine = WAYPOINTS.find(w => w.id === 'olivine_outcrop');
  const s0 = makeState({
    pendingWaypoint: { ...olivine },
    sciencePoints: 10,
    factsLearned: [],
    crew: [
      { id: 'c1', role: 'engineer', alive: true },   // GEOLOGY waypoint → engineer
      { id: 'c2', role: 'biologist', alive: true },
      { id: 'c3', role: 'medic', alive: true },
      { id: 'c4', role: 'pilot', alive: true },
      { id: 'c5', role: 'security', alive: true }
    ]
  });
  // Math.random sequence: [skill-check, jitter, fact-pick]. 0.01 < 0.75 → success.
  const s1 = withRandom([0.01, 0.5, 0.3], () => resolveWaypoint(s0));
  assert.equal(s1.activeModal.payload.success, true);
  assert.equal(s1.factsLearned.length, 1, 'advanced fact added on success');
  assert.ok(s1.sciencePoints > 10, 'SCI increased');
  assert.ok(s1.firedWaypoints.includes('olivine_outcrop'));
  assert.equal(s1.pendingWaypoint, null);
  assert.equal(s1.activeModal.payload.role, 'engineer');
  assert.equal(s1.activeModal.payload.specialistAlive, true);
});

test('resolveWaypoint on FAILURE: partial SCI + no advanced fact + success=false', () => {
  const olivine = WAYPOINTS.find(w => w.id === 'olivine_outcrop');
  const s0 = makeState({
    pendingWaypoint: { ...olivine },
    sciencePoints: 10,
    factsLearned: [],
    crew: [
      { id: 'c1', role: 'engineer', alive: true },
      { id: 'c2', role: 'biologist', alive: true },
      { id: 'c3', role: 'medic', alive: true },
      { id: 'c4', role: 'pilot', alive: true },
      { id: 'c5', role: 'security', alive: true }
    ]
  });
  // Math.random: [0.99 (skill fail), 0.5 (jitter)]. 0.99 > 0.75 → fail.
  const s1 = withRandom([0.99, 0.5], () => resolveWaypoint(s0));
  assert.equal(s1.activeModal.payload.success, false);
  assert.equal(s1.factsLearned.length, 0, 'no advanced fact on failure');
  assert.ok(s1.sciencePoints > 10, 'partial SCI credited');
  assert.equal(s1.activeModal.payload.fact, '');
});

test('resolveWaypoint with dead specialist uses lower base P', () => {
  const olivine = WAYPOINTS.find(w => w.id === 'olivine_outcrop');
  const s0 = makeState({
    pendingWaypoint: { ...olivine },
    crew: [
      { id: 'c1', role: 'engineer', alive: false },  // specialist dead
      { id: 'c2', role: 'biologist', alive: true }
    ]
  });
  // 0.40 is > 0.35 (fail threshold with dead specialist), so fail.
  const s1 = withRandom([0.40, 0.5], () => resolveWaypoint(s0));
  assert.equal(s1.activeModal.payload.specialistAlive, false);
  assert.equal(s1.activeModal.payload.success, false);
  // 0.20 is < 0.35, so success.
  const s2 = withRandom([0.20, 0.5, 0.3], () => resolveWaypoint(s0));
  assert.equal(s2.activeModal.payload.success, true);
});

test('resolveWaypoint applies career skillBonus to effective P', () => {
  const olivine = WAYPOINTS.find(w => w.id === 'olivine_outcrop');
  const s0 = makeState({
    pendingWaypoint: { ...olivine },
    careerBonuses: { skillBonus: 0.10 },             // tier 3 methodology
    crew: [
      { id: 'c1', role: 'engineer', alive: false }   // dead: baseP = 0.35
    ]
  });
  // With bonus: effectiveP = 0.45. A roll of 0.40 should succeed (would fail without bonus).
  const s1 = withRandom([0.40, 0.5, 0.3], () => resolveWaypoint(s0));
  assert.equal(s1.activeModal.payload.success, true);
});

test('resolveWaypoint is a no-op when no pendingWaypoint', () => {
  const s0 = makeState({ pendingWaypoint: null });
  const s1 = resolveWaypoint(s0);
  assert.equal(s1, s0);
});
