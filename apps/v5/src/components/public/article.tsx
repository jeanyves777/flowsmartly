import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Link } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import type { Block, CalloutTone, Inline } from '@/content/types';
import { accentText, elevation, softFill, type ThemeTokens } from '@/theme/tokens';
import { useLayout, type Layout } from '@/theme/use-responsive';
import { useTokens } from '@/theme/v5-theme-provider';
import { Artwork } from './artwork';
import { Heading, useTypeScale, type TypeScale } from './ui';

/**
 * Renders a compiled post.
 *
 * The body arrives as a typed block tree (see `src/content/types.ts`), never as
 * markup, so every rule and colour on an article comes from the same tokens as
 * the rest of the site and an article inherits all three themes for free.
 *
 * Measure is the one thing an article gets that no other surface does: prose is
 * capped at `MEASURE` characters' worth of width, because a 1536px-wide column
 * of body text is unreadable however well it is styled.
 */

/** ~68 characters at the body size — the readable line length for long prose. */
const MEASURE = 680;

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
/* inline runs                                                         */
/* ------------------------------------------------------------------ */

/**
 * An inline link is expo-router's `Link`, not a `Pressable` with `onPress`.
 *
 * Two reasons, and the second is the important one. react-native-web lays a
 * `Pressable` out as a block, so a link inside a sentence would break the line
 * at both ends and sit on its own row — `Link` extends `TextProps`, so it nests
 * inside a paragraph and stays in the flow. And it renders a real `<a href>`,
 * which an `onPress` handler does not: a JavaScript-only link is invisible to
 * every crawler, so an article's internal links would pass nothing and an
 * answer engine following a citation would find no path onward.
 */
