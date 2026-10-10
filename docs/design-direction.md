# Design direction

Status: agreed direction, Oct 10. Replaces the Oct 5 "instrument" direction. Owner: U. Source of truth for how Whitespace looks and feels.

The spec is silent on visual design, so this document fills the gap. Where a choice serves a behavior the spec does define, the section is cited. If a screen change contradicts this file, change this file first.

One-line read: this product is a sharp-eyed friend with opinions. It is not a lab and it is not a wizard. The pitch is "we don't make things up" (§1, §2), so the playfulness goes into the look and the voice, and the honesty goes into the rules below. The rules are not negotiable. The look is.

---

## 1. Feel

| Principle | Ties to |
|---|---|
| Loud on color, strict on meaning. Big flat color blocks, but every color means exactly one thing. Mint is a strong fit. Nothing is colored for decoration. | §6.7 |
| Surprise gets the stage. The loudest block on any screen is "Your best fit is not the audience you named": full width, coral, biggest type. The refusal (a withheld change) is second loudest, in solid ink. The happy path stays in the calmer colors. | §6.7, §6.9 |
| Absence stays visible. Three states, not two: measured-high, measured-low, not measured. Not measured gets a hatch, a dashed border, the words "not measured", and never a number. This is a system rule so that "no data" never quietly ships as a zero. | §6.6, App. B |
| Runs show real work. A step appears when it actually finishes, with its counts: "21 titles checked, 19 found, 2 not found". Friendly pills, no fake progress bar, no typing dots. | §5.4, §6.12 |
| Links look like citations. A small numbered dot sits next to every claim, with a 24px minimum touch target and an underline on hover and focus. On touch the dot stays visible without hover. Tapping opens a drawer with the request and response in mono. | §6.12 |
| Chunky but flat. 2px ink outlines, rounded corners, and a hard offset shadow with no blur on cards and primary buttons. No glass, no gradients, no glow. | §6.10 |
| Light first. Soft off-white canvas, pure white cards. Judges use the demo on their own screens, and the output is a printable one-pager, so the print stylesheet is a free win. | §6.10, §9 |

Voice: plain words, short sentences, contractions, a bit of attitude. "Here's who it's actually for." The one place the attitude stops is uncertainty. Say "not measured", never "hmm, couldn't find that!". A joke about missing data reads as a dodge.

Motion is short. Bars grow from zero over about 300ms with ease-out when a result lands. Fit scores count up over about 200ms. The ranked list re-orders with FLIP so the margin change is visible, and the control line slides if it moves. The surprise block pops in from 96% scale over 220ms. Nothing else animates, and a not-measured state never animates into a number. Everything goes still under `prefers-reduced-motion`.

## 2. The one graphic that is the product

A horizontal bar per audience, with a vertical line across all of them marking the control ceiling, labeled in the margin. The app's whole argument is §6.7, "clears control", so the comparison is one object instead of a number plus a sentence. If the bar stops short of the line, that is the thesis in one image.

Bars are 28px tall with a 2px ink outline and fully rounded ends. The fill is the verdict color. The control line is solid ink, 2.5px, with a small pill at the top reading "control". It is never dashed, because dashes are reserved for not measured.

## 3. Color

Light only. Four neutrals, four verdict fills, two text-safe colors, one texture for absence.

```css
:root {
  --paper:    #F7F7F4;  /* canvas, a soft off-white */
  --surface:  #FFFFFF;  /* cards, the case page */
  --outline:  #17151F;  /* chunky 2px borders, same value as ink */
  --rule:     #E9DEC6;  /* decorative hairlines only */
  --ink:      #17151F;  /* 16.8:1 on paper */
  --ink-2:    #4A4658;  /*  8.5:1 secondary */
  --ink-3:    #625E75;  /*  5.8:1 labels, the readable-text floor */

  /* verdict fills, ink text on all of them */
  --strong:   #5FE3A1;  /* mint,   11.2:1 with ink */
  --split:    #FFCB3D;  /* yellow, 11.9:1 */
  --weak:     #C4D8F5;  /* soft blue, 12.5:1 */
  --surprise: #FF6B4A;  /* coral,   6.4:1 */

  /* text-safe versions, for when a verdict color has to be text on paper */
  --measured: #0A6B47;  /* 6.1:1 on paper */
  --split-ink:#8A5A00;  /* 5.5:1 on paper */

  --nodata-bg:#EEECE6;  /* ink-3 text on it is 5.3:1 */
  --clay:     #8A4B2D;  /* 6.3:1, "not found in Qloo" only */
}

.nodata {
  background-color: var(--nodata-bg);
  background-image: repeating-linear-gradient(45deg, #C9C6BC 0 1px, transparent 1px 4px);
  border: 2px dashed var(--ink-3);
}
```

