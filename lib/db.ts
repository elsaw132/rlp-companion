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
let feedbackTableReady: Promise<void> | null = null;

function ensureFeedbackTable(): Promise<void> {
  if (!feedbackTableReady) {
    feedbackTableReady = sql()`
      CREATE TABLE IF NOT EXISTS feedback (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        user_id text NOT NULL,
        message text NOT NULL,
        reply_email text,
        page text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `
      .then(() => undefined)
      .catch((err) => {
        feedbackTableReady = null;
        throw err;
      });
  }
  return feedbackTableReady;
}

// Record one feedback submission. user_id always comes from the authenticated
// Clerk session at the call site, never from client input.
export async function insertFeedback(input: {
  userId: string;
  message: string;
  replyEmail: string | null;
  page: string | null;
}): Promise<void> {
  await ensureFeedbackTable();
  await sql()`
    INSERT INTO feedback (user_id, message, reply_email, page)
    VALUES (${input.userId}, ${input.message}, ${input.replyEmail}, ${input.page})
  `;
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
          comment text,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;
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

export type ModuleRating = "very" | "somewhat" | "not_really" | null;

// Record one per-module feedback submission. user_id always comes from the
// authenticated Clerk session at the call site, never from client input.
export async function insertModuleFeedback(input: {
  userId: string;
  moduleId: string;
  useful: ModuleRating;
  engaging: ModuleRating;
  comment: string | null;
}): Promise<void> {
  await ensureModuleFeedbackTable();
  await sql()`
    INSERT INTO module_feedback (user_id, module_id, useful, engaging, comment)
    VALUES (
      ${input.userId}, ${input.moduleId},
      ${input.useful}, ${input.engaging}, ${input.comment}
    )
  `;
}
