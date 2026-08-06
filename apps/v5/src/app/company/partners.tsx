import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { BrandLogo } from '@/components/public/brand-logo';
import {
  ArrowLink,
  Connectors,
  ConnectorSurface,
  useConnectorField,
  type ConnectorField,
  type Link as Wire,
} from '@/components/public/connectors';
import { Media } from '@/components/public/media';
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
  SectionLabel,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { contactHref } from '@/lib/destinations';
import { elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* tones                                                               */
/* ------------------------------------------------------------------ */

type Tone = 'brand' | 'violet' | 'orange' | 'green' | 'pink';

function accent(t: ThemeTokens, tone: Tone): string {
  return tone === 'violet'
    ? t.violet
    : tone === 'orange'
      ? t.orange
      : tone === 'green'
        ? t.green
        : tone === 'pink'
          ? t.pink
          : t.brand;
}

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

type Promise_ = { key: string; icon: string; label: string; note: string; tone: Tone };

/** The four cards wired to the mark in the hero diagram. */
const PROMISES: Promise_[] = [
  {
    key: 'customers',
    icon: 'users',
    label: 'More customers',
    note: 'Referrals from a platform your clients already trust',
    tone: 'brand',
  },
  {
    key: 'revenue',
    icon: 'chart-line',
    label: 'More revenue',
    note: 'Recurring commission plus the work around it',
    tone: 'green',
  },
  {
    key: 'together',
    icon: 'handshake',
    label: 'Stronger together',
    note: 'Co-marketing, enablement and a real partner team',
    tone: 'violet',
  },
  {
    key: 'trusted',
    icon: 'shield-halved',
    label: 'Trusted platform',
    note: 'Consent, deliverability and approvals built in',
    tone: 'orange',
  },
];

type Path = { title: string; icon: string; tone: Tone; blurb: string; note: string };

const PATHS: Path[] = [
  {
    title: 'Agencies',
    icon: 'briefcase',
    tone: 'brand',
    blurb: 'Run FlowSmartly for your clients from one workspace, with billing and reporting per account.',
    note: 'Best for marketing and growth agencies',
  },
  {
    title: 'Technology Partners',
    icon: 'plug',
    tone: 'violet',
    blurb: 'Build an integration on our API and put it in front of every FlowSmartly customer.',
    note: 'Best for SaaS and platform builders',
  },
  {
    title: 'Affiliates',
    icon: 'link',
    tone: 'orange',
    blurb: 'Recommend FlowSmartly to your audience and earn on every account that sticks.',
    note: 'Best for creators, consultants and communities',
  },
  {
    title: 'Certified Experts',
    icon: 'award',
    tone: 'green',
    blurb: 'Get certified, get listed, and take on implementation work sent to you by us.',
    note: 'Best for independent operators',
  },
];

/**
 * The terms of joining — the question a prospective partner asks first and the
 * one thing this page never answered. It sits in the hero because the copy
 * column was 147px shorter than the diagram beside it, and because "what does
 * this cost me" belongs next to "Apply to partner", not six sections later.
 */
const TERMS: string[] = [
  'Free to join — no fee and no minimum commitment',
  'Non-exclusive — keep every other partnership you have',
  'Every application is read by a person, not scored by a form',
];

const BENEFITS = [
  'A partner manager who knows your book of business',
  'Free sandbox workspaces for building and demos',
  'Co-marketing, case studies and launch support',
  'Certification and enablement for your whole team',
  'Early access to features before general release',
  'Priority support with a dedicated escalation path',
];

type RevenueStream = { title: string; body: string; icon: string; tone: Tone; detail: string };

const REVENUE: RevenueStream[] = [
  {
    title: 'Referral commissions',
    body: 'Send us an introduction and earn recurring commission for as long as the account is active.',
    icon: 'share-nodes',
    tone: 'brand',
    detail: 'Recurring, not one-off',
  },
  {
    title: 'Resell & implementation',
    body: 'Own the relationship, the billing and the setup work, at partner pricing.',
    icon: 'store',
    tone: 'violet',
    detail: 'Partner margin on every seat',
  },
  {
    title: 'Co-sell with FlowSmartly',
    body: 'Work deals together with our team, and take the services that come with them.',
    icon: 'handshake-angle',
    tone: 'green',
    detail: 'Shared pipeline, shared wins',
  },
];

const BRANDS = [
  'salesforce',
  'hubspot',
  'slack',
  'microsoft',
  'shopify',
  'zendesk',
  'googleanalytics',
  'make',
  'zapier',
];

type Step = { number: string; title: string; body: string; icon: string; tone: Tone };

const STEPS: Step[] = [
  {
    number: '1',
    title: 'Apply',
    body: 'Tell us about your business and the customers you serve. We reply within two working days.',
    icon: 'file-signature',
    tone: 'brand',
  },
  {
    number: '2',
    title: 'Enable',
    body: 'Get certified, set up your sandbox and meet the partner team who will work with you.',
    icon: 'graduation-cap',
    tone: 'violet',
  },
  {
    number: '3',
    title: 'Grow',
    body: 'Launch together, track everything in the partner portal and get paid every month.',
    icon: 'chart-line',
    tone: 'green',
  },
];

type Stat = {
  key: string;
  value: number;
  decimals: number;
  prefix: string;
  suffix: string;
  label: string;
  tone: Tone;
};

const STATS: Stat[] = [
  { key: 'partners', value: 1200, decimals: 0, prefix: '', suffix: '+', label: 'Active partners', tone: 'brand' },
  { key: 'pipeline', value: 45, decimals: 0, prefix: '$', suffix: 'M+', label: 'Partner-sourced pipeline', tone: 'violet' },
  { key: 'recurring', value: 85, decimals: 0, prefix: '', suffix: '%', label: 'With active recurring revenue', tone: 'green' },
  { key: 'satisfaction', value: 4.9, decimals: 1, prefix: '', suffix: '/5', label: 'Partner satisfaction', tone: 'orange' },
  { key: 'retention', value: 98, decimals: 0, prefix: '', suffix: '%', label: 'Customer retention', tone: 'pink' },
];

/* ------------------------------------------------------------------ */
/* shared style hook                                                   */
/* ------------------------------------------------------------------ */

type Styles = ReturnType<typeof createStyles>;

/**
 * In-page navigation. `nativeID` becomes a real DOM id on web, so an anchor CTA
 * moves the visitor to a section that genuinely exists rather than doing
 * nothing. On native there is nothing to scroll to, so it is a no-op.
 */
function scrollToId(id: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function useStyles(): Styles {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  return useMemo(() => createStyles(t, l, type), [t, l, type]);
}

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

function IconTile({ icon, tone, size = 46 }: { icon: string; tone: Tone; size?: number }) {
  const t = useTokens();
  const color = accent(t, tone);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        flexGrow: 0,
        flexShrink: 0,
        backgroundColor: softFill(color, t),
      }}>
      <FontAwesome6 name={icon as never} size={Math.round(size * 0.42)} color={color} />
    </View>
  );
}

