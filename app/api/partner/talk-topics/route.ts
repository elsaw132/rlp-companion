import { auth } from "@clerk/nextjs/server";
import { getActivePairingFor, addTalkTopic } from "@/lib/db";

// Add one user talk topic to the shared "worth talking about" list. Either
// partner can add; the author is always the authenticated user. Vita's seed
// topics are not stored here — they live in the generated comparison payload.

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const pairing = await getActivePairingFor(userId);
  if (!pairing) return new Response("No active pairing", { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { body?: unknown };
  const text = typeof body.body === "string" ? body.body.trim().slice(0, 500) : "";
  if (!text) return new Response("Empty topic", { status: 400 });

  const row = await addTalkTopic({
    pairingId: pairing.id,
    authorParticipantId: userId,
    body: text,
  });

  return Response.json({
    ok: true,
    topic: {
      id: row.id,
      slot: userId === pairing.participantAId ? "a" : "b",
      body: row.body,
    },
  });
}
