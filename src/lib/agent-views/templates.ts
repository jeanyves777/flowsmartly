/**
 * Curated view templates — pure functions that turn domain data into a ViewSpec.
 * These are the first entries of the "views library": a skill (or the host) calls
 * one to render a rich, interactive view in the chat. The agent can also compose
 * a spec by hand (the generative path) using the same blocks.
 */

import type { ViewSpec, ViewBlock } from "./spec";

/** A live film/story-ad build — scenes fill in, preview + open when ready. */
export function filmBuilderView(input: {
  id: string;
  title: string;
  status: "running" | "done" | "failed";
  progress: number;
  scenes: { status?: string; thumbnailUrl?: string | null }[];
  finalVideoUrl?: string | null;
  skill?: string;
}): ViewSpec {
  const ready = input.scenes.filter((s) => s.status === "ready").length;
  const body: ViewBlock[] = [
    { type: "status", text: input.status === "done" ? "Ready" : input.status === "failed" ? "Render failed" : "Rendering…", state: input.status === "done" ? "done" : input.status === "failed" ? "failed" : "running", progress: input.progress },
    { type: "mediaStrip", aspect: "9:16", items: input.scenes.map((s) => ({ url: s.thumbnailUrl || null, status: (s.status === "ready" ? "ready" : s.status === "rendering" || s.status === "queued" ? "busy" : "pending") as "ready" | "busy" | "pending" })), action: { event: "open_scene", href: `/home/director` } },
    { type: "progress", value: input.progress, label: `${ready}/${input.scenes.length} scenes ready` },
  ];
  const footer: ViewBlock[] = [
    { type: "button", label: input.finalVideoUrl ? "▶ Play film" : "▶ Preview", variant: "primary", disabled: ready === 0 && !input.finalVideoUrl, action: { event: "preview_film", payload: { id: input.id }, href: input.finalVideoUrl || undefined } },
    { type: "button", label: "Open in Video Studio →", action: { event: "open_studio", href: "/home/director" } },
  ];
  return { name: "film-builder", source: "library", skill: input.skill || "story_ad", title: input.title, subtitle: `${input.scenes.length} scenes`, icon: "🎬", badge: { text: input.status === "done" ? "Ready" : `${Math.round(input.progress)}%`, tone: input.status === "done" ? "success" : "brand" }, body, footer };
}

/** A scored leads result — save the ones you like, or open the Lead Studio. */
export function leadsTableView(leads: { id?: string; name: string; location?: string; score?: number }[], skill = "find_leads"): ViewSpec {
  return {
    name: "leads-table", source: "library", skill, title: "Leads", subtitle: `${leads.length} result${leads.length === 1 ? "" : "s"}`, icon: "🔎",
    body: [
      { type: "table",
        columns: [{ key: "name", label: "Business" }, { key: "location", label: "Area" }, { key: "score", label: "Score", align: "right", kind: "score" }],
        rows: leads.map((l) => ({ name: l.name, location: l.location || "—", score: l.score ?? "—", id: l.id })),
        rowAction: { event: "save_lead", tool: "enrich_lead" }, rowActionLabel: "＋ Save" },
    ],
    footer: [{ type: "button", label: "Open Lead Studio →", action: { event: "open_studio", href: "/home/leads" } }],
  };
}

/** Leads just found + saved → a pickable table (reveal one, or open the studio). */
export function foundLeadsView(
  created: { id: string; name: string; company?: string | null; location?: string | null; industry?: string | null; isOrg?: boolean }[],
  listId?: string | null,
): ViewSpec {
  const orgCount = created.filter((c) => c.isOrg).length;
  const leadStudioHref = listId ? `/home/leads?leadList=${listId}` : "/home/leads";
  return {
    name: "found-leads", source: "library", skill: "find_leads", width: "full",
    title: "Leads found", subtitle: `${created.length} saved${orgCount ? ` · ${orgCount} org-level` : ""}`, icon: "🔎",
    badge: { text: `${created.length}`, tone: "success" },
    body: [
      {
        type: "table",
        columns: [
          { key: "business", label: "Business" },
          { key: "location", label: "Area" },
          { key: "industry", label: "Industry" },
          { key: "type", label: "Type", kind: "badge" },
          { key: "contact", label: "Contact", kind: "badge" },
        ],
        rows: created.slice(0, 40).map((c) => ({ business: c.name, location: c.location || "—", industry: c.industry || "—", type: c.isOrg ? "Org" : "Person", contact: "🔒 hidden", id: c.id, name: c.name })),
        rowActions: [
          { label: "Get details", action: { event: "get_lead_details", payload: listId ? { listId } : undefined } },
          { label: "Pitch", action: { event: "pitch_lead", tool: "create_pitch" } },
        ],
      },
      { type: "note", tone: "muted", icon: "💡", text: "Get details finds a lead's contact info (billed per lead) — then Pitch it right here, or open the studio for outreach." },
    ],
    footer: [{ type: "button", label: "Open Lead Studio →", action: { event: "open_studio", href: leadStudioHref } }],
  };
}

