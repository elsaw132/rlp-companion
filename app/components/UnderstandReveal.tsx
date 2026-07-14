"use client";

// The Understand stage's instance of the reveal. Unlike Imagine (threads +
// archetype) and Explore (the six-area wheel), it assembles a portrait across a
// Wrapped-style card sequence: it reads the six Stage 3 builds (strengths,
// values, priorities, protectors, hopes & fears, the bigger picture), passes the
// person's confirmed material to /api/stage3-reveal for the generated profiles /
// through-line / chapter title, then builds the ordered cards — dropping any
// whose material is thin (spec §6) — and hands them to UnderstandCards. The
// synthesis is saved so the reveal is stable on revisit.

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { STAGES, type BuildResult } from "@/lib/modules";
import { useUserData } from "@/lib/userData";
import StageArc from "./StageArc";
import {
  FALLBACK_STAGE3_SYNTHESIS,
  isFallbackStage3Synthesis,
  type RevealCard,
  type Stage3Synthesis,
} from "@/lib/stage3Reveal";
import UnderstandCards from "./UnderstandCards";

// The raw confirmed material the generation call works from, plus the two flags
// that gate the optional cards.
type Material = {
  signatureStrengths: { label: string; note?: string }[];
  keptStrengths: string[];
  coreValues: { value: string; meaning?: string }[];
  protectors: string[];
  liveFears: string[];
  meaningPassage: string;
  hadProtectors: boolean;
  hadLiveFears: boolean;
};

