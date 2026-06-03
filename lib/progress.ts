// Pure programme-progress derivation. Reads and writes of completion now live
// in the client data layer (lib/userData.tsx); this stays a pure function so it
// can be derived from already-loaded ids on the server or the client.

import { STAGES, TOTAL_STAGES } from "@/lib/modules";

// The stage the person is currently "on", from a list of completed module ids:
// the stage holding the next incomplete module, or — if every built module is
// done — the first stage that isn't fully finished.
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
