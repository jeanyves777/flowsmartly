import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Link, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageStyle,
  type ViewStyle,
} from 'react-native';
import { Artwork } from '@/components/public/artwork';
import { Media } from '@/components/public/media';
import { Reveal } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { breadcrumbJsonLd } from '@/components/public/seo';
import {
  Heading,
  PrimaryButton,
  Band,
  OpenSection,
  SectionArt,
  SectionLabel,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { contactHref } from '@/lib/destinations';
import { elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* tones                                                               */
/* ------------------------------------------------------------------ */

type Tone = 'brand' | 'violet' | 'orange' | 'green' | 'pink';

function accent(t: ThemeTokens, tone: Tone): string {
  return tone === 'violet'
    ? t.violet
    : tone === 'orange'
      ? t.orange
      : tone === 'green'
        ? t.green
        : tone === 'pink'
          ? t.pink
          : t.brand;
}

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

const ALL = 'All topics';

/** The chip row. `ALL` is first so the default state is the whole archive. */
const TOPICS = [
  ALL,
  'AI & Automation',
  'Social',
  'Messaging',
  'Commerce',
  'Local Growth',
  'Analytics',
] as const;

type Topic = (typeof TOPICS)[number];

/**
 * Individual post pages do not exist in this app, so a post opens the product
 * surface it is written about. That is a destination that exists — the
 * alternative is a card that looks like a link and goes nowhere.
 */
const TOPIC_HREF: Record<Exclude<Topic, typeof ALL>, string> = {
  'AI & Automation': ROUTES.flowAgent,
  Social: ROUTES.social,
  Messaging: ROUTES.emailSms,
  Commerce: ROUTES.flowshop,
  'Local Growth': ROUTES.listsmartly,
  Analytics: ROUTES.analytics,
};

type Post = {
  title: string;
  topic: Exclude<Topic, typeof ALL>;
  tone: Tone;
  art: string;
  alt: string;
  blurb: string;
  date: string;
  read: string;
};

const POSTS: Post[] = [
  {
    title: '5 ways AI can transform your customer conversations',
    topic: 'AI & Automation',
    tone: 'violet',
    art: 'editorial/blog-ai-conversations',
    alt: 'A conversation between a customer and an AI assistant',
    blurb:
      'Where AI genuinely moves a conversation forward — and the moments where a person still has to take over.',
    date: 'May 9, 2024',
    read: '6 min read',
  },
  {
    title: 'Social DMs: Your shortest path to loyal customers',
    topic: 'Social',
    tone: 'brand',
    art: 'editorial/blog-social-dms',
    alt: 'Direct messages arriving from several social networks',
    blurb:
      'The inbox nobody staffs is usually the one where your best buyers are already talking to you.',
    date: 'May 2, 2024',
    read: '5 min read',
  },
  {
    title: 'Recover more carts with personalized messaging',
    topic: 'Commerce',
    tone: 'orange',
    art: 'editorial/blog-cart-recovery',
    alt: 'An abandoned shopping cart being recovered by a follow-up message',
    blurb:
      'A three-message sequence that reads like a helpful nudge instead of a chase, and what to say in each one.',
    date: 'Apr 24, 2024',
    read: '8 min read',
  },
  {
    title: 'Local presence, big impact',
    topic: 'Local Growth',
    tone: 'green',
    art: 'editorial/blog-local-growth',
    alt: 'A local business appearing on a map with reviews',
    blurb:
      'What actually moves a single-location business up the map pack, with no agency and no ad budget.',
    date: 'Apr 17, 2024',
    read: '6 min read',
  },
  {
    title: 'Measure what matters: Metrics that drive growth',
    topic: 'Analytics',
    tone: 'pink',
    art: 'editorial/blog-analytics',
    alt: 'A dashboard highlighting the metrics that predict revenue',
    blurb:
      'Seven numbers worth a weekly look, and the vanity metrics each one quietly replaces.',
    date: 'Apr 9, 2024',
    read: '9 min read',
  },
  {
    title: 'The ultimate guide to omnichannel messaging',
    topic: 'Messaging',
    tone: 'brand',
    art: 'editorial/blog-omnichannel',
    alt: 'One message adapting to email, SMS and chat',
    blurb:
      'One voice across email, SMS, DMs and calls — without saying the same thing four times.',
    date: 'Apr 2, 2024',
    read: '11 min read',
  },
];

const FEATURED = {
  topic: 'Messaging' as Exclude<Topic, typeof ALL>,
  title: 'From conversations to customers: The modern playbook for growth',
  blurb:
    'Every channel now starts a conversation, and almost none of them finish one. This is how the teams that grow fastest carry a single thread from first message to repeat purchase — and what they automate along the way.',
  art: 'editorial/blog-ai-conversations',
  alt: 'A growth team reviewing customer conversations across channels',
  author: 'Maya Patel',
  role: 'Growth Marketing Lead at FlowSmartly',
  avatar: 'people/maya-patel',
  date: 'May 14, 2024',
  read: '7 min read',
};

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
/* pieces                                                              */
/* ------------------------------------------------------------------ */

function TopicChip({ label, tone = 'brand' }: { label: string; tone?: Tone }) {
  const styles = useStyles();
  const t = useTokens();
  const color = accent(t, tone);
  return (
    <View style={[styles.topicChip, { backgroundColor: softFill(color, t) }]}>
      <Text style={[styles.topicChipText, { color }]}>{label}</Text>
    </View>
  );
}

function MetaRow({ date, read }: { date: string; read: string }) {
  const styles = useStyles();
  const t = useTokens();
  return (
    <View style={styles.metaRow}>
      <FontAwesome6 name="calendar" size={11} color={t.textSubtle} />
      <Text style={styles.metaText} numberOfLines={1}>
        {date}
      </Text>
      <View style={styles.metaDot} />
      <FontAwesome6 name="clock" size={11} color={t.textSubtle} />
      <Text style={styles.metaText} numberOfLines={1}>
        {read}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* sections                                                            */
/* ------------------------------------------------------------------ */

function Hero({ topic, onTopic }: { topic: Topic; onTopic: (next: Topic) => void }) {
  const styles = useStyles();

  return (
    <OpenSection style={styles.hero}>
      <Reveal style={styles.heroCopy} distance={16}>
        <SectionLabel>BLOG</SectionLabel>
        <Heading level={1} style={styles.heroTitle}>
          Ideas and insights for smarter growth.
        </Heading>
        <Text style={styles.heroBody}>
          Practical thinking on AI, messaging, commerce and local visibility — written by the team that
          builds FlowSmartly and the operators who use it every day.
        </Text>
      </Reveal>

      <View style={styles.chipRow} accessibilityRole="tablist">
        {TOPICS.map((item) => {
          const active = item === topic;
          return (
            <Pressable
              key={item}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Show ${item}`}
              onPress={() => onTopic(item)}
              style={[styles.filterChip, active ? styles.filterChipActive : null]}>
              <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>
                {item}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </OpenSection>
  );
}

function Featured() {
  const styles = useStyles();
  const l = useLayout();
  const router = useRouter();

  return (
    <Band tone="surface">
      <Reveal style={styles.featuredRow} distance={16}>
        <View style={styles.featuredArt}>
          <Artwork name={FEATURED.art} alt={FEATURED.alt} style={styles.featuredImage} radius={16} />
        </View>

        <View style={styles.featuredCopy}>
          <TopicChip label="Featured" tone="orange" />
          <Heading level={2} style={styles.featuredTitle}>
            {FEATURED.title}
          </Heading>
          <Text style={styles.featuredBlurb}>{FEATURED.blurb}</Text>

          <View style={styles.authorRow}>
            <Media
              name={FEATURED.avatar}
              alt={`${FEATURED.author}, ${FEATURED.role}`}
              style={styles.avatar}
              radius={22}
            />
            <View style={styles.authorCopy}>
              <Text style={styles.authorName} numberOfLines={1}>
                {FEATURED.author}
              </Text>
              <Text style={styles.authorRole} numberOfLines={2}>
                {FEATURED.role}
              </Text>
            </View>
          </View>

          <MetaRow date={FEATURED.date} read={FEATURED.read} />

          <View style={styles.featuredButton}>
            {/* No per-post page exists, so the CTA says where it really goes:
                the messaging surface this piece is about. */}
            <PrimaryButton
              label={`Explore ${FEATURED.topic.toLowerCase()}`}
              icon="arrow-right"
              iconRight
              full={l.isPhone}
              trackId="blog.featured.explore"
              onPress={() => router.push(TOPIC_HREF[FEATURED.topic] as never)}
            />
          </View>
        </View>
      </Reveal>
    </Band>
  );
}

function Archive({ topic }: { topic: Topic }) {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();

  const visible = useMemo(
    () => (topic === ALL ? POSTS : POSTS.filter((post) => post.topic === topic)),
    [topic],
  );

  // Cells carry an explicit basis and never grow, so a short last row keeps its
  // natural width. Narrowing the count to the number of results is what stops a
  // single filtered article sitting alone in a three-wide row.
  const base = l.isPhone ? 1 : l.isTablet ? 2 : 3;
  const columns = Math.max(1, Math.min(base, visible.length));

  return (
    <Band tone="violet">
      <SectionArt variant="docs" color={t.violet} side="left" />
      <Reveal style={styles.head} distance={14}>
        <Heading level={2} style={styles.headTitle}>
          Latest articles
        </Heading>
        <Text style={styles.headBody}>
          {`${visible.length} ${visible.length === 1 ? 'article' : 'articles'}${
            topic === ALL ? ' across every topic' : ` in ${topic}`
          }.`}
        </Text>
      </Reveal>

      {visible.length === 0 ? (
        <View style={styles.emptyCard}>
          <FontAwesome6 name="newspaper" size={16} color={t.textSubtle} />
          <Text style={styles.emptyText}>
            {`Nothing published in ${topic} yet. Pick another topic above — new pieces land every week.`}
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {visible.map((post, index) => (
            <Reveal
              key={post.title}
              delay={50 + index * 60}
              distance={12}
              style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
              <Link
                href={TOPIC_HREF[post.topic] as never}
                accessibilityRole="link"
                accessibilityLabel={`${post.title} — more on ${post.topic}`}
                style={styles.postCard as never}>
                <Artwork name={post.art} alt={post.alt} style={styles.postImage} radius={13} inset={12} />
                <View style={styles.postBody}>
                  <TopicChip label={post.topic} tone={post.tone} />
                  <Text style={styles.postTitle}>{post.title}</Text>
                  <Text style={styles.postBlurb}>{post.blurb}</Text>
                  <View style={styles.cardSpacer} />
                  <MetaRow date={post.date} read={post.read} />
                  <View style={styles.linkRow}>
                    <Text style={[styles.linkText, { color: accent(t, post.tone) }]}>
                      {`More on ${post.topic}`}
                    </Text>
                    <FontAwesome6 name="arrow-right" size={12} color={accent(t, post.tone)} />
                  </View>
                </View>
              </Link>
            </Reveal>
          ))}
        </View>
      )}
    </Band>
  );
}

function Newsletter() {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();
  const router = useRouter();
  const [email, setEmail] = useState('');

  return (
    <OpenSection style={styles.newsletter}>
      <Reveal style={styles.newsletterInner} distance={14}>
        <View style={styles.newsletterIcon}>
          <FontAwesome6 name="envelope-open-text" size={22} color={t.brand} />
        </View>
        <Heading level={2} style={styles.newsletterTitle}>
          Stay ahead with smarter insights
        </Heading>
        <Text style={styles.newsletterBody}>
          One email a month: the article worth reading, the tactic worth copying and the change worth
          knowing about.
        </Text>

        <View style={styles.subscribeRow}>
          <View style={styles.field}>
            <FontAwesome6 name="envelope" size={15} color={t.textSubtle} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              placeholderTextColor={t.textSubtle}
              accessibilityLabel="Your email address"
              inputMode="email"
              autoCapitalize="none"
              returnKeyType="done"
              style={styles.input}
            />
          </View>
          {/* No newsletter backend exists here, so Subscribe hands the address
              to Contact with the topic pre-selected instead of faking a
              confirmation. */}
          <PrimaryButton
            label="Subscribe"
            full={l.isPhone}
            trackId="blog.newsletter.subscribe"
            onPress={() =>
              router.push(
                contactHref('updates', email.trim() ? { email: email.trim() } : undefined) as never,
              )
            }
          />
        </View>

        <Text style={styles.newsletterProof}>Join 8,000+ growth-minded teams</Text>
        <Text style={styles.newsletterFine}>No spam. Unsubscribe anytime.</Text>
      </Reveal>
    </OpenSection>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function BlogPage() {
  const [topic, setTopic] = useState<Topic>(ALL);

  return (
    <PageShell
      title="Blog"
      description="Ideas and insights for smarter growth — AI, messaging, social, commerce, local visibility and analytics, from the team behind FlowSmartly."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Resources', path: ROUTES.resources },
          { name: 'Blog', path: ROUTES.blog },
        ]),
      ]}>
      <Hero topic={topic} onTopic={setTopic} />
      <Featured />
      <Archive topic={topic} />
      <Newsletter />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  const stacked = l.isStacked;
  /** half the grid gutter; cells carry it as padding so wrapped rows stay flush */
  const cellPad = l.isPhone ? 5 : 7;

  /** Image styles are declared apart from the sheet: StyleSheet.create widens
   *  `'100%'` to `string`, which no longer satisfies `ImageStyle`. */
  const featuredImage: ImageStyle = {
    width: '100%',
    height: l.isPhone ? 208 : stacked ? 260 : 330,
  };
  const postImage: ImageStyle = { width: '100%', height: l.isPhone ? 176 : 190 };
  const avatar: ImageStyle = { width: 44, height: 44, flexGrow: 0, flexShrink: 0 };

  const cardBase: ViewStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    backgroundColor: t.surfaceRaised,
    overflow: 'hidden',
    ...(elevation(t, 1) as ViewStyle),
  };

  const sheet = StyleSheet.create({
    /* hero --------------------------------------------------------- */
    hero: { paddingTop: l.isPhone ? 26 : 40 },
    heroCopy: { gap: 14, maxWidth: 760 },
    heroTitle: type.display,
    heroBody: { ...type.body, maxWidth: 620 },

    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
      marginTop: l.isPhone ? 20 : 26,
    },
    filterChip: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 16,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    filterChipActive: { borderColor: t.brand, backgroundColor: t.brandSoft },
    filterChipText: { ...type.bodySm, color: t.textMuted, fontWeight: '700' },
    filterChipTextActive: { color: t.brand },

    /* featured ----------------------------------------------------- */
    featuredRow: {
      flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'center',
      gap: stacked ? 22 : 36,
    },
    featuredArt: stacked
      ? { width: '100%', minWidth: 0 }
      : { flexGrow: 1.1, flexShrink: 1, flexBasis: 0, minWidth: 0 },
    featuredCopy: stacked
      ? { width: '100%', minWidth: 0, gap: 14 }
      : { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 14 },
    featuredTitle: type.h2,
    featuredBlurb: { ...type.body, maxWidth: 620 },
    featuredButton: { marginTop: 2 },

    authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
    authorCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    authorName: { ...type.bodySm, color: t.text, fontWeight: '800' },
    authorRole: { ...type.micro, color: t.textMuted },

    /* section head ------------------------------------------------- */
    head: { gap: 10, maxWidth: 680 },
    headTitle: type.h2,
    headBody: type.body,

    /* grid --------------------------------------------------------- */
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      marginHorizontal: -cellPad,
      marginTop: 20 - cellPad,
    },
    cell: { flexGrow: 0, flexShrink: 0, minWidth: 0, padding: cellPad },

    /* post cards --------------------------------------------------- */
    /** an anchor, so the flex context is spelled out — RNW anchors are inline */
    postCard: {
      ...cardBase,
      display: 'flex',
      flexDirection: 'column',
      textDecorationLine: 'none',
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    emptyCard: {
      marginTop: 20,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 18,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceMuted,
    },
    emptyText: { ...type.bodySm, color: t.textMuted, flexShrink: 1, minWidth: 0 },
    postBody: { padding: l.isPhone ? 15 : 17, gap: 9, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    postTitle: { ...type.h4, color: t.text },
    postBlurb: { ...type.bodySm, color: t.textMuted },
    cardSpacer: { flexGrow: 1, flexShrink: 0, flexBasis: 'auto', minHeight: 4 },

    topicChip: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 5,
    },
    topicChipText: { ...type.micro, fontWeight: '800' },

    metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
    metaText: { ...type.micro, color: t.textSubtle, flexShrink: 1, minWidth: 0 },
    metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: t.borderStrong },

    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
    linkText: { ...type.bodySm, fontWeight: '800', flexShrink: 1, minWidth: 0 },

    /* newsletter --------------------------------------------------- */
    newsletter: { alignItems: 'center' },
    newsletterInner: {
      alignItems: 'center',
      gap: 12,
      maxWidth: 640,
      width: '100%',
      paddingVertical: l.isPhone ? 6 : 18,
    },
    newsletterIcon: {
      width: 54,
      height: 54,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.brandSoft,
      flexGrow: 0,
      flexShrink: 0,
    },
    newsletterTitle: { ...type.h2, textAlign: 'center' },
    newsletterBody: { ...type.body, textAlign: 'center', maxWidth: 560 },
    subscribeRow: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: l.isPhone ? 'stretch' : 'center',
      alignSelf: 'stretch',
      gap: 10,
      marginTop: 6,
    },
    field: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.borderStrong,
      backgroundColor: t.surfaceMuted,
    },
    input: {
      ...type.bodySm,
      color: t.text,
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
      minHeight: 46,
    },
    newsletterProof: { ...type.bodySm, color: t.text, fontWeight: '700', marginTop: 4 },
    newsletterFine: { ...type.micro, color: t.textSubtle },
  });

  return { ...sheet, featuredImage, postImage, avatar };
}
