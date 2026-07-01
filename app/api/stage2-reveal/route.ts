import Anthropic from "@anthropic-ai/sdk";
import { HAIKU_MODEL } from "@/lib/models";
import { STATS_BY_ID } from "@/lib/stage2Stats";
import {
  FALLBACK_STAGE2_SYNTHESIS,
  type RevealArea,
  type Stage2Synthesis,
} from "@/lib/stage2Reveal";

// The generation interface for the Stage 2 (Explore) stage-close reveal. The
// client has already run selection (which stats fire, matched to this user's
// choices) and passes, per area: a plain description of what they chose, plus the
// selected stat id where one fired. This call writes ONLY the connective copy —
// the intro, each area's forward-looking line, the one lead-in sentence into each
// stat, and the closing into Stage 3. The locked `claim` and `sourceDisplay` are
// inserted by THIS route, verbatim from the library — Vita never sees them as
// editable text, never restates or recalculates them.
//
// Anything malformed falls back to a safe, stat-free generic reveal (never
// persisted by the client), so the screen always renders.

type Stage2RevealRequest = {
  name?: string | null;
  areas: {
    area: string;
    areaLabel: string;
    // Plain description of their choices in this area — drives the forward line.
    forwardContext: string;
    // The selected stat id, or null/absent for a stat-free area.
    statId?: string | null;
  }[];
};

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Vita, an AI retirement coach, writing the closing reveal after someone has worked through the six areas of a balanced retirement in the Explore stage: staying active, keeping their mind alive, the people in their life, purpose and contribution, energy and wellbeing, and their senses.

You write ONLY connective copy. For each area you are given what this person actually chose. Where a research finding fires in an area, you are given the finding and an instruction for how to connect it — you write the single sentence that LEADS INTO that finding. You never restate, reword, summarise, or recalculate the finding itself: the exact wording is placed by the system, immediately after your lead-in sentence. Your lead-in must flow naturally into it without repeating its numbers or claim.

Produce:
1. INTRO — one or two warm sentences opening the reveal, written to the person as "you". You may greet them by name. Frame this as a first look at what a balanced retirement could look like for them, drawn from the things they already enjoy or feel drawn to — one step in understanding what works for them, not a finished plan. Do not imply their planning is complete or settled. Do not list the six areas.
2. For EACH area, a FORWARD LINE — one short, plain, forward-looking sentence about what they want in that area (what they're moving toward), NOT a read-back of their answers. Draw on what they chose.
3. For each area that has a finding, a STAT LEAD-IN — one sentence that ties the finding to their choices per the connect instruction, ending so the finding follows naturally. Do not state the finding's number or claim yourself.
4. CLOSING — one or two sentences, written to the person as "you", rounding off this step and looking ahead to the next stage, Understand, where you'll look at the strengths you'll draw on and the hopes and worries underneath. Keep it open-ended: this is one part of building the picture, not the end of it. Never suggest the plan is done or settled.

Voice: warm, curious, specific, plain. British English. Sound like someone truly interested in this person.
- Use only "module", "stage", and "conversation" for the programme's parts.
- Never use these words: reflect, explore, unpack, journey, growth, share, deep dive.
- Never say "that's wonderful", "great answer", "I hear you", "let's explore that together".
- Never open with a punchy sentence fragment like "Six areas, one direction." and never use the shape "one X worth Y-ing". Write full, natural sentences.
- Write entirely in the second person — speak to the person as "you" and "your". Never refer to them in the third person, and never make their name the subject of a sentence describing them (for example, never "That's Elsa's retirement taking shape").
- Never use negative-contrast, parataxis, or symmetrical structures ("It's not X, it's Y"; "It isn't this, it's that"). Speak directly, confidently, and entirely in the affirmative.
- Never use the word "genuinely".
- No points, badges, streaks, percentiles, or scores.

Respond with ONLY a JSON object, no markdown, no preamble, in exactly this shape:
{"intro":"...","areas":[{"area":"active","forwardLine":"...","statLeadIn":"..."}],"closing":"..."}
Include every area you were given, in the same order. Include statLeadIn only for areas that have a finding; omit it otherwise.`;

// Build the user-message content: per area, their choices, and (where a stat
// fired) the locked finding plus its connect instruction — so Vita's lead-in
// flows into wording she must not reproduce.
function buildUserContent(body: Stage2RevealRequest): string {
  const lines = body.areas.map((a) => {
    const parts = [
      `## ${a.areaLabel} (area id: ${a.area})`,
      `What they chose: ${a.forwardContext || "(nothing specific noted)"}`,
    ];
    const stat = a.statId ? STATS_BY_ID[a.statId] : undefined;
    if (stat) {
      parts.push(
        `A finding fires here. Connect instruction: ${stat.hookInstruction}`,
        `The finding (DO NOT restate or reword — the system places this exact text right after your lead-in): "${stat.claim}"`,
        `Write a statLeadIn that flows into that finding.`
      );
    } else {
      parts.push(`No finding here — write only the forward line.`);
    }
    return parts.join("\n");
  });

  const intro = body.name
    ? `This person's name is ${body.name}.\n\n`
    : "";
  return `${intro}Here is what this person chose across the six areas, in order:\n\n${lines.join(
    "\n\n"
  )}`;
}

