import { describe, it, expect } from "vitest";
import {
  factsFromBuild,
  factsFromDreams,
  factsFromStage3Values,
  draftsFromSnapshot,
  diffFacts,
  planConversationalApply,
  principlesAfterConversation,
  factIdentity,
  type DraftFact,
  type StoredFact,
  type ConversationalDeltas,
} from "@/lib/contextFacts";
import type { Dreams } from "@/lib/dreams";

// ---------------------------------------------------------------------------
// A tiny in-memory fact store that mirrors what the server helpers do with the
// pure deciders (diffFacts / planConversationalApply) plus addFact / rejectFact.
// It lets us assert the status transitions (active → rejected; active() excludes
// them) without standing up Postgres — the SQL WHERE status='active' is the only
// part not exercised here, and it's trivially correct.
// ---------------------------------------------------------------------------
class FactStore {
  private rows: StoredFact[] = [];
  private nextId = 1;

  add(d: DraftFact): StoredFact {
    const row: StoredFact = {
      id: String(this.nextId++),
      userId: "u",
      category: d.category,
      domain: d.domain ?? null,
      data: d.data,
      provenanceModule: d.provenanceModule,
      provenanceSource: d.provenanceSource,
      status: "active",
      supersededBy: null,
      confidence: d.confidence,
      createdAt: "now",
      lastAffirmedAt: null,
    };
    this.rows.push(row);
    return row;
  }
  reject(id: string) {
    const r = this.rows.find((x) => x.id === id);
    if (r && r.status === "active") r.status = "rejected";
  }
  active(filter?: { provenanceModule?: string }): StoredFact[] {
    return this.rows.filter(
      (r) =>
        r.status === "active" &&
        (!filter?.provenanceModule || r.provenanceModule === filter.provenanceModule)
    );
  }
  // Mirror of reconcileModuleFacts.
  reconcile(moduleId: string, desired: DraftFact[], source: DraftFact["provenanceSource"]) {
    const existing = this.active({ provenanceModule: moduleId }).filter(
      (f) => f.provenanceSource === source
    );
    const { toAdd, toRemoveIds } = diffFacts(desired, existing);
    toAdd.forEach((d) => this.add(d));
    toRemoveIds.forEach((id) => this.reject(id));
  }
  // Mirror of applyConversationalDeltas.
  applyConversational(
    moduleId: string,
    deltas: ConversationalDeltas,
    confirmedKeys: string[] = []
  ) {
    const { toAdd, toRejectIds, pending } = planConversationalApply(
      moduleId,
      deltas,
      this.active({ provenanceModule: moduleId }),
      new Set(confirmedKeys)
    );
    toAdd.forEach((d) => this.add(d));
    toRejectIds.forEach((id) => this.reject(id));
    return { added: toAdd.length, rejected: toRejectIds.length, pending };
  }
}

const rolePicker = (picked: string[], starred: string[] = []) =>
  ({ type: "role-picker", picked, starred, summaryLabel: "x" }) as const;

// ---------------------------------------------------------------------------

describe("categorisation walls", () => {
  it("a 1.money pipe-dream is a one_off_dream — never recurring_activity or aspiration", () => {
    const dreams: Dreams = {
      moduleId: "1.money",
      allDreams: [
        { id: "go", label: "Somewhere you'd go", text: "Sail around the world" },
        { id: "learn", label: "Something you'd learn", text: "Learn to paint" },
      ],
      top3: [{ dream: "Learn to paint", reason: "always wanted to" }],
      achievable: [{ dream: "Learn to paint", adaptedIdea: "evening class" }],
      pipeDreams: ["Sail around the world"],
      savedAt: "now",
    };
    const facts = factsFromDreams(dreams);

    const sail = facts.find((f) => f.data.label === "Sail around the world");
    expect(sail?.category).toBe("one_off_dream");

    // The achievable one is an aspiration, not a recurring_activity.
    const paint = facts.filter((f) => f.data.label === "Learn to paint");
    expect(paint.length).toBeGreaterThan(0);
    expect(paint.every((f) => f.category === "aspiration")).toBe(true);

    // The hard wall: a money-no-object dream is NEVER a recurring_activity.
    expect(facts.some((f) => f.category === "recurring_activity")).toBe(false);
  });

  it("the spark-prompts fallback for 1.money is one_off_dream only", () => {
    const facts = factsFromBuild("1.money", {
      type: "spark-prompts",
      entries: [{ id: "go", label: "Somewhere", text: "A villa in Tuscany" }],
    });
    expect(facts).toHaveLength(1);
    expect(facts[0].category).toBe("one_off_dream");
    expect(facts.some((f) => f.category === "recurring_activity")).toBe(false);
  });

  it("a role-picker is a role in 1.roles but a recurring_activity in 2.2/2.4", () => {
    expect(factsFromBuild("1.roles", rolePicker(["Grandparent"]))[0].category).toBe("role");

    const think = factsFromBuild("2.2", rolePicker(["Reading"]))[0];
    expect(think.category).toBe("recurring_activity");
    expect(think.domain).toBe("Think");

    const contribute = factsFromBuild("2.4", rolePicker(["Volunteering"]))[0];
    expect(contribute.category).toBe("recurring_activity");
    expect(contribute.domain).toBe("Contribute");
  });
});

