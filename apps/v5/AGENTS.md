# FlowSmartly V5

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

---

## The one rule above all others: V5 is a clean room

**Never mix any previous version into V5, and never push V5 into a previous version.**

V5 is a fresh direction, not an evolution. The repository root holds the older
system (a Next.js app: `src/app`, `src/components`, the `/home` agent shell, the
legacy public site, and the `design/*.html` mockups that belong to those
versions). That work continues to ship on its own. It is not a source of truth
for anything in here.

Concretely, inside `apps/v5`:

- **Do not import, copy, port or adapt** components, styles, hooks, tokens or
  markup from the root app. Not "as a starting point", not "just the logic".
- **Do not link to** a legacy route, and do not treat a legacy screen as the
  destination for a V5 CTA.
- **Do not reach for an old mockup** in `design/` to decide how a V5 surface
  should look. V5 has its own design language, described below.
- **Do not carry a naming or architectural convention over** because "that is
  how the old app does it". If the old app and this document disagree, this
  document wins.
- Equally: **do not modify the root app** to solve a V5 problem, and do not
  back-port V5 modules into it. They are separate products with separate
  release paths.

If something genuinely needs to exist in both, it gets written twice —
deliberately — rather than shared. Coupling the two is the failure mode this
rule exists to prevent.

---

## Image assets are always the user's to make

**Never generate, download or fabricate an image.** The user produces every
photographic and illustrated asset themselves. When a design calls for art you
do not have:

1. Reference it through `<Media name="…" alt="…" />` with the name it *should*
   have. Unregistered names render a deliberate branded placeholder, so the
   layout can be finished and reviewed without the art.
2. Do **not** add it to the `REGISTRY` in `media.tsx` — that is done in one line
   once the file actually lands.
3. Record the new name and write a prompt for it in `ART-REQUESTS.md`, so the
   user can produce it. A missing asset that nothing records is a missing asset
   nobody knows about — `og-default.png` was referenced by all 44 routes and
   404ed on every one of them for as long as it went unwritten.

The only exception is a real third-party trademark, which is *sourced* rather
than generated — always via `BrandLogo`, never drawn by hand.

Resizing an asset the user already made is not generating one. The favicon set
(`scripts/icons.js`) is every size a browser, a phone and a crawler ask for,
all resized from the single `assets/images/icon.png`.

## Philosophy

**Tokens, one scale, one breakpoint system.** Every colour, size and threshold
comes from a shared module. A section that invents its own is a bug, even if it
looks right today — that is exactly how the first pass ended up with 400 colour
literals, eleven body-text sizes and seven competing breakpoints that made
neighbouring sections disagree about when to stack.

**Three themes are first-class, not a skin.** Light, `grey` (a true dark
charcoal, neutral) and `dark` (near-black navy) are all shipping states. Build
the stylesheet *from* the theme; never write a light stylesheet and patch it.

**Every breakpoint is designed, not derived.** Write the layout each breakpoint
needs. Do not layer a "mobile override" on top of a desktop rule and hope the
cascade resolves it.

**Illustrations are measured, not faked.** Diagram connectors are real geometry
drawn between measured nodes. Fixed-width dashed borders and text arrows detach
the moment anything resizes.

**Motion is decoration, never load-bearing.** The page must be complete and
readable with JavaScript disabled and with `prefers-reduced-motion` set. Every
animated element therefore *renders in its finished state* and only hides
itself afterwards, on the client.

**Nothing is done until it has been looked at.** Type-checking is not
validation. Build, screenshot, and open the image.

---

## The rules that follow from it

1. **No hardcoded colours.** `useTokens()` only. The single exception is an
   official third-party brand hex (Instagram pink, YouTube red…), and it must
   go through `brandColor(hex, t)` so near-black marks stay visible on dark.
2. **Build styles from the theme:**
   `const styles = useMemo(() => createStyles(t, l), [t, l])`. Never a
   module-level `StyleSheet.create` with colours baked in.
3. **Never use the `flex: <number>` shorthand.** react-native-web expands it to
   `flexBasis: 0%`; any later override that sets `flexGrow`/`width` but not
   `flexBasis` collapses the element to nothing. Spell out `flexGrow`,
   `flexShrink` and `flexBasis`, and put `minWidth: 0` on any flex child holding
   text.
4. **One breakpoint scheme** — `useLayout()` from `@/theme/use-responsive`. No
   `useWindowDimensions`, no `width < 1180` in a component.
