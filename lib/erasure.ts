import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import {
  deleteAllUserData,
  deleteAllContextFacts,
  deleteAllFeedback,
  deleteAllModuleFeedback,
  deleteAllBaselineSurvey,
} from "@/lib/db";

// True erasure for one person — the mechanism the end-of-pilot "delete it all"
// request depends on, so it must be genuinely complete. Unlike "start over"
// (which keeps the account and feedback and is a restart), this removes
// everything the app holds for a user and then the account itself.
//
// What it removes, all hard deletes (no anonymise / status flip):
//   - user_data          — every key/value row, INCLUDING the base64 RLP plan
//                          images (they live in the plan-images key, not a
//                          separate table)
//   - context_facts      — the derived profile, every status
//   - feedback           — free-text bodies can name the person, so delete, not scrub
//   - module_feedback    — same reasoning (optional free-text comment)
//   - baseline_survey    — same reasoning (free-text expectations)
//   - the Clerk user account itself (done last — see below)
//
// The Postgres deletes run first and together; the Clerk account is deleted last
// so that if account deletion fails, the caller still sees an error with the
// data already gone (fail toward MORE erasure, never leaving the account alive
// while data lingers). Every DB delete is scoped to this user_id.
//
// NOT reachable from here (reported to the caller, not silently ignored): the
// user's client-side localStorage/sessionStorage on their own device (only
// clearable in that browser — see the client helper), and anything already sent
// to sub-processors (Anthropic prompt cache/logs, OpenAI image inputs, Resend
// feedback emails, Vercel Analytics events), which are governed by each
// provider's own retention, not by our code.
export async function deleteAllUserContext(userId: string): Promise<void> {
  if (!userId) throw new Error("deleteAllUserContext: missing userId");

  await Promise.all([
    deleteAllUserData(userId),
    deleteAllContextFacts(userId),
    deleteAllFeedback(userId),
    deleteAllModuleFeedback(userId),
    deleteAllBaselineSurvey(userId),
  ]);

  // Account last: deleting the Clerk user invalidates their sessions and removes
  // the identity record (email, name) Clerk holds.
  const client = await clerkClient();
  await client.users.deleteUser(userId);
}
