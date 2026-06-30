/**
 * Vita-check report generator (dev tooling — NOT a unit test).
 *
 * Runs a fixed set of behaviour scenarios through Vita's REAL prompt assembly
 * (`buildSystemPrompt` from lib/chatPrompt.ts, the same code /api/chat uses) and
 * the same model, once per scenario per tone, then writes a self-contained
 * `vita-check-report.html` to the repo root. It changes nothing about Vita's
 * runtime behaviour.
 *
 * It lives under test/ only so it gets vitest's TS + "@/" alias resolution. It is
 * SKIPPED by default (so `npm test` never hits the API). Run it explicitly:
 *
 *   RUN_VITA_CHECK=1 npx vitest run test/vita-check.report.test.ts
 *
 * The ANTHROPIC_API_KEY is read from .env.local (preferred over any shell var,
 * which may be a stale shadow).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import Anthropic from "@anthropic-ai/sdk";
import {
  buildSystemPrompt,
  toApiMessages,
  COACH_MODEL,
  COACH_MAX_TOKENS,
  type ChatRequest,
} from "@/lib/chatPrompt";
import { getModule, getNextModule, type ContentBlock } from "@/lib/modules";
import { SEED_MEMBER_NAME } from "@/lib/rlpPlanSeed";

// ---------------------------------------------------------------------------
// Knobs
// ---------------------------------------------------------------------------
// Samples per scenario per tone. Bump to 2–3 to eyeball consistency; a scenario
// can override with its own `samples`.
const SAMPLES = 3;
// Optional old-vs-new column: pull the previous COACH_BASE_PROMPT from git and
// run the same scenarios through it too. Off by default. OLD_PROMPT_REV is the
// git revision whose prompt counts as "old" — HEAD works while this session's
// prompt edits are still uncommitted (HEAD = the prompt before this session).
const COMPARE_OLD = false;
const OLD_PROMPT_REV = "HEAD";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "vita-check-report.html");

const RUN = !!process.env.RUN_VITA_CHECK;

// ---------------------------------------------------------------------------
// Tones (mirrors the onboarding selector / TONE_DIRECTIVES keys)
// ---------------------------------------------------------------------------
const TONES: { key: NonNullable<ChatRequest["toneChoice"]>; label: string }[] = [
  { key: "warm", label: "Warm and friendly" },
  { key: "professional", label: "More professional" },
  { key: "playful", label: "Lighter and playful" },
];

// ---------------------------------------------------------------------------
// Scenario context builders — mirror production's format (userData.tsx), built
// on the seed member and overridden per check.
// ---------------------------------------------------------------------------
type Profile = {
  name?: string;
  partner?: boolean;
  horizon?: string;
  motivation?: string;
};

function buildOnboardingContext(p: Profile): string {
  const name = p.name ?? SEED_MEMBER_NAME;
  const nameSentence = name
    ? `Their preferred name — the only name you should ever call them — is ${name}.`
    : "";
  const parts: string[] = [];
  if (p.partner === true)
    parts.push("They're planning their retirement with a partner");
  else if (p.partner === false)
    parts.push("They're planning their retirement on their own");
  if (p.horizon) parts.push(`retirement is roughly ${p.horizon} away`);
  let sentence = parts.length ? parts.join(", ") + "." : "";
  if (p.motivation)
    sentence += `${sentence ? " " : ""}What prompted them to start: ${p.motivation.toLowerCase()}.`;
  return (
    [nameSentence, sentence.trim()].filter(Boolean).join(" ") ||
    "Nothing recorded yet."
  );
}

function buildPriorReflections(lines: string[]): string {
  if (!lines.length) return "This is one of their first modules — little is settled yet.";
  return [
    "Here's what they've worked through in earlier modules — draw on it only where it's directly relevant to this module's topic:",
    ...lines.map((l) => `- ${l}`),
  ].join("\n");
}

function primerText(primer: ContentBlock[]): string {
  return primer
    .filter((b): b is { type: "text"; value: string } => b.type === "text")
    .map((b) => b.value)
    .join("\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Scenarios — each maps to one of the six fixes
// ---------------------------------------------------------------------------
type Scenario = {
  n: number;
  fix: string;
  moduleId: string;
  check: string;
  coachOpening: string;
  userMessage: string;
  profile: Profile;
  prior: string[];
  samples?: number;
};

const SCENARIOS: Scenario[] = [
  {
    n: 1,
    fix: "Breadth — rank without cutting or forcing",
    moduleId: "1.money",
    check:
      "Keeps all three wants; if it asks about priority, does so as an open invitation; never forces one; never drops any.",
    coachOpening:
      "Looking at what you've jotted down — a trip to Italy, walking the South West Coast Path, and learning watercolours — are these the three you keep coming back to?",
    userMessage: "Those are my three — I'd genuinely love all of them.",
    profile: { name: "Margaret", partner: true },
    prior: [
      "Money & means: The things you'd love the freedom to do — a trip to Italy, walking the South West Coast Path, and learning to paint with watercolours.",
    ],
  },
  {
    n: 2,
    fix: "Plain, concrete question",
    moduleId: "2.2",
    check:
      "Leads with one concrete, plain question; no coined jargon (e.g. 'a deferred want'); ends on a question.",
    coachOpening:
      "Is there something you used to enjoy that's quietly slipped away during the busy working years?",
    userMessage:
      "I suppose I could maybe get back into languages at some point.",
    profile: { name: "Margaret", partner: true },
    prior: [],
  },
  {
    n: 3,
    fix: "Emotional moment",
    moduleId: "3.5",
    check:
      "Acknowledges with substance; no flat echo ('yes, it is a bit sad'); no wasted yes/no ('shall we stay with that?'); plain, not therapy-speak.",
    coachOpening:
      "As you think ahead, is there anything you'd want to hold on to that feels at risk of slipping?",
    userMessage:
      "When I think about old friends drifting away, that's a bit sad.",
    profile: { name: "Margaret", partner: true },
    prior: [],
  },
  {
    n: 4,
    fix: "Don't presume circumstances",
    moduleId: "2.1",
    check:
      "Doesn't assume family / grandchildren / a partner; any examples framed as neutral possibilities.",
    coachOpening:
      "When you picture an ordinary week in retirement, what do you most want it to protect?",
    userMessage: "I want to stay active and independent.",
    // Deliberately no partner and no grandchildren anywhere in the context.
    profile: { name: "Margaret", partner: false },
    prior: [
      "Imagine — an ordinary day: a morning swim and a slow breakfast, an afternoon walk somewhere new, some reading, and seeing friends in the evening.",
    ],
  },
  {
    n: 5,
    fix: "Don't invent content",
    moduleId: "2.5",
    check:
      "Stays in the present module; does NOT promise the programme 'looks at sleep later' or reference any non-existent future module/stage.",
    coachOpening:
      "Is there anything about how you feel day to day that you'd want retirement to improve?",
    userMessage: "Honestly I've been sleeping badly lately.",
    profile: { name: "Margaret", partner: true },
    prior: [],
  },
  {
    n: 6,
    fix: "Right name (the 'Davo' fix)",
    moduleId: "2.1",
    check:
      "Addresses / refers to the user as Sue — never Davo (the recipient of their letter).",
    coachOpening: "Good to see you again — shall we pick up where we left off?",
    userMessage: "Morning — yes, let's carry on.",
    profile: { name: "Sue", partner: true },
    prior: [
      "Imagine — a letter: You wrote a letter to Davo about the retirement you're picturing.",
    ],
  },
  {
    n: 7,
    fix: "Open ranking, no scarcity — keep-everything module",
    moduleId: "4.3",
    check:
      "Keeps all the goals; since the user asks how to prioritise, uses the OPEN form ('are any of these more important than the others?'); never forces a single one, never a scarcity or within-reach cut; accepts 'they're all about equal'.",
    coachOpening:
      "Here's your retirement laid across the five areas — Restore, Move, Think, Connect, Contribute — with the handful you've put in the spotlight. We can leave them just as they are, or talk one through.",
    userMessage:
      "I've spotlighted five — getting fluent in Italian, regular hill-walking with friends, volunteering at the community garden, getting back to the piano, and a big garden project. Honestly they all feel essential. How do I work out which ones matter most?",
    profile: { name: "Margaret", partner: true },
    prior: [
      "Most important goals: Across the five areas you spotlighted five goals — Italian, hill-walking with friends, volunteering at the community garden, the piano, and a big garden project.",
    ],
  },
];

// ---------------------------------------------------------------------------
// Build a ChatRequest exactly as production would shape it
// ---------------------------------------------------------------------------
function makeBody(
  sc: Scenario,
  toneKey: NonNullable<ChatRequest["toneChoice"]>
): ChatRequest {
  const info = getModule(sc.moduleId);
  if (!info) throw new Error(`Unknown module: ${sc.moduleId}`);
  const m = info.module;
  if (!m.sessionInstructions)
    throw new Error(`Module ${sc.moduleId} has no sessionInstructions`);

  const nextId = getNextModule(sc.moduleId);
  const nextTitle = nextId ? (getModule(nextId)?.module.title ?? null) : null;

  return {
    messages: [
      { role: "coach", text: sc.coachOpening },
      { role: "user", text: sc.userMessage },
    ],
    coachOpening: sc.coachOpening,
    sessionInstructions: m.sessionInstructions,
    onboardingContext: buildOnboardingContext(sc.profile),
    priorReflections: buildPriorReflections(sc.prior),
    sessionContent: primerText(m.primer) || m.description,
    nextModuleTitle: nextTitle,
    toneChoice: toneKey,
  };
}

// ---------------------------------------------------------------------------
// Automated flags
// ---------------------------------------------------------------------------
type Flag = { kind: "banned" | "questions" | "length"; text: string };

const BANNED = [
  "hold space",
  "sit with",
  "lean into",
  "your journey",
  "tenderness",
  "i'm hearing",
  "hold all",
];

function computeFlags(reply: string): Flag[] {
  const lower = reply.toLowerCase().replace(/[’']/g, "'");
  const hits = BANNED.filter((p) => lower.includes(p));
  const qCount = (reply.match(/\?/g) || []).length;
  const paras = reply.split(/\n\s*\n/).filter((s) => s.trim()).length;
  const flags: Flag[] = [];
  if (hits.length)
    flags.push({ kind: "banned", text: `Therapy/filler: “${hits.join("”, “")}”` });
  if (qCount > 1) flags.push({ kind: "questions", text: `${qCount} questions` });
  if (paras > 3) flags.push({ kind: "length", text: `${paras} paragraphs` });
  return flags;
}

// ---------------------------------------------------------------------------
// Model call (same client + params as /api/chat)
// ---------------------------------------------------------------------------
function loadApiKey(): string | null {
  try {
    const env = readFileSync(path.join(ROOT, ".env.local"), "utf8");
    const m = env.match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    /* fall through to shell env */
  }
  return process.env.ANTHROPIC_API_KEY ?? null;
}

