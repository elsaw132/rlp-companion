import "server-only";

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
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#16202E">
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

// Minimal HTML escaping for the values we interpolate into the email body.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
