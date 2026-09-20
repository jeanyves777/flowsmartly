# V5 — Start gate

**Status:** awaiting decisions · **Question:** what is left to answer before build begins

Everything architectural is settled. What remains is **infrastructure, scope confirmation, and a
handful of policy details** — most of which have a recommendation attached, so they need approval
rather than authorship.

---

## A. Blocking — cannot write the first line without these

### A1 · The stack — never discussed

This is the real gap. Seven documents of architecture and not one sentence about what it runs on.

| | Recommendation | Why |
| --- | --- | --- |
| Language | **TypeScript**, strict, end to end | The portal is already TS; one language across `contracts` is what makes the shared-schema rule cheap |
| API | **Fastify** or **Hono** | Not Next.js. The V5 API is a service, not a site — and Next's request model fights durable execution |
| Database | **PostgreSQL** | The Ledger is append-only with heavy JSONB; nothing else is a serious candidate |
| ORM | **Drizzle** over Prisma | Prisma's client generation was a live footgun in the legacy (EPERM DLL locks, `db push` on every deploy). Drizzle is SQL-first, which suits a schema whose invariants are the point |
| Queue / durable work | **PostgreSQL-backed** (pgboss or equivalent), *not* Temporal | The practice review's conclusion: own the interpreter, buy the queue. V5 plans are **data**; Temporal wants workflows to be **code**, and wrapping one in the other creates two event logs and demotes the Ledger |
| Cache / pubsub | **Redis** | Already operated; the legacy's bus degrades gracefully without it |
| Hosting | Start on **one VPS**, containerised | Same box, better shape. Distribute when load demands it, not before |
| Tests | **Vitest** + the three eval suites | The legacy has *no test framework of any kind* |

**What I need:** yes, or your substitutions.

### A2 · Where the repository lives (G2)

Needs a remote, an owner and CI. Not mine to place. Once you name it I scaffold §4 of
[06](./06-greenfield.md) exactly — workspace config, isolation lint, docs carried across.

### A3 · Does the finished public site move? (G1)

`apps/v5` holds a complete 44-route site, the approved portal mock and these docs. It already
imports nothing from legacy.

**Recommendation: ship it from where it is, move it at cutover.** It is finished and unshipped;
moving finished work before it has shipped is how it stops being finished. It also affects repo
layout, so it is answered now either way.

---

## B. Blocking Phase 0 — the week before code

### B1 · Confirm the 52 `remove` verdicts

Deleting capability is a product decision, not an engineering one. I will give you the list grouped
by domain with the reason for each; you strike anything you still want.

### B2 · Adjudicate 134 capabilities that map to no intent

Each is either plumbing (`not-a-capability`) or a vocabulary gap. I can propose a verdict for all
134 and bring you only the genuinely ambiguous ones — likely 20–30.

### B3 · Missing intents the census exposed

**Impersonation / delegation has no canonical intent**, and it is the highest-privilege operation in
the product. It needs one before Identity is built, because Identity is step 4.

---

## C. Decidable now, needed early

### C1 · Credit model (D3, still open)

**Recommendation: one workspace balance, plus per-domain autonomous ceilings in Flow Policy.**
A single balance is what a customer understands. Per-domain ceilings — "prospecting may spend 500
credits a month without asking" — are what make autonomy level 3 safe. Without them, "autonomous"
means "unbounded", and 44 capabilities spend money.

### C2 · Step granularity (D8, needs a yes)

A plan step is **one capability of any type**. A skill is one step; its internals are its own
business and a failed skill resumes inside itself rather than the plan seeing its steps. Keeps plans
short and readable. **Confirm.**

### C3 · Model provider strategy — the largest technical risk carried into V5

One vendor currently gates the agent loop, web search, every builder, and compliance copy. A second
gates image generation, editing, video *and* music simultaneously. The registry's adapter layer
makes a fallback **possible**; it does not make one **exist**.

**Recommendation:** every provider adapter declares a fallback from Phase 1, even where the fallback
is "fail cleanly and tell the user". A silent single point of failure is worse than a declared one.

### C4 · Is production sending marketing email?

Decides whether the unsubscribe gets fixed in the frozen legacy or dies with it
([06 §7](./06-greenfield.md)). One-line answer from you; I cannot see production from here.

---

## D. Not blocking — decide at the phase that needs them

| | Question | Needed by |
| --- | --- | --- |
| V1 | May `handle_inbound_message` ever send autonomously? *(rec: no, autonomy 2, revisit with data)* | Phase 4a |
| V2 | `forget_customer` — approval plus an SLA escalation? *(rec: yes)* | Phase 4a |
| V3 | Shared prospecting budget for `find_leads` + `enrich_lead`? *(rec: yes)* | Phase 2 |
| — | Cutover mechanics and rollback rehearsal | Phase 14 |
| — | Which domains ship in which wave | Phase 4 |

---

## E. What is ready

* Taxonomy, control-flow ownership, and the three structural rules (R1–R3)
* Registry descriptor, the ten build-gate rules, bounded discovery
* Goal / Plan / Step / Attempt / Ledger, with progress defined as ledger growth
* Six architecture rules — A1 provenance-carrying facts, A2 effect-key idempotency, A3 single-use
  approvals, A4 independent verification, A4b external agents, A5 semantic-only progress,
  A6 taint tracking
* 71 canonical intents, fully specified for the first vertical
* 16 domains with testable invariants; 541 capabilities assigned
* Current-practice review — adopt / design-for / reject, with reasons
* The approved portal, four FlowAgent modes, three themes
* Acceptance criteria for the first vertical: seven tests, each a defect the current system has

---

## The honest summary

**Answer A1, A2 and A3 and I can start.** A2 and A3 are a sentence each; A1 is the only one that
needs thought, and it needs about ten minutes.

B and C would follow in the first week — B in parallel with scaffolding, C before the runtime is
built. D can wait.

Nothing in the architecture is unresolved. What is missing is the ground to put it on.
