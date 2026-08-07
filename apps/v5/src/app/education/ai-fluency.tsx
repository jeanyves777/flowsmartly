import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
// `Link` is already the connector-overlay type in this file, so the router's
// anchor comes in under its own name.
import { Link as RouterLink, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Linking, StyleSheet, Text, View, type DimensionValue } from 'react-native';
import { useAnimatedStyle } from 'react-native-reanimated';
import {
  ArrowLink,
  Connectors,
  ConnectorSurface,
  useConnectorField,
  type Link,
} from '@/components/public/connectors';
import { Media } from '@/components/public/media';
import { Animated, Reveal, useCountUp, useGrowIn } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
import {
  ButtonRow,
  Card,
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
import { contactHref, EXTERNAL } from '@/lib/destinations';
import { hexToRgba, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* tones                                                               */
/* ------------------------------------------------------------------ */

type Tone = 'brand' | 'violet' | 'orange' | 'green';

function accent(t: ThemeTokens, tone: Tone): string {
  return tone === 'violet' ? t.violet : tone === 'orange' ? t.orange : tone === 'green' ? t.green : t.brand;
}

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

type Step = { key: string; icon: string; title: string; caption: string; tone: Tone };

/** The learning journey, left to right and rising. */
const JOURNEY: Step[] = [
  { key: 'understand', icon: 'book-open', title: 'Understand', caption: 'What AI can and cannot do.', tone: 'brand' },
  { key: 'apply', icon: 'wand-magic-sparkles', title: 'Apply', caption: 'Put it to work on real tasks.', tone: 'violet' },
  { key: 'govern', icon: 'shield-halved', title: 'Govern', caption: 'Set the rules and the guardrails.', tone: 'violet' },
  { key: 'grow', icon: 'arrow-trend-up', title: 'Grow', caption: 'Scale what measurably works.', tone: 'orange' },
];

type Pillar = { icon: string; title: string; body: string; tone: Tone };

const PILLARS: Pillar[] = [
  { icon: 'brain', title: 'AI Foundations', body: 'Models, prompts, limitations, and verification.', tone: 'brand' },
  { icon: 'diagram-project', title: 'Agentic Workflows', body: 'Agents, tools, approvals, and human handoffs.', tone: 'violet' },
  { icon: 'scale-balanced', title: 'AI Governance', body: 'Policies, permissions, risk tiers, and accountability.', tone: 'orange' },
  { icon: 'lock', title: 'Data Privacy & Security', body: 'Safe data handling and vendor evaluation.', tone: 'green' },
  { icon: 'handshake-angle', title: 'Responsible AI', body: 'Bias, transparency, provenance, and customer trust.', tone: 'brand' },
  { icon: 'chart-line', title: 'AI-Powered Growth', body: 'Marketing, sales, service, commerce, and analytics.', tone: 'violet' },
];

type Role = { icon: string; title: string; points: string[]; tone: Tone };

const ROLES: Role[] = [
  {
    icon: 'user-tie',
    title: 'Owner & Leadership',
    tone: 'brand',
    points: ['AI strategy and decision-making', 'Risk management and governance', 'Building an AI-ready culture'],
  },
  {
    icon: 'bullhorn',
    title: 'Marketing Teams',
    tone: 'violet',
    points: ['Content and campaign creation', 'Audience insights and analytics', 'Workflow automation'],
  },
  {
    icon: 'headset',
    title: 'Sales & Service',
    tone: 'orange',
    points: ['AI-assisted selling', 'Customer support automation', 'Personalized communications'],
  },
  {
    icon: 'gears',
    title: 'Operations',
    tone: 'green',
    points: ['Process automation', 'Data quality and integration', 'Efficiency and scaling'],
  },
];

type Readiness = { icon: string; label: string; caption: string; score: number; tone: Tone };

const READINESS: Readiness[] = [
  { icon: 'bullseye', label: 'Strategy', caption: 'AI goals aligned to business outcomes', score: 72, tone: 'brand' },
  { icon: 'users', label: 'People', caption: 'Skills, roles, and change readiness', score: 58, tone: 'violet' },
  { icon: 'database', label: 'Data', caption: 'Data quality, access, and security', score: 61, tone: 'green' },
  { icon: 'scale-balanced', label: 'Governance', caption: 'Policies, risk, and accountability', score: 48, tone: 'orange' },
  { icon: 'rocket', label: 'Execution', caption: 'Pilots, adoption, and measurement', score: 55, tone: 'brand' },
];

type Capability = { icon: string; title: string; body: string; tone: Tone };

const CAPABILITY: Capability[] = [
  { icon: 'graduation-cap', title: 'Learn', body: 'Expert-led courses, short lessons, and real-world examples.', tone: 'brand' },
  { icon: 'pen', title: 'Practice', body: 'Guided exercises and sandbox projects to build confidence.', tone: 'violet' },
  { icon: 'briefcase', title: 'Apply', body: 'Templates, playbooks, and implementation checklists.', tone: 'orange' },
  { icon: 'chart-column', title: 'Measure', body: 'Track impact, refine processes, and scale what works.', tone: 'green' },
];

const SUPPORT: { icon: string; label: string; tone: Tone }[] = [
  { icon: 'users', label: 'Live workshops', tone: 'brand' },
  { icon: 'comments', label: 'Peer community', tone: 'violet' },
  { icon: 'file-lines', label: 'Templates & playbooks', tone: 'orange' },
  { icon: 'certificate', label: 'Certificates of completion', tone: 'green' },
  { icon: 'wand-magic-sparkles', label: 'In-product coaching', tone: 'brand' },
];

/**
 * These four documents are not downloadable files on this site yet, so each row
 * opens Contact with the request — and the document — already selected.
 */
const GOVERNANCE = [
  'AI acceptable-use policy template',
  'Risk assessment checklist',
  'Vendor evaluation guide',
  'Human approval framework',
];

const ASSISTANT_POINTS = [
  'In-app guidance and best practices',
  'Just-in-time tips and role-based lessons',
  'Built-in safety checks and guardrails',
  'Keep teams aligned and informed',
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
/* small pieces                                                        */
/* ------------------------------------------------------------------ */

function IconTile({ icon, tone, size = 44 }: { icon: string; tone: Tone; size?: number }) {
  const t = useTokens();
  const color = accent(t, tone);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        alignItems: 'center',
        justifyContent: 'center',
        flexGrow: 0,
        flexShrink: 0,
        backgroundColor: softFill(color, t),
      }}>
      <FontAwesome6 name={icon as never} size={Math.round(size * 0.44)} color={color} />
    </View>
  );
}

