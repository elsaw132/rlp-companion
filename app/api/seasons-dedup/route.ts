import Anthropic from "@anthropic-ai/sdk";
import { SONNET_MODEL } from "@/lib/models";
import { coerceDedupedCards } from "@/lib/seasonsCardsSeed";
import type { SeasonCard } from "@/lib/userModel";

// De-duplicates the cards for Module 4.2 ("The chapters of retirement"). The
// seasons board seeds its cards from the person's aspirations, activities and
// people across the whole programme, so the same wish captured twice in slightly
// different words shows up as two near-identical cards. The session sends the raw
// card list; one structured Claude call groups the cards that mean the same thing,
// clearest label first. The model only groups EXISTING cards — it never rewrites a
// label or invents one — and the coercion keeps one card per group, preserving the
// rest untouched. Anything that goes wrong falls back to the raw cards so the
// board always renders and no distinct wish is ever silently dropped.

export const maxDuration = 30;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,
});

function systemPrompt(): string {
  return `You are tidying a set of short CARDS for someone working through the "Plan" stage of a guided retirement life-planning programme. Each card is one thing the person cares about — an aspiration, a regular activity, or a person in their life — drawn from everything they've said across the programme. Because the same thing often got captured more than once in slightly different words, the set contains NEAR-DUPLICATES. Your only job is to find the cards that express the SAME underlying intent and group them, so the person sees one clean card per thing.

WHAT COUNTS AS THE SAME INTENT
Group two cards ONLY when they clearly point at the same underlying thing, just worded differently. Examples of true duplicates to group:
- "Master cooking" and "Moving towards mastery in cooking" (same aim, reworded)
- "Travel as much as possible, including the longer trips" and "As much travel as possible, including longer immersive trips" (same aim, reworded)
- "Renovate our home to truly make it a dream home" and "Home renovation done bit by bit, making it a dream home" (same project; the pace detail doesn't make it a different intent)

BE CONSERVATIVE — WHEN IN DOUBT, KEEP THEM SEPARATE
Different specifics are DIFFERENT cards, even when the theme overlaps. Do NOT group these:
- "learn a language through a class" vs "start a regular class to build casual social contact" (one is about the language, one is about social contact)
- "joining a community team to create things" vs "mentoring mid-career women" (different activities)
- A broad identity like "Learner" vs a specific "learn a language through a class" (keep the specific one distinct)
A card mentioned in no group is kept as-is, so never group something just because it feels loosely related. Only merge genuine restatements of the same thing.

OUTPUT
Return JSON with one field, "duplicateGroups": an array of groups. Each group is an array of the EXACT card labels (verbatim, copied character-for-character from the list) that are the same intent, with the CLEAREST, most natural wording listed FIRST — that first one is the card that will be kept, the rest hidden. Only include groups of two or more genuine duplicates; omit every card that has no duplicate. If there are no duplicates at all, return {"duplicateGroups":[]}.

JSON shape:
{"duplicateGroups":[["Moving towards mastery in cooking","Master cooking"],["As much travel as possible, including longer immersive trips","Travel as much as possible, including the longer trips"]]}

Respond with ONLY the JSON object described above — no markdown, no preamble, no commentary.`;
}

function sanitizeCards(raw: unknown): SeasonCard[] {
  if (!Array.isArray(raw)) return [];
  const out: SeasonCard[] = [];
  for (const c of raw) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim() : "";
    if (!label) continue;
    const category = typeof o.category === "string" ? o.category : "";
    out.push({ label, category });
  }
  return out;
}

export async function POST(request: Request) {
  let cards: SeasonCard[] = [];
  try {
    const body = (await request.json()) as { cards?: unknown };
    cards = sanitizeCards(body.cards);
  } catch {
    return Response.json({ seed: { cards: [] } });
  }

  // Nothing to collapse — return the cards untouched without spending a call.
  if (cards.length < 2) {
    return Response.json({ seed: { cards } });
  }

  const cardBlock = cards.map((c) => `- ${c.label}`).join("\n");

  try {
    const response = await anthropic.messages.create({
      model: SONNET_MODEL,
      max_tokens: 1200,
      system: systemPrompt(),
      messages: [
        {
          role: "user",
          content: `Here are the cards to tidy:\n\n${cardBlock}`,
        },
      ],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const slice = start !== -1 && end !== -1 ? text.slice(start, end + 1) : text;

    return Response.json({ seed: coerceDedupedCards(JSON.parse(slice), cards) });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(
        `[seasons-dedup] Anthropic API error — status=${error.status} message=${error.message}`
      );
    } else {
      console.error("[seasons-dedup] Unexpected error:", error);
    }
    // Fall back to the untouched cards so the board always renders.
    return Response.json({ seed: { cards } });
  }
}
