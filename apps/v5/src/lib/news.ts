/** Public snapshot contract. Deliberately contains no owner or workspace fields. */
export const NEWS_TOPICS = [
  'science',
  'ai-race',
  'banking',
  'business',
  'technology',
] as const;
export const TOPIC_LABELS: Record<string, string> = {
  science: 'Science',
  'ai-race': 'The AI race',
  banking: 'Banking',
  business: 'Business',
  technology: 'Technology',
};
export type NewsSource = {
  url: string;
  title: string;
  publisher: string;
  publishedAt: string | null;
  retrievedAt: string;
};
export type NewsBlock =
  | { type: 'heading'; text: string; level: number }
  | {
      type: 'rich_text';
      paragraphs: {
        runs: {
          text: string;
          bold?: boolean;
          italic?: boolean;
          href?: string;
        }[];
      }[];
    };
export type NewsArticle = {
  id: string;
  slug: string;
  url: string;
  title: string;
  excerpt: string | null;
  publishedAt: string;
  text: string;
  blocks?: NewsBlock[];
  editorial: {
    storyKey: string;
    category: string;
    mode: 'reporting' | 'analysis';
    researchedAt: string;
    sources: NewsSource[];
    uncertainty: string[];
    corrections: { at: string; note: string }[];
  };
};
export function decodeNews(value: unknown): NewsArticle[] {
  const feed = value as { articles?: unknown } | null;
  if (!feed || !Array.isArray(feed.articles))
    throw new Error('News feed unavailable');
  for (const raw of feed.articles) {
    const a = raw as NewsArticle;
    if (
      !a ||
      typeof a.id !== 'string' ||
      typeof a.slug !== 'string' ||
      !/^[a-z0-9-]+$/.test(a.slug) ||
      typeof a.title !== 'string' ||
      typeof a.text !== 'string' ||
      typeof a.publishedAt !== 'string' ||
      !Number.isFinite(Date.parse(a.publishedAt)) ||
      !a.editorial ||
      !NEWS_TOPICS.includes(
        a.editorial.category as (typeof NEWS_TOPICS)[number],
      ) ||
      !['analysis', 'reporting'].includes(a.editorial.mode) ||
      !Array.isArray(a.editorial.sources) ||
      !Array.isArray(a.editorial.uncertainty) ||
      !Array.isArray(a.editorial.corrections)
    )
      throw new Error('News feed unavailable');
    if (
      !Number.isFinite(Date.parse(a.editorial.researchedAt)) ||
      a.editorial.sources.length === 0 ||
      a.editorial.uncertainty.some((x) => typeof x !== 'string') ||
      a.editorial.corrections.some(
        (x) => typeof x.note !== 'string' || !Number.isFinite(Date.parse(x.at)),
      )
    )
      throw new Error('News feed unavailable');
    if (a.blocks !== undefined) {
      if (!Array.isArray(a.blocks)) throw new Error('News feed unavailable');
      for (const block of a.blocks) {
        if (block.type === 'heading') {
          if (typeof block.text !== 'string')
            throw new Error('News feed unavailable');
        } else if (block.type === 'rich_text') {
          if (!Array.isArray(block.paragraphs))
            throw new Error('News feed unavailable');
          for (const paragraph of block.paragraphs)
            if (
              !Array.isArray(paragraph.runs) ||
              paragraph.runs.some((run) => typeof run.text !== 'string')
            )
              throw new Error('News feed unavailable');
        } else throw new Error('News feed unavailable');
      }
    }
    for (const source of a.editorial.sources) {
      const url = new URL(source.url);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        typeof source.title !== 'string' ||
        typeof source.publisher !== 'string' ||
        !Number.isFinite(Date.parse(source.retrievedAt))
      )
        throw new Error('News feed unavailable');
    }
  }
  return feed.articles as NewsArticle[];
}
export function selectNews(
  articles: readonly NewsArticle[],
  query: string,
  topic?: string,
  date?: string,
) {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return articles.filter(
    (a) =>
      (!topic || a.editorial.category === topic) &&
      (!date || a.publishedAt.slice(0, 10) === date) &&
      words.every((word) =>
        `${a.title} ${a.excerpt ?? ''} ${a.text}`
          .toLocaleLowerCase()
          .includes(word),
      ),
  );
}
export const articleHref = (slug: string) =>
  `/news/article?slug=${encodeURIComponent(slug)}`;
