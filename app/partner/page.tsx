import { redirect } from "next/navigation";
import { auth, clerkClient } from "@clerk/nextjs/server";
import {
  getActivePairingFor,
  getShareSelections,
  getUserData,
} from "@/lib/db";
import ShareStep from "@/app/components/partner/ShareStep";
import WaitingState from "@/app/components/partner/WaitingState";
import ComparisonView from "@/app/components/partner/ComparisonView";
import ConfirmPartnerName from "@/app/components/partner/ConfirmPartnerName";

// The single entry point for "Plan with your partner" (module 5.1). It resolves
// the pairing and each side's completion (cheap DB reads only — no LLM in the
// render path) and shows the right surface:
//   - ?edit=1                        -> the share step (re-editing what's shared)
//   - neither/only-me not yet done   -> the share step
//   - I'm done, partner isn't        -> the waiting state
//   - both done                      -> the comparison view
// Someone with no active pairing never had the module activated for them, so
// they go back to the dashboard.
export const dynamic = "force-dynamic";

async function resolvePartnerName(partnerId: string): Promise<string> {
  const pref = await getUserData(partnerId, "preferred-name");
  if (typeof pref === "string" && pref.trim()) return pref.trim();
  try {
    const client = await clerkClient();
    const u = await client.users.getUser(partnerId);
    return (u.firstName ?? "").trim() || "your partner";
  } catch {
    return "your partner";
  }
}

export default async function PartnerPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const pairing = await getActivePairingFor(userId);
  if (!pairing) redirect("/home");

  const { edit } = await searchParams;

  const selections = await getShareSelections(pairing.id);
  const mine = selections.find((s) => s.participantId === userId) ?? null;
  const partnerId =
    pairing.participantAId === userId
      ? pairing.participantBId
      : pairing.participantAId;
  const partner = selections.find((s) => s.participantId === partnerId) ?? null;

  const iCompleted = Boolean(mine?.completedAt);
  const partnerCompleted = Boolean(partner?.completedAt);

  // First: confirm the partner's name (never guessed silently). Prefilled with
  // the account name; the person confirms or corrects it before anything else.
  if (!mine?.partnerName) {
    const guess = await resolvePartnerName(partnerId);
    return <ConfirmPartnerName guess={guess} />;
  }

  // Editing what's shared reopens the share step even after completion.
  if (edit === "1") return <ShareStep />;

  if (iCompleted && partnerCompleted) return <ComparisonView />;
  if (iCompleted && !partnerCompleted) {
    return <WaitingState partnerFirstName={mine.partnerName} />;
  }
  return <ShareStep />;
}
