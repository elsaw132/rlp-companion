import Anthropic from "@anthropic-ai/sdk";
import { coercePlanIntro, type PlanProse, type PlanIntroRequest } from "@/lib/planIntro";

// The generation interface for the Retirement Life Plan's PROSE — every
// connective and summary sentence in the document, plus the signature
// connections web. The client passes the member's already-confirmed material;
// this call WRITES the synthesis, ALL in the first person (the member speaking).
// It must draw only on what it's given, cite the real things, and invent
// nothing. Anything malformed returns null so the client keeps its deterministic
// fallback (the plan never breaks).

export const maxDuration = 50;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 2,
});

const SYSTEM_PROMPT = `You are Vita, an AI retirement coach, writing the prose for someone's Retirement Life Plan — a calm document, presenting their plan back to them.

ABSOLUTE VOICE RULE: write in the SECOND PERSON — you are speaking TO the member ("you", "your"). Never write the member's name about them in the third person ("Elsa has named her leaving date" is WRONG; "You've named your leaving date" is right). TWO exceptions are written in the member's OWN first-person voice ("I…"): selfIntro and weekRhythm — see below.

You invent NOTHING. Every field is written ONLY from the material provided, citing the real things they named. Say less and true rather than more and gilded. No "horoscope" patterns — never claim a tidy theme that isn't really in the material. If a field can't be written cleanly and truthfully, return "" (or [] / null) for it. Clean, grammatical prose; never stitched fragments. British English.

Fields:

- chapterTitle: a short, evocative name for this stage of your life, in your own register. Four to seven words. Warm, personal, never a cliché (e.g. "The years you finally get to choose").

- overview: TWO to FOUR sentences near the top tying real threads together — how a few things you named point the same way. Ground every claim in specifics (a value, a goal, a person). Connect, don't list. "" if there's no honest through-line.

- insight: THE one thing you hadn't quite said about yourself — a single true throughline running across your material that you never explicitly stated, written as one quiet, intimate line addressed to you (for example: "Look closely and nearly everything you want is a way of gathering people around you — even the travelling comes home as stories for the table"). EXACTLY ONE sentence. It must be unmistakably present in the evidence and cite-able to real content. NEVER the horoscope register ("your gardening and your walking both speak to a need to nurture growth"). If nothing genuine and earned is there, return "" — do not force it. This is the highest-trust line in the plan; only write it if it's true.

- selfIntro: ONE complete, rounded way the member would introduce THEMSELF now the job title is gone — written in their OWN FIRST PERSON ("I'm…"), a whole portrait touching the round of who they are (their people, their passions, what drives them) in two to four sentences. NOT a single slice (not "the grandchildren one" or "the travel one"); the whole person. Specific, in their own material. (This is the only first-person field.)

- balanceShape: ONE sentence naming the shape across the five areas (Restore, Move, Think, Connect, Contribute) — where your life is fullest, where it's lightest, noting an area you left deliberately quiet as a choice. Use the area names; don't list goals.

- seasonsArc: ONE to THREE sentences framing how your retirement evolves across the seasons, grounded strictly in where you actually placed things (e.g. the early years fullest while energy is highest; how things settle later). If a later season is sparse, frame it as deliberate openness. Invent no evolution the placements don't show.

- weekRhythm: a SHORT, warm, FIRST-PERSON narrative (2–4 sentences) of a typical week — its felt shape, not a list. Open with how the mornings or days tend to start, name the real fixed points the week hangs on (the anchors), then the looser pleasures that fill the open space around them, and close on the overall feel (how full or spacious). Use the real activities, each named at most once, in a natural flow. First person ("Most mornings start with…"). Honest and evocative — never a timetable, no days of the week, no clock times.

- financeNote: ONE or TWO sentences on your financial readiness. CONSUMER DUTY: surface and signpost the confidence signal only. Never give or imply financial advice, never estimate figures, never say whether the finances are adequate. If it's not settled, note plainly that firming it up with a pension provider or a financial adviser is the natural next step.

- openThreads: a SHORT list (0–4) of things you're still working out — honest, live, generative, never failures or gaps. Draw each from the "open-thread signals" provided (a financial date still to firm up, an area you're undecided about, a goal not yet specific). Second person ("You haven't yet decided…", "You still want to pin down…"). [] if there's nothing real.

- connections: the web of REAL links between your goals, your values and the people who matter — only links you would recognise from what you actually said (e.g. a goal whose note names a person or a value). Return {"nodes":[{"id","label","kind"}],"edges":[{"from","to","why"}]} where kind is "value" | "goal" | "person", ids are short slugs, label is the real short name, and why is a brief second-person reason grounded in your material. Keep it legible — the meaningful connections only, not every possible one (aim for the strongest 6–14 edges). No speculative associations. null if there isn't enough real linkage.

Voice rules (absolute): second person (except selfIntro); never the words reflect, explore, unpack, journey, growth, share, deep dive, genuinely; never negative-contrast or symmetrical structures ("It's not X, it's Y"); no retirement clichés (golden years, bucket lists, putting your feet up).

Respond with ONLY a JSON object, no markdown, no preamble:
{"chapterTitle":"...","overview":"...","insight":"...","selfIntro":"...","balanceShape":"...","seasonsArc":"...","weekRhythm":"...","financeNote":"...","openThreads":["..."],"connections":{"nodes":[],"edges":[]}}`;

