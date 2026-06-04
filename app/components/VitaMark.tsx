// Vita's single visual mark: a flat --sun disc holding a sun glyph. This is the
// ONE shared asset for the coach's icon — reference it wherever Vita appears
// (the reveal lockup, the archetype crown, the home next-step hero) so she stays
// pixel-identical product-wide. An inline SVG (not an emoji) keeps it the same
// across every OS and crisp at any size. Decorative: always aria-hidden.

export default function VitaMark({
  size = 34,
  className,
  style,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={className}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "var(--sun)",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
        ...style,
      }}
    >
      <svg
        width={Math.round(size * 0.6)}
        height={Math.round(size * 0.6)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--coach-pill-text)"
        strokeWidth={2}
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="4.2" fill="var(--coach-pill-text)" stroke="none" />
        <g>
          <line x1="12" y1="2.5" x2="12" y2="5" />
          <line x1="12" y1="19" x2="12" y2="21.5" />
          <line x1="2.5" y1="12" x2="5" y2="12" />
          <line x1="19" y1="12" x2="21.5" y2="12" />
          <line x1="5.3" y1="5.3" x2="7" y2="7" />
          <line x1="17" y1="17" x2="18.7" y2="18.7" />
          <line x1="18.7" y1="5.3" x2="17" y2="7" />
          <line x1="7" y1="17" x2="5.3" y2="18.7" />
        </g>
      </svg>
    </span>
  );
}
