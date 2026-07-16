"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import ProviderBand from "../components/ProviderBand";
import VitaMark from "../components/VitaMark";
import ChorusVectorGraphic from "../components/ChorusVectorGraphic";
import {
  useUserData,
  type CoachTone,
  type RetirementStage,
} from "@/lib/userData";
import { RETIREMENT_PATHS } from "@/lib/flags";

// Where the person is with work and retirement, asked before the horizon and
// motivation questions when the RETIREMENT_PATHS flag is on. Each label maps to a
// stable RetirementStage code stored against the user. The two not-yet-retired
// stages (working / winding_down) are the only ones that go on to see the
// horizon and motivation questions.
const STATUS_OPTIONS: { label: string; value: RetirementStage }[] = [
  { label: "Still working, planning ahead", value: "working" },
  { label: "Winding down / phasing out of work", value: "winding_down" },
  { label: "Retired in the last 2 years", value: "recently_retired" },
  { label: "Retired more than 2 years ago", value: "established" },
];

const HORIZON_OPTIONS = [
  "Less than 2 years",
  "2–5 years",
  "5–10 years",
  "More than 10 years",
  "Not sure",
];

const PARTNER_OPTIONS = ["Yes", "No"];

const MOTIVATION_OPTIONS = [
  "A big birthday or milestone",
  "Wanting to make the most of this time",
  "A change at work or in life",
  "Just curious for now",
];

// Health-data consent shown on the welcome step — a standalone agreement, kept
// separate from the AI-disclaimer tick, and required before continuing. Held as
// constants so the exact wording is unambiguous (and can't be nicked by the
// react/no-unescaped-entities rule the way inline JSX apostrophes would be). If
// this wording changes, bump HEALTH_CONSENT_VERSION in lib/userData.
const HEALTH_CONSENT_HEADING = "Your health-related information";
const HEALTH_CONSENT_BODY =
  "As you work through the programme, Vita will ask about things like your energy, sleep, eating, how you're recovering, how ready you feel for retirement, your hearing and eyesight, and your hopes and fears. Some of this counts as health information, which the law treats with extra care. We store it securely and use it only to tailor your plan. We won't let a person read your responses unless you separately agree, and you can delete everything at any time.";
const HEALTH_CONSENT_LABEL =
  "I agree to Chorus Life collecting and using my health-related information as described above.";

// Vita's register, chosen here and stored against the user. Each label maps to a
// stable code value (CoachTone) the chat API turns into a tone directive. All
// three are real choices; "Warm and friendly" is simply pre-selected.
const TONE_OPTIONS: { label: string; value: CoachTone }[] = [
  { label: "Warm and friendly", value: "warm" },
  { label: "More professional", value: "professional" },
  { label: "Lighter and playful", value: "playful" },
];

// /onboarding?preview=1 — walk the REAL flow without touching real data.
//
// The form is otherwise unreviewable once you've completed it: it redirects to
// /home on sight, and there is no second account. Rather than a copy of the
// screens (which would drift from these ones the moment either changed), preview
// intercepts the DATA LAYER at a single seam: every write becomes a no-op and
// onboarding always reports itself unfinished, so the real page renders the real
// steps and nothing reaches the database. The prefill still reads, so it looks
// like a true first run.
function usePreviewData(real: ReturnType<typeof useUserData>) {
  const preview =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("preview") === "1";
  if (!preview) return { data: real, preview: false };
  return {
    preview: true,
    // Every write this page makes, stubbed. If a new one is added to the flow it
    // must be added here too, or preview will write it for real.
    data: {
      ...real,
      isOnboardingComplete: () => false,
      saveOnboarding: async () => {},
      markOnboardingComplete: async () => {},
      recordHealthConsent: async () => {},
      setPreferredName: async () => {},
    } as ReturnType<typeof useUserData>,
  };
}