describe("composite value preservation", () => {
  it("merges 3.2 + 3.4 into one value carrying description, threat and protectors", () => {
    const snapshot = {
      "interaction:3.2": {
        type: "value-triage",
        sorted: [{ label: "Family", tray: "me", evidence: "I show up for them" }],
        core: ["Family"],
        summaryLabel: "x",
      },
      "interaction:3.4": {
        type: "value-definitions",
        values: [
          {
            value: "Family",
            description: "Being a steady presence for the people I love",
            threat: "Letting work crowd them out",
            protectors: ["A weekly call", "Sunday lunch"],
          },
        ],
        summaryLabel: "x",
      },
    };
    const drafts = draftsFromSnapshot(snapshot);
    const family = drafts.filter((d) => d.category === "value");
    expect(family).toHaveLength(1);
    const data = family[0].data as Record<string, unknown>;
    expect(data.description).toBe("Being a steady presence for the people I love");
    expect(data.threat).toBe("Letting work crowd them out");
    expect(data.protectors).toEqual(["A weekly call", "Sunday lunch"]);
    expect(data.coreFive).toBe(true);
  });

  it("prefers the user's 3.4 description over the 3.6 LLM re-distillation", () => {
    const snapshot = {
      "interaction:3.4": {
        type: "value-definitions",
        values: [{ value: "Adventure", description: "Saying yes to the unfamiliar", threat: "", protectors: [] }],
        summaryLabel: "x",
      },
      "stage3-values": {
        values: [{ value: "Adventure", meaning: "A distilled paraphrase", confidence: "certain" }],
        savedAt: "now",
      },
    };
    const value = draftsFromSnapshot(snapshot).find((d) => d.category === "value");
    expect((value?.data as Record<string, unknown>).description).toBe(
      "Saying yes to the unfamiliar"
    );
  });
});

describe("lossless backfill — no caps", () => {
  it("keeps all twelve roles (the old slice(0,5) dropped seven)", () => {
    const twelve = Array.from({ length: 12 }, (_, i) => `Role ${i + 1}`);
    const drafts = draftsFromSnapshot({
      "interaction:1.roles": rolePicker(twelve),
    });
    const roles = drafts.filter((d) => d.category === "role");
    expect(roles).toHaveLength(12);
  });

  it("every structured pick across a completed fixture resolves to a fact", () => {
    const snapshot = {
      "interaction:1.roles": rolePicker(["Grandparent", "Mentor", "Gardener"]),
      "interaction:2.3": rolePicker(["My partner", "Old friends"]),
      "interaction:3.1": {
        type: "mirror-cards",
        kept: [
          { label: "Curiosity", evidence: "always asking" },
          { label: "Kindness" },
        ],
        rejected: [],
        starred: ["Curiosity"],
        summaryLabel: "x",
      },
      "stage3-values": {
        values: [{ value: "Honesty", meaning: "straight with people", confidence: "certain" }],
        savedAt: "now",
      },
    };
    const drafts = draftsFromSnapshot(snapshot);
    // 3 roles + 2 relationships + 2 strengths + 1 value = 8 picks minimum.
    expect(drafts.filter((d) => d.category === "role")).toHaveLength(3);
    expect(drafts.filter((d) => d.category === "relationship")).toHaveLength(2);
    expect(drafts.filter((d) => d.category === "strength")).toHaveLength(2);
    expect(drafts.filter((d) => d.category === "value")).toHaveLength(1);
    expect(drafts.length).toBeGreaterThanOrEqual(8);
  });
});

