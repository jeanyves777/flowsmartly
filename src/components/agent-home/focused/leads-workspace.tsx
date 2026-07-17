"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from "react";
import {
  Search, Users, Building2, BarChart3, Folder, FolderPlus, Sparkles, Upload, X,
  CheckCircle2, Workflow, ArrowRight, ChevronLeft, ChevronRight, FileText,
  Mail, MapPin, Clock, Star, Users2, StickyNote, Check,
} from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";
import { rankLeads, type OpportunityScore, type OppBand } from "@/lib/leads/opportunity-score";
import { useToast } from "@/hooks/use-toast";
import { useMobileChat } from "../mobile-chat-context";

// Mobile "collect via chat" starter (edit + send; the agent runs the search).
const LEADS_STARTER = "Find 50 [type of business] in [city, state] with a phone and website, and save them to a new lead list.";
import { RoiDashboard } from "./roi-dashboard";
import { LeadsAutomation } from "./leads-automation";
import { BriefSuggest, type BriefProposal } from "./brief-suggest";

/**
 * Lead Studio — the approved find → automate → close surface (see
 * design/lead-studio-mockup.html). It renders as the workspace canvas inside the
 * focused shell (the agent chat owns the LEFT), so its own section menu is a
 * collapsible RIGHT rail. Screens: Find (agent web-search → save as list) ·
 * Contacts · Companies · Pipeline (the multi-channel automation flow) · ROI ·
 * Library (folders + CSV upload). [[lead-studio-redesign-approved]]
 */

type Screen = "find" | "contacts" | "companies" | "pipeline" | "roi" | "library" | "pitches";
interface LeadList { id: string; name: string; category?: string | null; leadCount?: number; updatedAt?: string }
interface SavedLead {
  id: string; name: string; title?: string | null; category?: string | null;
  seniority?: string | null; department?: string | null;
  email?: string | null; phone?: string | null; phones?: string | null;
  website?: string | null; address?: string | null; socials?: string | null;
  rating?: number | null; reviewCount?: number | null; googleMapsUrl?: string | null;
  businessStatus?: string | null; notes?: string | null; status?: string; listName?: string;
  enrichedAt?: string | null; enrichmentSource?: string | null;
  enrichment?: string | null; deepEnrichedAt?: string | null; pitchCount?: number;
}
// The SavedLead.enrichment JSON blob (the "Deep details" pass).
interface DeepEnrichment {
  fullAddress?: string; hours?: string; employeeSize?: string; revenueBand?: string;
  yearFounded?: string; industry?: string; about?: string; reviews?: string;
  contacts?: { name: string; title?: string; email?: string; phone?: string }[];
}
// The deep-detail types the "Find more details" menu can hunt for.
const DEEP_DETAIL_TYPES: { key: string; label: string; find: string }[] = [
  { key: "fullAddress", label: "Full street address", find: "the COMPLETE street address — street number, street, city, state, ZIP and country (pass it as fullAddress)" },
  { key: "contacts", label: "More decision-makers", find: "additional named decision-makers / owners at the company (each with name, title, and email/phone if findable) — pass them as contacts[]" },
  { key: "hours", label: "Business hours", find: "their business hours (pass as hours)" },
  { key: "firmographics", label: "Company size & revenue", find: "the company size / headcount band (employeeSize), an estimated revenue band (revenueBand), and the year founded (yearFounded)" },
  { key: "reviews", label: "Recent reviews", find: "a short summary of their recent customer reviews / reputation (pass as reviews)" },
  { key: "socials", label: "Social profiles", find: "their public social profiles — LinkedIn, Facebook, Instagram, X (pass as socials)" },
];
const PAGE_SIZES = [25, 50, 100];

const SENIORITY = ["Owner", "C-level", "VP", "Director", "Manager"];
const SIZES = ["Any", "1–10", "11–50", "51–200", "200+"];
const REVS = ["Any", "<$1M", "$1M–$10M", "$10M+"];
const COUNTS = ["25", "50", "100"];

/**
 * One-tap industry presets. Picking a card fills the brief with a segment that
 * actually converts for that trade — who to ask for, and the buying signals worth
 * searching. Location is deliberately NOT set here: it comes from the user's own
 * business location and stays editable. Every field remains editable after a pick.
 */
