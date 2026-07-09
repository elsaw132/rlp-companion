# Vita coaching-quality investigation

**Status:** investigation only — no code changed. For Elsa to review before any fix.
**Date:** 2026-07-08
**Trigger:** module 1.day (working/imagine path) — shallow inquiry, no challenge of an
obvious incongruity (two lie-ins), over-brevity, and plan-framing in an Imagine module.

---

## 1. The short version (executive summary)

The regression is **real and largely systemic**, but it is not one bug — it is **three
separate causes that happen to point the same way** (Vita is too brief, too shallow, and
too agreeable), plus **one localised copy bug** (the plan-framing line).

The headline surprise: **the biggest named suspects are not the cause.**

- **Model routing to Haiku is NOT the cause.** Vita's actual conversation still runs on
  Sonnet (`claude-sonnet-4-6`). The cost work only moved *mechanical* background calls
  (summaries, reveals, letter helpers) to Haiku. Vita herself never got dumber. Ruled out
  with evidence (§5).
- **The tone/warmth work is NOT the cause.** The three tones change surface register only.
  I reproduced the failure on the *professional* (most clipped) tone too — it fails
  identically. Ruled out (§5).
- **The 500-token cap is NOT a regression.** It has been 500 the whole time; it was never
  lowered. It contributes background pressure toward brevity but didn't change.

What actually happened:

1. **Depth was deliberately removed from the modules — very early, and then programme-wide.**
   1.day *used to* say "Draw out … who's there, what a chosen activity actually looks like,
   the feel of the pace. Go deeper on a few things." That line was **deleted** on 2 June
   (commit `2f72448`, "lighten Vita in 1.1") and replaced with "At most one light follow-up
   … don't go deep" + "four to six exchanges." The same "light … keep it short … 4–6
   exchanges" pattern was then spread across **all of Stage 1 and all of Stage 2** (§4, §D).
   This is the direct cause of "no depth of inquiry" and most of "over-brevity."

2. **Vita has never been told to notice incoherence and challenge it.** This is a *gap that
   has always existed*, not something that broke. The base prompt says "you never flatter"
   and "don't praise," but that is passive ("don't gush"). Nothing tells her to actively
   check whether what she's hearing *holds together* and gently push back. Worse, several
   instructions actively **suppress** challenge — 1.day says "MUST NOT reality-check … or
   judge whether the picture is realistic," and 1.week says "meet it with curiosity rather
   than challenge." So the most damaging symptom (sycophancy) is a **programme-wide
   absence**, sharpened into active suppression in the light modules (§C-2, §5).

3. **The "Tier 1" voice work (30 June, `17a1584`) — the round you thought would fix
   things — entrenched the problem.** It added a top-priority "plain, grounded English"
   rule, a "batch, don't march" rule, a "length & shape" rule, and a rule against
   feeling-probes. Every one of those pushes *shorter and less probing*. It added **nothing**
   about noticing incoherence. So the feedback round improved the *voice* (less fluffy) while
   deepening the *coaching* regression.

4. **The plan-framing line is a one-line copy bug in 1.day.** The module's CLOSING
   instruction literally says: "Note warmly this is the first piece of their Retirement Life
   Plan." It's been there since the module was first wired (2 June, `11e8513`). Trivial to fix.

**Recommended fix, in one sentence:** add a short, high-priority "notice incongruities and
gently check them" block to the base prompt; loosen the Imagine/Explore modules' hard
"don't go deep / 4–6 exchanges" caps back toward genuine drawing-out; remove the 1.day
plan line; and add a challenge/depth probe to the existing `vita-check` test harness so this
can't regress unseen again. Details in §E.

---

## 2. What "good" looks like (the intended baseline)

Drawn from CLAUDE.md's Voice section, the base prompt's own stated character, and the
"Refinements from testing" block. Vita should, **in every module and every stage**:

| # | Principle | Where it's meant to live |
|---|-----------|--------------------------|
| B1 | **Genuine multi-turn depth** — draw out the real, particular texture, not one surface answer. | base prompt "EACH MODULE HAS A PURPOSE"; module HOW-TO-RUN sections |
| B2 | **Ask *why* / draw out detail and feeling** where the module is imaginative. | originally explicit in 1.day ("who's there … the feel of the pace") |
| B3 | **Notice incongruities and gently challenge — never flatter incoherent input.** | *intended* by "you never flatter" + dry wit "notice something true and say it" — but never operationalised |
| B4 | **No empty praise; engage with substance.** | base prompt lines 37, 42 (present and reasonably strong) |
| B5 | **Stage-appropriate framing** — Imagine = imagining (no plan-talk); the plan is assembled in Stage 4. | should be enforced by module copy; currently violated in 1.day |
| B6 | **Right length** — short by default, but length follows the *work*, not a hard turn-cap that truncates real material. | base prompt "LENGTH & SHAPE"; module exchange targets |

