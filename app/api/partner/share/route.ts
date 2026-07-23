import { auth, clerkClient } from "@clerk/nextjs/server";
import {
  getActivePairingFor,
  getShareSelection,
  getShareSelections,
  upsertShareSelection,
  getAllUserData,
} from "@/lib/db";
import {
  deriveShareableItems,
  defaultSharedRefs,
  fearItems,
} from "@/lib/coupleShare";
import { classifyPartnerFears } from "@/lib/partnerFears";

// The share step's data endpoint. GET returns this participant's shareable items
// (with partner-directed fears classified and defaulted off) plus their current
// selection; POST saves the selection and, when they complete it, records their
// consent. Both derive refs the SAME way as the comparison, so what's shared and
// what's compared always agree. A participant only ever touches their OWN row —
// the partner's userId is only used to read the partner's first name.

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function partnerFirstName(partnerId: string): Promise<string> {
  try {
    const client = await clerkClient();
    const u = await client.users.getUser(partnerId);
    return (u.firstName ?? "").trim() || "your partner";
  } catch {
    return "your partner";
  }
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const pairing = await getActivePairingFor(userId);
  if (!pairing) return new Response("No active pairing", { status: 404 });

  const partnerId =
    pairing.participantAId === userId
      ? pairing.participantBId
      : pairing.participantAId;
  const existing = await getShareSelection(pairing.id, userId);
  // Prefer the name this participant confirmed for their partner; fall back to
  // the account name only if the confirm step was somehow skipped.
  const name = existing?.partnerName || (await partnerFirstName(partnerId));

  const data = await getAllUserData(userId);
  const fears = fearItems(deriveShareableItems(data, []));
  const aboutPartnerRefs = await classifyPartnerFears(fears, name);
  const items = deriveShareableItems(data, aboutPartnerRefs);

  const sharedRefs = existing
    ? existing.sharedItemRefs
    : defaultSharedRefs(items);

  return Response.json({
    items,
    sharedRefs,
    aboutPartnerRefs,
    completed: Boolean(existing?.completedAt),
    partnerFirstName: name,
  });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const pairing = await getActivePairingFor(userId);
  if (!pairing) return new Response("No active pairing", { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    sharedRefs?: unknown;
    aboutPartnerRefs?: unknown;
    complete?: unknown;
  };
  const wantShared = Array.isArray(body.sharedRefs)
    ? (body.sharedRefs.filter((r) => typeof r === "string") as string[])
    : [];
  const wantAbout = Array.isArray(body.aboutPartnerRefs)
    ? (body.aboutPartnerRefs.filter((r) => typeof r === "string") as string[])
    : [];
  const complete = body.complete === true;

  // Validate refs against this participant's own current items — never store a
  // ref that isn't a real shareable thing for them.
  const data = await getAllUserData(userId);
  const items = deriveShareableItems(data, wantAbout);
  const valid = new Set(items.map((i) => i.ref));
  const fearRefs = new Set(fearItems(items).map((f) => f.ref));
  const sharedItemRefs = wantShared.filter((r) => valid.has(r));
  const aboutPartnerRefs = wantAbout.filter((r) => fearRefs.has(r));

  await upsertShareSelection({
    pairingId: pairing.id,
    participantId: userId,
    sharedItemRefs,
    aboutPartnerRefs,
    complete,
  });

  const both = await getShareSelections(pairing.id);
  const bothCompleted =
    both.length === 2 && both.every((s) => s.completedAt !== null);

  return Response.json({ ok: true, bothCompleted });
}
