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

// Reject every active fact a single module contributed to the profile. Used when
// that module is restarted ("Start over" on one session), so its facts leave the
// canonical profile too — not only its cached answers. Without this, a restart
// re-drafts from a pool that still holds the old module's facts (which is why the
// seasons board kept showing last run's cards). Returns how many were rejected.
export async function rejectFactsByModule(
  userId: string,
  moduleId: string
): Promise<void> {
  await ensureContextFactsTable();
  await sql()`
    UPDATE context_facts
    SET status = 'rejected'
    WHERE user_id = ${userId} AND provenance_module = ${moduleId} AND status = 'active'
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
      // Optional free-text source tag (e.g. the couples talk-list empty state).
      await sql()`ALTER TABLE feedback ADD COLUMN IF NOT EXISTS context text`;
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
  context?: string | null;
}): Promise<void> {
  await ensureFeedbackTable();
  await sql()`
    INSERT INTO feedback (user_id, message, reply_email, page, type, context)
    VALUES (
      ${input.userId}, ${input.message}, ${input.replyEmail},
      ${input.page}, ${input.type}, ${input.context ?? null}
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

// One user's collected gender, or null when they have no baseline row or left
// it blank. Used only to personalise pronouns in couples copy; callers must
// treat null as "unknown" and fall back to "they" (see lib/pronouns.ts).
export async function getBaselineGender(
  userId: string
): Promise<string | null> {
  await ensureBaselineSurveyTable();
  const rows = (await sql()`
    SELECT gender FROM baseline_survey WHERE user_id = ${userId} LIMIT 1
  `) as { gender: string | null }[];
  return rows.length ? rows[0].gender : null;
}

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

// --- Post-completion survey -----------------------------------------------
// The one-time pilot survey shown when a member finishes the programme — their
// Retirement Life Plan is complete. This is the "after" to baseline_survey's
// "before". Its own table, for the same reasons as baseline_survey: cross-user
// research data read by the admin portal, one row per member (user_id is the PK),
// upserted so a resubmission overwrites in place rather than duplicating.
//
// Two columns deliberately share the baseline's names and types — feelings
// (jsonb) and planning_confidence (int) — because the pilot compares them
// directly across the two tables. Keep them identical. Every other column is the
// survey's own. Every column is nullable: every question can be skipped, and a
// partial submission still records whatever was answered.
let postCompletionSurveyTableReady: Promise<void> | null = null;

function ensurePostCompletionSurveyTable(): Promise<void> {
  if (!postCompletionSurveyTableReady) {
    postCompletionSurveyTableReady = sql()`
      CREATE TABLE IF NOT EXISTS post_completion_survey (
        user_id text PRIMARY KEY,
        overall_value int,
        feelings jsonb,
        feelings_other text,
        planning_confidence int,
        before_thought text,
        after_thought text,
        expectations_met text,
        vita_understood int,
        vita_good_questions int,
        vita_authentic int,
        vita_challenged int,
        vita_discovered int,
        comfort_sharing int,
        comfort_improve text,
        session_stayed text,
        session_stayed_why text,
        team_message text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `
      .then(() => undefined)
      .catch((err) => {
        postCompletionSurveyTableReady = null;
        throw err;
      });
  }
  return postCompletionSurveyTableReady;
}

// The full post-completion payload. user_id always comes from the authenticated
// Clerk session at the call site, never from client input. feelings is the
// up-to-three multi-select (stored as a JSON array); the *_value / vita_* /
// comfort fields are 1–5 ints or null; session_stayed is the module id of the
// one session that stayed with them; the rest are free text or null.
export type PostCompletionSurveyInput = {
  userId: string;
  overallValue: number | null;
  feelings: string[];
  feelingsOther: string | null;
  planningConfidence: number | null;
  beforeThought: string | null;
  afterThought: string | null;
  expectationsMet: string | null;
  vitaUnderstood: number | null;
  vitaGoodQuestions: number | null;
  vitaAuthentic: number | null;
  vitaChallenged: number | null;
  vitaDiscovered: number | null;
  comfortSharing: number | null;
  comfortImprove: string | null;
  sessionStayed: string | null;
  sessionStayedWhy: string | null;
  teamMessage: string | null;
};

// Record (or overwrite) one member's post-completion survey. The PK conflict
// target makes this idempotent: resubmitting updates the single row in place.
export async function upsertPostCompletionSurvey(
  input: PostCompletionSurveyInput
): Promise<void> {
  await ensurePostCompletionSurveyTable();
  await sql()`
    INSERT INTO post_completion_survey (
      user_id, overall_value, feelings, feelings_other, planning_confidence,
      before_thought, after_thought, expectations_met,
      vita_understood, vita_good_questions, vita_authentic, vita_challenged,
      vita_discovered, comfort_sharing, comfort_improve,
      session_stayed, session_stayed_why, team_message, updated_at
    )
    VALUES (
      ${input.userId}, ${input.overallValue},
      ${JSON.stringify(input.feelings)}::jsonb, ${input.feelingsOther},
      ${input.planningConfidence}, ${input.beforeThought}, ${input.afterThought},
      ${input.expectationsMet}, ${input.vitaUnderstood}, ${input.vitaGoodQuestions},
      ${input.vitaAuthentic}, ${input.vitaChallenged}, ${input.vitaDiscovered},
      ${input.comfortSharing}, ${input.comfortImprove}, ${input.sessionStayed},
      ${input.sessionStayedWhy}, ${input.teamMessage}, now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      overall_value = EXCLUDED.overall_value,
      feelings = EXCLUDED.feelings,
      feelings_other = EXCLUDED.feelings_other,
      planning_confidence = EXCLUDED.planning_confidence,
      before_thought = EXCLUDED.before_thought,
      after_thought = EXCLUDED.after_thought,
      expectations_met = EXCLUDED.expectations_met,
      vita_understood = EXCLUDED.vita_understood,
      vita_good_questions = EXCLUDED.vita_good_questions,
      vita_authentic = EXCLUDED.vita_authentic,
      vita_challenged = EXCLUDED.vita_challenged,
      vita_discovered = EXCLUDED.vita_discovered,
      comfort_sharing = EXCLUDED.comfort_sharing,
      comfort_improve = EXCLUDED.comfort_improve,
      session_stayed = EXCLUDED.session_stayed,
      session_stayed_why = EXCLUDED.session_stayed_why,
      team_message = EXCLUDED.team_message,
      updated_at = now()
  `;
}

// One post-completion row, as read by the admin portal. Read-only there.
export type PostCompletionSurveyRow = {
  userId: string;
  overallValue: number | null;
  feelings: string[];
  feelingsOther: string | null;
  planningConfidence: number | null;
  beforeThought: string | null;
  afterThought: string | null;
  expectationsMet: string | null;
  vitaUnderstood: number | null;
  vitaGoodQuestions: number | null;
  vitaAuthentic: number | null;
  vitaChallenged: number | null;
  vitaDiscovered: number | null;
  comfortSharing: number | null;
  comfortImprove: string | null;
  sessionStayed: string | null;
  sessionStayedWhy: string | null;
  teamMessage: string | null;
  createdAt: string;
};

// Every post-completion submission, newest first — for the admin portal. Reads
// across all users, so it is only ever called behind the admin gate. Whether a
// row exists for a user is also the "has this member already done the survey?"
// signal the dashboard card uses to flip to its completed state.
export async function getAllPostCompletionSurveys(): Promise<
  PostCompletionSurveyRow[]
> {
  await ensurePostCompletionSurveyTable();
  const rows = (await sql()`
    SELECT user_id, overall_value, feelings, feelings_other, planning_confidence,
           before_thought, after_thought, expectations_met,
           vita_understood, vita_good_questions, vita_authentic, vita_challenged,
           vita_discovered, comfort_sharing, comfort_improve,
           session_stayed, session_stayed_why, team_message, created_at
    FROM post_completion_survey
    ORDER BY created_at DESC
  `) as {
    user_id: string;
    overall_value: number | null;
    feelings: unknown;
    feelings_other: string | null;
    planning_confidence: number | null;
    before_thought: string | null;
    after_thought: string | null;
    expectations_met: string | null;
    vita_understood: number | null;
    vita_good_questions: number | null;
    vita_authentic: number | null;
    vita_challenged: number | null;
    vita_discovered: number | null;
    comfort_sharing: number | null;
    comfort_improve: string | null;
    session_stayed: string | null;
    session_stayed_why: string | null;
    team_message: string | null;
    created_at: string | Date;
  }[];
  return rows.map((r) => ({
    userId: r.user_id,
    overallValue: r.overall_value,
    feelings: Array.isArray(r.feelings) ? (r.feelings as string[]) : [],
    feelingsOther: r.feelings_other,
    planningConfidence: r.planning_confidence,
    beforeThought: r.before_thought,
    afterThought: r.after_thought,
    expectationsMet: r.expectations_met,
    vitaUnderstood: r.vita_understood,
    vitaGoodQuestions: r.vita_good_questions,
    vitaAuthentic: r.vita_authentic,
    vitaChallenged: r.vita_challenged,
    vitaDiscovered: r.vita_discovered,
    comfortSharing: r.comfort_sharing,
    comfortImprove: r.comfort_improve,
    sessionStayed: r.session_stayed,
    sessionStayedWhy: r.session_stayed_why,
    teamMessage: r.team_message,
    createdAt: toIso(r.created_at) ?? new Date().toISOString(),
  }));
}

// Has this member already submitted the post-completion survey? One indexed PK
// lookup — used server-side to gate the dashboard card and to avoid re-sending
// the survey email.
export async function hasPostCompletionSurvey(userId: string): Promise<boolean> {
  await ensurePostCompletionSurveyTable();
  const rows = (await sql()`
    SELECT 1 FROM post_completion_survey WHERE user_id = ${userId} LIMIT 1
  `) as unknown[];
  return rows.length > 0;
}

// GDPR erasure — drop this member's survey row. Wired into lib/erasure.ts.
export async function deleteAllPostCompletionSurvey(
  userId: string
): Promise<void> {
  await ensurePostCompletionSurveyTable();
  await sql()`DELETE FROM post_completion_survey WHERE user_id = ${userId}`;
}

// --- Post-completion survey email (once-per-user guard) -------------------
// A tiny marker table so the survey-invite email fires at most once per member,
// ever. Claiming a row is atomic (INSERT ... ON CONFLICT DO NOTHING RETURNING),
// so concurrent completion flushes can't double-send. Deliberately NOT cleared
// by "start over" (unlike user_data and module_progress), so restarting the
// programme never triggers a second email; only full GDPR erasure removes it.
let postCompletionEmailTableReady: Promise<void> | null = null;

function ensurePostCompletionEmailTable(): Promise<void> {
  if (!postCompletionEmailTableReady) {
    postCompletionEmailTableReady = (async () => {
      await sql()`
        CREATE TABLE IF NOT EXISTS post_completion_email (
          user_id text PRIMARY KEY,
          claimed_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      // The scheduled Resend message id, so the delayed send can be cancelled if
      // the member completes the survey in-app before it fires. Added in place
      // for any table that predates it.
      await sql()`ALTER TABLE post_completion_email ADD COLUMN IF NOT EXISTS resend_id text`;
    })()
      .then(() => undefined)
      .catch((err) => {
        postCompletionEmailTableReady = null;
        throw err;
      });
  }
  return postCompletionEmailTableReady;
}

// Claim the one-and-only survey email for this member. Returns true exactly once
// — the first call — and false forever after, so the caller schedules the email
// only when it gets true. Atomic, so it is safe against concurrent callers.
export async function claimPostCompletionEmail(
  userId: string
): Promise<boolean> {
  await ensurePostCompletionEmailTable();
  const rows = (await sql()`
    INSERT INTO post_completion_email (user_id)
    VALUES (${userId})
    ON CONFLICT (user_id) DO NOTHING
    RETURNING user_id
  `) as unknown[];
  return rows.length > 0;
}

// Store the scheduled Resend message id against the claim, so the delayed send
// can be cancelled later if the member completes the survey first.
export async function setPostCompletionEmailResendId(
  userId: string,
  resendId: string
): Promise<void> {
  await ensurePostCompletionEmailTable();
  await sql()`
    UPDATE post_completion_email SET resend_id = ${resendId} WHERE user_id = ${userId}
  `;
}

// The scheduled Resend message id for this member, or null if none is stored.
export async function getPostCompletionEmailResendId(
  userId: string
): Promise<string | null> {
  await ensurePostCompletionEmailTable();
  const rows = (await sql()`
    SELECT resend_id FROM post_completion_email WHERE user_id = ${userId}
  `) as { resend_id: string | null }[];
  return rows.length > 0 ? rows[0].resend_id : null;
}

// Clear the stored id once the scheduled send has been cancelled, so we don't try
// to cancel it again on a later resubmission.
export async function clearPostCompletionEmailResendId(
  userId: string
): Promise<void> {
  await ensurePostCompletionEmailTable();
  await sql()`
    UPDATE post_completion_email SET resend_id = NULL WHERE user_id = ${userId}
  `;
}

// One row per member whose survey invite has been sent (claimed), for the admin
// completions view. Reads across all users, so it is only ever called behind the
// admin gate.
export type PostCompletionEmailRow = { userId: string; claimedAt: string };

export async function getAllPostCompletionEmails(): Promise<
  PostCompletionEmailRow[]
> {
  await ensurePostCompletionEmailTable();
  const rows = (await sql()`
    SELECT user_id, claimed_at FROM post_completion_email
  `) as { user_id: string; claimed_at: string | Date }[];
  return rows.map((r) => ({
    userId: r.user_id,
    claimedAt: toIso(r.claimed_at) ?? new Date().toISOString(),
  }));
}

// GDPR erasure — drop this member's email marker. Wired into lib/erasure.ts.
export async function deleteAllPostCompletionEmail(
  userId: string
): Promise<void> {
  await ensurePostCompletionEmailTable();
  await sql()`DELETE FROM post_completion_email WHERE user_id = ${userId}`;
}

// Every member's completed-session list, for the admin completions funnel. The
// `completed` array in user_data is the authoritative record of what a member has
// finished (module_progress is analytics and can miss older completions), so
// "has finished their plan" is read from here. updated_at is the closest stamp we
// have for when the list last changed. Reads across all users — admin gate only.
export type CompletedListRow = {
  userId: string;
  completed: string[];
  updatedAt: string;
};

export async function getAllCompletedLists(): Promise<CompletedListRow[]> {
  await ensureTable();
  const rows = (await sql()`
    SELECT user_id, value, updated_at FROM user_data WHERE key = 'completed'
  `) as { user_id: string; value: unknown; updated_at: string | Date }[];
  return rows.map((r) => ({
    userId: r.user_id,
    completed: Array.isArray(r.value) ? (r.value as string[]) : [],
    updatedAt: toIso(r.updated_at) ?? new Date().toISOString(),
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

// ===========================================================================
// Couples — "Plan with your partner" (module 5.1)
//
// Four tables, all created lazily like the rest of this file. Two participants
// who each finished their own plan are linked by an admin into a couple_pairing;
// each privately records what they'll share in share_selection (their consent);
// once both have, a generated_comparison is cached and either partner can add to
// a shared talk_topic list. Everything derived is deleted on withdrawal — only
// the minimal pairing + consent-timestamp audit is kept. There are no foreign
// keys (house convention — Clerk text ids, app-managed integrity), so child-row
// deletion is always explicit.
// ===========================================================================

export type PairingStatus = "active" | "withdrawn";

// One active pairing per participant is NOT structurally guaranteed by the DB:
// the two partial unique indexes only stop the same id appearing twice in the
// SAME slot (a vs b). The real guard is the atomic guarded INSERT in
// createPairing() below, which refuses to insert when either id is already in an
// active pairing. If it ever needs to be DB-guaranteed, the robust shape is a
// pairing_membership table (one row per participant per pairing) with a partial
// unique index on participant_id WHERE active.
let couplePairingReady: Promise<void> | null = null;
function ensureCouplePairingTable(): Promise<void> {
  if (!couplePairingReady) {
    couplePairingReady = (async () => {
      await sql()`
        CREATE TABLE IF NOT EXISTS couple_pairing (
          id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          participant_a_id text NOT NULL,
          participant_b_id text NOT NULL,
          created_by_admin_id text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          status text NOT NULL DEFAULT 'active',
          withdrawn_by_id text,
          withdrawn_at timestamptz,
          CHECK (participant_a_id < participant_b_id),
          CHECK (status IN ('active','withdrawn'))
        )
      `;
      await sql()`
        CREATE UNIQUE INDEX IF NOT EXISTS couple_pairing_active_a
          ON couple_pairing (participant_a_id) WHERE status = 'active'
      `;
      await sql()`
        CREATE UNIQUE INDEX IF NOT EXISTS couple_pairing_active_b
          ON couple_pairing (participant_b_id) WHERE status = 'active'
      `;
    })()
      .then(() => undefined)
      .catch((err) => {
        couplePairingReady = null;
        throw err;
      });
  }
  return couplePairingReady;
}

// Per participant per pairing: the ids of the plan items they chose to share
// (their selection) plus completed_at (their consent timestamp). Editable and
// revocable. about_partner_refs caches the one-off classification of which of
// their fears are about the partner/relationship (defaulted off in the UI).
// updated_at is set explicitly by the app on every write, never left to the
// insert default.
let shareSelectionReady: Promise<void> | null = null;
function ensureShareSelectionTable(): Promise<void> {
  if (!shareSelectionReady) {
    shareSelectionReady = (async () => {
      await sql()`
        CREATE TABLE IF NOT EXISTS share_selection (
          id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          pairing_id bigint NOT NULL,
          participant_id text NOT NULL,
          shared_item_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
          about_partner_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
          completed_at timestamptz,
          updated_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE (pairing_id, participant_id)
        )
      `;
      // The first name this participant confirmed for their partner (never
      // guessed silently). Nullable — set at the confirm-name step.
      await sql()`ALTER TABLE share_selection ADD COLUMN IF NOT EXISTS partner_name text`;
    })()
      .then(() => undefined)
      .catch((err) => {
        shareSelectionReady = null;
        throw err;
      });
  }
  return shareSelectionReady;
}

// The shared "worth talking about" list holds ONLY user additions — the Vita
// seed topics live in generated_comparison.payload_json and are regenerated
// freely, so there is no source column and nothing to reconcile.
let talkTopicReady: Promise<void> | null = null;
function ensureTalkTopicTable(): Promise<void> {
  if (!talkTopicReady) {
    talkTopicReady = (async () => {
      await sql()`
        CREATE TABLE IF NOT EXISTS talk_topic (
          id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          pairing_id bigint NOT NULL,
          author_participant_id text NOT NULL,
          body text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql()`
        CREATE INDEX IF NOT EXISTS talk_topic_pairing ON talk_topic (pairing_id)
      `;
    })()
      .then(() => undefined)
      .catch((err) => {
        talkTopicReady = null;
        throw err;
      });
  }
  return talkTopicReady;
}

// Cache of the Vita-generated comparison payload, one row per pairing.
// input_hash is regenerated when either selection or the underlying plan data
// changes; a miss triggers a fresh generation.
let generatedComparisonReady: Promise<void> | null = null;
function ensureGeneratedComparisonTable(): Promise<void> {
  if (!generatedComparisonReady) {
    generatedComparisonReady = (async () => {
      await sql()`
        CREATE TABLE IF NOT EXISTS generated_comparison (
          pairing_id bigint PRIMARY KEY,
          payload_json jsonb NOT NULL,
          input_hash text NOT NULL,
          generated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
    })()
      .then(() => undefined)
      .catch((err) => {
        generatedComparisonReady = null;
        throw err;
      });
  }
  return generatedComparisonReady;
}

export type PairingRow = {
  id: string;
  participantAId: string;
  participantBId: string;
  createdByAdminId: string;
  createdAt: string;
  status: PairingStatus;
  withdrawnById: string | null;
  withdrawnAt: string | null;
};

type RawPairing = {
  id: number | string;
  participant_a_id: string;
  participant_b_id: string;
  created_by_admin_id: string;
  created_at: string | Date;
  status: string;
  withdrawn_by_id: string | null;
  withdrawn_at: string | Date | null;
};

function mapPairing(r: RawPairing): PairingRow {
  return {
    id: String(r.id),
    participantAId: r.participant_a_id,
    participantBId: r.participant_b_id,
    createdByAdminId: r.created_by_admin_id,
    createdAt: toIso(r.created_at) ?? new Date().toISOString(),
    status: r.status === "withdrawn" ? "withdrawn" : "active",
    withdrawnById: r.withdrawn_by_id,
    withdrawnAt: toIso(r.withdrawn_at),
  };
}

export type CreatePairingResult =
  | { ok: true; pairingId: string }
  | { ok: false; reason: "same-user" | "already-paired"; blockedId?: string };

// Pair two participants. The pair is stored canonically (lower id in slot a) so
// (A,B) == (B,A). The guard is a single atomic statement: the row inserts only
// when NEITHER id is already in an active pairing — no check-then-insert race.
// A zero-row result means it was blocked; we then look up which id is already
// paired purely to give the admin a clear message.
export async function createPairing(input: {
  adminId: string;
  participantAId: string;
  participantBId: string;
}): Promise<CreatePairingResult> {
  await ensureCouplePairingTable();
  const { adminId } = input;
  if (input.participantAId === input.participantBId) {
    return { ok: false, reason: "same-user" };
  }
  const [lo, hi] =
    input.participantAId < input.participantBId
      ? [input.participantAId, input.participantBId]
      : [input.participantBId, input.participantAId];

  const inserted = (await sql()`
    INSERT INTO couple_pairing (participant_a_id, participant_b_id, created_by_admin_id)
    SELECT ${lo}, ${hi}, ${adminId}
    WHERE NOT EXISTS (
      SELECT 1 FROM couple_pairing
      WHERE status = 'active'
        AND (participant_a_id IN (${lo}, ${hi}) OR participant_b_id IN (${lo}, ${hi}))
    )
    RETURNING id
  `) as { id: number | string }[];

  if (inserted.length === 0) {
    const existing = (await sql()`
      SELECT participant_a_id, participant_b_id FROM couple_pairing
      WHERE status = 'active'
        AND (participant_a_id IN (${lo}, ${hi}) OR participant_b_id IN (${lo}, ${hi}))
      LIMIT 1
    `) as { participant_a_id: string; participant_b_id: string }[];
    const blockedId = existing.length
      ? [existing[0].participant_a_id, existing[0].participant_b_id].find(
          (id) => id === lo || id === hi
        )
      : undefined;
    return { ok: false, reason: "already-paired", blockedId };
  }
  return { ok: true, pairingId: String(inserted[0].id) };
}

// The active pairing a participant belongs to, or null. This is the single
// authorization link that lets one participant's data be read alongside another's.
export async function getActivePairingFor(
  userId: string
): Promise<PairingRow | null> {
  await ensureCouplePairingTable();
  const rows = (await sql()`
    SELECT * FROM couple_pairing
    WHERE status = 'active'
      AND (participant_a_id = ${userId} OR participant_b_id = ${userId})
    LIMIT 1
  `) as RawPairing[];
  return rows.length ? mapPairing(rows[0]) : null;
}

export async function getPairingById(
  pairingId: string
): Promise<PairingRow | null> {
  await ensureCouplePairingTable();
  const rows = (await sql()`
    SELECT * FROM couple_pairing WHERE id = ${pairingId} LIMIT 1
  `) as RawPairing[];
  return rows.length ? mapPairing(rows[0]) : null;
}

// Every active pairing, newest first — for the admin portal. Reads across all
// users, so only ever called behind the admin gate.
export async function getActivePairings(): Promise<PairingRow[]> {
  await ensureCouplePairingTable();
  const rows = (await sql()`
    SELECT * FROM couple_pairing WHERE status = 'active' ORDER BY created_at DESC
  `) as RawPairing[];
  return rows.map(mapPairing);
}

// Stop sharing (either partner, or an admin). Collapses the shared view (status
// → withdrawn, only if still active — idempotent), keeps each consent timestamp
// but clears WHAT was shared (data minimisation), and deletes all derived
// content. No FK cascade, so the child deletes are explicit. Safe to call more
// than once.
export async function withdrawPairing(input: {
  pairingId: string;
  withdrawnById: string;
}): Promise<void> {
  await ensureCouplePairingTable();
  await ensureShareSelectionTable();
  await ensureTalkTopicTable();
  await ensureGeneratedComparisonTable();
  const { pairingId, withdrawnById } = input;
  await sql()`
    UPDATE couple_pairing
    SET status = 'withdrawn', withdrawn_by_id = ${withdrawnById}, withdrawn_at = now()
    WHERE id = ${pairingId} AND status = 'active'
  `;
  await sql()`
    UPDATE share_selection
    SET shared_item_refs = '[]'::jsonb, about_partner_refs = '[]'::jsonb, updated_at = now()
    WHERE pairing_id = ${pairingId}
  `;
  await sql()`DELETE FROM generated_comparison WHERE pairing_id = ${pairingId}`;
  await sql()`DELETE FROM talk_topic WHERE pairing_id = ${pairingId}`;
}

export type ShareSelectionRow = {
  pairingId: string;
  participantId: string;
  sharedItemRefs: string[];
  aboutPartnerRefs: string[];
  completedAt: string | null;
  updatedAt: string;
  partnerName: string | null;
};

function mapShareSelection(r: {
  pairing_id: number | string;
  participant_id: string;
  shared_item_refs: unknown;
  about_partner_refs: unknown;
  completed_at: string | Date | null;
  updated_at: string | Date;
  partner_name?: string | null;
}): ShareSelectionRow {
  return {
    pairingId: String(r.pairing_id),
    participantId: r.participant_id,
    sharedItemRefs: Array.isArray(r.shared_item_refs)
      ? (r.shared_item_refs as string[])
      : [],
    aboutPartnerRefs: Array.isArray(r.about_partner_refs)
      ? (r.about_partner_refs as string[])
      : [],
    completedAt: toIso(r.completed_at),
    updatedAt: toIso(r.updated_at) ?? new Date().toISOString(),
    partnerName: r.partner_name ?? null,
  };
}

// Record the first name a participant confirmed for their partner. Creates a
// draft selection row if none exists yet (completed_at stays null), or updates
// the name on an existing row, without disturbing their selection.
export async function setPartnerName(input: {
  pairingId: string;
  participantId: string;
  name: string;
}): Promise<void> {
  await ensureShareSelectionTable();
  await sql()`
    INSERT INTO share_selection (pairing_id, participant_id, partner_name, updated_at)
    VALUES (${input.pairingId}, ${input.participantId}, ${input.name}, now())
    ON CONFLICT (pairing_id, participant_id) DO UPDATE SET
      partner_name = EXCLUDED.partner_name, updated_at = now()
  `;
}

// One participant's selection for a pairing, or null if they haven't started.
export async function getShareSelection(
  pairingId: string,
  participantId: string
): Promise<ShareSelectionRow | null> {
  await ensureShareSelectionTable();
  const rows = (await sql()`
    SELECT * FROM share_selection
    WHERE pairing_id = ${pairingId} AND participant_id = ${participantId}
    LIMIT 1
  `) as Parameters<typeof mapShareSelection>[0][];
  return rows.length ? mapShareSelection(rows[0]) : null;
}

// Both participants' selections for a pairing (0, 1, or 2 rows).
export async function getShareSelections(
  pairingId: string
): Promise<ShareSelectionRow[]> {
  await ensureShareSelectionTable();
  const rows = (await sql()`
    SELECT * FROM share_selection WHERE pairing_id = ${pairingId}
  `) as Parameters<typeof mapShareSelection>[0][];
  return rows.map(mapShareSelection);
}

// Save (or update) a participant's selection. `complete` records consent: the
// completed_at timestamp is set the first time they complete and preserved on
// later edits (COALESCE), so editing what's shared never resets the consent
// record. updated_at is always set here — never left to the insert default.
export async function upsertShareSelection(input: {
  pairingId: string;
  participantId: string;
  sharedItemRefs: string[];
  aboutPartnerRefs: string[];
  complete: boolean;
}): Promise<void> {
  await ensureShareSelectionTable();
  const shared = JSON.stringify(input.sharedItemRefs);
  const about = JSON.stringify(input.aboutPartnerRefs);
  await sql()`
    INSERT INTO share_selection
      (pairing_id, participant_id, shared_item_refs, about_partner_refs, completed_at, updated_at)
    VALUES (
      ${input.pairingId}, ${input.participantId},
      ${shared}::jsonb, ${about}::jsonb,
      CASE WHEN ${input.complete} THEN now() ELSE NULL END, now()
    )
    ON CONFLICT (pairing_id, participant_id) DO UPDATE SET
      shared_item_refs = EXCLUDED.shared_item_refs,
      about_partner_refs = EXCLUDED.about_partner_refs,
      completed_at = COALESCE(share_selection.completed_at, EXCLUDED.completed_at),
      updated_at = now()
  `;
}

// The cached generated comparison for a pairing (payload + the input hash it was
// generated from), or null on a miss.
export async function getCachedComparison(
  pairingId: string
): Promise<{ payload: unknown; inputHash: string } | null> {
  await ensureGeneratedComparisonTable();
  const rows = (await sql()`
    SELECT payload_json, input_hash FROM generated_comparison
    WHERE pairing_id = ${pairingId} LIMIT 1
  `) as { payload_json: unknown; input_hash: string }[];
  return rows.length
    ? { payload: rows[0].payload_json, inputHash: rows[0].input_hash }
    : null;
}

// Upsert the cached comparison for a pairing (one row per pairing).
export async function saveCachedComparison(input: {
  pairingId: string;
  payload: unknown;
  inputHash: string;
}): Promise<void> {
  await ensureGeneratedComparisonTable();
  const payload = JSON.stringify(input.payload);
  await sql()`
    INSERT INTO generated_comparison (pairing_id, payload_json, input_hash, generated_at)
    VALUES (${input.pairingId}, ${payload}::jsonb, ${input.inputHash}, now())
    ON CONFLICT (pairing_id) DO UPDATE SET
      payload_json = EXCLUDED.payload_json,
      input_hash = EXCLUDED.input_hash,
      generated_at = now()
  `;
}

export type TalkTopicRow = {
  id: string;
  pairingId: string;
  authorParticipantId: string;
  body: string;
  createdAt: string;
};

function mapTalkTopic(r: {
  id: number | string;
  pairing_id: number | string;
  author_participant_id: string;
  body: string;
  created_at: string | Date;
}): TalkTopicRow {
  return {
    id: String(r.id),
    pairingId: String(r.pairing_id),
    authorParticipantId: r.author_participant_id,
    body: r.body,
    createdAt: toIso(r.created_at) ?? new Date().toISOString(),
  };
}

// The user-added talk topics for a pairing, oldest first (Vita seeds live in the
// generated payload, not here).
export async function listTalkTopics(pairingId: string): Promise<TalkTopicRow[]> {
  await ensureTalkTopicTable();
  const rows = (await sql()`
    SELECT * FROM talk_topic WHERE pairing_id = ${pairingId} ORDER BY created_at ASC
  `) as Parameters<typeof mapTalkTopic>[0][];
  return rows.map(mapTalkTopic);
}

// Add one user talk topic; returns the created row.
export async function addTalkTopic(input: {
  pairingId: string;
  authorParticipantId: string;
  body: string;
}): Promise<TalkTopicRow> {
  await ensureTalkTopicTable();
  const rows = (await sql()`
    INSERT INTO talk_topic (pairing_id, author_participant_id, body)
    VALUES (${input.pairingId}, ${input.authorParticipantId}, ${input.body})
    RETURNING *
  `) as Parameters<typeof mapTalkTopic>[0][];
  return mapTalkTopic(rows[0]);
}

// Full erasure of one user's couples footprint, for the end-of-pilot "delete it
// all" flow. Erasure means erasure: for every pairing this user belongs to
// (active or withdrawn), delete the derived content, both share_selections, and
// the pairing row itself — the shared artefact can't survive one party being
// erased, and this severs the partner's link too.
export async function deleteAllCoupleData(userId: string): Promise<void> {
  await ensureCouplePairingTable();
  await ensureShareSelectionTable();
  await ensureTalkTopicTable();
  await ensureGeneratedComparisonTable();
  const pairings = (await sql()`
    SELECT id FROM couple_pairing
    WHERE participant_a_id = ${userId} OR participant_b_id = ${userId}
  `) as { id: number | string }[];
  for (const p of pairings) {
    const id = String(p.id);
    await sql()`DELETE FROM generated_comparison WHERE pairing_id = ${id}`;
    await sql()`DELETE FROM talk_topic WHERE pairing_id = ${id}`;
    await sql()`DELETE FROM share_selection WHERE pairing_id = ${id}`;
    await sql()`DELETE FROM couple_pairing WHERE id = ${id}`;
  }
}
