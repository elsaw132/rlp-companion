import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getUserData } from "@/lib/db";
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

  return (
    <>
      <ProviderBand />
      <HomeDashboard />
    </>
  );
}
