import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type ImageStyle,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { BrandLogo } from '@/components/public/brand-logo';
import { Connectors, ConnectorSurface, useConnectorField, type Link as Wire } from '@/components/public/connectors';
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
  Section,
  SectionLabel,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { EXTERNAL } from '@/lib/destinations';
import { elevation, hexToRgba, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

type Accent = 'brand' | 'violet' | 'orange' | 'green' | 'pink';

const PROOF = ['Every listing in one place', 'Reviews answered in minutes', 'Built for AI answers'];

const RAIL: { key: string; icon: string; label: string }[] = [
  { key: 'overview', icon: 'gauge-high', label: 'Overview' },
  { key: 'locations', icon: 'map-location-dot', label: 'Locations' },
  { key: 'listings', icon: 'rectangle-list', label: 'Listings' },
  { key: 'reviews', icon: 'star', label: 'Reviews' },
  { key: 'pages', icon: 'file-lines', label: 'Local pages' },
  { key: 'ai', icon: 'robot', label: 'AI visibility' },
  { key: 'analytics', icon: 'chart-column', label: 'Analytics' },
  { key: 'insights', icon: 'lightbulb', label: 'Insights' },
  { key: 'actions', icon: 'list-check', label: 'Actions' },
  { key: 'settings', icon: 'gear', label: 'Settings' },
];

const HEALTH_COUNTS: { key: string; label: string; value: number; accent: Accent }[] = [
  { key: 'accurate', label: 'Accurate', value: 142, accent: 'green' },
  { key: 'warnings', label: 'Warnings', value: 8, accent: 'orange' },
  { key: 'errors', label: 'Errors', value: 3, accent: 'pink' },
];

const AI_VISIBILITY: { key: string; brand: string; name: string; level: string; value: number; accent: Accent }[] = [
  { key: 'google', brand: 'google', name: 'Google', level: 'Very high', value: 94, accent: 'green' },
  { key: 'chatgpt', brand: 'chatgpt', name: 'ChatGPT', level: 'High', value: 81, accent: 'brand' },
  { key: 'bing', brand: 'bing', name: 'Bing', level: 'High', value: 78, accent: 'violet' },
  { key: 'local', brand: 'apple', name: 'Local discovery', level: 'High', value: 85, accent: 'orange' },
];

const HERO_LOCATIONS: { key: string; name: string; city: string; state: string; ok: boolean }[] = [
  { key: 'river-north', name: 'River North', city: 'Chicago, IL', state: 'All listings accurate', ok: true },
  { key: 'lincoln-park', name: 'Lincoln Park', city: 'Chicago, IL', state: 'Hours missing on 1', ok: false },
  { key: 'evanston', name: 'Evanston', city: 'Evanston, IL', state: 'All listings accurate', ok: true },
  { key: 'oak-park', name: 'Oak Park', city: 'Oak Park, IL', state: 'All listings accurate', ok: true },
];

/* 01 — publishers */
const PUBLISHERS_TOP: { key: string; brand: string; label: string }[] = [
  { key: 'google', brand: 'google', label: 'Google' },
  { key: 'apple', brand: 'apple', label: 'Apple Maps' },
  { key: 'facebook', brand: 'facebook', label: 'Facebook' },
  { key: 'wordpress', brand: 'wordpress', label: 'WordPress' },
];

const PUBLISHERS_BOTTOM: { key: string; brand: string; label: string }[] = [
  { key: 'bing', brand: 'bing', label: 'Bing Places' },
  { key: 'yelp', brand: 'yelp', label: 'Yelp' },
  { key: 'waze', brand: 'waze', label: 'Waze' },
  { key: 'directories', brand: 'directories', label: 'Directories' },
];

const SYNC_POINTS = [
  'Change your hours once — every publisher follows',
  'Photos, categories and services pushed the same way',
  'Overwrites are detected and put back automatically',
  'A written record of what changed, where and when',
];

/* 02 — knowledge profile */
const PROFILE_FIELDS: { key: string; icon: string; label: string; value: string }[] = [
  { key: 'name', icon: 'signature', label: 'Business name', value: 'Luxe Salons — River North' },
  { key: 'categories', icon: 'tags', label: 'Categories', value: 'Hair salon • Colour specialist • Spa' },
  { key: 'hours', icon: 'clock', label: 'Hours', value: 'Weekly hours + 9 holiday exceptions' },
  { key: 'services', icon: 'scissors', label: 'Services & pricing', value: '24 services with prices and duration' },
  { key: 'attributes', icon: 'wheelchair', label: 'Attributes', value: 'Step-free access • Parking • Gender-neutral' },
  { key: 'payments', icon: 'credit-card', label: 'Payments', value: 'Cards, wallets, gift cards' },
  { key: 'description', icon: 'align-left', label: 'Description', value: 'Written once, published everywhere' },
  { key: 'photos', icon: 'image', label: 'Photos', value: '24 tagged and dated' },
];

/* 03 — duplicates */
type Duplicate = {
  key: string;
  title: string;
  reason: string;
  sources: { key: string; brand: string; label: string; detail: string }[];
};

const DUPLICATES: Duplicate[] = [
  {
    key: 'river-north',
    title: 'Luxe Salons — River North',
    reason: 'Same phone number, 40 m apart',
    sources: [
      { key: 'google', brand: 'google', label: 'Google Business Profile', detail: '412 N Wells St • claimed' },
      { key: 'yelp', brand: 'yelp', label: 'Yelp', detail: '410 N Wells St • unclaimed' },
    ],
  },
  {
    key: 'evanston',
    title: 'Luxe Salons Evanston',
    reason: 'Old suite number still published',
    sources: [
      { key: 'apple', brand: 'apple', label: 'Apple Maps', detail: '1720 Sherman Ave, Ste 4' },
      { key: 'bing', brand: 'bing', label: 'Bing Places', detail: '1720 Sherman Ave, Ste 2' },
    ],
  },
];

const LISTING_ERRORS: { key: string; label: string; where: string; severity: 'error' | 'warning' }[] = [
  { key: 'phone', label: 'Phone number differs', where: '2 publishers • Lincoln Park', severity: 'error' },
  { key: 'hours', label: 'Holiday hours missing', where: '1 publisher • Oak Park', severity: 'warning' },
  { key: 'category', label: 'Primary category mismatch', where: '1 publisher • Evanston', severity: 'warning' },
];

/* 04 — reviews */
const REVIEW_STATS: { key: string; label: string; value: string; accent: Accent }[] = [
  { key: 'rating', label: 'Average rating', value: '4.8', accent: 'orange' },
  { key: 'response', label: 'Response rate', value: '96%', accent: 'green' },
  { key: 'time', label: 'Median reply time', value: '2.4h', accent: 'brand' },
];

/* 05 — local pages */
const PAGE_SERVICES: { key: string; label: string; price: string }[] = [
  { key: 'cut', label: 'Cut & style', price: 'from $65' },
  { key: 'colour', label: 'Colour & balayage', price: 'from $140' },
  { key: 'treatment', label: 'Gloss & treatments', price: 'from $45' },
];

const PAGE_POINTS = [
  'A real page per location, not one address in a footer',
  'Services, prices, hours and staff kept in sync with the profile',
  'Structured so search and assistants can quote it',
  'Enquiries land in your contacts with the location attached',
];

/* 06 — AI search visibility */
const WIN_RATES: { key: string; query: string; value: number; accent: Accent }[] = [
  { key: 'near-me', query: '“salon near me”', value: 62, accent: 'green' },
  { key: 'balayage', query: '“best balayage in Chicago”', value: 54, accent: 'brand' },
  { key: 'walk-in', query: '“walk-in haircut tonight”', value: 48, accent: 'violet' },
  { key: 'specialist', query: '“curly hair specialist”', value: 41, accent: 'orange' },
];

const AI_POINTS = [
  'Answers written for the questions people actually ask',
  'Facts an assistant can verify: hours, services, prices, access',
  'Fresh signals — reviews, photos and posts, kept current',
];

/* 07 — multi-location */
const LOCATION_HEALTH: { key: string; label: string; value: number; accent: Accent }[] = [
  { key: 'healthy', label: 'Fully accurate', value: 22, accent: 'green' },
  { key: 'attention', label: 'Needs attention', value: 4, accent: 'orange' },
  { key: 'errors', label: 'Errors to fix', value: 2, accent: 'pink' },
];

const LOCATION_ROWS: { key: string; name: string; city: string; score: number; accent: Accent }[] = [
  { key: 'river-north', name: 'River North', city: 'Chicago, IL', score: 98, accent: 'green' },
  { key: 'lincoln-park', name: 'Lincoln Park', city: 'Chicago, IL', score: 84, accent: 'orange' },
  { key: 'evanston', name: 'Evanston', city: 'Evanston, IL', score: 96, accent: 'green' },
  { key: 'oak-park', name: 'Oak Park', city: 'Oak Park, IL', score: 71, accent: 'pink' },
];

/* 08 — teams */
const TEAM: { key: string; media: string; name: string; role: string; scope: string; accent: Accent }[] = [
  { key: 'alex', media: 'people/alex-marshall', name: 'Alex Marshall', role: 'Owner', scope: 'All 28 locations', accent: 'brand' },
  { key: 'lena', media: 'people/lena-park', name: 'Lena Park', role: 'Regional manager', scope: '9 locations • Midwest', accent: 'violet' },
  { key: 'arjun', media: 'people/arjun-patel', name: 'Arjun Patel', role: 'Location manager', scope: 'River North', accent: 'green' },
  { key: 'michael', media: 'people/michael-reyes', name: 'Michael Reyes', role: 'Reviews responder', scope: 'Reviews only • all sites', accent: 'orange' },
];

const PERMISSIONS: { key: string; label: string; roles: [boolean, boolean, boolean, boolean] }[] = [
  { key: 'edit', label: 'Edit business data', roles: [true, true, true, false] },
  { key: 'publish', label: 'Publish to publishers', roles: [true, true, false, false] },
  { key: 'reviews', label: 'Reply to reviews', roles: [true, true, true, true] },
  { key: 'billing', label: 'Billing & team', roles: [true, false, false, false] },
];

const ROLE_LABELS = ['Owner', 'Regional', 'Location', 'Reviews'];

/* 09 — actions */
const ACTIONS: { key: string; icon: string; title: string; note: string; impact: string; effort: string; accent: Accent }[] = [
  {
    key: 'hours',
    icon: 'clock',
    title: 'Add holiday hours to 6 locations',
    note: 'Missing hours are the top cause of a wasted trip.',
    impact: '+312 visits',
    effort: '2 min',
    accent: 'brand',
  },
  {
    key: 'photos',
    icon: 'image',
    title: 'Publish 18 new interior photos',
    note: 'Listings with fresh photos are chosen more often.',
    impact: '+9% clicks',
    effort: '5 min',
    accent: 'violet',
  },
  {
    key: 'reviews',
    icon: 'star',
    title: 'Reply to 11 unanswered reviews',
    note: 'Drafts are written and waiting for approval.',
    impact: '+0.2 rating',
    effort: '6 min',
    accent: 'orange',
  },
  {
    key: 'services',
    icon: 'list-check',
    title: 'Add prices to 24 services',
    note: 'Priced services are quotable by assistants.',
    impact: '+14% AI answers',
    effort: '8 min',
    accent: 'green',
  },
];

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

type Styles = ReturnType<typeof createStyles>;

const NO_CIRCLES: string[] = [];

/** A progress ring drawn as real geometry. */
function ScoreRing({
  value,
  size,
  stroke,
  color,
  track,
  children,
}: {
  value: number;
  size: number;
  stroke: number;
  color: string;
  track: string;
  children: React.ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - Math.min(1, Math.max(0, value / 100)))}
          rotation={-90}
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
      {children}
    </View>
  );
}

