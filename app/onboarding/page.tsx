"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ProviderBand from "../components/ProviderBand";
import { markOnboardingComplete } from "@/lib/onboarding";
import { getPreferredName, setPreferredName } from "@/lib/displayName";

type Answers = {
  partner: string;
  horizon: string;
  motivation: string | null;
};

const HORIZON_OPTIONS = [
  "Less than 2 years",
  "2–5 years",
  "5–10 years",
  "More than 10 years",
  "Not sure",
];

const PARTNER_OPTIONS = ["Just me", "Me and my partner"];

const MOTIVATION_OPTIONS = [
  "A big birthday or milestone",
  "Thinking about when to stop working",
  "A change at work or in life",
  "Just curious for now",
];

export default function OnboardingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [understood, setUnderstood] = useState(false);
  const [name, setName] = useState("");
  const [nameInit, setNameInit] = useState(false);
  const [partner, setPartner] = useState("");
  const [horizon, setHorizon] = useState("");
  const [motivation, setMotivation] = useState("");

  // Pre-fill the name field once Clerk resolves: any preferred name they've
  // already set, else Clerk's firstName. Leaves it blank when there's nothing —
  // the field is optional and the greeting falls back gracefully.
  if (user && !nameInit) {
    setNameInit(true);
    setName(getPreferredName(user.id) || user.firstName || "");
  }

  function save(answers: Partial<Answers>) {
    if (!user) return;
    const key = `rlp_onboarding_${user.id}`;
    let existing: Partial<Answers> = {};
    try {
      const raw = localStorage.getItem(key);
      if (raw) existing = JSON.parse(raw);
    } catch {
      existing = {};
    }
    const merged: Answers = {
      partner: "",
      horizon: "",
      motivation: null,
      ...existing,
      ...answers,
    };
    localStorage.setItem(key, JSON.stringify(merged));
  }

  if (!isLoaded) {
    return (
      <>
        <ProviderBand />
        <main className="rlp-onb">
          <style>{css}</style>
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
          {step === 1 && (
            <Welcome
              understood={understood}
              setUnderstood={setUnderstood}
              onContinue={() => setStep(2)}
            />
          )}

          {step === 2 && (
            <NameStep
              name={name}
              setName={setName}
              onContinue={() => {
                if (user && name.trim()) setPreferredName(user.id, name.trim());
                setStep(3);
              }}
            />
          )}

          {step === 3 && (
            <CardStep
              heading="When you picture your retirement, is it just you — or you and a partner?"
              options={PARTNER_OPTIONS}
              selected={partner}
              onSelect={setPartner}
              large
              onContinue={() => {
                save({ partner });
                setStep(4);
              }}
              buttonLabel="Continue"
            />
          )}

          {step === 4 && (
            <CardStep
              heading="Roughly how far from retirement are you?"
              options={HORIZON_OPTIONS}
              selected={horizon}
              onSelect={setHorizon}
              onContinue={() => {
                save({ horizon });
                setStep(5);
              }}
              buttonLabel="Continue"
            />
          )}

          {step === 5 && (
            <CardStep
              heading="What's prompted you to start thinking about retirement?"
              options={MOTIVATION_OPTIONS}
              selected={motivation}
              onSelect={setMotivation}
              onContinue={() => {
                save({ motivation });
                if (user) markOnboardingComplete(user.id);
                router.push("/home");
              }}
              buttonLabel="Finish"
              onSkip={() => {
                save({ motivation: null });
                if (user) markOnboardingComplete(user.id);
                router.push("/home");
              }}
            />
          )}
        </div>
      </main>
    </>
  );
}

