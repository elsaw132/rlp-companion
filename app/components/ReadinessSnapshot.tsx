"use client";

import { useState } from "react";
import type {
  ReadinessSnapshotInteraction,
  ReadinessSnapshotResult,
} from "@/lib/modules";
import { FinishControls, type EditableProps } from "./InteractionShell";

const MIDPOINT = 50;

function leanFromPosition(position: number): "clean-break" | "gradual" {
  return position >= MIDPOINT ? "gradual" : "clean-break";
}

// The window marks are stored compactly ("Now", "1", … "10") so the axis stays
// readable with one tick per year; this expands a mark into the full wording
// used in the readout, the stored result, and Vita's recap ("3 years").
function describeMark(mark: string): string {
  if (mark === "Now") return "Now";
  return mark === "1" ? "1 year" : `${mark} years`;
}

// The coach-facing summary, e.g.
// "Your readiness snapshot: leaning toward a gradual wind-down (a steady taper,
//  over three to five years). Window: somewhere between 2 years and 5 years.
//  Readiness — finances: building; health: strong; things I still want to
//  finish: some. Sense of a financial readiness date: roughly."
export function readinessSnapshotSummaryText(
  result: ReadinessSnapshotResult
): string {
  const label = result.summaryLabel ?? "Your readiness snapshot";
  const t = result.transition;
  const lean =
    t.lean === "gradual"
      ? "leaning toward a gradual wind-down"
      : "leaning toward a clean break";
  const shapeBits = [t.shape, t.period].filter(Boolean).join(", over ");
  const transition = shapeBits ? `${lean} (${shapeBits})` : lean;

  const window = result.window
    ? `Window: somewhere between ${result.window.fromLabel} and ${result.window.toLabel}.`
    : "";

  const readiness = result.factors.length
    ? `Readiness — ${result.factors
        .map((f) => `${f.label.toLowerCase()}: ${f.level.toLowerCase()}`)
        .join("; ")}.`
    : "";

  const date = result.finance.dateKnown
    ? `Sense of a financial readiness date: ${result.finance.dateKnown.toLowerCase()}.`
    : "";

  return [`${label}: ${transition}.`, window, readiness, date]
    .filter(Boolean)
    .join(" ");
}

type ReadinessSnapshotProps = {
  interaction: ReadinessSnapshotInteraction;
  onFinish: (result: ReadinessSnapshotResult) => void;
} & EditableProps<ReadinessSnapshotResult>;

