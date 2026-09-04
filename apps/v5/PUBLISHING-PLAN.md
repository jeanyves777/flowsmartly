# The V5 publishing site — plan

Public pages where FlowSmartly can talk about itself, publish on a schedule, and
get found. Scoped to `apps/v5`, under the clean-room rule in `AGENTS.md`.

---

## 1. The finding that shapes this plan

**The publishing site is already built. It just has nothing real in it, and no
way to publish anything.**

The Resources wing is ~4,600 lines of finished, token-driven, three-theme,
responsive design across five routes. What is in it:

| Route | Lines | What it currently says |
| --- | --- | --- |
| `/resources` | 1,503 | "240+ articles" (`index.tsx:82`); six invented featured pieces |
| `/resources/blog` | 672 | Six invented posts + a featured one, dated 2024, by an author who does not exist ("Maya Patel, Growth Marketing Lead"); "Join 8,000+ growth-minded teams" (`blog.tsx:448`) |
| `/resources/guides` | 825 | Five invented guides with download counts — 4,820 / 7,310 / 6,140 / 5,275 / 3,960 |
| `/resources/changelog` | 695 | Invented releases with invented dates |
| `/resources/templates` | 835 | Twelve invented templates |
| `/resources/help-center` | 742 | Invented article lists under real category names |

This is the same class of problem `CONTENT-GAPS.md` documents for
`/company/customers`, and the same one already fixed on `/company/press` and
`/company/about`. A named person with a quote and a portrait is a fabricated
testimonial; a download count of 7,310 on a guide nobody has written is a
fabricated metric. The blog is the highest-stakes of these, because a blog is
the one surface a visitor arrives at expecting *dated, attributed, checkable*
claims.

The second problem is structural, and it is the reason the fiction is there:

- **There are no post pages.** `blog.tsx:76-83` routes every card to a *product*
  page instead, with a comment saying exactly why: "Individual post pages do not
  exist in this app, so a post opens the product surface it is written about."
- **There is no newsletter.** Subscribe hands the address to `/company/contact`
  (`blog.tsx:433-445`).
- **There is no deploy path.** Nothing in `.github/workflows/` or `scripts/`
  references `apps/v5`. The site cannot currently be published at all.

So the work is not "build a blog". It is: **give the existing wing a publishing
spine, then replace the fiction with real pieces as they are written** — and
until a surface has real content, make it say so honestly rather than pad.

---

## 2. What already works in our favour

Verified in the tree, not assumed:

- **`web.output: "static"`** (`app.json`) — every route exports as real HTML, so
  a crawler that runs no JavaScript still sees the words.
- **`generateStaticParams` is supported** by the installed expo-router 57.0.9
  (`node_modules/expo-router/build/Route.d.ts:18`). A `[slug].tsx` route
  therefore produces one real HTML file per post at export time. This is the
  whole technical spine, and it already exists.
- **`scripts/agent-assets.js` derives `sitemap.xml` and `llms.txt` from the
  exported routes themselves.** Every new post is advertised to search engines
  and answer engines automatically, with no list to maintain by hand.
- **`seo.tsx` was written for a blog that hadn't been built yet.** It already
  emits `og:type=article`, `article:published_time`, `article:modified_time`,
  `article:author`, `article:section`, and exports `articleJsonLd()`,
  `breadcrumbJsonLd()` and `faqJsonLd()` (`seo.tsx:155-215`).
- **`robots.txt` already allows the answer engines by name** — GPTBot,
  ClaudeBot, OAI-SearchBot, PerplexityBot, Google-Extended, Applebot-Extended —
  and blocks the bulk scrapers that neither cite nor refer. `ai.txt` declares
  `Attribution-Required: yes` and `Preferred-Citation: page-level`.
- **Editorial art already exists** in `assets/images/v5w/editorial/` —
  `blog-local-growth`, `guide-playbook-cover`, `guide-playbook-spread`,
  `resource-automation`, `resource-deliverability`, `template-library`.

The distribution foundation most sites spend a quarter retrofitting is done.
What is missing is the content and the last mile.

---

## 3. The decision that gates everything: where this is served

Nothing is published until `apps/v5` has a deploy path. Today `flowsmartly.com`
is served by the root Next app on the VPS; `SITE.origin` in `seo.tsx` already
says the V5 site expects to *be* `flowsmartly.com`.

