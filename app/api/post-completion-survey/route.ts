import { auth } from "@clerk/nextjs/server";
import {
  upsertPostCompletionSurvey,
  getPostCompletionEmailResendId,
  clearPostCompletionEmailResendId,
} from "@/lib/db";
import { cancelPostCompletionSurveyEmail } from "@/lib/email";
import {
  toRating,
  toFeelings,
  toText,
  SENTENCE_MAX_CHARS,
  OPEN_MAX_CHARS,
  FEELINGS_OTHER_MAX_CHARS,
} from "@/lib/postCompletionSurvey";
import { allModulesInOrder } from "@/lib/modules";

// Receives the one-time post-completion survey, shown when a member finishes the
// programme (their plan is complete). The user id always comes from the
// authenticated Clerk session, never from client input. Like /api/baseline-survey
// this sends NO email — it is research data read only through the admin portal.
// Every field is optional (each question can be skipped), so unusable values
// become null rather than rejecting the whole submission.

// The "session that stayed with you" answer is stored as a module id; anything
// that isn't a real module id (or a skip) becomes null. Built once from the
// module list, so it can never fall out of step with the sessions on offer.
const MODULE_IDS = new Set(allModulesInOrder().map((m) => m.id));

function toModuleId(v: unknown): string | null {
  return typeof v === "string" && MODULE_IDS.has(v) ? v : null;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  await upsertPostCompletionSurvey({
    userId,
    overallValue: toRating(body.overallValue),
    feelings: toFeelings(body.feelings),
    feelingsOther: toText(body.feelingsOther, FEELINGS_OTHER_MAX_CHARS),
    planningConfidence: toRating(body.planningConfidence),
    beforeThought: toText(body.beforeThought, SENTENCE_MAX_CHARS),
    afterThought: toText(body.afterThought, SENTENCE_MAX_CHARS),
    expectationsMet: toText(body.expectationsMet, OPEN_MAX_CHARS),
    vitaUnderstood: toRating(body.vitaUnderstood),
    vitaGoodQuestions: toRating(body.vitaGoodQuestions),
    vitaAuthentic: toRating(body.vitaAuthentic),
    vitaChallenged: toRating(body.vitaChallenged),
    vitaDiscovered: toRating(body.vitaDiscovered),
    comfortSharing: toRating(body.comfortSharing),
    comfortImprove: toText(body.comfortImprove, OPEN_MAX_CHARS),
    sessionStayed: toModuleId(body.sessionStayed),
    sessionStayedWhy: toText(body.sessionStayedWhy, OPEN_MAX_CHARS),
    teamMessage: toText(body.teamMessage, OPEN_MAX_CHARS),
  });

  // If they've completed the survey in-app before the 15-minute invite fires,
  // cancel that scheduled email — no point emailing someone who's already done
  // it. Best-effort; never fails the save. (If the email has already sent, the
  // cancel is a harmless no-op.)
  try {
    const resendId = await getPostCompletionEmailResendId(userId);
    if (resendId) {
      await cancelPostCompletionSurveyEmail(resendId);
      await clearPostCompletionEmailResendId(userId);
    }
  } catch (err) {
    console.error("[post-completion-survey] cancel scheduled email failed:", err);
  }

  return Response.json({ ok: true });
}
