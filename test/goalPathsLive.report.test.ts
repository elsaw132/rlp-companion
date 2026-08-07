/**
 * Live timing test for the 4.4 goal-paths rework (dev tooling — NOT a unit test).
 *
 * Pulls a REAL user's profile from the prod DB, reconstructs the exact inputs the
 * 4.4 surface sends to /api/goal-paths (using the same lib functions the app uses),
 * then runs BOTH:
 *   - NEW: the actual shipped POST handler (per-goal, parallel), timed.
 *   - OLD: one combined call for all goals (max_tokens 2600), timed.
 * so we can see, on this person's data, that the new path returns real personalized
 * paths and how long each approach takes.
 *
 * Skipped by default. Run explicitly, passing the user to test (no default — you
 * must name whose data to read):
 *   RUN_GOALPATHS_LIVE=1 GOALPATHS_USER=user_xxx npx vitest run test/goalPathsLive.report.test.ts
 *
 * Both DATABASE_URL and ANTHROPIC_API_KEY are read from .env.local (the shell may
 * hold a stale empty ANTHROPIC_API_KEY shadow, so .env.local wins).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import Anthropic from "@anthropic-ai/sdk";
import { spotlightGoalInputs, coerceGoalPaths } from "@/lib/goalPathsSeed";
import { resolveSeedText, resolveSeedItems } from "@/lib/contextResolver";
import type { StoredFact } from "@/lib/contextFacts";

const ROOT = path.resolve(__dirname, "..");
const RUN = !!process.env.RUN_GOALPATHS_LIVE;
const USER_ID = process.env.GOALPATHS_USER ?? "";
const REPORT_PATH = process.env.GOALPATHS_REPORT ?? path.join(ROOT, "goalpaths-live-report.txt");

const lines: string[] = [];
function say(s = "") {
  lines.push(s);
  // eslint-disable-next-line no-console
  console.log(s);
}

function envValue(name: string): string | null {
  try {
    const env = readFileSync(path.join(ROOT, ".env.local"), "utf8");
    const m = env.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+)$`, "m"));
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    /* fall through */
  }
  return process.env[name] ?? null;
}

// context_facts row → StoredFact (camelCase) the resolver expects.
function rowToFact(r: Record<string, unknown>): StoredFact {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    category: r.category as StoredFact["category"],
    domain: (r.domain as StoredFact["domain"]) ?? null,
    data: r.data as StoredFact["data"],
    provenanceModule: String(r.provenance_module ?? ""),
    provenanceSource: (r.provenance_source as StoredFact["provenanceSource"]) ?? "vita",
    status: (r.status as StoredFact["status"]) ?? "active",
    supersededBy: (r.superseded_by as string | null) ?? null,
    confidence: (r.confidence as StoredFact["confidence"]) ?? "stated",
    createdAt: String(r.created_at ?? ""),
    lastAffirmedAt: (r.last_affirmed_at as string | null) ?? null,
  };
}

