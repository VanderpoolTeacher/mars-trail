// Mars Trail — Lounge soundtrack visualizer.
// One <canvas>, one RAF loop. Draws:
//   1. Per-track ambient backdrop (drifting orbs in the palette)
//   2. Audio-reactive pulse rings (spawned on amplitude transients)

import { getAnalyser, resumeAudioContext, isPlaying, playSfx } from '../audio.js';
import { getPalette } from '../content/trackPalettes.js';

const ORB_COUNT      = 5;
const RING_LIFETIME  = 900;    // ms
const RING_MAX       = 8;      // concurrent rings cap
const TRIGGER_FACTOR = 1.40;   // RMS must exceed avg * this to spawn a ring
const TRIGGER_MIN_GAP = 350;   // ms between ring spawns
const RMS_HISTORY    = 30;     // ~0.5s @ 60fps for moving average

const BUBBLE_COUNT     = 5;
const POP_DURATION     = 1800;
const POP_PARTICLES    = 14;
const POP_HIT_PADDING  = 6;
const ENTRY_DURATION   = 5500;   // ms — speed-decay from entry to drift
const ENTRY_SPEED      = 0.16;   // px/ms — initial inward speed off-screen
const DRIFT_SPEED_MIN  = 0.012;  // px/ms — gentle wandering speed
const DRIFT_SPEED_MAX  = 0.034;

const DIAMOND_VIS_R_FRAC = 0.07; // visual radius (fraction of minDim)
const DIAMOND_HIT_R_FRAC = 0.055;// hit radius (slightly smaller — slightly forgiving)
const DIAMOND_COLOR      = '#ffe066';

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
let lastFrameTime = 0;
let lastW = 0;
let lastH = 0;

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

