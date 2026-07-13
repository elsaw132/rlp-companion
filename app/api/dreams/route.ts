import Anthropic from "@anthropic-ai/sdk";
import { HAIKU_MODEL } from "@/lib/models";
import type { DreamEntry } from "@/lib/dreams";

type IncomingMessage = {
  role: "coach" | "user";
  text: string;
};

type DreamsRequest = {
  // The money module's full conversation, in order.
  messages: IncomingMessage[];
  // The full list the person typed in the spark-prompts capture, for context so
  // the model maps the conversation back onto the actual dreams.
  allDreams: DreamEntry[];
};

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are extracting structured data from one session of a guided retirement life-planning programme — the "If money were no object" session. The person first captured a list of money-no-object dreams, then talked them through with the coach (Vita). In that conversation Vita asked which three they'd keep if they could only afford three, why those three stand out, and whether any could actually be achievable in an adapted form.

Your job is to read their captured dream list and the transcript, and pull out four things. Use the person's OWN words wherever you can. Never invent anything they didn't say — if something isn't there, leave it empty.

- top3: the (up to) three dreams they chose as the ones they'd keep if they could only afford three. If they picked fewer, or declined to narrow it down, include only what they actually chose (and an empty array if none). For each, give the reason it stands out for them, drawn from what they said — an empty string if they didn't give a reason.
- achievable: the dreams that came up as actually achievable, possibly adapted or scaled down to be affordable. For each, give the adapted idea that emerged for making a version of it real. Empty array if none were discussed.
- pipeDreams: the dreams that stayed out of reach — the big ones to hold onto that were not flagged as achievable. Empty array if unclear.

Respond with ONLY a JSON object of exactly this shape, and nothing else:
{"top3": [{"dream": "...", "reason": "..."}], "achievable": [{"dream": "...", "adaptedIdea": "..."}], "pipeDreams": ["..."]}`;

// Pull the first {...} object out of the model's reply, in case it wraps the
// JSON in prose or a code fence.
function extractJsonObject(s: string): string {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return s;
  return s.slice(start, end + 1);
}

export async function POST(request: Request) {
  const body = (await request.json()) as DreamsRequest;

  const transcript = body.messages
    .map((m) => `${m.role === "coach" ? "Vita" : "Them"}: ${m.text}`)
    .join("\n");

  const dreamList = (body.allDreams ?? [])
    .filter((d) => d.text && d.text.trim())
    .map((d) => `- ${d.label}: ${d.text.trim()}`)
    .join("\n");

  const userContent = `Their captured dreams:\n${dreamList || "(none captured)"}\n\nConversation transcript:\n${transcript}`;

  const response = await anthropic.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const rawText = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  // Default to empty arrays so a parse failure never blocks storing the record —
  // the full dream list is still saved client-side regardless.
  let top3: { dream: string; reason: string }[] = [];
  let achievable: { dream: string; adaptedIdea: string }[] = [];
  let pipeDreams: string[] = [];
  try {
    const parsed = JSON.parse(extractJsonObject(rawText)) as {
      top3?: { dream?: string; reason?: string }[];
      achievable?: { dream?: string; adaptedIdea?: string }[];
      pipeDreams?: string[];
    };
    top3 = (parsed.top3 ?? [])
      .filter((d) => d && typeof d.dream === "string" && d.dream.trim())
      .map((d) => ({ dream: d.dream!.trim(), reason: (d.reason ?? "").trim() }));
    achievable = (parsed.achievable ?? [])
      .filter((d) => d && typeof d.dream === "string" && d.dream.trim())
      .map((d) => ({
        dream: d.dream!.trim(),
        adaptedIdea: (d.adaptedIdea ?? "").trim(),
      }));
    pipeDreams = (parsed.pipeDreams ?? [])
      .filter((d) => typeof d === "string" && d.trim())
      .map((d) => d.trim());
  } catch {
    // Leave the defaults — empty extraction is better than a 500 here.
  }

  return Response.json({ top3, achievable, pipeDreams });
}
