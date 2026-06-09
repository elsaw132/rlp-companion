"use client";

// Presentation-only. The radial-wheel body of the Stage 2 (Explore) reveal:
// the six areas as equal donut segments (fixed order, first at top, clockwise),
// a cream centre hub that reads out the selected area, and an aria-live detail
// panel below showing that area's forward line and — where the selection logic
// fired one — its discovery stat with the source disclosure. It renders content
// only; all data, generation, stat selection and rotation stay in ExploreReveal.

import { useState } from "react";
import type { RevealArea } from "@/lib/stage2Reveal";

// --- area icons: simple stroke glyphs, coloured by the parent's currentColor ---
function AreaIcon({ area, size }: { area: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {area === "active" && (
        <>
          <circle cx="12" cy="4.5" r="2" />
          <path d="M12 7v6.5" />
          <path d="M12 13.5l-3 6.5" />
          <path d="M12 13.5l3 6.5" />
          <path d="M7.5 9.5l4.5 1 4.5-1" />
        </>
      )}
      {area === "cognitive" && (
        <>
          <path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.6 1 2.5h6c0-.9.3-1.8 1-2.5A6 6 0 0 0 12 3z" />
          <path d="M9.5 19h5" />
          <path d="M10.5 21.5h3" />
        </>
      )}
      {area === "social" && (
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 20c0-3 2.7-5 5.5-5s5.5 2 5.5 5" />
          <path d="M16 5.5a3 3 0 0 1 0 6" />
          <path d="M17 15.5c2 .5 3.5 2 3.5 4.5" />
        </>
      )}
      {area === "purpose" && (
        <path d="M12 20.5S3.5 15.5 3.5 9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8.5 2.5c0 6-8.5 11-8.5 11z" />
      )}
      {area === "vitality" && (
        <path d="M13 2.5L4.5 14H11l-1 7.5L19.5 10H13l1-7.5z" />
      )}
      {area === "senses" && (
        <>
          <path d="M2.5 12s3.6-7 9.5-7 9.5 7 9.5 7-3.6 7-9.5 7-9.5-7-9.5-7z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

// --- wheel geometry: 6 equal 60° segments, first centred at top, clockwise ---
const CX = 150;
const CY = 150;
const R_OUT = 140;
const R_IN = 74;
const R_ICON = 107;

// Round to 3 dp so the path/coordinate strings are byte-identical on the server
// and the client — Math.cos/sin can differ in their last bit across runtimes,
// which would otherwise trip a React hydration mismatch.
function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function polar(angleDeg: number, radius: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [r3(CX + radius * Math.cos(a)), r3(CY + radius * Math.sin(a))];
}

// Segment i spans [i*60-120, (i+1)*60-120]; i=0 centres on -90 (straight up).
function wedge(i: number): string {
  const a0 = i * 60 - 120;
  const a1 = (i + 1) * 60 - 120;
  const o0 = polar(a0, R_OUT);
  const o1 = polar(a1, R_OUT);
  const i1 = polar(a1, R_IN);
  const i0 = polar(a0, R_IN);
  return `M${o0[0]},${o0[1]} A${R_OUT},${R_OUT} 0 0 1 ${o1[0]},${o1[1]} L${i1[0]},${i1[1]} A${R_IN},${R_IN} 0 0 0 ${i0[0]},${i0[1]} Z`;
}

function iconPos(i: number): [number, number] {
  return polar(i * 60 - 90, R_ICON);
}

export default function ExploreWheel({ areas }: { areas: RevealArea[] }) {
  const [sel, setSel] = useState(0);
  const active = areas[sel];

  return (
    <div className="exw">
      <style>{css}</style>

      <h3 className="sr-only">
        Six area segments arranged around a ring. Select a segment to open that
        area&rsquo;s forward line and, where there is one, a research stat with a
        source you can reveal below.
      </h3>

      <div className="exw-wheel">
        <svg
          viewBox="0 0 300 300"
          width="300"
          height="300"
          role="group"
          aria-label="Six areas of your balanced retirement"
        >
          {areas.map((a, i) => {
            const on = i === sel;
            return (
              <path
                key={a.area}
                d={wedge(i)}
                className={`exw-seg${on ? " on" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={a.areaLabel}
                aria-pressed={on}
                style={{
                  fill: on
                    ? `var(--area-${a.area}-sel)`
                    : `var(--area-${a.area}-base)`,
                  stroke: on ? `var(--area-${a.area}-fg)` : "#fff",
                  strokeWidth: on ? 3 : 2.5,
                }}
                onClick={() => setSel(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSel(i);
                  }
                }}
              />
            );
          })}
        </svg>

        {areas.map((a, i) => {
          const [x, y] = iconPos(i);
          return (
            <span
              key={a.area}
              className="exw-ic"
              style={{ left: x, top: y, color: `var(--area-${a.area}-fg)` }}
            >
              <AreaIcon area={a.area} size={21} />
            </span>
          );
        })}

        <div className="exw-hub">
          <span
            className="exw-hub-ic"
            style={{ color: `var(--area-${active.area}-fg)` }}
          >
            <AreaIcon area={active.area} size={24} />
          </span>
          <span className="exw-hub-name">{active.areaLabel}</span>
        </div>
      </div>

      <div className="exw-detail" aria-live="polite">
        <DetailCard key={sel} area={active} />
      </div>
    </div>
  );
}

// One area's detail. Keyed by selection so it remounts on change — which both
// restarts the short fade and resets the source disclosure to closed.
function DetailCard({ area }: { area: RevealArea }) {
  const [showSource, setShowSource] = useState(false);
  const fg = `var(--area-${area.area}-fg)`;
  return (
    <div className="exw-card" style={{ borderLeftColor: `var(--area-${area.area}-fg)` }}>
      <div className="exw-card-head">
        <span
          className="exw-chip"
          style={{ background: `var(--area-${area.area}-base)`, color: fg }}
        >
          <AreaIcon area={area.area} size={18} />
        </span>
        <span className="exw-card-name">{area.areaLabel}</span>
      </div>

      <p className="exw-forward">{area.forwardLine}</p>

      {area.stat ? (
        <div className="exw-stat">
          <p className="exw-claim">
            {area.stat.leadIn && (
              <span className="exw-lead" style={{ color: fg }}>
                {area.stat.leadIn}{" "}
              </span>
            )}
            {area.stat.claim}
          </p>
          <button
            type="button"
            className="exw-src-tap"
            style={{ color: fg }}
            aria-expanded={showSource}
            onClick={() => setShowSource((v) => !v)}
          >
            {showSource ? "Hide source" : "Where\u2019s this from?"}
          </button>
          {showSource && <p className="exw-src">{area.stat.sourceDisplay}</p>}
        </div>
      ) : area.area === "senses" ? null : (
        <p className="exw-nostat">
          A part of the picture in its own right — no headline to add here.
        </p>
      )}
    </div>
  );
}

const css = `
.exw .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.exw{margin:0 auto;max-width:440px}

.exw-wheel{position:relative;width:300px;height:300px;margin:6px auto 2px}
.exw-wheel svg{display:block}
.exw .exw-seg{cursor:pointer;transition:opacity .15s,fill .2s,stroke .2s}
.exw .exw-seg:hover{opacity:.82}
.exw .exw-seg:focus-visible{outline:none;filter:drop-shadow(0 0 0 2px #fff);box-shadow:var(--focus-ring)}

.exw-ic{position:absolute;width:30px;height:30px;display:flex;align-items:center;justify-content:center;pointer-events:none;transform:translate(-50%,-50%)}

.exw-hub{position:absolute;left:50%;top:50%;width:128px;height:128px;border-radius:50%;background:var(--warm-surface);border:1px solid var(--warm-line);transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 14px;gap:3px}
.exw-hub-name{font-family:var(--font-serif);font-size:13.5px;font-weight:600;line-height:1.2;color:var(--ink)}

.exw-detail{margin-top:8px}
.exw-card{border:1px solid var(--border);border-left:4px solid var(--ink);border-radius:var(--r-md);padding:15px 16px;background:var(--bg)}
.exw-card-head{display:flex;align-items:center;gap:10px;margin-bottom:9px}
.exw-chip{flex:0 0 auto;width:34px;height:34px;border-radius:var(--r-sm);display:flex;align-items:center;justify-content:center}
.exw-card-name{font-family:var(--font-serif);font-size:17px;font-weight:600;color:var(--ink)}
.exw-forward{font-family:var(--font-serif);font-size:15.5px;line-height:1.55;color:var(--text);margin:0}
.exw-stat{border-top:1px solid var(--border);margin-top:12px;padding-top:12px}
.exw-claim{font-family:var(--font-serif);font-size:14.5px;line-height:1.55;color:var(--ink);margin:0}
.exw-lead{font-weight:600}
.exw-src-tap{font-family:var(--font-sans);font-size:12.5px;font-weight:600;background:none;border:none;padding:0;margin-top:10px;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.exw-src{font-family:var(--font-sans);font-size:12px;line-height:1.45;color:var(--text-muted);margin:8px 0 0;max-width:42ch}
.exw-nostat{font-family:var(--font-sans);font-size:12.5px;line-height:1.45;color:var(--text-muted);margin:12px 0 0;border-top:1px solid var(--border);padding-top:11px}

.exw-card{animation:exw-fade .2s ease}
@keyframes exw-fade{from{opacity:0}to{opacity:1}}
@media(prefers-reduced-motion:reduce){
  .exw .exw-seg{transition:none}
  .exw-card{animation:none}
}
`;
