import Anthropic from "@anthropic-ai/sdk";
import {
  coerceItemList,
  type FirstYearChatInput,
  type FirstYearItemSeed,
} from "@/lib/firstYearSeed";

// The control surface for Module 4.7 ("Your first year, as a journey"). The
// timeline and the written story are both edited here. Two modes:
// - "edit": the person tells Vita how they'd like the year to feel ("a gentle
//   start, then the big trip mid-year"). Vita rearranges the timeline AND rewrites
//   the story to match, and returns a short warm reply. If the instruction is
//   ambiguous, Vita asks one quick clarifying question and changes nothing.
// - "narrate": after a direct move (a drag, a star, a removal), the timeline is
//   already updated client-side; Vita just rewrites the story to match it.
// The chat and the direct moves drive the SAME timeline state — this route only
// ever reads the items it's given and returns items to replace them with.

export const maxDuration = 30;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,
});

// Render the current timeline so the model sees exactly what's placed where, in
// order, with the phase names the person sees.
function describeTimeline(
  items: FirstYearItemSeed[],
  seasons: { id: string; label: string }[]
): string {
  const labelFor = (id: string) =>
    id === "all-year"
      ? "Across the whole year"
      : (seasons.find((s) => s.id === id)?.label ?? id);
  const order = [...seasons.map((s) => s.id), "all-year"];
  const lines: string[] = [];
  for (const sid of order) {
    const inPhase = items.filter((it) => it.season === sid);
    if (inPhase.length === 0) continue;
    lines.push(`${labelFor(sid)} [${sid}]:`);
    inPhase.forEach((it, i) => {
      const tags = [
        it.kind,
        it.top && "HEADLINE",
        it.fixed && "ongoing-work",
      ]
        .filter(Boolean)
        .join(", ");
      lines.push(`  ${i + 1}. ${it.label} (${tags})`);
    });
  }
  return lines.join("\n") || "(the timeline is empty)";
}

const VOICE = `Voice: warm, specific, plain, in the affirmative. Never use these words: reflect, explore, unpack, journey, growth, share, deep dive. Never use the word "genuinely". Never use negative-contrast or symmetrical structures ("It's not X, it's Y"). You are Vita, an AI coach — never implied to be human.`;

const SHAPE = `The timeline has four phases left to right — "s1" (opening months), "s2" (settling in), "s3" (well into the year), "s4" (closing the year) — plus "all-year" for the steady weekly rhythm and any ongoing-work footprint. Each item has: "label" (the real thing, in their words), "kind" (trip / goal / project / rhythm / work), "season" (one of s1, s2, s3, s4, all-year), "top" (true for a headline moment), and for ongoing work "fixed": true. Rhythm items always stay on "all-year". Work items keep "fixed": true. Phases are coarse on purpose — never invent specific dates or a step-by-step schedule.`;

function editSystemPrompt(input: FirstYearChatInput): string {
  return `You maintain a person's FIRST-YEAR timeline in a retirement plan, and the short first-person story written from it. They are reshaping the year by telling you how they'd like it to feel. Reshape the timeline to match their intent, then rewrite the story to match, so both move together in front of them.

${SHAPE}

WHAT TO DO WITH THEIR MESSAGE
- If it's a reshaping intent you can act on (e.g. "make a gentle start then the big trip mid-year", "the second half feels too packed — spread it out", "put family at the centre of the autumn", "move the Japan trip to spring", "make the allotment a headline", "drop the woodworking course"): return the FULL updated item list (every item, with changed seasons, order, top flags, additions or removals) AND a rewritten "narrative". The order of items within the list is the sequence — earlier items come first within their phase.
- If it's genuinely AMBIGUOUS (e.g. "move the trip" when there are two trips; "do that earlier" with no clear referent): set "clarify": true, ask ONE short clarifying question in "reply", and DO NOT return items or narrative. Never guess which one they mean.
- If it's not an edit at all (a question, a worry, a remark): answer warmly in "reply" only — no items, no narrative.
- Only add things they actually ask for; never invent new plans of your own. You may remove things they ask to remove.

THE STORY ("narrative")
When you change the timeline, rewrite the whole narrative: a short, warm, FIRST-PERSON story of the year across the four phases in order ("In the opening months I… by the summer… as the year closes…"), 3–5 sentences, naming their real activities and headline moments, honest about how work sits in the year. Their own voice, "I" — never "you".

THE REPLY ("reply")
One or two short, warm sentences saying what you changed (or the clarifying question). Plain, never a list.

${VOICE}

THE CURRENT TIMELINE:
${describeTimeline(input.items, input.seasons)}

THE CURRENT STORY:
${input.narrative || "(none yet)"}

${input.userModel ? `ABOUT THEM (for grounding, do not recite):\n${input.userModel}\n\n` : ""}Respond with ONLY a JSON object: {"reply":"...","clarify":false,"items":[...],"narrative":"..."} — include "items" and "narrative" only when you actually reshaped the year. No markdown, no preamble.`;
}

