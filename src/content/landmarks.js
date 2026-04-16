// Mars Trail — landmark flavor + arrival-stop encounter generator.
// At each landmark (except the final destination), the crew pauses and
// the player picks how to spend a sol: rest, survey, scavenge, or push on.

export const LANDMARKS = {
  jezero: {
    name: 'Jezero Crater',
    flavor: 'An ancient river delta. Perseverance landed here in 2021. Sedimentary layers record three billion years of Mars history — biosignatures, if they exist anywhere, may be here.',
    fact:   'Perseverance landed at Jezero on 18 February 2021. The crater held a lake roughly 3.5 billion years ago with an inflowing river delta — one of the most promising sites for preserved ancient biosignatures.'
  },
  syrtis: {
    name: 'Syrtis Major',
    flavor: 'Dark basaltic plains left by ancient volcanism. Clay minerals hint at neutral-pH water that once pooled in shallow basins.',
    fact:   'Syrtis Major is the oldest Martian surface feature recognized by astronomers — first mapped by Christiaan Huygens in 1659. Its basalts date to the Noachian and contain neutral-pH clays once bathed in liquid water.'
  },
  arabia: {
    name: 'Arabia Terra',
    flavor: 'Heavily cratered uplands with layered sediments exposed in canyon walls. Evidence of long-vanished shallow seas.',
    fact:   'Arabia Terra contains layered sediments up to 2 km thick in its crater walls, evidence of extended wet climates between 3.5 and 4 Bya. "Ghost craters" buried in later deposits reveal a long erosion history.'
  },
  meridiani: {
    name: 'Meridiani Planum',
    flavor: 'Smooth hematite plains. Opportunity confirmed liquid water here. Iron-rich spherules — "blueberries" — dot the ground.',
    fact:   'Opportunity confirmed liquid water at Meridiani in 2004 by analyzing iron-rich spherules called "blueberries," which form only in standing water. The rover drove 45 km over 14 years and outlived its 90-sol design life 60-fold.'
  },
  gale: {
    name: 'Gale Crater',
    flavor: 'A 154-km impact crater with Mt. Sharp rising at its center. Curiosity still climbs its slopes, reading planetary history one stratum at a time.',
    fact:   'Curiosity arrived at Gale in August 2012 and has driven over 30 km. Mt. Sharp, a 5-km tall layered mound at the crater center, preserves about 2 billion years of Martian climate history in its stratigraphy.'
  },
  elysium: {
    name: 'Elysium Planitia',
    flavor: 'Young volcanic plains crossed by fault lines. InSight listened for marsquakes here until its panels choked on dust in 2022.',
    fact:   'InSight operated at Elysium from 2018 to 2022, detecting more than 1,300 marsquakes. Its seismic data measured Mars\'s core at a radius of ~1,830 km — larger and less dense than previously modeled.'
  },
  tharsis: {
    name: 'Tharsis Montes',
    flavor: 'A vast volcanic plateau, home to four shield volcanoes. Lava tubes below could one day shelter colonists — or hide things that should stay hidden.',
    fact:   'The Tharsis plateau rose roughly 10 km through basalt outflows starting 3.7 Bya. It hosts Olympus Mons (25 km tall, the tallest known mountain in the solar system) and three other shield volcanoes in a line 3,000 km long.'
  },
  olympus_base: {
    name: 'Olympus Base',
    flavor: 'Mission destination. Prefabricated habitats wait in low-power mode on the flank of Olympus Mons.',
    fact:   'Olympus Mons has a footprint the size of Arizona. Its shield-volcano slopes are so gentle (~5°) that a climber at its base would not see the summit, which is hidden by the planet\'s curvature.'
  }
};

// Generate an arrival-stop encounter for a given landmark. Same 4 choices at
// each stop in v1 — the flavor text varies by location. Shape matches the
// random-event modal so the existing modal UI handles it.
export function makeLandmarkEncounter(landmarkId) {
  const entry = LANDMARKS[landmarkId] || { name: landmarkId, flavor: '' };
  return {
    id: 'landmark_' + landmarkId,
    severity: 'landmark',
    isLandmark: true,
    modal: {
      title: `Arrival — ${entry.name}`,
      description: entry.flavor + ' Dedicate this sol to:',
      choices: [
        { label: 'Rest the crew',
          outcome: { food: -6, water: -4, crewHeal: 12 } },
        { label: 'Run a science survey',
          outcome: { power: -4, sciencePoints: +30,
                     fact: entry.fact || '' } },
        { label: 'Scavenge for parts & water',
          skillCheck: { role: 'engineer', successP: 0.70 },
          successOutcome: { mech: +1, water: +8 },
          failOutcome:    { food: -3, crewDamage: { amount: 15 } } },
        { label: 'Continue onward — no stop',
          primary: true,
          outcome: {} }
      ]
    }
  };
}
