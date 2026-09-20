/* Compiles `src/content/posts/*.md` into `src/content/posts.generated.ts`.
 *
 *   node scripts/build-content.js
 *   node scripts/build-content.js --check    (fails if the generated file is stale)
 *
 * Runs before `expo export`. Authors write plain markdown; the site renders a
 * typed block tree, so an article is styled by the same tokens and type scale
 * as every other page and no HTML string is ever handed to a renderer that has
 * no DOM to put it in.
 *
 * The markdown accepted here is deliberately a subset — every construct maps
 * onto exactly one block the renderer knows how to draw. Anything else is a
 * build error rather than a silently dropped line, because a paragraph that
 * quietly vanishes between authoring and publishing is the worst failure this
 * pipeline could have.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'src', 'content', 'posts');
const OUT = path.join(ROOT, 'src', 'content', 'posts.generated.ts');
/**
 * The same index, as JSON, for the build scripts.
 *
 * `agent-assets.js` needs titles, dates and descriptions to write the feed and
 * the blog section of llms.txt, and it is plain Node — it cannot import the
 * TypeScript module the app uses. One generator writing both keeps them from
 * disagreeing about what is published.
 */
const OUT_JSON = path.join(ROOT, 'src', 'content', 'posts.index.json');
const CHANGELOG_DIR = path.join(ROOT, 'src', 'content', 'changelog');
const OUT_CHANGELOG = path.join(ROOT, 'src', 'content', 'changelog.generated.ts');

const TONES = ['brand', 'violet', 'green', 'orange', 'pink'];
/** average adult reading speed for non-fiction prose, rounded to a flat number */
const WORDS_PER_MINUTE = 220;

const problems = [];
function fail(file, message) {
  problems.push(`${path.basename(file)}: ${message}`);
}

/* ---------- frontmatter ---------- */

/**
 * `key: value`, plus `key:` followed by `- ` lines for a list. Deliberately not
 * YAML: a real parser would accept nesting, anchors and types this format has
 * no meaning for, and every one of those would be a way to write a post the
 * renderer cannot draw.
 */
function parseFrontmatter(raw, file) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) {
    fail(file, 'no frontmatter block');
    return { data: {}, body: raw };
  }
  const data = {};
  let listKey = null;
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && listKey) {
      data[listKey].push(stripQuotes(item[1].trim()));
      continue;
    }
    const pair = /^([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/.exec(line);
    if (!pair) {
      fail(file, `unparsable frontmatter line: ${line}`);
      continue;
    }
    const [, key, value] = pair;
    if (value.trim() === '') {
      listKey = key;
      data[key] = [];
    } else {
      listKey = null;
      data[key] = stripQuotes(value.trim());
    }
  }
  return { data, body: raw.slice(match[0].length) };
}