function Ticked({ children }: { children: string }) {
  const styles = useStyles();
  const t = useTokens();
  return (
    <View style={styles.tickRow}>
      <View style={styles.tickDot}>
        <FontAwesome6 name="check" size={9} color={t.green} />
      </View>
      <Text style={styles.tickText}>{children}</Text>
    </View>
  );
}

function SectionHead({ label, title, body }: { label?: string; title: string; body?: string }) {
  const styles = useStyles();
  return (
    <Reveal style={styles.head} distance={14}>
      {label ? <SectionLabel>{label}</SectionLabel> : null}
      <Heading level={2} style={styles.headTitle}>
        {title}
      </Heading>
      {body ? <Text style={styles.headBody}>{body}</Text> : null}
    </Reveal>
  );
}

/** One measured card in the hero diagram. */
function PromiseTile({ item, field }: { item: Promise_; field: ConnectorField }) {
  const styles = useStyles();
  const t = useTokens();
  const color = accent(t, item.tone);
  return (
    <View {...field.node(item.key)} style={styles.promiseTile}>
      <View style={[styles.promiseIcon, { backgroundColor: softFill(color, t) }]}>
        <FontAwesome6 name={item.icon as never} size={16} color={color} />
      </View>
      <Text style={styles.promiseLabel}>{item.label}</Text>
      <Text numberOfLines={3} style={styles.promiseNote}>
        {item.note}
      </Text>
    </View>
  );
}

