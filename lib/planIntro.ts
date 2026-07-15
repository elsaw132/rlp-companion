// The generated PROSE for the Retirement Life Plan — every connective and
// summary sentence in the document, written once by Vita and cached.
//
// The plan SYNTHESISES rather than replays. Voice follows one rule — whose mouth
// is it? Vita speaking about the plan is SECOND person ("you"); the member
// speaking about themselves is FIRST person ("I") — chapterTitle, selfIntro and
// weekRhythm only. (The 4.7 first-year narrative is likewise the member's, and is
// written first-person by its own route.) Section headings are the document's
// furniture and are always second person. The
// values compass (§3) and the first-year narrative (§9) set the standard for
// clean, grounded prose; everything else that used to be stitched from string
// templates is generated here so it reads as written, never concatenated.
// Anything the model can't write cleanly and truthfully comes back empty, and
// the document drops it.
//
// Generation lives in app/api/plan-intro/route.ts. Strict rule: the model draws
// ONLY on the material it's given, cites the real things, and invents no motives
// or patterns. Said less and true, never more and gilded.

import type { RetirementStage } from "@/lib/userData";

// The "see how it all connects" web: real, stated links between the member's
// goals, values and the people who matter. Built only from connections the
// member would recognise — never speculative associations.
export type ConnectionKind = "value" | "goal" | "person";
export type ConnectionNode = { id: string; label: string; kind: ConnectionKind };
export type ConnectionEdge = { from: string; to: string; why?: string };
export type ConnectionsGraph = {
  nodes: ConnectionNode[];
  edges: ConnectionEdge[];
};

export type PlanProse = {
  // §1 — a chapter title for this stage of life, in the member's register.
  chapterTitle: string;
  // §1 — a short cross-module synthesis (2–4 sentences) tying real threads
  // together. "" if no honest through-line is there.
  overview: string;
  // §1 — THE one earned insight: a single true throughline the member never
  // explicitly stated but that is unmistakably present in their material, as a
  // quiet, intimate first-person line. "" when nothing genuine is there (omit
  // rather than force). HIGH-TRUST / HIGH-RISK — flagged for review.
  insight: string;
  // §1 — ONE complete, rounded first-person self-portrait (people, passions,
  // what drives them). Not several slice-drafts. "" falls back to the
  // deterministic opening.
  selfIntro: string;
  // §2 — one sentence naming the shape across the five areas.
  balanceShape: string;
  // §4 — a short framing of how the retirement evolves across the seasons.
  seasonsArc: string;
  // §7 — one or two sentences characterising the week's rhythm.
  weekRhythm: string;
  // §8 — the financial-confidence sentence (surface and signpost only).
  financeNote: string;
  // §6 — a short, personal read on how they're carrying their strengths into
  // retirement, and why that's worth something. The chips beneath it are just
  // names; this is the only thing that says anything about them. "" to drop it.
  strengthsRead: string;
  // §10 — things still in motion: what the member hasn't resolved and wants to
  // keep working out. First-person, generative, never framed as failures. [].
  openThreads: string[];
  // §8 "Worth picking up" (retired reset, Phase 6): one framed suggestion per
  // reset "change" item / unfinished-work thread — Vita naming what it is, why it
  // matters now, and a concrete first move. NOT a reprint of their words. []
  // when there's nothing to surface. Second person.
  resetActions: string[];
  // The signature web of real links. null when there isn't enough to draw.
  connections: ConnectionsGraph | null;

  // ---- Tab 6, Vita's read. Each 2–3 tight sentences, or "" to be dropped. ----
  // The band itself is fact (which areas carry a goal); this sentence is the only
  // thing that INTERPRETS whether that spread serves them, and may forgive a
  // legitimate concentration.
  balanceCallout: string;
  balanceRead: string;
  // A means–ends check: does the plan protect the base its long-horizon goals
  // depend on? Leverage, never deficit. "" when there's nothing real to say —
  // this one is not sought out.
  realismCallout: string;
  realismNote: string;
  // What's strong, led with. Rewards goals that FIT the person and honest
  // timing, never volume.
  strongCallout: string;
  whatsStrong: string;
  // The plan held against the member's OWN decision rules. "" when they set none.
  coherenceCallout: string;
  coherence: string;
};

// Kept as the cache/return name the data layer already uses.
export type PlanIntro = PlanProse;