/** Account KPI snapshot → a compact dashboard. */
export function analyticsDashboardView(d: {
  leads: { total: number; enriched: number; unenriched: number };
  pipeline: { open: number; won: number; lost: number; wonValue: string };
  content: { published: number; scheduled: number };
  email_sms: { campaignsSent: number; recipients: number; opens: number; clicks: number };
  ads: { campaigns: number; impressions: number; clicks: number; spend: string };
  store: { orders: number; pending: number; revenue: string } | null;
}): ViewSpec {
  const num = (n: number) => n.toLocaleString();
  const body: ViewBlock[] = [
    { type: "kpis", items: [
      { label: "Leads", value: num(d.leads.total) },
      { label: "Open deals", value: num(d.pipeline.open) },
      { label: "Won", value: d.pipeline.wonValue, tone: "success" },
      { label: "Posts live", value: num(d.content.published) },
    ] },
    { type: "section", title: "Outreach", children: [
      { type: "kpis", items: [
        { label: "Campaigns", value: num(d.email_sms.campaignsSent) },
        { label: "Opens", value: num(d.email_sms.opens) },
        { label: "Clicks", value: num(d.email_sms.clicks) },
        { label: "Scheduled", value: num(d.content.scheduled) },
      ] },
    ] },
  ];
  if (d.ads.campaigns > 0) {
    body.push({ type: "section", title: "Ads", children: [
      { type: "kpis", items: [
        { label: "Impressions", value: num(d.ads.impressions) },
        { label: "Clicks", value: num(d.ads.clicks) },
        { label: "Spend", value: d.ads.spend },
      ] },
    ] });
  }
  if (d.store) {
    body.push({ type: "section", title: "Store", children: [
      { type: "kpis", items: [
        { label: "Orders", value: num(d.store.orders) },
        { label: "Pending", value: num(d.store.pending), tone: d.store.pending > 0 ? "warn" : "default" },
        { label: "Revenue", value: d.store.revenue, tone: "success" },
      ] },
    ] });
  }
  return {
    name: "analytics-dashboard", source: "library", skill: "get_analytics", width: "lg",
    title: "Your numbers", subtitle: "Lifetime snapshot", icon: "📊",
    body,
    footer: [{ type: "button", label: "Open Analytics →", action: { event: "open_studio", href: "/home/analytics" } }],
  };
}

/** Store orders → a pickable table (fulfill one, or open the store). */
export function ordersTableView(
  orders: { id: string; number: string | number; customer: string; total: string; status: string; payment?: string; items?: number }[],
  storeName?: string | null,
  totals?: { pending: number; revenue: string },
): ViewSpec {
  return {
    name: "orders-table", source: "library", skill: "list_orders", width: "full",
    title: storeName ? `${storeName} · Orders` : "Orders",
    subtitle: totals ? `${totals.pending} pending · ${totals.revenue}` : `${orders.length} order${orders.length === 1 ? "" : "s"}`,
    icon: "🧾", badge: totals && totals.pending > 0 ? { text: `${totals.pending} to ship`, tone: "warn" } : undefined,
    body: [
      { type: "table",
        columns: [
          { key: "number", label: "Order" },
          { key: "customer", label: "Customer" },
          { key: "total", label: "Total", align: "right" },
          { key: "status", label: "Status", kind: "badge" },
        ],
        rows: orders.slice(0, 30).map((o) => ({ number: `#${o.number}`, customer: o.customer || "—", total: o.total, status: o.status, id: o.id })),
        rowAction: { event: "fulfill_order", tool: "fulfill_order" }, rowActionLabel: "Fulfill →" },
    ],
    footer: [{ type: "button", label: "Open Store →", action: { event: "open_studio", href: "/home/sell" } }],
  };
}

