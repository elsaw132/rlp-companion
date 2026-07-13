"use client";

// The client data layer. It replaces the old per-key localStorage helpers: it
// fetches the signed-in user's whole row-set once per page into an in-memory
// snapshot, exposes synchronous getters over that snapshot (so the derivation
// logic that used to read localStorage during render still works), and async
// write-through setters that update the snapshot optimistically and persist via
// /api/user-data. The browser never sends a user id — the server derives it
// from the Clerk session. DB reads are async, so pages show a brief loading
// state, and the very first query after the database has been idle can take a
// second or two to wake — that's expected.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useUser } from "@clerk/nextjs";
import {
  getModulesBefore,
  type BuildResult,
  type ScreeningCommitment,
} from "@/lib/modules";
import {
  CONTEXT_FACTS_SNAPSHOT_KEY,
  type StoredFact,
  type FactCategory,
} from "@/lib/contextFacts";
import { getActiveStageNumber } from "@/lib/progress";
import type { Takeaway } from "@/lib/takeaways";
import type { Dreams } from "@/lib/dreams";
import type { RevealSynthesis, SavedStageReveal } from "@/lib/stageReveal";
import type {
  Stage2Synthesis,
  SavedStage2Reveal,
} from "@/lib/stage2Reveal";
import type {
  Stage3Synthesis,
  SavedStage3Reveal,
} from "@/lib/stage3Reveal";
import type { Stage3Seed, Stage3ValuesSummary } from "@/lib/stage3Seed";
import type { BalancedGoalsSeed } from "@/lib/balancedGoalsSeed";
import type { GoalPathsSeed } from "@/lib/goalPathsSeed";
import type { TradeOffsSeed } from "@/lib/tradeOffsSeed";
import type { WeekShapeSeed } from "@/lib/weekShapeSeed";
import type { FirstYearSeed } from "@/lib/firstYearSeed";
import type { PlanIntro } from "@/lib/planIntro";
import { stripStructuredLeak } from "@/lib/coachText";

// ---- Shapes shared across the app ----

// The register the person picks for Vita at onboarding. Stored as a stable code
// value (not the display label) and mapped to a tone directive in the chat API.
// Shifts surface tone only — never the structural coaching rules.
export type CoachTone = "warm" | "professional" | "playful";

// Where the person is with work and retirement, captured at onboarding (behind
// the RETIREMENT_PATHS flag). Threaded through the same rails as hasPartner so
// later phases can adapt content per cohort; nothing branches on it yet.
//   working          — still working, planning ahead
//   winding_down     — phasing out of work now
//   recently_retired — retired within about the last 2 years
//   established      — retired more than 2 years ago
export type RetirementStage =
  | "working"
  | "winding_down"
  | "recently_retired"
  | "established";

export type OnboardingAnswers = {
  partner?: string;
  horizon?: string;
  motivation?: string | null;
  // Where they are with work and retirement. Absent for existing users and
  // anyone onboarded with the RETIREMENT_PATHS flag off — read through
  // getRetirementStage(), which returns null when it isn't set.
  retirementStage?: RetirementStage;
  // Date of birth, ISO YYYY-MM-DD. Optional: existing users and anyone who skips
  // it have none, and every age-dependent path degrades gracefully without it.
  // Used to compute real age at read time (the 2.6 hearing-check gate).
  dob?: string;
  // How they'd like Vita to talk with them. Absent for existing users and
  // anyone before the tone step — read through getCoachTone(), which defaults
  // to "warm".
  tone?: CoachTone;
};

export type ConversationMessage = {
  role: "coach" | "user";
  text: string;
};

// ---- Logical keys (the former rlp_ keys, minus the user-id suffix) ----