5. **No fixed `minHeight` on a section.** Let content size it; use `gap` for
   rhythm. Fixed heights become dead space the moment the layout stacks.
6. **No text below 11px. No touch target below 44px.**
7. **The logo lives in the header and the footer.** Never inside a content
   section.
8. **The orange swoosh on the growth CTA is the signature.** Its colours are
   deliberately theme-invariant, like the logo.
9. **Never place a transform between a `ConnectorSurface` and the nodes it
   measures.** The overlay measures with `getBoundingClientRect`, which includes
   transforms — a per-tile reveal, or a `scale` on a wrapper, detaches every
   wire. Wrapping the whole section in a translate-only reveal is fine.
10. **Cards in a row are one height, with their CTA on a shared baseline.** Give
    the card `flexGrow: 1` inside its cell and push the button down with a
    `{ flexGrow: 1 }` spacer — never let three cards of different copy lengths
    end at three different heights.
11. **A multiline `TextInput` needs an explicit `height`**, not just
    `minHeight`. On web it otherwise collapses toward one line and the fields
    around it overlap. Pair it with `textAlignVertical: 'top'`.
12. **Rows of small facts need a real layout, not a squeeze.** A row like
    thumbnail + SKU + name + stock + price + badge has no room on a 390px
    phone: stack it, drop the least important field, or give each part its own
    line. Overlapping text is always a layout bug, never a font-size problem.
13. **Never fake a third-party logo.** Use `BrandLogo`, which resolves the real
    mark from FontAwesome6 then simple-icons. Brands neither carries fall back
    to a labelled monogram — that is deliberate; do not replace it with a drawn
    look-alike.
