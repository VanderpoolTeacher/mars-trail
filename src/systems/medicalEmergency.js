// Mars Trail — medical emergency resolver (issue #6).
// Pure. Custom resolver for the medical_emergency event because the
// generic applyStageChoice can't target a specific crew member by ID
// nor conditionally route Stage 3 on the patient's death. Event data
// lives in src/content/medicalEmergency.js.
//
// Flow: pickPatient at fire time → diagnose → treat → (if died) dispose.

import { MEDICAL_EMERGENCY } from '../content/medicalEmergency.js';
import { applyOutcome } from './events.js';
import { deriveStatus } from './crew.js';
import { addCorpse } from './corpse.js';

export const MEDICAL_EMERGENCY_ID = MEDICAL_EMERGENCY.id;
const MEDIC_FLAVOR_LINE = 'Well, there goes paradise.';

// ---- Patient selection ----
// First alive non-medic. If only the medic is alive, medic is the patient
// (selfTreat=true → any subsequent medic skill checks take a -20pp penalty).
export function pickPatient(state) {
  const alive = state.crew.filter(c => c.alive);
  if (alive.length === 0) return null;
  const nonMedic = alive.filter(c => c.role !== 'medic');
  if (nonMedic.length > 0) {
    const pick = nonMedic[Math.floor(Math.random() * nonMedic.length)];
    return { id: pick.id, selfTreat: false };
  }
  return { id: alive[0].id, selfTreat: true };
}

// ---- Begin the event (called when rolled) ----
// Sets firedEvents + opens the first stage modal with the patient context.
export function beginMedicalEmergency(state) {
  const patient = pickPatient(state);
  if (!patient) return state;
  return {
    ...state,
    firedEvents: [...state.firedEvents, MEDICAL_EMERGENCY_ID],
    activeModal: {
      type: 'multi_stage',
      payload: {
        event:    MEDICAL_EMERGENCY,
        stageId:  MEDICAL_EMERGENCY.startStage,
        source:   'medical',
        context:  { patientId: patient.id, selfTreat: patient.selfTreat }
      }
    }
  };
}

// ---- Helpers ----

function getCrew(state, id) {
  return state.crew.find(c => c.id === id);
}

function damagePatient(state, patientId, amount, cause) {
  const s = {
    ...state,
    crew: state.crew.map(c => {
      if (c.id !== patientId || !c.alive) return c;
      const newHealth = Math.max(0, c.health - amount);
      const newStatus = deriveStatus(newHealth);
      const alive = newStatus !== 'dead';
      return { ...c, health: newHealth, status: newStatus, alive };
    }),
    log: [...state.log]
  };
  const after = getCrew(s, patientId);
  if (after && !after.alive && getCrew(state, patientId)?.alive) {
    s.log.push({
      sol: s.sol,
      text: `${after.name} (${after.role.toUpperCase()}) succumbed to ${cause || 'medical complications'}.`
    });
  }
  return s;
}

function medicAliveExcluding(state, excludeId) {
  return state.crew.some(c => c.role === 'medic' && c.alive && c.id !== excludeId);
}

function rollSkill(state, successP, selfTreat) {
  const base = selfTreat ? Math.max(0.2, successP - 0.2) : successP;
  const bonus = state.careerBonuses?.skillBonus || 0;
  const effP = Math.min(0.95, base + bonus);
  return Math.random() < effP;
}

function closeModal(state) {
  return { ...state, activeModal: null };
}

function nextStage(state, stageId, context) {
  return {
    ...state,
    activeModal: {
      type: 'multi_stage',
      payload: { event: MEDICAL_EMERGENCY, stageId, source: 'medical', context }
    }
  };
}

// ---- Stage: diagnose ----

function resolveDiagnose(state, choiceKey, context) {
  const { patientId, selfTreat } = context;
  const patient = getCrew(state, patientId);
  if (!patient) return closeModal(state);

  if (choiceKey === 'medic') {
    const success = rollSkill(state, 0.75, selfTreat);
    let s = state;
    if (!success) {
      s = damagePatient(s, patientId, 10, 'misdiagnosis');
    }
    s = { ...s, log: [...s.log, { sol: s.sol, text: success
      ? `Medic confident on diagnosis for ${patient.name}.`
      : `Medic exam inconclusive. ${patient.name} worsens.` }] };
    return nextStage(s, 'treat', context);
  }

  if (choiceKey === 'earth') {
    let s = applyOutcome(state, { oxygen: -3, water: -3 }).state;
    s = damagePatient(s, patientId, 20, 'delayed diagnosis');
    s = { ...s, log: [...s.log, { sol: s.sol, text: `Earth comms lag cost 20 minutes. ${patient.name} worsens.` }] };
    return nextStage(s, 'treat', context);
  }

  if (choiceKey === 'hope') {
    const stabilized = Math.random() < 0.4;
    if (stabilized) {
      const s = { ...state, log: [...state.log, { sol: state.sol, text: `Med-kit dose held. ${patient.name} is stable — for now.` }] };
      return closeModal(s);
    }
    let s = damagePatient(state, patientId, 30, 'adverse reaction');
    s = { ...s, log: [...s.log, { sol: s.sol, text: `Dose went wrong. ${patient.name} is in worse shape.` }] };
    return nextStage(s, 'treat', context);
  }

  return closeModal(state);
}

