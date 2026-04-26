# Soundtrack Visualizer — Design Spec

**Issue:** [#72](https://github.com/VanderpoolTeacher/mars-trail/issues/72)
**Date:** 2026-04-25
**Status:** approved

## Goal
Add a 16:9 audio-reactive visualizer to the Lounge that gives every track its own visual identity through a per-track palette, while sharing a single procedural engine.

## Layout
The Lounge top section becomes a flex row:

```
[ NOW PLAYING (text + flavor + time + seek + controls) ] [ 16:9 visualizer ]
```

- ~50/50 width split.
- Track list scrolls below the row as today.
- Visualizer keeps a strict `aspect-ratio: 16 / 9`.

## Visualizer engine
A single `<canvas>`-based engine, rendered via `requestAnimationFrame` (~60 fps).

### Ambient backdrop (always running while Lounge is open)
- Drifting orbs / blurred radial blobs in the palette's background and accent colors.
- 4–6 orbs at any time, drifting slowly along independent low-frequency sine paths.
- No audio dependency; loops continuously.
- Sets the per-track mood.

### Audio-reactive overlay (only while music is playing)
- **Pulse rings** spawn at center on amplitude transients and expand outward, fading as they grow.
- Trigger: overall analyser energy exceeds a moving average over the last ~1 sec by a tunable factor.
- Each ring carries: spawn time, max radius, peak alpha. Drawn as a stroke in palette accent color.
- Ring lifetime: ~900 ms.
- Cap: max 8 concurrent rings to keep render cheap.

The engine ignores the active theme — palette is per-track. Frame border still picks up theme tokens for visual cohesion with the rest of the Lounge.

## Per-track palette data

New `src/content/trackPalettes.js`:

```js
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

export function getPalette(trackId) {
  return TRACK_PALETTES[trackId] || TRACK_PALETTES.title;
}
```

Palette values are tunable; the data structure is the contract.

## Audio pipe

Extend `src/audio.js` with a single new export:

```js
export function getAnalyser() // → AnalyserNode | null
```

- Lazily creates an `AudioContext`, a `MediaElementAudioSourceNode` from the existing `Audio` element, and an `AnalyserNode`.
- Wires `source → analyser → destination` so audio still plays through the speakers.
- Idempotent — subsequent calls return the same `AnalyserNode`.
- Created on first call (which only happens after the user opens the Lounge — i.e., after a user gesture, satisfying autoplay policies).
- `fftSize = 256`, `smoothingTimeConstant = 0.6` (visualizer can override).
- Returns `null` if Web Audio is unavailable; visualizer should degrade to backdrop-only.

## Visualizer module

New `src/ui/visualizer.js`:

```js
export function startVisualizer(canvas, getTrackId)
export function stopVisualizer()
```

- `startVisualizer(canvas, getTrackId)`:
  - Resolves the analyser via `audio.getAnalyser()`.
  - Begins a RAF loop. Each frame:
    1. Looks up palette via `getPalette(getTrackId())` — track changes are picked up live.
    2. Draws ambient backdrop (drifting orbs).
    3. If `isPlaying()` and analyser available: reads time-domain data, computes RMS, decides whether to spawn a new pulse ring.
    4. Advances + draws all live pulse rings; culls expired ones.
- `stopVisualizer()`:
  - Cancels RAF.
  - Releases canvas reference.
  - Keeps the `AudioContext` + `AnalyserNode` alive (cheap to reuse next time the Lounge opens).

## Lounge integration

Modify `src/ui/lounge.js`:

- New layout in `render()`: top row is a flex container with two children:
  - Left: the existing now-playing card content (label, name, flavor, time row, controls).
  - Right: a `<canvas class="lounge-visualizer">` element.
- On `openLounge()` (after `render()`): call `startVisualizer(canvas, getCurrentTrackId)`.
- On `close()` (before clearing innerHTML): call `stopVisualizer()`.
- Re-rendering (e.g., theme change) tears down and re-starts the visualizer.

## Styling

Modify `styles/components.css`:

- `.lounge-now-playing` becomes a `display: grid` (or flex) layout with two columns: `1fr 1fr`.
- `.lounge-visualizer` selector: `aspect-ratio: 16 / 9; width: 100%; height: auto; border: 1px solid var(--fg-faint); background: #000; display: block;` — Canvas drawing fills it.
- Existing controls/progress styles unchanged but parented to the left column.
- Below ~640px viewport: the row collapses to a single column (visualizer above the card) so it stays usable on narrow screens.

## Lifecycle summary

| Event | Visualizer behavior |
|---|---|
| Lounge opens, music playing | Backdrop animates; pulse rings spawn on transients |
| Lounge opens, music paused | Backdrop animates; no rings spawn |
| Music pauses while Lounge open | Existing rings finish; no new ones spawn |
| Music resumes | New rings spawn |
| Track changes (selectTrack / shuffle) | Palette swaps next frame; no flicker |
| Theme changes | Lounge re-renders; visualizer restarts (one-frame blip OK) |
| Lounge closes | RAF cancelled; CPU drops to 0 |

## Files

| Path | Action | Responsibility |
|---|---|---|
| `src/content/trackPalettes.js` | Create | Per-track 2-color palettes + `getPalette(id)` |
| `src/ui/visualizer.js` | Create | Canvas renderer, RAF loop, pulse-ring spawning |
| `src/audio.js` | Modify | Add `getAnalyser()` |
| `src/ui/lounge.js` | Modify | New top-section layout, start/stop visualizer on open/close |
| `styles/components.css` | Modify | Now-playing card → flex row with 16:9 visualizer slot, narrow-viewport collapse |
| `package.json` | Modify | Bump to `0.12.0` |

## Acceptance criteria

- [ ] Lounge top section: now-playing text on the left, 16:9 visualizer on the right.
- [ ] Visualizer renders smoothly (~60fps on a typical laptop) while Lounge open and music playing.
- [ ] Each of the 8 tracks shows a visibly distinct palette.
- [ ] Pulse rings visibly track the music — louder transients spawn brighter, more frequent rings.
- [ ] Pausing music freezes pulse spawns; backdrop continues drifting.
- [ ] Closing the Lounge stops the RAF loop (no CPU cost when closed).
- [ ] No regressions to existing audio playback (shuffle, anti-repeat, title loop, fade in/out).
- [ ] Works in Chrome and Safari.

## Out of scope (YAGNI)

- Per-track pattern variants beyond drifting orbs
- FFT-bin frequency-spectrum visuals
- Beat-detection ML / phase-locking
- Recording / exporting visualizer output
- User-customizable palettes
