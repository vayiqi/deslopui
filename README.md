# deslopui

Deslop UI with a grading loop. A skill that removes the machine-made look from a product interface. It works by subtraction: fewer words, fewer controls, fewer boxes, each measured against a written design contract, so a stranger still understands every screen in three seconds.

It covers:

- **Twelve values** distilled from Apple's Human Interface Guidelines, Dieter Rams' principles, Nielsen's heuristics, the Laws of UX, calm technology, inclusive design and WCAG, each with a question to ask and a way to check it.
- **A design contract** written before any screen: colour tokens with one job each, one type ramp, three radii, one shadow, motion rules, waivers with reasons.
- **Structural rules**: no control inside a control, no chip inside a chip, no card inside a card, no one-side colour stripes, no decorative dividers, no fact said twice, no stacked feature blocks.
- **Floor and reflex checks** for type, copy, colour, motion and touch targets.
- **Accessible colour**: WCAG 2.2 AA contrast for text (4.5:1, large 3:1), controls, icons and focus rings (3:1), no meaning by colour alone, colour-blind and forced-colours checks, scrims for text over images.
- **A build order** for new products: key visual, then the home page, then a fresh-reviewer ship/fix gate, then everything else.
- **A review rubric** for fresh, no-context reviewers, with six dimensions (system, colour, type, layout, text, specificity) scored 1–10 and P0–P3 severity. The same scoring runs inside the loop.
- **Video rules** for product films: explain with the frame, not with captions.
- **A structural check script** that reads computed styles in a real browser and counts the patterns above, including text that fails AA contrast, and reports which Floor rules fail.
- **An optional grading loop**: each round, 10 blind expert jurors score every unit on six dimensions from 1 to 10, a script averages them, an Oracle turns their fixes into one ranked brief, and the build repeats until the score you set or a plateau. The skill asks before turning it on.

## Requirements

- Node 18 or later.
- Playwright with Chromium, for the structural check and for jurors to open your product:

  ```sh
  npm i -D playwright
  npx playwright install chromium
  ```

  The script finds Playwright in your project, next to the skill, or installed globally.

## Install

### Claude Code

Copy the skill folder into a skills directory, and, for the grading loop, the two agents into an agents directory. For one project (run from the project root):

```sh
git clone https://github.com/vayiqi/deslopui.git /tmp/deslopui
mkdir -p .claude/skills .claude/agents
cp -r /tmp/deslopui/deslop-ui .claude/skills/
cp /tmp/deslopui/deslop-ui/agents/*.md .claude/agents/
```

For every project, use `~/.claude/skills` and `~/.claude/agents` instead.

On Windows (PowerShell):

```powershell
git clone https://github.com/vayiqi/deslopui.git $env:TEMP\deslopui
New-Item -ItemType Directory -Force .claude\skills, .claude\agents | Out-Null
Copy-Item -Recurse $env:TEMP\deslopui\deslop-ui .claude\skills\
Copy-Item $env:TEMP\deslopui\deslop-ui\agents\*.md .claude\agents\
```

Restart Claude Code so it sees the new agents. It loads the skill when you ask for a de-slop, taste or "this looks AI-generated" pass, or you can name it: "use deslop-ui on the settings page". It asks whether to run the grading loop before it starts.

### Claude apps

Zip the `deslop-ui` folder and upload it as a custom skill in your Claude settings. The structural check and the grading loop need a code environment with Node and Playwright; without one, the method and rubric still apply.

### Other agents

Point the agent at `deslop-ui/SKILL.md`. It is plain Markdown; the references and scripts are linked from it. For the loop, start a fresh agent per juror with the body of `agents/deslop-juror.md` as its instructions.

## Run the structural check on its own

```sh
node deslop-ui/scripts/structure-check.mjs https://example.com            # desktop 1280x800
node deslop-ui/scripts/structure-check.mjs https://example.com --phone    # phone 390x844
```

If you installed with npm (`npm i -D github:vayiqi/deslopui`), the same commands are `npx deslop-check` and `npx deslop-aggregate`.

| Flag | Does |
|---|---|
| `--phone` | iPhone viewport, touch and user agent |
| `--click "selector"` | Click before measuring, to reach a state; repeat for several steps |
| `--wait ms` | Wait after load and after each click (default 3000) |
| `--units A,B` | Name the scored units on this screen, for the grading loop |
| `--out file.json` | Save the full result |
| `--shot file.jpg` | Save a screenshot of the measured state |

Sample output:

```
phone 390x844  words 24/25  controls 4/5  font sizes 3  radii 2
controlInControl    1  floor
pillInPill          1
boxInBox            1
sideStripes         1
dividers            2
smallText           1  floor
tinyCaps            1  floor
middleDots          1
smallTargets        3  floor
lowContrast         1  floor
contrastUnknown     1  (text over images, gradients or canvas: check by eye)
Floor: fails controlInControl, lowContrast, smallText, tinyCaps, smallTargets
```

The JSON lists every hit with its element and text (repeats as `x3`), so you can find it in the code. Rows marked `floor` block shipping; the others are candidates the skill judges. A segmented control's thumb or a waived brand element can be fine. It measures first view only, or the state after `--click`; text over images, video or canvas is counted as `contrastUnknown` for you to check by eye.

## Grading loop

When you start a pass, the skill asks whether to run the loop, then once for the target score (default 8.5), the round limit (default 6), a one-sentence product description and the units to score. Each round:

1. 10 new `deslop-juror` agents, each with a different expert lens (product designer, interaction designer, typographer, accessibility, brand, domain expert, first-time user, mobile, motion, copy), open the product blind and score each unit 1–10 on SYS, COL, TYP, LAY, TXT and SPEC, with fixes.
2. `aggregate.mjs` checks every juror file, averages them (dropping the highest and lowest), caps each unit at its weakest dimension + 1.5 and at 7.0 if its screen fails the structural Floor, and decides: continue, target reached, plateau, or round limit.
3. A `deslop-oracle` agent merges the fixes into one ranked brief of at most 8, or proposes 2–3 bolder directions on a plateau.
4. The builder applies the brief, and the next round starts with new jurors.

A plateau is two rounds in a row where the overall moves less than the panel's own noise (at least ±0.2):

```sh
node deslop-ui/scripts/aggregate.mjs deslop-review/round-4 deslop-review/round-3 --target 8.5 --max-rounds 6
```

```
round 4  jurors 10  overall 7.2 (+0.05; moves within ±0.2 are noise)  target 8.5  decision plateau
CARD        6.9  lowest TXT  fixes 10
NAV         7.5  lowest SYS  fixes 10
```

See `deslop-ui/references/grading-loop.md` for the full protocol. A round of 10 jurors costs roughly ten single reviews; use 3–4 jurors for small changes.

## Files

```
deslop-ui/
  SKILL.md                      the method
  references/values.md          twelve design values and how to check them
  references/design-contract.md DESIGN.md template
  references/review-rubric.md   reviewer tiers and scoring outside the loop
  references/grading-loop.md    the optional jury + Oracle loop
  references/video.md           rules for product films
  agents/deslop-juror.md        blind expert juror (Claude Code subagent)
  agents/deslop-oracle.md       merges fixes into one brief
  scripts/structure-check.mjs   computed-style structural check
  scripts/aggregate.mjs         combines a round's scores, decides whether to stop
tests/                          node --test suites with HTML fixtures
```

## Develop

```sh
npm install
npx playwright install chromium
npm test
```

CI runs the tests on Node 18 and 22.

## Licence

MIT, free for commercial use. See [LICENSE](LICENSE).

© Deepcake. Created by Yiqi Zhao.
