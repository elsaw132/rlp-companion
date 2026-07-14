# RLP Companion — Design System

**Theme:** Aviva-derived palette (white-label reference; the reference deployment shows the provider name "Lionsgate Pensions"). **Fonts:** Source Serif 4 + Inter.
**Companion files:** `tokens.css` (the source of truth — import it once, globally), `aviva-rlp-design-system.html` (a rendered reference of every component), and `aviva-rlp-home-screen.html` (the composed home-screen target).

**Terminology:** a unit of the programme is a **module** (e.g. 1.1) — that's the user-facing word and the code term. "Stage" is the group of modules (Imagine, Explore…). Don't use "session" or "step" in user-facing copy; "conversation" refers to the coach exchange inside a module.

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
| Module card title | serif | `--fs-title` 20 | 600 | every module/stage title |
| Section heading | **sans** | `--fs-section` 18 | 700 | "Your modules in this stage" |
| Reading passage | **serif** | `--fs-reading` 19 | 400 | a module's primer — the writing the reader sits with |
| Body / functional | sans | `--fs-body` 16 | 400 | descriptions, summaries, UI paragraphs |
| Secondary / description | sans | `--fs-sm` 14 | 500 | card descriptions, dates |
| Nav subtitle / small label | sans | `--fs-label` 12.5 | 500 | "Picture your future" |
| Overline / eyebrow | sans | `--fs-eyebrow` 11.5 | 600 | UPPERCASE, letter-spacing .1em, muted |

**Rule:** if the user is meant to *feel* it, it's serif. If it's a control, label, or status, it's sans. A module's primer is reading, not interface, so it follows the rule into serif — and its measure is capped at `--reading-measure` (~32em), because the 720px column runs a line to ~85 characters and the eye tracks ~45–75 comfortably.

---

## 4. Component contracts

Each component below maps to a section in the HTML reference. Match structure, spacing, and states.

### Buttons
- **Primary (navy):** `--brand-primary` fill, white text, `--r-sm`, min-height 48px, 13×20 padding, weight 600. Hover → `--brand-primary-hover`. Default primary action everywhere. The next-step Continue is **"Continue with Vita →"**, navy — in both the hero and the active module card (identical: same colour, same label).
- **Ghost:** transparent, `--brand-primary` text, 1.5px `--border-strong`. Secondary actions ("Back to home").
- **Link:** navy text, weight 600, trailing `›` or `→`, no background.
- All buttons carry a trailing `→` for forward motion, `›` for navigation.
- **No orange button fills.** Orange (`--accent` / `--accent-strong`) is *not* used as a button. The current step is signalled by the active module card's highlight (accent surface + border) and the orange stage-arc dot — not by an orange button. `--accent-strong` is retained only as a safeguard for any future orange-on-white control a provider brand might require.

### Status (a module shows exactly one)
- **Complete:** pill, white bg, 1.5px `--success-line` border, `--success-text` text, trailing `✓`. Completed module cards are **revisitable** — clickable, with a hover lift and a trailing `›`.
- **Active:** the card carries the orange current-step highlight (`--accent-surface` + `--accent-line` border); its action is the navy **"Continue with Vita →"** button — not an orange button.
- **Not started:** pill, `--muted-surface` bg, `--text-muted` text, inert.

### Duration chip
`🕐 15 min` — pill, white bg, hairline border, `--text-muted`, 13px.

### Five-stage arc (`Imagine · Explore · Understand · Plan · Act`)
40px circles joined by a 2px line. Done = navy fill + `✓`, navy connector. Active = `--accent` fill + number. Future = `--border` fill + faint number. Caption beneath each; the active caption is `--ink`, others `--text-muted`.

### Stage score / progress
- **Radial (stage score):** conic-gradient, `--brand-primary` fill on `--border` track, white inner disc, navy percentage. Label is **dynamic and names the active stage** — "Your {Stage} score" (e.g. "Your Imagine score"). Value = completion *within the active stage* (modules complete in that stage ÷ total modules in that stage). Never a global completed-÷-all figure — that breaks "no progress shame". Confidence-weighting (how firm the answers are) is a Phase 2 enhancement.
- **Bar:** 6px, pill radius, `--brand-primary` fill on `--border` track, with an "X of Y modules complete" label above.

### Sidebar nav item
Row: numbered circle + a **vertical stack** (title on its own line, subtitle beneath — never run together inline). **Active** → `--brand-primary-tint` background, solid navy numeral. **Done** → navigable (clickable, hover), navy numeral/✓. **Future (locked)** → dimmed, not clickable. Subtitle always present, muted. Completed and active stages are navigable (back-navigation); future stages are locked.

### Coach "next-step" hero (the dashboard's centrepiece)
Two columns inside one `--r-lg` card. Left = `--warm-surface` body containing: Vita lockup (sun disc + serif "Vita"), the `--coach-pill` "Your retirement coach" tag, a 1–2 line personalised intro referencing the prior module, the `Your next step` eyebrow, the serif step title, a navy **"Continue with Vita →"** button, and a duration chip. Right = a soft illustrated scene (sky→hills gradient using the `--ill-*` palette). Lift: `--shadow-md`.