function stripQuotes(value) {
  return /^(['"])([\s\S]*)\1$/.test(value) ? value.slice(1, -1) : value;
}

/* ---------- inline ---------- */

/**
 * `**strong**`, `*em*`, `` `code` `` and `[label](href)`.
 *
 * Code is matched first and its contents are never re-scanned, so a backtick
 * span containing an asterisk stays literal — which matters here, where posts
 * quote real source.
 */
const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;

function parseInline(text) {
  const out = [];
  let last = 0;
  let match;
  INLINE.lastIndex = 0;
  while ((match = INLINE.exec(text))) {
    if (match.index > last) out.push({ t: 'text', v: text.slice(last, match.index) });
    const token = match[0];
    if (token.startsWith('`')) {
      out.push({ t: 'code', v: token.slice(1, -1) });
    } else if (token.startsWith('**')) {
      out.push({ t: 'strong', v: token.slice(2, -2) });
    } else if (token.startsWith('*')) {
      out.push({ t: 'em', v: token.slice(1, -1) });
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      out.push({ t: 'link', v: link[1], href: link[2] });
    }
    last = match.index + token.length;
  }
  if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
  return out.length ? out : [{ t: 'text', v: text }];
}

function slugifyHeading(text) {
  return text
    .toLowerCase()
    .replace(/[`*]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* ---------- blocks ---------- */

function parseBody(body, file) {
  const lines = body.split(/\r?\n/);
  const blocks = [];
  const usedIds = new Set();
  let i = 0;

  /** headings share a page with the takeaways block, so ids must not collide */
  const uniqueId = (text) => {
    const base = slugifyHeading(text) || 'section';
    let id = base;
    let n = 2;
    while (usedIds.has(id)) id = `${base}-${n++}`;
    usedIds.add(id);
    return id;
  };

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    // fenced code
    if (line.startsWith('```')) {
      const body = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++]);
      if (i >= lines.length) fail(file, 'unterminated code fence');
      i += 1;
      blocks.push({ kind: 'code', text: body.join('\n') });
      continue;
    }

    // callout — ::: tone … :::
    if (line.startsWith(':::')) {
      const tone = line.slice(3).trim() || 'brand';
      if (!TONES.includes(tone)) fail(file, `unknown callout tone "${tone}"`);
      const body = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith(':::')) body.push(lines[i++]);
      if (i >= lines.length) fail(file, 'unterminated callout');
      i += 1;
      blocks.push({ kind: 'callout', tone, text: parseInline(body.join(' ').trim()) });
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      blocks.push({ kind: 'rule' });
      i += 1;
      continue;
    }

    // image — ![alt](name "optional caption")
    const image = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/.exec(line.trim());
    if (image) {
      blocks.push({
        kind: 'image',
        name: image[2],
        alt: image[1],
        ...(image[3] ? { caption: image[3] } : {}),
      });
      i += 1;
      continue;
    }

    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    if (heading) {
      const text = heading[2].trim();
      blocks.push({ kind: heading[1].length === 2 ? 'h2' : 'h3', text, id: uniqueId(text) });
      i += 1;
      continue;
    }

    if (/^#\s+/.test(line)) {
      // The page's single h1 is the post title from frontmatter. A second one
      // in the body would compete with it in the outline a crawler builds.
      fail(file, 'body uses "# " — the title in frontmatter is the only h1');
      i += 1;
      continue;
    }

    // lists — consecutive `- ` or `1. ` lines, wrapped lines joined
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      const items = [];
      while (i < lines.length) {
        const current = lines[i];
        const nextBullet = /^\s*[-*]\s+(.*)$/.exec(current);
        const nextNumbered = /^\s*\d+[.)]\s+(.*)$/.exec(current);
        if (ordered ? nextNumbered : nextBullet) {
          items.push((ordered ? nextNumbered : nextBullet)[1].trim());
          i += 1;
        } else if (current.trim() && /^\s{2,}\S/.test(current) && items.length) {
          items[items.length - 1] += ` ${current.trim()}`;
          i += 1;
        } else {
          break;
        }
      }
      blocks.push({ kind: ordered ? 'ol' : 'ul', items: items.map(parseInline) });
      continue;
    }

    if (line.startsWith('>')) {
      const body = [];
      while (i < lines.length && lines[i].startsWith('>')) body.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push({ kind: 'quote', text: parseInline(body.join(' ').trim()) });
      continue;
    }

    // paragraph — runs until a blank line or the start of another construct
    const para = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) para.push(lines[i++].trim());
    blocks.push({ kind: 'p', text: parseInline(para.join(' ')) });
  }

  return blocks;
}

function isBlockStart(line) {
  return (
    line.startsWith('```') ||
    line.startsWith(':::') ||
    line.startsWith('>') ||
    /^#{1,3}\s/.test(line) ||
    /^---+$/.test(line.trim()) ||
    /^\s*[-*]\s+/.test(line) ||
    /^\s*\d+[.)]\s+/.test(line) ||
    /^!\[[^\]]*\]\(/.test(line.trim())
  );
}

/* ---------- reading time ---------- */

