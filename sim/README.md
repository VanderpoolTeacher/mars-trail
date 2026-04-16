# Mars Trail — Playtest Simulation Harness

Dev tool for balance validation. Not a test suite; just runs many simulated games and prints a results table.

## Run

```bash
node sim/play.mjs
```

Prints one row per configuration (strategy × pace × rations), with win%, avg sols, avg crew survived, avg science, and loss-reason breakdown. 500 games per row, ~10 seconds total.

## Reference strategies

- **FirstChoice** — always picks the first event option. Proxy for naïve click-through play.
- **Safe** — minimizes expected resource loss and crew damage per event.
- **Skilled** — prefers skill-check choices when the matching specialist is alive.
- **Balanced** — avoids worsening any currently-critical resource; otherwise favors high-probability skill checks.

## Editing

To test other configurations, edit the `strategies` array at the bottom of `play.mjs`.

## Pass criteria for v0.2.0 pace balance (issue #2)

Balanced strategy:
- Cautious: 65–75% win
- Steady: 55–65% win
- Push: 40–55% win

Additional:
- FirstChoice ≤ 80% at every pace
- Skilled beats Balanced by 5–10 percentage points on average
