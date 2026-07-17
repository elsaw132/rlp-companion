"use client";

import { useMemo, useState } from "react";
import type {
  ModuleFeedbackRow,
  FeedbackRow,
  BaselineSurveyRow,
  ModuleProgressRow,
} from "@/lib/db";
import { RATING_MIN, RATING_MAX } from "@/lib/moduleFeedback";
import { toAnalysisRow, type BaselineAnalysisRow } from "@/lib/baselineAnalysis";
import { medianMs, fmtDuration } from "@/lib/durations";
import AdminSignOut from "../AdminSignOut";

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
  baseline: BaselineSurveyRow[];
  progress: ModuleProgressRow[];
  modules: ModuleMeta[];
};

// The rating scale, imported rather than restated: the card, the route and this
// portal must agree, and a portal reading 1–5 answers on a 0–10 scale would
// silently average every session down to "weak".
//
// The table previously held 0–10 ratings (and, earlier, three-point words). All
// of it was pre-pilot internal testing and was cleared on 2026-07-17 when the
// card moved to 1–5, precisely so the two scales could never be mixed: a stored
// "3" cannot mean both 3/10 and 3/5. Every row here is now 1–5. The legacy
// branches below survive only so any straggler row displays readably instead of
// being counted as a real score.
const SCALE_MIN = RATING_MIN;
const SCALE_MAX = RATING_MAX;

