# V5 — Goal, Plan, Task and execution state

**Status:** for discussion · **Depends on:** [01 — Flow Registry](./01-capability-registry.md)

Document 01 defined *what the system can do*. This one defines *how it knows what it is doing, whether
it is getting anywhere, and when to stop.* It is the answer to the diagnosis finding that matters
most:

> **No goal object outlives a turn. Plan steps carry a `toolName` that nothing ever executes.**

Everything below exists so that a run can be interrupted, inspected, resumed and audited — and so
that "am I making progress?" is a query, not a judgement call.

---

## 1. The five records

```
Goal          what the user wants, and how we will know it happened
 └─ Plan      an ordered, versioned attempt at achieving it
     └─ Step  one capability call with its own budget and state
         └─ Attempt   one execution of that step (retries make more)
Ledger        the accumulated facts and artifacts — the definition of progress
```

`Goal` and `Ledger` are durable and outlive every turn, every worker and every process. That single
sentence is the difference from the current system.

---

## 2. Goal

A goal is not a sentence. It is a structured object with a **machine-checkable definition of done**,
because otherwise "finished" is whatever the model last said.

```ts
interface Goal {
  id: GoalId;
  workspaceId: WorkspaceId;            // tenancy is on the record, not in the prompt
  origin: 'user' | 'trigger' | 'schedule' | 'workflow';
  originRef?: string;                  // conversation, event or parent run

  /** What the user actually said, kept verbatim and never paraphrased away. */
  utterance?: string;
  /** The normalised form the Kernel planned against. */
  intent: IntentTag;
  subject: EntityRef[];                // the contacts, campaign, store… it concerns
  parameters: Record<string, unknown>; // validated against the intent's schema

  /** How we prove it. Required. A goal without this cannot be started. */
  success: SuccessCriterion[];

  constraints: {
    creditCeiling: number;
    deadline?: Date;
    maxSteps: number;                  // default 12
    autonomy: AutonomyLevel;           // the ceiling for everything under it
    requireApprovalFor: Effect[];      // e.g. ['money', 'irreversible']
  };

  state: GoalState;
  ledgerId: LedgerId;
  createdBy: UserId;
  createdAt: Date;
  resolvedAt?: Date;
  resolution?: { outcome: 'achieved' | 'abandoned' | 'blocked' | 'failed'; because: string };
}

type SuccessCriterion =
  | { kind: 'artifact'; produces: ArtifactKind; count?: number }   // "a rendered proposal PDF exists"
  | { kind: 'state'; check: StateCheck; describe: string }         // "opportunity.stage == 'sent'"
  | { kind: 'event'; awaits: EventType; within?: Duration }        // "a reply arrives"
  | { kind: 'human'; question: string };                           // explicit sign-off
```

```
GoalState:  draft ─► ready ─► active ─┬─► achieved
                                       ├─► blocked   (needs input / approval / a missing connection)
                                       ├─► failed    (terminal)
                                       └─► abandoned (user cancelled, or superseded)
```

**A goal may not enter `ready` without:** at least one `SuccessCriterion`, a credit ceiling, a step
cap, and a resolved workspace. This is the start gate — it is the mechanism behind "an agent may
start only when a structured goal exists".

---

## 3. Plan

A plan is **proposed, versioned and immutable once approved**. Re-planning creates version *n+1* and
supersedes its predecessor; it never mutates it. That is what makes "the agent must not repeat the
same plan" enforceable rather than aspirational.

```ts
interface Plan {
  id: PlanId;
  goalId: GoalId;
  version: number;
  /** Hash over the ordered (capabilityId, normalised input) pairs. Identity of the approach. */
  hash: string;
  rationale: string;                   // one paragraph, shown to the user
  steps: Step[];
  estimatedCredits: number;            // sum of step estimates, shown before approval
  state: 'proposed' | 'approved' | 'executing' | 'superseded' | 'completed' | 'failed';
  supersedes?: PlanId;
  /** Why this attempt differs from the last. Required when `supersedes` is set. */
  changedAssumption?: string;
}
```

