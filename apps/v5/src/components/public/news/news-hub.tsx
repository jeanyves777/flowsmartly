import { useEffect, useMemo, useState } from "react";
import { Link, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { PageShell } from "../page-shell";
import {
  Heading,
  OpenSection as Section,
  SectionLabel,
  useTypeScale,
} from "../ui";
import { useTokens } from "@/theme/v5-theme-provider";
import { useLayout } from "@/theme/use-responsive";
import { softFill } from "@/theme/tokens";
import {
  articleHref,
  decodeNews,
  NEWS_TOPICS,
  selectNews,
  TOPIC_LABELS,
  type NewsArticle,
} from "@/lib/news";

function useNews() {
  const [state, setState] = useState<{
    kind: "loading" | "ready" | "failed";
    articles: NewsArticle[];
  }>({ kind: "loading", articles: [] });
  const [attempt, retry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const embedded =
      attempt === 0 && typeof document !== "undefined"
        ? document.getElementById("flowagent-public-news")?.textContent
        : null;
    const load = embedded
      ? Promise.resolve().then(() => decodeNews(JSON.parse(embedded)))
      : fetch("/_news/feed.json", { signal: controller.signal }).then(
          async (response) => {
            if (!response.ok) throw new Error();
            return decodeNews(await response.json());
          },
        );
    load
      .then((articles) => setState({ kind: "ready", articles }))
      .catch(() => {
        if (!controller.signal.aborted)
          setState({ kind: "failed", articles: [] });
      });
    return () => controller.abort();
  }, [attempt]);
  return {
    ...state,
    retry: () => {
      setState({ kind: "loading", articles: [] });
      retry((x) => x + 1);
    },
  };
}