function Welcome({
  understood,
  setUnderstood,
  onContinue,
}: {
  understood: boolean;
  setUnderstood: (v: boolean) => void;
  onContinue: () => void;
}) {
  return (
    <section className="welcome">
      <div className="scene" aria-hidden="true">
        <div className="sun-ill"></div>
        <div className="cloud"></div>
        <div className="cloud two"></div>
      </div>
      <div className="body">
        <div className="vita">
          <span className="sun" aria-hidden="true">
            ☀
          </span>
          <span className="name">Vita</span>
        </div>
        <h1 className="hero-heading">Your retirement, your way</h1>
        <p className="paragraph">
          This is a five-stage programme. Each stage is made up of several short
          modules — around 10–20 minutes each — that you can work through at your
          own pace. Every module is an expert-designed exercise to help you think
          about and get clear on your next chapter.
        </p>
        <p className="paragraph">
          Vita, your AI coach, is there to guide you the whole way through. Vita
          isn&apos;t a person and won&apos;t give financial, legal, or medical
          advice — what Vita&apos;s good at is asking the right questions and
          helping you make sense of your own answers.
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

function CardStep({
  heading,
  options,
  selected,
  onSelect,
  onContinue,
  buttonLabel,
  large = false,
  onSkip,
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
.rlp-onb{min-height:calc(100vh - var(--header-h));background:var(--bg-alt);display:flex;justify-content:center;padding:56px 24px 80px;font-family:var(--font-sans)}
.rlp-onb .column{width:100%;max-width:600px;display:flex;flex-direction:column;align-items:flex-start}
.rlp-onb :focus-visible{outline:none}

.rlp-onb .welcome{width:100%;background:var(--warm-surface);border:1px solid var(--warm-line);border-radius:var(--r-lg);box-shadow:var(--shadow-md);overflow:hidden}
.rlp-onb .scene{height:140px;background:linear-gradient(var(--ill-sky-pale),var(--ill-sky) 42%,var(--ill-hill) 64%,var(--ill-hill-deep));position:relative}
.rlp-onb .scene .sun-ill{position:absolute;right:40px;top:32px;width:50px;height:50px;border-radius:50%;background:radial-gradient(circle,#FFF3CF,var(--sun));box-shadow:0 0 34px rgba(251,210,78,.6)}
.rlp-onb .scene .cloud{position:absolute;width:70px;height:20px;background:rgba(255,255,255,.7);border-radius:20px;top:78px;right:66px}
.rlp-onb .scene .cloud.two{width:48px;top:106px;right:154px;opacity:.6}
.rlp-onb .welcome .body{padding:30px 32px 32px}

.rlp-onb .vita{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.rlp-onb .vita .sun{width:38px;height:38px;border-radius:50%;background:var(--sun);display:grid;place-items:center;font-size:18px;color:var(--ink)}
.rlp-onb .vita .name{font-family:var(--font-serif);font-size:var(--fs-title);font-weight:600;color:var(--ink)}

.rlp-onb .hero-heading{font-family:var(--font-serif);font-size:var(--fs-display);font-weight:600;color:var(--ink);line-height:1.2;margin:0 0 18px}
.rlp-onb .step-heading{font-family:var(--font-serif);font-size:var(--fs-h2);font-weight:600;color:var(--ink);line-height:1.3;margin:0 0 26px}
.rlp-onb .paragraph{font-family:var(--font-sans);font-size:var(--fs-body);line-height:var(--lh-body);color:var(--text);margin:0 0 18px;max-width:58ch}

.rlp-onb .name-field{display:flex;flex-direction:column;gap:8px;margin:0 0 20px}
.rlp-onb .name-label{font-family:var(--font-sans);font-size:var(--fs-body);font-weight:600;color:var(--ink)}
.rlp-onb .name-input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px;min-height:52px;font-family:var(--font-sans);font-size:var(--fs-body);color:var(--text);box-sizing:border-box;transition:border-color .15s ease,box-shadow .15s ease}
.rlp-onb .name-input:hover{border-color:var(--border-strong)}
.rlp-onb .name-input:focus-visible{border-color:var(--brand-primary);box-shadow:var(--focus-ring)}

.rlp-onb .checkbox-row{display:flex;align-items:flex-start;gap:12px;margin:8px 0 26px;cursor:pointer;background:var(--warm-surface-2);border:1px solid var(--warm-line);border-radius:var(--r-md);padding:14px 16px}
.rlp-onb .checkbox-row input{width:20px;height:20px;margin-top:1px;accent-color:var(--brand-primary);flex-shrink:0;cursor:pointer}
.rlp-onb .checkbox-row input:focus-visible{box-shadow:var(--focus-ring);border-radius:var(--r-xs)}
.rlp-onb .checkbox-row .lab{font-family:var(--font-sans);font-size:var(--fs-sm);line-height:1.5;color:var(--text)}

.rlp-onb .card-list{display:flex;flex-direction:column;gap:12px;width:100%;margin:0 0 28px}
.rlp-onb .card{width:100%;text-align:left;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:18px 20px;min-height:56px;box-shadow:var(--shadow-sm);font-family:var(--font-sans);font-size:var(--fs-body);font-weight:500;color:var(--text);cursor:pointer;transition:background .15s ease,border-color .15s ease,box-shadow .15s ease}
.rlp-onb .card:hover{border-color:var(--border-strong);box-shadow:var(--shadow-md)}
.rlp-onb .card.large{min-height:84px;font-size:var(--fs-section);font-weight:600}
.rlp-onb .card.is-selected{background:var(--brand-primary-tint);border-color:var(--brand-primary);color:var(--ink)}
.rlp-onb .card.is-selected:hover{border-color:var(--brand-primary)}
.rlp-onb .card:focus-visible{box-shadow:var(--focus-ring)}

.rlp-onb .btn{font-family:var(--font-sans);font-size:var(--fs-body);font-weight:600;border:none;border-radius:var(--r-sm);padding:14px 28px;min-height:48px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;line-height:1}
.rlp-onb .btn-navy{background:var(--brand-primary);color:var(--brand-on-primary)}
.rlp-onb .btn-navy:hover:not(:disabled){background:var(--brand-primary-hover)}
.rlp-onb .btn:disabled{opacity:.45;cursor:not-allowed}
.rlp-onb .btn:focus-visible{box-shadow:var(--focus-ring)}

.rlp-onb .skip{background:none;border:none;padding:10px 6px;margin-top:14px;font-family:var(--font-sans);font-size:var(--fs-sm);font-weight:600;color:var(--text-muted);cursor:pointer;min-height:44px}
.rlp-onb .skip:hover{color:var(--text);text-decoration:underline}
.rlp-onb .skip:focus-visible{box-shadow:var(--focus-ring);border-radius:var(--r-sm)}

@media (max-width:560px){
  .rlp-onb{padding:32px 16px 64px}
  .rlp-onb .welcome .body{padding:24px 20px 26px}
  .rlp-onb .hero-heading{font-size:28px}
  .rlp-onb .scene{height:112px}
}
`;