export default function UnderstandReveal() {
  const { user } = useUser();
  const userData = useUserData();

  const [synthesis, setSynthesis] = useState<Stage3Synthesis | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Once the data layer is ready: show the saved reveal, or generate one. Run in
  // render (guarded by `loaded`) so the first paint already reflects the right
  // state — the same pattern the other reveals use.
  // /stage/3?regen=1 forces a fresh generation (overwriting the saved one) — the
  // reveal is deliberately cached to stay stable on revisit, so this is the way to
  // pick up prompt/copy changes without touching the database.
  if (user && !userData.loading && !loaded) {
    setLoaded(true);
    const forceRegen =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("regen") === "1";
    const saved = userData.getStage3Reveal();
    if (!forceRegen && saved && !isFallbackStage3Synthesis(saved.synthesis)) {
      setSynthesis(saved.synthesis);
    } else {
      void generate();
    }
  }

  // ---- reading the six Stage 3 builds ----
  // Hoisted function declarations (not const arrows): generate() runs in the
  // render-phase guard above, before this point, so const helpers would be in
  // their temporal dead zone. Hoisting keeps them callable regardless of order.
  function typedBuild<T extends BuildResult["type"]>(
    id: string,
    type: T
  ): Extract<BuildResult, { type: T }> | null {
    const b = userData.getBuild(id);
    return b && b.type === type
      ? (b as Extract<BuildResult, { type: T }>)
      : null;
  }

  function gatherMaterial(): Material {
    const strengths = typedBuild("3.1", "mirror-cards");
    const triage = typedBuild("3.2", "value-triage");
    const priorities = typedBuild("3.3", "priority-choices");
    const definitions = typedBuild("3.4", "value-definitions");
    const hopesFears = typedBuild("3.5", "hopes-fears");
    const bigger = typedBuild("3.6", "bigger-picture");

    // Strengths — the signature few, each with a grounding note where we have one.
    const starred = strengths?.starred ?? [];
    const keptByLabel = new Map(
      (strengths?.kept ?? []).map((k) => [k.label, k.note || k.evidence || ""])
    );
    const signatureStrengths = starred.map((label) => {
      const note = keptByLabel.get(label);
      return note ? { label, note } : { label };
    });
    const keptStrengths = (strengths?.kept ?? [])
      .map((k) => k.label)
      .filter((l) => !starred.includes(l));

    // Core values — ordered by the 3.3 ranking where there is one, each carrying
    // the description the person wrote in their own words (from 3.4).
    const descByValue = new Map(
      (definitions?.values ?? []).map((v) => [v.value, v.description])
    );
    const orderedLabels =
      priorities?.ranked?.length
        ? priorities.ranked
        : definitions?.values?.length
          ? definitions.values.map((v) => v.value)
          : (triage?.core ?? []);
    const coreValues = orderedLabels
      .filter((label) => !!label)
      .slice(0, 5)
      .map((label) => {
        const meaning = descByValue.get(label);
        return meaning ? { value: label, meaning } : { value: label };
      });

    // Protectors — the concrete things they've decided to guard.
    const protectors = Array.from(
      new Set((definitions?.values ?? []).flatMap((v) => v.protectors))
    )
      .filter(Boolean)
      .slice(0, 5);

    // Live fears — only the ones on their mind or newly recognised, with their
    // own note where they left one.
    const liveFears = (hopesFears?.fears ?? [])
      .filter(
        (f) =>
          f.reaction === "on-my-mind" || f.reaction === "newly-recognised"
      )
      .map((f) => (f.note ? `${f.label} (${f.note})` : f.label))
      .slice(0, 5);

    const meaningPassage = bigger?.body?.trim() ?? "";

    return {
      signatureStrengths,
      keptStrengths,
      coreValues,
      protectors,
      liveFears,
      meaningPassage,
      hadProtectors: protectors.length > 0,
      hadLiveFears: liveFears.length > 0,
    };
  }

  async function generate() {
    const mat = gatherMaterial();
    try {
      const res = await fetch("/api/stage3-reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userData.getDisplayName(user),
          signatureStrengths: mat.signatureStrengths,
          keptStrengths: mat.keptStrengths,
          coreValues: mat.coreValues,
          protectors: mat.protectors,
          liveFears: mat.liveFears,
          meaningPassage: mat.meaningPassage,
        }),
      });
      if (!res.ok) throw new Error("bad response");
      const data = (await res.json()) as Stage3Synthesis;
      setSynthesis(data);
      // Persist only a real result — never a fallback (it would freeze the reveal
      // on the generic version and regenerate next time).
      if (!isFallbackStage3Synthesis(data)) {
        void userData.saveStage3Reveal(data);
      }
    } catch {
      setSynthesis(FALLBACK_STAGE3_SYNTHESIS);
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

  // ---- assemble the ordered cards, dropping thin ones (spec §6) ----
  const mat = gatherMaterial();
  const name = userData.getDisplayName(user);
  const s = synthesis;
  // The opener mirrors Imagine's: the system marks the stage done and names the
  // person, then Vita's generated sentence frames what follows. Keeping the
  // greeting deterministic means every reveal opens the same way.
  // Syntheses saved before the prompt stopped greeting still begin "Hello <name>."
  // — strip any leading greeting so those don't read "…done, Elsa. Hello Elsa."
  const nameBit = name ? `, ${name}` : "";
  const framing = s.opener.replace(/^\s*(hello|hi|hey)\b[^.!?]*[.!?]\s*/i, "");
  const cards: RevealCard[] = [
    {
      kind: "opener",
      name,
      line: `That's the understanding done${nameBit}. ${framing}`,
    },
  ];

  if (s.strengthsChips.length > 0 || s.strengthsProfile) {
    cards.push({
      kind: "strengths",
      profile: s.strengthsProfile,
      chips: s.strengthsChips,
      carry: s.strengthsCarry,
    });
  }
  if (s.valuesChips.length > 0 || s.valuesTop || s.valuesProfile) {
    cards.push({
      kind: "values",
      profile: s.valuesProfile,
      top: s.valuesTop,
      chips: s.valuesChips,
      breadth: s.valuesBreadth,
    });
  }
  if (s.throughLine.trim()) {
    cards.push({ kind: "thread", name: s.throughLine, trace: s.throughLineTrace });
  }
  if (mat.hadProtectors && s.protect.trim()) {
    cards.push({ kind: "protect", line: s.protect });
  }
  if (mat.hadLiveFears && s.clearEyed.trim()) {
    cards.push({ kind: "clearEyed", line: s.clearEyed });
  }
  // The finale drops out like every other card when its material is thin — the
  // prompt returns "" for both chapterTitle and meaning when the person wrote
  // nothing usable, which would otherwise render an empty card.
  if (s.chapterTitle.trim() || s.meaning.trim()) {
    cards.push({
      kind: "finale",
      chapterTitle: s.chapterTitle,
      meaning: s.meaning,
    });
  }
  cards.push({ kind: "forward", primaryHref: "/home" });

  const completedIds = new Set(userData.getCompletedIds());
  const arc = STAGES.map((stage) => ({
    number: stage.number,
    name: stage.name,
    done:
      stage.modules.length > 0 &&
      stage.modules.every((m) => completedIds.has(m.id)),
  }));

  return (
    <main className="rlp-ureveal-page">
      <style>{pageCss}</style>
      <StageArc arc={arc} />
      <UnderstandCards cards={cards} currentStage={3} returnHref="/home" />
    </main>
  );
}

const pageCss = `
.rlp-ureveal-page{max-width:var(--content-max);width:100%;margin:0 auto;padding:32px 16px 56px;display:flex;flex-direction:column;align-items:center}
`;

const loadingCss = `
.rlp-reveal-loading{max-width:var(--content-max);margin:0 auto;padding:96px 24px;display:grid;place-items:center;min-height:50vh}
.rlp-reveal-loading p{font-family:var(--font-serif);font-style:italic;font-size:var(--fs-h2);color:var(--text-muted)}
`;
