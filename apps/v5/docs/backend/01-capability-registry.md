# V5 — Flow Registry specification

**Status:** for discussion · **Supersedes:** nothing (clean room) · **Depends on:** nothing

This is the first design artifact. It defines what a *capability* is, what every capability must
declare, and the rules the Kernel follows when choosing one. The execution-state model
(goal, plan, task, run) is [document 02](./02-execution-model.md) and depends on this one.

---

## 0. What we are designing against

Six parallel surveys of the current backend produced a catalogue of **225 abilities across 40
domains** and a diagnosis of the loop. The numbers below are measured, not estimated, and every
rule in this spec exists to make one of them structurally impossible.

**The surface we must carry forward**

| | count |
| --- | --- |
| Abilities catalogued | 225 |
| Domains | 40 (video 18, content 17, commerce 17, leads 17, design 15, crm 12, messaging 11, …) |
| That **spend money** | 44 |
| That are **irreversible** | 8 |
| Working (`solid`) | 172 |
| Half-built (`partial`) | 42 |
| Dead, stub or broken | 11 |

**The ten defects this spec has to prevent**

1. **History is loaded backwards.** `orderBy: asc, take: 40` returns the *oldest* forty messages.
   The comment above it says "most recent". After ~15 exchanges the agent has permanent
   mid-conversation amnesia — it re-asks answered questions and re-runs completed work.
2. **No tool-call memory survives a turn.** The `messages` array holding every `tool_use` and
   `tool_result` is a local variable. Turn 2 cannot see what turn 1 did, so it calls it again —
   and pays again.
3. **Stop conditions are prose.** `ask_choice` returns the string *"STOP and wait"* inside a tool
   result that the loop immediately feeds back to the model and continues. Nothing enforces it.
4. **The iteration cap terminates silently** and discards the last tool's result.
5. **No goal object outlives a turn.** Plan steps carry a `toolName` that nothing ever executes.
6. **A confirmed plan is never consumed on failure**, and the authorising lookup has no time
   bound — so a failing mutating tool re-authorises and re-charges itself indefinitely.
7. **No retry, no backoff, no idempotency.** A provider hiccup ends the turn after the credits are
   spent, and shows the raw error.
8. **47 prompt sections, ~144 imperative directives, 35 "HARD RULE" labels** — which contradict
   each other on the two most common flows.
9. **A 50–60K token prefix is rebuilt every turn**, with a timestamp that invalidates the cache
   breakpoint on every single turn.
10. **Nothing detects a repeated call with identical arguments**, and an operator watching a
    production loop sees one console line per turn.

> Read together, these say the same thing: **the current system has no machine-readable model of
> what it is trying to do, what it has already done, or how it would know it was finished.** It
> substitutes prose instructions for mechanism. Adding rules to it makes it worse, because rules
> are the thing that is already failing.

---

## 1. The taxonomy, defined by who owns control flow

Tool / Skill / Workflow / Agent is the right split, but "reusable sequence" and "long-running" are
descriptions, not definitions — and the current system's core defect is that it treats all four the
same. The definition that actually decides the runtime is **who chooses the next step**.

| | Next step chosen by | May pause and resume | May reason | May call |
| --- | --- | --- | --- | --- |
| **Tool** | its caller | no | no | *nothing* |
| **Skill** | its own code — a fixed DAG | no (bounded, seconds) | no | tools |
| **Workflow** | the durable engine | **yes — hours or days** | no | tools, skills, agents |
| **Agent** | the model, inside a budget | no | **yes** | tools, skills |

Three rules follow, and they are the spine of the design:

**R1 — An agent may never call an agent.** Agents call tools and skills. Workflows call agents.
The call graph is therefore acyclic *by construction*, and no amount of bad prompting can produce
infinite delegation.

**R2 — Only a workflow may wait.** An agent that needs to wait for a human, a reply, or tomorrow
does not sleep — it **returns** a `suspend` outcome naming the resume condition, and the workflow
owns the wait. This is what makes defect 3 impossible: waiting is a return value the runtime
handles, not a sentence the model is asked to obey.

