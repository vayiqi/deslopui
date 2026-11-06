# Grading loop

Run the deslop pass as a loop: blind experts score, an Oracle merges the scores into one brief, a builder fixes, and the next round uses new experts. The loop stops when every unit reaches the target, when scores stop moving, or when the round limit is hit.

## Ask first

The loop is opt-in. Before every run, ask the user whether to turn it on, and say what it costs (10 jurors per round, up to the round limit). Without a yes, do a single deslop pass instead.

## Inputs (ask the user once, then run)

| Input | Default | Notes |
|---|---|---|
| Target | the live URL | Or a local build served over HTTP. Jurors open it themselves. |
| Product sentence | – | One sentence: what it is, who it is for. The only context jurors get. |
| Units | – | 3–12 named parts to score, one line each ("NAV: top navigation", "CARD: the task card"). |
| Target score | 8.5 | Every unit must reach it. |
| Max rounds | 6 | Hard stop. |
| Jurors per round | 10 | Fewer (3–4) is fine for small changes; 10 gives a steadier average. |

## One round

```
1. Check      node scripts/structure-check.mjs <url> [--phone]   -> round-N/check-*.json
2. Score      10 deslop-juror agents in parallel, each new        -> round-N/juror-01.json ... juror-10.json
3. Aggregate  node scripts/aggregate.mjs round-N [round-(N-1)]    -> round-N/summary.json
4. Brief      deslop-oracle agent reads summary.json              -> round-N/brief.md
5. Build      the builder applies brief.md, nothing else
6. Decide     stop or next round (rules below)
```

### 2. Jurors

- **Blind.** Each juror is a new agent that has never seen the product. It gets the URL, the product sentence, the units, its lens and the output format. Nothing else: no history, no earlier scores, no builder notes, no "what changed", no screenshots you took.
- **Never reused.** Every round starts 10 new jurors.
- **Ten different lenses**, one per juror, so the panel is not one opinion ten times:

| # | Lens |
|---|---|
| 1 | Product designer from a top product design award jury |
| 2 | Interaction designer: flows, states, feedback |
| 3 | Typographer and editorial designer |
| 4 | Accessibility specialist (WCAG 2.2 AA) |
| 5 | Brand and visual identity director |
| 6 | Expert in the product's own domain (set per product) |
| 7 | First-time user who has never seen the category |
| 8 | Mobile and touch specialist |
| 9 | Motion and interaction-detail designer |
| 10 | UX writer and copy editor |

- **Six dimensions, 1–10 each**, for every unit:

| Key | Dimension |
|---|---|
| SYS | One system: one button, card, radius and link style |
| COL | Neutral ground, 1–2 theme colours, accent only on key interactions, no decorative glow |
| TYP | Clear size hierarchy, no small-caps tags, comfortable reading |
| LAY | One idea per screen, rhythm, alignment, passes the squint test |
| TXT | Few words, each fact once, layout explains instead of text |
| SPEC | Specific to this product: would it fit any other product? |

- Scale: 1 broken, 5 competent, 7 good commercial work, 8.5 stands next to the best in the world, 10 flawless.
- Each juror gives up to 3 fixes per unit, each tied to one dimension, tagged P0 (blocks the task), P1 (major or WCAG AA), P2 (minor) or P3 (polish), and written so a builder can do it without asking.

### 3. Aggregate (deterministic, no model)

`scripts/aggregate.mjs` computes, per unit and dimension:

- **Trimmed mean**: drop the single highest and lowest score, average the rest. With fewer than 5 jurors it uses the plain mean.
- **Spread**: highest minus lowest. A spread above 3 on a dimension is flagged for the Oracle.
- **Unit score**: mean of the six dimension scores, capped at the lowest dimension + 1.5, so one weak area cannot hide.
- **Overall**: mean of the unit scores.
- **Delta** against the previous round, if given.
- **Decision**: `target-reached`, `plateau`, `max-rounds` or `continue`.

### 4. Oracle

One `deslop-oracle` agent reads `summary.json` and every juror's fixes. It does not score. It:

1. Groups the fixes that say the same thing and counts how many jurors raised each.
2. Ranks them: P0 and P1 first, then by how many jurors raised it, then by the lowest dimension it lifts.
3. Drops fixes that break the design contract, add text or features, or contradict a fix ranked higher.
4. Writes `brief.md`: at most 8 fixes, each with unit, dimension, the change in one buildable sentence, and how many jurors raised it.
5. On a plateau, writes 2–3 bolder directions instead of fixes, for the user to choose from.

### 5. Builder

Applies `brief.md` and nothing else, following the deslop method in `SKILL.md` (cuts before rewrites, no new text to explain confusion). Builders never see scores and never score their own work.

## Stopping

| Rule | Condition | Then |
|---|---|---|
| Target reached | Every unit at or above the target score | Stop, report. |
| Plateau | Overall moved by 0.2 or less, two rounds in a row | Stop polishing. The Oracle proposes 2–3 bolder directions; the user picks one, and the loop restarts from it. |
| Max rounds | Round limit hit | Stop, report the last scores and open fixes. |
| Regression | A unit drops by more than 0.5 | Revert that unit's change before the next round. |

Report only the aggregated scores from fresh jurors. Never report a builder's or the Oracle's own opinion as a score.

## Files

```
deslop-review/
  round-1/
    check-desktop.json  check-phone.json
    juror-01.json ... juror-10.json
    summary.json
    brief.md
  round-2/
  ...
```

## Cost

Jurors take their own screenshots: JPEG quality 80, long edge 1024 px, at most 12 images each. A round of 10 jurors costs roughly ten times a single review, so use 3–4 jurors for small changes and save 10 for milestones and the first and last rounds.
