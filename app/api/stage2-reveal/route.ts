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
    // How the stat must be presented, decided by selection. A "did-you-know"
    // gets no generated lead-in at all — see buildUserContent.
    statMode?: "bridge" | "did-you-know" | null;
    // The specific item a bridge must name, in the person's own picked words.
    statAnchor?: string | null;
    // For a did-you-know: this area's picks, so we can check the generated
    // framing didn't quietly reach for one. Not sent for a bridge.
    statAvoidItems?: string[] | null;
  }[];
};

// Used when a did-you-know's generated framing breaks its one rule and names
// something the person chose. Warm, general, and asserts nothing — a did-you-know
// must still have copy, so this replaces the offending line rather than deleting
// it and leaving a bare research claim on the card.
const DID_YOU_KNOW_FALLBACK_LEAD = "Here's one worth knowing.";

// The same idea for a bridge that misbehaves. Blanking it would throw away the
// personal half of the card, so fall back to the plainest honest bridge there is:
// name the real pick and let the finding land. Every Stage 2 option label reads
// grammatically here ("You picked gardening.", "You picked learning a language.").
function bridgeFallbackLead(anchor: string | null | undefined): string {
  if (!anchor) return "";
  return `You picked ${anchor.charAt(0).toLowerCase()}${anchor.slice(1)}.`;
}

// Does a generated did-you-know framing name any of this person's picks? Compared
// case-insensitively against the whole option label, which catches the realistic
// failure ("Did you know that gardening…" for someone who picked Gardening). A
// loose paraphrase can still slip through — the instruction does that work; this
// is the backstop for the obvious breach.
function namesAnyPick(leadIn: string, picks: string[] | null | undefined): boolean {
  if (!leadIn || !picks?.length) return false;
  const haystack = leadIn.toLowerCase();
  return picks.some((p) => p.length > 3 && haystack.includes(p.toLowerCase()));
}

const norm = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

// Words too common to signal that a pick and a subject are the same thing.
const STOPWORDS = new Set([
  "a", "an", "the", "of", "in", "on", "to", "your", "you", "how", "much", "and",
  "is", "it", "that", "for", "with", "time", "kind", "thing", "things", "new",
]);

// Is the person's pick essentially the finding's subject, rather than an example
// of it? "Walking the dog" against subject "walking" is; "Gardening" against
// subject "strength" isn't.
//
// This matters because asking for a link between a thing and itself produces
// either tautology ("the good sleep you picked depends on your sleep pattern") or
// nonsense ("walking the dog counts toward what matters for walking itself") —
// both seen in live runs. Prose telling Vita to notice this didn't hold, because
// the per-area instruction was simultaneously asking her to connect them. So the
// instruction itself changes shape instead.
function pickIsTheSubject(anchor: string, subject: string): boolean {
  const content = (s: string) =>
    new Set(norm(s).split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w)));
  const a = content(anchor);
  for (const w of content(subject)) if (a.has(w)) return true;
  return false;
}