Three options:

1. **Path-mount on the real domain (recommended).** Build `apps/v5`, rsync
   `dist/` to the VPS, and add an Nginx `location` block so the V5 routes are
   served from the static export while everything else still goes to the Next
   upstream. The blog is born on `flowsmartly.com/resources/blog` and never
   moves.
2. **Subdomain** (`new.` or `v5.`). Fastest to stand up, and wrong for a blog:
   whatever ranking and citation the posts earn accrues to a hostname you intend
   to abandon, and moving them later costs a redirect map and a ranking dip
   exactly when the content has finally started working.
3. **Wait for the full V5 cutover.** Correct destination, unbounded delay, and
   the publishing programme is the thing that most needs to start early —
   editorial compounds and needs months, not weeks.

**Recommendation: option 1.** Publish on the domain the content will live on
forever, from the first post. `mirror-routes.js` already documents the URL shape
a real server has to serve (`/route` → `route.html`); Nginx `try_files` handles
it directly, so the mirror stays a local-QA tool.

The deploy job itself is small: a GitHub Actions workflow that runs
`npm run qa:web` in `apps/v5` (export → readiness audit → strict gate) and
rsyncs `dist/`. The audit already exists and already fails the build on a
readiness regression.

---

## 4. How a post becomes a page

```
apps/v5/src/content/posts/<slug>.md      ← the writing (markdown + frontmatter)
apps/v5/assets/images/v5w/editorial/…    ← the art (made by you, per AGENTS.md)
        │
        │  scripts/build-content.js  — runs before `expo export`
        ▼
apps/v5/src/content/posts.generated.ts   ← typed block tree, no runtime parser
        │
        ▼
src/app/resources/blog/[slug].tsx        ← generateStaticParams() over the index
        │
        ▼
dist/resources/blog/<slug>.html          ← one real HTML file per post
        │
        ▼
sitemap.xml + llms.txt                   ← derived automatically by agent-assets.js
```

**Why markdown compiled to blocks, and not MDX or HTML.** React Native has no
DOM, so an HTML blob would mean `dangerouslySetInnerHTML` and a second styling
system living outside the token scale — the exact failure `AGENTS.md` exists to
prevent. Compiling to a typed block tree (`{ kind: 'h2' | 'p' | 'list' | 'quote'
| 'code' | 'callout' | 'image' | 'takeaways', … }`) keeps every heading, rule
and colour coming from `useTokens()` and the shared type scale, gives the whole
archive one voice for free, and costs the reader no parser at runtime. Authors
still write plain markdown.

**Why files and not a live content API.** A static export that fetches its posts
at runtime ships an empty page to every crawler and answer engine that does not
execute JavaScript — it would defeat the entire point. And a build-time fetch
from the root app's database would couple V5's release path to the legacy
system, which is what the clean room forbids. Files in the repo make the post
*part of the build*: reviewable in a PR, type-checked, atomic, revertible.

**"Publish from FlowSmartly" — the honest version.** FlowSmartly is the
*authoring* tool, not the runtime dependency. Draft in Flow-AI, generate the
editorial art with the image pipeline, then the piece lands as a markdown file
and a `.webp` in this repo, and publishing is a merge. Same product, no
coupling. The dogfooding story stays completely true and is worth writing about
in itself.

**Cost of this pipeline:** one build script, one `[slug]` route, one `<Article>`
renderer, one `posts.ts` index type. Everything downstream — SEO tags, JSON-LD,
sitemap, llms.txt, theme, responsive layout — already exists.

---

## 5. The surfaces

| Surface | Status | What it is for |
| --- | --- | --- |
| `/resources/blog` | exists, fiction | The index. Keep the design, swap `POSTS` for the generated index, delete the invented featured author |
| `/resources/blog/[slug]` | **build** | The missing piece. Article page: takeaways block, body, author, dates, related, one CTA |
| `/resources/changelog` | exists, fiction | **The highest-value surface we have.** V5 ships constantly and every entry is checkable — this is the one page that can be honest and frequent from day one |
| `/resources/guides` | exists, fiction | Long-form evergreen. Same `[slug]` machinery, different template. Drop the download counts |
| `/resources/templates` | exists, fiction | Gate behind real templates. Until they exist, it should say so |
| `/resources/help-center` | exists, fiction | Product docs. Blocked on the product surfaces being final |
| `/company/press` | already honest | Press kit — leave it |

