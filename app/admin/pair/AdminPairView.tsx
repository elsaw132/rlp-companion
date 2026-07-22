"use client";

import { useState, type CSSProperties } from "react";
import AdminSignOut from "../AdminSignOut";

// The pairing admin surface. Everything it needs is passed in from the server
// page (already behind the admin gate); it only ever POSTs the two admin
// actions to /api/admin/pair-participants. Inline style objects keyed off the
// Chorus tokens, matching the feedback portal's approach.

export type PairingDisplay = {
  id: string;
  a: string;
  b: string;
  createdAt: string;
};

type Props = {
  adminEmail: string;
  pairings: PairingDisplay[];
};

type Notice = { kind: "ok" | "error"; text: string } | null;

export default function AdminPairView({ adminEmail, pairings }: Props) {
  const [emailA, setEmailA] = useState("");
  const [emailB, setEmailB] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<PairingDisplay[]>(pairings);

  async function pair() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/pair-participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pair", emailA, emailB }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        a?: string;
        b?: string;
        pairingId?: string;
      };
      if (!res.ok || !data.ok) {
        setNotice({ kind: "error", text: data.error ?? "Something went wrong." });
        return;
      }
      setNotice({ kind: "ok", text: `Paired ${data.a} with ${data.b}.` });
      setEmailA("");
      setEmailB("");
      if (data.pairingId) {
        setRows((prev) => [
          {
            id: data.pairingId as string,
            a: data.a ?? emailA,
            b: data.b ?? emailB,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    } catch {
      setNotice({ kind: "error", text: "Network error — try again." });
    } finally {
      setBusy(false);
    }
  }

  async function unpair(id: string) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/pair-participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unpair", pairingId: id }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (!res.ok || !data.ok) {
        setNotice({ kind: "error", text: "Couldn't unpair — try again." });
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      setNotice({ kind: "ok", text: "Unpaired. The shared view is now closed for both." });
    } catch {
      setNotice({ kind: "error", text: "Network error — try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.head}>
        <div>
          <p style={styles.eyebrow}>Admin · Plan with your partner</p>
          <h1 style={styles.h1}>Pair participants</h1>
        </div>
        <div style={styles.headRight}>
          <span style={styles.adminEmail}>{adminEmail}</span>
          <AdminSignOut />
        </div>
      </div>

      <p style={styles.lede}>
        Link two people who have each completed their own plan. Both must have
        signed up already. A person can be in only one active pairing.
      </p>

      <section style={styles.card}>
        <label style={styles.label} htmlFor="emailA">
          First partner&rsquo;s email
        </label>
        <input
          id="emailA"
          type="email"
          autoComplete="off"
          style={styles.input}
          value={emailA}
          onChange={(e) => setEmailA(e.target.value)}
          placeholder="name@example.com"
        />
        <label style={styles.label} htmlFor="emailB">
          Second partner&rsquo;s email
        </label>
        <input
          id="emailB"
          type="email"
          autoComplete="off"
          style={styles.input}
          value={emailB}
          onChange={(e) => setEmailB(e.target.value)}
          placeholder="name@example.com"
        />
        <button
          type="button"
          style={{ ...styles.primary, ...(busy ? styles.primaryBusy : null) }}
          onClick={pair}
          disabled={busy}
        >
          Pair them
        </button>

        {notice && (
          <p
            style={{
              ...styles.notice,
              ...(notice.kind === "ok" ? styles.noticeOk : styles.noticeErr),
            }}
          >
            {notice.text}
          </p>
        )}
      </section>

      <h2 style={styles.h2}>Active pairings</h2>
      {rows.length === 0 ? (
        <p style={styles.empty}>No active pairings yet.</p>
      ) : (
        <ul style={styles.list}>
          {rows.map((p) => (
            <li key={p.id} style={styles.row}>
              <span style={styles.pairText}>
                {p.a} <span style={styles.amp}>&amp;</span> {p.b}
              </span>
              <button
                type="button"
                style={styles.unpair}
                onClick={() => unpair(p.id)}
                disabled={busy}
              >
                Unpair
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 640,
    margin: "0 auto",
    padding: "40px 22px 80px",
    fontFamily: "var(--font-sans)",
    color: "var(--text)",
  },
  head: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 8,
  },
  headRight: { display: "flex", alignItems: "center", gap: 12 },
  adminEmail: { fontSize: "var(--fs-sm)", color: "var(--text-muted)" },
  eyebrow: {
    fontSize: "var(--fs-eyebrow)",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    fontWeight: 600,
    margin: "0 0 6px",
  },
  h1: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-display)",
    fontWeight: 600,
    margin: 0,
    color: "var(--ink)",
  },
  lede: {
    fontSize: "var(--fs-body)",
    color: "var(--text-muted)",
    lineHeight: "var(--lh-body)",
    margin: "10px 0 26px",
    maxWidth: "56ch",
  },
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-lg)",
    padding: "22px 24px",
    boxShadow: "var(--shadow-sm)",
    marginBottom: 34,
  },
  label: {
    display: "block",
    fontSize: "var(--fs-label)",
    fontWeight: 600,
    color: "var(--ink)",
    margin: "0 0 6px",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid var(--border-strong)",
    borderRadius: "var(--r-sm)",
    padding: "11px 13px",
    fontSize: "var(--fs-body)",
    fontFamily: "var(--font-sans)",
    color: "var(--text)",
    marginBottom: 16,
    background: "#fff",
  },
  primary: {
    border: "none",
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    fontWeight: 600,
    fontSize: "var(--fs-body)",
    borderRadius: "var(--r-sm)",
    padding: "12px 24px",
    cursor: "pointer",
  },
  primaryBusy: { opacity: 0.6, cursor: "default" },
  notice: {
    margin: "16px 0 0",
    fontSize: "var(--fs-sm)",
    lineHeight: "var(--lh-body)",
    padding: "10px 12px",
    borderRadius: "var(--r-sm)",
    border: "1px solid transparent",
  },
  noticeOk: {
    color: "var(--success-text)",
    background: "var(--success-surface)",
    borderColor: "var(--success-line)",
  },
  noticeErr: {
    color: "var(--accent-strong)",
    background: "var(--accent-surface)",
    borderColor: "var(--accent-line)",
  },
  h2: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-h2)",
    fontWeight: 600,
    color: "var(--ink)",
    margin: "0 0 12px",
  },
  empty: { fontSize: "var(--fs-body)", color: "var(--text-muted)" },
  list: { listStyle: "none", margin: 0, padding: 0 },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "13px 16px",
    marginBottom: 9,
  },
  pairText: { fontSize: "var(--fs-body)", color: "var(--text)" },
  amp: { color: "var(--text-faint)", margin: "0 4px" },
  unpair: {
    border: "1px solid var(--border-strong)",
    background: "#fff",
    color: "var(--text-muted)",
    fontWeight: 600,
    fontSize: "var(--fs-sm)",
    borderRadius: "var(--r-sm)",
    padding: "7px 14px",
    cursor: "pointer",
    flex: "none",
  },
};
