"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import FeedbackPanel from "@/app/components/FeedbackPanel";
import ModuleFeedbackCard from "@/app/components/ModuleFeedbackCard";
import VitaMark from "../VitaMark";
import { useUserData } from "@/lib/userData";
import { useModuleTimer } from "@/lib/useModuleTimer";

// The couples module's id in the programme. Viewing the joint report records
// time against it and marks it complete, so it behaves like every other session
// on the dashboard (time tracked, "Complete ✓" not "Get started").
const MODULE_ID = "5.1";

// Where we remember that this person has already answered (or skipped) the
// couples-module feedback, so the foot-of-report card shows once and never
// nags on a revisit. Both Done and Skip set it.
const FEEDBACK_DONE_KEY = "couples-feedback-5.1-done";

// The comparison view: two plans side by side, organised into tabs so it reads
// like the RLP plan rather than one long scroll. A persistent header (partner
// labels + Vita's framing) sits above the tabs. Deterministic content is
// rendered straight from the payload; the framing/observations/seed-topics are
// Vita-generated. Goals, values and strengths expand for detail. It reads
// identically whichever partner opens it. No completion state.

type Obs = { text: string; sides?: { name: string; text: string }[]; clearest?: boolean };
type Slot = "a" | "b";
type PM = { name: string; cohort: string; planName: string; initial: string };
type GoalDetail = {
  area?: string;
  note?: string;
  cadence?: string;
  season?: string;
  looksLike?: string;
  ordinaryWeek?: string;
};
type GoalEntry = { label: string; both: boolean; detail?: GoalDetail };
type ValueEntry = { label: string; both: boolean; description?: string; nonNegotiable?: boolean };
type StrengthEntry = { label: string; both: boolean; note?: string };

export type Payload = {
  partners: { a: PM; b: PM };
  framing: { opener: string; close: string };
  // Short Vita synthesis that opens the goals / matters / feelings tabs, so they
  // read as intentional rather than as bare lists. Any may be null (a report
  // cached before these existed) — the tab then renders without one.
  summaries?: { goals: string | null; matters: string | null; feelings: string | null };
  sharedGround: string[];
  complementary: Obs[];
  different: Obs[];
  goals: { a: GoalEntry[]; b: GoalEntry[] };
  values: { a: ValueEntry[]; b: ValueEntry[] };
  strengths: { a: StrengthEntry[]; b: StrengthEntry[] };
  hopes: { slot: Slot; text: string }[];
  fears: { slot: Slot; text: string }[];
  talk: { seeds: string[]; user: { id: string; slot: Slot; body: string }[] };
};

type TabId = "meet" | "goals" | "matters" | "feelings" | "talk";

const colourFor = (slot: Slot) =>
  slot === "a" ? "var(--partner-a)" : "var(--partner-b)";