export default function OnboardingPage() {
  const { user, isLoaded } = useUser();
  const realData = useUserData();
  const { data, preview } = usePreviewData(realData);
  const router = useRouter();

  // The flow is an ordered list of step keys, and stepIndex points at the current
  // one. The list is computed each render (below) from the flag and the chosen
  // status, so inserting the status step and gating horizon/motivation never
  // needs the handlers to know fixed step numbers.
  const [stepIndex, setStepIndex] = useState(0);
  const [understood, setUnderstood] = useState(false);
  // The health-data consent tick — its own gate, separate from `understood`.
  // Both must be ticked before the welcome step lets them continue.
  const [healthConsent, setHealthConsent] = useState(false);
  const [name, setName] = useState("");
  const [nameInit, setNameInit] = useState(false);
  const [partner, setPartner] = useState("");
  const [dob, setDob] = useState("");
  const [statusLabel, setStatusLabel] = useState("");
  const [retirementStage, setRetirementStage] = useState<RetirementStage | "">(
    ""
  );
  const [horizon, setHorizon] = useState("");
  const [motivation, setMotivation] = useState("");
  // Pre-select "Warm and friendly" — it's the default, not the only proper choice.
  const [tone, setTone] = useState<CoachTone>("warm");

  // The horizon question ("how far from retirement") only makes sense for someone
  // not yet retired. With the flag off it's always shown (today's flow); with it
  // on it's gated to the two not-yet-retired stages, so the retired cohorts skip
  // it. The motivation question ("what's brought you here") is stage-neutral and
  // is always shown, whatever stage they're in.
  const notYetRetired =
    retirementStage === "working" || retirementStage === "winding_down";
  const showHorizon = !RETIREMENT_PATHS || notYetRetired;

  type StepKey =
    | "welcome"
    | "name"
    | "partner"
    | "dob"
    | "status"
    | "horizon"
    | "motivation"
    | "tone";

  const steps: StepKey[] = [
    "welcome",
    "name",
    "partner",
    "dob",
    ...(RETIREMENT_PATHS ? (["status"] as StepKey[]) : []),
    ...(showHorizon ? (["horizon"] as StepKey[]) : []),
    "motivation",
    "tone",
  ];
  // The status step (when shown) only ever inserts the horizon step AFTER itself,
  // so advancing by one index is always safe — nothing before the current position
  // shifts. Clamp in case a change to the status answer shrank the list (e.g.
  // picking a retired stage removes the horizon step) while ahead of it.
  const safeIndex = Math.min(stepIndex, steps.length - 1);
  const current = steps[safeIndex];
  const goNext = () => setStepIndex((i) => i + 1);
  // Back: step one screen earlier. Answers already given stay in state (and are
  // saved), so the earlier step reappears with its previous choice selected and
  // can be changed. Never goes before the welcome screen.
  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));

  // Once the data layer has loaded (running the one-time migration if needed),
  // anyone who has already finished onboarding is sent straight to /home — they
  // never see the form. Someone only part-way through (answers but no complete
  // flag) stays here; their partial data has already been migrated, so nothing
  // is lost.
  const alreadyOnboarded = !data.loading && data.isOnboardingComplete();
  useEffect(() => {
    if (alreadyOnboarded) router.replace("/home");
  }, [alreadyOnboarded, router]);

  // Pre-fill the name field once the snapshot is loaded: any preferred name
  // they've already set, else Clerk's firstName. Leaves it blank when there's
  // nothing — the field is optional and the greeting falls back gracefully.
  if (user && !data.loading && !nameInit) {
    setNameInit(true);
    setName(data.getPreferredName() || user.firstName || "");
  }

  // Hold the form back until we know whether they belong here. The brief
  // "setting things up" covers Clerk resolving and the first data load (which
  // may include the one-time migration from localStorage).
  if (!isLoaded || data.loading || alreadyOnboarded) {
    return (
      <>
        <ProviderBand />
        <main className="rlp-onb">
          <style>{css}</style>
          <div className="column">
            <p className="paragraph">Setting things up…</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <ProviderBand />
      <main className="rlp-onb">
        <style>{css}</style>
        <div className="column">
          {preview && (
            <p className="onb-preview-note">
              Preview &mdash; the real onboarding flow. Nothing you do here is saved.
            </p>
          )}
          {current !== "welcome" && (
            <button type="button" className="onb-back" onClick={goBack}>
              ← Back
            </button>
          )}
          {current === "welcome" && (
            <Welcome
              firstName={user?.firstName?.trim() || ""}
              understood={understood}
              setUnderstood={setUnderstood}
              healthConsent={healthConsent}
              setHealthConsent={setHealthConsent}
              onContinue={async () => {
                // Stamp the health-data consent as they leave the welcome — the
                // button is gated on the tick, so reaching here means agreed.
                await data.recordHealthConsent();
                goNext();
              }}
            />
          )}

          {current === "name" && (
            <NameStep
              name={name}
              setName={setName}
              onContinue={() => {
                if (name.trim()) data.setPreferredName(name.trim());
                goNext();
              }}
            />
          )}

          {current === "partner" && (
            <CardStep
              heading="Do you have a partner?"
              options={PARTNER_OPTIONS}
              selected={partner}
              onSelect={setPartner}
              large
              note={
                partner === "Yes" ? (
                  <div className="partner-note">
                    <p>
                      It works best to go through this on your own first — it&rsquo;s
                      your own picture of retirement that matters here.
                    </p>
                    <p>
                      At the end you&rsquo;ll be able to share it with your partner,
                      and there&rsquo;s a session to help you work through any
                      differences in how you each{" "}
                      {RETIREMENT_PATHS ? "see" : "imagine"} retirement.
                    </p>
                  </div>
                ) : null
              }
              onContinue={() => {
                data.saveOnboarding({ partner });
                goNext();
              }}
              buttonLabel="Continue"
            />
          )}

          {current === "dob" && (
            <DateStep
              dob={dob}
              setDob={setDob}
              onContinue={() => {
                if (dob.trim()) data.saveOnboarding({ dob: dob.trim() });
                goNext();
              }}
              onSkip={goNext}
            />
          )}

          {current === "status" && (
            <CardStep
              heading="Where are you with work and retirement?"
              options={STATUS_OPTIONS.map((s) => s.label)}
              selected={statusLabel}
              onSelect={setStatusLabel}
              onContinue={() => {
                const match = STATUS_OPTIONS.find(
                  (s) => s.label === statusLabel
                );
                if (match) {
                  setRetirementStage(match.value);
                  data.saveOnboarding({ retirementStage: match.value });
                }
                goNext();
              }}
              buttonLabel="Continue"
            />
          )}

          {current === "horizon" && (
            <CardStep
              heading="Roughly how far from retirement are you?"
              options={HORIZON_OPTIONS}
              selected={horizon}
              onSelect={setHorizon}
              onContinue={() => {
                data.saveOnboarding({ horizon });
                goNext();
              }}
              buttonLabel="Continue"
            />
          )}

          {current === "motivation" && (
            <CardStep
              heading="What's brought you here?"
              options={MOTIVATION_OPTIONS}
              selected={motivation}
              onSelect={setMotivation}
              onContinue={async () => {
                await data.saveOnboarding({ motivation });
                goNext();
              }}
              buttonLabel="Continue"
              onSkip={async () => {
                await data.saveOnboarding({ motivation: null });
                goNext();
              }}
            />
          )}

          {current === "tone" && (
            <CardStep
              heading="How would you like Vita, our AI coach, to talk with you?"
              options={TONE_OPTIONS.map((t) => t.label)}
              selected={
                TONE_OPTIONS.find((t) => t.value === tone)?.label ?? ""
              }
              onSelect={(label) => {
                const match = TONE_OPTIONS.find((t) => t.label === label);
                if (match) setTone(match.value);
              }}
              onContinue={async () => {
                await data.saveOnboarding({ tone });
                await data.markOnboardingComplete();
                router.push("/home");
              }}
              buttonLabel="Finish"
            />
          )}
        </div>
      </main>
    </>
  );
}

