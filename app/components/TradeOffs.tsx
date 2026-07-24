"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type {
  BalancedGoalsResult,
  ReadinessSnapshotResult,
  TradeOffsInteraction,
  TradeOffsResult,
} from "@/lib/modules";
import {
  fetchTradeOffsDraft,
  financeSignal,
  tradeOffGoalInputs,
  valueInputs,
  coreValueInputs,
  type TradeOffsSeed,
} from "@/lib/tradeOffsSeed";
import { useUserData } from "@/lib/userData";
import { DraftFailed } from "./DraftFailed";
import { FinishControls, HelperLine, type EditableProps } from "./InteractionShell";

type Bucket = "non-negotiable" | "flexible" | "unsorted";

// One trade-off on the curation surface — the drafted framing plus where the
// person leans (0–100, 50 = balanced) and the two free-text answers.
type Scenario = {
  id: string;
  title: string;
  situation: string;
  optionA: string;
  optionB: string;
  lean: number;
  protect: string;
  sacrifice: string;
};

type ValueRow = { id: string; value: string; bucket: Bucket };
type Principle = { id: string; text: string };

// A short description of where someone leaned, for the coach-facing summary.
function leanText(s: { lean: number; optionA: string; optionB: string }): string {
  if (s.lean <= 38) return `leans toward "${s.optionA}"`;
  if (s.lean >= 62) return `leans toward "${s.optionB}"`;
  return `balanced between "${s.optionA}" and "${s.optionB}"`;
}

// The coach-facing summary — the shape of what they decided, so Vita can open by
// noticing where they held firm and where they flexed, then help name the
// principles. Vita is told not to recite it back line by line.
export function tradeOffsSummaryText(result: TradeOffsResult): string {
  const label = result.summaryLabel ?? "When you can't do it all";
  const scenarioLines = result.scenarios.map((s) => {
    const bits = [
      leanText(s),
      s.protect && `wants to protect: ${s.protect}`,
      s.sacrifice && `too great a sacrifice: ${s.sacrifice}`,
    ]
      .filter(Boolean)
      .join("; ");
    return `${s.title} (${bits})`;
  });
  const nonNeg = result.values
    .filter((v) => v.bucket === "non-negotiable")
    .map((v) => v.value);
  const flex = result.values
    .filter((v) => v.bucket === "flexible")
    .map((v) => v.value);
  const parts = [
    `Trade-offs they weighed: ${scenarioLines.join(" ")}`,
    nonNeg.length ? `Non-negotiable: ${nonNeg.join(", ")}.` : "",
    flex.length ? `Important but flexible: ${flex.join(", ")}.` : "",
    result.principles.length
      ? `Decision principles they drafted: ${result.principles.join("; ")}.`
      : "",
  ].filter(Boolean);
  return `${label}. ${parts.join(" ")}`;
}

function makeFreshScenarios(seed: TradeOffsSeed): Scenario[] {
  return seed.scenarios.map((s, i) => ({
    id: `sc${i}`,
    title: s.title,
    situation: s.situation,
    optionA: s.optionA,
    optionB: s.optionB,
    lean: 50,
    protect: "",
    sacrifice: "",
  }));
}

function makeFreshValues(seed: TradeOffsSeed): ValueRow[] {
  return seed.values.map((v, i) => ({
    id: `v${i}`,
    value: v,
    bucket: "unsorted" as Bucket,
  }));
}

function makeFreshPrinciples(seed: TradeOffsSeed): Principle[] {
  return seed.principles.map((p, i) => ({ id: `pr${i}`, text: p }));
}

// Rebuild the editor state from a saved result, preserving every choice the
// person made (where they leaned, what they wrote, how they sorted).
function stateFromResult(result: TradeOffsResult): {
  scenarios: Scenario[];
  values: ValueRow[];
  principles: Principle[];
} {
  return {
    scenarios: result.scenarios.map((s, i) => ({
      id: `sc${i}`,
      title: s.title,
      situation: s.situation,
      optionA: s.optionA,
      optionB: s.optionB,
      lean: typeof s.lean === "number" ? s.lean : 50,
      protect: s.protect ?? "",
      sacrifice: s.sacrifice ?? "",
    })),
    values: result.values.map((v, i) => ({
      id: `v${i}`,
      value: v.value,
      bucket: v.bucket,
    })),
    principles: result.principles.map((p, i) => ({ id: `pr${i}`, text: p })),
  };
}

