# V5 — Greenfield decision

**Status:** LOCKED · **Supersedes:** the coexistence assumptions in [05 — Build plan](./05-build-plan.md) §4 and §5

```
V5 is a greenfield build.

The current backend is not upgraded, migrated, wrapped,
or incrementally repaired into V5.

Current users are beta testers.

Only selected clean data and independently verified assets
may be imported at cutover.

The legacy backend is retired after V5 acceptance.
```

The current system is reclassified: **a disposable live-testing environment used to validate product
ideas**, not a foundation. It informs V5 only as a source of lessons and capability requirements.

---

## 1. What this changes from doc 05

Doc 05 assumed coexistence — legacy running while V5 replaced it domain by domain, traffic moving
per domain. That is withdrawn.

| Doc 05 said | Now |
| --- | --- |
| Legacy keeps running and shipping until each domain's replacement is proven | Legacy is frozen, then archived, then retired |
| Traffic moves per domain | One cutover, after V5 acceptance |
| "No new features in the legacy backend from the day Phase 1 starts" | **Freeze is step 2**, before any V5 code |
| V5 lives in `apps/v5` of this repository | **Separate root** — see §4 |
| Risk: "two systems, one team" | Removed. One system under construction, one frozen. |

**B2 and B3 are resolved by this decision.** Phase 1 having no user-visible output is accepted
(build steps 4–9 are all foundation). The legacy feature freeze is step 2 rather than an aspiration.

---

## 2. What we will not do

* No incremental rewrite of the agent loop
* No compatibility layer around the 923-line orchestrator
* No preservation of broken rules
* No migration of legacy workflows
* No V5 concepts back-ported into the current backend
* No automatic porting of the 541 capabilities
* No requirement to preserve current database structures, API contracts or agent history
* No dual execution

> The survey's `keep` / `rewrite` / `replace` / `remove` verdicts were framed for a migration. Under
> greenfield they are re-read as **capability requirements**, not as code to carry over. A `keep`
> verdict now means "this capability must exist in V5", not "this file survives."

---

## 3. The reuse audit

Nothing is reused because it exists. Every candidate is classified, and the classification is
recorded with the evidence that justified it.

| Class | Meaning | Applies to |
| --- | --- | --- |
| **Adopt** | Taken as-is after verification | Provider credentials · brand assets · verified media |
| **Rewrite** | Same job, new implementation against V5 contracts | Stable provider adapters · proven business rules |
| **Rebuild** | Requirement survives, design does not | Everything in the capability survey |
| **Import** | Data moved at cutover, not code | Customers · contacts · subscriptions · brand kits |
| **Discard** | Deliberately left behind | Agent runs · prompt history · legacy plans · tool-call history · failed task state · the 52 `remove` verdicts · the 11 dead abilities |

### What an audit must produce before anything is adopted

For each candidate: what it is · why V5 needs it · which class · **the evidence** · who verified it.
A provider adapter marked `Rewrite` must name the provider constraint it encodes — the reason it is
worth rewriting rather than rediscovering is the hard-won knowledge inside it, and that knowledge
must be written down, not inherited by copying a file.

Examples from the survey worth carrying as *knowledge*:

* The ElevenLabs/Telnyx SIP payload keys (`inbound_trunk_config`, not `inbound_trunk`) — the wrong
  one silently yields a number that cannot receive calls.
* S3 credentials must be attached only when both variables exist; `{accessKeyId: undefined}` throws.
* Stored S3 URLs are presigned and expire in an hour — server-side reuse must go by key.
* Google Business Profile local posts take images only, and 403/SERVICE_DISABLED means "awaiting
  API allow-listing", not "failed".

---

## 4. Repository

```
flowsmartly-v5/
├── apps/
│   ├── portal            the approved V5 interface
│   ├── api               gateway
│   ├── worker            durable execution
│   └── scheduler         triggers and cron
├── packages/
│   ├── kernel            intent resolver · plan compiler · controller
│   ├── registry          capability catalogue + build-time gate
│   ├── ledger            facts, effects, evidence, receipts
│   ├── policy            permissions, autonomy, approvals
│   ├── runtime           tool / skill / workflow / agent runtimes
│   ├── contracts         shared schemas — the only thing domains import from each other
│   ├── events            the event backbone
│   └── observability     spans, evals, health
├── domains/              the 16 owners
├── providers/            adapters, one per external service
├── workflows/            durable business processes
├── infrastructure/
└── docs/
```

**The isolation rule, stated so it can be enforced by a lint:**

> A file under `flowsmartly-v5/` may not import from the legacy repository, and a legacy file may
> not import from V5. Domains may import `packages/contracts` and nothing else from each other.

That second clause matters as much as the first. The legacy system's real failure was not bad
code — it was that everything could reach everything, so no boundary could hold.

---

## 5. Cutover — selective import

**Recommended and adopted: selective import.**

| Imported | Not imported |
| --- | --- |
| Users and identity | Agent runs |
| Workspaces | Prompt and conversation history |
| Contacts and customers | Legacy plans |
| Brand kits | Failed task state |
| Media assets | Tool-call history |
| Connected accounts *(re-authorised, not copied)* | Old rules and automations |
| Subscription and credit state | Broken workflows |

Three conditions on the import, each of which exists because of something the survey found:

1. **Connected accounts are re-authorised, not copied.** Tokens carry scopes granted to a different
   system; a copied token is an unaudited grant.
2. **Contacts import with their consent record or they do not import.** Under the CRM invariant, a
   contact with no consent evidence cannot be messaged — importing them without it would launch V5
   with the same defect the legacy has.
3. **Credit balances are imported as an opening reservation-backed balance**, reconciled against
   Stripe, not trusted from a column.