// The graphic's crop is judged by eye, not calculated — so it gets a tuner
// rather than a guess. /onboarding?preview=1&tune=1 puts three sliders on the
// screen and prints the values to paste back in. Preview-only; it never renders
// for a real member.
function useSceneTuner() {
  const on =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("tune") === "1" &&
    new URLSearchParams(window.location.search).get("preview") === "1";
  const [size, setSize] = useState(350);
  const [x, setX] = useState(72);
  const [y, setY] = useState(95);
  const style = on
    ? ({
        ["--gfx-size" as string]: `${size}%`,
        ["--gfx-x" as string]: `${x}%`,
        ["--gfx-y" as string]: `${y}%`,
      } as React.CSSProperties)
    : undefined;
  const panel = on ? (
    <div className="onb-tuner">
      <p className="onb-tuner-read">
        size <strong>{size}%</strong> · horizontal <strong>{x}%</strong> ·
        vertical <strong>{y}%</strong>
      </p>
      <label>
        Size
        <input type="range" min={80} max={500} value={size}
          onChange={(e) => setSize(Number(e.target.value))} />
      </label>
      <label>
        Horizontal
        <input type="range" min={0} max={130} value={x}
          onChange={(e) => setX(Number(e.target.value))} />
      </label>
      <label>
        Vertical
        <input type="range" min={-20} max={140} value={y}
          onChange={(e) => setY(Number(e.target.value))} />
      </label>
    </div>
  ) : null;
  return { style, panel };
}

