import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View, type ImageStyle, type ViewStyle } from 'react-native';
import { CustomAutomationPanel } from '@/components/public/custom-automation-panel';
import { Media } from '@/components/public/media';
import { Reveal } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd, faqJsonLd } from '@/components/public/seo';
import {
  Band,
  ButtonRow,
  Heading,
  OpenSection,
  PrimaryButton,
  SecondaryButton,
  SectionLabel,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { contactHref } from '@/lib/destinations';
import { accentText, elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/**
 * The second way to work with FlowSmartly.
 *
 * Self-serve is unchanged and still the front door. This page is the premium
 * lane beside it: a business tells us how it actually operates, and skills and
 * workflows get built around that operation rather than a plan tier.
 *
 * Everything here describes work a person has to do for every business that
 * asks, so the copy commits to a process and never to an outcome, a timeline or
 * a customer we have not had.
 */

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

const STEPS: { icon: string; title: string; body: string }[] = [
  {
    icon: 'magnifying-glass',
    title: 'Show us how your business works',
    body: 'We learn your processes, systems, team responsibilities and pain points.',
  },
  {
    icon: 'clock-rotate-left',
    title: 'Find the work worth automating',
    body: 'Together we identify repetitive tasks, delays, manual updates and opportunities to save time.',
  },
  {
    icon: 'plug',
    title: 'Connect the right systems',
    body: 'We determine which integrations, data and permissions are needed.',
  },
  {
    icon: 'screwdriver-wrench',
    title: 'Build your custom skills',
    body: 'We create isolated FlowAgent skills and workflows specifically for your organization.',
  },
  {
    icon: 'circle-check',
    title: 'Test and approve',
    body: 'Important actions stay controlled, observable and appropriate for your business.',
  },
  {
    icon: 'arrow-trend-up',
    title: 'Keep improving',
    body: 'As your business and technology change, we help identify new opportunities to automate and modernize.',
  },
];

/** The hero's three-up proof row. */
const TRUST: { icon: string; title: string; body: string }[] = [
  { icon: 'handshake', title: 'One-to-one engagement', body: 'No generic solutions' },
  { icon: 'fingerprint', title: 'Built for your business', body: 'Not shared. Not published.' },
  { icon: 'shield-halved', title: 'Backed by GCS Tech', body: 'The team behind FlowSmartly' },
];

/** What the engagement gives you, said as capabilities rather than as process. */
const CAPABILITIES: { icon: string; title: string; body: string; tone: 'brand' | 'violet' | 'green' | 'orange' | 'pink' }[] = [
  { icon: 'users', title: 'One-to-one collaboration', body: 'Real conversations with real people who learn how your business runs.', tone: 'violet' },
  { icon: 'plug', title: 'Deep integration', body: 'We connect the systems you already use, with the permissions they need and no more.', tone: 'brand' },
  { icon: 'lock', title: 'Isolated and scoped', body: 'Your data, your rules, your environment — built for your organization.', tone: 'pink' },
  { icon: 'clock', title: 'Time-saving focus', body: 'We start with the repeated work that costs your team the most hours.', tone: 'orange' },
  { icon: 'headset', title: 'Ongoing guidance', body: 'We stay with you to find new opportunities as the business changes.', tone: 'green' },
  { icon: 'screwdriver-wrench', title: 'Backed by GCS Tech', body: 'The technology team behind FlowSmartly, implementing what actually works.', tone: 'brand' },
];

/** What GCS Tech works on, as chips beside the photograph. */
const DISCIPLINES = ['AI and automation', 'Integrations', 'Workflow design', 'Ongoing optimisation'];

/** Mirrors `/pricing` exactly — a second copy of a price is a second thing to
 *  keep true, so this is the shortest possible restatement and links there. */
const PLAN_STRIP: { name: string; price: string; note: string }[] = [
  { name: 'Starter', price: 'Free', note: 'No card required' },
  { name: 'Pro', price: '$20', note: 'per month' },
  { name: 'Business', price: '$50', note: 'per month' },
];

const CONTRAST: { kind: 'not' | 'is'; title: string; lines: string[] }[] = [
  {
    kind: 'not',
    title: 'Not a generic agent on a plan tier',
    lines: [
      'Not a public marketplace skill shared across every customer.',
      'Not a subscription that quietly changes what the agent will do for you.',
      'Not a template you are left to adapt to your own operation.',
    ],
  },
  {
    kind: 'is',
    title: 'Built for your operation',
    lines: [
      'Designed around your workflows, systems, permissions and business rules.',
      'Scoped to your organization, not published for everyone.',
      'Implemented and verified with you, then adjusted as your business changes.',
    ],
  },
];

const FAQ = [
  {
    question: 'How is this different from the standard FlowSmartly plans?',
    answer:
      'The plans give you the platform and FlowAgent capabilities to use yourself. Custom AI Automation adds a one-to-one engagement: we learn how your business operates and build skills and workflows specifically around it.',
  },
  {
    question: 'What does "custom skill" actually mean?',
    answer:
      'A FlowAgent skill and the workflow around it, designed for your systems, permissions and business rules. It is scoped to your organization rather than published to every customer.',
  },
  {
    question: 'What does it cost?',
    answer:
      'Custom automation projects are scoped around your workflows, integrations and implementation needs, so pricing is quoted per project rather than listed as a monthly plan.',
  },
  {
    question: 'Do we have to leave our current tools?',
    answer:
      'No. Identifying which integrations, data and permissions make the automation possible is part of the engagement — connecting what you already run is usually the point.',
  },
];

/* ------------------------------------------------------------------ */
/* shared style hook                                                   */
/* ------------------------------------------------------------------ */

type Styles = ReturnType<typeof createStyles>;

function useStyles(): Styles {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  return useMemo(() => createStyles(t, l, type), [t, l, type]);
}

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

function TrustRow() {
  const styles = useStyles();
  const t = useTokens();
  return (
    <View style={styles.trustRow}>
      {TRUST.map((item) => (
        <View key={item.title} style={styles.trustItem}>
          <View style={[styles.trustIcon, { backgroundColor: softFill(t.brand, t) }]}>
            <FontAwesome6 name={item.icon as never} size={13} color={t.brand}  aria-hidden={true}/>
          </View>
          <View style={styles.trustCopy}>
            <Text style={styles.trustTitle}>{item.title}</Text>
            <Text style={styles.trustBody}>{item.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function Hero() {
  const styles = useStyles();
  const l = useLayout();
  const router = useRouter();

  return (
    <OpenSection style={styles.hero}>
      <Reveal style={styles.heroRow} distance={16}>
        <View style={styles.heroCopy}>
          <SectionLabel>BUILT AROUND YOUR BUSINESS</SectionLabel>
          <Heading level={1} style={styles.heroTitle}>
            Your business doesn&apos;t work like everyone else&apos;s. Your AI automation
            shouldn&apos;t either.
          </Heading>
          <Text style={styles.heroBody}>
            Tell us how your business works, where your team loses time, and which systems you
            depend on. We work with you one-to-one to design custom FlowAgent skills and workflows
            built specifically around your operation.
          </Text>

          <View style={styles.heroButtons}>
            <ButtonRow>
              <PrimaryButton
                label="Request a custom automation demo"
                size="lg"
                icon="arrow-right"
                iconRight
                full={l.isPhone}
                trackId="custom-automation.hero.demo"
                onPress={() => router.push(contactHref('custom-automation') as never)}
              />
              <SecondaryButton
                label="Tell us what you want to automate"
                size="lg"
                full={l.isPhone}
                trackId="custom-automation.hero.tell-us"
                onPress={() => router.push(contactHref('custom-automation') as never)}
              />
            </ButtonRow>
          </View>
        </View>

        <View style={styles.heroPanel}>
          <CustomAutomationPanel />
        </View>
      </Reveal>

      <TrustRow />
    </OpenSection>
  );
}

function HowItWorks() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();

  // Six steps: a column count has to divide the item count or the last row is
  // an orphan. 3 and 2 both divide 6; 1 on a phone.
  const columns = l.isPhone ? 1 : l.isStacked ? 2 : 3;

  return (
    <Band tone="orange" art={{ variant: 'tasks', color: t.orange, side: 'right' }}>
      <Reveal style={styles.head} distance={14}>
        <Heading level={2} style={styles.headTitle}>
          How the engagement works
        </Heading>
        <Text style={styles.headBody}>
          Six steps, in order. Nothing gets built before we understand the operation it is for.
        </Text>
      </Reveal>

      <View style={styles.grid}>
        {STEPS.map((step, index) => (
          <Reveal
            key={step.title}
            delay={50 + index * 55}
            distance={12}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <View style={styles.stepCard}>
              <View style={styles.stepTop}>
                <View style={[styles.stepNumber, { backgroundColor: softFill(t.orange, t) }]}>
                  <Text style={[styles.stepNumberText, { color: accentText(t.orange, t) }]}>
                    {index + 1}
                  </Text>
                </View>
                <FontAwesome6 name={step.icon as never} size={15} color={t.textSubtle}  aria-hidden={true}/>
              </View>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepBody}>{step.body}</Text>
            </View>
          </Reveal>
        ))}
      </View>
    </Band>
  );
}

function BuiltForYou() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();

  const accent = (tone: (typeof CAPABILITIES)[number]['tone']) =>
    tone === 'violet' ? t.violet : tone === 'green' ? t.green : tone === 'orange' ? t.orange : tone === 'pink' ? t.pink : t.brand;

  // Six cards: 3 and 2 both divide six, so no row is ever left with an orphan.
  const columns = l.isPhone ? 1 : l.isStacked ? 2 : 3;

  return (
    <Band tone="violet" art={{ variant: 'network', color: t.violet, side: 'left' }}>
      <Reveal style={styles.head} distance={14}>
        <Heading level={2} style={styles.headTitle}>
          Built for your operation — not published for everyone.
        </Heading>
        <Text style={styles.headBody}>
          Custom skills are designed around your workflows, systems, permissions and business rules.
          They are not generic marketplace agents shared across customers.
        </Text>
      </Reveal>

      <View style={styles.grid}>
        {CAPABILITIES.map((item, index) => {
          const color = accent(item.tone);
          return (
            <Reveal
              key={item.title}
              delay={50 + index * 55}
              distance={12}
              style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
              <View style={styles.capabilityCard}>
                <View style={[styles.capabilityIcon, { backgroundColor: softFill(color, t) }]}>
                  <FontAwesome6 name={item.icon as never} size={16} color={color}  aria-hidden={true}/>
                </View>
                <Text style={styles.stepTitle}>{item.title}</Text>
                <Text style={styles.stepBody}>{item.body}</Text>
              </View>
            </Reveal>
          );
        })}
      </View>
    </Band>
  );
}

function BackedByGcs() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const router = useRouter();

  return (
    <Band tone="brand" art={{ variant: 'support', color: t.brand, side: 'right' }}>
      <Reveal style={styles.backedRowWide} distance={14}>
        <View style={styles.backedBlock}>
          <Heading level={2} style={styles.headTitle}>
            Technology changes fast. You don&apos;t have to chase it alone.
          </Heading>
          <Text style={styles.backedBody}>
            FlowSmartly is backed by GCS Tech, the team building the platform and helping businesses
            apply today&apos;s AI, automation and connected technologies to real operational needs.
            We don&apos;t just give you software and leave you to figure it out — we help identify
            where technology can actually save your team time and keep your business current.
          </Text>

          <View style={styles.chipRow}>
            {DISCIPLINES.map((label) => (
              <View key={label} style={styles.chip}>
                <Text style={styles.chipText}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.backedButton}>
            <PrimaryButton
              label="Request a custom automation demo"
              icon="arrow-right"
              iconRight
              full={l.isPhone}
              trackId="custom-automation.backed.demo"
              onPress={() => router.push(contactHref('custom-automation') as never)}
            />
          </View>
        </View>

        <View style={styles.backedArt}>
          {/* Deliberately an illustration rather than a photograph of people.
              The copy beside it says "GCS Tech, the team building the
              platform", and a stock portrait next to that sentence reads as a
              picture of that team. A real one is requested in
              ART-REQUESTS.md; until it lands, nothing here implies a person
              who has not agreed to appear. */}
          <Media
            name="editorial/resource-automation"
            alt="Connected systems and automated steps running as one flow"
            style={styles.backedImage}
            radius={16}
          />
        </View>
      </Reveal>
    </Band>
  );
}

/**
 * The bridge back to self-serve.
 *
 * This page exists beside the plans, not instead of them, so it says so and
 * hands the visitor who does not want an engagement somewhere real to go. The
 * prices restate `/pricing` and link to it rather than trying to be a second
 * pricing table.
 */
function PreferSelfServe() {
  const styles = useStyles();
  const l = useLayout();
  const router = useRouter();

  return (
    <OpenSection art="none">
      <Reveal style={styles.selfServeCard} distance={14}>
        <View style={styles.selfServeCopy}>
          <Heading level={2} style={styles.selfServeTitle}>
            Prefer to try it on your own?
          </Heading>
          <Text style={styles.selfServeBody}>
            The standard platform is self-serve and always has been — content, commerce,
            communications and analytics, with FlowAgent alongside. Start there and talk to us when
            a workflow needs building around you.
          </Text>
          <View style={styles.selfServeButton}>
            <SecondaryButton
              label="Explore plans and start free"
              icon="arrow-right"
              iconRight
              full={l.isPhone}
              trackId="custom-automation.selfserve.plans"
              onPress={() => router.push(ROUTES.pricing as never)}
            />
          </View>
        </View>

        <View style={styles.planStrip}>
          {PLAN_STRIP.map((plan) => (
            <View key={plan.name} style={styles.planTile}>
              <Text style={styles.planName}>{plan.name}</Text>
              <Text style={styles.planPrice}>{plan.price}</Text>
              <Text style={styles.planNote}>{plan.note}</Text>
            </View>
          ))}
          <View style={[styles.planTile, styles.planTileCustom]}>
            <Text style={[styles.planName, styles.planNameCustom]}>Custom AI Automation</Text>
            <Text style={[styles.planPrice, styles.planPriceCustom]}>Custom</Text>
            <Text style={[styles.planNote, styles.planNoteCustom]}>Scoped per project</Text>
          </View>
        </View>
      </Reveal>
    </OpenSection>
  );
}

function Close() {
  const styles = useStyles();
  const l = useLayout();
  const router = useRouter();

  return (
    <OpenSection style={styles.close} art="none">
      <Reveal style={styles.closeInner} distance={14}>
        <Heading level={2} style={styles.closeTitle}>
          Start with a conversation about how you actually work.
        </Heading>
        <Text style={styles.closeBody}>
          Tell us what your team repeats every week. That is usually where the first automation is.
        </Text>
        <View style={styles.closeButtons}>
          <ButtonRow>
            <PrimaryButton
              label="Request a custom automation demo"
              size="lg"
              icon="arrow-right"
              iconRight
              full={l.isPhone}
              trackId="custom-automation.close.demo"
              onPress={() => router.push(contactHref('custom-automation') as never)}
            />
            <SecondaryButton
              label="See the standard plans"
              size="lg"
              full={l.isPhone}
              trackId="custom-automation.close.plans"
              onPress={() => router.push(ROUTES.pricing as never)}
            />
          </ButtonRow>
        </View>
      </Reveal>
    </OpenSection>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function CustomAutomationPage() {
  return (
    <PageShell
      title="Custom AI Automation"
      description="Tell us how your business works and where your team loses time. We design custom FlowAgent skills and workflows one-to-one, around your operation not a plan tier."
      /* The site-wide growth CTA is the self-serve "Join early access".
         This page's whole point is the one-to-one path, so it closes with
         its own. */
      cta={false}
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Solutions', path: ROUTES.solutions },
          { name: 'Custom AI Automation', path: ROUTES.customAutomation },
        ]),
        faqJsonLd(FAQ),
      ]}>
      <Hero />
      <HowItWorks />
      <BuiltForYou />
      <BackedByGcs />
      <PreferSelfServe />
      <Close />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  /** declared apart from the sheet: StyleSheet.create widens '100%' to string,
   *  which no longer satisfies ImageStyle */
  const backedImage: ImageStyle = { width: '100%', height: l.isPhone ? 210 : 300 };

  /** half the grid gutter; cells carry it as padding so wrapped rows stay flush */
  const cellPad = l.isPhone ? 5 : 7;

  const cardBase: ViewStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    backgroundColor: t.surfaceRaised,
    padding: l.isPhone ? 16 : 18,
    // one height per row: the card fills its cell rather than its content
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    ...(elevation(t, 1) as ViewStyle),
  };

  const sheet = StyleSheet.create({
    /* hero --------------------------------------------------------- */
    hero: { paddingTop: l.isPhone ? 26 : 40 },
    heroRow: {
      flexDirection: l.isStacked ? 'column' : 'row',
      alignItems: l.isStacked ? 'stretch' : 'center',
      gap: l.isStacked ? 26 : 40,
    },
    heroCopy: l.isStacked
      ? { width: '100%', minWidth: 0, gap: 16 }
      : { flexGrow: 1.05, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 16 },
    heroPanel: l.isStacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    heroTitle: type.display,
    heroBody: { ...type.body, maxWidth: 620 },
    heroButtons: { marginTop: 4 },

    /* trust row ---------------------------------------------------- */
    trustRow: {
      flexDirection: l.isPhone ? 'column' : 'row',
      flexWrap: 'wrap',
      gap: l.isPhone ? 14 : 28,
      marginTop: l.isPhone ? 22 : 30,
      paddingTop: l.isPhone ? 18 : 22,
      borderTopWidth: 1,
      borderTopColor: t.divider,
    },
    trustItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: l.isPhone ? 'auto' : 220,
      minWidth: 0,
    },
    trustIcon: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      flexGrow: 0,
      flexShrink: 0,
    },
    trustCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 1 },
    trustTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    trustBody: { ...type.micro, color: t.textMuted },

    /* capability cards --------------------------------------------- */
    capabilityCard: { ...cardBase, gap: 10 },
    capabilityIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexGrow: 0,
      flexShrink: 0,
    },

    /* backed by ---------------------------------------------------- */
    backedRowWide: {
      flexDirection: l.isStacked ? 'column' : 'row',
      alignItems: l.isStacked ? 'stretch' : 'center',
      gap: l.isStacked ? 22 : 38,
    },
    backedArt: l.isStacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceRaised,
    },
    chipText: { ...type.micro, color: t.textMuted, fontWeight: '700' },
    backedButton: { marginTop: 8 },

    /* self-serve bridge -------------------------------------------- */
    selfServeCard: {
      flexDirection: l.isStacked ? 'column' : 'row',
      alignItems: l.isStacked ? 'stretch' : 'center',
      gap: l.isStacked ? 22 : 36,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surface,
      padding: l.isPhone ? 20 : 28,
    },
    selfServeCopy: l.isStacked
      ? { width: '100%', minWidth: 0, gap: 10 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 10 },
    selfServeTitle: type.h3,
    selfServeBody: { ...type.bodySm, color: t.textMuted, maxWidth: 560 },
    selfServeButton: { marginTop: 6 },
    planStrip: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 9,
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: l.isStacked ? 'auto' : 430,
      minWidth: 0,
    },
    planTile: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 92,
      minWidth: 0,
      gap: 2,
      paddingVertical: 13,
      paddingHorizontal: 12,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceRaised,
    },
    planTileCustom: { borderColor: t.violet, backgroundColor: softFill(t.violet, t) },
    planName: { ...type.micro, color: t.textMuted, fontWeight: '800' },
    planNameCustom: { color: accentText(t.violet, t) },
    planPrice: { ...type.h4, color: t.text },
    planPriceCustom: { color: accentText(t.violet, t) },
    planNote: { ...type.micro, color: t.textSubtle },
    planNoteCustom: { color: accentText(t.violet, t) },

    /* section heads ------------------------------------------------ */
    head: { gap: 10, maxWidth: 720 },
    headTitle: type.h2,
    headBody: type.body,

    /* grid --------------------------------------------------------- */
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      marginHorizontal: -cellPad,
      marginTop: 22 - cellPad,
    },
    cell: { flexGrow: 0, flexShrink: 0, minWidth: 0, padding: cellPad },

    /* steps -------------------------------------------------------- */
    stepCard: { ...cardBase, gap: 10 },
    stepTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    stepNumber: {
      width: 30,
      height: 30,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      flexGrow: 0,
      flexShrink: 0,
    },
    stepNumberText: { ...type.bodySm, fontWeight: '800' },
    stepTitle: { ...type.h4, color: t.text },
    stepBody: { ...type.bodySm, color: t.textMuted },

    /* contrast ----------------------------------------------------- */
    contrastCard: { ...cardBase, gap: 14, backgroundColor: t.surfaceMuted },
    contrastCardActive: { backgroundColor: t.surfaceRaised, borderColor: t.violet },
    contrastHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    contrastTitle: { ...type.h4, color: t.text, flexShrink: 1, minWidth: 0 },
    contrastList: { gap: 10 },
    contrastRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    contrastDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginTop: 8,
      flexGrow: 0,
      flexShrink: 0,
    },
    contrastText: {
      ...type.bodySm,
      color: t.textMuted,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },

    /* backed by ---------------------------------------------------- */
    backedBlock: { gap: 12, maxWidth: 760 },
    backedBody: { ...type.body, maxWidth: 720 },

    /* close -------------------------------------------------------- */
    close: { alignItems: 'center' },
    closeInner: { alignItems: 'center', gap: 12, maxWidth: 700, width: '100%' },
    closeTitle: { ...type.h2, textAlign: 'center' },
    closeBody: { ...type.body, textAlign: 'center', maxWidth: 580 },
    closeButtons: { marginTop: 6, alignSelf: 'stretch', alignItems: 'center' },
  });

  return { ...sheet, backedImage };
}
