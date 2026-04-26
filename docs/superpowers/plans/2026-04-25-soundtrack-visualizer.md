# Soundtrack Visualizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 16:9 audio-reactive visualizer panel to the Lounge — per-track palette drives a procedural drifting-orbs backdrop, and pulse rings spawn from the analyser on amplitude transients. Resolves issue #72.

**Architecture:** Single `<canvas>`-based engine driven by `requestAnimationFrame`. Lazy `AudioContext` + `AnalyserNode` wired to the existing `Audio` element via a new `getAnalyser()` export from `src/audio.js`. Visualizer module owns its render loop and pulse-ring state; Lounge calls `startVisualizer(canvas, getCurrentTrackId)` on open and `stopVisualizer()` on close.

**Tech Stack:** Vanilla ES modules, Canvas 2D, Web Audio API, CSS Grid for the new top-section layout.

**Verification approach:** No test framework — same as the Lounge plan. Each task ends with a manual browser verification step run against `python3 -m http.server 8765`.

---

## File map

| Path | Action | Responsibility |
|---|---|---|
| `src/content/trackPalettes.js` | Create | Per-track 2-color palettes + `getPalette(id)` |
| `src/audio.js` | Modify | Add `getAnalyser()` (lazy AudioContext + AnalyserNode) |
| `src/ui/visualizer.js` | Create | Canvas renderer, RAF loop, drifting orbs, pulse rings |
| `src/ui/lounge.js` | Modify | Two-column top-section layout; start/stop visualizer on open/close |
| `styles/components.css` | Modify | Now-playing card → grid layout with 16:9 visualizer slot; narrow-viewport stack |
| `package.json` | Modify | Bump version to 0.12.0 |

---

## Task 0: Branch + dev server

- [ ] **Step 1: Create feature branch**

```bash
git checkout -b feature/visualizer
```

- [ ] **Step 2: Start static dev server in the project root**

```bash
python3 -m http.server 8765
```

Run in background. URL for verification: `http://localhost:8765/`.

- [ ] **Step 3: Sanity check** — open the URL, confirm the Lounge from v0.11.0 still works (vinyl button bottom-right, opens Lounge, tracks playable).

---

## Task 1: Create `src/content/trackPalettes.js`

**Files:**
- Create: `src/content/trackPalettes.js`

- [ ] **Step 1: Write the file**

```js
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
```

- [ ] **Step 2: Manual verification — Node**

```bash
node -e "import('./src/content/trackPalettes.js').then(m => { console.log(m.getPalette('vacuum')); console.log(m.getPalette('xxx')); })"
```

Expected:
```
{ bg: '#001a3a', accent: '#80a0ff' }
{ bg: '#1a0a3d', accent: '#a060ff' }
```

- [ ] **Step 3: Commit**

```bash
git add src/content/trackPalettes.js
git commit -m "content: per-track 2-color palettes for visualizer (#72)"
```

---

## Task 2: Add `getAnalyser()` to `src/audio.js`

**Files:**
- Modify: `src/audio.js` (append at end)

- [ ] **Step 1: Append to bottom of `src/audio.js`**

```js
// ---- Web Audio analyser (used by the Lounge visualizer) ----
// Lazily wires the existing <audio> element through an AnalyserNode.
// Created on first call (which only happens after the user opens the
// Lounge — i.e., after a user gesture, satisfying autoplay policies).
let analyser = null;
let audioCtx = null;
let mediaSource = null;

export function getAnalyser() {
  if (analyser) return analyser;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioCtx    = new AudioCtx();
    mediaSource = audioCtx.createMediaElementSource(audio);
    analyser    = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.6;
    mediaSource.connect(analyser);
    analyser.connect(audioCtx.destination);
    return analyser;
  } catch (err) {
    // createMediaElementSource throws if called twice on the same element.
    // Anything else: degrade silently — visualizer falls back to backdrop-only.
    return analyser; // null on the very first failure
  }
}

// Resume the AudioContext if the browser auto-suspended it on tab blur.
export function resumeAudioContext() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}
```

- [ ] **Step 2: Manual verification in DevTools console**

Open `http://localhost:8765/`, start a mission so gameplay music plays, then:

```js
const a = await import('/src/audio.js');
const an = a.getAnalyser();
an.fftSize;                                 // 256
an.smoothingTimeConstant;                   // 0.6
const buf = new Uint8Array(an.frequencyBinCount);
an.getByteTimeDomainData(buf);
buf.slice(0, 5);                            // values around 128 (silence baseline) or varying with the music
a.getAnalyser() === an;                     // true (idempotent)
```

Expected: same `AnalyserNode` returned on second call; `buf` contains values that change frame-to-frame while music plays. Music must still be audible.

- [ ] **Step 3: Commit**

```bash
git add src/audio.js
git commit -m "audio: lazy AnalyserNode + resumeAudioContext helper (#72)"
```

---

## Task 3: Create `src/ui/visualizer.js`

**Files:**
- Create: `src/ui/visualizer.js`

- [ ] **Step 1: Write the file**

```js
// Mars Trail — Lounge soundtrack visualizer.
// One <canvas>, one RAF loop. Draws:
//   1. Per-track ambient backdrop (drifting orbs in the palette)
//   2. Audio-reactive pulse rings (spawned on amplitude transients)

import { getAnalyser, resumeAudioContext, isPlaying } from '../audio.js';
import { getPalette } from '../content/trackPalettes.js';

const ORB_COUNT     = 5;
const RING_LIFETIME = 900;    // ms
const RING_MAX      = 8;      // concurrent rings cap
const TRIGGER_FACTOR = 1.18;  // RMS must exceed avg * this to spawn a ring
const TRIGGER_MIN_GAP = 120;  // ms between ring spawns
const RMS_HISTORY = 30;       // ~0.5s @ 60fps for moving average

let canvas = null;
let ctx    = null;
let getTrackIdFn = null;
let rafId = 0;
let analyser = null;
let timeData = null;
let orbs = [];
let rings = [];
let rmsHistory = [];
let lastTriggerAt = 0;
let startTime = 0;
let lastFrameAt = 0;

function resizeCanvasToBackingStore() {
  // Match the canvas backing store to its CSS size, accounting for DPR,
  // so circles look round and lines crisp.
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const targetW = Math.max(1, Math.floor(rect.width  * dpr));
  const targetH = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width  = targetW;
    canvas.height = targetH;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
}

function buildOrbs(palette, w, h) {
  // Independent low-frequency drifters. Phases offset so they don't sync.
  return Array.from({ length: ORB_COUNT }, (_, i) => ({
    cx: Math.random(),
    cy: Math.random(),
    r:  0.18 + Math.random() * 0.18,    // fraction of min(w,h)
    dxFreq: 0.00007 + Math.random() * 0.00012,
    dyFreq: 0.00007 + Math.random() * 0.00012,
    dxAmp:  0.18 + Math.random() * 0.10,
    dyAmp:  0.14 + Math.random() * 0.10,
    phaseX: Math.random() * Math.PI * 2,
    phaseY: Math.random() * Math.PI * 2,
    color:  i % 2 === 0 ? palette.bg : palette.accent
  }));
}

function drawBackdrop(palette, w, h, t) {
  // Wash the canvas in palette.bg, then layer translucent radial orbs.
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, w, h);

  const minDim = Math.min(w, h);
  for (const orb of orbs) {
    const x = w * (orb.cx + Math.sin(t * orb.dxFreq + orb.phaseX) * orb.dxAmp);
    const y = h * (orb.cy + Math.cos(t * orb.dyFreq + orb.phaseY) * orb.dyAmp);
    const r = minDim * orb.r;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0,   hexWithAlpha(orb.color, 0.45));
    grad.addColorStop(0.6, hexWithAlpha(orb.color, 0.10));
    grad.addColorStop(1,   hexWithAlpha(orb.color, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

function maybeSpawnRing(palette, now) {
  if (!analyser || !timeData) return;
  if (!isPlaying()) return;

  analyser.getByteTimeDomainData(timeData);

  // RMS over time-domain (centered at 128).
  let sumSq = 0;
  for (let i = 0; i < timeData.length; i++) {
    const v = (timeData[i] - 128) / 128;
    sumSq += v * v;
  }
  const rms = Math.sqrt(sumSq / timeData.length);

  rmsHistory.push(rms);
  if (rmsHistory.length > RMS_HISTORY) rmsHistory.shift();
  const avg = rmsHistory.reduce((a, b) => a + b, 0) / rmsHistory.length;

  if (rms > avg * TRIGGER_FACTOR && (now - lastTriggerAt) > TRIGGER_MIN_GAP) {
    if (rings.length < RING_MAX) {
      rings.push({
        spawnAt: now,
        peakAlpha: Math.min(0.9, 0.35 + (rms - avg) * 4),
        color: palette.accent
      });
      lastTriggerAt = now;
    }
  }
}

function drawRings(w, h, now) {
  if (rings.length === 0) return;
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.min(w, h) * 0.55;

  ctx.lineWidth = 2;
  for (let i = rings.length - 1; i >= 0; i--) {
    const ring = rings[i];
    const age = now - ring.spawnAt;
    if (age >= RING_LIFETIME) { rings.splice(i, 1); continue; }
    const progress = age / RING_LIFETIME;          // 0..1
    const r = Math.min(maxR, maxR * progress);
    const alpha = ring.peakAlpha * (1 - progress); // fade out
    ctx.strokeStyle = hexWithAlpha(ring.color, alpha);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function frame(now) {
  if (!canvas || !ctx) return;
  resizeCanvasToBackingStore();

  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  const t = now - startTime;

  const palette = getPalette(getTrackIdFn ? getTrackIdFn() : null);

  // Rebuild orbs the first frame OR if palette changed (color refresh on track change).
  if (orbs.length === 0 || orbs[0]._paletteSig !== paletteSig(palette)) {
    orbs = buildOrbs(palette, w, h);
    orbs.forEach(o => { o._paletteSig = paletteSig(palette); });
  }

  drawBackdrop(palette, w, h, t);
  maybeSpawnRing(palette, now);
  drawRings(w, h, now);

  lastFrameAt = now;
  rafId = requestAnimationFrame(frame);
}

function paletteSig(p) { return `${p.bg}|${p.accent}`; }

function hexWithAlpha(hex, alpha) {
  // Accepts #rgb or #rrggbb. Returns rgba(...) string.
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function startVisualizer(canvasEl, getTrackId) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  getTrackIdFn = getTrackId;

  analyser = getAnalyser();
  if (analyser) {
    timeData = new Uint8Array(analyser.fftSize);
    resumeAudioContext();
  }

  orbs = [];
  rings = [];
  rmsHistory = [];
  lastTriggerAt = 0;
  startTime = performance.now();
  rafId = requestAnimationFrame(frame);
}

export function stopVisualizer() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  canvas = null;
  ctx = null;
  getTrackIdFn = null;
  // Keep analyser/timeData alive — cheap to reuse on next open.
}
```