The gap between this baseline and today's behaviour is B1, B2, B3 and B5. B4 (no praise) is
mostly upheld in the prompt but **breaks in practice** — see §5, where live Vita opened with
"That's a clear thread," which is exactly the praise-opening the prompt bans.

---

## 3. How the system is put together (so the diagnosis makes sense)

Every Vita turn is built from three layers (in `lib/chatPrompt.ts → buildSystemBlocks`):

1. **Base prompt** — `lib/coachBasePrompt.ts` (`COACH_BASE_PROMPT`). The unchanging voice +
   method. Governs **all** modules and stages. This is where B3 (challenge) is missing.
2. **This module's instructions** — the `sessionInstructions` field on each module in
   `lib/modules.ts`. This is where "don't go deep / 4–6 exchanges / don't reality-check /
   first piece of the plan" live. Per-module, so a fix here is surgical.
3. **Volatile tail** — opening/closing/marker plumbing. Not implicated.

Model + limits (`lib/chatPrompt.ts`, `lib/models.ts`): Vita's chat = **Sonnet 4.6**,
**max_tokens 500**, default temperature, prompt-cached. Mechanical calls = Haiku 4.5.

---

## 4. Programme-wide audit (module × behaviour)

Two things feed this table: (a) a static read of every module's `sessionInstructions`
against the four behaviours, and (b) a **live reproduction** on real Vita for the three
starred rows (§5), used to calibrate the static predictions. "Depth cap" is the module's own
stated exchange target.

Legend — ✅ upholds baseline · ⚠️ weak / at risk · ❌ fails baseline.

### Stage 1 — Imagine (working) / Review (retired)

| Module | Depth of inquiry (B1/B2) | Challenge incoherence (B3) | Length (B6) | Framing (B5) |
|---|---|---|---|---|
| 1.winddown | ⚠️ "1–2 exchanges, not a deep dive" | ⚠️ no challenge instruction | short by design | ✅ |
| 1.worklife (retired) | ✅ "5–7 exchanges", handles identity/loss with care | ⚠️ care-focused, not challenge | ok | ✅ |
| **★ 1.day** | ❌ "don't go deep", "at most one light follow-up", 4–6 | ❌ "MUST NOT reality-check or judge whether realistic" | ❌ over-capped | ❌ "**first piece of their Retirement Life Plan**" |
| 1.money | ⚠️ light/playful, quick | ⚠️ none | short | ✅ |
| **★ 1.roles** | ❌ "keep it light … don't go deep", 4–6 | ⚠️ none stated — *but live Vita caught a logistical clash here* (§5) | capped | ✅ |
| 1.week | ⚠️ light, 4–6 | ❌ "meet it with curiosity **rather than challenge**" | capped | ✅ |
| 1.letter | ⚠️ letter is the output | ⚠️ none | — | ✅ |

### Stage 2 — Explore ("go deeper, area by area")

> **Finding:** the programme's own arc calls Stage 2 "you go deeper area by area", yet
> **every Stage 2 module's instruction says "light Explore-stage module — keep it short …
> 4–6 exchanges" (2.5 says "3–4").** Explore is instructed to be as shallow as Imagine. This
> is the clearest evidence the depth regression is systemic, not a 1.day quirk.

| Module | Depth (B1/B2) | Challenge (B3) | Length | Framing |
|---|---|---|---|---|
| 2.1 Staying active | ❌ "light … keep it short", 4–6 | ⚠️ none | capped | ✅ |
| 2.2 A curious mind | ❌ "light … keep it short", 4–6 | ⚠️ none | capped | ✅ |
| 2.3 People around you | ❌ "light … keep it short", 4–6 | ⚠️ none | capped | ✅ |
| 2.4 A sense of purpose | ⚠️ conversation-only, still "keep it short", 4–6 | ⚠️ none | capped | ✅ |
| 2.5 Energy & resilience | ❌ "keep it short", **3–4** | ⚠️ none; non-prescriptive | capped | ✅ |
| 2.6 Your senses | ⚠️ screening, one-step close | n/a (practical) | short | ✅ |

