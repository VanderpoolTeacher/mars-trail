// Mars Trail — modal renderer
// Renders the active modal (event/encounter/end-of-run) into #modal-root.
// On choice, calls onChoose(choiceIdx) which the caller wires to apply outcomes.

import { linkifyCodex } from './codex.js';

const root = () => document.getElementById('modal-root');

export function showEventModal(event, onChoose) {
  const r = root();
  if (!r) return;

  const choicesHtml = event.modal.choices.map((c, i) => {
    const cost = formatCost(c);
    const check = c.skillCheck
      ? `<span class="modal-choice-check">${c.skillCheck.role.toUpperCase()} CHECK · ${Math.round(c.skillCheck.successP * 100)}%</span>`
      : '';
    const cls = ['modal-choice'];
    if (c.primary) cls.push('primary');
    return `
      <button class="${cls.join(' ')}" data-idx="${i}" type="button">
        <span class="modal-choice-label">${escapeHtml(c.label)}</span>
        ${check}
        ${cost ? `<span class="modal-choice-cost">${cost}</span>` : ''}
      </button>
    `;
  }).join('');

  const severity = event.severity || 'event';
  r.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-severity severity-${severity}">${severity}</div>
        <h2 class="modal-title" id="modal-title">${escapeHtml(event.modal.title)}</h2>
        <p class="modal-description">${linkifyCodex(escapeHtml(event.modal.description))}</p>
        <div class="modal-choices">${choicesHtml}</div>
      </div>
    </div>
  `;

  r.querySelectorAll('.modal-choice').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      onChoose(idx);
    });
  });
}

// Outcome modal — shown after picking an event choice so the player
// can clearly see what happened before returning to the dashboard.
export function showOutcomeModal(resolution, onContinue) {
  const r = root();
  if (!r) return;

  const { event, choice, outcome, skillResult, damageTarget } = resolution;

  const skillBlock = skillResult ? `
    <div class="outcome-skill ${skillResult.success ? 'ok' : 'fail'}">
      ${skillResult.role.toUpperCase()} CHECK
      <span class="outcome-skill-result">
        ${skillResult.success ? '✓ SUCCESS' : '✕ FAILED'}
      </span>
      ${!skillResult.specialistAlive
        ? `<span class="outcome-skill-note">(no specialist alive — penalty applied)</span>`
        : ''}
    </div>
  ` : '';

  const deltas = collectDeltas(outcome, damageTarget);
  const deltasHtml = deltas.length
    ? `<ul class="outcome-deltas">${deltas.map(d => `
        <li class="outcome-delta ${d.cls}">
          <span class="outcome-delta-label">${escapeHtml(d.label)}</span>
          <span class="outcome-delta-value">${escapeHtml(d.value)}</span>
        </li>`).join('')}</ul>`
    : `<p class="outcome-empty">No measurable effect.</p>`;

  const factBlock = (outcome && outcome.fact) ? `
    <div class="outcome-fact">
      <div class="outcome-fact-label">⎋ DATA LOGGED · MARS SCIENCE</div>
      <p class="outcome-fact-body">${linkifyCodex(escapeHtml(outcome.fact))}</p>
    </div>` : '';

  r.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-panel outcome-panel" role="dialog" aria-modal="true">
        <div class="modal-severity">RESOLUTION</div>
        <h2 class="modal-title">${escapeHtml(event.modal.title)}</h2>
        <div class="outcome-chose">
          <span class="outcome-chose-label">CHOSE</span>
          <span class="outcome-chose-value">${escapeHtml(choice.label)}</span>
        </div>
        ${skillBlock}
        <div class="outcome-section-label">EFFECTS</div>
        ${deltasHtml}
        ${factBlock}
        <button class="modal-continue" type="button">CONTINUE →</button>
      </div>
    </div>
  `;

  r.querySelector('.modal-continue').addEventListener('click', onContinue);
}

// Title screen — game branding + studio credits.
export function showTitleModal(onStart) {
  const r = root();
  if (!r) return;

  r.innerHTML = `
    <div class="modal-backdrop title-backdrop">
      <div class="title-screen">
        <div class="title-mars-glyph" aria-hidden="true">◉</div>
        <h1 class="title-heading">MARS TRAIL</h1>
        <p class="title-tagline">The colony is waiting. Earth cannot help you from here.</p>
        <button class="title-start" id="title-start" type="button">START MISSION</button>
        <div class="title-credits">
          <span class="title-credit-line">Created by</span>
          <span class="title-studio">Get Good Games and Tech</span>
          <span class="title-ampersand">&amp;</span>
          <span class="title-studio">Infinite Monkeys</span>
        </div>
        <div class="title-version">v0.1 · 2026</div>
      </div>
    </div>
  `;

  r.querySelector('#title-start').addEventListener('click', onStart);
}

