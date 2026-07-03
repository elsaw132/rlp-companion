// Retirement-paths — Phase 2 copy sweep.
//
// The module copy in lib/modules.ts is written for someone who HASN'T retired
// yet (the default, pre-retirement voice). This layer rewrites the specific
// pre-retirement-assuming phrases per retirement stage, for the modules that
// don't restructure — Stage 2 (all), Stage 3 (all). It's a targeted find/replace
// so lib/modules.ts stays untouched and the flag-off path is trivially identical.
//
// How it stays safe:
//   - Nothing happens unless the RETIREMENT_PATHS flag is on AND the person is in
//     a stage that needs a rewrite (winding_down / recently_retired / established).
//     "working" reads as pre-retirement, so it keeps today's copy unchanged, as
//     does an unset stage.
//   - Each rule's `find` is an exact sentence/clause from the live copy. If the
//     underlying copy is later reworded, retirementCopy.test.ts fails (the rule no
//     longer matches), so a silent drift back to the future-tense default can't
//     ship unnoticed.
//
// Onboarding display copy (§5) is handled inline in app/onboarding/page.tsx, not
// here: it's shown before the status question is answered, so it can't be tailored
// per stage — it's made status-neutral behind the flag instead.

import type { RetirementStage } from "@/lib/userData";
import { RETIREMENT_PATHS } from "@/lib/flags";

// The three stages that need tailored copy. "working" and an unset stage keep the
// default (forward-looking) copy, so they're deliberately excluded here.
export type TailoredStage = "winding_down" | "recently_retired" | "established";
export const TAILORED_STAGES: TailoredStage[] = [
  "winding_down",
  "recently_retired",
  "established",
];

type Variants = Record<TailoredStage, string>;

// Build a variant set. Winding-down is usually present-progressive ("as work
// winds down"); recently-retired is present ("since work ended, you may have
// noticed"); established is settled/retrospective. Where recently-retired and
// established share wording, pass two args.
function v(
  winding_down: string,
  recently_retired: string,
  established: string = recently_retired
): Variants {
  return { winding_down, recently_retired, established };
}

type Rule = { find: string; variants: Variants };