### Stage 3 — Understand ("what matters most")

> **Finding:** Stage 3 is the one stage that *preserves* real drawing-out. Its instructions
> say things like "the heart of this — and it's yours to draw out through dialogue" (3.1) and
> "draw out a short, personal description" (3.2). Depth here is ✅ — though still capped at
> 4–6 exchanges, and still with no challenge/coherence instruction.

| Module | Depth (B1/B2) | Challenge (B3) | Length | Framing |
|---|---|---|---|---|
| 3.1 Your strengths | ✅ "draw out through dialogue" | ⚠️ none | 4–6 | ✅ |
| 3.2 Your values | ✅ "draw out real descriptions" | ⚠️ none | 4–6 | ✅ |
| 3.3 What matters most | ✅ ranking/tension work | ⚠️ softened by base "rank without forcing" | 4–6 | ✅ |
| 3.4 Living your values | ✅ threats + protectors | ⚠️ none | 4–6 | ✅ |
| 3.5 Hopes and fears | ✅ | ⚠️ none | 4–6 | ✅ |
| 3.6 The bigger picture | ✅ reflective, "let them set the pace" | ⚠️ none | 4–6 | ✅ |

### Stage 4 — Plan

> **Finding:** Stage 4's conversation is deliberately thin because the *widgets* + Sonnet
> draft-seeds do the heavy lifting; the chat is "2–3 exchanges … light shaping." That's a
> defensible design choice here (unlike in Explore). 4.1/4.2 keep more depth ("5–7
> exchanges", "draw out what sits underneath").

| Module | Depth (B1/B2) | Challenge (B3) | Length | Framing |
|---|---|---|---|---|
| 4.1 Leave work (working only) | ✅ "5–7", "draw out what sits underneath" | ⚠️ none | ok | ✅ |
| 4.2 Chapters | ✅ "5–7" | ⚠️ none | ok | ✅ |
| 4.3 Balanced retirement | ⚠️ curation, widget-led | ⚠️ none | 2–3 | ✅ |
| 4.4 Path to goals | ⚠️ "2–3, light refinement" | ⚠️ none | 2–3 | ✅ |
| 4.5 When you can't do it all | ⚠️ "2–3, light shaping" | ⚠️ trade-off framing exists but "light" | 2–3 | ✅ |
| 4.6 Rhythm of week | ⚠️ "2–3" | ⚠️ none | 2–3 | ✅ |
| 4.7 First year | ⚠️ chat is the control surface | ⚠️ none | — | ✅ |

**Blast radius:** Challenge/coherence (B3) is **absent in all 26 modules** — genuinely
programme-wide. Depth (B1/B2) fails or is at risk across **all of Stage 1 and all of Stage
2** and is fine in Stage 3; Stage 4's brevity is by design. Plan-framing (B5) fails in
**exactly one place** (1.day).

---

## 5. Live reproduction (real Vita, real prompt path)

I ran the exact scenarios through Vita's real assembly (`buildSystemPrompt` + Sonnet 4.6 +
max_tokens 500 — the same code `/api/chat` uses), via a throwaway harness that I deleted
afterward (no code left behind).

### Case A — the two lie-ins (1.day), warm tone
Built day: **Morning: A lie-in**, slow breakfast, walk · Afternoon: gardening, friends,
coffee · **Evening: A lie-in**, TV. User: "Probably the lie-in — both of them … a really
restful, unhurried day."

**Vita replied:**
> "That's a clear thread — the day starts gently and ends gently, with the busier bits
> tucked in the middle. With your partner in the picture too, is this the kind of day you'd
> both want, or is it more your own vision of a perfect day?"

- ❌ **Missed the incongruity.** A lie-in in the *evening* is a contradiction in terms; Vita
  reframed the two lie-ins into a flattering, coherent "starts gently, ends gently" pattern.
- ❌ **Praise-opening the base prompt bans.** "That's a clear thread" ≈ the banned "that's a
  clear answer." The single buried anti-praise bullet does not hold against the model's
  default agreeableness.
- ❌ **No "why", no feeling, no texture** — she moves straight toward closing.

### Case B — same case, professional tone
> "That's a clear through-line — the day starts slow and ends slow … Is that restfulness
> something you get enough of now, or is this day partly a corrective to how life currently
> feels?"

