/* eslint-disable react/no-unescaped-entities -- this is a long prose document;
   escaping every apostrophe and quote as an HTML entity would make the copy hard
   to read and edit. The straight ' and " render correctly in JSX text. */
import type { Metadata } from "next";
import Link from "next/link";
import styles from "./privacy.module.css";

// The app's privacy notice. Public (added to the proxy.ts matcher) so it can be
// read without signing in, and linked from the onboarding consent step and the
// account screen. Rendered as a standalone document — the global MobileAppBar
// and FeedbackButton opt out of this route so the page reads as a plain notice.
// robots noindex is inherited from the root layout (the app domain stays out of
// search during the pilot).

export const metadata: Metadata = {
  title: "Privacy Notice — Vita",
};

export default function PrivacyPage() {
  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <Link className={styles.back} href="/">
          &larr; Back to home
        </Link>
      </div>

      <main className={styles.main}>
        <div className={styles.titleBlock}>
          <h1>Privacy Notice</h1>
          <p className={styles.updated}>Last updated: 17 July 2026</p>
        </div>

        <p className={styles.intro}>
          This notice explains how we handle the personal information you share while using Vita, our
          retirement life-planning companion, during our friends-and-family pilot. It sits alongside
          our <a href="https://chorus-life.com/privacy">website privacy policy</a>, which covers the
          chorus-life.com site — this one covers the app itself.
        </p>

        <p>
          Chorus Life Ltd (company number 16969483, registered at Applemead South Drive, Littleton,
          Winchester, England, SO22 6PY) is the data controller for the information described here. If
          you have any questions, email us at{" "}
          <span className={styles.contactEmail}>hello@chorus-life.com</span>. We have not appointed a
          data protection officer, as we do not consider that the scale of our processing requires one
          at this stage.
        </p>

        <h2>What Vita is</h2>
        <p>
          Vita is an AI companion that guides you through a structured programme to think about your
          retirement. It asks questions, reflects back what it hears, and helps you build a plan. It
          is not a person, and it is not a financial, legal, or medical adviser. Everything it produces
          is for you to review.
        </p>

        <h2>What we collect</h2>
        <p>When you take part in the pilot, we collect:</p>
        <ul>
          <li>
            <strong>Your account details</strong> — your name and email address, used to sign you in,
            and a preferred name if you give one.
          </li>
          <li>
            <strong>Your date of birth</strong>, if you choose to share it. We use it to understand
            roughly how far you are from retirement, and it forms part of the baseline information
            described below.
          </li>
          <li>
            <strong>What you tell Vita</strong> — your answers, reflections, and the things you share
            in conversation as you work through the programme, along with the plan and any images the
            programme creates for you.
          </li>
          <li>
            <strong>A profile Vita builds</strong> — as you go, Vita notes specific things you've said
            (your values, hopes, roles, and goals) so it can join them up and personalise your plan.
            This can include your own words.
          </li>
          <li>
            <strong>A short baseline survey</strong> at the start — some optional details about you
            (such as your gender, your work or retirement status, whether you have a partner, and how
            far off retirement is), how you're feeling about retirement, how much planning you've
            already done, how confident you feel, and what you're hoping to get from the programme.
            Every question is optional.
          </li>
          <li>
            <strong>Feedback on each session</strong> — how it went, whether anything didn't work, and
            any comments you'd like to share.
          </li>
          <li>
            <strong>How you use the programme</strong> — which sessions you do, how long you actively
            spend on each, and when you start and finish them.
          </li>
          <li>
            <strong>Health and other sensitive information</strong> — see the section below.
          </li>
          <li>
            <strong>Basic usage analytics</strong> — aggregate, anonymous information about page
            visits, described under "Cookies".
          </li>
        </ul>

        <h2>Health and other sensitive information</h2>
        <p>
          Some of what the programme covers is more sensitive than the rest. Vita asks about things
          like your energy, sleep, eating, recovery, how ready you feel for retirement, and your
          hearing and eyesight — some of which counts as health information, which the law treats with
          extra care. The baseline survey and session feedback also ask how you're feeling about
          retirement and how each session lands for you emotionally.
        </p>
        <p>
          Because of that, we ask for your explicit agreement before you begin, and we keep a record of
          it (including which version of this wording you agreed to). We use this information only to
          tailor your plan and to understand and improve the programme. You can withdraw your
          agreement, and ask that we delete this information, at any time by emailing
          hello@chorus-life.com. Alternatively, you can use the delete option in your account.
          Withdrawing your agreement does not affect the lawfulness of any processing we carried out
          before you withdrew it.
        </p>

        <h2>Will a person read what I share?</h2>
        <p>
          There are two different kinds of information here, and we treat them differently — we want to
          be clear about which is which.
        </p>
        <p className={styles.leadPara}>
          <strong>Your conversations with Vita stay between you and Vita.</strong> Your answers within
          the programme, the things you tell Vita, and the profile Vita builds from them are not
          visible to our team. Vita uses them automatically to guide you and build your plan; no one
          here reads them.
        </p>
        <p className={styles.leadPara}>
          <strong>Your survey, feedback, and usage information is visible to our team.</strong> So we
          can understand how the programme is working and make it better, our team can see the baseline
          details you gave (including age, gender, and retirement status), your session feedback and
          any problems you report, and how you moved through the programme — which sessions you did,
          how long you spent, and when you finished. We look at this to learn from the pilot, not to
          check up on anyone.
        </p>
        <p className={styles.leadPara}>
          <strong>How we identify you to our team.</strong> The app doesn't show our team your name or
          email — it shows an account ID instead. We could connect that ID back to your email if we
          needed to, so this is us choosing not to put your name in front of the team, rather than us
          being unable to identify you. We'd rather tell you that plainly than imply your responses are
          anonymous when they aren't.
        </p>

        <h2>How we use your information</h2>
        <p>
          We use it to run the programme for you, build and personalise your plan, respond to you, and
          understand how the pilot is going so we can improve Vita. We don't sell your information or
          share it for anyone else's marketing. Anything we share more widely to describe what we
          learned from the pilot uses aggregated, de-identified information only.
        </p>

        <h2>Our legal basis</h2>
        <p>
          We rely on your consent as our legal basis to process your personal information for the
          pilot. You can withdraw your consent at any time. For health-related and other sensitive
          personal information (known in law as "special category data"), we rely on your explicit
          consent. The baseline survey and feedback are optional, and we rely on your consent to use
          them to improve the programme. For basic usage analytics, we rely on our legitimate interest
          in understanding how the programme works; this data is aggregate and anonymous (see
          "Cookies").
        </p>

        <h2>AI and automated processing</h2>
        <p>
          Vita uses AI (see "Who we share it with") to interpret what you tell it and shape the
          programme around you. Specifically, Vita uses large language models to analyse your
          responses, identify themes in what you share (such as your values, concerns and goals), and
          generate personalised reflections and plan content based on those themes. It's built around a
          simple principle — Vita interprets, and you confirm: you review the plan it builds for you
          and can shape what goes into it. We don't make any decision about you that has a legal or
          similarly significant effect by automated means alone.
        </p>

        <h2>Who we share it with</h2>
        <p>
          We use a small number of trusted technology providers to run Vita. They process your
          information only on our instructions:
        </p>
        <ul>
          <li>
            <strong>Clerk</strong> — signs you in securely.
          </li>
          <li>
            <strong>Neon</strong> and <strong>Vercel</strong> — host the app and store your
            information (in London).
          </li>
          <li>
            <strong>Anthropic</strong> — provides the Claude AI that powers Vita's conversations. Under
            our agreement, Anthropic does not use your content to train its models.
          </li>
          <li>
            <strong>OpenAI</strong> — generates the images in your plan.
          </li>
          <li>
            <strong>Resend</strong> — delivers email between us.
          </li>
          <li>
            <strong>YouTube</strong> — serves the videos in the programme, in privacy-enhanced mode (no
            tracking cookies unless you play a video).{" "}
            <span className={styles.note}>
              When you play a video, YouTube (Google) acts as a separate controller for any data it
              collects through playback, not as a processor acting on our instructions.
            </span>
          </li>
        </ul>
        <p>
          Some of these providers process information outside the UK. Where information is transferred
          outside the UK, we ensure that it is protected by appropriate safeguards, such as the UK's
          standard data protection clauses.
        </p>
        <p>We use encryption, access controls, and secure hosting to protect your information.</p>

        <h2>How long we keep it</h2>
        <p>
          We keep your information while the pilot is running and until you ask us to delete it, and
          we'll delete or return it at the end of the pilot in line with the choice we'll offer you
          then. We currently expect the pilot to conclude by 31 August 2026. If you do not make a
          choice, we will delete your information within 30 days of the pilot ending.
        </p>
        <p>
          You can delete everything yourself at any time using the link{" "}
          <a href="https://app.chorus-life.com/delete-account">app.chorus-life.com/delete-account</a>.
          That removes your answers, your conversations, the profile Vita built, your feedback and
          survey responses, your usage data, and your account.
        </p>
        <p>
          If you choose "start over" instead, that clears your answers, conversations, and the profile
          Vita built, but keeps your survey answers and feedback, and de-identifies your usage data so
          it can no longer be traced back to you. This retained data will be processed on the basis of
          your original consent, unless you withdraw it.
        </p>

        <h2>Data protection impact assessment</h2>
        <p>
          Because this pilot involves the use of AI and the processing of sensitive personal
          information, we have carried out a data protection impact assessment to identify and minimise
          risks to your privacy. This assessment is kept under review as the pilot develops.
        </p>

        <h2>Your rights</h2>
        <p>
          Under UK data protection law you can ask to access, correct, delete, or receive a portable
          copy of your information in a commonly used format, object to or restrict how we use it, and
          withdraw your consent at any time. To do any of these, email hello@chorus-life.com. You can
          also complain to Chorus Life as the controller of your personal information
          (hello@chorus-life.com) or to the Information Commissioner's Office (
          <a href="https://ico.org.uk">ico.org.uk</a>).
        </p>

        <h2>Cookies</h2>
        <p>
          Vita uses only the essential cookies needed to keep you signed in. We don't use advertising
          or tracking cookies. We use basic usage analytics to see how people move through the
          programme; these are cookieless and don't identify you.
        </p>

        <h2>This pilot is for adults</h2>
        <p>Vita is for people planning their retirement and isn't intended for anyone under 18.</p>

        <h2>Changes</h2>
        <p>If we change this notice, we'll post the updated version here with a new date.</p>

        <h2>Contact</h2>
        <p>
          Questions about this notice or your information:{" "}
          <span className={styles.contactEmail}>hello@chorus-life.com</span>
        </p>
      </main>

      <footer className={styles.footer}>
        Chorus Life Ltd · Registered in England &amp; Wales, company number 16969483
      </footer>
    </div>
  );
}
