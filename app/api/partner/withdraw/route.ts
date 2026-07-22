import { auth } from "@clerk/nextjs/server";
import { getActivePairingFor, withdrawPairing } from "@/lib/db";

// Stop sharing (user-initiated). Collapses the shared view for both, keeps each
// consent timestamp, clears what was shared, and deletes the derived comparison
// and talk topics. Idempotent — if there's no active pairing it's already done.

export const dynamic = "force-dynamic";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const pairing = await getActivePairingFor(userId);
  if (pairing) {
    await withdrawPairing({ pairingId: pairing.id, withdrawnById: userId });
  }
  return Response.json({ ok: true });
}
