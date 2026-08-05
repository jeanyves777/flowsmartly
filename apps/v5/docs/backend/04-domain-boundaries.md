# V5 — Domain boundaries

**Status:** for review · **Depends on:** [00 — Decisions](./00-decisions.md), [03 — Intent vocabulary](./03-intent-vocabulary.md)

Sixteen domains, each defined by **one testable invariant**. A domain owns data and invariants; UI
navigation does not define a boundary. Domains never read each other's tables — they query or
subscribe.

**541 capabilities assigned** across the sixteen (the 225-ability survey resolved to finer grain on
inspection).

| verdict | count | meaning |
| --- | --- | --- |
| `keep` | 206 | works, fits V5 as-is |
| `rewrite` | 178 | right capability, wrong implementation |
| `replace` | 103 | right job, wrong approach |
| `remove` | 52 | dead, duplicated, or should never have existed |
| `unknown` | 2 | |

| V5 type | count |
| --- | --- |
| tool | 272 |
| workflow | 95 |
| skill | 78 |
| **agent** | **8** |
| not-a-capability | 88 |

> **Eight agents out of 453 real capabilities — 1.8%.** That is R3 and D6 holding under a full
> census rather than in principle. If the number had come back at fifty, the deterministic-first
> decision would have been wishful thinking.

**134 capabilities serve no canonical intent.** Some are genuinely not capabilities (transport,
plumbing); the rest are vocabulary gaps. Both need resolving before build — see §3.

---

## 1. The sixteen invariants

Each is written so a reviewer can *test* it. Where the current system already violates it, that is
stated — those are the rewrites with teeth.

**1 · Identity & Access**
> Every effect is attributable to exactly one authenticated principal, and that principal's
> authority is resolved at the instant of the effect — never inherited from a cookie, a token
> refresh, or an impersonation that replaced the actor.
>
> *Test:* pick any row that cost money or sent something; name the human who caused it and the grant
> that allowed it. **Fails today** — an agency operator impersonating a client writes rows carrying
> only the *client's* id.

**2 · Organizations & Workspaces**
> Every record belongs to exactly one workspace, and the workspace is the only thing that decides
> which brand, locale and sender an outbound artifact carries.
>
> *Test:* take any generated asset; show its brand came from its workspace's identity record — not
> from a `findFirst`.

**3 · Customers & CRM**
> Sole authority on whether a person may be contacted on a channel. Nothing leaves the platform
> without a consent decision carrying the evidence of how consent was obtained.
>
> *Test:* for any outbound message today, produce the consent record and require non-empty evidence.

**4 · Leads & Prospecting**
> A prospect fact is only as good as its witness. Every stored field carries the source that
> established it, and **no field may be written by an actor that is also its only witness.**
>
> *Test:* ask any lead field for its source. **Fails today** — `enrich_lead` persists whatever the
> model typed and stamps `enrichedAt`.

**5 · Content & Assets**
> Every byte the platform shows, sends or publishes resolves to exactly one Asset carrying its
> provenance and a *verified* rendition. No other domain persists a raw media URL.

**6 · Video & Voice**
> No synthetic likeness or voice without a live consent grant checked **at render time** — and
> revoking a grant disables every derived asset, in every domain, immediately.

**7 · Training & Learning**
> Attendance is the source of truth. Nothing is shown to, captured from, or billed for anyone who is
> not an admitted participant, and every credit traces to observed attendee-seconds — never a
> planned seat count.

**8 · Social**
> A post reaches a channel exactly once, only to approved channels, and success is **the platform's
> own identifier — never our return value.**

**9 · Messaging**
> No message leaves to an address without permission on that channel, and every message carries an
> opt-out **that actually works**.
>
> **Fails today, and it is a legal exposure:** `{{unsubscribeLink}}` always renders empty because
> nothing supplies `unsubscribeUrl` and **no unsubscribe route exists anywhere in the codebase.**

**10 · Advertising**
> Reported ad state must equal provider ad state.
>
> *Test:* fetch any campaign from its provider and diff status, budget and spend. **Fails today** —
> pausing never propagates (`pauseOnAllChannels` is defined and called from nowhere), budget PATCH
> changes nothing upstream, and all three `syncStats` functions only `console.log`.

**11 · Commerce**
> Money and stock move together or not at all. No charge without an order line, no order line
> without stock, no unit sold twice.

