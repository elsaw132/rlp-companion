import Anthropic from "@anthropic-ai/sdk";
import { coercePlanIntro, type PlanProse, type PlanIntroRequest } from "@/lib/planIntro";

// The generation interface for the Retirement Life Plan's PROSE — every
// connective and summary sentence in the document, plus the signature
// connections web. The client passes the member's already-confirmed material;
// this call WRITES the synthesis. Voice follows one rule — whose mouth is it?
// Vita speaking ABOUT the plan is second person; the member speaking about
// THEMSELVES is first person (see the VOICE RULE below).
// It must draw only on what it's given, cite the real things, and invent
// nothing. Anything malformed returns null so the client keeps its deterministic
// fallback (the plan never breaks).

export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 2,
});

const SYSTEM_PROSE = `You are Vita, an AI retirement coach, writing the prose for someone's Retirement Life Plan — a calm document, presenting their plan back to them.

ABSOLUTE VOICE RULE. Every sentence you write is spoken by one of two people, and you decide which by asking WHOSE MOUTH IT IS. There is no third option — nothing in this document is ever written ABOUT the member in the third person.

1. THE DEFAULT — you (Vita) speaking TO the member about their plan → SECOND PERSON. Address them directly as "you" and "your".
   THIRD PERSON IS ALWAYS WRONG HERE. Never use the member's name as the subject of a sentence, and never "she/he/they" or "her/his/their" to mean the member. Both of these are FAILURES: "Elsa has named her leaving date" · "This plan is built around the people Elsa loves most, and the insistence that her time is hers to shape". Written correctly: "You've named your leaving date" · "Your plan is built around the people you love most, and your insistence that your time is yours to shape".
   The default covers nearly every field: overview, insight, balanceShape, seasonsArc, financeNote, strengthsRead, openThreads, resetActions, the connection reasons, and all four of your Reflections reads.

2. THE EXCEPTION — the member speaking about THEMSELVES → FIRST PERSON ("I", "my"). EXACTLY THREE fields: chapterTitle, selfIntro, weekRhythm. These are printed as the member's own words, so never say "you" or "your" in them.

The member's name is given to you so you know who you are talking to — not so you can write about them. If you are ever unsure, say the sentence out loud and ask who is saying it: you, or them.

BANNED WORDS — these appear in NO field, in any form. Check every sentence before you return it:
  reflect · explore · unpack · journey · growth · share · deep dive · genuinely
"genuinely" is the one that slips through most often ("time that is genuinely yours", "to be genuinely present"). It is never needed: cut it, or say "really" / "truly" / nothing at all. Also banned: negative-contrast and symmetrical structures ("It's not X, it's Y"); retirement clichés (golden years, bucket lists, putting your feet up); the phrase "quietly powerful".

Fields:

- chapterTitle: the member's own name for this stage of their life — FIRST PERSON, in their register, as if they'd named it themselves (e.g. "The years I finally get to choose"). Four to seven words. Warm, personal, never a cliché. It is the member's, not yours: never "your" or "you" in the title.

- overview and insight sit one after the other on the page and must do DIFFERENT jobs. The overview DESCRIBES the plan; the insight REVEALS something the plan doesn't say. If they make the same point, the opening reads as the same paragraph written twice — which is a failure.

- overview: TWO to FOUR sentences near the top describing what this plan is actually built around. Name the real things — a value, a goal, a person — and how they sit together. This is DESCRIPTION: say what is there. Do NOT name a single unifying theme and do NOT interpret what it all means; that is the insight's job. "" if there's nothing honest to say.

- insight: THE one thing you hadn't quite said about yourself — a single true throughline running across your material that you never explicitly stated, written as one quiet, intimate line addressed to you (for example: "You've planned the trips in detail and the coming home barely at all, which is its own answer about which part you're really looking forward to"). EXACTLY ONE sentence. It must be unmistakably present in the evidence and cite-able to real content. It must say something the overview does NOT: if the only thing you can find is the point the overview already makes, return "". NEVER open by summing the plan up — "almost everything you've named…", "nearly everything you want…" and their kin are banned openers, because they restate instead of reveal. NEVER the horoscope register ("your gardening and your walking both speak to a need to nurture growth"). If nothing true and earned is there, return "" — do not force it. This is the highest-trust line in the plan; only write it if it's true.

- strengthsRead: TWO to THREE sentences, second person, about the character strengths listed below and how this person is carrying them into retirement — naming what they keep choosing to do with them. Warm and specific, and it must land somewhere positive and true about what having these to draw on is worth to a life that feels fully lived. Do NOT list the strengths back (they are already on the page as chips right beneath this) and do NOT map each strength to a goal one by one. Say something about the person. "" if there's nothing honest here.

- selfIntro: ONE complete, rounded way the member would introduce THEMSELF now the job title is gone — written in their OWN FIRST PERSON ("I'm…"), a whole portrait touching the round of who they are (their people, their passions, what drives them) in two to four sentences. NOT a single slice (not "the grandchildren one" or "the travel one"); the whole person. Specific, in their own material.

- balanceShape: ONE sentence naming the shape across the areas of life they named for their goals (given below under "the balance across the areas of life you named", in their OWN words — e.g. "Travel & adventure", "Our home", "Cooking") — where their life is fullest, where it's lightest, noting any area they left deliberately quiet as a choice. Use their own area names exactly as given; there is NO fixed set of categories to map onto; don't list goals.

- seasonsArc: ONE sentence framing how your retirement evolves across the seasons, grounded strictly in where you actually placed things (e.g. the early years fullest while energy is highest; how things settle later). If a later season is sparse, frame it as deliberate openness. Invent no evolution the placements don't show. It opens a tab above the seasons themselves, so it must be a single tight line — never a paragraph.

- weekRhythm: a SHORT, warm, FIRST-PERSON narrative (2–4 sentences) of a typical week — its felt shape, not a list. Open with how the mornings or days tend to start, name the real fixed points the week hangs on (the anchors), then the looser pleasures that fill the open space around them, and close on the overall feel (how full or spacious). Use the real activities, each named at most once, in a natural flow. First person ("Most mornings start with…"). Honest and evocative — never a timetable, no days of the week, no clock times.

- financeNote: ONE or TWO sentences on your financial readiness. CONSUMER DUTY: surface and signpost the confidence signal only. Never give or imply financial advice, never estimate figures, never say whether the finances are adequate. If it's not settled, note plainly that firming it up with a pension provider or a financial adviser is the natural next step.

- openThreads: a SHORT list (0–4) of things you're still working out — honest, live, generative, never failures or gaps. Draw each from the "open-thread signals" provided (a financial date still to firm up, an area you're undecided about, a goal not yet specific). Second person ("You haven't yet decided…", "You still want to pin down…"). [] if there's nothing real.

- resetActions: ONLY when "reset items to develop" are provided below (a retired member's stock-take) — otherwise []. Turn EACH item into ONE short, second-person suggestion that EARNS its place: name what it is in a few words, add one line of insight (why it matters now, or what's underneath it), and give ONE concrete first move. NEVER just repeat the item back — that's a failure. Draw on their own words but add the analysis and the action. A "change" item becomes a way to reshape it; an "unfinished" item becomes a small way to pick it back up. E.g. item "the afternoons that drift with no shape" → "Give your afternoons one anchor a week — a class, a standing walk, a volunteering slot — so they have a shape you look toward rather than one that drifts." One string per item, same order.

CALIBRATION.
- Tone: where leaving work wasn't their own choice ("gentle onset" below), quieten by a notch — plain, never celebratory. Deliver the same substance; don't overcorrect into pity.
- Horizon: when "far horizon" is true below, they're more than ~10 years out. A complete plan is NOT the standard and an unformed one is not a gap — it's right for where they are, and you say so warmly. A light or wobbly spread is expected, not an unfinished essay. Realism is still useful (habits compound over a long run) but it's "worth building now", never "you're behind". The strongest thing is that they're thinking about this at all, this early. Things they're still working out are expected to be larger — natural, not failings.

Voice rules (absolute): person is set by the ABSOLUTE VOICE RULE above, and the BANNED WORDS are listed there too — both apply to every field here.

Respond with ONLY a JSON object, no markdown, no preamble:
{"chapterTitle":"...","overview":"...","insight":"...","selfIntro":"...","balanceShape":"...","strengthsRead":"...","seasonsArc":"...","weekRhythm":"...","financeNote":"...","openThreads":["..."],"resetActions":["..."]}`;

