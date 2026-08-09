# Publishing FlowSmartly off your own site

Public places to write and announce that are **not** flowsmartly.com — other
people's platforms, with audiences and authority you don't have to build.

Companion to `apps/v5/PUBLISHING-PLAN.md`, which covers the on-site blog. This
one does not depend on it. Nothing here waits for V5 to deploy.

---

## 1. Why this is the right order

A new domain has no authority. A post on flowsmartly.com competes for attention
from zero — no subscribers, no backlinks, no crawl priority. The same words on
Substack, dev.to, LinkedIn or Product Hunt land on a platform that is already
crawled hourly, already read by answer engines, and already has an audience with
a reason to be there.

So: **publish off-site first, and let the traffic point home.** The on-site blog
becomes the archive you migrate to later, once there is something to migrate.

`flowsmartly.com` is already live and serving, so every link has a real
destination today. That is the only prerequisite, and it is met.

---

## 2. Leverage you already have

Verified in this repo, not assumed:

**Your product already publishes to ten external platforms.**
`src/lib/social/publisher.ts` has working publishers for Facebook, Instagram,
YouTube, X/Twitter, LinkedIn, TikTok, Threads, Pinterest, WhatsApp and
**Google Business Profile** (`src/lib/social/google-business.ts`), all
OAuth-wired under `src/app/api/social/`.

Meaning: the announcement machine is built. FlowSmartly can announce FlowSmartly.
That is both the fastest path to distribution and, separately, a story worth
telling.

**You already have a 163-entry directory register.**
`src/lib/constants/listsmartly.ts` — tiered, with `claimUrl` / `submitUrl` per
entry, ranked, with a review-platform set. Its bias is local citations (Yelp,
YellowPages, Nextdoor, Foursquare). For a SaaS the relevant half is missing:
only **G2** and **Crunchbase** are in there, and Crunchbase is in
`NON_LISTING_DIRECTORY_SLUGS` so it is excluded from submission.

That gap is worth closing as a product feature — see §8.

---

## 3. The property map

Five classes. You do not need all of them; you need one from each of the first
three.

### Class 1 — Where the long-form lives

| Platform | What it's really for | Verdict |
| --- | --- | --- |
| **Substack** | Blog + newsletter + **your own email list** + a recommendation network that sends real subscribers | **Home base.** Pick this |
| dev.to | Technical build-in-public. Indexed fast, generous reach for engineering posts, no paywall | Syndicate here |
| Hashnode | Same audience as dev.to, supports canonical tags cleanly | Optional, pick one of the two |
| LinkedIn articles + newsletter | Where the buyers actually are for a business OS | Syndicate here |
| Medium | Still ranks, but reach has thinned and the paywall creates friction | Skip unless a specific publication invites you |
| **Blogger / Blogspot** | Google-owned, free, indexed | Skip. Free and indexed, but a blogspot URL in 2026 signals abandonment, and it does not build a list |

**Why Substack over the others:** it is the only one that is simultaneously a
blog, a newsletter and an owned list. The list is the one asset no platform
change can take from you, and `apps/v5/src/app/resources/blog.tsx:433-445`
currently has a Subscribe button with nothing behind it — Substack closes that
gap on day one instead of in Phase 4. It exports cleanly, so migrating to
flowsmartly.com later is a real option, not a trap.

### Class 2 — Where you announce

| Platform | Use it for | Notes |
| --- | --- | --- |
| **Product Hunt** | The V5 launch. One big day | You get one good shot. Do not spend it before the site and the first five posts are ready |
| Hacker News (Show HN) | The build-in-public and engineering angle | Ruthless about marketing language. Lead with the technical substance |
| Indie Hackers | Founder story, revenue/build transparency | Long-tail, forgiving, good for consistency |
| Reddit — r/SaaS, r/smallbusiness, r/Entrepreneur | Operator playbooks, answering real questions | Read each sub's self-promo rules first. Answer fully in-thread; link only if it adds something |
| BetaList, Peerlist, Uneed, SaaSHub, Launching Next | Steady low-effort launch coverage | Submit once, they keep referring for months |
| **Your own social, via your own product** | Every announcement, everywhere, automatically | Already built — §2 |

### Class 3 — Google, specifically

You asked for this by name, so here is what "publishing on Google" actually
means in 2026:

