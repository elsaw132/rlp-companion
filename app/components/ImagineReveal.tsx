"use client";

// The Imagine stage's instance of the reveal. It gathers the six Imagine
// takeaways, runs them through the synthesis interface (/api/stage-reveal) to
// get the three threads + the archetype + the personalised "why you", merges in
// the static archetype copy, and hands it all to the shared StageReveal shell
// with the dawn motif and the archetype payoff. The synthesis is saved so the
// reveal is revisitable without regenerating. Everything that's generated
// (threads, which type, why-you) is kept separate from the fixed type config.

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { STAGES } from "@/lib/modules";
import { useUserData } from "@/lib/userData";
import { getArchetype } from "@/lib/archetypes";
import {
  FALLBACK_SYNTHESIS,
  isFallbackSynthesis,
  type RevealSynthesis,
} from "@/lib/stageReveal";
import StageReveal from "./StageReveal";
import DawnMotif from "./DawnMotif";
import ArchetypeBlock from "./ArchetypeBlock";

export default function ImagineReveal() {
  const { user } = useUser();
  const userData = useUserData();

  const [synthesis, setSynthesis] = useState<RevealSynthesis | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);

  // Once the data layer is ready: show the saved reveal, or generate one. Run in
  // render (guarded by `loaded`) so the first paint after load already reflects
  // the right state — the same pattern the dashboard and the old summary used.
  if (user && !userData.loading && !loaded) {
    setLoaded(true);
    setDisplayName(userData.getDisplayName(user));
    const saved = userData.getStage1Reveal();
    // Show a saved reveal only if it's a real, personalised one. A saved
    // fallback (from an earlier generation that had no takeaways or hit an API
    // hiccup) is ignored and regenerated, so it can't freeze on the generic one.
    if (saved && !isFallbackSynthesis(saved.synthesis)) {
      setSynthesis(saved.synthesis);
    } else {
      void generate();
    }
  }

  // The six Imagine takeaways, in programme order, non-empty only.
  function gatherTakeaways(): { moduleTitle: string; text: string }[] {
    return STAGES[0].modules.flatMap((m) => {
      const t = userData.getTakeaway(m.id);
      return t && t.text.trim()
        ? [{ moduleTitle: m.title, text: t.text.trim() }]
        : [];
    });
  }

  async function generate() {
    try {
      const res = await fetch("/api/stage-reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ takeaways: gatherTakeaways() }),
      });
      if (!res.ok) throw new Error("bad response");
      const data = (await res.json()) as RevealSynthesis;
      setSynthesis(data);
      // Persist only a real, personalised result — never a fallback, so a run
      // with no takeaways or a transient API failure retries next time rather
      // than freezing the reveal on the generic version.
      if (!isFallbackSynthesis(data)) void userData.saveStage1Reveal(data);
    } catch {
      // Never leave the screen empty — render the safe generic reveal.
      setSynthesis(FALLBACK_SYNTHESIS);
    }
  }

  // Hold the screen until the synthesis is ready, so the reveal composes itself
  // in one go rather than flashing a half-built card.
  if (userData.loading || !synthesis) {
    return (
      <main className="rlp-reveal-loading">
        <style>{loadingCss}</style>
        <p>Vita is putting this together&hellip;</p>
      </main>
    );
  }

  const completedIds = new Set(userData.getCompletedIds());
  const arc = STAGES.map((s) => ({
    number: s.number,
    name: s.name,
    done: s.modules.length > 0 && s.modules.every((m) => completedIds.has(m.id)),
  }));

  const archetype = getArchetype(synthesis.archetypeId);
  const secondary = synthesis.secondaryId
    ? getArchetype(synthesis.secondaryId).name
    : undefined;

  // Next stage after Imagine, for the forward CTA label.
  const nextStage = STAGES.find((s) => s.number === 2);

  const vitaIntro = displayName
    ? `That's the imagining done, ${displayName}. Here's what you kept coming back to\u00a0\u2014`
    : "That's the imagining done. Here's what you kept coming back to\u00a0\u2014";

  return (
    <StageReveal
      arc={arc}
      motif={<DawnMotif />}
      eyebrow="Where your plan begins"
      title="Your retirement, imagined"
      vitaIntro={vitaIntro}
      threads={synthesis.threads}
      payoff={
        <ArchetypeBlock
          name={archetype.name}
          definition={archetype.definition}
          whyYou={synthesis.whyYou}
          company={archetype.company}
          secondaryName={secondary}
        />
      }
      forwardHook="Nothing's set yet — in Explore we'll look at the different parts of a balanced retirement, and find what resonates most with you."
      primaryCta={{
        label: `Continue to Stage ${nextStage?.number ?? 2}`,
        href: "/home",
      }}
      returnHref="/home"
    />
  );
}

const loadingCss = `
.rlp-reveal-loading{max-width:var(--content-max);margin:0 auto;padding:96px 24px;display:grid;place-items:center;min-height:50vh}
.rlp-reveal-loading p{font-family:var(--font-serif);font-style:italic;font-size:var(--fs-h2);color:var(--text-muted)}
`;
