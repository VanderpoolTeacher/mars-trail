// Tests for src/systems/awayTeam.js. Run: node --test sim/awayTeam.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WAYPOINTS } from '../src/content/waypoints.js';
import { AWAY_TEAM_CHAINS } from '../src/content/awayTeamChains.js';
import {
  acceptAwayTeam,
  advanceAwayTeam,
  resolveAwayTeamStage,
  returnAwayTeam,
  finalizeReunion,
  MIN_CREW_FOR_DIVERT
} from '../src/systems/awayTeam.js';
import { advanceSol } from '../src/systems/travel.js';

function makeState(overrides = {}) {
  return {
    status: 'active',
    sol: 5,
    route: ['jezero','syrtis','arabia','meridiani','gale','elysium','tharsis','olympus_base'],
    routeKm: [330, 420, 290, 360, 460, 315, 375],
    currentLandmarkIndex: 1,
    kmToNextLandmark: 420,
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
    awayTeam: null,
    corpses: [],
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

const OLIVINE = WAYPOINTS.find(w => w.id === 'olivine_outcrop');

// --- Shape ---

test('every AWAY_TEAM_CHAINS entry has valid stage graph', () => {
  for (const [waypointId, chain] of Object.entries(AWAY_TEAM_CHAINS)) {
    assert.ok(chain.stages[chain.startStage],
      `${waypointId}: startStage "${chain.startStage}" missing from stages`);
    for (const [stageId, stage] of Object.entries(chain.stages)) {
      for (const choice of stage.choices) {
        if (choice.nextStage !== null && choice.nextStage !== undefined) {
          assert.ok(chain.stages[choice.nextStage],
            `${waypointId}.${stageId}: nextStage "${choice.nextStage}" missing`);
        }
        // Terminal choices must carry a cost (outcome, or skill-check pair).
        // Non-terminal choices can be pure branches (just nextStage).
        const isTerminal = (choice.nextStage ?? null) === null;
        if (isTerminal) {
          const hasPlain = 'outcome' in choice;
          const hasSkill = 'skillCheck' in choice
            && 'successOutcome' in choice
            && 'failOutcome' in choice;
          assert.ok(hasPlain || hasSkill,
            `${waypointId}.${stageId}: terminal choice needs outcome or skill-check pair`);
        }
      }
    }
  }
});

test('every waypoint in WAYPOINTS has a matching chain', () => {
  for (const wp of WAYPOINTS) {
    assert.ok(AWAY_TEAM_CHAINS[wp.id],
      `no away-team chain authored for waypoint "${wp.id}"`);
  }
});

test('every chain can be driven to a terminal stage by always picking choice 0', () => {
  const base = makeState();
  for (const waypointId of Object.keys(AWAY_TEAM_CHAINS)) {
    // Force all skill-check successes for smoke drive (skip awayTeamDamage).
    let s = acceptAwayTeam(base, waypointId, ['c1', 'c2']);
    assert.ok(s.awayTeam, `${waypointId}: acceptAwayTeam failed`);
    let guard = 10;
    while (s.awayTeam && s.awayTeam.currentStage && guard-- > 0) {
      s = withRandom([0.01, 0.5, 0.3, 0.5], () => resolveAwayTeamStage(s, 0));
    }
    assert.ok(guard >= 0, `${waypointId}: stage loop exceeded guard (possible cycle)`);
  }
});

// --- Accept ---

test('acceptAwayTeam sets state.awayTeam and does not touch kmToNextLandmark', () => {
  const s0 = makeState();
  const s1 = acceptAwayTeam(s0, 'olivine_outcrop', ['c1', 'c2']);
  assert.equal(s1.awayTeam.waypointId, 'olivine_outcrop');
  assert.deepEqual(s1.awayTeam.crewIds, ['c1', 'c2']);
  assert.equal(s1.awayTeam.departSol, 5);
  assert.equal(s1.awayTeam.returnSol, 5 + OLIVINE.detourSols);
  assert.equal(s1.awayTeam.currentStage, 'approach');
  assert.equal(s1.kmToNextLandmark, 420, 'rover distance unchanged');
});

test('acceptAwayTeam blocks when fewer than 3 alive crew', () => {
  const s0 = makeState({
    crew: [
      { id: 'c1', name: 'A', role: 'engineer', health: 100, status: 'healthy', alive: true },
      { id: 'c2', name: 'B', role: 'medic',    health: 100, status: 'healthy', alive: true },
      { id: 'c3', name: 'C', role: 'pilot',    health: 100, status: 'healthy', alive: false },
      { id: 'c4', name: 'D', role: 'security', health: 100, status: 'healthy', alive: false },
      { id: 'c5', name: 'E', role: 'biologist',health: 100, status: 'healthy', alive: false }
    ]
  });
  const s1 = acceptAwayTeam(s0, 'olivine_outcrop', ['c1']);
  assert.equal(s1.awayTeam, null);
  assert.ok(s1.log.some(l => l.text.toLowerCase().includes('too few')));
  assert.equal(MIN_CREW_FOR_DIVERT, 3);
});

test('acceptAwayTeam rejects a crew pick that would strand the rover', () => {
  // 3 alive, try to send all 3 — must leave ≥1 on rover
  const s0 = makeState({
    crew: [
      { id: 'c1', name: 'A', role: 'engineer',  health: 100, status: 'healthy', alive: true },
      { id: 'c2', name: 'B', role: 'biologist', health: 100, status: 'healthy', alive: true },
      { id: 'c3', name: 'C', role: 'medic',     health: 100, status: 'healthy', alive: true },
      { id: 'c4', name: 'D', role: 'pilot',     health: 100, status: 'healthy', alive: false },
      { id: 'c5', name: 'E', role: 'security',  health: 100, status: 'healthy', alive: false }
    ]
  });
  const s1 = acceptAwayTeam(s0, 'olivine_outcrop', ['c1', 'c2', 'c3']);
  assert.equal(s1.awayTeam, null);
});

// --- advanceAwayTeam ---

test('advanceAwayTeam opens a multi_stage modal with source=awayTeam while a stage is pending', () => {
  const s0 = acceptAwayTeam(makeState(), 'olivine_outcrop', ['c1', 'c2']);
  const s1 = advanceAwayTeam(s0);
  assert.equal(s1.activeModal?.type, 'multi_stage');
  assert.equal(s1.activeModal.payload.source, 'awayTeam');
  assert.equal(s1.activeModal.payload.stageId, 'approach');
});

test('advanceAwayTeam with currentStage=null and sol < returnSol emits idle log', () => {
  const base = acceptAwayTeam(makeState(), 'olivine_outcrop', ['c1', 'c2']);
  const s = { ...base, awayTeam: { ...base.awayTeam, currentStage: null }, sol: base.awayTeam.returnSol - 1 };
  const s1 = advanceAwayTeam(s);
  assert.ok(s1.log.some(l => l.text.toLowerCase().includes('camp day')));
  assert.equal(s1.activeModal ?? null, null);
});

test('advanceAwayTeam with currentStage=null and sol >= returnSol triggers reunion', () => {
  const base = acceptAwayTeam(makeState(), 'olivine_outcrop', ['c1', 'c2']);
  const s = { ...base, awayTeam: { ...base.awayTeam, currentStage: null }, sol: base.awayTeam.returnSol };
  const s1 = advanceAwayTeam(s);
  assert.equal(s1.activeModal?.type, 'away_team_reunion');
});

// --- resolveAwayTeamStage ---

test('resolveAwayTeamStage applies returnSolDelta to awayTeam.returnSol', () => {
  const s0 = acceptAwayTeam(makeState(), 'olivine_outcrop', ['c1', 'c2']);
  const baseReturn = s0.awayTeam.returnSol;
  // approach stage, choice index 0 = "Rappel to the fresh face" (returnSolDelta: +1)
  const s1 = resolveAwayTeamStage(s0, 0);
  assert.equal(s1.awayTeam.returnSol, baseReturn + 1);
  assert.equal(s1.awayTeam.currentStage, 'deep_sample');
});

test('resolveAwayTeamStage defers sciencePoints and facts to accumulated', () => {
  const s0 = acceptAwayTeam(makeState(), 'olivine_outcrop', ['c1', 'c2']);
  // approach choice 1 = ridgeline scan, skill check success → sciencePoints: 40
  const s1 = withRandom([0.01], () => resolveAwayTeamStage(s0, 1));
  assert.equal(s1.awayTeam.accumulated.sciencePoints, 40);
  assert.equal(s1.sciencePoints, 0, 'rover SCI untouched until reunion');
  // Terminal skill check success → one fact accumulated
  assert.equal(s1.awayTeam.accumulated.facts.length, 1);
  assert.equal(s1.factsLearned.length, 0, 'rover facts untouched until reunion');
  assert.equal(s1.awayTeam.currentStage, null);
});

test('resolveAwayTeamStage applies awayTeamDamage only to away-team members', () => {
  const s0 = acceptAwayTeam(makeState(), 'olivine_outcrop', ['c1', 'c2']);
  // approach(0) → deep_sample. Then deep_sample choice 0 = drill, with fail outcome awayTeamDamage: 20.
  const afterApproach = resolveAwayTeamStage(s0, 0);
  assert.equal(afterApproach.awayTeam.currentStage, 'deep_sample');
  // Force skill-check fail (Math.random returns high → fail).
  const s1 = withRandom([0.99], () => resolveAwayTeamStage(afterApproach, 0));
  const rover = s1.crew.find(c => !afterApproach.awayTeam.crewIds.includes(c.id));
  assert.equal(rover.health, 100, 'rover crew untouched');
  const away = s1.crew.filter(c => afterApproach.awayTeam.crewIds.includes(c.id));
  const anyDamaged = away.some(c => c.health < 100);
  assert.ok(anyDamaged, 'at least one away-team member takes damage');
});

// --- returnAwayTeam ---

test('returnAwayTeam packages a reunion payload with survivors + deaths + rewards', () => {
  const s0 = acceptAwayTeam(makeState(), 'olivine_outcrop', ['c1', 'c2']);
  // Fake a completed chain with some accumulated reward and one death.
  const s = {
    ...s0,
    awayTeam: {
      ...s0.awayTeam,
      currentStage: null,
      accumulated: { sciencePoints: 75, facts: ['a fact'] },
      deaths: ['c2']
    },
    crew: s0.crew.map(c => c.id === 'c2' ? { ...c, alive: false, status: 'dead', health: 0 } : c)
  };
  const s1 = returnAwayTeam(s);
  assert.equal(s1.activeModal.type, 'away_team_reunion');
  assert.equal(s1.activeModal.payload.sciencePoints, 75);
  assert.deepEqual(s1.activeModal.payload.facts, ['a fact']);
  assert.equal(s1.activeModal.payload.survivors.length, 1);
  assert.equal(s1.activeModal.payload.survivors[0].id, 'c1');
  assert.equal(s1.activeModal.payload.deaths.length, 1);
  assert.equal(s1.activeModal.payload.deaths[0].id, 'c2');
});

// --- finalizeReunion ---

test('finalizeReunion applies SCI + facts and clears awayTeam', () => {
  const s0 = acceptAwayTeam(makeState(), 'olivine_outcrop', ['c1', 'c2']);
  const s = {
    ...s0,
    awayTeam: {
      ...s0.awayTeam,
      currentStage: null,
      accumulated: { sciencePoints: 50, facts: ['rare fact'] },
      deaths: []
    }
  };
  const s1 = finalizeReunion(s, {});
  assert.equal(s1.sciencePoints, 50);
  assert.deepEqual(s1.factsLearned, ['rare fact']);
  assert.equal(s1.awayTeam, null);
  assert.equal(s1.activeModal, null);
  assert.equal(s1.corpses.length, 0);
});

test('finalizeReunion adds corpses for bring choices and not for leave choices', () => {
  const s0 = acceptAwayTeam(makeState(), 'olivine_outcrop', ['c1', 'c2']);
  const s = {
    ...s0,
    awayTeam: {
      ...s0.awayTeam,
      accumulated: { sciencePoints: 0, facts: [] },
      deaths: ['c1', 'c2']
    }
  };
  const s1 = finalizeReunion(s, { c1: 'bring', c2: 'leave' });
  assert.equal(s1.corpses.length, 1);
  assert.equal(s1.corpses[0].crewId, 'c1');
});

// --- Full lifecycle: rover stays parked across the whole camp ---

test('lifecycle: kmToNextLandmark never changes across full away-team run', () => {
  const s0 = acceptAwayTeam(makeState(), 'olivine_outcrop', ['c1', 'c2']);
  const startKm = s0.kmToNextLandmark;
  // Force all skill-check successes.
  const s1 = withRandom([0.01, 0.5], () => resolveAwayTeamStage(s0, 0));  // approach → deep_sample
  const s2 = withRandom([0.01, 0.5], () => resolveAwayTeamStage(s1, 0));  // deep_sample drill, success
  assert.equal(s2.kmToNextLandmark, startKm);
  assert.equal(s2.awayTeam.currentStage, null);
});

// --- All away crew die → skip to reunion ---

test('if all away-team crew die mid-chain, stage resolution jumps straight to reunion', () => {
  const s0 = acceptAwayTeam(makeState(), 'olivine_outcrop', ['c1']);
  // Mark c1 as nearly dead so a big awayTeamDamage finishes them.
  const s = {
    ...s0,
    crew: s0.crew.map(c => c.id === 'c1' ? { ...c, health: 5 } : c),
    awayTeam: { ...s0.awayTeam, currentStage: 'deep_sample' }
  };
  // deep_sample drill, force fail (awayTeamDamage: 20 → c1 dies)
  const s1 = withRandom([0.99], () => resolveAwayTeamStage(s, 0));
  assert.equal(s1.activeModal?.type, 'away_team_reunion');
  assert.ok(s1.awayTeam.deaths.includes('c1'));
});

// --- Camp-mode supply scaling (issue #25) ---

// advanceSol-ready state shaped for drain comparison tests. Adds fields
// advanceSol reads (firedEvents/firedWaypoints/pace/rations/activeModal)
// that the core makeState omits.
function makeDrainState(overrides = {}) {
  const patched = {
    pace: 'steady',
    rations: 'standard',
    firedEvents: [],
    firedWaypoints: [],
    waypoints: [],
    totalKmTraveled: 0,
    activeModal: null,
    ...overrides
  };
  return makeState(patched);
}

test('camp mode scales life-support drain to rover-side crew share', () => {
  const baseline = makeDrainState();
  const afterTravel = advanceSol(baseline, 'travel');
  const travelO2Drain   = 100 - afterTravel.resources.oxygen;
  const travelFoodDrain = 100 - afterTravel.resources.food;

  // Camp sol with 2 of 5 away — drain should be 3/5 of baseline.
  let camp = acceptAwayTeam(baseline, 'olivine_outcrop', ['c1', 'c2']);
  camp = { ...camp, activeModal: null };
  const afterCamp = advanceSol(camp);
  const campO2Drain   = 100 - afterCamp.resources.oxygen;
  const campFoodDrain = 100 - afterCamp.resources.food;

  const expectedShare = 3 / 5;
  assert.ok(Math.abs(campO2Drain / travelO2Drain - expectedShare) < 0.01,
    `O2 drain ratio ${(campO2Drain / travelO2Drain).toFixed(3)} ≠ ${expectedShare}`);
  assert.ok(Math.abs(campFoodDrain / travelFoodDrain - expectedShare) < 0.01,
    `food drain ratio ${(campFoodDrain / travelFoodDrain).toFixed(3)} ≠ ${expectedShare}`);
});

test('camp mode with 3 of 5 away drains life support to 2/5', () => {
  const baseline = makeDrainState();
  const afterTravel = advanceSol(baseline, 'travel');
  const travelO2Drain = 100 - afterTravel.resources.oxygen;

  let camp = acceptAwayTeam(baseline, 'olivine_outcrop', ['c1', 'c2', 'c3']);
  camp = { ...camp, activeModal: null };
  const afterCamp = advanceSol(camp);
  const campO2Drain = 100 - afterCamp.resources.oxygen;

  assert.ok(Math.abs(campO2Drain / travelO2Drain - 2/5) < 0.01);
});

test('camp supply scaling uses max crew count, not alive count (permanent deaths do not reduce drain)', () => {
  // With max-crew-count denominator: (5 - 2 away) / 5 = 3/5 regardless of deaths.
  // With alive-count denominator this would be (3 alive - 2 away) / 3 = 1/3.
  const dead = makeDrainState({
    crew: [
      { id: 'c1', name: 'A', role: 'engineer',  health: 100, status: 'healthy', alive: true  },
      { id: 'c2', name: 'B', role: 'biologist', health: 100, status: 'healthy', alive: true  },
      { id: 'c3', name: 'C', role: 'medic',     health: 100, status: 'healthy', alive: true  },
      { id: 'c4', name: 'D', role: 'pilot',     health: 0,   status: 'dead',    alive: false },
      { id: 'c5', name: 'E', role: 'security',  health: 0,   status: 'dead',    alive: false }
    ]
  });
  const afterTravel = advanceSol(dead, 'travel');
  const travelO2Drain = 100 - afterTravel.resources.oxygen;

  let camp = acceptAwayTeam(dead, 'olivine_outcrop', ['c1', 'c2']);
  camp = { ...camp, activeModal: null };
  const afterCamp = advanceSol(camp);
  const campO2Drain = 100 - afterCamp.resources.oxygen;

  assert.ok(Math.abs(campO2Drain / travelO2Drain - 3/5) < 0.01,
    `expected 3/5 (max-crew), got ${(campO2Drain / travelO2Drain).toFixed(3)}`);
});
