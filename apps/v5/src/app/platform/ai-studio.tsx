import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View, type ImageStyle, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { contactHref, EXTERNAL } from '@/lib/destinations';
import { ArrowLink } from '@/components/public/connectors';
import { Media } from '@/components/public/media';
import { Reveal } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
import {
  Band,
  ButtonRow,
  Heading,
  OpenSection,
  PrimaryButton,
  SecondaryButton,
  SectionAside,
  SectionLabel,
  type TypeScale,
  useAsideBand,
  useOpenSection,
  useTypeScale,
} from '@/components/public/ui';
import { accentText, elevation, hexToRgba, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

type Accent = 'brand' | 'violet' | 'green' | 'orange' | 'pink';

const PROOF = ['Your brand kit applied', 'Nothing publishes unapproved', 'Unlimited revisions'];

/** Left rail of the studio mock. */
const RAIL: { key: string; icon: string; label: string; active?: boolean }[] = [
  { key: 'create', icon: 'wand-magic-sparkles', label: 'Create', active: true },
  { key: 'brand', icon: 'palette', label: 'Brand Kit' },
  { key: 'templates', icon: 'table-cells-large', label: 'Templates' },
  { key: 'assets', icon: 'images', label: 'My assets' },
  { key: 'projects', icon: 'folder-open', label: 'Projects' },
];

const VOICE_CHIPS = ['Warm', 'Confident', 'Plain-spoken'];

const FORMATS: { icon: string; title: string; body: string; accent: Accent }[] = [
  {
    icon: 'image',
    title: 'Image',
    body: 'Product shots, lifestyle scenes and campaign hero art, generated at the size you need.',
    accent: 'violet',
  },
  {
    icon: 'film',
    title: 'Video',
    body: 'Short-form video cut from a script, your own footage, or a single still frame.',
    accent: 'brand',
  },
  {
    icon: 'hashtag',
    title: 'Social Post',
    body: 'Caption, hashtags and creative, written for the network it is going to.',
    accent: 'brand',
  },
  {
    icon: 'envelope',
    title: 'Email',
    body: 'Subject line, preview text and a full branded layout, ready to schedule.',
    accent: 'orange',
  },
  {
    icon: 'bullhorn',
    title: 'Ad Creative',
    body: 'Headlines, primary text and sized creative variants for every placement.',
    accent: 'pink',
  },
  {
    icon: 'tag',
    title: 'Product Copy',
    body: 'Titles, descriptions and specs written to sell and structured to be found.',
    accent: 'green',
  },
  {
    icon: 'chalkboard-user',
    title: 'Presentation',
    body: 'Pitch decks and one-pagers laid out on your grid, with your type and colour.',
    accent: 'violet',
  },
  {
    icon: 'microphone',
    title: 'Voice',
    body: 'Voiceover and narration in one consistent brand voice, in any language you sell in.',
    accent: 'orange',
  },
];

const BRAND_BULLETS = [
  'Your logo, palette and typography are applied before you ever see a first draft.',
  'Approved product photos and past campaigns become the reference set, not stock art.',
  'Tone-of-voice rules travel with every headline, caption and subject line.',
  'Anything that drifts off-brand is flagged for review instead of quietly shipping.',
];

/** How the brand brief is assembled — the three steps behind the Brand Kit. */
const BRAND_SETUP: { title: string; note: string }[] = [
  { title: 'Import', note: 'Your site, logo files and last year’s campaigns are read once, on setup.' },
  { title: 'Confirm', note: 'You approve the palette, the type and the tone rules before anything ships.' },
  { title: 'Applied', note: 'Every generation starts from that brief instead of a blank prompt.' },
];

const REFERENCES: { name: string; alt: string }[] = [
  { name: 'scenes/campaign-spring-product', alt: 'Spring campaign product still' },
  { name: 'product/commuter-backpack', alt: 'Commuter backpack product shot' },
  { name: 'product/canvas-tote', alt: 'Canvas tote product shot' },
  { name: 'product/navy-bottle', alt: 'Navy bottle product shot' },
];

const OUTPUTS: { title: string; size: string; media: string; alt: string; accent: Accent }[] = [
  {
    title: 'Square post',
    size: '1080 × 1080',
    media: 'scenes/campaign-spring-product',
    alt: 'Square social post generated from the brief',
    accent: 'brand',
  },
  {
    title: 'Story / Reel',
    size: '1080 × 1920',
    media: 'scenes/campaign-spring-model',
    alt: 'Vertical story generated from the brief',
    accent: 'violet',
  },
  {
    title: 'Ad banner',
    size: '1200 × 628',
    media: 'scenes/post-apparel-flatlay',
    alt: 'Landscape ad banner generated from the brief',
    accent: 'pink',
  },
  {
    title: 'Email header',
    size: '600 × 300',
    media: 'scenes/storefront-hero',
    alt: 'Email header generated from the brief',
    accent: 'orange',
  },
];

const EDITOR_TOOLS = [
  'Remove background',
  'Retouch',
  'Expand canvas',
  'Upscale',
  'Replace object',
  'Recolour',
];

const VIDEO_SCENES: { label: string; length: string }[] = [
  { label: 'Hook', length: '0:03' },
  { label: 'Product', length: '0:06' },
  { label: 'Proof', length: '0:05' },
  { label: 'Offer', length: '0:04' },
];

const VIDEO_FEATURES = ['Script to scenes', 'Auto captions', 'Brand intro & outro', 'Music and voiceover'];

const COLLAB: { icon: string; title: string; body: string; accent: Accent }[] = [
  {
    icon: 'comments',
    title: 'Comments in context',
    body: 'Feedback sits on the asset it refers to, so nothing gets lost in a thread nobody reads.',
    accent: 'brand',
  },
  {
    icon: 'clock-rotate-left',
    title: 'Version history',
    body: 'Every generation and edit is kept. Compare two takes, or restore last week in one click.',
    accent: 'violet',
  },
  {
    icon: 'user-shield',
    title: 'Roles and permissions',
    body: 'Decide who can create, who can approve and who can publish — per brand and per channel.',
    accent: 'green',
  },
  {
    icon: 'paper-plane',
    title: 'One-click publish',
    body: 'Send an approved asset straight to a campaign, a post or your product catalogue.',
    accent: 'orange',
  },
];

const VERSIONS: { label: string; note: string; person: string; media: string; current?: boolean }[] = [
  { label: 'v4', note: 'Headline shortened, warmer tone', person: 'Maya Patel', media: 'people/maya-patel', current: true },
  { label: 'v3', note: 'Swapped to the daylight variant', person: 'Daniel Kim', media: 'people/daniel-kim' },
  { label: 'v2', note: 'Brand palette re-applied', person: 'Priya Shah', media: 'people/priya-shah' },
  { label: 'v1', note: 'First generation from the brief', person: 'Jordan Lee', media: 'people/jordan-lee' },
];

const TEMPLATES: { title: string; industry: string; media: string; alt: string }[] = [
  {
    title: 'Spring lookbook',
    industry: 'Retail & e-commerce',
    media: 'scenes/campaign-spring-model',
    alt: 'Spring lookbook template',
  },
  {
    title: 'Storefront announcement',
    industry: 'Retail & e-commerce',
    media: 'scenes/storefront-hero',
    alt: 'Storefront announcement template',
  },
  {
    title: 'New treatment launch',
    industry: 'Salon & spa',
    media: 'scenes/salon-interior',
    alt: 'Salon treatment launch template',
  },
  {
    title: 'Weekend menu drop',
    industry: 'Restaurants',
    media: 'scenes/category-kitchen',
    alt: 'Restaurant weekend menu template',
  },
  {
    // A scene, like every other template in this grid. This was the backpack
    // *product cutout* — a tall shot on a transparent ground, dropped into a
    // 16:10 thumbnail, which crops to an unreadable close-up of one zip. A
    // template card previews a finished post, so it needs a photograph that
    // fills the frame.
    title: 'Product spotlight',
    industry: 'Retail & e-commerce',
    media: 'scenes/campaign-spring-product',
    alt: 'Product spotlight template',
  },
  {
    title: 'Room refresh guide',
    industry: 'Home services',
    media: 'scenes/category-living-room',
    alt: 'Home refresh guide template',
  },
];

const ALL_INDUSTRIES = 'All industries';

/**
 * The industry chips are a real filter over TEMPLATES, so the list is derived
 * from the templates themselves — a chip can never lead to an empty grid, and
 * adding a template adds its industry automatically.
 */
const INDUSTRIES: string[] = [
  ALL_INDUSTRIES,
  ...Array.from(new Set(TEMPLATES.map((template) => template.industry))),
];

const TRUST: { icon: string; title: string; body: string; accent: Accent }[] = [
  {
    icon: 'fingerprint',
    title: 'Originality checks',
    body: 'Every generated asset is scored against your library and the open web before it is offered to you.',
    accent: 'brand',
  },
  {
    icon: 'shield-halved',
    title: 'Brand safety',
    body: 'Claims, competitors and words you have banned are caught at generation time, not after publishing.',
    accent: 'green',
  },
  {
    icon: 'certificate',
    title: 'Provenance',
    body: 'Each asset carries a record of the brief, the references used and everyone who touched it.',
    accent: 'violet',
  },
  {
    icon: 'scale-balanced',
    title: 'Licence clarity',
    body: 'Commercial rights are stated up front, so you always know what you may run and where.',
    accent: 'orange',
  },
];

const TRUST_ROWS: { label: string; value: string }[] = [
  { label: 'Similarity to existing work', value: 'None found' },
  { label: 'Brand safety review', value: 'Passed' },
  { label: 'Commercial licence', value: 'Cleared' },
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

/** Circular meter. Drawn with real geometry so it stays round at any size. */
function ScoreRing({
  value,
  size,
  caption,
  styles,
  t,
}: {
  value: number;
  size: number;
  caption: string;
  styles: Styles;
  t: ThemeTokens;
}) {
  const stroke = size < 130 ? 9 : 11;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (circumference * value) / 100;

  return (
    <View style={[styles.ringWrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={t.surfaceInset}
          strokeWidth={stroke}
          fill="none"
        />
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
        <Text style={styles.ringValue}>{`${value}%`}</Text>
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

/**
 * The studio mock that carries the hero: rail, prompt, generated result and the
 * brand kit that was applied to it.
 */
function StudioMock({ styles, t, l }: { styles: Styles; t: ThemeTokens; l: Layout }) {
  const swatches = [t.brand, t.violet, t.pink, t.orange, t.green];

  return (
    <View style={styles.studioCard}>
      <View style={styles.studioBar}>
        <View style={styles.studioBarCopy}>
          <View style={styles.studioBadge}>
            <FontAwesome6 name="wand-magic-sparkles" size={13} color={t.brand} />
          </View>
          <View style={styles.studioBarText}>
            <Text numberOfLines={1} style={styles.studioTitle}>
              AI Studio
            </Text>
            <Text numberOfLines={1} style={styles.studioSub}>
              {/* The full line needs 199px and a 390px phone leaves 159 for it,
                  so it ellipsized mid-word. Same treatment as the card foot
                  below: write the phone a line that fits. */}
              {l.isPhone ? '4 assets in this project' : 'Spring collection • 4 assets in this project'}
            </Text>
          </View>
        </View>
        <View style={styles.approvalChip}>
          <FontAwesome6 name="circle-check" size={11} color={t.successText} />
          <Text style={styles.approvalText}>On brand</Text>
        </View>
      </View>

      <View style={styles.studioBody}>
        <View style={styles.rail}>
          {RAIL.map((item) => (
            <View key={item.key} style={[styles.railItem, item.active ? styles.railItemActive : null]}>
              <FontAwesome6
                name={item.icon as never}
                size={12}
                color={item.active ? t.brand : t.textSubtle}
              />
              <Text
                numberOfLines={1}
                style={[styles.railLabel, item.active ? styles.railLabelActive : null]}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.studioMain}>
          <View style={styles.promptBox}>
            <Text style={styles.promptLabel}>BRIEF</Text>
            <Text style={styles.promptText}>
              Spring collection hero — bright editorial daylight, model outdoors, room at the top for
              a headline.
            </Text>
            <View style={styles.promptFoot}>
              <View style={styles.promptChip}>
                <FontAwesome6 name="palette" size={10} color={t.chipText} />
                <Text style={styles.promptChipText}>Brand Kit on</Text>
              </View>
              <View style={styles.promptChip}>
                <FontAwesome6 name="crop-simple" size={10} color={t.chipText} />
                <Text style={styles.promptChipText}>1080 × 1350</Text>
              </View>
              <View style={styles.generateChip}>
                <FontAwesome6 name="bolt" size={10} color={t.textOnBrand} />
                <Text style={styles.generateText}>Generate</Text>
              </View>
            </View>
          </View>

          <View style={styles.resultRow}>
            <View style={styles.resultPane}>
              <Media
                name="scenes/campaign-spring-model"
                alt="Generated spring campaign hero image"
                style={styles.resultImage}
                radius={12}
              />
              <View style={styles.resultFoot}>
                <Text numberOfLines={1} style={styles.resultName}>
                  spring-hero-v4
                </Text>
                <View style={styles.resultTag}>
                  <Text style={styles.resultTagText}>Generated</Text>
                </View>
              </View>
            </View>

            <View style={styles.kitPane}>
              <Text style={styles.kitTitle}>Brand Kit</Text>

              <View style={styles.kitLogoRow}>
                <View style={styles.kitLogoTile}>
                  <FontAwesome6 name="shapes" size={15} color={t.violet} />
                </View>
                <View style={styles.kitLogoCopy}>
                  <Text numberOfLines={1} style={styles.kitRowTitle}>
                    Logo
                  </Text>
                  <Text numberOfLines={1} style={styles.kitRowMeta}>
                    3 variants • safe area set
                  </Text>
                </View>
              </View>

              <View style={styles.kitBlock}>
                <Text style={styles.kitBlockLabel}>COLOUR</Text>
                <View style={styles.swatchRow}>
                  {swatches.map((colour) => (
                    <View key={colour} style={[styles.swatch, { backgroundColor: colour }]} />
                  ))}
                </View>
              </View>

              <View style={styles.kitBlock}>
                <Text style={styles.kitBlockLabel}>TYPOGRAPHY</Text>
                <Text numberOfLines={1} style={styles.kitTypeDisplay}>
                  Display • Semibold
                </Text>
                <Text numberOfLines={1} style={styles.kitTypeBody}>
                  Body • Regular
                </Text>
              </View>

              <View style={styles.kitBlock}>
                <Text style={styles.kitBlockLabel}>BRAND VOICE</Text>
                <View style={styles.voiceRow}>
                  {VOICE_CHIPS.map((chip) => (
                    <View key={chip} style={styles.voiceChip}>
                      <Text style={styles.voiceChipText}>{chip}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.studioFoot}>
        <FontAwesome6 name="shield-halved" size={11} color={t.textSubtle} />
        <Text style={styles.studioFootText}>
          {l.isPhone
            ? 'Every asset waits for approval.'
            : 'Every asset is checked for brand safety and waits for your approval before it publishes.'}
        </Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function AiStudioPage() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const open = useOpenSection();
  const asideBand = useAsideBand();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);
  const accentOf = useAccent();
  const router = useRouter();

  /** Industry chips genuinely filter the template grid below them. */
  const [industry, setIndustry] = useState<string>(ALL_INDUSTRIES);
  const templates = useMemo(
    () =>
      industry === ALL_INDUSTRIES
        ? TEMPLATES
        : TEMPLATES.filter((template) => template.industry === industry),
    [industry],
  );

  return (
    <PageShell
      title="AI Studio"
      description="Generate images, videos, posts, emails, ads, product copy, presentations and branded assets from one intelligent creative workspace."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Product', path: ROUTES.product },
          { name: 'AI Studio', path: ROUTES.aiStudio },
        ]),
      ]}>
      {/* ------------------------------------------------ hero */}
      <Reveal style={[open, asideBand]} distance={22}>
        {/* These product heroes all run copy-left, mockup-right, and the copy
            column is the shorter of the two — so the empty zone is the band
            beneath it. */}
        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            <SectionLabel>CREATE WITH YOUR BRAND BUILT IN</SectionLabel>
            <Heading level={1} style={[type.display, styles.heroTitle]}>
              Turn any idea into campaign-ready content.
            </Heading>
            <Text style={[type.body, styles.heroBody]}>
              Generate images, videos, posts, emails, ads, product copy, presentations, and branded
              assets from one intelligent creative workspace.
            </Text>
            <View style={styles.heroButtons}>
              <ButtonRow>
                <PrimaryButton
                  label="Open AI Studio"
                  size="lg"
                  full={l.isPhone}
                  trackId="ai-studio.hero.open-studio"
                  onPress={() => Linking.openURL(EXTERNAL.signup)}
                />
                <SecondaryButton
                  label="Watch a demo"
                  size="lg"
                  icon="play"
                  full={l.isPhone}
                  trackId="ai-studio.hero.demo"
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
            <StudioMock styles={styles} t={t} l={l} />
          </View>
        </View>
      </Reveal>

      {/* ------------------------------------------------ formats */}
      <OpenSection>
        <View style={styles.sectionHead}>
          <SectionLabel>EVERY FORMAT</SectionLabel>
          <Heading level={2} style={[type.h2, styles.sectionTitle]}>
            Create anything, on brand.
          </Heading>
          <Text style={[type.body, styles.sectionSub]}>
            One workspace covers the whole output of a marketing team — and every format starts from
            the same brand context.
          </Text>
        </View>

        <View style={styles.formatGrid}>
          {FORMATS.map((format, index) => {
            const accent = accentOf(format.accent);
            return (
              <Reveal key={format.title} style={styles.formatCell} distance={16} delay={index * 55}>
                <View style={styles.formatCard}>
                  <View style={[styles.formatIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={format.icon as never} size={18} color={accent} />
                  </View>
                  <Text style={[type.h4, styles.formatTitle]}>{format.title}</Text>
                  <Text style={styles.formatBody}>{format.body}</Text>
                </View>
              </Reveal>
            );
          })}
        </View>
      </OpenSection>

      {/* ------------------------------------------------ brand context */}
      <Band tone="surface" art={{ variant: 'palette', color: t.brand, side: 'right' }}>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <SectionLabel>BRAND CONTEXT</SectionLabel>
            <Heading level={2} style={[type.h2, styles.splitTitle]}>
              Brand context in every generation.
            </Heading>
            <Text style={[type.body, styles.splitBody]}>
              Generic AI writes generic work. AI Studio is briefed on your brand before it writes a
              word or renders a pixel.
            </Text>
            <View style={styles.tickList}>
              {BRAND_BULLETS.map((bullet) => (
                <Tick key={bullet} text={bullet} styles={styles} t={t} />
              ))}
            </View>

            <View style={styles.setupCard}>
              <Text style={styles.setupLabel}>HOW THE BRIEF IS BUILT</Text>
              {BRAND_SETUP.map((step, index) => (
                <View key={step.title} style={styles.setupRow}>
                  <View style={styles.setupIndex}>
                    <Text style={styles.setupIndexText}>{`0${index + 1}`}</Text>
                  </View>
                  <View style={styles.setupCopy}>
                    <Text style={styles.setupTitle}>{step.title}</Text>
                    <Text style={styles.setupNote}>{step.note}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.quoteCard}>
              <FontAwesome6 name="quote-left" size={15} color={t.brand} />
              <Text style={styles.quoteText}>
                Every draft already looks like us. The team edits words now, not brand mistakes.
              </Text>
              <View style={styles.quoteWho}>
                <Media
                  name="people/amanda-rodriguez"
                  alt="Amanda Rodriguez, Marketing Director at Harbor &amp; Co."
                  style={styles.quoteAvatar}
                  radius={16}
                />
                <View style={styles.quoteWhoCopy}>
                  <Text numberOfLines={1} style={styles.quoteName}>
                    Amanda Rodriguez
                  </Text>
                  <Text numberOfLines={1} style={styles.quoteRole}>
                    Marketing Director, Harbor &amp; Co.
                  </Text>
                </View>
              </View>
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={90}>
            <View style={styles.panel}>
              <View style={styles.panelHead}>
                <View style={styles.panelIcon}>
                  <FontAwesome6 name="palette" size={14} color={t.brand} />
                </View>
                <View style={styles.panelHeadCopy}>
                  <Text numberOfLines={1} style={styles.panelTitle}>
                    Brand Kit
                  </Text>
                  <Text numberOfLines={1} style={styles.panelSub}>
                    Applied to every asset in this workspace
                  </Text>
                </View>
              </View>

              <View style={styles.kitInlineRow}>
                <View style={styles.kitInlineTile}>
                  <FontAwesome6 name="shapes" size={16} color={t.violet} />
                </View>
                <View style={styles.swatchRow}>
                  {[t.brand, t.violet, t.pink, t.orange, t.green].map((colour) => (
                    <View key={colour} style={[styles.swatchLarge, { backgroundColor: colour }]} />
                  ))}
                </View>
              </View>

              <Text style={styles.panelLabel}>REFERENCE ASSETS</Text>
              <View style={styles.refGrid}>
                {REFERENCES.map((ref) => (
                  <View key={ref.name} style={styles.refCell}>
                    <Media name={ref.name} alt={ref.alt} style={styles.refImage} radius={12} />
                  </View>
                ))}
              </View>

              <View style={styles.panelNote}>
                <FontAwesome6 name="circle-info" size={11} color={t.chipText} />
                <Text style={styles.panelNoteText}>
                  Drafts are generated from your own library first, and stock only when you ask.
                </Text>
              </View>
            </View>
          </Reveal>
        </View>
      </Band>

      {/* ------------------------------------------------ one brief, many outputs */}
      <Band tone="violet" art={{ variant: 'learn', color: t.violet, side: 'left' }}>
        <View style={styles.sectionHead}>
          <SectionLabel>ONE BRIEF</SectionLabel>
          <Heading level={2} style={[type.h2, styles.sectionTitle]}>
            Multi-format content from one brief.
          </Heading>
          <Text style={[type.body, styles.sectionSub]}>
            Describe the campaign once. Every channel gets the version it needs, at the size it
            needs, without a second round of work.
          </Text>
        </View>

        <View style={styles.briefRow}>
          <View style={styles.briefCard}>
            <Text style={styles.briefLabel}>THE BRIEF</Text>
            <Text style={styles.briefText}>
              Launch the spring collection. Bright and optimistic, 15% off through Sunday, everything
              points to the collection page.
            </Text>
            <View style={styles.briefMetaRow}>
              <View style={styles.briefChip}>
                <Text style={styles.briefChipText}>Spring 2026</Text>
              </View>
              <View style={styles.briefChip}>
                <Text style={styles.briefChipText}>4 channels</Text>
              </View>
            </View>
          </View>

          <View style={styles.briefArrow}>
            {l.isStacked ? (
              <FontAwesome6 name="arrow-right" size={14} color={t.borderStrong} style={styles.arrowDown} />
            ) : (
              <ArrowLink width={44} height={12} color={t.borderStrong} />
            )}
          </View>

          <View style={styles.outputGrid}>
            {OUTPUTS.map((output, index) => {
              const accent = accentOf(output.accent);
              return (
                <Reveal key={output.title} style={styles.outputCell} distance={14} delay={index * 70}>
                  <View style={styles.outputCard}>
                    <Media name={output.media} alt={output.alt} style={styles.outputImage} radius={11} />
                    <Text numberOfLines={1} style={styles.outputTitle}>
                      {output.title}
                    </Text>
                    <View style={[styles.outputSize, { backgroundColor: softFill(accent, t) }]}>
                      <Text numberOfLines={1} style={[styles.outputSizeText, { color: accentText(accent, t) }]}>
                        {output.size}
                      </Text>
                    </View>
                  </View>
                </Reveal>
              );
            })}
          </View>
        </View>
      </Band>

      {/* ------------------------------------------------ editor + video builder */}
      <OpenSection>
        <View style={styles.sectionHead}>
          <SectionLabel>EDIT AND EXTEND</SectionLabel>
          <Heading level={2} style={[type.h2, styles.sectionTitle]}>
            Fix it, cut it, ship it.
          </Heading>
          <Text style={[type.body, styles.sectionSub]}>
            Editing is part of the same workspace — no round trip to a separate design or video tool.
          </Text>
        </View>

        <View style={styles.pairGrid}>
          <Reveal style={styles.pairCell} distance={16}>
            <View style={styles.pairCard}>
              <View style={styles.pairHead}>
                <View style={[styles.pairIcon, { backgroundColor: softFill(t.violet, t) }]}>
                  <FontAwesome6 name="wand-magic-sparkles" size={17} color={t.violet} />
                </View>
                <View style={styles.pairHeadCopy}>
                  <Text style={[type.h3, styles.pairTitle]}>AI image editor</Text>
                  <Text style={styles.pairBlurb}>
                    Change what is in the shot without reshooting it.
                  </Text>
                </View>
              </View>

              <View style={styles.editorStage}>
                <Media
                  name="scenes/campaign-spring-product"
                  alt="Product still open in the AI image editor"
                  style={styles.stageImage}
                  radius={12}
                />
                <View style={styles.stageBadge}>
                  <FontAwesome6 name="scissors" size={10} color={t.textOnBrand} />
                  <Text style={styles.stageBadgeText}>Background removed</Text>
                </View>
              </View>

              <View style={styles.toolWrap}>
                {EDITOR_TOOLS.map((tool) => (
                  <View key={tool} style={styles.toolChip}>
                    <Text numberOfLines={1} style={styles.toolChipText}>
                      {tool}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Reveal>

          <Reveal style={styles.pairCell} distance={16} delay={90}>
            <View style={styles.pairCard}>
              <View style={styles.pairHead}>
                <View style={[styles.pairIcon, { backgroundColor: softFill(t.brand, t) }]}>
                  <FontAwesome6 name="film" size={17} color={t.brand} />
                </View>
                <View style={styles.pairHeadCopy}>
                  <Text style={[type.h3, styles.pairTitle]}>AI video builder</Text>
                  <Text style={styles.pairBlurb}>
                    A script becomes scenes, captions and a finished cut.
                  </Text>
                </View>
              </View>

              <View style={styles.editorStage}>
                <Media
                  name="scenes/campaign-spring-model"
                  alt="Campaign video open in the AI video builder"
                  style={styles.stageImage}
                  radius={12}
                />
                <View style={styles.playBadge}>
                  <FontAwesome6 name="play" size={13} color={t.textOnBrand} />
                </View>
                <View style={styles.durationBadge}>
                  <Text style={styles.durationText}>0:18</Text>
                </View>
              </View>

              <View style={styles.timelineRow}>
                {VIDEO_SCENES.map((scene) => (
                  <View key={scene.label} style={styles.timelineCell}>
                    <View style={styles.timelineClip}>
                      <Text numberOfLines={1} style={styles.timelineLabel}>
                        {scene.label}
                      </Text>
                      <Text numberOfLines={1} style={styles.timelineLength}>
                        {scene.length}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.toolWrap}>
                {VIDEO_FEATURES.map((feature) => (
                  <View key={feature} style={styles.toolChip}>
                    <Text numberOfLines={1} style={styles.toolChipText}>
                      {feature}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Reveal>
        </View>
      </OpenSection>

      {/* ------------------------------------------------ collaborate */}
      <Band tone="surface" art={{ variant: 'people', color: t.brand, side: 'right' }}>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <SectionLabel>TEAMWORK</SectionLabel>
            <Heading level={2} style={[type.h2, styles.splitTitle]}>
              Collaborate, approve, and publish with confidence.
            </Heading>
            <Text style={[type.body, styles.splitBody]}>
              Generation is the easy part. The workspace is built around the review that follows it.
            </Text>

            <View style={styles.collabGrid}>
              {COLLAB.map((item, index) => {
                const accent = accentOf(item.accent);
                return (
                  <Reveal key={item.title} style={styles.collabCell} distance={14} delay={index * 60}>
                    <View style={styles.collabCard}>
                      <View style={[styles.collabIcon, { backgroundColor: softFill(accent, t) }]}>
                        <FontAwesome6 name={item.icon as never} size={15} color={accent} />
                      </View>
                      <Text style={styles.collabTitle}>{item.title}</Text>
                      <Text style={styles.collabBody}>{item.body}</Text>
                    </View>
                  </Reveal>
                );
              })}
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={90}>
            <View style={styles.panel}>
              <View style={styles.panelHead}>
                <View style={styles.panelIcon}>
                  <FontAwesome6 name="clock-rotate-left" size={14} color={t.brand} />
                </View>
                <View style={styles.panelHeadCopy}>
                  <Text numberOfLines={1} style={styles.panelTitle}>
                    spring-hero • version history
                  </Text>
                  <Text numberOfLines={1} style={styles.panelSub}>
                    4 versions • 2 reviewers
                  </Text>
                </View>
              </View>

              <View style={styles.versionList}>
                {VERSIONS.map((version) => (
                  <View
                    key={version.label}
                    style={[styles.versionRow, version.current ? styles.versionRowCurrent : null]}>
                    <Media
                      name={version.media}
                      alt={version.person}
                      style={styles.versionAvatar}
                      radius={16}
                    />
                    <View style={styles.versionCopy}>
                      <Text numberOfLines={1} style={styles.versionTitle}>
                        {`${version.label} • ${version.person}`}
                      </Text>
                      {/* The current row also carries the "Current" chip, which
                          leaves its note 153px of the 162 it needs on a phone.
                          Give the note a second line there rather than clip it. */}
                      <Text numberOfLines={l.isPhone ? 2 : 1} style={styles.versionNote}>
                        {version.note}
                      </Text>
                    </View>
                    {version.current ? (
                      <View style={styles.currentChip}>
                        <Text style={styles.currentChipText}>Current</Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>

              <View style={styles.commentCard}>
                <Media
                  name="people/megan-roberts"
                  alt="Megan Roberts"
                  style={styles.commentAvatar}
                  radius={14}
                />
                <View style={styles.commentCopy}>
                  <Text numberOfLines={1} style={styles.commentName}>
                    Megan Roberts • Brand lead
                  </Text>
                  <Text style={styles.commentBody}>
                    Love v4. Approving for the Thursday send — keep the same crop for the story cut.
                  </Text>
                </View>
              </View>

              <View style={styles.publishRow}>
                <View style={styles.publishChip}>
                  <FontAwesome6 name="circle-check" size={11} color={t.successText} />
                  <Text style={styles.publishChipText}>Approved</Text>
                </View>
                <View style={styles.publishButton}>
                  <FontAwesome6 name="paper-plane" size={11} color={t.textOnBrand} />
                  <Text style={styles.publishButtonText}>Publish</Text>
                </View>
              </View>
            </View>
          </Reveal>
        </View>
      </Band>

      {/* ------------------------------------------------ templates */}
      <Band tone="violet" art={{ variant: 'docs', color: t.violet, side: 'left' }}>
        <View style={styles.sectionHead}>
          <SectionLabel>START FROM SOMETHING</SectionLabel>
          <Heading level={2} style={[type.h2, styles.sectionTitle]}>
            Templates by industry.
          </Heading>
          <Text style={[type.body, styles.sectionSub]}>
            Openers written for your trade, already structured the way that industry actually sells.
          </Text>
        </View>

        <View style={styles.industryWrap} accessibilityRole="tablist">
          {INDUSTRIES.map((item) => {
            const active = item === industry;
            return (
              <Pressable
                key={item}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Show ${item} templates`}
                onPress={() => setIndustry(item)}
                style={[styles.industryChip, active ? styles.industryChipActive : null]}>
                <Text
                  numberOfLines={1}
                  style={[styles.industryText, active ? styles.industryTextActive : null]}>
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {templates.length === 0 ? (
          <View style={styles.templateEmpty}>
            <FontAwesome6 name="folder-open" size={18} color={t.textSubtle} />
            <Text style={styles.templateEmptyTitle}>No templates for that industry yet</Text>
            <Text style={styles.templateEmptyBody}>
              Pick another industry, or start from a blank brief — the studio writes the opener from
              your brand kit either way.
            </Text>
          </View>
        ) : (
          <View style={styles.templateGrid}>
            {templates.map((template, index) => (
              <Reveal
                key={template.title}
                style={styles.templateCell}
                distance={16}
                delay={index * 60}>
                <View style={styles.templateCard}>
                  <Media
                    name={template.media}
                    alt={template.alt}
                    style={styles.templateImage}
                    radius={12}
                  />
                  <View style={styles.templateCopy}>
                    <Text numberOfLines={1} style={styles.templateTitle}>
                      {template.title}
                    </Text>
                    <Text numberOfLines={1} style={styles.templateMeta}>
                      {template.industry}
                    </Text>
                  </View>
                </View>
              </Reveal>
            ))}
          </View>
        )}
      </Band>

      {/* ------------------------------------------------ trust */}
      <OpenSection>
        <View style={styles.sectionHead}>
          <SectionLabel>ORIGINALITY AND RIGHTS</SectionLabel>
          <Heading level={2} style={[type.h2, styles.sectionTitle]}>
            Content you can trust.
          </Heading>
          <Text style={[type.body, styles.sectionSub]}>
            AI output is only useful if you can put your name on it. Every asset arrives with the
            checks already done.
          </Text>
        </View>

        <View style={styles.trustRow}>
          <Reveal style={styles.trustVisual} distance={16}>
            <View style={styles.ringCard}>
              <ScoreRing
                value={98}
                size={l.isPhone ? 128 : 150}
                caption="originality"
                styles={styles}
                t={t}
              />
              <Text style={styles.ringTitle}>Originality score</Text>
              <View style={styles.ringRows}>
                {TRUST_ROWS.map((row) => (
                  <View key={row.label} style={styles.ringRow}>
                    <Text numberOfLines={1} style={styles.ringRowLabel}>
                      {row.label}
                    </Text>
                    <Text numberOfLines={1} style={styles.ringRowValue}>
                      {row.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Reveal>

          <View style={styles.trustGrid}>
            {TRUST.map((item, index) => {
              const accent = accentOf(item.accent);
              return (
                <Reveal key={item.title} style={styles.trustCell} distance={16} delay={index * 60}>
                  <View style={styles.trustCard}>
                    <View style={[styles.trustIcon, { backgroundColor: softFill(accent, t) }]}>
                      <FontAwesome6 name={item.icon as never} size={16} color={accent} />
                    </View>
                    <Text style={styles.trustTitle}>{item.title}</Text>
                    <Text style={styles.trustBody}>{item.body}</Text>
                  </View>
                </Reveal>
              );
            })}
          </View>
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

  /** Column counts chosen per breakpoint so a short last row never orphans. */
  const columns = (phone: number, tablet: number, laptop: number, desktop: number) =>
    l.isPhone ? phone : l.isTablet ? tablet : l.isDesktop ? desktop : laptop;

  const formatColumns = columns(1, 2, 4, 4); // 8 cards
  const outputColumns = columns(1, 2, 4, 4); // 4 cards
  const pairColumns = columns(1, 1, 2, 2); // 2 cards
  const collabColumns = columns(1, 2, 2, 2); // 4 cards
  const templateColumns = columns(1, 2, 3, 3); // 6 cards
  const trustColumns = columns(1, 2, 2, 2); // 4 cards

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

  const chipBase: ViewStyle = {
    flexGrow: 0,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 0,
  };

  /* Media styles are declared separately so they type-check as ImageStyle. */
  const resultImage: ImageStyle = { width: '100%', aspectRatio: 4 / 5 };
  const refImage: ImageStyle = { width: '100%', aspectRatio: 1 };
  const outputImage: ImageStyle = { width: '100%', height: l.isPhone ? 118 : 96 };
  const stageImage: ImageStyle = { width: '100%', aspectRatio: 16 / 10 };
  const templateImage: ImageStyle = { width: '100%', aspectRatio: 16 / 10 };
  const versionAvatar: ImageStyle = { width: 32, height: 32, flexGrow: 0, flexShrink: 0 };
  const quoteAvatar: ImageStyle = { width: 32, height: 32, flexGrow: 0, flexShrink: 0 };
  const commentAvatar: ImageStyle = { width: 28, height: 28, flexGrow: 0, flexShrink: 0 };

  const railWide = !l.isCompact;

  return StyleSheet.create({
    /* -------------------------------------------------- hero */
    heroRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'center',
      gap: stacked ? 28 : 40,
    },
    heroCopy: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 420, minWidth: 300 },
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
      : { flexGrow: 1.4, flexShrink: 1, flexBasis: 560, minWidth: 0 },

    /* -------------------------------------------------- studio mock */
    studioCard: {
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 12 : 16,
      gap: 12,
      ...(elevation(t, 3) as ViewStyle),
    },
    studioBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    studioBarCopy: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    studioBadge: {
      width: 32,
      height: 32,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    studioBarText: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    studioTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    studioSub: { ...type.micro, color: t.textSubtle },
    approvalChip: { ...chipBase, flexShrink: 0, backgroundColor: t.successBg },
    approvalText: { ...type.micro, color: t.successText, fontWeight: '800' },

    studioBody: {
      flexDirection: railWide ? 'row' : 'column',
      alignItems: 'stretch',
      gap: 12,
    },
    rail: railWide
      ? { width: 132, flexGrow: 0, flexShrink: 0, gap: 5 }
      : { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    railItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: railWide ? 36 : 32,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: 'transparent',
      minWidth: 0,
      flexGrow: 0,
      flexShrink: 1,
    },
    railItemActive: { backgroundColor: t.brandSoft, borderColor: t.border },
    railLabel: { ...type.micro, color: t.textSubtle, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    railLabelActive: { color: t.brand },

    studioMain: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 12 },
    promptBox: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      padding: 13,
      gap: 8,
    },
    promptLabel: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 1 },
    promptText: { ...type.caption, color: t.text, fontWeight: '600' },
    promptFoot: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7 },
    promptChip: { ...chipBase, backgroundColor: t.chipBg },
    promptChipText: { ...type.micro, color: t.chipText, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    generateChip: { ...chipBase, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: t.brand },
    generateText: { ...type.micro, color: t.textOnBrand, fontWeight: '800' },

    resultRow: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: 'stretch',
      gap: 12,
    },
    resultPane: l.isPhone
      ? { width: '100%', minWidth: 0, gap: 8 }
      : { flexGrow: 1.1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 8 },
    resultImage,
    resultFoot: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    resultName: {
      ...type.micro,
      color: t.textMuted,
      fontWeight: '700',
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
    },
    resultTag: {
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 3,
      backgroundColor: softFill(t.violet, t),
    },
    resultTagText: { ...type.micro, color: accentText(t.violet, t), fontWeight: '800' },

    kitPane: l.isPhone
      ? {
          width: '100%',
          minWidth: 0,
          gap: 11,
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
          gap: 11,
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: 14,
          backgroundColor: t.surfaceRaised,
          padding: 13,
        },
    kitTitle: { ...type.caption, color: t.text, fontWeight: '800' },
    kitLogoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    kitLogoTile: {
      width: 34,
      height: 34,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.violet, t),
    },
    kitLogoCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    kitRowTitle: { ...type.micro, color: t.text, fontWeight: '800' },
    kitRowMeta: { ...type.micro, color: t.textSubtle },
    kitBlock: { gap: 6 },
    kitBlockLabel: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 0.9 },
    swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    swatch: { width: 22, height: 22, borderRadius: 7, flexGrow: 0, flexShrink: 0 },
    swatchLarge: { width: 30, height: 30, borderRadius: 9, flexGrow: 0, flexShrink: 0 },
    kitTypeDisplay: { fontSize: 15, lineHeight: 20, fontWeight: '800', color: t.text },
    kitTypeBody: { ...type.micro, color: t.textMuted },
    voiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    voiceChip: {
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      backgroundColor: t.surfaceInset,
    },
    voiceChipText: { ...type.micro, color: t.textMuted, fontWeight: '700' },

    studioFoot: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    studioFootText: { ...type.micro, color: t.textSubtle, flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- shared heads */
    sectionHead: { gap: 11, alignItems: l.isPhone ? 'flex-start' : 'center' },
    sectionTitle: { textAlign: l.isPhone ? 'left' : 'center' },
    sectionSub: { textAlign: l.isPhone ? 'left' : 'center', maxWidth: 680 },

    /* -------------------------------------------------- formats */
    formatGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 28) - half },
    formatCell: cellBase(formatColumns),
    formatCard: { ...cardBase, gap: 10, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    formatIcon: {
      width: 44,
      height: 44,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    formatTitle: { marginTop: 2 },
    formatBody: { ...type.bodySm, color: t.textMuted },

    /* -------------------------------------------------- split rows */
    splitRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'flex-start',
      gap: stacked ? 28 : 40,
    },
    splitCopy: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    splitVisual: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    splitTitle: { marginTop: 14 },
    splitBody: { marginTop: 14, maxWidth: 540 },

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

    /* -------------------------------------------------- brand setup + quote */
    setupCard: {
      marginTop: 22,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 18,
      gap: 12,
    },
    setupLabel: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 0.9 },
    setupRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    setupIndex: {
      width: 28,
      height: 28,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    setupIndexText: { ...type.micro, color: accentText(t.brand, t), fontWeight: '800' },
    setupCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    setupTitle: { ...type.caption, color: t.text, fontWeight: '800' },
    setupNote: { ...type.caption, color: t.textMuted },

    quoteCard: {
      marginTop: 14,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 14 : 18,
      gap: 10,
      alignItems: 'flex-start',
    },
    quoteText: { ...type.bodySm, color: t.text, fontWeight: '700' },
    quoteWho: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
    quoteAvatar,
    quoteWhoCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    quoteName: { ...type.micro, color: t.text, fontWeight: '800' },
    quoteRole: { ...type.micro, color: t.textSubtle },

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
    panelNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 9,
      borderRadius: 12,
      backgroundColor: t.chipBg,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    panelNoteText: { ...type.micro, color: t.chipText, fontWeight: '600', flexShrink: 1, minWidth: 0 },

    kitInlineRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
    kitInlineTile: {
      width: 40,
      height: 40,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.violet, t),
    },

    refGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
    refCell: { flexGrow: 0, flexShrink: 1, flexBasis: cellBasis(2), minWidth: 0, padding: 5 },
    refImage,

    /* -------------------------------------------------- one brief */
    briefRow: {
      marginTop: l.isPhone ? 20 : 28,
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'center',
      gap: 0,
    },
    briefCard: stacked
      ? {
          width: '100%',
          minWidth: 0,
          gap: 10,
          borderWidth: 1,
          borderColor: t.borderStrong,
          borderRadius: 16,
          backgroundColor: t.surfaceMuted,
          padding: l.isPhone ? 15 : 18,
        }
      : {
          flexGrow: 0,
          flexShrink: 0,
          flexBasis: 260,
          minWidth: 0,
          gap: 10,
          borderWidth: 1,
          borderColor: t.borderStrong,
          borderRadius: 16,
          backgroundColor: t.surfaceMuted,
          padding: 18,
        },
    briefLabel: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 1 },
    briefText: { ...type.caption, color: t.text, fontWeight: '600' },
    briefMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    briefChip: {
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: t.chipBg,
    },
    briefChipText: { ...type.micro, color: t.chipText, fontWeight: '700' },
    briefArrow: {
      flexGrow: 0,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: stacked ? 12 : 0,
      paddingHorizontal: stacked ? 0 : 14,
    },
    arrowDown: { transform: [{ rotate: '90deg' }] },
    // Stacked, the grid is a stretched column child; side-by-side it takes the
    // rest of the row. Either way the negative margin only eats section padding,
    // never the viewport — the page must not scroll sideways.
    outputGrid: stacked
      ? { ...gridBase, minWidth: 0 }
      : { ...gridBase, flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    outputCell: cellBase(outputColumns),
    outputCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      padding: 10,
      gap: 8,
      alignItems: 'flex-start',
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      ...(elevation(t, 1) as ViewStyle),
    },
    outputImage,
    outputTitle: { ...type.caption, color: t.text, fontWeight: '800', minWidth: 0 },
    outputSize: {
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 3,
    },
    outputSizeText: { ...type.micro, fontWeight: '800' },

    /* -------------------------------------------------- editor + video */
    pairGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 28) - half },
    pairCell: cellBase(pairColumns),
    pairCard: { ...cardBase, gap: 14, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    pairHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    pairIcon: {
      width: 46,
      height: 46,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pairHeadCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 5 },
    pairTitle: {},
    pairBlurb: { ...type.bodySm, color: t.textMuted },

    editorStage: { position: 'relative', width: '100%', minWidth: 0 },
    stageImage,
    stageBadge: {
      position: 'absolute',
      left: 10,
      bottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: t.violet,
    },
    stageBadgeText: { ...type.micro, color: t.textOnBrand, fontWeight: '800' },
    playBadge: {
      position: 'absolute',
      alignSelf: 'center',
      top: '42%',
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: hexToRgba(t.brand, 0.92),
    },
    durationBadge: {
      position: 'absolute',
      right: 10,
      bottom: 10,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      // Near-black rather than the shadow token: in light that token is a
      // navy (#1f2d62), and at 62% over a bright frame the white label landed
      // at 4.07. The scrim has to carry the contrast on its own, because what
      // is behind it is a photograph and could be anything.
      backgroundColor: hexToRgba('#000000', 0.72),
    },
    // On a black scrim over imagery, not on a brand fill — so it needs the
    // always-white scrim ink, not the on-brand ink (which is dark in grey/dark).
    durationText: { ...type.micro, color: t.textOnScrim, fontWeight: '800' },

    timelineRow: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
    timelineCell: { flexGrow: 0, flexShrink: 1, flexBasis: cellBasis(4), minWidth: 0, padding: 4 },
    timelineClip: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 10,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 9,
      paddingVertical: 9,
      gap: 3,
    },
    timelineLabel: { ...type.micro, color: t.text, fontWeight: '800' },
    timelineLength: { ...type.micro, color: t.textSubtle },

    toolWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    toolChip: {
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 6,
      backgroundColor: t.surfaceMuted,
    },
    toolChipText: { ...type.micro, color: t.textMuted, fontWeight: '700' },

    /* -------------------------------------------------- collaborate */
    collabGrid: { ...gridBase, marginTop: 22 - half },
    collabCell: cellBase(collabColumns),
    collabCard: {
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
    collabIcon: {
      width: 38,
      height: 38,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    collabTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    collabBody: { ...type.caption, color: t.textMuted },

    versionList: { gap: 8 },
    versionRow: {
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
    versionRowCurrent: { borderColor: hexToRgba(t.brand, 0.45), backgroundColor: t.brandSoft },
    versionAvatar,
    versionCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    versionTitle: { ...type.micro, color: t.text, fontWeight: '800' },
    versionNote: { ...type.micro, color: t.textSubtle },
    currentChip: {
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      backgroundColor: t.surfaceInset,
    },
    currentChipText: { ...type.micro, color: accentText(t.brand, t), fontWeight: '800' },

    commentCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 11,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      padding: 13,
    },
    commentAvatar,
    commentCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 4 },
    commentName: { ...type.micro, color: t.text, fontWeight: '800' },
    commentBody: { ...type.caption, color: t.textMuted },

    publishRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 9 },
    publishChip: { ...chipBase, flexShrink: 0, backgroundColor: t.successBg },
    publishChipText: { ...type.micro, color: t.successText, fontWeight: '800' },
    publishButton: {
      ...chipBase,
      flexShrink: 0,
      paddingHorizontal: 14,
      paddingVertical: 7,
      backgroundColor: t.brand,
    },
    publishButtonText: { ...type.micro, color: t.textOnBrand, fontWeight: '800' },

    /* -------------------------------------------------- templates */
    industryWrap: {
      marginTop: l.isPhone ? 18 : 24,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: l.isPhone ? 'flex-start' : 'center',
      gap: 8,
    },
    // A real control now, so it carries a 44px touch target.
    industryChip: {
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
      minHeight: 44,
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 999,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    industryChipActive: { borderColor: hexToRgba(t.brand, 0.5), backgroundColor: t.brandSoft },
    industryText: { ...type.caption, color: t.textMuted, fontWeight: '700' },
    industryTextActive: { color: t.brand },

    templateEmpty: {
      marginTop: l.isPhone ? 16 : 22,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 16 : 20,
      gap: 9,
      alignItems: 'flex-start',
    },
    templateEmptyTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    templateEmptyBody: { ...type.caption, color: t.textMuted, maxWidth: 520 },

    templateGrid: { ...gridBase, marginTop: (l.isPhone ? 16 : 22) - half },
    templateCell: cellBase(templateColumns),
    templateCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceRaised,
      padding: 10,
      gap: 10,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      ...(elevation(t, 1) as ViewStyle),
    },
    templateImage,
    templateCopy: { gap: 3, paddingHorizontal: 3, paddingBottom: 4 },
    templateTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    templateMeta: { ...type.micro, color: t.textSubtle },

    /* -------------------------------------------------- trust */
    trustRow: {
      marginTop: l.isPhone ? 20 : 28,
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'stretch',
      gap: stacked ? 20 : 28,
    },
    trustVisual: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 0, flexShrink: 0, flexBasis: 300, minWidth: 0 },
    ringCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 16 : 20,
      gap: 14,
      alignItems: 'center',
      ...(elevation(t, 2) as ViewStyle),
    },
    ringWrap: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
    ringCentre: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    ringValue: { fontSize: l.isPhone ? 26 : 30, lineHeight: l.isPhone ? 31 : 35, fontWeight: '800', color: t.text },
    ringCaption: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    ringTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    ringRows: { width: '100%', minWidth: 0, gap: 7 },
    ringRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    ringRowLabel: { ...type.micro, color: t.textMuted, flexShrink: 1, minWidth: 0 },
    ringRowValue: { ...type.micro, color: t.successText, fontWeight: '800', flexGrow: 0, flexShrink: 0 },

    trustGrid: stacked
      ? { ...gridBase, minWidth: 0 }
      : { ...gridBase, flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    trustCell: cellBase(trustColumns),
    trustCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 16 : 18,
      gap: 10,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    trustIcon: {
      width: 42,
      height: 42,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    trustTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    trustBody: { ...type.caption, color: t.textMuted },
  });
}
