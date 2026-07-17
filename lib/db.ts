import "server-only";
import { neon } from "@neondatabase/serverless";
import type {
  DraftFact,
  StoredFact,
  FactCategory,
  RecurringDomain,
} from "@/lib/contextFacts";

// The single place the app talks to Postgres. Server-only (the import above
// makes a client bundle fail loudly), and it uses the POOLED connection string,
// which suits Vercel's serverless runtime. Every former localStorage key now
// lives as a row in user_data: (user_id, key) is the primary key, value is the
// JSON that used to be the localStorage string. user_id is always supplied by
// the caller from the authenticated Clerk session — never from client input.

// Created lazily on first query, not at module load. `next build` evaluates this
// module while collecting page data — in that context DATABASE_URL may be
// absent, and instantiating neon() eagerly would throw and fail the build. The
// connection is only ever needed at request time, where the variable is set.
type Sql = ReturnType<typeof neon>;
let sqlClient: Sql | null = null;

function sql(): Sql {
  if (!sqlClient) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    sqlClient = neon(url);
  }
  return sqlClient;
}

// Create the table at most once per server instance. We cache the promise so
// concurrent requests share one CREATE, and clear it on failure so a transient
// error doesn't wedge every later request.
let tableReady: Promise<void> | null = null;

function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = sql()`
      CREATE TABLE IF NOT EXISTS user_data (
        user_id text NOT NULL,
        key text NOT NULL,
        value jsonb,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, key)
      )
    `
      .then(() => undefined)
      .catch((err) => {
        tableReady = null;
        throw err;
      });
  }
  return tableReady;
}

// Every row the user owns, as the { key: value } map the client snapshot wants.
export async function getAllUserData(
  userId: string
): Promise<Record<string, unknown>> {
  await ensureTable();
  const rows = (await sql()`
    SELECT key, value FROM user_data WHERE user_id = ${userId}
  `) as { key: string; value: unknown }[];
  const out: Record<string, unknown> = {};
  for (const row of rows) out[row.key] = row.value;
  return out;
}

// One key's value for one user, or null if there's no such row. Used by the
// server-side onboarding gate, which only needs the onboarding-complete flag.
export async function getUserData(
  userId: string,
  key: string
): Promise<unknown> {
  await ensureTable();
  const rows = (await sql()`
    SELECT value FROM user_data WHERE user_id = ${userId} AND key = ${key}
  `) as { value: unknown }[];
  return rows.length > 0 ? rows[0].value : null;
}