// The connections web is generated on ITS OWN call, in parallel with the prose.
// It's the largest, most token-hungry field, and folding it into the prose JSON
// meant a rich member's reply overran the token cap and the parse died — losing
// EVERY prose field along with it. Split out, each call has ample headroom and
// one failing can't take the other down.
const SYSTEM_CONNECTIONS = `You are Vita, an AI retirement coach, drawing the web of real connections in someone's Retirement Life Plan — the links between their goals, their values and the people who matter to them.

Return ONLY the links you would recognise from what they actually said — a goal whose note names a person or a value, a value that clearly drives a goal, a person a goal is built around. NEVER a speculative or generic association (do not link two goals just because both are "outdoors", or a value to a goal on a hunch). If the material doesn't show a real link, leave it out.

Each "why" is a brief line addressed to the member in the SECOND PERSON ("you"/"your"), grounded in their own material — never third person, never their name as the subject. BANNED WORDS in the why lines: reflect, explore, unpack, journey, growth, share, deep dive, genuinely.

Keep it legible — the meaningful connections only, not every possible one. Aim for the strongest 6–14 edges. Every node you return must have at least one edge (no floating nodes). If there isn't enough real linkage for at least two connected nodes, return {"nodes":[],"edges":[]}.

Respond with ONLY a JSON object, no markdown, no preamble:
{"nodes":[{"id":"short-slug","label":"real short name","kind":"value|goal|person"}],"edges":[{"from":"slug","to":"slug","why":"a brief second-person reason"}]}`;

