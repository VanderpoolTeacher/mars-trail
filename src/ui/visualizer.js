// Mars Trail — Lounge soundtrack visualizer.
// One <canvas>, one RAF loop. Draws:
//   1. Per-track ambient backdrop (drifting orbs in the palette)
//   2. Audio-reactive pulse rings (spawned on amplitude transients)

import { getAnalyser, resumeAudioContext, isPlaying } from '../audio.js';
import { getPalette } from '../content/trackPalettes.js';

const ORB_COUNT      = 5;
const RING_LIFETIME  = 900;    // ms
const RING_MAX       = 8;      // concurrent rings cap
const TRIGGER_FACTOR = 1.40;   // RMS must exceed avg * this to spawn a ring
const TRIGGER_MIN_GAP = 350;   // ms between ring spawns
const RMS_HISTORY    = 30;     // ~0.5s @ 60fps for moving average

const BUBBLE_COUNT     = 5;
const POP_DURATION     = 1800;   // ms — particles travel slowly past the edges
const POP_PARTICLES    = 14;
const POP_HIT_PADDING  = 6;
const ENTRY_DURATION   = 3500;   // ms — slow glide from off-screen edge
const ENTRY_OFFSCREEN  = 0.18;   // cx offset just past the visible edge

let canvas = null;
let ctx    = null;
let getTrackIdFn = null;
let rafId = 0;
let analyser = null;
let timeData = null;
let orbs = [];
let bubbles = [];
let rings = [];
let rmsHistory = [];
let lastTriggerAt = 0;
let startTime = 0;

function resizeCanvasToBackingStore() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const targetW = Math.max(1, Math.floor(rect.width  * dpr));
  const targetH = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width  = targetW;
    canvas.height = targetH;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function makeBubble(palette, i, now = performance.now()) {
  // Plain circle (not wobbly). Enters from the left or right edge, then
  // settles into a slow sine drift around its target position.
  const fromRight = Math.random() < 0.5;
  return {
    cx: 0.2 + Math.random() * 0.6,
    cy: 0.2 + Math.random() * 0.6,
    baseR: 0.07 + Math.random() * 0.06,
    driftFreqX: 0.00006 + Math.random() * 0.0001,
    driftFreqY: 0.00006 + Math.random() * 0.0001,
    driftAmpX: 0.06 + Math.random() * 0.06,
    driftAmpY: 0.05 + Math.random() * 0.05,
    phaseX: Math.random() * Math.PI * 2,
    phaseY: Math.random() * Math.PI * 2,
    entrySide: fromRight ? 1 : -1,         // +1 right, -1 left
    entryStartedAt: now,
    // Animated "clear" highlight inside the bubble — orbits the center
    // and rotates on its own axis. Direction (sign) and speed vary per
    // bubble so no two move alike.
    highlightOrbitPhase: Math.random() * Math.PI * 2,
    highlightOrbitFreq:  (Math.random() < 0.5 ? -1 : 1) * (0.0004 + Math.random() * 0.0014),
    highlightTiltPhase:  Math.random() * Math.PI * 2,
    highlightTiltFreq:   (Math.random() < 0.5 ? -1 : 1) * (0.0002 + Math.random() * 0.0010),
    highlightMajor:      0.18 + Math.random() * 0.10,   // ellipse semi-major as fraction of r
    highlightMinor:      0.07 + Math.random() * 0.06,   // ellipse semi-minor as fraction of r
    color: i % 2 === 0 ? palette.accent : palette.bg,
    state: 'alive',                         // or 'popping'
    popStartedAt: 0,
    popParticles: null,
    _lastCx: 0, _lastCy: 0, _lastR: 0,
    _paletteSig: paletteSig(palette)
  };
}

function buildBubbles(palette) {
  // Stagger entry times so they don't all glide in at once on first paint.
  const now = performance.now();
  return Array.from({ length: BUBBLE_COUNT }, (_, i) => {
    const b = makeBubble(palette, i, now);
    b.entryStartedAt = now - i * 400;        // stagger first paint
    return b;
  });
}

