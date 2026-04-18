// Tests for src/systems/multiStage.js. Run: node --test sim/multiStage.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MULTI_STAGE_EVENTS } from '../src/content/multiStageEvents.js';
import {
  applyStageChoice,
  rollMultiStageEvent,
  MULTI_STAGE_BASE_RATE
} from '../src/systems/multiStage.js';

// --- Shared helpers ---

function makeState(overrides = {}) {
  return {
    status: 'active',
    sol: 1,
    route: ['jezero','syrtis','arabia','meridiani','gale','elysium','tharsis','olympus_base'],
    routeKm: [330, 420, 290, 360, 460, 315, 375],
    currentLandmarkIndex: 0,
    kmToNextLandmark: 330,
    resources: { oxygen: 100, water: 100, food: 100, power: 100, panels: 100, mech: 4, eva: 4, cell: 3 },
    crew: [
      { id: 'c1', name: 'A', role: 'engineer',  health: 100, status: 'healthy', alive: true },
      { id: 'c2', name: 'B', role: 'biologist', health: 100, status: 'healthy', alive: true },
      { id: 'c3', name: 'C', role: 'medic',     health: 100, status: 'healthy', alive: true },
      { id: 'c4', name: 'D', role: 'pilot',     health: 100, status: 'healthy', alive: true },
      { id: 'c5', name: 'E', role: 'security',  health: 100, status: 'healthy', alive: true }
    ],
    sciencePoints: 0,
    factsLearned: [],
    firedEvents: [],
    log: [],
    ...overrides
  };
}

function withRandom(values, fn) {
  const original = Math.random;
  let i = 0;
  Math.random = () => values[i++ % values.length];
  try { return fn(); }
  finally { Math.random = original; }
}

const drill = MULTI_STAGE_EVENTS.find(e => e.id === 'drill_bit_seized');

// --- Shape validation ---

test('demo event shape: startStage exists; every nextStage resolves or is null', () => {
  for (const event of MULTI_STAGE_EVENTS) {
    assert.ok(event.stages[event.startStage], `${event.id}: startStage "${event.startStage}" missing from stages`);
    for (const [stageId, stage] of Object.entries(event.stages)) {
      for (const choice of stage.choices) {
        if (choice.nextStage !== null) {
          assert.ok(event.stages[choice.nextStage],
            `${event.id}.${stageId}: nextStage "${choice.nextStage}" missing from stages`);
        }
        // Choices must EITHER carry a cost (outcome or skill-check pair) OR be
        // a pure branch (no cost, just routes to another stage).
        const hasOutcome   = 'outcome' in choice || ('successOutcome' in choice && 'failOutcome' in choice);
        const pureBranch   = !hasOutcome && !('skillCheck' in choice) && choice.nextStage !== null;
        assert.ok(hasOutcome || pureBranch,
          `${event.id}.${stageId}: choice must have outcome, skill-check pair, OR be a pure branch`);
      }
    }
  }
});

// --- applyStageChoice ---

test('applyStageChoice: simple outcome applies and returns nextStage', () => {
  const s0 = makeState();
  // Math.random sequence: [power-jitter=0.5 → 0 jitter, catastrophe=0.5 → no amp].
  // mech is discrete and never jittered.
  const r = withRandom([0.5, 0.5], () => applyStageChoice(s0, drill, 'discover', 1));
  assert.equal(r.nextStage, null);
  assert.equal(r.state.resources.power, 100 - 10);
  assert.equal(r.state.resources.mech, 4 - 1);
  assert.equal(r.skillResult, null);
});

test('applyStageChoice: branching choice returns nextStage key', () => {
  const s0 = makeState();
  const r = applyStageChoice(s0, drill, 'discover', 0);
  assert.equal(r.nextStage, 'swap_attempt');
  assert.equal(r.state.resources.power, 100);
  assert.equal(r.state.resources.mech, 4);
});

test('applyStageChoice: skill-check success applies successOutcome', () => {
  const s0 = makeState();
  // Sequence: [skill check 0.01 → pass, sciencePoints jitter 0.5 → 0 jitter].
  // mech and sciencePoints are positive so no catastrophe path.
  const r = withRandom([0.01, 0.5], () => applyStageChoice(s0, drill, 'swap_attempt', 0));
  assert.equal(r.skillResult.success, true);
  assert.equal(r.skillResult.role, 'engineer');
  assert.equal(r.state.resources.mech, 4 - 1);
  assert.equal(r.state.sciencePoints, 10);
});

test('applyStageChoice: skill-check failure applies failOutcome', () => {
  const s0 = makeState();
  // Sequence: [skill check 0.99 → fail, damage jitter 0.5 → 0, catastrophe 0.5 → no amp].
  const r = withRandom([0.99, 0.5, 0.5], () => applyStageChoice(s0, drill, 'swap_attempt', 0));
  assert.equal(r.skillResult.success, false);
  assert.equal(r.state.resources.mech, 4 - 2);
  const engineer = r.state.crew.find(c => c.role === 'engineer');
  assert.ok(engineer.health < 100, 'engineer took damage on skill-check failure');
});

test('applyStageChoice: careerBonuses.skillBonus lifts success rate', () => {
  const s0 = makeState({ careerBonuses: { skillBonus: 0.10 } });
  const r = withRandom([0.80], () => applyStageChoice(s0, drill, 'swap_attempt', 0));
  assert.equal(r.skillResult.success, true);
});

test('applyStageChoice: invalid choiceIdx is a defensive no-op', () => {
  const s0 = makeState();
  const r = applyStageChoice(s0, drill, 'discover', 99);
  assert.equal(r.state, s0);
  assert.equal(r.nextStage, null);
  assert.equal(r.skillResult, null);
});

test('applyStageChoice: chain traversal (discover → swap_attempt → null)', () => {
  let s = makeState();
  // Stage 1: pure branch, no Math.random calls at all.
  let r1 = applyStageChoice(s, drill, 'discover', 0);
  assert.equal(r1.nextStage, 'swap_attempt');
  s = r1.state;
  // Stage 2: outcome applies -3 to oxygen, water, food. Each is jittered
  // (1 random) + catastrophe-checked (1 random). 6 random calls total.
  let r2 = withRandom([0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    () => applyStageChoice(s, drill, 'swap_attempt', 1));
  assert.equal(r2.nextStage, null);
  assert.equal(r2.state.resources.oxygen, 100 - 3);
  assert.equal(r2.state.resources.water,  100 - 3);
  assert.equal(r2.state.resources.food,   100 - 3);
});

// --- rollMultiStageEvent ---

test('rollMultiStageEvent: returns null when random is above base rate', () => {
  const s = makeState();
  const event = withRandom([MULTI_STAGE_BASE_RATE + 0.01], () => rollMultiStageEvent(s));
  assert.equal(event, null);
});

test('rollMultiStageEvent: respects firedEvents for oneShot', () => {
  const s = makeState({ firedEvents: ['drill_bit_seized'] });
  const event = withRandom([0.01, 0.5], () => rollMultiStageEvent(s));
  assert.equal(event, null);
});
