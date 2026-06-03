"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import DayBuilder, {
  DayBuilderSummary,
  dayBuilderSummaryText,
} from "./DayBuilder";
import RolePicker, {
  RolePickerSummary,
  rolePickerSummaryText,
} from "./RolePicker";
import Sliders, { SlidersSummary, slidersSummaryText } from "./Sliders";
import KeepLeaveGain, {
  KeepLeaveGainSummary,
  keepLeaveGainSummaryText,
} from "./KeepLeaveGain";
import QualitiesPicker, {
  QualitiesPickerSummary,
  qualitiesPickerSummaryText,
} from "./QualitiesPicker";
import type { InteractionMode } from "./InteractionShell";
import type { ContentBlock, Interaction, BuildResult } from "@/lib/modules";
import { useUserData } from "@/lib/userData";

// Vita appends this to her closing message so we know the module is finished.
// It's stripped before display and before storage, so it never shows and never
// re-enters the conversation history.
const MODULE_COMPLETE_MARKER = "[[MODULE_COMPLETE]]";

// A hidden user turn that only exists to make Vita speak first when generating
// her dynamic opening. It is never rendered as a bubble or saved — it lives in
// the API request alone.
const OPENING_PRIMER = "(I've just finished the activity — please open.)";

// The readable sentence Vita reads, derived from whatever they built. Switches
// on interaction type so each future type can describe its own result.
function summarizeBuild(result: BuildResult): string {
  switch (result.type) {
    case "day-builder":
      return dayBuilderSummaryText(result);
    case "role-picker":
      return rolePickerSummaryText(result);
    case "sliders":
      return slidersSummaryText(result);
    case "keep-leave-gain":
      return keepLeaveGainSummaryText(result);
    case "qualities-picker":
      return qualitiesPickerSummaryText(result);
    default:
      return "";
  }
}

// The read-only recap shown above Vita's first message, kept visible for the
// whole conversation. Switches on type, like the interaction renderer; the
// neutral card wrapper is shared across types.
function InteractionSummary({
  result,
  onEdit,
}: {
  result: BuildResult;
  onEdit: () => void;
}) {
  let body: React.ReactNode;
  switch (result.type) {
    case "day-builder":
      body = <DayBuilderSummary result={result} />;
      break;
    case "role-picker":
      body = <RolePickerSummary result={result} />;
      break;
    case "sliders":
      body = <SlidersSummary result={result} />;
      break;
    case "keep-leave-gain":
      body = <KeepLeaveGainSummary result={result} />;
      break;
    case "qualities-picker":
      body = <QualitiesPickerSummary result={result} />;
      break;
    default:
      body = null;
  }
  return (
    <section style={styles.summaryCard}>
      {body}
      <button
        type="button"
        className="edit-link"
        style={styles.editLink}
        onClick={onEdit}
      >
        Edit your selections ›
      </button>
    </section>
  );
}

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
  // Module ids in this stage, used to count how many are complete.
  stageModuleIds: string[];
  // Where the in-conversation "Next module →" button goes once finished.
  nextHref: string;
  sessionTitle: string;
  sessionDescription: string;
  durationMin: number;
  // The primer shown before the conversation, as ordered text/video blocks.
  primer: ContentBlock[];
  coachOpening: string;
  // Wired into the page in a later step. Until then sessionContent falls back
  // to the primer's text, and there are no module-specific instructions.
  sessionContent?: string;
  sessionInstructions?: string;
  // Optional build step shown between the reading and the conversation. When
  // absent, the module keeps the plain reading → conversation flow.
  interaction?: Interaction;
};

