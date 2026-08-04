import { auth } from "@clerk/nextjs/server";
import { getActivePairingFor, setPartnerName } from "@/lib/db";

// Records the first name this participant confirmed for their partner. We never
// guess this silently — the confirm step (prefilled with the account's name,
// editable) is where it's captured, before the share step.

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const pairing = await getActivePairingFor(userId);
  if (!pairing) return new Response("No active pairing", { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!name) return new Response("Missing name", { status: 400 });

  await setPartnerName({ pairingId: pairing.id, participantId: userId, name });
  return Response.json({ ok: true });
}
