// Mars Trail — multi-stage event resolution + rolling (issue #17 prerequisite).
// Pure module. Reuses applyOutcome from events.js for skill-check branches.

import { MULTI_STAGE_EVENTS } from '../content/multiStageEvents.js';
import { applyOutcome } from './events.js';

export const MULTI_STAGE_BASE_RATE = 0.08;

// ---- Apply a simple (non-jittered) outcome directly ----
//
// Multi-stage scripted events state their costs exactly ("sit 2 sols = -3 each").
// Jitter is reserved for skill-check success/fail branches which go through
// applyOutcome. Simple-choice outcomes are applied without variance so that
// authored values are honoured precisely.
function applyOutcomeExact(state, outcome) {
  if (!outcome) return { state, damageTarget: null, applied: {} };

  const applied = {};
  let s = {
    ...state,
    resources: { ...state.resources },
    log: [...state.log]
  };

  const CLAMP = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const res = (key) => {
    if (typeof outcome[key] === 'number') {
      applied[key] = outcome[key];
      s.resources[key] = CLAMP(s.resources[key] + outcome[key], 0, 100);
    }
  };

  res('oxygen'); res('water'); res('power'); res('food'); res('panels');

  // Discrete parts (no jitter, no clamp at 100).
  ['mech', 'eva', 'cell'].forEach(k => {
    if (typeof outcome[k] === 'number') {
      applied[k] = outcome[k];
      s.resources[k] = Math.max(0, s.resources[k] + outcome[k]);
    }
  });

  if (typeof outcome.sciencePoints === 'number') {
    applied.sciencePoints = outcome.sciencePoints;
    s.sciencePoints = Math.max(0, s.sciencePoints + outcome.sciencePoints);
  }

  return { state: s, damageTarget: null, applied };
}

// ---- Resolve a chosen option on a given stage ----
//
// Returns { state, nextStage, skillResult, damageTarget, applied }.
// state:       new state after outcome application.
// nextStage:   key of the next stage, or null to end the chain.
// skillResult: present when the choice had a skillCheck.
export function applyStageChoice(state, event, stageId, choiceIdx) {
  const stage  = event.stages[stageId];
  const choice = stage?.choices[choiceIdx];
  if (!choice) return { state, nextStage: null, skillResult: null, damageTarget: null, applied: {} };

  let outcome = choice.outcome;
  let skillResult = null;

  if (choice.skillCheck) {
    const { role, successP } = choice.skillCheck;
    const specialistAlive = state.crew.some(c => c.role === role && c.alive);
    const baseP = specialistAlive ? successP : Math.max(0.2, successP - 0.4);
    const bonus = state.careerBonuses?.skillBonus || 0;
    const effectiveP = Math.min(0.95, baseP + bonus);
    const success = Math.random() < effectiveP;
    outcome = success ? choice.successOutcome : choice.failOutcome;
    skillResult = { role, success, specialistAlive };

    // Skill-check branches go through applyOutcome (jitter + crewDamage support).
    const { state: s, damageTarget, applied } = applyOutcome(state, outcome);
    return {
      state: s,
      nextStage: choice.nextStage ?? null,
      skillResult,
      damageTarget,
      applied
    };
  }

  // Simple (scripted) choices apply exact values — no jitter.
  const { state: s, damageTarget, applied } = applyOutcomeExact(state, outcome);
  return {
    state: s,
    nextStage: choice.nextStage ?? null,
    skillResult,
    damageTarget,
    applied
  };
}

// ---- Roll a multi-stage event ----
//
// Called by advanceSol only when rollEvent returned null. Lower base rate
// keeps the pool from flooding single-choice events.
export function rollMultiStageEvent(state) {
  if (Math.random() > MULTI_STAGE_BASE_RATE) return null;
  const fired = state.firedEvents || [];
  const eligible = MULTI_STAGE_EVENTS.filter(e => !(e.oneShot && fired.includes(e.id)));
  if (!eligible.length) return null;
  const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
  let r = Math.random() * totalWeight;
  for (const e of eligible) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return eligible[eligible.length - 1];
}
