# Review rubric

Scores count only when they come from fresh reviewers who have never seen the product. Never reuse a reviewer, and never report a score the builder gave itself.

This is the same scoring system as the grading loop: the same six dimensions, the same 1–10 scale, the same juror prompt and output, and the same script to combine scores. The loop runs 10 jurors every round; outside the loop, size the review to the change.

## Size the review to the change

| Tier | When | Reviewers | They see | Method |
|---|---|---|---|---|
| T0 | One copy, CSS or bug fix nobody would notice at review size | 0 | – | Structural check only |
| T1 | 1–3 units changed visibly | 2 | Old and new of the changed units | Pairwise A/B, order flipped between the two |
| T2 | 4+ units, a new screen or a new style | 3 | Changed units plus 2 unchanged anchors | Absolute score |
| T3 | First review, before a milestone, before quoting any score | 4–10 | The whole product, live | Absolute score on every unit |

## Absolute score (T2, T3)

Start each reviewer as a new `deslop-juror` agent (see `agents/deslop-juror.md`) with the URL, one sentence on the product, the units, a lens from the list in `grading-loop.md` and an output file named `juror-NN.json`. Put the files in one folder with the structural check results (`check-*.json`) and run:

```
node "$SKILL/scripts/aggregate.mjs" <folder> [<previous folder>] --units A,B
```

Pass the previous review's folder as the second argument to get a delta, regressions and the plateau decision.

The script applies the rules below and writes `summary.json`:

- Each dimension: with 5 or more reviewers, the mean after dropping the highest and lowest score; with fewer, the median.
- Unit score: mean of the six dimensions, capped at the lowest dimension + 1.5, so one weak area cannot hide.
- A unit on a screen that fails the structural Floor is capped at 7.0.
- A dimension where reviewers differ by more than 3 is marked disputed. With 2–4 reviewers, add one more fresh reviewer for that unit.

## Pairwise (T1)

Start a `deslop-juror` (or a general-purpose agent with that file's body) with two URLs, A and B, instead of one: the agent's pairwise mode returns a pick per unit instead of scores. Flip the order between the two reviewers. Read the two files yourself; `aggregate.mjs` does not read pairwise results.

Ship the new version if both pick it, or one picks it and the other says "=". Anything else means no visible gain.

## Deciding

- Keep each review's folder, with its `summary.json`, under `deslop-review/` named by tier and date (for example `deslop-review/t3-2026-03-02/`). Anchors in a T2 must land within ±0.4 of their score in the latest T3 folder. If not, run a T3.
- When `aggregate.mjs`, given the previous review's folder, reports `plateau` (two reviews in a row inside the plateau band, at least ±0.2), polishing has stopped paying. Stop and propose two or three bolder directions.
- The next round targets the lowest dimension per unit, and fixes every Floor failure, P0 and P1 first.
