"use client";

// The provider band header (yellow --brand-band). Reusable on purpose: it lives
// in /home for now, but will be promoted to the global layout once the session
// screen is built so the band stays consistent across dashboard and sessions.
// All text/icons on the band are navy (--brand-on-band).

import { useUser } from "@clerk/nextjs";

// The provider whose brand the band carries. Hardcoded for the Aviva white-label
// reference; this is the one piece that swaps per provider.
const PROVIDER_NAME = "Aviva";

function firstNameOf(
  user: ReturnType<typeof useUser>["user"]
): string {
  if (!user) return "";
  return user.firstName || user.fullName?.split(" ")[0] || "";
}

export default function ProviderBand() {
  const { user } = useUser();
  const name = firstNameOf(user);
  const initial = name ? name[0].toUpperCase() : "";

  return (
    <header className="rlp-band">
      <style>{bandCss}</style>
      <div className="logo">{PROVIDER_NAME}</div>
      <div className="right">
        <a href="#" className="support">
          <span aria-hidden="true">◎</span> Support
        </a>
        <div className="user">
          {/* Name hidden until Clerk resolves, so the band never flashes a blank chip */}
          {name && <span>{name}</span>}
          <span className="avatar" aria-hidden="true">
            {initial}
          </span>
        </div>
      </div>
    </header>
  );
}

const bandCss = `
.rlp-band{height:var(--header-h);background:var(--brand-band);display:flex;align-items:center;justify-content:space-between;padding:0 28px;position:sticky;top:0;z-index:10}
.rlp-band .logo{font-family:var(--font-serif);font-weight:700;font-size:23px;color:var(--brand-on-band);letter-spacing:-.01em}
.rlp-band .right{display:flex;align-items:center;gap:20px}
.rlp-band .support{font-size:14px;font-weight:600;color:var(--brand-on-band);display:flex;align-items:center;gap:6px}
.rlp-band .support:focus-visible{outline:none;box-shadow:var(--focus-ring);border-radius:var(--r-sm)}
.rlp-band .user{display:flex;align-items:center;gap:9px;font-size:14px;font-weight:600;color:var(--brand-on-band)}
.rlp-band .avatar{width:34px;height:34px;border-radius:50%;background:var(--brand-primary);color:#fff;display:grid;place-items:center;font-size:14px;font-weight:700}
`;
