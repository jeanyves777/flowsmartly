---
title: Three themes, and the day white text stopped being readable
description: Our accents get lighter in the dark themes so they read against the page. That decision pushed the white label on every button below the accessibility floor.
topic: Design systems
tone: violet
date: 2026-08-09
author: Jean-Yves Koffi
authorRole: Co-founder & CEO, FlowSmartly
authorAvatar: people/jean-yves-koffi
art: editorial/blog-three-themes
artAlt: One interface shown in a light, a grey and a dark palette side by side
takeaways:
  - A theme is not a colour swap; an accent lightened to work on a dark page stops being able to carry white text.
  - White on our accent measured between 2.0 and 2.9 to 1 in the dark themes, under even the 3:1 floor for large text.
  - Inverting a single ink token fixed roughly 44 call sites without any of them being edited.
  - Build the stylesheet from the theme rather than patching a light one, or this class of bug keeps returning.
---

FlowSmartly ships three themes: light, a neutral charcoal we call **grey**, and a
near-black navy **dark**. Not a light design with a dark mode bolted on — three
palettes, all of them shipping states, all of them expected to look deliberate.

That commitment produced a bug we did not see coming, in the one place nobody
thinks to check.

## The decision that caused it

Our brand blue is `#0878f9`. It is a deep, saturated blue, and it looks right on
a white page.

On a near-black page it does not. A deep blue on a dark ground has almost no
separation from the ground — the button stops reading as a button. So the dark
palettes raise the accent: `brand` becomes `#4f9dff` in grey and dark, a lighter,
airier blue that actually reads against a near-black background.

That is the correct call. It is also the whole problem.

## What it broke

Every primary button on the site painted white text on that accent. In light,
white on `#0878f9` is a comfortable pass. In grey and dark, white on `#4f9dff`
measured between **2.0 and 2.9 to 1**.

For context, WCAG asks for 4.5:1 on body text and relaxes to 3:1 for large text.
Those numbers are below the relaxed floor. Not marginal — under the line that
exists for headlines.

And it was everywhere. Every *Approve*, every *Accept all*, every *Pay*, every
numbered step badge on the site: roughly forty-four call sites, each of them
written correctly, each of them assuming the thing that had stopped being true.

::: violet
Nothing here was a mistake in isolation. Raising the accent was right. White on
the original accent was right. The bug lived in the space between two correct
decisions, which is where most theming bugs live.
:::

## The fix that was not forty-four fixes

The obvious repair is to walk the call sites and pick a colour per theme at each
one. Forty-four edits, forty-four chances to be inconsistent, and a forty-fifth
button next month that nobody remembers to check.

Instead we gave the palette a token whose *meaning* is the answer:

> `textOnBrand` — ink for anything painted **on** a brand or accent fill. It is
> not "white". It is whatever clears 4.5:1 on the fills this particular palette
> uses.

In light it stays white, because light's accents are deep. In grey and dark it
becomes a dark ink, because those palettes' accents are light. Dark ink on a
light fill is simply the correct inversion — and every button already asked for
`textOnBrand`, so all forty-four call sites were fixed without one of them being
opened.

The trade is real and worth naming: the gradient tokens now have to stay light
enough in grey and dark for dark ink to sit on them. They are background-only
tokens, so that costs nothing.

## The rule underneath

The reason this was findable at all is a rule we hold to hard enough to reject
work over:

**Build the stylesheet from the theme. Never write a light stylesheet and patch
it.**

Every component takes tokens and returns styles: `createStyles(tokens, layout)`.
No component owns a colour. If it needed a literal, the design system was missing
something, and the missing thing is the actual bug.

A codebase that patches a light design into darkness has no single place where
"what ink goes on an accent fill" is decided, so the question gets answered forty
-four times, and one of those answers stops being true the moment the palette
moves.

We had one place. Which is why this became a one-line change rather than a
project.