// Assemble the final synthesis from the model's connective copy + the locked
// claims. The model's output is matched by area id; the claim and source are
// copied verbatim from the library by id (never from the model). Any area the
// model missed gets a minimal templated forward line so the reveal still renders.
function assembleSynthesis(
  raw: unknown,
  body: Stage2RevealRequest
): Stage2Synthesis | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const intro = typeof obj.intro === "string" ? obj.intro.trim() : "";
  const closing = typeof obj.closing === "string" ? obj.closing.trim() : "";
  if (!intro || !closing) return null;

  const modelAreas = Array.isArray(obj.areas) ? obj.areas : [];
  const byArea = new Map<string, { forwardLine: string; statLeadIn: string }>();
  for (const a of modelAreas) {
    if (!a || typeof a !== "object") continue;
    const rec = a as Record<string, unknown>;
    if (typeof rec.area !== "string") continue;
    byArea.set(rec.area, {
      forwardLine:
        typeof rec.forwardLine === "string" ? rec.forwardLine.trim() : "",
      statLeadIn:
        typeof rec.statLeadIn === "string" ? rec.statLeadIn.trim() : "",
    });
  }

  // Walk the request's areas in order; the request already follows reveal order.
  const areas: RevealArea[] = body.areas.map((reqArea) => {
    const gen = byArea.get(reqArea.area);
    const forwardLine = gen?.forwardLine || reqArea.forwardContext || "";
    const out: RevealArea = {
      area: reqArea.area as RevealArea["area"],
      areaLabel: reqArea.areaLabel,
      forwardLine,
    };
    const stat = reqArea.statId ? STATS_BY_ID[reqArea.statId] : undefined;
    if (stat) {
      out.stat = {
        id: stat.id,
        // Verbatim from the library — the transparency contract.
        claim: stat.claim,
        sourceDisplay: stat.sourceDisplay,
        leadIn: gen?.statLeadIn || "",
      };
    }
    return out;
  });

  if (areas.length === 0) return null;
  return { intro, areas, closing };
}

export async function POST(request: Request) {
  let body: Stage2RevealRequest;
  try {
    body = (await request.json()) as Stage2RevealRequest;
  } catch {
    return Response.json(FALLBACK_STAGE2_SYNTHESIS);
  }

  if (!Array.isArray(body.areas) || body.areas.length === 0) {
    return Response.json(FALLBACK_STAGE2_SYNTHESIS);
  }

  try {
    const response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserContent(body) }],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    // Be tolerant of stray prose around the JSON object.
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const slice = start !== -1 && end !== -1 ? text.slice(start, end + 1) : text;

    const assembled = assembleSynthesis(JSON.parse(slice), body);
    return Response.json(assembled ?? FALLBACK_STAGE2_SYNTHESIS);
  } catch {
    return Response.json(FALLBACK_STAGE2_SYNTHESIS);
  }
}