**12 · Websites & Local Presence**
> **Nothing is live because we said so.** Published / connected / live may only be recorded when an
> *external* observation confirms it — an HTTP fetch, a DNS+SSL check, a directory scan, a provider
> receipt. Our own write is never the evidence.

**13 · Pitch & Sales**
> Nothing goes in front of a prospect unless every deliverable, claim and price resolves to
> something the seller actually offers at a price they approved — and the artifact delivered is the
> exact artifact approved.
>
> *Test:* for any sent pitch, produce the catalogue item per line, the price approval, and the hash
> of the PDF received. **All three fail today.**

**14 · Automation & Agents**
> Every execution has exactly one durable run record that outlives the process, carries its own
> budget and authority, and reaches a terminal state. **If a run cannot be found and explained
> afterwards, it must never have been allowed to start.**

**15 · Analytics & Attribution**
> Every number is recomputable from immutable events, and no domain other than Analytics writes a
> metric. *A counter that cannot be rebuilt from its events is not a metric, it is a rumour.*

**16 · Platform, Billing & Integrations**
> No capability consumes money, credits or quota without a reservation against a live balance, and
> no reservation commits twice for the same idempotency key.
>
> *Test:* replay any mutating execution twice with an identical key — require exactly one provider
> call, one commit, one ledger entry; and require a crashed execution to leave an *expiring
> reservation*, not a standing charge.

---

## 2. Communication

Domains talk by **events** and **queries**, never shared tables. The event names are in the survey
output; the shape that matters:

```
leads.outreach.step_due          → Messaging dispatches it
messaging.message.received       → Leads classifies the reply
websites.form.submitted          → CRM creates the contact
customer.consent_withdrawn       → Messaging + Advertising suppress immediately
consent.revoked (likeness)       → Content, Training, Social disable derived assets
credits.exhausted                → Automation suspends running goals
automation.progress.stalled      → the A5 non-progress signal
automation.capability_gap.reported → the ONLY sanctioned way the intent vocabulary grows
```

Two rules:

* **A domain that emits an event does not know who consumes it.** Messaging does not call Leads.
* **Consent and money events are never "best effort."** `consent_withdrawn` and `credits.exhausted`
  must be delivered or the run halts. Everything else may be at-least-once.

---

## 3. What the census exposed

Ranked by what they cost us, not by how many there are.

1. **No working unsubscribe** (Messaging). The merge field renders empty and no route exists. This
   is a legal exposure on every campaign already sent, and it blocks `create_email_campaign` from
   ever exceeding autonomy 1.
2. **Ad control is fiction** (Advertising). Pause is unreachable code; budget changes are local
   only; spend never reconciles. The portal shows numbers no provider agrees with, and
   `adjust_ad_budget` at autonomy 2 would approve a change that does not happen.
3. **Three authorisation systems that disagree** (Identity). `getSession()` resolves an actor five
   ways and *mints cookies as a side effect of a read* — a read that mutates auth cannot be audited.
   Admin preview **creates a real billable user with a PRO plan and 10,000 credits.** Delegation
   spends the owner's balance while recording usage against the member.
4. **Model assertions stored as facts** (Leads). `enrich_lead` persists what the model typed. Under
   the domain's own invariant those writes must be rejected — which makes this a rewrite, not a fix.
5. **134 capabilities serve no canonical intent.** Each is either plumbing (fine — mark
   `not-a-capability`) or a vocabulary gap (add via `report_capability_gap`). Resolving this list is
   a Phase 0 gate: an unmapped capability cannot be planned, so it would silently become
   unreachable.

---

## 4. Ownership of the awkward cases

| Ability | Owner | Why |
| --- | --- | --- |
| `set_preferred_language` | **2 — Workspaces** | Output language is a brand property. Identity keeps *interface* language; Workspaces owns what customers receive. Today both claim it. |
| Impersonation / delegation | **1 — Identity** | Highest-privilege operation in the product and it has **no canonical intent** — a vocabulary gap to close before build. |
| Credits | **16 — Platform** | Every other domain reserves; none debit. |
| Consent | **3 — CRM** | Messaging enforces, CRM decides. Splitting these is how the current system ended up with an unsubscribe link that goes nowhere. |
| Assets | **5 — Content** | Video & Voice *produces* into it; Social and Messaging *reference* it. Nobody else stores a URL. |
| Run records | **14 — Automation** | Including runs started by other domains. One place answers "what happened". |

---

## Next: [05 — Build plan](./05-build-plan.md)