function luminance(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function makeBubble(palette, i, now = performance.now(), w = 800, h = 450) {
  // Pixel-space position + velocity. Bubble spawns just off one of the four
  // edges and glides inward at ENTRY_SPEED, then decays to its own drift
  // speed. Bounces off walls and other bubbles after it's fully entered.
  const minDim = Math.min(w, h);
  const r = minDim * (0.07 + Math.random() * 0.06);

  const side = Math.floor(Math.random() * 4);   // 0=left, 1=right, 2=top, 3=bottom
  let x, y, vx, vy;
  const wobble = (Math.random() - 0.5) * ENTRY_SPEED * 0.4;
  switch (side) {
    case 0:                                     // left → moving right
      x = -r; y = r + Math.random() * (h - 2 * r);
      vx = ENTRY_SPEED; vy = wobble; break;
    case 1:                                     // right → moving left
      x = w + r; y = r + Math.random() * (h - 2 * r);
      vx = -ENTRY_SPEED; vy = wobble; break;
    case 2:                                     // top → moving down
      x = r + Math.random() * (w - 2 * r); y = -r;
      vx = wobble; vy = ENTRY_SPEED; break;
    default:                                    // bottom → moving up
      x = r + Math.random() * (w - 2 * r); y = h + r;
      vx = wobble; vy = -ENTRY_SPEED; break;
  }

  const color = i % 2 === 0 ? palette.accent : palette.bg;
  return {
    x, y, vx, vy, r,
    driftSpeed: DRIFT_SPEED_MIN + Math.random() * (DRIFT_SPEED_MAX - DRIFT_SPEED_MIN),
    entryStartedAt: now,
    inside: false,                              // flips true once fully inside the panel
    color,
    lum: luminance(color),
    state: 'alive',
    popStartedAt: 0,
    popOriginX: 0,
    popOriginY: 0,
    popParticles: null,
    highlightOrbitPhase: Math.random() * Math.PI * 2,
    highlightOrbitFreq:  (Math.random() < 0.5 ? -1 : 1) * (0.0004 + Math.random() * 0.0014),
    highlightTiltPhase:  Math.random() * Math.PI * 2,
    highlightTiltFreq:   (Math.random() < 0.5 ? -1 : 1) * (0.0002 + Math.random() * 0.0010),
    highlightMajor:      0.18 + Math.random() * 0.10,
    highlightMinor:      0.07 + Math.random() * 0.06,
    _paletteSig: paletteSig(palette)
  };
}

function buildBubbles(palette, w = 800, h = 450) {
  const now = performance.now();
  return Array.from({ length: BUBBLE_COUNT }, (_, i) => {
    const b = makeBubble(palette, i, now, w, h);
    b.entryStartedAt = now - i * 600;           // stagger first paint
    return b;
  });
}

function easeOutCubic(t) {
  const u = 1 - t;
  return 1 - u * u * u;
}

function updateBubbles(w, h, dt, now) {
  // Integrate position, decay entry velocity to drift speed, bounce off
  // walls (only after entering), then resolve bubble-bubble collisions.
  for (let i = 0; i < bubbles.length; i++) {
    const b = bubbles[i];
    if (b.state !== 'alive') continue;

    b.x += b.vx * dt;
    b.y += b.vy * dt;

    const entryAge = now - b.entryStartedAt;
    const targetSpeed = (entryAge < ENTRY_DURATION)
      ? ENTRY_SPEED + (b.driftSpeed - ENTRY_SPEED) * easeOutCubic(Math.max(0, entryAge / ENTRY_DURATION))
      : b.driftSpeed;
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 0.0001) {
      b.vx = (b.vx / speed) * targetSpeed;
      b.vy = (b.vy / speed) * targetSpeed;
    }

    if (!b.inside) {
      if (b.x >= b.r && b.x <= w - b.r && b.y >= b.r && b.y <= h - b.r) b.inside = true;
    }
    if (b.inside) {
      if (b.x < b.r)        { b.x = b.r;     b.vx =  Math.abs(b.vx); }
      if (b.x > w - b.r)    { b.x = w - b.r; b.vx = -Math.abs(b.vx); }
      if (b.y < b.r)        { b.y = b.r;     b.vy =  Math.abs(b.vy); }
      if (b.y > h - b.r)    { b.y = h - b.r; b.vy = -Math.abs(b.vy); }
    }
  }

  // Pairwise elastic collisions (equal mass).
  for (let i = 0; i < bubbles.length; i++) {
    const a = bubbles[i];
    if (a.state !== 'alive' || !a.inside) continue;
    for (let j = i + 1; j < bubbles.length; j++) {
      const b = bubbles[j];
      if (b.state !== 'alive' || !b.inside) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distSq = dx * dx + dy * dy;
      const sumR = a.r + b.r;
      if (distSq < sumR * sumR && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;
        // Project velocities onto the normal and swap them (equal mass).
        const va = a.vx * nx + a.vy * ny;
        const vb = b.vx * nx + b.vy * ny;
        const dvA = vb - va;
        const dvB = va - vb;
        a.vx += dvA * nx; a.vy += dvA * ny;
        b.vx += dvB * nx; b.vy += dvB * ny;
        // De-overlap.
        const overlap = (sumR - dist) * 0.5;
        a.x -= nx * overlap; a.y -= ny * overlap;
        b.x += nx * overlap; b.y += ny * overlap;
      }
    }
  }
}

function rescaleBubbles(sx, sy) {
  const sMin = Math.min(sx, sy);
  for (const b of bubbles) {
    b.x  *= sx; b.y  *= sy;
    b.vx *= sx; b.vy *= sy;
    b.r  *= sMin;
    b.driftSpeed *= sMin;
  }
}

