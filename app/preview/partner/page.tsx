"use client";

// TEMPORARY PREVIEW PAGE — a visual walk-through of the four "Plan with your
// partner" surfaces with dummy Maya/Ray data. No auth, no database, no LLM: the
// components are handed the data directly (their `preview` prop), so every
// interaction is inert or local-only. Public via proxy.ts. Safe to delete once
// reviewed.

import { useState, type CSSProperties } from "react";
import ShareStep, { type ShareData } from "@/app/components/partner/ShareStep";
import WaitingState from "@/app/components/partner/WaitingState";
import ComparisonView, {
  type Payload,
} from "@/app/components/partner/ComparisonView";

const SHARE: ShareData = {
  partnerFirstName: "Ray",
  completed: false,
  aboutPartnerRefs: ["fear:want-different-things"],
  items: [
    { ref: "plan:rhythm", group: "plan", label: "Your days and rhythm — the shape of your week", defaultOn: true },
    { ref: "goal:grandchildren", group: "plan", label: "Time with the grandchildren", defaultOn: true },
    { ref: "goal:painting", group: "plan", label: "Take painting seriously — not just a someday thing", defaultOn: true },
    { ref: "goal:fit", group: "plan", label: "Get properly fit again — walking, swimming", defaultOn: true },
    { ref: "plan:travel", group: "plan", label: "Travel — your plans for trips and time away", defaultOn: true },
    { ref: "plan:leaving-work", group: "plan", label: "Leaving work — when and how you'll step back", defaultOn: true },
    { ref: "hope:main", group: "hopes", label: "To feel useful, not sidelined, once you step back from work.", defaultOn: true },
    { ref: "fear:regret", group: "fears", label: "That you'll regret not leaving work sooner.", defaultOn: true },
    { ref: "fear:health", group: "fears", label: "That your health won't keep up with the plans you're making.", defaultOn: true },
    { ref: "fear:want-different-things", group: "fears", label: "That the two of you want quite different things from these years, and drift.", defaultOn: false, aboutPartner: true },
  ],
  sharedRefs: [
    "plan:rhythm", "goal:grandchildren", "goal:painting", "goal:fit",
    "plan:travel", "plan:leaving-work", "hope:main", "fear:regret", "fear:health",
  ],
};

const COMPARISON: Payload = {
  partners: {
    a: { name: "Maya", cohort: "Winding down", planName: "Retirement Life Plan", initial: "M" },
    b: { name: "Ray", cohort: "Recently retired", planName: "Retirement Reset Plan", initial: "R" },
  },
  framing: {
    opener:
      "You're at different points — Maya still has a foot in work, Ray stepped away eight months ago — so your plans naturally hold different things.",
    close:
      "I've laid out where they meet, where they fit together, and where they point in different directions. None of it is a verdict, and most differences between two people don't resolve — they're for understanding, not fixing.",
  },
  sharedGround: [
    "You both want slow, unhurried mornings — no alarm, coffee, an hour before the day asks anything of you.",
    "Time with the grandchildren, and staying in this house rather than moving — both near the top for each of you.",
  ],
  complementary: [
    {
      text: "Maya wants to keep two days of work for a while; Ray has open weekdays. The days Maya works are days Ray already has free.",
      sides: [
        { name: "Maya", text: "Two days a week at work, for now — for the structure and the people." },
        { name: "Ray", text: "Fully stopped. Weekdays open and unstructured." },
      ],
    },
    {
      text: "Ray wants to take on more of the cooking and the running of the house; Maya wants to carry less of it. Those point the same way.",
    },
  ],
  different: [
    {
      text: "Ray wants a big trip early — weeks away in the first year. Maya wants very little travel while she's still working, and more of it later.",
      clearest: true,
      sides: [
        { name: "Ray", text: "A long trip in year one — the thing he's most looking forward to." },
        { name: "Maya", text: "Little travel for now; the bigger journeys once she's fully stopped." },
      ],
    },
    { text: "Ray pictures a loose week with few fixed points; Maya wants more anchors — regular things to plan around." },
    { text: "Ray's decision is behind him. Maya hasn't set a date, and when the finances allow it is still open. One of you is settled here; the other's still deciding." },
  ],
  goals: {
    a: [
      { label: "Time with the grandchildren", both: true },
      { label: "Stay in this house", both: true },
      { label: "Take painting seriously — not just a someday thing", both: false },
      { label: "Keep two days of work, for now", both: false },
      { label: "Get properly fit again — walking, swimming", both: false },
      { label: "Sort the garden out and grow vegetables", both: false },
    ],
    b: [
      { label: "Time with the grandchildren", both: true },
      { label: "Stay in this house", both: true },
      { label: "A big trip in the first year", both: false },
      { label: "Photography — long walks with the camera", both: false },
      { label: "Learn to cook properly and take over more of it", both: false },
      { label: "Volunteer — maybe the local wildlife trust", both: false },
    ],
  },
  hopes: [
    { slot: "a", text: "To feel useful, not sidelined, once she steps back from work." },
    { slot: "b", text: "More unhurried time together — not just busy time in the same house." },
  ],
  fears: [
    { slot: "b", text: "That he'll lose his sense of purpose without work to structure his days." },
    { slot: "a", text: "That the two of you want quite different things from these years, and drift." },
  ],
  talk: {
    seeds: [
      "Time together and time apart — you're picturing that a little differently right now. Worth hearing what each of you needs.",
      "Travel — less about when, more about what an early trip means to Ray, and what holding off means to Maya.",
      "The shape of the week — what a bit more structure gives Maya, and what a loose week gives Ray.",
      "Ray's worry about losing his sense of purpose — and what, between you, might help hold on to it.",
      "Maya wants to take painting seriously. Worth making space to hear what that's about.",
    ],
    user: [],
  },
};

