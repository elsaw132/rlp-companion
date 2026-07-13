"use client";

// The hero's rotating plan card — the one interactive piece of the otherwise
// static marketing home, so it's isolated here as a small client child while the
// page itself (MarketingHome) stays a server component. Three example Retirement
// Life Plans cross-fade every ~4.6s; the dots switch instantly on click. Respects
// prefers-reduced-motion: no auto-advance and no fade when the user asks for less
// motion (the dots still work, switching instantly). All the visual styling lives
// in MarketingHome's scoped .rlp-landing block, so nothing here carries its own CSS.

import { useCallback, useEffect, useRef, useState } from "react";

// The official Chorus bloom paths (viewBox 524.72535×500), inlined so the mark
// can be recoloured per use — here a dark-green neutral "seal" on the plan card.
// Same supplied art as VitaMark / BloomMotif; never redraw or approximate it.
function Bloom({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 524.72535 500" fill={color} aria-hidden="true">
      <path d="M348.51114,88.2401C348.51114,48.44079,327.8228,15.4933,298.05583,0l-14.18089,24.57136c22.13285,9.90043,37.82488,34.68406,37.82488,63.66874,0,37.71874-26.55972,68.90368-59.33484,68.90368s-59.33465-31.18494-59.33465-68.90368c0-28.98468,15.69183-53.76831,37.82469-63.66874L226.67412,0c-29.76678,15.4933-50.45512,48.44079-50.45512,88.2401,0,54.32534,38.56708,95.71482,86.14598,95.71482s86.14616-41.38948,86.14616-95.71482Z" />
      <path d="M185.98018,239.45379c14.7033-45.25067-12.74278-94.7197-64.40925-111.50734-37.85141-12.29904-75.57805-2.80434-99.51203,20.71732l18.98658,21.08052c16.25507-17.98976,44.67407-25.25522,72.24077-16.29873,35.87245,11.6562,57.32295,46.55216,47.19481,77.72355-10.12813,31.17177-47.99403,46.79454-83.86667,35.13721-27.56652-8.95536-46.28813-31.5376-48.86307-55.6464L0,216.55352c5.53604,33.09728,30.47868,62.95289,68.32972,75.25193,51.66666,16.78952,102.94735-7.10099,117.65046-52.35165Z" />
      <path d="M215.15794,329.24605c-38.49124-27.96434-94.02247-17.14971-125.95338,26.80098-23.39351,32.19738-26.02283,71.01362-11.04798,101.04273l25.91557-11.54329c-12.08714-21.01993-10.21432-50.29366,6.82247-73.74381,22.17011-30.51463,61.98825-40.13127,88.50394-20.86637,26.51569,19.26529,29.67269,60.10376,7.50257,90.62065-17.03679,23.44789-44.29883,34.2757-68.02486,29.27674l-2.96994,28.2135c33.18874,4.96207,69.29172-9.53159,92.68504-41.72934,31.93129-43.95068,25.05801-100.10481-13.43342-128.07179Z" />
      <path d="M309.57033,329.24341c-38.49275,27.96697-45.36716,84.1211-13.43361,128.07179,23.39219,32.19738,59.49667,46.69405,92.68542,41.72934l-2.97107-28.2135c-23.7234,5.00159-50.98806-5.82622-68.02392-29.27674-22.17011-30.51425-19.0133-71.35574,7.50126-90.62065,26.5172-19.26491,66.33269-9.64563,88.50281,20.869,17.03849,23.44752,18.90999,52.72125,6.82285,73.7408l25.91538,11.54404c14.97635-30.02949,12.34684-68.84572-11.0478-101.04348-31.92997-43.95031-87.45857-54.76494-125.95131-26.8006Z" />
      <path d="M448.11331,266.30746c-35.87396,11.65244-73.73854-3.96808-83.86667-35.13947-10.12813-31.17177,11.32085-66.06773,47.195-77.72543,27.56689-8.95649,55.98438-1.69103,72.24096,16.29873l18.98658-21.08052c-23.93285-23.52204-61.66212-33.01674-99.51353-20.7177-51.66666,16.78952-79.11424,66.25855-64.41095,111.50809,14.70311,45.24954,65.98549,69.13703,117.65196,52.35052,37.85141-12.29641,62.79406-42.15351,68.32868-75.24967l-27.74971-5.89509c-2.57645,24.1103-21.29806,46.69142-48.86232,55.65054Z" />
    </svg>
  );
}