const KEYS = {
  onboarding: "onboarding",
  onboardingComplete: "onboarding-complete",
  preferredName: "preferred-name",
  completed: "completed",
  moduleFeedbackPrompted: "module-feedback-prompted",
  stageIntroSeen: "stage-intro-seen",
  stage1StartingSeen: "stage1-starting-seen",
  stage1Summary: "stage1-summary",
  stage1Reveal: "stage1-reveal",
  stage2Reveal: "stage2-reveal",
  // The generated Stage 3 (Understand) stage-close reveal — the Wrapped-style
  // card portrait. Stored so it's stable on revisit / back-navigation.
  stage3Reveal: "stage3-reveal",
  // The confirmed Stage 3 (Understand) values, distilled at the stage close —
  // feeds Stage 4 planning.
  stage3Values: "stage3-values",
  // The set of Stage 2 discovery-stat ids this user has already been shown, so
  // the reveal rotates to fresh stats on a return visit (the annual review).
  seenStats: "seen-stats",
  takeaway: (moduleId: string) => `takeaway:${moduleId}`,
  conversation: (id: string) => `conversation:${id}`,
  interaction: (id: string) => `interaction:${id}`,
  // A concrete plan commitment captured at a module's close (e.g. the senses
  // module's screening rhythm). Distinct from interaction/takeaway — a plan
  // entry, not reflection data.
  commitment: (id: string) => `commitment:${id}`,
  // The structured "Dreams" record for the money module — top three, reasons,
  // and the achievable/pipedream split. Distinct from the raw spark-prompts
  // interaction (which holds the full typed list) and the prose takeaway.
  dreams: (id: string) => `dreams:${id}`,
  // The pre-seeded candidate content for a Stage 3 surface, persisted so a
  // refresh never regenerates it.
  seed: (id: string) => `seed:${id}`,
  // The goals Vita drafted for the balanced-goals module (4.3), persisted so a
  // refresh never re-drafts them — distinct from the Stage 3 `seed` shape.
  // v2: the draft shape changed to nested intensity variants. The old key is
  // left unread so any cached flat-shape drafts are simply re-fetched.
  goalSeed: (id: string) => `goal-seed-v2:${id}`,
  // The path Vita drafted for each spotlighted goal in the goal-paths module
  // (4.4), persisted so a refresh never re-drafts it.
  goalPathSeed: (id: string) => `goal-path-v1:${id}`,
  // The trade-off scenarios and candidate decision principles Vita drafted for
  // the trade-offs module (4.5), persisted so a refresh never re-drafts them.
  tradeOffSeed: (id: string) => `trade-off-v1:${id}`,
  weekShapeSeed: (id: string) => `week-shape-v2:${id}`,
  // The assembled first-year draft Vita built for "Your first year" (4.7), kept in
  // sync with the working timeline so a mid-session refresh resumes it.
  firstYearSeed: (id: string) => `first-year-v1:${id}`,
  // The editing chat for "Your first year" (4.7), persisted separately from the
  // module conversation so a refresh resumes the reshaping in progress.
  firstYearChat: (id: string) => `first-year-chat-v1:${id}`,
  // The Retirement Life Plan's generated opening (chapter title + self-intro
  // drafts), the member's edits to those drafts, and the generated scene images —
  // each cached so the plan is generated once at creation, not per view.
  planIntro: "plan-prose-v5",
  planSelfIntroEdits: "plan-self-intro-v2",
  planImages: "plan-images-v4",
};

// Versioned key families where only the current version (per KEYS above) should
// live in a user's data. Older siblings are pruned on load, so superseded blobs
// — e.g. a previous `plan-images` version — can never accumulate and bloat the
// snapshot the way an 8.5 MB orphan once did. The "keep" value is read straight
// from KEYS, so bumping a version needs no other change here.
const VERSIONED_FAMILIES: { current: string; pattern: RegExp }[] = [
  { current: KEYS.planImages, pattern: /^plan-images(-v\d+)?$/ },
  { current: KEYS.planIntro, pattern: /^plan-prose(-v\d+)?$/ },
  { current: KEYS.planSelfIntroEdits, pattern: /^plan-self-intro(-v\d+)?$/ },
];

// The Stage 1 opening capture ("Where you're starting from") is stored as a
// takeaway under its own id, kept deliberately distinct from any real module id
// (1.day, 1.money, …) so it never counts as a module or shows up in module-driven
// logic — only the places that explicitly ask for it (the letter suggestions and
// the Imagine reveal synthesis) pull it in.
export const STAGE1_STARTING_ID = "stage1-start";
export const STAGE1_STARTING_TITLE = "Where you're starting from";

// ---- One-time migration from localStorage ----

// Maps an old localStorage key to its new logical key and how to decode the
// stored string. Returns null for anything that isn't ours.
function mapLegacyKey(
  oldKey: string,
  uid: string
): { key: string; kind: "json" | "string" | "bool" } | null {
  if (oldKey === `rlp_onboarding_complete_${uid}`)
    return { key: KEYS.onboardingComplete, kind: "bool" };
  if (oldKey === `rlp_onboarding_${uid}`)
    return { key: KEYS.onboarding, kind: "json" };
  if (oldKey === `rlp_preferred_name_${uid}`)
    return { key: KEYS.preferredName, kind: "string" };
  if (oldKey === `rlp_completed_${uid}`)
    return { key: KEYS.completed, kind: "json" };
  if (oldKey === `rlp_stage_intro_seen_${uid}`)
    return { key: KEYS.stageIntroSeen, kind: "json" };
  if (oldKey === `rlp_stage1_summary_${uid}`)
    return { key: KEYS.stage1Summary, kind: "json" };

  const takeawayPrefix = `rlp_takeaway_${uid}_`;
  if (oldKey.startsWith(takeawayPrefix))
    return { key: KEYS.takeaway(oldKey.slice(takeawayPrefix.length)), kind: "json" };

  const sessionPrefix = `rlp_session_${uid}_`;
  if (oldKey.startsWith(sessionPrefix))
    return { key: KEYS.conversation(oldKey.slice(sessionPrefix.length)), kind: "json" };

  const buildPrefix = `rlp_build_${uid}_`;
  if (oldKey.startsWith(buildPrefix))
    return { key: KEYS.interaction(oldKey.slice(buildPrefix.length)), kind: "json" };

  return null;
}