export default function ComparisonView({ preview }: { preview?: Payload } = {}) {
  const router = useRouter();
  const userData = useUserData();
  // Track on-screen time on the joint report against module 5.1, so the admin's
  // per-module time picks it up like any other session. `completed` stays false:
  // there's no single "finish" moment here, and a true would stop the clock at
  // once; completion for the dashboard is handled separately below.
  useModuleTimer(MODULE_ID, false);
  const [data, setData] = useState<Payload | null>(preview ?? null);
  const [error, setError] = useState(false);
  const [userTopics, setUserTopics] = useState<Payload["talk"]["user"]>(
    preview?.talk.user ?? []
  );
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [tab, setTab] = useState<TabId | null>(null);
  // Foot-of-report feedback (module 5.1). `null` while we're still checking
  // whether they've answered before; once known, `true` hides the card for
  // good and `false` shows it. Never shown in the dummy-data preview.
  const [feedbackDone, setFeedbackDone] = useState<boolean | null>(
    preview ? true : null
  );

  useEffect(() => {
    if (preview) return;
    let live = true;
    fetch("/api/partner/comparison")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Payload) => {
        if (!live) return;
        setData(d);
        setUserTopics(d.talk.user);
      })
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [preview]);

  // Have they already given (or skipped) feedback for this module? One read of
  // their stored flag; if the read fails we treat it as "not yet" so feedback
  // still gets a chance to be collected. Best-effort, never blocks the report.
  useEffect(() => {
    if (preview) return;
    let live = true;
    fetch("/api/user-data")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((all: Record<string, unknown>) => {
        if (live) setFeedbackDone(all[FEEDBACK_DONE_KEY] === true);
      })
      .catch(() => live && setFeedbackDone(false));
    return () => {
      live = false;
    };
  }, [preview]);

  // Viewing the ready joint report IS completing the couples module — there's no
  // separate finish step. Mark 5.1 complete once it's actually on screen, so the
  // dashboard shows it done ("Complete ✓") rather than "Get started". Idempotent:
  // markModuleComplete no-ops if it's already in the completed list.
  useEffect(() => {
    if (preview || !data || userData.loading) return;
    if (!userData.getCompletedIds().includes(MODULE_ID)) {
      void userData.markModuleComplete(MODULE_ID);
    }
  }, [preview, data, userData]);

  // Hide the card and remember the answer, on both Done and Skip. The save is
  // best-effort — a failed write just means they might see it once more.
  function markFeedbackDone() {
    setFeedbackDone(true);
    fetch("/api/user-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: FEEDBACK_DONE_KEY, value: true }),
    }).catch(() => {});
  }

  const slotForName = useMemo(() => {
    return (name: string): Slot | null => {
      if (!data) return null;
      const n = name.trim().toLowerCase();
      if (data.partners.a.name.trim().toLowerCase() === n) return "a";
      if (data.partners.b.name.trim().toLowerCase() === n) return "b";
      return null;
    };
  }, [data]);

  async function addTopic() {
    const body = draft.trim();
    if (!body || adding) return;
    if (preview) {
      setUserTopics((prev) => [...prev, { id: `local-${prev.length + 1}`, slot: "a", body }]);
      setDraft("");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/partner/talk-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        topic?: { id: string; slot: Slot; body: string };
      };
      if (res.ok && json.ok && json.topic) {
        setUserTopics((prev) => [...prev, json.topic!]);
        setDraft("");
      }
    } finally {
      setAdding(false);
    }
  }

  async function stopSharing() {
    if (preview) return;
    if (
      !window.confirm(
        "Stop sharing? This closes the shared view for both of you, and each plan goes back to being your own."
      )
    ) {
      return;
    }
    await fetch("/api/partner/withdraw", { method: "POST" });
    router.refresh();
  }

  if (error) {
    return (
      <main style={styles.page}>
        <p style={styles.loadNote}>
          Something went wrong bringing your plans together. Please refresh to try
          again.
        </p>
      </main>
    );
  }
  if (!data) {
    return (
      <main style={styles.page}>
        <p style={styles.loadNote}>Bringing your plans together…</p>
      </main>
    );
  }

  const { partners } = data;
  const hasTalk = data.talk.seeds.length > 0 || userTopics.length > 0;

  const tabs: { id: TabId; label: string }[] = [];
  if (data.sharedGround.length || data.complementary.length || data.different.length)
    tabs.push({ id: "meet", label: "Where you meet" });
  if (data.goals.a.length || data.goals.b.length)
    tabs.push({ id: "goals", label: "Goals" });
  if (data.values.a.length || data.values.b.length || data.strengths.a.length || data.strengths.b.length)
    tabs.push({ id: "matters", label: "What matters" });
  if (data.hopes.length || data.fears.length)
    tabs.push({ id: "feelings", label: "Hopes & fears" });
  tabs.push({ id: "talk", label: "Talk together" });
  const active: TabId = tab ?? tabs[0]?.id ?? "talk";
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === active));
  const prevTab = tabs[activeIndex - 1] ?? null;
  const nextTab = tabs[activeIndex + 1] ?? null;

  const goToTab = (id: TabId) => {
    setTab(id);
    // Bring the reader back to the top of the report when they page forward, so
    // the next part starts at its heading rather than mid-scroll.
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // A row is only tap-to-expand when it actually carries detail. The "tap to
  // see more" hints are gated on this so they never invite a tap that does
  // nothing (goals carry detail; values/strengths only sometimes do).
  const goalsExpandable = [...data.goals.a, ...data.goals.b].some((g) => !!g.detail);
  const valuesExpandable = [...data.values.a, ...data.values.b].some((v) => !!v.description);
  const strengthsExpandable = [...data.strengths.a, ...data.strengths.b].some((s) => !!s.note);

  return (
    <main style={styles.page}>
      <p style={styles.eyebrow}>Plan with your partner</p>
      <h1 style={styles.h1}>Bringing your plans together</h1>
      <p style={styles.lede}>
        You&rsquo;ve each built your plan on your own. This is the one place they
        sit side by side — to see what you share, where you fit together, and
        what&rsquo;s worth a conversation. Not everything needs to line up.
      </p>

      <div style={styles.people}>
        {(["a", "b"] as Slot[]).map((slot) => (
          <div key={slot} style={styles.person}>
            <Dot partners={partners} slot={slot} />
            <span>
              <b style={styles.personName}>{partners[slot].name}</b>
              <span style={styles.personMeta}>
                {partners[slot].cohort} · {partners[slot].planName}
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* Vita framing — persistent above the tabs */}
      <div style={styles.vitaCard}>
        <span style={styles.vitaTag}>
          <VitaMark size={22} />
          From Vita
        </span>
        <p style={styles.vitaCardText}>
          {data.framing.opener} {data.framing.close}
        </p>
      </div>

      <p style={styles.tabsIntro}>
        Your two plans are compared across the {tabs.length} parts below. Move
        through them with these buttons — or the <b>Back</b> and <b>Next</b>{" "}
        links at the foot of each part — and at the very end you&rsquo;ll be asked
        for a little feedback on the shared view.
      </p>

      <div role="tablist" aria-label="Comparison sections" style={styles.tabBar}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setTab(t.id)}
            style={{ ...styles.tab, ...(active === t.id ? styles.tabActive : null) }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* WHERE YOU MEET — the Vita synthesis */}
      {active === "meet" && (
        <div>
          {data.sharedGround.length > 0 && (
            <Section heading="Shared ground" subtitle="where your plans landed together" note="A good place to start — the things you both put near the top.">
              {data.sharedGround.map((t, i) => (
                <div key={i} style={{ ...styles.item, ...styles.itemShared }}>
                  <p style={styles.obs}>{t}</p>
                </div>
              ))}
            </Section>
          )}
          {data.complementary.length > 0 && (
            <Section heading="Where you complement each other" note="Different choices that seem to fit together rather than pull apart.">
              {data.complementary.map((o, i) => (
                <Observation key={i} o={o} kind="comp" slotForName={slotForName} />
              ))}
            </Section>
          )}
          {data.different.length > 0 && (
            <Section heading="Where your plans differ" note="Not problems — just places your two pictures don't line up. These are often the most useful things to talk about, and the conversation is usually less about the what than the why beneath it.">
              {data.different.map((o, i) => (
                <Observation key={i} o={o} kind="diff" slotForName={slotForName} />
              ))}
            </Section>
          )}
        </div>
      )}

      {/* GOALS */}
      {active === "goals" && (
        <>
          <TabSummary text={data.summaries?.goals ?? null} />
        <Section
          heading="Goals — the full picture"
          note="Every goal each of you named, including those that are simply your own. The ones that stood out are marked."
          hint={goalsExpandable ? "Tap a goal to see more of what it means." : undefined}
        >
          <TwoColumns
            partners={partners}
            noun="goals"
            a={data.goals.a}
            b={data.goals.b}
            render={(e) => {
              const g = e as GoalEntry;
              return {
                pills: (
                  <>
                    {g.detail?.season && <span style={styles.seasonPill}>{g.detail.season}</span>}
                    {g.both && <span style={styles.bothPill}>Both of you</span>}
                  </>
                ),
                detail: g.detail ? <GoalDetailBody d={g.detail} /> : null,
              };
            }}
          />
        </Section>
        </>
      )}

      {/* WHAT MATTERS — values, strengths, principles */}
      {active === "matters" && (
        <div>
          <TabSummary text={data.summaries?.matters ?? null} />
          {(data.values.a.length > 0 || data.values.b.length > 0) && (
            <Section
              heading="What you each value most"
              note="The values at the heart of each of your plans. Where you share one, it's marked."
              hint={valuesExpandable ? "Tap a value to read what it means to each of you." : undefined}
            >
              <TwoColumns
                partners={partners}
                noun="values"
                accent
                a={data.values.a}
                b={data.values.b}
                render={(e) => {
                  const v = e as ValueEntry;
                  return {
                    pills: (
                      <>
                        {v.nonNegotiable && <span style={styles.nnPill}>Won&rsquo;t compromise</span>}
                        {v.both && <span style={styles.bothPill}>Both of you</span>}
                      </>
                    ),
                    detail: v.description ? <p style={styles.exWhy}>{v.description}</p> : null,
                  };
                }}
              />
            </Section>
          )}
          {(data.strengths.a.length > 0 || data.strengths.b.length > 0) && (
            <Section
              heading="What you each bring"
              note="The strengths each of you leans on. Different strengths often cover for each other."
              hint={strengthsExpandable ? "Tap a strength to see how it shows up." : undefined}
            >
              <TwoColumns
                partners={partners}
                noun="strengths"
                accent
                a={data.strengths.a}
                b={data.strengths.b}
                render={(e) => {
                  const s = e as StrengthEntry;
                  return {
                    pills: s.both ? <span style={styles.bothPill}>Both of you</span> : null,
                    detail: s.note ? <p style={styles.exWhy}>{s.note}</p> : null,
                  };
                }}
              />
            </Section>
          )}
        </div>
      )}

      {/* HOPES & FEARS — a warmer, quote-led treatment */}
      {active === "feelings" && (
        <div>
          <TabSummary text={data.summaries?.feelings ?? null} />
          {data.hopes.length > 0 && (
            <Section heading="What you're each hoping for" note="The hopes you each chose to share.">
              {data.hopes.map((h, i) => (
                <QuoteCard key={i} partners={partners} slot={h.slot} text={h.text} />
              ))}
            </Section>
          )}
          {data.fears.length > 0 && (
            <Section heading="What you each fear" note="The fears you each chose to share. Anything either of you kept private doesn't appear here.">
              {data.fears.map((f, i) => (
                <QuoteCard key={i} partners={partners} slot={f.slot} text={f.text} />
              ))}
            </Section>
          )}
        </div>
      )}

      {/* TALK TOGETHER */}
      {active === "talk" && (
        <div style={styles.talk}>
          <h2 style={styles.talkH3}>Worth talking about together</h2>
          <p style={styles.talkIntro}>
            These aren&rsquo;t problems to solve or decisions to reach. Most of it
            won&rsquo;t line up neatly, and it doesn&rsquo;t need to — the point is to
            hear each other. Start wherever you like, and add your own.
          </p>

          {hasTalk ? (
            <>
              {data.talk.seeds.map((t, i) => (
                <div key={`s${i}`} style={styles.talkItem}>
                  <span style={styles.chk} aria-hidden="true" />
                  <span style={styles.talkText}>{t}</span>
                </div>
              ))}
              {userTopics.map((t) => (
                <div key={t.id} style={styles.talkItem}>
                  <span style={styles.chk} aria-hidden="true" />
                  <span style={styles.talkText}>{t.body}</span>
                </div>
              ))}
            </>
          ) : (
            <p style={styles.talkEmpty}>
              Nothing here stood out as needing its own conversation — it sounds
              like the two of you are very well aligned. If that doesn&rsquo;t seem
              right, it may be a glitch on our side:{" "}
              <button type="button" style={styles.linkBtn} onClick={() => setReportOpen(true)}>
                let us know
              </button>
              .
            </p>
          )}

          <div style={styles.addRow}>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTopic();
              }}
              placeholder="Add something you'd like to talk about…"
              aria-label="Add a topic to talk about"
              style={styles.addInput}
            />
            <button type="button" style={styles.addBtn} onClick={addTopic} disabled={adding}>
              Add
            </button>
          </div>
          <p style={styles.addHelp}>
            This just adds to the shared list above — a prompt for the two of you to
            talk through in person. It isn&rsquo;t a message to Vita or to your
            partner.
          </p>
        </div>
      )}

      {/* Foot-of-part navigation: parts 1…n-1 page INTO the next part (with a way
          back) so nobody leaves at the foot of part one; the last part closes the
          module — a plain end, a way back to the plans, and the whole-module
          feedback card. Mirrors the /plan foot-of-tab pager. */}
      {nextTab ? (
        <nav style={styles.pager} aria-label="Move through the shared view">
          <p style={styles.pagerCount}>
            Part {activeIndex + 1} of {tabs.length}
          </p>
          <div style={styles.pagerRow}>
            {prevTab ? (
              <button type="button" style={styles.pagerBack} onClick={() => goToTab(prevTab.id)}>
                ← Back: {prevTab.label}
              </button>
            ) : (
              <span aria-hidden="true" />
            )}
            <button type="button" style={styles.pagerNext} onClick={() => goToTab(nextTab.id)}>
              Next: {nextTab.label} →
            </button>
          </div>
        </nav>
      ) : (
        <div style={styles.endBlock}>
          <p style={styles.endEyebrow}>That&rsquo;s the whole picture</p>
          <h2 style={styles.endTitle}>
            You&rsquo;ve been through all {tabs.length} parts
          </h2>
          <p style={styles.endText}>
            There&rsquo;s nothing more to work through here — the shared view stays
            available whenever either of you wants to come back to it.
          </p>
          {/* Feedback sits ABOVE the nav buttons so people answer it before
              moving on, rather than after they've already left. */}
          {feedbackDone === false && (
            <div style={styles.feedbackFoot}>
              <ModuleFeedbackCard
                moduleId="5.1"
                onDone={markFeedbackDone}
                onSkip={markFeedbackDone}
              />
            </div>
          )}
          <div style={styles.endActions}>
            {prevTab && (
              <button type="button" style={styles.pagerBack} onClick={() => goToTab(prevTab.id)}>
                ← Back: {prevTab.label}
              </button>
            )}
            {!preview && (
              <a href="/home" style={styles.endHome}>
                Back to home →
              </a>
            )}
          </div>
        </div>
      )}

      <p style={styles.foot}>
        <b style={styles.footB}>Either of you can stop sharing at any time.</b> If
        either of you stops, this shared view closes for you both, and each plan
        goes back to being your own. Nothing here is added to either plan unless you
        choose to add it.{" "}
        <button
          type="button"
          style={styles.stopLink}
          onClick={() => {
            if (!preview) router.push("/partner?edit=1");
          }}
        >
          Change what you&rsquo;re sharing
        </button>
        {" · "}
        <button type="button" style={styles.stopLink} onClick={stopSharing}>
          Stop sharing
        </button>
      </p>

      <FeedbackPanel
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Something not right?"
        intro="Tell us what you expected to see — this helps us spot a glitch in the shared view."
        context="couples-talk-empty"
      />
    </main>
  );
}

