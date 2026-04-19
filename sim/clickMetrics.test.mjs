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
import { EMERGENCY_TEMPLATES, materializeEmergency, pickEmergency } from '../src/content/emergencies.js';

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
  const t = CLICK_METRICS_CONFIG.mashScoreThreshold;
  assert.equal(shouldFireEmergency({ mashScore: t - 1, emergenciesFired: 0 }), false);
  assert.equal(shouldFireEmergency({ mashScore: t,     emergenciesFired: 0 }), true);
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

test('every emergency template has valid structure', () => {
  for (const t of EMERGENCY_TEMPLATES) {
    assert.ok(t.id, 'id');
    assert.ok(t.startStage, 'startStage');
    assert.ok(t.stages[t.startStage], 'startStage exists in stages');
    for (const [stageId, stage] of Object.entries(t.stages)) {
      assert.ok(stage.descriptionTemplate, `${t.id}.${stageId}.descriptionTemplate`);
      assert.ok(Array.isArray(stage.variants) && stage.variants.length >= 2,
        `${t.id}.${stageId} must have ≥2 variants for anti-memorization`);
      assert.ok(Array.isArray(stage.choiceTemplates) && stage.choiceTemplates.length === 3,
        `${t.id}.${stageId} must have exactly 3 choices`);
      assert.equal(stage.choiceTemplates.filter(c => c.correct).length, 1,
        `${t.id}.${stageId} must have exactly one correct choice`);
    }
  }
});

test('materializeEmergency fills templates and preserves the correct choice', () => {
  const template = EMERGENCY_TEMPLATES.find(t => t.id === 'emer_cabin_breach');
  const concrete = materializeEmergency(template);

  assert.equal(concrete.multiStage, true);
  assert.equal(concrete.startStage, template.startStage);

  const breach = concrete.stages.breach;
  assert.ok(!/\{\{/.test(breach.description), 'no unfilled {{slot}} in description');
  for (const c of breach.choices) {
    assert.ok(!/\{\{/.test(c.label), 'no unfilled {{slot}} in label');
  }
  assert.equal(breach.choices.filter(c => c.correct).length, 1);
  const correct = breach.choices.find(c => c.correct);
  assert.equal(correct.nextStage, 'weld');
});

test('materializeEmergency produces variety across many fires', () => {
  const template = EMERGENCY_TEMPLATES.find(t => t.id === 'emer_cabin_breach');
  const correctLabels = new Set();
  const firstChoiceLabels = new Set();
  for (let i = 0; i < 200; i++) {
    const concrete = materializeEmergency(template);
    const breach = concrete.stages.breach;
    correctLabels.add(breach.choices.find(c => c.correct).label);
    firstChoiceLabels.add(breach.choices[0].label);
  }
  assert.ok(correctLabels.size >= 2, `correct choice label should vary across runs (got ${correctLabels.size})`);
  assert.ok(firstChoiceLabels.size >= 2, `position of the correct choice should vary (got ${firstChoiceLabels.size} first-slot labels)`);
});

test('pickEmergency returns a fully-materialized concrete event', () => {
  const e = pickEmergency();
  assert.ok(e.id && e.id.startsWith('emer_'));
  assert.equal(e.multiStage, true);
  const start = e.stages[e.startStage];
  assert.ok(!/\{\{/.test(start.description));
  assert.equal(start.choices.length, 3);
});

test('sustained mashing trips emergencies until the per-run cap is hit', () => {
  const cap = CLICK_METRICS_CONFIG.maxEmergenciesPerRun;
  let m = initialClickMetrics();
  const body = 'x'.repeat(50);

  // Fast click trips the heuristic; arm and fire up to the cap.
  for (let fired = 0; fired < cap; fired++) {
    while (!shouldFireEmergency(m)) {
      m = recordDecision(m, 50, body);
    }
    m = afterEmergencyFired(m);
    assert.equal(m.emergenciesFired, fired + 1);
  }

  // Further mashing should not exceed the cap.
  for (let i = 0; i < 10; i++) m = recordDecision(m, 50, body);
  assert.equal(shouldFireEmergency(m), false, 'cap holds');
});
