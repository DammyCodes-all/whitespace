# Design direction

Status: agreed direction, Oct 5. Owner: U. Source of truth for how Whitespace looks and feels.

The spec is silent on visual design. That makes this document the source of truth instead. Where a choice exists to serve a behavior the spec *does* define, the section is cited. If a screen change contradicts this file, change this file first.

One-line read: **this product is an instrument, not a wizard.** Its pitch is "we don't make things up" (§1, §2), so it should look like a lab report rather than a SaaS landing page.

---

## 1. Feel

| Principle | Ties to |
|---|---|
| **Measured, not magical.** The run (§5.4) is a protocol executing, not a genie thinking. Steps get timestamps and counts, e.g. "21 titles checked · 19 found · 2 not found", set in mono. No sparkle, no typing dots, no shimmer. | §5.4, §6.12 |
| **Skepticism is the brand.** The loudest styling goes to the surprise ("Your best fit is not the audience you named") and the refusal (a withheld change). Those are the two moments no other hackathon entry will have. Never style the happy path loudly. | §6.7, §6.9 |
| **Absence is a first-class visual state.** Three states, not two: measured-high, measured-low, unmeasured. No-data gets texture plus a dashed border plus never a number. System rule, not a per-screen decision, so "no data" never quietly ships as a zero. | §6.6, App. B |
| **Links look like citations, not buttons.** Superscript markers, a 24px minimum touch target, and an underline on hover and focus; on touch, the hit area remains visible without relying on hover. Opens a drawer with the request and response in mono. | §6.12 |
| **Paper, not neon.** Light-first, warm neutral, no shadows, no glass, no gradients. Judges use the demo on their own screens, and the output is a printable one-pager. The print stylesheet is a free win. | §6.10, §9 |
| **One accent, spent only on measurement.** The accent means "this value was measured." Everything else is neutral. Inconclusive and withheld get no accent at all, because an honest "I don't know" must not be tinted like a result. | §6.7 |

Motion, briefly: fit scores counting up at ~200ms with no bounce, the ranked list re-ordering with FLIP so the margin change is visible, and the control line sliding if it moves. Nothing else animates.

## 2. The one graphic that is the product

A horizontal bar per audience, with a vertical hairline across all of them marking the control ceiling, labeled in the margin. The app's whole argument is §6.7, "clears control", so render that comparison as a single object rather than a number plus a sentence. If the bar stops at the line, that is the thesis in one image.

## 3. Color

Light is primary. Three neutrals, one accent, two semantics, one texture for absence.

```css
/* light, "paper" */
--paper:         #F7F6F2;   /* canvas */
--surface:       #FFFFFF;   /* cards, the case page */
--rule:          #E2DFD6;   /* hairlines, borders */
--ink:           #191814;   /* 16.4:1 on paper */
--ink-2:         #56534A;   /*  7.1:1  secondary */
--ink-3:         #6E6B60;   /*  4.9:1  labels; the readable-text floor */
--measured:      #0E6A5F;   /*  6.0:1  THE accent, teal */
--measured-soft: #DCEAE7;   /*  5.2:1 for measured text on this fill */
--split:         #8F5E12;   /*  5.1:1  ochre */
--weak:          #6E6B60;   /*  4.9:1  deliberately the same as ink-3 */
--nodata-bg:     #EDEBE4;   /* plus a 45 degree hatch in #C9C5B8, 4px pitch */
--clay:          #8A5636;   /*  5.6:1  "not found in Qloo" only */
```

Verdict to state mapping:

| Verdict | Token | Why |
|---|---|---|
| Strong fit | `--measured` | The one win the product offers |
| Split | `--split` | Genuinely ambiguous, not an error |
| Weak fit | `--ink-3`, no accent | Measured, and it is low, so it recedes. Red here would punish the product for telling the truth. |
| Inconclusive | no hue, dashed rule, hatched fill | Must never be confusable with Weak. Weak means "we measured and it is low" (§6.7); Inconclusive means "we could not measure" (App. B). These two are the top thing to keep visually distinct. |

Deliberately absent: red as an error color, purple and indigo gradients, green success checkmarks, orange warnings. If the only saturated color on screen is the teal number that cleared the bar, the eye lands there on a projector.

Optional dark mode, if there is time:

```css
--paper: #131311; --surface: #1B1B18; --rule: #2C2B27;
--ink: #EDEBE4;   /* 15.6:1 */
--ink-2: #A5A196; /*  7.2:1 */
--ink-3: #8A8578; /*  5.1:1 */
--measured: #4FBFAE;  /* 8.3:1 */
--split:    #D9A441;  /* 8.3:1 */
```

Note `--ink-3` moves to `#8A8578` in dark, not `#7A7669`: that one is 4.1:1 on the canvas and fails at surface level. Ship light-only and spend the time on the print stylesheet instead if the schedule is tight.

## 4. Fonts

**Instrument Serif + Instrument Sans + IBM Plex Mono.** All three are on Google Fonts, so `next/font/google` gives zero licensing friction, which matters on a 25-day sprint with three people.

- **Instrument Serif** — the verdict sentence, the audience name, the one-line idea on the case page. High-contrast editorial; it reads as criticism rather than startup. Its whole job is making the §6.10 one-pager look like something a filmmaker would be proud to hand a producer.
- **Instrument Sans** — all UI and body. A quiet grotesque with good numerals and enough quirk to not read as default.
- **IBM Plex Mono** — scores, ranks, coverage fractions, and the raw Qloo payloads in the evidence drawer. Institutional, reads as an actual API response rather than an IDE screenshot. When the chatbot's ungrounded output sits beside ours (§6.11), mono is what makes it *look* raw: same visual weight as our panel, visibly unprocessed. The comparison does its own work.

One typeface per function, no font doing two jobs.

Instrument Serif stays regular (and italic where needed); never request a heavier weight that would make the browser synthesize one. Use it for editorial display text at roughly 28px and up. Longer sentences stay in Instrument Sans. Scores use IBM Plex Mono, whose tabular numerals are explicit and reliable.

Fallback if we would rather have a single superfamily: IBM Plex Sans + Plex Serif + Plex Mono. Bulletproof and cohesive, less distinctive.

The Geist wiring that shipped with `create-next-app` has been removed. It read as an untouched scaffold in about half a second.

Two typographic rules that are functional rather than decorative:

1. `font-variant-numeric: tabular-nums` on every number, or scores jitter while a run streams.
2. Body and UI at 15 to 16px, generous leading, max measure around 68ch. The evidence drawer is the opposite: 13px mono, tight, scrollable.

## 5. Where this lives in code

Wired Oct 5. Do not re-declare these in a component.

| What | Where |
|---|---|
| Tokens, `--measured` and friends | `src/app/globals.css`, `:root` plus `.dark` |
| Tailwind utilities (`bg-paper`, `text-ink-3`, `border-rule`) | same file, `@theme inline` |
| Font variables | `src/app/layout.tsx` via `next/font/google` |
| `tabular-nums` on numbers | global, applied via `[data-numeric]` or `.tnum` |
| `.nodata` hatch utility | `globals.css`, `@layer utilities` |
| `.cite` evidence marker | `globals.css`, `@layer utilities` |
| Print rules | `globals.css`, `@media print` |

There is no automatic dark mode. `.dark` holds the optional dark values but nothing sets the class, because the design is light-first. Add a toggle only if a screen needs it.

### Responsive rules

- At the mobile breakpoint (`640px`), primary and secondary actions wrap as full-width or content-width rows; no action depends on hover.
- Ranked bars remain horizontal and use the full available width. The control line is `--ink`, 1.5px wide, so it remains a semantic mark at narrow widths.
- Citation markers retain a minimum 24px hit area even though their glyph is visually small.
- Evidence is a bottom sheet on mobile and an anchored drawer on larger screens; its mono request/response content scrolls independently.

No-data is always written as **“not measured”** alongside the hatch. The hatch is supporting texture, not the semantic signal. Meaning-carrying dashed borders use `--ink-3`; hairline rules remain decorative.

## 6. Rules for whoever builds a screen

- No screen renders a number for a value Qloo did not return enough to judge (§6.6).
- No verdict gets a color that a reader could mistake for another verdict.
- Every claim that shows a value has a citation marker next to it (§6.12).
- Anything printed must be legible in black on white with the accent removed (§6.10).

## Verification

Contrast ratios above were computed against `#F7F6F2` and `#131311`. Re-check any new pair before it ships; the readable-text floor is 4.5:1, and the values chosen for large text or hairlines are noted as such.
