"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type {
  BalancedGoalsResult,
  ReadinessSnapshotResult,
  SlidersResult,
  WeekShapeInteraction,
  WeekShapeResult,
} from "@/lib/modules";
import {
  fallbackWeekShape,
  fetchWeekShapeDraft,
  transitionShape,
  weekShapeGoalInputs,
  FREQUENCIES,
  type WeekShapeSeed,
} from "@/lib/weekShapeSeed";
import { useUserData } from "@/lib/userData";
import { resolveSeedItems } from "@/lib/contextResolver";
import { recurringSeedFromFacts } from "@/lib/resolverInputs";
import { FinishControls, HelperLine, type EditableProps } from "./InteractionShell";

// One activity on the curation surface — a real, recurring thing in the week, with
// a rough frequency, whether it's a regular anchor, whether it gives them energy,
// and whether it's an ongoing-work commitment they plan around (fixed) or one they
// added (own). No day of the week, no time of day — that precision is false this
// far out.
type ActivityRow = {
  id: string;
  label: string;
  category?: string;
  frequency: string;
  anchor: boolean;
  energy: boolean;
  fixed: boolean;
  own: boolean;
};

// A short description of the overall feel, for the coach-facing summary.
function structureText(n: number): string {
  if (n <= 38) return "leans towards a structured week with firm anchors";
  if (n >= 62) return "leans towards an open, largely unplanned week";
  return "a blend of structure and open time";
}

const FREQ_WEIGHT: Record<string, number> = {
  "Most days": 3,
  "A few times a week": 2,
  Weekly: 1,
  "Now and then": 0.5,
};

function isSocial(category?: string): boolean {
  const c = (category ?? "").toLowerCase();
  return (
    c.includes("people") ||
    c.includes("connect") ||
    c.includes("social") ||
    c.includes("family") ||
    c.includes("friend") ||
    c.includes("partner")
  );
}

// A light read of the overall texture — full vs spacious, sociable vs quiet — from
// the structure slider and the mix of activities. Updates live as they adjust.
function textureRead(structure: number, activities: ActivityRow[]): string {
  const named = activities.filter((a) => a.label.trim());
  if (named.length === 0) {
    return "Add a few things to see the feel of your week take shape.";
  }
  const load = named.reduce((s, a) => s + (FREQ_WEIGHT[a.frequency] ?? 1), 0);
  const social = named.filter((a) => isSocial(a.category)).length;
  const anchors = named.filter((a) => a.anchor || a.fixed).length;
  const open = structure >= 62;
  const tight = structure <= 38;

  let fullness: string;
  if (load >= 13 || (tight && load >= 9)) fullness = "A full, active week";
  else if (load <= 6 || (open && load <= 9)) fullness = "A spacious, open week";
  else fullness = "A week with a steady balance of full and open";

  const ratio = social / named.length;
  let company: string;
  if (ratio >= 0.4) company = "sociable, with plenty of people in it";
  else if (ratio <= 0.15) company = "mostly quiet and independent";
  else company = "a mix of company and quiet";

  const anchorPhrase =
    anchors === 0
      ? "and almost nothing locked down — most of it stays loose"
      : anchors === 1
        ? "with one regular anchor and the rest kept loose"
        : `with ${anchors} regular anchors and the rest kept loose`;

  return `${fullness}, ${company}, ${anchorPhrase}.`;
}

// Map a stored result's activities back to rows (shared by the summary helpers).
function rowsFromResult(result: WeekShapeResult): ActivityRow[] {
  return (result.activities ?? []).map((a, i) => ({
    id: `a${i}`,
    label: a.label,
    ...(a.category ? { category: a.category } : {}),
    frequency: a.frequency || "Weekly",
    anchor: !!a.anchor,
    energy: !!a.energy,
    fixed: !!a.fixed,
    own: !!a.own,
  }));
}