function Tick({ children }: { children: string }) {
  const styles = useStyles();
  const t = useTokens();
  return (
    <View style={styles.tickRow}>
      <View style={styles.tickDot}>
        <FontAwesome6 name="check" size={9} color={t.successText} />
      </View>
      <Text style={styles.tickText}>{children}</Text>
    </View>
  );
}

function TextLink({ label, href }: { label: string; href: string }) {
  const styles = useStyles();
  const t = useTokens();
  return (
    <RouterLink
      href={href as never}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={styles.linkRow as never}>
      <Text style={styles.linkText}>{label}</Text>
      <FontAwesome6 name="arrow-right" size={12} color={t.brand} />
    </RouterLink>
  );
}

function SectionHead({ label, title, body }: { label?: string; title: string; body: string }) {
  const styles = useStyles();
  return (
    <Reveal style={styles.headCentered} distance={14}>
      {label ? (
        <View style={styles.centerSelf}>
          <SectionLabel>{label}</SectionLabel>
        </View>
      ) : null}
      <Heading level={2} style={styles.headTitleCentered}>
        {title}
      </Heading>
      <Text style={styles.headBodyCentered}>{body}</Text>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* 1 — hero + journey diagram                                          */
/* ------------------------------------------------------------------ */

/**
 * One step of the journey. The measured node is the *circle only*, so the
 * dotted line lands on the ring rather than somewhere inside the caption
 * block underneath it.
 */
function JourneyStep({
  step,
  index,
  field,
  vertical,
}: {
  step: Step;
  index: number;
  field: ReturnType<typeof useConnectorField>;
  vertical: boolean;
}) {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const color = accent(t, step.tone);
  const rise = l.isTablet ? 16 : 26;
  const circleSize = vertical ? 52 : l.isTablet ? 60 : 68;

  const circle = (
    <View
      {...field.node(step.key)}
      style={[
        styles.stepCircle,
        {
          width: circleSize,
          height: circleSize,
          borderRadius: circleSize / 2,
          borderColor: color,
          backgroundColor: softFill(color, t),
        },
      ]}>
      <FontAwesome6 name={step.icon as never} size={Math.round(circleSize * 0.36)} color={color} />
    </View>
  );

  const copy = (
    <View style={vertical ? styles.stepCopyRow : styles.stepCopyColumn}>
      <Text style={[styles.stepTitle, { color }]}>{step.title}</Text>
      <Text style={styles.stepCaption}>{step.caption}</Text>
    </View>
  );

  if (vertical) {
    return (
      <View style={styles.stepRow}>
        {circle}
        {copy}
      </View>
    );
  }

  return (
    <View style={[styles.stepColumn, { paddingTop: (JOURNEY.length - 1 - index) * rise }]}>
      {circle}
      {copy}
    </View>
  );
}

function JourneyDiagram() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const field = useConnectorField();
  const vertical = l.isPhone;

  const links = useMemo<Link[]>(
    () =>
      JOURNEY.slice(1).map((step, index) => ({
        from: JOURNEY[index].key,
        to: step.key,
        color: hexToRgba(accent(t, step.tone), 0.75),
      })),
    [t],
  );

  const circular = useMemo(() => JOURNEY.map((step) => step.key), []);

  return (
    <ConnectorSurface field={field} style={vertical ? styles.journeyColumn : styles.journeyRow}>
      <Connectors
        field={field}
        links={links}
        color={t.brand}
        circular={circular}
        strokeWidth={2}
        dash="0.5 6"
        endDots={false}
        flow
        flowDuration={2200}
      />
      {JOURNEY.map((step, index) => (
        <JourneyStep key={step.key} step={step} index={index} field={field} vertical={vertical} />
      ))}
    </ConnectorSurface>
  );
}

function Hero() {
  const t = useTokens();
  const styles = useStyles();
  const l = useLayout();
  const router = useRouter();

  return (
    <OpenSection style={styles.hero}>
      <SectionAside variant="docs" color={t.violet} side="left" at="bottom" />
      {/* One reveal for the whole hero: the connector overlay measures with
          getBoundingClientRect, so every wired node has to live inside the same
          (translate-only) transform. */}
      <Reveal style={styles.heroInner} distance={18}>
        <View style={styles.heroCopy}>
          <SectionLabel>AI FLUENCY</SectionLabel>
          <Heading level={1} style={styles.heroTitle}>
            AI fluency for the whole business.
          </Heading>
          <Text style={styles.heroBody}>
            Build the knowledge, judgment, and practical skills to use AI confidently—without losing
            control of your business.
          </Text>
          <ButtonRow>
            <PrimaryButton
              label="Explore learning paths"
              size="lg"
              full={l.isPhone}
              trackId="ai-fluency.hero.paths"
              onPress={() => router.push(ROUTES.guides as never)}
            />
            <SecondaryButton
              label="Assess your AI readiness"
              size="lg"
              full={l.isPhone}
              trackId="ai-fluency.hero.assessment"
              onPress={() => router.push(contactHref('assessment') as never)}
            />
          </ButtonRow>
        </View>

        <View style={styles.heroVisual}>
          <JourneyDiagram />
        </View>
      </Reveal>
    </OpenSection>
  );
}

/* ------------------------------------------------------------------ */
/* 2 — philosophy band                                                 */
/* ------------------------------------------------------------------ */

function Philosophy() {
  const styles = useStyles();
  const l = useLayout();

  return (
    <Band tone="surface" style={styles.philosophy}>
      <Reveal style={styles.philosophyInner} distance={14}>
        <IconTile icon="book-open" tone="brand" size={l.isPhone ? 60 : 84} />
        <View style={styles.philosophyCopy}>
          <Heading level={2} style={styles.philosophyTitle}>
            AI education is growth infrastructure.
          </Heading>
          <Text style={styles.philosophyBody}>
            FlowSmartly does more than provide AI tools. We help owners and teams understand when, why,
            and how to use them responsibly—so AI becomes a trusted advantage, not an uncontrolled risk.
          </Text>
        </View>
      </Reveal>
    </Band>
  );
}

/* ------------------------------------------------------------------ */
/* 3 — core learning pillars                                           */
/* ------------------------------------------------------------------ */

function Pillars() {
  const t = useTokens();
  const styles = useStyles();
  const l = useLayout();
  /** six items divide cleanly at 6 / 3 / 2 — no row ever strands one cell */
  const columns = l.isPhone ? 2 : l.isDesktop ? 6 : 3;

  return (
    <Band tone="violet" art={{ variant: 'docs', color: t.violet, side: 'right' }}>
      <SectionHead
        label="LEARNING PILLARS"
        title="Core learning pillars"
        body="Practical education across the topics that matter most."
      />
      <View style={styles.grid}>
        {PILLARS.map((pillar, index) => (
          <Reveal
            key={pillar.title}
            delay={40 + index * 50}
            distance={12}
            style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <Card style={styles.pillarCard}>
              <View style={styles.pillarTop}>
                <View style={styles.numberBadge}>
                  <Text style={styles.numberText}>{String(index + 1).padStart(2, '0')}</Text>
                </View>
                <IconTile icon={pillar.icon} tone={pillar.tone} size={38} />
              </View>
              <Text style={styles.cardTitle}>{pillar.title}</Text>
              <Text style={styles.cardBody}>{pillar.body}</Text>
            </Card>
          </Reveal>
        ))}
      </View>
    </Band>
  );
}

/* ------------------------------------------------------------------ */
/* 4 — learning paths + readiness assessment                           */
/* ------------------------------------------------------------------ */

function LearningPaths() {
  const styles = useStyles();
  const l = useLayout();
  const columns = l.isPhone ? 1 : 2;

  return (
    <Card style={styles.panelCard}>
      <View style={styles.headLeft}>
        <Heading level={2} style={styles.headTitle}>
          Learning built for real business decisions
        </Heading>
        <Text style={styles.headBody}>Role-based learning paths that connect education to outcomes.</Text>
      </View>

      <View style={styles.gridTight}>
        {ROLES.map((role, index) => (
          <Reveal
            key={role.title}
            delay={40 + index * 60}
            distance={12}
            style={[styles.cellTight, { flexBasis: cellBasis(columns) }]}>
            <Card inset level={1} style={styles.roleCard}>
              <View style={styles.roleHead}>
                <IconTile icon={role.icon} tone={role.tone} size={36} />
                <Text style={styles.roleTitle}>{role.title}</Text>
              </View>
              <View style={styles.tickList}>
                {role.points.map((point) => (
                  <Tick key={point}>{point}</Tick>
                ))}
              </View>
            </Card>
          </Reveal>
        ))}
      </View>

      <TextLink label="View all learning paths" href={ROUTES.guides} />
    </Card>
  );
}

function ScoreRow({ item, index }: { item: Readiness; index: number }) {
  const styles = useStyles();
  const t = useTokens();
  const color = accent(t, item.tone);
  const count = useCountUp(item.score, { duration: 1100 });
  const grow = useGrowIn({ duration: 720, delay: 120 + index * 90 });

  // The static width is the real score, so a no-JS render shows the finished
  // meter; the animation only rides it in on the client.
  const fill = useAnimatedStyle(() => ({
    width: `${item.score * grow.progress.value}%` as DimensionValue,
  }));

  return (
    <View style={styles.scoreRow}>
      <IconTile icon={item.icon} tone={item.tone} size={34} />
      <View style={styles.scoreCopy}>
        <View style={styles.scoreTop}>
          <Text style={styles.scoreLabel} numberOfLines={1}>
            {item.label}
          </Text>
          <Text ref={count.ref as never} style={[styles.scoreValue, { color }]} numberOfLines={1}>
            {count.value}
            <Text style={styles.scoreOutOf}>/100</Text>
          </Text>
        </View>
        <Text style={styles.scoreCaption} numberOfLines={2}>
          {item.caption}
        </Text>
        <View ref={grow.ref as never} style={styles.meterTrack}>
          <Animated.View
            style={[styles.meterFill, { width: `${item.score}%` as DimensionValue, backgroundColor: color }, fill]}
          />
        </View>
      </View>
    </View>
  );
}

function ReadinessCard() {
  const styles = useStyles();
  const t = useTokens();
  const router = useRouter();

  return (
    <Card style={styles.panelCard}>
      <View style={styles.assessHead}>
        <IconTile icon="gauge-high" tone="brand" size={40} />
        <View style={styles.assessHeadCopy}>
          <Heading level={3} style={styles.headTitleSm}>
            AI Readiness Assessment
          </Heading>
          <Text style={styles.headBody}>Get your score and see where to focus first.</Text>
        </View>
      </View>

      <View style={styles.scoreList}>
        {READINESS.map((item, index) => (
          <ScoreRow key={item.label} item={item} index={index} />
        ))}
      </View>

      <View style={styles.assessFoot}>
        <PrimaryButton
          label="Take the assessment"
          icon="arrow-right"
          iconRight
          full
          trackId="ai-fluency.readiness.assessment"
          onPress={() => router.push(contactHref('assessment') as never)}
        />
        <View style={styles.assessNote}>
          <FontAwesome6 name="clock" size={11} color={t.textSubtle} />
          <Text style={styles.footnote}>Takes about 5 minutes. No account needed.</Text>
        </View>
      </View>
    </Card>
  );
}

function PathsAndReadiness() {
  const styles = useStyles();
  return (
    <OpenSection>
      <View style={styles.twoUp}>
        <Reveal style={styles.twoUpWide} distance={14}>
          <LearningPaths />
        </Reveal>
        <Reveal style={styles.twoUpNarrow} distance={14} delay={90}>
          <ReadinessCard />
        </Reveal>
      </View>
    </OpenSection>
  );
}

/* ------------------------------------------------------------------ */
/* 5 — from course to capability                                       */
/* ------------------------------------------------------------------ */

function CapabilityCard({ item }: { item: Capability }) {
  const styles = useStyles();
  return (
    <Card style={styles.capabilityCard}>
      <IconTile icon={item.icon} tone={item.tone} size={44} />
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardBody}>{item.body}</Text>
    </Card>
  );
}

