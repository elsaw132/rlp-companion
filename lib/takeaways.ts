// Per-module takeaways: a short summary of what emerged in a module, captured
// when it completes. They connect the modules — every later module is given the
// earlier takeaways so Vita can draw on the whole picture — and they seed the
// Retirement Life Plan. Reads and writes now live in the client data layer
// (lib/userData.tsx); this file holds the shared shape.

export type Takeaway = {
  moduleId: string;
  moduleTitle: string;
  // Third-person summary ("they") — carried into later modules as Vita's memory.
  text: string;
  // The same summary in the second person ("you"), shown when Vita recaps it
  // directly to the user on the home screen. Optional: takeaways saved before
  // this field existed fall back to `text`.
  textDirect?: string;
  // ISO timestamp of when it was generated, so the latest re-run wins.
  savedAt: string;
};
