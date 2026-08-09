# Content that says things we cannot stand behind

Parked deliberately, not overlooked. Recorded here so it is a decision rather
than an oversight, and so nobody has to re-discover it.

The site already has a convention for this: `/status`, `/solutions/domains`,
`/solutions/video-studio` and the footer all label their figures
**illustrative**. The pages below do not, and the highest-stakes ones are
exactly the ones that don't.

---

## `/company/customers` — the whole page

**Status:** untouched, by decision.

Everything on it is invented, and the page says otherwise in as many words —
the hero reads *"Real businesses, real numbers."*

- **Eight statistics**: 25,000+ teams, 90+ countries, 3.2M+ campaigns, 4.9/5
  average rating, 12.4M messages a month, 1.9M calls answered, $1.4B+ pipeline
  influenced, 640K orders processed.
- **Three named customers** with results: Northwind Supply Co. (+32% ROAS in 60
  days), Bright Path Dental (4 hours saved per week), Vantage Analytics (3×
  more qualified leads).
- **Three named people** with photographs and quotes attributed to them —
  Megan Roberts (Head of Growth, Northwind Supply Co.), Carlos Ramirez, and one
  more.

**Why it matters more than the others:** a named company is checkable. Anyone
who searches "Northwind Supply Co." finds nothing, and the named individuals
are stock portraits with words put in their mouths.

**Three ways out**, whenever it comes up the list:

1. Rebuild it as an early-stage page — who it is built for and an invitation to
   be an early customer, with no traction claims.
2. Take the route down along with its Company-nav and footer links, and restore
   it the day there is a real customer to feature.
3. Label it illustrative like `/status` does. Fastest, and consistent with the
   rest of the site — but a photograph of a person with a quote beside their
   name stays a fabricated testimonial however it is labelled.

---

## The legal pages name a company that does not exist

**Status:** confirmed wrong. `public/ai.txt` corrected; the legal pages are
waiting on two answers (below), then they get fixed in one pass.

**General Computing Solutions**, 132 Lincoln St, Pittsfield, MA 01201, is the
only company. FlowSmartly is its product — there is no "FlowSmartly, Inc." The
legal pages say otherwise:

- `legal/terms.tsx:56` — "a binding agreement between you and **FlowSmartly,
  Inc., a Delaware corporation**"
- `legal/privacy.tsx:198`, `legal/gdpr.tsx:152` — names FlowSmartly, Inc. as the
  GDPR **data controller**
- `cookies.tsx:24`, `gdpr.tsx:28` + three siblings —
  `REGISTERED_ADDRESS = '548 Market St, PMB 72224, San Francisco, CA 94104'`, a
  virtual mailbox rather than 132 Lincoln St
- `public/ai.txt:6` — `Owner: FlowSmartly, Inc.`
- (root app) `src/lib/domains/opensrs-client.ts:31` — domains registered to
  `org_name: "FlowSmartly Inc"`

**Why it matters more than the fabricated marketing copy above:** Terms identify
the party that holds the contract, and Privacy/GDPR identify the party that must
answer a data-subject request. If that entity does not exist, neither document
names anyone who can. It also blocks three concrete things — Google Business
Profile verification, A2P 10DLC brand registration, and every permanent
directory listing — all of which key off the real legal name and address.

**The fix**, in one pass, once the two open questions below are answered:

| File | Change |
| --- | --- |
| `public/ai.txt` | ✅ done — Owner is General Computing Solutions, with the Pittsfield address and FlowSmartly named as the product |
| `legal/terms.tsx:56,177` + header comment `:13-14` | Contracting party → General Computing Solutions |
| `legal/privacy.tsx:198-199,372` + header comment `:16-18` | Data controller → General Computing Solutions |
| `legal/gdpr.tsx:152,304` | Controller and DSR contact |
| `legal/cookies.tsx:399`, `legal/sms-terms.tsx:183` | Contact entity |
| `REGISTERED_ADDRESS` in all five legal files | → `132 Lincoln St, Pittsfield, MA 01201, USA`. Five copies of one constant is why they could drift; it should be one shared constant |
| `legal/terms.tsx:167-169` | Governing law and venue — **needs a decision**, see below |