export function NewsHub({
  topic,
  article = false,
  briefing = false,
}: {
  topic?: string;
  article?: boolean;
  briefing?: boolean;
}) {
  const t = useTokens(),
    l = useLayout(),
    type = useTypeScale();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        intro: { gap: 18 },
        row: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
        },
        chip: {
          display: "flex",
          minHeight: 44,
          justifyContent: "center",
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.surface,
        },
        selected: {
          backgroundColor: softFill(t.brand, t),
          borderColor: t.brand,
        },
        search: {
          color: t.text,
          backgroundColor: t.surfaceMuted,
          borderColor: t.border,
          borderWidth: 1,
          borderRadius: 14,
          minHeight: 52,
          paddingHorizontal: 18,
          fontSize: 16,
          width: "100%",
        },
        grid: {
          flexDirection: l.isPhone ? "column" : "row",
          flexWrap: "wrap",
          gap: 20,
        },
        card: {
          gap: 16,
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: l.radius,
          padding: l.sectionPad,
          backgroundColor: t.surfaceRaised,
          flexGrow: 0,
          flexShrink: 1,
          flexBasis: l.isPhone ? "auto" : l.isTablet ? "48%" : "31%",
          minWidth: 0,
        },
        link: {
          display: "flex",
          ...type.bodySm,
          color: t.brand,
          minHeight: 44,
          paddingVertical: 12,
        },
        reader: { maxWidth: 760, width: "100%", alignSelf: "center", gap: 24 },
        paragraph: { ...type.body, color: t.text, lineHeight: 30 },
        divider: {
          borderTopWidth: 1,
          borderColor: t.border,
          paddingTop: 24,
          gap: 16,
        },
        meta: { ...type.caption, color: t.textMuted },
        featured: {
          backgroundColor: softFill(t.brand, t),
          borderColor: t.border,
          borderWidth: 1,
          borderRadius: l.radius,
          padding: l.sectionPad,
          gap: 16,
        },
      }),
    [t, l, type],
  );
  const params = useLocalSearchParams<{ slug?: string; date?: string }>();
  const news = useNews();
  const [query, setQuery] = useState("");
  const chosen = article
    ? news.articles.find((a) => a.slug === params.slug)
    : undefined;
  const date =
    briefing && typeof params.date === "string" ? params.date : undefined;
  const title = article
    ? (chosen?.title ?? "Read FlowAgent News")
    : briefing
      ? "The daily briefing · UTC"
      : topic
        ? (TOPIC_LABELS[topic] ?? "News")
        : "A clearer view of what’s next.";
  const filtered = selectNews(news.articles, query, topic, date);
  const dates = [
    ...new Set(
      news.articles.map((a) =>
        new Date(a.publishedAt).toISOString().slice(0, 10),
      ),
    ),
  ];
  const canonical =
    article &&
    typeof params.slug === "string" &&
    /^[a-z0-9-]+$/.test(params.slug)
      ? articleHref(params.slug)
      : briefing && date
        ? `/news/briefing?date=${encodeURIComponent(date)}`
        : undefined;
  const jsonLd = chosen
    ? [
        {
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: chosen.title,
          datePublished: chosen.publishedAt,
          dateModified:
            chosen.editorial.corrections.at(-1)?.at ?? chosen.publishedAt,
          url: `https://flowsmartly.com${articleHref(chosen.slug)}`,
          articleSection: TOPIC_LABELS[chosen.editorial.category],
          author: { "@type": "Organization", name: "FlowAgent · FlowSmartly" },
          citation: chosen.editorial.sources.map((s) => s.url),
        },
      ]
    : [
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "FlowAgent News",
          url: "https://flowsmartly.com/news",
        },
      ];
  return (
    <PageShell
      title={title}
      description={
        chosen?.excerpt ??
        "Source-grounded reporting and analysis on science, the AI race, banking and the business of technology."
      }
      cta={false}
      canonicalPath={canonical}
      type={chosen ? "article" : "website"}
      jsonLd={jsonLd}
      noIndex={news.kind === "ready" && article && !chosen}
    >
      <Section>
        <View style={styles.intro}>
          <SectionLabel>FLOWAGENT NEWS</SectionLabel>
          <Heading level={1} style={type.display}>
            {title}
          </Heading>
          {!article && (
            <Text style={type.body}>
              Science. The AI race. Money. The ideas moving business forward.
              Original reporting and analysis, with the sources always in view.
            </Text>
          )}
          <View style={styles.row}>
            <Link href="/news" style={[styles.chip, styles.link]}>
              Latest
            </Link>
            <Link href="/news/briefing" style={[styles.chip, styles.link]}>
              Daily briefings
            </Link>
            <Link href="/_news/feed.json" style={[styles.chip, styles.link]}>
              Open news feed ↗
            </Link>
          </View>
          {!article && (
            <View style={styles.row}>
              {NEWS_TOPICS.map((key) => (
                <Link
                  key={key}
                  href={`/news/${key}` as never}
                  style={[
                    styles.chip,
                    styles.link,
                    topic === key ? styles.selected : {},
                  ]}
                >
                  {TOPIC_LABELS[key]}
                </Link>
              ))}
            </View>
          )}
        </View>
      </Section>
      {news.kind === "loading" && (
        <Section>
          <Text accessibilityLiveRegion="polite" style={type.body}>
            Loading published reporting…
          </Text>
        </Section>
      )}
      {news.kind === "failed" && (
        <Section>
          <Heading level={2} style={type.h3}>
            The newsroom is temporarily unavailable.
          </Heading>
          <Text style={type.body}>
            We couldn’t load published articles. Please try again.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={news.retry}
            style={styles.chip}
          >
            <Text style={styles.link}>Try again</Text>
          </Pressable>
        </Section>
      )}
      {news.kind === "ready" &&
        article &&
        (chosen ? (
          <Section>
            <View style={styles.reader}>
              <Text style={styles.meta}>
                {TOPIC_LABELS[chosen.editorial.category]} ·{" "}
                {chosen.editorial.mode === "analysis"
                  ? "Analysis"
                  : "Reporting"}{" "}
                · FlowAgent
              </Text>
              <Text style={styles.meta}>
                Published {new Date(chosen.publishedAt).toUTCString()} ·
                Researched{" "}
                {new Date(chosen.editorial.researchedAt).toUTCString()}
              </Text>
              {chosen.excerpt && <Text style={type.h3}>{chosen.excerpt}</Text>}
              {chosen.blocks?.length
                ? chosen.blocks.map((block, index) =>
                    block.type === "heading" ? (
                      <Heading
                        key={index}
                        level={block.level === 3 ? 3 : 2}
                        style={type.h3}
                      >
                        {block.text}
                      </Heading>
                    ) : (
                      block.paragraphs.map((paragraph, p) => (
                        <Text
                          key={`${index}-${p}`}
                          selectable
                          style={styles.paragraph}
                        >
                          {paragraph.runs.map((run, r) => (
                            <Text
                              key={r}
                              style={{
                                fontWeight: run.bold ? "700" : "400",
                                fontStyle: run.italic ? "italic" : "normal",
                              }}
                            >
                              {run.text}
                            </Text>
                          ))}
                        </Text>
                      ))
                    ),
                  )
                : chosen.text.split(/\n\n+/).map((paragraph, index) => (
                    <Text key={index} style={styles.paragraph} selectable>
                      {paragraph}
                    </Text>
                  ))}
              <View style={styles.divider}>
                <Heading level={2} style={type.h3}>
                  Sources & evidence
                </Heading>
                {chosen.editorial.sources.map((source) => (
                  <View key={source.url} style={{ gap: 8 }}>
                    <Link
                      href={source.url as never}
                      target="_blank"
                      style={styles.link}
                    >
                      {source.title} ↗
                    </Link>
                    <Text style={styles.meta}>
                      {source.publisher} ·{" "}
                      {source.publishedAt
                        ? `Published ${new Date(source.publishedAt).toUTCString()}`
                        : "Publication time not provided"}{" "}
                      · Retrieved {new Date(source.retrievedAt).toUTCString()}
                    </Text>
                  </View>
                ))}
              </View>
              {chosen.editorial.uncertainty.length > 0 && (
                <View style={styles.divider}>
                  <Heading level={2} style={type.h3}>
                    What remains uncertain
                  </Heading>
                  {chosen.editorial.uncertainty.map((line, i) => (
                    <Text key={i} style={type.body}>
                      {line}
                    </Text>
                  ))}
                </View>
              )}
              <View style={styles.divider}>
                <Heading level={2} style={type.h3}>
                  Corrections & updates
                </Heading>
                {chosen.editorial.corrections.length ? (
                  chosen.editorial.corrections.map((one, i) => (
                    <Text key={i} style={type.body}>
                      {new Date(one.at).toUTCString()} — {one.note}
                    </Text>
                  ))
                ) : (
                  <Text style={type.body}>No corrections recorded.</Text>
                )}
              </View>
            </View>
          </Section>
        ) : (
          <Section>
            <Heading level={2} style={type.h3}>
              Article not found
            </Heading>
            <Text style={type.body}>
              This address has no published article. Browse the latest reporting
              above.
            </Text>
          </Section>
        ))}
      {news.kind === "ready" && !article && (
        <Section>
          <View style={{ gap: 24 }}>
            {briefing && (
              <View style={styles.featured}>
                <Heading level={2} style={type.h2}>
                  Your day, in perspective.
                </Heading>
                <Text style={type.body}>
                  Browse each day’s published coverage. Dates group articles by
                  publication day in UTC.
                </Text>
                <View style={styles.row}>
                  {dates.map((day) => (
                    <Link
                      key={day}
                      href={`/news/briefing?date=${day}` as never}
                      style={[styles.chip, styles.link]}
                    >
                      {day} ·{" "}
                      {
                        news.articles.filter((a) =>
                          new Date(a.publishedAt).toISOString().startsWith(day),
                        ).length
                      }{" "}
                      articles
                    </Link>
                  ))}
                </View>
              </View>
            )}
            <TextInput
              accessibilityLabel="Search published news"
              placeholder="Search stories, ideas and companies"
              placeholderTextColor={t.textMuted}
              value={query}
              onChangeText={setQuery}
              style={styles.search}
            />
            <Text accessibilityLiveRegion="polite" style={styles.meta}>
              {date ? `${date} · ` : ""}
              {filtered.length} published{" "}
              {filtered.length === 1 ? "article" : "articles"}
            </Text>
            {!filtered.length ? (
              <View style={styles.featured}>
                <Heading level={2} style={type.h3}>
                  {news.articles.length
                    ? "No matching stories."
                    : "The next story starts with a source."}
                </Heading>
                <Text style={type.body}>
                  {news.articles.length
                    ? "Try another topic, date or search."
                    : "No articles have been published yet. Our editorial target is 20 original articles a day; only verified publications appear here."}
                </Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {filtered.map((a) => (
                  <View key={a.id} style={styles.card}>
                    <Text style={styles.meta}>
                      {TOPIC_LABELS[a.editorial.category]} ·{" "}
                      {a.editorial.mode === "analysis"
                        ? "Analysis"
                        : "Reporting"}
                    </Text>
                    <Heading level={2} style={type.h3}>
                      {a.title}
                    </Heading>
                    <Text style={type.bodySm}>{a.excerpt}</Text>
                    <View style={{ flexGrow: 1 }} />
                    <Text style={styles.meta}>
                      {new Date(a.publishedAt).toUTCString()} ·{" "}
                      {a.editorial.sources.length} sources
                    </Text>
                    <Link
                      href={articleHref(a.slug) as never}
                      style={styles.link}
                    >
                      Read the story →
                    </Link>
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.meta}>
              Created by FlowAgent using public sources. Reporting and analysis
              are labelled separately. Source timestamps and corrections remain
              attached to every story.
            </Text>
          </View>
        </Section>
      )}
    </PageShell>
  );
}
