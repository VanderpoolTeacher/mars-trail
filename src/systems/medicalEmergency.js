// Mars Trail — medical emergency resolver (issue #6, expanded #32).
// Pure. Custom resolver because the generic applyStageChoice can't
// target a specific patient by ID or conditionally route on death.
// Event data + ailment pool live in src/content/medicalEmergency.js.
//
// Flow: pickPatient + pickAilment at fire time → diagnose → treat →
// (if died) dispose. Stage views are built per-run by
// getMedicalStageView so text + choices reflect patient, ailment, and
// whether the medic is themselves the patient (selfTreat path).

import { MEDICAL_EMERGENCY, AILMENTS } from '../content/medicalEmergency.js';
import { applyOutcome } from './events.js';
import { deriveStatus } from './crew.js';
import { addCorpse } from './corpse.js';

export const MEDICAL_EMERGENCY_ID = MEDICAL_EMERGENCY.id;
const MEDIC_FLAVOR_LINE = 'Well, there goes paradise.';

// ---- Patient selection ----
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

// ---- Ailment selection ----
export function pickAilment() {
  return AILMENTS[Math.floor(Math.random() * AILMENTS.length)];
}

// ---- Begin the event ----
export function beginMedicalEmergency(state) {
  const patient = pickPatient(state);
  if (!patient) return state;
  const ailment = pickAilment();
  return {
    ...state,
    firedEvents: [...state.firedEvents, MEDICAL_EMERGENCY_ID],
    activeModal: {
      type: 'multi_stage',
      payload: {
        event:    MEDICAL_EMERGENCY,
        stageId:  MEDICAL_EMERGENCY.startStage,
        source:   'medical',
        context:  { patientId: patient.id, selfTreat: patient.selfTreat, ailmentId: ailment.id }
      }
    }
  };
}

// ---- Stage view (title/description/choices, built per-run) ----
// Returns { title, description, choices } where each choice has
// { label, key }. The resolver dispatches on key.
export function getMedicalStageView(state, stageId, context) {
  const patient = state.crew.find(c => c.id === context.patientId);
  const ailment = AILMENTS.find(a => a.id === context.ailmentId) || AILMENTS[0];
  if (!patient) return null;

  const roleCode = (patient.role || '').toUpperCase();
  const patientTag = `${patient.name} (${roleCode})`;

  if (stageId === 'diagnose') {
    const intro = context.selfTreat
      ? `${patientTag} — your medic — is in trouble. ${ailment.symptom} The crew is on their own.`
      : `${patientTag} is in trouble. ${ailment.symptom} You have to act.`;
    const choices = context.selfTreat
      ? [
          { label: 'Self-triage (medic impaired)',        key: 'self_triage' },
          { label: 'Query Earth (comms delay)',           key: 'earth' },
          { label: 'Dose from med kit and hope',          key: 'hope' }
        ]
      : [
          { label: 'Consult the medic',                    key: 'medic' },
          { label: 'Query Earth (comms delay)',            key: 'earth' },
          { label: 'Dose from med kit and hope',           key: 'hope' }
        ];
    return { title: `Medical Emergency — ${ailment.label}`, description: intro, choices };
  }

  if (stageId === 'treat') {
    const surgeryLabel = context.selfTreat
      ? 'Crew attempts surgery (no surgeon)'
      : 'Surgery in the rover';
    const surgeryKey = context.selfTreat ? 'crew_surgery' : 'surgery';
    const description = context.selfTreat
      ? `Treatment has to happen without the medic. ${patient.name} is coaching through the pain — barely.`
      : `Diagnosis in hand. Choose the treatment plan for ${patient.name}.`;
    return {
      title:       'Treatment Window',
      description,
      choices: [
        { label: surgeryLabel,                       key: surgeryKey },
        { label: 'Stabilize and push to landmark',   key: 'push' },
        { label: 'Induced coma — buy time',          key: 'coma' }
      ]
    };
  }

  if (stageId === 'dispose') {
    return {
      title:       'Body Disposal',
      description: `${patient.name} did not make it. The body is 180 LB of suited mass. Call it.`,
      choices: [
        { label: 'Bury at next landmark',  key: 'bury' },
        { label: 'Keep the body with us',  key: 'keep' },
        { label: 'Jettison the suit now',  key: 'jettison' }
      ]
    };
  }

  return null;
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
    s.deathQueue = [...(s.deathQueue || []), {
      crewId: after.id, name: after.name, role: after.role,
      cause:  cause || 'medical complications', sol: s.sol
    }];
  }
  return s;
}

function medicAliveExcluding(state, excludeId) {
  return state.crew.some(c => c.role === 'medic' && c.alive && c.id !== excludeId);
}

