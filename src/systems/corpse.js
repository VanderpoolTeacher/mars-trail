// Mars Trail — corpse accounting.
// Shared by away-team reunion (#17) and medical-emergency disposal (#6).
// Pure. State writes go through addCorpse; reads via corpseWeight.

export const DEFAULT_CORPSE_LBS = 180;

export function addCorpse(state, crewId, weightLbs = DEFAULT_CORPSE_LBS) {
  if (state.corpses.some(c => c.crewId === crewId)) return state;
  return { ...state, corpses: [...state.corpses, { crewId, weightLbs }] };
}

export function corpseWeight(state) {
  return state.corpses.reduce((n, c) => n + c.weightLbs, 0);
}
