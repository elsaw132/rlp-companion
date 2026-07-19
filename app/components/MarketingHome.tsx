// The public, logged-out home page. A server component: everything here is static
// marketing content, so the only client-side piece is the rotating plan card
// (MarketingPlanCard). Built to the approved chorus-home-v11 mock, but against the
// real design system — our next/font families and the semantic tokens in
// tokens.css, never the mock's CDN fonts or its raw :root block. Styling follows
// the house convention (ProviderBand / HomeDashboard): one scoped <style> block
// under a single .rlp-landing root class, no new global stylesheet.
//
// Colour discipline: white/cream section grounds alternate, the closing band and
// footer are dark green, and the brighter Chorus colours appear only as
// highlights. The few marketing-only surface tints (soft section grounds, the
// pale Vita panel) are derived from the Chorus tokens via color-mix below — no new
// hex where a token exists. The terracotta hero graphic is decorative on this
// marketing surface; the in-app semantic rules (orange = current-step cursor,
// purple = Vita) are untouched elsewhere.

import Link from "next/link";
import VitaMark from "./VitaMark";
import MarketingPlanCard from "./MarketingPlanCard";
import MarketingJourney from "./MarketingJourney";

// A checkmark tick used in the plan-contents list. Decorative — the row text
// carries the meaning.
function Tick() {
  return (
    <span className="tick">
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12l5 5L20 7" />
      </svg>
    </span>
  );
}

