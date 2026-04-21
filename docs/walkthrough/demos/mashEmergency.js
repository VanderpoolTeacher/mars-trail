// Real-module demo: runs the medical-emergency multi-stage chain against
// the real modal renderer AND exercises the real anti-mash click-metrics
// heuristic on each choice. Read carefully → score stays low. Mash the
// buttons → score climbs past the threshold and the demo announces that
// an emergency WOULD have fired in a real run.
//
// NOTE: imports below must stay in sync with src/systems/medicalEmergency.js,
// src/ui/modals.js, and src/systems/clickMetrics.js. If those files move
// or rename exports, update here and the Task 15 smoke test (which asserts
// on REQUIRED_MEDICAL_EXPORTS and REQUIRED_MODAL_EXPORT) will flag the
// break.
//
// Approach: (b) from the plan. showMultiStageModal targets the document
// #modal-root via getElementById. We temporarily rename the walkthrough
// page's real #modal-root, give our scoped stage container that id, let
// the real renderer paint into it, then restore on every stage. The
// chosen callback:
//   1. times elapsed ms and calls recordDecision with the real stage text,
//   2. runs the real resolveMedicalStage to advance the chain,
//   3. re-renders the next stage (or an "end of chain" note) in the scope.
// All state is local to this demo — we never write to real game state.
//
// Seeded state: a sol-5 rover with five alive crew (mirrors the shape in
// sim/medicalEmergency.test.mjs). corpses/firedEvents/log/resources are
// present because resolveMedicalStage reads them during treat/dispose
// outcomes (applyOutcome → resource deltas, addCorpse on 'keep', etc.).
// clickMetrics is local: mashScore, emergenciesFired, and a visible last
// bucket. recordDecision records into THIS state, not the real game's —
// so there's no cross-demo or cross-page bleed.

import {
  beginMedicalEmergency,
  resolveMedicalStage,
  getMedicalStageView,
  MEDICAL_EMERGENCY_ID
} from '../../../src/systems/medicalEmergency.js';
import { showMultiStageModal } from '../../../src/ui/modals.js';
import {
  initialClickMetrics,
  recordDecision,
  shouldFireEmergency,
  CLICK_METRICS_CONFIG
} from '../../../src/systems/clickMetrics.js';

// Exports consumed by the Task 15 smoke test — these names MUST exist on
// the real source modules. If someone renames them, the smoke test fails.
export const REQUIRED_MEDICAL_EXPORTS = [
  'beginMedicalEmergency',
  'resolveMedicalStage',
  'getMedicalStageView',
  'MEDICAL_EMERGENCY_ID'
];
export const REQUIRED_MODAL_EXPORT = 'showMultiStageModal';

// Unique stash id so parallel demos (eventPreview) can't collide on rapid
// branch-hopping. Suffix differs from eventPreview.js's on purpose.
const STASH_ID = 'modal-root--stashed-by-mashEmergency';

function seedState() {
  return {
    status: 'active',
    sol: 5,
    pace: 'steady',
    resources: { oxygen: 80, water: 80, food: 80, power: 80, panels: 100, mech: 4, eva: 4, cell: 3 },
    crew: [
      { id: 'c1', name: 'Alex',  role: 'engineer',  health: 100, status: 'healthy', alive: true },
      { id: 'c2', name: 'Riya',  role: 'biologist', health: 100, status: 'healthy', alive: true },
      { id: 'c3', name: 'Tomas', role: 'medic',     health: 100, status: 'healthy', alive: true },
      { id: 'c4', name: 'Mei',   role: 'pilot',     health: 100, status: 'healthy', alive: true },
      { id: 'c5', name: 'Sam',   role: 'security',  health: 100, status: 'healthy', alive: true }
    ],
    sciencePoints: 0,
    factsLearned: [],
    firedEvents: [],
    corpses: [],
    deathQueue: [],
    log: [],
    activeModal: null,
    careerBonuses: {}
  };
}