- [ ] **Step 2: Manual verification deferred** until Task 5 wires the canvas. Just confirm syntax:

```bash
node --check src/ui/visualizer.js && echo OK
```

Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add src/ui/visualizer.js
git commit -m "ui: soundtrack visualizer module (canvas + RAF + analyser) (#72)"
```

---

## Task 4: Update Lounge layout — two-column top section + canvas

**Files:**
- Modify: `src/ui/lounge.js`

- [ ] **Step 1: Add the visualizer imports near the top of `src/ui/lounge.js`**

Find the existing import block at the top. Add this new import right after the `getActiveTheme` import line:

```js
import { startVisualizer, stopVisualizer } from './visualizer.js';
```

- [ ] **Step 2: Restructure the now-playing section in `render()`**

Find this block in `src/ui/lounge.js`:

```html
      <section class="lounge-now-playing" id="lounge-now-playing" aria-live="polite">
        <div class="lounge-np-label">NOW PLAYING</div>
        <div class="lounge-np-name"  id="lounge-np-name">—</div>
        <div class="lounge-np-flavor" id="lounge-np-flavor"></div>
        <div class="lounge-progress-row">
          <span class="lounge-time" id="lounge-time-current">0:00</span>
          <div class="lounge-progress" id="lounge-progress" role="slider"
               aria-label="Seek" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <div class="lounge-progress-fill" id="lounge-progress-fill"></div>
          </div>
          <span class="lounge-time" id="lounge-time-total">0:00</span>
        </div>
        <div class="lounge-controls">
          <button class="lounge-ctrl" id="lounge-prev"  type="button" aria-label="Previous track">⏮</button>
          <button class="lounge-ctrl lounge-ctrl-play" id="lounge-playpause" type="button" aria-label="Play/Pause">⏸</button>
          <button class="lounge-ctrl" id="lounge-next"  type="button" aria-label="Next track">⏭</button>
          <button class="lounge-ctrl" id="lounge-mute"  type="button" aria-label="Mute/Unmute">🔊</button>
        </div>
      </section>