> **Re-plan rule.** A new plan whose `hash` matches any previous plan on the same goal is rejected by
> the runtime. If the planner cannot produce a materially different approach, the goal moves to
> `blocked` with the reason — it does not try again. This is the single most direct fix for the
> observed looping.

---

## 4. Step and Attempt

```ts
interface Step {
  id: StepId;
  planId: PlanId;
  ordinal: number;
  capability: CapabilityId;            // must resolve in the registry, §01
  version: number;                     // pinned — a mid-run registry deploy cannot change behaviour
  input: unknown;                      // validated against the capability's input schema
  dependsOn: StepId[];                 // a DAG, not necessarily a line
  /** Copied from the capability at plan time so limits are auditable after the fact. */
  budget: { credits: number; timeoutMs: number; maxAttempts: number };
  state: StepState;
  attempts: Attempt[];
  producedRefs: LedgerEntryId[];       // what it added, if anything
}

type StepState =
  | 'pending' | 'ready' | 'awaiting_approval' | 'running'
  | 'succeeded' | 'failed' | 'skipped' | 'compensated';

interface Attempt {
  n: number;
  startedAt: Date;
  endedAt?: Date;
  outcome: StepOutcome;
  /** hash(capabilityId + version + normalised input) — the loop-detection key. */
  callHash: string;
  resultHash?: string;
  creditsReserved: number;
  creditsCommitted?: number;
  verification?: VerifyResult;
  failure?: { code: FailureCode; retryable: boolean; message: string };
}
```

### The step outcome is a closed union — this is where "STOP" becomes real

```ts
type StepOutcome =
  | { kind: 'succeeded'; output: unknown; evidence: Evidence }
  | { kind: 'suspend'; until: ResumeCondition }   // waiting is a RETURN VALUE
  | { kind: 'needs_approval'; preview: Preview }
  | { kind: 'needs_input'; question: Question }
  | { kind: 'failed'; code: FailureCode; retryable: boolean }
  | { kind: 'rejected'; by: 'policy' | 'precondition'; because: string };

type ResumeCondition =
  | { on: 'event'; type: EventType; match: Matcher; timeout?: Duration }
  | { on: 'time'; at: Date }
  | { on: 'approval'; approvalId: ApprovalId };
```

In the current system `ask_choice` returns the *string* `"STOP and wait"` and the loop feeds it
straight back. Here, `needs_input` and `suspend` are **values the runtime switches on**. The loop
cannot ignore them, because it is not the loop's decision.

---

## 5. The Ledger — progress, defined

A "progress score" is unfalsifiable. Progress here is **monotonic accumulation of established
facts**, which is checkable:

```ts
interface LedgerEntry {
  id: LedgerEntryId;
  goalId: GoalId;
  kind: 'fact' | 'artifact' | 'decision' | 'observation';
  key: string;                         // stable, e.g. 'prospect.acme.contact_email'
  value: unknown;
  evidence: Evidence;                  // which step, which attempt, what proved it
  supersedes?: LedgerEntryId;          // corrections are appends, never edits
  at: Date;
}
```

> **A step made progress iff it appended at least one ledger entry with a new `key`, or discharged
> a precondition that was previously unsatisfied.**

That gives the runtime a definition it can act on:

* Two consecutive steps with **no** progress → stop, diagnose, re-plan **once**.
* A third → `blocked`, escalate to a human with the trace.
* The ledger — not the transcript — is what the next turn reads. **This is the fix for defects 1
  and 2.** A turn is not "the last N messages"; it is *the goal, the plan, and everything
  established so far*. It cannot be lost by an `orderBy` mistake because it is not a window over
  chat, and it does not grow without bound because entries are keyed and superseded rather than
  appended blindly.

---

## 6. Loop prevention, concretely

Every attempt records `callHash` and `resultHash`. The runtime blocks, in order:

