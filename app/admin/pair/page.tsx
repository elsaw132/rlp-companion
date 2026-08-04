import { redirect } from "next/navigation";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getAdminUser } from "@/lib/admin";
import { getActivePairings } from "@/lib/db";
import AdminPairView, { type PairingDisplay } from "./AdminPairView";

// The admin pairing portal for "Plan with your partner". Same double gate as the
// feedback portal: Clerk-protected route, plus an allowlisted admin email. A
// logged-out visitor is bounced by the middleware; a signed-in non-admin is sent
// to /admin/no-access. The page reads across all users (pairings + Clerk
// identities), which is exactly why it sits behind the admin gate.
export const dynamic = "force-dynamic";

export default async function AdminPairPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const admin = await getAdminUser();
  if (!admin) redirect("/admin/no-access");

  const pairings = await getActivePairings();

  // Resolve every participant id to a human label in one Clerk call.
  const ids = Array.from(
    new Set(pairings.flatMap((p) => [p.participantAId, p.participantBId]))
  );
  const labels = new Map<string, string>();
  if (ids.length) {
    const client = await clerkClient();
    const res = await client.users.getUserList({
      userId: ids,
      limit: ids.length,
    });
    for (const u of res.data) {
      const email =
        u.primaryEmailAddress?.emailAddress ??
        u.emailAddresses[0]?.emailAddress ??
        "";
      const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
      labels.set(u.id, name ? `${name} · ${email}` : email || u.id);
    }
  }

  const display: PairingDisplay[] = pairings.map((p) => ({
    id: p.id,
    a: labels.get(p.participantAId) ?? p.participantAId,
    b: labels.get(p.participantBId) ?? p.participantBId,
    createdAt: p.createdAt,
  }));

  return <AdminPairView adminEmail={admin.email} pairings={display} />;
}
