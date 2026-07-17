import { auth } from "@clerk/nextjs/server";
import { insertModuleFeedback, type ModuleRating } from "@/lib/db";
import {
  isRating,
  isWorked,
  ISSUE_MAX_CHARS,
  COMMENT_MAX_CHARS,
} from "@/lib/moduleFeedback";

// Receives the short per-session feedback card submitted at the close of a
// session. The user id always comes from the authenticated Clerk session, never
// from client input. We record the submission for aggregate per-session analysis
// and, unlike the support feedback route, send NO email — this fires up to 24
// times per member, so alerting on each one would be spam.
//
// Every question is skippable, so anything unusable becomes null rather than
// rejecting the whole submission — a partial answer is worth more than none. The
// scale and allowed answers live in lib/moduleFeedback so this validator, the
// card and the admin portal cannot drift apart.

function toRating(v: unknown): ModuleRating {
  return isRating(v) ? v : null;
}

// A trimmed string capped at `max`, or null when empty/absent.
function toText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t.slice(0, max) : null;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    moduleId?: unknown;
    useful?: unknown;
    engaging?: unknown;
    worked?: unknown;
    issue?: unknown;
    comment?: unknown;
  };

  const moduleId =
    typeof body.moduleId === "string" ? body.moduleId.trim() : "";
  if (moduleId.length === 0) {
    return new Response("Missing moduleId", { status: 400 });
  }

  const worked = isWorked(body.worked) ? body.worked : null;
  // "What happened?" only exists as the tail of a "no". Dropping it otherwise
  // stops a stale answer riding along if someone types one and then flips back
  // to "yes".
  const issue = worked === "no" ? toText(body.issue, ISSUE_MAX_CHARS) : null;

  await insertModuleFeedback({
    userId,
    moduleId,
    useful: toRating(body.useful),
    engaging: toRating(body.engaging),
    worked,
    issue,
    comment: toText(body.comment, COMMENT_MAX_CHARS),
  });

  return Response.json({ ok: true });
}
