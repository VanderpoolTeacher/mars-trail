// Explanatory animation of the game loop. No real-module imports —
// this one is a visualization, not a behavior proof.
//
// Exports init(mount) which renders a 4-step cycle: Input → Systems → Render → Log.

const PHASES = ['INPUT', 'SYSTEMS', 'RENDER', 'LOG'];

export function init(mount) {
  mount.innerHTML = `
    <div class="loop-demo" style="margin-top:16px;padding:14px;border:1px solid var(--panel-border,#0a8);border-radius:4px">
      <div style="display:flex;gap:10px;justify-content:center;align-items:center">
        ${PHASES.map((p, i) => `
          <div class="loop-phase" data-phase-index="${i}" style="padding:10px 14px;border:1px solid var(--panel-border,#0a8);border-radius:4px;min-width:80px;text-align:center;font-family:ui-monospace,monospace;transition:all 0.2s">${p}</div>
          ${i < PHASES.length - 1 ? '<span style="opacity:0.6">→</span>' : ''}
        `).join('')}
      </div>
      <div style="text-align:center;margin-top:12px;font-size:0.85em;opacity:0.8" id="loop-caption">Each sol runs through these four phases, in order.</div>
    </div>
  `;
  const phases = mount.querySelectorAll('.loop-phase');
  let active = 0;
  const tick = () => {
    phases.forEach((p, i) => {
      p.style.background = i === active ? 'var(--panel-header-bg, rgba(0,170,136,0.3))' : 'transparent';
      p.style.fontWeight = i === active ? '700' : '400';
    });
    active = (active + 1) % phases.length;
  };
  tick();
  const id = setInterval(tick, 700);
  return () => clearInterval(id); // cleanup on teardown
}
