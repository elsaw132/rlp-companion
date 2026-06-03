"use client";

// The Stage 1 ("Imagine") picture screen, shown once all six Imagine modules
// are complete. It reads the six stored takeaways, asks Claude to weave them
// into one warm, second-person picture (via /api/stage-summary), and lets the
// person confirm it ("that's a good picture of me") or say what isn't quite
// right and have it written again. The confirmed picture is saved under
// rlp_stage1_summary_[userId]. Whether a partner prompt follows is read from
// onboarding. Everything is framed as a first sketch they own and can change —
// not a verdict, not a finished plan.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { STAGES } from "@/lib/modules";
import { getTakeaway } from "@/lib/takeaways";

const summaryKey = (userId: string) => `rlp_stage1_summary_${userId}`;

type SavedSummary = { text: string; savedAt: string };

function getSavedSummary(userId: string): SavedSummary | null {
  try {
    const raw = localStorage.getItem(summaryKey(userId));
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed.text === "string") return parsed as SavedSummary;
  } catch {
    // ignore corrupt data
  }
  return null;
}

// Whether the person is planning with a partner, read from onboarding. Only
// "Me and my partner" turns on the partner prompt; anything else skips it.
function hasPartner(userId: string): boolean {
  try {
    const raw = localStorage.getItem(`rlp_onboarding_${userId}`);
    if (!raw) return false;
    const answers = JSON.parse(raw) as { partner?: string };
    return answers.partner === "Me and my partner";
  } catch {
    return false;
  }
}

type Phase = "loading" | "review" | "editing" | "partner";

