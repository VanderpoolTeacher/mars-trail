# Meager Rations Balance Fix (issue #3)

**Date:** 2026-04-16
**Status:** Draft — pending user review
**Related issue:** #3
**Ships as:** v0.5.1

## Problem

Meager rations today has a ~4.6% win rate even at push pace (v0.2.0 sim data). The trap: `STARVATION_DAMAGE = 4` fires unconditionally every sol when `rations === 'meager'`, on top of everything else. Over a 22-sol push run that's ~88 hp of damage per crew member (minus medic mitigation), easily enough to wipe the team even when food is still abundant.

The mechanic contradicts the thematic identity of "tight rationing": the player's crew suffers maximum penalty for conserving supplies even when food is plentiful. There's no strategic scenario where meager is the right call.

## Goal

Rebalance meager so it becomes a real strategic option for long/cautious runs. Target: `Safe / push / meager` reaches **15–25%** win rate. `Safe / push / standard` stays near **47%**. Balanced pace bands (cautious/steady/push at standard) unchanged within ±2pp.

## Approach — remove unconditional starvation

Let the existing critical-resource damage system (`LOW_FOOD_DAMAGE` + `LOW_RESOURCE_THRESHOLD`) handle the punishment. Meager runs that manage their food carefully avoid damage entirely; meager runs that actually starve get penalized through the same path as running out of any other resource.

Selected from brainstorm Q1:
- **B:** remove unconditional damage; let `LOW_FOOD_DAMAGE` handle true starvation.

## Code changes

**File:** `src/systems/travel.js`

Remove the constant:
```js
// DELETE:
const STARVATION_DAMAGE = 4;
```

Remove the unconditional damage block in `advanceSol`:
```js
// DELETE:
if (s.rations === 'meager') {
  for (const id of aliveIds) s = applyDamage(s, id, STARVATION_DAMAGE, 'starvation').state;
}
```

Everything else — `FOOD_PER_SOL.meager = 1.2`, `LOW_FOOD_DAMAGE = 4`, `LOW_RESOURCE_THRESHOLD = 25` — stays unchanged. Meager's identity is now purely the food-rate saving (1.2 vs 2.2), with the existing low-food damage path kicking in if the player runs out.

## Validation

- **Sim:** run `node sim/play.mjs`. Verify:
  - `Safe / push / meager` ∈ [15, 25]% — target for the fix.
  - `Safe / push / standard` stays near v0.5.0 values (~47%).
  - Balanced cautious / steady / push at standard stay in their bands (68–75% / 60–70% / 45–55%).
- **Tests:** no unit tests reference `STARVATION_DAMAGE` or meager-specific damage. A grep confirms. `node --test sim/*.test.mjs` should continue to pass unchanged.

## Fallback

If meager overshoots 25% after removal:
- Add back a light `STARVATION_DAMAGE: 1`. Re-run sim.

If meager undershoots 15%:
- Bump `FOOD_PER_SOL.meager` from 1.2 to 1.0 (further food savings) or adjust `LOW_FOOD_DAMAGE`.

Document whichever adjustment lands in the commit message.

## Ship sequence

Three steps, one commit, one tag:
1. Edit `src/systems/travel.js` (remove constant + block).
2. Run sim. Capture before/after numbers.
3. Bump `package.json` to `0.5.1`.
4. Commit with `Closes #3` and the before/after sim evidence.
5. PR → merge → tag `v0.5.1` → GitHub Release.

No tests to add (this is a deletion, not new behavior; existing coverage is adequate).

## Scope boundary

**In scope:** removing the unconditional starvation penalty. Patch version bump.

**Out of scope:** tuning `LOW_FOOD_DAMAGE`, adjusting `FOOD_PER_SOL.meager`, introducing new food-related mechanics (like "crew morale"). If the removal doesn't land meager in the target band, use the Fallback section's small adjustments and document them — don't widen scope further.

## Interaction with shipped features

- **v0.2.0 pace balance:** untouched. Pace bands for standard-rations play stay in their target curves.
- **v0.5.0 career progression:** career `lifeSupportMult` affects O₂/H₂O only, never food. No interaction.
- **v0.5.0 scoring:** no change. Meager just becomes a more viable strategic option — rank outcomes follow the same formula.
