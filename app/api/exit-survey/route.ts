import { insertExitSurvey } from "@/lib/db";
import {
  SITUATION_OPTIONS,
  REASON_OPTIONS,
  LOOKING_BACK_OPTIONS,
  RECONTACT_OPTIONS,
  GENDER_OPTIONS,
  WORK_STATUS_OPTIONS,
  SHORT_TEXT_MAX,
  LONG_TEXT_MAX,
  EMAIL_MAX,
  CLARITY_MIN,
  CLARITY_MAX,
  NPS_MIN,
  NPS_MAX,
  AGE_MIN,
  AGE_MAX,
} from "@/lib/exitSurvey";

// Receives the churned-participant exit survey. Deliberately PUBLIC and
// UNAUTHENTICATED — most respondents never made an account, so unlike
// /api/baseline-survey there is NO auth() and NO user_id. The route is
// allowlisted in proxy.ts so the middleware lets it through. Like the other
// surveys it sends NO email; responses are read only through the admin portal.
//
// Every field is optional (each question can be skipped) and every value is
// allowlist-validated, so anything unexpected — including junk from a script
// hitting the open endpoint — becomes null rather than being stored or
// rejecting the whole submission. There is nothing sensitive to leak and no
// account to affect; the worst a bad actor can do is add noise rows, which the
// admin can ignore.

// A value that must be one of a fixed option list, else null (a skip, or junk).
function oneOf(options: readonly string[], v: unknown): string | null {
  return typeof v === "string" && (options as readonly string[]).includes(v)
    ? v
    : null;
}

// The Q2 multi-select: keep only known options, de-duplicated, order preserved.
function toReasons(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  for (const item of v) {
    if (typeof item === "string" && (REASON_OPTIONS as readonly string[]).includes(item)) {
      seen.add(item);
    }
  }
  return Array.from(seen);
}

// An integer within [min, max], else null. Accepts a numeric string too, since
// a number input can arrive as either depending on the client.
function toInt(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max
    ? n
    : null;
}

// A trimmed string capped at `max`, or null when empty/absent.
function toText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t.slice(0, max) : null;
}

// Gender is either an onboarding label or, for "Prefer to self-describe", the
// person's own words — so any non-empty text is accepted (capped), matching how
// onboarding stores it. The label list is kept only to document the fixed set.
void GENDER_OPTIONS;

// A loosely-validated email: kept only if it could plausibly be one, else null.
// Not a hard gate (we never send to it here) — just enough that a stray word
// doesn't masquerade as a contact address.
function toEmail(v: unknown): string | null {
  const t = toText(v, EMAIL_MAX);
  if (!t) return null;
  return /^\S+@\S+\.\S+$/.test(t) ? t : null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  await insertExitSurvey({
    situation: oneOf(SITUATION_OPTIONS, body.situation),
    situationOther: toText(body.situationOther, SHORT_TEXT_MAX),
    reasons: toReasons(body.reasons),
    reasonsOther: toText(body.reasonsOther, SHORT_TEXT_MAX),
    lookingBack: oneOf(LOOKING_BACK_OPTIONS, body.lookingBack),
    lookingBackOther: toText(body.lookingBackOther, SHORT_TEXT_MAX),
    clarity: toInt(body.clarity, CLARITY_MIN, CLARITY_MAX),
    easier: toText(body.easier, LONG_TEXT_MAX),
    nps: toInt(body.nps, NPS_MIN, NPS_MAX),
    npsWhy: toText(body.npsWhy, LONG_TEXT_MAX),
    recontact: oneOf(RECONTACT_OPTIONS, body.recontact),
    age: toInt(body.age, AGE_MIN, AGE_MAX),
    // Onboarding label or free-text self-description; stored as given (capped).
    gender: toText(body.gender, SHORT_TEXT_MAX),
    workStatus: oneOf(WORK_STATUS_OPTIONS, body.workStatus),
    email: toEmail(body.email),
    ref: toText(body.ref, SHORT_TEXT_MAX),
  });

  return Response.json({ ok: true });
}
