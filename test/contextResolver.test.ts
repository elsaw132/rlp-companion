import { describe, it, expect } from "vitest";
import type { StoredFact, FactCategory, RecurringDomain } from "@/lib/contextFacts";
import {
  resolveViews,
  resolveVitaText,
  resolveSeedItems,
} from "@/lib/contextResolver";
import {
  validateManifests,
  MODULE_MANIFESTS,
  DREAM_WALL_MODULES,
  getManifest,
} from "@/lib/moduleManifests";
import {
  coreValuesFromFacts,
  recurringSeedFromFacts,
  springboardsFromFacts,
  seasonCardsFromFacts,
  synthesizeActiveFacts,
} from "@/lib/resolverInputs";
import { SEED_SOURCE } from "@/lib/rlpPlanSeed";

// A quick active StoredFact for fixtures.
let idCounter = 0;
function fact(
  category: FactCategory,
  label: string,
  extra: {
    domain?: RecurringDomain;
    data?: Record<string, unknown>;
    status?: StoredFact["status"];
    confidence?: StoredFact["confidence"];
  } = {}
): StoredFact {
  idCounter += 1;
  return {
    id: String(idCounter),
    userId: "u",
    category,
    domain: extra.domain ?? null,
    data: { label, ...(extra.data ?? {}) },
    provenanceModule: "test",
    provenanceSource: "widget_pick",
    status: extra.status ?? "active",
    supersededBy: null,
    confidence: extra.confidence ?? "certain",
    createdAt: "now",
    lastAffirmedAt: null,
  };
}

describe("manifest validity + dream wall", () => {
  it("the manifest table is structurally valid", () => {
    expect(validateManifests()).toEqual([]);
  });

  it("no Stage-4 plan module declares one_off_dream", () => {
    for (const moduleId of DREAM_WALL_MODULES) {
      const m = MODULE_MANIFESTS[moduleId];
      expect(m).toBeTruthy();
      expect(m.inputs.some((i) => i.category === "one_off_dream")).toBe(false);
    }
  });

  it("one_off_dream only appears on the allowed reflective surfaces", () => {
    const allowed = new Set(["1.letter", "3.1", "3.2", "3.6"]);
    for (const [moduleId, m] of Object.entries(MODULE_MANIFESTS)) {
      if (m.inputs.some((i) => i.category === "one_off_dream")) {
        expect(allowed.has(moduleId)).toBe(true);
      }
    }
  });
});

describe("resolver — roles route to the right view", () => {
  it("[V] feeds the Vita view, [E] the seed view, [E+V] both (3.4 value)", () => {
    const facts = [
      fact("value", "Family", {
        data: { description: "Being present", coreFive: true, threat: "work", protectors: ["a weekly call"] },
      }),
      fact("day_picture_item", "Slow breakfast"),
      fact("week_shape_pref", "Slow mornings"),
    ];
    const { seed, vita } = resolveViews("3.4", facts);
    // 3.4: value and day_picture_item are [E+V] (both — the full self-picture
    // reaches Vita too); week_shape_pref stays [E] (seed only).
    expect(vita.items.some((i) => i.label === "Family")).toBe(true);
    expect(vita.items.some((i) => i.label === "Slow breakfast")).toBe(true);
    expect(seed.items.some((i) => i.label === "Slow breakfast")).toBe(true);
    expect(vita.items.some((i) => i.label === "Slow mornings")).toBe(false);
    expect(seed.items.some((i) => i.label === "Slow mornings")).toBe(true);
    // 3.4 asks for the verbatim description (withDescription) but not threat/protector.
    const fam34 = seed.items.find((i) => i.label === "Family");
    expect(fam34?.description).toBe("Being present");
    expect(fam34?.threat).toBeUndefined();

    // 4.5 is the module that asks for description + threat + protectors.
    const fam45 = resolveViews("4.5", facts).seed.items.find((i) => i.label === "Family");
    expect(fam45?.description).toBe("Being present");
    expect(fam45?.threat).toBe("work");
    expect(fam45?.protectors).toEqual(["a weekly call"]);
  });
});

describe("resolver — tag + domain filters", () => {
  it("2.1 day_picture_item{movement} surfaces only movement items", () => {
    const facts = [
      fact("day_picture_item", "Walk"),
      fact("day_picture_item", "Slow breakfast"),
    ];
    const text = resolveVitaText("2.1", facts);
    expect(text).toContain("Walk");
    expect(text).not.toContain("Slow breakfast");
  });

  it("2.5 recurring_activity{Move} filters by domain", () => {
    const facts = [
      fact("recurring_activity", "Swimming", { domain: "Move" }),
      fact("recurring_activity", "Choir", { domain: "Connect" }),
    ];
    const items = resolveViews("2.5", facts).vita.items.filter(
      (i) => i.category === "recurring_activity"
    );
    expect(items.map((i) => i.label)).toEqual(["Swimming"]);
  });

  it("2.6 computes age from the DOB onboarding fact", () => {
    const facts = [fact("onboarding_fact", "1960-05-01", { data: { field: "dob" } })];
    const { seed } = resolveViews("2.6", facts);
    expect(seed.age).toBeGreaterThanOrEqual(60);
  });
});

