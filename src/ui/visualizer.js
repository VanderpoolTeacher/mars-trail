// Mars Trail — Lounge soundtrack visualizer.
// One <canvas>, one RAF loop. Draws:
//   1. Per-track ambient backdrop (drifting orbs in the palette)
//   2. Audio-reactive pulse rings (spawned on amplitude transients)

import { getAnalyser, resumeAudioContext, isPlaying } from '../audio.js';
import { getPalette } from '../content/trackPalettes.js';

const ORB_COUNT      = 5;
const RING_LIFETIME  = 900;    // ms
const RING_MAX       = 8;      // concurrent rings cap
const TRIGGER_FACTOR = 1.18;   // RMS must exceed avg * this to spawn a ring
const TRIGGER_MIN_GAP = 120;   // ms between ring spawns
const RMS_HISTORY    = 30;     // ~0.5s @ 60fps for moving average

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

  drawBackdrop(palette, w, h, t);
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
