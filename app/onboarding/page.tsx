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

// --- Pilot baseline survey ------------------------------------------------
// The one-time baseline captured at the end of onboarding — the four questions
// the pilot evaluation needs that aren't already asked. Answers go to the
// dedicated baseline_survey table (via saveBaselineSurvey), not the onboarding
// record. Every one can be skipped.

// Single-select. "Prefer to self-describe" reveals a free-text field; its value
// is what gets stored. "Prefer not to say" stores that label.
const GENDER_OPTIONS = [
  "Female",
  "Male",
  "Non-binary",
  "Prefer to self-describe",
  "Prefer not to say",
];
const GENDER_SELF_DESCRIBE = "Prefer to self-describe";

// Multi-select, up to three. The pilot spec's original nine, plus four that speak
// to someone already retired ("Relieved", "Settled", "At a loose end", "Lonely")
// — feeling adrift or isolated is common after retiring and nothing in the
// original nine caught it. One list for everyone, whatever stage they're at.
// Ordered on a positive → neutral → difficult gradient. Keep this in step with
// the allowlist in /api/baseline-survey, which bounds what actually gets stored.
const FEELINGS_OPTIONS = [
  "Excited",
  "Curious",
  "Hopeful",
  "Confident",
  "Relieved",
  "Settled",
  "Neutral",
  "Uncertain",
  "At a loose end",
  "Lonely",
  "Overwhelmed",
  "Anxious",
  "Avoiding thinking about it",
];
const FEELINGS_MAX = 3;

// Single-select. How much non-financial retirement planning they've already
// done — asked before the confidence question, so "confident in your plans"
// lands against a stated amount of planning rather than in the abstract.
const PRIOR_PLANNING_OPTIONS = [
  "Extensive",
  "Some",
  "A small amount",
  "Very little",
  "None at all",
];

// Health-data consent, shown on its own screen straight after the welcome's AI
// disclaimer. Held as constants so the exact wording is unambiguous (and can't be
// nicked by the react/no-unescaped-entities rule the way inline JSX apostrophes
// would be). The body carries a bold phrase and a link, so it is split into runs
// rather than one string. If this wording changes, bump HEALTH_CONSENT_VERSION in
// lib/userData — it is the record of which text each person actually agreed to.
const HEALTH_CONSENT_HEADING = "Your health information";
const HEALTH_CONSENT_BODY_BEFORE_BOLD =
  "Vita will ask about things like your sleep, energy, how you're recovering, and how you feel about retirement. Some of this is health information, which the law protects closely. Chorus Life needs it to build your plan, so the programme can't run without it. Vita uses your answers automatically — ";
const HEALTH_CONSENT_BODY_BOLD = "no one here reads them";
const HEALTH_CONSENT_BODY_AFTER_BOLD =
  " — and we never sell your information. Our ";
const HEALTH_CONSENT_PRIVACY_LINK_TEXT = "Privacy Notice";
const HEALTH_CONSENT_BODY_END = " has the full detail and your rights.";
const HEALTH_CONSENT_LABEL =
  "I've read the above and explicitly consent to Chorus Life using my health information to build my plan.";
const HEALTH_CONSENT_WITHDRAW_BEFORE =
  "Withdraw consent or delete your information anytime — ";
const HEALTH_CONSENT_MANAGE_LINK_TEXT = "manage it here";
const HEALTH_CONSENT_WITHDRAW_MIDDLE = " or email ";
const HEALTH_CONSENT_EMAIL = "hello@chorus-life.com";

