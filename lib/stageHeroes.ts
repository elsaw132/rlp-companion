// Per-stage hero photograph shown beside Vita on the dashboard: full-height in the
// current-stage hero card, and — with a short recap in Vita's voice — when the
// person revisits a finished stage. Images live in public/hero, keyed by stage
// number 1–5. The recap copy follows Vita's voice (warm, plain, affirmative); it's
// static per stage (what that stage covered), and safe for the founder to reword.

export type StageHero = {
  image: string;
  alt: string;
  recap: string;
};

export const STAGE_HEROES: Record<number, StageHero> = {
  1: {
    image: "/hero/imagine.jpg",
    alt: "A sunlit hallway with a bicycle, a basket of vegetables and an open door to the garden.",
    recap:
      "You pictured the shape of your days ahead — the roles you want to hold onto, an ordinary week that feels like yours, and a letter to your future self.",
  },
  2: {
    image: "/hero/explore.jpg",
    alt: "A wooden table spread with planners, travel books, a map and fresh fruit in morning light.",
    recap:
      "You went through the parts of life that matter to you — how you want to move, make, connect and rest — one area at a time.",
  },
  3: {
    image: "/hero/understand.jpg",
    alt: "A quiet reading corner with an armchair, a soft throw, an open journal and a cup of tea.",
    recap:
      "You named the strengths you lead with, the values you want to keep close, and what these years are really for.",
  },
  4: {
    image: "/hero/plan.jpg",
    alt: "A desk with maps, a camera, binoculars and open travel notebooks in warm light.",
    recap:
      "You shaped the years ahead — when and how you want to step back from work, and the goals worth moving toward.",
  },
  5: {
    image: "/hero/act.jpg",
    alt: "A sunlit desk with watercolour paints and a half-finished landscape on an easel.",
    recap:
      "You turned everything you've worked out into concrete next steps you can start on.",
  },
};

export function stageHeroFor(stageNumber: number): StageHero | undefined {
  return STAGE_HEROES[stageNumber];
}