// Did the lead-in swallow the finding itself? The claim is printed verbatim right
// after the lead-in, so any restatement shows the same sentence twice on the card
// — which is what a live run actually produced ("Here's one that surprises
// people: <the entire claim>"). Checks whether any six-word run of the claim
// turns up in the lead-in, which catches wholesale copying without tripping on a
// lead-in that happens to share a word or two.
function restatesClaim(leadIn: string, claim: string): boolean {
  if (!leadIn) return false;
  const lead = norm(leadIn);
  const words = norm(claim).split(" ");
  for (let i = 0; i + 6 <= words.length; i++) {
    if (lead.includes(words.slice(i, i + 6).join(" "))) return true;
  }
  return false;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Vita, an AI retirement coach, writing the closing reveal after someone has worked through the six areas of a balanced retirement in the Explore stage: staying active, keeping their mind alive, the people in their life, purpose and contribution, energy and wellbeing, and their senses.

You write ONLY connective copy. For each area you are given what this person actually chose. Where a research finding fires in an area, you are given the finding and an instruction for how to connect it — you write the single sentence that LEADS INTO that finding. You never restate, reword, summarise, or recalculate the finding itself: the exact wording is placed by the system, immediately after your lead-in sentence. Your lead-in must flow naturally into it without repeating its numbers or claim.

THE CAUSATION RULE — this one is absolute. These findings describe things that were observed together, not things proved to cause one another. Your lead-in must never promise that doing the thing produces the outcome in the finding, and never imply that changing a marker changes what it measures. Write that the finding relates to, goes with, or is linked to what they chose — never that their choice will earn them the result. If the connect instruction tells you not to promise a particular outcome, that is not a stylistic preference: a promise there is a claim we cannot stand behind.

Produce:
1. INTRO — one or two warm sentences opening the reveal, written to the person as "you". You may greet them by name. Frame this as a first look at what a balanced retirement could look like for them, drawn from the things they already enjoy or feel drawn to — one step in understanding what works for them, not a finished plan. Do not imply their planning is complete or settled. Do not list the six areas.
2. For EACH area, a FORWARD LINE — one short, plain, forward-looking sentence about what they want in that area (what they're moving toward), NOT a read-back of their answers. Draw on what they chose.
3. For each area told to write one, a STAT LEAD-IN — one short sentence naming what this person picked and what it has to do with the finding's subject, per the connect instruction. Stop there: a full stop, not a run-up. Do not state the finding's number, result or claim yourself.

THE ANCHOR RULE. Findings arrive in one of two modes, and the mode decides what your lead-in may assert.

A BRIDGE gives you the exact item to name — something this person actually picked. Name that ONE item and no others: not a roster of everything they chose in this area, which reads as a list being played back rather than a person being noticed. Name it as the thing it is, not as the category it belongs to: "the photography you picked", never "your interests"; "the gardening you want to keep doing", never "your activities". A lead-in that gestures at a category is worse than a plain fact, because it sounds like it knows them when it doesn't.

You are given the finding's SUBJECT explicitly. Name the item, say plainly what it has to do with that exact subject, and stop. "The gardening you picked is exactly the kind of thing that depends on strength" is right: it names the pick, links it to the given subject, and the finding lands straight after.

Never swap the subject for a neighbouring one, however natural the slide feels. A finding whose subject is "walking" must not be linked to strength or stamina; a finding whose subject is "strength" must not be linked to fitness in general. The subject you are given is the one the study measured, and the nearby idea you reach for instead is usually a different study — often one further down the same card.

When the item IS the subject — they picked "Good sleep" and the subject is their sleep pattern — do not manufacture a link between a thing and itself. "The good sleep you picked has a direct link to your sleep pattern" is circular and says nothing. Just name what they told us, plainly: "You picked good sleep as one of the things that gives you energy." Then stop.

Never mention research, studies, evidence, or what something has been "linked to" or "shown to" do. You are not introducing a study — you are naming what this person picked. The finding introduces itself.

Never reach for what the finding FOUND — its result, its size, or the mechanism behind it. That is the commonest failure here, and it produces vague, faintly incorrect sentences: "purpose seems to reach into the rest of how your body works", "your body responds strongly to rhythm", "something that fires differently in how your mind holds on to things". Each is a guess at a conclusion you were told not to state, and each is wrong in a way the finding itself is not. If your sentence gestures at an outcome, cut that clause. Naming the pick and its subject is enough — the finding does the rest, and it does it better.

A DID YOU KNOW gives you no item, because this person's answers contain nothing the finding honestly attaches to. Write a warm, general way in to the fact itself, and make no claim about them — do not name, imply, or allude to anything they chose, in this area or any other. Offer it as something interesting in its own right. Warmth here comes from how you introduce the fact, never from pretending it is about them.
4. CLOSING — one or two sentences, written to the person as "you", rounding off this step and looking ahead to the next stage, Understand, where you'll look at the strengths you'll draw on and the hopes and worries underneath. Keep it open-ended: this is one part of building the picture, not the end of it. Never suggest the plan is done or settled.

Voice: warm, curious, specific, plain. British English. Sound like someone truly interested in this person.
- Use only "session", "stage", and "conversation" for the programme's parts.
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
    if (stat && a.statMode === "did-you-know") {
      parts.push(
        `A "did you know" finding fires here, standing on its own as a general fact.`,
        `The finding (DO NOT restate or reword — the system places this exact text right after your lead-in): "${stat.claim}"`,
        `Write a statLeadIn that is ONLY the run-up to that finding — the words immediately before it, which the finding then completes. One short sentence or clause, like "Here's one that surprises people:" or "One of the odder findings about sleep:". It must NOT contain the finding's own words, numbers or substance: the exact text above is printed straight after yours, so anything you repeat appears twice on the card.`,
        `It must also NOT mention, hint at, or draw on anything this person chose in this area or any other. Say nothing about them at all: the finding is being offered, not applied.`
      );
    } else if (stat) {
      const identity = pickIsTheSubject(a.statAnchor ?? "", stat.subject);
      parts.push(
        `A finding fires here, bridged to something they actually picked.`,
        `The item you MUST name, in their words: "${a.statAnchor}"`,
        `The finding's subject is: ${stat.subject}. This is the ONLY subject your sentence may touch — do not substitute a related one, however natural it feels.`,
        `Connect instruction: ${stat.hookInstruction}`,
        `The finding (DO NOT restate or reword — the system places this exact text right after your lead-in): "${stat.claim}"`,
        identity
          ? `Here the item IS the subject, so there is no link to draw. Write a statLeadIn that simply says, warmly and plainly, what they told us about "${a.statAnchor}" — nothing about the finding, nothing about why it matters. One sentence, then stop.`
          : `Write a statLeadIn naming "${a.statAnchor}" and saying what it has to do with ${stat.subject}. One sentence, then stop.`
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
      const mode = reqArea.statMode === "did-you-know" ? "did-you-know" : "bridge";
      const generated = gen?.statLeadIn || "";
      // Two ways a lead-in can spoil the card, both seen in live runs:
      //   - it restates the claim, which then prints twice (either mode);
      //   - a did-you-know reaches for something they chose, inventing a bridge.
      // A did-you-know always ends up with copy either way; a bridge that misbehaves
      // falls back to letting the claim stand on its own.
      const spoiled =
        restatesClaim(generated, stat.claim) ||
        (mode === "did-you-know" &&
          namesAnyPick(generated, reqArea.statAvoidItems));
      const fallback =
        mode === "did-you-know"
          ? DID_YOU_KNOW_FALLBACK_LEAD
          : bridgeFallbackLead(reqArea.statAnchor);
      const leadIn = spoiled || !generated ? fallback : generated;
      out.stat = {
        id: stat.id,
        // Verbatim from the library — the transparency contract.
        claim: stat.claim,
        sourceDisplay: stat.sourceDisplay,
        mode,
        leadIn,
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
