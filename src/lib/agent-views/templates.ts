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
  created: { id: string; name: string; company?: string | null; isOrg?: boolean }[],
  listId?: string | null,
): ViewSpec {
  const orgCount = created.filter((c) => c.isOrg).length;
  return {
    name: "found-leads", source: "library", skill: "find_leads",
    title: "Leads found", subtitle: `${created.length} saved${orgCount ? ` · ${orgCount} org-level` : ""}`, icon: "🔎",
    badge: { text: `${created.length}`, tone: "success" },
    body: [
      {
        type: "table",
        columns: [
          { key: "business", label: "Business" },
          { key: "company", label: "Company" },
          { key: "type", label: "Type", kind: "badge" },
        ],
        rows: created.slice(0, 30).map((c) => ({ business: c.name, company: c.company || "—", type: c.isOrg ? "Org" : "Person", id: c.id, name: c.name })),
        rowAction: { event: "enrich_lead", tool: "enrich_lead", payload: listId ? { listId } : undefined },
        rowActionLabel: "Reveal ✨",
      },
      { type: "note", tone: "muted", icon: "💡", text: "Tap Reveal to unlock a lead's contact details (billed per lead), or open the studio to start outreach." },
    ],
    footer: [{ type: "button", label: "Open Lead Studio →", action: { event: "open_studio", href: "/home/leads" } }],
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
    name: "analytics-dashboard", source: "library", skill: "get_analytics",
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
    name: "orders-table", source: "library", skill: "list_orders",
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
    name: "products-table", source: "library", skill: "list_products",
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

/** Saved leads (existing) → a table showing what's missing; reveal or open studio. */
export function leadsListView(
  leads: { id: string; name: string; company?: string | null; enriched?: boolean; missing?: string[] }[],
  counts?: { total: number; enriched: number; unenriched: number },
  listName?: string | null,
): ViewSpec {
  return {
    name: "leads-list", source: "library", skill: "list_leads",
    title: listName ? `${listName}` : "Leads",
    subtitle: counts ? `${counts.total} · ${counts.unenriched} to enrich` : `${leads.length} lead${leads.length === 1 ? "" : "s"}`,
    icon: "👥", badge: counts && counts.unenriched > 0 ? { text: `${counts.unenriched} un-enriched`, tone: "brand" } : { text: "enriched", tone: "success" },
    body: [
      { type: "table",
        columns: [
          { key: "name", label: "Lead" },
          { key: "company", label: "Company" },
          { key: "missing", label: "Missing" },
          { key: "state", label: "State", kind: "badge" },
        ],
        rows: leads.slice(0, 30).map((l) => ({ name: l.name, company: l.company || "—", missing: (l.missing && l.missing.length) ? l.missing.join(", ") : "—", state: l.enriched ? "Enriched" : "New", id: l.id, leadName: l.name })),
        rowAction: { event: "enrich_lead", tool: "enrich_lead" }, rowActionLabel: "Reveal ✨" },
    ],
    footer: [{ type: "button", label: "Open Lead Studio →", action: { event: "open_studio", href: "/home/leads" } }],
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
