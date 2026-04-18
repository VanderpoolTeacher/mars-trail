// Mars Trail — crew health, status transitions, death.
// All functions take state and return new state.

const MEDIC_DAMAGE_REDUCTION = 0.30;   // -30% damage when medic is alive

// Status thresholds (inclusive upper bound).
//   health <= 0   → dead
//   health <= 20  → critical
//   health <= 60  → injured
//   health > 60   → healthy
export function deriveStatus(health) {
  if (health <= 0)  return 'dead';
  if (health <= 20) return 'critical';
  if (health <= 60) return 'injured';
  return 'healthy';
}

// Apply damage to a crew member.
//   targetSpec may be a crew id ("c3"), a role ("pilot"), or null
//   (null means "untargeted" — red-shirt rule applies).
// Returns { state, target, died, dealt }.
export function applyDamage(state, targetSpec, rawAmount, cause) {
  const s = {
    ...state,
    crew: state.crew.map(c => ({ ...c })),
    log: [...state.log]
  };

  const target = pickTarget(s.crew, targetSpec);
  if (!target) return { state: s, target: null, died: false, dealt: 0 };

  const medicAlive = s.crew.some(c => c.role === 'medic' && c.alive && c.id !== target.id);
  // Medic doesn't reduce damage to themselves.
  const reduction = medicAlive ? MEDIC_DAMAGE_REDUCTION : 0;
  const dealt = Math.max(0, Math.round(rawAmount * (1 - reduction)));

  const wasAlive = target.alive;
  target.health = Math.max(0, target.health - dealt);
  target.status = deriveStatus(target.health);
  if (target.status === 'dead') target.alive = false;

  const died = wasAlive && !target.alive;
  if (died) {
    s.log.push({
      sol: s.sol,
      text: `${target.name} (${target.role.toUpperCase()}) succumbed to ${cause || 'injuries'}.`
    });
    // Queue a death dialog for the UI dispatcher to surface (issue #33).
    s.deathQueue = [...(s.deathQueue || []), {
      crewId: target.id,
      name:   target.name,
      role:   target.role,
      cause:  cause || 'injuries',
      sol:    s.sol
    }];
  }
  return { state: s, target, died, dealt };
}

// Pick a damage target. Prefers role match, then security ("red shirt"),
// then a random alive specialist.
export function pickTarget(crew, spec) {
  if (typeof spec === 'string') {
    if (spec.startsWith('c')) {
      const byId = crew.find(c => c.id === spec && c.alive);
      if (byId) return byId;
      return null;
    }
    const byRole = crew.find(c => c.role === spec && c.alive);
    if (byRole) return byRole;
  }
  return pickRedShirt(crew);
}

function pickRedShirt(crew) {
  const sec = crew.find(c => c.role === 'security' && c.alive);
  if (sec) return sec;
  const alive = crew.filter(c => c.alive);
  if (alive.length === 0) return null;
  return alive[Math.floor(Math.random() * alive.length)];
}

// If all crew are dead, flip status to lost.
export function checkAllDead(state) {
  if (state.status !== 'active') return state;
  if (state.crew.some(c => c.alive)) return state;
  return {
    ...state,
    status: 'lost',
    lossReason: 'all_dead',
    log: [...state.log, { sol: state.sol, text: 'All crew lost. Mission ended.' }]
  };
}

// Convenience: how many crew of this role are still alive.
export function aliveCount(state, role) {
  return state.crew.filter(c => c.role === role && c.alive).length;
}
