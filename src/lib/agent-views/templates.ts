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

/** A full proposal/pitch review surface in chat, mirroring the lead cards. */
export function proposalPitchView(pitch: {
  id: string;
  business?: string | null;
  title?: string;
  subject?: string;
  summary?: string;
  variant?: "deck" | "visual";
  coverImage?: string | null;
  metrics?: { label: string; value: string }[];
  deliverables?: { title: string; description: string }[];
  timeline?: { label: string; title: string }[];
  sections?: { key?: string; label: string; text: string }[];
}): ViewSpec {
  const body: ViewBlock[] = [];
  const variant = pitch.variant || "deck";
  if (pitch.coverImage) body.push({ type: "image", url: pitch.coverImage, alt: "Proposal visual", aspect: "16/7" });
  body.push({
    type: "row",
    wrap: true,
    gap: 6,
    children: [
      { type: "badge", text: variant === "visual" ? "Visual deck PDF" : "Proposal deck PDF", tone: "info" },
      { type: "badge", text: "Inline editable", tone: "success" },
      { type: "badge", text: "PDF attached on send", tone: "brand" },
    ],
  });
  if (pitch.subject) body.push({ type: "card", children: [{ type: "text", text: "Email subject", size: "xs", tone: "muted", strong: true }, { type: "text", text: pitch.subject, size: "sm" }] });
  if (pitch.summary) body.push({ type: "card", children: [{ type: "text", text: "Executive summary", size: "xs", tone: "muted", strong: true }, { type: "text", text: pitch.summary.length > 520 ? `${pitch.summary.slice(0, 520)}...` : pitch.summary, size: "sm" }] });
  if (pitch.metrics?.length) body.push({ type: "kpis", items: pitch.metrics.slice(0, 4).map((m) => ({ label: m.label, value: m.value, tone: "brand" })) });
  if (pitch.deliverables?.length) {
    body.push({
      type: "section",
      title: "Deliverables",
      subtitle: "Review the offer before sending",
      children: pitch.deliverables.slice(0, 4).map((d) => ({
        type: "card",
        children: [
          { type: "text", text: d.title, size: "sm", tone: "brand", strong: true },
          { type: "text", text: d.description.length > 240 ? `${d.description.slice(0, 240)}...` : d.description, size: "xs" },
        ],
      })),
    });
  }
  for (const s of (pitch.sections || []).slice(0, 6)) {
    const payload = { pitchId: pitch.id, field: s.key || s.label };
    body.push({
      type: "card",
      children: [
        { type: "text", text: s.label, size: "xs", tone: "brand", strong: true },
        { type: "text", text: s.text.length > 420 ? `${s.text.slice(0, 420)}...` : s.text, size: "sm" },
        { type: "buttonRow", buttons: [
          { label: "Rewrite", action: { event: "rewrite_pitch_section", payload } },
          { label: "Shorten", action: { event: "shorten_pitch_section", payload } },
          { label: "More formal", action: { event: "formal_pitch_section", payload } },
        ] },
      ],
    });
  }
  if (pitch.timeline?.length) {
    body.push({ type: "timeline", items: pitch.timeline.slice(0, 5).map((t) => ({ text: `${t.label}: ${t.title}`, tone: "info" })) });
  }
  body.push({
    type: "card",
    children: [
      { type: "buttonRow", buttons: [
        { label: "Rewrite all", action: { event: "rewrite_pitch", payload: { pitchId: pitch.id } } },
        { label: "Shorten all", action: { event: "shorten_pitch", payload: { pitchId: pitch.id } } },
        { label: "More formal", action: { event: "formal_pitch", payload: { pitchId: pitch.id } } },
      ] },
      { type: "input", name: "instruction", multiline: true, placeholder: "Tell me how to change it: trim every page, add pricing, warmer tone, mention their city...", submitLabel: "Apply", action: { event: "edit_pitch", payload: { pitchId: pitch.id } } },
    ],
  });
  return {
    name: "pitch-editor", source: "library", skill: "show_pitch", width: "lg",
    title: pitch.title || `Pitch${pitch.business ? ` - ${pitch.business}` : ""}`,
    subtitle: `${pitch.business || "Proposal"} - edit inline, then send`,
    icon: "Proposal",
    badge: { text: "Draft", tone: "warn" },
    body,
    footer: [
      { type: "button", label: "Download PDF", variant: "default", action: { event: "download_pitch_pdf", href: `/api/pitch/${pitch.id}/pdf?variant=${variant}` } },
      { type: "input", name: "recipientEmail", placeholder: "Recipient email to send PDF...", submitLabel: "Send", action: { event: "send_pitch", tool: "send_proposal", payload: { pitchId: pitch.id, variant } } },
      { type: "button", label: "Open full Pitch Studio", action: { event: "open_studio", href: `/home/pitchstudio?pitch=${pitch.id}` } },
    ],
  };
}

