"use client";

import { useEffect, useRef, useState } from "react";

// The media players a primer can carry, alongside its text and YouTube blocks.
// Each one is self-contained and fails soft: if an asset is missing or won't
// load, the block removes itself (or says so quietly) and the rest of the
// primer still renders. A broken image never takes the reading screen down.
//
// Colour discipline, per the design system: --brand-primary is the action
// colour for every control here, and orange (--accent) is absent by design —
// it belongs to the active-step cursor alone and must never appear on a
// player, a button or a slideshow dot.

// Assets are addressed by their public URL — "/primers/1-money.jpg", not the
// on-disk "public/primers/1-money.jpg" path.

// Elapsed time for the audio player, mm:ss. Guards NaN, which is what a
// <audio> reports for duration before metadata arrives (and forever, if the
// file is missing).
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// A primer's reading passage, as the writer laid it out.
//
// The copy carries its own shape and both kinds of break matter, so neither is
// thrown away: a blank line starts a new paragraph, and a single line break
// inside one is kept, because some passages are written as short stacked lines
// rather than prose. Rendering the raw string into one <p> silently loses the
// lot — HTML collapses every run of whitespace to a single space — which reads
// as one dense slab no matter how carefully the copy was set out.
export function PrimerText({ value }: { value: string }) {
  const paragraphs = value
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <div style={styles.textBlock}>
      {paragraphs.map((p, i) => (
        <p key={i} style={styles.reading}>
          {p}
        </p>
      ))}
    </div>
  );
}

// A single hero image. Sized by its own proportions rather than forced into a
// fixed crop: the real assets run from panoramic (1-roles, 1.90) to portrait
// (1-week-01, 0.77), so a fixed aspect would badly cut some of them. Capping
// the height and letting width follow keeps any shape inside the column
// without cropping.
export function PrimerImage({ src, alt }: { src: string; alt?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <div style={styles.imageWrap}>
      {/* eslint-disable-next-line @next/next/no-img-element -- plain <img> is the
          convention here; these are static, already-sized assets in public/. */}
      <img
        src={src}
        alt={alt ?? ""}
        style={styles.image}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

// An ordered set the reader pages through by hand — arrows, dots, arrow keys,
// or a swipe. Never autoplays, and the dots are a position indicator only:
// nothing here frames the set as progress to be completed.
//
// Paging is native scroll-snap rather than a transform, so a touch swipe gets
// real momentum for free. The frame hugs the images: it takes the aspect ratio
// of the tallest slide in the set (measured as they load) rather than a fixed
// band, so a uniform landscape set sits flush with no dead space around it —
// which matters most on a narrow phone. It's the *tallest* slide, not each
// slide in turn, so a set that mixes portrait and landscape (1-week does) still
// can't jump as you page; any shorter slide is simply centred inside the frame.
export function PrimerSlideshow({
  images,
}: {
  images: { src: string; alt?: string }[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Set<number>>(new Set());
  // Smallest width/height ratio seen so far — the tallest slide, which sets the
  // frame's shape. null until the first image reports its size; a landscape
  // guess stands in for that first paint so the common uniform-landscape set
  // never has to resize once its images arrive.
  const [minAspect, setMinAspect] = useState<number | null>(null);

  function noteAspect(w: number, h: number) {
    if (!w || !h) return;
    const a = w / h;
    setMinAspect((prev) => (prev === null ? a : Math.min(prev, a)));
  }

  if (images.length === 0) return null;

  function goTo(i: number) {
    const track = trackRef.current;
    if (!track) return;
    const next = Math.max(0, Math.min(images.length - 1, i));
    // Instant, deliberately. A programmatic *smooth* scroll is unreliable here
    // — measured against these slides it silently no-ops and leaves the arrows
    // dead, which is far worse than paging without a glide. A swipe still gets
    // native momentum, since that's the browser scrolling rather than us.
    track.scrollTo({ left: next * track.clientWidth, behavior: "auto" });
    setIndex(next);
  }

  // Keep the dots honest when the reader swipes instead of using the arrows.
  function syncIndex() {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const i = Math.round(track.scrollLeft / track.clientWidth);
    setIndex(Math.max(0, Math.min(images.length - 1, i)));
  }

  return (
    <div
      style={styles.mediaPanel}
      role="group"
      aria-roledescription="slideshow"
      aria-label={`${images.length} images`}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          goTo(index - 1);
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          goTo(index + 1);
        }
      }}
    >
      <div
        ref={trackRef}
        className="primer-slide-track"
        style={{
          ...styles.slideTrack,
          // Hug the tallest slide. maxHeight caps a very portrait set on a wide
          // screen so it can't run away vertically; aspect-ratio gives it back
          // its natural shape everywhere below that cap.
          aspectRatio: String(minAspect ?? 1.6),
          maxHeight: "440px",
        }}
        onScroll={syncIndex}
      >
        {images.map((img, i) => (
          <div key={i} style={styles.slide}>
            {failed.has(i) ? (
              <span style={styles.slideMissing}>This image didn’t load</span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- see PrimerImage.
              <img
                src={img.src}
                alt={img.alt ?? ""}
                style={styles.slideImage}
                onLoad={(e) =>
                  noteAspect(
                    e.currentTarget.naturalWidth,
                    e.currentTarget.naturalHeight,
                  )
                }
                onError={() =>
                  setFailed((prev) => new Set(prev).add(i))
                }
              />
            )}
          </div>
        ))}
      </div>

      <div style={styles.slideControls}>
        <button
          type="button"
          className="primer-media-btn"
          style={styles.arrowButton}
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          aria-label="Previous image"
        >
          <Chevron direction="left" />
        </button>

        <div style={styles.dots}>
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              className="primer-dot"
              style={{
                ...styles.dot,
                background:
                  i === index ? "var(--brand-primary)" : "var(--border-strong)",
              }}
              onClick={() => goTo(i)}
              aria-label={`Image ${i + 1}`}
              aria-current={i === index}
            />
          ))}
        </div>

        <button
          type="button"
          className="primer-media-btn"
          style={styles.arrowButton}
          onClick={() => goTo(index + 1)}
          disabled={index === images.length - 1}
          aria-label="Next image"
        >
          <Chevron direction="right" />
        </button>
      </div>
    </div>
  );
}

