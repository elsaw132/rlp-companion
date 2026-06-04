"use client";

// The Imagine stage's header motif: a soft dawn band (sky into cream with a low
// sun) sitting at the top of the reveal card — a quiet "new chapter / morning"
// note. Purely decorative, so aria-hidden. Other stages pass their own motif
// into StageReveal; this one is Imagine's.

export default function DawnMotif() {
  return (
    <div className="rlp-dawn" aria-hidden="true">
      <style>{css}</style>
      <div className="sun" />
    </div>
  );
}

const css = `
.rlp-dawn{height:108px;position:relative;opacity:0;animation:rlp-dawn-fade 1s ease .15s forwards;background:linear-gradient(180deg,var(--ill-sky-pale) 0%,#E4EFE2 58%,var(--warm-surface) 100%)}
.rlp-dawn .sun{position:absolute;left:50%;bottom:-26px;transform:translateX(-50%);width:78px;height:78px;border-radius:50%;background:radial-gradient(circle at 50% 42%,#FFE48A,var(--sun) 64%);box-shadow:0 0 0 14px rgba(251,210,78,.18),0 0 44px 8px rgba(251,210,78,.28)}
@keyframes rlp-dawn-fade{to{opacity:1}}
@media(prefers-reduced-motion:reduce){.rlp-dawn{opacity:1;animation:none}}
`;