// A stored rating is the string of a 1–5 number. Anything else (an older 0–10
// value, an old three-point word) parses to null and is counted as "legacy"
// rather than skewing an average.
function parseScore(v: string | null): number | null {
  if (v === null) return null;
  if (!/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n >= SCALE_MIN && n <= SCALE_MAX ? n : null;
}

// Legacy word ratings we still want to show readably in the comments context.
const LEGACY_LABEL: Record<string, string> = {
  very: "Very",
  somewhat: "Somewhat",
  not_really: "Not really",
};

// How one stored rating reads in the comments view: "4 / 5" for a scale value,
// the old word for a legacy value, "—" when skipped.
function ratingDisplay(v: string | null): string {
  const n = parseScore(v);
  if (n !== null) return `${n} / ${SCALE_MAX}`;
  if (v && LEGACY_LABEL[v]) return LEGACY_LABEL[v];
  // A numeric value outside 1–5 can only be an old 0–10 row; say so rather than
  // showing a bare number that reads as if it were on the current scale.
  if (v && /^\d+$/.test(v)) return `${v} / 10 (old scale)`;
  return "—";
}

// A colour cue for an average, on the 1–5 scale: green when strong, orange in
// the middle, muted when weak — so weak sessions read at a glance, not just by
// their number.
function scoreColor(avg: number | null): string {
  if (avg === null) return "var(--text-faint)";
  if (avg >= 4) return "var(--success)";
  if (avg >= 3) return "var(--accent)";
  return "var(--text-muted)";
}

// One dimension's rollup for a module: the mean of the 1–5 answers, how many
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
  // How many people said something did NOT work correctly. Counted separately
  // from the ratings because it is not a matter of degree — one report of a
  // broken session is worth more than a dip in an average.
  broke: number;
  // Progress, which is independent of feedback: someone can finish a session and
  // skip the card, so these counts come from the progress table and will not
  // match the response count.
  started: number;
  finished: number;
  medianActiveMs: number | null;
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

// The mean of a list of 1–5 scores, to one decimal, or null when empty.
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

type Tab = "summary" | "baseline" | "comments" | "general";
type SortKey = "order" | "responses" | "useful" | "engaging";

export default function AdminFeedbackView({
  adminEmail,
  moduleFeedback,
  generalFeedback,
  baseline,
  progress,
  modules,
}: Props) {
  const [tab, setTab] = useState<Tab>("summary");

  // --- Baseline -------------------------------------------------------------
  // One row per participant, oldest first: the order people joined the pilot is
  // more useful to read down than newest-first.
  const baselineRows = useMemo<BaselineAnalysisRow[]>(
    () =>
      [...baseline]
        .map(toAnalysisRow)
        .sort((a, b) => a.takenAt.localeCompare(b.takenAt)),
    [baseline]
  );

  // The participant's demographics, keyed by user id, so a session rating can be
  // read alongside who gave it. This is the join that makes "how did people
  // winding down rate this session?" answerable at all.
  const baselineByUser = useMemo(() => {
    const m = new Map<string, BaselineAnalysisRow>();
    for (const r of baselineRows) m.set(r.userId, r);
    return m;
  }, [baselineRows]);

  // One person's progress on one session, for putting time-spent next to the
  // rating they gave it.
  const progressByUserModule = useMemo(() => {
    const m = new Map<string, ModuleProgressRow>();
    for (const p of progress) m.set(`${p.userId} ${p.moduleId}`, p);
    return m;
  }, [progress]);

  // --- Per-module summary ---------------------------------------------------
  const summary = useMemo<SummaryRow[]>(() => {
    const byModule = new Map<string, ModuleFeedbackRow[]>();
    for (const r of moduleFeedback) {
      const list = byModule.get(r.moduleId) ?? [];
      list.push(r);
      byModule.set(r.moduleId, list);
    }

    const progressByModule = new Map<string, ModuleProgressRow[]>();
    for (const p of progress) {
      const list = progressByModule.get(p.moduleId) ?? [];
      list.push(p);
      progressByModule.set(p.moduleId, list);
    }

    function dim(values: (string | null)[]): DimStat {
      const scores: number[] = [];
      let legacy = 0;
      for (const v of values) {
        const n = parseScore(v);
        if (n !== null) scores.push(n);
        else if (v !== null) legacy++; // a non-null value that isn't a 1–5 score
      }
      return { avg: mean(scores), answered: scores.length, legacy };
    }

    function build(id: string, meta: ModuleMeta | null): SummaryRow {
      const rows = byModule.get(id) ?? [];
      const prog = progressByModule.get(id) ?? [];
      const finished = prog.filter((p) => p.completedAt !== null);
      return {
        id,
        title: meta?.title ?? "(unknown module)",
        stageName: meta ? `Stage ${meta.stageNumber} · ${meta.stageName}` : "—",
        known: meta !== null,
        responses: rows.length,
        useful: dim(rows.map((r) => r.useful)),
        engaging: dim(rows.map((r) => r.engaging)),
        broke: rows.filter((r) => r.worked === "no").length,
        started: prog.length,
        finished: finished.length,
        // Timed from FINISHED sessions only. An abandoned session's clock says
        // how long someone lasted before giving up, which is a different
        // question — averaging the two would answer neither.
        medianActiveMs: medianMs(finished.map((p) => p.activeMs)),
      };
    }

    const inProgramme = modules.map((m) => build(m.id, m));
    const knownIds = new Set(modules.map((m) => m.id));
    const orphans = [...byModule.keys()]
      .filter((id) => !knownIds.has(id))
      .map((id) => build(id, null));
    return [...inProgramme, ...orphans];
  }, [moduleFeedback, modules, progress]);

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
  // Anything with words in it. A "what happened?" report counts even with no
  // comment attached — a broken session someone bothered to describe is the last
  // thing that should be invisible here.
  const comments = useMemo(
    () =>
      moduleFeedback.filter(
        (r) =>
          (r.comment && r.comment.trim().length > 0) ||
          (r.issue && r.issue.trim().length > 0)
      ),
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
    // Each rating carries the demographics of whoever gave it, so the pilot
    // questions ("do people winding down find this less useful?") are a pivot
    // table away rather than a manual join across two exports. Blank demographic
    // columns mean that participant has no baseline (they onboarded before it
    // existed, or skipped the question).
    //
    // The rating columns are named with their scale: a bare "4" in a spreadsheet
    // is unreadable a month later, and this table has held other scales before.
    const header = [
      "user_id",
      "module_id",
      "module_title",
      "useful_1_5",
      "engaging_1_5",
      "worked",
      "issue",
      "comment",
      "timestamp_utc",
      // Joined from this person's progress on this session.
      "active_seconds",
      "visits",
      "completed_at_utc",
      // Joined from the participant's baseline.
      "age",
      "age_band",
      "gender",
      "work_retirement_status",
      "partner",
      "retirement_horizon",
      "feelings_at_baseline",
      "prior_planning",
      "baseline_confidence_1_5",
    ];
    const rows = moduleFeedback.map((r) => {
      const b = baselineByUser.get(r.userId);
      const p = progressByUserModule.get(`${r.userId} ${r.moduleId}`);
      return [
        r.userId,
        r.moduleId,
        moduleTitle.get(r.moduleId) ?? "",
        r.useful ?? "",
        r.engaging ?? "",
        r.worked ?? "",
        r.issue ?? "",
        r.comment ?? "",
        r.createdAt,
        p ? String(Math.round(p.activeMs / 1000)) : "",
        p ? String(p.visits) : "",
        p?.completedAt ?? "",
        b?.age !== null && b?.age !== undefined ? String(b.age) : "",
        b?.ageBand ?? "",
        b?.gender ?? "",
        b?.stage ?? "",
        b?.partner ?? "",
        b?.horizon ?? "",
        b ? b.feelings.join("; ") : "",
        b?.priorPlanning ?? "",
        b?.confidence !== null && b?.confidence !== undefined
          ? String(b.confidence)
          : "",
      ];
    });
    downloadCsv("module-feedback.csv", [header, ...rows]);
  }

  // One row per participant: the baseline as taken, for the cohort description
  // ("who is in this pilot?").
  function exportBaselineCsv() {
    const header = [
      "user_id",
      "age",
      "age_band",
      "gender",
      "work_retirement_status",
      "partner",
      "retirement_horizon",
      "feelings",
      "prior_planning",
      "confidence_1_5",
      "expectations",
      "taken_at_utc",
    ];
    const rows = baselineRows.map((r) => [
      r.userId,
      r.age === null ? "" : String(r.age),
      r.ageBand,
      r.gender,
      r.stage,
      r.partner,
      r.horizon,
      r.feelings.join("; "),
      r.priorPlanning,
      r.confidence === null ? "" : String(r.confidence),
      r.expectations,
      r.takenAt,
    ]);
    downloadCsv("baseline-survey.csv", [header, ...rows]);
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
          <div style={S.headerRight}>
            <p style={S.signedIn}>Signed in as {adminEmail}</p>
            <AdminSignOut label="Sign out / switch account" />
          </div>
        </header>

        <div style={S.statStrip}>
          <Stat label="Participants (baseline)" value={baselineRows.length} />
          <Stat label="Module responses" value={totals.moduleResponses} />
          <Stat label="Testers (modules)" value={totals.moduleTesters} />
          <Stat label="Written comments" value={totals.commentCount} />
          <Stat label="General messages" value={totals.generalCount} />
        </div>

        <nav style={S.tabs}>
          <TabButton active={tab === "summary"} onClick={() => setTab("summary")}>
            Per-module summary
          </TabButton>
          <TabButton active={tab === "baseline"} onClick={() => setTab("baseline")}>
            Baseline ({baselineRows.length})
          </TabButton>
          <TabButton active={tab === "comments"} onClick={() => setTab("comments")}>
            Comments ({comments.length})
          </TabButton>
          <TabButton active={tab === "general"} onClick={() => setTab("general")}>
            General &amp; support ({generalFeedback.length})
          </TabButton>
        </nav>

        {tab === "baseline" && (
          <section>
            <div style={S.toolbar}>
              <p style={S.help}>
                One row per participant, in the order they joined —
                who is in this pilot, before they started. Age is their age{" "}
                <em>when they answered</em>, so it doesn&apos;t drift as the pilot
                runs. Blanks are skipped questions; every one is optional. To
                compare ratings <em>by</em> these characteristics, use the CSV on
                the <strong>Per-module summary</strong> tab — each rating there
                carries the demographics of whoever gave it.
              </p>
              <button style={S.csvBtn} onClick={exportBaselineCsv}>
                ↓ Download CSV
              </button>
            </div>
            {baselineRows.length === 0 ? (
              <Empty>
                No baseline responses yet. They&apos;re captured at the end of
                onboarding, so the first will land when someone new signs up.
              </Empty>
            ) : (
              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <Th>Participant</Th>
                      <Th align="right">Age</Th>
                      <Th>Gender</Th>
                      {/* Headers are nowrap, so a long one sets that column's
                          minimum width — kept short to keep all nine on screen. */}
                      <Th>Work status</Th>
                      <Th>Partner</Th>
                      <Th>Horizon</Th>
                      <Th>Feelings</Th>
                      <Th>Planning</Th>
                      <Th align="right">Confidence</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {baselineRows.map((r) => (
                      <tr key={r.userId} style={S.tr}>
                        <td style={S.tdModule}>
                          <span style={S.testerTag} title={r.userId}>
                            {shortUser(r.userId)}
                          </span>
                          <div style={S.moduleMeta}>{fmtDate(r.takenAt)}</div>
                        </td>
                        <td style={S.tdNum}>
                          {r.age === null ? (
                            <span style={S.muted}>—</span>
                          ) : (
                            r.age
                          )}
                        </td>
                        <Cell v={r.gender} />
                        <Cell v={r.stage} />
                        <Cell v={r.partner} />
                        <Cell v={r.horizon} />
                        <td style={S.tdWrap}>
                          {r.feelings.length === 0 ? (
                            <span style={S.muted}>—</span>
                          ) : (
                            <div style={S.chips}>
                              {r.feelings.map((f) => (
                                <span key={f} style={S.chip}>
                                  {f}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <Cell v={r.priorPlanning} />
                        <td style={S.tdNum}>
                          {r.confidence === null ? (
                            <span style={S.muted}>—</span>
                          ) : (
                            `${r.confidence} / ${RATING_MAX}`
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Expectations are prose, not a column — they'd be unreadable
                squeezed into the table, and they're the one baseline answer
                worth reading rather than counting. */}
            {baselineRows.some((r) => r.expectations) && (
              <section style={S.expectBlock}>
                <h2 style={S.expectHeading}>
                  What they expect from the programme
                </h2>
                <ul style={S.cardList}>
                  {baselineRows
                    .filter((r) => r.expectations)
                    .map((r) => (
                      <li key={r.userId} style={S.card}>
                        <div style={S.cardHead}>
                          <span style={S.testerTag} title={r.userId}>
                            {shortUser(r.userId)}
                          </span>
                          <span style={S.cardDate}>{fmtDate(r.takenAt)}</span>
                        </div>
                        <p style={S.cardBody}>{r.expectations}</p>
                      </li>
                    ))}
                </ul>
              </section>
            )}
          </section>
        )}

        {tab === "summary" && (
          <section>
            <div style={S.toolbar}>
              <p style={S.help}>
                One row per session, in programme order. <strong>Finished</strong>{" "}
                is how many people completed it out of how many opened it — the
                gap is drop-off. <strong>Typical time</strong> is the median time
                actually spent on screen by people who finished (not the elapsed
                wall-clock, which would count the days someone left it open).
                Scores average the 1–5 ratings, with the number who answered in
                brackets — people can finish without rating, so these won&apos;t
                match Finished. <strong>Problems</strong> counts the people who
                said something didn&apos;t work — read those in Comments. Click{" "}
                <strong>Useful</strong> or <strong>Engaging</strong> to sort — the
                weakest sessions come first.
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
                      <Th align="right">Finished</Th>
                      <Th align="right">Typical time</Th>
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
                      <Th align="right">Problems</Th>
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
                        {/* Finished, out of started: "3 / 5" says both that
                            people reach this session and whether they get
                            through it — a drop-off shows as the gap. */}
                        <td style={S.tdNum}>
                          {row.started === 0 ? (
                            <span style={S.muted}>—</span>
                          ) : (
                            <>
                              <strong>{row.finished}</strong>
                              <span style={S.avgOutOf}> / {row.started}</span>
                            </>
                          )}
                        </td>
                        <td style={S.tdNum}>
                          {row.medianActiveMs === null ? (
                            <span style={S.muted}>—</span>
                          ) : (
                            fmtDuration(row.medianActiveMs)
                          )}
                        </td>
                        <td style={S.tdNum}>{row.responses}</td>
                        <td style={S.tdDist}>
                          <AvgCell stat={row.useful} />
                        </td>
                        <td style={S.tdDist}>
                          <AvgCell stat={row.engaging} />
                        </td>
                        {/* A zero here is good news and shouldn't shout; any
                            count at all should be the thing you notice. */}
                        <td style={S.tdNum}>
                          {row.broke > 0 ? (
                            <span style={S.brokeCount}>{row.broke}</span>
                          ) : (
                            <span style={S.brokeZero}>
                              {row.responses > 0 ? "0" : "—"}
                            </span>
                          )}
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
                    {/* The problem report leads: if something broke, that is the
                        headline, and the comment is context beneath it. */}
                    {c.worked === "no" && (
                      <div style={S.problem}>
                        <span style={S.problemTag}>Didn&rsquo;t work</span>
                        {c.issue && <p style={S.problemBody}>{c.issue}</p>}
                      </div>
                    )}
                    {c.comment && <p style={S.cardBody}>{c.comment}</p>}
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

// A table header. onClick/active are optional: not every column sorts (Problems
// is a plain count), and a header with no sort must not look clickable.
function Th({
  children,
  onClick,
  active = false,
  dir = "",
  align = "left",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
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
        ...(onClick ? {} : { cursor: "default" }),
      }}
    >
      {children} {dir && <span style={S.sortArrow}>{dir}</span>}
    </th>
  );
}

// A plain text cell that shows an em-dash for a skipped answer, so a blank never
// reads as a rendering fault.
function Cell({ v }: { v: string }) {
  return (
    <td style={S.tdWrap}>{v ? v : <span style={S.muted}>—</span>}</td>
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
  headerRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 8,
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
    // Scroll, never clip. This was `overflow: hidden` (to round the corners),
    // which silently amputated any column past the container's width — the
    // baseline table's last column was unreachable, not merely off-screen.
    // overflow-x:auto still clips to the radius, so the corners stay rounded.
    overflowX: "auto",
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
  // Baseline table: cells wrap rather than truncate — a clipped "Winding down"
  // or a hidden feeling is worse than a taller row.
  tdWrap: {
    padding: "10px 12px",
    borderTop: "1px solid var(--border)",
    fontSize: "var(--fs-sm)",
    color: "var(--text)",
    verticalAlign: "top",
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
  },
  chip: {
    fontSize: "11px",
    color: "var(--text)",
    background: "var(--bg-alt)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-pill)",
    padding: "2px 8px",
    whiteSpace: "nowrap",
  },
  expectBlock: {
    marginTop: "28px",
  },
  expectHeading: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-section)",
    fontWeight: 700,
    color: "var(--ink)",
    margin: "0 0 12px",
  },
  // A reported breakage: flagged on the warning surface so it reads as a problem
  // to act on rather than another comment to browse.
  problem: {
    margin: "10px 0 0",
    padding: "10px 12px",
    background: "var(--accent-surface)",
    border: "1px solid var(--accent-line)",
    borderRadius: "var(--r-sm)",
  },
  problemTag: {
    display: "inline-block",
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--accent-strong)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  problemBody: {
    margin: "6px 0 0",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    whiteSpace: "pre-wrap",
    color: "var(--text)",
  },
  brokeCount: {
    fontWeight: 700,
    color: "var(--accent-strong)",
  },
  brokeZero: {
    color: "var(--text-faint)",
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
