import { auth } from "@clerk/nextjs/server";
import {
  getAllUserData,
  setUserData,
  deleteUserData,
  deleteAllUserData,
} from "@/lib/db";

// The user's data access layer. The browser never sends a user id — it's
// always derived here from the authenticated Clerk session, so a request can
// only ever read or write its own rows. Unauthenticated requests are rejected
// with 401, and we never touch the database with a missing user id.

// All of the signed-in user's rows, as a { key: value } map.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const data = await getAllUserData(userId);
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
    await deleteAllUserData(userId);
  } else if (typeof body.key === "string" && body.key.length > 0) {
    await deleteUserData(userId, body.key);
  } else {
    return new Response("Missing key or all flag", { status: 400 });
  }

  return Response.json({ ok: true });
}
