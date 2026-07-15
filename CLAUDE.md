# CLAUDE.md

@AGENTS.md

## Project
RLP Companion — a guided AI retirement life-planning programme. A user works
through five stages of short sessions, and an AI coach called **Vita** guides the
conversation. This is the **Phase 1 prototype**: built to test whether the
conversation works, not a production app. Built by a non-technical founder.

## How to work with me
- I'm non-technical. Explain what you're doing in plain language, one step at a time.
- Wait for my confirmation before moving on to the next step.
- When something breaks, show me the error and diagnose it — don't guess.

## Stack
- Next.js (App Router) + TypeScript + Tailwind
- Clerk for authentication
- Anthropic SDK for the AI coach
- **Postgres** (Neon, via `@neondatabase/serverless`) for all user data — a
  single `user_data` table keyed by `(user_id, key)` with a `jsonb` value.
  Accessed through `/api/user-data`; the client reads/writes via the
  `useUserData()` hook in `lib/userData.tsx`. (Earlier this phase used browser
  localStorage; that data is migrated up on first load.)

## Routes
- `/sign-in`, `/sign-up` — Clerk, public; every other route is Clerk-protected
- `/onboarding` — welcome flow
- `/home` — dashboard
- `/session/[id]` — session screen
- `/api/chat` — coach API route (streams Claude's responses)

## Design
- Branded **Chorus Life**. Source of truth is `tokens.css` (import once,
  globally, at the top of `globals.css`). **Always use the semantic CSS
  variables — never hardcode hex.** The eight brand colours are Dark Green
  `#0A322D`, Green `#00645F`, Purple `#322D69`, Orange `#DC6437`, Blue
  `#C3F5FF`, Yellow/cream `#FFEBC8`, Pink `#FFEBFF`, Lime `#D7FF73`. Pair the
  two dark colours with the light ones — never dark on dark, and white on dark
  reads badly.
- Component contracts: consult design-reference/DESIGN_SYSTEM.md before building
  any UI. NOTE: `aviva-rlp-design-system.html` and `aviva-rlp-home-screen.html`
  are the ORIGINAL Aviva white-label reference, kept only as history — they show
  the pre-Chorus brand (navy, yellow band) and are NOT a target to build to.
- Two layers: a **structure layer** (Dark Green `--color-brand-primary`, used
  for the band/avatar and the darkest ink) and an **interaction layer** (Green
  `--color-interactive-primary` → `--brand-primary`, behind buttons and links),
  over a fixed product layer (cream, orange accent, neutrals).
- Buttons: primary actions use `--brand-primary` (Chorus **green**) fill with
  `--brand-on-primary` text. Orange `--accent` is reserved for the single
  current step only ("orange is the cursor"); button fills behind white text
  use `--accent-strong`, never bright `--accent` (contrast).
- The brand graphic (`ChorusVectorGraphic`) is the supplied five-circle vector.
  Use it as a large, cropped field behind a colour ground — never redraw or
  approximate it. Per-stage ground/graphic pairings live in `lib/stageColors.ts`
  (`stageHeroGroundFor` / `stageHeroGraphicFor`); read them from there rather
  than hardcoding a pairing.
- Vita: cream warm surfaces (`--warm-surface`) appear only where Vita speaks;
  everything else is white / `--bg` with hairline borders.
- Type: serif (`--font-serif`, Source Serif 4) for things the user *feels* —
  greetings, titles; sans (`--font-sans`, Inter) for controls, labels, body.
  16px minimum reading text.
- Feel: calm, not clinical — generous space, no progress shame.

## Data conventions (localStorage)
- Onboarding: key `rlp_onboarding_[userId]` → JSON `{ partner, horizon, motivation }`
  (`motivation` is one of the four set values, or `null` if the user skipped)
- Session conversations: key `rlp_session_[userId]_[sessionId]`
- Keep these patterns consistent — later features read from them.

## Terminology
- The user-facing term for the short units within a stage is **"session"**, not
  "module". All visible copy and labels — and everything Vita says to the user —
  say "session". (Internal code identifiers, DB columns, and the `[[MODULE_COMPLETE]]`
  plumbing token still use "module"; only human-readable text was changed.)

## Voice (applies to all user-facing copy, and to Vita)
- Warm, curious, specific. Plain language. Sounds like someone genuinely
  interested in this person — not a generic AI, not a jargon-y life coach.
- Never use these words to the user: reflect, explore, unpack, journey, growth,
  share, deep dive.
- Never say: "that's wonderful", "great answer", "I hear you",
  "let's explore that together".
- Never use negative-contrast, parataxis, or symmetrical sentence
  structures ("It's not X, it's Y"; "It isn't this, it's that"). Speak
  directly, confidently, and entirely in the affirmative.
- Never use the word "genuinely".
- Vita is an AI coach, and is never implied to be human.
- Vita's voice and method live in lib/coachBasePrompt.ts (COACH_BASE_PROMPT) — the single source of truth for how Vita talks. Don't edit or paraphrase it unless asked.

## Commands
- `npm run dev` — start the dev server at http://localhost:3000
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — run ESLint