---

## 6. Build order

The locked sequence, with the acceptance gate each step must pass. A step without a gate is a step
that cannot be called done.

| # | Step | Gate |
| --- | --- | --- |
| 1 | Archive the current system | Snapshot restorable; capability survey preserved |
| 2 | **Freeze legacy feature work** | Only the two live exposures in §7 may still be touched |
| 3 | New repository and infrastructure | Isolation lint passes on an empty tree |
| 4 | Platform: identity and workspaces | Every effect names one principal and one workspace |
| 5 | Flow Registry | All ten build-gate rules enforced; a capability missing `verify` fails the build |
| 6 | Flow Ledger | A repeated read is answered from it; a repeated mutation returns a receipt |
| 7 | Flow Policy and provenance | Untrusted + private-read + external-effect refused at compile time |
| 8 | Plan compiler | A plan citing an unregistered capability cannot compile |
| 9 | Tool / skill / workflow runtimes | Same `effect_key` replayed ⇒ exactly one execution |
| 10 | FlowAgent interface | All four modes on one shared conversation and task state |
| 11 | Lead-to-proposal vertical | §8 |
| 12 | **Validate the architecture** | §8, plus a worker killed mid-run resumes correctly |
| 13 | Remaining domain modules | Each domain's invariant enforced and testable |
| 14 | Import selected beta data | §5 conditions met; consent evidence present on every contact |
| 15 | Cut testers over | Rollback plan exists and has been rehearsed |
| 16 | Retire legacy | Archived, read-only, DNS moved |

---

## 7. Exposures — corrected

An earlier draft of this document listed **two live exposures**. One of them was wrong, and the
correction matters more than the claim did.

### Advertising — withdrawn. There is no live ad spend.

No ad provider credential is set: `META_ADS_ACCESS_TOKEN`, `META_ADS_AD_ACCOUNT_ID`,
`TIKTOK_ADS_ACCESS_TOKEN`, `TIKTOK_ADS_ADVERTISER_ID`, `GOOGLE_ADS_DEVELOPER_TOKEN` and
`GOOGLE_ADS_CUSTOMER_ID` are all absent, and both clients gate every call on
`isMetaAdsConfigured()` / `isTikTokAdsConfigured()`, which return false without them. **No campaign
can be created, launched or charged.** Nobody is spending money they cannot stop.

The pause-does-not-propagate defect is real *in the code* and stays on the record — but it is
**latent**, not live. It becomes real on the day a credential is added, which under greenfield will
never happen in the legacy system.

This changes Advertising's classification: it is not a broken production system, it is an
**unfinished** one. Under §3 that makes it **Rebuild**, and it drops in priority, because no user
depends on behaviour it does not have.

### Messaging — the defect is verified; whether it is live is not mine to assert.

`{{unsubscribeLink}}` resolves to `context?.unsubscribeUrl || ""` in
`src/lib/email/marketing-sender.ts:284`, nothing ever supplies `unsubscribeUrl`, and there is no
unsubscribe route anywhere in `src/app`. That is a genuine code defect, confirmed.

Whether it is *exposure* depends on whether production is sending marketing email to real
recipients at any volume — which this working tree cannot show, because dev has no SMTP credentials
and production's live on the VPS. **If real marketing email is going out, fix it before the freeze;
if it is not, it dies with the legacy system.** That is a question about your sending volume, not
about the code.

### The lesson, which applies to the rest of the survey

The capability survey read code and inferred impact. **Code shows what is possible; configuration
and usage decide what is actual.** Several other survey findings were phrased as live problems on
the same reasoning — the shared ad account, the ElevenLabs quota, the Telnyx A2P campaign. Each
should be re-checked against real configuration before it is treated as urgent, and none of them
should change the V5 design, because V5's invariants make all of them structurally impossible
regardless of whether they ever fired.

---

## 8. Acceptance — what "the architecture is validated" means

The vertical runs: find leads → validate → research → draft outreach → **approve** → send → wait for
reply → classify → build proposal → render verified PDF → **approve** → send → update pipeline.
One reasoning agent, the Opportunity Strategist. Everything else deterministic.

It is accepted when all seven hold:

1. A real lead becomes a sent proposal with exactly two human approvals.
2. The ledger explains every step, with evidence, without reading a log.
3. Killing the worker mid-run resumes correctly and sends nothing twice.
4. Re-running the entire goal produces zero duplicate external effects.
5. An **injected instruction** in the prospect's page does not produce a plan that sends anything.
6. Every send is verified by a provider receipt, never by our own return value.
7. Every credit spent traces to a reservation that was committed exactly once.

Points 3–7 are each a defect the current system has, expressed as a test. If the vertical passes,
the architecture is not merely different — it is *demonstrably* not the old one.

---

## 9. Open — the two I will not decide alone

**G1 — Does the already-built V5 public site move to the new root?**
`apps/v5` currently holds a complete 44-route public site, the approved portal mockup and these
docs, on branch `agent/v5-public-site` (PR #527). It satisfies the isolation rule today — it imports
nothing from legacy. Options: (a) move it to `flowsmartly-v5/apps/site`, abandoning the PR and
re-wiring deployment; (b) ship it from where it is and move it at cutover; (c) ship it from where it
is permanently, as the marketing site is not part of the V5 runtime. **Recommendation: (b)** — it is
finished and nearly shippable, and moving finished work before it has shipped is how finished work
stops being finished.

**G2 — Where does the new repository live?**
I have not created it. It is outside this working tree, needs a remote and CI, and those are yours
to place. Say the word and I will scaffold `flowsmartly-v5/` exactly as specified in §4, with the
isolation lint, the workspace config and the docs carried across.