// The coach-facing summary — the character of the week they shaped, so Vita can
// reflect the rhythm back (full/spacious, sociable/quiet, the anchors, what gives
// energy) and help stress-test it. Vita is told not to recite it back item by item.
export function weekShapeSummaryText(result: WeekShapeResult): string {
  const label = result.summaryLabel ?? "The rhythm of your week";
  const rows = rowsFromResult(result);
  const texture = textureRead(result.structure, rows);
  const anchors = rows.filter((a) => a.anchor || a.fixed);
  const energy = rows.filter((a) => a.energy);
  const work = rows.filter((a) => a.fixed);
  const freqGroups = FREQUENCIES.map((f) => ({
    f,
    items: rows.filter((a) => a.frequency === f),
  })).filter((g) => g.items.length > 0);

  const parts = [
    `Overall feel: ${structureText(result.structure)}.`,
    `Texture: ${texture}`,
    anchors.length
      ? `Regular anchors: ${anchors
          .map((a) => `${a.label} (${a.frequency.toLowerCase()})`)
          .join(", ")}.`
      : "No fixed anchors — the week stays loose.",
    freqGroups.length
      ? `${freqGroups
          .map((g) => `${g.f}: ${g.items.map((a) => a.label).join(", ")}`)
          .join(". ")}.`
      : "",
    energy.length
      ? `Gives them energy: ${energy.map((a) => a.label).join(", ")}.`
      : "",
    work.length
      ? `Planning the week around ongoing work: ${work.map((a) => a.label).join(", ")}.`
      : "",
  ].filter(Boolean);

  return `${label}. ${parts.join(" ")}`;
}

function makeFreshActivities(seed: WeekShapeSeed): ActivityRow[] {
  return seed.activities.map((a, i) => ({
    id: `a${i}`,
    label: a.label,
    ...(a.category ? { category: a.category } : {}),
    frequency: a.frequency || "Weekly",
    anchor: !!a.anchor,
    energy: !!a.energy,
    fixed: !!a.fixed,
    own: false,
  }));
}

// Rebuild the editor state from a saved result, preserving every choice they set.
function stateFromResult(result: WeekShapeResult): {
  structure: number;
  activities: ActivityRow[];
} {
  return {
    structure: typeof result.structure === "number" ? result.structure : 50,
    activities: rowsFromResult(result),
  };
}

type WeekShapeProps = {
  interaction: WeekShapeInteraction;
  sessionId: string;
  // The rendered user-model block and onboarding line — input for the draft.
  // hasPartner filters partner-only framing.
  userModelText: string;
  onboardingContext: string;
  hasPartner: boolean;
  onFinish: (result: WeekShapeResult) => void;
} & EditableProps<WeekShapeResult>;

