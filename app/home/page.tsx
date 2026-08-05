import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import {
  getUserData,
  getActivePairingFor,
  getShareSelections,
} from "@/lib/db";
import { currentUserCouplesAllowed } from "@/lib/couplesAccess";
import ProviderBand from "../components/ProviderBand";
import HomeDashboard from "../components/HomeDashboard";

// The onboarding gate now lives here, on the server: a brand-new user who hasn't
// finished the welcome flow is sent to /onboarding before the dashboard is ever
// sent to the browser — no client-side flash. The flag is read straight from the
// database for the authenticated user. Onboarding writes the flag (awaited)
// before routing back to /home, so the gate sees it and there's no loop. A
// tester whose data is still only in the browser will bounce through /onboarding
// once, where the client migrates it up, then land back here.
export default async function HomePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const onboardingComplete = await getUserData(userId, "onboarding-complete");
  if (onboardingComplete !== true) redirect("/onboarding");

  // Activate the Act "Plan with your partner" card only for an allowlisted user
  // who has an active pairing — dormant for everyone else.
  const [activePairing, couplesAllowed] = await Promise.all([
    getActivePairingFor(userId),
    currentUserCouplesAllowed(),
  ]);
  const hasActivePairing = couplesAllowed && activePairing !== null;

  // If they're in the couples module and have finished their own side but their
  // partner hasn't yet, the dashboard labels the session "Waiting for [partner]"
  // instead of an actionable next step. Cheap DB read, only for paired users.
  let couplesWaiting = false;
  let partnerName = "";
  if (hasActivePairing && activePairing) {
    const selections = await getShareSelections(activePairing.id);
    const mine = selections.find((s) => s.participantId === userId) ?? null;
    const partnerId =
      activePairing.participantAId === userId
        ? activePairing.participantBId
        : activePairing.participantAId;
    const partnerSel =
      selections.find((s) => s.participantId === partnerId) ?? null;
    couplesWaiting = Boolean(mine?.completedAt) && !partnerSel?.completedAt;
    partnerName = (mine?.partnerName || "").trim() || "your partner";
  }

  return (
    <>
      <ProviderBand />
      <HomeDashboard
        hasActivePairing={hasActivePairing}
        couplesWaiting={couplesWaiting}
        partnerName={partnerName}
      />
    </>
  );
}
