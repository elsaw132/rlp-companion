import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import AdminSignOut from "../AdminSignOut";

// Where a signed-in but non-allowlisted user lands when they hit an admin route.
// The route is under /admin, so the middleware has already required sign-in —
// anyone here is signed in, just not an admin. Friendlier than a bare 404: it
// explains the situation, offers a way back to the app, and (since they may be
// signed in under the wrong email) a way to sign out and switch accounts.
//
// Not admin-gated itself — that's the point; it's the page non-admins are sent
// to. It exposes no member data.
export const dynamic = "force-dynamic";

const ADMIN_CONTACT = "elsa@chorus-life.com";

export default async function AdminNoAccessPage() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <p style={styles.eyebrow}>Admin</p>
        <h1 style={styles.h1}>You don&apos;t have admin access</h1>

        <p style={styles.body}>
          Sorry, you don&apos;t have admin access. Please contact{" "}
          <a href={`mailto:${ADMIN_CONTACT}`} style={styles.link}>
            {ADMIN_CONTACT}
          </a>{" "}
          if that doesn&apos;t seem correct.
        </p>

        <p style={styles.body}>
          If you were looking for the retirement coaching app, you can access it
          here:
        </p>

        <Link href="/home" style={styles.homeBtn}>
          Go to the app
        </Link>

        {email && (
          <p style={styles.signedIn}>
            You&apos;re signed in as <strong>{email}</strong>. If your admin
            account uses a different email, sign out and sign back in with it.
          </p>
        )}

        <div style={styles.signOutRow}>
          <AdminSignOut label="Sign out / use a different account" variant="ghost" />
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg)",
    color: "var(--text)",
    fontFamily: "var(--font-sans)",
    padding: "40px 20px",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-lg)",
    boxShadow: "var(--shadow-sm)",
    padding: "32px 30px",
  },
  eyebrow: {
    fontSize: "var(--fs-eyebrow)",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    margin: 0,
  },
  h1: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-title)",
    margin: "6px 0 16px",
  },
  body: {
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--text)",
    margin: "0 0 14px",
  },
  link: { color: "var(--brand-primary)" },
  homeBtn: {
    display: "inline-block",
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    textDecoration: "none",
    fontWeight: 600,
    fontSize: "var(--fs-body)",
    borderRadius: "var(--r-sm)",
    padding: "12px 22px",
    marginTop: 2,
  },
  signedIn: {
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    lineHeight: "var(--lh-body)",
    margin: "24px 0 0",
    paddingTop: 20,
    borderTop: "1px solid var(--border)",
  },
  signOutRow: { marginTop: 14 },
};
