// Per-module takeaways: a short summary of what emerged in a module, captured
// when it completes. They connect the modules — every later module is given the
// earlier takeaways so Vita can draw on the whole picture — and they seed the
// Retirement Life Plan. Reads and writes now live in the client data layer
// (lib/userData.tsx); this file holds the shared shape.

export type Takeaway = {
  moduleId: string;
  moduleTitle: string;
  text: string;
  // ISO timestamp of when it was generated, so the latest re-run wins.
  savedAt: string;
};