const COACH_ERROR_REPLY =
  "Sorry — something went wrong reaching Vita. Please try again in a moment.";

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
  stageModuleIds,
  nextHref,
  sessionTitle,
  sessionDescription,
  durationMin,
  primer,
  coachOpening,
  sessionContent,
  sessionInstructions,
  interaction,
}: SessionContainerProps) {
  const { user } = useUser();
  const userData = useUserData();

  // The readable text Vita draws on — the primer's text blocks, joined. Video
  // blocks have no readable text, so they're skipped.
  const primerText = primer
    .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.value)
    .join("\n\n");

  // Where the person is in the module: the reading, the build step (only for
  // modules with an interaction), the conversation, then optionally back into
  // "editing" to adjust earlier picks without losing the conversation.
  const [phase, setPhase] = useState<
    "reading" | "building" | "conversation" | "editing"
  >("reading");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  // Flips true once we've read this module's saved state out of the snapshot, so
  // the persist effect can't overwrite a saved conversation with an empty one
  // before hydration.
  const [hydrated, setHydrated] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards the one-time dynamic-opening call so it can't fire twice (e.g. under
  // React's double-invoked effects in development).
  const openingRequested = useRef(false);
  // What they built in the interaction step — shown back to them and summarised
  // for Vita.
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null);
  // Set when the person saves changed selections mid-conversation. The next
  // chat call tells Vita to acknowledge the change once, then this clears.
  const [editAckPending, setEditAckPending] = useState(false);
  // Whether this module is finished, and how many in the stage are finished.
  const [completed, setCompleted] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  // After a module finishes, the person can choose to keep talking, which
  // re-reveals the composer. Vita signing off again returns to the finished
  // state (this flips back to false).
  const [reopened, setReopened] = useState(false);

  // Load any saved conversation and built day from the snapshot as soon as the
  // user is signed in and the data layer has finished loading. We read during
  // render rather than in an effect so the first paint already has the saved
  // state — no empty-then-refill second render. The hydrated guard makes this
  // run exactly once.
  if (user && !userData.loading && !hydrated) {
    setHydrated(true);

    // How many modules in this stage are already complete (and is this one).
    const completedIds = userData.getCompletedIds();
    setCompletedCount(
      stageModuleIds.filter((id) => completedIds.includes(id)).length
    );
    if (completedIds.includes(sessionId)) setCompleted(true);

    const savedBuild = userData.getBuild(sessionId);
    if (savedBuild) setBuildResult(savedBuild);

    const saved = userData.getConversation(sessionId);
    if (saved && saved.length > 0) {
      // A conversation is already underway — resume it.
      setMessages(saved);
      setPhase("conversation");
    } else if (savedBuild) {
      // They finished the build last time but hadn't started talking. Drop
      // them into the conversation with no messages yet — the opening effect
      // generates Vita's first line from what they built.
      setPhase("conversation");
    }
  }

  // Persist the conversation after every change, but only once we've hydrated
  // any existing conversation (otherwise we'd overwrite it with []).
  useEffect(() => {
    if (!hydrated) return;
    void userData.saveConversation(sessionId, messages);
    // userData is a fresh object each render; the hydrated guard and sessionId
    // are what actually gate this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, hydrated, sessionId]);

  // Show the conversation. The opening effect seeds Vita's first message — a
  // dynamic, drawn-from-context one when there's something to draw on, or the
  // module's fixed line otherwise.
  function startConversation() {
    setPhase("conversation");
  }

  // Generate Vita's first message with one model call and a hidden priming turn:
  // she reacts to what they built and/or draws on earlier modules. The module's
  // fixed coachOpening is the fallback if the call fails.
  async function generateOpening() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", text: OPENING_PRIMER }],
          isOpening: true,
          coachOpening,
          sessionInstructions: sessionInstructions ?? "",
          onboardingContext: userData.buildOnboardingContext(),
          priorReflections: userData.buildPriorReflections(sessionId),
          sessionContent: sessionContent ?? primerText,
          interactionSummary: buildResult ? summarizeBuild(buildResult) : "",
        }),
      });

      if (!res.ok) throw new Error(`Opening request failed: ${res.status}`);

      const data = (await res.json()) as { reply: string };
      const text = data.reply.replaceAll(MODULE_COMPLETE_MARKER, "").trim();
      setMessages([{ role: "coach", text: text || coachOpening }]);
    } catch {
      setMessages([{ role: "coach", text: coachOpening }]);
    } finally {
      setSending(false);
    }
  }

  // After a module completes, generate a short takeaway of what emerged and
  // store it for later modules to draw on. Runs in the background, so it never
  // blocks the done state. If generation fails, fall back to the interaction
  // summary if there is one; otherwise store nothing.
  async function generateAndStoreTakeaway(fullMessages: Message[]) {
    if (!user) return;
    const interactionSummary = buildResult ? summarizeBuild(buildResult) : "";

    const store = (text: string) => {
      if (!text.trim() || !user) return;
      void userData.saveTakeaway({
        moduleId: sessionId,
        moduleTitle: sessionTitle,
        text: text.trim(),
        savedAt: new Date().toISOString(),
      });
    };

    try {
      const res = await fetch("/api/takeaway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: fullMessages,
          moduleTitle: sessionTitle,
          interactionSummary,
        }),
      });

      if (!res.ok) throw new Error(`Takeaway request failed: ${res.status}`);

      const data = (await res.json()) as { takeaway: string };
      store(data.takeaway || interactionSummary);
    } catch {
      store(interactionSummary);
    }
  }

  // Seed Vita's opening. Open dynamically whenever there's something to draw on
  // — an interaction output OR earlier takeaways — otherwise use the fixed line.
  async function seedOpening() {
    if (buildResult || (user && userData.hasPriorTakeaways(sessionId))) {
      await generateOpening();
    } else {
      setMessages([{ role: "coach", text: coachOpening }]);
    }
  }

  // When a module enters the conversation with no messages yet, seed Vita's
  // opening exactly once.
  useEffect(() => {
    if (phase !== "conversation") return;
    if (messages.length > 0) return;
    if (!user) return; // wait for Clerk to load the user before deciding
    if (openingRequested.current) return;
    openingRequested.current = true;
    void seedOpening();
    // seedOpening reads current props/state but only ever runs once per mount,
    // guarded by the ref above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, messages.length, buildResult, user]);

  // After the reading: modules with an interaction go to the build step first;
  // everything else goes straight to the conversation.
  function handleReadingDone() {
    if (interaction) {
      setPhase("building");
    } else {
      startConversation();
    }
  }

  // The person finished the build step. Save the result so a refresh keeps it,
  // then open the conversation.
  function handleBuildFinish(result: BuildResult) {
    setBuildResult(result);
    void userData.saveBuild(sessionId, result);
    startConversation();
  }

  // Re-open the interaction to adjust earlier picks, pre-filled from what they
  // built. The conversation is untouched and waiting underneath.
  function handleEditStart() {
    setPhase("editing");
  }

  // Leave edit mode without changing anything — back to the conversation as it
  // was.
  function handleEditCancel() {
    setPhase("conversation");
  }

  // Save adjusted picks: update the stored result and the visible summary, keep
  // the conversation, and — only if the picks actually changed and a
  // conversation is already underway — flag the next turn so Vita acknowledges
  // the change once.
  function handleEditSave(result: BuildResult) {
    const changed =
      !buildResult || JSON.stringify(buildResult) !== JSON.stringify(result);
    setBuildResult(result);
    void userData.saveBuild(sessionId, result);
    if (changed && messages.length > 0) setEditAckPending(true);
    setPhase("conversation");
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    const conversation: Message[] = [...messages, { role: "user", text }];
    setMessages(conversation);
    setInput("");
    setSending(true);
    setError(null);

    // The opening can be Vita's dynamically generated first line, so tell the
    // API what she actually said rather than the fixed fallback.
    const actualOpening =
      messages.find((m) => m.role === "coach")?.text ?? coachOpening;

    // If they just saved changed selections, ask Vita to acknowledge the change
    // once in her next reply, then carry on. Fires for this one call only.
    const editAcknowledgement =
      editAckPending && buildResult
        ? `The person has just gone back and adjusted their earlier selections. Their current selections are now: ${summarizeBuild(buildResult)}. In one natural sentence, briefly acknowledge that they've made a change, then carry on from where the conversation was — do not restart, re-ask, or re-explain.`
        : "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversation,
          coachOpening: actualOpening,
          sessionInstructions: sessionInstructions ?? "",
          onboardingContext: userData.buildOnboardingContext(),
          priorReflections: userData.buildPriorReflections(sessionId),
          sessionContent: sessionContent ?? primerText,
          interactionSummary: buildResult ? summarizeBuild(buildResult) : "",
          editAcknowledgement,
        }),
      });

      if (!res.ok) throw new Error(`Chat request failed: ${res.status}`);

      const data = (await res.json()) as { reply: string };

      // If Vita signalled the close, strip the marker before it's shown or
      // stored, then flip the module into its complete state and record it.
      const isClosing = data.reply.includes(MODULE_COMPLETE_MARKER);
      const replyText = isClosing
        ? data.reply.replaceAll(MODULE_COMPLETE_MARKER, "").trimEnd()
        : data.reply;

      const finalMessages: Message[] = [
        ...conversation,
        { role: "coach", text: replyText },
      ];
      setMessages(finalMessages);

      // The acknowledgement instruction fired on this call — clear it so it
      // doesn't repeat on later turns.
      if (editAckPending) setEditAckPending(false);

      if (isClosing && user) {
        void userData.markModuleComplete(sessionId);
        if (!completed) {
          setCompleted(true);
          setCompletedCount((n) => n + 1);
        }
        // Vita has signed off — return to the finished state even if they had
        // chosen to keep talking.
        setReopened(false);
        // Capture the takeaway in the background — don't block the done state.
        // Re-closing after "keep talking" regenerates and overwrites it.
        void generateAndStoreTakeaway(finalMessages);
      }
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

  // Label and gate wording flex with the primer's makeup: text-only reads,
  // video-only watches, and any mix gets neutral "Continue" wording.
  const allText = primer.every((b) => b.type === "text");
  const allVideo = primer.every((b) => b.type === "video");
  const labelIcon = allVideo ? "🎬" : "📖";
  const labelText = allVideo ? "Watch this" : allText ? "Read this" : "Take a look";
  const gateLabel = allVideo
    ? "I've watched this →"
    : allText
      ? "I've read this →"
      : "Continue →";

  // Hold the screen until the data layer has loaded, so a saved conversation
  // can hydrate before we paint — never flash the reading screen over one
  // that's already underway.
  if (userData.loading) {
    return (
      <div style={styles.container}>
        <p style={styles.loadingLine}>Loading…</p>
      </div>
    );
  }

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
            {completedCount} of {modulesInStage} modules complete
          </div>
          <div style={styles.progressTrack}>
            <div
              style={{
                ...styles.progressFill,
                width: `${
                  modulesInStage > 0
                    ? Math.min(100, (completedCount / modulesInStage) * 100)
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

        {primer.map((block, i) =>
          block.type === "video" ? (
            <div key={i} style={styles.videoFrame}>
              <iframe
                src={youtubeEmbedUrl(block.url)}
                title={sessionTitle || "Session video"}
                style={styles.videoIframe}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <p key={i} style={styles.bodyText}>
              {block.value}
            </p>
          )
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

      {/* ZONE 2.6 — EDITING (re-opened interaction, pre-filled) */}
      {phase === "editing" && interaction && (
        <InteractionStep
          interaction={interaction}
          onFinish={handleEditSave}
          mode="edit"
          initial={buildResult ?? undefined}
          onCancel={handleEditCancel}
        />
      )}

      {/* ZONE 2.75 — WHAT THEY BUILT (kept visible through the conversation) */}
      {phase === "conversation" && interaction && buildResult && (
        <InteractionSummary result={buildResult} onEdit={handleEditStart} />
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

          {completed && !reopened ? (
            <div style={styles.completeBlock}>
              <p style={styles.completeCue}>
                <span aria-hidden="true">✓</span> You&apos;ve finished this
                module
              </p>
              <Link
                href={nextHref}
                className="next-complete-btn"
                style={styles.nextCompleteButton}
              >
                Next module →
              </Link>
              <button
                type="button"
                className="keep-talking-link"
                style={styles.keepTalkingLink}
                onClick={() => setReopened(true)}
              >
                Want to add something? Keep talking
              </button>
            </div>
          ) : (
            <>
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
            </>
          )}
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
  mode = "create",
  initial,
  onCancel,
}: {
  interaction: Interaction;
  onFinish: (result: BuildResult) => void;
  mode?: InteractionMode;
  // The stored result to pre-fill from in edit mode. Its type always matches
  // the interaction type, so each case narrows it with a cast.
  initial?: BuildResult;
  onCancel?: () => void;
}) {
  switch (interaction.type) {
    case "day-builder":
      return (
        <DayBuilder
          interaction={interaction}
          onFinish={onFinish}
          mode={mode}
          initial={initial?.type === "day-builder" ? initial : undefined}
          onCancel={onCancel}
        />
      );
    case "role-picker":
      return (
        <RolePicker
          interaction={interaction}
          onFinish={onFinish}
          mode={mode}
          initial={initial?.type === "role-picker" ? initial : undefined}
          onCancel={onCancel}
        />
      );
    case "sliders":
      return (
        <Sliders
          interaction={interaction}
          onFinish={onFinish}
          mode={mode}
          initial={initial?.type === "sliders" ? initial : undefined}
          onCancel={onCancel}
        />
      );
    case "keep-leave-gain":
      return (
        <KeepLeaveGain
          interaction={interaction}
          onFinish={onFinish}
          mode={mode}
          initial={initial?.type === "keep-leave-gain" ? initial : undefined}
          onCancel={onCancel}
        />
      );
    case "qualities-picker":
      return (
        <QualitiesPicker
          interaction={interaction}
          onFinish={onFinish}
          mode={mode}
          initial={initial?.type === "qualities-picker" ? initial : undefined}
          onCancel={onCancel}
        />
      );
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
  loadingLine: {
    fontFamily: "var(--font-serif)",
    fontStyle: "italic",
    fontSize: "var(--fs-body)",
    color: "var(--text-muted)",
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
  summaryCard: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-lg)",
    padding: "20px 24px",
    boxShadow: "var(--shadow-sm)",
  },
  editLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    marginTop: "18px",
    background: "none",
    border: "none",
    padding: "2px 0",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--brand-primary)",
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
  completeBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
    paddingTop: "8px",
  },
  completeCue: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    color: "var(--success-text)",
    margin: 0,
  },
  nextCompleteButton: {
    width: "100%",
    maxWidth: "360px",
    minHeight: "48px",
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    borderRadius: "var(--r-sm)",
    padding: "13px 24px",
    textDecoration: "none",
    boxShadow: "var(--shadow-sm)",
  },
  keepTalkingLink: {
    background: "none",
    border: "none",
    padding: "4px 8px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    textDecoration: "underline",
    textUnderlineOffset: "3px",
    cursor: "pointer",
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
  .primary-btn:hover, .send-btn:hover,
  .next-complete-btn:hover { background: var(--brand-primary-hover); }
  .primary-btn:focus-visible,
  .send-btn:focus-visible,
  .next-complete-btn:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .composer-input:focus-visible {
    border-color: var(--brand-primary);
    box-shadow: var(--focus-ring);
  }
  .keep-talking-link:hover { color: var(--text); }
  .keep-talking-link:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
    border-radius: var(--r-sm);
  }
  .edit-link:hover { text-decoration: underline; text-underline-offset: 3px; }
  .edit-link:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
    border-radius: var(--r-sm);
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