export default function WeekShape({
  interaction,
  sessionId,
  userModelText,
  onboardingContext,
  hasPartner,
  onFinish,
  mode = "create",
  initial,
  onCancel,
}: WeekShapeProps) {
  const {
    draftingLabel,
    curationInstruction,
    structureLabel,
    structurePoleLeft,
    structurePoleRight,
    structureHint,
    structureFromEarlierHint,
    activitiesLabel,
    activitiesInstruction,
    frequencyLabel,
    anchorLabel,
    energyLabel,
    addActivityLabel,
    activityPlaceholder,
    textureLabel,
    boundaryHint,
    summaryLabel,
  } = interaction;

  const userData = useUserData();

  // The inputs the draft is built from, read once. Goals add grounding; the
  // transition decides whether ongoing work belongs; the recurring activities —
  // the person's real, specific recurring things — now come from structured
  // recurring_activity facts (the canonical profile), not a transcript scrape.
  const draftInputsRef = useRef({
    goals: weekShapeGoalInputs(
      (userData.getBuild("4.3") as BalancedGoalsResult | null) ?? null
    ),
    transition: transitionShape(
      (userData.getBuild("4.1") as ReadinessSnapshotResult | null) ?? null
    ),
    recurring: recurringSeedFromFacts(
      resolveSeedItems(sessionId, userData.getActiveFacts(), "recurring_activity")
    ),
  });
  const draftInputs = draftInputsRef.current;

  // Where they placed their ideal week back in Stage 1 (the routine↔spontaneity
  // slider). 0 = lots of routine (structured), 100 = lots of spontaneity (open) —
  // the same axis as this module's slider, so the week starts where they left it.
  const [earlierStructure] = useState<number | null>(() => {
    const sliders = userData.getBuild("1.week") as SlidersResult | null;
    const spectrum = sliders?.spectrums?.find((s) => /routine/i.test(s.left));
    return spectrum && typeof spectrum.position === "number"
      ? Math.max(0, Math.min(100, Math.round(spectrum.position)))
      : null;
  });

  // Editing reopens straight onto the curation view from the saved result; a
  // fresh run uses any cached draft, or fetches one (the "loading" phase).
  const cachedSeed = initial ? null : userData.getWeekShapeSeed(sessionId);

  const [phase, setPhase] = useState<"loading" | "curate">(
    initial || cachedSeed ? "curate" : "loading"
  );

  const initialState = initial
    ? stateFromResult(initial)
    : cachedSeed
      ? {
          structure: earlierStructure ?? cachedSeed.structure,
          activities: makeFreshActivities(cachedSeed),
        }
      : { structure: earlierStructure ?? 50, activities: [] };

  const [structure, setStructure] = useState<number>(initialState.structure);
  const [activities, setActivities] = useState<ActivityRow[]>(
    initialState.activities
  );

  // Draft once, the first time a fresh run has no cached draft.
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (phase !== "loading" || fetchedRef.current) return;
    fetchedRef.current = true;
    let cancelled = false;
    (async () => {
      // A prefetch started during the intro may have already landed in the cache.
      const cached = userData.getWeekShapeSeed(sessionId);
      const draft =
        cached ??
        (await fetchWeekShapeDraft({
          userModel: userModelText,
          onboarding: onboardingContext,
          hasPartner,
          retirementStage: userData.getRetirementStage(),
          goals: draftInputs.goals,
          transition: draftInputs.transition,
          recurring: draftInputs.recurring,
        }));
      if (cancelled) return;
      const seed =
        draft ??
        fallbackWeekShape({
          userModel: userModelText,
          onboarding: onboardingContext,
          hasPartner,
          retirementStage: userData.getRetirementStage(),
          goals: draftInputs.goals,
          transition: draftInputs.transition,
          recurring: draftInputs.recurring,
        });
      if (draft && !cached) void userData.saveWeekShapeSeed(sessionId, draft);
      setStructure(earlierStructure ?? seed.structure);
      setActivities(makeFreshActivities(seed));
      setPhase("curate");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Monotonic counter for ids of activities the person adds.
  const nextIdRef = useRef(0);
  const makeId = () => `a-added-${nextIdRef.current++}`;

  function patchActivity(id: string, patch: Partial<ActivityRow>) {
    setActivities((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...patch } : a))
    );
  }
  function removeActivity(id: string) {
    setActivities((prev) => prev.filter((a) => a.id !== id));
  }
  function addActivity() {
    setActivities((prev) => [
      ...prev,
      {
        id: makeId(),
        label: "",
        frequency: "Weekly",
        anchor: false,
        energy: false,
        fixed: false,
        own: true,
      },
    ]);
  }

  function buildResultObject(): WeekShapeResult {
    return {
      type: "week-shape",
      structure,
      activities: activities
        .filter((a) => a.label.trim())
        .map((a) => ({
          label: a.label.trim(),
          ...(a.category ? { category: a.category } : {}),
          frequency: a.frequency || "Weekly",
          ...(a.anchor ? { anchor: true } : {}),
          ...(a.energy ? { energy: true } : {}),
          ...(a.fixed ? { fixed: true } : {}),
          ...(a.own ? { own: true } : {}),
        })),
      summaryLabel,
    };
  }

  if (phase === "loading") {
    return (
      <section style={styles.wrap}>
        <style>{weekCss}</style>
        <div style={styles.draftCard}>
          <span style={styles.draftSun} aria-hidden="true">
            🗓️
          </span>
          <p style={styles.draftText}>{draftingLabel}</p>
        </div>
      </section>
    );
  }

  const named = activities.filter((a) => a.label.trim());

  return (
    <section style={styles.wrap}>
      <style>{weekCss}</style>

      <p style={styles.instruction}>{curationInstruction}</p>

      {/* 1 — the overall structure–freedom feel */}
      <div style={styles.block}>
        <p style={styles.sectionLabel}>{structureLabel}</p>
        <HelperLine>Drag the slider to where it feels right.</HelperLine>
        <div style={styles.sliderWrap}>
          <div style={styles.poleRow}>
            <span style={styles.poleLabel}>{structurePoleLeft}</span>
            <span style={{ ...styles.poleLabel, textAlign: "right" }}>
              {structurePoleRight}
            </span>
          </div>
          <input
            type="range"
            className="week-slider rlp-slider"
            min={0}
            max={100}
            step={1}
            value={structure}
            aria-label={`Balance between ${structurePoleLeft} and ${structurePoleRight}`}
            onChange={(e) => setStructure(Number(e.target.value))}
          />
          <p style={styles.leanHint}>{structureHint}</p>
          {earlierStructure !== null && !initial && (
            <p style={styles.earlierHint}>{structureFromEarlierHint}</p>
          )}
        </div>
      </div>

      {/* 2 — the real recurring activities */}
      <div style={styles.block}>
        <p style={styles.sectionLabel}>{activitiesLabel}</p>
        <p style={styles.subInstruction}>{activitiesInstruction}</p>
        <HelperLine>
          Tap to set how often each one happens, and mark the anchors and the ones
          that give you energy.
        </HelperLine>
        <div style={styles.blockList}>
          {activities.map((a) => (
            <ActivityCard
              key={a.id}
              activity={a}
              frequencyLabel={frequencyLabel}
              anchorLabel={anchorLabel}
              energyLabel={energyLabel}
              activityPlaceholder={activityPlaceholder}
              onLabel={(v) => patchActivity(a.id, { label: v })}
              onFrequency={(v) => patchActivity(a.id, { frequency: v })}
              onAnchor={() => patchActivity(a.id, { anchor: !a.anchor })}
              onEnergy={() => patchActivity(a.id, { energy: !a.energy })}
              onRemove={() => removeActivity(a.id)}
            />
          ))}
          <button
            type="button"
            className="week-add"
            style={styles.addBtn}
            onClick={addActivity}
          >
            <span aria-hidden="true" style={styles.addPlus}>
              +
            </span>
            {addActivityLabel}
          </button>
        </div>
      </div>

      {/* 3 — the light read of the overall texture */}
      <div style={styles.block}>
        <p style={styles.sectionLabel}>{textureLabel}</p>
        <div style={styles.textureCard}>
          <p style={styles.textureText}>{textureRead(structure, named)}</p>
        </div>
      </div>

      <p style={styles.boundaryHint}>{boundaryHint}</p>

      <FinishControls
        mode={mode}
        disabled={false}
        onFinish={() => onFinish(buildResultObject())}
        onCancel={onCancel}
      />
    </section>
  );
}

