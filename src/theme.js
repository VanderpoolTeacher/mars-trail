// Tractus Martis — theme switcher.
// Pure helpers (THEMES, resolveTheme, STORAGE_KEY) are importable in Node
// for testing. DOM wiring only runs when `document` is defined.

export const STORAGE_KEY = 'marsTrail.theme';

export const THEMES = [
  { id: 'mc',          label: 'Mission Control' },
  { id: 'lcars',       label: 'LCARS / TNG' },
  { id: 'voltron',     label: 'Voltron HUD' },
  { id: 'starfighter', label: 'Last Starfighter' }
];

export function resolveTheme(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return 'mc';
  return THEMES.some(t => t.id === raw) ? raw : 'mc';
}

function load() {
  if (typeof localStorage === 'undefined') return 'mc';
  return resolveTheme(localStorage.getItem(STORAGE_KEY));
}

function save(theme) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, theme);
}

function apply(theme) {
  if (typeof document === 'undefined') return;
  if (theme === 'mc') {
    document.body.removeAttribute('data-theme');
  } else {
    document.body.setAttribute('data-theme', theme);
  }
  const select = document.getElementById('theme-select');
  if (select && select.value !== theme) select.value = theme;
}

function populate(select) {
  select.innerHTML = '';
  for (const t of THEMES) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.label;
    select.appendChild(opt);
  }
}

export function initTheme() {
  if (typeof document === 'undefined') return;
  const current = load();
  const select = document.getElementById('theme-select');
  if (select) {
    populate(select);
    select.value = current;
    select.addEventListener('change', (e) => {
      const next = resolveTheme(e.target.value);
      save(next);
      apply(next);
    });
  }
  apply(current);
}

if (typeof document !== 'undefined') {
  initTheme();
}