1. **Google Business Profile — with Posts.** This is the closest thing to a free
   announcement site Google hosts for you. A claimed profile gets a knowledge
   panel, and **Google Posts** are dated announcements published directly onto
   Google's surfaces. Your product already posts to it
   (`src/lib/social/google-business.ts`), and it is Tier 1 `critical` in the
   ListSmartly register. **Claim it first** — as **General Computing Solutions,
   132 Lincoln St, Pittsfield MA 01201**, category *Software company*, with
   FlowSmartly named in the description as the product. It is the single
   highest-leverage off-site property you can own, you have a real address to
   verify it with, and you already have the machinery to post to it. See §4.2
   before filing.
2. **YouTube.** Google-owned, the second-largest search engine, and
   `publishToYouTube` already exists in the publisher. Product walkthroughs rank
   for queries the blog will never touch.
3. **Google Search Console.** Not a publishing surface — the instrument panel.
   Verify the domain, submit the sitemap, and you can see what is actually being
   indexed instead of guessing.
4. **Knowledge panel / entity.** Google forms its idea of "what FlowSmartly is"
   from consistent name, description and links across Crunchbase, LinkedIn, G2,
   Wikipedia-adjacent sources and your own schema. Consistency across §4 is what
   builds it. There is no form to fill in.
5. **Blogger.** Technically Google-hosted publishing. Not recommended — see the
   table above.

### Class 4 — Software and AI directories

These do double duty: buyers browse them, **and answer engines read them
heavily**. When someone asks an assistant "what's a good AI marketing platform
for a small business", the answer is assembled largely from these.

- **Review platforms:** G2 (already in your register), Capterra, GetApp,
  Software Advice, TrustRadius
- **Comparison/alternative sites:** AlternativeTo, SaaSHub, Slashdot Software
- **AI tool directories:** the aggregator set — high volume, low effort, and
  disproportionately quoted by assistants
- **Company records:** Crunchbase, LinkedIn company page

G2 and Capterra need **real reviews from real users** to matter. Ask actual
customers; never seed them. A directory profile with no reviews still helps the
entity graph, so submit early and let reviews accumulate honestly.

### Class 5 — Where you show up as a person

Founder-led beats brand-led for an early product, every time. X/LinkedIn posting
in your own voice, podcast guest spots, community answers. The
build-in-public material in `apps/v5/PUBLISHING-PLAN.md` §6 was written to be
posted this way.

---

## 4. The entity — settle this before creating a single account

**Same legal name, same address, same one-line description, same URL, same logo
— everywhere.** This is what builds a Google entity and what makes an assistant
confident enough to name you. Twenty properties with inconsistent details read
to a machine as twenty weakly-related companies.

### 4.1 What is actually true

- **Parent company:** General Computing Solutions
- **Address:** 132 Lincoln St, Pittsfield, MA 01201
- **FlowSmartly:** a *product* of General Computing Solutions, not a separate
  business at a separate address

That distinction decides how every property in §3 gets filled in:

| Property type | Registered as | Why |
| --- | --- | --- |
| Google Business Profile | **General Computing Solutions**, 132 Lincoln St | A GBP is a business at a location. A software product has no location; the company does |
| Local citations (Yelp, Bing Places, Apple, BBB, Nextdoor) | **General Computing Solutions** | Same reason. This is the NAP set — name/address/phone must match GBP character for character |
| Software directories (G2, Capterra, Product Hunt, AlternativeTo, SaaSHub) | **FlowSmartly**, with GCS named as the vendor | These list *products*. This is where the brand lives |
| Crunchbase / LinkedIn company | **General Computing Solutions**, with FlowSmartly listed as a product | Company records; feeds the entity graph hardest |
| Substack / dev.to / social | **FlowSmartly** | Audience-facing brand |
| Terms, Privacy, SMS sender, domain registrant | **the legal entity** — see 4.2 | Contract and compliance, not marketing |

### 4.2 ⚠ The site names a company that does not exist

**Confirmed: General Computing Solutions is the only company.** There is no
"FlowSmartly, Inc." The V5 legal pages declare a contracting party and a data
controller that do not exist:

- `apps/v5/src/app/legal/terms.tsx:56` — "These Terms form a binding agreement
  between you and **FlowSmartly, Inc., a Delaware corporation**"
- `apps/v5/src/app/legal/privacy.tsx:198` and `gdpr.tsx:152` — names
  **FlowSmartly, Inc.** as the GDPR data controller
