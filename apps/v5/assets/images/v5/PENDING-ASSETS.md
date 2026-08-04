# Pending image assets

Ten assets are referenced by the pages but not yet produced. Each one currently
renders the branded `<Media>` placeholder, so the layouts are finished and
reviewable — the art drops in without any further layout work.

**To add one:** save the PNG at the path below, then add a single line to
`REGISTRY` in `src/components/public/media.tsx`:

```ts
'scenes/careers-team': require('../../../assets/images/v5/scenes/careers-team.png'),
```

House style for consistency with the existing set: soft 3D corporate
illustration on a very light lavender background, blue/violet with orange
accents, soft gradients, no text, no lettering, no logo — for the `editorial/`
items. Photographic, natural light, muted neutral grade — for the `scenes/`
items.

---

## scenes/ — photographic

### 1. `scenes/careers-team.png` — Careers hero (landscape 16:9)
> A small modern software team working together in a bright open-plan office —
> four people around a standing desk with laptops, one pointing at a screen,
> large windows with soft daylight, plants, warm neutral colour grade. Candid
> and unposed, natural business lifestyle photography, shallow depth of field.
> Landscape 16:9. No text, no watermark, no logo.

### 2. `scenes/careers-culture-1.png` — pairing (square 1:1)
> Two colleagues pair-programming at a shared desk, one at the keyboard and one
> leaning in pointing at the screen, warm daylight from a side window. Candid
> workplace photography, shallow depth of field, muted neutral palette.
> Square 1:1. No text, no watermark, no logo.

### 3. `scenes/careers-culture-2.png` — remote call (square 1:1)
> A person at a tidy home desk on a video call, laptop screen showing a grid of
> colleagues (faces small and indistinct), notebook and coffee beside them, soft
> window light. Candid remote-work photography, muted neutral palette.
> Square 1:1. No text, no watermark, no logo.

### 4. `scenes/careers-culture-3.png` — team offsite (square 1:1)
> A team of eight sitting around one long wooden table at an offsite, mid
> conversation and relaxed, sunlight through tall windows, plants and coffee
> cups. Candid group photography, warm neutral grade.
> Square 1:1. No text, no watermark, no logo.

---

## editorial/ — soft 3D illustration

### 5. `editorial/customer-story-1.png` — e-commerce (landscape 16:10)
> A soft 3D isometric illustration of an e-commerce growth dashboard: a rounded
> glass panel with a rising bar chart, a small shopping bag and a floating
> price tag. Palette: blue and violet with an orange accent on a very light
> lavender background. Clean corporate-illustration style, soft gradients,
> no text, no numbers, no logo. Landscape 16:10.

### 6. `editorial/customer-story-2.png` — local service business (landscape 16:10)
> A soft 3D isometric illustration of a simplified clinic reception desk with a
> calendar card and a phone handset floating above it, a map pin to one side.
> Palette: blue and violet with an orange accent on a very light lavender
> background. Clean corporate-illustration style, soft gradients, no text,
> no logo. Landscape 16:10.

### 7. `editorial/customer-story-3.png` — B2B SaaS (landscape 16:10)
> A soft 3D isometric illustration of a funnel turning small contact cards into
> a rising line chart, with a paper plane leaving the top. Palette: violet and
> blue with an orange accent on a very light lavender background. Clean
> corporate-illustration style, soft gradients, no text, no logo.
> Landscape 16:10.

### 8. `editorial/press-kit.png` — Press (landscape 16:10)
> A soft 3D illustration of a press-kit spread: a stack of rounded cards fanned
> out — one showing an abstract logo mark, one a device screenshot, one a
> colour palette strip — floating on a very light lavender background with soft
> shadows. Palette blue/violet with an orange accent. Clean
> corporate-illustration style, no readable text, no lettering, no real logo.
> Landscape 16:10.

### 9. `editorial/security-shield.png` — Security hero (near-square, ~1:1)
> A soft 3D illustration of a shield with a check mark at the centre of three
> concentric rounded layers, a small padlock and a key floating beside it.
> Palette: blue and violet with an orange accent on a very light lavender
> background. Clean corporate-illustration style, soft gradients, no text,
> no logo. Square 1:1 with a little vertical breathing room.

### 10. `editorial/template-library.png` — Templates hero (landscape 16:10)
> A soft 3D illustration of a library of templates: six rounded cards fanned in
> a shallow arc, each showing abstract grey placeholder lines and a small
> coloured block, one lifting forward. Palette: blue and violet with an orange
> accent on a very light lavender background. Clean corporate-illustration
> style, soft gradients, no readable text, no logo. Landscape 16:10.
