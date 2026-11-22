// The public newsroom's decoder and words, against the shapes the core feed emits.
//
// The core feed is flowsmartly-v5 `domains/websites/src/news.ts` (`publicNewsFeed`,
// `newsroomWords`); its item modes are the `NewsEvidence.mode` union in
// `packages/contracts/src/site-blocks.ts`. The fixtures below copy those shapes,
// including `sourceSummaryDraft` from `first-party-news-feeds.ts` (keyed blocks,
// empty uncertainty and corrections, one source).
//
// Run: node --experimental-strip-types --test scripts/news.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FIRST_PARTY_NEWSROOM,
  decodeNews,
  decodeNewsroom,
  itemKind,
  selectNews,
} from '../src/lib/news.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Every value of `NewsEvidence.mode` the core contract allows. */
export const CORE_ITEM_MODES = ['reporting', 'analysis', 'source_summary'];

/** The first-party feed's `_newsroom`, exactly as `newsroomWords('first_party')` writes it. */
const FIRST_PARTY = {
  kind: 'first_party',
  name: 'FlowSmartly News',
  description: 'Headlines from public sources, each linked to its publisher.',
  author: 'FlowSmartly',
};
/** A customer Site's feed, as `newsroomWords('flowagent', name)` writes it. */
const FLOWAGENT = {
  kind: 'flowagent',
  name: 'FlowAgent News',
  description: 'Original source-grounded reporting and analysis from FlowAgent.',
  author: 'FlowAgent · FlowSmartly',
};

export function item(mode, n = 1) {
  const link = `https://www.example-publisher.com/story-${n}`;
  return {
    id: `page_${mode}_${n}`,
    slug: `story-${mode.replace('_', '-')}-${n}`,
    url: `https://flowsmartly.com/news/article?slug=story-${n}`,
    title: `Publisher headline ${n}`,
    excerpt: 'The feed’s own description, capped.',
    publishedAt: '2026-11-21T14:00:00.000Z',
    text: 'The feed’s own description, capped.\n\nSource: Example Publisher, published 2026-11-21.',
    blocks: [
      { key: 'summary', type: 'rich_text', paragraphs: [{ runs: [{ text: 'The feed’s own description, capped.' }] }] },
      {
        key: 'source',
        type: 'rich_text',
        paragraphs: [
          { runs: [{ text: 'Source: Example Publisher, published 2026-11-21.' }] },
          { runs: [{ text: 'Read the full story at ' }, { text: 'Example Publisher', href: link }] },
        ],
      },
    ],
    editorial: {
      storyKey: `example-publisher.com/story-${n}`,
      category: 'science',
      mode,
      researchedAt: '2026-11-21T14:05:00.000Z',
      sources: [
        {
          url: link,
          title: `Publisher headline ${n}`,
          publisher: 'Example Publisher',
          publishedAt: mode === 'source_summary' && n === 2 ? null : '2026-11-21T13:59:00.000Z',
          retrievedAt: '2026-11-21T14:05:00.000Z',
        },
      ],
      uncertainty: [],
      corrections: [],
    },
  };
}

export function feed(articles, newsroom = FIRST_PARTY) {
  return {
    version: 'https://jsonfeed.org/version/1.1',
    title: newsroom.name,
    description: newsroom.description,
    home_page_url: 'https://flowsmartly.com/news',
    feed_url: 'https://flowsmartly.com/_news/feed.json',
    dailyTarget: 20,
    _newsroom: newsroom,
    articles,
    items: articles.map((a) => ({
      id: a.url,
      url: a.url,
      title: a.title,
      content_text: a.text,
      date_published: a.publishedAt,
      tags: [a.editorial.category, a.editorial.mode],
      _sources: a.editorial.sources,
    })),
  };
}

for (const mode of CORE_ITEM_MODES)
  test(`the decoder accepts a core feed item of mode ${mode}`, () => {
    const articles = decodeNews(feed([item(mode)]));
    assert.equal(articles.length, 1);
    assert.equal(articles[0].editorial.mode, mode);
  });

test('the decoder accepts a feed of every core mode at once, and a headline with no source date', () => {
  const all = [...CORE_ITEM_MODES.map((m, i) => item(m, i + 1)), item('source_summary', 2)];
  all.at(-1).slug = 'undated-headline';
  assert.equal(decodeNews(feed(all)).length, all.length);
});

test('the decoder still refuses a mode the core contract does not have', () => {
  assert.throws(() => decodeNews(feed([item('opinion')])), /News feed unavailable/);
});

test('an empty feed decodes to no articles — the empty state — not a failure', () => {
  assert.deepEqual(decodeNews(feed([])), []);
  assert.deepEqual(selectNews([], ''), []);
});

test('a missing or broken feed is the only thing that fails', () => {
  assert.throws(() => decodeNews(null), /News feed unavailable/);
  assert.throws(() => decodeNews({}), /News feed unavailable/);
});

test('a headline is labelled by its publisher, not as reporting or analysis', () => {
  assert.equal(itemKind(item('source_summary')), 'From Example Publisher');
  assert.equal(itemKind(item('reporting')), 'Reporting');
  assert.equal(itemKind(item('analysis')), 'Analysis');
});

test('the newsroom words come from _newsroom, with the first-party words as the default', () => {
  assert.deepEqual(decodeNewsroom(feed([], FIRST_PARTY)), FIRST_PARTY);
  assert.deepEqual(decodeNewsroom(feed([], FLOWAGENT)), FLOWAGENT);
  assert.deepEqual(decodeNewsroom({ articles: [] }), FIRST_PARTY_NEWSROOM);
  assert.deepEqual(decodeNewsroom(null), FIRST_PARTY_NEWSROOM);
  assert.deepEqual(decodeNewsroom({ _newsroom: { kind: 'something-else' } }), FIRST_PARTY_NEWSROOM);
  assert.deepEqual(FIRST_PARTY_NEWSROOM, FIRST_PARTY, 'the static default matches the core first-party words');
});

/** What the first-party newsroom must never claim: it is software, no AI, no writing. */
export const FIRST_PARTY_FORBIDDEN = [/flowagent/i, /original reporting/i, /\banalysis\b/i, /source-grounded/i];

test('the first-party words never say FlowAgent, original reporting or analysis', () => {
  for (const words of [FIRST_PARTY_NEWSROOM.name, FIRST_PARTY_NEWSROOM.description, FIRST_PARTY_NEWSROOM.author])
    for (const bad of FIRST_PARTY_FORBIDDEN) assert.doesNotMatch(words, bad);
});

test('the nav names the newsroom FlowSmartly News, headlines from public sources', () => {
  const nav = fs.readFileSync(path.join(here, '../src/components/public/nav.ts'), 'utf8');
  const line = nav.split('\n').find((l) => l.includes('href: ROUTES.news'));
  assert.ok(line, 'the nav has a news link');
  assert.match(line, /label: 'FlowSmartly News'/);
  assert.match(line, /description: 'Headlines from public sources'/);
  for (const bad of FIRST_PARTY_FORBIDDEN) assert.doesNotMatch(line, bad);
});
