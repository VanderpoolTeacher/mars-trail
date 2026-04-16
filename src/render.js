// Mars Trail — DOM rendering
// Each renderer is idempotent: pass current state, DOM reflects it.

import { landmarkName, ROLE_CODE, RESOURCE_LABELS, PART_TYPES, CARGO_MAX_LBS } from './state.js';
import { LANDMARKS } from './content/landmarks.js';

// Cache DOM lookups once on init.
const $ = {};
function bindDom() {
  $.clock        = document.getElementById('clock');
  $.landmarks    = document.getElementById('landmark-list');
  $.readouts     = document.getElementById('readouts');
  $.crewList     = document.getElementById('crew-list');
  $.paceSeg      = document.getElementById('pace-seg');
  $.rationsSeg   = document.getElementById('rations-seg');
  $.log          = document.getElementById('log');
  $.minimapPos   = document.getElementById('minimap-position');
  $.routeImage   = document.getElementById('route-image');
  $.routeName    = document.getElementById('route-location-name');
  $.routeDesc    = document.getElementById('route-location-desc');
  $.minimapPath  = document.getElementById('minimap-path');
  $.minimapTrail = document.getElementById('minimap-trail');
  $.minimapLands = document.getElementById('minimap-landmarks');
  $.nextSolBtn   = document.getElementById('next-sol-btn');
  $.repairBtn    = document.getElementById('repair-btn');
  $.cleanBtn     = document.getElementById('clean-btn');
}

// ---------- Topbar ----------

function renderTopbar(state) {
  // Stylized "Mars Local Mean Solar Time" derived from sol number.
  const hours   = String((state.sol * 7) % 24).padStart(2, '0');
  const minutes = String((state.sol * 11) % 60).padStart(2, '0');
  $.clock.textContent = `SOL ${state.sol} · ${hours}:${minutes} LMST`;

  const sci = document.getElementById('sci-counter');
  if (sci) sci.textContent = `SCI ${state.sciencePoints || 0}`;
}

// ---------- Route ----------

function renderRoute(state) {
  const items = state.route.map((id, i) => {
    const isCurrent = i === state.currentLandmarkIndex;
    const isDest    = i === state.route.length - 1;
    const cls = ['landmark'];
    if (isCurrent) cls.push('current');
    if (isDest)    cls.push('dest');
    const marker = isCurrent ? '▶' : isDest ? '◎' : '·';
    return `<li class="${cls.join(' ')}"><span class="marker">${marker}</span> ${landmarkName(id)}</li>`;
  }).join('');
  $.landmarks.innerHTML = items;

  // Route image + name + description: current landmark detail.
  const lid = state.route[state.currentLandmarkIndex];
  const lm  = LANDMARKS[lid];
  if ($.routeImage) {
    $.routeImage.innerHTML = lm && lm.image ? `<img src="${lm.image}" alt="${lm.name}">` : '';
  }
  if ($.routeName) $.routeName.textContent = lm ? lm.name : '';
  if ($.routeDesc) $.routeDesc.textContent = lm ? (lm.flavor || '') : '';

  renderMinimap(state);
}

