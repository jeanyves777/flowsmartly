import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { EXTERNAL } from '@/lib/destinations';
import { elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';
import { Reveal } from './motion';
import { ROUTES } from './nav';
import {
  ButtonRow,
  Heading,
  PrimaryButton,
  SecondaryButton,
  Section,
  SectionLabel,
  useSectionShell,
  useTypeScale,
  type TypeScale,
} from './ui';

/**
 * The four sections that carry the positioning: FlowSmartly is a business
 * operating system, not a marketing suite.
 *
 * They live in one module because they share a single stylesheet — a card
 * grid, a section head and a two-column split. Four files would have meant
 * four near-identical `createStyles`, which is exactly how a page ends up with
 * neighbouring sections that disagree about a gap.
 */

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

type Accent = 'brand' | 'violet' | 'green' | 'orange' | 'pink';

function accentOf(t: ThemeTokens, accent: Accent): string {
  return accent === 'violet'
    ? t.violet
    : accent === 'green'
      ? t.green
      : accent === 'orange'
        ? t.orange
        : accent === 'pink'
          ? t.pink
          : t.brand;
}

type Item = { icon: string; title: string; body: string; accent: Accent };

/**
 * Six organisation types, chosen so no two read as the same business. A list
 * that was all retail variants would say "we do e-commerce" no matter how the
 * heading is worded.
 */
const INDUSTRIES: Item[] = [
  {
    icon: 'briefcase',
    title: 'Professional services',
    body: 'Manage leads, appointments, documents, proposals, client communication, billing, and follow-ups.',
    accent: 'brand',
  },
  {
    icon: 'bag-shopping',
    title: 'Retail and e-commerce',
    body: 'Create product content, operate your storefront, recover carts, run campaigns, support customers, and measure sales.',
    accent: 'orange',
  },
  {
    icon: 'heart-pulse',
    title: 'Healthcare and elder services',
    body: 'Coordinate appointments, communicate with families, manage approved workflows, and keep human oversight over sensitive actions.',
    accent: 'pink',
  },
  {
    icon: 'hand-holding-heart',
    title: 'Nonprofits and NGOs',
    body: 'Engage donors, coordinate volunteers, promote programs, manage events, communicate impact, and prepare reports.',
    accent: 'green',
  },
  {
    icon: 'file-invoice-dollar',
    title: 'Tax and financial services',
    body: 'Collect documents, remind clients, organize intake, communicate deadlines, generate educational content, and manage follow-ups.',
    accent: 'violet',
  },
  {
    icon: 'store',
    title: 'Local businesses',
    body: 'Manage listings, reviews, appointments, social content, promotions, customer communication, and daily operations.',
    accent: 'brand',
  },
];

/** The six pillars the whole product is organised around. */
const PILLARS: Item[] = [
  {
    icon: 'list-check',
    title: 'Operate',
    body: 'Coordinate tasks, customers, documents, approvals, appointments, teams, and daily workflows.',
    accent: 'brand',
  },
  {
    icon: 'wand-magic-sparkles',
    title: 'Create',
    body: 'Produce branded content, videos, presentations, proposals, training, websites, and product assets.',
    accent: 'violet',
  },
  {
    icon: 'plug',
    title: 'Connect',
    body: 'Bring together email, SMS, social, websites, stores, calendars, customer systems, and business applications.',
    accent: 'green',
  },
  {
    icon: 'headset',
    title: 'Serve',
    body: 'Respond to customers, manage conversations, send reminders, coordinate services, and support long-term relationships.',
    accent: 'orange',
  },
  {
    icon: 'arrow-trend-up',
    title: 'Sell',
    body: 'Find leads, send outreach, generate proposals, sell online, run promotions, and manage the customer journey.',
    accent: 'pink',
  },
  {
    icon: 'chart-column',
    title: 'Understand',
    body: 'Measure performance, uncover opportunities, monitor operations, and receive clear recommendations from FlowAgent.',
    accent: 'brand',
  },
];

/** What FlowAgent does, in the order it does it. */
const AGENT_CAN = [
  'Understand what needs attention',
  'Prepare work before you ask',
  'Coordinate tasks across connected systems',
  'Draft communications and business materials',
  'Request approval before sensitive actions',
  'Safely execute approved workflows',
  'Track results and learn from verified outcomes',
  'Explain what it did and why',
];

const CONTROLS: Item[] = [
  {
    icon: 'circle-check',
    title: 'Human approval',
    body: 'Review important actions before they happen.',
    accent: 'green',
  },
  {
    icon: 'user-shield',
    title: 'Permission-aware',
    body: 'FlowAgent only accesses what each user and workspace permits.',
    accent: 'brand',
  },
  {
    icon: 'clipboard-check',
    title: 'Verified execution',
    body: 'The system checks whether important actions actually succeeded.',
    accent: 'violet',
  },
  {
    icon: 'clock-rotate-left',
    title: 'Complete activity history',
    body: 'See what was requested, approved, executed, and completed.',
    accent: 'orange',
  },
  {
    icon: 'shield-halved',
    title: 'Safe integrations',
    body: 'Connect business systems without giving every agent unlimited access.',
    accent: 'pink',
  },
];

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

type Styles = ReturnType<typeof createStyles>;

function useStyles(): Styles {
  const t = useTokens();
  const l = useLayout();
  const ty = useTypeScale();
  return useMemo(() => createStyles(t, l, ty), [t, l, ty]);
}

function IconTile({ icon, color, size = 44 }: { icon: string; color: string; size?: number }) {
  const t = useTokens();
  return (
    <View
      style={{
        width: size,
        height: size,
        flexGrow: 0,
        flexShrink: 0,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: softFill(color, t),
      }}>
      <FontAwesome6 name={icon as never} size={Math.round(size * 0.42)} color={color} />
    </View>
  );
}

function SectionHead({ label, title, body }: { label: string; title: string; body: string }) {
  const styles = useStyles();
  return (
    <Reveal style={styles.head} distance={14}>
      <SectionLabel>{label}</SectionLabel>
      <Heading level={2} style={styles.headTitle}>
        {title}
      </Heading>
      <Text style={styles.headBody}>{body}</Text>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* who it is for                                                       */
/* ------------------------------------------------------------------ */

export function IndustriesSection() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const columns = l.gridColumns(3);

  return (
    <Section>
      <SectionHead
        label="BUILT FOR YOUR ORGANIZATION"
        title="Built for the way your organization actually works"
        body="FlowSmartly adapts to your business, your team, your customers, and your operating rules."
      />
      <View style={styles.grid}>
        {INDUSTRIES.map((item, index) => (
          <Reveal
            key={item.title}
            delay={40 + index * 55}
            distance={12}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <View style={styles.card}>
              <IconTile icon={item.icon} color={accentOf(t, item.accent)} />
              <Heading level={3} style={styles.cardTitle}>
                {item.title}
              </Heading>
              <Text style={styles.cardBody}>{item.body}</Text>
            </View>
          </Reveal>
        ))}
      </View>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* the six pillars                                                     */
/* ------------------------------------------------------------------ */

export function PillarsSection() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const columns = l.gridColumns(3);

  return (
    <Section>
      <SectionHead
        label="THE PLATFORM"
        title="More than marketing. One connected business workspace."
        body="Six pillars, one system — so the work, the customer and the record of what happened never end up in three different places."
      />
      <View style={styles.grid}>
        {PILLARS.map((item, index) => (
          <Reveal
            key={item.title}
            delay={40 + index * 55}
            distance={12}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            {/* The accent lives on the card's top edge rather than in a second
                icon colour — it is what separates this grid from the industry
                grid above it at a glance. */}
            <View style={[styles.pillarCard, { borderTopColor: accentOf(t, item.accent) }]}>
              <View style={styles.pillarHead}>
                <IconTile icon={item.icon} color={accentOf(t, item.accent)} size={38} />
                <Heading level={3} style={styles.pillarTitle}>
                  {item.title}
                </Heading>
              </View>
              <Text style={styles.cardBody}>{item.body}</Text>
            </View>
          </Reveal>
        ))}
      </View>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* FlowAgent                                                           */
/* ------------------------------------------------------------------ */

export function FlowAgentAlongsideSection() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const router = useRouter();
  const shell = useSectionShell();

  return (
    <Reveal style={[shell, styles.split]} distance={20}>
      <View style={styles.splitCopy}>
        <SectionLabel>FLOWAGENT</SectionLabel>
        <Heading level={2} style={styles.headTitle}>
          FlowAgent works alongside your business.
        </Heading>
        <Text style={styles.headBody}>
          FlowAgent understands your goals, business context, connected systems, permissions, and
          operating rules. It can research, prepare, coordinate, create, automate, and recommend
          actions — while keeping your team in control.
        </Text>
        <ButtonRow>
          <PrimaryButton
            label="See FlowAgent in action"
            size="lg"
            full={l.isPhone}
            trackId="home.flowagent.see-in-action"
            onPress={() => router.push(ROUTES.flowAgent as never)}
          />
          <SecondaryButton
            label="Start building your workspace"
            size="lg"
            full={l.isPhone}
            trackId="home.flowagent.start-workspace"
            onPress={() => Linking.openURL(EXTERNAL.signup)}
          />
        </ButtonRow>
      </View>

      <View style={styles.agentPanel}>
        <View style={styles.agentPanelHead}>
          <View style={styles.agentSpark}>
            <Text style={styles.agentSparkGlyph}>✦</Text>
          </View>
          <Heading level={3} style={styles.agentPanelTitle}>
            FlowAgent can
          </Heading>
        </View>
        <View style={styles.agentList}>
          {AGENT_CAN.map((line, index) => (
            <Reveal key={line} delay={index * 45} distance={8} style={styles.agentRow}>
              <View style={styles.agentTick}>
                <FontAwesome6 name="check" size={10} color={t.successText} />
              </View>
              <Text style={styles.agentRowText}>{line}</Text>
            </Reveal>
          ))}
        </View>
      </View>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* control                                                             */
/* ------------------------------------------------------------------ */

export function ControlSection() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const columns = l.gridColumns(3);

  return (
    <Section>
      <SectionHead
        label="CONTROL"
        title="Powerful automation. Professional control."
        body="FlowSmartly is designed for businesses that need AI assistance without giving up visibility, authority, or accountability."
      />
      <View style={styles.grid}>
        {CONTROLS.map((item, index) => (
          <Reveal
            key={item.title}
            delay={40 + index * 55}
            distance={12}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            {/* Row layout on an inset surface: the same grid as the two above,
                deliberately quieter, so the page does not read as three
                identical card walls in a row. */}
            <View style={styles.controlCard}>
              <IconTile icon={item.icon} color={accentOf(t, item.accent)} size={38} />
              <View style={styles.controlCopy}>
                <Heading level={3} style={styles.controlTitle}>
                  {item.title}
                </Heading>
                <Text style={styles.cardBody}>{item.body}</Text>
              </View>
            </View>
          </Reveal>
        ))}
      </View>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* stylesheet                                                          */
/* ------------------------------------------------------------------ */

function createStyles(t: ThemeTokens, l: Layout, ty: TypeScale) {
  // Grid gutter is half-padding on each cell rather than a `gap`, so a wrapped
  // row that does not fill its last line leaves the cells on the same column
  // grid instead of stretching one orphan across the gap.
  const cellPad = l.isPhone ? 5 : 7;
  const card = elevation(t, 1) as object;

  return StyleSheet.create({
    /* ---------- shared ---------- */
    head: { gap: 14, maxWidth: 780 },
    headTitle: { ...ty.h2, color: t.text, marginTop: 2 },
    headBody: { ...ty.body, color: t.textMuted, maxWidth: 720 },

    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      marginHorizontal: -cellPad,
      marginTop: (l.isPhone ? 20 : 26) - cellPad,
    },
    cell: { flexGrow: 0, flexShrink: 0, minWidth: 0, padding: cellPad },

    cardTitle: { ...ty.h4, color: t.text },
    cardBody: { ...ty.bodySm, color: t.textMuted },

    /* ---------- industries ---------- */
    card: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 16 : 18,
      gap: 12,
      ...card,
    },

    /* ---------- pillars ---------- */
    pillarCard: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      borderWidth: 1,
      borderTopWidth: 3,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 16 : 18,
      gap: 12,
      ...card,
    },
    pillarHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    pillarTitle: { ...ty.h3, color: t.text, flexShrink: 1, minWidth: 0 },

    /* ---------- FlowAgent ---------- */
    split: l.isStacked
      ? { flexDirection: 'column', alignItems: 'stretch', gap: 26 }
      : { flexDirection: 'row', alignItems: 'center', gap: 40 },
    splitCopy: l.isStacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0, gap: 18 }
      : { flexGrow: 0.92, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 20 },
    agentPanel: {
      flexGrow: l.isStacked ? 0 : 1.08,
      flexShrink: l.isStacked ? 0 : 1,
      flexBasis: l.isStacked ? 'auto' : 0,
      width: l.isStacked ? '100%' : undefined,
      minWidth: 0,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 18,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 16 : 20,
      gap: 14,
      ...card,
    },
    agentPanelHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: t.divider,
    },
    agentSpark: {
      width: 34,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 17,
      backgroundColor: t.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    agentSparkGlyph: { color: t.textOnBrand, fontSize: 18 },
    agentPanelTitle: { ...ty.h4, color: t.text, flexShrink: 1, minWidth: 0 },
    agentList: { gap: 10 },
    agentRow: { minHeight: 26, flexDirection: 'row', alignItems: 'center', gap: 12 },
    agentTick: {
      width: 22,
      height: 22,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      backgroundColor: t.successBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    agentRowText: { ...ty.bodySm, color: t.text, flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },

    /* ---------- control ---------- */
    controlCard: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 16 : 18,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
    },
    controlCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 6 },
    controlTitle: { ...ty.h4, color: t.text },
  });
}
