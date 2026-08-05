// A hand-entered snapshot of the device / operating-system breakdown from
// Vercel Web Analytics, shown on the admin portal's "Usage patterns" tab so the
// full pilot history is visible in one place.
//
// WHY THIS IS A SNAPSHOT, NOT LIVE: the app can't query Vercel Web Analytics —
// those numbers live only in the Vercel dashboard. So this is refreshed by hand:
// export "Top Devices" and "Top Operating Systems" from Vercel for the pilot
// date range and paste the figures below, then bump `rangeLabel` / `updated`.
// (The tab ALSO tracks device per coaching session live, from the app itself,
// for the period after in-app capture shipped — that half needs no manual step.)
//
// The numbers below are the export Elsa downloaded on 2026-08-05, covering the
// pilot from its start (20 Jul 2026) to 5 Aug 2026. "visitors" is distinct
// people; "views" is total page views (Vercel's "Total"). These are WHOLE-SITE
// visits, a slightly broader measure than coaching sessions.

export type VercelBreakdownRow = {
  label: string;
  visitors: number;
  views: number;
};

export type VercelAnalyticsSnapshot = {
  // Human label for the window these figures cover.
  rangeLabel: string;
  // When the snapshot below was last refreshed from a Vercel export.
  updated: string;
  devices: VercelBreakdownRow[];
  operatingSystems: VercelBreakdownRow[];
};

export const VERCEL_ANALYTICS_SNAPSHOT: VercelAnalyticsSnapshot = {
  rangeLabel: "20 Jul – 5 Aug 2026",
  updated: "5 Aug 2026",
  devices: [
    { label: "Mobile", visitors: 199, views: 1107 },
    { label: "Desktop", visitors: 165, views: 844 },
    { label: "Tablet", visitors: 5, views: 34 },
  ],
  operatingSystems: [
    { label: "iOS", visitors: 149, views: 837 },
    { label: "Mac", visitors: 102, views: 633 },
    { label: "Windows", visitors: 64, views: 207 },
    { label: "Android", visitors: 55, views: 304 },
    { label: "Chrome OS", visitors: 1, views: 10 },
  ],
};
