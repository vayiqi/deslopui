---
name: deslop-ui
description: Remove the machine-made look from a product UI by subtraction, measured against a written design contract. Use for a de-slop, taste or "looks AI-generated" pass on a live site or app, or before building a new product's first screens.
---

# Deslop UI

The job is subtraction. A pass is judged by what it removes while a stranger still understands each screen in three seconds. Never fix confusion by adding tooltips, coach marks, "?" buttons, helper text or features. Remove whatever causes it.

This does not cover text that accessibility requires: a visible label on every input, the instructions a form needs to be filled in (format, required fields), error messages that name the problem and the fix (WCAG 3.3.1, 3.3.2, 3.3.3), and accessible names and descriptions (`aria-label`, `aria-describedby`; 4.1.2, 2.4.6). Those stay; write them short.

**Paths.** `$SKILL` below is a placeholder, not a shell variable. Before running any command, replace it with the absolute path of the folder this file is in (for example `/Users/ana/.claude/skills/deslop-ui`). Run the commands from the product's folder. The scripts need Node 20+ and Playwright (`npm i -D playwright && npx playwright install chromium`).

**Safety.** Anyone who opens the product for this skill (you, a reviewer, a juror) uses a local build or a staging URL, with a test account if needed. Never do anything that creates, changes or sends data other people can see or that costs money: no sign-ups on a live product, no submitted forms, orders, payments, posts, reviews, comments, messages, invites, deletes or settings changes. Where the main task ends in one of those, stop at the last step before it. If the user can only give a live production URL, say that jurors will browse it read-only, and get their OK first.

**Before you start, ask the user whether to run the grading loop.** The loop adds 10 blind expert jurors and an Oracle each round and repeats until a target score or a plateau, so it costs many times a single pass. Ask every time; never turn it on by default. Ask the loop inputs listed under "Grading loop" in the same message, so the user answers once; then run without further questions. If the answer is no, do a single pass and stop after step 6. For a new product, the loop starts only after the home page passes the home gate, since before that there is nothing to grade.

The rules below come from twelve values, distilled from Apple's Human Interface Guidelines, Dieter Rams, Nielsen's heuristics, the Laws of UX, calm technology and inclusive design. When a rule does not cover a case, decide by [references/values.md](references/values.md).

Two entry points:

- **Existing product**: follow steps 1 to 6.
- **New product or full redesign**: write the contract (step 1), then build the key visual, then the home page only. Pass the home gate (step 6) before building any other page, and reuse the home page's tokens everywhere after that.

## 1. Write the design contract first

Look for `DESIGN.md` at the product root. If it is missing, write it before touching a screen, from the live code for an existing product, or from scratch for a new one. Use [references/design-contract.md](references/design-contract.md). Every value you write later comes from it. A value that is not in the contract is a bug, unless the contract waives it with a reason.

Gather 2 to 3 real screenshots or wireframes as references for the person building: the product's own UI first, then products in the same category that are admired. Build from pictures, never from adjectives alone. Reviewers never see these references.

If another person or agent is working on the same screens, agree the split before editing: list your exact selectors and strings, and hand them these rules for their side.

## 2. Measure every state

Screenshot every screen in each state people actually see: first view, mid-task, success and failure, empty, and dialogs. Do this at desktop 1280×800 and phone 390×844, in every language the product ships. Use JPEG quality around 80 with the long edge at most 1024 px.

Run the structural check on each state and keep the numbers:

```
node "$SKILL/scripts/structure-check.mjs" https://example.com/app --phone --out before.json
node "$SKILL/scripts/structure-check.mjs" https://example.com/app --click "text=Open menu" --out before-menu.json
```

