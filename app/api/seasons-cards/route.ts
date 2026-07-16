import Anthropic from "@anthropic-ai/sdk";
import { SONNET_MODEL } from "@/lib/models";
import { coerceCuratedCards } from "@/lib/seasonsCardsSeed";
import type { SeasonCard } from "@/lib/userModel";

// Curates the cards for Module 4.2 ("The chapters of retirement"). The seasons board
// seeds its cards from the person's aspirations, activities and people across the
// whole programme — captured verbatim in their own words, so the raw labels are
// inconsistent (lowercase, "-ing" fragments, the tactic instead of the aspiration,
// thin one-worders, and the odd trivial daily habit). The session sends the raw card
// list; one structured Claude call rewrites them into a clean, consistent set of
// cards for the board — one voice, the aspiration not the tactic, vague made real
// (without inventing), duplicates merged, wrong-register cards dropped. The coercion
// keeps the result well-formed and never larger than the input, and anything that
// goes wrong falls back to the raw cards so the board always renders.

export const maxDuration = 30;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,
});

function systemPrompt(): string {
  return `You are preparing the CARDS for a board called "The chapters of retirement", part of a guided retirement life-planning programme. The board's purpose: the person maps how their PRIORITIES and ASPIRATIONS might shift across the chapters of retirement — early years, middle years, later years — and what they'd want to keep throughout. They sort each card into the chapter where it feels most alive, and can add or remove their own.

You are given the things this person has said they care about, captured verbatim in their own words across earlier sessions. So they are inconsistent: some are clean, some are lowercase fragments, some name a specific TACTIC rather than the underlying aspiration, some are thin one-word labels, and some are tiny daily habits that don't belong on a board about how priorities shift over decades. Turn them into a clean, consistent, meaningful set of cards.

RULES

1. ONE CONSISTENT VOICE. Every card is a short phrase that starts with a Capital letter and is verb-led where it reads naturally, in plain, warm English. No lowercase starts. No "-ing" fragments ("joining a community team" → "Join a community team"; "mentoring mid-career women" → "Mentor mid-career women"). No fragments that read as the mere beginning of something ("start a regular class to…").

2. THE ASPIRATION, NOT THE TACTIC. Card the underlying aspiration, not the particular mechanism the person happened to mention. "learn a language through a class" → "Learn a language" (the class is just how — drop it). "start a regular class to build casual social contact" → "Build regular, casual social contact" (the aspiration is the connection, not the class). BUT keep specificity that is genuinely part of the aspiration and hints at which chapter it belongs to — e.g. "Travel as much as possible, including the longer trips" stays rich; do not flatten it to "Travel".

3. MAKE THE VAGUE MEANINGFUL — WITHOUT INVENTING. A thin one-word card should become a real, short aspiration in the person's evident spirit ("Learner" → "Keep learning new things"). But you must NEVER invent an aspiration the person did not express. You sharpen and clean up what is there; you do not add new wishes, hobbies or commitments.

4. DROP WHAT DOESN'T BELONG. This board is about meaningful priorities that could shift across the chapters of a retirement. Leave OUT tiny daily rituals and granular habits that aren't really priorities (e.g. "intentional quiet time with a cup of tea in the morning" — a lovely habit, but not a chapters-of-life priority). When unsure whether something is a real, board-worthy priority, drop it: a tight board of real priorities beats a padded one.

5. MERGE SAME-INTENT CARDS. If two cards are the same underlying aspiration in different words, keep just one, in the clearest wording.

OUTPUT
Return JSON: {"cards":[{"label":"Learn a language","category":"Aspiration"}, …]}. "label" is the clean card text. "category" is one plain word for the kind — usually "Aspiration"; use "People" for a relationship priority, and "Activity" only for a genuine standing activity that is itself a real priority. Order the cards roughly by how central and personal they seem, the richest first. NEVER output more cards than you were given.

Voice: warm, specific, plain. Never use these words: reflect, explore, unpack, journey, growth, share, deep dive. Never use the word "genuinely". Never use negative-contrast or "It's not X, it's Y" structures.

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

  // Nothing to curate — return untouched without spending a call.
  if (cards.length === 0) {
    return Response.json({ seed: { cards } });
  }

  const cardBlock = cards
    .map((c) => `- ${c.label}${c.category ? ` [${c.category}]` : ""}`)
    .join("\n");

  try {
    const response = await anthropic.messages.create({
      model: SONNET_MODEL,
      max_tokens: 1200,
      system: systemPrompt(),
      messages: [
        {
          role: "user",
          content: `Here are the things this person has said they care about — curate them into board cards:\n\n${cardBlock}`,
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

    return Response.json({ seed: coerceCuratedCards(JSON.parse(slice), cards) });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(
        `[seasons-cards] Anthropic API error — status=${error.status} message=${error.message}`
      );
    } else {
      console.error("[seasons-cards] Unexpected error:", error);
    }
    // Fall back to the untouched cards so the board always renders.
    return Response.json({ seed: { cards } });
  }
}