function countWords(blocks) {
  let words = 0;
  const runs = (inlines) => inlines.forEach((run) => (words += run.v.trim().split(/\s+/).filter(Boolean).length));
  for (const block of blocks) {
    if (block.kind === 'p' || block.kind === 'quote' || block.kind === 'callout') runs(block.text);
    else if (block.kind === 'ul' || block.kind === 'ol') block.items.forEach(runs);
    else if (block.kind === 'h2' || block.kind === 'h3') words += block.text.split(/\s+/).length;
  }
  return words;
}

/* ---------- build ---------- */

function build() {
  if (!fs.existsSync(POSTS_DIR)) {
    console.error(`content: ${path.relative(ROOT, POSTS_DIR)} is missing`);
    process.exitCode = 1;
    return null;
  }

  const files = fs
    .readdirSync(POSTS_DIR)
    .filter((name) => name.endsWith('.md'))
    .sort();

  const posts = [];
  const slugs = new Set();

  for (const name of files) {
    const file = path.join(POSTS_DIR, name);
    const raw = fs.readFileSync(file, 'utf8');
    const { data, body } = parseFrontmatter(raw, file);
    const slug = data.slug || name.replace(/\.md$/, '');

    for (const key of ['title', 'description', 'topic', 'date', 'author']) {
      if (!data[key]) fail(file, `frontmatter is missing "${key}"`);
    }
    if (slugs.has(slug)) fail(file, `duplicate slug "${slug}"`);
    slugs.add(slug);
    if (data.date && !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      fail(file, `date must be YYYY-MM-DD, got "${data.date}"`);
    }
    if (data.updated && !/^\d{4}-\d{2}-\d{2}$/.test(data.updated)) {
      fail(file, `updated must be YYYY-MM-DD, got "${data.updated}"`);
    }
    const tone = data.tone || 'brand';
    if (!TONES.includes(tone)) fail(file, `unknown tone "${tone}"`);
    const takeaways = Array.isArray(data.takeaways) ? data.takeaways : [];
    if (takeaways.length && (takeaways.length < 3 || takeaways.length > 5)) {
      fail(file, `takeaways must be 3–5 items, got ${takeaways.length}`);
    }

    const blocks = parseBody(body, file);
    if (!blocks.length) fail(file, 'no body');

    posts.push({
      slug,
      title: data.title,
      description: data.description,
      topic: data.topic,
      tone,
      date: data.date,
      ...(data.updated ? { updated: data.updated } : {}),
      readMinutes: Math.max(1, Math.round(countWords(blocks) / WORDS_PER_MINUTE)),
      author: data.author,
      ...(data.authorRole ? { authorRole: data.authorRole } : {}),
      ...(data.authorAvatar ? { authorAvatar: data.authorAvatar } : {}),
      ...(data.art ? { art: data.art } : {}),
      ...(data.artAlt ? { artAlt: data.artAlt } : {}),
      takeaways,
      ...(String(data.featured) === 'true' ? { featured: true } : {}),
      blocks,
    });
  }

  if (posts.filter((post) => post.featured).length > 1) {
    problems.push('more than one post is marked featured — the index has one lead slot');
  }

  // Newest first: the archive, the feed and llms.txt all want the same order,
  // so it is settled once here rather than three times downstream.
  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug < b.slug ? -1 : 1));

  if (problems.length) {
    console.error('content: cannot build —');
    problems.forEach((problem) => console.error(`  ${problem}`));
    process.exitCode = 1;
    return null;
  }

  const meta = posts.map(({ blocks, ...rest }) => rest);
  const banner =
    '/* GENERATED by scripts/build-content.js — do not edit.\n' +
    ' * Source: src/content/posts/*.md\n' +
    ' */\n\n' +
    "import type { Post, PostMeta } from './types';\n\n";

  const text =
    banner +
    `export const POSTS: Post[] = ${JSON.stringify(posts, null, 2)};\n\n` +
    '/** Index metadata without the bodies — what the archive page renders. */\n' +
    `export const POST_INDEX: PostMeta[] = ${JSON.stringify(meta, null, 2)};\n\n` +
    'export const TOPICS: string[] = ' +
    JSON.stringify([...new Set(posts.map((post) => post.topic))]) +
    ';\n\n' +
    'export function postBySlug(slug: string): Post | undefined {\n' +
    '  return POSTS.find((post) => post.slug === slug);\n' +
    '}\n';

  return { text, json: `${JSON.stringify(meta, null, 2)}\n`, count: posts.length };
}