function InlineRuns({ runs, styles }: { runs: Inline[]; styles: Styles }) {
  return (
    <>
      {runs.map((run, index) => {
        if (run.t === 'strong') {
          return (
            <Text key={index} style={styles.strong}>
              {run.v}
            </Text>
          );
        }
        if (run.t === 'em') {
          return (
            <Text key={index} style={styles.em}>
              {run.v}
            </Text>
          );
        }
        if (run.t === 'code') {
          return (
            <Text key={index} style={styles.inlineCode}>
              {run.v}
            </Text>
          );
        }
        if (run.t === 'link') {
          const external = /^https?:/.test(run.href);
          return (
            <Link
              key={index}
              href={run.href as never}
              style={styles.link}
              {...(external ? { target: '_blank' as const, rel: 'noopener noreferrer' } : null)}>
              {run.v}
            </Link>
          );
        }
        return <Text key={index}>{run.v}</Text>;
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* takeaways                                                           */
/* ------------------------------------------------------------------ */

/**
 * The first thing on the page, and the reason articles here are structured at
 * all: three to five complete, self-contained sentences stating what the piece
 * concludes.
 *
 * A reader deciding whether to spend nine minutes gets the answer, and an
 * answer engine gets spans it can quote without having to summarise the
 * article — which is what it will do anyway, less accurately, if we do not.
 */
export function Takeaways({ items, tone }: { items: string[]; tone: CalloutTone }) {
  const t = useTokens();
  const styles = useStyles();
  const color = accent(t, tone);
  if (!items.length) return null;

  return (
    <View style={[styles.takeaways, { borderColor: color }]}>
      <Text style={[styles.takeawaysLabel, { color }]}>WHAT THIS PIECE CONCLUDES</Text>
      <View style={styles.takeawaysList}>
        {items.map((item) => (
          <View key={item} style={styles.takeawayRow}>
            <View style={[styles.takeawayDot, { backgroundColor: color }]} />
            <Text style={styles.takeawayText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* body                                                                */
/* ------------------------------------------------------------------ */

export function ArticleBody({ blocks, tone }: { blocks: Block[]; tone: CalloutTone }) {
  const t = useTokens();
  const styles = useStyles();

  return (
    <View style={styles.body}>
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'h2':
            return (
              <Heading key={index} level={2} style={styles.h2}>
                <Text nativeID={block.id}>{block.text}</Text>
              </Heading>
            );

          case 'h3':
            return (
              <Heading key={index} level={3} style={styles.h3}>
                <Text nativeID={block.id}>{block.text}</Text>
              </Heading>
            );

          case 'p':
            return (
              <Text key={index} style={styles.p}>
                <InlineRuns runs={block.text} styles={styles} />
              </Text>
            );

          case 'ul':
          case 'ol':
            return (
              <View key={index} style={styles.list}>
                {block.items.map((item, itemIndex) => (
                  <View key={itemIndex} style={styles.listRow}>
                    {block.kind === 'ol' ? (
                      <Text style={[styles.marker, { color: accent(t, tone) }]}>{itemIndex + 1}.</Text>
                    ) : (
                      <View style={[styles.bullet, { backgroundColor: accent(t, tone) }]} />
                    )}
                    <Text style={styles.listText}>
                      <InlineRuns runs={item} styles={styles} />
                    </Text>
                  </View>
                ))}
              </View>
            );

          case 'quote':
            return (
              <View key={index} style={[styles.quote, { borderLeftColor: accent(t, tone) }]}>
                <Text style={styles.quoteText}>
                  <InlineRuns runs={block.text} styles={styles} />
                </Text>
              </View>
            );

          case 'callout': {
            const color = accent(t, block.tone);
            return (
              <View key={index} style={[styles.callout, { backgroundColor: softFill(color, t) }]}>
                <FontAwesome6 name="lightbulb" size={15} color={accentText(color, t)} style={styles.calloutIcon} />
                <Text style={[styles.calloutText, { color: accentText(color, t) }]}>
                  <InlineRuns runs={block.text} styles={styles} />
                </Text>
              </View>
            );
          }

          case 'code':
            return (
              <View key={index} style={styles.code}>
                <Text style={styles.codeText}>{block.text}</Text>
              </View>
            );

          case 'image':
            return (
              <View key={index} style={styles.figure}>
                <Artwork name={block.name} alt={block.alt} style={styles.figureImage} radius={14} />
                {block.caption ? <Text style={styles.caption}>{block.caption}</Text> : null}
              </View>
            );

          case 'rule':
            return <View key={index} style={styles.rule} />;
        }
      })}
    </View>
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
  /** prose reads at a slightly larger size than a marketing paragraph does */
  const prose: TextStyle = {
    ...type.body,
    color: t.text,
    fontSize: Math.round((type.body.fontSize as number) * 1.06),
    lineHeight: Math.round((type.body.fontSize as number) * 1.06 * 1.72),
  };

  const mono: TextStyle = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  };

  const figureImage = { width: '100%' as const, height: l.isPhone ? 200 : 300 };

  const sheet = StyleSheet.create({
    body: { maxWidth: MEASURE, width: '100%', gap: l.isPhone ? 16 : 18 },

    h2: { ...type.h3, marginTop: l.isPhone ? 14 : 20 },
    h3: { ...type.h4, marginTop: l.isPhone ? 8 : 12 },
    p: prose,

    strong: { fontWeight: '800', color: t.text },
    em: { fontStyle: 'italic' },
    inlineCode: {
      ...mono,
      fontSize: Math.round((prose.fontSize as number) * 0.9),
      color: t.text,
      backgroundColor: t.surfaceInset,
    },
    link: { color: t.brand, fontWeight: '700', textDecorationLine: 'underline' },

    /* lists ---------------------------------------------------------- */
    list: { gap: 10 },
    listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
    /** sits on the first line's optical centre, and never shrinks */
    bullet: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginTop: Math.round((prose.lineHeight as number) / 2) - 3,
      flexGrow: 0,
      flexShrink: 0,
    },
    marker: { ...prose, fontWeight: '800', flexGrow: 0, flexShrink: 0, minWidth: 22 },
    listText: { ...prose, flexGrow: 1, flexShrink: 1, flexBasis: 'auto', minWidth: 0 },

    /* quote ---------------------------------------------------------- */
    quote: { borderLeftWidth: 3, paddingLeft: l.isPhone ? 14 : 18, paddingVertical: 2 },
    quoteText: { ...prose, fontStyle: 'italic', color: t.textMuted },

    /* callout -------------------------------------------------------- */
    callout: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: l.isPhone ? 14 : 17,
      borderRadius: 13,
    },
    calloutIcon: { marginTop: 3, flexGrow: 0, flexShrink: 0 },
    calloutText: {
      ...prose,
      fontSize: Math.round((prose.fontSize as number) * 0.96),
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },

    /* code ----------------------------------------------------------- */
    code: {
      backgroundColor: t.surfaceInset,
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: 12,
      padding: l.isPhone ? 13 : 16,
    },
    codeText: { ...mono, fontSize: l.isPhone ? 12.5 : 13.5, lineHeight: 21, color: t.text },

    /* figure --------------------------------------------------------- */
    figure: { gap: 9 },
    caption: { ...type.caption, color: t.textSubtle },

    rule: { height: 1, backgroundColor: t.divider, marginVertical: l.isPhone ? 4 : 8 },

    /* takeaways ------------------------------------------------------ */
    takeaways: {
      maxWidth: MEASURE,
      width: '100%',
      borderLeftWidth: 3,
      borderRadius: 4,
      paddingLeft: l.isPhone ? 15 : 19,
      paddingVertical: 4,
      gap: 12,
    },
    takeawaysLabel: { ...type.micro, fontWeight: '800', letterSpacing: 1.1 },
    takeawaysList: { gap: 9 },
    takeawayRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    takeawayDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      marginTop: 9,
      flexGrow: 0,
      flexShrink: 0,
    },
    takeawayText: {
      ...type.bodySm,
      color: t.text,
      fontWeight: '600',
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 'auto',
      minWidth: 0,
    },
  });

  return { ...sheet, figureImage };
}

export type { ViewStyle };
