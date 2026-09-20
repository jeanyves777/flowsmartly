import Head from 'expo-router/head';
import { usePathname } from 'expo-router';

/**
 * Per-page SEO. Emits the tags a crawler and a social unfurl actually read:
 * title, description, canonical, Open Graph, Twitter card, robots, and
 * optional JSON-LD.
 *
 * Static rendering means these end up in the served HTML rather than being
 * bolted on client-side, so they are visible to crawlers that do not run JS.
 */

export const SITE = {
  name: 'FlowSmartly',
  origin: 'https://flowsmartly.com',
  tagline: 'The Agentic Business Operating System',
  twitter: '@flowsmartly',
  /** shipped in `public/`, used as the default unfurl image */
  ogImage: '/og-default.png',
} as const;

export type SeoProps = {
  /** page title without the site suffix */
  title: string;
  description?: string;
  /** absolute or root-relative image for the social unfurl */
  image?: string;
  /** what the unfurl image shows — read aloud when the link is shared */
  imageAlt?: string;
  /** 'website' for pages, 'article' for a post */
  type?: 'website' | 'article';
  /** keep this page out of the index (thank-you pages, 404) */
  noIndex?: boolean;
  /** JSON-LD objects to embed */
  jsonLd?: object[];
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    author?: string;
    section?: string;
  };
};

export function Seo({ title, description, image, imageAlt, type = 'website', noIndex, jsonLd, article }: SeoProps) {
  const pathname = usePathname();
  const canonical = `${SITE.origin}${pathname === '/' ? '' : pathname}`;
  const fullTitle = `${title} — ${SITE.name}`;
  const ogImage = image
    ? image.startsWith('http')
      ? image
      : `${SITE.origin}${image}`
    : `${SITE.origin}${SITE.ogImage}`;

  return (
    <Head>
      <title>{fullTitle}</title>
      {description ? <meta name="description" content={description} /> : null}
      <link rel="canonical" href={canonical} />
      {noIndex ? <meta name="robots" content="noindex, nofollow" /> : <meta name="robots" content="index, follow" />}

      {/* An unfurl card without dimensions is laid out only after the image
          downloads, and several scrapers skip it entirely; without alt text it
          is unreadable to anyone using a screen reader on the shared post. */}
      <meta property="og:site_name" content={SITE.name} />
      <meta property="og:type" content={type} />
      <meta property="og:locale" content="en_US" />
      <meta property="og:title" content={fullTitle} />
      {description ? <meta property="og:description" content={description} /> : null}
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={imageAlt ?? `${SITE.name} — ${SITE.tagline}`} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={SITE.twitter} />
      <meta name="twitter:creator" content={SITE.twitter} />
      <meta name="twitter:title" content={fullTitle} />
      {description ? <meta name="twitter:description" content={description} /> : null}
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:image:alt" content={imageAlt ?? `${SITE.name} — ${SITE.tagline}`} />

      {/* Read by Google for the SERP snippet: allow a full-size preview image
          and an untruncated text snippet rather than the conservative default. */}
      {noIndex ? null : (
        <meta
          name="googlebot"
          content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"
        />
      )}
      <meta name="author" content={SITE.name} />
      <meta name="publisher" content={SITE.name} />

      {/* The export ships one 48px favicon.ico. These are the rest of the set
          (see scripts/icons.js), so an installed app, an iOS home screen and a
          crawler looking for the brand logo all find a real image. */}
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <link rel="manifest" href="/site.webmanifest" />
      {/* Advertised on every page, not just the blog: a reader, an aggregator
          and a "new post" automation all look for it in the head of whatever
          page they were pointed at. */}
      <link rel="alternate" type="application/rss+xml" title="FlowSmartly Blog" href={`${SITE.origin}/feed.xml`} />
      {/* the page has three themes, so the browser chrome follows the one in use */}
      <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
      <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0b1020" />

      {article?.publishedTime ? <meta property="article:published_time" content={article.publishedTime} /> : null}
      {article?.modifiedTime ? <meta property="article:modified_time" content={article.modifiedTime} /> : null}
      {article?.author ? <meta property="article:author" content={article.author} /> : null}
      {article?.section ? <meta property="article:section" content={article.section} /> : null}

      {(jsonLd ?? []).map((block, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
    </Head>
  );
}

/* ------------------------------------------------------------------ */
/* JSON-LD builders                                                    */
/* ------------------------------------------------------------------ */

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE.name,
    url: SITE.origin,
    logo: `${SITE.origin}/icon.png`,
    description: `${SITE.name} — ${SITE.tagline}`,
    sameAs: [
      'https://www.linkedin.com/company/flowsmartly',
      'https://www.instagram.com/flowsmartly',
      'https://www.youtube.com/@flowsmartly',
    ],
  };
}

export function webSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: SITE.origin,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE.origin}/resources/help-center?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SITE.origin}${item.path}`,
    })),
  };
}

export function articleJsonLd(input: {
  headline: string;
  description: string;
  path: string;
  datePublished: string;
  /** omit for a piece that has not been revised — never echo `datePublished` */
  dateModified?: string;
  /** the topic, as `articleSection` — answer engines use it to place the piece */
  section?: string;
  author?: string;
  image?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline,
    description: input.description,
    url: `${SITE.origin}${input.path}`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE.origin}${input.path}` },
    datePublished: input.datePublished,
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
    ...(input.section ? { articleSection: input.section } : {}),
    author: { '@type': input.author ? 'Person' : 'Organization', name: input.author ?? SITE.name },
    publisher: {
      '@type': 'Organization',
      name: SITE.name,
      logo: { '@type': 'ImageObject', url: `${SITE.origin}/icon.png` },
    },
    image: input.image ? `${SITE.origin}${input.image}` : `${SITE.origin}${SITE.ogImage}`,
  };
}

export function faqJsonLd(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}
