// Mars Trail — away-team chain content (issue #17).
// Keyed by waypointId. Each chain matches the v0.6.0 multiStage shape
// (stages dict, startStage, per-choice outcome | skillCheck | nextStage)
// with one extension: choices may carry `returnSolDelta` (number). When a
// choice is taken inside an away-team camp, that delta is added to
// state.awayTeam.returnSol — "go deeper" pushes the due-back sol out;
// "bail early" pulls it in.
//
// Also supported: outcome.awayTeamDamage (number). Applies HP damage to
// a random alive away-team member rather than the full crew.
//
// The final stage's skill check is where the advanced fact reward is
// gated — earlier stages may grant partial SCI, but factsLearned only
// grows on a terminal-stage success.
//
// Chain-depth mix (v0.7.0): three 1-stage quick grabs, six 2-stage, three
// 3-stage deep descents. Specialists match factPool → role:
//   GEOLOGY → engineer, WATER/ASTROBIOLOGY → biologist, ATMOSPHERE → pilot.

export const AWAY_TEAM_CHAINS = {

  // ---- GEOLOGY ----

  olivine_outcrop: {
    startStage: 'approach',
    stages: {
      approach: {
        title:       'Olivine Outcrop — On Foot',
        description: 'The cliff face drops fifteen meters to a fresh volcanic scar. Rappel gear is in the kit; ridgeline scan is the safe read.',
        choices: [
          { label:          'Rappel to the fresh face (deeper sample)',
            nextStage:      'deep_sample',
            returnSolDelta: 1 },
          { label:          'Scan the face from the ridgeline',
            skillCheck:     { role: 'engineer', successP: 0.75 },
            successOutcome: { sciencePoints: 40 },
            failOutcome:    { sciencePoints: 15 },
            nextStage:      null }
        ]
      },
      deep_sample: {
        title:       'Down the Face',
        description: 'You are halfway down the scar, rope anchored above. Fresh olivine vein exposed at eye level — drillable if you commit.',
        choices: [
          { label:          'Drill the exposed vein',
            skillCheck:     { role: 'engineer', successP: 0.75 },
            successOutcome: { sciencePoints: 80 },
            failOutcome:    { sciencePoints: 30, awayTeamDamage: 20 },
            nextStage:      null },
          { label:          'Bag a chip sample and climb out',
            returnSolDelta: -1,
            outcome:        { sciencePoints: 35 },
            nextStage:      null }
        ]
      }
    }
  },

  lander_wreckage: {
    startStage: 'approach',
    stages: {
      approach: {
        title:       'Soviet Lander Crash Site',
        description: 'The debris field stretches 200 meters. Best-preserved pieces cluster near the main body.',
        choices: [
          { label:     'Map the debris field first',
            nextStage: 'debris' },
          { label:          'Push straight to the main body',
            nextStage:      'tape_recovery',
            returnSolDelta: 1 }
        ]
      },
      debris: {
        title:       'Across the Wreckage',
        description: 'RTG module is still warm. Fragments tell a thermal-failure story. The main body sits beyond, tape drive visible.',
        choices: [
          { label:     'Work toward the tape drive',
            nextStage: 'tape_recovery' },
          { label:          'Bag what you have and turn back',
            skillCheck:     { role: 'engineer', successP: 0.75 },
            successOutcome: { sciencePoints: 50 },
            failOutcome:    { sciencePoints: 20 },
            nextStage:      null }
        ]
      },
      tape_recovery: {
        title:       'The Tape Drive',
        description: 'Corroded housing. Gentle heat might release the spool — or snap it. The RTG cells are a guaranteed haul either way.',
        choices: [
          { label:          'Heat the housing, spool carefully',
            skillCheck:     { role: 'engineer', successP: 0.75 },
            successOutcome: { sciencePoints: 80 },
            failOutcome:    { sciencePoints: 30, awayTeamDamage: 20 },
            nextStage:      null },
          { label:          'Pull the RTG cells, skip the tape',
            returnSolDelta: -1,
            outcome:        { sciencePoints: 40 },
            nextStage:      null }
        ]
      }
    }
  },

  lava_tube: {
    startStage: 'pit_descent',
    stages: {
      pit_descent: {
        title:       'Pit Skylight',
        description: 'The collapse opens thirty meters down into an intact lava tube. You can rope in — or lower a probe from the lip.',
        choices: [
          { label:          'Descend into the tube',
            nextStage:      'interior',
            returnSolDelta: 1 },
          { label:          'Drop a probe from the lip',
            skillCheck:     { role: 'engineer', successP: 0.75 },
            successOutcome: { sciencePoints: 40 },
            failOutcome:    { sciencePoints: 20 },
            nextStage:      null }
        ]
      },
      interior: {
        title:       'Inside the Tube',
        description: 'Tube extends two hundred meters at least. Floor is clean regolith; walls show gas escape textures. Full traverse or sample-and-return?',
        choices: [
          { label:          'Traverse and map the full length',
            skillCheck:     { role: 'engineer', successP: 0.75 },
            successOutcome: { sciencePoints: 75 },
            failOutcome:    { sciencePoints: 25, awayTeamDamage: 20 },
            nextStage:      null },
          { label:          'Sample the entrance zone and back out',
            returnSolDelta: -1,
            outcome:        { sciencePoints: 35 },
            nextStage:      null }
        ]
      }
    }
  },

  meteorite_field: {
    startStage: 'survey',
    stages: {
      survey: {
        title:       'Meteorite Scatter',
        description: 'Dozens of iron-nickel chunks across a kilometer of plain. Preserved because Mars has no plate tectonics to recycle them.',
        choices: [
          { label:          'Spectrometer sweep, log every specimen',
            skillCheck:     { role: 'engineer', successP: 0.75 },
            successOutcome: { sciencePoints: 50 },
            failOutcome:    { sciencePoints: 20 },
            nextStage:      null },
          { label:          'Grab the largest three and go',
            outcome:        { sciencePoints: 30 },
            nextStage:      null }
        ]
      }
    }
  },

  // ---- WATER ----

  subsurface_ice: {
    startStage: 'approach',
    stages: {
      approach: {
        title:       'Ice-Lens Ridge',
        description: 'GPR shows the lens four meters below the ridge crest. You can set up a drill rig or do a surface isotope scan.',
        choices: [
          { label:          'Deploy the core drill',
            nextStage:      'core_sample',
            returnSolDelta: 1 },
          { label:          'Surface isotope scan only',
            skillCheck:     { role: 'biologist', successP: 0.75 },
            successOutcome: { sciencePoints: 40 },
            failOutcome:    { sciencePoints: 15 },
            nextStage:      null }
        ]
      },
      core_sample: {
        title:       'Drilling the Lens',
        description: 'You have a clean three-meter ice column. Pushing to five meters gets you pre-amazonian ice — if the drill holds.',
        choices: [
          { label:          'Push to five meters',
            skillCheck:     { role: 'biologist', successP: 0.75 },
            successOutcome: { sciencePoints: 80 },
            failOutcome:    { sciencePoints: 30, awayTeamDamage: 15 },
            nextStage:      null },
          { label:          'Three meters is plenty — pull the core',
            returnSolDelta: -1,
            outcome:        { sciencePoints: 35 },
            nextStage:      null }
        ]
      }
    }
  },

  rsl_observation: {
    startStage: 'observe',
    stages: {
      observe: {
        title:       'Active Slope',
        description: 'The dark streak is flowing right now. You have this window.',
        choices: [
          { label:          'Pull a sediment sample from the active channel',
            skillCheck:     { role: 'biologist', successP: 0.75 },
            successOutcome: { sciencePoints: 55 },
            failOutcome:    { sciencePoints: 20 },
            nextStage:      null },
          { label:          'Spectroscopic read from stable ground',
            outcome:        { sciencePoints: 30 },
            nextStage:      null }
        ]
      }
    }
  },

  banded_deposit: {
    startStage: 'sample',
    stages: {
      sample: {
        title:       'Layered Crater Wall',
        description: 'Clay-sulfate banding is legible with the naked eye. A clean cross-section cut preserves the sequence; grab samples are faster.',
        choices: [
          { label:          'Saw a clean cross-section slab',
            skillCheck:     { role: 'biologist', successP: 0.75 },
            successOutcome: { sciencePoints: 55 },
            failOutcome:    { sciencePoints: 25 },
            nextStage:      null },
          { label:          'Chip three samples and go',
            outcome:        { sciencePoints: 30 },
            nextStage:      null }
        ]
      }
    }
  },

  ancient_rille: {
    startStage: 'junction_survey',
    stages: {
      junction_survey: {
        title:       'Channel Junction',
        description: 'Two dry channels meet at thirty degrees — classic fluvial confluence. Downstream terraces are a day further.',
        choices: [
          { label:          'Trace downstream to the terrace exposure',
            nextStage:      'terrace',
            returnSolDelta: 1 },
          { label:          'Sample the junction basalt and call it',
            skillCheck:     { role: 'biologist', successP: 0.75 },
            successOutcome: { sciencePoints: 40 },
            failOutcome:    { sciencePoints: 15 },
            nextStage:      null }
        ]
      },
      terrace: {
        title:       'Terrace Bank',
        description: 'Stratigraphic layers exposed cleanly along the bank. Climbing gets you the full section. Falling gets you a cracked suit.',
        choices: [
          { label:          'Climb for a full stratigraphic read',
            skillCheck:     { role: 'biologist', successP: 0.75 },
            successOutcome: { sciencePoints: 75 },
            failOutcome:    { sciencePoints: 30, awayTeamDamage: 20 },
            nextStage:      null },
          { label:          'Sample the base and retreat',
            returnSolDelta: -1,
            outcome:        { sciencePoints: 40 },
            nextStage:      null }
        ]
      }
    }
  },

  // ---- ATMOSPHERE ----

  polar_layered: {
    startStage: 'descend',
    stages: {
      descend: {
        title:       'Polar Cliff',
        description: 'Millions of years of ice-dust layering exposed in one vertical face. Mid-column has the cleanest horizons.',
        choices: [
          { label:          'Rappel to mid-column for direct sampling',
            nextStage:      'core',
            returnSolDelta: 1 },
          { label:          'Image-and-spectroscopy from the rim',
            skillCheck:     { role: 'pilot', successP: 0.75 },
            successOutcome: { sciencePoints: 40 },
            failOutcome:    { sciencePoints: 15 },
            nextStage:      null }
        ]
      },
      core: {
        title:       'Horizontal Core',
        description: 'You can drill one continuous two-meter horizontal core, or take three bagged grabs. Core reads cleanly if it holds.',
        choices: [
          { label:          'Continuous horizontal core',
            skillCheck:     { role: 'pilot', successP: 0.75 },
            successOutcome: { sciencePoints: 80 },
            failOutcome:    { sciencePoints: 30, awayTeamDamage: 15 },
            nextStage:      null },
          { label:          'Three bag samples and out',
            outcome:        { sciencePoints: 40 },
            nextStage:      null }
        ]
      }
    }
  },

  dust_devil_corridor: {
    startStage: 'deploy',
    stages: {
      deploy: {
        title:       'Dust-Devil Corridor',
        description: 'Fresh tracks. Devils pass this ridge several times per sol. You can set instruments and hide — or drop passive recorders.',
        choices: [
          { label:          'Plant sensors and wait for a contact',
            nextStage:      'contact',
            returnSolDelta: 1 },
          { label:          'Drop passive recorders and leave',
            skillCheck:     { role: 'pilot', successP: 0.75 },
            successOutcome: { sciencePoints: 35 },
            failOutcome:    { sciencePoints: 15 },
            nextStage:      null }
        ]
      },
      contact: {
        title:       'Incoming Devil',
        description: 'Funnel closing from the south-southwest. Twenty-second window. Real-time telemetry means holding position inside the tracks.',
        choices: [
          { label:          'Hold position through the contact',
            skillCheck:     { role: 'pilot', successP: 0.75 },
            successOutcome: { sciencePoints: 70 },
            failOutcome:    { sciencePoints: 20, awayTeamDamage: 25 },
            nextStage:      null },
          { label:          'Retreat, rely on passive logs',
            returnSolDelta: -1,
            outcome:        { sciencePoints: 35 },
            nextStage:      null }
        ]
      }
    }
  },

  // ---- ASTROBIOLOGY ----

  methane_seep: {
    startStage: 'sensor_setup',
    stages: {
      sensor_setup: {
        title:       'Intermittent Plume',
        description: 'The seep is fitful. A monitoring station catches a flare event if you are patient; a snapshot read gets you a decent sample now.',
        choices: [
          { label:          'Plant the monitoring station, wait',
            nextStage:      'wait',
            returnSolDelta: 1 },
          { label:          'Snapshot read and move on',
            skillCheck:     { role: 'biologist', successP: 0.75 },
            successOutcome: { sciencePoints: 45 },
            failOutcome:    { sciencePoints: 15 },
            nextStage:      null }
        ]
      },
      wait: {
        title:       'Six Hours of Watching',
        description: 'A flare at the four-hour mark. Plume is drifting downwind. You can chase for isotopic composition or call it here.',
        choices: [
          { label:          'Chase the plume downwind',
            nextStage:      'downwind_trace',
            returnSolDelta: 1 },
          { label:          'Log the flare and pack up',
            skillCheck:     { role: 'biologist', successP: 0.75 },
            successOutcome: { sciencePoints: 60 },
            failOutcome:    { sciencePoints: 25 },
            nextStage:      null }
        ]
      },
      downwind_trace: {
        title:       'Downwind Trap',
        description: 'The plume is thinning. Deploy the isotopic trap now and you get biogenic-versus-abiogenic signal. Miss and the plume is gone.',
        choices: [
          { label:          'Commit, deploy the trap',
            skillCheck:     { role: 'biologist', successP: 0.75 },
            successOutcome: { sciencePoints: 90 },
            failOutcome:    { sciencePoints: 30, awayTeamDamage: 20 },
            nextStage:      null },
          { label:          'Partial grab sample, abort trap',
            returnSolDelta: -1,
            outcome:        { sciencePoints: 45 },
            nextStage:      null }
        ]
      }
    }
  },

  biosig_deposit: {
    startStage: 'site_assay',
    stages: {
      site_assay: {
        title:       'Ancient Lakebed',
        description: 'The organics signal is right at noise. Methodical grid assay takes a full day; direct coring skips ahead but you guess at the hotspot.',
        choices: [
          { label:          'Run the full assay grid',
            nextStage:      'grid',
            returnSolDelta: 1 },
          { label:          'Core three spots, skip the grid',
            nextStage:      'preserve',
            returnSolDelta: 1 }
        ]
      },
      grid: {
        title:       'Grid Complete',
        description: 'Hotspot is in the northeast quadrant. Concentrated cores there are the high-value play; a light sampling walks away clean.',
        choices: [
          { label:          'Focus the northeast, deep cores',
            nextStage: 'preserve' },
          { label:          'Light sampling across the grid',
            skillCheck:     { role: 'biologist', successP: 0.75 },
            successOutcome: { sciencePoints: 60 },
            failOutcome:    { sciencePoints: 25 },
            nextStage:      null }
        ]
      },
      preserve: {
        title:       'Sample Preservation',
        description: 'You have the material. Vacuum-sealing under full contamination protocol preserves volatile organics for Earth return. Standard prep is faster but loses the light molecules.',
        choices: [
          { label:          'Full vacuum protocol',
            skillCheck:     { role: 'biologist', successP: 0.75 },
            successOutcome: { sciencePoints: 95 },
            failOutcome:    { sciencePoints: 35, awayTeamDamage: 25 },
            nextStage:      null },
          { label:          'Standard prep and bag it',
            outcome:        { sciencePoints: 50 },
            nextStage:      null }
        ]
      }
    }
  }

};