// Vita's four "read" pieces (the Reflections tab) generate on their OWN call, in
// parallel with the prose and the web. Splitting them out cuts the long prose
// call's output by ~a third (so the first-ever /plan view lands sooner), and a
// slow or failed read can no longer delay or sink the rest of the plan.
const SYSTEM_REFLECTIONS = `You are Vita, an AI retirement coach, writing YOUR READ of someone's finished Retirement Life Plan — four short pieces where you speak as their coach about the plan as a whole. A calm document, presenting their plan back to them.

VOICE (absolute): every sentence is you (Vita) speaking TO the member about their plan — SECOND PERSON, "you" and "your". Never third person about the member, and never their name as the subject of a sentence ("Elsa has…" is a FAILURE; "You've…" is right). The member's name is given only so you know who you're talking to.

BANNED WORDS — in NO field, in any form: reflect · explore · unpack · journey · growth · share · deep dive · genuinely. "genuinely" slips through most ("time that is genuinely yours") — cut it, or say "really"/"truly"/nothing. Also banned: negative-contrast and symmetrical structures ("It's not X, it's Y"); retirement clichés (golden years, bucket lists, putting your feet up); "quietly powerful". UK English throughout.

EACH read has TWO parts, and both are required for it to appear:
  - a CALLOUT: the single takeaway, at most 8 words, no full stop. It's the line they'd remember if they read nothing else. It must be specific to THEM — never a label like "Balance" or "A strong plan".
  - a BODY of AT MOST TWO sentences. Hard limit. Say the one thing that matters and stop; do not restate the callout.
Return "" for BOTH parts to leave a read out entirely. Never a feeling-probe ("how does that sit with you?"). Never manufactured critique — say a real thing or say nothing. Plain and warm.

- balanceRead: the areas of life they named for their goals are listed below (under "the balance across the areas of life you named", in their OWN words — not a fixed set of categories), and a band beside your words already shows, as fact, which of them carry a goal. Use their own area names. Do NOT restate that fact or give a score. INTERPRET it: does the spread serve this person? Concentration can be right — say so where their strongest goals really do sit in one or two areas. Where an area is lightest, observe it and ask ONE open question about it; never assign an intent they didn't state, never imply they've failed to fill a box.

- realismNote: a means–ends check, and ONLY where there's something real — otherwise "". Do their long-horizon goals depend on a base (health, energy, mobility, the people around them) that the plan actually protects? Frame it as leverage, never deficit: what's already working and worth guarding. Where a protective habit maps onto a value they said they'd hold firm on, name that — it makes the base load-bearing.

- whatsStrong: lead with the strongest structural thing — never opening praise, never a compliment sandwich. Reward goals that FIT the person (things already theirs, carried a long time, not borrowed resolutions) and honest timing. NEVER reward volume of goals.

- coherence: hold the plan against their OWN decision rules (given below as "their rules"), which is the standard that matters because it's theirs. Where the plan honours them, say so plainly. Where a real tension exists, name it — one, specific, and only if it is really there. "" when they set no rules.

CALIBRATION.
- Tone: where leaving work wasn't their own choice ("gentle onset" below), quieten by a notch — plain, never celebratory. Deliver the same substance; don't overcorrect into pity.
- Horizon: when "far horizon" is true below, they're more than ~10 years out. A complete plan is NOT the standard and an unformed one is not a gap — it's right for where they are, and you say so warmly. A light or wobbly spread is expected, not an unfinished essay. Realism is still useful (habits compound over a long run) but it's "worth building now", never "you're behind". The strongest thing is that they're thinking about this at all, this early.

Respond with ONLY a JSON object, no markdown, no preamble:
{"balanceCallout":"...","balanceRead":"...","realismCallout":"...","realismNote":"...","strongCallout":"...","whatsStrong":"...","coherenceCallout":"...","coherence":"..."}`;