/** Store products → a pickable table (edit one, or open the store). */
export function productsTableView(
  products: { id: string; name: string; price: string; stock: number | string; lowStock?: boolean; status: string; sold?: number }[],
  storeName?: string | null,
): ViewSpec {
  const low = products.filter((p) => p.lowStock).length;
  return {
    name: "products-table", source: "library", skill: "list_products", width: "full",
    title: storeName ? `${storeName} · Products` : "Products",
    subtitle: `${products.length} product${products.length === 1 ? "" : "s"}${low ? ` · ${low} low stock` : ""}`,
    icon: "📦", badge: low ? { text: `${low} low`, tone: "warn" } : undefined,
    body: [
      { type: "table",
        columns: [
          { key: "name", label: "Product" },
          { key: "price", label: "Price", align: "right" },
          { key: "stock", label: "Stock", align: "right" },
          { key: "status", label: "Status", kind: "badge" },
        ],
        rows: products.slice(0, 30).map((p) => ({ name: p.name, price: p.price, stock: p.lowStock ? `⚠ ${p.stock}` : String(p.stock), status: p.status, id: p.id, productName: p.name })),
        rowAction: { event: "edit_product", tool: "update_product" }, rowActionLabel: "Edit →" },
    ],
    footer: [{ type: "button", label: "Open Store →", action: { event: "open_studio", href: "/home/sell" } }],
  };
}

/** Saved leads (existing) → a table with contact + state; get details / pitch. */
export function leadsListView(
  leads: { id: string; name: string; company?: string | null; email?: string | null; phone?: string | null; enriched?: boolean; missing?: string[] }[],
  counts?: { total: number; enriched: number; unenriched: number },
  listName?: string | null,
  listId?: string | null,
): ViewSpec {
  return {
    name: "leads-list", source: "library", skill: "list_leads", width: "full",
    title: listName ? `${listName}` : "Leads",
    subtitle: counts ? `${counts.total} lead${counts.total === 1 ? "" : "s"} · ${counts.enriched} enriched · ${counts.unenriched} to go` : `${leads.length} lead${leads.length === 1 ? "" : "s"}`,
    icon: "👥", badge: counts && counts.unenriched > 0 ? { text: `${counts.unenriched} un-enriched`, tone: "brand" } : { text: "all enriched", tone: "success" },
    body: [
      { type: "table",
        columns: [
          { key: "name", label: "Lead" },
          { key: "company", label: "Company" },
          { key: "contact", label: "Contact" },
          { key: "state", label: "State", kind: "badge" },
        ],
        rows: leads.slice(0, 40).map((l) => ({
          name: l.name,
          company: l.company || "—",
          contact: l.email || l.phone || (l.enriched ? "—" : "🔒 hidden"),
          state: l.enriched ? "Enriched ✓" : "New",
          id: l.id,
          leadName: l.name,
        })),
        rowActions: [
          { label: "Get details", action: { event: "get_lead_details", payload: listId ? { listId } : undefined } },
          { label: "Pitch", action: { event: "pitch_lead", tool: "create_pitch" } },
        ],
      },
    ],
    footer: [{ type: "button", label: "Open Lead Studio →", action: { event: "open_studio", href: listId ? `/home/leads?leadList=${listId}` : "/home/leads" } }],
  };
}

