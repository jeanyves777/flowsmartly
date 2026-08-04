import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import { Fragment, useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { ArrowLink } from '@/components/public/connectors';
import { FOOTER_GROUPS, LEGAL_LINKS, ROUTES } from '@/components/public/nav';
import { Animated, Reveal, Stagger, useCountUp, useGrowIn } from '@/components/public/motion';
import {
  Heading,
  PrimaryButton,
  SecondaryButton,
  SectionLabel,
  useSectionShell,
  useTypeScale,
} from '@/components/public/ui';
import { contactHref, EXTERNAL } from '@/lib/destinations';
import { brandColor, elevation, hexToRgba, softFill, type ThemeTokens } from '@/theme/tokens';
import { BP, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

type Plan = {
  name: string;
  price: string;
  credits: string;
  features: string[];
  featured?: boolean;
};

export type V5PublicFooterProps = {
  showProof?: boolean;
  showIntegrations?: boolean;
  showPricing?: boolean;
  showCta?: boolean;
  testimonial?: { quote: string; name: string; role: string };
  onStartFree?: () => void;
  onBookDemo?: () => void;
};

const integrations = [
  ['instagram', 'Instagram', '#e1306c'],
  ['facebook-f', 'Facebook', '#1877f2'],
  ['tiktok', 'TikTok', '#111111'],
  ['linkedin-in', 'LinkedIn', '#0a66c2'],
  ['youtube', 'YouTube', '#ff0000'],
  ['google', 'Google', '#4285f4'],
  ['whatsapp', 'WhatsApp', '#16b857'],
  ['envelope', 'Email', '#0878f9'],
  ['comment-dots', 'SMS', '#12b858'],
  ['stripe', 'Stripe', '#635bff'],
  ['shopify', 'Shopify', '#72a942'],
  ['wordpress', 'WordPress', '#21759b'],
] as const;

/**
 * The social profiles we actually publish — the same list the Organization
 * JSON-LD claims as `sameAs`. The integration shelf above is a list of channels
 * the product connects to, not places FlowSmartly posts, so it is not reused
 * here: a tile that opens nothing is worse than one fewer tile.
 */
const socialProfiles = [
  ['instagram', 'FlowSmartly on Instagram', '#e1306c', 'https://www.instagram.com/flowsmartly'],
  ['linkedin-in', 'FlowSmartly on LinkedIn', '#0a66c2', 'https://www.linkedin.com/company/flowsmartly'],
  ['youtube', 'FlowSmartly on YouTube', '#ff0000', 'https://www.youtube.com/@flowsmartly'],
] as const;

const metrics = [
  ['rocket', '6×', 'Faster campaign launches', 'vs. disconnected workflows'],
  ['users', '22%', 'More qualified leads', 'from connected engagement'],
  ['envelope', '98.7%', 'Message deliverability', '30-day average'],
  ['chart-column', '18.4%', 'Revenue influenced', 'across connected channels'],
] as const;

/** the nine sparkline bars behind every metric, in px */
const TREND = [10, 16, 13, 23, 17, 25, 20, 29, 36] as const;

const comparisons = [
  ['wrench', '5 tools', '1 workspace'],
  ['clock', '3 days', '4 hours'],
  ['database', 'Scattered data', 'One customer view'],
] as const;

const plans: Plan[] = [
  {
    name: 'Starter',
    price: 'Free',
    credits: '500 credits monthly',
    features: [
      'AI Studio & basic templates',
      'Social, Email & SMS',
      'Basic analytics',
      'Community support',
    ],
  },
  {
    name: 'Pro',
    price: '$20',
    credits: '1,500 credits monthly',
    featured: true,
    features: [
      'Everything in Starter',
      'AI recommendations',
      'Audience & journey builder',
      'Priority email support',
    ],
  },
  {
    name: 'Business',
    price: '$50',
    credits: '4,000 credits monthly',
    features: [
      'Everything in Pro',
      'Advanced analytics',
      'Team permissions',
      'Phone & priority support',
    ],
  },
];


/**
 * The FlowSmartly signature swoosh on the growth CTA. Brand colours, so they
 * are deliberately theme-invariant — like the logo, the mark should read the
 * same in light, charcoal and dark.
 */
const SIGNATURE = { wedge: '#ff9700', arc: '#ffc21a' } as const;

/** One themed stylesheet for the whole footer stack. */
function useFooterStyles() {
  const t = useTokens();
  const l = useLayout();
  return useMemo(() => createStyles(t, l), [t, l]);
}

/**
 * A brand glyph on an explicit tile. Official logo colours only stay correct on
 * a surface we control, and near-black marks (TikTok) are swapped for the
 * foreground colour on dark themes.
 *
 * Without an `onPress` it renders as a plain View: the integration shelf's
 * tiles are illustration, and a tile that looks tappable but does nothing is
 * worse than one that plainly does not.
 */
function BrandTile({
  icon,
  color,
  size,
  label,
  onPress,
}: {
  icon: string;
  color: string;
  size: number;
  label: string;
  onPress?: () => void;
}) {
  const t = useTokens();
  const styles = useFooterStyles();
  const glyph = (
    <FontAwesome6 name={icon as never} size={Math.round(size * 0.42)} color={brandColor(color, t)} />
  );

  if (!onPress) {
    return (
      <View accessibilityLabel={label} style={[styles.brandTile, { width: size, height: size }]}>
        {glyph}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.brandTile, { width: size, height: size, opacity: pressed ? 0.7 : 1 }]}>
      {glyph}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* outcomes + testimonial                                              */
/* ------------------------------------------------------------------ */

/**
 * Splits a headline figure into the part that can count and the part that must
 * not ("6×" → 6 + "×", "98.7%" → 98.7 + "%" at one decimal). Returns null for
 * anything that does not start with a number, so the caller can print the
 * string untouched rather than animating nonsense.
 */
function splitMetric(value: string): { amount: number; suffix: string; decimals: number } | null {
  const match = /^(\d+(?:\.\d+)?)(.*)$/.exec(value);
  if (!match) return null;
  const [, digits, suffix] = match;
  const dot = digits.indexOf('.');
  return { amount: Number(digits), suffix, decimals: dot < 0 ? 0 : digits.length - dot - 1 };
}

/**
 * One sparkline bar. The card owns a single grow-in value and every bar reads
 * it, offset a little by its index so the row sweeps left to right instead of
 * popping as a block. `start` is normalised so the last bar still lands exactly
 * on its full height when the shared progress reaches 1.
 */
function TrendBar({
  height,
  index,
  color,
  progress,
}: {
  height: number;
  index: number;
  color: string;
  progress: SharedValue<number>;
}) {
  const styles = useFooterStyles();
  const animated = useAnimatedStyle(() => {
    const start = index * 0.045;
    const local = Math.min(1, Math.max(0, (progress.value - start) / (1 - start)));
    // never fully collapse: a 2px baseline keeps the row from reflowing
    return { height: Math.max(2, height * local) };
  }, [height, index]);
  return (
    // The full height is in the static style as well as the animated one, so a
    // render without JS still draws the finished sparkline.
    <Animated.View
      style={[
        styles.trendBar,
        { height, backgroundColor: color, opacity: 0.22 + index * 0.08 },
        animated,
      ]}
    />
  );
}

function MetricCard({
  icon,
  value,
  caption,
  detail,
  accent,
  index,
}: {
  icon: string;
  value: string;
  caption: string;
  detail: string;
  accent: string;
  index: number;
}) {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const styles = useFooterStyles();

  const parsed = useMemo(() => splitMetric(value), [value]);
  const count = useCountUp(parsed?.amount ?? 0, { decimals: parsed?.decimals ?? 0, duration: 1100 });
  // Each card's bars start a beat after the one before it, so the four sets do
  // not all fire on the same frame.
  const grow = useGrowIn({ duration: 620, delay: index * 90 });

  return (
    <>
      <View style={styles.metricTop}>
        <View style={[styles.metricIcon, { backgroundColor: softFill(accent, t) }]}>
          <FontAwesome6 name={icon as never} size={l.isPhone ? 20 : 24} color={accent} />
        </View>
        <Text
          ref={count.ref as never}
          style={[type.h2, styles.metricValue, { color: accent }]}
          numberOfLines={1}>
          {parsed ? `${count.value.toFixed(parsed.decimals)}${parsed.suffix}` : value}
        </Text>
      </View>
      <Text style={[type.h4, styles.metricCaption]}>{caption}</Text>
      <Text style={[type.caption, styles.metricDetail]}>{detail}</Text>
      <View ref={grow.ref as never} style={styles.trend}>
        {TREND.map((height, bar) => (
          <TrendBar key={bar} height={height} index={bar} color={accent} progress={grow.progress} />
        ))}
      </View>
    </>
  );
}

export function OutcomesProof({ testimonial }: Pick<V5PublicFooterProps, 'testimonial'>) {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const shell = useSectionShell();
  const styles = useFooterStyles();
  const router = useRouter();

  // On phone the 34px arrow cell + its gaps ate ~42px of a ~294px table, which
  // pushed "One customer view" past two lines and made that row taller than the
  // other two. The headings already say before/after, so the arrow is desktop-only.
  const showArrow = !l.isPhone;

  const quote =
    testimonial?.quote ??
    'FlowSmartly shows us what to do next—and lets our team approve it before it happens.';
  const name = testimonial?.name ?? 'Maya Chen';
  const role = testimonial?.role ?? 'Founder, Northline Studio';

  return (
    <View style={[shell, styles.outcomesSection]}>
      <Reveal style={styles.outcomeHeading}>
        <View style={styles.labelCenter}>
          <SectionLabel>OUTCOMES THAT MATTER</SectionLabel>
        </View>
        <Heading level={2} style={[type.display, styles.outcomesHeadingText]}>
          One connected growth stack. Real business outcomes.
        </Heading>
        <Text style={[type.body, styles.outcomesSub]}>
          See how connected signals, approved actions, and consistent follow-through compound into
          measurable growth.
        </Text>
      </Reveal>

      <View style={styles.metricGrid}>
        {/* The Reveal is the grid cell, so the card style lives on it. */}
        <Stagger step={90} style={styles.metricCard}>
          {metrics.map(([icon, value, caption, detail], index) => (
            <MetricCard
              key={caption}
              icon={icon}
              value={value}
              caption={caption}
              detail={detail}
              accent={index % 2 ? t.violet : t.brand}
              index={index}
            />
          ))}
        </Stagger>
      </View>

      <Reveal style={styles.storyPanel}>
        <View style={styles.storyTop}>
          <View style={styles.storyCol}>
            <View style={styles.storyPerson}>
              <Image
                source={require('../../../assets/images/v5/customer-sarah-johnson.png')}
                style={styles.storyPhoto}
                contentFit="cover"
              />
              <View style={styles.storyPersonCopy}>
                <Text style={[type.h4, styles.storyName]} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={[type.caption, styles.storyRole]} numberOfLines={2}>
                  {role}
                </Text>
              </View>
            </View>
            <Text style={[type.h3, styles.storyQuote]}>“{quote}”</Text>
          </View>

          <View style={styles.comparison}>
            <View style={styles.comparisonRow}>
              <Text style={[type.caption, styles.beforeHead]} numberOfLines={1}>
                Before FlowSmartly
              </Text>
              {showArrow ? <View style={styles.arrowCell} /> : null}
              <Text style={[type.caption, styles.afterHead]} numberOfLines={1}>
                With FlowSmartly
              </Text>
            </View>
            <Stagger
              step={80}
              delay={140}
              distance={14}
              style={[styles.comparisonRow, styles.comparisonRowBody]}>
              {comparisons.map(([icon, before, after]) => (
                <Fragment key={before}>
                  <View style={styles.comparisonItem}>
                    <FontAwesome6 name={icon} size={14} color={t.textSubtle} />
                    <Text style={[type.bodySm, styles.comparisonText]} numberOfLines={2}>
                      {before}
                    </Text>
                  </View>
                  {showArrow ? (
                    <View style={styles.arrowCell}>
                      <ArrowLink width={46} color={t.textSubtle} />
                    </View>
                  ) : null}
                  <View style={[styles.comparisonItem, styles.comparisonItemAfter]}>
                    <View style={styles.comparisonCheck}>
                      <FontAwesome6 name="check" size={11} color={t.violet} />
                    </View>
                    <Text style={[type.bodySm, styles.comparisonText, styles.comparisonAfter]} numberOfLines={2}>
                      {after}
                    </Text>
                  </View>
                </Fragment>
              ))}
            </Stagger>
          </View>
        </View>

        <View style={styles.storyCta}>
          <PrimaryButton
            label="Read customer stories"
            icon="arrow-right"
            iconRight
            size="md"
            full={l.isPhone}
            trackId="footer.outcomes.customer-stories"
            onPress={() => router.push(ROUTES.customers as never)}
          />
        </View>
      </Reveal>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* integrations (kept for API compatibility — not rendered by default) */
/* ------------------------------------------------------------------ */

export function IntegrationShelf() {
  const type = useTypeScale();
  const shell = useSectionShell();
  const styles = useFooterStyles();
  const router = useRouter();
  return (
    <View style={shell}>
      <View style={styles.shelfHeader}>
        <View style={styles.shelfHeaderCopy}>
          <SectionLabel>INTEGRATIONS</SectionLabel>
          <Heading level={2} style={[type.h1, styles.shelfHeading]}>
            Connect the channels you already use.
          </Heading>
          <Text style={[type.body, styles.shelfSub]}>
            Your data stays connected. Your workflow stays in one place.
          </Text>
        </View>
        <SecondaryButton
          label="View integrations"
          size="md"
          trackId="footer.shelf.view-integrations"
          onPress={() => router.push(ROUTES.integrations as never)}
        />
      </View>
      <View style={styles.integrationRow}>
        {integrations.map(([icon, label, color]) => (
          <View key={label} style={styles.integration}>
            <BrandTile icon={icon} color={color} size={58} label={label} />
            <Text style={[type.micro, styles.integrationLabel]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* pricing                                                             */
/* ------------------------------------------------------------------ */

export function PricingShelf({ onStartFree }: Pick<V5PublicFooterProps, 'onStartFree'>) {
  const t = useTokens();
  const type = useTypeScale();
  const shell = useSectionShell();
  const styles = useFooterStyles();
  // The product lives outside this app, so signup is the honest default for
  // every plan CTA unless the host page overrides it.
  const startFree = onStartFree ?? (() => Linking.openURL(EXTERNAL.signup));
  return (
    <View style={shell}>
      <Reveal>
        <SectionLabel>PRICING</SectionLabel>
        <Heading level={2} style={[type.h1, styles.shelfHeading]}>
          Start lean. Scale when growth demands it.
        </Heading>
      </Reveal>
      <View style={styles.planRow}>
        {/* Not <Stagger>: the featured card carries its own style and its own
            settle, so each card gets an explicit Reveal. */}
        {plans.map((plan, index) => (
          <Reveal
            key={plan.name}
            delay={index * 100}
            scale={plan.featured}
            style={plan.featured ? [styles.plan, styles.planFeatured] : styles.plan}>
            <View style={styles.planHead}>
              <Text style={[type.h4, styles.planName]} numberOfLines={1}>
                {plan.name}
              </Text>
              {plan.featured ? (
                <Text style={[type.micro, styles.popular]} numberOfLines={1}>
                  Most popular
                </Text>
              ) : null}
            </View>
            <Text style={[type.h2, styles.planPrice]} numberOfLines={1}>
              {plan.price}
              <Text style={styles.perMonth}>{plan.price !== 'Free' ? ' /mo' : ''}</Text>
            </Text>
            <Text style={[type.caption, styles.credits]} numberOfLines={1}>
              {plan.credits}
            </Text>
            <View style={styles.features}>
              {plan.features.map((feature) => (
                <View key={feature} style={styles.featureRow}>
                  <FontAwesome6 name="check" size={12} color={t.successText} />
                  <Text style={[type.bodySm, styles.feature]}>{feature}</Text>
                </View>
              ))}
            </View>
            <PrimaryButton
              label={plan.price === 'Free' ? 'Start free' : `Choose ${plan.name}`}
              size="sm"
              full
              trackId={`footer.pricing.${plan.name.toLowerCase()}`}
              onPress={startFree}
            />
          </Reveal>
        ))}
      </View>
      <Text style={[type.caption, styles.planNote]}>
        All plans include human-approved AI and can be canceled anytime.
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* growth CTA                                                          */
/* ------------------------------------------------------------------ */

/**
 * The signature swoosh, sweeping in from the corner it lives in — once, as the
 * banner reveals. The banner clips its overflow, so the mark slides out of the
 * corner rather than off the page. Never loops: it is a brand mark, not an
 * animation.
 */
function SignatureMark({ width, height }: { width: number; height: number }) {
  const styles = useFooterStyles();
  const sweep = useGrowIn({ duration: 620, delay: 240 });
  const animated = useAnimatedStyle(() => {
    const p = sweep.progress.value;
    return { opacity: p, transform: [{ translateX: (1 - p) * 44 }, { translateY: (1 - p) * 28 }] };
  });
  return (
    <Animated.View
      ref={sweep.ref as never}
      style={[styles.ctaSignature, animated]}
      pointerEvents="none">
      <Svg
        width={width}
        height={height}
        viewBox="0 0 220 140"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Path d="M220 0V140H95C153 119 192 74 220 0Z" fill={SIGNATURE.wedge} />
        <Path
          d="M220 0C194 67 157 111 103 140"
          fill="none"
          stroke={SIGNATURE.arc}
          strokeWidth={3}
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

export function GrowthCta({ onStartFree, onBookDemo }: Pick<V5PublicFooterProps, 'onStartFree' | 'onBookDemo'>) {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const styles = useFooterStyles();
  const router = useRouter();
  // Defaults, so the site-wide CTA works on every page rather than only on the
  // ones that remember to pass handlers. There is no demo video: a demo is a
  // conversation, so it goes to Contact with the topic preselected.
  const startFree = onStartFree ?? (() => Linking.openURL(EXTERNAL.signup));
  const bookDemo = onBookDemo ?? (() => router.push(contactHref('demo') as never));
  // Sized to clear the action panel that sits over the banner's right side, so
  // the signature still reads as a corner mark rather than a sliver.
  const signature = l.isPhone
    ? { width: 150, height: 95 }
    : l.isTablet
      ? { width: 240, height: 153 }
      : { width: 330, height: 210 };
  return (
    // The banner reveals as one unit — the copy and the action panel belong to
    // the same object, so nothing inside it moves separately.
    <Reveal>
      <LinearGradient
        colors={[t.ctaGradient[0], t.ctaGradient[1], t.ctaGradient[2]]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.cta}>
        {/* Deepens the gradient so the white copy clears 4.5:1 on the light first
          stop (#008cf8 scored 3.44:1, grey 4.00:1). Painted first, so every
          sibling below renders on top of it. */}
        <View style={styles.ctaScrim} pointerEvents="none" />
        {/* Signature swoosh, painted over the scrim but under the copy/panel. */}
        <SignatureMark width={signature.width} height={signature.height} />
        <View style={styles.ctaCopy}>
          <View style={styles.ctaSpark}>
            <FontAwesome6 name="wand-magic-sparkles" size={l.isPhone ? 22 : 26} color={t.textOnBrand} />
          </View>
          <Heading level={2} style={[type.h2, styles.ctaTitle]}>
            Ready to turn every signal into growth?
          </Heading>
          <Text style={[type.body, styles.ctaBody]}>
            Start with one campaign. FlowSmartly connects what happens next.
          </Text>
        </View>
        <View style={styles.ctaPanel}>
          <PrimaryButton
            label="Start growing free"
            size="md"
            full
            trackId="footer.cta.start-free"
            onPress={startFree}
          />
          <SecondaryButton
            label="Book a demo"
            size="md"
            full
            trackId="footer.cta.book-demo"
            onPress={bookDemo}
          />
          <Text style={[type.caption, styles.ctaProof]}>
            No credit card • Human-approved AI • Upgrade anytime
          </Text>
        </View>
      </LinearGradient>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* navigation                                                          */
/* ------------------------------------------------------------------ */

export function FooterNavigation() {
  const t = useTokens();
  const type = useTypeScale();
  const shell = useSectionShell();
  const styles = useFooterStyles();
  const router = useRouter();
  return (
    <View style={[shell, styles.navigation]}>
      <View style={styles.brandColumn}>
        <Image
          source={require('../../../assets/images/v5/flowsmartly-logo.png')}
          style={styles.logo}
          contentFit="contain"
          contentPosition="left"
        />
        <Text style={[type.bodySm, styles.tagline]}>Create, sell, and grow with AI.</Text>
        <View style={styles.socials}>
          {socialProfiles.map(([icon, label, color, url]) => (
            <BrandTile
              key={label}
              icon={icon}
              color={color}
              size={44}
              label={label}
              onPress={() => Linking.openURL(url)}
            />
          ))}
        </View>

        {/*
          The brand rail used to end at the social tiles, leaving ~244px of void
          beside the six link columns on every page. These two rows are the two
          things a visitor plausibly wants from a footer that the link columns do
          not already give them: a way to hear about releases, and the live state
          of the platform. Not a second newsletter form — the field lives on
          Resources; this is a link to the same honest destination.
        */}
        <View style={styles.brandExtras}>
          <Text style={[type.bodySm, styles.extraTitle]}>Product updates</Text>
          <Text style={[type.caption, styles.extraNote]}>
            One email a month: what shipped, what changed, and one thing worth trying.
          </Text>
          <SecondaryButton
            label="Get product updates"
            icon="envelope-open-text"
            size="md"
            full
            trackId="footer.nav.product-updates"
            onPress={() => router.push(contactHref('updates') as never)}
          />
          <Link href={ROUTES.status as never} asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="All systems operational — open the status page"
              style={({ pressed }) => [styles.statusPill, pressed ? styles.statusPillPressed : null]}>
              <View style={styles.statusDot} />
              <Text style={[type.caption, styles.statusText]} numberOfLines={1}>
                All systems operational
              </Text>
              <FontAwesome6 name="arrow-right" size={11} color={t.successText} />
            </Pressable>
          </Link>
        </View>
      </View>
      <View style={styles.linkGroups}>
        {FOOTER_GROUPS.map((group) => (
          <View key={group.title} style={styles.linkGroup}>
            <Text style={[type.bodySm, styles.groupTitle]} numberOfLines={1}>
              {group.title}
            </Text>
            {group.links.map((link) => (
              <Link key={link.href} href={link.href as never} asChild>
                <Pressable accessibilityRole="link" style={styles.linkRow}>
                  {/* two lines fit inside the 44px row, so a long label ("Agent
                      Marketplace") wraps in a narrow column instead of clipping */}
                  <Text style={[type.bodySm, styles.link]} numberOfLines={2}>
                    {link.label}
                  </Text>
                </Pressable>
              </Link>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* root                                                                */
/* ------------------------------------------------------------------ */

export function V5PublicFooter({
  showProof = true,
  showIntegrations = true,
  showPricing = true,
  showCta = true,
  testimonial,
  onStartFree,
  onBookDemo,
}: V5PublicFooterProps) {
  const type = useTypeScale();
  const styles = useFooterStyles();
  return (
    <View style={styles.root}>
      {showProof && <OutcomesProof testimonial={testimonial} />}
      {showIntegrations && <IntegrationShelf />}
      {showPricing && <PricingShelf onStartFree={onStartFree} />}
      {showCta && <GrowthCta onStartFree={onStartFree} onBookDemo={onBookDemo} />}
      <FooterNavigation />
      <View style={styles.bottom}>
        <Text style={[type.caption, styles.bottomText]}>© 2026 FlowSmartly. All rights reserved.</Text>
        <View style={styles.legalRow}>
          {LEGAL_LINKS.map((link, index) => (
            <Fragment key={link.href}>
              {index > 0 ? <View style={styles.legalDivider} /> : null}
              <Link href={link.href as never} asChild>
                <Pressable accessibilityRole="link" style={styles.legalLink}>
                  <Text style={[type.caption, styles.legalLinkText]} numberOfLines={1}>
                    {link.label}
                  </Text>
                </Pressable>
              </Link>
            </Fragment>
          ))}
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

/** the brand rail of the footer nav — wide enough for six 44px social tiles */
const BRAND_COLUMN = 304;

function createStyles(t: ThemeTokens, l: Layout) {
  const phone = l.isPhone;
  /** the story panel and the nav split into two rails above this width */
  const stacked = l.isStacked;
  const gridGap = phone ? 12 : 18;

  /** usable width inside a section card (the page itself caps at maxContent) */
  const contentWidth = Math.max(
    280,
    Math.min(l.width, BP.maxContent) - l.gutter * 2 - l.sectionPad * 2,
  );

  /**
   * Percentage basis for one cell of an `n`-column wrapped grid, with the px
   * gaps discounted, so a cell can be pinned to its column width instead of
   * growing. A trailing card used to stretch across its whole row (the 768px
   * Business plan spanning 677px next to two 330px cards) — cells now keep the
   * grid, and a short last row simply leaves the empty cells empty.
   * Percentages resolve against the real container, so a scrollbar or a stray
   * pixel can never push the last cell onto a new line.
   */
  const cellPct = (columns: number, gap: number, container = contentWidth): `${number}%` => {
    if (columns <= 1) return '100%';
    const gapPct = ((gap * (columns - 1)) / container) * 100;
    const pct = Math.max(10, Math.floor(((100 - gapPct - 0.5) / columns) * 100) / 100);
    return `${pct}%` as `${number}%`;
  };

  // 4 metrics: 1-up on phone, 2-up while the page is stacked, 4-up above it.
  // `gridColumns(4)` caps at 3 between 1024 and 1440, which would orphan the
  // fourth card on its own row, so the count uses the shared `isStacked` flag
  // (BP.split) rather than a per-section width threshold.
  const metricColumns = phone ? 1 : stacked ? 2 : 4;
  const metricBasis = metricColumns === 1 ? '100%' : metricColumns === 2 ? '48%' : '23%';

  // 3 plans: 1-up on phone, 2-up on tablet, 3-up from 1024. In the 2-up band
  // the third card holds its column width instead of stretching to the full row.
  const planColumns = l.gridColumns(3);
  const planBasis = cellPct(planColumns, gridGap);

  // 4 nav groups: 2-up on phone, 4-up above it — both divide evenly, so no row
  // is ever left with a single stretched group. Legal lives in the bottom bar.
  // Six groups divide evenly at 2 / 3 / 6, so a wrapped row is never short.
  const navColumns = phone ? 2 : l.isStacked ? 3 : 6;
  const navBasis = cellPct(
    navColumns,
    18,
    stacked ? contentWidth : Math.max(240, contentWidth - BRAND_COLUMN - 28),
  );

  const photo = phone ? 76 : l.isCompact ? 92 : 120;

  return StyleSheet.create({
    root: { paddingBottom: l.sectionGap * 2 },

    /* -------------------------------------------------- outcomes */
    outcomesSection: { gap: gridGap + 6 },
    outcomeHeading: { alignItems: 'center', gap: 10 },
    labelCenter: { alignSelf: 'center' },
    outcomesHeadingText: { textAlign: 'center', maxWidth: 860, alignSelf: 'center' },
    outcomesSub: { textAlign: 'center', maxWidth: 720, alignSelf: 'center' },

    metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: gridGap },
    metricCard: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: metricBasis,
      minWidth: 0,
      gap: 6,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceRaised,
      padding: phone ? 16 : 20,
    },
    metricTop: { flexDirection: 'row', alignItems: 'center', gap: 14, minWidth: 0 },
    metricIcon: {
      width: phone ? 44 : 52,
      height: phone ? 44 : 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      flexGrow: 0,
      flexShrink: 0,
    },
    metricValue: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
    metricCaption: { marginTop: 8 },
    metricDetail: { color: t.textSubtle },
    trend: { height: 48, flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 10 },
    trendBar: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 6, maxWidth: 22, borderRadius: 3 },

    /* -------------------------------------------------- story panel */
    storyPanel: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceMuted,
      padding: phone ? 16 : 22,
      gap: 20,
    },
    storyTop: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'stretch',
      gap: stacked ? 20 : 28,
    },
    storyCol: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: stacked ? 'auto' : 0,
      width: stacked ? '100%' : undefined,
      minWidth: 0,
      gap: 16,
    },
    storyPerson: { flexDirection: 'row', alignItems: 'center', gap: 14, minWidth: 0 },
    storyPhoto: { width: photo, height: photo, borderRadius: 18, flexGrow: 0, flexShrink: 0 },
    storyPersonCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 2 },
    storyName: { color: t.text },
    storyRole: { color: t.textMuted },
    storyQuote: { color: t.text, fontWeight: '700' },

    comparison: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: stacked ? 'auto' : 0,
      width: stacked ? '100%' : undefined,
      minWidth: 0,
      borderLeftWidth: stacked ? 0 : 1,
      borderLeftColor: t.divider,
      borderTopWidth: stacked ? 1 : 0,
      borderTopColor: t.divider,
      paddingLeft: stacked ? 0 : 26,
      paddingTop: stacked ? 18 : 0,
    },
    comparisonRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 8 },
    // Every body row is the same height whether its value takes one line or
    // two, so the three rows keep their rhythm.
    comparisonRowBody: { borderTopWidth: 1, borderTopColor: t.divider, minHeight: phone ? 54 : 48 },
    comparisonItem: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },
    // The "after" value is the payoff and carries a 24px check, so on phone it
    // gets the wider share of the table.
    comparisonItemAfter: { flexGrow: phone ? 1.3 : 1 },
    comparisonText: { flexGrow: 1, flexShrink: 1, minWidth: 0, color: t.textMuted },
    comparisonAfter: { color: t.text, fontWeight: '600' },
    comparisonCheck: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: softFill(t.violet, t),
      alignItems: 'center',
      justifyContent: 'center',
      flexGrow: 0,
      flexShrink: 0,
    },
    arrowCell: {
      width: phone ? 34 : 46,
      flexGrow: 0,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    beforeHead: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, color: t.textSubtle, fontWeight: '700' },
    afterHead: {
      flexGrow: phone ? 1.3 : 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      color: t.violet,
      fontWeight: '700',
    },
    storyCta: { alignItems: 'flex-start' },

    /* -------------------------------------------------- shelves */
    shelfHeader: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'flex-start' : 'flex-end',
      justifyContent: 'space-between',
      gap: 18,
    },
    shelfHeaderCopy: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: stacked ? 'auto' : 0,
      width: stacked ? '100%' : undefined,
      minWidth: 0,
      gap: 10,
    },
    shelfHeading: { marginTop: 12 },
    shelfSub: { maxWidth: 620 },
    integrationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 20 },
    integration: { alignItems: 'center', gap: 7, width: 72 },
    integrationLabel: { color: t.textMuted, textAlign: 'center' },
    brandTile: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },

    /* -------------------------------------------------- pricing */
    planRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
      alignItems: 'stretch',
      gap: gridGap,
      marginTop: 22,
    },
    plan: {
      // no flexGrow: at 2-up the trailing Business card must stay one column
      // wide instead of stretching across the full row.
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: planBasis,
      maxWidth: planBasis,
      minWidth: 0,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceRaised,
      padding: phone ? 18 : 20,
      gap: 4,
    },
    planFeatured: {
      borderWidth: 2,
      borderColor: t.violet,
      ...(elevation(t, 2) as ViewStyle),
    },
    planHead: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
    planName: { flexShrink: 1, minWidth: 0 },
    popular: {
      flexGrow: 0,
      flexShrink: 0,
      color: t.chipText,
      backgroundColor: t.chipBg,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 3,
      fontWeight: '700',
      overflow: 'hidden',
    },
    planPrice: { marginTop: 4 },
    perMonth: { fontSize: 13, fontWeight: '600', color: t.textSubtle },
    credits: { color: t.textSubtle },
    features: { gap: 9, marginTop: 16, marginBottom: 18 },
    featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, minWidth: 0 },
    feature: { flexGrow: 1, flexShrink: 1, minWidth: 0, color: t.textMuted },
    planNote: { marginTop: 14, color: t.textSubtle },

    /* -------------------------------------------------- CTA */
    cta: {
      marginHorizontal: l.gutter,
      marginTop: l.sectionGap,
      borderRadius: l.radius,
      padding: l.sectionPad,
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'center',
      gap: stacked ? 20 : 30,
      overflow: 'hidden',
    },
    ctaScrim: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: hexToRgba(t.shadowColor, 0.22),
    },
    ctaSignature: { position: 'absolute', right: 0, bottom: 0 },
    ctaCopy: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: stacked ? 'auto' : 0,
      width: stacked ? '100%' : undefined,
      minWidth: 0,
      gap: 10,
    },
    ctaSpark: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: hexToRgba(t.textOnBrand, 0.18),
      marginBottom: 4,
    },
    ctaTitle: { color: t.textOnBrand },
    // full-strength ink: at 17px this is "small text" for contrast purposes
    ctaBody: { color: t.textOnBrand, maxWidth: 560 },
    ctaPanel: {
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: 'auto',
      width: stacked ? '100%' : 300,
      minWidth: 0,
      gap: 10,
      borderRadius: 16,
      backgroundColor: t.surface,
      padding: 16,
      ...(elevation(t, 2) as ViewStyle),
    },
    ctaProof: { textAlign: 'center', color: t.textSubtle },

    /* -------------------------------------------------- navigation */
    navigation: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: 28,
    },
    brandColumn: {
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: 'auto',
      // Wide enough for all six 44px social tiles on one line — at 260 the
      // last one wrapped onto a row of its own.
      width: stacked ? '100%' : BRAND_COLUMN,
      minWidth: 0,
      gap: 14,
    },
    logo: { width: 170, height: 42 },
    tagline: { color: t.textMuted },
    socials: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    /** the updates + status block that keeps the brand rail from ending short */
    brandExtras: {
      marginTop: 4,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: t.divider,
      gap: 10,
      // On a stacked footer the rail is full width; the block reads better held
      // to the same measure it has beside the link columns.
      maxWidth: stacked ? 420 : undefined,
    },
    extraTitle: { color: t.text, fontWeight: '800' },
    extraNote: { color: t.textMuted },
    statusPill: {
      minHeight: 44,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingHorizontal: 13,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.successBg,
    },
    statusPillPressed: { opacity: 0.85 },
    statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.successText },
    statusText: { color: t.successText, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    linkGroups: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: stacked ? 'auto' : 0,
      width: stacked ? '100%' : undefined,
      minWidth: 0,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-start',
      gap: 18,
    },
    linkGroup: {
      // held to the column width so a wrapped group lines up with the group
      // above it instead of growing to half the footer.
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: navBasis,
      maxWidth: navBasis,
      minWidth: 0,
    },
    groupTitle: { color: t.text, fontWeight: '800', marginBottom: 6 },
    linkRow: { minHeight: 44, justifyContent: 'center' },
    link: { color: t.textMuted },

    /* -------------------------------------------------- bottom bar */
    bottom: {
      marginHorizontal: l.gutter,
      marginTop: l.sectionGap,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: l.radius,
      backgroundColor: t.surface,
      paddingHorizontal: l.sectionPad,
      paddingVertical: 8,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: phone ? 4 : 10,
    },
    bottomText: { color: t.textSubtle },
    // The legal links used to be one run-on string; each is now its own 44px
    // target, separated by a rule rather than a word space.
    legalRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 2 },
    legalLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8, borderRadius: 8 },
    legalLinkText: { color: t.textMuted },
    legalDivider: { width: 1, height: 12, backgroundColor: t.borderStrong },
  });
}
