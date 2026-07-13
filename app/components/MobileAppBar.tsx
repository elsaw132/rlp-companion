"use client";

// The unified mobile navigation backbone (Phase 1). One slim sticky bar that
// appears ONLY on phones/tablets (≤880px — the same width at which the desktop
// dashboard sidebar disappears) and replaces the three inconsistent mobile
// chromes (the yellow ProviderBand, the session back-link row, and the floating
// Feedback pill). On desktop it is display:none, so desktop is byte-identical —
// ProviderBand and the session nav bar keep rendering as before.
//
// It carries three things: an always-visible, context-aware back/home control
// (the fix for getting stranded deep in a module), a compact wordmark, and a
// labelled "Menu" sheet holding the secondary destinations. The dashboard's own
// stage arc stays the stage switcher; "Jump to a stage" here just deep-links to
// it via /home?stage=N.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { useUserData } from "@/lib/userData";
import { STAGES } from "@/lib/modules";
import FeedbackPanel from "./FeedbackPanel";
import ModuleFeedbackCard from "./ModuleFeedbackCard";

// The product wordmark — the same string ProviderBand carries. On the compact
// bar we show the wordmark alone (no descriptor), which is the mobile
// "compaction" of the band that wrapped to three lines.
const PROVIDER_NAME = "Chorus Life";

type ClerkUser = ReturnType<typeof useUser>["user"];

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