describe.skipIf(!RUN)("goal-paths live timing", () => {
  it(
    "drafts real personalized paths for the user's actual goals, fast",
    async () => {
      expect(USER_ID, "pass GOALPATHS_USER=user_... (no default)").toBeTruthy();
      const dbUrl = envValue("DATABASE_URL");
      const apiKey = envValue("ANTHROPIC_API_KEY");
      expect(dbUrl, "DATABASE_URL in .env.local").toBeTruthy();
      expect(apiKey, "ANTHROPIC_API_KEY in .env.local").toBeTruthy();

      const sql = neon(dbUrl!);

      // 1. Active canonical facts → the user model + their named strengths.
      const factRows = (await sql`
        select id, user_id, category, domain, data, provenance_module,
               provenance_source, status, superseded_by, confidence,
               created_at, last_affirmed_at
        from context_facts
        where user_id = ${USER_ID} and status = 'active'
      `) as Record<string, unknown>[];
      const facts = factRows.map(rowToFact);

      // 2. The 4.3 result (spotlighted goals) + onboarding.
      const udRows = (await sql`
        select key, value from user_data
        where user_id = ${USER_ID}
          and key in ('interaction:4.3', 'onboarding', 'preferred-name')
      `) as { key: string; value: unknown }[];
      const ud = new Map(udRows.map((r) => [r.key, r.value]));

      const goals = spotlightGoalInputs(
        (ud.get("interaction:4.3") as Parameters<typeof spotlightGoalInputs>[0]) ?? null
      );
      const userModel = resolveSeedText("4.4", facts);
      const strengths = resolveSeedItems("4.4", facts, "strength").map((f) => f.label);

      const onboard = (ud.get("onboarding") as Record<string, unknown>) ?? {};
      const preferred = ud.get("preferred-name") as string | undefined;
      const onboarding = [
        preferred ? `Their preferred name is ${preferred}.` : "",
        onboard.partner ? `Partner status: ${String(onboard.partner)}.` : "",
        onboard.horizon ? `Retirement horizon: ${String(onboard.horizon)}.` : "",
        onboard.motivation ? `What brought them here: ${String(onboard.motivation)}.` : "",
      ]
        .filter(Boolean)
        .join(" ");

      say(
        `\n[live] user=${USER_ID}\n[live] active facts=${facts.length}, strengths=${strengths.length}\n[live] spotlighted goals=${goals.length}:`
      );
      for (const g of goals) say(`   • [${g.track}] ${g.goal}`);
      expect(goals.length, "user has spotlighted goals from 4.3").toBeGreaterThan(0);

      const body = {
        userModel,
        onboarding,
        goals,
        strengths,
      };

      // ---- NEW: the actual shipped route (per-goal, parallel) --------------
      // Set the real key before importing the route (its Anthropic client reads
      // process.env at module init; the shell may hold an empty shadow).
      process.env.ANTHROPIC_API_KEY = apiKey!;
      const { POST } = await import("@/app/api/goal-paths/route");

      const req = new Request("http://test/api/goal-paths", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const tNew0 = performance.now();
      const res = await POST(req);
      const newMs = performance.now() - tNew0;
      const { seed } = (await res.json()) as {
        seed: { paths: Array<Record<string, unknown>> } | null;
      };

      say(`\n[NEW per-goal parallel]  ${(newMs / 1000).toFixed(1)}s`);
      if (seed) {
        for (const p of seed.paths) {
          const detail = p.milestones
            ? (p.milestones as Array<{ label: string; done?: boolean }>)
                .map((m) => `${m.done ? "✓ " : "→ "}${m.label}`)
                .join("\n       ")
            : `helps now: ${((p.alreadyHelps as string[]) ?? []).join("; ")}` +
              ` | would help: ${((p.wouldHelp as string[]) ?? []).join("; ")}`;
          say(`\n   ${p.goal}  [${p.track}]  strengths: ${((p.strengths as string[]) ?? []).join(", ")}`);
          say(`       ${detail}`);
        }
      } else {
        say("   (seed was null — honest failure)");
      }
      expect(seed, "new route returned a personalized seed").not.toBeNull();
      expect(seed!.paths.length).toBe(goals.length);

      // ---- OLD: one combined call for all goals (for timing comparison) ----
      const client = new Anthropic({ apiKey: apiKey!, maxRetries: 1 });
      const goalBlock = goals
        .map((g, i) => {
          const kind = g.track === "be" ? "way to live (be)" : "thing to do/achieve (do)";
          return `${i + 1}. [${kind}] ${g.goal}`;
        })
        .join("\n");
      const context = [
        onboarding && `ABOUT THEM:\n${onboarding}`,
        userModel,
        `THE GOALS THEY SPOTLIGHTED (draft one path per goal, in this order, honouring each track):\n${goalBlock}`,
        strengths.length ? `THEIR NAMED STRENGTHS:\n${strengths.map((s) => `- ${s}`).join("\n")}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const tOld0 = performance.now();
      let oldMs = 0;
      let oldOk = false;
      try {
        const r = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 2600,
          system:
            "You are drafting the PATH to each goal for someone in a guided retirement life-planning programme. Return ONE path object per goal, in order, as JSON {\"paths\":[...]}. A 'do' goal carries a milestone ladder; a 'be' goal carries alreadyHelps/wouldHelp. Respond with ONLY the JSON object.",
          messages: [{ role: "user", content: `Here is everything this person has shared so far:\n\n${context}` }],
        });
        oldMs = performance.now() - tOld0;
        const text = r.content.filter((b) => b.type === "text").map((b) => b.text).join("");
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        oldOk = !!coerceGoalPaths(JSON.parse(text.slice(start, end + 1)), goals, strengths);
      } catch (e) {
        oldMs = performance.now() - tOld0;
        say(`   OLD combined call errored after ${(oldMs / 1000).toFixed(1)}s: ${String(e)}`);
      }

      say(
        `\n──────── TIMING (${goals.length} goals) ────────\n` +
          `   NEW (per-goal parallel): ${(newMs / 1000).toFixed(1)}s\n` +
          `   OLD (single combined):   ${(oldMs / 1000).toFixed(1)}s${oldOk ? "" : " (failed/invalid)"}\n`
      );

      writeFileSync(REPORT_PATH, lines.join("\n") + "\n");
    },
    180_000
  );
});