// Compute km-level progress and place:
//   - rover dot at its actual fractional position along the route path
//   - landmark dots at their cumulative-km fractions
//   - a solid "trail" over the dashed path for the distance traveled so far
function renderMinimap(state) {
  const pathEl = $.minimapPath;
  if (!pathEl) return;

  // SVG may not have measured yet on first paint — guard.
  let pathLen = 0;
  try { pathLen = pathEl.getTotalLength(); } catch (_) { return; }
  if (!pathLen) return;

  const totalKm    = state.routeKm.reduce((a, b) => a + b, 0);
  const kmBeforeIx = state.routeKm.slice(0, state.currentLandmarkIndex).reduce((a, b) => a + b, 0);
  const segmentKm  = state.currentLandmarkIndex < state.routeKm.length
    ? state.routeKm[state.currentLandmarkIndex] - state.kmToNextLandmark
    : 0;
  const traveled   = kmBeforeIx + segmentKm;
  const fraction   = totalKm > 0 ? Math.min(1, traveled / totalKm) : 0;

  // Rover dot
  const rover = pathEl.getPointAtLength(pathLen * fraction);
  if ($.minimapPos) {
    $.minimapPos.setAttribute('cx', rover.x.toFixed(1));
    $.minimapPos.setAttribute('cy', rover.y.toFixed(1));
  }

  // Trail: solid portion overlaying the dashed base
  if ($.minimapTrail) {
    const visible = pathLen * fraction;
    $.minimapTrail.setAttribute('stroke-dasharray', `${visible.toFixed(1)} ${pathLen.toFixed(1)}`);
  }

  // Landmark dots — positioned at each landmark's cumulative-km fraction.
  // Fill comes from CSS so themes can restyle (see components.css / theme-lcars.css).
  if ($.minimapLands) {
    const n = state.route.length;
    let cumKm = 0;
    const dots = [];
    for (let i = 0; i < n; i++) {
      const f = totalKm > 0 ? cumKm / totalKm : 0;
      const p = pathEl.getPointAtLength(pathLen * Math.min(1, f));
      const isCurrent = i === state.currentLandmarkIndex;
      const isDest    = i === n - 1;
      const visited   = i < state.currentLandmarkIndex;
      const r         = (isCurrent || isDest) ? 3.0 : 2.2;
      const cls       = isCurrent ? 'current'
                      : isDest    ? 'dest'
                      : visited   ? 'visited'
                                  : 'future';
      dots.push(
        `<circle class="landmark-dot ${cls}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}">` +
        `<title>${landmarkName(state.route[i])}</title></circle>`
      );
      if (i < state.routeKm.length) cumKm += state.routeKm[i];
    }
    $.minimapLands.innerHTML = dots.join('');
  }
}

// ---------- Telemetry ----------

function bandFor(value) {
  if (value <= 20) return 'crit';
  if (value <= 40) return 'warn';
  return '';
}

function renderTelemetry(state) {
  const r = state.resources;
  const rows = [];
  for (const key of ['oxygen','water','power','food','panels']) {
    const v = Math.max(0, Math.min(100, Math.round(r[key])));
    const band = bandFor(v);
    rows.push(`
      <li class="readout ${band}">
        <span class="readout-label">${RESOURCE_LABELS[key]}</span>
        <span class="bar"><span class="bar-fill" style="width:${v}%"></span></span>
        <span class="readout-value">${v}%</span>
      </li>
    `);
  }
  // Part inventory (discrete counts)
  rows.push(`
    <li class="readout parts-row">
      <span class="readout-label">CARGO</span>
      <span class="parts-grid">
        <span class="part-pill ${r.mech === 0 ? 'empty' : ''}"><span class="part-lbl">MECH</span><span class="part-n">${r.mech}</span></span>
        <span class="part-pill ${r.eva  === 0 ? 'empty' : ''}"><span class="part-lbl">EVA</span> <span class="part-n">${r.eva}</span></span>
        <span class="part-pill ${r.cell === 0 ? 'empty' : ''}"><span class="part-lbl">CELL</span><span class="part-n">${r.cell}</span></span>
      </span>
    </li>
  `);

  // Weight in pounds. Different parts have different masses (see PART_TYPES).
  // Full cargo hold ≈ CARGO_MAX_LBS = 100% weight.
  let lbs = 0;
  for (const t of PART_TYPES) {
    if (!t.supply) lbs += (r[t.key] || 0) * t.lbs;
  }
  const weightPct  = Math.min(100, Math.round((lbs / CARGO_MAX_LBS) * 100));
  const weightBand = lbs >= CARGO_MAX_LBS * 0.9 ? 'warn' : '';
  const kg = Math.round(lbs * 0.4536);
  rows.push(`
    <li class="readout weight-row ${weightBand}">
      <span class="readout-label">WEIGHT</span>
      <span class="bar"><span class="bar-fill" style="width:${weightPct}%"></span></span>
      <span class="readout-value weight-label">${lbs} LB · ${kg} KG</span>
    </li>
  `);
  $.readouts.innerHTML = rows.join('');
}