**Honest empty states.** A surface with nothing real in it says "nothing
published here yet" — the blog archive already has exactly this component
(`blog.tsx:354-360`) and it reads well. Use it. A page that admits it is new
costs far less credibility than one caught inventing 7,310 downloads.

**Author pages: not yet.** One real author exists. A single byline linking to
`/company/about` is honest; an `/authors/` directory built for a team of one is
the same fiction in a new shape.

---

## 6. What we publish — the V5 focus

The positioning on this branch is **the AI Business Operating System**. The
editorial programme is the *argument* for it, and the argument only works if
every piece is something we can stand behind today. Three pillars, in order of
how cheap and how true they are:

**A. The product, shown.** What the business OS actually does, in real
screenshots from real surfaces. One per capability: the agent that operates the
account, the call agent, ListSmartly, FlowShop, the studios. No projections, no
customer numbers — a demonstration is not a claim.

**B. Build-in-public.** The most distinctive content available to us, and it is
already written in the commit log. Real material sitting there right now:

- Why the site refuses to show a customer count it does not have — the honesty
  audit, `CONTENT-GAPS.md`, and what got deleted from `/company/press`
- Three themes as a first-class constraint, not a skin
- Measured SVG connectors: why the diagrams survive a resize when dashed borders
  do not
- The QA harness that reported a clean sweep on a page full of clipped text, and
  what it took to make it honest
- Static export + answer-engine discoverability: allowing the crawlers that cite
  and blocking the ones that don't

Nobody else can publish these, they cost nothing to research, and they reach the
technical founders and operators who actually try new tools.

**C. Operator playbooks.** The evergreen how-to that earns search and gets cited
by assistants — local visibility, omnichannel messaging, cart recovery, review
response, deliverability. Useful on its own merits, citing no numbers of ours.

**Deliberately excluded until real:** customer stories, ROI figures, "teams
like yours" claims, headcount, funding, any download or subscriber count.

**Launch set: five pieces, one per pillar plus two.** Five is enough for an
archive to look alive and few enough to be genuinely good. The current page
ships six fake ones — five real ones is a straight improvement.

**Cadence after launch:** one piece a week, one changelog entry per shipped
change. The changelog carries the frequency so the blog never has to pad.

---

## 7. Getting noticed

Ranked by what will actually move a new domain with no authority, which is not
the same order as the usual SEO checklist.

### 7.1 Answer engines first (the real 2026 channel)

Competing for "marketing automation platform" against incumbents with fifteen
years of backlinks is a losing race. Being the page an assistant *cites* when
someone asks a specific question is winnable now, and V5 is already
configured for it — `robots.txt` allow-list, `ai.txt` attribution policy,
`llms.txt` auto-generated.

What to add, all of it in the post template:

- **A "what this covers" takeaways block at the top of every post** — three to
  five one-sentence, self-contained, quotable claims. Assistants extract spans;
  give them clean spans to extract.
- **Structure over prose.** Definitions, numbered steps, comparison tables, an
  explicit FAQ at the foot with `faqJsonLd()` — already built (`seo.tsx:193`).
- **Article JSON-LD on every post** with author, `datePublished`,
  `dateModified`, `articleSection` — `articleJsonLd()` already built.
- **Answer the question in the H1.** "How do I stop no-shows at a dental
  practice" beats "Rethinking the modern patient journey".
- **Extend `llms.txt` with a posts section** — one line per post, title plus a
  one-sentence summary, in the generator that already walks `dist/`.
- **Dates visible in the HTML, not just the meta.** Freshness is a ranking input
  for every answer engine, and `ai.txt` already promises
  `article:modified_time`.

### 7.2 Owned distribution

- **RSS/Atom at `/feed.xml`**, written by the same script that writes the
  sitemap. Cheap, and it is how aggregators, newsreaders and syndication bots
  find you.
- **The newsletter needs a real backend.** Today Subscribe hands off to the
  contact form. This is the one honest gap worth closing early, because the list
  is the only audience nobody can take away. Until it works, keep the hand-off —
  a fake confirmation is worse than an honest redirect. And remove "Join 8,000+
  growth-minded teams".