/** A lead whose contact details were just revealed → shown + a Pitch action. */
export function enrichedLeadView(lead: {
  id: string;
  name: string;
  title?: string | null;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  socials?: Record<string, string>;
  listId?: string | null;
}): ViewSpec {
  const body: ViewBlock[] = [];
  const line = (label: string, value: string | null | undefined, icon: string) => {
    if (value) body.push({ type: "row", align: "between", children: [{ type: "text", text: `${icon} ${label}`, size: "xs", tone: "muted" }, { type: "text", text: value, size: "sm", strong: true }] });
  };
  line("Email", lead.email, "✉");
  line("Phone", lead.phone, "📞");
  line("Website", lead.website, "🌐");
  line("Address", lead.address, "📍");
  const socialLinks = lead.socials ? Object.entries(lead.socials).filter(([, v]) => v) : [];
  if (socialLinks.length) body.push({ type: "text", text: socialLinks.map(([k]) => k).join(" · "), size: "xs", tone: "info" });
  if (body.length === 0) body.push({ type: "note", tone: "muted", text: "No public contact details surfaced for this lead yet." });
  return {
    name: "enriched-lead", source: "library", skill: "enrich_lead", width: "md",
    title: lead.name, subtitle: [lead.title, lead.company].filter(Boolean).join(" · ") || "Contact revealed",
    icon: "🔓", badge: { text: "Enriched ✓", tone: "success" },
    body,
    footer: [
      { type: "button", label: "✉ Pitch this lead", variant: "primary", action: { event: "pitch_lead", tool: "create_pitch", payload: { leadId: lead.id, leadName: lead.name } } },
      ...(lead.listId ? [{ type: "button" as const, label: "📋 Show updated list", action: { event: "show_leads_list", tool: "list_leads", payload: { listId: lead.listId } } }] : []),
      { type: "button", label: "Open in Lead Studio →", action: { event: "open_studio", href: lead.listId ? `/home/leads?leadList=${lead.listId}` : "/home/leads" } },
    ],
  };
}

/** A proposal/pitch → an editable card the user reworks inline then sends. */
export function pitchView(pitch: {
  id: string;
  business?: string | null;
  title?: string;
  subject?: string;
  summary?: string;
  sections?: { label: string; text: string }[];
}): ViewSpec {
  const body: ViewBlock[] = [];
  if (pitch.subject) body.push({ type: "card", children: [{ type: "text", text: "Subject", size: "xs", tone: "muted", strong: true }, { type: "text", text: pitch.subject, size: "sm" }] });
  if (pitch.summary) body.push({ type: "card", children: [{ type: "text", text: "Summary", size: "xs", tone: "muted", strong: true }, { type: "text", text: pitch.summary, size: "sm" }] });
  for (const s of (pitch.sections || []).slice(0, 4)) {
    body.push({ type: "card", children: [{ type: "text", text: s.label, size: "xs", tone: "brand", strong: true }, { type: "text", text: s.text.length > 300 ? s.text.slice(0, 300) + "…" : s.text, size: "sm" }] });
  }
  body.push({
    type: "card",
    children: [
      { type: "buttonRow", buttons: [
        { label: "✨ Rewrite", action: { event: "rewrite_pitch", payload: { pitchId: pitch.id } } },
        { label: "✂ Shorten", action: { event: "shorten_pitch", payload: { pitchId: pitch.id } } },
        { label: "🎩 More formal", action: { event: "formal_pitch", payload: { pitchId: pitch.id } } },
      ] },
      { type: "input", name: "instruction", placeholder: "Tell me how to change it — add pricing, warmer tone, mention their city…", submitLabel: "Apply", action: { event: "edit_pitch", payload: { pitchId: pitch.id } } },
    ],
  });
  return {
    name: "pitch-editor", source: "library", skill: "show_pitch", width: "lg",
    title: pitch.title || `Pitch${pitch.business ? ` — ${pitch.business}` : ""}`, subtitle: "Edit inline, then send", icon: "📝", badge: { text: "Draft", tone: "warn" },
    body,
    footer: [
      { type: "button", label: "✉ Send pitch", variant: "primary", action: { event: "send_pitch", tool: "send_proposal", payload: { pitchId: pitch.id } } },
      { type: "button", label: "Open Pitch Studio →", action: { event: "open_studio", href: `/home/pitchstudio?pitch=${pitch.id}` } },
    ],
  };
}

