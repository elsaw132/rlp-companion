"use client";

// TEMPORARY PREVIEW PAGE — the primer blocks rendered against the real assets
// in public/primers/, so they can be checked without walking a seeded account
// into a session. These are the real components SessionContainer uses, on the
// same warm content card, with the real copy — so this reflects what a primer
// actually looks like. Nothing is saved.
//
// Two things it exists to prove, beyond "does it render":
//   - paragraph shape survives (blank lines separate, single breaks are kept)
//   - a missing asset degrades to a calm gap, never a crash
//
// Safe to delete once the primer content has landed and been reviewed.

import {
  PrimerAudio,
  PrimerImage,
  PrimerSlideshow,
  PrimerText,
  PrimerVideo,
  primerMediaCss,
} from "../../components/PrimerMedia";

const weekSlides = Array.from({ length: 12 }, (_, i) => ({
  src: `/primers/1-week-${String(i + 1).padStart(2, "0")}.jpg`,
}));

const purposeSlides = Array.from({ length: 4 }, (_, i) => ({
  src: `/primers/2-4-0${i + 1}.jpg`,
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

      <Panel label="Text → image · 1.money (four paragraphs of shape)">
        <PrimerText
          value={`If every bill was paid for the rest of your life, what would you do tomorrow morning?

For the next few minutes, forget what's practical. Nothing has to be sensible. Simply notice what your imagination reaches for first.`}
        />
        <PrimerImage src="/primers/1-money.jpg" />
      </Panel>

      <Panel label="Text → video · 1.day (single line breaks, not paragraphs)">
        <PrimerText
          value={`Before you begin planning, it helps to imagine what life might feel like when work is no longer setting the rhythm.
Not the whole picture - just one ordinary day.
Take a little time to watch the video below:`}
        />
        <PrimerVideo src="/primers/4-1.mp4" />
      </Panel>

      <Panel label="Text → image · panoramic asset (1-roles, 1.90)">
        <PrimerText
          value={`Have you ever noticed how easily roles find us?

Some arrive with ceremony. Others appear so gradually that we hardly notice we've taken them on. We become the organiser, the helper, the listener, the mender, the coach, the volunteer.

The interesting thing is that roles aren't fixed. Some we carry forward because they still bring us energy and purpose. Others we can gently lay down.

Which roles still feel like you and which new ones are quietly waiting for an invitation?`}
        />
        <PrimerImage src="/primers/1-roles.jpg" />
      </Panel>

      <Panel label="Text → slideshow · 12 slides, mixed portrait and landscape">
        <PrimerText
          value={`As you look through these moments, you'll probably find yourself drawn to some and not others. An ideal week isn't about fitting everything in. It's about discovering the mix that feels most like you.`}
        />
        <PrimerSlideshow images={weekSlides} />
      </Panel>

      <Panel label="Text → slideshow · 4 slides">
        <PrimerText
          value={`Some people think retirement is about having enough to do.

It may be more important to have somewhere, or someone, where you still feel you matter.`}
        />
        <PrimerSlideshow images={purposeSlides} />
      </Panel>

      <Panel label="Text → image → audio · 1.letter">
        <PrimerText
          value={`Imagine yourself a good way into retirement - settled, comfortable and living a life you're truly happy with.

Before you begin, choose a person to write this letter to. Someone who would genuinely want to know how life has turned out for you.

If it helps you settle into the moment, you might enjoy listening to Carole King's 'Tapestry' while you write.`}
        />
        <PrimerImage src="/primers/1-letter.jpg" />
        <PrimerAudio src="/primers/1-5-tapestry.mp3" title="Tapestry · Carole King" />
      </Panel>

      <Panel label="Text → image → link · 2.3">
        <PrimerText
          value={`The people who enrich our lives aren't always the people we see most often. They're the ones who help us laugh, think, feel understood or simply remind us who we are.`}
        />
        <PrimerImage src="/primers/2-3.jpg" />
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
        <PrimerText
          value={`The text still renders. The image below removes itself; the audio and video say so quietly.`}
        />
        <PrimerImage src="/primers/does-not-exist.jpg" />
        <PrimerAudio src="/primers/does-not-exist.mp3" title="Missing audio" />
        <PrimerVideo src="/primers/does-not-exist.mp4" />
      </Panel>
    </div>
  );
}
