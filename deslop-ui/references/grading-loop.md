# Grading loop

Run the deslop pass as a loop: blind experts score, an Oracle merges the scores into one brief, a builder fixes, and the next round uses new experts. The loop stops when every unit reaches the target, when scores stop moving, or when the round limit is hit.

## Ask first

The loop is opt-in. Before every run, ask the user whether to turn it on, and say what it costs (10 jurors per round, up to the round limit). Without a yes, do a single deslop pass instead.

`$SKILL` below stands for the absolute path of the folder that holds `SKILL.md`; substitute it before running a command. The two agents in `$SKILL/agents/` run best installed as Claude Code subagents (copied to `.claude/agents/` or `~/.claude/agents/`). Where they are not installed, or in other tools, start a fresh general-purpose agent with the agent file's body as its instructions.

Jurors use the product for real, ten at a time. Give them a local build or a staging URL, with a test account if needed. They never create, change or send data other people can see; on a live production URL they browse read-only, and only after the user agrees.

## Inputs (ask the user once, then run)

| Input | Default | Notes |
|---|---|---|
| URL | – | A local build served over HTTP, or staging. Jurors open it themselves. |
| Sign-in | none | A test account, or a Playwright storage-state file (`--storage-state` in the check), for screens behind a sign-in. |
| Product sentence | – | One sentence: what it is, who it is for. The only context jurors get. |
| Units | – | 3–12 named parts to score, one line each ("NAV: top navigation", "CARD: the task card"). |
| Target score | 8.5 | Every unit must reach it. |
| Max rounds | 6 | Hard stop. |
| Jurors per round | 10 | Fewer (3–4) is fine for small changes; 10 gives a steadier average. |
| Lens 6 | – | The expert in the product's own domain. |

## One round

```
1. Check      node "$SKILL/scripts/structure-check.mjs" <url> --units A,B [--phone] [--dark] [--waive k] --out round-N/check-<screen>-<device>.json
2. Score      10 deslop-juror agents in parallel, each new          -> round-N/juror-01.json ... juror-10.json
3. Aggregate  node "$SKILL/scripts/aggregate.mjs" round-N [round-(N-1)] --units A,B --target T --round N --max-rounds M
                                                                     -> round-N/summary.json
4. Brief      deslop-oracle reads summary.json, fixes and checks    -> round-N/brief.md
5. Build      the builder applies brief.md, nothing else (only on continue)
6. Decide     stop or next round (rules below)
```

### 2. Jurors

- **Blind.** Each juror is a new agent that has never seen the product. It gets the URL, a test account if needed, the product sentence, the units, its lens, the absolute path of the skill folder (for `values.md` and the scripts) and the absolute path of its output file. Nothing else: no history, no earlier scores, no builder notes, no "what changed", no screenshots you took.
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
| COL | Neutral ground, 1–2 theme colours, accent only on key interactions, no decorative glow, WCAG AA contrast, never meaning by colour alone |
| TYP | Clear size hierarchy, no small-caps tags, comfortable reading |
| LAY | One idea per screen, rhythm, alignment, passes the squint test |
| TXT | Few words, each fact once, layout explains instead of text |
| SPEC | Specific to this product: would it fit any other product? |

- Scale: 1 broken, 5 competent, 7 good commercial work, 8.5 stands next to the best in the world, 10 flawless.
- Each juror gives up to 3 fixes per unit, each tied to one dimension, tagged P0 (blocks the task), P1 (major or WCAG AA), P2 (minor) or P3 (polish), and written so a builder can do it without asking.

### 3. Aggregate (deterministic, no model)

`scripts/aggregate.mjs` first checks every juror file. A unit without all six scores, or with a score outside 1–10, is skipped with a reason (listed in `skipped`), and so is a juror that wrote an `error`. Rerun a skipped juror once as a new agent. A unit needs scores from at least half the jurors, and at least 3 (all of them when a round has fewer than 3); otherwise it is listed in `thin` and the decision is never `target-reached`. Pass `--units` so a misspelt unit name is skipped instead of becoming a new unit. Then, per unit and dimension:

- **Trimmed mean**: with 5 or more jurors, drop the single highest and lowest score and average the rest. With fewer, the median.
- **Spread**: highest minus lowest. A spread above 3 marks the dimension `disputed` for the Oracle.
- **Unit score**: mean of the six dimension scores, capped at the lowest dimension + 1.5, so one weak area cannot hide.
- **Floor cap**: if a `check-*.json` in the round folder fails the Floor (its `floor` list is not empty), every unit it names in `units` is capped at 7.0. A check without `units` caps every unit.
- **Overall**: mean of the unit scores.
- **Delta** against the previous round, if given, and **regressions**: units that dropped by more than 0.5.
- **Plateau band**: twice the standard error of the jurors' own overall scores, and never less than 0.2. A move inside the band is noise.
- **Decision**: `target-reached`, `plateau`, `max-rounds` or `continue`.

### 4. Oracle

One `deslop-oracle` agent reads `summary.json` and every juror's fixes. It does not score. It:

1. Groups the fixes that say the same thing and counts how many jurors raised each.
2. Ranks them: P0 and P1 first, then by how many jurors raised it, then by the lowest dimension it lifts.
3. Drops fixes that break the design contract, add text or features, or contradict a fix ranked higher.
4. Writes `brief.md`: at most 8 fixes, each with unit, dimension, the change in one buildable sentence, and how many jurors raised it.
5. On a plateau, writes 2–3 bolder directions instead of fixes, for the user to choose from. On target reached or max rounds, lists the open fixes as a report, not for building.

### 5. Builder

Applies `brief.md` and nothing else, using the build rules in step 5 of `SKILL.md` (cuts before rewrites, no new text to explain confusion). The builder may run the aggregator and read `summary.json` to decide whether to stop, but never scores its own work and never tells jurors what changed.

## Stopping

| Rule | Condition | Then |
|---|---|---|
| Target reached | Every unit at or above the target score | Stop, report. |
| Plateau | Overall moved within the plateau band (at least ±0.2), two rounds in a row | Stop polishing. The Oracle proposes 2–3 bolder directions; the user picks one. Build it, then start a new series in `deslop-review/direction-K/round-1` (K = 2 after the first plateau, 3 after the next): round numbers, the round limit and the plateau count start again, and its round 1 has no previous folder. |
| Max rounds | Round limit hit | Stop, report the last scores and open fixes. |
| Regression | A unit drops by more than 0.5 | Revert that unit's last change (one commit per unit per round makes this easy) before the next round. |

Report only the aggregated scores from fresh jurors. Never report a builder's or the Oracle's own opinion as a score.

## Files

```
deslop-review/
  round-1/
    check-home-desktop.json  check-home-phone.json
    juror-01.json ... juror-10.json
    summary.json
    brief.md
  round-2/
  ...
  direction-2/          after the first plateau, a new series
    round-1/
```

## Cost

Jurors take their own screenshots: JPEG quality 80, long edge 1024 px, at most 12 images each. A round of 10 jurors costs roughly ten times a single review, so use 3–4 jurors for small changes and save 10 for milestones and the first and last rounds.
