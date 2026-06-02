"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import DayBuilder from "./DayBuilder";
import type { Interaction } from "@/lib/modules";

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
  durationMin: number;
  contentType: ContentType;
  contentValue: string;
  coachOpening: string;
  // Wired into the page in a later step. Until then sessionContent falls back
  // to contentValue and there are no module-specific instructions.
  sessionContent?: string;
  sessionInstructions?: string;
  // Optional build step shown between the reading and the conversation. When
  // absent, the module keeps the plain reading → conversation flow.
  interaction?: Interaction;
};

const COACH_ERROR_REPLY =
  "Sorry — something went wrong reaching Vita. Please try again in a moment.";

type OnboardingAnswers = {
  partner?: string;
  horizon?: string;
  motivation?: string | null;
};

// Turn the saved onboarding answers into a short sentence Vita can read.
function buildOnboardingContext(userId?: string): string {
  if (!userId) return "Nothing recorded yet.";

  let answers: OnboardingAnswers = {};
  try {
    const raw = localStorage.getItem(`rlp_onboarding_${userId}`);
    if (raw) answers = JSON.parse(raw) as OnboardingAnswers;
  } catch {
    return "Nothing recorded yet.";
  }

  const parts: string[] = [];

  if (answers.partner === "Me and my partner") {
    parts.push("They're planning their retirement with a partner");
  } else if (answers.partner === "Just me") {
    parts.push("They're planning their retirement on their own");
  }

  if (answers.horizon === "Not sure") {
    parts.push("they're not yet sure how far off retirement is");
  } else if (answers.horizon) {
    parts.push(`retirement is roughly ${answers.horizon} away`);
  }

  let sentence = parts.length ? parts.join(", ") + "." : "";

  if (answers.motivation) {
    sentence += `${sentence ? " " : ""}What prompted them to start: ${answers.motivation.toLowerCase()}.`;
  }

  return sentence.trim() || "Nothing recorded yet.";
}

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
  durationMin,
  contentType,
  contentValue,
  coachOpening,
  sessionContent,
  sessionInstructions,
  interaction,
}: SessionContainerProps) {
  const { user } = useUser();

  // Where the person is in the module: the reading, the build step (only for
  // modules with an interaction), then the conversation.
  const [phase, setPhase] = useState<"reading" | "building" | "conversation">(
    "reading"
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Readable summary of what they built in the interaction step, sent to Vita.
  const [buildSummary, setBuildSummary] = useState<string | null>(null);

  const storageKey = user ? `rlp_session_${user.id}_${sessionId}` : null;
  const buildKey = user ? `rlp_build_${user.id}_${sessionId}` : null;

  // Load any saved conversation and built day as soon as the user (and so the
  // key) is known. We read during render rather than in an effect so the first
  // paint already has the saved state — no empty-then-refill second render. The
  // setLoadedKey guard makes this run exactly once per key. localStorage is
  // browser-only, so skip it during server rendering.
  if (
    storageKey &&
    buildKey &&
    storageKey !== loadedKey &&
    typeof window !== "undefined"
  ) {
    setLoadedKey(storageKey);

    let savedBuild: string | null = null;
    try {
      savedBuild = localStorage.getItem(buildKey);
    } catch {
      savedBuild = null;
    }
    if (savedBuild) setBuildSummary(savedBuild);

    try {
      const raw = localStorage.getItem(storageKey);
      const saved = raw ? (JSON.parse(raw) as Message[]) : null;
      if (Array.isArray(saved) && saved.length > 0) {
        // A conversation is already underway — resume it.
        setMessages(saved);
        setPhase("conversation");
      } else if (savedBuild) {
        // They finished the build last time but hadn't started talking — seed
        // Vita's opening and drop them into the conversation.
        setMessages([{ role: "coach", text: coachOpening }]);
        setPhase("conversation");
      }
    } catch {
      // ignore corrupt data — start fresh
    }
  }

  // Persist the conversation after every change, but only once we've loaded any
  // existing conversation for this key (otherwise we'd overwrite it with []).
  useEffect(() => {
    if (!storageKey || storageKey !== loadedKey) return;
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, storageKey, loadedKey]);

  // Seed Vita's opening as the first bubble and show the conversation.
  function startConversation() {
    setPhase("conversation");
    setMessages((prev) =>
      prev.length === 0 ? [{ role: "coach", text: coachOpening }] : prev
    );
  }

  // After the reading: modules with an interaction go to the build step first;
  // everything else goes straight to the conversation.
  function handleReadingDone() {
    if (interaction) {
      setPhase("building");
    } else {
      startConversation();
    }
  }

  // The person finished the build step. Save the summary so a refresh keeps it,
  // then open the conversation.
  function handleBuildFinish(summary: string) {
    setBuildSummary(summary);
    if (buildKey) localStorage.setItem(buildKey, summary);
    startConversation();
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    const conversation: Message[] = [...messages, { role: "user", text }];
    setMessages(conversation);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversation,
          coachOpening,
          sessionInstructions: sessionInstructions ?? "",
          onboardingContext: buildOnboardingContext(user?.id),
          priorReflections: "No earlier modules completed yet.",
          sessionContent: sessionContent ?? contentValue,
          interactionSummary: buildSummary ?? "",
        }),
      });

      if (!res.ok) throw new Error(`Chat request failed: ${res.status}`);

      const data = (await res.json()) as { reply: string };
      setMessages([...conversation, { role: "coach", text: data.reply }]);
    } catch {
      // Roll the user's bubble back off the conversation and hand their words
      // back to the composer, so retrying is clean. The error is a transient
      // notice only — never added to the conversation or saved to localStorage,
      // so it can't be replayed to the API as one of Vita's turns.
      setMessages(messages);
      setInput(text);
      setError(COACH_ERROR_REPLY);
    } finally {
      setSending(false);
    }
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
            {durationMin} min
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

        {phase === "reading" && (
          <div style={styles.gateRow}>
            <button
              type="button"
              className="primary-btn"
              style={styles.primaryButton}
              onClick={handleReadingDone}
            >
              {gateLabel}
            </button>
          </div>
        )}
      </section>

      {/* ZONE 2.5 — INTERACTION (only modules that have one) */}
      {phase === "building" && interaction && (
        <InteractionStep
          interaction={interaction}
          onFinish={handleBuildFinish}
        />
      )}

      {/* ZONE 3 — VITA + CONVERSATION */}
      {phase === "conversation" && (
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
            {sending && <TypingBubble />}
          </div>

          {error && (
            <div style={styles.errorNotice} role="status">
              {error}
            </div>
          )}

          <div style={styles.composer}>
            <input
              type="text"
              className="composer-input"
              style={styles.input}
              placeholder="Type your message…"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (error) setError(null);
              }}
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