// Push any local rlp_ data for this user up to the database. Best-effort: any
// failure leaves the app working on whatever did make it up. Called by the
// provider only when the database has no rows for the user yet, so it can't
// double-run or clobber server data.
async function migrateLocalToDb(uid: string): Promise<Record<string, unknown>> {
  const migrated: Record<string, unknown> = {};
  const entries: { key: string; value: unknown }[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const oldKey = localStorage.key(i);
      if (!oldKey || !oldKey.startsWith("rlp_") || !oldKey.includes(uid)) continue;
      const mapped = mapLegacyKey(oldKey, uid);
      if (!mapped) continue;
      const raw = localStorage.getItem(oldKey);
      if (raw === null) continue;

      let value: unknown;
      if (mapped.kind === "bool") value = raw === "true";
      else if (mapped.kind === "string") value = raw;
      else {
        try {
          value = JSON.parse(raw);
        } catch {
          continue;
        }
      }
      entries.push({ key: mapped.key, value });
    }

    for (const e of entries) {
      await fetch("/api/user-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(e),
      });
      migrated[e.key] = e.value;
    }
  } catch {
    // best-effort — never block the app
  }

  return migrated;
}

// ---- One-time migration of Stage 1 module ids ----

// Stage 1 modules were renamed from numeric ids to semantic ones. Existing
// testers have data (conversations, interactions, takeaways, and completed
// entries) keyed by the old ids, so rename them in place rather than orphan it.
const MODULE_ID_RENAMES: Record<string, string> = {
  "1.1": "1.day",
  "1.2": "1.roles",
  "1.3": "1.week",
};

// Rename any keys/entries still using an old numeric Stage 1 id to its semantic
// one. Idempotent: only fires when an old id is actually present, so it's a
// no-op once a user's data is migrated. Updates the in-memory snapshot and
// persists each change (POST the new key, DELETE the old). Never clobbers data
// already stored under a new id.
async function migrateModuleIds(
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const next = { ...data };
  const writes: { key: string; value: unknown }[] = [];
  const deletes: string[] = [];

  for (const [oldId, newId] of Object.entries(MODULE_ID_RENAMES)) {
    for (const prefix of ["conversation:", "interaction:", "takeaway:"]) {
      const oldKey = `${prefix}${oldId}`;
      if (!(oldKey in next)) continue;
      const newKey = `${prefix}${newId}`;
      let value = next[oldKey];
      // The takeaway object carries its own moduleId — keep it consistent.
      if (prefix === "takeaway:" && value && typeof value === "object") {
        value = { ...(value as Record<string, unknown>), moduleId: newId };
      }
      if (!(newKey in next)) {
        next[newKey] = value;
        writes.push({ key: newKey, value });
      }
      delete next[oldKey];
      deletes.push(oldKey);
    }
  }

  // The completed array stores raw module ids.
  const completed = next[KEYS.completed];
  if (
    Array.isArray(completed) &&
    completed.some((id) => typeof id === "string" && id in MODULE_ID_RENAMES)
  ) {
    const renamed = completed.map((id) =>
      typeof id === "string" && MODULE_ID_RENAMES[id] ? MODULE_ID_RENAMES[id] : id
    );
    next[KEYS.completed] = renamed;
    writes.push({ key: KEYS.completed, value: renamed });
  }

  if (writes.length === 0 && deletes.length === 0) return data;

  try {
    for (const w of writes) {
      await fetch("/api/user-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(w),
      });
    }
    for (const key of deletes) {
      await fetch("/api/user-data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
    }
  } catch {
    // best-effort — the in-memory snapshot is already corrected
  }

  return next;
}

// ---- Context ----

type ContextValue = {
  loading: boolean;
  snapshot: Record<string, unknown>;
  // value may be a plain value or a functional updater (prev) => next, resolved
  // against the latest stored value for race-safe merges.
  setKey: (key: string, value: unknown | ((prev: unknown) => unknown)) => Promise<void>;
  removeKey: (key: string) => Promise<void>;
  removeAll: () => Promise<void>;
};

const UserDataContext = createContext<ContextValue | null>(null);

