import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { useRouter } from 'expo-router';
import { Fragment, useCallback, useMemo } from 'react';
import { Linking, StyleSheet, Text, View, type ImageStyle, type ViewStyle } from 'react-native';
import { contactHref, EXTERNAL } from '@/lib/destinations';
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
  useOpenSection,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { accentText, elevation, hexToRgba, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

type Accent = 'brand' | 'violet' | 'green' | 'orange' | 'pink';

const PROOF = ['Every network in one place', 'Approvals before anything posts', 'No extra scheduling tool'];

type Slot = { channel: string; time: string; media?: string; alt?: string; draft?: boolean };

/**
 * A real week, not a frame around an empty grid: fourteen posts spread over
 * seven days — twelve scheduled and two still in draft, which is what the
 * header chip counts.
 */
const WEEK: { day: string; date: string; today?: boolean; slots: Slot[] }[] = [
  {
    day: 'Mon',
    date: '06',
    slots: [
      { channel: 'instagram', time: '09:00', media: 'scenes/post-sneakers-white', alt: 'Sneaker studio post' },
      { channel: 'x', time: '18:00' },
    ],
  },
  {
    day: 'Tue',
    date: '07',
    slots: [
      { channel: 'linkedin', time: '11:30' },
      { channel: 'facebook', time: '16:00' },
    ],
  },
  {
    day: 'Wed',
    date: '08',
    slots: [
      { channel: 'tiktok', time: '17:00', media: 'scenes/post-sneakers-lifestyle', alt: 'Sneaker lifestyle post' },
      { channel: 'youtube', time: '12:00' },
    ],
  },
  {
    day: 'Thu',
    date: '09',
    slots: [
      { channel: 'facebook', time: '08:15' },
      { channel: 'instagram', time: '19:00', draft: true },
    ],
  },
  {
    day: 'Fri',
    date: '10',
    today: true,
    slots: [
      { channel: 'instagram', time: '10:00', media: 'scenes/post-apparel-flatlay', alt: 'Apparel flatlay post' },
      { channel: 'tiktok', time: '19:30' },
    ],
  },
  {
    day: 'Sat',
    date: '11',
    slots: [
      { channel: 'youtube', time: '14:00' },
      { channel: 'linkedin', time: '09:30', draft: true },
    ],
  },
  {
    day: 'Sun',
    date: '12',
    slots: [
      { channel: 'facebook', time: '11:00' },
      { channel: 'x', time: '19:30' },
    ],
  },
];

const CHANNEL_PREVIEWS: {
  channel: string;
  name: string;
  caption: string;
  likes: string;
  comments: string;
}[] = [
  { channel: 'instagram', name: 'Instagram', caption: 'Fresh drop, fresh mornings.', likes: '1.2K', comments: '86' },
  { channel: 'facebook', name: 'Facebook', caption: 'The spring collection is live today.', likes: '742', comments: '54' },
  { channel: 'tiktok', name: 'TikTok', caption: 'Three ways to wear the new pair.', likes: '4.8K', comments: '312' },
  { channel: 'linkedin', name: 'LinkedIn', caption: 'How we designed for all-day comfort.', likes: '396', comments: '41' },
  { channel: 'youtube', name: 'YouTube', caption: 'Behind the spring shoot — 60 seconds.', likes: '1.9K', comments: '128' },
  { channel: 'x', name: 'X', caption: 'New season. Same fit you asked for.', likes: '518', comments: '73' },
];

const QUEUE: { time: string; channel: string; title: string; status: string; media?: string; alt?: string }[] = [
  {
    time: '09:00',
    channel: 'instagram',
    title: 'Spring drop — carousel',
    status: 'Scheduled',
    media: 'scenes/post-sneakers-white',
    alt: 'Sneaker studio post',
  },
  { time: '11:30', channel: 'linkedin', title: 'Design notes — long post', status: 'In review' },
  {
    time: '17:00',
    channel: 'tiktok',
    title: 'Styling reel — 3 looks',
    status: 'Scheduled',
    media: 'scenes/post-sneakers-lifestyle',
    alt: 'Sneaker lifestyle post',
  },
  { time: '19:30', channel: 'x', title: 'Launch thread', status: 'Draft' },
];

/** Who is allowed to do what, once the approval chain is set. */
const PUBLISH_RIGHTS: { role: string; note: string }[] = [
  { role: 'Owner', note: 'Publishes to every connected channel.' },
  { role: 'Manager', note: 'Approves anything; publishes only where you allow it.' },
  { role: 'Contributor', note: 'Drafts and comments, never publishes.' },
];

const ADAPT_TABS = ['instagram', 'facebook', 'tiktok', 'linkedin', 'x'];

/**
 * One post, three networks, shown side by side.
 *
 * This section claims a post adapts to every channel and used to prove it with
 * a single tall Instagram card — which demonstrated nothing and left the visual
 * column twice the height of the copy beside it, so the section ended in 300px
 * of empty page. Three crops in a row is both the argument and a block that
 * matches the copy's height.
 */
const ADAPT_VARIANTS: { channel: string; label: string; ratio: string; aspect: number; media: string; caption: string }[] = [
  {
    channel: 'instagram',
    label: 'Feed',
    ratio: '4:5',
    aspect: 4 / 5,
    media: 'scenes/post-sneakers-white',
    caption: 'Fresh drop, fresh mornings. #springpair',
  },
  {
    channel: 'linkedin',
    label: 'Post',
    ratio: '1.91:1',
    aspect: 1.91,
    media: 'scenes/post-sneakers-lifestyle',
    caption: 'Why we rebuilt the sole after 4,000 customer notes.',
  },
  {
    channel: 'tiktok',
    label: 'Video cover',
    ratio: '9:16',
    aspect: 9 / 16,
    media: 'scenes/post-apparel-flatlay',
    caption: 'the fit you asked us to keep 👟',
  },
];

const ADAPT_TICKS = [
  'Cropped to 4:5 — the frame Instagram actually shows',
  'Caption trimmed to the 125 characters that stay visible',
  'Five relevant hashtags added, none of them banned',
  'Link moved to the profile, with a tracked short URL',
];

const INBOX_FILTERS: { label: string; count: string; active?: boolean }[] = [
  { label: 'All', count: '24', active: true },
  { label: 'Comments', count: '12' },
  { label: 'Mentions', count: '5' },
  { label: 'DMs', count: '7' },
];

const INBOX: {
  person: string;
  media: string;
  channel: string;
  kind: string;
  message: string;
  time: string;
}[] = [
  {
    person: 'Maya Thompson',
    media: 'people/maya-thompson',
    channel: 'instagram',
    kind: 'Comment',
    message: 'Do these come in a wide fit? Been waiting all season for this.',
    time: '2m',
  },
  {
    person: 'Carlos Ramirez',
    media: 'people/carlos-ramirez',
    channel: 'facebook',
    kind: 'DM',
    message: 'Is the 15% off code still working? It says expired at checkout.',
    time: '14m',
  },
  {
    person: 'Aisha Williams',
    media: 'people/aisha-williams',
    channel: 'tiktok',
    kind: 'Mention',
    message: 'Wore these to work all week and my feet are so happy.',
    time: '1h',
  },
  {
    person: 'David Chen',
    media: 'people/david-chen',
    channel: 'linkedin',
    kind: 'Comment',
    message: 'Great write-up. Would love to hear how you chose the materials.',
    time: '3h',
  },
];

const LEAD_FLOW: { icon: string; title: string; note: string; accent: Accent }[] = [
  {
    icon: 'comment',
    title: 'Comment spotted',
    note: 'Someone asks about price, sizing or availability.',
    accent: 'brand',
  },
  {
    icon: 'reply',
    title: 'Public reply posted',
    note: 'A short, on-brand answer goes up within seconds.',
    accent: 'violet',
  },
  {
    icon: 'envelope',
    title: 'DM with the offer',
    note: 'The details and the link land privately, not in the thread.',
    accent: 'orange',
  },
  {
    icon: 'address-card',
    title: 'Lead created',
    note: 'The contact, the channel and the question reach your CRM.',
    accent: 'green',
  },
];

const PERFORMANCE: {
  key: string;
  label: string;
  target: number;
  decimals: number;
  prefix: string;
  suffix: string;
  delta: string;
  accent: Accent;
}[] = [
  { key: 'engagement', label: 'Engagement rate', target: 5.6, decimals: 1, prefix: '', suffix: '%', delta: '+28%', accent: 'brand' },
  { key: 'impressions', label: 'Impressions', target: 248, decimals: 0, prefix: '', suffix: 'K', delta: '+32%', accent: 'violet' },
  { key: 'clicks', label: 'Link clicks', target: 12.8, decimals: 1, prefix: '', suffix: 'K', delta: '+18%', accent: 'green' },
];

const RECOMMENDATIONS: { icon: string; title: string; body: string; accent: Accent }[] = [
  {
    icon: 'clock',
    title: 'Move Thursday to 6:30pm',
    body: 'Your last nine evening posts beat the morning slot by 41% on saves.',
    accent: 'orange',
  },
  {
    icon: 'repeat',
    title: 'Re-cut the styling reel for Reels',
    body: 'It over-performed on TikTok and has never been posted to Instagram.',
    accent: 'violet',
  },
  {
    icon: 'user-plus',
    title: 'Reply to 12 unanswered comments',
    body: 'Threads you answer within an hour convert at nearly three times the rate.',
    accent: 'brand',
  },
];

const UGC_TABS: { label: string; count: string; active?: boolean }[] = [
  { label: 'All', count: '128', active: true },
  { label: 'Creators', count: '46' },
  { label: 'Tagged', count: '52' },
  { label: 'Reviews', count: '30' },
];

const UGC: { media: string; alt: string; handle: string; note: string }[] = [
  { media: 'scenes/ugc-creator-1', alt: 'Creator content, first clip', handle: '@lena.makes', note: 'Rights cleared' },
  { media: 'scenes/ugc-creator-2', alt: 'Creator content, second clip', handle: '@arjun.runs', note: 'Rights cleared' },
  { media: 'scenes/ugc-creator-3', alt: 'Creator content, third clip', handle: '@thecityfit', note: 'Awaiting rights' },
  { media: 'scenes/post-sneakers-white', alt: 'Tagged sneaker studio shot', handle: '@maya.t', note: 'Tagged you' },
  { media: 'scenes/post-sneakers-lifestyle', alt: 'Tagged sneaker lifestyle shot', handle: '@runwithdc', note: 'Tagged you' },
  { media: 'scenes/post-apparel-flatlay', alt: 'Tagged apparel flatlay', handle: '@stillsbypriya', note: 'Rights cleared' },
];

const APPROVAL_CHAIN: { label: string; person: string; media: string; state: string; accent: Accent }[] = [
  { label: 'Drafted', person: 'Jordan Lee', media: 'people/jordan-lee', state: 'Done', accent: 'brand' },
  { label: 'Brand review', person: 'Megan Roberts', media: 'people/megan-roberts', state: 'Approved', accent: 'green' },
  { label: 'Legal check', person: 'Michael Reyes', media: 'people/michael-reyes', state: 'Approved', accent: 'green' },
  { label: 'Scheduled', person: 'Priya Shah', media: 'people/priya-shah', state: 'Fri 10:00', accent: 'violet' },
];

const SAFETY: { icon: string; title: string; body: string }[] = [
  { icon: 'ban', title: 'Banned words', body: 'Terms you never want published are blocked before a post can be queued.' },
  { icon: 'scale-balanced', title: 'Claims check', body: 'Superlatives and unproven claims are flagged for a human to confirm.' },
  { icon: 'user-group', title: 'Competitor mentions', body: 'Rival brand names are surfaced so nothing goes out by accident.' },
  { icon: 'image', title: 'Image safety', body: 'Every asset is screened for content that would breach a network policy.' },
];

const INTEGRATIONS = ['shopify', 'slack', 'zapier', 'googledrive', 'dropbox', 'airtable', 'make'];

const INTEGRATION_CARDS: { icon: string; title: string; body: string; accent: Accent }[] = [
  {
    icon: 'bag-shopping',
    title: 'Sell from the post',
    body: 'Products, prices and stock come straight from your catalogue, so a tagged post is never out of date.',
    accent: 'orange',
  },
  {
    icon: 'folder-open',
    title: 'Use the assets you already have',
    body: 'Pull approved photography and video out of the drive your team already works in.',
    accent: 'brand',
  },
  {
    icon: 'bolt',
    title: 'Wire it into everything else',
    body: 'Send a new comment, mention or lead anywhere your workflows already live.',
    accent: 'violet',
  },
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

/** Numbered head shared by the eight feature sections. */
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

function StatTile({
  stat,
  accent,
  styles,
  t,
}: {
  stat: (typeof PERFORMANCE)[number];
  accent: string;
  styles: Styles;
  t: ThemeTokens;
}) {
  const counter = useCountUp(stat.target, { decimals: stat.decimals });
  return (
    <View ref={counter.ref as never} style={styles.statTile}>
      <Text numberOfLines={1} style={styles.statLabel}>
        {stat.label}
      </Text>
      <Text numberOfLines={1} style={styles.statValue}>
        {`${stat.prefix}${counter.value.toFixed(stat.decimals)}${stat.suffix}`}
      </Text>
      <View style={[styles.statDelta, { backgroundColor: softFill(accent, t) }]}>
        <Text numberOfLines={1} style={[styles.statDeltaText, { color: accentText(accent, t) }]}>
          {`${stat.delta} vs last month`}
        </Text>
      </View>
    </View>
  );
}

function ChannelMark({ channel, size, styles }: { channel: string; size: number; styles: Styles }) {
  return (
    <View style={styles.markTile}>
      <BrandLogo name={channel} size={size} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function SocialPage() {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  const open = useOpenSection();
  const styles = useMemo(() => createStyles(t, l, type), [t, l, type]);
  const accentOf = useAccent();
  const router = useRouter();

  return (
    <PageShell
      title="Social"
      description="Plan every network on one calendar, adapt each post to where it lands, and keep every comment, mention and DM in a single inbox."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Product', path: ROUTES.product },
          { name: 'Social', path: ROUTES.social },
        ]),
      ]}>
      {/* ------------------------------------------------ hero */}
      <Reveal style={open} distance={22}>
        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            <SectionLabel>ONE SOCIAL WORKSPACE</SectionLabel>
            <Heading level={1} style={[type.display, styles.heroTitle]}>
              Plan once. Publish everywhere. Learn from every interaction.
            </Heading>
            <Text style={[type.body, styles.heroBody]}>
              One calendar for every network, captions and media adapted to each one, and every
              comment, mention and message waiting in a single inbox.
            </Text>
            <View style={styles.heroButtons}>
              <ButtonRow>
                <PrimaryButton
                  label="Start free"
                  size="lg"
                  full={l.isPhone}
                  trackId="social.hero.start-free"
                  onPress={() => Linking.openURL(EXTERNAL.signup)}
                />
                <SecondaryButton
                  label="Watch a demo"
                  size="lg"
                  icon="play"
                  full={l.isPhone}
                  trackId="social.hero.demo"
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
            <View style={styles.plannerCard}>
              <View style={styles.plannerBar}>
                <View style={styles.plannerBarCopy}>
                  <Text numberOfLines={1} style={styles.plannerTitle}>
                    Content calendar
                  </Text>
                  <Text numberOfLines={1} style={styles.plannerSub}>
                    Week of 6 April • 6 channels
                  </Text>
                </View>
                <View style={styles.plannerChip}>
                  <FontAwesome6 name="calendar-check" size={11} color={t.chipText} />
                  <Text style={styles.plannerChipText}>12 scheduled · 2 drafts</Text>
                </View>
              </View>

              <View style={styles.plannerBody}>
                <View style={styles.calendar}>
                  <View style={styles.weekList}>
                    {WEEK.map((day) => (
                      <View key={day.day} style={day.today ? styles.dayRowToday : styles.dayRow}>
                        <View style={styles.dayStamp}>
                          <Text numberOfLines={1} style={styles.dayName}>
                            {day.day}
                          </Text>
                          <Text numberOfLines={1} style={styles.dayDate}>
                            {day.date}
                          </Text>
                        </View>
                        <View style={styles.slotList}>
                          {day.slots.map((slot) => (
                            <View
                              key={`${day.day}-${slot.time}`}
                              style={slot.draft ? styles.slotDraft : styles.slot}>
                              {slot.media ? (
                                <Media
                                  name={slot.media}
                                  alt={slot.alt ?? 'Scheduled post'}
                                  style={styles.slotImage}
                                  radius={6}
                                />
                              ) : null}
                              <BrandLogo name={slot.channel} size={12} />
                              <Text numberOfLines={1} style={styles.slotTime}>
                                {slot.time}
                              </Text>
                              {slot.draft ? (
                                <Text numberOfLines={1} style={styles.slotDraftTag}>
                                  Draft
                                </Text>
                              ) : null}
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.previewColumn}>
                  <Text style={styles.previewLabel}>LIVE THIS WEEK</Text>
                  {CHANNEL_PREVIEWS.map((preview) => (
                    <View key={preview.channel} style={styles.previewRow}>
                      <ChannelMark channel={preview.channel} size={16} styles={styles} />
                      <View style={styles.previewCopy}>
                        <Text numberOfLines={1} style={styles.previewName}>
                          {preview.name}
                        </Text>
                        <Text numberOfLines={1} style={styles.previewCaption}>
                          {preview.caption}
                        </Text>
                      </View>
                      <View style={styles.previewStats}>
                        <View style={styles.previewStat}>
                          <FontAwesome6 name="heart" size={9} color={t.textSubtle} />
                          <Text numberOfLines={1} style={styles.previewStatText}>
                            {preview.likes}
                          </Text>
                        </View>
                        <View style={styles.previewStat}>
                          <FontAwesome6 name="comment" size={9} color={t.textSubtle} />
                          <Text numberOfLines={1} style={styles.previewStatText}>
                            {preview.comments}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>
        </View>
      </Reveal>

      {/* ------------------------------------------------ 01 calendar */}
      <OpenSection>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <StepHead
              index={1}
              eyebrow="THE CALENDAR"
              title="Plan the week, then drag it into shape."
              body="Every network sits on one grid. Move a post and the time, the channel and the assets move with it — no copy-pasting between five schedulers."
              styles={styles}
              type={type}
            />
            <View style={styles.tickList}>
              <Tick text="Drag between days and time slots, or duplicate a post to another channel." styles={styles} t={t} />
              <Tick text="Queue slots hold your recurring posting times so gaps are obvious." styles={styles} t={t} />
              <Tick text="Conflicts, blackout dates and campaign windows are enforced automatically." styles={styles} t={t} />
            </View>

            <View style={styles.coverCard}>
              <Text style={styles.coverLabel}>ALL ON THE SAME GRID</Text>
              <View style={styles.coverRow}>
                {CHANNEL_PREVIEWS.map((preview) => (
                  <View key={preview.channel} style={styles.coverChip}>
                    <BrandLogo name={preview.channel} size={13} />
                    <Text numberOfLines={1} style={styles.coverChipText}>
                      {preview.name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={90}>
            <View style={styles.panel}>
              <View style={styles.panelHead}>
                <View style={styles.panelIcon}>
                  <FontAwesome6 name="calendar-days" size={14} color={t.brand} />
                </View>
                <View style={styles.panelHeadCopy}>
                  <Text numberOfLines={1} style={styles.panelTitle}>
                    Friday 10 April
                  </Text>
                  <Text numberOfLines={1} style={styles.panelSub}>
                    4 posts queued • drag to reorder
                  </Text>
                </View>
              </View>

              <View style={styles.queueList}>
                {QUEUE.map((item) => (
                  <View key={item.time} style={styles.queueRow}>
                    <FontAwesome6 name="grip-vertical" size={12} color={t.textSubtle} />
                    <Text numberOfLines={1} style={styles.queueTime}>
                      {item.time}
                    </Text>
                    {item.media ? (
                      <Media
                        name={item.media}
                        alt={item.alt ?? item.title}
                        style={styles.queueThumb}
                        radius={8}
                      />
                    ) : (
                      <View style={styles.queueThumbBlank}>
                        <FontAwesome6 name="align-left" size={11} color={t.textSubtle} />
                      </View>
                    )}
                    <View style={styles.queueCopy}>
                      <Text numberOfLines={1} style={styles.queueTitle}>
                        {item.title}
                      </Text>
                      <View style={styles.queueMeta}>
                        <BrandLogo name={item.channel} size={11} />
                        <Text numberOfLines={1} style={styles.queueStatus}>
                          {item.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.hintRow}>
                <FontAwesome6 name="lightbulb" size={11} color={t.warnText} />
                <Text style={styles.hintText}>
                  Best time for this audience is 6:30pm — one tap moves the whole day.
                </Text>
              </View>
            </View>
          </Reveal>
        </View>
      </OpenSection>

      {/* ------------------------------------------------ 02 adapt per channel */}
      <Band tone="surface" art={{ variant: 'analytics', color: t.brand, side: 'right' }}>
        <View style={styles.splitRowFlip}>
          <Reveal style={styles.splitCopy} distance={16}>
            <StepHead
              index={2}
              eyebrow="WRITTEN FOR WHERE IT LANDS"
              title="Captions and media adapt to every channel."
              body="The same idea does not work the same way on LinkedIn and TikTok. Write it once and each network gets a version built for its crop, its length and its etiquette."
              styles={styles}
              type={type}
            />
            <View style={styles.tickList}>
              <Tick text="Aspect ratios, safe areas and file sizes handled per network." styles={styles} t={t} />
              <Tick text="Caption length, hashtags and link placement follow each platform's rules." styles={styles} t={t} />
              <Tick text="Edit any single version without touching the other five." styles={styles} t={t} />
            </View>

            {/* Moved out of the panel and under the copy. It belongs with the
                argument rather than inside the picture, and it is what closes
                the height gap between the two columns — the panel was running
                290px longer than the copy beside it. */}
            <View style={styles.optimizedList}>
              {ADAPT_TICKS.map((item) => (
                <View key={item} style={styles.optimizedRow}>
                  <View style={styles.optimizedTick}>
                    <FontAwesome6 name="check" size={9} color={t.green} />
                  </View>
                  <Text numberOfLines={2} style={styles.optimizedText}>
                    {item}
                  </Text>
                  <Text style={styles.optimizedTag}>Optimized</Text>
                </View>
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={90}>
            <View style={styles.panel}>
              <View style={styles.tabRow}>
                {ADAPT_TABS.map((channel, index) => (
                  <View key={channel} style={[styles.tab, index === 0 ? styles.tabActive : null]}>
                    <BrandLogo name={channel} size={14} />
                  </View>
                ))}
              </View>

              <View style={styles.adaptRow}>
                {ADAPT_VARIANTS.map((v) => (
                  <View key={v.channel} style={styles.adaptCell}>
                    <View style={styles.adaptCard}>
                      <View style={styles.adaptHead}>
                        <BrandLogo name={v.channel} size={14} />
                        <Text numberOfLines={1} style={styles.adaptTitle}>
                          {v.label}
                        </Text>
                        <View style={styles.adaptRatio}>
                          <Text style={styles.adaptRatioText}>{v.ratio}</Text>
                        </View>
                      </View>
                      {/* Each crop is the shape that network actually shows — a
                          single square would be the same mistake in three
                          places. */}
                      <Media
                        name={v.media}
                        alt={`The same post, cropped for ${v.channel}`}
                        style={{ width: '100%', aspectRatio: v.aspect }}
                        radius={10}
                      />
                      <Text numberOfLines={2} style={styles.adaptCaption}>
                        {v.caption}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </Reveal>
        </View>
      </Band>

      {/* ------------------------------------------------ 03 unified inbox */}
      <Band tone="pink" art={{ variant: 'funnel', color: t.pink, side: 'left' }}>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <StepHead
              index={3}
              eyebrow="ONE INBOX"
              title="Comments, mentions and DMs in one queue."
              body="Conversations do not stay on the channel that started them. Every reply your audience is waiting for arrives in the same place, with the post and the customer history attached."
              styles={styles}
              type={type}
            />
            <View style={styles.tickList}>
              <Tick text="Assign a conversation, leave an internal note, or escalate it." styles={styles} t={t} />
              <Tick text="Saved replies and AI drafts get the first answer out in seconds." styles={styles} t={t} />
              <Tick text="Every exchange is written back to the customer record automatically." styles={styles} t={t} />
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={90}>
            <View style={styles.panel}>
              <View style={styles.filterRow}>
                {INBOX_FILTERS.map((filter) => (
                  <View key={filter.label} style={[styles.filterChip, filter.active ? styles.filterChipActive : null]}>
                    <Text
                      numberOfLines={1}
                      style={[styles.filterText, filter.active ? styles.filterTextActive : null]}>
                      {filter.label}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[styles.filterCount, filter.active ? styles.filterTextActive : null]}>
                      {filter.count}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.inboxList}>
                {INBOX.map((item) => (
                  <View key={item.person} style={styles.inboxRow}>
                    <Media name={item.media} alt={item.person} style={styles.inboxAvatar} radius={17} />
                    <View style={styles.inboxCopy}>
                      <View style={styles.inboxTopRow}>
                        <Text numberOfLines={1} style={styles.inboxName}>
                          {item.person}
                        </Text>
                        <BrandLogo name={item.channel} size={11} />
                        <Text numberOfLines={1} style={styles.inboxKind}>
                          {item.kind}
                        </Text>
                        <Text numberOfLines={1} style={styles.inboxTime}>
                          {item.time}
                        </Text>
                      </View>
                      <Text numberOfLines={2} style={styles.inboxMessage}>
                        {item.message}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.composerRow}>
                <View style={styles.composerField}>
                  <Text numberOfLines={1} style={styles.composerPlaceholder}>
                    Reply to Maya…
                  </Text>
                </View>
                <View style={styles.composerSend}>
                  <FontAwesome6 name="paper-plane" size={12} color={t.textOnBrand} />
                </View>
              </View>
            </View>
          </Reveal>
        </View>
      </Band>

      {/* ------------------------------------------------ 04 comment to lead */}
      <OpenSection>
        <StepHead
          index={4}
          eyebrow="COMMENT TO LEAD"
          title="A question in the comments becomes a contact."
          body="The people asking about price and sizing are the warmest leads you will get all week. They should not evaporate at the bottom of a thread."
          center
          styles={styles}
          type={type}
        />

        <View style={styles.flowStrip}>
          {LEAD_FLOW.map((step, index) => {
            const accent = accentOf(step.accent);
            return (
              <Fragment key={step.title}>
                <View style={styles.flowCell}>
                  <View style={styles.flowCard}>
                    <View style={styles.flowTopRow}>
                      <View style={[styles.flowIcon, { backgroundColor: softFill(accent, t) }]}>
                        <FontAwesome6 name={step.icon as never} size={17} color={accent} />
                      </View>
                      <Text style={styles.flowIndex}>{`0${index + 1}`}</Text>
                    </View>
                    <Text style={[type.h4, styles.flowTitle]}>{step.title}</Text>
                    <Text style={styles.flowNote}>{step.note}</Text>
                  </View>
                </View>
                {index < LEAD_FLOW.length - 1 ? (
                  <View style={styles.flowArrow}>
                    {l.isStacked ? (
                      <FontAwesome6 name="arrow-down" size={14} color={t.borderStrong} />
                    ) : (
                      <ArrowLink width={36} height={12} color={t.borderStrong} />
                    )}
                  </View>
                ) : null}
              </Fragment>
            );
          })}
        </View>

        <View style={styles.assurance}>
          <View style={styles.assuranceIcon}>
            <FontAwesome6 name="shield-halved" size={15} color={t.successText} />
          </View>
          <Text style={styles.assuranceText}>
            You choose which questions trigger it, and every automatic reply is one you approved in
            advance.
          </Text>
        </View>
      </OpenSection>

      {/* ------------------------------------------------ 05 performance */}
      <Band tone="surface" art={{ variant: 'network', color: t.brand, side: 'right' }}>
        <StepHead
          index={5}
          eyebrow="WHAT IT EARNED"
          title="Performance you can act on, not just admire."
          body="Numbers are only useful attached to a next step. Every trend arrives with the specific change worth making this week."
          center
          styles={styles}
          type={type}
        />

        <View style={styles.statGrid}>
          {PERFORMANCE.map((stat, index) => (
            <Reveal key={stat.key} style={styles.statCell} distance={14} delay={index * 70}>
              <StatTile stat={stat} accent={accentOf(stat.accent)} styles={styles} t={t} />
            </Reveal>
          ))}
        </View>

        <View style={styles.recList}>
          {RECOMMENDATIONS.map((rec) => {
            const accent = accentOf(rec.accent);
            return (
              <View key={rec.title} style={styles.recRow}>
                <View style={[styles.recIcon, { backgroundColor: softFill(accent, t) }]}>
                  <FontAwesome6 name={rec.icon as never} size={14} color={accent} />
                </View>
                <View style={styles.recCopy}>
                  <Text style={styles.recTitle}>{rec.title}</Text>
                  <Text style={styles.recBody}>{rec.body}</Text>
                </View>
                <View style={styles.recTag}>
                  <Text style={styles.recTagText}>Suggested</Text>
                </View>
              </View>
            );
          })}
        </View>
      </Band>

      {/* ------------------------------------------------ 06 ugc library */}
      <Band tone="pink" art={{ variant: 'chart', color: t.pink, side: 'left' }}>
        <StepHead
          index={6}
          eyebrow="CREATOR CONTENT"
          title="A library of everything people made about you."
          body="Tagged posts, creator deliverables and review photos collected in one place, with rights status attached so you know what you may actually publish."
          center
          styles={styles}
          type={type}
        />

        <View style={styles.ugcTabRow}>
          {UGC_TABS.map((tab) => (
            <View key={tab.label} style={[styles.ugcTab, tab.active ? styles.ugcTabActive : null]}>
              <Text numberOfLines={1} style={[styles.ugcTabText, tab.active ? styles.ugcTabTextActive : null]}>
                {tab.label}
              </Text>
              <Text numberOfLines={1} style={[styles.ugcTabCount, tab.active ? styles.ugcTabTextActive : null]}>
                {tab.count}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.ugcGrid}>
          {UGC.map((item, index) => (
            <Reveal key={item.media} style={styles.ugcCell} distance={14} delay={index * 50}>
              <View style={styles.ugcCard}>
                <Media name={item.media} alt={item.alt} style={styles.ugcImage} radius={11} />
                <Text numberOfLines={1} style={styles.ugcHandle}>
                  {item.handle}
                </Text>
                <Text numberOfLines={1} style={styles.ugcNote}>
                  {item.note}
                </Text>
              </View>
            </Reveal>
          ))}
        </View>
      </Band>

      {/* ------------------------------------------------ 07 approvals */}
      <OpenSection>
        <View style={styles.splitRow}>
          <Reveal style={styles.splitCopy} distance={16}>
            <StepHead
              index={7}
              eyebrow="APPROVALS AND SAFETY"
              title="Nothing goes out before the right person says yes."
              body="Set who drafts, who reviews and who can publish. The chain is visible to everyone, and the brand-safety checks run whether or not anyone remembers to look."
              styles={styles}
              type={type}
            />

            <View style={styles.safetyGrid}>
              {SAFETY.map((item, index) => (
                <Reveal key={item.title} style={styles.safetyCell} distance={14} delay={index * 60}>
                  <View style={styles.safetyCard}>
                    <View style={styles.safetyIcon}>
                      <FontAwesome6 name={item.icon as never} size={14} color={t.brand} />
                    </View>
                    <Text style={styles.safetyTitle}>{item.title}</Text>
                    <Text style={styles.safetyBody}>{item.body}</Text>
                  </View>
                </Reveal>
              ))}
            </View>
          </Reveal>

          <Reveal style={styles.splitVisual} distance={16} delay={90}>
            <View style={styles.panel}>
              <View style={styles.panelHead}>
                <View style={styles.panelIcon}>
                  <FontAwesome6 name="circle-check" size={14} color={t.brand} />
                </View>
                <View style={styles.panelHeadCopy}>
                  <Text numberOfLines={1} style={styles.panelTitle}>
                    Spring drop — carousel
                  </Text>
                  <Text numberOfLines={1} style={styles.panelSub}>
                    Approval chain • 4 of 4 complete
                  </Text>
                </View>
              </View>

              <View style={styles.chainList}>
                {APPROVAL_CHAIN.map((step, index) => {
                  const accent = accentOf(step.accent);
                  const last = index === APPROVAL_CHAIN.length - 1;
                  return (
                    <View key={step.label} style={styles.chainRow}>
                      <View style={styles.chainRail}>
                        {last ? null : <View style={styles.chainLine} />}
                        <View style={[styles.chainDot, { backgroundColor: softFill(accent, t), borderColor: accent }]}>
                          <FontAwesome6 name="check" size={9} color={accent} />
                        </View>
                      </View>
                      <Media name={step.media} alt={step.person} style={styles.chainAvatar} radius={14} />
                      <View style={styles.chainCopy}>
                        <Text numberOfLines={1} style={styles.chainLabel}>
                          {step.label}
                        </Text>
                        <Text numberOfLines={1} style={styles.chainPerson}>
                          {step.person}
                        </Text>
                      </View>
                      <View style={styles.chainState}>
                        <Text numberOfLines={1} style={styles.chainStateText}>
                          {step.state}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.rightsCard}>
                <Text style={styles.rightsLabel}>WHO CAN DO WHAT</Text>
                {PUBLISH_RIGHTS.map((right) => (
                  <View key={right.role} style={styles.rightsRow}>
                    <Text numberOfLines={1} style={styles.rightsRole}>
                      {right.role}
                    </Text>
                    <Text numberOfLines={2} style={styles.rightsNote}>
                      {right.note}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.hintRow}>
                <FontAwesome6 name="lock" size={11} color={t.chipText} />
                <Text style={styles.hintTextBrand}>
                  Publishing rights are per channel — a reviewer can approve without being able to
                  post.
                </Text>
              </View>
            </View>
          </Reveal>
        </View>
      </OpenSection>

      {/* ------------------------------------------------ 08 integrations */}
      <Band tone="surface" art={{ variant: 'docs', color: t.brand, side: 'right' }}>
        <StepHead
          index={8}
          eyebrow="CONNECTED TO YOUR STACK"
          title="Powerful integrations, no glue code."
          body="Social does not sit on its own island. Products, assets, alerts and leads move between the tools your team already opens every morning."
          center
          styles={styles}
          type={type}
        />

        <View style={styles.logoStrip}>
          {INTEGRATIONS.map((brand) => (
            <View key={brand} style={styles.logoChip}>
              <BrandLogo name={brand} size={22} />
            </View>
          ))}
        </View>

        <View style={styles.integrationGrid}>
          {INTEGRATION_CARDS.map((card, index) => {
            const accent = accentOf(card.accent);
            return (
              <Reveal key={card.title} style={styles.integrationCell} distance={16} delay={index * 70}>
                <View style={styles.integrationCard}>
                  <View style={[styles.integrationIcon, { backgroundColor: softFill(accent, t) }]}>
                    <FontAwesome6 name={card.icon as never} size={16} color={accent} />
                  </View>
                  <Text style={styles.integrationTitle}>{card.title}</Text>
                  <Text style={styles.integrationBody}>{card.body}</Text>
                </View>
              </Reveal>
            );
          })}
        </View>
      </Band>
    </PageShell>
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

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  const stacked = l.isStacked;
  const gap = l.isPhone ? 12 : 18;
  const half = gap / 2;

  const columns = (phone: number, tablet: number, laptop: number, desktop: number) =>
    l.isPhone ? phone : l.isTablet ? tablet : l.isDesktop ? desktop : laptop;

  const statColumns = columns(1, 3, 3, 3); // 3 tiles
  const ugcColumns = columns(2, 3, 3, 6); // 6 tiles
  const safetyColumns = columns(1, 2, 2, 2); // 4 cards
  const integrationColumns = columns(1, 3, 3, 3); // 3 cards

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

  const slotImage: ImageStyle = { width: 22, height: 22, flexGrow: 0, flexShrink: 0 };

  /** A day in the week rail; `today` repeats it with the brand tint. */
  const dayRowBase: ViewStyle = {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 10,
    backgroundColor: t.surfaceRaised,
    paddingHorizontal: 9,
    paddingVertical: 7,
  };

  const slotBase: ViewStyle = {
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: 8,
    backgroundColor: t.surfaceMuted,
    paddingHorizontal: 7,
    paddingVertical: 5,
  };

  const queueThumb: ImageStyle = { width: 38, height: 38, flexGrow: 0, flexShrink: 0 };
  const adaptImage: ImageStyle = { width: '100%', aspectRatio: 4 / 5 };
  const inboxAvatar: ImageStyle = { width: 34, height: 34, flexGrow: 0, flexShrink: 0 };
  const chainAvatar: ImageStyle = { width: 28, height: 28, flexGrow: 0, flexShrink: 0 };
  const ugcImage: ImageStyle = { width: '100%', aspectRatio: 3 / 4 };

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
      : { flexGrow: 1.5, flexShrink: 1, flexBasis: 600, minWidth: 0 },

    /* -------------------------------------------------- planner */
    plannerCard: {
      borderWidth: 1,
      borderColor: t.borderStrong,
      borderRadius: 18,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 12 : 16,
      gap: 12,
      ...(elevation(t, 3) as ViewStyle),
    },
    plannerBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    plannerBarCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    plannerTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    plannerSub: { ...type.micro, color: t.textSubtle },
    plannerChip: { ...chipBase, flexShrink: 0, backgroundColor: t.chipBg },
    plannerChipText: { ...type.micro, color: t.chipText, fontWeight: '800' },

    plannerBody: {
      flexDirection: l.isCompact ? 'column' : 'row',
      alignItems: 'stretch',
      gap: 12,
    },
    calendar: l.isCompact
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1.6, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    /* One row per day: seven days, fourteen posts, no empty body. */
    weekList: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', gap: 5 },
    dayRow: { ...dayRowBase },
    dayRowToday: {
      ...dayRowBase,
      borderColor: hexToRgba(t.brand, 0.45),
      backgroundColor: t.brandSoft,
    },
    dayStamp: {
      width: 42,
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 5,
    },
    dayName: { ...type.micro, color: t.textSubtle, fontWeight: '800' },
    dayDate: { ...type.micro, color: t.text, fontWeight: '800' },
    slotList: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 5,
    },
    slot: { ...slotBase },
    slotDraft: {
      ...slotBase,
      backgroundColor: 'transparent',
      borderColor: t.borderStrong,
      borderStyle: 'dashed',
    },
    slotImage,
    slotTime: { ...type.micro, color: t.textMuted, fontWeight: '700', flexShrink: 1, minWidth: 0 },
    slotDraftTag: { ...type.micro, color: t.textSubtle, fontWeight: '800', flexGrow: 0, flexShrink: 0 },

    previewColumn: l.isCompact
      ? { width: '100%', minWidth: 0, gap: 7 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 7 },
    previewLabel: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 0.9 },
    previewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    markTile: {
      width: 28,
      height: 28,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceMuted,
    },
    previewCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    previewName: { ...type.micro, color: t.text, fontWeight: '800' },
    previewCaption: { ...type.micro, color: t.textSubtle },
    previewStats: { flexGrow: 0, flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
    previewStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    previewStatText: { ...type.micro, color: t.textMuted, fontWeight: '700' },

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

    /* -------------------------------------------------- channel coverage */
    coverCard: {
      marginTop: 22,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 14 : 18,
      gap: 11,
    },
    coverLabel: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 0.9 },
    coverRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    coverChip: {
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 999,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 11,
      paddingVertical: 7,
    },
    coverChipText: { ...type.micro, color: t.text, fontWeight: '700', flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- publishing rights */
    rightsCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      padding: l.isPhone ? 13 : 15,
      gap: 10,
    },
    rightsLabel: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 0.9 },
    rightsRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    rightsRole: { ...type.micro, color: t.text, fontWeight: '800', width: 78, flexGrow: 0, flexShrink: 0 },
    rightsNote: { ...type.micro, color: t.textMuted, flexGrow: 1, flexShrink: 1, minWidth: 0 },

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

    hintRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 9,
      borderRadius: 12,
      backgroundColor: t.warnBg,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    hintText: { ...type.micro, color: t.warnText, fontWeight: '600', flexShrink: 1, minWidth: 0 },
    hintTextBrand: { ...type.micro, color: t.chipText, fontWeight: '600', flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- queue */
    queueList: { gap: 8 },
    queueRow: {
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
    queueTime: { ...type.micro, color: t.textMuted, fontWeight: '800', flexGrow: 0, flexShrink: 0 },
    queueThumb,
    queueThumbBlank: {
      width: 38,
      height: 38,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceInset,
    },
    queueCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 3 },
    queueTitle: { ...type.micro, color: t.text, fontWeight: '800' },
    queueMeta: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    queueStatus: { ...type.micro, color: t.textSubtle, flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- adapt */
    tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tab: {
      width: 46,
      height: 44,
      flexGrow: 0,
      flexShrink: 0,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceRaised,
    },
    tabActive: { borderColor: hexToRgba(t.brand, 0.5), backgroundColor: t.brandSoft },
    // Three crops in a row. Cells do not grow, so the row keeps its columns
    // rather than stretching one card when the layout narrows; the cards align
    // to the top because their images are deliberately different heights —
    // that difference is the point being made.
    adaptRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      marginHorizontal: -5,
    },
    // One per row on phone. Three 390px-wide crops side by side leaves each
    // about 118px, which truncates the network name to "F…" and the caption to
    // three words — a squeeze, not a layout.
    adaptCell: {
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: l.isPhone ? '100%' : '33.333%',
      minWidth: 0,
      padding: 5,
    },
    adaptCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      padding: 10,
      gap: 8,
    },
    adaptHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    adaptTitle: { ...type.micro, color: t.text, fontWeight: '800', flexGrow: 1, flexShrink: 1, minWidth: 0 },
    adaptRatio: {
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 3,
      backgroundColor: t.chipBg,
    },
    adaptRatioText: { ...type.micro, color: t.chipText, fontWeight: '800' },
    adaptImage,
    adaptCaption: { ...type.caption, color: t.textMuted },

    optimizedList: { gap: 7 },
    optimizedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      borderRadius: 11,
      backgroundColor: t.surfaceRaised,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    optimizedTick: {
      width: 20,
      height: 20,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softFill(t.green, t),
    },
    optimizedText: { ...type.micro, color: t.textMuted, flexGrow: 1, flexShrink: 1, minWidth: 0 },
    optimizedTag: {
      ...type.micro,
      color: t.successText,
      fontWeight: '800',
      flexGrow: 0,
      flexShrink: 0,
    },

    /* -------------------------------------------------- inbox */
    filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    filterChip: {
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 999,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 13,
      paddingVertical: 8,
    },
    filterChipActive: { borderColor: hexToRgba(t.brand, 0.5), backgroundColor: t.brandSoft },
    filterText: { ...type.micro, color: t.textMuted, fontWeight: '700' },
    filterCount: { ...type.micro, color: t.textSubtle, fontWeight: '800' },
    filterTextActive: { color: t.brand },

    inboxList: { gap: 8 },
    inboxRow: {
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
    inboxAvatar,
    inboxCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 4 },
    inboxTopRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
    inboxName: { ...type.micro, color: t.text, fontWeight: '800', flexShrink: 1, minWidth: 0 },
    inboxKind: { ...type.micro, color: t.textSubtle, fontWeight: '700' },
    inboxTime: { ...type.micro, color: t.textSubtle },
    inboxMessage: { ...type.caption, color: t.textMuted },

    composerRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    composerField: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      minHeight: 44,
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: 14,
    },
    composerPlaceholder: { ...type.caption, color: t.textSubtle },
    composerSend: {
      width: 44,
      height: 44,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brand,
    },

    /* -------------------------------------------------- lead flow */
    flowStrip: {
      marginTop: l.isPhone ? 20 : 30,
      flexDirection: stacked ? 'column' : 'row',
      alignItems: 'stretch',
    },
    flowCell: stacked
      ? { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, alignSelf: 'stretch' },
    flowCard: { ...cardBase, gap: 10, height: '100%' },
    flowArrow: {
      flexGrow: 0,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      paddingVertical: stacked ? 10 : 0,
      paddingHorizontal: stacked ? 0 : 8,
    },
    flowTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    flowIcon: {
      width: 44,
      height: 44,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    flowIndex: { ...type.h4, color: t.textSubtle, fontWeight: '800' },
    flowTitle: { marginTop: 2 },
    flowNote: { ...type.bodySm, color: t.textMuted },

    assurance: {
      marginTop: l.isPhone ? 16 : 22,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      borderWidth: 1,
      borderColor: hexToRgba(t.green, 0.35),
      borderRadius: 14,
      backgroundColor: t.successBg,
      paddingHorizontal: l.isPhone ? 14 : 20,
      paddingVertical: 16,
    },
    assuranceIcon: {
      width: 38,
      height: 38,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: hexToRgba(t.green, 0.16),
    },
    assuranceText: { ...type.bodySm, color: t.successText, fontWeight: '700', flexShrink: 1, minWidth: 0 },

    /* -------------------------------------------------- performance */
    statGrid: { ...gridBase, marginTop: (l.isPhone ? 20 : 28) - half },
    statCell: cellBase(statColumns),
    statTile: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 16,
      backgroundColor: t.surfaceMuted,
      padding: l.isPhone ? 16 : 20,
      gap: 7,
      alignItems: 'flex-start',
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    statLabel: { ...type.micro, color: t.textSubtle, fontWeight: '800', letterSpacing: 0.6 },
    statValue: {
      fontSize: l.isPhone ? 30 : 38,
      lineHeight: l.isPhone ? 36 : 44,
      fontWeight: '800',
      color: t.text,
    },
    statDelta: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, maxWidth: '100%' },
    statDeltaText: { ...type.micro, fontWeight: '800' },

    recList: { marginTop: l.isPhone ? 14 : 18, gap: 9 },
    recRow: {
      flexDirection: 'row',
      alignItems: l.isPhone ? 'flex-start' : 'center',
      gap: 12,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      paddingHorizontal: l.isPhone ? 13 : 16,
      paddingVertical: 13,
      flexWrap: 'wrap',
    },
    recIcon: {
      width: 38,
      height: 38,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 200, minWidth: 0, gap: 3 },
    recTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    recBody: { ...type.caption, color: t.textMuted },
    recTag: {
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 5,
      backgroundColor: t.chipBg,
    },
    recTagText: { ...type.micro, color: t.chipText, fontWeight: '800' },

    /* -------------------------------------------------- ugc */
    ugcTabRow: {
      marginTop: l.isPhone ? 18 : 24,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: l.isPhone ? 'flex-start' : 'center',
      gap: 8,
    },
    ugcTab: {
      flexGrow: 0,
      flexShrink: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 999,
      backgroundColor: t.surfaceMuted,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    ugcTabActive: { borderColor: hexToRgba(t.brand, 0.5), backgroundColor: t.brandSoft },
    ugcTabText: { ...type.caption, color: t.textMuted, fontWeight: '700' },
    ugcTabCount: { ...type.micro, color: t.textSubtle, fontWeight: '800' },
    ugcTabTextActive: { color: t.brand },

    ugcGrid: { ...gridBase, marginTop: (l.isPhone ? 16 : 22) - half },
    ugcCell: cellBase(ugcColumns),
    ugcCard: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      backgroundColor: t.surfaceRaised,
      padding: 8,
      gap: 6,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    ugcImage,
    ugcHandle: { ...type.micro, color: t.text, fontWeight: '800', paddingHorizontal: 2 },
    ugcNote: { ...type.micro, color: t.textSubtle, paddingHorizontal: 2, paddingBottom: 2 },

    /* -------------------------------------------------- approvals */
    safetyGrid: { ...gridBase, marginTop: 22 - half },
    safetyCell: cellBase(safetyColumns),
    safetyCard: {
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
    safetyIcon: {
      width: 36,
      height: 36,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
    },
    safetyTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    safetyBody: { ...type.caption, color: t.textMuted },

    chainList: { gap: 12 },
    chainRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    chainRail: { width: 26, flexGrow: 0, flexShrink: 0, alignItems: 'center', alignSelf: 'stretch' },
    chainLine: { position: 'absolute', top: 24, bottom: -20, width: 2, borderRadius: 1, backgroundColor: t.divider },
    chainDot: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chainAvatar,
    chainCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    chainLabel: { ...type.micro, color: t.text, fontWeight: '800' },
    chainPerson: { ...type.micro, color: t.textSubtle },
    chainState: {
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: t.successBg,
    },
    chainStateText: { ...type.micro, color: t.successText, fontWeight: '800' },

    /* -------------------------------------------------- integrations */
    logoStrip: {
      marginTop: l.isPhone ? 20 : 28,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 10,
    },
    logoChip: {
      width: 62,
      height: 56,
      flexGrow: 0,
      flexShrink: 0,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceMuted,
    },

    integrationGrid: { ...gridBase, marginTop: (l.isPhone ? 16 : 22) - half },
    integrationCell: cellBase(integrationColumns),
    integrationCard: {
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
    integrationIcon: {
      width: 42,
      height: 42,
      flexGrow: 0,
      flexShrink: 0,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    integrationTitle: { ...type.bodySm, color: t.text, fontWeight: '800' },
    integrationBody: { ...type.caption, color: t.textMuted },
  });
}
