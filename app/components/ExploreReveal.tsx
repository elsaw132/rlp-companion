"use client";

// The Explore stage's instance of the reveal. Unlike Imagine (threads +
// archetype), it walks the six areas of a balanced retirement: it reads the six
// Stage 2 module builds, runs the discovery-stat selection (which stats fire,
// matched to this person's choices and rotated against what they've seen),
// generates the connective copy via /api/stage2-reveal, and hands the area cards
// to the shared StageReveal shell as its body. The locked claims are placed
// verbatim by the API route; here we only render them and the source tap. The
// synthesis is saved (and seen stats recorded) so the reveal is revisitable and
// rotates next time.

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { STAGES, type BuildResult } from "@/lib/modules";
import { useUserData } from "@/lib/userData";
import {
  FALLBACK_STAGE2_SYNTHESIS,
  isFallbackStage2Synthesis,
  STAGE2_AREA_ORDER,
  type Stage2Synthesis,
} from "@/lib/stage2Reveal";
import { buildStatContext, selectStats } from "@/lib/stage2Selection";
import type { Stage2Area } from "@/lib/stage2Stats";
import StageReveal from "./StageReveal";
import { stageColorFor } from "@/lib/stageColors";
import ExploreWheel from "./ExploreWheel";

export default function ExploreReveal() {
  const { user } = useUser();
  const userData = useUserData();

  const [synthesis, setSynthesis] = useState<Stage2Synthesis | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Once the data layer is ready: show the saved reveal, or generate one. Run in
  // render (guarded by `loaded`) so the first paint already reflects the right
  // state — the same pattern ImagineReveal uses.
  if (user && !userData.loading && !loaded) {
    setLoaded(true);
    const saved = userData.getStage2Reveal();
    if (saved && !isFallbackStage2Synthesis(saved.synthesis)) {
      setSynthesis(saved.synthesis);
    } else {
      void generate();
    }
  }

  // ---- reading builds for the per-area forward-line context ----

  // Declared as hoisted `function`s, not `const` arrows: generate() runs in the
  // render-phase guard above, before this point in the body, so const helpers
  // would still be in their temporal dead zone when forwardContextFor reaches
  // them. Hoisting keeps them callable regardless of call order.
  function composite(id: string): BuildResult[] | null {
    const b = userData.getBuild(id);
    return b && b.type === "composite" ? b.results : null;
  }
  function picksOf(b: BuildResult | null | undefined): string[] {
    return b && b.type === "role-picker" ? b.picked : [];
  }
  function thinFunctions(results: BuildResult[] | null): string[] {
    if (!results) return [];
    return results.flatMap((r) =>
      r.type === "sliders" &&
      r.summaryLabel &&
      r.summaryLabel !== "Social balance" &&
      r.spectrums[0] &&
      r.spectrums[0].position < 50
        ? [r.summaryLabel.toLowerCase()]
        : []
    );
  }

  // A plain, factual description of what they chose in an area — the raw material
  // the generation call turns into a forward-looking line. Never shown directly.
  function forwardContextFor(area: Stage2Area): string {
    switch (area) {
      case "active": {
        const picks = picksOf(composite("2.1")?.[0]);
        return picks.length
          ? `Active things they'd like in their week: ${picks.join(", ")}.`
          : "They didn't pick specific activities.";
      }
      case "cognitive": {
        const picks = picksOf(userData.getBuild("2.2"));
        return picks.length
          ? `Curiosities and interests they chose: ${picks.join(", ")}.`
          : "They didn't pick specific interests.";
      }
      case "social": {
        const results = composite("2.3");
        const people = picksOf(results?.[0]);
        const thin = thinFunctions(results);
        return [
          people.length
            ? `People who matter to them: ${people.join(", ")}.`
            : "",
          thin.length
            ? `Where their social world feels thin: ${thin.join(", ")}.`
            : "Their social world feels fairly well-served.",
        ]
          .filter(Boolean)
          .join(" ");
      }
      case "purpose": {
        const picks = picksOf(userData.getBuild("2.4"));
        return picks.length
          ? `Sources of meaning and contribution they chose: ${picks.join(", ")}.`
          : "They didn't pick specific sources of meaning.";
      }
      case "vitality": {
        const results = composite("2.5");
        const energisers = picksOf(results?.[0]);
        const drains = picksOf(results?.[1]);
        const lever = picksOf(results?.[6])[0];
        return [
          energisers.length ? `What energises them: ${energisers.join(", ")}.` : "",
          drains.length ? `What drains them: ${drains.join(", ")}.` : "",
          lever ? `The lever they'd most like to build on: ${lever}.` : "",
        ]
          .filter(Boolean)
          .join(" ");
      }
      case "senses": {
        const commitment = userData.getCommitment("2.6");
        if (commitment) {
          const start = commitment.nextAction
            ? `, starting by: ${commitment.nextAction}`
            : "";
          return `They've decided to make regular eye and hearing checks part of their plan (${commitment.frequency.toLowerCase()})${start}.`;
        }
        const screening = userData.getBuild("2.6");
        if (screening && screening.type === "screening-check") {
          const parts = screening.answers
            .map((a) => `${a.prompt} ${a.choice}`)
            .join("; ");
          return `They looked at where they are with eye and hearing checks: ${parts}.`;
        }
        return "They looked at the small, regular habits that keep vision and hearing sharp.";
      }
    }
  }

  // Build the request: run selection, then for each area in reveal order attach
  // the chosen stat id (if any) and the forward-line context.
  function buildRequestAreas(): {
    area: Stage2Area;
    areaLabel: string;
    forwardContext: string;
    statId: string | null;
  }[] {
    const ctx = buildStatContext((id) => userData.getBuild(id));
    const chosen = selectStats(ctx, userData.getSeenStats());
    const statByArea = new Map<Stage2Area, string>();
    for (const s of chosen) statByArea.set(s.area, s.id);

    return STAGE2_AREA_ORDER.map(({ area, label }) => ({
      area,
      areaLabel: label,
      forwardContext: forwardContextFor(area),
      statId: statByArea.get(area) ?? null,
    }));
  }

  async function generate() {
    const requestAreas = buildRequestAreas();
    const firedStatIds = requestAreas
      .map((a) => a.statId)
      .filter((id): id is string => !!id);
    try {
      const res = await fetch("/api/stage2-reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userData.getDisplayName(user),
          areas: requestAreas,
        }),
      });
      if (!res.ok) throw new Error("bad response");
      const data = (await res.json()) as Stage2Synthesis;
      setSynthesis(data);
      // Persist only a real result — never a fallback — and record the stats we
      // actually showed so a return visit rotates to fresh ones.
      if (!isFallbackStage2Synthesis(data)) {
        void userData.saveStage2Reveal(data);
        if (firedStatIds.length) void userData.addSeenStats(firedStatIds);
      }
    } catch {
      setSynthesis(FALLBACK_STAGE2_SYNTHESIS);
    }
  }

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

  const nextStage = STAGES.find((s) => s.number === 3);

  return (
    <StageReveal
      arc={arc}
      bandColor={stageColorFor(2)}
      eyebrow="Exploring done"
      title="A fuller picture of your retirement"
      vitaIntro={synthesis.intro}
      forwardHook={synthesis.closing}
      primaryCta={{
        label: `Continue to Stage ${nextStage?.number ?? 3}`,
        href: "/home",
      }}
      // Return home lands on the dashboard itself — not the next stage's intro,
      // which /home otherwise shows on first forward entry (see HomeDashboard).
      returnHref="/home?intro=skip"
    >
      <ExploreWheel areas={synthesis.areas} />
    </StageReveal>
  );
}

const loadingCss = `
.rlp-reveal-loading{max-width:var(--content-max);margin:0 auto;padding:96px 24px;display:grid;place-items:center;min-height:50vh}
.rlp-reveal-loading p{font-family:var(--font-serif);font-style:italic;font-size:var(--fs-h2);color:var(--text-muted)}
`;
