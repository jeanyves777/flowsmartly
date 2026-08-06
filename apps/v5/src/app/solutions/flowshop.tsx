import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { Fragment, useMemo } from 'react';
import {
  Linking,
  Platform,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type ImageStyle,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { BrandLogo } from '@/components/public/brand-logo';
import { ArrowLink } from '@/components/public/connectors';
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
import { EXTERNAL } from '@/lib/destinations';
import { elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

type Accent = 'brand' | 'violet' | 'orange' | 'green' | 'pink';

const PROOF = ['Launch in a day', 'Structured for AI discovery', 'Orders land in your CRM'];

const CATEGORIES: { key: string; media: string; label: string; count: string }[] = [
  { key: 'living', media: 'scenes/category-living-room', label: 'Living room', count: '48 items' },
  { key: 'bedroom', media: 'scenes/category-bedroom', label: 'Bedroom', count: '32 items' },
  { key: 'kitchen', media: 'scenes/category-kitchen', label: 'Kitchen', count: '61 items' },
  { key: 'decor', media: 'scenes/category-decor', label: 'Decor', count: '74 items' },
];

/**
 * The first question a shop owner asks, answered in the hero.
 *
 * Nothing else on the page says what happens to a catalog you already have, and
 * the copy column had 300px of nothing beside the storefront mock.
 */
const MIGRATION: { key: string; brand?: string; icon?: string; label: string; note: string }[] = [
  {
    key: 'shopify',
    brand: 'shopify',
    label: 'Bring your Shopify catalog',
    note: 'Products, orders and customers stay in sync both ways.',
  },
  {
    key: 'csv',
    icon: 'file-csv',
    label: 'Import a spreadsheet',
    note: 'Map your columns once — variants and images come with it.',
  },
  {
    key: 'fresh',
    icon: 'wand-magic-sparkles',
    label: 'Or start with nothing',
    note: 'Describe what you sell and the catalog gets written for you.',
  },
];

/** What the builder still lets you change once the store exists. */
const EDITABLE: { key: string; icon: string; label: string; value: string }[] = [
  { key: 'blocks', icon: 'table-cells-large', label: 'Blocks', value: 'Hero, product grid, collections, testimonials, FAQ, newsletter' },
  { key: 'brand', icon: 'palette', label: 'Brand', value: 'Logo, colours, typography, buttons and corner radius' },
  { key: 'pages', icon: 'file-lines', label: 'Pages', value: 'Add, reorder, hide or redirect any page in the store' },
];

const READINESS: string[] = [
  'Structured product markup published',
  'Complete attributes on every listing',
  'Answers written for common questions',
  'Stock and pricing kept live',
];

/* 01 — store builder */
const THEMES: { key: string; name: string; note: string; accent: Accent }[] = [
  { key: 'aurora', name: 'Aurora', note: 'Modern retail', accent: 'brand' },
  { key: 'meridian', name: 'Meridian', note: 'Editorial', accent: 'violet' },
  { key: 'harbor', name: 'Harbor', note: 'Home & living', accent: 'green' },
  { key: 'atelier', name: 'Atelier', note: 'Fashion', accent: 'pink' },
  { key: 'field', name: 'Field', note: 'Outdoor & sport', accent: 'orange' },
];

const BUILDER_POINTS = [
  'A theme chosen for your industry, not a blank canvas',
  'Brand colours, type and tone applied to every page',
  'Designed mobile-first, checked at every width',
  'Change any block yourself — no code, no developer',
];

/* 02 — catalog */
type Product = {
  key: string;
  media: string;
  name: string;
  sku: string;
  price: string;
  stock: string;
  status: 'Live' | 'Low stock';
};

const PRODUCTS: Product[] = [
  {
    key: 'backpack',
    media: 'product/commuter-backpack',
    name: 'Commuter Backpack',
    sku: 'FS-1042',
    price: '$128.00',
    stock: '42 in stock',
    status: 'Live',
  },
  {
    key: 'tote',
    media: 'product/canvas-tote',
    name: 'Canvas Tote',
    sku: 'FS-1088',
    price: '$64.00',
    stock: '118 in stock',
    status: 'Live',
  },
  {
    key: 'sneakers',
    media: 'product/black-sneakers',
    name: 'Everyday Sneakers',
    sku: 'FS-1120',
    price: '$142.00',
    stock: '7 left',
    status: 'Low stock',
  },
  {
    key: 'bottle',
    media: 'product/navy-bottle',
    name: 'Insulated Bottle',
    sku: 'FS-1155',
    price: '$38.00',
    stock: '260 in stock',
    status: 'Live',
  },
];

const COPY_PARTS = ['Title', 'Description', 'Bullet points', 'Search metadata', 'Alt text'];

/* 03 — checkout */
const COMMERCE_ROWS: { key: string; icon: string; label: string; note: string; value: string; accent: Accent }[] = [
  { key: 'payments', icon: 'credit-card', label: 'Payments', note: 'Cards, wallets and cash on delivery', value: 'Connected', accent: 'green' },
  { key: 'shipping', icon: 'truck', label: 'Shipping', note: 'Zones, flat rates and live carrier rates', value: '3 zones', accent: 'brand' },
  { key: 'taxes', icon: 'percent', label: 'Taxes', note: 'Calculated by region at checkout', value: 'Automatic', accent: 'violet' },
  { key: 'orders', icon: 'box-open', label: 'Orders', note: 'Fulfilment, tracking and returns', value: '12 open', accent: 'orange' },
];

const ORDER_LINES: { key: string; media: string; name: string; meta: string; price: string }[] = [
  { key: 'backpack', media: 'product/commuter-backpack', name: 'Commuter Backpack', meta: 'Slate • 1', price: '$128.00' },
  { key: 'bottle', media: 'product/navy-bottle', name: 'Insulated Bottle', meta: 'Navy • 1', price: '$38.00' },
];

const ORDER_SUMMARY: { key: string; label: string; value: string }[] = [
  { key: 'subtotal', label: 'Subtotal', value: '$166.00' },
  { key: 'shipping', label: 'Shipping', value: '$8.00' },
  { key: 'tax', label: 'Tax', value: '$13.94' },
];

/* 04 — agent-ready data */
const DATA_TICKS: { key: string; icon: string; label: string; note: string }[] = [
  { key: 'schema', icon: 'code', label: 'Schema markup', note: 'Product, offer, brand and review types' },
  { key: 'attributes', icon: 'tags', label: 'Attributes', note: 'Size, material, colour, fit, compatibility' },
  { key: 'faqs', icon: 'circle-question', label: 'Questions & answers', note: 'The things buyers always ask' },
  { key: 'policies', icon: 'file-lines', label: 'Policies', note: 'Shipping, returns and warranty, in plain words' },
  { key: 'images', icon: 'image', label: 'Images', note: 'Described, sized and alt-tagged' },
  { key: 'availability', icon: 'boxes-stacked', label: 'Availability', note: 'Stock and price kept current, per variant' },
];

const CATALOG_JSON = [
  '{',
  '  "@type": "Product",',
  '  "name": "Commuter Backpack",',
  '  "sku": "FS-1042",',
  '  "brand": "Your Brand",',
  '  "material": "Recycled ripstop",',
  '  "fits": "16\\" laptop",',
  '  "offers": {',
  '    "price": "128.00",',
  '    "currency": "USD",',
  '    "availability": "InStock",',
  '    "shipping": "2–4 days"',
  '  }',
  '}',
];

/* 05 — visibility */
const CHANNELS: { key: string; brand: string; name: string; note: string; state: string; level: number; accent: Accent }[] = [
  { key: 'chatgpt', brand: 'chatgpt', name: 'ChatGPT', note: 'Shopping answers', state: 'Catalog readable', level: 92, accent: 'green' },
  { key: 'google', brand: 'google', name: 'Google', note: 'Search & Shopping', state: 'Feed connected', level: 88, accent: 'brand' },
  { key: 'copilot', brand: 'copilot', name: 'Copilot', note: 'Assistant results', state: 'Catalog readable', level: 76, accent: 'violet' },
  { key: 'instagram', brand: 'instagram', name: 'Instagram', note: 'Shopping tags', state: 'Products synced', level: 84, accent: 'pink' },
  { key: 'tiktok', brand: 'tiktok', name: 'TikTok Shop', note: 'In-video checkout', state: 'Products synced', level: 71, accent: 'orange' },
];

/* 06 — campaign to product */
const CHAIN: { key: string; icon: string; label: string; note: string; accent: Accent }[] = [
  { key: 'campaign', icon: 'bullhorn', label: 'Campaign post', note: 'Spring drop • Instagram + email', accent: 'violet' },
  { key: 'product', icon: 'bag-shopping', label: 'Product page', note: 'Everyday Sneakers • $142.00', accent: 'orange' },
  { key: 'checkout', icon: 'credit-card', label: 'Checkout', note: 'Card • 41 seconds', accent: 'brand' },
  { key: 'order', icon: 'receipt', label: 'Order #4821', note: 'Attributed to the spring campaign', accent: 'green' },
];

const CHAIN_POINTS = [
  'Every asset carries the product it is selling',
  'Revenue is attributed back to the post that earned it',
  'Buyers land on their customer record, not a spreadsheet',
];

/* 07 — sales associate */
type ChatTurn = { key: string; from: 'shopper' | 'agent'; text: string };

const CHAT: ChatTurn[] = [
  { key: 'q1', from: 'shopper', text: 'I need a bag that fits a 16" laptop and survives a wet commute.' },
  {
    key: 'a1',
    from: 'agent',
    text: 'The Commuter Backpack is the one — 16.5" padded sleeve, recycled ripstop with a sealed base. The Canvas Tote is lighter but only water-resistant.',
  },
  { key: 'q2', from: 'shopper', text: 'Can I get it before Friday?' },
  {
    key: 'a2',
    from: 'agent',
    text: 'Yes — 42 in stock and standard delivery is 2–4 days to your area. Free over $75, so this ships free.',
  },
];

const CHAT_PICKS: { key: string; media: string; name: string; meta: string; price: string }[] = [
  { key: 'backpack', media: 'product/commuter-backpack', name: 'Commuter Backpack', meta: '16.5" sleeve • In stock', price: '$128.00' },
  { key: 'tote', media: 'product/canvas-tote', name: 'Canvas Tote', meta: 'Lighter carry • In stock', price: '$64.00' },
];

const ASSOCIATE_POINTS = [
  'Answers from your real catalog — stock, sizes, policies',
  'Recommends the product that actually fits the question',
  'Hands the conversation to a human whenever you say so',
  'Every chat is saved to the shopper’s customer record',
  'Suggests what genuinely goes with it, never a random upsell',
];

/* 08 — analytics */
type Metric = {
  key: string;
  label: string;
  target: number;
  prefix: string;
  suffix: string;
  decimals: number;
  delta: string;
  accent: Accent;
};

const METRICS: Metric[] = [
  { key: 'revenue', label: 'Revenue', target: 248760, prefix: '$', suffix: '', decimals: 0, delta: '+24.5%', accent: 'green' },
  { key: 'conversion', label: 'Conversion', target: 2.9, prefix: '', suffix: '%', decimals: 1, delta: '+0.4pt', accent: 'brand' },
  { key: 'aov', label: 'Average order', target: 135.22, prefix: '$', suffix: '', decimals: 2, delta: '+$11.40', accent: 'violet' },
  { key: 'returning', label: 'Returning buyers', target: 38.6, prefix: '', suffix: '%', decimals: 1, delta: '+5.2pt', accent: 'orange' },
];

const GROWTH_TOOLS: { key: string; icon: string; label: string }[] = [
  { key: 'discounts', icon: 'ticket', label: 'Discounts & coupons' },
  { key: 'bundles', icon: 'layer-group', label: 'Bundles & upsells' },
  { key: 'reviews', icon: 'star', label: 'Product reviews' },
  { key: 'segments', icon: 'filter', label: 'Buyer segments' },
];

/* close — themes */
const THEME_CARDS: { key: string; name: string; blurb: string; accent: Accent; swatches: Accent[] }[] = [
  { key: 'aurora', name: 'Aurora', blurb: 'Bright, spacious and product-forward — built for modern retail.', accent: 'brand', swatches: ['brand', 'violet', 'green'] },
  { key: 'meridian', name: 'Meridian', blurb: 'Editorial type and generous margins for brands that tell a story.', accent: 'violet', swatches: ['violet', 'pink', 'brand'] },
  { key: 'harbor', name: 'Harbor', blurb: 'Warm, tactile and calm — made for home, living and wellness.', accent: 'green', swatches: ['green', 'orange', 'brand'] },
  { key: 'atelier', name: 'Atelier', blurb: 'High-contrast and confident, with imagery doing the talking.', accent: 'pink', swatches: ['pink', 'orange', 'violet'] },
];

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

type Styles = ReturnType<typeof createStyles>;

const MONO = Platform.select({
  web: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  default: 'monospace',
}) as string;

/** A progress ring drawn as real geometry, so it stays round at every size. */
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

/** One counting figure. A component per tile keeps the hook count static. */
function MetricTile({ metric, accent, styles }: { metric: Metric; accent: string; styles: Styles }) {
  const counter = useCountUp(metric.target, { decimals: metric.decimals });
  const shown =
    metric.decimals > 0
      ? counter.value.toFixed(metric.decimals)
      : Math.round(counter.value).toLocaleString('en-US');
  return (
    <View ref={counter.ref as never} style={styles.metricTile}>
      <Text numberOfLines={1} style={styles.metricLabel}>
        {metric.label}
      </Text>
      <Text numberOfLines={1} style={styles.metricValue}>
        {`${metric.prefix}${shown}${metric.suffix}`}
      </Text>
      <Text numberOfLines={1} style={[styles.metricDelta, { color: accent }]}>
        {metric.delta}
      </Text>
    </View>
  );
}

function DashStat({
  label,
  target,
  prefix,
  delta,
  accent,
  styles,
}: {
  label: string;
  target: number;
  prefix?: string;
  delta: string;
  accent: string;
  styles: Styles;
}) {
  const counter = useCountUp(target);
  return (
    <View ref={counter.ref as never} style={styles.dashStatCell}>
      <View style={styles.dashStat}>
        <Text numberOfLines={1} style={styles.dashStatLabel}>
          {label}
        </Text>
        <Text numberOfLines={1} style={styles.dashStatValue}>
          {`${prefix ?? ''}${Math.round(counter.value).toLocaleString('en-US')}`}
        </Text>
        <Text numberOfLines={1} style={[styles.dashStatDelta, { color: accent }]}>
          {delta}
        </Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function FlowShopPage() {
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

  /* Below phone the catalog table becomes stacked cards — five columns cannot
     survive a 390px viewport without truncating the product name itself. */
  const wideTable = !l.isPhone;

  return (
    <PageShell
      title="FlowShop"
      description="Storefront, catalog, checkout and orders in one system — with product data structured so search engines and AI assistants can recommend what you sell."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Solutions', path: ROUTES.solutions },
          { name: 'FlowShop', path: ROUTES.flowshop },
        ]),
      ]}>
      {/* ------------------------------------------------ hero */}
      <OpenSection>
        <View style={styles.heroRow}>
          <Reveal style={styles.heroCopy} distance={16}>
            <SectionLabel>AI-READY COMMERCE</SectionLabel>
            <Heading level={1} style={[type.display, styles.heroTitle]}>
              Build a store that sells wherever customers discover you.
            </Heading>
            <Text style={[type.body, styles.heroBody]}>
              Storefront, catalog, checkout and orders in one system — and product data structured so
              search engines and AI assistants can recommend you with confidence.
            </Text>
            <View style={styles.heroButtons}>
              <ButtonRow>
                <PrimaryButton
                  label="Start selling"
                  size="lg"
                  full={l.isPhone}
                  icon="arrow-right"
                  iconRight
                  trackId="flowshop.hero.start-selling"
                  onPress={() => Linking.openURL(EXTERNAL.signup)}
                />
                <SecondaryButton
                  label="Explore the platform"
                  size="lg"
                  full={l.isPhone}
                  trackId="flowshop.hero.explore-platform"
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

            {/* The storefront mock is nearly twice the height of this copy, so
                the column answers the question the mock cannot: what happens to
                the catalog you already have. */}
            <View style={styles.migrationCard}>
              <Text style={styles.migrationHead}>ALREADY SELLING SOMEWHERE?</Text>
              {MIGRATION.map((row) => (
                <View key={row.key} style={styles.migrationRow}>
                  <View style={styles.migrationIcon}>
                    {row.brand ? (
                      <BrandLogo name={row.brand} size={16} />
                    ) : (
                      <FontAwesome6 name={row.icon as never} size={14} color={t.brand} />
                    )}
                  </View>
                  <View style={styles.migrationCopy}>
                    <Text numberOfLines={1} style={styles.migrationLabel}>
                      {row.label}
                    </Text>
                    <Text style={styles.migrationNote}>{row.note}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.heroVisual} distance={16} delay={90}>
            {/* storefront mock */}
            <View style={styles.storefront}>
              <View style={styles.browserBar}>
                <View style={styles.browserDots}>
                  <View style={[styles.browserDot, { backgroundColor: t.pink }]} />
                  <View style={[styles.browserDot, { backgroundColor: t.orange }]} />
                  <View style={[styles.browserDot, { backgroundColor: t.green }]} />
                </View>
                <View style={styles.urlPill}>
                  <FontAwesome6 name="lock" size={9} color={t.textSubtle} />
                  <Text numberOfLines={1} style={styles.urlText}>
                    yourbrand.flowshop.com
                  </Text>
                </View>
                <View style={styles.cartPill}>
                  <FontAwesome6 name="bag-shopping" size={11} color={t.brand} />
                  <Text style={styles.cartCount}>3</Text>
                </View>
              </View>

              <View style={styles.storeNav}>
                <Text numberOfLines={1} style={styles.storeBrand}>
                  YOUR BRAND
                </Text>
                <View style={styles.storeLinks}>
                  {['Shop', 'Collections', 'About'].map((item) => (
                    <Text key={item} numberOfLines={1} style={styles.storeLink}>
                      {item}
                    </Text>
                  ))}
                </View>
              </View>

              <Media
                name="scenes/storefront-hero"
                alt="A storefront hero banner for the spring collection"
                style={styles.storeHero}
                radius={12}
              />

              <View style={styles.storeHeroCaption}>
                <View style={styles.storeHeroCopy}>
                  <Text numberOfLines={1} style={styles.storeHeroTitle}>
                    The spring collection
                  </Text>
                  <Text numberOfLines={1} style={styles.storeHeroSub}>
                    New arrivals • free shipping over $75
                  </Text>
                </View>
                <View style={styles.shopPill}>
                  <Text style={styles.shopPillText}>Shop now</Text>
                </View>
              </View>

              <Text style={styles.stripTitle}>Shop by category</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((category) => (
                  <View key={category.key} style={styles.categoryCell}>
                    <View style={styles.categoryCard}>
                      <Media
                        name={category.media}
                        alt={`${category.label} category`}
                        style={styles.categoryImage}
                        radius={10}
                      />
                      <Text numberOfLines={1} style={styles.categoryLabel}>
                        {category.label}
                      </Text>
                      <Text numberOfLines={1} style={styles.categoryCount}>
                        {category.count}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* dashboard + readiness */}
            <View style={styles.heroPanelRow}>
              <View style={styles.dashCard}>
                <View style={styles.dashHead}>
                  <View style={styles.dashHeadCopy}>
                    <Text numberOfLines={1} style={styles.dashTitle}>
                      FlowShop dashboard
                    </Text>
                    <Text numberOfLines={1} style={styles.dashSub}>
                      Last 30 days
                    </Text>
                  </View>
                  <View style={styles.liveChip}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>Live</Text>
                  </View>
                </View>
                <View style={styles.dashStatGrid}>
                  <DashStat label="Total sales" target={248760} prefix="$" delta="+24.5%" accent={t.green} styles={styles} />
                  <DashStat label="Orders" target={1842} delta="+18.7%" accent={t.brand} styles={styles} />
                  <DashStat label="Visitors" target={23845} delta="+11.2%" accent={t.violet} styles={styles} />
                </View>
              </View>

              <View style={styles.readyCard}>
                <View style={styles.readyHead}>
                  <ScoreRing value={86} size={l.isPhone ? 84 : 92} stroke={9} color={t.green} track={t.surfaceInset}>
                    <View style={styles.readyCenter}>
                      <Text style={styles.readyScore}>86</Text>
                      <Text style={styles.readyOutOf}>/100</Text>
                    </View>
                  </ScoreRing>
                  <View style={styles.readyCopy}>
                    <Text style={styles.readyTitle}>AI Commerce Readiness</Text>
                    <Text style={styles.readySub}>
                      How completely assistants can read, trust and recommend your catalog.
                    </Text>
                  </View>
                </View>
                <View style={styles.tickList}>
                  {READINESS.map((item) => (
                    <Tick key={item} text={item} styles={styles} t={t} />
                  ))}
                </View>
              </View>
            </View>
          </Reveal>
        </View>
      </OpenSection>

      {/* ------------------------------------------------ 01 store builder */}
      <Band tone="surface" art={{ variant: 'docs', color: t.brand, side: 'right' }}>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <NumberedHead
              index={1}
              eyebrow="AI STORE BUILDER"
              title="A storefront that looks designed, not templated."
              body="Answer a few questions about what you sell and FlowShop builds the whole store — layout, palette, typography and starter copy. Pick the look, then change anything you like."
              styles={styles}
              type={type}
            />
            <View style={styles.pointList}>
              {BUILDER_POINTS.map((point) => (
                <Tick key={point} text={point} styles={styles} t={t} />
              ))}
            </View>

            {/* "Change anything you like" is the claim above — this is the list
                of what that actually covers, and it evens out a 330px void
                beside the theme picker. */}
            <View style={styles.editableCard}>
              <Text style={styles.editableHead}>WHAT YOU CAN CHANGE, WITHOUT CODE</Text>
              {EDITABLE.map((row) => (
                <View key={row.key} style={styles.editableRow}>
                  <View style={styles.editableIcon}>
                    <FontAwesome6 name={row.icon as never} size={13} color={t.brand} />
                  </View>
                  <View style={styles.editableCopy}>
                    <Text numberOfLines={1} style={styles.editableLabel}>
                      {row.label}
                    </Text>
                    <Text style={styles.editableValue}>{row.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={80}>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Choose a theme</Text>
              <View style={styles.themeList}>
                {THEMES.map((theme, index) => {
                  const accent = accentOf(theme.accent);
                  const selected = index === 0;
                  return (
                    <View key={theme.key} style={[styles.themeRow, selected ? styles.themeRowActive : null]}>
                      <View
                        style={[
                          styles.radio,
                          selected ? { borderColor: t.brand, backgroundColor: t.brand } : null,
                        ]}>
                        {selected ? <FontAwesome6 name="check" size={8} color={t.textOnBrand} /> : null}
                      </View>
                      <View style={styles.themeCopy}>
                        <Text numberOfLines={1} style={styles.themeName}>
                          {theme.name}
                        </Text>
                        <Text numberOfLines={1} style={styles.themeNote}>
                          {theme.note}
                        </Text>
                      </View>
                      <View style={styles.swatchRow}>
                        <View style={[styles.swatch, { backgroundColor: accent }]} />
                        <View style={[styles.swatch, { backgroundColor: softFill(accent, t) }]} />
                        <View style={[styles.swatch, { backgroundColor: t.surfaceInset }]} />
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.previewCard}>
                <View style={styles.previewHead}>
                  <Text numberOfLines={1} style={styles.previewLabel}>
                    Aurora preview
                  </Text>
                  <View style={styles.previewChip}>
                    <FontAwesome6 name="mobile-screen" size={10} color={t.chipText} />
                    <Text style={styles.previewChipText}>Mobile checked</Text>
                  </View>
                </View>
                <Media
                  name="scenes/campaign-spring-model"
                  alt="Theme preview showing the storefront banner"
                  style={styles.previewImage}
                  radius={10}
                />
                <View style={styles.previewRow}>
                  {['product/canvas-tote', 'product/black-sneakers', 'product/navy-bottle'].map((name) => (
                    <View key={name} style={styles.previewCell}>
                      <Media name={name} alt="Product tile in the theme preview" style={styles.previewThumb} radius={8} />
                      <View style={styles.previewBar} />
                      <View style={styles.previewBarShort} />
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </Reveal>
        </View>
      </Band>

      {/* ------------------------------------------------ 02 catalog + AI copy */}
      <Band tone="pink" art={{ variant: 'store', color: t.pink, side: 'left' }}>
        <NumberedHead
          index={2}
          eyebrow="CATALOG & PRODUCT COPY"
          title="A catalog that writes itself."
          body="Add or import a product once. FlowShop drafts the title, description, bullets and metadata in your brand voice — then scores the result before you publish it."
          styles={styles}
          type={type}
          centered
        />

        <View style={styles.catalogRow}>
          <Reveal style={styles.catalogTablePanel} distance={16}>
            <View style={styles.panel}>
              <View style={styles.panelHead}>
                <Text style={styles.panelTitle}>Products</Text>
                <View style={styles.panelChip}>
                  <Text style={styles.panelChipText}>248 total</Text>
                </View>
              </View>

              {wideTable ? (
                <View style={styles.tableHead}>
                  <Text style={[styles.tableHeadCell, styles.colProduct]}>Product</Text>
                  <Text style={[styles.tableHeadCell, styles.colSku]}>SKU</Text>
                  <Text style={[styles.tableHeadCell, styles.colPrice]}>Price</Text>
                  <Text style={[styles.tableHeadCell, styles.colStatus]}>Status</Text>
                </View>
              ) : null}

              <View style={styles.tableBody}>
                {PRODUCTS.map((product) => {
                  const low = product.status === 'Low stock';
                  const statusPill = (
                    <View style={[styles.statusPill, low ? styles.statusPillWarn : styles.statusPillOk]}>
                      <Text style={[styles.statusText, { color: low ? t.warnText : t.successText }]}>
                        {product.status}
                      </Text>
                    </View>
                  );
                  /* Phone: thumbnail beside a stacked copy column — name, then
                     SKU + stock, then price and status. Six fields never fit on
                     one 390px line, and squeezing them overlapped the text. */
                  if (!wideTable) {
                    return (
                      <View key={product.key} style={styles.compactRow}>
                        <Media
                          name={product.media}
                          alt={product.name}
                          style={styles.compactThumb}
                          radius={9}
                          contentFit="cover"
                        />
                        <View style={styles.compactCopy}>
                          <Text numberOfLines={2} style={styles.productName}>
                            {product.name}
                          </Text>
                          <Text numberOfLines={1} style={styles.productStock}>
                            {`${product.sku} • ${product.stock}`}
                          </Text>
                          <View style={styles.compactFoot}>
                            <Text numberOfLines={1} style={styles.compactPrice}>
                              {product.price}
                            </Text>
                            {statusPill}
                          </View>
                        </View>
                      </View>
                    );
                  }

                  return (
                    <View key={product.key} style={styles.tableRow}>
                      <View style={styles.productLead}>
                        <Media
                          name={product.media}
                          alt={product.name}
                          style={styles.productThumb}
                          radius={9}
                          contentFit="cover"
                        />
                        <View style={styles.productCopy}>
                          <Text numberOfLines={1} style={styles.productName}>
                            {product.name}
                          </Text>
                          <Text numberOfLines={1} style={styles.productStock}>
                            {product.stock}
                          </Text>
                        </View>
                      </View>

                      <Text numberOfLines={1} style={[styles.cellText, styles.colSku]}>
                        {product.sku}
                      </Text>
                      <Text numberOfLines={1} style={[styles.cellStrong, styles.colPrice]}>
                        {product.price}
                      </Text>
                      <View style={styles.colStatus}>{statusPill}</View>
                    </View>
                  );
                })}
              </View>
            </View>
          </Reveal>

          <Reveal style={styles.catalogCopyPanel} distance={16} delay={80}>
            <View style={styles.aiCard}>
              <View style={styles.aiHead}>
                <View style={styles.aiIcon}>
                  <FontAwesome6 name="wand-magic-sparkles" size={14} color={t.violet} />
                </View>
                <View style={styles.aiHeadCopy}>
                  <Text numberOfLines={1} style={styles.aiTitle}>
                    AI product copy
                  </Text>
                  <Text numberOfLines={1} style={styles.aiSub}>
                    Commuter Backpack • your brand voice
                  </Text>
                </View>
              </View>

              <Text style={styles.aiBody}>
                A 24-litre daily carry in recycled ripstop, with a padded 16.5&quot; laptop sleeve, a
                sealed base for wet platforms and a side pocket that actually holds a bottle.
              </Text>

              <View style={styles.chipWrap}>
                {COPY_PARTS.map((part) => (
                  <View key={part} style={styles.softChip}>
                    <FontAwesome6 name="check" size={8} color={t.green} />
                    <Text style={styles.softChipText}>{part}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.qualityRow}>
                <View style={styles.qualityCopy}>
                  <Text numberOfLines={1} style={styles.qualityLabel}>
                    Copy quality score
                  </Text>
                  <View style={styles.track}>
                    <View style={[styles.trackFill, { width: '96%', backgroundColor: t.green }]} />
                  </View>
                </View>
                <Text style={styles.qualityValue}>96%</Text>
              </View>
            </View>
          </Reveal>
        </View>
      </Band>

      {/* ------------------------------------------------ 03 checkout + orders */}
      <OpenSection>
        <View style={styles.splitRowReverse}>
          <Reveal style={styles.splitCopy} distance={16}>
            <NumberedHead
              index={3}
              eyebrow="CHECKOUT & ORDERS"
              title="Secure checkout, orders handled end to end."
              body="Payments, shipping rates, taxes and fulfilment are part of the store — not four more subscriptions to wire together and reconcile every month."
              styles={styles}
              type={type}
            />
            <View style={styles.rowList}>
              {COMMERCE_ROWS.map((row) => {
                const accent = accentOf(row.accent);
                return (
                  <View key={row.key} style={styles.featureRow}>
                    <View style={[styles.featureIcon, { backgroundColor: softFill(accent, t) }]}>
                      <FontAwesome6 name={row.icon as never} size={14} color={accent} />
                    </View>
                    <View style={styles.featureCopy}>
                      <Text numberOfLines={1} style={styles.featureLabel}>
                        {row.label}
                      </Text>
                      <Text style={styles.featureNote}>{row.note}</Text>
                    </View>
                    <View style={styles.featureValue}>
                      <Text numberOfLines={1} style={styles.featureValueText}>
                        {row.value}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={80}>
            <View style={styles.checkoutCard}>
              <View style={styles.checkoutHead}>
                <Text numberOfLines={1} style={styles.checkoutTitle}>
                  Checkout
                </Text>
                <View style={styles.secureChip}>
                  <FontAwesome6 name="lock" size={9} color={t.successText} />
                  <Text style={styles.secureText}>Secure</Text>
                </View>
              </View>

              <View style={styles.lineList}>
                {ORDER_LINES.map((line) => (
                  <View key={line.key} style={styles.lineRow}>
                    <Media name={line.media} alt={line.name} style={styles.lineThumb} radius={8} />
                    <View style={styles.lineCopy}>
                      <Text numberOfLines={1} style={styles.lineName}>
                        {line.name}
                      </Text>
                      <Text numberOfLines={1} style={styles.lineMeta}>
                        {line.meta}
                      </Text>
                    </View>
                    <Text numberOfLines={1} style={styles.linePrice}>
                      {line.price}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.summaryBlock}>
                {ORDER_SUMMARY.map((row) => (
                  <View key={row.key} style={styles.summaryRow}>
                    <Text numberOfLines={1} style={styles.summaryLabel}>
                      {row.label}
                    </Text>
                    <Text numberOfLines={1} style={styles.summaryValue}>
                      {row.value}
                    </Text>
                  </View>
                ))}
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text numberOfLines={1} style={styles.totalLabel}>
                    Total
                  </Text>
                  <Text numberOfLines={1} style={styles.totalValue}>
                    $187.94
                  </Text>
                </View>
              </View>

              <View style={styles.payButton}>
                <FontAwesome6 name="lock" size={12} color={t.textOnBrand} />
                <Text style={styles.payText}>Pay $187.94</Text>
              </View>

              <View style={styles.payMethods}>
                {['stripe', 'apple', 'google', 'amazon'].map((brand) => (
                  <View key={brand} style={styles.payMethod}>
                    <BrandLogo name={brand} size={15} />
                  </View>
                ))}
                <Text numberOfLines={1} style={styles.payMethodNote}>
                  and cash on delivery
                </Text>
              </View>
            </View>
          </Reveal>
        </View>
      </OpenSection>

      {/* ------------------------------------------------ 04 agent-ready data */}
      <Band tone="surface" art={{ variant: 'tasks', color: t.brand, side: 'right' }}>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <NumberedHead
              index={4}
              eyebrow="AGENT-READY PRODUCT DATA"
              title="Product data an assistant can actually read."
              body="AI recommends what it can understand. Every FlowShop product ships with structured markup, complete attributes, written answers and live availability — so nothing has to be guessed."
              styles={styles}
              type={type}
            />
            <View style={styles.dataGrid}>
              {DATA_TICKS.map((item) => (
                <View key={item.key} style={styles.dataCell}>
                  <View style={styles.dataRow}>
                    <View style={styles.dataIcon}>
                      <FontAwesome6 name={item.icon as never} size={12} color={t.brand} />
                    </View>
                    <View style={styles.dataCopy}>
                      <View style={styles.dataLabelRow}>
                        <Text numberOfLines={1} style={styles.dataLabel}>
                          {item.label}
                        </Text>
                        <FontAwesome6 name="circle-check" size={11} color={t.green} />
                      </View>
                      <Text style={styles.dataNote}>{item.note}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={80}>
            <View style={styles.codeCard}>
              <View style={styles.codeHead}>
                <FontAwesome6 name="code" size={12} color={t.brand} />
                <Text numberOfLines={1} style={styles.codeTitle}>
                  Structured catalog
                </Text>
                <View style={styles.codeChip}>
                  <Text style={styles.codeChipText}>Published</Text>
                </View>
              </View>
              <View style={styles.codeBlock}>
                {CATALOG_JSON.map((line, index) => (
                  <Text key={`${index}-${line}`} numberOfLines={1} style={styles.codeLine}>
                    {line}
                  </Text>
                ))}
              </View>
              <Text style={styles.codeFoot}>
                Generated for every product and variant, and refreshed whenever price or stock changes.
              </Text>
            </View>
          </Reveal>
        </View>
      </Band>

      {/* ------------------------------------------------ 05 visibility */}
      <Band tone="pink" art={{ variant: 'people', color: t.pink, side: 'left' }}>
        <NumberedHead
          index={5}
          eyebrow="AI-SHOPPING VISIBILITY"
          title="Be found where the buying question gets asked."
          body="Your catalog is published in the format each surface expects, so the same product can appear in an assistant’s answer, a search result and a social shop."
          styles={styles}
          type={type}
          centered
        />

        <View style={styles.channelGrid}>
          {CHANNELS.map((channel, index) => {
            const accent = accentOf(channel.accent);
            const width: DimensionValue = `${channel.level}%`;
            return (
              <Reveal key={channel.key} style={styles.channelCell} distance={14} delay={index * 60}>
                <View style={styles.channelCard}>
                  <View style={styles.channelHead}>
                    <View style={styles.channelLogo}>
                      <BrandLogo name={channel.brand} size={22} label={channel.name} />
                    </View>
                    <View style={styles.channelCopy}>
                      <Text numberOfLines={1} style={styles.channelName}>
                        {channel.name}
                      </Text>
                      <Text numberOfLines={1} style={styles.channelNote}>
                        {channel.note}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.channelMeter}>
                    <View style={styles.track}>
                      <View style={[styles.trackFill, { width, backgroundColor: accent }]} />
                    </View>
                    <View style={styles.channelState}>
                      <FontAwesome6 name="circle-check" size={10} color={t.green} />
                      <Text numberOfLines={1} style={styles.channelStateText}>
                        {channel.state}
                      </Text>
                    </View>
                  </View>
                </View>
              </Reveal>
            );
          })}
        </View>
      </Band>

      {/* ------------------------------------------------ 06 campaign to product */}
      <OpenSection>
        <View style={styles.splitRowReverse}>
          <Reveal style={styles.splitCopy} distance={16}>
            <NumberedHead
              index={6}
              eyebrow="CAMPAIGN TO PRODUCT"
              title="Every campaign points at something buyable."
              body="A post, an email or an ad links straight to the product it is selling, and the order it produces lands on the buyer’s customer record — so you can finally see which content sold."
              styles={styles}
              type={type}
            />
            <View style={styles.pointList}>
              {CHAIN_POINTS.map((point) => (
                <Tick key={point} text={point} styles={styles} t={t} />
              ))}
            </View>
            <View style={styles.attributionCard}>
              <View style={styles.attributionIcon}>
                <FontAwesome6 name="chart-line" size={13} color={t.green} />
              </View>
              <Text style={styles.attributionText}>
                Spring drop • 62 orders • $8,412 attributed
              </Text>
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={80}>
            <View style={styles.panel}>
              <View style={styles.chainTop}>
                <Media
                  name="scenes/post-sneakers-lifestyle"
                  alt="A social post featuring the sneakers"
                  style={styles.chainImage}
                  radius={10}
                />
                <Media
                  name="scenes/post-sneakers-white"
                  alt="The same sneakers on a plain background"
                  style={styles.chainImage}
                  radius={10}
                />
              </View>

              <View style={styles.chainList}>
                {CHAIN.map((step, index) => {
                  const accent = accentOf(step.accent);
                  return (
                    <Fragment key={step.key}>
                      <View style={styles.chainRow}>
                        <View style={[styles.chainIcon, { backgroundColor: softFill(accent, t) }]}>
                          <FontAwesome6 name={step.icon as never} size={13} color={accent} />
                        </View>
                        <View style={styles.chainCopy}>
                          <Text numberOfLines={1} style={styles.chainLabel}>
                            {step.label}
                          </Text>
                          <Text numberOfLines={1} style={styles.chainNote}>
                            {step.note}
                          </Text>
                        </View>
                      </View>
                      {index < CHAIN.length - 1 ? (
                        <View style={styles.chainArrow}>
                          <FontAwesome6 name="arrow-down" size={12} color={t.borderStrong} />
                        </View>
                      ) : null}
                    </Fragment>
                  );
                })}
              </View>
            </View>
          </Reveal>
        </View>
      </OpenSection>

      {/* ------------------------------------------------ 07 sales associate */}
      <Band tone="surface" art={{ variant: 'analytics', color: t.brand, side: 'right' }}>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <NumberedHead
              index={7}
              eyebrow="AI SALES ASSOCIATE"
              title="An associate on the floor, at two in the morning."
              body="Shoppers ask in their own words. The assistant answers from your real catalog — sizes, stock, delivery, policies — recommends the product that fits, and hands over to a human on your terms."
              styles={styles}
              type={type}
            />
            <View style={styles.pointList}>
              {ASSOCIATE_POINTS.map((point) => (
                <Tick key={point} text={point} styles={styles} t={t} />
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={80}>
            <View style={styles.chatCard}>
              <View style={styles.chatHead}>
                <View style={styles.chatAvatar}>
                  <FontAwesome6 name="headset" size={13} color={t.brand} />
                </View>
                <View style={styles.chatHeadCopy}>
                  <Text numberOfLines={1} style={styles.chatTitle}>
                    Store assistant
                  </Text>
                  <Text numberOfLines={1} style={styles.chatSub}>
                    Answering from your catalog
                  </Text>
                </View>
                <View style={styles.liveChip}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>Online</Text>
                </View>
              </View>

              <View style={styles.chatThread}>
                {CHAT.map((turn) => (
                  <View
                    key={turn.key}
                    style={turn.from === 'shopper' ? styles.bubbleShopperWrap : styles.bubbleAgentWrap}>
                    <View style={turn.from === 'shopper' ? styles.bubbleShopper : styles.bubbleAgent}>
                      <Text style={turn.from === 'shopper' ? styles.bubbleShopperText : styles.bubbleAgentText}>
                        {turn.text}
                      </Text>
                    </View>
                  </View>
                ))}

                <View style={styles.pickList}>
                  {CHAT_PICKS.map((pick) => (
                    <View key={pick.key} style={styles.pickRow}>
                      <Media name={pick.media} alt={pick.name} style={styles.pickThumb} radius={8} />
                      <View style={styles.pickCopy}>
                        <Text numberOfLines={1} style={styles.pickName}>
                          {pick.name}
                        </Text>
                        <Text numberOfLines={1} style={styles.pickMeta}>
                          {pick.meta}
                        </Text>
                      </View>
                      <Text numberOfLines={1} style={styles.pickPrice}>
                        {pick.price}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.chatFoot}>
                <FontAwesome6 name="user-check" size={11} color={t.textSubtle} />
                <Text numberOfLines={1} style={styles.chatFootText}>
                  Hand over to a person any time
                </Text>
              </View>
            </View>
          </Reveal>
        </View>
      </Band>

      {/* ------------------------------------------------ 08 analytics */}
      <Band tone="pink" art={{ variant: 'funnel', color: t.pink, side: 'left' }}>
        <NumberedHead
          index={8}
          eyebrow="COMMERCE ANALYTICS"
          title="Know what sold — and what nearly did."
          body="Revenue, conversion, average order value and returning-customer rate in one view, next to the carts that stalled and a one-tap way to go after them."
          styles={styles}
          type={type}
          centered
        />

        <View style={styles.metricGrid}>
          {METRICS.map((metric, index) => (
            <Reveal key={metric.key} style={styles.metricCell} distance={14} delay={index * 60}>
              <MetricTile metric={metric} accent={accentOf(metric.accent)} styles={styles} />
            </Reveal>
          ))}
        </View>

        <View style={styles.recoverRow}>
          <View style={styles.recoverCard}>
            <View style={styles.recoverIcon}>
              <FontAwesome6 name="cart-shopping" size={15} color={t.orange} />
            </View>
            <View style={styles.recoverCopy}>
              <Text numberOfLines={1} style={styles.recoverTitle}>
                23 abandoned carts • $6,742 recoverable
              </Text>
              <Text style={styles.recoverNote}>
                A reminder sequence is drafted and waiting for your approval.
              </Text>
            </View>
            {/* Illustration of the product surface, not a control. */}
            <View style={styles.recoverButton}>
              <Text style={styles.recoverButtonText}>Recover</Text>
              <FontAwesome6 name="arrow-right" size={11} color={t.brand} />
            </View>
          </View>

          <View style={styles.toolStrip}>
            {GROWTH_TOOLS.map((tool) => (
              <View key={tool.key} style={styles.toolChip}>
                <FontAwesome6 name={tool.icon as never} size={12} color={t.brand} />
                <Text numberOfLines={1} style={styles.toolText}>
                  {tool.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Band>

      {/* ------------------------------------------------ themes */}
      <OpenSection>
        <View style={styles.headCentered}>
          <SectionLabel>THEMES</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitleCentered]}>
            Beautiful themes for every brand.
          </Heading>
          <Text style={[type.body, styles.headBodyCentered]}>
            Start from a look that already fits your industry, then make it yours. Every theme is
            responsive, accessible and fast on a phone.
          </Text>
        </View>

        <View style={styles.themeGrid}>
          {THEME_CARDS.map((card, index) => {
            const accent = accentOf(card.accent);
            return (
              <Reveal key={card.key} style={styles.themeCell} distance={16} delay={index * 70}>
                <View style={styles.themeCard}>
                  <View style={[styles.themePreview, { backgroundColor: softFill(accent, t) }]}>
                    <View style={[styles.themeBanner, { backgroundColor: accent }]} />
                    <View style={styles.themeBlockRow}>
                      <View style={styles.themeBlock} />
                      <View style={styles.themeBlock} />
                      <View style={styles.themeBlock} />
                    </View>
                    <View style={styles.themeLine} />
                    <View style={styles.themeLineShort} />
                  </View>
                  <View style={styles.themeCardHead}>
                    <Text numberOfLines={1} style={[type.h4, styles.themeCardName]}>
                      {card.name}
                    </Text>
                    <View style={styles.swatchRow}>
                      {card.swatches.map((swatch) => (
                        <View key={swatch} style={[styles.swatch, { backgroundColor: accentOf(swatch) }]} />
                      ))}
                    </View>
                  </View>
                  <Text style={styles.themeCardBlurb}>{card.blurb}</Text>
                </View>
              </Reveal>
            );
          })}
        </View>

        <View style={styles.closingRow}>
          <ArrowLink width={l.isPhone ? 28 : 44} height={12} color={t.borderStrong} />
          <Text style={styles.closingText}>
            Every theme ships with the same structured data underneath — the look changes, the
            discoverability does not.
          </Text>
        </View>
      </OpenSection>
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

  const categoryColumns = l.isPhone ? 2 : 4;
  const dashColumns = l.isPhone ? 1 : 3;
  /**
   * Five channels is a prime count: only one and five columns divide it, so
   * two or three leave a hole where a card should be. The five-up card needs
   * the full desktop/laptop width; below 1024 the same card is laid out as a
   * one-column row — logo and name on the left, the visibility meter on the
   * right — rather than five full-width blocks.
   */
  const channelRow = l.isCompact;
  const channelColumns = channelRow ? 1 : 5;
  const metricColumns = columns(1, 2, 4, 4);
  const themeColumns = columns(1, 2, 2, 4);
  const dataColumns = l.isPhone ? 1 : 2;

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

  const mediaCover: ImageStyle = { width: '100%', flexGrow: 0, flexShrink: 0 };

  return StyleSheet.create({
    /* -------------------------------------------------- hero */
    heroRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: stacked ? 26 : 40,
    },
    heroCopy: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 420, minWidth: 0, paddingTop: 6 },
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

    migrationCard: {
      marginTop: 26,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 15 : 17,
      gap: 12,
      /* Stacked this column is the full page width — cap it so three short
         lines never read as a paragraph block. */
      maxWidth: 620,
    },
    migrationHead: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 1.1 },
    migrationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
    migrationIcon: {
      width: 32,
      height: 32,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceRaised,
      borderWidth: 1,
      borderColor: t.border,
    },
    migrationCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    migrationLabel: { ...type.caption, color: t.text, fontWeight: '800' },
    migrationNote: { ...type.micro, color: t.textMuted },

    heroVisual: stacked
      ? { width: '100%', minWidth: 0, gap: gap }
      : { flexGrow: 1.35, flexShrink: 1, flexBasis: 560, minWidth: 0, gap },

    /* -------------------------------------------------- storefront mock */
    storefront: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 12 : 16,
      gap: 12,
      ...(elevation(t, 3) as ViewStyle),
    },
    browserBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    browserDots: { flexDirection: 'row', gap: 5, flexGrow: 0, flexShrink: 0 },
    browserDot: { width: 8, height: 8, borderRadius: 4 },
    urlPill: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: 999,
      backgroundColor: t.surfaceInset,
      paddingHorizontal: 11,
      paddingVertical: 6,
    },
    urlText: { ...type.micro, color: t.textSubtle, flexShrink: 1, minWidth: 0 },
    cartPill: { ...pillBase, backgroundColor: t.brandSoft },
    cartCount: { ...type.micro, color: t.brand, fontWeight: '800' },

    storeNav: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    storeBrand: {
      ...type.micro,
      color: t.text,
      fontWeight: '800',
      letterSpacing: 1.4,
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
    },
    storeLinks: { flexDirection: 'row', gap: 12, flexGrow: 0, flexShrink: 1, minWidth: 0 },
    storeLink: { ...type.micro, color: t.textSubtle, fontWeight: '600' },

    storeHero: { ...mediaCover, height: l.isPhone ? 132 : 176 },
    storeHeroCaption: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    storeHeroCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    storeHeroTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    storeHeroSub: { ...type.micro, color: t.textSubtle },
    shopPill: {
      flexGrow: 0,
      flexShrink: 0,
      minHeight: 32,
      borderRadius: 999,
      backgroundColor: t.brand,
      paddingHorizontal: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shopPillText: { ...type.micro, color: t.textOnBrand, fontWeight: '800' },

    stripTitle: { ...type.caption, color: t.text, fontWeight: '800' },
    categoryGrid: { ...gridBase, marginBottom: -half },
    categoryCell: cellBase(categoryColumns),
    categoryCard: { gap: 6 },
    categoryImage: { width: '100%', height: l.isPhone ? 74 : 66 },
    categoryLabel: { ...type.micro, color: t.text, fontWeight: '700' },
    categoryCount: { ...type.micro, color: t.textSubtle },

    /* -------------------------------------------------- hero panels */
    heroPanelRow: {
      flexDirection: l.isCompact ? 'column' : 'row',
      alignItems: 'stretch',
      gap,
    },
    dashCard: {
      ...cardBase,
      gap: 12,
      ...(l.isCompact ? { width: '100%' } : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 }),
    },
    dashHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    dashHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    dashTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    dashSub: { ...type.micro, color: t.textSubtle },
    liveChip: { ...pillBase, backgroundColor: t.successBg },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.successText },
    liveText: { fontSize: 11, lineHeight: 15, fontWeight: '800', color: t.successText },

    dashStatGrid: { ...gridBase },
    dashStatCell: cellBase(dashColumns),
    dashStat: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 11,
      paddingVertical: 11,
      gap: 3,
    },
    dashStatLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    dashStatValue: { fontSize: l.isPhone ? 17 : 19, lineHeight: l.isPhone ? 22 : 24, fontWeight: '800', color: t.text },
    dashStatDelta: { ...type.micro, fontWeight: '800' },

    readyCard: {
      ...cardBase,
      gap: 14,
      ...(l.isCompact ? { width: '100%' } : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 }),
    },
    readyHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    readyCenter: { alignItems: 'center', justifyContent: 'center' },
    readyScore: { fontSize: l.isPhone ? 20 : 23, lineHeight: l.isPhone ? 24 : 27, fontWeight: '800', color: t.text },
    readyOutOf: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    readyCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 4 },
    readyTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    readySub: { ...type.micro, color: t.textMuted },

    tickList: { gap: 9 },
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

    /* -------------------------------------------------- split rows */
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
    rowList: { marginTop: 22, gap: 10 },

    editableCard: {
      marginTop: 24,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 15 : 17,
      gap: 12,
      maxWidth: 620,
    },
    editableHead: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 1.1 },
    editableRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
    editableIcon: {
      width: 30,
      height: 30,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    editableCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    editableLabel: { ...type.caption, color: t.text, fontWeight: '800' },
    editableValue: { ...type.micro, color: t.textMuted },

    panel: panelBase,
    panelHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    panelTitle: { ...type.bodySm, color: t.text, fontWeight: '800', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    panelChip: { ...pillBase, backgroundColor: t.chipBg },
    panelChipText: { fontSize: 11, lineHeight: 15, color: t.chipText, fontWeight: '800' },

    /* -------------------------------------------------- 01 theme picker */
    themeList: { gap: 8 },
    themeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 52,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    themeRowActive: { borderColor: t.brand, backgroundColor: t.brandSoft },
    radio: {
      width: 18,
      height: 18,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 9,
      borderWidth: 1.5,
      borderColor: t.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    themeName: { ...type.caption, color: t.text, fontWeight: '800' },
    themeNote: { ...type.micro, color: t.textSubtle },
    swatchRow: { flexDirection: 'row', gap: 5, flexGrow: 0, flexShrink: 0 },
    swatch: { width: 14, height: 14, borderRadius: 7 },

    previewCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      padding: 12,
      gap: 10,
    },
    previewHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    previewLabel: { ...type.caption, color: t.text, fontWeight: '800', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    previewChip: { ...pillBase, backgroundColor: t.chipBg },
    previewChipText: { fontSize: 11, lineHeight: 15, color: t.chipText, fontWeight: '700' },
    previewImage: { width: '100%', height: l.isPhone ? 92 : 108 },
    previewRow: { flexDirection: 'row', gap: 10 },
    previewCell: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 5 },
    previewThumb: { width: '100%', height: 52 },
    previewBar: { height: 6, borderRadius: 3, backgroundColor: t.surfaceInset },
    previewBarShort: { height: 6, width: '60%', borderRadius: 3, backgroundColor: t.surfaceInset },

    /* -------------------------------------------------- 02 catalog */
    catalogRow: {
      marginTop: l.isPhone ? 20 : 28,
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: stacked ? 22 : 24,
    },
    catalogTablePanel: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1.25, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    catalogCopyPanel: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },

    tableHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12 },
    tableHeadCell: {
      ...type.micro,
      color: t.textSubtle,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    tableBody: { gap: 8 },
    tableRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    productLead: { flexDirection: 'row', alignItems: 'center', gap: 11, flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    productThumb: { width: 38, height: 38, flexGrow: 0, flexShrink: 0 },
    productCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    productName: { ...type.caption, color: t.text, fontWeight: '700' },
    productStock: { ...type.micro, color: t.textSubtle },

    /* phone row — see the note at the call site */
    compactRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 11,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    compactThumb: { width: 44, height: 44, flexGrow: 0, flexShrink: 0 },
    compactCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    compactFoot: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 1 },
    compactPrice: { ...type.caption, color: t.text, fontWeight: '800', flexShrink: 1, minWidth: 0 },
    colProduct: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    colSku: { width: l.isDesktop ? 88 : 74, flexGrow: 0, flexShrink: 0 },
    colPrice: { width: l.isDesktop ? 84 : 74, flexGrow: 0, flexShrink: 0 },
    colStatus: { width: l.isDesktop ? 96 : 86, flexGrow: 0, flexShrink: 0 },
    cellText: { ...type.micro, color: t.textMuted },
    cellStrong: { ...type.caption, color: t.text, fontWeight: '800' },
    statusPill: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    statusPillOk: { backgroundColor: t.successBg },
    statusPillWarn: { backgroundColor: t.warnBg },
    statusText: { fontSize: 11, lineHeight: 15, fontWeight: '800' },

    aiCard: { ...panelBase, gap: 13 },
    aiHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    aiIcon: {
      width: 34,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.violet, t),
    },
    aiHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    aiTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    aiSub: { ...type.micro, color: t.textSubtle },
    aiBody: {
      ...type.caption,
      color: t.textMuted,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      padding: 12,
    },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    softChip: {
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
    softChipText: { fontSize: 11, lineHeight: 15, color: t.successText, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    qualityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    qualityCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 6 },
    qualityLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    qualityValue: { ...type.h4, color: t.green, flexGrow: 0, flexShrink: 0 },
    track: { height: 6, borderRadius: 3, backgroundColor: t.surfaceInset, overflow: 'hidden' },
    trackFill: { height: 6, borderRadius: 3 },

    /* -------------------------------------------------- 03 checkout */
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 56,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 13,
      paddingVertical: 11,
    },
    featureIcon: {
      width: 34,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    featureLabel: { ...type.caption, color: t.text, fontWeight: '800' },
    featureNote: { ...type.micro, color: t.textSubtle },
    featureValue: { flexGrow: 0, flexShrink: 0, borderRadius: 999, backgroundColor: t.chipBg, paddingHorizontal: 10, paddingVertical: 5 },
    featureValueText: { fontSize: 11, lineHeight: 15, color: t.chipText, fontWeight: '800' },

    checkoutCard: { ...panelBase, gap: 13 },
    checkoutHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    checkoutTitle: { ...type.bodySm, color: t.text, fontWeight: '800', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    secureChip: { ...pillBase, backgroundColor: t.successBg },
    secureText: { fontSize: 11, lineHeight: 15, color: t.successText, fontWeight: '800' },
    lineList: { gap: 8 },
    lineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    lineThumb: { width: 34, height: 34, flexGrow: 0, flexShrink: 0 },
    lineCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    lineName: { ...type.caption, color: t.text, fontWeight: '700' },
    lineMeta: { ...type.micro, color: t.textSubtle },
    linePrice: { ...type.caption, color: t.text, fontWeight: '800', flexGrow: 0, flexShrink: 0 },
    summaryBlock: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      padding: 12,
      gap: 8,
    },
    summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    summaryLabel: { ...type.caption, color: t.textMuted, flexShrink: 1, minWidth: 0 },
    summaryValue: { ...type.caption, color: t.text, fontWeight: '700', flexGrow: 0, flexShrink: 0 },
    summaryDivider: { height: 1, backgroundColor: t.divider },
    totalLabel: { ...type.bodySm, color: t.text, fontWeight: '800', flexShrink: 1, minWidth: 0 },
    totalValue: { ...type.h4, color: t.text, flexGrow: 0, flexShrink: 0 },
    payButton: {
      minHeight: 46,
      borderRadius: 11,
      backgroundColor: t.brand,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
    },
    payText: { ...type.bodySm, color: t.textOnBrand, fontWeight: '800' },
    payMethods: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 9 },
    payMethod: {
      width: 34,
      height: 26,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    payMethodNote: { ...type.micro, color: t.textSubtle, flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- 04 structured data */
    dataGrid: { ...gridBase, marginTop: 22 - half },
    dataCell: cellBase(dataColumns),
    dataRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
    dataIcon: {
      width: 30,
      height: 30,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    dataCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    dataLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    dataLabel: { ...type.caption, color: t.text, fontWeight: '800', flexShrink: 1, minWidth: 0 },
    dataNote: { ...type.micro, color: t.textSubtle },

    codeCard: { ...panelBase, gap: 12 },
    codeHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    codeTitle: { ...type.bodySm, color: t.text, fontWeight: '800', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    codeChip: { ...pillBase, backgroundColor: t.successBg },
    codeChipText: { fontSize: 11, lineHeight: 15, color: t.successText, fontWeight: '800' },
    codeBlock: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceInset,
      padding: 13,
      gap: 3,
    },
    codeLine: { fontFamily: MONO, fontSize: 11.5, lineHeight: 18, color: t.textMuted },
    codeFoot: { ...type.micro, color: t.textSubtle },

    /* -------------------------------------------------- 05 channels */
    channelGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 28) - half },
    channelCell: cellBase(channelColumns),
    channelCard:
      channelRow && !l.isPhone
        ? {
            ...cardBase,
            gap: 16,
            flexDirection: 'row',
            alignItems: 'center',
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: 'auto',
          }
        : { ...cardBase, gap: channelRow ? 12 : 8, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    /** five-up: logo above the name. Row form: logo beside it. */
    channelHead: channelRow
      ? {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 'auto',
          minWidth: 0,
        }
      : { width: '100%', minWidth: 0, gap: 8 },
    channelCopy: channelRow
      ? { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 }
      : { width: '100%', minWidth: 0, gap: 2 },
    /** the level bar and its state read as one unit, wherever they sit */
    channelMeter:
      channelRow && !l.isPhone
        ? { flexGrow: 0, flexShrink: 0, flexBasis: 190, gap: 8 }
        : { width: '100%', minWidth: 0, gap: 8 },
    channelLogo: {
      width: 42,
      height: 42,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceMuted,
      borderWidth: 1,
      borderColor: t.border,
    },
    channelName: { ...type.bodySm, color: t.text, fontWeight: '800', marginTop: channelRow ? 0 : 2 },
    channelNote: { ...type.micro, color: t.textSubtle },
    channelState: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    channelStateText: { ...type.micro, color: t.textMuted, fontWeight: '700', flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- 06 chain */
    chainTop: { flexDirection: 'row', gap: 10 },
    chainImage: { flexGrow: 1, flexShrink: 1, flexBasis: 0, height: l.isPhone ? 90 : 108 },
    chainList: { gap: 0 },
    chainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    chainIcon: {
      width: 32,
      height: 32,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chainCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    chainLabel: { ...type.caption, color: t.text, fontWeight: '800' },
    chainNote: { ...type.micro, color: t.textSubtle },
    chainArrow: { alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },

    attributionCard: {
      marginTop: 18,
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
    attributionIcon: {
      width: 32,
      height: 32,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.green, t),
    },
    attributionText: { ...type.caption, color: t.successText, fontWeight: '800', flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- 07 chat */
    chatCard: { ...panelBase, gap: 13 },
    chatHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    chatAvatar: {
      width: 34,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    chatHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    chatTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    chatSub: { ...type.micro, color: t.textSubtle },
    chatThread: { gap: 10 },
    bubbleShopperWrap: { alignItems: 'flex-end' },
    bubbleAgentWrap: { alignItems: 'flex-start' },
    bubbleShopper: {
      maxWidth: '88%',
      borderRadius: 14,
      backgroundColor: t.brand,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    bubbleShopperText: { ...type.caption, color: t.textOnBrand },
    bubbleAgent: {
      maxWidth: '92%',
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    bubbleAgentText: { ...type.caption, color: t.text },
    pickList: { gap: 8 },
    pickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    pickThumb: { width: 34, height: 34, flexGrow: 0, flexShrink: 0 },
    pickCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    pickName: { ...type.caption, color: t.text, fontWeight: '700' },
    pickMeta: { ...type.micro, color: t.textSubtle },
    pickPrice: { ...type.caption, color: t.text, fontWeight: '800', flexGrow: 0, flexShrink: 0 },
    chatFoot: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    chatFootText: { ...type.micro, color: t.textSubtle, flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- 08 analytics */
    metricGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 28) - half },
    metricCell: cellBase(metricColumns),
    metricTile: {
      ...cardBase,
      gap: 5,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      backgroundColor: t.surfaceMuted,
    },
    metricLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    metricValue: { fontSize: l.isPhone ? 22 : 26, lineHeight: l.isPhone ? 27 : 32, fontWeight: '800', color: t.text },
    metricDelta: { ...type.micro, fontWeight: '800' },

    recoverRow: { marginTop: gap, gap },
    recoverCard: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: l.isPhone ? 'stretch' : 'center',
      gap: 13,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.warnBg,
      paddingHorizontal: l.isPhone ? 14 : 18,
      paddingVertical: 15,
    },
    recoverIcon: {
      width: 38,
      height: 38,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.orange, t),
    },
    recoverCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    recoverTitle: { ...type.bodySm, color: t.warnText, fontWeight: '800' },
    recoverNote: { ...type.micro, color: t.warnText },
    recoverButton: {
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
    recoverButtonPressed: { backgroundColor: t.surfaceInset },
    recoverButtonText: { ...type.bodySm, color: t.brand, fontWeight: '800' },
    toolStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    toolChip: {
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 14,
    },
    toolText: { ...type.caption, color: t.text, fontWeight: '700', flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- themes */
    themeGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 28) - half },
    themeCell: cellBase(themeColumns),
    themeCard: { ...cardBase, gap: 11, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    themePreview: {
      borderRadius: 12,
      padding: 12,
      gap: 8,
      borderWidth: 1,
      borderColor: t.border,
    },
    themeBanner: { height: 34, borderRadius: 8 },
    themeBlockRow: { flexDirection: 'row', gap: 7 },
    themeBlock: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      height: 30,
      borderRadius: 7,
      backgroundColor: t.surfaceRaised,
    },
    themeLine: { height: 6, borderRadius: 3, backgroundColor: t.surfaceRaised },
    themeLineShort: { height: 6, width: '55%', borderRadius: 3, backgroundColor: t.surfaceRaised },
    themeCardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    themeCardName: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
    themeCardBlurb: { ...type.caption, color: t.textMuted },

    closingRow: {
      marginTop: l.isPhone ? 18 : 24,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: l.isPhone ? 14 : 18,
      paddingVertical: 15,
    },
    closingText: { ...type.bodySm, color: t.text, fontWeight: '600', flexShrink: 1, minWidth: 0 },
  });
}
