// Mars Trail — modal renderer
// Renders the active modal (event/encounter/end-of-run) into #modal-root.
// On choice, calls onChoose(choiceIdx) which the caller wires to apply outcomes.

const root = () => document.getElementById('modal-root');

export function showEventModal(event, onChoose) {
  const r = root();
  if (!r) return;

  const choicesHtml = event.modal.choices.map((c, i) => {
    const cost = formatCost(c);
    const check = c.skillCheck
      ? `<span class="modal-choice-check">${c.skillCheck.role.toUpperCase()} CHECK · ${Math.round(c.skillCheck.successP * 100)}%</span>`
      : '';
    return `
      <button class="modal-choice" data-idx="${i}" type="button">
        <span class="modal-choice-label">${escapeHtml(c.label)}</span>
        ${check}
        ${cost ? `<span class="modal-choice-cost">${cost}</span>` : ''}
      </button>
    `;
  }).join('');

  r.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-severity">${event.severity || 'event'}</div>
        <h2 class="modal-title" id="modal-title">${escapeHtml(event.modal.title)}</h2>
        <p class="modal-description">${escapeHtml(event.modal.description)}</p>
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
        <button class="modal-continue" type="button">CONTINUE →</button>
      </div>
    </div>
  `;

  r.querySelector('.modal-continue').addEventListener('click', onContinue);
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
  parts:         'PARTS',
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
  for (const key of ['oxygen','water','power','food','parts','sciencePoints']) {
    if (typeof outcome[key] === 'number' && outcome[key] !== 0) {
      const sign = outcome[key] > 0 ? '+' : '';
      parts.push(`${sign}${outcome[key]} ${FIELD_LABELS[key]}`);
    }
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
  for (const key of ['oxygen','water','power','food','parts','sciencePoints']) {
    if (typeof outcome[key] === 'number' && outcome[key] !== 0) {
      const v = outcome[key];
      const sign = v > 0 ? '+' : '';
      const unit = (key === 'parts' || key === 'sciencePoints') ? '' : '%';
      out.push({
        label: FIELD_LABELS[key],
        value: `${sign}${v}${unit}`,
        cls: v > 0 ? 'pos' : 'neg'
      });
    }
  }
  if (damageTarget) {
    out.push({
      label: `${damageTarget.name} (${damageTarget.role.toUpperCase()})`,
      value: `-${damageTarget.amount} HP`,
      cls: 'neg'
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
