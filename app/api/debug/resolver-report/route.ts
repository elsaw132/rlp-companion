import { buildUserModel } from "@/lib/userModel";
import { SEED_SOURCE } from "@/lib/rlpPlanSeed";
import { MODULE_MANIFESTS } from "@/lib/moduleManifests";
import { resolveViews } from "@/lib/contextResolver";
import { coreValuesFromFacts } from "@/lib/resolverInputs";

// Dev-only review tooling for the phase-2 migration. For the fully-populated seed
// member (no exercises to run by hand), it outputs — side by side — the OLD
// derivation and the NEW resolver, so the manual pass is reviewing a diff of what
// changed rather than re-testing from scratch:
//   - core values: the old buildUserModel derivation vs the new fact-sourced
//     values (now carrying verbatim descriptions + 3.4 threat/protector), with a
//     flag on anything that appears, disappears, or gains threat/protector;
//   - per module: the resolver's Vita view and seed view (what now fills Vita's
//     opening and each exercise seed).
// Gated off in production. Target review: open this, read the values diff, glance
// at a couple of module openings — ~15 minutes.
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  const facts = SEED_SOURCE.getActiveFacts?.() ?? [];

  // ---- Core values: OLD vs NEW (the highest-value change) ----
  const oldModel = buildUserModel(SEED_SOURCE);
  const oldValues = oldModel.coreValues.map((v) => ({
    value: v.value,
    meaning: v.meaning ?? "",
  }));
  const newValues = coreValuesFromFacts(facts).map((v) => ({
    value: v.value,
    meaning: v.meaning ?? "",
    threat: v.threat ?? "",
    protectors: v.protectors ?? [],
  }));

  const oldByLabel = new Map(oldValues.map((v) => [v.value.toLowerCase(), v]));
  const newByLabel = new Map(newValues.map((v) => [v.value.toLowerCase(), v]));
  const flags: string[] = [];
  for (const v of newValues) {
    if (!oldByLabel.has(v.value.toLowerCase())) flags.push(`NEW value appears: ${v.value}`);
    if (v.threat || v.protectors.length) {
      flags.push(`THREAT/PROTECTOR now in plan: ${v.value}`);
    }
  }
  for (const v of oldValues) {
    if (!newByLabel.has(v.value.toLowerCase())) flags.push(`value DROPPED: ${v.value}`);
    const nv = newByLabel.get(v.value.toLowerCase());
    if (nv && nv.meaning !== v.meaning) {
      flags.push(`meaning CHANGED for ${v.value} (now verbatim, was re-distilled)`);
    }
  }

  // ---- Per-module resolved views (what Vita and each seed now read) ----
  const modules = Object.keys(MODULE_MANIFESTS).map((id) => {
    const { vita, seed } = resolveViews(id, facts);
    return {
      module: id,
      vitaView: vita.text,
      seedView: seed.text,
      vitaEmpty: vita.text.length === 0,
      seedEmpty: seed.text.length === 0,
    };
  });

  // Blind-spot flags: a module whose declared seed/vita inputs resolve to nothing
  // for the (fully-completed) seed member is worth an eyeball.
  const blindSpots = modules
    .filter((m) => {
      const manifest = MODULE_MANIFESTS[m.module];
      const wantsSeed = manifest.inputs.some((i) => i.role !== "vita");
      const wantsVita = manifest.inputs.some((i) => i.role !== "seed");
      return (wantsSeed && m.seedEmpty) || (wantsVita && m.vitaEmpty);
    })
    .map((m) => m.module);

  return Response.json({
    note: "Seed (demo) member. OLD = buildUserModel derivation; NEW = resolver over canonical facts.",
    factCount: facts.length,
    coreValues: { old: oldValues, new: newValues, flags },
    blindSpots,
    modules,
  });
}
