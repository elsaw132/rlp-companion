"use client";

import { useMemo, useState } from "react";
import type { ModuleFeedbackRow, FeedbackRow } from "@/lib/db";

// The read-only admin view over both feedback sources. All data is passed in
// from the server page (already behind the admin gate), so everything here —
// including the CSV export — works from what's in memory; the client never
// re-fetches member data. Three views: a per-module summary (the headline), the
// per-module open-text comments, and the general feedback / support messages.

type ModuleMeta = {
  id: string;
  title: string;
  stageNumber: number;
  stageName: string;
};

type Props = {
  adminEmail: string;
  moduleFeedback: ModuleFeedbackRow[];
  generalFeedback: FeedbackRow[];
  modules: ModuleMeta[];
};

const SCALE_MAX = 10;

// A stored rating is the string of a 0–10 number for current submissions. A few
// early rows used the old three words; those aren't on the 0–10 scale, so they
// parse to null here and are counted as "legacy" instead of skewing an average.
function parseScore(v: string | null): number | null {
  if (v === null) return null;
  if (!/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n >= 0 && n <= SCALE_MAX ? n : null;
}

// Legacy word ratings we still want to show readably in the comments context.
const LEGACY_LABEL: Record<string, string> = {
  very: "Very",
  somewhat: "Somewhat",
  not_really: "Not really",
};

// How one stored rating reads in the comments view: "8 / 10" for a scale value,
// the old word for a legacy value, "—" when skipped.
function ratingDisplay(v: string | null): string {
  const n = parseScore(v);
  if (n !== null) return `${n} / ${SCALE_MAX}`;
  if (v && LEGACY_LABEL[v]) return LEGACY_LABEL[v];
  return "—";
}

// A colour cue for an average: green when strong, orange in the middle, muted
// when weak — so weak modules read at a glance, not just by their number.
function scoreColor(avg: number | null): string {
  if (avg === null) return "var(--text-faint)";
  if (avg >= 7) return "var(--success)";
  if (avg >= 4) return "var(--accent)";
  return "var(--text-muted)";
}

// One dimension's rollup for a module: the mean of the 0–10 answers, how many
// gave one, and how many older word-ratings were set aside.
type DimStat = { avg: number | null; answered: number; legacy: number };

type SummaryRow = {
  id: string;
  title: string;
  stageName: string;
  known: boolean; // false for a module_id in the data but not in the programme
  responses: number; // total rows for this module
  useful: DimStat;
  engaging: DimStat;
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Deterministic UTC formatting, so the server-rendered markup and the client
// hydration match exactly (a locale/timezone formatter would differ between them
// and trip a hydration warning).
function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getUTCDate();
  const mon = MONTHS[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${mon} ${year}, ${hh}:${mm}`;
}

// A short, stable handle for a tester from their Clerk user id — enough to tell
// testers apart and filter by, without a friendly name (we don't store one).
function shortUser(userId: string): string {
  return userId.length > 8 ? `…${userId.slice(-6)}` : userId;
}

// The mean of a list of 0–10 scores, to one decimal, or null when empty.
function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  return Math.round((sum / nums.length) * 10) / 10;
}

function csvEscape(v: string | null): string {
  const s = v ?? "";
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, rows: string[][]) {
  const body = rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type Tab = "summary" | "comments" | "general";
type SortKey = "order" | "responses" | "useful" | "engaging";

export default function AdminFeedbackView({
  adminEmail,
  moduleFeedback,
  generalFeedback,
  modules,
}: Props) {
  const [tab, setTab] = useState<Tab>("summary");

  // --- Per-module summary ---------------------------------------------------
  const summary = useMemo<SummaryRow[]>(() => {
    const byModule = new Map<string, ModuleFeedbackRow[]>();
    for (const r of moduleFeedback) {
      const list = byModule.get(r.moduleId) ?? [];
      list.push(r);
      byModule.set(r.moduleId, list);
    }

    function dim(values: (string | null)[]): DimStat {
      const scores: number[] = [];
      let legacy = 0;
      for (const v of values) {
        const n = parseScore(v);
        if (n !== null) scores.push(n);
        else if (v !== null) legacy++; // a non-null value that isn't a 0–10 score
      }
      return { avg: mean(scores), answered: scores.length, legacy };
    }

    function build(id: string, meta: ModuleMeta | null): SummaryRow {
      const rows = byModule.get(id) ?? [];
      return {
        id,
        title: meta?.title ?? "(unknown module)",
        stageName: meta ? `Stage ${meta.stageNumber} · ${meta.stageName}` : "—",
        known: meta !== null,
        responses: rows.length,
        useful: dim(rows.map((r) => r.useful)),
        engaging: dim(rows.map((r) => r.engaging)),
      };
    }

    const inProgramme = modules.map((m) => build(m.id, m));
    const knownIds = new Set(modules.map((m) => m.id));
    const orphans = [...byModule.keys()]
      .filter((id) => !knownIds.has(id))
      .map((id) => build(id, null));
    return [...inProgramme, ...orphans];
  }, [moduleFeedback, modules]);

  const [sortKey, setSortKey] = useState<SortKey>("order");
  // For scores, ascending puts the weakest modules first (the useful default);
  // for responses, descending puts the most-answered first.
  const [asc, setAsc] = useState(true);

  const sortedSummary = useMemo(() => {
    if (sortKey === "order") return summary;
    const rows = [...summary];
    rows.sort((a, b) => {
      let av: number;
      let bv: number;
      if (sortKey === "responses") {
        av = a.responses;
        bv = b.responses;
      } else if (sortKey === "useful") {
        // Modules with no answers sort last regardless of direction.
        av = a.useful.avg ?? Infinity;
        bv = b.useful.avg ?? Infinity;
      } else {
        av = a.engaging.avg ?? Infinity;
        bv = b.engaging.avg ?? Infinity;
      }
      return asc ? av - bv : bv - av;
    });
    return rows;
  }, [summary, sortKey, asc]);

  function toggleSort(key: SortKey) {
    if (key === "order") {
      setSortKey("order");
      setAsc(true);
      return;
    }
    if (sortKey === key) {
      setAsc((v) => !v);
    } else {
      setSortKey(key);
      // Scores default to weakest-first (asc); responses to most-first (desc).
      setAsc(key !== "responses");
    }
  }

  // --- Comments -------------------------------------------------------------
  const comments = useMemo(
    () => moduleFeedback.filter((r) => r.comment && r.comment.trim().length > 0),
    [moduleFeedback]
  );
  const moduleTitle = useMemo(() => {
    const m = new Map<string, string>();
    for (const mod of modules) m.set(mod.id, mod.title);
    return m;
  }, [modules]);

  const [commentModule, setCommentModule] = useState<string>("all");
  const [commentUser, setCommentUser] = useState<string>("all");
  const commentModuleOptions = useMemo(() => {
    const ids = new Set(comments.map((c) => c.moduleId));
    // Keep programme order for the known ones, append any orphans.
    const ordered = modules.map((m) => m.id).filter((id) => ids.has(id));
    const orphans = [...ids].filter((id) => !ordered.includes(id));
    return [...ordered, ...orphans];
  }, [comments, modules]);
  const commentUserOptions = useMemo(
    () => [...new Set(comments.map((c) => c.userId))],
    [comments]
  );
  const filteredComments = useMemo(
    () =>
      comments.filter(
        (c) =>
          (commentModule === "all" || c.moduleId === commentModule) &&
          (commentUser === "all" || c.userId === commentUser)
      ),
    [comments, commentModule, commentUser]
  );

  // --- General feedback & support ------------------------------------------
  const [generalUser, setGeneralUser] = useState<string>("all");
  const [generalType, setGeneralType] = useState<string>("all");
  const generalUserOptions = useMemo(
    () => [...new Set(generalFeedback.map((g) => g.userId))],
    [generalFeedback]
  );
  const filteredGeneral = useMemo(
    () =>
      generalFeedback.filter(
        (g) =>
          (generalUser === "all" || g.userId === generalUser) &&
          (generalType === "all" || (g.type ?? "unknown") === generalType)
      ),
    [generalFeedback, generalUser, generalType]
  );

  // --- Totals (response rates) ---------------------------------------------
  const totals = useMemo(() => {
    const moduleTesters = new Set(moduleFeedback.map((r) => r.userId));
    const generalTesters = new Set(generalFeedback.map((g) => g.userId));
    return {
      moduleResponses: moduleFeedback.length,
      moduleTesters: moduleTesters.size,
      commentCount: comments.length,
      generalCount: generalFeedback.length,
      generalTesters: generalTesters.size,
    };
  }, [moduleFeedback, generalFeedback, comments]);

  // --- CSV exports ----------------------------------------------------------
  function exportModuleCsv() {
    const header = [
      "user_id",
      "module_id",
      "module_title",
      "useful",
      "engaging",
      "note",
      "timestamp_utc",
    ];
    const rows = moduleFeedback.map((r) => [
      r.userId,
      r.moduleId,
      moduleTitle.get(r.moduleId) ?? "",
      r.useful ?? "",
      r.engaging ?? "",
      r.comment ?? "",
      r.createdAt,
    ]);
    downloadCsv("module-feedback.csv", [header, ...rows]);
  }

  function exportGeneralCsv() {
    const header = [
      "user_id",
      "type",
      "message",
      "page",
      "reply_email",
      "timestamp_utc",
    ];
    const rows = generalFeedback.map((g) => [
      g.userId,
      g.type ?? "unknown",
      g.message,
      g.page ?? "",
      g.replyEmail ?? "",
      g.createdAt,
    ]);
    downloadCsv("general-feedback.csv", [header, ...rows]);
  }

  return (
    <div style={S.page}>
      <div style={S.inner}>
        <header style={S.header}>
          <div>
            <p style={S.eyebrow}>Admin · read-only</p>
            <h1 style={S.h1}>Pilot feedback</h1>
          </div>
          <p style={S.signedIn}>Signed in as {adminEmail}</p>
        </header>

        <div style={S.statStrip}>
          <Stat label="Module responses" value={totals.moduleResponses} />
          <Stat label="Testers (modules)" value={totals.moduleTesters} />
          <Stat label="Written comments" value={totals.commentCount} />
          <Stat label="General messages" value={totals.generalCount} />
        </div>

        <nav style={S.tabs}>
          <TabButton active={tab === "summary"} onClick={() => setTab("summary")}>
            Per-module summary
          </TabButton>
          <TabButton active={tab === "comments"} onClick={() => setTab("comments")}>
            Comments ({comments.length})
          </TabButton>
          <TabButton active={tab === "general"} onClick={() => setTab("general")}>
            General &amp; support ({generalFeedback.length})
          </TabButton>
        </nav>

        {tab === "summary" && (
          <section>
            <div style={S.toolbar}>
              <p style={S.help}>
                One row per module, in programme order. Scores are the average of
                the testers&apos; 0–10 ratings (with the number who answered in
                brackets). Click <strong>Useful</strong> or{" "}
                <strong>Engaging</strong> to sort — the weakest modules come first.
              </p>
              <button style={S.csvBtn} onClick={exportModuleCsv}>
                ↓ Download CSV
              </button>
            </div>
            {summary.length === 0 ? (
              <Empty>No per-module feedback yet.</Empty>
            ) : (
              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <Th onClick={() => toggleSort("order")} active={sortKey === "order"}>
                        Module
                      </Th>
                      <Th
                        onClick={() => toggleSort("responses")}
                        active={sortKey === "responses"}
                        dir={sortKey === "responses" ? (asc ? "▲" : "▼") : ""}
                        align="right"
                      >
                        Responses
                      </Th>
                      <Th
                        onClick={() => toggleSort("useful")}
                        active={sortKey === "useful"}
                        dir={sortKey === "useful" ? (asc ? "▲" : "▼") : ""}
                      >
                        Useful
                      </Th>
                      <Th
                        onClick={() => toggleSort("engaging")}
                        active={sortKey === "engaging"}
                        dir={sortKey === "engaging" ? (asc ? "▲" : "▼") : ""}
                      >
                        Engaging
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSummary.map((row) => (
                      <tr key={row.id} style={S.tr}>
                        <td style={S.tdModule}>
                          <div style={S.moduleTitle}>
                            {row.title}
                            {!row.known && (
                              <span style={S.orphanTag}>unknown id</span>
                            )}
                          </div>
                          <div style={S.moduleMeta}>
                            <code style={S.code}>{row.id}</code>
                            <span> · {row.stageName}</span>
                          </div>
                        </td>
                        <td style={S.tdNum}>{row.responses}</td>
                        <td style={S.tdDist}>
                          <AvgCell stat={row.useful} />
                        </td>
                        <td style={S.tdDist}>
                          <AvgCell stat={row.engaging} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === "comments" && (
          <section>
            <div style={S.toolbar}>
              <div style={S.filters}>
                <Filter label="Module">
                  <select
                    style={S.select}
                    value={commentModule}
                    onChange={(e) => setCommentModule(e.target.value)}
                  >
                    <option value="all">All modules</option>
                    {commentModuleOptions.map((id) => (
                      <option key={id} value={id}>
                        {id} — {moduleTitle.get(id) ?? "unknown"}
                      </option>
                    ))}
                  </select>
                </Filter>
                <Filter label="Tester">
                  <select
                    style={S.select}
                    value={commentUser}
                    onChange={(e) => setCommentUser(e.target.value)}
                  >
                    <option value="all">All testers</option>
                    {commentUserOptions.map((u) => (
                      <option key={u} value={u}>
                        {shortUser(u)}
                      </option>
                    ))}
                  </select>
                </Filter>
                <span style={S.count}>{filteredComments.length} shown</span>
              </div>
              <button style={S.csvBtn} onClick={exportModuleCsv}>
                ↓ Download CSV
              </button>
            </div>
            {filteredComments.length === 0 ? (
              <Empty>No comments match.</Empty>
            ) : (
              <ul style={S.cardList}>
                {filteredComments.map((c) => (
                  <li key={c.id} style={S.card}>
                    <div style={S.cardHead}>
                      <span style={S.cardModule}>
                        <code style={S.code}>{c.moduleId}</code>{" "}
                        {moduleTitle.get(c.moduleId) ?? ""}
                      </span>
                      <span style={S.cardDate}>{fmtDate(c.createdAt)}</span>
                    </div>
                    <p style={S.cardBody}>{c.comment}</p>
                    <div style={S.cardFoot}>
                      <RatingPill label="Useful" value={c.useful} />
                      <RatingPill label="Engaging" value={c.engaging} />
                      <span style={S.testerTag} title={c.userId}>
                        {shortUser(c.userId)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === "general" && (
          <section>
            <div style={S.toolbar}>
              <div style={S.filters}>
                <Filter label="Type">
                  <select
                    style={S.select}
                    value={generalType}
                    onChange={(e) => setGeneralType(e.target.value)}
                  >
                    <option value="all">All types</option>
                    <option value="feedback">Feedback</option>
                    <option value="support">Support</option>
                    <option value="unknown">Unknown (older)</option>
                  </select>
                </Filter>
                <Filter label="Tester">
                  <select
                    style={S.select}
                    value={generalUser}
                    onChange={(e) => setGeneralUser(e.target.value)}
                  >
                    <option value="all">All testers</option>
                    {generalUserOptions.map((u) => (
                      <option key={u} value={u}>
                        {shortUser(u)}
                      </option>
                    ))}
                  </select>
                </Filter>
                <span style={S.count}>{filteredGeneral.length} shown</span>
              </div>
              <button style={S.csvBtn} onClick={exportGeneralCsv}>
                ↓ Download CSV
              </button>
            </div>
            {filteredGeneral.length === 0 ? (
              <Empty>No general feedback or support messages yet.</Empty>
            ) : (
              <ul style={S.cardList}>
                {filteredGeneral.map((g) => (
                  <li key={g.id} style={S.card}>
                    <div style={S.cardHead}>
                      <span style={S.cardModule}>
                        <TypeBadge type={g.type} />
                        {g.page ? (
                          <>
                            {" "}
                            on <code style={S.code}>{g.page}</code>
                          </>
                        ) : (
                          <span style={S.muted}> page not recorded</span>
                        )}
                      </span>
                      <span style={S.cardDate}>{fmtDate(g.createdAt)}</span>
                    </div>
                    <p style={S.cardBody}>{g.message}</p>
                    <div style={S.cardFoot}>
                      {g.replyEmail ? (
                        <span style={S.replyTag}>
                          wants a reply:{" "}
                          <a href={`mailto:${g.replyEmail}`} style={S.link}>
                            {g.replyEmail}
                          </a>
                        </span>
                      ) : (
                        <span style={S.muted}>no reply requested</span>
                      )}
                      <span style={S.testerTag} title={g.userId}>
                        {shortUser(g.userId)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

// --- Small presentational pieces -------------------------------------------

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={S.stat}>
      <div style={S.statValue}>{value}</div>
      <div style={S.statLabel}>{label}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{ ...S.tab, ...(active ? S.tabActive : null) }}
    >
      {children}
    </button>
  );
}

function Th({
  children,
  onClick,
  active,
  dir = "",
  align = "left",
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  dir?: string;
  align?: "left" | "right";
}) {
  return (
    <th
      onClick={onClick}
      style={{
        ...S.th,
        textAlign: align,
        color: active ? "var(--text)" : "var(--text-muted)",
      }}
    >
      {children} {dir && <span style={S.sortArrow}>{dir}</span>}
    </th>
  );
}

function AvgCell({ stat }: { stat: DimStat }) {
  if (stat.avg === null) {
    return (
      <div>
        <span style={S.muted}>—</span>
        {stat.legacy > 0 && (
          <div style={S.legacyNote}>{stat.legacy} legacy rating(s)</div>
        )}
      </div>
    );
  }
  const color = scoreColor(stat.avg);
  return (
    <div>
      <div style={S.avgRow}>
        <span style={{ ...S.avgNum, color }}>{stat.avg.toFixed(1)}</span>
        <span style={S.avgOutOf}>/ {SCALE_MAX}</span>
        <span style={S.avgCount}>
          ({stat.answered} answered)
        </span>
      </div>
      <div
        style={S.bar}
        title={`Average ${stat.avg} out of ${SCALE_MAX} from ${stat.answered} rating(s)`}
      >
        <div
          style={{
            width: `${(stat.avg / SCALE_MAX) * 100}%`,
            background: color,
            height: "100%",
          }}
        />
      </div>
      {stat.legacy > 0 && (
        <div style={S.legacyNote}>
          + {stat.legacy} legacy rating(s), not in average
        </div>
      )}
    </div>
  );
}

function RatingPill({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  const n = parseScore(value);
  const color = scoreColor(n);
  return (
    <span style={S.ratingPill}>
      <span style={{ ...S.dot, background: color }} />
      {label}: <strong>{ratingDisplay(value)}</strong>
    </span>
  );
}

function TypeBadge({ type }: { type: "feedback" | "support" | null }) {
  const label =
    type === "support" ? "Support" : type === "feedback" ? "Feedback" : "Unknown";
  const style =
    type === "support"
      ? S.badgeSupport
      : type === "feedback"
        ? S.badgeFeedback
        : S.badgeUnknown;
  return <span style={{ ...S.badge, ...style }}>{label}</span>;
}

function Filter({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={S.filterLabel}>
      <span style={S.filterText}>{label}</span>
      {children}
    </label>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={S.empty}>{children}</div>;
}

// --- Styles (semantic tokens only, no hardcoded brand colours) --------------

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100%",
    background: "var(--bg)",
    color: "var(--text)",
    fontFamily: "var(--font-sans)",
    padding: "32px 20px 80px",
  },
  inner: { maxWidth: 1000, margin: "0 auto" },
  header: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: "var(--fs-eyebrow)",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    margin: 0,
  },
  h1: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-title)",
    margin: "4px 0 0",
  },
  signedIn: { fontSize: "var(--fs-sm)", color: "var(--text-muted)", margin: 0 },
  statStrip: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 24,
  },
  stat: {
    flex: "1 1 160px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "14px 16px",
  },
  statValue: {
    fontFamily: "var(--font-serif)",
    fontSize: "28px",
    lineHeight: 1,
  },
  statLabel: {
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    marginTop: 6,
  },
  tabs: {
    display: "flex",
    gap: 4,
    borderBottom: "1px solid var(--border)",
    marginBottom: 20,
    flexWrap: "wrap",
  },
  tab: {
    appearance: "none",
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    padding: "10px 14px",
    fontSize: "var(--fs-body)",
    color: "var(--text-muted)",
    cursor: "pointer",
    marginBottom: -1,
  },
  tabActive: {
    color: "var(--text)",
    borderBottomColor: "var(--brand-primary)",
    fontWeight: 600,
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  help: {
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    margin: 0,
    maxWidth: 640,
    lineHeight: 1.5,
  },
  filters: { display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" },
  filterLabel: { display: "flex", flexDirection: "column", gap: 4 },
  filterText: {
    fontSize: "var(--fs-eyebrow)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "var(--text-muted)",
  },
  select: {
    appearance: "auto",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    padding: "7px 10px",
    fontSize: "var(--fs-body)",
    color: "var(--text)",
    minWidth: 180,
  },
  count: { fontSize: "var(--fs-sm)", color: "var(--text-muted)" },
  csvBtn: {
    appearance: "none",
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    border: "none",
    borderRadius: "var(--r-pill)",
    padding: "9px 16px",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  tableWrap: {
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    overflow: "hidden",
    background: "var(--surface)",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-sm)" },
  th: {
    padding: "12px 14px",
    fontSize: "var(--fs-eyebrow)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    borderBottom: "1px solid var(--border)",
    cursor: "pointer",
    userSelect: "none",
    background: "var(--bg-alt)",
    whiteSpace: "nowrap",
  },
  sortArrow: { fontSize: "10px" },
  tr: { borderBottom: "1px solid var(--border)" },
  tdModule: { padding: "12px 14px", verticalAlign: "top", minWidth: 200 },
  moduleTitle: {
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  moduleMeta: { fontSize: "var(--fs-eyebrow)", color: "var(--text-muted)", marginTop: 3 },
  orphanTag: {
    fontSize: "10px",
    color: "var(--accent-strong)",
    border: "1px solid var(--accent-line)",
    borderRadius: "var(--r-pill)",
    padding: "1px 6px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  tdNum: {
    padding: "12px 14px",
    verticalAlign: "top",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 600,
  },
  tdDist: { padding: "12px 14px", verticalAlign: "top", minWidth: 180 },
  bar: {
    display: "flex",
    width: "100%",
    height: 8,
    borderRadius: "var(--r-pill)",
    overflow: "hidden",
    background: "var(--muted-surface)",
    marginTop: 6,
  },
  avgRow: { display: "flex", alignItems: "baseline", gap: 5 },
  avgNum: {
    fontFamily: "var(--font-serif)",
    fontSize: "22px",
    fontWeight: 600,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },
  avgOutOf: { fontSize: "var(--fs-sm)", color: "var(--text-muted)" },
  avgCount: { fontSize: "var(--fs-eyebrow)", color: "var(--text-muted)", marginLeft: 2 },
  legacyNote: {
    fontSize: "var(--fs-eyebrow)",
    color: "var(--text-faint)",
    marginTop: 5,
  },
  code: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "0.9em",
    background: "var(--muted-surface)",
    padding: "1px 5px",
    borderRadius: "var(--r-xs)",
  },
  cardList: { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 },
  card: {
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "14px 16px",
    background: "var(--surface)",
  },
  cardHead: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "baseline",
    flexWrap: "wrap",
  },
  cardModule: { fontSize: "var(--fs-sm)", color: "var(--text-muted)" },
  cardDate: { fontSize: "var(--fs-sm)", color: "var(--text-muted)", whiteSpace: "nowrap" },
  cardBody: {
    margin: "10px 0",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    whiteSpace: "pre-wrap",
  },
  cardFoot: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
  },
  badge: {
    display: "inline-block",
    fontSize: "var(--fs-eyebrow)",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    padding: "2px 8px",
    borderRadius: "var(--r-pill)",
    border: "1px solid transparent",
    verticalAlign: "baseline",
  },
  badgeSupport: {
    color: "var(--brand-primary)",
    background: "var(--brand-primary-tint)",
    borderColor: "var(--brand-primary)",
  },
  badgeFeedback: {
    color: "var(--info-text)",
    background: "var(--info-surface)",
    borderColor: "var(--info-line)",
  },
  badgeUnknown: {
    color: "var(--text-muted)",
    background: "var(--muted-surface)",
    borderColor: "var(--border)",
  },
  ratingPill: { display: "inline-flex", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: "50%", display: "inline-block" },
  testerTag: {
    marginLeft: "auto",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "var(--fs-eyebrow)",
    color: "var(--text-muted)",
  },
  replyTag: { color: "var(--text)" },
  link: { color: "var(--brand-primary)" },
  muted: { color: "var(--text-faint)" },
  empty: {
    padding: "40px 20px",
    textAlign: "center",
    color: "var(--text-muted)",
    border: "1px dashed var(--border)",
    borderRadius: "var(--r-md)",
  },
};