**R3 — Prefer the leftmost column that can do the job.** If the steps are knowable, it is a skill,
not an agent. An agent is the *expensive, non-deterministic* option and is used only where the next
step genuinely cannot be predetermined. Today ~110 tools are handed to one model in one prompt; the
target is that most user goals never invoke an agent at all.

---

## 2. Capability identity

```ts
/** `domain.type.name` — permanent, lowercase, snake_case name. Never reused. */
type CapabilityId = `${string}.${'tool' | 'skill' | 'workflow' | 'agent'}.${string}`;
// email.tool.send_message      commerce.skill.recover_abandoned_cart
// pitch.workflow.cold_outreach leads.agent.research_prospect
```

* **Version is separate and integer.** `@1`, `@2`. A breaking change to inputs, outputs or side
  effects is a new *version*, not a new id.
* **Renaming produces an alias**, never a rewrite. `aliasOf` keeps old plans replayable.
* **Retiring is a status, not a deletion** — `deprecated` then `retired`. A retired capability still
  resolves so historical runs remain auditable. (The current system has 7 dead and 2 stub abilities
  still registered and reachable; this is how that stops happening.)

---

## 3. The capability descriptor

Every capability — tool, skill, workflow or agent — registers this. The Kernel may not call
anything that has not.

```ts
export interface Capability<I = unknown, O = unknown> {
  /* ---------- identity ---------- */
  id: CapabilityId;
  version: number;
  type: 'tool' | 'skill' | 'workflow' | 'agent';
  domain: Domain;                     // closed enum, ~20 values
  owner: string;                      // the module responsible — a person can be paged
  status: 'active' | 'degraded' | 'deprecated' | 'retired';
  aliasOf?: CapabilityId;

  /* ---------- what it is for ---------- */
  summary: string;                    // one line, <=120 chars, written for the planner
  intents: IntentTag[];               // closed vocabulary — see §5
  /** Written for a human reading an audit log, not for a prompt. */
  describe(input: I): string;         // "Send the May recall to 84 contacts"

  /* ---------- contract ---------- */
  input: Schema<I>;                   // zod / JSON-schema. Validated before dispatch.
  output: Schema<O>;                  // validated after. A liar fails loudly.
  preconditions: Precondition[];      // §4 — checked against context, never prose
  produces: ArtifactKind[];           // what lands in the ledger (§02) if it succeeds

  /* ---------- consequences ---------- */
  effect: 'read' | 'write' | 'external' | 'money' | 'irreversible';
  cost: CostModel;                    // §6 — reserve/commit, never charge-first
  timeoutMs: number;                  // hard. The runtime kills it.
  autonomy: AutonomyLevel;            // §7 — capped by `verify`, see the rule there

  /* ---------- doing it more than once ---------- */
  idempotency: IdempotencyPolicy;     // §8
  retry: RetryPolicy;                 // §8
  compensate?: (result: O, ctx: Ctx) => Promise<void>;  // required if effect is write+

  /* ---------- proving it worked ---------- */
  verify: Verifier<O>;                // §9 — MANDATORY. This is the load-bearing field.
  failureModes: FailureCode[];        // known, named, each classified retryable or not

  /* ---------- operating it ---------- */
  health: () => Promise<Health>;      // provider reachable? quota left?
  audit: 'none' | 'summary' | 'full';
}
```

### The five fields that are not negotiable

Most of the descriptor is bookkeeping. Five fields are the reason the system can be trusted to run
unattended, and a capability missing any of them **fails the registration lint and cannot ship**.

| Field | Without it | Defect it closes |
| --- | --- | --- |
| `verify` | "Done" is the model's opinion | 5, 10 |
| `idempotency` | A retry double-sends and double-charges | 6, 7 |
| `effect` + `cost` | Policy cannot reason about risk or spend | 6, 7 |
| `timeoutMs` | One call blocks the whole run | 4 |
| `preconditions` | The rule lives in a prompt instead of the code | 8 |

---

## 4. Preconditions are predicates, not prose

The single largest cause of the current mess is that ~144 instructions live in one prompt, where
they contradict each other and the model is asked to arbitrate. In V5 a rule that governs *whether a
capability may run* lives **on the capability**, as code.

