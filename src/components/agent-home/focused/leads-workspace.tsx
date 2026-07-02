"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from "react";
import {
  Search, Users, Building2, BarChart3, Folder, FolderPlus, Sparkles, Upload, X,
  CheckCircle2, Workflow, ArrowRight, ChevronLeft, ChevronRight,
} from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";
import { RoiDashboard } from "./roi-dashboard";
import { LeadsAutomation } from "./leads-automation";

/**
 * Lead Studio — the approved find → automate → close surface (see
 * design/lead-studio-mockup.html). It renders as the workspace canvas inside the
 * focused shell (the agent chat owns the LEFT), so its own section menu is a
 * collapsible RIGHT rail. Screens: Find (agent web-search → save as list) ·
 * Contacts · Companies · Pipeline (the multi-channel automation flow) · ROI ·
 * Library (folders + CSV upload). [[lead-studio-redesign-approved]]
 */

type Screen = "find" | "contacts" | "companies" | "pipeline" | "roi" | "library";
interface LeadList { id: string; name: string; category?: string | null; leadCount?: number; updatedAt?: string }
interface SavedLead {
  id: string; name: string; title?: string | null; category?: string | null;
  email?: string | null; phone?: string | null; phones?: string | null;
  website?: string | null; address?: string | null; socials?: string | null;
  rating?: number | null; reviewCount?: number | null; googleMapsUrl?: string | null;
  businessStatus?: string | null; enrichedAt?: string | null; status?: string; listName?: string;
}
const PAGE_SIZES = [25, 50, 100];

const SENIORITY = ["Owner", "C-level", "VP", "Director", "Manager"];
const SIZES = ["Any", "1–10", "11–50", "51–200", "200+"];
const REVS = ["Any", "<$1M", "$1M–$10M", "$10M+"];
const COUNTS = ["25", "50", "100"];
const INDUSTRY_CHIPS = ["Dental", "Med spa", "Law", "SaaS", "Real estate"];
const FLD = "w-full rounded-[9px] border border-input bg-background px-3 py-2 text-[12.5px] outline-none focus:border-brand-500/60";
const SEL = "rounded-[9px] border border-input bg-background px-2.5 py-2 text-[12px] outline-none focus:border-brand-500/60";

