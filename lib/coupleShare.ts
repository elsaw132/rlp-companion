// Deriving the shareable items for the "Choose what to share" step, and the
// filtering the comparison uses later. Pure and env-agnostic: it reads a plain
// { key: value } data map (the same shape as getAllUserData server-side, or the
// useUserData snapshot client-side), so the SAME refs are produced wherever this
// runs — which is what keeps the share step and the comparison in step.
//
// A "ref" is a stable id for one shareable thing. share_selection.shared_item_refs
// stores the refs the person left on; the comparison filters both participants'
// data to those refs and never sends anything else to generation.

import type {
  BalancedGoalsResult,
  HopesFearsResult,
  WeekShapeResult,
  ReadinessSnapshotResult,
  DayBuilderResult,
  FirstYearResult,
  ValueTriageResult,
  MirrorCardsResult,
  TradeOffsResult,
} from "@/lib/modules";

export type ShareGroup =
  | "plan"
  | "values"
  | "strengths"
  | "hopes"
  | "fears"
  | "principles";

export type ShareItem = {
  ref: string;
  group: ShareGroup;
  label: string;
  // Whether the toggle starts on. Plan + hopes default on; a fear defaults on
  // unless it's flagged as about the partner/relationship.
  defaultOn: boolean;
  // Fears only: set when classified as about the partner. Drives the "This one's
  // about [Ray]" flag and the default-off.
  aboutPartner?: boolean;
};

// Read one stored module result of a known interaction type, or null.
function result<T extends { type: string }>(
  data: Record<string, unknown>,
  moduleId: string,
  type: T["type"]
): T | null {
  const v = data[`interaction:${moduleId}`];
  if (v && typeof v === "object" && (v as { type?: unknown }).type === type) {
    return v as T;
  }
  return null;
}

// Stable, readable ref from a free-text label, uniquified within a prefix.
function slugRef(prefix: string, label: string, seen: Set<string>): string {
  const base =
    prefix +
    ":" +
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
  let ref = base;
  let n = 2;
  while (seen.has(ref)) ref = `${base}-${n++}`;
  seen.add(ref);
  return ref;
}

const TRAVEL_HINT = /\b(travel|trip|trips|abroad|holiday|holidays|journey|journeys|voyage|cruise)\b/i;

// Whether the person's plan carries any travel signal. There's no dedicated
// travel field, so we derive it: a goal whose area/label mentions travel, or a
// first-year item that is a trip.
function hasTravelSignal(
  goals: BalancedGoalsResult | null,
  firstYear: FirstYearResult | null
): boolean {
  if (
    goals?.goals.some(
      (g) => TRAVEL_HINT.test(g.label) || TRAVEL_HINT.test(g.area ?? "")
    )
  ) {
    return true;
  }
  if (firstYear?.items.some((i) => i.kind === "trip")) return true;
  return false;
}

// Build the full set of shareable items for one participant, in display order.
// aboutPartnerRefs is the classification result (which fear refs are about the
// partner); pass [] before it's known.
export function deriveShareableItems(
  data: Record<string, unknown>,
  aboutPartnerRefs: string[] = []
): ShareItem[] {
  const goals = result<BalancedGoalsResult>(data, "4.3", "balanced-goals");
  const hopesFears = result<HopesFearsResult>(data, "3.5", "hopes-fears");
  const week = result<WeekShapeResult>(data, "4.6", "week-shape");
  const day = result<DayBuilderResult>(data, "1.day", "day-builder");
  const readiness = result<ReadinessSnapshotResult>(
    data,
    "4.1",
    "readiness-snapshot"
  );
  const firstYear = result<FirstYearResult>(data, "4.7", "first-year");
  const valuesTriage = result<ValueTriageResult>(data, "3.2", "value-triage");
  const strengths = result<MirrorCardsResult>(data, "3.1", "mirror-cards");
  const tradeOffs = result<TradeOffsResult>(data, "4.5", "trade-offs");

  const items: ShareItem[] = [];
  const seen = new Set<string>();
  const aboutPartner = new Set(aboutPartnerRefs);

  // --- Your plan ---------------------------------------------------------
  if (week || day) {
    items.push({
      ref: "plan:rhythm",
      group: "plan",
      label: "Your days and rhythm — the shape of your week",
      defaultOn: true,
    });
    seen.add("plan:rhythm");
  }
  if (goals) {
    for (const g of goals.goals) {
      if (!g.label?.trim()) continue;
      items.push({
        ref: slugRef("goal", g.label, seen),
        group: "plan",
        label: g.label,
        defaultOn: true,
      });
    }
  }
  if (hasTravelSignal(goals, firstYear)) {
    items.push({
      ref: "plan:travel",
      group: "plan",
      label: "Travel — your plans for trips and time away",
      defaultOn: true,
    });
    seen.add("plan:travel");
  }
  if (readiness) {
    items.push({
      ref: "plan:leaving-work",
      group: "plan",
      label: "Leaving work — when and how you'll step back",
      defaultOn: true,
    });
    seen.add("plan:leaving-work");
  }

  // --- Your values (the core few) ----------------------------------------
  if (valuesTriage) {
    for (const label of valuesTriage.core) {
      if (!label?.trim()) continue;
      items.push({
        ref: slugRef("value", label, seen),
        group: "values",
        label,
        defaultOn: true,
      });
    }
  }

  // --- Your strengths (the signature few) --------------------------------
  if (strengths) {
    for (const label of strengths.starred) {
      if (!label?.trim()) continue;
      items.push({
        ref: slugRef("strength", label, seen),
        group: "strengths",
        label,
        defaultOn: true,
      });
    }
  }

  // --- Your hopes --------------------------------------------------------
  if (hopesFears?.hopes?.trim()) {
    items.push({
      ref: "hope:main",
      group: "hopes",
      label: hopesFears.hopes.trim(),
      defaultOn: true,
    });
    seen.add("hope:main");
  }

  // --- Your fears (only the live ones; "not-me" reactions are dropped) ----
  if (hopesFears) {
    for (const f of hopesFears.fears) {
      if (f.reaction === "not-me" || !f.label?.trim()) continue;
      const ref = slugRef("fear", f.label, seen);
      const isAboutPartner = aboutPartner.has(ref);
      items.push({
        ref,
        group: "fears",
        label: f.label,
        defaultOn: !isAboutPartner,
        aboutPartner: isAboutPartner,
      });
    }
  }

  // --- Your principles (how you'll decide when things compete) -----------
  if (tradeOffs) {
    for (const p of tradeOffs.principles) {
      if (!p?.trim()) continue;
      items.push({
        ref: slugRef("principle", p, seen),
        group: "principles",
        label: p,
        defaultOn: true,
      });
    }
  }

  return items;
}

// The refs that start switched on — the default selection for a first visit.
export function defaultSharedRefs(items: ShareItem[]): string[] {
  return items.filter((i) => i.defaultOn).map((i) => i.ref);
}

// Just the fear items, for classification (ref + label).
export function fearItems(items: ShareItem[]): { ref: string; label: string }[] {
  return items
    .filter((i) => i.group === "fears")
    .map((i) => ({ ref: i.ref, label: i.label }));
}
