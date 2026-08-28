import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import {
  AnchorStatementSection,
  CapabilityGroupsSection,
  ControlSection,
  FlowAgentAlongsideSection,
  IndustriesSection,
} from "@/components/public/business-os-sections";
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
import { BrandLogo } from "@/components/public/brand-logo";
import { ImageAsset, Media } from "@/components/public/media";
import {
  Animated,
  Reveal,
  Stagger,
  useCountUp,
  useGrowIn,
  useReducedMotion,
} from "@/components/public/motion";
import { FONT_SANS,
  ButtonRow,
  Heading,
  OpenSection,
  PrimaryButton,
  SecondaryButton,
  SectionLabel,
  useOpenSection,
  useTypeScale,
  type TypeScale,
} from "@/components/public/ui";
import { ROUTES } from "@/components/public/nav";
import { PageShell } from "@/components/public/page-shell";
import { breadcrumbJsonLd, organizationJsonLd, webSiteJsonLd } from "@/components/public/seo";
import { contactHref, goToEarlyAccess } from "@/lib/destinations";
import { accentText, brandColor, elevation, hexToRgba, palettes, type ThemeTokens } from "@/theme/tokens";
import { BP, type Layout, useLayout } from "@/theme/use-responsive";
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
 * meanings — it is the hub of the channel map, the avatar in the FlowAgent card,
 * and a tile in the dashboard — so a single baked-in alt would be wrong in at
 * least two of them. Every caller has to say what its instance means, or say
 * `alt=""` and mark it decorative.
 */
function Brand({ compact = false, alt }: { compact?: boolean; alt: string }) {
  const styles = useStyles();
  /*
   * `ImageAsset`, never expo-image's `Image` directly. expo-image destructures
   * `alt` and then renders `alt={accessibilityLabel}` on the real `<img>` — the
   * `alt` alias survives on the placeholder branch alone, and these have no
   * placeholder. So `<Image alt="…">` shipped an `<img>` with no alt attribute
   * at all: the channel-map hub was one of the three unlabelled images on this
   * page. `ImageAsset` routes the text through the prop that reaches the DOM
   * and pairs an empty alt with `aria-hidden`, so a decorative mark is skipped
   * deliberately rather than read as a file name.
   */
  const shared = { alt, contentFit: "contain" as const };
  return compact ? (
    <ImageAsset
      source={require("../../assets/images/v5w/flowsmartly-mark.png")}
      style={styles.brandLogoCompact}
      {...shared}
    />
  ) : (
    <ImageAsset
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
 * The FlowAgent card, the approval queue and the recommendation card are
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
/* hero — FlowAgent card                                                 */
/* ------------------------------------------------------------------ */

/**
 * What the command centre has prepared.
 *
 * Four different organisations on purpose — a tax practice, an elder-care
 * provider, a shop and an NGO. A card that listed four e-commerce tasks would
 * say "marketing suite" however the headline above it is worded.
 */
type AgentStatus = "ready" | "approval" | "draft";

function aiActions(t: ThemeTokens) {
  return [
    {
      icon: "file-invoice-dollar",
      color: t.violet,
      title: "Prepare five tax-client follow-ups",
      note: "12 clients are missing required documents",
      status: "Ready for review",
      tone: "ready" as AgentStatus,
    },
    {
      icon: "hand-holding-heart",
      color: t.pink,
      title: "Fill three open elder-care appointments",
      note: "Matched available caregivers to open visits",
      status: "Approval required",
      tone: "approval" as AgentStatus,
    },
    {
      icon: "cart-shopping",
      color: t.green,
      title: "Recover abandoned Shopify carts",
      note: "37 customers left before checkout",
      status: "Ready to send",
      tone: "ready" as AgentStatus,
    },
    {
      icon: "chart-pie",
      color: t.brand,
      title: "Prepare the monthly NGO donor report",
      note: "Campaign, donation, and outreach data compiled",
      status: "Draft ready",
      tone: "draft" as AgentStatus,
    },
  ];
}

/**
 * The rail used literal Unicode dingbats as icons, which render as mojibake
 * next to the FontAwesome glyphs used everywhere else on the page. The set
 * spans the whole workspace — work, calendar, messages, store — rather than
 * the marketing corner of it.
 */
const AI_RAIL_ICONS = [
  "wand-magic-sparkles",
  "list-check",
  "calendar-days",
  "envelope",
  "bag-shopping",
  "gear",
] as const;

/**
 * One-off settle on the status pill: it lands a beat after its row, so the
 * card reads as FlowAgent finishing its thinking. Deliberately not a loop.
 *
 * Like every primitive in `motion`, it renders *settled* and is only pushed
 * back in a client layout effect, so the no-JS render shows the finished pill.
 *
 * The tone is load-bearing, not decoration: "Approval required" must not look
 * like "Ready to send", because the whole promise of the card is that the
 * sensitive one stops and waits.
 */
function StatusPill({ label, tone, delay }: { label: string; tone: AgentStatus; delay: number }) {
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

  const shell = tone === "approval" ? styles.pillWarn : tone === "draft" ? styles.pillInfo : styles.pillReady;
  const text = tone === "approval" ? styles.pillWarnText : tone === "draft" ? styles.pillInfoText : styles.pillReadyText;

  return (
    <Animated.View style={[shell, animated]}>
      <Text numberOfLines={1} style={text}>
        {label}
      </Text>
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
               aria-hidden={true}/>
            </View>
          ))}
        </View>
      )}
      <View style={styles.aiContent}>
        <View style={styles.aiTitleRow}>
          <Text style={styles.aiTitle}>
            FlowAgent <Text style={styles.aiTitleLight}>Command Center</Text>
          </Text>
          <Text style={styles.beta}>Beta</Text>
        </View>
        <View style={styles.aiMessageRow}>
          <View style={styles.sparkCircle}>
            <Text style={styles.spark}>✦</Text>
          </View>
          <View style={styles.messageBubble}>
            <Text style={styles.messageText}>I prepared four things across your business this week.</Text>
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
                <FontAwesome6 name={action.icon as never} size={14} color={t.textOnBrand}  aria-hidden={true}/>
              </View>
              {/* Title on its own line, then note and status share the next
                  one. As a third column the pill left the title ~160px and
                  every row ellipsized to "Prepare the…" — and the status is
                  the whole point of the card, so it cannot be the thing that
                  gets dropped either. */}
              <View style={styles.actionCopy}>
                <Text numberOfLines={2} style={styles.actionTitle}>
                  {action.title}
                </Text>
                <View style={styles.actionMeta}>
                  <Text numberOfLines={2} style={styles.actionNote}>
                    {action.note}
                  </Text>
                  <StatusPill label={action.status} tone={action.tone} delay={520 + index * 50} />
                </View>
              </View>
            </Reveal>
          ))}
        </View>
        <View style={styles.aiFooter}>
          {/* mockup chrome — see MockButton */}
          <MockButton label="Review actions" />
          <View style={styles.approval}>
            {/* Two stand-in faces stacked behind "Human approval enabled" —
                the same portrait twice, standing for "someone signs this off".
                They identify nobody, and the sentence beside them already says
                what they mean, so they are art: an explicit empty alt plus
                aria-hidden, not a description of a face. */}
            <View style={styles.approvalFaces}>
              <ImageAsset
                source={require("../../assets/images/v5/customer-sarah-johnson.png")}
                style={styles.approvalFace}
                contentFit="cover"
                alt=""
              />
              <ImageAsset
                source={require("../../assets/images/v5/customer-sarah-johnson.png")}
                style={[styles.approvalFace, styles.approvalFaceOverlap]}
                contentFit="cover"
                alt=""
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

/**
 * Social brand marks. Still real logos, still `brandColor`-corrected — they are
 * only used by the dashboard's integrations strip now, where naming the actual
 * networks is the point.
 */
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

/**
 * What the hub connects — systems, not social networks.
 *
 * The panel used to show eight logos, all of them marketing channels, which
 * told a visitor that FlowSmartly plugs into their posting tools. These are
 * capabilities rather than brands, so they carry theme tokens and need no
 * `brandColor` correction, and no third-party mark is ever drawn by hand.
 *
 * The first six are wired to the hub; the rest are named underneath, because
 * twelve wires from one node is a knot, not a diagram.
 */
type SystemAccent = "brand" | "violet" | "green" | "orange" | "pink";

const SYSTEMS: { icon: string; label: string; accent: SystemAccent }[] = [
  { icon: "globe", label: "Website", accent: "brand" },
  { icon: "envelope", label: "Email", accent: "violet" },
  { icon: "comment-dots", label: "SMS", accent: "green" },
  { icon: "bag-shopping", label: "Store", accent: "orange" },
  { icon: "calendar-days", label: "Calendar", accent: "pink" },
  { icon: "credit-card", label: "Payments", accent: "green" },
  { icon: "hashtag", label: "Social", accent: "pink" },
  { icon: "address-book", label: "CRM", accent: "brand" },
  { icon: "folder-open", label: "Documents", accent: "orange" },
  { icon: "chart-column", label: "Analytics", accent: "violet" },
  { icon: "location-dot", label: "Business listings", accent: "brand" },
  { icon: "plug", label: "Connected applications", accent: "brand" },
];

/** How many of `SYSTEMS` the hub visibly wires up. */
const WIRED = 6;

function systemColor(t: ThemeTokens, accent: SystemAccent): string {
  return accent === "violet"
    ? t.violet
    : accent === "green"
      ? t.green
      : accent === "orange"
        ? t.orange
        : accent === "pink"
          ? t.pink
          : t.brand;
}

