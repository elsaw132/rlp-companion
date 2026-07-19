"use client";

import { useCallback, useMemo, useState } from "react";
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

type Tab = "participants" | "summary" | "baseline" | "comments" | "general";
type SortKey = "order" | "responses" | "useful" | "engaging";

// One stage's modules, in programme order — used to draw a participant's
// progress as a strip of dots grouped by stage.
type StageGroup = {
  number: number;
  name: string;
  moduleIds: string[];
};

// Everything about where one participant has got to. Built by joining their
// progress rows (per session) against the programme order, so "where they're up
// to" is the furthest session they've touched, not just a count.
type ParticipantProgress = {
  userId: string;
  hasBaseline: boolean;
  baselineDate: string | null;
  age: number | null;
  horizon: string;
  completed: number; // sessions finished
  inProgress: number; // sessions started but not finished
  totalModules: number; // sessions in the programme
  furthestOrder: number; // programme index of the furthest session touched, -1 if none
  currentLabel: string; // human sentence for where they are
  currentDetail: string; // the stage/session under that sentence
  lastActive: string | null; // most recent activity across their sessions
  totalActiveMs: number;
  byModule: Map<string, ModuleProgressRow>;
};

export default function AdminFeedbackView({
  adminEmail,
  // The *unfiltered* data as it arrives from the server. Everything below reads
  // date-filtered views of these (see the date filter just after), so that a
  // pilot start date can drop early tester accounts out of every tab at once.
  moduleFeedback: moduleFeedbackAll,
  generalFeedback: generalFeedbackAll,
  baseline,
  progress: progressAll,
  modules,
}: Props) {
  const [tab, setTab] = useState<Tab>("participants");

  // --- Date filter ----------------------------------------------------------
  // Two optional bounds, entered as calendar dates. The point of this is to
  // separate real pilot data from the tester accounts that came before it: set
  // "From" to the day the pilot opened and every earlier record — baselines,
  // sessions, comments — disappears from all the counts and tables.
  //
  // Both are inclusive: "From" starts at the first instant of that day and "To"
  // runs to the last instant, both in UTC (the stored timestamps are UTC, and
  // the tables already show UTC). Blank means unbounded on that side.
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const from = fromDate ? `${fromDate}T00:00:00.000Z` : "";
  const to = toDate ? `${toDate}T23:59:59.999Z` : "";
  const filterActive = from !== "" || to !== "";

  // A row's ISO timestamp is in range when it's on or after "From" and on or
  // before "To". ISO-8601 UTC strings sort lexically, so a string compare is a
  // correct time compare here — no Date parsing needed.
  const inRange = useCallback(
    (iso: string) => (!from || iso >= from) && (!to || iso <= to),
    [from, to]
  );

  // The filtered views the rest of the component works from. A feedback row is
  // placed by when it was given; a progress row by when the session was started.
  const moduleFeedback = useMemo(
    () => moduleFeedbackAll.filter((r) => inRange(r.createdAt)),
    [moduleFeedbackAll, inRange]
  );
  const generalFeedback = useMemo(
    () => generalFeedbackAll.filter((g) => inRange(g.createdAt)),
    [generalFeedbackAll, inRange]
  );
  const progress = useMemo(
    () => progressAll.filter((p) => inRange(p.startedAt)),
    [progressAll, inRange]
  );

  // How many records the current filter is hiding, for a plain-language note so
  // it's never a mystery why a count dropped.
  const hiddenCount =
    moduleFeedbackAll.length -
    moduleFeedback.length +
    (generalFeedbackAll.length - generalFeedback.length) +
    (progressAll.length - progress.length) +
    (baseline.length -
      baseline.filter((b) => inRange(b.createdAt)).length);

  // --- Baseline -------------------------------------------------------------
  // One row per participant, oldest first: the order people joined the pilot is
  // more useful to read down than newest-first.
  const baselineRows = useMemo<BaselineAnalysisRow[]>(
    () =>
      [...baseline]
        .map(toAnalysisRow)
        .filter((r) => inRange(r.takenAt))
        .sort((a, b) => a.takenAt.localeCompare(b.takenAt)),
    [baseline, inRange]
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

  // --- Participants (per-person progress) -----------------------------------
  // The programme in order, so a session id can be placed ("how far in is
  // this?") and grouped by stage for the dot strip.
  const stageGroups = useMemo<StageGroup[]>(() => {
    const byNumber = new Map<number, StageGroup>();
    for (const m of modules) {
      const g =
        byNumber.get(m.stageNumber) ??
        ({ number: m.stageNumber, name: m.stageName, moduleIds: [] } as StageGroup);
      g.moduleIds.push(m.id);
      byNumber.set(m.stageNumber, g);
    }
    return [...byNumber.values()].sort((a, b) => a.number - b.number);
  }, [modules]);

  // A session's place and name, keyed by id: its 0-based programme order (for
  // "furthest reached") and its stage/title (for the label under the sentence).
  const moduleMetaById = useMemo(() => {
    const m = new Map<
      string,
      { order: number; title: string; stageNumber: number; stageName: string }
    >();
    modules.forEach((mod, i) =>
      m.set(mod.id, {
        order: i,
        title: mod.title,
        stageNumber: mod.stageNumber,
        stageName: mod.stageName,
      })
    );
    return m;
  }, [modules]);

  // One row per participant, most-advanced first. A participant is anyone we've
  // seen at all — someone can have a baseline but not have started, or (an older
  // tester) have progress but no baseline, and both should show up.
  const participants = useMemo<ParticipantProgress[]>(() => {
    const byUser = new Map<string, ModuleProgressRow[]>();
    for (const p of progress) {
      const list = byUser.get(p.userId) ?? [];
      list.push(p);
      byUser.set(p.userId, list);
    }

    const userIds = new Set<string>([
      ...baselineRows.map((b) => b.userId),
      ...byUser.keys(),
    ]);

    const rows: ParticipantProgress[] = [];
    for (const userId of userIds) {
      const b = baselineByUser.get(userId);
      const theirs = byUser.get(userId) ?? [];
      const byModule = new Map<string, ModuleProgressRow>();
      for (const p of theirs) byModule.set(p.moduleId, p);

      const completed = theirs.filter((p) => p.completedAt !== null).length;
      const inProgress = theirs.length - completed;

      // The furthest session they've reached, by programme order. Sessions not in
      // the programme (an old id) don't count towards position, but their time
      // still counts towards totals below.
      let furthestOrder = -1;
      let furthestId: string | null = null;
      let furthestDone = false;
      for (const p of theirs) {
        const meta = moduleMetaById.get(p.moduleId);
        if (!meta) continue;
        if (meta.order > furthestOrder) {
          furthestOrder = meta.order;
          furthestId = p.moduleId;
          furthestDone = p.completedAt !== null;
        }
      }

      let currentLabel: string;
      let currentDetail: string;
      if (furthestId === null) {
        currentLabel = b ? "Signed up — not started" : "Not started";
        currentDetail = "";
      } else {
        const meta = moduleMetaById.get(furthestId)!;
        const done = completed >= modules.length;
        currentLabel = done
          ? "Finished the programme"
          : furthestDone
            ? "Ready for the next session"
            : "In this session now";
        currentDetail = `Stage ${meta.stageNumber} · ${meta.stageName} — ${meta.title}`;
      }

      // Most recent moment we can see: a completion if there is one, else when
      // they started it. Good enough to sort "who's gone quiet".
      let lastActive: string | null = null;
      for (const p of theirs) {
        const t = p.completedAt ?? p.startedAt;
        if (lastActive === null || t.localeCompare(lastActive) > 0) lastActive = t;
      }

      rows.push({
        userId,
        hasBaseline: !!b,
        baselineDate: b?.takenAt ?? null,
        age: b?.age ?? null,
        horizon: b?.horizon ?? "",
        completed,
        inProgress,
        totalModules: modules.length,
        furthestOrder,
        currentLabel,
        currentDetail,
        lastActive,
        totalActiveMs: theirs.reduce((a, p) => a + p.activeMs, 0),
        byModule,
      });
    }

    // Most advanced first, then most recently active — the people to look at
    // (furthest along, or most recently seen) rise to the top.
    rows.sort((a, b) => {
      if (b.furthestOrder !== a.furthestOrder)
        return b.furthestOrder - a.furthestOrder;
      return (b.lastActive ?? "").localeCompare(a.lastActive ?? "");
    });
    return rows;
  }, [progress, baselineRows, baselineByUser, moduleMetaById, modules.length]);

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

  // One row per participant: where they are in the programme, for a spreadsheet
  // read of the whole cohort's progress at a glance.
  function exportParticipantsCsv() {
    const header = [
      "user_id",
      "has_baseline",
      "sessions_completed",
      "sessions_in_progress",
      "sessions_total",
      "current_position",
      "current_session",
      "total_active_seconds",
      "last_active_utc",
    ];
    const rows = participants.map((p) => [
      p.userId,
      p.hasBaseline ? "yes" : "no",
      String(p.completed),
      String(p.inProgress),
      String(p.totalModules),
      p.currentLabel,
      p.currentDetail,
      String(Math.round(p.totalActiveMs / 1000)),
      p.lastActive ?? "",
    ]);
    downloadCsv("participant-progress.csv", [header, ...rows]);
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

        <div style={S.dateBar}>
          <div style={S.dateFields}>
            <label style={S.filterLabel}>
              <span style={S.filterText}>From</span>
              <input
                type="date"
                style={S.dateInput}
                value={fromDate}
                max={toDate || undefined}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </label>
            <label style={S.filterLabel}>
              <span style={S.filterText}>To</span>
              <input
                type="date"
                style={S.dateInput}
                value={toDate}
                min={fromDate || undefined}
                onChange={(e) => setToDate(e.target.value)}
              />
            </label>
            {filterActive && (
              <button
                style={S.clearBtn}
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                }}
              >
                Clear dates
              </button>
            )}
          </div>
          <p style={S.dateHelp}>
            {filterActive ? (
              <>
                Showing data{fromDate ? ` from ${fromDate}` : ""}
                {toDate ? ` to ${toDate}` : ""} (UTC).{" "}
                {hiddenCount > 0 && (
                  <strong>{hiddenCount} earlier record(s) hidden.</strong>
                )}
              </>
            ) : (
              <>
                Showing all data. Set <strong>From</strong> to your pilot start
                date to leave early tester accounts out of every tab.
              </>
            )}
          </p>
        </div>

        <nav style={S.tabs}>
          <TabButton
            active={tab === "participants"}
            onClick={() => setTab("participants")}
          >
            Participants ({participants.length})
          </TabButton>
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

        {tab === "participants" && (
          <section>
            <div style={S.toolbar}>
              <p style={S.help}>
                One card per person, furthest along first. The headline says where
                they are right now; the dots below show every session, grouped by
                stage — a <strong>filled</strong> dot is finished, a{" "}
                <strong>half</strong> dot is started but not yet done, and an{" "}
                <strong>empty</strong> dot is not yet reached. Hover a dot for the
                session name. <strong>Last seen</strong> is the most recent moment
                we recorded any activity for them.
              </p>
              <button style={S.csvBtn} onClick={exportParticipantsCsv}>
                ↓ Download CSV
              </button>
            </div>
            {participants.length === 0 ? (
              <Empty>
                No participants yet. Someone appears here as soon as they finish
                onboarding or open their first session.
              </Empty>
            ) : (
              <ul style={S.cardList}>
                {participants.map((p) => (
                  <li key={p.userId} style={S.card}>
                    <div style={S.cardHead}>
                      <div>
                        <span style={S.progressWho} title={p.userId}>
                          {shortUser(p.userId)}
                        </span>
                        <span style={S.progressMeta}>
                          {p.hasBaseline ? (
                            <>
                              {p.age !== null && <>{p.age} · </>}
                              {p.horizon || "baseline on file"}
                            </>
                          ) : (
                            <span style={S.muted}>no baseline</span>
                          )}
                        </span>
                      </div>
                      <span style={S.cardDate}>
                        {p.lastActive ? (
                          <>Last seen {fmtDate(p.lastActive)}</>
                        ) : (
                          <span style={S.muted}>never active</span>
                        )}
                      </span>
                    </div>

                    <div style={S.progressStatusRow}>
                      <span style={S.progressStatus}>{p.currentLabel}</span>
                      {p.currentDetail && (
                        <span style={S.progressDetail}>{p.currentDetail}</span>
                      )}
                    </div>

                    <div style={S.progressCounts}>
                      <span>
                        <strong style={S.progressBig}>{p.completed}</strong>
                        <span style={S.avgOutOf}> / {p.totalModules} sessions done</span>
                      </span>
                      {p.inProgress > 0 && (
                        <span style={S.progressInFlight}>
                          {p.inProgress} in progress
                        </span>
                      )}
                      {p.totalActiveMs > 0 && (
                        <span style={S.progressTime}>
                          {fmtDuration(p.totalActiveMs)} on screen
                        </span>
                      )}
                    </div>

                    <div style={S.stageStrips}>
                      {stageGroups.map((g) => (
                        <div key={g.number} style={S.stageStrip}>
                          <span style={S.stageStripLabel}>
                            {g.number}. {g.name}
                          </span>
                          <div style={S.dotRow}>
                            {g.moduleIds.map((id) => {
                              const row = p.byModule.get(id);
                              const state = !row
                                ? "none"
                                : row.completedAt !== null
                                  ? "done"
                                  : "started";
                              const meta = moduleMetaById.get(id);
                              const status =
                                state === "done"
                                  ? "finished"
                                  : state === "started"
                                    ? "started, not finished"
                                    : "not reached";
                              return (
                                <span
                                  key={id}
                                  style={{
                                    ...S.dot2,
                                    ...(state === "done"
                                      ? S.dotDone
                                      : state === "started"
                                        ? S.dotStarted
                                        : S.dotNone),
                                  }}
                                  title={`${meta?.title ?? id} — ${status}`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

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
  dateBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 16,
    flexWrap: "wrap",
    padding: "14px 16px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    marginBottom: 20,
  },
  dateFields: { display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" },
  dateInput: {
    appearance: "auto",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    padding: "7px 10px",
    fontSize: "var(--fs-body)",
    color: "var(--text)",
    fontFamily: "var(--font-sans)",
  },
  clearBtn: {
    appearance: "none",
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-pill)",
    padding: "8px 14px",
    fontSize: "var(--fs-sm)",
    color: "var(--text)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  dateHelp: {
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    margin: 0,
    maxWidth: 360,
    lineHeight: 1.5,
    textAlign: "right",
  },
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

  // --- Participants (progress cards) ---
  progressWho: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    color: "var(--text)",
  },
  progressMeta: {
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    marginLeft: 10,
  },
  progressStatusRow: {
    marginTop: 12,
    display: "flex",
    alignItems: "baseline",
    gap: 10,
    flexWrap: "wrap",
  },
  progressStatus: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-section)",
    color: "var(--text)",
  },
  progressDetail: { fontSize: "var(--fs-sm)", color: "var(--text-muted)" },
  progressCounts: {
    marginTop: 8,
    display: "flex",
    gap: 16,
    alignItems: "baseline",
    flexWrap: "wrap",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
  },
  progressBig: {
    fontFamily: "var(--font-serif)",
    fontSize: "20px",
    color: "var(--text)",
    fontVariantNumeric: "tabular-nums",
  },
  progressInFlight: { color: "var(--accent-strong)", fontWeight: 600 },
  progressTime: { color: "var(--text-muted)" },
  stageStrips: {
    marginTop: 14,
    display: "flex",
    gap: 18,
    flexWrap: "wrap",
  },
  stageStrip: { display: "flex", flexDirection: "column", gap: 6 },
  stageStripLabel: {
    fontSize: "var(--fs-eyebrow)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--text-muted)",
  },
  dotRow: { display: "flex", gap: 5 },
  dot2: {
    width: 12,
    height: 12,
    borderRadius: "50%",
    display: "inline-block",
    boxSizing: "border-box",
  },
  dotDone: { background: "var(--brand-primary)" },
  // Half-filled: a brand-coloured ring with a lighter centre, so "started" reads
  // as visibly between empty and done at a glance.
  dotStarted: {
    background: "var(--brand-primary-tint)",
    border: "2px solid var(--brand-primary)",
  },
  dotNone: { background: "var(--muted-surface)", border: "1px solid var(--border)" },
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