// Each rule targets one flagged phrase. Grouped by module; the comment gives the
// module id and the investigation section it comes from (findings/
// retirement-paths-investigation-result.md §7 = Stage 2, §8 = Stage 3).
export const RULES: Rule[] = [
  // ---- Stage 2 intro (§7) ----------------------------------------------------
  {
    find: "In Imagine, you sketched the shape of the retirement you want.",
    variants: v(
      "In Imagine, you sketched the shape of the retirement you're moving into.",
      "In Imagine, you pictured the retirement you're settling into.",
      "In Imagine, you pictured the retirement you're living."
    ),
  },

  // ---- 2.2 Keeping your mind alive (§7) --------------------------------------
  {
    find: "Work quietly keeps the mind busy all day — decisions, new problems, fresh information, people to read. When that goes, the stimulation can go with it, and that matters more than most people expect:",
    variants: v(
      "Work quietly keeps the mind busy all day — decisions, new problems, fresh information, people to read. As work winds down, that stimulation can ease off with it, and that matters more than most people expect:",
      "Work quietly kept the mind busy all day — decisions, new problems, fresh information, people to read. Since work ended, you may already have noticed some of that stimulation fall away, and it matters more than most people expect:",
      "Work keeps the mind busy all day — decisions, new problems, fresh information, people to read. When it ends, that stimulation can go with it, and it stays just as true years on:"
    ),
  },

  // ---- 2.3 The people in your life (§7) --------------------------------------
  {
    find: "is the bit that often goes quietest when the commute and colleagues do, and it's the one most people don't see coming.",
    variants: v(
      "is the bit that often goes quietest as the commute and colleagues drop away, and it's the one most people don't see coming.",
      "is the bit that often goes quietest once the commute and colleagues do, and it's the one most people don't see coming — you may be noticing it now.",
      "is the bit that often went quietest when the commute and colleagues did, and it's the one most people don't see coming."
    ),
  },
  {
    // 2.3 sessionInstructions mirrors the primer line — keep the two in step.
    find: "and that's the bit that goes quietest when commute and colleagues do.",
    variants: v(
      "and that's the bit that goes quietest as commute and colleagues drop away.",
      "and that's the bit that goes quietest once commute and colleagues do.",
      "and that's the bit that went quietest when commute and colleagues did."
    ),
  },

  // ---- 2.4 Purpose and contribution (§7) -------------------------------------
  // RR = describes their current state; EST = a phase they've passed.
  {
    find: "For many people, work is the main source of purpose and identity — and losing it is more destabilising than expected, with retirement satisfaction often dipping in the first year or two before new sources of meaning take hold.",
    variants: v(
      "For many people, work is the main source of purpose and identity — and stepping back from it is more destabilising than expected, with retirement satisfaction often dipping in the first year or two before new sources of meaning take hold.",
      "For many people, work is the main source of purpose and identity — and losing it is more destabilising than expected. Retirement satisfaction often dips in the first year or two, right where you are now, before new sources of meaning take hold.",
      "For many people, work was the main source of purpose and identity — and losing it is more destabilising than expected, with retirement satisfaction often dipping in the first year or two. You'll likely have come through that dip and found some of those new sources by now."
    ),
  },

  // ---- 2.5 Energy, sleep and feeling well (§7) -------------------------------
  {
    find: "and a working routine can hide the early signs — so small habits compound powerfully across a 20–30 year retirement, in both directions.",
    variants: v(
      "and as work reduces, the routine that can hide the early signs falls away — so small habits compound powerfully across a 20–30 year retirement, in both directions.",
      "and the working routine that used to hide the early signs has gone — so small habits compound powerfully across a 20–30 year retirement, in both directions.",
      "and the working routine that once hid the early signs is behind you now — so small habits compound powerfully across a 20–30 year retirement, in both directions."
    ),
  },

  // ---- Stage 3 intro (§8) ----------------------------------------------------
  {
    find: "In Imagine you pictured the retirement you want, and in Explore you looked at it area by area.",
    variants: v(
      "In Imagine you pictured the retirement you're moving into, and in Explore you looked at it area by area.",
      "In Imagine you pictured the retirement you're settling into, and in Explore you looked at it area by area.",
      "In Imagine you pictured the retirement you're living, and in Explore you looked at it area by area."
    ),
  },

  // ---- 3.1 Your strengths (§8) — coachOpening + three session-instruction refs
  {
    find: "where do you picture it actually living in the retirement you've been designing?",
    variants: v(
      "where do you picture it actually living in the retirement you're moving into?",
      "where do you picture it actually living in the life you're settling into now?",
      "where do you picture it actually living in the life you're living now?"
    ),
  },
  {
    find: "Help each signature strength find a real home in the retirement they're designing.",
    variants: v(
      "Help each signature strength find a real home in the retirement they're moving into.",
      "Help each signature strength find a real home in the life they're settling into now.",
      "Help each signature strength find a real home in the life they're living now."
    ),
  },
  {
    find: "where might this live in the retirement you've been picturing?",
    variants: v(
      "where might this live in the retirement you're moving into?",
      "where might this live in the life you're settling into now?",
      "where might this live in the life you're living now?"
    ),
  },
  {
    find: "A strength has only ever lived in a work role they're leaving — help them find where it lives once the job no longer carries it.",
    variants: v(
      "A strength has only ever lived in a work role they're stepping back from — help them find where it lives as the job carries less of it.",
      "A strength has only ever lived in a work role that's now ended — help them find where it lives now the job no longer carries it.",
      "A strength has only ever lived in a work role that's now behind them — help them find where it lives now the job no longer carries it."
    ),
  },

  // ---- 3.2 Your values (§8) --------------------------------------------------
  {
    find: "In working life they often go unspoken, carried along by the job and the routine. In retirement they matter even more: with more of your time your own to shape, what you value is what tells you how to spend it.",
    variants: v(
      "In working life they often go unspoken, carried along by the job and the routine. As work winds down they matter even more: with more of your time becoming your own to shape, what you value is what tells you how to spend it.",
      "In working life they often went unspoken, carried along by the job and the routine. In retirement they matter even more: now more of your time is your own to shape, what you value is what tells you how to spend it.",
      "In working life they often went unspoken, carried along by the job and the routine. In retirement they matter even more: with your time your own to shape, what you value is what tells you how to spend it."
    ),
  },

  // ---- 3.5 Hopes and fears (§8) — description + the three-horizon framing -----
  {
    // Winding-down is still moving in, so the future framing stays right for them.
    find: "what you're hoping for, and what worries you, as you move into retirement and beyond.",
    variants: v(
      "what you're hoping for, and what worries you, as you move into retirement and beyond.",
      "what you're hoping for, and what worries you, in retirement and the years ahead.",
      "what you're hoping for, and what worries you, in retirement and the years ahead."
    ),
  },
  {
    // EST: de-emphasise "the transition" horizon; keep the later two.
    find: "grouped by when they tend to show up — the change itself, the years that follow, and the longer view.",
    variants: v(
      "grouped by when they tend to show up — the change itself, the years that follow, and the longer view.",
      "grouped by when they tend to show up — settling in, the years that follow, and the longer view.",
      "grouped by when they tend to show up — life in retirement now, and the longer view."
    ),
  },

  // ---- Stage 1 → Review, retired cohorts (Phase 4) ---------------------------
  // Present-tense reframes of the Imagine modules for people already living
  // retirement. winding_down keeps the default (future) copy — its Stage 1 stays
  // "Imagine"; only the retired cohorts get "Review". RR and EST share the copy;
  // the depth difference is carried by Vita via the onboarding status line.

  // 1.day — a good day now (+ the "what you'd change" flag, via the opening)
  {
    find: "A guided picture of one ordinary day in your future — a Tuesday in October, a few years from now.",
    variants: v(
      "A guided picture of one ordinary day in your future — a Tuesday in October, a few years from now.",
      "A guided picture of one ordinary good day in your retirement as it is now — a Tuesday in October."
    ),
  },
  {
    find: "Before you can plan a retirement, it helps to be able to picture one. Not the big milestones — just an ordinary day. In a moment, Vita will walk you through one: a Tuesday in October, a few years from now. There are no right answers, and nothing to work out.",
    variants: v(
      "Before you can plan a retirement, it helps to be able to picture one. Not the big milestones — just an ordinary day. In a moment, Vita will walk you through one: a Tuesday in October, a few years from now. There are no right answers, and nothing to work out.",
      "A good way to take stock is to picture an ordinary day as it is now. Not the big milestones — just a normal Tuesday in October. In a moment, Vita will walk you through one, so you can see the shape of your days and notice what's working and what you'd want more or less of. There are no right answers."
    ),
  },
  {
    find: "Here's the day you've put together. Let's talk it through — looking at the whole thing, which part are you most looking forward to?",
    variants: v(
      "Here's the day you've put together. Let's talk it through — looking at the whole thing, which part are you most looking forward to?",
      "Here's the day you've put together. Let's talk it through — looking at the whole thing, which part of it works best as it is? And is there anything you'd want more or less of?"
    ),
  },

  // 1.roles — the roles you play now
  {
    find: "Beyond what you'll do — who you want to be. The roles that give your retirement shape and meaning.",
    variants: v(
      "Beyond what you'll do — who you want to be. The roles that give your retirement shape and meaning.",
      "Beyond what you do — who you are. The roles that give your retirement its shape and meaning now, and any you'd still like to grow into."
    ),
  },
  {
    find: "This module is about which of those you want to carry into retirement, and which you'd like to grow into for the first time.",
    variants: v(
      "This module is about which of those you want to carry into retirement, and which you'd like to grow into for the first time.",
      "This module is about the roles you play now, the ones that matter most to you, and any you'd still like to grow into."
    ),
  },

  // 1.week — your week as it is
  {
    find: "A day is a snapshot; a week is a rhythm. The shape, balance, and pace you want across your time.",
    variants: v(
      "A day is a snapshot; a week is a rhythm. The shape, balance, and pace you want across your time.",
      "A day is a snapshot; a week is a rhythm. The shape, balance, and pace of your time as it is now — and anything you'd like to shift."
    ),
  },
  {
    find: "This module is about the rhythm of your retirement — how much routine, variety, and rest feels right across the week, and how it might shift with the seasons.",
    variants: v(
      "This module is about the rhythm of your retirement — how much routine, variety, and rest feels right across the week, and how it might shift with the seasons.",
      "This module is about the rhythm of your retirement as it is now — how much routine, variety, and rest you have across the week, what's working, and what you'd like to shift."
    ),
  },
  {
    find: "Here's the balance you've set for your ideal week. Which of these did you feel most strongly about?",
    variants: v(
      "Here's the balance you've set for your ideal week. Which of these did you feel most strongly about?",
      "Here's the balance of your week as it is now. Which of these did you feel most strongly about — and is there anything you'd like to shift?"
    ),
  },
];

// Rewrite one string for a person's retirement stage. A no-op — returns the input
// unchanged — when the flag is off, the stage is unset, or the stage is "working"
// (all of which keep today's forward-looking copy). Applies every matching rule,
// so a single field carrying more than one flagged phrase (e.g. 3.1's session
// instructions) is fully covered.
export function tailorCopy(
  text: string,
  stage: RetirementStage | null
): string {
  if (!RETIREMENT_PATHS) return text;
  if (stage === null || stage === "working") return text;
  let out = text;
  for (const rule of RULES) {
    if (out.includes(rule.find)) out = out.replace(rule.find, rule.variants[stage]);
  }
  return out;
}
