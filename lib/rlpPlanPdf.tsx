// The downloadable keepsake — the second rendering of the one RlpPlan data model.
//
// Where the in-app document is the LIVING version (interactive lenses, editable
// drafts), this is the calm, STILL keepsake: the same sections in the same fixed
// order, in a quiet narrative presentation, paginated for print. Imagery appears
// here too. Built with @react-pdf/renderer and rendered to a buffer by
// app/api/plan-pdf/route.ts. Built-in PDF fonts (Times / Helvetica) stand in for
// the app's Source Serif / Inter so generation never depends on a font fetch.

import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { RlpPlan, PlanArea, PlanGoal } from "@/lib/rlpPlan";
import { seasonLabel43 } from "@/lib/rlpPlan";
import type { BalancedAreaId } from "@/lib/modules";

// React-PDF can't read CSS variables, so the Chorus palette is mirrored here as
// literal hex. Keep these in step with the semantic tokens in app/tokens.css:
// ink = --color-text-primary, brand = --color-brand-primary, accent = --accent.
const C = {
  ink: "#0A322D",
  text: "#3A3D44",
  muted: "#7C7F86",
  faint: "#A6A8AE",
  accent: "#DC6437",
  navy: "#0A322D",
  warm: "#FBF7EC",
  warmLine: "#EFE6D2",
  line: "#E9E9E4",
};

const AREA_FG: Record<BalancedAreaId, string> = {
  restore: "#0A5544",
  move: "#2C5A1A",
  think: "#463C8C",
  connect: "#0C447C",
  contribute: "#6B5310",
};

