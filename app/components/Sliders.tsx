"use client";

import { useEffect, useState } from "react";
import type { SlidersInteraction, SlidersResult } from "@/lib/modules";
import { FinishControls, HelperLine, type EditableProps } from "./InteractionShell";

const MIDPOINT = 50;

// Turn a 0–100 position into words. Bands: <20 strongly left, <40 toward left,
// <60 balanced, <80 toward right, otherwise strongly right.
function positionPhrase(left: string, right: string, position: number): string {
  const l = lowerFirst(left);
  const r = lowerFirst(right);
  if (position < 20) return `strongly toward ${l}`;
  if (position < 40) return `toward ${l}`;
  if (position < 60) return `balanced between ${l} and ${r}`;
  if (position < 80) return `toward ${r}`;
  return `strongly toward ${r}`;
}

function lowerFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}

// The coach-facing summary, e.g.
// "Ideal week: toward lots of routine; strongly toward mostly with others;
//  balanced between full and busy and slow and restful. Seasons change it: a little."
export function slidersSummaryText(result: SlidersResult): string {
  const phrases = result.spectrums.map((s) =>
    positionPhrase(s.left, s.right, s.position)
  );
  const label = result.summaryLabel ?? "Ideal week";
  const week = phrases.length ? `${label}: ${phrases.join("; ")}.` : "";
  const seasons = result.seasonal?.answer
    ? `Seasons change it: ${lowerFirst(result.seasonal.answer)}.`
    : "";
  return [week, seasons].filter(Boolean).join(" ");
}

type SlidersProps = {
  interaction: SlidersInteraction;
  onFinish: (result: SlidersResult) => void;
  // Embedded inside a composite step: render without the finish button and
  // report the current settings upward on every change.
  embedded?: boolean;
  onChange?: (result: SlidersResult) => void;
} & EditableProps<SlidersResult>;

