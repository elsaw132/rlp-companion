// Shared shapes for the Stage 3 (Understand) stage-close reveal — the Wrapped-
// style card sequence. Unlike Stage 1 (threads + archetype) and Stage 2 (the
// six-area wheel), Understand assembles a portrait across coloured cards tied
// together by a thread: an opener, a strengths profile, a values profile, the
// through-line, what they'll protect, the fears they named, the meaning of these
// years, and a step into Plan.
//
// This file holds only the shapes + the safe fallback. Generation lives in
// app/api/stage3-reveal/route.ts; the card sequencing in UnderstandReveal.tsx and
// the presentation in UnderstandCards.tsx.

// The connective + characterising copy the model writes. Everything the person
// said in their own words — their strength labels, the wording of their top
// value, their other core values — is carried verbatim from their confirmed
// builds and placed by the route, never reworded by the model.
export type Stage3Generated = {
  // Card 1 — opener. Frames the reveal; may name the person.
  opener: string;
  // Card 2 — strengths. The profile is the hero line; the carry note is forward.
  strengthsProfile: string;
  strengthsCarry: string;
  // Card 3 — values. The profile is the hero; the breadth note is forward.
  valuesProfile: string;
  valuesBreadth: string;
  // Card 4 — the through-line. `throughLine` is "" when no clear thread is found,
  // in which case the card is dropped (see §6 of the spec).
  throughLine: string;
  throughLineTrace: string;
  // Card 5 — what they'll protect.
  protect: string;
  // Card 6 — clear-eyed (the fears, brief and answered by agency).
  clearEyed: string;
  // Card 7 — finale. `chapterTitle` is "" when not earned, so the finale leads
  // with the meaning statement alone.
  chapterTitle: string;
  meaning: string;
};

// The assembled reveal the UI renders: the generated copy plus the person's own
// words, echoed verbatim by the route.
export type Stage3Synthesis = Stage3Generated & {
  // Card 2 — the signature strengths, exactly as confirmed (the evidence chips).
  strengthsChips: string[];
  // Card 3 — the top value in the person's own words ("" if they wrote none),
  // and the rest of the core values as chips.
  valuesTop: string;
  valuesChips: string[];
};

// What we persist so the reveal is stable on revisit / back-navigation without
// regenerating (spec §9).
export type SavedStage3Reveal = { synthesis: Stage3Synthesis; savedAt: string };

// The ordered cards the sequence renders. The orchestrator builds this from the
// synthesis, dropping content cards whose material is thin (spec §6). The thread
// motif runs one node per card, so dropping a card simply shortens the thread.
export type RevealCard =
  | { kind: "opener"; name: string | null; line: string }
  | { kind: "strengths"; profile: string; chips: string[]; carry: string }
  | {
      kind: "values";
      profile: string;
      top: string;
      chips: string[];
      breadth: string;
    }
  | { kind: "thread"; name: string; trace: string }
  | { kind: "protect"; line: string }
  | { kind: "clearEyed"; line: string }
  | { kind: "finale"; chapterTitle: string; meaning: string }
  | { kind: "forward"; primaryHref: string };

// A safe, generic reveal used when generation fails or there's nothing to work
// from, so the screen always renders something coherent. Empty chips and an empty
// through-line mean the chip rows and the thread card simply don't appear — the
// fallback never asserts material it can't ground in a real confirmation.
export const FALLBACK_STAGE3_SYNTHESIS: Stage3Synthesis = {
  opener:
    "Here's the person who's been taking shape across this stage — drawn from what you confirmed, one piece at a time.",
  strengthsProfile: "The strengths you recognised as most yours.",
  strengthsCarry: "These are the things you'll lean on in the years ahead.",
  strengthsChips: [],
  valuesProfile: "What matters most to you, in your own words.",
  valuesBreadth: "Together they shape the breadth of the life you're building.",
  valuesTop: "",
  valuesChips: [],
  throughLine: "",
  throughLineTrace: "",
  protect:
    "You've already named the things worth protecting as your plan takes shape.",
  clearEyed:
    "You didn't look away from the harder parts — and naming them is what lets the plan answer them.",
  chapterTitle: "",
  meaning:
    "This is the heart of what these years are for — to carry into the rest of your plan.",
};

// True when a synthesis is the generic fallback rather than a real one. Used so a
// fallback is never persisted (it would freeze the reveal on the generic version)
// and an already-saved fallback is regenerated on next view. Matches on the fixed
// opener + meaning, which a real per-person synthesis won't reproduce.
export function isFallbackStage3Synthesis(
  s: Stage3Synthesis | null | undefined
): boolean {
  if (!s) return false;
  return (
    s.opener === FALLBACK_STAGE3_SYNTHESIS.opener &&
    s.meaning === FALLBACK_STAGE3_SYNTHESIS.meaning
  );
}
