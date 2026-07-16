import type { Metadata } from "next";
import DeleteAccountView from "./DeleteAccountView";

// The shareable self-service "delete all my data" page. It lives behind the
// Clerk middleware like every non-public route, so a logged-out visitor
// following the shared link is sent to sign in first and returned here — which
// is what we want: we can only delete the person we can identify. The actual
// deletion is gated behind an explicit confirmation in DeleteAccountView.
export const metadata: Metadata = {
  title: "Delete your data — Chorus Life",
};

export default function DeleteAccountPage() {
  return <DeleteAccountView />;
}
