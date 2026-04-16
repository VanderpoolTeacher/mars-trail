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
    id: 'perchlorate_contamination',
    weight: 5,
    severity: 'moderate',
    modal: {
      title: 'Perchlorate Contamination',
      description: 'Regolith tracked in from recent EVA. Perchlorate salts spiking in the air-handling filters — toxic to thyroid function at prolonged exposure.',
      choices: [
        { label: 'Full decontamination protocol',
          skillCheck: { role: 'medic', successP: 0.85 },
          successOutcome: { water: -6, eva: -1, factCategory: 'ASTROBIOLOGY' },
          failOutcome:    { water: -8, eva: -1, crewDamage: { amount: 10 } } },
        { label: 'Quick rinse and ventilate',
          outcome: { water: -4, crewDamage: { amount: 8 } } },
        { label: 'Ignore — push through',
          outcome: { crewDamage: { amount: 16 } } }
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
    oneShot: true,
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
    oneShot: true,
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
    oneShot: true,
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

  // ---------- Away-team missions ----------
  // Rare, high-risk, high-reward EVA ops requiring specialist sign-off.
  // Failure can be catastrophic; the cautious option is almost always free
  // but surrenders major science. "No risk, no discovery."

  {
    id: 'away_distress_beacon',
    weight: 3,
    severity: 'away-team',
    oneShot: true,
    image: 'assets/images/surface-panorama.jpg',
    modal: {
      title: 'Distress Beacon — 12 km N',
      description: 'A faint VHF pulse from beyond the next ridge. Encoded as an Ares-program emergency locator, but the signal is decades old. Whoever or whatever set it is still broadcasting.',
      choices: [
        { label: 'Dispatch away team',
          skillCheck: { role: 'engineer', successP: 0.65 },
          successOutcome: { sciencePoints: +80, water: -8, eva: -1, factCategory: 'MISSIONS',
            narrative: 'Alex traces the beacon to a weathered comms stub jutting from a regolith drift — the last broadcast from a failed sample-return lander. The flight recorder survives. Forty-three sols of uncrewed transit data are now on your drives.',
            dialogue: { role: 'engineer', text: 'Whoever left this wasn\'t coming back. Recorder\'s intact — someone on Earth is going to cry.' } },
          failOutcome: { eva: -1, water: -12, sciencePoints: +20, crewDamage: { role: 'engineer', amount: 38 },
            narrative: 'The beacon site is a collapsed regolith-covered pit. Alex punches through a crust and falls two meters onto jagged basalt. You recover the flight recorder but the EVA suit is trashed and the engineer is bleeding into their helmet on the drive back.',
            dialogue: { role: 'engineer', text: 'I\'m through. Suit breach sealed. Give me… give me ten minutes.' } } },
        { label: 'Triangulate and continue',
          outcome: { sciencePoints: +15, power: -3,
            narrative: 'You mark the beacon location on the orbital catalog for a future recovery mission. No EVA, no drama.' } },
        { label: 'Ignore — not our mission',
          primary: true,
          outcome: { food: -3, water: -2, crewDamage: { amount: 6 },
            narrative: 'The signal fades behind the ridge. The crew\'s silence is heavier than usual.' } }
      ]
    }
  },

  {
    id: 'away_derelict_lander',
    weight: 3,
    severity: 'away-team',
    oneShot: true,
    image: 'assets/images/opportunity.jpg',
    modal: {
      title: 'Derelict Lander',
      description: 'Half-buried wreckage of an uncrewed NASA lander from a previous decade. Its solid-state storage may hold unpublished data — and its RTG, if intact, tells a story about long-term surface exposure.',
      choices: [
        { label: 'Recover data core (Biologist + Engineer)',
          skillCheck: { role: 'biologist', successP: 0.70 },
          successOutcome: { sciencePoints: +95, eva: -1, factCategory: 'MISSIONS',
            narrative: 'Riya extracts the storage module and jury-rigs a power supply. The data stretches back to the last week of the original mission — a cliffhanger that cost a prior generation of engineers their careers. Your drives now carry the answer.',
            dialogue: { role: 'biologist', text: 'Thirty years of unpublished data. Commander — this changes everything.' } },
          failOutcome:    { eva: -1, sciencePoints: +25, crewDamage: { role: 'biologist', amount: 30 },
            narrative: 'The corroded chassis collapses as Riya leans into it. A panel shears off and catches her arm, tearing the EVA suit at the elbow. Emergency sealant holds. You get a partial data dump but lose an hour and a lot of blood on the return crawl.',
            dialogue: { role: 'biologist', text: 'I\'ll wear the scar. We got the partial dump — and a lesson.' } } },
        { label: 'Photograph exterior and move on',
          outcome: { sciencePoints: +20,
            narrative: 'High-res imagery of the weathered lander. Good enough for a paper. Not good enough for the grants.' } },
        { label: 'Skip — safer to keep driving',
          primary: true,
          outcome: { food: -3, water: -2, crewDamage: { amount: 6 },
            narrative: 'You drive past the wreckage. It will still be there in a thousand years.' } }
      ]
    }
  },

  {
    id: 'away_brine_drill',
    weight: 3,
    severity: 'away-team',
    oneShot: true,
    image: 'assets/images/crater.jpg',
    modal: {
      title: 'Subsurface Brine Layer',
      description: 'Ground-penetrating radar shows a 40-meter-deep perchlorate brine pocket below the rover. Liquid water on Mars, today. Possibly inhabited. Possibly not. A drill run takes most of a sol and a full EVA team.',
      choices: [
        { label: 'Deep drill + biosig sampling',
          skillCheck: { role: 'biologist', successP: 0.60 },
          successOutcome: { sciencePoints: +110, water: +20, mech: -1, eva: -1, factCategory: 'ASTROBIOLOGY',
            narrative: 'The drill breaks through at 38 meters. Brine rises under its own pressure, dark with dissolved salts and suspended particulates. Riya runs the Raman spectrometer with her hands shaking. Organic signatures. Not proof. Not yet. But she cries into her helmet anyway.',
            dialogue: { role: 'biologist', text: 'Organics. I\'m — I\'m not saying life. I\'m saying organics. God.' } },
          failOutcome:    { mech: -1, eva: -1, water: -6, sciencePoints: +30, crewDamage: { role: 'biologist', amount: 40 },
            narrative: 'The drill seizes at 22 meters. When Riya moves to clear the bit, a pocket of pressurized brine vents explosively into her face shield. Perchlorate burns through the seal before emergency decontamination can stop it. The sample is lost. Riya is alive.',
            dialogue: { role: 'biologist', text: 'I can taste the perchlorate through the seal. Medical. Now.' } } },
        { label: 'Shallow drill — water only',
          outcome: { water: +15, mech: -1, sciencePoints: +15,
            narrative: 'You bring up fifteen liters of filtered brine water. The deeper layer stays buried — next crew\'s problem.' } },
        { label: 'Log the radar return and skip',
          primary: true,
          outcome: { sciencePoints: +8, food: -3,
            narrative: 'The radar trace goes into the archive. Somewhere, a future geobiologist will argue about it.' } }
      ]
    }
  },

  {
    id: 'away_canyon_wall',
    weight: 3,
    severity: 'away-team',
    oneShot: true,
    image: 'assets/images/crater.jpg',
    modal: {
      title: 'Canyon Wall Traverse',
      description: 'A side gorge cuts through four billion years of Martian stratigraphy. Rappelling the full 800-meter face would expose layers from the Noachian down through the Amazonian. Gear-intensive. Crew-intensive. Dangerous.',
      choices: [
        { label: 'Full descent + sample run (Pilot + Engineer)',
          skillCheck: { role: 'engineer', successP: 0.55 },
          successOutcome: { sciencePoints: +100, eva: -2, factCategory: 'GEOLOGY',
            narrative: 'Mei belays. Alex takes the line down. Every thirty meters he hammers a sample tube into a different epoch. At the bottom he stands in rock older than Earth\'s oldest continent and sends up a photograph that will be the cover of every textbook for a generation.',
            dialogue: { role: 'engineer', text: 'Four billion years of rock. Every sample is gold. Haul me up.' } },
          failOutcome:    { eva: -2, sciencePoints: +30, crewDamage: { role: 'engineer', amount: 42 },
            narrative: 'The anchor pulls at 200 meters down. Alex swings into the wall — the emergency line catches but his shoulder separates and his kit scatters down the gorge. Mei hauls him back up over four sols of ugly winching. He lives. The samples do not.',
            dialogue: { role: 'pilot', text: 'Hold on. I\'ve got you. Do not let go of that line — look at me, Alex.' } } },
        { label: 'Partial descent to first ledge',
          skillCheck: { role: 'engineer', successP: 0.80 },
          successOutcome: { sciencePoints: +45, eva: -1, factCategory: 'GEOLOGY',
            narrative: 'Alex reaches the first ledge, punches in anchor bolts, and collects a dozen samples from a single dramatic exposure. Solid science. No heroics.' },
          failOutcome:    { eva: -1, sciencePoints: +15, crewDamage: { role: 'engineer', amount: 22 },
            narrative: 'A loose shelf gives way under Alex\'s boot. The safety line catches but the jolt knocks him unconscious against the wall. Mei pulls him up. He takes a sol of medical recovery before he can work again.' } },
        { label: 'Shoot drone telemetry from the rim',
          outcome: { sciencePoints: +22, power: -4,
            narrative: 'The survey drone whines into the canyon, imaging the wall in multispectral until its battery dies. No one EVAs. No one dies.' } }
      ]
    }
  },

  {
    id: 'frozen_lake',
    oneShot: true,
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
