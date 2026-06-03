// Tracks which stage intros a user has already seen, so the brief framing
// moment for a stage shows only once — on first forward entry. Stored in
// localStorage under rlp_stage_intro_seen_[userId] as a JSON array of stage
// numbers (e.g. [1]). Browser-only, like the other progress helpers.

const seenKey = (userId: string) => `rlp_stage_intro_seen_${userId}`;

export function getStageIntrosSeen(userId: string): number[] {
  try {
    const raw = localStorage.getItem(seenKey(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as number[]) : [];
  } catch {
    return [];
  }
}

export function markStageIntroSeen(userId: string, stageNumber: number): void {
  const seen = getStageIntrosSeen(userId);
  if (seen.includes(stageNumber)) return;
  localStorage.setItem(seenKey(userId), JSON.stringify([...seen, stageNumber]));
}
