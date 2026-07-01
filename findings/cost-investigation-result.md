# Per-member cost investigation — RLP Companion

**Scope:** estimate the total model/API cost of one member completing the whole
programme (all 24 modules through to the Retirement Life Plan), broken down by
source, and identify the highest-leverage ways to reduce it without hurting
quality. **Investigation only — no code was changed.**

---

## 1. Headline

**A full run costs roughly `$2.85` per member (central estimate), in a plausible
range of `$2.3`–`$5.5`.**

The single biggest driver is **the Vita conversation** (≈ two-thirds of the
total), because it runs across 23 modules with several turns each. Images are
the biggest *single-call* item and the biggest predictable fixed cost, but they
are only ~10% of the total. The whole estimate is most sensitive to two things:
**how many conversational turns a member takes per module**, and **whether the
conversation's prompt cache actually holds** (see §5).

### Cost by category (central estimate)

| Category | Calls / run | Model | Est. cost | Share |
|---|---|---|---|---|
| **Vita conversation** (incl. 24 openings) | ~138 turns | Sonnet 4.6 | **$1.80** | 63% |
| **Per-module seeds** (13 fixed + variable) | 13–20 | Sonnet 4.6 | **$0.39** | 14% |
| **Plan images** (`gpt-image-1`) | 4–5 | gpt-image-1 | **$0.28** | 10% |
| **Module-close takeaways** (+ fact extraction) | 24 | Sonnet 4.6 | **$0.20** | 7% |
| **Stage reveals** (Stage 1/2/3) | 3 | Sonnet 4.6 | **$0.055** | 2% |
| **Plan prose** (`plan-intro`) | 1 | Sonnet 4.6 | **$0.042** | 1.5% |
| **Plan self-intro** | 0 (deterministic) | — | $0.00 | 0% |
| **Total** | **~180 calls + ~5 images** | | **≈ $2.85** | 100% |

> All figures are estimates built from the actual code (models, `max_tokens`,
> prompt sizes, call counts) plus stated assumptions about conversation length
> and token conversion. They are accurate to *category shares and order of
> magnitude*, not to the cent. Numbers should be confirmed against real usage
> logs (`usage.input_tokens`, `cache_read_input_tokens`, `output_tokens`) before
> being treated as precise.

---

## 2. Pricing & assumptions

**Model prices (per 1M tokens):**

| Model | Input | Output | Cache read | Cache write (5-min) |
|---|---|---|---|---|
| `claude-sonnet-4-6` | $3.00 | $15.00 | ~$0.30 (0.1×) | ~$3.75 (1.25×) |
| `claude-haiku-4-5` | $1.00 | $5.00 | ~$0.10 | ~$1.25 |
| `gpt-image-1` (medium, 1536×1024) | — | — | — | **$0.063 / image** |

**Working assumptions (stated so they can be challenged):**

- **~4 characters ≈ 1 token** for English prose (standard rule of thumb).
- **Conversation length:** ~6 Vita generations per conversational module on
  average (1 AI-generated opening + ~5 back-and-forth replies), across the 23
  modules that run a conversation. The letter module (`1.letter`) has no
  conversation. This is the **least certain input** — see the sensitivity table
  in §5.
- **Conversation caching holds within a module** (the 5-minute cache TTL is not
  exceeded between turns). This is optimistic — see §5.
- **Cached system prompt ≈ 7,000 tokens** (base prompt + module instructions +
  injected member context); Vita output averages ~380 tokens against the 500
  cap.
- **Images:** typical run generates 4–5 images (1 hero + one per non-empty
  first-year phase, max 4 phases).

---

## 3. Full paid-call inventory

Every paid call in a complete run. **Key structural finding: prompt caching is
applied on `/api/chat` only. Every other Claude call re-sends its full system
prompt uncached, every time.**