```ts
type Precondition =
  | { kind: 'connection'; provider: ProviderId }          // "Instagram is connected"
  | { kind: 'record'; entity: EntityRef; must: 'exist' | 'absent' }
  | { kind: 'permission'; scope: PermissionScope }
  | { kind: 'consent'; channel: Channel; subject: EntityRef }
  | { kind: 'budget'; credits: number }
  | { kind: 'state'; check: (ctx: Ctx) => Promise<boolean>; describe: string };
```

Preconditions are evaluated by the Kernel **before planning**, not during. A capability whose
preconditions fail is simply not in the shortlist — so the model never sees it, never tries it, and
never has to be told in prose not to.

> This is what replaces "HARD RULE: never post to a channel that is not connected". The model cannot
> break the rule because the option does not exist.

---

## 5. Discovery — the shortlist is bounded, always

**Rule: the planner never sees the catalogue.** With 225 abilities, putting them in a prompt is
what produces the 50–60K prefix and the tool-cycling.

Selection is three deterministic narrowings and one ranked cut:

```
goal.subject ──► domain filter        (deterministic, from the goal schema)
              ──► intent match        (closed vocabulary, set intersection)
              ──► precondition filter (§4 — anything that cannot run is dropped)
              ──► rank by fit, TAKE AT MOST 12
```

`IntentTag` is a **closed vocabulary**, not free text — roughly 60 verbs across the 40 domains
(`publish_content`, `contact_person`, `research_entity`, `generate_media`, `analyse_performance`,
`collect_payment`, …). A capability declares the intents it serves; the planner declares the intent
it needs. Set intersection is exact, cheap, and explainable — three properties an embedding search
does not have.