function bucketLabel(bucket) {
  if (!bucket) return '(no clicks yet)';
  const pretty = {
    didNotRead: "didn't read",
    skim:       'skim',
    hurried:    'hurried',
    normal:     'normal',
    thoughtful: 'thoughtful'
  };
  return pretty[bucket] || bucket;
}

function renderHud(hud, metrics) {
  const threshold = CLICK_METRICS_CONFIG.mashScoreThreshold;
  const score = metrics.mashScore || 0;
  const fired = shouldFireEmergency(metrics);
  const lastBucket = bucketLabel(metrics.lastBucket);
  const lastElapsed = metrics.lastElapsedMs != null
    ? `${Math.round(metrics.lastElapsedMs)} ms`
    : '—';
  const lastExpected = metrics.lastExpectedMs != null
    ? `${Math.round(metrics.lastExpectedMs)} ms`
    : '—';
  const warn = fired
    ? `<strong style="color:var(--text-danger,#f66)">MASH DETECTED — in a real run, an anti-mash emergency would fire next.</strong>`
    : `<span style="opacity:0.8">mash threshold: ${threshold}</span>`;
  hud.innerHTML = `
    <div style="font-size:0.9em;line-height:1.5">
      <div>last click: <strong>${lastBucket}</strong> · elapsed ${lastElapsed} / expected ${lastExpected}</div>
      <div>mashScore: <strong>${score}</strong> / ${threshold} · ${warn}</div>
    </div>
  `;
}

function renderStage(ctx, stageId) {
  const { state, host, hud, status } = ctx;
  const view = getMedicalStageView(state, stageId, ctx.context);
  if (!view) {
    status.innerHTML = '<em>End of chain — patient resolved.</em>';
    return;
  }

  // Build the synthetic event shape showMultiStageModal expects, same trick
  // main.js uses at src/main.js:233 for the real medical flow.
  const stageEvent = {
    id: MEDICAL_EMERGENCY_ID,
    severity: 'medical',
    stages: { [stageId]: view }
  };

  // Scope-swap #modal-root so the real renderer paints into OUR host.
  const pageRoot = document.getElementById('modal-root');
  const restoreId = pageRoot ? pageRoot.id : null;
  if (pageRoot) pageRoot.id = STASH_ID;

  const prevHostId = host.id;
  host.id = 'modal-root';

  ctx.stageOpenedAt = performance.now();

  try {
    showMultiStageModal(stageEvent, stageId, (choiceIdx) => {
      const elapsed = performance.now() - ctx.stageOpenedAt;
      // Real click-metrics call — same signature main.js uses at line 257.
      ctx.metrics = recordDecision(ctx.metrics, elapsed, view.description);
      renderHud(hud, ctx.metrics);

      // Advance the chain via the real resolver. We mutate a local copy of
      // state — nothing here escapes the demo.
      const opened = {
        ...ctx.state,
        activeModal: {
          type: 'multi_stage',
          payload: {
            event: { id: MEDICAL_EMERGENCY_ID, stages: { diagnose: {}, treat: {}, dispose: {} } },
            stageId,
            source: 'medical',
            context: ctx.context
          }
        }
      };
      const resolved = resolveMedicalStage(opened, choiceIdx);
      ctx.state = { ...resolved, activeModal: null };

      const nextModal = resolved.activeModal;
      if (nextModal && nextModal.type === 'multi_stage' && nextModal.payload?.source === 'medical') {
        renderStage(ctx, nextModal.payload.stageId);
      } else {
        host.innerHTML = `<p style="padding:10px;opacity:0.85"><em>Chain complete.</em> Click <strong>Start emergency</strong> to run another.</p>`;
        status.innerHTML = '';
      }
    });
  } catch (err) {
    console.warn('mashEmergency: showMultiStageModal threw', err);
    host.innerHTML = `<p style="color:var(--text-danger,#f66)">Failed to render stage: ${String(err && err.message || err)}</p>`;
  } finally {
    host.id = prevHostId;
    if (pageRoot) pageRoot.id = restoreId;
  }
}