| # | Call (route) | Model | `max_tokens` | Cached? | Times / run |
|---|---|---|---|---|---|
| 1 | Vita conversation — `/api/chat` | Sonnet 4.6 | 500 | **Yes** (whole system block) | ~138 turns |
| 2 | Module opening — `generateOpening` → `/api/chat` | Sonnet 4.6 | 500 | Yes | 24 |
| 3 | Stage-3 seed — `/api/stage3-seed` (6 kinds) | Sonnet 4.6 | 900 | No | 6 |
| 4 | Stage-3 close — `/api/stage3-values` | Sonnet 4.6 | 700 | No | 1 |
| 5 | Dreams (1.money) — `/api/dreams` | Sonnet 4.6 | 600 | No | 1 |
| 6 | Balanced goals (4.3) — `/api/balanced-goals` | Sonnet 4.6 | 2,600 | No | 1 |
| 7 | Goal paths (4.4) — `/api/goal-paths` | Sonnet 4.6 | 2,600 | No | 1 |
| 8 | Trade-offs (4.5) — `/api/trade-offs` | Sonnet 4.6 | 2,600 | No | 1 |
| 9 | Week shape (4.6) — `/api/week-shape` | Sonnet 4.6 | 2,600 | No | 1 |
| 10 | First year (4.7) — `/api/first-year` | Sonnet 4.6 | 2,600 | No | 1 |
| 11 | First year chat (4.7 edits) — `/api/first-year/chat` | Sonnet 4.6 | 2,000 | No | **variable (0–many)** |
| 12 | Letter openers — `/api/letter-suggestions` | Sonnet 4.6 | 500 | No | optional (0–1+) |
| 13 | Letter review — `/api/letter-review` | Sonnet 4.6 | 300 | No | optional (0–2) |
| 14 | Takeaway + fact delta — `/api/takeaway` | Sonnet 4.6 | 300 | No | 24 |
| 15 | Stage 1 reveal — `/api/stage-reveal` | Sonnet 4.6 | 700 | No | 1 |
| 16 | Stage 2 reveal — `/api/stage2-reveal` | Sonnet 4.6 | 1,200 | No | 1 |
| 17 | Stage 3 reveal — `/api/stage3-reveal` | Sonnet 4.6 | 1,100 | No | 1 |
| 18 | Plan prose — `/api/plan-intro` | Sonnet 4.6 | 2,200 | No | 1 |
| 19 | Plan self-intro — `/api/plan-self-intro` | Sonnet 4.6 | 400 | No | 0 (on-demand only) |
| 20 | Plan images — `/api/plan-image` | **gpt-image-1** (→ dall-e-3 fallback) | — | n/a | ≤ 5 |

Notes worth flagging:
- **The opening is a real Claude call**, not the static `coachOpening` string —
  that string is only a fallback. So there are effectively 24 extra Sonnet
  generations beyond the conversational turns.
- **The takeaway call does double duty:** one Claude call returns *both* the
  member-facing takeaway summary *and* the context-facts delta (additions /
  removals). There is no separate fact-extraction call — `lib/contextCapture.ts`
  only reconciles the returned deltas against the DB. Good design; already
  efficient.
- **The initial self-intro drafts are deterministic** (string templates in
  `lib/rlpPlan.ts`), not an LLM call. `plan-self-intro` fires only if the member
  clicks to re-tone. Also good.
- **`first-year/chat` is the wildcard:** every timeline edit or narration in
  module 4.7 is a 2,000-token Sonnet call, and the count is unbounded by how much
  the member fiddles.

---

## 4. Cost breakdown by category (how the money is spent)

### 4.1 Vita conversation — ~$1.80 (63%)

Per conversational module (assuming 6 generations, cache holds):

| Component | Tokens | Cost |
|---|---|---|
| 1× cache **write** of ~6,500-token system prefix (opening) | 6,500 × 1.25× | $0.024 |
| ~5× cache **reads** of the ~7,000-token system block | 5 × 7,000 × 0.1× | $0.011 |
| Uncached message history (resent & growing every turn) | ~2,250 | $0.007 |
| Output (6 × ~380 tokens) | ~2,280 | $0.034 |
| **Per module** | | **~$0.078** |

× 23 conversational modules ≈ **$1.80**.

Two things make this the dominant cost: (a) there are ~138 generations across
the programme, and (b) the system prompt is large (~17,300-char base prompt +
per-module instructions + injected member context ≈ 7,000 tokens). Caching keeps
it affordable — **without caching this line alone would be ~$4.5–5** (see §5).

The **message history is not cached** — each turn re-sends the full prior
conversation as fresh input. It's small relative to the system prompt today, but
grows with longer conversations.

### 4.2 Per-module seeds — ~$0.39 (14%)

The 13 deterministic seed calls, all Sonnet, all uncached:

| Seed | `max_tokens` | Approx input | Est. cost |
|---|---|---|---|
| Stage-4 seeds ×5 (4.3–4.7) | 2,600 | ~3,500 tok (system ~1,000 + `userModel` + stage-4 outputs) | ~$0.041 ea → **$0.205** |
| Stage-3 seed ×6 (3.1–3.6) | 900 | ~1,200 tok (system + growing `priorBuilds`) | ~$0.013 ea → **$0.076** |
| Stage-3 close ×1 | 700 | ~1,500 tok (transcript) | **$0.015** |
| Dreams ×1 (1.money) | 600 | ~1,000 tok | **$0.011** |
| **Fixed subtotal** | | | **~$0.31** |
| First-year chat (variable) | 2,000 | per edit | ~$0.06 (assume ~3 edits) |
| Letter routes (optional) | 300–500 | thin | ~$0.02 |
| **Total** | | | **~$0.39** |

