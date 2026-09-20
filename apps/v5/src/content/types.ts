/**
 * The shape a published post takes once it has left markdown behind.
 *
 * Posts are authored as markdown in `src/content/posts/` and compiled to this
 * by `scripts/build-content.js` before the export runs. The renderer therefore
 * never parses anything at runtime, and — the reason it is worth doing at all —
 * every heading, rule and colour on an article comes from `useTokens()` and the
 * shared type scale rather than from a second styling system smuggled in with
 * an HTML blob. React Native has no DOM to hand that blob to anyway.
 */

/** A run of text inside a paragraph, list item or quote. */
export type Inline =
  | { t: 'text'; v: string }
  | { t: 'strong'; v: string }
  | { t: 'em'; v: string }
  | { t: 'code'; v: string }
  | { t: 'link'; v: string; href: string };

/** Callout tones map onto the accent tokens, so they follow the theme. */
export type CalloutTone = 'brand' | 'violet' | 'green' | 'orange' | 'pink';

export type Block =
  | { kind: 'p'; text: Inline[] }
  /** `id` is the anchor a table of contents and a deep link both use. */
  | { kind: 'h2'; text: string; id: string }
  | { kind: 'h3'; text: string; id: string }
  | { kind: 'ul'; items: Inline[][] }
  | { kind: 'ol'; items: Inline[][] }
  | { kind: 'quote'; text: Inline[] }
  | { kind: 'code'; text: string }
  | { kind: 'callout'; tone: CalloutTone; text: Inline[] }
  | { kind: 'image'; name: string; alt: string; caption?: string }
  | { kind: 'rule' };

/**
 * Everything the index, the card, the unfurl and the JSON-LD need — without
 * loading the body. The generated module exports these separately so the
 * archive page does not carry every article's prose.
 */
export type PostMeta = {
  slug: string;
  title: string;
  /** the card blurb, the meta description and the JSON-LD description */
  description: string;
  topic: string;
  /** accent for the card chip and the article's rules */
  tone: CalloutTone;
  /** ISO date — `article:published_time` and the visible byline both read it */
  date: string;
  /** ISO date, when the piece has been revised since publication */
  updated?: string;
  /** computed from the body at build time, never hand-written */
  readMinutes: number;
  author: string;
  /** `Media` name for the author's portrait */
  authorAvatar?: string;
  authorRole?: string;
  /** `Media` / `Artwork` name for the lead image */
  art?: string;
  artAlt?: string;
  /**
   * Three to five self-contained sentences that state what the piece concludes.
   *
   * They are the first thing on the page and the thing an answer engine can
   * lift without having to summarise the whole article. A post with none is
   * still valid; a post with vague ones is worse than a post with none.
   */
  takeaways: string[];
  /** at most one post carries this; the index gives it the lead slot */
  featured?: boolean;
};

export type Post = PostMeta & { blocks: Block[] };

/**
 * A release note. Compiled from `src/content/changelog/*.md`, where `month` and
 * `label` are derived from the date rather than written by hand — the previous
 * changelog carried both separately and they were free to disagree.
 */
export type ChangelogEntry = {
  /** ISO date */
  date: string;
  /** grouping heading, e.g. "August 2026" */
  month: string;
  /** short label shown on the row, e.g. "Aug 9" */
  label: string;
  kind: 'New' | 'Improved' | 'Fixed';
  title: string;
  /** exactly two sentences; a note that needs more than that is a blog post */
  lines: [string, string];
  /** a real destination for "Read more", or nothing at all */
  more?: string;
};
