"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";

type ContentType = "text" | "video";

type Message = {
  role: "coach" | "user";
  text: string;
};

type SessionContainerProps = {
  sessionId: string;
  stageNumber: number;
  totalStages: number;
  stageName: string;
  modulesInStage: number;
  modulesCompleted: number;
  sessionTitle: string;
  sessionDescription: string;
  contentType: ContentType;
  contentValue: string;
  coachOpening: string;
};

const COACH_PLACEHOLDER_REPLY = "[coach reply will go here]";

// No duration prop exists yet — placeholder until one is added.
const PLACEHOLDER_DURATION = "5 min";

function youtubeEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    let id = "";
    if (u.hostname.includes("youtu.be")) {
      id = u.pathname.slice(1);
    } else if (u.searchParams.get("v")) {
      id = u.searchParams.get("v") ?? "";
    } else if (u.pathname.includes("/embed/")) {
      id = u.pathname.split("/embed/")[1] ?? "";
    }
    return id ? `https://www.youtube.com/embed/${id}` : url;
  } catch {
    return url;
  }
}

export default function SessionContainer({
  sessionId,
  stageNumber,
  totalStages,
  stageName,
  modulesInStage,
  modulesCompleted,
  sessionTitle,
  sessionDescription,
  contentType,
  contentValue,
  coachOpening,
}: SessionContainerProps) {
  const { user } = useUser();

  const [revealed, setRevealed] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loaded, setLoaded] = useState(false);

  const storageKey = user ? `rlp_session_${user.id}_${sessionId}` : null;

  // Load any saved conversation once the user is known.
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as Message[];
        if (Array.isArray(saved) && saved.length > 0) {
          setMessages(saved);
          setRevealed(true);
        }
      }
    } catch {
      // ignore corrupt data — start fresh
    }
    setLoaded(true);
  }, [storageKey]);

  // Persist the conversation after every change.
  useEffect(() => {
    if (!storageKey || !loaded) return;
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, storageKey, loaded]);

  // Open the conversation, seeding Vita's opening as the first bubble.
  function handleReveal() {
    setRevealed(true);
    setMessages((prev) =>
      prev.length === 0 ? [{ role: "coach", text: coachOpening }] : prev
    );
  }

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", text },
      { role: "coach", text: COACH_PLACEHOLDER_REPLY },
    ]);
    setInput("");
  }

  const isVideo = contentType === "video";
  const labelIcon = isVideo ? "🎬" : "📖";
  const labelText = isVideo ? "Watch this" : "Read this";
  const gateLabel = isVideo ? "I've watched this →" : "I've read this →";

  return (
    <div style={styles.container}>
      <style>{focusCss}</style>

      {/* ZONE 1 — PROGRAMME HEADER */}
      <header style={styles.header}>
        <div style={styles.stageLine}>
          Stage {stageNumber} of {totalStages} · {stageName}
        </div>
        <div style={styles.progress}>
          <div style={styles.progressLabel}>
            {modulesCompleted} of {modulesInStage} modules complete
          </div>
          <div style={styles.progressTrack}>
            <div
              style={{
                ...styles.progressFill,
                width: `${
                  modulesInStage > 0
                    ? Math.min(100, (modulesCompleted / modulesInStage) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
        <h1 style={styles.title}>{sessionTitle}</h1>
        {sessionDescription && (
          <p style={styles.description}>{sessionDescription}</p>
        )}
      </header>

      {/* ZONE 2 — CONTENT */}
      <section style={styles.contentCard}>
        <div style={styles.labelRow}>
          <span style={styles.contentLabel}>
            <span aria-hidden="true">{labelIcon}</span>
            {labelText}
          </span>
          <span style={styles.durationChip}>
            <span aria-hidden="true">🕐</span>
            {PLACEHOLDER_DURATION}
          </span>
        </div>

        {isVideo ? (
          <div style={styles.videoFrame}>
            <iframe
              src={youtubeEmbedUrl(contentValue)}
              title={sessionTitle || "Session video"}
              style={styles.videoIframe}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <p style={styles.bodyText}>{contentValue}</p>
        )}

        {!revealed && (
          <div style={styles.gateRow}>
            <button
              type="button"
              className="primary-btn"
              style={styles.primaryButton}
              onClick={handleReveal}
            >
              {gateLabel}
            </button>
          </div>
        )}
      </section>

      {/* ZONE 3 — VITA + CONVERSATION */}
      {revealed && (
        <section style={styles.conversationZone}>
          <div style={styles.vitaLockup}>
            <span style={styles.sun} aria-hidden="true">
              ☀️
            </span>
            <span style={styles.vitaName}>Vita</span>
            <span style={styles.coachPill}>Your retirement coach</span>
          </div>

          <div style={styles.messageList}>
            {messages.map((m, i) =>
              m.role === "coach" ? (
                <CoachBubble key={i} text={m.text} />
              ) : (
                <UserBubble key={i} text={m.text} />
              )
            )}
          </div>

          <div style={styles.composer}>
            <input
              type="text"
              className="composer-input"
              style={styles.input}
              placeholder="Type your message…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
            />
            <button
              type="button"
              className="send-btn"
              style={styles.sendButton}
              onClick={handleSend}
            >
              Send →
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function CoachBubble({ text }: { text: string }) {
  return (
    <div style={styles.coachRow}>
      <div style={styles.coachBubble}>{text}</div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div style={styles.userRow}>
      <div style={styles.userBubble}>{text}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "100%",
    maxWidth: "var(--content-max)",
    margin: "0 auto",
    padding: "48px 24px",
    display: "flex",
    flexDirection: "column",
    gap: "32px",
  },

  // ZONE 1 — programme header
  header: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  stageLine: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 500,
    color: "var(--text-muted)",
  },
  progress: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "6px",
  },
  progressLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 500,
    color: "var(--text-muted)",
  },
  progressTrack: {
    width: "100%",
    height: "6px",
    background: "var(--border)",
    borderRadius: "var(--r-pill)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "var(--brand-primary)",
    borderRadius: "var(--r-pill)",
  },
  title: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-display)",
    fontWeight: 600,
    color: "var(--ink)",
    lineHeight: 1.2,
    margin: 0,
  },
  description: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 500,
    color: "var(--text-muted)",
    margin: 0,
  },

  // ZONE 2 — content card
  contentCard: {
    background: "var(--bg)",
    border: "0.5px solid var(--border)",
    borderRadius: "var(--r-lg)",
    padding: "24px",
    boxShadow: "var(--shadow-sm)",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  labelRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  contentLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 500,
    color: "var(--text-muted)",
  },
  durationChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-pill)",
    padding: "4px 11px",
    fontFamily: "var(--font-sans)",
    fontSize: "13px",
    color: "var(--text-muted)",
  },
  bodyText: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--text)",
    margin: 0,
  },
  videoFrame: {
    position: "relative",
    width: "100%",
    aspectRatio: "16 / 9",
    borderRadius: "var(--r-sm)",
    overflow: "hidden",
  },
  videoIframe: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    border: "none",
  },
  gateRow: {
    display: "flex",
    justifyContent: "flex-start",
    marginTop: "2px",
  },
  primaryButton: {
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    border: "none",
    borderRadius: "var(--r-sm)",
    padding: "13px 24px",
    minHeight: "48px",
    cursor: "pointer",
  },

  // ZONE 3 — Vita + conversation
  conversationZone: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    paddingTop: "36px",
    marginTop: "8px",
    borderTop: "1px solid var(--border)",
  },
  vitaLockup: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
  },
  sun: {
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    background: "var(--sun)",
    display: "grid",
    placeItems: "center",
    fontSize: "17px",
    flexShrink: 0,
  },
  vitaName: {
    fontFamily: "var(--font-serif)",
    fontSize: "19px",
    fontWeight: 600,
    color: "var(--ink)",
  },
  coachPill: {
    background: "var(--coach-pill)",
    color: "var(--coach-pill-text)",
    fontFamily: "var(--font-sans)",
    fontSize: "12px",
    fontWeight: 700,
    padding: "5px 11px",
    borderRadius: "var(--r-sm)",
  },
  messageList: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  coachRow: {
    display: "flex",
    justifyContent: "flex-start",
  },
  coachBubble: {
    background: "var(--warm-surface)",
    color: "var(--ink)",
    border: "1px solid var(--warm-line)",
    borderRadius: "18px 18px 18px 4px",
    padding: "16px 18px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    maxWidth: "85%",
    textAlign: "left",
  },
  userRow: {
    display: "flex",
    justifyContent: "flex-end",
  },
  userBubble: {
    background: "var(--bg)",
    color: "var(--text)",
    border: "1.5px solid var(--border-strong)",
    borderRadius: "18px 18px 4px 18px",
    padding: "14px 18px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    maxWidth: "380px",
  },
  composer: {
    display: "flex",
    gap: "12px",
    alignItems: "stretch",
    marginTop: "4px",
  },
  input: {
    flex: 1,
    background: "var(--bg)",
    border: "1.5px solid var(--border-strong)",
    borderRadius: "var(--r-sm)",
    padding: "13px 16px",
    minHeight: "48px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    color: "var(--text)",
    outline: "none",
  },
  sendButton: {
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    border: "none",
    borderRadius: "var(--r-sm)",
    padding: "13px 24px",
    minHeight: "48px",
    cursor: "pointer",
    flexShrink: 0,
  },
};

const focusCss = `
  .primary-btn:hover, .send-btn:hover { background: var(--brand-primary-hover); }
  .primary-btn:focus-visible,
  .send-btn:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .composer-input:focus-visible {
    border-color: var(--brand-primary);
    box-shadow: var(--focus-ring);
  }
`;
