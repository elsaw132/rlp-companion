import "server-only";
import {
  type StoredFact,
  draftsFromSnapshot,
  factIdentity,
  CONTEXT_FACTS_SNAPSHOT_KEY,
} from "@/lib/contextFacts";
import { activeFacts, addFact, setUserData } from "@/lib/db";

// Re-exported so existing importers (the user-data route) keep working.
export { CONTEXT_FACTS_SNAPSHOT_KEY };

// Deterministically construct a user's initial context profile from the data
// they already have. Lossless by design: every structured pick becomes a fact,
// with NO slice caps (the bug that dropped "only 1 of 5" and truncated the
// userModel). Conversational-only history can't be recovered after the fact —
// that's what the going-forward capture loop is for — so this draws purely from
// the structured rows.
//
// Runs lazily (off the bulk snapshot fetch) and is idempotent two ways: a
// version marker short-circuits the whole pass once done, and even without it
// we never re-add a fact whose identity is already active.

// The user_data key holding the backfill version a user has been processed at.
// Bump CURRENT_BACKFILL_VERSION to force a one-time re-run (e.g. after fixing a
// mapping); the identity de-dup keeps even that from creating duplicates.
const BACKFILL_VERSION_KEY = "context-backfill-version";
const CURRENT_BACKFILL_VERSION = 1;

type Snapshot = Record<string, unknown>;

// Run the backfill for a user if they haven't been processed at the current
// version. Returns the active facts either way (so the caller can attach them to
// the snapshot). Best-effort: a failure here never blocks the data load.
export async function ensureBackfill(
  userId: string,
  data: Snapshot
): Promise<{ ran: boolean; added: number; facts: StoredFact[] }> {
  const already = data[BACKFILL_VERSION_KEY];
  const atCurrentVersion =
    typeof already === "number" && already >= CURRENT_BACKFILL_VERSION;

  if (atCurrentVersion) {
    return { ran: false, added: 0, facts: await activeFacts(userId) };
  }

  const drafts = draftsFromSnapshot(data);

  // Idempotent even on a re-run: skip any draft whose identity is already active.
  const existing = await activeFacts(userId);
  const present = new Set(existing.map(factIdentity));
  const toAdd = drafts.filter((d) => {
    const id = factIdentity(d);
    if (present.has(id)) return false;
    present.add(id);
    return true;
  });

  await Promise.all(toAdd.map((d) => addFact(userId, d)));

  // Only mark the pass done once there was genuinely something to process — the
  // snapshot yielded derivable drafts, or the user already has facts. On the
  // very first authed load (UserDataProvider fires GET /api/user-data from
  // /onboarding before the user has typed anything) the snapshot is empty and
  // derives nothing; writing the marker then would permanently short-circuit the
  // backfill so it never runs against the real data. Leaving it unset keeps the
  // pass armed until source data exists, then it marks itself done. Cheap to
  // re-attempt each load until then (the derivation is pure and de-duped).
  const provisioned = drafts.length > 0 || existing.length > 0;
  if (provisioned) {
    try {
      await setUserData(userId, BACKFILL_VERSION_KEY, CURRENT_BACKFILL_VERSION);
    } catch {
      // The identity de-dup above keeps a missed marker from duplicating facts.
    }
  }

  return { ran: provisioned, added: toAdd.length, facts: await activeFacts(userId) };
}
