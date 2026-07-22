"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import FeedbackPanel from "@/app/components/FeedbackPanel";

// The comparison view: two plans side by side. Deterministic content (partner
// labels, goals/hopes/fears) is rendered straight from the payload; the framing,
// the shared/complementary/different observations, and the seed talk topics are
// Vita-generated. It reads identically whichever partner opens it. No completion
// state — it's persistent and revisitable.

type Obs = { text: string; sides?: { name: string; text: string }[]; clearest?: boolean };
type Slot = "a" | "b";
type PM = { name: string; cohort: string; planName: string; initial: string };
type GoalEntry = { label: string; both: boolean };

type Payload = {
  partners: { a: PM; b: PM };
  framing: { opener: string; close: string };
  sharedGround: string[];
  complementary: Obs[];
  different: Obs[];
  goals: { a: GoalEntry[]; b: GoalEntry[] };
  hopes: { slot: Slot; text: string }[];
  fears: { slot: Slot; text: string }[];
  talk: { seeds: string[]; user: { id: string; slot: Slot; body: string }[] };
};

const colourFor = (slot: Slot) =>
  slot === "a" ? "var(--partner-a)" : "var(--partner-b)";

export default function ComparisonView() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState(false);
  const [userTopics, setUserTopics] = useState<Payload["talk"]["user"]>([]);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
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
  }, []);

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

  const Dot = ({ slot, size = 26 }: { slot: Slot; size?: number }) => (
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
            <Dot slot={slot} />
            <span>
              <b style={styles.personName}>{partners[slot].name}</b>
              <span style={styles.personMeta}>
                {partners[slot].cohort} · {partners[slot].planName}
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* Vita framing */}
      <div style={styles.vitaCard}>
        <span style={styles.vitaTag}>
          <span style={styles.vitaAvatar}>V</span>From Vita
        </span>
        <p style={styles.vitaCardText}>
          {data.framing.opener} {data.framing.close}
        </p>
      </div>

      {/* Shared ground */}
      {data.sharedGround.length > 0 && (
        <section style={styles.bucket}>
          <div style={styles.bucketHead}>
            <h2 style={styles.bucketH2}>Shared ground</h2>
            <span style={styles.bucketSub}>where your plans landed together</span>
          </div>
          <p style={styles.note}>
            A good place to start — the things you both put near the top.
          </p>
          {data.sharedGround.map((t, i) => (
            <div key={i} style={{ ...styles.item, ...styles.itemShared }}>
              <p style={styles.obs}>{t}</p>
            </div>
          ))}
        </section>
      )}

      {/* Complementary */}
      {data.complementary.length > 0 && (
        <section style={styles.bucket}>
          <div style={styles.bucketHead}>
            <h2 style={styles.bucketH2}>Where you complement each other</h2>
          </div>
          <p style={styles.note}>
            Different choices that seem to fit together rather than pull apart.
          </p>
          {data.complementary.map((o, i) => (
            <Observation key={i} o={o} kind="comp" slotForName={slotForName} />
          ))}
        </section>
      )}

      {/* Different */}
      {data.different.length > 0 && (
        <section style={styles.bucket}>
          <div style={styles.bucketHead}>
            <h2 style={styles.bucketH2}>Where your plans differ</h2>
          </div>
          <p style={styles.note}>
            Not problems — just places your two pictures don&rsquo;t line up. These
            are often the most useful things to talk about, and the conversation is
            usually less about the what than the why beneath it.
          </p>
          {data.different.map((o, i) => (
            <Observation key={i} o={o} kind="diff" slotForName={slotForName} />
          ))}
        </section>
      )}

      {/* Goals — full picture */}
      {(data.goals.a.length > 0 || data.goals.b.length > 0) && (
        <section style={styles.bucket}>
          <div style={styles.bucketHead}>
            <h2 style={styles.bucketH2}>Goals — the full picture</h2>
          </div>
          <p style={styles.note}>
            You&rsquo;ve each taken time to work out the goals you want to pursue in
            retirement. The ones that stood out are above; here&rsquo;s the full
            picture — every goal each of you named, including those that are simply
            your own.
          </p>
          <div style={styles.goalsWrap}>
            {(["a", "b"] as Slot[]).map((slot) => (
              <div key={slot} style={styles.goalsCol}>
                <div style={styles.goalsColHead}>
                  <Dot slot={slot} size={20} />
                  <b style={styles.goalsColName}>{partners[slot].name}&rsquo;s goals</b>
                </div>
                {data.goals[slot].map((g, i) => (
                  <div
                    key={i}
                    style={{ ...styles.goal, ...(g.both ? styles.goalShared : null) }}
                  >
                    <span>{g.label}</span>
                    {g.both && <span style={styles.bothPill}>Both of you</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Hopes */}
      {data.hopes.length > 0 && (
        <div style={styles.strip}>
          <h3 style={styles.stripH3}>What you&rsquo;re each hoping for</h3>
          <p style={styles.stripSub}>The hopes you each chose to share.</p>
          <div style={styles.lines}>
            {data.hopes.map((h, i) => (
              <div key={i} style={styles.line}>
                <Dot slot={h.slot} size={18} />
                <span style={styles.lineText}>{h.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fears */}
      {data.fears.length > 0 && (
        <div style={styles.strip}>
          <h3 style={styles.stripH3}>What you each fear</h3>
          <p style={styles.stripSub}>The fears you each chose to share.</p>
          <div style={styles.lines}>
            {data.fears.map((f, i) => (
              <div key={i} style={styles.line}>
                <Dot slot={f.slot} size={18} />
                <span style={styles.lineText}>{f.text}</span>
              </div>
            ))}
          </div>
          <p style={styles.fearNote}>
            Anything either of you kept private doesn&rsquo;t appear here.
          </p>
        </div>
      )}

      {/* Worth talking about */}
      <div style={styles.talk}>
        <h3 style={styles.talkH3}>Worth talking about together</h3>
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
            Nothing here stood out as needing its own conversation — it sounds like
            the two of you are very well aligned. If that doesn&rsquo;t seem right,
            it may be a glitch on our side:{" "}
            <button
              type="button"
              style={styles.linkBtn}
              onClick={() => setReportOpen(true)}
            >
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
          <button
            type="button"
            style={styles.addBtn}
            onClick={addTopic}
            disabled={adding}
          >
            Add
          </button>
        </div>
      </div>

      <p style={styles.foot}>
        <b style={styles.footB}>Either of you can stop sharing at any time.</b> If
        either of you stops, this shared view closes for you both, and each plan
        goes back to being your own. Nothing here is added to either plan unless you
        choose to add it.{" "}
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
    <div
      style={{
        ...styles.item,
        ...(kind === "comp" ? styles.itemComp : styles.itemDiff),
      }}
    >
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
  eyebrow: {
    fontSize: "var(--fs-eyebrow)",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    fontWeight: 600,
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
  people: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 26 },
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
    borderRadius: "var(--r-md)",
    padding: "22px 24px",
    marginBottom: 34,
  },
  vitaTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: "var(--color-vita)",
    fontWeight: 600,
    fontSize: "var(--fs-sm)",
    marginBottom: 10,
  },
  vitaAvatar: {
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: "var(--color-vita)",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    fontSize: 11,
    fontFamily: "var(--font-serif)",
  },
  vitaCardText: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-reading)",
    lineHeight: 1.55,
    margin: 0,
    color: "var(--ink)",
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
    margin: "0 0 14px",
    maxWidth: "62ch",
    lineHeight: "var(--lh-body)",
  },
  item: {
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "16px 18px",
    marginBottom: 12,
    background: "var(--surface)",
  },
  itemShared: {
    background: "color-mix(in srgb, var(--chorus-yellow) 30%, #fff)",
    borderColor: "color-mix(in srgb, var(--chorus-yellow) 55%, #fff)",
  },
  itemComp: {
    background: "color-mix(in srgb, var(--partner-a) 7%, #fff)",
    borderColor: "color-mix(in srgb, var(--partner-a) 22%, #fff)",
  },
  itemDiff: {
    background: "var(--bg-alt)",
    borderColor: "var(--border-strong)",
  },
  obs: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    lineHeight: 1.5,
    margin: 0,
    color: "var(--text)",
  },
  clearest: { color: "var(--ink)", fontWeight: 600 },
  split: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
    marginTop: 12,
  },
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
  goalsWrap: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
    marginTop: 6,
  },
  goalsCol: {
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "14px 15px",
    background: "var(--surface)",
  },
  goalsColHead: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  goalsColName: { fontSize: "var(--fs-sm)", color: "var(--ink)" },
  goal: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-sm)",
    lineHeight: 1.4,
    padding: "8px 10px",
    borderRadius: "var(--r-sm)",
    marginBottom: 6,
    background: "var(--bg-alt)",
    border: "1px solid transparent",
    color: "var(--text)",
  },
  goalShared: {
    background: "color-mix(in srgb, var(--chorus-yellow) 30%, #fff)",
    borderColor: "color-mix(in srgb, var(--chorus-yellow) 55%, #fff)",
  },
  bothPill: {
    fontFamily: "var(--font-sans)",
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.03em",
    color: "var(--reveal-strengths-fg)",
    background: "color-mix(in srgb, var(--reveal-strengths-fg) 14%, #fff)",
    borderRadius: "var(--r-pill)",
    padding: "2px 7px",
    marginLeft: "auto",
    whiteSpace: "nowrap",
  },
  strip: {
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "18px 20px",
    marginBottom: 14,
    background: "var(--surface)",
  },
  stripH3: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-title)",
    margin: "0 0 4px",
    fontWeight: 600,
    color: "var(--ink)",
  },
  stripSub: { fontSize: "var(--fs-sm)", color: "var(--text-muted)", margin: "0 0 14px" },
  lines: { display: "flex", flexDirection: "column", gap: 10 },
  line: { display: "flex", gap: 11, alignItems: "flex-start" },
  lineText: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    lineHeight: 1.45,
    color: "var(--text)",
  },
  fearNote: {
    fontSize: "var(--fs-label)",
    color: "var(--text-muted)",
    marginTop: 14,
    paddingTop: 12,
    borderTop: "1px dashed var(--border)",
  },
  talk: {
    background: "var(--warm-surface)",
    border: "1px solid var(--warm-line)",
    borderRadius: "var(--r-md)",
    padding: "22px 24px",
    margin: "20px 0 26px",
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