**On the "3.4 is the heaviest" note:** the heaviness of the Stage-3 seeds comes
from `priorBuilds` — each Stage-3 seed re-injects a summary of *every earlier
Stage-3 module's build*. It grows monotonically: 3.1 has none, 3.4 carries 3.1+
3.2+3.3, and 3.5/3.6 carry even more. So `priorBuilds` is bounded by the number
of prior modules (max 5) but unbounded in the member's own free-text length. The
Stage-4 seeds are individually pricier because they each carry the full rendered
`userModel` *and* cap output at 2,600 tokens.

### 4.3 Plan images — ~$0.28 (10%)

`gpt-image-1`, medium quality, 1536×1024, at **$0.063/image**. One hero image +
one per non-empty first-year phase (max 4 phases) = **up to 5 images**
(≈ $0.315 at the max; ~$0.25–0.28 typical). A DALL·E 3 fallback fires only if
`gpt-image-1` is unavailable, which can *double* a given image's cost. This is
the biggest single-call line item and the most predictable fixed cost.

### 4.4 Module-close takeaways — ~$0.20 (7%)

24 calls × (system ~770 tok + transcript ~1,200 tok input, ~300 tok output) ≈
**$0.008 each → ~$0.20**. Includes the folded fact-delta extraction, so this one
line covers both summarisation and fact capture.

### 4.5 Stage reveals — ~$0.055 (2%)

Three calls (Stage 1 @ 700, Stage 2 @ 1,200, Stage 3 @ 1,100 output tokens).
There is **no Stage 4 reveal** — the plan itself is the payoff. ~$0.013 / $0.022
/ $0.020 respectively.

### 4.6 Plan prose — ~$0.042 (1.5%)

One `plan-intro` call: largest single input in the app (5,577-char system prompt
+ the member's full confirmed material), 2,200 output tokens. Cache-guarded so it
runs exactly once.

---

## 5. Sensitivity — what could move the number most

The total hinges on two assumptions. **Both should be verified against real
usage logs before acting.**

**A. Turns per module.** At 4 / 6 / 10 generations per module, the conversation
line is roughly **$1.2 / $1.8 / $3.0**, moving the run total to ~**$2.2 / $2.85 /
$4.0**.

**B. Does the conversation cache actually hit?** The 5-minute cache TTL means if
a member reads, thinks, or steps away for >5 minutes between turns, the
~7,000-token system prompt is **re-written at full price (1.25×)** instead of
read at 0.1×. If the cache rarely holds, the conversation line roughly triples to
**~$4.5–5**, pushing the run to **~$5.5**. **Diagnostic:** check
`usage.cache_read_input_tokens` vs `cache_creation_input_tokens` in the Anthropic
logs. If reads are low, this is the #1 problem to fix and dwarfs every other
saving below.

---

## 6. Recommendations (highest-leverage first)

Each is tagged **[pilot]** (safe to do now, during the prototype phase) or
**[post-pilot]** (defer until the conversation quality is locked and traffic
justifies the engineering).

### R1. Verify & harden the conversation cache — **[pilot]** — up to ~$1–2 / member
The conversation is 63% of cost and entirely dependent on caching. **First,
measure the real cache hit-rate** (`cache_read_input_tokens`). If it's low
because members pause between turns:
- Switch the base-prompt portion to the **1-hour cache TTL** (`ttl: "1h"`, ~2×
  write cost but survives think-time gaps), and/or **pre-warm** the cache when a
  module opens.
- Restructure the system block so the **stable base prompt is a separate,
  first cache breakpoint** from the volatile injected context — today it's one
  monolithic block, so any change to injected context can force a full re-write.
- **Risk:** none to quality; this is purely a caching-efficiency change.
- **Saving:** potentially $1–2/member if the cache is currently missing; near-zero
  if it's already hitting well. Highest expected value, lowest quality risk.

### R2. Route non-conversation calls to Haiku — **[pilot]** — ~$0.25–0.30 / member
Keep **Sonnet for the Vita conversation and the plan prose** (the two places
prose quality is user-visible and central). Move the mechanical calls to
`claude-haiku-4-5` (3× cheaper in and out):
- **Takeaways + fact extraction** (24 calls): summarisation + structured
  extraction — ideal Haiku work. $0.20 → ~$0.067. **Save ~$0.13.**
- **Stage-3 seeds** (6 calls): candidate generation against fixed lists
  (recognition, not open composition). $0.076 → ~$0.025. **Save ~$0.05.**
- **Stage reveals** (3), **dreams**, **letter routes**: $0.055+ → ~$0.02.
  **Save ~$0.05.**
- **Risk:** low. These are summaries, extractions and candidate lists, not the
  showcase prose. Validate each on a handful of real transcripts before
  committing (Haiku occasionally needs a slightly firmer prompt).
- **Consider but test carefully:** the Stage-4 seeds (4.3–4.7) produce
  member-visible draft goals/paths/timeline — quality matters more there. Pilot
  Haiku on one and compare before moving all five.

### R3. Reduce or downshift plan images — **[pilot]** — ~$0.15–0.25 / member
Images are $0.063 each and up to 5 per plan — a clean, predictable saving with a
pure UX trade-off:
- **Hero-only** (1 image): ~$0.063. **Save ~$0.22.**
- **Hero + 1–2** scene images: ~$0.13–0.19. **Save ~$0.13–0.19.**
- **Lower quality/size** (`gpt-image-1` *low* ≈ $0.016/image): 5 images → ~$0.08.
  **Save ~$0.24**, keeping all five scenes.
- **Trade-off:** the imagery is part of the plan's emotional payoff; fewer or
  lower-fidelity images is a visible experience change. Recommend A/B-ing
  hero-only vs hero+phases, or medium-vs-low quality, and letting the experience
  judgment decide. This is the biggest *predictable* saving.

### R4. Extend prompt caching to the repeated static prompts — **[post-pilot]** — ~$0.05–0.10 / member (more at scale)
Every seed, takeaway, reveal and the plan-intro re-sends a multi-KB **static
system prompt that is identical across all members**, uncached. Adding
`cache_control` to those static prefixes lets them cache-read (0.1×) across a
member's own repeated calls *and* across members at volume (within the 5-min
window). The win is modest per member today (output dominates these calls, and
each is one-shot), but it compounds with traffic and pairs naturally with R2.
- **Risk:** none to quality. Small engineering effort.