function easeOutCubic(t) {
  const u = 1 - t;
  return 1 - u * u * u;
}

function drawBubbles(w, h, t, now) {
  const minDim = Math.min(w, h);
  for (let bi = 0; bi < bubbles.length; bi++) {
    const b = bubbles[bi];

    // Settled position with slow sine drift around the target.
    const targetCxFrac = b.cx + Math.sin(t * b.driftFreqX + b.phaseX) * b.driftAmpX;
    const cyFrac       = b.cy + Math.cos(t * b.driftFreqY + b.phaseY) * b.driftAmpY;

    // Side-entry: lerp from off-screen edge to settled cx over ENTRY_DURATION.
    const entryAge = now - b.entryStartedAt;
    let cxFrac = targetCxFrac;
    if (entryAge < ENTRY_DURATION) {
      const tEntry = easeOutCubic(Math.max(0, entryAge / ENTRY_DURATION));
      const startCx = b.entrySide > 0 ? 1 + ENTRY_OFFSCREEN : -ENTRY_OFFSCREEN;
      cxFrac = startCx + (targetCxFrac - startCx) * tEntry;
    }

    const cx = w * cxFrac;
    const cy = h * cyFrac;
    const baseR = minDim * b.baseR;

    b._lastCx = cx; b._lastCy = cy; b._lastR = baseR;

    if (b.state === 'popping') {
      const age = now - b.popStartedAt;
      if (age >= POP_DURATION) {
        const palette = getPalette(getTrackIdFn ? getTrackIdFn() : null);
        bubbles[bi] = makeBubble(palette, bi, now);
        continue;
      }
      const popProgress = age / POP_DURATION;
      // Body fades fast (first ~25% of pop), then only fragments remain.
      const bodyProgress = Math.min(1, popProgress / 0.25);
      drawBubbleBody(b, cx, cy, baseR, bodyProgress, t);
      drawPopParticles(b, popProgress, w, h);
      continue;
    }

    drawBubbleBody(b, cx, cy, baseR, 0, t);
  }
}

function drawBubbleBody(b, cx, cy, r, bodyProgress, t) {
  // bodyProgress 0 → 1 inflates the bubble and fades it out.
  const scale = 1 + bodyProgress * 0.4;
  const alphaMul = 1 - bodyProgress;
  if (alphaMul <= 0) return;
  const rr = r * scale;

  ctx.beginPath();
  ctx.arc(cx, cy, rr, 0, Math.PI * 2);
  ctx.fillStyle = hexWithAlpha(b.color, 0.10 * alphaMul);
  ctx.fill();
  ctx.strokeStyle = hexWithAlpha(b.color, 0.55 * alphaMul);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Clear (outlined) highlight — orbits the bubble center, rotates with
  // its own per-bubble direction + speed.
  const orbitAngle = b.highlightOrbitPhase + t * b.highlightOrbitFreq;
  const tiltAngle  = b.highlightTiltPhase  + t * b.highlightTiltFreq;
  const orbitR     = rr * 0.38;
  const hx = cx + Math.cos(orbitAngle) * orbitR;
  const hy = cy + Math.sin(orbitAngle) * orbitR;
  ctx.strokeStyle = `rgba(255,255,255,${0.92 * alphaMul})`;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(hx, hy, rr * b.highlightMajor, rr * b.highlightMinor, tiltAngle, 0, Math.PI * 2);
  ctx.stroke();
}