- `cookies.tsx:24`, `gdpr.tsx:28` and three sibling files hardcode
  `REGISTERED_ADDRESS = '548 Market St, PMB 72224, San Francisco, CA 94104'` — a
  virtual-mailbox address, not 132 Lincoln St
- `apps/v5/public/ai.txt:6` — `Owner: FlowSmartly, Inc.`
- `src/lib/domains/opensrs-client.ts:31` — domains are registered to
  `org_name: "FlowSmartly Inc"`

Meanwhile `src/components/agent-home/focused/sms-verify.tsx:171` uses
"General Computing Solutions" as the legal-business-name placeholder, which
matches what you told me.

**This has to be resolved before §6 Week 1, not after.** Not for tidiness:

- **GBP verification** checks the real business at the real address. A profile
  filed under a name that does not match the registration fails, and a failed or
  suspended profile is painful to recover.
- **Directory submissions are permanent public records.** Submitting 20
  listings under the wrong entity means 20 corrections later, and a
  half-corrected citation set is worse for the entity graph than none.
- **A2P 10DLC brand registration** keys off the legal business name and EIN. The
  SMS work is already blocked behind this; registering the wrong brand wastes
  the cycle.
- **Terms name the contracting party and Privacy names the data controller.** If
  "FlowSmartly, Inc." is not a real entity, those documents identify a party
  that cannot hold the contract or answer a GDPR request.

`public/ai.txt` is corrected. The legal pages are a single pass once two things
are decided — the entity descriptor that replaces "a Delaware corporation", and
whether governing law moves from Delaware to Massachusetts. The full file-by-file
list is in `apps/v5/CONTENT-GAPS.md`.

**Every marketing property in §3 is blocked on nothing.** GCS at 132 Lincoln St
is confirmed, so Week 1 can start now — GBP, Search Console, Crunchbase,
LinkedIn and the directory set all register against facts that are already
settled. Only the legal text waits.

### 4.3 The block to write once

Once 4.2 is settled, put this in one place and paste it everywhere:

- Legal name · trading/brand name · parent-product relationship
- Address, phone, contact email
- One-line description (~15 words) · short (~50) · long (~150)
- Canonical URL, logo, founding year, category, EIN (for the compliance set)

`ListSmartly` already models exactly this for customers, and BrandKit can hold
it. Dogfood it.

### 4.4 The Pittsfield angle is an asset, not an afterthought

A real address in Pittsfield unlocks something a virtual mailbox never could:

- **A verifiable GBP**, which §3 Class 3 calls the highest-leverage item here.
- **Local search in the Berkshires** — "marketing automation Pittsfield",
  "AI phone answering Western Mass". Tiny volume, near-zero competition, and it
  converts, because a local business would rather buy from a local company.
- **A credible origin story.** A Massachusetts software company building tools
  for small businesses is a better and truer positioning than an anonymous SaaS
  with an SF PMB address.
- **A place to dogfood ListSmartly.** Run General Computing Solutions' own
  listings through your own product across the 163-directory register, and the
  case study writes itself — with real numbers, about a real company, which is
  exactly the kind of proof `CONTENT-GAPS.md` says the site is currently
  missing.

---

## 5. What goes where

| Content | Home base | Syndicated to |
| --- | --- | --- |
| Product explainers ("what the business OS does") | Substack | LinkedIn, X, YouTube walkthrough, Google Post |
| Build-in-public / engineering | dev.to | Hacker News, X, Substack |
| Operator playbooks (local growth, messaging, cart recovery) | Substack | LinkedIn, Reddit answers, Pinterest |
| Release notes | Google Post + X | Substack monthly digest, Indie Hackers |
| The V5 launch | Product Hunt | Everything, same day |

**Canonical:** whichever platform you publish to *first* should carry the
canonical tag; dev.to and Hashnode both support `canonical_url`. Publish to
Substack first, syndicate 2–3 days later pointing back. When the V5 blog goes
live, flip the order — publish on flowsmartly.com, and Substack becomes the
newsletter that mails it out.

---

## 6. Launch sequence

Six weeks, and the first four need no new code.

**Week 0 — Settle the entity (§4.2).** Which company is the legal party, and
does the site agree? Everything downstream is a permanent public record, so this
is genuinely first.

**Week 1 — Identity.** Write the §4.3 block. Claim **Google Business Profile**
as General Computing Solutions. Verify Google Search Console. Create Substack,
dev.to, LinkedIn company page, X. Same wording on all of them.

