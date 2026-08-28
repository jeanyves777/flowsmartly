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
import { Reveal, useCountUp } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
import {
  ButtonRow,
  Heading,
  PrimaryButton,
  SecondaryButton,
  Band,
  OpenSection,
  SectionAside,
  SectionLabel,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { contactHref, goToEarlyAccess } from '@/lib/destinations';
import { accentText, elevation, hexToRgba, softFill, type ThemeTokens } from '@/theme/tokens';
import { BP, cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

type Accent = 'brand' | 'violet' | 'green' | 'orange' | 'pink';

const PROOF = ['Human-approved by default', 'No credit card', 'Leave the list anytime'];

/**
 * The queue FlowAgent has prepared, across six different organizations.
 *
 * This was a ranked opportunity table — projected impact and a confidence bar
 * per row, top five "opportunities found this week". That is a lead-generation
 * assistant, not an operating partner, and it was the loudest thing on the
 * page contradicting the positioning.
 */
type QueueItem = { title: string; where: string; icon: string; accent: Accent };

const QUEUE: QueueItem[] = [
  { title: 'Send document reminders to 12 tax clients', where: 'Email · Tax service', icon: 'file-invoice-dollar', accent: 'violet' },
  { title: 'Fill 3 open elder-care appointments', where: 'Calendar · Rostering', icon: 'hand-holding-heart', accent: 'pink' },
  { title: 'Publish the approved product campaign', where: 'Social · Store', icon: 'bullhorn', accent: 'brand' },
  { title: 'Send the NGO donor report', where: 'Documents · Email', icon: 'chart-pie', accent: 'green' },
  { title: 'Update holiday hours across 8 listings', where: 'Business listings', icon: 'location-dot', accent: 'orange' },
  { title: 'Approve the customer proposal PDF', where: 'Documents · E-signature', icon: 'file-signature', accent: 'brand' },
];

/**
 * Every piece of work is in exactly one of these, and the page says so —
 * "blocked by policy" and "needs more information" are the two that make the
 * difference between an operating partner and a thing that guesses.
 */
const STATES: { icon: string; label: string; count: string; note: string; accent: Accent }[] = [
  { icon: 'bolt', label: 'Working now', count: '4', note: 'Running inside your permissions', accent: 'brand' },
  { icon: 'circle-check', label: 'Waiting for approval', count: '6', note: 'Prepared, nothing sent', accent: 'green' },
  { icon: 'clipboard-check', label: 'Completed safely', count: '128', note: 'Verified, this month', accent: 'violet' },
  { icon: 'shield-halved', label: 'Blocked by policy', count: '1', note: 'A rule you set said no', accent: 'orange' },
  { icon: 'circle-question', label: 'Needs more information', count: '2', note: 'FlowAgent stopped to ask', accent: 'pink' },
];

/**
 * Cross-business, because the section claims one conversation across the whole
 * organization and six marketing questions would contradict it.
 *
 * The single marketing example is deliberately phrased as "what should we
 * review" rather than "where should the budget go" — the page should not imply
 * FlowAgent moves advertising money on its own.
 */
const QUESTIONS = [
  'What needs my attention today?',
  'Which client files are still incomplete?',
  'Prepare follow-ups for customers waiting on us.',
  'Which appointments still need coverage?',
  'Build a proposal for this qualified lead.',
  'Summarize what changed across my business this week.',
  'Which connected workflow is blocked, and why?',
  'Prepare the monthly donor and program report.',
  'What work can be completed safely without my approval?',
  'Show me every action waiting for review.',
  'Which campaign is underperforming, and what should we review?',
];

/**
 * The operating sequence, six steps.
 *
 * It used to be Detect, Recommend, Prepare, Approve & launch — a
 * recommendation feed with a publish button on the end. "Recommend" is now
 * "Understand", which is the step that actually happens there (context,
 * permissions, policy, workflow state), and Execute and Verify are named
 * rather than folded into "launch": carrying work out and confirming it landed
 * are different things, and the second is the one that makes the first
 * trustworthy.
 */
const STEPS: { icon: string; title: string; body: string; accent: Accent }[] = [
  {
    icon: 'magnifying-glass-chart',
    title: 'Detect',
    body: 'Identifies work, exceptions, requests and changes that need attention across your connected systems.',
    accent: 'brand',
  },
  {
    icon: 'brain',
    title: 'Understand',
    body: 'Applies your business context, permissions, policies and current workflow state.',
    accent: 'violet',
  },
  {
    icon: 'wand-magic-sparkles',
    title: 'Prepare',
    body: 'Researches, organizes, drafts and coordinates the work required to move the task forward.',
    accent: 'orange',
  },
  {
    icon: 'circle-check',
    title: 'Approve',
    body: 'Brings sensitive or consequential actions to the right person before execution.',
    accent: 'green',
  },
  {
    icon: 'bolt',
    title: 'Execute',
    body: 'Carries out approved work through registered capabilities and connected systems.',
    accent: 'pink',
  },
  {
    icon: 'clipboard-check',
    title: 'Verify',
    body: 'Confirms the result, records evidence and reports anything that remains incomplete or blocked.',
    accent: 'brand',
  },
];

/**
 * Capability groups, deliberately not an agent roster.
 *
 * This was seven named "agents" — Opportunity Audit, Campaign Builder, Customer
 * Journey Agent and so on — which claims seven autonomous reasoning agents
 * exist. Exactly one does (see OPPORTUNITY_STRATEGIST below). The rest of this
 * is work FlowAgent coordinates, so it is described as capability rather than
 * given a name and a personality it has not earned.
 *
 * Tones follow meaning, not rotation: blue for platform and analytics, violet
 * for creation, green for connection and completion, orange for service and
 * operations, pink for sales and customers.
 */
const CAPABILITIES: { icon: string; title: string; body: string; accent: Accent }[] = [
  {
    icon: 'list-check',
    title: 'Business operations',
    body: 'Coordinates tasks, approvals, documents, appointments and follow-ups.',
    accent: 'orange',
  },
  {
    icon: 'headset',
    title: 'Customer service',
    body: 'Prepares responses, manages reminders and supports human handoffs.',
    accent: 'orange',
  },
  {
    icon: 'wand-magic-sparkles',
    title: 'Content and communications',
    body: 'Creates branded content, campaigns, presentations and training materials.',
    accent: 'violet',
  },
  {
    icon: 'file-signature',
    title: 'Sales and proposals',
    body: 'Researches opportunities, prepares outreach and builds professional proposals.',
    accent: 'pink',
  },
  {
    icon: 'bag-shopping',
    title: 'Commerce',
    body: 'Supports products, orders, payments, customer journeys and recovery workflows.',
    accent: 'pink',
  },
  {
    icon: 'plug',
    title: 'Connected systems',
    body: 'Coordinates approved work across your website, CRM, email, SMS, calendar and store.',
    accent: 'green',
  },
  {
    icon: 'chart-column',
    title: 'Analytics and reporting',
    body: 'Prepares reports, identifies exceptions and explains verified outcomes.',
    accent: 'brand',
  },
  {
    icon: 'location-dot',
    title: 'Local presence',
    body: 'Coordinates listings, reviews, locations and business information.',
    accent: 'brand',
  },
];

/**
 * The one reasoning agent that is actually designed and locked.
 *
 * The `cannot` list is the more important half: a page that only advertises
 * reach is the kind a buyer stops trusting the first time something unexpected
 * happens.
 *
 * **Why nothing else here is called an agent is not the visitor's problem.**
 * The reasoning — declared inputs, outputs, permissions, verifiers, stop
 * conditions — lives in `AGENTS.md` and the architecture docs. What a buyer
 * needs from this section is the boundary, not its justification.
 */
const OPPORTUNITY_STRATEGIST = {
  name: 'Opportunity Strategist',
  headline: 'A specialist for complex opportunities',
  blurb:
    'The Opportunity Strategist analyzes business context, identifies needs, recommends the right outcomes, and structures proposal strategy. FlowAgent coordinates the surrounding research, approvals, documents, communications, and follow-up through controlled capabilities.',
  can: [
    'Interpret the business situation',
    'Identify needs and opportunities',
    'Recommend outcomes and services',
    'Structure the proposal strategy',
    'Surface assumptions and missing information',
  ],
  cannot: ['Send', 'Publish', 'Charge', 'Wait', 'Approve', 'Modify records'],
};

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
    body: 'Set a ceiling per campaign, per channel and per month. FlowAgent stops at the line.',
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

function QueueRow({
  item,
  accent,
  styles,
  t,
}: {
  item: QueueItem;
  accent: string;
  styles: Styles;
  t: ThemeTokens;
}) {
  return (
    <View style={styles.queueRow}>
      <View style={[styles.queueIcon, { backgroundColor: softFill(accent, t) }]}>
        <FontAwesome6 name={item.icon as never} size={14} color={accent} />
      </View>
      <View style={styles.queueCopy}>
        <Text numberOfLines={2} style={styles.queueTitle}>
          {item.title}
        </Text>
        <Text numberOfLines={1} style={styles.queueWhere}>
          {item.where}
        </Text>
      </View>
      {/*
        Mockup chrome. This card is a picture of the FlowAgent queue — there is
        no item behind the row to review, so the control is a View that merely
        looks like the real one. A button that invites a click and does nothing
        is worse than a static illustration of one.
      */}
      <View style={styles.reviewButton}>
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

  return (
    <PageShell
      title="FlowAgent"
      // 161 chars — the readiness audit fails a description over 165.
      description="FlowAgent turns an objective into planned, executed work: it coordinates agents and tools, acts within defined authority, and asks before anything consequential."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'FlowAgent', path: ROUTES.flowAgent },
        ]),
      ]}>
      {/* ------------------------------------------------ hero */}
      <OpenSection>
        <View style={styles.heroRow}>
          <Reveal style={styles.heroCopy} distance={16}>
            <SectionLabel>FLOWAGENT</SectionLabel>
            <Heading level={1} style={[type.h1, styles.heroTitle]}>
              The agentic layer that turns objectives into work.
            </Heading>
            <Text style={[type.body, styles.heroBody]}>
              FlowAgent understands an objective and the business context around it, builds a plan,
              coordinates specialized agents and the tools they are allowed to operate, executes the
              steps, requests approval where your rules require it, observes the real result,
              recovers when something fails, and continues from what it learned.
            </Text>
            <Text style={[type.body, styles.heroBody]}>
              Not a chatbot. Not a fixed automation. A system designed to move work forward — inside
              the authority you define.
            </Text>
            <View style={styles.heroButtons}>
              <ButtonRow>
                <PrimaryButton
                  label="Join early access"
                  size="lg"
                  full={l.isPhone}
                  trackId="flowagent.hero.try"
                  onPress={() => goToEarlyAccess()}
                />
                {/* No walkthrough video exists — this books a real demo rather
                    than opening a player with nothing behind it. */}
                <SecondaryButton
                  label="Watch how it works"
                  size="lg"
                  icon="play"
                  full={l.isPhone}
                  trackId="flowagent.hero.watch-demo"
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
                  <Text style={styles.commandTitle}>Needs your approval</Text>
                  <Text style={styles.commandSub}>Prepared by FlowAgent</Text>
                </View>
                <View style={styles.commandChip}>
                  <View style={styles.commandDot} />
                  <Text style={styles.commandChipText}>Live</Text>
                </View>
              </View>

              <View style={styles.oppList}>
                {QUEUE.map((item) => (
                  <QueueRow
                    key={item.title}
                    item={item}
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
      </OpenSection>

      {/* ------------------------------------------------ the five states */}
      <Band tone="surface" art={{ variant: 'analytics', color: t.brand, side: 'right' }}>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>WHERE THE WORK IS</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>
            Every piece of work is in exactly one of five states.
          </Heading>
          <Text style={[type.body, styles.headSub]}>
            No black box. You can always see what FlowAgent is doing, what it finished, and the two
            reasons it stopped.
          </Text>
        </Reveal>

        <View style={styles.stateRow}>
          {STATES.map((state, index) => {
            const accent = accentOf(state.accent);
            return (
              <Reveal key={state.label} style={styles.stateCell} distance={14} delay={index * 60}>
                <View style={styles.state}>
                  <View style={styles.stateTop}>
                    <View style={[styles.stateIcon, { backgroundColor: softFill(accent, t) }]}>
                      <FontAwesome6 name={state.icon as never} size={15} color={accent} />
                    </View>
                    <Text style={[styles.stateCount, { color: accentText(accent, t) }]}>{state.count}</Text>
                  </View>
                  <Text numberOfLines={2} style={styles.stateLabel}>
                    {state.label}
                  </Text>
                  <Text numberOfLines={2} style={styles.stateNote}>
                    {state.note}
                  </Text>
                </View>
              </Reveal>
            );
          })}
        </View>
      </Band>

      {/* ------------------------------------------------ one conversation */}
      <OpenSection>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>ASK ANYTHING</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>
            One conversation across your whole business.
          </Heading>
          <Text style={[type.body, styles.headSub]}>
            No dashboard hopping and no exports. Ask in your own words and FlowAgent answers from the
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
      </OpenSection>

      {/* ------------------------------------------------ insight to impact */}
      <Band tone="surface" art={{ variant: 'network', color: t.brand, side: 'left' }}>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>THE WORKING LOOP</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>
            The same six steps, whatever the work is.
          </Heading>
          <Text style={[type.body, styles.headSub]}>
            Detect, understand, prepare, approve, execute, verify — then round again, carrying what
            the last pass learned. Step four is always yours, and step six is how you know the rest
            of it actually happened.
          </Text>
        </Reveal>

        {/*
          A numbered grid, not a single arrowed row. Four steps fitted across a
          line; six leave about 195px each, which is not enough for a title and
          a sentence. The 01-06 numerals carry the sequence instead, and the
          connecting arrow survives only on phone, where the cards genuinely
          are a single column.
        */}
        <View style={styles.stepRow}>
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
                {l.isPhone && index < STEPS.length - 1 ? (
                  <View style={styles.stepArrow}>
                    <FontAwesome6 name="arrow-down" size={14} color={t.borderStrong} />
                  </View>
                ) : null}
              </Fragment>
            );
          })}
        </View>
      </Band>

      {/* ------------------------------------------------ capability groups */}
      <OpenSection>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>ACROSS THE CAPABILITY GROUPS</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>
            One agentic layer, over every group.
          </Heading>
          <Text style={[type.body, styles.headSub]}>
            Eight areas of work it can prepare and coordinate, reaching across business and growth,
            operations and intelligence — all against the same context, so what it proposes in one
            never contradicts what it proposed in another.
          </Text>
        </Reveal>

        {/*
          Capability groups, not a roster of named agents. Eight rows rather
          than a grid: the group's name holds its own column beside the
          description, so the width a fourth card would waste carries copy.
        */}
        <View style={styles.agentList}>
          {CAPABILITIES.map((group, index) => {
            const accent = accentOf(group.accent);
            return (
              <Reveal key={group.title} distance={16} delay={index * 55}>
                <View style={styles.agentRow}>
                  <View style={[styles.agentIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={group.icon as never} size={19} color={accent} />
                  </View>
                  <View style={styles.agentCopy}>
                    <Text style={[type.h4, styles.agentTitle, styles.agentTitleCol]}>
                      {group.title}
                    </Text>
                    <Text style={[styles.agentBody, styles.agentBodyCol]}>{group.body}</Text>
                  </View>
                </View>
              </Reveal>
            );
          })}
        </View>
      </OpenSection>

      {/* ------------------------------------------------ the one named agent */}
      <Band tone="violet" art={{ variant: 'funnel', color: t.violet, side: 'right' }}>
        <View style={styles.strategistRow}>
          <Reveal style={styles.strategistCopy} distance={16}>
            <SectionLabel>OPPORTUNITY STRATEGIST</SectionLabel>
            <Heading level={2} style={[type.h2, styles.headTitle, styles.strategistTitle]}>
              {OPPORTUNITY_STRATEGIST.headline}
            </Heading>
            <Text style={[type.body, styles.headSub, styles.strategistBody]}>
              {OPPORTUNITY_STRATEGIST.blurb}
            </Text>
          </Reveal>

          <Reveal style={styles.strategistPanel} distance={16} delay={90}>
            <View style={styles.strategistCard}>
              <Text style={styles.strategistCardTitle}>It can</Text>
              {OPPORTUNITY_STRATEGIST.can.map((item) => (
                <View key={item} style={styles.strategistCanRow}>
                  <View style={styles.strategistTick}>
                    <FontAwesome6 name="check" size={10} color={t.green} />
                  </View>
                  <Text style={styles.strategistCanText}>{item}</Text>
                </View>
              ))}

              <View style={styles.strategistDivider} />

              <Text style={styles.strategistCardTitle}>It never acts directly</Text>
              <View style={styles.strategistCannotWrap}>
                {OPPORTUNITY_STRATEGIST.cannot.map((item) => (
                  <Text key={item} style={styles.strategistCannot}>
                    {item}
                  </Text>
                ))}
              </View>
            </View>
          </Reveal>
        </View>
      </Band>

      {/* ------------------------------------------------ context */}
      <OpenSection>
        <View style={styles.contextRow}>
          <Reveal style={styles.contextCopy} distance={16}>
            <SectionLabel>GROUNDED IN YOUR DATA</SectionLabel>
            <Heading level={2} style={[type.h2, styles.contextTitle]}>
              AI that understands your business.
            </Heading>
            <Text style={[type.body, styles.contextBody]}>
              Generic AI writes generic work. FlowAgent is briefed on everything your account already
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
      </OpenSection>

      {/* ------------------------------------------------ control */}
      <Band tone="brand" art={{ variant: 'shield', color: t.brand, side: 'left' }}>
        <Reveal style={styles.head} distance={16}>
          <SectionLabel>GUARDRAILS</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitle]}>
            You&apos;re in control—always.
          </Heading>
          <Text style={[type.body, styles.headSub]}>
            Authority is a dial, not a switch — agentic is not the same word as unsupervised.
            Every one of these settings is yours before a single agent runs.
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
              Human-approved by default. FlowAgent never launches anything without your approval.
            </Text>
          </View>
        </Reveal>
      </Band>

      {/* ------------------------------------------------ weekly briefing */}
      <OpenSection>
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
              An operating partner that reports to you.
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
                  label="Join early access"
                  full={l.isPhone}
                  trackId="flowagent.briefing.try"
                  onPress={() => goToEarlyAccess()}
                />
                <SecondaryButton
                  label="See the platform"
                  full={l.isPhone}
                  trackId="flowagent.briefing.see-platform"
                  onPress={() => router.push(ROUTES.product as never)}
                />
              </ButtonRow>
            </View>
          </Reveal>
        </View>
      </OpenSection>
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

    /* -------------------------------------------------- the five states */
    // Five across once there is room, 2-up on tablet, stacked on phone. Cells
    // do not grow, so a wrapped last row keeps the column grid instead of
    // stretching one orphan across it.
    stateRow: {
      marginTop: l.isPhone ? 18 : 26,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      marginHorizontal: -6,
    },
    stateCell: {
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: l.isPhone ? '100%' : l.isStacked ? '50%' : '20%',
      minWidth: 0,
      padding: 6,
    },
    state: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      borderTopWidth: 2,
      borderTopColor: t.border,
      paddingTop: 14,
      gap: 6,
    },
    stateTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    stateIcon: {
      width: 34,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stateCount: { ...type.h3, flexShrink: 1, minWidth: 0, textAlign: 'right' },
    stateLabel: { ...type.caption, color: t.text, fontWeight: '800' },
    stateNote: { ...type.micro, color: t.textSubtle },

    oppList: { gap: 8 },
    // One row per queued item: icon, what it is and where it lands, and a
    // mock Review control. The confidence bar and projected-impact column that
    // used to live here went with the opportunity table.
    queueRow: {
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
    queueIcon: {
      width: 32,
      height: 32,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    queueCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 2 },
    queueTitle: { ...type.caption, color: t.text, fontWeight: '700' },
    queueWhere: { ...type.micro, color: t.textSubtle },

    reviewButton: {
      minHeight: 44,
      paddingHorizontal: 14,
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
    // Three across once there is room, two on tablet, one on phone. Cells do
    // not grow, so the second row keeps the first row's column grid instead of
    // stretching three cards across the full width.
    stepRow: {
      flexDirection: l.isPhone ? 'column' : 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      marginTop: l.isPhone ? 20 : 28,
      marginHorizontal: l.isPhone ? 0 : -7,
    },
    stepCell: l.isPhone
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' }
      : {
          flexGrow: 0,
          flexShrink: 0,
          flexBasis: l.isCompact ? '50%' : '33.333%',
          minWidth: 0,
          padding: 7,
        },
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
    /* -------------------------------------------------- the one named agent */
    strategistRow: {
      flexDirection: l.isStacked ? 'column' : 'row',
      alignItems: l.isStacked ? 'stretch' : 'center',
      gap: l.isStacked ? 26 : 44,
    },
    strategistCopy: l.isStacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0, gap: 14 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 14 },
    strategistTitle: { textAlign: 'left' },
    strategistBody: { textAlign: 'left', maxWidth: 520 },
    strategistPanel: l.isStacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 }
      : { flexGrow: 0.9, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    strategistCard: {
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 18,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 16 : 20,
      gap: 10,
      ...(elevation(t, 1) as ViewStyle),
    },
    strategistCardTitle: { ...type.caption, color: t.text, fontWeight: '800' },
    strategistCanRow: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 11 },
    strategistTick: {
      width: 20,
      height: 20,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      backgroundColor: t.successBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    strategistCanText: { ...type.bodySm, color: t.text, flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    strategistDivider: { height: 1, backgroundColor: t.divider, marginVertical: 6 },
    // Bare words on a warn ground: a list of things that never happen should
    // not look like a feature list with ticks beside it.
    strategistCannotWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
    strategistCannot: {
      ...type.micro,
      color: t.warnText,
      backgroundColor: t.warnBg,
      fontWeight: '700',
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 5,
      overflow: 'hidden',
    },

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
