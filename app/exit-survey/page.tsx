"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  SITUATION_OPTIONS,
  SITUATION_OTHER,
  REASON_OPTIONS,
  REASON_OTHER,
  LOOKING_BACK_OPTIONS,
  LOOKING_BACK_OTHER,
  RECONTACT_OPTIONS,
  GENDER_OPTIONS,
  GENDER_SELF_DESCRIBE,
  WORK_STATUS_OPTIONS,
  SHORT_TEXT_MAX,
  LONG_TEXT_MAX,
  EMAIL_MAX,
} from "@/lib/exitSurvey";

// The public exit survey for pilot participants who told us they won't be
// continuing — including the many who never made an account. It is therefore a
// no-login page (allowlisted in proxy.ts) and posts to a public route with no
// user id. One scrolling page rather than a stepped wizard: for people who have
// already disengaged, seeing the whole (short) thing at once reads as less
// effort than an open-ended sequence of screens. Every question is optional.

function trimOrNull(v: string): string | null {
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export default function ExitSurveyPage() {
  // Q1–Q7 + demographics. Each starts empty; nothing is required.
  const [situation, setSituation] = useState("");
  const [situationOther, setSituationOther] = useState("");
  const [reasons, setReasons] = useState<string[]>([]);
  const [reasonsOther, setReasonsOther] = useState("");
  const [lookingBack, setLookingBack] = useState("");
  const [lookingBackOther, setLookingBackOther] = useState("");
  const [clarity, setClarity] = useState<number | null>(null);
  const [easier, setEasier] = useState("");
  const [nps, setNps] = useState<number | null>(null);
  const [npsWhy, setNpsWhy] = useState("");
  const [recontact, setRecontact] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [genderSelf, setGenderSelf] = useState("");
  const [workStatus, setWorkStatus] = useState("");
  const [email, setEmail] = useState("");

  // An optional tag carried in the invite link (?ref=…). Stored as-is so the
  // team can attribute responses to a particular send if they ever use it; if
  // they never add it, it stays null and changes nothing.
  const [ref, setRef] = useState<string | null>(null);
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("ref");
    if (v) setRef(v.slice(0, SHORT_TEXT_MAX));
  }, []);

  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle"
  );

  function toggleReason(opt: string) {
    setReasons((prev) =>
      prev.includes(opt) ? prev.filter((r) => r !== opt) : [...prev, opt]
    );
  }

  async function submit() {
    setStatus("sending");
    const payload = {
      situation: situation || null,
      situationOther:
        situation === SITUATION_OTHER ? trimOrNull(situationOther) : null,
      reasons,
      reasonsOther: reasons.includes(REASON_OTHER)
        ? trimOrNull(reasonsOther)
        : null,
      lookingBack: lookingBack || null,
      lookingBackOther:
        lookingBack === LOOKING_BACK_OTHER ? trimOrNull(lookingBackOther) : null,
      clarity,
      easier: trimOrNull(easier),
      nps,
      npsWhy: trimOrNull(npsWhy),
      recontact: recontact || null,
      age: age.trim() ? Number(age) : null,
      gender:
        gender === GENDER_SELF_DESCRIBE
          ? trimOrNull(genderSelf)
          : gender || null,
      workStatus: workStatus || null,
      email: trimOrNull(email),
      ref,
    };
    try {
      const res = await fetch("/api/exit-survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <main className="exit">
        <style>{css}</style>
        <div className="exit-col">
          <div className="thanks">
            <h1 className="thanks-head">Thank you</h1>
            <p className="thanks-body">
              Your answers are in, and they help us make Chorus Life better for
              the people who come next. Thank you for taking the time.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="exit">
      <style>{css}</style>
      <div className="exit-col">
        <header className="intro">
          <h1 className="intro-head">Before you go</h1>
          <p className="intro-body">
            Thank you for helping us improve. We&rsquo;d really like to hear
            what didn&rsquo;t work just as much as what did&mdash;in fact,
            negative feedback is often the most useful. Every response helps us
            make the product better for future users.
          </p>
          <p className="intro-note">
            It takes about two minutes, and every question is optional.
          </p>
        </header>

        {/* Q1 */}
        <Question n={1} label="Which best describes your situation?">
          <Choice
            options={SITUATION_OPTIONS}
            value={situation}
            onChange={setSituation}
          />
          {situation === SITUATION_OTHER && (
            <OtherText
              placeholder="Tell us a little more&hellip;"
              value={situationOther}
              onChange={setSituationOther}
              max={SHORT_TEXT_MAX}
            />
          )}
        </Question>

        {/* Q2 */}
        <Question
          n={2}
          label="What was the main reason you weren't able to continue?"
          sub="Choose as many as apply."
        >
          <div className="cards">
            {REASON_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                className={reasons.includes(opt) ? "card is-on" : "card"}
                aria-pressed={reasons.includes(opt)}
                onClick={() => toggleReason(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
          {reasons.includes(REASON_OTHER) && (
            <OtherText
              placeholder="Tell us a little more&hellip;"
              value={reasonsOther}
              onChange={setReasonsOther}
              max={SHORT_TEXT_MAX}
            />
          )}
        </Question>

        {/* Q3 */}
        <Question
          n={3}
          label="Looking back, which statement feels closest to the truth?"
        >
          <Choice
            options={LOOKING_BACK_OPTIONS}
            value={lookingBack}
            onChange={setLookingBack}
          />
          {lookingBack === LOOKING_BACK_OTHER && (
            <OtherText
              placeholder="Tell us a little more&hellip;"
              value={lookingBackOther}
              onChange={setLookingBackOther}
              max={SHORT_TEXT_MAX}
            />
          )}
        </Question>

        {/* Q4 */}
        <Question
          n={4}
          label="Before you started, how clear was it what Chorus Life would help you achieve?"
        >
          <Scale
            from={1}
            to={5}
            value={clarity}
            onPick={setClarity}
            lowLabel="Not at all clear"
            highLabel="Very clear"
          />
        </Question>

        {/* Q5 */}
        <Question
          n={5}
          label="What, if anything, might have made it easier for you to continue?"
        >
          <textarea
            className="textarea"
            value={easier}
            onChange={(e) => setEasier(e.target.value)}
            placeholder="Your answer&hellip;"
            rows={4}
            maxLength={LONG_TEXT_MAX}
          />
        </Question>

        {/* Q6 */}
        <Question
          n={6}
          label="Given what you've seen of the Chorus Life app, how likely are you to recommend it to a friend or colleague?"
        >
          <Scale
            from={0}
            to={10}
            value={nps}
            onPick={setNps}
            lowLabel="Not at all likely"
            highLabel="Extremely likely"
          />
          <label className="why">
            <span className="why-label">Why?</span>
            <textarea
              className="textarea"
              value={npsWhy}
              onChange={(e) => setNpsWhy(e.target.value)}
              placeholder="Optional&hellip;"
              rows={3}
              maxLength={LONG_TEXT_MAX}
            />
          </label>
        </Question>

        {/* Q7 */}
        <Question n={7} label="Would you be interested in hearing from us again?">
          <Choice
            options={RECONTACT_OPTIONS}
            value={recontact}
            onChange={setRecontact}
          />
          <label className="email-field">
            <span className="email-label">
              If yes, what email can we reach you on?{" "}
              <span className="email-optional">(optional)</span>
            </span>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              maxLength={EMAIL_MAX}
              autoComplete="email"
            />
          </label>
        </Question>

        {/* Demographics */}
        <div className="demo-intro">
          <h2 className="demo-head">A little about you</h2>
          <p className="demo-note">
            These questions are optional, but will help us contextualise the
            feedback we receive.
          </p>
        </div>

        <Question n={8} label="Your age">
          <input
            type="number"
            inputMode="numeric"
            className="input input-age"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="e.g. 62"
            min={16}
            max={120}
          />
        </Question>

        <Question n={9} label="How would you describe your gender?">
          <Choice options={GENDER_OPTIONS} value={gender} onChange={setGender} />
          {gender === GENDER_SELF_DESCRIBE && (
            <OtherText
              placeholder="Your description&hellip;"
              value={genderSelf}
              onChange={setGenderSelf}
              max={SHORT_TEXT_MAX}
            />
          )}
        </Question>

        <Question n={10} label="Which best describes where you are with work?">
          <Choice
            options={WORK_STATUS_OPTIONS}
            value={workStatus}
            onChange={setWorkStatus}
          />
        </Question>

        <div className="submit-row">
          <button
            type="button"
            className="submit"
            onClick={submit}
            disabled={status === "sending"}
          >
            {status === "sending" ? "Sending…" : "Send my feedback"}
          </button>
          {status === "error" && (
            <p className="err" role="alert">
              Something went wrong sending that. Please try again in a moment.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

// A numbered question block with a heading and optional sub-line.
function Question({
  n,
  label,
  sub,
  children,
}: {
  n: number;
  label: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <section className="q">
      <h2 className="q-label">
        <span className="q-num">{n}</span>
        {label}
      </h2>
      {sub && <p className="q-sub">{sub}</p>}
      {children}
    </section>
  );
}

// Single-select cards.
function Choice({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="cards">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={value === opt ? "card is-on" : "card"}
          aria-pressed={value === opt}
          onClick={() => onChange(value === opt ? "" : opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// The reveal-on-"other" free-text follow-up.
function OtherText({
  placeholder,
  value,
  onChange,
  max,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
}) {
  return (
    <textarea
      className="textarea other"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={2}
      maxLength={max}
    />
  );
}

// A numeric scale (1–5 or 0–10) with a word at each pole. Clicking the picked
// number again clears it, so a mis-tap isn't stuck.
function Scale({
  from,
  to,
  value,
  onPick,
  lowLabel,
  highLabel,
}: {
  from: number;
  to: number;
  value: number | null;
  onPick: (v: number | null) => void;
  lowLabel: string;
  highLabel: string;
}) {
  const nums: number[] = [];
  for (let i = from; i <= to; i++) nums.push(i);
  return (
    <>
      <div className="scale" role="group">
        {nums.map((num) => (
          <button
            key={num}
            type="button"
            className={value === num ? "scale-btn is-on" : "scale-btn"}
            aria-pressed={value === num}
            onClick={() => onPick(value === num ? null : num)}
          >
            {num}
          </button>
        ))}
      </div>
      <div className="scale-ends">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </>
  );
}

const css = `
.exit{min-height:100dvh;background:var(--bg-alt);display:flex;justify-content:center;padding:56px 24px 96px;font-family:var(--font-sans)}
.exit-col{width:100%;max-width:640px;display:flex;flex-direction:column}

.exit .intro{background:var(--warm-surface);border:1px solid var(--warm-line);border-radius:var(--r-lg);box-shadow:var(--shadow-sm);padding:28px 30px;margin:0 0 12px}
.exit .intro-head{font-family:var(--font-serif);font-size:var(--fs-display);font-weight:600;color:var(--ink);line-height:1.2;margin:0 0 14px}
.exit .intro-body{font-family:var(--font-sans);font-size:var(--fs-body);line-height:var(--lh-body);color:var(--text);margin:0 0 12px}
.exit .intro-note{font-size:var(--fs-sm);color:var(--text-muted);margin:0}

.exit .q{padding:26px 0 4px;border-top:1px solid var(--border);margin-top:22px}
.exit .q-label{display:flex;gap:12px;align-items:baseline;font-family:var(--font-serif);font-size:var(--fs-h2);font-weight:600;color:var(--ink);line-height:1.3;margin:0 0 8px}
.exit .q-num{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:26px;border-radius:999px;background:var(--brand-primary-tint);color:var(--brand-primary);font-family:var(--font-sans);font-size:var(--fs-sm);font-weight:700;translate:0 -1px}
.exit .q-sub{font-size:var(--fs-sm);color:var(--text-muted);margin:0 0 16px}
.exit .q > .cards,.exit .q > .textarea,.exit .q > .scale,.exit .q > .input{margin-top:14px}

.exit .cards{display:flex;flex-direction:column;gap:10px}
.exit .card{width:100%;text-align:left;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:16px 18px;min-height:52px;font-family:var(--font-sans);font-size:var(--fs-body);font-weight:500;color:var(--text);cursor:pointer;transition:background .15s ease,border-color .15s ease,box-shadow .15s ease}
.exit .card:hover{border-color:var(--border-strong)}
.exit .card.is-on{background:var(--brand-primary-tint);border-color:var(--brand-primary);color:var(--ink);font-weight:600}
.exit .card:focus-visible{outline:none;box-shadow:var(--focus-ring)}

.exit .scale{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}
.exit .scale-btn{flex:1 1 44px;min-width:44px;min-height:52px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);box-shadow:var(--shadow-sm);font-family:var(--font-sans);font-size:var(--fs-section);font-weight:600;color:var(--text);cursor:pointer;transition:background .15s ease,border-color .15s ease,box-shadow .15s ease}
.exit .scale-btn:hover{border-color:var(--border-strong)}
.exit .scale-btn.is-on{background:var(--brand-primary-tint);border-color:var(--brand-primary);color:var(--ink)}
.exit .scale-btn:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.exit .scale-ends{display:flex;justify-content:space-between;gap:12px;font-size:var(--fs-sm);color:var(--text-muted)}

.exit .textarea,.exit .input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px;font-family:var(--font-sans);font-size:var(--fs-body);color:var(--text);box-sizing:border-box;transition:border-color .15s ease,box-shadow .15s ease}
.exit .textarea{min-height:96px;resize:vertical;line-height:var(--lh-body)}
.exit .textarea.other{margin-top:12px;min-height:64px}
.exit .input{min-height:52px}
.exit .input-age{max-width:160px}
.exit .textarea:hover,.exit .input:hover{border-color:var(--border-strong)}
.exit .textarea:focus-visible,.exit .input:focus-visible{outline:none;border-color:var(--brand-primary);box-shadow:var(--focus-ring)}

.exit .why{display:block;margin-top:16px}
.exit .why-label{display:block;font-size:var(--fs-body);font-weight:600;color:var(--ink);margin-bottom:8px}
.exit .email-field{display:block;margin-top:16px}
.exit .email-label{display:block;font-size:var(--fs-sm);color:var(--text);margin-bottom:8px}
.exit .email-optional{color:var(--text-muted)}

.exit .demo-intro{border-top:1px solid var(--border);margin-top:34px;padding-top:28px}
.exit .demo-head{font-family:var(--font-serif);font-size:var(--fs-h2);font-weight:600;color:var(--ink);margin:0 0 6px}
.exit .demo-note{font-size:var(--fs-sm);color:var(--text-muted);margin:0}
.exit .demo-intro + .q{border-top:none;margin-top:0}

.exit .submit-row{margin-top:36px;display:flex;flex-direction:column;gap:12px;align-items:flex-start}
.exit .submit{background:var(--brand-primary);color:var(--brand-on-primary);border:none;border-radius:var(--r-sm);padding:15px 30px;min-height:50px;font-family:var(--font-sans);font-size:var(--fs-body);font-weight:600;cursor:pointer}
.exit .submit:hover:not(:disabled){background:var(--brand-primary-hover)}
.exit .submit:disabled{opacity:.55;cursor:not-allowed}
.exit .submit:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.exit .err{font-size:var(--fs-sm);color:var(--danger,#b3261e);margin:0}

.exit .thanks{background:var(--warm-surface);border:1px solid var(--warm-line);border-radius:var(--r-lg);box-shadow:var(--shadow-sm);padding:40px 34px;margin-top:40px}
.exit .thanks-head{font-family:var(--font-serif);font-size:var(--fs-display);font-weight:600;color:var(--ink);margin:0 0 14px}
.exit .thanks-body{font-size:var(--fs-body);line-height:var(--lh-body);color:var(--text);margin:0}

@media (max-width:560px){
  .exit{padding:32px 16px 72px}
  .exit .intro{padding:22px 20px}
  .exit .intro-head{font-size:28px}
}
`;
