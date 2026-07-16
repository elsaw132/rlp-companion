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
  // Only the opening clause is rewritten; the rest of the paragraph is the same
  // for everyone. The retired cohorts met Stage 1 as "Review" (stageNameFor), so
  // naming "Imagine" back to them would point at a stage they never saw.
  {
    find: "In Imagine, you sketched the shape of the retirement you want.",
    variants: v(
      "In Imagine, you sketched the shape of the retirement you're moving into.",
      "In Review, you pictured the retirement you're settling into.",
      "In Review, you pictured the retirement you're living."
    ),
  },

  // ---- 2.2 Keeping your mind alive (§7) --------------------------------------

  // ---- 2.3 The people in your life (§7) --------------------------------------
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

  // ---- 2.5 Energy, sleep and feeling well (§7) -------------------------------

  // ---- Stage 3 intro (§8) ----------------------------------------------------
  {
    find: "In Imagine you pictured the retirement you want, and in Explore you looked at the elements of a balanced retirement one by one.",
    variants: v(
      "In Imagine you pictured the retirement you're moving into, and in Explore you looked at the elements of a balanced retirement one by one.",
      "In Review you pictured the retirement you're settling into, and in Explore you looked at the elements of a balanced retirement one by one.",
      "In Review you pictured the retirement you're living, and in Explore you looked at the elements of a balanced retirement one by one."
    ),
  },

  // ---- Stage 4 intro ---------------------------------------------------------
  // Three rewrites: the heading (the retired cohorts are reshaping a retirement
  // they're living, not making a plan for one ahead), the backward reference,
  // and the plan DOCUMENT's name — Retirement Life Plan for those still working
  // toward it, Retirement Reset Plan for those already in it (see planTitleFor).
  // Note this is the document name only; the Stage 4 label is always "Plan".
  {
    find: "Now let's make your plan",
    variants: v("Now let's make your plan", "Now let's shape your reset"),
  },
  {
    find: "In Imagine you pictured the retirement you want, in Explore you looked at the elements of a balanced retirement one by one, and in Understand you found what sits beneath it. Now the work changes gear — from understanding what matters to deciding what to do about it: when and how you'll leave work, the goals worth pursuing, and the shape of an ordinary week.",
    variants: v(
      "In Imagine you pictured the retirement you're moving into, in Explore you looked at the elements of a balanced retirement one by one, and in Understand you found what sits beneath it. Now the work changes gear — from understanding what matters to deciding what to do about it: how you'll finish leaving work, the goals worth pursuing, and the shape of an ordinary week.",
      "In Review you pictured the retirement you're settling into, in Explore you looked at the elements of a balanced retirement one by one, and in Understand you found what sits beneath it. Now the work changes gear — from understanding what matters to deciding what to do about it: the goals worth pursuing, and the shape of an ordinary week now work is behind you.",
      "In Review you pictured the retirement you're living, in Explore you looked at the elements of a balanced retirement one by one, and in Understand you found what sits beneath it. Now the work changes gear — from understanding what matters to deciding what to do about it: the goals still worth pursuing, and the shape of an ordinary week."
    ),
  },
  {
    find: "Together, these sessions build your Retirement Life Plan — the heart of the whole programme. Take them in order; each adds a piece.",
    variants: v(
      "Together, these sessions build your Retirement Life Plan — the heart of the whole programme. Take them in order; each adds a piece.",
      "Together, these sessions build your Retirement Reset Plan — the heart of the whole programme. Take them in order; each adds a piece."
    ),
  },

  // ---- Stage 5 intro ---------------------------------------------------------
  // Only the closing paragraph moves: how immediately useful Act's sessions are
  // depends entirely on how far into retirement someone already is.
  {
    find: "Some won't come into their own until retirement is closer, and that's fine — they'll be here when you need them. You can revisit your plan any time.",
    variants: v(
      "A few are most useful just as you finish leaving work, and that's fine — they'll be here when the moment comes. You can revisit your plan any time.",
      "Now you're retired, most of these are immediately useful — start wherever feels most alive. You can revisit your plan any time.",
      "Most of these speak straight to where you are — start wherever feels most alive. You can revisit your plan any time."
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
    find: "Before you begin planning, it helps to imagine what life might feel like when work is no longer setting the rhythm.\nNot the whole picture - just one ordinary day.\nTake a little time to watch the video below:",
    variants: v(
      "Before you begin planning, it helps to imagine what life might feel like when work is no longer setting the rhythm.\nNot the whole picture - just one ordinary day.\nTake a little time to watch the video below:",
      "You're living these days now, rather than imagining them.\nSo let's look at an ordinary one. Not the whole of retirement — just a typical day as it is for you now.\nTake a moment with the clip below:"
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
    find: "Have you ever noticed how easily roles find us?\n\nSome arrive with ceremony. Others appear so gradually that we hardly notice we've taken them on. We become the organiser, the helper, the listener, the mender, the coach, the volunteer.\n\nThe interesting thing is that roles aren't fixed. Some we carry forward because they still bring us energy and purpose. Others we can gently lay down. As work takes up less of your week, there is often space for entirely new roles to emerge. You don't have to keep playing yesterday's part, and you don't have to audition for someone else's.\n\nWhich roles still feel like you and which new ones are quietly waiting for an invitation?",
    variants: v(
      "Have you ever noticed how easily roles find us?\n\nSome arrive with ceremony. Others appear so gradually that we hardly notice we've taken them on. We become the organiser, the helper, the listener, the mender, the coach, the volunteer.\n\nThe interesting thing is that roles aren't fixed. Some we carry forward because they still bring us energy and purpose. Others we can gently lay down. As work takes up less of your week, there is often space for entirely new roles to emerge. You don't have to keep playing yesterday's part, and you don't have to audition for someone else's.\n\nWhich roles still feel like you and which new ones are quietly waiting for an invitation?",
      "Have you ever noticed how easily roles find us? Some arrive with ceremony. Others appear so gradually that we hardly notice we've taken them on — the organiser, the helper, the listener, the mender, the coach, the volunteer.\n\nNow that work no longer takes up the week, the roles you play are more your own than they've ever been. Some you carry forward because they still bring energy and purpose. Others you may already, quietly, have set down. And there's more room than there used to be for entirely new ones to appear.\n\nYou don't have to keep playing yesterday's part, and you don't have to audition for someone else's.\n\nWhich roles still feel like you, and which new ones are quietly waiting for an invitation?"
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
  // 1.week's primer is no longer tailored: the content drop gives it one set of
  // copy for every cohort, so there's nothing cohort-specific left to rewrite.
  // Its description and coachOpening below still are.
  {
    find: "Here's the balance you've set for your ideal week. Which of these did you feel most strongly about?",
    variants: v(
      "Here's the balance you've set for your ideal week. Which of these did you feel most strongly about?",
      "Here's the balance of your week as it is now. Which of these did you feel most strongly about — and is there anything you'd like to shift?"
    ),
  },

  // ---- 4.7 "Your first year" → "Your next year" (winding-down + retired) ----------
  // For anyone winding down or already retired, the year they're shaping is not their
  // FIRST year of retirement — so the title (titleFor), the primer, the description,
  // the coach opening, the session instructions and the exercise labels all reframe to
  // "your next year". The same wording fits all three non-working cohorts.
  {
    find: "your first year of retirement",
    variants: v("your next year", "your next year"),
  },
  {
    find: "Here's your first year, laid out as one journey",
    variants: v(
      "Here's your next year, laid out as one journey",
      "Here's your next year, laid out as one journey"
    ),
  },
  {
    find: "laying your first year out as a journey",
    variants: v(
      "laying your next year out as a journey",
      "laying your next year out as a journey"
    ),
  },
  {
    find: "This is your first year — the shape of it, the story of it.",
    variants: v(
      "This is your next year — the shape of it, the story of it.",
      "This is your next year — the shape of it, the story of it."
    ),
  },
  {
    find: "the year you're stepping into.",
    variants: v("the year ahead.", "the year ahead."),
  },
  {
    find: "sequenced first year",
    variants: v("sequenced next year", "sequenced next year"),
  },
  {
    find: "Your first year",
    variants: v("Your next year", "Your next year"),
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
