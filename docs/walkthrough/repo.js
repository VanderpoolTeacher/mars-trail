// Single source of truth for GitHub links. package.json has no `repository` field,
// so bake it here. Update BRANCH if main is ever renamed.
export const OWNER = 'VanderpoolTeacher';
export const REPO = 'mars-trail';
export const BRANCH = 'main';

export function githubUrl(path, lineStart, lineEnd) {
  const base = `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/${path}`;
  if (typeof lineStart !== 'number') return base;
  if (typeof lineEnd !== 'number' || lineEnd === lineStart) return `${base}#L${lineStart}`;
  return `${base}#L${lineStart}-L${lineEnd}`;
}
