"use client";

// The in-app rendering of the Retirement Life Plan — the living document.
//
// Ten fixed sections, always present, in reading order. It leads with the
// person, then the balance picture, then flows through the sections, and ends
// pointing into Act. The spine is the five balanced-retirement areas (§2, §5);
// the VALUES are the compass (§3); the SEASONS are a property of each goal (§4).
// The balance overview, values compass, seasons timeline and goal cards are the
// interactive lenses. Everything renders from the assembled RlpPlan — the same
// data model the (future) still PDF keepsake will render.

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type {
  RlpPlan,
  PlanBalance,
  PlanGoal,
  PlanPath,
  PlanScene,
} from "@/lib/rlpPlan";
import { seasonLabel43 } from "@/lib/rlpPlan";
import type { ConnectionsGraph, ConnectionKind } from "@/lib/planIntro";
import type { BalancedAreaId } from "@/lib/modules";
import { HelperLine } from "./InteractionShell";
import PlanTabs, { type PlanTabDef } from "./PlanTabs";
import ChorusVectorGraphic from "./ChorusVectorGraphic";
import { stageHeroGroundFor, stageHeroGraphicFor } from "@/lib/stageColors";
import VitaMark from "./VitaMark";

// ---- Tab 6 · the balance band ----
//
// The band is FACT: how many of the five areas carry at least one goal. That is
// deliberately all it measures — the old chart sized each area by how many goals
// were typed into it, which made someone with three loose Connect goals and one
// profound Contribute goal read as "unbalanced towards Connect". Coverage is a
// claim the data can actually support; volume isn't.
//
// No number, no badge, no mid-point labels — a marker on a band, per the no-shame
// rule. Whether that spread SERVES the person is Vita's sentence beneath it, not
// the band's job.

function BalanceBand({ areas }: { areas: PlanBalance["areas"] }) {
  const total = areas.length;
  const covered = areas.filter((a) => a.goals.length > 0).length;
  // Inset so a full or empty spread never sits flush against the edge.
  const pos = total > 0 ? 6 + ((total - covered) / total) * 88 : 50;
  const where =
    covered >= total - 1
      ? "toward well balanced"
      : covered === total - 2
        ? "around the middle"
        : "toward wobbly";

  return (
    <div className="rlp-balband">
      <div
        className="rlp-balband-track"
        role="img"
        aria-label={`Balance: ${where}`}
      >
        <span className="rlp-balband-marker" style={{ left: `${pos}%` }} />
      </div>
      <div className="rlp-balband-labels">
        <span>Well balanced</span>
        <span>Wobbly</span>
      </div>
    </div>
  );
}

// A "Worth picking up" action reads as "<the thing> — <insight, and a first
// move>". Bold the short opening clause so each card leads with what it's about,
// instead of running on as one block of prose. Only when the lead really is a
// short label (a full opening sentence isn't one) — otherwise render it plain.
function renderWorthItem(a: string) {
  const dash = a.indexOf(" — ");
  if (dash > 0 && dash <= 44) {
    return (
      <>
        <strong className="rlp-worth-lead">{a.slice(0, dash)}</strong>
        {a.slice(dash)}
      </>
    );
  }
  return a;
}

// ---- area theme: the five balanced areas mapped onto the existing palette ----
const AREA_THEME: Record<BalancedAreaId, { base: string; sel: string; fg: string }> = {
  restore: { base: "var(--area-vitality-base)", sel: "var(--area-vitality-sel)", fg: "var(--area-vitality-fg)" },
  move: { base: "var(--area-active-base)", sel: "var(--area-active-sel)", fg: "var(--area-active-fg)" },
  think: { base: "var(--area-cognitive-base)", sel: "var(--area-cognitive-sel)", fg: "var(--area-cognitive-fg)" },
  connect: { base: "var(--area-social-base)", sel: "var(--area-social-sel)", fg: "var(--area-social-fg)" },
  contribute: { base: "var(--area-purpose-base)", sel: "var(--area-purpose-sel)", fg: "var(--area-purpose-fg)" },
};

const KIND_LABEL: Record<string, string> = {
  trip: "Trip",
  goal: "Goal",
  project: "Project",
  rhythm: "Rhythm",
  work: "Work",
};

