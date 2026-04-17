// Mars Trail — advanced Mars facts, reachable only via science waypoints.
// Routine event-driven facts live in src/content/marsFacts.js; these
// exist in a separate namespace so the player can distinguish
// waypoint-earned content in the codex.

export const ADVANCED_GEOLOGY_FACTS = [
  "Olivine (Mg,Fe)2SiO4 is thermodynamically unstable in the presence of liquid water. Its widespread preservation on Mars is one of the strongest constraints on how DRY the surface has been for most of Martian history — much drier than the Amazonian fluvial features alone would imply.",
  "Mars's banded iron formations — if confirmed — would be some of the oldest sedimentary rocks in the solar system. Similar formations on Earth mark the Great Oxidation Event; their Martian analogs would require either transient oxygen or a fundamentally different iron-cycling chemistry.",
  "Perseverance's SHERLOC instrument has detected organic compounds in Jezero Crater sediments, but distinguishing biotic from abiotic origin requires context that can only come from sample return. Every waypoint sample you log narrows the interpretation window.",
  "The Tharsis volcanic complex is so massive (roughly 2% of Mars's total mass) that it physically reoriented the planet's spin axis. The current poles are not where they would be without Tharsis.",
  "Mars's oldest preserved rocks are ~4.4 billion years old — older than any rocks on Earth. Earth's plate tectonics recycled its earliest crust; Mars's lack of plates froze its ancient surface in place.",
  "Iron-nickel meteorites on Mars survive erosion longer than silicate rocks because oxidation proceeds more slowly in the thin atmosphere. Some 'Martian' meteorites we collect have been on the surface for >1 million years."
];

export const ADVANCED_WATER_FACTS = [
  "Subsurface ice on Mars isn't just locked in permafrost — radar reveals 'pore ice' dispersed through regolith at depths from 1 meter to several hundred meters. Extracting it for a crewed base is far more efficient than electrolysis from atmospheric CO2.",
  "Recurring slope lineae (RSL) flow DOWNHILL seasonally, but their composition is debated. Perchlorate brines would remain liquid well below 0°C; granular flows would not need liquid at all. The current consensus leans dry — but nobody's taken a direct sample.",
  "Polar layered deposits preserve a 4-million-year climate record in alternating ice and dust bands. Sampling a vertical transect would resolve Mars's obliquity-driven ice-age cycles with unprecedented resolution.",
  "The Valles Marineris canyon system shows water-carved tributaries on its walls — but the main canyon is tectonic, not fluvial. Mars eroded its own Grand Canyon into an older rift.",
  "Ancient rille networks near the equator show a power-law relationship between tributary count and main-channel width. This is characteristic of sustained rainfall, not catastrophic flooding — a data point in favor of a once-warmer Mars.",
  "Banded iron-sulfur deposits require cycling oxidation states. On Earth that's usually biological. On Mars it's the unresolved question of the decade."
];

export const ADVANCED_ATMOSPHERE_FACTS = [
  "Mars's polar ice caps are ~85% CO2 ice seasonally and ~100% water ice at the base. During summer at each pole, enough CO2 sublimates to change global atmospheric pressure by ~25%.",
  "Dust devils on Mars reach 8 km tall and can persist for hours. Their electrostatic discharges — up to 20 kV/m — complicate any EVA near active corridors.",
  "The Martian ionosphere has its own weather, driven by solar wind penetration through the weak magnetic field. Radio blackouts during solar events can last longer than any telecom redundancy plans account for.",
  "Methane on Mars varies seasonally in ways that are genuinely unexplained. Curiosity has measured it; the Trace Gas Orbiter has looked for it in the upper atmosphere and can't find it — the discrepancy is the mystery.",
  "Argon-36/argon-38 isotopic ratios in the atmosphere are 40% of the solar nebula value. That number tells us Mars has lost ~60% of its original atmosphere to space over 4 billion years.",
  "Dust-storm-suspended particles on Mars carry ~10× more static charge per unit mass than terrestrial dust. A global dust storm is an electrical hazard, not just an optical one."
];

export const ADVANCED_ASTROBIOLOGY_FACTS = [
  "Perchlorate salts are abundant in Martian regolith (up to 1% by mass). Perchlorates depress water's freezing point to -70°C — making liquid brines plausible even at mid-latitudes — but they're also cytotoxic, complicating any biosignature interpretation and any crew food-safety protocol.",
  "The best candidate locations for preserved microbial biosignatures on Mars are not where liquid water currently exists — they're where liquid water existed 3.5 billion years ago AND subsequent conditions were stable (no ionizing radiation at depth, no repeated freeze-thaw). Jezero's lake-delta sediments fit this profile precisely.",
  "If life ever existed on Mars, the strongest expected biosignature isn't a fossil — it's an isotopic anomaly. Life fractionates carbon and sulfur isotopes in patterns that purely geological processes rarely match. Detecting a δ13C anomaly in a waypoint sample would rewrite every textbook.",
  "Lava tubes on Mars are the most radiation-shielded natural environments known off-Earth. Surface cosmic-ray exposure runs ~250 mSv/year; a few meters of basalt roof cuts that by >99%. Any long-duration microbial survival would have happened underground.",
  "Mars atmospheric methane COULD be biogenic. It could also be serpentinization, cometary delivery, or Mars-clathrate release. The scientific community has been unable to rule out biology for 20 years. Every new waypoint measurement matters.",
  "Chirality — the handedness of organic molecules — is the cleanest biosignature available. Non-living processes produce 50/50 racemic mixtures; life produces enantiomer-biased distributions. A single waypoint sample with detectable chirality bias would be historic."
];
