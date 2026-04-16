// Mars Trail — in-game codex / encyclopedia.
// Terms that appear in facts and descriptions become clickable links.
// Each entry is 2-3 sentences of real, accessible context.

export const CODEX = {

  // ---- People ----
  'Christiaan Huygens': 'Dutch astronomer and physicist (1629–1695). In 1659 he produced the first known sketch of a Martian surface feature — the dark region now called Syrtis Major. He also discovered Saturn\'s moon Titan and invented the pendulum clock.',
  'Giovanni Schiaparelli': 'Italian astronomer (1835–1910) who mapped Mars in detail during the 1877 opposition. His term "canali" (channels) was mistranslated as "canals," fueling decades of speculation about Martian civilization.',

  // ---- Missions & rovers ----
  'Perseverance': 'NASA\'s Mars 2020 rover. Landed at Jezero Crater on February 18, 2021. Equipped with 23 cameras, a drill for coring rock samples, and the MOXIE oxygen-production experiment. Its samples are cached for eventual return to Earth.',
  'Curiosity': 'NASA\'s Mars Science Laboratory rover. Landed in Gale Crater on August 6, 2012. The car-sized rover has driven over 30 km, climbing the foothills of Mt. Sharp while analyzing rocks with a laser spectrometer (ChemCam) and a chemistry lab (SAM).',
  'Opportunity': 'NASA\'s Mars Exploration Rover B. Landed at Meridiani Planum on January 25, 2004, for a planned 90-sol mission. It drove 45.16 km over 14 years — a record for any off-Earth wheeled vehicle — before a global dust storm ended communications in June 2018.',
  'Spirit': 'NASA\'s Mars Exploration Rover A. Landed at Gusev Crater on January 4, 2004. Spirit operated for over 6 years, discovering silica deposits that suggested past hydrothermal activity, before becoming stuck in soft soil in 2009.',
  'InSight': 'NASA\'s Interior Exploration using Seismic Investigations lander. Operated at Elysium Planitia from November 2018 to December 2022. Its SEIS seismometer detected 1,319 marsquakes and measured Mars\'s core radius at ~1,830 km.',
  'Ingenuity': 'NASA\'s Mars helicopter. Arrived with Perseverance in 2021 as a technology demonstration. Achieved the first powered, controlled flight on another planet on April 19, 2021, and completed 72 flights before a rotor blade was damaged in January 2024.',
  'Phoenix': 'NASA lander that operated near Mars\'s north pole from May to November 2008. It confirmed water ice just below the surface and detected perchlorate salts in the soil — toxic to humans but potentially useful as a water and oxygen source.',
  'Viking': 'NASA\'s twin landers (Viking 1 and 2) arrived at Mars in 1976 — the first successful US Mars landing. They conducted the first biology experiments on Mars. Results were ambiguous and remain debated to this day.',
  'MAVEN': 'Mars Atmosphere and Volatile Evolution orbiter, operational since September 2014. It studies how solar wind strips Mars\'s atmosphere over time and has shown that Mars lost most of its atmosphere over billions of years due to the lack of a global magnetic field.',
  'MRO': 'Mars Reconnaissance Orbiter, in Mars orbit since 2006. Its HiRISE camera can resolve objects as small as a desk from orbit. MRO has returned more data than all other Mars missions combined and serves as a primary communications relay.',
  'Mars Express': 'European Space Agency orbiter, operational since December 2003. Its MARSIS radar detected a subsurface reflector beneath the south polar ice cap consistent with liquid water — a finding still debated by the scientific community.',

  // ---- Instruments ----
  'MOXIE': 'Mars Oxygen In-Situ Resource Utilization Experiment. A toaster-sized device aboard Perseverance that splits CO₂ from Mars\'s atmosphere to produce oxygen. In 16 runs it produced about 122 grams of O₂ — enough for a small dog to breathe for ~10 hours.',
  'ChemCam': 'Chemistry and Camera instrument on Curiosity. Fires a laser at rocks up to 7 meters away and analyzes the resulting plasma to determine chemical composition — over 900,000 laser shots and counting.',
  'SHERLOC': 'Scanning Habitable Environments with Raman & Luminescence for Organics & Chemicals. A UV spectrometer on Perseverance that searches for organic molecules and biosignatures in rock surfaces at microscopic scales.',
  'HiRISE': 'High Resolution Imaging Science Experiment camera on MRO. With a 50-cm mirror, it achieves 30 cm/pixel resolution from orbit — sharp enough to photograph rover tracks on the surface.',
  'SAM': 'Sample Analysis at Mars instrument suite on Curiosity. A portable chemistry lab that heats rock samples to 1,000°C and analyzes released gases. SAM detected organic molecules in Gale Crater mudstone — the first definitive organics found on Mars.',
  'RAD': 'Radiation Assessment Detector on Curiosity. It measures the radiation environment on Mars\'s surface, providing data critical for planning crewed missions. Surface dose is roughly 0.67 millisieverts per day — about half what astronauts receive on the ISS.',

  // ---- Places ----
  'Olympus Mons': 'The tallest volcano in the solar system — 21.9 km above the Martian datum, nearly three times the height of Everest. Its base spans roughly 600 km. Shield-type, with some lava flows as young as 25 million years old.',
  'Valles Marineris': 'The largest canyon system in the solar system, stretching ~4,000 km across Mars — about the width of the continental United States. Up to 7 km deep, it formed primarily from tectonic rifting as the Tharsis Bulge deformed the crust.',
  'Jezero Crater': 'A 45-km-wide impact crater that once held a lake fed by at least one river delta, roughly 3.5 billion years ago. Perseverance\'s landing site and one of the most promising locations for preserved ancient biosignatures.',
  'Gale Crater': 'A 154-km-wide impact crater with Aeolis Mons (Mt. Sharp) rising 5 km at its center. The layered mound records about 2 billion years of Martian climate history. Curiosity\'s exploration site since August 2012.',
  'Hellas Planitia': 'The largest confirmed impact basin on Mars — about 2,300 km across and 7 km deep. Atmospheric pressure on its floor is ~89% higher than the planetary average, theoretically allowing brief episodes of liquid water under current conditions.',
  'Meridiani Planum': 'A smooth plain of hematite-rich soil near the Martian equator. Opportunity found small iron-oxide spherules ("blueberries") here in 2004, confirming that liquid water once saturated the ancient rock.',
  'Tharsis': 'A vast volcanic plateau roughly the size of North America, rising up to 10 km above surrounding terrain. Hosts Olympus Mons and three other giant shield volcanoes. Its mass may have shifted Mars\'s rotational axis early in the planet\'s history.',
  'Elysium Planitia': 'Volcanic plains in the northern lowlands. Home to Elysium Mons and the InSight landing site. Young lava flows near Cerberus Fossae may be among the most recently active volcanic features on Mars.',

  // ---- Rover systems ----
  'RTG': 'Radioisotope thermoelectric generator. Converts heat from plutonium-238 decay into ~100-400 W of continuous electricity. Used by Curiosity, Perseverance, Voyager, and Cassini. Produces stable power regardless of weather or dust and degrades only ~5% per decade.',
  'radioisotope thermoelectric generator': 'RTG — a power source that converts heat from plutonium-238 decay into continuous electricity. Immune to dust storms and darkness, which is why both Curiosity and Perseverance carry them instead of solar panels.',
  'MOTV': 'Mars Overland Transport Vehicle. Pressurized, crewed rover concept with RTG power, life support loop, airlock, and ~4-6 person capacity. NASA\'s Space Exploration Vehicle (SEV) is a related design. Intended for multi-week traverses away from a main habitat.',

  // ---- Concepts ----
  'Noachian': 'The earliest geological period in Martian history, roughly 4.1–3.7 billion years ago. Named after Noachis Terra. During this period Mars had a thicker atmosphere, warmer temperatures, and widespread liquid surface water.',
  'Recurring Slope Lineae': 'Dark streaks that appear seasonally on steep Martian slopes. First imaged by HiRISE in 2011. Initially thought to indicate briny water flow, though dry granular movement is now considered a more likely explanation.',
  'perchlorate': 'Chlorine-oxygen salts (ClO₄⁻) widespread in Martian soil, first detected by Phoenix in 2008. Toxic to human thyroid function, but perchlorates lower the freezing point of water and some Earth bacteria metabolize them as an energy source.',
  'hematite blueberries': 'Millimeter-scale spherical concretions of hematite (Fe₂O₃) found by Opportunity at Meridiani Planum. They formed inside ancient water-saturated rock, then eroded out as the surrounding sediment weathered away — strong evidence for past liquid water.',
  'biosignature': 'Any substance, structure, or pattern that provides evidence of past or present life. On Mars, scientists search for organic molecules, isotopic anomalies, microbial textures in sedimentary rock, and atmospheric gases like methane.',
  'sol': 'A Martian solar day — the time it takes Mars to rotate once relative to the Sun. One sol is 24 hours and 37 minutes, only slightly longer than an Earth day. Mission planning uses sol counts (Sol 1, Sol 2, ...) rather than Earth dates.',
  'regolith': 'The layer of loose, broken rock and dust covering Mars\'s bedrock surface. Martian regolith is rich in iron oxides (giving Mars its red color) and perchlorates. It has been studied as a potential building material for future habitats.',
  'lava tube': 'An underground tunnel formed when the surface of a lava flow cools and solidifies while molten rock continues flowing beneath. On Mars, lower gravity allows tubes up to 100× wider than on Earth — potentially large enough to shelter entire colonies.',

  // ---- Moons ----
  'Phobos': 'The larger and inner moon of Mars, orbiting just 6,000 km above the surface — closer than any other known moon to its planet. It completes an orbit in 7 hours 39 minutes and is gradually spiraling inward; in ~50 million years it will either crash into Mars or break apart into a ring.',
  'Deimos': 'The smaller and outer moon of Mars, orbiting at ~23,460 km. Only about 12 km across, it is one of the smallest moons in the solar system. From Mars\'s surface, Deimos appears as a bright star-like point that takes 2.7 days to cross the sky.'
};

// Sorted by descending length so longer terms match first
// (e.g., "Mars Express" before "Mars").
export const CODEX_TERMS = Object.keys(CODEX).sort((a, b) => b.length - a.length);