const LP = "/Studio_Menus_Thumnail/Leads_industry_presets";
interface LeadPreset {
  id: string; name: string; blurb: string; thumb: string;
  industry: string; title: string; seniority: string[]; keywords: string; size: string;
}
const LEAD_PRESETS: LeadPreset[] = [
  { id: "dental", name: "Dental", blurb: "Practices & DSOs", thumb: `${LP}/dental.webp`,
    industry: "Dental practice", title: "Owner, Practice Manager", seniority: ["Owner", "Manager"], keywords: "“accepting new patients”, “implants”, “new location”", size: "1–10" },
  { id: "medspa", name: "Med spa", blurb: "Aesthetics & wellness", thumb: `${LP}/medspa.webp`,
    industry: "Med spa / aesthetics clinic", title: "Owner, Medical Director", seniority: ["Owner", "C-level"], keywords: "“botox”, “memberships”, “now open”", size: "1–10" },
  { id: "legal", name: "Legal", blurb: "Firms & attorneys", thumb: `${LP}/legal.webp`,
    industry: "Law firm", title: "Managing Partner, Owner", seniority: ["Owner", "C-level"], keywords: "“free consultation”, “personal injury”, “hiring”", size: "1–10" },
  { id: "realestate", name: "Real estate", blurb: "Agents & brokerages", thumb: `${LP}/realestate.webp`,
    industry: "Real estate brokerage", title: "Broker, Owner, Team Lead", seniority: ["Owner", "Director"], keywords: "“just listed”, “new agents”, “luxury”", size: "1–10" },
  { id: "homeservice", name: "Home service", blurb: "Trades & contractors", thumb: `${LP}/homeservice.webp`,
    industry: "Home services (HVAC, plumbing, roofing, electrical)", title: "Owner, General Manager", seniority: ["Owner", "Manager"], keywords: "“free estimate”, “emergency service”, “hiring techs”", size: "1–10" },
  { id: "fitness", name: "Fitness", blurb: "Gyms & studios", thumb: `${LP}/fitness.webp`,
    industry: "Gym / fitness studio", title: "Owner, General Manager", seniority: ["Owner", "Manager"], keywords: "“membership”, “personal training”, “grand opening”", size: "1–10" },
  { id: "restaurant", name: "Restaurant", blurb: "Dining & hospitality", thumb: `${LP}/restaurant.webp`,
    industry: "Restaurant", title: "Owner, General Manager", seniority: ["Owner", "Manager"], keywords: "“now open”, “catering”, “new menu”", size: "1–10" },
  { id: "beauty", name: "Beauty", blurb: "Salons & barbers", thumb: `${LP}/beauty.webp`,
    industry: "Hair salon / barbershop", title: "Owner, Salon Manager", seniority: ["Owner", "Manager"], keywords: "“booking”, “chair rental”, “now open”", size: "1–10" },
  { id: "healthcare", name: "Healthcare", blurb: "Clinics & practices", thumb: `${LP}/healthcare.webp`,
    industry: "Medical clinic / private practice", title: "Owner, Practice Administrator", seniority: ["Owner", "Manager"], keywords: "“accepting new patients”, “telehealth”, “new location”", size: "11–50" },
  { id: "retail", name: "Retail", blurb: "Shops & boutiques", thumb: `${LP}/retail.webp`,
    industry: "Retail store / boutique", title: "Owner, Store Manager", seniority: ["Owner", "Manager"], keywords: "“new location”, “online store”, “grand opening”", size: "1–10" },
  { id: "automotive", name: "Automotive", blurb: "Dealers & repair", thumb: `${LP}/automotive.webp`,
    industry: "Auto dealership / repair shop", title: "Owner, General Manager", seniority: ["Owner", "Manager"], keywords: "“service specials”, “used inventory”, “hiring”", size: "11–50" },
  { id: "saas", name: "SaaS", blurb: "Software & tech", thumb: `${LP}/saas.webp`,
    industry: "SaaS / software company", title: "Founder, CEO, CMO, Head of Growth", seniority: ["C-level", "VP", "Director"], keywords: "“just raised”, “hiring”, “free trial”", size: "11–50" },
  { id: "coaching", name: "Coaching", blurb: "Consultants & agencies", thumb: `${LP}/coaching.webp`,
    industry: "Coaching / consulting", title: "Founder, Owner, Principal", seniority: ["Owner", "C-level"], keywords: "“1:1 coaching”, “cohort”, “masterclass”", size: "1–10" },
];
const FLD = "w-full rounded-[9px] border border-input bg-background px-3 py-2 text-[12.5px] outline-none focus:border-brand-500/60";
const SEL = "rounded-[9px] border border-input bg-background px-2.5 py-2 text-[12px] outline-none focus:border-brand-500/60";