function narrateSystemPrompt(input: FirstYearChatInput): string {
  return `You write the short first-person story of a person's FIRST YEAR of retirement from their timeline. The timeline has just changed by hand and the story needs to match it.

${SHAPE}

Write a "narrative": a short, warm, FIRST-PERSON story of the year across the four phases in order ("In the opening months I… by the summer… as the year closes…"), 3–5 sentences, naming their real activities and any headline moments, honest about how work sits in the year. Their own voice, "I" — never "you".

${VOICE}

THE CURRENT TIMELINE:
${describeTimeline(input.items, input.seasons)}

Respond with ONLY a JSON object: {"narrative":"..."} — no markdown, no preamble.`;
}

export async function POST(request: Request) {
  let body: FirstYearChatInput;
  try {
    body = (await request.json()) as FirstYearChatInput;
  } catch {
    return Response.json({ reply: "" });
  }

  const input: FirstYearChatInput = {
    mode: body.mode === "narrate" ? "narrate" : "edit",
    items: Array.isArray(body.items) ? body.items : [],
    narrative: typeof body.narrative === "string" ? body.narrative : "",
    seasons: Array.isArray(body.seasons) ? body.seasons : [],
    userModel: typeof body.userModel === "string" ? body.userModel : "",
    onboarding: typeof body.onboarding === "string" ? body.onboarding : "",
    sessionInstructions:
      typeof body.sessionInstructions === "string"
        ? body.sessionInstructions
        : "",
    message: typeof body.message === "string" ? body.message : "",
    history: Array.isArray(body.history) ? body.history : [],
  };

  const isNarrate = input.mode === "narrate";

  // The chat history primes an edit; narrate needs a single nudge to speak.
  const apiMessages = isNarrate
    ? [{ role: "user" as const, content: "Rewrite the story for the current timeline." }]
    : [
        ...(input.history ?? [])
          .filter((m) => m.text && m.text.trim())
          .slice(-8)
          .map((m) => ({
            role: (m.role === "user" ? "user" : "assistant") as
              | "user"
              | "assistant",
            content: m.text,
          })),
        { role: "user" as const, content: input.message || "(no message)" },
      ];

  // The Messages API needs the first turn to be a user turn.
  while (apiMessages.length && apiMessages[0].role !== "user") {
    apiMessages.shift();
  }
  if (apiMessages.length === 0) {
    apiMessages.push({ role: "user", content: input.message || "(no message)" });
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: isNarrate ? narrateSystemPrompt(input) : editSystemPrompt(input),
      messages: apiMessages,
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const slice = start !== -1 && end !== -1 ? text.slice(start, end + 1) : text;
    const parsed = JSON.parse(slice) as {
      reply?: string;
      clarify?: boolean;
      items?: unknown;
      narrative?: unknown;
    };

    if (isNarrate) {
      const narrative =
        typeof parsed.narrative === "string" ? parsed.narrative.trim() : "";
      return Response.json({ reply: "", narrative });
    }

    const reply = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
    const narrative =
      typeof parsed.narrative === "string" ? parsed.narrative.trim() : "";
    // Items only count when the model actually returned a non-empty array.
    const items =
      !parsed.clarify && Array.isArray(parsed.items) && parsed.items.length
        ? coerceItemList(parsed.items)
        : undefined;

    return Response.json({
      reply: reply || "Done.",
      clarify: parsed.clarify === true,
      ...(items ? { items } : {}),
      ...(items && narrative ? { narrative } : {}),
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(
        `[first-year/chat] Anthropic API error — status=${error.status} message=${error.message}`
      );
    } else {
      console.error("[first-year/chat] Unexpected error:", error);
    }
    return Response.json({
      reply: isNarrate
        ? ""
        : "I didn't quite catch that — could you say it another way?",
    });
  }
}
