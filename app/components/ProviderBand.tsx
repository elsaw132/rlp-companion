"use client";

// The provider band header (yellow --brand-band). Reusable on purpose: it lives
// in /home for now, but will be promoted to the global layout once the session
// screen is built so the band stays consistent across dashboard and sessions.
// All text/icons on the band are navy (--brand-on-band).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser, useClerk } from "@clerk/nextjs";
import { useUserData } from "@/lib/userData";
import FeedbackPanel from "./FeedbackPanel";

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
  const { signOut } = useClerk();
  const userData = useUserData();
  const name = userData.loading ? null : userData.getDisplayName(user);
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const initials = initialsOf(user);

  // The Support panel (reuses the feedback infrastructure) and the small
  // account menu under the avatar.
  const [supportOpen, setSupportOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Sign out via Clerk and return to the sign-in screen.
  const handleLogout = () => void signOut({ redirectUrl: "/sign-in" });

  // Close the account menu on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <header className="rlp-band">
      <style>{bandCss}</style>

      {/* Wordmark + descriptor, linking back to the dashboard. The wordmark is
          the provider's text logo — never redraw it; only the string swaps. */}
      <Link href="/home" className="brand" aria-label={`${PROVIDER_NAME} — back to dashboard`}>
        <span className="logo">{PROVIDER_NAME}</span>
        <span className="brand-divider" aria-hidden="true" />
        <span className="descriptor">Digital Retirement Coaching</span>
      </Link>

      <div className="right">
        <button
          type="button"
          className="support"
          onClick={() => setSupportOpen(true)}
        >
          <span aria-hidden="true">◎</span> Support
        </button>

        <div className="account">
          <button
            type="button"
            className="user"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Your account"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {/* Name hidden until Clerk resolves, so the band never flashes a blank chip */}
            {name && <span>{name}</span>}
            <span className="avatar" aria-hidden="true">
              {initials}
            </span>
          </button>

          {menuOpen && (
            <>
              {/* Click-away layer behind the menu. */}
              <button
                type="button"
                className="menu-scrim"
                aria-hidden="true"
                tabIndex={-1}
                onClick={() => setMenuOpen(false)}
              />
              <div className="menu" role="menu">
                <div className="menu-identity">
                  {name && <span className="menu-name">{name}</span>}
                  {email && <span className="menu-email">{email}</span>}
                </div>
                {/* Room for "Delete all my data" and settings (e.g. Vita's tone)
                    will sit here once those ship. */}
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  onClick={handleLogout}
                >
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mounted only while open so each open starts from a clean panel. */}
      {supportOpen && (
        <FeedbackPanel
          open
          onClose={() => setSupportOpen(false)}
          kind="support"
          title="Need a hand?"
          intro="Send us a message and we’ll get back to you. Tell us what you’re stuck on or what you need."
        />
      )}
    </header>
  );
}

const bandCss = `
.rlp-band{height:var(--header-h);background:var(--brand-band);display:flex;align-items:center;justify-content:space-between;padding:0 28px;position:sticky;top:0;z-index:10}
.rlp-band .brand{display:flex;align-items:center;gap:14px;text-decoration:none;border-radius:var(--r-sm)}
.rlp-band .brand:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.rlp-band .logo{font-family:var(--font-serif);font-weight:700;font-size:23px;color:var(--brand-on-band);letter-spacing:-.01em;line-height:1.1}
.rlp-band .brand-divider{width:1px;height:26px;background:var(--brand-on-band);opacity:.32;flex:none}
.rlp-band .descriptor{font-family:var(--font-sans);font-size:var(--fs-sm);font-weight:600;color:var(--brand-on-band);opacity:.85;letter-spacing:.01em;line-height:1.2}
.rlp-band .right{display:flex;align-items:center;gap:20px}
.rlp-band .support{font-family:inherit;font-size:14px;font-weight:600;color:var(--brand-on-band);display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;min-height:44px}
.rlp-band .support:hover{text-decoration:underline;text-underline-offset:3px}
.rlp-band .support:focus-visible{outline:none;box-shadow:var(--focus-ring);border-radius:var(--r-sm)}
.rlp-band .account{position:relative}
.rlp-band .user{display:flex;align-items:center;gap:9px;font-size:14px;font-weight:600;color:var(--brand-on-band);background:none;border:none;cursor:pointer;font-family:inherit;min-height:44px}
.rlp-band .user:focus-visible{outline:none;box-shadow:var(--focus-ring);border-radius:var(--r-sm)}
.rlp-band .avatar{width:34px;height:34px;border-radius:50%;background:var(--brand-primary);color:#fff;display:grid;place-items:center;font-size:14px;font-weight:700}
.rlp-band .menu-scrim{position:fixed;inset:0;background:none;border:none;padding:0;margin:0;cursor:default;z-index:40}
.rlp-band .menu{position:absolute;top:calc(100% + 10px);right:0;z-index:50;min-width:220px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);box-shadow:var(--shadow-md);padding:8px;display:flex;flex-direction:column;gap:4px}
.rlp-band .menu-identity{display:flex;flex-direction:column;gap:2px;padding:8px 10px 10px;border-bottom:1px solid var(--border)}
.rlp-band .menu-name{font-family:var(--font-sans);font-size:var(--fs-sm);font-weight:700;color:var(--ink)}
.rlp-band .menu-email{font-family:var(--font-sans);font-size:var(--fs-sm);color:var(--text-muted);word-break:break-all}
.rlp-band .menu-item{text-align:left;background:none;border:none;border-radius:var(--r-sm);padding:10px;font-family:var(--font-sans);font-size:var(--fs-sm);font-weight:600;color:var(--brand-primary);cursor:pointer;min-height:44px}
.rlp-band .menu-item:hover{background:var(--brand-primary-tint)}
.rlp-band .menu-item:focus-visible{outline:none;box-shadow:var(--focus-ring)}
`;
