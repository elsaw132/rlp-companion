// Per-module takeaways: a short summary of what emerged in a module, captured
// when it completes. They connect the modules — every later module is given the
// earlier takeaways so Vita can draw on the whole picture — and they seed the
// Retirement Life Plan. Stored in localStorage under
// rlp_takeaway_[userId]_[moduleId], so only call these in the browser.

import { getModulesBefore } from "./modules";

export type Takeaway = {
  moduleId: string;
  moduleTitle: string;
  text: string;
  // ISO timestamp of when it was generated, so the latest re-run wins.
  savedAt: string;
};

const takeawayKey = (userId: string, moduleId: string) =>
  `rlp_takeaway_${userId}_${moduleId}`;

export function getTakeaway(userId: string, moduleId: string): Takeaway | null {
  try {
    const raw = localStorage.getItem(takeawayKey(userId, moduleId));
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object" && typeof parsed.text === "string") {
      return parsed as Takeaway;
    }
  } catch {
    // ignore corrupt data
  }
  return null;
}

export function saveTakeaway(userId: string, takeaway: Takeaway): void {
  localStorage.setItem(
    takeawayKey(userId, takeaway.moduleId),
    JSON.stringify(takeaway)
  );
}

export function clearTakeaway(userId: string, moduleId: string): void {
  localStorage.removeItem(takeawayKey(userId, moduleId));
}

// Whether any module before this one has a stored takeaway — i.e. whether
// there's an earlier picture for Vita to draw on.
export function hasPriorTakeaways(userId: string, moduleId: string): boolean {
  return getModulesBefore(moduleId).some((m) => getTakeaway(userId, m.id));
}

// The readable "what they've explored so far" block that fills the
// {priorReflections} placeholder: the takeaway of every earlier module that has
// one, in programme order. Falls back to the no-history line when there's none.
export function buildPriorReflections(
  userId: string | undefined,
  moduleId: string
): string {
  const fallback = "No earlier modules completed yet.";
  if (!userId) return fallback;

  const lines = getModulesBefore(moduleId).flatMap((m) => {
    const takeaway = getTakeaway(userId, m.id);
    return takeaway && takeaway.text.trim()
      ? [`- ${m.title}: ${takeaway.text.trim()}`]
      : [];
  });

  if (lines.length === 0) return fallback;
  return ["Here's what they've explored in earlier modules:", ...lines].join("\n");
}