/** A drafted screenplay awaiting the user's approval before the paid render. */
export function scriptApprovalView(input: {
  draftId: string;
  title?: string;
  duration: number;
  scenes: { n: number; narration?: string; caption?: string; visual?: string }[];
}): ViewSpec {
  const body: ViewBlock[] = [];
  for (const s of input.scenes) {
    const children: ViewBlock[] = [{ type: "text", text: `Scene ${s.n}`, strong: true, size: "xs", tone: "brand" }];
    if (s.visual) children.push({ type: "text", text: `[${s.visual}]`, tone: "muted", size: "xs" });
    if (s.narration) children.push({ type: "text", text: s.narration, size: "sm" });
    if (s.caption) children.push({ type: "text", text: `— ${s.caption}`, tone: "info", size: "xs" });
    body.push({ type: "card", children });
  }
  return {
    name: "script-approval", source: "library", skill: "draft_story_ad_script", width: "md",
    title: input.title ? `“${input.title}”` : "Screenplay — review",
    subtitle: `${input.duration}s · ${input.scenes.length} scene${input.scenes.length === 1 ? "" : "s"} · approve before rendering`,
    icon: "🎬", badge: { text: "Needs approval", tone: "warn" },
    body,
    footer: [
      { type: "button", label: "✓ Approve — render the film", variant: "primary", action: { event: "approve_script", tool: "start_story_ad_campaign", payload: { draftId: input.draftId } } },
      { type: "input", name: "revision", placeholder: "Tweak it — punchier hook, add a price in scene 4, warmer tone…", submitLabel: "Revise", action: { event: "revise_script", payload: { draftId: input.draftId } } },
    ],
  };
}

/** A content campaign → interactive card: each post with per-post actions + a
 *  tweak input, so the user reviews/edits/approves without leaving the chat. */
export function campaignView(input: {
  campaignId: string;
  name: string;
  status: string;
  posts: { id: string; when: string; platforms: string; caption: string; status: string; hasMedia: boolean }[];
}): ViewSpec {
  const needsApproval = input.posts.some((p) => p.status === "DRAFT");
  const body: ViewBlock[] = [];
  for (const p of input.posts.slice(0, 12)) {
    body.push({
      type: "card",
      children: [
        { type: "row", align: "between", children: [
          { type: "text", text: `🗓 ${p.when}`, size: "xs", tone: "muted" },
          { type: "badge", text: p.status, tone: p.status === "PUBLISHED" ? "success" : p.status === "SCHEDULED" ? "info" : "muted" },
        ] },
        { type: "text", text: p.platforms, size: "xs", tone: "brand" },
        { type: "text", text: p.caption.length > 220 ? p.caption.slice(0, 220) + "…" : p.caption, size: "sm" },
        { type: "buttonRow", buttons: [
          { label: "✨ Rewrite", variant: "default", action: { event: "rewrite_caption", payload: { postId: p.id, campaignId: input.campaignId } } },
          { label: p.hasMedia ? "🖼 Redo image" : "🖼 Add image", action: { event: "post_image", tool: "regenerate_post_image", payload: { postId: p.id } } },
          { label: "🕓 Reschedule", action: { event: "reschedule_post", payload: { postId: p.id } } },
          { label: "🗑 Remove", variant: "danger", action: { event: "remove_post", payload: { postId: p.id } } },
        ] },
        { type: "input", name: "instruction", placeholder: "Tweak this post — e.g. punchier hook, add the free-trial CTA…", submitLabel: "Apply", action: { event: "post_instruction", payload: { postId: p.id, campaignId: input.campaignId } } },
      ],
    });
  }
  return {
    name: "content-campaign", source: "library", skill: "show_content_campaign", width: "lg",
    title: input.name, subtitle: `${input.posts.length} post${input.posts.length === 1 ? "" : "s"} · ${input.status.toLowerCase()}`,
    icon: "🗓️", badge: needsApproval ? { text: "Needs approval", tone: "warn" } : { text: input.status, tone: "success" },
    body,
    footer: [
      { type: "button", label: "✓ Approve all — schedule", variant: "primary", action: { event: "approve_campaign", payload: { campaignId: input.campaignId } } },
      { type: "button", label: "✨ Improve", action: { event: "improve_campaign", tool: "improve_content_campaign", payload: { campaignId: input.campaignId } } },
      { type: "button", label: "Open Campaign Studio →", action: { event: "open_studio", href: "/home/campaign" } },
    ],
  };
}

/** A generic build-in-progress view for any long task (design, campaign, etc.). */
export function buildProgressView(input: { title: string; icon?: string; steps: { text: string; state: "done" | "active" | "pending"; sub?: string }[]; progress: number; note?: string }): ViewSpec {
  const body: ViewBlock[] = [
    { type: "status", text: "Working…", state: "running", progress: input.progress },
    { type: "checklist", items: input.steps },
  ];
  if (input.note) body.push({ type: "note", text: input.note });
  return { name: "build-progress", source: "library", title: input.title, icon: input.icon || "⚙️", badge: { text: `${Math.round(input.progress)}%`, tone: "brand" }, body };
}
