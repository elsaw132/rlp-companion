import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getActivePairingFor, getShareSelections } from "@/lib/db";
import ShareStep from "@/app/components/partner/ShareStep";

// The single entry point for "Plan with your partner" (module 5.1). It resolves
// the pairing and each side's completion (cheap DB reads only — no LLM in the
// render path) and shows the right surface:
//   - neither/only-me not yet done  -> the share step
//   - I'm done, partner isn't        -> the waiting state (Phase 4)
//   - both done                      -> the comparison view (Phase 3)
// Someone with no active pairing never had the module activated for them, so
// they go back to the dashboard.
export const dynamic = "force-dynamic";

export default async function PartnerPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const pairing = await getActivePairingFor(userId);
  if (!pairing) redirect("/home");

  const selections = await getShareSelections(pairing.id);
  const mine = selections.find((s) => s.participantId === userId) ?? null;
  const partnerId =
    pairing.participantAId === userId
      ? pairing.participantBId
      : pairing.participantAId;
  const partner = selections.find((s) => s.participantId === partnerId) ?? null;

  const iCompleted = Boolean(mine?.completedAt);
  const partnerCompleted = Boolean(partner?.completedAt);

  if (iCompleted && partnerCompleted) {
    // TODO(Phase 3): the comparison view.
    return <Placeholder title="Bringing your plans together" note="The comparison view is coming in the next step of the build." />;
  }
  if (iCompleted && !partnerCompleted) {
    // TODO(Phase 4): the real waiting state (interlocking-circles motif).
    return <Placeholder title="You're all set." note="We'll open your shared view here as soon as your partner has done the same — pop back any time to check." />;
  }

  return <ShareStep />;
}

// Minimal stand-in for the surfaces built in later phases, so routing works and
// is testable now. Replaced wholesale in Phases 3 and 4.
function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <main
      style={{
        maxWidth: 460,
        margin: "0 auto",
        padding: "64px 22px",
        textAlign: "center",
        fontFamily: "var(--font-sans)",
        color: "var(--text)",
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "var(--fs-h2)",
          color: "var(--ink)",
          margin: "0 0 10px",
        }}
      >
        {title}
      </h1>
      <p style={{ color: "var(--text-muted)", lineHeight: "var(--lh-body)" }}>
        {note}
      </p>
    </main>
  );
}