function StatCard({ stat, rowMode }: { stat: Stat; rowMode: boolean }) {
  const styles = useStyles();
  const t = useTokens();
  const color = accent(t, stat.tone);
  const counter = useCountUp(stat.value, { decimals: stat.decimals });
  const shown = counter.value.toLocaleString('en-US', {
    minimumFractionDigits: stat.decimals,
    maximumFractionDigits: stat.decimals,
  });

  return (
    <View ref={counter.ref as never} style={[styles.statCard, rowMode ? styles.statCardRow : null]}>
      <Text numberOfLines={1} style={[styles.statValue, { color }]}>
        {`${stat.prefix}${shown}${stat.suffix}`}
      </Text>
      <Text style={[styles.statLabel, rowMode ? styles.statLabelRow : null]}>{stat.label}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* sections                                                            */
/* ------------------------------------------------------------------ */

function Hero() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const router = useRouter();
  const field = useConnectorField();

  const links = useMemo<Wire[]>(
    () => PROMISES.map((item) => ({ from: 'hub', to: item.key, color: accent(t, item.tone) })),
    [t],
  );

  const [customers, revenue, together, trusted] = PROMISES;

  return (
    <OpenSection style={styles.heroSection}>
      <Reveal style={styles.heroCopy} distance={16}>
        <SectionLabel>PARTNER PROGRAM</SectionLabel>
        <Heading level={1} style={styles.heroTitle}>
          Build, sell, and grow with FlowSmartly.
        </Heading>
        <Text style={styles.heroBody}>
          Agencies, platforms, creators and independent experts all grow on FlowSmartly — with recurring
          revenue, real enablement and a product their customers keep using.
        </Text>
        <ButtonRow>
          <PrimaryButton
            label="Apply to partner"
            size="lg"
            icon="arrow-right"
            iconRight
            full={l.isPhone}
            trackId="partners.hero.apply"
            onPress={() => router.push(contactHref('partnership') as never)}
          />
          <SecondaryButton
            label="Partner benefits"
            size="lg"
            icon="arrow-down"
            full={l.isPhone}
            trackId="partners.hero.benefits"
            onPress={() => scrollToId('partner-benefits')}
          />
        </ButtonRow>

        <View style={styles.terms}>
          <Text style={styles.termsTitle}>Program terms, up front</Text>
          <View style={styles.tickList}>
            {TERMS.map((term) => (
              <Ticked key={term}>{term}</Ticked>
            ))}
          </View>
        </View>
      </Reveal>

      {/*
        One translate-only reveal wraps the whole diagram. The overlay measures
        every node against the field, so a per-tile stagger or a scale here would
        leave the wires pointing at empty space.
      */}
      <Reveal style={styles.heroPanel} distance={18} delay={90}>
        <ConnectorSurface field={field} style={styles.promiseField}>
          <Connectors
            field={field}
            links={links}
            color={t.brand}
            circular={['hub']}
            strokeWidth={2}
            dash="0.5 6"
            flow
          />
          <View style={styles.promiseRow}>
            <PromiseTile item={customers} field={field} />
            <PromiseTile item={revenue} field={field} />
          </View>
          <View {...field.node('hub')} style={styles.hub}>
            <Media
              name="flowsmartly-mark"
              alt="FlowSmartly"
              contentFit="contain"
              radius={0}
              style={styles.hubMark}
            />
          </View>
          <View style={styles.promiseRow}>
            <PromiseTile item={together} field={field} />
            <PromiseTile item={trusted} field={field} />
          </View>
        </ConnectorSurface>
      </Reveal>
    </OpenSection>
  );
}

function Paths() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const columns = l.isPhone ? 1 : l.isTablet ? 2 : 4;

  return (
    <Band tone="surface" art={{ variant: 'docs', color: t.brand, side: 'right' }}>
      <SectionHead
        label="PARTNER PATHS"
        title="Choose the path that fits your business."
        body="Four ways to work with us. Take one, or combine them as your practice grows."
      />

      <View style={styles.grid}>
        {PATHS.map((path, index) => (
          <Reveal
            key={path.title}
            delay={50 + index * 70}
            distance={12}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <View style={styles.pathCard}>
              <IconTile icon={path.icon} tone={path.tone} />
              <Text style={styles.cardTitle}>{path.title}</Text>
              <Text style={styles.cardBody}>{path.blurb}</Text>
              <View style={styles.cardSpacer} />
              <Text style={styles.cardMeta}>{path.note}</Text>
              <View style={styles.linkRow}>
                <Text style={[styles.linkText, { color: accent(t, path.tone) }]}>Learn more</Text>
                <FontAwesome6 name="arrow-right" size={12} color={accent(t, path.tone)} />
              </View>
            </View>
          </Reveal>
        ))}
      </View>
    </Band>
  );
}

