// Pure routing helpers for the code tour. No DOM, no side effects.
//
// A "location" is one of:
//   { kind: 'spine',  index: number }              -- position on the spine
//   { kind: 'branch', branchId: string, subIndex: number } -- inside a hub branch

const SLIDE_HASH = /^#slide-(\d+)$/;
const BRANCH_HASH = /^#branch-([a-zA-Z0-9_-]+)-(\d+)$/;

// Sanity cap for parseHash: any spine index at or above this is treated as
// invalid and clamped to 0 (protects against garbage / stale deep links like
// `#slide-999`). The real manifest length is enforced later by routeToSlide.
const MAX_SPINE_INDEX = 100;

export function parseHash(hash) {
  if (!hash || hash === '#') return { kind: 'spine', index: 0 };
  const m1 = SLIDE_HASH.exec(hash);
  if (m1) {
    const idx = Number(m1[1]);
    if (idx < 0 || !Number.isFinite(idx) || idx >= MAX_SPINE_INDEX) {
      return { kind: 'spine', index: 0 };
    }
    return { kind: 'spine', index: idx };
  }
  const m2 = BRANCH_HASH.exec(hash);
  if (m2) return { kind: 'branch', branchId: m2[1], subIndex: Number(m2[2]) };
  return { kind: 'spine', index: 0 };
}

export function hashFor(location) {
  if (location.kind === 'spine') return `#slide-${location.index}`;
  return `#branch-${location.branchId}-${location.subIndex}`;
}

function hubIndex(slides) {
  return slides.spine.findIndex(s => s.id === 'hub');
}

function findBranch(slides, branchId) {
  const hub = slides.spine.find(s => s.id === 'hub');
  if (!hub || !hub.branches) return null;
  return hub.branches.find(b => b.id === branchId) || null;
}

export function routeForward(location, slides) {
  if (location.kind === 'spine') {
    const next = location.index + 1;
    if (next >= slides.spine.length) return location;
    return { kind: 'spine', index: next };
  }
  // kind === 'branch'
  const branch = findBranch(slides, location.branchId);
  if (!branch) return { kind: 'spine', index: hubIndex(slides) };
  if (location.subIndex + 1 < branch.sub.length) {
    return { kind: 'branch', branchId: location.branchId, subIndex: location.subIndex + 1 };
  }
  return { kind: 'spine', index: hubIndex(slides) };
}

export function routeBack(location, slides) {
  if (location.kind === 'spine') {
    if (location.index === 0) return location;
    return { kind: 'spine', index: location.index - 1 };
  }
  // kind === 'branch'
  if (location.subIndex === 0) return { kind: 'spine', index: hubIndex(slides) };
  return { kind: 'branch', branchId: location.branchId, subIndex: location.subIndex - 1 };
}

// Validate a parsed hash against a concrete slides manifest.
// Returns a valid location. Out-of-range hashes fall back to spine 0.
export function routeToSlide(location, slides) {
  if (location.kind === 'spine') {
    if (location.index < 0 || location.index >= slides.spine.length) {
      return { kind: 'spine', index: 0 };
    }
    return location;
  }
  const branch = findBranch(slides, location.branchId);
  if (!branch) return { kind: 'spine', index: 0 };
  if (location.subIndex < 0 || location.subIndex >= branch.sub.length) {
    return { kind: 'branch', branchId: location.branchId, subIndex: 0 };
  }
  return location;
}