If the shortlist is empty, that is a **first-class answer** ("I can't do that yet, here's what I'd
need"), not a failure to be retried. If it exceeds 12 after ranking, the goal is too broad and must
be decomposed before planning — the Kernel says so rather than guessing.

---

## 6. Cost: reserve, then commit

Today credits are charged *before* the handler runs, with no refund path, and the per-turn charge
lands before the first model call. A provider hiccup therefore costs the customer money for nothing.

```ts
type CostModel =
  | { kind: 'free' }
  | { kind: 'fixed'; credits: number }
  | { kind: 'estimated'; estimate(input: unknown): number; ceiling: number }
  | { kind: 'metered'; unit: 'second' | 'message' | 'token'; perUnit: number; ceiling: number };
```

The runtime always: **reserve → execute → commit(actual) | release(all)**.

* A reservation that is never committed expires. Crashes refund themselves.
* `ceiling` is enforced by the runtime, not by the capability. A metered capability cannot
  overspend by looping.
* The estimate is shown to the user *before* approval (§7) and the actual is recorded after. A
  capability whose actual repeatedly exceeds its estimate is flagged `degraded` by Flow Observe.

---

## 7. Autonomy, and the rule that makes it safe

```ts
type AutonomyLevel =
  | 0  // suggest   — describe only
  | 1  // draft     — produce an artifact, change nothing
  | 2  // approve   — execute after explicit human approval of this instance
  | 3  // policy    — execute when a standing policy matches
  | 4  // autonomous— execute within hard limits
  | 5; // system    — internal, never user-facing
```

> **A capability may not declare autonomy above 1 unless it has a `verify` that can fail.**

That is the whole safety argument in one line. Levels 3 and 4 mean *nobody is watching*, and the
only thing that makes that acceptable is the system being able to detect for itself that the action
did not achieve what it claimed. A capability that cannot prove its own success is, by definition,
one a human must look at.

`effect: 'irreversible'` caps autonomy at 2 regardless, and requires `compensate` to be absent
*honestly* rather than stubbed — 8 of the 225 abilities are irreversible today.

---

## 8. Idempotency and retry

```ts
type IdempotencyPolicy =
  | { kind: 'natural' }                                   // read-only; safe to repeat
  | { kind: 'key'; from: (input: unknown, ctx: Ctx) => string }  // dedupe window
  | { kind: 'provider'; header: string }                  // pass through to the provider
  | { kind: 'none' };                                     // ⇒ retry.maxAttempts must be 1

interface RetryPolicy {
  maxAttempts: number;                 // 1 means "do not retry"
  backoff: 'none' | 'fixed' | 'exponential';
  retryOn: FailureCode[];              // explicit. Never "any error".
  budgetMs: number;                    // total across attempts
}
```

Retry happens at **the layer that owns the failure**, which is the part the current system has no
concept of:

| Layer | Retries | Never retries |
| --- | --- | --- |
| **Tool** | timeout, 429, 5xx, transient DB conflict | validation, permission, business rejection |
| **Skill** | the *whole* skill, only if every step is idempotent | otherwise resumes at the failed step |
| **Workflow** | resumes at the failed durable step | never restarts from the beginning |
| **Agent** | **never repeats a plan** — it must change an assumption, a capability, or the approach, or it stops |

The last row is the important one. An agent retrying its own plan unchanged is precisely the
observed loop; the runtime rejects a re-plan whose plan hash matches a failed one.

---

## 9. Verify — how "done" is proven

```ts
type Verifier<O> =
  | { kind: 'schema' }                                        // output matched its schema
  | { kind: 'state'; check(o: O, ctx: Ctx): Promise<boolean>; describe: string }
  | { kind: 'external'; poll(o: O, ctx: Ctx): Promise<VerifyResult>; timeoutMs: number }
  | { kind: 'human'; question: string };                      // ⇒ autonomy <= 2

type VerifyResult = { ok: true; evidence: Evidence } | { ok: false; reason: string; code: FailureCode };
```

`schema` alone is the weakest form and is only sufficient for `effect: 'read'`. Anything that writes
must prove the write: *the Post row exists with status published and a platform id*, *the provider
reports the message delivered*. **Evidence goes into the ledger** — and the ledger is how progress
is measured, which is document 02.

---

## 10. Registration is a build-time gate

The registry is compiled, not discovered at runtime. A capability that fails any of these does not
build:

1. `verify` present; `autonomy > 1` requires a `verify` that can return `ok: false`.
2. `effect` ≥ `write` requires `compensate` **or** an explicit `irreversible` declaration.
3. `idempotency: 'none'` requires `retry.maxAttempts === 1`.
4. `timeoutMs` ≤ the caller's remaining budget; a workflow's timeout ≥ the sum of its steps'.
5. Every `failureModes` entry is classified retryable or terminal.
6. `intents` are drawn from the closed vocabulary.
7. `summary` ≤ 120 chars — it goes in a shortlist, not a manual.
8. An agent capability declares no agent in its `calls`. **(R1, enforced by the compiler.)**

---

## 11. Open decisions — I need your call on these

**D1 — Intent vocabulary: closed or learned?**
I have specified a closed ~60-verb vocabulary because it is exact, cheap and explainable. The cost
is that adding a genuinely new kind of action means adding a verb. The alternative is embedding
search over descriptions, which never needs maintenance but cannot explain why it chose something
and degrades quietly as the catalogue grows. **Recommendation: closed, with an explicit
"unmatched intent" report so we see what the vocabulary is missing.**

**D2 — Do we carry the 42 `partial` abilities forward, or finish them first?**
They are the ones most likely to fail `verify`. Carrying them means the registry ships with known
`degraded` entries. **Recommendation: register them at autonomy ≤ 1 until they can prove success.**

**D3 — One credit ledger or per-domain budgets?**
44 abilities spend money. A single balance is simpler; per-domain ceilings ("ads may spend 2,000/mo
without asking") are what actually let autonomy level 4 exist safely. **Recommendation: one
balance, plus per-domain autonomous ceilings in Flow Policy.**

**D4 — Provider choice: in the capability or behind an adapter?**
Today the same job is done by up to four providers chosen by three competing mechanisms that
disagree. The registry can either expose `media.tool.generate_image` (one capability, adapter picks
the provider) or expose the providers. **Recommendation: one capability, adapter chooses, provider
never named to the planner or the user.**

**D5 — What is the first vertical?**
Your phase plan says lead → research → outreach → reply → proposal → PDF → approval → send. That
exercises registry, context, agent, workflow, approval, external providers, long-running state and
analytics in one line. **Recommendation: agreed, and it should be built with exactly one agent
capability in it** — `leads.agent.research_prospect` — so we prove the "prefer deterministic" rule
holds under real pressure.
