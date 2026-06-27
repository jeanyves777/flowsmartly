"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, MapPin, Star, Phone, Globe, ExternalLink, FileText, Send, Check, Sparkles, Folder, FolderPlus, ChevronLeft, ChevronDown, Trash2, ListChecks, Save, Plus, Mail, Presentation } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Lead finder — its own dedicated surface (split from the legacy pitch-board).
 * Search local businesses (Google Places), build + save named/categorized LEAD
 * LISTS, return to them, and work each lead (status, pitch/proposal, delete).
 * Dedicated SavedLead system: /api/leads/search, /api/leads/lists[/id],
 * /api/leads/saved[/id]. Pitch/Proposal are generative → the agent runs them.
 * No legacy links. [[surface-buttons-are-ui-actions]] [[new-design-no-legacy]]
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
}

const LEAD_STATUS = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"];
const statusCls = (s?: string) => ({ NEW: "bg-muted text-muted-foreground", CONTACTED: "bg-brand-500/10 text-brand-500", QUALIFIED: "bg-violet-500/10 text-violet-500", WON: "bg-emerald-500/10 text-emerald-500", LOST: "bg-rose-500/10 text-rose-500" }[(s || "NEW").toUpperCase()] || "bg-muted text-muted-foreground");

export function FocusedLeads({ onAsk, refreshKey }: { refreshKey?: number; onAsk: (prompt: string) => void }) {
  const [tab, setTab] = useState<"search" | "lists">("search");

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
    setOpenList(l); setListLeads([]); setListLoading(true);
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

  const pitchFor = (name: string, website?: string | null, address?: string | null) => onAsk(`Draft a cold-outreach pitch to ${name}${website ? ` (${website})` : ""}${address ? ` — a local business at ${address}` : ""}. Use my brand's services and a personalized hook.`);
  const proposalFor = (name: string, website?: string | null) => onAsk(`Write a branded service proposal for ${name}${website ? ` (${website})` : ""} offering my services. Use my Brand Kit's offerings.`);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        {/* tabs */}
        <div className="inline-flex rounded-[10px] border border-border p-0.5">
          {([["search", "Find leads", Search], ["lists", `My lists${lists.length ? ` (${lists.length})` : ""}`, Folder]] as const).map(([k, lbl, Icon]) => (
            <button key={k} onClick={() => { setTab(k); if (k === "lists") setOpenList(null); }} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition", tab === k ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:text-foreground")}><Icon className="h-3.5 w-3.5" /> {lbl}</button>
          ))}
        </div>

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
              <button onClick={() => setOpenList(null)} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> Lists</button>
              <div className="min-w-0">
                <h3 className="truncate text-[14px] font-bold">{openList.name}</h3>
                <p className="truncate text-[11.5px] text-muted-foreground">{openList.category ? `${openList.category} · ` : ""}{listLeads.length} lead{listLeads.length === 1 ? "" : "s"}</p>
              </div>
              <button onClick={() => removeList(openList)} className="ms-auto inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:border-rose-500/50 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /> Delete list</button>
            </div>
            {listLoading ? (
              <div className="py-8"><FlowLoader size={22} label="Loading leads…" /></div>
            ) : listLeads.length ? (
              <div className="space-y-2">
                {listLeads.map((lead) => (
                  <LeadRow key={lead.id} lead={lead} busy={busyLead === lead.id} onStatus={(s) => setLeadStatus(lead, s)} onRemove={() => removeLead(lead)} />
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-muted-foreground">No leads in this list yet — add some from the Find leads tab.</p>
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
  );
}

interface LeadPitch { id: string; businessName?: string; documentType?: string; status?: string; recipientEmail?: string | null }
const statusPill = (s?: string) => ({ READY: "bg-emerald-500/10 text-emerald-500", SENT: "bg-violet-500/10 text-violet-500", FAILED: "bg-rose-500/10 text-rose-500", RESEARCHING: "bg-brand-500/10 text-brand-500", PENDING: "bg-muted text-muted-foreground" }[(s || "PENDING").toUpperCase()] || "bg-muted text-muted-foreground");

/** A saved lead in a list, expandable to its pitches/proposals with create/email/delete. */
function LeadRow({ lead, busy, onStatus, onRemove }: { lead: SavedLead; busy: boolean; onStatus: (s: string) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<LeadPitch[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [propOpen, setPropOpen] = useState(false);
  const [svcTitle, setSvcTitle] = useState("");
  const [svcDesc, setSvcDesc] = useState("");
  const [emailFor, setEmailFor] = useState<string | null>(null);
  const [emailTo, setEmailTo] = useState("");

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
          <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{[lead.address, lead.phone].filter(Boolean).join(" · ")}</p>
        </div>
        <select value={(lead.status || "NEW").toUpperCase()} onChange={(e) => onStatus(e.target.value)} disabled={busy} className={cn("shrink-0 rounded-full border-0 px-2.5 py-1 text-[11px] font-semibold outline-none", statusCls(lead.status))}>
          {LEAD_STATUS.map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}
        </select>
        <button onClick={onRemove} disabled={busy} className="mt-1 shrink-0 text-muted-foreground hover:text-rose-500 disabled:opacity-60" title="Delete lead">{busy ? <FlowLoader size={13} /> : <Trash2 className="h-3.5 w-3.5" />}</button>
      </div>

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
                      <button onClick={() => { setEmailFor(emailFor === it.id ? null : it.id); setEmailTo(it.recipientEmail || ""); }} className="shrink-0 text-muted-foreground hover:text-brand-500" title="Email"><Mail className="h-3.5 w-3.5" /></button>
                      <button onClick={() => delItem(it.id)} disabled={working} className="shrink-0 text-muted-foreground hover:text-rose-500 disabled:opacity-60" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                    {emailFor === it.id && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="recipient@email.com" className="w-full rounded-[8px] border border-input bg-background px-2.5 py-1.5 text-[12px] outline-none focus:border-brand-500/60" />
                        <button onClick={() => sendItem(it.id)} disabled={working || !emailTo.trim()} className="inline-flex shrink-0 items-center gap-1 rounded-[8px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60">{working ? <FlowLoader size={13} tone="white" /> : <Send className="h-3.5 w-3.5" />} Send</button>
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
