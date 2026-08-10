import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
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

/** The one place the parent company is named outside the legal pages. */
function BackedByLine() {
  const styles = useStyles();
  const t = useTokens();
  return (
    <View style={styles.backedRow}>
      <FontAwesome6 name="shield-halved" size={13} color={t.brand} style={styles.backedIcon} />
      <Text style={styles.backedText}>
        <Text style={styles.backedStrong}>Supported by GCS Tech</Text>
        {' — the technology team behind FlowSmartly.'}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* sections                                                            */
/* ------------------------------------------------------------------ */

function Hero() {
  const styles = useStyles();
  const l = useLayout();
  const router = useRouter();

  return (
    <OpenSection style={styles.hero}>
      <Reveal style={styles.heroCopy} distance={16}>
        <SectionLabel>BUILT AROUND YOUR BUSINESS</SectionLabel>
        <Heading level={1} style={styles.heroTitle}>
          Your business doesn&apos;t work like everyone else&apos;s. Your AI automation
          shouldn&apos;t either.
        </Heading>
        <Text style={styles.heroBody}>
          Tell us how your business works, where your team loses time, and which systems you depend
          on. We work with you one-to-one to design custom FlowAgent skills and workflows built
          specifically around your operation.
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

        <BackedByLine />
      </Reveal>
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
                <FontAwesome6 name={step.icon as never} size={15} color={t.textSubtle} />
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

  const columns = l.isStacked ? 1 : 2;

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
        {CONTRAST.map((column, index) => {
          const positive = column.kind === 'is';
          const color = positive ? t.violet : t.textSubtle;
          return (
            <Reveal
              key={column.title}
              delay={50 + index * 70}
              distance={12}
              style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
              <View style={[styles.contrastCard, positive ? styles.contrastCardActive : null]}>
                <View style={styles.contrastHead}>
                  <FontAwesome6
                    name={positive ? 'circle-check' : 'circle-xmark'}
                    size={16}
                    color={color}
                  />
                  <Text style={styles.contrastTitle}>{column.title}</Text>
                </View>
                <View style={styles.contrastList}>
                  {column.lines.map((line) => (
                    <View key={line} style={styles.contrastRow}>
                      <View style={[styles.contrastDot, { backgroundColor: color }]} />
                      <Text style={styles.contrastText}>{line}</Text>
                    </View>
                  ))}
                </View>
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

  return (
    <Band tone="brand" art={{ variant: 'support', color: t.brand, side: 'right' }}>
      <Reveal style={styles.backedBlock} distance={14}>
        <Heading level={2} style={styles.headTitle}>
          Technology changes fast. You don&apos;t have to chase it alone.
        </Heading>
        <Text style={styles.backedBody}>
          FlowSmartly is backed by GCS Tech, the team building the platform and helping businesses
          apply today&apos;s AI, automation and connected technologies to real operational needs. We
          don&apos;t just give you software and leave you to figure it out — we help identify where
          technology can actually save your team time and keep your business current.
        </Text>
      </Reveal>
    </Band>
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
      /* The site-wide growth CTA is a self-serve "Start free". This page's
         whole point is the one-to-one path, so it closes with its own. */
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
      <Close />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
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

  return StyleSheet.create({
    /* hero --------------------------------------------------------- */
    hero: { paddingTop: l.isPhone ? 26 : 40 },
    heroCopy: { gap: 16, maxWidth: 820 },
    heroTitle: type.display,
    heroBody: { ...type.body, maxWidth: 680 },
    heroButtons: { marginTop: 4 },

    /**
     * Deliberately does not wrap. With `flexWrap` the icon was pushed onto a
     * line of its own the moment the sentence needed two lines, which is every
     * phone. The text shrinks and wraps inside the row instead, and the icon
     * aligns to its first line.
     */
    backedRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 9,
      marginTop: 6,
    },
    /** nudged onto the optical centre of the first line of text */
    backedIcon: { marginTop: 4, flexGrow: 0, flexShrink: 0 },
    backedText: {
      ...type.bodySm,
      color: t.textMuted,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },
    backedStrong: { color: t.text, fontWeight: '800' },

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
}
