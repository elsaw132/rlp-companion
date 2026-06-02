import SessionContainer from "../../components/SessionContainer";

const DUMMY_CONTENT =
  "Most people picture retirement as a single event — a date in the diary, a " +
  "leaving card, the last commute. But it's really a long stretch of ordinary " +
  "days, and what fills those days is yours to decide. As you read, notice " +
  "which part of it you find yourself lingering on.";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg-alt)" }}>
      <SessionContainer
        sessionId={id}
        stageNumber={1}
        totalStages={5}
        stageName="Imagine"
        modulesInStage={6}
        modulesCompleted={1}
        sessionTitle="Your everyday, reimagined"
        sessionDescription="A short read, then a conversation about the shape of your days."
        contentType="text"
        contentValue={DUMMY_CONTENT}
        coachOpening="Good to be back. Which part of that did you find yourself lingering on?"
      />
    </main>
  );
}
