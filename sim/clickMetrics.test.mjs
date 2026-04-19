// Tests for src/systems/clickMetrics.js (issue #63).
// Run: node --test sim/clickMetrics.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLICK_METRICS_CONFIG,
  initialClickMetrics,
  expectedReadMs,
  classifyDecision,
  recordDecision,
  shouldFireEmergency,
  afterEmergencyFired
} from '../src/systems/clickMetrics.js';

test('initialClickMetrics starts at zero', () => {
  const m = initialClickMetrics();
  assert.equal(m.mashScore, 0);
  assert.equal(m.emergenciesFired, 0);
});

test('expectedReadMs respects the min floor for very short text', () => {
  assert.equal(expectedReadMs(''), CLICK_METRICS_CONFIG.minReadMs);
  assert.equal(expectedReadMs('hi'), CLICK_METRICS_CONFIG.minReadMs);
});

test('expectedReadMs scales linearly with longer text', () => {
  const longText = 'x'.repeat(200);
  assert.equal(expectedReadMs(longText), 200 * CLICK_METRICS_CONFIG.readMsPerChar);
});

test('classifyDecision buckets match the documented thresholds', () => {
  const expected = 10_000;
  assert.equal(classifyDecision(500,  expected), 'didNotRead');   // <20%
  assert.equal(classifyDecision(3000, expected), 'skim');         // 30%
  assert.equal(classifyDecision(6000, expected), 'hurried');      // 60%
  assert.equal(classifyDecision(9000, expected), 'normal');       // 90%
  assert.equal(classifyDecision(12000, expected), 'thoughtful');  // >100%
});

test('recordDecision accumulates mashScore for fast clicks', () => {
  let m = initialClickMetrics();
  const body = 'x'.repeat(100);          // expected ~3500ms
  m = recordDecision(m, 100, body);      // didNotRead → +3
  assert.equal(m.mashScore, 3);
  m = recordDecision(m, 100, body);      // +3 again → 6
  assert.equal(m.mashScore, 6);
});

test('recordDecision decays mashScore for thoughtful reads and floors at 0', () => {
  let m = { ...initialClickMetrics(), mashScore: 1 };
  const body = 'x'.repeat(100);
  m = recordDecision(m, 10_000, body);   // thoughtful → -1 → 0
  assert.equal(m.mashScore, 0);
  m = recordDecision(m, 10_000, body);   // -1 but floored to 0
  assert.equal(m.mashScore, 0);
});

test('shouldFireEmergency respects threshold and per-run cap', () => {
  assert.equal(shouldFireEmergency({ mashScore: 5, emergenciesFired: 0 }), false);
  assert.equal(shouldFireEmergency({ mashScore: 6, emergenciesFired: 0 }), true);
  assert.equal(
    shouldFireEmergency({ mashScore: 99, emergenciesFired: CLICK_METRICS_CONFIG.maxEmergenciesPerRun }),
    false,
    'cap prevents runaway chain of emergencies'
  );
  assert.equal(shouldFireEmergency(null), false);
});

test('afterEmergencyFired bumps counter and cools down mashScore', () => {
  const before = { mashScore: 8, emergenciesFired: 0 };
  const after = afterEmergencyFired(before);
  assert.equal(after.emergenciesFired, 1);
  assert.equal(after.mashScore, 8 + CLICK_METRICS_CONFIG.emergencyCooldownDelta);
  assert.ok(after.mashScore >= 0);
});

test('sustained mashing trips emergency, cap stops further fires', () => {
  let m = initialClickMetrics();
  const body = 'x'.repeat(50);
  // Six rapid clicks should reach threshold.
  for (let i = 0; i < 2; i++) m = recordDecision(m, 50, body);  // +3+3 = 6
  assert.equal(shouldFireEmergency(m), true);

  // Fire the first emergency.
  m = afterEmergencyFired(m);
  assert.equal(m.emergenciesFired, 1);

  // Re-arm and fire a second.
  for (let i = 0; i < 3; i++) m = recordDecision(m, 50, body);
  assert.equal(shouldFireEmergency(m), true);
  m = afterEmergencyFired(m);
  assert.equal(m.emergenciesFired, 2);

  // Further mashing should not trip a third.
  for (let i = 0; i < 5; i++) m = recordDecision(m, 50, body);
  assert.equal(shouldFireEmergency(m), false, 'cap holds');
});
