# V5 — FlowAgent build plan

**Status:** for approval · **Depends on:** docs [00](./00-decisions.md)–[04](./04-domain-boundaries.md)

The plan to build FlowAgent. Ordered so that **every phase ends with something demonstrable**, and
so that the parts which make autonomy safe exist before anything is allowed to be autonomous.

---

## 1. What we are building against

A survey of the current backend, six parallel sweeps, produced: **541 capabilities across 40
domains** (consolidating to 16), **ten structural defects** in the agent loop, and a review of
current agentic practice against our own architecture.

The single most useful number: **8 of 453 real capabilities need a reasoning agent.** Everything
else is deterministic. The current system routes all of them through one 923-line model loop with
110 tools in one prompt. That is the whole story of why it loops.

### What current practice changes — and what it does not

Assessed against our ten defects, not against fashion.

| Verdict | Patterns |
| --- | --- |
| **adopt now** | Structured output at exactly two call sites · memory taxonomy (episodic = Ledger, semantic = Flow Memory, **procedural = new**) · prompt-cache discipline as an architectural rule · OpenTelemetry spans over runs/steps/calls · three eval suites keyed on `success_facts` |
| **design for** (leave a seam, build later) | MCP in **and** out · computer-use session affinity · deferred tool loading · task budgets |
| **reject** | A2A protocol · hosted agent runtimes · LLM-as-judge **as a verifier** · guardrail classifier layer · semantic response caching · programmatic tool calling |

Half of it is rejected, each on the ground that it would not have prevented any of our ten defects.
The rejections that matter:

* **LLM-as-judge as a verifier** violates A4 twice — it does not read a different source, and it
  cannot reliably reject *plausible* output, which is exactly what a model that just produced
  plausible output will emit. Fine as an offline eval metric. Never a gate.
* **Hosted agent runtimes** are the wrong layer. Our durable unit is a business workflow that waits
  days and interleaves ~60 non-agent capabilities. Adopting one means two sources of truth, or
  demoting the Ledger to a projection of a vendor's event log — contradicting A1 and A5.
* **Semantic caching** would silently return another workspace's answer. A1 already has the correct
  version: exact `callHash` from the ledger, and an execution *receipt* for mutations.

And three things the review found in our own locked documents, now corrected in
[00](./00-decisions.md): the idempotency key included `plan_step` (a re-plan would have re-sent
outreach), R1 did not say an *external* agent counts (a marketplace agent bypassed it over HTTP),
and there was **no provenance model at all** — untrusted prospect HTML and inbound email reach a
context holding `send_outreach` and `purchase_credits`. That last one is now **A6**, and it is the
most important thing the review produced.

---

## 2. Sequencing principle

> **Nothing may be autonomous before the thing that makes autonomy safe exists.**

Which fixes the order: identity and money and audit before capabilities; verification before
autonomy; the Ledger before agents; one vertical proven end to end before breadth.

---

## 3. Phases

### Phase 0 — Resolve the census · *~1 week, no code*

Not building. Closing the gaps that would otherwise be discovered mid-build.

* Adjudicate the **134 capabilities with no canonical intent** — plumbing (`not-a-capability`) or
  vocabulary gap (add an intent). An unmapped capability is unplannable and would silently vanish.
* Add the missing intents the census exposed: **impersonation/delegation** has none, and it is the
  highest-privilege operation in the product.
* Confirm the 52 `remove` verdicts with you. Deleting capability is a product decision.
* Freeze vocabulary **v1**.

**Done when:** every one of the 541 has an intent or an explicit `not-a-capability`, and the
vocabulary is versioned.

---

### Phase 1 — The spine · *foundations that everything else assumes*

Build in this order; each is a hard dependency of the next.

1. **Identity & Access (domain 1)** — one principal, one authority resolution, no writes on read.
   Kills the three-authorisation-systems problem before anything can inherit it.
2. **Organizations & Workspaces (2)** — tenancy on the record. Every later table gets `workspaceId`
   from birth; there is no retrofit.