export default function Stage1Summary() {
  const { user } = useUser();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("loading");
  const [summary, setSummary] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [whatOff, setWhatOff] = useState("");
  const [loaded, setLoaded] = useState(false);

  // Once Clerk resolves the user, either show the already-saved picture or
  // generate a fresh one. Done in render (guarded) so the first paint matches
  // the server, then fills in — the same pattern the dashboard uses.
  if (user && !loaded && typeof window !== "undefined") {
    setLoaded(true);
    const saved = getSavedSummary(user.id);
    if (saved) {
      setSummary(saved.text);
      setPhase("review");
    } else {
      void generate();
    }
  }

  // The six Imagine takeaways, in programme order, with non-empty text only.
  function gatherTakeaways(): { moduleTitle: string; text: string }[] {
    if (!user) return [];
    return STAGES[0].modules.flatMap((m) => {
      const t = getTakeaway(user.id, m.id);
      return t && t.text.trim()
        ? [{ moduleTitle: m.title, text: t.text.trim() }]
        : [];
    });
  }

  async function generate(note?: string) {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/stage-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          takeaways: gatherTakeaways(),
          whatIsOff: note ?? "",
        }),
      });
      if (!res.ok) throw new Error("bad response");
      const data = (await res.json()) as { summary: string };
      setSummary(data.summary);
      setWhatOff("");
      setPhase("review");
    } catch {
      setError(
        "Something went wrong putting your picture together. Please try again in a moment."
      );
    } finally {
      setGenerating(false);
    }
  }

  function confirmPicture() {
    if (!user) return;
    const payload: SavedSummary = {
      text: summary,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(summaryKey(user.id), JSON.stringify(payload));
    if (hasPartner(user.id)) {
      setPhase("partner");
    } else {
      router.push("/home");
    }
  }

  const paragraphs = summary
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <main className="rlp-stage1">
      <style>{css}</style>
      <div className="wrap">
        {phase === "partner" ? (
          <PartnerView onContinue={() => router.push("/home")} />
        ) : (
          <>
            <div className="eyebrow">Stage 1 · Imagine</div>
            <h1 className="title">The picture you&apos;ve started to build</h1>
            <p className="intro">
              Here&apos;s the picture you&apos;ve started to build. It
              doesn&apos;t need to be perfect or final — it&apos;s something to
              react to and shape as you move through the next stages.
            </p>

            {generating ? (
              <div className="picture is-loading">
                <p className="loading-line">
                  Vita is putting your picture together…
                </p>
              </div>
            ) : error ? (
              <div className="errorbox">
                <p>{error}</p>
                <button
                  type="button"
                  className="btn btn-navy"
                  onClick={() => generate(whatOff || undefined)}
                >
                  Try again
                </button>
              </div>
            ) : (
              <>
                <article className="picture">
                  {paragraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </article>

                {/* A calm, separate forward-look beneath the personal picture,
                    so it reads as a foundation rather than a full stop. Largely
                    the same for everyone — the programme shape doesn't change. */}
                <section className="whatnext">
                  <h2 className="wn-head">What happens next</h2>
                  <p className="wn-body">
                    This picture is the ground everything else builds on. From
                    here, each stage takes it further: in <strong>Explore</strong>,
                    you&apos;ll go deeper one area at a time; in{" "}
                    <strong>Understand</strong>, you&apos;ll work out what matters
                    most to you; and in <strong>Plan</strong>, you&apos;ll turn it
                    into something concrete. It all builds towards your Retirement
                    Life Plan at the end. None of it is fixed — you&apos;ll keep
                    adjusting and adding to this picture as you go.
                  </p>
                </section>

                {phase === "editing" ? (
                  <div className="editbox">
                    <label className="edit-label" htmlFor="whatoff">
                      What doesn&apos;t feel quite right? Tell Vita in your own
                      words, and she&apos;ll write it again.
                    </label>
                    <textarea
                      id="whatoff"
                      className="edit-input"
                      rows={3}
                      placeholder="e.g. it makes me sound busier than I want to be…"
                      value={whatOff}
                      onChange={(e) => setWhatOff(e.target.value)}
                    />
                    <div className="actions">
                      <button
                        type="button"
                        className="btn btn-navy"
                        disabled={!whatOff.trim()}
                        onClick={() => generate(whatOff.trim())}
                      >
                        Write it again
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setPhase("review")}
                      >
                        Never mind
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="actions">
                    <button
                      type="button"
                      className="btn btn-navy"
                      onClick={confirmPicture}
                    >
                      That&apos;s a good picture of me
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setPhase("editing")}
                    >
                      Something isn&apos;t quite right
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

// Shown only when the person is planning with a partner. A gentle invitation to
// tell their partner some of what they've pictured — framed as theirs to share
// and a way to start a conversation, not something to be agreed or aligned on.
function PartnerView({ onContinue }: { onContinue: () => void }) {
  return (
    <>
      <div className="eyebrow">Before you carry on</div>
      <h1 className="title">This is yours to talk over, if you&apos;d like</h1>
      <article className="picture">
        <p>
          You&apos;re picturing this alongside a partner. If it feels right, you
          might tell them some of what you&apos;ve imagined here — not to settle
          anything or line your pictures up, but because it can be a good way to
          start a conversation. It&apos;s your picture, and yours to talk about
          however and whenever suits you.
        </p>
      </article>
      <div className="actions">
        <button type="button" className="btn btn-navy" onClick={onContinue}>
          Continue
        </button>
      </div>
    </>
  );
}

const css = `
.rlp-stage1{min-height:100vh;background:var(--bg-alt)}
.rlp-stage1 .wrap{max-width:680px;margin:0 auto;padding:48px 24px 96px}
.rlp-stage1 .eyebrow{font-family:var(--font-sans);font-size:12px;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:var(--text-muted);margin-bottom:12px}
.rlp-stage1 .title{font-family:var(--font-serif);font-size:32px;font-weight:600;color:var(--ink);line-height:1.18;margin-bottom:16px}
.rlp-stage1 .intro{font-family:var(--font-sans);font-size:15px;line-height:1.6;color:var(--text-muted);margin-bottom:28px;max-width:56ch}
.rlp-stage1 .picture{background:var(--warm-surface);border:1px solid var(--warm-line);border-radius:var(--r-lg);box-shadow:var(--shadow-md);padding:32px 34px;margin-bottom:28px}
.rlp-stage1 .picture p{font-family:var(--font-serif);font-size:18px;line-height:1.7;color:var(--ink);margin:0 0 16px}
.rlp-stage1 .picture p:last-child{margin-bottom:0}
.rlp-stage1 .picture.is-loading{display:grid;place-items:center;min-height:160px}
.rlp-stage1 .loading-line{font-family:var(--font-serif)!important;font-style:italic;color:var(--text-muted)!important}
.rlp-stage1 .whatnext{background:#fff;border:1px solid var(--border);border-radius:var(--r-md);padding:22px 24px;margin-bottom:28px}
.rlp-stage1 .whatnext .wn-head{font-family:var(--font-sans);font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:var(--text-muted);margin:0 0 10px}
.rlp-stage1 .whatnext .wn-body{font-family:var(--font-sans);font-size:15px;line-height:1.65;color:var(--text);margin:0}
.rlp-stage1 .whatnext .wn-body strong{color:var(--ink);font-weight:600}
.rlp-stage1 .errorbox{background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);padding:28px;margin-bottom:28px;text-align:center}
.rlp-stage1 .errorbox p{font-family:var(--font-sans);font-size:15px;color:var(--text);margin-bottom:18px}
.rlp-stage1 .actions{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.rlp-stage1 .btn{font-family:var(--font-sans);font-size:15px;font-weight:600;border-radius:var(--r-sm);padding:13px 22px;cursor:pointer;border:none;line-height:1;min-height:48px}
.rlp-stage1 .btn-navy{background:var(--brand-primary);color:#fff}
.rlp-stage1 .btn-navy:hover{background:var(--brand-primary-hover)}
.rlp-stage1 .btn-navy:disabled{opacity:.5;cursor:not-allowed}
.rlp-stage1 .btn-ghost{background:none;color:var(--brand-primary);border:1.5px solid var(--border-strong)}
.rlp-stage1 .btn-ghost:hover{background:var(--bg-alt)}
.rlp-stage1 .editbox{background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);padding:24px;margin-bottom:28px}
.rlp-stage1 .edit-label{display:block;font-family:var(--font-sans);font-size:14px;font-weight:600;color:var(--ink);line-height:1.5;margin-bottom:12px}
.rlp-stage1 .edit-input{width:100%;background:var(--bg);border:1.5px solid var(--border);border-radius:var(--r-sm);padding:12px 14px;font-family:var(--font-sans);font-size:15px;color:var(--text);line-height:1.5;outline:none;resize:vertical;margin-bottom:16px;box-sizing:border-box}
.rlp-stage1 .edit-input:focus-visible{border-color:var(--brand-primary);box-shadow:var(--focus-ring)}
.rlp-stage1 :focus-visible{outline:none}
.rlp-stage1 .btn:focus-visible{box-shadow:var(--focus-ring)}
@media (max-width:560px){
  .rlp-stage1 .wrap{padding:32px 18px 80px}
  .rlp-stage1 .title{font-size:26px}
  .rlp-stage1 .picture{padding:24px 22px}
  .rlp-stage1 .picture p{font-size:17px}
}
`;