function CourseToCapability() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  /** the arrowed row needs room for four cards side by side */
  const flowRow = !l.isCompact;
  const columns = l.isPhone ? 1 : 2;

  return (
    <Band tone="surface" art={{ variant: 'network', color: t.brand, side: 'left' }}>
      <SectionHead
        label="THE PATH"
        title="From course to capability"
        body="We turn learning into action with practical support at every step."
      />

      {flowRow ? (
        <Reveal style={styles.capabilityRow} distance={14}>
          {CAPABILITY.map((item, index) => (
            <View key={item.title} style={styles.capabilityFlowCell}>
              <CapabilityCard item={item} />
              {index < CAPABILITY.length - 1 ? (
                <View style={styles.arrowSlot}>
                  <ArrowLink width={l.isDesktop ? 40 : 28} color={hexToRgba(t.textSubtle, 0.9)} />
                </View>
              ) : null}
            </View>
          ))}
        </Reveal>
      ) : (
        <View style={styles.grid}>
          {CAPABILITY.map((item, index) => (
            <Reveal
              key={item.title}
              delay={40 + index * 60}
              distance={12}
              style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
              <CapabilityCard item={item} />
            </Reveal>
          ))}
        </View>
      )}
    </Band>
  );
}

/* ------------------------------------------------------------------ */
/* 6 — support strip                                                   */
/* ------------------------------------------------------------------ */

