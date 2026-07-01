# Lead → Close CRM Playground — plan

**Goal:** turn the Lead Finder into a full agent-assisted **find → enrich → list → outreach → pitch → opportunity → close → ROI** pipeline, built as a step-by-step flow-builder playground. **Data = AI + web-search finding** (no paid provider). Build **phase by phase**.

## Reuse (already built — ~70%)
- **Lead Finder** — `leads-workspace.tsx` (`/home/leads`), `SavedLead` / `SavedLeadList` / `LeadSearch`, `/api/leads/*`.
- **Pitch/Proposal** — `pitch-workspace.tsx`, `Pitch` model (pitch + service_proposal), `create_pitch` / `create_proposal` tools, `/api/pitch/*` (send + PDF).
- **Contacts CRM** — `outreach-workspace.tsx`, `Contact` / `ContactList` / `ContactListMember`, import/export, `to-contacts`.
- **Outreach automations** — `automations-workspace.tsx` (email/SMS flow builder) for follow-ups.
- **Playground patterns** — ad-builder node-wizard + automations flow-builder + the agent bridge (`canvas_update`, ops refs, `focusedSurfaceContext` gating).

## Backend to add (widen the model)
- **`Company`** — name, domain, industry, employeeSize, revenueBand, yearFounded, location, techStack[], socials{linkedin,x,facebook,google}, enrichment JSON + `enrichedAt` (cache).
- **`SavedLead` → person-capable** — add `title`, `seniority`, `department`, `email`, `phones` JSON, `socials` JSON, `companyId`, `enrichedAt`, `enrichmentSource`. (Keeps existing lists + pitch links + status.)
- **`Opportunity`** (deal) — title, value, currency, stage (enum), probability, status (open/won/lost), source, expectedCloseAt, closedAt, leadId?, contactId?, companyId?, pitchId?.
- **`PipelineStage`** — configurable per user (name, order, isWon/isLost) with sensible defaults (New → Contacted → Qualified → Proposal → Negotiation → Won / Lost).
- **`Activity`** — type (note|email|sms|call|meeting|stage_change|pitch_sent), subject, body, at, links (leadId?/contactId?/opportunityId?). Powers the timeline + ROI.
- New APIs: `/api/companies/*`, `/api/opportunities/*`, `/api/activities/*`, `/api/leads/enrich`.

## New agent tools (AI + web-search)
- `find_leads({ mode: contacts|companies, industry, employeeSize, revenue, seniority, department, technologies, keywords, location, titles, yearFounded, limit })` → web-search + extract real companies/decision-makers → SavedLead rows (contact fields masked until enriched).
- `enrich_lead({ leadId })` / `enrich_leads({ listId })` → reveal email/phone/socials from public sources (uses existing `analyze-url` / `web-fetch`). Costs credits per enrichment.
- `create_opportunity` / `advance_opportunity` / `log_activity`.
- `run_lead_autopilot({ filters, listName, outreach })` → find → enrich → add-to-list → kick off outreach automation → create opportunities, agent-confirmed with a credit estimate.
- Reuse `create_pitch` / `create_proposal`, now attachable to an Opportunity.

## The playground (one surface, agent on the left)
A **Deal Flow** builder that connects the stages as nodes you configure step-by-step (clone ad-builder/automations canvas), plus rich views:
1. **Find** — Contacts / Companies tabs, rich filter rail (Industry, Revenue, Employee Size, Seniority, Technologies, Department, Keywords, Year Founded, Location, Title), results table (Name, Title, Company, Emails, Phones, Sources), per-row **Find** + **Find All** enrichment, **Add to list**, **Begin Autopilot**. Agent-assisted from the composer.
2. **Lists** — manage saved lead lists (reuse).
3. **Pipeline** — Kanban of Opportunities across stages, drag to advance; create from a lead; attach a pitch.
4. **Pitch** — generate/send pitch or proposal for a lead/opportunity (reuse), logged as an Activity.
5. **ROI** — Sales ROI (Leads / Opportunities / Revenue), Cost Savings (cost per lead/opp/sale, credits-based), Time Saved, TAM, and a deals table (Company · Contact · Opportunity Status · Revenue · Opp Created · Opp Closed).

## Phases (each: mock → build → type-check → screenshot → commit)
- **P0 — Backend:** Prisma models (Company, Opportunity, PipelineStage, Activity) + SavedLead person fields; migrations; APIs. No UI yet.
- **P1 — Find playground:** Contacts/Companies tabs + filter rail + results table + enrichment + add-to-list; `find_leads` + `enrich_lead` tools (agent-assisted).
- **P2 — Pipeline (Kanban):** Opportunity board + create/advance + attach pitch; `create_opportunity`/`advance_opportunity`.
- **P3 — Pitch/opportunity integration + Activity timeline** (reuse pitch tools; log activities).
- **P4 — ROI dashboard** (the "You close the deals" view).
- **P5 — Autopilot** (`run_lead_autopilot`, agent runs the flow end-to-end + follow-ups).

## Guardrails
Agent-first (it does the work, confirms costs); credit-based (enrichment/find/pitch priced via admin cost keys, never hardcoded); new-design surfaces only; full-width sticky-left-menu playground layout; visually validated at every step. "Demo data for illustrative purposes only" is a marketing artifact — our data is real AI/web-found.
