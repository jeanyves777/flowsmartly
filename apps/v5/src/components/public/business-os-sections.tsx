import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { goToEarlyAccess } from '@/lib/destinations';
import { elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';
import { Reveal } from './motion';
import { ROUTES } from './nav';
import { FONT_SANS,
  Band,
  ButtonRow,
  Heading,
  OpenSection,
  PrimaryButton,
  SecondaryButton,
  SectionLabel,
  useOpenSection,
  useTypeScale,
  type TypeScale,
} from './ui';

/**
 * The sections that carry the positioning: FlowSmartly is an *agentic* business
 * operating system — not a marketing suite, and not a collection of AI features.
 *
 * They live in one module because they share a single stylesheet — a card
 * grid, a section head and a two-column split. Five files would have meant
 * five near-identical `createStyles`, which is exactly how a page ends up with
 * neighbouring sections that disagree about a gap.
 *
 * The order they compose in is the argument: the anchor statement says what the
 * system *is*, the capability groups say what it can operate, and only then is
 * any individual channel named — inside a group, never as the category.
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

/**
 * The five capability groups the whole system is organised around.
 *
 * This replaced a six-verb list — Operate, Create, Connect, Serve, Sell,
 * Understand — which read as one product's feature menu. The groups are the
 * category claim itself: social, email, SMS and advertising are *inside*
 * Business & growth, one of five, and are never the thing being sold.
 *
 * `unreleased` is the honesty valve. A group whose capabilities have no public
 * surface is still named, because it is what the system is being built to
 * operate — but it is marked rather than described in the present tense
 * alongside groups that have pages a visitor can open today.
 *
 * The marker deliberately names no channel and no date. It first read "Opening
 * through V5 early access", and that could not be supported: `docs/backend`
 * defines sixteen V5 domains (04 §1) and not one of them is engineering,
 * coding, deployment or infrastructure — and 05 §4 lists *multi-agent
 * orchestration* under "What we are deliberately not building". Early access
 * is a waiting list for a workspace; nothing in this repo ties either group to
 * it. Naming a channel we cannot evidence is the same defect as naming a date.
 */
type Group = Item & { areas: string[]; unreleased?: boolean };

const CAPABILITY_GROUPS: Group[] = [
  {
    icon: 'arrow-trend-up',
    title: 'Business & growth',
    body: 'Reach customers, sell to them and understand what happened — social, content, email, SMS, advertising, CRM, commerce and the analytics over all of it.',
    areas: ['Social', 'Content', 'Email & SMS', 'Advertising', 'CRM', 'Commerce', 'Customer engagement'],
    accent: 'brand',
  },
  {
    icon: 'code-branch',
    title: 'Engineering & technology',
    body: 'Agentic engineering inside defined boundaries: planning and architecture, coding, testing, review, deployment, recovery and infrastructure operations.',
    areas: ['Architecture', 'Agentic coding', 'Testing', 'Review', 'Deployment', 'Recovery', 'Infrastructure ops'],
    accent: 'violet',
    unreleased: true,
  },
  {
    icon: 'list-check',
    title: 'Operations',
    body: 'The work that has to keep happening: workflow execution, approvals, monitoring, recurring processes, reporting and coordination across teams.',
    areas: ['Workflow execution', 'Approvals', 'Monitoring', 'Recurring processes', 'Reporting', 'Coordination'],
    accent: 'orange',
  },
  {
    icon: 'brain',
    title: 'Intelligence',
    body: 'Research, analysis, planning and decision support, grounded in your business context and the organizational knowledge the system carries between runs.',
    areas: ['Research', 'Analysis', 'Planning', 'Decision support', 'Business context', 'Organizational knowledge'],
    accent: 'green',
  },
  {
    icon: 'diagram-project',
    title: 'Agent platform',
    body: 'The layer you build on: custom agents and specialized roles, the tools they may operate, permissions, memory, governance, observability and continuous learning.',
    areas: ['Custom agents', 'Specialized roles', 'Tools', 'Permissions', 'Memory', 'Governance', 'Observability'],
    accent: 'pink',
    unreleased: true,
  },
];

/**
 * What the system is made of, named under the anchor statement.
 *
 * Deliberately eight nouns rather than a sentence: the anchor claims the parts
 * combine, and the reader should be able to see the parts.
 */
const SYSTEM_PARTS = [
  'Agents',
  'Tools',
  'Workflows',
  'Business context',
  'Memory',
  'Permissions',
  'Governance',
  'Verification',
];

/**
 * The agentic loop, in the order FlowAgent runs it.
 *
 * Every line that claims action is paired with the thing that bounds it —
 * defined authority, an approval, an evaluated result. "Agentic" is the claim
 * this page is allowed to make; "autonomous" is not, and does not appear.
 */
const AGENT_CAN = [
  'Understand the objective and your business context',
  'Build a plan and assign specialized agents',
  'Coordinate tools and connected systems',
  'Execute the work within defined authority',
  'Request approval before consequential actions',
  'Observe the result and evaluate the outcome',
  'Recover when a step fails, and say what is still blocked',
  'Continue from what it learned on the last run',
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
    // The anchor statement is now the section under the hero, so this one
    // sits on an ordinary seam and draws the default separator.
    <OpenSection>
      <SectionHead
        label="BUILT FOR YOUR ORGANIZATION"
        title="Built for the way your organization actually works"
        body="The capability groups are the same everywhere; what changes is which of them carry your week. FlowSmartly adapts to your business, your team, your customers and your operating rules."
      />
      <View style={styles.grid}>
        {INDUSTRIES.map((item, index) => (
          <Reveal
            key={item.title}
            delay={40 + index * 55}
            distance={12}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            {/* A rule, not a card. Six bordered boxes inside a seventh
                bordered box was the shape that made this page read as a
                dashboard; a hairline above each entry separates them just as
                clearly and leaves the page open. */}
            <View style={styles.ruledItem}>
              <IconTile icon={item.icon} color={accentOf(t, item.accent)} />
              <Heading level={3} style={styles.cardTitle}>
                {item.title}
              </Heading>
              <Text style={styles.cardBody}>{item.body}</Text>
            </View>
          </Reveal>
        ))}
      </View>
    </OpenSection>
  );
}

