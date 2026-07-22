"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { ShareItem, ShareGroup } from "@/lib/coupleShare";

// "Choose what to share" — private to each participant. Share-forward defaults;
// fears that are about the partner start off (and carry a small flag). Only what
// stays on is written to their share_selection, which is also their consent.
// Data comes from GET /api/partner/share (which classifies the fears); the
// primary action POSTs the selection with complete:true, then the page re-routes
// to the waiting or comparison surface.

type ShareData = {
  items: ShareItem[];
  sharedRefs: string[];
  aboutPartnerRefs: string[];
  completed: boolean;
  partnerFirstName: string;
};

const GROUP_META: Record<
  ShareGroup,
  { heading: string; vitaLine: (name: string) => string }
> = {
  plan: {
    heading: "Your plan",
    vitaLine: () =>
      "None of this is especially private, and it's the substance of a good conversation. I'd share all of it.",
  },
  hopes: {
    heading: "Your hopes",
    vitaLine: () =>
      "Hopes are some of the best things to share — I'd bring these in.",
  },
  fears: {
    heading: "Your fears",
    vitaLine: (name) =>
      `These are more personal. I've kept anything that's about ${name} switched off — that's yours to decide, not a default.`,
  },
};

const GROUP_ORDER: ShareGroup[] = ["plan", "hopes", "fears"];