// Picks the right interaction UI for the module's interaction type. New types
// get a case here; until then they fall back to a harmless placeholder so a
// half-configured module never breaks the screen.
function InteractionStep({
  interaction,
  onFinish,
}: {
  interaction: Interaction;
  onFinish: (summary: string) => void;
}) {
  switch (interaction.type) {
    case "day-builder":
      return <DayBuilder interaction={interaction} onFinish={onFinish} />;
    default:
      return (
        <section style={styles.placeholderStep}>[interaction coming soon]</section>
      );
  }
}

function CoachBubble({ text }: { text: string }) {
  return (
    <div style={styles.coachRow}>
      <div style={styles.coachBubble}>{text}</div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div style={styles.coachRow}>
      <div style={{ ...styles.coachBubble, ...styles.typingBubble }}>
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
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

  placeholderStep: {
    paddingTop: "36px",
    marginTop: "8px",
    borderTop: "1px solid var(--border)",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
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
  typingBubble: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "18px",
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
  errorNotice: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    margin: "0 2px -6px",
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
  .typing-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--text-muted);
    display: inline-block;
    animation: typing-bounce 1.2s infinite ease-in-out;
  }
  .typing-dot:nth-child(2) { animation-delay: 0.15s; }
  .typing-dot:nth-child(3) { animation-delay: 0.3s; }
  @keyframes typing-bounce {
    0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
    30% { opacity: 1; transform: translateY(-3px); }
  }
`;