function SupportStrip() {
  const styles = useStyles();
  const l = useLayout();

  return (
    <Band tone="violet" style={styles.stripSection}>
      <Reveal style={styles.strip} distance={12}>
        {SUPPORT.map((item, index) => (
          <View
            key={item.label}
            style={[styles.stripItem, index > 0 ? styles.stripItemDivided : null]}>
            <IconTile icon={item.icon} tone={item.tone} size={l.isPhone ? 34 : 38} />
            {/* five narrow columns: the longest label needs three lines at the
                tablet width before it would rather ellipsize */}
            <Text style={styles.stripLabel} numberOfLines={l.isPhone ? 2 : 3}>
              {item.label}
            </Text>
          </View>
        ))}
      </Reveal>
    </Band>
  );
}

/* ------------------------------------------------------------------ */
/* 7 — governance resources + FlowAgent education                        */
/* ------------------------------------------------------------------ */

function GovernanceCard() {
  const styles = useStyles();
  const t = useTokens();

  return (
    <Card style={styles.panelCard}>
      <View style={styles.headLeft}>
        <Heading level={3} style={styles.headTitleSm}>
          Governance resources you can use today
        </Heading>
        <Text style={styles.headBody}>Practical tools to help you lead AI responsibly.</Text>
      </View>

      <View style={styles.rowList}>
        {GOVERNANCE.map((resource, index) => (
          <RouterLink
            key={resource}
            href={contactHref('guide', { resource }) as never}
            accessibilityRole="link"
            accessibilityLabel={`Request the ${resource}`}
            style={
              [styles.resourceRow, index === GOVERNANCE.length - 1 ? styles.lastRow : null] as never
            }>
            <IconTile icon="file-lines" tone="brand" size={32} />
            <Text style={styles.resourceText} numberOfLines={2}>
              {resource}
            </Text>
            <FontAwesome6 name="chevron-right" size={12} color={t.textSubtle} />
          </RouterLink>
        ))}
      </View>

      <TextLink label="Browse all governance resources" href={ROUTES.guides} />
    </Card>
  );
}

