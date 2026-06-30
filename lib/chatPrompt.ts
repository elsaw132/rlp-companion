// Vita's prompt assembly, shared so the /api/chat route and any dev tooling
// (e.g. the Vita-check report generator) build the system prompt and call the
// model through the EXACT same code path. Nothing here is Next-specific; the
// route owns the request/response plumbing and the Anthropic client.

import { COACH_BASE_PROMPT } from "@/lib/coachBasePrompt";

export type IncomingMessage = {
  role: "coach" | "user";
  text: string;
};

export type ChatRequest = {
  messages: IncomingMessage[];
  coachOpening: string;
  sessionInstructions: string;
  onboardingContext: string;
  priorReflections: string;
  sessionContent: string;
  // A readable summary of whatever the person built in this module's
  // interaction step (e.g. the day builder). Empty/omitted when the module
  // has no interaction.
  interactionSummary?: string;
  // The title of the next module in this stage, so Vita's closing sign-off can
  // name it correctly. Null/omitted on the last module of a stage, where she
  // should not name a specific next module.
  nextModuleTitle?: string | null;
  // When true, Vita closes in a single sign-off instead of the usual two-step
  // "mirror back, then confirm" wrap-up. Set for short, practical modules (e.g.
  // the senses screening) where the conversation was a couple of concrete
  // answers and there's nothing inferred to validate — restating it is noise.
  closeInOneStep?: boolean;
  // True only for the one call that generates Vita's first message, where she
  // opens by reacting to what they built rather than using a fixed line.
  isOpening?: boolean;
  // Set for the single turn right after the person re-opened the interaction
  // and saved changed picks: a one-off instruction telling Vita to acknowledge
  // the change once and carry on. Empty/omitted otherwise.
  editAcknowledgement?: string;
  // The register the person chose for Vita at onboarding. Shifts surface tone
  // only (warmth / formality / lightness) — never the structural rules. Absent
  // until the onboarding tone selector is wired up, so it defaults to "warm".
  toneChoice?: "warm" | "professional" | "playful";
};

// The model Vita runs on, and her per-turn token ceiling. Kept here so the route
// and the dev report call the model identically.
export const COACH_MODEL = "claude-sonnet-4-6";
export const COACH_MAX_TOKENS = 500;

// The tone directives that fill {toneDirective} in COACH_BASE_PROMPT. The chosen
// one rides on every Vita turn across every module. Keep these to register only
// (word choice, warmth, formality, amount of encouragement) — the structural
// rules in the base prompt hold in all three. "warm" is the pre-selected default.
export const TONE_DIRECTIVES: Record<
  NonNullable<ChatRequest["toneChoice"]>,
  string
> = {
  warm: "Warm and friendly (the default — the warm middle of the three): warm, personable and encouraging, like a kind, straight-talking friend who's genuinely interested. A short reflective acknowledgement before the question is welcome here; reassuring without gushing. Sits between the clipped professional setting and the characterful playful one.",
  professional:
    "More professional — the most economical of the three. Make the WHOLE reply noticeably shorter and more clipped than the other settings: cut the reflective preamble and the warm-up observation, lead straight with the substance, and get to the question fast. Short, plain sentences. Use the person's name where natural. No jokes, wry asides, idiom or casual filler (no \"ahead of the game\", no \"that's doing a lot of work in that sentence\"). Respect is shown through precision and brevity, not banter.",
  playful:
    "Lighter and playful — the most characterful of the three. Carry a genuine light touch all the way THROUGH the reply, not saved for a quip at the end: a brighter image, a vivid turn of phrase, or a wry aside woven into the body itself. Still plain and grown-up (never twee, bubbly or \"young\"), but this is the mode where humour and personality are most welcome.",
};

