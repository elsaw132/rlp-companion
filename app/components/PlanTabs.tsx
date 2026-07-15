"use client";

// The plan document's tab bar. There was no tabs contract in DESIGN_SYSTEM.md, so
// this is built to the rules that do exist:
//   - Tab labels are CONTROLS, so they're sans, never serif (DESIGN_SYSTEM "if the
//     user is meant to feel it, it's serif; if it's a control, label or status,
//     it's sans").
//   - "Orange is the cursor" — orange marks the one current thing and nothing
//     else. Inside the plan there is no other current-step marker, so the ACTIVE
//     tab is the cursor: --accent-surface fill + --accent-line border. The label
//     stays --ink, never white-on-orange, because bright --accent only meets AA
//     for large text.
//   - Tap targets >= 44px; a focus ring is mandatory.
// Unlike the sidebar nav there is no locked state — every tab of a finished plan
// is always reachable.
//
// Accessibility follows the WAI-ARIA tabs pattern with a roving tabindex and
// automatic activation (arrow keys move selection, since panels are cheap).

import { useRef } from "react";

export type PlanTabDef = { id: string; label: string };

export default function PlanTabs({
  tabs,
  activeId,
  onChange,
  children,
}: {
  tabs: PlanTabDef[];
  activeId: string;
  onChange: (id: string) => void;
  // The active tab's content. Wrapped here so the tabpanel wiring lives in one
  // place rather than being re-stated at every call site.
  children: React.ReactNode;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);

  function focusTab(index: number) {
    const clamped = (index + tabs.length) % tabs.length;
    const next = tabs[clamped];
    if (!next) return;
    onChange(next.id);
    // Move real focus with selection so the keyboard user lands where they look.
    const el = listRef.current?.querySelector<HTMLButtonElement>(
      `#${tabId(next.id)}`
    );
    el?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const i = tabs.findIndex((t) => t.id === activeId);
    if (i < 0) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusTab(i + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusTab(i - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusTab(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusTab(tabs.length - 1);
    }
  }

  return (
    <div className="rlp-tabs">
      <style>{css}</style>

      <div
        className="rlp-tablist"
        role="tablist"
        aria-label="Your plan"
        ref={listRef}
        onKeyDown={onKeyDown}
      >
        {tabs.map((t) => {
          const on = t.id === activeId;
          return (
            <button
              key={t.id}
              type="button"
              id={tabId(t.id)}
              role="tab"
              aria-selected={on}
              aria-controls={panelId(t.id)}
              tabIndex={on ? 0 : -1}
              className={`rlp-tab${on ? " on" : ""}`}
              onClick={() => onChange(t.id)}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        className="rlp-tabpanel"
        role="tabpanel"
        id={panelId(activeId)}
        aria-labelledby={tabId(activeId)}
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  );
}

function tabId(id: string): string {
  return `rlp-tab-${id}`;
}
function panelId(id: string): string {
  return `rlp-panel-${id}`;
}

const css = `
.rlp-tabs .rlp-tablist{
  display:flex;gap:6px;align-items:stretch;
  border-bottom:1px solid var(--border);
  margin-bottom:28px;
  overflow-x:auto;scrollbar-width:none;
  /* overflow-x:auto makes the OTHER axis clip too, which sliced the top off the
     active tab's border and rounded corners. The padding gives the tabs room to
     sit inside the scroll box; the negative margin keeps the strip's own
     alignment unchanged. */
  padding-top:4px;margin-top:-4px;
}
.rlp-tabs .rlp-tablist::-webkit-scrollbar{display:none}
/* Every tab carries a resting surface and border, not just the active one: as
   bare text on a bare background they read as labels rather than controls. */
.rlp-tabs .rlp-tab{
  flex:none;
  font-family:var(--font-sans);font-size:14px;font-weight:600;
  color:var(--text-muted);
  background:var(--bg-alt);
  border:1px solid var(--border);border-bottom:none;
  border-radius:var(--r-sm) var(--r-sm) 0 0;
  padding:12px 16px;min-height:44px;
  cursor:pointer;white-space:nowrap;
  margin-bottom:-1px;
}
.rlp-tabs .rlp-tab:hover{color:var(--ink);background:var(--bg)}
/* Active tab = the cursor. Orange surface + line, ink label (never on orange). */
.rlp-tabs .rlp-tab.on{
  background:var(--accent-surface);
  border-color:var(--accent-line);
  border-bottom:1px solid var(--accent-surface);
  color:var(--ink);
}
.rlp-tabs .rlp-tab:focus-visible{outline:none;box-shadow:var(--focus-ring);border-radius:var(--r-sm)}
.rlp-tabs .rlp-tabpanel:focus-visible{outline:none;box-shadow:var(--focus-ring);border-radius:var(--r-sm)}

@media(max-width:600px){
  .rlp-tabs .rlp-tablist{gap:2px;margin-bottom:22px}
  .rlp-tabs .rlp-tab{padding:12px 12px;font-size:13.5px}
}
`;
