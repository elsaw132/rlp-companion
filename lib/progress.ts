// Tracks which modules a user has finished. Stored in localStorage under
// rlp_completed_[userId] as a JSON array of module ids (e.g. ["1.1", "1.2"]).
// These functions touch localStorage, so only call them in the browser.

import { STAGES, TOTAL_STAGES } from "@/lib/modules";

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

// The stage the person is currently "on", from a list of completed module ids:
// the stage holding the next incomplete module, or — if every built module is
// done — the first stage that isn't fully finished. Pure (no localStorage), so
// it can be derived from already-read ids.
export function getActiveStageNumber(completedIds: string[]): number {
  const allModules = STAGES.flatMap((s) =>
    s.modules.map((m) => ({ id: m.id, stageNumber: s.number }))
  );
  const next = allModules.find((m) => !completedIds.includes(m.id));
  if (next) return next.stageNumber;
  const firstUnfinished = STAGES.find(
    (s) =>
      !(s.modules.length > 0 && s.modules.every((m) => completedIds.includes(m.id)))
  );
  return firstUnfinished?.number ?? TOTAL_STAGES;
}
