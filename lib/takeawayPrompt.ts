// Takeaway generation + fact-delta extraction for /api/takeaway, kept here (like
// lib/chatPrompt.ts for /api/chat) so the route stays thin and the logic is
// unit-testable. One model call produces BOTH the module summary (in two
// grammatical persons) and the structured context-profile fact deltas.
//
// The fact deltas feed the canonical context profile, so this path must never
// silently lose them. Three defences against a truncated response:
//   1. Headroom — a comfortable max_tokens ceiling (only costs more when used).
//   2. Facts FIRST in the JSON — if the reply is cut off, truncation hits the
//      regenerable summary tail, not the facts.
//   3. Independent facts extraction + a single retry at a higher cap, with a
//      visible log on any truncation. Losing the summary is acceptable; silently
//      losing facts is not.

import type Anthropic from "@anthropic-ai/sdk";
import { SONNET_MODEL } from "@/lib/models";
import { filterGroundedRemovals, filterGroundedReasons } from "@/lib/contextFacts";

export type IncomingMessage = {
  role: "coach" | "user";
  text: string;
};

export type KnownFact = { label: string; category: string };

export type TakeawayRequest = {
  // The module's full conversation, in order.
  messages: IncomingMessage[];
  // The module's title, for context in the summary instruction.
  moduleTitle: string;
  // A readable summary of whatever they built in the interaction step, if any.
  interactionSummary?: string;
  // The facts already on record for this module, so the delta pass can target a
  // correction precisely and avoid re-proposing something already captured.
  knownFacts?: KnownFact[];
};

export type Facts = { additions: unknown[]; removals: unknown[]; reasons: unknown[] };

export type TakeawayResult = {
  takeaway: string;
  takeawayDirect: string;
  facts: Facts;
};

// A comfortable ceiling for the 2–4 sentence summary plus the fact-delta JSON.
// It's a ceiling, so a normal transcript that finishes early is billed only for
// what it uses; it just stops the model being cut off mid-JSON. The retry cap is
// the fallback if a genuinely fact-heavy transcript ever bumps the first ceiling.
export const TAKEAWAY_MAX_TOKENS = 600;
export const TAKEAWAY_RETRY_MAX_TOKENS = 1200;

// The category names the delta pass may use for a new conversational fact. Kept
// terse; the model picks the closest fit and we validate on the way in.
const FACT_CATEGORIES = [
  "day_picture_item", "role", "week_shape_pref", "letter_thread", "one_off_dream",
  "aspiration", "recurring_activity", "energy_pattern", "relationship",
  "social_balance_pref", "commitment", "strength", "value", "value_priority",
  "hope", "fear", "meaning_thread", "readiness", "chapter", "goal", "goal_path",
  "principle", "week_plan", "first_year_plan", "concern", "onboarding_fact",
  // Retired-cohort categories surfaced only in conversation (Phase 3/4), so the
  // delta pass needs them available. The model still only emits one when the
  // person states it clearly. unfinished_work: the "what work gave you" module.
  // keep_change_leave: the retired letter's keep / change / leave reflection.
  "unfinished_work",
  "keep_change_leave",
].join(", ");

