// Shared shapes for the stage-close reveal. The reveal separates two kinds of
// content: generated-per-user (threads + which archetype + the "why you" line)
// and static type config (name/definition/company, looked up from archetypes.ts
// by id). This file holds only the shapes; generation lives in
// app/api/stage-reveal/route.ts and the static copy in lib/archetypes.ts.

import { DEFAULT_ARCHETYPE_ID } from "@/lib/archetypes";

// One reflected thread: a short synthesised theme label plus a verbatim phrase
// drawn from the person's own Imagine inputs.
export type RevealThread = { themeLabel: string; quote: string };

// The generated half of the reveal — the synthesis interface's output.
export type RevealSynthesis = {
  threads: RevealThread[];
  archetypeId: string;
  // A personalised one-liner tying the type to their own words.
  whyYou: string;
  // An optional lighter second type, for a "with a streak of …" blend.
  secondaryId?: string;
};

// What we persist so the reveal is revisitable without regenerating.
export type SavedStageReveal = { synthesis: RevealSynthesis; savedAt: string };

// A safe, generic synthesis used when generation fails or no inputs exist, so
// the screen always renders something coherent.
export const FALLBACK_SYNTHESIS: RevealSynthesis = {
  threads: [
    {
      themeLabel: "Space, but not emptiness",
      quote: "I want my time to feel slow, but not aimless.",
    },
    {
      themeLabel: "People, deliberately",
      quote: "I don't want to wait for the phone to ring.",
    },
    {
      themeLabel: "Doing something that counts",
      quote: "I'm not done being useful.",
    },
  ],
  archetypeId: DEFAULT_ARCHETYPE_ID,
  whyYou:
    "slow days that aren't aimless, people you reach for first, and a clear sense you're not done being useful.",
};
