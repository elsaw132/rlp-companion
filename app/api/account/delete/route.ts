import { auth } from "@clerk/nextjs/server";
import { deleteAllUserContext } from "@/lib/erasure";

// Self-service full deletion of the SIGNED-IN user's own account and data. The
// user id comes only from the authenticated Clerk session — never from the
// request body or the URL — so a caller can only ever delete themselves. This is
// the same complete erasure the admin path runs (deleteAllUserContext): user_data
// (incl. the base64 plan images), context_facts, feedback, module_feedback, then
// the Clerk account itself. It is irreversible; the page in front of it
// (/delete-account) is where the user confirms before this is ever called.
export async function POST() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  await deleteAllUserContext(userId);
  return Response.json({ ok: true });
}
