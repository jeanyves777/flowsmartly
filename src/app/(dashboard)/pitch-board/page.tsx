"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  MapPin,
  Phone,
  Plus,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
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
import { AIGenerationLoader, FlowActionSpinner } from "@/components/shared/ai-generation-loader";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/hooks/use-toast";

type TabKey = "proposals" | "pitches" | "leads";

interface Pitch {
  id: string;
  businessName: string;
  businessUrl?: string;
  status: "PENDING" | "RESEARCHING" | "READY" | "FAILED" | "SENT";
  recipientEmail?: string;
  recipientName?: string;
  sentAt?: string;
  errorMessage?: string;
  documentType?: "pitch" | "service_proposal";
  createdAt: string;
}

interface PitchStats {
  total: number;
  ready: number;
  sent: number;
  failed: number;
  proposals?: number;
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
  googleMapsUrl?: string;
}

interface LeadSearchResult {
  searchId: string;
  results: BusinessLead[];
  creditsUsed: number;
}

const PROPOSAL_PRESETS = [
  {
    value: "google-business-profile",
    label: "Google Profile Growth",
    serviceTitle: "Google Business Profile Optimization",
    serviceDescription:
      "Optimize Google Business Profile visibility, weekly posts, reputation management, citations, geotagging, reporting, and conversion tracking.",
    price: "199",
    originalPrice: "399",
    interval: "month",
  },
  {
    value: "website-redesign",
    label: "Website Redesign",
    serviceTitle: "Website Redesign and SEO Foundation",
    serviceDescription:
      "Modern website redesign, mobile-friendly pages, SEO-friendly structure, conversion sections, tracking, and launch support.",
    price: "999",
    originalPrice: "1999",
    interval: "project",
  },
  {
    value: "local-seo",
    label: "Local SEO",
    serviceTitle: "Local SEO Growth Campaign",
    serviceDescription:
      "Local search strategy, citation building, keyword pages, review improvement, reporting, and monthly optimization.",
    price: "499",
    originalPrice: "899",
    interval: "month",
  },
  {
    value: "custom",
    label: "Custom",
    serviceTitle: "",
    serviceDescription: "",
    price: "",
    originalPrice: "",
    interval: "project",
  },
] as const;

interface ProposalFormState {
  targetName: string;
  targetWebsite: string;
  recipientName: string;
  recipientEmail: string;
  preset: string;
  serviceTitle: string;
  serviceDescription: string;
  goals: string;
  price: string;
  originalPrice: string;
  billingInterval: string;
  terms: string;
}

function StatusBadge({ status }: { status: Pitch["status"] }) {
  const map = {
    PENDING: { label: "Queued", cls: "bg-muted text-muted-foreground", icon: <Clock className="h-3 w-3" /> },
    RESEARCHING: { label: "Researching", cls: "bg-sky-500/10 text-sky-700 dark:text-sky-300", icon: <FlowActionSpinner size={13} /> },
    READY: { label: "Ready", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", icon: <CheckCircle2 className="h-3 w-3" /> },
    FAILED: { label: "Failed", cls: "bg-red-500/10 text-red-700 dark:text-red-300", icon: <AlertCircle className="h-3 w-3" /> },
    SENT: { label: "Sent", cls: "bg-violet-500/10 text-violet-700 dark:text-violet-300", icon: <Send className="h-3 w-3" /> },
  } satisfies Record<Pitch["status"], { label: string; cls: string; icon: ReactNode }>;
  const item = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", item.cls)}>
      {item.icon}
      {item.label}
    </span>
  );
}