```

Replace with:

```html
      <section class="lounge-now-playing" id="lounge-now-playing" aria-live="polite">
        <div class="lounge-np-text">
          <div class="lounge-np-label">NOW PLAYING</div>
          <div class="lounge-np-name"  id="lounge-np-name">—</div>
          <div class="lounge-np-flavor" id="lounge-np-flavor"></div>
          <div class="lounge-progress-row">
            <span class="lounge-time" id="lounge-time-current">0:00</span>
            <div class="lounge-progress" id="lounge-progress" role="slider"
                 aria-label="Seek" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
              <div class="lounge-progress-fill" id="lounge-progress-fill"></div>
            </div>
            <span class="lounge-time" id="lounge-time-total">0:00</span>
          </div>
          <div class="lounge-controls">
            <button class="lounge-ctrl" id="lounge-prev"  type="button" aria-label="Previous track">⏮</button>
            <button class="lounge-ctrl lounge-ctrl-play" id="lounge-playpause" type="button" aria-label="Play/Pause">⏸</button>
            <button class="lounge-ctrl" id="lounge-next"  type="button" aria-label="Next track">⏭</button>
            <button class="lounge-ctrl" id="lounge-mute"  type="button" aria-label="Mute/Unmute">🔊</button>
          </div>
        </div>
        <canvas class="lounge-visualizer" id="lounge-visualizer" aria-hidden="true"></canvas>
      </section>
```

- [ ] **Step 3: Start/stop visualizer on open/close**

Find `openLounge` in `src/ui/lounge.js`:

```js
export function openLounge(onClose) {
  if (opened) return;
  opened = true;
  onCloseCb = onClose || null;

  const layer = document.getElementById('lounge-layer');
  layer.classList.add('active');
  render();

  document.addEventListener('keydown', escClose);
}
```

Replace with:

```js
export function openLounge(onClose) {
  if (opened) return;
  opened = true;
  onCloseCb = onClose || null;

  const layer = document.getElementById('lounge-layer');
  layer.classList.add('active');
  render();

  const canvas = layer.querySelector('#lounge-visualizer');
  if (canvas) startVisualizer(canvas, getCurrentTrackId);

  document.addEventListener('keydown', escClose);
}
```

Find `close` in the same file:

```js
export function close() {
  if (!opened) return;
  opened = false;
  const layer = document.getElementById('lounge-layer');
  if (layer) {
    layer.classList.remove('active');
    layer.innerHTML = '';
  }
  document.removeEventListener('keydown', escClose);
  if (onCloseCb) { const cb = onCloseCb; onCloseCb = null; cb(); }
}
```

Replace with:

```js
export function close() {
  if (!opened) return;
  opened = false;
  stopVisualizer();
  const layer = document.getElementById('lounge-layer');
  if (layer) {
    layer.classList.remove('active');
    layer.innerHTML = '';
  }
  document.removeEventListener('keydown', escClose);
  if (onCloseCb) { const cb = onCloseCb; onCloseCb = null; cb(); }
}
```

- [ ] **Step 4: Restart visualizer when the theme selector re-renders the Lounge**

Find the theme selector handler inside `wire()`:

```js
  layer.querySelector('#lounge-theme-select').addEventListener('change', (e) => {
    setActiveTheme(e.target.value);
    render();   // re-render so flavor copy + skin update immediately
  });
```

Replace with:

```js
  layer.querySelector('#lounge-theme-select').addEventListener('change', (e) => {
    setActiveTheme(e.target.value);
    stopVisualizer();
    render();
    const c = document.getElementById('lounge-visualizer');
    if (c) startVisualizer(c, getCurrentTrackId);
  });