function rollSkill(state, successP) {
  const bonus = state.careerBonuses?.skillBonus || 0;
  const effP = Math.min(0.95, successP + bonus);
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

// ---- Stage resolvers ----

function resolveDiagnose(state, key, context) {
  const patient = getCrew(state, context.patientId);
  if (!patient) return closeModal(state);

  if (key === 'medic' || key === 'self_triage') {
    // medic: 0.75; self_triage: 0.45 (medic impaired by their own symptoms).
    const successP = key === 'self_triage' ? 0.45 : 0.75;
    const success = rollSkill(state, successP);
    let s = state;
    if (!success) s = damagePatient(s, context.patientId, 10, 'misdiagnosis');
    const msg = success
      ? (key === 'self_triage'
           ? `${patient.name} self-diagnoses through the haze.`
           : `Medic confident on diagnosis for ${patient.name}.`)
      : (key === 'self_triage'
           ? `${patient.name} can't get a clean read on themselves. Worsens.`
           : `Medic exam inconclusive. ${patient.name} worsens.`);
    s = { ...s, log: [...s.log, { sol: s.sol, text: msg }] };
    return nextStage(s, 'treat', context);
  }

  if (key === 'earth') {
    let s = applyOutcome(state, { oxygen: -3, water: -3 }).state;
    s = damagePatient(s, context.patientId, 20, 'delayed diagnosis');
    s = { ...s, log: [...s.log, { sol: s.sol, text: `Earth comms lag cost 20 minutes. ${patient.name} worsens.` }] };
    return nextStage(s, 'treat', context);
  }

  if (key === 'hope') {
    const stabilized = Math.random() < 0.4;
    if (stabilized) {
      const s = { ...state, log: [...state.log, { sol: state.sol, text: `Med-kit dose held. ${patient.name} is stable — for now.` }] };
      return closeModal(s);
    }
    let s = damagePatient(state, context.patientId, 30, 'adverse reaction');
    s = { ...s, log: [...s.log, { sol: s.sol, text: `Dose went wrong. ${patient.name} is in worse shape.` }] };
    return nextStage(s, 'treat', context);
  }

  return closeModal(state);
}

function resolveTreat(state, key, context) {
  const patient = getCrew(state, context.patientId);
  if (!patient) return closeModal(state);

  if (key === 'surgery' || key === 'crew_surgery') {
    let s = applyOutcome(state, { eva: -1, power: -15 }).state;
    // surgery: 0.65 (medic). crew_surgery: 0.30 (no surgeon).
    const successP = key === 'crew_surgery' ? 0.30 : 0.65;
    const success = rollSkill(s, successP);
    if (success) {
      s = {
        ...s,
        crew: s.crew.map(c => c.id === context.patientId
          ? { ...c, health: Math.max(60, c.health), status: deriveStatus(Math.max(60, c.health)) }
          : c),
        log: [...s.log, { sol: s.sol, text: key === 'crew_surgery'
          ? `Improvised surgery held. ${patient.name} is stable.`
          : `Surgery successful. ${patient.name} is stable.` }]
      };
      return closeModal(s);
    }
    // Fail → patient dies.
    const medicCanFlavor = !context.selfTreat && medicAliveExcluding(s, context.patientId);
    const cause = key === 'crew_surgery' ? 'surgical complications' : 'surgical complications';
    s = damagePatient(s, context.patientId, 999, cause);
    if (medicCanFlavor) {
      s = { ...s, log: [...s.log, { sol: s.sol, text: MEDIC_FLAVOR_LINE }] };
    }
    return nextStage(s, 'dispose', context);
  }

  if (key === 'push') {
    let s = applyOutcome(state, { eva: -1 }).state;
    s = damagePatient(s, context.patientId, 15, 'travel stress');
    const died = !getCrew(s, context.patientId).alive;
    s = { ...s, log: [...s.log, { sol: s.sol, text: died
      ? `${patient.name} did not survive the push.`
      : `Stabilized for travel. ${patient.name} is hanging on.` }] };
    return died ? nextStage(s, 'dispose', context) : closeModal(s);
  }

  if (key === 'coma') {
    let s = applyOutcome(state, { power: -15, oxygen: -10, eva: -1 }).state;
    s = { ...s, log: [...s.log, { sol: s.sol, text: `${patient.name} placed in induced coma. Vitals held, resources burning.` }] };
    return closeModal(s);
  }

  return closeModal(state);
}

function resolveDispose(state, key, context) {
  const patient = state.crew.find(c => c.id === context.patientId);
  if (!patient) return closeModal(state);

  if (key === 'bury') {
    const s = applyOutcome(state, { sciencePoints: 10 }).state;
    return {
      ...s,
      log: [...s.log, { sol: s.sol, text: `${patient.name} laid to rest. Burial site documented. +10 SCI.` }],
      activeModal: null
    };
  }
  if (key === 'keep') {
    const s = addCorpse(state, context.patientId);
    return {
      ...s,
      log: [...s.log, { sol: s.sol, text: `${patient.name}'s body secured. +180 LB cargo.` }],
      activeModal: null
    };
  }
  if (key === 'jettison') {
    return {
      ...state,
      log: [...state.log, { sol: state.sol, text: `${patient.name}'s suit jettisoned. The crew will remember.` }],
      activeModal: null
    };
  }
  return closeModal(state);
}

// ---- Top-level resolver ----
export function resolveMedicalStage(state, choiceIdx) {
  const modal = state.activeModal;
  if (modal?.type !== 'multi_stage' || modal.payload?.source !== 'medical') return state;

  const { stageId, context } = modal.payload;
  const view = getMedicalStageView(state, stageId, context);
  const choice = view?.choices[choiceIdx];
  if (!choice) return state;

  const key = choice.key;
  if (stageId === 'diagnose') return resolveDiagnose(state, key, context);
  if (stageId === 'treat')    return resolveTreat(state, key, context);
  if (stageId === 'dispose')  return resolveDispose(state, key, context);
  return state;
}
