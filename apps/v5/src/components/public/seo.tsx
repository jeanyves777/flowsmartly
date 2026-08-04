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
  tagline: 'The AI Growth Operating System',
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

export function Seo({ title, description, image, type = 'website', noIndex, jsonLd, article }: SeoProps) {
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

      <meta property="og:site_name" content={SITE.name} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      {description ? <meta property="og:description" content={description} /> : null}
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={SITE.twitter} />
      <meta name="twitter:title" content={fullTitle} />
      {description ? <meta name="twitter:description" content={description} /> : null}
      <meta name="twitter:image" content={ogImage} />

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
  author?: string;
  image?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline,
    description: input.description,
    url: `${SITE.origin}${input.path}`,
    datePublished: input.datePublished,
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