// A minimal play/pause player for a self-hosted audio file. No video chrome:
// a button, a title, a slim elapsed line and the time. The <audio> element
// does the work and is kept out of the layout.
export function PrimerAudio({ src, title }: { src: string; title?: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);

  // The element is the source of truth for play state — it can pause itself
  // (end of track, OS interruption), and the button has to follow.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setElapsed(el.currentTime);
    const onMeta = () => setDuration(el.duration);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onPause);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onPause);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
    };
  }, []);

  if (failed) {
    return <p style={styles.mediaMissing}>This audio isn’t available.</p>;
  }

  function toggle() {
    const el = ref.current;
    if (!el) return;
    // A rejected play() is swallowed, not treated as a missing asset. It
    // rejects for reasons that have nothing to do with the file — an autoplay
    // policy, or an AbortError when a pause interrupts it — and taking the
    // player away over one of those hides audio that is perfectly fine. Only a
    // real MediaError, via onError below, counts as unavailable.
    if (el.paused) void el.play().catch(() => {});
    else el.pause();
  }

  const pct = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;

  return (
    <div style={styles.audioPanel}>
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onError={() => setFailed(true)}
      />
      <button
        type="button"
        className="primer-play-btn"
        style={styles.playButton}
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <div style={styles.audioBody}>
        {title && <span style={styles.audioTitle}>{title}</span>}
        <div style={styles.audioTrack} aria-hidden="true">
          <div style={{ ...styles.audioFill, width: `${pct}%` }} />
        </div>
      </div>
      <span style={styles.audioTime}>
        {formatTime(elapsed)}
        {duration > 0 ? ` / ${formatTime(duration)}` : ""}
      </span>
    </div>
  );
}