function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
        {icon}
      </div>
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export default function PitchBoardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("proposals");
  const [hasBrand, setHasBrand] = useState<boolean | null>(null);
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [stats, setStats] = useState<PitchStats>({ total: 0, ready: 0, sent: 0, failed: 0, proposals: 0 });
  const [isLoadingPitches, setIsLoadingPitches] = useState(true);
  const [userPlan, setUserPlan] = useState("STARTER");
  const [leadSearchCount, setLeadSearchCount] = useState(0);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({ businessName: "", businessUrl: "", recipientEmail: "", recipientName: "" });
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [proposalForm, setProposalForm] = useState<ProposalFormState>({
    targetName: "",
    targetWebsite: "",
    recipientName: "",
    recipientEmail: "",
    preset: "google-business-profile",
    serviceTitle: PROPOSAL_PRESETS[0].serviceTitle,
    serviceDescription: PROPOSAL_PRESETS[0].serviceDescription,
    goals: "",
    price: PROPOSAL_PRESETS[0].price,
    originalPrice: PROPOSAL_PRESETS[0].originalPrice,
    billingInterval: PROPOSAL_PRESETS[0].interval,
    terms: "",
  });
  const [isCreatingProposal, setIsCreatingProposal] = useState(false);
  const [proposalError, setProposalError] = useState("");

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
  const [pitchingLead, setPitchingLead] = useState<number | null>(null);

  const proposals = useMemo(() => pitches.filter((p) => p.documentType === "service_proposal"), [pitches]);
  const outreachPitches = useMemo(() => pitches.filter((p) => p.documentType !== "service_proposal"), [pitches]);

  const isSubscriber = userPlan !== "STARTER";
  const pitchIsFreeRun = !isSubscriber && stats.total === 0;
  const leadIsFreeRun = !isSubscriber && leadSearchCount === 0;
  const pitchCreditLabel = pitchIsFreeRun
    ? "First pitch is free"
    : isSubscriber
      ? "15 credits"
      : "500 credits";
  const leadCreditLabel = leadIsFreeRun ? "First search is free" : isSubscriber ? "5 credits" : "250 credits";

  const loadPitches = useCallback(async () => {
    try {
      const [pitchRes, creditsRes, searchRes, brandRes] = await Promise.all([
        fetch("/api/pitch"),
        fetch("/api/user/credits"),
        fetch("/api/leads/search?limit=1"),
        fetch("/api/brand"),
      ]);
      const pitchData = await pitchRes.json();
      if (pitchData.success) {
        setPitches(pitchData.data.pitches || []);
        setStats(pitchData.data.stats || { total: 0, ready: 0, sent: 0, failed: 0, proposals: 0 });
      }
      if (creditsRes.ok) {
        const creditsData = await creditsRes.json();
        if (creditsData.success) setUserPlan(creditsData.data?.plan || "STARTER");
      }
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.success) setLeadSearchCount(searchData.data?.searches?.length ?? 0);
      }
      if (brandRes.ok) {
        const brandData = await brandRes.json();
        setHasBrand(!!brandData.data?.brandKit?.name);
      } else {
        setHasBrand(false);
      }
    } finally {
      setIsLoadingPitches(false);
    }
  }, []);

  useEffect(() => {
    loadPitches();
  }, [loadPitches]);

  useEffect(() => {
    const hasActive = pitches.some((p) => p.status === "PENDING" || p.status === "RESEARCHING");
    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(loadPitches, 5000);
    }
    if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [pitches, loadPitches]);

  function applyPreset(value: string) {
    const preset = PROPOSAL_PRESETS.find((item) => item.value === value) || PROPOSAL_PRESETS[0];
    setProposalForm((form) => ({
      ...form,
      preset: preset.value,
      serviceTitle: preset.serviceTitle || form.serviceTitle,
      serviceDescription: preset.serviceDescription || form.serviceDescription,
      price: preset.price,
      originalPrice: preset.originalPrice,
      billingInterval: preset.interval,
    }));
  }

  async function handleCreateProposal(e: React.FormEvent) {
    e.preventDefault();
    setProposalError("");
    if (!proposalForm.targetName.trim() || !proposalForm.serviceTitle.trim() || !proposalForm.serviceDescription.trim()) {
      setProposalError("Target client, service title, and service details are required.");
      return;
    }
    setIsCreatingProposal(true);
    try {
      const res = await fetch("/api/pitch/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proposalForm),
      });
      const data = await res.json();
      if (!data.success) {
        if (data.error?.code === "BRAND_IDENTITY_REQUIRED") setHasBrand(false);
        setProposalError(data.error?.message || "Failed to generate proposal.");
        return;
      }
      toast({ title: "Proposal ready", description: "Your branded proposal PDF is ready to review." });
      router.push(`/pitch-board/${data.data.id}`);
    } catch {
      setProposalError("Network error. Please try again.");
    } finally {
      setIsCreatingProposal(false);
    }
  }

  async function handleCreatePitch(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    if (!createForm.businessName.trim()) {
      setCreateError("Business name is required.");
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch("/api/pitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!data.success) {
        if (data.error?.code === "BRAND_IDENTITY_REQUIRED") {
          setShowCreateDialog(false);
          setHasBrand(false);
        } else {
          setCreateError(data.error?.message || "Failed to create pitch.");
        }
        return;
      }
      setShowCreateDialog(false);
      setCreateForm({ businessName: "", businessUrl: "", recipientEmail: "", recipientName: "" });
      loadPitches();
      setActiveTab("pitches");
    } catch {
      setCreateError("Network error. Please try again.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeletePitch(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/pitch/${id}`, { method: "DELETE" });
      loadPitches();
    } finally {
      setDeletingId(null);
    }
  }

  async function handleLeadSearch(e: React.FormEvent) {
    e.preventDefault();
    setLeadError("");
    if (!leadQuery.trim()) {
      setLeadError("Enter an industry or keyword.");
      return;
    }
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
      if (!data.success) {
        setLeadError(data.error?.message || "Search failed.");
        return;
      }
      setLeadResults(data.data?.results || []);
      setLeadSearchId(data.data?.searchId || null);
    } catch {
      setLeadError("Network error. Please try again.");
    } finally {
      setIsSearchingLeads(false);
    }
  }

  async function handleSaveToList() {
    if (!saveListName.trim() || !leadSearchId) return;
    setIsSavingLeads(true);
    try {
      const res = await fetch("/api/leads/to-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchId: leadSearchId, leadIndices: Array.from(selectedLeads), listName: saveListName }),
      });
      const data = await res.json();
      if (data.success) {
        setShowSaveDialog(false);
        setSaveListName("");
        toast({ title: "Contacts saved", description: `${data.data.created} contacts added.` });
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
        body: JSON.stringify({ businessName: lead.name, businessUrl: lead.website || "" }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveTab("pitches");
        loadPitches();
      } else {
        toast({ variant: "destructive", title: "Failed to create pitch", description: data.error?.message });
      }
    } finally {
      setPitchingLead(null);
    }
  }

  const renderPitchCard = (pitch: Pitch) => (
    <div
      key={pitch.id}
      className="group relative cursor-pointer rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-md"
      onClick={() => router.push(`/pitch-board/${pitch.id}`)}
    >
      <button
        onClick={(event) => {
          event.stopPropagation();
          handleDeletePitch(pitch.id);
        }}
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground opacity-0 transition-all hover:bg-red-500/10 hover:text-red-500 group-hover:opacity-100"
        aria-label={`Delete ${pitch.businessName}`}
      >
        {deletingId === pitch.id ? <FlowActionSpinner size={14} /> : <Trash2 className="h-3.5 w-3.5" />}
      </button>
      <div className="flex items-start gap-3 pr-8">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md", pitch.documentType === "service_proposal" ? "bg-violet-500/10 text-violet-600" : "bg-sky-500/10 text-sky-600")}>
          {pitch.documentType === "service_proposal" ? <FileText className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">{pitch.businessName}</span>
          {pitch.businessUrl && <span className="block truncate text-xs text-muted-foreground">{pitch.businessUrl}</span>}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <StatusBadge status={pitch.status} />
        <span className="text-xs text-muted-foreground">{new Date(pitch.createdAt).toLocaleDateString()}</span>
      </div>
      {pitch.status === "FAILED" && pitch.errorMessage && (
        <p className="mt-2 line-clamp-2 text-xs text-red-500">{pitch.errorMessage}</p>
      )}
    </div>
  );

  return (
    <div className="flex-1">
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <Badge variant="secondary" className="mb-3 gap-1">
                <Sparkles className="h-3.5 w-3.5 text-sky-500" />
                AI deal workspace
              </Badge>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Pitch Board</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Build proposals, research prospects, and send branded PDFs from one workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setActiveTab("leads")}>
                <Search className="h-4 w-4" />
                Find Leads
              </Button>
              <Button onClick={() => setActiveTab("proposals")} disabled={hasBrand === false}>
                <FileText className="h-4 w-4" />
                Proposal
              </Button>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              { id: "proposals", label: "Proposal", icon: FileText },
              { id: "pitches", label: "Pitches", icon: Briefcase },
              { id: "leads", label: "Leads", icon: Users },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabKey)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    activeTab === tab.id
                      ? "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300"
                      : "border-border bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {hasBrand === false && (
        <div className="border-b border-amber-500/20 bg-amber-500/10">
          <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 sm:px-6 lg:px-8">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span className="flex-1">Brand identity is required before proposals or pitches can use your services, logo, and colors.</span>
            <a href="/brand" className="font-semibold underline underline-offset-2">Set up Brand</a>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        {activeTab === "proposals" && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(380px,0.48fr)]">
            <form onSubmit={handleCreateProposal} className="rounded-lg border border-sky-200 bg-sky-50/70 p-5 dark:border-sky-900/60 dark:bg-sky-950/20">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Proposal agent</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Use your brand identity and a preset to produce a client-ready PDF.</p>
                </div>
                <Badge variant="secondary">35 credits</Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Target client</Label>
                  <Input value={proposalForm.targetName} onChange={(e) => setProposalForm((f) => ({ ...f, targetName: e.target.value }))} placeholder="ABC Dental Studio" />
                </div>
                <div className="space-y-1.5">
                  <Label>Target website</Label>
                  <Input value={proposalForm.targetWebsite} onChange={(e) => setProposalForm((f) => ({ ...f, targetWebsite: e.target.value }))} placeholder="https://client.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Recipient name</Label>
                  <Input value={proposalForm.recipientName} onChange={(e) => setProposalForm((f) => ({ ...f, recipientName: e.target.value }))} placeholder="Owner or manager" />
                </div>
                <div className="space-y-1.5">
                  <Label>Recipient email</Label>
                  <Input type="email" value={proposalForm.recipientEmail} onChange={(e) => setProposalForm((f) => ({ ...f, recipientEmail: e.target.value }))} placeholder="owner@client.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Preset</Label>
                  <select
                    value={proposalForm.preset}
                    onChange={(e) => applyPreset(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {PROPOSAL_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>{preset.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Service package</Label>
                  <Input value={proposalForm.serviceTitle} onChange={(e) => setProposalForm((f) => ({ ...f, serviceTitle: e.target.value }))} placeholder="Google Business Profile Optimization" />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Service details</Label>
                  <Textarea rows={4} value={proposalForm.serviceDescription} onChange={(e) => setProposalForm((f) => ({ ...f, serviceDescription: e.target.value }))} placeholder="Define what the service includes, what outcome you want, and how you deliver it." />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Client goal</Label>
                  <Textarea rows={2} value={proposalForm.goals} onChange={(e) => setProposalForm((f) => ({ ...f, goals: e.target.value }))} placeholder="Increase local calls, improve profile ranking, launch a new website, book more appointments..." />
                </div>
                <div className="grid grid-cols-3 gap-3 md:col-span-2">
                  <div className="space-y-1.5">
                    <Label>Price</Label>
                    <Input type="number" value={proposalForm.price} onChange={(e) => setProposalForm((f) => ({ ...f, price: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Original</Label>
                    <Input type="number" value={proposalForm.originalPrice} onChange={(e) => setProposalForm((f) => ({ ...f, originalPrice: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Interval</Label>
                    <Input value={proposalForm.billingInterval} onChange={(e) => setProposalForm((f) => ({ ...f, billingInterval: e.target.value }))} placeholder="month" />
                  </div>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Terms note</Label>
                  <Textarea rows={2} value={proposalForm.terms} onChange={(e) => setProposalForm((f) => ({ ...f, terms: e.target.value }))} placeholder="No contract, activation call in 24-48 hours, cancellation notice, upfront monthly billing..." />
                </div>
              </div>

              {proposalError && (
                <p className="mt-4 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  {proposalError}
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={isCreatingProposal || hasBrand === false}>
                  {isCreatingProposal ? <FlowActionSpinner size={16} /> : <Sparkles className="h-4 w-4" />}
                  {isCreatingProposal ? "Generating" : "Generate Proposal"}
                </Button>
                <p className="text-xs text-muted-foreground">Creates a proposal record with a downloadable PDF.</p>
              </div>
            </form>

            <div className="space-y-4">
              {isCreatingProposal && (
                <AIGenerationLoader
                  compact
                  currentStep="Building proposal"
                  subtitle="Using your brand, offer, terms, and selected preset"
                  className="border border-violet-200 dark:border-violet-900/60"
                />
              )}

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Proposals", value: proposals.length, icon: FileText, tone: "text-violet-700 bg-violet-50 dark:text-violet-300 dark:bg-violet-950/30" },
                  { label: "Ready", value: stats.ready, icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/30" },
                  { label: "Sent", value: stats.sent, icon: Send, tone: "text-sky-700 bg-sky-50 dark:text-sky-300 dark:bg-sky-950/30" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-lg border border-border bg-card p-3">
                      <span className={cn("mb-2 flex h-8 w-8 items-center justify-center rounded-md", item.tone)}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="text-xl font-bold text-foreground">{item.value}</div>
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                    </div>
                  );
                })}
              </div>

              {isLoadingPitches ? (
                <AIGenerationLoader compact currentStep="Loading proposals" />
              ) : proposals.length === 0 ? (
                <EmptyState
                  icon={<FileText className="h-6 w-6" />}
                  title="No proposals yet"
                  text="Generate your first branded service proposal from the form."
                />
              ) : (
                <div className="grid gap-3">{proposals.map(renderPitchCard)}</div>
              )}
            </div>
          </div>
        )}

        {activeTab === "pitches" && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-foreground">AI outreach pitches</h2>
                <p className="text-sm text-muted-foreground">Research a business and generate a personalized pitch.</p>
              </div>
              <Button onClick={() => setShowCreateDialog(true)} disabled={hasBrand === false}>
                <Plus className="h-4 w-4" />
                New Pitch
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Total", value: outreachPitches.length },
                { label: "Ready", value: outreachPitches.filter((p) => p.status === "READY").length },
                { label: "Sent", value: outreachPitches.filter((p) => p.status === "SENT").length },
                { label: "Failed", value: outreachPitches.filter((p) => p.status === "FAILED").length },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-border bg-card p-4">
                  <div className="text-2xl font-bold text-foreground">{item.value}</div>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>
            {isLoadingPitches ? (
              <AIGenerationLoader compact currentStep="Loading pitches" />
            ) : outreachPitches.length === 0 ? (
              <EmptyState
                icon={<Briefcase className="h-6 w-6" />}
                title="No pitches yet"
                text={`Create an AI-researched pitch. ${pitchCreditLabel}.`}
                action={<Button onClick={() => setShowCreateDialog(true)} disabled={hasBrand === false}><Plus className="h-4 w-4" />Create Pitch</Button>}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{outreachPitches.map(renderPitchCard)}</div>
            )}
          </div>
        )}

        {activeTab === "leads" && (
          <div className="space-y-5">
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Lead finder</h2>
                  <p className="text-sm text-muted-foreground">Search local businesses and create pitches from qualified leads.</p>
                </div>
                <Badge variant="secondary">{leadCreditLabel}</Badge>
              </div>
              <form onSubmit={handleLeadSearch} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px_auto]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" value={leadQuery} onChange={(e) => setLeadQuery(e.target.value)} placeholder="Dental clinic, gym, restaurant..." />
                </div>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" value={leadLocation} onChange={(e) => setLeadLocation(e.target.value)} placeholder="Miami, FL" />
                </div>
                <Button type="submit" disabled={isSearchingLeads}>
                  {isSearchingLeads ? <FlowActionSpinner size={16} /> : <Search className="h-4 w-4" />}
                  {isSearchingLeads ? "Searching" : "Search"}
                </Button>
              </form>
              {leadError && <p className="mt-3 flex items-center gap-2 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{leadError}</p>}
            </div>

            {isSearchingLeads && (
              <AIGenerationLoader compact currentStep="Searching businesses" subtitle="Finding leads and public profile signals" />
            )}

            {leadResults.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={selectedLeads.size === leadResults.length}
                      onChange={() => setSelectedLeads(selectedLeads.size === leadResults.length ? new Set() : new Set(leadResults.map((_, i) => i)))}
                      className="h-4 w-4"
                    />
                    {selectedLeads.size > 0 ? `${selectedLeads.size} selected` : `${leadResults.length} results`}
                  </label>
                  {selectedLeads.size > 0 && (
                    <Button size="sm" variant="outline" onClick={() => setShowSaveDialog(true)}>
                      <Users className="h-4 w-4" />
                      Save Contacts
                    </Button>
                  )}
                </div>
                <div className="space-y-3">
                  {leadResults.map((lead, idx) => (
                    <div key={`${lead.name}-${idx}`} className="rounded-md border border-border p-4">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedLeads.has(idx)}
                          onChange={() => {
                            setSelectedLeads((prev) => {
                              const next = new Set(prev);
                              if (next.has(idx)) next.delete(idx);
                              else next.add(idx);
                              return next;
                            });
                          }}
                          className="mt-1 h-4 w-4"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="font-semibold text-foreground">{lead.name}</h3>
                              {lead.rating !== undefined && (
                                <div className="mt-1 flex items-center gap-1 text-sm">
                                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                  <span className="font-medium">{lead.rating}</span>
                                  {lead.reviewCount !== undefined && <span className="text-muted-foreground">({lead.reviewCount})</span>}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2">
                              {lead.googleMapsUrl && (
                                <Button size="sm" variant="outline" asChild>
                                  <a href={lead.googleMapsUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                                </Button>
                              )}
                              <Button size="sm" disabled={pitchingLead === idx} onClick={() => handleCreatePitchFromLead(lead, idx)}>
                                {pitchingLead === idx ? <FlowActionSpinner size={14} /> : <Briefcase className="h-4 w-4" />}
                                Pitch
                              </Button>
                            </div>
                          </div>
                          <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                            {lead.address && <span className="flex gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{lead.address}</span>}
                            {lead.phone && <span className="flex gap-2"><Phone className="mt-0.5 h-3.5 w-3.5 shrink-0" />{lead.phone}</span>}
                            {lead.website && <span className="flex gap-2"><Globe className="mt-0.5 h-3.5 w-3.5 shrink-0" />{lead.website}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-sky-600" />Create AI Pitch</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreatePitch} className="mt-2 space-y-4">
            <div className="space-y-1.5">
              <Label>Business name</Label>
              <Input value={createForm.businessName} onChange={(e) => setCreateForm((f) => ({ ...f, businessName: e.target.value }))} placeholder="Miami Dental Studio" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input value={createForm.businessUrl} onChange={(e) => setCreateForm((f) => ({ ...f, businessUrl: e.target.value }))} placeholder="https://example.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Recipient</Label>
                <Input value={createForm.recipientName} onChange={(e) => setCreateForm((f) => ({ ...f, recipientName: e.target.value }))} placeholder="John Smith" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={createForm.recipientEmail} onChange={(e) => setCreateForm((f) => ({ ...f, recipientEmail: e.target.value }))} placeholder="owner@business.com" />
              </div>
            </div>
            <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300">
              {pitchCreditLabel}. AI researches the business and generates a pitch.
            </div>
            {createError && <p className="flex items-center gap-2 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{createError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? <FlowActionSpinner size={16} /> : <Briefcase className="h-4 w-4" />}
                {isCreating ? "Creating" : "Start"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-sky-600" />Save contacts</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <p className="text-sm text-muted-foreground">{selectedLeads.size} lead{selectedLeads.size === 1 ? "" : "s"} will be saved.</p>
            <div className="space-y-1.5">
              <Label>List name</Label>
              <Input value={saveListName} onChange={(e) => setSaveListName(e.target.value)} placeholder="Miami Dental Prospects" autoFocus />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Cancel</Button>
              <Button disabled={!saveListName.trim() || isSavingLeads} onClick={handleSaveToList}>
                {isSavingLeads ? <FlowActionSpinner size={16} /> : <Users className="h-4 w-4" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
