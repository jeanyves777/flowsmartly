"use client";

import { useCallback, useEffect, useState, type ElementType } from "react";
import { Search, MapPin, Star, Phone, Globe, ExternalLink, FileText, Send, Check, Sparkles, Folder, FolderPlus, ChevronLeft, ChevronDown, Trash2, ListChecks, Save, Plus, Mail, Presentation, Pencil, X, Eye, Download, BarChart3, ShieldAlert, TrendingUp, Code2, AlertTriangle, CheckCircle2, AlertCircle, ChevronUp, Zap, Trophy, Users, Clock, Target, ListTodo, UserPlus } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";
import { computeDigitalScore, scoreColor, scoreBg } from "@/components/pitch/score-utils";
import { scoreLabel } from "@/lib/pitch/scorer";
import type { ResearchData } from "@/lib/pitch/pitch-detail-types";

/**
 * Lead finder — its own dedicated surface (split from the legacy pitch-board).
 * Full-width master/detail: a sticky LEFT card (KPIs + section menu + primary
 * actions + a status filter) and a RIGHT pane that shows the search results, the
 * saved-list grid, or an open list's leads.
 * Search local businesses (Google Places), build + save named/categorized LEAD
 * LISTS, return to them, and work each lead (status, pitch/proposal, delete).
 * Dedicated SavedLead system: /api/leads/search, /api/leads/lists[/id],
 * /api/leads/saved[/id].
 * Direct UI actions (no agent prompt): SAVE search results to a list, ADD a lead
 * by hand (POST /api/leads/saved), EDIT a saved lead's contact details
 * (PATCH /api/leads/saved/[id]), set status, delete.
 * Pitch/Proposal are genuinely generative → the agent runs them via onAsk.
 * No legacy links. [[surface-buttons-are-ui-actions]] [[new-design-no-legacy]]
 * [[full-width-left-menu-layout]]
 */

interface BusinessLead {
  placeId: string; name: string; address: string; phone?: string; website?: string;
  rating?: number; reviewCount?: number; businessStatus?: string; types?: string[]; googleMapsUrl: string;
}
interface LeadList { id: string; name: string; category?: string | null; leadCount?: number; updatedAt?: string }
interface SavedLead {
  id: string; name: string; address?: string | null; phone?: string | null; website?: string | null;
  rating?: number | null; reviewCount?: number | null; businessStatus?: string | null; category?: string | null;
  googleMapsUrl?: string | null; status?: string; notes?: string | null; pitchCount?: number;
  // person-level (AI/web-found decision-makers)
  title?: string | null; seniority?: string | null; department?: string | null;
  email?: string | null; phones?: string | null; socials?: string | null; enrichedAt?: string | null;
}

const LEAD_STATUS = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"];
const statusCls = (s?: string) => ({ NEW: "bg-muted text-muted-foreground", CONTACTED: "bg-brand-500/10 text-brand-500", QUALIFIED: "bg-violet-500/10 text-violet-500", WON: "bg-emerald-500/10 text-emerald-500", LOST: "bg-rose-500/10 text-rose-500" }[(s || "NEW").toUpperCase()] || "bg-muted text-muted-foreground");

