---
title: We rebuilt the site instead of redesigning it
description: The previous pass ended with 400 colour literals, eleven body-text sizes and seven competing breakpoint systems. Neighbouring sections disagreed about when to stack.
topic: Behind the build
tone: brand
date: 2026-08-09
author: Jean-Yves Koffi
authorRole: Co-founder & CEO, FlowSmartly
authorAvatar: people/jean-yves-koffi
art: editorial/guide-playbook-spread
artAlt: A design system laid out as a set of measured pages
takeaways:
  - Four hundred colour literals and seven breakpoint systems is not a styling problem, it is an absence of a system.
  - Connectors drawn between measured nodes survive a resize; fixed-width dashed borders do not.
  - Thirty-eight decorations placed by eye all landed on live copy, one of them 78 pixels deep.
  - A detector keyed to the wrong CSS property reported a clean sweep on a page full of clipped text.
---

The honest summary of the previous site is that it looked fine and could not be
changed safely.

Four hundred colour literals. Eleven distinct body-text sizes. Seven competing
breakpoint schemes, which meant two sections next to each other genuinely
disagreed about the width at which they should stack — and both were right,
because each had its own definition.

That is not a tidiness complaint. It is what a design system's absence looks like
from the inside: every change is local, no change is safe, and the only way to
know whether you broke something is to look at all of it.

## What replaced it

Three rules, and everything else follows from them.

**Every colour, size and threshold comes from one module.** A section that
invents its own is a bug even when it looks right, because looking right today is
how you get four hundred literals. One token set, one type scale, one breakpoint
hook.

**Every breakpoint is designed, not derived.** Write the layout each width
actually needs. Do not stack a mobile override on a desktop rule and hope the
cascade resolves it — that is how you end up with text that ellipsizes at a
*wider* viewport than one where it fits, which sounds impossible until you meet
it.

**Motion is decoration, never load-bearing.** Every animated element renders in
its finished state and only hides itself afterwards, on the client. The page is
complete with JavaScript disabled and with reduced motion set, because those are
real visitors, and because a crawler that does not run scripts should still see
the words.

## Illustrations are measured, not faked

The diagrams on the site draw connectors between nodes. The tempting way to build
one is a dashed border of a fixed width and a text arrow — it takes ten minutes
and looks correct in the design.

It detaches the moment anything resizes. Different font, different language,
different zoom: the wire now ends in empty space next to the box it was pointing
at.

So connectors are real geometry. The overlay measures the actual nodes and draws
between the coordinates it gets back. This costs more, and it comes with a rule
worth writing on the wall:

::: brand
Never place a transform between the connector surface and the nodes it measures.
Measurement includes transforms, so a per-tile reveal animation or a scale on a
wrapper detaches every wire at once.
:::

## The thirty-eight illustrations that sat on the copy

We have a component that puts an illustration into empty space inside a section.
The first placement pass was done the reasonable way: look at the layout, notice
the heading column is narrow, conclude the right side is free.

Thirty-eight placements were made that way. Every one of them landed on live text
— by 78 pixels in the worst case.

The layout *looks* like it has a hole. It does not have one at the width you
support least. A gap that is 620 by 200 at 1440 is smaller at 1120, and the
illustration does not know that.

Now a placement is only allowed where a hole has been rasterised and measured, at
the tightest width, and a page with no hole gets no illustration. That last part
was the hard bit to accept: a page with nowhere to put a decoration is finished,
not unfinished. Adding whitespace to a working layout so a drawing has somewhere
to live is backwards.

## The detector that was confidently wrong

Because looking at every page at every width in every theme is not something a
person does reliably, we wrote detectors: scripts that intersect every decoration
with every text run and image, and every decoration with every other one.

The first version of the clipped-text detector reported a clean sweep. The page
it swept was full of cut text.

`numberOfLines` compiles to `-webkit-line-clamp` and `overflow: hidden` — **not**
`text-overflow: ellipsis`. The detector was keyed to `text-overflow`, so it
looked for a property that was never going to be set and found nothing, which it
reported as success.

There is a second one in the same family: a count-up animation runs for about
1.2 seconds after a statistic scrolls into view, so anything measured before it
settles reports phantom overflow on every animated number on the page.

A detector that reports success is not evidence. A detector that has been shown a
known failure and caught it is evidence. We now start by breaking the page on
purpose.

## Why a clean room, and not an evolution

The V5 site does not import, adapt or link to anything from the previous system,
in either direction, and that is enforced rather than encouraged.

Sharing "just the logic" is how the old conventions travel. One import brings a
component; the component brings a colour literal; the literal brings the
assumption that there is one theme. If something genuinely needs to exist in
both, we write it twice, deliberately, and accept the duplication as the price of
not coupling two products with separate release paths.

The rule we actually check work against is simpler than any of this, and it is
the one most often skipped:

> Nothing is done until it has been looked at. Type-checking is not validation.
> Build it, screenshot it, and open the image.
