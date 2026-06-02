# RLP Companion — Design System

**Theme:** Aviva (white-label reference). **Fonts:** Source Serif 4 + Inter.
**Companion files:** `tokens.css` (the source of truth — import it once, globally) and `aviva-rlp-design-system.html` (a rendered reference of every component).

This document tells you how to build the RLP Companion's interface so it matches the agreed look. Build against the **semantic CSS variables** in `tokens.css`, never against raw hex values. The design has two layers: a **brand layer** (navy, yellow band — swappable per pension provider) and a **product layer** (warm cream, orange accent, neutrals — fixed everywhere). To re-skin for a different provider, only the brand block in `tokens.css` changes.

---

## 1. Setup

Load the fonts in the document head:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600;8..60,700&display=swap" rel="stylesheet">
```

Import `tokens.css` globally (e.g. at the top of `globals.css`). Set base body styles:

```css
body{
  font-family: var(--font-sans);
  font-size: var(--fs-body);     /* 16px minimum for reading content */
  line-height: var(--lh-body);
  color: var(--text);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
}
```

If web fonts fail to load, the stacks fall back to Georgia (serif) and the system sans — the layout is unaffected.

---

## 2. Colour, in one paragraph

Navy (`--brand-primary`) is the only colour for interactive and completed states. Orange (`--accent`) is reserved for the **single current step** and nothing else — it behaves like a cursor pointing at "do this next". Cream (`--warm-surface`) appears only where the coach, Vita, is present. Everything else is white with hairline borders. Green means complete; lavender (`--info-surface`) means gentle orientation; grey (`--muted-surface`) means not-yet-available. The yellow band (`--brand-band`) is the provider's header and belongs to them.

---

## 3. Typography roles

Two families, never blurred:

| Role | Family | Token | Weight | Used for |
|---|---|---|---|---|
| Greeting / display | serif | `--fs-display` 34 | 600 | "Good morning, Margaret" |
| Hero next-step title | serif | `--fs-h2` 22 | 600 | "Your ideal week" inside the hero |
| Session card title | serif | `--fs-title` 20 | 600 | every session/stage title |
| Section heading | **sans** | `--fs-section` 18 | 700 | "Your steps in this stage" |
| Body / reading | sans | `--fs-body` 16 | 400 | session content, paragraphs |
| Secondary / description | sans | `--fs-sm` 14 | 500 | card descriptions, dates |
| Nav subtitle / small label | sans | `--fs-label` 12.5 | 500 | "Picture your future" |
| Overline / eyebrow | sans | `--fs-eyebrow` 11.5 | 600 | UPPERCASE, letter-spacing .1em, muted |

**Rule:** if the user is meant to *feel* it, it's serif. If it's a control, label, or status, it's sans.

---

## 4. Component contracts

Each component below maps to a section in the HTML reference. Match structure, spacing, and states.

### Buttons
- **Primary (navy):** `--brand-primary` fill, white text, `--r-sm`, min-height 48px, 13×20 padding, weight 600. Hover → `--brand-primary-hover`. Default primary action everywhere.
- **Accent (current step):** fill is `--accent-strong` (**not** `--accent` — see accessibility), white text. Used *only* on the active session's Continue.
- **Ghost:** transparent, `--brand-primary` text, 1.5px `--border-strong`. Secondary actions ("Back to home").
- **Link:** navy text, weight 600, trailing `›` or `→`, no background.
- All buttons carry a trailing `→` for forward motion, `›` for navigation.

### Status (a session shows exactly one)
- **Complete:** pill, white bg, 1.5px `--success-line` border, `--success-text` text, trailing `✓`.
- **Active:** an orange Continue button (no separate badge).
- **Not started:** pill, `--muted-surface` bg, `--text-muted` text, inert.

### Duration chip
`🕐 15 min` — pill, white bg, hairline border, `--text-muted`, 13px.

### Five-stage arc (`Imagine · Explore · Understand · Plan · Act`)
40px circles joined by a 2px line. Done = navy fill + `✓`, navy connector. Active = `--accent` fill + number. Future = `--border` fill + faint number. Caption beneath each; the active caption is `--ink`, others `--text-muted`.

### Clarity / progress
- **Radial:** conic-gradient, `--brand-primary` fill on `--border` track, white inner disc, navy percentage. Label: "Your clarity score".
- **Bar:** 6px, pill radius, `--brand-primary` fill on `--border` track, with an "X of Y steps complete" label above.

### Sidebar nav item
Row: numbered circle + title + subtitle. **Active** → `--brand-primary-tint` background, solid navy numeral. **Idle** → pale numeral (`#EBF1F8`/navy), no background, `--text` title. Subtitle always present, muted.

