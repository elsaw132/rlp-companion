"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ModuleFeedbackCard from "./ModuleFeedbackCard";
import VitaMark from "./VitaMark";
import { ModuleIconChip } from "./module/ModuleIconChip";
import { STAGE_KEYS } from "@/lib/stageColors";
import { todayISODate } from "@/lib/planDate";
import DayBuilder, {
  DayBuilderSummary,
  dayBuilderSummaryText,
} from "./DayBuilder";
import RolePicker, {
  RolePickerSummary,
  rolePickerSummaryText,
} from "./RolePicker";
import Sliders, { SlidersSummary, slidersSummaryText } from "./Sliders";
import SparkPrompts, {
  SparkPromptsSummary,
  sparkPromptsSummaryText,
} from "./SparkPrompts";
import ScreeningCheck, {
  ScreeningCheckSummary,
  screeningCheckSummaryText,
} from "./ScreeningCheck";
import ScreeningCommitment from "./ScreeningCommitment";
import LetterFlow from "./LetterFlow";
import StageIntro, { type StageIntroData } from "./StageIntro";
import {
  PrimerAudio,
  PrimerImage,
  PrimerSlideshow,
  PrimerText,
  PrimerVideo,
  primerMediaCss,
} from "./PrimerMedia";
import MirrorCards, {
  MirrorCardsSummary,
  mirrorCardsSummaryText,
} from "./MirrorCards";
import ValueTriage, {
  ValueTriageSummary,
  valueTriageSummaryText,
} from "./ValueTriage";
import PriorityChoices, {
  PriorityChoicesSummary,
  priorityChoicesSummaryText,
} from "./PriorityChoices";
import ValueDefinitions, {
  ValueDefinitionsSummary,
  valueDefinitionsSummaryText,
} from "./ValueDefinitions";
import HopesFears, {
  HopesFearsSummary,
  hopesFearsSummaryText,
} from "./HopesFears";
import BiggerPicture, {
  BiggerPictureSummary,
  biggerPictureSummaryText,
} from "./BiggerPicture";
import ReadinessSnapshot, {
  ReadinessSnapshotSummary,
  readinessSnapshotSummaryText,
} from "./ReadinessSnapshot";
import SeasonsBoard, {
  SeasonsBoardSummary,
  seasonsBoardSummaryText,
} from "./SeasonsBoard";
import BalancedGoals, {
  BalancedGoalsSummary,
  balancedGoalsSummaryText,
} from "./BalancedGoals";
import GoalPaths, {
  GoalPathsSummary,
  goalPathsSummaryText,
} from "./GoalPaths";
import TradeOffs, {
  TradeOffsSummary,
  tradeOffsSummaryText,
} from "./TradeOffs";
import WeekShape, {
  WeekShapeSummary,
  weekShapeSummaryText,
} from "./WeekShape";
import FirstYearJourney, {
  FirstYearSummary,
  firstYearSummaryText,
} from "./FirstYearJourney";
import {
  fetchFirstYearDraft,
  firstYearGoalInputs,
  firstYearRhythmInputs,
  firstYearSeasonInputs,
} from "@/lib/firstYearSeed";
import { fetchBalancedGoalsDraft } from "@/lib/balancedGoalsSeed";
import {
  fetchGoalPathsDraft,
  spotlightGoalInputs,
} from "@/lib/goalPathsSeed";
import {
  fetchTradeOffsDraft,
  tradeOffGoalInputs,
  financeSignal,
  valueInputs,
} from "@/lib/tradeOffsSeed";
import {
  fetchWeekShapeDraft,
  weekShapeGoalInputs,
  transitionShape,
} from "@/lib/weekShapeSeed";
import { fetchSeasonsCards } from "@/lib/seasonsCardsSeed";
import { FinishControls, type InteractionMode } from "./InteractionShell";
import type {
  ContentBlock,
  Interaction,
  CompositeInteraction,
  BuildResult,
  CompositeResult,
  LetterResult,
  BalancedGoalsResult,
  ReadinessSnapshotResult,
  SeasonsBoardResult,
  WeekShapeResult,
  ClosingCommitment,
  ScreeningCommitment as ScreeningCommitmentResult,
} from "@/lib/modules";
import { stripStructuredLeak } from "@/lib/coachText";
import { useUserData } from "@/lib/userData";
import {
  principlesAfterConversation,
  type ConversationalDeltas,
  type PendingRemoval,
} from "@/lib/contextFacts";
import type { Dreams } from "@/lib/dreams";
import {
  isSeededType,
  type Stage3Seed,
  type Stage3Value,
} from "@/lib/stage3Seed";
import {
  type SeasonCard,
  type BalancedSeed,
  type ModelSource,
} from "@/lib/userModel";
import { buildRlpPlan } from "@/lib/rlpPlan";
import { ensurePlanGenerated } from "@/lib/planPrewarm";
import {
  resolveVitaText,
  resolveSeedText,
  resolveSeedItems,
} from "@/lib/contextResolver";
import {
  springboardsFromFacts,
  springboardAreasFromFacts,
  seasonCardsFromFacts,
  seasonCandidatesFromFacts,
  recurringSeedFromFacts,
} from "@/lib/resolverInputs";

// Vita appends a close signal to her final message so we know the module is
// finished. It's stripped before display and before storage, so it never shows
// and never re-enters the conversation history. The canonical token is
// [[MODULE_COMPLETE]], but the model occasionally invents a wrapped variant
// (e.g. ~~COMPLETION_MARKER~~, [[COMPLETION_MARKER]], **MODULE_COMPLETE**). Catch
// those too so a stray marker can never leak into a bubble — and so the close is
// still recognised when it does. Returns whether a close was signalled and the
// text with every marker artifact removed.
const COMPLETION_MARKER_RE =
  /[~*_[\]<>#-]{0,2}\s*(?:MODULE[_\s-]?COMPLETE|COMPLETION[_\s-]?MARKER)\s*[~*_[\]<>#-]{0,2}/gi;
function stripCompletionMarker(reply: string): {
  isClosing: boolean;
  text: string;
} {
  COMPLETION_MARKER_RE.lastIndex = 0;
  const isClosing = COMPLETION_MARKER_RE.test(reply);
  const text = reply.replace(COMPLETION_MARKER_RE, "").trim();
  return { isClosing, text };
}

// Vita's opening can occasionally run long (especially if it echoes a carried-
// forward summary). Cap it: truncate to the word limit, then trim back to the last
// sentence end for a clean stop, or add an ellipsis if there isn't one nearby.
const OPENING_WORD_CAP = 110;
function capWords(text: string, max: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= max) return text;
  let clipped = words.slice(0, max).join(" ");
  const lastStop = Math.max(
    clipped.lastIndexOf("."),
    clipped.lastIndexOf("!"),
    clipped.lastIndexOf("?")
  );
  if (lastStop > clipped.length * 0.5) {
    clipped = clipped.slice(0, lastStop + 1);
  } else {
    clipped = `${clipped.replace(/[,;:\s]+$/, "")}…`;
  }
  return clipped;
}

