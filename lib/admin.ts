import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";

// Who may reach the /admin area. This portal shows other members' feedback, so
// the gate has two parts: the route is already Clerk-protected (a logged-out
// visitor is bounced to sign-in by the middleware), and on top of that only an
// allowlisted email may see any data. A normal signed-in member is not an admin
// and gets a 404.
//
// The list is an env var so emails can be added/removed without a code change:
// ADMIN_EMAILS is a comma-separated string (e.g. "a@x.com, b@x.com"). If it's
// unset — e.g. a local dev run before the var is added — we fall back to the
// three confirmed pilot admins so the page still works.
const DEFAULT_ADMIN_EMAILS = [
  "elsa@chorus-life.com",
  "sarah@chorus-life.com",
  "john@chorus-life.com",
];

export function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS;
  const list = raw
    ? raw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0)
    : DEFAULT_ADMIN_EMAILS;
  return list;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}

// The gate used by the admin pages. Returns the admin's email when the signed-in
// user is on the allowlist, or null otherwise (not signed in, or a normal
// member). Callers treat null as "not found" — never render member data for it.
export async function getAdminUser(): Promise<{ email: string } | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  if (!isAdminEmail(email)) return null;

  return { email: email as string };
}