describe("re-edit diff", () => {
  it("rejects a pick that disappears between builds; active excludes it", () => {
    const store = new FactStore();
    store.reconcile("1.roles", factsFromBuild("1.roles", rolePicker(["A", "B", "C"])), "widget_pick");
    expect(store.active({ provenanceModule: "1.roles" })).toHaveLength(3);

    // Re-edit: C removed, D added.
    store.reconcile("1.roles", factsFromBuild("1.roles", rolePicker(["A", "B", "D"])), "widget_pick");
    const labels = store
      .active({ provenanceModule: "1.roles" })
      .map((f) => f.data.label)
      .sort();
    expect(labels).toEqual(["A", "B", "D"]);
    expect(labels).not.toContain("C");
  });
});

describe("conversational correction — the 11am coffee case", () => {
  const seed = () => {
    const store = new FactStore();
    store.reconcile(
      "2.5",
      [
        {
          category: "recurring_activity",
          domain: "Restore",
          data: { label: "a 9am run" },
          provenanceModule: "2.5",
          provenanceSource: "widget_pick",
          confidence: "certain",
        },
      ],
      "widget_pick"
    );
    return store;
  };

  it("does NOT reject an unconfirmed removal — the fact stays active", () => {
    const store = seed();
    const deltas: ConversationalDeltas = {
      additions: [],
      removals: [{ label: "a 9am run", userConfirmedInChat: false }],
    };
    const res = store.applyConversational("2.5", deltas);
    expect(res.rejected).toBe(0);
    expect(res.pending).toHaveLength(1);
    expect(store.active({ provenanceModule: "2.5" }).map((f) => f.data.label)).toContain(
      "a 9am run"
    );
  });

  it("rejects only after the in-conversation confirmation; active then excludes it", () => {
    const store = seed();
    const deltas: ConversationalDeltas = {
      additions: [
        { category: "recurring_activity", domain: "Restore", label: "solo coffee at 11am" },
      ],
      removals: [{ label: "a 9am run", userConfirmedInChat: true }],
    };
    const res = store.applyConversational("2.5", deltas);
    expect(res.rejected).toBe(1);
    const labels = store.active({ provenanceModule: "2.5" }).map((f) => f.data.label);
    expect(labels).toContain("solo coffee at 11am");
    expect(labels).not.toContain("a 9am run");
  });

  it("also honours an explicit confirmation key when the model didn't flag it", () => {
    const store = seed();
    const existing = store.active({ provenanceModule: "2.5" })[0];
    const identity = factIdentity(existing);
    const deltas: ConversationalDeltas = {
      additions: [],
      removals: [{ label: "a 9am run", userConfirmedInChat: false }],
    };
    const res = store.applyConversational("2.5", deltas, [identity]);
    expect(res.rejected).toBe(1);
    expect(store.active({ provenanceModule: "2.5" })).toHaveLength(0);
  });
});

describe("4.5 principle write-back", () => {
  it("folds a conversationally-stated principle into the principles list", () => {
    const deltas: ConversationalDeltas = {
      additions: [{ category: "principle", label: "Say no to over-committing" }],
      removals: [],
    };
    const next = principlesAfterConversation(["Protect my mornings"], deltas);
    expect(next).toEqual(["Protect my mornings", "Say no to over-committing"]);
  });

  it("drops a principle the person confirmed removing, and de-duplicates", () => {
    const deltas: ConversationalDeltas = {
      additions: [{ category: "principle", label: "Protect my mornings" }],
      removals: [{ category: "principle", label: "Always say yes", userConfirmedInChat: true }],
    };
    const next = principlesAfterConversation(
      ["Protect my mornings", "Always say yes"],
      deltas
    );
    expect(next).toEqual(["Protect my mornings"]);
  });
});

describe("stage-3 values stay walled from other kinds", () => {
  it("produces value facts only, marking still-forming where confidence says so", () => {
    const facts = factsFromStage3Values([
      { value: "Honesty", meaning: "straight with people", confidence: "certain" },
      { value: "Calm", meaning: "", confidence: "still forming" },
    ]);
    expect(facts.every((f) => f.category === "value")).toBe(true);
    expect(facts.find((f) => f.data.label === "Calm")?.confidence).toBe("still_forming");
  });
});
