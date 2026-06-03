// The single source of truth for "what do we call this person?". Resolves a
// name in priority order: the preferred name they set during onboarding →
// Clerk's firstName → null. Returning null (not "there") lets callers drop the
// name gracefully — e.g. "Good evening" with no trailing name. Stored per user
// under rlp_preferred_name_[userId], so several accounts in one browser don't
// clash. Browser-only (localStorage), like the other progress helpers.

// The shape we need off the Clerk user — kept narrow so this stays easy to call
// from anywhere without importing Clerk's full types.
type NameSource = { firstName?: string | null } | null | undefined;

const preferredNameKey = (userId: string) => `rlp_preferred_name_${userId}`;

export function getPreferredName(userId: string): string {
  try {
    return localStorage.getItem(preferredNameKey(userId))?.trim() ?? "";
  } catch {
    return "";
  }
}

export function setPreferredName(userId: string, name: string): void {
  localStorage.setItem(preferredNameKey(userId), name.trim());
}

// The name to address the person by, or null if none is known. Pass the Clerk
// user so the fallback works before any preferred name is set.
export function getDisplayName(
  userId: string | undefined,
  user: NameSource
): string | null {
  if (userId) {
    const preferred = getPreferredName(userId);
    if (preferred) return preferred;
  }
  const first = user?.firstName?.trim();
  return first ? first : null;
}