export function FocusedLeads({ initialScreen, initialListId, onAsk, refreshKey, menuOpen: menuOpenProp, agentBusy, onPitchLead, onOpenPitch }: { initialScreen?: string; initialListId?: string | null; refreshKey?: number; onAsk: (p: string) => void; menuOpen?: boolean; agentBusy?: boolean; onPitchLead?: (l: SavedLead) => void; onOpenPitch?: (pitchId: string) => void }) {
  const { toast } = useToast();
  const { isMobile, seedComposer } = useMobileChat();
  const openLeadBrief = () => { if (isMobile) { seedComposer(LEADS_STARTER); return; } setBriefOpen(true); };
  const [screen, setScreen] = useState<Screen>("find");
  useEffect(() => {
    const screens: Screen[] = ["find", "contacts", "companies", "pipeline", "roi", "library", "pitches"];
    if (initialScreen && screens.includes(initialScreen as Screen)) setScreen(initialScreen as Screen);
  }, [initialScreen]);
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
  const [presetId, setPresetId] = useState<string | null>(null);
  // Where the user actually sells — prefills Location so a search is one tap away.
  // Their audience focus wins over the office address; both stay editable.
  const [homeLocation, setHomeLocation] = useState("");
  const locTouched = useRef(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/brand").then((r) => r.json()).then((j) => {
      const b = j?.data?.brandKit;
      if (!alive || !b) return;
      const loc = String(b.audienceLocation || "").trim()
        || [b.city, b.state].filter(Boolean).join(", ")
        || String(b.country || "").trim();
      if (!loc) return;
      setHomeLocation(loc);
      // Don't clobber something the user already typed.
      if (!locTouched.current) setBrief((prev) => (prev.location ? prev : { ...prev, location: loc }));
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  /** A preset fills WHO to look for; location + every field stay editable after. */
  const applyPreset = (p: LeadPreset) => {
    setPresetId(p.id);
    setBrief((b) => ({
      ...b,
      industry: p.industry,
      title: p.title,
      seniority: p.seniority,
      keywords: p.keywords,
      size: p.size,
      location: b.location || homeLocation,
    }));
  };

  // ── Enrich (agent operates the row, not the chat) ──
  // Leads currently being enriched → drives the per-row / bulk loaders. The agent
  // writes the result INTO the lead via enrich_lead; we reconcile on refreshKey.
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
  const enrichingRef = useRef<Set<string>>(new Set());
  enrichingRef.current = enrichingIds;
  // The lead whose full-detail bottom sheet is open.
  const [detailLead, setDetailLead] = useState<SavedLead | null>(null);
  // The open folder that scopes the Contacts view (null = all contacts).
  const [contactScope, setContactScope] = useState<LeadList | null>(null);

  // Deep-link: when opened from an in-chat card with a specific list id, resolve
  // it against the loaded lists and open that list's contacts (once).
  const appliedListRef = useRef<string | null>(null);
  useEffect(() => {
    if (!initialListId || appliedListRef.current === initialListId || !lists.length) return;
    const l = lists.find((x) => x.id === initialListId);
    if (l) { appliedListRef.current = initialListId; setActiveList(l); setContactScope(l); setScreen("contacts"); }
  }, [initialListId, lists]);

  const enrichLead = useCallback((l: SavedLead) => {
    // No early-return on already-enriched: the detail sheet's "Re-enrich" runs it
    // again to fill in missing email/phone/website/address.
    setEnrichingIds((prev) => new Set(prev).add(l.id));
    onAsk(
      `Enrich the saved lead "${l.name}" (leadId: ${l.id})${l.category ? ` at ${l.category}` : ""}. Call propose_plan (2 × AI_WEB_SEARCH — the web search + the enrich save) so I can approve, then find the full reachable contact — WORK EMAIL (the priority), PHONE, business WEBSITE and ADDRESS/location, plus LinkedIn. The EMAIL is rarely in search results — web_fetch their WEBSITE + its /contact or /about page and read out the email (info@ / bookings@ / the owner's). Then call enrich_lead with the confirmed planId, leadId="${l.id}", and every field you found (email, phone, website, address, title, linkedin) to save it INTO their row. Do NOT print the contact details in the chat.`,
    );
  }, [onAsk]);

  // "Deep details" — a deeper pass than the basic enrich: full address,
  // firmographics, hours, reviews, extra contacts. `type` targets one detail
  // type (a chip); omit it for the broad "find everything deeper" primary action.
  const deepEnrich = useCallback((l: SavedLead, type?: string) => {
    setEnrichingIds((prev) => new Set(prev).add(l.id));
    const dt = type ? DEEP_DETAIL_TYPES.find((d) => d.key === type) : null;
    const findText = dt
      ? dt.find
      : "everything still missing, PLUS the full street address, additional decision-makers, business hours, company size + revenue band + year founded, the industry, and a short summary of their recent reviews";
    onAsk(
      `Get DEEP details for the saved lead "${l.name}" (leadId: ${l.id})${l.category ? ` at ${l.category}` : ""}. Call propose_plan (2 × AI_WEB_SEARCH — the web search + the deep-enrich save) so I can approve, then find ${findText} via web_search + web_fetch on their website / Google Business / LinkedIn. Then call deep_enrich_lead with the confirmed planId, leadId="${l.id}", and EVERY field you verified so it saves INTO their row. Do NOT print the details in the chat.`,
    );
  }, [onAsk]);

  const enrichAll = useCallback((leadsToEnrich: SavedLead[], label: string) => {
    const targets = leadsToEnrich.filter((l) => !l.enrichedAt).slice(0, 100); // cap one batch
    if (!targets.length) return;
    setEnrichingIds((prev) => { const n = new Set(prev); targets.forEach((l) => n.add(l.id)); return n; });
    const idList = targets.map((l) => `${l.name} → ${l.id}`).join("; ");
    onAsk(
      `Enrich all ${targets.length} un-enriched leads ${label}. FIRST call propose_plan (two AI_WEB_SEARCH per lead — the web search to find them + the enrich save) so I can approve the total cost. Then for EACH lead, find the full reachable contact — WORK EMAIL (the priority), PHONE, business WEBSITE and ADDRESS/location, plus LinkedIn. The EMAIL is rarely in search results — it's on the business's own WEBSITE, so web_fetch their site + its /contact or /about page and read out the email (info@ / bookings@ / the owner's). Then call enrich_lead with the SAME confirmed planId, that lead's exact leadId, and EVERY field you found (email, phone, website, address, title, linkedin) so it saves INTO their row. If you reach the per-turn web-search limit, enrich everyone you found so far, then tell me you'll continue the rest next — do NOT loop retrying the same call. Do NOT paste any contact details in the chat — every result must land in its row. The leads (name → leadId) are: ${idList}.`,
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

  // AI "Suggest ideas" → fill the search brief from the chosen target segment.
  const applyLeadProposal = (p: BriefProposal) => {
    setBrief((b) => ({
      ...b,
      industry: typeof p.industry === "string" && p.industry.trim() ? p.industry.trim() : b.industry,
      title: typeof p.jobTitle === "string" && p.jobTitle.trim() ? p.jobTitle.trim() : b.title,
      seniority: Array.isArray(p.seniority) ? (p.seniority as unknown[]).filter((s): s is string => typeof s === "string" && SENIORITY.includes(s)) : b.seniority,
      keywords: typeof p.keywords === "string" && p.keywords.trim() ? p.keywords.trim() : b.keywords,
    }));
  };

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
            onOpenBrief={openLeadBrief} onBuild={() => { if (resultList) buildAutomation(resultList); }}
            enrichingIds={enrichingIds} onEnrich={enrichLead} onEnrichAll={() => { if (resultList) enrichAll(results, `in the "${resultList.name}" list`); }} onOpenLead={setDetailLead} />
        ) : screen === "contacts" ? (
          <ContactsScreen leads={allLeads} loaded={loadedLeads} enrichingIds={enrichingIds} onEnrich={enrichLead} onEnrichAll={(ls, label) => enrichAll(ls, label)} onOpenLead={setDetailLead} scope={contactScope} onClearScope={() => setContactScope(null)} />
        ) : screen === "companies" ? (
          <CompaniesScreen companies={companies} loaded={loadedLeads} />
        ) : screen === "pitches" ? (
          <PitchesScreen refreshKey={refreshKey} onOpenPitch={onOpenPitch} />
        ) : screen === "library" ? (
          <LibraryScreen lists={lists} onBuild={buildAutomation} onOpen={(l) => { setActiveList(l); setContactScope(l); setScreen("contacts"); }}
            uploadOpen={uploadOpen} setUploadOpen={setUploadOpen} pasteRows={pasteRows} setPasteRows={setPasteRows}
            newFolderName={newFolderName} setNewFolderName={setNewFolderName} importing={importing} onImport={importPaste} />
        ) : screen === "pipeline" ? (
          <LeadsAutomation listId={activeList?.id} listName={activeList?.name} leadCount={activeList?.leadCount} onAsk={onAsk} refreshKey={refreshKey} lists={lists} onSelectList={(l) => setActiveList(l)} agentBusy={agentBusy} onPitchLead={onPitchLead ? (lead) => onPitchLead({ id: lead.id, name: lead.name } as SavedLead) : undefined} />
        ) : (
          <RoiDashboard refreshKey={refreshKey} />
        )}
      </div>

      {/* RIGHT MENU (collapsible from the surface-header toggle) */}
      {menuOpen && (
        <aside className="hidden w-[236px] shrink-0 flex-col gap-2.5 overflow-y-auto border-s border-border bg-card/40 p-3 lg:flex">
          <button onClick={() => { setScreen("find"); openLeadBrief(); }} className="inline-flex items-center justify-center gap-2 rounded-[12px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><Sparkles className="h-4 w-4" /> Find leads</button>
          <p className="px-2 pt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground/70">Workspace</p>
          <nav className="flex flex-col gap-0.5">
            {NAV.map((n) => (
              <NavItem key={n.id} active={screen === n.id} icon={n.icon} label={n.label} count={n.count} onClick={() => { if (n.id === "contacts") setContactScope(null); setScreen(n.id); }} />
            ))}
          </nav>
          <p className="px-2 pt-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground/70">Saved</p>
          <nav className="flex flex-col gap-0.5">
            <NavItem active={screen === "library"} icon={Folder} label="Library" count={lists.length || undefined} onClick={() => setScreen("library")} />
            <NavItem active={screen === "pitches"} icon={FileText} label="Pitches" onClick={() => setScreen("pitches")} />
            <NavItem active={screen === "contacts" && !contactScope} icon={Users} label="All contacts" onClick={() => { setContactScope(null); setScreen("contacts"); }} />
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
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <BriefSuggest kind="leads" onApply={applyLeadProposal} />

              {/* One-tap presets — pick a trade and the brief fills itself. */}
              <div>
                <p className="mb-0.5 text-[11.5px] font-semibold">Start from an industry</p>
                <p className="mb-2 text-[11px] text-muted-foreground">Pick one and we fill the brief — who to ask for and what to look for. Change anything after.</p>
                <div className="flex gap-2.5 overflow-x-auto pb-1.5">
                  {LEAD_PRESETS.map((p) => (
                    <button key={p.id} type="button" onClick={() => applyPreset(p)}
                      className={cn("group w-[132px] shrink-0 overflow-hidden rounded-xl border text-left transition",
                        presetId === p.id ? "border-brand-500 ring-1 ring-inset ring-brand-500/30" : "border-border hover:border-brand-500/50")}>
                      <span className="relative block aspect-[16/9] overflow-hidden bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.thumb} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.04]" />
                        {presetId === p.id && (
                          <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-brand-500 text-white"><Check className="h-2.5 w-2.5" /></span>
                        )}
                      </span>
                      <span className="block px-2 py-1.5">
                        <span className={cn("block truncate text-[11.5px] font-bold", presetId === p.id && "text-brand-500")}>{p.name}</span>
                        <span className="block truncate text-[10px] text-muted-foreground">{p.blurb}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Industry">
                  <input value={brief.industry} onChange={(e) => { setPresetId(null); setBrief((b) => ({ ...b, industry: e.target.value })); }} placeholder="e.g. Dental, SaaS, Real estate" className={FLD} />
                </Field>
                <Field label="Location">
                  <input value={brief.location} onChange={(e) => { locTouched.current = true; setBrief((b) => ({ ...b, location: e.target.value })); }} placeholder="City, state or region" className={FLD} />
                  {homeLocation && brief.location !== homeLocation && (
                    <button type="button" onClick={() => { locTouched.current = true; setBrief((b) => ({ ...b, location: homeLocation })); }}
                      className="mt-1.5 inline-flex items-center gap-1 text-[10.5px] font-semibold text-brand-500 hover:underline">
                      <MapPin className="h-3 w-3" /> Use {homeLocation}
                    </button>
                  )}
                </Field>
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
        return <LeadDetailSheet
          lead={fresh}
          enriching={enrichingIds.has(fresh.id)}
          onEnrich={() => enrichLead(fresh)}
          onDeepDetail={(type) => deepEnrich(fresh, type)}
          onClose={() => setDetailLead(null)}
          onPitch={onPitchLead ? () => { setDetailLead(null); onPitchLead(fresh); } : undefined}
          onCreateAutomation={() => { const list = lists.find((x) => x.name === fresh.listName); if (list) setActiveList(list); setScreen("pipeline"); setDetailLead(null); }}
        />;
      })()}
    </div>
  );
}

/* ── detail-card helpers ── */
function DField({ k, children, full }: { k: string; children: ReactNode; full?: boolean }) {
  return (
    <div className={cn("min-w-0", full && "sm:col-span-2")}>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60">{k}</dt>
      <dd className="mt-0.5 break-words text-[13px] leading-snug">{children}</dd>
    </div>
  );
}
// Muted placeholder for a field the agent hasn't found yet — fills the grid so a
// sparse profile doesn't read as half-empty. The "Find more details" chips below
// are the way to actually go hunt for these.
function DMiss({ k, full }: { k: string; full?: boolean }) {
  return (
    <div className={cn("min-w-0", full && "sm:col-span-2")}>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground/45">{k}</dt>
      <dd className="mt-0.5 text-[13px] italic leading-snug text-muted-foreground/35">Not found yet</dd>
    </div>
  );
}
function DSection({ icon: Icon, label, children }: { icon: ElementType; label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground/60"><Icon className="h-3.5 w-3.5" /> {label}</p>
      <dl className="grid grid-cols-1 gap-x-5 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</dl>
    </div>
  );
}
const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

/* ── Lead detail — full contact record in a bottom sheet ── */
function LeadDetailSheet({ lead, enriching, onEnrich, onDeepDetail, onClose, onPitch, onCreateAutomation }: { lead: SavedLead; enriching: boolean; onEnrich: () => void; onDeepDetail: (type?: string) => void; onClose: () => void; onPitch?: () => void; onCreateAutomation?: () => void }) {
  const socials = parseSocials(lead.socials);
  const socialEntries = Object.entries(socials);
  const phones = (() => { try { const p = JSON.parse(lead.phones || "[]"); return Array.isArray(p) ? (p as string[]).filter((x) => x && x !== lead.phone) : []; } catch { return []; } })();
  const deep: DeepEnrichment = (() => { try { const o = JSON.parse(lead.enrichment || "{}"); return o && typeof o === "object" ? (o as DeepEnrichment) : {}; } catch { return {}; } })();
  const enriched = !!lead.enrichedAt;
  const address = deep.fullAddress || lead.address || "";
  const link = (u: string) => (u.startsWith("http") ? u : `https://${u}`);

  const role = [lead.title, lead.seniority, lead.department].filter(Boolean).join(" · ");
  const hasContact = !!(lead.email || lead.phone || phones.length || lead.website || socialEntries.length);
  const hasBusiness = !!(lead.category || deep.industry || deep.employeeSize || deep.revenueBand || deep.yearFounded || typeof lead.rating === "number" || deep.hours || lead.businessStatus || deep.about);
  const hasNotes = !!(lead.notes || deep.reviews);
  const anyDetail = hasContact || !!address || hasBusiness || hasNotes;

  // Gaps drive the amber "missing" flags on the Find-more chips.
  const gaps = new Set<string>();
  if (!address || !/\d/.test(address)) gaps.add("fullAddress"); // no street number ≈ partial
  if (!deep.contacts?.length) gaps.add("contacts");
  if (!deep.hours) gaps.add("hours");
  if (!deep.employeeSize && !deep.revenueBand && !deep.yearFounded) gaps.add("firmographics");
  if (!deep.reviews) gaps.add("reviews");
  if (!socialEntries.length) gaps.add("socials");

  return (
    <div className="absolute inset-0 z-40">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-x-3 bottom-3 flex max-h-[86%] flex-col rounded-2xl border border-border bg-card shadow-2xl sm:inset-x-5 sm:bottom-4">
        {/* header */}
        <div className="relative border-b border-border px-5 pb-3.5 pt-4">
          <span className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-border" />
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-gradient-to-br from-brand-500 to-violet-500 text-[15px] font-bold text-white">{initialsOf(lead.name)}</span>
            <div className="min-w-0 flex-1">
              <h4 className="truncate text-[16px] font-bold leading-tight">{lead.name}</h4>
              {role && <p className="truncate text-[12px] text-muted-foreground">{role}{lead.category && lead.category !== lead.name ? ` · ${lead.category}` : ""}</p>}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {lead.listName && <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{lead.listName}</span>}
                {!!lead.pitchCount && lead.pitchCount > 0 && <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{lead.pitchCount} pitch{lead.pitchCount === 1 ? "" : "es"}</span>}
              </div>
            </div>
            {enriched ? (
              <span className="ms-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-500"><Check className="h-3 w-3" /> {lead.deepEnrichedAt ? "Deep" : "Enriched"}{lead.enrichmentSource ? ` · ${lead.enrichmentSource}` : ""}</span>
            ) : (
              <span className="ms-auto shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-500">Not enriched</span>
            )}
          </div>
          <button onClick={onClose} className="absolute end-4 top-4 grid h-7 w-7 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        {/* body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {!anyDetail ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[12.5px] text-muted-foreground">No contact details yet — <b className="text-foreground">Get details</b> finds their email, phone, website and full address and saves them here.</p>
          ) : (
            <>
              {(enriched || hasContact) && (
                <DSection icon={Mail} label="Contact">
                  {lead.email ? <DField k="Work email"><a href={`mailto:${lead.email}`} className="text-brand-500 hover:underline">{lead.email}</a></DField> : enriched && <DMiss k="Work email" />}
                  {lead.phone ? <DField k="Phone"><a href={`tel:${lead.phone}`} className="text-brand-500 hover:underline">{lead.phone}</a></DField> : enriched && <DMiss k="Phone" />}
                  {phones.map((p, i) => <DField key={i} k="Other phone"><a href={`tel:${p}`} className="text-brand-500 hover:underline">{p}</a></DField>)}
                  {lead.website ? <DField k="Website"><a href={link(lead.website)} target="_blank" rel="noreferrer" className="text-brand-500 hover:underline">{hostOf(lead.website)}</a></DField> : enriched && <DMiss k="Website" />}
                  {socialEntries.length ? socialEntries.map(([k, v]) => <DField key={k} k={k[0].toUpperCase() + k.slice(1)}><a href={v} target="_blank" rel="noreferrer" className="text-brand-500 hover:underline">{hostOf(v) || v}</a></DField>) : enriched && <DMiss k="Social profiles" />}
                </DSection>
              )}

              {(enriched || address || lead.googleMapsUrl) && (
                <DSection icon={MapPin} label="Location">
                  {address ? <DField k="Address" full>{address}</DField> : enriched && <DMiss k="Address" full />}
                  {lead.googleMapsUrl && <DField k="Map"><a href={lead.googleMapsUrl} target="_blank" rel="noreferrer" className="text-brand-500 hover:underline">Open in Google Maps ↗</a></DField>}
                </DSection>
              )}

              {(enriched || hasBusiness) && (
                <DSection icon={Building2} label="Business">
                  {lead.category ? <DField k="Company">{lead.category}</DField> : enriched && <DMiss k="Company" />}
                  {deep.industry ? <DField k="Industry">{deep.industry}</DField> : enriched && <DMiss k="Industry" />}
                  {deep.employeeSize ? <DField k="Company size">{deep.employeeSize}</DField> : enriched && <DMiss k="Company size" />}
                  {deep.revenueBand ? <DField k="Revenue">{deep.revenueBand}</DField> : enriched && <DMiss k="Revenue" />}
                  {deep.yearFounded ? <DField k="Founded">{deep.yearFounded}</DField> : enriched && <DMiss k="Founded" />}
                  {typeof lead.rating === "number" ? <DField k="Rating"><span className="inline-flex items-center gap-1"><Star className="h-3 w-3 text-amber-500" />{lead.rating}{lead.reviewCount ? ` · ${lead.reviewCount} reviews` : ""}</span></DField> : enriched && <DMiss k="Rating" />}
                  {deep.hours ? <DField k="Hours"><span className="inline-flex items-center gap-1"><Clock className="h-3 w-3 text-muted-foreground" />{deep.hours}</span></DField> : enriched && <DMiss k="Hours" />}
                  {lead.businessStatus && <DField k="Status">{lead.businessStatus === "OPERATIONAL" ? "Operational" : lead.businessStatus}</DField>}
                  {deep.about && <DField k="About" full>{deep.about}</DField>}
                </DSection>
              )}

              {!!deep.contacts?.length && (
                <DSection icon={Users2} label="More decision-makers">
                  {deep.contacts.map((c, i) => (
                    <DField key={i} k={c.title || "Contact"} full>
                      <span className="font-semibold">{c.name}</span>
                      {(c.email || c.phone) && <span className="text-muted-foreground"> — {[c.email, c.phone].filter(Boolean).join(" · ")}</span>}
                    </DField>
                  ))}
                </DSection>
              )}

              {(enriched || hasNotes) && (
                <DSection icon={StickyNote} label="Notes">
                  {deep.reviews ? <DField k="Reviews summary" full>{deep.reviews}</DField> : enriched && <DMiss k="Reviews summary" full />}
                  {lead.notes && <DField k="Notes" full>{lead.notes}</DField>}
                </DSection>
              )}
            </>
          )}

          {/* FIND MORE — deep-detail menu, only once the lead has been enriched */}
          {enriched && (
            <div className="rounded-[14px] border border-border bg-gradient-to-b from-brand-500/[0.07] to-transparent p-3.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-500" />
                <h5 className="text-[13px] font-bold">Find more details</h5>
                <span className="ms-auto rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold text-brand-500">agent searches</span>
              </div>
              <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">Tap a gap to hunt for it — the agent searches the web + their site and saves it into this record. Found details are locked so nothing is searched twice.</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {DEEP_DETAIL_TYPES.map((d) => {
                  const gap = gaps.has(d.key === "firmographics" ? "firmographics" : d.key);
                  // Already found → locked, non-clickable: never re-request work that's done.
                  // Only gaps (still missing) stay requestable.
                  if (!gap) {
                    return (
                      <span key={d.key} title="Already found — nothing to search" className="inline-flex cursor-default items-center gap-1.5 rounded-[10px] border border-emerald-500/40 bg-emerald-500/[0.08] px-2.5 py-1.5 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3.5 w-3.5" /> {d.label}
                      </span>
                    );
                  }
                  return (
                    <button key={d.key} disabled={enriching} onClick={() => onDeepDetail(d.key)} title={`Find ${d.label.toLowerCase()}`} className="inline-flex items-center gap-1.5 rounded-[10px] border border-amber-500/40 px-2.5 py-1.5 text-[12px] font-semibold text-foreground transition hover:bg-amber-500/[0.06] disabled:opacity-60">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex flex-wrap items-center gap-2.5 border-t border-border px-5 py-3.5">
          {onPitch && <button onClick={onPitch} className="inline-flex items-center gap-2 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-brand-500/30"><FileText className="h-4 w-4" /> Pitch this lead</button>}
          {onCreateAutomation && <button onClick={onCreateAutomation} className="inline-flex items-center gap-2 rounded-[10px] border border-border px-4 py-2 text-[13px] font-semibold hover:border-brand-500/60"><Workflow className="h-4 w-4" /> Create automation</button>}
          <button onClick={() => (enriched ? onDeepDetail() : onEnrich())} disabled={enriching} className="ms-auto inline-flex items-center gap-2 rounded-[10px] border border-border px-3.5 py-2 text-[13px] font-semibold text-muted-foreground hover:border-brand-500/60 hover:text-foreground disabled:opacity-60">{enriching ? <FlowLoader size={14} /> : <Sparkles className="h-4 w-4" />} {enriching ? "Working…" : enriched ? "Deep details" : "Get details"}</button>
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
  const ranked = useMemo(() => rankLeads(results, { searchLocation: resultList?.name }), [results, resultList]);
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
                  {enrichBusy ? <FlowLoader size={13} /> : <Sparkles className="h-3.5 w-3.5" />} {enrichBusy ? "Finding…" : `Get details · ${unenriched}`}
                </button>
              )}
              <button onClick={onBuild} className="inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[11.5px] font-semibold text-white">Build automation <ArrowRight className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        )}
        <LeadTable leads={ranked} enrichingIds={enrichingIds} onEnrich={onEnrich} onOpenLead={onOpenLead} />
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

// A lead carrying its computed opportunity score (attached by rankLeads).
type RankedLead = SavedLead & { opportunity?: OpportunityScore };

const BAND_STYLE: Record<OppBand, { chip: string; num: string; bar: string; label: string }> = {
  high: { chip: "border-emerald-500/40 bg-emerald-500/12 text-emerald-400", num: "bg-emerald-500 text-emerald-950", bar: "bg-emerald-500", label: "High" },
  med: { chip: "border-amber-500/40 bg-amber-500/12 text-amber-400", num: "bg-amber-500 text-amber-950", bar: "bg-amber-500", label: "Med" },
  low: { chip: "border-slate-500/30 bg-slate-500/12 text-slate-400", num: "bg-slate-500 text-slate-950", bar: "bg-slate-500", label: "Low" },
};

/** The Opportunity cell — score chip (0–100 + band) over a thin fill bar, with a
 *  hover breakdown of how the score was reached. */
function OpportunityCell({ opp }: { opp?: OpportunityScore }) {
  if (!opp) return <span className="text-muted-foreground">—</span>;
  const s = BAND_STYLE[opp.band];
  return (
    <div className="group/opp relative w-[132px]">
      <span className={cn("inline-flex items-center gap-1.5 rounded-full border py-0.5 pe-2.5 ps-0.5 text-[11.5px] font-bold", s.chip)}>
        <span className={cn("grid h-[19px] w-[23px] place-items-center rounded-full text-[11px] font-extrabold tabular-nums", s.num)}>{opp.score}</span>
        {s.label}
      </span>
      <div className="mt-1 h-[3px] w-[120px] overflow-hidden rounded-full bg-muted"><i className={cn("block h-full rounded-full", s.bar)} style={{ width: `${opp.score}%` }} /></div>
      <div className="pointer-events-none absolute start-0 top-[calc(100%+6px)] z-30 w-[230px] rounded-[10px] border border-border bg-popover p-2.5 opacity-0 shadow-xl transition-opacity group-hover/opp:opacity-100">
        <div className="mb-1.5 text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">Score breakdown</div>
        {[["Offer / industry match", opp.parts.match, 30], ["In searched area", opp.parts.area, 15], ["Established signal", opp.parts.signal, 5]].map(([k, v, m]) => (
          <div key={k as string} className="flex justify-between py-[1.5px] text-[11px] text-muted-foreground"><span>{k}</span><b className="text-foreground tabular-nums">{v}/{m}</b></div>
        ))}
        <div className="mt-1 flex justify-between border-t border-dashed border-border pt-1 text-[11px]"><span className="text-muted-foreground">Brand fit</span><b className="tabular-nums">{opp.fit}/50</b></div>
        <div className="flex justify-between py-[1.5px] text-[11px]"><span className="text-muted-foreground">Data readiness</span><b className="tabular-nums">{opp.readiness}/50</b></div>
      </div>
    </div>
  );
}

function LeadTable({ leads, enrichingIds, onEnrich, onOpenLead, rankOffset = 0 }: { leads: RankedLead[]; enrichingIds: Set<string>; onEnrich: (l: SavedLead) => void; onOpenLead: (l: SavedLead) => void; rankOffset?: number }) {
  if (!leads.length) return <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-muted-foreground">No leads yet.</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-[12.5px]">
        <thead className="text-left text-[11px] text-muted-foreground"><tr>{["Rank", "Name", "Title", "Company", "Contact", "Opportunity", ""].map((h, i) => <th key={i} className={cn("border-b border-border px-4 py-2.5 font-medium", h === "Rank" && "w-14 text-center")}>{h}</th>)}</tr></thead>
        <tbody>
          {leads.map((l, i) => {
            const enriching = enrichingIds.has(l.id);
            const rank = rankOffset + i + 1;
            return (
              <tr key={l.id} onClick={() => onOpenLead(l)} className="cursor-pointer border-t border-border hover:bg-muted/20">
                <td className="px-4 py-2.5 text-center">
                  <span className={cn("text-[13px] font-extrabold tabular-nums", rank === 1 ? "text-brand-500" : "text-muted-foreground")}>#{rank}</span>
                  {rank === 1 && <span className="block text-[8px] font-bold tracking-wide text-muted-foreground">TOP</span>}
                </td>
                <td className="px-4 py-2.5 font-semibold">{l.name}{l.opportunity?.outOfArea && <span className="ms-1.5 inline-flex items-center gap-0.5 rounded border border-amber-500/40 bg-amber-500/10 px-1 text-[8.5px] font-bold text-amber-500" title="Address is outside your searched area">⚠ out of area</span>}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{l.title || "—"}</td>
                <td className="px-4 py-2.5">{l.category || "—"}</td>
                <td className="px-4 py-2.5"><ContactCell l={l} enriching={enriching} /></td>
                <td className="px-4 py-2.5"><OpportunityCell opp={l.opportunity} /></td>
                <td className="px-4 py-2.5 text-end">
                  {enriching ? (
                    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-brand-500"><FlowLoader size={13} /> Finding…</span>
                  ) : l.enrichedAt ? (
                    <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-500"><Check className="h-3 w-3" /> Enriched</span>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); onEnrich(l); }} className="rounded-lg border border-border px-3 py-1 text-[11.5px] font-semibold text-brand-500 hover:border-brand-500/60">Get details</button>
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
function ContactsScreen({ leads, loaded, enrichingIds, onEnrich, onEnrichAll, onOpenLead, scope, onClearScope }: { leads: SavedLead[]; loaded: boolean; enrichingIds: Set<string>; onEnrich: (l: SavedLead) => void; onEnrichAll: (leads: SavedLead[], label: string) => void; onOpenLead: (l: SavedLead) => void; scope?: LeadList | null; onClearScope?: () => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "enriched" | "new">("all");
  const [listFilter, setListFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const listOptions = useMemo(() => Array.from(new Set(leads.map((l) => l.listName).filter((n): n is string => !!n))).sort(), [leads]);
  // A scoped view (opened from a folder) hard-filters to that folder's leads.
  const scoped = useMemo(() => (scope ? leads.filter((l) => l.listName === scope.name) : leads), [leads, scope]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.filter((l) => {
      if (status === "enriched" && !l.enrichedAt) return false;
      if (status === "new" && l.enrichedAt) return false;
      if (!scope && listFilter !== "all" && l.listName !== listFilter) return false;
      if (!q) return true;
      return [l.name, l.title, l.category, l.email, l.listName].some((s) => (s || "").toLowerCase().includes(q));
    });
  }, [scoped, query, status, listFilter, scope]);

  useEffect(() => { setPage(1); }, [query, status, listFilter, pageSize, scope]);

  // Rank the whole filtered set (best-first) BEFORE paging, so #1 is the top
  // opportunity across all pages, not just the current page.
  const ranked = useMemo(() => rankLeads(filtered, { searchLocation: scope?.name ?? (listFilter !== "all" ? listFilter : undefined) }), [filtered, scope, listFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageC = Math.min(page, totalPages);
  const paged = ranked.slice((pageC - 1) * pageSize, pageC * pageSize);
  const start = filtered.length ? (pageC - 1) * pageSize + 1 : 0;
  const end = Math.min(pageC * pageSize, filtered.length);
  const activeFilter = query.trim() !== "" || status !== "all" || (!scope && listFilter !== "all");
  const unenriched = filtered.filter((l) => !l.enrichedAt).length;
  const enrichBusy = filtered.some((l) => enrichingIds.has(l.id));

  if (!loaded) return <div className="grid place-items-center py-16"><FlowLoader size={22} label="Loading contacts…" /></div>;
  return (
    <>
      {scope && (
        <div className="mb-2.5 flex flex-wrap items-center gap-2.5 rounded-xl border border-brand-500/30 bg-brand-500/[0.06] px-3.5 py-2 text-[12.5px]">
          <Folder className="h-4 w-4 shrink-0 text-brand-500" />
          <span>Folder: <b>{scope.name}</b> · {scoped.length} lead{scoped.length === 1 ? "" : "s"}</span>
          <button onClick={onClearScope} className="ms-auto inline-flex items-center gap-1 rounded-[8px] border border-border px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground hover:text-foreground"><Users className="h-3.5 w-3.5" /> View all contacts</button>
        </div>
      )}
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={scope ? `Search in ${scope.name}…` : "Search name, company, email…"} className="w-full rounded-[9px] border border-input bg-background py-2 pe-3 ps-8 text-[12.5px] outline-none focus:border-brand-500/60" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as "all" | "enriched" | "new")} className={SEL}>
          <option value="all">All statuses</option>
          <option value="enriched">Enriched</option>
          <option value="new">Not enriched</option>
        </select>
        {!scope && listOptions.length > 1 && (
          <select value={listFilter} onChange={(e) => setListFilter(e.target.value)} className={SEL}>
            <option value="all">All lists</option>
            {listOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        {unenriched > 0 && (
          <button
            onClick={() => onEnrichAll(filtered, scope ? `in the "${scope.name}" list` : activeFilter ? "matching your current filter" : "across your saved lists")}
            disabled={enrichBusy}
            title="Find email + phone for every un-enriched contact shown"
            className="inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-2 text-[12px] font-semibold text-white shadow-sm shadow-brand-500/25 disabled:opacity-60"
          >
            {enrichBusy ? <FlowLoader size={13} tone="white" /> : <Sparkles className="h-3.5 w-3.5" />} {enrichBusy ? "Finding…" : `Get details · ${unenriched}`}
          </button>
        )}
      </div>
      <p className="mb-3 text-[12px] text-muted-foreground">
        {filtered.length === 0 ? "No contacts match your filters." : <>Showing <b className="text-foreground">{start}–{end}</b> of {filtered.length}{activeFilter ? ` (filtered from ${scoped.length})` : scope ? ` in ${scope.name}` : " contacts"} — enrich to reveal email + phone.</>}
      </p>
      <LeadTable leads={paged} enrichingIds={enrichingIds} onEnrich={onEnrich} onOpenLead={onOpenLead} rankOffset={(pageC - 1) * pageSize} />
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

/* ── Pitch library — every generated proposal/pitch, reopen in Pitch Studio ── */
interface PitchRow { id: string; businessName: string; documentType: string; status: string; recipientName?: string | null; createdAt: string; updatedAt: string }
function PitchesScreen({ refreshKey, onOpenPitch }: { refreshKey?: number; onOpenPitch?: (id: string) => void }) {
  const [pitches, setPitches] = useState<PitchRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    (async () => { const j = await fetch("/api/pitch?limit=100").then((r) => r.json()).catch(() => null); setPitches(j?.data?.pitches || []); setLoaded(true); })();
  }, [refreshKey]);
  const filtered = useMemo(() => { const q = query.trim().toLowerCase(); return q ? pitches.filter((p) => (p.businessName || "").toLowerCase().includes(q)) : pitches; }, [pitches, query]);

  if (!loaded) return <div className="grid place-items-center py-16"><FlowLoader size={22} label="Loading pitches…" /></div>;
  return (
    <>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pitches…" className="w-full rounded-[9px] border border-input bg-background py-2 pe-3 ps-8 text-[12.5px] outline-none focus:border-brand-500/60" />
        </div>
        <span className="text-[12px] text-muted-foreground">{filtered.length} pitch{filtered.length === 1 ? "" : "es"}</span>
      </div>
      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[12.5px] text-muted-foreground">No pitches yet — open a lead and click <b>Pitch this lead</b> to draft one in Pitch Studio.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <button key={p.id} onClick={() => onOpenPitch?.(p.id)} className="rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-brand-500/50">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><FileText className="h-5 w-5" /></span>
              <p className="mt-2.5 truncate text-[13.5px] font-semibold">{p.businessName}</p>
              <p className="truncate text-[11.5px] text-muted-foreground">{p.documentType === "service_proposal" ? "Proposal" : "Pitch"}{p.status === "SENT" ? " · Sent" : p.status === "READY" ? " · Ready" : ""} · {(() => { try { return new Date(p.updatedAt || p.createdAt).toLocaleDateString(); } catch { return ""; } })()}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-500">Open in Studio <ArrowRight className="h-3.5 w-3.5" /></span>
            </button>
          ))}
        </div>
      )}
    </>
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