// The short Vita synthesis that opens the goals / matters / feelings tabs, so
// each reads as an intentional part rather than a bare list. Renders nothing
// when the report carries no summary for this tab (e.g. one cached before these
// existed) — the tab then falls back to its list alone.
function TabSummary({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div style={styles.summaryCard}>
      <span style={styles.summaryTag}>
        <VitaMark size={18} />
        From Vita
      </span>
      <p style={styles.summaryText}>{text}</p>
    </div>
  );
}

function Dot({
  partners,
  slot,
  size = 26,
}: {
  partners: Payload["partners"];
  slot: Slot;
  size?: number;
}) {
  return (
    <span
      style={{
        ...styles.dot,
        width: size,
        height: size,
        fontSize: size < 20 ? 9 : 12,
        background: colourFor(slot),
      }}
    >
      {partners[slot].initial}
    </span>
  );
}

// A warmer, serif quote card with a coloured left bar — used for hopes, fears
// and principles so those read differently from the goal/value lists.
function QuoteCard({
  partners,
  slot,
  text,
}: {
  partners: Payload["partners"];
  slot: Slot;
  text: string;
}) {
  return (
    <div style={{ ...styles.quote, borderLeftColor: colourFor(slot) }}>
      <div style={styles.quoteWho}>
        <Dot partners={partners} slot={slot} size={18} />
        {partners[slot].name}
      </div>
      <p style={styles.quoteText}>{text}</p>
    </div>
  );
}

