# Mobile responsiveness — Phase 0 audit + navigation recommendation

**Scope:** the responsive web app on **phones** (~360–430px wide). Not a native build.
**Status:** this is an **audit only** — no fixes have been made. The goal is to map what
breaks on a phone and propose the navigation pattern for Elsa to approve before we build.

**Hard guard for the build phases that follow:** *desktop layouts must stay byte-identical.*
Every change must be scoped to mobile breakpoints only. Nothing in this work should alter how
the app looks at desktop widths. (This audit changed no product code.)

---

## How this was tested (so you can trust the findings)

Two evidence sources, cross-checked against each other:

1. **Live rendering.** Ran a production build locally, signed in, seeded a full test account
   (all modules complete), and viewed each screen in a real narrow browser viewport, screen by
   screen — dashboard, a module (reading → day-builder → Vita chat), the Stage 1 & 2 reveals,
   the full Retirement Life Plan document, the feedback popup, and onboarding.
2. **Code audit.** Every layout component was read line-by-line for the things that break on
   phones (fixed widths, column grids, touch-target sizes, fixed/sticky elements, font sizes).

**One caveat, stated plainly:** desktop Chrome on this Mac refuses to shrink a window below
**500px**, so the live screenshots are at **500px**, not 360–390px. 500px is genuinely narrow —
it already triggers all of the app's mobile breakpoints — but it is kinder than a real phone.
Wherever the true-phone behaviour differs, it was computed from the **measured pixel geometry**
of the elements (e.g. "this widget is a fixed 300px, the content column at 360px is only 268px,
so it overflows by ~30px"). Those cases are flagged as *measured/extrapolated*. A couple of
widgets that need deep prior-stage data to appear (the first-year timeline) could not be shown
live and are rated from code; that is noted where it applies.

**Good news up front:** the `<meta name="viewport" content="width=device-width, initial-scale=1">`
tag is present and correct, and **no screen tested produced left–right (horizontal) scrolling at
500px.** So the foundations are not broken — the problems are navigation, a handful of
fixed-width widgets that crush at true-phone widths, small touch targets, and mobile-keyboard /
notch handling. All fixable.

---

## 1. Navigation — the priority

### How navigation works today

The app has **three different, inconsistent chromes** depending on the screen, and **no
persistent mobile navigation at all**:

| Screen | Header / chrome | How you move around |
|---|---|---|
| **Dashboard** (`/home`) | Sticky yellow brand band (68px) | Desktop shows a **left sidebar** with the stage list, a progress dial, and branding. **On mobile (≤880px) the whole sidebar is hidden** (`HomeDashboard.tsx:860`). The horizontal **stage arc** at the top remains and is tappable for switching stages. |
| **Reveals & Plan** (`/stage/1-3`, `/plan`) | Sticky yellow brand band (68px) | The band has the wordmark, Support, and the account menu — but **no link back to the dashboard** and no stage/module nav. You leave via the account menu or the browser back button. |
| **Module screens** (`/session/[id]`) | **No brand band at all.** Just a plain top row: "← Your modules" and "Restart this module" | This "← Your modules" link is the **only way out**, and it is **not sticky** (`session/[id]/page.tsx:253`) — it scrolls off the top as soon as you start reading or chatting. |

### Why it fails on a phone

- **The programme's main navigation is desktop-only.** The stage list, progress dial, and
  branding all live in a sidebar that is `display:none` on mobile. A phone user's only stage
  switcher is the horizontal arc on the dashboard — and it exists *only* on the dashboard.
- **You can get stranded inside a module.** A module is a long vertical scroll (reading → video →
  interaction → a streaming Vita conversation). The single exit ("← Your modules") is pinned to
  the very top and scrolls away, so to leave you must scroll all the way back up. There is no
  sticky back control, no home button, nothing thumb-reachable. *(Confirmed live.)*
- **No consistent way to reach the hub, the Plan, or Support from where you are.** Each screen
  offers a different subset, and module screens offer none of it.
- **The only always-present control is the floating "Feedback" pill**, which isn't navigation and
  actively **overlaps content** on every screen (see §2).

### Recommended pattern — for you to approve

> **A single, consistent sticky *top* app bar on every screen, carrying an always-visible back /
> home control and a clearly-labelled menu — plus keep the stage arc on the dashboard as the
> stage switcher.** No bottom tab bar for now.

Concretely, one slim bar (~52–56px, respecting the notch) that appears on **every** screen with:

- **Left — a context-aware back control that is always visible:** "‹ Dashboard" on reveals/plan,
  "‹ Your modules" on a module screen. This is the single most important fix: you can always get
  out, from anywhere, without scrolling.
- **Centre/left — a compact provider wordmark** (shortened so it doesn't crowd — see §2).
- **Right — a labelled "Menu" button** (not a bare hamburger icon) holding the secondary
  destinations: *Your Plan · Support · Jump to a stage · Account · Start over*.
- **Keep the horizontal stage arc on the dashboard** — it already works on mobile and is a natural,
  visible stage switcher.

**Why this and not the alternatives, for this audience (older, non-technical retirees):**

- **Why not a bottom tab bar (yet):** module screens end in a **Vita chat composer pinned to the
  bottom of the content**, and a bottom tab bar would fight it for the same thumb space and stack
  awkwardly above the on-screen keyboard. The app is also a *linear guided flow* with really only
  one hub (the dashboard) and one standing destination (the Plan) today. A top bar avoids the
  composer conflict entirely and still keeps "back" one tap away everywhere. *(A bottom tab bar
  becomes worth revisiting once Stage 5 "Act" ships and there are several permanent destinations —
  at which point it can appear on the browse screens and be suppressed on chat/module screens.)*
- **Why not a pure hamburger drawer:** hiding *everything* behind an icon is exactly what trips up
  a non-technical audience. Here the **back/home action stays visible at all times**; only the
  secondary items sit under a **labelled** "Menu".

This also **unifies the three inconsistent chromes into one**, which removes a whole class of
"where am I / how do I get back" confusion.

*(If you'd prefer the bottom tab bar despite the composer trade-off, that's a reasonable call too —
this is the decision to make before we build.)*

---

## 2. Global foundations (fix-many-at-once)

| Check | Finding | Severity |
|---|---|---|
| **Viewport meta tag** | ✅ Present and correct (`width=device-width, initial-scale=1`). | OK |
| **Horizontal overflow** | ✅ None at 500px on any screen tested. The Plan document is explicitly hardened (`overflow-x:hidden` + `min-width:0`, `RlpPlanDocument.tsx:1073`). **But** two fixed-width widgets overflow at true-phone widths — see §3 (ExploreWheel, and the crushing grids). | Mostly OK |
| **Container widths / padding** | Content 720px, Plan 880px, reveals 860px — all fluid and fine. Side padding is **not reduced on small screens**: brand band 28px, Plan 28px, module 24px each side. At ≤360px that eats meaningful width and makes fixed widgets tighter. | Low–Med |
| **Touch targets (~44px min)** | ⚠️ **Systemic.** Primary buttons are good (48px). But **chips, pills, toggles, reorder/remove buttons cluster at 26–40px** across nearly every widget (e.g. WeekShape frequency pills ~26px, RolePicker chips ~36px, reorder arrows 32–34px). Small text links (Back, Cancel, Skip, edit, star/×) are well under 44px. The **Feedback pill is ~38px**, and the **module-close 0–10 rating is 11 buttons ~27px wide each** (`ModuleFeedbackCard.tsx:204`). | Med |
| **Fixed / sticky elements** | The **Feedback pill (fixed, bottom-right, z-index 60) overlaps content on every single screen** — confirmed live: it sat over module titles, reveal quotes, plan body text, and chat bubbles in the captures. The sticky brand band is a fixed **68px** that never shrinks. Module screens have **no** sticky header (see §1). | Med |
| **Keyboard collisions** | The **Feedback panel and Support form are anchored to the bottom of the screen with an auto-focused textarea** (`FeedbackPanel.tsx`), so the on-screen keyboard will cover the very fields (and Send button) you're typing into. The **Vita chat composer is inline at the bottom of a long page, not pinned** — it won't be *hidden* by the keyboard, but it scrolls out of view and streaming replies push it further down (no scroll-into-view on focus). | Med |
| **Font scaling** | Reading body text is a compliant **16px**. But **14px** (`--fs-sm`) is the default for controls/labels app-wide, and several **real reading lines sit at 14–15.5px** (reveal "forward" line & stat claim `ExploreWheel.tsx:256-258`; Plan section ledes `RlpPlanDocument.tsx:1085`). Captions/eyebrows run 11–13px. | Low–Med |
| **Modals / popups** | The part-picker (day-builder), the module-close card, and the feedback panel all **fit the width** at 500px and render cleanly. Their only mobile issue is the keyboard collision above. | Low |
| **Safe-area insets (notch / home bar)** | ❌ **None used anywhere** (no `env(safe-area-inset-*)`). The sticky top band and the fixed bottom Feedback pill don't reserve space for the notch or home indicator, so on modern phones they can tuck under system UI. | Med |
| **`100vh` on mobile** | Used in the session page wrapper, `StageIntro`, `OpeningCapture`, onboarding. Mobile browsers make `100vh` taller than the visible area (dynamic toolbars), so these overshoot. Swap to `100dvh`/`svh`. | Low |

---

## 3. Interaction inventory

Rated **Usable / Imperfect / Broken** on a phone. "Live" = seen rendering at 500px; "measured" =
computed from element geometry; "code" = from the component audit (couldn't be reached live).

| Archetype | Rating | The specific problem | Evidence |
|---|---|---|---|
| **Onboarding** (welcome, name/question steps, back-nav) | 🟢 Usable | One question per screen, big inputs, top "← Back". Has a real `@media(max-width:560px)`. Nit: "← Back" and the consent checkbox are small targets. | Live |
| **Dashboard / stage overview** | 🟢 Usable | Single column, no overflow, stage arc works as switcher. Nit: brand band crowds — the "Digital Retirement Coaching" descriptor already **wraps to 3 lines** at 500px; will be tighter at 360px. | Live |
| **Stage + module lists** | 🟢 Usable | Module cards reflow cleanly (thumbnail + title/desc + time chip + status); a `440px` breakpoint stacks them further. | Live |
| **Day-builder** | 🟡 Imperfect | Works and doesn't overflow — activity tiles are **tap-based (no drag), wrap nicely**, and the "when?" picker is a clean full-screen modal. But the tiles/day-chips are **sub-44px** and 14px text. Assembled "YOUR DAY" view is 2 columns at 500px (1 at 360). | Live |
| **Sliders** (week-shape, readiness, trade-offs) | 🟡 Imperfect | All use **native range inputs** (good for touch) but thumbs are **24–30px** and precise 0–100 positioning on a ~300px track is fiddly for older hands. `ReadinessSnapshot` adds a harder **dual From/To** range and a **non-wrapping levels row** that can overflow its column with 3+ levels (`ReadinessSnapshot.tsx:561`). | Code |
| **Multi-select card pickers** (roles, mirror, understand, priority, values) | 🟡 Imperfect | No fixed grids — everything is `flex-wrap`, so it reflows without overflow. Two squeeze without stacking: **PriorityChoices** keeps its "A *or* B" options side-by-side (`:328`), and **MirrorCards** keeps a label + two no-wrap buttons on one row (`:386`). **UnderstandCards** uses a fixed `min-height:548px` on absolutely-positioned cards (`:446`) that can clip long content vertically. Chips ~30–36px. | Code |
| **Keep/change/leave sort + screening checks** | 🟢 Usable | The "sort" widgets are **tap-a-tray / up-down-arrow, not drag** — touch-safe. `ScreeningCommitment` is the best-built widget in the app (44/48px targets). | Code |
| **Letter writing** | 🟡 Imperfect | Correctly uses an **auto-growing textarea** (honours the "pre-filled text must be viewable" rule). Nit: recipient/suggestion chips ~33px. | Code |
| **Vita chat** (conversation, input, streaming) | 🟡 Imperfect | Bubbles and composer fit and stream fine (confirmed live). But the **composer is inline, not pinned** above the keyboard, and streaming + message-end auto-scroll push it out of view (no scroll-into-view on focus). User-bubble `max-width:380px` is meaningless below 380px. | Live |
| **Plan document** (§8 reset columns, "Worth picking up", first-year timeline) | 🟡 Imperfect | Genuinely robust — `overflow-x:hidden` guard holds, and most grids collapse to 1 column (§8 reset columns **do** collapse at 620px; first-year & seasons collapse at 680px). The one weak spot: **§2 "balance" strip stays 5-across on mobile** (`:1309`) — 5 tiles at ~82px (500px) → ~54px each at 360px, cramped but contained. Section ledes are 14px. | Live + measured |
| **Reveal screens** (Stage 1–3) | 🟢 Usable *except the wheel* | The shared reveal shell has a real `@media(max-width:600px)` and renders beautifully (dawn motif, threads). **Exception: the Stage 2 ExploreWheel is a fixed 300px SVG that does not scale** (`ExploreWheel.tsx:119`). Measured: content column is ~391px at 500px (fits) but only **~268px at 360px → the wheel overflows by ~30px**. Borderline at 375–390px, broken below. | Live + measured |
| **First-year timeline** (`FirstYearJourney`) | 🔴 Broken | A **4-column grid that never collapses** (`repeat(4,1fr)`, `:817`) **and its primary interaction is HTML5 drag-and-drop, which does not work on touch at all** — a phone user cannot reorder the timeline; the 22px tool buttons compound it. *(Could not be shown live — needs full prior-stage data to render — but the touch-drag failure is a code-level certainty.)* | Code |
| **Seasons board** (`SeasonsBoard`) | 🔴 Broken | A hard **3-column grid** (`repeat(3,1fr)`, `:465`) with no responsive collapse → ~90px columns at 390px, crushing the cards to near-unreadable. | Code |
| **Global chrome** | mixed | Video primer is responsive ✅. Brand band crowds (above). Feedback popup fits but has the keyboard collision. **No data tables anywhere** (the Plan uses definition lists), so no table-overflow problem. | Live |

---

## 4. Proposed phasing

Grouped so each phase is reviewable, and ordered so the early phases unblock testing and fix many
screens at once. Every phase is **mobile-breakpoint-only — desktop stays byte-identical.**

### Phase 1 — Navigation + global foundations *(do first; unblocks everything)*
The nav backbone plus the fixes that touch every screen.
- **Build the unified sticky top app bar** with the always-visible back/home control + labelled
  menu (§1), and wire it across dashboard, reveals, plan, and module screens. **(Involved)**
- **Reposition / hide the Feedback pill** so it stops overlapping content and gets out of the way
  of the keyboard and composer. **(Quick)**
- **Add safe-area insets** to the top band and any bottom-fixed element; swap `100vh` → `100dvh`.
  **(Quick)**
- **Compact the brand band** on small screens (drop/shorten the descriptor so it stops wrapping to
  3 lines). **(Quick)**
- **Reduce side padding below ~380px** so fixed widgets get breathing room. **(Quick)**

### Phase 2 — The widgets that actually break *(highest-risk layouts)*
- **`ExploreWheel`:** make the 300px SVG scale (`max-width:100%`). **(Quick — prevents an overflow)**
- **`SeasonsBoard`:** collapse the 3-column board to stacked rows on mobile. **(Quick–Medium)**
- **Plan §2 balance strip:** let the 5-across strip wrap/stack on narrow screens. **(Quick)**
- **`FirstYearJourney`:** collapse the 4-column timeline **and** replace drag-and-drop with a
  touch-friendly reorder (the existing up/down-arrow pattern used elsewhere is a good model).
  **(Involved — biggest single item)**

### Phase 3 — Interaction polish, grouped by similarity
- **Touch-target sweep** across all chips/pills/toggles/reorder buttons (→ ~44px). **(Medium, broad)**
- **Card-picker squeeze:** stack `PriorityChoices` "or" options and `MirrorCards` rows on narrow
  screens; fix `UnderstandCards` fixed height. **(Medium)**
- **Sliders:** larger thumbs / touch targets; fix `ReadinessSnapshot`'s non-wrapping levels row.
  **(Medium)**
- **Chat composer:** keep it reachable when the keyboard is up (scroll-into-view on focus / sticky
  behaviour). **(Medium)**

### Phase 4 — Typography & spacing polish
- Raise the **14–15.5px reading lines** that are actually prose (reveal forward-lines, Plan ledes)
  toward 16px; review caption sizes and the 0–10 rating buttons. **(Quick, low-risk)**

**Recommended order:** Phase 1 → 2 → 3 → 4. Phase 1 makes the app testable on a phone and fixes the
most-felt problem (getting stranded / no nav); Phase 2 kills the genuine breakages; Phases 3–4 are
polish that can be scheduled flexibly.

---

## What's next

Please review the **navigation recommendation in §1** and confirm the pattern (unified sticky top
bar + labelled menu + keep the stage arc), or tell me you'd rather have a bottom tab bar. Once you
approve, I'll turn Phase 1 into a concrete build plan — desktop untouched — for you to sign off
before any code is written.