| Signal | Threshold | Action |
| --- | --- | --- |
| Same `callHash` succeeded already in this goal | 1 | Reuse the ledger entry. Do not call. |
| Same `callHash` + same `resultHash` | 2nd occurrence | Block the step, force re-plan |
| Same `callHash`, different result, no ledger growth | 3rd occurrence | Block, escalate |
| Plan `hash` seen before on this goal | 1 | Reject the plan (§3) |
| Steps executed | `constraints.maxSteps` | Stop, report partial result **with the ledger** |
| Credits committed | `constraints.creditCeiling` | Stop, report, ask to raise |
| Wall clock | `constraints.deadline` | Suspend, not kill — resumable |
| Consecutive non-progress steps | 2 | Re-plan once; 3 → `blocked` |

Note the first row: because results are in the ledger, a repeat call is *answered from the ledger*
rather than re-executed. The current system re-calls and re-charges because it has nowhere to look.

**Terminating is never silent.** Hitting any limit produces a resolution with the reason, the ledger
so far, and the next action available to the user. Defect 4 was that the cap discarded the last
result; here the ledger is the result.

---

## 7. The control loop

This is the whole Kernel, and it is deliberately small. It is a state machine, not a conversation.

```
              ┌──────────────────────────────────────────┐
              ▼                                          │
  goal(ready) ─► load context ─► shortlist (≤12) ─► plan ─┤
                                                          │
                     ┌────────────────────────────────────┘
                     ▼
              policy check ──reject──► blocked (explain)
                     │
                     ▼
              next ready step
                     │
              ┌──────┴───────┐
              ▼              ▼
        needs_approval    execute (reserve → run → verify → commit)
              │                     │
              │              ┌──────┴───────────────────────────┐
              ▼              ▼          ▼         ▼             ▼
           suspend       succeeded   suspend   failed        rejected
              │              │          │      ┌──┴───┐          │
              │              ▼          │  retryable  terminal   │
              │        append ledger    │      │        │        │
              │              │          │      ▼        ▼        ▼
              │              ▼          │   retry    re-plan  blocked
              │      success criteria met?          (once)
              │              │
              │      ┌───────┴────────┐
              │     yes              no ──► progress? ──no──► re-plan/blocked
              │      │                          │yes
              ▼      ▼                          └──► next step
          (workflow owns the wait)
                  achieved
```

Two properties worth naming:

* **The model never decides to stop.** Termination is the runtime evaluating success criteria and
  budgets. The model proposes; the runtime disposes.
* **Every arrow is a persisted transition.** An operator can answer "what is it doing and why" from
  the database, without a log. Defect 10 was that they could not.

---

## 8. Context assembly — bounded by construction

The context handed to a planner or agent is **built, not accumulated**. It is assembled per step
from the goal, and it has a token budget the assembler enforces.

```ts
interface ContextPackage {
  goal: Goal;                          // including success criteria — it must know what "done" is
  workspace: WorkspaceFacts;           // brand, plan, connected channels, locale
  actor: { userId; permissions; autonomyCeiling };
  location?: { surface: string; recordRef?: EntityRef };   // what the user is looking at
  ledger: LedgerEntry[];               // this goal's facts — the memory that matters
  plan?: { current: Plan; failedApproaches: { hash; changedAssumption }[] };
  shortlist: CapabilitySummary[];      // ≤12, from §01 §5
  policies: PolicyStatement[];         // only those that apply to the shortlist
  budget: { creditsLeft; stepsLeft; deadline? };
  conversation?: { summary: string; lastTurns: Message[] };  // summary + recent, NOT a window
}
```

Three rules:

1. **A fixed prefix and a variable suffix.** The prefix (kernel instructions, output contract) is
   byte-stable and cacheable. Defect 9 was a timestamp in the prefix busting the cache every turn —
   nothing volatile may appear before the cache breakpoint.
