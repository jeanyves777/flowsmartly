---
title: We deleted the numbers that made us look successful
description: A pass through our own marketing site removed a $32M funding round, 120 staff across 22 countries, 25,000 customers and six colleagues. None of them existed.
topic: Behind the build
tone: orange
date: 2026-08-09
author: Jean-Yves Koffi
authorRole: Co-founder & CEO, FlowSmartly
authorAvatar: people/jean-yves-koffi
art: editorial/press-kit
artAlt: A press page with most of its claims struck out
featured: true
takeaways:
  - A fabricated customer count is checkable, and a named customer is checkable by anyone who searches the name.
  - Placeholder marketing copy survives because nobody re-reads a page after it ships.
  - Labelling a figure illustrative works for a product mockup and does not work for a testimonial with a photograph beside it.
  - We keep the unfinished part of the audit in a file in the repo, so what is left is a decision rather than an oversight.
---

Our press page used to carry five headlines under the names of real trade
publications. One of them announced that FlowSmartly had raised $32 million.
Below the headlines sat a fact sheet, marked *cleared for publication*, giving a
founding year, a headquarters, 120 staff across 22 countries, 25,000+ customers
and a $48M Series B.

Every number in that paragraph was invented. So were the headlines, and so were
the publications' interest in us.

## What was actually on the site

The press page was the worst of it, but it was not alone.

- **`/company/about`** carried a 2019-to-2024 company history and a band of
  five-figure traction statistics. The company did not do those things in those
  years.
- **Leadership** showed four colleagues on the about page and two more on the
  press page, standing beside the one real founder. Six people who do not exist,
  with portraits and titles.
- **`/company/customers`** — still the largest single concentration — carries
  eight statistics, three named customer companies with results attached, and
  three named individuals with photographs and quotes.

The history, the traction band, the invented press coverage and the invented
colleagues are gone. Both leadership grids are down to the one person who has
been confirmed.

## Nobody sat down and decided to lie

This is the part worth saying plainly, because it is the part that generalises.

A design pass needs words in every slot. You are building a press page, so you
write what a press page contains: a headline, a publication, a figure. You are
building a leadership grid, so you fill the grid. The copy is scaffolding — it
exists to prove the layout works, and everyone involved knows it is scaffolding
at the moment they write it.

Then the layout ships, and the scaffolding ships with it, and nobody re-reads a
page that already looks finished. The gap between "this is placeholder" and
"this is a public claim about our company" is one deploy and about four minutes
of attention.

::: orange
The tell is specificity. Nobody invents "some customers" — invention produces
25,000+, 4.9 out of 5, $1.4B influenced. Placeholder copy is confident, because
confident copy is what makes a layout look right.
:::

## Why a named customer is worse than a big number

An inflated statistic is dishonest and vague. A named company is dishonest and
**checkable**.

Anyone who reads a case study and searches for the customer finds nothing. That
is not a small credibility problem discovered by a diligent minority — it is the
exact behaviour of the one visitor you most want, the one who is far enough down
the funnel to verify a claim before bringing it to their boss.

The same goes double for a person. A stock portrait, a name, a job title and a
sentence in quotation marks is a fabricated testimonial. It stays a fabricated
testimonial no matter what disclaimer sits under it.

## The rule we ended up with

The site already had a convention for uncertain figures, and it works: `/status`,
`/solutions/domains`, `/solutions/video-studio` and the footer all mark their
numbers **illustrative**. A product mockup showing a dashboard needs numbers in
it, and saying so is honest and sufficient.

What we learned is where that convention stops:

1. **A mockup can be illustrative.** It is a drawing of software, and the figures
   in it are obviously a sample.
2. **A statistic about the business cannot be.** "25,000 customers (illustrative)"
   is not a disclosure, it is a sentence that has given up.
3. **A person can never be.** A photograph with a name and a quote is a claim
   about a human being, and a label underneath does not unmake it.

## What is still on the list

The audit is not finished. `/company/customers` is still standing, and the
scattered testimonials on the product pages are still there.

Both are recorded, in the repository, in a file that exists so that anything left
undone is a decision somebody made rather than something everybody forgot. The
options are written down next to each entry: rebuild the page as an honest
early-stage page, take it down until there is a real customer to feature, or
label it and accept that labelling does not fix the portraits.

We would rather publish that the list is unfinished than publish a page implying
it never existed. A company with no customer numbers yet is an early company.
A company with invented ones is a different kind of company entirely, and the
difference is worth more than the numbers were.
