"use client";

// The one-time survey shown when a member finishes the programme — the "after"
// to the onboarding baseline. One scrollable page, every question optional, one
// Send at the end: the same low-pressure treatment as the per-session card, sized
// up for a considered end-of-programme read. Two questions (feelings, confidence)
// mirror the baseline word-for-word via the shared config, so the pilot can put
// before against after.
//
// It posts to /api/post-completion-survey via the userData hook, then marks the
// done flag so the dashboard card flips to its completed state. Saving is
// best-effort — a failed save never traps anyone on the form, and the thank-you
// still shows.

import { useState } from "react";
import Link from "next/link";
import { useUserData } from "@/lib/userData";
import {
  FEELINGS_OPTIONS,
  FEELINGS_MAX,
  FEELINGS_QUESTION,
  CONFIDENCE_QUESTION,
  CONFIDENCE_LOW_LABEL,
  CONFIDENCE_HIGH_LABEL,
  RATING_MIN,
  RATING_MAX,
  VITA_RATINGS,
  SENTENCE_MAX_CHARS,
  OPEN_MAX_CHARS,
  FEELINGS_OTHER_MAX_CHARS,
} from "@/lib/postCompletionSurvey";
import {
  STAGES,
  visibleModules,
  stageNameFor,
  titleFor,
} from "@/lib/modules";

const SCALE: number[] = Array.from(
  { length: RATING_MAX - RATING_MIN + 1 },
  (_, i) => RATING_MIN + i
);