// ---- small helpers ----

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${d} ${months[m - 1]} ${y}`;
}

// The numbers are gone. They were the spine of the old single-scroll document,
// where §1…§11 ran in order; once the sections were dealt out across six tabs
// they stopped counting anything (three different sections were all "08") and
// just advertised that the plan had been cut up. The eyebrow does the work now.
function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="rlp-sec-head">
      <p className="rlp-eyebrow">{eyebrow}</p>
      <h2 className="rlp-sec-title">{title}</h2>
    </header>
  );
}

// Bespoke imagery: a place, never a face — soft, muted, painterly. Generated
// once at plan creation and cached. Until a generated image arrives (or if image
// generation isn't switched on), it falls back to a tasteful marked placeholder
// carrying the scene description, so the layout is always whole.
function SceneImage({
  scene,
  ratio,
  src,
}: {
  scene: PlanScene;
  ratio?: string;
  src?: string;
}) {
  if (src) {
    return (
      <figure className="rlp-scene has-img" style={{ aspectRatio: ratio ?? "16 / 9" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={scene.prompt} />
      </figure>
    );
  }
  return (
    <figure className="rlp-scene" style={{ aspectRatio: ratio ?? "16 / 9" }}>
      <div className="rlp-scene-mark">Illustration</div>
      <figcaption>{scene.prompt}</figcaption>
    </figure>
  );
}

// ---- §1 self-introduction (editable drafts) ----

// ONE complete, rounded self-portrait. The member can edit it freely; the tone
// controls re-tone it on demand (warmer / wryer / shorter) without changing the
// topic. The member's own (edited / re-toned) version wins where they have one.
function SelfIntro({
  selfIntro,
  savedSelfIntro,
  onSave,
  printing = false,
}: {
  selfIntro: string;
  savedSelfIntro?: string | null;
  onSave?: (text: string) => void;
  printing?: boolean;
}) {
  const [value, setValue] = useState<string>(savedSelfIntro ?? selfIntro);
  const [busy, setBusy] = useState(false);
  if (!value && !selfIntro) return null;

  async function retone(tone: "warmer" | "wryer" | "shorter") {
    setBusy(true);
    try {
      const res = await fetch("/api/plan-self-intro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: value, tone }),
      });
      const data = (await res.json()) as { text: string | null };
      if (data.text) {
        setValue(data.text);
        onSave?.(data.text);
      }
    } catch {
      // keep current wording
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rlp-intro">
      <p className="rlp-intro-frame">
        One of the hardest questions in retirement is &ldquo;so what do you
        do?&rdquo; once the job title is gone. Here&rsquo;s one way you might put
        it &mdash; yours to edit, or to shift in tone.
      </p>
      {printing ? (
        <p className="rlp-intro-text rlp-intro-print">{value}</p>
      ) : (
      <textarea
        className="rlp-intro-text"
        value={value}
        rows={1}
        onChange={(e) => {
          setValue(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = `${e.target.scrollHeight}px`;
        }}
        onBlur={() => onSave?.(value)}
        ref={(el) => {
          if (el) {
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
          }
        }}
      />
      )}
      <div className="rlp-intro-tones">
        <span className="rlp-intro-tones-lbl">Shift the tone:</span>
        <button type="button" disabled={busy} onClick={() => retone("warmer")}>Warmer</button>
        <button type="button" disabled={busy} onClick={() => retone("wryer")}>Wryer</button>
        <button type="button" disabled={busy} onClick={() => retone("shorter")}>Shorter</button>
        {busy && <span className="rlp-intro-busy">rewriting&hellip;</span>}
      </div>
    </div>
  );
}

// ---- §3 values compass ----

function ValuesCompass({
  values,
  buckets,
  printing = false,
}: {
  printing?: boolean;
  values: {
    value: string;
    meaning?: string;
    confidence?: string;
    threat?: string;
    protectors?: string[];
  }[];
  buckets: { nonNegotiable: string[]; flexible: string[] };
}) {
  const [sel, setSel] = useState<number | null>(0);
  if (values.length === 0) return null;
  // On paper there is nothing to tap, so every value is already open.

  const bucketOf = (name: string) =>
    buckets.nonNegotiable.includes(name)
      ? "Non-negotiable"
      : buckets.flexible.includes(name)
        ? "Flexible"
        : null;

  return (
    <div className="rlp-vlist">
      {values.map((v, i) => {
        const on = printing || sel === i;
        const bucket = bucketOf(v.value);
        const hasFacets =
          v.threat || (v.protectors && v.protectors.length > 0);
        return (
          <div key={v.value}>
            <button
              type="button"
              className={`rlp-vrow${on ? " sel" : ""}`}
              aria-expanded={on}
              aria-controls={`value-${i}`}
              onClick={() => setSel(on ? null : i)}
            >
              <span className="rlp-vrow-lbl">{v.value}</span>
              {bucket && (
                <span className={`rlp-vtag ${bucket === "Non-negotiable" ? "firm" : "flex"}`}>
                  {bucket}
                </span>
              )}
            </button>
            {on && (
              <div className="rlp-vopen" id={`value-${i}`}>
                {v.meaning && <p className="rlp-vmeaning">&ldquo;{v.meaning}&rdquo;</p>}
                {/* Risk / protect are kept, but tightened: a label and the member's
                    own phrase, rather than a full "What puts it at risk: …"
                    sentence each. The words are theirs, so only the framing
                    around them is compressed. */}
                {hasFacets && (
                  <dl className="rlp-vfacets">
                    {v.threat && (
                      <div>
                        <dt>At risk from</dt>
                        <dd>{v.threat}</dd>
                      </div>
                    )}
                    {v.protectors && v.protectors.length > 0 && (
                      <div>
                        <dt>Protected by</dt>
                        <dd>{v.protectors.join(" \u00b7 ")}</dd>
                      </div>
                    )}
                  </dl>
                )}
                {v.confidence === "still forming" && (
                  <p className="rlp-vnote">Still forming &mdash; settling as you go.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- §4 seasons timeline ----

function SeasonsTimeline({
  seasons,
  enduring,
}: {
  seasons: { id: string; label: string; hint?: string; items: { label: string }[] }[];
  enduring: { label: string }[];
}) {
  const lanes = seasons.filter((s) => s.id !== "enduring");
  return (
    <div className="rlp-seasons">
      <div className="rlp-seasons-track">
        {lanes.map((season, i) => (
          <div key={season.id} className="rlp-season">
            <div className="rlp-season-head">
              <span className="rlp-season-dot" aria-hidden="true" />
              <div>
                <h3>{season.label}</h3>
                {season.hint && <p className="rlp-season-hint">{season.hint}</p>}
              </div>
            </div>
            {season.items.length ? (
              <ul className="rlp-season-items">
                {season.items.map((it, j) => <li key={j}>{it.label}</li>)}
              </ul>
            ) : (
              <p className="rlp-season-open">Intentionally left more open.</p>
            )}
            {i < lanes.length - 1 && <span className="rlp-season-arrow" aria-hidden="true">→</span>}
          </div>
        ))}
      </div>
      {enduring.length > 0 && (
        <div className="rlp-enduring">
          <h3>Throughout, in every season</h3>
          <div className="rlp-enduring-chips">
            {enduring.map((e, i) => (
              <span key={i} className="rlp-chip">{e.label}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Tab 3 · the goal, and its route ----
//
// One component for both lenses. The heart-of-it detail and the route used to be
// two sections that each listed every goal, so the member read the same titles
// twice; folding the path into the card means opening a goal re-lenses it (what
// it is → how you get there) instead of re-listing it. The route also owns the
// per-goal timing, so time is told once here and once in the first-year zoom.

function GoalCard({
  goal,
  path,
  areaLabel,
  printing = false,
}: {
  goal: PlanGoal;
  path?: PlanPath;
  areaLabel?: string;
  printing?: boolean;
}) {
  const [tapped, setTapped] = useState(false);
  const open = printing || tapped;
  const setOpen = setTapped;
  // Area is a free-text label now (4.3 dropped the fixed five), so fall back to a
  // neutral theme when it isn't one of the legacy area ids.
  const theme =
    (AREA_THEME as Record<string, { base: string; sel: string; fg: string }>)[
      goal.area
    ] ?? { base: "var(--muted-surface)", sel: "var(--brand-primary-tint)", fg: "var(--ink)" };
  const season = seasonLabel43(goal.season);

  return (
    <div
      className={`rlp-goal${open ? " open" : ""}`}
      style={{ ["--a-base" as string]: theme.base, ["--a-fg" as string]: theme.fg }}
    >
      <button className="rlp-goal-top" onClick={() => setOpen(!open)} aria-expanded={open}>
        {goal.rank && (
          <span className="rlp-goal-rank" title={`Priority ${goal.rank} in your order`}>
            {goal.rank}
          </span>
        )}
        <span className="rlp-goal-label">{goal.label}</span>
        <span className="rlp-goal-meta">
          {season && <span className="rlp-goal-season">{season}</span>}
          <span className="rlp-goal-toggle" aria-hidden="true">{open ? "–" : "+"}</span>
        </span>
      </button>
      {open && (
        <div className="rlp-goal-body">
          {areaLabel && <p className="rlp-goal-area">{areaLabel}</p>}
          {goal.note && <p className="rlp-goal-why">&ldquo;{goal.note}&rdquo;</p>}
          {goal.track === "do" ? (
            <>
              {goal.looksLike && (
                <p><span className="rlp-k">What it looks like</span> {goal.looksLike}</p>
              )}
              {goal.cadence && (
                <p><span className="rlp-k">Roughly when</span> {goal.cadence}</p>
              )}
              {goal.stretch && (
                <p><span className="rlp-k">If you&rsquo;re bold</span> {goal.stretch}</p>
              )}
            </>
          ) : (
            goal.ordinaryWeek && (
              <p><span className="rlp-k">In an ordinary week</span> {goal.ordinaryWeek}</p>
            )
          )}
          {path && <GoalRoute path={path} />}
        </div>
      )}
    </div>
  );
}

// The route lens, rendered inside the goal it belongs to.

function GoalRoute({ path }: { path: PlanPath }) {
  const hasSupport =
    (path.alreadyHelps?.length ?? 0) > 0 || (path.wouldHelp?.length ?? 0) > 0;
  const hasLadder = path.track === "do" && (path.milestones?.length ?? 0) > 0;
  if (!hasLadder && !hasSupport && !path.lean) return null;

  return (
    <div className="rlp-path">
      <p className="rlp-path-head">The route</p>
      {hasLadder && path.milestones ? (
        <ol className="rlp-ladder">
          {path.milestones.map((m, i) => (
            <li key={i} className={m.done ? "done" : ""}>
              <span className="rlp-rung-mark" aria-hidden="true">
                {m.done ? "✓" : ""}
              </span>
              <span className="rlp-rung-label">
                {m.label}
                {m.when && <span className="rlp-rung-when"> · {m.when}</span>}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="rlp-be-support">
          {path.alreadyHelps && path.alreadyHelps.length > 0 && (
            <p><span className="rlp-k">Already in place</span> {path.alreadyHelps.join("; ")}</p>
          )}
          {path.wouldHelp && path.wouldHelp.length > 0 && (
            <p><span className="rlp-k">What would help it take root</span> {path.wouldHelp.join("; ")}</p>
          )}
        </div>
      )}
      {path.lean && (
        <p className="rlp-lean">A strength to lean on: <strong>{path.lean}</strong></p>
      )}
    </div>
  );
}

// ---- §7 the week: ordered into anchors vs the flexible space around them ----

type WeekActivity = {
  label: string;
  frequency: string;
  anchor?: boolean;
  energy?: boolean;
  fixed?: boolean;
};

// Most-frequent first, within a group.
const FREQ_RANK: Record<string, number> = {
  "most days": 0,
  "a few times a week": 1,
  "weekly": 2,
  "now and then": 3,
};
function byFrequency(a: WeekActivity, b: WeekActivity): number {
  const ra = FREQ_RANK[a.frequency.toLowerCase()] ?? 4;
  const rb = FREQ_RANK[b.frequency.toLowerCase()] ?? 4;
  return ra - rb;
}

function WeekGroup({ title, items }: { title: string; items: WeekActivity[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rlp-week-group">
      <h3>{title}</h3>
      <ul>
        {items.map((a, i) => (
          <li key={i} className={a.energy ? "energy" : ""}>
            <span className="rlp-week-act">
              {a.label}
              {a.fixed && <span className="rlp-week-ongoing"> · ongoing work</span>}
            </span>
            <span className="rlp-week-freq">{a.frequency}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- "See how it all connects" — the signature web ----
//
// A calm vertical list of the REAL links between values, goals and people, where
// selecting a node draws ONLY its own connections and says why, in the member's
// own terms.
//
// It used to be a radial ring, which couldn't work: up to 18 nodes on a circle
// leaves ~40px between them, so every label was hard-cut to 21 characters and the
// ends were still clipped by the page's overflow. The deeper problem was drawing
// all ~16 edges at once — that turns to spaghetti in ANY layout. So the fix isn't
// a cleverer arrangement: it's showing the pieces calmly and drawing connections
// only on demand. A single column is also already the phone layout, so nothing
// has to collapse, and labels get the full width and never need truncating.

const WEB_GROUPS: { kind: ConnectionKind; name: string }[] = [
  { kind: "value", name: "Values" },
  { kind: "goal", name: "Goals" },
  { kind: "person", name: "People" },
];

// Where the dots actually sit, read back from the rendered rows. The links open
// INLINE under the row you tapped, so the rows below shift and no fixed layout
// maths can predict the geometry — we measure instead, and the arcs are drawn
// against what's really on screen. Measuring also means a wrapped label or a
// narrow phone can't put the SVG out of step with the DOM.
type WebGeom = { h: number; x: number; y: Record<string, number> };

function sameGeom(a: WebGeom, b: WebGeom) {
  if (a.h !== b.h || a.x !== b.x) return false;
  const ak = Object.keys(a.y);
  if (ak.length !== Object.keys(b.y).length) return false;
  return ak.every((k) => a.y[k] === b.y[k]);
}

function ConnectionsWeb({ graph, printing = false }: { graph: ConnectionsGraph; printing?: boolean }) {
  const [sel, setSel] = useState<string | null>(null);
  const [geom, setGeom] = useState<WebGeom>({ h: 0, x: 0, y: {} });
  const stackRef = useRef<HTMLDivElement | null>(null);
  const dots = useRef(new Map<string, HTMLSpanElement>());
  const { nodes, edges } = graph;

  const measure = useCallback(() => {
    const stack = stackRef.current;
    if (!stack) return;
    const box = stack.getBoundingClientRect();
    const y: Record<string, number> = {};
    let x = 0;
    dots.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      y[id] = r.top - box.top + r.height / 2;
      x = r.left - box.left + r.width / 2;
    });
    const next = { h: stack.offsetHeight, x, y };
    setGeom((prev) => (sameGeom(prev, next) ? prev : next));
  }, []);

  // Re-measure before paint whenever the selection changes the layout, and on
  // any resize (rotation, wrapped labels).
  useLayoutEffect(() => {
    measure();
    const stack = stackRef.current;
    if (!stack || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(stack);
    return () => ro.disconnect();
  }, [measure, sel]);

  const labelOf = (id: string) => nodes.find((n) => n.id === id)?.label ?? id;

  // What the selection touches — used to light rows and to draw the only arcs
  // that ever appear.
  const linked = new Set<string>();
  if (sel) {
    linked.add(sel);
    for (const e of edges) {
      if (e.from === sel) linked.add(e.to);
      if (e.to === sel) linked.add(e.from);
    }
  }

  const groups = WEB_GROUPS.map((g) => ({
    ...g,
    items: nodes.filter((n) => n.kind === g.kind),
  })).filter((g) => g.items.length > 0);

  const linksFor = (id: string) =>
    edges
      .filter((e) => e.from === id || e.to === id)
      .map((e) => ({ label: labelOf(e.from === id ? e.to : e.from), why: e.why }));

  // On paper there is no selection, so the arcs carry nothing — drawing all of
  // them at once is the hairball this layout exists to avoid. The links become
  // text instead: each node, and what it connects to, with the reason.
  if (printing) {
    return (
      <div className="rlp-web-print">
        {groups.map((g) => (
          <div key={g.kind} className="rlp-web-group">
            <div className="rlp-web-grouphead">{g.name}</div>
            {g.items.map((n) => {
              const links = linksFor(n.id);
              if (links.length === 0) return null;
              return (
                <div key={n.id} className="rlp-web-pnode">
                  <h4>{n.label}</h4>
                  <ul>
                    {links.map((d, i) => (
                      <li key={i}>
                        <strong>{d.label}</strong>
                        {d.why ? ` — ${d.why}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rlp-web">
      <div className="rlp-web-stack" ref={stackRef}>
        <svg
          className="rlp-web-arcs"
          width={geom.x + 6}
          height={geom.h}
          viewBox={`0 0 ${geom.x + 6} ${geom.h}`}
          aria-hidden="true"
        >
          {edges
            .filter((e) => sel && (e.from === sel || e.to === sel))
            .map((e, i) => {
              const y1 = geom.y[e.from];
              const y2 = geom.y[e.to];
              if (y1 === undefined || y2 === undefined) return null;
              // Bulge left into the gutter, more for a longer reach — but never
              // past the edge, however narrow the gutter gets.
              const b = Math.min(geom.x - 6, 8 + Math.abs(y2 - y1) * 0.09);
              return (
                <path
                  key={i}
                  d={`M ${geom.x} ${y1} C ${geom.x - b} ${y1}, ${geom.x - b} ${y2}, ${geom.x} ${y2}`}
                  fill="none"
                  stroke="var(--ink)"
                  strokeWidth={2}
                />
              );
            })}
        </svg>

        {groups.map((g) => (
          <div key={g.kind} className="rlp-web-group">
            <div className="rlp-web-grouphead">{g.name}</div>
            {g.items.map((n) => {
              const isSel = sel === n.id;
              const lit = !sel || linked.has(n.id);
              return (
                <div key={n.id}>
                  <div className="rlp-web-line">
                    <span
                      ref={(el) => {
                        if (el) dots.current.set(n.id, el);
                        else dots.current.delete(n.id);
                      }}
                      className={`rlp-web-dot${lit ? " lit" : ""}`}
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      className={`rlp-web-row${isSel ? " sel" : ""}${lit ? "" : " dim"}`}
                      aria-expanded={isSel}
                      aria-controls={`web-links-${n.id}`}
                      onClick={() => setSel(isSel ? null : n.id)}
                    >
                      {n.label}
                    </button>
                  </div>
                  {isSel && (
                    <ul className="rlp-web-links" id={`web-links-${n.id}`}>
                      {linksFor(n.id).map((d, i) => (
                        <li key={i}>
                          <strong>{d.label}</strong>
                          {d.why ? ` — ${d.why}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- the document ----

export default function RlpPlanDocument({
  plan,
  seeded,
  images = {},
  generating = false,
  savedSelfIntro,
  onSaveSelfIntro,
}: {
  plan: RlpPlan;
  seeded: boolean;
  images?: Record<string, string>;
  // True while Vita's prose is still being written on a first-ever open — the
  // prose-only tabs show a "still writing" note rather than rendering blank.
  generating?: boolean;
  savedSelfIntro?: string | null;
  onSaveSelfIntro?: (text: string) => void;
}) {
  const { meta, opening, balance, values, movingTowards, prioritisedAreas, paths, week, leavingWork, firstYear, connections, openThreads } = plan;
  // Retirement paths (Phase 5): all empty/null for working + flag-off. (The
  // "keep" items double as the week's anchors — rendered in the reset section.)
  // resetActions is the FRAMED "Worth picking up" (never the raw change items).
  const { title, retired, reflections, orientation, reset, resetActions, windDownExit, onsetGentle } =
    plan;

  // The plan reads as six tabs rather than one long scroll. Section order in this
  // file already matches the tab order, so each section is grouped in place by a
  // guard rather than being moved — the one exception is the retired reset, whose
  // columns belong to Overview and whose "Worth picking up" belongs to Goals.
  // Tab 5's name is per-cohort: the retired cohorts aren't planning a first year.
  // Goals and their routes are keyed by the goal's label (the route build copies
  // it across verbatim), so the two lenses can be paired back up into one card.
  const pathByGoal = new Map(paths.paths.map((p) => [p.goal, p]));
  const pathFor = (label: string) => pathByGoal.get(label);

  // Tab 5's name has to be true of where the member stands. Anyone still working
  // is looking at the crossing itself, whenever it lands — so the tab is "The
  // transition" whether they're two years out or twenty. Once they're retired
  // there's no crossing left to name and the tab is simply the year they're in.
  const aheadLabel = retired ? "The year ahead" : "The transition";
  const TABS: PlanTabDef[] = [
    { id: "overview", label: "Overview" },
    { id: "days", label: "Days and years" },
    { id: "goals", label: "Goals" },
    { id: "connections", label: "Connections" },
    { id: "ahead", label: aheadLabel },
    { id: "reflections", label: "Reflections" },
  ];
  const [tab, setTab] = useState<string>("overview");
  const areaLabels = Object.fromEntries(
    balance.areas.map((a) => [a.id, a.label])
  ) as Record<BalancedAreaId, string>;

  // One flat list in the member's chosen order. Goals with no rank sort last
  // rather than jumping to the front on a falsy 0/undefined.
  const orderedGoals = prioritisedAreas
    .flatMap((a) => a.goals)
    .sort((x, y) => (x.rank ?? Infinity) - (y.rank ?? Infinity));

  // Values already shown as a tagged row in the compass list — so the bucket
  // chips below it only need to carry anything the list didn't.
  const coreNames = new Set(values.coreValues.map((v) => v.value));
  const firmOnly = values.nonNegotiables.filter((v) => !coreNames.has(v));
  const flexOnly = values.flexible.filter((v) => !coreNames.has(v));

  const heroScene = plan.scenes.find((s) => s.slot === "hero");
  const sceneFor = (id: string) => plan.scenes.find((s) => s.slot === id);

  // PRINTING. The PDF is this same document, printed — not a second
  // implementation. `printing` unfolds every tab and opens every expandable, then
  // the browser prints; @media print does the rest. There is no parallel renderer
  // to keep in sync, so the PDF cannot drift from the app.
  // PREVIEW vs PRINTING are two different things and were wrongly one piece of
  // state: /plan?print=1 shows the unfolded document on screen, and the button
  // runs a real print. Conflating them meant the effect bailed out on the
  // preview URL — so on ?print=1 the Save as PDF button silently did nothing.
  const [preview] = useState(
    () =>
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("print") === "1"
  );
  const [printing, setPrinting] = useState(false);
  // Unfolded = every tab rendered and every expandable open — what print reads.
  const unfolded = preview || printing;

  function printPlan() {
    // flushSync, not a timeout: the unfolded DOM must exist BEFORE print() reads
    // it, and print() must stay inside the click's user activation — a deferred
    // call loses the gesture and browsers may refuse it with no error at all.
    flushSync(() => setPrinting(true));
    try {
      window.print();
    } finally {
      setPrinting(false);
    }
  }

  return (
    <main className="rlp-plan">
      <style>{css}</style>

      {seeded && (
        <div className="rlp-seedbar">
          Example member &mdash; this plan is seeded for development with one
          realistic person.
        </div>
      )}

      {/* ---- The plan's own head: everything true of the WHOLE artefact sits
           above the tabs, so it reads as one document with six ways in rather
           than six documents. The title, who it's for and when it was made
           belong to the plan, not to the Overview tab. ---- */}
      <header className="rlp-head" style={{ ["--rlp-head-ground" as string]: stageHeroGroundFor(4) }}>
        {/* The Chorus front door. The plan is Stage 4's output, so it wears
            Stage 4's pairing — cream field, orange graphic — read from the same
            table as the dashboard's stage heroes rather than hardcoded here. The
            graphic is cropped bottom-right and the body is width-capped so the
            circles can never run through the title. */}
        <ChorusVectorGraphic fill={stageHeroGraphicFor(4)} className="rlp-head-gfx" />
        <div className="rlp-head-body">
          <h1 className="rlp-plan-title">{title}</h1>
          <p className="rlp-head-lede">
            Your plan in six parts. Move through the tabs to read it in full.
          </p>
          <dl className="rlp-meta">
            {meta.name && (
              <div><dt>For</dt><dd>{meta.name}</dd></div>
            )}
            <div><dt>Created</dt><dd>{formatDate(meta.dateCreated)}</dd></div>
            <div><dt>Last reviewed</dt><dd>{formatDate(meta.dateLastReviewed)}</dd></div>
            <div><dt>Next review</dt><dd>{formatDate(meta.nextReviewDue)}</dd></div>
          </dl>
          {/* Under the meta rather than beside the title: the title is wide enough
              at display size that two pills alongside it just wrap, which put the
              buttons between the title and its own opening line. */}
          <div className="rlp-head-actions">
            <a href="#whats-next" className="rlp-headbtn">Next Stage</a>
            <a href="/home" className="rlp-headbtn">Return Home</a>
            <button type="button" onClick={printPlan} className="rlp-headbtn">
              Save as PDF
            </button>
          </div>
        </div>
      </header>

      <PlanTabs tabs={TABS} activeId={tab} onChange={setTab}>

      {/* ---- TAB 1 · Overview ----
          Sections are GROUPED BY TAB, and the groups run in tab order. They used
          to be interleaved — file order decided the layout, so the Reflections
          read physically sat between the self-intro and the values. Invisible
          while one tab renders at a time; wrong the moment the whole document is
          printed in order. Keep each tab's sections together. */}
      {(unfolded || tab === "overview") && (
      <>
      {/* §1 — opening */}
      <section className="rlp-section rlp-opening">
        <h1 className="rlp-chapter-title">{opening.chapterTitle}</h1>
        {heroScene && <SceneImage scene={heroScene} ratio="21 / 9" src={images.hero} />}
        {orientation && <p className="rlp-overview rlp-orientation">{orientation}</p>}
        {opening.overview && <p className="rlp-overview">{opening.overview}</p>}
        {opening.insight && <p className="rlp-insight">{opening.insight}</p>}
      </section>

      {/* The self-portrait, given its own section. It was buried at the foot of
          the opening with nothing to announce it — the single most personal
          thing in the plan, reading as an afterthought to the chapter title. */}
      <section className="rlp-section">
        <SectionHead eyebrow="In your words" title="How you'd introduce yourself now" />
        <SelfIntro
          key={opening.selfIntro}
          selfIntro={opening.selfIntro}
          savedSelfIntro={savedSelfIntro}
          onSave={onSaveSelfIntro}
          printing={unfolded}
        />
      </section>
      </>
      )}

      {/* §3 — values (Tab 1 · Overview) */}
      {(unfolded || tab === "overview") && (
      <section className="rlp-section">
        {/* "Your compass" named a picture that no longer exists. */}
        <SectionHead eyebrow="Guiding principles" title="What matters most to you" />
        {values.coreValues.length > 0 && (
          <>
            <p className="rlp-lede">
              These are the values that will steer you when you&rsquo;re pulled in
              different directions.
            </p>
            <div className="rlp-helper">
              <HelperLine>Tap any value to read what it means to you.</HelperLine>
            </div>
          </>
        )}
        <ValuesCompass
          values={values.coreValues}
          buckets={{ nonNegotiable: values.nonNegotiables, flexible: values.flexible }}
          printing={unfolded}
        />
        {/* Only the buckets that AREN'T already on a value row. Each row now
            carries its own Non-negotiable / Flexible tag, so listing the same
            names again underneath was the plan reading itself back. The lists
            can hold names that were never chosen as core values, though, so the
            strays still get shown rather than silently dropped. */}
        {(firmOnly.length > 0 || flexOnly.length > 0) && (
          <div className="rlp-buckets">
            {firmOnly.length > 0 && (
              <div>
                <h3>Also holding firm on</h3>
                <div className="rlp-chips">
                  {firmOnly.map((v) => <span key={v} className="rlp-chip firm">{v}</span>)}
                </div>
              </div>
            )}
            {flexOnly.length > 0 && (
              <div>
                <h3>Where else you can flex</h3>
                <div className="rlp-chips">
                  {flexOnly.map((v) => <span key={v} className="rlp-chip flex">{v}</span>)}
                </div>
              </div>
            )}
          </div>
        )}
        {values.principles.length > 0 && (
          <div className="rlp-principles">
            <h3>How you&rsquo;ll decide when things pull apart</h3>
            <ul>
              {values.principles.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        )}
      </section>
      )}

      {/* §8 — retired: the reset. Split across two tabs: the stock-take columns
          are a compact summary in Overview, while "Worth picking up" (below) is a
          source of goals and belongs in Goals. Separating them also stops the
          member reading their own `change` items twice on one screen. */}
      {(unfolded || tab === "overview") && reset && (
        <section className="rlp-section">
          <SectionHead eyebrow="The reset" title="Carrying forward, reshaping, letting go" />
          {onsetGentle && (
            <p className="rlp-overview">
              Leaving work wasn&rsquo;t entirely on your terms, so this is less
              about a fresh start and more about making the retirement you&rsquo;re
              in feel like your own.
            </p>
          )}
          <div className="rlp-reset">
            {reset.keep.length > 0 && (
              <div className="rlp-reset-col">
                <h3 className="rlp-reset-head">Carrying forward</h3>
                <p className="rlp-reset-sub">What&rsquo;s working — the anchors of your week.</p>
                <ul className="rlp-reset-list">
                  {reset.keep.map((x, i) => <li key={i}>{x}</li>)}
                </ul>
              </div>
            )}
            {reset.change.length > 0 && (
              <div className="rlp-reset-col">
                <h3 className="rlp-reset-head">Reshaping</h3>
                <p className="rlp-reset-sub">What you&rsquo;d like to change.</p>
                <ul className="rlp-reset-list">
                  {reset.change.map((x, i) => <li key={i}>{x}</li>)}
                </ul>
              </div>
            )}
            {reset.leaveBehind.length > 0 && (
              <div className="rlp-reset-col">
                <h3 className="rlp-reset-head">Letting go</h3>
                <p className="rlp-reset-sub">What you&rsquo;d happily leave behind.</p>
                <ul className="rlp-reset-list">
                  {reset.leaveBehind.map((x, i) => <li key={i}>{x}</li>)}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ---- TAB 2 · Days and years ---- */}
      {/* §4 — the seasons, heading this tab. It keeps its per-season items:
          they're what makes the shape of the years legible, and losing them cost
          more than the repetition did. The generated arc line is the lede. */}
      {(unfolded || tab === "days") && (
      <section className="rlp-section">
        <SectionHead eyebrow="The shape of it" title="How the years unfold" />
        {movingTowards.arc && <p className="rlp-lede">{movingTowards.arc}</p>}
        <SeasonsTimeline seasons={movingTowards.seasons} enduring={movingTowards.enduring} />
      </section>
      )}

      {/* §7 — how my days feel (Tab 2 · Days and years) */}
      {(unfolded || tab === "days") && week && (
        <section className="rlp-section">
          <SectionHead eyebrow="The everyday" title="How you want your days to feel" />
          {week.rhythm && <p className="rlp-week-narrative">{week.rhythm}</p>}
          <div className="rlp-structure">
            <span>{week.structureLeft}</span>
            <div className="rlp-structure-track">
              <span className="rlp-structure-dot" style={{ left: `${week.structure}%` }} />
            </div>
            <span>{week.structureRight}</span>
          </div>
          {(() => {
            const holds = week.activities
              .filter((a) => a.anchor || a.fixed)
              .sort(byFrequency);
            const moves = week.activities
              .filter((a) => !a.anchor && !a.fixed)
              .sort(byFrequency);
            const anyEnergy = week.activities.some((a) => a.energy);
            return (
              <>
                <div className="rlp-week-groups">
                  <WeekGroup title="What holds your week" items={holds} />
                  <WeekGroup title="What moves around it" items={moves} />
                </div>
                {anyEnergy && (
                  <p className="rlp-week-legend">
                    <span className="rlp-week-swatch" aria-hidden="true" />
                    gives you energy
                  </p>
                )}
              </>
            );
          })()}
          <p className="rlp-fineprint">The character of an ordinary week, lived for years &mdash; not a timetable.</p>
        </section>
      )}

      {/* ---- TAB 3 · Goals ---- */}
      {/* §5 + §6 — the goals, each carrying its own route (Tab 3 · Goals).
          They run in the member's own order of priority rather than in five area
          piles: grouped by area, the ranks read 3, 2, 4, 1, 5 and the order they
          actually chose — the whole point of the exercise — was invisible. The
          area still travels with each goal (its colour, and named in the open
          body), so nothing is lost by dropping the group headings. */}
      {(unfolded || tab === "goals") && (
      <section className="rlp-section">
        <SectionHead eyebrow="The heart of it" title="Your most important goals" />
        <p className="rlp-lede">
          The handful whose absence would leave retirement feeling incomplete, in
          your order of priority. Open any goal to see what it looks like and the
          route to it.
        </p>
        {orderedGoals.map((g, i) => (
          <GoalCard key={i} goal={g} path={pathFor(g.label)} areaLabel={(areaLabels as Record<string, string>)[g.area] ?? g.area} printing={unfolded} />
        ))}
      </section>
      )}

      {/* §6 — the route no longer has its own section: each goal now carries its
          own path (see GoalRoute), so the goals are listed once. What remains is
          plan-level rather than per-goal — the strengths across all of them. */}
      {(unfolded || tab === "goals") && paths.strengths.length > 0 && (
      <section className="rlp-section">
        <div className="rlp-strengths">
          <h3>Strengths and resources to lean on</h3>
          {paths.strengthsRead && <p className="rlp-strengths-read">{paths.strengthsRead}</p>}
          <div className="rlp-chips">
            {paths.strengths.map((s) => <span key={s} className="rlp-chip">{s}</span>)}
          </div>
        </div>
      </section>
      )}

      {/* Worth picking up (Tab 3 · Goals) — candidate goals drawn from what the
          member said they'd reshape, plus any unfinished work. */}
      {(unfolded || tab === "goals") && resetActions.length > 0 && (
        <section className="rlp-section">
          <div className="rlp-candidates">
            <h3 className="rlp-reset-head">Worth picking up</h3>
            <p className="rlp-reset-sub">A few ways to act on what you&rsquo;d reshape — small, concrete first moves.</p>
            <ul className="rlp-worth-list">
              {resetActions.map((a, i) => (
                <li key={i}>{renderWorthItem(a)}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ---- TAB 4 · Connections ---- */}
      {/* The web (Tab 4 · Connections) — its own tab, a light breather. */}
      {(unfolded || tab === "connections") && connections && (
        <section className="rlp-section">
          <SectionHead eyebrow="The web of it" title="See how it all connects" />
          <p className="rlp-lede">
            Nothing in your plan stands on its own. The values you named, the
            goals you chose and the people around you pull on each other &mdash;
            and those links are the reason the plan holds together.
          </p>
          <div className="rlp-helper">
            <HelperLine>
              Tap any value, goal or person to draw its connections and read why
              each one is there. Tap it again to clear them.
            </HelperLine>
          </div>
          <ConnectionsWeb graph={connections} printing={unfolded} />
        </section>
      )}
      {/* While Vita is still writing on a first-ever open, the web isn't ready —
          say so, rather than showing an empty tab that reads as broken. */}
      {(unfolded || tab === "connections") && !connections && generating && (
        <section className="rlp-section">
          <SectionHead eyebrow="The web of it" title="See how it all connects" />
          <p className="rlp-writing">Vita is drawing the connections across your plan&hellip; this takes a moment on your first visit.</p>
        </section>
      )}

      {/* ---- TAB 5 · The transition / The year ahead ---- */}
      {/* §9 — the year ahead (Tab 5). The retired cohorts aren't arriving at
          anything and aren't having a first year — they're already living it, so
          the same season structure is framed as the chapter ahead instead. */}
      {(unfolded || tab === "ahead") && firstYear && (
        <section className="rlp-section rlp-firstyear">
          <SectionHead
            eyebrow={retired ? "Ahead" : "Arriving"}
            title={retired ? "The year ahead of you" : "Your first year of retirement"}
          />
          {firstYear.narrative && (
            <p className="rlp-narrative">{firstYear.narrative}</p>
          )}
          <div className="rlp-fy-track">
            {firstYear.seasons.filter((s) => s.items.length > 0).map((s) => {
              const scene = sceneFor(s.id);
              return (
                <div key={s.id} className="rlp-fy-phase">
                  <h3>{s.label}</h3>
                  {scene && <SceneImage scene={scene} ratio="4 / 3" src={images[s.id]} />}
                  <ul>
                    {s.items.length ? (
                      s.items.map((it, j) => (
                        <li key={j} className={it.top ? "top" : ""}>
                          {it.top && <span className="rlp-star" aria-label="Headline moment">★</span>}
                          {it.label}
                          <span className="rlp-fy-kind">{KIND_LABEL[it.kind]}</span>
                        </li>
                      ))
                    ) : (
                      <li className="rlp-season-empty">&mdash;</li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
          {firstYear.allYear.length > 0 && (
            <div className="rlp-fy-lane">
              <h4>{firstYear.allYearLabel}</h4>
              <div className="rlp-chips">
                {firstYear.allYear.map((it, i) => <span key={i} className="rlp-chip">{it.label}</span>)}
              </div>
            </div>
          )}
          <div className="rlp-fy-work">
            <h4>{firstYear.workLabel}</h4>
            {firstYear.work.length ? (
              <ul className="rlp-work-list">
                {firstYear.work.map((it, i) => <li key={i}>{it.label}</li>)}
              </ul>
            ) : (
              <p className="rlp-fineprint">{firstYear.noWorkLabel}</p>
            )}
          </div>
        </section>
      )}

      {/* §8 — winding-down, decided: the settled exit (from the wind_down_exit fact).
          Tab 5 · pre-exit only — the retired cohorts have no leaving-work panel. */}
      {(unfolded || tab === "ahead") && windDownExit && (
        <section className="rlp-section">
          <SectionHead eyebrow="The threshold" title="Leaving work" />
          <dl className="rlp-facts">
            <div>
              <dt>Your plan</dt>
              <dd>You&rsquo;ve settled how and when you&rsquo;ll leave work fully.</dd>
            </div>
            {windDownExit.currentShape && (
              <div>
                <dt>Where you are now</dt>
                <dd>
                  Still working {windDownExit.currentShape.toLowerCase()}
                  {windDownExit.windingDuration
                    ? `, winding down ${windDownExit.windingDuration.toLowerCase()}`
                    : ""}.
                </dd>
              </div>
            )}
          </dl>
          <div className="rlp-finance">
            <p>
              <strong>Financial confidence.</strong>{" "}
              Worth firming up with your pension provider or a financial adviser as the natural next step.
            </p>
          </div>
        </section>
      )}

      {/* §8 — working + winding-undecided: leaving work (from the 4.1 readiness
          build). Tab 5 · pre-exit only. */}
      {(unfolded || tab === "ahead") && leavingWork && (
        <section className="rlp-section">
          <SectionHead eyebrow="The threshold" title="Leaving work" />
          {/* Plain labelled facts, never a stitched sentence. */}
          <dl className="rlp-facts">
            <div>
              <dt>Transition</dt>
              <dd>{leavingWork.lean === "gradual" ? "A gradual wind-down" : "A clean break"}</dd>
            </div>
            {leavingWork.shape && (
              <div><dt>Shape</dt><dd>{leavingWork.shape}</dd></div>
            )}
            {leavingWork.period && (
              <div><dt>Over</dt><dd>{leavingWork.period}</dd></div>
            )}
            {leavingWork.window && (
              <div>
                <dt>Window</dt>
                <dd>{leavingWork.window.fromLabel}&ndash;{leavingWork.window.toLabel} years from now</dd>
              </div>
            )}
          </dl>
          <div className="rlp-factors">
            {leavingWork.factors.map((f) => (
              <div key={f.id} className="rlp-factor">
                <span className="rlp-factor-label">{f.label}</span>
                <span className={`rlp-factor-level lvl-${f.level.toLowerCase()}`}>{f.level}</span>
              </div>
            ))}
          </div>
          <div className="rlp-finance">
            <p>
              <strong>Financial confidence.</strong>{" "}
              {leavingWork.financeNote ||
                "Worth firming up with your pension provider or a financial adviser as the natural next step."}
            </p>
          </div>
        </section>
      )}

      {/* ---- TAB 6 · Reflections ---- */}
      {/* Tab 6 · Vita's read — the first of two clearly-voiced halves. Cream,
          because this is Vita speaking. §2's standalone chart is gone: its
          five-area spread is now the band inside the balance read. */}
      {(unfolded || tab === "reflections") && (
      <section className="rlp-section rlp-vitaread">
        <div className="rlp-vitaread-head">
          <VitaMark size={34} />
          <div>
            <p className="rlp-eyebrow">Vita&rsquo;s read</p>
            <h2 className="rlp-sec-title">How your plan looks to me</h2>
          </div>
        </div>

        {/* First-ever open: the reads are still being written. Show the balance
            band (it's ready) and say the rest is coming, not a blank tab. */}
        {generating && !reflections.balanceRead && (
          <p className="rlp-writing">Vita is writing her read of your plan&hellip; this takes a moment on your first visit.</p>
        )}

        <div className="rlp-read">
          <h3>Balance</h3>
          <BalanceBand areas={balance.areas} />
          {reflections.balanceCallout && (
            <p className="rlp-read-callout">{reflections.balanceCallout}</p>
          )}
          {reflections.balanceRead && <p>{reflections.balanceRead}</p>}
        </div>

        {/* Not sought out — only shown where there was something real to say. */}
        {reflections.realismNote && (
          <div className="rlp-read">
            <h3>What the plan rests on</h3>
            {reflections.realismCallout && (
              <p className="rlp-read-callout">{reflections.realismCallout}</p>
            )}
            <p>{reflections.realismNote}</p>
          </div>
        )}
        {reflections.whatsStrong && (
          <div className="rlp-read">
            <h3>What&rsquo;s strong here</h3>
            {reflections.strongCallout && (
              <p className="rlp-read-callout">{reflections.strongCallout}</p>
            )}
            <p>{reflections.whatsStrong}</p>
          </div>
        )}
        {/* Held against their OWN rules — absent when they set none. */}
        {reflections.coherence && (
          <div className="rlp-read">
            <h3>Coherence with your own rules</h3>
            {reflections.coherenceCallout && (
              <p className="rlp-read-callout">{reflections.coherenceCallout}</p>
            )}
            <p>{reflections.coherence}</p>
          </div>
        )}
      </section>
      )}

      {/* §10 — open threads (Tab 6 · Reflections — the USER-voice half, kept
          distinct from Vita's read so the two voices never blur) */}
      {(unfolded || tab === "reflections") && openThreads.length > 0 && (
        <section className="rlp-section">
          <SectionHead eyebrow="Still in motion" title="What you're still working out" />
          <p className="rlp-lede">
            The honest live edges of your plan &mdash; not gaps or failures, but
            the things you&rsquo;re still turning over and want to keep working out.
          </p>
          <ul className="rlp-threads">
            {openThreads.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      </PlanTabs>

      {/* §11 — first steps. Outside the tabs, at the foot of the plan: what
          comes next follows the WHOLE plan, not the Reflections tab, and
          shouldn't be reachable only by whoever happens to open tab 6. The
          button in the head jumps here. */}
      <section id="whats-next" className="rlp-section rlp-firststeps">
        <p className="rlp-eyebrow">What comes next</p>
        <h2 className="rlp-firststeps-title">First steps</h2>
        <p className="rlp-lede">
          This plan is the shape of the years ahead. The next stage turns the
          stepping stones into real, dated first actions &mdash; one small move at
          a time.
        </p>
        <a href="/home" className="rlp-begin">Begin Act →</a>
      </section>
    </main>
  );
}

const css = `
.rlp-plan{max-width:880px;width:100%;margin:0 auto;padding:8px 28px 80px;color:var(--text);box-sizing:border-box;overflow-x:hidden}
.rlp-plan *{box-sizing:border-box;min-width:0}
.rlp-plan img,.rlp-plan textarea,.rlp-plan svg{max-width:100%}
.rlp-plan p,.rlp-plan li,.rlp-plan dd{overflow-wrap:break-word}
.rlp-overview{font-family:var(--font-serif);font-size:var(--fs-h2);line-height:1.55;color:var(--ink);margin:0 0 24px;max-width:62ch}
.rlp-seedbar{background:var(--info-surface);border:1px solid var(--info-line);color:var(--info-text);font-size:var(--fs-sm);border-radius:var(--r-sm);padding:9px 14px;margin:16px 0}

/* the plan's head — above the tabs, true of the whole artefact */
.rlp-head{position:relative;overflow:hidden;margin:12px 0 26px;padding:32px;border-radius:var(--r-lg);background:var(--rlp-head-ground);color:var(--chorus-dark-green)}
.rlp-head-gfx{position:absolute;height:200%;left:104%;top:80%;transform:translate(-50%,-50%);pointer-events:none}
.rlp-head-body{position:relative;max-width:62%}
.rlp-plan-title{font-family:var(--font-serif);font-size:var(--fs-display);font-weight:600;color:var(--chorus-dark-green);letter-spacing:-.01em;line-height:1.15;margin:0}
.rlp-head-actions{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0 0}
.rlp-headbtn{font-family:var(--font-sans);font-size:var(--fs-sm);font-weight:600;color:var(--chorus-dark-green);background:color-mix(in srgb, #fff 55%, transparent);border:1px solid color-mix(in srgb, var(--chorus-dark-green) 25%, transparent);border-radius:var(--r-pill);padding:7px 16px;cursor:pointer;text-decoration:none;white-space:nowrap}
.rlp-headbtn:hover:not(:disabled){background:#fff}
.rlp-headbtn:disabled{opacity:.5;cursor:default}
.rlp-head-lede{font-size:var(--fs-body);color:color-mix(in srgb, var(--chorus-dark-green) 78%, transparent);margin:10px 0 0}

.rlp-section{margin:48px 0;padding-top:8px}
/* The rule SEPARATES sections — it isn't part of a section's head. It used to
   hang off .rlp-sec-head, which was right in a single scroll and wrong the
   moment the sections were dealt across tabs: the first section in every tab
   drew its own line directly under the tab strip's border, so each tab opened
   with two rules and a band of dead space between them. */
.rlp-section + .rlp-section{border-top:1px solid var(--border);padding-top:30px}
.rlp-eyebrow{font-size:var(--fs-eyebrow);letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);font-weight:600;margin:0 0 6px}
.rlp-lede{font-size:var(--fs-body);color:var(--text-muted);max-width:60ch;margin:0 0 22px}
.rlp-writing{font-family:var(--font-serif);font-style:italic;font-size:var(--fs-body);color:var(--text-muted);margin:6px 0 0}
.rlp-helper{margin:0 0 18px}

.rlp-sec-head{margin:0 0 22px}
.rlp-sec-title{font-family:var(--font-serif);font-size:var(--fs-display);font-weight:600;color:var(--ink);margin:0;line-height:1.15;letter-spacing:-.01em}

/* opening */
.rlp-opening{margin-top:8px}
.rlp-chapter-title{font-family:var(--font-serif);font-size:44px;line-height:1.1;font-weight:600;color:var(--ink);letter-spacing:-.02em;margin:0 0 24px;max-width:18ch}
.rlp-intro{margin:0 0 28px}
.rlp-intro-frame{font-size:var(--fs-body);color:var(--text-muted);max-width:58ch;margin:0 0 12px}
.rlp-intro-text{width:100%;background:var(--warm-surface);border:1px solid var(--warm-line);border-radius:var(--r-md);padding:16px 18px;resize:none;font-family:var(--font-serif);font-size:var(--fs-title);line-height:1.5;color:var(--ink);overflow:hidden}
.rlp-intro-print{white-space:pre-wrap;height:auto!important;overflow:visible!important;margin:0}
.rlp-intro-text:focus{outline:none;box-shadow:var(--focus-ring);border-color:var(--brand-primary)}
.rlp-intro-tones{display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap}
.rlp-intro-tones-lbl{font-size:var(--fs-sm);color:var(--text-muted);margin-right:2px}
.rlp-intro-tones button{font-family:var(--font-sans);font-size:var(--fs-sm);font-weight:600;color:var(--brand-primary);background:none;border:1px solid var(--border-strong);border-radius:var(--r-pill);padding:5px 14px;cursor:pointer}
.rlp-intro-tones button:hover:not(:disabled){background:var(--brand-primary-tint)}
.rlp-intro-tones button:disabled{opacity:.5;cursor:default}
.rlp-intro-busy{font-size:var(--fs-sm);font-style:italic;color:var(--text-faint)}
.rlp-insight{font-family:var(--font-serif);font-style:italic;font-size:var(--fs-title);line-height:1.5;color:var(--accent-strong);margin:0 0 22px;padding-left:16px;border-left:2px solid var(--accent);max-width:58ch}

.rlp-meta{display:flex;flex-wrap:wrap;gap:16px 36px;margin:20px 0 0;padding-top:18px;border-top:1px solid color-mix(in srgb, var(--chorus-dark-green) 20%, transparent)}
.rlp-meta div{display:flex;flex-direction:column;gap:2px}
.rlp-meta dt{font-size:var(--fs-eyebrow);text-transform:uppercase;letter-spacing:.1em;color:color-mix(in srgb, var(--chorus-dark-green) 60%, transparent);font-weight:700}
.rlp-meta dd{margin:0;font-size:var(--fs-sm);color:var(--chorus-dark-green);font-weight:600}

/* scene placeholders */
.rlp-scene{position:relative;width:100%;margin:0 0 24px;border-radius:var(--r-lg);overflow:hidden;background:linear-gradient(135deg,var(--ill-sky-pale),var(--ill-lavender) 60%,var(--warm-surface));border:1px solid var(--warm-line);display:flex;align-items:flex-end}
.rlp-scene-mark{position:absolute;top:10px;left:12px;font-size:var(--fs-eyebrow);text-transform:uppercase;letter-spacing:.1em;font-weight:700;color:var(--ink);opacity:.55;background:rgba(255,255,255,.6);padding:3px 8px;border-radius:var(--r-pill)}
.rlp-scene figcaption{font-size:var(--fs-sm);font-style:italic;color:var(--ink);background:linear-gradient(transparent,rgba(255,255,255,.85));padding:28px 14px 12px;width:100%}
.rlp-scene.has-img{display:block}
.rlp-scene.has-img img{width:100%;height:100%;object-fit:cover;display:block}

/* §2 balance — the at-a-glance shape only */
.rlp-star{color:var(--accent);margin-right:7px;font-size:13px}

/* §3 compass */
/* The values list. Deliberately the same row-and-open grammar as Connections:
   two hand-made inventions became one pattern. It replaced a radial compass
   whose labels sat outside the ring and were cut off at both edges ("endence",
   "Making a differ") — a circle can't give a long label anywhere to go. */
.rlp-vlist{margin:0 0 8px}
.rlp-vrow{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:46px;padding:10px 14px;margin:0 0 7px;background:var(--bg);border:1px solid color-mix(in srgb, var(--ink) 10%, transparent);border-radius:var(--r-sm);font-family:var(--font-sans);font-size:var(--fs-body);font-weight:600;color:var(--ink);cursor:pointer;text-align:left;transition:background .18s ease,border-color .18s ease}
.rlp-vrow:hover{border-color:color-mix(in srgb, var(--ink) 35%, transparent)}
.rlp-vrow.sel{background:var(--brand-primary);border-color:var(--brand-primary);color:var(--brand-on-primary)}
.rlp-vrow:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.rlp-vrow-lbl{min-width:0}
.rlp-vopen{background:var(--warm-surface);border:1px solid var(--warm-line);border-radius:var(--r-md);padding:16px 18px;margin:0 0 7px}
.rlp-vmeaning{font-family:var(--font-serif);font-style:italic;font-size:var(--fs-title);line-height:1.5;color:var(--ink);margin:0}
.rlp-vnote{font-size:var(--fs-sm);color:var(--text-muted);margin:12px 0 0}
.rlp-vfacets{display:flex;flex-direction:column;gap:8px;margin:14px 0 0;padding-top:12px;border-top:1px solid var(--warm-line)}
.rlp-vfacets div{display:grid;grid-template-columns:112px minmax(0,1fr);gap:12px;align-items:baseline}
.rlp-vfacets dt{font-size:var(--fs-eyebrow);text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:var(--text-muted)}
.rlp-vfacets dd{margin:0;font-size:var(--fs-sm);color:var(--text);line-height:1.45}
/* Tab 6 — Vita's read. Cream, because Vita is speaking (the member's own voice
   in "still working out" stays on the plain surface, so the two never blur). */
.rlp-vitaread{background:var(--warm-surface);border:1px solid var(--warm-line);border-radius:var(--r-lg);padding:26px 28px}
.rlp-vitaread-head{display:flex;align-items:center;gap:12px;margin-bottom:22px}
.rlp-read{padding-top:18px;margin-top:18px;border-top:1px solid var(--warm-line)}
.rlp-read:first-of-type{padding-top:0;margin-top:0;border-top:none}
.rlp-read h3{font-family:var(--font-sans);font-size:var(--fs-eyebrow);text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:var(--text-muted);margin:0 0 10px}
.rlp-read p{font-size:var(--fs-sm);line-height:var(--lh-body);color:var(--text);margin:0}
.rlp-read-callout{font-family:var(--font-serif);font-size:var(--fs-title)!important;line-height:1.3;color:var(--ink)!important;margin:0 0 8px!important}

/* The band: a marker between two poles. No score, no badge, no mid-point ticks. */
.rlp-balband{margin:0 0 14px;max-width:420px}
.rlp-balband-track{position:relative;height:6px;border-radius:var(--r-pill);background:linear-gradient(90deg, color-mix(in srgb, var(--brand-primary) 30%, transparent), color-mix(in srgb, var(--border-strong) 70%, transparent))}
.rlp-balband-marker{position:absolute;top:50%;width:22px;height:22px;border-radius:50%;background:var(--brand-primary);border:3px solid var(--warm-surface);box-shadow:0 0 0 1px color-mix(in srgb, var(--ink) 14%, transparent);transform:translate(-50%,-50%)}
.rlp-balband-labels{display:flex;justify-content:space-between;margin-top:8px;font-size:var(--fs-eyebrow);color:var(--text-muted);font-weight:600}

@media(max-width:600px){
  .rlp-vfacets div{grid-template-columns:1fr;gap:2px}
}
.rlp-vtag{font-size:var(--fs-eyebrow);text-transform:uppercase;letter-spacing:.08em;font-weight:700;padding:3px 9px;border-radius:var(--r-pill)}
.rlp-vtag.firm{background:var(--success-surface);color:var(--success-text);border:1px solid var(--success-line)}
.rlp-vtag.flex{background:var(--info-surface);color:var(--info-text);border:1px solid var(--info-line)}

.rlp-buckets{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin:28px 0 0}
.rlp-buckets h3,.rlp-principles h3,.rlp-strengths h3,.rlp-fy-lane h4,.rlp-fy-work h4,.rlp-enduring h3{font-family:var(--font-sans);font-size:var(--fs-sm);text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);font-weight:700;margin:0 0 10px}
.rlp-chips,.rlp-enduring-chips{display:flex;flex-wrap:wrap;gap:8px}
/* A pill is one unit: it never shrinks below its text and never wraps mid-label —
   long labels keep the pill whole and move it to the next row. */
.rlp-chip{font-size:var(--fs-sm);background:var(--muted-surface);color:var(--text);border-radius:var(--r-md);padding:6px 12px;font-weight:500;display:inline-flex;align-items:center;white-space:normal;overflow-wrap:anywhere;flex:0 1 auto;max-width:100%}
.rlp-chip.firm{background:var(--success-surface);color:var(--success-text)}
.rlp-chip.flex{background:var(--info-surface);color:var(--info-text)}
.rlp-chip.fixed{background:var(--muted-surface);color:var(--ink);border-left:3px solid var(--accent);font-weight:600}
.rlp-principles{margin:28px 0 0}
.rlp-principles ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px}
.rlp-principles li{font-family:var(--font-serif);font-size:var(--fs-title);color:var(--ink);padding-left:18px;border-left:2px solid var(--accent);line-height:1.4}

/* §4 seasons */
.rlp-seasons-track{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.rlp-season{position:relative;background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);padding:16px}
.rlp-season-head{display:flex;gap:9px;align-items:flex-start;margin-bottom:12px}
.rlp-season-dot{width:11px;height:11px;border-radius:50%;background:var(--brand-primary);margin-top:5px;flex:none}
.rlp-season-head h3{font-family:var(--font-serif);font-size:var(--fs-title);color:var(--ink);margin:0}
.rlp-season-hint{font-size:var(--fs-eyebrow);color:var(--text-faint);margin:1px 0 0}
.rlp-season-items{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px}
.rlp-season-items li{font-size:var(--fs-sm);color:var(--text);padding:5px 9px;background:var(--bg-alt);border-radius:var(--r-sm)}
.rlp-season-open{font-size:var(--fs-sm);font-style:italic;color:var(--text-muted);margin:0}
.rlp-season-empty{color:var(--text-faint);background:none!important}
.rlp-season-arrow{position:absolute;right:-7px;top:24px;color:var(--text-faint);z-index:1;font-size:14px}
.rlp-enduring{margin-top:14px;background:var(--warm-surface);border:1px solid var(--warm-line);border-radius:var(--r-md);padding:16px}

/* §5 goals */
.rlp-goal{background:var(--bg);border:1px solid var(--border);border-left:3px solid var(--a-fg);border-radius:var(--r-md);margin-bottom:9px;overflow:hidden}
.rlp-goal.open{box-shadow:var(--shadow-sm)}
.rlp-goal-top{display:flex;align-items:center;gap:12px;width:100%;background:none;border:none;cursor:pointer;font-family:inherit;text-align:left;padding:14px 16px}
.rlp-strengths-read{font-family:var(--font-serif);font-size:var(--fs-title);line-height:1.55;color:var(--ink);margin:0 0 16px;max-width:60ch}
.rlp-goal-area{font-family:var(--font-sans);font-size:var(--fs-eyebrow);letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:var(--a-fg);margin:0 0 10px}
.rlp-goal-rank{flex:none;width:24px;height:24px;border-radius:50%;background:var(--a-base);color:var(--a-fg);display:grid;place-items:center;font-size:13px;font-weight:700}
.rlp-goal-label{flex:1;font-size:var(--fs-body);font-weight:600;color:var(--ink)}
.rlp-goal-meta{display:flex;align-items:center;gap:12px;flex:none}
.rlp-goal-season{font-size:var(--fs-eyebrow);color:var(--text-muted);background:var(--bg-alt);padding:3px 9px;border-radius:var(--r-pill);font-weight:600}
.rlp-goal-toggle{font-size:18px;color:var(--text-faint);width:16px;text-align:center}
.rlp-goal-body{padding:0 16px 16px 52px;display:flex;flex-direction:column;gap:8px}
.rlp-goal-why{font-family:var(--font-serif);font-style:italic;font-size:var(--fs-title);color:var(--text);margin:0 0 4px}
.rlp-goal-body p{margin:0;font-size:var(--fs-body)}
.rlp-k{display:inline-block;font-size:var(--fs-eyebrow);text-transform:uppercase;letter-spacing:.06em;color:var(--text-faint);font-weight:700;margin-right:8px}

/* §6 paths */
/* The route now sits INSIDE its goal, so it reads as a second lens on the same
   thing rather than a card of its own — a hairline and a label, no border box. */
.rlp-path{margin-top:12px;padding-top:12px;border-top:1px solid var(--border)}
.rlp-path-head{font-size:var(--fs-eyebrow);text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:var(--text-muted);margin:0 0 10px}
.rlp-ladder{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:0}
.rlp-ladder li{display:flex;gap:12px;align-items:flex-start;padding:0 0 14px;position:relative}
.rlp-ladder li:not(:last-child)::before{content:"";position:absolute;left:9px;top:20px;bottom:0;width:2px;background:var(--border)}
.rlp-rung-mark{flex:none;width:20px;height:20px;border-radius:50%;border:2px solid var(--border-strong);background:var(--bg);display:grid;place-items:center;font-size:11px;color:var(--success);z-index:1}
.rlp-ladder li.done .rlp-rung-mark{background:var(--success-surface);border-color:var(--success-line)}
.rlp-ladder li.done .rlp-rung-label{color:var(--text-muted)}
.rlp-rung-label{font-size:var(--fs-body);color:var(--ink);padding-top:1px}
.rlp-rung-when{color:var(--text-faint);font-size:var(--fs-sm)}
.rlp-be-support{display:flex;flex-direction:column;gap:8px}
.rlp-be-support p{margin:0;font-size:var(--fs-body)}
.rlp-lean{margin:12px 0 0;font-size:var(--fs-sm);color:var(--text-muted)}
.rlp-lean strong{color:var(--ink)}
.rlp-strengths{margin:22px 0 0}

/* §7 week */
.rlp-week-narrative{font-family:var(--font-serif);font-size:var(--fs-h2);color:var(--ink);line-height:1.6;margin:0 0 26px;max-width:60ch}
.rlp-structure{display:flex;align-items:center;gap:14px;margin:0 0 26px;font-size:var(--fs-sm);color:var(--text-muted);font-weight:600}
.rlp-structure-track{flex:1;height:6px;background:var(--muted-surface);border-radius:var(--r-pill);position:relative}
.rlp-structure-dot{position:absolute;top:50%;transform:translate(-50%,-50%);width:18px;height:18px;border-radius:50%;background:var(--brand-primary);border:3px solid var(--bg);box-shadow:var(--shadow-sm)}
.rlp-week-groups{display:grid;grid-template-columns:1fr 1fr;gap:28px}
.rlp-week-group h3{font-family:var(--font-sans);font-size:var(--fs-sm);text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);font-weight:700;margin:0 0 8px}
.rlp-week-group ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column}
/* Energising items are TINTED rather than dotted. The dot cost a whole 16px
   column on every row — including the rows that had no dot — to carry one bit of
   information, which is what made the two lists feel crowded. The tint carries
   the same bit using space the row already occupies. Rows become bands rather
   than rules, so the hairline goes too. */
.rlp-week-group li{display:flex;align-items:baseline;gap:0;padding:9px 12px;margin:0 0 3px;border-radius:var(--r-sm);background:transparent}
.rlp-week-group li.energy{background:color-mix(in srgb, var(--success) 12%, transparent)}
.rlp-week-act{flex:1;font-size:var(--fs-body);color:var(--ink);font-weight:600;padding-right:12px}
.rlp-week-ongoing{font-size:var(--fs-sm);font-weight:400;color:var(--text-faint)}
.rlp-week-freq{flex:none;font-size:var(--fs-sm);color:var(--text-muted);white-space:nowrap;text-align:right}
.rlp-week-swatch{width:14px;height:14px;border-radius:4px;background:color-mix(in srgb, var(--success) 12%, transparent);border:1px solid color-mix(in srgb, var(--success) 30%, transparent);display:inline-block;margin-right:8px;flex:none}
.rlp-week-legend{display:flex;align-items:center;font-size:var(--fs-sm);color:var(--text-muted);margin:16px 0 0}
.rlp-fineprint{font-size:var(--fs-sm);color:var(--text-faint);font-style:italic;margin:14px 0 0}

/* §8 leaving work */
.rlp-facts{display:flex;flex-wrap:wrap;gap:14px 28px;margin:0 0 20px;padding:0}
.rlp-facts div{display:flex;flex-direction:column;gap:2px}
.rlp-facts dt{font-size:var(--fs-eyebrow);text-transform:uppercase;letter-spacing:.1em;color:var(--text-faint);font-weight:700}
.rlp-facts dd{margin:0;font-size:var(--fs-body);color:var(--ink);font-weight:600}
.rlp-factors{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:0 0 20px}
.rlp-factor{display:flex;justify-content:space-between;align-items:center;background:var(--bg);border:1px solid var(--border);border-radius:var(--r-sm);padding:10px 14px}
.rlp-factor-label{font-size:var(--fs-sm);color:var(--text);font-weight:600}
.rlp-factor-level{font-size:var(--fs-eyebrow);text-transform:uppercase;letter-spacing:.06em;font-weight:700;padding:3px 9px;border-radius:var(--r-pill)}
.lvl-strong{background:var(--success-surface);color:var(--success-text)}
.lvl-building{background:var(--accent-surface);color:var(--accent-strong)}
.lvl-low{background:var(--muted-surface);color:var(--text-muted)}
.lvl-some{background:var(--info-surface);color:var(--info-text)}
.lvl-lots{background:var(--info-surface);color:var(--info-text)}
.lvl-none{background:var(--muted-surface);color:var(--text-muted)}
.rlp-finance{background:var(--warm-surface);border:1px solid var(--warm-line);border-radius:var(--r-md);padding:16px 18px}
.rlp-finance p{margin:0;font-size:var(--fs-body);color:var(--text)}
.rlp-orientation{font-style:italic;color:var(--text)}
.rlp-reset{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:0 0 20px}
.rlp-reset-col{background:var(--warm-surface);border:1px solid var(--warm-line);border-radius:var(--r-md);padding:16px 18px}
.rlp-reset-head{font-family:var(--font-serif);font-size:var(--fs-section);font-weight:600;color:var(--ink);margin:0 0 4px}
.rlp-reset-sub{font-family:var(--font-sans);font-size:var(--fs-sm);color:var(--text-muted);margin:0 0 10px}
.rlp-reset-list{margin:0;padding:0 0 0 18px;font-size:var(--fs-body);color:var(--text);line-height:var(--lh-body)}
.rlp-reset-list li{margin:0 0 6px}
.rlp-worth-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
.rlp-worth-list li{margin:0;padding:14px 16px;background:var(--warm-surface);border-radius:var(--r-md);font-size:var(--fs-body);color:var(--text);line-height:var(--lh-body)}
.rlp-worth-lead{font-weight:600;color:var(--ink)}
.rlp-candidates{border-top:1px solid var(--border);padding-top:16px}
.rlp-candidate-tag{color:var(--text-muted);font-size:var(--fs-sm)}
@media (max-width:620px){.rlp-reset{grid-template-columns:1fr}}
/* Tighter side padding on very narrow phones so content isn't over-squeezed. */
@media (max-width:380px){.rlp-plan{padding-left:16px;padding-right:16px}}

/* §9 first year */
.rlp-narrative{font-family:var(--font-serif);font-size:var(--fs-h2);line-height:1.6;color:var(--ink);margin:0 0 30px;max-width:62ch}
.rlp-fy-track{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}
.rlp-fy-phase{background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);padding:14px}
.rlp-fy-phase h3{font-family:var(--font-serif);font-size:var(--fs-section);color:var(--ink);margin:0 0 10px}
.rlp-fy-phase .rlp-scene{margin-bottom:12px}
.rlp-fy-phase ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:7px}
.rlp-fy-phase li{font-size:var(--fs-sm);color:var(--text);display:flex;flex-wrap:wrap;align-items:baseline;gap:6px}
.rlp-fy-phase li.top{font-weight:600;color:var(--ink)}
.rlp-fy-kind{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-faint);font-weight:700;margin-left:auto}
.rlp-fy-lane,.rlp-fy-work{margin-top:16px;background:var(--bg-alt);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px}
.rlp-work-list{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:7px}
.rlp-work-list li{font-size:var(--fs-body);color:var(--ink);font-weight:600;background:var(--surface);border:1px solid var(--border-strong);border-left:3px solid var(--accent);border-radius:var(--r-sm);padding:9px 13px}

/* §10 first steps */
.rlp-firststeps{text-align:center;background:var(--color-brand-primary);color:var(--brand-on-primary);border-radius:var(--r-lg);padding:48px 28px;margin-top:56px}
.rlp-firststeps .rlp-eyebrow{color:rgba(255,255,255,.7)}
.rlp-firststeps-title{font-family:var(--font-serif);font-size:var(--fs-display);font-weight:600;margin:0 0 14px}
.rlp-firststeps .rlp-lede{color:rgba(255,255,255,.85);margin:0 auto 26px;max-width:46ch}
.rlp-begin{display:inline-block;background:var(--brand-band);color:var(--brand-on-band);font-weight:700;font-size:var(--fs-body);padding:13px 28px;border-radius:var(--r-pill);text-decoration:none}
.rlp-begin:hover{filter:brightness(.96)}

/* See how it all connects — the web. Stacked (visual on top, detail below) so
   the node labels, which render outside the SVG box, never collide with the
   detail panel. The SVG is capped and centred, leaving side margin for labels. */
/* The web: a calm vertical list; connections drawn only for the selected node.
   One column is already the phone layout, so nothing collapses and labels keep the
   full width — which is why they no longer need truncating. */
.rlp-web{display:block}
.rlp-web-print .rlp-web-group{margin:0 0 18px}
.rlp-web-pnode{margin:0 0 12px;padding:0 0 0 14px;border-left:2px solid color-mix(in srgb, var(--ink) 18%, transparent)}
.rlp-web-pnode h4{font-family:var(--font-sans);font-size:var(--fs-body);font-weight:700;color:var(--ink);margin:0 0 4px}
.rlp-web-pnode ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:4px}
.rlp-web-pnode li{font-size:var(--fs-sm);color:var(--text);line-height:1.5}
.rlp-web-pnode strong{color:var(--ink)}
.rlp-web-stack{position:relative;margin:0 0 18px}
.rlp-web-arcs{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}
.rlp-web-group{margin:0 0 14px}
.rlp-web-grouphead{margin:0 0 8px 58px;font-family:var(--font-sans);font-size:var(--fs-eyebrow);font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-muted)}
.rlp-web-line{display:flex;align-items:center;margin:0 0 7px}
.rlp-web-dot{flex:0 0 auto;width:8px;height:8px;margin:0 24px 0 26px;border-radius:50%;background:color-mix(in srgb, var(--ink) 22%, transparent);transition:background .18s ease}
.rlp-web-dot.lit{background:var(--ink)}
.rlp-web-row{flex:1 1 auto;min-width:0;min-height:44px;display:flex;align-items:center;text-align:left;padding:9px 14px;box-sizing:border-box;background:var(--bg);border:1px solid color-mix(in srgb, var(--ink) 10%, transparent);border-radius:var(--r-sm);font-family:var(--font-sans);font-size:var(--fs-sm);font-weight:500;color:var(--ink);cursor:pointer;transition:opacity .18s ease,background .18s ease,border-color .18s ease}
.rlp-web-row:hover{border-color:color-mix(in srgb, var(--ink) 35%, transparent)}
.rlp-web-row.sel{background:var(--ink);border-color:var(--ink);color:#fff;font-weight:600}
.rlp-web-row.dim{opacity:.4}
.rlp-web-row:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.rlp-web-links{list-style:none;margin:0 0 14px 58px;padding:14px 16px;display:flex;flex-direction:column;gap:8px;background:var(--warm-surface);border:1px solid var(--warm-line);border-radius:var(--r-md)}
.rlp-web-links li{font-size:var(--fs-sm);color:var(--text);line-height:1.55}
.rlp-web-links strong{color:var(--ink)}

/* §10 open threads */
.rlp-threads{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px}
.rlp-threads li{font-family:var(--font-serif);font-size:var(--fs-title);color:var(--ink);line-height:1.45;padding-left:18px;position:relative}
.rlp-threads li::before{content:"○";position:absolute;left:0;color:var(--accent);font-size:13px}

@media (max-width:680px){
  .rlp-buckets,.rlp-factors,.rlp-week-groups{grid-template-columns:1fr}
  .rlp-seasons-track,.rlp-fy-track{grid-template-columns:1fr}
  /* On a phone the head has no room for a text column beside the graphic, so the
     text takes the full width and the graphic drops to a hint in the corner. */
  .rlp-head{padding:24px 20px}
  .rlp-head-body{max-width:100%}
  .rlp-head-gfx{height:150%;left:100%;top:92%}
  /* Let the five areas wrap instead of cramming 5-across on a phone: they stay
     5 in a row where it fits (down to ~500px) and wrap to 3+ below that. */
      .rlp-season-arrow{display:none}
  .rlp-chapter-title{font-size:34px}
}

/* PRINT / SAVE AS PDF.
   The keepsake is this document printed, not a second renderer. The printing
   flag (see the component) unfolds every tab and opens every expandable; this
   block turns the result into pages. Written against a real printed PDF, not
   from first principles — every rule here is fixing something that went wrong on
   paper. */
@page{size:A4;margin:16mm 14mm}

@media print{
  /* 1. The app is not part of the keepsake. The header, the mobile bar and the
     feedback launcher were all printing — the first page opened with a
     "Dashboard / Menu" nav bar. */
  .rlp-band,.rlp-appbar,.fb-launch{display:none!important}
  /* Anything that only answers to a finger. */
  .rlp-seedbar,.rlp-head-actions,.rlp-head-lede,
  .rlp-intro-tones,.rlp-goal-toggle,.rlp-helper,
  .rlp-tabs .rlp-tablist{display:none!important}
  /* "First steps" is a call to action for the app — the next stage is something
     you do here, not something you read on paper. The whole card goes, not just
     its button; a printed plan ends on the member's own open threads. */
  .rlp-firststeps{display:none!important}

  /* This is "Save as PDF", not a memo on office paper: the colour IS the plan —
     the cover field, the area colours, the energy tint, the value tags. Browsers
     drop backgrounds by default, so ask for them. */
  .rlp-plan{max-width:none;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .rlp-plan *{-webkit-print-color-adjust:exact;print-color-adjust:exact}

  /* 2. THE COVER. The head was breaking across pages — cream ran to the foot of
     page 1 and "Next review" landed alone on page 2. It is now one unbreakable
     cover that owns its page, with the brand graphic back (it was hidden, which
     left a big empty cream rectangle and nothing else). */
  .rlp-head{
    break-inside:avoid;break-after:page;
    margin:0;padding:46px 40px;border-radius:0;
    min-height:262mm;
  }
  /* The on-screen head is a wide band; a cover is portrait, so the crop that
     works there does not translate. Text keeps the top, the graphic takes the
     lower-right quadrant and can't reach the title or the dates. */
  .rlp-head-gfx{display:block;height:78%;left:88%;top:76%}
  .rlp-head-body{max-width:74%}
  .rlp-plan-title{font-size:46px;max-width:none}
  .rlp-meta{gap:14px 30px}

  /* 3. Sections must be free to run past a page boundary. break-inside:avoid on
     .rlp-section was the cause of every huge white gap: a section that didn't fit
     in what was left of the page jumped to a fresh one. Only SMALL units — the
     things that look broken when split — get held together. */
  .rlp-section{margin:0 0 26px;padding-top:0;break-inside:auto}
  .rlp-section + .rlp-section{padding-top:22px}
  .rlp-goal,.rlp-vopen,.rlp-web-pnode,.rlp-fy-phase,.rlp-read,
  .rlp-season,.rlp-reset-col,.rlp-facts > div,.rlp-factor{break-inside:avoid}
  /* Whole blocks that must never be cut in half. A section can run over a page
     boundary, but the little grids and lists inside one cannot: split, they
     stranded fragments at the top of the next page with no heading — two lone
     decision rules, four readiness chips — that read as if they belonged to
     nothing. MEASURED before adding: every block here is a few hundred px at
     most, so holding it together moves it down a page rather than leaving half a
     page empty. Deliberately NOT here: .rlp-strengths (~390px and grows), the
     first-year track (~475px) and Vita's read (~1040px) — too tall to hold, and
     they split cleanly anyway. */
  .rlp-principles,.rlp-factors,.rlp-facts,.rlp-finance,.rlp-week-groups,
  .rlp-structure,.rlp-seasons-track,.rlp-balband,.rlp-threads,
  .rlp-fy-lane,.rlp-fy-work,.rlp-buckets,.rlp-reset,.rlp-candidates{break-inside:avoid}
  /* Never split a heading from what it heads, or a value row from its panel. */
  .rlp-sec-head,.rlp-chapter-title,.rlp-vrow,.rlp-goal-top,
  .rlp-web-grouphead,.rlp-read h3,.rlp-lede{break-after:avoid}
  h1,h2,h3,h4{break-after:avoid}
  p,li{orphans:2;widows:2}

  /* 4. The self-intro is a textarea on screen. A textarea prints one clipped line
     and its scrollbar, so the component renders prose instead when unfolded —
     this only tidies what's left. */
  .rlp-intro-text{border:none;background:transparent;padding:0}

  /* 5. Four first-year phases came out 3-up then 1 orphaned on the next row. */
  .rlp-fy-track{grid-template-columns:1fr 1fr;gap:14px}
  .rlp-seasons-track{grid-template-columns:1fr 1fr 1fr}

  /* Selected / dimmed states are interaction feedback, not meaning. */
  .rlp-vrow.sel{background:transparent;color:var(--ink);border-color:color-mix(in srgb, var(--ink) 20%, transparent)}
  .rlp-vrow.sel .rlp-vtag{background:color-mix(in srgb, var(--chorus-green) 14%, transparent);color:var(--chorus-green)}
  .rlp-web-row.dim,.rlp-web-dot{opacity:1}
  a[href]:after{content:""}
}
`;