function AssistantMock() {
  const styles = useStyles();
  const t = useTokens();

  return (
    <View style={styles.assistant}>
      <View style={styles.assistantHead}>
        <View style={styles.assistantMark}>
          <FontAwesome6 name="wand-magic-sparkles" size={13} color={t.textOnBrand} />
        </View>
        <Text style={styles.assistantName} numberOfLines={1}>
          FlowAgent Assistant
        </Text>
        <View style={styles.betaChip}>
          <Text style={styles.betaText}>BETA</Text>
        </View>
      </View>

      <View style={styles.assistantBubble}>
        <Text style={styles.assistantBubbleText}>
          Here is a draft for your spring promotion. Review the offer details before it goes out.
        </Text>
      </View>

      <View style={styles.safetyTip}>
        <View style={styles.safetyHead}>
          <FontAwesome6 name="shield-halved" size={12} color={t.warnText} />
          <Text style={styles.safetyTitle}>Safety tip</Text>
        </View>
        <Text style={styles.safetyBody}>
          Avoid unverified claims and ensure compliance with messaging policy.
        </Text>
        {/* Illustration, not a control — this is a picture of the in-product
            assistant, so nothing inside it is pressable. */}
        <View style={styles.safetyLink}>
          <Text style={styles.safetyLinkText}>Learn more</Text>
          <FontAwesome6 name="arrow-right" size={10} color={t.warnText} />
        </View>
      </View>

      <View style={styles.askRow} pointerEvents="none">
        <Text style={styles.askText}>Ask a question…</Text>
        <View style={styles.askSend}>
          <FontAwesome6 name="paper-plane" size={12} color={t.textSubtle} />
        </View>
      </View>
    </View>
  );
}

