import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { Fragment, useMemo } from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { ArrowLink } from '@/components/public/connectors';
import { Reveal, useCountUp } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
import {
  ButtonRow,
  Heading,
  PrimaryButton,
  SecondaryButton,
  Section,
  SectionLabel,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { contactHref, EXTERNAL } from '@/lib/destinations';
import { elevation, hexToRgba, softFill, type ThemeTokens } from '@/theme/tokens';
import { BP, cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

type Accent = 'brand' | 'violet' | 'green' | 'orange' | 'pink';

const PROOF = ['Human-approved by default', 'No credit card', 'Cancel anytime'];

type Opportunity = {
  title: string;
  impact: string;
  level: 'High' | 'Medium';
  confidence: number;
  icon: string;
  accent: Accent;
};

const OPPORTUNITIES: Opportunity[] = [
  {
    title: 'Re-engage inactive leads with personalized SMS',
    impact: '$12.4K',
    level: 'High',
    confidence: 87,
    icon: 'comment-dots',
    accent: 'brand',
  },
  {
    title: 'Boost Google Business visibility in 15 locations',
    impact: '$8.7K',
    level: 'High',
    confidence: 81,
    icon: 'location-dot',
    accent: 'green',
  },
  {
    title: 'Launch lookalike audience from recent purchasers',
    impact: '$6.3K',
    level: 'Medium',
    confidence: 72,
    icon: 'bullseye',
    accent: 'violet',
  },
  {
    title: 'Improve product page conversion rate',
    impact: '$4.2K',
    level: 'Medium',
    confidence: 68,
    icon: 'bag-shopping',
    accent: 'orange',
  },
  {
    title: 'Win back lost cart abandoners',
    impact: '$3.1K',
    level: 'Medium',
    confidence: 61,
    icon: 'cart-shopping',
    accent: 'pink',
  },
];

const QUESTIONS = [
  'Which customers are about to slip away?',
  'What should we post this week, and where?',
  'Why did revenue dip last month?',
  'Which campaign deserves more budget?',
  'What are callers asking about most?',
  'Which products are about to run out?',
];

const STEPS: { icon: string; title: string; body: string; accent: Accent }[] = [
  {
    icon: 'magnifying-glass-chart',
    title: 'Detect',
    body: 'Flow.AI reads every channel continuously and notices the change before you would.',
    accent: 'brand',
  },
  {
    icon: 'lightbulb',
    title: 'Recommend',
    body: 'It ranks what to do next by projected impact, with the reasoning attached.',
    accent: 'violet',
  },
  {
    icon: 'wand-magic-sparkles',
    title: 'Prepare',
    body: 'Copy, audience, budget and schedule arrive built — not a to-do list.',
    accent: 'orange',
  },
  {
    icon: 'circle-check',
    title: 'Approve & launch',
    body: 'You read it, edit anything, and press go. Nothing ships until you do.',
    accent: 'green',
  },
];

const AGENTS: { icon: string; title: string; body: string; accent: Accent }[] = [
  {
    icon: 'magnifying-glass-chart',
    title: 'Opportunity Audit',
    body: 'Scans your whole account and surfaces what is genuinely worth doing next, ranked by projected impact.',
    accent: 'brand',
  },
  {
    icon: 'bullhorn',
    title: 'Campaign Builder',
    body: 'Drafts the creative, the audience, the budget and the schedule for social, email and SMS in one pass.',
    accent: 'violet',
  },
  {
    icon: 'route',
    title: 'Customer Journey Agent',
    body: 'Maps where people stall between interest and purchase, then prepares the follow-up that moves them on.',
    accent: 'orange',
  },
  {
    icon: 'phone-volume',
    title: 'Call Intelligence Agent',
    body: 'Reads every call summary, tags what was asked, and turns the pattern into something you can act on.',
    accent: 'green',
  },
  {
    icon: 'bag-shopping',
    title: 'Commerce Agent',
    body: 'Watches catalogue, pricing, stock and carts, and prepares the fix before the revenue quietly leaks away.',
    accent: 'pink',
  },
  {
    icon: 'location-dot',
    title: 'Local Visibility Agent',
    body: 'Keeps listings, hours, photos and review replies accurate across every location you serve.',
    accent: 'brand',
  },
  {
    icon: 'chart-column',
    title: 'Analytics Advisor',
    body: 'Explains what changed, why it changed and what to do about it — in plain language, not a chart dump.',
    accent: 'violet',
  },
];

const CONTEXT: { icon: string; label: string }[] = [
  { icon: 'pen-nib', label: 'Brand voice & style' },
  { icon: 'clock-rotate-left', label: 'Customer history & behavior' },
  { icon: 'shield-halved', label: 'Consent & preferences' },
  { icon: 'headset', label: 'Calls, messages & transcripts' },
  { icon: 'boxes-stacked', label: 'Inventory, catalog & services' },
  { icon: 'map-location-dot', label: 'Locations, hours & coverage' },
  { icon: 'bullseye', label: 'Performance & goals' },
];

const CONTROLS: { icon: string; title: string; body: string; accent: Accent }[] = [
  {
    icon: 'user-shield',
    title: 'Permissions',
    body: 'Decide exactly which agents may touch which channels, audiences and accounts.',
    accent: 'brand',
  },
  {
    icon: 'sack-dollar',
    title: 'Budget caps',
    body: 'Set a ceiling per campaign, per channel and per month. Flow.AI stops at the line.',
    accent: 'green',
  },
  {
    icon: 'circle-check',
    title: 'Approval modes',
    body: 'Review everything, review only spend, or auto-run the routine work you already trust.',
    accent: 'violet',
  },
  {
    icon: 'triangle-exclamation',
    title: 'Escalation rules',
    body: 'Say when it must stop and fetch a human — a refund, a complaint, an unusual spend.',
    accent: 'orange',
  },
  {
    icon: 'clipboard-list',
    title: 'Audit log',
    body: 'Every recommendation, edit, approval and launch recorded with who did what, and when.',
    accent: 'pink',
  },
];

const BENEFITS = [
  'Every recommendation arrives with the reasoning and the numbers behind it.',
  'Approve in one tap, or edit the copy, audience and budget before it ships.',
  'One weekly briefing instead of ten dashboards nobody has time to read.',
];

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

type Styles = ReturnType<typeof createStyles>;

function OpportunityRow({
  item,
  index,
  wide,
  accent,
  styles,
  t,
}: {
  item: Opportunity;
  index: number;
  wide: boolean;
  accent: string;
  styles: Styles;
  t: ThemeTokens;
}) {
  const levelHigh = item.level === 'High';
  const bar: DimensionValue = `${item.confidence}%`;

  const confidence = (
    <View style={wide ? styles.oppConfidence : styles.oppConfidenceCompact}>
      <View style={styles.oppConfidenceHead}>
        <Text style={styles.oppConfidenceValue}>{item.confidence}%</Text>
        <Text style={styles.oppConfidenceLabel}>confident</Text>
      </View>
      <View style={styles.oppTrack}>
        <View style={[styles.oppTrackFill, { width: bar, backgroundColor: accent }]} />
      </View>
    </View>
  );

  const impact = (
    <View style={wide ? styles.oppImpact : styles.oppImpactCompact}>
      <Text style={styles.oppImpactValue}>{item.impact}</Text>
      <Text style={[styles.oppLevel, { color: levelHigh ? t.successText : t.textSubtle }]}>
        {item.level} impact
      </Text>
    </View>
  );

  return (
    <View style={[styles.oppRow, wide ? null : styles.oppRowCompact]}>
      <View style={styles.oppLead}>
        <View style={[styles.oppRank, { backgroundColor: softFill(accent, t) }]}>
          <FontAwesome6 name={item.icon as never} size={13} color={accent} />
        </View>
        <View style={styles.oppCopy}>
          <Text numberOfLines={3} style={styles.oppTitle}>
            {item.title}
          </Text>
          <Text style={styles.oppMeta}>Ranked #{index + 1} this week</Text>
        </View>
        {wide ? impact : null}
        {wide ? confidence : null}
      </View>

      {wide ? null : (
        <View style={styles.oppMetaRow}>
          {impact}
          {confidence}
        </View>
      )}

      {/*
        Mockup chrome. This card is a picture of the Flow.AI command centre —
        there is no opportunity behind the row to review, so the control is a
        View that merely looks like the real one. A button that invites a click
        and does nothing is worse than a static illustration of one.
      */}
      <View style={[styles.reviewButton, wide ? null : styles.reviewButtonFull]}>
        <Text style={styles.reviewLabel}>Review</Text>
        <FontAwesome6 name="arrow-right" size={11} color={t.brand} />
      </View>
    </View>
  );
}

function BriefStat({
  value,
  label,
  prefix = '',
  suffix = '',
  styles,
}: {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  styles: Styles;
}) {
  const counter = useCountUp(value);
  return (
    <View ref={counter.ref as never} style={styles.briefRow}>
      <Text style={styles.briefLabel}>{label}</Text>
      <Text style={styles.briefValue}>
        {prefix}
        {Math.round(counter.value).toLocaleString('en-US')}
        {suffix}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function FlowAiPage() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const router = useRouter();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);

  const accentOf = (accent: Accent) =>
    accent === 'violet'
      ? t.violet
      : accent === 'green'
        ? t.green
        : accent === 'orange'
          ? t.orange
          : accent === 'pink'
            ? t.pink
            : t.brand;

  // Below phone the ranked table becomes stacked cards; the five columns simply
  // do not survive a 390px viewport without truncating the opportunity itself.
  const wideTable = !l.isPhone;

  return (
    <PageShell
      title="Flow.AI"
      description="Flow.AI finds the opportunity and prepares the work across content, campaigns, calls and commerce. Nothing launches without your approval."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Flow.AI', path: ROUTES.flowAi },
        ]),
      ]}>
      {/* ------------------------------------------------ hero */}
      <Section>
        <View style={styles.heroRow}>
          <Reveal style={styles.heroCopy} distance={16}>
            <SectionLabel>YOUR AI GROWTH OPERATOR</SectionLabel>
            <Heading level={1} style={[type.display, styles.heroTitle]}>
              Flow.AI finds the opportunity. You stay in control.
            </Heading>
            <Text style={[type.body, styles.heroBody]}>
              One intelligent assistant that understands your content, customers, campaigns, calls,
              store, listings, and performance—then prepares the next best actions for approval.
            </Text>
            <View style={styles.heroButtons}>
              <ButtonRow>
                <PrimaryButton
                  label="Try Flow.AI"
                  size="lg"
                  full={l.isPhone}
                  trackId="flow-ai.hero.try"
                  onPress={() => Linking.openURL(EXTERNAL.signup)}
                />
                {/* No walkthrough video exists — this books a real demo rather
                    than opening a player with nothing behind it. */}
                <SecondaryButton
                  label="Watch how it works"
                  size="lg"
                  icon="play"
                  full={l.isPhone}
                  trackId="flow-ai.hero.watch-demo"
                  onPress={() => router.push(contactHref('demo') as never)}
                />
              </ButtonRow>
            </View>
            <View style={styles.proofRow}>
              {PROOF.map((item) => (
                <View key={item} style={styles.proofItem}>
                  <View style={styles.proofTick}>
                    <FontAwesome6 name="check" size={10} color={t.green} />
                  </View>
                  <Text style={styles.proofText}>{item}</Text>
                </View>
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.heroPanel} distance={16} delay={90}>
            <View style={styles.commandCard}>
              <View style={styles.commandHead}>
                <View style={styles.commandHeadCopy}>
                  <Text style={styles.commandTitle}>Flow.AI Command Center</Text>
                  <Text style={styles.commandSub}>5 opportunities found this week</Text>
                </View>
                <View style={styles.commandChip}>
                  <View style={styles.commandDot} />
                  <Text style={styles.commandChipText}>Live</Text>
                </View>
              </View>

              {wideTable ? (
                <View style={styles.tableHead}>
                  <Text style={[styles.tableHeadCell, styles.tableHeadOpportunity]}>Opportunity</Text>
                  <Text style={[styles.tableHeadCell, styles.tableHeadImpact]}>Projected impact</Text>
                  <Text style={[styles.tableHeadCell, styles.tableHeadConfidence]}>Confidence</Text>
                  <View style={styles.tableHeadAction} />
                </View>
              ) : null}

              <View style={styles.oppList}>
                {OPPORTUNITIES.map((item, index) => (
                  <OpportunityRow
                    key={item.title}
                    item={item}
                    index={index}
                    wide={wideTable}
                    accent={accentOf(item.accent)}
                    styles={styles}
                    t={t}
                  />
                ))}
              </View>

              <View style={styles.commandFoot}>
                <FontAwesome6 name="shield-halved" size={12} color={t.green} />
                <Text style={styles.commandFootText}>
                  Human approval required — nothing here has been launched.
                </Text>
              </View>
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ one conversation */}
      <Section>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>ASK ANYTHING</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>
            One conversation across your whole business.
          </Heading>
          <Text style={[type.body, styles.headSub]}>
            No dashboard hopping and no exports. Ask in your own words and Flow.AI answers from the
            same data it acts on.
          </Text>
        </Reveal>

        <View style={styles.questionWrap}>
          {QUESTIONS.map((question, index) => (
            <Reveal key={question} style={styles.questionCell} distance={14} delay={index * 60}>
              <View style={styles.questionChip}>
                <View style={styles.questionIcon}>
                  <FontAwesome6 name="comment" size={12} color={t.brand} />
                </View>
                <Text style={styles.questionText}>{question}</Text>
              </View>
            </Reveal>
          ))}
        </View>
      </Section>

      {/* ------------------------------------------------ insight to impact */}
      <Section>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>HOW IT WORKS</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>
            From insight to impact—built for human control.
          </Heading>
          <Text style={[type.body, styles.headSub]}>
            Four steps, every time. The last one is always yours.
          </Text>
        </Reveal>

        <View style={styles.stepRow}>
          {/* Cards and arrows are siblings so every card gets the same share of
              the row — nesting the arrow inside the card's cell would make the
              last card wider than the other three by the arrow's width. */}
          {STEPS.map((step, index) => {
            const accent = accentOf(step.accent);
            return (
              <Fragment key={step.title}>
                <View style={styles.stepCell}>
                  <View style={styles.stepCard}>
                    <View style={styles.stepTopRow}>
                      <View style={[styles.stepIcon, { backgroundColor: softFill(accent, t) }]}>
                        <FontAwesome6 name={step.icon as never} size={18} color={accent} />
                      </View>
                      <Text style={styles.stepIndex}>{`0${index + 1}`}</Text>
                    </View>
                    <Text style={[type.h4, styles.stepTitle]}>{step.title}</Text>
                    <Text style={styles.stepBody}>{step.body}</Text>
                  </View>
                </View>
                {index < STEPS.length - 1 ? (
                  <View style={styles.stepArrow}>
                    {l.isStacked ? (
                      <FontAwesome6 name="arrow-down" size={14} color={t.borderStrong} />
                    ) : (
                      <ArrowLink width={38} height={12} color={t.borderStrong} />
                    )}
                  </View>
                ) : null}
              </Fragment>
            );
          })}
        </View>
      </Section>

      {/* ------------------------------------------------ specialized agents */}
      <Section>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>THE TEAM</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>
            Specialized agents. One intelligent team.
          </Heading>
          <Text style={[type.body, styles.headSub]}>
            Each agent is expert in one part of your business. They share the same context, so their
            recommendations never contradict each other.
          </Text>
        </Reveal>

        {/*
          Seven is prime, so there is no grid that ends flush — four across left
          a three-card hole on the second row. These are row cards instead: the
          agent's name holds its own column beside the description, so the width
          a fourth card used to waste is carrying copy.
        */}
        <View style={styles.agentList}>
          {AGENTS.map((agent, index) => {
            const accent = accentOf(agent.accent);
            return (
              <Reveal key={agent.title} distance={16} delay={index * 55}>
                <View style={styles.agentRow}>
                  <View style={[styles.agentIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={agent.icon as never} size={19} color={accent} />
                  </View>
                  <View style={styles.agentCopy}>
                    <Text style={[type.h4, styles.agentTitle, styles.agentTitleCol]}>
                      {agent.title}
                    </Text>
                    <Text style={[styles.agentBody, styles.agentBodyCol]}>{agent.body}</Text>
                  </View>
                </View>
              </Reveal>
            );
          })}
        </View>
      </Section>

      {/* ------------------------------------------------ context */}
      <Section>
        <View style={styles.contextRow}>
          <Reveal style={styles.contextCopy} distance={16}>
            <SectionLabel>GROUNDED IN YOUR DATA</SectionLabel>
            <Heading level={2} style={[type.h2, styles.contextTitle]}>
              AI that understands your business.
            </Heading>
            <Text style={[type.body, styles.contextBody]}>
              Generic AI writes generic work. Flow.AI is briefed on everything your account already
              knows — so what it prepares sounds like you and respects what your customers agreed to.
            </Text>
          </Reveal>

          <Reveal style={styles.contextPanel} distance={16} delay={80}>
            <View style={styles.contextChips}>
              {CONTEXT.map((item) => (
                <View key={item.label} style={styles.contextChip}>
                  <View style={styles.contextChipIcon}>
                    <FontAwesome6 name={item.icon as never} size={13} color={t.brand} />
                  </View>
                  <Text style={styles.contextChipText}>{item.label}</Text>
                </View>
              ))}
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ control */}
      <Section>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>GUARDRAILS</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>
            You&apos;re in control—always.
          </Heading>
          <Text style={[type.body, styles.headSub]}>
            Autonomy is a dial, not a switch. Every one of these settings is yours before a single
            agent runs.
          </Text>
        </Reveal>

        <View style={styles.grid}>
          {CONTROLS.map((control, index) => {
            const accent = accentOf(control.accent);
            return (
              <Reveal key={control.title} style={styles.controlCell} distance={16} delay={index * 60}>
                <View style={styles.controlCard}>
                  <View style={[styles.controlIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={control.icon as never} size={17} color={accent} />
                  </View>
                  <View style={styles.controlCopy}>
                    <Text style={[type.h4, styles.controlTitle]}>{control.title}</Text>
                    <Text style={styles.controlBody}>{control.body}</Text>
                  </View>
                </View>
              </Reveal>
            );
          })}
        </View>

        <Reveal style={styles.assuranceWrap} distance={14}>
          <View style={styles.assurance}>
            <View style={styles.assuranceIcon}>
              <FontAwesome6 name="shield-halved" size={16} color={t.successText} />
            </View>
            <Text style={styles.assuranceText}>
              Human-approved by default. Flow.AI never launches anything without your approval.
            </Text>
          </View>
        </Reveal>
      </Section>

      {/* ------------------------------------------------ weekly briefing */}
      <Section>
        <View style={styles.briefRowOuter}>
          <Reveal style={styles.briefPanel} distance={16}>
            <View style={styles.briefCard}>
              <View style={styles.briefHead}>
                <View style={styles.briefHeadIcon}>
                  <FontAwesome6 name="envelope-open-text" size={15} color={t.brand} />
                </View>
                <View style={styles.briefHeadCopy}>
                  <Text style={styles.briefTitle}>Your weekly briefing</Text>
                  <Text style={styles.briefSub}>Monday, 8:00am — sent to you and your team</Text>
                </View>
              </View>
              <View style={styles.briefList}>
                <BriefStat value={24} label="Opportunities reviewed" styles={styles} />
                <BriefStat value={12} label="Actions launched" styles={styles} />
                <BriefStat value={28450} label="Revenue impact" prefix="$" styles={styles} />
                <View style={styles.briefRow}>
                  <Text style={styles.briefLabel}>Top performing channel</Text>
                  <View style={styles.briefChip}>
                    <FontAwesome6 name="comment-dots" size={11} color={t.chipText} />
                    <Text style={styles.briefChipText}>SMS</Text>
                  </View>
                </View>
              </View>
            </View>
          </Reveal>

          <Reveal style={styles.briefCopy} distance={16} delay={80}>
            <SectionLabel>WHAT YOU GET</SectionLabel>
            <Heading level={2} style={[type.h2, styles.briefCopyTitle]}>
              A growth operator that reports to you.
            </Heading>
            <View style={styles.benefitList}>
              {BENEFITS.map((benefit) => (
                <View key={benefit} style={styles.benefitRow}>
                  <View style={styles.benefitTick}>
                    <FontAwesome6 name="check" size={11} color={t.green} />
                  </View>
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>
            <View style={styles.briefButtons}>
              <ButtonRow>
                <PrimaryButton
                  label="Try Flow.AI"
                  full={l.isPhone}
                  trackId="flow-ai.briefing.try"
                  onPress={() => Linking.openURL(EXTERNAL.signup)}
                />
                <SecondaryButton
                  label="See the platform"
                  full={l.isPhone}
                  trackId="flow-ai.briefing.see-platform"
                  onPress={() => router.push(ROUTES.product as never)}
                />
              </ButtonRow>
            </View>
          </Reveal>
        </View>
      </Section>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  const stacked = l.isStacked;
  const gridGap = l.isPhone ? 12 : 18;

  const contentWidth = Math.max(
    280,
    Math.min(l.width, BP.maxContent) - l.gutter * 2 - l.sectionPad * 2,
  );

  /**
   * Percentage basis for one cell of an `n`-column wrapped grid, with the pixel
   * gaps discounted. Paired with `flexGrow: 0` so a short last row keeps its
   * natural column width rather than stretching an orphan across the section.
   *
   * Note the 20% floor: it makes this unusable at five columns, where the honest
   * basis is ~18.8% and clamping to 20% overflows the row by four gaps. Five-up
   * grids therefore use `cellBasis` + cell padding below instead.
   */
  const cellPct = (columns: number): DimensionValue => {
    if (columns <= 1) return '100%';
    const gapPct = ((gridGap * (columns - 1)) / contentWidth) * 100;
    return `${Math.max(20, Math.floor(((100 - gapPct - 0.5) / columns) * 100) / 100)}%` as DimensionValue;
  };

  // Padding inside the cell rather than a gap between cells, so five columns of
  // a flat 20% basis sum to exactly 100% and the fifth never wraps.
  const cellPad = l.isPhone ? 5 : 9;

  // Five controls is a prime count: only five columns or one divide it, and two,
  // three or four all end the grid on a hole the width of a missing card. Five
  // across while there is room, then the icon-left row card below 1024.
  const controlColumns = l.isCompact ? 1 : 5;

  // Seven agents divides by nothing usable at any width, so they are not a grid
  // at all — one column of row cards, with the name in its own column beside the
  // description so the full width is used rather than left blank.
  const agentTitleWidth = l.isDesktop ? 260 : 224;

  // Between 1120 and 1440 the command card shares the hero with the copy, so the
  // fixed columns tighten to leave the opportunity itself two readable lines.
  const impactW = l.isDesktop ? 108 : 84;
  const confW = l.isDesktop ? 116 : 88;
  const reviewW = l.isDesktop ? 88 : 76;

  const twoUp: ViewStyle = { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 };
  const cardBase: ViewStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    backgroundColor: t.surfaceRaised,
    padding: l.isPhone ? 16 : 20,
    gap: 10,
    ...(elevation(t, 1) as object),
  };
  const headCellBase: TextStyle = {
    ...type.micro,
    color: t.textSubtle,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  };

  return StyleSheet.create({
    /* -------------------------------------------------- hero */
    heroRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: stacked ? 26 : 40,
    },
    heroCopy: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 420, minWidth: 0, paddingTop: 6 },
    heroTitle: { marginTop: 14 },
    heroBody: { marginTop: 14, maxWidth: 560 },
    heroButtons: { marginTop: 24 },
    proofRow: {
      marginTop: 22,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: l.isPhone ? 10 : 18,
    },
    proofItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    proofTick: {
      width: 20,
      height: 20,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.green, t),
    },
    proofText: { ...type.caption, color: t.textMuted, fontWeight: '600' },

    heroPanel: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1.35, flexShrink: 1, flexBasis: 560, minWidth: 0 },

    /* -------------------------------------------------- command center */
    commandCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 18,
      gap: 12,
      ...(elevation(t, 2) as object),
    },
    commandHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    commandHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    commandTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    commandSub: { ...type.caption, color: t.textMuted },
    commandChip: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: t.successBg,
    },
    commandDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.successText },
    commandChipText: { fontSize: 11, fontWeight: '800', color: t.successText },

    tableHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 12,
      paddingBottom: 2,
    },
    tableHeadCell: headCellBase,
    tableHeadOpportunity: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    tableHeadImpact: { width: impactW, flexGrow: 0, flexShrink: 0 },
    tableHeadConfidence: { width: confW, flexGrow: 0, flexShrink: 0 },
    tableHeadAction: { width: reviewW, flexGrow: 0, flexShrink: 0 },

    oppList: { gap: 8 },
    oppRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    oppRowCompact: { flexDirection: 'column', alignItems: 'stretch', gap: 11 },
    oppLead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },
    oppRank: {
      width: 32,
      height: 32,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    oppCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 2 },
    oppTitle: { ...type.caption, color: t.text, fontWeight: '700' },
    oppMeta: { ...type.micro, color: t.textSubtle },

    oppMetaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
    oppImpact: { width: impactW, flexGrow: 0, flexShrink: 0, gap: 2 },
    oppImpactCompact: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 2 },
    oppImpactValue: { ...type.bodySm, color: t.text, fontWeight: '800' },
    oppLevel: { ...type.micro },

    oppConfidence: { width: confW, flexGrow: 0, flexShrink: 0, gap: 5 },
    oppConfidenceCompact: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 5 },
    oppConfidenceHead: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
    oppConfidenceValue: { ...type.bodySm, color: t.text, fontWeight: '800' },
    oppConfidenceLabel: { ...type.micro, color: t.textSubtle },
    oppTrack: {
      height: 5,
      borderRadius: 3,
      backgroundColor: t.surfaceInset,
      overflow: 'hidden',
    },
    oppTrackFill: { height: 5, borderRadius: 3 },

    reviewButton: {
      width: reviewW,
      minHeight: 44,
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 9,
      backgroundColor: t.surfaceMuted,
    },
    reviewButtonFull: { width: '100%', minHeight: 44 },
    reviewButtonPressed: { backgroundColor: t.surfaceInset },
    reviewLabel: { fontSize: 12.5, fontWeight: '700', color: t.brand },

    commandFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingTop: 4,
    },
    commandFootText: { ...type.micro, color: t.textMuted, flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- shared heads */
    head: { gap: 10, alignItems: l.isPhone ? 'flex-start' : 'center' },
    headTitle: { textAlign: l.isPhone ? 'left' : 'center' },
    headSub: { textAlign: l.isPhone ? 'left' : 'center', maxWidth: 680 },

    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      marginHorizontal: -cellPad,
      marginTop: (l.isPhone ? 20 : 28) - cellPad,
    },

    /* -------------------------------------------------- questions */
    questionWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: gridGap,
      marginTop: l.isPhone ? 20 : 28,
    },
    questionCell: {
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: cellPct(l.isPhone ? 1 : l.isTablet ? 2 : 3),
      minWidth: 0,
    },
    questionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      minHeight: 60,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 999,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    questionIcon: {
      width: 30,
      height: 30,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    questionText: { ...type.bodySm, color: t.text, fontWeight: '600', flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- steps */
    stepRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'stretch',
      marginTop: l.isPhone ? 20 : 28,
    },
    stepCell: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, alignSelf: 'stretch' },
    stepCard: { ...cardBase, height: '100%' },
    stepArrow: {
      flexGrow: 0,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: stacked ? 10 : 0,
      paddingHorizontal: stacked ? 0 : 8,
      alignSelf: 'center',
    },
    stepTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    stepIcon: {
      width: 44,
      height: 44,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepIndex: { ...type.h4, color: t.textSubtle, fontWeight: '800' },
    stepTitle: { marginTop: 2 },
    stepBody: { ...type.bodySm, color: t.textMuted },

    /* -------------------------------------------------- agents */
    agentList: { gap: gridGap, marginTop: l.isPhone ? 20 : 28 },
    agentRow: {
      ...cardBase,
      flexDirection: 'row',
      alignItems: l.isCompact ? 'flex-start' : 'center',
      gap: l.isPhone ? 14 : 18,
    },
    agentCopy: l.isCompact
      ? { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 6 }
      : {
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 'auto',
          minWidth: 0,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 24,
        },
    agentTitleCol: l.isCompact
      ? {}
      : { width: agentTitleWidth, flexGrow: 0, flexShrink: 0 },
    agentBodyCol: l.isCompact ? {} : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    agentIcon: {
      width: 46,
      height: 46,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    agentTitle: { marginTop: 0 },
    agentBody: { ...type.bodySm, color: t.textMuted, minWidth: 0 },

    /* -------------------------------------------------- context */
    contextRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: stacked ? 26 : 44,
    },
    contextCopy: stacked ? { width: '100%', minWidth: 0 } : { ...twoUp, paddingTop: 4 },
    contextTitle: { marginTop: 14 },
    contextBody: { marginTop: 14, maxWidth: 540 },
    contextPanel: stacked ? { width: '100%', minWidth: 0 } : twoUp,
    contextChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    contextChip: {
      flexGrow: 0,
      flexShrink: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 48,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 14,
      paddingVertical: 10,
      minWidth: 0,
    },
    contextChipIcon: {
      width: 28,
      height: 28,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    contextChipText: { ...type.caption, color: t.text, fontWeight: '700', flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- controls */
    controlCell: {
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: cellBasis(controlColumns),
      minWidth: 0,
      padding: cellPad,
    },
    controlCard: {
      ...cardBase,
      minHeight: l.isCompact ? 0 : 206,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      flexDirection: l.isCompact ? 'row' : 'column',
      alignItems: l.isCompact ? 'flex-start' : 'stretch',
      gap: l.isCompact ? 14 : 10,
    },
    controlCopy: l.isCompact
      ? { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 6 }
      : { width: '100%', minWidth: 0, gap: 10 },
    controlIcon: {
      width: 42,
      height: 42,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    controlTitle: { marginTop: l.isCompact ? 0 : 2 },
    controlBody: { ...type.bodySm, color: t.textMuted },

    assuranceWrap: { marginTop: l.isPhone ? 14 : 18 },
    assurance: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      borderWidth: 1,
      borderColor: hexToRgba(t.green, 0.35),
      borderRadius: 14,
      backgroundColor: t.successBg,
      paddingHorizontal: l.isPhone ? 14 : 20,
      paddingVertical: 16,
    },
    assuranceIcon: {
      width: 38,
      height: 38,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: hexToRgba(t.green, 0.16),
    },
    assuranceText: {
      ...type.bodySm,
      color: t.successText,
      fontWeight: '700',
      flexShrink: 1,
      minWidth: 0,
    },

    /* -------------------------------------------------- weekly briefing */
    briefRowOuter: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: stacked ? 26 : 44,
    },
    briefPanel: stacked ? { width: '100%', minWidth: 0 } : twoUp,
    briefCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 16 : 22,
      gap: 16,
      ...(elevation(t, 2) as object),
    },
    briefHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    briefHeadIcon: {
      width: 40,
      height: 40,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    briefHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    briefTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    briefSub: { ...type.micro, color: t.textMuted },
    briefList: { gap: 9 },
    briefRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      minHeight: 48,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    briefLabel: { ...type.caption, color: t.textMuted, flexShrink: 1, minWidth: 0 },
    briefValue: { ...type.h4, color: t.text, flexGrow: 0, flexShrink: 0 },
    briefChip: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 5,
      backgroundColor: t.chipBg,
    },
    briefChipText: { fontSize: 12, fontWeight: '800', color: t.chipText },

    briefCopy: stacked ? { width: '100%', minWidth: 0 } : { ...twoUp, paddingTop: 4 },
    briefCopyTitle: { marginTop: 14 },
    benefitList: { marginTop: 20, gap: 14 },
    benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    benefitTick: {
      width: 24,
      height: 24,
      marginTop: 1,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.green, t),
    },
    benefitText: { ...type.bodySm, color: t.text, flexShrink: 1, minWidth: 0 },
    briefButtons: { marginTop: 24 },
  });
}
