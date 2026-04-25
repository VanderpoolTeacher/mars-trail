// Mars Trail — per-theme flavor copy for the Lounge.
// Keys are the audio.js track ids ('title' + GAMEPLAY_TRACKS ids).
// Themes match the ids in src/theme.js: 'mc', 'lcars', 'starfighter', 'voltron'.
// Missing keys fall back to the 'mc' (Mission Control) variant via getFlavor().

export const TRACK_FLAVOR = {
  title: {
    mc:          "Opening signal — broadcast on first contact with Tractus Martis.",
    lcars:       "Stardate 4127.1 — opening signature, transmitted on first contact with Tractus Martis.",
    starfighter: "Pre-launch hum on the runway. Helmets on. Throttles up.",
    voltron:     "The summoning hymn. Five lions, one sky."
  },
  vacuum: {
    mc:          "Field recording — ambient harmonic in the Tharsis radio shadow.",
    lcars:       "Stardate 4131.7 — ambient harmonic recorded in the Tharsis radio shadow.",
    starfighter: "Track 4 on the long burn. Saved my sanity past Phobos.",
    voltron:     "A lullaby the Blue Lion sings to the deep oceans of Naxzela."
  },
  choir: {
    mc:          "Mission audio — chorus reconstructed from EVA helmet recordings.",
    lcars:       "Stardate 4139.2 — chorus reconstructed from EVA helmet recordings.",
    starfighter: "What you hear when the squadron flies tight enough to touch wings.",
    voltron:     "The voices of the Castle of Lions, raised in unison at dawn."
  },
  violin: {
    mc:          "Intercept — solo violin from a derelict relay station.",
    lcars:       "Stardate 4144.0 — solo violin intercepted on a derelict relay.",
    starfighter: "Cassette my wingmate left in the cockpit. Played it every sortie.",
    voltron:     "Allura's lament, played the night Altea fell."
  },
  void: {
    mc:          "Procedural composition — the mathematics of empty space.",
    lcars:       "Stardate 4150.6 — algorithmic composition; mathematics of empty space.",
    starfighter: "The math song. I hum it in the long dark between jumps.",
    voltron:     "The Black Lion's meditation — patterns older than the Paladins."
  },
  star: {
    mc:          "Site recording — captured on the salt flats of Meridiani Planum.",
    lcars:       "Stardate 4157.4 — recording from the salt flats of Meridiani Planum.",
    starfighter: "What the radio sounds like when there's no one out there to answer.",
    voltron:     "The silence between roars. Sacred to the Red Lion."
  },
  crater: {
    mc:          "Geophonic capture from inside the Gale Crater rim.",
    lcars:       "Stardate 4162.9 — geophonic capture from inside Gale Crater rim.",
    starfighter: "Bass that rumbles through the canopy. Felt it in my teeth.",
    voltron:     "The Yellow Lion stomps and the earth answers."
  },
  voidbread: {
    mc:          "Galley recording — hymn sung over recycled rations.",
    lcars:       "Stardate 4170.3 — galley hymn, sung over recycled rations.",
    starfighter: "The mess hall song. Sung loud, sung off-key, sung together.",
    voltron:     "A blessing for the food, taught to the Paladins by the Olkari."
  }
};

// Resolve a flavor line, with a safe fallback if a theme is missing copy.
export function getFlavor(trackId, themeId) {
  const entry = TRACK_FLAVOR[trackId];
  if (!entry) return '';
  return entry[themeId] || entry.mc || entry.lcars || '';
}