- **Changelog as a subscribable drumbeat.** Shipping velocity is the most
  credible thing an early product has.

### 7.3 Outbound, in leverage order

1. **Directories and marketplaces** — G2, Capterra, Product Hunt, the AI-tool
   directories. Double duty: buyer traffic, and they are heavily read by the
   answer engines, so a listing feeds 7.1.
2. **Founder-led posting.** The build-in-public pillar is written to be posted.
   One thread per piece, in the founder's voice, not the brand's.
3. **Communities** where the operator playbooks are on-topic — answer the
   question fully in the thread, link only if it adds something.
4. **Syndication with `rel=canonical`** back to us (dev.to, Medium, LinkedIn
   articles) once there are five pieces worth syndicating.
5. **Podcasts and guest posts.** Slowest, highest quality, start once the
   archive proves there is something to talk about.

### 7.4 Technical, already mostly done

Sitemap ✅ automatic · robots ✅ · ai.txt ✅ · llms.txt ✅ · canonical ✅ ·
OG/Twitter ✅ · static HTML ✅ · favicons ✅

Remaining: RSS, per-post OG images, internal linking from product pages into the
relevant posts (and back), and the `og-default.png` check —
`ART-REQUESTS.md` records it once 404ing on all 44 routes.

**Per-post OG images are an open question.** `AGENTS.md` forbids generating art.
A card composited from the post title, the theme tokens and the logo is a
*rendered layout* rather than fabricated artwork — but that is your call to
make, not mine to assume. The fallback is the existing `og-default.png` on every
post, which costs some click-through on shares and nothing else.

### 7.5 What to measure

Four numbers, monthly. Consent-gated analytics and first-touch attribution are
already in the site.

1. **Citations** — how often FlowSmartly is named when you ask ChatGPT, Claude
   and Perplexity the ten questions the posts answer. Run it as a fixed script
   monthly; it is the leading indicator for 7.1.
2. **Organic entrances to `/resources/*`**, and how many continue to a product
   page.
3. **Newsletter subscribers** — the only compounding asset here.
4. **Referral sources** — which of the 7.3 channels actually returned anything,
   so the ones that don't get dropped.

---

## 8. Sequencing

Each phase ends somewhere shippable.

**Phase 0 — Stop the fiction (small, do first).**
Replace the invented posts, guides, download counts, "240+ articles" and
"8,000+ teams" with honest empty states. Record the removals in
`CONTENT-GAPS.md` the way `/company/press` and `/company/about` were. The site
is then *smaller and true*, which is the only base worth building on.

**Phase 1 — The spine.**
`scripts/build-content.js`, the block types, the `<Article>` renderer,
`resources/blog/[slug].tsx` with `generateStaticParams`, article JSON-LD wired,
`llms.txt` extended with a posts section, `/feed.xml`. Validated the V5 way:
export, screenshot 390/768/1024/1280/1536/1920 × light/grey/dark, and look at
every one.

**Phase 2 — Deploy.**
The Actions workflow and the Nginx mount from §3. First real URL live.

**Phase 3 — The launch set.**
Five real pieces (§6), art requested through `ART-REQUESTS.md`, changelog
backfilled from the actual commit log — there is a lot of shipped work to write
up truthfully.

**Phase 4 — Distribution.**
Newsletter backend, directory listings, founder posting, the citation baseline
measured before promotion starts so there is something to compare against.

**Phase 5 — Compound.**
Weekly cadence, guides on the same `[slug]` machinery, topic hubs once a cluster
has four or more posts.

Phases 0–2 are the ones that require decisions. 3 onward is a routine.

---

## 9. Open decisions

1. **Deploy target** — path-mount on `flowsmartly.com` (recommended), subdomain,
   or wait for the full cutover. Gates everything.
2. **Phase 0 scope** — strip the whole Resources wing to honest empty states at
   once, or only the blog now and the rest as each gets real content.
3. **Per-post OG images** — composited title cards, or `og-default.png` on
   every post.
4. **Newsletter** — build the backend in Phase 1, or keep the contact hand-off
   until Phase 4.
5. **Byline** — founder's name on everything, or "The FlowSmartly team" until
   there is a team writing.
