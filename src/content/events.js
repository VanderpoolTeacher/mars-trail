// Mars Trail — random event content
// Pure data. Each event = { id, weight, severity, modal: { title, description, choices } }.
// Choice outcome fields (all optional, all numeric deltas applied to state):
//   power, water, food, oxygen, mech, eva, cell, sciencePoints,
//   crewDamage:{role?, amount}, crewHeal
// skillCheck choices have { skillCheck:{role, successP}, successOutcome, failOutcome }.

export const EVENTS = [

  {
    id: 'dust_storm',
    weight: 8,
    severity: 'major',
    image: 'assets/images/dust-storm.jpg',
    modal: {
      title: 'Regional Dust Storm',
      description: 'Visibility drops to meters. Rover halts — life support keeps running. Panels will cake over if you sit through it. Push on and risk the rover.',
      choices: [
        { label: 'Shelter in place (panels cake)',
          outcome: { power: -6, water: -4, food: -4, panels: -55 } },
        { label: 'Push through',
          skillCheck: { role: 'pilot', successP: 0.6 },
          successOutcome: { power: -18, mech: -1 },
          failOutcome:    { power: -24, mech: -2, crewDamage: { role: 'pilot', amount: 28 } } },
        { label: 'Shelter + run atmospheric experiments',
          outcome: { power: -6, food: -3, panels: -55, sciencePoints: +20,
                     factCategory: 'ATMOSPHERE' } }
      ]
    }
  },

  {
    id: 'bearing_seizure',
    weight: 6,
    severity: 'minor',
    modal: {
      title: 'Wheel Bearing Seizure',
      description: 'A grinding shudder. The starboard rear bearing has chewed itself. Repair needs mechanical spares.',
      choices: [
        { label: 'Field-repair',
          skillCheck: { role: 'engineer', successP: 0.9 },
          successOutcome: { mech: -1, power: -5 },
          failOutcome:    { mech: -2, power: -12, crewDamage: { role: 'engineer', amount: 12 } } },
        { label: 'Limp through (no repair)',
          outcome: { power: -18, food: -6 } }
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
          outcome: { power: -6, food: -6, water: -4 } },
        { label: 'Continue without contact',
          outcome: { sciencePoints: -15, crewDamage: { amount: 6 } } }
      ]
    }
  },

  {
    id: 'micrometeorite',
    weight: 5,
    severity: 'moderate',
    modal: {
      title: 'Micrometeorite Strike',
      description: 'A pinhole leak whistles through the cabin. Pressure dropping. Patch it now or reroute air from a backup tank.',
      choices: [
        { label: 'EVA patch',
          skillCheck: { role: 'engineer', successP: 0.8 },
          successOutcome: { eva: -1, oxygen: -5 },
          failOutcome:    { eva: -2, oxygen: -10, crewDamage: { amount: 22 } } },
        { label: 'Reroute from backup tank',
          outcome: { oxygen: -18, water: -10 } }
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
          outcome: { power: -10, food: -6 } },
        { label: 'Continue with shielding',
          outcome: { crewDamage: { amount: 18 } } },
        { label: 'Hunker and run radiation experiments',
          outcome: { power: -10, food: -4, sciencePoints: +25,
                     factCategory: 'RADIATION' } }
      ]
    }
  },

  // ---------- Terrain / exploration encounters ----------

  {
    id: 'crevasse_field',
    weight: 6,
    severity: 'major',
    modal: {
      title: 'Crevasse Field',
      description: 'A network of meter-wide crevasses opens across your route. Some are deep enough to swallow a rover.',
      choices: [
        { label: 'Detour around (long way)',
          outcome: { power: -12, food: -8, water: -6 } },
        { label: 'Navigate through carefully',
          skillCheck: { role: 'pilot', successP: 0.65 },
          successOutcome: { power: -5, mech: -1 },
          failOutcome:    { power: -8, mech: -2, crewDamage: { amount: 25 } } },
        { label: 'Survey the edge for science',
          skillCheck: { role: 'biologist', successP: 0.70 },
          successOutcome: { sciencePoints: +35, water: -4,
                            factCategory: 'GEOLOGY' },
          failOutcome:    { sciencePoints: +15, crewDamage: { role: 'biologist', amount: 22 } } }
      ]
    }
  },

  {
    id: 'lava_tube_cave',
    weight: 5,
    severity: 'major',
    image: 'assets/images/lava-tube.jpg',
    modal: {
      title: 'Lava Tube Cave',
      description: 'A collapsed sky-light reveals a kilometers-long volcanic cave. Possible shelter for future colonies — and for whatever might still grow in the dark.',
      choices: [
        { label: 'Examine the mouth only',
          outcome: { sciencePoints: +15, factCategory: 'GEOLOGY' } },
        { label: 'Full descent with EVA kit',
          skillCheck: { role: 'engineer', successP: 0.70 },
          successOutcome: { sciencePoints: +55, eva: -1,
                            factCategory: 'GEOLOGY' },
          failOutcome:    { sciencePoints: +20, eva: -2, crewDamage: { amount: 28 } } },
        { label: 'Map from above and move on',
          outcome: { sciencePoints: +25, food: -4, water: -3, factCategory: 'GEOLOGY' } }
      ]
    }
  },

  {
    id: 'boulder_field',
    weight: 5,
    severity: 'moderate',
    modal: {
      title: 'Boulder Field',
      description: 'Volcanic ejecta the size of cars block the route. Picking a clean path is slow; charging through is fast and stupid.',
      choices: [
        { label: 'Pick a careful path',
          outcome: { power: -8, food: -6 } },
        { label: 'Run it at speed',
          skillCheck: { role: 'pilot', successP: 0.55 },
          successOutcome: { power: -5 },
          failOutcome:    { power: -10, mech: -2, crewDamage: { role: 'pilot', amount: 24 } } },
        { label: 'Search for water-ice in shadows',
          outcome: { water: +10, food: -4, crewDamage: { amount: 12 }, factCategory: 'WATER' } }
      ]
    }
  },

  {
    id: 'crater_rim',
    weight: 4,
    severity: 'minor',
    image: 'assets/images/crater.jpg',
    modal: {
      title: 'Crater Rim Vista',
      description: 'A young impact crater. The rim is stable; the steep wall is not. Samples down there could be untouched bedrock.',
      choices: [
        { label: 'Survey from the rim',
          outcome: { sciencePoints: +20, factCategory: 'GEOLOGY' } },
        { label: 'Rappel for samples',
          skillCheck: { role: 'engineer', successP: 0.70 },
          successOutcome: { sciencePoints: +45, water: +5, eva: -1, factCategory: 'GEOLOGY' },
          failOutcome:    { sciencePoints: +10, eva: -1, crewDamage: { role: 'engineer', amount: 26 } } },
        { label: 'Find a safer route to the bottom',
          outcome: { food: -8, water: -6, sciencePoints: +20 } }
      ]
    }
  },

  {
    id: 'ancient_riverbed',
    weight: 5,
    severity: 'moderate',
    image: 'assets/images/surface-panorama.jpg',
    modal: {
      title: 'Ancient Riverbed',
      description: 'Layered sediment glints in the sun. Three billion years ago, water flowed here for millions of years. Whatever once lived in it might still be in the rock.',
      choices: [
        { label: 'Quick walk-through scan',
          outcome: { sciencePoints: +20, food: -3, factCategory: 'WATER' } },
        { label: 'Deep biological survey',
          skillCheck: { role: 'biologist', successP: 0.75 },
          successOutcome: { sciencePoints: +60, water: +5, factCategory: 'ASTROBIOLOGY' },
          failOutcome:    { sciencePoints: +25, crewDamage: { role: 'biologist', amount: 18 } } },
        { label: 'Move on — too costly',
          outcome: { power: -2 } }
      ]
    }
  },

  {
    id: 'frozen_lake',
    weight: 5,
    severity: 'moderate',
    modal: {
      title: 'Subsurface Ice Deposit',
      description: 'Ground-penetrating radar pings a sheet of clean water-ice three meters down. A drill could change the run — if it doesn\'t crack open something nasty.',
      choices: [
        { label: 'Extract water (shallow drill)',
          outcome: { water: +20, mech: -1, factCategory: 'WATER' } },
        { label: 'Deep core for biosignatures',
          skillCheck: { role: 'biologist', successP: 0.65 },
          successOutcome: { sciencePoints: +50, water: +8, factCategory: 'WATER' },
          failOutcome:    { sciencePoints: +20, mech: -1, crewDamage: { role: 'biologist', amount: 22 } } },
        { label: 'Extended extraction (more water, more time)',
          outcome: { water: +30, food: -6, power: -5, crewDamage: { amount: 8 } } }
      ]
    }
  }

];
