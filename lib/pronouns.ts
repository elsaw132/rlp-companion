// Third-person pronoun fragments for user-facing copy, derived ONLY from an
// explicitly collected gender (onboarding's "How would you describe your
// gender?"). We map just the two unambiguous explicit selections — "Male" and
// "Female" — to gendered pronouns. Non-binary, a self-described value, "prefer
// not to say", and any missing/unknown value all fall back to singular "they".
//
// We NEVER infer a pronoun from a name or anything else: a wrong guess
// misgenders a real person, which the "they" fallback never does. So the worst
// case here is a correct-but-generic "they", never a mistaken "he"/"she".
export type Pronouns = {
  // Possessive-independent form: "hers" / "his" / "theirs".
  possessive: string;
  // Subject pronoun contracted with "to be": "she's" / "he's" / "they're".
  subjectIs: string;
};

export const THEY: Pronouns = { possessive: "theirs", subjectIs: "they're" };

export function pronounsForGender(gender: string | null | undefined): Pronouns {
  const g = (gender ?? "").trim().toLowerCase();
  if (g === "female") return { possessive: "hers", subjectIs: "she's" };
  if (g === "male") return { possessive: "his", subjectIs: "he's" };
  return THEY;
}
