import { auth } from "@clerk/nextjs/server";
import { insertFeedback } from "@/lib/db";
import { sendFeedbackEmail } from "@/lib/email";

// Receives a feedback submission from the in-app feedback panel. The user id is
// always taken from the authenticated Clerk session, never from client input.
// We first save the submission to the database (the durable record), then email
// it to elsa@chorus-life.com via Resend. The email is best-effort: if it fails,
// the feedback is still safely stored, so we don't fail the request over it.

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    message?: unknown;
    replyEmail?: unknown;
    page?: unknown;
  };

  const message =
    typeof body.message === "string" ? body.message.trim() : "";
  if (message.length === 0) {
    return new Response("Missing message", { status: 400 });
  }

  const replyEmail =
    typeof body.replyEmail === "string" && body.replyEmail.trim().length > 0
      ? body.replyEmail.trim()
      : null;
  const page = typeof body.page === "string" ? body.page : null;

  await insertFeedback({ userId, message, replyEmail, page });

  // Email it on too. Best-effort — a failure here is logged inside the helper
  // and doesn't undo the save above, so feedback is never lost.
  await sendFeedbackEmail({ userId, message, replyEmail, page });

  return Response.json({ ok: true });
}
