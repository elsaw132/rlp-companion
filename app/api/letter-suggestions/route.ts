import Anthropic from "@anthropic-ai/sdk";
import { HAIKU_MODEL } from "@/lib/models";

type SuggestionsRequest = {
  // Who the letter is addressed to, in the words shown to the user (e.g. "an
  // old friend you've lost touch with").
  recipientLabel: string;
  // A readable summary of what they've already imagined across Stage 1, built
  // by userData.buildPriorReflections. May be the "nothing yet" fallback.
  priorReflections: string;
  // True for the retired letter (Phase 6): the chips reflect on retirement so
  // far rather than a future they've imagined. Absent = the default framing.
  retired?: boolean;
};

// One tappable starting point. `chip` is Vita's short invitation shown on the
// button; `seed` is the first-person letter fragment dropped into the writing
// surface when tapped, which the person can then rewrite.
type Suggestion = { chip: string; seed: string };

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Shown when there's nothing earlier to draw on yet — generic but warm, so the
// blank page still has a way in.
const GENERIC_SUGGESTIONS: Suggestion[] = [
  {
    chip: "An ordinary good day",
    seed: "A good day for me now usually starts with ",
  },
  {
    chip: "The people around you",
    seed: "The people I see most these days are ",
  },
];

// Cohort framing (Phase 6). The retired variant reflects on the retirement they're
// already living (present), not one they've "imagined"; everyone else keeps the
// future-self framing.
const DEFAULT_FRAMING = `The person is about to write a short letter to someone in their life, set a good way into their retirement, describing what life looks like now. Your job is to beat the blank page: offer a few optional, tappable starting points drawn from what they've already imagined earlier in the programme.

You'll be given who they're writing to, and a summary of what they imagined in earlier modules (their day, the roles they want, their ideal week, things they'd love to do).`;

const RETIRED_FRAMING = `The person is already retired and about to write a short letter to someone in their life, reflecting on what their retirement actually looks like now. Your job is to beat the blank page: offer a few optional, tappable starting points drawn from what they've described about their retirement so far.

You'll be given who they're writing to, and a summary of what they've told you — their days as they are now, the roles they play, their week, and anything they still want to do.`;

const SYSTEM_PROMPT = `You are Vita, a warm AI coach in a retirement life-planning programme. {FRAMING} Produce 2 to 4 starting points, each tied to something they actually said — never generic, never invented.

Each starting point has two parts:
- "chip": a very short label (3 to 6 words) naming the thing, in your voice, e.g. "Your slow mornings in the garden" or "A month a year in Japan".
- "seed": a first-person opening fragment the person can build their letter from — written as if they are speaking to the recipient, warm and descriptive, present tense, trailing off so they continue it. E.g. "These days my mornings are slow ones — coffee in the garden before the world's properly awake, and " or "I finally did the thing I always talked about: I spend a month a year in Japan now, and ".

Hard rules:
- Stay descriptive — a picture of life as it is now. Never advice, lessons, regrets, or anything passed down as wisdom. This is what life looks like, not what they've learned.
- Don't ask how they feel about retirement; don't reference hopes or fears.
- Tie every seed to their actual material. Address the letter to the recipient given.
- Keep seeds short (one sentence, trailing off). Plain, warm language.
- Never use negative-contrast, parataxis, or symmetrical structures ("It's not X, it's Y"; "It isn't this, it's that"). Speak directly, confidently, and entirely in the affirmative.
- Never use the word "genuinely".

Respond with ONLY a JSON object of exactly this shape, and nothing else:
{"suggestions": [{"chip": "...", "seed": "..."}, {"chip": "...", "seed": "..."}]}`;

function extractJsonObject(s: string): string {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return s;
  return s.slice(start, end + 1);
}

export async function POST(request: Request) {
  const body = (await request.json()) as SuggestionsRequest;

  // Nothing earlier to draw on — return the generic openers without a model call.
  const hasMaterial =
    body.priorReflections &&
    body.priorReflections.trim() &&
    !/no earlier modules/i.test(body.priorReflections);
  if (!hasMaterial) {
    return Response.json({ suggestions: GENERIC_SUGGESTIONS });
  }

  const userContent = `They're writing to: ${body.recipientLabel}\n\n${body.priorReflections.trim()}`;
  const system = SYSTEM_PROMPT.replace(
    "{FRAMING}",
    body.retired ? RETIRED_FRAMING : DEFAULT_FRAMING
  );

  try {
    const response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 500,
      system,
      messages: [{ role: "user", content: userContent }],
    });

    const rawText = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    const parsed = JSON.parse(extractJsonObject(rawText)) as {
      suggestions?: Suggestion[];
    };
    const suggestions = (parsed.suggestions ?? [])
      .filter((s) => s && s.chip?.trim() && s.seed?.trim())
      .slice(0, 4)
      .map((s) => ({ chip: s.chip.trim(), seed: s.seed.trim() }));

    return Response.json({
      suggestions: suggestions.length ? suggestions : GENERIC_SUGGESTIONS,
    });
  } catch {
    // Never block the writing surface — fall back to the generic openers.
    return Response.json({ suggestions: GENERIC_SUGGESTIONS });
  }
}
