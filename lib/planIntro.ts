// The generated PROSE for the Retirement Life Plan — every connective and
// summary sentence in the document, written once by Vita and cached.
//
// The plan SYNTHESISES rather than replays, in ONE voice: first person. The
// member is speaking ("I", "my") throughout — it is their own keepsake. The
// values compass (§3) and the first-year narrative (§9) set the standard for
// clean, grounded prose; everything else that used to be stitched from string
// templates is generated here so it reads as written, never concatenated.
// Anything the model can't write cleanly and truthfully comes back empty, and
// the document drops it.
//
// Generation lives in app/api/plan-intro/route.ts. Strict rule: the model draws
// ONLY on the material it's given, cites the real things, and invents no motives
// or patterns. Said less and true, never more and gilded.

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
  // §10 — things still in motion: what the member hasn't resolved and wants to
  // keep working out. First-person, generative, never framed as failures. [].
  openThreads: string[];
  // The signature web of real links. null when there isn't enough to draw.
  connections: ConnectionsGraph | null;
};

// Kept as the cache/return name the data layer already uses.
export type PlanIntro = PlanProse;

// The material the generation works from — assembled by the client from the
// already-built plan, so the route stays a pure writer.
export type PlanIntroRequest = {
  name?: string | null;
  withPartner?: boolean | null;
  coreValues?: { value: string; meaning?: string }[];
  roles?: string[];
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
  const intro: PlanProse = {
    chapterTitle: str(o, "chapterTitle"),
    overview: str(o, "overview"),
    insight: str(o, "insight"),
    selfIntro: str(o, "selfIntro"),
    balanceShape: str(o, "balanceShape"),
    seasonsArc: str(o, "seasonsArc"),
    weekRhythm: str(o, "weekRhythm"),
    financeNote: str(o, "financeNote"),
    openThreads,
    connections: coerceConnections(o.connections),
  };
  // Need at least a title or the self-intro to count as a real result.
  if (!intro.chapterTitle && !intro.selfIntro) return null;
  return intro;
}