**Still open — neither is a find-and-replace:**

1. **The entity descriptor.** Terms currently read "a Delaware corporation".
   What replaces it — a Massachusetts LLC? A corporation? Formed in which state?
   The sentence cannot be written without it.
2. **Governing law and venue.** Terms §12 chooses Delaware law and New Castle
   County courts because that is where the fictional entity was incorporated.
   With a Massachusetts company that reasoning is gone. The live root app's
   terms (`src/app/(public)/terms/page.tsx:770,774`) choose Delaware too, so
   whatever is decided applies in both places.

**Also found, different problem, recorded so it is not lost:**
`src/lib/domains/opensrs-client.ts:27-38` registers customer domains with a
fallback WHOIS contact of "FlowSmartly Inc, 123 Main Street, New York, NY 10001,
+1.2125551234" whenever a customer's Brand Identity is incomplete. That is
fabricated registrant data on a real domain registration. Substituting the real
GCS address would be worse, not better — it would put GCS's name on customers'
domains. The fix is to refuse the registration until the customer's own details
are complete.

Distribution consequences are worked through in `docs/OFFSITE-PUBLISHING-PLAN.md`
§4.

---

## The Resources wing — partly cleared

**Status:** blog rebuilt on real content; the rest still invented.

**Cleared:**

- **`/resources/blog`** — the six invented posts, the invented author ("Maya
  Patel, Growth Marketing Lead") and "Join 8,000+ growth-minded teams" are gone.
  The archive is generated from `src/content/posts/*.md`, so a card cannot exist
  without a post behind it, and the topic chips are derived from what has
  actually been published.
- **`/resources`** — "240+ articles" and "18 playbooks" removed; the blog count
  is now computed from the index. The six invented featured articles are
  replaced by the real archive, and "What people are reading this month" is
  gone — we have no readership data.
- **`/resources/guides`** — the five invented download counts (4,820 / 7,310 /
  6,140 / 5,275 / 3,960) are removed, along with the "Most popular" sort they
  silently powered. They were never displayed; they only ordered the grid, so
  the page was presenting invented popularity as a ranking.
- **`/resources/changelog`** — the invented releases and dates are replaced by
  six real entries compiled from `src/content/changelog/*.md`, each one
  traceable to a commit. Two claims the page made about itself went with them:
  "Older releases live in the archive" (there is no archive; those six are the
  whole history) and "6 changes across the last four months" (every entry falls
  in one month). Both are now derived from the entries, so neither can drift
  from them again.

**Still invented, and each needs a decision rather than an edit:**

- **`/resources/guides`** — five guides that nobody has written. Either write
  one and let the page hold one, or take the page down until then.
- **`/resources/templates`** — twelve templates that do not exist.
- **`/resources/help-center`** — invented article lists under real category
  names. Blocked on the product surfaces being final.

---

## Testimonials elsewhere

The same pattern is scattered through the product pages — a portrait, a name, a
role and a quote (Megan Roberts appears on `/platform/analytics`, among
others). Each is a person who does not exist saying something they did not say.
Lower stakes than a whole page of them, same class of problem.

---

## Already resolved, for reference

- **`/company/press`** — five headlines under named trade titles, including
  *"FlowSmartly raises $32M"*, plus a "cleared for publication" fact sheet
  giving a founding year, a headquarters, 120 staff across 22 countries,
  25,000+ customers and a $48M Series B. All removed; the fact sheet now lists
  only what is true.
- **`/company/about`** — a 2019-to-2024 company history and a five-figure
  traction band. Both sections removed.
- **Leadership** — four invented colleagues on `/company/about` and two on
  `/company/press`, beside the real founder. Both grids are down to the one
  person who has been confirmed.
