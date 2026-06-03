"use client";

// The provider band header (yellow --brand-band). Reusable on purpose: it lives
// in /home for now, but will be promoted to the global layout once the session
// screen is built so the band stays consistent across dashboard and sessions.
// All text/icons on the band are navy (--brand-on-band).

import { useUser } from "@clerk/nextjs";
import { useUserData } from "@/lib/userData";

// The provider whose brand the band carries. This is the one piece that swaps
// per provider; the brand colours (yellow band, navy) stay as they are.
const PROVIDER_NAME = "Lionsgate Pensions";

type ClerkUser = ReturnType<typeof useUser>["user"];

// The avatar initials: first + last initial, falling back to the first initial
// alone, then the first letter of the email if there's no name at all.
function initialsOf(user: ClerkUser): string {
  if (!user) return "";
  const first = user.firstName?.trim();
  const last = user.lastName?.trim();
  if (first && last) return (first[0] + last[0]).toUpperCase();
  if (first) return first[0].toUpperCase();
  const email = user.primaryEmailAddress?.emailAddress;
  if (email) return email[0].toUpperCase();
  return "";
}

export default function ProviderBand() {
  const { user } = useUser();
  const userData = useUserData();
  const name = userData.loading ? null : userData.getDisplayName(user);
  const initials = initialsOf(user);

  return (
    <header className="rlp-band">
      <style>{bandCss}</style>
      <div className="logo">{PROVIDER_NAME}</div>
      <div className="right">
        <a href="#" className="support">
          <span aria-hidden="true">◎</span> Support
        </a>
        {/* Account entry point. The account page isn't built yet, so this is a
            button placeholder for now; it'll link to account info later. */}
        <button type="button" className="user" aria-label="Your account">
          {/* Name hidden until Clerk resolves, so the band never flashes a blank chip */}
          {name && <span>{name}</span>}
          <span className="avatar" aria-hidden="true">
            {initials}
          </span>
        </button>
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
.rlp-band .user{display:flex;align-items:center;gap:9px;font-size:14px;font-weight:600;color:var(--brand-on-band);background:none;border:none;cursor:pointer;font-family:inherit;min-height:44px}
.rlp-band .user:focus-visible{outline:none;box-shadow:var(--focus-ring);border-radius:var(--r-sm)}
.rlp-band .avatar{width:34px;height:34px;border-radius:50%;background:var(--brand-primary);color:#fff;display:grid;place-items:center;font-size:14px;font-weight:700}
`;
