# Review rubric

Scores count only when they come from fresh reviewers who have never seen the product. Never reuse a reviewer, and never report a score the builder gave itself.

## Size the review to the change

| Tier | When | Reviewers | They see | Method |
|---|---|---|---|---|
| T0 | One copy, CSS or bug fix nobody would notice at review size | 0 | – | Structural check only |
| T1 | 1–3 units changed visibly | 2 | Old and new of the changed units | Pairwise A/B, order flipped between the two |
| T2 | 4+ units, a new screen or a new style | 3 | Changed units plus 2 unchanged anchors | Absolute score |
| T3 | First review, every third round, before a milestone, before quoting any score | 4 | The whole product, live | Absolute score on every unit |

A failing structural check (Floor) caps that unit at 7.0.

## Reviewer prompt

```
You are an independent design reviewer. You have never seen this product.
Product: {one sentence: what it is, who it is for}
Open: {URL}  (for A/B: A = {URL_A}, B = {URL_B})
Use it as a first-time user at desktop 1280x800 and phone 390x844.
Take your own screenshots: JPEG q80, long edge <= 1024 px, at most {N}.
Judge only these units: {unit list, one line each}.
Score each unit 0-10 on six parts:
  SYS  one system: one button, card, radius and link style
  COL  neutral ground, 1-2 theme colours, accent only on key interactions, no decorative glow
  TYP  clear size hierarchy, no small-caps tags, comfortable reading
  LAY  one idea per screen, rhythm, alignment, passes the squint test
  TXT  few words, each fact once, layout explains instead of text
  SPEC would this design fit a different product? real product imagery vs template
Write worst/fix for the lowest part only, and tag it P0 (blocks the task),
P1 (major or WCAG AA), P2 (minor) or P3 (polish).
Scale: 5 competent, 7 good commercial work, 8.5 stands next to the best in
the world, 10 flawless. Be harsh. Do not assume anything was improved.
Reply with JSON only.
```

## Output

Absolute (T2, T3):

```json
{"units":[{"u":"NAV","sub":{"SYS":7.5,"COL":8,"TYP":6.5,"LAY":7.5,"TXT":7,"SPEC":8},
  "s":7.4,"worst":"TYP: ...","fix":"...","sev":"P1"}]}
```

`s` is the mean of the six parts, capped at the lowest part + 1.5, so one weak area cannot hide.

Pairwise (T1):

```json
{"pairs":[{"u":"S07","pick":"A|B|=","margin":1,"why":"<=15 words"}]}
```

## Deciding

- Unit score = median of the reviewers. If two differ by more than 1.5, add one more fresh reviewer for that unit.
- Pairwise: ship the new version if both pick it, or one picks it and the other says "=". Anything else means no visible gain.
- Anchors in a T2 must land within ±0.4 of their last T3. If not, run a T3.
- Two fresh absolute reviews within ±0.2 on the same units means polishing has stopped paying. Stop and propose two or three bolder directions.
- The next round targets the lowest median part per unit, and fixes every P0 and P1 first.