function SystemTile({
  icon,
  label,
  color,
  nodeProps,
  cluster = false,
}: {
  icon: string;
  label: string;
  color: string;
  nodeProps?: { ref: (node: unknown) => void; onLayout: () => void };
  cluster?: boolean;
}) {
  const styles = useStyles();
  return (
    // Icon and label share one card, and the card is the measured node —
    // otherwise a wire stops at the icon and runs through the label below it.
    <View {...(nodeProps as object)} style={[styles.brandTile, cluster ? styles.brandTileCluster : null]}>
      <FontAwesome6 name={icon as never} size={22} color={color}  aria-hidden={true}/>
      {/* Two lines in the cluster only: the six wired labels are single words,
          but "Connected applications" has to wrap rather than ellipsize. */}
      <Text numberOfLines={cluster ? 2 : 1} style={styles.channelLabel}>
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
  // Six, not twelve: with four cards per column the hub's neighbours sit flush
  // against it and their wires have no visible run at all.
  const shown = useMemo(() => SYSTEMS.slice(0, WIRED), []);
  const links = useMemo<Link[]>(() => shown.map((item) => ["hub", item.label] as const), [shown]);

  // The hub sits between two columns rather than beside a block of twelve, so a
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
          <SystemTile
            key={item.label}
            icon={item.icon}
            label={item.label}
            color={systemColor(t, item.accent)}
            nodeProps={field.node(item.label)}
          />
        ))}
      </View>
      <View {...field.node("hub")} style={styles.channelHub}>
        <Brand compact alt="FlowSmartly, at the centre of every connected system" />
      </View>
      <View style={styles.channelColumn}>
        {shown.slice(3).map((item) => (
          <SystemTile
            key={item.label}
            icon={item.icon}
            label={item.label}
            color={systemColor(t, item.accent)}
            nodeProps={field.node(item.label)}
          />
        ))}
      </View>
    </ConnectorSurface>
  );
}

/** Phone: a centred cluster reads far better than twelve crossing wires. */
function ChannelCluster() {
  const styles = useStyles();
  const t = useTokens();
  return (
    <View style={styles.channelCluster}>
      <View style={styles.channelHub}>
        <Brand compact alt="FlowSmartly, at the centre of every connected system" />
      </View>
      <View style={styles.channelClusterGrid}>
        {SYSTEMS.map((item) => (
          <SystemTile
            key={item.label}
            icon={item.icon}
            label={item.label}
            color={systemColor(t, item.accent)}
            cluster
          />
        ))}
      </View>
    </View>
  );
}

/**
 * The map is a picture of the integrations surface, so it gets that surface's
 * chrome: a titled header and a sync footer. Bare tiles left a 158px void
 * beside the FlowAgent card next to it, and a panel with no header read as a
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
          Connected systems
        </Text>
        <Text style={styles.channelPanelPill}>Live</Text>
      </View>
      {l.isPhone ? <ChannelCluster /> : <ChannelWeb />}
      {/* The phone cluster already draws all twelve, so this line would only
          repeat itself there. */}
      {l.isPhone ? null : (
        <View style={styles.channelMore}>
          <Text style={styles.channelMoreLabel}>Also connected</Text>
          <Text style={styles.channelMoreText}>
            {SYSTEMS.slice(WIRED)
              .map((item) => item.label)
              .join(" · ")}
          </Text>
        </View>
      )}
      <View style={styles.channelPanelFoot}>
        <View style={styles.channelPanelDot} />
        <Text numberOfLines={1} style={styles.channelPanelFootText}>
          All systems connected • synced 2 min ago
        </Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* hero                                                                */
/* ------------------------------------------------------------------ */

/**
 * The systems FlowAgent works across, drawn around it.
 *
 * Six is what fits either side of the hub without the wires crossing; the rest
 * are named in the connected-systems section further down the page.
 */
type HeroAccent = 'brand' | 'violet' | 'green' | 'orange' | 'pink';

const HERO_SYSTEMS: { key: string; icon: string; label: string; at: 'left' | 'right'; accent: HeroAccent }[] = [
  { key: 'website', icon: 'globe', label: 'Website', at: 'left', accent: 'brand' },
  { key: 'email', icon: 'envelope', label: 'Email & SMS', at: 'left', accent: 'violet' },
  { key: 'calendar', icon: 'calendar-days', label: 'Calendar', at: 'left', accent: 'green' },
  { key: 'store', icon: 'bag-shopping', label: 'Store', at: 'right', accent: 'orange' },
  { key: 'crm', icon: 'user-group', label: 'CRM', at: 'right', accent: 'brand' },
  { key: 'payments', icon: 'credit-card', label: 'Payments', at: 'right', accent: 'pink' },
];

/**
 * Accents for anything sitting on glass.
 *
 * The glass keeps its dark tint in every theme, so the icons on it have to
 * come from the palette built for a dark ground — the light palette's accents
 * are deepened for white surfaces (brand #0a63d6, green #0e7b3a) and go nearly
 * black against it. Reading them from `palettes.dark` keeps them out of the
 * page as literals while matching the surface they actually sit on.
 */
const onGlass: Record<HeroAccent, string> = {
  brand: palettes.dark.brand,
  violet: palettes.dark.violet,
  green: palettes.dark.green,
  orange: palettes.dark.orange,
  pink: palettes.dark.pink,
};

/** What it prepared — the headline types through these, and they arrive as cards. */
const HERO_PREPARED: { key: string; icon: string; label: string; tail: string; accent: HeroAccent }[] = [
  { key: 'followups', icon: 'file-lines', label: 'Five tax-client follow-ups', tail: 'five tax-client follow-ups.', accent: 'brand' },
  { key: 'appointments', icon: 'calendar-check', label: 'Three appointments filled', tail: 'three appointments to fill.', accent: 'green' },
  { key: 'carts', icon: 'cart-shopping', label: '37 abandoned carts recovered', tail: '37 carts worth recovering.', accent: 'orange' },
  { key: 'reviews', icon: 'star', label: 'Nine reviews answered', tail: 'nine reviews to answer.', accent: 'pink' },
  { key: 'report', icon: 'chart-column', label: 'Monthly donor report compiled', tail: 'the monthly donor report.', accent: 'violet' },
  { key: 'quotes', icon: 'file-invoice-dollar', label: 'Four quotes drafted', tail: 'four quotes to send.', accent: 'brand' },
  { key: 'callbacks', icon: 'phone', label: 'Six call-backs scheduled', tail: 'six call-backs to make.', accent: 'green' },
];

/**
 * How long one activity item holds before the next arrives.
 *
 * The block used to render three of them at once, permanently. Three static
 * rows is a list, not an arrival — it takes three times the height, and it
 * loses the one idea the block exists to carry: that this is happening while
 * you watch. It shows ONE, and the next replaces it.
 */
const HERO_CYCLE_MS = 3600;

/**
 * The software a workspace is usually already running.
 *
 * Real marks through `BrandLogo`, which resolves FontAwesome first and
 * simple-icons after — never a drawn look-alike. The strip is decorative and
 * duplicated, so it is `aria-hidden`; the integrations page is where these are
 * actually claimed.
 *
 * Only brands that resolve to a real mark are listed. `BrandLogo` falls back
 * to a labelled monogram for anything neither library carries, which is the
 * right behaviour and the wrong look here — hubspot, twilio and klaviyo came
 * through as "H", "Tw" and "K" and were dropped rather than drawn by hand.
 */
const HERO_INTEGRATIONS = [
  'shopify', 'stripe', 'salesforce', 'mailchimp', 'slack', 'zapier', 'notion',
  'microsoft', 'google', 'wordpress', 'intercom', 'airtable', 'zendesk',
  'dropbox', 'asana', 'trello', 'github',
];

/**
 * True while the element is on screen AND the tab is visible.
 *
 * `useInView` in `motion` is a one-shot "has entered" trigger, which is exactly
 * right for a reveal and exactly wrong for a loop: an ambient cycle has to STOP
 * when it leaves the viewport, not fire once and then animate forever behind
 * the fold. Where there is no IntersectionObserver at all the cycle runs rather
 * than freezing — a static page is the worse failure of the two.
 */
function useAmbientActive() {
  const ref = useRef<unknown>(null);
  /*
   * Starts TRUE, and the observer only ever corrects it downward.
   *
   * It started false and the ticker never advanced once - seven items, a 3.6s
   * interval, and a single row for the whole session. The pause is a courtesy
   * (do not animate behind the fold); the animation is the feature. Defaulting
   * to "paused" means any reason the observer does not report - a zero-area
   * box at the moment it is observed, a ref that is not a DOM node, an
   * environment without IntersectionObserver - silently turns the feature off
   * and leaves markup that looks correct and does nothing.
   *
   * Fail open: worst case it animates while off-screen, which costs a timer.
   */
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    const node = ref.current as Element | null;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      // threshold 0: a wrapper whose rows are absolutely positioned can measure
      // as zero-area at observe time, and 0.1 of zero is never met.
      (entries) => entries.forEach((entry) => setOnScreen(entry.isIntersecting)),
      { threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const sync = () => setTabVisible(document.visibilityState !== 'hidden');
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  return { ref, active: onScreen && tabVisible };
}

/**
 * One activity item at a time, the next replacing the last.
 *
 * The outgoing item leaves upward and the incoming one arrives from below, so
 * it reads the way a notification does. Deliberately NOT a carousel: there are
 * no dots and no arrows, because it is ambient — nobody is meant to operate it.
 *
 * It mounts settled (`step` starts at 1 and the first pass is skipped), so the
 * served markup is a complete row and the no-JS render is finished work.
 * Reduced motion never starts the interval, so one item is shown and held.
 */
function useHeroCycle(length: number) {
  const reduced = useReducedMotion();
  const { ref, active } = useAmbientActive();
  const [pair, setPair] = useState({ current: 0, previous: -1 });

  useEffect(() => {
    if (reduced || !active) return;
    const timer = setInterval(() => {
      setPair((p) => ({ current: (p.current + 1) % length, previous: p.current }));
    }, HERO_CYCLE_MS);
    return () => clearInterval(timer);
  }, [reduced, active, length]);

  const step = useSharedValue(1);
  const mounted = useRef(false);
  useEffect(() => {
    if (reduced) {
      step.value = 1;
      return;
    }
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    step.value = 0;
    step.value = withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) });
  }, [pair.current, reduced, step]);

  const enter = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, (step.value - 0.3) / 0.7)),
    transform: [{ translateY: (1 - step.value) * 18 }],
  }));
  const leave = useAnimatedStyle(() => {
    const out = Math.min(1, step.value / 0.45);
    return { opacity: 1 - out, transform: [{ translateY: -out * 18 }] };
  });

  return { ref, current: pair.current, previous: pair.previous, enter, leave };
}