export function UserDataProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const userId = user?.id ?? null;

  const [snapshot, setSnapshotState] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  // The authoritative copy writers read and mutate, so rapid sequential writes
  // never race a stale render closure. State mirrors it to trigger re-renders.
  const snapshotRef = useRef<Record<string, unknown>>({});
  // Which user the current snapshot belongs to, so we reload on auth change and
  // never let one user's data bleed into another's session.
  const loadedFor = useRef<string | null>(null);

  const commit = useCallback((next: Record<string, unknown>) => {
    snapshotRef.current = next;
    setSnapshotState(next);
  }, []);

  // This effect synchronises our snapshot with two external systems — the Clerk
  // session and the database — so the synchronous resets here (clearing the
  // snapshot and flipping the loading flag on an auth change, before the fetch)
  // are deliberate, not the cascading-render anti-pattern the rule guards against.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isLoaded) return;

    // Signed out — drop everything.
    if (!userId) {
      loadedFor.current = null;
      commit({});
      setLoading(false);
      return;
    }

    // Already loaded for this exact user — nothing to do.
    if (loadedFor.current === userId) return;

    loadedFor.current = userId;
    commit({});
    setLoading(true);

    let cancelled = false;
    (async () => {
      let data: Record<string, unknown> = {};
      try {
        const res = await fetch("/api/user-data");
        if (res.ok) data = (await res.json()) as Record<string, unknown>;
      } catch {
        // leave empty; app still works, writes will persist going forward
      }

      // Migration runs only when the user has no rows yet — keeps it idempotent.
      if (Object.keys(data).length === 0) {
        data = await migrateLocalToDb(userId);
      }

      // Rename any old numeric Stage 1 ids to the semantic ones. Idempotent and
      // a no-op once a user's data is already on the new ids.
      data = await migrateModuleIds(data);

      // Prune superseded versions of versioned key families (e.g. old plan-images
      // blobs) so stale data can't pile up and bloat the snapshot. Removes them
      // from the in-memory snapshot and, best-effort, from the database.
      for (const staleKey of Object.keys(data)) {
        const isStale = VERSIONED_FAMILIES.some(
          (f) => staleKey !== f.current && f.pattern.test(staleKey)
        );
        if (isStale) {
          delete data[staleKey];
          void fetch("/api/user-data", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: staleKey }),
          }).catch(() => {});
        }
      }

      if (cancelled || loadedFor.current !== userId) return;
      commit(data);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, userId, commit]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setKey = useCallback(
    async (key: string, value: unknown) => {
      // A functional updater resolves against the authoritative snapshotRef, so
      // concurrent merges into the same key (e.g. several plan images landing at
      // once) never clobber one another the way a stale read-then-write would.
      const resolved =
        typeof value === "function"
          ? (value as (prev: unknown) => unknown)(snapshotRef.current[key])
          : value;
      commit({ ...snapshotRef.current, [key]: resolved });
      try {
        await fetch("/api/user-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value: resolved }),
        });
      } catch {
        // optimistic — UI already reflects it
      }
    },
    [commit]
  );

  const removeKey = useCallback(
    async (key: string) => {
      const next = { ...snapshotRef.current };
      delete next[key];
      commit(next);
      try {
        await fetch("/api/user-data", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key }),
        });
      } catch {
        // optimistic
      }
    },
    [commit]
  );

  const removeAll = useCallback(async () => {
    commit({});
    try {
      await fetch("/api/user-data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch {
      // optimistic
    }
  }, [commit]);

  return (
    <UserDataContext.Provider
      value={{ loading, snapshot, setKey, removeKey, removeAll }}
    >
      {children}
    </UserDataContext.Provider>
  );
}

// The narrow Clerk shape the name resolver needs.
type NameSource = { firstName?: string | null } | null | undefined;