**Week 2 — Seed.** Publish three pieces on Substack before telling anyone it
exists — one product explainer, one build-in-public, one operator playbook. An
empty publication converts nobody; three real posts reads as a going concern.

**Week 3 — Directories.** Submit to Class 4. Batch it: same copy, same assets,
one sitting. Crunchbase and LinkedIn first, they feed the entity graph hardest.

**Week 4 — Turn the machine on.** Wire your own social accounts into FlowSmartly
and start the announcement cadence through your own publisher. Google Posts
weekly. This is also where the dogfooding story becomes true enough to write
about.

**Week 5 — Launch.** Product Hunt, Show HN, BetaList/Peerlist/Uneed, the
founder's own accounts. One day, everything at once. Requires: the site is
honest (see §7), Substack has content, the profiles all exist.

**Week 6 onward — Cadence.** One post a week, one Google Post a week, release
notes as they ship. Ask three real customers for a G2 review.

---

## 7. The traps — off-site edition

Off-site fiction is worse than on-site fiction, because it is permanent and
checkable by anyone.

- **A Crunchbase or directory profile with invented headcount, founding date or
  funding is a public record you cannot quietly edit later.** `CONTENT-GAPS.md`
  already documents the same problem being cleaned off `/company/press`, which
  claimed a $32M raise, 120 staff and 25,000 customers. **None of that goes into
  a directory profile.**
- **Never seed reviews.** G2 and Capterra detect and penalise it, and a caught
  vendor is a permanent search result.
- **Product Hunt is a one-shot.** Launching before the destination is ready
  spends the one day you get.
- **Announcing to a site that contradicts you.** The launch sends people to
  flowsmartly.com; whatever the live site claims about customers and scale is
  what they will read. Reconcile that first.
- **Reddit and HN punish brochure language** faster than they punish having
  nothing to say.

---

## 8. Small product work that makes this repeatable

Each of these serves FlowSmartly's own distribution **and** every customer's —
which is the honest reason to build them rather than doing this by hand.

1. **Add a software/SaaS directory tier to
   `src/lib/constants/listsmartly.ts`** — Capterra, GetApp, Software Advice,
   TrustRadius, AlternativeTo, SaaSHub, Product Hunt, the AI-tool set. The
   register already has the shape (`slug`, `tier`, `category`, `submitUrl`,
   `claimUrl`); this is ~30 rows and a new category. Today the register can list
   a dentist and not a software company.
2. **Add article syndication destinations to the publisher** — dev.to,
   Hashnode and Substack all have APIs and all accept a canonical URL. The
   publisher's `switch` at `publisher.ts:1294` is where a case goes. Turns
   "publish a blog post everywhere with the canonical pointing home" into one
   action, for you and for customers.
3. **A brand-block source of truth** so every profile pulls identical copy —
   the BrandKit model already exists.

None of this blocks §6. Weeks 1–5 run entirely on what is already built plus
manual submissions.

---

## 9. What to measure

- **Referral traffic by source** — which of these actually returned anything.
  Drop the ones that don't after 90 days.
- **Substack subscribers** — the only compounding asset in this document.
- **Assistant citations** — ask ChatGPT, Claude and Perplexity the same ten
  buyer questions monthly and record whether FlowSmartly is named. Class 4 is
  what moves this.
- **Branded search volume** in Search Console — the truest measure of whether
  any of it is landing.

---

## 10. Decisions

1. **Home base — Substack, or something else?** Everything else follows from it.
2. **Founder-named or brand-named?** Founder-led performs better early; it also
   means your name on the posts.
3. **Product Hunt timing** — tied to the V5 site going live, or sooner on the
   current site?
4. **Do we build §8 items 1–2 now** (they help customers too), or run the first
   six weeks manually and build after?
5. ~~Which company is the legal entity?~~ **Answered: General Computing
   Solutions, 132 Lincoln St, Pittsfield MA 01201, is the only one.** Two
   sub-questions remain before the legal pages can be rewritten — the entity
   descriptor ("a Massachusetts LLC"? a corporation? formed where?) and whether
   governing law moves from Delaware to Massachusetts.
6. **Do we run General Computing Solutions' own listings through ListSmartly**
   as the first real case study? Real company, real numbers, and the site
   currently has no proof at all.
