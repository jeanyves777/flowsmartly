---
title: We let the AI crawlers in, and blocked the ones that don't cite
description: Most sites are choosing between allowing every AI crawler and blocking all of them. Neither is the interesting option. The line worth drawing is attribution.
topic: AI visibility
tone: green
date: 2026-08-09
author: Jean-Yves Koffi
authorRole: Co-founder & CEO, FlowSmartly
authorAvatar: people/jean-yves-koffi
art: editorial/blog-ai-conversations
artAlt: An assistant answering a question and naming its source
takeaways:
  - Blocking every AI crawler also blocks the ones that send visitors and name their sources.
  - The useful line is not AI versus no AI, it is engines that cite versus scrapers that do not.
  - robots.txt grants the permission, ai.txt states the terms, and llms.txt is the summary an assistant can read in one request.
  - Being cited well is a distribution channel, and it rewards page-level structure rather than clever copy.
---

There is a default forming on the web where a site either allows every AI crawler
or blocks all of them, and both defaults are lazy.

Our `robots.txt` names the crawlers individually, and the line it draws is not
about AI at all.

## The list

Explicitly allowed: `OAI-SearchBot`, `ChatGPT-User`, `GPTBot`, `ClaudeBot`,
`Claude-User`, `Claude-SearchBot`, `PerplexityBot`, `Perplexity-User`,
`Google-Extended`, `Applebot-Extended`, `Bingbot`, `DuckDuckBot`.

Explicitly disallowed: `CCBot`, `Bytespider`, `Omgilibot`.

The comment in the file explains the split better than a policy page would:

> Bulk training scrapers that neither cite nor refer traffic. Not a judgement on
> AI — a judgement on attribution.

## Why blocking them all is the expensive option

An answer engine is a referrer. When somebody asks an assistant which platform
handles a job, and the assistant names three and links them, that is the same
event as ranking on a results page — the surface changed, the mechanism did not.

Blocking those crawlers removes you from that answer. It does not protect you
from anything, because the engines that ignore consent were never going to
respect the file. You have declined the visitors and kept the exposure.

The crawlers worth refusing are the ones that take the page and return nothing:
no link, no name, no visitor. That is not a philosophical objection to machine
reading. It is the same deal every publisher has always had with every index —
you may read this if you say where it came from.

::: green
The practical version, for a young site: search engines rank you against fifteen
years of somebody else's backlinks. Answer engines assemble a response from what
they can read *right now*. That asymmetry favours you, and only if they can read
you.
:::

## Three files, three jobs

They get confused with each other constantly, so:

- **`robots.txt`** is permission. Which agents may fetch which paths. It is a
  door, and it answers exactly one question.
- **`ai.txt`** is terms. Ours permits reading, indexing, summarising, quoting
  with attribution and answering user questions, and denies bulk training without
  attribution, verbatim republication and anything presented as an official
  communication from us. It sets `Attribution-Required: yes` and
  `Preferred-Citation: page-level` — cite the page that makes the claim, not a
  summary of the site.
- **`llms.txt`** is the summary. One document that describes what is here and
  where, so an assistant can understand the site in a single request instead of
  crawling forty pages and guessing.

Ours is generated from the export itself, by a script that walks the built output
and writes down the routes that actually shipped. A hand-maintained summary
starts drifting from the site the week after someone writes it.

## What being citable actually takes

Once they are allowed in, the question stops being access and becomes whether
your page is *quotable*. Assistants lift spans. Give them clean spans.

1. **Answer the question in the heading.** A heading that names the question gets
   matched to the question. A clever one does not.
2. **State conclusions in complete sentences.** A claim that depends on the two
   paragraphs above it cannot be lifted, so it will not be.
3. **Structure over voice.** Definitions, numbered steps, comparison tables and a
   real FAQ get extracted. Flowing prose gets skipped.
4. **Publish dates and keep them accurate.** Freshness is an input, and a page
   that lies about it gets treated accordingly.
5. **Say the specific thing.** "Improve your visibility" matches nothing. "How a
   single-location business appears in the map pack" matches a real question
   somebody is really asking.

None of that is a trick. It is the same page, written so the useful part can be
found without reading all of it — which, it turns out, human readers also wanted.