// The material the generation works from — assembled by the client from the
// already-built plan, so the route stays a pure writer.
export type PlanIntroRequest = {
  name?: string | null;
  withPartner?: boolean | null;
  // Where they are with work and retirement, or null when uncaptured. Drives the
  // prose tense/framing per cohort (Phase 5).
  retirementStage?: RetirementStage | null;
  // True when leaving work wasn't fully their own choice — keep the prose gentle
  // and never celebrate a "chosen fresh start" (Phase 5).
  onsetGentle?: boolean;
  // The retired reset's change items + unfinished-work threads (Phase 6). The
  // generator turns each into a framed "Worth picking up" suggestion (insight +
  // a first move). Empty/absent for non-retired.
  resetItems?: { label: string; source: "change" | "unfinished" }[];
  coreValues?: { value: string; meaning?: string }[];
  // Tab 6 material. The decision rules (4.5) are the standard Vita's coherence
  // read holds the plan against — the least shame-prone check, because the
  // standard is the member's own. The buckets let the realism read tie a
  // load-bearing habit to a value they said they'd hold firm on.
  principles?: string[];
  nonNegotiables?: string[];
  flexible?: string[];
  // True when they're more than ~10 years from retiring (see lib/planHorizon).
  // Flips Reflections from "is this complete and realistic" to "you're early,
  // here's a direction forming". Never true for the retired cohorts.
  farHorizon?: boolean;
  roles?: string[];
  // §6 material — the character strengths, for strengthsRead. Without these the
  // model has nothing to write that read from.
  strengths?: string[];
  mostAliveRoles?: string[];
  energySources?: string[];
  aspirations?: string[];
  relationships?: string[];
  hopes?: string | null;
  // §2 material — per-area fullness.
  areas?: { label: string; goalCount: number; focusGoals: string[]; deliberateGap: boolean }[];
  // §4 material — de-duplicated season placements + enduring threads.
  seasons?: { label: string; items: string[] }[];
  enduring?: string[];
  // §5 material — the spotlit goals with their area and the member's note, so
  // the connections web and insight can cite real goals.
  focusGoals?: { label: string; area: string; note?: string }[];
  // §7 material.
  week?: {
    structure: number;
    activities: { label: string; frequency: string; anchor?: boolean; energy?: boolean; fixed?: boolean }[];
  } | null;
  // §8 material.
  finance?: {
    lean?: "clean-break" | "gradual";
    shape?: string;
    period?: string;
    window?: { fromLabel: string; toLabel: string } | null;
    financeLevel?: string | null;
    financeDateKnown?: string;
    stillBuilding?: string[];
  } | null;
  // §10 material — factual candidate "open threads" the client detected.
  openThreadSignals?: string[];
};

function str(o: Record<string, unknown>, k: string): string {
  return typeof o[k] === "string" ? (o[k] as string).trim() : "";
}

const VALID_KINDS = new Set<ConnectionKind>(["value", "goal", "person"]);

function coerceConnections(raw: unknown): ConnectionsGraph | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const rawNodes = Array.isArray(o.nodes) ? o.nodes : [];
  const nodes: ConnectionNode[] = [];
  const ids = new Set<string>();
  for (const n of rawNodes) {
    if (!n || typeof n !== "object") continue;
    const nn = n as Record<string, unknown>;
    const id = typeof nn.id === "string" ? nn.id.trim() : "";
    const label = typeof nn.label === "string" ? nn.label.trim() : "";
    const kind = nn.kind as ConnectionKind;
    if (!id || !label || !VALID_KINDS.has(kind) || ids.has(id)) continue;
    ids.add(id);
    nodes.push({ id, label, kind });
    if (nodes.length >= 18) break; // legibility cap
  }
  const rawEdges = Array.isArray(o.edges) ? o.edges : [];
  const edges: ConnectionEdge[] = [];
  const seen = new Set<string>();
  for (const e of rawEdges) {
    if (!e || typeof e !== "object") continue;
    const ee = e as Record<string, unknown>;
    const from = typeof ee.from === "string" ? ee.from.trim() : "";
    const to = typeof ee.to === "string" ? ee.to.trim() : "";
    if (!ids.has(from) || !ids.has(to) || from === to) continue;
    const key = [from, to].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    const why = typeof ee.why === "string" ? ee.why.trim() : "";
    edges.push({ from, to, ...(why ? { why } : {}) });
    if (edges.length >= 16) break; // keep it a web, not a hairball
  }
  // Drop orphan nodes (no edges) so the picture stays meaningful.
  const linked = new Set<string>();
  for (const e of edges) {
    linked.add(e.from);
    linked.add(e.to);
  }
  const keptNodes = nodes.filter((n) => linked.has(n.id));
  if (keptNodes.length < 2 || edges.length === 0) return null;
  return { nodes: keptNodes, edges };
}

// Validate whatever the model returned, or null if nothing usable came back so
// the caller keeps its deterministic fallback (the plan never breaks).
export function coercePlanIntro(raw: unknown): PlanProse | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const openThreads = Array.isArray(o.openThreads)
    ? o.openThreads
        .filter((d): d is string => typeof d === "string")
        .map((d) => d.trim())
        .filter(Boolean)
        .slice(0, 4)
    : [];
  const resetActions = Array.isArray(o.resetActions)
    ? o.resetActions
        .filter((d): d is string => typeof d === "string")
        .map((d) => d.trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];
  const intro: PlanProse = {
    chapterTitle: str(o, "chapterTitle"),
    overview: str(o, "overview"),
    insight: str(o, "insight"),
    selfIntro: str(o, "selfIntro"),
    balanceShape: str(o, "balanceShape"),
    strengthsRead: str(o, "strengthsRead"),
    seasonsArc: str(o, "seasonsArc"),
    weekRhythm: str(o, "weekRhythm"),
    financeNote: str(o, "financeNote"),
    openThreads,
    resetActions,
    connections: coerceConnections(o.connections),
    balanceCallout: str(o, "balanceCallout"),
    balanceRead: str(o, "balanceRead"),
    realismCallout: str(o, "realismCallout"),
    realismNote: str(o, "realismNote"),
    strongCallout: str(o, "strongCallout"),
    whatsStrong: str(o, "whatsStrong"),
    coherenceCallout: str(o, "coherenceCallout"),
    coherence: str(o, "coherence"),
  };
  // Need at least a title or the self-intro to count as a real result.
  if (!intro.chapterTitle && !intro.selfIntro) return null;
  return intro;
}
