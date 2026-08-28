import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Link, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View, type ImageStyle, type ViewStyle } from 'react-native';
import { POST_INDEX, POSTS } from '@/content/posts.generated';
import type { PostMeta } from '@/content/types';
import { Artwork } from '@/components/public/artwork';
import { ArticleBody, Takeaways } from '@/components/public/article';
import { Media } from '@/components/public/media';
import { Reveal } from '@/components/public/motion';
import { ROUTES } from '@/components/public/nav';
import { PageShell } from '@/components/public/page-shell';
import { articleJsonLd, breadcrumbJsonLd } from '@/components/public/seo';
import {
  Band,
  Heading,
  OpenSection,
  useTypeScale,
  type TypeScale,
} from '@/components/public/ui';
import { accentText, elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { cellBasis, useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';

/**
 * One exported HTML file per post.
 *
 * `generateStaticParams` is what makes that true: without it the export writes a
 * single `[slug].html` shell that resolves the post in the browser, and every
 * crawler — including the answer engines the site deliberately admits — would be
 * served a page with no article in it.
 */
export async function generateStaticParams(): Promise<Record<string, string>[]> {
  return POST_INDEX.map((post) => ({ slug: post.slug }));
}

function postHref(slug: string) {
  return `${ROUTES.blog}/${slug}`;
}

/** Written out rather than localised: the date is also in `datePublished`. */
function formatDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

/* ------------------------------------------------------------------ */
/* pieces                                                              */
/* ------------------------------------------------------------------ */

function Byline({ post }: { post: PostMeta }) {
  const styles = useStyles();
  const t = useTokens();

  return (
    <View style={styles.byline}>
      {post.authorAvatar ? (
        <Media name={post.authorAvatar} alt={post.author} style={styles.avatar} radius={21} />
      ) : null}
      <View style={styles.bylineCopy}>
        <Text style={styles.authorName} numberOfLines={1}>
          {post.author}
        </Text>
        {post.authorRole ? (
          <Text style={styles.authorRole} numberOfLines={2}>
            {post.authorRole}
          </Text>
        ) : null}
      </View>
      <View style={styles.metaRow}>
        <FontAwesome6 name="calendar" size={11} color={t.textSubtle} />
        <Text style={styles.metaText}>{formatDate(post.date)}</Text>
        <View style={styles.metaDot} />
        <FontAwesome6 name="clock" size={11} color={t.textSubtle} />
        <Text style={styles.metaText}>{`${post.readMinutes} min read`}</Text>
      </View>
    </View>
  );
}

function More({ current }: { current: PostMeta }) {
  const styles = useStyles();
  const t = useTokens();
  const l = useLayout();

  // Same topic first, then whatever is newest — so a two-post topic still fills
  // the row instead of showing one card beside an empty gap.
  const related = useMemo(() => {
    const others = POST_INDEX.filter((post) => post.slug !== current.slug);
    const sameTopic = others.filter((post) => post.topic === current.topic);
    const rest = others.filter((post) => post.topic !== current.topic);
    return [...sameTopic, ...rest].slice(0, 3);
  }, [current.slug, current.topic]);

  if (!related.length) return null;
  const columns = Math.max(1, Math.min(l.isPhone ? 1 : l.isTablet ? 2 : 3, related.length));

  return (
    <Band tone="surface" art="none">
      <Heading level={2} style={styles.moreTitle}>
        Keep reading
      </Heading>
      <View style={styles.grid}>
        {related.map((post) => (
          <View key={post.slug} style={[styles.cell, { flexBasis: cellBasis(columns) }]}>
            <Link
              href={postHref(post.slug) as never}
              accessibilityRole="link"
              accessibilityLabel={post.title}
              style={styles.card as never}>
              <View style={styles.cardBody}>
                <Text style={[styles.cardTopic, { color: t.textSubtle }]}>{post.topic.toUpperCase()}</Text>
                <Text style={styles.cardTitle}>{post.title}</Text>
                <Text style={styles.cardBlurb} numberOfLines={3}>
                  {post.description}
                </Text>
                <View style={styles.cardSpacer} />
                <Text style={styles.cardMeta}>{`${formatDate(post.date)} · ${post.readMinutes} min read`}</Text>
              </View>
            </Link>
          </View>
        ))}
      </View>
    </Band>
  );
}

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function PostPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const styles = useStyles();
  const t = useTokens();
  const post = POSTS.find((item) => item.slug === slug);

  if (!post) {
    return (
      <PageShell title="Post not found" description="This article does not exist." noIndex cta={false}>
        <OpenSection>
          <Heading level={1} style={styles.title}>
            That post does not exist.
          </Heading>
          <Text style={styles.lead}>
            It may have been renamed. The archive has everything that has been published.
          </Text>
          <Link href={ROUTES.blog as never} accessibilityRole="link" style={styles.backLink as never}>
            <Text style={styles.backText}>Back to the blog</Text>
          </Link>
        </OpenSection>
      </PageShell>
    );
  }

  const color =
    post.tone === 'violet'
      ? t.violet
      : post.tone === 'orange'
        ? t.orange
        : post.tone === 'green'
          ? t.green
          : post.tone === 'pink'
            ? t.pink
            : t.brand;

  return (
    <PageShell
      title={post.title}
      description={post.description}
      type="article"
      article={{
        publishedTime: post.date,
        modifiedTime: post.updated,
        author: post.author,
        section: post.topic,
      }}
      jsonLd={[
        articleJsonLd({
          headline: post.title,
          description: post.description,
          path: postHref(post.slug),
          datePublished: post.date,
          dateModified: post.updated,
          section: post.topic,
          author: post.author,
        }),
        breadcrumbJsonLd([
          { name: 'Home', path: ROUTES.home },
          { name: 'Resources', path: ROUTES.resources },
          { name: 'Blog', path: ROUTES.blog },
          { name: post.title, path: postHref(post.slug) },
        ]),
      ]}>
      <OpenSection style={styles.head}>
        <Reveal style={styles.headCopy} distance={14}>
          <Link href={ROUTES.blog as never} accessibilityRole="link" style={styles.backLink as never}>
            <Text style={styles.backText}>← Blog</Text>
          </Link>

          <View style={[styles.topicChip, { backgroundColor: softFill(color, t) }]}>
            <Text style={[styles.topicChipText, { color: accentText(color, t) }]}>{post.topic}</Text>
          </View>

          <Heading level={1} style={styles.title}>
            {post.title}
          </Heading>
          <Text style={styles.lead}>{post.description}</Text>

          <Byline post={post} />
        </Reveal>
      </OpenSection>

      <OpenSection style={styles.article} art="none">
        {post.art ? (
          <Reveal distance={12} style={styles.artWrap}>
            <Artwork
              name={post.art}
              alt={post.artAlt ?? post.title}
              style={styles.artImage}
              radius={16}
            />
          </Reveal>
        ) : null}

        <Takeaways items={post.takeaways} tone={post.tone} />
        <ArticleBody blocks={post.blocks} tone={post.tone} />
      </OpenSection>

      <More current={post} />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* styles                                                              */
/* ------------------------------------------------------------------ */

type Styles = ReturnType<typeof createStyles>;

function useStyles(): Styles {
  const t = useTokens();
  const l = useLayout();
  const type = useTypeScale();
  return useMemo(() => createStyles(t, l, type), [t, l, type]);
}

function createStyles(t: ThemeTokens, l: Layout, type: TypeScale) {
  const cellPad = l.isPhone ? 5 : 7;

  const avatar: ImageStyle = { width: 42, height: 42, flexGrow: 0, flexShrink: 0 };
  const artImage: ImageStyle = { width: '100%', height: l.isPhone ? 210 : 340 };

  const cardBase: ViewStyle = {
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 15,
    backgroundColor: t.surfaceRaised,
    overflow: 'hidden',
    ...(elevation(t, 1) as ViewStyle),
  };

  const sheet = StyleSheet.create({
    /* head ----------------------------------------------------------- */
    head: { paddingTop: l.isPhone ? 20 : 32, paddingBottom: 0 },
    headCopy: { gap: 14, maxWidth: 760 },
    backLink: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
    backText: { ...type.bodySm, color: accentText(t.brand, t), fontWeight: '700' },

    topicChip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
    topicChipText: { ...type.micro, fontWeight: '800' },

    title: type.h1,
    lead: { ...type.body, maxWidth: 660 },

    byline: {
      flexDirection: l.isPhone ? 'column' : 'row',
      alignItems: l.isPhone ? 'flex-start' : 'center',
      gap: l.isPhone ? 10 : 14,
      marginTop: 4,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: t.divider,
    },
    bylineCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0, gap: 2 },
    authorName: { ...type.bodySm, color: t.text, fontWeight: '800' },
    authorRole: { ...type.micro, color: t.textMuted },

    metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
    metaText: { ...type.micro, color: t.textSubtle },
    metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: t.borderStrong },

    /* article -------------------------------------------------------- */
    article: { gap: l.isPhone ? 22 : 28, paddingTop: l.isPhone ? 20 : 26 },
    artWrap: { maxWidth: 860, width: '100%' },

    /* related -------------------------------------------------------- */
    moreTitle: { ...type.h3, marginBottom: 4 },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'stretch',
      marginHorizontal: -cellPad,
      marginTop: 16 - cellPad,
    },
    cell: { flexGrow: 0, flexShrink: 0, minWidth: 0, padding: cellPad },
    card: {
      ...cardBase,
      display: 'flex',
      flexDirection: 'column',
      textDecorationLine: 'none',
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
    },
    cardBody: { padding: l.isPhone ? 15 : 17, gap: 8, flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
    cardTopic: { ...type.micro, fontWeight: '800', letterSpacing: 0.9 },
    cardTitle: { ...type.h4, color: t.text },
    cardBlurb: { ...type.bodySm, color: t.textMuted },
    cardSpacer: { flexGrow: 1, flexShrink: 0, flexBasis: 'auto', minHeight: 4 },
    cardMeta: { ...type.micro, color: t.textSubtle },
  });

  return { ...sheet, avatar, artImage };
}
