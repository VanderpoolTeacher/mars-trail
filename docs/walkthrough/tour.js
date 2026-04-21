import { spine } from './slides.js';
import { parseHash, hashFor, routeForward, routeBack, routeToSlide } from './router.js';
import { THEMES, resolveTheme } from '../../src/theme.js';
import { githubUrl } from './repo.js';

const demoLoaders = {
  loop:          () => import('./demos/loop.js'),
  eventPreview:  () => import('./demos/eventPreview.js'),     // wired in Task 11
  mashEmergency: () => import('./demos/mashEmergency.js'),    // wired in Task 12
};

let currentDemoCleanup = null;
let demoMountEpoch = 0;

async function mountDemo(slide) {
  if (currentDemoCleanup) { currentDemoCleanup(); currentDemoCleanup = null; }
  if (!slide.demo) return;
  const loader = demoLoaders[slide.demo];
  if (!loader) return;
  const myEpoch = ++demoMountEpoch;
  let mod;
  try {
    mod = await loader();
  } catch (err) {
    console.warn(`Demo "${slide.demo}" failed to load:`, err);
    return;
  }
  if (myEpoch !== demoMountEpoch) return;
  const mount = document.getElementById(`demo-${slide.demo}-mount`);
  if (!mount || typeof mod.init !== 'function') return;
  let cleanup;
  try {
    cleanup = mod.init(mount);
  } catch (err) {
    console.warn(`Demo "${slide.demo}" init failed:`, err);
    return;
  }
  if (typeof cleanup === 'function') currentDemoCleanup = cleanup;
}

const slides = { spine };
let current = routeToSlide(parseHash(window.location.hash), slides);

function slideAt(location) {
  if (location.kind === 'spine') return slides.spine[location.index];
  const hub = slides.spine.find(s => s.id === 'hub');
  const branch = hub.branches.find(b => b.id === location.branchId);
  return branch.sub[location.subIndex];
}

