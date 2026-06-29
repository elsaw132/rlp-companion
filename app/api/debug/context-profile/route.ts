import { auth } from "@clerk/nextjs/server";
import { allFacts } from "@/lib/db";
import type { StoredFact } from "@/lib/contextFacts";

// Dev-only inspection of a user's canonical context profile, grouped by status,
// so active vs superseded vs rejected can be eyeballed before phase 2 migrates
// any consumer to read the store. Gated off in production.
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const facts = await allFacts(userId);

  const grouped: Record<StoredFact["status"], StoredFact[]> = {
    active: [],
    superseded: [],
    rejected: [],
  };
  for (const f of facts) grouped[f.status]?.push(f);

  // A per-category tally of the active set, the quickest way to spot a blind
  // spot (a module that produced nothing).
  const activeByCategory: Record<string, number> = {};
  for (const f of grouped.active) {
    activeByCategory[f.category] = (activeByCategory[f.category] ?? 0) + 1;
  }

  return Response.json({
    userId,
    counts: {
      total: facts.length,
      active: grouped.active.length,
      superseded: grouped.superseded.length,
      rejected: grouped.rejected.length,
    },
    activeByCategory,
    facts: grouped,
  });
}
