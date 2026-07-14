// The shared five-stage arc shown above every stage reveal. Extracted so Imagine,
// Explore (via StageReveal) and Understand (via UnderstandReveal) all render the
// exact same slim numbered circles — dark-green ticks for completed stages, quiet
// outlines for those still ahead — and so the reveals read as one set.

export type ArcStage = { number: number; name: string; done: boolean };

export default function StageArc({ arc }: { arc: ArcStage[] }) {
  return (
    <div className="rlp-arc">
      <style>{arcCss}</style>
      {arc.map((s, i) => (
        <div key={s.number} className={`s ${s.done ? "done" : "todo"}`}>
          <div className="d">{s.done ? "✓" : s.number}</div>
          <div className="c">{s.name}</div>
          {i < arc.length - 1 && (
            <span
              className={`line${arc[i + 1].done ? " done" : ""}`}
              aria-hidden="true"
            />
          )}
        </div>
      ))}
    </div>
  );
}

const arcCss = `
.rlp-arc{display:flex;align-items:flex-start;gap:0;margin:0 auto 28px;max-width:480px;width:100%}
.rlp-arc .s{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;position:relative}
.rlp-arc .d{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:700;z-index:1}
.rlp-arc .s.done .d{background:var(--ink);color:#fff}
.rlp-arc .s.todo .d{background:var(--bg-alt);border:1.5px solid color-mix(in srgb, var(--ink) 22%, transparent);color:var(--text-muted)}
.rlp-arc .c{font-size:var(--fs-eyebrow);font-weight:600;color:var(--text-muted);text-align:center}
.rlp-arc .s.done .c{color:var(--ink)}
.rlp-arc .s .line{position:absolute;top:13px;left:50%;width:100%;height:2px;background:var(--border)}
.rlp-arc .s .line.done{background:var(--ink)}
`;