// Cargo loadout picker shown before the briefing. Player distributes a
// finite budget across MECH / EVA / CELL. onConfirm(loadout) installs the
// chosen values.
export function showLoadoutModal(initial, budget, partTypes, onConfirm) {
  const r = root();
  if (!r) return;

  // Local, mutable while the user tweaks.
  const picked = { ...initial };

  function used() {
    return partTypes.reduce((sum, t) => sum + picked[t.key], 0);
  }

  function rowHtml(t) {
    return `
      <div class="loadout-row">
        <div class="loadout-row-main">
          <div class="loadout-row-title">${t.label} · ${t.name}</div>
          <div class="loadout-row-desc">${t.desc}</div>
        </div>
        <div class="loadout-stepper">
          <button type="button" class="loadout-step" data-key="${t.key}" data-delta="-1">−</button>
          <span class="loadout-count" id="loadout-count-${t.key}">${picked[t.key]}</span>
          <button type="button" class="loadout-step" data-key="${t.key}" data-delta="+1">+</button>
        </div>
      </div>
    `;
  }

  r.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-panel loadout-panel" role="dialog" aria-modal="true" aria-labelledby="loadout-title">
        <div class="modal-severity severity-landmark">CARGO LOADOUT</div>
        <h2 class="modal-title" id="loadout-title">MOTV Cargo Manifest</h2>
        <p class="modal-description">The <em>Carl Sagan</em> has finite hold space. Distribute <strong>${budget} cargo slots</strong> across supplies and spare parts. More parts means more repair capacity — but heavier cargo drains power faster.</p>

        <div class="loadout-rows">
          ${partTypes.map(rowHtml).join('')}
        </div>

        <div class="loadout-summary">
          <span class="loadout-summary-label">USED</span>
          <span class="loadout-summary-value" id="loadout-used">${used()}</span>
          <span class="loadout-summary-sep">/</span>
          <span class="loadout-summary-max">${budget}</span>
        </div>

        <div class="loadout-actions">
          <button type="button" class="btn-secondary" id="loadout-reset">RESET DEFAULT</button>
          <button type="button" class="modal-continue primary" id="loadout-confirm">STOW &amp; BEGIN →</button>
        </div>
      </div>
    </div>
  `;

  const usedEl = r.querySelector('#loadout-used');
  const confirm = r.querySelector('#loadout-confirm');

  function refresh() {
    partTypes.forEach(t => {
      const el = r.querySelector(`#loadout-count-${t.key}`);
      if (el) el.textContent = picked[t.key];
    });
    const u = used();
    usedEl.textContent = u;
    const over = u > budget;
    usedEl.classList.toggle('over', over);
    confirm.disabled = over;
  }

  r.querySelectorAll('.loadout-step').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const delta = Number(btn.dataset.delta);
      const next = picked[key] + delta;
      if (next < 0) return;
      if (delta > 0 && used() >= budget) return;
      picked[key] = next;
      refresh();
    });
  });

  r.querySelector('#loadout-reset').addEventListener('click', () => {
    partTypes.forEach(t => { picked[t.key] = initial[t.key]; });
    refresh();
  });

  confirm.addEventListener('click', () => onConfirm({ ...picked }));
}

