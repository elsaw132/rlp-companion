import { describe, it, expect } from "vitest";
import { seasonCandidatesFromFacts } from "@/lib/resolverInputs";
import type { StoredFact } from "@/lib/contextFacts";
import type { FactCategory } from "@/lib/contextFacts";

// Minimal StoredFact builder — the assembler only reads category, status, and data.
let n = 0;
function mk(
  category: FactCategory,
  label: string,
  extra: Record<string, unknown> = {},
  status: StoredFact["status"] = "active"
): StoredFact {
  return {
    id: `f${n++}`,
    userId: "u",
    category,
    domain: null,
    data: { label, ...extra },
    provenanceModule: "test",
    provenanceSource: "widget_pick",
    status,
    supersededBy: null,
    confidence: "certain",
    createdAt: "2026-01-01",
    lastAffirmedAt: null,
  };
}

describe("seasonCandidatesFromFacts", () => {
  it("gathers the priority-bearing categories into the candidate pool, and roles/values as signal", () => {
    const facts: StoredFact[] = [
      mk("aspiration", "Travel as much as possible"),
      mk("recurring_activity", "Playing with grandchildren"),
      mk("recurring_activity", "Painting, drawing & crafts"),
      mk("hope", "Unhurried time with Harry"),
      mk("goal", "Redecorate the guest rooms with Harry"),
      mk("relationship", "My daughter"),
      // signals, not candidates:
      mk("role", "Grandparent"),
      mk("role", "Host"),
      mk("value", "Family"),
      // categories that must NOT become candidates:
      mk("energy_pattern", "sleep"),
      mk("one_off_dream", "A villa in Tuscany"),
      mk("concern", "weeks blurring together"),
    ];
    const { candidates, roles, values } = seasonCandidatesFromFacts(facts);
    const labels = candidates.map((c) => c.label);

    expect(labels).toEqual(
      expect.arrayContaining([
        "Travel as much as possible",
        "Playing with grandchildren",
        "Painting, drawing & crafts",
        "Unhurried time with Harry",
        "Redecorate the guest rooms with Harry",
        "My daughter",
      ])
    );
    // Non-priority categories are excluded (incl. the dream-walled one_off_dream).
    expect(labels).not.toContain("sleep");
    expect(labels).not.toContain("A villa in Tuscany");
    expect(labels).not.toContain("weeks blurring together");

    expect(roles).toEqual(["Grandparent", "Host"]);
    expect(values).toEqual(["Family"]);
  });

  it("includes only the KEEP side of the retired keep/change/leave stock-take", () => {
    const facts: StoredFact[] = [
      mk("keep_change_leave", "the trips with Harry", { description: "keep" }),
      mk("keep_change_leave", "the long commute", { description: "leave" }),
      mk("keep_change_leave", "my work identity", { description: "change" }),
    ];
    const labels = seasonCandidatesFromFacts(facts).candidates.map((c) => c.label);
    expect(labels).toContain("the trips with Harry");
    expect(labels).not.toContain("the long commute");
    expect(labels).not.toContain("my work identity");
  });

  it("ignores superseded facts and de-duplicates across categories", () => {
    const facts: StoredFact[] = [
      mk("aspiration", "Learn a language"),
      mk("recurring_activity", "Learning a language"), // same after lowercasing? no — different string
      mk("aspiration", "Learn a language", {}, "superseded"), // dropped: not active
      mk("recurring_activity", "learn a language"), // dup of the aspiration by case
    ];
    const labels = seasonCandidatesFromFacts(facts).candidates.map((c) => c.label);
    // "Learn a language" kept once; the case-dup "learn a language" collapsed;
    // "Learning a language" is a distinct string so it stays.
    expect(labels).toEqual(["Learn a language", "Learning a language"]);
  });
});
