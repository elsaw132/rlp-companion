import { SignUp } from "@clerk/nextjs";

// The sign-up screen. Chorus is invite-only during the pilot (enforced by the
// Clerk allowlist), so this page frames that: a line above telling people to use
// their invited email, and a waitlist link below so a blocked address is never a
// dead end. Clerk's hosted form also runs a human-verification check whose spinner
// keeps turning until the box is ticked — the verify note flags that. Styled with
// design-system tokens.
export default function SignUpPage() {
  return (
    <div className="rlp-signup">
      <style>{css}</style>
      <div className="column">
        <p className="pilot-note">
          Chorus is invite-only during the pilot. Use the email address your invite
          was sent to.
        </p>
        <p className="verify-note" role="note">
          If the security check spins without finishing, tick the
          &ldquo;I&apos;m not a robot&rdquo; box to continue.
        </p>
        <SignUp />
        <p className="waitlist">
          Not on the pilot yet?{" "}
          <a href="https://chorus-life.com/#waitlist">Join the waitlist &rarr;</a>
        </p>
      </div>
    </div>
  );
}

const css = `
.rlp-signup{min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:56px 24px 80px;background:var(--bg-alt)}
.rlp-signup .column{display:flex;flex-direction:column;align-items:center;gap:20px;width:100%;max-width:420px}
.rlp-signup .pilot-note{width:100%;margin:0;text-align:center;font-family:var(--font-sans);font-size:var(--fs-sm);line-height:1.55;color:var(--ink);font-weight:500}
.rlp-signup .verify-note{width:100%;margin:0;text-align:center;font-family:var(--font-sans);font-size:var(--fs-label);line-height:1.5;color:var(--text-muted)}
.rlp-signup .waitlist{width:100%;margin:0;text-align:center;font-family:var(--font-sans);font-size:var(--fs-sm);color:var(--text-muted)}
.rlp-signup .waitlist a{color:var(--brand-primary);font-weight:600;text-decoration:none}
.rlp-signup .waitlist a:hover{text-decoration:underline;text-underline-offset:3px}
.rlp-signup .waitlist a:focus-visible{outline:none;box-shadow:var(--focus-ring);border-radius:var(--r-sm)}
`;