// ---- one activity on the curation surface ----
function ActivityCard({
  activity,
  frequencyLabel,
  anchorLabel,
  energyLabel,
  activityPlaceholder,
  onLabel,
  onFrequency,
  onAnchor,
  onEnergy,
  onRemove,
}: {
  activity: ActivityRow;
  frequencyLabel: string;
  anchorLabel: string;
  energyLabel: string;
  activityPlaceholder: string;
  onLabel: (v: string) => void;
  onFrequency: (v: string) => void;
  onAnchor: () => void;
  onEnergy: () => void;
  onRemove: () => void;
}) {
  return (
    <div style={styles.blockCard}>
      <div style={styles.blockHead}>
        <AutoTextarea
          className="week-input"
          style={styles.blockLabelInput}
          minRows={1}
          value={activity.label}
          ariaLabel="What this is"
          placeholder={activityPlaceholder}
          autoFocus={activity.label === ""}
          onChange={onLabel}
        />
        {activity.fixed ? (
          <span style={styles.workTag}>work</span>
        ) : (
          <button
            type="button"
            className="week-remove"
            style={styles.removeBtn}
            aria-label="Remove"
            onClick={onRemove}
          >
            ✕
          </button>
        )}
      </div>

      <div style={styles.chooser}>
        <span style={styles.chooserLabel}>{frequencyLabel}</span>
        <div style={styles.pillRow}>
          {FREQUENCIES.map((freq) => {
            const on = activity.frequency === freq;
            return (
              <button
                key={freq}
                type="button"
                className="week-pill rlp-chip"
                style={{
                  ...styles.pill,
                  ...(on ? styles.pillOn : null),
                }}
                aria-pressed={on}
                onClick={() => onFrequency(freq)}
              >
                {freq}
              </button>
            );
          })}
        </div>
      </div>

      <div style={styles.toggleRow}>
        {!activity.fixed && (
          <button
            type="button"
            className="week-anchor rlp-chip"
            style={{
              ...styles.toggleBtn,
              ...(activity.anchor ? styles.anchorBtnOn : null),
            }}
            aria-pressed={activity.anchor}
            onClick={onAnchor}
          >
            <span aria-hidden="true">📌</span> {anchorLabel}
          </button>
        )}
        <button
          type="button"
          className="week-energy rlp-chip"
          style={{
            ...styles.toggleBtn,
            ...(activity.energy ? styles.energyBtnOn : null),
          }}
          aria-pressed={activity.energy}
          onClick={onEnergy}
        >
          <span aria-hidden="true">⚡</span> {energyLabel}
        </button>
      </div>
    </div>
  );
}

