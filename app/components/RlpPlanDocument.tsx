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

import { useState } from "react";
import type {
  RlpPlan,
  PlanArea,
  PlanGoal,
  PlanPath,
  PlanScene,
} from "@/lib/rlpPlan";
import { seasonLabel43 } from "@/lib/rlpPlan";
import type { ConnectionsGraph } from "@/lib/planIntro";
import type { BalancedAreaId } from "@/lib/modules";
import { HelperLine } from "./InteractionShell";

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

function SectionHead({
  index,
  eyebrow,
  title,
}: {
  index: number;
  eyebrow: string;
  title: string;
}) {
  return (
    <header className="rlp-sec-head">
      <span className="rlp-sec-no">{index > 0 ? String(index).padStart(2, "0") : "✦"}</span>
      <div>
        <p className="rlp-eyebrow">{eyebrow}</p>
        <h2 className="rlp-sec-title">{title}</h2>
      </div>
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
}: {
  selfIntro: string;
  savedSelfIntro?: string | null;
  onSave?: (text: string) => void;
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

// ---- §2 the balanced retirement (the at-a-glance SHAPE only) ----
// A balance picture of the five areas and their relative fullness, plus one
// synthesis sentence naming the shape. The goals themselves live in §5 and are
// deliberately NOT repeated here.

function BalanceOverview({ areas, shape }: { areas: PlanArea[]; shape: string }) {
  const max = Math.max(1, ...areas.map((a) => a.goals.length));

  return (
    <div className="rlp-balance">
      <div className="rlp-balance-row" aria-label="The five areas of a balanced retirement">
        {areas.map((a) => {
          const theme = AREA_THEME[a.id];
          const fullness = a.goals.length / max;
          const heightPct = a.deliberateGap ? 8 : a.goals.length === 0 ? 6 : Math.max(20, fullness * 100);
          return (
            <div
              key={a.id}
              className="rlp-area-tile"
              style={{
                ["--a-sel" as string]: theme.sel,
                ["--a-fg" as string]: theme.fg,
              }}
            >
              <span className="rlp-area-fill" aria-hidden="true">
                <span className="rlp-area-fill-bar" style={{ height: `${heightPct}%` }} />
              </span>
              <span className="rlp-area-label">{a.label}</span>
              <span className="rlp-area-count">
                {a.deliberateGap ? "deliberately quiet" : a.goals.length === 0 ? "open" : `${a.goals.length}`}
              </span>
            </div>
          );
        })}
      </div>
      {shape && <p className="rlp-balance-shape">{shape}</p>}
    </div>
  );
}

// ---- §3 values compass ----

function ValuesCompass({
  values,
  buckets,
}: {
  values: {
    value: string;
    meaning?: string;
    confidence?: string;
    threat?: string;
    protectors?: string[];
  }[];
  buckets: { nonNegotiable: string[]; flexible: string[] };
}) {
  const [sel, setSel] = useState(0);
  const n = values.length;
  if (n === 0) return null;

  const cx = 150;
  const cy = 150;
  const r = 104;
  const nodes = values.map((v, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    return {
      ...v,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      i,
    };
  });

  const active = values[sel];
  const bucketOf = (name: string) =>
    buckets.nonNegotiable.includes(name)
      ? "Non-negotiable"
      : buckets.flexible.includes(name)
        ? "Flexible"
        : null;

  return (
    <div className="rlp-compass-wrap">
      <svg viewBox="0 0 300 300" className="rlp-compass" role="img" aria-label="My values">
        <circle cx={cx} cy={cy} r={r} className="rlp-compass-ring" />
        {nodes.map((nd) => (
          <g
            key={`l${nd.i}`}
            onClick={() => setSel(nd.i)}
            className="rlp-compass-spoke-hit"
          >
            <line
              x1={cx}
              y1={cy}
              x2={nd.x}
              y2={nd.y}
              className={`rlp-compass-spoke${nd.i === sel ? " on" : ""}`}
            />
            {/* Invisible thick line widens the spoke's clickable area. */}
            <line
              x1={cx}
              y1={cy}
              x2={nd.x}
              y2={nd.y}
              stroke="transparent"
              strokeWidth={16}
            />
          </g>
        ))}
        {nodes.map((nd) => (
          <g key={`n${nd.i}`} onClick={() => setSel(nd.i)} className="rlp-compass-node">
            {/* Invisible larger circle widens the dot's clickable target. */}
            <circle cx={nd.x} cy={nd.y} r={22} fill="transparent" stroke="none" />
            <circle cx={nd.x} cy={nd.y} r={nd.i === sel ? 9 : 6} className={nd.i === sel ? "on" : ""} />
            <text
              x={nd.x}
              y={nd.y < cy ? nd.y - 14 : nd.y + 22}
              textAnchor={Math.abs(nd.x - cx) < 12 ? "middle" : nd.x < cx ? "end" : "start"}
              className={`rlp-compass-text${nd.i === sel ? " on" : ""}`}
            >
              {nd.value}
            </text>
          </g>
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" className="rlp-compass-center-lbl">
          What guides
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="rlp-compass-center-lbl">
          your choices
        </text>
      </svg>

      <div className="rlp-compass-detail" aria-live="polite">
        <div className="rlp-compass-detail-head">
          <h3>{active.value}</h3>
          {bucketOf(active.value) && (
            <span className={`rlp-vtag ${bucketOf(active.value) === "Non-negotiable" ? "firm" : "flex"}`}>
              {bucketOf(active.value)}
            </span>
          )}
        </div>
        {active.meaning && <p className="rlp-compass-meaning">&ldquo;{active.meaning}&rdquo;</p>}
        {active.threat && (
          <p className="rlp-compass-note">What puts it at risk: {active.threat}</p>
        )}
        {active.protectors && active.protectors.length > 0 && (
          <p className="rlp-compass-note">
            What protects it: {active.protectors.join(", ")}
          </p>
        )}
        {active.confidence === "still forming" && (
          <p className="rlp-compass-note">Still forming &mdash; settling as you go.</p>
        )}
      </div>
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

// ---- §5 goal cards (open to detail) ----

function GoalCard({ goal }: { goal: PlanGoal }) {
  const [open, setOpen] = useState(false);
  const theme = AREA_THEME[goal.area];
  const season = seasonLabel43(goal.season);

  return (
    <div
      className={`rlp-goal${open ? " open" : ""}`}
      style={{ ["--a-base" as string]: theme.base, ["--a-fg" as string]: theme.fg }}
    >
      <button className="rlp-goal-top" onClick={() => setOpen(!open)} aria-expanded={open}>
        {goal.rank && <span className="rlp-goal-rank">{goal.rank}</span>}
        <span className="rlp-goal-label">{goal.label}</span>
        <span className="rlp-goal-meta">
          {season && <span className="rlp-goal-season">{season}</span>}
          <span className="rlp-goal-toggle" aria-hidden="true">{open ? "–" : "+"}</span>
        </span>
      </button>
      {open && (
        <div className="rlp-goal-body">
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
        </div>
      )}
    </div>
  );
}

// ---- §6 paths ----

function PathBlock({ path }: { path: PlanPath }) {
  return (
    <div className="rlp-path">
      <h3>{path.goal}</h3>
      {path.track === "do" && path.milestones ? (
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
          <li key={i}>
            <span className="rlp-week-marker" aria-hidden="true">
              {a.energy && <span className="rlp-week-dot" />}
            </span>
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
// A calm, legible web of the REAL links between goals, values and people (built
// only from connections the member would recognise). Selecting a node shows what
// it connects to, and why, in the member's own terms.

const WEB_KIND_COLOR: Record<string, string> = {
  value: "var(--accent-strong)",
  goal: "var(--brand-primary)",
  person: "var(--success-text)",
};

function trunc(s: string, n = 22): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function ConnectionsWeb({ graph }: { graph: ConnectionsGraph }) {
  const [sel, setSel] = useState<string | null>(null);
  const { nodes, edges } = graph;
  const cx = 180;
  const cy = 180;
  const r = 116;

  const kindOrder: Record<string, number> = { value: 0, goal: 1, person: 2 };
  const ordered = [...nodes].sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind]);
  const total = ordered.length;
  const pos = new Map<string, { x: number; y: number }>();
  ordered.forEach((node, i) => {
    const angle = (i / total) * 2 * Math.PI - Math.PI / 2;
    pos.set(node.id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  });

  const touches = (id: string) => edges.filter((e) => e.from === id || e.to === id);
  const nodeActive = (id: string) =>
    !sel || id === sel || touches(sel).some((e) => e.from === id || e.to === id);
  const labelOf = (id: string) => nodes.find((nd) => nd.id === id)?.label ?? "";

  const details = sel
    ? touches(sel).map((e) => {
        const otherId = e.from === sel ? e.to : e.from;
        return { label: labelOf(otherId), why: e.why };
      })
    : [];

  return (
    <div className="rlp-web-wrap">
      <svg viewBox="0 0 360 360" className="rlp-web" role="img" aria-label="How my goals, values and people connect">
        {edges.map((e, i) => {
          const a = pos.get(e.from)!;
          const b = pos.get(e.to)!;
          const on = !sel || e.from === sel || e.to === sel;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={`rlp-web-edge${sel ? (on ? " on" : " dim") : ""}`}
            />
          );
        })}
        {ordered.map((node) => {
          const p = pos.get(node.id)!;
          const active = nodeActive(node.id);
          const anchor = Math.abs(p.x - cx) < 16 ? "middle" : p.x < cx ? "end" : "start";
          return (
            <g
              key={node.id}
              className={`rlp-web-node${sel && !active ? " dim" : ""}`}
              onClick={() => setSel(sel === node.id ? null : node.id)}
              style={{ cursor: "pointer" }}
            >
              <circle cx={p.x} cy={p.y} r={sel === node.id ? 9 : 6} style={{ fill: WEB_KIND_COLOR[node.kind] }} />
              <text
                x={p.x + (anchor === "end" ? -10 : anchor === "start" ? 10 : 0)}
                y={p.y < cy ? p.y - 11 : p.y + 18}
                textAnchor={anchor}
                className={`rlp-web-text${sel === node.id ? " sel" : ""}`}
              >
                {trunc(node.label)}
              </text>
            </g>
          );
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" className="rlp-web-center">How it all</text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="rlp-web-center">connects</text>
      </svg>

      <div className="rlp-web-detail">
        <div className="rlp-web-legend">
          <span style={{ color: "var(--accent-strong)" }}>&#9679; Values</span>
          <span style={{ color: "var(--brand-primary)" }}>&#9679; Goals</span>
          <span style={{ color: "var(--success-text)" }}>&#9679; People</span>
        </div>
        {sel ? (
          <>
            <h3>{labelOf(sel)}</h3>
            <ul className="rlp-web-links">
              {details.map((d, i) => (
                <li key={i}>
                  <strong>{d.label}</strong>
                  {d.why ? ` — ${d.why}` : ""}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="rlp-web-hint">
            The threads between your goals, the people who matter, and what you
            value.
          </p>
        )}
      </div>
    </div>
  );
}

// ---- the document ----

export default function RlpPlanDocument({
  plan,
  seeded,
  images = {},
  savedSelfIntro,
  onSaveSelfIntro,
}: {
  plan: RlpPlan;
  seeded: boolean;
  images?: Record<string, string>;
  savedSelfIntro?: string | null;
  onSaveSelfIntro?: (text: string) => void;
}) {
  const { meta, opening, balance, values, movingTowards, prioritisedAreas, paths, week, leavingWork, firstYear, connections, openThreads } = plan;
  // Retirement paths (Phase 5): all empty/null for working + flag-off. (The
  // "keep" items double as the week's anchors — rendered in the reset section.)
  // resetActions is the FRAMED "Worth picking up" (never the raw change items).
  const { orientation, reset, resetActions, windDownExit, onsetGentle } = plan;
  const heroScene = plan.scenes.find((s) => s.slot === "hero");
  const sceneFor = (id: string) => plan.scenes.find((s) => s.slot === id);

  const [downloading, setDownloading] = useState(false);
  async function downloadPdf() {
    setDownloading(true);
    try {
      const res = await fetch("/api/plan-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, images }),
      });
      if (!res.ok) throw new Error("pdf failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = meta.name
        ? `Retirement-Life-Plan-${meta.name.replace(/\s+/g, "-")}.pdf`
        : "Retirement-Life-Plan.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // last resort: the browser's own print-to-PDF
      window.print();
    } finally {
      setDownloading(false);
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

      <div className="rlp-toolbar">
        <button type="button" onClick={downloadPdf} disabled={downloading} className="rlp-download">
          {downloading ? "Preparing PDF…" : "Save as PDF"}
        </button>
      </div>

      {/* §1 — opening */}
      <section className="rlp-section rlp-opening">
        {heroScene && <SceneImage scene={heroScene} ratio="21 / 9" src={images.hero} />}
        <p className="rlp-eyebrow">Your Retirement Life Plan</p>
        <h1 className="rlp-chapter-title">{opening.chapterTitle}</h1>
        {orientation && <p className="rlp-overview rlp-orientation">{orientation}</p>}
        {opening.overview && <p className="rlp-overview">{opening.overview}</p>}
        {opening.insight && <p className="rlp-insight">{opening.insight}</p>}
        <SelfIntro
          key={opening.selfIntro}
          selfIntro={opening.selfIntro}
          savedSelfIntro={savedSelfIntro}
          onSave={onSaveSelfIntro}
        />
        <dl className="rlp-meta">
          {meta.name && (
            <div><dt>For</dt><dd>{meta.name}</dd></div>
          )}
          <div><dt>Created</dt><dd>{formatDate(meta.dateCreated)}</dd></div>
          <div><dt>Last reviewed</dt><dd>{formatDate(meta.dateLastReviewed)}</dd></div>
          <div><dt>Next review</dt><dd>{formatDate(meta.nextReviewDue)}</dd></div>
        </dl>
      </section>

      {/* §2 — balanced retirement */}
      <section className="rlp-section">
        <SectionHead index={2} eyebrow="The shape of it" title="Your balanced retirement" />
        <BalanceOverview areas={balance.areas} shape={balance.shape} />
      </section>

      {/* §3 — values */}
      <section className="rlp-section">
        <SectionHead index={3} eyebrow="Your compass" title="What matters most to you" />
        {values.coreValues.length > 0 && (
          <HelperLine>Tap each value to read what it means to you.</HelperLine>
        )}
        <ValuesCompass
          values={values.coreValues}
          buckets={{ nonNegotiable: values.nonNegotiables, flexible: values.flexible }}
        />
        {(values.nonNegotiables.length > 0 || values.flexible.length > 0) && (
          <div className="rlp-buckets">
            {values.nonNegotiables.length > 0 && (
              <div>
                <h3>What I&rsquo;ll hold firm on</h3>
                <div className="rlp-chips">
                  {values.nonNegotiables.map((v) => <span key={v} className="rlp-chip firm">{v}</span>)}
                </div>
              </div>
            )}
            {values.flexible.length > 0 && (
              <div>
                <h3>Where I can flex</h3>
                <div className="rlp-chips">
                  {values.flexible.map((v) => <span key={v} className="rlp-chip flex">{v}</span>)}
                </div>
              </div>
            )}
          </div>
        )}
        {values.principles.length > 0 && (
          <div className="rlp-principles">
            <h3>How I&rsquo;ll decide when things pull apart</h3>
            <ul>
              {values.principles.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        )}
      </section>

      {/* §4 — seasons */}
      <section className="rlp-section">
        <SectionHead index={4} eyebrow="The when" title="The retirement you're moving towards" />
        <p className="rlp-lede">
          {movingTowards.arc ||
            "Retirement isn’t one long chapter — it unfolds in seasons. Here is how your priorities shift over the years, and what you’d want to hold onto throughout."}
        </p>
        <SeasonsTimeline seasons={movingTowards.seasons} enduring={movingTowards.enduring} />
      </section>

      {/* §5 — most important goals */}
      <section className="rlp-section">
        <SectionHead index={5} eyebrow="The heart of it" title="Your most important goals" />
        <p className="rlp-lede">
          The handful whose absence would leave retirement feeling incomplete
          &mdash; grouped by the five areas, in the order they matter to you.
          Select any goal to open it.
        </p>
        {prioritisedAreas.map((area) => (
          <div key={area.id} className="rlp-goal-group">
            <h3
              className="rlp-goal-group-head"
              style={{ ["--a-fg" as string]: AREA_THEME[area.id].fg }}
            >
              {area.label}
            </h3>
            {area.goals.map((g, i) => <GoalCard key={i} goal={g} />)}
          </div>
        ))}
      </section>

      {/* See how it all connects — the signature web */}
      {connections && (
        <section className="rlp-section">
          <SectionHead index={0} eyebrow="The web of it" title="See how it all connects" />
          <HelperLine>Tap any point to see what it connects to.</HelperLine>
          <ConnectionsWeb graph={connections} />
        </section>
      )}

      {/* §6 — the path */}
      <section className="rlp-section">
        <SectionHead index={6} eyebrow="The route" title="The path to your goals" />
        <p className="rlp-lede">
          For each goal, a few stepping stones &mdash; with much of the way
          already behind you. The precise first steps come in Act.
        </p>
        <div className="rlp-paths">
          {paths.paths.map((p, i) => <PathBlock key={i} path={p} />)}
        </div>
        {paths.strengths.length > 0 && (
          <div className="rlp-strengths">
            <h3>Strengths and resources to lean on</h3>
            <div className="rlp-chips">
              {paths.strengths.map((s) => <span key={s} className="rlp-chip">{s}</span>)}
            </div>
          </div>
        )}
      </section>

      {/* §7 — how my days feel */}
      {week && (
        <section className="rlp-section">
          <SectionHead index={7} eyebrow="The everyday" title="How you want your days to feel" />
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
                    <span className="rlp-week-marker" aria-hidden="true"><span className="rlp-week-dot" /></span>
                    gives you energy
                  </p>
                )}
              </>
            );
          })()}
          <p className="rlp-fineprint">The character of an ordinary week, lived for years &mdash; not a timetable.</p>
        </section>
      )}

      {/* §8 — retired: the reset (carrying forward / reshaping / letting go) */}
      {reset && (
        <section className="rlp-section">
          <SectionHead index={8} eyebrow="The reset" title="Carrying forward, reshaping, letting go" />
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
          {resetActions.length > 0 && (
            <div className="rlp-candidates">
              <h3 className="rlp-reset-head">Worth picking up</h3>
              <p className="rlp-reset-sub">A few ways to act on what you&rsquo;d reshape — small, concrete first moves.</p>
              <ul className="rlp-reset-list">
                {resetActions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* §8 — winding-down, decided: the settled exit (from the wind_down_exit fact) */}
      {windDownExit && (
        <section className="rlp-section">
          <SectionHead index={8} eyebrow="The threshold" title="Leaving work" />
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

      {/* §8 — working + winding-undecided: leaving work (from the 4.1 readiness build) */}
      {leavingWork && (
        <section className="rlp-section">
          <SectionHead index={8} eyebrow="The threshold" title="Leaving work" />
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

      {/* §9 — first year */}
      {firstYear && (
        <section className="rlp-section rlp-firstyear">
          <SectionHead index={9} eyebrow="Arriving" title="Your first year" />
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

      {/* §10 — open threads (things still in motion) */}
      {openThreads.length > 0 && (
        <section className="rlp-section">
          <SectionHead index={10} eyebrow="Still in motion" title="What you're still working out" />
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

      {/* §11 — first steps */}
      <section className="rlp-section rlp-firststeps">
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
.rlp-toolbar{display:flex;justify-content:flex-end;margin:8px 0 4px}
.rlp-download{font-family:var(--font-sans);font-size:var(--fs-sm);font-weight:600;color:var(--brand-primary);background:none;border:1px solid var(--border-strong);border-radius:var(--r-pill);padding:7px 16px;cursor:pointer}
.rlp-download:hover{background:var(--brand-primary-tint)}

.rlp-section{margin:48px 0;padding-top:8px}
.rlp-eyebrow{font-size:var(--fs-eyebrow);letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);font-weight:600;margin:0 0 6px}
.rlp-lede{font-size:var(--fs-body);color:var(--text-muted);max-width:60ch;margin:0 0 22px}

.rlp-sec-head{display:flex;gap:16px;align-items:baseline;margin:0 0 22px;border-top:1px solid var(--border);padding-top:22px}
.rlp-sec-no{font-family:var(--font-serif);font-size:var(--fs-h2);color:var(--text-faint);font-weight:500;font-variant-numeric:tabular-nums}
.rlp-sec-title{font-family:var(--font-serif);font-size:var(--fs-display);font-weight:600;color:var(--ink);margin:0;line-height:1.15;letter-spacing:-.01em}

/* opening */
.rlp-opening{margin-top:8px}
.rlp-chapter-title{font-family:var(--font-serif);font-size:44px;line-height:1.1;font-weight:600;color:var(--ink);letter-spacing:-.02em;margin:0 0 24px;max-width:18ch}
.rlp-intro{margin:0 0 28px}
.rlp-intro-frame{font-size:var(--fs-body);color:var(--text-muted);max-width:58ch;margin:0 0 12px}
.rlp-intro-text{width:100%;background:var(--warm-surface);border:1px solid var(--warm-line);border-radius:var(--r-md);padding:16px 18px;resize:none;font-family:var(--font-serif);font-size:var(--fs-title);line-height:1.5;color:var(--ink);overflow:hidden}
.rlp-intro-text:focus{outline:none;box-shadow:var(--focus-ring);border-color:var(--brand-primary)}
.rlp-intro-tones{display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap}
.rlp-intro-tones-lbl{font-size:var(--fs-sm);color:var(--text-muted);margin-right:2px}
.rlp-intro-tones button{font-family:var(--font-sans);font-size:var(--fs-sm);font-weight:600;color:var(--brand-primary);background:none;border:1px solid var(--border-strong);border-radius:var(--r-pill);padding:5px 14px;cursor:pointer}
.rlp-intro-tones button:hover:not(:disabled){background:var(--brand-primary-tint)}
.rlp-intro-tones button:disabled{opacity:.5;cursor:default}
.rlp-intro-busy{font-size:var(--fs-sm);font-style:italic;color:var(--text-faint)}
.rlp-insight{font-family:var(--font-serif);font-style:italic;font-size:var(--fs-title);line-height:1.5;color:var(--accent-strong);margin:0 0 22px;padding-left:16px;border-left:2px solid var(--accent);max-width:58ch}

.rlp-meta{display:flex;flex-wrap:wrap;gap:20px 36px;margin:8px 0 0;padding-top:18px;border-top:1px solid var(--border)}
.rlp-meta div{display:flex;flex-direction:column;gap:2px}
.rlp-meta dt{font-size:var(--fs-eyebrow);text-transform:uppercase;letter-spacing:.1em;color:var(--text-faint);font-weight:700}
.rlp-meta dd{margin:0;font-size:var(--fs-sm);color:var(--text);font-weight:600}

/* scene placeholders */
.rlp-scene{position:relative;width:100%;margin:0 0 24px;border-radius:var(--r-lg);overflow:hidden;background:linear-gradient(135deg,var(--ill-sky-pale),var(--ill-lavender) 60%,var(--warm-surface));border:1px solid var(--warm-line);display:flex;align-items:flex-end}
.rlp-scene-mark{position:absolute;top:10px;left:12px;font-size:var(--fs-eyebrow);text-transform:uppercase;letter-spacing:.1em;font-weight:700;color:var(--ink);opacity:.55;background:rgba(255,255,255,.6);padding:3px 8px;border-radius:var(--r-pill)}
.rlp-scene figcaption{font-size:var(--fs-sm);font-style:italic;color:var(--ink);background:linear-gradient(transparent,rgba(255,255,255,.85));padding:28px 14px 12px;width:100%}
.rlp-scene.has-img{display:block}
.rlp-scene.has-img img{width:100%;height:100%;object-fit:cover;display:block}

/* §2 balance — the at-a-glance shape only */
.rlp-balance-row{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;align-items:end}
.rlp-area-tile{display:flex;flex-direction:column;align-items:center;gap:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 6px 12px;min-height:160px;justify-content:flex-end}
.rlp-area-fill{flex:1;width:24px;display:flex;align-items:flex-end;background:var(--bg-alt);border-radius:var(--r-pill);overflow:hidden;min-height:70px}
.rlp-area-fill-bar{width:100%;background:var(--a-sel);border-radius:var(--r-pill)}
.rlp-area-label{font-size:var(--fs-sm);font-weight:700;color:var(--ink);text-align:center}
.rlp-area-count{font-size:var(--fs-eyebrow);color:var(--text-faint);font-weight:600;text-align:center}
.rlp-balance-shape{font-family:var(--font-serif);font-size:var(--fs-h2);line-height:1.5;color:var(--ink);margin:20px 0 0;max-width:60ch}
.rlp-star{color:var(--accent);margin-right:7px;font-size:13px}

/* §3 compass */
.rlp-compass-wrap{display:grid;grid-template-columns:minmax(0,300px) 1fr;gap:28px;align-items:center}
.rlp-compass{width:100%;max-width:300px;height:auto;aspect-ratio:1/1}
.rlp-compass-ring{fill:var(--warm-surface);stroke:var(--warm-line);stroke-width:1.5}
.rlp-compass-spoke{stroke:var(--border);stroke-width:1}
.rlp-compass-spoke.on{stroke:var(--brand-primary);stroke-width:1.5}
.rlp-compass-spoke-hit{cursor:pointer}
.rlp-compass-node{cursor:pointer}
.rlp-compass-node circle{fill:var(--surface);stroke:var(--brand-primary);stroke-width:1.5}
.rlp-compass-node circle.on{fill:var(--brand-primary)}
.rlp-compass-text{font-family:var(--font-sans);font-size:12.5px;fill:var(--text-muted);font-weight:600}
.rlp-compass-text.on{fill:var(--ink);font-weight:700}
.rlp-compass-center-lbl{font-family:var(--font-serif);font-size:13px;fill:var(--text-faint);font-style:italic}
.rlp-compass-detail{background:var(--warm-surface);border:1px solid var(--warm-line);border-radius:var(--r-md);padding:20px 22px;min-height:120px}
.rlp-compass-detail-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.rlp-compass-detail h3{font-family:var(--font-serif);font-size:var(--fs-h2);color:var(--ink);margin:0}
.rlp-compass-meaning{font-family:var(--font-serif);font-style:italic;font-size:var(--fs-title);color:var(--text);margin:12px 0 0;line-height:1.4}
.rlp-compass-note{font-size:var(--fs-sm);color:var(--text-muted);margin:10px 0 0}
.rlp-vtag{font-size:var(--fs-eyebrow);text-transform:uppercase;letter-spacing:.08em;font-weight:700;padding:3px 9px;border-radius:var(--r-pill)}
.rlp-vtag.firm{background:var(--success-surface);color:var(--success-text);border:1px solid var(--success-line)}
.rlp-vtag.flex{background:var(--info-surface);color:var(--info-text);border:1px solid var(--info-line)}

.rlp-buckets{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin:28px 0 0}
.rlp-buckets h3,.rlp-principles h3,.rlp-strengths h3,.rlp-fy-lane h4,.rlp-fy-work h4,.rlp-enduring h3{font-family:var(--font-sans);font-size:var(--fs-sm);text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);font-weight:700;margin:0 0 10px}
.rlp-chips,.rlp-enduring-chips{display:flex;flex-wrap:wrap;gap:8px}
/* A pill is one unit: it never shrinks below its text and never wraps mid-label —
   long labels keep the pill whole and move it to the next row. */
.rlp-chip{font-size:var(--fs-sm);background:var(--muted-surface);color:var(--text);border-radius:var(--r-pill);padding:5px 12px;font-weight:500;display:inline-flex;align-items:center;white-space:nowrap;flex:0 0 auto;max-width:100%}
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
.rlp-goal-group{margin:0 0 24px}
.rlp-goal-group-head{font-family:var(--font-sans);font-size:var(--fs-sm);text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:var(--a-fg);margin:0 0 10px}
.rlp-goal{background:var(--bg);border:1px solid var(--border);border-left:3px solid var(--a-fg);border-radius:var(--r-md);margin-bottom:9px;overflow:hidden}
.rlp-goal.open{box-shadow:var(--shadow-sm)}
.rlp-goal-top{display:flex;align-items:center;gap:12px;width:100%;background:none;border:none;cursor:pointer;font-family:inherit;text-align:left;padding:14px 16px}
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
.rlp-paths{display:flex;flex-direction:column;gap:18px}
.rlp-path{background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);padding:18px 20px}
.rlp-path h3{font-family:var(--font-serif);font-size:var(--fs-title);color:var(--ink);margin:0 0 14px}
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
.rlp-week-group li{display:flex;align-items:baseline;gap:0;padding:9px 0;border-bottom:1px solid var(--border)}
.rlp-week-marker{flex:none;width:16px;display:inline-flex;justify-content:center}
.rlp-week-dot{width:7px;height:7px;border-radius:50%;background:var(--success);display:inline-block;position:relative;top:-1px}
.rlp-week-act{flex:1;font-size:var(--fs-body);color:var(--ink);font-weight:600;padding-right:12px}
.rlp-week-ongoing{font-size:var(--fs-sm);font-weight:400;color:var(--text-faint)}
.rlp-week-freq{flex:none;font-size:var(--fs-sm);color:var(--text-muted);white-space:nowrap;text-align:right}
.rlp-week-legend{display:flex;align-items:center;font-size:var(--fs-sm);color:var(--text-muted);margin:14px 0 0}
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
.rlp-candidates{border-top:1px solid var(--border);padding-top:16px}
.rlp-candidate-tag{color:var(--text-muted);font-size:var(--fs-sm)}
@media (max-width:620px){.rlp-reset{grid-template-columns:1fr}}

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
.rlp-firststeps{text-align:center;background:var(--brand-primary);color:var(--brand-on-primary);border-radius:var(--r-lg);padding:48px 28px;margin-top:56px}
.rlp-firststeps .rlp-eyebrow{color:rgba(255,255,255,.7)}
.rlp-firststeps-title{font-family:var(--font-serif);font-size:var(--fs-display);font-weight:600;margin:0 0 14px}
.rlp-firststeps .rlp-lede{color:rgba(255,255,255,.85);margin:0 auto 26px;max-width:46ch}
.rlp-begin{display:inline-block;background:var(--brand-band);color:var(--brand-on-band);font-weight:700;font-size:var(--fs-body);padding:13px 28px;border-radius:var(--r-pill);text-decoration:none}
.rlp-begin:hover{filter:brightness(.96)}

/* See how it all connects — the web. Stacked (visual on top, detail below) so
   the node labels, which render outside the SVG box, never collide with the
   detail panel. The SVG is capped and centred, leaving side margin for labels. */
.rlp-web-wrap{display:block}
.rlp-web{display:block;margin:0 auto 20px;width:100%;max-width:420px;height:auto;aspect-ratio:1/1;overflow:visible}
.rlp-web-edge{stroke:var(--border-strong);stroke-width:1}
.rlp-web-edge.on{stroke:var(--brand-primary);stroke-width:1.75}
.rlp-web-edge.dim{stroke:var(--border);opacity:.35}
.rlp-web-node circle{stroke:var(--bg);stroke-width:2}
.rlp-web-node.dim{opacity:.3}
.rlp-web-text{font-family:var(--font-sans);font-size:11px;fill:var(--text);font-weight:600}
.rlp-web-text.sel{fill:var(--ink);font-weight:700}
.rlp-web-center{font-family:var(--font-serif);font-style:italic;font-size:13px;fill:var(--text-faint)}
.rlp-web-detail{background:var(--warm-surface);border:1px solid var(--warm-line);border-radius:var(--r-md);padding:18px 20px;min-height:140px}
.rlp-web-legend{display:flex;gap:16px;font-size:var(--fs-sm);font-weight:600;margin-bottom:12px}
.rlp-web-detail h3{font-family:var(--font-serif);font-size:var(--fs-h2);color:var(--ink);margin:0 0 8px}
.rlp-web-links{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px}
.rlp-web-links li{font-size:var(--fs-body);color:var(--text)}
.rlp-web-links strong{color:var(--ink)}
.rlp-web-hint{font-size:var(--fs-body);color:var(--text-muted);margin:0}

/* §10 open threads */
.rlp-threads{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px}
.rlp-threads li{font-family:var(--font-serif);font-size:var(--fs-title);color:var(--ink);line-height:1.45;padding-left:18px;position:relative}
.rlp-threads li::before{content:"○";position:absolute;left:0;color:var(--accent);font-size:13px}

@media (max-width:680px){
  .rlp-compass-wrap,.rlp-web-wrap{grid-template-columns:1fr}
  .rlp-compass,.rlp-web{margin:0 auto}
  .rlp-buckets,.rlp-factors,.rlp-week-groups{grid-template-columns:1fr}
  .rlp-seasons-track,.rlp-fy-track{grid-template-columns:1fr}
  .rlp-balance-row{grid-template-columns:repeat(5,1fr);gap:4px}
  .rlp-area-label{font-size:var(--fs-eyebrow)}
  .rlp-season-arrow{display:none}
  .rlp-chapter-title{font-size:34px}
}

@media print{
  .rlp-seedbar,.rlp-toolbar,.rlp-begin{display:none}
  .rlp-section{break-inside:avoid}
  .rlp-goal-body{display:flex!important}
  .rlp-plan{max-width:none}
}
`;
