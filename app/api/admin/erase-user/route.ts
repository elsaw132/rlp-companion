import { getAdminUser } from "@/lib/admin";
import { deleteAllUserContext } from "@/lib/erasure";

// Full erasure of one user, for the end-of-pilot "delete it all" request. Admin
// only: this removes another person's entire footprint plus their account, so it
// sits behind the same allowlist gate as the feedback portal (a signed-in
// non-admin gets 404, a logged-out visitor is bounced by the middleware). The
// target user is named explicitly in the body — this is not a self-service
// delete, and the caller is never the person being erased.
//
// There is no UI: this is invoked by an admin (curl / a small internal tool)
// when a pilot user emails asking to be deleted.
export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return new Response("Not found", { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { userId?: unknown };
  if (typeof body.userId !== "string" || body.userId.length === 0) {
    return new Response("Missing userId", { status: 400 });
  }

  await deleteAllUserContext(body.userId);
  return Response.json({ ok: true, erased: body.userId });
}
