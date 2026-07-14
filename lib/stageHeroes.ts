// Per-stage recap in Vita's voice, shown in the completion panel when the person
// revisits a finished stage. Static per stage (what that stage covered); warm,
// plain and affirmative, and safe for the founder to reword. (The dashboard hero
// itself is now the Chorus vector graphic — see ChorusVectorGraphic — so there are
// no longer any per-stage photographs.)

export type StageHero = {
  recap: string;
};

export const STAGE_HEROES: Record<number, StageHero> = {
  1: {
    recap:
      "You pictured the shape of your days ahead — the roles you want to hold onto, an ordinary week that feels like yours, and a letter to your future self.",
  },
  2: {
    recap:
      "You went through the parts of life that matter to you — how you want to move, make, connect and rest — one area at a time.",
  },
  3: {
    recap:
      "You named the strengths you lead with, the values you want to keep close, and what these years are really for.",
  },
  4: {
    recap:
      "You shaped the years ahead — when and how you want to step back from work, and the goals worth moving toward.",
  },
  5: {
    recap:
      "You turned everything you've worked out into concrete next steps you can start on.",
  },
};

export function stageHeroFor(stageNumber: number): StageHero | undefined {
  return STAGE_HEROES[stageNumber];
}
