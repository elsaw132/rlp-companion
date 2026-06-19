import { SignUp } from "@clerk/nextjs";

// The sign-up screen. Clerk's hosted form runs a human-verification check
// (Cloudflare's "I'm not a robot" challenge) before it can create the account.
// That check shows a spinner that keeps turning until you actually tick the box
// — it does not finish on its own, which previously left people waiting on what
// looked like a stuck screen. The note below makes the required action explicit
// so the spinner is never mistaken for loading. Styled with design-system tokens.
export default function SignUpPage() {
  return (
    <div className="rlp-signup">
      <style>{css}</style>
      <div className="column">
        <div className="verify-note" role="note">
          <span className="vn-title">One quick security check</span>
          <span className="vn-body">
            To create your account, you&apos;ll need to confirm you&apos;re a real
            person. Look for the &ldquo;I&apos;m not a robot&rdquo; box and tick
            it. The spinner next to it keeps turning until you do — it won&apos;t
            finish on its own, so go ahead and tick the box to continue.
          </span>
        </div>
        <SignUp />
      </div>
    </div>
  );
}

const css = `
.rlp-signup{min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:56px 24px 80px;background:var(--bg-alt)}
.rlp-signup .column{display:flex;flex-direction:column;align-items:center;gap:20px;width:100%;max-width:420px}
.rlp-signup .verify-note{width:100%;background:var(--info-surface);border:1px solid var(--info-line);border-radius:var(--r-md);padding:16px 18px;display:flex;flex-direction:column;gap:5px}
.rlp-signup .vn-title{font-family:var(--font-sans);font-size:var(--fs-sm);font-weight:700;color:var(--info-text)}
.rlp-signup .vn-body{font-family:var(--font-sans);font-size:var(--fs-sm);line-height:1.55;color:var(--text)}
`;
