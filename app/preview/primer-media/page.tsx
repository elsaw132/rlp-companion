"use client";

// TEMPORARY PREVIEW PAGE — the primer media blocks (image, slideshow, audio,
// self-hosted video, link) rendered against the real assets in public/primers/,
// so they can be checked without walking a seeded account into a session. These
// are the real components SessionContainer uses, on the same warm content card,
// so this reflects what a primer actually looks like. Nothing is saved.
//
// The last panel points at a filename that doesn't exist, on purpose: it's the
// graceful-degradation case, and it should render as a calm gap, never a crash.
//
// Safe to delete once the primer content has landed and been reviewed.

import {
  PrimerAudio,
  PrimerImage,
  PrimerSlideshow,
  PrimerVideo,
  primerMediaCss,
} from "../../components/PrimerMedia";

const weekSlides = Array.from({ length: 12 }, (_, i) => ({
  src: `/primers/1-week-${String(i + 1).padStart(2, "0")}.jpg`,
  alt: `An ordinary moment in a week, ${i + 1} of 12`,
}));

const purposeSlides = Array.from({ length: 4 }, (_, i) => ({
  src: `/primers/2-4-0${i + 1}.jpg`,
  alt: `A way of mattering to someone, ${i + 1} of 4`,
}));

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "var(--fs-eyebrow)",
          fontWeight: 600,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        {label}
      </span>
      <div
        style={{
          background: "color-mix(in srgb, var(--chorus-yellow) 8%, #fff)",
          border: "1px solid color-mix(in srgb, var(--ink) 8%, transparent)",
          borderRadius: "var(--r-xl)",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {children}
      </div>
    </section>
  );
}

// Mirrors SessionContainer's bodyText so this page stays a truthful preview of
// what a primer actually looks like.
const body: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: "var(--fs-reading)",
  lineHeight: "var(--lh-body)",
  color: "var(--text)",
  margin: 0,
  maxWidth: "var(--reading-measure)",
};

export default function PrimerMediaPreview() {
  return (
    <div
      style={{
        maxWidth: "var(--content-max)",
        margin: "0 auto",
        padding: "32px 20px 64px",
        display: "flex",
        flexDirection: "column",
        gap: 32,
      }}
    >
      <style>{primerMediaCss}</style>

      <Panel label="Image → text">
        <PrimerImage src="/primers/1-money.jpg" alt="" />
        <p style={body}>
          If every bill was paid for the rest of your life, what would you do
          tomorrow morning?
        </p>
      </Panel>

      <Panel label="Image → text · panoramic asset (1-roles, 1.90)">
        <PrimerImage src="/primers/1-roles.jpg" alt="" />
        <p style={body}>The widest asset in the set — checking it doesn’t blow out.</p>
      </Panel>

      <Panel label="Slideshow → text · 12 slides, mixed portrait and landscape">
        <PrimerSlideshow images={weekSlides} />
        <p style={body}>
          An ideal week isn’t about fitting everything in. It’s about
          discovering the mix that feels most like you.
        </p>
      </Panel>

      <Panel label="Slideshow · 4 slides">
        <PrimerSlideshow images={purposeSlides} />
      </Panel>

      <Panel label="Image → text → audio">
        <PrimerImage src="/primers/1-letter.jpg" alt="" />
        <p style={body}>
          If it helps you settle into the moment, you might enjoy listening to
          Carole King’s ‘Tapestry’ while you write.
        </p>
        <PrimerAudio src="/primers/1-5-tapestry.mp3" title="Tapestry · Carole King" />
      </Panel>

      <Panel label="Self-hosted video → text">
        <PrimerVideo src="/primers/4-1.mp4" />
        <p style={body}>
          Few people wake up one morning knowing exactly when they want to
          retire.
        </p>
      </Panel>

      <Panel label="Link affordance (the existing 'links' block)">
        <a
          href="/primers/2-3-nyt.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="primer-link"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            alignSelf: "flex-start",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-sm)",
            boxShadow: "var(--shadow-sm)",
            padding: "10px 16px",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--fs-sm)",
            fontWeight: 600,
            color: "var(--brand-primary)",
            textDecoration: "none",
          }}
        >
          <span aria-hidden="true">↗</span>
          Read the article
        </a>
      </Panel>

      <Panel label="Missing assets — must degrade, not crash">
        <PrimerImage src="/primers/does-not-exist.jpg" alt="" />
        <PrimerAudio src="/primers/does-not-exist.mp3" title="Missing audio" />
        <PrimerVideo src="/primers/does-not-exist.mp4" />
        <p style={body}>
          The text still renders. The image above removed itself; the audio and
          video say so quietly.
        </p>
      </Panel>
    </div>
  );
}
