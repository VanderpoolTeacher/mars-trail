// Mars Trail — science waypoint pool (issue #7 part 1).
// Side-expeditions detected off the main route. Accepting a waypoint
// dispatches an away team (see src/systems/awayTeam.js). The image is
// shown in the divert offer modal.
//
// Each entry:
//   id             unique string
//   name           short display name
//   briefing       1–2 sentences shown in the offer modal
//   detourKm       km added to the segment when accepted (legacy; v0.7.0
//                  rebuilt divert as camp, so this is now flavor only)
//   detourSols     camp duration baseline (mutated per-stage by returnSolDelta)
//   sciencePoints  reward target before jitter
//   factPool       'GEOLOGY' | 'WATER' | 'ATMOSPHERE' | 'ASTROBIOLOGY'
//   image          NASA asset path (issue #30)

export const WAYPOINTS = [
  {
    id: 'olivine_outcrop',
    name: 'Olivine Outcrop',
    briefing: 'Sensors pinged Mg-rich olivine 40 km north. Primitive volcanic rock, nearly unweathered — volcanic history here runs deeper than the literature suggests.',
    detourKm: 80, detourSols: 3, sciencePoints: 50, factPool: 'GEOLOGY',
    image: 'assets/images/olivine_outcrop.jpg'
  },
  {
    id: 'subsurface_ice',
    name: 'Subsurface Ice Lens',
    briefing: 'Ground-penetrating radar shows a shallow ice lens under a nearby ridge. A core sample could resolve the age debate.',
    detourKm: 60, detourSols: 3, sciencePoints: 55, factPool: 'WATER',
    image: 'assets/images/subsurface_ice.jpg'
  },
  {
    id: 'lander_wreckage',
    name: 'Lander Wreckage Site',
    briefing: 'Catalog says a Soviet probe went silent in this region in 1971. The crash site might still hold recoverable data tapes.',
    detourKm: 100, detourSols: 4, sciencePoints: 60, factPool: 'GEOLOGY',
    image: 'assets/images/lander_wreckage.jpg'
  },
  {
    id: 'rsl_observation',
    name: 'Recurring Slope Lineae',
    briefing: 'Dark streaks on a south-facing slope — possible transient briny flows. Seasonal timing lines up. Worth a close look.',
    detourKm: 70, detourSols: 3, sciencePoints: 55, factPool: 'WATER',
    image: 'assets/images/rsl_observation.jpg'
  },
  {
    id: 'polar_layered',
    name: 'Polar Layered Transect',
    briefing: 'A cliff face exposes millions of years of ice-dust layering. A vertical transect would read like tree rings for Mars climate.',
    detourKm: 90, detourSols: 4, sciencePoints: 55, factPool: 'ATMOSPHERE',
    image: 'assets/images/polar_layered.jpg'
  },
  {
    id: 'methane_seep',
    name: 'Methane Plume',
    briefing: 'Atmospheric sensors flagged an intermittent methane pocket nearby. Source unknown — biogenic or geological? Either answer changes everything.',
    detourKm: 75, detourSols: 3, sciencePoints: 60, factPool: 'ASTROBIOLOGY',
    image: 'assets/images/methane_seep.jpg'
  },
  {
    id: 'lava_tube',
    name: 'Lava Tube Entrance',
    briefing: 'A collapsed pit nearby opens into an intact lava tube. Radiation-shielded interior — candidate site for future habitat surveys.',
    detourKm: 85, detourSols: 4, sciencePoints: 55, factPool: 'GEOLOGY',
    image: 'assets/images/lava-tube.jpg'
  },
  {
    id: 'banded_deposit',
    name: 'Banded Sedimentary Deposit',
    briefing: 'Layered clays and sulfates exposed along a crater wall. Wet-era chemistry preserved in the banding pattern.',
    detourKm: 65, detourSols: 3, sciencePoints: 50, factPool: 'WATER',
    image: 'assets/images/banded_deposit.jpg'
  },
  {
    id: 'dust_devil_corridor',
    name: 'Dust-Devil Corridor',
    briefing: 'Tracks in the regolith mark a high-frequency dust-devil path. Electrostatic sensor deployment would log the charge profile in real time.',
    detourKm: 55, detourSols: 2, sciencePoints: 45, factPool: 'ATMOSPHERE',
    image: 'assets/images/dust_devil_corridor.jpg'
  },
  {
    id: 'meteorite_field',
    name: 'Meteorite Field',
    briefing: 'MRO imagery shows a scatter of iron-nickel meteorites — preserved here because Mars has no plate tectonics to recycle them.',
    detourKm: 70, detourSols: 3, sciencePoints: 50, factPool: 'GEOLOGY',
    image: 'assets/images/meteorite_field.jpg'
  },
  {
    id: 'ancient_rille',
    name: 'Ancient River Rille',
    briefing: 'A dry channel network carved into basalt. The junction angles suggest sustained fluvial flow, not catastrophic outflow.',
    detourKm: 80, detourSols: 3, sciencePoints: 55, factPool: 'WATER',
    image: 'assets/images/ancient_rille.jpg'
  },
  {
    id: 'biosig_deposit',
    name: 'Potential Biosignature Deposit',
    briefing: 'Ancient lakebed sediments with organic carbon concentrations just above instrument noise. Confirming would be the find of the century.',
    detourKm: 95, detourSols: 4, sciencePoints: 70, factPool: 'ASTROBIOLOGY',
    image: 'assets/images/biosig_deposit.jpg'
  }
];
