# Art the site references but does not have

This repo never generates, downloads or fabricates an image — every
photographic and illustrated asset is made by the user. When a build needs art
that does not exist yet, the reference is written against the name it *should*
have and the request is recorded here, with enough of a brief to produce it.

Delete a row once the file lands.

---

## `assets/images/v5w/people/jean-yves-koffi.webp` — the founder's portrait

**Status:** referenced by `/company/about` and `/company/press`, not in the
repo. Until it lands both cards render the branded placeholder, which is the
correct interim state — the card previously carried a stock portrait of
somebody else under the CEO's name, and a photograph of one person labelled as
another is not a placeholder, it is wrong.

**The user has the photo.** It only needs saving into the repo:

    apps/v5/assets/images/v5w/people/jean-yves-koffi.webp

Then one line in `REGISTRY` in `src/components/public/media.tsx`, beside the
other portraits:

    'people/jean-yves-koffi': require('../../../assets/images/v5w/people/jean-yves-koffi.webp'),

**Format:** WebP, square, to match the rest of the row — the existing
portraits are ~14KB each, so export at roughly 512x512 rather than the full
1024. The card crops to a square, so keep the head centred with a little room
above it.

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

## Per-page unfurl cards — optional, later

`Seo` takes `image` and `imageAlt`, so any route can override the default card
once there is art worth overriding it with (a pricing card, a FlowAgent card).
Not blocking: the default card covers every route until then.
