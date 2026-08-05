import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";

// The "Plan with your partner" pilot (module 5.1) is dormant for everyone except
// an allowlist of participants. This is a hard gate on top of the admin-pairing
// requirement: even an admin can only pair allowlisted people, /partner turns
// anyone else away, and the dashboard card never activates off the list. So a
// prod deploy stays fully dormant for the whole membership except this group.
//
// COUPLES_PILOT_EMAILS (comma-separated) overrides the list without a code
// change — set it in the Vercel project to expand the pilot. If it's unset, the
// initial pilot group below is used.
const DEFAULT_COUPLES_EMAILS = [
  "sarah@chorus-life.com",
  "john@chorus-life.com",
  "elsawakeman@mac.com",
  "harrywilliamsre@gmail.com",
];

// The demo account used for partner / pension-provider walkthroughs. Always
// allowed on top of whatever the pilot list resolves to (env override or the
// default group), so enabling the couples view for it never means editing the
// live COUPLES_PILOT_EMAILS list.
const DEMO_COUPLES_EMAIL = "hello@chorus-life.com";

export function couplesAllowlist(): string[] {
  const raw = process.env.COUPLES_PILOT_EMAILS;
  const list = raw
    ? raw.split(",").map((e) => e.trim().toLowerCase()).filter((e) => e.length > 0)
    : DEFAULT_COUPLES_EMAILS;
  return list.includes(DEMO_COUPLES_EMAIL) ? list : [...list, DEMO_COUPLES_EMAIL];
}

export function isCouplesEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  return couplesAllowlist().includes(email.trim().toLowerCase());
}

// Whether the signed-in user is in the couples pilot.
export async function currentUserCouplesAllowed(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  const user = await currentUser();
  return isCouplesEmailAllowed(user?.primaryEmailAddress?.emailAddress);
}
