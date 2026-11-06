# deslopui

Deslop UI with a grading loop. A skill that removes the machine-made look from a product interface. It works by subtraction: fewer words, fewer controls, fewer boxes, each measured against a written design contract, so a stranger still understands every screen in three seconds.

It covers:

- **A design contract** written before any screen: colour tokens with one job each, one type ramp, three radii, one shadow, motion rules, waivers with reasons.
- **Structural rules**: no control inside a control, no chip inside a chip, no box inside a box past two levels, no one-side colour stripes, no decorative dividers, no fact said twice, no stacked feature blocks.
- **Floor and reflex checks** for type, copy, colour, motion and touch targets.
- **A build order** for new products: key visual, then the home page, then a fresh-reviewer ship/fix gate, then everything else.
- **A review rubric** for fresh, no-context reviewers, with six sub-scores (system, colour, type, layout, text, specificity) and P0–P3 severity.
- **Video rules** for product films: explain with the frame, not with captions.
- **A structural check script** that reads computed styles in a real browser and counts the patterns above.

## Install

### Claude Code

Copy the folder into your skills directory, either for one project or for your user:

```sh
git clone https://github.com/vayiqi/deslopui.git
cp -r deslopui/deslop-ui .claude/skills/        # this project only
cp -r deslopui/deslop-ui ~/.claude/skills/      # every project
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
```

The JSON lists every hit with its element and text, so you can find it in the code. The script finds candidates; the skill decides. A segmented control's thumb or a waived brand element can be fine.

## Files

```
deslop-ui/
  SKILL.md                      the method
  references/design-contract.md DESIGN.md template
  references/review-rubric.md   fresh-reviewer tiers, prompt, scoring
  references/video.md           rules for product films
  scripts/structure-check.mjs   computed-style structural check
```

## Licence

MIT, free for commercial use. See [LICENSE](LICENSE).

## Author

Yiqi Zhao