/* ------------------------------------------------------------------ */
/* the anchor statement                                                */
/* ------------------------------------------------------------------ */

/**
 * The one paragraph the whole site is arranged around, given a section of its
 * own rather than a line in a hero.
 *
 * It is positioning, so rule 15 says it gets no box: a band and a hairline
 * accent rule carry it. The rule is a left border on the quote, not a card —
 * a bordered, radiused container here is what turns a claim into a callout
 * that reads as a footnote.
 *
 * It sits directly under the hero photograph, whose hard bottom edge is the
 * boundary, so it draws no separator of its own.
 */
export function AnchorStatementSection() {
  const styles = useStyles();
  const t = useTokens();

  return (
    <Band tone="violet" art="none">
      <Reveal style={styles.anchor} distance={16}>
        <SectionLabel>ONE SYSTEM</SectionLabel>
        <Heading level={2} style={styles.anchorTitle}>
          One intelligent system. Many capabilities. Built around how your business actually works.
        </Heading>
        <View style={styles.anchorQuoteWrap}>
          <Text style={styles.anchorQuote}>
            FlowSmartly is not a collection of AI features. It is an agentic system that can combine
            capabilities, tools, context, and specialized agents to execute work around the way your
            organization operates.
          </Text>
        </View>
        <View style={styles.partsRow}>
          {SYSTEM_PARTS.map((part) => (
            <View key={part} style={styles.part}>
              <View style={[styles.partDot, { backgroundColor: t.brand }]} />
              <Text style={styles.partText}>{part}</Text>
            </View>
          ))}
        </View>
      </Reveal>
    </Band>
  );
}

/* ------------------------------------------------------------------ */
/* the five capability groups                                          */
/* ------------------------------------------------------------------ */