const s = StyleSheet.create({
  page: {
    paddingTop: 54,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: "Helvetica",
    fontSize: 10.5,
    lineHeight: 1.5,
    color: C.text,
  },
  // cover
  coverHero: { width: "100%", height: 150, borderRadius: 8, marginBottom: 26, objectFit: "cover" },
  eyebrow: { fontFamily: "Helvetica-Bold", fontSize: 8, letterSpacing: 2, color: C.faint, textTransform: "uppercase", marginBottom: 8 },
  chapterTitle: { fontFamily: "Times-Bold", fontSize: 30, color: C.ink, lineHeight: 1.15, marginBottom: 22 },
  overview: { fontFamily: "Times-Roman", fontSize: 13, lineHeight: 1.55, color: C.ink, marginBottom: 14, maxWidth: 440 },
  insight: { fontFamily: "Times-Italic", fontSize: 12.5, lineHeight: 1.5, color: C.accent, marginBottom: 16, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: C.accent, maxWidth: 430 },
  introFrame: { fontSize: 10, color: C.muted, marginBottom: 12, maxWidth: 420 },
  introDraft: { backgroundColor: C.warm, borderRadius: 8, padding: 12, marginBottom: 9 },
  introTag: { fontFamily: "Helvetica-Bold", fontSize: 7.5, letterSpacing: 1.5, color: C.faint, textTransform: "uppercase", marginBottom: 4 },
  introText: { fontFamily: "Times-Italic", fontSize: 13, color: C.ink, lineHeight: 1.4 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line },
  metaItem: { marginRight: 34, marginBottom: 6 },
  metaDt: { fontFamily: "Helvetica-Bold", fontSize: 7.5, letterSpacing: 1.5, color: C.faint, textTransform: "uppercase" },
  metaDd: { fontFamily: "Helvetica-Bold", fontSize: 10, color: C.ink, marginTop: 2 },
  // sections
  section: { marginTop: 26 },
  secHead: { flexDirection: "row", borderTopWidth: 1, borderTopColor: C.line, paddingTop: 16, marginBottom: 14 },
  secNo: { fontFamily: "Times-Roman", fontSize: 15, color: C.faint, width: 30 },
  secEyebrow: { fontFamily: "Helvetica-Bold", fontSize: 8, letterSpacing: 2, color: C.faint, textTransform: "uppercase", marginBottom: 3 },
  secTitle: { fontFamily: "Times-Bold", fontSize: 21, color: C.ink },
  lede: { fontSize: 10, color: C.muted, marginBottom: 14, maxWidth: 440 },
  // generic
  areaHead: { fontFamily: "Helvetica-Bold", fontSize: 9, letterSpacing: 1, textTransform: "uppercase", marginTop: 12, marginBottom: 6 },
  goalRow: { flexDirection: "row", marginBottom: 7, paddingLeft: 2 },
  bullet: { width: 12, color: C.accent, fontFamily: "Helvetica-Bold" },
  goalLabel: { fontFamily: "Helvetica-Bold", fontSize: 11, color: C.ink },
  goalMeta: { fontSize: 9.5, color: C.muted, marginTop: 2 },
  goalWhy: { fontFamily: "Times-Italic", fontSize: 11, color: C.text, marginTop: 3 },
  kv: { marginTop: 2, fontSize: 10 },
  k: { fontFamily: "Helvetica-Bold", fontSize: 7.5, letterSpacing: 1, color: C.faint, textTransform: "uppercase" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  chip: { backgroundColor: C.warm, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 9, marginRight: 6, marginBottom: 6, fontSize: 9 },
  h3: { fontFamily: "Helvetica-Bold", fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: C.muted, marginTop: 14, marginBottom: 6 },
  principle: { fontFamily: "Times-Roman", fontSize: 12, color: C.ink, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: C.accent, marginBottom: 8 },
  // seasons / first year columns
  cols: { flexDirection: "row", marginTop: 4 },
  col: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 6, padding: 10, marginRight: 6 },
  colHead: { fontFamily: "Times-Bold", fontSize: 11, color: C.ink, marginBottom: 6 },
  colItem: { fontSize: 9, color: C.text, marginBottom: 4 },
  narrative: { fontFamily: "Times-Roman", fontSize: 13, lineHeight: 1.6, color: C.ink, marginBottom: 16 },
  factorRow: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 5 },
  finance: { backgroundColor: C.warm, borderRadius: 6, padding: 12, marginTop: 12, fontSize: 10 },
  ladderRow: { flexDirection: "row", marginBottom: 5 },
  ladderMark: { width: 16, color: "#2C7A46", fontFamily: "Helvetica-Bold" },
  firstSteps: { backgroundColor: C.navy, borderRadius: 10, padding: 28, marginTop: 30 },
  firstStepsTitle: { fontFamily: "Times-Bold", fontSize: 20, color: "#FFFFFF", marginBottom: 8 },
  firstStepsBody: { fontSize: 10.5, color: "#CFE1DB", maxWidth: 380 },
  fine: { fontSize: 9, color: C.faint, fontFamily: "Times-Italic", marginTop: 8 },
});

// A plain labelled fact (never a stitched sentence) — §8 transition details.
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginRight: 26, marginBottom: 8 }}>
      <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 7.5, letterSpacing: 1, color: C.faint, textTransform: "uppercase" }}>{label}</Text>
      <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10, color: C.ink, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function SectionHead({ no, eyebrow, title }: { no: number; eyebrow: string; title: string }) {
  return (
    <View style={s.secHead}>
      <Text style={s.secNo}>{no > 0 ? String(no).padStart(2, "0") : "✦"}</Text>
      <View>
        <Text style={s.secEyebrow}>{eyebrow}</Text>
        <Text style={s.secTitle}>{title}</Text>
      </View>
    </View>
  );
}

function GoalEntry({ goal }: { goal: PlanGoal }) {
  const season = seasonLabel43(goal.season);
  return (
    <View style={s.goalRow} wrap={false}>
      <Text style={s.bullet}>{goal.rank ? `${goal.rank}.` : "•"}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.goalLabel}>{goal.label}</Text>
        {season ? <Text style={s.goalMeta}>{season}</Text> : null}
        {goal.note ? <Text style={s.goalWhy}>&ldquo;{goal.note}&rdquo;</Text> : null}
        {goal.track === "do" ? (
          <>
            {goal.looksLike ? (
              <Text style={s.kv}><Text style={s.k}>What it looks like  </Text>{goal.looksLike}</Text>
            ) : null}
            {goal.cadence ? (
              <Text style={s.kv}><Text style={s.k}>Roughly when  </Text>{goal.cadence}</Text>
            ) : null}
            {goal.stretch ? (
              <Text style={s.kv}><Text style={s.k}>If you&rsquo;re bold  </Text>{goal.stretch}</Text>
            ) : null}
          </>
        ) : goal.ordinaryWeek ? (
          <Text style={s.kv}><Text style={s.k}>In an ordinary week  </Text>{goal.ordinaryWeek}</Text>
        ) : null}
      </View>
    </View>
  );
}

