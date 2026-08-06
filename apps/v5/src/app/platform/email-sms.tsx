import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Linking, StyleSheet, Text, View, type ImageStyle, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { contactHref, EXTERNAL } from '@/lib/destinations';
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
  useOpenSection,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { elevation, hexToRgba, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

type Accent = 'brand' | 'violet' | 'green' | 'orange' | 'pink';

const PROOF = ['Consent recorded per channel', 'Quiet hours enforced', 'Authenticated sending'];

const AUDIENCE_CHIPS = ['Bought in 90 days', 'Opted in to SMS', 'Not already in a journey'];

const DELIVERY_ROWS: { label: string; value: string }[] = [
  { label: 'Authentication', value: 'Passed' },
  { label: 'Sender reputation', value: 'Healthy' },
  { label: 'Complaint rate', value: '0.01%' },
];

const BLOCKS = ['Hero', 'Text', 'Image', 'Button', 'Product grid', 'Divider', 'Social', 'Footer'];

const CANVAS_ROWS: { icon: string; label: string; note: string }[] = [
  { icon: 'image', label: 'Hero image', note: 'Spring campaign • 1200 × 600' },
  { icon: 'heading', label: 'Headline', note: 'The spring collection is here' },
  { icon: 'align-left', label: 'Body copy', note: '48 words • reading level: easy' },
  { icon: 'square-check', label: 'Button', note: 'Shop the collection → /spring' },
];

const ASSIST_CHIPS = ['Make it shorter', 'Warmer tone', 'Add urgency', 'Write 3 subject lines'];

const BUILDER_TICKS = [
  'Drag blocks into place — the layout stays responsive on every inbox.',
  'The assistant drafts from your brand voice, your products and last quarter’s winners.',
  'Save any layout as a reusable template your whole team can start from.',
];

/** Everything the builder does for you before a send — the short "what's included" list. */
const BUILDER_INCLUDED: { icon: string; title: string; note: string }[] = [
  {
    icon: 'mobile-screen',
    title: 'Previews before you send',
    note: 'Desktop, mobile and dark mode, from the same layout.',
  },
  {
    icon: 'palette',
    title: 'Your brand, applied',
    note: 'Fonts, colours and button styles come from the brand kit.',
  },
  {
    icon: 'universal-access',
    title: 'Accessible by default',
    note: 'Alt text, readable contrast and a plain-text version generated for you.',
  },
];

const SMS_TICKS = [
  'MMS attaches a product image without leaving the thread.',
  'Character and segment counts are live, so the cost never surprises you.',
  'Short links are tracked per contact and tie back to revenue.',
];

const SMS_STATS: { label: string; value: string }[] = [
  { label: 'Read within 3 minutes', value: '98%' },
  { label: 'Message segments', value: '1 of 1 • 142 chars' },
  { label: 'Tracked short link', value: 'On' },
  { label: 'Opt-out language', value: 'Appended' },
];

const JOURNEYS: {
  icon: string;
  title: string;
  trigger: string;
  steps: string[];
  result: string;
  accent: Accent;
}[] = [
  {
    icon: 'hand-sparkles',
    title: 'Welcome',
    trigger: 'Someone subscribes',
    steps: ['Email • immediately', 'SMS • day 2', 'Email • day 5'],
    result: '+22% first-order rate',
    accent: 'brand',
  },
  {
    icon: 'cart-shopping',
    title: 'Abandoned cart',
    trigger: 'Cart left for an hour',
    steps: ['Email • 1 hour', 'SMS • 8 hours', 'Email • 24 hours'],
    result: '18% of carts recovered',
    accent: 'orange',
  },
  {
    icon: 'calendar-check',
    title: 'Appointment reminder',
    trigger: 'Booking confirmed',
    steps: ['SMS • 24 hours before', 'SMS • 2 hours before'],
    result: '61% fewer no-shows',
    accent: 'violet',
  },
  {
    icon: 'rotate-left',
    title: 'Win-back',
    trigger: 'No order in 90 days',
    steps: ['Email • day 90', 'SMS • day 97', 'Email • day 104'],
    result: '$9,120 recovered last quarter',
    accent: 'green',
  },
];

const SEGMENT_RULES = [
  'Purchased in the last 90 days',
  'Opened at least 2 of the last 5 emails',
  'Has not been messaged in 14 days',
  'Consented to SMS',
];

const SIGNALS = ['Store orders', 'Site behaviour', 'Email engagement', 'Call outcomes', 'Location & timezone'];

const SEGMENT_TICKS = [
  'Audiences rebuild themselves as behaviour changes — no exports, no stale lists.',
  'One contact never lands in two competing sends on the same day.',
  'Suppression rules travel with the segment, so opt-outs are always respected.',
];

const AUTH_ROWS: { label: string; value: string }[] = [
  { label: 'SPF', value: 'Pass' },
  { label: 'DKIM', value: 'Pass' },
  { label: 'DMARC', value: 'Pass' },
];

const DELIVERY_TILES: { icon: string; label: string; value: string; note: string; accent: Accent }[] = [
  {
    icon: 'arrow-turn-down',
    label: 'Bounce rate',
    value: '0.42%',
    note: 'Well under the 2% threshold providers watch for.',
    accent: 'brand',
  },
  {
    icon: 'inbox',
    label: 'Inbox placement',
    value: '98.2%',
    note: 'Measured against live seed accounts, not estimated.',
    accent: 'green',
  },
  {
    icon: 'shield-halved',
    label: 'Blocklists',
    value: 'Clean',
    note: 'Every major list checked continuously for your domain and IP.',
    accent: 'violet',
  },
];

const CONSENT_FEATURES: { icon: string; title: string; body: string }[] = [
  {
    icon: 'sliders',
    title: 'Preference centre',
    body: 'People choose the channels and the frequency they want, and it applies everywhere at once.',
  },
  {
    icon: 'right-from-bracket',
    title: 'Hosted opt-out page',
    body: 'A one-tap unsubscribe that works from any message, on any channel, without a login.',
  },
  {
    icon: 'moon',
    title: 'Quiet hours',
    body: 'Messages hold until a reasonable local hour for the contact, not for your office.',
  },
  {
    icon: 'file-signature',
    title: 'Consent on record',
    body: 'When, where and how each person opted in is stored and exportable if you are ever asked.',
  },
];

const COMPLIANCE = ['TCPA', 'CAN-SPAM', 'GDPR', 'CASL'];

const PREFERENCES: { label: string; state: string; on: boolean }[] = [
  { label: 'Email — offers and new arrivals', state: 'On', on: true },
  { label: 'SMS — order and delivery updates', state: 'On', on: true },
  { label: 'SMS — promotions', state: 'Off', on: false },
  { label: 'Frequency', state: 'Weekly', on: true },
];

const VARIANTS: { name: string; subject: string; open: string; winner?: boolean }[] = [
  { name: 'Variant A', subject: 'Your spring picks are here', open: '31.2%' },
  { name: 'Variant B', subject: 'New season. 15% off through Sunday.', open: '38.7%', winner: true },
];

const SEND_TIMES: { label: string; weight: number; best?: boolean }[] = [
  { label: '8a', weight: 28 },
  { label: '10a', weight: 41 },
  { label: '12p', weight: 53 },
  { label: '2p', weight: 46 },
  { label: '4p', weight: 62 },
  { label: '6p', weight: 100, best: true },
  { label: '8p', weight: 74 },
  { label: '10p', weight: 37 },
];

const RESULTS: {
  key: string;
  label: string;
  target: number;
  decimals: number;
  prefix: string;
  suffix: string;
  grouped: boolean;
  accent: Accent;
}[] = [
  { key: 'sent', label: 'Messages sent', target: 128456, decimals: 0, prefix: '', suffix: '', grouped: true, accent: 'brand' },
  { key: 'open', label: 'Open rate', target: 34.6, decimals: 1, prefix: '', suffix: '%', grouped: false, accent: 'violet' },
  { key: 'click', label: 'Click rate', target: 7.2, decimals: 1, prefix: '', suffix: '%', grouped: false, accent: 'orange' },
  { key: 'revenue', label: 'Attributed revenue', target: 48721, decimals: 0, prefix: '$', suffix: '', grouped: true, accent: 'green' },
];

const TOP_CAMPAIGNS: {
  name: string;
  channel: string;
  sent: string;
  open: string;
  click: string;
  revenue: string;
}[] = [
  { name: 'Spring drop announcement', channel: 'Email + SMS', sent: '42,180', open: '38.4%', click: '8.9%', revenue: '$18,940' },
  { name: 'Abandoned cart journey', channel: 'Email', sent: '12,640', open: '46.2%', click: '12.4%', revenue: '$12,380' },
  { name: 'Win-back — 90 days', channel: 'SMS', sent: '8,920', open: '—', click: '9.1%', revenue: '$9,120' },
  { name: 'New arrivals weekly', channel: 'Email', sent: '43,376', open: '31.8%', click: '6.1%', revenue: '$8,281' },
];

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

type Styles = ReturnType<typeof createStyles>;

function useAccent() {
  const t = useTokens();
  return useCallback(
    (accent: Accent) =>
      accent === 'violet'
        ? t.violet
        : accent === 'green'
          ? t.green
          : accent === 'orange'
            ? t.orange
            : accent === 'pink'
              ? t.pink
              : t.brand,
    [t],
  );
}

/** Circular meter, drawn as real geometry so it stays round at any size. */
function ScoreRing({
  percent,
  display,
  caption,
  size,
  styles,
  t,
}: {
  percent: number;
  display: string;
  caption: string;
  size: number;
  styles: Styles;
  t: ThemeTokens;
}) {
  const stroke = size < 120 ? 8 : 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (circumference * percent) / 100;

  return (
    <View style={[styles.ringWrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={t.surfaceInset} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={t.green}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          rotation={-90}
          originX={size / 2}
          originY={size / 2}
          fill="none"
        />
      </Svg>
      <View style={styles.ringCentre} pointerEvents="none">
        <Text style={styles.ringValue}>{display}</Text>
        <Text style={styles.ringCaption}>{caption}</Text>
      </View>
    </View>
  );
}

function Tick({ text, styles, t }: { text: string; styles: Styles; t: ThemeTokens }) {
  return (
    <View style={styles.tickRow}>
      <View style={styles.tickDot}>
        <FontAwesome6 name="check" size={10} color={t.green} />
      </View>
      <Text style={styles.tickText}>{text}</Text>
    </View>
  );
}

function StepHead({
  index,
  eyebrow,
  title,
  body,
  center,
  styles,
  type,
}: {
  index: number;
  eyebrow: string;
  title: string;
  body: string;
  center?: boolean;
  styles: Styles;
  type: TypeScale;
}) {
  return (
    <View style={center ? styles.headCentered : styles.headLeft}>
      <View style={styles.eyebrowRow}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>{index < 10 ? `0${index}` : `${index}`}</Text>
        </View>
        <SectionLabel>{eyebrow}</SectionLabel>
      </View>
      <Heading level={2} style={center ? [type.h2, styles.headTitleCentered] : type.h2}>
        {title}
      </Heading>
      <Text style={[type.body, center ? styles.headSubCentered : styles.headSub]}>{body}</Text>
    </View>
  );
}

function ResultTile({
  stat,
  accent,
  styles,
  t,
}: {
  stat: (typeof RESULTS)[number];
  accent: string;
  styles: Styles;
  t: ThemeTokens;
}) {
  const counter = useCountUp(stat.target, { decimals: stat.decimals });
  const shown = stat.grouped
    ? Math.round(counter.value).toLocaleString('en-US')
    : counter.value.toFixed(stat.decimals);

  return (
    <View ref={counter.ref as never} style={styles.resultTile}>
      <View style={[styles.resultBar, { backgroundColor: accent }]} />
      <Text numberOfLines={1} style={styles.resultLabel}>
        {stat.label}
      </Text>
      <Text numberOfLines={1} style={styles.resultValue}>
        {`${stat.prefix}${shown}${stat.suffix}`}
      </Text>
      <Text numberOfLines={1} style={[styles.resultNote, { color: t.textSubtle }]}>
        Last 30 days
      </Text>
    </View>
  );
}

/** The email canvas + phone preview that carries the hero. */
function ComposerMock({ styles, t, l }: { styles: Styles; t: ThemeTokens; l: Layout }) {
  return (
    <View style={styles.composerCard}>
      <View style={styles.composerBar}>
        <View style={styles.composerBarCopy}>
          <View style={styles.composerBadge}>
            <FontAwesome6 name="envelope-open-text" size={13} color={t.brand} />
          </View>
          <View style={styles.composerBarText}>
            <Text numberOfLines={1} style={styles.composerTitle}>
              Campaign composer
            </Text>
            <Text numberOfLines={1} style={styles.composerSub}>
              Spring drop • email + SMS
            </Text>
          </View>
        </View>
        <View style={styles.readyChip}>
          <FontAwesome6 name="circle-check" size={11} color={t.successText} />
          <Text style={styles.readyChipText}>Ready</Text>
        </View>
      </View>

      <View style={styles.composerBody}>
        <View style={styles.emailPane}>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>SUBJECT</Text>
            <Text numberOfLines={1} style={styles.fieldValue}>
              New season. 15% off through Sunday.
            </Text>
          </View>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>PREVIEW</Text>
            <Text numberOfLines={1} style={styles.fieldValueMuted}>
              The spring collection just landed — your size included.
            </Text>
          </View>

          <View style={styles.emailCanvas}>
            <Media
              name="scenes/campaign-spring-model"
              alt="Branded email header for the spring campaign"
              style={styles.emailHero}
              radius={10}
            />
            <Text style={styles.emailHeadline}>The spring collection is here</Text>
            <Text style={styles.emailBody}>
              Lighter layers, softer soles and the fit you told us to keep. Fifteen per cent off
              everything new, through Sunday.
            </Text>
            <View style={styles.emailButton}>
              <Text style={styles.emailButtonText}>Shop the collection</Text>
            </View>
            <Text style={styles.emailFooter}>
              You are receiving this because you opted in. Unsubscribe any time.
            </Text>
          </View>
        </View>

        <View style={styles.phonePane}>
          <View style={styles.phoneFrame}>
            <View style={styles.phoneNotch} />
            <View style={styles.phoneHead}>
              <View style={styles.phoneAvatar}>
                <FontAwesome6 name="store" size={11} color={t.brand} />
              </View>
              <Text numberOfLines={1} style={styles.phoneName}>
                Aurora Home
              </Text>
            </View>
            <View style={styles.bubble}>
              <Text style={styles.bubbleText}>
                Aurora Home: the spring collection just landed — 15% off through Sunday. Shop:
                aur.ro/spring
              </Text>
              <Media
                name="product/canvas-tote"
                alt="Product image attached to the text message"
                style={styles.bubbleImage}
                radius={9}
              />
            </View>
            <Text style={styles.bubbleMeta}>Delivered 10:02 • Reply STOP to opt out</Text>
          </View>
        </View>
      </View>

      <View style={styles.composerCards}>
        <View style={styles.miniCard}>
          <Text style={styles.miniLabel}>AUDIENCE</Text>
          <Text style={styles.miniValue}>12,480</Text>
          <Text style={styles.miniNote}>contacts match, consent checked</Text>
          <View style={styles.miniChipRow}>
            {AUDIENCE_CHIPS.map((chip) => (
              <View key={chip} style={styles.miniChip}>
                <Text numberOfLines={1} style={styles.miniChipText}>
                  {chip}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.miniCard}>
          <Text style={styles.miniLabel}>DELIVERABILITY</Text>
          <View style={styles.deliveryRow}>
            <ScoreRing
              percent={98}
              display="98"
              caption="score"
              size={l.isPhone ? 92 : 104}
              styles={styles}
              t={t}
            />
            <View style={styles.deliveryList}>
              <View style={styles.excellentChip}>
                <Text style={styles.excellentText}>Excellent</Text>
              </View>
              {DELIVERY_ROWS.map((row) => (
                <View key={row.label} style={styles.deliveryItem}>
                  <Text numberOfLines={1} style={styles.deliveryItemLabel}>
                    {row.label}
                  </Text>
                  <Text numberOfLines={1} style={styles.deliveryItemValue}>
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function EmailSmsPage() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const open = useOpenSection();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);
  const accentOf = useAccent();
  const router = useRouter();

  const wideTable = !l.isCompact;

  return (
    <PageShell
      title="Email + SMS"
      description="Build campaigns and automated journeys for email, SMS and MMS — with segmentation, deliverability and consent handled for you."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Product', path: ROUTES.product },
          { name: 'Email + SMS', path: ROUTES.emailSms },
        ]),
      ]}>
      {/* ------------------------------------------------ hero */}
      <Reveal style={open} distance={22}>
        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            <SectionLabel>MESSAGING THAT REACHES PEOPLE</SectionLabel>
            <Heading level={1} style={[type.display, styles.heroTitle]}>
              Create smarter messages—and deliver them with confidence.
            </Heading>
            <Text style={[type.body, styles.heroBody]}>
              Design email and SMS campaigns, automate the journeys behind them, and know that what
              you send actually lands — with consent, quiet hours and deliverability built in.
            </Text>
            <View style={styles.heroButtons}>
              <ButtonRow>
                <PrimaryButton
                  label="Start free"
                  size="lg"
                  full={l.isPhone}
                  trackId="email-sms.hero.start-free"
                  onPress={() => Linking.openURL(EXTERNAL.signup)}
                />
                <SecondaryButton
                  label="Watch a demo"
                  size="lg"
                  icon="play"
                  full={l.isPhone}
                  trackId="email-sms.hero.demo"
                  onPress={() => router.push(contactHref('demo') as never)}
                />
              </ButtonRow>
            </View>
            <View style={styles.proofRow}>
              {PROOF.map((item) => (
                <View key={item} style={styles.proofItem}>
                  <View style={styles.proofIcon}>
                    <FontAwesome6 name="check" size={9} color={t.green} />
                  </View>
                  <Text numberOfLines={1} style={styles.proofText}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.heroVisual}>
            <ComposerMock styles={styles} t={t} l={l} />
          </View>
        </View>
      </Reveal>

      {/* ------------------------------------------------ 01 email builder */}
      <OpenSection>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <StepHead
              index={1}
              eyebrow="THE BUILDER"
              title="Drag-and-drop email, with a copy assistant beside you."
              body="Build the layout by moving blocks around, and let the assistant draft the words — then edit anything it wrote before a single send goes out."
              styles={styles}
              type={type}
            />
            <View style={styles.tickList}>
              {BUILDER_TICKS.map((item) => (
                <Tick key={item} text={item} styles={styles} t={t} />
              ))}
            </View>

            <View style={styles.includeCard}>
              <Text style={styles.includeLabel}>INCLUDED IN EVERY BUILD</Text>
              {BUILDER_INCLUDED.map((item) => (
                <View key={item.title} style={styles.includeRow}>
                  <View style={styles.includeIcon}>
                    <FontAwesome6 name={item.icon as never} size={12} color={t.brand} />
                  </View>
                  <View style={styles.includeCopy}>
                    <Text style={styles.includeTitle}>{item.title}</Text>
                    <Text style={styles.includeNote}>{item.note}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={90}>
            <View style={styles.panel}>
              <Text style={styles.panelLabel}>BLOCKS</Text>
              <View style={styles.blockWrap}>
                {BLOCKS.map((block) => (
                  <View key={block} style={styles.blockChip}>
                    <FontAwesome6 name="grip-vertical" size={9} color={t.textSubtle} />
                    <Text numberOfLines={1} style={styles.blockChipText}>
                      {block}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.canvasList}>
                {CANVAS_ROWS.map((row) => (
                  <View key={row.label} style={styles.canvasRow}>
                    <FontAwesome6 name="grip-vertical" size={12} color={t.textSubtle} />
                    <View style={styles.canvasIcon}>
                      <FontAwesome6 name={row.icon as never} size={12} color={t.brand} />
                    </View>
                    <View style={styles.canvasCopy}>
                      <Text numberOfLines={1} style={styles.canvasLabel}>
                        {row.label}
                      </Text>
                      <Text numberOfLines={1} style={styles.canvasNote}>
                        {row.note}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.assistCard}>
                <View style={styles.assistHead}>
                  <View style={styles.assistIcon}>
                    <FontAwesome6 name="wand-magic-sparkles" size={12} color={t.violet} />
                  </View>
                  <Text numberOfLines={1} style={styles.assistTitle}>
                    Copy assistant
                  </Text>
                </View>
                <View style={styles.assistChips}>
                  {ASSIST_CHIPS.map((chip) => (
                    <View key={chip} style={styles.assistChip}>
                      <Text numberOfLines={1} style={styles.assistChipText}>
                        {chip}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </Reveal>
        </View>
      </OpenSection>

      {/* ------------------------------------------------ 02 sms + mms */}
      <Band tone="surface">
        <View style={styles.splitRowFlip}>
          <Reveal style={styles.splitCopy} distance={16}>
            <StepHead
              index={2}
              eyebrow="SMS AND MMS"
              title="Messages that get read in the first three minutes."
              body="Text is the most immediate channel you have, which is exactly why it has to be used carefully. Every send is consented, capped and traceable to revenue."
              styles={styles}
              type={type}
            />
            <View style={styles.tickList}>
              {SMS_TICKS.map((item) => (
                <Tick key={item} text={item} styles={styles} t={t} />
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={90}>
            <View style={styles.panel}>
              <View style={styles.smsRow}>
                <View style={styles.phoneFrameCompact}>
                  <View style={styles.phoneNotch} />
                  <View style={styles.phoneHead}>
                    <View style={styles.phoneAvatar}>
                      <FontAwesome6 name="store" size={11} color={t.brand} />
                    </View>
                    <Text numberOfLines={1} style={styles.phoneName}>
                      Aurora Home
                    </Text>
                  </View>
                  <View style={styles.bubble}>
                    <Text style={styles.bubbleText}>
                      Your order is ready for pickup today until 6pm. Reply HELP for help, STOP to
                      opt out.
                    </Text>
                  </View>
                  <View style={styles.bubble}>
                    <Text style={styles.bubbleText}>
                      Spring drop is live — 15% off through Sunday: aur.ro/spring
                    </Text>
                    <Media
                      name="product/black-sneakers"
                      alt="Product image attached to the text message"
                      style={styles.bubbleImage}
                      radius={9}
                    />
                  </View>
                </View>

                <View style={styles.smsStats}>
                  {SMS_STATS.map((stat) => (
                    <View key={stat.label} style={styles.smsStatRow}>
                      <Text numberOfLines={2} style={styles.smsStatLabel}>
                        {stat.label}
                      </Text>
                      <Text numberOfLines={1} style={styles.smsStatValue}>
                        {stat.value}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </Reveal>
        </View>
      </Band>

      {/* ------------------------------------------------ 03 journeys */}
      <Band tone="violet">
        <StepHead
          index={3}
          eyebrow="AUTOMATED JOURNEYS"
          title="Automate the messages that earn the most."
          body="Four journeys do most of the work for most businesses. Turn them on, adjust the timing, and let them run in the background."
          center
          styles={styles}
          type={type}
        />

        <View style={styles.journeyGrid}>
          {JOURNEYS.map((journey, index) => {
            const accent = accentOf(journey.accent);
            return (
              <Reveal key={journey.title} style={styles.journeyCell} distance={16} delay={index * 65}>
                <View style={styles.journeyCard}>
                  <View style={[styles.journeyIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={journey.icon as never} size={18} color={accent} />
                  </View>
                  <Text style={[type.h4, styles.journeyTitle]}>{journey.title}</Text>
                  <View style={styles.triggerRow}>
                    <FontAwesome6 name="bolt" size={9} color={t.textSubtle} />
                    <Text numberOfLines={2} style={styles.triggerText}>
                      {journey.trigger}
                    </Text>
                  </View>
                  <View style={styles.stepList}>
                    {journey.steps.map((step) => (
                      <View key={step} style={styles.stepRow}>
                        <View style={[styles.stepDot, { backgroundColor: accent }]} />
                        <Text numberOfLines={1} style={styles.stepText}>
                          {step}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.cardSpacer} />
                  <View style={styles.resultChip}>
                    <Text numberOfLines={2} style={styles.resultChipText}>
                      {journey.result}
                    </Text>
                  </View>
                </View>
              </Reveal>
            );
          })}
        </View>
      </Band>

      {/* ------------------------------------------------ 04 segmentation */}
      <OpenSection>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <StepHead
              index={4}
              eyebrow="SEGMENTATION"
              title="Audiences built from what people just did."
              body="Segments read live signals from orders, browsing, calls and engagement — so the audience you send to at 9am is the one that exists at 9am."
              styles={styles}
              type={type}
            />
            <View style={styles.tickList}>
              {SEGMENT_TICKS.map((item) => (
                <Tick key={item} text={item} styles={styles} t={t} />
              ))}
            </View>
            <View style={styles.signalWrap}>
              {SIGNALS.map((signal) => (
                <View key={signal} style={styles.signalChip}>
                  <Text numberOfLines={1} style={styles.signalChipText}>
                    {signal}
                  </Text>
                </View>
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={90}>
            <View style={styles.panel}>
              <View style={styles.panelHead}>
                <View style={styles.panelIcon}>
                  <FontAwesome6 name="filter" size={14} color={t.brand} />
                </View>
                <View style={styles.panelHeadCopy}>
                  <Text numberOfLines={1} style={styles.panelTitle}>
                    Engaged spring buyers
                  </Text>
                  <Text numberOfLines={1} style={styles.panelSub}>
                    Live segment • updates continuously
                  </Text>
                </View>
              </View>

              <View style={styles.ruleList}>
                {SEGMENT_RULES.map((rule, index) => (
                  <View key={rule} style={styles.ruleGroup}>
                    <View style={styles.ruleRow}>
                      <View style={styles.ruleIcon}>
                        <FontAwesome6 name="check" size={9} color={t.brand} />
                      </View>
                      <Text style={styles.ruleText}>{rule}</Text>
                    </View>
                    {index < SEGMENT_RULES.length - 1 ? (
                      <View style={styles.andRow}>
                        <View style={styles.andLine} />
                        <Text style={styles.andText}>AND</Text>
                        <View style={styles.andLine} />
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>

              <View style={styles.matchCard}>
                <View style={styles.matchDot} />
                <Text numberOfLines={1} style={styles.matchValue}>
                  4,182
                </Text>
                <Text numberOfLines={2} style={styles.matchLabel}>
                  contacts match right now
                </Text>
              </View>
            </View>
          </Reveal>
        </View>
      </OpenSection>

      {/* ------------------------------------------------ 05 deliverability */}
      <Band tone="brand">
        <StepHead
          index={5}
          eyebrow="DELIVERABILITY"
          title="Sending you can trust."
          body="A campaign that lands in spam did not happen. Authentication, reputation and list hygiene are handled for you, and reported honestly."
          center
          styles={styles}
          type={type}
        />

        <View style={styles.deliverGrid}>
          <Reveal style={styles.deliverCell} distance={16}>
            <View style={styles.deliverCard}>
              <View style={[styles.deliverIcon, { backgroundColor: softFill(t.brand, t) }]}>
                <FontAwesome6 name="lock" size={16} color={t.brand} />
              </View>
              <Text style={styles.deliverLabel}>Authentication</Text>
              <View style={styles.authList}>
                {AUTH_ROWS.map((row) => (
                  <View key={row.label} style={styles.authRow}>
                    <Text numberOfLines={1} style={styles.authLabel}>
                      {row.label}
                    </Text>
                    <View style={styles.authPass}>
                      <FontAwesome6 name="check" size={8} color={t.successText} />
                      <Text style={styles.authPassText}>{row.value}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </Reveal>

          {DELIVERY_TILES.map((tile, index) => {
            const accent = accentOf(tile.accent);
            return (
              <Reveal key={tile.label} style={styles.deliverCell} distance={16} delay={(index + 1) * 65}>
                <View style={styles.deliverCard}>
                  <View style={[styles.deliverIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={tile.icon as never} size={16} color={accent} />
                  </View>
                  <Text style={styles.deliverLabel}>{tile.label}</Text>
                  <Text style={styles.deliverValue}>{tile.value}</Text>
                  <Text style={styles.deliverNote}>{tile.note}</Text>
                </View>
              </Reveal>
            );
          })}
        </View>
      </Band>

      {/* ------------------------------------------------ 06 consent */}
      <Band tone="orange">
        <View style={styles.splitRowFlip}>
          <Reveal style={styles.splitCopy} distance={16}>
            <StepHead
              index={6}
              eyebrow="CONSENT AND COMPLIANCE"
              title="Permission is part of the product, not a checkbox."
              body="People decide what they hear from you and how often. The rules that govern that are enforced by the platform, not by someone remembering them."
              styles={styles}
              type={type}
            />

            <View style={styles.consentGrid}>
              {CONSENT_FEATURES.map((item, index) => (
                <Reveal key={item.title} style={styles.consentCell} distance={14} delay={index * 60}>
                  <View style={styles.consentCard}>
                    <View style={styles.consentIcon}>
                      <FontAwesome6 name={item.icon as never} size={14} color={t.brand} />
                    </View>
                    <Text style={styles.consentTitle}>{item.title}</Text>
                    <Text style={styles.consentBody}>{item.body}</Text>
                  </View>
                </Reveal>
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={90}>
            <View style={styles.panel}>
              <View style={styles.panelHead}>
                <View style={styles.panelIcon}>
                  <FontAwesome6 name="sliders" size={14} color={t.brand} />
                </View>
                <View style={styles.panelHeadCopy}>
                  <Text numberOfLines={1} style={styles.panelTitle}>
                    Preference centre
                  </Text>
                  <Text numberOfLines={1} style={styles.panelSub}>
                    What this contact agreed to
                  </Text>
                </View>
              </View>

              <View style={styles.prefList}>
                {PREFERENCES.map((pref) => (
                  <View key={pref.label} style={styles.prefRow}>
                    <Text numberOfLines={2} style={styles.prefLabel}>
                      {pref.label}
                    </Text>
                    <View style={[styles.prefState, pref.on ? styles.prefStateOn : styles.prefStateOff]}>
                      <Text
                        numberOfLines={1}
                        style={[styles.prefStateText, pref.on ? styles.prefStateTextOn : styles.prefStateTextOff]}>
                        {pref.state}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.optOutCard}>
                <View style={styles.optOutIcon}>
                  <FontAwesome6 name="right-from-bracket" size={12} color={t.textMuted} />
                </View>
                <View style={styles.optOutCopy}>
                  <Text numberOfLines={1} style={styles.optOutTitle}>
                    Hosted opt-out page
                  </Text>
                  <Text numberOfLines={2} style={styles.optOutBody}>
                    One tap unsubscribes across every channel, instantly and everywhere.
                  </Text>
                </View>
              </View>

              <View style={styles.complianceRow}>
                {COMPLIANCE.map((item) => (
                  <View key={item} style={styles.complianceChip}>
                    <FontAwesome6 name="check" size={9} color={t.successText} />
                    <Text numberOfLines={1} style={styles.complianceText}>
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Reveal>
        </View>
      </Band>

      {/* ------------------------------------------------ 07 test and time */}
      <OpenSection>
        <StepHead
          index={7}
          eyebrow="TEST AND TIME IT"
          title="Test, optimise and send at the best time."
          body="Split a subject line, let the winner take the rest of the list, and send when this particular audience is actually reading."
          center
          styles={styles}
          type={type}
        />

        <View style={styles.pairGrid}>
          <Reveal style={styles.pairCell} distance={16}>
            <View style={styles.pairCard}>
              <View style={styles.pairHead}>
                <View style={[styles.pairIcon, { backgroundColor: softFill(t.violet, t) }]}>
                  <FontAwesome6 name="code-branch" size={16} color={t.violet} />
                </View>
                <View style={styles.pairHeadCopy}>
                  <Text style={[type.h4, styles.pairTitle]}>A/B subject line test</Text>
                  <Text numberOfLines={1} style={styles.pairSub}>
                    20% of the list • 4 hour window
                  </Text>
                </View>
              </View>

              {VARIANTS.map((variant) => (
                <View
                  key={variant.name}
                  style={[styles.variantRow, variant.winner ? styles.variantRowWinner : null]}>
                  <View style={styles.variantCopy}>
                    <Text numberOfLines={1} style={styles.variantName}>
                      {variant.name}
                    </Text>
                    <Text numberOfLines={2} style={styles.variantSubject}>
                      {variant.subject}
                    </Text>
                  </View>
                  <View style={styles.variantMeta}>
                    <Text numberOfLines={1} style={styles.variantOpen}>
                      {variant.open}
                    </Text>
                    {variant.winner ? (
                      <View style={styles.winnerChip}>
                        <Text style={styles.winnerText}>Winner</Text>
                      </View>
                    ) : (
                      <Text numberOfLines={1} style={styles.variantOpenLabel}>
                        open rate
                      </Text>
                    )}
                  </View>
                </View>
              ))}

              <Text style={styles.pairNote}>
                The winning subject is sent to the remaining 80% automatically, no reminder needed.
              </Text>
            </View>
          </Reveal>

          <Reveal style={styles.pairCell} distance={16} delay={90}>
            <View style={styles.pairCard}>
              <View style={styles.pairHead}>
                <View style={[styles.pairIcon, { backgroundColor: softFill(t.orange, t) }]}>
                  <FontAwesome6 name="clock" size={16} color={t.orange} />
                </View>
                <View style={styles.pairHeadCopy}>
                  <Text style={[type.h4, styles.pairTitle]}>Send-time optimisation</Text>
                  <Text numberOfLines={1} style={styles.pairSub}>
                    Engagement by hour • last 90 days
                  </Text>
                </View>
              </View>

              <View style={styles.chartRow}>
                {SEND_TIMES.map((slot) => (
                  <View key={slot.label} style={styles.chartCell}>
                    <View
                      style={[
                        styles.chartBar,
                        {
                          height: Math.max(8, Math.round((slot.weight / 100) * 96)),
                          backgroundColor: slot.best ? t.orange : t.surfaceInset,
                        },
                      ]}
                    />
                    <Text numberOfLines={1} style={[styles.chartLabel, slot.best ? styles.chartLabelBest : null]}>
                      {slot.label}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.bestSlot}>
                <FontAwesome6 name="star" size={11} color={t.warnText} />
                <Text style={styles.bestSlotText}>
                  6:30pm on Thursday is this audience&apos;s strongest slot — scheduled by default.
                </Text>
              </View>
            </View>
          </Reveal>
        </View>
      </OpenSection>

      {/* ------------------------------------------------ 08 measure */}
      <Band tone="green">
        <StepHead
          index={8}
          eyebrow="PROVE THE IMPACT"
          title="Measure performance and prove real revenue."
          body="Opens are a signal, not a result. Every campaign is reported against the orders it actually produced."
          center
          styles={styles}
          type={type}
        />

        <View style={styles.resultGrid}>
          {RESULTS.map((stat, index) => (
            <Reveal key={stat.key} style={styles.resultCell} distance={14} delay={index * 60}>
              <ResultTile stat={stat} accent={accentOf(stat.accent)} styles={styles} t={t} />
            </Reveal>
          ))}
        </View>

        <View style={styles.tableCard}>
          <View style={styles.tableHeadRow}>
            <Text numberOfLines={1} style={styles.tableCaption}>
              Top campaigns this month
            </Text>
            <View style={styles.tableChip}>
              <Text style={styles.tableChipText}>Last 30 days</Text>
            </View>
          </View>

          {wideTable ? (
            <View style={styles.tableHeader}>
              <Text numberOfLines={1} style={[styles.tableHeaderCell, styles.colName]}>
                Campaign
              </Text>
              <Text numberOfLines={1} style={[styles.tableHeaderCell, styles.colChannel]}>
                Channel
              </Text>
              <Text numberOfLines={1} style={[styles.tableHeaderCell, styles.colNumber]}>
                Sent
              </Text>
              <Text numberOfLines={1} style={[styles.tableHeaderCell, styles.colNumber]}>
                Open
              </Text>
              <Text numberOfLines={1} style={[styles.tableHeaderCell, styles.colNumber]}>
                Click
              </Text>
              <Text numberOfLines={1} style={[styles.tableHeaderCell, styles.colRevenue]}>
                Revenue
              </Text>
            </View>
          ) : null}

          <View style={styles.tableBody}>
            {TOP_CAMPAIGNS.map((row) =>
              wideTable ? (
                <View key={row.name} style={styles.tableRow}>
                  <Text numberOfLines={1} style={[styles.cellName, styles.colName]}>
                    {row.name}
                  </Text>
                  <Text numberOfLines={1} style={[styles.cellMuted, styles.colChannel]}>
                    {row.channel}
                  </Text>
                  <Text numberOfLines={1} style={[styles.cellMuted, styles.colNumber]}>
                    {row.sent}
                  </Text>
                  <Text numberOfLines={1} style={[styles.cellMuted, styles.colNumber]}>
                    {row.open}
                  </Text>
                  <Text numberOfLines={1} style={[styles.cellMuted, styles.colNumber]}>
                    {row.click}
                  </Text>
                  <Text numberOfLines={1} style={[styles.cellRevenue, styles.colRevenue]}>
                    {row.revenue}
                  </Text>
                </View>
              ) : (
                <View key={row.name} style={styles.stackedRow}>
                  <Text numberOfLines={2} style={styles.cellName}>
                    {row.name}
                  </Text>
                  <Text numberOfLines={1} style={styles.stackedChannel}>
                    {row.channel}
                  </Text>
                  <View style={styles.stackedMetrics}>
                    <View style={styles.stackedMetric}>
                      <Text style={styles.stackedMetricLabel}>Sent</Text>
                      <Text numberOfLines={1} style={styles.stackedMetricValue}>
                        {row.sent}
                      </Text>
                    </View>
                    <View style={styles.stackedMetric}>
                      <Text style={styles.stackedMetricLabel}>Open</Text>
                      <Text numberOfLines={1} style={styles.stackedMetricValue}>
                        {row.open}
                      </Text>
                    </View>
                    <View style={styles.stackedMetric}>
                      <Text style={styles.stackedMetricLabel}>Click</Text>
                      <Text numberOfLines={1} style={styles.stackedMetricValue}>
                        {row.click}
                      </Text>
                    </View>
                    <View style={styles.stackedMetric}>
                      <Text style={styles.stackedMetricLabel}>Revenue</Text>
                      <Text numberOfLines={1} style={styles.stackedMetricRevenue}>
                        {row.revenue}
                      </Text>
                    </View>
                  </View>
                </View>
              ),
            )}
          </View>
        </View>
      </Band>
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

  const journeyColumns = columns(1, 2, 4, 4); // 4 cards
  const deliverColumns = columns(1, 2, 4, 4); // 4 cards
  const consentColumns = columns(1, 2, 2, 2); // 4 cards
  const pairColumns = columns(1, 1, 2, 2); // 2 cards
  const resultColumns = columns(2, 4, 4, 4); // 4 tiles

  const cardBase: ViewStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    backgroundColor: t.surfaceRaised,
    padding: l.isPhone ? 16 : 20,
    ...(elevation(t, 1) as ViewStyle),
  };

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

  const emailHero: ImageStyle = { width: '100%', height: l.isPhone ? 108 : 124 };
  const bubbleImage: ImageStyle = { width: '100%', height: 78 };

  /* Fixed table columns — the layout falls back to stacked cards below 1024. */
  const colChannel = l.isDesktop ? 118 : 100;
  const colNumber = l.isDesktop ? 82 : 70;
  const colRevenue = l.isDesktop ? 100 : 88;

  return StyleSheet.create({
    /* -------------------------------------------------- hero */
    heroRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'center',
      gap: stacked ? 28 : 40,
    },
    heroCopy: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 400, minWidth: 300 },
    heroTitle: { marginTop: 14 },
    heroBody: { marginTop: 14, maxWidth: 540 },
    heroButtons: { marginTop: 22 },
    proofRow: {
      marginTop: 20,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: l.isPhone ? 10 : 18,
    },
    proofItem: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
    proofIcon: {
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
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 }
      : { flexGrow: 1.5, flexShrink: 1, flexBasis: 580, minWidth: 0 },

    /* -------------------------------------------------- composer */
    composerCard: {
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 12 : 16,
      gap: 12,
      ...(elevation(t, 3) as ViewStyle),
    },
    composerBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    composerBarCopy: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    composerBadge: {
      width: 32,
      height: 32,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    composerBarText: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    composerTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    composerSub: { ...type.micro, color: t.textSubtle },
    readyChip: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: t.successBg,
    },
    readyChipText: { ...type.micro, color: t.successText, fontWeight: '800' },

    composerBody: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: l.isPhone ? 'stretch' : 'flex-start',
      gap: 12,
    },
    emailPane: l.isPhone
      ? { width: '100%', minWidth: 0, gap: 8 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 8 },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    fieldLabel: {
      ...type.micro,
      color: t.textSubtle,
      fontWeight: '800',
      letterSpacing: 0.8,
      flexGrow: 0,
      flexShrink: 0,
    },
    fieldValue: { ...type.micro, color: t.text, fontWeight: '700', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    fieldValueMuted: { ...type.micro, color: t.textMuted, flexGrow: 1, flexShrink: 1, minWidth: 0 },
    emailCanvas: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      padding: 12,
      gap: 9,
    },
    emailHero,
    emailHeadline: { fontSize: l.isPhone ? 16 : 18, lineHeight: l.isPhone ? 21 : 24, fontWeight: '800', color: t.text },
    emailBody: { ...type.micro, color: t.textMuted },
    emailButton: {
      alignSelf: 'flex-start',
      borderRadius: 9,
      paddingHorizontal: 14,
      paddingVertical: 9,
      backgroundColor: t.brand,
    },
    emailButtonText: { ...type.micro, color: t.textOnBrand, fontWeight: '800' },
    emailFooter: { ...type.micro, color: t.textSubtle },

    phonePane: l.isPhone
      ? { width: '100%', minWidth: 0, alignItems: 'center' }
      : { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: 196, alignItems: 'stretch' },
    phoneFrame: {
      width: l.isPhone ? 210 : '100%',
      borderWidth: 6,
      borderColor: t.borderStrong,
      borderRadius: 26,
      backgroundColor: t.surfaceRaised,
      padding: 10,
      gap: 9,
    },
    phoneFrameCompact: {
      width: l.isPhone ? 210 : 200,
      flexGrow: 0,
      flexShrink: 0,
      alignSelf: l.isPhone ? 'center' : 'flex-start',
      borderWidth: 6,
      borderColor: t.borderStrong,
      borderRadius: 26,
      backgroundColor: t.surfaceRaised,
      padding: 10,
      gap: 9,
    },
    phoneNotch: {
      width: 52,
      height: 5,
      borderRadius: 3,
      alignSelf: 'center',
      backgroundColor: t.surfaceInset,
    },
    phoneHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    phoneAvatar: {
      width: 24,
      height: 24,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    phoneName: { ...type.micro, color: t.text, fontWeight: '800', flexShrink: 1, minWidth: 0 },
    bubble: {
      borderRadius: 14,
      borderTopLeftRadius: 5,
      backgroundColor: t.surfaceInset,
      padding: 10,
      gap: 8,
    },
    bubbleText: { ...type.micro, color: t.text },
    bubbleImage,
    bubbleMeta: { ...type.micro, color: t.textSubtle, textAlign: 'center' },

    composerCards: {
      flexDirection: l.isCompact ? 'column' : 'row',
      alignItems: 'stretch',
      gap: 10,
    },
    miniCard: l.isCompact
      ? {
          width: '100%',
          minWidth: 0,
          gap: 7,
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 14,
          backgroundColor: t.surfaceRaised,
          padding: 13,
        }
      : {
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 0,
          minWidth: 0,
          gap: 7,
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 14,
          backgroundColor: t.surfaceRaised,
          padding: 13,
        },
    miniLabel: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 0.9 },
    miniValue: { fontSize: l.isPhone ? 22 : 26, lineHeight: l.isPhone ? 27 : 31, fontWeight: '800', color: t.text },
    miniNote: { ...type.micro, color: t.textSubtle },
    miniChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    miniChip: {
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      backgroundColor: t.chipBg,
    },
    miniChipText: { ...type.micro, color: t.chipText, fontWeight: '700' },

    deliveryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
    deliveryList: { flexGrow: 1, flexShrink: 1, flexBasis: 120, minWidth: 0, gap: 5 },
    excellentChip: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: t.successBg,
    },
    excellentText: { ...type.micro, color: t.successText, fontWeight: '800' },
    deliveryItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    deliveryItemLabel: { ...type.micro, color: t.textSubtle, flexShrink: 1, minWidth: 0 },
    deliveryItemValue: { ...type.micro, color: t.text, fontWeight: '800', flexGrow: 0, flexShrink: 0 },

    ringWrap: { alignItems: 'center', justifyContent: 'center', position: 'relative', flexGrow: 0, flexShrink: 0 },
    ringCentre: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 1,
    },
    ringValue: { fontSize: l.isPhone ? 22 : 26, lineHeight: l.isPhone ? 27 : 31, fontWeight: '800', color: t.text },
    ringCaption: { ...type.micro, color: t.textSubtle, fontWeight: '700' },

    /* -------------------------------------------------- numbered heads */
    headLeft: { gap: 11, alignItems: 'flex-start' },
    headCentered: { gap: 11, alignItems: l.isPhone ? 'flex-start' : 'center' },
    eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stepBadge: {
      width: 34,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
      borderWidth: 1,
      borderColor: hexToRgba(t.brand, 0.35),
    },
    stepBadgeText: { fontSize: 13, lineHeight: 17, fontWeight: '800', color: t.brand },
    headTitleCentered: { textAlign: l.isPhone ? 'left' : 'center' },
    headSub: { maxWidth: 560 },
    headSubCentered: { textAlign: l.isPhone ? 'left' : 'center', maxWidth: 680 },

    /* -------------------------------------------------- split rows */
    splitRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: stacked ? 28 : 40,
    },
    splitRowFlip: {
      flexDirection: stacked ? 'column' : 'row-reverse',
      alignItems: 'flex-start',
      gap: stacked ? 28 : 40,
    },
    splitCopy: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    splitVisual: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },

    tickList: { marginTop: 22, gap: 14 },
    tickRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    tickDot: {
      width: 22,
      height: 22,
      marginTop: 1,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.green, t),
    },
    tickText: { ...type.bodySm, color: t.textMuted, flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- what's included */
    includeCard: {
      marginTop: 22,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 18,
      gap: 12,
    },
    includeLabel: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 0.9 },
    includeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    includeIcon: {
      width: 30,
      height: 30,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    includeCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    includeTitle: { ...type.caption, color: t.text, fontWeight: '800' },
    includeNote: { ...type.caption, color: t.textMuted },

    /* -------------------------------------------------- generic panel */
    panel: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 15 : 20,
      gap: 14,
      ...(elevation(t, 2) as ViewStyle),
    },
    panelHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    panelIcon: {
      width: 36,
      height: 36,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    panelHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    panelTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    panelSub: { ...type.micro, color: t.textSubtle },
    panelLabel: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 0.9 },

    /* -------------------------------------------------- builder */
    blockWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    blockChip: {
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 999,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 11,
      paddingVertical: 6,
    },
    blockChipText: { ...type.micro, color: t.textMuted, fontWeight: '700' },
    canvasList: { gap: 8 },
    canvasRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 11,
      paddingVertical: 10,
    },
    canvasIcon: {
      width: 30,
      height: 30,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    canvasCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    canvasLabel: { ...type.micro, color: t.text, fontWeight: '800' },
    canvasNote: { ...type.micro, color: t.textSubtle },
    assistCard: {
      borderWidth: 1,
      borderColor: hexToRgba(t.violet, 0.35),
      borderRadius: 14,
      backgroundColor: softFill(t.violet, t),
      padding: 12,
      gap: 9,
    },
    assistHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    assistIcon: {
      width: 26,
      height: 26,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceRaised,
    },
    assistTitle: { ...type.micro, color: t.text, fontWeight: '800', flexShrink: 1, minWidth: 0 },
    assistChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    assistChip: {
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: t.surfaceRaised,
    },
    assistChipText: { ...type.micro, color: t.violet, fontWeight: '700' },

    /* -------------------------------------------------- sms */
    smsRow: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: l.isPhone ? 'stretch' : 'flex-start',
      gap: 14,
    },
    smsStats: l.isPhone
      ? { width: '100%', minWidth: 0, gap: 8 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 8 },
    smsStatRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      minHeight: 48,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    smsStatLabel: { ...type.caption, color: t.textMuted, flexShrink: 1, minWidth: 0 },
    smsStatValue: { ...type.caption, color: t.text, fontWeight: '800', flexGrow: 0, flexShrink: 0 },

    /* -------------------------------------------------- journeys */
    journeyGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 28) - half },
    journeyCell: cellBase(journeyColumns),
    journeyCard: { ...cardBase, gap: 10, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    journeyIcon: {
      width: 44,
      height: 44,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    journeyTitle: { marginTop: 2 },
    triggerRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    triggerText: { ...type.micro, color: t.textSubtle, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    stepList: { gap: 7, marginTop: 2 },
    stepRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    stepDot: { width: 7, height: 7, borderRadius: 4, flexGrow: 0, flexShrink: 0 },
    stepText: { ...type.caption, color: t.textMuted, flexShrink: 1, minWidth: 0 },
    cardSpacer: { flexGrow: 1, flexShrink: 0, flexBasis: 'auto', minHeight: 6 },
    resultChip: {
      alignSelf: 'flex-start',
      maxWidth: '100%',
      borderRadius: 10,
      paddingHorizontal: 11,
      paddingVertical: 7,
      backgroundColor: t.successBg,
    },
    resultChipText: { ...type.micro, color: t.successText, fontWeight: '800' },

    /* -------------------------------------------------- segmentation */
    signalWrap: { marginTop: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    signalChip: {
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 999,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    signalChipText: { ...type.micro, color: t.textMuted, fontWeight: '700' },

    ruleList: { gap: 0 },
    ruleGroup: { gap: 0 },
    ruleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    ruleIcon: {
      width: 22,
      height: 22,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    ruleText: { ...type.caption, color: t.text, fontWeight: '600', flexShrink: 1, minWidth: 0 },
    andRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7, paddingHorizontal: 12 },
    andLine: { flexGrow: 1, flexShrink: 1, flexBasis: 0, height: 1, backgroundColor: t.divider },
    andText: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 0.8 },

    matchCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap',
      borderWidth: 1,
      borderColor: hexToRgba(t.brand, 0.4),
      borderRadius: 14,
      backgroundColor: t.brandSoft,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    matchDot: { width: 8, height: 8, borderRadius: 4, flexGrow: 0, flexShrink: 0, backgroundColor: t.brand },
    matchValue: { fontSize: l.isPhone ? 22 : 26, lineHeight: l.isPhone ? 27 : 31, fontWeight: '800', color: t.brand },
    matchLabel: { ...type.caption, color: t.textMuted, flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- deliverability */
    deliverGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 28) - half },
    deliverCell: cellBase(deliverColumns),
    deliverCard: { ...cardBase, gap: 9, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    deliverIcon: {
      width: 42,
      height: 42,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deliverLabel: { ...type.bodySm, color: t.text, fontWeight: '800' },
    deliverValue: { fontSize: l.isPhone ? 24 : 28, lineHeight: l.isPhone ? 29 : 34, fontWeight: '800', color: t.text },
    deliverNote: { ...type.caption, color: t.textMuted },
    authList: { gap: 7, marginTop: 2 },
    authRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    authLabel: { ...type.caption, color: t.textMuted, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    authPass: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 3,
      backgroundColor: t.successBg,
    },
    authPassText: { ...type.micro, color: t.successText, fontWeight: '800' },

    /* -------------------------------------------------- consent */
    consentGrid: { ...gridBase, marginTop: 22 - half },
    consentCell: cellBase(consentColumns),
    consentCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
      padding: 14,
      gap: 9,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    consentIcon: {
      width: 36,
      height: 36,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    consentTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    consentBody: { ...type.caption, color: t.textMuted },

    prefList: { gap: 8 },
    prefRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      minHeight: 48,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    prefLabel: { ...type.caption, color: t.textMuted, flexShrink: 1, minWidth: 0 },
    prefState: { flexGrow: 0, flexShrink: 0, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4 },
    prefStateOn: { backgroundColor: t.successBg },
    prefStateOff: { backgroundColor: t.surfaceInset },
    prefStateText: { ...type.micro, fontWeight: '800' },
    prefStateTextOn: { color: t.successText },
    prefStateTextOff: { color: t.textSubtle },

    optOutCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 11,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surfaceRaised,
      padding: 12,
    },
    optOutIcon: {
      width: 30,
      height: 30,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceInset,
    },
    optOutCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    optOutTitle: { ...type.micro, color: t.text, fontWeight: '800' },
    optOutBody: { ...type.micro, color: t.textSubtle },

    complianceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    complianceChip: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 6,
      backgroundColor: t.successBg,
    },
    complianceText: { ...type.micro, color: t.successText, fontWeight: '800' },

    /* -------------------------------------------------- test + timing */
    pairGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 28) - half },
    pairCell: cellBase(pairColumns),
    pairCard: { ...cardBase, gap: 12, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    pairHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    pairIcon: {
      width: 44,
      height: 44,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pairHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 4 },
    pairTitle: {},
    pairSub: { ...type.micro, color: t.textSubtle },
    pairNote: { ...type.caption, color: t.textMuted },

    variantRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 13,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 13,
      paddingVertical: 12,
    },
    variantRowWinner: { borderColor: hexToRgba(t.green, 0.45), backgroundColor: t.successBg },
    variantCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    variantName: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 0.6 },
    variantSubject: { ...type.caption, color: t.text, fontWeight: '700' },
    variantMeta: { flexGrow: 0, flexShrink: 0, alignItems: 'flex-end', gap: 4 },
    variantOpen: { fontSize: l.isPhone ? 17 : 19, lineHeight: l.isPhone ? 22 : 24, fontWeight: '800', color: t.text },
    variantOpenLabel: { ...type.micro, color: t.textSubtle },
    winnerChip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: t.green },
    winnerText: { ...type.micro, color: t.textOnBrand, fontWeight: '800' },

    chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, minHeight: 118 },
    chartCell: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, alignItems: 'center', gap: 7 },
    chartBar: { width: '100%', borderRadius: 6 },
    chartLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    chartLabelBest: { color: t.orange, fontWeight: '800' },
    bestSlot: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 9,
      borderRadius: 12,
      backgroundColor: t.warnBg,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    bestSlotText: { ...type.micro, color: t.warnText, fontWeight: '600', flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- results */
    resultGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 28) - half },
    resultCell: cellBase(resultColumns),
    resultTile: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 18,
      gap: 6,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    resultBar: { width: 28, height: 4, borderRadius: 2, marginBottom: 4 },
    resultLabel: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 0.6 },
    resultValue: {
      fontSize: l.isPhone ? 24 : 32,
      lineHeight: l.isPhone ? 29 : 38,
      fontWeight: '800',
      color: t.text,
    },
    resultNote: { ...type.micro },

    tableCard: {
      marginTop: l.isPhone ? 14 : 20,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 14 : 18,
      gap: 12,
      ...(elevation(t, 1) as ViewStyle),
    },
    tableHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
    tableCaption: { ...type.bodySm, color: t.text, fontWeight: '800', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    tableChip: {
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 5,
      backgroundColor: t.chipBg,
    },
    tableChipText: { ...type.micro, color: t.chipText, fontWeight: '800' },
    tableHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 12,
      paddingBottom: 2,
    },
    tableHeaderCell: {
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
      borderRadius: 12,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    colName: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    colChannel: { width: colChannel, flexGrow: 0, flexShrink: 0 },
    colNumber: { width: colNumber, flexGrow: 0, flexShrink: 0 },
    colRevenue: { width: colRevenue, flexGrow: 0, flexShrink: 0 },
    cellName: { ...type.caption, color: t.text, fontWeight: '700' },
    cellMuted: { ...type.caption, color: t.textMuted },
    cellRevenue: { ...type.caption, color: t.successText, fontWeight: '800' },

    stackedRow: {
      gap: 9,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 13,
      paddingVertical: 12,
    },
    stackedChannel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    stackedMetrics: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
    stackedMetric: {
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: cellBasis(2),
      minWidth: 0,
      paddingHorizontal: 4,
      paddingVertical: 4,
      gap: 2,
    },
    stackedMetricLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    stackedMetricValue: { ...type.caption, color: t.text, fontWeight: '800' },
    stackedMetricRevenue: { ...type.caption, color: t.successText, fontWeight: '800' },
  });
}