export default function Sliders({
  interaction,
  onFinish,
  mode = "create",
  initial,
  onCancel,
  embedded = false,
  onChange,
}: SlidersProps) {
  const { instruction, spectrums, seasonal, anchors, summaryLabel } =
    interaction;

  // In edit mode, start each slider where they left it (matched by position)
  // and restore the seasonal answer; otherwise the midpoint and no answer.
  const [positions, setPositions] = useState<number[]>(() =>
    spectrums.map((_, i) => initial?.spectrums[i]?.position ?? MIDPOINT)
  );
  const [season, setSeason] = useState<string | null>(
    initial?.seasonal?.answer ?? null
  );

  // Build the result from the current settings — seasonal and summaryLabel are
  // only present when the interaction configured them.
  const buildResultObject = (): SlidersResult => ({
    type: "sliders",
    spectrums: spectrums.map((s, i) => ({
      left: s.left,
      right: s.right,
      position: positions[i],
    })),
    ...(seasonal ? { seasonal: { prompt: seasonal.prompt, answer: season } } : {}),
    ...(summaryLabel ? { summaryLabel } : {}),
  });

  // Keep the parent composite in step with the live settings.
  useEffect(() => {
    if (!embedded || !onChange) return;
    onChange(buildResultObject());
    // onChange is a fresh closure each render; positions/season drive this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, season, embedded]);

  function setPosition(index: number, value: number) {
    setPositions((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  return (
    <section
      style={
        embedded
          ? { ...styles.wrap, paddingTop: 0, marginTop: 0, borderTop: "none" }
          : styles.wrap
      }
    >
      <style>{slidersCss}</style>

      <p style={styles.instruction}>{instruction}</p>

      <div style={styles.helperGroup}>
        <HelperLine>
          {spectrums.length > 1
            ? "Drag each slider to where it feels right."
            : "Drag the slider to where it feels right."}
        </HelperLine>
        <div style={styles.spectrums}>
        {spectrums.map((spectrum, i) => (
          <div key={`${spectrum.left}-${spectrum.right}`} style={styles.spectrum}>
            {!(anchors && anchors.length > 0) && (
              <div style={styles.labelRow}>
                <span style={styles.endLabel}>{spectrum.left}</span>
                <span style={{ ...styles.endLabel, ...styles.endLabelRight }}>
                  {spectrum.right}
                </span>
              </div>
            )}
            <input
              type="range"
              className="week-slider"
              style={styles.slider}
              min={0}
              max={100}
              step={1}
              value={positions[i]}
              aria-label={`${spectrum.left} to ${spectrum.right}`}
              onChange={(e) => setPosition(i, Number(e.target.value))}
            />
            {anchors && anchors.length > 0 && (
              <div style={styles.anchorRow}>
                {anchors.map((a) => (
                  <span key={a} style={styles.anchorLabel}>
                    {a}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        </div>
      </div>

      {seasonal && (
        <div style={styles.seasonal}>
          <p style={styles.seasonalPrompt}>{seasonal.prompt}</p>
          <div style={styles.seasonalOptions}>
            {seasonal.options.map((option) => {
              const isSelected = season === option;
              return (
                <button
                  key={option}
                  type="button"
                  className="season-chip"
                  style={{
                    ...styles.seasonChip,
                    ...(isSelected ? styles.seasonChipSelected : null),
                  }}
                  aria-pressed={isSelected}
                  onClick={() => setSeason(isSelected ? null : option)}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!embedded && (
        <FinishControls
          mode={mode}
          disabled={false}
          onFinish={() => onFinish(buildResultObject())}
          onCancel={onCancel}
        />
      )}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: "28px",
    paddingTop: "36px",
    marginTop: "8px",
    borderTop: "1px solid var(--border)",
  },
  instruction: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--text-muted)",
    margin: 0,
  },
  // The helper line sits close above the slider track (the wrap's own 28px gap
  // is too far for a per-element cue), so group them with a tighter gap.
  helperGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  spectrums: {
    display: "flex",
    flexDirection: "column",
    gap: "28px",
  },
  spectrum: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
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
  anchorRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "8px",
    marginTop: "2px",
  },
  anchorLabel: {
    flex: 1,
    fontFamily: "var(--font-sans)",
    fontSize: "12px",
    color: "var(--text-muted)",
    textAlign: "center",
  },
  seasonal: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  seasonalPrompt: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    color: "var(--ink)",
    margin: 0,
  },
  seasonalOptions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
  },
  seasonChip: {
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
  seasonChipSelected: {
    background: "var(--brand-primary-tint)",
    border: "1px solid var(--brand-primary)",
    color: "var(--ink)",
    fontWeight: 600,
  },
};

// Read-only recap shown above Vita's first message and kept visible through the
// conversation. Each spectrum shows an inert marker on the track at the set
// position. The neutral card wrapper is provided by the caller.
export function SlidersSummary({ result }: { result: SlidersResult }) {
  return (
    <>
      <p style={summaryStyles.heading}>Your week</p>
      <div style={summaryStyles.spectrums}>
        {result.spectrums.map((s) => (
          <div key={`${s.left}-${s.right}`} style={summaryStyles.spectrum}>
            <div style={summaryStyles.labelRow}>
              <span style={summaryStyles.endLabel}>{s.left}</span>
              <span
                style={{ ...summaryStyles.endLabel, ...summaryStyles.endLabelRight }}
              >
                {s.right}
              </span>
            </div>
            <div style={summaryStyles.track}>
              <div
                style={{ ...summaryStyles.marker, left: `${s.position}%` }}
                aria-hidden="true"
              />
            </div>
          </div>
        ))}
      </div>
      {result.seasonal?.answer && (
        <p style={summaryStyles.seasonal}>
          {result.seasonal.prompt}{" "}
          <strong style={summaryStyles.seasonalAnswer}>
            {result.seasonal.answer}
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
  spectrums: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  spectrum: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  labelRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
  },
  endLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 500,
    color: "var(--text-muted)",
    flex: 1,
  },
  endLabelRight: {
    textAlign: "right",
  },
  track: {
    position: "relative",
    height: "6px",
    background: "var(--border)",
    borderRadius: "var(--r-pill)",
  },
  marker: {
    position: "absolute",
    top: "50%",
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    background: "var(--brand-primary)",
    border: "2px solid var(--bg)",
    boxShadow: "var(--shadow-sm)",
    transform: "translate(-50%, -50%)",
  },
  seasonal: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    margin: "16px 0 0",
  },
  seasonalAnswer: {
    color: "var(--ink)",
    fontWeight: 600,
  },
};

const slidersCss = `
  .week-slider {
    -webkit-appearance: none;
    appearance: none;
    height: 8px;
    border-radius: var(--r-pill);
    background: var(--border);
    outline: none;
    cursor: pointer;
  }
  .week-slider::-webkit-slider-thumb {
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
  .week-slider::-moz-range-thumb {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--brand-primary);
    border: 4px solid var(--bg);
    box-shadow: var(--shadow-sm);
    cursor: pointer;
  }
  .week-slider:focus-visible::-webkit-slider-thumb { box-shadow: var(--focus-ring); }
  .week-slider:focus-visible::-moz-range-thumb { box-shadow: var(--focus-ring); }
  .season-chip:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
`;