// A two-column dimension (goals / values / strengths), each item expandable.
function TwoColumns({
  partners,
  noun,
  a,
  b,
  render,
  accent = false,
}: {
  partners: Payload["partners"];
  noun: string;
  a: { label: string; both: boolean }[];
  b: { label: string; both: boolean }[];
  render: (e: { label: string; both: boolean }) => {
    pills: ReactNode;
    detail: ReactNode | null;
  };
  accent?: boolean;
}) {
  return (
    <div style={styles.cols}>
      {(["a", "b"] as Slot[]).map((slot) => {
        const list = slot === "a" ? a : b;
        return (
          <div
            key={slot}
            style={{
              ...styles.col,
              ...(accent ? { borderTop: `3px solid ${colourFor(slot)}` } : null),
            }}
          >
            <div style={styles.colHead}>
              <Dot partners={partners} slot={slot} size={20} />
              <b style={styles.colName}>
                {partners[slot].name}&rsquo;s {noun}
              </b>
            </div>
            {list.map((e, i) => {
              const { pills, detail } = render(e);
              return <ExpandRow key={i} label={e.label} pills={pills} detail={detail} />;
            })}
          </div>
        );
      })}
    </div>
  );
}

// A titled section with an optional subtitle, note and a "tap to expand" hint.
function Section({
  heading,
  subtitle,
  note,
  hint,
  children,
}: {
  heading: string;
  subtitle?: string;
  note?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section style={styles.bucket}>
      <div style={styles.bucketHead}>
        <h2 style={styles.bucketH2}>{heading}</h2>
        {subtitle && <span style={styles.bucketSub}>{subtitle}</span>}
      </div>
      {note && <p style={styles.note}>{note}</p>}
      {hint && <p style={styles.hint}>{hint}</p>}
      {children}
    </section>
  );
}

