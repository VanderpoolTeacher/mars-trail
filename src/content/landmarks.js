// Mars Trail — landmark flavor + arrival-stop encounter generator.
// At each landmark (except the final destination), the crew pauses and
// the player picks how to spend a sol: rest, survey, scavenge, or push on.

export const LANDMARKS = {
  jezero: {
    name: 'Jezero Crater',
    image: 'assets/images/jezero.jpg',
    flavor: 'An ancient river delta. Perseverance landed here in 2021. Sedimentary layers record three billion years of Mars history — biosignatures, if they exist anywhere, may be here.',
    fact:   'Perseverance landed at Jezero on 18 February 2021. The crater held a lake roughly 3.5 billion years ago with an inflowing river delta — one of the most promising sites for preserved ancient biosignatures.'
  },
  syrtis: {
    name: 'Syrtis Major',
    image: 'assets/images/syrtis.jpg',
    flavor: 'Dark basaltic plains left by ancient volcanism. Clay minerals hint at neutral-pH water that once pooled in shallow basins.',
    fact:   'Syrtis Major is the oldest Martian surface feature recognized by astronomers — first mapped by Christiaan Huygens in 1659. Its basalts date to the Noachian and contain neutral-pH clays once bathed in liquid water.'
  },
  arabia: {
    name: 'Arabia Terra',
    image: 'assets/images/arabia.jpg',
    flavor: 'Heavily cratered uplands with layered sediments exposed in canyon walls. Evidence of long-vanished shallow seas.',
    fact:   'Arabia Terra contains layered sediments up to 2 km thick in its crater walls, evidence of extended wet climates between 3.5 and 4 Bya. "Ghost craters" buried in later deposits reveal a long erosion history.'
  },
  meridiani: {
    name: 'Meridiani Planum',
    image: 'assets/images/meridiani.jpg',
    flavor: 'Smooth hematite plains. Opportunity confirmed liquid water here. Iron-rich spherules — "blueberries" — dot the ground.',
    fact:   'Opportunity confirmed liquid water at Meridiani in 2004 by analyzing iron-rich spherules called "blueberries," which form only in standing water. The rover drove 45 km over 14 years and outlived its 90-sol design life 60-fold.'
  },
  gale: {
    name: 'Gale Crater',
    image: 'assets/images/gale.jpg',
    flavor: 'A 154-km impact crater with Mt. Sharp rising at its center. Curiosity still climbs its slopes, reading planetary history one stratum at a time.',
    fact:   'Curiosity arrived at Gale in August 2012 and has driven over 30 km. Mt. Sharp, a 5-km tall layered mound at the crater center, preserves about 2 billion years of Martian climate history in its stratigraphy.'
  },
  elysium: {
    name: 'Elysium Planitia',
    image: 'assets/images/elysium.jpg',
    flavor: 'Young volcanic plains crossed by fault lines. InSight listened for marsquakes here until its panels choked on dust in 2022.',
    fact:   'InSight operated at Elysium from 2018 to 2022, detecting more than 1,300 marsquakes. Its seismic data measured Mars\'s core at a radius of ~1,830 km — larger and less dense than previously modeled.'
  },
  tharsis: {
    name: 'Tharsis Montes',
    image: 'assets/images/tharsis.jpg',
    flavor: 'A vast volcanic plateau, home to four shield volcanoes. Lava tubes below could one day shelter colonists — or hide things that should stay hidden.',
    fact:   'The Tharsis plateau rose roughly 10 km through basalt outflows starting 3.7 Bya. It hosts Olympus Mons (25 km tall, the tallest known mountain in the solar system) and three other shield volcanoes in a line 3,000 km long.'
  },
  olympus_base: {
    name: 'Olympus Base',
    image: 'assets/images/tharsis.jpg',
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
          outcome: { food: -6, water: -4, crewHeal: 12, power: +18, panels: +15,
            narrative: 'Eight hours of real sleep in rotating shifts. The rover\'s idle while the RTG trickles and solar tops off the batteries. Crew wake up in better shape; panels wiped down at sunrise.',
            complicationNarrative: 'Rest cycle interrupted — a false-positive atmospheric alarm roused the crew at 02:00 LMST. By morning everyone is groggier than when they started, and rations took extra hits from midnight snacking.' } },
        { label: 'Run a science survey',
          outcome: { power: -4, sciencePoints: +30,
            narrative: 'Riya leads a short EVA circuit with the spectrometer while Alex runs diagnostics on the rover. Solid science, minimal risk.',
            complicationNarrative: 'Mid-survey the spectrometer throws a calibration fault. The data is partial; the instrument needs longer to warm up than expected, eating more battery.',
            fact: entry.fact || '' } },
        { label: 'Prospect for water ice',
          skillCheck: { role: 'engineer', successP: 0.70 },
          successOutcome: { water: +15,
            narrative: 'Alex sinks a test core into a shadowed crater floor. Nine meters down, ice — clean enough to sublimate and filter straight into the tanks.' },
          failOutcome: { food: -3, power: -4, crewDamage: { amount: 12 },
            narrative: 'The first core bit snaps against buried basalt. A second attempt turns up dry regolith. Alex takes a fragment of shrapnel in the forearm during the withdrawal.',
            complicationNarrative: 'A sudden crosswind catches the drill rig while Alex is leaning in. The whole assembly topples, and the emergency sealant on his suit burns through a kit of EVA supplies.' } },
        { label: 'Continue onward — no stop',
          primary: true,
          outcome: { food: -3, water: -2, crewDamage: { amount: 6 },
            narrative: 'No stop. The rover rolls through the landmark without pausing. Crew skip a proper meal and fluid cycle; small aches accumulate.',
            complicationNarrative: 'Skipping the rest cycle stacked worse than usual — Tomás notes short tempers and dropped ration packs. By sunset three small procedural errors had to be logged for review.' } }
      ]
    }
  };
}
