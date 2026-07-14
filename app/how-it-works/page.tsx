import ProviderBand from "../components/ProviderBand";
import HowItWorks from "../components/HowItWorks";

// The "How it works" help page. Authenticated by default — it's not in the
// proxy.ts public matcher, so Clerk protects it like every other in-app route.
// Framed in the normal authenticated shell (the desktop ProviderBand; the mobile
// MobileAppBar comes from the global layout), same as the stage and plan pages.
export default function HowItWorksPage() {
  return (
    <>
      <ProviderBand />
      <HowItWorks />
    </>
  );
}