/** The row itself. Static — the ticker around it owns the motion. */
function HeroActivityRow({ item, styles }: { item: (typeof HERO_PREPARED)[number]; styles: Styles }) {
  return (
    <View style={styles.heroCard}>
      <FontAwesome6 name={item.icon as never} size={12} color={onGlass[item.accent]}  aria-hidden={true}/>
      <Text numberOfLines={1} style={styles.heroCardText}>
        {item.label}
      </Text>
      <Text style={styles.heroCardPill}>Ready</Text>
    </View>
  );
}

/**
 * The software a business already runs, drifting past.
 *
 * Two copies of the same row translate as one, so when the first has moved its
 * whole width the second is exactly where it started and the loop is
 * invisible. Reduced motion leaves the row where it is rather than stopping it
 * mid-drift.
 */
function HeroIntegrations({ styles, reduced }: { styles: Styles; reduced: boolean }) {
  const [width, setWidth] = useState(0);
  const shift = useSharedValue(0);
  useEffect(() => {
    if (reduced || width <= 0) return;
    shift.value = 0;
    // a steady speed rather than a fixed duration, so a longer row is not faster
    shift.value = withRepeat(withTiming(-width, { duration: width * 26, easing: Easing.linear }), -1, false);
  }, [reduced, width, shift]);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateX: shift.value }] }));

  const row = (measured: boolean) => (
    <View
      style={styles.heroLogoRow}
      onLayout={measured ? (event) => setWidth(event.nativeEvent.layout.width) : undefined}>
      {HERO_INTEGRATIONS.map((name) => (
        <View key={`${measured ? 'a' : 'b'}-${name}`} style={styles.heroLogo}>
          <BrandLogo name={name} size={22} />
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.heroLogoStrip} aria-hidden pointerEvents="none">
      <Animated.View style={[styles.heroLogoTrack, animated]}>
        {row(true)}
        {row(false)}
      </Animated.View>
    </View>
  );
}

/** One system tile on the photograph — glass, so the room reads through it. */
function HeroSystem({
  system,
  field,
  styles,
  t,
}: {
  system: (typeof HERO_SYSTEMS)[number];
  field: ReturnType<typeof useConnectorField>;
  styles: Styles;
  t: ThemeTokens;
}) {
  return (
    <View {...field.node(system.key)} style={styles.heroSystem}>
      <FontAwesome6 name={system.icon as never} size={13} color={onGlass[system.accent]}  aria-hidden={true}/>
      <Text numberOfLines={1} style={styles.heroSystemLabel}>
        {system.label}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* hero — the phone composition                                        */
/* ------------------------------------------------------------------ */

/**
 * One prepared item on the phone panel.
 *
 * The same row as the wide one, but on the page ground rather than on glass:
 * the phone hero has no photograph under it, so the accents come from the
 * theme instead of the dark-palette set the scrim needs. Static — the ticker
 * around it owns the motion.
 */
function PhoneActivityRow({ item, styles }: { item: (typeof HERO_PREPARED)[number]; styles: Styles }) {
  const t = useTokens();
  const tone = t[item.accent];
  return (
    <View style={styles.phoneRow}>
      <View style={[styles.phoneRowIcon, { backgroundColor: hexToRgba(tone, 0.14) }]}>
        <FontAwesome6 name={item.icon as never} size={13} color={tone}  aria-hidden={true}/>
      </View>
      <Text numberOfLines={1} style={styles.phoneRowText}>
        {item.label}
      </Text>
      <Text style={styles.phoneRowPill}>Ready</Text>
    </View>
  );
}

/**
 * One system chip, on the phone scene.
 *
 * It is drawn over the photograph, so its ground CANNOT be the photograph.
 * The tile is an opaque dark plate — `palettes.dark.surfaceRaised`, the same
 * trick `onGlass` already uses for the accents — rather than the wide hero's
 * translucent glass. That is not a styling preference: a 30% veil leaves the
 * real ground unknowable, so the label is read against whatever the room
 * happens to be doing behind it, which is how dark copy ended up crossing a
 * bright window. An opaque plate gives the label a ground that is computable
 * from styles alone, in every theme, wherever the photograph is bright.
 */
function PhoneSystemChip({
  system,
  field,
  styles,
}: {
  system: (typeof HERO_SYSTEMS)[number];
  field: ReturnType<typeof useConnectorField>;
  styles: Styles;
}) {
  return (
    <View {...field.node(system.key)} style={styles.phoneChip}>
      <FontAwesome6 name={system.icon as never} size={12} color={onGlass[system.accent]} aria-hidden={true} />
      <Text numberOfLines={1} style={styles.phoneChipLabel}>
        {system.label}
      </Text>
    </View>
  );
}

/**
 * The room, with the system wired over it — the phone form of the wide scene.
 *
 * The photograph is BACK, and it is back as a picture rather than as a page
 * ground: a rounded, bounded card that carries the six connected systems and
 * the hub between them. Nothing in the hero's *reading* order sits on it —
 * eyebrow, headline, body, CTAs and trust markers are all outside this card,
 * on the page's own surface. The only text inside it is a chip label, and
 * every chip is its own opaque plate.
 *
 * That is the whole rule, stated as geometry: artwork sits NEXT TO the words,
 * or BEHIND a surface the words sit on. Never behind the words themselves.
 */
function PhoneScene() {
  const styles = useStyles();
  const t = useTokens();
  const field = useConnectorField();
  const reduced = useReducedMotion();
  const links = useMemo<Link[]>(
    () => HERO_SYSTEMS.map((s) => ({ from: s.key, to: 'hub', color: onGlass[s.accent] })),
    [],
  );

  return (
    <View style={styles.phoneScene}>
      {/* Decorative: the headline above the card carries the meaning. */}
      <Media name="scenes/careers-team" alt="" radius={0} style={styles.phoneScenePhoto} />
      {/* Settles the room down so the plates read as sitting in it. Nothing
          depends on it for contrast — every label has its own opaque tile. */}
      <LinearGradient
        colors={[`rgba(${t.scrimBase},${t.scrimVeil[3]})`, `rgba(${t.scrimBase},${t.scrimVeil[2]})`]}
        locations={[0, 1]}
        style={styles.phoneSceneScrim}
        pointerEvents="none"
      />
      {/* Nothing may transform between the surface and its nodes — the overlay
          measures them against each other, so a per-chip reveal here would
          detach every wire. */}
      <ConnectorSurface field={field} style={styles.phoneSceneField}>
        <Connectors
          field={field}
          links={links}
          color={t.brandStrong}
          circular={HERO_HUB}
          strokeWidth={1.5}
          dash="4 7"
          flow={!reduced}
          endDots={false}
        />
        <View style={styles.phoneSceneRow}>
          <View style={styles.phoneSceneColumnLeft}>
            {HERO_SYSTEMS.filter((s) => s.at === 'left').map((s) => (
              <PhoneSystemChip key={s.key} system={s} field={field} styles={styles} />
            ))}
          </View>
          {/* The documented exception to "the logo lives in the header and the
              footer": it is the only thing naming a centre node in a picture
              where every other node wears a text label. */}
          <View {...field.node('hub')} style={styles.phoneSceneHub}>
            <ImageAsset
              source={require("../../assets/images/v5/flowsmartly-mark.png")}
              style={styles.phoneSceneHubMark}
              contentFit="contain"
              alt="FlowSmartly"
            />
          </View>
          <View style={styles.phoneSceneColumnRight}>
            {HERO_SYSTEMS.filter((s) => s.at === 'right').map((s) => (
              <PhoneSystemChip key={s.key} system={s} field={field} styles={styles} />
            ))}
          </View>
        </View>
      </ConnectorSurface>
    </View>
  );
}

/**
 * The phone hero is COMPOSED, not stacked.
 *
 * Turned sideways, the wide hero becomes a full-width wall of copy followed by
 * a full-width picture — the exact defect this rewrite exists to end. Three
 * things change, and none of them is "add flexDirection: column":
 *
 *   1. The photograph becomes a PICTURE instead of a ground. Wide, the room is
 *      the page and the copy is scrimmed over it; here it is a bounded card
 *      between the headline and the product panel, carrying the six connected
 *      systems and the hub. It was briefly deleted on the phone to fix the
 *      readability — that traded one defect for another, because the room and
 *      the wired systems ARE the visual identity of this page. What actually
 *      had to go was text ON the photograph, and only that.
 *   2. The ORDER changes. Wide reads copy-left / system-right. Phone reads
 *      claim → the system it runs across → the product doing the work → the
 *      explanation → the two CTAs, so the proof arrives before the paragraph
 *      rather than after it.
 *   3. The trust markers become a two-column grid instead of four full-width
 *      lines, and the 300px connector field becomes a panel whose activity
 *      feed shows ONE item at a time rather than three stacked forever.
 *
 * The headline, the sub-copy and both CTAs are all still here — and all of
 * them are on the page's own surface, never over the picture.
 */
function PhoneHero() {
  const styles = useStyles();
  const t = useTokens();
  const router = useRouter();
  const prepared = useCountUp(326);
  const cycle = useHeroCycle(HERO_PREPARED.length);

  return (
    <View style={styles.phoneHero}>
      <SectionLabel>THE AGENTIC BUSINESS OPERATING SYSTEM</SectionLabel>
      {/* The one h1 on the site root — the wide hero is not rendered here, so
          there is still exactly one. */}
      <Heading level={1} style={styles.phoneHeroTitle}>
        Agentic AI built to operate, adapt, and scale with your business.
      </Heading>

      {/* The picture, between the claim and the product surface. It carries no
          reading copy — only its own opaque chips — so nothing above or below
          it is ever read against a photograph. */}
      <PhoneScene />

      <View style={styles.phonePanel}>
        <View style={styles.phonePanelHead}>
          {/* Chrome inside a mock: a brand-tinted tile, not the logo — rule 7
              keeps the mark in the header and the footer. */}
          <View style={styles.phonePanelMark}>
            <FontAwesome6 name={"wand-magic-sparkles" as never} size={13} color={t.brand}  aria-hidden={true}/>
          </View>
          <Text numberOfLines={1} style={styles.phonePanelTitle}>
            FlowAgent Command Center
          </Text>
          <View style={styles.phonePanelLive}>
            <View style={styles.phonePanelLiveDot} />
            <Text style={styles.phonePanelLiveText}>Live</Text>
          </View>
        </View>
        {/* The sentence, always complete and always naming the row below it.
            Two lines are reserved, which is what the longest tail needs, so
            the panel does not resize as items swap. */}
        <Animated.Text numberOfLines={2} style={[styles.phoneLead, cycle.enter]}>
          {HERO_TITLE_LEAD}{' '}
          <Text style={styles.phoneLeadTail}>{HERO_PREPARED[cycle.current].tail}</Text>
        </Animated.Text>
        {/* One row at a time — the outgoing item leaves, the next arrives. */}
        <View ref={cycle.ref as never} style={styles.phoneTicker}>
          {cycle.previous >= 0 ? (
            <Animated.View
              key={`out-${cycle.previous}`}
              style={[styles.phoneTickerSlot, cycle.leave]}
              pointerEvents="none"
              aria-hidden>
              <PhoneActivityRow item={HERO_PREPARED[cycle.previous]} styles={styles} />
            </Animated.View>
          ) : null}
          <Animated.View key={`in-${cycle.current}`} style={[styles.phoneTickerSlot, cycle.enter]}>
            <PhoneActivityRow item={HERO_PREPARED[cycle.current]} styles={styles} />
          </Animated.View>
        </View>
        <View style={styles.phonePanelFoot}>
          <Text ref={prepared.ref as never} numberOfLines={2} style={styles.phonePanelFootText}>
            {`${Math.round(prepared.value).toLocaleString('en-US')} actions prepared this week · none of them sent without approval`}
          </Text>
        </View>
      </View>

      {/* Written for a 1440px column, so it is clamped rather than allowed to
          run to seven lines in a 362px one. */}
      <Text numberOfLines={3} style={styles.phoneHeroBody}>
        FlowSmartly is an agentic business operating system designed to understand goals,
        coordinate tools, execute work, learn from feedback, and continuously improve across
        your organization.
      </Text>

      <ButtonRow>
        <PrimaryButton
          label="Join early access"
          size="lg"
          full
          trackId="home.hero.start-workspace"
          onPress={() => goToEarlyAccess()}
        />
        <SecondaryButton
          label="See FlowAgent in action"
          size="lg"
          icon="play"
          full
          trackId="home.hero.see-in-action"
          onPress={() => router.push(contactHref("demo") as never)}
        />
      </ButtonRow>

      <View style={styles.phoneTrustGrid}>
        {HERO_TRUST.map((line) => (
          <View key={line} style={styles.phoneTrustItem}>
            <FontAwesome6
              name={"circle-check" as never}
              size={12}
              color={t.green}
              style={styles.phoneTrustIcon}
             aria-hidden={true}/>
            <Text numberOfLines={2} style={styles.phoneTrustText}>
              {line}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** The markers under the hero, on both compositions. */
const HERO_TRUST = [
  'Governed authority',
  'Human approval where it counts',
  'Verifiable, observable work',
  'Built for real organizations',
];

function WideHero() {
  const styles = useStyles();
  const l = useLayout();
  const t = useTokens();
  const router = useRouter();
  const field = useConnectorField();
  const reduced = useReducedMotion();
  const prepared = useCountUp(326);
  const cycle = useHeroCycle(HERO_PREPARED.length);

  const links = useMemo<Link[]>(
    () => HERO_SYSTEMS.map((s) => ({ from: s.key, to: 'hub', color: onGlass[s.accent] })),
    [],
  );

  return (
    <View style={styles.heroScene}>
      {/* The photograph is the ground. It is decorative — the headline beside
          it carries the meaning — so it takes an empty alt. */}
      <Media name="scenes/careers-team" alt="" radius={0} style={styles.heroPhoto} />
      {/* Two scrims: one across, so the copy has contrast over whatever the
          photograph is doing; one up from the floor, for the trust strip. */}
      <LinearGradient
        colors={[
          `rgba(${t.scrimBase},${t.scrimVeil[0]})`,
          `rgba(${t.scrimBase},${t.scrimVeil[1]})`,
          `rgba(${t.scrimBase},${t.scrimVeil[2]})`,
          `rgba(${t.scrimBase},${t.scrimVeil[3]})`,
        ]}
        locations={[0, 0.3, 0.6, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.heroScrim}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[`rgba(${t.scrimBase},0)`, `rgba(${t.scrimBase},${t.scrimVeil[1]})`]}
        locations={[0.68, 1]}
        style={styles.heroScrim}
        pointerEvents="none"
      />

      <View style={styles.heroTop}>
        <View style={styles.heroCopy}>
          <Stagger mode="enter" step={75} distance={16}>
            {[
              <View key="eyebrow" style={styles.heroBadge}>
                <View style={styles.heroLiveDot} />
                <Text style={styles.heroBadgeText}>THE AGENTIC BUSINESS OPERATING SYSTEM</Text>
              </View>,
              // The one h1 on the site root. react-native-web renders every
              // Text as a div, so without this the page ships no heading at all.
              /*
               * Static, and deliberately so. The headline used to type its own
               * tail — "While you were away, FlowAgent prepared five tax-client
               * follow-ups." — which is a marketing-operations anecdote in the
               * one slot that has to carry the category claim. The typing was
               * not deleted: it moved to the panel beside this copy, where an
               * illustration of a run is exactly what it is.
               */
              <Heading key="title" level={1} style={styles.heroTitle}>
                Agentic AI built to operate, adapt, and scale with your business.
              </Heading>,
              <Text key="body" style={styles.heroBody}>
                FlowSmartly is an agentic business operating system designed to understand goals,
                coordinate tools, execute work, learn from feedback, and continuously improve across
                your organization.
              </Text>,
              <Text key="body2" style={styles.heroBody}>
                From marketing and customer engagement to engineering, operations, analytics, and
                specialized workflows, FlowSmartly gives businesses an intelligent system that can do
                more than assist. <Text style={styles.heroBodyLead}>It can act.</Text>
              </Text>,
              <View key="metric" style={styles.heroMetric}>
                <Text ref={prepared.ref as never} style={styles.heroMetricValue}>
                  {Math.round(prepared.value).toLocaleString('en-US')}
                </Text>
                <Text style={styles.heroMetricLabel}>
                  actions prepared this week · none of them sent without approval
                </Text>
              </View>,
              <View key="cta" style={styles.heroActions}>
                <ButtonRow>
                  {/* full-width on phone so every CTA down the page shares one edge */}
                  <PrimaryButton
                    label="Join early access"
                    size="lg"
                    full={l.isPhone}
                    trackId="home.hero.start-workspace"
                    onPress={() => goToEarlyAccess()}
                  />
                  {/* No demo video exists, so this books a real one rather than
                      opening a player that has nothing to play. */}
                  <SecondaryButton
                    label="See FlowAgent in action"
                    size="lg"
                    icon="play"
                    full={l.isPhone}
                    trackId="home.hero.see-in-action"
                    onPress={() => router.push(contactHref("demo") as never)}
                  />
                </ButtonRow>
              </View>,
            ]}
          </Stagger>
        </View>

        {/* The live system, over the photograph. Nothing may transform between
            the surface and its nodes — the overlay measures them against each
            other with getBoundingClientRect, so a per-tile reveal or a scale
            here would detach every wire. */}
        <ConnectorSurface field={field} style={styles.heroSystemField}>
          <Connectors
            field={field}
            links={links}
            color={t.brandStrong}
            circular={HERO_HUB}
            strokeWidth={1.8}
            dash="5 9"
            flow={!reduced}
            endDots={false}
          />
          <View style={styles.heroSystemRow}>
            <View style={styles.heroSystemColumn}>
              {HERO_SYSTEMS.filter((s) => s.at === 'left').map((s) => (
                <HeroSystem key={s.key} system={s} field={field} styles={styles} t={t} />
              ))}
            </View>
            {/* Rule 7 keeps the logo out of content sections, and the channels
                diagram already carries the documented exception: the mark is
                the only thing naming a centre node when every other node in the
                picture wears a text label. A word set in a blue circle is not
                the brand — this is. */}
            <View {...field.node('hub')} style={styles.heroHub}>
              <ImageAsset
                source={require("../../assets/images/v5/flowsmartly-mark.png")}
                style={styles.heroHubMark}
                contentFit="contain"
                alt="FlowSmartly"
              />
            </View>
            <View style={styles.heroSystemColumn}>
              {HERO_SYSTEMS.filter((s) => s.at === 'right').map((s) => (
                <HeroSystem key={s.key} system={s} field={field} styles={styles} t={t} />
              ))}
            </View>
          </View>

          {/*
            * The sentence, in sync with the row below it.
            *
            * It used to TYPE, letter by letter, through all seven tails on a
            * clock of its own — so the visible line was routinely a fragment
            * ("…prepared three appoi") and it named an item that was not the
            * one on screen. It is now always the complete sentence for the
            * item currently showing.
            *
            * A ghost copy of the longest phrase still holds the block open at
            * exactly the height the live line can ever need, so the layout does
            * not jump as the tail changes length. Reserving a guessed
            * `minHeight` instead would be wrong at one type scale out of four.
            */}
          <View style={styles.heroTypedWrap}>
            <Text aria-hidden style={[styles.heroTyped, styles.heroTypedGhost]}>
              {`${HERO_TITLE_LEAD} ${HERO_LONGEST_TAIL}`}
            </Text>
            <Animated.Text style={[styles.heroTyped, styles.heroTypedLive, cycle.enter]}>
              {HERO_TITLE_LEAD}{' '}
              <Text style={styles.heroTypedTail}>{HERO_PREPARED[cycle.current].tail}</Text>
            </Animated.Text>
          </View>

          {/* One row, cycling. The height is reserved by the wrapper so nothing
              below it moves as an item is replaced. */}
          <View ref={cycle.ref as never} style={styles.heroTicker}>
            {cycle.previous >= 0 ? (
              <Animated.View
                key={`out-${cycle.previous}`}
                style={[styles.heroTickerSlot, cycle.leave]}
                pointerEvents="none"
                aria-hidden>
                <HeroActivityRow item={HERO_PREPARED[cycle.previous]} styles={styles} />
              </Animated.View>
            ) : null}
            <Animated.View key={`in-${cycle.current}`} style={[styles.heroTickerSlot, cycle.enter]}>
              <HeroActivityRow item={HERO_PREPARED[cycle.current]} styles={styles} />
            </Animated.View>
          </View>
        </ConnectorSurface>
      </View>

      <View style={styles.heroTrust}>
        {HERO_TRUST.map((line) => (
          <Text key={line} style={styles.heroTrustText}>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

/**
 * Two compositions, one hero. Split into separate components rather than
 * branched inside one, so neither has to run the other's hooks — the phone
 * hero never builds a connector field, never mounts the photograph and never
 * measures a wire, and the wide composition is untouched by any of it.
 */
function Hero() {
  const styles = useStyles();
  const l = useLayout();
  const reduced = useReducedMotion();
  return (
    <>
      {l.isPhone ? <PhoneHero /> : <WideHero />}
      <HeroIntegrations styles={styles} reduced={reduced} />
    </>
  );
}

/** The hub is the only round node, so the wires stop at its edge not its box. */
const HERO_HUB = ['hub'];

const HERO_TITLE_LEAD = 'While you were away, FlowAgent prepared';
/** The tallest the headline can render — what the ghost copy reserves. */
const HERO_LONGEST_TAIL = HERO_PREPARED.reduce(
  (longest, item) => (item.tail.length > longest.length ? item.tail : longest),
  '',
);

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
  // separators, the decimal and the suffix all still come from here, and the
  // no-JS render prints the final figure.
  //
  // Six figures spanning the whole organisation, not four marketing ones. The
  // old row read revenue / qualified leads / deliverability / AI visibility,
  // which is a campaign scorecard however the heading above it is worded.
  const revenue = useCountUp(48290);
  const customers = useCountUp(1284);
  const work = useCountUp(326);
  const approvals = useCountUp(7);
  const saved = useCountUp(84);
  const systems = useCountUp(12);

  const metrics = [
    {
      label: "Revenue influenced",
      value: `$${revenue.value.toLocaleString("en-US")}`,
      delta: "↑ 18.4%",
      color: t.brand,
    },
    {
      label: "Customers served",
      value: customers.value.toLocaleString("en-US"),
      delta: "↑ 22%",
      color: t.violet,
    },
    { label: "Work completed", value: work.value.toLocaleString("en-US"), delta: "This week", color: t.green },
    // Not a win, so not in success green — an approval queue that reads as a
    // congratulation is the wrong signal on a page selling human oversight.
    { label: "Open approvals", value: `${approvals.value}`, delta: "Needs review", color: t.orange, quiet: true },
    { label: "Time saved", value: `${saved.value} hours`, delta: "This month", color: t.pink },
    { label: "Connected systems", value: `${systems.value}`, delta: "All healthy", color: t.brand },
  ];

  // All six counters hang off the *row container*, not off their own cards:
  // on phone the cards stack, and six separate thresholds would run the
  // figures one at a time as the visitor scrolled past each one.
  const counters = [revenue, customers, work, approvals, saved, systems];
  const countersRef = useRef(counters);
  countersRef.current = counters;
  const attachCounters = useCallback((node: View | null) => {
    countersRef.current.forEach((counter) => {
      (counter.ref as { current: unknown }).current = node;
    });
  }, []);

  // Three, not six across: a metric card carries a label, a figure, a note and
  // a sparkline, and six of them on one line leaves each about 230px.
  //
  // Two on a phone, not one. Six full-width rows of label/figure/sparkline is
  // half a screen of identical bars; paired, the six read as one stat block —
  // and the sparkline comes out, because at 163px it is the part of the card
  // that has to be squeezed and the figure is the part that matters.
  const columns = l.isPhone ? 2 : l.isCompact ? 2 : 3;
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
                <Text numberOfLines={1} style={item.quiet ? styles.metricNote : styles.metricDelta}>
                  {item.delta}
                </Text>
              </View>
              {l.isPhone ? null : <Sparkline color={item.color} />}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Every dashboard panel is numbered by the Dashboard, never by itself. */
type PanelProps = { number: string };

/**
 * Six different organisations, one queue.
 *
 * This panel used to be "Next best actions": SMS to cart abandoners, Instagram
 * comments, a win-back sequence, an ad set and a product recommendation, each
 * with a dollar figure. Five marketing tactics in the lead panel of the lead
 * dashboard is the whole "marketing suite" impression in one card.
 */
function AcrossOrganization({ number }: PanelProps) {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const rows: [string, string, string, string][] = [
    ["file-invoice-dollar", t.violet, "Tax service", "12 clients missing required documents"],
    ["hand-holding-heart", t.pink, "Elder-care provider", "3 visits still need caregiver coverage"],
    ["cart-shopping", t.green, "Shopify store", "37 abandoned carts ready for recovery"],
    ["chart-pie", t.brand, "NGO", "Monthly donor impact report prepared"],
    ["briefcase", t.orange, "Professional service", "5 proposals awaiting approval"],
    ["location-dot", t.brand, "Local business", "8 listings need updated holiday hours"],
  ];
  return (
    <Panel number={number} title="Across your organization">
      {/* Four on a phone, six wide. The panel makes its point — one queue,
          several kinds of organisation — at four; the last two are breadth,
          and breadth is what a phone can least afford. */}
      {rows.slice(0, l.isPhone ? 4 : rows.length).map(([icon, color, org, detail], index) => (
        <Reveal key={org} delay={index * 70} distance={10} style={styles.orgRow}>
          <View style={[styles.miniIcon, { backgroundColor: color }]}>
            <FontAwesome6 name={icon as never} size={10} color={t.textOnBrand}  aria-hidden={true}/>
          </View>
          <View style={styles.orgCopy}>
            <Text numberOfLines={1} style={styles.orgName}>
              {org}
            </Text>
            {/* two lines: at three columns these details are wider than the cell */}
            <Text numberOfLines={2} style={styles.orgDetail}>
              {detail}
            </Text>
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
                <FontAwesome6 name={icon as never} size={15} color={t.textOnBrand}  aria-hidden={true}/>
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
        {/* The name, the address and the history are printed immediately to the
            right of this avatar. Labelling it would read the person's name
            twice, so it is decorative. */}
        <ImageAsset
          source={require("../../assets/images/v5/customer-sarah-johnson.png")}
          style={styles.customerPhoto}
          contentFit="cover"
          alt=""
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
           aria-hidden={true}/>
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
      {/* Matches the "Open approvals 7" figure in the metric row above — two
          numbers for the same thing on one screen must agree. */}
      <Text style={styles.queueBadge}>7 actions awaiting approval</Text>
      {[
        "Document reminders to 12 tax clients",
        "Caregiver coverage for 3 open visits",
        "Holiday hours across 8 listings",
      ].map((row) => (
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
  { key: "actions", Component: AcrossOrganization },
  { key: "journey", Component: JourneyPanel },
  { key: "queue", Component: ApprovalQueuePanel },
];

const FULL_PANELS: PanelDef[] = [
  { key: "actions", Component: AcrossOrganization },
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
  //
  // The one section on this page that keeps its card, and the exception the
  // rule is written around: this *is* a product surface — a picture of the
  // dashboard — so the border is the screen's own edge, not decoration.
  return (
    <OpenSection>
      <Reveal distance={22} style={styles.dashboardOuter}>
        <View style={styles.dashboardTitleRow}>
          <View style={styles.dashboardTitleCopy}>
            <Heading level={2} style={styles.dashboardTitle}>
              Business Command Center
            </Heading>
            <Text numberOfLines={l.isPhone ? 2 : undefined} style={styles.dashboardSub}>
              See what needs attention, what FlowAgent completed, and how your organization is performing.
            </Text>
          </View>
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
               aria-hidden={true}/>
            ))}
          </View>
          <Text style={styles.integrationsNote}>All your channels. One intelligent system.</Text>
        </View>
      </Reveal>
    </OpenSection>
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
  const open = useOpenSection();
  return (
    <Reveal style={[open, styles.featureSection]}>
      <View style={styles.featureCopy}>
        <SectionLabel>FLOWSHOP</SectionLabel>
        <Heading level={2} style={styles.featureTitle}>
          Build once. Sell everywhere customers and AI agents shop.
        </Heading>
        <Text numberOfLines={l.isPhone ? 3 : undefined} style={styles.featureBody}>
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
              <FontAwesome6 name="bars" size={15} color={t.textMuted}  aria-hidden={true}/>
              <Text style={styles.storePanelTitle}>FlowShop</Text>
            </View>
            <View style={styles.storefrontTools}>
              {["magnifying-glass", "user", "cart-shopping"].map((icon) => (
                <FontAwesome6 key={icon} name={icon as never} size={15} color={t.textMuted}  aria-hidden={true}/>
              ))}
            </View>
          </View>
          <View style={styles.productGrid}>
            {/* Two on a phone, four wide. At 50% each, four products is two
                rows of 155px squares — half a screen of catalogue inside what
                is only a picture of a storefront. One row still says
                "storefront"; the second row only says "more of the same". */}
            {(l.isPhone ? products.slice(0, 2) : products).map((product) => (
              <View key={product.name} style={styles.productCard}>
                {/* The card prints the product name, price and rating right
                    below the photo, so the photo adds no fact a reader would
                    otherwise miss — and an alt here would announce the name a
                    second time. Decorative. */}
                <ImageAsset
                  source={product.image}
                  style={styles.productImage}
                  contentFit="contain"
                  transition={180}
                  alt=""
                />
                <Text numberOfLines={l.isPhone ? 1 : 2} style={styles.productName}>
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
  const open = useOpenSection();
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
    <Reveal style={[open, styles.featureSection]}>
      <View style={styles.featureCopy}>
        <SectionLabel>UNIFIED CUSTOMER INTELLIGENCE</SectionLabel>
        <Heading level={2} style={styles.featureTitle}>
          Every interaction makes the next action smarter.
        </Heading>
        <Text numberOfLines={l.isPhone ? 3 : undefined} style={styles.featureBody}>
          FlowAgent learns from every signal to recommend the right next step for every customer.
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
        {/* Three separate bordered cards is three separate objects, and on a
            phone they arrive as three full-width slabs saying the same kind of
            thing. They are one object — a signal feed — so on a phone they are
            drawn as one: a single card holding three compact rows. */}
        {l.isPhone ? (
          <View style={styles.signalList}>
            {signals.map(([icon, color, title, note]) => (
              <View key={title} style={styles.signalRow}>
                <View style={[styles.signalRowIcon, { backgroundColor: hexToRgba(color, 0.14) }]}>
                  <FontAwesome6 name={icon as never} size={14} color={color}  aria-hidden={true}/>
                </View>
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
        ) : (
          <View style={styles.signalColumn}>
            {signals.map(([icon, color, title, note]) => (
              <View key={title} style={styles.signalCard}>
                <FontAwesome6 name={icon as never} size={20} color={color}  aria-hidden={true}/>
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
        )}
        <View style={styles.profileCard}>
          {/* The name is printed on the very next line — same reasoning as the
              unified-profile card: an avatar above its own caption is art. */}
          <ImageAsset
            source={require("../../assets/images/v5/customer-sarah-johnson.png")}
            style={styles.profilePhoto}
            contentFit="cover"
            alt=""
          />
          <Text style={styles.profileName}>Sarah Johnson</Text>
          <View style={styles.profileTags}>
            <Text style={styles.profileTag}>Loyal customer</Text>
            <Text style={styles.profileTag}>High value</Text>
          </View>
          {/* Three lines on a phone: identity, how to reach us, and how long
              they have been a customer. The last two are detail the wide card
              has room for and a 163px-tall column of meta rows does not. */}
          {profileMeta.slice(0, l.isPhone ? 3 : profileMeta.length).map(([icon, line]) => (
            <View key={line} style={styles.profileMetaRow}>
              <FontAwesome6
                name={icon as never}
                size={13}
                color={t.textSubtle}
                style={styles.profileMetaIcon}
               aria-hidden={true}/>
              <Text numberOfLines={1} style={styles.profileMetaText}>
                {line}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.recommendationCard}>
          <Text style={styles.recommendationBrand}>
            ✦ FlowAgent <Text style={styles.aiTitleLight}>recommendation</Text>
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
          {/* Three full-width blocks of one short phrase each is 160px of card
              spent on three words apiece. On a phone they are chips on a
              wrapping row — the same three reasons, one third of the height. */}
          {l.isPhone ? (
            <View style={styles.reasonRow}>
              {["Recent order", "SMS engagement", "Repeat buyer"].map((reason) => (
                <Text key={reason} numberOfLines={1} style={styles.reasonChip}>
                  ✓ {reason}
                </Text>
              ))}
            </View>
          ) : (
            ["Recent order", "SMS engagement", "Repeat buyer"].map((reason) => (
              <View key={reason} style={styles.reason}>
                <Text style={styles.reasonText}>✓ {reason}</Text>
              </View>
            ))
          )}
          {/* mockup chrome — this card illustrates FlowAgent's output */}
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
      title="The Agentic Business Operating System"
      // 159 chars — the readiness audit fails a description over 165.
      description="An agentic system that understands goals, coordinates tools and specialized agents, executes work within defined authority, and improves from verified results."
      footer="full"
      // The site root, so it carries the Organization and WebSite records as
      // well as its own breadcrumb.
      jsonLd={[
        organizationJsonLd(),
        webSiteJsonLd(),
        breadcrumbJsonLd([{ name: "Home", path: ROUTES.home }]),
      ]}>
      {/* The category claim first, then the breadth it covers, then who it is
          for, then the product itself — the proof only lands once a visitor
          knows what they are being shown. A channel is never named before the
          capability group that owns it. FlowAgent and the controls on it come
          as a pair, because an agentic claim without its governance is the
          overclaim this page exists to avoid. */}
      <Hero />
      <AnchorStatementSection />
      <CapabilityGroupsSection />
      <IndustriesSection />
      <Dashboard />
      <FlowAgentAlongsideSection />
      <ControlSection />
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
  /**
   * How far the hero scene reaches past the content column, so the photograph
   * touches both viewport edges. Measured, like every other full-bleed band —
   * a flat overrun leaves the scroll container reporting phantom width.
   */
  const heroBleed = Math.max(0, Math.round((l.width - BP.maxContent) / 2));
  const card = elevation(t, 1) as ViewStyle;
  const panelPad = l.isPhone ? 12 : 14;
  const gridGap = l.isPhone ? 10 : 12;

  /** a flex child that carries text and must be allowed to shrink */
  const fluid: ViewStyle = { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 };
  /** a flex child that fills its line once the layout has stacked */
  const stackedItem: ViewStyle = { flexGrow: 0, flexShrink: 0, flexBasis: "auto", width: "100%", minWidth: 0 };

  /** the shell every command-centre status pill shares */
  const statusPill: ViewStyle = {
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  };

  const chip = (bg: string, color: string): TextStyle => ({
    ...ty.caption,
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
    // The hero sits directly under the header, so its top stays tight; the
    // bottom carries the page's section rhythm like every open section below.
    hero: {
      paddingHorizontal: l.gutter,
      paddingTop: l.isPhone ? 20 : 28,
      paddingBottom: l.sectionSpace,
    },

    /* ---------------------------------------------------------------- */
    /* hero: the photograph, and the system running over it              */
    /* ---------------------------------------------------------------- */

    /*
     * The scene escapes the content column so the photograph reaches both
     * viewport edges — the same measured negative margin a tinted band uses.
     * A flat overrun would leave the scroller reporting phantom width.
     */
    heroScene: {
      position: 'relative',
      overflow: 'hidden',
      marginHorizontal: -heroBleed,
      paddingHorizontal: heroBleed + l.gutter,
      paddingTop: l.isPhone ? 34 : 52,
      paddingBottom: l.isPhone ? 74 : 84,
      justifyContent: 'center',
      // the photograph's own ground, for the moment before it decodes
      backgroundColor: `rgb(${t.scrimBase})`,
    },
    heroPhoto: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
    heroScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as ViewStyle,

    /*
     * On the photograph the ink is fixed, whatever the site theme is doing: a
     * scrim dark enough to carry AA text cannot also be a light surface. These
     * are the only values on the page that do not follow the theme, for the
     * same reason the logo and the growth swoosh do not.
     */
    heroBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.scrimGlassLine,
      backgroundColor: t.scrimGlass,
      backdropFilter: t.scrimGlassBlur,
      paddingHorizontal: 13,
      paddingVertical: 7,
    },
    heroLiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.scrimGood },
    heroBadgeText: {
      ...ty.caption,
      color: t.textOnScrim,
      fontWeight: '800',
      letterSpacing: 1.1,
    },
    heroTypedWrap: { position: 'relative', alignSelf: 'stretch' },
    heroTyped: { ...ty.caption, color: t.scrimTextMuted, fontWeight: '700' },
    heroTypedGhost: { opacity: 0 },
    heroTypedLive: { position: 'absolute', top: 0, left: 0, right: 0 },
    heroTypedTail: { color: t.scrimAccent },
    heroMetric: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
    heroMetricValue: {
      ...ty.h3,
      color: t.scrimText,
      fontVariant: ['tabular-nums'],
    },
    heroMetricLabel: { ...ty.caption, color: t.scrimTextFaint },
    heroTrust: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: l.isPhone ? 12 : 26,
      paddingHorizontal: heroBleed + l.gutter,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: t.scrimGlassLine,
    },
    heroTrustText: { ...ty.caption, color: t.scrimTextFaint },

    /* ---------------------------------------------------------------- */
    /* hero: the phone composition                                       */
    /* ---------------------------------------------------------------- */

    /*
     * Every reading element here is on the page's own ground and takes the
     * ordinary theme tokens. The photograph exists — see `phoneScene` — but as
     * a bounded picture between the headline and the panel, never underneath
     * either of them, so none of these needs a scrim to be legible. The gutter
     * is supplied here because the hero sits outside `OpenSection`, exactly as
     * the wide scene does.
     */
    phoneHero: { paddingHorizontal: l.gutter, paddingTop: 18, paddingBottom: 24, gap: 16 },

    /* ---------------------------------------------------------------- */
    /* hero: the phone picture — the room, wired                         */
    /* ---------------------------------------------------------------- */

    /*
     * A CARD, not a ground. It stays inside the gutter and clips its own
     * corners, so the photograph is something the page contains rather than
     * something the page sits on — which is exactly the difference between the
     * wide composition (copy over a scrim) and this one (copy beside a
     * picture).
     */
    phoneScene: {
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: t.border,
      // the photograph's own ground, for the moment before it decodes
      backgroundColor: `rgb(${t.scrimBase})`,
    },
    phoneScenePhoto: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
    },
    phoneSceneScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as ViewStyle,
    phoneSceneField: { paddingHorizontal: 12, paddingVertical: 18 },
    phoneSceneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    /*
     * The chips hug the outer edges rather than filling their column, so every
     * wire has a visible run into the hub instead of stopping the moment it
     * leaves the tile.
     */
    phoneSceneColumnLeft: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      alignItems: 'flex-start',
      gap: 8,
    },
    phoneSceneColumnRight: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      alignItems: 'flex-end',
      gap: 8,
    },
    phoneSceneHub: {
      width: 56,
      height: 56,
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: 'auto',
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: palettes.dark.borderStrong,
      backgroundColor: palettes.dark.surfaceRaised,
    },
    phoneSceneHubMark: { width: 30, height: 30 },
    /*
     * OPAQUE, deliberately — see `PhoneSystemChip`. The wide hero's glass is a
     * 30% veil, which leaves the label's real ground unknowable and is what
     * failed here. These read as dark product plates dropped into the room,
     * and their ink is the dark palette's own, so the pairing is a designed
     * one in all three themes rather than a guess about the photograph.
     */
    phoneChip: {
      maxWidth: '100%',
      minHeight: 32,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palettes.dark.borderStrong,
      backgroundColor: palettes.dark.surfaceRaised,
    },
    phoneChipLabel: {
      ...ty.caption,
      color: palettes.dark.text,
      fontWeight: '700',
      flexShrink: 1,
      minWidth: 0,
    },
    phoneHeroTitle: { ...ty.display, color: t.text },
    phoneHeroBody: { ...ty.body, color: t.textMuted },

    /* the product surface — the phone hero's visual */
    phonePanel: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceRaised,
      padding: 12,
      gap: 8,
      ...card,
    },
    phonePanelHead: {
      minHeight: 34,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: t.divider,
    },
    phonePanelMark: {
      width: 28,
      height: 28,
      flexShrink: 0,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.brandSoft,
    },
    phonePanelTitle: { ...ty.caption, color: t.text, fontWeight: "800", flexGrow: 1, flexShrink: 1, minWidth: 0 },
    phonePanelLive: {
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      backgroundColor: t.successBg,
    },
    phonePanelLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.successText },
    phonePanelLiveText: { ...ty.caption, color: t.successText, fontWeight: "800" },
    // Two lines held open: the longest tail wraps to exactly two at 14/21 in
    // this panel, so the block never resizes as the sentence changes.
    phoneLead: { ...ty.caption, color: t.textMuted, minHeight: 42 },
    phoneLeadTail: { color: accentText(t.brand, t), fontWeight: "700" },
    // One row's worth of space. 14 padding + 2 border + a 28px icon tile.
    phoneTicker: { height: 44, alignSelf: "stretch", position: "relative" },
    phoneTickerSlot: { position: "absolute", top: 0, left: 0, right: 0 },
    // 44px, so a row that is only an illustration today is already the right
    // size the day it becomes a control.
    phoneRow: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      paddingHorizontal: 9,
      paddingVertical: 7,
      backgroundColor: t.surface,
    },
    phoneRowIcon: {
      width: 28,
      height: 28,
      flexShrink: 0,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
    },
    phoneRowText: { ...ty.caption, color: t.text, fontWeight: "700", flexGrow: 1, flexShrink: 1, minWidth: 0 },
    phoneRowPill: {
      ...ty.caption,
      color: t.successText,
      fontWeight: "800",
      backgroundColor: t.successBg,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 3,
      overflow: "hidden",
      flexShrink: 0,
    },
    phonePanelFoot: { marginTop: 2, paddingTop: 8, borderTopWidth: 1, borderTopColor: t.divider },
    phonePanelFootText: { ...ty.caption, color: t.textSubtle },

    // Two columns rather than four full-width lines: the markers are short
    // enough to pair up, and four stacked lines is a screen of list.
    phoneTrustGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 10, columnGap: 12 },
    phoneTrustItem: {
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: "47%",
      minWidth: 0,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 7,
    },
    phoneTrustIcon: { marginTop: 3 },
    phoneTrustText: { ...ty.caption, color: t.textSubtle, flexShrink: 1, minWidth: 0 },

    /*
     * The band under the photograph. It was empty page between the hero and
     * the first section; the software a business already runs belongs there —
     * it answers "will this fit what I have" before the copy has to.
     */
    heroLogoStrip: {
      marginHorizontal: -heroBleed,
      paddingVertical: l.isPhone ? 14 : 18,
      borderBottomWidth: 1,
      borderBottomColor: t.divider,
      backgroundColor: t.surfaceMuted,
      overflow: 'hidden',
    },
    heroLogoTrack: { flexDirection: 'row' },
    heroLogoRow: { flexDirection: 'row', alignItems: 'center', gap: l.isPhone ? 30 : 46, paddingHorizontal: l.isPhone ? 15 : 23 },
    heroLogo: { opacity: 0.7 },

    /* the live system, glass so the room reads through it */
    heroSystemField: stacked
      ? { width: '100%', minWidth: 0, height: 300, marginTop: 8 }
      : { ...fluid, flexGrow: 1, height: 380, alignSelf: 'flex-end', marginBottom: 4 },
    heroSystemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
    },
    heroSystemColumn: { gap: l.isPhone ? 14 : 26, alignItems: 'stretch' },
    heroSystem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: t.scrimGlassLine,
      backgroundColor: t.scrimGlass,
      backdropFilter: t.scrimGlassBlur,
      paddingHorizontal: 11,
      paddingVertical: 8,
    },
    heroSystemLabel: { ...ty.caption, color: t.textOnScrim, fontWeight: '700' },
    heroHub: {
      width: l.isPhone ? 88 : 108,
      height: l.isPhone ? 88 : 108,
      borderRadius: l.isPhone ? 44 : 54,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.scrimGlassLine,
      backgroundColor: t.scrimGlass,
      backdropFilter: t.scrimGlassBlur,
    },
    heroHubMark: { width: l.isPhone ? 46 : 56, height: l.isPhone ? 46 : 56 },

    // In flow under the wires, not floating over them: absolutely positioned
    // it landed across the hub and both bottom systems.
    //
    // ONE row's worth of space, held open. The outgoing and incoming rows are
    // both absolute inside it, so they cross over without the block resizing —
    // and the three permanently-stacked rows this replaces are gone with it.
    // 22 padding + 2 border + a 27px pill is 51; 52 covers the rounding.
    heroTicker: {
      height: 52,
      alignSelf: 'stretch',
      position: 'relative',
      flexGrow: 0,
      flexShrink: 0,
    },
    heroTickerSlot: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
    heroCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      maxWidth: 330,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.scrimGlassLine,
      backgroundColor: t.scrimGlass,
      backdropFilter: t.scrimGlassBlur,
      paddingHorizontal: 13,
      paddingVertical: 11,
    },
    // the highlight is the only thing the cycle moves; every card is legible
    // without it, so the block is complete with JavaScript off
    heroCardLit: { borderColor: t.scrimGlassLit, backgroundColor: t.scrimGlass },
    heroCardText: { ...ty.caption, color: t.textOnScrim, fontWeight: '700', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    heroCardPill: {
      ...ty.caption,
      color: t.scrimGood,
      fontWeight: '800',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.scrimGoodLine,
      backgroundColor: t.scrimGoodBg,
      paddingHorizontal: 9,
      paddingVertical: 3,
    },
    heroTop: stacked
      ? { flexDirection: "column", alignItems: "stretch", gap: 28 }
      : { flexDirection: "row", alignItems: "center", gap: 34 },
    heroCopy: stacked ? { ...stackedItem, gap: 14 } : { ...fluid, flexGrow: 0.95, gap: 16 },
    // On the photograph, not on the page ground: these two are white and
    // near-white by necessity, like the badge above them.
    heroTitle: { ...ty.display, color: t.scrimText, marginTop: 4, maxWidth: 640 },
    heroBody: { ...ty.body, color: t.scrimTextMuted, maxWidth: 620 },
    // "It can act." is the sentence the paragraph is built to reach, so it
    // carries the copy colour rather than the muted one around it.
    heroBodyLead: { color: t.scrimText, fontWeight: '700' },
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

    /* ---------- FlowAgent card ---------- */
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
    spark: { color: t.textOnBrand, fontSize: 18 , fontFamily: FONT_SANS },
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
    actionTitle: { ...ty.caption, color: t.text, fontWeight: "700" },
    // Wraps rather than squeezes: the pill drops to its own line instead of
    // clipping the note beside it.
    actionMeta: {
      marginTop: 3,
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      rowGap: 5,
      gap: 8,
    },
    // `flexBasis: "100%"`, deliberately — not the `fluid` shrink-to-fit used
    // everywhere else on this card. From a zero basis the note shrinks instead
    // of wrapping, and the hero split leaves it 54px at 1120 and 97px at 768:
    // wide enough to render, far too narrow to say "12 clients are missing
    // required documents", so it ellipsized at viewports *wider* than ones
    // where it fit. Owning the full line pushes the pill onto its own row.
    //
    // Full width rather than `auto`, because `auto` wraps per *note*: the one
    // short row ("37 customers left before checkout") kept its pill inline
    // while the three long ones dropped theirs, and four rows of a mockup that
    // disagree about where the status sits read as a bug.
    actionNote: {
      ...ty.caption,
      color: t.textSubtle,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: "100%",
      minWidth: 0,
    },
    actionRealIcon: {
      width: 30,
      height: 30,
      flexShrink: 0,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
    },
    // Three tones for one shape. The pill is the only thing on the row that
    // says whether FlowAgent is waiting on a human, so "Approval required" is
    // deliberately the one that does not read as green-and-finished.
    pillReady: { ...statusPill, backgroundColor: t.successBg },
    pillReadyText: { ...ty.caption, color: t.successText, fontWeight: "700" },
    pillWarn: { ...statusPill, backgroundColor: t.warnBg },
    pillWarnText: { ...ty.caption, color: t.warnText, fontWeight: "700" },
    pillInfo: { ...statusPill, backgroundColor: t.chipBg },
    pillInfoText: { ...ty.caption, color: t.chipText, fontWeight: "700" },
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
    mockButtonLabel: { ...ty.caption, color: t.textOnBrand, lineHeight: 18, fontWeight: "700" },
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
    approvalText: { ...ty.caption, color: t.textSubtle, flexShrink: 1, minWidth: 0 },

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
      //
      // Side by side the cap is hard rather than absent: this column does not
      // shrink, so without one the "Also connected" line sets the panel's width
      // from its own longest line and squeezes the FlowAgent card next to it
      // down to ~275px. 320 is the map (266) plus its padding, with enough
      // slack for that line to wrap inside the panel instead of widening it.
      maxWidth: l.isPhone ? 460 : heroFill ? 470 : 320,
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
    channelPanelTitle: { ...ty.caption, color: t.text, fontWeight: "800", flexShrink: 1, minWidth: 0 },
    channelPanelPill: chip(t.successBg, t.successText),
    // Names the six systems the map does not have room to wire. Text rather
    // than another row of tiles: twelve tiles in a hero panel is a wall, and
    // the point of the line is breadth, not another six things to look at.
    channelMore: {
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: t.divider,
      gap: 4,
    },
    channelMoreLabel: { ...ty.caption, color: t.text, fontWeight: "700" },
    channelMoreText: { ...ty.caption, color: t.textSubtle },
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
    channelPanelFootText: { ...ty.caption, color: t.textSubtle, flexShrink: 1, minWidth: 0 },

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
    channelLabel: { ...ty.caption, color: t.textMuted, textAlign: "center" },
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
    // No margins of its own — the OpenSection around it supplies the gutter
    // and the vertical rhythm, so this card spaces like every other section.
    dashboardOuter: {
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
    dashboardTitleCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 240, gap: 4 },
    dashboardTitle: { ...ty.h4, color: t.text },
    dashboardSub: { ...ty.caption, color: t.textSubtle, maxWidth: 560 },
    dashboardFilter: {
      ...ty.caption,
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
    // Phone: a stat tile, two to a row, with no sparkline beside the figure.
    // Wide: the original row, label block left and sparkline right.
    metricCard: {
      ...fluid,
      minHeight: l.isPhone ? 0 : 76,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: l.isPhone ? 11 : 14,
      paddingVertical: 10,
      flexDirection: l.isPhone ? "column" : "row",
      alignItems: l.isPhone ? "flex-start" : "center",
      justifyContent: l.isPhone ? "flex-start" : "space-between",
      gap: l.isPhone ? 0 : 10,
    },
    metricCopy: { flexShrink: 1, minWidth: 0 },
    metricLabel: { ...ty.caption, color: t.textMuted },
    metricValue: { ...ty.h3, color: t.text, marginTop: 2 },
    metricDelta: { ...ty.caption, color: t.successText, marginTop: 2 },
    /** for a figure that is a queue rather than a gain — see `quiet` above */
    metricNote: { ...ty.caption, color: t.textSubtle, marginTop: 2 },
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
      fontSize: ty.caption.fontSize,
      fontFamily: FONT_SANS,
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
    dataLabel: { ...ty.caption, color: t.textMuted, flexShrink: 1, minWidth: 0 },
    dataValue: { ...ty.caption, color: t.text, fontWeight: "700", textAlign: "right", flexShrink: 0 },

    // Two lines per row (organisation, then what is waiting there), so the icon
    // sits against the top rather than floating beside a wrapped detail.
    orgRow: { minHeight: 34, flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 3 },
    orgCopy: { ...fluid },
    orgName: { ...ty.caption, color: t.text, fontWeight: "700" },
    orgDetail: { ...ty.caption, color: t.textSubtle, marginTop: 1 },
    miniIcon: {
      width: 20,
      height: 20,
      flexShrink: 0,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
    },

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
    journeyLabel: { ...ty.caption, color: t.textMuted, textAlign: "center", marginTop: 6 },
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
    statLabel: { ...ty.caption, color: t.textSubtle, minHeight: 32 },
    statValue: { ...ty.caption, color: t.text, fontWeight: "800", marginTop: 3 },
    statValueBrand: { ...ty.caption, color: accentText(t.brand, t), fontWeight: "800", marginTop: 3 },

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
    customerSub: { ...ty.caption, color: t.textSubtle, marginTop: 1 },
    recommendation: {
      marginTop: 6,
      backgroundColor: t.surfaceMuted,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 9,
      padding: 8,
    },
    recommendLabel: { ...ty.caption, color: t.textSubtle },
    recommendValue: { ...ty.caption, color: accentText(t.brand, t), fontWeight: "700", marginTop: 2 },

    trustRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    trustCheck: { fontWeight: "900", fontSize: ty.caption.fontSize, flexShrink: 0 , fontFamily: FONT_SANS },
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
    scoreSmall: { ...ty.caption, color: t.textSubtle },
    catalog: { ...fluid },
    catalogLabel: { ...ty.caption, color: t.textMuted },
    catalogValue: { ...ty.h4, color: t.text, marginTop: 2 },
    progress: { height: 6, backgroundColor: t.surfaceInset, borderRadius: 4, marginTop: 8 },
    progressFill: { width: "92%", height: 6, backgroundColor: t.brand, borderRadius: 4 },
    shopLabel: { ...ty.caption, color: t.textMuted, marginTop: 10 },
    shopBrandRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 6 },

    queueBadge: { ...chip(t.warnBg, t.warnText), alignSelf: "flex-start", marginBottom: 4 },
    queueRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 28 },
    queueLabel: { ...ty.caption, color: t.textMuted, flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    queueApprove: {
      flexShrink: 0,
      borderRadius: 6,
      backgroundColor: t.brand,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    queueApproveText: { ...ty.caption, color: t.textOnBrand, fontWeight: "700" },
    queueEdit: {
      flexShrink: 0,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    queueEditText: { ...ty.caption, color: t.textMuted, fontWeight: "700" },

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
    integrationsTitle: { ...ty.caption, color: t.text, fontWeight: "700" },
    dashboardBrandRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: l.isPhone ? 16 : 22,
    },
    integrationsNote: { ...ty.caption, color: t.textSubtle, textAlign: l.isPhone ? "center" : "right" },

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
    // The reserved second line exists so four cards in a row end level; with a
    // single row of two on a phone there is nothing to level against.
    productName: { ...ty.caption, color: t.text, minHeight: l.isPhone ? 0 : 32, marginTop: 8 },
    productPrice: { ...ty.caption, color: t.text, fontWeight: "800", marginTop: 2 },
    productStars: { ...ty.caption, color: t.orangeText, marginTop: 4 },
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
    // Phone: one card, three rows — not three cards.
    signalList: {
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: "auto",
      width: "100%",
      minWidth: 0,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      padding: 12,
      gap: 4,
      ...card,
    },
    signalRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10 },
    signalRowIcon: {
      width: 30,
      height: 30,
      flexShrink: 0,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
    },
    signalCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    signalTitle: { ...ty.caption, color: t.text, fontWeight: "800" },
    signalNote: { ...ty.caption, color: t.textMuted, marginTop: 4 },

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
      width: l.isPhone ? 76 : 124,
      height: l.isPhone ? 76 : 124,
      borderRadius: l.isPhone ? 38 : 62,
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
    revenueBrand: { ...ty.h3, color: accentText(t.brand, t) },
    confidence: { ...ty.h3, color: t.successText },
    reason: { padding: 11, borderRadius: 10, backgroundColor: t.surfaceMuted },
    reasonText: { ...ty.caption, color: t.text, fontWeight: "600" },
    reasonRow: { flexDirection: "row", flexWrap: "wrap", rowGap: 8, columnGap: 8 },
    reasonChip: {
      ...ty.caption,
      color: t.text,
      fontWeight: "600",
      backgroundColor: t.surfaceMuted,
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 5,
      overflow: "hidden",
      flexShrink: 1,
      minWidth: 0,
    },
  });
}