function Welcome({
  firstName,
  understood,
  setUnderstood,
  healthConsent,
  setHealthConsent,
  onContinue,
}: {
  firstName: string;
  understood: boolean;
  setUnderstood: (v: boolean) => void;
  healthConsent: boolean;
  setHealthConsent: (v: boolean) => void;
  onContinue: () => void;
}) {
  const tuner = useSceneTuner();
  // Personalised greeting when we know the signed-in user's first name; falls
  // back to the plain heading when there's no name to use.
  const heading = firstName
    ? `${firstName}, your retirement, your way`
    : "Your retirement, your way";
  return (
    <section className="welcome">
      {tuner.panel}
      <div className="scene" aria-hidden="true" style={tuner.style}>
        <ChorusVectorGraphic fill="var(--chorus-green)" className="scene-gfx" />
      </div>
      <div className="body">
        <h1 className="hero-heading">{heading}</h1>
        <p className="paragraph">
          This is a five-stage programme. Each stage is made up of several short
          sessions — around 10–20 minutes each. We&apos;d suggest about one session
          a day, so each has time to settle. Every session is an expert-designed
          exercise to help you think about and get clear on your next chapter.
        </p>
        <p className="paragraph">
          By the end of Stage 4: Plan, you&apos;ll have a Retirement Life Plan
          that captures your values, goals, and priorities for your retirement,
          {/* This intro is shown before we ask about their retirement status, so
              the flag-on wording stays neutral for everyone — anyone already
              retired has no leaving-work decision still ahead of them. */}
          {RETIREMENT_PATHS
            ? " along with the practical detail to help you make the most of it."
            : " as well as practical information like when you plan to leave work and how."}{" "}
          Stage 5: Act is there to help you start putting that plan into practice.
        </p>
        {/* The lockup introduces Vita at the point the copy first names her,
            rather than heading the card before she's been mentioned. */}
        <div className="vita">
          <VitaMark size={38} />
          <span className="name">Vita</span>
        </div>
        <p className="paragraph">
          Vita, your AI coach, is there to guide you the whole way through. Vita
          isn&apos;t a person and won&apos;t give financial, legal, or medical
          advice — what Vita&apos;s good at is asking the right questions and
          helping you make sense of your own answers.
        </p>
        <p className="paragraph ai-note">
          Because Vita is AI, it can sometimes make mistakes. If something
          doesn&apos;t sound quite right, correct it in your conversation.
        </p>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
          />
          <span className="lab">
            I understand Vita is an AI coach, not a human, and doesn&apos;t give
            financial, legal or medical advice.
          </span>
        </label>

        {/* Health-data consent — a standalone agreement, separate from the AI
            disclaimer above. Both must be ticked before Get started enables. */}
        <div className="consent-block">
          <h2 className="consent-heading">{HEALTH_CONSENT_HEADING}</h2>
          <p className="consent-body">{HEALTH_CONSENT_BODY}</p>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={healthConsent}
              onChange={(e) => setHealthConsent(e.target.checked)}
            />
            <span className="lab">{HEALTH_CONSENT_LABEL}</span>
          </label>
        </div>

        <button
          type="button"
          className="btn btn-navy"
          disabled={!understood || !healthConsent}
          onClick={onContinue}
        >
          Get started →
        </button>
      </div>
    </section>
  );
}