export default function MobileAppBar() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useClerk();
  const userData = useUserData();

  const [menuOpen, setMenuOpen] = useState(false);
  // Which slide-in panel is open, if any — the Support and Send-feedback items
  // both open the shared FeedbackPanel with a different kind.
  const [panel, setPanel] = useState<null | "feedback" | "support">(null);
  // The module-close feedback card, shown when leaving a *finished* module via
  // the back control (mirrors ModulesBackLink so the moment isn't lost on mobile).
  const [showModuleFeedback, setShowModuleFeedback] = useState(false);

  // Close the menu on Escape, like the desktop account menu.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // (Menu-closing on navigation is handled per-item via closeMenu, so no effect
  // that would setState during render is needed.)
  const closeMenu = () => setMenuOpen(false);

  // Auth screens and the root redirect have no app chrome — render nothing there.
  // (All hooks above run unconditionally, so this early return is safe.)
  if (
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname === "/"
  ) {
    return null;
  }

  const name = userData.loading ? null : userData.getDisplayName(user);
  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const initials = initialsOf(user);

  // ---- Context: what the back control does on this screen ----
  const isSession = pathname.startsWith("/session/");
  const sessionId = isSession
    ? decodeURIComponent(pathname.split("/session/")[1]?.split("/")[0] ?? "")
    : "";
  const isSubScreen = pathname.startsWith("/stage/") || pathname.startsWith("/plan");
  // The hub (/home) and the self-contained onboarding flow need no back control.

  // Leaving a finished module is a module-close moment too — show the same short
  // feedback card the completion buttons do, once per module, then go home.
  const moduleFinished =
    isSession && userData.getCompletedIds().includes(sessionId);
  const shouldPromptModule =
    moduleFinished && !userData.hasPromptedModuleFeedback(sessionId);

  function handleModuleBack() {
    if (shouldPromptModule) {
      void userData.markModuleFeedbackPrompted(sessionId);
      setShowModuleFeedback(true);
      return;
    }
    router.push("/home");
  }

  async function handleStartOver() {
    setMenuOpen(false);
    const ok = window.confirm(
      "This clears all your answers and conversations. Start over?"
    );
    if (!ok) return;
    await userData.resetAll();
    router.push("/onboarding");
  }

  const handleLogout = () => {
    setMenuOpen(false);
    void signOut({ redirectUrl: "/sign-in" });
  };

  const activeStage = userData.loading ? STAGES.length : userData.getActiveStage();

  return (
    <>
      <style>{appBarCss}</style>

      <header className="rlp-appbar">
        {/* Left — context-aware back control, always visible (the key fix). */}
        <div className="ab-left">
          {isSession ? (
            <button type="button" className="ab-back" onClick={handleModuleBack}>
              <span aria-hidden="true">‹</span> Your modules
            </button>
          ) : isSubScreen ? (
            <Link href="/home" className="ab-back">
              <span aria-hidden="true">‹</span> Dashboard
            </Link>
          ) : (
            <Link href="/home" className="ab-word" aria-label={`${PROVIDER_NAME} — dashboard`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/chorus-life-logo-white.svg" alt={PROVIDER_NAME} width={63} height={20} />
            </Link>
          )}
        </div>

        {/* Right — the labelled Menu (a word, not a bare icon, for clarity). */}
        <button
          type="button"
          className="ab-menu-btn"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="ab-menu-lines" aria-hidden="true">
            <span /><span /><span />
          </span>
          Menu
        </button>
      </header>

      {menuOpen && (
        <>
          <button
            type="button"
            className="ab-scrim"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="ab-sheet" role="menu" aria-label="Menu">
            {(name || email) && (
              <div className="ab-identity">
                <span className="ab-avatar" aria-hidden="true">{initials}</span>
                <span className="ab-idtext">
                  {name && <span className="ab-name">{name}</span>}
                  {email && <span className="ab-email">{email}</span>}
                </span>
              </div>
            )}

            <Link href="/home" className="ab-item" role="menuitem" onClick={closeMenu}>Dashboard</Link>
            <Link href="/plan" className="ab-item" role="menuitem" onClick={closeMenu}>Your Plan</Link>

            <div className="ab-group-label">Jump to a stage</div>
            {STAGES.map((s) => {
              const locked = s.number > activeStage;
              return locked ? (
                <span key={s.number} className="ab-item ab-stage ab-locked" aria-disabled="true">
                  <span className="ab-stage-num">{s.number}</span> {s.name}
                </span>
              ) : (
                <Link
                  key={s.number}
                  href={`/home?stage=${s.number}`}
                  className="ab-item ab-stage"
                  role="menuitem"
                  onClick={closeMenu}
                >
                  <span className="ab-stage-num">{s.number}</span> {s.name}
                </Link>
              );
            })}

            <div className="ab-divider" aria-hidden="true" />

            <button type="button" className="ab-item" role="menuitem" onClick={() => { setMenuOpen(false); setPanel("support"); }}>
              Support
            </button>
            <button type="button" className="ab-item" role="menuitem" onClick={() => { setMenuOpen(false); setPanel("feedback"); }}>
              Send feedback
            </button>
            <button type="button" className="ab-item" role="menuitem" onClick={handleStartOver}>
              Start over
            </button>
            <button type="button" className="ab-item ab-signout" role="menuitem" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </>
      )}

      {/* Shared feedback/support panel — same component the desktop chrome uses. */}
      {panel === "support" && (
        <FeedbackPanel
          open
          onClose={() => setPanel(null)}
          kind="support"
          title="Need a hand?"
          intro="Send us a message and we’ll get back to you. Tell us what you’re stuck on or what you need."
        />
      )}
      {panel === "feedback" && (
        <FeedbackPanel open onClose={() => setPanel(null)} />
      )}

      {/* Module-close feedback card when leaving a finished module. */}
      {showModuleFeedback && (
        <div
          className="ab-module-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="A quick word on this module"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModuleFeedback(false);
          }}
        >
          <ModuleFeedbackCard
            moduleId={sessionId}
            onDone={() => router.push("/home")}
            onSkip={() => router.push("/home")}
          />
        </div>
      )}
    </>
  );
}

