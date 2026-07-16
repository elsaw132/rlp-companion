// A hand-built set of the six Stage 2 module builds for one imagined person, so
// the reveal's selection logic can be exercised without sitting through the
// modules. It is NOT wired into the live reveal — that reads real saved builds
// via useUserData. This fixture exists for tracing/testing the data path and as
// a worked example of the real build shapes the selection code consumes.
//
// Because it is the worked example, it has to be honest about the shapes. Every
// role-picker in Stage 2 is declared `starrable: false` in lib/modules.ts, so no
// Stage 2 picker ever produces a starred entry — `starred` is required by
// RolePickerResult, and a real Stage 2 build always leaves it empty. There is
// therefore no "which one are you most drawn to" signal anywhere in Stage 2;
// anything needing a preference order has to get it from somewhere else.
//
// The person here: walks the dog and gardens (2.1), is learning a language and
// does photography (2.2), has close ties but thin everyday casual contact (2.3),
// volunteers (2.4), gets energy from morning daylight and time outdoors (2.5),
// and has decided on a regular vision/hearing-check rhythm (2.6 → stat-free
// senses, shown as a plan).
//
// Which stats that produces is deliberately not written down here: selection
// rotates against the seen-set, so a first visit and a second visit legitimately
// differ, and a comment naming specific stats would be wrong within one visit.
// test/stage2-scratch-style runs are the way to see what it currently yields.

import type { BuildResult, ScreeningCommitment } from "@/lib/modules";

export const STAGE2_FIXTURE_BUILDS: Record<string, BuildResult> = {
  // 2.1 — active. Composite; results[0] is the activity picker.
  "2.1": {
    type: "composite",
    results: [
      {
        type: "role-picker",
        picked: ["Walking the dog", "Gardening"],
        starred: [],
      },
    ],
  },

  // 2.2 — cognitive. A plain role-picker of curiosities.
  "2.2": {
    type: "role-picker",
    picked: ["Learning a language", "Photography"],
    starred: [],
  },

  // 2.3 — social. Composite; results[0] is the people picker, then the four
  // support-function sliders. Only "Everyday casual contact" reads thin (<50),
  // so thinOverall stays false but thinCasualContact fires (S4).
  "2.3": {
    type: "composite",
    results: [
      {
        type: "role-picker",
        picked: ["Partner", "Close friends"],
        starred: [],
      },
      {
        type: "sliders",
        spectrums: [{ left: "Hard to find", right: "Always there", position: 72 }],
        summaryLabel: "Someone to talk to",
      },
      {
        type: "sliders",
        spectrums: [{ left: "Hard to find", right: "Always there", position: 64 }],
        summaryLabel: "Practical help",
      },
      {
        type: "sliders",
        spectrums: [{ left: "Hard to find", right: "Always there", position: 58 }],
        summaryLabel: "Healthy-habit company",
      },
      {
        type: "sliders",
        spectrums: [{ left: "Hard to find", right: "Always there", position: 28 }],
        summaryLabel: "Everyday casual contact",
      },
    ],
  },

  // 2.4 — purpose. A plain role-picker of sources of meaning.
  "2.4": {
    type: "role-picker",
    picked: ["Volunteering", "Helping a cause you care about"],
    starred: [],
  },

  // 2.5 — vitality. Composite with seven steps in this exact order:
  // [0] energisers, [1] drains, [2] Sleep, [3] Daytime energy, [4] Eating,
  // [5] Recovery, [6] the lever picker. Morning daylight energises (outdoors →
  // V2); sleep and daytime energy read fine, so neither sleep nor energy flags.
  "2.5": {
    type: "composite",
    results: [
      {
        type: "role-picker",
        picked: ["Daylight in the morning", "Movement", "Time outdoors"],
        starred: [],
      },
      {
        type: "role-picker",
        picked: ["Screens late", "Rushing"],
        starred: [],
      },
      {
        type: "sliders",
        spectrums: [{ left: "Rarely restful", right: "Mostly good", position: 66 }],
        summaryLabel: "Sleep",
      },
      {
        type: "sliders",
        spectrums: [{ left: "Patchy", right: "Steady", position: 70 }],
        summaryLabel: "Daytime energy",
      },
      {
        type: "sliders",
        spectrums: [{ left: "Haphazard", right: "Looked-after", position: 62 }],
        summaryLabel: "Eating",
      },
      {
        type: "sliders",
        spectrums: [{ left: "Rushed", right: "Spacious", position: 55 }],
        summaryLabel: "Recovery",
      },
      {
        type: "role-picker",
        picked: ["Movement"],
        starred: [],
        summaryLabel: "The lever you'd build on",
      },
    ],
  },

  // 2.6 — senses. A screening-check build; the reveal prefers the commitment
  // (below) when present, but this is what an un-committed person looks like.
  "2.6": {
    type: "screening-check",
    answers: [
      { id: "eyes", prompt: "Last eye test", choice: "Longer ago" },
      { id: "ears", prompt: "Last hearing check", choice: "Can't remember" },
    ],
  },
};

// The senses plan, read by the reveal via getCommitment("2.6") in preference to
// the screening-check build above — this is the "vision-led, stat-free" senses
// line: a decided rhythm rather than a finding.
export const STAGE2_FIXTURE_COMMITMENT: ScreeningCommitment = {
  frequency: "Every 2 years",
  nextAction: "Book an eye test this month",
};

// The seen-stats list for a first-time visitor — empty, so rotation prefers
// nothing yet and the strongest matched stats fire.
export const STAGE2_FIXTURE_SEEN: string[] = [];
