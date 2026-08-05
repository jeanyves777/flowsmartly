import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Fragment, useCallback, useLayoutEffect, useMemo, useRef } from "react";
import {
  Linking,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { CallAgentSection } from "@/components/public/call-agent-section";
import { ConnectedChannelsSection } from "@/components/public/connected-channels-section";
import {
  ArrowLink,
  Connectors,
  ConnectorSurface,
  useConnectorField,
  type Link,
} from "@/components/public/connectors";
import { ListSmartlySection } from "@/components/public/listsmartly-section";
import {
  Animated,
  Reveal,
  Stagger,
  useCountUp,
  useGrowIn,
  useReducedMotion,
} from "@/components/public/motion";
import {
  ButtonRow,
  Heading,
  PrimaryButton,
  SecondaryButton,
  SectionLabel,
  useSectionShell,
  useTypeScale,
  type TypeScale,
} from "@/components/public/ui";
import { ROUTES } from "@/components/public/nav";
import { PageShell } from "@/components/public/page-shell";
import { breadcrumbJsonLd, organizationJsonLd, webSiteJsonLd } from "@/components/public/seo";
import { contactHref, EXTERNAL } from "@/lib/destinations";
import { brandColor, elevation, hexToRgba, type ThemeTokens } from "@/theme/tokens";
import { useLayout, type Layout } from "@/theme/use-responsive";
import { useTokens } from "@/theme/v5-theme-provider";

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

type Styles = ReturnType<typeof createStyles>;

// The stylesheet is rebuilt whenever the theme or the breakpoint changes, so a
// single cache entry serves every component in the tree for that combination.
let cachedStyles: { key: string; value: Styles } | null = null;

function useStyles(): Styles {
  const t = useTokens();
  const l = useLayout();
  const ty = useTypeScale();
  return useMemo(() => {
    // Keyed on what createStyles actually reads (breakpoint + the stack flag),
    // not the raw width — otherwise every resize pixel builds a new StyleSheet.
    const key = `${t.mode}|${l.bp}|${l.isStacked}`;
    if (cachedStyles && cachedStyles.key === key) return cachedStyles.value;
    const value = createStyles(t, l, ty);
    cachedStyles = { key, value };
    return value;
  }, [t, l, ty]);
}

/* ------------------------------------------------------------------ */
/* brand mark                                                          */
/* ------------------------------------------------------------------ */

/**
 * The page used to carry a second, unrendered copy of the site header — five
 * nav items, a "Sign in" and a "Start free" that went nowhere. `PageShell`
 * supplies the real, wired header, so the duplicate is gone rather than
 * lingering as a source of dead CTAs.
 */
/**
 * `alt` is required, and deliberately has no default.
 *
 * The compact mark renders three times on this page with three different
 * meanings — it is the hub of the channel map, the avatar in the Flow.AI card,
 * and a tile in the dashboard — so a single baked-in alt would be wrong in at
 * least two of them. Every caller has to say what its instance means, or say
 * `alt=""` and mark it decorative.
 */
function Brand({ compact = false, alt }: { compact?: boolean; alt: string }) {
  const styles = useStyles();
  const decorative = alt.trim() === '';
  const shared = {
    alt: decorative ? undefined : alt,
    'aria-hidden': decorative || undefined,
    contentFit: 'contain' as const,
  };
  return compact ? (
    <Image
      source={require("../../assets/images/v5w/flowsmartly-mark.png")}
      style={styles.brandLogoCompact}
      {...shared}
    />
  ) : (
    <Image
      source={require("../../assets/images/v5w/flowsmartly-logo.png")}
      style={styles.brandLogo}
      contentPosition="left"
      {...shared}
    />
  );
}

/* ------------------------------------------------------------------ */
/* mockup chrome                                                       */
/* ------------------------------------------------------------------ */

/**
 * A button *drawn inside a product mockup*.
 *
 * The Flow.AI card, the approval queue and the recommendation card are
 * pictures of the app, not the app — so their controls are `View`s that merely
 * look like the real `PrimaryButton`. A control that invites a click and then
 * silently does nothing is worse than a static illustration of one.
 */
function MockButton({ label }: { label: string }) {
  const styles = useStyles();
  const t = useTokens();
  return (
    <View style={styles.mockButton}>
      <LinearGradient
        colors={[t.gradient[0], t.gradient[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.mockButtonFill}
      >
        <Text style={styles.mockButtonLabel}>{label}</Text>
      </LinearGradient>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* hero — Flow.AI card                                                 */
/* ------------------------------------------------------------------ */

function aiActions(t: ThemeTokens) {
  return [
    {
      icon: "cart-shopping",
      color: t.green,
      title: "Recover abandoned carts",
      value: "+$2,840 potential",
      note: "37 carts abandoned in the last 7 days",
    },
    {
      icon: "instagram",
      color: t.pink,
      title: "Turn Instagram comments into leads",
      value: "126 contacts",
      note: "High-intent comments detected on 8 posts",
    },
    {
      icon: "location-dot",
      color: t.brand,
      title: "Improve AI search visibility",
      value: "8 locations",
      note: "Your business shows up in only 42% of AI results",
    },
  ];
}

/**
 * The rail used literal Unicode dingbats as icons, which render as mojibake
 * next to the FontAwesome glyphs used everywhere else on the page.
 */
const AI_RAIL_ICONS = [
  "wand-magic-sparkles",
  "chart-simple",
  "bullhorn",
  "envelope",
  "cart-shopping",
  "gear",
] as const;

/**
 * One-off settle on the "Ready ✓" pill: it lands a beat after its row, so the
 * card reads as Flow.AI finishing its thinking. Deliberately not a loop.
 *
 * Like every primitive in `motion`, it renders *settled* and is only pushed
 * back in a client layout effect, so the no-JS render shows the finished pill.
 */
function ReadyPill({ label, delay }: { label: string; delay: number }) {
  const styles = useStyles();
  const reduced = useReducedMotion();
  const settle = useSharedValue(1);

  useLayoutEffect(() => {
    if (reduced) return;
    settle.value = 0;
    settle.value = withDelay(delay, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const animated = useAnimatedStyle(() => ({
    opacity: settle.value,
    transform: [{ scale: 0.84 + settle.value * 0.16 }],
  }));

  return (
    <Animated.View style={[styles.ready, animated]}>
      <Text style={styles.readyText}>{label}</Text>
    </Animated.View>
  );
}

function FlowAiCard() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  return (
    <View style={styles.aiCard}>
      {l.isPhone ? null : (
        <View style={styles.aiSidebar}>
          {/* Chrome inside a mock, beside a rail of unlabelled icons — naming it
              would announce "FlowSmartly" in the middle of an illustration. */}
          <Brand compact alt="" />
          {AI_RAIL_ICONS.map((icon, index) => (
            <View key={icon} style={[styles.sideIcon, index === 0 && styles.sideIconActive]}>
              <FontAwesome6
                name={icon as never}
                size={14}
                color={index === 0 ? t.brand : t.textSubtle}
              />
            </View>
          ))}
        </View>
      )}
      <View style={styles.aiContent}>
        <View style={styles.aiTitleRow}>
          <Text style={styles.aiTitle}>
            Flow.AI <Text style={styles.aiTitleLight}>Command Center</Text>
          </Text>
          <Text style={styles.beta}>Beta</Text>
        </View>
        <View style={styles.aiMessageRow}>
          <View style={styles.sparkCircle}>
            <Text style={styles.spark}>✦</Text>
          </View>
          <View style={styles.messageBubble}>
            <Text style={styles.messageText}>I found 5 growth opportunities this week.</Text>
          </View>
        </View>
        <View style={styles.actionList}>
          {/* The rows land with the hero, just behind the copy. `Reveal` *is*
              the row, so the row's own flex/border styling is untouched. */}
          {aiActions(t).map((action, index) => (
            <Reveal
              key={action.title}
              mode="enter"
              delay={340 + index * 50}
              distance={12}
              style={styles.actionRow}
            >
              <View style={[styles.actionRealIcon, { backgroundColor: action.color }]}>
                <FontAwesome6 name={action.icon as never} size={14} color={t.textOnBrand} />
              </View>
              <View style={styles.actionCopy}>
                <Text numberOfLines={2} style={styles.actionTitle}>
                  {action.title} <Text style={styles.actionValue}>— {action.value}</Text>
                </Text>
                {/* two lines: at laptop widths the card is narrower than the
                    note, and a clipped number is worse than a taller row */}
                <Text numberOfLines={2} style={styles.actionNote}>
                  {action.note}
                </Text>
              </View>
              {l.isPhone ? null : <ReadyPill label="Ready ✓" delay={520 + index * 50} />}
            </Reveal>
          ))}
        </View>
        <View style={styles.aiFooter}>
          {/* mockup chrome — see MockButton */}
          <MockButton label="Review actions" />
          <View style={styles.approval}>
            <View style={styles.approvalFaces}>
              <Image
                source={require("../../assets/images/v5/customer-sarah-johnson.png")}
                style={styles.approvalFace}
                contentFit="cover"
              />
              <Image
                source={require("../../assets/images/v5/customer-sarah-johnson.png")}
                style={[styles.approvalFace, styles.approvalFaceOverlap]}
                contentFit="cover"
              />
            </View>
            <Text numberOfLines={1} style={styles.approvalText}>
              Human approval enabled ✓
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* hero — channel map                                                  */
/* ------------------------------------------------------------------ */

const channels = [
  { brand: "instagram", label: "Instagram", color: "#f20b6a" },
  { brand: "facebook-f", label: "Facebook", color: "#1877f2" },
  { brand: "tiktok", label: "TikTok", color: "#111111" },
  { brand: "whatsapp", label: "WhatsApp", color: "#16b857" },
  { brand: "linkedin-in", label: "LinkedIn", color: "#0a66c2" },
  { brand: "youtube", label: "YouTube", color: "#ff0000" },
  { brand: "google", label: "Google", color: "#4285f4" },
  { brand: "wordpress", label: "WordPress", color: "#21759b" },
];

function BrandTile({
  name,
  label,
  color,
  nodeProps,
  cluster = false,
}: {
  name: string;
  label: string;
  color: string;
  nodeProps?: { ref: (node: unknown) => void; onLayout: () => void };
  cluster?: boolean;
}) {
  const styles = useStyles();
  const t = useTokens();
  return (
    // Icon and label share one card, and the card is the measured node —
    // otherwise a wire stops at the icon and runs through the label below it.
    <View {...(nodeProps as object)} style={[styles.brandTile, cluster ? styles.brandTileCluster : null]}>
      <FontAwesome6 name={name as never} size={22} color={brandColor(color, t)} />
      <Text numberOfLines={1} style={styles.channelLabel}>
        {label}
      </Text>
    </View>
  );
}

/**
 * The hub and every tile are measured, so the dotted wires actually land on the
 * icons instead of the fixed-width dashed stubs the map used to draw.
 */
function ChannelWeb() {
  const styles = useStyles();
  const t = useTokens();
  const field = useConnectorField();
  // Six, not eight: with four cards per column the hub's neighbours sit flush
  // against it and their wires have no visible run at all.
  const shown = useMemo(() => channels.slice(0, 6), []);
  const links = useMemo<Link[]>(() => shown.map((item) => ["hub", item.label] as const), [shown]);

  // The hub sits between two columns rather than beside a block of eight, so a
  // wire only ever travels outward — nothing has to cross another tile.
  return (
    <ConnectorSurface field={field} style={styles.channelMap}>
      <Connectors
        field={field}
        links={links}
        color={t.brand}
        circular={["hub"]}
        strokeWidth={1.6}
        dash="0.5 5"
        flow
      />
      <View style={styles.channelColumn}>
        {shown.slice(0, 3).map((item) => (
          <BrandTile
            key={item.label}
            name={item.brand}
            label={item.label}
            color={item.color}
            nodeProps={field.node(item.label)}
          />
        ))}
      </View>
      <View {...field.node("hub")} style={styles.channelHub}>
        <Brand compact alt="FlowSmartly, at the centre of every connected channel" />
      </View>
      <View style={styles.channelColumn}>
        {shown.slice(3).map((item) => (
          <BrandTile
            key={item.label}
            name={item.brand}
            label={item.label}
            color={item.color}
            nodeProps={field.node(item.label)}
          />
        ))}
      </View>
    </ConnectorSurface>
  );
}

/** Phone: a centred cluster reads far better than eight crossing wires. */
function ChannelCluster() {
  const styles = useStyles();
  return (
    <View style={styles.channelCluster}>
      <View style={styles.channelHub}>
        <Brand compact alt="FlowSmartly, at the centre of every connected channel" />
      </View>
      <View style={styles.channelClusterGrid}>
        {channels.map((item) => (
          <BrandTile key={item.label} name={item.brand} label={item.label} color={item.color} cluster />
        ))}
      </View>
    </View>
  );
}

/**
 * The map is a picture of the integrations surface, so it gets that surface's
 * chrome: a titled header and a sync footer. Bare tiles left a 158px void
 * beside the Flow.AI card next to it, and a panel with no header read as a
 * loose cluster rather than a screen. Everything here is illustration — `View`
 * and `Text` only, never a control.
 */
function ChannelMap() {
  const styles = useStyles();
  const l = useLayout();
  return (
    <View style={styles.channelPanel}>
      <View style={styles.channelPanelHead}>
        <Text numberOfLines={1} style={styles.channelPanelTitle}>
          Connected channels
        </Text>
        <Text style={styles.channelPanelPill}>Live</Text>
      </View>
      {l.isPhone ? <ChannelCluster /> : <ChannelWeb />}
      <View style={styles.channelPanelFoot}>
        <View style={styles.channelPanelDot} />
        <Text numberOfLines={1} style={styles.channelPanelFootText}>
          All channels connected • synced 2 min ago
        </Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* hero                                                                */
/* ------------------------------------------------------------------ */

function Hero() {
  const styles = useStyles();
  const l = useLayout();
  const router = useRouter();
  return (
    <View style={styles.hero}>
      <View style={styles.heroTop}>
        <View style={styles.heroCopy}>
          {/* Above the fold, so this runs on mount rather than on scroll.
              Eyebrow → headline → body → CTAs → proof, 75ms apart. */}
          <Stagger mode="enter" step={75} distance={16}>
            {[
              <SectionLabel key="eyebrow">THE AI GROWTH OPERATING SYSTEM</SectionLabel>,
              // The one h1 on the site root. react-native-web renders every
              // Text as a div, so without this the page ships no heading at all.
              <Heading key="title" level={1} style={styles.heroTitle}>
                Turn every customer signal into your next growth action.
              </Heading>,
              <Text key="body" style={styles.heroBody}>
                Create, connect, sell, and grow with one intelligent workspace across social, email, SMS, ads,
                commerce, local discovery, and analytics.
              </Text>,
              <View key="cta" style={styles.heroActions}>
                <ButtonRow>
                  {/* full-width on phone so every CTA down the page shares one edge */}
                  <PrimaryButton
                    label="Start growing free"
                    size="lg"
                    full={l.isPhone}
                    trackId="home.hero.start-free"
                    onPress={() => Linking.openURL(EXTERNAL.signup)}
                  />
                  {/* No demo video exists, so this books a real one rather than
                      opening a player that has nothing to play. */}
                  <SecondaryButton
                    label="See Flow.AI in action"
                    size="lg"
                    icon="play"
                    full={l.isPhone}
                    trackId="home.hero.see-in-action"
                    onPress={() => router.push(contactHref("demo") as never)}
                  />
                </ButtonRow>
              </View>,
              <Text key="proof" style={styles.proof}>
                Human-approved automation • Built for small businesses
              </Text>,
            ]}
          </Stagger>
        </View>
        {/* One reveal for the whole visual column — the connector overlay
            measures the hub and the tiles against each other, so nothing may
            transform *between* the surface and its nodes. A shared translate on
            the ancestor moves every node by the same amount, which the wires
            never see; a scale would distort them, so there is none here. */}
        <Reveal mode="enter" delay={300} distance={18} style={styles.heroVisual}>
          <FlowAiCard />
          <ChannelMap />
        </Reveal>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* growth command center                                               */
/* ------------------------------------------------------------------ */

const SPARK_BARS = [5, 11, 8, 18, 12, 25, 16, 22, 31];

/**
 * One bar of a sparkline. It scales up from its baseline: `scaleY` alone pins
 * the bar to its centre, so the matching half-height nudge downward keeps the
 * bottom edge where the design put it without depending on `transformOrigin`.
 * Each bar reads slightly behind the one before it, so the row sweeps.
 */
function SparkBar({
  height,
  color,
  index,
  progress,
}: {
  height: number;
  color: string;
  index: number;
  progress: SharedValue<number>;
}) {
  const styles = useStyles();
  const animated = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, (progress.value - index * 0.04) / 0.68));
    return { transform: [{ translateY: (height * (1 - p)) / 2 }, { scaleY: p }] };
  }, [height, index]);
  return <Animated.View style={[styles.sparkBar, { height, backgroundColor: color }, animated]} />;
}

function Sparkline({ color }: { color?: string }) {
  const styles = useStyles();
  const t = useTokens();
  const { progress, ref } = useGrowIn({ duration: 600 });
  return (
    <View ref={ref as never} style={styles.sparkline}>
      {SPARK_BARS.map((height, i) => (
        <SparkBar key={i} height={height} color={color ?? t.brand} index={i} progress={progress} />
      ))}
    </View>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.dataRow}>
      <Text numberOfLines={1} style={styles.dataLabel}>
        {label}
      </Text>
      <Text numberOfLines={1} style={styles.dataValue}>
        {value}
      </Text>
    </View>
  );
}

function Panel({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.dashboardPanel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelNumber}>{number}</Text>
        <Text numberOfLines={1} style={styles.panelTitle}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

function MetricCards() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();

  // Formatting is unchanged — the count-up only supplies the number, so the
  // separators, the decimal and the % suffix all still come from here, and the
  // no-JS render prints the final figure.
  const revenue = useCountUp(48290);
  const leads = useCountUp(1284);
  const deliverability = useCountUp(98.7, { decimals: 1 });
  const visibility = useCountUp(74);

  const metrics = [
    {
      label: "Revenue influenced",
      value: `$${revenue.value.toLocaleString("en-US")}`,
      delta: "↑ 18.4%",
      color: t.brand,
    },
    { label: "Qualified leads", value: leads.value.toLocaleString("en-US"), delta: "↑ 22%", color: t.violet },
    { label: "Deliverability", value: `${deliverability.value.toFixed(1)}%`, delta: "Excellent", color: t.brand },
    { label: "AI visibility", value: `${visibility.value}%`, delta: "↑ 11%", color: t.brand },
  ];

  // All four counters hang off the *row container*, not off their own cards:
  // on phone the cards stack, and four separate thresholds would run the
  // figures one at a time as the visitor scrolled past each one.
  const counters = [revenue, leads, deliverability, visibility];
  const countersRef = useRef(counters);
  countersRef.current = counters;
  const attachCounters = useCallback((node: View | null) => {
    countersRef.current.forEach((counter) => {
      (counter.ref as { current: unknown }).current = node;
    });
  }, []);

  const columns = l.isPhone ? 1 : l.isCompact ? 2 : 4;
  return (
    <View ref={attachCounters} style={styles.gridStack}>
      {chunk(metrics, columns).map((row, index) => (
        <View key={index} style={styles.gridRow}>
          {row.map((item) => (
            <View key={item.label} style={styles.metricCard}>
              <View style={styles.metricCopy}>
                <Text numberOfLines={1} style={styles.metricLabel}>
                  {item.label}
                </Text>
                <Text numberOfLines={1} style={styles.metricValue}>
                  {item.value}
                </Text>
                <Text numberOfLines={1} style={styles.metricDelta}>
                  {item.delta}
                </Text>
              </View>
              <Sparkline color={item.color} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Every dashboard panel is numbered by the Dashboard, never by itself. */
type PanelProps = { number: string };

function NextBestActions({ number }: PanelProps) {
  const styles = useStyles();
  const t = useTokens();
  const rows: [string, string, string, string][] = [
    ["comment-dots", t.green, "Send SMS to cart abandoners", "+$2,840"],
    ["instagram", t.pink, "Turn IG comments into leads", "+$1,920"],
    ["envelope", t.brand, "Launch win-back email sequence", "+$1,250"],
    ["chart-simple", t.violet, "Boost top-performing ad set", "+$1,140"],
    ["bag-shopping", t.orange, "Recommend products in FlowShop", "+$980"],
  ];
  return (
    <Panel number={number} title="Next best actions">
      {rows.map(([icon, color, label, amount], index) => (
        <Reveal key={label} delay={index * 70} distance={10} style={styles.miniAction}>
          <View style={[styles.miniIcon, { backgroundColor: color }]}>
            <FontAwesome6 name={icon as never} size={10} color={t.textOnBrand} />
          </View>
          {/* two lines: at three columns these labels are wider than the cell */}
          <Text numberOfLines={2} style={styles.miniActionLabel}>
            {label}
          </Text>
          <Text style={styles.miniAmount}>{amount}</Text>
          {/* mockup chrome — a picture of the dashboard, not a control */}
          <View style={styles.reviewButton}>
            <Text style={styles.reviewText}>Review</Text>
          </View>
        </Reveal>
      ))}
    </Panel>
  );
}

function JourneyPanel({ number }: PanelProps) {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const steps: [string, string, string][] = [
    ["instagram", t.pink, "Instagram\nComment"],
    ["comment-dots", t.green, "DM\nConsent"],
    ["envelope", t.violet, "Email/SMS\nJourney"],
    ["bag-shopping", t.orange, "Purchase\nCompleted"],
  ];
  return (
    <Panel number={number} title="Customer journey">
      <View style={styles.journeySteps}>
        {/* Step, then the arrow that leaves it, so the journey reads left to
            right. `Reveal` carries each element's own layout style — the steps
            are flex-sized siblings and must stay direct children of the row. */}
        {steps.map(([icon, color, label], index) => (
          <Fragment key={label}>
            <Reveal delay={index * 80} distance={10} style={styles.journeyItem}>
              <View style={[styles.journeyIcon, { backgroundColor: color }]}>
                <FontAwesome6 name={icon as never} size={15} color={t.textOnBrand} />
              </View>
              <Text style={styles.journeyLabel}>{label}</Text>
            </Reveal>
            {index < steps.length - 1 ? (
              <Reveal delay={index * 80 + 40} distance={0} style={styles.journeyArrow}>
                <ArrowLink color={hexToRgba(t.textSubtle, 0.9)} width={l.isCompact ? 18 : 26} />
              </Reveal>
            ) : null}
          </Fragment>
        ))}
      </View>
      <View style={styles.journeyStats}>
        {/* two lines + a reserved two-line box: three stats never fit on one
            line inside a three-column panel, and the values must stay aligned */}
        <View style={styles.journeyStat}>
          <Text numberOfLines={2} style={styles.statLabel}>
            Conversion rate
          </Text>
          <Text style={styles.statValueBrand}>18.7%</Text>
        </View>
        <View style={styles.journeyStat}>
          <Text numberOfLines={2} style={styles.statLabel}>
            Avg. time to convert
          </Text>
          <Text style={styles.statValue}>2.6 days</Text>
        </View>
        <View style={styles.journeyStat}>
          <Text numberOfLines={2} style={styles.statLabel}>
            Revenue / journey
          </Text>
          <Text style={styles.statValue}>$86.40</Text>
        </View>
      </View>
    </Panel>
  );
}

function CustomerPanel({ number }: PanelProps) {
  const styles = useStyles();
  return (
    <Panel number={number} title="Unified customer profile">
      <View style={styles.customerRow}>
        <Image
          source={require("../../assets/images/v5/customer-sarah-johnson.png")}
          style={styles.customerPhoto}
          contentFit="cover"
        />
        <View style={styles.customerIdentity}>
          <Text numberOfLines={1} style={styles.customerName}>
            Sarah Johnson
          </Text>
          <Text numberOfLines={1} style={styles.customerSub}>
            sarah.j@example.com
          </Text>
          <Text numberOfLines={1} style={styles.customerSub}>
            Customer since Apr 2024 • 8 orders
          </Text>
        </View>
      </View>
      {(
        [
          ["Social engagement", "High"],
          ["Email opened", "3h ago"],
          ["SMS clicked", "1d ago"],
          ["Purchase likelihood", "High (78%)"],
        ] as [string, string][]
      ).map(([label, value]) => (
        <DataRow key={label} label={label} value={value} />
      ))}
      <View style={styles.recommendation}>
        <Text style={styles.recommendLabel}>Recommended next action</Text>
        <Text numberOfLines={1} style={styles.recommendValue}>
          Send personalized offer via SMS ›
        </Text>
      </View>
    </Panel>
  );
}

function TrustPanel({ number }: PanelProps) {
  const styles = useStyles();
  const t = useTokens();
  const rows: [string, string][] = [
    ["Email deliverability", "99.1%"],
    ["SMS deliverability", "98.3%"],
    ["Domain authenticated", "Verified"],
    ["Consent status", "Verified"],
    ["AI disclosure ready", "Yes"],
    ["Content originality", "High"],
  ];
  return (
    <Panel number={number} title="Deliverability & trust">
      {rows.map(([label, value], i) => (
        <View key={label} style={styles.trustRow}>
          <Text style={[styles.trustCheck, { color: i % 2 ? t.green : t.brand }]}>✓</Text>
          <View style={styles.trustCopy}>
            <DataRow label={label} value={value} />
          </View>
        </View>
      ))}
    </Panel>
  );
}

function ReadinessPanel({ number }: PanelProps) {
  const styles = useStyles();
  const t = useTokens();
  const score = useCountUp(86, { duration: 900 });
  const catalog = useGrowIn({ duration: 600, delay: 120 });
  // The fill keeps its 92% width in the stylesheet, so the no-JS render is the
  // finished bar; the animation only rides the last stretch of it in.
  const catalogFill = useAnimatedStyle(() => ({
    width: `${92 * catalog.progress.value}%` as DimensionValue,
  }));
  const shopBrands = [
    { name: "google", color: "#4285f4" },
    { name: "amazon", color: "#111111" },
    { name: "microsoft", color: "#00a4ef" },
    { name: "instagram", color: "#e1306c" },
  ];
  return (
    <Panel number={number} title="FlowShop AI readiness">
      <View style={styles.readinessBody}>
        <View ref={score.ref as never} style={styles.scoreRing}>
          <Text style={styles.score}>{score.value}</Text>
          <Text style={styles.scoreSmall}>/100</Text>
        </View>
        <View style={styles.catalog}>
          <Text numberOfLines={1} style={styles.catalogLabel}>
            Catalog completeness
          </Text>
          <Text style={styles.catalogValue}>92%</Text>
          <View ref={catalog.ref as never} style={styles.progress}>
            <Animated.View style={[styles.progressFill, catalogFill]} />
          </View>
        </View>
      </View>
      <Text style={styles.shopLabel}>AI-shopping channels</Text>
      <View style={styles.shopBrandRow}>
        {shopBrands.map((brand) => (
          <FontAwesome6
            key={brand.name}
            name={brand.name as never}
            size={18}
            color={brandColor(brand.color, t)}
          />
        ))}
      </View>
    </Panel>
  );
}

function VisibilityPanel({ number }: PanelProps) {
  const styles = useStyles();
  return (
    <Panel number={number} title="ListSmartly AI visibility">
      {(
        [
          ["Google", "76%"],
          ["ChatGPT", "68%"],
          ["Bing", "61%"],
          ["Local discovery", "72%"],
        ] as [string, string][]
      ).map(([label, value]) => (
        <DataRow key={label} label={label} value={value} />
      ))}
      <Sparkline />
    </Panel>
  );
}

function ApprovalQueuePanel({ number }: PanelProps) {
  const styles = useStyles();
  return (
    <Panel number={number} title="Approval queue">
      <Text style={styles.queueBadge}>4 actions awaiting approval</Text>
      {["SMS to cart abandoners", "Email win-back sequence", "Boost ad set: Spring Collection"].map((row) => (
        <View key={row} style={styles.queueRow}>
          <Text numberOfLines={2} style={styles.queueLabel}>
            {row}
          </Text>
          {/* mockup chrome — the queue is an illustration, not a live queue */}
          <View style={styles.queueApprove}>
            <Text style={styles.queueApproveText}>Approve</Text>
          </View>
          <View style={styles.queueEdit}>
            <Text style={styles.queueEditText}>Edit</Text>
          </View>
        </View>
      ))}
    </Panel>
  );
}

type PanelDef = { key: string; Component: (props: PanelProps) => React.ReactElement };

const PHONE_PANELS: PanelDef[] = [
  { key: "actions", Component: NextBestActions },
  { key: "journey", Component: JourneyPanel },
  { key: "queue", Component: ApprovalQueuePanel },
];

const FULL_PANELS: PanelDef[] = [
  { key: "actions", Component: NextBestActions },
  { key: "journey", Component: JourneyPanel },
  { key: "customer", Component: CustomerPanel },
  { key: "trust", Component: TrustPanel },
  { key: "readiness", Component: ReadinessPanel },
  { key: "visibility", Component: VisibilityPanel },
  { key: "queue", Component: ApprovalQueuePanel },
];

function Dashboard() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();

  // On the phone the dashboard is simplified rather than shrunk: the decorative
  // proof panels are dropped so what remains stays readable. The badge comes
  // from the position in *this* list, so the phone reads 1-2-3, not 1-2-7.
  const panels = l.isPhone ? PHONE_PANELS : FULL_PANELS;
  // Three columns only once the page has un-stacked with room to spare: at 1024
  // a third column is ~300px and clips labels that render in full at 768.
  const columns = l.isPhone ? 1 : l.isStacked ? 2 : 3;

  // One reveal for the whole dashboard; the detail inside (counters, bars,
  // action rows) carries its own motion rather than each card fading in.
  return (
    <Reveal distance={22} style={styles.dashboardOuter}>
      <View style={styles.dashboardTitleRow}>
        <Heading level={2} style={styles.dashboardTitle}>
          Growth Command Center
        </Heading>
        <Text style={styles.dashboardFilter}>Last 30 days ⌄</Text>
      </View>
      <MetricCards />
      <View style={styles.gridStack}>
        {chunk(
          panels.map((panel, index) => ({ ...panel, number: String(index + 1) })),
          columns,
        ).map((row, index) => (
          <View key={index} style={styles.gridRow}>
            {row.map(({ key, Component, number }) => (
              <View key={key} style={styles.gridCell}>
                <Component number={number} />
              </View>
            ))}
          </View>
        ))}
      </View>
      <View style={styles.integrations}>
        <Text style={styles.integrationsTitle}>Integrations</Text>
        <View style={styles.dashboardBrandRow}>
          {channels.slice(0, 7).map((item) => (
            <FontAwesome6
              key={item.label}
              name={item.brand as never}
              size={17}
              color={brandColor(item.color, t)}
            />
          ))}
        </View>
        <Text style={styles.integrationsNote}>All your channels. One intelligent system.</Text>
      </View>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* FlowShop                                                            */
/* ------------------------------------------------------------------ */

const products = [
  {
    image: require("../../assets/images/v5/product-commuter-backpack.png"),
    name: "Urban Commuter Backpack",
    price: "$99.00",
  },
  {
    image: require("../../assets/images/v5/product-canvas-tote.png"),
    name: "Essential Tote Bag",
    price: "$69.00",
  },
  {
    image: require("../../assets/images/v5/product-black-sneakers.png"),
    name: "All-Day Sneakers",
    price: "$89.00",
  },
  {
    image: require("../../assets/images/v5/product-navy-bottle.png"),
    name: "Insulated Water Bottle",
    price: "$34.00",
  },
];

function FlowShopSection() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const router = useRouter();
  const shell = useSectionShell();
  return (
    <Reveal style={[shell, styles.featureSection]}>
      <View style={styles.featureCopy}>
        <SectionLabel>FLOWSHOP</SectionLabel>
        <Heading level={2} style={styles.featureTitle}>
          Build once. Sell everywhere customers and AI agents shop.
        </Heading>
        <Text style={styles.featureBody}>
          Launch a polished storefront, keep product data AI-ready, and turn every campaign into a direct path to
          purchase.
        </Text>
        <PrimaryButton
          label="Explore FlowShop"
          size="lg"
          icon="arrow-right"
          iconRight
          full={l.isPhone}
          trackId="home.flowshop.explore"
          onPress={() => router.push(ROUTES.flowshop as never)}
        />
      </View>
      <View style={styles.storePanel}>
        <View style={styles.readinessBar}>
          <View style={styles.readinessCell}>
            <Text style={styles.storePanelTitle}>AI Commerce Readiness</Text>
            <Text style={styles.readinessScore}>
              86<Text style={styles.readinessSmall}>/100</Text>
            </Text>
          </View>
          <View style={styles.readinessCell}>
            <Text style={styles.storeMetricLabel}>Catalog completeness</Text>
            <Text style={styles.storeMetricValue}>92%</Text>
            <View style={styles.storeProgress}>
              <View style={styles.storeProgressFill} />
            </View>
          </View>
          <View style={styles.readinessCell}>
            <Text style={styles.storeMetricLabel}>Products optimized</Text>
            <Text style={styles.storeMetricValue}>148</Text>
          </View>
          <View style={styles.readinessCell}>
            <Text style={styles.storeMetricLabel}>Policy compliance</Text>
            <Text style={styles.passed}>● Passed</Text>
          </View>
        </View>
        <View style={styles.storefront}>
          <View style={styles.storefrontHeader}>
            <View style={styles.storefrontBrand}>
              <FontAwesome6 name="bars" size={15} color={t.textMuted} />
              <Text style={styles.storePanelTitle}>FlowShop</Text>
            </View>
            <View style={styles.storefrontTools}>
              {["magnifying-glass", "user", "cart-shopping"].map((icon) => (
                <FontAwesome6 key={icon} name={icon as never} size={15} color={t.textMuted} />
              ))}
            </View>
          </View>
          <View style={styles.productGrid}>
            {products.map((product) => (
              <View key={product.name} style={styles.productCard}>
                <Image source={product.image} style={styles.productImage} contentFit="contain" transition={180} />
                <Text numberOfLines={2} style={styles.productName}>
                  {product.name}
                </Text>
                <Text style={styles.productPrice}>{product.price}</Text>
                <Text style={styles.productStars}>
                  ★★★★★ <Text style={styles.reviewCount}>(128)</Text>
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* unified customer intelligence                                       */
/* ------------------------------------------------------------------ */

function CustomerIntelligence() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const router = useRouter();
  const shell = useSectionShell();
  const signals: [string, string, string, string][] = [
    ["instagram", t.pink, "Instagram comment", "Love this collection!"],
    ["envelope", t.brand, "Email opened", "Spring Collection Lookbook"],
    ["comment-dots", t.green, "SMS clicked", "flowsmartly.link/spring"],
  ];
  // Real icons: these rows used to lead with Unicode dingbats, which read as
  // mojibake beside the FontAwesome glyphs in the signal cards next to them.
  const profileMeta: [string, string][] = [
    ["envelope", "sarah.johnson@email.com"],
    // No published phone line exists, and a 555 number on a contact block is a
    // dead end dressed up as a channel. The contact route is the real one.
    ["comment-dots", "Message us and we answer the same day"],
    ["location-dot", "San Francisco, CA"],
    ["calendar", "Customer since Apr 2024"],
    ["bag-shopping", "Total orders 8 • $1,286 spent"],
  ];
  return (
    <Reveal style={[shell, styles.featureSection]}>
      <View style={styles.featureCopy}>
        <SectionLabel>UNIFIED CUSTOMER INTELLIGENCE</SectionLabel>
        <Heading level={2} style={styles.featureTitle}>
          Every interaction makes the next action smarter.
        </Heading>
        <Text style={styles.featureBody}>
          Flow.AI learns from every signal to recommend the right next step for every customer.
        </Text>
        <PrimaryButton
          label="View customer journeys"
          size="lg"
          full={l.isPhone}
          trackId="home.intelligence.customer-journeys"
          onPress={() => router.push(ROUTES.analytics as never)}
        />
      </View>
      <View style={styles.intelligenceVisual}>
        <View style={styles.signalColumn}>
          {signals.map(([icon, color, title, note]) => (
            <View key={title} style={styles.signalCard}>
              <FontAwesome6 name={icon as never} size={20} color={color} />
              <View style={styles.signalCopy}>
                <Text numberOfLines={1} style={styles.signalTitle}>
                  {title}
                </Text>
                <Text numberOfLines={1} style={styles.signalNote}>
                  {note}
                </Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.profileCard}>
          <Image
            source={require("../../assets/images/v5/customer-sarah-johnson.png")}
            style={styles.profilePhoto}
            contentFit="cover"
          />
          <Text style={styles.profileName}>Sarah Johnson</Text>
          <View style={styles.profileTags}>
            <Text style={styles.profileTag}>Loyal customer</Text>
            <Text style={styles.profileTag}>High value</Text>
          </View>
          {profileMeta.map(([icon, line]) => (
            <View key={line} style={styles.profileMetaRow}>
              <FontAwesome6
                name={icon as never}
                size={13}
                color={t.textSubtle}
                style={styles.profileMetaIcon}
              />
              <Text numberOfLines={1} style={styles.profileMetaText}>
                {line}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.recommendationCard}>
          <Text style={styles.recommendationBrand}>
            ✦ Flow.AI <Text style={styles.aiTitleLight}>recommendation</Text>
          </Text>
          <Text style={styles.recommendationTitle}>Send a personalized replenishment offer</Text>
          <View style={styles.recommendationMetrics}>
            <View style={styles.recommendationMetric}>
              <Text style={styles.storeMetricLabel}>Expected revenue</Text>
              <Text style={styles.revenueBrand}>$1,420</Text>
            </View>
            <View style={styles.recommendationMetric}>
              <Text style={styles.storeMetricLabel}>Confidence</Text>
              <Text style={styles.confidence}>High</Text>
            </View>
          </View>
          {["Recent order", "SMS engagement", "Repeat buyer"].map((reason) => (
            <View key={reason} style={styles.reason}>
              <Text style={styles.reasonText}>✓ {reason}</Text>
            </View>
          ))}
          {/* mockup chrome — this card illustrates Flow.AI's output */}
          <MockButton label="Review recommendation" />
        </View>
      </View>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function HomeScreen() {
  // The header, the max-width column and the footer come from the shared
  // PageShell — the home page must not build its own chrome, or the two drift.
  return (
    <PageShell
      title="The AI Growth Operating System"
      description="Turn every customer signal into your next growth action — one workspace for social, email, SMS, ads, commerce, local discovery and analytics."
      footer="full"
      // The site root, so it carries the Organization and WebSite records as
      // well as its own breadcrumb.
      jsonLd={[
        organizationJsonLd(),
        webSiteJsonLd(),
        breadcrumbJsonLd([{ name: "Home", path: ROUTES.home }]),
      ]}>
      <Hero />
      <Dashboard />
      <FlowShopSection />
      <CustomerIntelligence />
      <CallAgentSection />
      <ListSmartlySection />
      <ConnectedChannelsSection />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* stylesheet                                                          */
/* ------------------------------------------------------------------ */

function createStyles(t: ThemeTokens, l: Layout, ty: TypeScale) {
  const stacked = l.isStacked;
  /**
   * The hero visual has stacked below the copy but still has a full row to
   * itself — so it must *use* it. Sized for the side-by-side layout it kept a
   * 460px cap here and left 270px of the row empty at 1100.
   */
  const heroFill = stacked && !l.isPhone;
  const card = elevation(t, 1) as ViewStyle;
  const panelPad = l.isPhone ? 12 : 14;
  const gridGap = l.isPhone ? 10 : 12;

  /** a flex child that carries text and must be allowed to shrink */
  const fluid: ViewStyle = { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 };
  /** a flex child that fills its line once the layout has stacked */
  const stackedItem: ViewStyle = { flexGrow: 0, flexShrink: 0, flexBasis: "auto", width: "100%", minWidth: 0 };

  const chip = (bg: string, color: string): TextStyle => ({
    ...ty.micro,
    backgroundColor: bg,
    color,
    fontWeight: "700",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: "hidden",
  });

  return StyleSheet.create({
    /* ---------- brand mark ---------- */
    brandLogo: { width: l.isPhone ? 148 : 176, height: 40 },
    brandLogoCompact: { width: 30, height: 30 },

    /* ---------- hero ---------- */
    hero: {
      paddingHorizontal: l.gutter,
      paddingTop: l.isPhone ? 20 : 28,
      paddingBottom: l.isPhone ? 24 : 34,
    },
    heroTop: stacked
      ? { flexDirection: "column", alignItems: "stretch", gap: 28 }
      : { flexDirection: "row", alignItems: "center", gap: 34 },
    heroCopy: stacked ? { ...stackedItem, gap: 14 } : { ...fluid, flexGrow: 0.95, gap: 16 },
    heroTitle: { ...ty.display, color: t.text, marginTop: 4, maxWidth: 640 },
    heroBody: { ...ty.body, color: t.textMuted, maxWidth: 620 },
    heroActions: { marginTop: 4 },
    proof: { ...ty.caption, color: t.textSubtle },
    // The proof card and the channel map stay side by side at every width down
    // to tablet; only phone breaks them onto separate rows. Below desktop the
    // visual column takes a larger share so both still fit without the card
    // ellipsizing its action rows.
    heroVisual: stacked
      ? {
          ...stackedItem,
          flexDirection: l.isPhone ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap: l.isTablet ? 14 : 18,
        }
      : {
          ...fluid,
          flexGrow: l.isDesktop ? 1.45 : 1.6,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
        },

    /* ---------- Flow.AI card ---------- */
    aiCard: {
      flexGrow: 1,
      flexShrink: 1,
      // Stacked and wide, the card splits the row with the channel panel from a
      // zero basis, so the pair always fills it. Side by side with the copy it
      // sizes to content and holds the cap the column was designed around.
      flexBasis: heroFill ? 0 : "auto",
      width: heroFill ? undefined : "100%",
      minWidth: heroFill ? 320 : 0,
      maxWidth: heroFill ? undefined : 460,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceRaised,
      flexDirection: "row",
      overflow: "hidden",
      ...card,
    },
    aiSidebar: {
      width: 48,
      flexShrink: 0,
      backgroundColor: t.surfaceMuted,
      borderRightWidth: 1,
      borderRightColor: t.divider,
      alignItems: "center",
      paddingTop: 8,
      gap: 5,
    },
    sideIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    sideIconActive: { backgroundColor: t.brandSoft },
    aiContent: { ...fluid, padding: 14, gap: 9 },
    aiTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    aiTitle: { ...ty.caption, color: t.text, fontWeight: "800", flexShrink: 1, minWidth: 0 },
    aiTitleLight: { fontWeight: "500" },
    beta: chip(t.chipBg, t.chipText),
    aiMessageRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    sparkCircle: {
      width: 34,
      height: 34,
      flexShrink: 0,
      borderRadius: 17,
      backgroundColor: t.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    spark: { color: t.textOnBrand, fontSize: 18 },
    messageBubble: {
      ...fluid,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      paddingVertical: 10,
      paddingHorizontal: 13,
      backgroundColor: t.surfaceMuted,
    },
    messageText: { ...ty.caption, color: t.text },
    actionList: { gap: 7 },
    actionRow: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      padding: 8,
      gap: 9,
    },
    actionCopy: { ...fluid },
    actionTitle: { ...ty.micro, color: t.text, fontWeight: "700" },
    actionValue: { fontWeight: "500", color: t.textMuted },
    actionNote: { ...ty.micro, color: t.textSubtle, marginTop: 2 },
    actionRealIcon: {
      width: 30,
      height: 30,
      flexShrink: 0,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
    },
    ready: {
      flexShrink: 0,
      backgroundColor: t.successBg,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 8,
    },
    readyText: { ...ty.micro, color: t.successText },
    // Mirrors PrimaryButton at size "sm" — the mock has to look identical to
    // the real control, it just isn't one.
    mockButton: {
      minHeight: 40,
      borderRadius: 9,
      overflow: "hidden",
      alignSelf: "flex-start",
      ...card,
    },
    mockButtonFill: {
      minHeight: 40,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    mockButtonLabel: { color: t.textOnBrand, fontSize: 13, fontWeight: "700" },
    aiFooter: {
      marginTop: 2,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      rowGap: 8,
      gap: 10,
    },
    approval: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1, minWidth: 0 },
    approvalFaces: { width: 32, height: 22, flexDirection: "row", alignItems: "center", flexShrink: 0 },
    approvalFace: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: t.surfaceRaised,
      backgroundColor: t.surfaceMuted,
    },
    approvalFaceOverlap: { marginLeft: -9 },
    approvalText: { ...ty.micro, color: t.textSubtle, flexShrink: 1, minWidth: 0 },

    /* ---------- channel map ---------- */
    // The frame the map lives in. It carries the phone width, so the surface
    // inside keeps sizing itself exactly as before.
    channelPanel: {
      flexGrow: heroFill ? 1 : 0,
      flexShrink: heroFill ? 1 : 0,
      flexBasis: heroFill ? 0 : "auto",
      width: l.isPhone ? "100%" : undefined,
      // The panel takes what the map needs and the card absorbs the rest of the
      // row — an uncapped 50/50 split would strand the map in its own middle.
      maxWidth: l.isPhone ? 460 : heroFill ? 470 : undefined,
      minWidth: heroFill ? 264 : undefined,
      alignSelf: "center",
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surface,
      padding: l.isPhone ? 12 : 14,
      gap: 12,
      ...card,
    },
    channelPanelHead: {
      minHeight: 26,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    channelPanelTitle: { ...ty.micro, color: t.text, fontWeight: "800", flexShrink: 1, minWidth: 0 },
    channelPanelPill: chip(t.successBg, t.successText),
    channelPanelFoot: {
      minHeight: 26,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: t.divider,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    channelPanelDot: {
      width: 7,
      height: 7,
      flexShrink: 0,
      borderRadius: 4,
      backgroundColor: t.successText,
    },
    channelPanelFootText: { ...ty.micro, color: t.textSubtle, flexShrink: 1, minWidth: 0 },

    // Holds its size so the proof card beside it absorbs the squeeze instead of
    // the wires collapsing; tightened on tablet, where the pair has least room.
    channelMap: {
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: "auto",
      width: l.isPhone || heroFill ? "100%" : undefined,
      maxWidth: l.isPhone ? 400 : undefined,
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      // When the panel widens to fill the stacked row the hub and its two
      // columns spread into it, which gives every wire a longer visible run —
      // rather than clustering in the middle of an empty card.
      justifyContent: heroFill ? "space-evenly" : "center",
      // Wide enough for each wire to show a run of dots on its way out.
      gap: l.isTablet ? 16 : 26,
    },
    channelHub: {
      width: l.isTablet ? 50 : 58,
      height: l.isTablet ? 50 : 58,
      flexShrink: 0,
      borderRadius: l.isTablet ? 25 : 29,
      borderWidth: 1,
      borderColor: t.borderStrong,
      backgroundColor: t.surfaceRaised,
      alignItems: "center",
      justifyContent: "center",
      ...card,
    },
    channelColumn: { alignItems: "center", gap: 16 },
    brandTile: {
      width: l.isTablet ? 66 : 78,
      paddingVertical: 9,
      paddingHorizontal: 5,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surfaceRaised,
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      ...card,
    },
    brandTileCluster: { width: 74 },
    channelLabel: { ...ty.micro, color: t.textMuted, textAlign: "center" },
    channelCluster: { width: "100%", alignItems: "center", gap: 14, paddingTop: 6 },
    channelClusterGrid: {
      width: "100%",
      maxWidth: 360,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      rowGap: 12,
      columnGap: 10,
    },

    /* ---------- dashboard ---------- */
    dashboardOuter: {
      marginHorizontal: l.gutter,
      marginTop: l.sectionGap,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: l.radius,
      backgroundColor: t.surface,
      padding: l.isPhone ? 12 : 16,
      gap: gridGap,
      ...card,
    },
    dashboardTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
    },
    dashboardTitle: { ...ty.h4, color: t.text, flexShrink: 1, minWidth: 0 },
    dashboardFilter: {
      ...ty.micro,
      color: t.textMuted,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      overflow: "hidden",
      flexShrink: 0,
    },
    gridStack: { gap: gridGap },
    gridRow: { flexDirection: "row", alignItems: "stretch", gap: gridGap },
    gridCell: { ...fluid, alignItems: "stretch" },
    metricCard: {
      ...fluid,
      minHeight: 76,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 14,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    metricCopy: { flexShrink: 1, minWidth: 0 },
    metricLabel: { ...ty.micro, color: t.textMuted },
    metricValue: { ...ty.h3, color: t.text, marginTop: 2 },
    metricDelta: { ...ty.micro, color: t.successText, marginTop: 2 },
    sparkline: { height: 36, flexShrink: 0, flexDirection: "row", alignItems: "flex-end", gap: 2 },
    sparkBar: { width: 7, minHeight: 2, borderRadius: 3 },

    dashboardPanel: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: "auto",
      minWidth: 0,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      padding: panelPad,
      backgroundColor: t.surfaceRaised,
      gap: 6,
    },
    panelHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
    panelNumber: {
      width: 20,
      height: 20,
      lineHeight: 20,
      borderRadius: 6,
      backgroundColor: t.brand,
      color: t.textOnBrand,
      fontSize: 11,
      textAlign: "center",
      fontWeight: "800",
      overflow: "hidden",
      flexShrink: 0,
    },
    panelTitle: { ...ty.caption, color: t.text, fontWeight: "700", flexShrink: 1, minWidth: 0 },

    dataRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      minHeight: 22,
    },
    dataLabel: { ...ty.micro, color: t.textMuted, flexShrink: 1, minWidth: 0 },
    dataValue: { ...ty.micro, color: t.text, fontWeight: "700", textAlign: "right", flexShrink: 0 },

    miniAction: { minHeight: 30, flexDirection: "row", alignItems: "center", gap: 8 },
    miniIcon: {
      width: 20,
      height: 20,
      flexShrink: 0,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
    },
    miniActionLabel: { ...ty.micro, color: t.textMuted, flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    miniAmount: { ...ty.micro, color: t.text, fontWeight: "700", flexShrink: 0 },
    reviewButton: {
      flexShrink: 0,
      borderWidth: 1,
      borderColor: t.brand,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    reviewText: { ...ty.micro, color: t.brand, fontWeight: "700" },

    journeySteps: { flexDirection: "row", alignItems: "flex-start", marginTop: 6 },
    journeyItem: { ...fluid, alignItems: "center" },
    journeyIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    journeyArrow: { flexShrink: 0, paddingTop: 16 },
    journeyLabel: { ...ty.micro, color: t.textMuted, textAlign: "center", marginTop: 6 },
    journeyStats: {
      marginTop: 12,
      borderTopWidth: 1,
      borderTopColor: t.divider,
      paddingTop: 10,
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 8,
    },
    journeyStat: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    // Two-line box so a wrapped label ("Avg. time to convert" in a three-column
    // panel) does not push its value out of line with its neighbours.
    statLabel: { ...ty.micro, color: t.textSubtle, minHeight: 32 },
    statValue: { ...ty.caption, color: t.text, fontWeight: "800", marginTop: 3 },
    statValueBrand: { ...ty.caption, color: t.brand, fontWeight: "800", marginTop: 3 },

    customerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
    customerIdentity: { flexShrink: 1, minWidth: 0 },
    customerPhoto: {
      width: 42,
      height: 42,
      flexShrink: 0,
      borderRadius: 21,
      backgroundColor: t.surfaceMuted,
    },
    customerName: { ...ty.caption, color: t.text, fontWeight: "800" },
    customerSub: { ...ty.micro, color: t.textSubtle, marginTop: 1 },
    recommendation: {
      marginTop: 6,
      backgroundColor: t.surfaceMuted,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 9,
      padding: 8,
    },
    recommendLabel: { ...ty.micro, color: t.textSubtle },
    recommendValue: { ...ty.micro, color: t.brand, fontWeight: "700", marginTop: 2 },

    trustRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    trustCheck: { fontWeight: "900", fontSize: 11, flexShrink: 0 },
    trustCopy: { ...fluid },

    readinessBody: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
    scoreRing: {
      width: 78,
      height: 78,
      flexShrink: 0,
      borderRadius: 39,
      borderWidth: 8,
      borderColor: t.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    score: { ...ty.h3, color: t.text },
    scoreSmall: { ...ty.micro, color: t.textSubtle },
    catalog: { ...fluid },
    catalogLabel: { ...ty.micro, color: t.textMuted },
    catalogValue: { ...ty.h4, color: t.text, marginTop: 2 },
    progress: { height: 6, backgroundColor: t.surfaceInset, borderRadius: 4, marginTop: 8 },
    progressFill: { width: "92%", height: 6, backgroundColor: t.brand, borderRadius: 4 },
    shopLabel: { ...ty.micro, color: t.textMuted, marginTop: 10 },
    shopBrandRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 6 },

    queueBadge: { ...chip(t.warnBg, t.warnText), alignSelf: "flex-start", marginBottom: 4 },
    queueRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 28 },
    queueLabel: { ...ty.micro, color: t.textMuted, flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    queueApprove: {
      flexShrink: 0,
      borderRadius: 6,
      backgroundColor: t.brand,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    queueApproveText: { ...ty.micro, color: t.textOnBrand, fontWeight: "700" },
    queueEdit: {
      flexShrink: 0,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    queueEditText: { ...ty.micro, color: t.textMuted, fontWeight: "700" },

    integrations: {
      minHeight: 48,
      marginTop: 2,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: t.divider,
      flexDirection: l.isPhone ? "column" : "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    integrationsTitle: { ...ty.micro, color: t.text, fontWeight: "700" },
    dashboardBrandRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: l.isPhone ? 16 : 22,
    },
    integrationsNote: { ...ty.micro, color: t.textSubtle, textAlign: l.isPhone ? "center" : "right" },

    /* ---------- feature sections ---------- */
    featureSection: stacked
      ? { flexDirection: "column", alignItems: "stretch", gap: 26 }
      : { flexDirection: "row", alignItems: "center", gap: 40 },
    featureCopy: stacked ? { ...stackedItem, gap: 18 } : { ...fluid, flexGrow: 0.85, gap: 20 },
    featureTitle: { ...ty.h1, color: t.text },
    featureBody: { ...ty.body, color: t.textMuted, maxWidth: 560 },

    storePanel: stacked
      ? {
          ...stackedItem,
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 18,
          padding: l.isPhone ? 12 : 16,
          gap: 16,
          backgroundColor: t.surfaceRaised,
          ...card,
        }
      : {
          ...fluid,
          flexGrow: 1.3,
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 18,
          padding: 16,
          gap: 16,
          backgroundColor: t.surfaceRaised,
          ...card,
        },
    readinessBar: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
    },
    readinessCell: { flexGrow: 1, flexShrink: 1, flexBasis: 140, minWidth: 0, gap: 6 },
    storePanelTitle: { ...ty.h4, color: t.text },
    readinessScore: { ...ty.h2, color: t.text },
    readinessSmall: { ...ty.caption, color: t.textSubtle },
    storeMetricLabel: { ...ty.caption, color: t.textMuted },
    storeMetricValue: { ...ty.h3, color: t.text },
    storeProgress: { width: "100%", maxWidth: 130, height: 6, backgroundColor: t.surfaceInset, borderRadius: 4 },
    storeProgressFill: { width: "92%", height: 6, backgroundColor: t.brand, borderRadius: 4 },
    passed: { ...ty.h4, color: t.successText },
    storefront: { borderWidth: 1, borderColor: t.border, borderRadius: 14, overflow: "hidden" },
    storefrontHeader: {
      minHeight: 46,
      paddingHorizontal: 14,
      paddingVertical: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: t.divider,
    },
    storefrontBrand: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1, minWidth: 0 },
    storefrontTools: { flexDirection: "row", alignItems: "center", gap: 16, flexShrink: 0 },
    productGrid: { flexDirection: "row", flexWrap: "wrap" },
    productCard: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: l.isCompact ? "50%" : "25%",
      minWidth: 0,
      padding: 10,
      borderTopWidth: 1,
      borderTopColor: t.divider,
      borderRightWidth: 1,
      borderRightColor: t.divider,
    },
    productImage: { width: "100%", aspectRatio: 1, backgroundColor: t.surfaceMuted, borderRadius: 10 },
    productName: { ...ty.micro, color: t.text, minHeight: 32, marginTop: 8 },
    productPrice: { ...ty.caption, color: t.text, fontWeight: "800", marginTop: 2 },
    productStars: { ...ty.micro, color: t.orange, marginTop: 4 },
    reviewCount: { color: t.textSubtle },

    intelligenceVisual: stacked
      ? {
          ...stackedItem,
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "stretch",
          gap: 14,
        }
      : { ...fluid, flexGrow: 1.4, flexDirection: "row", alignItems: "stretch", gap: 14 },
    signalColumn: stacked
      ? {
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: "100%",
          minWidth: 0,
          flexDirection: l.isPhone ? "column" : "row",
          alignItems: "stretch",
          gap: 14,
        }
      : { ...fluid, flexGrow: 0.85, justifyContent: "space-between", gap: 16 },
    signalCard: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: stacked && !l.isPhone ? 0 : "auto",
      minWidth: 0,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: t.surfaceRaised,
      ...card,
    },
    signalCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    signalTitle: { ...ty.caption, color: t.text, fontWeight: "800" },
    signalNote: { ...ty.micro, color: t.textMuted, marginTop: 4 },

    profileCard: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: stacked ? (l.isPhone ? "100%" : "46%") : 0,
      minWidth: 0,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 18,
      padding: 18,
      alignItems: "center",
      backgroundColor: t.surfaceRaised,
      ...card,
    },
    profilePhoto: {
      width: 124,
      height: 124,
      borderRadius: 62,
      backgroundColor: t.surfaceMuted,
    },
    profileName: { ...ty.h3, color: t.text, marginTop: 12, textAlign: "center" },
    profileTags: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 8 },
    profileTag: chip(t.successBg, t.successText),
    profileMetaRow: {
      width: "100%",
      minHeight: 22,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 12,
    },
    // Fixed icon column so the meta lines share one left edge.
    profileMetaIcon: { width: 16, textAlign: "center", flexShrink: 0 },
    profileMetaText: { ...ty.caption, color: t.textMuted, flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },

    recommendationCard: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: stacked ? (l.isPhone ? "100%" : "46%") : 0,
      minWidth: 0,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 18,
      padding: 18,
      gap: 14,
      backgroundColor: t.surfaceRaised,
      ...card,
    },
    recommendationBrand: { ...ty.h4, color: t.text },
    recommendationTitle: { ...ty.h3, color: t.text },
    recommendationMetrics: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: t.divider,
      paddingVertical: 14,
    },
    recommendationMetric: { flexShrink: 1, minWidth: 0, gap: 4 },
    revenueBrand: { ...ty.h3, color: t.brand },
    confidence: { ...ty.h3, color: t.successText },
    reason: { padding: 11, borderRadius: 10, backgroundColor: t.surfaceMuted },
    reasonText: { ...ty.caption, color: t.text, fontWeight: "600" },
  });
}
