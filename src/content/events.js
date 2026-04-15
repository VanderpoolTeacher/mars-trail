// Mars Trail — random event content
// Pure data. Each event = { id, weight, severity, modal: { title, description, choices } }.
// Choice outcome fields (all optional, all numeric deltas applied to state):
//   power, water, food, oxygen, parts, sciencePoints, crewDamage:{role?, amount}
// skillCheck choices have { skillCheck:{role, successP}, successOutcome, failOutcome }.

export const EVENTS = [

  {
    id: 'dust_storm',
    weight: 8,
    severity: 'major',
    modal: {
      title: 'Regional Dust Storm',
      description: 'Visibility drops to meters. Solar panels cake over. Travel halts unless you push through the haze.',
      choices: [
        { label: 'Wait it out',
          outcome: { power: -10, water: -3, food: -3 } },
        { label: 'Push through',
          skillCheck: { role: 'pilot', successP: 0.6 },
          successOutcome: { power: -20, parts: -1 },
          failOutcome:    { power: -25, parts: -2, crewDamage: { role: 'pilot', amount: 15 } } },
        { label: 'Shelter and run experiments',
          outcome: { power: -8, sciencePoints: +20 } }
      ]
    }
  },

  {
    id: 'bearing_seizure',
    weight: 6,
    severity: 'minor',
    modal: {
      title: 'Wheel Bearing Seizure',
      description: 'A grinding shudder. The starboard rear bearing has chewed itself. Repair is straightforward — if you have a spare.',
      choices: [
        { label: 'Field-repair',
          skillCheck: { role: 'engineer', successP: 0.9 },
          successOutcome: { parts: -1, power: -2 },
          failOutcome:    { parts: -2, power: -5 } },
        { label: 'Limp through (no repair)',
          outcome: { power: -10, food: -3 } }
      ]
    }
  },

  {
    id: 'comms_blackout',
    weight: 4,
    severity: 'minor',
    modal: {
      title: 'Comms Blackout',
      description: 'Solar weather has knocked out the relay. No telemetry uplink. The crew can wait for the next satellite pass — or push on dark.',
      choices: [
        { label: 'Wait for satellite pass',
          outcome: { power: -2, food: -3 } },
        { label: 'Continue without contact',
          outcome: { sciencePoints: -10 } }
      ]
    }
  },

  {
    id: 'micrometeorite',
    weight: 5,
    severity: 'moderate',
    modal: {
      title: 'Micrometeorite Strike',
      description: 'A pinhole leak whistles through the cabin. Pressure dropping slowly. Patch it now or reroute air from a backup tank.',
      choices: [
        { label: 'EVA patch',
          skillCheck: { role: 'engineer', successP: 0.8 },
          successOutcome: { parts: -1 },
          failOutcome:    { parts: -2, crewDamage: { amount: 10 } } },
        { label: 'Reroute from backup tank',
          outcome: { oxygen: -8, water: -3 } }
      ]
    }
  },

  {
    id: 'solar_flare',
    weight: 5,
    severity: 'moderate',
    modal: {
      title: 'Solar Particle Event',
      description: 'A coronal mass ejection sleets through cislunar space. Radiation forecast is climbing. Find shelter or absorb the dose.',
      choices: [
        { label: 'Hunker down (lose a sol of progress)',
          outcome: { power: -5, food: -3 } },
        { label: 'Continue with shielding',
          outcome: { crewDamage: { amount: 8 } } },
        { label: 'Hunker and run radiation experiments',
          outcome: { power: -5, sciencePoints: +25 } }
      ]
    }
  }

];