/** Existing images/designs -> a click-to-use picker for custom visual decks. */
export function visualDeckMaterialsView(input: {
  title?: string;
  query?: string;
  materials: {
    id: string;
    title: string;
    sourceType: "media" | "design";
    type?: string | null;
    url?: string | null;
    details?: string | null;
    updatedAt?: string | null;
  }[];
}): ViewSpec {
  const rows = input.materials.slice(0, 30).map((m) => ({
    id: m.id,
    title: m.title,
    sourceType: m.sourceType,
    type: m.type || "-",
    details: m.details || "-",
    thumb: m.url || "",
    url: m.url || "",
    updatedAt: m.updatedAt || "",
  }));
  return {
    name: "visual-deck-material-picker",
    source: "library",
    skill: "visual_deck",
    width: "full",
    title: input.title || "Choose material for the visual deck",
    subtitle: input.query ? `Matches for "${input.query}"` : `${rows.length} recent images and designs`,
    icon: "Deck",
    badge: { text: "Visual deck", tone: "brand" },
    body: [
      {
        type: "table",
        columns: [
          { key: "thumb", label: "", kind: "thumb" },
          { key: "title", label: "Material" },
          { key: "sourceType", label: "Source", kind: "badge" },
          { key: "details", label: "Details" },
        ],
        rows,
        rowActions: [
          { label: "Use in deck", variant: "primary", action: { event: "use_visual_deck_material", tool: "create_visual_deck" } },
        ],
      },
      { type: "note", tone: "muted", text: "Pick one item, or use all shown. The agent will build a branded visual deck, show it inline, and keep PDF/email actions attached." },
    ],
    footer: [
      { type: "button", label: "Use all shown", variant: "primary", action: { event: "use_all_visual_deck_materials", tool: "create_visual_deck", payload: { materials: rows.slice(0, 12) } } },
      { type: "button", label: "Open Media Library", action: { event: "open_studio", href: "/home/media" } },
    ],
  };
}

/** Existing pitches/proposals -> a pickable library with inline review actions. */
export function pitchesListView(
  pitches: {
    id: string;
    business: string | null;
    url?: string | null;
    type: string;
    status: string;
    recipient?: string | null;
    sentAt?: string | null;
    createdAt: string;
  }[],
  total?: number,
): ViewSpec {
  const count = total ?? pitches.length;
  return {
    name: "pitches-list",
    source: "library",
    skill: "list_pitches",
    width: "full",
    title: "Pitch Studio library",
    subtitle: `${count} pitch/proposal${count === 1 ? "" : "s"} found`,
    icon: "Pitch",
    badge: { text: "Inline review", tone: "brand" },
    body: [
      {
        type: "table",
        columns: [
          { key: "business", label: "Business" },
          { key: "type", label: "Type", kind: "badge" },
          { key: "recipient", label: "Recipient" },
          { key: "status", label: "Status", kind: "badge" },
          { key: "created", label: "Created" },
        ],
        rows: pitches.slice(0, 40).map((p) => ({
          pitchId: p.id,
          id: p.id,
          business: p.business || "Untitled",
          url: p.url || "",
          type: p.type,
          recipient: p.recipient || "-",
          status: p.status || "draft",
          created: p.createdAt ? p.createdAt.slice(0, 10) : "-",
          sentAt: p.sentAt || "",
        })),
        rowActions: [
          { label: "Show inline", variant: "primary", action: { event: "show_pitch", tool: "show_pitch" } },
          { label: "Edit", action: { event: "edit_pitch", tool: "show_pitch" } },
        ],
      },
      { type: "note", tone: "muted", text: "Pick any row to render the full pitch/proposal card here in chat with edit, PDF download, and send actions attached." },
    ],
    footer: [{ type: "button", label: "Open Pitch Studio", action: { event: "open_studio", href: "/home/pitchstudio" } }],
  };
}

