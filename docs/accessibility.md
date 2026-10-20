# Accessibility audit — run and result surfaces

Date: 2026-10-20. Scope: the landing entry, both run paths (`/flow` and
`/run`), the shared result view, the verdict card, reach cards, the
evidence drawer, and the recorded sample page. This is a focused pass,
not a full WCAG audit of every route.

## Fixed

### Contrast

| Surface | Before | After | Ratio |
|---|---|---|---|
| Surprise verdict label (`flow-result-view.tsx`) | white 12px on coral `#f76743` | ink `#17151f` on the `--surprise` token `#ff6b4a` | **6.41:1** |
| Reach footer (`reach.tsx`) | white on yellow `bg-split` `#ffcb3d` | ink on yellow | **11.91:1** |
| Reach gap notes and step labels (`reach.tsx`) | `ink-3` on mint/yellow/soft-blue fills | ink on every fill | **11.2–12.5:1** |
| Tag `[pitch]` badge (`tag-chips.tsx`) | `ink-3` on mint `bg-strong` | ink on mint | **11.16:1** |
| Demo surprise swatch (`design-system-data.ts`) | paper on coral `#ff6b4a` | ink on coral | **6.41:1** |
| Verdict meaning | colour alone in the old specimen | the word always travels with the fill | n/a |

The verdict fill is now a token (`bg-surprise`), not a one-off hex. The
word remains present in every verdict state, so mint, yellow, blue and
coral are not the only carrier of meaning. The global `:focus-visible`
ring is still 2px `--measured` on paper (6.1:1).

### Focus and announcements

| Surface | Before | After |
|---|---|---|
| Landing pitch (`entry-box.tsx`, `flow-entry.tsx`, `flow-input-step.tsx`) | `focus:outline-none` removed the only focus ring | the global 2px `--measured` ring is back |
| Stepped flow (`flow-client.tsx`) | a phase change replaced the screen silently | focus moves to the input, tags, or running `h1`; the result focuses its visible verdict `h2` |
| Orb run (`leg-results.tsx`) | the result repainted while focus stayed on a removed control | the visible verdict `h2` receives focus |
| Run errors (`orb-flow.tsx`) | the same failure rendered as a polite status and an alert | one alert; an interruption is a polite status |
| Loaders (`loading-state.tsx`) | the 100ms timer sat inside live regions | the timer is `aria-hidden`; the label is announced once |
| Running steps (`flow-running-step.tsx`) | dead `[e]` anchors and no progress announcement | dead anchors removed; the ordered list is a polite live region |
| Headings | `/run`, `/demo/run`, and `/demo/result` had no `h1`; reach cards had no heading | page `h1` on each; recorded idea is `h2`; FlowResultView uses audience `h4` and slot `h5`; the demo reach plan uses group `h3` and kind `h4` |
| Skip link | `#main-content` targets were not programmatically focusable | every route `main` has `tabIndex={-1}` |
| Evidence (`flow-evidence-block.tsx`, `evidence-panel.tsx`) | raw responses were nested scroll boxes with no keyboard entry | responses expand with the page, so all text stays reachable |
| Idea card (`idea-card.tsx`) | unnamed section on `/run`; no control relation | fallback "The idea" label and `aria-controls` on See more |
| Tag count (`tag-chips.tsx`) | title gifts were subtracted from the pitch-tag count, hiding "not found" | pitch tags and title gifts are counted separately |

## Checked pairs

| Foreground | Background | Ratio | Use |
|---|---|---:|---|
| `#17151f` ink | `#f7f7f4` paper | 16.8:1 | body text |
| `#4a4658` ink-2 | paper | 8.5:1 | secondary text |
| `#625e75` ink-3 | paper | 5.8:1 | labels / floor |
| `#17151f` ink | `#5fe3a1` strong | 11.2:1 | verdict |
| `#17151f` ink | `#ffcb3d` split | 11.9:1 | verdict / gaps |
| `#17151f` ink | `#c4d8f5` weak | 12.5:1 | verdict |
| `#17151f` ink | `#ff6b4a` surprise | 6.4:1 | surprise verdict |
| `#0a6b47` measured | paper | 6.1:1 | measured text |
| `#8a5a00` split-ink | paper | 5.5:1 | split text |
| `#8a4b2d` clay | paper | 6.3:1 | not-found text |

## Automated checks

Lighthouse 12.2.1, headless Chrome, accessibility category only:

| Route | Score |
|---|---:|
| `/` | 1.00 |
| `/flow` | 1.00 |
| `/demo` (design system) | 1.00 |
| `/demo/flow` | 1.00 |
| `/demo/result` (recorded run) | 1.00 |

The first `/demo` run found three issues, all fixed above: white-on-coral
swatch samples, `ink-3` on the mint and yellow verdict fills, and an
evidence-link label that did not contain its visible `[1]` text. A rerun
was clean.

## Still to verify

- A manual screen-reader pass (NVDA on Windows, VoiceOver on macOS) over
  the live result and the orb; automated checks cannot confirm that a
  focus move reads the verdict rather than only announcing a region.
- A keyboard-only pass across `/` → tags → titles → run → result →
  evidence. All controls are native buttons, inputs and `<details>`, but
  the orb widget has its own focus handling.
- 200% zoom and print/grayscale; print already drops fills to white and
  keeps the verdict word, but the new recorded evidence block has not been
  printed.