export function createPlanPdfDocument(plan: RlpPlan, images: Record<string, string>) {
  const { meta, opening, balance, values, movingTowards, prioritisedAreas, paths, week, leavingWork, firstYear, connections, openThreads } = plan;
  // Retirement paths (Phase 5): empty/null for working + flag-off. resetActions is
  // the FRAMED "Worth picking up" (never the raw change items).
  const { orientation, reset, windDownExit, resetActions, onsetGentle } = plan;
  const heroImg = images.hero;

  const seasonsLanes = movingTowards.seasons.filter((x) => x.id !== "enduring");

  return (
    <Document title="Retirement Life Plan" author="Vita">
      <Page size="A4" style={s.page}>
        {/* §1 opening */}
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop */}
        {heroImg ? <Image src={heroImg} style={s.coverHero} /> : null}
        <Text style={s.eyebrow}>Your Retirement Life Plan</Text>
        <Text style={s.chapterTitle}>{opening.chapterTitle}</Text>
        {orientation ? (
          <Text style={{ ...s.overview, fontFamily: "Times-Italic" }}>{orientation}</Text>
        ) : null}

        {opening.overview ? <Text style={s.overview}>{opening.overview}</Text> : null}
        {opening.insight ? <Text style={s.insight}>{opening.insight}</Text> : null}

        {opening.selfIntro ? (
          <View style={s.introDraft} wrap={false}>
            <Text style={s.introTag}>How you&rsquo;d put it</Text>
            <Text style={s.introText}>{opening.selfIntro}</Text>
          </View>
        ) : null}

        <View style={s.metaRow}>
          {meta.name ? (
            <View style={s.metaItem}><Text style={s.metaDt}>For</Text><Text style={s.metaDd}>{meta.name}</Text></View>
          ) : null}
          <View style={s.metaItem}><Text style={s.metaDt}>Created</Text><Text style={s.metaDd}>{fmt(meta.dateCreated)}</Text></View>
          <View style={s.metaItem}><Text style={s.metaDt}>Last reviewed</Text><Text style={s.metaDd}>{fmt(meta.dateLastReviewed)}</Text></View>
          <View style={s.metaItem}><Text style={s.metaDt}>Next review</Text><Text style={s.metaDd}>{fmt(meta.nextReviewDue)}</Text></View>
        </View>

        {/* §2 balance — the at-a-glance shape only; goals live in §5 */}
        <View style={s.section}>
          <SectionHead no={2} eyebrow="The shape of it" title="Your balanced retirement" />
          <View style={{ flexDirection: "row", marginBottom: 10 }}>
            {balance.areas.map((a: PlanArea) => (
              <View key={a.id} style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, color: AREA_FG[a.id] }}>{a.label}</Text>
                <Text style={{ fontSize: 8, color: C.muted, marginTop: 2 }}>
                  {a.deliberateGap ? "quiet" : a.goals.length === 0 ? "open" : `${a.goals.length}`}
                </Text>
              </View>
            ))}
          </View>
          {balance.shape ? <Text style={s.narrative}>{balance.shape}</Text> : null}
        </View>

        {/* §3 values */}
        <View style={s.section}>
          <SectionHead no={3} eyebrow="Your compass" title="What matters most to you" />
          {values.coreValues.map((v, i) => (
            <View key={i} style={{ marginBottom: 8 }} wrap={false}>
              <Text style={s.goalLabel}>{v.value}</Text>
              {v.meaning ? <Text style={s.goalWhy}>&ldquo;{v.meaning}&rdquo;</Text> : null}
              {v.threat ? <Text style={s.goalWhy}>What puts it at risk: {v.threat}</Text> : null}
              {v.protectors && v.protectors.length ? (
                <Text style={s.goalWhy}>What protects it: {v.protectors.join(", ")}</Text>
              ) : null}
            </View>
          ))}
          {values.nonNegotiables.length ? (
            <>
              <Text style={s.h3}>What you&rsquo;ll hold firm on</Text>
              <View style={s.chipRow}>{values.nonNegotiables.map((v) => <Text key={v} style={s.chip}>{v}</Text>)}</View>
            </>
          ) : null}
          {values.flexible.length ? (
            <>
              <Text style={s.h3}>Where you can flex</Text>
              <View style={s.chipRow}>{values.flexible.map((v) => <Text key={v} style={s.chip}>{v}</Text>)}</View>
            </>
          ) : null}
          {values.principles.length ? (
            <>
              <Text style={s.h3}>How you&rsquo;ll decide when things pull apart</Text>
              {values.principles.map((p, i) => <Text key={i} style={s.principle}>{p}</Text>)}
            </>
          ) : null}
        </View>

        {/* §4 seasons */}
        <View style={s.section}>
          <SectionHead no={4} eyebrow="The when" title="The retirement you're moving towards" />
          {movingTowards.arc ? <Text style={[s.lede, { maxWidth: 460 }]}>{movingTowards.arc}</Text> : null}
          <View style={s.cols}>
            {seasonsLanes.map((season) => (
              <View key={season.id} style={s.col}>
                <Text style={s.colHead}>{season.label}</Text>
                {season.items.length ? season.items.map((it, j) => (
                  <Text key={j} style={s.colItem}>{it.label}</Text>
                )) : <Text style={[s.colItem, { fontStyle: "italic", color: C.muted }]}>Intentionally more open.</Text>}
              </View>
            ))}
          </View>
          {movingTowards.enduring.length ? (
            <>
              <Text style={s.h3}>Throughout, in every season</Text>
              <View style={s.chipRow}>{movingTowards.enduring.map((e, i) => <Text key={i} style={s.chip}>{e.label}</Text>)}</View>
            </>
          ) : null}
        </View>

        {/* §5 goals */}
        <View style={s.section}>
          <SectionHead no={5} eyebrow="The heart of it" title="Your most important goals" />
          {prioritisedAreas.map((area) => (
            <View key={area.id}>
              <Text style={[s.areaHead, { color: AREA_FG[area.id] }]}>{area.label}</Text>
              {area.goals.map((g, i) => <GoalEntry key={i} goal={g} />)}
            </View>
          ))}
        </View>

        {/* See how it all connects — static list of the real links */}
        {connections ? (
          <View style={s.section}>
            <SectionHead no={0} eyebrow="The web of it" title="See how it all connects" />
            {connections.edges.map((e, i) => {
              const from = connections.nodes.find((n) => n.id === e.from)?.label ?? "";
              const to = connections.nodes.find((n) => n.id === e.to)?.label ?? "";
              return (
                <View key={i} style={{ marginBottom: 6 }} wrap={false}>
                  <Text style={{ fontSize: 10.5, color: C.ink }}>
                    <Text style={{ fontFamily: "Helvetica-Bold" }}>{from}</Text> &mdash; {to}
                  </Text>
                  {e.why ? <Text style={{ fontSize: 9.5, color: C.muted }}>{e.why}</Text> : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {/* §6 paths */}
        <View style={s.section}>
          <SectionHead no={6} eyebrow="The route" title="The path to your goals" />
          {paths.paths.map((p, i) => (
            <View key={i} style={{ marginBottom: 12 }} wrap={false}>
              <Text style={[s.colHead, { marginBottom: 6 }]}>{p.goal}</Text>
              {p.track === "do" && p.milestones ? (
                p.milestones.map((m, j) => (
                  <View key={j} style={s.ladderRow}>
                    <Text style={s.ladderMark}>{m.done ? "✓" : "○"}</Text>
                    <Text style={{ flex: 1, fontSize: 10, color: m.done ? C.muted : C.ink }}>
                      {m.label}{m.when ? `  ·  ${m.when}` : ""}
                    </Text>
                  </View>
                ))
              ) : (
                <>
                  {p.alreadyHelps?.length ? <Text style={s.kv}><Text style={s.k}>Already in place  </Text>{p.alreadyHelps.join("; ")}</Text> : null}
                  {p.wouldHelp?.length ? <Text style={s.kv}><Text style={s.k}>Would help it take root  </Text>{p.wouldHelp.join("; ")}</Text> : null}
                </>
              )}
              {p.lean ? <Text style={[s.kv, { color: C.muted }]}>A strength to lean on: {p.lean}</Text> : null}
            </View>
          ))}
          {paths.strengths.length ? (
            <>
              <Text style={s.h3}>Strengths and resources to lean on</Text>
              <View style={s.chipRow}>{paths.strengths.map((x) => <Text key={x} style={s.chip}>{x}</Text>)}</View>
            </>
          ) : null}
        </View>

        {/* §7 week */}
        {week ? (
          <View style={s.section}>
            <SectionHead no={7} eyebrow="The everyday" title="How you want your days to feel" />
            {week.rhythm ? <Text style={s.narrative}>{week.rhythm}</Text> : null}
            {(() => {
              const rank = (f: string) => ({ "most days": 0, "a few times a week": 1, weekly: 2, "now and then": 3 } as Record<string, number>)[f.toLowerCase()] ?? 4;
              const holds = week.activities.filter((a) => a.anchor || a.fixed).sort((a, b) => rank(a.frequency) - rank(b.frequency));
              const moves = week.activities.filter((a) => !a.anchor && !a.fixed).sort((a, b) => rank(a.frequency) - rank(b.frequency));
              const anyEnergy = week.activities.some((a) => a.energy);
              const Group = ({ title, items }: { title: string; items: typeof week.activities }) =>
                items.length ? (
                  <View style={{ marginBottom: 10 }}>
                    <Text style={s.h3}>{title}</Text>
                    {items.map((a, i) => (
                      <View key={i} style={s.factorRow}>
                        <Text style={{ fontSize: 10, color: C.ink }}>
                          {a.energy ? "● " : ""}{a.label}{a.fixed ? "  · ongoing work" : ""}
                        </Text>
                        <Text style={{ fontSize: 9.5, color: C.muted }}>{a.frequency}</Text>
                      </View>
                    ))}
                  </View>
                ) : null;
              return (
                <>
                  <Group title="What holds your week" items={holds} />
                  <Group title="What moves around it" items={moves} />
                  {anyEnergy ? <Text style={s.fine}>●  gives you energy</Text> : null}
                </>
              );
            })()}
            <Text style={s.fine}>The character of an ordinary week, lived for years — not a timetable.</Text>
          </View>
        ) : null}

        {/* §8 retired — the reset */}
        {reset ? (
          <View style={s.section}>
            <SectionHead no={8} eyebrow="The reset" title="Carrying forward, reshaping, letting go" />
            {onsetGentle ? (
              <Text style={s.overview}>
                Leaving work wasn&rsquo;t entirely on your terms, so this is less about a fresh start and more about making the retirement you&rsquo;re in feel like your own.
              </Text>
            ) : null}
            {reset.keep.length > 0 ? (
              <View style={{ marginBottom: 10 }}>
                <Text style={s.colHead}>Carrying forward</Text>
                {reset.keep.map((x, i) => <Text key={i} style={s.colItem}>{x}</Text>)}
              </View>
            ) : null}
            {reset.change.length > 0 ? (
              <View style={{ marginBottom: 10 }}>
                <Text style={s.colHead}>Reshaping</Text>
                {reset.change.map((x, i) => <Text key={i} style={s.colItem}>{x}</Text>)}
              </View>
            ) : null}
            {reset.leaveBehind.length > 0 ? (
              <View style={{ marginBottom: 10 }}>
                <Text style={s.colHead}>Letting go</Text>
                {reset.leaveBehind.map((x, i) => <Text key={i} style={s.colItem}>{x}</Text>)}
              </View>
            ) : null}
            {resetActions.length > 0 ? (
              <View>
                <Text style={s.colHead}>Worth picking up</Text>
                {resetActions.map((a, i) => (
                  <Text key={i} style={s.colItem}>{a}</Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* §8 winding-down, decided — the settled exit */}
        {windDownExit ? (
          <View style={s.section}>
            <SectionHead no={8} eyebrow="The threshold" title="Leaving work" />
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 12 }}>
              <Fact label="Your plan" value="You've settled how and when you'll leave work fully." />
              {windDownExit.currentShape ? (
                <Fact
                  label="Where you are now"
                  value={`Still working ${windDownExit.currentShape.toLowerCase()}${windDownExit.windingDuration ? `, winding down ${windDownExit.windingDuration.toLowerCase()}` : ""}.`}
                />
              ) : null}
            </View>
            <View style={s.finance}>
              <Text>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>Financial confidence. </Text>
                Worth firming up with your pension provider or a financial adviser as the natural next step.
              </Text>
            </View>
          </View>
        ) : null}

        {/* §8 leaving work */}
        {leavingWork ? (
          <View style={s.section}>
            <SectionHead no={8} eyebrow="The threshold" title="Leaving work" />
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 12 }}>
              <Fact label="Transition" value={leavingWork.lean === "gradual" ? "A gradual wind-down" : "A clean break"} />
              {leavingWork.shape ? <Fact label="Shape" value={leavingWork.shape} /> : null}
              {leavingWork.period ? <Fact label="Over" value={leavingWork.period} /> : null}
              {leavingWork.window ? <Fact label="Window" value={`${leavingWork.window.fromLabel}–${leavingWork.window.toLabel} years from now`} /> : null}
            </View>
            {leavingWork.factors.map((f) => (
              <View key={f.id} style={s.factorRow}>
                <Text style={{ fontSize: 10, color: C.text }}>{f.label}</Text>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, color: C.muted }}>{f.level}</Text>
              </View>
            ))}
            <View style={s.finance}>
              <Text>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>Financial confidence. </Text>
                {leavingWork.financeNote || "Worth firming up with your pension provider or a financial adviser as the natural next step."}
              </Text>
            </View>
          </View>
        ) : null}

        {/* §9 first year */}
        {firstYear ? (
          <View style={s.section}>
            <SectionHead no={9} eyebrow="Arriving" title="Your first year" />
            {firstYear.narrative ? <Text style={s.narrative}>{firstYear.narrative}</Text> : null}
            <View style={s.cols}>
              {firstYear.seasons.filter((season) => season.items.length > 0).map((season) => (
                <View key={season.id} style={s.col}>
                  <Text style={s.colHead}>{season.label}</Text>
                  {season.items.map((it, j) => (
                    <Text key={j} style={s.colItem}>{it.top ? "★ " : ""}{it.label}</Text>
                  ))}
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* §10 open threads */}
        {openThreads.length ? (
          <View style={s.section}>
            <SectionHead no={10} eyebrow="Still in motion" title="What I'm still working out" />
            {openThreads.map((t, i) => (
              <Text key={i} style={{ fontFamily: "Times-Roman", fontSize: 12, color: C.ink, marginBottom: 7, paddingLeft: 10 }}>
                ○  {t}
              </Text>
            ))}
          </View>
        ) : null}

        {/* §11 first steps */}
        <View style={s.firstSteps}>
          <Text style={s.eyebrow}>What comes next</Text>
          <Text style={s.firstStepsTitle}>First steps</Text>
          <Text style={s.firstStepsBody}>
            This plan is the shape of the years ahead. The next stage turns the stepping stones into real, dated first actions — one small move at a time.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

function fmt(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${d} ${months[m - 1]} ${y}`;
}