function renderProgress(location) {
  const el = document.getElementById('tour-progress');
  if (!el) return;
  if (location.kind === 'spine') {
    el.textContent = `SPINE ${location.index + 1} / ${slides.spine.length}`;
  } else {
    el.textContent = `HUB › ${location.branchId} › ${location.subIndex + 1}`;
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderSnippet(snippet) {
  const [a, b] = snippet.lines || [];
  const label = `${snippet.path}${a ? ` : ${a}${b && b !== a ? `–${b}` : ''}` : ''}`;
  const url = githubUrl(snippet.path, a, b);
  return `
    <div class="tour-snippet" data-snippet>
      <div class="tour-snippet-header" data-snippet-toggle>
        <span class="tour-snippet-label">${escapeHtml(label)}${snippet.caption ? ` — ${escapeHtml(snippet.caption)}` : ''}</span>
        <span class="tour-snippet-links">
          <a href="${url}" target="_blank" rel="noopener">View on GitHub ↗</a>
          <span class="tour-snippet-chevron">▾</span>
        </span>
      </div>
      <div class="tour-snippet-body">
        <pre><code>${escapeHtml(snippet.code)}</code></pre>
      </div>
    </div>
  `;
}

function renderHubTiles(branches) {
  return `
    <div class="hub-tiles" role="navigation" aria-label="Systems">
      ${branches.map((b, i) => `
        <button class="hub-tile" data-branch-id="${escapeHtml(b.id)}" type="button">
          <span class="hub-tile-key">${i + 1}</span>${escapeHtml(b.label)}
        </button>
      `).join('')}
    </div>
  `;
}

function renderBreadcrumb(location) {
  if (location.kind !== 'branch') return '';
  const hub = slides.spine.find(s => s.id === 'hub');
  const branch = hub.branches.find(b => b.id === location.branchId);
  const total = branch ? branch.sub.length : 1;
  return `<div class="tour-breadcrumb">HUB › ${escapeHtml(location.branchId)} › ${location.subIndex + 1} / ${total}</div>`;
}

function renderSlideHtml(slide, location) {
  const snippetsHtml = slide.snippets?.length
    ? `<div class="tour-snippets">${slide.snippets.map(renderSnippet).join('')}</div>`
    : '';
  const hubTilesHtml = (location.kind === 'spine' && slide.id === 'hub')
    ? renderHubTiles(slide.branches)
    : '';
  const breadcrumbHtml = renderBreadcrumb(location);
  return `
    <section class="tour-slide">
      ${breadcrumbHtml}
      <h1>${slide.title}</h1>
      ${slide.body}
      ${hubTilesHtml}
      ${snippetsHtml}
    </section>
  `;
}

function wireSnippetToggles(stage) {
  for (const header of stage.querySelectorAll('[data-snippet-toggle]')) {
    header.addEventListener('click', () => header.parentElement.classList.toggle('is-open'));
  }
}

function wireHubTiles(stage) {
  for (const tile of stage.querySelectorAll('.hub-tile')) {
    tile.addEventListener('click', () => {
      go({ kind: 'branch', branchId: tile.dataset.branchId, subIndex: 0 });
    });
  }
}

// Renders a slide into #tour-stage.
// TRUST BOUNDARY: slide.title, slide.body, slide.snippets[i].path, and
// slide.snippets[i].caption are interpolated as HTML. The slide manifest
// (slides.js, authored in-repo) is trusted. Snippet code is escaped via
// escapeHtml because it contains literal source with '<', '&', etc.
// Do not route any user-supplied content through this function.
function render(location) {
  const slide = slideAt(location);
  const stage = document.getElementById('tour-stage');
  stage.innerHTML = renderSlideHtml(slide, location);
  wireSnippetToggles(stage);
  wireHubTiles(stage);
  renderProgress(location);
  mountDemo(slide);
}

function go(nextLocation) {
  current = nextLocation;
  const hash = hashFor(nextLocation);
  if (window.location.hash !== hash) {
    window.history.pushState(null, '', hash);
  }
  render(current);
}

function onKey(e) {
  if (e.key === 'ArrowRight')      return go(routeForward(current, slides));
  if (e.key === 'ArrowLeft')       return go(routeBack(current, slides));
  if (e.key === 'Home')            return go({ kind: 'spine', index: 0 });
  if (e.key === 'End')             return go({ kind: 'spine', index: slides.spine.length - 1 });
  if (e.key === 'Escape' && current.kind === 'branch') {
    const hubIdx = slides.spine.findIndex(s => s.id === 'hub');
    return go({ kind: 'spine', index: hubIdx });
  }
  // Digit 1–9 on hub → open corresponding branch.
  if (current.kind === 'spine' && slideAt(current).id === 'hub' && /^[1-9]$/.test(e.key)) {
    const hub = slides.spine.find(s => s.id === 'hub');
    const idx = Number(e.key) - 1;
    if (idx < hub.branches.length) {
      return go({ kind: 'branch', branchId: hub.branches[idx].id, subIndex: 0 });
    }
  }
}

document.addEventListener('keydown', onKey);
document.getElementById('tour-next').addEventListener('click', () => go(routeForward(current, slides)));
document.getElementById('tour-prev').addEventListener('click', () => go(routeBack(current, slides)));
window.addEventListener('hashchange', () => {
  current = routeToSlide(parseHash(window.location.hash), slides);
  render(current);
});

function initTourTheme() {
  // Uses a distinct id ('tour-theme-select') so src/theme.js's module-top initTheme()
  // — which getElementById('theme-select')s and binds a localStorage-writing change
  // listener — doesn't attach to the tour dropdown. Tour theme is session-only.
  const select = document.getElementById('tour-theme-select');
  if (!select) return;
  select.innerHTML = '';
  for (const t of THEMES) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.label;
    select.appendChild(opt);
  }
  const applyTheme = (raw) => {
    const theme = resolveTheme(raw);
    if (theme === 'mc') document.body.removeAttribute('data-theme');
    else document.body.setAttribute('data-theme', theme);
    select.value = theme;
  };
  applyTheme('mc'); // slideshow always starts in mc; tour does NOT read localStorage
  select.addEventListener('change', (e) => applyTheme(e.target.value));
}

initTourTheme();

render(current);
