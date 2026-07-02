// Build-time feature flags. Read from NEXT_PUBLIC_* env vars so the SAME value is
// available on the server and inlined into the client bundle (the onboarding form
// is a client component and needs to read the flag too).
//
// A flag is ON only when its env var is exactly "1" or "true"; anything else
// (unset, "0", "false", empty) is OFF. Default is therefore OFF, so real users'
// flows are unchanged until the flag is deliberately switched on in an
// environment.

function isOn(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

// Retirement paths — Phase 1. Captures the person's retirement status
// (retirementStage), threads it everywhere, and makes Vita aware of it. Nothing
// branches on it in user-facing content yet, so leaving it OFF keeps onboarding
// and every content generator identical to today.
export const RETIREMENT_PATHS = isOn(process.env.NEXT_PUBLIC_RETIREMENT_PATHS);
