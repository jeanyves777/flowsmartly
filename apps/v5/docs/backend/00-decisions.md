# V5 backend — locked decisions

Decisions below are **settled**. Changing one requires a new entry, not an edit — the specs cite
these by number.

---

## D0 — The system is called **FlowAgent** · **LOCKED**

The assistant and its execution core are **FlowAgent**. "Flow.AI" is retired.

| | name |
| --- | --- |
| The system, and what a user talks to | **FlowAgent** |
| Orchestration hub | Flow Kernel |
| Capability catalogue | Flow Registry |
| Scoped business context | Flow Context |
| Execution engine | Flow Runtime |
| Authority and autonomy | Flow Policy |
| Structured memory | Flow Memory |
| Events and triggers | Flow Events |
| Limits and loop prevention | Flow Guard |
| Traces, logs, evaluations | Flow Observe |

The internal components keep the `Flow *` family because they are a system, not a product — a
person never types "Flow Kernel". Only **FlowAgent** is user-facing.

**Open:** the public marketing site still sells the assistant as "Flow.AI" across 16 files,
including a `/flow-ai` route, the mega menu, JSON-LD and the sitemap. Renaming it is a separate,
mechanical sweep with SEO consequences (the route changes, so it needs a redirect). Not done —
see the note at the end of [05 — Build plan](./05-build-plan.md).

---

## D1 — Intent vocabulary: closed, with semantic routing · **LOCKED**

A closed canonical vocabulary of ~70 intents. Embeddings and language models may only **map natural
language into** the vocabulary; they may never define an executable intent.

```
"Reach out to dentists near Albany"
        │  (LLM/embedding — routing only)
        ▼
find_leads → qualify_leads → create_outreach_campaign
        │  (canonical ids — execution)
        ▼
```

An unresolved request stays `intent: unknown` and is reported. It is **never** forced to the nearest
embedding match. Vocabulary and per-intent declarations: [03 — Intent vocabulary](./03-intent-vocabulary.md).

## D6 — Planning: deterministic-first · **LOCKED**

```
intent → required slots → deterministic plan → policy validation → workflow execution
```

A model plans **only** when: the intent is ambiguous, no registered plan covers the goal, a plan
failed because an assumption became false, or the user explicitly asked for a custom strategy.

Even then the model emits a *candidate* plan referencing **registered capability ids only**. The plan
compiler validates it before anything executes. **The model planner never invents a capability and
never calls a tool directly.**

## D9 — Partial abilities: lifecycle states · **LOCKED**

| State | Discoverable by planner | Max autonomy | Notes |
| --- | --- | --- | --- |
| `draft` | no | — | not selectable by normal planning |
| `experimental` | explicit selection only | 1 | |
| `verified` | yes | per capability | the only state eligible for routine planning |
| `degraded` | only when policy permits | per policy | health check failing |
| `deprecated` | no | — | cannot appear in a **new** plan; existing runs finish |
| `disabled` | no | — | never executable |

The 11 dead/broken abilities stay in the audit inventory and are `disabled`.

Repair priority is **not** verify-failure rate alone. Rank on: user demand · business value ·
execution volume · repair cost · provider stability · failure severity.

---

## Architecture rules — **LOCKED**

### A1 — Ledger entries carry evidence and provenance

A fact is never a bare key/value.

```yaml
key: proposal.pdf.generated
value: { asset_id: asset_123 }
scope: workflow_run_456
source:
  capability: pitch.tool.render_proposal_pdf
  version: 1
  execution_id: exec_789
evidence:
  file_hash: abc123
  storage_status: confirmed
created_at: 2026-08-05T09:12:44Z
version: 1
```

* A repeated **read-only** call is answered from the ledger.
* A repeated **mutating** call returns its previous **execution receipt** — not a cached result.
  The distinction matters: the caller must know the action already happened, not be handed a value
  as though it just happened again.

### A2 — Every mutation is idempotent

```
idempotency_key = hash(workspace + workflow_run + effect_key + capability_version + normalised_input)
```

> **Correction (found in review).** The key originally included `plan_step`. A re-plan mints new
> step ids ([02 §3](./02-execution-model.md)), so the same mutating call under plan v2 would hash
> differently from plan v1 — and re-send outreach that had already gone. `effect_key` is declared by
> the *caller* and is **stable across re-plans**: for `send_outreach` it is
> `sequence:{id}/step:{n}/contact:{id}`, which identifies the effect in the world rather than the
> attempt in our plan.

Required for: send email · charge credits · publish post · change ad budget · send proposal ·
create order — and everything else with `effect ≥ write`.

**The runtime checks the execution ledger before invoking the provider.** Not after, not inside the
adapter.

### A3 — Approval is a single-use token

Bound to: exact plan hash · exact capability + version · exact normalised inputs · maximum cost ·
allowed side effect · expiry · one execution token.

**The token is consumed on attempted execution — success or failure.** A retry gets a fresh runtime
decision and never inherits the original authorisation.

### A4 — Verification must be able to reject

Beyond "autonomy > 1 requires a verifier that can fail":

* A verifier may **not** merely check that the executor returned success.
* Where practical it must read a **different source** from the executor.