export const TAKEAWAY_SYSTEM_PROMPT = `You are summarising one module of a guided retirement life-planning programme. The transcript below is a conversation between a coach (Vita) and a person. The summary is used in two ways: it is carried into later modules so the coach can draw on the whole picture, and a version of it is read back to the person on their home screen. It also seeds the person's Retirement Life Plan.

Write 2 to 4 sentences capturing what matters to this person and what emerged in this module — the substance, not the coaching. Plain, warm, and specific to what they actually said. No preamble, no headings, no quotation marks, no advice — just the summary sentences. Never use negative-contrast, parataxis, or symmetrical structures ("It's not X, it's Y"; "It isn't this, it's that") — write directly, confidently, and entirely in the affirmative. Never use the word "genuinely".

Produce the summary in two grammatical persons. The content and tone must be identical — only the person differs:
- "thirdPerson": written in the third person ("they"/"their").
- "secondPerson": written in the second person, addressing the person directly ("you"/"your").

You ALSO extract structured fact changes that emerged ONLY in the conversation (not already in their saved selections), as a "facts" object:
- "additions": new facts the person stated in conversation that aren't already on record. Each: {"category": one of [${FACT_CATEGORIES}], "label": the fact in their words (short), and optionally "domain" (for recurring_activity: Restore/Move/Think/Connect/Contribute), "description"}. Use one_off_dream for money-no-object/pipe dreams; aspiration for things they could realistically work toward; recurring_activity for regular activities — never mix these up. For keep_change_leave (the retired letter's stock-take of their current retirement), the "label" is the element of their life in their words and the "description" is exactly one of "keep", "change", or "leave" — whether they want to keep it as it is, reshape it, or let it go. Only include something clearly new and concrete. Empty array if nothing new.
- "removals": ONLY when the person EXPLICITLY and UNAMBIGUOUSLY asked, in their OWN words, to drop, remove, undo, or replace something already on record (you're told what's on record). This is a HIGH bar. Every removal MUST include a "quote": the person's own verbatim words, copied exactly from a "Them:" line, that make the request. If you cannot copy such words, DO NOT emit a removal. Each: {"label": the on-record fact to drop (match its wording), "quote": the person's exact words asking to drop or change it, optionally "category", and "userConfirmedInChat": true only when that quote is a direct request from the person.
  The following do NOT count as removals — for these, emit nothing: the person simply giving a new, different, or fuller answer; you inferring they "seem to have" moved on; a change of subject; softening, hedging, or elaborating; anything you would preface with "it sounded like" or "they might have". When in any doubt, emit NO removal. A missed correction is fine — the person can edit it themselves; a wrong one is not.
  Empty array unless the person explicitly asked, in words you can quote, to drop or change something.
- "reasons": when the conversation surfaces a genuinely meaningful REASON, "why", or piece of context behind something — most often something already on record, sometimes something you're also adding — capture it so it carries into the plan (the short summary above does NOT carry forward, so a good reason would otherwise be lost). Each: {"label": the fact it explains (match an on-record fact's wording the same way removals do), "reason": the person's own "why", in their words and short, "quote": the person's verbatim words, copied exactly from a "Them:" line, that carry that reasoning}. A reason is ADDITIVE — it never drops or changes the pick. Only capture substantive, meaningful reasoning that adds something the label alone doesn't: not every aside, not a restatement of the label, not small talk. If the reasoning doesn't attach to any single on-record fact, still capture it with "label" set to a short name for what it's about — it will be kept as a standalone thread rather than lost. Every reason MUST include a "quote" you can copy verbatim from a "Them:" line; if you cannot, DO NOT emit it. Empty array if nothing meaningful emerged (most modules, most of the time).

Put the "facts" object FIRST, before the summary, so the facts are never lost if the reply runs long. Respond with ONLY a JSON object of exactly this shape, and nothing else:
{"facts": {"additions": [], "removals": [], "reasons": []}, "thirdPerson": "...", "secondPerson": "..."}

Example (note the removal and the reason each quote the person's own words):
{"facts": {"additions": [{"category": "recurring_activity", "domain": "Move", "label": "a solo coffee and walk at 11am"}], "removals": [{"label": "morning run", "quote": "actually, scrap the morning run — I don't do that any more", "userConfirmedInChat": true}], "reasons": [{"label": "time with grandkids", "reason": "it's the part of the week that makes them feel useful again", "quote": "honestly the grandkids are the bit that makes me feel useful again"}]}, "thirdPerson": "They pictured a family-centred day built around time with grandkids and an evening with their partner. What matters most is being a steady, everyday presence for family, at an unhurried pace.", "secondPerson": "You pictured a family-centred day built around time with grandkids and an evening with your partner. What matters most is being a steady, everyday presence for family, at an unhurried pace."}`;

