# Responsive Layout — Eliminate Window Scrollbars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On desktop/tablet, cap the page to the viewport so the window itself never scrolls; content overflow scrolls inside the panel that produced it. Mobile (≤ 720px) keeps its existing stacked-column natural page scroll.

**Architecture:** Add a `@media (min-width: 721px)` rule in `styles/layout.css` that pins `html, body` to `100dvh` with `overflow: hidden`. The existing `body { display: flex; flex-direction: column }` + `.dashboard { flex: 1; min-height: 0 }` already make the dashboard fill the remaining space — it just had no outer cap. Add `overflow-y: auto` to the two panels that can grow unbounded (`.panel-telemetry`, `.panel-crew`); `.panel-route` and `.panel-log .log` already have internal scroll. Theme background overlays (`.scanlines`, `body[data-theme="voltron"]::before`, etc.) all use `position: fixed; inset: 0`, so they're unaffected by `overflow: hidden`. Modals also use `position: fixed`, also unaffected.

**Tech Stack:** CSS-only change. No JS, no build step, no new tests.

**Closes:** #56

---

## File Structure

**Modify:**
- `styles/layout.css` — add viewport-cap media query + per-panel overflow rules

**No changes:**
- `styles/theme.css`, `styles/components.css`, `styles/modals.css` — all overlay/modal positioning is already `position: fixed`, so nothing needed
- `styles/theme-lcars.css`, `styles/theme-voltron.css`, `styles/theme-starfighter.css` — no body-level layout in any of them
- `index.html`, `src/**` — not involved

---

## Task 0: Branch setup

**Files:** none

- [x] **Step 1: Branch already exists** — `feat/responsive-layout` was created off `main` at SHA `a2be625` (v0.9.0). Confirm before starting:

```bash
git status
git log --oneline -1
```
Expected: on `feat/responsive-layout`, latest commit is `a2be625 v0.9.0: theme dropdown + Last Starfighter skin`.

---

## Task 1: Viewport cap + panel overflow

**Goal:** One edit to `layout.css` that (a) caps html/body to the viewport on desktop and (b) lets the two uncontained panels scroll internally.

**Files:**
- Modify: `styles/layout.css`

- [ ] **Step 1: Open `styles/layout.css` and find the mobile media-query block**

The file currently contains two separate `@media (max-width: 720px)` blocks — one for dashboard/topbar padding near line 91, and one for the dashboard column-stack near line 149. The new rules belong at the end of the file, after the existing stack rule, so related media queries stay grouped and the cascade is unambiguous.

- [ ] **Step 2: Append the viewport cap + panel overflow rules**

Append to the END of `styles/layout.css`:

```css

/* ---------- Viewport containment (issue #56) ----------
   Desktop/tablet: pin the page to the viewport so content overflow
   scrolls inside individual panels instead of pushing the window.
   Mobile (≤ 720px) keeps natural page scroll — the stacked layout
   can't fit in a phone viewport without shrinking text.

   Uses `100dvh` so mobile browsers' dynamic viewport (address-bar
   collapse) doesn't cause a layout jump; all target browsers support
   it. `overflow: hidden` on html AND body prevents either one from
   producing a scrollbar on the window. */
@media (min-width: 721px) {
  html, body {
    height: 100dvh;
    min-height: 0;
    overflow: hidden;
  }
}

/* Panels that can outgrow their grid cell: contain overflow internally.
   `.panel-route` and `.panel-log .log` already have their own scroll
   containers — this covers the remaining two. */
.panel-telemetry,
.panel-crew {
  overflow-y: auto;
}
```

- [ ] **Step 3: Run the test suite as a sanity check**

Run: `node --test sim/*.test.mjs`
Expected: all pass (this is a CSS-only change; there is no CSS test coverage in this repo — the check is just that nothing got broken by accident).

- [ ] **Step 4: Commit**

```bash
git add styles/layout.css
git commit -m "Layout: cap viewport on desktop so panels scroll internally (closes #56)"
```