// ---- Stage: treat ----

function resolveTreat(state, choiceKey, context) {
  const { patientId, selfTreat } = context;
  const patient = getCrew(state, patientId);
  if (!patient) return closeModal(state);

  if (choiceKey === 'surgery') {
    let s = applyOutcome(state, { eva: -1, power: -15 }).state;
    const success = rollSkill(s, 0.65, selfTreat);
    if (success) {
      s = {
        ...s,
        crew: s.crew.map(c => c.id === patientId
          ? { ...c, health: Math.max(60, c.health), status: deriveStatus(Math.max(60, c.health)) }
          : c),
        log: [...s.log, { sol: s.sol, text: `Surgery successful. ${patient.name} is stable.` }]
      };
      return closeModal(s);
    }
    // Fail → patient dies.
    const medicCanFlavor = !selfTreat && medicAliveExcluding(s, patientId);
    s = damagePatient(s, patientId, 999, 'surgical complications');
    if (medicCanFlavor) {
      s = { ...s, log: [...s.log, { sol: s.sol, text: MEDIC_FLAVOR_LINE }] };
    }
    return nextStage(s, 'dispose', context);
  }

  if (choiceKey === 'push') {
    let s = applyOutcome(state, { eva: -1 }).state;
    s = damagePatient(s, patientId, 15, 'travel stress');
    const died = !getCrew(s, patientId).alive;
    s = { ...s, log: [...s.log, { sol: s.sol, text: died
      ? `${patient.name} did not survive the push.`
      : `Stabilized for travel. ${patient.name} is hanging on.` }] };
    return died ? nextStage(s, 'dispose', context) : closeModal(s);
  }

  if (choiceKey === 'coma') {
    let s = applyOutcome(state, { power: -15, oxygen: -10, eva: -1 }).state;
    s = { ...s, log: [...s.log, { sol: s.sol, text: `${patient.name} placed in induced coma. Vitals held, resources burning.` }] };
    return closeModal(s);
  }

  return closeModal(state);
}

// ---- Stage: dispose ----

function resolveDispose(state, choiceKey, context) {
  const { patientId } = context;
  const patient = state.crew.find(c => c.id === patientId);
  if (!patient) return closeModal(state);

  if (choiceKey === 'bury') {
    const s = applyOutcome(state, { sciencePoints: 10 }).state;
    return {
      ...s,
      log: [...s.log, { sol: s.sol, text: `${patient.name} laid to rest. Burial site documented. +10 SCI.` }],
      activeModal: null
    };
  }

  if (choiceKey === 'keep') {
    const s = addCorpse(state, patientId);
    return {
      ...s,
      log: [...s.log, { sol: s.sol, text: `${patient.name}'s body secured. +180 LB cargo.` }],
      activeModal: null
    };
  }

  if (choiceKey === 'jettison') {
    return {
      ...state,
      log: [...state.log, { sol: state.sol, text: `${patient.name}'s suit jettisoned. The crew will remember.` }],
      activeModal: null
    };
  }

  return closeModal(state);
}

// ---- Top-level resolver ----
// state.activeModal must be { type: 'multi_stage', payload: { source: 'medical', ... } }.
// choiceIdx is the index into the authored stage's choices.
export function resolveMedicalStage(state, choiceIdx) {
  const modal = state.activeModal;
  if (modal?.type !== 'multi_stage' || modal.payload?.source !== 'medical') return state;

  const { stageId, context } = modal.payload;
  const stage = MEDICAL_EMERGENCY.stages[stageId];
  const choice = stage?.choices[choiceIdx];
  if (!choice) return state;

  const key = choice.key;
  if (stageId === 'diagnose') return resolveDiagnose(state, key, context);
  if (stageId === 'treat')    return resolveTreat(state, key, context);
  if (stageId === 'dispose')  return resolveDispose(state, key, context);
  return state;
}
