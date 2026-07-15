// How far off retirement is, for Vita's Reflections.
//
// The rule this exists to serve: more than ~10 years out, an unformed plan isn't
// a gap — it's right for where they are, and Vita should say so warmly rather
// than nudging someone to finish something they've no reason to finish yet. Near
// retirement is the only place completeness expectations legitimately rise.
//
// There is no stored years-to-retirement fact, so it's derived. Cascade, best
// signal first:
//   1. The 4.1 leaving window. It's the member's OWN stated window, captured in
//      Stage 4 immediately before the plan, and its scale runs "Now, 1…10" —
//      capping at 10, which is exactly the threshold. Sharpest signal there is.
//   2. The onboarding horizon band. "More than 10 years" maps straight across.
//      Only the two not-yet-retired cohorts are ever asked it.
//   3. Age from dob. Under 55 reads as far out (a settled call, not a guess).
// Nothing to go on → treat as near, which is the cautious default: it keeps the
// existing expectations rather than telling someone they're early when we don't
// know that.

export type HorizonInputs = {
  // 4.1's chosen from–to band over the marks "Now", "1"…"10" (years).
  window?: { fromLabel: string; toLabel: string } | null;
  // The onboarding band, e.g. "More than 10 years" | "5–10 years" | "Not sure".
  horizonBand?: string | null;
  age?: number | null;
};

const FAR_YEARS = 10;
const FAR_AGE = 55;

export function isFarHorizon(inputs: HorizonInputs): boolean {
  // 1. Their own leaving window. "Now" is 0; the scale tops out at 10, so a
  //    from-mark of 10 means "10 or more" and reads as far out.
  const from = inputs.window?.fromLabel?.trim();
  if (from) {
    if (/^now$/i.test(from)) return false;
    const years = Number(from);
    if (Number.isFinite(years)) return years >= FAR_YEARS;
  }

  // 2. The onboarding band. Only "More than 10 years" clears the threshold; the
  //    other bands are all inside it. "Not sure" falls through to age.
  const band = inputs.horizonBand?.trim().toLowerCase();
  if (band && band !== "not sure") {
    return band.includes("more than 10");
  }

  // 3. Age.
  if (typeof inputs.age === "number" && Number.isFinite(inputs.age)) {
    return inputs.age < FAR_AGE;
  }

  return false;
}
