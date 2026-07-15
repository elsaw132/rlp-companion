// Rule A of the Stage 2 reveal selection & framing spec: the reveal — the card
// AND the "Where's this from?" tap — carries only gain figures, lever findings,
// or curiosities. It never carries a hazard ratio, mortality figure, or
// disease-incidence number. Those belong in the primer, which is licensed to
// state stakes calmly; burying one in the tap doesn't help, because a curious
// user just taps into the scare.
//
// The spec's goal is to make a negative stat "structurally hard to produce, not
// just unlikely". This test is where that's literally true: a scare cannot
// re-enter the pool without failing here.
//
// The rule is about DIRECTION, not vocabulary. Rule A licenses "50% better odds
// of a long life", which is itself a mortality finding pointed the right way —
// so the guard bans threat-framed constructions ("higher risk of dying") and
// leaves gain-framed ones ("lower risk of dementia", "more likely to reach 85")
// alone. The live pool is the positive control: it contains plenty of legitimate
// gain-framed risk language, so a guard that grew too broad would fail here too.

import { describe, expect, it } from "vitest";
import { STATS } from "@/lib/stage2Stats";

const THREAT_FRAMED = [
  /higher risk/i,
  /higher odds/i,
  /higher mortality/i,
  /more likely to die/i,
  /risk of dying/i,
  /risk of death/i,
  /death risk/i,
  /hazard ratio/i,
];

describe("Stage 2 stat pool — rule A (no mortality in the reveal)", () => {
  it("carries no threat-framed mortality, hazard or disease-incidence claim", () => {
    const violations: string[] = [];

    for (const stat of STATS) {
      for (const pattern of THREAT_FRAMED) {
        if (pattern.test(stat.claim)) {
          violations.push(`${stat.id} — claim matches ${pattern}`);
        }
        // The tap is held to the same standard as the card, by rule A.
        if (pattern.test(stat.sourceDisplay)) {
          violations.push(`${stat.id} — sourceDisplay matches ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