/** Saved designs -> a reusable picker for visual decks and design follow-ups. */
export function designsLibraryView(
  designs: {
    id: string;
    name: string;
    category?: string | null;
    size?: string | null;
    style?: string | null;
    type?: string | null;
    status?: string | null;
    imageUrl?: string | null;
    updatedAt?: string | null;
  }[],
): ViewSpec {
  const rows = designs.slice(0, 40).map((d) => ({
    id: d.id,
    designId: d.id,
    title: d.name || "Untitled design",
    category: d.category || "-",
    size: d.size || "-",
    style: d.style || "-",
    type: d.type || "design",
    status: d.status || "-",
    url: d.imageUrl || "",
    updatedAt: d.updatedAt || "",
  }));
  return {
    name: "designs-library",
    source: "library",
    skill: "list_designs",
    width: "full",
    title: "Saved designs",
    subtitle: `${rows.length} design${rows.length === 1 ? "" : "s"} ready to reuse`,
    icon: "Design",
    badge: { text: "Reusable", tone: "success" },
    body: [
      {
        type: "table",
        columns: [
          { key: "title", label: "Design" },
          { key: "category", label: "Category", kind: "badge" },
          { key: "size", label: "Size" },
          { key: "status", label: "Status", kind: "badge" },
        ],
        rows,
        rowActions: [
          { label: "Use in deck", variant: "primary", action: { event: "use_design_in_visual_deck", tool: "create_visual_deck" } },
          { label: "Open", action: { event: "open_design" } },
        ],
      },
      { type: "note", tone: "muted", text: "Choose a design to build a branded visual deck around it, or ask for edits and the agent will keep the work inside the chat." },
    ],
    footer: [{ type: "button", label: "Open Design Studio", action: { event: "open_studio", href: "/home/create" } }],
  };
}

/** Media library -> a reusable asset picker for decks, posts, and campaigns. */
export function mediaLibraryView(
  media: {
    id: string;
    name: string;
    url: string;
    type: string;
    dimensions?: string | null;
    sizeKB?: number | null;
    createdAt?: string | null;
  }[],
  context?: { postId?: string; campaignId?: string; attachToPost?: boolean },
): ViewSpec {
  const rows = media.slice(0, 50).map((m) => ({
    id: m.id,
    mediaId: m.id,
    title: m.name || "Untitled file",
    type: m.type || "file",
    details: [m.dimensions, typeof m.sizeKB === "number" ? `${m.sizeKB} KB` : null].filter(Boolean).join(" - ") || "-",
    url: m.url,
    thumb: /^https?:\/\//.test(m.url || "") && (m.type === "image" || m.type === "svg") ? m.url : undefined,
    created: m.createdAt ? m.createdAt.slice(0, 10) : "-",
  }));
  const hasThumbs = rows.some((r) => typeof r.thumb === "string" && r.thumb);
  return {
    name: "media-library",
    source: "library",
    skill: "list_media",
    width: "full",
    title: "Media library",
    subtitle: `${rows.length} file${rows.length === 1 ? "" : "s"} available`,
    icon: "Media",
    badge: { text: "Use as material", tone: "brand" },
    body: [
      {
        type: "table",
        columns: [
          ...(hasThumbs ? [{ key: "thumb", label: "", kind: "thumb" as const }] : []),
          { key: "title", label: "File" },
          { key: "type", label: "Type", kind: "badge" },
          { key: "details", label: "Details" },
          { key: "created", label: "Created" },
        ],
        rows,
        rowActions: context?.attachToPost && context.postId
          ? [
              { label: "Attach to post", variant: "primary", action: { event: "attach_media_to_campaign_post", tool: "attach_media_to_post", payload: { postId: context.postId, campaignId: context.campaignId || null } } },
              { label: "Use in deck", action: { event: "use_media_in_visual_deck", tool: "create_visual_deck" } },
            ]
          : [
              { label: "Use in deck", variant: "primary", action: { event: "use_media_in_visual_deck", tool: "create_visual_deck" } },
              { label: "Create post", action: { event: "use_media_for_post" } },
            ],
      },
      { type: "note", tone: "muted", text: context?.attachToPost ? "Pick an asset to attach it to this campaign post without leaving the chat." : "Pick an asset to create a branded visual deck, post, or campaign without leaving the chat." },
    ],
    footer: [{ type: "button", label: "Open Media Library", action: { event: "open_studio", href: "/home/media" } }],
  };
}