### R5. Trim oversized inputs & cap runaway calls — **[post-pilot]** — ~$0.05–0.10 / member
- **`priorBuilds`** in the Stage-3 seeds re-injects every earlier Stage-3 build;
  trim each seed's input to only the prior builds it actually needs.
- **`userModel`** is re-injected in full into all five Stage-4 seeds — cache it
  (R4) or slim it per call.
- **`first-year/chat`** is unbounded (one 2,000-token call per timeline edit);
  debounce the "narrate" calls and/or cap edits.
- **`max_tokens`** is 2,600 on all Stage-4 seeds; if real outputs come in well
  under that, the cap is only a ceiling (not billed unless used) — but worth
  confirming outputs aren't running long.
- **Risk:** low, but trimming context can subtly change seed quality — verify on
  sample runs.

### R6. Skip or fold the generated opening — **[post-pilot]** — ~$0.15–0.20 / member
The 24 module openings are full extra Sonnet generations (500 output tokens
each). A static `coachOpening` already exists as the fallback string. Options:
use the static opening for the shorter/simpler modules, or fold the opening into
the first real turn. Saves ~$0.14–0.18 in output plus a round-trip per module.
- **Trade-off:** personalised, context-aware openings are a nice touch and set
  the tone; dropping them is a visible quality change. Pilot on the most
  formulaic modules only.

### Redundant/duplicate generations — checked, mostly clean
- Plan prose, plan images, and each seed are **dedup-guarded / cache-first** —
  generated once, not per view. Good.
- Self-intro initial drafts are **already deterministic** (no LLM). Good.
- The only true duplication risk is **`first-year/chat`** (unbounded edits, R5)
  and the **generated openings** (R6).

---

## 7. Suggested order of action

1. **Measure first (R1 diagnostic):** pull the conversation cache hit-rate from
   the Anthropic logs. This decides whether the biggest cost is already
   controlled or is 3× larger than modelled.
2. **R2 (Haiku routing)** and **R3 (images)** are the two clean, safe savings
   during the pilot — together ~$0.40–0.55/member with negligible quality risk on
   R2 and a UX judgment on R3.
3. **R4/R5/R6** are post-pilot tidy-ups once the conversation design is locked.

**Net:** the safe pilot-phase moves (R1 hardening + R2 + R3) plausibly take a
central run from ~$2.85 to **~$2.2–2.4**, and materially more if the cache is
currently missing.

---

*Prepared as a read-only investigation. No application code was modified. All
dollar figures are modelled estimates from the code plus the assumptions in §2
and should be confirmed against production usage logs before use in pricing.*