2. **The ledger is the memory, the transcript is not.** Conversation is a rolling *summary* plus the
   last few turns. It cannot silently drop the middle, because the middle's *facts* are in the
   ledger.
3. **The assembler enforces a budget** and reports what it dropped. Silent truncation of tool output
   with a byte slice — which currently hands the model malformed JSON — is replaced by structured
   summarisation with an explicit "N more, ask to see them" marker.

---

## 9. Approval

```ts
interface Approval {
  id: ApprovalId;
  goalId: GoalId; stepId: StepId;
  requiredBecause: 'autonomy' | 'policy' | 'effect' | 'ceiling';
  preview: Preview;                    // what will happen, rendered — not a paraphrase
  estimate: { credits: number; money?: Money; reach?: number };
  expiresAt: Date;                     // an approval is not valid forever
  decision?: { by: UserId; at: Date; outcome: 'approved' | 'rejected'; note?: string };
  consumedByAttempt?: number;          // ⇒ single use
}
```

Two properties fix defect 6 directly: an approval **expires**, and it is **consumed by the attempt
that used it** — success or failure. A failing step cannot silently re-authorise itself, because the
authorisation is spent.

---

## 10. What this changes, defect by defect

| # | Defect today | Mechanism that prevents it |
| --- | --- | --- |
| 1 | History loaded backwards | Ledger is the memory; transcript is summary + recent (§5, §8) |
| 2 | Tool calls die with the turn | Attempts and ledger entries are durable rows (§4, §5) |
| 3 | "STOP" is prose | `suspend` / `needs_input` are typed outcomes the runtime switches on (§4) |
| 4 | Cap terminates silently | Every limit produces a resolution + the ledger (§6) |
| 5 | No goal outlives a turn | `Goal` is the root record; steps are executed by the runtime (§2–4) |
| 6 | Plan re-authorises on failure | Approvals expire and are consumed per attempt (§9) |
| 7 | No retry / idempotency | Declared per capability, enforced per layer (§01 §8) |
| 8 | 144 contradictory directives | Rules are preconditions and policies on capabilities (§01 §4) |
| 9 | 50–60K prefix, cache busted | Bounded assembly, stable prefix, ≤12 shortlist (§8, §01 §5) |
| 10 | Repeats identical calls, invisible | `callHash` blocking + persisted transitions (§6, §7) |

---

## 11. Open decisions — your call

**D6 — Who plans?** A model proposing a plan the runtime validates, or a deterministic planner for
known intents with a model only for unknown ones? **Recommendation: deterministic first.** Most of
the 225 abilities serve intents with an obvious plan; a model that plans "send an email campaign"
from scratch every time is the expensive way to get a worse answer.

**D7 — Ledger scope.** Per goal (proposed above), or per workspace with goal tagging? Per-goal is
simpler and bounded. Cross-goal facts ("this prospect's email") arguably belong to the *customer*,
not the goal. **Recommendation: per-goal ledger, promoting durable facts into Flow Memory on
resolution — one directional flow, no ambiguity about the source of truth.**

**D8 — Step granularity.** Should a step be one capability call, or may a step be a whole skill?
Above, a step is one capability of any type, so a skill is one step and its internals are its own
business. That keeps plans short and readable. **Confirm you're happy that a failed skill resumes
internally rather than the plan seeing its steps.**

**D9 — What happens to the 42 `partial` abilities on day one?** They are the most likely to fail
`verify` in production. **Recommendation: registered, autonomy ≤ 1, and Flow Observe reports their
verify-failure rate so we finish the ones that actually get used.**

---

## Next artifacts, in order

1. **Intent vocabulary** — the ~60 verbs, mapped to the 40 domains. Blocks D1 and the shortlist.
2. **Domain boundaries** — which of the 40 surveyed domains become owning modules (I would merge to
   ~16), and who owns each of the 225 abilities.
3. **Flow Policy spec** — the standing rules, autonomy defaults and per-domain ceilings.
4. **The first vertical** — lead → proposal, built end to end with exactly one agent in it.