// Three illustrative plans. `chips` is [label, variant] where variant "" is the
// default (blue) chip, "y" the yellow, "p" the pink — matching the scoped styles.
type Chip = [string, "" | "y" | "p"];
const PLANS: { name: string; vision: string; chips: Chip[] }[] = [
  {
    name: "Sarah’s plan",
    vision: "“Go part-time at 55, and turn the pottery I love into something that actually pays.”",
    chips: [
      ["Cut to 3 days", ""],
      ["Pottery studio", "y"],
      ["Half-marathon", "p"],
    ],
  },
  {
    name: "Jason’s plan",
    vision: "“Wind down slowly, mentor the apprentices, and finally get the band back on stage.”",
    chips: [
      ["Mentoring", ""],
      ["Live music", "p"],
      ["Coach the U12s", "y"],
    ],
  },
  {
    name: "Alex’s plan",
    vision: "“Learn Spanish, hike a new trail each spring, and cook at the community kitchen.”",
    chips: [
      ["Long-distance hikes", ""],
      ["Learn Spanish", "y"],
      ["Community kitchen", "p"],
    ],
  },
];

// The mock's timings: fade out (350ms) before swapping content, auto-advance
// every 4600ms. The .plan-inner CSS transition (opacity .5s) does the visible fade.
const FADE_MS = 350;
const ADVANCE_MS = 4600;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

export default function MarketingPlanCard() {
  const reduced = usePrefersReducedMotion();
  const [current, setCurrent] = useState(0);
  const [opacity, setOpacity] = useState(1);
  // The interval callback reads the live index without re-subscribing each change.
  const currentRef = useRef(0);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = useCallback(
    (i: number) => {
      if (i === currentRef.current) return;
      if (reduced) {
        currentRef.current = i;
        setCurrent(i);
        return;
      }
      setOpacity(0);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      fadeTimer.current = setTimeout(() => {
        currentRef.current = i;
        setCurrent(i);
        setOpacity(1);
      }, FADE_MS);
    },
    [reduced]
  );

  // Auto-advance — off entirely under reduced motion.
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      goTo((currentRef.current + 1) % PLANS.length);
    }, ADVANCE_MS);
    return () => clearInterval(id);
  }, [reduced, goTo]);

  // Clear any pending fade on unmount.
  useEffect(
    () => () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    },
    []
  );

  const plan = PLANS[current];

  return (
    <div className="stage">
      <div className="gfx" aria-hidden="true">
        {/* The official Chorus vector graphic (bloom of equal circles) as a
            decorative crop behind the card — the supplied brand asset, not
            hand-drawn shapes. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="gfx-graphic" src="/chorus-vector-graphic-orange.svg" alt="" />
      </div>

      <div className="plan">
        <div className="phead">
          <span className="kicker">Retirement Life Plan</span>
          <span className="seal" aria-hidden="true">
            <Bloom color="var(--ink)" />
          </span>
        </div>
        <div className="plan-inner" style={{ opacity }}>
          <div className="pname">{plan.name}</div>
          <div className="vision">{plan.vision}</div>
          <div className="chips">
            {plan.chips.map(([label, variant], i) => (
              <span key={i} className={`chip ${variant}`.trim()}>
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="pfoot">
          <span className="g" aria-hidden="true" /> Yours to keep — and it grows as you do
        </div>
      </div>

      <div className="dots" role="tablist" aria-label="Example plans">
        {PLANS.map((p, i) => (
          <button
            key={i}
            type="button"
            className={i === current ? "on" : ""}
            aria-label={`Show ${p.name}`}
            aria-selected={i === current}
            role="tab"
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </div>
  );
}