// The domain API every component uses. Reads are synchronous against the loaded
// snapshot; writes update the snapshot optimistically and persist.
export function useUserData() {
  const ctx = useContext(UserDataContext);
  if (!ctx) {
    throw new Error("useUserData must be used within a UserDataProvider");
  }
  const { loading, snapshot, setKey, removeKey, removeAll } = ctx;

  const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

  // ---- Completion ----
  const getCompletedIds = (): string[] => asArray<string>(snapshot[KEYS.completed]);

  const markModuleComplete = (moduleId: string) => {
    const ids = getCompletedIds();
    if (ids.includes(moduleId)) return Promise.resolve();
    return setKey(KEYS.completed, [...ids, moduleId]);
  };

  const clearModuleComplete = (moduleId: string) =>
    setKey(KEYS.completed, getCompletedIds().filter((id) => id !== moduleId));

  const getActiveStage = (): number =>
    getActiveStageNumber(getCompletedIds(), getRetirementStage());

  // ---- Per-module feedback prompt (once-per-module dedup) ----
  // The ids of modules for which the close-of-module feedback card has already
  // been shown, so it fires once per module and never nags on a revisit.
  const getModuleFeedbackPrompted = (): string[] =>
    asArray<string>(snapshot[KEYS.moduleFeedbackPrompted]);

  const hasPromptedModuleFeedback = (moduleId: string): boolean =>
    getModuleFeedbackPrompted().includes(moduleId);

  const markModuleFeedbackPrompted = (moduleId: string) => {
    const ids = getModuleFeedbackPrompted();
    if (ids.includes(moduleId)) return Promise.resolve();
    return setKey(KEYS.moduleFeedbackPrompted, [...ids, moduleId]);
  };

  // Whether the user has begun the programme at all: any module completed, any
  // conversation with at least one message, or any saved interaction. Reads the
  // DB-backed snapshot (not localStorage). Note merely opening a module writes an
  // empty conversation array, so an empty one doesn't count as started.
  const hasStartedAnyModule = (): boolean => {
    if (getCompletedIds().length > 0) return true;
    for (const [key, value] of Object.entries(snapshot)) {
      if (
        key.startsWith("conversation:") &&
        Array.isArray(value) &&
        value.length > 0
      ) {
        return true;
      }
      if (key.startsWith("interaction:") && value) return true;
    }
    return false;
  };

  // ---- Takeaways ----
  const getTakeaway = (moduleId: string): Takeaway | null => {
    const t = snapshot[KEYS.takeaway(moduleId)];
    if (t && typeof t === "object" && typeof (t as Takeaway).text === "string") {
      return t as Takeaway;
    }
    return null;
  };

  const saveTakeaway = (takeaway: Takeaway) =>
    setKey(KEYS.takeaway(takeaway.moduleId), takeaway);

  const clearTakeaway = (moduleId: string) => removeKey(KEYS.takeaway(moduleId));

  // ---- Dreams (money module structured record) ----
  const getDreams = (moduleId: string): Dreams | null => {
    const d = snapshot[KEYS.dreams(moduleId)];
    if (d && typeof d === "object" && Array.isArray((d as Dreams).allDreams)) {
      return d as Dreams;
    }
    return null;
  };

  const saveDreams = (dreams: Dreams) =>
    setKey(KEYS.dreams(dreams.moduleId), dreams);

  const clearDreams = (moduleId: string) => removeKey(KEYS.dreams(moduleId));

  // ---- Stage 1 opening capture ("Where you're starting from") ----
  // Stored as its own takeaway, separate from the module takeaways.
  const getStartingThoughts = (): Takeaway | null =>
    getTakeaway(STAGE1_STARTING_ID);

  const saveStartingThoughts = (text: string) =>
    saveTakeaway({
      moduleId: STAGE1_STARTING_ID,
      moduleTitle: STAGE1_STARTING_TITLE,
      text: text.trim(),
      savedAt: new Date().toISOString(),
    });

  const hasPriorTakeaways = (moduleId: string): boolean =>
    getModulesBefore(moduleId, getRetirementStage()).some((m) =>
      getTakeaway(m.id)
    );

  const buildPriorReflections = (
    moduleId: string,
    includeStartingThoughts = false
  ): string => {
    const fallback = "No earlier modules completed yet.";
    const lines = getModulesBefore(moduleId, getRetirementStage()).flatMap((m) => {
      const t = getTakeaway(m.id);
      // Guard against a takeaway that was stored as raw {thirdPerson,...} JSON, so
      // the model is never fed the structure to echo back.
      const text = t ? stripStructuredLeak(t.text).trim() : "";
      return text ? [`- ${m.title}: ${text}`] : [];
    });
    // The opening capture sits before every module, so when asked for it leads
    // the list — what they already had in mind before any module framed it.
    if (includeStartingThoughts) {
      const start = getStartingThoughts();
      if (start && start.text.trim()) {
        lines.unshift(`- ${start.moduleTitle}: ${start.text.trim()}`);
      }
    }
    if (lines.length === 0) return fallback;
    return ["Here's what they've worked through in earlier modules — draw on it only where it's directly relevant to this module's topic:", ...lines].join("\n");
  };

  // ---- Preferred name / display name ----
  const getPreferredName = (): string => {
    const v = snapshot[KEYS.preferredName];
    return typeof v === "string" ? v.trim() : "";
  };

  const setPreferredName = (name: string) =>
    setKey(KEYS.preferredName, name.trim());

  const getDisplayName = (source: NameSource): string | null => {
    const preferred = getPreferredName();
    if (preferred) return preferred;
    const first = source?.firstName?.trim();
    return first ? first : null;
  };

  // ---- Stage intros ----
  const getStageIntrosSeen = (): number[] =>
    asArray<number>(snapshot[KEYS.stageIntroSeen]);

  const markStageIntroSeen = (stageNumber: number) => {
    const seen = getStageIntrosSeen();
    if (seen.includes(stageNumber)) return Promise.resolve();
    return setKey(KEYS.stageIntroSeen, [...seen, stageNumber]);
  };

  // ---- Stage 1 opening-capture "seen" flag ----
  // Whether the person has been shown the opening capture (saved or skipped), so
  // it appears once, between the Stage 1 intro and module 1.day, and never again.
  const hasSeenStage1Starting = (): boolean =>
    snapshot[KEYS.stage1StartingSeen] === true;

  const markStage1StartingSeen = () => setKey(KEYS.stage1StartingSeen, true);

  // ---- Onboarding ----
  const isOnboardingComplete = (): boolean =>
    snapshot[KEYS.onboardingComplete] === true;

  const markOnboardingComplete = () => setKey(KEYS.onboardingComplete, true);

  const getOnboarding = (): OnboardingAnswers => {
    const v = snapshot[KEYS.onboarding];
    return v && typeof v === "object" ? (v as OnboardingAnswers) : {};
  };

  const saveOnboarding = (partial: OnboardingAnswers) => {
    const merged: OnboardingAnswers = {
      partner: "",
      horizon: "",
      motivation: null,
      dob: "",
      ...getOnboarding(),
      ...partial,
    };
    return setKey(KEYS.onboarding, merged);
  };

  // "Yes" is the current onboarding answer; "Me and my partner" is kept for any
  // data saved before the question was simplified to Yes/No.
  const hasPartner = (): boolean => {
    const p = getOnboarding().partner;
    return p === "Yes" || p === "Me and my partner";
  };

  // Where they are with work and retirement, or null when it was never captured
  // (existing users, or anyone onboarded with the RETIREMENT_PATHS flag off).
  const getRetirementStage = (): RetirementStage | null => {
    const s = getOnboarding().retirementStage;
    return s === "working" ||
      s === "winding_down" ||
      s === "recently_retired" ||
      s === "established"
      ? s
      : null;
  };

  // The register Vita should use, defaulting to "warm" (the pre-selected option)
  // for anyone who hasn't set one.
  const getCoachTone = (): CoachTone => {
    const t = getOnboarding().tone;
    return t === "professional" || t === "playful" ? t : "warm";
  };

  // The short sentence Vita reads, built from the onboarding answers.
  const buildOnboardingContext = (): string => {
    const answers = getOnboarding();

    // The name Vita should address them by. Stated explicitly, and first, so she
    // anchors on their real preferred name and never picks up a name from
    // elsewhere (e.g. the recipient of a letter they wrote). Included even before
    // the rest of onboarding is recorded.
    const preferred = getPreferredName();
    const nameSentence = preferred
      ? `Their preferred name — the only name you should ever call them — is ${preferred}.`
      : "";

    if (!snapshot[KEYS.onboarding]) {
      return nameSentence || "Nothing recorded yet.";
    }

    // Where they are with work and retirement — its own sentence, so Vita's
    // tense can adapt globally (the framing directive in the base prompt reads
    // it). Empty when unset, so it drops out for anyone onboarded before the
    // RETIREMENT_PATHS flag and leaves the context identical to before.
    const statusSentence = ((): string => {
      switch (answers.retirementStage) {
        case "working":
          return "They're still working and planning ahead for retirement.";
        case "winding_down":
          return "They're winding down — phasing out of work now.";
        case "recently_retired":
          return "They retired recently, within about the last 2 years, and are still settling into it.";
        case "established":
          return "They've been retired for a good while now.";
        default:
          return "";
      }
    })();

    const parts: string[] = [];
    // "Yes"/"No" are the current answers; the older "Me and my partner"/"Just me"
    // values are still honoured for anyone who answered before the change.
    if (answers.partner === "Yes" || answers.partner === "Me and my partner") {
      parts.push("They're planning their retirement with a partner");
    } else if (answers.partner === "No" || answers.partner === "Just me") {
      parts.push("They're planning their retirement on their own");
    }
    if (answers.horizon === "Not sure") {
      parts.push("they're not yet sure how far off retirement is");
    } else if (answers.horizon) {
      parts.push(`retirement is roughly ${answers.horizon} away`);
    }

    let sentence = parts.length ? parts.join(", ") + "." : "";
    if (answers.motivation) {
      sentence += `${sentence ? " " : ""}What brought them here: ${answers.motivation.toLowerCase()}.`;
    }
    const combined = [nameSentence, statusSentence, sentence.trim()]
      .filter(Boolean)
      .join(" ");
    return combined || "Nothing recorded yet.";
  };

  // ---- Stage 1 reveal (threads + archetype) ----
  const getStage1Reveal = (): SavedStageReveal | null => {
    const v = snapshot[KEYS.stage1Reveal];
    if (
      v &&
      typeof v === "object" &&
      Array.isArray((v as SavedStageReveal).synthesis?.threads)
    ) {
      return v as SavedStageReveal;
    }
    return null;
  };

  const hasStage1Reveal = (): boolean => getStage1Reveal() !== null;

  const saveStage1Reveal = (synthesis: RevealSynthesis) =>
    setKey(KEYS.stage1Reveal, {
      synthesis,
      savedAt: new Date().toISOString(),
    } satisfies SavedStageReveal);

  // ---- Stage 2 reveal (Explore: six areas + discovery stats) ----
  const getStage2Reveal = (): SavedStage2Reveal | null => {
    const v = snapshot[KEYS.stage2Reveal];
    if (
      v &&
      typeof v === "object" &&
      Array.isArray((v as SavedStage2Reveal).synthesis?.areas)
    ) {
      return v as SavedStage2Reveal;
    }
    return null;
  };

  const hasStage2Reveal = (): boolean => getStage2Reveal() !== null;

  const saveStage2Reveal = (synthesis: Stage2Synthesis) =>
    setKey(KEYS.stage2Reveal, {
      synthesis,
      savedAt: new Date().toISOString(),
    } satisfies SavedStage2Reveal);

  // ---- Stage 3 reveal (Understand: the Wrapped-style card portrait) ----
  const getStage3Reveal = (): SavedStage3Reveal | null => {
    const v = snapshot[KEYS.stage3Reveal];
    if (
      v &&
      typeof v === "object" &&
      typeof (v as SavedStage3Reveal).synthesis?.opener === "string"
    ) {
      return v as SavedStage3Reveal;
    }
    return null;
  };

  const hasStage3Reveal = (): boolean => getStage3Reveal() !== null;

  const saveStage3Reveal = (synthesis: Stage3Synthesis) =>
    setKey(KEYS.stage3Reveal, {
      synthesis,
      savedAt: new Date().toISOString(),
    } satisfies SavedStage3Reveal);

  // ---- Seen discovery stats (Stage 2 reveal rotation) ----
  const getSeenStats = (): string[] => asArray<string>(snapshot[KEYS.seenStats]);

  // Append newly-shown stat ids, de-duplicated and preserving first-seen order
  // (earliest = least recently introduced), so a return visit can prefer fresh
  // stats. No-op when nothing new was shown.
  const addSeenStats = (ids: string[]) => {
    const existing = getSeenStats();
    const merged = [...existing];
    for (const id of ids) if (!merged.includes(id)) merged.push(id);
    if (merged.length === existing.length) return Promise.resolve();
    return setKey(KEYS.seenStats, merged);
  };

  // ---- Per-module conversation + interaction ----
  const getConversation = (id: string): ConversationMessage[] | null => {
    const v = snapshot[KEYS.conversation(id)];
    return Array.isArray(v) ? (v as ConversationMessage[]) : null;
  };

  const saveConversation = (id: string, messages: ConversationMessage[]) =>
    setKey(KEYS.conversation(id), messages);

  const getBuild = (id: string): BuildResult | null => {
    const v = snapshot[KEYS.interaction(id)];
    if (v && typeof v === "object" && "type" in (v as object)) {
      return v as BuildResult;
    }
    return null;
  };

  const saveBuild = (id: string, result: BuildResult) =>
    setKey(KEYS.interaction(id), result);

  // ---- Stage 3 seed (pre-filled candidate content for a surface) ----
  const getSeed = (id: string): Stage3Seed | null => {
    const v = snapshot[KEYS.seed(id)];
    if (v && typeof v === "object" && "type" in (v as object)) {
      return v as Stage3Seed;
    }
    return null;
  };

  const saveSeed = (id: string, seed: Stage3Seed) =>
    setKey(KEYS.seed(id), seed);

  const clearSeed = (id: string) => removeKey(KEYS.seed(id));

  // ---- Balanced-goals draft (Module 4.3's AI-drafted goal suggestions) ----
  const getGoalSeed = (id: string): BalancedGoalsSeed | null => {
    const v = snapshot[KEYS.goalSeed(id)];
    if (
      v &&
      typeof v === "object" &&
      Array.isArray((v as BalancedGoalsSeed).suggestions)
    ) {
      return v as BalancedGoalsSeed;
    }
    return null;
  };

  const saveGoalSeed = (id: string, seed: BalancedGoalsSeed) =>
    setKey(KEYS.goalSeed(id), seed);

  const clearGoalSeed = (id: string) => removeKey(KEYS.goalSeed(id));

  // ---- Goal-paths draft (Module 4.4's AI-drafted path per spotlighted goal) ----
  const getGoalPathSeed = (id: string): GoalPathsSeed | null => {
    const v = snapshot[KEYS.goalPathSeed(id)];
    if (
      v &&
      typeof v === "object" &&
      Array.isArray((v as GoalPathsSeed).paths)
    ) {
      return v as GoalPathsSeed;
    }
    return null;
  };

  const saveGoalPathSeed = (id: string, seed: GoalPathsSeed) =>
    setKey(KEYS.goalPathSeed(id), seed);

  const clearGoalPathSeed = (id: string) => removeKey(KEYS.goalPathSeed(id));

  // ---- Trade-offs draft (Module 4.5's scenarios + candidate principles) ----
  const getTradeOffSeed = (id: string): TradeOffsSeed | null => {
    const v = snapshot[KEYS.tradeOffSeed(id)];
    if (
      v &&
      typeof v === "object" &&
      Array.isArray((v as TradeOffsSeed).scenarios)
    ) {
      return v as TradeOffsSeed;
    }
    return null;
  };

  const saveTradeOffSeed = (id: string, seed: TradeOffsSeed) =>
    setKey(KEYS.tradeOffSeed(id), seed);

  const clearTradeOffSeed = (id: string) => removeKey(KEYS.tradeOffSeed(id));

  const getWeekShapeSeed = (id: string): WeekShapeSeed | null => {
    const v = snapshot[KEYS.weekShapeSeed(id)];
    if (
      v &&
      typeof v === "object" &&
      Array.isArray((v as WeekShapeSeed).activities)
    ) {
      return v as WeekShapeSeed;
    }
    return null;
  };

  const saveWeekShapeSeed = (id: string, seed: WeekShapeSeed) =>
    setKey(KEYS.weekShapeSeed(id), seed);

  const clearWeekShapeSeed = (id: string) =>
    removeKey(KEYS.weekShapeSeed(id));

  const getFirstYearSeed = (id: string): FirstYearSeed | null => {
    const v = snapshot[KEYS.firstYearSeed(id)];
    if (
      v &&
      typeof v === "object" &&
      Array.isArray((v as FirstYearSeed).items)
    ) {
      return v as FirstYearSeed;
    }
    return null;
  };

  const saveFirstYearSeed = (id: string, seed: FirstYearSeed) =>
    setKey(KEYS.firstYearSeed(id), seed);

  const clearFirstYearSeed = (id: string) =>
    removeKey(KEYS.firstYearSeed(id));

  const getFirstYearChat = (id: string): ConversationMessage[] | null => {
    const v = snapshot[KEYS.firstYearChat(id)];
    return Array.isArray(v) ? (v as ConversationMessage[]) : null;
  };

  const saveFirstYearChat = (id: string, messages: ConversationMessage[]) =>
    setKey(KEYS.firstYearChat(id), messages);

  // ---- Stage 3 confirmed values (the stage-close summary, feeds Stage 4) ----
  const getStage3Values = (): Stage3ValuesSummary | null => {
    const v = snapshot[KEYS.stage3Values];
    if (v && typeof v === "object" && Array.isArray((v as Stage3ValuesSummary).values)) {
      return v as Stage3ValuesSummary;
    }
    return null;
  };

  const saveStage3Values = (summary: Stage3ValuesSummary) =>
    setKey(KEYS.stage3Values, summary);

  // ---- Retirement Life Plan: generated opening, edits, and scene images ----
  const getPlanIntro = (): PlanIntro | null => {
    const v = snapshot[KEYS.planIntro];
    if (
      v &&
      typeof v === "object" &&
      typeof (v as PlanIntro).chapterTitle === "string" &&
      typeof (v as PlanIntro).selfIntro === "string"
    ) {
      return v as PlanIntro;
    }
    return null;
  };

  const savePlanIntro = (intro: PlanIntro) => setKey(KEYS.planIntro, intro);

  // The member's own (edited / re-toned) self-introduction — a single string.
  const getPlanSelfIntro = (): string | null => {
    const v = snapshot[KEYS.planSelfIntroEdits];
    return typeof v === "string" ? v : null;
  };

  const savePlanSelfIntro = (text: string) =>
    setKey(KEYS.planSelfIntroEdits, text);

  // Generated scene images, keyed by slot ("hero", "s1"…). Cached so each is
  // generated once, not per view.
  const getPlanImages = (): Record<string, string> => {
    const v = snapshot[KEYS.planImages];
    return v && typeof v === "object" ? (v as Record<string, string>) : {};
  };

  const savePlanImage = (slot: string, dataUrl: string) =>
    // Functional updater so images generated concurrently (the pre-warm pool)
    // each merge into the latest map rather than a stale snapshot read.
    setKey(KEYS.planImages, (prev: unknown) => ({
      ...((prev && typeof prev === "object" ? prev : {}) as Record<string, string>),
      [slot]: dataUrl,
    }));

  // ---- Closing commitment (a concrete plan entry) ----
  const getCommitment = (id: string): ScreeningCommitment | null => {
    const v = snapshot[KEYS.commitment(id)];
    if (
      v &&
      typeof v === "object" &&
      typeof (v as ScreeningCommitment).frequency === "string"
    ) {
      return v as ScreeningCommitment;
    }
    return null;
  };

  const saveCommitment = (id: string, commitment: ScreeningCommitment) =>
    setKey(KEYS.commitment(id), commitment);

  const clearCommitment = (id: string) => removeKey(KEYS.commitment(id));

  // ---- Canonical context profile (read-only view) ----
  // The bulk snapshot fetch attaches the user's active facts under a synthetic
  // key. This getter is a read-only view over them — phase 1 writes and
  // validates the store; the live read paths are migrated in phase 2. Filterable
  // by category and/or the module a fact came from.
  const getActiveFacts = (filter?: {
    category?: FactCategory;
    provenanceModule?: string;
  }): StoredFact[] => {
    const v = snapshot[CONTEXT_FACTS_SNAPSHOT_KEY];
    const facts = Array.isArray(v) ? (v as StoredFact[]) : [];
    if (!filter) return facts;
    return facts.filter(
      (f) =>
        (!filter.category || f.category === filter.category) &&
        (!filter.provenanceModule || f.provenanceModule === filter.provenanceModule)
    );
  };

  // ---- Resets ----
  const resetAll = () => removeAll();

  const resetModule = async (id: string) => {
    await removeKey(KEYS.conversation(id));
    await removeKey(KEYS.interaction(id));
    await clearSeed(id);
    await clearGoalSeed(id);
    await clearCommitment(id);
    await clearTakeaway(id);
    await clearDreams(id);
    await clearModuleComplete(id);
  };

  return {
    loading,
    getCompletedIds,
    markModuleComplete,
    clearModuleComplete,
    getActiveStage,
    hasPromptedModuleFeedback,
    markModuleFeedbackPrompted,
    hasStartedAnyModule,
    getTakeaway,
    saveTakeaway,
    clearTakeaway,
    getDreams,
    saveDreams,
    clearDreams,
    getStartingThoughts,
    saveStartingThoughts,
    hasPriorTakeaways,
    buildPriorReflections,
    getPreferredName,
    setPreferredName,
    getDisplayName,
    getStageIntrosSeen,
    markStageIntroSeen,
    hasSeenStage1Starting,
    markStage1StartingSeen,
    isOnboardingComplete,
    markOnboardingComplete,
    getOnboarding,
    saveOnboarding,
    hasPartner,
    getRetirementStage,
    getCoachTone,
    buildOnboardingContext,
    getStage1Reveal,
    hasStage1Reveal,
    saveStage1Reveal,
    getStage2Reveal,
    hasStage2Reveal,
    saveStage2Reveal,
    getStage3Reveal,
    hasStage3Reveal,
    saveStage3Reveal,
    getSeenStats,
    addSeenStats,
    getConversation,
    saveConversation,
    getBuild,
    saveBuild,
    getSeed,
    saveSeed,
    clearSeed,
    getGoalSeed,
    saveGoalSeed,
    clearGoalSeed,
    getGoalPathSeed,
    saveGoalPathSeed,
    clearGoalPathSeed,
    getTradeOffSeed,
    saveTradeOffSeed,
    clearTradeOffSeed,
    getWeekShapeSeed,
    saveWeekShapeSeed,
    clearWeekShapeSeed,
    getFirstYearSeed,
    saveFirstYearSeed,
    clearFirstYearSeed,
    getFirstYearChat,
    saveFirstYearChat,
    getStage3Values,
    saveStage3Values,
    getPlanIntro,
    savePlanIntro,
    getPlanSelfIntro,
    savePlanSelfIntro,
    getPlanImages,
    savePlanImage,
    getCommitment,
    saveCommitment,
    clearCommitment,
    getActiveFacts,
    resetAll,
    resetModule,
  };
}