function NameStep({
  name,
  setName,
  onContinue,
}: {
  name: string;
  setName: (v: string) => void;
  onContinue: () => void;
}) {
  return (
    <>
      <h1 className="step-heading">What should I call you?</h1>
      <div className="name-field">
        <input
          id="preferred-name"
          type="text"
          className="name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="The name you'd like me to use"
          autoComplete="given-name"
        />
      </div>
      <button type="button" className="btn btn-navy" onClick={onContinue}>
        Continue
      </button>
    </>
  );
}

function DateStep({
  dob,
  setDob,
  onContinue,
  onSkip,
}: {
  dob: string;
  setDob: (v: string) => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  // The latest date a 16-year-old could have been born — a light floor so the
  // picker can't take an implausibly recent date.
  const maxDob = (() => {
    const d = new Date();
    return `${d.getFullYear() - 16}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  })();
  return (
    <>
      <h1 className="step-heading">What&apos;s your date of birth?</h1>
      <p className="paragraph">
        This helps Vita tailor a few practical, age-related suggestions — like
        when a routine health check becomes worth a mention. It&apos;s private,
        kept only on your own plan, and never shared. You can skip it.
      </p>
      <div className="name-field">
        <input
          id="date-of-birth"
          type="date"
          className="name-input"
          value={dob}
          max={maxDob}
          onChange={(e) => setDob(e.target.value)}
          autoComplete="bday"
        />
      </div>
      <button type="button" className="btn btn-navy" onClick={onContinue}>
        Continue
      </button>
      <button type="button" onClick={onSkip} className="skip">
        Skip
      </button>
    </>
  );
}

function CardStep({
  heading,
  options,
  selected,
  onSelect,
  onContinue,
  buttonLabel,
  large = false,
  onSkip,
  note,
}: {
  heading: string;
  serif?: boolean;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
  onContinue: () => void;
  buttonLabel: string;
  large?: boolean;
  onSkip?: () => void;
  // Optional note shown beneath the options once a relevant choice is made
  // (e.g. the partner follow-up). Rendered only when provided.
  note?: ReactNode;
}) {
  return (
    <>
      <h1 className="step-heading">{heading}</h1>
      <div className="card-list">
        {options.map((opt) => {
          const isSelected = selected === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onSelect(opt)}
              aria-pressed={isSelected}
              className={
                large
                  ? isSelected
                    ? "card large is-selected"
                    : "card large"
                  : isSelected
                    ? "card is-selected"
                    : "card"
              }
            >
              {opt}
            </button>
          );
        })}
      </div>
      {note}
      <button
        type="button"
        className="btn btn-navy"
        disabled={!selected}
        onClick={onContinue}
      >
        {buttonLabel}
      </button>
      {onSkip && (
        <button type="button" onClick={onSkip} className="skip">
          Skip
        </button>
      )}
    </>
  );
}

const css = `
.rlp-onb{min-height:calc(100dvh - var(--header-h));background:var(--bg-alt);display:flex;justify-content:center;padding:56px 24px 80px;font-family:var(--font-sans)}
.rlp-onb .column{width:100%;max-width:600px;display:flex;flex-direction:column;align-items:flex-start}
.rlp-onb :focus-visible{outline:none}

.rlp-onb .welcome{width:100%;background:var(--warm-surface);border:1px solid var(--warm-line);border-radius:var(--r-lg);box-shadow:var(--shadow-md);overflow:hidden}
/* Was a sky-and-hills gradient with a sun and two clouds, built from the
   pre-rebrand --ill-* illustration palette (sky #A4CCE5, hill #5B9F4A) that has
   no relation to Chorus. Now the brand cream and the Chorus circles — the same
   treatment as the dashboard hero and the plan cover. Onboarding isn't a stage,
   so it takes the brand colours directly rather than borrowing a stage pairing. */
.rlp-onb .scene{height:140px;position:relative;overflow:hidden;background:var(--chorus-yellow)}
.rlp-onb .scene .scene-gfx{position:absolute;height:var(--gfx-size,350%);left:var(--gfx-x,72%);top:var(--gfx-y,95%);transform:translate(-50%,-50%);pointer-events:none}
.rlp-onb .onb-preview-note{width:100%;margin:0 0 16px;padding:8px 14px;box-sizing:border-box;border-radius:var(--r-sm);background:var(--info-surface);border:1px solid var(--info-line);color:var(--info-text);font-family:var(--font-sans);font-size:var(--fs-sm);text-align:center}
.rlp-onb .welcome .body{padding:30px 32px 32px}

.rlp-onb .vita{display:flex;align-items:center;gap:10px;margin:26px 0 14px}
.rlp-onb .vita .name{font-family:var(--font-serif);font-size:var(--fs-title);font-weight:600;color:var(--color-vita)}

.rlp-onb .hero-heading{font-family:var(--font-serif);font-size:var(--fs-display);font-weight:600;color:var(--ink);line-height:1.2;margin:0 0 18px}
.rlp-onb .step-heading{font-family:var(--font-serif);font-size:var(--fs-h2);font-weight:600;color:var(--ink);line-height:1.3;margin:0 0 26px}
.rlp-onb .paragraph{font-family:var(--font-sans);font-size:var(--fs-body);line-height:var(--lh-body);color:var(--text);margin:0 0 18px;max-width:58ch}
.rlp-onb .onb-tuner{position:fixed;left:20px;bottom:20px;z-index:50;background:var(--bg);border:1px solid var(--border-strong);border-radius:var(--r-md);box-shadow:var(--shadow-md);padding:14px 16px;display:flex;flex-direction:column;gap:8px;width:250px;font-family:var(--font-sans)}
.rlp-onb .onb-tuner-read{margin:0 0 2px;font-size:var(--fs-sm);color:var(--ink)}
.rlp-onb .onb-tuner label{display:flex;flex-direction:column;gap:3px;font-size:var(--fs-eyebrow);text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:var(--text-muted)}
.rlp-onb .onb-tuner input{width:100%;accent-color:var(--brand-primary)}
.rlp-onb .ai-note{font-size:var(--fs-sm);color:var(--text-muted);padding-left:14px;border-left:2px solid color-mix(in srgb, var(--color-vita) 35%, transparent)}

.rlp-onb .name-field{display:flex;flex-direction:column;gap:8px;margin:0 0 20px}
.rlp-onb .name-label{font-family:var(--font-sans);font-size:var(--fs-body);font-weight:600;color:var(--ink)}
.rlp-onb .name-input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px;min-height:52px;font-family:var(--font-sans);font-size:var(--fs-body);color:var(--text);box-sizing:border-box;transition:border-color .15s ease,box-shadow .15s ease}
.rlp-onb .name-input:hover{border-color:var(--border-strong)}
.rlp-onb .name-input:focus-visible{border-color:var(--brand-primary);box-shadow:var(--focus-ring)}

.rlp-onb .checkbox-row{display:flex;align-items:flex-start;gap:12px;margin:8px 0 26px;cursor:pointer;background:var(--warm-surface-2);border:1px solid var(--warm-line);border-radius:var(--r-md);padding:14px 16px}
.rlp-onb .checkbox-row input{width:20px;height:20px;margin-top:1px;accent-color:var(--brand-primary);flex-shrink:0;cursor:pointer}
.rlp-onb .checkbox-row input:focus-visible{box-shadow:var(--focus-ring);border-radius:var(--r-xs)}
.rlp-onb .checkbox-row .lab{font-family:var(--font-sans);font-size:var(--fs-sm);line-height:1.5;color:var(--text)}

/* Health-data consent — its own block above the Get started button. Heading in
   the sans section role, body at reading size, then the same warm checkbox-row
   as the AI disclaimer for a consistent pair. */
.rlp-onb .consent-block{margin:0 0 26px}
.rlp-onb .consent-heading{font-family:var(--font-sans);font-size:var(--fs-section);font-weight:700;color:var(--ink);margin:0 0 8px}
.rlp-onb .consent-body{font-family:var(--font-sans);font-size:var(--fs-body);line-height:var(--lh-body);color:var(--text);margin:0;max-width:58ch}
.rlp-onb .consent-block .checkbox-row{margin:14px 0 0}

.rlp-onb .card-list{display:flex;flex-direction:column;gap:12px;width:100%;margin:0 0 28px}
.rlp-onb .card{width:100%;text-align:left;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:18px 20px;min-height:56px;box-shadow:var(--shadow-sm);font-family:var(--font-sans);font-size:var(--fs-body);font-weight:500;color:var(--text);cursor:pointer;transition:background .15s ease,border-color .15s ease,box-shadow .15s ease}
.rlp-onb .card:hover{border-color:var(--border-strong);box-shadow:var(--shadow-md)}
.rlp-onb .card.large{min-height:84px;font-size:var(--fs-section);font-weight:600}
.rlp-onb .card.is-selected{background:var(--brand-primary-tint);border-color:var(--brand-primary);color:var(--ink)}
.rlp-onb .card.is-selected:hover{border-color:var(--brand-primary)}
.rlp-onb .partner-note{width:100%;background:var(--info-surface);border:1px solid var(--info-line);border-radius:var(--r-md);padding:16px 18px;margin:0 0 28px;display:flex;flex-direction:column;gap:10px}
.rlp-onb .partner-note p{margin:0;font-family:var(--font-sans);font-size:var(--fs-sm);line-height:var(--lh-body);color:var(--info-text)}
.rlp-onb .card:focus-visible{box-shadow:var(--focus-ring)}

.rlp-onb .btn{font-family:var(--font-sans);font-size:var(--fs-body);font-weight:600;border:none;border-radius:var(--r-sm);padding:14px 28px;min-height:48px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;line-height:1}
.rlp-onb .btn-navy{background:var(--brand-primary);color:var(--brand-on-primary)}
.rlp-onb .btn-navy:hover:not(:disabled){background:var(--brand-primary-hover)}
.rlp-onb .btn:disabled{opacity:.45;cursor:not-allowed}
.rlp-onb .btn:focus-visible{box-shadow:var(--focus-ring)}

.rlp-onb .skip{background:none;border:none;padding:10px 6px;margin-top:14px;font-family:var(--font-sans);font-size:var(--fs-sm);font-weight:600;color:var(--text-muted);cursor:pointer;min-height:44px}
.rlp-onb .skip:hover{color:var(--text);text-decoration:underline}
.rlp-onb .skip:focus-visible{box-shadow:var(--focus-ring);border-radius:var(--r-sm)}
.rlp-onb .onb-back{align-self:flex-start;background:none;border:none;padding:8px 6px;margin:0 0 18px -6px;font-family:var(--font-sans);font-size:var(--fs-sm);font-weight:600;color:var(--text-muted);cursor:pointer;min-height:40px}
.rlp-onb .onb-back:hover{color:var(--text)}
.rlp-onb .onb-back:focus-visible{box-shadow:var(--focus-ring);border-radius:var(--r-sm)}

@media (max-width:560px){
  .rlp-onb{padding:32px 16px 64px}
  .rlp-onb .welcome .body{padding:24px 20px 26px}
  .rlp-onb .hero-heading{font-size:28px}
  .rlp-onb .scene{height:112px}
  .rlp-onb .onb-back{min-height:44px}
}
`;