/* ---------- changelog ---------- */

const KINDS = ['New', 'Improved', 'Fixed'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Release notes, from `src/content/changelog/*.md`.
 *
 * The month heading and the short date are derived from the ISO date rather
 * than written out, because the previous version of this page carried both by
 * hand and they were free to disagree with each other — and did, with entries
 * filed under a month their own date did not fall in.
 *
 * An entry is exactly two sentences of body. That is a real constraint, not a
 * limitation: a release note that needs four paragraphs is a blog post, and
 * the two-line shape is what keeps the page scannable.
 */
function buildChangelog() {
  if (!fs.existsSync(CHANGELOG_DIR)) return { text: null, count: 0 };

  const entries = [];
  for (const name of fs.readdirSync(CHANGELOG_DIR).filter((f) => f.endsWith('.md')).sort()) {
    const file = path.join(CHANGELOG_DIR, name);
    const { data, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'), file);

    for (const key of ['date', 'title', 'kind']) {
      if (!data[key]) fail(file, `frontmatter is missing "${key}"`);
    }
    if (data.date && !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      fail(file, `date must be YYYY-MM-DD, got "${data.date}"`);
    }
    if (data.kind && !KINDS.includes(data.kind)) {
      fail(file, `kind must be one of ${KINDS.join(' / ')}, got "${data.kind}"`);
    }

    const paragraphs = parseBody(body, file).filter((block) => block.kind === 'p');
    if (paragraphs.length !== 2) {
      fail(file, `an entry is exactly two paragraphs, found ${paragraphs.length}`);
      continue;
    }
    const flatten = (block) => block.text.map((run) => run.v).join('');

    const [year, month, day] = (data.date || '2000-01-01').split('-').map(Number);
    entries.push({
      date: data.date,
      month: `${MONTHS[month - 1]} ${year}`,
      label: `${SHORT[month - 1]} ${day}`,
      kind: data.kind,
      title: data.title,
      lines: [flatten(paragraphs[0]), flatten(paragraphs[1])],
      ...(data.more ? { more: data.more } : {}),
    });
  }

  entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const text =
    '/* GENERATED by scripts/build-content.js — do not edit.\n' +
    ' * Source: src/content/changelog/*.md\n' +
    ' */\n\n' +
    "import type { ChangelogEntry } from './types';\n\n" +
    `export const CHANGELOG: ChangelogEntry[] = ${JSON.stringify(entries, null, 2)};\n`;

  return { text, count: entries.length };
}

const result = build();
const log = result ? buildChangelog() : null;

// One failure report for both passes: a broken changelog entry must not be
// masked by the posts having compiled cleanly.
if (problems.length) {
  console.error('content: cannot build —');
  problems.forEach((problem) => console.error(`  ${problem}`));
  process.exitCode = 1;
} else if (result && log) {
  const check = process.argv.includes('--check');
  const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
  const stale =
    read(OUT) !== result.text ||
    read(OUT_JSON) !== result.json ||
    (log.text !== null && read(OUT_CHANGELOG) !== log.text);
  if (check) {
    if (stale) {
      console.error('content: generated files are stale — run `npm run content`');
      process.exitCode = 1;
    } else {
      console.log(`content: up to date (${result.count} posts, ${log.count} changelog entries)`);
    }
  } else {
    fs.writeFileSync(OUT, result.text);
    fs.writeFileSync(OUT_JSON, result.json);
    if (log.text !== null) fs.writeFileSync(OUT_CHANGELOG, log.text);
    console.log(`content: ${result.count} posts, ${log.count} changelog entries`);
  }
}