function startEmergency(ctx) {
  // Fresh state + fresh metrics on every "Start emergency" click so the
  // reader can experiment with different mash cadences from a clean slate.
  ctx.state = seedState();
  ctx.metrics = initialClickMetrics();
  renderHud(ctx.hud, ctx.metrics);

  // Use the real pickPatient + pickAilment path inside beginMedicalEmergency,
  // then pull the context back out for our stage loop.
  const opened = beginMedicalEmergency(ctx.state);
  const modal = opened.activeModal;
  if (!modal || modal.type !== 'multi_stage' || modal.payload?.source !== 'medical') {
    ctx.status.innerHTML = '<em>Could not begin emergency (no alive crew?).</em>';
    return;
  }
  ctx.state = opened;
  ctx.context = modal.payload.context;
  ctx.status.innerHTML = '';
  renderStage(ctx, modal.payload.stageId);
}

function missingExports() {
  const missing = [];
  if (typeof beginMedicalEmergency !== 'function') missing.push('beginMedicalEmergency');
  if (typeof resolveMedicalStage   !== 'function') missing.push('resolveMedicalStage');
  if (typeof getMedicalStageView   !== 'function') missing.push('getMedicalStageView');
  if (typeof MEDICAL_EMERGENCY_ID  !== 'string')   missing.push('MEDICAL_EMERGENCY_ID');
  if (typeof showMultiStageModal   !== 'function') missing.push('showMultiStageModal');
  if (typeof recordDecision        !== 'function') missing.push('recordDecision');
  if (typeof initialClickMetrics   !== 'function') missing.push('initialClickMetrics');
  return missing;
}

export function init(mount) {
  try {
    const missing = missingExports();
    if (missing.length) {
      console.warn('mashEmergency: missing required exports', missing);
      mount.innerHTML = `
        <p style="color:var(--text-danger,#f66)">
          Demo unavailable — required exports missing: ${missing.map(m => `<code>${m}</code>`).join(', ')}.
        </p>`;
      return () => {};
    }

    mount.innerHTML = `
      <div class="mash-emergency-demo" style="margin-top:12px">
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px;flex-wrap:wrap">
          <button type="button" id="mash-start" class="btn-primary">Start emergency</button>
          <span id="mash-status" style="opacity:0.8;font-size:0.9em"></span>
        </div>
        <div id="mash-hud" style="margin-bottom:10px;padding:8px 10px;border:1px solid var(--border,#444);border-radius:4px;background:var(--bg-panel,#1a1a1a)"></div>
        <div id="mash-host"></div>
        <p style="margin-top:10px;font-size:0.85em;opacity:0.75">
          Every click is timed against expected read time (minimum ${CLICK_METRICS_CONFIG.minReadMs} ms).
          Mash the buttons fast to see <code>mashScore</code> climb past ${CLICK_METRICS_CONFIG.mashScoreThreshold};
          read carefully to keep it at 0.
        </p>
      </div>
    `;

    const ctx = {
      state: seedState(),
      metrics: initialClickMetrics(),
      context: null,
      stageOpenedAt: 0,
      host:   mount.querySelector('#mash-host'),
      hud:    mount.querySelector('#mash-hud'),
      status: mount.querySelector('#mash-status')
    };

    renderHud(ctx.hud, ctx.metrics);
    ctx.host.innerHTML = '<p style="opacity:0.8;padding:10px"><em>Click <strong>Start emergency</strong> to begin.</em></p>';

    mount.querySelector('#mash-start').addEventListener('click', () => startEmergency(ctx));
  } catch (err) {
    console.warn('mashEmergency init failed:', err);
    try {
      mount.innerHTML = `<p style="color:var(--text-danger,#f66)">Mash emergency demo unavailable: ${String(err && err.message || err)}</p>`;
    } catch { /* nothing more we can do */ }
  }
  return () => {};
}
