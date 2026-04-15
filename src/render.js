// Mars Trail — DOM rendering
// Each renderer is idempotent: pass current state, DOM reflects it.

import { landmarkName, ROLE_CODE, RESOURCE_LABELS } from './state.js';

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
  $.nextSolBtn   = document.getElementById('next-sol-btn');
}

// ---------- Topbar ----------

function renderTopbar(state) {
  // Stylized "Mars Local Mean Solar Time" derived from sol number.
  const hours   = String((state.sol * 7) % 24).padStart(2, '0');
  const minutes = String((state.sol * 11) % 60).padStart(2, '0');
  $.clock.textContent = `SOL ${state.sol} · ${hours}:${minutes} LMST`;
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

  // Reposition the mini-map "you are here" marker along the route.
  // Route svg viewBox is 0 0 200 100. We have hard-coded landmark x,y in HTML.
  // Use currentLandmarkIndex normalized to [0, n-1] as a fraction along x=20..185.
  const n = state.route.length;
  const fraction = state.currentLandmarkIndex / Math.max(1, n - 1);
  const cx = 20 + fraction * (185 - 20);
  // Approximate y by lerping the same path's bow (decorative only).
  const cy = 70 - fraction * 40;
  if ($.minimapPos) {
    $.minimapPos.setAttribute('cx', cx.toFixed(1));
    $.minimapPos.setAttribute('cy', cy.toFixed(1));
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
  for (const key of ['oxygen','water','power','food']) {
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
  rows.push(`
    <li class="readout discrete">
      <span class="readout-label">PARTS</span>
      <span class="readout-value pad">${r.spareParts}</span>
    </li>
  `);
  $.readouts.innerHTML = rows.join('');
}

// ---------- Crew ----------

function statusGlyph(s) {
  switch (s) {
    case 'healthy':  return '●';
    case 'injured':  return '◐';
    case 'sick':     return '◐';
    case 'critical': return '○';
    case 'dead':     return '✕';
    default:         return '·';
  }
}

function renderCrew(state) {
  const rows = state.crew.map(c => {
    const cls = ['crew-row'];
    if (!c.alive) cls.push('dead');
    return `
      <li class="${cls.join(' ')}">
        <span class="crew-name">${c.name}</span>
        <span class="crew-role">${ROLE_CODE[c.role] || c.role.toUpperCase()}</span>
        <span class="crew-status ${c.status}" title="${c.status}">${statusGlyph(c.status)}</span>
      </li>
    `;
  }).join('');
  $.crewList.innerHTML = rows;
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