// A textarea that grows to fit its content, so wrapped lines are never clipped.
function AutoTextarea({
  value,
  onChange,
  className,
  style,
  placeholder,
  ariaLabel,
  autoFocus,
  minRows = 1,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  style?: CSSProperties;
  placeholder?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      className={className}
      style={{ ...style, overflow: "hidden", resize: "none" }}
      rows={minRows}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    paddingTop: "36px",
    marginTop: "8px",
    borderTop: "1px solid var(--border)",
  },
  draftCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    padding: "32px 24px",
    background: "var(--warm-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    textAlign: "center",
  },
  draftSun: { fontSize: "28px" },
  draftText: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-h3)",
    fontWeight: 500,
    color: "var(--ink)",
    margin: 0,
  },
  instruction: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--text-muted)",
    margin: 0,
  },
  block: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  sectionLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    margin: 0,
  },
  subInstruction: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    lineHeight: "var(--lh-body)",
    color: "var(--text-muted)",
    margin: "-4px 0 4px",
  },
  sliderWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  poleRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
  },
  poleLabel: {
    flex: 1,
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--ink)",
  },
  leanHint: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-xs)",
    color: "var(--text-muted)",
    textAlign: "center",
    margin: 0,
  },
  earlierHint: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-xs)",
    color: "var(--ink)",
    background: "var(--warm-surface)",
    borderRadius: "var(--r-sm)",
    padding: "8px 12px",
    textAlign: "center",
    margin: "6px 0 0",
  },
  blockList: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  blockCard: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "16px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    boxShadow: "var(--shadow-sm)",
  },
  blockHead: {
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
  },
  blockLabelInput: {
    flex: 1,
    padding: "8px 12px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    lineHeight: "var(--lh-body)",
    color: "var(--ink)",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    boxSizing: "border-box",
  },
  workTag: {
    flexShrink: 0,
    marginTop: "8px",
    padding: "2px 10px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-xs)",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "var(--text-muted)",
    background: "var(--muted-surface)",
    borderRadius: "var(--r-pill)",
  },
  removeBtn: {
    flexShrink: 0,
    width: "34px",
    height: "34px",
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    cursor: "pointer",
  },
  chooser: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  chooserLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-xs)",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "var(--text-muted)",
  },
  pillRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },
  pill: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-pill)",
    padding: "5px 11px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--text-muted)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  pillOn: {
    background: "var(--brand-primary)",
    border: "1px solid var(--brand-primary)",
    color: "var(--brand-on-primary)",
  },
  toggleRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  toggleBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-pill)",
    padding: "6px 14px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--text-muted)",
    cursor: "pointer",
  },
  anchorBtnOn: {
    background: "var(--brand-primary)",
    border: "1px solid var(--brand-primary)",
    color: "var(--brand-on-primary)",
  },
  energyBtnOn: {
    background: "var(--accent-strong)",
    border: "1px solid var(--accent-strong)",
    color: "var(--brand-on-primary)",
  },
  addBtn: {
    alignSelf: "flex-start",
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    background: "var(--bg)",
    border: "1px dashed var(--brand-primary)",
    borderRadius: "var(--r-pill)",
    padding: "8px 16px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--brand-primary)",
    cursor: "pointer",
  },
  addPlus: {
    fontWeight: 700,
    color: "var(--brand-primary)",
  },
  textureCard: {
    background: "var(--warm-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "16px 18px",
  },
  textureText: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--ink)",
    margin: 0,
  },
  boundaryHint: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--ink)",
    background: "var(--warm-surface)",
    borderRadius: "var(--r-sm)",
    padding: "12px 16px",
    margin: 0,
  },
};

