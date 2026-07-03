import { SignUp } from "@clerk/nextjs";

// The sign-up screen. Clerk's hosted form runs a human-verification check
// (Cloudflare's "I'm not a robot" challenge) whose spinner keeps turning until
// the box is ticked. A single subtle line below flags what to do if someone
// hits that, without dominating the screen. Styled with design-system tokens.
export default function SignUpPage() {
  return (
    <div className="rlp-signup">
      <style>{css}</style>
      <div className="column">
        <p className="verify-note" role="note">
          If the security check spins without finishing, tick the
          &ldquo;I&apos;m not a robot&rdquo; box to continue.
        </p>
        <SignUp />
      </div>
    </div>
  );
}

const css = `
.rlp-signup{min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:56px 24px 80px;background:var(--bg-alt)}
.rlp-signup .column{display:flex;flex-direction:column;align-items:center;gap:20px;width:100%;max-width:420px}
.rlp-signup .verify-note{width:100%;margin:0;text-align:center;font-family:var(--font-sans);font-size:var(--fs-label);line-height:1.5;color:var(--text-muted)}
`;