async function runOne(
  client: Anthropic,
  body: ChatRequest,
  basePrompt?: string
): Promise<string> {
  const response = await client.messages.create({
    model: COACH_MODEL,
    max_tokens: COACH_MAX_TOKENS,
    system: [
      {
        type: "text",
        text: buildSystemPrompt(body, basePrompt),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: toApiMessages(body.messages),
  });
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");
}

// Pull the old COACH_BASE_PROMPT from git, into a temp .mjs we can import for its
// runtime value (correct escape handling). Returns null if anything fails.
async function loadOldPrompt(): Promise<string | null> {
  try {
    const src = execFileSync(
      "git",
      ["show", `${OLD_PROMPT_REV}:lib/coachBasePrompt.ts`],
      { cwd: ROOT, encoding: "utf8" }
    );
    const dir = mkdtempSync(path.join(tmpdir(), "vita-old-"));
    const file = path.join(dir, "oldPrompt.mjs");
    writeFileSync(file, src); // valid JS: `export const COACH_BASE_PROMPT = \`...\`;`
    const mod = await import(file);
    return typeof mod.COACH_BASE_PROMPT === "string"
      ? mod.COACH_BASE_PROMPT
      : null;
  } catch (e) {
    console.warn("[vita-check] COMPARE_OLD: could not load old prompt —", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// HTML rendering
// ---------------------------------------------------------------------------
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

type SampleResult = {
  newReply: string;
  newFlags: Flag[];
  oldReply: string | null;
  oldFlags: Flag[] | null;
};
type ToneResult = { label: string; samples: SampleResult[] };
type ScenarioResult = { sc: Scenario; tones: ToneResult[] };

function flagsHtml(flags: Flag[]): string {
  if (!flags.length)
    return `<span class="tag tag-ok">✓ no flags</span>`;
  return flags
    .map(
      (f) =>
        `<span class="tag tag-${f.kind}">${
          f.kind === "banned" ? "✗" : "⚠"
        } ${esc(f.text)}</span>`
    )
    .join(" ");
}

function replyBlock(reply: string, flags: Flag[], label?: string): string {
  return `
    ${label ? `<div class="sub">${esc(label)}</div>` : ""}
    <div class="reply">${esc(reply) || "<em>(empty reply)</em>"}</div>
    <div class="flags">${flagsHtml(flags)}</div>`;
}

function toneCardHtml(t: ToneResult): string {
  const body = t.samples
    .map((s, i) => {
      const multi = t.samples.length > 1;
      if (COMPARE_OLD && s.oldReply !== null) {
        return `
          <div class="cmp">
            <div class="cmp-col">
              <div class="cmp-head cmp-new">New prompt</div>
              ${replyBlock(s.newReply, s.newFlags, multi ? `Sample ${i + 1}` : undefined)}
            </div>
            <div class="cmp-col">
              <div class="cmp-head cmp-old">Old prompt</div>
              ${replyBlock(s.oldReply, s.oldFlags ?? [], multi ? `Sample ${i + 1}` : undefined)}
            </div>
          </div>`;
      }
      return replyBlock(s.newReply, s.newFlags, multi ? `Sample ${i + 1}` : undefined);
    })
    .join("");
  return `<div class="tone-card">
    <div class="tone-name">${esc(t.label)}</div>
    ${body}
  </div>`;
}

function scenarioHtml(r: ScenarioResult): string {
  return `<section class="scenario">
    <h2>${r.sc.n}. ${esc(r.sc.fix)} <span class="mod">module ${esc(r.sc.moduleId)}</span></h2>
    <p class="check"><strong>What to check:</strong> ${esc(r.sc.check)}</p>
    <div class="convo">
      <div class="line"><span class="who vita">Vita opens</span> ${esc(r.sc.coachOpening)}</div>
      <div class="line"><span class="who user">User</span> ${esc(r.sc.userMessage)}</div>
    </div>
    <div class="tones">${r.tones.map(toneCardHtml).join("")}</div>
  </section>`;
}

function renderReport(results: ScenarioResult[]): string {
  const checklist = SCENARIOS.map(
    (s) => `<li><strong>${s.n}. ${esc(s.fix)}</strong> — ${esc(s.check)}</li>`
  ).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Vita check — behaviour verification</title>
<style>
  :root{ --navy:#173F6B; --blue:#5D9CE6; --green:#78B86D; --gold:#E9B949;
    --red:#C2483B; --amber:#B5781A; --ink:#1F2D3A; --muted:#6B7280;
    --bg:#FAF8F4; --surface:#FFFDF8; --warm:#FBF7EF; --line:#E7E5E0; }
  *{ box-sizing:border-box; }
  body{ margin:0; background:var(--bg); color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,system-ui,sans-serif;
    line-height:1.55; }
  .wrap{ max-width:1100px; margin:0 auto; padding:40px 24px 90px; }
  h1{ font-size:30px; margin:0 0 6px; }
  .lede{ color:var(--muted); margin:0 0 24px; max-width:70ch; }
  h2{ font-size:19px; margin:0 0 10px; }
  h2 .mod{ font-size:12px; font-weight:700; color:var(--muted); background:#fff;
    border:1px solid var(--line); border-radius:999px; padding:2px 9px; margin-left:8px;
    vertical-align:middle; }
  .legend{ background:var(--surface); border:1px solid var(--line); border-radius:12px;
    padding:18px 20px; margin:0 0 22px; }
  .legend h3{ margin:0 0 8px; font-size:14px; text-transform:uppercase; letter-spacing:.04em;
    color:var(--muted); }
  .legend p{ margin:0 0 10px; }
  .legend ol{ margin:8px 0 0; padding-left:20px; }
  .legend li{ margin:0 0 6px; }
  .tones-key{ display:flex; gap:8px; flex-wrap:wrap; margin:4px 0 0; }
  .pill{ font-size:12px; font-weight:700; border-radius:999px; padding:3px 11px;
    background:var(--warm); border:1px solid var(--line); }
  .scenario{ background:var(--surface); border:1px solid var(--line); border-radius:14px;
    padding:22px 24px; margin:0 0 22px; box-shadow:0 1px 2px rgba(0,0,0,.03); }
  .check{ margin:0 0 12px; color:var(--ink); }
  .convo{ background:var(--warm); border:1px solid var(--line); border-radius:10px;
    padding:12px 14px; margin:0 0 16px; font-size:14px; }
  .convo .line{ margin:2px 0; }
  .who{ display:inline-block; font-size:11px; font-weight:700; border-radius:6px;
    padding:1px 7px; margin-right:8px; }
  .who.vita{ background:#FBEFC9; color:#8A6B12; }
  .who.user{ background:#E4EEFA; color:#2B5A8C; }
  .tones{ display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
  @media (max-width:880px){ .tones{ grid-template-columns:1fr; } }
  .tone-card{ background:#fff; border:1px solid var(--line); border-radius:10px; padding:14px; }
  .tone-name{ font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.04em;
    color:var(--navy); margin:0 0 10px; }
  .reply{ white-space:pre-wrap; font-size:14.5px; line-height:1.6; color:var(--ink);
    background:var(--bg); border:1px solid var(--line); border-radius:8px; padding:11px 12px; }
  .sub{ font-size:11px; font-weight:700; color:var(--muted); margin:8px 0 4px; }
  .flags{ margin:9px 0 2px; display:flex; gap:6px; flex-wrap:wrap; }
  .tag{ display:inline-block; font-size:11px; font-weight:700; padding:2px 9px; border-radius:999px; }
  .tag-ok{ background:#E5F2E1; color:#3B6F30; }
  .tag-banned{ background:#F7E0DC; color:#9B362B; }
  .tag-questions,.tag-length{ background:#FAEFD6; color:#8A6712; }
  .cmp{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:8px; }
  .cmp-head{ font-size:11px; font-weight:800; margin:0 0 5px; }
  .cmp-new{ color:var(--green); }
  .cmp-old{ color:var(--muted); }
  footer{ color:var(--muted); font-size:12px; margin-top:30px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Vita check — behaviour verification</h1>
  <p class="lede">Each scenario below is run through Vita's real prompt assembly and the real model
    (${esc(COACH_MODEL)}), once per tone. Use the automated flags to skim: a green tick means nothing
    tripped; red/amber tags mark something worth reading.</p>

  <div class="legend">
    <h3>The three tones</h3>
    <div class="tones-key">${TONES.map((t) => `<span class="pill">${esc(t.label)}</span>`).join("")}</div>
    <p style="margin-top:12px">Only the <em>register</em> should change across the three columns — warmth, formality, lightness.
      The structure should hold in all three: plain English, one concrete question, breadth kept, no presuming, no invented content, the right name.</p>
    <h3 style="margin-top:14px">What each scenario demonstrates</h3>
    <ol>${checklist}</ol>
  </div>

  ${results.map(scenarioHtml).join("")}

  <footer>Generated by test/vita-check.report.test.ts · ${SAMPLES} sample(s) per tone${COMPARE_OLD ? " · old-vs-new comparison on" : ""}.
    Not a runtime path — regenerate with <code>RUN_VITA_CHECK=1 npx vitest run test/vita-check.report.test.ts</code>.</footer>
</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------
describe.skipIf(!RUN)("Vita check report", () => {
  it(
    "generates vita-check-report.html",
    async () => {
      const apiKey = loadApiKey();
      if (!apiKey) {
        throw new Error(
          "No ANTHROPIC_API_KEY found in .env.local or the environment."
        );
      }
      const client = new Anthropic({ apiKey, maxRetries: 3 });
      const oldPrompt = COMPARE_OLD ? await loadOldPrompt() : null;

      const results: ScenarioResult[] = [];
      for (const sc of SCENARIOS) {
        const tones: ToneResult[] = [];
        for (const tone of TONES) {
          const n = sc.samples ?? SAMPLES;
          const samples: SampleResult[] = [];
          for (let i = 0; i < n; i++) {
            const body = makeBody(sc, tone.key);
            const newReply = await runOne(client, body);
            const oldReply =
              COMPARE_OLD && oldPrompt
                ? await runOne(client, body, oldPrompt)
                : null;
            samples.push({
              newReply,
              newFlags: computeFlags(newReply),
              oldReply,
              oldFlags: oldReply !== null ? computeFlags(oldReply) : null,
            });
          }
          tones.push({ label: tone.label, samples });
          console.log(`[vita-check] scenario ${sc.n} · ${tone.label} done`);
        }
        results.push({ sc, tones });
      }

      writeFileSync(OUT, renderReport(results), "utf8");
      console.log(`\n[vita-check] report written to:\n  ${OUT}\n`);
      expect(results).toHaveLength(SCENARIOS.length);
    },
    15 * 60 * 1000
  );
});
