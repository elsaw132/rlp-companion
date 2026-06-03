// Tracks whether a user has finished the welcome flow. Stored in localStorage
// under rlp_onboarding_complete_[userId] (per user, so several accounts in one
// browser don't interfere, and one user's reset doesn't affect another). This
// is a dedicated completion marker — distinct from rlp_onboarding_[userId],
// which holds the answers and is written progressively mid-flow. Browser-only,
// like the other progress helpers.

const completeKey = (userId: string) => `rlp_onboarding_complete_${userId}`;

export function isOnboardingComplete(userId: string): boolean {
  try {
    return localStorage.getItem(completeKey(userId)) === "true";
  } catch {
    return false;
  }
}

export function markOnboardingComplete(userId: string): void {
  localStorage.setItem(completeKey(userId), "true");
}