export default function ShareStep() {
  const router = useRouter();
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState(false);
  const [on, setOn] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/partner/share")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: ShareData) => {
        if (!live) return;
        setData(d);
        setOn(new Set(d.sharedRefs));
      })
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, []);

  const name = data?.partnerFirstName ?? "your partner";

  const grouped = useMemo(() => {
    const out: Record<ShareGroup, ShareItem[]> = {
      plan: [],
      hopes: [],
      fears: [],
    };
    for (const it of data?.items ?? []) out[it.group].push(it);
    return out;
  }, [data]);

  function toggle(ref: string) {
    setOn((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  }

  async function share() {
    if (!data || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/partner/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sharedRefs: Array.from(on),
          aboutPartnerRefs: data.aboutPartnerRefs,
          complete: true,
        }),
      });
      if (!res.ok) throw new Error();
      // Drop any ?edit=1 and re-resolve: the page moves to the waiting or
      // comparison surface.
      router.replace("/partner");
      router.refresh();
    } catch {
      setSubmitting(false);
      setError(true);
    }
  }

  if (error) {
    return (
      <main style={styles.page}>
        <p style={styles.loadNote}>
          Something went wrong loading this. Please refresh to try again.
        </p>
      </main>
    );
  }
  if (!data) {
    return (
      <main style={styles.page}>
        <p style={styles.loadNote}>Preparing what you can share…</p>
      </main>
    );
  }

  const total = data.items.length;
  const sharingCount = data.items.filter((i) => on.has(i.ref)).length;

  return (
    <main style={styles.page}>
      <p style={styles.eyebrow}>
        <span aria-hidden="true">🔒</span> Private to you
      </p>
      <h1 style={styles.h1}>Choose what to share with {name}</h1>
      <p style={styles.lede}>
        Before your plans sit side by side, you decide what of yours {name} sees.
        I&rsquo;ve suggested a starting point — most things are switched on. Turn
        off anything you&rsquo;d rather keep to yourself.
      </p>

      <div style={styles.vitaCard}>
        <span style={styles.vitaTag}>
          <span style={styles.vitaAvatar}>V</span>From Vita
        </span>
        <p style={styles.vitaCardText}>
          Sharing openly makes for the better conversation, so I&rsquo;ve
          switched most things on. The one place I&rsquo;ve held back is your
          fears that are about {name} — those felt like your call to make, not
          mine.
        </p>
      </div>

      {GROUP_ORDER.map((g) => {
        const rows = grouped[g];
        if (rows.length === 0) return null;
        const onCount = rows.filter((r) => on.has(r.ref)).length;
        return (
          <section key={g} style={styles.group}>
            <div style={styles.groupHead}>
              <h2 style={styles.groupHeading}>{GROUP_META[g].heading}</h2>
              <span style={styles.groupCount}>
                {onCount} of {rows.length} on
              </span>
            </div>
            <p style={styles.vitaLine}>
              <span style={styles.vitaMini}>V</span>
              <span>{GROUP_META[g].vitaLine(name)}</span>
            </p>
            {rows.map((it) => {
              const isOn = on.has(it.ref);
              return (
                <div key={it.ref} style={styles.row}>
                  <span style={styles.rowText}>
                    {it.label}
                    {it.aboutPartner && (
                      <span style={styles.flag}>This one&rsquo;s about {name}</span>
                    )}
                  </span>
                  <span style={styles.state}>{isOn ? "On" : "Off"}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isOn}
                    aria-label={`Share: ${it.label}`}
                    onClick={() => toggle(it.ref)}
                    style={{
                      ...styles.switch,
                      ...(isOn ? styles.switchOn : null),
                    }}
                  >
                    <span
                      style={{
                        ...styles.knob,
                        ...(isOn ? styles.knobOn : null),
                      }}
                    />
                  </button>
                </div>
              );
            })}
          </section>
        );
      })}

      <div style={styles.footer}>
        <p style={styles.summary}>
          You&rsquo;re sharing <b style={styles.summaryB}>{sharingCount}</b> of{" "}
          {total} things.
        </p>
        <p style={styles.honesty}>
          Only what&rsquo;s switched on reaches the shared view. {name} won&rsquo;t
          see the rest — and won&rsquo;t see that anything&rsquo;s switched off.
          You can change this whenever you like, and either of you can stop
          sharing later.
        </p>
        <button
          type="button"
          onClick={share}
          disabled={submitting}
          style={{
            ...styles.primary,
            ...(submitting ? styles.primaryBusy : null),
          }}
        >
          Share with {name}
        </button>
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "40px 22px 60px",
    fontFamily: "var(--font-sans)",
    color: "var(--text)",
  },
  loadNote: { color: "var(--text-muted)", padding: "40px 0" },
  eyebrow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
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
    maxWidth: "58ch",
    margin: "0 0 24px",
  },
  vitaCard: {
    background: "var(--warm-surface)",
    border: "1px solid var(--warm-line)",
    borderRadius: "var(--r-lg)",
    padding: "20px 22px",
    marginBottom: 30,
  },
  vitaTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: "var(--color-vita)",
    fontWeight: 600,
    fontSize: "var(--fs-sm)",
    marginBottom: 9,
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
  group: { marginBottom: 26 },
  groupHead: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    margin: "0 0 4px",
  },
  groupHeading: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-title)",
    fontWeight: 600,
    margin: 0,
    color: "var(--ink)",
  },
  groupCount: { fontSize: "var(--fs-label)", color: "var(--text-muted)" },
  vitaLine: {
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
    fontSize: "var(--fs-sm)",
    color: "var(--color-vita)",
    margin: "0 0 14px",
    maxWidth: "58ch",
  },
  vitaMini: {
    flex: "none",
    width: 17,
    height: 17,
    borderRadius: "50%",
    background: "var(--color-vita)",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    fontSize: 9,
    fontFamily: "var(--font-serif)",
    marginTop: 2,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    padding: "13px 15px",
    marginBottom: 9,
  },
  rowText: {
    flex: 1,
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    lineHeight: 1.42,
    color: "var(--text)",
  },
  flag: {
    display: "inline-block",
    fontFamily: "var(--font-sans)",
    fontSize: 10.5,
    fontWeight: 600,
    letterSpacing: "0.03em",
    color: "var(--reveal-strengths-fg)",
    background: "color-mix(in srgb, var(--reveal-strengths-fg) 12%, #fff)",
    border: "1px solid color-mix(in srgb, var(--reveal-strengths-fg) 30%, #fff)",
    borderRadius: "var(--r-pill)",
    padding: "2px 8px",
    marginLeft: 8,
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },
  state: {
    fontSize: "var(--fs-label)",
    color: "var(--text-muted)",
    minWidth: 32,
    textAlign: "right",
  },
  switch: {
    flex: "none",
    width: 46,
    height: 27,
    borderRadius: "var(--r-pill)",
    background: "var(--border-strong)",
    position: "relative",
    cursor: "pointer",
    border: "none",
    padding: 0,
    transition: "background .18s",
  },
  switchOn: { background: "var(--brand-primary)" },
  knob: {
    position: "absolute",
    top: 3,
    left: 3,
    width: 21,
    height: 21,
    borderRadius: "50%",
    background: "#fff",
    boxShadow: "0 1px 2px rgba(0,0,0,.15)",
    transition: "transform .18s",
  },
  knobOn: { transform: "translateX(19px)" },
  footer: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-lg)",
    padding: "20px 22px",
    marginTop: 32,
  },
  summary: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    margin: "0 0 6px",
    color: "var(--ink)",
  },
  summaryB: { color: "var(--color-vita)" },
  honesty: {
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    lineHeight: "var(--lh-body)",
    margin: "0 0 18px",
  },
  primary: {
    border: "none",
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    fontWeight: 600,
    fontSize: "var(--fs-body)",
    borderRadius: "var(--r-sm)",
    padding: "13px 26px",
    cursor: "pointer",
  },
  primaryBusy: { opacity: 0.6, cursor: "default" },
};