// A single expandable row (mirrors the RLP plan document's GoalCard).
function ExpandRow({
  label,
  pills,
  detail,
}: {
  label: string;
  pills?: ReactNode;
  detail?: ReactNode | null;
}) {
  const [open, setOpen] = useState(false);
  const expandable = Boolean(detail);
  return (
    <div style={{ ...styles.exRow, ...(open ? styles.exRowOpen : null) }}>
      <button
        type="button"
        style={{ ...styles.exTop, cursor: expandable ? "pointer" : "default" }}
        onClick={() => expandable && setOpen(!open)}
        aria-expanded={expandable ? open : undefined}
      >
        <span style={styles.exLabel}>{label}</span>
        <span style={styles.exMeta}>
          {pills}
          {expandable && (
            <span style={styles.exToggle} aria-hidden="true">
              {open ? "–" : "+"}
            </span>
          )}
        </span>
      </button>
      {open && detail && <div style={styles.exBody}>{detail}</div>}
    </div>
  );
}

function GoalDetailBody({ d }: { d: GoalDetail }) {
  return (
    <>
      {d.area && <div style={styles.exArea}>{d.area}</div>}
      {d.note && <p style={styles.exWhy}>{d.note}</p>}
      {d.looksLike && (
        <p style={styles.exP}>
          <span style={styles.exK}>What it looks like</span> {d.looksLike}
        </p>
      )}
      {d.cadence && (
        <p style={styles.exP}>
          <span style={styles.exK}>Roughly when</span> {d.cadence}
        </p>
      )}
      {d.ordinaryWeek && (
        <p style={styles.exP}>
          <span style={styles.exK}>In an ordinary week</span> {d.ordinaryWeek}
        </p>
      )}
    </>
  );
}

