import { redirect } from "next/navigation";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getAdminUser } from "@/lib/admin";
import {
  getAllModuleFeedback,
  getAllFeedback,
  getAllBaselineSurveys,
  getAllPostCompletionSurveys,
  getAllPostCompletionEmails,
  getAllCompletedLists,
  getAllModuleProgress,
  getAllCoupleCompletions,
  getAllCoachTones,
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

  const [
    moduleFeedback,
    generalFeedback,
    baseline,
    postCompletion,
    postCompletionEmails,
    completedLists,
    progress,
    coupleCompletions,
    coachTones,
  ] = await Promise.all([
    getAllModuleFeedback(),
    getAllFeedback(),
    getAllBaselineSurveys(),
    getAllPostCompletionSurveys(),
    getAllPostCompletionEmails(),
    getAllCompletedLists(),
    getAllModuleProgress(),
    getAllCoupleCompletions(),
    getAllCoachTones(),
  ]);

  const modules = allModulesInOrder();

  // Resolve every participant id to a first name in one Clerk pass, so the
  // portal shows a person rather than a truncated user id. Same approach as the
  // pairing portal. Ids come from the four sources that drive the people shown
  // (feedback, general messages, baseline, progress); the map holds only a
  // first name, and the view falls back to the short id for anyone Clerk has no
  // name for, keeping the full id on hover. Reading across all users' Clerk
  // identities is exactly why this page sits behind the admin gate.
  const nameIds = Array.from(
    new Set([
      ...moduleFeedback.map((r) => r.userId),
      ...generalFeedback.map((g) => g.userId),
      ...baseline.map((b) => b.userId),
      ...progress.map((p) => p.userId),
    ])
  );
  const names: Record<string, string> = {};
  if (nameIds.length) {
    const client = await clerkClient();
    // Clerk caps getUserList at 500 ids per call; page through so the portal
    // never silently loses a name if the pilot grows past that.
    for (let i = 0; i < nameIds.length; i += 500) {
      const batch = nameIds.slice(i, i + 500);
      const res = await client.users.getUserList({
        userId: batch,
        limit: batch.length,
      });
      for (const u of res.data) {
        const first = (u.firstName ?? "").trim();
        if (first) names[u.id] = first;
      }
    }
  }

  return (
    <AdminFeedbackView
      adminEmail={admin.email}
      names={names}
      moduleFeedback={moduleFeedback}
      generalFeedback={generalFeedback}
      baseline={baseline}
      postCompletion={postCompletion}
      postCompletionEmails={postCompletionEmails}
      completedLists={completedLists}
      progress={progress}
      coupleCompletions={coupleCompletions}
      coachTones={coachTones}
      modules={modules}
    />
  );
}