export default function MarketingHome() {
  return (
    <div className="rlp-landing">
      <style>{css}</style>

      {/* Nav — sticky. Links collapse ≤940px; logo + Log in + Get started remain. */}
      <nav>
        <div className="wrap">
          <Link className="logo" href="/" aria-label="Chorus Life — home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/chorus-life-logo.svg" alt="Chorus Life" width={95} height={30} />
          </Link>
          <div className="navcta">
            <Link className="login" href="/sign-in">Log in</Link>
            <Link className="btn btn-primary btn-sm" href="/sign-up">Get started →</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="hero">
        <div className="wrap">
          <div className="copy">
            <span className="eyebrow">Retirement Life Planning</span>
            <h1>Create a retirement you’ll love living</h1>
            <p className="lede">
              Chorus helps you picture and shape the years ahead — one bite-sized session at a
              time. You’ll build your own Retirement Life Plan, and we’ll help you make it happen.
            </p>
            <div className="cta">
              <Link className="btn btn-primary" href="/sign-up">Get started →</Link>
              <Link className="btn btn-ghost" href="/sign-in">Log in</Link>
            </div>
            <div className="foot">
              <span className="dot" aria-hidden="true" /> For wherever you are — years away from
              retirement, just around the corner, or already here.
            </div>
          </div>

          <MarketingPlanCard />
        </div>
      </header>

      {/* How it works */}
      <section id="how">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">How it works</span>
            <h2>Three simple steps.</h2>
            <p>Little and often. You set the pace.</p>
          </div>
          <div className="steps">
            <div className="stepcard one">
              <div className="ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="3" />
                  <path d="M8 9h8M8 13h8M8 17h5" />
                </svg>
              </div>
              <h3>Bite-sized sessions</h3>
              <p>Short, engaging sessions you can fit in whenever suits you. Explore what a good life after work looks like for you.</p>
            </div>
            <div className="stepcard two">
              <div className="ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--brand-primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v6M9 5l3-3 3 3" />
                  <path d="M5 12h14v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
                  <path d="M5 12l2-4h10l2 4" />
                </svg>
              </div>
              <h3>Build your plan</h3>
              <p>Your reflections come together into your Retirement Life Plan — a personal, practical guide to the life you want and how to get there.</p>
            </div>
            <div className="stepcard three">
              <div className="ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3a6 6 0 0 1 6 6c0 2.5-1.5 3.8-2.5 5-.5.6-.5 1.5-.5 2h-6c0-.5 0-1.4-.5-2C7.5 12.8 6 11.5 6 9a6 6 0 0 1 6-6Z" />
                  <path d="M9.5 20h5M10.5 22h3" />
                </svg>
              </div>
              <h3>Make it happen</h3>
              <p>With your plan in place, Chorus keeps supporting you with practical next steps and guidance to help you thrive in the years ahead.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Five-stage journey — public page renders WITH the pathway tabs. */}
      <MarketingJourney />

      {/* Meet Vita — cream ground = Vita's presence */}
      <section className="vita" id="vita">
        <div className="wrap">
          <div className="vita-panel">
            {/* The shared Vita mark: purple disc + white bloom, with a soft ring. */}
            <VitaMark
              size={150}
              style={{ boxShadow: "0 0 0 10px color-mix(in srgb, var(--color-vita) 12%, transparent)" }}
            />
          </div>
          <div className="vita-copy">
            <span className="coachpill">Your retirement coach</span>
            <h2>Meet Vita.</h2>
            <p>
              Vita is your AI-powered coach — patient, encouraging, and never in a hurry. It asks
              good questions, listens, and reflects back what it hears, so your plan always sounds
              like you.
            </p>
          </div>
        </div>
      </section>

      {/* What you'll build */}
      <section className="spotlight" id="plan">
        <div className="wrap">
          <div className="intro">
            <span className="eyebrow">What you’ll build</span>
            <h2>Your Retirement Life Plan</h2>
            <p className="body">
              Your personal plan for life after work — what matters most to you, and how you want the
              years to unfold. It sits alongside your financial plan: the money shows what’s possible;
              your plan decides what it’s all for.
            </p>
          </div>
          <div className="inside">
            <div className="cap">What your plan covers</div>
            <div className="row"><Tick /> Your vision for the years ahead</div>
            <div className="row"><Tick /> What matters most to you</div>
            <div className="row"><Tick /> Goals and milestones</div>
            <div className="row"><Tick /> The shape of your weeks</div>
            <div className="row"><Tick /> When &amp; how you’ll get there</div>
            <div className="row"><Tick /> Questions worth sitting with</div>
          </div>
        </div>
      </section>

      {/* The difference a plan makes */}
      <section className="compare">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow">Why it matters</span>
            <h2>The difference a plan makes.</h2>
          </div>
          <div className="cgrid">
            <div className="ccard without">
              <h3>Life without a plan</h3>
              <ul>
                <li><span className="m" aria-hidden="true">·</span> Retirement arrives, and you work it out as it comes.</li>
                <li><span className="m" aria-hidden="true">·</span> You drift through the very years you’d looked forward to.</li>
                <li><span className="m" aria-hidden="true">·</span> A quiet sense that there could be more.</li>
              </ul>
            </div>
            <div className="ccard with">
              <h3>With your Retirement Life Plan</h3>
              <ul>
                <li><span className="m" aria-hidden="true">✓</span> You arrive knowing what you want, and why.</li>
                <li><span className="m" aria-hidden="true">✓</span> Your time goes to what matters most to you.</li>
                <li><span className="m" aria-hidden="true">✓</span> A clear path — and support to walk it.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Closing — dark-green band */}
      <section className="closing">
        <div className="wrap">
          <span className="eyebrow">Beyond the plan</span>
          <h2>Your best years, by design.</h2>
          <p>Your plan is just the beginning. Chorus stays with you — with practical next steps and encouragement to help you thrive in the years ahead.</p>
          <Link className="btn btn-primary" href="/sign-up">Get started →</Link>
        </div>
      </section>

      {/* Footer — mirrors chorus-life.com: white logo + one meta line. */}
      <footer>
        <div className="wrap">
          <Link className="logo" href="/" aria-label="Chorus Life — home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/chorus-life-logo-white.svg" alt="Chorus Life" width={76} height={24} />
          </Link>
          <div className="fmeta">
            <span>© 2026 Chorus Life</span>
            <span className="sep" aria-hidden="true">·</span>
            <a href="mailto:hello@chorus-life.com">hello@chorus-life.com</a>
            <span className="sep" aria-hidden="true">·</span>
            <a href="https://www.linkedin.com/company/chorus-life-uk/">LinkedIn</a>
            <span className="sep" aria-hidden="true">·</span>
            <a href="https://chorus-life.com/privacy.html">Privacy Policy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Scoped styles — everything under .rlp-landing so nothing leaks to the app. The
