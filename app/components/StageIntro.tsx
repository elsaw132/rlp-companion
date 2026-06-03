"use client";

// A brief framing moment shown the first time a stage becomes the person's
// current stage — what this stage is for, in Vita's voice. The copy lives on
// the stage in lib/modules.ts (stage.intro); this component only renders it, so
// it works for any stage that has an intro. A calm, full-width cream surface
// (Vita is speaking): her lockup, a serif heading, plain-language body, and a
// single navy button to continue into the stage.

import type { Stage } from "@/lib/modules";

export default function StageIntro({
  stage,
  onContinue,
}: {
  stage: Stage;
  onContinue: () => void;
}) {
  const intro = stage.intro;
  if (!intro) return null;

  return (
    <main className="rlp-stage-intro">
      <style>{css}</style>
      <div className="wrap">
        <div className="vita">
          <span className="sun" aria-hidden="true">
            ☀
          </span>
          <span className="name">Vita</span>
        </div>
        <div className="eyebrow">
          Stage {stage.number} · {stage.name}
        </div>
        <h1 className="heading">{intro.heading}</h1>
        {intro.body.map((p, i) => (
          <p key={i} className="body">
            {p}
          </p>
        ))}
        <button type="button" className="btn btn-navy" onClick={onContinue}>
          {intro.buttonLabel}
        </button>
      </div>
    </main>
  );
}

const css = `
.rlp-stage-intro{min-height:calc(100vh - var(--header-h));background:var(--warm-surface);display:flex;align-items:center;justify-content:center;padding:64px 24px}
.rlp-stage-intro .wrap{max-width:600px;width:100%}
.rlp-stage-intro .vita{display:flex;align-items:center;gap:10px;margin-bottom:22px}
.rlp-stage-intro .vita .sun{width:40px;height:40px;border-radius:50%;background:var(--sun);display:grid;place-items:center;font-size:20px;color:var(--ink)}
.rlp-stage-intro .vita .name{font-family:var(--font-serif);font-size:22px;font-weight:600;color:var(--ink)}
.rlp-stage-intro .eyebrow{font-family:var(--font-sans);font-size:12px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:var(--text-muted);margin-bottom:14px}
.rlp-stage-intro .heading{font-family:var(--font-serif);font-size:32px;font-weight:600;color:var(--ink);line-height:1.18;margin:0 0 22px}
.rlp-stage-intro .body{font-family:var(--font-sans);font-size:17px;line-height:1.7;color:var(--text);margin:0 0 18px;max-width:56ch}
.rlp-stage-intro .btn{font-family:var(--font-sans);font-size:15px;font-weight:600;border-radius:var(--r-sm);padding:14px 26px;cursor:pointer;border:none;line-height:1;min-height:48px;margin-top:10px}
.rlp-stage-intro .btn-navy{background:var(--brand-primary);color:var(--brand-on-primary)}
.rlp-stage-intro .btn-navy:hover{background:var(--brand-primary-hover)}
.rlp-stage-intro :focus-visible{outline:none}
.rlp-stage-intro .btn:focus-visible{box-shadow:var(--focus-ring)}
@media (max-width:560px){
  .rlp-stage-intro{padding:40px 18px}
  .rlp-stage-intro .heading{font-size:26px}
  .rlp-stage-intro .body{font-size:16px}
}
`;