### Coach "next-step" hero (the dashboard's centrepiece)
Two columns inside one `--r-lg` card. Left = `--warm-surface` body containing: Vita lockup (sun disc + serif "Vita"), the `--coach-pill` "Your retirement coach" tag, a 1–2 line personalised intro referencing prior sessions, the `Your next step` eyebrow, the serif step title, a duration chip, and a **navy** Continue. Right = a soft illustrated scene (sky→hills gradient using the `--ill-*` palette). Lift: `--shadow-md`.

### Stage progress card
Horizontal: sun disc + ("Stage X of 5 · {Stage}" heading, muted description) + right-aligned "X of Y steps complete" with a progress bar. Hairline border, `--shadow-sm`.

### Session card
Grid: thumbnail (88×72, `--r-md`) · (serif title + muted description) · duration chip · status control. Default = white, hairline, `--shadow-sm`. **Active variant** = `--accent-surface` background, `--accent-line` border, `--shadow-md`, orange Continue. Only one card is ever active.

### Encouragement card
`--info-surface` (lavender) with `--info-line` border. Soft avatar + serif title + muted body + a link. For orientation/reassurance only — never a required action.

### Conversation bubbles (session screen — extends the system)
Coach bubble: `--warm-surface`, `--ink` text, 16px, radius `18px 18px 18px 4px`, left-aligned, hairline `--warm-line`. User bubble: white, 1.5px `--border-strong`, radius `18px 18px 4px 18px`, right-aligned. One question per coach turn.

---

## 5. Layout

- Header: `--header-h` (68px), full-width `--brand-band`, logo left, support + user right.
- Sidebar: `--sidebar-w` (280px), white, hairline divider from main.
- Main content column: centred, `--content-max` (720px), generous vertical rhythm (24–32px between blocks).
- Cards span the content column; the hero may run slightly wider visually but stays within it.

---

## 6. Accessibility (acceptance criterion — non-negotiable)

- **Target WCAG 2.1 AA.** Reading content is ≥16px.
- **Orange + white text:** the bright `--accent` (`#E06F1F`) only meets AA for *large* text. Button fills behind white text use `--accent-strong` (`#B85C16`) which reaches 4.5:1. Reserve bright `--accent` for borders, the active stage dot, and surfaces — never behind small white text.
- **Focus:** every interactive element shows a visible focus ring — `box-shadow: var(--focus-ring)` (3px navy glow), offset where needed. Don't remove outlines without replacing them.
- **Tap targets:** ≥44px.
- **Status by more than colour:** Complete carries a `✓`, Not started carries its label — never colour alone.
- **Contrast that passes:** ink/body/muted text on white all pass; navy on yellow band passes; white on navy passes. `--text-faint` is for decorative/least-critical text only.

---

## 7. Six rules to hold it together

1. **Orange is the cursor** — exactly one orange element on screen, the current step.
2. **Serif feels, sans functions.**
3. **Cream is the coach** — warm surfaces only where Vita speaks; the rest is white.
4. **Lift is meaningful** — flat hairline cards by default; shadow marks "you are here".
5. **The band is theirs** — yellow header/logo are the provider's; no product chrome in it.
6. **Calm, not clinical** — generous space, gentle illustration, no dense data, no progress shame.

---

## 8. White-label re-skinning

To deploy for a different pension provider, edit only the brand block in `tokens.css`: `--brand-primary` (+ hover/tint/on), `--brand-band` (+ on-band), and swap the header logo. Leave the product layer (warm, accent, neutrals, status, info, illustration) untouched so the coaching experience stays consistent across providers. If a provider's brand colour fails contrast as text or as a button fill, derive a darker `-strong` variant the same way `--accent-strong` is derived from `--accent`.

---

*Design System v1.0 — built from the Aviva dashboard reference. Pair with `tokens.css` and `aviva-rlp-design-system.html`.*