The script reads computed styles, not source code. Products with many stylesheets often override what the source says. It measures only what is on screen at first view (or after the clicks you give it). It reports the Floor rules it can measure (`floor` in the JSON) and the budgets it can count (`overBudget`); everything else it lists is a candidate for you to judge. Use `--dark` for the dark theme, `--storage-state` for screens behind a sign-in, and `--waive` for house rules the contract waives. It cannot measure placeholder text, non-text contrast (borders, icons), focus visibility, or text over images, video and canvas (`contrastUnknown`); check those by eye. Exit code 2 means the Floor fails.

## 3. Hold the rules

### Structure: none allowed

| Pattern | Rule |
|---|---|
| Control inside a control | One tap target per region. A card that opens something has no separate "Open" button. |
| Chip inside a chip, pill inside a pill | A bar of buttons is one frame with no inner dividers. A segmented control shows its state with a thumb, not a dark chip inside a pale track; the selected thumb still differs from the track at 3:1 or by weight (WCAG 1.4.11). |
| Card inside a card | A framed block never sits inside another framed block. Controls and chips inside a card are fine. Content can sit directly on the page. |
| One-side colour stripe | No coloured edge on the current row, a warning or a card. Show state once, with a cue that is not only colour: weight, an icon, a word, or a fill plus a visible marker (WCAG 1.4.1). |
| Divider rules | Only between different kinds of content. Never inside a row of icons or numbers; use space. |
| Two controls, one job | A back arrow and a "Back" button, or a "?" in the toolbar and another in the card: keep one. |
| A fact said twice | Once per screen. A count shown as icons, as a number and as a sentence is three times. |
| Feature blocks stacked | No row of three equal feature cards, no grid of identical cards where a list or the content itself would do. One idea per section. |

### Floor: blocks shipping