| Verdict | Treatment | Why |
|---|---|---|
| Strong fit | `--strong` fill | The one win the product offers |
| Split | `--split` fill | Genuinely ambiguous, not an error |
| Weak fit | `--weak` fill | Measured, and it is low, so it gets the quietest color. Red here would punish the product for telling the truth. |
| Inconclusive | `.nodata`, no fill color | Must never be confusable with Weak. Weak means "we measured and it is low" (§6.7). Inconclusive means "we could not measure" (App. B). Keep these two visually apart above everything else. |
| Surprise | `--surprise` block | A finding, not a verdict. It only appears as the banner. |
| Withheld | solid `--ink` block, paper text | A refusal (§6.9). |

Color never carries a verdict alone. Every verdict wears its word, because mint, yellow and soft blue sit close in brightness and collapse together in grayscale print.

Deliberately absent: red as an error color, purple or indigo gradients, glow effects, green success checkmarks, orange warnings. An error is a plain sentence in a card with an ink outline.

No dark mode. If the schedule is tight, the time goes to the print stylesheet.

Print: fills drop to white, outlines stay, shadows go, the hatch stays, and the verdict word does the work the color did on screen. The case page fits on one sheet.

## 4. Fonts

Bricolage Grotesque, Figtree and IBM Plex Mono. All three are on Google Fonts, so `next/font/google` gives zero licensing friction on a 25-day sprint with three people.

- Bricolage Grotesque: headlines, the verdict sentence, audience names, the surprise banner, and the one-line idea on the case page. Use weights 600 to 800 at 28px and up, with tight leading. It has attitude without turning into a gimmick.
- Figtree: all UI and body text at 15 to 16px, leading around 1.5, measure capped near 68ch.
- IBM Plex Mono: every number that changes while a run streams, coverage fractions, and the raw Qloo payloads in the evidence drawer (13px, tight, scrollable). Request 400 and 500 and nothing heavier. Its tabular numerals are explicit and reliable, so streaming scores don't jitter. A final score that no longer updates, such as the hero number on the case page, can be set in Bricolage at display size.

When the chatbot's ungrounded output sits next to ours (§6.11), mono makes it look raw: same weight as our panel, visibly unprocessed. Our side is colored and labeled, theirs is plain text with no citations, and the comparison makes the point on its own.

One typeface per function. If Bricolage feels too quirky once real screens exist, drop it from everything except the surprise banner and the case page title, and let Figtree carry the rest.

## 5. Where this lives in code

Wired Oct 5, changed Oct 10. Do not re-declare any of this in a component.

| What | Where |
|---|---|
| Tokens, `--strong` and friends | `src/app/globals.css`, `:root` (the `.dark` block can go) |
| Tailwind utilities (`bg-paper`, `text-ink-3`, `border-rule`, `bg-strong`) | same file, `@theme inline` |
| Font variables | `src/app/layout.tsx` via `next/font/google`, replacing the Instrument trio |
| `.card`, `.nodata`, `.cite` | `globals.css`, `@layer utilities` |
| Print rules | `globals.css`, `@media print` |

Token names from the Oct 5 wiring are kept so existing utilities keep working, but a few changed meaning:

- `--measured` is now the dark green text color. It used to be the teal accent.
- `--strong` is new and is the mint fill. Anything that used `bg-measured` as a fill needs `bg-strong`.
- `--split` and `--weak` are fills now. Use `--split-ink` when a verdict color has to be text.
- `--measured-soft` is gone. `--outline` and `--surprise` are new.

The card and button shape, so nobody improvises it:

```css
.card {
  background: var(--surface);
  border: 2px solid var(--outline);
  border-radius: 16px;
  box-shadow: 4px 4px 0 var(--outline);
}
/* primary buttons use the same shape, and on :active they translate(2px, 2px)
   while the shadow shrinks to 2px 2px 0 */
```

### Responsive rules

- At the mobile breakpoint (`640px`), primary and secondary actions wrap as full-width or content-width rows, and no action depends on hover.
- Ranked bars stay horizontal and use the full available width. The control line stays solid ink at 2.5px so it still reads as a mark at narrow widths.
- Citation dots keep a 24px hit area even though the glyph is small.
- Evidence is a bottom sheet on mobile and an anchored drawer on larger screens. Its mono request and response content scrolls independently.

No-data is always written as "not measured" next to the hatch. The hatch is supporting texture, and the words are the signal. The dashed border uses `--ink-3` and carries meaning, while hairline rules stay decorative.

## 6. Rules for whoever builds a screen

- No screen renders a number for a value Qloo did not return enough to judge (§6.6).
- No verdict gets a color that a reader could mistake for another verdict, and every verdict carries its word.
- Every claim that shows a value has a citation dot next to it (§6.12).
- Anything printed must be legible in black on white with every fill removed (§6.10).

## Verification

Contrast ratios above were computed against the listed backgrounds. Re-check any new pair before it ships. The floor for readable text is 4.5:1, and the hatch and hairlines are decorative, so they are exempt.
