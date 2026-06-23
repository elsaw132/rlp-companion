"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import type {
  BalancedGoalsResult,
  FirstYearInteraction,
  FirstYearResult,
  ReadinessSnapshotResult,
  SeasonsBoardResult,
  WeekShapeResult,
} from "@/lib/modules";
import {
  fallbackFirstYear,
  fetchFirstYearDraft,
  fetchFirstYearChat,
  firstYearGoalInputs,
  firstYearRhythmInputs,
  firstYearSeasonInputs,
  transitionShape,
  SEASON_IDS,
  ALL_YEAR,
  type FirstYearItemSeed,
  type FirstYearKind,
} from "@/lib/firstYearSeed";
import { useUserData } from "@/lib/userData";
import { HelperLine } from "./InteractionShell";

// One item on the timeline. `season` is one of the four phase ids or ALL_YEAR;
// `top` is a headline moment; `fixed` is the ongoing-work footprint; `own` marks
// ones added during editing.
type ItemRow = {
  id: string;
  label: string;
  kind: FirstYearKind;
  season: string;
  top: boolean;
  note?: string;
  fixed: boolean;
  own: boolean;
};

type ChatMsg = { role: "coach" | "user"; text: string };

// Fallback phase names for the read-only recap, which has no interaction config.
const SEASON_LABEL: Record<string, string> = {
  s1: "The opening months",
  s2: "Settling in",
  s3: "Well into the year",
  s4: "Closing the year",
};

let rowSeq = 0;
function toRows(items: FirstYearItemSeed[]): ItemRow[] {
  return items.map((it) => ({
    id: `r${rowSeq++}`,
    label: it.label,
    kind: it.kind,
    season: it.season || ALL_YEAR,
    top: !!it.top,
    ...(it.note ? { note: it.note } : {}),
    fixed: !!it.fixed,
    own: false,
  }));
}

function rowsToSeeds(rows: ItemRow[]): FirstYearItemSeed[] {
  return rows
    .filter((r) => r.label.trim())
    .map((r) => ({
      label: r.label.trim(),
      kind: r.kind,
      season: r.season,
      ...(r.top ? { top: true } : {}),
      ...(r.note ? { note: r.note } : {}),
      ...(r.fixed ? { fixed: true } : {}),
    }));
}

function rowsFromResult(result: FirstYearResult): ItemRow[] {
  return toRows(
    (result.items ?? []).map((it) => ({
      label: it.label,
      kind: it.kind,
      season: it.season,
      ...(it.top ? { top: true } : {}),
      ...(it.note ? { note: it.note } : {}),
      ...(it.fixed ? { fixed: true } : {}),
    }))
  );
}

// The coach-facing summary used for the takeaway — the story plus the sequenced
// arc, so the record reads as their year.
export function firstYearSummaryText(result: FirstYearResult): string {
  const label = result.summaryLabel ?? "Your first year";
  const items = result.items ?? [];
  const phaseLine = SEASON_IDS.map((id) => {
    const inPhase = items.filter((i) => i.season === id && i.kind !== "work");
    if (!inPhase.length) return "";
    const names = inPhase
      .map((i) => `${i.label}${i.top ? " (headline)" : ""}`)
      .join(", ");
    return `${SEASON_LABEL[id]}: ${names}.`;
  }).filter(Boolean);
  const allYear = items.filter(
    (i) => i.season === ALL_YEAR && i.kind !== "work"
  );
  const work = items.filter((i) => i.kind === "work" || i.fixed);

  const parts = [
    result.narrative ? `Their story of the year: ${result.narrative}` : "",
    ...phaseLine,
    allYear.length
      ? `Running all year: ${allYear.map((i) => i.label).join(", ")}.`
      : "",
    work.length
      ? `Ongoing work across the year: ${work.map((i) => i.label).join(", ")}.`
      : "A clean break from work — year one is fully their own.",
  ].filter(Boolean);

  return `${label}. ${parts.join(" ")}`;
}