function ValueAndRevenue() {
  const t = useTokens();
  const styles = useStyles();

  return (
    <Band tone="green" art={{ variant: 'tasks', color: t.green, side: 'left' }}>
      <View style={styles.twoUp}>
        <Reveal style={styles.twoUpCol} distance={16}>
          <View style={styles.panel}>
            <Heading level={2} style={styles.panelTitle}>
              More value for you and your customers
            </Heading>
            <Text style={styles.panelBody}>
              Partnership here is a working relationship, not a badge on a directory page.
            </Text>
            <View style={styles.tickList}>
              {BENEFITS.map((benefit) => (
                <Ticked key={benefit}>{benefit}</Ticked>
              ))}
            </View>
          </View>
        </Reveal>

        <Reveal style={styles.twoUpCol} distance={16} delay={90}>
          <View style={styles.panel}>
            <Heading level={2} style={styles.panelTitle}>
              Multiple ways to grow your recurring revenue
            </Heading>
            <Text style={styles.panelBody}>
              Refer, resell or sell alongside us — most partners end up doing all three.
            </Text>
            <View style={styles.revenueList}>
              {REVENUE.map((stream) => (
                <View key={stream.title} style={styles.revenueRow}>
                  <IconTile icon={stream.icon} tone={stream.tone} size={42} />
                  <View style={styles.revenueCopy}>
                    <Text style={styles.revenueTitle}>{stream.title}</Text>
                    <Text style={styles.revenueBody}>{stream.body}</Text>
                    <Text style={styles.revenueDetail}>{stream.detail}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </Reveal>
      </View>
    </Band>
  );
}

function Integrations() {
  const styles = useStyles();
  const t = useTokens();
  const router = useRouter();

  return (
    <OpenSection>
      <SectionHead
        label="INTEGRATIONS"
        title="Integrate. Extend. Deliver more value."
        body="Ship an integration against our API, or plug FlowSmartly into the stack your customers already run."
      />

      <View style={styles.grid}>
        {BRANDS.map((brand, index) => (
          <Reveal
            key={brand}
            delay={40 + index * 45}
            distance={10}
            style={[styles.cell, { flexBasis: cellBasis(3) }]}>
            <View style={styles.brandTile}>
              <BrandLogo name={brand} size={26} />
            </View>
          </Reveal>
        ))}
      </View>

      <Pressable
        accessibilityRole="link"
        accessibilityLabel="View all integrations"
        onPress={() => router.push(ROUTES.integrations as never)}
        style={({ pressed }) => [styles.linkRow, styles.linkRowTap, pressed ? styles.pressed : null]}>
        <Text style={[styles.linkText, { color: t.brand }]}>View all integrations</Text>
        <FontAwesome6 name="arrow-right" size={12} color={t.brand} />
      </Pressable>
    </OpenSection>
  );
}

function Journey() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const arrowWidth = l.isDesktop ? 52 : 30;

  return (
    <Band tone="surface" art={{ variant: 'analytics', color: t.brand, side: 'right' }}>
      <SectionHead
        label="HOW IT WORKS"
        title="A simple path to partnership."
        body="Three steps, and a person on our side at each one."
      />

      <View style={styles.stepStrip}>
        {STEPS.map((step, index) => (
          <View key={step.title} style={styles.stepGroup}>
            <View style={styles.stepCard}>
              <View style={styles.stepTop}>
                <View style={[styles.stepNumber, { backgroundColor: accent(t, step.tone) }]}>
                  <Text style={styles.stepNumberText}>{step.number}</Text>
                </View>
                <IconTile icon={step.icon} tone={step.tone} size={42} />
              </View>
              <Text style={styles.cardTitle}>{step.title}</Text>
              <Text style={styles.cardBody}>{step.body}</Text>
            </View>

            {/* The slot is always rendered so all three groups keep the same
                width; only the last one is left empty. */}
            <View style={styles.stepArrow}>
              {index === STEPS.length - 1 ? null : l.isCompact ? (
                <FontAwesome6 name="arrow-right" size={13} color={t.textSubtle} style={styles.stepArrowDown} />
              ) : (
                <ArrowLink width={arrowWidth} height={12} color={t.borderStrong} />
              )}
            </View>
          </View>
        ))}
      </View>
    </Band>
  );
}

function Proof() {
  const t = useTokens();
  const styles = useStyles();
  const l = useLayout();
  const columns = l.isCompact ? 1 : 5;
  const rowMode = columns === 1;

  return (
    <Band tone="green" art={{ variant: 'sync', color: t.green, side: 'left' }}>
      <SectionHead
        label="THE NUMBERS"
        title="Partners choose FlowSmartly. Customers see results."
        body="Measured across the partner portal for the last twelve months."
      />

      <View style={styles.grid}>
        {STATS.map((stat, index) => (
          <Reveal
            key={stat.key}
            delay={50 + index * 60}
            distance={12}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <StatCard stat={stat} rowMode={rowMode} />
          </Reveal>
        ))}
      </View>
    </Band>
  );
}

function Closing() {
  const styles = useStyles();
  const l = useLayout();
  const router = useRouter();

  return (
    <OpenSection style={styles.closing}>
      <Reveal style={styles.closingInner} distance={14}>
        <IconTile icon="handshake" tone="brand" size={54} />
        <Heading level={2} style={styles.closingTitle}>
          Ready to build what’s next?
        </Heading>
        <Text style={styles.closingBody}>
          Tell us about your business and the customers you serve. We will come back with the path that
          fits and the numbers behind it.
        </Text>
        <ButtonRow>
          <PrimaryButton
            label="Apply to become a partner"
            size="lg"
            icon="arrow-right"
            iconRight
            full={l.isPhone}
            trackId="partners.close.apply"
            onPress={() => router.push(contactHref('partnership') as never)}
          />
          <SecondaryButton
            label="Contact partner sales"
            size="lg"
            icon="envelope"
            full={l.isPhone}
            trackId="partners.close.contact-sales"
            onPress={() => router.push(contactHref('sales') as never)}
          />
        </ButtonRow>
      </Reveal>
    </OpenSection>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function PartnersPage() {
  return (
    <PageShell
      title="Partners"
      description="Build, sell and grow with FlowSmartly — recurring revenue, real enablement and a partner team for agencies, platforms, affiliates and certified experts."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Partners', path: ROUTES.partners },
        ]),
      ]}>
      <Hero />
      <Paths />
      <View nativeID="partner-benefits">
        <ValueAndRevenue />
      </View>
      <Integrations />
      <Journey />
      <Proof />
      <Closing />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  const stacked = l.isStacked;
  /** half the grid gutter; cells carry it as padding so wrapped rows stay flush */
  const cellPad = l.isPhone ? 5 : 7;
  const hub = l.isPhone ? 84 : l.isTablet ? 100 : 116;
  const hubMark = { width: hub * 0.5, height: hub * 0.5 };

  const cardBase: ViewStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    backgroundColor: t.surfaceRaised,
    padding: l.isPhone ? 16 : 18,
    ...(elevation(t, 1) as ViewStyle),
  };

  const sheet = StyleSheet.create({
    /* hero --------------------------------------------------------- */
    heroSection: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'center',
      gap: stacked ? 28 : 44,
      paddingTop: l.isPhone ? 24 : 36,
    },
    heroCopy: stacked
      ? { width: '100%', minWidth: 0, gap: 16 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 440, minWidth: 0, gap: 16 },
    heroPanel: stacked
      ? { width: '100%', minWidth: 0, alignSelf: 'center', maxWidth: 620 }
      : { flexGrow: 1.1, flexShrink: 1, flexBasis: 460, minWidth: 0 },
    heroTitle: type.display,
    heroBody: { ...type.body, maxWidth: 580 },
    terms: {
      marginTop: 6,
      paddingTop: 18,
      borderTopWidth: 1,
      borderTopColor: t.divider,
      gap: 12,
      maxWidth: 560,
    },
    termsTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },

    /* hero diagram ------------------------------------------------- */
    promiseField: { alignItems: 'center', gap: l.isPhone ? 18 : 26, paddingVertical: 8 },
    promiseRow: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'stretch',
      justifyContent: 'space-between',
      gap: l.isPhone ? 12 : 24,
    },
    promiseTile: {
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: '46%',
      minWidth: 0,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: l.isPhone ? 12 : 16,
      paddingVertical: l.isPhone ? 12 : 15,
      gap: 7,
      ...(elevation(t, 1) as ViewStyle),
    },
    promiseIcon: {
      width: 38,
      height: 38,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    promiseLabel: { ...type.bodySm, color: t.text, fontWeight: '800' },
    promiseNote: { ...type.micro, color: t.textMuted },
    hub: {
      width: hub,
      height: hub,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: hub / 2,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
      ...(elevation(t, 3) as ViewStyle),
    },

    /* section head ------------------------------------------------- */
    head: { gap: 11, maxWidth: 720 },
    headTitle: type.h2,
    headBody: type.body,

    /* grid --------------------------------------------------------- */
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      marginHorizontal: -cellPad,
      marginTop: 20 - cellPad,
    },
    cell: { flexGrow: 0, flexShrink: 0, minWidth: 0, padding: cellPad },

    /* generic card copy -------------------------------------------- */
    cardTitle: { ...type.h4, color: t.text },
    cardBody: { ...type.bodySm, color: t.textMuted },
    cardMeta: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    cardSpacer: { flexGrow: 1, flexShrink: 0, flexBasis: 'auto', minHeight: 4 },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 34 },
    /** a real link needs a real target: 44px tall, self-aligned so it is not full-bleed */
    linkRowTap: { minHeight: 44, alignSelf: 'flex-start' },
    linkText: { ...type.bodySm, fontWeight: '800', flexShrink: 1, minWidth: 0 },
    pressed: { opacity: 0.86 },

    /* partner paths ------------------------------------------------ */
    pathCard: { ...cardBase, gap: 10, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },

    /* value + revenue ---------------------------------------------- */
    twoUp: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'stretch',
      gap: stacked ? 16 : 24,
    },
    twoUpCol: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    panel: {
      ...cardBase,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 18 : 22,
      gap: 12,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    panelTitle: { ...type.h3, color: t.text },
    panelBody: { ...type.bodySm, color: t.textMuted },
    tickList: { gap: 12, marginTop: 4 },
    tickRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    tickDot: {
      width: 18,
      height: 18,
      marginTop: 1,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.green, t),
    },
    tickText: { ...type.caption, color: t.textMuted, flexShrink: 1, minWidth: 0 },

    revenueList: { gap: 14, marginTop: 4 },
    revenueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 13 },
    revenueCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    revenueTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    revenueBody: { ...type.caption, color: t.textMuted },
    revenueDetail: { ...type.micro, color: t.textSubtle, fontWeight: '700' },

    /* integrations ------------------------------------------------- */
    brandTile: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minHeight: 76,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },

    /* journey ------------------------------------------------------ */
    stepStrip: {
      marginTop: l.isPhone ? 18 : 26,
      flexDirection: l.isCompact ? 'column' : 'row',
      alignItems: l.isCompact ? 'stretch' : 'stretch',
      gap: l.isCompact ? 6 : 0,
    },
    stepGroup: l.isCompact
      ? { width: '100%', minWidth: 0, alignItems: 'stretch', gap: 6 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, flexDirection: 'row', alignItems: 'stretch' },
    stepCard: {
      ...cardBase,
      gap: 10,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },
    stepTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    stepNumber: {
      width: 30,
      height: 30,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepNumberText: { ...type.micro, color: t.textOnBrand, fontWeight: '800' },
    stepArrow: {
      flexGrow: 0,
      flexShrink: 0,
      width: l.isCompact ? undefined : l.isDesktop ? 52 : 30,
      minHeight: l.isCompact ? 20 : undefined,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepArrowDown: { transform: [{ rotate: '90deg' }] },

    /* proof -------------------------------------------------------- */
    statCard: {
      ...cardBase,
      backgroundColor: t.surfaceMuted,
      gap: 6,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      alignItems: 'flex-start',
    },
    statCardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 14,
    },
    statValue: { fontSize: l.isPhone ? 26 : 30, lineHeight: l.isPhone ? 32 : 36, fontWeight: '800' },
    statLabel: { ...type.caption, color: t.textMuted, fontWeight: '600' },
    statLabelRow: { textAlign: 'right', flexShrink: 1, minWidth: 0 },

    /* closing ------------------------------------------------------ */
    closing: { alignItems: 'center' },
    closingInner: {
      alignItems: 'center',
      gap: 16,
      maxWidth: 660,
      paddingVertical: l.isPhone ? 8 : 20,
    },
    closingTitle: { ...type.h1, textAlign: 'center' },
    closingBody: { ...type.body, textAlign: 'center' },
  });

  return { ...sheet, hubMark };
}
