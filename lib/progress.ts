// Pure programme-progress derivation. Reads and writes of completion now live
// in the client data layer (lib/userData.tsx); this stays a pure function so it
// can be derived from already-loaded ids on the server or the client.

import { STAGES, TOTAL_STAGES, visibleModules } from "@/lib/modules";
import type { RetirementStage } from "@/lib/userData";

// The stage the person is currently "on", from a list of completed module ids:
// the stage holding the next incomplete module, or — if every built module is
// done — the first stage that isn't fully finished. rs scopes the module set so
// an audience-restricted module counts only for the people who actually see it;
// rs omitted (=null) is today's universal set.
export function getActiveStageNumber(
  completedIds: string[],
  rs: RetirementStage | null = null
): number {
  const allModules = STAGES.flatMap((s) =>
    visibleModules(s, rs).map((m) => ({ id: m.id, stageNumber: s.number }))
  );
  const next = allModules.find((m) => !completedIds.includes(m.id));
  if (next) return next.stageNumber;
  const firstUnfinished = STAGES.find((s) => {
    const mods = visibleModules(s, rs);
    return !(mods.length > 0 && mods.every((m) => completedIds.includes(m.id)));
  });
  return firstUnfinished?.number ?? TOTAL_STAGES;
}
