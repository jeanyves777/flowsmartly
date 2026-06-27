"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, MapPin, Star, Phone, Globe, ExternalLink, UserPlus, FileText, Send, Check, Sparkles, Clock } from "lucide-react";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Lead finder — its OWN dedicated new-design surface (split out of the legacy
 * pitch-board). Search local businesses (Google Places) to PITCH or write a
 * PROPOSAL for, or import as contacts. Real APIs: POST /api/leads/search,
 * POST /api/leads/to-contacts, GET /api/leads/search (recent). Pitch/Proposal
 * are generative → the agent runs them (hidden instruction). No legacy links.
 * [[surface-buttons-are-ui-actions]] [[new-design-no-legacy]]
 */

interface BusinessLead {
  placeId: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  businessStatus?: string;
  types?: string[];
  googleMapsUrl: string;
}
interface RecentSearch { id: string; query: string; location?: string | null; industry?: string | null; resultCount?: number; createdAt: string }

export function FocusedLeads({ onAsk }: { refreshKey?: number; onAsk: (prompt: string) => void }) {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<BusinessLead[]>([]);
  const [searchId, setSearchId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentSearch[]>([]);

  const loadRecent = useCallback(async () => {
    try {
      const j = await fetch("/api/leads/search?limit=8").then((r) => r.json());
      if (j?.success && Array.isArray(j.data?.searches)) setRecent(j.data.searches);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { loadRecent(); }, [loadRecent]);

  const runSearch = async () => {
    if (!query.trim() || searching) return;
    setSearching(true); setError(""); setInfo(""); setAdded(new Set());
    try {
      const j = await fetch("/api/leads/search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), location: location.trim() || undefined }),
      }).then((r) => r.json());
      if (j?.success && j.data) {
        setResults(j.data.results || []);
        setSearchId(j.data.searchId || null);
        setInfo(`${j.data.total ?? (j.data.results?.length || 0)} businesses${j.data.isFreeRun ? " · free trial search" : j.data.creditsUsed ? ` · ${j.data.creditsUsed} credits` : ""}`);
        loadRecent();
      } else {
        setError(j?.error?.message || "Search failed.");
        setResults([]);
      }
    } catch {
      setError("Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const addToContacts = async (lead: BusinessLead) => {
    setAddingId(lead.placeId);
    try {
      const j = await fetch("/api/leads/to-contacts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchId, selectedLeads: [lead] }),
      }).then((r) => r.json());
      if (j?.success) setAdded((s) => new Set(s).add(lead.placeId));
    } catch { /* ignore */ } finally {
      setAddingId(null);
    }
  };

  const pitch = (lead: BusinessLead) => onAsk(`Draft a cold-outreach pitch to ${lead.name}${lead.website ? ` (${lead.website})` : ""} — a local business at ${lead.address}. Use my brand's services and a personalized hook.`);
  const proposal = (lead: BusinessLead) => onAsk(`Write a branded service proposal for ${lead.name}${lead.website ? ` (${lead.website})` : ""} offering my services. Use my Brand Kit's offerings.`);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        {/* search */}
        <section className="rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-500/8 to-violet-500/5 p-4 sm:p-5">
          <div className="mb-2.5 flex items-center gap-2">
            <Search className="h-4 w-4 text-brand-500" />
            <h3 className="text-[13px] font-bold">Find leads</h3>
            <span className="text-[11.5px] text-muted-foreground">Local businesses to pitch or propose to.</span>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-[1.4fr_1fr_auto]">
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }} placeholder="What kind of business? e.g. dentists, cafés, gyms" className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60" />
            <input value={location} onChange={(e) => setLocation(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }} placeholder="Location (city, area)" className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60" />
            <button onClick={runSearch} disabled={searching || !query.trim()} className="inline-flex items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-sm disabled:opacity-60">
              {searching ? <FlowLoader size={16} tone="white" /> : <Search className="h-4 w-4" />} Search
            </button>
          </div>
          {error && <p className="mt-2 text-[12px] text-rose-500">{error}</p>}
          {info && !error && <p className="mt-2 text-[12px] text-muted-foreground">{info}</p>}
        </section>

        {/* results */}
        {results.length > 0 ? (
          <div className="space-y-2.5">
            {results.map((lead) => (
              <div key={lead.placeId} className="rounded-2xl border border-border bg-card p-3.5 sm:p-4">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-[14px] font-bold">{lead.name}</p>
                      {typeof lead.rating === "number" && (
                        <span className="inline-flex items-center gap-1 text-[11.5px] text-amber-500"><Star className="h-3.5 w-3.5 fill-current" /> {lead.rating.toFixed(1)}{lead.reviewCount ? <span className="text-muted-foreground">({lead.reviewCount})</span> : null}</span>
                      )}
                      {lead.businessStatus && lead.businessStatus !== "OPERATIONAL" && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground capitalize">{lead.businessStatus.toLowerCase().replace(/_/g, " ")}</span>}
                    </div>
                    <p className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" /> {lead.address}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                      {lead.phone && <span className="inline-flex items-center gap-1 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {lead.phone}</span>}
                      {lead.website && <a href={lead.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-500 hover:underline"><Globe className="h-3.5 w-3.5" /> Website</a>}
                      <a href={lead.googleMapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /> Maps</a>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <button onClick={() => pitch(lead)} className="inline-flex items-center gap-1.5 rounded-[9px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm"><Send className="h-3.5 w-3.5" /> Pitch</button>
                  <button onClick={() => proposal(lead)} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground"><FileText className="h-3.5 w-3.5" /> Proposal</button>
                  <button onClick={() => addToContacts(lead)} disabled={addingId === lead.placeId || added.has(lead.placeId)} className="inline-flex items-center gap-1.5 rounded-[9px] border border-border px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-70">
                    {added.has(lead.placeId) ? <><Check className="h-3.5 w-3.5 text-emerald-500" /> Added</> : addingId === lead.placeId ? <FlowLoader size={13} /> : <><UserPlus className="h-3.5 w-3.5" /> Add to contacts</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : !searching && (
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/10 text-brand-500"><Sparkles className="h-6 w-6" /></span>
              <p className="mt-3 text-[13.5px] font-semibold">Find your next clients</p>
              <p className="mt-1 text-[12.5px] text-muted-foreground">Search a business type + location above. Then pitch them, write a proposal, or add them to your contacts.</p>
            </div>
          </section>
        )}

        {/* recent searches */}
        {recent.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <h3 className="mb-3 text-[13px] font-bold">Recent searches</h3>
            <div className="flex flex-wrap gap-1.5">
              {recent.map((r) => (
                <button key={r.id} onClick={() => { setQuery(r.query); setLocation(r.location || ""); }} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-[12px] hover:border-brand-500/60 hover:text-foreground">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" /> {r.query}{r.location ? ` · ${r.location}` : ""}{typeof r.resultCount === "number" ? ` (${r.resultCount})` : ""}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
