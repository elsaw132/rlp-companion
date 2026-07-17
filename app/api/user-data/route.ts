import { auth } from "@clerk/nextjs/server";
import {
  getAllUserData,
  setUserData,
  deleteUserData,
  deleteAllUserData,
  deleteAllContextFacts,
  anonymiseModuleProgress,
} from "@/lib/db";
import {
  ensureBackfill,
  CONTEXT_FACTS_SNAPSHOT_KEY,
} from "@/lib/contextBackfill";

// The user's data access layer. The browser never sends a user id — it's
// always derived here from the authenticated Clerk session, so a request can
// only ever read or write its own rows. Unauthenticated requests are rejected
// with 401, and we never touch the database with a missing user id.

// All of the signed-in user's rows, as a { key: value } map.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const data = await getAllUserData(userId);

  // Lazily provision the canonical context profile (idempotent; short-circuits
  // once a user is backfilled) and attach the active facts under a synthetic,
  // read-only snapshot key so phase-2 client consumers can read them
  // synchronously. Best-effort: a failure here never blocks the data load.
  try {
    const { facts } = await ensureBackfill(userId, data);
    data[CONTEXT_FACTS_SNAPSHOT_KEY] = facts;
  } catch {
    // Leave the snapshot without facts; the app works, capture continues.
  }

  return Response.json(data);
}

// Upsert one key for the signed-in user.
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json()) as { key?: unknown; value?: unknown };
  if (typeof body.key !== "string" || body.key.length === 0) {
    return new Response("Missing key", { status: 400 });
  }

  await setUserData(userId, body.key, body.value ?? null);
  return Response.json({ ok: true });
}

// Delete one key ({ key }) or every row the user has ({ all: true }) — the
// latter backs "start over".
export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    key?: unknown;
    all?: unknown;
  };

  if (body.all === true) {
    // "Start over" — a full restart. Clear the key/value store AND the derived
    // context-facts profile together, so the reset matches its copy ("This
    // clears all your answers and conversations"). Without the second delete the
    // inferred profile (values, dreams, dob) would survive a reset and then be
    // reconciled against the user's fresh picks. Feedback rows are deliberately
    // left in place: this is a restart, not account erasure.
    //
    // Progress analytics are kept but ANONYMISED rather than deleted: how long a
    // session takes is a finding worth keeping, and so is the fact that someone
    // restarted — but neither needs to stay attached to the person once they've
    // asked to start again. The surviving rows are reassigned to a random id
    // with no mapping back. It also frees the (user_id, module_id) slots so the
    // fresh run records cleanly against the same sessions.
    await Promise.all([
      deleteAllUserData(userId),
      deleteAllContextFacts(userId),
      anonymiseModuleProgress(userId),
    ]);
  } else if (typeof body.key === "string" && body.key.length > 0) {
    await deleteUserData(userId, body.key);
  } else {
    return new Response("Missing key or all flag", { status: 400 });
  }

  return Response.json({ ok: true });
}
