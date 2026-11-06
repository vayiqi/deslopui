# Values

Twelve values behind every rule in this skill. When a rule does not cover a case, decide by these. Each value names its roots, what it looks like when it is met, a question to ask on any screen, and how to check it.

The values are our own synthesis. They draw on Apple's Human Interface Guidelines (clarity, deference, hierarchy, consistency), Dieter Rams' ten principles of good design, Jakob Nielsen's ten usability heuristics, the Laws of UX (Fitts, Hick, Jakob, Tesler, Doherty, peak-end, Von Restorff), Amber Case's calm technology, Microsoft's inclusive design and WCAG 2.2. Read the originals; this page is a working summary, not a quote.

## 1. Content first, chrome second

*Roots: HIG deference; Rams "unobtrusive"; calm technology.*

The thing people came for (the photo, the map, the document, the data) fills the screen. Controls sit at the edges, small and quiet, and step back while people work.

- Ask: if I hide every control, is the screen still mostly the content?
- Check: chrome covers at most about 20% of a viewport during the main task; nothing floats over the content being worked on.

## 2. Clear at a glance

*Roots: HIG clarity; Nielsen "aesthetic and minimalist design"; aesthetic-usability effect.*

A stranger knows what the screen is and what to do next within three seconds. Size, position and spacing say what matters; colour comes last.

- Ask: squint at the screenshot. What do you see first, second, third? Is that the right order?
- Check: one primary action; at most 4 type sizes; the squint order matches the task order.

## 3. As little design as possible

*Roots: Rams "less, but better"; Tesler's law of conserved complexity.*

Every element earns its place by doing a job most people need on this screen. Complexity that must exist is absorbed by the product, not pushed onto the person.

- Ask: what happens if I delete this? If nothing gets worse, delete it.
- Check: word and control budgets; no element without a named job.

## 4. Show the state of things

*Roots: Nielsen "visibility of system status"; Doherty threshold.*

People always know where they are, what just happened and what is happening now. Feedback arrives within 400 ms; anything slower shows progress.

- Ask: after every tap, can I tell it worked without guessing?
- Check: every action has visible feedback; current location is marked once; loads over 400 ms show progress.

## 5. Speak the person's language

*Roots: Nielsen "match between system and the real world"; Rams "understandable".*

Labels use the words people already use, in sentence case, in the order they think. No system terms, no internal names, no clever puns that cost a second.

- Ask: would someone outside the team say this word?
- Check: one term per concept; buttons are verb plus object; status is a fact with a number.

## 6. Consistent and familiar

*Roots: HIG consistency; Nielsen "consistency and standards"; Jakob's law.*

People spend most of their time in other products. Use the patterns they know, and keep one look per kind of thing inside the product.

- Ask: does anything here behave differently from how it looks, or from the same thing elsewhere in the product?
- Check: one button, link, card and radius style; a button acts, a link with a chevron navigates; no two kinds of interaction share a look.

## 7. Recognition over recall

*Roots: Nielsen "recognition rather than recall"; Hick's law.*

Show options instead of asking people to remember them. Keep choices few and grouped; decision time grows with every option.

- Ask: do I need to remember anything from a previous screen to act on this one?
- Check: *house heuristic*, at most about 7 visible choices per group; options are labelled in place, not explained in a separate help screen.

## 8. Forgiving

*Roots: Nielsen "user control and freedom", "error prevention", "help users recover from errors".*

People can undo, go back and leave without penalty. Mistakes are prevented by design; when they happen, the message says what went wrong and the one next step.

- Ask: what is the worst thing a slip of the finger can do here, and can it be undone?
- Check: destructive actions are confirmable or undoable; error text names the problem and the fix in one line, with no blame and no "Oops".

## 9. Easy to hit, easy to reach

*Roots: Fitts's law; HIG touch targets.*

Important targets are large and near where the hand or pointer already is. Small, distant or crowded targets are reserved for rare actions.

- Ask: on a phone held in one hand, can I reach the main action with my thumb?
- Check: targets at least 24 by 24 px (WCAG 2.5.8); house rule 44 by 44 px on touch screens with 8 px between adjacent targets; the primary action sits in the reachable zone on phones.

## 10. Honest

*Roots: Rams "honest"; dark-pattern research.*

The interface never pretends: no fake urgency, no hidden costs, no pre-ticked consent, no drawn mock-up where a real screenshot exists, no claims the product cannot back.

- Ask: would I be comfortable if the person saw exactly how this screen was designed to influence them?
- Check: prices and conditions appear before commitment; no countdowns that reset; opt-outs are as easy as opt-ins.

## 11. Made for everyone

*Roots: Microsoft inclusive design ("solve for one, extend to many"); WCAG 2.2.*

Design for the edges and the middle benefits: low vision, colour blindness, one hand, slow networks, screen readers, other languages.

- Ask: does this still work with the screen in greyscale, at 200% zoom, with a keyboard only, in the longest language?
- Check: AA contrast; meaning never by colour alone; visible focus; text resizes to 200% (1.4.4) and reflows at 320 px wide (1.4.10); every control has an accessible name.

## 12. Careful to the last detail

*Roots: Rams "thorough down to the last detail"; peak-end rule; Von Restorff effect.*

Care shows in the parts few people notice: alignment, empty states, error states, loading, the moment of success. People remember the peak and the end, so the finish of a task deserves the most craft. Make the one thing that matters stand out, and only that.

- Ask: have I looked at the empty, loading, error and success states as carefully as the main one?
- Check: every state screenshotted and reviewed; one distinctive moment per flow, at its end; nothing else competes with it.

## Using the values

- **When rules conflict**, the lower-numbered value wins, except that 11 (made for everyone) is never traded away.
- **Jurors** cite a value number with each fix when it applies ("V4: no feedback after saving"), so the Oracle can group fixes by cause.
- **The Oracle** prefers fixes that serve more than one value, and drops fixes that would break one.
