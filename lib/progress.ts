// Tracks which modules a user has finished. Stored in localStorage under
// rlp_completed_[userId] as a JSON array of module ids (e.g. ["1.1", "1.2"]).
// These functions touch localStorage, so only call them in the browser.

const completedKey = (userId: string) => `rlp_completed_${userId}`;

export function getCompletedIds(userId: string): string[] {
  try {
    const raw = localStorage.getItem(completedKey(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function markModuleComplete(userId: string, sessionId: string): void {
  const ids = getCompletedIds(userId);
  if (ids.includes(sessionId)) return;
  localStorage.setItem(completedKey(userId), JSON.stringify([...ids, sessionId]));
}

export function clearModuleComplete(userId: string, sessionId: string): void {
  const ids = getCompletedIds(userId).filter((id) => id !== sessionId);
  localStorage.setItem(completedKey(userId), JSON.stringify(ids));
}