// mock's raw :root palette is dropped: colours reference the semantic tokens in
// tokens.css. The only locals defined here are marketing-only values with no token
// equivalent — an extra-large radius, a large hero-card shadow, and three soft
// section grounds derived from the Chorus stage colours via color-mix.
const css = `
.rlp-landing{
  /* marketing-only locals (no token equivalent; grounds derived from Chorus tokens) */
  --r-xl:22px;
  --shadow-lg:0 20px 54px rgba(16,32,46,.14);
  --ground-cream:color-mix(in srgb, var(--chorus-yellow) 45%, #fff);
  --ground-blue:color-mix(in srgb, var(--chorus-blue) 40%, #fff);
  --ground-pink:color-mix(in srgb, var(--chorus-pink) 55%, #fff);

  font-family:var(--font-sans);color:var(--text);background:var(--bg-alt);
  line-height:1.6;-webkit-font-smoothing:antialiased;
}
.rlp-landing *{box-sizing:border-box}
.rlp-landing a{color:inherit;text-decoration:none}
.rlp-landing .wrap{max-width:1180px;margin:0 auto;padding:0 32px}
.rlp-landing h1,.rlp-landing h2,.rlp-landing h3{font-family:var(--font-serif);color:var(--ink);font-weight:600;line-height:1.14;letter-spacing:-.01em}

.rlp-landing .btn{font-family:var(--font-sans);font-weight:600;font-size:16px;border:none;border-radius:var(--r-sm);padding:15px 24px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;line-height:1;min-height:48px;transition:.15s}
.rlp-landing .btn:focus-visible{outline:none;box-shadow:var(--focus-ring)}
.rlp-landing .btn-primary{background:var(--brand-primary);color:#fff}
.rlp-landing .btn-primary:hover{background:var(--brand-primary-hover)}
.rlp-landing .btn-ghost{background:transparent;color:var(--brand-primary);border:1.5px solid var(--border-strong)}
.rlp-landing .btn-ghost:hover{background:var(--brand-primary-tint)}
.rlp-landing .eyebrow{font-family:var(--font-sans);font-size:11.5px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:var(--brand-primary)}

/* nav */
.rlp-landing nav{position:sticky;top:0;z-index:50;background:color-mix(in srgb, var(--bg-alt) 90%, transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--border)}
.rlp-landing nav .wrap{display:flex;align-items:center;justify-content:space-between;height:74px}
.rlp-landing .logo{display:inline-flex;align-items:center}
.rlp-landing .logo img{height:30px;width:auto;display:block}
.rlp-landing .logo:focus-visible{outline:none;box-shadow:var(--focus-ring);border-radius:var(--r-sm)}
.rlp-landing .navcta{display:flex;align-items:center;gap:14px}
.rlp-landing .navcta .login{font-weight:600;font-size:15px;color:var(--ink);min-height:44px;display:inline-flex;align-items:center;padding:0 4px}
.rlp-landing .navcta .login:hover{color:var(--brand-primary)}
.rlp-landing .navcta .login:focus-visible{outline:none;box-shadow:var(--focus-ring);border-radius:var(--r-sm)}
.rlp-landing .btn-sm{padding:11px 18px;font-size:15px;min-height:44px}

/* hero */
.rlp-landing .hero{background:linear-gradient(180deg,var(--ground-cream),var(--bg-alt) 88%);overflow:hidden}
.rlp-landing .hero .wrap{display:grid;grid-template-columns:1.02fr .98fr;gap:56px;align-items:center;padding-top:76px;padding-bottom:88px}
.rlp-landing .hero .eyebrow{margin-bottom:18px;display:block}
.rlp-landing .hero h1{font-size:58px;margin-bottom:22px;line-height:1.08}
.rlp-landing .hero .lede{font-size:20px;color:var(--text-muted);max-width:37ch;margin-bottom:32px;line-height:1.55}
.rlp-landing .hero .cta{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.rlp-landing .hero .foot{margin-top:26px;font-size:15px;color:var(--text-muted);display:flex;align-items:flex-start;gap:10px}
/* Aligned to the first line's optical centre so it reads as a leading marker,
   not a dot floating between the wrapped lines. */
.rlp-landing .hero .foot .dot{width:6px;height:6px;border-radius:50%;background:var(--accent);flex:none;margin-top:9px}

/* hero visual — plan card over a crop of the Chorus vector graphic */
.rlp-landing .stage{position:relative;height:480px}
.rlp-landing .gfx{position:absolute;inset:0;border-radius:var(--r-xl);overflow:hidden;background:var(--chorus-yellow)}
/* The Chorus vector graphic sits as a decorative crop behind the card. Per the
   brand rule, the bloom is NEVER shown in full: it's scaled up and centred
   behind the card so only partial, equal-sized circles bleed in from the frame
   edges, in the graphic's own fixed positions. */
/* The graphic is zoomed to ~2.8x and pushed low-left so a corner of the bloom's
   equal circles bleeds into the frame (never the full bloom). max-width:none is
   essential — the global img{max-width:100%} reset otherwise clamps the width to
   the tile and the zoom does nothing. Framing set via the tuner. */
.rlp-landing .gfx-graphic{position:absolute;width:278%;max-width:none;height:auto;left:31%;top:94%;transform:translate(-50%,-50%);display:block}
.rlp-landing .plan{position:absolute;top:52px;left:50%;transform:translateX(-50%) rotate(-2deg);width:min(372px,calc(100% - 40px));background:#fff;border-radius:var(--r-lg);box-shadow:var(--shadow-lg);padding:26px 26px 20px;border:1px solid var(--border)}
.rlp-landing .plan .phead{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.rlp-landing .plan .kicker{font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--brand-primary)}
.rlp-landing .plan .seal{width:30px;height:30px;display:grid;place-items:center}
.rlp-landing .plan .seal svg{width:26px;height:26px}
.rlp-landing .plan .pname{font-size:14px;color:var(--text-muted);font-weight:600;margin-bottom:10px}
.rlp-landing .plan .vision{font-family:var(--font-serif);font-size:22px;line-height:1.3;color:var(--ink);font-weight:500;margin-bottom:18px;min-height:86px}
.rlp-landing .plan .chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;min-height:34px}
.rlp-landing .plan .chip{font-size:12.5px;font-weight:600;padding:6px 12px;border-radius:var(--r-pill);background:var(--ground-blue);color:var(--ink)}
.rlp-landing .plan .chip.y{background:var(--chorus-yellow);color:var(--area-purpose-fg)}
.rlp-landing .plan .chip.p{background:var(--chorus-pink);color:#7A2E6E}
.rlp-landing .plan .pfoot{font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:7px;border-top:1px solid var(--border);padding-top:13px}
.rlp-landing .plan .pfoot .g{width:8px;height:8px;border-radius:50%;background:var(--brand-primary);flex:none}
.rlp-landing .plan-inner{transition:opacity .5s}
.rlp-landing .dots{position:absolute;bottom:24px;left:50%;transform:translateX(-50%);display:flex;gap:8px}
.rlp-landing .dots button{width:8px;height:8px;border-radius:50%;border:none;background:color-mix(in srgb, var(--ink) 24%, transparent);cursor:pointer;padding:0;transition:.15s}
.rlp-landing .dots button.on{background:var(--ink);width:22px;border-radius:5px}
.rlp-landing .dots button:focus-visible{outline:none;box-shadow:var(--focus-ring)}

.rlp-landing section{padding:96px 0}
.rlp-landing .sec-head{max-width:640px;margin:0 auto 54px;text-align:center}
.rlp-landing .sec-head .eyebrow{margin-bottom:14px;display:block}
.rlp-landing .sec-head h2{font-size:42px;margin-bottom:14px}
.rlp-landing .sec-head p{font-size:18px;color:var(--text-muted)}

/* steps */
.rlp-landing .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.rlp-landing .stepcard{background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);padding:34px 30px;box-shadow:var(--shadow-sm)}
.rlp-landing .stepcard .ico{width:56px;height:56px;border-radius:14px;display:grid;place-items:center;margin-bottom:22px}
.rlp-landing .stepcard.one .ico{background:var(--chorus-yellow)}
.rlp-landing .stepcard.two .ico{background:var(--chorus-blue)}
.rlp-landing .stepcard.three .ico{background:var(--chorus-pink)}
.rlp-landing .stepcard .ico svg{width:28px;height:28px}
.rlp-landing .stepcard h3{font-size:23px;margin-bottom:10px}
.rlp-landing .stepcard p{font-size:16px;color:var(--text-muted)}

/* five-stage journey — white/bg-alt ground, continuing the alternation before the
   cream Meet Vita band. Node colours use the semantic stage tokens. */
.rlp-landing .journey{background:var(--bg-alt);padding:96px 0}
.rlp-landing .journey .sec-head{max-width:640px;margin:0 auto 26px;text-align:center}
.rlp-landing .journey .sec-head .eyebrow{display:block;margin-bottom:14px}
.rlp-landing .journey .sec-head h2{font-size:42px;margin-bottom:12px}
.rlp-landing .journey .sec-head p{font-size:18px;color:var(--text-muted);max-width:48ch;margin:0 auto}
/* segmented pathway tabs */
.rlp-landing .jtabs-wrap{text-align:center;margin-bottom:52px}
.rlp-landing .jtabs{display:inline-flex;gap:4px;padding:4px;border:1.5px solid var(--border-strong);border-radius:var(--r-pill);background:#fff}
.rlp-landing .jtab{font-family:var(--font-sans);font-weight:600;font-size:15px;color:var(--text-muted);background:transparent;border:none;border-radius:var(--r-pill);padding:11px 22px;cursor:pointer;min-height:44px;transition:.15s;white-space:nowrap}
.rlp-landing .jtab:hover{color:var(--ink)}
.rlp-landing .jtab.is-active{background:var(--ink);color:#fff}
.rlp-landing .jtab:focus-visible{outline:none;box-shadow:var(--focus-ring)}
/* the connected path */
.rlp-landing .jrow{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;align-items:start;transition:opacity .28s ease}
.rlp-landing .jrow:focus-visible{outline:none;box-shadow:var(--focus-ring);border-radius:var(--r-sm)}
.rlp-landing .jnode{position:relative;text-align:center;padding:0 10px}
.rlp-landing .jnum{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;font-family:var(--font-sans);font-weight:700;font-size:18px;margin:0 auto 18px;position:relative;z-index:1}
.rlp-landing .jnode.s1 .jnum{background:var(--color-stage-imagine);color:var(--color-on-stage-imagine)}
.rlp-landing .jnode.s2 .jnum{background:var(--color-stage-explore);color:var(--color-on-stage-explore)}
.rlp-landing .jnode.s3 .jnum{background:var(--color-stage-understand);color:var(--color-on-stage-understand)}
.rlp-landing .jnode.s4 .jnum{background:var(--color-stage-plan);color:var(--color-on-stage-plan)}
.rlp-landing .jnode.s5 .jnum{background:var(--color-stage-act);color:var(--color-on-stage-act)}
.rlp-landing .jnode:not(:last-child)::after{content:"";position:absolute;top:26px;left:50%;width:100%;height:2px;background:var(--border-strong);z-index:0}
.rlp-landing .jname{font-family:var(--font-serif);font-size:20px;font-weight:600;color:var(--ink);margin-bottom:6px}
.rlp-landing .jdesc{font-size:14.5px;color:var(--text-muted);line-height:1.5;max-width:21ch;margin:0 auto}

/* meet vita (cream = Vita present) */
.rlp-landing .vita{background:var(--warm-surface);border-top:1px solid var(--warm-line);border-bottom:1px solid var(--warm-line)}
.rlp-landing .vita .wrap{display:grid;grid-template-columns:320px 1fr;gap:52px;align-items:center}
/* Square panel (aspect-ratio:1); max-width keeps it sized when the layout
   collapses to one column below 940px. */
.rlp-landing .vita-panel{position:relative;background:color-mix(in srgb, var(--color-vita) 7%, #fff);border:1px solid color-mix(in srgb, var(--color-vita) 15%, #fff);border-radius:var(--r-lg);width:100%;max-width:320px;aspect-ratio:1;display:grid;place-items:center;overflow:hidden}
.rlp-landing .vita .coachpill{display:inline-block;background:var(--color-vita);color:#fff;font-size:12px;font-weight:700;letter-spacing:.02em;padding:6px 13px;border-radius:var(--r-sm);margin-bottom:16px}
.rlp-landing .vita h2{font-size:40px;margin-bottom:14px}
.rlp-landing .vita p{font-size:18px;color:var(--text);max-width:46ch;line-height:1.6}

/* what you'll build */
.rlp-landing .spotlight{background:var(--bg-alt)}
.rlp-landing .spotlight .wrap{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center}
.rlp-landing .spotlight .intro .eyebrow{display:block;margin-bottom:14px}
.rlp-landing .spotlight h2{font-size:40px;margin-bottom:16px}
.rlp-landing .spotlight .body{font-size:18px;color:var(--text);max-width:44ch;line-height:1.6}
.rlp-landing .inside{background:#fff;border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:var(--shadow-sm);padding:28px 30px;display:flex;flex-direction:column;gap:15px}
.rlp-landing .inside .cap{font-size:11.5px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:var(--text-muted);margin-bottom:2px}
.rlp-landing .inside .row{display:flex;align-items:center;gap:12px;font-size:16px;font-weight:500;color:var(--ink)}
.rlp-landing .inside .row .tick{width:24px;height:24px;border-radius:50%;background:var(--brand-primary);display:grid;place-items:center;flex-shrink:0}
.rlp-landing .inside .row .tick svg{width:12px;height:12px}

/* comparison */
.rlp-landing .compare{background:var(--ground-cream)}
.rlp-landing .compare .wrap{max-width:920px}
.rlp-landing .compare .sec-head{margin-bottom:40px}
.rlp-landing .cgrid{display:grid;grid-template-columns:1fr 1fr;gap:22px}
.rlp-landing .ccard{border-radius:var(--r-lg);padding:32px 30px}
.rlp-landing .ccard.without{background:#fff;border:1px solid var(--border)}
.rlp-landing .ccard.with{background:var(--ink)}
.rlp-landing .ccard h3{font-size:20px;margin-bottom:18px}
.rlp-landing .ccard.without h3{color:var(--text-muted)}
.rlp-landing .ccard.with h3{color:var(--chorus-lime)}
.rlp-landing .ccard ul{list-style:none;display:flex;flex-direction:column;gap:13px}
.rlp-landing .ccard li{font-size:16.5px;display:flex;gap:11px;align-items:flex-start}
.rlp-landing .ccard.without li{color:var(--text-muted)}
.rlp-landing .ccard.with li{color:rgba(255,255,255,.92)}
.rlp-landing .ccard li .m{flex-shrink:0;margin-top:2px;font-weight:700}
.rlp-landing .ccard.with li .m{color:var(--chorus-lime)}

/* closing */
.rlp-landing .closing{background:var(--ink);color:#fff;padding:72px 0}
.rlp-landing .closing .wrap{text-align:center;padding:0 32px}
.rlp-landing .closing .eyebrow{display:block;color:var(--chorus-lime);margin-bottom:14px}
.rlp-landing .closing h2{color:#fff;font-size:46px;margin-bottom:16px}
.rlp-landing .closing p{font-size:18px;color:rgba(255,255,255,.74);margin:0 auto 32px;max-width:48ch}
.rlp-landing .closing .btn-primary:focus-visible{box-shadow:var(--focus-ring-accent)}

/* footer */
.rlp-landing footer{background:var(--ink);color:#fff;border-top:1px solid rgba(255,255,255,.1);padding:26px 0}
.rlp-landing footer .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.rlp-landing footer .logo img{height:24px;width:auto;display:block}
.rlp-landing footer .logo:focus-visible{outline:none;box-shadow:var(--focus-ring-accent);border-radius:var(--r-sm)}
.rlp-landing footer .fmeta{font-size:13.5px;color:rgba(255,255,255,.7);display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.rlp-landing footer .fmeta a{color:rgba(255,255,255,.7)}
.rlp-landing footer .fmeta a:hover{color:#fff;text-decoration:underline}
.rlp-landing footer .fmeta a:focus-visible{outline:none;box-shadow:var(--focus-ring-accent);border-radius:var(--r-sm)}
.rlp-landing footer .fmeta .sep{opacity:.45}

@media(max-width:940px){
  .rlp-landing .hero .wrap,.rlp-landing .spotlight .wrap,.rlp-landing .vita .wrap{grid-template-columns:1fr;gap:44px}
  .rlp-landing .vita-panel{justify-self:center}
  .rlp-landing .hero h1{font-size:42px}
  .rlp-landing .stage{height:440px}
  .rlp-landing .steps,.rlp-landing .inside,.rlp-landing .cgrid{grid-template-columns:1fr}
  .rlp-landing .sec-head h2,.rlp-landing .vita h2,.rlp-landing .spotlight h2{font-size:33px}
  .rlp-landing .closing h2{font-size:35px}
  .rlp-landing section{padding:68px 0}
  .rlp-landing .journey{padding:68px 0}
  .rlp-landing .journey .sec-head h2{font-size:33px}
}
/* Journey collapses to a vertical timeline: circle left, text right, vertical
   connector. Tabs stay on top. */
@media(max-width:700px){
  .rlp-landing .jrow{grid-template-columns:1fr;gap:0;max-width:480px;margin:0 auto}
  .rlp-landing .jnode{display:grid;grid-template-columns:52px 1fr;gap:18px;text-align:left;align-items:start;padding:0 0 30px}
  .rlp-landing .jnum{margin:0}
  .rlp-landing .jnode:not(:last-child)::after{top:52px;left:26px;transform:translateX(-1px);width:2px;height:100%}
  .rlp-landing .jbody{padding-top:6px}
  .rlp-landing .jdesc{max-width:none;margin:0}
}
@media(max-width:600px){
  .rlp-landing .wrap{padding:0 20px}
  .rlp-landing nav .wrap{height:64px}
  .rlp-landing .logo img{height:26px}
  .rlp-landing .navcta{gap:10px}
  .rlp-landing .navcta .login{font-size:14px}
  .rlp-landing .btn-sm{padding:10px 15px}
  .rlp-landing .hero .wrap{padding-top:40px;padding-bottom:46px}
  .rlp-landing .hero h1{font-size:33px}
  .rlp-landing .hero .lede{font-size:18px}
  /* Plan card into normal flow so its panel grows with content and dots sit below. */
  .rlp-landing .stage{height:auto;min-height:280px}
  .rlp-landing .plan{position:relative;left:auto;top:auto;transform:none;margin:22px auto;width:min(340px,calc(100% - 36px));z-index:1;padding:22px 22px 18px}
  .rlp-landing .plan .vision{font-size:19px;min-height:0}
  .rlp-landing .dots{position:relative;left:auto;bottom:auto;transform:none;justify-content:center;margin:0 0 22px;z-index:1}
  .rlp-landing .sec-head h2,.rlp-landing .vita h2,.rlp-landing .spotlight h2,.rlp-landing .closing h2{font-size:29px}
  .rlp-landing .inside{padding:26px 22px;gap:16px}
  .rlp-landing .ccard{padding:26px 24px}
  .rlp-landing section{padding:54px 0}
  .rlp-landing .journey{padding:54px 0}
  .rlp-landing .journey .sec-head h2{font-size:29px}
  .rlp-landing .jtab{padding:11px 16px;font-size:14px}
}
@media(prefers-reduced-motion:reduce){
  .rlp-landing .plan-inner{transition:none}
  .rlp-landing .btn,.rlp-landing .dots button{transition:none}
  .rlp-landing .jrow,.rlp-landing .jtab{transition:none}
}
`;