function Observation({
  o,
  kind,
  slotForName,
}: {
  o: Obs;
  kind: "comp" | "diff";
  slotForName: (name: string) => Slot | null;
}) {
  return (
    <div style={{ ...styles.item, ...(kind === "comp" ? styles.itemComp : styles.itemDiff) }}>
      <p style={styles.obs}>
        {kind === "diff" && o.clearest && (
          <b style={styles.clearest}>The clearest difference. </b>
        )}
        {o.text}
      </p>
      {o.sides && o.sides.length > 0 && (
        <div style={styles.split}>
          {o.sides.map((s, i) => {
            const slot = slotForName(s.name);
            return (
              <div key={i} style={styles.side}>
                <div style={styles.sideWho}>
                  <span
                    style={{
                      ...styles.sideMini,
                      background: slot ? colourFor(slot) : "var(--text-muted)",
                    }}
                  >
                    {s.name.trim().charAt(0).toUpperCase()}
                  </span>
                  {s.name}
                </div>
                <div style={styles.sideWhat}>{s.text}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 860,
    margin: "0 auto",
    padding: "40px 22px 80px",
    fontFamily: "var(--font-sans)",
    color: "var(--text)",
  },
  loadNote: { color: "var(--text-muted)", padding: "40px 0" },
  feedbackFoot: { marginTop: 32, paddingTop: 8 },
  tabsIntro: {
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    lineHeight: "var(--lh-body)",
    maxWidth: "64ch",
    margin: "0 0 14px",
  },
  summaryCard: {
    background: "var(--warm-surface)",
    border: "1px solid var(--warm-line)",
    borderRadius: "var(--r-md)",
    padding: "16px 18px",
    marginBottom: 22,
  },
  summaryTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: "var(--color-vita)",
    fontWeight: 600,
    fontSize: "var(--fs-label)",
    marginBottom: 8,
  },
  summaryText: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    lineHeight: 1.55,
    margin: 0,
    color: "var(--ink)",
  },
  addHelp: {
    fontSize: "var(--fs-label)",
    color: "var(--text-faint)",
    lineHeight: 1.5,
    margin: "8px 2px 0",
    maxWidth: "58ch",
  },
  pager: { marginTop: 34, paddingTop: 22, borderTop: "1px solid var(--border)" },
  pagerCount: {
    fontSize: "var(--fs-label)",
    color: "var(--text-muted)",
    fontWeight: 600,
    letterSpacing: "0.04em",
    margin: "0 0 12px",
  },
  pagerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  pagerBack: {
    border: "1px solid var(--border-strong)",
    background: "#fff",
    color: "var(--text)",
    borderRadius: "var(--r-pill)",
    padding: "10px 18px",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
  },
  pagerNext: {
    border: "1px solid var(--brand-primary)",
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    borderRadius: "var(--r-pill)",
    padding: "10px 20px",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
  },
  endBlock: { marginTop: 34, paddingTop: 26, borderTop: "1px solid var(--border)" },
  endEyebrow: {
    fontSize: "var(--fs-eyebrow)",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    fontWeight: 700,
    margin: "0 0 8px",
  },
  endTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-h2)",
    fontWeight: 600,
    margin: "0 0 8px",
    color: "var(--ink)",
  },
  endText: {
    fontSize: "var(--fs-body)",
    color: "var(--text-muted)",
    lineHeight: "var(--lh-body)",
    maxWidth: "60ch",
    margin: "0 0 16px",
  },
  endActions: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" },
  endHome: {
    display: "inline-block",
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    borderRadius: "var(--r-pill)",
    padding: "10px 20px",
    fontSize: "var(--fs-sm)",
    fontWeight: 700,
    textDecoration: "none",
  },
  eyebrow: {
    fontSize: "var(--fs-eyebrow)",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    fontWeight: 700,
    margin: "0 0 10px",
  },
  h1: {
    fontFamily: "var(--font-serif)",
    fontWeight: 600,
    fontSize: "var(--fs-display)",
    lineHeight: 1.15,
    letterSpacing: "-0.01em",
    margin: "0 0 10px",
    color: "var(--ink)",
  },
  lede: {
    color: "var(--text-muted)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    maxWidth: "60ch",
    margin: "0 0 22px",
  },
  people: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 },
  person: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-pill)",
    padding: "7px 14px 7px 8px",
  },
  dot: {
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    color: "#fff",
    fontWeight: 600,
    flex: "none",
  },
  personName: { fontWeight: 600, fontSize: "var(--fs-sm)", display: "block" },
  personMeta: {
    fontSize: "var(--fs-label)",
    color: "var(--text-muted)",
    display: "block",
    lineHeight: 1.2,
  },
  vitaCard: {
    background: "var(--warm-surface)",
    border: "1px solid var(--warm-line)",
    borderRadius: "var(--r-lg)",
    padding: "24px 26px",
    marginBottom: 22,
  },
  vitaTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: 9,
    color: "var(--color-vita)",
    fontWeight: 600,
    fontSize: "var(--fs-sm)",
    marginBottom: 12,
  },
  vitaCardText: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-reading)",
    lineHeight: 1.55,
    margin: 0,
    color: "var(--ink)",
  },
  // Tabs
  tabBar: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    borderBottom: "1px solid var(--border)",
    paddingBottom: 14,
    marginBottom: 26,
  },
  tab: {
    border: "1px solid var(--border-strong)",
    background: "#fff",
    color: "var(--text)",
    borderRadius: "var(--r-pill)",
    padding: "8px 16px",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
  },
  tabActive: {
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    borderColor: "var(--brand-primary)",
  },
  bucket: { marginBottom: 30 },
  bucketHead: {
    display: "flex",
    alignItems: "baseline",
    gap: 12,
    margin: "0 0 6px",
    flexWrap: "wrap",
  },
  bucketH2: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-h2)",
    fontWeight: 600,
    margin: 0,
    color: "var(--ink)",
  },
  bucketSub: { fontSize: "var(--fs-label)", color: "var(--text-muted)" },
  note: {
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    margin: "0 0 10px",
    maxWidth: "62ch",
    lineHeight: "var(--lh-body)",
  },
  hint: {
    fontSize: "var(--fs-sm)",
    fontStyle: "italic",
    color: "var(--text-faint)",
    margin: "0 0 14px",
  },
  item: {
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "16px 18px",
    marginBottom: 12,
    background: "var(--surface)",
    boxShadow: "var(--shadow-sm)",
  },
  itemShared: {
    background: "color-mix(in srgb, var(--chorus-yellow) 30%, #fff)",
    borderColor: "color-mix(in srgb, var(--chorus-yellow) 55%, #fff)",
  },
  itemComp: {
    background: "color-mix(in srgb, var(--partner-a) 7%, #fff)",
    borderColor: "color-mix(in srgb, var(--partner-a) 22%, #fff)",
  },
  itemDiff: { background: "var(--bg-alt)", borderColor: "var(--border-strong)" },
  obs: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    lineHeight: 1.5,
    margin: 0,
    color: "var(--text)",
  },
  clearest: { color: "var(--ink)", fontWeight: 600 },
  split: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 },
  side: {
    background: "rgba(255,255,255,0.6)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    padding: "11px 13px",
  },
  sideWho: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontSize: "var(--fs-label)",
    fontWeight: 600,
    marginBottom: 4,
    color: "var(--text)",
  },
  sideMini: {
    width: 16,
    height: 16,
    borderRadius: "50%",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    fontSize: 9,
    fontWeight: 600,
  },
  sideWhat: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-sm)",
    lineHeight: 1.45,
    color: "var(--text)",
  },
  // two-column dimensions
  cols: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 6 },
  col: {
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "14px 15px",
    background: "var(--surface)",
    boxShadow: "var(--shadow-sm)",
  },
  colHead: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 },
  colName: { fontSize: "var(--fs-sm)", color: "var(--ink)" },
  // expandable row
  exRow: {
    background: "var(--bg-alt)",
    border: "1px solid transparent",
    borderRadius: "var(--r-sm)",
    marginBottom: 6,
    overflow: "hidden",
  },
  exRowOpen: { background: "#fff", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" },
  exTop: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    background: "none",
    border: "none",
    textAlign: "left",
    padding: "9px 11px",
    fontFamily: "inherit",
  },
  exLabel: {
    flex: 1,
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-sm)",
    lineHeight: 1.4,
    color: "var(--text)",
  },
  exMeta: { display: "flex", alignItems: "center", gap: 8, flex: "none" },
  exToggle: { fontSize: 18, color: "var(--text-faint)", width: 14, textAlign: "center" },
  exBody: { padding: "0 12px 12px 12px", display: "flex", flexDirection: "column", gap: 6 },
  exArea: {
    fontSize: "var(--fs-eyebrow)",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    fontWeight: 700,
  },
  exWhy: {
    fontFamily: "var(--font-serif)",
    fontStyle: "italic",
    fontSize: "var(--fs-body)",
    color: "var(--text)",
    margin: 0,
    lineHeight: 1.5,
  },
  exP: { margin: 0, fontSize: "var(--fs-sm)", color: "var(--text)", lineHeight: 1.5 },
  exK: { fontWeight: 700, color: "var(--ink)", marginRight: 4 },
  bothPill: {
    fontFamily: "var(--font-sans)",
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.03em",
    color: "var(--reveal-strengths-fg)",
    background: "color-mix(in srgb, var(--reveal-strengths-fg) 14%, #fff)",
    borderRadius: "var(--r-pill)",
    padding: "2px 7px",
    whiteSpace: "nowrap",
  },
  nnPill: {
    fontFamily: "var(--font-sans)",
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.03em",
    color: "var(--info-text)",
    background: "var(--info-surface)",
    border: "1px solid var(--info-line)",
    borderRadius: "var(--r-pill)",
    padding: "2px 7px",
    whiteSpace: "nowrap",
  },
  seasonPill: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-eyebrow)",
    color: "var(--text-muted)",
    background: "var(--bg-alt)",
    borderRadius: "var(--r-pill)",
    padding: "2px 8px",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  // quote treatment (hopes / fears / principles)
  quote: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderLeft: "3px solid var(--partner-a)",
    borderRadius: "var(--r-md)",
    padding: "14px 18px",
    marginBottom: 10,
    boxShadow: "var(--shadow-sm)",
  },
  quoteWho: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: "var(--fs-label)",
    fontWeight: 600,
    color: "var(--text)",
    marginBottom: 6,
  },
  quoteText: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-reading)",
    lineHeight: 1.5,
    color: "var(--ink)",
    margin: 0,
  },
  talk: {
    background: "var(--warm-surface)",
    border: "1px solid var(--warm-line)",
    borderRadius: "var(--r-lg)",
    padding: "24px 26px",
    marginBottom: 26,
  },
  talkH3: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-h2)",
    margin: "0 0 10px",
    fontWeight: 600,
    color: "var(--ink)",
  },
  talkIntro: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-sm)",
    color: "var(--color-vita)",
    background: "color-mix(in srgb, var(--color-vita) 8%, #fff)",
    border: "1px solid color-mix(in srgb, var(--color-vita) 20%, #fff)",
    borderRadius: "var(--r-sm)",
    padding: "12px 14px",
    margin: "0 0 16px",
    lineHeight: 1.5,
  },
  talkItem: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    background: "#fff",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    padding: "12px 14px",
    marginBottom: 9,
  },
  chk: {
    width: 19,
    height: 19,
    border: "2px solid var(--color-vita)",
    borderRadius: 5,
    flex: "none",
    marginTop: 2,
  },
  talkText: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-sm)",
    lineHeight: 1.45,
    color: "var(--text)",
  },
  talkEmpty: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    color: "var(--text)",
    lineHeight: "var(--lh-body)",
    margin: "0 0 16px",
  },
  linkBtn: {
    border: "none",
    background: "none",
    padding: 0,
    color: "var(--color-vita)",
    textDecoration: "underline",
    cursor: "pointer",
    font: "inherit",
  },
  addRow: { display: "flex", gap: 10, marginTop: 4 },
  addInput: {
    flex: 1,
    border: "1px dashed var(--warm-line)",
    background: "#fff",
    borderRadius: "var(--r-sm)",
    padding: "12px 14px",
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-sm)",
    color: "var(--text)",
  },
  addBtn: {
    border: "none",
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    fontWeight: 600,
    fontSize: "var(--fs-sm)",
    borderRadius: "var(--r-sm)",
    padding: "0 18px",
    cursor: "pointer",
  },
  foot: {
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    lineHeight: "var(--lh-body)",
    borderTop: "1px solid var(--border)",
    paddingTop: 18,
    marginTop: 8,
  },
  footB: { color: "var(--ink)", fontWeight: 600 },
  stopLink: {
    border: "none",
    background: "none",
    padding: 0,
    color: "var(--color-vita)",
    textDecoration: "underline",
    cursor: "pointer",
    font: "inherit",
    marginLeft: 4,
  },
};
