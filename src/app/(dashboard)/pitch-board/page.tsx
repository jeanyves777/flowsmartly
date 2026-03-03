"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Search,
  Plus,
  Loader2,
  MapPin,
  Globe,
  Phone,
  Mail,
  Star,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  Send,
  Trash2,
  Building2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Pitch {
  id: string;
  businessName: string;
  businessUrl?: string;
  status: "PENDING" | "RESEARCHING" | "READY" | "FAILED" | "SENT";
  recipientEmail?: string;
  recipientName?: string;
  sentAt?: string;
  errorMessage?: string;
  createdAt: string;
}

interface PitchStats {
  total: number;
  ready: number;
  sent: number;
  failed: number;
}

interface BusinessLead {
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  businessStatus?: string;
  types?: string[];
  openNow?: boolean;
  googleMapsUrl?: string;
  placeId?: string;
}

interface LeadSearchResult {
  searchId: string;
  results: BusinessLead[];
  creditsUsed: number;
}

// ── Status badge helper ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Pitch["status"] }) {
  const map = {
    PENDING: { label: "Pending", color: "bg-gray-100 text-gray-600", icon: <Clock className="w-3 h-3" /> },
    RESEARCHING: { label: "Researching…", color: "bg-blue-100 text-blue-700", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    READY: { label: "Ready", color: "bg-green-100 text-green-700", icon: <CheckCircle2 className="w-3 h-3" /> },
    FAILED: { label: "Failed", color: "bg-red-100 text-red-700", icon: <AlertCircle className="w-3 h-3" /> },
    SENT: { label: "Sent", color: "bg-purple-100 text-purple-700", icon: <Send className="w-3 h-3" /> },
  };
  const s = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", s.color)}>
      {s.icon} {s.label}
    </span>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function PitchBoardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"pitches" | "leads">("pitches");

  // Pitches tab state
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [stats, setStats] = useState<PitchStats>({ total: 0, ready: 0, sent: 0, failed: 0 });
  const [isLoadingPitches, setIsLoadingPitches] = useState(true);
  const [userPlan, setUserPlan] = useState<string>("STARTER");
  const [leadSearchCount, setLeadSearchCount] = useState(0);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({ businessName: "", businessUrl: "", recipientEmail: "", recipientName: "" });
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lead Finder tab state
  const [leadQuery, setLeadQuery] = useState("");
  const [leadLocation, setLeadLocation] = useState("");
  const [isSearchingLeads, setIsSearchingLeads] = useState(false);
  const [leadResults, setLeadResults] = useState<BusinessLead[]>([]);
  const [leadSearchId, setLeadSearchId] = useState<string | null>(null);
  const [leadError, setLeadError] = useState("");
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set());
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveListName, setSaveListName] = useState("");
  const [isSavingLeads, setIsSavingLeads] = useState(false);
  const [pastSearches, setPastSearches] = useState<Array<{ id: string; query: string; location?: string; resultCount: number; createdAt: string }>>([]);
  const [showPastSearches, setShowPastSearches] = useState(false);
  const [pitchingLead, setPitchingLead] = useState<number | null>(null);

  // ── Load pitches ─────────────────────────────────────────────────────────────

  const loadPitches = useCallback(async () => {
    try {
      const [pitchRes, creditsRes, searchRes] = await Promise.all([
        fetch("/api/pitch"),
        fetch("/api/user/credits"),
        fetch("/api/leads/search?limit=1"),
      ]);
      const pitchData = await pitchRes.json();
      if (pitchData.success) {
        setPitches(pitchData.data.pitches);
        setStats(pitchData.data.stats);
      }
      if (creditsRes.ok) {
        const creditsData = await creditsRes.json();
        if (creditsData.success) setUserPlan(creditsData.data?.plan || "STARTER");
      }
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.success) setLeadSearchCount(searchData.data?.searches?.length ?? 0);
      }
    } catch { /* ignore */ } finally {
      setIsLoadingPitches(false);
    }
  }, []);

  useEffect(() => {
    loadPitches();
  }, [loadPitches]);

  // Poll for pitches in PENDING/RESEARCHING state
  useEffect(() => {
    const hasActive = pitches.some(p => p.status === "PENDING" || p.status === "RESEARCHING");
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(loadPitches, 5000);
    } else if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [pitches, loadPitches]);

  // Load past searches when lead tab opens
  useEffect(() => {
    if (activeTab === "leads") {
      fetch("/api/leads/search").then(r => r.json()).then(d => {
        if (d.success) setPastSearches(d.data.searches);
      }).catch(() => {});
    }
  }, [activeTab]);

  // ── Create pitch ──────────────────────────────────────────────────────────────

  async function handleCreatePitch(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    if (!createForm.businessName.trim()) { setCreateError("Business name is required."); return; }
    setIsCreating(true);
    try {
      const res = await fetch("/api/pitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!data.success) { setCreateError(data.error?.message || "Failed to create pitch."); return; }
      setShowCreateDialog(false);
      setCreateForm({ businessName: "", businessUrl: "", recipientEmail: "", recipientName: "" });
      loadPitches();
    } catch {
      setCreateError("Network error. Please try again.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeletePitch(id: string) {
    if (!confirm("Delete this pitch? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/pitch/${id}`, { method: "DELETE" });
      loadPitches();
    } finally {
      setDeletingId(null);
    }
  }

  // ── Lead Finder ───────────────────────────────────────────────────────────────

  async function handleLeadSearch(e: React.FormEvent) {
    e.preventDefault();
    setLeadError("");
    if (!leadQuery.trim()) { setLeadError("Enter an industry or keyword."); return; }
    setIsSearchingLeads(true);
    setLeadResults([]);
    setSelectedLeads(new Set());
    try {
      const res = await fetch("/api/leads/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: leadQuery, location: leadLocation, industry: leadQuery }),
      });
      const data: { success: boolean; data?: LeadSearchResult; error?: { message: string } } = await res.json();
      if (!data.success) { setLeadError(data.error?.message || "Search failed."); return; }
      setLeadResults(data.data!.results);
      setLeadSearchId(data.data!.searchId);
      // refresh past searches
      fetch("/api/leads/search").then(r => r.json()).then(d => { if (d.success) setPastSearches(d.data.searches); }).catch(() => {});
    } catch {
      setLeadError("Network error. Please try again.");
    } finally {
      setIsSearchingLeads(false);
    }
  }

  function toggleLead(idx: number) {
    setSelectedLeads(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function toggleAllLeads() {
    if (selectedLeads.size === leadResults.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(leadResults.map((_, i) => i)));
    }
  }

  async function handleSaveToList() {
    if (!saveListName.trim() || !leadSearchId) return;
    setIsSavingLeads(true);
    try {
      const res = await fetch("/api/leads/to-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchId: leadSearchId,
          leadIndices: Array.from(selectedLeads),
          listName: saveListName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowSaveDialog(false);
        setSaveListName("");
        alert(`Saved ${data.data.created} contacts to "${saveListName}"`);
      }
    } finally {
      setIsSavingLeads(false);
    }
  }

  async function handleCreatePitchFromLead(lead: BusinessLead, idx: number) {
    setPitchingLead(idx);
    try {
      const res = await fetch("/api/pitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: lead.name,
          businessUrl: lead.website || "",
          recipientEmail: "",
          recipientName: "",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveTab("pitches");
        loadPitches();
      } else {
        alert(data.error?.message || "Failed to create pitch.");
      }
    } finally {
      setPitchingLead(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  // ── Pricing helpers ───────────────────────────────────────────────────────────
  const isSubscriber = userPlan !== "STARTER";
  const pitchIsFreeRun = !isSubscriber && stats.total === 0;
  const leadIsFreeRun  = !isSubscriber && leadSearchCount === 0;
  const pitchCreditLabel = pitchIsFreeRun
    ? "First pitch is FREE — no credits needed"
    : isSubscriber
      ? "15 credits will be deducted"
      : "500 credits required (free trial used)";
  const leadCreditLabel = leadIsFreeRun
    ? "First search is FREE — no credits needed"
    : isSubscriber
      ? "5 credits per search"
      : "250 credits per search (free trial used)";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Pitch Board</h1>
                <p className="text-sm text-gray-500">AI-powered business development & lead generation</p>
              </div>
            </div>
            {activeTab === "pitches" && (
              <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                <Plus className="w-4 h-4" /> New Pitch
              </Button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-6 -mb-px">
            {(["pitches", "leads"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "pb-3 text-sm font-medium border-b-2 transition-colors capitalize",
                  activeTab === tab
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                )}
              >
                {tab === "pitches" ? "My Pitches" : "Lead Finder"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── My Pitches Tab ──────────────────────────────────────────────── */}
        {activeTab === "pitches" && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total", value: stats.total, color: "text-gray-900" },
                { label: "Ready", value: stats.ready, color: "text-green-600" },
                { label: "Sent", value: stats.sent, color: "text-purple-600" },
                { label: "Failed", value: stats.failed, color: "text-red-600" },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className={cn("text-2xl font-bold", s.color)}>{s.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Pitch list */}
            {isLoadingPitches ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : pitches.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
                <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-700 mb-1">No pitches yet</h3>
                <p className="text-sm text-gray-500 mb-4">Enter a business URL and our AI will research, analyze, and generate a personalized pitch proposal.</p>
                <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                  <Plus className="w-4 h-4" /> Create Your First Pitch
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pitches.map(pitch => (
                  <div
                    key={pitch.id}
                    className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer group relative"
                    onClick={() => router.push(`/pitch-board/${pitch.id}`)}
                  >
                    {/* Delete button */}
                    <button
                      onClick={e => { e.stopPropagation(); handleDeletePitch(pitch.id); }}
                      className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                      disabled={deletingId === pitch.id}
                    >
                      {deletingId === pitch.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>

                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-gray-900 text-sm leading-tight truncate pr-6">{pitch.businessName}</h3>
                        {pitch.businessUrl && (
                          <p className="text-xs text-gray-400 truncate mt-0.5">{pitch.businessUrl}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <StatusBadge status={pitch.status} />
                      <span className="text-xs text-gray-400">
                        {new Date(pitch.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {pitch.status === "FAILED" && pitch.errorMessage && (
                      <p className="text-xs text-red-500 mt-2 line-clamp-2">{pitch.errorMessage}</p>
                    )}
                    {pitch.status === "SENT" && pitch.sentAt && (
                      <p className="text-xs text-purple-500 mt-2">
                        Sent {new Date(pitch.sentAt).toLocaleDateString()}
                        {pitch.recipientEmail && ` · ${pitch.recipientEmail}`}
                      </p>
                    )}
                    {(pitch.status === "PENDING" || pitch.status === "RESEARCHING") && (
                      <p className="text-xs text-blue-500 mt-2">
                        {pitch.status === "PENDING" ? "Queued for research…" : "Analyzing business & crafting pitch…"}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Lead Finder Tab ─────────────────────────────────────────────── */}
        {activeTab === "leads" && (
          <div className="space-y-6">
            {/* Search form */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Find Local Businesses</h2>
              <p className="text-sm text-gray-500 mb-5">Search Google Business listings by industry and location. <span className={leadIsFreeRun ? "text-green-600 font-medium" : ""}>{leadCreditLabel}.</span></p>

              <form onSubmit={handleLeadSearch} className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Industry or keyword (e.g. dental clinic, gym, restaurant)"
                    value={leadQuery}
                    onChange={e => setLeadQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="relative sm:w-56">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Location (e.g. Miami, FL)"
                    value={leadLocation}
                    onChange={e => setLeadLocation(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button type="submit" disabled={isSearchingLeads} className="gap-2 whitespace-nowrap">
                  {isSearchingLeads ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {isSearchingLeads ? "Searching…" : "Search"}
                </Button>
              </form>

              {leadError && (
                <p className="text-sm text-red-600 mt-3 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {leadError}
                </p>
              )}
            </div>

            {/* Results */}
            {leadResults.length > 0 && (
              <div className="space-y-3">
                {/* Bulk actions bar */}
                <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedLeads.size === leadResults.length}
                      onChange={toggleAllLeads}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600"
                    />
                    <span className="text-sm text-gray-600">
                      {selectedLeads.size > 0 ? `${selectedLeads.size} selected` : `${leadResults.length} results`}
                    </span>
                  </div>
                  {selectedLeads.size > 0 && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => setShowSaveDialog(true)}
                      >
                        <Users className="w-3.5 h-3.5" /> Save to Contact List
                      </Button>
                    </div>
                  )}
                </div>

                {leadResults.map((lead, idx) => (
                  <div key={idx} className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedLeads.has(idx)}
                        onChange={() => toggleLead(idx)}
                        className="w-4 h-4 mt-1 rounded border-gray-300 text-blue-600 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <h3 className="font-semibold text-gray-900">{lead.name}</h3>
                            {lead.rating !== undefined && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                                <span className="text-sm font-medium text-gray-700">{lead.rating}</span>
                                {lead.reviewCount !== undefined && (
                                  <span className="text-xs text-gray-400">({lead.reviewCount} reviews)</span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            {lead.googleMapsUrl && (
                              <a
                                href={lead.googleMapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"
                                onClick={e => e.stopPropagation()}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <Button
                              size="sm"
                              className="gap-1.5 h-8"
                              disabled={pitchingLead === idx}
                              onClick={() => handleCreatePitchFromLead(lead, idx)}
                            >
                              {pitchingLead === idx
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Briefcase className="w-3.5 h-3.5" />
                              }
                              {pitchingLead === idx ? "Creating…" : "Create Pitch"}
                            </Button>
                          </div>
                        </div>

                        <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm text-gray-600">
                          {lead.address && (
                            <div className="flex items-start gap-1.5">
                              <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400" />
                              <span>{lead.address}</span>
                            </div>
                          )}
                          {lead.phone && (
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                              <a href={`tel:${lead.phone}`} className="hover:text-blue-600">{lead.phone}</a>
                            </div>
                          )}
                          {lead.website && (
                            <div className="flex items-center gap-1.5">
                              <Globe className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                              <a
                                href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-blue-600 truncate"
                              >
                                {lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                              </a>
                            </div>
                          )}
                          {lead.businessStatus && lead.businessStatus !== "OPERATIONAL" && (
                            <div className="flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
                              <span className="capitalize text-amber-600">{lead.businessStatus.toLowerCase().replace(/_/g, " ")}</span>
                            </div>
                          )}
                        </div>

                        {lead.types && lead.types.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2.5">
                            {lead.types.slice(0, 4).map(t => (
                              <span key={t} className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs capitalize">
                                {t.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Past searches */}
            {pastSearches.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setShowPastSearches(v => !v)}
                  className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span>Past Searches ({pastSearches.length})</span>
                  {showPastSearches ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showPastSearches && (
                  <div className="border-t border-gray-100 divide-y divide-gray-100">
                    {pastSearches.map(s => (
                      <div key={s.id} className="px-5 py-3 flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium text-gray-800">{s.query}</span>
                          {s.location && <span className="text-gray-500"> · {s.location}</span>}
                          <span className="text-gray-400 ml-2">{s.resultCount} results</span>
                        </div>
                        <span className="text-gray-400 text-xs">{new Date(s.createdAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Create Pitch Dialog ──────────────────────────────────────────────── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-blue-600" /> Create AI Pitch
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreatePitch} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="businessName">Business Name <span className="text-red-500">*</span></Label>
              <Input
                id="businessName"
                placeholder="e.g. Miami Dental Studio"
                value={createForm.businessName}
                onChange={e => setCreateForm(f => ({ ...f, businessName: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="businessUrl">Website URL</Label>
              <Input
                id="businessUrl"
                placeholder="https://example.com"
                value={createForm.businessUrl}
                onChange={e => setCreateForm(f => ({ ...f, businessUrl: e.target.value }))}
              />
              <p className="text-xs text-gray-500">Our AI will analyze the website to personalize the pitch.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="recipientName">Recipient Name</Label>
                <Input
                  id="recipientName"
                  placeholder="John Smith"
                  value={createForm.recipientName}
                  onChange={e => setCreateForm(f => ({ ...f, recipientName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recipientEmail">Recipient Email</Label>
                <Input
                  id="recipientEmail"
                  type="email"
                  placeholder="owner@business.com"
                  value={createForm.recipientEmail}
                  onChange={e => setCreateForm(f => ({ ...f, recipientEmail: e.target.value }))}
                />
              </div>
            </div>

            <div className={cn("rounded-lg px-4 py-3 text-sm", pitchIsFreeRun ? "bg-green-50 border border-green-100 text-green-700" : "bg-blue-50 border border-blue-100 text-blue-700")}>
              {pitchCreditLabel}. AI will research the business and generate a personalized pitch proposal.
            </div>

            {createError && (
              <p className="text-sm text-red-600 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {createError}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={isCreating} className="gap-2">
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Briefcase className="w-4 h-4" />}
                {isCreating ? "Creating…" : "Start Research"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Save to List Dialog ──────────────────────────────────────────────── */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" /> Save to Contact List
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-gray-600">
              {selectedLeads.size} lead{selectedLeads.size !== 1 ? "s" : ""} will be saved as contacts.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="listName">New List Name</Label>
              <Input
                id="listName"
                placeholder="e.g. Miami Dental Prospects"
                value={saveListName}
                onChange={e => setSaveListName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Cancel</Button>
              <Button disabled={!saveListName.trim() || isSavingLeads} onClick={handleSaveToList} className="gap-2">
                {isSavingLeads ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                {isSavingLeads ? "Saving…" : "Save Contacts"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
