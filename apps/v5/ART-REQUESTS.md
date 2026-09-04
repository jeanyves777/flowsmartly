# Art the site references but does not have

This repo never generates, downloads or fabricates an image — every
photographic and illustrated asset is made by the user. When a build needs art
that does not exist yet, the reference is written against the name it *should*
have and the request is recorded here, with enough of a brief to produce it.

Delete a row once the file lands.

---

## `public/og-default.png` — the social unfurl card

**Status:** referenced by every page, does not exist. Until it lands, every
link shared to LinkedIn, Slack, iMessage, X or WhatsApp unfurls with no image,
and the `og:image` tag on all 44 routes points at a 404.

**Where it is used:** `SITE.ogImage` in `src/components/public/seo.tsx`, which
fills `og:image` and `twitter:image` on every route.

**Exact size:** 1200 × 630 px, PNG. That is what the `og:image:width` and
`og:image:height` tags already declare, and what LinkedIn and X crop to.

**Brief:** the brand card, not a screenshot. Deep brand-blue ground (the
`icon.png` blue), the FlowSmartly mark, and the positioning line **"The AI
Business Operating System"** set large enough to survive a 400px-wide preview
in a chat app. Keep every element inside a 60px safe margin — Slack and
iMessage crop the edges. No product UI, no small text, no figures: an unfurl
card is read at a glance and at a quarter of its size.

**Prompt, if generated:** *A wide 1200×630 brand card on a deep blue gradient
ground with a subtle grid texture, a soft white chevron mark on the left, and
the words "The AI Business Operating System" in a bold white geometric
sans-serif on the right. Clean, corporate, high contrast, generous margins, no
photograph, no interface, no clutter.*

**When it arrives:** drop it at `apps/v5/public/og-default.png`. Nothing else
needs changing — the tags already point at it.

---

## `editorial/blog-three-themes` — blog lead image

**Route:** `/resources/blog/three-themes-and-unreadable-white`, and the card for
it on `/resources/blog` and `/resources`.

Referenced but not registered, so it renders the branded placeholder until the
file lands. Everything around it is finished; this is the only gap.

**Brief:** the same interface shown three times — light, charcoal grey, and
near-black navy — as three overlapping panels, so the point of the piece (one
design, three shipping states) is legible at card size. The article is about a
button label going unreadable, so give one panel a visible primary button.
Abstract product surface rather than a real screenshot: it sits beside real
screenshots elsewhere and must not be mistaken for one.

**Prompt, if generated:** *Three overlapping abstract app panels fanned left to
right, the first on a white ground, the second on a neutral dark charcoal, the
third on a near-black navy, each showing the same simplified card layout with a
single blue primary button. Clean vector illustration, soft shadows, generous
margins, no text, no photograph.*

**When it arrives:** drop it at
`assets/images/v5w/editorial/blog-three-themes.webp` and add the one line to
`REGISTRY` in `media.tsx`. Nothing else changes — the post already names it.

The other three launch posts reuse art that already exists
(`editorial/press-kit`, `editorial/blog-ai-conversations`,
`editorial/guide-playbook-spread`). As the archive grows, each new post either
picks a fitting existing piece or gets an entry here.

---

## Per-page unfurl cards — optional, later

`Seo` takes `image` and `imageAlt`, so any route can override the default card
once there is art worth overriding it with (a pricing card, a FlowAgent card).
Not blocking: the default card covers every route until then.