// Mission-briefing modal shown after loadout. Narrative-only with an
// acknowledge button.
export function showBriefingModal(onBegin) {
  const r = root();
  if (!r) return;

  r.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-panel briefing-panel" role="dialog" aria-modal="true" aria-labelledby="briefing-title">
        <div class="modal-severity severity-landmark">MISSION BRIEFING · CLASSIFIED</div>
        <h2 class="modal-title" id="briefing-title">Ares VII · Colonial Vanguard</h2>
        <div class="briefing-meta">
          SOL 001 · JEZERO CRATER · 06:14 LMST<br>
          EARTH TRANSMISSION DELAY: 8:22
        </div>
        <div class="briefing-body">
          <p>Descent successful. MOTV <em>Carl Sagan</em> is nominal on the crater floor, fifty meters forward of the vented descent module.</p>
          <p>${linkifyCodex('Ahead of you: 2,550 kilometers across the Syrtis Major basalts, the hematite plains of Meridiani Planum, the layered sediments of Gale Crater, the quake fields of Elysium Planitia, and up through the Tharsis uplift to the colony foundation site on Olympus Mons.')}</p>
          <div class="briefing-roster">
            <div class="briefing-roster-title">CREW MANIFEST — 6 SOULS</div>
            <div class="briefing-roster-row"><span>ALEX PARK</span>         <span>Chief Engineer</span></div>
            <div class="briefing-roster-row"><span>RIYA NARAYANAN</span>    <span>Astrobiologist</span></div>
            <div class="briefing-roster-row"><span>TOMÁS FERREIRA</span>    <span>Flight Surgeon</span></div>
            <div class="briefing-roster-row"><span>MEI ONAKA</span>         <span>Pilot / Navigation</span></div>
            <div class="briefing-roster-row"><span>SAM VEGA</span>          <span>Mission Security</span></div>
            <div class="briefing-roster-row"><span>JORDAN CRUZ</span>       <span>Mission Security</span></div>
          </div>
          <p>Systems nominal. Eight spare parts. Approximately thirty sols of consumables at standard burn.</p>
          <p class="briefing-stakes">Resupply is not possible. Earth cannot save us from here. We save ourselves.</p>
          <p class="briefing-signoff">Good luck, Commander.<br>— Mission Director, Ares Program</p>
        </div>
        <button class="modal-continue primary" id="briefing-begin" type="button">BEGIN LOADOUT →</button>
      </div>
    </div>
  `;

  r.querySelector('#briefing-begin').addEventListener('click', onBegin);
}

export function closeModal() {
  const r = root();
  if (r) r.innerHTML = '';
}

// ---- helpers ----

const FIELD_LABELS = {
  oxygen:        'O₂',
  water:         'H₂O',
  power:         'PWR',
  food:          'FOOD',
  mech:          'MECH',
  eva:           'EVA',
  cell:          'CELL',
  sciencePoints: 'SCI'
};

function formatCost(choice) {
  // For non-skill choices: list outcome deltas. For skill: show success/fail summary.
  if (choice.skillCheck) {
    const succ = summarize(choice.successOutcome);
    const fail = summarize(choice.failOutcome);
    const parts = [];
    if (succ) parts.push(`win: ${succ}`);
    if (fail) parts.push(`lose: ${fail}`);
    return parts.join(' · ');
  }
  return summarize(choice.outcome);
}

function summarize(outcome) {
  if (!outcome) return '';
  const parts = [];
  for (const key of ['oxygen','water','power','food','mech','eva','cell','sciencePoints']) {
    if (typeof outcome[key] === 'number' && outcome[key] !== 0) {
      const sign = outcome[key] > 0 ? '+' : '';
      parts.push(`${sign}${outcome[key]} ${FIELD_LABELS[key]}`);
    }
  }
  if (typeof outcome.crewHeal === 'number' && outcome.crewHeal > 0) {
    parts.push(`all crew +${outcome.crewHeal} HP`);
  }
  if (outcome.crewDamage) {
    const role = outcome.crewDamage.role ? outcome.crewDamage.role.toUpperCase() : 'crew';
    parts.push(`${role} -${outcome.crewDamage.amount} HP`);
  }
  return parts.join(' · ');
}

// Build a list of deltas for display, with positive/negative coloring.
function collectDeltas(outcome, damageTarget) {
  const out = [];
  if (!outcome) return out;
  const discreteKeys = new Set(['mech','eva','cell','sciencePoints']);
  for (const key of ['oxygen','water','power','food','mech','eva','cell','sciencePoints']) {
    if (typeof outcome[key] === 'number' && outcome[key] !== 0) {
      const v = outcome[key];
      const sign = v > 0 ? '+' : '';
      const unit = discreteKeys.has(key) ? '' : '%';
      out.push({
        label: FIELD_LABELS[key],
        value: `${sign}${v}${unit}`,
        cls: v > 0 ? 'pos' : 'neg'
      });
    }
  }
  if (damageTarget) {
    const valueText = damageTarget.died
      ? `KIA (${damageTarget.amount} HP fatal)`
      : `-${damageTarget.amount} HP`;
    out.push({
      label: `${damageTarget.name} (${damageTarget.role.toUpperCase()})`,
      value: valueText,
      cls: 'neg'
    });
  }
  if (typeof outcome.crewHeal === 'number' && outcome.crewHeal > 0) {
    out.push({
      label: 'All crew',
      value: `+${outcome.crewHeal} HP`,
      cls: 'pos'
    });
  }
  return out;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
