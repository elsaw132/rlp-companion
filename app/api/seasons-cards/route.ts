import Anthropic from "@anthropic-ai/sdk";
import { SONNET_MODEL } from "@/lib/models";
import { coerceCuratedCards } from "@/lib/seasonsCardsSeed";
import type { SeasonCandidate } from "@/lib/resolverInputs";

// Curates the cards for Module 4.2 ("The chapters of retirement"). The board's cards
// are the person's real priorities across the chapters of retirement. The session sends
// a broad candidate pool — aspirations, the activities they actually do, hopes, goals,
// what they want to keep, the people in their life — plus their roles and values as
// signal. One structured Claude call SELECTS and phrases a balanced set of ~8–12 cards:
// one voice, the aspiration not the tactic, the central people and recurring themes
// always represented, one card per priority (merged across wording, category and
// altitude), trivial daily routines dropped. The coercion keeps the result well-formed
// and capped; anything that goes wrong returns nothing so the board falls back to its
// raw cards and always renders.

export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,
});

function systemPrompt(): string {
  return `You are choosing and phrasing the CARDS for a board called "The chapters of retirement", part of a guided retirement life-planning programme. The person maps how their PRIORITIES shift across the chapters of retirement — early years, middle years, later years — and what they'd keep throughout, sorting each card into the chapter where it feels most alive, and adding or removing their own.

You are given a rich, messy pool of things this person has said they care about, drawn from across the whole programme in their own words — aspirations, the activities they actually do and want to, hopes, goals, and what they've said they want to keep. Some overlap, some are granular, some are worded as a tactic or a fragment. You are ALSO given, as signal, the ROLES they hold and the VALUES they've said matter most — use these to make sure the board reflects what is genuinely central to them (especially the important PEOPLE in their life), even when it appears in the pool only indirectly.

Produce the 8–12 cards that best capture THIS person's real priorities across the chapters of their retirement. Rules:

1. REFLECT WHAT'S CENTRAL AND RECURRING. If a theme runs through many entries or their core values (family, a partner, grandchildren, a lifelong passion), it MUST be represented — never let a long list of aspirations crowd out the people and activities that matter most. Balance the board across the things they reach for, the things they do, and the people they love.

2. ONE CONSISTENT VOICE. Each card is a short phrase that starts with a Capital letter and is verb-led where it reads naturally, in plain, warm English. No lowercase starts, no "-ing" fragments ("joining a community team" → "Join a community team"), no fragments that read as the mere beginning of something ("start a regular class to…").

3. THE ASPIRATION, NOT THE TACTIC. Card the underlying priority, not the particular mechanism the person happened to mention ("learn a language through a class" → "Learn a language"). Keep specificity that is genuinely part of the priority ("Travel as much as possible, including the longer trips").

4. ONE CARD PER PRIORITY — MERGE HARD, ACROSS WORDING, CATEGORY AND ALTITUDE. The same priority shows up many times: in different words, in different categories, and at different altitudes — sometimes as the MOTIVATION or value ("stay physically capable for the long term") and separately as the ACTIVITY that serves it ("keep running, walking, moving"). Those are ONE priority: merge into a single card, and never carry both a "why" card and its matching activity card, or two cards a person would obviously live out as the same thing. Every card must be a distinct priority, with no overlap.

5. MAKE PEOPLE CARDS REAL. Turn the central relationships into warm, concrete cards ("Time with the grandchildren", "Unhurried time with Harry"), grounded in what they actually said — never invent a person or a relationship not evidenced in the pool or signals.

6. DROP STANDING DAILY ROUTINES AND TRIVIA. Leave OUT ordinary daily habits and background routine that aren't priorities that shift across the chapters of a retirement — a morning cup of tea, a daily walk, background movement, a regular tidy-up. These don't belong on a board about how priorities change across decades. When unsure whether something is a real, board-worthy priority, drop it: a tight board of real priorities beats a padded one.

7. NEVER INVENT a priority the person did not express. You select, merge, sharpen and phrase what is there — you do not add new wishes, hobbies, commitments or people.

OUTPUT
Return JSON: {"cards":[{"label":"Learn a language","category":"Aspiration"}, …]}, ordered richest and most central first. "category" is one plain word — "People", "Aspiration" or "Activity" — your best read of the kind (it is used only internally, not shown). NEVER output more than 12 cards.

Voice: warm, specific, plain. Never use these words: reflect, explore, unpack, journey, growth, share, deep dive. Never use the word "genuinely". Never use negative-contrast or "It's not X, it's Y" structures.

Respond with ONLY the JSON object described above — no markdown, no preamble, no commentary.`;
}

type Body = {
  candidates?: unknown;
  roles?: unknown;
  values?: unknown;
};

function sanitizeCandidates(raw: unknown): SeasonCandidate[] {
  if (!Array.isArray(raw)) return [];
  const out: SeasonCandidate[] = [];
  for (const c of raw) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim() : "";
    if (!label) continue;
    const source = typeof o.source === "string" ? o.source : "";
    out.push({ label, source });
  }
  return out;
}

function sanitizeStrings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
}

export async function POST(request: Request) {
  let candidates: SeasonCandidate[] = [];
  let roles: string[] = [];
  let values: string[] = [];
  try {
    const body = (await request.json()) as Body;
    candidates = sanitizeCandidates(body.candidates);
    roles = sanitizeStrings(body.roles);
    values = sanitizeStrings(body.values);
  } catch {
    return Response.json({ seed: null });
  }

  // Nothing to curate — let the board fall back to its raw cards.
  if (candidates.length === 0) {
    return Response.json({ seed: null });
  }

  const poolBlock = candidates
    .map((c) => `- ${c.label}${c.source ? `  [${c.source}]` : ""}`)
    .join("\n");
  const signalBlock = [
    roles.length ? `ROLES THEY HOLD: ${roles.join(", ")}` : "",
    values.length ? `VALUES THEY'VE SAID MATTER MOST: ${values.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const userContent = [
    `THINGS THEY CARE ABOUT (the pool to curate into board cards):\n${poolBlock}`,
    signalBlock && `SIGNAL — use these to keep what's central on the board:\n${signalBlock}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const response = await anthropic.messages.create({
      model: SONNET_MODEL,
      max_tokens: 1500,
      system: systemPrompt(),
      messages: [{ role: "user", content: userContent }],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const slice = start !== -1 && end !== -1 ? text.slice(start, end + 1) : text;

    return Response.json({ seed: coerceCuratedCards(JSON.parse(slice)) });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(
        `[seasons-cards] Anthropic API error — status=${error.status} message=${error.message}`
      );
    } else {
      console.error("[seasons-cards] Unexpected error:", error);
    }
    // Fall back to the board's raw cards.
    return Response.json({ seed: null });
  }
}