function buildUserContent(body: PlanIntroRequest): string {
  const sections: string[] = [];
  if (body.name) sections.push(`Your name is ${body.name}.`);
  if (body.withPartner != null) {
    sections.push(body.withPartner ? "You're planning retirement with a partner." : "You're planning retirement on your own.");
  }
  if (body.coreValues?.length) {
    sections.push(
      `What matters most to you, most important first:\n${body.coreValues
        .map((v) => (v.meaning ? `- ${v.value}: "${v.meaning}"` : `- ${v.value}`))
        .join("\n")}`
    );
  }
  if (body.mostAliveRoles?.length) sections.push(`The roles most alive for you: ${body.mostAliveRoles.join(", ")}.`);
  if (body.roles?.length) sections.push(`Roles and identities you carry: ${body.roles.join(", ")}.`);
  if (body.energySources?.length) sections.push(`Where you find purpose and energy: ${body.energySources.join(", ")}.`);
  if (body.aspirations?.length) sections.push(`Things you want to do: ${body.aspirations.join("; ")}.`);
  if (body.relationships?.length) sections.push(`The people who feature most: ${body.relationships.join(", ")}.`);
  if (body.hopes?.trim()) sections.push(`What you've been reaching for: ${body.hopes.trim()}`);

  if (body.areas?.length) {
    const lines = body.areas.map((a) => {
      const fullness = a.deliberateGap
        ? "left deliberately quiet"
        : a.goalCount === 0
          ? "empty"
          : `${a.goalCount} goal${a.goalCount > 1 ? "s" : ""}${a.focusGoals.length ? ` (spotlit: ${a.focusGoals.join("; ")})` : ""}`;
      return `- ${a.label}: ${fullness}`;
    });
    sections.push(`The balance across the five areas:\n${lines.join("\n")}`);
  }

  if (body.focusGoals?.length) {
    sections.push(
      `Your most important goals (for the connections web and insight — cite these by their real names):\n${body.focusGoals
        .map((g) => `- ${g.label} [${g.area}]${g.note ? ` — "${g.note}"` : ""}`)
        .join("\n")}`
    );
  }

  if (body.seasons?.length || body.enduring?.length) {
    const lines: string[] = [];
    for (const s of body.seasons ?? []) lines.push(`- ${s.label}: ${s.items.length ? s.items.join("; ") : "(nothing placed here)"}`);
    if (body.enduring?.length) lines.push(`- Throughout (enduring): ${body.enduring.join("; ")}`);
    sections.push(`How you placed things across the seasons of retirement:\n${lines.join("\n")}`);
  }

  if (body.week) {
    const feel = body.week.structure >= 60 ? "leaning open/spacious" : body.week.structure <= 40 ? "leaning structured" : "balanced between structure and openness";
    const acts = body.week.activities
      .map((a) => {
        const tags = [a.anchor ? "anchor" : "", a.energy ? "gives energy" : "", a.fixed ? "ongoing work" : ""].filter(Boolean).join(", ");
        return `- ${a.label} (${a.frequency}${tags ? `; ${tags}` : ""})`;
      })
      .join("\n");
    sections.push(`The rhythm of your week (overall feel ${feel}):\n${acts}`);
  }

  if (body.finance) {
    const f = body.finance;
    const bits: string[] = [];
    if (f.lean) bits.push(`leaving work as a ${f.lean === "gradual" ? "gradual wind-down" : "clean break"}${f.shape ? ` (${f.shape})` : ""}${f.period ? `, over ${f.period}` : ""}`);
    if (f.window) bits.push(`roughly ${f.window.fromLabel}–${f.window.toLabel} years away`);
    if (f.financeLevel) bits.push(`your financial-readiness confidence is "${f.financeLevel}"`);
    if (f.financeDateKnown) bits.push(`asked if you know your financial-readiness date you said "${f.financeDateKnown}"`);
    if (f.stillBuilding?.length) bits.push(`still building: ${f.stillBuilding.join(", ")}`);
    if (bits.length) sections.push(`Leaving work and the financial-confidence signal:\n- ${bits.join("\n- ")}`);
  }

  if (body.openThreadSignals?.length) {
    sections.push(`Open-thread signals (things still in motion — phrase as second-person "still working out" lines, or omit):\n${body.openThreadSignals.map((s) => `- ${s}`).join("\n")}`);
  }

  return sections.length
    ? `Here is what you've confirmed across the programme:\n\n${sections.join("\n\n")}`
    : "Little material was given — keep the copy gentle, and return \"\" / [] / null for anything that can't be grounded.";
}

export async function POST(request: Request): Promise<Response> {
  let body: PlanIntroRequest;
  try {
    body = (await request.json()) as PlanIntroRequest;
  } catch {
    return Response.json({ intro: null });
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserContent(body) }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const slice = start !== -1 && end !== -1 ? text.slice(start, end + 1) : text;

    const intro: PlanProse | null = coercePlanIntro(JSON.parse(slice));
    // REVIEW/EVAL: the earned insight is the highest-trust, highest-risk line —
    // log it so it can be checked against the member's actual material.
    if (intro?.insight) {
      console.log(`[plan-intro] REVIEW insight${body.name ? ` (${body.name})` : ""}: ${intro.insight}`);
    }
    return Response.json({ intro });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`[plan-intro] Anthropic API error — status=${error.status} message=${error.message}`);
    } else {
      console.error("[plan-intro] Unexpected error:", error);
    }
    return Response.json({ intro: null });
  }
}