// basePrompt defaults to the live COACH_BASE_PROMPT (what the route always uses).
// The dev report passes an older snapshot here to compare old vs new prompts
// through the identical assembly path — the route never overrides it.
export function buildSystemPrompt(
  body: ChatRequest,
  basePrompt: string = COACH_BASE_PROMPT
): string {
  const filled = basePrompt
    .replace("{onboardingContext}", body.onboardingContext)
    .replace("{priorReflections}", body.priorReflections)
    .replace("{sessionContent}", body.sessionContent)
    .replace("{toneDirective}", TONE_DIRECTIVES[body.toneChoice ?? "warm"]);

  const sections = [
    filled,
    "",
    "THIS MODULE'S INSTRUCTIONS",
    body.sessionInstructions,
  ];

  if (body.interactionSummary && body.interactionSummary.trim()) {
    sections.push("", "WHAT THEY BUILT IN THIS MODULE:", body.interactionSummary);
  }

  if (body.isOpening) {
    sections.push(
      "",
      "This is the very start of the conversation, and you are speaking first. Open with a short, warm first message and ask one question — no greeting, no preamble, no welcome. If this module had a build step, react to something specific in what they made (under WHAT THEY BUILT above). Otherwise, open by gently drawing on the picture they've built in earlier modules where it's relevant — following this module's own brief and tone. Engage directly; don't recap everything back to them."
    );
    return sections.join("\n");
  }

  const nextModuleGuidance =
    body.nextModuleTitle && body.nextModuleTitle.trim()
      ? `The next module is "${body.nextModuleTitle.trim()}" — if you point ahead, name only this one and nothing else.`
      : "This is the last module of the stage, so do not name a specific next module — close gently without pointing to a particular one.";

  const closingInstruction = body.closeInOneStep
    ? `CLOSING THIS MODULE — ONE STEP. This was a short, practical conversation, so there is nothing to mirror back or confirm — do NOT add a wrap-up that restates their answers and asks whether it's a fair summary. That would just be noise here. Once they've given their answer (or made clear they're done), close in a single message: a brief, warm sign-off that asks nothing at all and ends with [[MODULE_COMPLETE]] on its own line with nothing after it. ${nextModuleGuidance} Never put [[MODULE_COMPLETE]] on any message that asks a question.`
    : `CLOSING THIS MODULE — TWO STEPS. When you're ready to close, first offer your wrap-up: name what matters in their words and check it feels right to them. This message asks a question (does this land? anything to add?), so it must NOT contain the marker. Then, only after they respond, send a brief final sign-off that points to the next module, asks nothing at all, and ends with [[MODULE_COMPLETE]] on its own line with nothing after it. ${nextModuleGuidance} Never put [[MODULE_COMPLETE]] on any message that asks a question. Only ever include the marker in that one final sign-off.`;

  sections.push("", closingInstruction);

  sections.push(
    "",
    "THE MARKER IS A LITERAL TOKEN. When you close, write the marker exactly as these eight characters — two open brackets, MODULE_COMPLETE, two close brackets: [[MODULE_COMPLETE]]. Never reword it, translate it, wrap it in tildes, asterisks or other punctuation, and never write any variant such as ~~COMPLETION_MARKER~~ or \"completion marker\". It is invisible plumbing the person never sees, so it must match exactly or it will leak into your message."
  );

  sections.push(
    "",
    "You have already opened this conversation by saying, word for word:",
    `"${body.coachOpening}"`
  );

  if (body.editAcknowledgement && body.editAcknowledgement.trim()) {
    sections.push("", body.editAcknowledgement);
  }

  return sections.join("\n");
}

// The Messages API requires the list to start with a user turn. Vita's opening
// already lives in the system prompt, so drop everything up to the user's first
// real reply, then map our bubble roles onto API roles.
export function toApiMessages(
  messages: IncomingMessage[]
): { role: "user" | "assistant"; content: string }[] {
  const firstUserIndex = messages.findIndex((m) => m.role === "user");
  const exchanges = firstUserIndex === -1 ? [] : messages.slice(firstUserIndex);
  return exchanges.map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("assistant" as const),
    content: m.text,
  }));
}
