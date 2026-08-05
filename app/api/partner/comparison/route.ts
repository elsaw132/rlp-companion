import Anthropic from "@anthropic-ai/sdk";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { SONNET_MODEL } from "@/lib/models";
import {
  getActivePairingFor,
  getShareSelections,
  getCachedComparison,
  saveCachedComparison,
  listTalkTopics,
  getAllUserData,
} from "@/lib/db";
import {
  buildComparisonAssembly,
  comparisonInputHash,
} from "@/lib/coupleComparison";
import {
  comparisonSystemPrompt,
  comparisonUserContent,
  FIXED_CLOSE,
} from "@/lib/comparisonPrompt";
import {
  coerceComparison,
  FALLBACK_COMPARISON,
  type Comparison,
} from "@/lib/comparisonSeed";
import { initialFor } from "@/lib/couples";

// Assembles the couples comparison: deterministic goals/hopes/fears (filtered by
// both share selections) plus the Vita-generated framing + observations + seed
// talk topics (one Sonnet call, cached per pairing and regenerated when the
// input hash changes or ?refresh=1). Reads the partner's data only after the
// pairing authorization check, and never sees anything unshared.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 3,
});

async function generate(
  userContent: string
): Promise<{ comparison: Comparison; usable: boolean }> {
  try {
    const response = await anthropic.messages.create({
      model: SONNET_MODEL,
      // Room for the opener, three per-tab summaries and the observation groups.
      // 2000 clipped the opener; 3200 still clipped the last summary (feelings)
      // mid-word once both partners had several hopes/fears, so give it headroom.
      max_tokens: 4600,
      system: comparisonSystemPrompt(),
      messages: [{ role: "user", content: userContent }],
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const slice = start !== -1 && end !== -1 ? text.slice(start, end + 1) : text;
    const comparison = coerceComparison(JSON.parse(slice));
    // FALLBACK is returned by identity when there's no usable opener.
    return { comparison, usable: comparison !== FALLBACK_COMPARISON };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(
        `[partner-comparison] Anthropic API error — status=${error.status} message=${error.message}`
      );
    } else {
      console.error("[partner-comparison] Unexpected error:", error);
    }
    return { comparison: FALLBACK_COMPARISON, usable: false };
  }
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const pairing = await getActivePairingFor(userId);
  if (!pairing) return new Response("No active pairing", { status: 404 });

  const selections = await getShareSelections(pairing.id);
  const aId = pairing.participantAId;
  const bId = pairing.participantBId;
  const aSel = selections.find((s) => s.participantId === aId);
  const bSel = selections.find((s) => s.participantId === bId);
  if (!aSel?.completedAt || !bSel?.completedAt) {
    return Response.json({ error: "not-ready" }, { status: 409 });
  }

  const [aData, bData] = await Promise.all([
    getAllUserData(aId),
    getAllUserData(bId),
  ]);

  // Names: prefer the person's own preferred name, else their Clerk first name.
  const firstNames = new Map<string, string>();
  try {
    const client = await clerkClient();
    const res = await client.users.getUserList({ userId: [aId, bId], limit: 2 });
    for (const u of res.data) firstNames.set(u.id, (u.firstName ?? "").trim());
  } catch {
    /* fall back to preferred-name / generic below */
  }
  const nameFor = (data: Record<string, unknown>, id: string, fallback: string) => {
    const pref = data["preferred-name"];
    return (
      (typeof pref === "string" && pref.trim()) ||
      firstNames.get(id) ||
      fallback
    );
  };

  const assembly = buildComparisonAssembly({
    aData,
    bData,
    aSharedRefs: aSel.sharedItemRefs,
    bSharedRefs: bSel.sharedItemRefs,
    aName: nameFor(aData, aId, "Partner A"),
    bName: nameFor(bData, bId, "Partner B"),
  });

  const hash = comparisonInputHash(assembly.shared.a, assembly.shared.b);
  const refresh = new URL(request.url).searchParams.get("refresh") === "1";

  let comparison: Comparison;
  const cached = await getCachedComparison(pairing.id);
  if (!refresh && cached && cached.inputHash === hash) {
    comparison = cached.payload as Comparison;
  } else {
    const { comparison: gen, usable } = await generate(
      comparisonUserContent(assembly.shared.a, assembly.shared.b)
    );
    comparison = gen;
    // Only cache a real result — never persist the empty fallback, so a
    // transient failure retries next load.
    if (usable) {
      await saveCachedComparison({ pairingId: pairing.id, payload: gen, inputHash: hash });
    }
  }

  const talk = await listTalkTopics(pairing.id);
  const { a, b } = assembly.partners;

  return Response.json({
    partners: {
      a: { name: a.name, cohort: a.cohort, planName: a.planName, initial: initialFor(a.name) },
      b: { name: b.name, cohort: b.cohort, planName: b.planName, initial: initialFor(b.name) },
    },
    framing: { opener: comparison.framingOpener, close: FIXED_CLOSE },
    // Short Vita synthesis that opens each of the other three tabs (may be absent
    // on a report cached before these existed — the tab renders without one).
    summaries: {
      goals: comparison.goalsSummary ?? null,
      matters: comparison.mattersSummary ?? null,
      feelings: comparison.feelingsSummary ?? null,
    },
    sharedGround: comparison.sharedGround,
    complementary: comparison.complementary,
    different: comparison.different,
    goals: assembly.deterministic.goals,
    values: assembly.deterministic.values,
    strengths: assembly.deterministic.strengths,
    hopes: assembly.deterministic.hopes,
    fears: assembly.deterministic.fears,
    talk: {
      seeds: comparison.talkTopics,
      user: talk.map((t) => ({
        id: t.id,
        slot: t.authorParticipantId === aId ? "a" : "b",
        body: t.body,
      })),
    },
  });
}
