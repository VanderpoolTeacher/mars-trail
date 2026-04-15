// Mars Trail — random event roller + outcome applier
// Pure functions over state.

import { EVENTS } from '../content/events.js';

const EVENT_BASE_RATE = 0.35;   // P(event per sol). Will move to scenarios.js later.

// Pick a random event using weighted selection. Returns an event object or null.
export function rollEvent(state) {
  if (Math.random() > EVENT_BASE_RATE) return null;
  const totalWeight = EVENTS.reduce((sum, e) => sum + e.weight, 0);
  let r = Math.random() * totalWeight;
  for (const e of EVENTS) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return EVENTS[EVENTS.length - 1];   // fallback (floating-point edges)
}

// Resolve a chosen event option.
// Returns { state, resolution } where resolution describes what happened
// for the outcome screen: { choice, outcome, skillResult?, damageTarget? }.
export function applyEventChoice(state, event, choiceIdx) {
  const choice = event.modal.choices[choiceIdx];
  if (!choice) return { state, resolution: null };

  let outcome    = choice.outcome;
  let skillResult = null;

  if (choice.skillCheck) {
    const { role, successP } = choice.skillCheck;
    const specialistAlive = state.crew.some(c => c.role === role && c.alive);
    const effectiveP = specialistAlive ? successP : Math.max(0.2, successP - 0.4);
    const success = Math.random() < effectiveP;
    outcome = success ? choice.successOutcome : choice.failOutcome;
    skillResult = { role, success, specialistAlive, effectiveP };
  }

  const { state: s, damageTarget } = applyOutcome(state, outcome);

  // Append a log entry summarizing the resolution.
  const checkLabel = skillResult
    ? ` (${skillResult.role} check: ${skillResult.success ? 'success' : 'failed'})`
    : '';
  s.log = [...s.log, {
    sol: s.sol,
    text: `${event.modal.title} → ${choice.label}${checkLabel}.`
  }];

  // Clear the modal and check post-outcome loss conditions.
  s.activeModal = null;
  if (s.resources.oxygen === 0 && s.status === 'active') {
    s.status = 'lost';
    s.lossReason = 'no_oxygen';
    s.log.push({ sol: s.sol, text: 'Oxygen tanks depleted. Mission lost.' });
  }

  return {
    state: s,
    resolution: { event, choice, outcome, skillResult, damageTarget }
  };
}

// Apply a single outcome object (resource deltas, science, crew damage).
// Returns { state, damageTarget } so the caller can describe what happened.
function applyOutcome(state, outcome) {
  if (!outcome) return { state, damageTarget: null };
  const s = {
    ...state,
    resources: { ...state.resources },
    crew: state.crew.map(c => ({ ...c })),
    log: [...state.log]
  };

  if (typeof outcome.oxygen        === 'number') s.resources.oxygen     = clamp(s.resources.oxygen     + outcome.oxygen,     0, 100);
  if (typeof outcome.water         === 'number') s.resources.water      = clamp(s.resources.water      + outcome.water,      0, 100);
  if (typeof outcome.power         === 'number') s.resources.power      = clamp(s.resources.power      + outcome.power,      0, 100);
  if (typeof outcome.food          === 'number') s.resources.food       = clamp(s.resources.food       + outcome.food,       0, 100);
  if (typeof outcome.parts         === 'number') s.resources.spareParts = Math.max(0, s.resources.spareParts + outcome.parts);
  if (typeof outcome.sciencePoints === 'number') s.sciencePoints        = Math.max(0, s.sciencePoints  + outcome.sciencePoints);

  let damageTarget = null;
  if (outcome.crewDamage) {
    const { role, amount } = outcome.crewDamage;
    const target = pickDamageTarget(s.crew, role);
    if (target) {
      target.health = clamp(target.health - amount, 0, 100);
      if (target.health <= 30 && target.status === 'healthy') target.status = 'injured';
      damageTarget = { name: target.name, role: target.role, amount };
    }
  }
  return { state: s, damageTarget };
}

function pickDamageTarget(crew, preferredRole) {
  if (preferredRole) {
    const roleMatch = crew.find(c => c.role === preferredRole && c.alive);
    if (roleMatch) return roleMatch;
  }
  // Red-shirt: living security first
  const sec = crew.find(c => c.role === 'security' && c.alive);
  if (sec) return sec;
  // Otherwise random alive crew
  const alive = crew.filter(c => c.alive);
  if (alive.length === 0) return null;
  return alive[Math.floor(Math.random() * alive.length)];
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
