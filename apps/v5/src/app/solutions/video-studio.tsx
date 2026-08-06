import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Linking, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Connectors, ConnectorSurface, useConnectorField, type Link as Wire } from '@/components/public/connectors';
import { Media } from '@/components/public/media';
import { Animated, Reveal, useCountUp, useGrowIn } from '@/components/public/motion';
import { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd, faqJsonLd } from '@/components/public/seo';
import {
  ButtonRow,
  Heading,
  PrimaryButton,
  SecondaryButton,
  Band,
  OpenSection,
  SectionLabel,
  TextLink,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { contactHref, EXTERNAL } from '@/lib/destinations';
import { elevation, hexToRgba, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

type Accent = 'brand' | 'violet' | 'orange' | 'green' | 'pink';

const PROOF = ['No credit card required', 'Built for small teams', 'Publishes where you already are'];

/** The trust strip under the hero. Five, so it divides at 1 and 5. */
const TRUST = [
  { key: 'trial', icon: 'gift', label: 'Free to start' },
  { key: 'stack', icon: 'layer-group', label: 'One growth workspace' },
  { key: 'ai', icon: 'wand-magic-sparkles', label: 'FlowAgent automation' },
  { key: 'card', icon: 'credit-card', label: 'No card to begin' },
  { key: 'cancel', icon: 'circle-check', label: 'Cancel anytime' },
];

/** The performance row inside the player card. Illustrative, and labelled so. */
const PLAYER_STATS: { key: string; label: string; value: number; suffix: string; delta: string }[] = [
  { key: 'views', label: 'Views', value: 124.6, suffix: 'K', delta: '+32%' },
  { key: 'engagement', label: 'Engagement', value: 8.2, suffix: 'K', delta: '+28%' },
  { key: 'ctr', label: 'Click rate', value: 5.4, suffix: '%', delta: '+41%' },
];

/** Where one finished cut goes. Seven, laid out as a single measured column. */
const CHANNELS: { key: string; icon: string; label: string; state: string; accent: Accent }[] = [
  { key: 'social', icon: 'heart', label: 'Social', state: 'Published', accent: 'pink' },
  { key: 'email', icon: 'envelope', label: 'Email', state: 'Sent', accent: 'brand' },
  { key: 'sms', icon: 'comment-dots', label: 'SMS', state: 'Delivered', accent: 'green' },
  { key: 'ads', icon: 'bullhorn', label: 'Ads', state: 'Active', accent: 'violet' },
  { key: 'shop', icon: 'bag-shopping', label: 'FlowShop', state: 'Featured', accent: 'orange' },
  { key: 'local', icon: 'map-location-dot', label: 'Local', state: 'Updated', accent: 'green' },
  { key: 'analytics', icon: 'chart-pie', label: 'Analytics', state: 'Tracking', accent: 'brand' },
];

/**
 * The eight things the studio makes. Eight divides by 1, 2 and 4, so the grid
 * never strands a card whatever the breakpoint.
 *
 * Four carry a real photograph that already exists in the registry; the other
 * four are designed mocks, because the honest alternative — a placeholder box
 * where a stock photo should be — is not a page anyone can review.
 */
type Craft = {
  key: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  accent: Accent;
  icon: string;
  media?: string;
  alt?: string;
  mock?: 'timeline' | 'waveform' | 'presenter' | 'chart';
};

const CRAFT: Craft[] = [
  {
    key: 'films',
    title: 'Campaign films',
    body: 'Brand and campaign videos built from a brief, cut to the length each placement needs.',
    cta: 'Plan a film',
    href: ROUTES.aiStudio,
    accent: 'brand',
    icon: 'clapperboard',
    media: 'video/ad-automotive',
    alt: 'A cinematic campaign film still of a car on a coastal road at sunset',
  },
  {
    key: 'ugc',
    title: 'UGC ads',
    body: 'Creator-style ads that look filmed on a phone, because that is what people stop for.',
    cta: 'Make a UGC ad',
    href: ROUTES.ads,
    accent: 'pink',
    icon: 'mobile-screen',
    media: 'video/ugc-unboxing',
    alt: 'A creator filming an unboxing on a phone mounted on a tripod',
  },
  {
    key: 'product',
    title: 'Product ads',
    body: 'One product shot becomes a scroll-stopping ad, with the price and offer burned in.',
    cta: 'Build a product ad',
    href: ROUTES.flowshop,
    accent: 'orange',
    media: 'video/ad-fragrance',
    alt: 'A fragrance bottle lit for a product advert, wrapped in a swirl of light',
    icon: 'bag-shopping',
  },
  {
    key: 'presentations',
    title: 'Video presentations',
    body: 'Record once, and the deck, the captions and the chapter list come with it.',
    cta: 'Record a presentation',
    href: ROUTES.trainingStudio,
    accent: 'violet',
    icon: 'chalkboard-user',
    mock: 'presenter',
  },
  {
    key: 'voice',
    title: 'Voice and narration',
    body: 'Natural voiceover in the languages your customers actually speak, from the same script.',
    cta: 'Add a voiceover',
    href: ROUTES.aiStudio,
    accent: 'green',
    icon: 'microphone-lines',
    media: 'video/voice-studio',
    alt: 'A studio microphone in front of a waveform and a row of video scenes',
  },
  {
    key: 'spokesperson',
    title: 'AI spokesperson',
    body: 'A presenter who never needs a second take, on brand and on script every time.',
    cta: 'Create a presenter video',
    href: ROUTES.aiStudio,
    accent: 'brand',
    icon: 'user-tie',
    media: 'video/voice-anchor',
    alt: 'A presenter delivering a scripted piece to camera on a broadcast set',
  },
  {
    key: 'social',
    title: 'Social video',
    body: 'Resize, caption and reframe automatically, so one cut fits every feed it lands in.',
    cta: 'Cut for social',
    href: ROUTES.social,
    accent: 'violet',
    media: 'video/ugc-beauty',
    alt: 'A creator filming a vertical social video on a phone',
    icon: 'scissors',
  },
  {
    key: 'analytics',
    title: 'Video analytics',
    body: 'Which cut earned the revenue, which thumbnail earned the click, and what to make next.',
    cta: 'See the reporting',
    href: ROUTES.analytics,
    accent: 'green',
    icon: 'chart-column',
    mock: 'chart',
  },
];

/** What FlowAgent does with a video brief. Three, divides at 1 and 3. */
const AI_STEPS = [
  { key: 'plan', icon: 'list-check', label: 'Writes the script, the shot list and the storyboard' },
  { key: 'edit', icon: 'scissors', label: 'Cuts, dubs and captions without a round trip' },
  { key: 'publish', icon: 'paper-plane', label: 'Publishes everywhere and watches what worked' },
];

const QUOTES: { key: string; quote: string; name: string; role: string; media: string }[] = [
  {
    key: 'q1',
    quote:
      'We were paying an agency for four videos a month. We now make more than that in a week, and they perform better because we can actually test them.',
    name: 'Megan Roberts',
    role: 'Founder, Bright Smile Dental',
    media: 'people/megan-roberts',
  },
  {
    key: 'q2',
    quote:
      'The presenter videos are the part I did not expect to like. Same script, six languages, and our Spanish-speaking customers finally get the same explanation.',
    name: 'Carlos Ramirez',
    role: 'Marketing Lead, Solara',
    media: 'people/carlos-ramirez',
  },
  {
    key: 'q3',
    quote:
      'Everything we need to shoot, cut and publish is in one place. No exporting, no re-uploading, no wondering which version went out.',
    name: 'Priya Shah',
    role: 'Content Director, Harbor & Co.',
    media: 'people/priya-shah',
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Do I need to film anything myself?',
    a: 'Only if you want to. You can start from a product photo, a script, or your own footage — and mix all three in the same cut.',
  },
  {
    q: 'Can I use my own voice?',
    a: 'Yes. You can record narration, use a generated voice, or clone your own and keep the same delivery across every language.',
  },
  {
    q: 'What formats does it export?',
    a: 'Every placement the platform publishes to, sized and captioned automatically — square, vertical, landscape and the ad sizes each network requires.',
  },
  {
    q: 'Where do the finished videos go?',
    a: 'Straight into the same workspace as your posts, emails, ads and storefront, so publishing is a choice rather than another upload.',
  },
];

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

/** The distribution rail: one hub, seven measured channel cards, real wires. */
function ChannelRail({ styles, t, accentOf }: { styles: Styles; t: ThemeTokens; accentOf: (a: Accent) => string }) {
  const field = useConnectorField();
  const links = useMemo<Wire[]>(() => CHANNELS.map((c) => ['hub', c.key] as const), []);
  return (
    <ConnectorSurface field={field} style={styles.rail}>
      <Connectors field={field} links={links} color={t.brand} circular={['hub']} strokeWidth={1.5} dash="0.5 5" flow />
      <View {...field.node('hub')} style={styles.railHub}>
        <FontAwesome6 name="film" size={16} color={t.textOnBrand} />
      </View>
      <View style={styles.railColumn}>
        {CHANNELS.map((channel) => (
          <View key={channel.key} {...field.node(channel.key)} style={styles.railCard}>
            <View style={[styles.railIcon, { backgroundColor: softFill(accentOf(channel.accent), t) }]}>
              <FontAwesome6 name={channel.icon as never} size={12} color={accentOf(channel.accent)} />
            </View>
            <View style={styles.railCopy}>
              <Text numberOfLines={1} style={styles.railLabel}>
                {channel.label}
              </Text>
              <Text numberOfLines={1} style={styles.railState}>
                {channel.state}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </ConnectorSurface>
  );
}

/** One counted stat under the player. */
function PlayerStat({ stat, styles }: { stat: (typeof PLAYER_STATS)[number]; styles: Styles }) {
  const { value, ref } = useCountUp(stat.value, { decimals: 1 });
  return (
    <View ref={ref as never} style={styles.statCell}>
      {/* Two lines, not one: "Engagement" ellipsised to "Engage…" in a
          quarter-width cell at 1280, which is a label that says nothing. */}
      <Text numberOfLines={2} style={styles.statLabel}>
        {stat.label}
      </Text>
      <Text numberOfLines={1} style={styles.statValue}>
        {value}
        {stat.suffix}
      </Text>
      <Text numberOfLines={1} style={styles.statDelta}>
        {stat.delta}
      </Text>
    </View>
  );
}

const TREND = [9, 14, 11, 19, 15, 24, 20, 27, 34];

/** The sparkline beside the stats — decoration, so it is Views only. */
function Trend({ styles, t }: { styles: Styles; t: ThemeTokens }) {
  const { progress, ref } = useGrowIn({ duration: 700 });
  return (
    <View ref={ref as never} style={styles.trend}>
      {TREND.map((height, index) => (
        <TrendBar key={index} height={height} index={index} color={t.brand} progress={progress} styles={styles} />
      ))}
    </View>
  );
}

function TrendBar({
  height,
  index,
  color,
  progress,
  styles,
}: {
  height: number;
  index: number;
  color: string;
  progress: SharedValue<number>;
  styles: Styles;
}) {
  // `progress` is a Reanimated shared value: reading `.value` during render
  // samples it once and never re-renders, which left every bar at its 2px floor
  // and drew the sparkline as a dotted line. It has to be read on the UI thread.
  const animated = useAnimatedStyle(() => {
    const local = Math.min(1, Math.max(0, (progress.value - index * 0.05) / 0.7));
    return { height: Math.max(2, height * local) };
  }, [height, index]);
  return <Animated.View style={[styles.trendBar, { backgroundColor: color }, animated]} />;
}

/** The four designed card mocks, for the crafts with no photograph. */
function CraftMock({ kind, styles, t }: { kind: NonNullable<Craft['mock']>; styles: Styles; t: ThemeTokens }) {
  if (kind === 'timeline') {
    return (
      <View style={[styles.mock, styles.mockDark]}>
        <View style={styles.mockScrub} />
        {[
          { w: '58%' as const, c: t.brand },
          { w: '78%' as const, c: t.violet },
          { w: '40%' as const, c: t.orange },
        ].map((row, index) => (
          <View key={index} style={styles.mockTrack}>
            <View style={[styles.mockClip, { width: row.w, backgroundColor: row.c }]} />
          </View>
        ))}
      </View>
    );
  }
  if (kind === 'waveform') {
    return (
      <View style={[styles.mock, styles.mockTint]}>
        <View style={styles.waveRow}>
          {[8, 16, 26, 14, 30, 20, 34, 18, 28, 12, 24, 30, 16, 22, 10, 26, 14, 8].map((h, i) => (
            <View key={i} style={[styles.waveBar, { height: h }]} />
          ))}
        </View>
        <Text numberOfLines={1} style={styles.mockCaption}>
          EN · ES · FR · DE
        </Text>
      </View>
    );
  }
  if (kind === 'presenter') {
    return (
      <View style={[styles.mock, styles.mockTint]}>
        <View style={styles.slideRow}>
          <View style={styles.slideMain}>
            <View style={[styles.slideBar, { width: '70%' }]} />
            <View style={[styles.slideBar, { width: '52%' }]} />
            <View style={[styles.slideBar, { width: '61%' }]} />
          </View>
          <View style={styles.slideFace}>
            <FontAwesome6 name="user" size={16} color={t.brand} />
          </View>
        </View>
        <Text numberOfLines={1} style={styles.mockCaption}>
          Captions and chapters generated
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.mock, styles.mockTint]}>
      <View style={styles.chartRow}>
        {[34, 52, 41, 66, 48, 74, 58].map((h, i) => (
          <View key={i} style={[styles.chartBar, { height: h, backgroundColor: i === 5 ? t.brand : softFill(t.brand, t) }]} />
        ))}
      </View>
      <Text numberOfLines={1} style={styles.mockCaption}>
        Revenue per cut
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function VideoStudioPage() {
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

  return (
    <PageShell
      title="Video & Voice Studio"
      description="Make campaign films, UGC and product ads, presenter videos, voiceovers and social cuts in one workspace — then publish them everywhere you already sell."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Solutions', path: ROUTES.solutions },
          { name: 'Video & Voice Studio', path: ROUTES.videoStudio },
        ]),
        faqJsonLd(FAQ.map((item) => ({ question: item.q, answer: item.a }))),
      ]}>
      {/* ------------------------------------------------ hero */}
      <OpenSection>
        <View style={styles.heroRow}>
          <Reveal style={styles.heroCopy} distance={16}>
            <SectionLabel>VIDEO &amp; VOICE STUDIO</SectionLabel>
            <Heading level={1} style={[type.display, styles.heroTitle]}>
              Create videos that sell, teach, and grow your brand.
            </Heading>
            <Text style={[type.body, styles.heroBody]}>
              Product ads, social cuts, UGC, presenter videos, voiceovers and training clips — made fast,
              kept on brand, and published from the same workspace as everything else you run.
            </Text>
            <View style={styles.heroButtons}>
              <ButtonRow>
                <PrimaryButton
                  label="Create a video"
                  size="lg"
                  full={l.isPhone}
                  icon="arrow-right"
                  iconRight
                  trackId="video-studio.hero.create-video"
                  onPress={() => Linking.openURL(EXTERNAL.signup)}
                />
                <SecondaryButton
                  label="See it on a real brief"
                  size="lg"
                  icon="play"
                  full={l.isPhone}
                  trackId="video-studio.hero.see-demo"
                  onPress={() => router.push(contactHref('demo') as never)}
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

          {/* Illustration only — every node is a View or a Text. */}
          <Reveal style={styles.heroVisual} distance={16} delay={90}>
            <View style={styles.playerCard}>
              <View style={styles.player}>
                <View style={styles.recBadge}>
                  <View style={styles.recDot} />
                  <Text numberOfLines={1} style={styles.recText}>
                    REC
                  </Text>
                </View>
                <View style={styles.playerBody}>
                  <FontAwesome6 name="film" size={26} color={t.textOnScrim} />
                </View>
                <View style={styles.playerBar}>
                  <Text numberOfLines={1} style={styles.playerTitle}>
                    New product launch — behind the scenes
                  </Text>
                  <View style={styles.playerControls}>
                    <FontAwesome6 name="play" size={9} color={t.textOnScrim} />
                    <Text numberOfLines={1} style={styles.playerTime}>
                      0:04 / 0:45
                    </Text>
                    <View style={styles.playerTrack}>
                      <View style={styles.playerFill} />
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.statRow}>
                {PLAYER_STATS.map((stat) => (
                  <PlayerStat key={stat.key} stat={stat} styles={styles} />
                ))}
                <View style={styles.statCellWide}>
                  <Trend styles={styles} t={t} />
                </View>
              </View>
              <Text numberOfLines={1} style={styles.statNote}>
                Example figures
              </Text>
            </View>

            {!l.isPhone ? <ChannelRail styles={styles} t={t} accentOf={accentOf} /> : null}
          </Reveal>
        </View>

        <View style={styles.trustBar}>
          {TRUST.map((item) => (
            <View key={item.key} style={styles.trustItem}>
              <FontAwesome6 name={item.icon as never} size={13} color={t.brand} />
              <Text numberOfLines={1} style={styles.trustText}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      </OpenSection>

      {/* ------------------------------------------------ the crafts */}
      <Band tone="surface">
        <View style={styles.headCentered}>
          <SectionLabel>WHAT YOU CAN MAKE</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitleCentered]}>
            Everything you need to create and publish video.
          </Heading>
          <Text style={[type.body, styles.headBodyCentered]}>
            Plan, produce, edit, dub and distribute — without exporting a file or opening a second tool.
          </Text>
        </View>

        <View style={styles.craftGrid}>
          {CRAFT.map((craft, index) => (
            <Reveal key={craft.key} style={styles.craftCell} distance={14} delay={index * 45}>
              <View style={styles.craftCard}>
                {craft.media ? (
                  <Media name={craft.media} alt={craft.alt ?? craft.title} style={styles.craftMedia} radius={12} />
                ) : (
                  <CraftMock kind={craft.mock ?? 'chart'} styles={styles} t={t} />
                )}
                <View style={styles.craftHead}>
                  <View style={[styles.craftIcon, { backgroundColor: softFill(accentOf(craft.accent), t) }]}>
                    <FontAwesome6 name={craft.icon as never} size={13} color={accentOf(craft.accent)} />
                  </View>
                  <Text style={styles.craftTitle}>{craft.title}</Text>
                </View>
                <Text style={styles.craftBody}>{craft.body}</Text>
                <View style={styles.craftSpacer} />
                <TextLink
                  label={craft.cta}
                  trackId={`video-studio.craft.${craft.key}`}
                  onPress={() => router.push(craft.href as never)}
                />
              </View>
            </Reveal>
          ))}
        </View>
      </Band>

      {/* ------------------------------------------------ virtual try-on */}
      <Band tone="violet">
        <View style={styles.tryonRow}>
          <Reveal style={styles.tryonCopy} distance={16}>
            <SectionLabel>VIRTUAL TRY-ON</SectionLabel>
            <Heading level={2} style={[type.h2, styles.tryonTitle]}>
              Put the garment on the customer before they buy it.
            </Heading>
            <Text style={[type.body, styles.tryonBody]}>
              One product photo becomes a shot of someone actually wearing it — on the street, on a
              runway, or in front of their own mirror. The same piece, styled for the audience each
              placement is talking to, without a second shoot.
            </Text>
            <View style={styles.tryonPoints}>
              {[
                { key: 'shoot', icon: 'camera', label: 'One flat-lay becomes a full campaign' },
                { key: 'fit', icon: 'people-group', label: 'Shown on real body shapes, not one model' },
                { key: 'returns', icon: 'arrow-rotate-left', label: 'Fewer returns from "it did not look like that"' },
              ].map((point) => (
                <View key={point.key} style={styles.tryonPoint}>
                  <View style={styles.tryonPointIcon}>
                    <FontAwesome6 name={point.icon as never} size={12} color={t.brand} />
                  </View>
                  <Text style={styles.tryonPointText}>{point.label}</Text>
                </View>
              ))}
            </View>
            <TextLink
              label="Sell it on FlowShop"
              trackId="video-studio.tryon.flowshop"
              onPress={() => router.push(ROUTES.flowshop as never)}
            />
          </Reveal>

          {/* Four, so the strip divides at 1, 2 and 4 — never a stranded tile. */}
          <Reveal style={styles.tryonArt} distance={16} delay={90}>
            {[
              { key: 'street', media: 'video/tryon-street', alt: 'The same coat worn on a city street' },
              { key: 'runway', media: 'video/tryon-runway', alt: 'The same dress shown on a runway' },
              { key: 'wardrobe', media: 'video/tryon-wardrobe', alt: 'The dress previewed in a customer bedroom' },
              { key: 'mirror', media: 'video/tryon-mirror', alt: 'A suit tried on in front of a mirror' },
            ].map((shot) => (
              <View key={shot.key} style={styles.tryonCell}>
                <Media name={shot.media} alt={shot.alt} style={styles.tryonImage} radius={12} />
              </View>
            ))}
          </Reveal>
        </View>
      </Band>

      {/* ------------------------------------------------ flow.ai */}
      <OpenSection>
        <Reveal style={styles.aiBand} distance={14}>
          <View style={styles.aiCopy}>
            <SectionLabel>FLOW.AI</SectionLabel>
            <Heading level={2} style={[type.h3, styles.aiTitle]}>
              FlowAgent plans, generates and publishes the campaign.
            </Heading>
            <Text style={[type.body, styles.aiBody]}>
              From script and storyboard through auto-editing, dubbing and distribution — it does the
              heavy lifting and stops for your approval before anything goes out.
            </Text>
            <TextLink
              label="Explore FlowAgent"
              trackId="video-studio.ai.explore"
              onPress={() => router.push(ROUTES.flowAgent as never)}
            />
          </View>
          <View style={styles.aiList}>
            {AI_STEPS.map((step) => (
              <View key={step.key} style={styles.aiRow}>
                <View style={styles.aiRowIcon}>
                  <FontAwesome6 name={step.icon as never} size={12} color={t.brand} />
                </View>
                <Text style={styles.aiRowText}>{step.label}</Text>
              </View>
            ))}
          </View>
        </Reveal>
      </OpenSection>

      {/* ------------------------------------------------ quotes */}
      <Band tone="surface">
        <View style={styles.headCentered}>
          <SectionLabel>IN PRACTICE</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitleCentered]}>
            Made by teams without a studio.
          </Heading>
        </View>

        <View style={styles.quoteGrid}>
          {QUOTES.map((quote, index) => (
            <Reveal key={quote.key} style={styles.quoteCell} distance={14} delay={index * 60}>
              <View style={styles.quoteCard}>
                <FontAwesome6 name="quote-left" size={15} color={t.brand} />
                <Text style={styles.quoteText}>{quote.quote}</Text>
                <View style={styles.quoteSpacer} />
                <View style={styles.quoteWho}>
                  <Media name={quote.media} alt={`${quote.name}, ${quote.role}`} style={styles.quoteAvatar} radius={20} />
                  <View style={styles.quoteWhoCopy}>
                    <Text numberOfLines={1} style={styles.quoteName}>
                      {quote.name}
                    </Text>
                    <Text numberOfLines={1} style={styles.quoteRole}>
                      {quote.role}
                    </Text>
                  </View>
                </View>
              </View>
            </Reveal>
          ))}
        </View>
      </Band>

      {/* ------------------------------------------------ faq */}
      <Band tone="violet">
        <View style={styles.headCentered}>
          <SectionLabel>QUESTIONS</SectionLabel>
          <Heading level={2} style={[type.h2, styles.headTitleCentered]}>
            Before your first cut.
          </Heading>
        </View>

        <View style={styles.faqGrid}>
          {FAQ.map((item, index) => (
            <Reveal key={item.q} style={styles.faqCell} distance={12} delay={index * 40}>
              <View style={styles.faqCard}>
                <Text style={styles.faqQ}>{item.q}</Text>
                <Text style={styles.faqA}>{item.a}</Text>
              </View>
            </Reveal>
          ))}
        </View>
      </Band>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

type Styles = ReturnType<typeof createStyles>;

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  const stacked = l.isStacked;
  const gap = l.isPhone ? 12 : 18;
  const half = gap / 2;

  const columns = (phone: number, tablet: number, laptop: number, desktop: number) =>
    l.isPhone ? phone : l.isTablet ? tablet : l.isDesktop ? desktop : laptop;

  // 8 crafts: 1, 2 and 4 divide it; 3 would strand a card.
  const craftColumns = columns(1, 2, 4, 4);
  // 3 quotes: 1 or 3, never 2.
  const quoteColumns = l.isCompact ? 1 : 3;
  const faqColumns = l.isPhone ? 1 : 2;

  const gridBase: ViewStyle = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    marginHorizontal: -half,
    marginTop: l.isPhone ? 20 : 28,
  };

  const cellBase = (count: number): ViewStyle => ({
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: cellBasis(count),
    minWidth: 0,
    padding: half,
  });

  const cardBase: ViewStyle = {
    flexGrow: 1,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    backgroundColor: t.surfaceRaised,
    padding: l.isPhone ? 14 : 16,
    gap: 9,
    ...(elevation(t, 1) as ViewStyle),
  };

  const iconBox = (size: number): ViewStyle => ({
    width: size,
    height: size,
    flexGrow: 0,
    flexShrink: 0,
    borderRadius: Math.round(size / 3),
    alignItems: 'center',
    justifyContent: 'center',
  });

  return StyleSheet.create({
    /* -------------------------------------------------- hero */
    heroRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'center',
      gap: stacked ? 26 : 38,
    },
    heroCopy: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 440, minWidth: 0 },
    heroTitle: { marginTop: 14 },
    heroBody: { marginTop: 14, maxWidth: 560 },
    heroButtons: { marginTop: 24 },
    proofRow: { marginTop: 22, flexDirection: 'row', flexWrap: 'wrap', gap: l.isPhone ? 10 : 18 },
    proofItem: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
    proofTick: { ...iconBox(20), borderRadius: 10, backgroundColor: softFill(t.green, t) },
    proofText: { ...type.caption, color: t.textMuted, fontWeight: '600', flexShrink: 1, minWidth: 0 },

    // Stacked, the visual owns the whole row and fills it.
    heroVisual: stacked
      ? {
          width: '100%',
          minWidth: 0,
          flexDirection: l.isPhone ? 'column' : 'row',
          alignItems: 'stretch',
          gap: 14,
        }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 520, minWidth: 0, flexDirection: 'row', gap: 14 },

    playerCard: {
      flexGrow: 1,
      flexShrink: 1,
      // `flexBasis: 0` is a WIDTH here only while the hero visual is a row. On
      // phone it becomes a column, where a zero basis is zero HEIGHT — the card
      // collapsed and the trust bar drew straight through the player.
      flexBasis: l.isPhone ? 'auto' : 0,
      minWidth: 0,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 12 : 14,
      gap: 10,
      ...(elevation(t, 2) as ViewStyle),
    },
    // A video frame reads as dark chrome in every theme, so it is painted from
    // the shadow colour rather than from `t.text` — which is near-white in the
    // grey and dark palettes and would have turned the player into a white box.
    player: {
      borderRadius: 14,
      backgroundColor: hexToRgba(t.shadowColor, t.mode === 'light' ? 0.94 : 0.82),
      overflow: 'hidden',
      minHeight: l.isPhone ? 150 : 190,
      justifyContent: 'space-between',
    },
    recBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      margin: 10,
      borderRadius: 999,
      backgroundColor: t.brand,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    recDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: t.textOnBrand },
    recText: { ...type.micro, color: t.textOnBrand, fontWeight: '800' },
    playerBody: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14, opacity: 0.4 },
    playerBar: { padding: 11, gap: 7 },
    playerTitle: { ...type.caption, color: t.textOnScrim, fontWeight: '700' },
    playerControls: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    playerTime: { ...type.micro, color: t.textOnScrim, opacity: 0.8 },
    playerTrack: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      height: 3,
      borderRadius: 2,
      backgroundColor: t.textOnScrim,
      opacity: 0.35,
    },
    playerFill: { width: '18%', height: 3, borderRadius: 2, backgroundColor: t.textOnScrim },

    // Four cells across a 390px card gave "Engagement" 60px and broke it
    // mid-word. On phone it becomes a 2x2 block instead.
    statRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: 8 },
    statCell: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: l.isPhone ? '46%' : 0,
      minWidth: 0,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 10,
      paddingVertical: 9,
      gap: 2,
    },
    statCellWide: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: l.isPhone ? '46%' : 0,
      minWidth: 0,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 10,
      paddingVertical: 9,
      justifyContent: 'center',
    },
    statLabel: { ...type.micro, color: t.textSubtle },
    statValue: { ...type.caption, color: t.text, fontWeight: '800' },
    statDelta: { ...type.micro, color: t.green, fontWeight: '700' },
    statNote: { ...type.micro, color: t.textSubtle },

    trend: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 36 },
    trendBar: { width: 4, borderRadius: 2 },

    /* -------------------------------------------------- rail */
    rail: {
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: 'auto',
      width: l.isTablet ? 190 : 216,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    railHub: {
      ...iconBox(40),
      borderRadius: 20,
      backgroundColor: t.brand,
      ...(elevation(t, 2) as ViewStyle),
    },
    railColumn: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 6 },
    railCard: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 8,
      paddingVertical: 6,
      ...(elevation(t, 1) as ViewStyle),
    },
    railIcon: iconBox(24),
    railCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    railLabel: { ...type.micro, color: t.text, fontWeight: '700' },
    railState: { ...type.micro, color: t.textSubtle },

    /* -------------------------------------------------- trust */
    trustBar: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      rowGap: 10,
      columnGap: 16,
      marginTop: l.isPhone ? 20 : 26,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: l.isPhone ? 14 : 20,
      paddingVertical: 12,
    },
    trustItem: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
    trustText: { ...type.micro, color: t.textMuted, fontWeight: '600', flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- heads */
    headCentered: { alignItems: 'center', gap: 12 },
    headTitleCentered: { textAlign: 'center', maxWidth: 720 },
    headBodyCentered: { textAlign: 'center', color: t.textMuted, maxWidth: 640 },

    /* -------------------------------------------------- crafts */
    craftGrid: gridBase,
    craftCell: cellBase(craftColumns),
    craftCard: cardBase,
    craftMedia: { width: '100%', height: l.isPhone ? 150 : 128 },
    craftHead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 2 },
    craftIcon: iconBox(28),
    craftTitle: { ...type.caption, color: t.text, fontWeight: '800', flexShrink: 1, minWidth: 0 },
    craftBody: { ...type.caption, color: t.textMuted },
    craftSpacer: { flexGrow: 1, minHeight: 2 },

    /* -------------------------------------------------- card mocks */
    mock: {
      width: '100%',
      height: l.isPhone ? 150 : 128,
      borderRadius: 12,
      padding: 12,
      justifyContent: 'center',
      gap: 7,
      overflow: 'hidden',
    },
    mockDark: { backgroundColor: hexToRgba(t.shadowColor, t.mode === 'light' ? 0.94 : 0.82) },
    mockTint: { backgroundColor: t.surfaceInset },
    mockScrub: { height: 3, borderRadius: 2, backgroundColor: t.textOnScrim, opacity: 0.3, marginBottom: 3 },
    mockTrack: { height: 14, borderRadius: 4, backgroundColor: t.textOnScrim, opacity: 0.12, overflow: 'hidden' },
    mockClip: { height: 14, borderRadius: 4 },
    mockCaption: { ...type.micro, color: t.textSubtle },
    waveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 40 },
    waveBar: { width: 3, borderRadius: 2, backgroundColor: t.brand },
    slideRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    slideMain: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      minWidth: 0,
      gap: 6,
      borderRadius: 8,
      backgroundColor: t.surfaceRaised,
      padding: 10,
    },
    slideBar: { height: 6, borderRadius: 3, backgroundColor: softFill(t.brand, t) },
    slideFace: {
      ...iconBox(40),
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      borderWidth: 1,
      borderColor: t.border,
    },
    chartRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 74 },
    chartBar: { width: 12, borderRadius: 3 },

    /* -------------------------------------------------- virtual try-on */
    tryonRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'center',
      gap: stacked ? 26 : 44,
    },
    tryonCopy: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    tryonTitle: { marginTop: 12 },
    tryonBody: { marginTop: 12, color: t.textMuted, maxWidth: 540 },
    tryonPoints: { marginTop: 20, marginBottom: 18, gap: 10 },
    tryonPoint: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    tryonPointIcon: { ...iconBox(26), backgroundColor: softFill(t.brand, t) },
    tryonPointText: { ...type.caption, color: t.textMuted, flexGrow: 1, flexShrink: 1, minWidth: 0 },
    tryonArt: {
      ...(stacked
        ? { width: '100%', minWidth: 0 }
        : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 }),
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginHorizontal: -half,
    },
    tryonCell: { flexGrow: 0, flexShrink: 1, flexBasis: '50%', minWidth: 0, padding: half },
    tryonImage: { width: '100%', height: l.isPhone ? 190 : 168 },

    /* -------------------------------------------------- flow.ai band */
    aiBand: {
      flexDirection: l.isCompact ? 'column' : 'row',
      alignItems: l.isCompact ? 'stretch' : 'center',
      gap: l.isPhone ? 18 : 30,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 20,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 18 : 26,
    },
    // Same trap: the band stacks into a column below 1024.
    aiCopy: { flexGrow: 1, flexShrink: 1, flexBasis: l.isCompact ? 'auto' : 0, minWidth: 0, gap: 10 },
    aiTitle: { marginTop: 4 },
    aiBody: { color: t.textMuted, maxWidth: 520 },
    aiList: { flexGrow: 1, flexShrink: 1, flexBasis: l.isCompact ? 'auto' : 0, minWidth: 0, gap: 8 },
    aiRow: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    aiRowIcon: { ...iconBox(26), backgroundColor: softFill(t.brand, t) },
    aiRowText: { ...type.caption, color: t.text, fontWeight: '600', flexGrow: 1, flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- quotes */
    quoteGrid: gridBase,
    quoteCell: cellBase(quoteColumns),
    quoteCard: { ...cardBase, gap: 11 },
    quoteText: { ...type.caption, color: t.text },
    quoteSpacer: { flexGrow: 1, minHeight: 2 },
    quoteWho: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    quoteAvatar: { width: 40, height: 40, flexGrow: 0, flexShrink: 0 },
    quoteWhoCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    quoteName: { ...type.micro, color: t.text, fontWeight: '800' },
    quoteRole: { ...type.micro, color: t.textSubtle },

    /* -------------------------------------------------- faq */
    faqGrid: gridBase,
    faqCell: cellBase(faqColumns),
    faqCard: { ...cardBase, gap: 8 },
    faqQ: { ...type.caption, color: t.text, fontWeight: '800' },
    faqA: { ...type.caption, color: t.textMuted },
  });
}