function AssistantCard() {
  const styles = useStyles();

  return (
    <Card style={styles.panelCard}>
      <View style={styles.headLeft}>
        <Heading level={3} style={styles.headTitleSm}>
          FlowAgent education inside your workflows
        </Heading>
        <Text style={styles.headBody}>Contextual lessons and safety guidance—right where you work.</Text>
      </View>

      <View style={styles.assistantSplit}>
        <View style={styles.assistantPoints}>
          {ASSISTANT_POINTS.map((point) => (
            <Tick key={point}>{point}</Tick>
          ))}
        </View>
        <View style={styles.assistantPanelSlot}>
          <AssistantMock />
        </View>
      </View>
    </Card>
  );
}

function GovernanceAndAssistant() {
  const styles = useStyles();
  return (
    <OpenSection art="none">
      <View style={styles.twoUp}>
        <Reveal style={styles.twoUpNarrow} distance={14}>
          <GovernanceCard />
        </Reveal>
        <Reveal style={styles.twoUpWide} distance={14} delay={90}>
          <AssistantCard />
        </Reveal>
      </View>
    </OpenSection>
  );
}

/* ------------------------------------------------------------------ */
/* 8 — closing band                                                    */
/* ------------------------------------------------------------------ */

function Closing() {
  const styles = useStyles();
  const l = useLayout();
  const router = useRouter();

  return (
    <Band tone="surface" style={styles.closing}>
      <Reveal style={styles.closingInner} distance={14}>
        <Media
          name="flowsmartly-mark"
          alt="FlowSmartly"
          contentFit="contain"
          radius={0}
          style={styles.closingMark}
        />
        <Heading level={2} style={styles.closingTitle}>
          Help your team move forward with AI—confidently.
        </Heading>
        <ButtonRow>
          <PrimaryButton
            label="Start free"
            size="lg"
            full={l.isPhone}
            trackId="ai-fluency.closing.start-free"
            onPress={() => {
              Linking.openURL(EXTERNAL.signup).catch(() => undefined);
            }}
          />
          <SecondaryButton
            label="Talk to an AI advisor"
            size="lg"
            full={l.isPhone}
            trackId="ai-fluency.closing.advisor"
            onPress={() => router.push(contactHref('sales', { about: 'ai-fluency' }) as never)}
          />
        </ButtonRow>
      </Reveal>
    </Band>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function AiFluencyPage() {
  return (
    <PageShell
      title="AI Fluency for Small Businesses"
      description="Build the knowledge, judgment and practical skills to use AI confidently — learning paths, governance resources and an AI readiness assessment."
      cta={false}
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'AI Fluency', path: ROUTES.aiFluency },
        ]),
      ]}>
      <Hero />
      <Philosophy />
      <Pillars />
      <PathsAndReadiness />
      <CourseToCapability />
      <SupportStrip />
      <GovernanceAndAssistant />
      <Closing />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  /** half the grid gutter; cells carry it as padding so wrapped rows stay flush */
  const cellPad = l.isPhone ? 5 : 7;
  const cellPadTight = l.isPhone ? 4 : 6;

  return StyleSheet.create({
    /* 1 — hero ----------------------------------------------------- */
    hero: { paddingTop: l.isPhone ? 24 : 40, paddingBottom: l.isPhone ? 16 : 32 },
    heroInner: {
      flexDirection: l.isStacked ? 'column' : 'row',
      alignItems: l.isStacked ? 'stretch' : 'center',
      gap: l.isStacked ? 34 : 44,
    },
    heroCopy: {
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: l.isStacked ? 'auto' : '46%',
      minWidth: 0,
      gap: 18,
      maxWidth: l.isStacked ? undefined : 640,
    },
    heroTitle: type.display,
    heroBody: { ...type.body, maxWidth: 560 },
    heroVisual: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: l.isStacked ? 'auto' : '54%',
      minWidth: 0,
    },

    journeyRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: l.isTablet ? 8 : 12,
      paddingTop: 6,
      paddingBottom: 6,
    },
    journeyColumn: { flexDirection: 'column', gap: 20, paddingVertical: 4 },

    stepColumn: {
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: '25%',
      minWidth: 0,
      alignItems: 'center',
      gap: 12,
    },
    stepRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    stepCircle: {
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      flexGrow: 0,
      flexShrink: 0,
    },
    stepCopyColumn: { alignItems: 'center', gap: 4, minWidth: 0 },
    stepCopyRow: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    stepTitle: { ...type.h4, textAlign: l.isPhone ? 'left' : 'center' },
    stepCaption: { ...type.caption, color: t.textMuted, textAlign: l.isPhone ? 'left' : 'center' },

    /* 2 — philosophy ----------------------------------------------- */
    philosophy: { backgroundColor: t.surfaceMuted },
    philosophyInner: {
      flexDirection: l.isStacked ? 'column' : 'row',
      alignItems: l.isStacked ? 'flex-start' : 'center',
      gap: l.isStacked ? 20 : 32,
    },
    philosophyCopy: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      gap: 12,
      flexDirection: l.isStacked || !l.isDesktop ? 'column' : 'row',
      alignItems: l.isStacked || !l.isDesktop ? 'flex-start' : 'center',
    },
    philosophyTitle: {
      ...type.h2,
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: l.isStacked || !l.isDesktop ? 'auto' : '42%',
      minWidth: 0,
      paddingRight: l.isStacked || !l.isDesktop ? 0 : 28,
    },
    philosophyBody: {
      ...type.body,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },

    /* 3 — pillars -------------------------------------------------- */
    headCentered: { alignItems: 'center', gap: 12, alignSelf: 'center', maxWidth: 720 },
    centerSelf: { alignSelf: 'center' },
    headTitleCentered: { ...type.h2, textAlign: 'center' },
    headBodyCentered: { ...type.body, textAlign: 'center' },

    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      marginHorizontal: -cellPad,
      marginTop: 24 - cellPad,
    },
    cell: { flexGrow: 0, flexShrink: 0, minWidth: 0, padding: cellPad },

    pillarCard: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      padding: l.isPhone ? 14 : 16,
      borderRadius: 16,
      gap: 9,
    },
    pillarTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    numberBadge: {
      minWidth: 30,
      height: 24,
      paddingHorizontal: 8,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.chipBg,
      flexGrow: 0,
      flexShrink: 0,
    },
    numberText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: t.chipText },
    cardTitle: { ...type.h4, color: t.text },
    cardBody: { ...type.bodySm, color: t.textMuted },

    /* 4 — two-up shell --------------------------------------------- */
    twoUp: {
      flexDirection: l.isStacked ? 'column' : 'row',
      alignItems: 'stretch',
      gap: l.isPhone ? 12 : 16,
    },
    twoUpWide: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: l.isStacked ? 'auto' : '56%',
      minWidth: 0,
      flexDirection: 'column',
    },
    twoUpNarrow: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: l.isStacked ? 'auto' : '44%',
      minWidth: 0,
      flexDirection: 'column',
    },

    panelCard: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      padding: l.isPhone ? 16 : 22,
      borderRadius: 18,
      gap: 16,
    },
    headLeft: { gap: 8 },
    headTitle: type.h3,
    headTitleSm: type.h3,
    headBody: { ...type.bodySm, color: t.textMuted },

    gridTight: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      marginHorizontal: -cellPadTight,
      marginTop: -cellPadTight,
    },
    cellTight: { flexGrow: 0, flexShrink: 0, minWidth: 0, padding: cellPadTight },

    roleCard: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      padding: 14,
      borderRadius: 14,
      gap: 12,
    },
    roleHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    roleTitle: { ...type.bodySm, fontWeight: '800', color: t.text, flexGrow: 1, flexShrink: 1, minWidth: 0 },
    tickList: { gap: 7 },
    tickRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
    tickDot: {
      width: 17,
      height: 17,
      borderRadius: 9,
      marginTop: 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.successBg,
      flexGrow: 0,
      flexShrink: 0,
    },
    tickText: { ...type.caption, color: t.textMuted, flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0 },

    /** rendered as an anchor: RNW anchors are inline unless told otherwise */
    linkRow: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 44,
      textDecorationLine: 'none',
    },
    linkText: { ...type.bodySm, fontWeight: '700', color: t.brand },

    /* readiness ----------------------------------------------------- */
    assessHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    assessHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 4 },

    scoreList: { gap: 14 },
    scoreRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    scoreCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 4 },
    scoreTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
    scoreLabel: { ...type.bodySm, fontWeight: '800', color: t.text, flexGrow: 1, flexShrink: 1, minWidth: 0 },
    scoreValue: { ...type.h4, flexGrow: 0, flexShrink: 0 },
    scoreOutOf: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    scoreCaption: { ...type.micro, color: t.textMuted },
    meterTrack: {
      height: 7,
      borderRadius: 4,
      marginTop: 3,
      overflow: 'hidden',
      backgroundColor: t.surfaceInset,
    },
    meterFill: { height: 7, borderRadius: 4 },

    assessFoot: { gap: 10 },
    assessNote: { flexDirection: 'row', alignItems: 'center', gap: 7, justifyContent: 'center' },
    footnote: { ...type.micro, color: t.textSubtle },

    /* 5 — course to capability -------------------------------------- */
    capabilityRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      marginTop: 24,
    },
    capabilityFlowCell: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: '25%',
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    arrowSlot: {
      flexGrow: 0,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: l.isDesktop ? 8 : 5,
    },
    capabilityCard: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      padding: l.isPhone ? 14 : 18,
      borderRadius: 16,
      gap: 10,
    },

    /* 6 — support strip --------------------------------------------- */
    stripSection: { paddingVertical: l.isPhone ? 14 : 20 },
    strip: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: 'stretch',
    },
    stripItem: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: l.isPhone ? 'auto' : '20%',
      minWidth: 0,
      flexDirection: l.isPhone ? 'row' : 'column',
      alignItems: 'center',
      justifyContent: l.isPhone ? 'flex-start' : 'center',
      gap: l.isPhone ? 12 : 10,
      minHeight: 44,
      paddingVertical: l.isPhone ? 12 : 6,
      paddingHorizontal: l.isPhone ? 0 : 8,
    },
    stripItemDivided: {
      borderTopWidth: l.isPhone ? 1 : 0,
      borderLeftWidth: l.isPhone ? 0 : 1,
      borderColor: t.divider,
    },
    stripLabel: {
      ...(l.isPhone ? type.bodySm : type.caption),
      color: t.text,
      fontWeight: '700',
      textAlign: l.isPhone ? 'left' : 'center',
      flexGrow: l.isPhone ? 1 : 0,
      flexShrink: 1,
      minWidth: 0,
    },

    /* 7 — governance + assistant ------------------------------------ */
    rowList: { gap: 2 },
    lastRow: { borderBottomWidth: 0 },
    resourceRow: {
      minHeight: 52,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.divider,
      textDecorationLine: 'none',
    },
    resourceText: {
      ...type.bodySm,
      color: t.text,
      fontWeight: '600',
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },

    assistantSplit: {
      flexDirection: l.isDesktop ? 'row' : 'column',
      alignItems: l.isDesktop ? 'flex-start' : 'stretch',
      gap: l.isDesktop ? 22 : 16,
    },
    assistantPoints: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: l.isDesktop ? '44%' : 'auto',
      minWidth: 0,
      gap: 10,
      paddingTop: 2,
    },
    assistantPanelSlot: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: l.isDesktop ? '56%' : 'auto',
      minWidth: 0,
    },

    assistant: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceMuted,
      padding: 14,
      gap: 12,
    },
    assistantHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    assistantMark: {
      width: 28,
      height: 28,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brand,
      flexGrow: 0,
      flexShrink: 0,
    },
    assistantName: { ...type.bodySm, fontWeight: '800', color: t.text, flexGrow: 1, flexShrink: 1, minWidth: 0 },
    betaChip: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: t.chipBg,
      flexGrow: 0,
      flexShrink: 0,
    },
    betaText: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: t.chipText },

    assistantBubble: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      borderTopLeftRadius: 4,
      backgroundColor: t.surfaceRaised,
      padding: 12,
    },
    assistantBubbleText: { ...type.caption, color: t.text },

    safetyTip: {
      borderRadius: 12,
      backgroundColor: t.warnBg,
      borderWidth: 1,
      borderColor: hexToRgba(t.orange, t.mode === 'light' ? 0.24 : 0.34),
      padding: 12,
      gap: 6,
    },
    safetyHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    safetyTitle: { ...type.micro, fontWeight: '800', color: t.warnText, letterSpacing: 0.4 },
    safetyBody: { ...type.caption, color: t.warnText },
    safetyLink: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 24 },
    safetyLinkText: { ...type.micro, fontWeight: '800', color: t.warnText },

    askRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceInset,
      opacity: 0.75,
    },
    askText: { ...type.bodySm, color: t.textSubtle, flexGrow: 1, flexShrink: 1, minWidth: 0 },
    askSend: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceRaised,
      flexGrow: 0,
      flexShrink: 0,
    },

    /* 8 — closing ---------------------------------------------------- */
    closing: { alignItems: 'center' },
    closingInner: {
      alignItems: 'center',
      gap: 18,
      maxWidth: 700,
      paddingVertical: l.isPhone ? 10 : 24,
    },
    closingMark: { width: l.isPhone ? 46 : 58, height: l.isPhone ? 46 : 58 },
    closingTitle: { ...type.h1, textAlign: 'center' },
  });
}
