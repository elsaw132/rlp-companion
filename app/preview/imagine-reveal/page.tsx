"use client";

// TEMPORARY PREVIEW PAGE — the Imagine reveal in its RETIRED ("Your retirement,
// reviewed") variant, with representative content, so the retired cohort's reveal
// can be checked without a retired account or the real generation. Renders the real
// StageReveal + ArchetypeBlock, so it reflects the actual components. Nothing is
// saved. Safe to delete once reviewed.

import ProviderBand from "../../components/ProviderBand";
import StageReveal from "../../components/StageReveal";
import ArchetypeBlock from "../../components/ArchetypeBlock";
import { STAGES, stageNameFor } from "@/lib/modules";
import { stageColorFor } from "@/lib/stageColors";

const RETIRED = "recently_retired" as const;

const arc = STAGES.map((s) => ({
  number: s.number,
  name: stageNameFor(s, RETIRED),
  done: s.number === 1,
}));

const threads = [
  {
    themeLabel: "Space you've made",
    quote: "The mornings are mine again, and I want to keep them that way.",
  },
  {
    themeLabel: "People, on purpose",
    quote: "I see more of the grandchildren now — that's not slowing down.",
  },
  {
    themeLabel: "Still worth doing",
    quote: "I'm not done being useful; I just get to choose the work now.",
  },
];

export default function ImagineReviewRevealPreview() {
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
          The retired &ldquo;Review&rdquo; variant of the Imagine reveal, with
          sample content. Nothing is saved.
        </span>
      </div>

      <StageReveal
        arc={arc}
        bandColor={stageColorFor(1)}
        eyebrow="Where your plan begins"
        title="Your retirement, reviewed"
        vitaIntro={
          "That's the taking stock done, Margaret. Here's what you kept coming back to —"
        }
        threads={threads}
        payoff={
          <ArchetypeBlock
            name="The Unhurried Builder"
            definition="Unhurried Builders want a slower life that's still going somewhere: ease and space, but with purpose, people and work worth doing kept firmly in the picture."
            whyYou="You're after ease and presence with the people closest to you, but you're not stopping there — the hands-on work and time with family keep purpose and motion woven through your days."
            company="One of the more common types among people who aren't ready to simply wind down — you're in good company."
          />
        }
        forwardHook="Nothing's set yet — in Explore we'll look at the different parts of a balanced retirement, and find what resonates most with you."
        primaryCta={{ label: "Continue to Stage 2", href: "/home" }}
        returnHref="/home?intro=skip"
      />
    </>
  );
}
