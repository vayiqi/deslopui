# deslopui

Deslop UI with a grading loop. A skill that removes the machine-made look from a product interface. It works by subtraction: fewer words, fewer controls, fewer boxes, each measured against a written design contract, so a stranger still understands every screen in three seconds.

It covers:

- **Twelve values** distilled from Apple's Human Interface Guidelines, Dieter Rams' principles, Nielsen's heuristics, the Laws of UX, calm technology, inclusive design and WCAG, each with a question to ask and a way to check it.
- **A design contract** written before any screen: colour tokens with one job each, one type ramp, three radii, one shadow, motion rules, waivers with reasons.
- **Structural rules**: no control inside a control, no chip inside a chip, no box inside a box past two levels, no one-side colour stripes, no decorative dividers, no fact said twice, no stacked feature blocks.
- **Floor and reflex checks** for type, copy, colour, motion and touch targets.
- **Accessible colour**: WCAG 2.2 AA contrast for text (4.5:1, large 3:1), controls, icons and focus rings (3:1), no meaning by colour alone, colour-blind and forced-colours checks, scrims for text over images.
- **A build order** for new products: key visual, then the home page, then a fresh-reviewer ship/fix gate, then everything else.
- **A review rubric** for fresh, no-context reviewers, with six sub-scores (system, colour, type, layout, text, specificity) and P0–P3 severity.
- **Video rules** for product films: explain with the frame, not with captions.
- **A structural check script** that reads computed styles in a real browser and counts the patterns above, including text that fails AA contrast.
- **An optional grading loop**: each round, 10 blind expert jurors score every unit on six dimensions from 1 to 10, a script averages them, an Oracle turns their fixes into one ranked brief, and the build repeats until the score you set or a plateau. The skill asks before turning it on.

## Install

### Claude Code

Copy the folder into your skills directory, either for one project or for your user:

```sh
git clone https://github.com/vayiqi/deslopui.git
cp -r deslopui/deslop-ui .claude/skills/        # this project only
cp -r deslopui/deslop-ui ~/.claude/skills/      # every project
```

For the grading loop, also copy the two agents:

```sh
mkdir -p .claude/agents && cp deslopui/deslop-ui/agents/*.md .claude/agents/
```

Claude loads it when you ask for a de-slop, taste or "this looks AI-generated" pass, or you can name it directly: "use deslop-ui on the settings page".

### Claude apps

Zip the `deslop-ui` folder and upload it as a custom skill in your Claude settings.

### Other agents

Point the agent at `SKILL.md`. It is plain Markdown; the references and script are linked from it.

## Run the structural check on its own

Needs Node 18+ and Playwright.

```sh
npm i -D playwright && npx playwright install chromium
node deslop-ui/scripts/structure-check.mjs https://example.com            # desktop 1280x800
node deslop-ui/scripts/structure-check.mjs https://example.com --phone    # phone 390x844
```

Options:

| Flag | Does |
|---|---|
| `--phone` | Phone viewport, touch, mobile user agent |
| `--click "selector"` | Click before measuring, to reach a state; repeat for several steps |
| `--wait ms` | Wait after load and after each click (default 3000) |
| `--out file.json` | Save the full result |
| `--shot file.jpg` | Save a screenshot of the measured state |

Sample output:

```
phone 390x844  words 37  controls 9  font sizes 5  radii 5
controlInControl  0
pillInPill        1
boxInBox          2
sideStripes       0
dividers          0
smallText         1
tinyCaps          0
middleDots        0
smallTargets      5
lowContrast       0
contrastUnknown   3 (text over images, gradients or canvas: check those by eye)
```

The JSON lists every hit with its element and text, so you can find it in the code. The script finds candidates; the skill decides. A segmented control's thumb or a waived brand element can be fine.

## Grading loop

When you start a pass, the skill asks whether to run the loop, the target score (default 8.5) and the round limit (default 6). Each round:

1. 10 new `deslop-juror` agents, each with a different expert lens (product designer, interaction designer, typographer, accessibility, brand, domain expert, first-time user, mobile, motion, copy), open the product blind and score each unit 1–10 on SYS, COL, TYP, LAY, TXT and SPEC, with fixes.
2. `scripts/aggregate.mjs` averages them (dropping the highest and lowest), caps each unit at its weakest dimension + 1.5, and decides: continue, target reached, plateau, or round limit.
3. A `deslop-oracle` agent merges the fixes into one ranked brief of at most 8, or proposes 2–3 bolder directions on a plateau.
4. The builder applies the brief, and the next round starts with new jurors.

```sh
node deslop-ui/scripts/aggregate.mjs deslop-review/round-2 deslop-review/round-1 --target 8.5 --round 2
```

```
jurors 10  overall 7 (+0.1)  target 8.5  decision plateau
CARD        6.6  lowest SYS  disputed TXT  fixes 10
NAV         7.4  lowest LAY  disputed TXT  fixes 10
```

See `deslop-ui/references/grading-loop.md` for the full protocol.

## Files

```
deslop-ui/
  SKILL.md                      the method
  references/values.md          twelve design values and how to check them
  references/design-contract.md DESIGN.md template
  references/review-rubric.md   fresh-reviewer tiers, prompt, scoring
  references/video.md           rules for product films
  references/grading-loop.md    the optional jury + Oracle loop
  agents/deslop-juror.md        blind expert juror (Claude Code subagent)
  agents/deslop-oracle.md       merges fixes into one brief
  scripts/structure-check.mjs   computed-style structural check
  scripts/aggregate.mjs         averages a round, decides whether to stop
```

## Licence

MIT, free for commercial use. See [LICENSE](LICENSE).

## Author

Yiqi Zhao