export function CapabilityGroupsSection() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const columns = l.gridColumns(3);

  return (
    // A band, so the five groups read as one idea on their own ground without
    // any of them being boxed.
    <Band tone="surface">
      <SectionHead
        label="CAPABILITY GROUPS"
        title="What the system can do, grouped by the work rather than the channel."
        body="Five groups describe everything FlowSmartly can operate. Marketing is one of them. The individual product experiences — social, email, SMS, advertising, commerce — live underneath the group they belong to, because they are capabilities the system operates rather than the thing being sold."
      />
      <View style={styles.grid}>
        {CAPABILITY_GROUPS.map((item, index) => (
          <Reveal
            key={item.title}
            delay={40 + index * 55}
            distance={12}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            {/* No border at all: the tinted ground is already separating this
                section, and the icon carries the accent the card edge used to. */}
            <View style={styles.pillar}>
              <View style={styles.pillarHead}>
                <IconTile icon={item.icon} color={accentOf(t, item.accent)} size={38} />
                <Heading level={3} style={styles.pillarTitle}>
                  {item.title}
                </Heading>
              </View>
              <Text style={styles.cardBody}>{item.body}</Text>
              <View style={styles.areaRow}>
                {item.areas.map((area) => (
                  <View key={area} style={styles.area}>
                    <Text style={styles.areaText}>{area}</Text>
                  </View>
                ))}
              </View>
              {/* Named, but not claimed as shipped. A group with no public
                  surface says so here rather than sitting in the present tense
                  beside three groups that have pages you can open today. No
                  channel and no date: see the note on CAPABILITY_GROUPS. */}
              {item.unreleased ? (
                <View style={styles.unreleased}>
                  <FontAwesome6 name="circle-info" size={11} color={t.textMuted} />
                  <Text style={styles.unreleasedText}>Not available yet</Text>
                </View>
              ) : null}
            </View>
          </Reveal>
        ))}
      </View>
    </Band>
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
  const open = useOpenSection();

  // Open split: the copy and the panel are two columns of one page, not two
  // things inside a box. The panel itself stays a card — it is a picture of a
  // product surface, which is exactly what a card is for.
  return (
    <Reveal style={[open, styles.split]} distance={20}>
      <View style={styles.splitCopy}>
        <SectionLabel>FLOWAGENT</SectionLabel>
        <Heading level={2} style={styles.headTitle}>
          The agentic layer that turns objectives into work.
        </Heading>
        <Text style={styles.headBody}>
          FlowAgent understands an objective and the business context around it, builds a plan,
          coordinates specialized agents and the tools they are allowed to operate, executes the
          steps, asks for approval where your rules require it, observes the real result, and
          continues from what it learned. Not a chatbot, and not a fixed automation.
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
            label="Join early access"
            size="lg"
            full={l.isPhone}
            trackId="home.flowagent.start-workspace"
            onPress={() => goToEarlyAccess()}
          />
        </ButtonRow>
      </View>

      <View style={styles.agentPanel}>
        <View style={styles.agentPanelHead}>
          <View style={styles.agentSpark}>
            <Text style={styles.agentSparkGlyph}>✦</Text>
          </View>
          <Heading level={3} style={styles.agentPanelTitle}>
            The working loop
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
    // The soft brand ground, so the safety promise is the one section on the
    // page with its own colour — it is positioning, not a footnote.
    <Band tone="brand"     >
      <SectionHead
        label="CONTROL"
        title="Agentic, and governed. Both words matter."
        body="Acting on your behalf is only useful if you can see it, bound it and check it. FlowSmartly is built for organizations that want work executed without giving up visibility, authority or accountability."
      />
      <View style={styles.grid}>
        {CONTROLS.map((item, index) => (
          <Reveal
            key={item.title}
            delay={40 + index * 55}
            distance={12}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <View style={styles.control}>
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
    </Band>
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

    /* ---------- the anchor statement ---------- */
    // Positioning, so no box (rule 15). The quote is marked by a single accent
    // rule down its leading edge; a border on four sides would make the site's
    // central claim read as a callout hung off the page.
    anchor: { gap: 18, maxWidth: 860 },
    anchorTitle: { ...ty.h2, color: t.text, marginTop: 2 },
    anchorQuoteWrap: {
      borderLeftWidth: 3,
      borderLeftColor: t.brand,
      paddingLeft: l.isPhone ? 14 : 20,
    },
    anchorQuote: { ...ty.h4, color: t.text, fontWeight: '600', lineHeight: l.isPhone ? 28 : 34 },
    partsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
    part: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    partDot: { width: 6, height: 6, borderRadius: 3, flexGrow: 0, flexShrink: 0 },
    partText: { ...ty.caption, color: t.textMuted, fontWeight: '700' },

    /* ---------- capability groups ---------- */
    // Chips, not a bulleted list: the areas inside a group are a vocabulary,
    // and a seven-line list under five cards is the shape that turned this
    // section into a specification sheet.
    areaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
    area: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    areaText: { ...ty.caption, color: t.textMuted, fontWeight: '600' },
    unreleased: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 },
    unreleasedText: { ...ty.caption, color: t.textMuted, fontStyle: 'italic' },

    /* ---------- industries ---------- */
    // Transparent, square, and separated by a hairline above rather than a box
    // around. `flexGrow: 1` still equalises the row height so the rules across
    // a row line up with each other.
    ruledItem: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      borderTopWidth: 1,
      borderTopColor: t.border,
      paddingTop: l.isPhone ? 18 : 22,
      paddingBottom: l.isPhone ? 4 : 8,
      gap: 12,
    },

    /* ---------- pillars ---------- */
    pillar: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      paddingVertical: l.isPhone ? 12 : 14,
      gap: 12,
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
    agentSparkGlyph: { color: t.textOnBrand, fontSize: 18 , fontFamily: FONT_SANS },
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
    control: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      paddingVertical: l.isPhone ? 12 : 14,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
    },
    controlCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 6 },
    controlTitle: { ...ty.h4, color: t.text },
  });
}
