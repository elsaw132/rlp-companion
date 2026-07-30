import { auth } from "@clerk/nextjs/server";
import {
  recordModuleProgress,
  claimPostCompletionEmail,
  setPostCompletionEmailResendId,
} from "@/lib/db";
import { sendPostCompletionSurveyEmail } from "@/lib/email";
import { allModulesInOrder } from "@/lib/modules";

// The last Plan (Stage 4) session — finishing it means the Retirement Life Plan
// is complete. Derived from the module list so it can't drift from the
// curriculum (rather than hard-coding "4.7").
const PLAN_SESSIONS = allModulesInOrder().filter((m) => m.stageNumber === 4);
const LAST_PLAN_SESSION = PLAN_SESSIONS[PLAN_SESSIONS.length - 1]?.id ?? "4.7";

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

  // Finishing the final Plan session means the Retirement Life Plan is complete:
  // fire the one-time survey invite (Resend delays it 15 minutes). The claim is
  // atomic and once-ever, so repeat flushes and revisits never re-send. We store
  // the scheduled message id so the send can be cancelled if the member completes
  // the survey in-app first. Wholly best-effort — a failed invite must never fail
  // the progress write.
  if (moduleId === LAST_PLAN_SESSION && body.completed === true) {
    try {
      if (await claimPostCompletionEmail(userId)) {
        const resendId = await sendPostCompletionSurveyEmail(userId);
        if (resendId) await setPostCompletionEmailResendId(userId, resendId);
      }
    } catch (err) {
      console.error("[module-progress] survey email trigger failed:", err);
    }
  }

  return Response.json({ ok: true });
}