// Upsert one key for one user. JSON.stringify + ::jsonb keeps the value typed
// as jsonb rather than a quoted string.
export async function setUserData(
  userId: string,
  key: string,
  value: unknown
): Promise<void> {
  await ensureTable();
  await sql()`
    INSERT INTO user_data (user_id, key, value, updated_at)
    VALUES (${userId}, ${key}, ${JSON.stringify(value)}::jsonb, now())
    ON CONFLICT (user_id, key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}

export async function deleteUserData(
  userId: string,
  key: string
): Promise<void> {
  await ensureTable();
  await sql()`DELETE FROM user_data WHERE user_id = ${userId} AND key = ${key}`;
}

// Wipe everything for one user — the "start over" reset.
export async function deleteAllUserData(userId: string): Promise<void> {
  await ensureTable();
  await sql()`DELETE FROM user_data WHERE user_id = ${userId}`;
}

// --- Context facts --------------------------------------------------------
// The canonical, typed profile: one row per fact, able to be superseded or
// rejected (the correction loop). Provisioned automatically via the same lazy
// ensure pattern, so there's no manual migration. Every write is atomic per row
// — a single INSERT or a single UPDATE keyed by (id, user_id) — so there is no
// read-modify-write race. Phase 1 writes and validates this store only; no live
// consumer reads it yet. The index matches the query phase 2's resolver runs:
// active facts for a user, optionally by category.
let factsTableReady: Promise<void> | null = null;

function ensureContextFactsTable(): Promise<void> {
  if (!factsTableReady) {
    factsTableReady = (async () => {
      await sql()`
        CREATE TABLE IF NOT EXISTS context_facts (
          id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          user_id text NOT NULL,
          category text NOT NULL,
          domain text,
          data jsonb NOT NULL,
          provenance_module text,
          provenance_source text,
          status text NOT NULL DEFAULT 'active',
          superseded_by bigint,
          confidence text NOT NULL DEFAULT 'certain',
          created_at timestamptz NOT NULL DEFAULT now(),
          last_affirmed_at timestamptz
        )
      `;
      await sql()`
        CREATE INDEX IF NOT EXISTS context_facts_user_category_status_idx
        ON context_facts (user_id, category, status)
      `;
    })()
      .then(() => undefined)
      .catch((err) => {
        factsTableReady = null;
        throw err;
      });
  }
  return factsTableReady;
}

// The raw row shape postgres hands back.
type FactRow = {
  id: number | string;
  user_id: string;
  category: string;
  domain: string | null;
  data: unknown;
  provenance_module: string | null;
  provenance_source: string | null;
  status: string;
  superseded_by: number | string | null;
  confidence: string;
  created_at: string | Date;
  last_affirmed_at: string | Date | null;
};

function toIso(v: string | Date | null): string | null {
  if (v === null) return null;
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

function rowToFact(row: FactRow): StoredFact {
  return {
    id: String(row.id),
    userId: row.user_id,
    category: row.category as FactCategory,
    domain: (row.domain as RecurringDomain | null) ?? null,
    data: (row.data as StoredFact["data"]) ?? { label: "" },
    provenanceModule: row.provenance_module ?? "",
    provenanceSource:
      (row.provenance_source as StoredFact["provenanceSource"]) ?? "widget_pick",
    status: row.status as StoredFact["status"],
    supersededBy: row.superseded_by === null ? null : String(row.superseded_by),
    confidence: row.confidence as StoredFact["confidence"],
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    lastAffirmedAt: toIso(row.last_affirmed_at),
  };
}

// Insert one fact. Atomic single-statement write; returns the stored row.
export async function addFact(
  userId: string,
  fact: DraftFact
): Promise<StoredFact> {
  await ensureContextFactsTable();
  const rows = (await sql()`
    INSERT INTO context_facts
      (user_id, category, domain, data, provenance_module, provenance_source, confidence)
    VALUES (
      ${userId}, ${fact.category}, ${fact.domain ?? null},
      ${JSON.stringify(fact.data)}::jsonb, ${fact.provenanceModule},
      ${fact.provenanceSource}, ${fact.confidence}
    )
    RETURNING *
  `) as FactRow[];
  return rowToFact(rows[0]);
}

// Mark a fact superseded by a newer one (a re-edit that changed it). Single
// UPDATE, scoped to the user so one user can't touch another's rows.
export async function supersedeFact(
  userId: string,
  factId: string,
  supersededById: string | null = null
): Promise<void> {
  await ensureContextFactsTable();
  await sql()`
    UPDATE context_facts
    SET status = 'superseded', superseded_by = ${supersededById}
    WHERE id = ${factId} AND user_id = ${userId} AND status = 'active'
  `;
}

// Mark a fact rejected (a correction that removed it — e.g. the "11am coffee"
// case, after the in-conversation confirmation).
export async function rejectFact(
  userId: string,
  factId: string
): Promise<void> {
  await ensureContextFactsTable();
  await sql()`
    UPDATE context_facts
    SET status = 'rejected'
    WHERE id = ${factId} AND user_id = ${userId} AND status = 'active'
  `;
}

// Attach a conversational REASON to an existing fact, additively. Merges a single
// `reason` key into the jsonb `data` with `||`, so every other field — the label,
// the pick, and any widget-set `description` — is left exactly as it was. Guarded
// so it never overwrites a reason already present (e.g. a dream's own reason): it
// only fills an empty/absent one. Scoped to the user and to active facts.
export async function annotateFact(
  userId: string,
  factId: string,
  reason: string
): Promise<void> {
  const r = reason.trim();
  if (!r) return;
  await ensureContextFactsTable();
  await sql()`
    UPDATE context_facts
    SET data = data || jsonb_build_object('reason', ${r}::text)
    WHERE id = ${factId} AND user_id = ${userId} AND status = 'active'
      AND (data->>'reason' IS NULL OR data->>'reason' = '')
  `;
}

// Re-affirm a still-active fact (the user reconfirmed it): bump
// last_affirmed_at, and promote a still_forming fact to certain.
export async function affirmFact(
  userId: string,
  factId: string
): Promise<void> {
  await ensureContextFactsTable();
  await sql()`
    UPDATE context_facts
    SET last_affirmed_at = now(), confidence = 'certain'
    WHERE id = ${factId} AND user_id = ${userId} AND status = 'active'
  `;
}

// All active facts for a user, optionally filtered by category and/or the module
// they came from. This is exactly the query the phase-2 resolver will run.
export async function activeFacts(
  userId: string,
  filter: { category?: FactCategory; provenanceModule?: string } = {}
): Promise<StoredFact[]> {
  await ensureContextFactsTable();
  let rows: FactRow[];
  if (filter.category && filter.provenanceModule) {
    rows = (await sql()`
      SELECT * FROM context_facts
      WHERE user_id = ${userId} AND status = 'active'
        AND category = ${filter.category}
        AND provenance_module = ${filter.provenanceModule}
      ORDER BY id
    `) as FactRow[];
  } else if (filter.category) {
    rows = (await sql()`
      SELECT * FROM context_facts
      WHERE user_id = ${userId} AND status = 'active' AND category = ${filter.category}
      ORDER BY id
    `) as FactRow[];
  } else if (filter.provenanceModule) {
    rows = (await sql()`
      SELECT * FROM context_facts
      WHERE user_id = ${userId} AND status = 'active'
        AND provenance_module = ${filter.provenanceModule}
      ORDER BY id
    `) as FactRow[];
  } else {
    rows = (await sql()`
      SELECT * FROM context_facts
      WHERE user_id = ${userId} AND status = 'active'
      ORDER BY id
    `) as FactRow[];
  }
  return rows.map(rowToFact);
}

// Every fact for a user regardless of status — for the dev debug route, which
// groups by active / superseded / rejected.
export async function allFacts(userId: string): Promise<StoredFact[]> {
  await ensureContextFactsTable();
  const rows = (await sql()`
    SELECT * FROM context_facts WHERE user_id = ${userId} ORDER BY id
  `) as FactRow[];
  return rows.map(rowToFact);
}

// --- Feedback -------------------------------------------------------------
// Tester feedback submitted from the in-app feedback panel. Separate table
// (not user_data) because it's append-only and not keyed per user/key: one row
// per submission, with the page the tester was on so we know where it came
// from. reply_email is optional — only set when the tester asks for a reply.
// `type` records which entry point it came from: 'feedback' (the floating
// feedback pill) or 'support' (the header's Support button). It's nullable with
// no default on purpose: rows written before this column existed stay NULL and
// the portal shows them as "unknown", rather than being silently relabelled.
let feedbackTableReady: Promise<void> | null = null;

export type FeedbackType = "feedback" | "support";

function ensureFeedbackTable(): Promise<void> {
  if (!feedbackTableReady) {
    feedbackTableReady = (async () => {
      await sql()`
        CREATE TABLE IF NOT EXISTS feedback (
          id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          user_id text NOT NULL,
          message text NOT NULL,
          reply_email text,
          page text,
          type text,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      // For instances whose table predates the type column, add it in place.
      // No default, so existing rows read back as NULL ("unknown" in the portal).
      await sql()`ALTER TABLE feedback ADD COLUMN IF NOT EXISTS type text`;
    })()
      .then(() => undefined)
      .catch((err) => {
        feedbackTableReady = null;
        throw err;
      });
  }
  return feedbackTableReady;
}