14. **Static rendering has no window.** The first client render must repeat the
    server's assumption and adopt reality in a layout effect, or React discards
    the server tree (hydration #418) and the visitor sees a flash of the wrong
    layout. `useLayout()` already handles this; do not bypass it.
15. **Public-page sections are open by default; cards are for the objects
    inside one.** A section gets a border, a radius or a card background only
    when the container *is* an interactive object, a distinct product surface,
    or grouped data. So: dashboard previews, pricing plans, testimonials and
    workflow steps keep their box — headings, intros, feature narratives,
    positioning, safety copy, logos and diagrams do not.

    Reach for `useOpenSection()`/`<OpenSection>` (gutter + `l.sectionSpace`,
    nothing else) or `<Band tone>` (the same, on a full-bleed ground) from
    `components/public/ui`. There is no card-shell section component any more:
    `Section`/`useSectionShell` were deleted once every route was converted,
    because a page built entirely from them is exactly the "dashboard under a
    hero" look this rule exists to prevent.

    Rhythm comes from soft alternating grounds, not from boxing things. A
    route's sections run open (hero) → two tinted bands → open, with `BandTone`
    cycling so no two adjacent bands share a hue. The accent tones are a much
    weaker wash than `softFill` (5% light / 9% dark) — felt, not seen. Bands
    escape the `BP.maxContent` column with a *measured* negative margin (see
    `bandBleed`) so they reach the viewport edge while their text stays on the
    same gutter as the open section above; a flat overrun would leave the
    scroll container reporting phantom width at every viewport.

    Illustration has exactly **two zones**, and they are different jobs. The
    mistake worth not repeating is treating them as one:

    - **The separator, on the dividing line between two sections.**
      `<SectionArt>`, drawn by the section *below* the seam and pulled up half
      its own height so it straddles the boundary and reads across both.

      **It has to be drawn by the lower section.** A decoration authored on the
      upper section and hung downwards is painted before the next section's
      background, so an opaque ground clips it and half the drawing vanishes —
      which is exactly what "it must be over both sections, not hidden" means.

      **Every boundary gets one.** `art` used to be opt-in and two boundaries in
      five had nothing crossing them, which reads as the page having stopped.
      `SectionSequence` in `PageShell` numbers the top-level sections and each
      one draws a default separator; a route only writes `art` when it wants a
      particular variant. Index 0 is skipped — a hero's top edge is the header.
      Number the sections *by position*, not with a running counter: a hero
      built from a `Reveal` never goes through `OpenSection`, so a counter left
      it unnumbered and the section after it silently lost its separator.

      **Its height is bounded by the padding on both sides**, not chosen.
      `1.5 x sectionSpace` is the largest value that measured clean on all 44
      routes; twice the padding is the theoretical ceiling and grazed copy on
      nine of them, because sections that override their own padding make the
      real gap smaller. A section that declares a compact padding skips its
      separator automatically; the one case a section cannot work out — the
      section *above* being the compact one — is `art="none"`.

    - **A composition filling a genuinely empty area of a layout.** A different
      job, with nothing to do with the seam: it only has to be large enough to
      occupy the hole it is placed in. `SectionAside` is the seat for it and
      currently draws nothing, because the empty areas have not been measured
      and sized for. Do not let it drift back into being a second separator —
      that produced a full-width wave inside a section, duplicating the seam
      below it and marking a boundary in the wrong place.

    Nothing goes behind the content. Five earlier attempts did — a composition
    behind the copy collided with headings; a version keyed to "sections
    without an `<Image>`" landed on the connector diagrams; an outline tracing
    each section is a border, not an illustration; `Band` shipped without the
    reserve `OpenSection` had; and a full-width band anchored inside a section
    was both clipped by the next ground and duplicated by its strip. Real
    product imagery always wins.

    **These are detectors, not opinions.** Intersect every decoration with
    every text run and image (`no aside sits on content`), and intersect
    decorations with each other (`no seam carries two decorations`). Include
    full-width decorations in the first one — excluding them by width is why
    the separators went unchecked for so long. Run both after any change to
    section padding.

---

## What exists

`apps/v5` is an Expo SDK 57 app (React Native 0.86, react-native-web 0.21,
expo-router, static web export). So far it implements **the public marketing
page** only.

**Foundation — treat as shared infrastructure, change deliberately:**

| Module | Provides |
| --- | --- |
| `src/theme/tokens.ts` | `ThemeTokens`, the three palettes, `brandColor`, `elevation`, `hexToRgba`, `softFill` |
| `src/theme/use-responsive.ts` | `BP` (phone 640 / tablet 1024 / split 1120 / desktop 1440 / maxContent 1536), `useLayout()`, the SSR hydration gate |
| `src/theme/v5-theme-provider.tsx` | `useTokens()`, `useV5Theme()`, light → grey → dark cycling |
| `src/components/public/ui.tsx` | type scale, `PrimaryButton`/`SecondaryButton`, `ButtonRow`, `SectionLabel`, `Section`/`useSectionShell`, `Card` |
| `src/components/public/connectors.tsx` | measured SVG connector overlay: `useConnectorField`, `Connectors` (with flowing dots), `ArrowLink`, `ConnectorSurface` |
| `src/components/public/motion.tsx` | `Reveal`, `Stagger`, `useCountUp`, `useGrowIn`, `useInView`, reduced-motion handling |

**Page sections:** `src/app/index.tsx` (header, hero, Growth Command Center
dashboard, FlowShop, Customer Intelligence) plus
`src/components/public/{call-agent,listsmartly,connected-channels}-section.tsx`
and `v5-footer.tsx` (outcomes + testimonial, pricing, growth CTA, footer nav).

---

## Validating a change

```bash
cd apps/v5
npx tsc --noEmit                 # type gate
npx expo export -p web           # ~90s, writes dist/
python -m http.server 8092 --directory dist
```

Then screenshot **390 / 768 / 1024 / 1280 / 1536 / 1920 × light / grey / dark**
and look at every one. Reference captures live in `qa-v5/`.

Things that have bitten this page before and are worth re-checking after any
layout work:

- horizontal overflow at 390 (the page rendering wider than the viewport)
- a wrapped grid leaving one stretched orphan card
- text ellipsizing at a *wider* viewport than one where it fits. A mock panel
  that sits beside a second panel inside a split hero is the usual culprit: it
  is ~264px at 1120 and only ~400px at 1920, so a three-up stat grid inside it
  clips at *every* desktop width while looking fine on a phone. Detect it by
  script rather than by eye — but note that `numberOfLines` compiles to
  `-webkit-line-clamp` and `overflow: hidden`, **not** `text-overflow:
  ellipsis`, so a detector keyed to `text-overflow` reports a clean sweep on a
  page full of cut text; and `useCountUp` runs for ~1.2s after a stat scrolls
  into view, so anything measured before it settles reports a few px of
  phantom clamp overflow on every animated number
- a section that stacks while its neighbour does not
- white cards or navy-on-navy text surviving in dark/grey
- connector wires missing their target or stranding an end dot
- capture artefacts: `expo-image` lazy-loads, so scroll the page before
  screenshotting or below-the-fold art comes out blank