- ❌ Same miss, same reframe. **Tone is not the cause** — the most clipped register fails
  identically. (The one upside: it asked a slightly more probing question — so brevity and
  depth are somewhat separable.)

### Case C — control: an incoherent *logistical* clash (1.roles), warm tone
User picked "full-time carer for my mother (there every day)" **and** "6 months abroad each
year" as the two that matter most.

> "Those two sit in real tension with each other — daily care for your mum and six months
> abroad each year are both important to you, but they'd be hard to hold at the same time.
> Is there something you're already thinking about … other family, paid care, or something
> else?"

- ✅ **Here she DID challenge.** This matters: it shows Vita *retains the capacity* to notice
  a clash — she just doesn't in 1.day, where the instruction actively forbids "judging
  whether the picture is realistic," and where the clash is a subtle category error (evening
  lie-in) rather than an obvious real-world impossibility.

**Interpretation.** The sycophancy is worst exactly where (a) the module suppresses
reality-checking *and* (b) the incoherence is subtle. The root fix is a base-prompt
instruction so coherence-checking is on *by default* everywhere, plus removing the active
suppression in the light modules.

---

## 6. Per-symptom diagnosis (§C)

**Symptom 1 — No depth of inquiry / doesn't ask why / no detail or feeling.**
*Cause: module instructions, not the base prompt or the model.* 1.day's original "draw out
… the feel of the pace … go deeper" was deleted and replaced with "don't go deep / one
light follow-up / 4–6 exchanges" (`2f72448`), and the same shallow template was applied to
all of Stage 1 (`54df386`) and all of Stage 2. The base prompt's new anti-feeling-probe rule
(from `17a1584`) reinforces it by discouraging "how does that feel?" without providing the
intended *concrete* substitute in imaginative modules. **Model routing plays no part** —
still Sonnet.

**Symptom 2 — Sycophancy / no challenge (most damaging).**
*Cause: a permanent gap in the base prompt, aggravated by active anti-challenge copy.* There
has never been an instruction to notice incoherence and check it. "You never flatter" is
passive. Meanwhile 1.day forbids reality-checking, 1.week says "curiosity rather than
challenge," and the base prompt's line 9 says "never contradict" (aimed at prior-module
memory, but it colours the whole posture). Live repro confirms Vita smooths incoherence into
praise. This is the one to fix at the base-prompt level because it touches every module.

**Symptom 3 — Over-brevity.**
*Cause: cumulative.* Module 4–6 (and 3–4, and 2–3) exchange caps + the base prompt's Tier-1
additions ("FIRST RULE plain English", "batch, don't march", "LENGTH & SHAPE", "invite more
only once") + a persistent 500-token ceiling. The 500 cap is *not* a regression (unchanged
since the start) but it is a low ceiling worth revisiting if replies need to breathe.

**Symptom 4 — Plan-framing in an Imagine module.**
*Cause: one line of module copy.* 1.day CLOSING: "Note warmly this is the first piece of
their Retirement Life Plan." Present since the module was first wired (`11e8513`). No other
module speaks this framing. One-line fix.

**Did tone/warmth over-index on agreeableness?** No. The tone directives are register-only
and the failure reproduces on the professional tone. The warmth work is not implicated.

---

## 7. Trace to the causing change(s) (§D)

Timeline (all 2026):

| Date | Commit | What it did | Effect on the four symptoms |
|---|---|---|---|
| 2 Jun | `8786545` | Added the base prompt (first version) | Challenge gap (B3) present from day one |
| 2 Jun | `11e8513` | Wired 1.day; added the "first piece of the plan" line | **Symptom 4 born here** |
| **2 Jun** | **`2f72448`** "lighten Vita in 1.1" | **Deleted "draw out … go deeper" from 1.day; added "don't go deep" + "4–6 exchanges"** | **Symptom 1 & 3 born here** |
| 8–9 Jun | `2b0ee97`, `54df386` | Reworked senses; "aligned Stage 1 to spec" — spread "light … keep it short … 4–6" across Stage 1 | Symptom 1 & 3 widened |
| (Stage 2 build) | — | Stage 2 modules written as "light Explore-stage … keep it short" | Symptom 1 & 3 → programme-wide |
| **30 Jun** | **`17a1584`** "Sharpen Vita's voice" (the Tier-1 feedback round) | Added top plain-English rule, batch-don't-march, length rule, anti-feeling-probe; tone selector; **no challenge instruction** | Entrenched Symptom 1 & 3; left Symptom 2 untouched |
| 1 Jul | `633b3de` | Cost work — Haiku for mechanical calls only | **No effect on Vita's conversation (stays Sonnet)** — ruled out |