const appBarCss = `
/* Desktop is untouched: the bar is display:none above 880px, where ProviderBand
   and the session nav bar keep doing their job. */
.rlp-appbar{display:none}

@media (max-width:880px){
  .rlp-appbar{
    display:flex;align-items:center;justify-content:space-between;gap:12px;
    position:sticky;top:0;z-index:100;
    background:var(--brand-band);
    padding:0 16px;
    padding-top:env(safe-area-inset-top);
    min-height:calc(54px + env(safe-area-inset-top));
    box-sizing:border-box;
  }
  .rlp-appbar a{text-decoration:none}
  /* Controls sit on the dark-green band, so their focus ring is lime. */
  .rlp-appbar :focus-visible{outline:none;box-shadow:var(--focus-ring-accent);border-radius:var(--r-sm)}

  .rlp-appbar .ab-left{min-width:0;display:flex;align-items:center}
  .rlp-appbar .ab-back{
    display:inline-flex;align-items:center;gap:6px;
    background:none;border:none;cursor:pointer;font-family:var(--font-sans);
    font-size:var(--fs-body);font-weight:600;color:var(--brand-on-band);
    padding:8px 6px 8px 0;min-height:44px;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  }
  .rlp-appbar .ab-back span[aria-hidden]{font-size:22px;line-height:1}
  .rlp-appbar .ab-word{
    display:inline-flex;align-items:center;min-height:44px;
  }
  .rlp-appbar .ab-word img{height:20px;width:auto;display:block}
  .rlp-appbar .ab-menu-btn{
    flex:none;display:inline-flex;align-items:center;gap:8px;
    background:none;border:none;cursor:pointer;font-family:var(--font-sans);
    font-size:var(--fs-body);font-weight:600;color:var(--brand-on-band);
    padding:8px 4px;min-height:44px;
  }
  .rlp-appbar .ab-menu-lines{display:inline-flex;flex-direction:column;gap:3px;width:18px}
  .rlp-appbar .ab-menu-lines span{display:block;height:2px;border-radius:2px;background:var(--brand-on-band)}

  /* The sheet + scrim — only reachable when the bar (mobile-only) is tapped. */
  .ab-scrim{
    position:fixed;inset:0;z-index:110;border:none;padding:0;margin:0;cursor:default;
    background:rgba(22,32,46,.45);animation:ab-fade .16s ease-out;
  }
  .ab-sheet{
    position:fixed;z-index:120;
    top:calc(54px + env(safe-area-inset-top));left:0;right:0;
    max-height:calc(100dvh - 54px - env(safe-area-inset-top));overflow-y:auto;
    background:var(--surface);border-bottom:1px solid var(--border);
    box-shadow:var(--shadow-md);
    padding:10px 12px calc(14px + env(safe-area-inset-bottom));
    display:flex;flex-direction:column;gap:2px;
    animation:ab-slide .18s ease-out;
  }
  .ab-identity{display:flex;align-items:center;gap:12px;padding:10px 10px 12px;border-bottom:1px solid var(--border);margin-bottom:6px}
  .ab-avatar{flex:none;width:40px;height:40px;border-radius:50%;background:var(--brand-primary);color:#fff;display:grid;place-items:center;font-size:15px;font-weight:700}
  .ab-idtext{display:flex;flex-direction:column;gap:2px;min-width:0}
  .ab-name{font-family:var(--font-sans);font-size:var(--fs-body);font-weight:700;color:var(--ink)}
  .ab-email{font-family:var(--font-sans);font-size:var(--fs-sm);color:var(--text-muted);word-break:break-all}
  .ab-item{
    display:flex;align-items:center;gap:10px;text-align:left;
    background:none;border:none;border-radius:var(--r-sm);
    padding:12px 10px;min-height:48px;cursor:pointer;
    font-family:var(--font-sans);font-size:var(--fs-body);font-weight:600;
    color:var(--brand-primary);width:100%;
  }
  .ab-item:hover{background:var(--brand-primary-tint)}
  .ab-group-label{padding:12px 10px 4px;font-size:var(--fs-eyebrow);letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted);font-weight:700}
  .ab-stage{color:var(--ink);font-weight:600}
  .ab-stage-num{flex:none;width:24px;height:24px;border-radius:50%;background:var(--brand-primary-tint);color:var(--brand-primary);display:grid;place-items:center;font-size:13px;font-weight:700}
  .ab-locked{color:var(--text-faint);cursor:default}
  .ab-locked .ab-stage-num{background:var(--muted-surface);color:var(--text-faint)}
  .ab-locked:hover{background:none}
  .ab-divider{height:1px;background:var(--border);margin:6px 4px}
  .ab-signout{color:var(--text-muted)}

  .ab-module-overlay{
    position:fixed;inset:0;z-index:130;display:flex;align-items:center;justify-content:center;
    padding:24px;background:rgba(22,32,46,.45);animation:ab-fade .18s ease-out;
  }
}

@keyframes ab-fade{from{opacity:0}to{opacity:1}}
@keyframes ab-slide{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){
  .ab-scrim,.ab-sheet,.ab-module-overlay{animation:none}
}
`;
