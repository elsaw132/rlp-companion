"use client";

import { useClerk } from "@clerk/nextjs";

// The admin area's own sign-out control. Signing out lands on /sign-in, so it
// doubles as "switch account" — the quickest way for someone signed in under
// the wrong email to get back to an admin one. Used both on the portal header
// and on the no-access page.
export default function AdminSignOut({
  label = "Sign out",
  variant = "ghost",
}: {
  label?: string;
  variant?: "solid" | "ghost";
}) {
  const { signOut } = useClerk();
  const style = variant === "solid" ? styles.solid : styles.ghost;
  return (
    <button
      type="button"
      style={style}
      onClick={() => void signOut({ redirectUrl: "/sign-in" })}
    >
      {label}
    </button>
  );
}

const base: React.CSSProperties = {
  appearance: "none",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--fs-sm)",
  fontWeight: 600,
  borderRadius: "var(--r-pill)",
  padding: "9px 16px",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const styles: Record<string, React.CSSProperties> = {
  solid: {
    ...base,
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    border: "none",
  },
  ghost: {
    ...base,
    background: "var(--surface)",
    color: "var(--brand-primary)",
    border: "1.5px solid var(--border-strong)",
  },
};