/** Multi-segment donut — one arc per segment, sized by share of the total. */
function Donut({
  segments,
  size,
  stroke,
  track,
  children,
}: {
  segments: { key: string; value: number; color: string }[];
  size: number;
  stroke: number;
  track: string;
  children: React.ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;

  let consumed = 0;
  const arcs = segments.map((segment) => {
    const length = (segment.value / total) * circumference;
    const arc = { key: segment.key, color: segment.color, length, offset: -consumed };
    consumed += length;
    return arc;
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={track} strokeWidth={stroke} fill="none" />
        {arcs.map((arc) => (
          <Circle
            key={arc.key}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={arc.color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${Math.max(0, arc.length - 2)} ${circumference}`}
            strokeDashoffset={arc.offset}
            rotation={-90}
            originX={size / 2}
            originY={size / 2}
          />
        ))}
      </Svg>
      {children}
    </View>
  );
}

function Tick({ text, styles, t }: { text: string; styles: Styles; t: ThemeTokens }) {
  return (
    <View style={styles.tickRow}>
      <View style={styles.tickDot}>
        <FontAwesome6 name="check" size={9} color={t.green} />
      </View>
      <Text style={styles.tickText}>{text}</Text>
    </View>
  );
}

function Stars({ count, size, color }: { count: number; size: number; color: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {[0, 1, 2, 3, 4].map((index) => (
        <FontAwesome6 key={index} name="star" size={size} color={index < count ? color : hexToRgba(color, 0.28)} solid />
      ))}
    </View>
  );
}

/**
 * Button-shaped labels drawn inside a product mockup. They mirror
 * `PrimaryButton` / `SecondaryButton` at `sm` pixel for pixel — a mock control
 * that looks pressable and silently does nothing is worse than a static one, so
 * the look stays and only the interactivity goes.
 */
function MockPrimarySm({
  label,
  icon,
  full,
  t,
}: {
  label: string;
  icon: string;
  full?: boolean;
  t: ThemeTokens;
}) {
  return (
    <View
      style={[
        {
          minHeight: 40,
          borderRadius: 9,
          overflow: 'hidden',
          alignSelf: full ? 'stretch' : 'flex-start',
        },
        full ? { width: '100%' as const } : null,
        elevation(t, 1) as ViewStyle,
      ]}>
      <LinearGradient
        colors={[t.gradient[0], t.gradient[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          minHeight: 40,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
        }}>
        <FontAwesome6 name={icon as never} size={13} color={t.textOnBrand} />
        <Text style={{ color: t.textOnBrand, fontSize: 13, fontWeight: '700' }}>{label}</Text>
      </LinearGradient>
    </View>
  );
}

function MockSecondarySm({
  label,
  icon,
  full,
  t,
}: {
  label: string;
  icon: string;
  full?: boolean;
  t: ThemeTokens;
}) {
  return (
    <View
      style={[
        {
          minHeight: 40,
          borderRadius: 9,
          borderWidth: 1,
          borderColor: t.borderStrong,
          backgroundColor: t.surfaceRaised,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 9,
          alignSelf: full ? 'stretch' : 'flex-start',
        },
        full ? { width: '100%' as const } : null,
      ]}>
      <FontAwesome6 name={icon as never} size={13} color={t.text} />
      <Text style={{ color: t.text, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

function NumberedHead({
  index,
  eyebrow,
  title,
  body,
  styles,
  type,
  centered,
}: {
  index: number;
  eyebrow: string;
  title: string;
  body: string;
  styles: Styles;
  type: TypeScale;
  centered?: boolean;
}) {
  return (
    <View style={centered ? styles.headCentered : styles.headLeft}>
      <View style={styles.headTop}>
        <View style={styles.headNumber}>
          <Text style={styles.headNumberText}>{`0${index}`}</Text>
        </View>
        <SectionLabel>{eyebrow}</SectionLabel>
      </View>
      <Heading level={2} style={[type.h2, centered ? styles.headTitleCentered : styles.headTitle]}>
        {title}
      </Heading>
      <Text style={[type.body, centered ? styles.headBodyCentered : styles.headBody]}>{body}</Text>
    </View>
  );
}

function HealthCount({
  label,
  value,
  accent,
  styles,
}: {
  label: string;
  value: number;
  accent: string;
  styles: Styles;
}) {
  const counter = useCountUp(value);
  return (
    <View ref={counter.ref as never} style={styles.healthCountCell}>
      <View style={styles.healthCount}>
        <Text numberOfLines={1} style={[styles.healthCountValue, { color: accent }]}>
          {Math.round(counter.value).toLocaleString('en-US')}
        </Text>
        <Text numberOfLines={1} style={styles.healthCountLabel}>
          {label}
        </Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function ListSmartlyPage() {
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

  const field = useConnectorField();
  const publishers = [...PUBLISHERS_TOP, ...PUBLISHERS_BOTTOM];
  const links = useMemo<Wire[]>(
    () => publishers.map((publisher) => ({ from: 'profile', to: publisher.key })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const renderPublisher = (publisher: { key: string; brand: string; label: string }) => (
    <View key={publisher.key} style={styles.publisherCell}>
      <View {...field.node(publisher.key)} style={styles.publisherTile}>
        <BrandLogo name={publisher.brand} size={19} label={publisher.label} />
        <Text numberOfLines={2} style={styles.publisherLabel}>
          {publisher.label}
        </Text>
      </View>
    </View>
  );

  return (
    <PageShell
      title="ListSmartly"
      description="ListSmartly keeps every location accurate across publishers, turns reviews into a strength, and makes your business the one AI search recommends."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Solutions', path: ROUTES.solutions },
          { name: 'ListSmartly', path: ROUTES.listsmartly },
        ]),
      ]}>
      {/* ------------------------------------------------ hero */}
      <Section>
        <View style={styles.heroRow}>
          <Reveal style={styles.heroCopy} distance={16}>
            <SectionLabel>LOCAL VISIBILITY FOR THE AI ERA</SectionLabel>
            <Heading level={1} style={[type.display, styles.heroTitle]}>
              Be accurate, trusted, and recommended everywhere.
            </Heading>
            <Text style={[type.body, styles.heroBody]}>
              One profile for your business, published to every map, directory and assistant — with
              reviews, local pages and AI visibility managed in the same place.
            </Text>
            <View style={styles.heroButtons}>
              <ButtonRow>
                <PrimaryButton
                  label="Check my listings"
                  size="lg"
                  full={l.isPhone}
                  icon="arrow-right"
                  iconRight
                  trackId="listsmartly.hero.check-listings"
                  onPress={() => Linking.openURL(EXTERNAL.signup)}
                />
                <SecondaryButton
                  label="Explore the platform"
                  size="lg"
                  full={l.isPhone}
                  trackId="listsmartly.hero.explore-platform"
                  onPress={() => router.push(ROUTES.product as never)}
                />
              </ButtonRow>
            </View>
            <View style={styles.proofRow}>
              {PROOF.map((item) => (
                <View key={item} style={styles.proofItem}>
                  <View style={styles.proofTick}>
                    <FontAwesome6 name="check" size={9} color={t.green} />
                  </View>
                  <Text numberOfLines={1} style={styles.proofText}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.heroVisual} distance={16} delay={90}>
            <View style={styles.dashboard}>
              <View style={styles.dashboardRow}>
                {/* left rail */}
                <View style={styles.rail}>
                  {RAIL.map((item, index) => {
                    const active = index === 0;
                    return (
                      <View key={item.key} style={[styles.railItem, active ? styles.railItemActive : null]}>
                        <FontAwesome6
                          name={item.icon as never}
                          size={12}
                          color={active ? t.brand : t.textSubtle}
                        />
                        <Text numberOfLines={1} style={[styles.railLabel, active ? styles.railLabelActive : null]}>
                          {item.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* main */}
                <View style={styles.dashMain}>
                  <View style={styles.dashHead}>
                    <View style={styles.dashHeadCopy}>
                      <Text numberOfLines={1} style={styles.dashTitle}>
                        Listing health
                      </Text>
                      <Text numberOfLines={1} style={styles.dashSub}>
                        153 listings • 28 locations
                      </Text>
                    </View>
                    <View style={styles.liveChip}>
                      <View style={styles.liveDot} />
                      <Text style={styles.liveText}>Syncing</Text>
                    </View>
                  </View>

                  <View style={styles.healthCard}>
                    <View style={styles.healthHead}>
                      <ScoreRing value={94} size={l.isPhone ? 84 : 96} stroke={9} color={t.green} track={t.surfaceInset}>
                        <View style={styles.ringCenter}>
                          <Text style={styles.ringValue}>94%</Text>
                          <Text style={styles.ringLabel}>Excellent</Text>
                        </View>
                      </ScoreRing>
                      <View style={styles.healthCounts}>
                        {HEALTH_COUNTS.map((count) => (
                          <HealthCount
                            key={count.key}
                            label={count.label}
                            value={count.value}
                            accent={accentOf(count.accent)}
                            styles={styles}
                          />
                        ))}
                      </View>
                    </View>
                  </View>

                  <View style={styles.visibilityCard}>
                    <Text style={styles.cardTitle}>AI visibility across platforms</Text>
                    <View style={styles.visibilityList}>
                      {AI_VISIBILITY.map((row) => {
                        const accent = accentOf(row.accent);
                        const width: DimensionValue = `${row.value}%`;
                        /* Phone: mark + name + level on one line, meter beneath.
                           Four columns inside a card this narrow left the name
                           in a 76px well — “Local discovery” did not survive. */
                        if (l.isPhone) {
                          return (
                            <View key={row.key} style={styles.visibilityRowStacked}>
                              <View style={styles.visibilityHead}>
                                <View style={styles.visibilityMark}>
                                  <BrandLogo name={row.brand} size={14} label={row.name} />
                                </View>
                                <Text numberOfLines={1} style={styles.visibilityName}>
                                  {row.name}
                                </Text>
                                <Text numberOfLines={1} style={styles.visibilityLevel}>
                                  {row.level}
                                </Text>
                              </View>
                              <View style={styles.visibilityTrack}>
                                <View style={[styles.visibilityFill, { width, backgroundColor: accent }]} />
                              </View>
                            </View>
                          );
                        }

                        return (
                          <View key={row.key} style={styles.visibilityRow}>
                            <View style={styles.visibilityMark}>
                              <BrandLogo name={row.brand} size={14} label={row.name} />
                            </View>
                            <Text numberOfLines={1} style={styles.visibilityName}>
                              {row.name}
                            </Text>
                            <View style={styles.visibilityTrack}>
                              <View style={[styles.visibilityFill, { width, backgroundColor: accent }]} />
                            </View>
                            <Text numberOfLines={1} style={styles.visibilityLevel}>
                              {row.level}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.locationsSplit}>
                    <View style={styles.locationsPanel}>
                      <Text style={styles.cardTitle}>Locations</Text>
                      <View style={styles.locationList}>
                        {HERO_LOCATIONS.map((location) => (
                          <View key={location.key} style={styles.locationRow}>
                            <View
                              style={[
                                styles.locationDot,
                                { backgroundColor: softFill(location.ok ? t.green : t.orange, t) },
                              ]}>
                              <FontAwesome6
                                name="location-dot"
                                size={10}
                                color={location.ok ? t.green : t.orange}
                              />
                            </View>
                            <View style={styles.locationCopy}>
                              <Text numberOfLines={1} style={styles.locationName}>
                                {location.name}
                              </Text>
                              <Text numberOfLines={1} style={styles.locationMeta}>
                                {location.city} • {location.state}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>

                    <View style={styles.mapPanel}>
                      <View style={styles.mapGridRow} />
                      <View style={styles.mapGridRowLower} />
                      <View style={styles.mapGridCol} />
                      <View style={styles.mapGridColRight} />
                      <View style={[styles.mapPin, styles.mapPinOne]}>
                        <FontAwesome6 name="location-dot" size={14} color={t.brand} />
                      </View>
                      <View style={[styles.mapPin, styles.mapPinTwo]}>
                        <FontAwesome6 name="location-dot" size={14} color={t.green} />
                      </View>
                      <View style={[styles.mapPin, styles.mapPinThree]}>
                        <FontAwesome6 name="location-dot" size={14} color={t.orange} />
                      </View>
                      <View style={styles.mapChip}>
                        <Text numberOfLines={1} style={styles.mapChipText}>
                          28 locations
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ 01 publishers */}
      <Section>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <NumberedHead
              index={1}
              eyebrow="ONE SOURCE OF TRUTH"
              title="Sync your business data across every publisher."
              body="Your name, address, phone, hours, categories, services and photos live in one profile — and ListSmartly keeps every map, directory and site holding the same answer."
              styles={styles}
              type={type}
            />
            <View style={styles.pointList}>
              {SYNC_POINTS.map((point) => (
                <Tick key={point} text={point} styles={styles} t={t} />
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={80}>
            <ConnectorSurface field={field} style={styles.syncField}>
              <Connectors field={field} links={links} color={t.brand} circular={NO_CIRCLES} strokeWidth={2} dash="0.5 6" flow />

              <View style={styles.publisherRow}>{PUBLISHERS_TOP.map(renderPublisher)}</View>

              <View {...field.node('profile')} style={styles.profileHub}>
                <View style={styles.profileHubIcon}>
                  <FontAwesome6 name="shield-halved" size={15} color={t.brand} />
                </View>
                <View style={styles.profileHubCopy}>
                  <Text numberOfLines={1} style={styles.profileHubTitle}>
                    Business profile
                  </Text>
                  <Text numberOfLines={1} style={styles.profileHubSub}>
                    Verified • last published 4 min ago
                  </Text>
                </View>
                <View style={styles.syncChip}>
                  <FontAwesome6 name="arrows-rotate" size={10} color={t.successText} />
                  <Text style={styles.syncChipText}>In sync</Text>
                </View>
              </View>

              <View style={styles.publisherRow}>{PUBLISHERS_BOTTOM.map(renderPublisher)}</View>
            </ConnectorSurface>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ 02 knowledge profile */}
      <Section>
        <View style={styles.splitRowReverse}>
          <Reveal style={styles.splitCopy} distance={16}>
            <NumberedHead
              index={2}
              eyebrow="BUSINESS KNOWLEDGE PROFILE"
              title="Build a verified profile of what you actually do."
              body="A listing says where you are. A knowledge profile says what you offer, who it is for, when you are open and what makes you the right choice — the detail an assistant needs before it will recommend you."
              styles={styles}
              type={type}
            />
            <View style={styles.verifyRow}>
              <View style={styles.verifyIcon}>
                <FontAwesome6 name="circle-check" size={14} color={t.green} />
              </View>
              <Text style={styles.verifyText}>
                Every field is verified against a source, and re-checked on a schedule.
              </Text>
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={80}>
            <View style={styles.panel}>
              <View style={styles.panelHead}>
                <Text style={styles.panelTitle}>Business profile</Text>
                <View style={styles.panelChip}>
                  <Text style={styles.panelChipText}>Verified 2 days ago</Text>
                </View>
              </View>
              <View style={styles.fieldList}>
                {PROFILE_FIELDS.map((fieldRow) => (
                  <View key={fieldRow.key} style={styles.fieldRow}>
                    <View style={styles.fieldIcon}>
                      <FontAwesome6 name={fieldRow.icon as never} size={12} color={t.brand} />
                    </View>
                    <View style={styles.fieldCopy}>
                      <Text numberOfLines={1} style={styles.fieldLabel}>
                        {fieldRow.label}
                      </Text>
                      <Text numberOfLines={2} style={styles.fieldValue}>
                        {fieldRow.value}
                      </Text>
                    </View>
                    <FontAwesome6 name="circle-check" size={13} color={t.green} />
                  </View>
                ))}
              </View>
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ 03 duplicates */}
      <Section>
        <NumberedHead
          index={3}
          eyebrow="ACCURACY"
          title="Find the duplicates and errors costing you visits."
          body="Two listings for the same shop split your reviews and confuse the map. ListSmartly flags them, shows the evidence, and merges the pair once you approve."
          styles={styles}
          type={type}
          centered
        />

        <View style={styles.duplicateGrid}>
          {DUPLICATES.map((duplicate, index) => (
            <Reveal key={duplicate.key} style={styles.duplicateCell} distance={16} delay={index * 80}>
              <View style={styles.duplicateCard}>
                <View style={styles.duplicateHead}>
                  <View style={styles.flagIcon}>
                    <FontAwesome6 name="triangle-exclamation" size={13} color={t.warnText} />
                  </View>
                  <View style={styles.duplicateCopy}>
                    {/* The "Duplicate" chip leaves ~156px on a phone, and
                        "Luxe Salons — River North" needs more than that. */}
                    <Text numberOfLines={l.isPhone ? 2 : 1} style={styles.duplicateTitle}>
                      {duplicate.title}
                    </Text>
                    <Text numberOfLines={1} style={styles.duplicateReason}>
                      {duplicate.reason}
                    </Text>
                  </View>
                  <View style={styles.dupChip}>
                    <Text style={styles.dupChipText}>Duplicate</Text>
                  </View>
                </View>

                <View style={styles.sourceList}>
                  {duplicate.sources.map((source) => (
                    <View key={source.key} style={styles.sourceRow}>
                      <View style={styles.sourceMark}>
                        <BrandLogo name={source.brand} size={14} label={source.label} />
                      </View>
                      <View style={styles.sourceCopy}>
                        <Text numberOfLines={1} style={styles.sourceLabel}>
                          {source.label}
                        </Text>
                        <Text numberOfLines={1} style={styles.sourceDetail}>
                          {source.detail}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Controls drawn inside the product mockup — illustration, not
                    buttons. They stay visually identical but are not pressable. */}
                <View style={styles.duplicateActions}>
                  <View style={styles.primaryAction}>
                    <FontAwesome6 name="code-merge" size={11} color={t.textOnBrand} />
                    <Text style={styles.primaryActionText}>Merge</Text>
                  </View>
                  <View style={styles.ghostAction}>
                    <Text style={styles.ghostActionText}>Not a duplicate</Text>
                  </View>
                </View>
              </View>
            </Reveal>
          ))}
        </View>

        <View style={styles.errorList}>
          {LISTING_ERRORS.map((issue) => {
            const isError = issue.severity === 'error';
            return (
              <View key={issue.key} style={styles.errorRow}>
                <View
                  style={[
                    styles.errorIcon,
                    { backgroundColor: softFill(isError ? t.pink : t.orange, t) },
                  ]}>
                  <FontAwesome6
                    name={isError ? 'circle-exclamation' : 'triangle-exclamation'}
                    size={12}
                    color={isError ? t.pink : t.orange}
                  />
                </View>
                <View style={styles.errorCopy}>
                  <Text numberOfLines={1} style={styles.errorLabel}>
                    {issue.label}
                  </Text>
                  <Text numberOfLines={1} style={styles.errorWhere}>
                    {issue.where}
                  </Text>
                </View>
                <View style={styles.fixChip}>
                  <Text style={styles.fixChipText}>Fix ready</Text>
                </View>
              </View>
            );
          })}
        </View>
      </Section>

      {/* ------------------------------------------------ 04 reviews */}
      <Section>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <NumberedHead
              index={4}
              eyebrow="REVIEWS"
              title="Monitor reviews and respond faster with Flow.AI."
              body="Every review from every source arrives in one queue. Flow.AI drafts a reply in your voice, referencing what the customer actually said — you read it, adjust it, and send."
              styles={styles}
              type={type}
            />
            <View style={styles.reviewStatRow}>
              {REVIEW_STATS.map((stat) => (
                <View key={stat.key} style={styles.reviewStat}>
                  <Text numberOfLines={1} style={[styles.reviewStatValue, { color: accentOf(stat.accent) }]}>
                    {stat.value}
                  </Text>
                  <Text numberOfLines={1} style={styles.reviewStatLabel}>
                    {stat.label}
                  </Text>
                </View>
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={80}>
            <View style={styles.panel}>
              <View style={styles.reviewCard}>
                <View style={styles.reviewHead}>
                  <Media
                    name="people/maya-thompson"
                    alt="Maya Thompson, a reviewer"
                    style={styles.reviewAvatar}
                    radius={21}
                  />
                  <View style={styles.reviewHeadCopy}>
                    <Text numberOfLines={1} style={styles.reviewName}>
                      Maya Thompson
                    </Text>
                    <Text numberOfLines={1} style={styles.reviewMeta}>
                      Google • 2 days ago • River North
                    </Text>
                    {/* Phone: the rating drops under the name. Beside it the
                        source line lost its location — "…2 days ago • R…". */}
                    {l.isPhone ? (
                      <View style={styles.reviewStars}>
                        <Stars count={4} size={12} color={t.orange} />
                      </View>
                    ) : null}
                  </View>
                  {l.isPhone ? null : <Stars count={4} size={12} color={t.orange} />}
                </View>
                <Text style={styles.reviewText}>
                  Loved the colour — exactly what I asked for and it has held beautifully. Only note is
                  that I waited about fifteen minutes past my appointment time.
                </Text>
              </View>

              <View style={styles.replyCard}>
                <View style={styles.replyHead}>
                  <View style={styles.replyIcon}>
                    <FontAwesome6 name="wand-magic-sparkles" size={12} color={t.violet} />
                  </View>
                  <Text numberOfLines={l.isPhone ? 2 : 1} style={styles.replyTitle}>
                    Flow.AI suggested reply
                  </Text>
                  <View style={styles.replyChip}>
                    <Text style={styles.replyChipText}>Your voice</Text>
                  </View>
                </View>
                <Text style={styles.replyText}>
                  Thank you, Maya — I am so glad the colour is holding. You are right about the wait,
                  and we have added a buffer to colour appointments this month so it does not happen
                  again. See you at your next visit.
                </Text>
                {/* Inside the review mockup — illustration, not controls. */}
                <View style={styles.replyActions}>
                  <MockPrimarySm label="Approve & reply" icon="check" full={l.isPhone} t={t} />
                  <MockSecondarySm label="Edit" icon="pen" full={l.isPhone} t={t} />
                </View>
              </View>
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ 05 local pages */}
      <Section>
        <View style={styles.splitRowReverse}>
          <Reveal style={styles.splitCopy} distance={16}>
            <NumberedHead
              index={5}
              eyebrow="LOCAL PAGES"
              title="Location pages that convert, not just exist."
              body="Every location gets a real page — photos, services, prices, hours, staff and directions — generated from the same profile, so it is never out of date with the map."
              styles={styles}
              type={type}
            />
            <View style={styles.pointList}>
              {PAGE_POINTS.map((point) => (
                <Tick key={point} text={point} styles={styles} t={t} />
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={80}>
            <View style={styles.pageCard}>
              <Media
                name="scenes/salon-interior"
                alt="The interior of the River North salon"
                style={styles.pageHero}
                radius={12}
              />
              <View style={styles.pageHead}>
                <View style={styles.pageHeadCopy}>
                  <Text numberOfLines={l.isPhone ? 2 : 1} style={styles.pageTitle}>
                    Luxe Salons — River North
                  </Text>
                  <Text numberOfLines={1} style={styles.pageAddress}>
                    412 N Wells St, Chicago, IL
                  </Text>
                </View>
                <View style={styles.openChip}>
                  <View style={styles.liveDot} />
                  <Text style={styles.openChipText}>Open until 8pm</Text>
                </View>
              </View>

              <View style={styles.ratingRow}>
                <Stars count={5} size={12} color={t.orange} />
                <Text numberOfLines={1} style={styles.ratingValue}>
                  4.8
                </Text>
                <Text numberOfLines={1} style={styles.ratingCount}>
                  212 reviews
                </Text>
              </View>

              <View style={styles.serviceList}>
                {PAGE_SERVICES.map((service) => (
                  <View key={service.key} style={styles.serviceRow}>
                    <Text numberOfLines={1} style={styles.serviceLabel}>
                      {service.label}
                    </Text>
                    <Text numberOfLines={1} style={styles.servicePrice}>
                      {service.price}
                    </Text>
                  </View>
                ))}
              </View>

              {/* The local page is a mockup of what a visitor sees — its buttons
                  are illustration, not controls on this marketing page. */}
              <View style={styles.pageActions}>
                <View style={[styles.primaryAction, styles.pageAction]}>
                  <FontAwesome6 name="diamond-turn-right" size={12} color={t.textOnBrand} />
                  <Text style={styles.primaryActionText}>Directions</Text>
                </View>
                <View style={[styles.ghostAction, styles.pageAction]}>
                  <FontAwesome6 name="calendar-check" size={12} color={t.brand} />
                  <Text style={styles.ghostActionText}>Book</Text>
                </View>
              </View>
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ 06 AI search visibility */}
      <Section>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <NumberedHead
              index={6}
              eyebrow="AI SEARCH"
              title="Boost your visibility inside AI answers."
              body="When someone asks an assistant for the best option nearby, the answer is assembled from facts it can verify. ListSmartly makes sure those facts are yours, complete and current."
              styles={styles}
              type={type}
            />
            <View style={styles.pointList}>
              {AI_POINTS.map((point) => (
                <Tick key={point} text={point} styles={styles} t={t} />
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={80}>
            <View style={styles.panel}>
              <View style={styles.scoreHead}>
                <View style={styles.scoreCopy}>
                  <Text numberOfLines={1} style={styles.scoreLabel}>
                    AI visibility score
                  </Text>
                  <View style={styles.scoreValueRow}>
                    <Text numberOfLines={1} style={styles.scoreValue}>
                      87
                    </Text>
                    <View style={styles.scoreDelta}>
                      <FontAwesome6 name="arrow-up" size={9} color={t.successText} />
                      <Text style={styles.scoreDeltaText}>+17 in 90 days</Text>
                    </View>
                  </View>
                </View>
                <ScoreRing value={87} size={l.isPhone ? 72 : 82} stroke={8} color={t.brand} track={t.surfaceInset}>
                  <FontAwesome6 name="robot" size={18} color={t.brand} />
                </ScoreRing>
              </View>

              <Text style={styles.cardTitle}>Win rate against local competitors</Text>
              <View style={styles.winList}>
                {WIN_RATES.map((row) => {
                  const accent = accentOf(row.accent);
                  const width: DimensionValue = `${row.value}%`;
                  /* Phone: the query gets its own full-width line above the bar.
                     Held to a fixed 116px column it truncated to
                     “best balayage in C…”, which is the half of the sentence
                     that matters. */
                  if (l.isPhone) {
                    return (
                      <View key={row.key} style={styles.winRowStacked}>
                        <View style={styles.winHead}>
                          <Text numberOfLines={1} style={styles.winQuery}>
                            {row.query}
                          </Text>
                          <Text numberOfLines={1} style={styles.winValue}>
                            {row.value}%
                          </Text>
                        </View>
                        <View style={styles.winTrack}>
                          <View style={[styles.winFill, { width, backgroundColor: accent }]} />
                        </View>
                      </View>
                    );
                  }

                  return (
                    <View key={row.key} style={styles.winRow}>
                      <Text numberOfLines={1} style={styles.winQuery}>
                        {row.query}
                      </Text>
                      <View style={styles.winTrack}>
                        <View style={[styles.winFill, { width, backgroundColor: accent }]} />
                      </View>
                      <Text numberOfLines={1} style={styles.winValue}>
                        {row.value}%
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ 07 multi-location */}
      <Section>
        <NumberedHead
          index={7}
          eyebrow="MULTI-LOCATION"
          title="Twenty-eight locations, one honest picture."
          body="Roll every site up into a single view, then drop into the one that needs you. No spreadsheet, no per-branch logins, no guessing which listing went stale."
          styles={styles}
          type={type}
          centered
        />

        <View style={styles.multiRow}>
          <Reveal style={styles.multiPanel} distance={16}>
            <View style={styles.panel}>
              <Text style={styles.cardTitle}>Portfolio health</Text>
              <View style={styles.donutRow}>
                <Donut
                  segments={LOCATION_HEALTH.map((segment) => ({
                    key: segment.key,
                    value: segment.value,
                    color: accentOf(segment.accent),
                  }))}
                  size={l.isPhone ? 108 : 124}
                  stroke={13}
                  track={t.surfaceInset}>
                  <View style={styles.ringCenter}>
                    <Text style={styles.donutValue}>28</Text>
                    <Text style={styles.ringLabel}>locations</Text>
                  </View>
                </Donut>
                <View style={styles.legendList}>
                  {LOCATION_HEALTH.map((segment) => (
                    <View key={segment.key} style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: accentOf(segment.accent) }]} />
                      <Text numberOfLines={1} style={styles.legendLabel}>
                        {segment.label}
                      </Text>
                      <Text numberOfLines={1} style={styles.legendValue}>
                        {segment.value}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </Reveal>

          <Reveal style={styles.multiPanel} distance={16} delay={80}>
            <View style={styles.panel}>
              <View style={styles.panelHead}>
                <Text style={styles.panelTitle}>Locations</Text>
                <View style={styles.panelChip}>
                  <Text style={styles.panelChipText}>Sorted by health</Text>
                </View>
              </View>
              <View style={styles.locationList}>
                {LOCATION_ROWS.map((row) => {
                  const accent = accentOf(row.accent);
                  const width: DimensionValue = `${row.score}%`;
                  return (
                    <View key={row.key} style={styles.multiLocationRow}>
                      <View style={styles.multiLocationCopy}>
                        <Text numberOfLines={1} style={styles.locationName}>
                          {row.name}
                        </Text>
                        <Text numberOfLines={1} style={styles.locationMeta}>
                          {row.city}
                        </Text>
                      </View>
                      <View style={styles.multiTrackWrap}>
                        <View style={styles.winTrack}>
                          <View style={[styles.winFill, { width, backgroundColor: accent }]} />
                        </View>
                      </View>
                      <Text numberOfLines={1} style={[styles.multiScore, { color: accent }]}>
                        {row.score}%
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </Reveal>
        </View>
      </Section>

      {/* ------------------------------------------------ 08 teams */}
      <Section>
        <NumberedHead
          index={8}
          eyebrow="TEAMS & PERMISSIONS"
          title="Give each person exactly the access they need."
          body="Owners see everything. Regional managers see their region. A location manager edits one site, and a reviews responder never touches business data at all."
          styles={styles}
          type={type}
          centered
        />

        <View style={styles.teamGrid}>
          {TEAM.map((member, index) => (
            <Reveal key={member.key} style={styles.teamCell} distance={14} delay={index * 60}>
              <View style={styles.teamCard}>
                <Media
                  name={member.media}
                  alt={`${member.name}, ${member.role}`}
                  style={styles.teamAvatar}
                  radius={24}
                />
                <Text numberOfLines={1} style={styles.teamName}>
                  {member.name}
                </Text>
                <View style={[styles.roleChip, { backgroundColor: softFill(accentOf(member.accent), t) }]}>
                  <Text numberOfLines={1} style={[styles.roleChipText, { color: accentOf(member.accent) }]}>
                    {member.role}
                  </Text>
                </View>
                <Text numberOfLines={2} style={styles.teamScope}>
                  {member.scope}
                </Text>
              </View>
            </Reveal>
          ))}
        </View>

        {/* Five columns cannot survive a 390px viewport: the permission names
            collapsed to “Edit…”, “Pub…”, “Billi…” and the role headers to
            “REGIO…”. On phone each permission becomes its own card with the
            four roles as labelled chips that wrap. */}
        {l.isPhone ? (
          <View style={styles.matrixCard}>
            {PERMISSIONS.map((permission) => (
              <View key={permission.key} style={styles.permissionCard}>
                <Text numberOfLines={2} style={styles.permissionLabel}>
                  {permission.label}
                </Text>
                <View style={styles.permissionRoles}>
                  {permission.roles.map((allowed, index) => (
                    <View
                      key={`${permission.key}-${index}`}
                      style={[styles.roleTag, allowed ? styles.roleTagOn : styles.roleTagOff]}>
                      <FontAwesome6
                        name={allowed ? 'circle-check' : 'minus'}
                        size={11}
                        color={allowed ? t.green : t.textSubtle}
                      />
                      <Text numberOfLines={1} style={[styles.roleTagText, { color: allowed ? t.successText : t.textSubtle }]}>
                        {ROLE_LABELS[index]}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.matrixCard}>
            <View style={styles.matrixHeadRow}>
              <Text numberOfLines={1} style={[styles.matrixHeadCell, styles.matrixLabelCol]}>
                Permission
              </Text>
              {ROLE_LABELS.map((role) => (
                <Text key={role} numberOfLines={1} style={[styles.matrixHeadCell, styles.matrixRoleCol]}>
                  {role}
                </Text>
              ))}
            </View>
            {PERMISSIONS.map((permission) => (
              <View key={permission.key} style={styles.matrixRow}>
                <Text numberOfLines={1} style={[styles.matrixLabel, styles.matrixLabelCol]}>
                  {permission.label}
                </Text>
                {permission.roles.map((allowed, index) => (
                  <View key={`${permission.key}-${index}`} style={[styles.matrixCell, styles.matrixRoleCol]}>
                    <FontAwesome6
                      name={allowed ? 'circle-check' : 'minus'}
                      size={13}
                      color={allowed ? t.green : t.textSubtle}
                    />
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </Section>

      {/* ------------------------------------------------ 09 actions */}
      <Section>
        <NumberedHead
          index={9}
          eyebrow="RECOMMENDED ACTIONS"
          title="A short list of what to fix, and what it is worth."
          body="Not an audit dump. Four things ranked by the visits they should return, each with the work already prepared and an estimate of how long it takes."
          styles={styles}
          type={type}
          centered
        />

        <View style={styles.actionList}>
          {ACTIONS.map((action, index) => {
            const accent = accentOf(action.accent);
            return (
              <Reveal key={action.key} style={styles.actionReveal} distance={14} delay={index * 60}>
                <View style={[styles.actionRow, l.isPhone ? styles.actionRowCompact : null]}>
                  <View style={[styles.actionIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={action.icon as never} size={15} color={accent} />
                  </View>
                  <View style={styles.actionCopy}>
                    <Text numberOfLines={2} style={styles.actionTitle}>
                      {action.title}
                    </Text>
                    <Text numberOfLines={2} style={styles.actionNote}>
                      {action.note}
                    </Text>
                  </View>
                  <View style={styles.actionMeta}>
                    <View style={styles.impactChip}>
                      <Text numberOfLines={1} style={styles.impactChipText}>
                        {action.impact}
                      </Text>
                    </View>
                    <Text numberOfLines={1} style={styles.effortText}>
                      {action.effort}
                    </Text>
                  </View>
                  {/* Row action drawn inside the product mockup — illustration. */}
                  <View style={[styles.doButton, l.isPhone ? styles.doButtonFull : null]}>
                    <Text style={styles.doButtonText}>Do it</Text>
                    <FontAwesome6 name="arrow-right" size={11} color={t.brand} />
                  </View>
                </View>
              </Reveal>
            );
          })}
        </View>
      </Section>

      {/* ------------------------------------------------ testimonial */}
      <Section>
        <View style={styles.quoteRow}>
          <Media
            name="people/amanda-rodriguez"
            alt="Amanda Rodriguez, Director of Marketing at Luxe Salons"
            style={styles.quoteAvatar}
            radius={l.isPhone ? 34 : 44}
          />
          <View style={styles.quoteCopy}>
            <FontAwesome6 name="quote-left" size={18} color={t.brand} />
            <Text style={[type.h3, styles.quoteText]}>
              ListSmartly made our locations easier to find, our info more accurate, and our reviews
              our superpower.
            </Text>
            <Text numberOfLines={2} style={styles.quoteAttribution}>
              Amanda Rodriguez • Director of Marketing, Luxe Salons
            </Text>
          </View>
        </View>
      </Section>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  const stacked = l.isStacked;
  const gap = l.isPhone ? 12 : 18;
  const half = gap / 2;

  const columns = (phone: number, tablet: number, laptop: number, desktop: number) =>
    l.isPhone ? phone : l.isTablet ? tablet : l.isDesktop ? desktop : laptop;

  const publisherColumns = l.isPhone ? 2 : 4;
  const duplicateColumns = l.isPhone ? 1 : 2;
  const teamColumns = columns(2, 2, 4, 4);
  const healthCountColumns = 3;

  const twoUp: ViewStyle = { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 };

  const gridBase: ViewStyle = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    marginHorizontal: -half,
  };

  const cellBase = (count: number): ViewStyle => ({
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: cellBasis(count),
    minWidth: 0,
    padding: half,
  });

  const cardBase: ViewStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    backgroundColor: t.surfaceRaised,
    padding: l.isPhone ? 15 : 18,
    ...(elevation(t, 1) as ViewStyle),
  };

  const panelBase: ViewStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 18,
    backgroundColor: t.surfaceMuted,
    padding: l.isPhone ? 14 : 18,
    gap: 14,
    ...(elevation(t, 2) as ViewStyle),
  };

  const pillBase: ViewStyle = {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  };

  const innerCard: ViewStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 13,
    backgroundColor: t.surfaceRaised,
    padding: 12,
    gap: 10,
  };

  const trackBase: ViewStyle = {
    height: 6,
    borderRadius: 3,
    backgroundColor: t.surfaceInset,
    overflow: 'hidden',
  };

  const avatarBase: ImageStyle = { flexGrow: 0, flexShrink: 0 };

  return StyleSheet.create({
    /* -------------------------------------------------- hero */
    heroRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: stacked ? 26 : 40,
    },
    heroCopy: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 400, minWidth: 0, paddingTop: 6 },
    heroTitle: { marginTop: 14 },
    heroBody: { marginTop: 14, maxWidth: 560 },
    heroButtons: { marginTop: 24 },
    proofRow: { marginTop: 22, flexDirection: 'row', flexWrap: 'wrap', gap: l.isPhone ? 10 : 18 },
    proofItem: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
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
    proofText: { ...type.caption, color: t.textMuted, fontWeight: '600', flexShrink: 1, minWidth: 0 },
    heroVisual: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1.45, flexShrink: 1, flexBasis: 600, minWidth: 0 },

    /* -------------------------------------------------- dashboard mock */
    dashboard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 12 : 16,
      ...(elevation(t, 3) as ViewStyle),
    },
    dashboardRow: {
      flexDirection: l.isCompact ? 'column' : 'row',
      alignItems: 'stretch',
      gap: l.isCompact ? 12 : 16,
    },
    rail: l.isCompact
      ? { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }
      : { width: 138, flexGrow: 0, flexShrink: 0, gap: 3 },
    railItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderRadius: 9,
      paddingHorizontal: 10,
      paddingVertical: 8,
      minWidth: 0,
      flexShrink: 1,
    },
    railItemActive: { backgroundColor: t.brandSoft },
    railLabel: { ...type.micro, color: t.textSubtle, fontWeight: '600', flexShrink: 1, minWidth: 0 },
    railLabelActive: { color: t.brand, fontWeight: '800' },

    /* `dashboardRow` turns into a column below 1024. `flexBasis: 0` is a *main
       axis* basis, so in a column it sizes the height — and because every RNW
       View carries `min-height: 0`, the whole dashboard collapsed to nothing and
       its contents painted outside the card. Only take the basis in a row. */
    dashMain: l.isCompact
      ? { width: '100%', minWidth: 0, gap: 12 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 12 },
    dashHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    dashHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    dashTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    dashSub: { ...type.micro, color: t.textSubtle },
    liveChip: { ...pillBase, backgroundColor: t.successBg },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.successText },
    liveText: { fontSize: 11, lineHeight: 15, fontWeight: '800', color: t.successText },

    healthCard: { ...innerCard, backgroundColor: t.surfaceMuted },
    healthHead: { flexDirection: l.isPhone ? 'column' : 'row', alignItems: 'center', gap: 14 },
    ringCenter: { alignItems: 'center', justifyContent: 'center' },
    ringValue: { fontSize: l.isPhone ? 19 : 22, lineHeight: l.isPhone ? 23 : 26, fontWeight: '800', color: t.text },
    ringLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    healthCounts: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      marginHorizontal: -4,
    },
    healthCountCell: { flexGrow: 0, flexShrink: 1, flexBasis: cellBasis(healthCountColumns), minWidth: 0, padding: 4 },
    healthCount: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 10,
      paddingVertical: 10,
      gap: 2,
    },
    healthCountValue: { fontSize: l.isPhone ? 17 : 19, lineHeight: l.isPhone ? 22 : 24, fontWeight: '800' },
    healthCountLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },

    visibilityCard: { ...innerCard, backgroundColor: t.surfaceMuted },
    cardTitle: { ...type.caption, color: t.text, fontWeight: '800' },
    visibilityList: { gap: l.isPhone ? 11 : 9 },
    visibilityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    visibilityRowStacked: { gap: 7 },
    visibilityHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    visibilityMark: {
      width: 26,
      height: 26,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceRaised,
      borderWidth: 1,
      borderColor: t.border,
    },
    visibilityName: l.isPhone
      ? { ...type.micro, color: t.text, fontWeight: '700', flexGrow: 1, flexShrink: 1, minWidth: 0 }
      : { ...type.micro, color: t.text, fontWeight: '700', width: 96, flexGrow: 0, flexShrink: 0 },
    visibilityTrack: { ...trackBase, flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0 },
    visibilityFill: { height: 6, borderRadius: 3 },
    visibilityLevel: {
      ...type.micro,
      color: t.textMuted,
      fontWeight: '700',
      width: 62,
      flexGrow: 0,
      flexShrink: 0,
      textAlign: 'right',
    },

    locationsSplit: { flexDirection: l.isCompact ? 'column' : 'row', alignItems: 'stretch', gap: 12 },
    locationsPanel: {
      ...innerCard,
      backgroundColor: t.surfaceMuted,
      ...(l.isCompact ? { width: '100%' } : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 }),
    },
    locationList: { gap: 8 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    locationDot: {
      width: 26,
      height: 26,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    locationCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    locationName: { ...type.caption, color: t.text, fontWeight: '700' },
    locationMeta: { ...type.micro, color: t.textSubtle },

    mapPanel: {
      position: 'relative',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surfaceInset,
      minHeight: l.isCompact ? 132 : 168,
      ...(l.isCompact ? { width: '100%' } : { flexGrow: 0.85, flexShrink: 1, flexBasis: 0, minWidth: 0 }),
    },
    mapGridRow: { position: 'absolute', left: 0, right: 0, top: '32%', height: 1, backgroundColor: t.divider },
    mapGridRowLower: { position: 'absolute', left: 0, right: 0, top: '68%', height: 1, backgroundColor: t.divider },
    mapGridCol: { position: 'absolute', top: 0, bottom: 0, left: '30%', width: 1, backgroundColor: t.divider },
    mapGridColRight: { position: 'absolute', top: 0, bottom: 0, left: '66%', width: 1, backgroundColor: t.divider },
    mapPin: { position: 'absolute' },
    mapPinOne: { left: '22%', top: '24%' },
    mapPinTwo: { left: '54%', top: '48%' },
    mapPinThree: { left: '74%', top: '22%' },
    mapChip: {
      position: 'absolute',
      left: 10,
      bottom: 10,
      borderRadius: 999,
      backgroundColor: t.surfaceRaised,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    mapChipText: { ...type.micro, color: t.text, fontWeight: '800' },

    /* -------------------------------------------------- shared heads */
    headLeft: { gap: 12, alignItems: 'flex-start' },
    headCentered: { gap: 12, alignItems: l.isPhone ? 'flex-start' : 'center' },
    headTop: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    headNumber: {
      width: 34,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    headNumberText: { ...type.caption, color: t.brand, fontWeight: '800' },
    headTitle: { textAlign: 'left' },
    headTitleCentered: { textAlign: l.isPhone ? 'left' : 'center' },
    headBody: { maxWidth: 560 },
    headBodyCentered: { textAlign: l.isPhone ? 'left' : 'center', maxWidth: 680 },

    splitRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: stacked ? 26 : 44,
    },
    splitRowReverse: {
      flexDirection: stacked ? 'column' : 'row-reverse',
      alignItems: 'flex-start',
      gap: stacked ? 26 : 44,
    },
    splitCopy: stacked ? { width: '100%', minWidth: 0 } : { ...twoUp, paddingTop: 4 },
    splitVisual: stacked ? { width: '100%', minWidth: 0 } : twoUp,
    pointList: { marginTop: 22, gap: 11 },

    tickRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
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

    panel: panelBase,
    panelHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    panelTitle: { ...type.bodySm, color: t.text, fontWeight: '800', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    panelChip: { ...pillBase, backgroundColor: t.chipBg },
    panelChipText: { fontSize: 11, lineHeight: 15, color: t.chipText, fontWeight: '800' },

    /* -------------------------------------------------- 01 publishers */
    syncField: { gap: l.isPhone ? 16 : 24, paddingVertical: 4 },
    publisherRow: { ...gridBase },
    publisherCell: cellBase(publisherColumns),
    publisherTile: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surfaceRaised,
      paddingVertical: 12,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      minHeight: 76,
      ...(elevation(t, 1) as ViewStyle),
    },
    publisherLabel: { ...type.micro, color: t.text, fontWeight: '700', textAlign: 'center' },
    profileHub: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 16,
      backgroundColor: t.surface,
      paddingHorizontal: 16,
      paddingVertical: 14,
      ...(elevation(t, 3) as ViewStyle),
    },
    profileHubIcon: {
      width: 38,
      height: 38,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    profileHubCopy: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      gap: 2,
      alignItems: l.isPhone ? 'center' : 'flex-start',
    },
    profileHubTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    profileHubSub: { ...type.micro, color: t.textSubtle },
    syncChip: { ...pillBase, backgroundColor: t.successBg },
    syncChipText: { fontSize: 11, lineHeight: 15, color: t.successText, fontWeight: '800' },

    /* -------------------------------------------------- 02 profile fields */
    verifyRow: {
      marginTop: 22,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.successBg,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    verifyIcon: {
      width: 32,
      height: 32,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.green, t),
    },
    verifyText: { ...type.caption, color: t.successText, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    fieldList: { gap: 8 },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    fieldIcon: {
      width: 30,
      height: 30,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    fieldCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    fieldLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    fieldValue: { ...type.caption, color: t.text, fontWeight: '700' },

    /* -------------------------------------------------- 03 duplicates */
    duplicateGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 28) - half },
    duplicateCell: cellBase(duplicateColumns),
    duplicateCard: { ...cardBase, gap: 13, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    duplicateHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    flagIcon: {
      width: 34,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.warnBg,
    },
    duplicateCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    duplicateTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    duplicateReason: { ...type.micro, color: t.textSubtle },
    dupChip: { ...pillBase, backgroundColor: t.warnBg },
    dupChipText: { fontSize: 11, lineHeight: 15, color: t.warnText, fontWeight: '800' },
    sourceList: { gap: 8 },
    sourceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    sourceMark: {
      width: 28,
      height: 28,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceRaised,
      borderWidth: 1,
      borderColor: t.border,
    },
    sourceCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    sourceLabel: { ...type.caption, color: t.text, fontWeight: '700' },
    sourceDetail: { ...type.micro, color: t.textSubtle },
    duplicateActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    primaryAction: {
      minHeight: 44,
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 10,
      backgroundColor: t.brand,
      paddingHorizontal: 18,
    },
    primaryActionText: { ...type.caption, color: t.textOnBrand, fontWeight: '800' },
    ghostAction: {
      minHeight: 44,
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 10,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 16,
    },
    ghostActionText: { ...type.caption, color: t.brand, fontWeight: '800' },
    actionPressed: { opacity: 0.85 },

    errorList: { marginTop: gap, gap: 8 },
    errorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 13,
      paddingVertical: 11,
    },
    errorIcon: {
      width: 32,
      height: 32,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    errorLabel: { ...type.caption, color: t.text, fontWeight: '800' },
    errorWhere: { ...type.micro, color: t.textSubtle },
    fixChip: { ...pillBase, backgroundColor: t.chipBg },
    fixChipText: { fontSize: 11, lineHeight: 15, color: t.chipText, fontWeight: '800' },

    /* -------------------------------------------------- 04 reviews */
    reviewStatRow: { marginTop: 22, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    reviewStat: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 120,
      minWidth: 0,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 13,
      paddingVertical: 12,
      gap: 3,
    },
    reviewStatValue: { fontSize: l.isPhone ? 19 : 22, lineHeight: l.isPhone ? 24 : 27, fontWeight: '800' },
    reviewStatLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    reviewCard: { ...innerCard, gap: 11 },
    reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    reviewAvatar: { ...avatarBase, width: 42, height: 42 },
    reviewHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    reviewName: { ...type.caption, color: t.text, fontWeight: '800' },
    reviewMeta: { ...type.micro, color: t.textSubtle },
    reviewStars: { marginTop: 3, alignItems: 'flex-start' },
    reviewText: { ...type.caption, color: t.textMuted },
    replyCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surfaceRaised,
      padding: 12,
      gap: 11,
    },
    replyHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    replyIcon: {
      width: 30,
      height: 30,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.violet, t),
    },
    replyTitle: { ...type.caption, color: t.text, fontWeight: '800', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    replyChip: { ...pillBase, backgroundColor: t.chipBg },
    replyChipText: { fontSize: 11, lineHeight: 15, color: t.chipText, fontWeight: '700' },
    replyText: {
      ...type.caption,
      color: t.textMuted,
      borderLeftWidth: 2,
      borderLeftColor: t.violet,
      paddingLeft: 11,
    },
    replyActions: { flexDirection: l.isPhone ? 'column' : 'row', alignItems: 'stretch', gap: 10 },

    /* -------------------------------------------------- 05 local page */
    pageCard: { ...panelBase, gap: 12 },
    pageHero: { width: '100%', height: l.isPhone ? 150 : 196, flexGrow: 0, flexShrink: 0 },
    pageHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    pageHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    pageTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    pageAddress: { ...type.micro, color: t.textSubtle },
    openChip: { ...pillBase, backgroundColor: t.successBg },
    openChipText: { fontSize: 11, lineHeight: 15, color: t.successText, fontWeight: '800' },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    ratingValue: { ...type.caption, color: t.text, fontWeight: '800' },
    ratingCount: { ...type.micro, color: t.textSubtle, flexShrink: 1, minWidth: 0 },
    serviceList: { gap: 8 },
    serviceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    serviceLabel: { ...type.caption, color: t.text, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    servicePrice: { ...type.caption, color: t.textMuted, fontWeight: '700', flexGrow: 0, flexShrink: 0 },
    pageActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    pageAction: { flexGrow: 1, flexBasis: 120 },

    /* -------------------------------------------------- 06 AI visibility */
    scoreHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    scoreCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 6 },
    scoreLabel: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 0.6 },
    scoreValueRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
    scoreValue: { fontSize: l.isPhone ? 34 : 42, lineHeight: l.isPhone ? 39 : 48, fontWeight: '800', color: t.text },
    scoreDelta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      backgroundColor: t.successBg,
      paddingHorizontal: 10,
      paddingVertical: 5,
      flexShrink: 1,
      minWidth: 0,
    },
    scoreDeltaText: { fontSize: 11, lineHeight: 15, color: t.successText, fontWeight: '800' },
    winList: { gap: l.isPhone ? 12 : 10 },
    winRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    winRowStacked: { gap: 6 },
    winHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    winQuery: l.isPhone
      ? { ...type.micro, color: t.text, fontWeight: '700', flexGrow: 1, flexShrink: 1, minWidth: 0 }
      : { ...type.micro, color: t.text, fontWeight: '700', width: 168, flexGrow: 0, flexShrink: 0 },
    winTrack: { ...trackBase, flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0 },
    winFill: { height: 6, borderRadius: 3 },
    winValue: {
      ...type.micro,
      color: t.textMuted,
      fontWeight: '800',
      width: 38,
      flexGrow: 0,
      flexShrink: 0,
      textAlign: 'right',
    },

    /* -------------------------------------------------- 07 multi-location */
    multiRow: {
      marginTop: l.isPhone ? 20 : 28,
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'stretch',
      gap: stacked ? 18 : 24,
    },
    multiPanel: stacked ? { width: '100%', minWidth: 0 } : twoUp,
    donutRow: { flexDirection: l.isPhone ? 'column' : 'row', alignItems: 'center', gap: 16 },
    donutValue: { fontSize: l.isPhone ? 22 : 26, lineHeight: l.isPhone ? 27 : 31, fontWeight: '800', color: t.text },
    legendList: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 9, width: l.isPhone ? '100%' : undefined },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    legendDot: { width: 10, height: 10, borderRadius: 5, flexGrow: 0, flexShrink: 0 },
    legendLabel: { ...type.caption, color: t.textMuted, flexGrow: 1, flexShrink: 1, minWidth: 0 },
    legendValue: { ...type.caption, color: t.text, fontWeight: '800', flexGrow: 0, flexShrink: 0 },
    multiLocationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    multiLocationCopy: { width: l.isPhone ? 104 : 132, flexGrow: 0, flexShrink: 0, gap: 2 },
    multiTrackWrap: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0 },
    multiScore: { ...type.caption, fontWeight: '800', width: 42, flexGrow: 0, flexShrink: 0, textAlign: 'right' },

    /* -------------------------------------------------- 08 teams */
    teamGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 28) - half },
    teamCell: cellBase(teamColumns),
    teamCard: {
      ...cardBase,
      alignItems: 'center',
      gap: 8,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      backgroundColor: t.surfaceMuted,
    },
    teamAvatar: { ...avatarBase, width: 56, height: 56 },
    teamName: { ...type.caption, color: t.text, fontWeight: '800', textAlign: 'center' },
    roleChip: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4, maxWidth: '100%' },
    roleChipText: { fontSize: 11, lineHeight: 15, fontWeight: '800' },
    teamScope: { ...type.micro, color: t.textSubtle, textAlign: 'center' },

    matrixCard: { ...panelBase, marginTop: gap, gap: 8 },
    matrixHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
    matrixHeadCell: {
      ...type.micro,
      color: t.textSubtle,
      fontWeight: '800',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    matrixRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 4,
      paddingVertical: 11,
    },
    matrixLabelCol: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, paddingLeft: 8 },
    matrixRoleCol: { width: 78, flexGrow: 0, flexShrink: 0, textAlign: 'center' },
    matrixLabel: { ...type.caption, color: t.text, fontWeight: '700' },
    matrixCell: { alignItems: 'center', justifyContent: 'center' },

    /* phone form of the matrix — see the note at the call site */
    permissionCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 11,
      gap: 9,
    },
    permissionLabel: { ...type.caption, color: t.text, fontWeight: '800' },
    permissionRoles: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    roleTag: {
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    roleTagOn: { backgroundColor: t.successBg },
    roleTagOff: { backgroundColor: t.surfaceInset },
    roleTagText: { fontSize: 11, lineHeight: 15, fontWeight: '800', flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- 09 actions */
    actionList: { marginTop: l.isPhone ? 20 : 28, gap: 10 },
    actionReveal: { width: '100%' },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: l.isPhone ? 14 : 16,
      paddingVertical: 14,
    },
    actionRowCompact: { flexDirection: 'column', alignItems: 'stretch', gap: 12 },
    actionIcon: {
      width: 38,
      height: 38,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    /* Same trap as `dashMain`: `actionRowCompact` stacks the row on phone, where
       a zero main-axis basis collapses the copy and prints the title on top of
       the impact chip. */
    actionCopy: l.isPhone
      ? { width: '100%', minWidth: 0, gap: 3 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 3 },
    actionTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    actionNote: { ...type.micro, color: t.textSubtle },
    actionMeta: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: l.isPhone ? 'row' : 'column',
      alignItems: l.isPhone ? 'center' : 'flex-end',
      gap: l.isPhone ? 10 : 4,
    },
    impactChip: { borderRadius: 999, backgroundColor: t.successBg, paddingHorizontal: 10, paddingVertical: 4 },
    impactChipText: { fontSize: 11, lineHeight: 15, color: t.successText, fontWeight: '800' },
    effortText: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    doButton: {
      flexGrow: 0,
      flexShrink: 0,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 10,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 18,
    },
    doButtonFull: { width: '100%' },
    doButtonText: { ...type.caption, color: t.brand, fontWeight: '800' },

    /* -------------------------------------------------- testimonial */
    quoteRow: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: l.isPhone ? 'flex-start' : 'center',
      gap: l.isPhone ? 18 : 28,
    },
    quoteAvatar: { ...avatarBase, width: l.isPhone ? 68 : 88, height: l.isPhone ? 68 : 88 },
    quoteCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 12 },
    quoteText: { maxWidth: 760 },
    quoteAttribution: { ...type.caption, color: t.textSubtle, fontWeight: '700' },
  });
}
