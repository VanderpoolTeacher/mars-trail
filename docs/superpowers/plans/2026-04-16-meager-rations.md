# Meager Rations Balance Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the unconditional meager-rations starvation penalty so meager becomes a viable strategic option; let the existing `LOW_FOOD_DAMAGE` handle actual starvation when food runs low.

**Architecture:** Two deletions in `src/systems/travel.js` — one constant, one damage block in `advanceSol`. No new mechanics. Validation via sim harness comparing `Safe / push / meager` win rate before and after.

**Tech Stack:** Vanilla ES modules. `node --test` and `node sim/play.mjs`. No new dependencies.

**Related:** Spec at `docs/superpowers/specs/2026-04-16-meager-rations-design.md`. Closes #3. Ships as `v0.5.1` (patch release — balance tweak, no new mechanics).

---

## File Structure

**Modify:**
- `src/systems/travel.js` — delete `const STARVATION_DAMAGE` and the meager-starvation damage block inside `advanceSol`.
- `package.json` — bump version to `0.5.1`.

**Untouched:** all other game systems, tests, sim harness.

---

## Task 1: Capture baseline sim numbers

**Files:** none modified.

Record pre-change behavior so the commit message has before/after evidence.

- [ ] **Step 1: Run the sim and capture the meager row**

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node sim/play.mjs 2>&1 | tee /tmp/meager-before.txt | grep -E "Safe|Balanced"`

Expected: rows print for Safe and Balanced at all three paces × standard rations.

- [ ] **Step 2: Add a meager row to the sim temporarily**

The default sim config in `sim/play.mjs` doesn't include a meager entry. Temporarily add one to capture the baseline.

Open `sim/play.mjs` and find the `strategies` array (near the bottom of the file). Append one entry at the end of the array (before the closing `]`):

```js
  { name: 'Safe / push / meager',              pace: 'push',     rations: 'meager',   pick: strategySafe }
```

Save and run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node sim/play.mjs 2>&1 | tail -15`

Capture the `Safe / push / meager` win rate (expected: ~3–7% — the broken state).

**Do not commit** this sim edit. It's a temporary measurement.

- [ ] **Step 3: Revert the sim edit**

Open `sim/play.mjs` and remove the meager entry you just added. Save.