// Read-only recap shown above Vita's first message and kept visible through the
// conversation — the overall feel, the texture read, the recurring activities with
// their frequency and anchors, and what gives them energy. The neutral card
// wrapper is the caller's.
export function WeekShapeSummary({ result }: { result: WeekShapeResult }) {
  const rows = rowsFromResult(result);
  const energy = rows.filter((a) => a.energy);

  return (
    <>
      <p style={summaryStyles.heading}>{result.summaryLabel}</p>

      <div style={summaryStyles.feelTrack}>
        <span style={summaryStyles.feelPole}>Structured</span>
        <span style={summaryStyles.feelBar}>
          <span
            style={{
              ...summaryStyles.feelDot,
              left: `calc(${Math.max(0, Math.min(100, result.structure))}% - 5px)`,
            }}
          />
        </span>
        <span style={{ ...summaryStyles.feelPole, textAlign: "right" }}>
          Open
        </span>
      </div>

      <p style={summaryStyles.texture}>{textureRead(result.structure, rows)}</p>

      <div style={summaryStyles.list}>
        {rows.map((a) => (
          <div key={a.id} style={summaryStyles.listRow}>
            <span style={summaryStyles.listLabel}>
              {(a.anchor || a.fixed) && (
                <span aria-hidden="true" style={summaryStyles.anchorMark}>
                  📌
                </span>
              )}
              {a.energy && (
                <span aria-hidden="true" style={summaryStyles.boltMark}>
                  ⚡
                </span>
              )}
              {a.label}
            </span>
            <span style={summaryStyles.listFreq}>{a.frequency}</span>
          </div>
        ))}
      </div>

      {energy.length > 0 && (
        <p style={summaryStyles.energyLine}>
          <span style={summaryStyles.energyKey}>Gives you energy:</span>{" "}
          {energy.map((a) => a.label).join(", ")}
        </p>
      )}
    </>
  );
}

const summaryStyles: Record<string, React.CSSProperties> = {
  heading: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--ink)",
    margin: "0 0 16px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  feelTrack: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "12px",
  },
  feelPole: {
    flex: "0 0 70px",
    fontFamily: "var(--font-sans)",
    fontSize: "12px",
    color: "var(--text-muted)",
  },
  feelBar: {
    position: "relative",
    flex: 1,
    height: "4px",
    borderRadius: "2px",
    background: "var(--muted-surface)",
  },
  feelDot: {
    position: "absolute",
    top: "-3px",
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "var(--brand-primary)",
  },
  texture: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--ink)",
    margin: "0 0 16px",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    marginBottom: "12px",
  },
  listRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: "12px",
    padding: "7px 0",
    borderBottom: "1px solid var(--border)",
  },
  listLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text)",
  },
  anchorMark: { fontSize: "11px" },
  boltMark: { fontSize: "11px" },
  listFreq: {
    flexShrink: 0,
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-xs)",
    color: "var(--text-muted)",
  },
  energyLine: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text)",
    margin: 0,
  },
  energyKey: {
    fontWeight: 600,
    color: "var(--ink)",
  },
};

const weekCss = `
  .week-pill:focus-visible, .week-remove:focus-visible,
  .week-energy:focus-visible, .week-anchor:focus-visible,
  .week-add:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .week-pill[aria-pressed="false"]:hover { border-color: var(--brand-primary); }
  .week-energy[aria-pressed="false"]:hover { border-color: var(--brand-primary); }
  .week-anchor[aria-pressed="false"]:hover { border-color: var(--brand-primary); }
  .week-remove:hover { border-color: var(--brand-primary); }
  .week-add:hover { background: var(--brand-primary-tint); }
  .week-input:focus-visible {
    outline: none;
    border-color: var(--brand-primary);
    box-shadow: var(--focus-ring);
  }
  .week-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--muted-surface);
    outline: none;
    cursor: pointer;
  }
  .week-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--brand-primary);
    border: 2px solid var(--bg);
    box-shadow: var(--shadow-sm);
    cursor: pointer;
  }
  .week-slider::-moz-range-thumb {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--brand-primary);
    border: 2px solid var(--bg);
    box-shadow: var(--shadow-sm);
    cursor: pointer;
  }
  .week-slider:focus-visible { box-shadow: var(--focus-ring); }
`;
