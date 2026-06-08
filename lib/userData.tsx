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
import { getActiveStageNumber } from "@/lib/progress";
import type { Takeaway } from "@/lib/takeaways";
import type { RevealSynthesis, SavedStageReveal } from "@/lib/stageReveal";

// ---- Shapes shared across the app ----

export type OnboardingAnswers = {
  partner?: string;
  horizon?: string;
  motivation?: string | null;
};

export type ConversationMessage = {
  role: "coach" | "user";
  text: string;
};

// The user's planned date for their next module, set on the return-home path
// and read when they next open a module. `date` is a local ISO calendar date
// (YYYY-MM-DD); `setAt` is the moment they chose it.
export type PlannedNextModule = {
  date: string;
  setAt: string;
};

// ---- Logical keys (the former rlp_ keys, minus the user-id suffix) ----

const KEYS = {
  onboarding: "onboarding",
  onboardingComplete: "onboarding-complete",
  preferredName: "preferred-name",
  completed: "completed",
  plannedNextModule: "planned-next-module",
  stageIntroSeen: "stage-intro-seen",
  stage1StartingSeen: "stage1-starting-seen",
  stage1Summary: "stage1-summary",
  stage1Reveal: "stage1-reveal",
  takeaway: (moduleId: string) => `takeaway:${moduleId}`,
  conversation: (id: string) => `conversation:${id}`,
  interaction: (id: string) => `interaction:${id}`,
  // A concrete plan commitment captured at a module's close (e.g. the senses
  // module's screening rhythm). Distinct from interaction/takeaway — a plan
  // entry, not reflection data.
  commitment: (id: string) => `commitment:${id}`,
};

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
  setKey: (key: string, value: unknown) => Promise<void>;
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
      commit({ ...snapshotRef.current, [key]: value });
      try {
        await fetch("/api/user-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value }),
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

  const getActiveStage = (): number => getActiveStageNumber(getCompletedIds());

  // ---- Planned next module (the commitment loop) ----
  const getPlannedNextModule = (): PlannedNextModule | null => {
    const v = snapshot[KEYS.plannedNextModule];
    if (
      v &&
      typeof v === "object" &&
      typeof (v as PlannedNextModule).date === "string"
    ) {
      return v as PlannedNextModule;
    }
    return null;
  };

  const setPlannedNextModule = (date: string) =>
    setKey(KEYS.plannedNextModule, {
      date,
      setAt: new Date().toISOString(),
    } satisfies PlannedNextModule);

  const clearPlannedNextModule = () => removeKey(KEYS.plannedNextModule);

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
    getModulesBefore(moduleId).some((m) => getTakeaway(m.id));

  const buildPriorReflections = (
    moduleId: string,
    includeStartingThoughts = false
  ): string => {
    const fallback = "No earlier modules completed yet.";
    const lines = getModulesBefore(moduleId).flatMap((m) => {
      const t = getTakeaway(m.id);
      return t && t.text.trim() ? [`- ${m.title}: ${t.text.trim()}`] : [];
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
      ...getOnboarding(),
      ...partial,
    };
    return setKey(KEYS.onboarding, merged);
  };

  const hasPartner = (): boolean => getOnboarding().partner === "Me and my partner";

  // The short sentence Vita reads, built from the onboarding answers.
  const buildOnboardingContext = (): string => {
    const answers = getOnboarding();
    if (!snapshot[KEYS.onboarding]) return "Nothing recorded yet.";

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

  // ---- Resets ----
  const resetAll = () => removeAll();

  const resetModule = async (id: string) => {
    await removeKey(KEYS.conversation(id));
    await removeKey(KEYS.interaction(id));
    await clearCommitment(id);
    await clearTakeaway(id);
    await clearModuleComplete(id);
  };

  return {
    loading,
    getCompletedIds,
    markModuleComplete,
    clearModuleComplete,
    getActiveStage,
    getPlannedNextModule,
    setPlannedNextModule,
    clearPlannedNextModule,
    hasStartedAnyModule,
    getTakeaway,
    saveTakeaway,
    clearTakeaway,
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
    buildOnboardingContext,
    getStage1Reveal,
    hasStage1Reveal,
    saveStage1Reveal,
    getConversation,
    saveConversation,
    getBuild,
    saveBuild,
    getCommitment,
    saveCommitment,
    clearCommitment,
    resetAll,
    resetModule,
  };
}
