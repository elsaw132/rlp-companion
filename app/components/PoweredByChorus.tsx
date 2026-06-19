// "Powered by Chorus Life" footer/branding treatment. This is product-layer
// branding (Chorus Life, who built the companion) — distinct from the provider
// band at the top, which belongs to the pension provider. Uses the official
// Chorus Life logo asset only (public/chorus-life-logo.svg); the mark is never
// redrawn or approximated. Scoped under .rlp-poweredby so styles don't leak.

export default function PoweredByChorus() {
  return (
    <div className="rlp-poweredby">
      <style>{css}</style>
      <span className="pre">Powered by</span>
      {/* The official Chorus Life logo, used as supplied. The wordmark is part of
          the asset, so the "pre" text deliberately stops at "Powered by". A plain
          <img> is intentional: it's a tiny static SVG that next/image wouldn't
          optimise. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="logo"
        src="/chorus-life-logo.svg"
        alt="Chorus Life"
        width={1000}
        height={317}
      />
    </div>
  );
}

const css = `
.rlp-poweredby{display:flex;align-items:center;justify-content:center;gap:9px;padding:8px 0}
.rlp-poweredby .pre{font-family:var(--font-sans);font-size:var(--fs-label);font-weight:500;color:var(--text-muted);letter-spacing:.01em}
.rlp-poweredby .logo{height:20px;width:auto;display:block}
`;
