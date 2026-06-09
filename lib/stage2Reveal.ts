// Shared shapes for the Stage 2 (Explore) stage-close reveal. Unlike the Imagine
// reveal (threads + archetype), Explore walks the six areas of a balanced
// retirement: an intro card, then one card per area — each with a short
// forward-looking line, and on three-to-five of them a locked discovery stat —
// then a closing card hooking into Stage 3 (Understand). No archetype here.
//
// This file holds only the shapes + the safe fallback. Generation lives in
// app/api/stage2-reveal/route.ts; the stat pool + triggers in lib/stage2Stats.ts;
// the selection logic in lib/stage2Selection.ts.

import type { Stage2Area } from "@/lib/stage2Stats";

// The locked half of an area's stat — copied verbatim from the library by the
// API route, never touched by Vita. `leadIn` is the one generated sentence that
// ties the locked claim to this person's choices; the claim then follows.
export type RevealStat = {
  id: string;
  claim: string;
  sourceDisplay: string;
  leadIn: string;
};

// One area card in the reveal. `forwardLine` is always present (a short, plain,
// forward-looking line — what they want, not their answers read back). `stat` is
// present only on the three-to-five areas that carry a discovery stat; a
// stat-free area is breathing room, not a gap.
export type RevealArea = {
  area: Stage2Area;
  areaLabel: string;
  forwardLine: string;
  stat?: RevealStat;
};

// The generated reveal: an intro, the six areas in order, and a closing line
// into Stage 3.
export type Stage2Synthesis = {
  intro: string;
  areas: RevealArea[];
  closing: string;
};

// What we persist so the reveal is revisitable without regenerating or
// re-running selection.
export type SavedStage2Reveal = { synthesis: Stage2Synthesis; savedAt: string };

// The fixed area order + labels for the reveal. Labels are the brief's exact
// reveal-facing wording (note "Energy and wellbeing", not the 2.5 module title).
export const STAGE2_AREA_ORDER: { area: Stage2Area; label: string }[] = [
  { area: "active", label: "Staying active" },
  { area: "cognitive", label: "Keeping your mind alive" },
  { area: "social", label: "The people in your life" },
  { area: "purpose", label: "Purpose and contribution" },
  { area: "vitality", label: "Energy and wellbeing" },
  { area: "senses", label: "Your senses" },
];

// A safe, generic reveal used when generation fails or there's nothing to work
// from, so the screen always renders something coherent. Stat-free throughout —
// the fallback never asserts a number it can't tie to a real choice.
export const FALLBACK_STAGE2_SYNTHESIS: Stage2Synthesis = {
  intro:
    "Here's what came through as you went area by area — the shape of the retirement you're building, one part at a time.",
  areas: [
    {
      area: "active",
      areaLabel: "Staying active",
      forwardLine: "You want movement that fits your life, on your own terms.",
    },
    {
      area: "cognitive",
      areaLabel: "Keeping your mind alive",
      forwardLine: "You want to keep following what genuinely interests you.",
    },
    {
      area: "social",
      areaLabel: "The people in your life",
      forwardLine: "You know the people you'd most like to give time to.",
    },
    {
      area: "purpose",
      areaLabel: "Purpose and contribution",
      forwardLine: "You found a few real sources of feeling useful.",
    },
    {
      area: "vitality",
      areaLabel: "Energy and wellbeing",
      forwardLine: "You named where a little steady care would go furthest.",
    },
    {
      area: "senses",
      areaLabel: "Your senses",
      forwardLine: "You looked at the small habits that keep your senses sharp.",
    },
  ],
  closing:
    "That's a fuller picture of what a good retirement looks like for you. Next, in Understand, we'll look at the strengths you'll draw on — and the hopes and worries underneath it all.",
};

// True when a synthesis is the generic fallback rather than a real one. Used so a
// fallback is never persisted (it would freeze the reveal on the generic version)
// and an already-saved fallback is regenerated on next view. Matches on the fixed
// intro + closing, which a real per-person synthesis won't reproduce.
export function isFallbackStage2Synthesis(
  s: Stage2Synthesis | null | undefined
): boolean {
  if (!s) return false;
  return (
    s.intro === FALLBACK_STAGE2_SYNTHESIS.intro &&
    s.closing === FALLBACK_STAGE2_SYNTHESIS.closing
  );
}
