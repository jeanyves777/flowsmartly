"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from "react";
import {
  Search, Users, Building2, BarChart3, Folder, FolderPlus, Sparkles, Upload, X,
  CheckCircle2, PanelRightClose, PanelRightOpen, Workflow, ArrowRight, ChevronLeft,
} from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";
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
interface SavedLead { id: string; name: string; title?: string | null; category?: string | null; email?: string | null; phone?: string | null; enrichedAt?: string | null; status?: string }

const SENIORITY = ["Owner", "C-level", "VP", "Director", "Manager"];
const SIZES = ["Any", "1–10", "11–50", "51–200", "200+"];
const REVS = ["Any", "<$1M", "$1M–$10M", "$10M+"];
const COUNTS = ["25", "50", "100"];
const INDUSTRY_CHIPS = ["Dental", "Med spa", "Law", "SaaS", "Real estate"];
const FLD = "w-full rounded-[9px] border border-input bg-background px-3 py-2 text-[12.5px] outline-none focus:border-brand-500/60";

export function FocusedLeads({ onAsk, refreshKey }: { refreshKey?: number; onAsk: (p: string) => void }) {
  const [screen, setScreen] = useState<Screen>("find");
  const [menuOpen, setMenuOpen] = useState(true);
  const [lists, setLists] = useState<LeadList[]>([]);
  const [allLeads, setAllLeads] = useState<SavedLead[]>([]);
  const [loadedLeads, setLoadedLeads] = useState(false);
  const [activeList, setActiveList] = useState<LeadList | null>(null);

  // ── Find (agent web-search) ──
  const [briefOpen, setBriefOpen] = useState(false);
  const [findState, setFindState] = useState<"empty" | "loading" | "results">("empty");
  const [findTab, setFindTab] = useState<"contacts" | "companies">("contacts");
  const [results, setResults] = useState<SavedLead[]>([]);
  const [resultList, setResultList] = useState<LeadList | null>(null);
  const [brief, setBrief] = useState({ industry: "", location: "", title: "", seniority: ["Owner", "C-level"] as string[], size: "Any", revenue: "Any", tech: "", keywords: "", count: "50" });
  const findingRef = useRef(false);
  const baselineRef = useRef(0);

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
    chunks.forEach((c) => (c?.data?.leads || []).forEach((x: SavedLead) => leads.push(x)));
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
    onAsk(`Find ${parts.join(", ")}. Search the web for real decision-makers matching this, then save them to a new lead list.`);
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
      <div className="min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
        {screen === "find" ? (
          <FindScreen state={findState} tab={findTab} setTab={setFindTab} results={results} resultList={resultList}
            onOpenBrief={() => setBriefOpen(true)} onBuild={() => resultList && buildAutomation(resultList)} onAsk={onAsk} />
        ) : screen === "contacts" ? (
          <ContactsScreen leads={allLeads} loaded={loadedLeads} onAsk={onAsk} />
        ) : screen === "companies" ? (
          <CompaniesScreen companies={companies} loaded={loadedLeads} />
        ) : screen === "library" ? (
          <LibraryScreen lists={lists} onBuild={buildAutomation} onOpen={(l) => { setActiveList(l); setScreen("contacts"); }}
            uploadOpen={uploadOpen} setUploadOpen={setUploadOpen} pasteRows={pasteRows} setPasteRows={setPasteRows}
            newFolderName={newFolderName} setNewFolderName={setNewFolderName} importing={importing} onImport={importPaste} />
        ) : screen === "pipeline" ? (
          <LeadsAutomation listName={(activeList ?? lists[0])?.name} leadCount={(activeList ?? lists[0])?.leadCount} onAsk={onAsk} />
        ) : (
          <RoiDashboard refreshKey={refreshKey} />
        )}
      </div>

      {/* RIGHT MENU (collapsible — collapse icon lives ON the menu) */}
      {menuOpen ? (
        <aside className="hidden w-[248px] shrink-0 flex-col gap-3 overflow-y-auto border-s border-border bg-card/40 p-3 lg:flex">
          <div className="flex items-center justify-between px-1">
            <span className="text-[12.5px] font-bold">Lead Studio</span>
            <button onClick={() => setMenuOpen(false)} title="Hide menu" className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><PanelRightClose className="h-4 w-4" /></button>
          </div>
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
      ) : (
        <button onClick={() => setMenuOpen(true)} title="Show menu" className="absolute end-2 top-2 z-10 hidden h-8 w-8 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground lg:grid"><PanelRightOpen className="h-4 w-4" /></button>
      )}

      {/* SEARCH BRIEF — bottom sheet across the content */}
      {briefOpen && (
        <div className="absolute inset-0 z-40">
          <button aria-label="Close" onClick={() => setBriefOpen(false)} className="absolute inset-0 bg-black/45" />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[82%] flex-col rounded-t-2xl border-t border-border bg-card shadow-2xl">
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
function FindScreen({ state, tab, setTab, results, resultList, onOpenBrief, onBuild, onAsk }: {
  state: "empty" | "loading" | "results"; tab: "contacts" | "companies"; setTab: (t: "contacts" | "companies") => void;
  results: SavedLead[]; resultList: LeadList | null; onOpenBrief: () => void; onBuild: () => void; onAsk: (p: string) => void;
}) {
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
            <button onClick={onBuild} className="ms-auto inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[11.5px] font-semibold text-white">Build automation <ArrowRight className="h-3.5 w-3.5" /></button>
          </div>
        )}
        <LeadTable leads={results} onAsk={onAsk} />
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

function LeadTable({ leads, onAsk }: { leads: SavedLead[]; onAsk: (p: string) => void }) {
  if (!leads.length) return <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-muted-foreground">No leads yet.</p>;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <table className="w-full text-[12.5px]">
        <thead className="text-left text-[11px] text-muted-foreground"><tr>{["Name", "Title", "Company", "Email", ""].map((h, i) => <th key={i} className="border-b border-border px-4 py-2.5 font-medium">{h}</th>)}</tr></thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} className="border-t border-border hover:bg-muted/20">
              <td className="px-4 py-2.5 font-semibold">{l.name}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{l.title || "—"}</td>
              <td className="px-4 py-2.5">{l.category || "—"}</td>
              <td className="px-4 py-2.5">{l.enrichedAt && l.email ? <span className="inline-flex items-center gap-1">{l.email} <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /></span> : <span className="select-none text-muted-foreground blur-[3px]">•••@•••.com</span>}</td>
              <td className="px-4 py-2.5 text-end">
                {l.enrichedAt ? <span className="text-[11.5px] text-emerald-500">Enriched</span> : <button onClick={() => onAsk(`Enrich the lead "${l.name}"${l.category ? ` at ${l.category}` : ""} — find their work email, phone and LinkedIn, then save it.`)} className="rounded-lg border border-border px-3 py-1 text-[11.5px] font-semibold text-brand-500 hover:border-brand-500/60">Enrich</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Contacts ── */
function ContactsScreen({ leads, loaded, onAsk }: { leads: SavedLead[]; loaded: boolean; onAsk: (p: string) => void }) {
  if (!loaded) return <div className="grid place-items-center py-16"><FlowLoader size={22} label="Loading contacts…" /></div>;
  return (
    <>
      <p className="mb-3 text-[12px] text-muted-foreground">Everyone you've saved across all lists — {leads.length} contacts. Enrich them or add to an automation.</p>
      <LeadTable leads={leads} onAsk={onAsk} />
    </>
  );
}

/* ── Companies ── */
function CompaniesScreen({ companies, loaded }: { companies: { name: string; count: number }[]; loaded: boolean }) {
  if (!loaded) return <div className="grid place-items-center py-16"><FlowLoader size={22} label="Loading companies…" /></div>;
  return (
    <>
      <p className="mb-3 text-[12px] text-muted-foreground">Company records derived from your saved leads.</p>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-[12.5px]">
          <thead className="text-left text-[11px] text-muted-foreground"><tr>{["Company", "Contacts"].map((h) => <th key={h} className="border-b border-border px-4 py-2.5 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.name} className="border-t border-border hover:bg-muted/20"><td className="px-4 py-2.5 font-semibold">{c.name}</td><td className="px-4 py-2.5 text-muted-foreground">{c.count}</td></tr>
            ))}
            {!companies.length && <tr><td colSpan={2} className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">No companies yet — find or upload some leads.</td></tr>}
          </tbody>
        </table>
      </div>
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
