# The hero domain search — what the backend owes it

**For the backend session.** Written 2026-09-16 alongside the change that turned the
domains hero from an illustration of a search box into a working one.

The owner's brief:

> _"Build in the public page for domain name — we need it to look like, at the hero
> section, like a domain name search so people can freely check domain names, and that can
> get them to signup just for domain name service."_

---

## What ships today

`apps/v5/src/app/solutions/domains.tsx` → `DomainSearch`.

Somebody types a name and instantly sees it across `.com`, `.co`, `.shop` and `.org`,
with this page's own published first-year price beside each — read from `TLD_ROWS`, not
from a second list. Each row offers **Check & claim**, which is `goToEarlyAccess()`.

Before anybody types, the card draws the example rows the page shipped with, under a line
saying it is an example. A hero that opens as an empty box shows a visitor nothing.

## 🛑 What it deliberately does NOT say

**It never prints _Available_ against a name somebody searched for.** Nothing in this
product reaches a registrar, so that word would be an assertion nobody checked. A
marketing page that tells a visitor a name is free, takes their card, and then finds it is
not has spent the only trust it had.

The word is still used — but only on the four **example** rows, which are labelled as an
example.

## What would make the check real

```
a registrar availability lookup    given a name and a set of extensions, which are
                                   free, which are taken, and which are premium
a price per result                 the registrar's own first-year and renewal figures,
                                   rather than this page's published table. The table
                                   is honest marketing; a search result is a quote
rate limiting / caching            this is an unauthenticated public page, so an
                                   uncached registrar call per keystroke is somebody
                                   else's bill
a claim path                       today "Check & claim" goes to early access, which is
                                   the correct destination while registration does not
                                   exist. When it does, it should carry the name across
                                   so the signup form opens with it already filled in
```

🛑 **Registering a domain is not a second commercial system.** Locked rule **A7 — one
concern, one authority**: domains do not get their own billing, wallet or provider-payment
authority. Whatever a registrar charges FlowSmartly is an internal settlement fact; the
customer-facing path is the one every paid capability runs:

```
Smart Subscription → included credits → PAYG/top-up → spending ceiling → reservation
→ approved capability execution → registrar action → evidence → settlement
```

A renewal is a **recurring add-on** under Smart Subscription, the same shape a phone number takes
— not a domains-specific subscription. And the prices this marketing page publishes are marketing:
the number a customer is actually charged comes from the authority, never from `TLD_ROWS`.

⚠️ **The portal side is a separate gap and it is bigger.** `/sites/domains` exists in the
portal and `blocks/sites/name-search.tsx` is explicit that there is no endpoint behind
either half: `FoundNames` is *"a read of names already looked for"* and `AcquiringNames`
is *"the statement that stands where a purchase control would"* — no price, no registrar,
no payment. The public hero and the portal screen want the same lookup.

## The conversion the brief asks for

The whole point is that checking a name is free and signing up is what claiming costs.
Nobody is asked for a card to find out what a `.com` costs. When the lookup lands, keep
that shape: **check without an account, claim with one.**

---

## ⚠️ What the rebuilt hero added to this list (2026-09-19)

The hero was rebuilt to `design/approved/public-domains-hero.png`. The ruling above
survived it unchanged and is exercised at 390, 768 and 1440: before anybody types the card
draws the labelled example, and the moment somebody types, the word *Available* is absent
from the whole page while real `name.tld` rows appear with **price only**.

One new gap came out of the mock, and it is the same kind of gap:

```
.net, .ai and .app       the mock's chip row offers them and TLD_ROWS publishes no price
                         for any of the three. Three plausible numbers would have filled
                         the row and none of them would have been checked, so the price
                         column says "Price on request" instead. Publishing them in
                         TLD_ROWS -- first year AND renewal, as every other row has --
                         closes it, and the hero picks them up with no code change
```

The chip row is now a multi-select filter over the extensions, so when the registrar
lookup lands it already has its input: **the typed name plus the set of extensions the
visitor selected**, rather than a fixed four.