export function FocusedLeads({ onAsk, refreshKey }: { refreshKey?: number; onAsk: (prompt: string) => void }) {
  const [tab, setTab] = useState<"search" | "lists">("search");
  // Open-list status filter (left aside) + manual "add lead" form (right pane).
  const [statusFilter, setStatusFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  // ── search ──
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<BusinessLead[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveCategory, setSaveCategory] = useState("");
  const [saveTarget, setSaveTarget] = useState<string>("new");
  const [saving, setSaving] = useState(false);

  // ── lists ──
  const [lists, setLists] = useState<LeadList[]>([]);
  const [openList, setOpenList] = useState<LeadList | null>(null);
  const [listLeads, setListLeads] = useState<SavedLead[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [busyLead, setBusyLead] = useState<string | null>(null);
  const [confirmDelList, setConfirmDelList] = useState(false);

  const loadLists = useCallback(async () => {
    try { const j = await fetch("/api/leads/lists").then((r) => r.json()); if (j?.success) setLists(j.data.lists || []); } catch { /* ignore */ }
  }, []);
  useEffect(() => { loadLists(); }, [loadLists, refreshKey]);

  const runSearch = async () => {
    if (!query.trim() || searching) return;
    setSearching(true); setError(""); setInfo(""); setSelected(new Set()); setSaveOpen(false);
    try {
      const j = await fetch("/api/leads/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: query.trim(), location: location.trim() || undefined }) }).then((r) => r.json());
      if (j?.success && j.data) {
        setResults(j.data.results || []);
        setInfo(`${j.data.total ?? (j.data.results?.length || 0)} businesses${j.data.isFreeRun ? " · free trial search" : j.data.creditsUsed ? ` · ${j.data.creditsUsed} credits` : ""}`);
        if (!saveName) setSaveName(query.trim());
        if (!saveCategory) setSaveCategory(query.trim());
      } else { setError(j?.error?.message || "Search failed."); setResults([]); }
    } catch { setError("Search failed."); } finally { setSearching(false); }
  };

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const saveSelected = async () => {
    const chosen = results.filter((r) => selected.has(r.placeId));
    if (chosen.length === 0 || saving) return;
    setSaving(true);
    try {
      const body = saveTarget === "new"
        ? { listName: saveName.trim() || query.trim() || "Leads", category: saveCategory.trim() || undefined, leads: chosen }
        : { listId: saveTarget, leads: chosen };
      const j = await fetch("/api/leads/saved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
      if (j?.success) { setInfo(`Saved ${j.data.saved} lead${j.data.saved === 1 ? "" : "s"}${j.data.skipped ? `, ${j.data.skipped} already saved` : ""}.`); setSelected(new Set()); setSaveOpen(false); loadLists(); }
      else setError(j?.error?.message || "Could not save.");
    } catch { setError("Could not save."); } finally { setSaving(false); }
  };

  const showList = async (l: LeadList) => {
    setOpenList(l); setListLeads([]); setListLoading(true); setConfirmDelList(false);
    try { const j = await fetch(`/api/leads/lists/${l.id}`).then((r) => r.json()); if (j?.success) { setOpenList(j.data.list); setListLeads(j.data.leads || []); } } catch { /* ignore */ } finally { setListLoading(false); }
  };

  const setLeadStatus = async (lead: SavedLead, status: string) => {
    setBusyLead(lead.id);
    try { await fetch(`/api/leads/saved/${lead.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); setListLeads((ls) => ls.map((x) => x.id === lead.id ? { ...x, status } : x)); } catch { /* ignore */ } finally { setBusyLead(null); }
  };
  const removeLead = async (lead: SavedLead) => {
    setBusyLead(lead.id);
    try { await fetch(`/api/leads/saved/${lead.id}`, { method: "DELETE" }); setListLeads((ls) => ls.filter((x) => x.id !== lead.id)); loadLists(); } catch { /* ignore */ } finally { setBusyLead(null); }
  };
  const removeList = async (l: LeadList) => {
    try { await fetch(`/api/leads/lists/${l.id}`, { method: "DELETE" }); setOpenList(null); loadLists(); } catch { /* ignore */ }
  };

  // Add a hand-entered lead straight into the open list — a direct UI action
  // (POST /api/leads/saved with a single lead), no agent prompt.
  const addLead = async (fields: { name: string; phone?: string; website?: string; address?: string }) => {
    if (!openList) return false;
    const j = await fetch("/api/leads/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId: openList.id, leads: [fields] }),
    }).then((r) => r.json()).catch(() => null);
    if (j?.success) { await showList(openList); loadLists(); return true; }
    return false;
  };

  // Save an inline edit to a saved lead's contact details (PATCH …/saved/[id]).
  const patchLead = async (lead: SavedLead, fields: { name: string; phone: string; website: string; address: string }) => {
    const j = await fetch(`/api/leads/saved/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    }).then((r) => r.json()).catch(() => null);
    if (j?.success) { setListLeads((ls) => ls.map((x) => x.id === lead.id ? { ...x, ...fields } : x)); return true; }
    return false;
  };

  const pitchFor = (name: string, website?: string | null, address?: string | null) => onAsk(`Draft a cold-outreach pitch to ${name}${website ? ` (${website})` : ""}${address ? ` — a local business at ${address}` : ""}. Use my brand's services and a personalized hook.`);
  const proposalFor = (name: string, website?: string | null) => onAsk(`Write a branded service proposal for ${name}${website ? ` (${website})` : ""} offering my services. Use my Brand Kit's offerings.`);

  // KPIs for the left summary card.
  const totalLeadsSaved = lists.reduce((n, l) => n + (l.leadCount ?? 0), 0);
  const wonCount = listLeads.filter((l) => (l.status || "").toUpperCase() === "WON").length;

  // Apply the left-aside status filter to the open list's leads.
  const visibleLeads = statusFilter ? listLeads.filter((l) => (l.status || "NEW").toUpperCase() === statusFilter) : listLeads;

  // Vertical section nav (left aside).
  const nav: { id: "search" | "lists"; label: string; icon: ElementType; count?: number }[] = [
    { id: "search", label: "Find leads", icon: Search },
    { id: "lists", label: "My lists", icon: Folder, count: lists.length },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
        {/* LEFT: sticky KPIs + section menu + primary action + filters */}
        <aside className="space-y-3 lg:sticky lg:top-0 lg:w-[280px] lg:shrink-0">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start gap-2.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Target className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[15px] font-bold">Lead finder</h2>
                <p className="truncate text-[11.5px] text-muted-foreground">{lists.length} {lists.length === 1 ? "list" : "lists"} · {totalLeadsSaved} saved</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <MiniStat label="Lists" value={lists.length.toLocaleString()} />
              <MiniStat label="Saved" value={totalLeadsSaved.toLocaleString()} />
              <MiniStat label="Won" value={openList ? wonCount.toLocaleString() : "—"} />
            </div>
          </div>

          {/* section menu */}
          <nav className="rounded-2xl border border-border bg-card p-1.5">
            {nav.map((n) => {
              const active = tab === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => { setTab(n.id); if (n.id === "lists") setOpenList(null); setAddOpen(false); }}
                  className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors", active ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}
                >
                  <n.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-start">{n.label}</span>
                  {typeof n.count === "number" && n.count > 0 && (
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums", active ? "bg-brand-500/15 text-brand-500" : "bg-muted text-muted-foreground")}>{n.count}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* primary action — context-aware */}
          {tab === "search" ? (
            <button onClick={() => { setTab("search"); setOpenList(null); }} className="inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
              <Search className="h-4 w-4" /> Find leads
            </button>
          ) : openList ? (
            <button onClick={() => setAddOpen((v) => !v)} className={cn("inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] px-3.5 py-2.5 text-[13px] font-semibold transition-colors", addOpen ? "border border-brand-500/60 text-brand-500" : "bg-gradient-to-r from-brand-500 to-violet-500 text-white shadow-lg shadow-brand-500/30")}>
              {addOpen ? <><X className="h-4 w-4" /> Close form</> : <><UserPlus className="h-4 w-4" /> Add a lead</>}
            </button>
          ) : (
            <button onClick={() => setTab("search")} className="inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30">
              <Search className="h-4 w-4" /> Find leads
            </button>
          )}

          {/* status filter — only when a list is open */}
          {tab === "lists" && openList && (
            <div className="rounded-2xl border border-border bg-card p-3">
              <p className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"><ListChecks className="h-3.5 w-3.5" /> Filter by status</p>
              <div className="space-y-0.5">
                {(["", ...LEAD_STATUS] as const).map((s) => {
                  const on = statusFilter === s;
                  const label = s === "" ? "All leads" : s[0] + s.slice(1).toLowerCase();
                  return (
                    <button key={s || "all"} onClick={() => setStatusFilter(s)} className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors", on ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}>
                      <span className="flex-1 text-start">{label}</span>
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums", on ? "bg-brand-500/15 text-brand-500" : "bg-muted text-muted-foreground")}>{s === "" ? listLeads.length : listLeads.filter((l) => (l.status || "NEW").toUpperCase() === s).length}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        {/* RIGHT: search results / lists grid / list detail — full width */}
        <div className="min-w-0 flex-1 space-y-4">
        {tab === "search" ? (
          <>
            {/* search box */}
            <section className="rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-500/8 to-violet-500/5 p-4 sm:p-5">
              <div className="grid gap-2.5 sm:grid-cols-[1.4fr_1fr_auto]">
                <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }} placeholder="Business type — e.g. dentists, cafés, gyms" className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60" />
                <input value={location} onChange={(e) => setLocation(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }} placeholder="Location (city, area)" className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60" />
                <button onClick={runSearch} disabled={searching || !query.trim()} className="inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-sm disabled:opacity-60">
                  {searching ? <FlowLoader size={16} tone="white" /> : <Search className="h-4 w-4" />} Search
                </button>
              </div>
              {error && <p className="mt-2 text-[12px] text-rose-500">{error}</p>}
              {info && !error && <p className="mt-2 text-[12px] text-muted-foreground">{info}</p>}
            </section>

            {/* save bar */}
            {selected.size > 0 && (
              <section className="sticky top-0 z-10 rounded-2xl border border-brand-500/40 bg-card/95 p-3 shadow-lg backdrop-blur">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold"><ListChecks className="h-4 w-4 text-brand-500" /> {selected.size} selected</span>
                  <button onClick={() => setSaveOpen((v) => !v)} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm"><FolderPlus className="h-3.5 w-3.5" /> Save to list</button>
                  <button onClick={() => setSelected(new Set())} className="rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground">Clear</button>
                </div>
                {saveOpen && (
                  <div className="mt-2.5 grid gap-2.5 border-t border-border pt-2.5 sm:grid-cols-[1fr_1fr_auto]">
                    <select value={saveTarget} onChange={(e) => setSaveTarget(e.target.value)} className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60">
                      <option value="new">+ New list</option>
                      {lists.map((l) => <option key={l.id} value={l.id}>{l.name}{l.category ? ` · ${l.category}` : ""}</option>)}
                    </select>
                    {saveTarget === "new" ? (
                      <div className="grid grid-cols-2 gap-2">
                        <input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="List name" className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60" />
                        <input value={saveCategory} onChange={(e) => setSaveCategory(e.target.value)} placeholder="Category" className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60" />
                      </div>
                    ) : <span className="text-[12px] text-muted-foreground self-center">Adds to the selected list.</span>}
                    <button onClick={saveSelected} disabled={saving} className="inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">{saving ? <FlowLoader size={15} tone="white" /> : <Save className="h-3.5 w-3.5" />} Save</button>
                  </div>
                )}
              </section>
            )}

            {/* results */}
            {results.length > 0 ? (
              <div className="space-y-2.5">
                {results.map((lead) => {
                  const on = selected.has(lead.placeId);
                  return (
                    <div key={lead.placeId} className={cn("rounded-2xl border bg-card p-3.5 transition", on ? "border-brand-500/50" : "border-border")}>
                      <div className="flex items-start gap-3">
                        <button onClick={() => toggle(lead.placeId)} className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border transition", on ? "border-brand-500 bg-brand-500 text-white" : "border-border text-transparent hover:border-brand-500/60")}><Check className="h-3.5 w-3.5" /></button>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="text-[14px] font-bold">{lead.name}</p>
                            {typeof lead.rating === "number" && <span className="inline-flex items-center gap-1 text-[11.5px] text-amber-500"><Star className="h-3.5 w-3.5 fill-current" /> {lead.rating.toFixed(1)}{lead.reviewCount ? <span className="text-muted-foreground">({lead.reviewCount})</span> : null}</span>}
                          </div>
                          <p className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" /> {lead.address}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                            {lead.phone && <span className="inline-flex items-center gap-1 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {lead.phone}</span>}
                            {lead.website && <a href={lead.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-500 hover:underline"><Globe className="h-3.5 w-3.5" /> Website</a>}
                            <a href={lead.googleMapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /> Maps</a>
                          </div>
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <button onClick={() => pitchFor(lead.name, lead.website, lead.address)} className="inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm"><Send className="h-3.5 w-3.5" /> Pitch</button>
                            <button onClick={() => proposalFor(lead.name, lead.website)} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground"><FileText className="h-3.5 w-3.5" /> Proposal</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : !searching && (
              <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-500"><Sparkles className="h-6 w-6" /></span>
                  <p className="mt-3 text-[13.5px] font-semibold">Find your next clients</p>
                  <p className="mt-1 text-[12.5px] text-muted-foreground">Search a business type + location, select the ones you want, and save them to a named list — then pitch or propose to them.</p>
                </div>
              </section>
            )}
          </>
        ) : openList ? (
          // ── list detail ──
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button onClick={() => { setOpenList(null); setConfirmDelList(false); setAddOpen(false); setStatusFilter(""); }} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> Lists</button>
              <div className="min-w-0">
                <h3 className="truncate text-[14px] font-bold">{openList.name}</h3>
                <p className="truncate text-[11.5px] text-muted-foreground">{openList.category ? `${openList.category} · ` : ""}{statusFilter ? `${visibleLeads.length} of ${listLeads.length}` : `${listLeads.length} lead${listLeads.length === 1 ? "" : "s"}`}</p>
              </div>
              {confirmDelList ? (
                <span className="ms-auto inline-flex items-center gap-1.5">
                  <button onClick={() => removeList(openList)} className="inline-flex items-center gap-1.5 rounded-[10px] bg-rose-500 px-3 py-1.5 text-[12px] font-semibold text-white"><Trash2 className="h-3.5 w-3.5" /> Confirm delete</button>
                  <button onClick={() => setConfirmDelList(false)} className="inline-flex items-center gap-1 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Cancel</button>
                </span>
              ) : (
                <button onClick={() => setConfirmDelList(true)} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:border-rose-500/50 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /> Delete list</button>
              )}
            </div>
            {/* Real in-surface "add a lead" form (direct POST — no agent prompt). */}
            {addOpen && (
              <AddLeadForm onAdd={addLead} onClose={() => setAddOpen(false)} />
            )}
            {listLoading ? (
              <div className="py-8"><FlowLoader size={22} label="Loading leads…" /></div>
            ) : visibleLeads.length ? (
              <div className="space-y-2">
                {visibleLeads.map((lead) => (
                  <LeadRow key={lead.id} lead={lead} busy={busyLead === lead.id} onStatus={(s) => setLeadStatus(lead, s)} onRemove={() => removeLead(lead)} onEdit={(f) => patchLead(lead, f)} onEnrich={() => onAsk(`Enrich the lead "${lead.name}"${lead.category ? ` at ${lead.category}` : ""} — find their work email, phone and LinkedIn, then save it.`)} />
                ))}
              </div>
            ) : statusFilter ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-muted-foreground">No {statusFilter[0] + statusFilter.slice(1).toLowerCase()} leads in this list. Clear the filter to see all {listLeads.length}.</p>
            ) : (
              <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-muted-foreground">No leads in this list yet — add one with “Add a lead”, or save some from the Find leads tab.</p>
            )}
          </section>
        ) : (
          // ── lists grid ──
          lists.length ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {lists.map((l) => (
                <button key={l.id} onClick={() => showList(l)} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left transition hover:border-brand-500/60">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Folder className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold">{l.name}</p>
                    <p className="truncate text-[11.5px] text-muted-foreground">{l.category ? `${l.category} · ` : ""}{l.leadCount ?? 0} lead{(l.leadCount ?? 0) === 1 ? "" : "s"}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-500"><Folder className="h-6 w-6" /></span>
                <p className="mt-3 text-[13.5px] font-semibold">No saved lead lists yet</p>
                <p className="mt-1 text-[12.5px] text-muted-foreground">Search for businesses, select them, and save them to a named, categorized list you can return to.</p>
                <button onClick={() => setTab("search")} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Search className="h-4 w-4" /> Find leads</button>
              </div>
            </section>
          )
        )}
        </div>
      </div>
    </div>
  );
}

// Compact summary stat used in the left identity card.
function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-1.5 py-2 text-center">
      <p className="text-[16px] font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-[10px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

// Real in-surface form to add a hand-entered lead to the open list. Direct API
// (POST /api/leads/saved) — no agent prompt. [[surface-buttons-are-ui-actions]]
function AddLeadForm({ onAdd, onClose }: { onAdd: (f: { name: string; phone?: string; website?: string; address?: string }) => Promise<boolean>; onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!name.trim()) { setError("Enter the business name."); return; }
    setSaving(true); setError("");
    const ok = await onAdd({ name: name.trim(), phone: phone.trim() || undefined, website: website.trim() || undefined, address: address.trim() || undefined });
    setSaving(false);
    if (ok) { setName(""); setPhone(""); setWebsite(""); setAddress(""); onClose(); }
    else setError("Could not add the lead. Try again.");
  };

  return (
    <div className="mb-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold"><UserPlus className="h-3.5 w-3.5 text-brand-500" /> Add a lead to this list</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Business name *" className="w-full rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand-500/60 sm:col-span-2" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" className="w-full rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand-500/60" />
        <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website (optional)" inputMode="url" className="w-full rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand-500/60" />
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address (optional)" className="w-full rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand-500/60 sm:col-span-2" />
      </div>
      {error && <p className="mt-2 text-[11.5px] text-rose-500">{error}</p>}
      <div className="mt-2.5 flex items-center gap-1.5">
        <button onClick={submit} disabled={saving || !name.trim()} className="inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm disabled:opacity-60">{saving ? <FlowLoader size={13} tone="white" /> : <Plus className="h-3.5 w-3.5" />} Add lead</button>
        <button onClick={onClose} className="inline-flex items-center gap-1 rounded-[9px] border border-border px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Cancel</button>
      </div>
    </div>
  );
}

interface LeadPitch { id: string; businessName?: string; documentType?: string; status?: string; recipientEmail?: string | null }
const statusPill = (s?: string) => ({ READY: "bg-emerald-500/10 text-emerald-500", SENT: "bg-violet-500/10 text-violet-500", FAILED: "bg-rose-500/10 text-rose-500", RESEARCHING: "bg-brand-500/10 text-brand-500", PENDING: "bg-muted text-muted-foreground" }[(s || "PENDING").toUpperCase()] || "bg-muted text-muted-foreground");

// ── Detail content shapes (from GET /api/pitch/[id]) ─────────────────────────
interface OutreachContent {
  subject?: string; headline?: string; personalizedHook?: string; keyFindings?: string[];
  hiddenFindingsCount?: number; opportunityParagraph?: string; solutionBullets?: string[];
  impactParagraph?: string; ctaText?: string; ctaSubtext?: string; closingLine?: string;
}
interface ProposalContent {
  documentType: "service_proposal"; subject?: string; title?: string; subtitle?: string;
  preparedFor?: string; preparedBy?: string; serviceTitle?: string; executiveSummary?: string;
  aboutBrand?: string; clientNeed?: string; commitments?: string[]; benefits?: string[];
  deliverables?: Array<{ title?: string; description?: string }>;
  timeline?: Array<{ label?: string; title?: string; description?: string }>;
  proofPoints?: Array<{ metric?: string; label?: string; note?: string }>;
  pricing?: { name?: string; amount?: number; originalAmount?: number; interval?: string; note?: string };
  terms?: string[]; nextSteps?: string[];
  contact?: { name?: string; email?: string; phone?: string; website?: string; address?: string };
}
interface PitchDetail {
  id: string; businessName: string; businessUrl?: string | null; documentType?: string;
  status?: string; recipientEmail?: string | null; recipientName?: string | null;
  sentAt?: string | null; errorMessage?: string | null; createdAt?: string;
  research: ResearchData; pitchContent: OutreachContent | ProposalContent;
}
const isProposalContent = (c: OutreachContent | ProposalContent): c is ProposalContent =>
  (c as ProposalContent)?.documentType === "service_proposal";
const fmtPrice = (n?: number) => typeof n === "number" ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "";

// The human-editable text fields shared across pitches (PitchContent) and
// proposals — only those present on a given document render. Everything else in
// the content object (sections, design, arrays) is preserved untouched on save.
const EDIT_FIELDS: { key: string; label: string; long?: boolean }[] = [
  { key: "subject", label: "Subject" },
  { key: "headline", label: "Headline", long: true },
  { key: "personalizedHook", label: "Opening hook", long: true },
  { key: "opportunityParagraph", label: "The opportunity", long: true },
  { key: "body", label: "Body", long: true },
  { key: "impactParagraph", label: "Impact", long: true },
  { key: "ctaText", label: "Call to action" },
  { key: "closingLine", label: "Closing line", long: true },
];

/** A saved lead in a list, expandable to its pitches/proposals with create/email/delete. */
function LeadRow({ lead, busy, onStatus, onRemove, onEdit, onEnrich }: { lead: SavedLead; busy: boolean; onStatus: (s: string) => void; onRemove: () => void; onEdit: (f: { name: string; phone: string; website: string; address: string }) => Promise<boolean>; onEnrich?: () => void }) {
  const [open, setOpen] = useState(false);
  // Inline edit of the lead's own contact details (PATCH …/saved/[id]).
  const [leadEditOpen, setLeadEditOpen] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: "", phone: "", website: "", address: "" });
  const [leadSaving, setLeadSaving] = useState(false);
  const [items, setItems] = useState<LeadPitch[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [propOpen, setPropOpen] = useState(false);
  const [svcTitle, setSvcTitle] = useState("");
  const [svcDesc, setSvcDesc] = useState("");
  const [emailFor, setEmailFor] = useState<string | null>(null);
  const [emailTo, setEmailTo] = useState("");
  const [editFor, setEditFor] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editRaw, setEditRaw] = useState<Record<string, unknown>>({});
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  // ── detail view (full audit + client-facing preview) ──
  const [viewFor, setViewFor] = useState<string | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [detail, setDetail] = useState<PitchDetail | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [confirmDelLead, setConfirmDelLead] = useState(false);
  const [confirmDelItem, setConfirmDelItem] = useState<string | null>(null);

  const openLeadEdit = () => {
    setLeadForm({ name: lead.name || "", phone: lead.phone || "", website: lead.website || "", address: lead.address || "" });
    setLeadEditOpen(true); setConfirmDelLead(false);
  };
  const saveLeadEdit = async () => {
    if (!leadForm.name.trim()) return;
    setLeadSaving(true);
    const ok = await onEdit({ name: leadForm.name.trim(), phone: leadForm.phone.trim(), website: leadForm.website.trim(), address: leadForm.address.trim() });
    setLeadSaving(false);
    if (ok) setLeadEditOpen(false);
  };

  const loadItems = useCallback(async () => {
    setLoading(true);
    try { const j = await fetch(`/api/pitch?savedLeadId=${lead.id}&limit=20`).then((r) => r.json()); if (j?.success) setItems(j.data.pitches || []); } catch { /* ignore */ } finally { setLoading(false); }
  }, [lead.id]);
  const toggle = () => { const n = !open; setOpen(n); if (n) loadItems(); };

  const newPitch = async () => {
    setWorking(true);
    try { await fetch("/api/pitch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessName: lead.name, businessUrl: lead.website || undefined, savedLeadId: lead.id }) }); await loadItems(); } catch { /* ignore */ } finally { setWorking(false); }
  };
  const newProposal = async () => {
    if (!svcTitle.trim()) return;
    setWorking(true);
    try {
      const j = await fetch("/api/pitch/proposals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetName: lead.name, targetWebsite: lead.website || undefined, serviceTitle: svcTitle.trim(), serviceDescription: svcDesc.trim() || svcTitle.trim(), savedLeadId: lead.id }) }).then((r) => r.json());
      if (j?.success) { setPropOpen(false); setSvcTitle(""); setSvcDesc(""); await loadItems(); }
    } catch { /* ignore */ } finally { setWorking(false); }
  };
  const delItem = async (id: string) => { setWorking(true); try { await fetch(`/api/pitch/${id}`, { method: "DELETE" }); setItems((p) => p.filter((x) => x.id !== id)); } catch { /* ignore */ } finally { setWorking(false); } };
  const sendItem = async (id: string) => { if (!emailTo.trim()) return; setWorking(true); try { const j = await fetch(`/api/pitch/${id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipientEmail: emailTo.trim() }) }).then((r) => r.json()); if (j?.success) { setEmailFor(null); setEmailTo(""); await loadItems(); } } catch { /* ignore */ } finally { setWorking(false); } };

  // Open the in-place editor: pull the full document, surface its editable text
  // fields, and let the user revise the detail before re-saving (or emailing).
  const openEdit = async (id: string) => {
    if (editFor === id) { setEditFor(null); return; }
    setEmailFor(null); setViewFor(null); setDetail(null); setEditFor(id); setEditLoading(true); setEditFields({}); setEditRaw({}); setEditName(""); setEditEmail("");
    try {
      const j = await fetch(`/api/pitch/${id}`).then((r) => r.json());
      if (j?.success) {
        const p = j.data.pitch;
        const content = (p.pitchContent && typeof p.pitchContent === "object" && !Array.isArray(p.pitchContent)) ? p.pitchContent as Record<string, unknown> : {};
        setEditRaw(content);
        setEditName(p.recipientName || "");
        setEditEmail(p.recipientEmail || "");
        const fields: Record<string, string> = {};
        for (const f of EDIT_FIELDS) { if (typeof content[f.key] === "string") fields[f.key] = content[f.key] as string; }
        setEditFields(fields);
      }
    } catch { /* ignore */ } finally { setEditLoading(false); }
  };
  const saveEdit = async (id: string) => {
    setWorking(true);
    try {
      const mergedContent = { ...editRaw, ...editFields };
      const j = await fetch(`/api/pitch/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipientName: editName.trim() || null, recipientEmail: editEmail.trim() || null, pitchContent: mergedContent }) }).then((r) => r.json());
      if (j?.success) { setEditFor(null); await loadItems(); }
    } catch { /* ignore */ } finally { setWorking(false); }
  };

  // Open the full detail view: pull the document + internal research so we can
  // render the digital-presence audit, score, Google profile, reviews, pain
  // points, opportunities, and the client-facing pitch/proposal preview.
  const openView = async (id: string) => {
    if (viewFor === id) { setViewFor(null); setDetail(null); return; }
    setEditFor(null); setEmailFor(null); setViewFor(id); setViewLoading(true); setDetail(null);
    try {
      const j = await fetch(`/api/pitch/${id}`).then((r) => r.json());
      if (j?.success) {
        const p = j.data.pitch;
        const content = (p.pitchContent && typeof p.pitchContent === "object") ? p.pitchContent : {};
        const research = (p.research && typeof p.research === "object") ? p.research : {};
        setDetail({ ...p, pitchContent: content, research } as PitchDetail);
      }
    } catch { /* ignore */ } finally { setViewLoading(false); }
  };

  // Download the generated pitch/proposal as a PDF. The dedicated PDF path is
  // POST /api/pitch/[id]/send with { pdfOnly: true }, which streams the binary.
  const downloadPdf = async (id: string, name: string) => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/pitch/${id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pdfOnly: true }) });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(name || "pitch").replace(/[^a-z0-9]/gi, "-").toLowerCase()}-proposal.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ } finally { setDownloading(false); }
  };

  return (
    <div className="rounded-xl border border-border bg-muted/30">
      <div className="flex flex-wrap items-start gap-x-2.5 gap-y-1.5 p-3">
        <button onClick={toggle} className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"><ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} /></button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold">{lead.name}</p>
            {typeof lead.rating === "number" && <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-500"><Star className="h-3 w-3 fill-current" /> {lead.rating.toFixed(1)}</span>}
            {(lead.pitchCount ?? 0) > 0 && <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-500">{lead.pitchCount}</span>}
          </div>
          {lead.title ? (
            <>
              <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{[lead.title, lead.category].filter(Boolean).join(" · ")}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]">
                {lead.email && <span className="inline-flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" /> {lead.email}</span>}
                {lead.phone && <span className="inline-flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" /> {lead.phone}</span>}
                {!lead.enrichedAt && onEnrich ? (
                  <button onClick={onEnrich} disabled={busy} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 font-semibold text-brand-500 hover:border-brand-500/60 disabled:opacity-60"><Search className="h-3 w-3" /> Find email &amp; phone</button>
                ) : lead.enrichedAt ? (
                  <span className="inline-flex items-center gap-1 text-emerald-500"><CheckCircle2 className="h-3 w-3" /> Enriched</span>
                ) : null}
              </div>
            </>
          ) : (
            <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{[lead.address, lead.phone].filter(Boolean).join(" · ")}</p>
          )}
        </div>
        <select value={(lead.status || "NEW").toUpperCase()} onChange={(e) => onStatus(e.target.value)} disabled={busy} className={cn("shrink-0 rounded-full border-0 px-2.5 py-1 text-[11px] font-semibold outline-none", statusCls(lead.status))}>
          {LEAD_STATUS.map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}
        </select>
        <button onClick={() => leadEditOpen ? setLeadEditOpen(false) : openLeadEdit()} disabled={busy} className={cn("mt-1 shrink-0 hover:text-brand-500 disabled:opacity-60", leadEditOpen ? "text-brand-500" : "text-muted-foreground")} title="Edit lead details"><Pencil className="h-3.5 w-3.5" /></button>
        {confirmDelLead ? (
          <span className="mt-0.5 inline-flex shrink-0 items-center gap-1">
            <button onClick={onRemove} disabled={busy} className="inline-flex items-center gap-1 rounded-[8px] bg-rose-500 px-2 py-1 text-[10.5px] font-semibold text-white disabled:opacity-60">{busy ? <FlowLoader size={11} tone="white" /> : <Trash2 className="h-3 w-3" />} Delete</button>
            <button onClick={() => setConfirmDelLead(false)} className="rounded-[8px] border border-border px-2 py-1 text-[10.5px] font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
          </span>
        ) : (
          <button onClick={() => { setLeadEditOpen(false); setConfirmDelLead(true); }} disabled={busy} className="mt-1 shrink-0 text-muted-foreground hover:text-rose-500 disabled:opacity-60" title="Delete lead"><Trash2 className="h-3.5 w-3.5" /></button>
        )}
      </div>

      {/* Inline contact-detail edit (direct PATCH — no agent prompt). */}
      {leadEditOpen && (
        <div className="border-t border-border/70 px-3 py-2.5">
          <div className="rounded-lg border border-brand-500/30 bg-brand-500/5 p-2.5">
            <p className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold"><Pencil className="h-3.5 w-3.5 text-brand-500" /> Edit lead details</p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <input value={leadForm.name} onChange={(e) => setLeadForm((f) => ({ ...f, name: e.target.value }))} placeholder="Business name *" className="w-full rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-[12px] outline-none focus:border-brand-500/60 sm:col-span-2" />
              <input value={leadForm.phone} onChange={(e) => setLeadForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone" className="w-full rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-[12px] outline-none focus:border-brand-500/60" />
              <input value={leadForm.website} onChange={(e) => setLeadForm((f) => ({ ...f, website: e.target.value }))} placeholder="Website" inputMode="url" className="w-full rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-[12px] outline-none focus:border-brand-500/60" />
              <input value={leadForm.address} onChange={(e) => setLeadForm((f) => ({ ...f, address: e.target.value }))} placeholder="Address" className="w-full rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-[12px] outline-none focus:border-brand-500/60 sm:col-span-2" />
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <button onClick={saveLeadEdit} disabled={leadSaving || !leadForm.name.trim()} className="inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60">{leadSaving ? <FlowLoader size={13} tone="white" /> : <Save className="h-3.5 w-3.5" />} Save</button>
              <button onClick={() => setLeadEditOpen(false)} className="inline-flex items-center gap-1 rounded-[9px] border border-border px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Cancel</button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="border-t border-border/70 px-3 py-2.5">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <button onClick={newPitch} disabled={working} className="inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm disabled:opacity-60"><Send className="h-3.5 w-3.5" /> New pitch</button>
            <button onClick={() => setPropOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground"><Plus className="h-3.5 w-3.5" /> New proposal</button>
            {lead.website && <a href={/^https?:\/\//.test(lead.website) ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-[9px] border border-border px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><Globe className="h-3.5 w-3.5" /> Site</a>}
          </div>
          {propOpen && (
            <div className="mb-2.5 rounded-lg border border-brand-500/30 bg-brand-500/5 p-2.5">
              <input value={svcTitle} onChange={(e) => setSvcTitle(e.target.value)} placeholder="Service you're offering — e.g. Social media management" className="w-full rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand-500/60" />
              <textarea rows={2} value={svcDesc} onChange={(e) => setSvcDesc(e.target.value)} placeholder="What you'll deliver (optional — pulled from your Brand Kit if blank)" className="mt-2 w-full resize-none rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand-500/60" />
              <button onClick={newProposal} disabled={working || !svcTitle.trim()} className="mt-2 inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60">{working ? <FlowLoader size={14} tone="white" /> : <Presentation className="h-3.5 w-3.5" />} Generate proposal</button>
            </div>
          )}
          {loading ? <div className="py-2"><FlowLoader size={16} label="Loading…" /></div> : items.length ? (
            <div className="space-y-1.5">
              {items.map((it) => {
                const isProp = it.documentType === "service_proposal";
                return (
                  <div key={it.id} className="rounded-lg border border-border bg-background px-2.5 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md", isProp ? "bg-violet-500/10 text-violet-500" : "bg-brand-500/10 text-brand-500")}>{isProp ? <Presentation className="h-4 w-4" /> : <FileText className="h-4 w-4" />}</span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{isProp ? "Proposal" : "Pitch"}{it.businessName ? ` · ${it.businessName}` : ""}</span>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", statusPill(it.status))}>{(it.status || "PENDING").toLowerCase()}</span>
                      <button onClick={() => openView(it.id)} className={cn("shrink-0 hover:text-brand-500", viewFor === it.id ? "text-brand-500" : "text-muted-foreground")} title="View full detail"><Eye className="h-3.5 w-3.5" /></button>
                      <button onClick={() => openEdit(it.id)} className={cn("shrink-0 hover:text-brand-500", editFor === it.id ? "text-brand-500" : "text-muted-foreground")} title="Edit details"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => { setEditFor(null); setViewFor(null); setDetail(null); setConfirmDelItem(null); setEmailFor(emailFor === it.id ? null : it.id); setEmailTo(it.recipientEmail || ""); }} className="shrink-0 text-muted-foreground hover:text-brand-500" title="Email"><Mail className="h-3.5 w-3.5" /></button>
                      {confirmDelItem === it.id ? (
                        <span className="inline-flex shrink-0 items-center gap-1">
                          <button onClick={() => { delItem(it.id); setConfirmDelItem(null); }} disabled={working} className="inline-flex items-center gap-1 rounded-[8px] bg-rose-500 px-2 py-0.5 text-[10.5px] font-semibold text-white disabled:opacity-60"><Trash2 className="h-3 w-3" /> Delete</button>
                          <button onClick={() => setConfirmDelItem(null)} className="rounded-[8px] border border-border px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
                        </span>
                      ) : (
                        <button onClick={() => { setEmailFor(null); setConfirmDelItem(it.id); }} disabled={working} className="shrink-0 text-muted-foreground hover:text-rose-500 disabled:opacity-60" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                      )}
                    </div>
                    {editFor === it.id && (
                      <div className="mt-2 rounded-lg border border-brand-500/30 bg-brand-500/5 p-2.5">
                        {editLoading ? <div className="py-1.5"><FlowLoader size={16} label="Loading the document…" /></div> : (
                          <>
                            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                              <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Recipient name" className="w-full rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-[12px] outline-none focus:border-brand-500/60" />
                              <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="recipient@email.com" className="w-full rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-[12px] outline-none focus:border-brand-500/60" />
                            </div>
                            {EDIT_FIELDS.filter((f) => f.key in editFields).map((f) => (
                              <div key={f.key} className="mt-2">
                                <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{f.label}</label>
                                {f.long ? (
                                  <textarea rows={2} value={editFields[f.key]} onChange={(e) => setEditFields((p) => ({ ...p, [f.key]: e.target.value }))} className="w-full resize-none rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-[12.5px] leading-relaxed outline-none focus:border-brand-500/60" />
                                ) : (
                                  <input value={editFields[f.key]} onChange={(e) => setEditFields((p) => ({ ...p, [f.key]: e.target.value }))} className="w-full rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-[12.5px] outline-none focus:border-brand-500/60" />
                                )}
                              </div>
                            ))}
                            <div className="mt-2.5 flex items-center gap-1.5">
                              <button onClick={() => saveEdit(it.id)} disabled={working} className="inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60">{working ? <FlowLoader size={13} tone="white" /> : <Save className="h-3.5 w-3.5" />} Save changes</button>
                              <button onClick={() => setEditFor(null)} className="inline-flex items-center gap-1 rounded-[9px] border border-border px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /> Cancel</button>
                            </div>
                            <p className="mt-1.5 text-[10.5px] text-muted-foreground">Saved changes update the document for this lead — then email it to send the refreshed version.</p>
                          </>
                        )}
                      </div>
                    )}
                    {emailFor === it.id && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="recipient@email.com" className="w-full rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-[12px] outline-none focus:border-brand-500/60" />
                        <button onClick={() => sendItem(it.id)} disabled={working || !emailTo.trim()} className="inline-flex shrink-0 items-center gap-1 rounded-[8px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60">{working ? <FlowLoader size={13} tone="white" /> : <Send className="h-3.5 w-3.5" />} Send</button>
                      </div>
                    )}
                    {viewFor === it.id && (
                      <div className="mt-2">
                        {viewLoading ? (
                          <div className="rounded-lg border border-border bg-background py-6"><FlowLoader size={18} label="Opening the full detail…" /></div>
                        ) : detail ? (
                          <PitchDetailView detail={detail} downloading={downloading} onDownload={() => downloadPdf(detail.id, detail.businessName)} onClose={() => { setViewFor(null); setDetail(null); }} />
                        ) : (
                          <p className="rounded-lg border border-border bg-background px-3 py-4 text-center text-[12px] text-muted-foreground">Could not load this document.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : <p className="py-1.5 text-[12px] text-muted-foreground">No pitches or proposals yet — create one above.</p>}
        </div>
      )}
    </div>
  );
}

// ── Section heading helper ───────────────────────────────────────────────────
function SectionTitle({ icon, children, className }: { icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <h4 className={cn("flex items-center gap-1.5 text-[12.5px] font-bold", className)}>{icon}{children}</h4>;
}

/**
 * Full pitch/proposal detail — the digital-presence audit (health score, score
 * breakdown, Google profile, reviews), pain points, opportunities, and the
 * client-facing pitch/proposal preview. Plus a one-tap PDF download.
 * All data comes from GET /api/pitch/[id]; PDF from POST …/send { pdfOnly }.
 */
function PitchDetailView({ detail, downloading, onDownload, onClose }: { detail: PitchDetail; downloading: boolean; onDownload: () => void; onClose: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showHours, setShowHours] = useState(false);
  const content = detail.pitchContent;
  const proposal = isProposalContent(content) ? content : null;
  const pc = proposal ? null : (content as OutreachContent);
  const research = detail.research || {};
  const gp = research.googlePlaces;
  const status = (detail.status || "PENDING").toUpperCase();
  const isReady = status === "READY" || status === "SENT";
  const isProcessing = status === "PENDING" || status === "RESEARCHING";
  const { overall, categories } = isReady && !proposal ? computeDigitalScore(research) : { overall: 0, categories: [] };

  return (
    <div className="rounded-xl border border-brand-500/30 bg-card">
      {/* header / toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
        <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md", proposal ? "bg-violet-500/10 text-violet-500" : "bg-brand-500/10 text-brand-500")}>{proposal ? <Presentation className="h-4 w-4" /> : <FileText className="h-4 w-4" />}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold">{proposal ? "Service proposal" : "Outreach pitch"} · {detail.businessName}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {research.industry ? `${research.industry} · ` : ""}{status[0] + status.slice(1).toLowerCase()}
            {detail.sentAt ? ` · sent ${new Date(detail.sentAt).toLocaleDateString()}` : ""}
          </p>
        </div>
        {isReady && (
          <button onClick={onDownload} disabled={downloading} className="inline-flex shrink-0 items-center gap-1.5 rounded-[9px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground disabled:opacity-60" title="Download as PDF">
            {downloading ? <FlowLoader size={13} /> : <Download className="h-3.5 w-3.5" />} PDF
          </button>
        )}
        <button onClick={onClose} className="shrink-0 rounded-[9px] border border-border px-2.5 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground" title="Close"><X className="h-3.5 w-3.5" /></button>
      </div>

      <div className="p-3">
        {isProcessing ? (
          <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center">
            <FlowLoader size={20} label={status === "PENDING" ? "Queued for research…" : "Researching the business…"} />
            <p className="mx-auto mt-2 max-w-sm text-[11.5px] text-muted-foreground">The agent is scanning the website, pulling Google Business data, and crafting the {proposal ? "proposal" : "pitch"}. This takes 30–90 seconds — reopen to refresh.</p>
          </div>
        ) : status === "FAILED" ? (
          <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-3 text-[12px] text-rose-500">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{detail.errorMessage || "Research failed. Delete and create a new one to retry."}</span>
          </div>
        ) : proposal ? (
          /* ═══ PROPOSAL — client-facing preview ═══ */
          <ProposalPreview proposal={proposal} businessName={detail.businessName} />
        ) : (
          /* ═══ PITCH — internal audit + client preview ═══ */
          <div className="grid gap-3 lg:grid-cols-2">
            {/* LEFT: digital-presence audit (internal) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <SectionTitle icon={<BarChart3 className="h-4 w-4 text-brand-500" />}>Digital presence audit</SectionTitle>
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">Internal only</span>
              </div>

              {/* health score */}
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[12px] font-semibold">Digital health score</p>
                    <p className={cn("text-[11px] font-semibold", scoreColor(overall))}>{scoreLabel(overall)} · vs 85 top performers</p>
                  </div>
                  <div className="text-right"><span className={cn("text-2xl font-black", scoreColor(overall))}>{overall}</span><span className="text-[10px] text-muted-foreground">/100</span></div>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full transition-all", scoreBg(overall))} style={{ width: `${overall}%` }} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-2.5 text-center">
                  <div><div className={cn("text-[15px] font-black", scoreColor(overall))}>{overall}</div><div className="text-[10px] text-muted-foreground">{detail.businessName.split(" ")[0]}</div></div>
                  <div><div className="text-[15px] font-black text-muted-foreground">52</div><div className="text-[10px] text-muted-foreground">Industry avg</div></div>
                  <div><div className="text-[15px] font-black text-emerald-500">85</div><div className="text-[10px] text-muted-foreground">Top</div></div>
                </div>
              </div>

              {/* score breakdown */}
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <SectionTitle icon={<BarChart3 className="h-4 w-4 text-brand-500" />} className="mb-2.5">Score breakdown</SectionTitle>
                <div className="space-y-2.5">
                  {categories.map((cat) => (
                    <div key={cat.name}>
                      <button onClick={() => setExpanded(expanded === cat.name ? null : cat.name)} className="w-full text-left">
                        <div className="mb-1 flex items-center gap-2">
                          <span className={scoreColor(cat.score)}>{cat.icon}</span>
                          <span className="flex-1 text-[12px] font-medium">{cat.name}</span>
                          <span className={cn("w-8 text-right text-[12px] font-bold", scoreColor(cat.score))}>{cat.score}</span>
                          <span className="w-7 text-right text-[10px] text-muted-foreground">{cat.weight}%</span>
                          {expanded === cat.name ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full transition-all", scoreBg(cat.score))} style={{ width: `${cat.score}%` }} /></div>
                      </button>
                      {expanded === cat.name && (
                        <div className="ms-6 mt-1.5 space-y-1.5">
                          {cat.items.map((item, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-[11px]">
                              {item.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />}
                              <span><span className={item.ok ? "font-medium" : "font-medium text-muted-foreground"}>{item.label}</span>{item.detail ? <span className="text-muted-foreground"> — {item.detail}</span> : null}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Google profile */}
              <div className={cn("rounded-xl border p-3", gp ? "border-border bg-muted/30" : "border-rose-500/30 bg-rose-500/5")}>
                <div className="mb-2 flex items-center gap-2">
                  <SectionTitle icon={<Star className="h-4 w-4 text-amber-500" />}>Google Business profile</SectionTitle>
                  <span className={cn("ms-auto rounded-full px-2 py-0.5 text-[10px] font-semibold", gp ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500")}>{gp ? "Found" : "Not found"}</span>
                </div>
                {!gp ? (
                  <p className="flex items-start gap-1.5 text-[11.5px] text-rose-500"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> No Google listing — essentially invisible to local search.</p>
                ) : (
                  <div className="space-y-2.5">
                    {gp.rating !== undefined && (
                      <div className="flex items-center gap-3">
                        <div className="text-center"><div className={cn("text-2xl font-black", gp.rating >= 4.5 ? "text-emerald-500" : gp.rating >= 4 ? "text-amber-500" : "text-rose-500")}>{gp.rating.toFixed(1)}</div><div className="text-[10px] text-muted-foreground">of 5.0</div></div>
                        <div className="flex-1">
                          <div className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={cn("h-3.5 w-3.5", i < Math.round(gp.rating || 0) ? "fill-amber-400 text-amber-400" : "fill-muted text-muted")} />)}</div>
                          <p className="mt-0.5 text-[11.5px] text-muted-foreground"><strong>{gp.reviewCount ?? 0}</strong> Google reviews</p>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", gp.rating >= 4.5 ? "bg-emerald-500" : gp.rating >= 4 ? "bg-amber-500" : "bg-rose-500")} style={{ width: `${(gp.rating / 5) * 100}%` }} /></div>
                        </div>
                      </div>
                    )}
                    <div className="space-y-1 text-[11.5px] text-muted-foreground">
                      {gp.address && <p className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {gp.address}</p>}
                      {gp.phone && <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 shrink-0" /> <a href={`tel:${gp.phone}`} className="hover:text-foreground">{gp.phone}</a></p>}
                      {gp.googleMapsUrl && <a href={gp.googleMapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-brand-500 hover:underline"><ExternalLink className="h-3.5 w-3.5" /> View on Google Maps</a>}
                      {gp.isOpenNow !== undefined && <p className={cn("flex items-center gap-1.5 font-medium", gp.isOpenNow ? "text-emerald-500" : "text-rose-500")}><span className={cn("h-2 w-2 rounded-full", gp.isOpenNow ? "bg-emerald-500" : "bg-rose-500")} /> {gp.isOpenNow ? "Open now" : "Closed now"}</p>}
                    </div>
                    {gp.hours && gp.hours.length > 0 && (
                      <div>
                        <button onClick={() => setShowHours((v) => !v)} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">{showHours ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} <Clock className="h-3 w-3" /> {showHours ? "Hide hours" : "Show hours"}</button>
                        {showHours && <div className="mt-1 space-y-0.5">{gp.hours.map((h, i) => <div key={i} className="text-[11px] text-muted-foreground">{h}</div>)}</div>}
                      </div>
                    )}
                    {gp.recentReviews && gp.recentReviews.length > 0 && (
                      <div>
                        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold"><Users className="h-3.5 w-3.5 text-muted-foreground" /> Recent reviews</p>
                        <div className="space-y-2">
                          {gp.recentReviews.map((rv, i) => (
                            <div key={i} className={cn("rounded-lg border p-2", rv.rating >= 4 ? "border-emerald-500/20 bg-emerald-500/5" : "border-rose-500/20 bg-rose-500/5")}>
                              <div className="mb-1 flex items-center gap-1.5">
                                <div className="flex">{Array.from({ length: 5 }).map((_, si) => <Star key={si} className={cn("h-3 w-3", si < rv.rating ? "fill-amber-400 text-amber-400" : "fill-muted text-muted")} />)}</div>
                                <span className="text-[10px] text-muted-foreground">{rv.timeAgo}</span>
                              </div>
                              <p className="text-[11.5px] leading-relaxed text-foreground line-clamp-3">&ldquo;{rv.text}&rdquo;</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* tech stack */}
              {research.techStack && research.techStack.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <SectionTitle icon={<Code2 className="h-4 w-4 text-muted-foreground" />} className="mb-2">Detected tech stack</SectionTitle>
                  <div className="flex flex-wrap gap-1.5">{research.techStack.map((t, i) => <span key={i} className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{t}</span>)}</div>
                </div>
              )}

              {/* pain points */}
              {research.painPoints && research.painPoints.length > 0 && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                  <SectionTitle icon={<ShieldAlert className="h-4 w-4" />} className="mb-2 text-rose-500">Identified issues ({research.painPoints.length})</SectionTitle>
                  <div className="space-y-1.5">{research.painPoints.map((p, i) => <div key={i} className="flex items-start gap-1.5 text-[11.5px]"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" /> <span>{p}</span></div>)}</div>
                </div>
              )}

              {/* opportunities */}
              {research.opportunities && research.opportunities.length > 0 && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <SectionTitle icon={<TrendingUp className="h-4 w-4" />} className="mb-2 text-emerald-500">Growth opportunities ({research.opportunities.length})</SectionTitle>
                  <div className="space-y-1.5">{research.opportunities.map((o, i) => <div key={i} className="flex items-start gap-1.5 text-[11.5px]"><Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /> <span>{o}</span></div>)}</div>
                </div>
              )}

              {research.summary && (
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <SectionTitle icon={<Target className="h-4 w-4 text-muted-foreground" />} className="mb-1.5">Business summary</SectionTitle>
                  <p className="text-[11.5px] leading-relaxed text-muted-foreground">{research.summary}</p>
                </div>
              )}
            </div>

            {/* RIGHT: client-facing pitch preview */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <SectionTitle icon={<Eye className="h-4 w-4 text-brand-500" />}>Pitch preview</SectionTitle>
                <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-500">Client sees this</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-border">
                <div className="bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-4 text-white">
                  <p className="text-[18px] font-black leading-tight">{pc?.headline || `A growth strategy for ${detail.businessName}`}</p>
                  <p className="mt-1 text-[11px] text-white/85">Prepared for <strong>{detail.businessName}</strong></p>
                </div>
                <div className="space-y-3 p-3.5">
                  {pc?.subject && (
                    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2"><p className="text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">Email subject</p><p className="text-[12.5px] font-semibold">{pc.subject}</p></div>
                  )}
                  {pc?.personalizedHook && <p className="text-[12.5px] leading-relaxed">{pc.personalizedHook}</p>}
                  {pc?.keyFindings && pc.keyFindings.length > 0 && (
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="mb-2 text-[9.5px] font-bold uppercase tracking-wide text-brand-500">What we discovered</p>
                      <div className="space-y-2">{pc.keyFindings.map((f, i) => <div key={i} className="flex items-start gap-2"><span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-500 text-[9px] font-bold text-white">{i + 1}</span><span className="text-[12px]">{f}</span></div>)}</div>
                      {(pc.hiddenFindingsCount || 0) > 0 && <p className="mt-2 flex items-center gap-1.5 border-t border-border pt-2 text-[10.5px] italic text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> +{pc.hiddenFindingsCount} more insights to discuss.</p>}
                    </div>
                  )}
                  {pc?.opportunityParagraph && <div><p className="mb-1 text-[9.5px] font-bold uppercase tracking-wide text-brand-500">The opportunity</p><p className="text-[12px] leading-relaxed">{pc.opportunityParagraph}</p></div>}
                  {pc?.solutionBullets && pc.solutionBullets.length > 0 && (
                    <div>
                      <p className="mb-2 text-[9.5px] font-bold uppercase tracking-wide text-brand-500">How we can help</p>
                      <div className="space-y-1.5">{pc.solutionBullets.map((b, i) => <div key={i} className="flex items-start gap-2 rounded-lg border border-brand-500/15 bg-brand-500/5 p-2"><Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" /> <span className="text-[12px]">{b}</span></div>)}</div>
                    </div>
                  )}
                  {pc?.impactParagraph && <div className="rounded-lg border border-brand-500/15 bg-gradient-to-br from-brand-500/5 to-violet-500/5 p-3"><p className="mb-1 flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-wide text-brand-500"><TrendingUp className="h-3.5 w-3.5" /> Expected impact</p><p className="text-[12px] leading-relaxed">{pc.impactParagraph}</p></div>}
                  {pc?.ctaText && <div className="rounded-lg bg-gradient-to-r from-brand-500 to-violet-500 p-3 text-center text-white"><Trophy className="mx-auto mb-1 h-5 w-5 opacity-85" /><p className="text-[14px] font-black">{pc.ctaText}</p>{pc.ctaSubtext && <p className="text-[11px] text-white/85">{pc.ctaSubtext}</p>}</div>}
                  {pc?.closingLine && <p className="text-[11.5px] italic text-muted-foreground">{pc.closingLine}</p>}
                </div>
              </div>
              {status === "SENT" && detail.sentAt && (
                <div className="flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-[11.5px] text-violet-500"><CheckCircle2 className="h-4 w-4 shrink-0" /> Sent to <strong>{detail.recipientEmail}</strong> on {new Date(detail.sentAt).toLocaleDateString()}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Client-facing proposal preview — exec summary, deliverables, benefits, proof, pricing, timeline, next steps. */
function ProposalPreview({ proposal, businessName }: { proposal: ProposalContent; businessName: string }) {
  const p = proposal;
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="bg-gradient-to-r from-violet-500 to-brand-500 px-4 py-4 text-white">
        {p.preparedBy && <p className="text-[9.5px] font-bold uppercase tracking-widest text-white/75">{p.preparedBy}</p>}
        <p className="mt-1 text-[18px] font-black leading-tight">{p.title || `Proposal for ${businessName}`}</p>
        {p.subtitle && <p className="mt-1 text-[12px] text-white/85">{p.subtitle}</p>}
        <p className="mt-1 text-[11px] text-white/85">Prepared for <strong>{p.preparedFor || businessName}</strong></p>
      </div>
      <div className="space-y-3.5 p-3.5">
        {p.executiveSummary && <div><p className="mb-1 text-[9.5px] font-bold uppercase tracking-wide text-violet-500">Executive summary</p><p className="text-[12px] leading-relaxed">{p.executiveSummary}</p></div>}
        {p.clientNeed && <div className="rounded-lg border border-border bg-muted/30 p-3"><p className="mb-1 text-[9.5px] font-bold uppercase tracking-wide text-violet-500">The need</p><p className="text-[12px] leading-relaxed">{p.clientNeed}</p></div>}
        {p.benefits && p.benefits.length > 0 && (
          <div><p className="mb-2 text-[9.5px] font-bold uppercase tracking-wide text-violet-500">Benefits</p><div className="space-y-1.5">{p.benefits.map((b, i) => <div key={i} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /> <span className="text-[12px]">{b}</span></div>)}</div></div>
        )}
        {p.deliverables && p.deliverables.length > 0 && (
          <div>
            <p className="mb-2 text-[9.5px] font-bold uppercase tracking-wide text-violet-500">Deliverables</p>
            <div className="space-y-1.5">{p.deliverables.map((d, i) => <div key={i} className="rounded-lg border border-violet-500/15 bg-violet-500/5 p-2.5"><p className="text-[12px] font-semibold">{d.title}</p>{d.description && <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{d.description}</p>}</div>)}</div>
          </div>
        )}
        {p.proofPoints && p.proofPoints.length > 0 && (
          <div>
            <p className="mb-2 text-[9.5px] font-bold uppercase tracking-wide text-violet-500">Proof points</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{p.proofPoints.map((pp, i) => <div key={i} className="rounded-lg border border-border bg-muted/30 p-2.5 text-center"><div className="text-[16px] font-black text-violet-500">{pp.metric}</div><div className="text-[10.5px] text-muted-foreground">{pp.label}</div></div>)}</div>
          </div>
        )}
        {p.timeline && p.timeline.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-wide text-violet-500"><Clock className="h-3.5 w-3.5" /> Timeline</p>
            <div className="space-y-1.5">{p.timeline.map((t, i) => <div key={i} className="flex gap-2.5"><span className="mt-0.5 shrink-0 rounded-md bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold text-violet-500">{t.label || `Phase ${i + 1}`}</span><div className="min-w-0"><p className="text-[12px] font-semibold">{t.title}</p>{t.description && <p className="text-[11px] text-muted-foreground">{t.description}</p>}</div></div>)}</div>
          </div>
        )}
        {p.pricing && (p.pricing.amount !== undefined || p.pricing.name) && (
          <div className="rounded-lg bg-gradient-to-r from-violet-500 to-brand-500 p-3.5 text-center text-white">
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/80">{p.pricing.name || "Investment"}</p>
            {p.pricing.amount !== undefined && (
              <p className="mt-0.5 text-[20px] font-black">
                {p.pricing.originalAmount !== undefined && p.pricing.originalAmount > (p.pricing.amount || 0) && <span className="me-1.5 text-[13px] font-semibold text-white/60 line-through">${fmtPrice(p.pricing.originalAmount)}</span>}
                ${fmtPrice(p.pricing.amount)}{p.pricing.interval ? <span className="text-[12px] font-semibold text-white/85">/{p.pricing.interval}</span> : null}
              </p>
            )}
            {p.pricing.note && <p className="mt-0.5 text-[10.5px] text-white/85">{p.pricing.note}</p>}
          </div>
        )}
        {p.nextSteps && p.nextSteps.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-wide text-violet-500"><ListTodo className="h-3.5 w-3.5" /> Next steps</p>
            <div className="space-y-1.5">{p.nextSteps.map((s, i) => <div key={i} className="flex items-start gap-2"><span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-violet-500 text-[9px] font-bold text-white">{i + 1}</span><span className="text-[12px]">{s}</span></div>)}</div>
          </div>
        )}
        {p.terms && p.terms.length > 0 && (
          <div className="border-t border-border pt-2.5"><p className="mb-1.5 text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">Terms</p><ul className="list-disc space-y-0.5 ps-4 text-[11px] text-muted-foreground">{p.terms.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
        )}
      </div>
    </div>
  );
}