function buildUserContent(body: TakeawayRequest): string {
  const transcript = body.messages
    .map((m) => `${m.role === "coach" ? "Vita" : "Them"}: ${m.text}`)
    .join("\n");

  const built =
    body.interactionSummary && body.interactionSummary.trim()
      ? `What they built in this module:\n${body.interactionSummary.trim()}\n\n`
      : "";

  const known =
    body.knownFacts && body.knownFacts.length
      ? `Already on record for this module (use these for "removals"):\n${body.knownFacts
          .map((f) => `- [${f.category}] ${f.label}`)
          .join("\n")}\n\n`
      : "";

  return `Module: ${body.moduleTitle}\n\n${built}${known}Conversation transcript:\n${transcript}`;
}

// Pull the first {...} object out of the model's reply, in case it wraps the
// JSON in prose or a code fence.
function extractJsonObject(s: string): string {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return s;
  return s.slice(start, end + 1);
}

// Extract and parse ONLY the "facts" object, by brace-matching from the "facts"
// key (respecting string contents). Because facts come first in the response,
// this recovers a complete facts object even when the trailing summary is
// truncated. Returns null only when the facts object itself never closed (i.e.
// truncation landed inside the facts) or didn't parse — the signal to retry.
export function extractFacts(raw: string): Facts | null {
  const key = raw.indexOf('"facts"');
  if (key === -1) return null;
  const open = raw.indexOf("{", key);
  if (open === -1) return null;

  let depth = 0;
  let inStr = false;
  let esc = false;
  let close = -1;
  for (let i = open; i < raw.length; i++) {
    const c = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close === -1) return null; // facts object never closed → truncated inside it

  try {
    const obj = JSON.parse(raw.slice(open, close + 1)) as {
      additions?: unknown[];
      removals?: unknown[];
      reasons?: unknown[];
    };
    return {
      additions: Array.isArray(obj.additions) ? obj.additions : [],
      removals: Array.isArray(obj.removals) ? obj.removals : [],
      reasons: Array.isArray(obj.reasons) ? obj.reasons : [],
    };
  } catch {
    return null;
  }
}

// Mechanical third-to-second person swap, used only as a fallback when the model
// doesn't return a clean secondPerson (e.g. the summary tail was truncated).
// "They" and "you" share verb forms in English, so a pronoun-only swap stays
// grammatical for these short summaries.
function toSecondPerson(text: string): string {
  const map: Record<string, string> = {
    "they've": "you've",
    "they're": "you're",
    "they'd": "you'd",
    "they'll": "you'll",
    they: "you",
    their: "your",
    theirs: "yours",
    themselves: "yourself",
    them: "you",
  };
  return text.replace(
    /\b(They've|They're|They'd|They'll|They|Their|Theirs|Themselves|Them|they've|they're|they'd|they'll|they|their|theirs|themselves|them)\b/g,
    (m) => {
      const repl = map[m.toLowerCase()] ?? m;
      return /^[A-Z]/.test(m) ? repl.charAt(0).toUpperCase() + repl.slice(1) : repl;
    }
  );
}

// Best-effort recovery of the two summary strings. Tries a full parse first, then
// falls back to regex (which still works when the trailing summary is partly
// truncated), then to a mechanical person-swap. Losing the summary is acceptable.
function parseSummary(raw: string): { third: string; second: string } {
  try {
    const parsed = JSON.parse(extractJsonObject(raw)) as {
      thirdPerson?: string;
      secondPerson?: string;
    };
    const third = (parsed.thirdPerson ?? "").trim();
    const second = (parsed.secondPerson ?? "").trim();
    if (third || second) {
      return { third: third || second, second: second || toSecondPerson(third) };
    }
  } catch {
    // fall through to regex recovery
  }

  const t = raw.match(/["“]?thirdPerson["”]?\s*:\s*["“]([\s\S]*?)["”]\s*[,}]/);
  const s = raw.match(/["“]?secondPerson["”]?\s*:\s*["“]([\s\S]*?)["”]\s*[,}]/);
  let third = (t?.[1] ?? "").trim();
  let second = (s?.[1] ?? "").trim();
  if (!third && second) third = second;
  if (!second && third) second = toSecondPerson(third);
  return { third, second };
}

