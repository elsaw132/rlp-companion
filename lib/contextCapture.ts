import "server-only";
import {
  type DraftFact,
  type ConversationalDeltas,
  type FactProvenanceSource,
  type PendingRemoval,
  diffFacts,
  planConversationalApply,
} from "@/lib/contextFacts";
import { activeFacts, addFact, rejectFact } from "@/lib/db";

// Server-side capture orchestration. Every operation reconciles the stored facts
// to a desired set rather than blindly appending, so the same code path serves
// both first capture and a re-edit: a pick that disappears is detected and
// rejected, not silently left behind. All writes are atomic per row.

// Reconcile the facts a module produced to match `desired`, scoped to one
// provenance source so a widget reconcile never disturbs conversational facts
// (and vice versa). New picks are added; picks that vanished are rejected.
export async function reconcileModuleFacts(
  userId: string,
  moduleId: string,
  desired: DraftFact[],
  source: FactProvenanceSource
): Promise<{ added: number; rejected: number }> {
  const existing = (await activeFacts(userId, { provenanceModule: moduleId })).filter(
    (f) => f.provenanceSource === source
  );

  const { toAdd, toRemoveIds } = diffFacts(desired, existing);

  await Promise.all([
    ...toAdd.map((d) => addFact(userId, d)),
    ...toRemoveIds.map((id) => rejectFact(userId, id)),
  ]);

  return { added: toAdd.length, rejected: toRemoveIds.length };
}

// Apply conversational deltas (the correction loop). Additions that duplicate an
// active fact are dropped; removals are rejected only once confirmed — either the
// model flagged the correction confirmed in chat, or its identity is in
// `confirmedRemovalKeys`. Unconfirmed removals come back as `pending` so the UI
// can have Vita acknowledge them before anything is dropped.
export async function applyConversationalDeltas(
  userId: string,
  moduleId: string,
  deltas: ConversationalDeltas,
  confirmedRemovalKeys: string[] = []
): Promise<{ added: number; rejected: number; pending: PendingRemoval[] }> {
  const existing = await activeFacts(userId, { provenanceModule: moduleId });
  const { toAdd, toRejectIds, pending } = planConversationalApply(
    moduleId,
    deltas,
    existing,
    new Set(confirmedRemovalKeys)
  );

  await Promise.all([
    ...toAdd.map((d) => addFact(userId, d)),
    ...toRejectIds.map((id) => rejectFact(userId, id)),
  ]);

  return { added: toAdd.length, rejected: toRejectIds.length, pending };
}
