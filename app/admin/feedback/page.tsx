import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getAdminUser } from "@/lib/admin";
import {
  getAllModuleFeedback,
  getAllFeedback,
  getAllBaselineSurveys,
  getAllModuleProgress,
} from "@/lib/db";
import { allModulesInOrder } from "@/lib/modules";
import AdminFeedbackView from "./AdminFeedbackView";

// The admin feedback portal. Production-accessible (Elsa needs it during the
// live pilot), but double-gated: the route is Clerk-protected by the middleware,
// and here we additionally require an allowlisted admin email. A logged-out
// visitor never reaches this code (the middleware bounces them to sign-in). A
// signed-in non-admin is sent to /admin/no-access — a friendly explainer with a
// way back to the app and a sign-out control — rather than a dead-end 404. The
// data is never fetched or rendered for anyone who isn't an allowlisted admin.
//
// Read-only: this page only ever reads feedback. Every query it runs reads
// across all users, which is exactly why it sits behind the admin gate.
export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  const { userId } = await auth();
  // Belt-and-braces: the middleware already requires sign-in for /admin, but if
  // that ever changes, don't fall through to the data — send them to sign in.
  if (!userId) redirect("/sign-in");

  const admin = await getAdminUser();
  if (!admin) redirect("/admin/no-access");

  const [moduleFeedback, generalFeedback, baseline, progress] =
    await Promise.all([
      getAllModuleFeedback(),
      getAllFeedback(),
      getAllBaselineSurveys(),
      getAllModuleProgress(),
    ]);

  const modules = allModulesInOrder();

  return (
    <AdminFeedbackView
      adminEmail={admin.email}
      moduleFeedback={moduleFeedback}
      generalFeedback={generalFeedback}
      baseline={baseline}
      progress={progress}
      modules={modules}
    />
  );
}