// POST to /api/chat and read the streamed reply. onDelta is called with the full
// text accumulated so far after each chunk, so callers can render Vita's words as
// they arrive. Resolves with the final full text. Throws if the request fails to
// start OR the stream breaks mid-flight — the same all-or-nothing contract the
// non-streaming version had, so callers keep their existing fallback (opening →
// fixed line; send → error notice and a clean retry).
async function streamChatReply(
  requestBody: unknown,
  onDelta: (fullText: string) => void
): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  if (!res.ok || !res.body) throw new Error(`Chat request failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";

  // Typewriter smoothing. Network chunks arrive in irregular bursts; repainting
  // the whole partial once per chunk reads as jerky jumps. Instead we reveal the
  // accumulated text a little each animation frame — a steady base cadence with a
  // gentle proportional catch-up so a big burst drains smoothly rather than
  // lagging behind. Every repaint is batched onto requestAnimationFrame: at most
  // one per frame, no matter how fast chunks land.
  const canAnimate = typeof requestAnimationFrame === "function";
  if (!canAnimate) {
    // No rAF (SSR / test env): fall back to the simple per-chunk repaint.
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      full += decoder.decode(value, { stream: true });
      onDelta(full);
    }
    full += decoder.decode();
    onDelta(full);
    return full;
  }

  let shown = 0;
  let streamDone = false;
  let rafId: number | null = null;
  let onCaughtUp: (() => void) | null = null;
  let lastTs: number | null = null;
  let budget = 0; // fractional characters we're allowed to reveal this frame

  // A calm, steady reading cadence in characters/second, measured against the
  // real frame clock so it's independent of how fast chunks arrive. We only lift
  // the pace when the backlog grows large — a big burst landed, or the model has
  // finished and we're draining the tail — so it stays gentle without ever
  // lagging noticeably behind.
  const BASE_CPS = 50;

  const tick = (ts: number) => {
    if (lastTs == null) lastTs = ts;
    const dt = Math.min(0.1, (ts - lastTs) / 1000); // clamp tab-switch gaps
    lastTs = ts;

    const backlog = full.length - shown;
    if (backlog <= 0) {
      budget = 0;
    } else {
      let cps = BASE_CPS;
      if (streamDone) cps = Math.max(cps, backlog / 0.8); // drain tail in ~0.8s
      else if (backlog > 220) cps = BASE_CPS * 4;
      else if (backlog > 110) cps = BASE_CPS * 2;
      budget += dt * cps;
      if (budget >= 1) {
        const step = Math.min(backlog, Math.floor(budget));
        budget -= step;
        shown += step;
        onDelta(full.slice(0, shown));
      }
    }

    if (streamDone && shown >= full.length) {
      rafId = null;
      onCaughtUp?.();
      return;
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  // A stream error (the server errored the controller) rejects read(), which
  // propagates out as a throw — caller handles the fallback.
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      full += decoder.decode(value, { stream: true });
    }
    full += decoder.decode();
  } catch (err) {
    if (rafId != null) cancelAnimationFrame(rafId);
    throw err;
  }

  // Let the typewriter drain to the very end before resolving, so the caller's
  // final render matches what's already on screen — no end-of-stream jump.
  streamDone = true;
  await new Promise<void>((resolve) => {
    onCaughtUp = resolve;
    if (rafId == null) rafId = requestAnimationFrame(tick);
  });

  return full;
}

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
    case "letter":
      return `A letter written to ${result.recipientLabel}:\n${result.body}`;
    case "spark-prompts":
      return sparkPromptsSummaryText(result);
    case "screening-check":
      return screeningCheckSummaryText(result);
    case "mirror-cards":
      return mirrorCardsSummaryText(result);
    case "value-triage":
      return valueTriageSummaryText(result);
    case "priority-choices":
      return priorityChoicesSummaryText(result);
    case "value-definitions":
      return valueDefinitionsSummaryText(result);
    case "hopes-fears":
      return hopesFearsSummaryText(result);
    case "bigger-picture":
      return biggerPictureSummaryText(result);
    case "readiness-snapshot":
      return readinessSnapshotSummaryText(result);
    case "seasons-board":
      return seasonsBoardSummaryText(result);
    case "balanced-goals":
      return balancedGoalsSummaryText(result);
    case "goal-paths":
      return goalPathsSummaryText(result);
    case "trade-offs":
      return tradeOffsSummaryText(result);
    case "week-shape":
      return weekShapeSummaryText(result);
    case "first-year":
      return firstYearSummaryText(result);
    case "composite":
      return result.results.map(summarizeBuild).filter(Boolean).join(" ");
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
    case "spark-prompts":
      body = <SparkPromptsSummary result={result} />;
      break;
    case "screening-check":
      body = <ScreeningCheckSummary result={result} />;
      break;
    case "mirror-cards":
      body = <MirrorCardsSummary result={result} />;
      break;
    case "value-triage":
      body = <ValueTriageSummary result={result} />;
      break;
    case "priority-choices":
      body = <PriorityChoicesSummary result={result} />;
      break;
    case "value-definitions":
      body = <ValueDefinitionsSummary result={result} />;
      break;
    case "hopes-fears":
      body = <HopesFearsSummary result={result} />;
      break;
    case "bigger-picture":
      body = <BiggerPictureSummary result={result} />;
      break;
    case "readiness-snapshot":
      body = <ReadinessSnapshotSummary result={result} />;
      break;
    case "seasons-board":
      body = <SeasonsBoardSummary result={result} />;
      break;
    case "balanced-goals":
      body = <BalancedGoalsSummary result={result} />;
      break;
    case "goal-paths":
      body = <GoalPathsSummary result={result} />;
      break;
    case "trade-offs":
      body = <TradeOffsSummary result={result} />;
      break;
    case "week-shape":
      body = <WeekShapeSummary result={result} />;
      break;
    case "first-year":
      body = <FirstYearSummary result={result} />;
      break;
    case "composite":
      body = (
        <div style={styles.compositeSummaryStack}>
          {result.results.map((r, i) => (
            <CompositeSummaryPart key={i} result={r} />
          ))}
        </div>
      );
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

// One sub-result's recap inside a composite summary — the same per-type summary
// bodies, stacked, with no Edit link of their own (the composite owns editing).
function CompositeSummaryPart({ result }: { result: BuildResult }) {
  switch (result.type) {
    case "day-builder":
      return <DayBuilderSummary result={result} />;
    case "role-picker":
      return <RolePickerSummary result={result} />;
    case "sliders":
      return <SlidersSummary result={result} />;
    case "spark-prompts":
      return <SparkPromptsSummary result={result} />;
    default:
      return null;
  }
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
  // The next module in this stage once finished, or null on the last module.
  // Completion always offers "Back to home"; this adds a secondary "Next
  // module" action when there's a next one.
  nextHref: string | null;
  // The next module's title, passed to Vita so her closing sign-off names the
  // correct upcoming module. Null on the last module of the stage.
  nextModuleTitle: string | null;
  // The stage reveal, offered as the primary completion action on the last
  // module of a stage that has one (otherwise null). When set, finishing the
  // module leads straight to the reveal rather than only back to the hub.
  revealHref: string | null;
  // The wording for that primary completion CTA, matched to the stage it leads
  // into ("See your Imagine reveal →", "See your Retirement Life Plan →", …).
  // Null whenever revealHref is null.
  revealLabel: string | null;
  sessionTitle: string;
  sessionDescription: string;
  durationMin: number;
  // The primer shown before the conversation, as ordered text/video blocks.
  primer: ContentBlock[];
  // Vita's first conversation line. Absent for modules with no conversation
  // (e.g. the letter module, whose writing surface replaces the chat).
  coachOpening?: string;
  // Wired into the page in a later step. Until then sessionContent falls back
  // to the primer's text, and there are no module-specific instructions.
  sessionContent?: string;
  sessionInstructions?: string;
  // Optional build step shown between the reading and the conversation. When
  // absent, the module keeps the plain reading → conversation flow.
  interaction?: Interaction;
  // A reframed placeholder for the letter writing surface (retired "retirement
  // so far" reflection, Phase 4). Undefined keeps LetterFlow's default prompt.
  letterWritingPlaceholder?: string;
  // Optional commitment captured after the conversation closes (a concrete plan
  // entry). When set, a small Vita-voiced widget appears on completion before
  // the home CTAs. Only the senses module uses it so far.
  closingCommitment?: ClosingCommitment;
  // When true, Vita closes in a single sign-off rather than the usual two-step
  // "mirror back, then confirm" wrap-up. For short, practical modules where
  // restating the answers adds nothing. Threaded to /api/chat at closing time.
  closeInOneStep?: boolean;
  // The stage's framing intro, shown once before the reading when this is the
  // first session of the stage (stages 2+). Null when it isn't the first session,
  // the stage has no intro, or it's Stage 1 (whose intro lands on /home straight
  // after onboarding instead). Built and tailored per cohort on the server.
  stageIntro?: StageIntroData | null;
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
    // youtube-nocookie.com: the privacy-enhanced host — no tracking cookie is set
    // unless the viewer actually plays the video. Same embed path and video id.
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : url;
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
  nextModuleTitle,
  revealHref,
  revealLabel,
  sessionTitle,
  sessionDescription,
  durationMin,
  primer,
  // Defaults to "" so the conversation code paths stay typed as string; the
  // letter module never reaches them (its writing surface replaces the chat).
  coachOpening = "",
  sessionContent,
  sessionInstructions,
  interaction,
  letterWritingPlaceholder,
  closingCommitment,
  closeInOneStep = false,
  stageIntro = null,
}: SessionContainerProps) {
  const { user } = useUser();
  const userData = useUserData();
  const router = useRouter();

  // The readable text Vita draws on — the primer's text blocks, joined. Video
  // blocks have no readable text, so they're skipped.
  const primerText = primer
    .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.value)
    .join("\n\n");

  // What fills Vita's {priorReflections} slot — now the resolver's Vita view: the
  // module's manifest-scoped slice of the canonical profile, status=active only,
  // rendered as a few compact lines. This replaces the old per-stage assembly
  // (buildCarryForward / buildStage3Context / renderUserModel + the uncapped
  // takeaway prose): corrections now drop here, and the block is leaner than the
  // stack it replaces.
  function priorReflectionsBlock(): string {
    return resolveVitaText(sessionId, userData.getActiveFacts());
  }

  // The letter module replaces the build → conversation flow with a single
  // writing surface (LetterFlow), so it takes its own "letter" phase.
  const isLetter = interaction?.type === "letter";
  // The retired letter (Phase 4) leads into a keep/change/leave conversation
  // rather than completing straight away; the default letter has no chat. Keyed
  // off sessionInstructions, which only the retired letter supplies — so the
  // default letter flow below is entirely unchanged.
  const letterHasConversation = isLetter && !!sessionInstructions;
  const isFirstYear = interaction?.type === "first-year";

  // Where the person is in the module: the reading, the build step (only for
  // modules with an interaction), the conversation, then optionally back into
  // "editing" to adjust earlier picks without losing the conversation. The
  // letter module uses "letter" in place of building/conversation.
  const [phase, setPhase] = useState<
    | "reading"
    | "seeding"
    | "building"
    | "conversation"
    | "editing"
    | "letter"
    | "journey"
  >("reading");
  // Stage 3 surfaces pre-fill from a seed fetched once after the reading. Loaded
  // from the snapshot on hydration, or fetched fresh in the "seeding" phase.
  const [seed, setSeed] = useState<Stage3Seed | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  // The composer is an auto-growing textarea; this lets it size to its content.
  const composerRef = useRef<HTMLTextAreaElement>(null);
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
  // Conversational corrections the takeaway pass flagged but couldn't confirm in
  // chat — surfaced at the close for a quick yes/no, so an un-applied rejection
  // never leaves a stale fact active (it would now resurface, since consumers read
  // the profile). Empty unless something needs confirming.
  const [pendingFactRemovals, setPendingFactRemovals] = useState<PendingRemoval[]>([]);
  // When Vita signals a close, we don't finish the module straight away — we
  // offer the person a choice (keep talking, or wrap up here). True while that
  // choice is on screen, between Vita's sign-off and the person deciding.
  const [pendingClose, setPendingClose] = useState(false);
  // On a fresh completion, the first forward action (home, next module, or the
  // stage reveal) shows the short feedback card once before moving on. True
  // while that card is on screen; pendingDestRef holds where to go after it.
  const [showFeedback, setShowFeedback] = useState(false);
  const pendingDestRef = useRef<string>("/home");
  // For modules with a closing commitment: whether the person has set or skipped
  // it. Shown once on fresh completion; revisits to an already-finished module
  // skip straight to the completion CTAs (set true on hydration below).
  const [commitmentDone, setCommitmentDone] = useState(false);
  // Vita's closing line for the letter module, shown above the completion block
  // once the letter is finalised (the letter module has no chat transcript).
  const [letterAck, setLetterAck] = useState<string | null>(null);
  // Vita's closing line for the first-year journey, shown above the completion
  // block once the person settles their year (it has its own editing chat).
  const [firstYearAck, setFirstYearAck] = useState<string | null>(null);
  // Whether to show this stage's framing intro over the session before anything
  // else. Set once on hydration when this is the first session of a stage (2+)
  // whose intro the person hasn't met yet; cleared when they continue past it,
  // which also records the intro as seen so it never returns.
  const [showStageIntro, setShowStageIntro] = useState(false);

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
    if (completedIds.includes(sessionId)) {
      setCompleted(true);
      // Already finished before — don't re-prompt the commitment step on revisit.
      setCommitmentDone(true);
    }

    // First forward entry into a stage (2+) shows its intro before the reading,
    // then records it as seen so it shows only once. stageIntro is non-null only
    // on the stage's first session, so the seen check is all that's left to make.
    if (stageIntro && !userData.getStageIntrosSeen().includes(stageNumber)) {
      setShowStageIntro(true);
    }

    const savedBuild = userData.getBuild(sessionId);
    if (savedBuild) setBuildResult(savedBuild);

    // A Stage 3 surface may have a seed saved from a previous visit — load it so
    // a refresh mid-module keeps the same candidates rather than re-fetching.
    const savedSeed = userData.getSeed(sessionId);
    if (savedSeed) setSeed(savedSeed);

    if (isLetter) {
      // The letter module has no chat. If it's already complete the completion
      // block shows; otherwise resume on the writing surface (LetterFlow
      // pre-fills from any saved draft). Never enter the conversation phase.
      if (!completedIds.includes(sessionId)) setPhase("letter");
    } else if (isFirstYear) {
      // The first-year journey owns its own editing chat and timeline. If it's
      // already complete the recap + completion block shows; otherwise resume on
      // the journey surface (it pre-fills from the saved working state). Never
      // enter the standard conversation phase.
      if (!completedIds.includes(sessionId)) setPhase("journey");
    } else {
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
  }

  // True while a reply is streaming in token-by-token. The persist effect below
  // skips those partial frames so we don't POST a half-written coach message to
  // the database on every chunk — the final, complete message is saved once the
  // stream settles (streamingRef flips back to false before the last setMessages).
  const streamingRef = useRef(false);

  // Persist the conversation after every change, but only once we've hydrated
  // any existing conversation (otherwise we'd overwrite it with []), and never
  // mid-stream (that would save partial replies and spam the database).
  useEffect(() => {
    if (!hydrated || streamingRef.current) return;
    void userData.saveConversation(sessionId, messages);
    // userData is a fresh object each render; the hydrated guard and sessionId
    // are what actually gate this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, hydrated, sessionId]);

  // The balanced-goals draft (4.3) is a slow Claude call. Kick it off as soon as
  // the module opens — while the person reads the intro — and stash it in the
  // cache the surface reads, so the goals are usually ready by the time they
  // arrive. The surface still drafts on its own if this hasn't landed yet.
  const goalsPrefetchedRef = useRef(false);
  useEffect(() => {
    if (interaction?.type !== "balanced-goals") return;
    if (goalsPrefetchedRef.current || userData.getGoalSeed(sessionId)) return;
    goalsPrefetchedRef.current = true;
    // Springboards now come from the resolver's recurring_activity facts, grouped
    // by their balanced-area domain — fact-sourced, so a removed activity is gone.
    const facts = userData.getActiveFacts();
    const areaSeed = springboardAreasFromFacts(
      resolveSeedItems(sessionId, facts, "recurring_activity")
    );
    const allowed = new Set(interaction.areas.map((a) => a.id));
    const springboards = areaSeed.filter((s) => allowed.has(s.area));
    void (async () => {
      const draft = await fetchBalancedGoalsDraft({
        userModel: resolveSeedText(sessionId, userData.getActiveFacts()),
        onboarding: userData.buildOnboardingContext(),
        hasPartner: userData.hasPartner(),
        retirementStage: userData.getRetirementStage(),
        springboards,
      });
      if (draft) void userData.saveGoalSeed(sessionId, draft);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interaction, sessionId]);

  // The goal-paths draft (4.4) is the same slow Claude call. Prefetch a path for
  // each spotlighted goal (read from 4.3's saved result) while the person reads
  // the intro, into the cache the surface reads. The surface still drafts on its
  // own if this hasn't landed yet.
  const pathsPrefetchedRef = useRef(false);
  useEffect(() => {
    if (interaction?.type !== "goal-paths") return;
    if (pathsPrefetchedRef.current || userData.getGoalPathSeed(sessionId)) return;
    const goals = spotlightGoalInputs(
      (userData.getBuild("4.3") as BalancedGoalsResult | null) ?? null
    );
    if (!goals.length) return;
    pathsPrefetchedRef.current = true;
    void (async () => {
      const draft = await fetchGoalPathsDraft({
        userModel: resolveSeedText(sessionId, userData.getActiveFacts()),
        onboarding: userData.buildOnboardingContext(),
        hasPartner: userData.hasPartner(),
        retirementStage: userData.getRetirementStage(),
        goals,
      });
      if (draft) void userData.saveGoalPathSeed(sessionId, draft);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interaction, sessionId]);

  // The trade-offs draft (4.5) is the same slow Claude call. Prefetch the
  // scenarios and candidate principles — grounded in the spotlighted goals
  // (4.3), the finance signal (4.1) and the Stage 3 values — while the person
  // reads the intro, into the cache the surface reads. The surface still drafts
  // on its own if this hasn't landed yet.
  const tradeOffsPrefetchedRef = useRef(false);
  useEffect(() => {
    if (interaction?.type !== "trade-offs") return;
    if (tradeOffsPrefetchedRef.current || userData.getTradeOffSeed(sessionId))
      return;
    const goals = tradeOffGoalInputs(
      (userData.getBuild("4.3") as BalancedGoalsResult | null) ?? null
    );
    const finance = financeSignal(
      (userData.getBuild("4.1") as ReadinessSnapshotResult | null) ?? null
    );
    const values = valueInputs(userData.getStage3Values());
    if (!goals.length && !values.length) return;
    tradeOffsPrefetchedRef.current = true;
    void (async () => {
      const draft = await fetchTradeOffsDraft({
        userModel: resolveSeedText(sessionId, userData.getActiveFacts()),
        onboarding: userData.buildOnboardingContext(),
        hasPartner: userData.hasPartner(),
        retirementStage: userData.getRetirementStage(),
        goals,
        finance,
        values,
      });
      if (draft) void userData.saveTradeOffSeed(sessionId, draft);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interaction, sessionId]);

  // The week-shape draft (4.6) is the same slow Claude call. Prefetch the week —
  // grounded in the spotlighted goals (4.3) and the work-transition shape (4.1)
  // on top of the user model — while the person reads the intro, into the cache
  // the surface reads. The surface still drafts on its own if this hasn't landed.
  const weekShapePrefetchedRef = useRef(false);
  useEffect(() => {
    if (interaction?.type !== "week-shape") return;
    if (weekShapePrefetchedRef.current || userData.getWeekShapeSeed(sessionId))
      return;
    weekShapePrefetchedRef.current = true;
    void (async () => {
      const draft = await fetchWeekShapeDraft({
        userModel: resolveSeedText(sessionId, userData.getActiveFacts()),
        onboarding: userData.buildOnboardingContext(),
        hasPartner: userData.hasPartner(),
        retirementStage: userData.getRetirementStage(),
        goals: weekShapeGoalInputs(
          (userData.getBuild("4.3") as BalancedGoalsResult | null) ?? null
        ),
        transition: transitionShape(
          (userData.getBuild("4.1") as ReadinessSnapshotResult | null) ?? null
        ),
        // The real, recurring activities now come from structured
        // recurring_activity facts — not a scrape of prior transcripts.
        recurring: recurringSeedFromFacts(
          resolveSeedItems(sessionId, userData.getActiveFacts(), "recurring_activity")
        ),
      });
      if (draft) void userData.saveWeekShapeSeed(sessionId, draft);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interaction, sessionId]);

  // The seasons board (4.2) draws its cards from the person's real priorities across
  // the whole programme. The narrow, aspiration-first seasonCardsFromFacts used to
  // starve it — the people and activities that matter most got crowded out. While the
  // person reads the intro, gather the FULL candidate pool (aspirations, the activities
  // they do, hopes, goals, what they want to keep, the people in their life) plus their
  // roles and values as signal, and curate it with one Claude call into a balanced,
  // consistently-phrased set, cached for the surface. Curation selects and phrases only
  // from what the person actually said (never invents); if it hasn't landed, the board
  // falls back to the raw seasonCardsFromFacts set, so it always renders.
  const seasonsCardsPrefetchedRef = useRef(false);
  useEffect(() => {
    if (interaction?.type !== "seasons-board") return;
    if (seasonsCardsPrefetchedRef.current || userData.getSeasonsCardsSeed(sessionId))
      return;
    const input = seasonCandidatesFromFacts(userData.getActiveFacts());
    // Nothing to curate — skip the call entirely.
    if (input.candidates.length === 0) return;
    seasonsCardsPrefetchedRef.current = true;
    void (async () => {
      const seed = await fetchSeasonsCards(input);
      if (seed) void userData.saveSeasonsCardsSeed(sessionId, seed);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interaction, sessionId]);

  // The first-year draft (4.7) is the same slow Claude call. Prefetch the
  // assembled year — grounded in the goals (4.3), the weekly rhythm (4.6), the
  // early-retirement priorities (4.2) and the work-transition shape (4.1) on top
  // of the user model — while the person reads the intro. The surface still drafts
  // on its own if this hasn't landed.
  const firstYearPrefetchedRef = useRef(false);
  useEffect(() => {
    if (interaction?.type !== "first-year") return;
    if (firstYearPrefetchedRef.current || userData.getFirstYearSeed(sessionId))
      return;
    firstYearPrefetchedRef.current = true;
    void (async () => {
      const seasonInputs = firstYearSeasonInputs(
        (userData.getBuild("4.2") as SeasonsBoardResult | null) ?? null
      );
      const draft = await fetchFirstYearDraft({
        userModel: resolveSeedText(sessionId, userData.getActiveFacts()),
        onboarding: userData.buildOnboardingContext(),
        hasPartner: userData.hasPartner(),
        retirementStage: userData.getRetirementStage(),
        goals: firstYearGoalInputs(
          (userData.getBuild("4.3") as BalancedGoalsResult | null) ?? null
        ),
        rhythm: firstYearRhythmInputs(
          (userData.getBuild("4.6") as WeekShapeResult | null) ?? null
        ),
        seasonPriorities: seasonInputs.priorities,
        seasonOrder: seasonInputs.seasonOrder,
        transition: transitionShape(
          (userData.getBuild("4.1") as ReadinessSnapshotResult | null) ?? null
        ),
      });
      if (draft) void userData.saveFirstYearSeed(sessionId, draft);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interaction, sessionId]);

  // Pre-warm the Retirement Life Plan the moment 4.7 (the last Stage 4 module) is
  // done. The plan's prose and scene images are otherwise generated only when
  // /plan first opens, so the first reveal fills in over a minute or more (the
  // images are the tail — up to five, one at a time). Generating them here, in
  // the background and into the very same planIntro / planImages caches the
  // reveal reads, means the member's first /plan open is an instant, complete
  // cache hit. ensurePlanGenerated is cache-first and dedup-guarded, so nothing
  // regenerates and a member who races to /plan before this finishes never
  // doubles the work. Runs on fresh completion and on a revisit (a no-op once the
  // caches are warm).
  const planPrewarmedRef = useRef(false);
  useEffect(() => {
    if (!isFirstYear || !completed || !buildResult || !user) return;
    if (planPrewarmedRef.current) return;
    const source: ModelSource = {
      getBuild: userData.getBuild,
      getTakeaway: userData.getTakeaway,
      getDreams: userData.getDreams,
      getStage3Values: userData.getStage3Values,
      getOnboarding: userData.getOnboarding,
      getActiveFacts: userData.getActiveFacts,
    };
    const plan = buildRlpPlan(source, {
      name: userData.getDisplayName(user),
      dateCreated: todayISODate(),
    });
    // Nothing to warm yet if there's no real Stage 4 material — let the reveal's
    // dev-seed path handle the empty case.
    if (!plan.hasPlan) return;
    planPrewarmedRef.current = true;
    void ensurePlanGenerated(plan, source, {
      getPlanIntro: userData.getPlanIntro,
      savePlanIntro: userData.savePlanIntro,
      getPlanImages: userData.getPlanImages,
      savePlanImage: userData.savePlanImage,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFirstYear, completed, buildResult, user]);

  // Pre-fetch the Stage 3 seed while the person is still reading the intro — the
  // same "prefetch during reading" trick the Stage 4 surfaces use. The
  // value-definitions seed (3.4) is the slowest at ~40s and previously only
  // started *after* the reading, so the person read and then waited at a blank
  // screen. Kicking it off on mount overlaps the generation with the reading time
  // they already spend, so it's usually ready by the time they finish. runSeeding
  // reuses this in-flight request rather than starting a second one. Gated on the
  // data layer being loaded so the seed grounds itself in real context, not an
  // empty snapshot. Applies to every seeded Stage 3 surface; 3.4 is the worst case.
  const seedPrefetchedRef = useRef(false);
  const seedInFlightRef = useRef<Promise<Stage3Seed | null> | null>(null);
  useEffect(() => {
    if (!user || userData.loading) return;
    if (!interaction || !isSeededType(interaction.type)) return;
    if (seedPrefetchedRef.current || seed || userData.getSeed(sessionId)) return;
    seedPrefetchedRef.current = true;
    const p = fetchSeedDraft();
    seedInFlightRef.current = p;
    void p.then((draft) => {
      if (draft) {
        setSeed(draft);
        void userData.saveSeed(sessionId, draft);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interaction, sessionId, user, userData.loading]);

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
    streamingRef.current = true;
    try {
      const raw = await streamChatReply(
        {
          messages: [{ role: "user", text: OPENING_PRIMER }],
          isOpening: true,
          coachOpening,
          sessionInstructions: sessionInstructions ?? "",
          onboardingContext: userData.buildOnboardingContext(),
          priorReflections: priorReflectionsBlock(),
          sessionContent: sessionContent ?? primerText,
          interactionSummary: buildResult ? summarizeBuild(buildResult) : "",
          toneChoice: userData.getCoachTone(),
        },
        // Render the opening as it streams. Strip any close marker / structured
        // leak from the partial so neither ever flashes on screen, and cap length.
        (partial) => {
          const shown = capWords(
            stripStructuredLeak(stripCompletionMarker(partial).text),
            OPENING_WORD_CAP
          );
          setMessages([{ role: "coach", text: shown }]);
        }
      );

      // Some modules (4.3, 4.4) let Vita's very first message also sign the module
      // off, so the person can finish without typing. Strip the marker, show the
      // opening, then offer the close choice — mirroring the chat close.
      const { isClosing, text } = stripCompletionMarker(raw);
      // Block any leaked {thirdPerson/secondPerson} JSON from reaching the screen,
      // then cap the length so the opening stays a warm word, not a wall of text.
      const cleaned = capWords(stripStructuredLeak(text), OPENING_WORD_CAP);
      setMessages([{ role: "coach", text: cleaned || coachOpening }]);

      if (isClosing) setPendingClose(true);
    } catch {
      setMessages([{ role: "coach", text: coachOpening }]);
    } finally {
      // Flip off before returning, so the effect for the final setMessages above
      // (which React runs after this function settles) persists the opening.
      streamingRef.current = false;
      setSending(false);
    }
  }

  // The person chose to wrap up after Vita signalled a close. Mark the module
  // finished, clear any reopened/pending state, and capture the background
  // records (takeaway always; the structured ones self-guard to their module).
  function finalizeClose(finalMessages: Message[]) {
    setPendingClose(false);
    if (!user) return;
    void userData.markModuleComplete(sessionId);
    if (!completed) {
      setCompleted(true);
      setCompletedCount((n) => n + 1);
    }
    setReopened(false);
    void generateAndStoreTakeaway(finalMessages);
    void generateAndStoreDreams(finalMessages);
    void generateAndStoreStage3Values(finalMessages);
  }

  // ---- Canonical context profile (phase 1: write-only) --------------------
  // Reconcile this module's widget-pick facts to match a build. The server diffs
  // against what's on record, so this serves both first capture and a re-edit (a
  // pick that disappears is rejected, not left behind). Background + best-effort;
  // 1.money is reconciled from its dreams record instead (see below).
  function reconcileBuildFacts(result: BuildResult | null) {
    if (!user || !result || sessionId === "1.money") return;
    void fetch("/api/context-facts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reconcile", moduleId: sessionId, build: result }),
    }).catch(() => {});
  }

  // Reconcile 1.money's facts from its structured dreams record — the source that
  // carries the achievable / pipe-dream split (so a pipe-dream is never read as
  // plan-actionable).
  function reconcileDreamsFacts(dreams: Dreams) {
    if (!user) return;
    void fetch("/api/context-facts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reconcileDreams", dreams }),
    }).catch(() => {});
  }

  // Apply the conversational deltas the takeaway call extracted: additions land
  // immediately; removals are applied only where the person confirmed the change
  // in chat (the server gates this). For 4.5, also fold any new principles back
  // into interaction:4.5 — the key the RLP reads — so they pull through at once.
  function applyConversationalDeltas(deltas: ConversationalDeltas) {
    if (!user) return;
    void (async () => {
      try {
        const res = await fetch("/api/context-facts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "conversational",
            moduleId: sessionId,
            deltas,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { pending?: PendingRemoval[] };
        // Surface any removals the model couldn't confirm in chat, for a quick
        // yes/no at the close.
        if (Array.isArray(data.pending) && data.pending.length) {
          setPendingFactRemovals((prev) => {
            const seen = new Set(prev.map((p) => p.identity));
            return [...prev, ...data.pending!.filter((p) => !seen.has(p.identity))];
          });
        }
      } catch {
        // best-effort
      }
    })();

    if (sessionId === "4.5") {
      const current = userData.getBuild("4.5");
      if (current && current.type === "trade-offs") {
        const next = principlesAfterConversation(current.principles ?? [], deltas);
        if (
          next.length !== (current.principles ?? []).length ||
          next.some((p, i) => p !== current.principles?.[i])
        ) {
          void userData.saveBuild("4.5", { ...current, principles: next });
        }
      }
    }
  }

  // Resolve a surfaced pending removal: apply it (re-send the correction with its
  // identity confirmed, so the server rejects the fact) or discard it (the fact
  // stays active). Either way it leaves the confirmation list.
  function resolvePendingRemoval(removal: PendingRemoval, apply: boolean) {
    setPendingFactRemovals((prev) =>
      prev.filter((p) => p.identity !== removal.identity)
    );
    if (!apply || !user) return;
    void fetch("/api/context-facts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "conversational",
        moduleId: sessionId,
        deltas: { additions: [], removals: [{ label: removal.label }] },
        confirmedRemovalKeys: [removal.identity],
      }),
    }).catch(() => {});
  }

  // After a module completes, generate a short takeaway of what emerged and
  // store it for later modules to draw on. Runs in the background, so it never
  // blocks the done state. If generation fails, fall back to the interaction
  // summary if there is one; otherwise store nothing.
  async function generateAndStoreTakeaway(
    fullMessages: Message[],
    summaryOverride?: string
  ) {
    if (!user) return;
    // The override carries the interaction summary when buildResult state hasn't
    // settled yet (e.g. the letter module finalising in the same tick).
    const interactionSummary =
      summaryOverride ?? (buildResult ? summarizeBuild(buildResult) : "");

    const store = (text: string, textDirect?: string) => {
      if (!text.trim() || !user) return;
      void userData.saveTakeaway({
        moduleId: sessionId,
        moduleTitle: sessionTitle,
        text: text.trim(),
        textDirect: textDirect?.trim() || undefined,
        savedAt: new Date().toISOString(),
      });
    };

    // The facts already on record for this module, so the delta pass can target a
    // correction precisely (the "drop the 11am coffee" case) and not re-propose
    // something already captured.
    const knownFacts = user
      ? userData
          .getActiveFacts({ provenanceModule: sessionId })
          .map((f) => ({ label: f.data.label, category: f.category }))
      : [];

    try {
      const res = await fetch("/api/takeaway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: fullMessages,
          moduleTitle: sessionTitle,
          interactionSummary,
          knownFacts,
        }),
      });

      if (!res.ok) throw new Error(`Takeaway request failed: ${res.status}`);

      const data = (await res.json()) as {
        takeaway: string;
        takeawayDirect?: string;
        facts?: ConversationalDeltas;
      };
      store(data.takeaway || interactionSummary, data.takeawayDirect);
      // Fold any conversational fact changes into the canonical profile.
      if (data.facts) applyConversationalDeltas(data.facts);
    } catch {
      store(interactionSummary);
    }
  }

  // The money module (1.money) also produces a structured "Dreams" record: the
  // top three the person chose, why each stands out, and the achievable vs
  // pipedream split. These emerge only in conversation, so we extract them at
  // completion and store them alongside the full spark-prompts list. Runs in the
  // background and self-guards to the money module. If extraction fails, the full
  // list is still stored so the dreams are never lost.
  async function generateAndStoreDreams(fullMessages: Message[]) {
    if (!user) return;
    if (sessionId !== "1.money") return;
    const allDreams =
      buildResult && buildResult.type === "spark-prompts"
        ? buildResult.entries
        : [];

    const save = (
      top3: Dreams["top3"],
      achievable: Dreams["achievable"],
      pipeDreams: Dreams["pipeDreams"]
    ) => {
      const dreams: Dreams = {
        moduleId: sessionId,
        allDreams,
        top3,
        achievable,
        pipeDreams,
        savedAt: new Date().toISOString(),
      };
      void userData.saveDreams(dreams);
      // Reconcile the money module's facts from this record — the source that
      // keeps a pipe-dream walled off from anything plan-actionable.
      reconcileDreamsFacts(dreams);
    };

    try {
      const res = await fetch("/api/dreams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: fullMessages, allDreams }),
      });
      if (!res.ok) throw new Error(`Dreams request failed: ${res.status}`);
      const data = (await res.json()) as {
        top3: Dreams["top3"];
        achievable: Dreams["achievable"];
        pipeDreams: Dreams["pipeDreams"];
      };
      void save(data.top3 ?? [], data.achievable ?? [], data.pipeDreams ?? []);
    } catch {
      void save([], [], []);
    }
  }

  // At the close of the LAST Understand-stage module, synthesise the small set
  // of values the person confirmed across the stage and store it under
  // rlp_stage3_values for Stage 4 (and a later reveal) to draw on. Mirrors the
  // takeaway/dreams pattern: runs in the background, self-guards to the last
  // Stage 3 module, and falls back to assembling from the stored builds if the
  // model call fails — so the values are never lost.
  async function generateAndStoreStage3Values(fullMessages: Message[]) {
    if (!user) return;
    const isLastStage3Module =
      stageNumber === 3 &&
      stageModuleIds.length > 0 &&
      stageModuleIds[stageModuleIds.length - 1] === sessionId;
    if (!isLastStage3Module) return;

    // Gather the structured Stage 3 builds that name values.
    const stage3Builds = stageModuleIds
      .map((id) => userData.getBuild(id))
      .filter((b): b is BuildResult => b !== null);
    const triage = stage3Builds.find((b) => b.type === "value-triage");
    const ranking = stage3Builds.find((b) => b.type === "priority-choices");
    const defs = stage3Builds.find((b) => b.type === "value-definitions");

    // A deterministic assembly from the builds: ranking order first, then any
    // remaining defined or "that's me" values. "not really" values are dropped;
    // "not sure" values are kept but marked still-forming. Capped at five.
    const assembleFallback = (): Stage3Value[] => {
      const trayOf = new Map<string, "me" | "unsure" | "not">();
      if (triage?.type === "value-triage") {
        triage.sorted.forEach((s) => trayOf.set(s.label.toLowerCase(), s.tray));
      }
      const meaningOf = new Map<string, string>();
      if (defs?.type === "value-definitions") {
        defs.values.forEach((v) =>
          meaningOf.set(v.value.toLowerCase(), v.description)
        );
      }
      const out: Stage3Value[] = [];
      const seen = new Set<string>();
      const add = (label: string) => {
        const key = label.toLowerCase();
        if (seen.has(key) || trayOf.get(key) === "not") return;
        seen.add(key);
        out.push({
          value: label,
          meaning: meaningOf.get(key) ?? "",
          confidence: trayOf.get(key) === "unsure" ? "still forming" : "certain",
        });
      };
      if (ranking?.type === "priority-choices") ranking.ranked.forEach(add);
      if (defs?.type === "value-definitions")
        defs.values.forEach((v) => add(v.value));
      if (triage?.type === "value-triage")
        triage.sorted.filter((s) => s.tray === "me").forEach((s) => add(s.label));
      return out.slice(0, 5);
    };

    const save = (values: Stage3Value[]) => {
      const fallback = assembleFallback();
      const final = (values.length ? values : fallback).slice(0, 5);
      if (final.length === 0 || !user) return;
      void userData.saveStage3Values({
        values: final,
        savedAt: new Date().toISOString(),
      });
    };

    const valuesContext = [triage, ranking, defs]
      .flatMap((b) => (b ? [summarizeBuild(b)] : []))
      .filter(Boolean)
      .join("\n");

    try {
      const res = await fetch("/api/stage3-values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: fullMessages, valuesContext }),
      });
      if (!res.ok) throw new Error(`Stage 3 values request failed: ${res.status}`);
      const data = (await res.json()) as { values: Stage3Value[] };
      save(data.values ?? []);
    } catch {
      save([]);
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

  // The Stage 3 seed request itself — a pure fetch with no phase/state changes.
  // Assembles the person's context (including a terse recap of what they built in
  // earlier Stage 3 modules) and asks /api/stage3-seed for candidate content.
  // Shared by the during-reading prefetch and the runSeeding fallback so the seed
  // is fetched at most once, whichever path reaches it first. Returns the seed, or
  // null on any failure (the surface then renders from its own palette).
  async function fetchSeedDraft(): Promise<Stage3Seed | null> {
    if (!interaction || !isSeededType(interaction.type)) return null;
    const idx = stageModuleIds.indexOf(sessionId);
    const priorBuildResults = stageModuleIds
      .slice(0, idx === -1 ? 0 : idx)
      .map((id) => userData.getBuild(id))
      .filter((b): b is BuildResult => b !== null);
    const priorBuilds = priorBuildResults
      .map(summarizeBuild)
      .filter(Boolean)
      .join("\n");

    // The values the person actually chose earlier in Stage 3 (ranking order
    // first, then any "that's me" values from triage). Sent so the server can
    // fall back to THEIR values on value-definitions if the AI seed fails —
    // never a generic stand-in they never picked.
    const carryValues: string[] = [];
    const seenValue = new Set<string>();
    const addValue = (label: string) => {
      const key = label.trim().toLowerCase();
      if (!key || seenValue.has(key)) return;
      seenValue.add(key);
      carryValues.push(label.trim());
    };
    const ranking = priorBuildResults.find((b) => b.type === "priority-choices");
    const triage = priorBuildResults.find((b) => b.type === "value-triage");
    if (ranking?.type === "priority-choices") ranking.ranked.forEach(addValue);
    if (triage?.type === "value-triage")
      triage.sorted.filter((s) => s.tray === "me").forEach((s) => addValue(s.label));

    // The values the person MARKED as most core in 3.2 — the authoritative set the
    // 3.3 ranking and 3.4 definitions must weigh/define, never an AI re-inference.
    // Ordered by the 3.3 ranking where one already exists (so 3.4's cards follow
    // the order the person landed on), else by their 3.2 selection order. Same
    // ordering the reveal uses, so the whole values thread stays consistent.
    const markedCore =
      triage?.type === "value-triage" ? triage.core.filter(Boolean) : [];
    const rankedOrder =
      ranking?.type === "priority-choices" ? ranking.ranked.filter(Boolean) : [];
    const coreValues = markedCore.length
      ? [
          ...rankedOrder.filter((l) => markedCore.includes(l)),
          ...markedCore.filter((l) => !rankedOrder.includes(l)),
        ]
      : [];

    const body = JSON.stringify({
      seedType: interaction.type,
      onboardingContext: userData.buildOnboardingContext(),
      // The structured picks the seed grounds itself in now come from the
      // resolver's seed view (manifest-scoped, status=active) — replacing the
      // buildStage3Context registry and the uncapped takeaway prose.
      priorReflections: "",
      carryForward: resolveSeedText(sessionId, userData.getActiveFacts()),
      priorBuilds,
      carryValues,
      coreValues,
      hasPartner: userData.hasPartner(),
      retirementStage: userData.getRetirementStage(),
    });

    // One structured attempt. Returns the seed and whether the server had to fall
    // back to generic content (a failed or empty AI seed).
    const attempt = async (): Promise<{
      seed: Stage3Seed | null;
      fromFallback: boolean;
    }> => {
      const res = await fetch("/api/stage3-seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!res.ok) throw new Error(`Seed request failed: ${res.status}`);
      const data = (await res.json()) as {
        seed: Stage3Seed | null;
        fromFallback?: boolean;
      };
      return { seed: data.seed ?? null, fromFallback: data.fromFallback ?? false };
    };

    try {
      let result = await attempt();
      // Don't silently accept a fallback: give it one more real try before the
      // surface is built (and completed) on generic content.
      if (result.fromFallback) {
        try {
          const retry = await attempt();
          if (!retry.fromFallback) result = retry;
        } catch {
          // Keep the first result — the fallback is still safe to render.
        }
      }
      return result.seed;
    } catch {
      return null;
    }
  }

  // Pre-seed a Stage 3 surface, ending on the build step. If the during-reading
  // prefetch is already in flight, wait on it rather than firing a second request
  // (its own handler sets and persists the seed); otherwise fetch now — the case
  // where the person clicked past the reading before the prefetch could run.
  async function runSeeding() {
    if (!interaction || !isSeededType(interaction.type)) {
      setPhase("building");
      return;
    }
    setPhase("seeding");
    try {
      if (seedInFlightRef.current) {
        // The during-reading prefetch is already running (or done). Wait on it —
        // its own handler sets and persists the seed.
        await seedInFlightRef.current;
      } else {
        // No prefetch ran (e.g. the person clicked past the reading before the
        // data layer was ready). Claim it via the shared refs so the reading
        // prefetch effect can't also fire a second request, then fetch now.
        seedPrefetchedRef.current = true;
        const p = fetchSeedDraft();
        seedInFlightRef.current = p;
        const draft = await p;
        if (draft) {
          setSeed(draft);
          void userData.saveSeed(sessionId, draft);
        }
      }
    } finally {
      setPhase("building");
    }
  }

  // After the reading: the letter module goes to its writing surface; a Stage 3
  // surface goes through the seeding step first (unless it already has a seed);
  // other interaction modules go straight to the build step; everything else
  // goes straight to the conversation.
  function handleReadingDone() {
    if (isLetter) {
      setPhase("letter");
    } else if (isFirstYear) {
      setPhase("journey");
    } else if (interaction && isSeededType(interaction.type)) {
      if (seed) setPhase("building");
      else void runSeeding();
    } else if (interaction) {
      setPhase("building");
    } else {
      startConversation();
    }
  }

  // The letter is finalised. Persist it, mark the module complete, keep Vita's
  // closing line for the completion block, and capture the takeaway in the
  // background — mirroring how the conversation modules close.
  function handleLetterComplete(result: LetterResult, vitaMessage: string) {
    setBuildResult(result);
    void userData.saveBuild(sessionId, result);
    reconcileBuildFacts(result);
    // The retired letter (Phase 4) doesn't finish here — it flows into a
    // keep/change/leave conversation. Persist the letter and its letter_thread
    // fact (above), then open the chat; the conversation's normal close captures
    // the takeaway and the keep_change_leave deltas. The default letter keeps its
    // original single-nudge completion.
    if (letterHasConversation) {
      startConversation();
      return;
    }
    setLetterAck(vitaMessage);
    if (user) {
      void userData.markModuleComplete(sessionId);
      void generateAndStoreTakeaway([], summarizeBuild(result));
    }
    if (!completed) {
      setCompleted(true);
      setCompletedCount((n) => n + 1);
    }
  }

  // The first-year journey is settled. Persist it, mark the module complete, keep
  // Vita's closing line for the completion block, and capture the takeaway from the
  // editing chat plus the year's summary — mirroring how the letter module closes.
  function handleFirstYearComplete(
    result: BuildResult,
    vitaMessage: string,
    finalMessages: Message[]
  ) {
    setBuildResult(result);
    void userData.saveBuild(sessionId, result);
    reconcileBuildFacts(result);
    setFirstYearAck(vitaMessage);
    if (user) {
      void userData.markModuleComplete(sessionId);
      void generateAndStoreTakeaway(finalMessages, summarizeBuild(result));
    }
    if (!completed) {
      setCompleted(true);
      setCompletedCount((n) => n + 1);
    }
  }

  // The person finished the build step. Save the result so a refresh keeps it,
  // then open the conversation.
  function handleBuildFinish(result: BuildResult) {
    setBuildResult(result);
    void userData.saveBuild(sessionId, result);
    reconcileBuildFacts(result);
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
    // Diff the new build against the facts on record: new picks added, vanished
    // picks rejected (the re-edit removal case).
    if (changed) reconcileBuildFacts(result);
    if (changed && messages.length > 0) setEditAckPending(true);
    setPhase("conversation");
  }

  // Every forward action from a finished module (home, next module, the stage
  // reveal) routes through here. On a fresh completion we show the short
  // feedback card once, remembering where they were headed; on a revisit — or
  // once the card has already been shown for this module — we go straight there.
  function requestExit(dest: string) {
    if (!userData.hasPromptedModuleFeedback(sessionId)) {
      void userData.markModuleFeedbackPrompted(sessionId);
      pendingDestRef.current = dest;
      setShowFeedback(true);
      return;
    }
    router.push(dest);
  }

  // The feedback card is done with (submitted or skipped) — carry on to wherever
  // they were headed. The card saves its own answers, so there's nothing to do
  // here but navigate.
  function handleFeedbackContinue() {
    router.push(pendingDestRef.current);
  }

  // They set a closing commitment (e.g. a screening rhythm) — save it as a
  // concrete plan entry, then fall through to the completion CTAs.
  function handleCommitmentConfirm(commitment: ScreeningCommitmentResult) {
    void userData.saveCommitment(sessionId, commitment);
    setCommitmentDone(true);
  }

  // Skipped the commitment — store nothing, move on to the completion CTAs.
  function handleCommitmentSkip() {
    setCommitmentDone(true);
  }

  // Grow the composer to fit what's typed (up to a cap, then it scrolls), so a
  // longer message is comfortable to write and read back. Resets to one line
  // once the field is cleared after a send.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [input]);

  // Keep the newest streamed text in view. Runs on each smoothed frame (messages
  // update), but only follows when the reader is already near the bottom — if
  // they've scrolled up to re-read, we never yank them back down. We scroll the
  // page to its TRUE bottom rather than scrollIntoView-ing the end-of-list
  // sentinel: the composer (and any completion block) sit below that sentinel, so
  // aligning the sentinel to the viewport bottom would scroll the page *up* and
  // push the composer off-screen — the aggressive upward jump on reaching the
  // bottom. Going to document bottom instead settles at the real bottom, and
  // because the reveal grows a few characters per frame it reads as a smooth,
  // continuous follow rather than a jump.
  useEffect(() => {
    if (!streamingRef.current) return;
    const nearBottom =
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 160;
    if (nearBottom) {
      window.scrollTo({ top: document.documentElement.scrollHeight });
    }
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    const conversation: Message[] = [...messages, { role: "user", text }];
    setMessages(conversation);
    setInput("");
    setSending(true);
    setError(null);
    streamingRef.current = true;

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
      const raw = await streamChatReply(
        {
          messages: conversation,
          coachOpening: actualOpening,
          sessionInstructions: sessionInstructions ?? "",
          onboardingContext: userData.buildOnboardingContext(),
          priorReflections: priorReflectionsBlock(),
          sessionContent: sessionContent ?? primerText,
          interactionSummary: buildResult ? summarizeBuild(buildResult) : "",
          nextModuleTitle,
          closeInOneStep,
          editAcknowledgement,
          toneChoice: userData.getCoachTone(),
        },
        // Render Vita's reply as it streams, stripping any close marker from the
        // partial so it never flashes on screen before the final pass below.
        (partial) => {
          setMessages([
            ...conversation,
            { role: "coach", text: stripCompletionMarker(partial).text },
          ]);
        }
      );

      // If Vita signalled the close, strip the marker before it's shown or
      // stored. We don't finish the module here — instead we offer the close
      // choice (keep talking / wrap up here); finalizeClose does the rest.
      const { isClosing, text: replyText } = stripCompletionMarker(raw);

      const finalMessages: Message[] = [
        ...conversation,
        { role: "coach", text: replyText },
      ];
      setMessages(finalMessages);

      // The acknowledgement instruction fired on this call — clear it so it
      // doesn't repeat on later turns.
      if (editAckPending) setEditAckPending(false);

      if (isClosing) setPendingClose(true);
    } catch {
      // Roll the user's bubble back off the conversation and hand their words
      // back to the composer, so retrying is clean. The error is a transient
      // notice only — never added to the conversation or saved to localStorage,
      // so it can't be replayed to the API as one of Vita's turns.
      setMessages(messages);
      setInput(text);
      setError(COACH_ERROR_REPLY);
    } finally {
      // Flip off before returning, so the effect for the final setMessages (run
      // by React after this function settles) persists the completed exchange.
      streamingRef.current = false;
      setSending(false);
    }
  }

  // Label and gate wording flex with the primer's makeup: text-only reads,
  // video-only watches, and any mix gets neutral "Continue" wording.
  //
  // A still image counts as reading, not watching: the ask is still "read
  // this", and the picture sits with the words rather than replacing them. So
  // an image→text primer keeps the reading wording it would have had as
  // text alone. Anything with a moving or paged element (video, audio, a
  // slideshow) is a mix, and takes the neutral wording.
  const allText = primer.every((b) => b.type === "text" || b.type === "image");
  const allVideo = primer.every(
    (b) => b.type === "video" || b.type === "self-hosted-video"
  );
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

  // The stage's framing intro takes over the whole screen before the reading,
  // once, on the first session of the stage. Continuing records it as seen (so it
  // never returns) and drops into the reading exactly as if it had opened there.
  if (showStageIntro && stageIntro) {
    return (
      <StageIntro
        stage={stageIntro}
        onContinue={() => {
          if (user) void userData.markStageIntroSeen(stageNumber);
          setShowStageIntro(false);
        }}
      />
    );
  }

  // The Stage 4 modules are pre-populated from the person's earlier answers,
  // deterministic and free, no seed call. Both now read the resolver's seed view
  // (manifest-scoped, status=active) rather than the lossy user-model re-derivation:
  // 4.2's seasons board takes a flat set of cards; 4.3's springboards come from the
  // recurring_activity facts grouped by balanced area.
  // The board reads Vita's tidied (de-duplicated) cards once they've landed in the
  // cache, and falls back to the raw fact-sourced cards until then — so it always
  // renders, just with the near-duplicates still showing if the tidy hasn't
  // finished. The tidy only groups same-intent cards; it never drops a distinct one.
  const seededCards =
    interaction?.type === "seasons-board"
      ? (userData.getSeasonsCardsSeed(sessionId)?.cards ??
        seasonCardsFromFacts(
          resolveSeedItems(sessionId, userData.getActiveFacts())
        ))
      : [];
  const balancedSeed: BalancedSeed | null =
    interaction?.type === "balanced-goals"
      ? springboardsFromFacts(
          resolveSeedItems(sessionId, userData.getActiveFacts(), "recurring_activity")
        )
      : null;
  // The rich picture built up across the earlier stages — the input the Stage 4
  // surfaces draft from. Now the resolver's seed view for this module.
  const planUserModelText =
    interaction?.type === "balanced-goals" ||
    interaction?.type === "goal-paths" ||
    interaction?.type === "trade-offs" ||
    interaction?.type === "week-shape" ||
    interaction?.type === "first-year"
      ? resolveSeedText(sessionId, userData.getActiveFacts())
      : "";

  return (
    <div style={styles.container}>
      <style>{focusCss + primerMediaCss}</style>

      {/* ZONE 1 — PROGRAMME HEADER */}
      <header style={styles.header}>
        <div style={styles.stageLine}>
          Stage {stageNumber} of {totalStages} · {stageName}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <ModuleIconChip
            stageKey={STAGE_KEYS[stageNumber - 1]}
            moduleId={sessionId}
            size="lg"
          />
          <h1 style={styles.title}>{sessionTitle}</h1>
        </div>
        <div style={styles.progress}>
          <div style={styles.progressLabel}>
            {completedCount} of {modulesInStage} sessions complete
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
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            {durationMin} min
          </span>
        </div>

        {primer.map((block, i) => {
          if (block.type === "video") {
            return (
              <div key={i} style={styles.videoFrame}>
                <iframe
                  src={youtubeEmbedUrl(block.url)}
                  title={sessionTitle || "Session video"}
                  style={styles.videoIframe}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            );
          }
          if (block.type === "image") {
            return <PrimerImage key={i} src={block.src} alt={block.alt} />;
          }
          if (block.type === "image-slideshow") {
            return <PrimerSlideshow key={i} images={block.images} />;
          }
          if (block.type === "audio") {
            return <PrimerAudio key={i} src={block.src} title={block.title} />;
          }
          if (block.type === "self-hosted-video") {
            return (
              <PrimerVideo key={i} src={block.src} poster={block.poster} />
            );
          }
          if (block.type === "links") {
            return (
              <div key={i} style={styles.linksBlock}>
                {block.links.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="primer-link"
                    style={styles.primerLink}
                  >
                    <span aria-hidden="true">↗</span>
                    {link.label}
                  </a>
                ))}
              </div>
            );
          }
          return <PrimerText key={i} value={block.value} />;
        })}

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

      {/* ZONE 2.4 — SEEDING (Stage 3: preparing the surface) */}
      {phase === "seeding" && (
        <section style={styles.seedingStep} role="status" aria-live="polite">
          <div style={styles.vitaLockup}>
            <VitaMark size={34} />
            <span style={styles.vitaName}>Vita</span>
          </div>
          <span className="seeding-dots" aria-hidden="true">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </span>
          <p style={styles.seedingLine}>Setting this up from what you&apos;ve shared…</p>
          <p style={styles.seedingSubLine}>
            This can take up to a minute. Please keep this page open while Vita
            gets it ready.
          </p>
        </section>
      )}

      {/* ZONE 2.5 — INTERACTION (only modules that have one) */}
      {phase === "building" && interaction && (
        <InteractionStep
          interaction={interaction}
          seed={seed}
          seededCards={seededCards}
          balancedSeed={balancedSeed}
          onFinish={handleBuildFinish}
          hasPartner={userData.hasPartner()}
          sessionId={sessionId}
          userModelText={planUserModelText}
          onboardingContext={userData.buildOnboardingContext()}
        />
      )}

      {/* ZONE 2.6 — EDITING (re-opened interaction, pre-filled) */}
      {phase === "editing" && interaction && (
        <InteractionStep
          interaction={interaction}
          seed={seed}
          seededCards={seededCards}
          balancedSeed={balancedSeed}
          onFinish={handleEditSave}
          mode="edit"
          initial={buildResult ?? undefined}
          onCancel={handleEditCancel}
          hasPartner={userData.hasPartner()}
          sessionId={sessionId}
          userModelText={planUserModelText}
          onboardingContext={userData.buildOnboardingContext()}
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
            <VitaMark size={34} />
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
            {/* Show the typing dots only until Vita's first streamed token
                lands — once her (partial) bubble is on screen it carries the
                "still writing" cue itself, so the dots would just sit below it. */}
            {sending && messages[messages.length - 1]?.role !== "coach" && (
              <TypingBubble />
            )}
          </div>

          {completed && pendingFactRemovals.length > 0 && (
            <PendingRemovals
              removals={pendingFactRemovals}
              onResolve={resolvePendingRemoval}
            />
          )}

          {completed && !reopened ? (
            closingCommitment && !commitmentDone ? (
              <ScreeningCommitment
                config={closingCommitment}
                initial={userData.getCommitment(sessionId) ?? undefined}
                onConfirm={handleCommitmentConfirm}
                onSkip={handleCommitmentSkip}
              />
            ) : (
              <CompletionBlock
                showFeedback={showFeedback}
                moduleId={sessionId}
                onFeedbackContinue={handleFeedbackContinue}
                revealHref={revealHref}
                revealLabel={revealLabel}
                onExit={requestExit}
                nextHref={nextHref}
                onKeepTalking={() => setReopened(true)}
              />
            )
          ) : pendingClose ? (
            <CloseChoice
              onKeepTalking={() => setPendingClose(false)}
              onWrapUp={() => finalizeClose(messages)}
            />
          ) : (
            <>
              {error && (
                <div style={styles.errorNotice} role="status">
                  {error}
                </div>
              )}

              <div style={styles.composer}>
                <textarea
                  ref={composerRef}
                  className="composer-input"
                  style={styles.input}
                  placeholder="Type your message…"
                  rows={1}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (error) setError(null);
                  }}
                  onFocus={() => {
                    // On mobile the composer sits at the end of a long scrolling
                    // page, so when the on-screen keyboard opens it can be left
                    // off-screen. Once the keyboard has had a moment to animate in,
                    // ensure the input is visible — but only just: block "nearest"
                    // scrolls the minimum needed, so an already-visible composer
                    // stays put rather than being yanked to the centre of the
                    // viewport (which threw the page upward when tapping to type).
                    setTimeout(() => {
                      composerRef.current?.scrollIntoView({
                        block: "nearest",
                        behavior: "smooth",
                      });
                    }, 300);
                  }}
                  onKeyDown={(e) => {
                    // Enter sends; Shift+Enter starts a new line, so a longer
                    // thought can be written without firing it half-finished.
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
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

      {/* ZONE 4 — LETTER (its own writing surface; replaces the conversation) */}
      {interaction &&
        interaction.type === "letter" &&
        phase === "letter" &&
        !completed && (
          <LetterFlow
            interaction={interaction}
            priorReflections={resolveSeedText(sessionId, userData.getActiveFacts())}
            initial={buildResult?.type === "letter" ? buildResult : undefined}
            writingPlaceholder={letterWritingPlaceholder}
            retired={letterHasConversation}
            onComplete={handleLetterComplete}
          />
        )}

      {/* ZONE 4.5 — LETTER COMPLETE (Vita's closing line + the reveal/home CTAs).
          Only the default letter, which has no conversation, closes here; the
          retired letter closes through the normal conversation zone below. */}
      {isLetter && completed && !letterHasConversation && (
        <section style={styles.conversationZone}>
          <div style={styles.vitaLockup}>
            <VitaMark size={34} />
            <span style={styles.vitaName}>Vita</span>
            <span style={styles.coachPill}>Your retirement coach</span>
          </div>

          {letterAck && (
            <div style={styles.messageList}>
              <CoachBubble text={letterAck} />
            </div>
          )}

          <CompletionBlock
            showFeedback={showFeedback}
            moduleId={sessionId}
            onFeedbackContinue={handleFeedbackContinue}
            revealHref={revealHref}
            revealLabel={revealLabel}
            onExit={requestExit}
            nextHref={nextHref}
          />
        </section>
      )}

      {/* ZONE 5 — FIRST-YEAR JOURNEY (its own timeline + story + editing chat) */}
      {isFirstYear &&
        interaction.type === "first-year" &&
        phase === "journey" &&
        !completed && (
          <FirstYearJourney
            interaction={interaction}
            sessionId={sessionId}
            userModelText={planUserModelText}
            onboardingContext={userData.buildOnboardingContext()}
            hasPartner={userData.hasPartner()}
            sessionInstructions={sessionInstructions ?? ""}
            onComplete={handleFirstYearComplete}
          />
        )}

      {/* ZONE 5.5 — FIRST-YEAR COMPLETE (recap + Vita's line + the CTAs) */}
      {isFirstYear && completed && (
        <section style={styles.conversationZone}>
          {buildResult && buildResult.type === "first-year" && (
            <section style={styles.summaryCard}>
              <FirstYearSummary result={buildResult} />
            </section>
          )}

          <div style={styles.vitaLockup}>
            <VitaMark size={34} />
            <span style={styles.vitaName}>Vita</span>
            <span style={styles.coachPill}>Your retirement coach</span>
          </div>

          {firstYearAck && (
            <div style={styles.messageList}>
              <CoachBubble text={firstYearAck} />
            </div>
          )}

          <CompletionBlock
            showFeedback={showFeedback}
            moduleId={sessionId}
            onFeedbackContinue={handleFeedbackContinue}
            revealHref={revealHref}
            revealLabel={revealLabel}
            onExit={requestExit}
            nextHref={nextHref}
          />
        </section>
      )}
    </div>
  );
}

// A quick yes/no for corrections Vita picked up in conversation but couldn't be
// sure about — so the person confirms a drop before it's applied (mirroring the
// edit-acknowledgement pattern). Each removal is its own line: keep, or drop.
function PendingRemovals({
  removals,
  onResolve,
}: {
  removals: PendingRemoval[];
  onResolve: (removal: PendingRemoval, apply: boolean) => void;
}) {
  return (
    <section style={styles.pendingWrap}>
      <p style={styles.pendingIntro}>
        One quick check — did you want to change this?
      </p>
      {removals.map((r) => (
        <div key={r.identity} style={styles.pendingRow}>
          <div style={styles.pendingText}>
            <span style={styles.pendingLabel}>
              Drop &ldquo;{r.label}&rdquo;?
            </span>
            {r.quote && (
              <span style={styles.pendingQuote}>
                You said: &ldquo;{r.quote}&rdquo;
              </span>
            )}
          </div>
          <div style={styles.pendingActions}>
            <button
              type="button"
              style={styles.pendingDrop}
              onClick={() => onResolve(r, true)}
            >
              Yes, drop it
            </button>
            <button
              type="button"
              style={styles.pendingKeep}
              onClick={() => onResolve(r, false)}
            >
              No, keep it
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}

// The finished-module panel: Vita's "you've finished" cue and the forward CTAs
// (the stage reveal where there is one, otherwise back-to-home and an optional
// next module), or the short feedback card when a forward action has just fired
// on a fresh completion. Every forward action goes through onExit, so the card
// can appear once before moving on. "Keep talking" only applies to conversation
// modules, so it's shown only when onKeepTalking is provided.
function CompletionBlock({
  showFeedback,
  moduleId,
  onFeedbackContinue,
  revealHref,
  revealLabel,
  onExit,
  nextHref,
  onKeepTalking,
}: {
  showFeedback: boolean;
  moduleId: string;
  onFeedbackContinue: () => void;
  revealHref: string | null;
  revealLabel: string | null;
  onExit: (dest: string) => void;
  nextHref: string | null;
  onKeepTalking?: () => void;
}) {
  if (showFeedback) {
    // Done and Skip both simply continue — the card saves its own answers.
    return (
      <ModuleFeedbackCard
        moduleId={moduleId}
        onDone={onFeedbackContinue}
        onSkip={onFeedbackContinue}
      />
    );
  }
  return (
    <div style={styles.completeBlock}>
      <p style={styles.completeCue}>
        <span aria-hidden="true">✓</span> You&apos;ve finished this session
      </p>
      <div style={styles.completeActions}>
        {revealHref ? (
          <>
            {/* End of the stage — the reveal is the natural next step, so it
                leads; "Back to home" is the secondary action. Both route through
                onExit, which shows the feedback card once before moving on. */}
            <button
              type="button"
              className="home-complete-btn"
              style={styles.homeCompleteButton}
              onClick={() => onExit(revealHref)}
            >
              {revealLabel ?? "See your reveal →"}
            </button>
            <button
              type="button"
              className="next-complete-btn"
              style={styles.nextCompleteButton}
              onClick={() => onExit("/home")}
            >
              Back to home
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="home-complete-btn"
              style={styles.homeCompleteButton}
              onClick={() => onExit("/home")}
            >
              Back to home
            </button>
            {nextHref && (
              <button
                type="button"
                className="next-complete-btn"
                style={styles.nextCompleteButton}
                onClick={() => onExit(nextHref)}
              >
                Next session →
              </button>
            )}
          </>
        )}
      </div>
      {onKeepTalking && (
        <button
          type="button"
          className="keep-talking-link"
          style={styles.keepTalkingLink}
          onClick={onKeepTalking}
        >
          Want to add something? Keep talking
        </button>
      )}
    </div>
  );
}

// When Vita's reply signals a natural finish, the person decides whether to end
// here or keep going — we never auto-close on their behalf. "Wrap up here"
// finalises the module; "Keep talking" re-opens the composer.
function CloseChoice({
  onKeepTalking,
  onWrapUp,
}: {
  onKeepTalking: () => void;
  onWrapUp: () => void;
}) {
  return (
    <div style={styles.completeBlock}>
      <p style={styles.closeChoicePrompt}>Are you ready to wrap this session up here, or do you want to keep talking with Vita?</p>
      <div style={styles.completeActions}>
        <button
          type="button"
          className="home-complete-btn"
          style={styles.homeCompleteButton}
          onClick={onWrapUp}
        >
          Finish this session
        </button>
        <button
          type="button"
          className="next-complete-btn"
          style={styles.nextCompleteButton}
          onClick={onKeepTalking}
        >
          Keep talking
        </button>
      </div>
    </div>
  );
}

// Picks the right interaction UI for the module's interaction type. New types
// get a case here; until then they fall back to a harmless placeholder so a
// half-configured module never breaks the screen.
function InteractionStep({
  interaction,
  seed = null,
  seededCards = [],
  balancedSeed = null,
  onFinish,
  mode = "create",
  initial,
  onCancel,
  hasPartner = false,
  sessionId = "",
  userModelText = "",
  onboardingContext = "",
}: {
  interaction: Interaction;
  // The seeded candidate content for Stage 3 surfaces; null for every other type.
  seed?: Stage3Seed | null;
  // Pre-populated cards for the Stage 4 seasons board (4.2); empty otherwise.
  seededCards?: SeasonCard[];
  // Pre-populated springboards for the balanced-goals exercise (4.3); null
  // for every other type.
  balancedSeed?: BalancedSeed | null;
  onFinish: (result: BuildResult) => void;
  mode?: InteractionMode;
  // The stored result to pre-fill from in edit mode. Its type always matches
  // the interaction type, so each case narrows it with a cast.
  initial?: BuildResult;
  onCancel?: () => void;
  // Whether the person has a partner — gates partner-only fear cards in 3.5.
  hasPartner?: boolean;
  // The module id — balanced-goals (4.3) caches its drafted seed under it.
  sessionId?: string;
  // The rendered user model + onboarding line — input for the 4.3 goal draft.
  userModelText?: string;
  onboardingContext?: string;
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
    case "spark-prompts":
      return (
        <SparkPrompts
          interaction={interaction}
          onFinish={onFinish}
          mode={mode}
          initial={initial?.type === "spark-prompts" ? initial : undefined}
          onCancel={onCancel}
        />
      );
    case "screening-check":
      return (
        <ScreeningCheck
          interaction={interaction}
          onFinish={onFinish}
          mode={mode}
          initial={initial?.type === "screening-check" ? initial : undefined}
          onCancel={onCancel}
        />
      );
    case "mirror-cards":
      return (
        <MirrorCards
          interaction={interaction}
          seed={seed}
          onFinish={onFinish}
          mode={mode}
          initial={initial?.type === "mirror-cards" ? initial : undefined}
          onCancel={onCancel}
        />
      );
    case "value-triage":
      return (
        <ValueTriage
          interaction={interaction}
          seed={seed}
          onFinish={onFinish}
          mode={mode}
          initial={initial?.type === "value-triage" ? initial : undefined}
          onCancel={onCancel}
        />
      );
    case "priority-choices":
      return (
        <PriorityChoices
          interaction={interaction}
          seed={seed}
          onFinish={onFinish}
          mode={mode}
          initial={initial?.type === "priority-choices" ? initial : undefined}
          onCancel={onCancel}
        />
      );
    case "value-definitions":
      return (
        <ValueDefinitions
          interaction={interaction}
          seed={seed}
          onFinish={onFinish}
          mode={mode}
          initial={initial?.type === "value-definitions" ? initial : undefined}
          onCancel={onCancel}
        />
      );
    case "hopes-fears":
      return (
        <HopesFears
          interaction={interaction}
          seed={seed}
          onFinish={onFinish}
          mode={mode}
          initial={initial?.type === "hopes-fears" ? initial : undefined}
          onCancel={onCancel}
          hasPartner={hasPartner}
        />
      );
    case "bigger-picture":
      return (
        <BiggerPicture
          interaction={interaction}
          seed={seed}
          onFinish={onFinish}
          mode={mode}
          initial={initial?.type === "bigger-picture" ? initial : undefined}
          onCancel={onCancel}
        />
      );
    case "readiness-snapshot":
      return (
        <ReadinessSnapshot
          interaction={interaction}
          onFinish={onFinish}
          mode={mode}
          initial={
            initial?.type === "readiness-snapshot" ? initial : undefined
          }
          onCancel={onCancel}
        />
      );
    case "seasons-board":
      return (
        <SeasonsBoard
          interaction={interaction}
          cards={seededCards}
          onFinish={onFinish}
          mode={mode}
          initial={initial?.type === "seasons-board" ? initial : undefined}
          onCancel={onCancel}
        />
      );
    case "balanced-goals":
      return (
        <BalancedGoals
          interaction={interaction}
          seed={balancedSeed ?? { springboards: [] }}
          sessionId={sessionId}
          userModelText={userModelText}
          onboardingContext={onboardingContext}
          hasPartner={hasPartner}
          onFinish={onFinish}
          mode={mode}
          initial={initial?.type === "balanced-goals" ? initial : undefined}
          onCancel={onCancel}
        />
      );
    case "goal-paths":
      return (
        <GoalPaths
          interaction={interaction}
          sessionId={sessionId}
          userModelText={userModelText}
          onboardingContext={onboardingContext}
          hasPartner={hasPartner}
          onFinish={onFinish}
          mode={mode}
          initial={initial?.type === "goal-paths" ? initial : undefined}
          onCancel={onCancel}
        />
      );
    case "trade-offs":
      return (
        <TradeOffs
          interaction={interaction}
          sessionId={sessionId}
          userModelText={userModelText}
          onboardingContext={onboardingContext}
          hasPartner={hasPartner}
          onFinish={onFinish}
          mode={mode}
          initial={initial?.type === "trade-offs" ? initial : undefined}
          onCancel={onCancel}
        />
      );
    case "week-shape":
      return (
        <WeekShape
          interaction={interaction}
          sessionId={sessionId}
          userModelText={userModelText}
          onboardingContext={onboardingContext}
          hasPartner={hasPartner}
          onFinish={onFinish}
          mode={mode}
          initial={initial?.type === "week-shape" ? initial : undefined}
          onCancel={onCancel}
        />
      );
    case "composite":
      return (
        <CompositeStep
          interaction={interaction}
          onFinish={onFinish}
          mode={mode}
          initial={initial?.type === "composite" ? initial : undefined}
          onCancel={onCancel}
        />
      );
    default:
      // The letter interaction doesn't run through InteractionStep — it has its
      // own phase and surface (LetterFlow). Other unknown types fall back here.
      return (
        <section style={styles.placeholderStep}>[interaction coming soon]</section>
      );
  }
}

// Whether a composite sub-step has been answered enough to finish. Sliders
// always have a position; the picker honours its select range (or "at least one").
function isStepValid(
  interaction: Interaction,
  result: BuildResult | null
): boolean {
  if (!result) return false;
  switch (interaction.type) {
    case "role-picker": {
      if (result.type !== "role-picker") return false;
      const min = interaction.selectRange?.min ?? 1;
      const max = interaction.selectRange?.max;
      const n = result.picked.length;
      return n >= min && (max === undefined || n <= max);
    }
    case "sliders":
      return result.type === "sliders";
    default:
      return true;
  }
}

// Renders one composite sub-interaction in embedded mode — no finish button of
// its own; it reports its current value up via onChange. Only the composable
// primitives are embeddable.
function EmbeddedInteraction({
  interaction,
  initial,
  onChange,
  showHelper = true,
}: {
  interaction: Interaction;
  initial?: BuildResult;
  onChange: (result: BuildResult) => void;
  // The helper cue ("drag the slider", "tap each one") shows once per group —
  // the composite passes false to repeated steps of the same type.
  showHelper?: boolean;
}) {
  switch (interaction.type) {
    case "role-picker":
      return (
        <RolePicker
          interaction={interaction}
          embedded
          showHelper={showHelper}
          onChange={onChange}
          onFinish={() => {}}
          initial={initial?.type === "role-picker" ? initial : undefined}
        />
      );
    case "sliders":
      return (
        <Sliders
          interaction={interaction}
          embedded
          showHelper={showHelper}
          onChange={onChange}
          onFinish={() => {}}
          initial={initial?.type === "sliders" ? initial : undefined}
        />
      );
    default:
      return (
        <section style={styles.placeholderStep}>[interaction coming soon]</section>
      );
  }
}

// Runs two or more sub-interactions on one screen as a single build step. Each
// sub-step reports its value up; one shared finish button completes them all,
// gated until every sub-step is valid. Edit mode pre-fills from the stored
// composite result.
function CompositeStep({
  interaction,
  onFinish,
  mode = "create",
  initial,
  onCancel,
}: {
  interaction: CompositeInteraction;
  onFinish: (result: BuildResult) => void;
  mode?: InteractionMode;
  initial?: CompositeResult;
  onCancel?: () => void;
}) {
  const steps = interaction.steps;
  const [results, setResults] = useState<(BuildResult | null)[]>(() =>
    steps.map((_, i) => initial?.results[i] ?? null)
  );

  const setStepResult = (i: number, r: BuildResult) =>
    setResults((prev) => prev.map((p, idx) => (idx === i ? r : p)));

  const allValid = steps.every((s, i) => isStepValid(s, results[i]));

  // The how-to-act helper cue shows once per interaction type: only the first
  // step of each type renders it, so e.g. four sliders don't repeat "drag the
  // slider" four times.
  const firstOfType: Record<string, number> = {};
  steps.forEach((s, i) => {
    if (firstOfType[s.type] === undefined) firstOfType[s.type] = i;
  });

  return (
    <section style={styles.compositeStep}>
      {steps.map((step, i) => (
        <div key={i} style={styles.compositeStepPart}>
          {interaction.stepHeadings?.[i] ? (
            <p style={styles.compositeStepHeading}>{interaction.stepHeadings[i]}</p>
          ) : null}
          <EmbeddedInteraction
            interaction={step}
            initial={initial?.results[i]}
            onChange={(r) => setStepResult(i, r)}
            showHelper={firstOfType[step.type] === i}
          />
        </div>
      ))}
      <FinishControls
        mode={mode}
        disabled={!allValid}
        onFinish={() =>
          onFinish({ type: "composite", results: results as BuildResult[] })
        }
        onCancel={onCancel}
        hint={allValid ? undefined : "Make a choice on each before continuing."}
      />
    </section>
  );
}

// Vita is told to write plain prose, but strip any stray markdown emphasis she
// slips in — the bubble renders raw text, so a leftover ** or * would otherwise
// show as literal asterisks.
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

function CoachBubble({ text }: { text: string }) {
  // Vita breaks longer replies into paragraphs with a blank line between them.
  // The bubble collapses whitespace, so render each paragraph as its own block
  // (splitting on any run of newlines) to keep the spacing she intended. Short
  // replies are a single paragraph and look exactly as before.
  const paragraphs = stripMarkdown(text)
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <div style={styles.coachRow}>
      <div style={styles.coachBubble}>
        {(paragraphs.length ? paragraphs : [""]).map((p, i) => (
          <p
            key={i}
            style={i === 0 ? styles.coachParagraph : styles.coachParagraphNext}
          >
            {p}
          </p>
        ))}
      </div>
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
    background: "var(--ink)",
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
    // A warm off-white (a hint of Chorus Yellow), softer corners and a lighter
    // hairline than the old flat-white form card — reads editorial, not clinical.
    background: "color-mix(in srgb, var(--chorus-yellow) 8%, #fff)",
    border: "1px solid color-mix(in srgb, var(--ink) 8%, transparent)",
    borderRadius: "var(--r-xl)",
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
    border: "1px solid color-mix(in srgb, var(--ink) 14%, transparent)",
    borderRadius: "var(--r-pill)",
    padding: "4px 11px",
    fontFamily: "var(--font-sans)",
    fontSize: "13px",
    color: "var(--text-muted)",
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
  linksBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  primerLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    alignSelf: "flex-start",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-sm)",
    boxShadow: "var(--shadow-sm)",
    padding: "10px 16px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--brand-primary)",
    textDecoration: "none",
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
  seedingStep: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "14px",
    paddingTop: "48px",
    paddingBottom: "16px",
    marginTop: "8px",
    borderTop: "1px solid var(--border)",
  },
  seedingLine: {
    fontFamily: "var(--font-serif)",
    fontStyle: "italic",
    fontSize: "var(--fs-title)",
    color: "var(--ink)",
    margin: 0,
    textAlign: "center",
  },
  seedingSubLine: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    margin: 0,
    maxWidth: "34ch",
    textAlign: "center",
    lineHeight: "var(--lh-body)",
  },
  summaryCard: {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-lg)",
    padding: "20px 24px",
    boxShadow: "var(--shadow-sm)",
  },
  compositeStep: {
    display: "flex",
    flexDirection: "column",
    gap: "32px",
    paddingTop: "36px",
    marginTop: "8px",
    borderTop: "1px solid var(--border)",
  },
  compositeStepPart: {
    display: "flex",
    flexDirection: "column",
  },
  compositeStepHeading: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-title)",
    fontWeight: 600,
    color: "var(--ink)",
    lineHeight: 1.3,
    margin: "0 0 4px",
  },
  compositeSummaryStack: {
    display: "flex",
    flexDirection: "column",
    gap: "22px",
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
    borderTop: "1px solid color-mix(in srgb, var(--ink) 10%, transparent)",
  },
  pendingWrap: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    background: "var(--warm-surface)",
    border: "1px solid var(--warm-line)",
    borderRadius: "var(--r-md)",
    padding: "16px 18px",
  },
  pendingIntro: {
    margin: 0,
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text)",
  },
  pendingRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
  },
  pendingText: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    flex: "1 1 auto",
    minWidth: 0,
  },
  pendingLabel: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    color: "var(--ink)",
  },
  pendingQuote: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontStyle: "italic",
    color: "var(--text-muted)",
  },
  pendingActions: { display: "flex", gap: "8px" },
  pendingDrop: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--brand-on-primary)",
    background: "var(--brand-primary)",
    border: "none",
    borderRadius: "var(--r-sm)",
    padding: "8px 14px",
    minHeight: "40px",
    cursor: "pointer",
  },
  pendingKeep: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--ink)",
    background: "transparent",
    border: "1px solid var(--border-strong)",
    borderRadius: "var(--r-sm)",
    padding: "8px 14px",
    minHeight: "40px",
    cursor: "pointer",
  },
  vitaLockup: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
  },
  vitaName: {
    fontFamily: "var(--font-serif)",
    fontSize: "19px",
    fontWeight: 600,
    color: "var(--color-vita)",
  },
  coachPill: {
    background: "var(--color-vita)",
    color: "#fff",
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
  // One paragraph of a coach message. The first has no outer margin, so a
  // single-paragraph bubble looks exactly as before; later paragraphs carry a
  // top margin that becomes the blank line Vita intended in a longer reply.
  coachParagraph: {
    margin: 0,
  },
  coachParagraphNext: {
    margin: 0,
    marginTop: "0.75em",
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
  closeChoicePrompt: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-body)",
    color: "var(--text)",
    textAlign: "center",
    margin: 0,
  },
  completeActions: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    width: "100%",
    maxWidth: "360px",
  },
  homeCompleteButton: {
    width: "100%",
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
    border: "none",
    borderRadius: "var(--r-sm)",
    padding: "13px 24px",
    textDecoration: "none",
    boxShadow: "var(--shadow-sm)",
    cursor: "pointer",
  },
  nextCompleteButton: {
    width: "100%",
    minHeight: "48px",
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg)",
    color: "var(--brand-primary)",
    border: "1.5px solid var(--brand-primary)",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    fontWeight: 600,
    borderRadius: "var(--r-sm)",
    padding: "13px 24px",
    textDecoration: "none",
    cursor: "pointer",
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
    alignItems: "flex-end",
    marginTop: "4px",
  },
  input: {
    flex: 1,
    background: "var(--bg)",
    border: "1.5px solid var(--border-strong)",
    borderRadius: "var(--r-sm)",
    padding: "13px 16px",
    minHeight: "48px",
    maxHeight: "180px",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    color: "var(--text)",
    outline: "none",
    resize: "none",
    overflowY: "auto",
    boxSizing: "border-box",
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
  .home-complete-btn:hover { background: var(--brand-primary-hover); }
  .next-complete-btn:hover {
    border-color: var(--brand-primary);
    background: var(--bg-alt);
  }
  .primary-btn:focus-visible,
  .send-btn:focus-visible,
  .home-complete-btn:focus-visible,
  .next-complete-btn:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .composer-input:focus-visible {
    border-color: var(--brand-primary);
    box-shadow: var(--focus-ring);
  }
  .primer-link:hover {
    border-color: var(--brand-primary);
    background: var(--bg-alt);
  }
  .primer-link:focus-visible {
    outline: none;
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
  .seeding-dots {
    display: inline-flex;
    gap: 5px;
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