export default function PostCompletionSurvey() {
  const userData = useUserData();
  const retirementStage = userData.getRetirementStage();
  const completed = userData.getCompletedIds();

  // Same completion test the dashboard uses to reveal the plan: every Stage 4
  // session this person sees is done.
  const stage4 = visibleModules(STAGES[3], retirementStage);
  const planComplete =
    stage4.length > 0 && stage4.every((m) => completed.includes(m.id));

  const [overallValue, setOverallValue] = useState<number | null>(null);
  const [feelings, setFeelings] = useState<string[]>([]);
  const [feelingsOther, setFeelingsOther] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [beforeThought, setBeforeThought] = useState("");
  const [afterThought, setAfterThought] = useState("");
  const [expectationsMet, setExpectationsMet] = useState("");
  const [vita, setVita] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(VITA_RATINGS.map((r) => [r.key, null]))
  );
  const [comfortSharing, setComfortSharing] = useState<number | null>(null);
  const [comfortImprove, setComfortImprove] = useState("");
  const [sessionStayed, setSessionStayed] = useState("");
  const [sessionStayedWhy, setSessionStayedWhy] = useState("");
  const [teamMessage, setTeamMessage] = useState("");

  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Tap a number to choose it; tap the same one again to clear it, so a mis-tap
  // is easy to undo and nothing is ever forced.
  function pickRating(
    current: number | null,
    value: number,
    set: (v: number | null) => void
  ) {
    set(current === value ? null : value);
  }

  function toggleFeeling(opt: string) {
    setFeelings((prev) =>
      prev.includes(opt)
        ? prev.filter((f) => f !== opt)
        : prev.length < FEELINGS_MAX
          ? [...prev, opt]
          : prev
    );
  }

  const clean = (s: string): string | null => {
    const t = s.trim();
    return t.length > 0 ? t : null;
  };

  async function handleSend() {
    if (saving) return;
    setSaving(true);
    try {
      await userData.savePostCompletionSurvey({
        overallValue,
        feelings,
        feelingsOther: clean(feelingsOther),
        planningConfidence: confidence,
        beforeThought: clean(beforeThought),
        afterThought: clean(afterThought),
        expectationsMet: clean(expectationsMet),
        vitaUnderstood: vita.understood ?? null,
        vitaGoodQuestions: vita.goodQuestions ?? null,
        vitaAuthentic: vita.authentic ?? null,
        vitaChallenged: vita.challenged ?? null,
        vitaDiscovered: vita.discovered ?? null,
        comfortSharing,
        comfortImprove: clean(comfortImprove),
        sessionStayed: sessionStayed || null,
        sessionStayedWhy: clean(sessionStayedWhy),
        teamMessage: clean(teamMessage),
      });
      userData.markPostSurveyDone();
    } catch {
      // best-effort — the thank-you still shows
    }
    setSubmitted(true);
  }

  // Already finished (this visit or a previous one): a quiet thank-you.
  if (submitted || userData.getPostSurveyDone()) {
    return (
      <section className="pcs pcs-note" aria-labelledby="pcs-thanks">
        <style>{css}</style>
        <h1 id="pcs-thanks" className="pcs-lede">
          Thank you.
        </h1>
        <p className="pcs-sub">
          Your answers help us shape Chorus Life for the people who come next.
        </p>
        <Link href="/home" className="pcs-back">
          Back to your dashboard ›
        </Link>
      </section>
    );
  }

  // Reached before finishing the programme (e.g. a stale link): a gentle nudge
  // rather than a dead end.
  if (!planComplete) {
    return (
      <section className="pcs pcs-note" aria-labelledby="pcs-early">
        <style>{css}</style>
        <h1 id="pcs-early" className="pcs-lede">
          Your plan isn&apos;t finished yet.
        </h1>
        <p className="pcs-sub">
          Once you&apos;ve completed the final Plan sessions, you&apos;ll be able
          to look back on the whole programme here.
        </p>
        <Link href="/home" className="pcs-back">
          Back to your dashboard ›
        </Link>
      </section>
    );
  }

  const sessionGroups = STAGES.map((s) => ({
    stageName: stageNameFor(s, retirementStage),
    sessions: visibleModules(s, retirementStage).map((m) => ({
      id: m.id,
      title: titleFor(m, retirementStage),
    })),
  })).filter((g) => g.sessions.length > 0);

  return (
    <section className="pcs" aria-labelledby="pcs-heading">
      <style>{css}</style>

      <header className="pcs-head">
        <h1 id="pcs-heading" className="pcs-lede">
          You&apos;ve built your Retirement Life Plan.
        </h1>
        <p className="pcs-sub">
          A few questions on how the programme has been for you. Your answers
          shape what we build next.
        </p>
      </header>

      {/* HOW IT LANDED */}
      <div className="pcs-card">
        <div className="pcs-sec">
          <h2 className="pcs-sec-title">The programme overall</h2>
        </div>
        <Scale
          label="Overall, how valuable did you find the programme?"
          lowLabel="Not valuable"
          highLabel="Very valuable"
          value={overallValue}
          onPick={(v) => pickRating(overallValue, v, setOverallValue)}
        />

        <fieldset className="q">
          <legend className="q-label">{FEELINGS_QUESTION}</legend>
          <p className="q-hint">Choose up to three.</p>
          <div className="chips" role="group" aria-label={FEELINGS_QUESTION}>
            {FEELINGS_OPTIONS.map((opt) => {
              const on = feelings.includes(opt);
              const full = feelings.length >= FEELINGS_MAX && !on;
              return (
                <button
                  key={opt}
                  type="button"
                  className="chip"
                  aria-pressed={on}
                  disabled={full}
                  onClick={() => toggleFeeling(opt)}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          <textarea
            className="note"
            rows={2}
            value={feelingsOther}
            maxLength={FEELINGS_OTHER_MAX_CHARS}
            placeholder="Anything else about how you're feeling? (optional)"
            onChange={(e) => setFeelingsOther(e.target.value)}
          />
        </fieldset>

        <Scale
          label={CONFIDENCE_QUESTION}
          lowLabel={CONFIDENCE_LOW_LABEL}
          highLabel={CONFIDENCE_HIGH_LABEL}
          value={confidence}
          onPick={(v) => pickRating(confidence, v, setConfidence)}
        />

        <fieldset className="q">
          <legend className="q-label">Complete these two sentences.</legend>
          <label className="sub">
            <span className="sub-label">Before Chorus Life, I thought…</span>
            <textarea
              className="note"
              rows={2}
              value={beforeThought}
              maxLength={SENTENCE_MAX_CHARS}
              onChange={(e) => setBeforeThought(e.target.value)}
            />
          </label>
          <label className="sub">
            <span className="sub-label">After Chorus Life, I now think…</span>
            <textarea
              className="note"
              rows={2}
              value={afterThought}
              maxLength={SENTENCE_MAX_CHARS}
              onChange={(e) => setAfterThought(e.target.value)}
            />
          </label>
        </fieldset>

        <label className="q">
          <span className="q-label">
            Did the programme meet what you were hoping for?
          </span>
          <textarea
            className="note"
            rows={3}
            value={expectationsMet}
            maxLength={OPEN_MAX_CHARS}
            placeholder="Whatever comes to mind…"
            onChange={(e) => setExpectationsMet(e.target.value)}
          />
        </label>
      </div>

      {/* VITA — the five agree/disagree statements as a compact grid, then the
          "being open" questions in the same section. */}
      <div className="pcs-card">
        <div className="pcs-sec">
          <h2 className="pcs-sec-title">Vita, your AI coach</h2>
          <p className="pcs-sec-sub">How much do you agree with each?</p>
        </div>

        <div className="vgrid" role="group" aria-label="Rate Vita, your AI coach">
          {/* shared header: anchors, then the column numbers. On phones the
              numbers hide (each cell already shows its number) and the anchors
              sit above the stacked rows. */}
          <div className="vgrid-head" aria-hidden="true">
            <span className="vgrid-headspacer" />
            <div className="vgrid-headcells">
              <div className="vgrid-anchorbar">
                <span>Strongly disagree</span>
                <span>Strongly agree</span>
              </div>
              <div className="vgrid-nums">
                {SCALE.map((n) => (
                  <span key={`h-${n}`} className="vgrid-num">
                    {n}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {/* one row per statement: label + five cells. Wide screens lay label
              and cells side by side; phones stack them. */}
          {VITA_RATINGS.map((r) => (
            <div
              key={r.key}
              className="vgrid-row"
              role="radiogroup"
              aria-label={r.label}
            >
              <span className="vgrid-rowlabel">{r.label}</span>
              <div className="vgrid-cells">
                {SCALE.map((n) => (
                  <button
                    key={`${r.key}-${n}`}
                    type="button"
                    className="vgrid-cell"
                    role="radio"
                    aria-checked={vita[r.key] === n}
                    aria-label={`${r.label}: ${n} of ${RATING_MAX}`}
                    onClick={() =>
                      setVita((prev) => ({
                        ...prev,
                        [r.key]: prev[r.key] === n ? null : n,
                      }))
                    }
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Scale
          label="How comfortable were you being open with Vita?"
          lowLabel="Not comfortable"
          highLabel="Very comfortable"
          value={comfortSharing}
          onPick={(v) => pickRating(comfortSharing, v, setComfortSharing)}
        />
        <label className="q">
          <span className="q-label">
            What would have made you more comfortable being open with Vita?
          </span>
          <textarea
            className="note"
            rows={3}
            value={comfortImprove}
            maxLength={OPEN_MAX_CHARS}
            placeholder="A word or two is plenty…"
            onChange={(e) => setComfortImprove(e.target.value)}
          />
        </label>
      </div>

      {/* THE SESSIONS */}
      <div className="pcs-card">
        <div className="pcs-sec">
          <h2 className="pcs-sec-title">The sessions</h2>
        </div>
        <label className="q">
          <span className="q-label">
            Which one session has stayed with you most?
          </span>
          <select
            className="select"
            value={sessionStayed}
            onChange={(e) => setSessionStayed(e.target.value)}
          >
            <option value="">Choose a session…</option>
            {sessionGroups.map((g) => (
              <optgroup key={g.stageName} label={g.stageName}>
                {g.sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="q">
          <span className="q-label">What made it stand out?</span>
          <textarea
            className="note"
            rows={2}
            value={sessionStayedWhy}
            maxLength={OPEN_MAX_CHARS}
            onChange={(e) => setSessionStayedWhy(e.target.value)}
          />
        </label>
      </div>

      {/* ANYTHING ELSE */}
      <div className="pcs-card">
        <div className="pcs-sec">
          <h2 className="pcs-sec-title">One last thing</h2>
        </div>
        <label className="q">
          <span className="q-label">
            If you could tell the Chorus Life team one thing, what would it be?
          </span>
          <textarea
            className="note"
            rows={4}
            value={teamMessage}
            maxLength={OPEN_MAX_CHARS}
            onChange={(e) => setTeamMessage(e.target.value)}
          />
        </label>
      </div>

      <div className="pcs-actions">
        <button
          type="button"
          className="pcs-send"
          disabled={saving}
          onClick={handleSend}
        >
          {saving ? "Sending…" : "Send my answers"}
        </button>
      </div>
    </section>
  );
}

// One 1–5 question: the label, a row of five numbered buttons, and a word anchor
// under each end. Tapping the chosen number again clears it. Matches the
// per-session card's scale so the two read as one instrument.
function Scale({
  label,
  lowLabel,
  highLabel,
  value,
  onPick,
}: {
  label: string;
  lowLabel: string;
  highLabel: string;
  value: number | null;
  onPick: (v: number) => void;
}) {
  return (
    <fieldset className="q">
      <legend className="q-label">{label}</legend>
      <div className="scale-row" role="group" aria-label={label}>
        {SCALE.map((v) => (
          <button
            key={v}
            type="button"
            className="opt"
            aria-pressed={value === v}
            onClick={() => onPick(v)}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="scale-ends">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </fieldset>
  );
}

const css = `
.pcs{
  width:100%;max-width:560px;margin:0 auto;
  padding:8px 20px 64px;
  display:flex;flex-direction:column;gap:18px;
}
.pcs-head{display:flex;flex-direction:column;gap:10px;margin:8px 0 2px}
.pcs-lede{
  font-family:var(--font-serif);
  font-size:var(--fs-h1);
  line-height:1.2;
  color:var(--ink);
  margin:0;
}
.pcs-sub{
  font-family:var(--font-sans);
  font-size:var(--fs-body);
  line-height:var(--lh-body);
  color:var(--text-muted);
  margin:0;
}
.pcs-card{
  background:var(--bg);
  border:1px solid var(--border);
  border-radius:var(--r-lg);
  box-shadow:var(--shadow-sm);
  padding:24px 22px;
  display:flex;flex-direction:column;gap:24px;
}
.pcs-sec{display:flex;flex-direction:column;gap:4px}
.pcs-sec-title{
  font-family:var(--font-serif);
  font-size:var(--fs-h2);
  color:var(--ink);
  margin:0;
}
.pcs-sec-sub{
  font-family:var(--font-sans);
  font-size:var(--fs-sm);
  color:var(--text-muted);
  margin:0;
}
.pcs .q{
  border:none;padding:0;margin:0;
  display:flex;flex-direction:column;gap:10px;
}
.pcs .q-label{
  font-family:var(--font-sans);
  font-size:var(--fs-body);
  font-weight:600;
  color:var(--ink);
  padding:0;
  line-height:1.4;
}
.pcs .q-hint{
  font-family:var(--font-sans);
  font-size:var(--fs-sm);
  color:var(--text-muted);
  margin:-4px 0 0;
}
.pcs .sub{display:flex;flex-direction:column;gap:7px}
.pcs .sub-label{
  font-family:var(--font-sans);
  font-size:var(--fs-sm);
  font-weight:600;
  color:var(--text-muted);
}
.pcs .scale-row{display:flex;gap:5px}
.pcs .opt{
  flex:1 1 0;min-width:0;
  font-family:var(--font-sans);
  font-size:var(--fs-body);
  font-weight:600;
  color:var(--ink);
  background:var(--bg);
  border:1.5px solid var(--border-strong);
  border-radius:var(--r-sm);
  padding:12px 0;min-height:46px;cursor:pointer;
  transition:background .12s ease,border-color .12s ease,color .12s ease;
}
.pcs .opt:hover{border-color:var(--brand-primary)}
.pcs .opt[aria-pressed="true"]{
  background:var(--brand-primary);
  border-color:var(--brand-primary);
  color:var(--brand-on-primary);
}
.pcs .scale-ends{
  display:flex;justify-content:space-between;margin-top:2px;
  font-family:var(--font-sans);
  font-size:var(--fs-eyebrow);
  color:var(--text-muted);
}
/* Vita ratings as a Likert matrix on wider screens: statement rows against
   shared 1–5 columns, anchors shown once. On phones (≤520px) it restacks — each
   statement's label sits above a full-width row of five cells — so nothing is
   squeezed and it never scrolls sideways. */
.pcs .vgrid{display:flex;flex-direction:column;gap:12px}
.pcs .vgrid-head,
.pcs .vgrid-row{
  display:grid;grid-template-columns:minmax(0,1fr) auto;
  gap:14px;align-items:center;
}
.pcs .vgrid-headcells{display:flex;flex-direction:column;gap:4px}
.pcs .vgrid-anchorbar{
  display:flex;justify-content:space-between;
  font-family:var(--font-sans);
  font-size:var(--fs-eyebrow);
  color:var(--text-muted);
  padding:0 2px;
}
.pcs .vgrid-nums,
.pcs .vgrid-cells{display:grid;grid-template-columns:repeat(5,44px);gap:6px}
.pcs .vgrid-num{
  text-align:center;
  font-family:var(--font-sans);
  font-size:var(--fs-sm);font-weight:600;
  color:var(--text-muted);
}
.pcs .vgrid-rowlabel{
  font-family:var(--font-sans);
  font-size:var(--fs-sm);font-weight:600;
  color:var(--ink);line-height:1.3;
}
.pcs .vgrid-cell{
  font-family:var(--font-sans);
  font-size:var(--fs-sm);font-weight:600;
  color:var(--ink);
  background:var(--bg);
  border:1.5px solid var(--border-strong);
  border-radius:var(--r-sm);
  min-height:44px;cursor:pointer;
  transition:background .12s ease,border-color .12s ease,color .12s ease;
}
.pcs .vgrid-cell:hover{border-color:var(--brand-primary)}
.pcs .vgrid-cell[aria-checked="true"]{
  background:var(--brand-primary);
  border-color:var(--brand-primary);
  color:var(--brand-on-primary);
}
.pcs .vgrid-cell:focus-visible{outline:none;box-shadow:var(--focus-ring)}
@media (max-width:520px){
  .pcs .vgrid-head{grid-template-columns:1fr}
  .pcs .vgrid-headspacer{display:none}
  .pcs .vgrid-nums{display:none}
  .pcs .vgrid-row{grid-template-columns:1fr;gap:8px}
  .pcs .vgrid-cells{grid-template-columns:repeat(5,1fr)}
}
.pcs .chips{display:flex;flex-wrap:wrap;gap:8px}
.pcs .chip{
  font-family:var(--font-sans);
  font-size:var(--fs-sm);
  font-weight:500;
  color:var(--ink);
  background:var(--bg);
  border:1.5px solid var(--border-strong);
  border-radius:999px;
  padding:9px 15px;min-height:40px;cursor:pointer;
  transition:background .12s ease,border-color .12s ease,color .12s ease;
}
.pcs .chip:hover:not(:disabled){border-color:var(--brand-primary)}
.pcs .chip[aria-pressed="true"]{
  background:var(--brand-primary);
  border-color:var(--brand-primary);
  color:var(--brand-on-primary);
}
.pcs .chip:disabled{opacity:.45;cursor:default}
.pcs .note{
  font-family:var(--font-sans);
  font-size:var(--fs-body);
  line-height:var(--lh-body);
  color:var(--ink);
  background:var(--bg);
  border:1.5px solid var(--border-strong);
  border-radius:var(--r-sm);
  padding:12px 14px;min-height:60px;resize:vertical;
  width:100%;box-sizing:border-box;
}
.pcs .note::placeholder{color:var(--text-faint)}
.pcs .note:focus{border-color:var(--brand-primary)}
.pcs .select{
  font-family:var(--font-sans);
  font-size:var(--fs-body);
  color:var(--ink);
  background:var(--bg);
  border:1.5px solid var(--border-strong);
  border-radius:var(--r-sm);
  padding:12px 14px;min-height:48px;
  width:100%;box-sizing:border-box;cursor:pointer;
}
.pcs .select:focus{border-color:var(--brand-primary)}
.pcs-actions{display:flex;flex-direction:column;gap:12px;align-items:center;margin-top:6px}
.pcs-send{
  font-family:var(--font-sans);
  font-size:var(--fs-body);
  font-weight:600;
  color:var(--brand-on-primary);
  background:var(--brand-primary);
  border:none;border-radius:var(--r-sm);
  padding:15px 40px;min-height:52px;cursor:pointer;
  width:100%;max-width:340px;
}
.pcs-send:hover:not(:disabled){background:var(--brand-primary-hover)}
.pcs-send:disabled{opacity:.55;cursor:default}
.pcs-fine{
  font-family:var(--font-sans);
  font-size:var(--fs-sm);
  color:var(--text-muted);
  text-align:center;margin:0;
}
.pcs-note{align-items:flex-start;gap:14px;padding-top:40px}
.pcs-back{
  font-family:var(--font-sans);
  font-size:var(--fs-body);
  font-weight:600;
  color:var(--brand-primary);
  text-decoration:none;margin-top:4px;
}
.pcs-back:hover{text-decoration:underline;text-underline-offset:3px}
.pcs .opt:focus-visible,
.pcs .chip:focus-visible,
.pcs .note:focus-visible,
.pcs .select:focus-visible,
.pcs-send:focus-visible,
.pcs-back:focus-visible{
  outline:none;box-shadow:var(--focus-ring);border-radius:var(--r-sm);
}
`;