function drawBubbles(w, h, t, now) {
  for (let bi = 0; bi < bubbles.length; bi++) {
    const b = bubbles[bi];

    if (b.state === 'popping') {
      const age = now - b.popStartedAt;
      if (age >= POP_DURATION) {
        const palette = getPalette(getTrackIdFn ? getTrackIdFn() : null);
        bubbles[bi] = makeBubble(palette, bi, now, w, h);
        continue;
      }
      const popProgress = age / POP_DURATION;
      const bodyProgress = Math.min(1, popProgress / 0.25);
      drawBubbleBody(b, b.x, b.y, b.r, bodyProgress, t);
      drawPopParticles(b, popProgress, w, h);
      continue;
    }

    drawBubbleBody(b, b.x, b.y, b.r, 0, t);
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
  // Highlight is dimmer on darker bubbles (less luminance → less alpha).
  const highlightAlpha = 0.35 * Math.min(1, 0.15 + b.lum * 1.5);
  ctx.strokeStyle = `rgba(255,255,255,${highlightAlpha * alphaMul})`;
  ctx.lineWidth = 1;
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
    const x = b.popOriginX + Math.cos(p.angle) * dist;
    const y = b.popOriginY + Math.sin(p.angle) * dist;
    ctx.beginPath();
    ctx.arc(x, y, p.size * Math.max(0.4, 1 - popProgress * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
}

function popBubble(b, kind, now) {
  if (b.state !== 'alive') return;
  b.state = 'popping';
  b.popStartedAt = now;
  b.popOriginX = b.x;
  b.popOriginY = b.y;
  b.popParticles = Array.from({ length: POP_PARTICLES }, (_, i) => ({
    angle: (i / POP_PARTICLES) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
    speed: 0.55 + Math.random() * 0.55,
    size:  2 + Math.random() * 3
  }));
  playSfx(kind);
}

export function popBubbleAt(xCss, yCss, now = performance.now()) {
  // Returns true if a live bubble was hit and popped.
  let hit = -1;
  let bestDistSq = Infinity;
  for (let i = 0; i < bubbles.length; i++) {
    const b = bubbles[i];
    if (b.state !== 'alive') continue;
    const dx = xCss - b.x;
    const dy = yCss - b.y;
    const dSq = dx * dx + dy * dy;
    const r = b.r + POP_HIT_PADDING;
    if (dSq <= r * r && dSq < bestDistSq) {
      hit = i;
      bestDistSq = dSq;
    }
  }
  if (hit === -1) return false;
  popBubble(bubbles[hit], 'good', now);
  return true;
}

function drawDiamond(w, h, t) {
  const cx = w / 2;
  const cy = h / 2;
  const minDim = Math.min(w, h);
  const r = minDim * DIAMOND_VIS_R_FRAC;
  const rot = t * 0.0008;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.shadowColor = DIAMOND_COLOR;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r, 0);
  ctx.lineTo(0, r);
  ctx.lineTo(-r, 0);
  ctx.closePath();
  ctx.fillStyle = hexWithAlpha(DIAMOND_COLOR, 0.22);
  ctx.fill();
  ctx.strokeStyle = DIAMOND_COLOR;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
}

function checkDiamondHits(w, h, now) {
  const cx = w / 2;
  const cy = h / 2;
  const dHitR = Math.min(w, h) * DIAMOND_HIT_R_FRAC;
  for (const b of bubbles) {
    if (b.state !== 'alive' || !b.inside) continue;
    const dx = b.x - cx;
    const dy = b.y - cy;
    const sumR = b.r + dHitR;
    if (dx * dx + dy * dy < sumR * sumR) {
      popBubble(b, 'bad', now);
    }
  }
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
    bubbles = buildBubbles(palette, w, h);
  }

  // Rescale bubble positions/velocities/radii on size change (e.g.
  // fullscreen toggle, window resize) so they stay in the visible area.
  if (lastW > 0 && lastH > 0 && (lastW !== w || lastH !== h)) {
    rescaleBubbles(w / lastW, h / lastH);
  }
  lastW = w; lastH = h;

  // Physics step. Cap dt so a tab-blur stall doesn't fling everything.
  const dt = Math.min(48, lastFrameTime ? (now - lastFrameTime) : 16);
  lastFrameTime = now;
  updateBubbles(w, h, dt, now);
  checkDiamondHits(w, h, now);

  drawBackdrop(palette, w, h, t);
  drawDiamond(w, h, t);
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
  lastFrameTime = 0;
  lastW = 0;
  lastH = 0;
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