// Where "manage it here" points — the self-serve withdraw/delete route.
const MANAGE_DATA_URL = "https://app.chorus-life.com/delete-account";
// The published Privacy Notice. Empty while the notice is being finalised; until
// it has a URL the words render as plain text rather than a link to nowhere. Set
// this and it becomes a link with no other change.
const PRIVACY_NOTICE_URL = "https://app.chorus-life.com/privacy";

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
      saveBaselineSurvey: async () => {},
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
  // Pilot baseline answers (their own table, written on Finish).
  const [gender, setGender] = useState("");
  const [genderSelf, setGenderSelf] = useState("");
  const [feelings, setFeelings] = useState<string[]>([]);
  const [priorPlanning, setPriorPlanning] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [expectations, setExpectations] = useState("");
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
    | "consent"
    | "name"
    | "partner"
    | "dob"
    | "gender"
    | "status"
    | "horizon"
    | "motivation"
    | "feelings"
    | "priorPlanning"
    | "confidence"
    | "expectations"
    | "tone";

  const steps: StepKey[] = [
    "welcome",
    "consent",
    "name",
    "partner",
    "dob",
    "gender",
    ...(RETIREMENT_PATHS ? (["status"] as StepKey[]) : []),
    ...(showHorizon ? (["horizon"] as StepKey[]) : []),
    "motivation",
    "feelings",
    "priorPlanning",
    "confidence",
    "expectations",
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
              onContinue={goNext}
            />
          )}

          {current === "consent" && (
            <ConsentStep
              healthConsent={healthConsent}
              setHealthConsent={setHealthConsent}
              onContinue={async () => {
                // Stamp the health-data consent as they leave this step — the
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

          {current === "gender" && (
            <CardStep
              heading="How would you describe your gender?"
              options={GENDER_OPTIONS}
              selected={gender}
              onSelect={setGender}
              note={
                gender === GENDER_SELF_DESCRIBE ? (
                  <div className="name-field self-describe">
                    <input
                      id="gender-self-describe"
                      type="text"
                      className="name-input"
                      value={genderSelf}
                      onChange={(e) => setGenderSelf(e.target.value)}
                      placeholder="In your own words"
                      maxLength={80}
                    />
                  </div>
                ) : null
              }
              onContinue={goNext}
              buttonLabel="Continue"
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

          {current === "feelings" && (
            <MultiSelectStep
              heading="How do you feel about your retirement right now?"
              subheading="Choose up to three."
              options={FEELINGS_OPTIONS}
              selected={feelings}
              max={FEELINGS_MAX}
              onToggle={(opt) =>
                setFeelings((prev) =>
                  prev.includes(opt)
                    ? prev.filter((f) => f !== opt)
                    : prev.length < FEELINGS_MAX
                      ? [...prev, opt]
                      : prev
                )
              }
              onContinue={goNext}
              onSkip={() => {
                setFeelings([]);
                goNext();
              }}
            />
          )}

          {current === "priorPlanning" && (
            <CardStep
              heading="Have you done any form of retirement planning so far beyond financial planning?"
              options={PRIOR_PLANNING_OPTIONS}
              selected={priorPlanning}
              onSelect={setPriorPlanning}
              onContinue={goNext}
              buttonLabel="Continue"
              onSkip={() => {
                setPriorPlanning("");
                goNext();
              }}
            />
          )}

          {current === "confidence" && (
            <ScaleStep
              heading="How confident do you feel in your plans for retirement?"
              lowLabel="Not at all confident"
              highLabel="Very confident"
              value={confidence}
              onPick={setConfidence}
              onContinue={goNext}
              onSkip={() => {
                setConfidence(null);
                goNext();
              }}
            />
          )}

          {current === "expectations" && (
            <TextAreaStep
              heading="What are you expecting to get from the programme?"
              value={expectations}
              setValue={setExpectations}
              placeholder="Whatever comes to mind — a sentence is plenty."
              onContinue={goNext}
              onSkip={() => {
                setExpectations("");
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
                // Write the one-time pilot baseline to its own table, snapshotting
                // the demographics captured earlier in the flow. Empty answers
                // (skipped, or a flag-off step never shown) go as null.
                const genderValue =
                  gender === GENDER_SELF_DESCRIBE
                    ? genderSelf.trim() || null
                    : gender || null;
                await data.saveBaselineSurvey({
                  gender: genderValue,
                  feelings,
                  priorPlanning: priorPlanning || null,
                  planningConfidence: confidence,
                  expectations: expectations.trim() || null,
                  dob: dob.trim() || null,
                  partner: partner || null,
                  retirementStage: retirementStage || null,
                  horizon: horizon || null,
                });
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
  onContinue,
}: {
  firstName: string;
  understood: boolean;
  setUnderstood: (v: boolean) => void;
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

        <button
          type="button"
          className="btn btn-navy"
          disabled={!understood}
          onClick={onContinue}
        >
          Get started →
        </button>
      </div>
    </section>
  );
}

// Health-data consent — its own screen, straight after the welcome's AI
// disclaimer, so the agreement is read on its own rather than as a second tick
// under the intro. The tick gates the button, so continuing means agreed, and
// the caller stamps the consent record at that point.
function ConsentStep({
  healthConsent,
  setHealthConsent,
  onContinue,
}: {
  healthConsent: boolean;
  setHealthConsent: (v: boolean) => void;
  onContinue: () => void;
}) {
  return (
    <>
      <h1 className="step-heading">{HEALTH_CONSENT_HEADING}</h1>
      <p className="paragraph">
        {HEALTH_CONSENT_BODY_BEFORE_BOLD}
        <strong>{HEALTH_CONSENT_BODY_BOLD}</strong>
        {HEALTH_CONSENT_BODY_AFTER_BOLD}
        {PRIVACY_NOTICE_URL ? (
          <a
            className="consent-link"
            href={PRIVACY_NOTICE_URL}
            target="_blank"
            rel="noreferrer"
          >
            {HEALTH_CONSENT_PRIVACY_LINK_TEXT}
          </a>
        ) : (
          HEALTH_CONSENT_PRIVACY_LINK_TEXT
        )}
        {HEALTH_CONSENT_BODY_END}
      </p>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={healthConsent}
          onChange={(e) => setHealthConsent(e.target.checked)}
        />
        <span className="lab">{HEALTH_CONSENT_LABEL}</span>
      </label>
      <p className="consent-withdraw">
        {HEALTH_CONSENT_WITHDRAW_BEFORE}
        <a className="consent-link" href={MANAGE_DATA_URL}>
          {HEALTH_CONSENT_MANAGE_LINK_TEXT}
        </a>
        {HEALTH_CONSENT_WITHDRAW_MIDDLE}
        <a className="consent-link" href={`mailto:${HEALTH_CONSENT_EMAIL}`}>
          {HEALTH_CONSENT_EMAIL}
        </a>
        .
      </p>
      <button
        type="button"
        className="btn btn-navy"
        disabled={!healthConsent}
        onClick={onContinue}
      >
        Agree and continue
      </button>
    </>
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

// The DOB is stored canonically as an ISO string (YYYY-MM-DD), but people type
// it as DD/MM/YYYY. These two helpers convert between the two.
function formatIsoAsDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  const [, y, mm, dd] = m;
  return `${dd}/${mm}/${y}`;
}

// Parse a typed "DD/MM/YYYY" string into an ISO date, or return null if it
// isn't a real, plausible date of birth.
function parseDobDisplay(display: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);

  const date = new Date(year, month - 1, day);
  // Reject impossible dates like 31/02/1960 — Date silently rolls them over,
  // so check the parts survived the round-trip.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  // Light plausibility floor/ceiling: born no earlier than 1900, and at least
  // 16 years ago (never in the future).
  const now = new Date();
  const sixteenYearsAgo = new Date(
    now.getFullYear() - 16,
    now.getMonth(),
    now.getDate()
  );
  if (year < 1900 || date > sixteenYearsAgo) return null;

  return `${m[3]}-${m[2]}-${m[1]}`;
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
  // What the user sees and types: a DD/MM/YYYY string, seeded from any ISO
  // value the parent already holds.
  const [text, setText] = useState(() => formatIsoAsDisplay(dob));
  const [error, setError] = useState("");

  const handleChange = (raw: string) => {
    // Keep only digits (max 8 for DDMMYYYY) and re-insert the slashes as they
    // type, so the field always reads DD/MM/YYYY without the user typing "/".
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let next = digits;
    if (digits.length > 4) {
      next = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      next = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    setText(next);
    setError("");
    // Keep the canonical ISO value in sync; clear it while the date is
    // incomplete or invalid so nothing partial gets saved.
    setDob(parseDobDisplay(next) ?? "");
  };

  const handleContinue = () => {
    // Empty is allowed — that's the same as skipping.
    if (text.trim() === "") {
      onContinue();
      return;
    }
    if (!parseDobDisplay(text)) {
      setError("Please enter a real date as DD/MM/YYYY — for example 07/03/1962.");
      return;
    }
    onContinue();
  };

  return (
    <>
      <h1 className="step-heading">What&apos;s your date of birth?</h1>
      <p className="paragraph">
        This helps Vita tailor a few practical, age-related suggestions — like
        when a routine health check becomes worth a mention. You can skip it.
      </p>
      <div className="name-field">
        <input
          id="date-of-birth"
          type="text"
          inputMode="numeric"
          className="name-input"
          value={text}
          placeholder="DD/MM/YYYY"
          maxLength={10}
          onChange={(e) => handleChange(e.target.value)}
          autoComplete="bday"
        />
      </div>
      {error && (
        <p className="paragraph" role="alert" style={{ color: "var(--accent-strong)" }}>
          {error}
        </p>
      )}
      <button type="button" className="btn btn-navy" onClick={handleContinue}>
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

// Multi-select cards with a cap (the "choose up to three" pilot question). Once
// the cap is reached, unpicked cards disable so the limit is felt, not policed
// after the fact. Continue needs at least one; Skip records none.
function MultiSelectStep({
  heading,
  subheading,
  options,
  selected,
  max,
  onToggle,
  onContinue,
  onSkip,
}: {
  heading: string;
  subheading: string;
  options: string[];
  selected: string[];
  max: number;
  onToggle: (opt: string) => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const atMax = selected.length >= max;
  return (
    <>
      <h1 className="step-heading">{heading}</h1>
      <p className="step-sub">{subheading}</p>
      {/* Grid rather than the default single column: this list is long (13
          feelings), and stacking them makes the step tower off the screen. */}
      <div className="card-list grid">
        {options.map((opt) => {
          const isSelected = selected.includes(opt);
          const disabled = !isSelected && atMax;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              aria-pressed={isSelected}
              disabled={disabled}
              className={isSelected ? "card is-selected" : "card"}
            >
              {opt}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="btn btn-navy"
        disabled={selected.length === 0}
        onClick={onContinue}
      >
        Continue
      </button>
      <button type="button" onClick={onSkip} className="skip">
        Skip
      </button>
    </>
  );
}

// A 1–5 rating (the baseline confidence question). Five numbered buttons anchored
// by a word at each pole. Continue needs a pick; Skip records none.
function ScaleStep({
  heading,
  lowLabel,
  highLabel,
  value,
  onPick,
  onContinue,
  onSkip,
}: {
  heading: string;
  lowLabel: string;
  highLabel: string;
  value: number | null;
  onPick: (v: number) => void;
  onContinue: () => void;
  onSkip: () => void;
}) {
  return (
    <>
      <h1 className="step-heading">{heading}</h1>
      <div className="scale-row" role="group" aria-label={heading}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPick(n)}
            aria-pressed={value === n}
            className={value === n ? "scale-btn is-selected" : "scale-btn"}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="scale-ends">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
      <button
        type="button"
        className="btn btn-navy"
        disabled={value === null}
        onClick={onContinue}
      >
        Continue
      </button>
      <button type="button" onClick={onSkip} className="skip">
        Skip
      </button>
    </>
  );
}

// A free-text step (the baseline expectations question). Auto-growing textarea so
// everything typed stays visible — never a clipping single line. Optional, so
// Continue always enables; Skip records nothing.
function TextAreaStep({
  heading,
  value,
  setValue,
  placeholder,
  onContinue,
  onSkip,
}: {
  heading: string;
  value: string;
  setValue: (v: string) => void;
  placeholder: string;
  onContinue: () => void;
  onSkip: () => void;
}) {
  return (
    <>
      <h1 className="step-heading">{heading}</h1>
      {/* `wide` because .column is align-items:flex-start, so a field only fills
          the column when it says so — without it the box shrinks to its default
          textarea width. */}
      <div className="name-field wide">
        <textarea
          id="expectations"
          className="name-input textarea"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          rows={4}
          maxLength={2000}
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
/* .column is align-items:flex-start, so fields are content-width by default.
   Opt in to the full column width (the free-text answer box wants it). */
.rlp-onb .name-field.wide{width:100%}
.rlp-onb .name-label{font-family:var(--font-sans);font-size:var(--fs-body);font-weight:600;color:var(--ink)}
.rlp-onb .name-input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px;min-height:52px;font-family:var(--font-sans);font-size:var(--fs-body);color:var(--text);box-sizing:border-box;transition:border-color .15s ease,box-shadow .15s ease}
.rlp-onb .name-input:hover{border-color:var(--border-strong)}
.rlp-onb .name-input:focus-visible{border-color:var(--brand-primary);box-shadow:var(--focus-ring)}

.rlp-onb .checkbox-row{display:flex;align-items:flex-start;gap:12px;margin:8px 0 26px;cursor:pointer;background:var(--warm-surface-2);border:1px solid var(--warm-line);border-radius:var(--r-md);padding:14px 16px}
.rlp-onb .checkbox-row input{width:20px;height:20px;margin-top:1px;accent-color:var(--brand-primary);flex-shrink:0;cursor:pointer}
.rlp-onb .checkbox-row input:focus-visible{box-shadow:var(--focus-ring);border-radius:var(--r-xs)}
.rlp-onb .checkbox-row .lab{font-family:var(--font-sans);font-size:var(--fs-sm);line-height:1.5;color:var(--text)}

.rlp-onb .step-sub{font-family:var(--font-sans);font-size:var(--fs-sm);color:var(--text-muted);margin:-16px 0 22px}
.rlp-onb .name-input.textarea{min-height:120px;resize:vertical;line-height:var(--lh-body)}
.rlp-onb .self-describe{margin:-14px 0 28px}

/* 1–5 rating: a row of five equal buttons with an end-label caption beneath. */
.rlp-onb .scale-row{display:flex;gap:8px;width:100%;margin:0 0 8px}
.rlp-onb .scale-btn{flex:1 1 0;min-width:0;min-height:56px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);box-shadow:var(--shadow-sm);font-family:var(--font-sans);font-size:var(--fs-section);font-weight:600;color:var(--text);cursor:pointer;transition:background .15s ease,border-color .15s ease,box-shadow .15s ease}
.rlp-onb .scale-btn:hover{border-color:var(--border-strong);box-shadow:var(--shadow-md)}
.rlp-onb .scale-btn.is-selected{background:var(--brand-primary-tint);border-color:var(--brand-primary);color:var(--ink)}
.rlp-onb .scale-btn:focus-visible{box-shadow:var(--focus-ring)}
.rlp-onb .scale-ends{display:flex;justify-content:space-between;width:100%;margin:0 0 28px;font-family:var(--font-sans);font-size:var(--fs-sm);color:var(--text-muted)}

.rlp-onb .card:disabled{opacity:.4;cursor:not-allowed;box-shadow:none}
.rlp-onb .card:disabled:hover{border-color:var(--border)}
/* Consent screen: links take the interaction layer (Chorus green); the withdraw
   line sits under the tick as a quieter footnote to the agreement. */
.rlp-onb .consent-link{color:var(--brand-primary);text-decoration:underline;font-weight:600}
.rlp-onb .consent-link:hover{color:var(--brand-primary-hover)}
.rlp-onb .consent-link:focus-visible{box-shadow:var(--focus-ring);border-radius:var(--r-xs)}
.rlp-onb .consent-withdraw{font-family:var(--font-sans);font-size:var(--fs-sm);line-height:var(--lh-body);color:var(--text-muted);margin:0 0 26px;max-width:58ch}

.rlp-onb .card-list{display:flex;flex-direction:column;gap:12px;width:100%;margin:0 0 28px}
/* Long option lists (the 13 feelings) reflow into columns instead of one tall
   stack. auto-fit + a 240px floor gives two columns at the 600px column width —
   wide enough for the longest label on one line — and drops to one on a phone. */
.rlp-onb .card-list.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));align-items:stretch}
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