Verify clean: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && git diff sim/play.mjs`
Expected: no diff output.

- [ ] **Step 4: Record the number you captured**

Write down the `Safe / push / meager` win rate from Step 2. You'll paste it into the Task 3 commit message as the "before" figure. Also note the `Safe / push / standard` and Balanced rows — those should stay unchanged after the fix.

---

## Task 2: Remove unconditional starvation damage

**Files:**
- Modify: `src/systems/travel.js`

- [ ] **Step 1: Read the current block**

Run: `grep -n "STARVATION_DAMAGE\|rations === 'meager'" src/systems/travel.js`

Expected output (line numbers may vary):
```
71:const STARVATION_DAMAGE = 4;
157:  if (s.rations === 'meager') {
158:    for (const id of aliveIds) s = applyDamage(s, id, STARVATION_DAMAGE,  'starvation').state;
```

Three references — a constant declaration and a 2-line damage block. No other references (confirmed by the grep above finding only these).

- [ ] **Step 2: Delete the constant**

Open `src/systems/travel.js`. Find this line (around line 71):

```js
const STARVATION_DAMAGE = 4;
```

Delete the entire line. If there's a comment on the preceding line that references starvation specifically (e.g., `// Starvation damage per crew per sol on meager rations`), delete that too. Leave unrelated nearby constants (`HYPOXIA_DAMAGE`, `DEHYDRATION_DAMAGE`, `LOW_FOOD_DAMAGE`) alone.

- [ ] **Step 3: Delete the damage block**

In `src/systems/travel.js`'s `advanceSol`, find the meager-rations block (around lines 157–159):

```js
  if (s.rations === 'meager') {
    for (const id of aliveIds) s = applyDamage(s, id, STARVATION_DAMAGE,  'starvation').state;
  }
```

Delete all three lines. Adjacent blocks (hypoxia, dehydration, low-food, power-dead) stay in place.

- [ ] **Step 4: Verify no stragglers**

Run: `grep -n "STARVATION_DAMAGE\|starvation" src/systems/travel.js`

Expected: no output (all references removed).

Run: `grep -rn "STARVATION_DAMAGE" src/ sim/`

Expected: no output. The constant is not referenced anywhere else.

- [ ] **Step 5: Syntax check**

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node --check src/systems/travel.js`

Expected: exits with no output.

- [ ] **Step 6: Run all tests**

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node --test sim/*.test.mjs 2>&1 | tail -5`

Expected: all existing tests pass (none referenced `STARVATION_DAMAGE` so no breakage).

- [ ] **Step 7: Sim check — measure the new meager win rate**

Temporarily add the meager row to `sim/play.mjs` again (as in Task 1 Step 2):

```js
  { name: 'Safe / push / meager',              pace: 'push',     rations: 'meager',   pick: strategySafe }
```

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && node sim/play.mjs 2>&1 | tail -15`

Capture the new `Safe / push / meager` win rate. Target: **15–25%**.

Also verify:
- `Safe / push / standard` stays near v0.5.0 value (~47%).
- `Balanced / cautious / standard`, `Balanced / steady / standard`, `Balanced / push / standard` all within ±3pp of prior run (the fix doesn't affect standard rations).

Revert the sim edit: delete the meager entry. Verify clean: `git diff sim/play.mjs` should produce no output.

- [ ] **Step 8: Decide on fallback if target missed**

If `Safe / push / meager` is **above 25%**: meager is now too easy. Add back a light `STARVATION_DAMAGE = 1` plus its damage block:

```js
// Near where the constant used to live:
const STARVATION_DAMAGE = 1;  // light always-on cost for meager

// Near where the damage block used to live:
if (s.rations === 'meager') {
  for (const id of aliveIds) s = applyDamage(s, id, STARVATION_DAMAGE, 'starvation').state;
}
```

Re-run the sim. Iterate the constant value (try 1, 2, 3) until the rate lands in [15, 25]%.

If `Safe / push / meager` is **below 15%**: the removal wasn't enough. Change `FOOD_PER_SOL.meager` from `1.2` to `1.0`:

```js
const FOOD_PER_SOL = {
  meager:   1.0,   // was 1.2 — larger savings for rationing discipline
  standard: 2.2,
  full:     3.2
};
```

Re-run the sim.

Document whichever path you took — the commit message in Task 3 includes a line for "adjustment" if you needed a fallback.

---

## Task 3: Version bump + commit

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Bump version to 0.5.1**

Open `package.json`. Change `"version": "0.5.0"` to `"version": "0.5.1"`.

The file should look like:
```json
{
  "type": "module",
  "private": true,
  "version": "0.5.1"
}
```

- [ ] **Step 2: Commit the balance fix**

Replace the `XX.X%` placeholders with the real before/after numbers you captured in Task 1 and Task 2.

```bash
cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail"
git add src/systems/travel.js package.json
git commit -m "$(cat <<'EOF'
Meager rations: remove unconditional starvation damage

Closes #3

Before (sim, 500 games, Safe / push / meager): XX.X% win
After  (same sim):                             XX.X% win

Removed STARVATION_DAMAGE constant and its unconditional damage
block in advanceSol. Meager's identity is now purely the food-rate
saving (1.2 vs 2.2 per sol); LOW_FOOD_DAMAGE handles actual
starvation when food drops below the critical threshold.

Standard-rations pace bands unchanged (sim confirms).

[If fallback used, add one line here, e.g.:
 Adjustment: added back STARVATION_DAMAGE = 1 to keep meager in
 the 15-25% target band.]

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Replace the `XX.X%` placeholders. Remove the bracketed "Adjustment" paragraph if you didn't need a fallback.

---

## Task 4: PR → merge → tag v0.5.1 → release

**Files:** none modified.

- [ ] **Step 1: Push the branch**

Run: `cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail" && git push -u origin feat/meager-rations`

- [ ] **Step 2: Open the PR**

Replace `<BEFORE>` and `<AFTER>` with your real sim numbers.

```bash
gh pr create --base main --head feat/meager-rations --title "Meager rations balance fix (v0.5.1)" --body "$(cat <<'EOF'
## Summary

Meager rations had a ~4.6% win rate at push pace — the trap was an unconditional \`STARVATION_DAMAGE: 4\` every sol, regardless of food level. Removed it. Meager's identity is now purely the food-rate saving (1.2 vs 2.2); the existing \`LOW_FOOD_DAMAGE\` handles actual starvation when food runs low.

- Closes #3.
- Patch release. No new mechanics.

## Sim evidence

| Config | Before | After |
|---|---|---|
| Safe / push / meager | <BEFORE>% | <AFTER>% |
| Safe / push / standard | ~47% | ~47% (unchanged) |
| Balanced / cautious / standard | ~72% | ~72% (unchanged) |
| Balanced / steady / standard | ~63% | ~63% (unchanged) |
| Balanced / push / standard | ~49% | ~49% (unchanged) |

## Test plan

- [x] \`node --test sim/*.test.mjs\` — 43/43 pass (no tests referenced STARVATION_DAMAGE).
- [x] \`node sim/play.mjs\` — standard-rations bands unchanged.
- [ ] Browser: title shows \`v0.5.1 · 2026\`.
- [ ] Browser: start a run at meager rations. Rover travels normally; crew doesn't take unconditional damage.
- [ ] Browser: deliberately burn food to <25% on meager. Confirm \`LOW_FOOD_DAMAGE\` kicks in as expected (existing behavior).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Pause for user test + merge**

Hand back to the user. Standard flow: `gh pr merge <N> --rebase --delete-branch`.

- [ ] **Step 4: Post-merge — sync, tag, release**

```bash
cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Mars Trail"
git checkout main
git fetch --prune
git reset --hard origin/main
git branch -D feat/meager-rations 2>/dev/null

git tag -a v0.5.1 -m "v0.5.1 — Meager rations balance fix

Removed unconditional starvation damage. Meager is now a viable
strategic option for runs that can manage their food carefully.
Closes #3."
git push origin v0.5.1

gh release create v0.5.1 --title "v0.5.1 — Meager Rations Fix" --notes "$(cat <<'EOF'
## Meager is viable now

Previously, picking meager rations at mission start applied \`-4 hp/sol\` to every crew member as unconditional starvation damage — regardless of food level. A 22-sol push run meant ~88 hp per crew from starvation alone, on top of everything else. Meager had a ~4.6% win rate.

Removed the unconditional penalty. Meager's strategic identity is now purely the food-rate saving (1.2 vs 2.2 per sol). The existing \`LOW_FOOD_DAMAGE\` still kicks in when food drops below critical — so running out is still punished, but carefully managing a low ration isn't.

## Closed

- #3 — Balance: 'meager' rations non-viable (4.6% win even at push pace)
EOF
)"
```

- [ ] **Step 5: Verify**

```bash
gh release view v0.5.1
gh issue view 3
```

Expected: release renders; issue #3 closed.

---

## Self-Review (run before dispatching)

**Spec coverage:**
- §Approach (remove unconditional starvation) → Task 2 Steps 2–3 ✓
- §Code changes → Task 2 Steps 2–3 ✓
- §Validation (sim before/after, tests pass) → Task 1 + Task 2 Steps 6–7 ✓
- §Fallback (overshoot/undershoot adjustments) → Task 2 Step 8 ✓
- §Ship sequence (edit, sim, bump, commit, release) → Tasks 2, 3, 4 ✓
- §Scope boundary (no new mechanics) → Task 2 deletes only; no additions unless fallback required ✓

**Placeholder scan:** `XX.X%` appear in Task 3's commit template AND Task 4's PR body, both with explicit instruction to replace with real numbers. No TBDs.

**Type consistency:** `STARVATION_DAMAGE` referenced consistently across Task 2 Steps 2, 3, 4 (as the deletion target) and Step 8 (as the fallback re-add). `LOW_FOOD_DAMAGE` mentioned only as the preserved fallback path — spelled correctly.
