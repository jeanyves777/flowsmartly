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
import { POST_INDEX, TOPICS as POST_TOPICS } from '@/content/posts.generated';
import type { CalloutTone, PostMeta } from '@/content/types';
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
  SectionLabel,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { contactHref } from '@/lib/destinations';
import { accentText, elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/* ------------------------------------------------------------------ */
/* content                                                             */
/* ------------------------------------------------------------------ */

const ALL = 'All topics';

/**
 * The chip row is derived from what has actually been published, so a topic
 * cannot exist here without a post behind it. The previous version hardcoded
 * six topics and six posts that were never written.
 */
const TOPICS: string[] = [ALL, ...POST_TOPICS];

const FEATURED: PostMeta | undefined = POST_INDEX.find((post) => post.featured) ?? POST_INDEX[0];

function postHref(slug: string) {
  return `${ROUTES.blog}/${slug}`;
}

function formatDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

function accent(t: ThemeTokens, tone: CalloutTone): string {
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

function TopicChip({ label, tone = 'brand' }: { label: string; tone?: CalloutTone }) {
  const styles = useStyles();
  const t = useTokens();
  const color = accent(t, tone);
  return (
    <View style={[styles.topicChip, { backgroundColor: softFill(color, t) }]}>
      <Text style={[styles.topicChipText, { color: accentText(color, t) }]}>{label}</Text>
    </View>
  );
}

function MetaRow({ date, read }: { date: string; read: number }) {
  const styles = useStyles();
  const t = useTokens();
  return (
    <View style={styles.metaRow}>
      <FontAwesome6 name="calendar" size={11} color={t.textSubtle} />
      <Text style={styles.metaText} numberOfLines={1}>
        {formatDate(date)}
      </Text>
      <View style={styles.metaDot} />
      <FontAwesome6 name="clock" size={11} color={t.textSubtle} />
      <Text style={styles.metaText} numberOfLines={1}>
        {`${read} min read`}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* sections                                                            */
/* ------------------------------------------------------------------ */

function Hero({ topic, onTopic }: { topic: string; onTopic: (next: string) => void }) {
  const styles = useStyles();

  return (
    <OpenSection style={styles.hero}>
      <Reveal style={styles.heroCopy} distance={16}>
        <SectionLabel>BLOG</SectionLabel>
        <Heading level={1} style={styles.heroTitle}>
          How we build it, and what we learned doing it.
        </Heading>
        <Text style={styles.heroBody}>
          Notes from building FlowSmartly — the decisions, the things that broke, and the practices
          that came out of fixing them. Written by the people doing the work.
        </Text>
      </Reveal>

      {TOPICS.length > 2 ? (
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
      ) : null}
    </OpenSection>
  );
}

function Featured({ post }: { post: PostMeta }) {
  const t = useTokens();
  const styles = useStyles();
  const l = useLayout();
  const router = useRouter();

  return (
    <Band tone="surface" art={{ variant: 'docs', color: t.brand, side: 'right' }}>
      <Reveal style={styles.featuredRow} distance={16}>
        {post.art ? (
          <View style={styles.featuredArt}>
            <Artwork
              name={post.art}
              alt={post.artAlt ?? post.title}
              style={styles.featuredImage}
              radius={16}
            />
          </View>
        ) : null}

        <View style={styles.featuredCopy}>
          <TopicChip label="Latest" tone={post.tone} />
          <Heading level={2} style={styles.featuredTitle}>
            {post.title}
          </Heading>
          <Text style={styles.featuredBlurb}>{post.description}</Text>

          <View style={styles.authorRow}>
            {post.authorAvatar ? (
              <Media
                name={post.authorAvatar}
                alt={`${post.author}${post.authorRole ? `, ${post.authorRole}` : ''}`}
                style={styles.avatar}
                radius={22}
              />
            ) : null}
            <View style={styles.authorCopy}>
              <Text style={styles.authorName} numberOfLines={1}>
                {post.author}
              </Text>
              {post.authorRole ? (
                <Text style={styles.authorRole} numberOfLines={2}>
                  {post.authorRole}
                </Text>
              ) : null}
            </View>
          </View>

          <MetaRow date={post.date} read={post.readMinutes} />

          <View style={styles.featuredButton}>
            <PrimaryButton
              label="Read the piece"
              icon="arrow-right"
              iconRight
              full={l.isPhone}
              trackId="blog.featured.read"
              onPress={() => router.push(postHref(post.slug) as never)}
            />
          </View>
        </View>
      </Reveal>
    </Band>
  );
}

function Archive({ topic }: { topic: string }) {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();

  const visible = useMemo(() => {
    const rest = POST_INDEX.filter((post) => post.slug !== FEATURED?.slug);
    return topic === ALL ? rest : rest.filter((post) => post.topic === topic);
  }, [topic]);

  // Cells carry an explicit basis and never grow, so a short last row keeps its
  // natural width. Narrowing the count to the number of results is what stops a
  // single filtered article sitting alone in a three-wide row.
  const base = l.isPhone ? 1 : l.isTablet ? 2 : 3;
  const columns = Math.max(1, Math.min(base, visible.length));

  return (
    <Band tone="violet" art={{ variant: 'docs', color: t.violet, side: 'left' }}>
      <Reveal style={styles.head} distance={14}>
        <Heading level={2} style={styles.headTitle}>
          {topic === ALL ? 'More from the blog' : topic}
        </Heading>
        <Text style={styles.headBody}>
          {visible.length === 0
            ? 'Nothing else here yet.'
            : `${visible.length} ${visible.length === 1 ? 'article' : 'articles'}${
                topic === ALL ? '' : ` in ${topic}`
              }.`}
        </Text>
      </Reveal>

      {visible.length === 0 ? (
        <View style={styles.emptyCard}>
          <FontAwesome6 name="newspaper" size={16} color={t.textSubtle} />
          <Text style={styles.emptyText}>
            {topic === ALL
              ? 'Everything published so far is above. New pieces are added as we write them.'
              : `Nothing else published in ${topic} yet. Pick another topic above.`}
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {visible.map((post, index) => (
            <Reveal
              key={post.slug}
              delay={50 + index * 60}
              distance={12}
              style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
              <Link
                href={postHref(post.slug) as never}
                accessibilityRole="link"
                accessibilityLabel={post.title}
                style={styles.postCard as never}>
                {post.art ? (
                  <Artwork
                    name={post.art}
                    alt={post.artAlt ?? post.title}
                    style={styles.postImage}
                    radius={13}
                    inset={12}
                  />
                ) : null}
                <View style={styles.postBody}>
                  <TopicChip label={post.topic} tone={post.tone} />
                  <Text style={styles.postTitle}>{post.title}</Text>
                  <Text style={styles.postBlurb} numberOfLines={4}>
                    {post.description}
                  </Text>
                  <View style={styles.cardSpacer} />
                  <MetaRow date={post.date} read={post.readMinutes} />
                  <View style={styles.linkRow}>
                    <Text style={[styles.linkText, { color: accentText(accent(t, post.tone), t) }]}>Read</Text>
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
          Get the next one by email
        </Heading>
        <Text style={styles.newsletterBody}>
          New pieces as they are published. No cadence promises we have not earned yet.
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

        <Text style={styles.newsletterFine}>No spam. Unsubscribe anytime.</Text>
      </Reveal>
    </OpenSection>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function BlogPage() {
  const [topic, setTopic] = useState<string>(ALL);
  const styles = useStyles();
  const t = useTokens();

  return (
    <PageShell
      title="Blog"
      description="Notes from building FlowSmartly — the decisions, the things that broke, and the practices that came out of fixing them."
      jsonLd={[
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Resources', path: ROUTES.resources },
          { name: 'Blog', path: ROUTES.blog },
        ]),
      ]}>
      <Hero topic={topic} onTopic={setTopic} />
      {FEATURED ? (
        <Featured post={FEATURED} />
      ) : (
        <OpenSection>
          <View style={styles.emptyCard}>
            <FontAwesome6 name="newspaper" size={16} color={t.textSubtle} />
            <Text style={styles.emptyText}>
              Nothing published yet. The first pieces are being written.
            </Text>
          </View>
        </OpenSection>
      )}
      {POST_INDEX.length > 1 ? <Archive topic={topic} /> : null}
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
    newsletterFine: { ...type.micro, color: t.textSubtle },
  });

  return { ...sheet, featuredImage, postImage, avatar };
}
