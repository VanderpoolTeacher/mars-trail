// Tests for src/systems/medicalEmergency.js. Run: node --test sim/medicalEmergency.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickPatient,
  pickAilment,
  beginMedicalEmergency,
  resolveMedicalStage,
  getMedicalStageView,
  MEDICAL_EMERGENCY_ID
} from '../src/systems/medicalEmergency.js';
import { MEDICAL_EMERGENCY, AILMENTS } from '../src/content/medicalEmergency.js';

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

function openAt(state, stageId, patientId = 'c2', selfTreat = false, ailmentId = 'appendicitis') {
  return {
    ...state,
    activeModal: {
      type: 'multi_stage',
      payload: {
        event:   MEDICAL_EMERGENCY,
        stageId,
        source:  'medical',
        context: { patientId, selfTreat, ailmentId }
      }
    }
  };
}

function idx(state, stageId, key, patientId = 'c2', selfTreat = false, ailmentId = 'appendicitis') {
  const view = getMedicalStageView(state, stageId, { patientId, selfTreat, ailmentId });
  return view.choices.findIndex(c => c.key === key);
}

// --- Registry ---

test('event id stable; one-shot; severity=medical', () => {
  assert.equal(MEDICAL_EMERGENCY_ID, 'medical_emergency');
  assert.equal(MEDICAL_EMERGENCY.oneShot, true);
  assert.equal(MEDICAL_EMERGENCY.severity, 'medical');
});

test('AILMENTS pool has ≥6 entries, each with id/label/symptom/cause', () => {
  assert.ok(AILMENTS.length >= 6);
  for (const a of AILMENTS) {
    assert.ok(a.id && a.label && a.symptom && a.cause,
      `ailment ${a.id || '?'} missing a field`);
  }
});

// --- Patient + ailment selection ---

test('pickPatient selects a non-medic when one is alive', () => {
  const pick = withRandom([0.0], () => pickPatient(makeState()));
  assert.notEqual(pick.id, 'c3');
  assert.equal(pick.selfTreat, false);
});