export default function ReadinessSnapshot({
  interaction,
  onFinish,
  mode = "create",
  initial,
  onCancel,
}: ReadinessSnapshotProps) {
  const {
    transitionInstruction,
    transition,
    shapeLabel,
    shapeOptions,
    periodLabel,
    periodOptions,
    windowInstruction,
    windowMarks,
    factorsInstruction,
    factors,
    levels,
    financeFactorId,
    financeQuestion,
    summaryLabel,
  } = interaction;

  const lastMark = windowMarks.length - 1;

  // Restore the slider, shape/period, window band, factor levels and finance
  // answer from a stored result when editing; otherwise sensible starting points
  // (midpoint slider, an early–mid window band, nothing rated yet).
  const [position, setPosition] = useState<number>(
    initial?.transition.position ?? MIDPOINT
  );
  const [shape, setShape] = useState<string | null>(
    initial?.transition.shape ?? null
  );
  const [period, setPeriod] = useState<string | null>(
    initial?.transition.period ?? null
  );

  // Stored labels are the expanded form ("3 years"), so match on describeMark.
  const indexOfLabel = (label: string) =>
    windowMarks.findIndex((m) => describeMark(m) === label);
  const initialFrom = initial?.window
    ? Math.max(0, indexOfLabel(initial.window.fromLabel))
    : 0;
  const initialTo = initial?.window
    ? Math.max(initialFrom, indexOfLabel(initial.window.toLabel))
    : Math.min(3, lastMark);
  const [fromIndex, setFromIndex] = useState<number>(initialFrom);
  const [toIndex, setToIndex] = useState<number>(initialTo);

  const [levelByFactor, setLevelByFactor] = useState<
    Record<string, string | null>
  >(() => {
    const seeded: Record<string, string | null> = {};
    for (const f of factors) {
      seeded[f.id] =
        initial?.factors.find((x) => x.id === f.id)?.level ?? null;
    }
    return seeded;
  });
  const [dateKnown, setDateKnown] = useState<string | null>(
    initial?.finance.dateKnown ?? null
  );

  const isGradual = leanFromPosition(position) === "gradual";

  function setFrom(value: number) {
    setFromIndex(value);
    if (value > toIndex) setToIndex(value);
  }
  function setTo(value: number) {
    setToIndex(value);
    if (value < fromIndex) setFromIndex(value);
  }

  const allFactorsRated = factors.every((f) => levelByFactor[f.id] != null);

  function buildResultObject(): ReadinessSnapshotResult {
    return {
      type: "readiness-snapshot",
      transition: {
        position,
        lean: leanFromPosition(position),
        ...(isGradual && shape ? { shape } : {}),
        ...(isGradual && period ? { period } : {}),
      },
      window: {
        fromLabel: describeMark(windowMarks[fromIndex]),
        toLabel: describeMark(windowMarks[toIndex]),
      },
      factors: factors.map((f) => ({
        id: f.id,
        label: f.label,
        level: levelByFactor[f.id] as string,
      })),
      finance: { ...(dateKnown ? { dateKnown } : {}) },
      summaryLabel,
    };
  }

  const bandLeft = (fromIndex / lastMark) * 100;
  const bandWidth = ((toIndex - fromIndex) / lastMark) * 100;

  return (
    <section style={styles.wrap}>
      <style>{readinessCss}</style>

      {/* Transition spectrum */}
      <div style={styles.block}>
        <p style={styles.instruction}>{transitionInstruction}</p>
        <div style={styles.labelRow}>
          <span style={styles.endLabel}>{transition.left}</span>
          <span style={{ ...styles.endLabel, ...styles.endLabelRight }}>
            {transition.right}
          </span>
        </div>
        <input
          type="range"
          className="readiness-slider"
          style={styles.slider}
          min={0}
          max={100}
          step={1}
          value={position}
          aria-label={`${transition.left} to ${transition.right}`}
          onChange={(e) => setPosition(Number(e.target.value))}
        />
      </div>

      {/* Shape + period follow-up, only when leaning gradual */}
      {isGradual && (
        <div style={styles.followUp}>
          <div style={styles.block}>
            <p style={styles.subPrompt}>{shapeLabel}</p>
            <div style={styles.chips}>
              {shapeOptions.map((option) => {
                const selected = shape === option;
                return (
                  <button
                    key={option}
                    type="button"
                    className="readiness-chip"
                    style={{
                      ...styles.chip,
                      ...(selected ? styles.chipSelected : null),
                    }}
                    aria-pressed={selected}
                    onClick={() => setShape(selected ? null : option)}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={styles.block}>
            <p style={styles.subPrompt}>{periodLabel}</p>
            <div style={styles.chips}>
              {periodOptions.map((option) => {
                const selected = period === option;
                return (
                  <button
                    key={option}
                    type="button"
                    className="readiness-chip"
                    style={{
                      ...styles.chip,
                      ...(selected ? styles.chipSelected : null),
                    }}
                    aria-pressed={selected}
                    onClick={() => setPeriod(selected ? null : option)}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Retirement window band */}
      <div style={styles.block}>
        <p style={styles.instruction}>{windowInstruction}</p>
        <div style={styles.bandTrack}>
          <div
            style={{
              ...styles.band,
              left: `${bandLeft}%`,
              width: `${bandWidth}%`,
            }}
            aria-hidden="true"
          />
        </div>
        <div style={styles.markRow}>
          {windowMarks.map((mark) => (
            <span key={mark} style={styles.markLabel}>
              {mark}
            </span>
          ))}
        </div>
        <p style={styles.markCaption}>years from now</p>
        <div style={styles.windowControls}>
          <label style={styles.windowControl}>
            <span style={styles.windowControlLabel}>From</span>
            <input
              type="range"
              className="readiness-slider"
              style={styles.slider}
              min={0}
              max={lastMark}
              step={1}
              value={fromIndex}
              aria-label="Window starts"
              onChange={(e) => setFrom(Number(e.target.value))}
            />
          </label>
          <label style={styles.windowControl}>
            <span style={styles.windowControlLabel}>To</span>
            <input
              type="range"
              className="readiness-slider"
              style={styles.slider}
              min={0}
              max={lastMark}
              step={1}
              value={toIndex}
              aria-label="Window ends"
              onChange={(e) => setTo(Number(e.target.value))}
            />
          </label>
        </div>
        <p style={styles.bandReadout}>
          Somewhere between{" "}
          <strong style={styles.bandReadoutStrong}>
            {describeMark(windowMarks[fromIndex])}
          </strong>{" "}
          and{" "}
          <strong style={styles.bandReadoutStrong}>
            {describeMark(windowMarks[toIndex])}
          </strong>
          .
        </p>
      </div>

      {/* Readiness profile */}
      <div style={styles.block}>
        <p style={styles.instruction}>{factorsInstruction}</p>
        <div style={styles.factors}>
          {factors.map((factor) => {
            const chosen = levelByFactor[factor.id];
            const isFinance = factor.id === financeFactorId;
            const factorLevels = factor.levels ?? levels;
            return (
              <div key={factor.id} style={styles.factorRow}>
                <div style={styles.factorHead}>
                  <span style={styles.factorLabel}>{factor.label}</span>
                  <div style={styles.levels}>
                    {factorLevels.map((level) => {
                      const selected = chosen === level;
                      return (
                        <button
                          key={level}
                          type="button"
                          className="readiness-level"
                          style={{
                            ...styles.level,
                            ...(selected ? styles.levelSelected : null),
                          }}
                          aria-pressed={selected}
                          onClick={() =>
                            setLevelByFactor((prev) => ({
                              ...prev,
                              [factor.id]: selected ? null : level,
                            }))
                          }
                        >
                          {level}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {isFinance && (
                  <div style={styles.financeFollowUp}>
                    <p style={styles.subPrompt}>{financeQuestion.prompt}</p>
                    <div style={styles.chips}>
                      {financeQuestion.options.map((option) => {
                        const selected = dateKnown === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            className="readiness-chip"
                            style={{
                              ...styles.chip,
                              ...(selected ? styles.chipSelected : null),
                            }}
                            aria-pressed={selected}
                            onClick={() =>
                              setDateKnown(selected ? null : option)
                            }
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <FinishControls
        mode={mode}
        disabled={!allFactorsRated}
        onFinish={() => onFinish(buildResultObject())}
        onCancel={onCancel}
        hint={
          allFactorsRated
            ? undefined
            : "Rate each part of the picture to carry on."
        }
      />
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: "32px",
    paddingTop: "36px",
    marginTop: "8px",
    borderTop: "1px solid var(--border)",
  },
  block: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  followUp: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    padding: "20px",
    background: "var(--warm-surface)",
    borderRadius: "var(--r-md)",
  },
  instruction: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--text-muted)",
    margin: 0,
  },
  subPrompt: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--ink)",
    margin: 0,
  },
  labelRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
  },
  endLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--ink)",
    flex: 1,
  },
  endLabelRight: {
    textAlign: "right",
  },
  slider: {
    width: "100%",
    margin: 0,
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },
  chip: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-pill)",
    boxShadow: "var(--shadow-sm)",
    padding: "10px 18px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 500,
    color: "var(--text)",
    cursor: "pointer",
  },
  chipSelected: {
    background: "var(--brand-primary-tint)",
    border: "1px solid var(--brand-primary)",
    color: "var(--ink)",
    fontWeight: 600,
  },
  bandTrack: {
    position: "relative",
    height: "10px",
    background: "var(--border)",
    borderRadius: "var(--r-pill)",
  },
  band: {
    position: "absolute",
    top: 0,
    height: "100%",
    background: "var(--brand-primary)",
    borderRadius: "var(--r-pill)",
    minWidth: "10px",
  },
  markRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "4px",
  },
  markLabel: {
    flex: 1,
    fontFamily: "var(--font-sans)",
    fontSize: "12px",
    color: "var(--text-muted)",
    textAlign: "center",
  },
  markCaption: {
    fontFamily: "var(--font-sans)",
    fontSize: "12px",
    color: "var(--text-muted)",
    textAlign: "center",
    margin: "-4px 0 0",
  },
  windowControls: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginTop: "4px",
  },
  windowControl: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  windowControlLabel: {
    width: "44px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--text-muted)",
  },
  bandReadout: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    margin: 0,
  },
  bandReadoutStrong: {
    color: "var(--ink)",
    fontWeight: 600,
  },
  factors: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  factorRow: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  factorHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "12px",
  },
  factorLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    color: "var(--ink)",
  },
  levels: {
    display: "flex",
    gap: "8px",
  },
  level: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-pill)",
    padding: "8px 16px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 500,
    color: "var(--text)",
    cursor: "pointer",
  },
  levelSelected: {
    background: "var(--brand-primary-tint)",
    border: "1px solid var(--brand-primary)",
    color: "var(--ink)",
    fontWeight: 600,
  },
  financeFollowUp: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "16px",
    background: "var(--warm-surface)",
    borderRadius: "var(--r-md)",
  },
};

// Read-only recap shown above Vita's first message and kept visible through the
// conversation. The neutral card wrapper is provided by the caller.
export function ReadinessSnapshotSummary({
  result,
}: {
  result: ReadinessSnapshotResult;
}) {
  const t = result.transition;
  const leanWord =
    t.lean === "gradual" ? "A gradual wind-down" : "A clean break";

  return (
    <>
      <p style={summaryStyles.heading}>Your readiness snapshot</p>

      <div style={summaryStyles.section}>
        <p style={summaryStyles.line}>
          <strong style={summaryStyles.strong}>{leanWord}</strong>
          {t.shape ? ` — ${t.shape}` : ""}
          {t.period ? `, over ${t.period.toLowerCase()}` : ""}
        </p>
        {result.window && (
          <p style={summaryStyles.line}>
            Window: somewhere between{" "}
            <strong style={summaryStyles.strong}>
              {result.window.fromLabel}
            </strong>{" "}
            and{" "}
            <strong style={summaryStyles.strong}>
              {result.window.toLabel}
            </strong>
            .
          </p>
        )}
      </div>

      <div style={summaryStyles.factors}>
        {result.factors.map((f) => (
          <div key={f.id} style={summaryStyles.factorRow}>
            <span style={summaryStyles.factorName}>{f.label}</span>
            <span style={summaryStyles.factorLevel}>{f.level}</span>
          </div>
        ))}
      </div>

      {result.finance.dateKnown && (
        <p style={summaryStyles.financeLine}>
          Sense of a financial readiness date:{" "}
          <strong style={summaryStyles.strong}>
            {result.finance.dateKnown}
          </strong>
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
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginBottom: "16px",
  },
  line: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    margin: 0,
  },
  strong: {
    color: "var(--ink)",
    fontWeight: 600,
  },
  factors: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  factorRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "12px",
  },
  factorName: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
  },
  factorLevel: {
    flexShrink: 0,
    fontFamily: "var(--font-sans)",
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--ink)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  financeLine: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    margin: "16px 0 0",
  },
};

const readinessCss = `
  .readiness-slider {
    -webkit-appearance: none;
    appearance: none;
    height: 8px;
    border-radius: var(--r-pill);
    background: var(--border);
    outline: none;
    cursor: pointer;
  }
  .readiness-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--brand-primary);
    border: 4px solid var(--bg);
    box-shadow: var(--shadow-sm);
    cursor: pointer;
  }
  .readiness-slider::-moz-range-thumb {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--brand-primary);
    border: 4px solid var(--bg);
    box-shadow: var(--shadow-sm);
    cursor: pointer;
  }
  .readiness-slider:focus-visible::-webkit-slider-thumb { box-shadow: var(--focus-ring); }
  .readiness-slider:focus-visible::-moz-range-thumb { box-shadow: var(--focus-ring); }
  .readiness-chip:focus-visible, .readiness-level:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
`;
