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

export function couplesAllowlist(): string[] {
  const raw = process.env.COUPLES_PILOT_EMAILS;
  return raw
    ? raw.split(",").map((e) => e.trim().toLowerCase()).filter((e) => e.length > 0)
    : DEFAULT_COUPLES_EMAILS;
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