### Stage progress card
Horizontal: sun disc + ("Stage X of 5 · {Stage}" heading, muted description) + right-aligned "X of Y modules complete" with a progress bar. Hairline border, `--shadow-sm`.

### Module card
Grid: thumbnail (88×72, `--r-md`) · (serif title + muted description) · duration chip · status control. Default = white, hairline, `--shadow-sm`. **Active variant** = `--accent-surface` background, `--accent-line` border, `--shadow-md`, and the navy **"Continue with Vita →"** button (identical to the hero — not an orange button). Only one card is ever active. **Completed** cards are clickable to revisit (hover lift, trailing `›`). Responsive: a grid that reflows, never overflows — `minmax(0,1fr)` on the body so long serif titles wrap; below ~880px the thumbnail spans two rows with the chip + status on a meta row beneath.

### Encouragement card
`--info-surface` (lavender) with `--info-line` border. Soft avatar + serif title + muted body + a link. For orientation/reassurance only — never a required action.

### Conversation bubbles (the module's conversation — extends the system)
Coach bubble: `--warm-surface`, `--ink` text, 16px, radius `18px 18px 18px 4px`, left-aligned, hairline `--warm-line`. User bubble: white, 1.5px `--border-strong`, radius `18px 18px 4px 18px`, right-aligned. One question per coach turn.

### Stage intro
A brief framing moment on the warm/coach surface, shown once on first forward entry into a stage (not on back-navigation): Vita lockup + serif heading + short body + a single navy button. Intro copy lives per-stage in the config.

### Edit-your-selections
On the read-only interaction summary above a module's conversation, a quiet navy "Edit your selections ›" link returns the user to the interaction pre-filled to adjust (not restart); the conversation is preserved, and the coach acknowledges the change in one line on its next turn. Distinct from "Restart this module" (a full start-over).

---

## 5. Layout

- Header: `--header-h` (68px), full-width `--brand-band`, logo left, support + user right.
- Sidebar: `--sidebar-w` (280px), white, hairline divider from main.
- Main content column: centred, `--content-max` (720px), generous vertical rhythm (24–32px between blocks).
- Cards span the content column; the hero may run slightly wider visually but stays within it.

---

## 6. Accessibility (acceptance criterion — non-negotiable)

- **Target WCAG 2.1 AA.** Reading content is ≥16px.
- **Orange usage:** the bright `--accent` (`#E06F1F`) only meets AA for *large* text, so it's used for borders, the active stage-arc dot, and surfaces — never behind small white text, and never as a button fill (the current step's action is the navy Continue). `--accent-strong` (`#B85C16`, 4.5:1 on white) is kept only as a safeguard should a provider brand ever need an orange-on-white control.
- **Focus:** every interactive element shows a visible focus ring — `box-shadow: var(--focus-ring)` (3px navy glow), offset where needed. Don't remove outlines without replacing them.
- **Tap targets:** ≥44px.
- **Status by more than colour:** Complete carries a `✓`, Not started carries its label — never colour alone.
- **Contrast that passes:** ink/body/muted text on white all pass; navy on yellow band passes; white on navy passes. `--text-faint` is for decorative/least-critical text only.

---

## 7. Six rules to hold it together

1. **Orange is the cursor** — it marks the current step (the active module's highlight and the stage-arc dot), never as a button and never as a general accent.
2. **Serif feels, sans functions.**
3. **Cream is the coach** — warm surfaces only where Vita speaks; the rest is white.
4. **Lift is meaningful** — flat hairline cards by default; shadow marks "you are here".
5. **The band is theirs** — yellow header/logo are the provider's; no product chrome in it.
6. **Calm, not clinical** — generous space, gentle illustration, no dense data, no progress shame.

---

## 8. White-label re-skinning

To deploy for a different pension provider, edit only the brand block in `tokens.css`: `--brand-primary` (+ hover/tint/on), `--brand-band` (+ on-band), and swap the header logo. Leave the product layer (warm, accent, neutrals, status, info, illustration) untouched so the coaching experience stays consistent across providers. If a provider's brand colour fails contrast as text or as a button fill, derive a darker `-strong` variant the same way `--accent-strong` is derived from `--accent`.

---

*Design System v1.1 — built from the Aviva dashboard reference. Pair with `tokens.css`, `aviva-rlp-design-system.html`, and `aviva-rlp-home-screen.html`.*

*v1.1 changes: both next-step Continue buttons are navy "Continue with Vita →" (no orange button fills — orange is the active-card highlight + arc dot only); "clarity score" is now the dynamic "Your {Stage} score" (current-stage completion); unit term standardised to "module"; added stage intro, edit-your-selections, completed-card revisit, and locked/navigable stages.*