// Record one feedback submission. user_id always comes from the authenticated
// Clerk session at the call site, never from client input. type is which entry
// point it came from ('feedback' | 'support').
export async function insertFeedback(input: {
  userId: string;
  message: string;
  replyEmail: string | null;
  page: string | null;
  type: FeedbackType;
}): Promise<void> {
  await ensureFeedbackTable();
  await sql()`
    INSERT INTO feedback (user_id, message, reply_email, page, type)
    VALUES (
      ${input.userId}, ${input.message}, ${input.replyEmail},
      ${input.page}, ${input.type}
    )
  `;
}

// One general-feedback / support row, as read by the admin portal. Read-only:
// the portal never writes here.
export type FeedbackRow = {
  id: string;
  userId: string;
  message: string;
  replyEmail: string | null;
  page: string | null;
  // 'feedback' | 'support', or null for rows written before the column existed.
  type: FeedbackType | null;
  createdAt: string;
};

// Every general-feedback submission, newest first — for the admin portal. Reads
// across all users, so it is only ever called behind the admin gate.
export async function getAllFeedback(): Promise<FeedbackRow[]> {
  await ensureFeedbackTable();
  const rows = (await sql()`
    SELECT id, user_id, message, reply_email, page, type, created_at
    FROM feedback
    ORDER BY created_at DESC
  `) as {
    id: number | string;
    user_id: string;
    message: string;
    reply_email: string | null;
    page: string | null;
    type: string | null;
    created_at: string | Date;
  }[];
  return rows.map((r) => ({
    id: String(r.id),
    userId: r.user_id,
    message: r.message,
    replyEmail: r.reply_email,
    page: r.page,
    type:
      r.type === "feedback" || r.type === "support"
        ? (r.type as FeedbackType)
        : null,
    createdAt: toIso(r.created_at) ?? new Date().toISOString(),
  }));
}

