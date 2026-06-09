// The structured "Dreams" record for the money-no-object module (1.money).
//
// The module's full dream list is captured in its spark-prompts interaction, but
// the choices that emerge in conversation — the top three the person would keep
// if they could only afford three, why those three stand out, and which dreams
// could actually be achievable in an adapted form — live only in the chat. This
// record pulls all of that into one durable, structured shape so later stages
// (Stage 3 especially) can read it losslessly rather than from the compressed
// takeaway prose.

export type DreamEntry = {
  // Matches the spark-prompt id (go / learn / build / indulge) when known.
  id: string;
  // The prompt the entry sat under, e.g. "Somewhere you'd go".
  label: string;
  // What the person actually typed.
  text: string;
};

export type TopDream = {
  // The dream in the person's own words.
  dream: string;
  // Why it stands out for them, drawn from what they said. Empty if not given.
  reason: string;
};

export type AchievableDream = {
  // The dream in the person's own words.
  dream: string;
  // The idea that emerged for making a version of it real, possibly adapted or
  // scaled down to be affordable.
  adaptedIdea: string;
};

export type Dreams = {
  moduleId: string;
  // The full list the person typed in the spark-prompts capture, verbatim.
  allDreams: DreamEntry[];
  // The (up to) three they chose when asked which they'd keep if they could only
  // afford three — with the reason each stands out. Fewer than three, or empty,
  // if they declined to narrow it down.
  top3: TopDream[];
  // Dreams discussed as actually achievable, possibly in an adapted form.
  achievable: AchievableDream[];
  // The big dreams worth holding onto that stay out of reach for now.
  pipeDreams: string[];
  // ISO timestamp of when it was generated, so the latest re-run wins.
  savedAt: string;
};
