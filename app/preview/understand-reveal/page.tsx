"use client";

// TEMPORARY PREVIEW PAGE — the Stage 3 (Understand) reveal with ALL eight cards
// populated, so the full sequence can be seen end to end. A real person's reveal
// drops any card whose material is thin (see UnderstandReveal), so this is the
// only way to view the complete set. Renders the real StageArc + UnderstandCards,
// so it reflects the actual components. Nothing is saved. Safe to delete.

import ProviderBand from "../../components/ProviderBand";
import StageArc from "../../components/StageArc";
import UnderstandCards from "../../components/UnderstandCards";
import type { RevealCard } from "@/lib/stage3Reveal";

const arc = [
  { number: 1, name: "Imagine", done: true },
  { number: 2, name: "Explore", done: true },
  { number: 3, name: "Understand", done: true },
  { number: 4, name: "Plan", done: false },
  { number: 5, name: "Act", done: false },
];

const cards: RevealCard[] = [
  {
    kind: "opener",
    name: "Elsa",
    line: "That's the understanding done, Elsa. You named the strengths you will carry forward, the values you want to live by, and what matters most to you in this chapter — here's the person that came through.",
  },
  {
    kind: "strengths",
    profile: "Honesty and humility, with an eye that catches what's beautiful.",
    chips: ["Honesty", "Humility", "Appreciation of beauty", "Curiosity"],
    carry:
      "These strengths will let you move through retirement with clarity about what matters and who you are — without the noise.",
  },
  {
    kind: "values",
    profile: "A pull towards closeness, openness, and beauty woven through.",
    top: "Being close to the people who know me best, and keeping that easy.",
    chips: ["Intimacy", "Openness", "Beauty", "Honesty"],
    breadth:
      "You're already living across intimacy, connection, and the spaces where you notice what's good to look at.",
  },
  {
    kind: "thread",
    name: "Seeing clearly",
    trace:
      "It runs through the honesty you lead with, the closeness you protect, and what you said these years are really for.",
  },
  {
    kind: "protect",
    line: "The slow mornings, and the time with the people closest to you — you've said those come first, whatever else the years hold.",
  },
  {
    kind: "clearEyed",
    line: "You named the worry about losing structure, and about the days blurring into one another. Naming it is what lets the plan answer it.",
  },
  {
    kind: "finale",
    chapterTitle: "Seeing clearly",
    meaning:
      "These years are for seeing things as they are, and choosing them anyway. Less noise, fewer obligations, and more of the people and places that make you feel like yourself.",
  },
  { kind: "forward", primaryHref: "/home" },
];

export default function UnderstandRevealPreview() {
  return (
    <>
      <ProviderBand />
      <div
        style={{
          background: "var(--info-surface)",
          borderBottom: "1px solid var(--info-line)",
          padding: "10px 18px",
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          color: "var(--info-text)",
          display: "flex",
          gap: "16px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <strong>Preview mode</strong>
        <span>
          The Understand reveal with all eight cards populated. Nothing is saved.
        </span>
      </div>

      <main
        style={{
          maxWidth: "var(--content-max)",
          width: "100%",
          margin: "0 auto",
          padding: "32px 16px 56px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <StageArc arc={arc} />
        <UnderstandCards cards={cards} currentStage={3} returnHref="/home" />
      </main>
    </>
  );
}