// ---------- Crew ----------

function renderCrew(state) {
  const activeDialogue = state.crewDialogue;
  const rows = state.crew.map(c => {
    const hp = Math.max(0, Math.round(c.health));
    const cls = ['crew-row'];
    if (!c.alive) cls.push('dead');
    const hpLabel = c.alive ? `${hp}` : 'KIA';
    const bubble = (activeDialogue && activeDialogue.crewId === c.id)
      ? `<div class="crew-bubble">“${escapeHtml(activeDialogue.text)}”</div>`
      : '';
    return `
      <li class="${cls.join(' ')}" data-status="${c.status}">
        <div class="crew-row-header">
          <span class="crew-name">${c.name}</span>
          <span class="crew-role">${ROLE_CODE[c.role] || c.role.toUpperCase()}</span>
          <span class="crew-hp-text">${hpLabel}</span>
        </div>
        <div class="crew-hp-bar"><div class="crew-hp-fill" style="width:${hp}%"></div></div>
        ${bubble}
      </li>
    `;
  }).join('');
  $.crewList.innerHTML = rows;
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ---------- Pace / Rations controls ----------

const PACE_OPTS    = [['cautious','CAUT'], ['steady','STDY'], ['push','PUSH']];
const RATIONS_OPTS = [['meager','MEAGER'], ['standard','STD'], ['full','FULL']];

function renderSeg(container, options, current) {
  container.innerHTML = options.map(([value, label]) => {
    const active = value === current ? 'active' : '';
    return `<button class="seg-btn ${active}" data-value="${value}" type="button">${label}</button>`;
  }).join('');
}

function renderControls(state) {
  renderSeg($.paceSeg,    PACE_OPTS,    state.pace);
  renderSeg($.rationsSeg, RATIONS_OPTS, state.rations);
}

// ---------- Mission log ----------

function renderLog(state) {
  // Show the most recent 12 entries; latest at bottom.
  const recent = state.log.slice(-12);
  const items = recent.map((entry, i) => {
    const isLatest = i === recent.length - 1;
    const cls = ['log-entry'];
    if (isLatest) cls.push('latest');
    const cursor = isLatest ? ' <span class="cursor">_</span>' : '';
    return `<li class="${cls.join(' ')}"><span class="log-sol">SOL ${entry.sol}</span> ${entry.text}${cursor}</li>`;
  }).join('');
  $.log.innerHTML = items;
  // Auto-scroll log to bottom so newest is visible.
  $.log.scrollTop = $.log.scrollHeight;
}

// ---------- Action bar ----------

function renderActionBar(state) {
  const btn = $.nextSolBtn;
  if (!btn) return;
  if (state.status === 'won') {
    btn.textContent = '✓ MISSION COMPLETE';
    btn.disabled = true;
  } else if (state.status === 'lost') {
    btn.textContent = '✕ MISSION LOST';
    btn.disabled = true;
  } else {
    btn.textContent = 'NEXT SOL →';
    btn.disabled = false;
  }
  // Repair button: enabled only when active, cells available, power < 100
  const repair = $.repairBtn;
  if (repair) {
    const canRepair = state.status === 'active'
                    && state.resources.cell >= 1
                    && state.resources.power < 100;
    repair.disabled = !canRepair;
  }
  // Clean button: enabled only when active, eva available, panels < 100
  const clean = $.cleanBtn;
  if (clean) {
    const canClean = state.status === 'active'
                    && state.resources.eva >= 1
                    && state.resources.panels < 100;
    clean.disabled = !canClean;
  }
}

// ---------- Top-level render ----------

let bound = false;
export function render(state) {
  if (!bound) { bindDom(); bound = true; }
  renderTopbar(state);
  renderRoute(state);
  renderTelemetry(state);
  renderCrew(state);
  renderControls(state);
  renderLog(state);
  renderActionBar(state);
}
