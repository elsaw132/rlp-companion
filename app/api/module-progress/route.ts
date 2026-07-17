import { auth } from "@clerk/nextjs/server";
import { recordModuleProgress } from "@/lib/db";

// Receives a slice of time spent on a session, and whether it was finished.
//
// The client flushes periodically and on the way out, sending how long it has
// been active SINCE ITS LAST FLUSH. The server adds that on. Nothing here trusts
// a total from the browser: totals would let a stale tab overwrite a good record
// with an old number, and a lost flush would cost the whole session instead of
// one slice.
//
// The user id always comes from the authenticated Clerk session, never from
// client input. Like /api/module-feedback this sends no email — it fires
// constantly and is analytics, not a message to anyone.

// A single flush is a slice of real time on one screen. Anything longer than an
// hour is not a person reading a session — it's a clock jump, a resumed laptop,
// or a bad actor — and it would quietly ruin the "how long does a session take?"
// average it was collected to answer. Clamp rather than reject: the rest of the
// submission is still worth having.
const MAX_SLICE_MS = 60 * 60 * 1000;

function toAddMs(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return 0;
  return Math.min(Math.round(v), MAX_SLICE_MS);
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    moduleId?: unknown;
    addMs?: unknown;
    newVisit?: unknown;
    completed?: unknown;
  };

  const moduleId =
    typeof body.moduleId === "string" ? body.moduleId.trim() : "";
  if (moduleId.length === 0) {
    return new Response("Missing moduleId", { status: 400 });
  }

  await recordModuleProgress({
    userId,
    moduleId,
    addMs: toAddMs(body.addMs),
    newVisit: body.newVisit === true,
    completed: body.completed === true,
  });

  return Response.json({ ok: true });
}
