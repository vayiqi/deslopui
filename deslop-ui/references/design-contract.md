# Design contract template

Save as `DESIGN.md` at the product root and mirror it as CSS custom properties on `:root`. Every screen, film frame and review checks against it.

## 1. Colour: name each token's job

| Token | How many | Job |
|---|---|---|
| ground / surface | 2–3 | Near-neutral, tinted slightly toward the brand hue. Never pure #000 or #fff. In dark mode a surface is one step lighter than the ground. |
| ink / muted | 2 | Body text at 7:1 or more. Muted only for labels, dates and metadata, at 4.5:1 or more. |

Write the measured contrast next to every text and control colour, on every ground it is used on, in both themes. AA minimums (WCAG 2.2): text 4.5:1, large text 3:1, controls, meaningful icons and focus rings 3:1. A pair that fails is not in the contract. State colours are paired with an icon or a word, never colour alone, and checked under colour-blindness simulation.
| brand | 1, at most 2 | Identity. |
| accent | 1 | Only the primary action, focus ring and current state. At most 5% of any viewport. |
| state | up to 3 | Success, warning, error. Only for state. |

## 2. Type

- One ramp of 5–6 steps, adjacent steps at least 1.25× apart where possible (for example 13 / 16 / 20 / 28 / 56).
- At most 4 sizes on one screen (logo excluded), at most 3 weights, at most 3 families (display, body, one utility).
- Monospace only for code, measurements and data.
- Nothing under 13px. Body text 16px or more, line height 1.5–1.7, line length 45–75 characters.
- Sentence case. No small caps or uppercase labels at 15px or smaller, no letter-spacing above 0.03em on small text.

## 3. Shape and depth

- Radii in 3 steps, for example 2 (paper and images), 8 (controls and panels), fully round (icon buttons only). No pill-shaped tags.
- At most 1 shadow: short offset, soft. None in dark mode.
- One spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. More space above a heading than below it.

## 4. Motion

One authored moment per screen, exponential ease-out, a `prefers-reduced-motion` fallback. No bounce, no auto-scroll, no pulsing dots. Anything moving for more than 5 seconds has a pause.

## 5. Waivers

One line each: the rule it breaks, the reason, where it applies. Example: "Serif display on a paper ground: printed-passport metaphor, whole product." A waiver without a reason is rejected. A rule waived three times becomes part of the contract.

## 6. References

2–3 real screenshots or wireframes for the builder: the product's own UI first, then admired products in the category. Reviewers never get them.
