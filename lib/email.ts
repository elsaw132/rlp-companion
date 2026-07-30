import "server-only";
import { clerkClient } from "@clerk/nextjs/server";

// Sends feedback submissions to the team by email via Resend
// (https://resend.com). We call Resend's HTTP API directly with fetch so there
// is no extra package to install. Configuration comes from environment
// variables so no secret ever lives in the code:
//
//   RESEND_API_KEY      — required to actually send. If it's missing (e.g. not
//                         set up yet), sending is skipped silently and the
//                         caller carries on — feedback is still saved to the DB.
//   FEEDBACK_TO_EMAIL   — where feedback is delivered. Defaults to Elsa.
//   FEEDBACK_FROM_EMAIL — the "from" address. Defaults to Resend's shared
//                         onboarding sender, which works without verifying a
//                         domain as long as you send to your own address.
//
// Sending is best-effort: this function never throws. A failure is logged and
// reported via the return value, but it must not break saving the feedback.

const TO = process.env.FEEDBACK_TO_EMAIL || "elsa@chorus-life.com";
const FROM =
  process.env.FEEDBACK_FROM_EMAIL || "RLP Companion <onboarding@resend.dev>";

// The survey invite is a USER-facing email, so it needs a verified chorus-life.com
// sender to land in the inbox (the shared onboarding@resend.dev sender only
// delivers to your own Resend account address). Set SURVEY_FROM_EMAIL once the
// domain is verified in Resend; until then it falls back to FROM and only
// delivers to your own address.
const SURVEY_FROM =
  process.env.SURVEY_FROM_EMAIL || "Chorus Life <onboarding@resend.dev>";
// Where the survey link points. The email is sent from the server, so it needs an
// absolute URL; defaults to the production app.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.chorus-life.com";

type FeedbackEmail = {
  message: string;
  replyEmail: string | null;
  page: string | null;
  userId: string;
};

export async function sendFeedbackEmail(
  input: FeedbackEmail
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Not configured yet — saving to the DB still happened, so this is fine.
    console.warn("[feedback] RESEND_API_KEY not set; email not sent");
    return false;
  }

  const where = input.page || "unknown page";
  const replyLine = input.replyEmail
    ? input.replyEmail
    : "(no reply address given)";

  const text = [
    "New feedback from the RLP Companion:",
    "",
    input.message,
    "",
    "—",
    `Page: ${where}`,
    `Reply to: ${replyLine}`,
    `User ID: ${input.userId}`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#0A322D">
      <p style="margin:0 0 12px"><strong>New feedback from the RLP Companion</strong></p>
      <p style="white-space:pre-wrap;margin:0 0 16px">${escapeHtml(
        input.message
      )}</p>
      <hr style="border:none;border-top:1px solid #E9E9E4;margin:16px 0" />
      <p style="margin:0;color:#7C7F86;font-size:13px">
        Page: ${escapeHtml(where)}<br/>
        Reply to: ${escapeHtml(replyLine)}<br/>
        User ID: ${escapeHtml(input.userId)}
      </p>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        subject: `RLP Companion feedback — ${where}`,
        text,
        html,
        // Let Elsa hit "reply" and reach the tester directly when they opted in.
        ...(input.replyEmail ? { reply_to: input.replyEmail } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[feedback] Resend send failed:", res.status, detail);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[feedback] Resend send threw:", err);
    return false;
  }
}

// Schedules the post-completion survey invite for 30 minutes after a member
// finishes their plan — a gentle gap so it lands once they've had a moment with
// the plan, not the instant they finish. Resend's scheduled_at does the delay, so
// no cron or queue is needed. The member's email is read from Clerk (never stored
// in our DB). Best-effort: never throws; returns whether the send was scheduled.
// The caller has already claimed the once-per-user marker.
export async function sendPostCompletionSurveyEmail(
  userId: string
): Promise<string | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[survey-email] RESEND_API_KEY not set; email not scheduled");
    return null;
  }

  let to: string | null = null;
  let firstName = "";
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    to =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      null;
    firstName = user.firstName ?? "";
  } catch (err) {
    console.error("[survey-email] Clerk lookup failed:", err);
    return null;
  }
  if (!to) {
    console.warn("[survey-email] no email address for user", userId);
    return null;
  }

  const link = `${APP_URL}/completion-survey`;
  const hi = firstName ? `Dear ${firstName},` : "Hello,";

  const text = [
    hi,
    "",
    "You've built your Retirement Life Plan — a plan shaped around your own hopes, your priorities, your strengths, and the life you'd like in retirement.",
    "",
    "Thank you for being part of the Founding Chorus, and for everything you've told us along the way.",
    "",
    "While it's all fresh, we'd love your first impressions. The button below takes you to a short survey to share your thoughts on the journey while they're still fresh in your mind.",
    "",
    `Tell us how it went: ${link}`,
    "",
    "As always, your answers and input help shape what comes next for everyone who follows. Thank you for building with us.",
    "",
    "With thanks,",
    "Elsa, John and Sarah",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#0A322D;max-width:600px;margin:0 auto;padding:8px 4px">
      <p style="margin:0 0 16px">${escapeHtml(hi)}</p>
      <p style="margin:0 0 16px">You&rsquo;ve built your Retirement Life Plan &mdash; a plan shaped around your own hopes, your priorities, your strengths, and the life you&rsquo;d like in retirement.</p>
      <p style="margin:0 0 16px">Thank you for being part of the Founding Chorus, and for everything you&rsquo;ve told us along the way.</p>
      <p style="margin:0 0 24px">While it&rsquo;s all fresh, we&rsquo;d love your first impressions. The button below takes you to a short survey to share your thoughts on the journey while they&rsquo;re still fresh in your mind.</p>
      <p style="margin:0 0 28px">
        <a href="${escapeHtml(link)}" style="display:inline-block;background:#00645F;color:#ffffff;text-decoration:none;font-weight:600;padding:13px 26px;border-radius:8px">Tell us how it went</a>
      </p>
      <p style="margin:0 0 20px">As always, your answers and input help shape what comes next for everyone who follows. Thank you for building with us.</p>
      <p style="margin:0;color:#5b6b66">With thanks,<br/>Elsa, John and Sarah</p>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: SURVEY_FROM,
        to: [to],
        subject: "You've built your Retirement Life Plan — how was it?",
        text,
        html,
        // Resend's native delayed send — accepts natural language. No cron needed.
        scheduled_at: "in 15 min",
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[survey-email] Resend schedule failed:", res.status, detail);
      return null;
    }
    // Return the scheduled message id so the caller can store it and cancel the
    // send later if the member completes the survey before it fires.
    const data = (await res.json().catch(() => null)) as { id?: string } | null;
    return data?.id ?? null;
  } catch (err) {
    console.error("[survey-email] Resend schedule threw:", err);
    return null;
  }
}

// Cancel a scheduled survey invite — called when the member completes the survey
// in-app before the delayed send fires, so we don't email someone who's already
// done it. Best-effort: an already-sent message can't be cancelled and returns an
// error, which we swallow.
export async function cancelPostCompletionSurveyEmail(
  resendId: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  try {
    const res = await fetch(
      `https://api.resend.com/emails/${resendId}/cancel`,
      { method: "POST", headers: { Authorization: `Bearer ${apiKey}` } }
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn("[survey-email] cancel returned", res.status, detail);
    }
  } catch (err) {
    console.error("[survey-email] cancel threw:", err);
  }
}

// Minimal HTML escaping for the values we interpolate into the email body.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