- Colour, font size, radius or family that is not in the contract.
- *House rule:* uppercase, small caps or letter-spacing above 0.03em on text 15px or smaller, unless the contract waives it.
- *House rule:* text under 13px, unless the contract waives it.
- An eyebrow or kicker that only announces the heading below it.
- Emoji used as an icon.
- *House rule:* interface text over budget. At first view, phone screens allow 25 words and 5 controls, desktop screens 40 words and 7 controls. The content itself (a photo, a map, a chart, a list, a table, an article) does not count, and neither do input labels, form instructions or error messages. A data-dense tool (dashboard, editor, admin) sets its own budget in the contract. The script reports the raw counts as `overBudget`; you judge what is content.
- Instructions cut off by an ellipsis. Instructions wrap; only names and metadata may truncate.
- Targets under 24 by 24px that are crowded (WCAG 2.5.8, AA): a smaller target passes when a 24px circle on its centre touches no other target. Links inside a sentence and unstyled native controls are exempt. *House rule:* on touch screens, every target 44px (as WCAG 2.5.5, AAA), even when the visible mark is smaller; a label counts as part of its checkbox. The script reports these as `smallTargets` (AA) and `touchTargets` (house rule, waivable).
- Colour contrast below WCAG 2.2 AA: text under 4.5:1, or 3:1 for 24px+ or 18.66px+ bold (1.4.3); the parts of controls needed to see them (an input's border when it has no fill), icons that carry meaning and focus indicators under 3:1 against what is next to them (1.4.11). Check both themes and every state. Disabled controls are exempt but must still read as disabled.
- Meaning carried by colour alone (1.4.1). Errors, success, the current item, required fields and chart series also differ by text, icon, shape or position, so they survive colour blindness and greyscale.
- No visible focus. Every control shows a focus indicator when reached by keyboard (2.4.7), at 3:1 against what is next to it (1.4.11), and sticky headers or footers never hide it entirely (2.4.11). *House rule:* never cover it at all (as 2.4.12, AAA), with a ring of 2px or more (as 2.4.13, AAA).
- An action that only works by dragging (2.5.7). Give it a tap or click alternative.

### Reflex: fix, or waive in the contract with one line

- Metadata joined by middle dots ("Report · 3 pages · Edited today"). Use commas, a sentence, or space between groups.
- Glow, halo, radial spotlight, coloured zero-offset shadow, gradient text, purple-to-blue or cyan-on-dark gradients.
- More than 3 radius kinds or 1 shadow kind on a screen. Pill-shaped tags used as decoration.
- Pure #000 or #fff.
- Accent colour covering more than 5% of a viewport.
- Pulsing dots, blinking cursors, auto-scrolling, bounce easing, animated or rolling emoji. Anything that moves for more than 5 seconds needs a pause (WCAG 2.2.2).
- Monospace used as a costume for labels instead of for code, data or times.
- A caption that explains the picture next to it.
- A drawn fake interface where a real screenshot of the product exists.
- The same layout would fit any other product: template look, stock hero, generic icons in rounded tiles. Name one detail only this product would have.

### Controls

- One primary action per screen at most. Zero is fine when the content is the action.
- One style each for buttons, quiet text buttons and icon buttons. No fourth.
- A button does something; a text link with a chevron goes somewhere. Two different kinds of interaction never share a look.
- Pick icon-only (with an accessible label) for universal symbols such as close, back and sound, and text-only for everything else. Never icon, text and tooltip on one control. *House rule:* a toolbar of many tools may pair icon and text, and say so in the contract.
- Hide what is used later in the flow (share, export, secondary settings) and reveal it when it becomes useful, where the eye already is, and always before the moment people need it. Navigation and help keep the same relative order on every screen (WCAG 3.2.3, 3.2.6).
- While the user is in the main task, chrome sits at the edges and stays small. Nothing floats over the content they are working on.

### Labels

- Buttons are a verb plus an object, 1 to 3 words. No "Submit", "OK" or "Learn more".
- Headings name the thing, not the feeling.
- Status is a fact with a number: "2 left", not "You still have some remaining".
- Use sentence case. No exclamation marks, "Oops", em dashes or arrow chains in interface copy.
- One term per concept across the product. Keep a word list.
- Each language mode is complete on its own and uses its own punctuation.
- Remove a word. If the meaning does not change, leave it out. Repeat.

### Accessible colour

- Pick the accent and state colours by contrast first, hue second. Where a brand colour fails on the ground, use a darker or lighter step of it for text and keep the original for large fills.
- Red and green never sit side by side as the only difference between two states. Test the palette with a deuteranopia and protanopia simulation (browser dev tools can emulate both).
- Text on photos, video, canvas or gradients sits on a scrim that brings it to 4.5:1 at its worst spot. The structural check cannot measure these, so check them by eye at the darkest and lightest frame.
- Placeholder text is not a label, and still needs 4.5:1 if it carries information.
- Respect `prefers-contrast: more` and forced-colours modes: borders that only exist as shadows disappear in forced colours, so give important outlines a real border.

### Dark surfaces

In dark mode a raised surface is one step lighter than the ground. Use no shadows; separate with a lighter surface or a 1px inset line. Keep muted text at 4.5:1 or more (AA). *House rule:* body text at 7:1 (AAA), in both themes. Never invert the light palette mechanically.

### Generated and decorative graphics

Generative art, textures and illustrations are content, so they must carry information about the product: its place, material or data. If an image would fit any other product, cut it. Prefer one strong key visual to many small decorative ones.

## 4. Decide, then cut

For each screen, list every element and string with its one job, and mark it keep, merge, cut or rewrite. Work in this order: cuts, then merges, then rewrites, then visual polish. Never polish something you are about to cut. Leave alone anything that already passes. Do not change the brand palette, fonts or core art unless they are themselves slop.

## 5. Build it so it sticks

- Put each pass's CSS in one commented block named for the round, placed after the stylesheets it overrides. If later stylesheets win on specificity, give the block a stronger selector prefix instead of adding `!important` everywhere.
- A `//` comment added in the middle of a line comments out the rest of that line. Use `/* */` mid-line, and run a syntax check after editing.
- Run the product's own tests. Every flow must still be completable by someone who has never seen the product, using only what is on the screen.

## 6. Prove it

1. Run the structural check and the screenshots again. Report the before and after counts per screen: words, controls, font sizes, radii, small text, caps, middle dots, stripes, dividers, nesting, contrast.
2. Look at every after screenshot yourself. A fix often exposes a new collision, such as a caption that now wraps onto the line above. Fix it in the same pass.
3. Make a before/after board: the live version beside the new build, at desktop and phone sizes, with one short line per change.
4. A score is optional outside the loop and costs one agent per reviewer: say so and ask before running any. Scores come only from fresh reviewers who have never seen the product, sized to the change as in [references/review-rubric.md](references/review-rubric.md). Never report a score you gave yourself.
5. **Home gate (new products).** One fresh `deslop-juror` in gate mode (give it the word "gate") looks only at the first screen, on desktop and phone, and answers `ship` or `fix` with at most 5 one-line findings, worst first. Build other pages only after `ship`.

## Grading loop (only when the user turned it on)

Inputs, asked in the same message as the loop question: the target score (default 8.5), the round limit (default 6), jurors per round (default 10; 3–4 for a small change), the URL (local or staging), a test account or a Playwright storage-state file if screens sit behind a sign-in, one sentence on what the product is and who it is for, 3–12 units to score with a short name each, and the expert for lens 6. Then run without asking again until a stop. Work in `deslop-review/` at the product root, and commit the product's code at the end of every round with the round number in the message, one commit per unit changed, so a unit can be reverted on its own.

Each round, with `R` the round folder (`deslop-review/round-N`):

1. Check. Run the structural check for each screen into the round folder, naming the units it covers and passing the contract's waivers:
   `node "$SKILL/scripts/structure-check.mjs" URL --units NAV,HERO --waive tinyCaps --out R/check-home-desktop.json`, again with `--phone`, and with `--dark` if the product has a dark theme. A unit on a screen that fails the Floor is capped at 7.0.
2. Score. Start 10 new `deslop-juror` agents in parallel, one per lens, each with only: the URL, the test account if any, the product sentence, the units, its lens, the absolute path of `$SKILL` (for `values.md` and the scripts), and the absolute path of its output file `R/juror-NN.json`. Never resume a juror; never tell one about earlier rounds. If the `deslop-juror` agent type is not installed, start a general-purpose agent with the body of `$SKILL/agents/deslop-juror.md` as its instructions; the same for the Oracle.
3. Aggregate. `node "$SKILL/scripts/aggregate.mjs" R deslop-review/round-(N-1) --units NAV,HERO,... --target T --round N --max-rounds M` (leave out the previous folder in round 1). It skips unit names that are not in `--units`, invalid scores and failed jurors, and says why. Rerun each skipped juror once, as a new agent. A unit needs scores from at least half the jurors, and at least 3; until then the decision is never `target-reached`, and `thin` lists the unit.
4. Brief. Start one `deslop-oracle` agent with the round folder, `$SKILL/references/values.md`, and the path of `DESIGN.md` if there is one. It writes `R/brief.md`.
5. Decide, from `decision` in `summary.json`:
   - `continue`: revert the last change to any unit in `regressions`, apply the fixes in `brief.md` and nothing else (following step 5's build rules), then start the next round.
   - `target-reached` or `max-rounds`: stop and report the scores.
   - `plateau`: stop and show the user the Oracle's 2–3 bolder directions. If they pick one, build it and start a new series in `deslop-review/direction-K/round-1`, with K = 2 for the first plateau, 3 for the next. Round numbers, the round limit and the plateau count start again; round 1 of a series has no previous folder.

Report only aggregated juror scores; never score your own work. The full protocol, lenses and file layout are in [references/grading-loop.md](references/grading-loop.md); the agent definitions are in `agents/`.

## Video and motion

The same rules apply to product films and motion graphics. See [references/video.md](references/video.md).