const COMPARISON_EMPTY: Payload = {
  ...COMPARISON,
  talk: { seeds: [], user: [] },
};

type Surface = "share" | "waiting" | "comparison" | "comparison-empty";
const TABS: { id: Surface; label: string }[] = [
  { id: "share", label: "1 · Share step" },
  { id: "waiting", label: "2 · Waiting state" },
  { id: "comparison", label: "3 · Comparison" },
  { id: "comparison-empty", label: "4 · Talk-list empty state" },
];

export default function PartnerPreviewPage() {
  const [surface, setSurface] = useState<Surface>("share");
  return (
    <div>
      <div style={banner.bar}>
        <strong style={banner.title}>Preview · Plan with your partner</strong>
        <span style={banner.note}>
          Dummy Maya &amp; Ray data. Nothing is saved; buttons are inert.
        </span>
        <span style={banner.tabs}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSurface(t.id)}
              style={{
                ...banner.tab,
                ...(surface === t.id ? banner.tabActive : null),
              }}
            >
              {t.label}
            </button>
          ))}
        </span>
      </div>

      {surface === "share" && <ShareStep preview={SHARE} />}
      {surface === "waiting" && <WaitingState partnerFirstName="Ray" />}
      {surface === "comparison" && <ComparisonView preview={COMPARISON} />}
      {surface === "comparison-empty" && (
        <ComparisonView preview={COMPARISON_EMPTY} />
      )}
    </div>
  );
}

const banner: Record<string, CSSProperties> = {
  bar: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    background: "var(--info-surface)",
    borderBottom: "1px solid var(--info-line)",
    padding: "10px 18px",
    fontFamily: "var(--font-sans)",
    fontSize: 13,
    color: "var(--info-text)",
    display: "flex",
    gap: 16,
    alignItems: "center",
    flexWrap: "wrap",
  },
  title: { fontWeight: 700 },
  note: { color: "var(--text-muted)" },
  tabs: { display: "flex", gap: 6, flexWrap: "wrap", marginLeft: "auto" },
  tab: {
    border: "1px solid var(--border-strong)",
    background: "#fff",
    color: "var(--text)",
    borderRadius: "var(--r-pill)",
    padding: "5px 12px",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
  },
  tabActive: {
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    borderColor: "var(--brand-primary)",
  },
};