3. **Platform: credits, providers, audit (16)** — reserve → commit/release. Provider adapters with
   health. **Nothing spends before this exists.**
4. **Flow Registry** — the descriptor, the build-time gate (all ten rules), the shortlist selector.
5. **Flow Runtime** — Goal, Plan, Step, Attempt, **Ledger**; the state machine; `callHash` blocking;
   the semantic-vs-transport retry split (A5).
6. **Flow Policy** — autonomy resolution, approval tokens (single-use, expiring), per-domain
   ceilings.
7. **Flow Observe** — OTel spans emitted from the transitions the runtime already persists, so
   tracing is a projection rather than new instrumentation.

**Done when:** a trivial capability (`identify_actor`) executes end to end through Kernel → Registry
→ Runtime → Ledger, with a span, an audit row, and a reserved-then-released credit — and replaying
it with the same idempotency key produces exactly one execution.

> That last clause is the real acceptance test. It is defect 6 and defect 7, provably closed, before
> a single business capability exists.

---

### Phase 2 — The first vertical · `lead_to_proposal.v1`

Fifteen deterministic steps, **one** reasoning agent
([00](./00-decisions.md#first-vertical--locked)).

Build order within the phase:

1. The seven intents' capabilities as **tools and skills** — no agent yet.
2. The durable workflow, with real waits (a reply may take days).
3. Approvals on the two send steps.
4. `pitch.agent.opportunity_strategist`, **last** — structured output, no side effects, cannot
   delegate.
5. Verifiers that read independent sources: provider delivery receipt, not our own return.

Cross-cutting, delivered here because this vertical is the first thing that needs them:

* **A6 provenance** — the prospect's scraped page and the inbound reply are untrusted. This is where
  taint propagation is proven, not theorised.
* **Consent** — the CRM invariant, and a **working unsubscribe route**, which does not currently
  exist anywhere in the codebase.
* **The three eval suites** — router (utterance → intent), plan (goal → plan), execution
  (plan → success facts). Router and plan gate every PR; execution runs nightly.

**Done when:** a real lead becomes a sent proposal, unattended except for two approvals, and:
the ledger explains every step; killing the worker mid-run resumes correctly; an injected
instruction in the prospect's page does **not** produce a plan that sends anything; and re-running
the whole goal sends nothing twice.

---

### Phase 3 — FlowAgent surface

The portal already has an approved shell ([mockup](../../design/portal-shell-v1.html)) with four
presentations — sidebar, floating, full page, collapsed dock.

* Goal creation from utterance; the router with `intent: unknown` as a real answer.
* Progress streaming from the run's persisted transitions.
* Approval cards carrying the preview, the cost and the expiry.
* Resumable tasks; shared history across all four modes.

**Done when:** the vertical from Phase 2 is driven entirely from FlowAgent, including approving from
the collapsed dock.

---

### Phase 4 — Domains, in dependency order

Each domain: its invariant enforced, its capabilities registered, its events emitted.

| Wave | Domains | Why here |
| --- | --- | --- |
| 4a | **3 CRM** · **9 Messaging** | Consent and outbound are prerequisites for everything that talks to a customer. Fixes the unsubscribe exposure. |
| 4b | **5 Content & Assets** · **8 Social** | Assets before anything that publishes them. |
| 4c | **6 Video & Voice** · **15 Analytics** | Consent-gated likeness; metrics recomputable from events. |
| 4d | **11 Commerce** · **12 Websites & Local** | External-observation invariant is heaviest here. |
| 4e | **10 Advertising** · **7 Training** | Advertising needs real provider reconciliation, not `console.log`. |
| 4f | **13 Pitch** (completed) · **14 Automation & Agents** | The marketplace lands last: third-party capabilities need every control in place first. |

Within each wave, the `remove` verdicts are deleted first — carrying dead code into a clean room is
how clean rooms stop being clean.

---

### Phase 5 — Autonomy, earned

Only now does anything run unattended.

* Turn on autonomy 3 (policy-driven) for capabilities whose verifiers have a demonstrated
  rejection rate — a verifier that has never failed is unproven, not perfect.
* Procedural memory as **policy proposals** carrying their evidence, promoted by a human. A learned
  policy that executes unaudited is what 01 §7 exists to prevent.
* Per-domain autonomous ceilings.
* "Ran without you" reporting, which is the honest half of "human-approved by default".

---

## 4. What we are deliberately not building

| Not building | Because |
| --- | --- |
| A microservice per domain | Modular monolith + durable workers. Domain boundaries are enforced by module and event, not by network. Distribution is a deployment decision, taken later if load demands it. |
| A general workflow designer | The 71 intents have known plans. A visual builder is a product feature, not a runtime requirement. |
| Multi-agent orchestration | 8 agents in 453 capabilities. R1 forbids delegation. There is nothing to orchestrate. |
| A migration from the legacy backend | V5 is a clean room. The legacy keeps running and shipping until a domain's V5 replacement is proven, then traffic moves per domain. |
| Provider choice exposed to planner or user | One capability, adapter picks. The current four-image-providers-three-mechanisms mess is the counterexample. |

---

## 5. Risks, honestly

**The census may be optimistic.** 206 `keep` verdicts were judged from reading code, not running it.
Expect some to become `rewrite` on contact. *Mitigation:* the eval suites are built in Phase 2, so
the truth arrives early and cheaply.

**Phase 1 has no visible output.** Weeks of spine before anything a user can see, which is
uncomfortable and is the phase most likely to be cut short under pressure. *Mitigation:* the Phase 1
acceptance test is demonstrable and takes 30 seconds to run — replay a call, get exactly one
execution.

**The legacy keeps running.** Two systems, one team. *Mitigation:* no new features in the legacy
backend from the day Phase 1 starts; only the unsubscribe and ad-pause fixes, because those are
live exposures that cannot wait for V5.

**Provider single points of failure survive the rewrite.** One key covers the agent loop, web
search, every builder and compliance copy; another covers images, editing, video *and* music
simultaneously. The registry's adapter layer makes a second provider *possible* — it does not make
one *exist*. *Mitigation:* explicit per-domain fallback decisions in Phase 4, and `health()` on
every adapter from Phase 1.

**Scope.** 541 capabilities is a large surface even at 4 domains per wave. *Mitigation:* the 52
removals, and a willingness to leave `partial` capabilities at autonomy 1 indefinitely rather than
finish them speculatively — repair priority is demand-driven, per D9.

---

## 6. Two live exposures that should not wait

Independent of V5, and both currently shipping:

1. **No working unsubscribe.** The merge field renders empty; no route exists. Every campaign sent
   is exposed. This is days of work in the legacy backend and should be done now.
2. **Ad pause does not propagate.** `pauseOnAllChannels` is called from nowhere; budget changes are
   local; spend never reconciles. A customer who pauses a campaign is still spending.

---

## 7. Open — needs your decision

**B1 — The public site still says "Flow.AI".** [D0](./00-decisions.md) renamed the system to
FlowAgent, and the portal mockup is updated. The public marketing site has 16 files, a `/flow-ai`
route, mega-menu entries, JSON-LD and a sitemap entry. Renaming means a route change and a 301.
**Do you want the public site renamed to FlowAgent as well, or does the marketing product keep the
Flow.AI name while the system core is FlowAgent?** I have not touched it either way.

**B2 — Phase 1 has no user-visible output.** Are you comfortable with that, or should Phase 2's
vertical be sliced thinner so something is demonstrable sooner? I would not recommend it — the
spine is what makes everything after it cheap — but it is your call to make, not mine.

**B3 — Legacy feature freeze.** The plan assumes no new features in the old backend once Phase 1
begins. If that is not realistic, the phasing needs to change now rather than later.

---

> Capabilities perform work · workflows preserve time · agents resolve uncertainty ·
> policies control authority · verifiers establish truth · the ledger prevents forgetting.