export function FocusedLeads({ onAsk, refreshKey, menuOpen: menuOpenProp, agentBusy }: { refreshKey?: number; onAsk: (p: string) => void; menuOpen?: boolean; agentBusy?: boolean }) {
  const { toast } = useToast();
  const [screen, setScreen] = useState<Screen>("find");
  // The menu is controlled from the surface header toggle when `menuOpen` is
  // passed; otherwise it falls back to local state (standalone use).
  const [menuOpenLocal] = useState(true);
  const menuOpen = menuOpenProp ?? menuOpenLocal;
  const [lists, setLists] = useState<LeadList[]>([]);
  const [allLeads, setAllLeads] = useState<SavedLead[]>([]);
  const [loadedLeads, setLoadedLeads] = useState(false);
  const [activeList, setActiveList] = useState<LeadList | null>(null);

  // ── Find (agent web-search) ──
  const [briefOpen, setBriefOpen] = useState(false);
  const [findState, setFindState] = useState<"empty" | "loading" | "results">("empty");
  const [results, setResults] = useState<SavedLead[]>([]);
  const [resultList, setResultList] = useState<LeadList | null>(null);
  const [brief, setBrief] = useState({ industry: "", location: "", title: "", seniority: ["Owner", "C-level"] as string[], size: "Any", revenue: "Any", tech: "", keywords: "", count: "50" });
  const findingRef = useRef(false);
  const baselineRef = useRef(0);

  // ── Enrich (agent operates the row, not the chat) ──
  // Leads currently being enriched → drives the per-row / bulk loaders. The agent
  // writes the result INTO the lead via enrich_lead; we reconcile on refreshKey.
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
  const enrichingRef = useRef<Set<string>>(new Set());
  enrichingRef.current = enrichingIds;
  // The lead whose full-detail bottom sheet is open.
  const [detailLead, setDetailLead] = useState<SavedLead | null>(null);

  const enrichLead = useCallback((l: SavedLead) => {
    if (l.enrichedAt) return;
    setEnrichingIds((prev) => new Set(prev).add(l.id));
    onAsk(
      `Enrich the saved lead "${l.name}" (leadId: ${l.id})${l.category ? ` at ${l.category}` : ""}. Call propose_plan (2 × AI_WEB_SEARCH — the web search + the enrich save) so I can approve, then web-search for the full reachable contact — WORK EMAIL, PHONE, business WEBSITE and ADDRESS/location, plus LinkedIn (LinkedIn alone isn't enough) — and call enrich_lead with the confirmed planId, leadId="${l.id}", and every field you found (email, phone, website, address, title, linkedin) to save it INTO their row. Do NOT print the contact details in the chat.`,
    );
  }, [onAsk]);

  const enrichAll = useCallback((leadsToEnrich: SavedLead[], label: string) => {
    const targets = leadsToEnrich.filter((l) => !l.enrichedAt).slice(0, 100); // cap one batch
    if (!targets.length) return;
    setEnrichingIds((prev) => { const n = new Set(prev); targets.forEach((l) => n.add(l.id)); return n; });
    const idList = targets.map((l) => `${l.name} → ${l.id}`).join("; ");
    onAsk(
      `Enrich all ${targets.length} un-enriched leads ${label}. FIRST call propose_plan (two AI_WEB_SEARCH per lead — the web search to find them + the enrich save) so I can approve the total cost. Then for EACH lead, web-search for the full reachable contact — WORK EMAIL, PHONE, business WEBSITE and ADDRESS/location (from Google Business or their site), plus LinkedIn (a LinkedIn alone isn't enough) — and call enrich_lead with the SAME confirmed planId, that lead's exact leadId, and EVERY field you found (email, phone, website, address, title, linkedin) so it saves INTO their row. If you reach the per-turn web-search limit, enrich everyone you found so far, then tell me you'll continue the rest next — do NOT loop retrying the same call. Do NOT paste any contact details in the chat — every result must land in its row. The leads (name → leadId) are: ${idList}.`,
    );
  }, [onAsk]);

  // ── Library upload ──
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pasteRows, setPasteRows] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [importing, setImporting] = useState(false);

  const loadLists = useCallback(async () => {
    try { const j = await fetch("/api/leads/lists").then((r) => r.json()); if (j?.success) setLists(j.data.lists || []); } catch { /* ignore */ }
  }, []);
  useEffect(() => { loadLists(); }, [loadLists]);

  const loadAllLeads = useCallback(async () => {
    const j = await fetch("/api/leads/lists").then((r) => r.json()).catch(() => null);
    const ls: LeadList[] = j?.data?.lists || [];
    const chunks = await Promise.all(ls.map((l) => fetch(`/api/leads/lists/${l.id}`).then((r) => r.json()).catch(() => null)));
    const leads: SavedLead[] = [];
    ls.forEach((l, i) => (chunks[i]?.data?.leads || []).forEach((x: SavedLead) => leads.push({ ...x, listName: l.name })));
    setAllLeads(leads); setLoadedLeads(true);
  }, []);
  useEffect(() => { if ((screen === "contacts" || screen === "companies") && !loadedLeads) loadAllLeads(); }, [screen, loadedLeads, loadAllLeads]);

  // When the agent finishes a turn (refreshKey bumps): refresh lists, and if we were
  // mid-search and a NEW list appeared, show its leads as the found results.
  useEffect(() => {
    (async () => {
      const j = await fetch("/api/leads/lists").then((r) => r.json()).catch(() => null);
      const ls: LeadList[] = j?.data?.lists || [];
      setLists(ls);
      setLoadedLeads(false);
      if (findingRef.current && ls.length > baselineRef.current) {
        const newest = ls[0];
        const d = await fetch(`/api/leads/lists/${newest.id}`).then((r) => r.json()).catch(() => null);
        setResultList(d?.data?.list || newest);
        setResults(d?.data?.leads || []);
        setActiveList(d?.data?.list || newest);
        setFindState("results");
        findingRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // Reconcile enrichment when the agent FINISHES (busy→idle) — not on refreshKey,
  // because a turn that only chats (the failure we're fixing: no enrich_lead call)
  // never bumps refreshKey and would leave a loader stuck forever. On finish we pull
  // the fresh rows so the enriched email shows in the table, notify, and clear the
  // per-row loaders (a row that didn't enrich reverts to its Enrich button).
  const wasBusyRef = useRef(false);
  useEffect(() => {
    const justFinished = wasBusyRef.current && !agentBusy;
    wasBusyRef.current = !!agentBusy;
    if (!justFinished || enrichingRef.current.size === 0) return;
    (async () => {
      const j = await fetch("/api/leads/lists").then((r) => r.json()).catch(() => null);
      const allLists: LeadList[] = j?.data?.lists || [];
      const chunks = await Promise.all(allLists.map((l) => fetch(`/api/leads/lists/${l.id}`).then((r) => r.json()).catch(() => null)));
      const fresh: SavedLead[] = [];
      allLists.forEach((l, i) => (chunks[i]?.data?.leads || []).forEach((x: SavedLead) => fresh.push({ ...x, listName: l.name })));
      setAllLeads(fresh); setLoadedLeads(true);
      if (resultList) {
        const rl = chunks.find((c) => c?.data?.list?.id === resultList.id);
        if (rl?.data?.leads) setResults(rl.data.leads);
      }
      const done = fresh.filter((l) => enrichingRef.current.has(l.id) && l.enrichedAt);
      if (done.length) {
        toast(done.length === 1
          ? { title: "Lead enriched", description: `${done[0].name}${done[0].email ? ` — ${done[0].email}` : ""} saved to their row.` }
          : { title: `${done.length} leads enriched`, description: "Contact details saved into their rows." });
      }
      setEnrichingIds(new Set());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentBusy]);

  const totalLeads = useMemo(() => lists.reduce((n, l) => n + (l.leadCount ?? 0), 0), [lists]);
  const companies = useMemo(() => {
    const m = new Map<string, { name: string; count: number }>();
    allLeads.forEach((l) => { const k = l.category || "—"; const e = m.get(k) || { name: k, count: 0 }; e.count++; m.set(k, e); });
    return [...m.values()].sort((a, b) => b.count - a.count);
  }, [allLeads]);

  const runFind = () => {
    const b = brief;
    const parts = [`${b.count} leads`];
    if (b.industry) parts.push(b.industry);
    if (b.seniority.length) parts.push(b.seniority.join("/"));
    if (b.title) parts.push(`titled ${b.title}`);
    if (b.location) parts.push(`in ${b.location}`);
    if (b.size !== "Any") parts.push(`${b.size} employees`);
    if (b.revenue !== "Any") parts.push(`${b.revenue} revenue`);
    if (b.tech) parts.push(`using ${b.tech}`);
    if (b.keywords) parts.push(`(${b.keywords})`);
    findingRef.current = true; baselineRef.current = lists.length;
    setBriefOpen(false); setScreen("find"); setFindState("loading");
    const target = Number(b.count) || 50;
    onAsk(
      `Find ${parts.join(", ")}. Target ${target} real leads and keep going until you reach it. ` +
      `Call propose_plan first (a local search via find_local_leads = AI_WEB_SEARCH; web searches are billed too) so I can approve the cost, then reuse that confirmed planId for find_local_leads / find_leads. ` +
      `For LOCAL / brick-and-mortar targets (a business type + a city), start with find_local_leads (Google Places — verified phone + website + rating, up to 60 per search) and, if ${target} is more than it returns, top up the SAME list with web_search + find_leads. ` +
      `For specific people or national/online companies, use web_search + find_leads. ` +
      `Save everything into one new lead list.`,
    );
  };
  const toggleSeniority = (s: string) => setBrief((b) => ({ ...b, seniority: b.seniority.includes(s) ? b.seniority.filter((x) => x !== s) : [...b.seniority, s] }));

  const buildAutomation = (l: LeadList) => { setActiveList(l); setScreen("pipeline"); };

  const importPaste = async () => {
    const rows = pasteRows.split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
    if (!rows.length) return;
    setImporting(true);
    const leads = rows.slice(0, 500).map((line) => {
      const [name, company, email, phone] = line.split(/[\t,;]/).map((s) => s?.trim());
      return { name: name || email || "Lead", category: company || undefined, email: email || undefined, phone: phone || undefined };
    });
    try {
      const j = await fetch("/api/leads/saved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listName: newFolderName.trim() || "Imported list", leads }) }).then((r) => r.json());
      if (j?.success) { setUploadOpen(false); setPasteRows(""); setNewFolderName(""); await loadLists(); setScreen("library"); }
    } catch { /* ignore */ } finally { setImporting(false); }
  };

  const NAV: { id: Screen; label: string; icon: ElementType; count?: number }[] = [
    { id: "find", label: "Find leads", icon: Search },
    { id: "contacts", label: "Contacts", icon: Users, count: totalLeads },
    { id: "companies", label: "Companies", icon: Building2, count: companies.length || undefined },
    { id: "pipeline", label: "Pipeline", icon: Workflow, count: undefined },
    { id: "roi", label: "ROI", icon: BarChart3 },
  ];

  return (
    <div className="relative flex min-h-0 flex-1">
      {/* CONTENT */}
      <div className="min-w-0 flex-1 overflow-y-auto px-4 pb-6 pt-3.5 sm:px-5">
        {screen === "find" ? (
          <FindScreen state={findState} results={results} resultList={resultList}
            onOpenBrief={() => setBriefOpen(true)} onBuild={() => { if (resultList) buildAutomation(resultList); }}
            enrichingIds={enrichingIds} onEnrich={enrichLead} onEnrichAll={() => { if (resultList) enrichAll(results, `in the "${resultList.name}" list`); }} onOpenLead={setDetailLead} />
        ) : screen === "contacts" ? (
          <ContactsScreen leads={allLeads} loaded={loadedLeads} enrichingIds={enrichingIds} onEnrich={enrichLead} onEnrichAll={(ls, label) => enrichAll(ls, label)} onOpenLead={setDetailLead} />
        ) : screen === "companies" ? (
          <CompaniesScreen companies={companies} loaded={loadedLeads} />
        ) : screen === "library" ? (
          <LibraryScreen lists={lists} onBuild={buildAutomation} onOpen={(l) => { setActiveList(l); setScreen("contacts"); }}
            uploadOpen={uploadOpen} setUploadOpen={setUploadOpen} pasteRows={pasteRows} setPasteRows={setPasteRows}
            newFolderName={newFolderName} setNewFolderName={setNewFolderName} importing={importing} onImport={importPaste} />
        ) : screen === "pipeline" ? (
          <LeadsAutomation listId={activeList?.id} listName={activeList?.name} leadCount={activeList?.leadCount} onAsk={onAsk} refreshKey={refreshKey} lists={lists} onSelectList={(l) => setActiveList(l)} agentBusy={agentBusy} />
        ) : (
          <RoiDashboard refreshKey={refreshKey} />
        )}
      </div>

      {/* RIGHT MENU (collapsible from the surface-header toggle) */}
      {menuOpen && (
        <aside className="hidden w-[236px] shrink-0 flex-col gap-2.5 overflow-y-auto border-s border-border bg-card/40 p-3 lg:flex">
          <button onClick={() => { setScreen("find"); setBriefOpen(true); }} className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Sparkles className="h-4 w-4" /> Find leads</button>
          <p className="px-2 pt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground/70">Workspace</p>
          <nav className="flex flex-col gap-0.5">
            {NAV.map((n) => (
              <NavItem key={n.id} active={screen === n.id} icon={n.icon} label={n.label} count={n.count} onClick={() => setScreen(n.id)} />
            ))}
          </nav>
          <p className="px-2 pt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground/70">Saved</p>
          <nav className="flex flex-col gap-0.5">
            <NavItem active={screen === "library"} icon={Folder} label="Library" count={lists.length || undefined} onClick={() => setScreen("library")} />
            <NavItem active={false} icon={Users} label="All contacts" onClick={() => setScreen("contacts")} />
          </nav>
        </aside>
      )}

      {/* SEARCH BRIEF — bottom sheet across the content */}
      {briefOpen && (
        <div className="absolute inset-0 z-40">
          <button aria-label="Close" onClick={() => setBriefOpen(false)} className="absolute inset-0 bg-black/45" />
          <div className="absolute inset-x-3 bottom-3 flex max-h-[82%] flex-col rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-5 sm:bottom-4">
            <div className="relative border-b border-border px-5 pb-3 pt-4">
              <span className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-border" />
              <h4 className="flex items-center gap-2 text-[15px] font-bold"><Sparkles className="h-4 w-4 text-brand-500" /> Search brief</h4>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">Tell the agent who to find — it searches the web (directories, Google Business, LinkedIn) and brings back real matches you can save.</p>
              <button onClick={() => setBriefOpen(false)} className="absolute end-4 top-4 grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Industry">
                  <input value={brief.industry} onChange={(e) => setBrief((b) => ({ ...b, industry: e.target.value }))} placeholder="e.g. Dental, SaaS, Real estate" className={FLD} />
                  <div className="mt-1.5 flex flex-wrap gap-1.5">{INDUSTRY_CHIPS.map((c) => <Chip key={c} on={brief.industry === c} onClick={() => setBrief((b) => ({ ...b, industry: c }))}>{c}</Chip>)}</div>
                </Field>
                <Field label="Location"><input value={brief.location} onChange={(e) => setBrief((b) => ({ ...b, location: e.target.value }))} placeholder="City, state or region" className={FLD} /></Field>
                <Field label="Job title"><input value={brief.title} onChange={(e) => setBrief((b) => ({ ...b, title: e.target.value }))} placeholder="Owner, CMO, Practice Manager" className={FLD} /></Field>
                <Field label="Seniority"><div className="flex flex-wrap gap-1.5">{SENIORITY.map((s) => <Chip key={s} on={brief.seniority.includes(s)} onClick={() => toggleSeniority(s)}>{s}</Chip>)}</div></Field>
                <Field label="Employee size"><select value={brief.size} onChange={(e) => setBrief((b) => ({ ...b, size: e.target.value }))} className={FLD}>{SIZES.map((s) => <option key={s}>{s}</option>)}</select></Field>
                <Field label="Revenue"><select value={brief.revenue} onChange={(e) => setBrief((b) => ({ ...b, revenue: e.target.value }))} className={FLD}>{REVS.map((s) => <option key={s}>{s}</option>)}</select></Field>
                <Field label="Technologies"><input value={brief.tech} onChange={(e) => setBrief((b) => ({ ...b, tech: e.target.value }))} placeholder="Shopify, HubSpot…" className={FLD} /></Field>
                <Field label="Keywords"><input value={brief.keywords} onChange={(e) => setBrief((b) => ({ ...b, keywords: e.target.value }))} placeholder="“new location”, “hiring”…" className={FLD} /></Field>
                <Field label="How many"><select value={brief.count} onChange={(e) => setBrief((b) => ({ ...b, count: e.target.value }))} className={FLD}>{COUNTS.map((s) => <option key={s} value={s}>{s} leads</option>)}</select></Field>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-border px-5 py-3.5">
              <button onClick={runFind} className="inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Sparkles className="h-4 w-4" /> Find leads</button>
              <span className="text-[11.5px] text-muted-foreground">The agent searches the web and streams matches onto the page.</span>
            </div>
          </div>
        </div>
      )}

      {/* LEAD DETAIL — bottom sheet with the full contact record */}
      {detailLead && (() => {
        const fresh = results.find((x) => x.id === detailLead.id) || allLeads.find((x) => x.id === detailLead.id) || detailLead;
        return <LeadDetailSheet lead={fresh} enriching={enrichingIds.has(fresh.id)} onEnrich={() => enrichLead(fresh)} onClose={() => setDetailLead(null)} />;
      })()}
    </div>
  );
}

/* ── Lead detail — full contact record in a bottom sheet ── */
function LeadDetailSheet({ lead, enriching, onEnrich, onClose }: { lead: SavedLead; enriching: boolean; onEnrich: () => void; onClose: () => void }) {
  const socials = parseSocials(lead.socials);
  const phones = (() => { try { const p = JSON.parse(lead.phones || "[]"); return Array.isArray(p) ? (p as string[]) : []; } catch { return []; } })();
  const rows: { label: string; value: ReactNode }[] = [];
  if (lead.title) rows.push({ label: "Title", value: lead.title });
  if (lead.category) rows.push({ label: "Company", value: lead.category });
  if (lead.email) rows.push({ label: "Email", value: <a href={`mailto:${lead.email}`} className="text-brand-500 hover:underline">{lead.email}</a> });
  if (lead.phone) rows.push({ label: "Phone", value: <a href={`tel:${lead.phone}`} className="text-brand-500 hover:underline">{lead.phone}</a> });
  phones.filter((p) => p !== lead.phone).forEach((p) => rows.push({ label: "Phone", value: <a href={`tel:${p}`} className="text-brand-500 hover:underline">{p}</a> }));
  if (lead.website) rows.push({ label: "Website", value: <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" className="text-brand-500 hover:underline">{hostOf(lead.website)}</a> });
  if (lead.address) rows.push({ label: "Address", value: lead.address });
  if (typeof lead.rating === "number") rows.push({ label: "Rating", value: `★ ${lead.rating}${lead.reviewCount ? ` · ${lead.reviewCount} reviews` : ""}` });
  Object.entries(socials).forEach(([k, v]) => rows.push({ label: k[0].toUpperCase() + k.slice(1), value: <a href={v} target="_blank" rel="noreferrer" className="text-brand-500 hover:underline">{hostOf(v) || v}</a> }));
  if (lead.googleMapsUrl) rows.push({ label: "Map", value: <a href={lead.googleMapsUrl} target="_blank" rel="noreferrer" className="text-brand-500 hover:underline">Google Maps ↗</a> });

  return (
    <div className="absolute inset-0 z-40">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-x-3 bottom-3 flex max-h-[82%] flex-col rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-5 sm:bottom-4">
        <div className="relative border-b border-border px-5 pb-3 pt-4">
          <span className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-border" />
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Users className="h-5 w-5" /></span>
            <div className="min-w-0">
              <h4 className="truncate text-[15px] font-bold">{lead.name}</h4>
              <p className="truncate text-[11.5px] text-muted-foreground">{[lead.title, lead.category].filter(Boolean).join(" · ") || "Lead"}{lead.listName ? ` · ${lead.listName}` : ""}</p>
            </div>
            {lead.enrichedAt ? <span className="ms-auto rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-500">Enriched</span> : <span className="ms-auto rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-500">Not enriched</span>}
          </div>
          <button onClick={onClose} className="absolute end-4 top-4 grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-muted-foreground">No contact details yet — enrich this lead to find their email, phone, website and address.</p>
          ) : (
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {rows.map((r, idx) => (
                <div key={idx}>
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70">{r.label}</dt>
                  <dd className="mt-0.5 break-words text-[13px]">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-border px-5 py-3.5">
          {lead.enrichedAt ? (
            <button onClick={onEnrich} disabled={enriching} className="inline-flex items-center gap-2 rounded-[10px] border border-border px-4 py-2 text-[13px] font-semibold hover:border-brand-500/60 disabled:opacity-60">{enriching ? <FlowLoader size={14} /> : <Sparkles className="h-4 w-4" />} Re-enrich</button>
          ) : (
            <button onClick={onEnrich} disabled={enriching} className="inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30 disabled:opacity-60">{enriching ? <FlowLoader size={14} tone="white" /> : <Sparkles className="h-4 w-4" />} {enriching ? "Enriching…" : "Enrich this lead"}</button>
          )}
          <span className="text-[11.5px] text-muted-foreground">Find email, phone, website + address and save them here.</span>
        </div>
      </div>
    </div>
  );
}

function NavItem({ active, icon: Icon, label, count, onClick }: { active: boolean; icon: ElementType; label: string; count?: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold transition-colors", active ? "bg-brand-500/12 text-brand-500" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}>
      <Icon className="h-[17px] w-[17px] shrink-0" />
      <span className="flex-1 text-start">{label}</span>
      {typeof count === "number" && count > 0 && <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums", active ? "bg-brand-500/15 text-brand-500" : "bg-muted text-muted-foreground")}>{count}</span>}
    </button>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><label className="mb-1.5 block text-[11px] font-bold text-muted-foreground">{label}</label>{children}</div>;
}
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", on ? "border-brand-500/40 bg-brand-500/12 text-brand-500" : "border-border text-muted-foreground hover:text-foreground")}>{children}</button>;
}

/* ── Find ── */
function FindScreen({ state, results, resultList, onOpenBrief, onBuild, enrichingIds, onEnrich, onEnrichAll, onOpenLead }: {
  state: "empty" | "loading" | "results";
  results: SavedLead[]; resultList: LeadList | null; onOpenBrief: () => void; onBuild: () => void;
  enrichingIds: Set<string>; onEnrich: (l: SavedLead) => void; onEnrichAll: () => void; onOpenLead: (l: SavedLead) => void;
}) {
  const unenriched = results.filter((l) => !l.enrichedAt).length;
  const enrichBusy = results.some((l) => enrichingIds.has(l.id));
  if (state === "loading") {
    return (
      <div className="grid place-items-center py-24 text-center">
        <div><div className="mx-auto w-fit"><FlowLoader size={44} withMark /></div>
          <h3 className="mt-4 text-[15px] font-bold">The agent is searching the web…</h3>
          <p className="mt-1 text-[12.5px] text-muted-foreground">Reading directories, Google Business + LinkedIn — real matches will fill the page.</p>
        </div>
      </div>
    );
  }
  if (state === "results") {
    return (
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button onClick={onOpenBrief} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><Search className="h-3.5 w-3.5" /> New search</button>
          <span className="text-[12px] text-muted-foreground">{results.length} leads found by the agent</span>
        </div>
        {resultList && (
          <div className="mb-3 flex flex-wrap items-center gap-2.5 rounded-2xl border border-emerald-500/40 bg-emerald-500/[0.07] px-4 py-2.5 text-[12.5px] text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Saved <b>{results.length} leads</b> to “{resultList.name}” in your Library.
            <div className="ms-auto flex items-center gap-2">
              {unenriched > 0 && (
                <button onClick={onEnrichAll} disabled={enrichBusy} title="Find email + phone for every lead so you can reach them" className="inline-flex items-center gap-1.5 rounded-[9px] border border-emerald-500/50 px-3 py-1.5 text-[11.5px] font-semibold text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-60">
                  {enrichBusy ? <FlowLoader size={13} /> : <Sparkles className="h-3.5 w-3.5" />} {enrichBusy ? "Enriching…" : `Enrich all (${unenriched})`}
                </button>
              )}
              <button onClick={onBuild} className="inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[11.5px] font-semibold text-white">Build automation <ArrowRight className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        )}
        <LeadTable leads={results} enrichingIds={enrichingIds} onEnrich={onEnrich} onOpenLead={onOpenLead} />
      </div>
    );
  }
  return (
    <div className="grid place-items-center py-20 text-center">
      <div className="max-w-lg">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Search className="h-7 w-7" /></span>
        <h3 className="mt-4 text-[15px] font-bold">Brief the agent to find your next leads</h3>
        <p className="mt-1.5 text-[12.5px] text-muted-foreground">Open the search brief, describe your ideal customer, and the agent searches the web — real people + companies stream back and fill the page. Save them as a list, then build a pipeline.</p>
        <button onClick={onOpenBrief} className="mt-4 inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Sparkles className="h-4 w-4" /> Open search brief</button>
      </div>
    </div>
  );
}

function LeadTable({ leads, enrichingIds, onEnrich, onOpenLead }: { leads: SavedLead[]; enrichingIds: Set<string>; onEnrich: (l: SavedLead) => void; onOpenLead: (l: SavedLead) => void }) {
  if (!leads.length) return <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-muted-foreground">No leads yet.</p>;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <table className="w-full text-[12.5px]">
        <thead className="text-left text-[11px] text-muted-foreground"><tr>{["Name", "Title", "Company", "Contact", ""].map((h, i) => <th key={i} className="border-b border-border px-4 py-2.5 font-medium">{h}</th>)}</tr></thead>
        <tbody>
          {leads.map((l) => {
            const enriching = enrichingIds.has(l.id);
            return (
              <tr key={l.id} onClick={() => onOpenLead(l)} className="cursor-pointer border-t border-border hover:bg-muted/20">
                <td className="px-4 py-2.5 font-semibold">{l.name}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{l.title || "—"}</td>
                <td className="px-4 py-2.5">{l.category || "—"}</td>
                <td className="px-4 py-2.5"><ContactCell l={l} enriching={enriching} /></td>
                <td className="px-4 py-2.5 text-end">
                  {l.enrichedAt ? (
                    <span className="text-[11.5px] text-emerald-500">Enriched</span>
                  ) : enriching ? (
                    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-500"><FlowLoader size={13} /> Enriching…</span>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); onEnrich(l); }} className="rounded-lg border border-border px-3 py-1 text-[11.5px] font-semibold text-brand-500 hover:border-brand-500/60">Enrich</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function parseSocials(s?: string | null): Record<string, string> {
  if (!s) return {};
  try { const o = JSON.parse(s) as Record<string, unknown>; return Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === "string")) as Record<string, string>; } catch { return {}; }
}
function hostOf(url?: string | null): string { if (!url) return ""; try { return new URL(url.startsWith("http") ? url : `https://${url}`).host.replace(/^www\./, ""); } catch { return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]; } }

/** The "Contact" cell — reveals whatever the lead actually has (email, phone,
 * website, or a LinkedIn); blurred only when there's nothing yet. Click the row
 * for the full detail sheet. */
function ContactCell({ l, enriching }: { l: SavedLead; enriching: boolean }) {
  if (enriching) return <span className="inline-flex items-center gap-1.5 text-muted-foreground"><FlowLoader size={12} /> finding…</span>;
  const linkedin = parseSocials(l.socials).linkedin;
  const hasAny = l.email || l.phone || l.website || linkedin;
  if (!hasAny) return l.enrichedAt
    ? <span className="text-[11.5px] text-muted-foreground">Enriched · no email/phone found</span>
    : <span className="select-none text-muted-foreground blur-[3px]">•••@•••.com</span>;
  return (
    <div className="flex flex-col gap-0.5">
      {l.email && <span className="inline-flex items-center gap-1">{l.email} {l.enrichedAt && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}</span>}
      {l.phone && <span className="text-muted-foreground">{l.phone}</span>}
      {!l.email && !l.phone && l.website && <span className="truncate text-brand-500">{hostOf(l.website)}</span>}
      {!l.email && !l.phone && !l.website && linkedin && <span className="inline-flex items-center gap-1 text-brand-500">LinkedIn ↗</span>}
    </div>
  );
}

/* ── Contacts ── */
function ContactsScreen({ leads, loaded, enrichingIds, onEnrich, onEnrichAll, onOpenLead }: { leads: SavedLead[]; loaded: boolean; enrichingIds: Set<string>; onEnrich: (l: SavedLead) => void; onEnrichAll: (leads: SavedLead[], label: string) => void; onOpenLead: (l: SavedLead) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "enriched" | "new">("all");
  const [listFilter, setListFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const listOptions = useMemo(() => Array.from(new Set(leads.map((l) => l.listName).filter((n): n is string => !!n))).sort(), [leads]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (status === "enriched" && !l.enrichedAt) return false;
      if (status === "new" && l.enrichedAt) return false;
      if (listFilter !== "all" && l.listName !== listFilter) return false;
      if (!q) return true;
      return [l.name, l.title, l.category, l.email, l.listName].some((s) => (s || "").toLowerCase().includes(q));
    });
  }, [leads, query, status, listFilter]);

  useEffect(() => { setPage(1); }, [query, status, listFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageC = Math.min(page, totalPages);
  const paged = filtered.slice((pageC - 1) * pageSize, pageC * pageSize);
  const start = filtered.length ? (pageC - 1) * pageSize + 1 : 0;
  const end = Math.min(pageC * pageSize, filtered.length);
  const activeFilter = query.trim() !== "" || status !== "all" || listFilter !== "all";
  const unenriched = filtered.filter((l) => !l.enrichedAt).length;
  const enrichBusy = filtered.some((l) => enrichingIds.has(l.id));

  if (!loaded) return <div className="grid place-items-center py-16"><FlowLoader size={22} label="Loading contacts…" /></div>;
  return (
    <>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, company, email…" className="w-full rounded-[9px] border border-input bg-background py-2 pe-3 ps-8 text-[12.5px] outline-none focus:border-brand-500/60" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as "all" | "enriched" | "new")} className={SEL}>
          <option value="all">All statuses</option>
          <option value="enriched">Enriched</option>
          <option value="new">Not enriched</option>
        </select>
        {listOptions.length > 1 && (
          <select value={listFilter} onChange={(e) => setListFilter(e.target.value)} className={SEL}>
            <option value="all">All lists</option>
            {listOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        {unenriched > 0 && (
          <button
            onClick={() => onEnrichAll(filtered, activeFilter ? "matching your current filter" : "across your saved lists")}
            disabled={enrichBusy}
            title="Find email + phone for every un-enriched contact shown"
            className="inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-2 text-[12px] font-semibold text-white shadow-sm shadow-brand-500/25 disabled:opacity-60"
          >
            {enrichBusy ? <FlowLoader size={13} tone="white" /> : <Sparkles className="h-3.5 w-3.5" />} {enrichBusy ? "Enriching…" : `Enrich all (${unenriched})`}
          </button>
        )}
      </div>
      <p className="mb-3 text-[12px] text-muted-foreground">
        {filtered.length === 0 ? "No contacts match your filters." : <>Showing <b className="text-foreground">{start}–{end}</b> of {filtered.length}{activeFilter ? ` (filtered from ${leads.length})` : " contacts"} — enrich to reveal email + phone.</>}
      </p>
      <LeadTable leads={paged} enrichingIds={enrichingIds} onEnrich={onEnrich} onOpenLead={onOpenLead} />
      <Pagination page={pageC} totalPages={totalPages} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />
    </>
  );
}

/* Shared pagination footer for the browse tables. */
function Pagination({ page, totalPages, pageSize, onPage, onPageSize }: { page: number; totalPages: number; pageSize: number; onPage: (p: number) => void; onPageSize: (s: number) => void }) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
      <label className="flex items-center gap-1.5">Rows
        <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} className="rounded-[8px] border border-input bg-background px-2 py-1 text-[12px] outline-none focus:border-brand-500/60">
          {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-2">
        <button onClick={() => onPage(page - 1)} disabled={page <= 1} className="inline-flex items-center gap-1 rounded-[8px] border border-border px-2.5 py-1 font-semibold hover:text-foreground disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" /> Prev</button>
        <span className="tabular-nums">Page {page} of {totalPages}</span>
        <button onClick={() => onPage(page + 1)} disabled={page >= totalPages} className="inline-flex items-center gap-1 rounded-[8px] border border-border px-2.5 py-1 font-semibold hover:text-foreground disabled:opacity-40">Next <ChevronRight className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

/* ── Companies ── */
function CompaniesScreen({ companies, loaded }: { companies: { name: string; count: number }[]; loaded: boolean }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const filtered = useMemo(() => { const q = query.trim().toLowerCase(); return q ? companies.filter((c) => c.name.toLowerCase().includes(q)) : companies; }, [companies, query]);
  useEffect(() => { setPage(1); }, [query, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageC = Math.min(page, totalPages);
  const paged = filtered.slice((pageC - 1) * pageSize, pageC * pageSize);
  const start = filtered.length ? (pageC - 1) * pageSize + 1 : 0;
  const end = Math.min(pageC * pageSize, filtered.length);

  if (!loaded) return <div className="grid place-items-center py-16"><FlowLoader size={22} label="Loading companies…" /></div>;
  return (
    <>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search companies…" className="w-full rounded-[9px] border border-input bg-background py-2 pe-3 ps-8 text-[12.5px] outline-none focus:border-brand-500/60" />
        </div>
        <span className="text-[12px] text-muted-foreground">{filtered.length ? <>Showing <b className="text-foreground">{start}–{end}</b> of {filtered.length}</> : "No companies match."}</span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-[12.5px]">
          <thead className="text-left text-[11px] text-muted-foreground"><tr>{["Company", "Contacts"].map((h) => <th key={h} className="border-b border-border px-4 py-2.5 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {paged.map((c) => (
              <tr key={c.name} className="border-t border-border hover:bg-muted/20"><td className="px-4 py-2.5 font-semibold">{c.name}</td><td className="px-4 py-2.5 text-muted-foreground">{c.count}</td></tr>
            ))}
            {!companies.length && <tr><td colSpan={2} className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">No companies yet — find or upload some leads.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination page={pageC} totalPages={totalPages} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />
    </>
  );
}

/* ── Library ── */
function LibraryScreen({ lists, onBuild, onOpen, uploadOpen, setUploadOpen, pasteRows, setPasteRows, newFolderName, setNewFolderName, importing, onImport }: {
  lists: LeadList[]; onBuild: (l: LeadList) => void; onOpen: (l: LeadList) => void;
  uploadOpen: boolean; setUploadOpen: (v: boolean) => void; pasteRows: string; setPasteRows: (v: string) => void;
  newFolderName: string; setNewFolderName: (v: string) => void; importing: boolean; onImport: () => void;
}) {
  if (uploadOpen) {
    return (
      <div className="max-w-2xl">
        <button onClick={() => setUploadOpen(false)} className="mb-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> Library</button>
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Upload className="h-6 w-6" /></span>
          <p className="mt-3 text-[13.5px] font-semibold">Paste a list to build a folder</p>
          <p className="mt-1 text-[12px] text-muted-foreground">One lead per line: <code>Name, Company, Email, Phone</code> — mapped + imported into a new folder, no agent needed.</p>
        </div>
        <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="New folder name — e.g. “Q3 event list”" className="mt-3 w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] outline-none focus:border-brand-500/60" />
        <textarea value={pasteRows} onChange={(e) => setPasteRows(e.target.value)} rows={6} placeholder={"Dr. Maria Chen, Bright Smile Dental, maria@brightsmile.com, 512-555-0142\n…"} className="mt-2 w-full resize-y rounded-[10px] border border-input bg-background px-3 py-2 text-[12.5px] outline-none focus:border-brand-500/60" />
        <div className="mt-3 flex items-center gap-2">
          <button onClick={onImport} disabled={importing || !pasteRows.trim()} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50">{importing ? <FlowLoader size={14} tone="white" /> : <FolderPlus className="h-4 w-4" />} Import → create folder</button>
          <span className="text-[12px] text-muted-foreground">Then open it and Build automation.</span>
        </div>
      </div>
    );
  }
  return (
    <>
      <p className="mb-3 text-[12px] text-muted-foreground">Your lists are folders of leads — found or uploaded. Open one, then <b>Build automation</b> to run the pitch → follow-up → booking sequence on it.</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {lists.map((l) => (
          <div key={l.id} className="rounded-2xl border border-border bg-card p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Folder className="h-5 w-5" /></span>
            <p className="mt-2.5 truncate text-[13.5px] font-semibold">{l.name}</p>
            <p className="truncate text-[11.5px] text-muted-foreground">{l.category ? `${l.category} · ` : ""}{l.leadCount ?? 0} leads</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => onBuild(l)} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white">Build automation</button>
              <button onClick={() => onOpen(l)} className="rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60">Open</button>
            </div>
          </div>
        ))}
        <button onClick={() => setUploadOpen(true)} className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-4 text-center text-muted-foreground hover:border-brand-500/60 hover:text-foreground">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Upload className="h-5 w-5" /></span>
          <b className="text-[13px] text-foreground">Upload a list</b>
          <span className="text-[11.5px]">CSV or paste — builds a new folder</span>
        </button>
      </div>
    </>
  );
}