// ---- the visible timeline (interactive on the surface, read-only in the recap) ----
function YearTimeline({
  items,
  seasons,
  allYearLabel,
  workLaneLabel,
  noWorkLabel,
  topLabel,
  interactive,
  onMove,
  onToggleTop,
  onRemove,
}: {
  items: ItemRow[];
  seasons: { id: string; label: string }[];
  allYearLabel: string;
  workLaneLabel: string;
  noWorkLabel: string;
  topLabel: string;
  interactive: boolean;
  onMove?: (id: string, season: string) => void;
  onToggleTop?: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  const dragId = useRef<string | null>(null);
  const [overSeason, setOverSeason] = useState<string | null>(null);

  const work = items.filter((i) => i.kind === "work" || i.fixed);
  const phaseItems = (sid: string) =>
    items.filter((i) => i.season === sid && !(i.kind === "work" || i.fixed));

  function handleDrop(e: DragEvent, season: string) {
    e.preventDefault();
    const id = dragId.current || e.dataTransfer.getData("text/plain");
    dragId.current = null;
    setOverSeason(null);
    if (id && onMove) onMove(id, season);
  }
  function allowDrop(e: DragEvent, season: string) {
    if (!interactive) return;
    e.preventDefault();
    if (overSeason !== season) setOverSeason(season);
  }

  function chip(it: ItemRow) {
    return (
      <div
        key={it.id}
        style={{
          ...styles.chip,
          ...(it.top ? styles.chipTop : null),
          ...(interactive ? styles.chipDraggable : null),
        }}
        draggable={interactive && !it.fixed}
        onDragStart={(e) => {
          dragId.current = it.id;
          e.dataTransfer.setData("text/plain", it.id);
          e.dataTransfer.effectAllowed = "move";
        }}
      >
        <span style={styles.chipBody}>
          {it.top && (
            <span aria-hidden="true" style={styles.chipStar}>
              ★
            </span>
          )}
          {it.kind === "trip" && (
            <span aria-hidden="true" style={styles.chipPlane}>
              ✈
            </span>
          )}
          <span style={styles.chipLabel}>{it.label}</span>
        </span>
        {interactive && (
          <span style={styles.chipTools}>
            <button
              type="button"
              className="fy-chip-btn"
              style={{
                ...styles.chipBtn,
                ...(it.top ? styles.chipBtnStarOn : null),
              }}
              aria-pressed={it.top}
              aria-label={topLabel}
              title={topLabel}
              onClick={() => onToggleTop?.(it.id)}
            >
              ★
            </button>
            <button
              type="button"
              className="fy-chip-btn"
              style={styles.chipBtn}
              aria-label="Remove"
              title="Remove"
              onClick={() => onRemove?.(it.id)}
            >
              ✕
            </button>
          </span>
        )}
      </div>
    );
  }

  return (
    <div style={styles.timeline}>
      <div style={styles.phases}>
        {seasons.map((s) => {
          const its = phaseItems(s.id);
          return (
            <div
              key={s.id}
              style={{
                ...styles.phaseCol,
                ...(overSeason === s.id ? styles.phaseColOver : null),
              }}
              onDragOver={(e) => allowDrop(e, s.id)}
              onDragLeave={() =>
                setOverSeason((cur) => (cur === s.id ? null : cur))
              }
              onDrop={(e) => handleDrop(e, s.id)}
            >
              <div style={styles.phaseHead}>{s.label}</div>
              <div style={styles.phaseBody}>
                {its.length ? (
                  its.map(chip)
                ) : (
                  <span style={styles.phaseEmpty}>—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          ...styles.allYear,
          ...(overSeason === ALL_YEAR ? styles.phaseColOver : null),
        }}
        onDragOver={(e) => allowDrop(e, ALL_YEAR)}
        onDragLeave={() =>
          setOverSeason((cur) => (cur === ALL_YEAR ? null : cur))
        }
        onDrop={(e) => handleDrop(e, ALL_YEAR)}
      >
        <span style={styles.allYearLabel}>{allYearLabel}</span>
        <div style={styles.allYearItems}>
          {phaseItems(ALL_YEAR).length ? (
            phaseItems(ALL_YEAR).map(chip)
          ) : (
            <span style={styles.phaseEmpty}>—</span>
          )}
        </div>
      </div>

      <div style={styles.workBand}>
        <span style={styles.workBandLabel}>{workLaneLabel}</span>
        {work.length ? (
          <div style={styles.workTrack}>
            {seasons.map((s) => {
              const covered = work.some(
                (w) => w.season === ALL_YEAR || w.season === s.id
              );
              return (
                <div
                  key={s.id}
                  style={{
                    ...styles.workSeg,
                    ...(covered ? styles.workSegOn : null),
                  }}
                />
              );
            })}
          </div>
        ) : (
          <div style={styles.workTrack}>
            <div style={styles.workNone}>{noWorkLabel}</div>
          </div>
        )}
        {work.length > 0 && (
          <span style={styles.workCaption}>
            {work.map((w) => w.label).join(" · ")}
          </span>
        )}
      </div>
    </div>
  );
}

type FirstYearJourneyProps = {
  interaction: FirstYearInteraction;
  sessionId: string;
  userModelText: string;
  onboardingContext: string;
  hasPartner: boolean;
  sessionInstructions: string;
  onComplete: (
    result: FirstYearResult,
    vitaMessage: string,
    finalMessages: ChatMsg[]
  ) => void;
};

export default function FirstYearJourney({
  interaction,
  sessionId,
  userModelText,
  onboardingContext,
  hasPartner,
  sessionInstructions,
  onComplete,
}: FirstYearJourneyProps) {
  const {
    draftingLabel,
    seasons,
    allYearLabel,
    workLaneLabel,
    noWorkLabel,
    narrativeLabel,
    introMessage,
    reshapeHint,
    chatPlaceholder,
    topLabel,
    finishLabel,
    closingAck,
    boundaryHint,
    summaryLabel,
  } = interaction;

  const userData = useUserData();

  const draftInputsRef = useRef(
    (() => {
      const seasonInputs = firstYearSeasonInputs(
        (userData.getBuild("4.2") as SeasonsBoardResult | null) ?? null
      );
      return {
        goals: firstYearGoalInputs(
          (userData.getBuild("4.3") as BalancedGoalsResult | null) ?? null
        ),
        rhythm: firstYearRhythmInputs(
          (userData.getBuild("4.6") as WeekShapeResult | null) ?? null
        ),
        seasonPriorities: seasonInputs.priorities,
        seasonOrder: seasonInputs.seasonOrder,
        transition: transitionShape(
          (userData.getBuild("4.1") as ReadinessSnapshotResult | null) ?? null
        ),
      };
    })()
  );

  const cachedSeed = userData.getFirstYearSeed(sessionId);
  const cachedChat = userData.getFirstYearChat(sessionId);

  const [phase, setPhase] = useState<"loading" | "ready">(
    cachedSeed ? "ready" : "loading"
  );
  const [items, setItems] = useState<ItemRow[]>(
    cachedSeed ? toRows(cachedSeed.items) : []
  );
  const [narrative, setNarrative] = useState<string>(
    cachedSeed?.narrative ?? ""
  );
  const [messages, setMessages] = useState<ChatMsg[]>(
    cachedChat && cachedChat.length
      ? cachedChat
      : [{ role: "coach", text: introMessage }]
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [narrating, setNarrating] = useState(false);
  const [narrativeManual, setNarrativeManual] = useState(false);
  const [editingNarrative, setEditingNarrative] = useState(false);
  const [hydrated, setHydrated] = useState(cachedSeed != null);

  // Keep a live mirror of items so the debounced narrate call sees the latest.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Persist the working timeline + story so a refresh resumes mid-edit.
  useEffect(() => {
    if (!hydrated) return;
    void userData.saveFirstYearSeed(sessionId, {
      items: rowsToSeeds(items),
      narrative,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, narrative, hydrated, sessionId]);

  // Persist the editing chat separately from the module conversation.
  useEffect(() => {
    if (!hydrated) return;
    void userData.saveFirstYearChat(sessionId, messages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, hydrated, sessionId]);

  // Draft once if there's no cached seed.
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (phase !== "loading" || fetchedRef.current) return;
    fetchedRef.current = true;
    let cancelled = false;
    (async () => {
      const di = draftInputsRef.current;
      const cached = userData.getFirstYearSeed(sessionId);
      const input = {
        userModel: userModelText,
        onboarding: onboardingContext,
        hasPartner,
        goals: di.goals,
        rhythm: di.rhythm,
        seasonPriorities: di.seasonPriorities,
        seasonOrder: di.seasonOrder,
        transition: di.transition,
      };
      const draft = cached ?? (await fetchFirstYearDraft(input));
      if (cancelled) return;
      const seed = draft ?? fallbackFirstYear(input);
      if (draft && !cached) void userData.saveFirstYearSeed(sessionId, draft);
      setItems(toRows(seed.items));
      setNarrative(seed.narrative);
      setHydrated(true);
      setPhase("ready");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Rewrite the story to match the timeline after a direct move (debounced),
  // unless the person has taken the wording into their own hands.
  const narrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleNarrate(force = false) {
    if (narrativeManual && !force) return;
    if (narrateTimer.current) clearTimeout(narrateTimer.current);
    narrateTimer.current = setTimeout(() => {
      void (async () => {
        setNarrating(true);
        const res = await fetchFirstYearChat({
          mode: "narrate",
          items: rowsToSeeds(itemsRef.current),
          narrative,
          seasons,
          userModel: userModelText,
          onboarding: onboardingContext,
          sessionInstructions,
        });
        if (res?.narrative) setNarrative(res.narrative);
        setNarrating(false);
      })();
    }, 700);
  }

  function moveItem(id: string, season: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, season } : i))
    );
    scheduleNarrate();
  }
  function toggleTop(id: string) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, top: !i.top } : i))
    );
    scheduleNarrate();
  }
  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    scheduleNarrate();
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    const history = messages;
    const next: ChatMsg[] = [...messages, { role: "user", text }];
    setMessages(next);
    setInput("");
    setSending(true);
    const res = await fetchFirstYearChat({
      mode: "edit",
      items: rowsToSeeds(itemsRef.current),
      narrative,
      seasons,
      userModel: userModelText,
      onboarding: onboardingContext,
      sessionInstructions,
      message: text,
      history,
    });
    if (res) {
      setMessages([...next, { role: "coach", text: res.reply }]);
      if (res.items && res.items.length) {
        setItems(toRows(res.items));
        if (res.narrative) {
          setNarrative(res.narrative);
          setNarrativeManual(false);
        } else {
          // Timeline changed but no story came back — refresh it to match.
          setNarrativeManual(false);
          scheduleNarrate(true);
        }
      }
    } else {
      setMessages([
        ...next,
        {
          role: "coach",
          text: "I didn't quite catch that — could you say it another way?",
        },
      ]);
    }
    setSending(false);
  }

  function finish() {
    const result: FirstYearResult = {
      type: "first-year",
      items: rowsToSeeds(items).map((s, idx) => ({
        ...s,
        ...(items[idx]?.own ? { own: true } : {}),
      })),
      narrative,
      summaryLabel,
    };
    onComplete(result, closingAck, messages);
  }

  if (phase === "loading") {
    return (
      <section style={styles.wrap}>
        <style>{journeyCss}</style>
        <div style={styles.draftCard}>
          <span style={styles.draftSun} aria-hidden="true">
            🗺️
          </span>
          <p style={styles.draftText}>{draftingLabel}</p>
        </div>
      </section>
    );
  }

  return (
    <section style={styles.wrap}>
      <style>{journeyCss}</style>

      <div style={styles.helperGroup}>
        <HelperLine>
          Drag a piece to another phase, or tap a moment to star it.
        </HelperLine>
        <YearTimeline
          items={items}
          seasons={seasons}
          allYearLabel={allYearLabel}
          workLaneLabel={workLaneLabel}
          noWorkLabel={noWorkLabel}
          topLabel={topLabel}
          interactive
          onMove={moveItem}
          onToggleTop={toggleTop}
          onRemove={removeItem}
        />
      </div>

      {/* The story Vita writes from the arc */}
      <div style={styles.narrativeCard}>
        <div style={styles.narrativeHead}>
          <span style={styles.narrativeTitle}>{narrativeLabel}</span>
          {narrating ? (
            <span style={styles.narrativeStatus}>Vita is updating the story…</span>
          ) : (
            <button
              type="button"
              className="fy-text-btn"
              style={styles.textBtn}
              onClick={() => setEditingNarrative((v) => !v)}
            >
              {editingNarrative ? "Done" : "Tweak wording"}
            </button>
          )}
        </div>
        {editingNarrative ? (
          <AutoTextarea
            className="fy-input"
            style={styles.narrativeEdit}
            value={narrative}
            ariaLabel="The story of your year"
            onChange={(v) => {
              setNarrative(v);
              setNarrativeManual(true);
            }}
          />
        ) : (
          <p style={styles.narrativeText}>{narrative}</p>
        )}
        {narrativeManual && !editingNarrative && (
          <button
            type="button"
            className="fy-text-btn"
            style={styles.textBtnMuted}
            onClick={() => {
              setNarrativeManual(false);
              scheduleNarrate();
            }}
          >
            Let Vita keep the story in sync again
          </button>
        )}
      </div>

      {/* The chat — the main way to reshape the year */}
      <div style={styles.chatCard}>
        <div style={styles.vitaLockup}>
          <span aria-hidden="true">☀️</span>
          <span style={styles.vitaName}>Vita</span>
        </div>
        <div style={styles.messageList}>
          {messages.map((m, i) =>
            m.role === "coach" ? (
              <div key={i} style={styles.coachBubble}>
                {m.text}
              </div>
            ) : (
              <div key={i} style={styles.userBubble}>
                {m.text}
              </div>
            )
          )}
          {sending && (
            <div style={styles.coachBubble}>
              <span className="fy-dots" aria-hidden="true">
                <span className="fy-dot" />
                <span className="fy-dot" />
                <span className="fy-dot" />
              </span>
            </div>
          )}
        </div>
        <p style={styles.reshapeHint}>{reshapeHint}</p>
        <div style={styles.composer}>
          <input
            type="text"
            className="fy-composer-input"
            style={styles.composerInput}
            placeholder={chatPlaceholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
          />
          <button
            type="button"
            className="fy-send"
            style={styles.sendBtn}
            disabled={sending || !input.trim()}
            onClick={handleSend}
          >
            Send →
          </button>
        </div>
      </div>

      <p style={styles.boundaryHint}>{boundaryHint}</p>

      <button
        type="button"
        className="fy-finish"
        style={styles.finishBtn}
        onClick={finish}
      >
        {finishLabel}
      </button>
    </section>
  );
}

// Read-only recap of the finished year — the timeline plus the story. Shown after
// the module completes. The neutral card wrapper is the caller's.
export function FirstYearSummary({ result }: { result: FirstYearResult }) {
  const items = rowsFromResult(result);
  const seasons = SEASON_IDS.map((id) => ({ id, label: SEASON_LABEL[id] }));
  return (
    <>
      <p style={styles.recapHeading}>{result.summaryLabel}</p>
      <YearTimeline
        items={items}
        seasons={seasons}
        allYearLabel="Across the whole year"
        workLaneLabel="Work"
        noWorkLabel="A clean break — your time is your own"
        topLabel="Headline moment"
        interactive={false}
      />
      {result.narrative && (
        <p style={styles.recapNarrative}>{result.narrative}</p>
      )}
    </>
  );
}

// A textarea that grows to fit its content, so wrapped lines are never clipped.
function AutoTextarea({
  value,
  onChange,
  className,
  style,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
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
      rows={3}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
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
  // Keep the helper line close above the timeline (tighter than the wrap's 20px
  // gap) so it reads as a cue for the element, not a separate block.
  helperGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  // ---- timeline ----
  timeline: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    background: "var(--warm-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "12px",
  },
  phases: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "8px",
    alignItems: "stretch",
  },
  phaseCol: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minWidth: 0,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    padding: "8px",
    minHeight: "120px",
  },
  phaseColOver: {
    borderColor: "var(--brand-primary)",
    boxShadow: "var(--focus-ring)",
  },
  phaseHead: {
    fontFamily: "var(--font-sans)",
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--brand-primary)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    lineHeight: 1.2,
  },
  phaseBody: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  phaseEmpty: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
  },
  chip: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "6px 8px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    boxShadow: "var(--shadow-sm)",
  },
  chipTop: {
    borderColor: "var(--accent-strong)",
  },
  chipDraggable: { cursor: "grab" },
  chipBody: {
    display: "flex",
    alignItems: "baseline",
    gap: "4px",
    flexWrap: "wrap",
  },
  chipStar: { fontSize: "10px", color: "var(--accent-strong)" },
  chipPlane: { fontSize: "10px", color: "var(--text-muted)" },
  chipLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--ink)",
    lineHeight: 1.25,
  },
  chipTools: {
    display: "flex",
    gap: "4px",
  },
  chipBtn: {
    width: "22px",
    height: "22px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    fontSize: "11px",
    color: "var(--text-muted)",
    cursor: "pointer",
    padding: 0,
  },
  chipBtnStarOn: {
    background: "var(--accent-strong)",
    borderColor: "var(--accent-strong)",
    color: "var(--brand-on-primary)",
  },
  allYear: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    background: "var(--bg)",
    border: "1px dashed var(--border)",
    borderRadius: "var(--r-sm)",
    padding: "8px",
  },
  allYearLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  allYearItems: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },
  workBand: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    paddingTop: "4px",
  },
  workBandLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  workTrack: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "8px",
    height: "12px",
  },
  workSeg: {
    borderRadius: "var(--r-pill)",
    background: "var(--muted-surface)",
  },
  workSegOn: {
    background: "var(--brand-primary)",
    opacity: 0.55,
  },
  workNone: {
    gridColumn: "1 / -1",
    display: "flex",
    alignItems: "center",
    paddingLeft: "4px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-xs)",
    fontStyle: "italic",
    color: "var(--text-muted)",
  },
  workCaption: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-xs)",
    color: "var(--text-muted)",
  },
  // ---- narrative ----
  narrativeCard: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    background: "var(--warm-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "16px 18px",
  },
  narrativeHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  narrativeTitle: {
    fontFamily: "var(--font-sans)",
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  narrativeStatus: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-xs)",
    color: "var(--text-muted)",
    fontStyle: "italic",
  },
  narrativeText: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--ink)",
    margin: 0,
  },
  narrativeEdit: {
    width: "100%",
    padding: "10px 12px",
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--ink)",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    boxSizing: "border-box",
  },
  textBtn: {
    background: "none",
    border: "none",
    padding: 0,
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--brand-primary)",
    cursor: "pointer",
  },
  textBtnMuted: {
    alignSelf: "flex-start",
    background: "none",
    border: "none",
    padding: 0,
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-xs)",
    color: "var(--text-muted)",
    cursor: "pointer",
    textDecoration: "underline",
  },
  // ---- chat ----
  chatCard: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "16px",
  },
  vitaLockup: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  vitaName: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    color: "var(--ink)",
  },
  messageList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  coachBubble: {
    alignSelf: "flex-start",
    maxWidth: "85%",
    padding: "10px 14px",
    background: "var(--warm-surface)",
    border: "1px solid var(--border)",
    borderRadius: "14px 14px 14px 4px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--ink)",
  },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "85%",
    padding: "10px 14px",
    background: "var(--brand-primary)",
    borderRadius: "14px 14px 4px 14px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--brand-on-primary)",
  },
  reshapeHint: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-xs)",
    color: "var(--text-muted)",
    margin: 0,
  },
  composer: {
    display: "flex",
    gap: "8px",
  },
  composerInput: {
    flex: 1,
    padding: "10px 14px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    color: "var(--ink)",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-pill)",
    boxSizing: "border-box",
  },
  sendBtn: {
    flexShrink: 0,
    padding: "10px 18px",
    background: "var(--brand-primary)",
    border: "none",
    borderRadius: "var(--r-pill)",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--brand-on-primary)",
    cursor: "pointer",
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
  finishBtn: {
    alignSelf: "flex-start",
    padding: "12px 22px",
    background: "var(--brand-primary)",
    border: "none",
    borderRadius: "var(--r-pill)",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    color: "var(--brand-on-primary)",
    cursor: "pointer",
  },
  recapHeading: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--ink)",
    margin: "0 0 12px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  recapNarrative: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--ink)",
    margin: "14px 0 0",
  },
};

const journeyCss = `
  .fy-chip-btn:hover { border-color: var(--brand-primary); }
  .fy-chip-btn:focus-visible, .fy-send:focus-visible, .fy-finish:focus-visible,
  .fy-text-btn:focus-visible, .fy-composer-input:focus-visible,
  .fy-input:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .fy-composer-input:focus-visible, .fy-input:focus-visible {
    border-color: var(--brand-primary);
  }
  .fy-send:not(:disabled):hover, .fy-finish:hover { filter: brightness(1.08); }
  .fy-send:disabled { opacity: 0.5; cursor: default; }
  .fy-dots { display: inline-flex; gap: 4px; }
  .fy-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--text-muted); opacity: 0.5;
    animation: fy-bounce 1.2s infinite ease-in-out;
  }
  .fy-dot:nth-child(2) { animation-delay: 0.15s; }
  .fy-dot:nth-child(3) { animation-delay: 0.3s; }
  @keyframes fy-bounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
    30% { transform: translateY(-4px); opacity: 0.9; }
  }
`;