**Shared root cause(s):**
- The **depth/brevity** regression traces to a *design decision* — "make the early modules
  light" — first applied to 1.day on 2 June and then propagated across Stages 1–2. It was
  reinforced (not caused) by the Tier-1 base-prompt work.
- The **sycophancy** regression has **no causing commit** — it is an original absence,
  aggravated by the light-module suppression copy. It is the true programme-wide root and
  the highest priority.

---

## 8. Recommended fix + re-test method (§E)

### Fix (proposed — not yet applied)

1. **Base prompt — add a "notice incongruities" block (fixes Symptom 2, everywhere).**
   A short, high-priority instruction such as: *"Listen for things that don't hold together —
   two claims that pull against each other, something that can't both be true, a piece that
   doesn't fit the rest. When you notice one, name it plainly and warmly and check it (…),
   rather than smoothing it into praise. This is not reality-checking their choices or judging
   whether their plans are wise — it's helping them notice their own picture more clearly."*
   Distinguish this from the (correct) "don't judge whether it's realistic" rule so the two
   don't collide.

2. **Loosen the light-module caps (fixes Symptoms 1 & 3 in Stage 1–2).**
   - 1.day: restore a version of "draw out … who's there, what a chosen activity looks like,
     the feel of the pace"; change "don't go deep" to "go deeper on one or two things."
   - Reconsider the blanket "light Explore-stage module — keep it short / 4–6 exchanges" on
     Stage 2 — Explore is meant to be the *deeper* stage.
   - Treat exchange numbers as *targets, not ceilings that truncate real material.*

3. **1.day — delete the plan line (fixes Symptom 4).** Remove "this is the first piece of
   their Retirement Life Plan" from the CLOSING instruction; if a forward nod is wanted, keep
   it to imagining ("this is the first piece of the picture you're building").

4. **Optional — revisit the 500-token ceiling** if, after 1–2, replies feel clipped. It's a
   one-line change (`COACH_MAX_TOKENS`).

**Sequencing:** do #1 and #3 first (smallest, highest-value, low-risk), re-test, then decide
how far to go on #2.

### Re-test method (repeatable, already 80% built)

The repo already has the right tool: **`test/vita-check.report.test.ts`** — it runs fixed
scenarios through Vita's *real* prompt + model across all three tones and writes an HTML
report, and it can diff **old prompt vs new prompt** from git (`COMPARE_OLD`,
`OLD_PROMPT_REV`). Run it with:

```
RUN_VITA_CHECK=1 npx vitest run test/vita-check.report.test.ts
```

Two changes make it a regression guard for *this* problem:

1. **Add challenge + depth scenarios.** Today its 7 scenarios and its automated flags only
   check the Tier-1 voice fixes (banned words, >1 question, >3 paragraphs) — i.e. they reward
   brevity and never test challenge or depth, which is part of *why this slipped through.*
   Add scenarios that plant an incongruity (the two lie-ins; the carer-plus-6-months-abroad
   clash) and a depth probe (a thin one-word day), spanning one module per stage and both
   cohorts.
2. **Add a "challenge" flag / a judge pass.** A cheap automated check ("did the reply name
   the incongruity?") or an LLM-judge column. Then set `COMPARE_OLD = true` with
   `OLD_PROMPT_REV` = the pre-fix commit, and confirm the new prompt flips the incongruity
   scenarios from "validated" to "gently challenged" while keeping the voice flags green.

This gives a before/after, side-by-side, multi-tone HTML report that proves Vita once again
probes depth and challenges incoherence — across stages, not just 1.day.

---

## Appendix — key files

- `lib/coachBasePrompt.ts` — `COACH_BASE_PROMPT` (base voice/method; the challenge gap)
- `lib/modules.ts` — per-module `sessionInstructions` (depth caps, 1.day plan line at ~L1410)
- `lib/chatPrompt.ts` — `buildSystemBlocks`, `COACH_MODEL` (Sonnet 4.6), `COACH_MAX_TOKENS` (500), `TONE_DIRECTIVES`
- `lib/models.ts` — Sonnet vs Haiku routing (Vita = Sonnet)
- `app/api/chat/route.ts` — the streaming coach route + prompt caching
- `test/vita-check.report.test.ts` — the re-test harness to extend