// A self-hosted video, with the browser's own controls (play/pause, seek,
// mute). Deliberately native: the standard control set is what the brief asks
// for, and it carries its own accessibility.
export function PrimerVideo({ src, poster }: { src: string; poster?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <p style={styles.mediaMissing}>This video isn’t available.</p>;
  }
  return (
    <div style={styles.mediaPanel}>
      <video
        src={src}
        poster={poster}
        controls
        preload="metadata"
        playsInline
        style={styles.video}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={direction === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
    </svg>
  );
}

// Injected once by SessionContainer alongside its own focusCss — hover, focus
// and the scrollbar-hiding the inline style objects can't express.
export const primerMediaCss = `
  .primer-media-btn:hover:not(:disabled),
  .primer-play-btn:hover { background: var(--brand-primary-hover); }
  .primer-media-btn:focus-visible,
  .primer-play-btn:focus-visible,
  .primer-dot:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
  .primer-media-btn:disabled { opacity: .35; cursor: default; }
  /* Native swipe with momentum, without the scrollbar showing through. */
  .primer-slide-track { scrollbar-width: none; -ms-overflow-style: none; }
  .primer-slide-track::-webkit-scrollbar { display: none; }
`;

const styles: Record<string, React.CSSProperties> = {
  // Paragraphs sit closer together than the primer's blocks do, so a passage
  // reads as one piece of writing rather than as separate blocks.
  textBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  // Serif, and larger than functional body copy: this is the writing the
  // session wants the reader to sit with, which is the system's own test for
  // serif. The measure is capped because the 720px column runs a line to ~85
  // characters, far enough for the eye to lose its place on the way back.
  // pre-line keeps the single breaks inside a paragraph; the blank lines have
  // already become separate paragraphs by the time we get here.
  reading: {
    fontFamily: "var(--font-serif)",
    fontSize: "var(--fs-reading)",
    lineHeight: "var(--lh-body)",
    color: "var(--text)",
    margin: 0,
    maxWidth: "var(--reading-measure)",
    whiteSpace: "pre-line",
  },
  imageWrap: {
    display: "flex",
    justifyContent: "center",
  },
  image: {
    // Natural proportions, capped both ways: the column bounds the width and
    // the cap bounds the height, so a portrait asset can't run away vertically.
    maxWidth: "100%",
    maxHeight: "440px",
    width: "auto",
    height: "auto",
    display: "block",
    borderRadius: "var(--r-md)",
  },
  // The shared warm panel every player sits on — cream is Vita's surface.
  mediaPanel: {
    background: "var(--warm-surface)",
    border: "1px solid var(--warm-line)",
    borderRadius: "var(--r-md)",
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  slideTrack: {
    display: "flex",
    overflowX: "auto",
    scrollSnapType: "x mandatory",
    borderRadius: "var(--r-sm)",
  },
  slide: {
    flex: "0 0 100%",
    scrollSnapAlign: "center",
    // No fixed height: the slide stretches to the track, which is sized to the
    // tallest image's aspect ratio. Centring keeps any shorter slide (or the
    // "didn't load" note) in the middle of that frame.
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 0,
  },
  slideImage: {
    // Contained, not cropped: a set can mix portrait and landscape slides, and
    // the frame stays put as you page through them.
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    borderRadius: "var(--r-sm)",
  },
  slideMissing: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
  },
  slideControls: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  arrowButton: {
    flex: "0 0 auto",
    width: "44px",
    height: "44px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    border: "none",
    borderRadius: "var(--r-pill)",
    cursor: "pointer",
  },
  dots: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  dot: {
    width: "8px",
    height: "8px",
    padding: 0,
    border: "none",
    borderRadius: "var(--r-pill)",
    cursor: "pointer",
  },
  audioPanel: {
    background: "var(--warm-surface)",
    border: "1px solid var(--warm-line)",
    borderRadius: "var(--r-md)",
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  playButton: {
    flex: "0 0 auto",
    width: "44px",
    height: "44px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--brand-primary)",
    color: "var(--brand-on-primary)",
    border: "none",
    borderRadius: "var(--r-pill)",
    cursor: "pointer",
  },
  audioBody: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  audioTitle: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    fontWeight: 500,
    color: "var(--ink)",
  },
  audioTrack: {
    height: "4px",
    borderRadius: "var(--r-pill)",
    background: "var(--warm-line)",
    overflow: "hidden",
  },
  audioFill: {
    height: "100%",
    background: "var(--brand-primary)",
  },
  audioTime: {
    flex: "0 0 auto",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-label)",
    color: "var(--text-muted)",
    fontVariantNumeric: "tabular-nums",
  },
  video: {
    width: "100%",
    maxHeight: "460px",
    display: "block",
    borderRadius: "var(--r-sm)",
    background: "#000",
  },
  mediaMissing: {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-sm)",
    color: "var(--text-muted)",
    margin: 0,
  },
};
