import "server-only";
import { neon } from "@neondatabase/serverless";

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
