"use client";

// The in-app "How it works" help page (authenticated). Content, copy, section
// order and FAQs are the approved mock (chorus-how-it-works-page-v4.html), rebuilt
// in the real system: semantic tokens (never raw hex), next/font serif/sans via
// --font-serif/--font-sans, the shared VitaMark for Vita's disc, and the
// stage-colour tokens for the five stage dots. Styles are scoped under .rlp-hiw so
// the replicated reference styles don't leak into other routes — the same
// convention HomeDashboard uses.
//
// The "Your privacy" panel and the data / AI-training FAQs are reproduced verbatim
// from the mock; that copy is worded deliberately and final data/consent sign-off
// is still pending. "sessions" throughout, never "module".

import Link from "next/link";
import VitaMark from "./VitaMark";

// The external privacy page (the marketing site's privacy.html) — there's no
// in-app privacy route yet, so "Privacy & data" points here.
const PRIVACY_URL = "https://chorus-life.com/privacy.html";
const SUPPORT_EMAIL = "hello@chorus-life.com";

// The five stages, tagged with their stage number so the dot pulls its own
// wayfinding colour (blue / yellow / pink / orange / green) with a readable
// foreground, straight from the stage tokens.
const STAGES = [
  {
    n: 1,
    name: "Imagine · or Review",
    desc: "Picture what your retirement might look like — or, if you're already retired, review how it's gone and imagine what's next.",
  },
  {
    n: 2,
    name: "Explore",
    desc: "Explore what a balanced retirement looks like — health, people, purpose.",
  },
  { n: 3, name: "Understand", desc: "Get clear on what matters most to you." },
  {
    n: 4,
    name: "Plan",
    desc: "Bring it all together into your Retirement Life Plan — goals, timing and next steps.",
  },
  {
    n: 5,
    name: "Act",
    desc: "Put your plan into action, with support to take the first steps.",
  },
];

const FAQS = [
  {
    q: "How long does each session take?",
    a: "Most sessions take somewhere between 5 and 20 minutes. Do a couple at a time at most, and try to leave a little space between them so each has room to settle.",
  },
  {
    q: "Do I have to do the sessions in order?",
    a: "Yes — Chorus takes you through one session at a time, in order, with each opening once you've finished the last. That way every stage builds on the one before.",
  },
  {
    q: "Can I change something I said earlier?",
    a: "Yes, in three ways: tell Vita mid-conversation that something isn't right; reopen a finished session with “Want to add something? Keep talking”; or use “Restart this session” to begin it again. Your plan updates to match.",
  },
  {
    q: "What if I don't know how to answer?",
    a: "There are no wrong answers. Say whatever comes to mind, or tell Vita you're not sure — it'll help you think it through at your own pace.",
  },
  {
    q: "Who is Vita?",
    a: "Vita is your coach through Chorus — an AI, not a person. It asks questions, listens, and reflects back what it hears so your plan stays in your own words. Because it's AI it can occasionally misunderstand, which is why it checks with you and lets you correct it any time. Your conversations stay private to you, and aren't used to train Vita or any other AI unless you choose to share them at the end.",
  },
  {
    q: "What do I end up with?",
    a: "When you finish Stage 4, your answers come together into your Retirement Life Plan — a personal plan for the life you want after work, which you can read, revisit and download. Stage 5 (Act) then helps you put it into action.",
  },
  {
    q: "Stage 5 looks almost empty — is that right?",
    a: "Yes — and it means you've done the hard part. Reaching Stage 5 means your Retirement Life Plan is complete. During the pilot, Stage 5 (Act) is deliberately light: if you have a partner, you'll find a session for exploring your plans together — and more ways to help you put your plan into action are on their way. For now, take a moment to enjoy what you've built.",
  },
  {
    q: "Stage 5 looks empty — is that right?",
    a: "Yes — and it's good news: it means you've completed your Retirement Life Plan. Stage 5 (Act) is where you'll put that plan into action, and we're still building it out during the pilot. For now it holds one optional session, for those with a partner, with more to come. So a quiet Stage 5 simply means you've reached the end of what's ready today — well done!",
  },
  {
    q: "Can anyone at Chorus see what I share?",
    a: "Not unless you choose to let us. What you type and your conversations with Vita stay private to you. When you finish, you'll be offered the option to share them to help improve Chorus — and only then could our team see them.",
  },
  {
    q: "Is my information used to train the AI?",
    a: "No. What you type and your conversations with Vita aren't used to train Vita or any other AI — unless you choose, at the end, to share them with us to help improve Chorus. That choice is entirely yours.",
  },
];