function buildUserContent(body: PlanIntroRequest): string {
  const sections: string[] = [];
  if (body.name) sections.push(`Your name is ${body.name}.`);
  if (body.withPartner != null) {
    sections.push(body.withPartner ? "You're planning retirement with a partner." : "You're planning retirement on your own.");
  }
  // Cohort framing (Phase 5): keep the tense right for someone already retired or
  // mid-exit, so the prose never reads as if retirement is still far ahead.
  if (body.retirementStage === "recently_retired") {
    sections.push("IMPORTANT FRAMING: You have already retired, not long ago, and are still settling in. Write in the PRESENT about the retirement you're living now — never as a future you're approaching.");
  } else if (body.retirementStage === "established") {
    sections.push("IMPORTANT FRAMING: You have been retired for a while. Write in the PRESENT, taking stock of the retirement you're living — never as a future you're approaching.");
  } else if (body.retirementStage === "winding_down") {
    sections.push("IMPORTANT FRAMING: You are winding down, with the exit from work already in motion. Write in the present-progressive — never as if retirement is still years ahead.");
  }
  if (body.onsetGentle) {
    sections.push("GENTLE ONSET: Leaving work wasn't fully your own choice, so keep the framing gentle and never celebrate it as a chosen fresh start.");
  }
  if (body.farHorizon) {
    sections.push(
      "FAR HORIZON: You are more than ten years from retiring. A complete plan is not the standard here — an unformed one is right for where you are. Reward the head start; never imply you're behind or that there are boxes left to fill."
    );
  }
  if (body.principles?.length) {
    sections.push(
      `Their rules — the decisions they said they'd hold to when things pull apart (the standard for the coherence read):\n${body.principles
        .map((p) => `- ${p}`)
        .join("\n")}`
    );
  }
  if (body.nonNegotiables?.length) {
    sections.push(`Values they said they'd hold firm on: ${body.nonNegotiables.join(", ")}.`);
  }
  if (body.flexible?.length) {
    sections.push(`Values they said they can flex on: ${body.flexible.join(", ")}.`);
  }
  if (body.resetItems?.length) {
    sections.push(
      `Reset items to develop (turn each into a framed resetActions suggestion — insight + a first move, never a reprint), in order:\n${body.resetItems
        .map((r) => `- [${r.source}] ${r.label}`)
        .join("\n")}`
    );
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
  if (body.strengths?.length) sections.push(`Your character strengths (for strengthsRead): ${body.strengths.join(", ")}.`);
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
    sections.push(`The balance across the areas of life you named (your own words, not a fixed set):\n${lines.join("\n")}`);
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

// The prompt bans a short list of words, and a prompt-level ban on a common
// adverb is a request, not a guarantee — "genuinely" has slipped through a clean
// prompt. This doesn't rewrite the model's words (silently editing prose Vita
// wrote would hide the problem); it makes the breach visible in the logs so the
// prompt can be fixed rather than trusted. Quoted member material is not checked:
// those are their words, not Vita's.
const BANNED = ["reflect", "explore", "unpack", "journey", "growth", "share", "deep dive", "genuinely"];
const MEMBER_VOICE = new Set(["chapterTitle", "selfIntro", "weekRhythm"]);

function logVoiceBreaches(intro: PlanProse, name?: string | null): void {
  const who = name ? ` (${name})` : "";
  for (const [field, value] of Object.entries(intro)) {
    if (typeof value !== "string" || !value) continue;
    const lower = value.toLowerCase();
    for (const word of BANNED) {
      if (new RegExp(`\\b${word}\\b`).test(lower)) {
        console.warn(`[plan-intro] VOICE${who}: banned word "${word}" in ${field} — "${value.slice(0, 90)}"`);
      }
    }
    // Third person about the member is the failure the voice rule exists to stop.
    if (!MEMBER_VOICE.has(field) && name && new RegExp(`\\b${name}\\b`).test(value)) {
      console.warn(`[plan-intro] VOICE${who}: third-person name in ${field} — "${value.slice(0, 90)}"`);
    }
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: PlanIntroRequest;
  try {
    body = (await request.json()) as PlanIntroRequest;
  } catch {
    return Response.json({ intro: null });
  }

  const content = buildUserContent(body);

  // Three calls, run together: the prose (§1–9 text), Vita's Reflections reads,
  // and the connections web (its own JSON). They're independent — if one truncates
  // or errors, the others still land. This is the fix for a monolithic reply that
  // lost EVERYTHING when a rich member's data overran a single token cap, and
  // splitting the long prose call in two also makes the first /plan view land
  // sooner (wall-clock is the slowest single call, not their sum). Each gets real
  // headroom.
  const [proseObj, reflObj, connObj] = await Promise.all([
    callModelJson("prose", SYSTEM_PROSE, content, 4096, body.name),
    callModelJson("reflections", SYSTEM_REFLECTIONS, content, 1536, body.name),
    callModelJson("connections", SYSTEM_CONNECTIONS, content, 2048, body.name),
  ]);

  // Merge: prose + reflections fields carry no overlapping keys; graft the
  // separately-generated connections on before coercion validates the whole.
  const merged =
    proseObj || reflObj || connObj
      ? { ...(proseObj ?? {}), ...(reflObj ?? {}), connections: connObj ?? null }
      : null;
  const intro: PlanProse | null = coercePlanIntro(merged);

  // REVIEW/EVAL: the earned insight is the highest-trust, highest-risk line —
  // log it so it can be checked against the member's actual material.
  if (intro?.insight) {
    console.log(`[plan-intro] REVIEW insight${body.name ? ` (${body.name})` : ""}: ${intro.insight}`);
  }
  if (intro) logVoiceBreaches(intro, body.name);
  return Response.json({ intro });
}

// One model call returning a parsed JSON object, or null if it errored or came
// back malformed/truncated. Isolated per call so one failure never takes down the
// sibling call running alongside it.
async function callModelJson(
  which: "prose" | "reflections" | "connections",
  system: string,
  content: string,
  maxTokens: number,
  name?: string | null
): Promise<Record<string, unknown> | null> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content }],
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const slice = start !== -1 && end !== -1 ? text.slice(start, end + 1) : text;
    try {
      return JSON.parse(slice) as Record<string, unknown>;
    } catch (e) {
      console.error(
        `[plan-intro] ${which} reply was not valid JSON (${slice.length} chars) — likely truncated by max_tokens${name ? ` (${name})` : ""}. ${e}`
      );
      return null;
    }
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`[plan-intro] ${which} Anthropic API error — status=${error.status} message=${error.message}`);
    } else {
      console.error(`[plan-intro] ${which} unexpected error:`, error);
    }
    return null;
  }
}
