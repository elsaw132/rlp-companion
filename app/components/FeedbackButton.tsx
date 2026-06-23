"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// The global feedback affordance: a fixed bottom-right pill that opens a small
// in-app panel. Testers stay inside the app — no WhatsApp, no mail client, no
// install. On Send it POSTs to /api/feedback, which records the message (with
// the page it came from) in the database. Built entirely from design tokens.

type Status = "idle" | "sending" | "done" | "error";

export default function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus the message box when the panel opens, and let Escape close it.
  useEffect(() => {
    if (!open) return;
    textareaRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    // Reset after the panel is gone so the closing view doesn't flash empty.
    setTimeout(() => {
      setMessage("");
      setReplyEmail("");
      setStatus("idle");
    }, 150);
  }

  async function send() {
    if (message.trim().length === 0 || status === "sending") return;
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          replyEmail,
          page: pathname,
        }),
      });
      if (!res.ok) throw new Error("send failed");
      setStatus("done");
      // Let testers read the confirmation, then tidy up.
      setTimeout(close, 1600);
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <style>{fbStyles}</style>

      {/* The floating launcher — present on every screen. */}
      <button
        type="button"
        className="fb-launch"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        style={styles.launch}
      >
        <span aria-hidden="true">💬</span> Feedback
      </button>

      {open && (
        <div
          style={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-label="Send feedback"
          onClick={close}
        >
          <div
            style={styles.panel}
            onClick={(e) => e.stopPropagation()}
          >
            {status === "done" ? (
              <div style={styles.doneWrap}>
                <p style={styles.doneTitle}>
                  <span aria-hidden="true">✓</span> Thanks — got it
                </p>
                <p style={styles.doneBody}>
                  Your note has reached us. We read every one.
                </p>
              </div>
            ) : (
              <>
                <div style={styles.header}>
                  <h2 style={styles.title}>Send feedback</h2>
                  <button
                    type="button"
                    className="fb-close"
                    aria-label="Close"
                    onClick={close}
                    style={styles.closeBtn}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>

                <p style={styles.intro}>
                  Tell us anything — what worked, what didn&rsquo;t, what
                  confused you.
                </p>

                <label htmlFor="fb-message" style={styles.label}>
                  Your feedback
                </label>
                <textarea
                  id="fb-message"
                  ref={textareaRef}
                  className="fb-field"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder="Type your thoughts here…"
                  style={styles.textarea}
                />

                <label htmlFor="fb-email" style={styles.label}>
                  Your email, if you&rsquo;d like a reply{" "}
                  <span style={styles.optional}>(optional)</span>
                </label>
                <input
                  id="fb-email"
                  className="fb-field"
                  type="email"
                  value={replyEmail}
                  onChange={(e) => setReplyEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={styles.input}
                />

                {status === "error" && (
                  <p role="alert" style={styles.error}>
                    There&rsquo;s been an issue sending this message. Please
                    email{" "}
                    <a href="mailto:elsa@chorus-life.com" style={styles.errorLink}>
                      elsa@chorus-life.com
                    </a>{" "}
                    with your feedback instead.
                  </p>
                )}

                <button
                  type="button"
                  className="fb-send"
                  onClick={send}
                  disabled={
                    message.trim().length === 0 || status === "sending"
                  }
                  style={styles.send}
                >
                  {status === "sending" ? "Sending…" : "Send →"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  launch: {
    position: "fixed",
    right: "22px",
    bottom: "22px",
    background: "var(--surface)",
    color: "var(--brand-primary)",
    border: "1.5px solid var(--border-strong)",
    borderRadius: "var(--r-pill)",
    padding: "11px 18px",
    fontFamily: "var(--font-sans)",
    fontSize: "13px",
    fontWeight: 600,
    boxShadow: "var(--shadow-sm)",
    display: "flex",
    alignItems: "center",
    gap: "7px",
    cursor: "pointer",
    zIndex: 60,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.35)",
    display: "grid",
    placeItems: "end",
    padding: "22px",
    zIndex: 70,
  },
  panel: {
    background: "var(--bg)",
    borderRadius: "var(--r-lg)",
    boxShadow: "var(--shadow-md)",
    padding: "24px",
    width: "100%",
    maxWidth: "420px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  title: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-title)",
    fontWeight: 600,
    color: "var(--ink)",
    margin: 0,
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "var(--text-muted)",
    fontSize: "24px",
    lineHeight: 1,
    width: "44px",
    height: "44px",
    marginRight: "-10px",
    marginTop: "-10px",
    cursor: "pointer",
    borderRadius: "var(--r-sm)",
    flexShrink: 0,
  },
  intro: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    color: "var(--text)",
    margin: "0 0 4px",
  },
  label: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-label)",
    fontWeight: 600,
    color: "var(--text)",
    marginTop: "4px",
  },
  optional: {
    fontWeight: 500,
    color: "var(--text-muted)",
  },
  textarea: {
    width: "100%",
    minHeight: "120px",
    resize: "vertical",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--ink)",
    background: "var(--surface)",
    border: "1.5px solid var(--border-strong)",
    borderRadius: "var(--r-sm)",
    padding: "12px 14px",
    boxSizing: "border-box",
  },
  input: {
    width: "100%",
    minHeight: "48px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    color: "var(--ink)",
    background: "var(--surface)",
    border: "1.5px solid var(--border-strong)",
    borderRadius: "var(--r-sm)",
    padding: "12px 14px",
    boxSizing: "border-box",
  },
  error: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--accent-strong)",
    margin: "2px 0 0",
    lineHeight: "var(--lh-body)",
  },
  errorLink: {
    color: "var(--accent-strong)",
    fontWeight: 600,
    textDecoration: "underline",
  },
  send: {
    width: "100%",
    minHeight: "48px",
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    border: "none",
    borderRadius: "var(--r-sm)",
    padding: "13px 20px",
    cursor: "pointer",
    marginTop: "8px",
  },
  doneWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px 0",
  },
  doneTitle: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-h2)",
    fontWeight: 600,
    color: "var(--success-text)",
    margin: 0,
  },
  doneBody: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    color: "var(--text)",
    margin: 0,
  },
};

// Hover, focus rings and placeholder colour can't be expressed inline, so they
// live here. Scoped to fb- classes; uses the same tokens as everything else.
const fbStyles = `
  .fb-launch:hover { background: #000; }
  .fb-launch:focus-visible,
  .fb-close:focus-visible,
  .fb-send:focus-visible,
  .fb-field:focus-visible,
  .fb-field:focus {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .fb-field:focus { border-color: var(--brand-primary); }
  .fb-field::placeholder { color: var(--text-faint); }
  .fb-close:hover { background: var(--bg-alt); color: var(--ink); }
  .fb-send:hover:not(:disabled) { background: var(--brand-primary-hover); }
  .fb-send:disabled { opacity: 0.55; cursor: default; }
`;
