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

/** A generic build-in-progress view for any long task (design, campaign, etc.). */
export function buildProgressView(input: { title: string; icon?: string; steps: { text: string; state: "done" | "active" | "pending"; sub?: string }[]; progress: number; note?: string }): ViewSpec {
  const body: ViewBlock[] = [
    { type: "status", text: "Working…", state: "running", progress: input.progress },
    { type: "checklist", items: input.steps },
  ];
  if (input.note) body.push({ type: "note", text: input.note });
  return { name: "build-progress", source: "library", title: input.title, icon: input.icon || "⚙️", badge: { text: `${Math.round(input.progress)}%`, tone: "brand" }, body };
}
