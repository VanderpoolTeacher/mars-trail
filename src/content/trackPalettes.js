// Mars Trail — per-track 2-color palettes for the soundtrack visualizer.
// Keys are the audio.js track ids ('title' + GAMEPLAY_TRACKS ids).
// Two colors per track: bg (background drift base) and accent (pulse + orb highlight).

export const TRACK_PALETTES = {
  title:     { bg: '#1a0a3d', accent: '#a060ff' },
  vacuum:    { bg: '#001a3a', accent: '#80a0ff' },
  choir:     { bg: '#4d3a1a', accent: '#ffc850' },
  violin:    { bg: '#4d1a3a', accent: '#ff50b4' },
  void:      { bg: '#0a1a0a', accent: '#50ff80' },
  star:      { bg: '#2a2a2a', accent: '#e0e0e0' },
  crater:    { bg: '#3a1a0a', accent: '#ff8050' },
  voidbread: { bg: '#1a3d2a', accent: '#80ffc0' }
};

const FALLBACK = TRACK_PALETTES.title;

export function getPalette(trackId) {
  return TRACK_PALETTES[trackId] || FALLBACK;
}
