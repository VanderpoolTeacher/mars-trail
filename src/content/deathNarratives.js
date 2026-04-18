// Mars Trail — per-cause death narratives (issue #33).
// Small lookup used by showDeathDialog to render one-sentence context
// under the \"[Name] ([ROLE]) is gone.\" headline. Functions receive the
// death entry so they can weave in the crew member's name.

function n(entry) { return entry.name; }

const NARRATIVES = {
  fatigue:                  e => `The cumulative wear caught up. ${n(e)} did not wake for the morning watch.`,
  hypoxia:                  e => `Thin cabin O₂ finally tipped past recoverable. ${n(e)} slipped under during the night.`,
  dehydration:              e => `Water rationing held until it didn't. ${n(e)}'s kidneys gave out.`,
  malnutrition:             e => `Weeks of half-rations stripped the reserve. ${n(e)} went quiet mid-conversation.`,
  'life support failure':   e => `When the power dropped, heat went with it. ${n(e)} was already gone by the time the batteries came back.`,
  'event injuries':         e => `The injuries from earlier proved too deep. ${n(e)} bled out before the medic could reach them.`,
  'away-team hazard':       e => `The site had teeth. ${n(e)}'s suit telemetry went flat at the sample face — the rest of the team brought the data back.`,
  'medical complications':  e => `Triage ran out of options. ${n(e)} was pronounced at ${String((Math.floor(Math.random() * 24)).toString().padStart(2,'0'))}:${String((Math.floor(Math.random() * 60)).toString().padStart(2,'0'))} LMST.`,
  'surgical complications': e => `The operation found more damage than the diagnosis suggested. ${n(e)} did not come off the table.`,
  'travel stress':          e => `The push to the next landmark was more than the body could hold. ${n(e)} died in transit.`,
  'delayed diagnosis':      e => `The Earth-comms lag cost too many minutes. ${n(e)} was beyond help by the time the plan came back.`,
  'misdiagnosis':           e => `The exam missed the root problem. ${n(e)} crashed while the crew was still treating the wrong thing.`,
  'adverse reaction':       e => `The improvised dose went wrong. ${n(e)} coded within the hour.`,
  injuries:                 e => `The wound was more than the kit could hold. ${n(e)} is gone.`
};

// Lookup with graceful fallback for unknown causes.
export function deathNarrative(entry) {
  const fn = NARRATIVES[entry.cause];
  if (fn) return fn(entry);
  return `${n(entry)} succumbed to ${entry.cause || 'injuries'} before the crew could intervene.`;
}

// Specialist-loss strategic reminder. null if the role is fungible or a
// replacement specialist is still alive.
export function specialistLossNote(role, state) {
  const stillAlive = state.crew.some(c => c.role === role && c.alive);
  if (stillAlive) return null;
  switch (role) {
    case 'engineer':
      return 'No engineer remains — MECH and CELL skill checks take a major penalty.';
    case 'medic':
      return 'No medic remains — all background damage applies at full strength; medical emergency surgeries become far harder.';
    case 'pilot':
      return 'No pilot remains — travel km/sol loses its bonus and daily variance widens.';
    case 'biologist':
      return 'No biologist remains — water and astrobiology skill checks take a major penalty.';
    default:
      return null;   // security role is fungible
  }
}
