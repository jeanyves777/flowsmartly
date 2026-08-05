# V5 — Intent vocabulary

**Status:** for review · **Implements:** [D1](./00-decisions.md#d1--intent-vocabulary-closed-with-semantic-routing--locked) ·
**Depends on:** [01 — Registry](./01-capability-registry.md), [02 — Execution model](./02-execution-model.md)

The closed, canonical set of executable intents. Every plan, policy, approval and audit row cites an
id from this file. Nothing executes against an intent that is not here.

**71 intents across the 16 locked domains.** Derived from the 225 surveyed abilities — every intent
below is something the platform demonstrably does or is half-way to doing; none were invented to
round the number up.

---

## 1. The declaration

```yaml
id: create_email_campaign          # canonical, permanent, snake_case
domain: messaging                  # one of the 16 owners
summary: >                         # one line, for the planner shortlist
  Compose and schedule an email campaign to a defined audience.

required_slots: [audience, objective]
optional_slots: [send_at, template, tone, offer]

default_plan: messaging.workflow.email_campaign.v1   # D6 — deterministic first
allowed_agent_use: false           # may a reasoning agent be used at all?
permitted_agents: []               # if so, exactly which — never "any"

success_facts:                     # ledger keys that must exist to call it done
  - campaign.created
  - campaign.scheduled
blocking_facts:                    # facts that make it impossible; report, do not retry
  - channel.email.not_connected
  - audience.empty
  - consent.suppressed_all

default_autonomy: 1                # 0 suggest · 1 draft · 2 approve · 3 policy · 4 auto
approval:
  required_when: [effect_send, cost_above:200]
  preview: rendered_email_and_recipient_count
verifier: messaging.verify.campaign_scheduled     # A4 — independent source
cost_class: metered                # free · light · standard · heavy · metered
irreversibility: recallable        # none · recallable · irreversible
owner: messaging
```

### Field rules

* **`success_facts` are ledger keys**, not prose. They are the machine-checkable definition of done
  ([02 §5](./02-execution-model.md)). An intent with none cannot be planned.
* **`blocking_facts` produce a report, never a retry.** "Instagram is not connected" is an answer.
* **`allowed_agent_use: false` is the default.** 61 of 71 intents are false. Where it is true,
  `permitted_agents` names them exactly — R1 means those agents cannot delegate onward.
* **`irreversibility: irreversible` caps autonomy at 2** regardless of what is declared.
* **`cost_class`** — `free` (0) · `light` (≤5) · `standard` (≤50) · `heavy` (>50) ·
  `metered` (per unit, with a ceiling).

---

## 2. Routing — natural language to canonical id

```
utterance
   │
   ├─ slot extraction (structured)
   ├─ candidate intents (embedding + lexical, ranked)   ← LLM allowed HERE ONLY
   │
   ▼
resolve
   ├─ single confident match      → intent: <id>, missing slots asked for
   ├─ ordered multi-intent        → a goal per intent, sequenced
   ├─ ambiguous (top-2 close)     → ask the user which
   └─ nothing above threshold     → intent: unknown  ← reported, never coerced
```

`intent: unknown` is a **first-class outcome**. It records the utterance and the top candidates so
the vocabulary's gaps are visible. That report is the only sanctioned way this file grows.

---

## 3. The vocabulary

Legend — **Ag** = agent permitted · **Aut** = default autonomy · **Appr** = approval trigger
(`—` none, `send` on dispatch, `spend` above ceiling, `always`) · **Irr** = irreversibility
(`n` none · `r` recallable · `I` irreversible).

### 1 · Identity & Access

| id | summary | Ag | Aut | Appr | Cost | Irr |
| --- | --- | --- | --- | --- | --- | --- |
| `identify_actor` | Resolve who is asking and what they may do | — | 5 | — | free | n |
| `manage_team_access` | Invite, change role, or revoke a teammate | — | 2 | always | free | I |
| `set_user_preference` | Language, notifications, appearance | — | 3 | — | free | n |

### 2 · Organizations & Workspaces

| id | summary | Ag | Aut | Appr | Cost | Irr |
| --- | --- | --- | --- | --- | --- | --- |
| `configure_workspace` | Business details, locale, operating hours | — | 2 | — | free | r |
| `define_brand_identity` | Logo, palette, typography, tone of voice | — | 1 | — | light | r |

### 3 · Customers & CRM

| id | summary | Ag | Aut | Appr | Cost | Irr |
| --- | --- | --- | --- | --- | --- | --- |
| `find_customer` | Look up people or companies already known | — | 4 | — | free | n |
| `record_customer` | Create or update a contact / company (upsert) | — | 3 | — | free | r |
| `import_customers` | Bulk load from a file or connected source | — | 2 | always | light | r |
| `segment_customers` | Build or refresh an audience from rules | — | 3 | — | light | n |
| `review_customer_history` | Everything that happened with this customer | — | 4 | — | free | n |
| `track_opportunity` | Create a deal or move it between stages | — | 3 | — | free | r |
| `forget_customer` | Erase a customer on request | — | 2 | always | free | **I** |

### 4 · Leads & Prospecting

| id | summary | Ag | Aut | Appr | Cost | Irr |
| --- | --- | --- | --- | --- | --- | --- |
| `find_leads` | Discover businesses or people matching a profile | — | 2 | spend | metered | n |
| `qualify_leads` | Validate, deduplicate and score against targeting | — | 3 | — | light | n |
| `enrich_lead` | Add firmographics, contacts, signals | — | 3 | spend | metered | n |
| `research_prospect` | Understand one prospect's situation in depth | ✓ | 1 | — | standard | n |
| `create_outreach_campaign` | Build a multi-step outreach sequence | — | 1 | — | standard | r |
| `send_outreach` | Dispatch the next due outreach step | — | 2 | send | metered | **I** |
| `classify_reply` | Decide what an inbound reply means | — | 3 | — | light | n |

### 5 · Content & Assets

| id | summary | Ag | Aut | Appr | Cost | Irr |
| --- | --- | --- | --- | --- | --- | --- |
| `plan_content_campaign` | Turn a brief into a dated set of posts | ✓ | 1 | — | standard | r |
| `write_content` | Draft a caption, article or piece of copy | — | 1 | — | light | n |
| `generate_image` | Produce an image from a prompt or reference | — | 1 | spend | standard | n |
| `edit_image` | Change what is in an existing image | — | 1 | spend | standard | n |
| `create_design` | Compose a branded multi-element design | — | 1 | spend | standard | r |
| `create_document` | Produce a structured document (plan, brief, report) | ✓ | 1 | — | standard | n |
| `organise_assets` | Find, tag or version library media | — | 3 | — | free | r |

### 6 · Video & Voice

| id | summary | Ag | Aut | Appr | Cost | Irr |
| --- | --- | --- | --- | --- | --- | --- |
| `generate_video` | Produce a video from a prompt, script or stills | — | 1 | spend | heavy | n |
| `produce_video_campaign` | Multi-scene film from a brief, with continuity | ✓ | 1 | spend | heavy | r |
| `create_presenter_video` | A person on camera delivering a script | — | 1 | spend | heavy | n |
| `edit_video` | Cut, reframe, caption or assemble existing footage | — | 1 | spend | standard | n |
| `create_voiceover` | Narration in a chosen or cloned voice | — | 1 | spend | standard | n |
| `clone_voice` | Register a consented voice for reuse | — | 2 | always | standard | **I** |
| `clone_likeness` | Register a consented face/avatar for reuse | — | 2 | always | heavy | **I** |

### 7 · Training & Learning

| id | summary | Ag | Aut | Appr | Cost | Irr |
| --- | --- | --- | --- | --- | --- | --- |
| `create_training` | Build a lesson, deck or course from a brief | ✓ | 1 | — | heavy | r |
| `run_live_session` | Host a live room and record it | — | 2 | — | metered | r |
| `manage_enrolment` | Enrol, track progress, issue certificates | — | 3 | — | light | r |

### 8 · Social

| id | summary | Ag | Aut | Appr | Cost | Irr |
| --- | --- | --- | --- | --- | --- | --- |
| `publish_post` | Post now or schedule to connected channels | — | 2 | send | light | **I** |
| `cancel_scheduled_post` | Pull a post before it goes | — | 3 | — | free | r |
| `engage_audience` | Reply to comments, mentions and DMs | — | 2 | send | light | **I** |

### 9 · Messaging

| id | summary | Ag | Aut | Appr | Cost | Irr |
| --- | --- | --- | --- | --- | --- | --- |
| `create_email_campaign` | Compose and schedule email to an audience | — | 1 | send | metered | r |
| `create_sms_campaign` | Compose and schedule SMS/MMS to an audience | — | 1 | send | metered | r |
| `send_message` | One message to one recipient | — | 2 | send | light | **I** |
| `build_journey` | Triggered, timed, multi-step follow-up | — | 1 | always | standard | r |
| `manage_consent` | Opt-in, opt-out, suppression, preferences | — | 3 | — | free | r |
| `handle_inbound_message` | Route, answer or escalate an inbound message | ✓ | 2 | send | light | **I** |

### 10 · Advertising

| id | summary | Ag | Aut | Appr | Cost | Irr |
| --- | --- | --- | --- | --- | --- | --- |
| `plan_ad_campaign` | Objective, audience, budget and creative plan | ✓ | 1 | — | standard | n |
| `generate_ad_creative` | Produce the creative and copy variants | — | 1 | spend | standard | n |
| `launch_ad_campaign` | Push a campaign live and start spending | — | 2 | always | metered | **I** |
| `adjust_ad_budget` | Raise, lower or reallocate spend | — | 2 | always | metered | r |
| `pause_ad_campaign` | Stop delivery | — | 3 | — | free | r |

### 11 · Commerce

| id | summary | Ag | Aut | Appr | Cost | Irr |
| --- | --- | --- | --- | --- | --- | --- |
| `build_storefront` | Generate and deploy a store | — | 2 | always | heavy | r |
| `manage_product` | Create, update, price or retire a product | — | 3 | — | free | r |
| `manage_inventory` | Stock levels, variants, availability | — | 3 | — | free | r |
| `process_order` | Confirm, fulfil or refund an order | — | 2 | always | free | **I** |
| `recover_abandoned_cart` | Win back a cart that was left | — | 2 | send | metered | r |
| `configure_payments` | Providers, methods, regions, tax | — | 2 | always | free | r |

### 12 · Websites & Local Presence

| id | summary | Ag | Aut | Appr | Cost | Irr |
| --- | --- | --- | --- | --- | --- | --- |
| `build_website` | Generate and deploy a site from a description | — | 2 | always | heavy | r |
| `edit_website` | Change copy, layout, pages or theme | — | 2 | — | standard | r |
| `publish_landing_page` | A single campaign page with a capture form | — | 2 | — | standard | r |
| `find_domain` | Search availability and price | — | 3 | — | light | n |
| `acquire_domain` | Register or transfer a domain | — | 2 | always | metered | **I** |
| `connect_domain` | Point a domain at a site or store | — | 2 | — | free | r |
| `sync_business_listing` | Push hours, details and photos to directories | — | 3 | — | light | r |
| `respond_to_review` | Reply to a customer review | — | 2 | send | light | **I** |
| `audit_local_presence` | Where the business appears and how accurately | — | 3 | — | standard | n |

### 13 · Pitch & Sales

| id | summary | Ag | Aut | Appr | Cost | Irr |
| --- | --- | --- | --- | --- | --- | --- |
| `assess_opportunity` | Read a prospect's situation and fit | ✓ | 1 | — | standard | n |
| `draft_proposal` | Scope, deliverables, timeline and price | ✓ | 1 | — | standard | n |
| `render_proposal` | Produce the branded PDF | — | 1 | — | light | n |
| `send_proposal` | Deliver it to the prospect | — | 2 | always | light | **I** |
| `track_proposal` | Opens, engagement, acceptance | — | 4 | — | free | n |

### 14 · Automation & Agents

| id | summary | Ag | Aut | Appr | Cost | Irr |
| --- | --- | --- | --- | --- | --- | --- |
| `define_automation` | A trigger, conditions and the actions to take | — | 1 | always | free | r |
| `run_workflow` | Start a registered durable workflow | — | 3 | — | free | r |
| `configure_agent` | Install, scope, permission or disable an agent | — | 2 | always | free | r |
| `inspect_run` | What a run did, is doing, and why | — | 4 | — | free | n |
| `cancel_run` | Stop a run and compensate what it has done | — | 3 | — | free | r |

### 15 · Analytics & Attribution

| id | summary | Ag | Aut | Appr | Cost | Irr |
| --- | --- | --- | --- | --- | --- | --- |
| `analyse_performance` | How a channel, campaign or asset performed | — | 4 | — | light | n |
| `attribute_revenue` | Which activity earned which money | — | 4 | — | standard | n |
| `explain_change` | Why a number moved | ✓ | 1 | — | standard | n |
| `generate_report` | Assemble and deliver a recurring report | — | 3 | — | light | n |
| `detect_anomaly` | Surface something that needs attention | — | 3 | — | light | n |

### 16 · Platform, Billing & Integrations

| id | summary | Ag | Aut | Appr | Cost | Irr |
| --- | --- | --- | --- | --- | --- | --- |
| `connect_provider` | OAuth or key-connect an external account | — | 2 | always | free | r |
| `disconnect_provider` | Revoke and remove a connection | — | 2 | always | free | **I** |
| `review_usage` | Credits and spend, by domain and period | — | 4 | — | free | n |
| `purchase_credits` | Top up the balance | — | 2 | always | metered | **I** |
| `manage_subscription` | Change or cancel a plan | — | 2 | always | metered | **I** |
| `notify_user` | Send an in-product or push notification | — | 4 | — | free | r |
| `report_capability_gap` | Record that the vocabulary could not serve a request | — | 5 | — | free | n |

**Totals** — 71 intents · agent permitted on **10** (14%) · irreversible **19** ·
default autonomy ≥ 3 on **21** (the safe reads and reversible writes).

---

## 4. Fully specified — the `lead_to_proposal.v1` intents

These seven are the ones the first vertical executes, given in full.

```yaml
- id: find_leads
  domain: leads
  summary: Discover businesses or people matching a target profile.
  required_slots: [target_profile]            # industry | role | geography at minimum
  optional_slots: [count, exclude_existing, sources]
  default_plan: leads.workflow.discover.v1
  allowed_agent_use: false
  success_facts: [leads.discovered]
  blocking_facts: [targeting.underspecified, provider.places.unavailable, budget.exhausted]
  default_autonomy: 2
  approval: { required_when: [cost_above:100], preview: profile_and_expected_count }
  verifier: leads.verify.discovered_count_matches_stored
  cost_class: metered
  irreversibility: none
  owner: leads

- id: qualify_leads
  domain: leads
  summary: Validate contactability, remove duplicates, score against targeting rules.
  required_slots: [lead_set]
  optional_slots: [scoring_rules, minimum_score]
  default_plan: leads.skill.qualify.v1
  allowed_agent_use: false                    # deterministic — D6
  success_facts: [leads.qualified, leads.deduplicated]
  blocking_facts: [lead_set.empty]
  default_autonomy: 3
  approval: { required_when: [], preview: null }
  verifier: leads.verify.no_duplicates_and_all_scored
  cost_class: light
  irreversibility: none
  owner: leads

- id: research_prospect
  domain: leads
  summary: Build an evidenced picture of one prospect's business situation.
  required_slots: [prospect]
  optional_slots: [depth, focus]
  default_plan: null                          # genuinely open-ended — agent territory
  allowed_agent_use: true
  permitted_agents: [pitch.agent.opportunity_strategist]
  success_facts: [prospect.profile, prospect.signals]
  blocking_facts: [prospect.no_public_presence]
  default_autonomy: 1
  approval: { required_when: [], preview: null }
  verifier: leads.verify.every_claim_has_source_url    # A4 — every claim carries a source
  # NOTE: native citations and constrained structured output are mutually exclusive, so the
  # source travels as a `source_url` FIELD in the schema rather than as a citation block.
  cost_class: standard
  irreversibility: none
  owner: leads

- id: create_outreach_campaign
  domain: leads
  summary: Build a multi-step outreach sequence for a qualified list.
  required_slots: [lead_set, objective]
  optional_slots: [tone, step_count, spacing, sender]
  default_plan: leads.workflow.outreach_sequence.v1
  allowed_agent_use: false
  success_facts: [sequence.created, sequence.steps_ready]
  blocking_facts: [channel.email.not_connected, sender.unverified, consent.required]
  default_autonomy: 1
  approval: { required_when: [always], preview: full_sequence_and_recipients }
  verifier: leads.verify.every_step_has_body_and_schedule
  cost_class: standard
  irreversibility: recallable
  owner: leads

- id: send_outreach
  domain: leads
  summary: Dispatch the next due step of an approved sequence.
  required_slots: [sequence, step]
  optional_slots: []
  default_plan: leads.workflow.outreach_send.v1
  allowed_agent_use: false
  success_facts: [outreach.dispatched, outreach.accepted_by_provider]
  blocking_facts: [approval.missing, consent.suppressed, daily_cap.reached, reply.received]
  default_autonomy: 2
  approval: { required_when: [send], preview: rendered_message_and_recipient }
  verifier: messaging.verify.provider_delivery_receipt   # A4 — provider, not our own return
  cost_class: metered
  irreversibility: irreversible
  owner: leads

- id: draft_proposal
  domain: pitch
  summary: Produce scope, deliverables, timeline and pricing for an opportunity.
  required_slots: [opportunity, strategy]     # `strategy` comes from the agent's structured output
  optional_slots: [template, currency, margin_floor]
  default_plan: pitch.workflow.compose_proposal.v1
  allowed_agent_use: true
  permitted_agents: [pitch.agent.opportunity_strategist]
  success_facts: [proposal.drafted, proposal.priced]
  blocking_facts: [strategy.missing, pricing.below_margin_floor, brand_kit.incomplete]
  default_autonomy: 1
  approval: { required_when: [], preview: null }        # drafting changes nothing
  verifier: pitch.verify.all_required_sections_present_and_priced
  cost_class: standard
  irreversibility: none
  owner: pitch

- id: send_proposal
  domain: pitch
  summary: Deliver a rendered proposal to the prospect and start tracking it.
  required_slots: [proposal, recipient]
  optional_slots: [message, expiry]
  default_plan: pitch.workflow.deliver_proposal.v1
  allowed_agent_use: false
  success_facts: [proposal.sent, proposal.tracking_active]
  blocking_facts: [proposal.unrendered, approval.missing, recipient.unreachable]
  default_autonomy: 2
  approval: { required_when: [always], preview: pdf_and_covering_message }
  verifier: pitch.verify.delivery_receipt_and_tracking_pixel_live
  cost_class: light
  irreversibility: irreversible
  owner: pitch
```

Note what the vertical demonstrates: **six of seven intents are `allowed_agent_use: false`**. The one
reasoning agent appears twice — to research and to strategise — and touches nothing that sends,
charges or renders. That is D6 and the R1/R2 boundaries proving themselves under real load.

---

## 5. Governance

* **Adding an intent** requires: a real user need evidenced by `report_capability_gap` volume, an
  owning domain, at least one `success_fact`, and a verifier. Convenience aliases are not intents.
* **Renaming** produces an alias; the old id keeps resolving so historical goals replay.
* **Retiring** marks `deprecated` — no new goals, existing ones finish.
* **The vocabulary is versioned as a whole.** A goal records the vocabulary version it was planned
  against, so a run started last month is still interpretable today.

---

## 6. Open — needs your call

**V1 — `handle_inbound_message` is the only autonomous agent-permitted intent that sends.**
Everything else an agent touches is draft-only. Inbound replies are also the one place where
latency genuinely matters (a customer is waiting). Options: keep it at autonomy 2 with approval on
send and accept the delay, or allow autonomy 3 under a policy with a whitelist of reply types.
**Recommendation: autonomy 2 to start.** Loosen it once we have verify-failure data, not before.

**V2 — `forget_customer` is irreversible and legally required to be prompt.** It sits at autonomy 2
with mandatory approval, which is right for safety but means a GDPR erasure waits for a human.
**Recommendation: keep the approval, add an SLA alert** so a pending erasure escalates rather than
sitting.

**V3 — Should `find_leads` and `enrich_lead` share one metered budget?** Both spend per record and
both are easy to run repeatedly. **Recommendation: one prospecting budget with a per-domain
ceiling** (D3 in doc 01), so a lead hunt cannot quietly consume the month's credits.

---

## Next: [04 — Domain boundaries](./04-domain-boundaries.md)

Which of the 225 abilities each of the 16 domains owns, and the invariant each domain protects.