export default function HowItWorks() {
  return (
    <main className="rlp-hiw">
      <style>{hiwCss}</style>

      {/* Back link — matches the session page's "← Your sessions" convention. */}
      <div className="hiw-nav">
        <Link href="/home" className="hiw-back">
          ← Back to home
        </Link>
      </div>

      <div className="doc">
        {/* INTRO */}
        <div className="intro">
          <span className="eyebrow">Help &amp; guidance</span>
          <h1>How Chorus works</h1>
          <p className="lead">
            Chorus helps you design the life you want after work, one short
            session at a time. Your answers build, stage by stage, into your own
            Retirement Life Plan — and there are no wrong answers along the way.
            Here&rsquo;s what to expect, with common questions at the end.
          </p>
        </div>

        {/* WHAT HAPPENS IN A SESSION */}
        <section className="block">
          <h2>What happens in a session</h2>
          <div className="steps">
            <div className="stepc">
              <div className="n">1</div>
              <div>
                <div className="lead">A short introduction</div>
                <div className="body">
                  Each session opens with a little scene-setting — usually a short
                  read, sometimes a two-minute video — so it&rsquo;s easy to step
                  in.
                </div>
              </div>
            </div>
            <div className="stepc">
              <div className="n">2</div>
              <div>
                <div className="lead">Something to react to</div>
                <div className="body">
                  You won&rsquo;t face a blank page. Mostly you&rsquo;ll tap to
                  choose what fits, and type only if you&rsquo;d like to add more
                  in your own words.
                </div>
              </div>
            </div>
            <div className="stepc">
              <div className="n">3</div>
              <div>
                <div className="lead">A conversation with Vita</div>
                <div className="body">
                  Vita asks, listens, and reflects back what it&rsquo;s
                  understood. If it&rsquo;s got something wrong, you put it right.
                  Nothing goes into your plan unless it sounds like you.
                </div>
              </div>
            </div>
            <div className="stepc">
              <div className="n">4</div>
              <div>
                <div className="lead">Saved to your plan</div>
                <div className="body">
                  Your answers are gathered as you go, quietly building into your
                  Retirement Life Plan.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PACING */}
        <section className="block">
          <div className="pace">
            <h2>There&rsquo;s no wrong way to do this</h2>
            <p>
              Take your time — each session is meant to be enjoyable and
              reflective. Do a couple at a time at most, and leave a little space
              between them so each has room to settle. There are no wrong answers,
              and you can always go back over something you&rsquo;ve already done.
            </p>
          </div>
        </section>

        {/* THE FIVE STAGES */}
        <section className="block">
          <h2>The five stages</h2>
          <p className="block-lead">
            You move through the stages in order — each one opens when you&rsquo;ve
            finished the one before.
          </p>
          <div className="stages">
            {STAGES.map((s) => (
              <div key={s.n} className="srow">
                <div
                  className="dot"
                  style={{
                    background: `var(--color-stage-${STAGE_KEY[s.n - 1]})`,
                    color: `var(--color-on-stage-${STAGE_KEY[s.n - 1]})`,
                  }}
                >
                  {s.n}
                </div>
                <div>
                  <div className="nm">{s.name}</div>
                  <div className="ds">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="stage-note">
            Your Retirement Life Plan comes together when you complete Stage 4.
            From then on you can read and download it — and Stage 5 helps you put
            it into action.
          </p>
        </section>

        {/* MEET VITA */}
        <section className="block">
          <div className="vita">
            <div className="top">
              <VitaMark size={48} className="disc" />
              <div>
                <div className="nm">Vita</div>
                <div className="role">Your retirement coach</div>
              </div>
            </div>
            <p>
              Vita is your coach through Chorus — an AI, not a person. It&rsquo;s
              here to help you reflect, not to test you. What you share with Vita
              is private to you, and it&rsquo;s never used to train Vita or any
              other AI (more on that below).
            </p>
            <p>A few things worth knowing:</p>
            <ul>
              <li>
                <span className="t">•</span>
                <span>
                  <b>Take your time.</b>{" "}Vita is happy to wait, and there&rsquo;s
                  no clock running.
                </span>
              </li>
              <li>
                <span className="t">•</span>
                <span>
                  <b>Not sure how to answer?</b>{" "}Say so — Vita will help you think
                  it through.
                </span>
              </li>
              <li>
                <span className="t">•</span>
                <span>
                  <b>You&rsquo;re in charge.</b>{" "}Ask Vita to slow down, go deeper,
                  or move on whenever you like.
                </span>
              </li>
              <li>
                <span className="t">•</span>
                <span>
                  <b>If it gets something wrong, just say so.</b>{" "}Vita will update
                  it, and nothing is set until it sounds like you.
                </span>
              </li>
            </ul>
            <p className="vita-after">
              Because it&rsquo;s AI, Vita can occasionally misunderstand — so it
              always checks its understanding with you, and you can put it right
              any time.
            </p>
          </div>
        </section>

        {/* CHANGING SOMETHING */}
        <section className="block">
          <h2>Changed your mind about something?</h2>
          <p className="block-lead">
            Nothing you say is fixed. There are three ways to go back over an
            answer:
          </p>
          <ul className="ways">
            <li>
              <span className="t">•</span>
              <span>
                <b>Just tell Vita.</b>{" "}Mid-conversation, say something like
                &ldquo;actually, that&rsquo;s not quite right&rdquo; — Vita will
                update it there and then.
              </span>
            </li>
            <li>
              <span className="t">•</span>
              <span>
                <b>Keep talking.</b>{" "}After a session ends, tap &ldquo;Want to add
                something? Keep talking&rdquo; to reopen the conversation and add
                or change what you said.
              </span>
            </li>
            <li>
              <span className="t">•</span>
              <span>
                <b>Restart the session.</b>{" "}Inside any session, &ldquo;Restart
                this session&rdquo; lets you begin it again from the start.
              </span>
            </li>
          </ul>
        </section>

        {/* YOUR PRIVACY — reproduced verbatim; data/consent sign-off pending. */}
        <section className="block">
          <div className="privacy">
            <h2>Your privacy</h2>
            <p>This is personal, so here&rsquo;s exactly how your information is handled.</p>
            <p>
              Everything you type, and every conversation you have with Vita, is
              used to build your plan — but it stays private to you.{" "}
              <b>
                No one on the Chorus Life team can read it, and it is never used to
                train Vita or any other AI.
              </b>
            </p>
            <p>
              There&rsquo;s one exception, and it&rsquo;s entirely your choice.
              When you finish, you&rsquo;ll be offered the option to share your
              responses with us to help improve Chorus. Only if you say yes can our
              team see them — if you&rsquo;d rather not, that&rsquo;s completely
              fine, and it makes no difference to your plan.
            </p>
            <p className="more">
              Full detail lives on the{" "}
              <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
                Privacy &amp; data
              </a>{" "}
              page.
            </p>
          </div>
        </section>

        {/* GOOD TO KNOW */}
        <section className="block">
          <h2>Good to know</h2>
          <dl className="gtk">
            <div className="grow">
              <dt>Saving &amp; returning</dt>
              <dd>
                Your progress saves as you go. Stop any time and pick up where you
                left off.
              </dd>
            </div>
            <div className="grow">
              <dt>Your Retirement Life Plan</dt>
              <dd>
                It comes together when you finish Stage 4. From then on you can read
                it and download it as a PDF; Stage 5 helps you put it into action.
              </dd>
            </div>
            <div className="grow">
              <dt>Getting help</dt>
              <dd>
                Stuck, or something not working? Email{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>{" "}
                and we&rsquo;ll help.
              </dd>
            </div>
          </dl>
        </section>

        {/* FAQs */}
        <section className="block">
          <h2>Frequently asked questions</h2>
          <div className="faq">
            {FAQS.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <div className="fa">{f.a}</div>
              </details>
            ))}
          </div>
        </section>

        {/* FOOTER HELP */}
        <div className="help-foot">
          <Link className="btn" href="/home">
            ← Back to home
          </Link>
          <div className="sup">
            Still need a hand? Email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </div>
        </div>
      </div>
    </main>
  );
}

// Maps a 1–5 stage number to its colour-token key (mirrors STAGE_KEYS in
// lib/stageColors.ts — kept local so the dot styles read inline above).
const STAGE_KEY = ["imagine", "explore", "understand", "plan", "act"] as const;

const hiwCss = `
.rlp-hiw{background:var(--bg-alt);min-height:calc(100vh - var(--header-h));color:var(--text)}
.rlp-hiw a{color:var(--brand-primary);font-weight:600;text-decoration:none}
.rlp-hiw a:hover{text-decoration:underline}
.rlp-hiw h1,.rlp-hiw h2,.rlp-hiw h3{font-family:var(--font-serif);color:var(--ink);font-weight:600;line-height:1.15;letter-spacing:-.01em}
.rlp-hiw :focus-visible{outline:none;box-shadow:var(--focus-ring);border-radius:var(--r-sm)}

/* Back link row — matches the session page's desktop back nav. */
.rlp-hiw .hiw-nav{max-width:760px;margin:0 auto;padding:20px 28px 0}
.rlp-hiw .hiw-back{display:inline-flex;align-items:center;font-family:var(--font-sans);font-size:var(--fs-sm);font-weight:600;color:var(--brand-primary);padding:8px 4px;min-height:44px}
.rlp-hiw .hiw-back:hover{text-decoration:underline}

.rlp-hiw .doc{max-width:760px;margin:0 auto;padding:32px 28px 90px}

/* intro */
.rlp-hiw .eyebrow{font-size:11.5px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:var(--brand-primary)}
.rlp-hiw .intro .eyebrow{display:block;margin-bottom:14px}
.rlp-hiw .intro h1{font-size:40px;margin-bottom:16px;line-height:1.1}
.rlp-hiw .intro .lead{font-size:19px;color:var(--text);max-width:58ch}

.rlp-hiw .block{margin-top:56px}
.rlp-hiw .block h2{font-size:27px;margin-bottom:20px}
.rlp-hiw .block-lead{font-size:16px;color:var(--text);margin-bottom:20px;max-width:58ch}

/* numbered steps */
.rlp-hiw .steps{display:flex;flex-direction:column;gap:0;border:1px solid var(--border);border-radius:var(--r-lg);background:var(--surface);overflow:hidden;box-shadow:var(--shadow-sm)}
.rlp-hiw .stepc{display:grid;grid-template-columns:40px 1fr;gap:16px;align-items:start;padding:20px 24px}
.rlp-hiw .stepc + .stepc{border-top:1px solid var(--border)}
.rlp-hiw .stepc .n{width:40px;height:40px;border-radius:50%;background:var(--brand-primary);color:var(--brand-on-primary);display:grid;place-items:center;font-weight:700;font-size:15px}
.rlp-hiw .stepc .lead{font-size:16.5px;font-weight:600;color:var(--ink);margin-bottom:3px;font-family:var(--font-sans)}
.rlp-hiw .stepc .body{font-size:15.5px;color:var(--text-muted)}

/* pacing card */
.rlp-hiw .pace{background:var(--success-surface);border:1px solid color-mix(in srgb,var(--chorus-green) 18%,#fff);border-radius:var(--r-lg);padding:26px 28px}
.rlp-hiw .pace h2{font-size:22px;margin-bottom:8px}
.rlp-hiw .pace p{font-size:16px;color:var(--text);max-width:58ch}

/* stages recap */
.rlp-hiw .stages{display:flex;flex-direction:column;gap:2px}
.rlp-hiw .srow{display:grid;grid-template-columns:34px 1fr;gap:16px;align-items:baseline;padding:15px 4px;border-bottom:1px solid var(--border)}
.rlp-hiw .srow:last-child{border-bottom:none}
.rlp-hiw .srow .dot{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:14px;align-self:center}
.rlp-hiw .srow .nm{font-family:var(--font-serif);font-size:18px;font-weight:600;color:var(--ink)}
.rlp-hiw .srow .ds{font-size:15px;color:var(--text-muted)}
.rlp-hiw .stage-note{margin-top:16px;font-size:14.5px;color:var(--text-muted)}

/* vita */
.rlp-hiw .vita{background:var(--warm-surface);border:1px solid var(--warm-line);border-radius:var(--r-lg);padding:28px}
.rlp-hiw .vita .top{display:flex;align-items:center;gap:13px;margin-bottom:14px}
.rlp-hiw .vita .disc{width:48px;height:48px}
.rlp-hiw .vita .nm{font-family:var(--font-serif);font-size:19px;font-weight:600;color:var(--color-vita)}
.rlp-hiw .vita .role{font-size:13px;color:var(--text-muted);font-weight:600}
.rlp-hiw .vita > p{font-size:16px;color:var(--text);margin-bottom:16px;max-width:58ch}
.rlp-hiw .vita .vita-after{font-size:15px;color:var(--text-muted);margin:18px 0 0;padding-top:16px;border-top:1px solid var(--warm-line);max-width:58ch}
.rlp-hiw .vita ul{list-style:none;display:flex;flex-direction:column;gap:10px;padding:0;margin:0}
.rlp-hiw .vita li{display:grid;grid-template-columns:20px 1fr;gap:11px;font-size:15.5px;color:var(--text)}
.rlp-hiw .vita li .t{color:var(--brand-primary);font-weight:700}
.rlp-hiw .vita li b{color:var(--ink);font-weight:600}

/* ways to go back */
.rlp-hiw .ways{list-style:none;display:flex;flex-direction:column;gap:14px;padding:0;margin:0}
.rlp-hiw .ways li{display:grid;grid-template-columns:20px 1fr;gap:12px;font-size:16px;color:var(--text)}
.rlp-hiw .ways li .t{color:var(--brand-primary);font-weight:700}
.rlp-hiw .ways li b{color:var(--ink);font-weight:600}

/* privacy card */
.rlp-hiw .privacy{background:var(--success-surface);border:1px solid color-mix(in srgb,var(--chorus-green) 20%,#fff);border-radius:var(--r-lg);padding:28px 30px}
.rlp-hiw .privacy h2{font-size:24px;margin-bottom:12px}
.rlp-hiw .privacy p{font-size:16px;color:var(--text);max-width:60ch;margin-bottom:12px}
.rlp-hiw .privacy p:last-of-type{margin-bottom:0}
.rlp-hiw .privacy .more{margin-top:14px;font-size:14.5px;color:var(--text-muted)}

/* good to know */
.rlp-hiw .gtk{border:1px solid var(--border);border-radius:var(--r-lg);background:var(--surface);overflow:hidden;box-shadow:var(--shadow-sm);margin:0}
.rlp-hiw .grow{display:grid;grid-template-columns:200px 1fr;gap:20px;padding:16px 24px}
.rlp-hiw .grow + .grow{border-top:1px solid var(--border)}
.rlp-hiw .grow dt{font-size:15.5px;font-weight:600;color:var(--ink)}
.rlp-hiw .grow dd{font-size:15.5px;color:var(--text-muted);margin:0}

/* faqs */
.rlp-hiw .faq{border-top:1px solid var(--border)}
.rlp-hiw .faq details{border-bottom:1px solid var(--border)}
.rlp-hiw .faq summary{list-style:none;cursor:pointer;padding:18px 2px;font-weight:600;font-size:17px;color:var(--ink);display:flex;justify-content:space-between;align-items:center;gap:18px;min-height:44px}
.rlp-hiw .faq summary::-webkit-details-marker{display:none}
.rlp-hiw .faq summary::after{content:"+";font-size:24px;line-height:1;color:var(--brand-primary);font-weight:400}
.rlp-hiw .faq details[open] summary::after{content:"\\2013"}
.rlp-hiw .faq .fa{padding:0 2px 20px;font-size:15.5px;color:var(--text-muted);max-width:62ch}

/* footer help */
.rlp-hiw .help-foot{margin-top:64px;text-align:center;padding-top:36px;border-top:1px solid var(--border)}
.rlp-hiw .help-foot .btn{display:inline-flex;align-items:center;gap:8px;background:var(--brand-primary);color:var(--brand-on-primary);font-family:var(--font-sans);font-weight:600;font-size:16px;border:none;border-radius:var(--r-sm);padding:14px 24px;min-height:48px;text-decoration:none}
.rlp-hiw .help-foot .btn:hover{background:var(--brand-primary-hover);text-decoration:none}
.rlp-hiw .help-foot .sup{margin-top:16px;font-size:14px;color:var(--text-muted)}

@media (max-width:600px){
  .rlp-hiw .doc{padding:24px 22px 68px}
  .rlp-hiw .hiw-nav{padding:16px 22px 0}
  .rlp-hiw .intro h1{font-size:32px}
  .rlp-hiw .block{margin-top:44px}
  .rlp-hiw .block h2{font-size:23px}
  .rlp-hiw .privacy{padding:24px 22px}
  .rlp-hiw .grow{grid-template-columns:1fr;gap:3px}
}
`;
