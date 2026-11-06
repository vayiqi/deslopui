---
name: deslop-ui
description: Remove the machine-made look from a product UI by subtraction, measured against a written design contract. Use for a de-slop, taste or "looks AI-generated" pass on a live site or app, or before building a new product's first screens.
---

# Deslop UI

The job is subtraction. A pass is judged by what it removes while a stranger still understands each screen in three seconds. Never fix confusion by adding tooltips, coach marks, "?" buttons, helper text or features. Remove whatever causes it.

**Before you start, ask the user one question: run the grading loop or not?** The loop adds 10 blind expert jurors and an Oracle each round and repeats until a target score or a plateau, so it costs many times a single pass. If yes, also ask for the target score (default 8.5) and the round limit (default 6). If no, do a single pass and stop after step 6. Ask every time; never turn the loop on by default.

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
node scripts/structure-check.mjs https://example.com/app --phone --out before.json
```

The script reads computed styles, not source code. Products with many stylesheets often override what the source says. The script finds candidates; you decide what to change.

## 3. Hold the rules

### Structure: none allowed

| Pattern | Rule |
|---|---|
| Control inside a control | One tap target per region. A card that opens something has no separate "Open" button. |
| Chip inside a chip, pill inside a pill | A bar of buttons is one frame with no inner dividers. A segmented control shows its state with a light thumb, not a dark chip inside a pale track. |
| Box inside a box | At most two levels of framing. Content can sit directly on the page. |
| One-side colour stripe | No coloured edge on the current row, a warning or a card. Show state once, by fill or text colour. |
| Divider rules | Only between different kinds of content. Never inside a row of icons or numbers; use space. |
| Two controls, one job | A back arrow and a "Back" button, or a "?" in the toolbar and another in the card: keep one. |
| A fact said twice | Once per screen. A count shown as icons, as a number and as a sentence is three times. |
| Feature blocks stacked | No row of three equal feature cards, no grid of identical cards where a list or the content itself would do. One idea per section. |

### Floor: blocks shipping

- Colour, font size, radius or family that is not in the contract.
- Uppercase, small caps or letter-spacing above 0.03em on text 15px or smaller, unless a written waiver covers it.
- An eyebrow or kicker that only announces the heading below it.
- Emoji used as an icon.
- Interface text over budget. At first view, phone screens allow 25 words and 5 controls, desktop screens 40 words and 7 controls. The content itself (a map, a 3D scene, a list) does not count.
- Instructions cut off by an ellipsis. Instructions wrap; only names and metadata may truncate.
- Touch targets under 44px, even when the visible mark is smaller.
- Colour contrast below WCAG 2.2 AA: text under 4.5:1 (3:1 for 24px+, or 18.66px+ bold), and controls, input borders, icons that carry meaning and focus rings under 3:1 against what is next to them. Check both themes and every state (hover, pressed, disabled is exempt but must still read as disabled).
- Meaning carried by colour alone. Errors, success, the current item, required fields and chart series also differ by text, icon, shape or position, so they survive colour blindness and greyscale.
- No visible focus. Every control shows a focus ring of 2px or more at 3:1 contrast when reached by keyboard.

### Reflex: fix, or waive in the contract with one line

- Metadata joined by middle dots ("Paris · 14:02 · Raining"). Use commas, a sentence, or space between groups.
- Glow, halo, radial spotlight, coloured zero-offset shadow, gradient text, purple-to-blue or cyan-on-dark gradients.
- More than 3 radius kinds or 1 shadow kind on a screen. Pill-shaped tags used as decoration.
- Pure #000 or #fff.
- Accent colour covering more than 5% of a viewport.
- Pulsing dots, blinking cursors, auto-scrolling, bounce easing, animated or rolling emoji. Anything that moves for more than 5 seconds needs a pause.
- Monospace used as a costume for labels instead of for code, data or times.
- A caption that explains the picture next to it.
- A drawn fake interface where a real screenshot of the product exists.
- The same layout would fit any other product: template look, stock hero, generic icons in rounded tiles. Name one detail only this product would have.

### Controls

- One primary action per screen at most. Zero is fine when the content is the action.
- One style each for buttons, quiet text buttons and icon buttons. No fourth.
- A button does something; a text link with a chevron goes somewhere. Two different kinds of interaction never share a look.
- Pick icon-only (with an accessible label) for universal symbols such as close, back and sound, and text-only for everything else. Never icon, text and tooltip on one control.
- Hide what is used later in the flow (share, settings, info) and reveal it when it becomes useful, where the eye already is.
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
- Text on photos, video, 3D scenes or gradients sits on a scrim that brings it to 4.5:1 at its worst spot. The structural check cannot measure these, so check them by eye at the darkest and lightest frame.
- Placeholder text is not a label, and still needs 4.5:1 if it carries information.
- Respect `prefers-contrast: more` and forced-colours modes: borders that only exist as shadows disappear in forced colours, so give important outlines a real border.

### Dark surfaces

In dark mode a raised surface is one step lighter than the ground. Use no shadows; separate with a lighter surface or a 1px inset line. Keep body text at 7:1 contrast and muted text at 4.5:1 or more. Never invert the light palette mechanically.

### Generated and decorative graphics

Generative art, textures and illustrations are content, so they must carry information about the product: its place, material or data. If an image would fit any other product, cut it. Prefer one strong key visual to many small decorative ones.

## 4. Decide, then cut

For each screen, list every element and string with its one job, and mark it keep, merge, cut or rewrite. Work in this order: cuts, then merges, then rewrites, then visual polish. Never polish something you are about to cut. Leave alone anything that already passes. Do not change the brand palette, fonts or core art unless they are themselves slop.

## 5. Build it so it sticks

- Put each pass's CSS in one commented block named for the round, placed after the stylesheets it overrides. If later stylesheets win on specificity, give the block a stronger selector prefix instead of adding `!important` everywhere.
- A `//` comment added in the middle of a line comments out the rest of that line. Use `/* */` mid-line, and run a syntax check after editing.
- Run the product's own tests. Every flow must still be completable by someone who has never seen the product, using only what is on the screen.

