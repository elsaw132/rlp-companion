"use client";

// The Imagine reveal's payoff: the named retirement *type*. The order is what
// makes a typology read as a typology — eyebrow, "one of a set" lead, the name,
// a GENERIC definition of the type, then the personal "why you", then a
// belonging line (never a ranking). Crowned with the shared Vita mark. Passed
// into StageReveal's payoff slot by ImagineReveal.

import VitaMark from "./VitaMark";

export default function ArchetypeBlock({
  name,
  definition,
  whyYou,
  company,
  secondaryName,
}: {
  name: string;
  definition: string;
  whyYou: string;
  company: string;
  // An optional lighter second type, shown as a "with a streak of …" blend.
  secondaryName?: string;
}) {
  return (
    <div className="rlp-archetype">
      <style>{css}</style>
      <VitaMark size={34} className="crown" />
      <div className="a-eyebrow">Your retirement type</div>
      <div className="a-lead">
        Of the handful of ways people imagine this stage, yours is &mdash;
      </div>
      <div className="a-name pop">{name}</div>
      {secondaryName && (
        <div className="a-blend">
          with a streak of {secondaryName.replace(/^The /, "the ")}
        </div>
      )}
      <p className="a-def">{definition}</p>
      <p className="a-meaning">
        <span className="a-why">Why you:</span> {whyYou}
      </p>
      <p className="a-belong">{company}</p>
    </div>
  );
}

const css = `
.rlp-archetype{position:relative;margin:44px auto 0;max-width:50ch;text-align:center;background:#fff;border:1px solid color-mix(in srgb, var(--color-vita) 22%, transparent);border-radius:var(--r-lg);box-shadow:var(--shadow-lg);padding:36px 32px 30px}
.rlp-archetype .crown{position:absolute;top:-17px;left:50%;transform:translateX(-50%);box-shadow:0 0 0 6px #fff}
.rlp-archetype .a-eyebrow{font-size:var(--fs-eyebrow);letter-spacing:.12em;text-transform:uppercase;color:var(--color-vita);font-weight:700;margin-top:6px}
.rlp-archetype .a-lead{font-size:var(--fs-sm);color:var(--text-muted);margin-top:10px}
.rlp-archetype .a-name{font-family:var(--font-serif);font-size:31px;font-weight:600;color:var(--ink);line-height:1.15;margin:4px 0 6px;letter-spacing:-.01em}
.rlp-archetype .a-blend{font-family:var(--font-serif);font-style:italic;font-size:var(--fs-sm);color:var(--text-muted);margin:0 0 14px}
.rlp-archetype .a-name+.a-def{margin-top:8px}
.rlp-archetype .a-def{font-family:var(--font-serif);font-size:var(--fs-h2);line-height:1.5;color:var(--text);margin:0 auto 14px;max-width:44ch}
.rlp-archetype .a-meaning{font-size:var(--fs-sm);line-height:1.6;color:var(--text);margin:0 auto 14px;max-width:42ch}
.rlp-archetype .a-why{font-weight:600;color:var(--ink)}
.rlp-archetype .a-belong{font-size:var(--fs-sm);line-height:1.55;color:var(--text-muted);max-width:42ch;margin:0 auto;padding-top:14px;border-top:1px solid var(--warm-line)}

/* the name gets a subtle scale-pop as the reveal's climax */
.rlp-archetype .pop{opacity:0;transform:scale(.965);animation:rlp-pop .72s cubic-bezier(.22,.61,.36,1) 1.34s forwards}
@keyframes rlp-pop{to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.rlp-archetype .pop{opacity:1;transform:none;animation:none}}
@media(max-width:600px){
  .rlp-archetype{padding:30px 22px 26px}
  .rlp-archetype .a-name{font-size:26px}
  .rlp-archetype .a-def{font-size:18px}
}
`;
