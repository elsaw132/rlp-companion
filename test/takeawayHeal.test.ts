import { describe, it, expect } from "vitest";
import { sessionsNeedingTakeaway } from "@/lib/takeawayHeal";
import type { ConversationMessage } from "@/lib/userData";

// "2.5" and "1.day" are real module ids (see lib/modules.ts); "stage1-start" and
// "not-a-module" are not, so they must never be selected for healing.
const convo = (...roles: ("coach" | "user")[]): ConversationMessage[] =>
  roles.map((role, i) => ({ role, text: `${role} line ${i}` }));

function select(opts: {
  completed: unknown;
  takeaways?: string[];
  conversations?: Record<string, ConversationMessage[]>;
}) {
  const takeaways = new Set(opts.takeaways ?? []);
  const conversations = opts.conversations ?? {};
  return sessionsNeedingTakeaway({
    completed: opts.completed,
    hasTakeaway: (id) => takeaways.has(id),
    getConversation: (id) => conversations[id] ?? null,
  }).map((t) => t.id);
}

describe("sessionsNeedingTakeaway", () => {
  it("selects a completed session with a real exchange but no takeaway", () => {
    expect(
      select({ completed: ["2.5"], conversations: { "2.5": convo("coach", "user") } })
    ).toEqual(["2.5"]);
  });

  it("attaches the real module title", () => {
    const targets = sessionsNeedingTakeaway({
      completed: ["2.5"],
      hasTakeaway: () => false,
      getConversation: () => convo("coach", "user"),
    });
    expect(targets[0].moduleTitle).toBe("Energy, sleep and feeling well");
  });

  it("skips a session that already has a takeaway", () => {
    expect(
      select({
        completed: ["2.5"],
        takeaways: ["2.5"],
        conversations: { "2.5": convo("coach", "user") },
      })
    ).toEqual([]);
  });

  it("skips a session whose conversation has no user message", () => {
    expect(
      select({ completed: ["2.5"], conversations: { "2.5": convo("coach", "coach") } })
    ).toEqual([]);
  });

  it("skips a session with a user message that is only whitespace", () => {
    expect(
      select({ completed: ["2.5"], conversations: { "2.5": [{ role: "user", text: "   " }] } })
    ).toEqual([]);
  });

  it("skips a completed session with no stored conversation", () => {
    expect(select({ completed: ["2.5"] })).toEqual([]);
  });

  it("skips ids that are not real modules (e.g. stage1-start)", () => {
    expect(
      select({
        completed: ["stage1-start", "not-a-module"],
        conversations: {
          "stage1-start": convo("coach", "user"),
          "not-a-module": convo("coach", "user"),
        },
      })
    ).toEqual([]);
  });

  it("returns only the sessions that need healing from a mixed set", () => {
    expect(
      select({
        completed: ["1.day", "2.5"],
        takeaways: ["1.day"], // has one already
        conversations: {
          "1.day": convo("coach", "user"),
          "2.5": convo("coach", "user"), // missing → heal
        },
      })
    ).toEqual(["2.5"]);
  });

  it("returns [] when completed is missing or not an array", () => {
    expect(select({ completed: undefined })).toEqual([]);
    expect(select({ completed: "2.5" })).toEqual([]);
  });
});
