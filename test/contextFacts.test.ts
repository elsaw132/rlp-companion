import { describe, it, expect } from "vitest";
import {
  factsFromBuild,
  factsFromDreams,
  factsFromStage3Values,
  draftsFromSnapshot,
  diffFacts,
  planConversationalApply,
  filterGroundedRemovals,
  filterGroundedReasons,
  normalizeDeltas,
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
    const { toAdd, toRejectIds, pending, reasonUpdates } = planConversationalApply(
      moduleId,
      deltas,
      this.active({ provenanceModule: moduleId }),
      new Set(confirmedKeys)
    );
    toAdd.forEach((d) => this.add(d));
    toRejectIds.forEach((id) => this.reject(id));
    // Mirror of annotateFact: additively set data.reason, only when absent, and
    // never touch any other field (label, pick, description).
    reasonUpdates.forEach((u) => {
      const row = this.rows.find((r) => r.id === u.factId && r.status === "active");
      const existing = typeof row?.data.reason === "string" ? row.data.reason.trim() : "";
      if (row && !existing) row.data = { ...row.data, reason: u.reason };
    });
    return {
      added: toAdd.length,
      rejected: toRejectIds.length,
      annotated: reasonUpdates.length,
      pending,
    };
  }
  row(id: string): StoredFact | undefined {
    return this.rows.find((r) => r.id === id);
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

describe("removals must be grounded in the member's own words", () => {
  // A senses eye-test answer ("Longer ago") on record; the member never asked to
  // change it. The model inferred a removal with no quote — it must be dropped,
  // so no false "did you want to drop this?" ever surfaces.
  const transcript =
    "It was a while back, maybe a couple of years since my last eye test. I've been meaning to book one.";

  it("drops a removal with no quote at all (the false-positive case)", () => {
    const out = filterGroundedRemovals(
      [{ label: "Longer ago" }],
      transcript
    );
    expect(out).toEqual([]);
  });

  it("drops a removal whose quote is not in the transcript", () => {
    const out = filterGroundedRemovals(
      [{ label: "Longer ago", quote: "no, drop the longer ago answer" }],
      transcript
    );
    expect(out).toEqual([]);
  });

  it("drops a trivially short quote", () => {
    const out = filterGroundedRemovals(
      [{ label: "morning run", quote: "no" }],
      "no"
    );
    expect(out).toEqual([]);
  });

  it("keeps a removal whose quote is verbatim member text", () => {
    const explicit =
      "Actually, scrap the morning run — I don't do that any more.";
    const out = filterGroundedRemovals(
      [
        {
          label: "morning run",
          quote: "scrap the morning run",
          userConfirmedInChat: true,
        },
      ],
      explicit
    );
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe("morning run");
  });

  it("matches through smart quotes and punctuation differences", () => {
    const out = filterGroundedRemovals(
      [{ label: "the 11am coffee", quote: "drop the 11am coffee!" }],
      "Hmm, let’s drop the 11am coffee — it never happens.",
    );
    expect(out).toHaveLength(1);
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

// ---------------------------------------------------------------------------
// Conversational reason-capture (Pass B, Part 2). Additive: a reason attaches to
// an existing fact, or falls back to a standalone thread — never overwrites a
// widget value, never removes a pick, never changes the widget→fact mapping.
// ---------------------------------------------------------------------------
describe("reason-capture — grounding", () => {
  const member =
    "the grandkids are the bit that makes me feel useful again\nI'd keep the allotment whatever happens";

  it("keeps a reason whose quote is the member's own words", () => {
    const out = filterGroundedReasons(
      [{ label: "time with grandkids", reason: "makes them feel useful", quote: "makes me feel useful again" }],
      member
    );
    expect(out).toHaveLength(1);
  });
  it("drops a reason whose quote is not in the transcript (never fabricated)", () => {
    const out = filterGroundedReasons(
      [{ label: "time with grandkids", reason: "guilt about the past", quote: "I feel so guilty about missing their childhood" }],
      member
    );
    expect(out).toHaveLength(0);
  });
  it("drops a reason with no reason text or no quote", () => {
    expect(filterGroundedReasons([{ label: "x", reason: "", quote: "makes me feel useful again" }], member)).toHaveLength(0);
    expect(filterGroundedReasons([{ label: "x", reason: "a why", quote: "" }], member)).toHaveLength(0);
  });
  it("de-dupes on (label, reason)", () => {
    const dup = { label: "the allotment", reason: "want to keep it", quote: "keep the allotment whatever happens" };
    expect(filterGroundedReasons([dup, { ...dup }], member)).toHaveLength(1);
  });
});

describe("reason-capture — normalizeDeltas", () => {
  it("surfaces well-formed reasons and tolerates their absence", () => {
    const d = normalizeDeltas({
      additions: [],
      removals: [],
      reasons: [
        { label: "a", reason: "why a", quote: "q" },
        { label: "", reason: "no label" },
        { label: "b", reason: "" },
      ],
    });
    expect(d.reasons).toEqual([{ label: "a", reason: "why a", quote: "q" }]);
    // A legacy payload with no reasons key still yields an empty array.
    expect(normalizeDeltas({ additions: [], removals: [] }).reasons).toEqual([]);
  });
});

describe("reason-capture — apply is additive", () => {
  function storeWithDayPick() {
    const store = new FactStore();
    // A widget pick with a widget-set description that must never be clobbered.
    store.reconcile(
      "1.day",
      [
        {
          category: "day_picture_item",
          data: { label: "Time with grandkids", description: "Saturday mornings" },
          provenanceModule: "1.day",
          provenanceSource: "widget_pick",
          confidence: "certain",
        },
      ],
      "widget_pick"
    );
    return store;
  }

  it("attaches a reason to the matching fact without touching its pick or description", () => {
    const store = storeWithDayPick();
    const id = store.active({ provenanceModule: "1.day" })[0].id;
    const res = store.applyConversational("1.day", {
      additions: [],
      removals: [],
      reasons: [{ label: "Time with grandkids", reason: "it's what makes them feel useful again" }],
    } as ConversationalDeltas);

    expect(res.annotated).toBe(1);
    expect(res.added).toBe(0);
    expect(res.rejected).toBe(0);
    const row = store.row(id)!;
    expect(row.data.reason).toBe("it's what makes them feel useful again");
    expect(row.data.label).toBe("Time with grandkids"); // pick untouched
    expect(row.data.description).toBe("Saturday mornings"); // widget description untouched
    expect(store.active({ provenanceModule: "1.day" })).toHaveLength(1); // no new fact
  });

  it("never overwrites a reason already present", () => {
    const store = storeWithDayPick();
    const id = store.active({ provenanceModule: "1.day" })[0].id;
    store.row(id)!.data = { ...store.row(id)!.data, reason: "the original reason" };
    store.applyConversational("1.day", {
      additions: [],
      removals: [],
      reasons: [{ label: "Time with grandkids", reason: "a different, later reason" }],
    } as ConversationalDeltas);
    expect(store.row(id)!.data.reason).toBe("the original reason");
  });

  it("falls back to a standalone meaning_thread when nothing on record matches", () => {
    const store = storeWithDayPick();
    const res = store.applyConversational("1.day", {
      additions: [],
      removals: [],
      reasons: [{ label: "something not on record", reason: "a real standalone why" }],
    } as ConversationalDeltas);
    expect(res.annotated).toBe(0);
    expect(res.added).toBe(1);
    const thread = store
      .active({ provenanceModule: "1.day" })
      .find((f) => f.category === "meaning_thread");
    expect(thread?.data.label).toBe("a real standalone why");
    expect(thread?.provenanceSource).toBe("conversational_statement");
  });

  it("the reason path never produces a removal", () => {
    const store = storeWithDayPick();
    const res = store.applyConversational("1.day", {
      additions: [],
      removals: [],
      reasons: [{ label: "Time with grandkids", reason: "a why" }],
    } as ConversationalDeltas);
    expect(res.rejected).toBe(0);
    expect(store.active({ provenanceModule: "1.day" }).some((f) => f.data.label === "Time with grandkids")).toBe(true);
  });
});