type TradeOffsProps = {
  interaction: TradeOffsInteraction;
  sessionId: string;
  // The rendered user-model block and onboarding line — the rich input for the
  // draft. hasPartner filters partner-only framing.
  userModelText: string;
  onboardingContext: string;
  hasPartner: boolean;
  onFinish: (result: TradeOffsResult) => void;
} & EditableProps<TradeOffsResult>;

export default function TradeOffs({
  interaction,
  sessionId,
  userModelText,
  onboardingContext,
  hasPartner,
  onFinish,
  mode = "create",
  initial,
  onCancel,
}: TradeOffsProps) {
  const {
    draftingLabel,
    curationInstruction,
    scenariosLabel,
    protectLabel,
    protectPlaceholder,
    sacrificeLabel,
    sacrificePlaceholder,
    valuesLabel,
    valuesInstruction,
    nonNegotiableLabel,
    flexibleLabel,
    principlesLabel,
    principlesInstruction,
    addPrincipleLabel,
    principlePlaceholder,
    boundaryHint,
    summaryLabel,
  } = interaction;

  const userData = useUserData();

  // The inputs the draft is built from, read once. Goals + finance ground the
  // scenarios; the values feed the sort.
  const draftInputsRef = useRef({
    goals: tradeOffGoalInputs(
      (userData.getBuild("4.3") as BalancedGoalsResult | null) ?? null
    ),
    finance: financeSignal(
      (userData.getBuild("4.1") as ReadinessSnapshotResult | null) ?? null
    ),
    // The sort is anchored to the CANONICAL value facts (marked core-five, ranked,
    // verbatim) — not the AI-distilled stage3-values summary, which could drop
    // marked-core values. Falls back to the summary only if no value facts exist.
    values: (() => {
      const core = coreValueInputs(userData.getActiveFacts());
      return core.length ? core : valueInputs(userData.getStage3Values());
    })(),
  });
  const draftInputs = draftInputsRef.current;

  // Editing reopens straight onto the curation view from the saved result; a
  // fresh run uses any cached draft, or fetches one (the "loading" phase).
  const cachedSeed = initial ? null : userData.getTradeOffSeed(sessionId);

  const [phase, setPhase] = useState<"loading" | "curate" | "failed">(
    initial || cachedSeed ? "curate" : "loading"
  );

  const initialState = initial
    ? stateFromResult(initial)
    : cachedSeed
      ? {
          scenarios: makeFreshScenarios(cachedSeed),
          values: makeFreshValues(cachedSeed),
          principles: makeFreshPrinciples(cachedSeed),
        }
      : { scenarios: [], values: [], principles: [] };

  const [scenarios, setScenarios] = useState<Scenario[]>(
    initialState.scenarios
  );
  const [values, setValues] = useState<ValueRow[]>(initialState.values);
  const [principles, setPrinciples] = useState<Principle[]>(
    initialState.principles
  );

  // Draft once, the first time a fresh run has no cached draft.
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (phase !== "loading" || fetchedRef.current) return;
    fetchedRef.current = true;
    let cancelled = false;
    (async () => {
      // A prefetch started during the intro may have already landed in the cache.
      const cached = userData.getTradeOffSeed(sessionId);
      const draft =
        cached ??
        (await fetchTradeOffsDraft({
          userModel: userModelText,
          onboarding: onboardingContext,
          hasPartner,
          retirementStage: userData.getRetirementStage(),
          goals: draftInputs.goals,
          finance: draftInputs.finance,
          values: draftInputs.values,
        }));
      if (cancelled) return;
      if (!draft) {
        setPhase("failed");
        return;
      }
      const seed = draft;
      if (!cached) void userData.saveTradeOffSeed(sessionId, draft);
      setScenarios(makeFreshScenarios(seed));
      setValues(makeFreshValues(seed));
      setPrinciples(makeFreshPrinciples(seed));
      setPhase("curate");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Monotonic counter for ids of principles the person adds.
  const nextIdRef = useRef(0);
  const makeId = () => `pr-added-${nextIdRef.current++}`;

  function patchScenario(id: string, patch: Partial<Scenario>) {
    setScenarios((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  }

  function setBucket(id: string, bucket: Bucket) {
    setValues((prev) =>
      prev.map((v) =>
        v.id === id
          ? { ...v, bucket: v.bucket === bucket ? "unsorted" : bucket }
          : v
      )
    );
  }

  function updatePrinciple(id: string, text: string) {
    setPrinciples((prev) =>
      prev.map((p) => (p.id === id ? { ...p, text } : p))
    );
  }
  function removePrinciple(id: string) {
    setPrinciples((prev) => prev.filter((p) => p.id !== id));
  }
  function addPrinciple() {
    setPrinciples((prev) => [...prev, { id: makeId(), text: "" }]);
  }

  function buildResultObject(): TradeOffsResult {
    return {
      type: "trade-offs",
      scenarios: scenarios.map((s) => ({
        title: s.title,
        situation: s.situation,
        optionA: s.optionA,
        optionB: s.optionB,
        lean: s.lean,
        ...(s.protect.trim() ? { protect: s.protect.trim() } : {}),
        ...(s.sacrifice.trim() ? { sacrifice: s.sacrifice.trim() } : {}),
      })),
      values: values.map((v) => ({ value: v.value, bucket: v.bucket })),
      principles: principles.map((p) => p.text.trim()).filter(Boolean),
      summaryLabel,
    };
  }

  if (phase === "failed") {
    return (
      <section style={styles.wrap}>
        <style>{tradeCss}</style>
        <DraftFailed
          message="We couldn't draft your trade-offs just now. Your answers are all saved. Try again in a moment."
          onRetry={() => {
            fetchedRef.current = false;
            setPhase("loading");
          }}
        />
      </section>
    );
  }

  if (phase === "loading") {
    return (
      <section style={styles.wrap}>
        <style>{tradeCss}</style>
        <div style={styles.draftCard}>
          <span style={styles.draftSun} aria-hidden="true">
            ⚖️
          </span>
          <p style={styles.draftText}>{draftingLabel}</p>
        </div>
      </section>
    );
  }

  return (
    <section style={styles.wrap}>
      <style>{tradeCss}</style>

      <p style={styles.instruction}>{curationInstruction}</p>

      {/* 1 — the trade-off scenarios */}
      <div style={styles.block}>
        <p style={styles.sectionLabel}>{scenariosLabel}</p>
        <HelperLine>
          Drag the slider to where you&apos;d lean, and add what you&apos;d protect.
        </HelperLine>
        <div style={styles.scenarioList}>
          {scenarios.map((s) => (
            <ScenarioCard
              key={s.id}
              scenario={s}
              protectLabel={protectLabel}
              protectPlaceholder={protectPlaceholder}
              sacrificeLabel={sacrificeLabel}
              sacrificePlaceholder={sacrificePlaceholder}
              onLean={(v) => patchScenario(s.id, { lean: v })}
              onProtect={(v) => patchScenario(s.id, { protect: v })}
              onSacrifice={(v) => patchScenario(s.id, { sacrifice: v })}
            />
          ))}
        </div>
      </div>

      {/* 2 — the values sort */}
      {values.length > 0 && (
        <div style={styles.block}>
          <p style={styles.sectionLabel}>{valuesLabel}</p>
          <p style={styles.subInstruction}>{valuesInstruction}</p>
          <HelperLine>Sort each value into non-negotiable or flexible.</HelperLine>
          <div style={styles.valueList}>
            {values.map((v) => (
              <div key={v.id} style={styles.valueRow}>
                <span style={styles.valueName}>{v.value}</span>
                <div style={styles.bucketGroup}>
                  <button
                    type="button"
                    className="trade-bucket"
                    style={{
                      ...styles.bucketBtn,
                      ...(v.bucket === "non-negotiable"
                        ? styles.bucketBtnFirm
                        : null),
                    }}
                    aria-pressed={v.bucket === "non-negotiable"}
                    onClick={() => setBucket(v.id, "non-negotiable")}
                  >
                    {nonNegotiableLabel}
                  </button>
                  <button
                    type="button"
                    className="trade-bucket"
                    style={{
                      ...styles.bucketBtn,
                      ...(v.bucket === "flexible"
                        ? styles.bucketBtnFlex
                        : null),
                    }}
                    aria-pressed={v.bucket === "flexible"}
                    onClick={() => setBucket(v.id, "flexible")}
                  >
                    {flexibleLabel}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3 — the decision principles */}
      <div style={styles.block}>
        <p style={styles.sectionLabel}>{principlesLabel}</p>
        <p style={styles.subInstruction}>{principlesInstruction}</p>
        <div style={styles.principleList}>
          {principles.map((p) => (
            <div key={p.id} style={styles.principleRow}>
              <span aria-hidden="true" style={styles.principleDot} />
              <AutoTextarea
                className="trade-input"
                style={styles.principleInput}
                minRows={1}
                value={p.text}
                ariaLabel="Decision principle"
                placeholder={principlePlaceholder}
                autoFocus={p.text === ""}
                onChange={(val) => updatePrinciple(p.id, val)}
              />
              <button
                type="button"
                className="trade-remove"
                style={styles.removeBtn}
                aria-label="Remove principle"
                onClick={() => removePrinciple(p.id)}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className="trade-add"
            style={styles.addBtn}
            onClick={addPrinciple}
          >
            <span aria-hidden="true" style={styles.addPlus}>
              +
            </span>
            {addPrincipleLabel}
          </button>
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

// ---- one trade-off scenario on the curation surface ----
function ScenarioCard({
  scenario,
  protectLabel,
  protectPlaceholder,
  sacrificeLabel,
  sacrificePlaceholder,
  onLean,
  onProtect,
  onSacrifice,
}: {
  scenario: Scenario;
  protectLabel: string;
  protectPlaceholder: string;
  sacrificeLabel: string;
  sacrificePlaceholder: string;
  onLean: (v: number) => void;
  onProtect: (v: string) => void;
  onSacrifice: (v: string) => void;
}) {
  return (
    <div style={styles.scenarioCard}>
      <h3 style={styles.scenarioTitle}>{scenario.title}</h3>
      <p style={styles.scenarioSituation}>{scenario.situation}</p>

      <div style={styles.sliderWrap}>
        <div style={styles.poleRow}>
          <span style={styles.poleLabel}>{scenario.optionA}</span>
          <span style={{ ...styles.poleLabel, textAlign: "right" }}>
            {scenario.optionB}
          </span>
        </div>
        <input
          type="range"
          className="trade-slider rlp-slider"
          min={0}
          max={100}
          step={1}
          value={scenario.lean}
          aria-label={`Where you lean between ${scenario.optionA} and ${scenario.optionB}`}
          onChange={(e) => onLean(Number(e.target.value))}
        />
        <p style={styles.leanHint}>Slide to where you lean — the middle is fine</p>
      </div>

      <div style={styles.scenarioField}>
        <label style={styles.fieldLabel}>{protectLabel}</label>
        <AutoTextarea
          className="trade-input"
          style={styles.fieldInput}
          minRows={1}
          value={scenario.protect}
          ariaLabel={protectLabel}
          placeholder={protectPlaceholder}
          onChange={onProtect}
        />
      </div>

      <div style={styles.scenarioField}>
        <label style={styles.fieldLabel}>{sacrificeLabel}</label>
        <AutoTextarea
          className="trade-input"
          style={styles.fieldInput}
          minRows={1}
          value={scenario.sacrifice}
          ariaLabel={sacrificeLabel}
          placeholder={sacrificePlaceholder}
          onChange={onSacrifice}
        />
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
  scenarioList: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  scenarioCard: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    padding: "20px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    boxShadow: "var(--shadow-sm)",
  },
  scenarioTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-h3)",
    fontWeight: 500,
    color: "var(--ink)",
    margin: 0,
  },
  scenarioSituation: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--text)",
    margin: 0,
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
  scenarioField: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  fieldLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--ink)",
  },
  fieldInput: {
    width: "100%",
    padding: "9px 12px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--text)",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    boxSizing: "border-box",
  },
  valueList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  valueRow: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    padding: "10px 14px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
  },
  valueName: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    color: "var(--ink)",
    flex: "1 1 140px",
  },
  bucketGroup: {
    display: "flex",
    gap: "6px",
    flexShrink: 0,
  },
  bucketBtn: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-pill)",
    padding: "6px 12px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--text-muted)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  bucketBtnFirm: {
    background: "var(--brand-primary)",
    border: "1px solid var(--brand-primary)",
    color: "var(--brand-on-primary)",
  },
  bucketBtnFlex: {
    background: "var(--accent-strong)",
    border: "1px solid var(--accent-strong)",
    color: "var(--brand-on-primary)",
  },
  principleList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  principleRow: {
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
  },
  principleDot: {
    flexShrink: 0,
    width: "10px",
    height: "10px",
    marginTop: "14px",
    borderRadius: "50%",
    background: "var(--brand-primary)",
  },
  principleInput: {
    flex: 1,
    padding: "9px 12px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--text)",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    boxSizing: "border-box",
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
// conversation — each trade-off with where they leaned, then their non-
// negotiables, what they'll flex, and the principles. The neutral card wrapper
// is the caller's.
export function TradeOffsSummary({ result }: { result: TradeOffsResult }) {
  const nonNeg = result.values.filter((v) => v.bucket === "non-negotiable");
  const flex = result.values.filter((v) => v.bucket === "flexible");
  return (
    <>
      <p style={summaryStyles.heading}>{result.summaryLabel}</p>

      <div style={summaryStyles.scenarios}>
        {result.scenarios.map((s, i) => (
          <div key={i} style={summaryStyles.scenarioRow}>
            <p style={summaryStyles.scenarioTitle}>{s.title}</p>
            <div style={summaryStyles.leanTrack}>
              <span style={summaryStyles.leanPole}>{s.optionA}</span>
              <span style={summaryStyles.leanBar}>
                <span
                  style={{
                    ...summaryStyles.leanDot,
                    left: `calc(${Math.max(0, Math.min(100, s.lean))}% - 5px)`,
                  }}
                />
              </span>
              <span style={{ ...summaryStyles.leanPole, textAlign: "right" }}>
                {s.optionB}
              </span>
            </div>
            {(s.protect || s.sacrifice) && (
              <div style={summaryStyles.scenarioNotes}>
                {s.protect && (
                  <p style={summaryStyles.note}>
                    <span style={summaryStyles.noteKey}>Protect:</span>{" "}
                    {s.protect}
                  </p>
                )}
                {s.sacrifice && (
                  <p style={summaryStyles.note}>
                    <span style={summaryStyles.noteKey}>Won&apos;t sacrifice:</span>{" "}
                    {s.sacrifice}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {(nonNeg.length > 0 || flex.length > 0) && (
        <div style={summaryStyles.valueBlock}>
          {nonNeg.length > 0 && (
            <p style={summaryStyles.valueLine}>
              <span style={summaryStyles.noteKey}>Non-negotiable:</span>{" "}
              {nonNeg.map((v) => v.value).join(", ")}
            </p>
          )}
          {flex.length > 0 && (
            <p style={summaryStyles.valueLine}>
              <span style={summaryStyles.noteKey}>Important but flexible:</span>{" "}
              {flex.map((v) => v.value).join(", ")}
            </p>
          )}
        </div>
      )}

      {result.principles.length > 0 && (
        <div style={summaryStyles.principleBlock}>
          <p style={summaryStyles.principleHeading}>Decision principles</p>
          <ul style={summaryStyles.principleList}>
            {result.principles.map((p, i) => (
              <li key={i} style={summaryStyles.principleItem}>
                {p}
              </li>
            ))}
          </ul>
        </div>
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
  scenarios: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  scenarioRow: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  scenarioTitle: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    color: "var(--ink)",
    margin: 0,
  },
  leanTrack: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  leanPole: {
    flex: "0 1 30%",
    fontFamily: "var(--font-sans)",
    fontSize: "12px",
    color: "var(--text-muted)",
  },
  leanBar: {
    position: "relative",
    flex: 1,
    height: "4px",
    borderRadius: "2px",
    background: "var(--muted-surface)",
  },
  leanDot: {
    position: "absolute",
    top: "-3px",
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "var(--brand-primary)",
  },
  scenarioNotes: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  note: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    margin: 0,
  },
  noteKey: {
    fontWeight: 600,
    color: "var(--ink)",
  },
  valueBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    marginTop: "16px",
    paddingTop: "16px",
    borderTop: "1px solid var(--border)",
  },
  valueLine: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text)",
    margin: 0,
  },
  principleBlock: {
    marginTop: "16px",
    paddingTop: "16px",
    borderTop: "1px solid var(--border)",
  },
  principleHeading: {
    fontFamily: "var(--font-sans)",
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--ink)",
    margin: "0 0 6px",
  },
  principleList: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    margin: 0,
    paddingLeft: "18px",
  },
  principleItem: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text)",
  },
};

const tradeCss = `
  .trade-bucket:focus-visible, .trade-remove:focus-visible,
  .trade-add:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .trade-bucket[aria-pressed="false"]:hover { border-color: var(--brand-primary); }
  .trade-remove:hover { border-color: var(--brand-primary); }
  .trade-add:hover { background: var(--brand-primary-tint); }
  .trade-input:focus-visible {
    outline: none;
    border-color: var(--brand-primary);
    box-shadow: var(--focus-ring);
  }
  .trade-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--muted-surface);
    outline: none;
    cursor: pointer;
  }
  .trade-slider::-webkit-slider-thumb {
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
  .trade-slider::-moz-range-thumb {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--brand-primary);
    border: 2px solid var(--bg);
    box-shadow: var(--shadow-sm);
    cursor: pointer;
  }
  .trade-slider:focus-visible { box-shadow: var(--focus-ring); }
`;
