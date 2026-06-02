"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
  const [partner, setPartner] = useState("");
  const [horizon, setHorizon] = useState("");
  const [motivation, setMotivation] = useState("");

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
    return <main style={styles.page} />;
  }

  return (
    <main style={styles.page}>
      <style>{focusCss}</style>
      <div style={styles.column}>
        {step === 1 && (
          <Welcome
            understood={understood}
            setUnderstood={setUnderstood}
            onContinue={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <CardStep
            heading="When you picture your retirement, is it just you — or you and a partner?"
            serif={false}
            options={PARTNER_OPTIONS}
            selected={partner}
            onSelect={setPartner}
            large
            onContinue={() => {
              save({ partner });
              setStep(3);
            }}
            buttonLabel="Continue"
          />
        )}

        {step === 3 && (
          <CardStep
            heading="Roughly how far from retirement are you?"
            serif={false}
            options={HORIZON_OPTIONS}
            selected={horizon}
            onSelect={setHorizon}
            onContinue={() => {
              save({ horizon });
              setStep(4);
            }}
            buttonLabel="Continue"
          />
        )}

        {step === 4 && (
          <CardStep
            heading="What's prompted you to start thinking about retirement?"
            serif={false}
            options={MOTIVATION_OPTIONS}
            selected={motivation}
            onSelect={setMotivation}
            onContinue={() => {
              save({ motivation });
              router.push("/home");
            }}
            buttonLabel="Finish"
            onSkip={() => {
              save({ motivation: null });
              router.push("/home");
            }}
          />
        )}
      </div>
    </main>
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
    <>
      <h1 style={styles.heroHeading}>Your retirement, your way</h1>
      <p style={styles.paragraph}>
        This is a five-stage programme. Each stage is made up of several short
        modules — around 10–20 minutes each — that you can work through at your
        own pace. Every module is an expert-designed exercise to help you think
        about and get clear on your next chapter.
      </p>
      <p style={styles.paragraph}>
        Vita, your AI coach, is there to guide you the whole way through. Vita
        isn&apos;t a person and won&apos;t give financial, legal, or medical
        advice — what Vita&apos;s good at is asking the right questions and
        helping you make sense of your own answers.
      </p>

      <label style={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={understood}
          onChange={(e) => setUnderstood(e.target.checked)}
          style={styles.checkbox}
        />
        <span style={styles.checkboxLabel}>
          I understand Vita is an AI coach, not a human, and doesn&apos;t give
          financial, legal or medical advice.
        </span>
      </label>

      <PrimaryButton disabled={!understood} onClick={onContinue}>
        Get started
      </PrimaryButton>
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
      <h1 style={styles.stepHeading}>{heading}</h1>
      <div style={styles.cardList}>
        {options.map((opt) => {
          const isSelected = selected === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onSelect(opt)}
              aria-pressed={isSelected}
              className="select-card"
              style={{
                ...styles.card,
                ...(large ? styles.cardLarge : null),
                ...(isSelected ? styles.cardSelected : null),
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
      <PrimaryButton disabled={!selected} onClick={onContinue}>
        {buttonLabel}
      </PrimaryButton>
      {onSkip && (
        <button type="button" onClick={onSkip} className="skip-link" style={styles.skipLink}>
          Skip
        </button>
      )}
    </>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="primary-btn"
      style={{
        ...styles.primaryButton,
        ...(disabled ? styles.primaryButtonDisabled : null),
      }}
    >
      {children}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "var(--bg)",
    fontFamily: "var(--font-sans)",
    display: "flex",
    justifyContent: "center",
    padding: "64px 24px",
  },
  column: {
    width: "100%",
    maxWidth: "560px",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
  },
  heroHeading: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-display)",
    fontWeight: 600,
    color: "var(--ink)",
    lineHeight: 1.2,
    margin: "0 0 24px",
  },
  stepHeading: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-h2)",
    fontWeight: 600,
    color: "var(--ink)",
    lineHeight: 1.3,
    margin: "0 0 28px",
  },
  paragraph: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--text)",
    margin: "0 0 20px",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    margin: "12px 0 32px",
    cursor: "pointer",
  },
  checkbox: {
    width: "20px",
    height: "20px",
    marginTop: "2px",
    accentColor: "var(--brand-primary)",
    flexShrink: 0,
    cursor: "pointer",
  },
  checkboxLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--text)",
  },
  cardList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    width: "100%",
    margin: "0 0 32px",
  },
  card: {
    width: "100%",
    textAlign: "left",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "18px 20px",
    minHeight: "56px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    fontWeight: 500,
    color: "var(--text)",
    cursor: "pointer",
    transition: "background .15s, border-color .15s",
  },
  cardLarge: {
    minHeight: "96px",
    fontSize: "var(--fs-section)",
    fontWeight: 600,
  },
  cardSelected: {
    background: "var(--brand-primary-tint)",
    border: "1px solid var(--brand-primary)",
    color: "var(--ink)",
  },
  primaryButton: {
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    border: "none",
    borderRadius: "var(--r-sm)",
    padding: "13px 28px",
    minHeight: "48px",
    cursor: "pointer",
  },
  primaryButtonDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
  skipLink: {
    background: "none",
    border: "none",
    padding: "8px 4px",
    marginTop: "16px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--text-muted)",
    cursor: "pointer",
  },
};

const focusCss = `
  .primary-btn:not(:disabled):hover { background: var(--brand-primary-hover); }
  .primary-btn:focus-visible,
  .select-card:focus-visible,
  .skip-link:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .select-card:not([aria-pressed="true"]):hover { border-color: var(--border-strong); }
  .skip-link:hover { color: var(--text); text-decoration: underline; }
`;