## 6. Prove it

1. Run the structural check and the screenshots again. Report the before and after counts per screen: words, controls, font sizes, radii, small text, caps, middle dots, stripes, dividers, nesting.
2. Look at every after screenshot yourself. A fix often exposes a new collision, such as a caption that now wraps onto the line above. Fix it in the same pass.
3. Make a before/after board: the live version beside the new build, at desktop and phone sizes, with one short line per change.
4. Get a score only from fresh reviewers who have never seen the product. Give them nothing but the URL, one sentence on what the product is, the rubric and the output format. See [references/review-rubric.md](references/review-rubric.md). Never report a score you gave yourself.
5. **Home gate (new products).** One fresh reviewer looks only at the first screen, on desktop and phone, and answers `ship` or `fix` with at most 5 one-line findings, worst first. Build other pages only after `ship`.

## Grading loop (only when the user turned it on)

Repeat until every unit reaches the user's target score, the overall score moves by 0.2 or less two rounds in a row, or the round limit is hit:

1. Run the structural check.
2. Start 10 new `deslop-juror` agents in parallel, one per expert lens, each blind: URL, product sentence, units and lens only.
3. Run `node scripts/aggregate.mjs round-N round-(N-1) --target T --round N` to get trimmed means, unit scores and the decision.
4. Start a `deslop-oracle` agent on the round folder. It merges and ranks the fixes into `brief.md`, or proposes 2–3 bolder directions on a plateau.
5. Apply the brief with steps 4–5 of this method, then start the next round with new jurors.

On a plateau, stop and let the user pick a direction. Report only aggregated juror scores. The full protocol, lenses and file layout are in [references/grading-loop.md](references/grading-loop.md); the agent definitions are in `agents/`.

## Video and motion

The same rules apply to product films and motion graphics. See [references/video.md](references/video.md).
