import Anthropic from "@anthropic-ai/sdk";
import { SONNET_MODEL } from "@/lib/models";

type IncomingMessage = {
  role: "coach" | "user";
  text: string;
};

type KnownFact = { label: string; category: string };

type TakeawayRequest = {
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

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// The category names the delta pass may use for a new conversational fact. Kept
// terse; the model picks the closest fit and we validate on the way in.
const FACT_CATEGORIES = [
  "day_picture_item", "role", "week_shape_pref", "letter_thread", "one_off_dream",
  "aspiration", "recurring_activity", "energy_pattern", "relationship",
  "social_balance_pref", "commitment", "strength", "value", "value_priority",
  "hope", "fear", "meaning_thread", "readiness", "chapter", "goal", "goal_path",
  "principle", "week_plan", "first_year_plan", "concern", "onboarding_fact",
].join(", ");

const SYSTEM_PROMPT = `You are summarising one module of a guided retirement life-planning programme. The transcript below is a conversation between a coach (Vita) and a person. The summary is used in two ways: it is carried into later modules so the coach can draw on the whole picture, and a version of it is read back to the person on their home screen. It also seeds the person's Retirement Life Plan.

Write 2 to 4 sentences capturing what matters to this person and what emerged in this module — the substance, not the coaching. Plain, warm, and specific to what they actually said. No preamble, no headings, no quotation marks, no advice — just the summary sentences. Never use negative-contrast, parataxis, or symmetrical structures ("It's not X, it's Y"; "It isn't this, it's that") — write directly, confidently, and entirely in the affirmative. Never use the word "genuinely".

Produce the summary in two grammatical persons. The content and tone must be identical — only the person differs:
- "thirdPerson": written in the third person ("they"/"their").
- "secondPerson": written in the second person, addressing the person directly ("you"/"your").

You ALSO extract structured fact changes that emerged ONLY in the conversation (not already in their saved selections), as a "facts" object:
- "additions": new facts the person stated in conversation that aren't already on record. Each: {"category": one of [${FACT_CATEGORIES}], "label": the fact in their words (short), and optionally "domain" (for recurring_activity: Restore/Move/Think/Connect/Contribute), "description"}. Use one_off_dream for money-no-object/pipe dreams; aspiration for things they could realistically work toward; recurring_activity for regular activities — never mix these up. Only include something clearly new and concrete. Empty array if nothing new.
- "removals": corrections where the person changed their mind about, dropped, or replaced something already on record (you're told what's on record). Each: {"label": the on-record fact to drop (match its wording), optionally "category", and "userConfirmedInChat": true ONLY if the person themselves clearly asked to drop or change it in this conversation (false if you merely inferred it). Empty array if nothing was corrected.

Respond with ONLY a JSON object of exactly this shape, and nothing else:
{"thirdPerson": "...", "secondPerson": "...", "facts": {"additions": [], "removals": []}}

Example:
{"thirdPerson": "They pictured a family-centred day built around a morning run, time with grandkids, and an evening with their partner. What matters most is being a steady, everyday presence for family, at an unhurried pace.", "secondPerson": "You pictured a family-centred day built around a morning run, time with grandkids, and an evening with your partner. What matters most is being a steady, everyday presence for family, at an unhurried pace.", "facts": {"additions": [{"category": "recurring_activity", "domain": "Move", "label": "a solo coffee and walk at 11am"}], "removals": [{"label": "morning run", "userConfirmedInChat": true}]}}`;

// Pull the first {...} object out of the model's reply, in case it wraps the
// JSON in prose or a code fence.
function extractJsonObject(s: string): string {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return s;
  return s.slice(start, end + 1);
}

// Mechanical third-to-second person swap, used only as a fallback when the model
// doesn't return clean JSON. "They" and "you" share verb forms in English, so a
// pronoun-only swap stays grammatical for these short summaries.
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

export async function POST(request: Request) {
  const body = (await request.json()) as TakeawayRequest;

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

  const userContent = `Module: ${body.moduleTitle}\n\n${built}${known}Conversation transcript:\n${transcript}`;

  const response = await anthropic.messages.create({
    model: SONNET_MODEL,
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const rawText = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  let takeaway = "";
  let takeawayDirect = "";
  // Conversational deltas. Default to empty so a parse miss degrades to
  // summary-only and never breaks module close (the robustness §4c asks for).
  let facts: { additions: unknown[]; removals: unknown[] } = {
    additions: [],
    removals: [],
  };
  try {
    const parsed = JSON.parse(extractJsonObject(rawText)) as {
      thirdPerson?: string;
      secondPerson?: string;
      facts?: { additions?: unknown[]; removals?: unknown[] };
    };
    takeaway = (parsed.thirdPerson ?? "").trim();
    takeawayDirect = (parsed.secondPerson ?? "").trim();
    if (parsed.facts && typeof parsed.facts === "object") {
      facts = {
        additions: Array.isArray(parsed.facts.additions) ? parsed.facts.additions : [],
        removals: Array.isArray(parsed.facts.removals) ? parsed.facts.removals : [],
      };
    }
  } catch {
    // Model returned the fields but not as parseable JSON (a stray quote, smart
    // quotes, trailing prose). Lift the two fields out by regex before giving up,
    // so the raw {thirdPerson:...} object is never stored as the summary.
    const third = rawText.match(
      /["“]?thirdPerson["”]?\s*:\s*["“]([\s\S]*?)["”]\s*[,}]/
    );
    const second = rawText.match(
      /["“]?secondPerson["”]?\s*:\s*["“]([\s\S]*?)["”]\s*[,}]/
    );
    if (third?.[1] || second?.[1]) {
      takeaway = (third?.[1] ?? second?.[1] ?? "").trim();
      takeawayDirect = (second?.[1] ?? "").trim();
    } else {
      // No structure at all — treat the whole reply as the third-person summary
      // and derive the direct version mechanically.
      takeaway = rawText;
      takeawayDirect = toSecondPerson(rawText);
    }
  }
  if (!takeaway) takeaway = rawText;
  if (!takeawayDirect) takeawayDirect = toSecondPerson(takeaway);

  return Response.json({ takeaway, takeawayDirect, facts });
}