test('pickPatient selects the medic only when medic is the sole survivor', () => {
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

test('pickAilment returns an entry from AILMENTS', () => {
  const a = pickAilment();
  assert.ok(AILMENTS.some(e => e.id === a.id));
});

// --- beginMedicalEmergency ---

test('beginMedicalEmergency opens diagnose with full context', () => {
  const s1 = beginMedicalEmergency(makeState());
  const p = s1.activeModal.payload;
  assert.equal(p.source, 'medical');
  assert.equal(p.stageId, 'diagnose');
  assert.ok(p.context.patientId);
  assert.ok(AILMENTS.some(a => a.id === p.context.ailmentId));
  assert.ok(s1.firedEvents.includes(MEDICAL_EMERGENCY_ID));
});

// --- Stage view ---

test('diagnose view weaves patient name + ailment symptom into description', () => {
  const s = makeState();
  const view = getMedicalStageView(s, 'diagnose', { patientId: 'c2', selfTreat: false, ailmentId: 'appendicitis' });
  assert.ok(view.description.includes('Riya'));
  const ailment = AILMENTS.find(a => a.id === 'appendicitis');
  assert.ok(view.description.includes(ailment.symptom));
  assert.equal(view.title, `Medical Emergency — ${ailment.label}`);
});

test('diagnose view swaps medic→self_triage when selfTreat', () => {
  const s = makeState();
  const normal = getMedicalStageView(s, 'diagnose', { patientId: 'c2', selfTreat: false, ailmentId: 'cardiac_arrhythmia' });
  assert.ok(normal.choices.some(c => c.key === 'medic'));
  assert.ok(!normal.choices.some(c => c.key === 'self_triage'));

  const self = getMedicalStageView(s, 'diagnose', { patientId: 'c3', selfTreat: true, ailmentId: 'cardiac_arrhythmia' });
  assert.ok(!self.choices.some(c => c.key === 'medic'));
  assert.ok(self.choices.some(c => c.key === 'self_triage'));
});

test('treat view swaps surgery→crew_surgery when selfTreat', () => {
  const s = makeState();
  const normal = getMedicalStageView(s, 'treat', { patientId: 'c2', selfTreat: false, ailmentId: 'appendicitis' });
  assert.ok(normal.choices.some(c => c.key === 'surgery'));

  const self = getMedicalStageView(s, 'treat', { patientId: 'c3', selfTreat: true, ailmentId: 'appendicitis' });
  assert.ok(!self.choices.some(c => c.key === 'surgery'));
  assert.ok(self.choices.some(c => c.key === 'crew_surgery'));
});

// --- Diagnose resolver ---

test('diagnose: consult-medic success routes to treat with no damage', () => {
  const s0 = openAt(makeState(), 'diagnose');
  const s1 = withRandom([0.01], () => resolveMedicalStage(s0, idx(s0, 'diagnose', 'medic')));
  assert.equal(s1.activeModal.payload.stageId, 'treat');
  assert.equal(s1.crew.find(c => c.id === 'c2').health, 100);
});

test('diagnose: self-triage uses lower P (0.45)', () => {
  // Solo medic, self_triage, rand=0.50 → above 0.45 → fail → patient damaged.
  const base = makeState({
    crew: [
      { id: 'c1', name: 'A', role: 'engineer', health: 0, status: 'dead', alive: false },
      { id: 'c2', name: 'B', role: 'biologist',health: 0, status: 'dead', alive: false },
      { id: 'c3', name: 'C', role: 'medic',    health: 100, status: 'healthy', alive: true },
      { id: 'c4', name: 'D', role: 'pilot',    health: 0, status: 'dead', alive: false },
      { id: 'c5', name: 'E', role: 'security', health: 0, status: 'dead', alive: false }
    ]
  });
  const s0 = openAt(base, 'diagnose', 'c3', true, 'cardiac_arrhythmia');
  const s1 = withRandom([0.50], () => resolveMedicalStage(s0, idx(s0, 'diagnose', 'self_triage', 'c3', true, 'cardiac_arrhythmia')));
  assert.equal(s1.activeModal.payload.stageId, 'treat');
  assert.equal(s1.crew.find(c => c.id === 'c3').health, 90);
});

// --- Treat resolver ---

test('treat: surgery success stabilizes patient', () => {
  const s0 = openAt(makeState(), 'treat');
  const s1 = withRandom([0.01], () => resolveMedicalStage(s0, idx(s0, 'treat', 'surgery')));
  assert.equal(s1.activeModal, null);
  assert.ok(s1.crew.find(c => c.id === 'c2').alive);
});

test('treat: surgery fail kills patient, routes to dispose, flavor line appended', () => {
  const s0 = openAt(makeState(), 'treat');
  const s1 = withRandom([0.99], () => resolveMedicalStage(s0, idx(s0, 'treat', 'surgery')));
  assert.equal(s1.activeModal.payload.stageId, 'dispose');
  assert.equal(s1.crew.find(c => c.id === 'c2').alive, false);
  assert.ok(s1.log.some(l => l.text === 'Well, there goes paradise.'));
});

test('treat: crew_surgery (medic is patient) has lower P (0.30), no flavor line', () => {
  const base = makeState({
    crew: [
      { id: 'c1', name: 'A', role: 'engineer', health: 0, status: 'dead', alive: false },
      { id: 'c2', name: 'B', role: 'biologist',health: 0, status: 'dead', alive: false },
      { id: 'c3', name: 'C', role: 'medic',    health: 100, status: 'healthy', alive: true },
      { id: 'c4', name: 'D', role: 'pilot',    health: 0, status: 'dead', alive: false },
      { id: 'c5', name: 'E', role: 'security', health: 0, status: 'dead', alive: false }
    ]
  });
  const s0 = openAt(base, 'treat', 'c3', true, 'cardiac_arrhythmia');
  // rand=0.35 > 0.30 threshold → fail
  const s1 = withRandom([0.35], () => resolveMedicalStage(s0, idx(s0, 'treat', 'crew_surgery', 'c3', true, 'cardiac_arrhythmia')));
  assert.equal(s1.activeModal.payload.stageId, 'dispose');
  assert.ok(!s1.log.some(l => l.text === 'Well, there goes paradise.'));
});

test('treat: stabilize-push damages patient; dies routes to dispose', () => {
  const weak = makeState({
    crew: makeState().crew.map(c => c.id === 'c2' ? { ...c, health: 10 } : c)
  });
  const s0 = openAt(weak, 'treat');
  const s1 = resolveMedicalStage(s0, idx(s0, 'treat', 'push'));
  assert.equal(s1.activeModal?.payload.stageId, 'dispose');
});

test('treat: coma burns resources, ends chain', () => {
  const s0 = openAt(makeState(), 'treat');
  const s1 = resolveMedicalStage(s0, idx(s0, 'treat', 'coma'));
  assert.equal(s1.activeModal, null);
  assert.ok(s1.resources.power < 80);
});

// --- Dispose resolver ---

test('dispose: bury ends chain, no corpse', () => {
  const deadBase = makeState({
    crew: makeState().crew.map(c => c.id === 'c2' ? { ...c, alive: false, health: 0, status: 'dead' } : c)
  });
  const s0 = openAt(deadBase, 'dispose');
  const s1 = resolveMedicalStage(s0, idx(s0, 'dispose', 'bury'));
  assert.equal(s1.corpses.length, 0);
  assert.ok(s1.sciencePoints > 0);
});

test('dispose: keep adds the corpse', () => {
  const deadBase = makeState({
    crew: makeState().crew.map(c => c.id === 'c2' ? { ...c, alive: false, health: 0, status: 'dead' } : c)
  });
  const s0 = openAt(deadBase, 'dispose');
  const s1 = resolveMedicalStage(s0, idx(s0, 'dispose', 'keep'));
  assert.equal(s1.corpses.length, 1);
  assert.equal(s1.corpses[0].crewId, 'c2');
});

test('dispose: jettison ends chain with specific log line', () => {
  const deadBase = makeState({
    crew: makeState().crew.map(c => c.id === 'c2' ? { ...c, alive: false, health: 0, status: 'dead' } : c)
  });
  const s0 = openAt(deadBase, 'dispose');
  const s1 = resolveMedicalStage(s0, idx(s0, 'dispose', 'jettison'));
  assert.ok(s1.log.some(l => l.text.toLowerCase().includes('jettisoned')));
});

// --- Death queue integration (#33) ---

test('patient death queues a death-dialog entry', () => {
  const s0 = openAt(makeState(), 'treat');
  const s1 = withRandom([0.99], () => resolveMedicalStage(s0, idx(s0, 'treat', 'surgery')));
  assert.ok((s1.deathQueue || []).some(e => e.crewId === 'c2'));
});
