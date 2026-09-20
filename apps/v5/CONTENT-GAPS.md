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

## The legal pages named a company that does not exist — fixed

**Status:** resolved. One item below is worth a lawyer's eye; nothing is untrue
any more.

**General Computing Solutions**, 132 Lincoln St, Pittsfield, MA 01201, is the
only company. FlowSmartly is its product. There is no "FlowSmartly, Inc."

The model is Claude and Anthropic: the product is what the interface is about,
and the company is named where it legally has to be — the contracting party,
the data controller, the address on a contact card — and nowhere else. GCS
appears in exactly two places in this app now:
`components/public/legal-page.tsx` (one shared definition the five legal pages
import) and `public/ai.txt` (the machine-readable ownership record). It is
deliberately absent from the header, the footer, the company pages and every
product surface.

**What changed:**

| Was | Now |
| --- | --- |
| "a binding agreement between you and **FlowSmartly, Inc., a Delaware corporation**" | "…between you and **General Computing Solutions**, the company that provides FlowSmartly" |
| **FlowSmartly, Inc.** as GDPR data controller (`privacy`, `gdpr`) | General Computing Solutions |
| Privacy covered "FlowSmartly **and its affiliates**" | just FlowSmartly — there is no group |
| `REGISTERED_ADDRESS` = `548 Market St, PMB 72224, San Francisco` — **five separate copies**, one per route | `132 Lincoln St, Pittsfield, MA 01201, USA` — **one** exported constant. Five copies is precisely how they were free to drift |
| Delaware law, courts of New Castle County | the Commonwealth of Massachusetts, and courts in Massachusetts |
| `public/ai.txt` owner | General Computing Solutions, with the address, FlowSmartly named as the product |

**The one item worth confirming with counsel:** the governing-law and venue
change in `legal/terms.tsx` §12. Delaware was chosen there *because* the
fictional entity was said to be incorporated there; with a Massachusetts company
that reasoning is gone, so it now points at Massachusetts. That is a defensible
default, not a legal opinion. Note the live root app's terms
(`src/app/(public)/terms/page.tsx:770,774`) still choose Delaware — the two
should agree.

The terms deliberately do **not** state an entity type or state of formation.
"General Computing Solutions, the company that provides FlowSmartly, with its
principal place of business at 132 Lincoln St" is complete and true without
asserting a corporate form nobody has confirmed. Add the descriptor when it is
known; nothing else has to change.

---

## Domain registrations were filed under the same fictional company — fixed

**Status:** resolved, and it changes product behaviour. Worth knowing about.

`src/lib/domains/opensrs-client.ts` carried a `DEFAULT_CONTACT` that every
missing registrant field silently fell back to: **"FlowSmartly Inc, 123 Main
Street, New York, NY 10001, +1.2125551234"**. `src/lib/domains/renewal.ts`
passed no contact at all, so every retried registration went in under it, and
`contactFromBrandKit` invented the same address for anyone whose Brand Identity
was incomplete.

That is fabricated data in a public WHOIS record. Substituting the real company
would have been worse — it is the customer's domain, so the registrant is the
customer, never us. ICANN requires registrant data to be accurate, and a domain
registered with invented details can be suspended, which loses the customer the
domain they paid for.

There is no fallback now. `assertCompleteRegistrant` refuses the call and names
the missing fields in language the person who has to fix it can act on, and the
retry path looks up the owner's real details. **A registration that previously
"succeeded" with invented details will now fail with a clear message** — which
is the correct outcome, and the reason it is recorded here.

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