// Generate the takeaway summary + fact deltas. Never silently drops the facts:
// on truncation or an unparseable facts object it retries once at a higher cap
// and logs the event; a persistent failure logs an error rather than quietly
// returning empty facts. `opts` overrides the token caps (used by tests to force
// truncation deterministically).
export async function buildTakeaway(
  anthropic: Anthropic,
  body: TakeawayRequest,
  opts: { maxTokens?: number; retryMaxTokens?: number } = {}
): Promise<TakeawayResult> {
  const firstCap = opts.maxTokens ?? TAKEAWAY_MAX_TOKENS;
  const retryCap = opts.retryMaxTokens ?? TAKEAWAY_RETRY_MAX_TOKENS;
  const userContent = buildUserContent(body);

  const attempt = async (maxTokens: number) => {
    const response = await anthropic.messages.create({
      model: SONNET_MODEL,
      max_tokens: maxTokens,
      system: TAKEAWAY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });
    const raw = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { text: string }).text)
      .join("")
      .trim();
    return { raw, truncated: response.stop_reason === "max_tokens" };
  };

  let { raw, truncated } = await attempt(firstCap);
  let facts = extractFacts(raw);

  if (truncated) {
    console.warn(
      `[takeaway] response truncated at max_tokens=${firstCap} ` +
        `(module="${body.moduleTitle}", factsRecovered=${facts !== null})`
    );
  }

  // Retry only when we couldn't recover a COMPLETE facts object — that's the part
  // we must never lose. A truncated summary with facts intact is acceptable.
  if (facts === null) {
    console.warn(
      `[takeaway] facts JSON not recovered on first attempt ` +
        `(module="${body.moduleTitle}") — retrying at max_tokens=${retryCap}`
    );
    const retry = await attempt(retryCap);
    const retryFacts = extractFacts(retry.raw);
    if (retryFacts !== null) {
      raw = retry.raw;
      facts = retryFacts;
      truncated = retry.truncated;
    } else {
      // Keep whichever attempt gave more to salvage a summary from.
      if (retry.raw.length > raw.length) raw = retry.raw;
      console.error(
        `[takeaway] facts STILL not recovered after retry at max_tokens=${retryCap} ` +
          `(module="${body.moduleTitle}", truncated=${retry.truncated}) — ` +
          `proceeding with EMPTY facts; this module's conversational deltas will be ` +
          `missing from the context profile. Investigate the transcript/caps.`
      );
    }
  }

  const { third, second } = parseSummary(raw);

  // Ground every removal in the member's own words before it leaves this path. A
  // removal survives only if its "quote" is verbatim member text from the
  // transcript; anything the model inferred (no quote, or one it can't back up)
  // is dropped. The hard precision bias: never surface a correction the member
  // didn't explicitly ask for.
  const settledFacts = facts ?? { additions: [], removals: [], reasons: [] };
  const memberText = body.messages
    .filter((m) => m.role === "user")
    .map((m) => m.text)
    .join("\n");

  return {
    takeaway: third,
    takeawayDirect: second,
    facts: {
      additions: settledFacts.additions,
      removals: filterGroundedRemovals(settledFacts.removals, memberText),
      // Ground each reason in the member's own words before it leaves this path,
      // exactly as removals are grounded — a reason is never fabricated.
      reasons: filterGroundedReasons(settledFacts.reasons, memberText),
    },
  };
}
