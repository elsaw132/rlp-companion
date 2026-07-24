// A DEDICATED reconciliation pass. The combined takeaway call (module summary +
// general fact extraction) reliably MISSES corrections to existing memory — in
// live testing it logged a rename as a "reason", or emitted nothing, because that
// one call is already overloaded and its correction path is framed to be very
// cautious. This focused call does ONE job: compare the person's current memory
// against this conversation and report what CHANGED (revisions + removals). It runs
// in parallel with buildTakeaway; the takeaway route merges the two.
import type Anthropic from "@anthropic-ai/sdk";
import { SONNET_MODEL } from "@/lib/models";
import {
  filterGroundedRemovals,
  filterGroundedRevisions,
  type FactRemovalDelta,
  type FactRevisionDelta,
} from "@/lib/contextFacts";
import type { IncomingMessage, KnownFact } from "@/lib/takeawayPrompt";

export type ReconcileRequest = {
  messages: IncomingMessage[];
  knownFacts: KnownFact[];
};

export type ReconcileResult = {
  revisions: FactRevisionDelta[];
  removals: FactRemovalDelta[];
};

export const RECONCILE_MAX_TOKENS = 700;

export const RECONCILE_SYSTEM_PROMPT = `You are given a person's CURRENT MEMORY (facts already on record) and a CONVERSATION. Your ONLY job is to report what the person CHANGED about facts already in their memory during this conversation. You do not summarise, and you do NOT add brand-new topics — a separate step handles new material. You only catch CORRECTIONS to what is already on record.

Respond with ONLY a JSON object of exactly this shape, and nothing else:
{"revisions": [], "removals": []}

- "revisions": the person renamed, replaced, rephrased, broadened, narrowed, or firmed up a fact already in their memory. This is the MAIN thing to look for — whenever the person clearly asks to change how an on-record item is named or framed, emit a revision. A revision is safe and reversible, so do not hold back on a clear request. Each: {"oldLabel": the memory fact being changed, copied EXACTLY from the memory list, "label": the new version in the person's own words, "category": (optional) the memory fact's category, "tentative": true ONLY if the new version is itself just a maybe, "quote": the person's verbatim words from a "Them:" line asking for the change}.
- "removals": the person explicitly asked to DROP a memory fact entirely, with nothing taking its place. Each: {"label": the memory fact copied EXACTLY, "quote": their verbatim words asking to drop it, "userConfirmedInChat": true}.

Rules:
- Only ever reference facts that appear in the CURRENT MEMORY list below. Never invent a change to something not listed there.
- Copy every oldLabel / label from the memory list EXACTLY, character for character.
- Every revision and removal MUST carry a "quote" you can copy word-for-word from a "Them:" line. If you cannot, do not emit it.
- A change that also comes with a reason ("call it interior design, carpentry is too narrow") is STILL a revision — capture the rename and ignore the reason here.
- Renaming X to Y is a REVISION (oldLabel X, label Y), never a removal of X plus something else.
- Most conversations change nothing on record. When nothing changed, return {"revisions": [], "removals": []}.

Example — CURRENT MEMORY contains "- [recurring_activity] carpentry", and the transcript has "Them: change carpentry to interior design, it's broader than just carpentry":
{"revisions": [{"oldLabel": "carpentry", "label": "interior design", "category": "recurring_activity", "quote": "change carpentry to interior design"}], "removals": []}`;

function buildContent(body: ReconcileRequest): string {
  const memory = body.knownFacts.map((f) => `- [${f.category}] ${f.label}`).join("\n");
  const transcript = body.messages
    .map((m) => `${m.role === "coach" ? "Vita" : "Them"}: ${m.text}`)
    .join("\n");
  return `CURRENT MEMORY (only these facts can be changed or dropped — copy a label exactly):\n${memory}\n\nCONVERSATION:\n${transcript}`;
}

// Pull the first {...} object out of the reply, in case the model wraps it.
function extractObject(s: string): string {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  return start === -1 || end === -1 || end < start ? "{}" : s.slice(start, end + 1);
}

export async function reconcileMemory(
  anthropic: Anthropic,
  body: ReconcileRequest,
  opts: { maxTokens?: number } = {}
): Promise<ReconcileResult> {
  // Nothing on record → nothing to reconcile against. Skip the call entirely.
  if (!body.knownFacts || body.knownFacts.length === 0) {
    return { revisions: [], removals: [] };
  }

  const response = await anthropic.messages.create({
    model: SONNET_MODEL,
    max_tokens: opts.maxTokens ?? RECONCILE_MAX_TOKENS,
    system: RECONCILE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildContent(body) }],
  });
  const raw = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("")
    .trim();

  let parsed: { revisions?: unknown; removals?: unknown } = {};
  try {
    parsed = JSON.parse(extractObject(raw));
  } catch {
    parsed = {};
  }

  // Ground both against the member's own words, exactly as the takeaway path does:
  // a correction survives only if the quote is verbatim member text.
  const memberText = body.messages
    .filter((m) => m.role === "user")
    .map((m) => m.text)
    .join("\n");

  return {
    revisions: filterGroundedRevisions(Array.isArray(parsed.revisions) ? parsed.revisions : [], memberText),
    removals: filterGroundedRemovals(Array.isArray(parsed.removals) ? parsed.removals : [], memberText),
  };
}
