import ProviderBand from "../components/ProviderBand";
import PostCompletionSurvey from "../components/PostCompletionSurvey";

// The post-completion survey — the one-time "after" survey a member sees once
// their plan is complete. Reached from the dashboard card and from the survey
// email. The component itself handles the gates (not-finished / already-done).
export default function PlanSurveyPage() {
  return (
    <>
      <ProviderBand />
      <PostCompletionSurvey />
    </>
  );
}