function drawPopParticles(b, popProgress, w, h) {
  if (!b.popParticles) return;
  const maxDist = Math.max(w, h) * 1.1;       // enough to fly past either edge
  const fade = Math.max(0, 1 - popProgress * 0.85);
  ctx.fillStyle = hexWithAlpha(b.color, 0.85 * fade);
  for (const p of b.popParticles) {
    const dist = maxDist * p.speed * popProgress;
    const x = b._lastCx + Math.cos(p.angle) * dist;
    const y = b._lastCy + Math.sin(p.angle) * dist;
    ctx.beginPath();
    ctx.arc(x, y, p.size * Math.max(0.4, 1 - popProgress * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
}

export function popBubbleAt(xCss, yCss, now = performance.now()) {
  // Returns true if a live bubble was hit and popped.
  let hit = -1;
  let bestDistSq = Infinity;
  for (let i = 0; i < bubbles.length; i++) {
    const b = bubbles[i];
    if (b.state !== 'alive') continue;
    const dx = xCss - b._lastCx;
    const dy = yCss - b._lastCy;
    const dSq = dx * dx + dy * dy;
    const r = b._lastR + POP_HIT_PADDING;
    if (dSq <= r * r && dSq < bestDistSq) {
      hit = i;
      bestDistSq = dSq;
    }
  }
  if (hit === -1) return false;
  const b = bubbles[hit];
  b.state = 'popping';
  b.popStartedAt = now;
  // Shatter into a ring of fragments. Each fragment has its own outward
  // speed multiplier and size, so they break apart unevenly and travel
  // past the visible edges of the panel.
  b.popParticles = Array.from({ length: POP_PARTICLES }, (_, i) => ({
    angle: (i / POP_PARTICLES) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
    speed: 0.55 + Math.random() * 0.55,
    size:  2 + Math.random() * 3
  }));
  return true;
}

function buildOrbs(palette) {
  return Array.from({ length: ORB_COUNT }, (_, i) => ({
    cx: Math.random(),
    cy: Math.random(),
    r:  0.18 + Math.random() * 0.18,
    dxFreq: 0.00007 + Math.random() * 0.00012,
    dyFreq: 0.00007 + Math.random() * 0.00012,
    dxAmp:  0.18 + Math.random() * 0.10,
    dyAmp:  0.14 + Math.random() * 0.10,
    phaseX: Math.random() * Math.PI * 2,
    phaseY: Math.random() * Math.PI * 2,
    color:  i % 2 === 0 ? palette.bg : palette.accent,
    _paletteSig: paletteSig(palette)
  }));
}

function drawBackdrop(palette, w, h, t) {
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, w, h);

  // Slow rotational depth layer — a conic gradient that creeps around the
  // center over ~40 seconds. Adds the impression of the whole panel
  // drifting, not just the orbs floating.
  const angle = (t * 0.00016) % (Math.PI * 2);
  if (typeof ctx.createConicGradient === 'function') {
    const conic = ctx.createConicGradient(angle, w / 2, h / 2);
    conic.addColorStop(0,    hexWithAlpha(palette.accent, 0.07));
    conic.addColorStop(0.25, 'rgba(0,0,0,0)');
    conic.addColorStop(0.5,  hexWithAlpha(palette.accent, 0.05));
    conic.addColorStop(0.75, 'rgba(0,0,0,0)');
    conic.addColorStop(1,    hexWithAlpha(palette.accent, 0.07));
    ctx.fillStyle = conic;
    ctx.fillRect(0, 0, w, h);
  }

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
    const progress = age / RING_LIFETIME;
    const r = Math.min(maxR, maxR * progress);
    const alpha = ring.peakAlpha * (1 - progress);
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

  if (orbs.length === 0 || orbs[0]._paletteSig !== paletteSig(palette)) {
    orbs = buildOrbs(palette);
  }
  if (bubbles.length === 0 || bubbles[0]._paletteSig !== paletteSig(palette)) {
    bubbles = buildBubbles(palette);
  }

  drawBackdrop(palette, w, h, t);
  drawBubbles(w, h, t, now);
  maybeSpawnRing(palette, now);
  drawRings(w, h, now);

  rafId = requestAnimationFrame(frame);
}

function paletteSig(p) { return `${p.bg}|${p.accent}`; }

function hexWithAlpha(hex, alpha) {
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
  bubbles = [];
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
}
