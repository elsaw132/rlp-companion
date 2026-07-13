import { SignIn } from "@clerk/nextjs";

// The sign-in screen. Same invite-only framing as sign-up during the pilot, styled
// with design-system tokens to match.
export default function SignInPage() {
  return (
    <div className="rlp-signin">
      <style>{css}</style>
      <div className="column">
        <p className="pilot-note">
          Chorus is invite-only during the pilot. Sign in with the email address
          your invite was sent to.
        </p>
        <SignIn />
      </div>
    </div>
  );
}

const css = `
.rlp-signin{min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:56px 24px 80px;background:var(--bg-alt)}
.rlp-signin .column{display:flex;flex-direction:column;align-items:center;gap:20px;width:100%;max-width:420px}
.rlp-signin .pilot-note{width:100%;margin:0;text-align:center;font-family:var(--font-sans);font-size:var(--fs-sm);line-height:1.55;color:var(--ink);font-weight:500}
`;
