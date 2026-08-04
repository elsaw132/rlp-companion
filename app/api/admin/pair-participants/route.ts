import { auth, clerkClient } from "@clerk/nextjs/server";
import { getAdminUser } from "@/lib/admin";
import { createPairing, withdrawPairing, getPairingById } from "@/lib/db";
import { isCouplesEmailAllowed } from "@/lib/couplesAccess";

// Admin-only pairing action for the "Plan with your partner" pilot. There is no
// self-serve invite flow (that's Epic 2.7): an admin links two known couples
// directly. Same allowlist gate as the rest of /admin — a signed-in non-admin
// gets 404, a logged-out visitor is bounced by the middleware.
//
// Two actions on POST:
//   - "pair":   resolve two emails to Clerk user ids and create an active
//               pairing (guarded so neither can already be actively paired).
//   - "unpair": withdraw a pairing by id (same clean severance as a user-side
//               stop-sharing — the shared view collapses and derived data goes).

export const dynamic = "force-dynamic";

async function resolveUserIdByEmail(
  email: string
): Promise<{ id: string; label: string } | null> {
  const client = await clerkClient();
  const res = await client.users.getUserList({ emailAddress: [email] });
  const user = res.data[0];
  if (!user) return null;
  const primary =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    email;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return { id: user.id, label: name ? `${name} (${primary})` : primary };
}

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return new Response("Not found", { status: 404 });
  const { userId: adminId } = await auth();
  if (!adminId) return new Response("Not found", { status: 404 });

  const body = (await request.json().catch(() => ({}))) as {
    action?: unknown;
    emailA?: unknown;
    emailB?: unknown;
    pairingId?: unknown;
  };

  // --- Unpair -------------------------------------------------------------
  if (body.action === "unpair") {
    if (typeof body.pairingId !== "string" || body.pairingId.length === 0) {
      return new Response("Missing pairingId", { status: 400 });
    }
    const pairing = await getPairingById(body.pairingId);
    if (!pairing) return new Response("No such pairing", { status: 404 });
    await withdrawPairing({ pairingId: body.pairingId, withdrawnById: adminId });
    return Response.json({ ok: true });
  }

  // --- Pair ---------------------------------------------------------------
  if (body.action === "pair") {
    const emailA = typeof body.emailA === "string" ? body.emailA.trim() : "";
    const emailB = typeof body.emailB === "string" ? body.emailB.trim() : "";
    if (!emailA || !emailB) {
      return Response.json(
        { ok: false, error: "Enter both partners' email addresses." },
        { status: 400 }
      );
    }
    if (emailA.toLowerCase() === emailB.toLowerCase()) {
      return Response.json(
        { ok: false, error: "Those are the same email — enter two people." },
        { status: 400 }
      );
    }
    // Pilot gate: both must be on the couples allowlist.
    const offList = [emailA, emailB].filter((e) => !isCouplesEmailAllowed(e));
    if (offList.length) {
      return Response.json(
        {
          ok: false,
          error: `Not in the couples pilot: ${offList.join(", ")}. Add them to COUPLES_PILOT_EMAILS first.`,
        },
        { status: 403 }
      );
    }

    const a = await resolveUserIdByEmail(emailA);
    const b = await resolveUserIdByEmail(emailB);
    const missing = [
      !a ? emailA : null,
      !b ? emailB : null,
    ].filter(Boolean);
    if (missing.length) {
      return Response.json(
        {
          ok: false,
          error: `No account found for ${missing.join(" or ")}. They must have signed up first.`,
        },
        { status: 404 }
      );
    }

    const result = await createPairing({
      adminId,
      participantAId: a!.id,
      participantBId: b!.id,
    });
    if (!result.ok) {
      if (result.reason === "same-user") {
        return Response.json(
          { ok: false, error: "Those two emails belong to the same account." },
          { status: 400 }
        );
      }
      // already-paired: name whose existing pairing is in the way, if we can.
      const blockedLabel =
        result.blockedId === a!.id
          ? a!.label
          : result.blockedId === b!.id
            ? b!.label
            : "one of them";
      return Response.json(
        {
          ok: false,
          error: `${blockedLabel} is already in an active pairing. Unpair that first.`,
        },
        { status: 409 }
      );
    }
    return Response.json({
      ok: true,
      pairingId: result.pairingId,
      a: a!.label,
      b: b!.label,
    });
  }

  return new Response("Unknown action", { status: 400 });
}