```

- [ ] **Step 5: Manual verification deferred** until Task 5 styles the new layout. Syntax check:

```bash
node --check src/ui/lounge.js && echo OK
```

Expected: `OK`.

- [ ] **Step 6: Commit**

```bash
git add src/ui/lounge.js
git commit -m "ui: Lounge two-column top section + visualizer lifecycle (#72)"
```

---

## Task 5: Style the new layout in `styles/components.css`

**Files:**
- Modify: `styles/components.css`

- [ ] **Step 1: Replace the existing `.lounge-now-playing` rule**

Find this block in `styles/components.css`:

```css
.lounge-now-playing {
  border: 1px solid var(--fg-faint);
  padding: 14px 16px;
  background: var(--bg-panel);
}
```

Replace with:

```css
.lounge-now-playing {
  border: 1px solid var(--fg-faint);
  padding: 14px 16px;
  background: var(--bg-panel);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: stretch;
}
.lounge-np-text {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.lounge-visualizer {
  width: 100%;
  aspect-ratio: 16 / 9;
  height: auto;
  border: 1px solid var(--fg-faint);
  background: #000;
  display: block;
  align-self: center;
}

@media (max-width: 640px) {
  .lounge-now-playing {
    grid-template-columns: 1fr;
  }
  .lounge-visualizer {
    order: -1;   /* visualizer above the text on narrow screens */
  }
}
```

- [ ] **Step 2: Manual verification — full end-to-end**

Open the Lounge from `http://localhost:8765/`. Confirm each:

1. Top section has two columns: now-playing text/controls on the left, a 16:9 black canvas on the right.
2. Click any gameplay row → music starts → the visualizer shows a colored backdrop drifting (orbs) and pulse rings spawning around the center on louder moments.
3. Each track shows a visibly different palette (e.g., `vacuum` blue-purple, `choir` warm yellow-brown, `voidbread` mint).
4. Click ⏯ to pause → no new pulse rings spawn; backdrop still drifts.
5. Click ⏯ to resume → pulse rings start spawning again.
6. Switch theme via the in-Lounge `THEME` selector → Lounge re-renders, visualizer resumes within ~1 frame, palette unchanged (driven by track, not theme).
7. Close the Lounge → in DevTools Performance/Console, confirm CPU drops (no more RAF callbacks). Quick check: `(window.requestAnimationFrame.toString())` is unchanged but no console activity from the visualizer.
8. Re-open the Lounge → visualizer resumes correctly. No double-render artifacts.
9. Resize the window so it gets narrower than 640px → the visualizer moves above the text column and stays 16:9.
10. Reload the page → all functionality still works on a fresh load.
11. Start a mission, then open the Lounge mid-mission → visualizer works during gameplay too.

If any check fails, fix in a follow-up commit before moving on.

- [ ] **Step 3: Commit**

```bash
git add styles/components.css
git commit -m "css: Lounge top-section grid + 16:9 visualizer slot (#72)"
```

---

## Task 6: Version bump + ship

- [ ] **Step 1: Bump version**

Edit `package.json`:

```json
{
  "type": "module",
  "private": true,
  "version": "0.12.0"
}
```

- [ ] **Step 2: Commit version bump**

```bash
git add package.json
git commit -m "v0.12.0: soundtrack visualizer in the Lounge"
```

- [ ] **Step 3: Stop the dev server** (Ctrl-C the background `python3 -m http.server 8765`).

- [ ] **Step 4: Push and open PR**

```bash
git push -u origin feature/visualizer
gh pr create --title "v0.12.0: soundtrack visualizer" --body "Closes #72."
```

---

## Self-review notes

**Spec coverage check** — every acceptance criterion in #72 maps to verification in Task 5 step 2:

- 16:9 visualizer next to now-playing text → check 1
- Smooth render while open + playing → checks 2, 5, 8
- 8 tracks visibly distinct palettes → check 3
- Pulse rings track the music → checks 2, 4, 5
- Pause freezes spawns; backdrop continues → check 4
- Closing stops RAF (no CPU) → check 7
- No regressions to playback → checks 5, 11
- Chrome and Safari → run check 1–11 in both browsers before merging

**Type consistency check:**
- `getAnalyser()`, `resumeAudioContext()` defined in audio.js Task 2, used in visualizer.js Task 3 ✓
- `getPalette()` defined in trackPalettes.js Task 1, used in visualizer.js Task 3 ✓
- `startVisualizer(canvas, getTrackId)` / `stopVisualizer()` defined in Task 3, called from lounge.js Task 4 ✓
- Existing imports in lounge.js already include `getCurrentTrackId` (used in visualizer wiring) ✓

**Placeholder scan:** none.

**Scope check:** single-subsystem feature, single plan is appropriate.
