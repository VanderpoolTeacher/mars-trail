# Code-Tour Glossary — Design

**Date:** 2026-04-21
**Status:** Draft — pending user review
**Related issue:** #67
**Parent feature:** #65 (code-tour slideshow, PR #66 — not yet merged)

## Problem

The code tour's prose targets programmer-literate readers, but terms like *ES modules*, *pure function*, *single source of truth*, *dispatch*, *factory function*, *CSS variables*, *heuristic*, and *multi-stage event* assume familiarity that entry-level devs don't have. Breaking to Google every third paragraph kills the tour's pacing.

## Goal

Let a reader click any marked term in a slide and see a 1–3-sentence, plain-language definition inline, without navigating away. Multiple definitions can stay open. The feature should feel native to the tour — theme-aware, touch-friendly, keyboard-accessible.

## Scope

**In:**

- New `docs/walkthrough/glossary.js` — trusted in-repo definitions file.
- ~20 curated term definitions covering the tour's current prose.
- Markup of terms in existing slide bodies (`<span class="term" data-term="slug">display</span>`).
- `wireGlossaryTerms(stage)` helper in `tour.js`, invoked from `render()` alongside the existing wire helpers.
- `.term` / `.term-def` styling in `tour.css` using `currentColor` and existing CSS vars — repaints under all four themes.
- Accessibility: `.term` is a real `<button>` with `aria-expanded` + `aria-controls`; keyboard Enter/Space toggles.
- Smoke-test extension asserting `GLOSSARY` imports and entries have non-empty `term` + `def` strings.

**Out:**

- Hover tooltips (click only — touch-friendly).
- Cross-linking definitions to each other.
- A standalone glossary index page.
- Auto-scanning prose to flag undefined terms.
- Editing tool UI.

## Architecture

**New files:**

- `docs/walkthrough/glossary.js` — exports `const GLOSSARY` object keyed by kebab-case slug:
  ```js
  export const GLOSSARY = {
    'es-modules': {
      term: 'ES modules',
      def: '<p>…plain-language definition as trusted HTML…</p>',
    },
    // ...
  };
  ```

**Modified files:**

- `docs/walkthrough/tour.js` — import `GLOSSARY`; add `wireGlossaryTerms(stage)`; call it from `render()`.
- `docs/walkthrough/tour.css` — append `.term` / `.term-def` styles.
- `docs/walkthrough/slides.js` — mark up ~20 term occurrences inline with `<span class="term" data-term="…">…</span>`.
- `sim/walkthroughSmoke.test.mjs` — add a `glossary` test block asserting each entry has non-empty `term` + `def`.

**Untouched:** game source, other game stylesheets, the slide *structure* (spine / hub / branches).

## Interaction

- Rendered term: `<button type="button" class="term" data-term="<slug>" aria-expanded="false" aria-controls="term-def-<slug>-<n>">display text</button>`. `<n>` is a per-render counter to allow multiple instances.
- On click:
  - Look up `GLOSSARY[slug]`. If missing → `console.warn('Unknown term:', slug)` and return.
  - If a sibling `.term-def` with matching id already exists, remove it, set `aria-expanded="false"`.
  - Else, insert a `<div class="term-def" id="term-def-<slug>-<n>" role="region">…def HTML…</div>` immediately after the button, set `aria-expanded="true"`.
- Keyboard: button type gives Enter/Space for free.
- Render lifecycle: slides re-render on navigation; all term state is tied to DOM, so closed on navigate — that's desired (each slide starts clean).

## Styling

```css
.term {
  background: none;
  border: 0;
  padding: 0;
  font: inherit;
  color: currentColor;
  cursor: pointer;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
}
.term:hover, .term:focus-visible { opacity: 0.75; outline: none; }
.term[aria-expanded="true"] { font-weight: 600; }

.term-def {
  margin: 6px 0 10px 14px;
  padding: 8px 12px;
  border-left: 3px solid var(--panel-border, currentColor);
  opacity: 0.9;
  font-size: 0.95em;
}
.term-def p:first-child { margin-top: 0; }
.term-def p:last-child  { margin-bottom: 0; }
```

## Trust boundary

`GLOSSARY[*].def` is trusted HTML, interpolated via `innerHTML` — identical boundary to slide bodies. Document this at the top of `glossary.js` and in the `wireGlossaryTerms` JSDoc.

## Initial term set

Seeded from what appears in the current tour prose. Slugs below; definitions written at implementation time:

| Slug | Term |
|---|---|
| `es-modules` | ES modules |
| `dom` | DOM |
| `pure-function` | pure function |
| `single-source-of-truth` | single source of truth |
| `virtual-dom` | virtual DOM |
| `reactive-framework` | reactive framework |
| `css-variable` | CSS variable |
| `hash-routing` | hash-based routing |
| `factory-function` | factory function |
| `dispatch` | dispatch |
| `local-storage` | localStorage |
| `dynamic-import` | dynamic import |
| `try-finally` | try/finally |
| `heuristic` | heuristic |
| `multi-stage-event` | multi-stage event |
| `sol` | sol |
| `eva` | EVA |
| `lmst` | LMST |
| `waypoint` | waypoint |
| `anti-mashing` | anti-mashing |

Authoring rule: each definition is 1–3 sentences. First sentence is the concept; second (optional) is how this project uses it; third (optional) is an analogy or pointer.

## Testing

- `sim/walkthroughSmoke.test.mjs` — add a test that imports `GLOSSARY` and asserts: (a) non-empty object, (b) every entry has a non-empty `term` string and non-empty `def` string, (c) every slug is kebab-case (lowercase + digits + hyphens).
- Manual: click terms across slides under each theme, confirm definitions repaint; confirm keyboard Enter/Space; confirm second click closes; confirm multiple open simultaneously; confirm an unknown `data-term` logs a warning without crashing.

## Workflow

Ships as additional commits on `feature/code-tour`, referencing #67 in commit messages. PR #66 accrues the additional scope before merge.

## Open questions

None blocking. If the term list grows beyond ~25, consider splitting `glossary.js` into per-category files — not needed at the initial scope.