describe("rejected facts drop from every resolved view", () => {
  it("a rejected recurring_activity is excluded from seed + vita views", () => {
    const active = fact("recurring_activity", "A 9am run", { domain: "Move" });
    const rejected = fact("recurring_activity", "A 11am coffee", {
      domain: "Restore",
      status: "rejected",
    });
    const facts = [active, rejected];
    const items = resolveSeedItems("4.6", facts, "recurring_activity");
    expect(items.some((i) => i.label === "A 9am run")).toBe(true);
    expect(items.some((i) => i.label === "A 11am coffee")).toBe(false);

    const recurring = recurringSeedFromFacts(items);
    expect(recurring.some((r) => r.label === "A 11am coffee")).toBe(false);
  });

  it("a rejected value is excluded from the plan's core values", () => {
    const facts = [
      fact("value", "Honesty", { data: { description: "straight with people", coreFive: true } }),
      fact("value", "Status", { data: { description: "old", coreFive: true }, status: "rejected" }),
    ];
    const core = coreValuesFromFacts(facts);
    expect(core.map((v) => v.value)).toEqual(["Honesty"]);
  });
});

describe("RLP fidelity — verbatim values + threat/protector", () => {
  it("core values carry the verbatim description, threat and protectors, ranked", () => {
    const facts = [
      fact("value", "Adventure", {
        data: {
          description: "Saying yes to the unfamiliar",
          coreFive: true,
          threat: "Comfortable routine",
          protectors: ["One new thing a month"],
        },
      }),
      fact("value", "Family", {
        data: { description: "Being a steady presence", coreFive: true },
      }),
      fact("value_priority", "Family", { data: { rank: 1 } }),
      fact("value_priority", "Adventure", { data: { rank: 2 } }),
    ];
    const core = coreValuesFromFacts(facts);
    // Ranked: Family (1) before Adventure (2).
    expect(core.map((v) => v.value)).toEqual(["Family", "Adventure"]);
    const adv = core.find((v) => v.value === "Adventure")!;
    expect(adv.meaning).toBe("Saying yes to the unfamiliar"); // verbatim, not re-distilled
    expect(adv.threat).toBe("Comfortable routine");
    expect(adv.protectors).toEqual(["One new thing a month"]);
  });
});

describe("4.6 reads structured recurring activities (no transcript)", () => {
  it("recurringSeedFromFacts is purely the recurring_activity facts, de-duped", () => {
    const facts = [
      fact("recurring_activity", "Badminton", { domain: "Move" }),
      fact("recurring_activity", "Badminton", { domain: "Move" }),
      fact("recurring_activity", "Book group", { domain: "Think" }),
    ];
    const recurring = recurringSeedFromFacts(
      resolveSeedItems("4.6", facts, "recurring_activity")
    );
    expect(recurring.map((r) => r.label).sort()).toEqual(["Badminton", "Book group"]);
  });
});

describe("seeding foregrounds, never narrows", () => {
  it("the resolver only ever returns the person's own facts — never invents", () => {
    const facts = [
      fact("recurring_activity", "Gardening", { domain: "Restore" }),
      fact("aspiration", "Learn Italian"),
    ];
    const items = resolveViews("4.2", facts).seed.items;
    const inputLabels = new Set(facts.map((f) => f.data.label));
    for (const it of items) expect(inputLabels.has(it.label)).toBe(true);
    // Springboards/season cards are built only from facts present.
    const cards = seasonCardsFromFacts(items);
    for (const c of cards) expect(inputLabels.has(c.label)).toBe(true);
  });
});

describe("leanness — no raw transcript ever enters a view", () => {
  it("resolved views are structured lines, not a transcript dump", () => {
    const facts = [
      fact("recurring_activity", "Swimming", { domain: "Move" }),
      fact("value", "Calm", { data: { description: "unhurried" } }),
    ];
    for (const id of ["2.5", "3.4", "4.6"]) {
      const { vita, seed } = resolveViews(id, facts);
      for (const text of [vita.text, seed.text]) {
        expect(text).not.toMatch(/\bThem:\s/);
        expect(text).not.toMatch(/\bVita:\s/);
      }
    }
  });
});

describe("manifest population check (seed fixture user)", () => {
  const facts = synthesizeActiveFacts(SEED_SOURCE);

  it("the seed member produces a populated profile", () => {
    expect(facts.length).toBeGreaterThan(10);
  });

  it("a module's declared non-cross-ref categories that the user has resolve to facts", () => {
    // 4.2 reads aspiration / recurring_activity / value etc. — the seed member has these.
    const views = resolveViews("4.2", facts);
    expect(views.seed.items.length).toBeGreaterThan(0);
    expect(views.vita.text.length).toBeGreaterThan(0);
  });

  it("cross-refs to a not-yet-done module resolve gracefully empty, never throw", () => {
    // A fresh user with no facts at all: every module resolves to empty views.
    for (const id of Object.keys(MODULE_MANIFESTS)) {
      expect(() => resolveViews(id, [])).not.toThrow();
      expect(resolveViews(id, []).seed.items).toEqual([]);
    }
    expect(getManifest("nope")).toBeNull();
  });

  it("the seed RLP core values carry verbatim descriptions (and threat/protector where set)", () => {
    const core = coreValuesFromFacts(facts);
    expect(core.length).toBeGreaterThan(0);
    expect(core.some((v) => (v.meaning ?? "").length > 0)).toBe(true);
  });

  it("springboards group the seed member's recurring activities by area", () => {
    const seed = springboardsFromFacts(
      resolveSeedItems("4.3", facts, "recurring_activity")
    );
    // Some springboards land, each tagged with at least one area.
    expect(seed.springboards.length).toBeGreaterThan(0);
    expect(seed.springboards.every((s) => s.areas.length > 0)).toBe(true);
  });
});