/** Campaign Studio index -> pick a campaign and continue inline. */
export function contentCampaignsListView(
  campaigns: {
    id: string;
    name: string;
    status: string;
    brief?: string;
    platforms?: unknown[];
    postCount: number;
    startDate?: string | null;
    endDate?: string | null;
    updatedAt: string;
  }[],
): ViewSpec {
  const shortDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? (iso ? iso.slice(0, 10) : "-") : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  return {
    name: "content-campaigns-list",
    source: "library",
    skill: "list_content_campaigns",
    width: "full",
    title: "Content campaigns",
    subtitle: `${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"} ready to manage`,
    icon: "Cal",
    badge: { text: "Inline editor", tone: "brand" },
    body: [
      {
        type: "table",
        columns: [
          { key: "name", label: "Campaign" },
          { key: "status", label: "Status", kind: "badge" },
          { key: "posts", label: "Posts", align: "right" },
          { key: "platforms", label: "Platforms" },
          { key: "updated", label: "Updated" },
        ],
        rows: campaigns.slice(0, 40).map((c) => ({
          id: c.id,
          campaignId: c.id,
          name: c.name,
          status: c.status,
          brief: c.brief || "",
          posts: c.postCount,
          platforms: Array.isArray(c.platforms) && c.platforms.length ? c.platforms.join(", ") : "-",
          startDate: c.startDate || "",
          endDate: c.endDate || "",
          updated: c.updatedAt ? shortDate(c.updatedAt) : "-",
        })),
        rowActions: [
          { label: "Show inline", variant: "primary", action: { event: "show_content_campaign", tool: "show_content_campaign" } },
          { label: "Improve", action: { event: "improve_content_campaign", tool: "improve_content_campaign" } },
        ],
      },
      { type: "note", tone: "muted", text: "Open a campaign here to rewrite captions, regenerate images, reschedule posts, remove items, or approve everything from the same chat thread." },
    ],
    footer: [],
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

/** A content campaign styled closer to the Campaign Studio timeline. */
export function campaignTimelineView(input: {
  campaignId: string;
  name: string;
  status: string;
  posts: { id: string; when: string; platforms: string; caption: string; status: string; hasMedia: boolean; mediaUrl?: string | null; mediaType?: string | null }[];
}): ViewSpec {
  const needsApproval = input.posts.some((p) => p.status === "DRAFT");
  return {
    name: "content-campaign",
    source: "library",
    skill: "show_content_campaign",
    width: "full",
    title: input.name,
    subtitle: `${input.posts.length} post${input.posts.length === 1 ? "" : "s"} - ${input.status.toLowerCase()}`,
    icon: "Cal",
    badge: needsApproval ? { text: "Needs approval", tone: "warn" } : { text: input.status, tone: "success" },
    body: input.posts.slice(0, 12).map((p) => ({
      type: "card" as const,
      children: [
        {
          type: "row" as const,
          align: "start" as const,
          gap: 14,
          children: [
            {
              type: "mediaBox" as const,
              postId: p.id,
              url: p.mediaUrl || null,
              mediaType: p.mediaType || (p.hasMedia ? "image" : "planned_image"),
              label: p.hasMedia ? "Media" : "Planned",
              status: p.hasMedia ? undefined : "click to attach",
              action: p.hasMedia ? undefined : { event: "upload_campaign_post_media", payload: { postId: p.id, campaignId: input.campaignId } },
            },
            {
              type: "stack" as const,
              gap: 7,
              children: [
                {
                  type: "row" as const,
                  align: "between" as const,
                  children: [
                    { type: "text" as const, text: p.when, size: "xs" as const, tone: "muted" as const, strong: true },
                    { type: "badge" as const, text: p.status, tone: p.status === "PUBLISHED" ? "success" as const : p.status === "SCHEDULED" ? "info" as const : "muted" as const },
                  ],
                },
                { type: "text" as const, text: p.platforms, size: "xs" as const, tone: "brand" as const },
                { type: "text" as const, text: p.caption.length > 260 ? `${p.caption.slice(0, 260)}...` : p.caption, size: "sm" as const, strong: true },
                {
                  type: "buttonRow" as const,
                  buttons: [
                    { label: "Rewrite", variant: "default" as const, action: { event: "rewrite_caption", payload: { postId: p.id, campaignId: input.campaignId } } },
                    // ONE "Add media" entry covers both image + video — the agent asks
                    // which type on click (post_media handler), then generates it. No
                    // separate Add image / Add video buttons.
                    { label: p.hasMedia ? "Redo media" : "Add media", action: { event: "post_media", payload: { postId: p.id, campaignId: input.campaignId, hasMedia: p.hasMedia, mediaType: p.mediaType || null } } },
                    // "Library" opens the media-library MODAL (select existing OR upload
                    // new — the picker already has an Upload button), then attaches the
                    // chosen asset. Replaces the old separate Upload + Library buttons.
                    { label: "Library", action: { event: "pick_campaign_post_media", payload: { postId: p.id, campaignId: input.campaignId } } },
                    { label: "Reschedule", action: { event: "reschedule_post", payload: { postId: p.id } } },
                    { label: "Remove", variant: "danger" as const, action: { event: "remove_post", payload: { postId: p.id } } },
                  ],
                },
                { type: "input" as const, name: "instruction", placeholder: "Tweak this post - e.g. punchier hook, add the free-trial CTA...", submitLabel: "Apply", action: { event: "post_instruction", payload: { postId: p.id, campaignId: input.campaignId } } },
              ],
            },
          ],
        },
      ],
    })),
    footer: [
      { type: "button", label: "Approve all and schedule", variant: "primary", action: { event: "approve_campaign", payload: { campaignId: input.campaignId } } },
      { type: "button", label: "Improve", action: { event: "improve_campaign", tool: "improve_content_campaign", payload: { campaignId: input.campaignId } } },
    ],
  };
}

// ─── Social posting: preview + honest per-channel result ────────────────────
// Human labels + a small emoji marker per destination (base platform). Kept
// inline so this pure view module has no client-component dependency.
const SOCIAL_LABELS: Record<string, { label: string; icon: string }> = {
  feed: { label: "Your feed", icon: "🏠" },
  facebook: { label: "Facebook", icon: "📘" },
  instagram: { label: "Instagram", icon: "📸" },
  twitter: { label: "X / Twitter", icon: "𝕏" },
  x: { label: "X / Twitter", icon: "𝕏" },
  linkedin: { label: "LinkedIn", icon: "💼" },
  tiktok: { label: "TikTok", icon: "🎵" },
  youtube: { label: "YouTube", icon: "▶️" },
  pinterest: { label: "Pinterest", icon: "📌" },
  threads: { label: "Threads", icon: "🧵" },
  google_business: { label: "Google Business", icon: "🗺️" },
  whatsapp: { label: "WhatsApp", icon: "💬" },
};

/** Base platform for a destination string ("instagram", "account:abc" → resolved by caller,
 *  or "instagram:xyz" → "instagram"). Falls back to the raw value. */
function socialBase(destination: string): string {
  const d = destination.toLowerCase();
  if (d.startsWith("account:")) return d; // caller should pass a base; leave as-is
  return d.split(":")[0];
}

function socialMeta(destination: string): { label: string; icon: string } {
  return SOCIAL_LABELS[socialBase(destination)] || { label: destination, icon: "🌐" };
}

export type PostChannelResult = { success: boolean; error?: string; pending?: boolean };

/**
 * A pre-publish PREVIEW — what the post will look like (media + caption) and
 * exactly which channels it goes to — so the user reviews it in the chat like
 * the Publish view, then taps Post now / Schedule.
 */
export function postPreviewView(input: {
  caption: string;
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | null;
  platforms: string[];
  scheduledAtLabel?: string | null;
  postId?: string | null;
}): ViewSpec {
  const platforms = input.platforms.length ? input.platforms : ["feed"];
  const chips = platforms.map((p) => {
    const m = socialMeta(p);
    return { type: "badge" as const, text: `${m.icon} ${m.label}`, tone: "brand" as const };
  });
  const body: ViewBlock[] = [];
  if (input.mediaUrl) {
    body.push({
      type: "mediaBox" as const,
      url: input.mediaUrl,
      mediaType: input.mediaType || "image",
      label: "Preview",
    });
  }
  // Always show a TRUNCATED caption in the card — never the full body (long
  // captions blow up the card and bury the actions).
  const captionText = (input.caption || "").trim();
  const shownCaption = captionText.length > 160 ? `${captionText.slice(0, 160).trimEnd()}…` : (captionText || "(no caption)");
  body.push({ type: "text" as const, text: shownCaption, size: "sm" as const });
  body.push({ type: "row" as const, gap: 6, wrap: true, align: "start" as const, children: chips });
  body.push({
    type: "note" as const,
    tone: "muted" as const,
    text: input.scheduledAtLabel
      ? `Will publish ${input.scheduledAtLabel} to the ${platforms.length} channel${platforms.length === 1 ? "" : "s"} above.`
      : `Publishes now to the ${platforms.length} channel${platforms.length === 1 ? "" : "s"} above.`,
  });
  return {
    name: "post-preview",
    source: "library",
    skill: "preview_social_post",
    width: "md",
    title: "Review your post",
    icon: "📤",
    badge: { text: input.scheduledAtLabel ? "Ready to schedule" : "Ready to post", tone: "brand" },
    body,
    footer: [
      {
        type: "button" as const,
        label: input.scheduledAtLabel ? "Schedule it" : "Post now",
        variant: "primary" as const,
        action: {
          event: "publish_post_now",
          confirm: input.scheduledAtLabel
            ? `Schedule this post to ${platforms.length} channel${platforms.length === 1 ? "" : "s"}?`
            : `Publish this post now to ${platforms.length} channel${platforms.length === 1 ? "" : "s"}?`,
          payload: { platforms, scheduled: !!input.scheduledAtLabel, postId: input.postId ?? null },
        },
      },
      { type: "button" as const, label: "Edit caption", action: { event: "edit_post_caption_prompt", payload: { postId: input.postId ?? null } } },
    ],
  };
}

/**
 * Honest per-channel RESULT after a real publish — one row per selected channel
 * with its true status (published / pending / failed + the reason and next step),
 * so the user sees exactly what went out and what they must fix. Never a blanket
 * "all live".
 */
export function postPublishResultView(input: {
  postId: string;
  caption?: string;
  platforms: string[];
  results: Record<string, PostChannelResult>;
  scheduled?: boolean;
  scheduledAtLabel?: string | null;
}): ViewSpec {
  const platforms = input.platforms.length ? input.platforms : ["feed"];

  // Resolve each selected channel's status. "feed" is the always-on in-app feed
  // (the publisher skips it), so it counts as posted whenever the post is live.
  type Row = { destination: string; state: "published" | "pending" | "failed" | "scheduled"; note?: string };
  const rows: Row[] = platforms.map((p) => {
    if (socialBase(p) === "feed") {
      return { destination: p, state: input.scheduled ? "scheduled" : "published" };
    }
    if (input.scheduled) return { destination: p, state: "scheduled" };
    const r = input.results[p] || input.results[socialBase(p)];
    if (!r) return { destination: p, state: "failed", note: "No result returned — the channel may not be connected." };
    if (r.pending) return { destination: p, state: "pending", note: r.error || "Uploaded, awaiting the platform." };
    if (r.success) return { destination: p, state: "published" };
    return { destination: p, state: "failed", note: r.error || "Publish failed." };
  });

  const published = rows.filter((r) => r.state === "published").length;
  const scheduledCount = rows.filter((r) => r.state === "scheduled").length;
  const pending = rows.filter((r) => r.state === "pending").length;
  const failed = rows.filter((r) => r.state === "failed");

  const toneFor = (s: Row["state"]): "success" | "warn" | "danger" | "info" =>
    s === "published" ? "success" : s === "pending" ? "warn" : s === "scheduled" ? "info" : "danger";
  const labelFor = (s: Row["state"]): string =>
    s === "published" ? "Published" : s === "pending" ? "Pending" : s === "scheduled" ? "Scheduled" : "Failed";

  const body: ViewBlock[] = rows.map((r) => {
    const m = socialMeta(r.destination);
    const children: ViewBlock[] = [
      {
        type: "row" as const,
        align: "between" as const,
        children: [
          { type: "text" as const, text: `${m.icon}  ${m.label}`, size: "sm" as const, strong: true },
          { type: "badge" as const, text: labelFor(r.state), tone: toneFor(r.state) },
        ],
      },
    ];
    if (r.note) children.push({ type: "text" as const, text: r.note, size: "xs" as const, tone: "muted" as const });
    return { type: "card" as const, children };
  });

  // Summary headline — always honest about the split.
  const parts: string[] = [];
  if (published) parts.push(`${published} published`);
  if (scheduledCount) parts.push(`${scheduledCount} scheduled`);
  if (pending) parts.push(`${pending} pending`);
  if (failed.length) parts.push(`${failed.length} failed`);
  const allOk = failed.length === 0 && pending === 0;
  const badgeTone: "success" | "warn" | "danger" = failed.length
    ? (published || scheduledCount ? "warn" : "danger")
    : pending
      ? "warn"
      : "success";

  const footer: ViewBlock[] = [];
  if (failed.length) {
    footer.push({
      type: "button" as const,
      label: `Retry ${failed.length} failed`,
      variant: "primary" as const,
      action: { event: "retry_post_publish", payload: { postId: input.postId, platforms: failed.map((f) => f.destination) } },
    });
    // Most failures are auth/permission — send them to reconnect.
    footer.push({ type: "button" as const, label: "Fix connections", action: { event: "open_studio", href: "/home/connections" } });
  }
  footer.push({ type: "button" as const, label: "Open in Publish", action: { event: "open_studio", href: "/home/publish" } });

  return {
    name: "post-result",
    source: "library",
    skill: "schedule_social_post",
    width: "md",
    title: input.scheduled ? "Post scheduled" : allOk ? "Post published" : failed.length && !published && !scheduledCount ? "Post failed" : "Post — partial",
    subtitle: parts.join(" · ") || undefined,
    icon: allOk ? "✅" : failed.length ? "⚠️" : "📤",
    badge: { text: input.scheduled ? "Scheduled" : parts.join(" · ") || "Done", tone: input.scheduled ? "info" : badgeTone },
    body,
    footer,
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