// --- Per-module feedback --------------------------------------------------
// The short card shown at the close of every module (all 24), for aggregate
// per-module analysis — how useful / engaging each module felt, plus an
// optional note. Its own table (not the support `feedback` one) because the
// shape is different — structured ratings keyed by module — and, crucially,
// because this path must NOT email: 24 modules per member would be spam, so
// unlike insertFeedback there is deliberately no email side-effect anywhere
// above the call site. Each rating is 'very' | 'somewhat' | 'not_really', or
// null when that question was skipped. The index supports the per-module rollup.
let moduleFeedbackTableReady: Promise<void> | null = null;

function ensureModuleFeedbackTable(): Promise<void> {
  if (!moduleFeedbackTableReady) {
    moduleFeedbackTableReady = (async () => {
      await sql()`
        CREATE TABLE IF NOT EXISTS module_feedback (
          id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          user_id text NOT NULL,
          module_id text NOT NULL,
          useful text,
          engaging text,
          worked text,
          issue text,
          comment text,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      // For instances whose table predates the "did everything work?" question,
      // add the columns in place. No default, so any pre-existing row reads back
      // as NULL — "never asked", which is what it was.
      await sql()`ALTER TABLE module_feedback ADD COLUMN IF NOT EXISTS worked text`;
      await sql()`ALTER TABLE module_feedback ADD COLUMN IF NOT EXISTS issue text`;
      await sql()`
        CREATE INDEX IF NOT EXISTS module_feedback_module_idx
        ON module_feedback (module_id)
      `;
    })()
      .then(() => undefined)
      .catch((err) => {
        moduleFeedbackTableReady = null;
        throw err;
      });
  }
  return moduleFeedbackTableReady;
}

// A stored rating value: the string of a 1–5 number ("1".."5"), or null when the
// question was skipped. The scale is defined once in lib/moduleFeedback.ts and
// enforced by the allowlist in /api/module-feedback — the column itself has no
// DB-level constraint.
//
// The table previously held 0–10 ratings and, before that, three-point words
// ("very" | "somewhat" | "not_really"). All of it was internal testing from
// before any external tester, and it was cleared on 2026-07-17 when the card
// moved to 1–5 — deliberately, because a stored "3" cannot be read as both 3/10
// and 3/5, and mixing the two would have quietly averaged into nonsense. So
// every row now on this table is 1–5, and no scale marker is needed.
export type ModuleRating = string | null;

// Record one per-module feedback submission. user_id always comes from the
// authenticated Clerk session at the call site, never from client input.
export async function insertModuleFeedback(input: {
  userId: string;
  moduleId: string;
  useful: ModuleRating;
  engaging: ModuleRating;
  // "yes" | "no", or null when the question was skipped — a skip and a "no" are
  // very different things and must stay distinguishable.
  worked: string | null;
  // What went wrong, only ever set alongside worked = "no".
  issue: string | null;
  comment: string | null;
}): Promise<void> {
  await ensureModuleFeedbackTable();
  await sql()`
    INSERT INTO module_feedback (
      user_id, module_id, useful, engaging, worked, issue, comment
    )
    VALUES (
      ${input.userId}, ${input.moduleId},
      ${input.useful}, ${input.engaging},
      ${input.worked}, ${input.issue}, ${input.comment}
    )
  `;
}

// One per-module feedback row, as read by the admin portal. Read-only.
export type ModuleFeedbackRow = {
  id: string;
  userId: string;
  moduleId: string;
  useful: ModuleRating;
  engaging: ModuleRating;
  worked: string | null;
  issue: string | null;
  comment: string | null;
  createdAt: string;
};

// Every per-module feedback submission, newest first — for the admin portal. It
// reads across all users, so it is only ever called behind the admin gate. The
// portal computes the per-module rollup (counts, rating distributions) in JS
// from these raw rows; at pilot scale that is cheap and keeps one query serving
// the summary, the comments view, and the CSV export alike.
export async function getAllModuleFeedback(): Promise<ModuleFeedbackRow[]> {
  await ensureModuleFeedbackTable();
  const rows = (await sql()`
    SELECT id, user_id, module_id, useful, engaging, worked, issue, comment,
           created_at
    FROM module_feedback
    ORDER BY created_at DESC
  `) as {
    id: number | string;
    user_id: string;
    module_id: string;
    useful: string | null;
    engaging: string | null;
    worked: string | null;
    issue: string | null;
    comment: string | null;
    created_at: string | Date;
  }[];
  return rows.map((r) => ({
    id: String(r.id),
    userId: r.user_id,
    moduleId: r.module_id,
    useful: (r.useful as ModuleRating) ?? null,
    engaging: (r.engaging as ModuleRating) ?? null,
    worked: r.worked,
    issue: r.issue,
    comment: r.comment,
    createdAt: toIso(r.created_at) ?? new Date().toISOString(),
  }));
}

// --- Baseline survey ------------------------------------------------------
// The one-time pilot baseline, captured at the end of onboarding — "before
// participants begin". Its own table (like module_feedback) because it is
// cross-user research data read by the admin portal, not per-turn coaching
// state. One row per member (user_id is the PK), upserted, so re-running
// onboarding overwrites rather than duplicating. The four survey-specific
// answers (gender, feelings, planning confidence, expectations) live only here;
// the demographic columns (dob, partner, retirement_stage, horizon) are a
// snapshot of answers also held in user_data, copied in so the baseline is one
// self-contained, analysable row. Every column is nullable — every question can
// be skipped, and the flag-gated status/horizon steps may never be asked.
let baselineSurveyTableReady: Promise<void> | null = null;

function ensureBaselineSurveyTable(): Promise<void> {
  if (!baselineSurveyTableReady) {
    baselineSurveyTableReady = sql()`
      CREATE TABLE IF NOT EXISTS baseline_survey (
        user_id text PRIMARY KEY,
        gender text,
        feelings jsonb,
        prior_planning text,
        planning_confidence int,
        expectations text,
        dob text,
        partner text,
        retirement_stage text,
        horizon text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `
      .then(() => undefined)
      .catch((err) => {
        baselineSurveyTableReady = null;
        throw err;
      });
  }
  return baselineSurveyTableReady;
}

// The full baseline payload. user_id always comes from the authenticated Clerk
// session at the call site, never from client input. feelings is the up-to-three
// multi-select (stored as a JSON array); priorPlanning is how much non-financial
// planning they've already done (stored as the chosen label); planningConfidence
// is 1–5 or null.
export type BaselineSurveyInput = {
  userId: string;
  gender: string | null;
  feelings: string[];
  priorPlanning: string | null;
  planningConfidence: number | null;
  expectations: string | null;
  dob: string | null;
  partner: string | null;
  retirementStage: string | null;
  horizon: string | null;
};

// Record (or overwrite) one member's baseline. The PK conflict target makes this
// idempotent: finishing onboarding twice updates the single row in place.
export async function upsertBaselineSurvey(
  input: BaselineSurveyInput
): Promise<void> {
  await ensureBaselineSurveyTable();
  await sql()`
    INSERT INTO baseline_survey (
      user_id, gender, feelings, prior_planning, planning_confidence,
      expectations, dob, partner, retirement_stage, horizon, updated_at
    )
    VALUES (
      ${input.userId}, ${input.gender},
      ${JSON.stringify(input.feelings)}::jsonb, ${input.priorPlanning},
      ${input.planningConfidence},
      ${input.expectations}, ${input.dob}, ${input.partner},
      ${input.retirementStage}, ${input.horizon}, now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      gender = EXCLUDED.gender,
      feelings = EXCLUDED.feelings,
      prior_planning = EXCLUDED.prior_planning,
      planning_confidence = EXCLUDED.planning_confidence,
      expectations = EXCLUDED.expectations,
      dob = EXCLUDED.dob,
      partner = EXCLUDED.partner,
      retirement_stage = EXCLUDED.retirement_stage,
      horizon = EXCLUDED.horizon,
      updated_at = now()
  `;
}

// One baseline row, as read by the admin portal. Read-only there.
export type BaselineSurveyRow = {
  userId: string;
  gender: string | null;
  feelings: string[];
  priorPlanning: string | null;
  planningConfidence: number | null;
  expectations: string | null;
  dob: string | null;
  partner: string | null;
  retirementStage: string | null;
  horizon: string | null;
  createdAt: string;
};

// Every baseline submission, newest first — for the admin portal. Reads across
// all users, so it is only ever called behind the admin gate.
export async function getAllBaselineSurveys(): Promise<BaselineSurveyRow[]> {
  await ensureBaselineSurveyTable();
  const rows = (await sql()`
    SELECT user_id, gender, feelings, prior_planning, planning_confidence,
           expectations, dob, partner, retirement_stage, horizon, created_at
    FROM baseline_survey
    ORDER BY created_at DESC
  `) as {
    user_id: string;
    gender: string | null;
    feelings: unknown;
    prior_planning: string | null;
    planning_confidence: number | null;
    expectations: string | null;
    dob: string | null;
    partner: string | null;
    retirement_stage: string | null;
    horizon: string | null;
    created_at: string | Date;
  }[];
  return rows.map((r) => ({
    userId: r.user_id,
    gender: r.gender,
    feelings: Array.isArray(r.feelings) ? (r.feelings as string[]) : [],
    priorPlanning: r.prior_planning,
    planningConfidence: r.planning_confidence,
    expectations: r.expectations,
    dob: r.dob,
    partner: r.partner,
    retirementStage: r.retirement_stage,
    horizon: r.horizon,
    createdAt: toIso(r.created_at) ?? new Date().toISOString(),
  }));
}

// --- Module progress (pilot analytics) ------------------------------------
// How long each session actually took, and whether it was finished. One row per
// (user, session), upserted as they work.
//
// Its own table, like module_feedback and baseline_survey, for the same reason:
// it is cross-user research data read by the admin portal. Keeping it here also
// means the portal never has to read `user_data` — the store holding
// conversations and answers — to report on progress. The portal reads no member
// content today and this keeps it that way.
//
// active_ms is time the session was actually on screen, accumulated by the
// client. Elapsed time (started_at → completed_at) is deliberately NOT the
// measure of how long a session takes: the programme suggests one session a day,
// so people open one, leave, and finish tomorrow. Elapsed would report that as
// 1,400 minutes and quietly make "are these really 10–20 minutes?"
// unanswerable. Both are stored — active answers "how much effort", elapsed
// answers "did they do it in one sitting" — but they answer different questions
// and must not be confused.
//
// This is an ANALYTICS record, deliberately separate from the app's own progress
// state (the `completed` list in user_data, which stays the source of truth for
// what the member sees). It is never read to decide anything the member
// experiences.
let moduleProgressTableReady: Promise<void> | null = null;

function ensureModuleProgressTable(): Promise<void> {
  if (!moduleProgressTableReady) {
    moduleProgressTableReady = (async () => {
      await sql()`
        CREATE TABLE IF NOT EXISTS module_progress (
          user_id text NOT NULL,
          module_id text NOT NULL,
          active_ms bigint NOT NULL DEFAULT 0,
          visits int NOT NULL DEFAULT 0,
          started_at timestamptz NOT NULL DEFAULT now(),
          completed_at timestamptz,
          updated_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (user_id, module_id)
        )
      `;
      await sql()`
        CREATE INDEX IF NOT EXISTS module_progress_module_idx
        ON module_progress (module_id)
      `;
    })()
      .then(() => undefined)
      .catch((err) => {
        moduleProgressTableReady = null;
        throw err;
      });
  }
  return moduleProgressTableReady;
}

// Add time to a session and, optionally, mark it finished. user_id always comes
// from the authenticated Clerk session at the call site, never from client input.
//
// active_ms ACCUMULATES (+=) rather than being set: the client sends how much
// time has passed since its last flush, so a lost or duplicated flush costs a
// slice rather than the whole total, and a second visit adds to the first
// instead of replacing it.
//
// completed_at uses COALESCE so it keeps the FIRST completion. Revisiting a
// finished session must not rewrite when it was done.
export async function recordModuleProgress(input: {
  userId: string;
  moduleId: string;
  addMs: number;
  newVisit: boolean;
  completed: boolean;
}): Promise<void> {
  await ensureModuleProgressTable();
  await sql()`
    INSERT INTO module_progress (
      user_id, module_id, active_ms, visits, completed_at, updated_at
    )
    VALUES (
      ${input.userId}, ${input.moduleId}, ${input.addMs},
      ${input.newVisit ? 1 : 0},
      ${input.completed ? new Date().toISOString() : null}, now()
    )
    ON CONFLICT (user_id, module_id) DO UPDATE SET
      active_ms = module_progress.active_ms + ${input.addMs},
      visits = module_progress.visits + ${input.newVisit ? 1 : 0},
      completed_at = COALESCE(
        module_progress.completed_at, EXCLUDED.completed_at
      ),
      updated_at = now()
  `;
}

export type ModuleProgressRow = {
  userId: string;
  moduleId: string;
  activeMs: number;
  visits: number;
  startedAt: string;
  completedAt: string | null;
};

// Every progress row, for the admin portal. Reads across all users, so it is
// only ever called behind the admin gate.
export async function getAllModuleProgress(): Promise<ModuleProgressRow[]> {
  await ensureModuleProgressTable();
  const rows = (await sql()`
    SELECT user_id, module_id, active_ms, visits, started_at, completed_at
    FROM module_progress
    ORDER BY started_at
  `) as {
    user_id: string;
    module_id: string;
    active_ms: string | number;
    visits: number;
    started_at: string | Date;
    completed_at: string | Date | null;
  }[];
  return rows.map((r) => ({
    userId: r.user_id,
    moduleId: r.module_id,
    // bigint comes back as a string from the driver — Number is safe here, an
    // eternity of session time still fits well inside a JS integer.
    activeMs: Number(r.active_ms),
    visits: r.visits,
    startedAt: toIso(r.started_at) ?? new Date().toISOString(),
    completedAt: toIso(r.completed_at),
  }));
}

// "Start over" — keep the analytics, cut the person out of them.
//
// The rows stay (how long a session takes is a finding worth keeping, and so is
// the fact that someone restarted), but they are reassigned to a fresh random id
// that is NOT derived from the user's, and no mapping is kept anywhere. Nothing
// links the surviving rows back to the person: this is anonymisation, not the
// pseudonymisation the live rows carry.
//
// One token for the whole reset, not one per row, so a single run stays readable
// as a run.
//
// It also has to happen for a plain functional reason: (user_id, module_id) is
// the primary key, so the old rows must vacate their slots before the fresh run
// can record against the same sessions.
export async function anonymiseModuleProgress(userId: string): Promise<void> {
  await ensureModuleProgressTable();
  // crypto.randomUUID is unrelated to the user id — that's the point.
  const anonId = `anon_${crypto.randomUUID()}`;
  await sql()`
    UPDATE module_progress
    SET user_id = ${anonId}, updated_at = now()
    WHERE user_id = ${userId}
  `;
}

// --- Per-user hard deletes ------------------------------------------------
// Row-level erasure helpers, one per table. Each is scoped to a single user_id
// and removes rows outright (no soft-delete / status flip): the correction loop
// keeps rejected/superseded facts around, but erasure must leave nothing behind.
// deleteAllUserData (above) covers the user_data table, including the base64 RLP
// plan images, which live in the plan-images key there — there is no separate
// image table.

// Every context fact for a user, regardless of status (active, superseded,
// rejected). Used by the "start over" reset and by full erasure.
export async function deleteAllContextFacts(userId: string): Promise<void> {
  await ensureContextFactsTable();
  await sql()`DELETE FROM context_facts WHERE user_id = ${userId}`;
}

// Every general-feedback / support row for a user. Free-text bodies can name or
// describe the person, so full erasure deletes them outright rather than
// scrubbing user_id. Not touched by "start over" (a restart keeps feedback).
export async function deleteAllFeedback(userId: string): Promise<void> {
  await ensureFeedbackTable();
  await sql()`DELETE FROM feedback WHERE user_id = ${userId}`;
}

// Every per-module feedback row for a user. Same reasoning as deleteAllFeedback
// (the optional comment is free text). Not touched by "start over".
export async function deleteAllModuleFeedback(userId: string): Promise<void> {
  await ensureModuleFeedbackTable();
  await sql()`DELETE FROM module_feedback WHERE user_id = ${userId}`;
}

// The member's baseline row. The expectations free-text can describe the person,
// so full erasure deletes it outright. Not touched by "start over" (a restart
// keeps the baseline, same as feedback).
export async function deleteAllBaselineSurvey(userId: string): Promise<void> {
  await ensureBaselineSurveyTable();
  await sql()`DELETE FROM baseline_survey WHERE user_id = ${userId}`;
}

// The member's progress rows. Erasure deletes outright — "start over" anonymises
// them instead (see anonymiseModuleProgress), but erasure means erasure, and
// leaving rows behind for someone who asked to be deleted is not the place to be
// clever. Any rows already anonymised by an earlier reset are beyond reach by
// design: they no longer carry this (or any) user id.
export async function deleteAllModuleProgress(userId: string): Promise<void> {
  await ensureModuleProgressTable();
  await sql()`DELETE FROM module_progress WHERE user_id = ${userId}`;
}