---

## Task 2: Visual verification at dev server

**Goal:** Confirm no window scrollbar at desktop widths, panels scroll their own overflow, and mobile still stacks cleanly with page scroll.

**Files:** none

- [ ] **Step 1: Start the dev server**

```bash
python3 -m http.server 8080
```

- [ ] **Step 2: Desktop check (≥ 1280px)**

Open http://localhost:8080. Verify:
- No vertical scrollbar on the browser window itself.
- Topbar + dashboard exactly fill the viewport.
- If you make the window short (resize to ~700px tall), panel-telemetry or panel-crew should show an internal scrollbar instead of the window getting one.
- All four themes check out: flip through the dropdown — Mission Control, LCARS / TNG, Voltron HUD, Last Starfighter. Each should still fill the viewport with no window scroll and no leaked colors.
- Scanline overlay (MC theme) and Voltron's diagonal guide lines still cover the full viewport.

- [ ] **Step 3: Trigger an event modal**

Click NEXT SOL a few times to fire a random event. Verify:
- Modal centers on screen as before.
- Modal backdrop covers the full viewport (it's `position: fixed; inset: 0` — should be unaffected).
- Dismissing the modal returns to the normal view with no window scroll.

- [ ] **Step 4: Mobile check (≤ 720px)**

Resize the browser to ~400px wide (or use devtools responsive mode). Verify:
- Panels stack vertically (existing behavior — unchanged).
- Window page-scroll works normally — you can scroll from route to telemetry to crew to log.
- No weird double-scrollbar situation (window scrolls, panels don't try to scroll their own content at this size).

- [ ] **Step 5: Stop the dev server**

Kill the background process or `Ctrl+C` the foreground one.

No commit in this task — it's purely verification.

---

## Task 3: Push and open PR

**Goal:** Ship the change.

**Files:** none (git-only)

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/responsive-layout
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "Responsive layout: cap viewport, panels scroll internally (closes #56)" --body "$(cat <<'EOF'
## Summary
- `html, body` now pinned to `100dvh` with `overflow: hidden` behind a `@media (min-width: 721px)` guard — the window itself no longer scrolls on desktop.
- `.panel-telemetry` and `.panel-crew` get `overflow-y: auto` so their content scrolls inside the panel when it exceeds the grid cell. `.panel-route` and `.panel-log` already handled their own overflow.
- Mobile (≤ 720px) is untouched — stacked layout with natural page scroll.

Closes #56.

## Test plan
- [ ] Desktop widths (1280/1440/1920): no window scrollbar in any of the four themes.
- [ ] Short viewport (~700px tall): telemetry / crew scroll their own content, window stays still.
- [ ] Event modal: opens, centers, dismisses cleanly; background still covers full viewport.
- [ ] Mobile (≤ 720px): stacked layout, normal page scroll, no double-scrollbars.
- [ ] Scanline overlay (MC) and theme ::before overlays (Voltron diagonals) still cover the full viewport.
EOF
)"
```

Expected: a PR URL. Report it back to the user.

---

## Out of scope (explicitly not doing here)

- Per-theme scrollbar styling (nice-to-have; noted in the issue as a follow-up).
- A dedicated tablet breakpoint between 720px and desktop (current grid reads fine at 800–1024px; revisit if QA says otherwise).
- Font/image downscaling to avoid overflow (#56 explicitly deferred this).

---

## Self-review

- **Spec coverage (#56):** viewport cap on desktop (Task 1 Step 2 media query); panels scroll internally (Task 1 Step 2 `.panel-telemetry, .panel-crew`); mobile stack preserved (no changes under 720px); modals unchanged (`position: fixed` already); scanline coverage unchanged (`position: fixed` already). All acceptance criteria mapped.
- **No placeholders:** every step has concrete code or an exact command.
- **Type consistency:** selectors named in Task 1 match the actual class names in `styles/layout.css` (`.panel-telemetry`, `.panel-crew`) and `index.html` (same classes on `<section>` elements).
