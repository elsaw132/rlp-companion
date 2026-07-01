import { auth } from "@clerk/nextjs/server";
import { insertModuleFeedback, type ModuleRating } from "@/lib/db";

// Receives the short per-module feedback card submitted at the close of a
// module. The user id always comes from the authenticated Clerk session, never
// from client input. We record the submission for aggregate per-module analysis
// and, unlike the support feedback route, send NO email — this fires up to 24
// times per member, so alerting on each one would be spam.

// The allowed rating values: the strings "0".."10" (a 0–10 scale). Anything
// else (including a skipped question) is stored as null.
const RATINGS = new Set(Array.from({ length: 11 }, (_, i) => String(i)));

function toRating(v: unknown): ModuleRating {
  return typeof v === "string" && RATINGS.has(v) ? (v as ModuleRating) : null;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    moduleId?: unknown;
    useful?: unknown;
    engaging?: unknown;
    comment?: unknown;
  };

  const moduleId =
    typeof body.moduleId === "string" ? body.moduleId.trim() : "";
  if (moduleId.length === 0) {
    return new Response("Missing moduleId", { status: 400 });
  }

  const useful = toRating(body.useful);
  const engaging = toRating(body.engaging);
  const comment =
    typeof body.comment === "string" && body.comment.trim().length > 0
      ? body.comment.trim()
      : null;

  await insertModuleFeedback({ userId, moduleId, useful, engaging, comment });

  return Response.json({ ok: true });
}