```
✅  executor: send_email        verifier: provider delivery receipt
❌  executor: send_email        verifier: send_email response.success
```

Where no independent source exists, the capability is capped at autonomy 1 and says so.

### A4b — An **external** agent counts as an agent · **LOCKED**

R1 ("an agent may never call an agent") is worthless if delegation over HTTP is exempt — a
marketplace agent would bypass it and "acyclic by construction" would be gone.

> **A third-party marketplace agent is not an agent in this taxonomy. It is a capability whose
> implementation happens to be someone else's model.**

It therefore registers as a capability and must satisfy the descriptor like any other. Because it
cannot supply six of those fields honestly, the runtime supplies them:

| Field | Who declares it | Value |
| --- | --- | --- |
| `origin` | us | `third_party` |
| `effect`, `cost`, `timeoutMs` | **us**, never self-reported | capped by per-origin policy |
| `idempotency` | us | `none` ⇒ `maxAttempts: 1` |
| `verify` | **us**, locally written | a third party may never verify anything, including itself |
| outputs | us | graded `trust: untrusted` (A6) |
| autonomy | us | **≤ 2**, always |

Workspace credentials are injected at egress and never visible to the third party.

### A6 — Provenance and taint · **LOCKED**

*This was the one real gap: nothing in 00–03 mentioned untrusted input, yet the first vertical
ingests it on the critical path.* A prospect's scraped web page, a Google review, an inbound
customer email and any third-party capability output are **attacker-controlled text arriving in a
context that also holds `send_outreach`, `purchase_credits` and `launch_ad_campaign`.**

Every existing control governs whether a capability *may* run. None ask **who chose it**. An
injected instruction produces a plan that passes every precondition and carries a genuine verifier.

1. Every `LedgerEntry.source` and `evidence` carries `trust: 'trusted' | 'untrusted'`.
   Anything derived from untrusted input is untrusted — taint propagates.
2. New precondition kind: `{ kind: 'provenance'; requires: 'trusted' }`.
3. **Compiler rule:** a plan may not combine *untrusted input* + *private data read* +
   *external effect* without human approval. Any two are fine; all three is the exfiltration
   shape, and it is refused at plan time rather than argued about in a prompt.
4. Untrusted text is never concatenated into instructions. It is passed as data, in a labelled
   block, with its source.

### A5 — Non-progress is measured on semantic steps only

| Event | Classified as |
| --- | --- |
| HTTP timeout retry | runtime concern — invisible to progress |
| Rate-limit backoff | runtime concern — invisible to progress |
| Same reasoning action repeated | **non-progress** |
| Same research repeated | **non-progress** |
| Same plan regenerated | **non-progress** |

The runtime performs bounded technical retries without triggering re-planning. **Progress is
evaluated only when a semantic step resolves.**

---

## Domain consolidation — **LOCKED**

40 surveyed domains collapse to 16 owners. A domain owns **data and invariants**; UI navigation does
not define a boundary.

| # | Domain | Absorbs (from the survey) |
| --- | --- | --- |
| 1 | Identity & Access | auth, teams, account, gating |
| 2 | Organizations & Workspaces | branding, white-label, agency |
| 3 | Customers & CRM | crm, contacts, forms |
| 4 | Leads & Prospecting | leads, outreach, discovery |
| 5 | Content & Assets | content, design, media, media-image, documents, storage |
| 6 | Video & Voice | video, media-video, media-audio, avatar, voice, clone |
| 7 | Training & Learning | training, events |
| 8 | Social | social, publishing, social-network |
| 9 | Messaging | messaging, email, campaigns, notifications |
| 10 | Advertising | ads |
| 11 | Commerce | commerce |
| 12 | Websites & Local Presence | sites, website, web, domains, landing-pages, listings, local-presence, presence, reviews, hosting |
| 13 | Pitch & Sales | sales, leads (pitch half) |
| 14 | Automation & Agents | automations, scheduling, agent-core, agent-infra, agent-ui |
| 15 | Analytics & Attribution | analytics, growth |
| 16 | Platform, Billing & Integrations | billing, monetization, infra, admin, trust-safety, legacy-ai |

---

## First vertical — **LOCKED**

`lead_to_proposal.v1` — one durable workflow, **exactly one** reasoning agent.

**Deterministic:** find leads → validate contacts → deduplicate → score against targeting rules →
create outreach sequence → *approval* → send outreach → wait for reply → classify reply → collect
business data → generate proposal document → verify PDF → *approval* → send proposal → track
delivery → update pipeline.

**The one agent — `pitch.agent.opportunity_strategist`** interprets the prospect's situation,
connects needs to services, and produces the proposal strategy. Structured output only:

```yaml
opportunity_summary:
pain_points: []
recommended_outcomes: []
recommended_services: []
proposal_structure: []
assumptions: []
missing_information: []
confidence_by_claim: {}
```

**It may not:** send email · create charges · render PDFs · wait for replies · call another agent ·
approve its own output · modify the pipeline. Those are tools, skills and workflow responsibilities.

---

> Capabilities perform work · workflows preserve time · agents resolve uncertainty ·
> policies control authority · verifiers establish truth · the ledger prevents forgetting.
