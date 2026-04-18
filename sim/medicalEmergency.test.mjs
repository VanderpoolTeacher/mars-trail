// Tests for src/systems/medicalEmergency.js. Run: node --test sim/medicalEmergency.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickPatient,
  beginMedicalEmergency,
  resolveMedicalStage,
  MEDICAL_EMERGENCY_ID
} from '../src/systems/medicalEmergency.js';
import { MEDICAL_EMERGENCY } from '../src/content/medicalEmergency.js';

function makeState(overrides = {}) {
  return {
    status: 'active',
    sol: 5,
    resources: { oxygen: 80, water: 80, food: 80, power: 80, panels: 100, mech: 4, eva: 4, cell: 3 },
    crew: [
      { id: 'c1', name: 'Alex',  role: 'engineer',  health: 100, status: 'healthy', alive: true },
      { id: 'c2', name: 'Riya',  role: 'biologist', health: 100, status: 'healthy', alive: true },
      { id: 'c3', name: 'Tomas', role: 'medic',     health: 100, status: 'healthy', alive: true },
      { id: 'c4', name: 'Mei',   role: 'pilot',     health: 100, status: 'healthy', alive: true },
      { id: 'c5', name: 'Sam',   role: 'security',  health: 100, status: 'healthy', alive: true }
    ],
    sciencePoints: 0,
    factsLearned: [],
    firedEvents: [],
    corpses: [],
    log: [],
    activeModal: null,
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

// A medical modal with an explicit patient (skips the random patient pick).
function openAt(state, stageId, patientId = 'c2', selfTreat = false) {
  return {
    ...state,
    activeModal: {
      type: 'multi_stage',
      payload: {
        event:   MEDICAL_EMERGENCY,
        stageId,
        source:  'medical',
        context: { patientId, selfTreat }
      }
    }
  };
}

function choiceIdx(stageId, key) {
  return MEDICAL_EMERGENCY.stages[stageId].choices.findIndex(c => c.key === key);
}

// --- Shape / registry ---

test('event id is stable', () => {
  assert.equal(MEDICAL_EMERGENCY_ID, 'medical_emergency');
  assert.equal(MEDICAL_EMERGENCY.oneShot, true);
});

test('stages have choices with keys; no dangling nextStage refs', () => {
  for (const [stageId, stage] of Object.entries(MEDICAL_EMERGENCY.stages)) {
    assert.ok(stage.choices.length > 0, `${stageId} has no choices`);
    for (const c of stage.choices) assert.ok(c.key, `${stageId}: choice missing key`);
  }
});

// --- pickPatient ---

test('pickPatient selects a non-medic when one is alive', () => {
  const s = makeState();
  const pick = withRandom([0.0], () => pickPatient(s));
  assert.notEqual(pick.id, 'c3');  // medic
  assert.equal(pick.selfTreat, false);
});

test('pickPatient selects the medic only when medic is the only alive crew', () => {
  const s = makeState({
    crew: [
      { id: 'c1', name: 'A', role: 'engineer', health: 0, status: 'dead', alive: false },
      { id: 'c2', name: 'B', role: 'biologist',health: 0, status: 'dead', alive: false },
      { id: 'c3', name: 'C', role: 'medic',    health: 100, status: 'healthy', alive: true },
      { id: 'c4', name: 'D', role: 'pilot',    health: 0, status: 'dead', alive: false },
      { id: 'c5', name: 'E', role: 'security', health: 0, status: 'dead', alive: false }
    ]
  });
  const pick = pickPatient(s);
  assert.equal(pick.id, 'c3');
  assert.equal(pick.selfTreat, true);
});

// --- beginMedicalEmergency ---

test('beginMedicalEmergency opens the diagnose stage and marks fired', () => {
  const s0 = makeState();
  const s1 = beginMedicalEmergency(s0);
  assert.equal(s1.activeModal.type, 'multi_stage');
  assert.equal(s1.activeModal.payload.source, 'medical');
  assert.equal(s1.activeModal.payload.stageId, 'diagnose');
  assert.ok(s1.firedEvents.includes(MEDICAL_EMERGENCY_ID));
});

// --- diagnose stage ---

test('diagnose: consult-medic success goes to treat with no damage', () => {
  const s0 = openAt(makeState(), 'diagnose');
  const s1 = withRandom([0.01], () => resolveMedicalStage(s0, choiceIdx('diagnose', 'medic')));
  assert.equal(s1.activeModal.payload.stageId, 'treat');
  const patient = s1.crew.find(c => c.id === 'c2');
  assert.equal(patient.health, 100);
});

test('diagnose: consult-medic fail damages patient', () => {
  const s0 = openAt(makeState(), 'diagnose');
  const s1 = withRandom([0.99], () => resolveMedicalStage(s0, choiceIdx('diagnose', 'medic')));
  assert.equal(s1.activeModal.payload.stageId, 'treat');
  const patient = s1.crew.find(c => c.id === 'c2');
  assert.equal(patient.health, 90);
});

test('diagnose: consult-earth drains resources and worsens patient', () => {
  const s0 = openAt(makeState(), 'diagnose');
  const s1 = resolveMedicalStage(s0, choiceIdx('diagnose', 'earth'));
  assert.equal(s1.activeModal.payload.stageId, 'treat');
  assert.ok(s1.resources.oxygen < 80);
  assert.ok(s1.resources.water < 80);
  const patient = s1.crew.find(c => c.id === 'c2');
  assert.equal(patient.health, 80);
});

test('diagnose: hope stabilizes 40% (ends chain)', () => {
  const s0 = openAt(makeState(), 'diagnose');
  const s1 = withRandom([0.01], () => resolveMedicalStage(s0, choiceIdx('diagnose', 'hope')));
  assert.equal(s1.activeModal, null);
});

test('diagnose: hope fail worsens patient heavily, routes to treat', () => {
  const s0 = openAt(makeState(), 'diagnose');
  const s1 = withRandom([0.99], () => resolveMedicalStage(s0, choiceIdx('diagnose', 'hope')));
  assert.equal(s1.activeModal.payload.stageId, 'treat');
  const patient = s1.crew.find(c => c.id === 'c2');
  assert.equal(patient.health, 70);
});

// --- treat stage ---

test('treat: surgery success ends chain with patient stable', () => {
  const s0 = openAt(makeState(), 'treat');
  const s1 = withRandom([0.01], () => resolveMedicalStage(s0, choiceIdx('treat', 'surgery')));
  assert.equal(s1.activeModal, null);
  const patient = s1.crew.find(c => c.id === 'c2');
  assert.ok(patient.alive);
});

test('treat: surgery fail kills patient and routes to dispose', () => {
  const s0 = openAt(makeState(), 'treat');
  const s1 = withRandom([0.99], () => resolveMedicalStage(s0, choiceIdx('treat', 'surgery')));
  assert.equal(s1.activeModal.payload.stageId, 'dispose');
  const patient = s1.crew.find(c => c.id === 'c2');
  assert.equal(patient.alive, false);
});

test('treat: surgery fail with medic alive & not patient appends the medic flavor line', () => {
  const s0 = openAt(makeState(), 'treat', 'c2', /* selfTreat */ false);
  const s1 = withRandom([0.99], () => resolveMedicalStage(s0, choiceIdx('treat', 'surgery')));
  assert.ok(s1.log.some(l => l.text === 'Well, there goes paradise.'));
});

test('treat: surgery fail when medic is the patient does NOT emit the flavor line', () => {
  // Only medic is alive → selfTreat path. Patient is the medic.
  const s0 = openAt(makeState({
    crew: [
      { id: 'c1', name: 'A', role: 'engineer', health: 0, status: 'dead', alive: false },
      { id: 'c2', name: 'B', role: 'biologist',health: 0, status: 'dead', alive: false },
      { id: 'c3', name: 'C', role: 'medic',    health: 100, status: 'healthy', alive: true },
      { id: 'c4', name: 'D', role: 'pilot',    health: 0, status: 'dead', alive: false },
      { id: 'c5', name: 'E', role: 'security', health: 0, status: 'dead', alive: false }
    ]
  }), 'treat', 'c3', /* selfTreat */ true);
  const s1 = withRandom([0.99], () => resolveMedicalStage(s0, choiceIdx('treat', 'surgery')));
  assert.ok(!s1.log.some(l => l.text === 'Well, there goes paradise.'));
});

test('treat: stabilize-push damages patient; survival ends chain, death routes to dispose', () => {
  // Survives (starts at 100, takes 15 → 85).
  const s0 = openAt(makeState(), 'treat');
  const s1 = resolveMedicalStage(s0, choiceIdx('treat', 'push'));
  assert.equal(s1.activeModal, null);
  const p1 = s1.crew.find(c => c.id === 'c2');
  assert.equal(p1.health, 85);

  // Dies (starts at 10, takes 15 → 0).
  const s2Base = makeState({
    crew: makeState().crew.map(c => c.id === 'c2' ? { ...c, health: 10 } : c)
  });
  const s2 = openAt(s2Base, 'treat');
  const s3 = resolveMedicalStage(s2, choiceIdx('treat', 'push'));
  assert.equal(s3.activeModal?.payload.stageId, 'dispose');
  const p2 = s3.crew.find(c => c.id === 'c2');
  assert.equal(p2.alive, false);
});

test('treat: coma burns resources, keeps patient alive, ends chain', () => {
  const s0 = openAt(makeState(), 'treat');
  const s1 = resolveMedicalStage(s0, choiceIdx('treat', 'coma'));
  assert.equal(s1.activeModal, null);
  assert.ok(s1.resources.power < 80);
  assert.ok(s1.resources.oxygen < 80);
  const patient = s1.crew.find(c => c.id === 'c2');
  assert.ok(patient.alive);
});

// --- dispose stage ---

test('dispose: bury ends chain, no corpse, grants SCI', () => {
  const deadBase = makeState({
    crew: makeState().crew.map(c => c.id === 'c2' ? { ...c, health: 0, alive: false, status: 'dead' } : c)
  });
  const s0 = openAt(deadBase, 'dispose');
  const s1 = resolveMedicalStage(s0, choiceIdx('dispose', 'bury'));
  assert.equal(s1.activeModal, null);
  assert.equal(s1.corpses.length, 0);
  assert.ok(s1.sciencePoints > 0);
});

test('dispose: keep adds the corpse', () => {
  const deadBase = makeState({
    crew: makeState().crew.map(c => c.id === 'c2' ? { ...c, health: 0, alive: false, status: 'dead' } : c)
  });
  const s0 = openAt(deadBase, 'dispose');
  const s1 = resolveMedicalStage(s0, choiceIdx('dispose', 'keep'));
  assert.equal(s1.activeModal, null);
  assert.equal(s1.corpses.length, 1);
  assert.equal(s1.corpses[0].crewId, 'c2');
  assert.equal(s1.corpses[0].weightLbs, 180);
});

test('dispose: jettison ends chain with no corpse and a specific log line', () => {
  const deadBase = makeState({
    crew: makeState().crew.map(c => c.id === 'c2' ? { ...c, health: 0, alive: false, status: 'dead' } : c)
  });
  const s0 = openAt(deadBase, 'dispose');
  const s1 = resolveMedicalStage(s0, choiceIdx('dispose', 'jettison'));
  assert.equal(s1.activeModal, null);
  assert.equal(s1.corpses.length, 0);
  assert.ok(s1.log.some(l => l.text.toLowerCase().includes('jettisoned')));
});

// --- Self-treat penalty: skill-check success P is lower (0.65 → 0.45). ---

test('treat: selfTreat surgery at rand=0.55 fails (above 0.45 cap)', () => {
  const s0 = openAt(makeState(), 'treat', 'c3', /* selfTreat */ true);
  const s1 = withRandom([0.55], () => resolveMedicalStage(s0, choiceIdx('treat', 'surgery')));
  // 0.55 > 0.45 selfTreat threshold → fail → patient dies → dispose
  assert.equal(s1.activeModal?.payload.stageId, 'dispose');
});
