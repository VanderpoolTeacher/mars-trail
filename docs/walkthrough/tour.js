import { spine } from './slides.js';
import { parseHash, hashFor, routeForward, routeBack, routeToSlide } from './router.js';
import { THEMES, resolveTheme } from '../../src/theme.js';

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

function render(location) {
  const slide = slideAt(location);
  document.getElementById('tour-stage').innerHTML = `
    <section class="tour-slide">
      <h1>${slide.title}</h1>
      ${slide.body}
    </section>
  `;
  renderProgress(location);
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
  if (e.key === 'ArrowRight')      go(routeForward(current, slides));
  else if (e.key === 'ArrowLeft')  go(routeBack(current, slides));
  else if (e.key === 'Home')       go({ kind: 'spine', index: 0 });
  else if (e.key === 'End')        go({ kind: 'spine', index: slides.spine.length - 1 });
}

document.addEventListener('keydown', onKey);
document.getElementById('tour-next').addEventListener('click', () => go(routeForward(current, slides)));
document.getElementById('tour-prev').addEventListener('click', () => go(routeBack(current, slides)));
window.addEventListener('hashchange', () => {
  current = routeToSlide(parseHash(window.location.hash), slides);
  render(current);
});

function initTourTheme() {
  const select = document.getElementById('theme-select');
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
