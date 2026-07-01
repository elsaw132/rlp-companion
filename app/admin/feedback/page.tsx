import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { getAllModuleFeedback, getAllFeedback } from "@/lib/db";
import { allModulesInOrder } from "@/lib/modules";
import AdminFeedbackView from "./AdminFeedbackView";

// The admin feedback portal. Production-accessible (Elsa needs it during the
// live pilot), but double-gated: the route is Clerk-protected by the middleware,
// and here we additionally require an allowlisted admin email. A logged-out
// visitor never reaches this code (the middleware bounces them to sign-in); a
// normal signed-in member falls through to notFound() and sees a 404 — the data
// is never fetched or rendered for them.
//
// Read-only: this page only ever reads feedback. Every query it runs reads
// across all users, which is exactly why it sits behind the admin gate.
export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  const admin = await getAdminUser();
  if (!admin) notFound();

  const [moduleFeedback, generalFeedback] = await Promise.all([
    getAllModuleFeedback(),
    getAllFeedback(),
  ]);

  const modules = allModulesInOrder();

  return (
    <AdminFeedbackView
      adminEmail={admin.email}
      moduleFeedback={moduleFeedback}
      generalFeedback={generalFeedback}
      modules={modules}
    />
  );
}
