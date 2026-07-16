import { describe, it, expect } from "vitest";
import { dedupePrinciples } from "@/lib/rlpPlan";

describe("dedupePrinciples", () => {
  it("collapses first-person principles and their second-person restatements", () => {
    const out = dedupePrinciples([
      "When two things I care about pull against each other, I ask which one has a closing window — and I protect that one first.",
      "I'd rather do fewer things with my full attention than spread myself across more than I can honour properly.",
      "Being there for the grandchildren isn't something I trade away — I build everything else around what I've promised them.",
      "Try to make it all work first — don't default to sacrifice, look for the arrangement where both can happen",
      "If you can't make it all work, protect the thing with a closing window first", // ≈ #1 ("closing window")
      "Do fewer things properly rather than spread across more than you can honour", // ≈ #2 ("fewer things")
      "The grandchildren come before the schedule — build everything else around what you've promised them", // ≈ #3
    ]);
    expect(out).toHaveLength(4);
    expect(out[0]).toMatch(/^When two things/);
    expect(out[3]).toMatch(/^Try to make it all work/);
  });

  it("keeps genuinely distinct principles", () => {
    const out = dedupePrinciples([
      "Time with the people I love comes before any opportunity.",
      "When money is tight, I'd rather do fewer things properly.",
      "Keep one adventure a year, whatever else is going on.",
    ]);
    expect(out).toHaveLength(3);
  });

  it("capitalises the first letter and drops exact repeats", () => {
    const out = dedupePrinciples([
      "protect the quiet mornings",
      "Protect the quiet mornings",
      "  ",
    ]);
    expect(out).toEqual(["Protect the quiet mornings"]);
  });
});
