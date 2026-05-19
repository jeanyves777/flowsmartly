"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
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
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Users,
  Wand2,
  X,
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

type TabKey = "proposal" | "pitch" | "leads";

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
  placeId?: string;
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

interface BrandKitSummary {
  name?: string;
  description?: string;
  industry?: string;
  niche?: string;
  uniqueValue?: string;
  products?: string[];
}

type LeadActionMode = "proposal" | "pitch";

interface LeadActionState {
  mode: LeadActionMode;
  lead: BusinessLead;
  index: number;
}

interface LeadOfferFormState {
  preset: string;
  proposalTypes: string[];
  selectedServices: string[];
  customAdditions: string[];
  serviceTitle: string;
  serviceDescription: string;
  goals: string;
  price: string;
  originalPrice: string;
  billingInterval: string;
  terms: string;
}

interface LeadSearchResult {
  searchId: string;
  results: BusinessLead[];
  creditsUsed: number;
}

const PROPOSAL_PRESETS = [
  { value: "google-business-profile", label: "Google Profile" },
  { value: "website-redesign", label: "Website" },
  { value: "local-seo", label: "Local SEO" },
  { value: "custom", label: "Custom" },
] as const;

const PROPOSAL_EXAMPLES = [
  "Create a polished $199/month Google Business Profile optimization proposal for ABC Dental Studio. Include weekly posts, review improvement, citations, local ranking, reporting, no long-term contract, and a $399 original promotional comparison.",
  "Build a website redesign proposal for a restaurant that needs online reservations, mobile menu, SEO pages, tracking, and a launch plan. Price it as a $999 project with a $1,999 original value.",
  "Create a local SEO growth proposal for a law firm. Focus on local rankings, service-area pages, reputation, citations, and monthly reporting.",
];

const PITCH_EXAMPLES = [
  "Research Miami Dental Studio and create a short outreach pitch showing where their online presence can improve. If you find their website, use it.",
  "Create a pitch for a local gym that needs more memberships, better Google visibility, and stronger lead capture.",
  "Research a restaurant prospect and write a pitch for website, reviews, and local SEO improvement.",
];

interface ProposalFormState {
  targetName: string;
  targetWebsite: string;
  recipientName: string;
  recipientEmail: string;
  preset: string;
  proposalTypes: string[];
  selectedServices: string[];
  customAdditions: string[];
  serviceTitle: string;
  serviceDescription: string;
  goals: string;
  price: string;
  originalPrice: string;
  billingInterval: string;
  terms: string;
}

interface PitchFormState {
  businessName: string;
  businessUrl: string;
  recipientName: string;
  recipientEmail: string;
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

function leadGoogleSummary(lead: BusinessLead): string {
  const parts = [
    lead.rating !== undefined ? `${lead.rating}/5 Google rating` : "",
    lead.reviewCount !== undefined ? `${lead.reviewCount.toLocaleString()} reviews` : "",
    lead.address || "",
    lead.types?.slice(0, 2).join(", ") || "",
  ].filter(Boolean);
  return parts.join(" | ");
}

function defaultLeadOfferForm(lead: BusinessLead, brandKit: BrandKitSummary | null): LeadOfferFormState {
  const firstService = brandKit?.products?.find(Boolean) || "";
  const serviceTitle = firstService || "Local Growth Proposal";
  const brandDetail = [brandKit?.description, brandKit?.uniqueValue].filter(Boolean).join(" ");
  return {
    preset: "google-business-profile",
    proposalTypes: ["google-business-profile"],
    selectedServices: firstService ? [firstService] : [],
    customAdditions: [],
    serviceTitle,
    serviceDescription:
      brandDetail ||
      "Google Business Profile optimization, local SEO, review improvement, website conversion, tracking, and monthly reporting.",
    goals: `Help ${lead.name} attract more local customers, improve trust signals, and convert more visitors into inquiries.`,
    price: "",
    originalPrice: "",
    billingInterval: "month",
    terms: "Month-to-month service. Setup begins after access and onboarding details are confirmed.",
  };
}

function toggleArrayValue(values: string[], value: string, allowEmpty = true): string[] {
  const exists = values.includes(value);
  if (exists) {
    const next = values.filter((item) => item !== value);
    return !allowEmpty && next.length === 0 ? values : next;
  }
  return [...values, value];
}

function firstProposalPreset(types: string[], fallback: string): string {
  return types.find((type) => PROPOSAL_PRESETS.some((preset) => preset.value === type)) || fallback || "custom";
}

function serviceSummary(selectedServices: string[], customAdditions: string[], fallback: string): string {
  const items = [...selectedServices, ...customAdditions].map((item) => item.trim()).filter(Boolean);
  if (items.length === 0) return fallback;
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} + ${items[1]}`;
  return `${items.slice(0, 2).join(", ")} + ${items.length - 2} more`;
}

function combinedServiceDetails(base: string, selectedServices: string[], customAdditions: string[], proposalTypes: string[]): string {
  const lines = [
    base.trim(),
    selectedServices.length ? `Selected services: ${selectedServices.join(", ")}` : "",
    customAdditions.length ? `Custom additions: ${customAdditions.join("; ")}` : "",
    proposalTypes.length ? `Proposal types to combine: ${proposalTypes.join(", ")}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

export default function PitchBoardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("proposal");
  const [hasBrand, setHasBrand] = useState<boolean | null>(null);
  const [brandKit, setBrandKit] = useState<BrandKitSummary | null>(null);
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [stats, setStats] = useState<PitchStats>({ total: 0, ready: 0, sent: 0, failed: 0, proposals: 0 });
  const [isLoadingPitches, setIsLoadingPitches] = useState(true);
  const [userPlan, setUserPlan] = useState("STARTER");
  const [leadSearchCount, setLeadSearchCount] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [proposalBrief, setProposalBrief] = useState(PROPOSAL_EXAMPLES[0]);
  const [proposalForm, setProposalForm] = useState<ProposalFormState>({
    targetName: "",
    targetWebsite: "",
    recipientName: "",
    recipientEmail: "",
    preset: "google-business-profile",
    proposalTypes: ["google-business-profile"],
    selectedServices: [],
    customAdditions: [],
    serviceTitle: "",
    serviceDescription: "",
    goals: "",
    price: "",
    originalPrice: "",
    billingInterval: "",
    terms: "",
  });
  const [showProposalTuning, setShowProposalTuning] = useState(false);
  const [isCreatingProposal, setIsCreatingProposal] = useState(false);
  const [proposalError, setProposalError] = useState("");
  const [proposalCustomAdditionDraft, setProposalCustomAdditionDraft] = useState("");

  const [pitchBrief, setPitchBrief] = useState(PITCH_EXAMPLES[0]);
  const [pitchForm, setPitchForm] = useState<PitchFormState>({
    businessName: "",
    businessUrl: "",
    recipientName: "",
    recipientEmail: "",
  });
  const [showPitchTuning, setShowPitchTuning] = useState(false);
  const [isCreatingPitch, setIsCreatingPitch] = useState(false);
  const [pitchError, setPitchError] = useState("");

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
  const [proposingLead, setProposingLead] = useState<number | null>(null);
  const [leadAction, setLeadAction] = useState<LeadActionState | null>(null);
  const [leadOfferForm, setLeadOfferForm] = useState<LeadOfferFormState | null>(null);
  const [leadActionError, setLeadActionError] = useState("");
  const [leadCustomAdditionDraft, setLeadCustomAdditionDraft] = useState("");

  const proposals = useMemo(() => pitches.filter((p) => p.documentType === "service_proposal"), [pitches]);
  const outreachPitches = useMemo(() => pitches.filter((p) => p.documentType !== "service_proposal"), [pitches]);
  const brandServiceOptions = useMemo(
    () => (brandKit?.products || []).map((item) => String(item || "").trim()).filter(Boolean).slice(0, 8),
    [brandKit],
  );

  const isSubscriber = userPlan !== "STARTER";
  const pitchIsFreeRun = !isSubscriber && stats.total === 0;
  const leadIsFreeRun = !isSubscriber && leadSearchCount === 0;
  const pitchCreditLabel = pitchIsFreeRun ? "Free first pitch" : isSubscriber ? "15 credits" : "500 credits";
  const leadCreditLabel = leadIsFreeRun ? "Free first search" : isSubscriber ? "5 credits" : "250 credits";

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
        const kit = brandData.data?.brandKit || null;
        setHasBrand(!!kit?.name);
        setBrandKit(kit);
      } else {
        setHasBrand(false);
        setBrandKit(null);
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
    if (hasActive && !pollRef.current) pollRef.current = setInterval(loadPitches, 5000);
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

  async function handleCreateProposal(e: React.FormEvent) {
    e.preventDefault();
    setProposalError("");
    if (!proposalBrief.trim() && !proposalForm.targetName.trim()) {
      setProposalError("Tell the AI who the proposal is for and what you want to sell.");
      return;
    }
    setIsCreatingProposal(true);
    try {
      const serviceTitle = serviceSummary(proposalForm.selectedServices, proposalForm.customAdditions, proposalForm.serviceTitle);
      const serviceDescription = combinedServiceDetails(
        proposalForm.serviceDescription || proposalBrief,
        proposalForm.selectedServices,
        proposalForm.customAdditions,
        proposalForm.proposalTypes,
      );
      const res = await fetch("/api/pitch/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: proposalBrief,
          ...proposalForm,
          preset: firstProposalPreset(proposalForm.proposalTypes, proposalForm.preset),
          serviceTitle,
          serviceDescription,
          proposalTypes: proposalForm.proposalTypes,
          servicePackages: proposalForm.selectedServices,
          customAdditions: proposalForm.customAdditions,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        if (data.error?.code === "BRAND_IDENTITY_REQUIRED") setHasBrand(false);
        setProposalError(data.error?.message || "Failed to generate proposal.");
        return;
      }
      toast({ title: "Proposal ready", description: "AI built the branded proposal and PDF." });
      router.push(`/pitch-board/${data.data.id}`);
    } catch {
      setProposalError("Network error. Please try again.");
    } finally {
      setIsCreatingProposal(false);
    }
  }

  async function handleCreatePitch(e: React.FormEvent) {
    e.preventDefault();
    setPitchError("");
    if (!pitchBrief.trim() && !pitchForm.businessName.trim()) {
      setPitchError("Tell the AI which business to research.");
      return;
    }
    setIsCreatingPitch(true);
    try {
      const res = await fetch("/api/pitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: pitchBrief, ...pitchForm }),
      });
      const data = await res.json();
      if (!data.success) {
        if (data.error?.code === "BRAND_IDENTITY_REQUIRED") setHasBrand(false);
        setPitchError(data.error?.message || "Failed to create pitch.");
        return;
      }
      toast({ title: "Pitch queued", description: "AI is researching and writing the pitch." });
      setActiveTab("pitch");
      loadPitches();
    } catch {
      setPitchError("Network error. Please try again.");
    } finally {
      setIsCreatingPitch(false);
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

  function openLeadAction(lead: BusinessLead, idx: number, mode: LeadActionMode) {
    setLeadAction({ lead, index: idx, mode });
    setLeadOfferForm(defaultLeadOfferForm(lead, brandKit));
    setLeadActionError("");
    setLeadCustomAdditionDraft("");
  }

  async function handleSubmitLeadAction(e: React.FormEvent) {
    e.preventDefault();
    if (!leadAction || !leadOfferForm) return;

    const { lead, index, mode } = leadAction;
    setLeadActionError("");
    const serviceTitle = serviceSummary(leadOfferForm.selectedServices, leadOfferForm.customAdditions, leadOfferForm.serviceTitle);
    const serviceDescription = combinedServiceDetails(
      leadOfferForm.serviceDescription,
      leadOfferForm.selectedServices,
      leadOfferForm.customAdditions,
      leadOfferForm.proposalTypes,
    );
    if (!serviceTitle.trim() || !serviceDescription.trim()) {
      setLeadActionError("Confirm the service package and details before AI builds this.");
      return;
    }

    if (mode === "pitch") setPitchingLead(index);
    else setProposingLead(index);
    try {
      const clientGoogleProfile = {
        placeId: lead.placeId,
        rating: lead.rating,
        reviewCount: lead.reviewCount,
        address: lead.address,
        phone: lead.phone,
        businessStatus: lead.businessStatus,
        types: lead.types,
        googleMapsUrl: lead.googleMapsUrl,
      };
      const confirmedOffer = [
        `Confirmed offer: ${serviceTitle}`,
        leadOfferForm.proposalTypes.length ? `Proposal types to combine: ${leadOfferForm.proposalTypes.join(", ")}` : "",
        leadOfferForm.selectedServices.length ? `Selected services: ${leadOfferForm.selectedServices.join(", ")}` : "",
        leadOfferForm.customAdditions.length ? `Custom additions: ${leadOfferForm.customAdditions.join("; ")}` : "",
        `Service details: ${serviceDescription}`,
        leadOfferForm.goals ? `Goals: ${leadOfferForm.goals}` : "",
        leadGoogleSummary(lead) ? `Client Google profile: ${leadGoogleSummary(lead)}` : "",
      ].filter(Boolean).join("\n");

      const res = await fetch(mode === "pitch" ? "/api/pitch" : "/api/pitch/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "pitch"
          ? {
              brief: `Research ${lead.name} and create a personalized outreach pitch for this confirmed offer.\n${confirmedOffer}`,
              businessName: lead.name,
              businessUrl: lead.website || "",
            }
          : {
              brief: `Create a polished service proposal for ${lead.name} using this confirmed offer.\n${confirmedOffer}`,
              targetName: lead.name,
              targetWebsite: lead.website || "",
              preset: firstProposalPreset(leadOfferForm.proposalTypes, leadOfferForm.preset),
              proposalTypes: leadOfferForm.proposalTypes,
              servicePackages: leadOfferForm.selectedServices,
              customAdditions: leadOfferForm.customAdditions,
              serviceTitle,
              serviceDescription,
              goals: leadOfferForm.goals,
              price: leadOfferForm.price,
              originalPrice: leadOfferForm.originalPrice,
              billingInterval: leadOfferForm.billingInterval,
              terms: leadOfferForm.terms,
              clientGoogleProfile,
            }),
      });
      const data = await res.json();
      if (data.success) {
        setLeadAction(null);
        setLeadOfferForm(null);
        if (mode === "pitch") {
          setActiveTab("pitch");
          loadPitches();
        } else {
          setActiveTab("proposal");
          await loadPitches();
          router.push(`/pitch-board/${data.data.id}`);
        }
      } else {
        const message = data.error?.message || `Failed to create ${mode}.`;
        setLeadActionError(message);
        toast({ variant: "destructive", title: `Failed to create ${mode}`, description: message });
      }
    } finally {
      if (mode === "pitch") setPitchingLead(null);
      else setProposingLead(null);
    }
  }

  const renderPitchCard = (pitch: Pitch) => (
    <div
      key={pitch.id}
      className="group relative cursor-pointer rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
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
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", pitch.documentType === "service_proposal" ? "bg-violet-500/10 text-violet-600" : "bg-emerald-500/10 text-emerald-600")}>
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
      {pitch.status === "FAILED" && pitch.errorMessage && <p className="mt-2 line-clamp-2 text-xs text-red-500">{pitch.errorMessage}</p>}
    </div>
  );

  return (
    <div className="flex-1">
      <div className="mx-auto max-w-[1500px] px-4 pt-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-3xl font-black tracking-tight text-foreground">
              <Briefcase className="h-7 w-7 text-sky-600" />
              Pitch Board
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Type the deal. AI extracts the details, researches, writes, and prepares the PDF.
            </p>
          </div>
          <div className="inline-flex w-fit flex-wrap gap-1 rounded-lg bg-muted p-1">
            {[
              { id: "proposal", label: "Proposal", icon: FileText },
              { id: "pitch", label: "Pitch", icon: Briefcase },
              { id: "leads", label: "Leads", icon: Users },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabKey)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
                    activeTab === tab.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
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
            <span className="flex-1">Brand identity is required before the agent can write with your services, logo, and colors.</span>
            <a href="/brand" className="font-semibold underline underline-offset-2">Set up Brand</a>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        {activeTab === "proposal" && (
          <div className="space-y-5">
            <form onSubmit={handleCreateProposal} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="border-b border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Badge variant="secondary" className="mb-3 gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-sky-500" />
                      Proposal Agent
                    </Badge>
                    <h2 className="text-2xl font-black text-foreground">Tell AI what to sell</h2>
                  </div>
                  <Badge variant="secondary">35 credits</Badge>
                </div>
              </div>

              <div className="space-y-5 p-5">
                <div className="space-y-4">
                  <Textarea
                    value={proposalBrief}
                    onChange={(e) => setProposalBrief(e.target.value)}
                    rows={7}
                    className="min-h-56 resize-y rounded-xl text-base leading-7"
                    placeholder="Example: Create a $199/month Google Business Profile proposal for ABC Dental Studio..."
                  />
                  <div className="flex flex-wrap gap-2">
                    {PROPOSAL_EXAMPLES.map((example, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setProposalBrief(example)}
                        className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        Sample {index + 1}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" size="lg" disabled={isCreatingProposal || hasBrand === false} className="gap-2">
                      {isCreatingProposal ? <FlowActionSpinner size={16} /> : <Wand2 className="h-4 w-4" />}
                      {isCreatingProposal ? "AI is building" : "Let AI Build Proposal"}
                      {!isCreatingProposal && <ArrowRight className="h-4 w-4" />}
                    </Button>
                    <Button type="button" variant="outline" size="lg" onClick={() => setShowProposalTuning((v) => !v)} className="gap-2">
                      <SlidersHorizontal className="h-4 w-4" />
                      Fine tune
                    </Button>
                  </div>

                  {proposalError && (
                    <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                      <AlertCircle className="h-4 w-4" />
                      {proposalError}
                    </p>
                  )}

                  {showProposalTuning && (
                    <div className="grid gap-3 rounded-xl border border-border bg-muted/30 p-4 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Client</Label>
                        <Input value={proposalForm.targetName} onChange={(e) => setProposalForm((f) => ({ ...f, targetName: e.target.value }))} placeholder="ABC Dental Studio" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Website</Label>
                        <Input value={proposalForm.targetWebsite} onChange={(e) => setProposalForm((f) => ({ ...f, targetWebsite: e.target.value }))} placeholder="https://client.com" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Recipient</Label>
                        <Input value={proposalForm.recipientName} onChange={(e) => setProposalForm((f) => ({ ...f, recipientName: e.target.value }))} placeholder="Owner" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Email</Label>
                        <Input type="email" value={proposalForm.recipientEmail} onChange={(e) => setProposalForm((f) => ({ ...f, recipientEmail: e.target.value }))} placeholder="owner@client.com" />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label>Proposal types</Label>
                        <div className="flex flex-wrap gap-2">
                          {PROPOSAL_PRESETS.map((preset) => (
                            <button
                              key={preset.value}
                              type="button"
                              onClick={() => setProposalForm((f) => {
                                const proposalTypes = toggleArrayValue(f.proposalTypes, preset.value, false);
                                return { ...f, proposalTypes, preset: firstProposalPreset(proposalTypes, f.preset) };
                              })}
                              className={cn(
                                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                                proposalForm.proposalTypes.includes(preset.value) ? "border-sky-400 bg-sky-50 text-sky-700" : "border-border bg-background text-muted-foreground",
                              )}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label>Service package</Label>
                        <Input value={proposalForm.serviceTitle} onChange={(e) => setProposalForm((f) => ({ ...f, serviceTitle: e.target.value }))} placeholder="Google Business Profile Optimization" />
                        {brandServiceOptions.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2">
                            {brandServiceOptions.map((service) => (
                              <button
                                key={service}
                                type="button"
                                onClick={() => setProposalForm((f) => {
                                  const selectedServices = toggleArrayValue(f.selectedServices, service);
                                  return {
                                    ...f,
                                    selectedServices,
                                    serviceTitle: serviceSummary(selectedServices, f.customAdditions, f.serviceTitle),
                                  };
                                })}
                                className={cn(
                                  "rounded-full border px-3 py-1.5 text-xs font-semibold",
                                  proposalForm.selectedServices.includes(service)
                                    ? "border-sky-400 bg-sky-50 text-sky-700"
                                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                                )}
                              >
                                {service}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label>Custom additions</Label>
                        <div className="flex gap-2">
                          <Input
                            value={proposalCustomAdditionDraft}
                            onChange={(e) => setProposalCustomAdditionDraft(e.target.value)}
                            placeholder="Add another service, deliverable, guarantee, or note"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              const value = proposalCustomAdditionDraft.trim();
                              if (!value) return;
                              setProposalForm((f) => ({
                                ...f,
                                customAdditions: [...f.customAdditions, value],
                                serviceTitle: serviceSummary(f.selectedServices, [...f.customAdditions, value], f.serviceTitle),
                              }));
                              setProposalCustomAdditionDraft("");
                            }}
                          >
                            <Plus className="h-4 w-4" />
                            Add
                          </Button>
                        </div>
                        {proposalForm.customAdditions.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2">
                            {proposalForm.customAdditions.map((addition) => (
                              <button
                                key={addition}
                                type="button"
                                onClick={() => setProposalForm((f) => ({ ...f, customAdditions: f.customAdditions.filter((item) => item !== addition) }))}
                                className="inline-flex items-center gap-1 rounded-full border border-sky-400 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700"
                              >
                                {addition}
                                <X className="h-3 w-3" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label>Service details</Label>
                        <Textarea rows={3} value={proposalForm.serviceDescription} onChange={(e) => setProposalForm((f) => ({ ...f, serviceDescription: e.target.value }))} placeholder="Only use this if you want to override the AI brief." />
                      </div>
                      <div className="grid grid-cols-3 gap-3 md:col-span-2">
                        <Input type="number" value={proposalForm.price} onChange={(e) => setProposalForm((f) => ({ ...f, price: e.target.value }))} placeholder="Price" />
                        <Input type="number" value={proposalForm.originalPrice} onChange={(e) => setProposalForm((f) => ({ ...f, originalPrice: e.target.value }))} placeholder="Original" />
                        <Input value={proposalForm.billingInterval} onChange={(e) => setProposalForm((f) => ({ ...f, billingInterval: e.target.value }))} placeholder="month" />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label>Terms</Label>
                        <Textarea rows={2} value={proposalForm.terms} onChange={(e) => setProposalForm((f) => ({ ...f, terms: e.target.value }))} placeholder="No contract, activation timing, cancellation, billing..." />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </form>

            {isCreatingProposal && (
              <AIGenerationLoader currentStep="Building proposal" subtitle="Extracting the deal, writing the plan, and preparing the PDF experience" />
            )}
            {!isLoadingPitches && proposals.length > 0 && (
              <section className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-foreground">Recent proposals</h2>
                  <Badge variant="secondary">{proposals.length}</Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{proposals.map(renderPitchCard)}</div>
              </section>
            )}
          </div>
        )}

        {activeTab === "pitch" && (
          <div className="space-y-5">
            <form onSubmit={handleCreatePitch} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="border-b border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Badge variant="secondary" className="mb-3 gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                      Outreach Agent
                    </Badge>
                    <h2 className="text-2xl font-black text-foreground">Tell AI who to research</h2>
                  </div>
                  <Badge variant="secondary">{pitchCreditLabel}</Badge>
                </div>
              </div>
              <div className="space-y-4 p-5">
                <Textarea
                  value={pitchBrief}
                  onChange={(e) => setPitchBrief(e.target.value)}
                  rows={7}
                  className="min-h-44 resize-y rounded-xl text-base leading-7"
                  placeholder="Example: Research Miami Dental Studio and create a short outreach pitch..."
                />
                <div className="flex flex-wrap gap-2">
                  {PITCH_EXAMPLES.map((example, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setPitchBrief(example)}
                      className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      Sample {index + 1}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" size="lg" disabled={isCreatingPitch || hasBrand === false} className="gap-2">
                    {isCreatingPitch ? <FlowActionSpinner size={16} /> : <Wand2 className="h-4 w-4" />}
                    {isCreatingPitch ? "AI is researching" : "Let AI Research & Pitch"}
                    {!isCreatingPitch && <ArrowRight className="h-4 w-4" />}
                  </Button>
                  <Button type="button" variant="outline" size="lg" onClick={() => setShowPitchTuning((v) => !v)} className="gap-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    Fine tune
                  </Button>
                </div>
                {pitchError && (
                  <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    {pitchError}
                  </p>
                )}
                {showPitchTuning && (
                  <div className="grid gap-3 rounded-xl border border-border bg-muted/30 p-4 md:grid-cols-2">
                    <Input value={pitchForm.businessName} onChange={(e) => setPitchForm((f) => ({ ...f, businessName: e.target.value }))} placeholder="Business name" />
                    <Input value={pitchForm.businessUrl} onChange={(e) => setPitchForm((f) => ({ ...f, businessUrl: e.target.value }))} placeholder="Website" />
                    <Input value={pitchForm.recipientName} onChange={(e) => setPitchForm((f) => ({ ...f, recipientName: e.target.value }))} placeholder="Recipient" />
                    <Input type="email" value={pitchForm.recipientEmail} onChange={(e) => setPitchForm((f) => ({ ...f, recipientEmail: e.target.value }))} placeholder="Email" />
                  </div>
                )}
              </div>
            </form>

            {isCreatingPitch && <AIGenerationLoader currentStep="Researching prospect" subtitle="Checking public signals and shaping the final pitch" />}
            {!isLoadingPitches && outreachPitches.length > 0 && (
              <section className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-foreground">Recent pitches</h2>
                  <Badge variant="secondary">{outreachPitches.length}</Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{outreachPitches.map(renderPitchCard)}</div>
              </section>
            )}
          </div>
        )}

        {activeTab === "leads" && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Lead finder</h2>
                  <p className="text-sm text-muted-foreground">Find businesses and let AI build a proposal or pitch.</p>
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

            {isSearchingLeads && <AIGenerationLoader currentStep="Searching businesses" subtitle="Finding leads and public profile signals" />}

            {leadResults.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
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
                    <div key={`${lead.name}-${idx}`} className="rounded-xl border border-border p-4">
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
                            <div className="flex flex-wrap justify-end gap-2">
                              {lead.googleMapsUrl && (
                                <Button size="sm" variant="outline" asChild>
                                  <a href={lead.googleMapsUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                                </Button>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={proposingLead === idx}
                                onClick={() => openLeadAction(lead, idx, "proposal")}
                              >
                                {proposingLead === idx ? <FlowActionSpinner size={14} /> : <FileText className="h-4 w-4" />}
                                Proposal
                              </Button>
                              <Button type="button" size="sm" disabled={pitchingLead === idx} onClick={() => openLeadAction(lead, idx, "pitch")}>
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

      <Dialog
        open={!!leadAction}
        onOpenChange={(open) => {
          if (!open) {
            setLeadAction(null);
            setLeadOfferForm(null);
            setLeadActionError("");
            setLeadCustomAdditionDraft("");
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {leadAction?.mode === "proposal" ? <FileText className="h-5 w-5 text-sky-600" /> : <Briefcase className="h-5 w-5 text-sky-600" />}
              Confirm offer details
            </DialogTitle>
          </DialogHeader>
          {leadAction && leadOfferForm && (
            <form onSubmit={handleSubmitLeadAction} className="mt-2 space-y-5">
              <div className="rounded-xl border border-border bg-muted/25 p-4">
                <div className="font-semibold text-foreground">{leadAction.lead.name}</div>
                <div className="mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                  {leadAction.lead.website && <span className="flex gap-2 break-all"><Globe className="mt-0.5 h-3.5 w-3.5 shrink-0" />{leadAction.lead.website}</span>}
                  {leadAction.lead.phone && <span className="flex gap-2"><Phone className="mt-0.5 h-3.5 w-3.5 shrink-0" />{leadAction.lead.phone}</span>}
                  {leadAction.lead.address && <span className="flex gap-2 md:col-span-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{leadAction.lead.address}</span>}
                </div>
                {leadGoogleSummary(leadAction.lead) && (
                  <div className="mt-3 rounded-lg bg-background px-3 py-2 text-xs font-medium text-muted-foreground">
                    {leadGoogleSummary(leadAction.lead)}
                  </div>
                )}
              </div>

              {(brandKit?.name || brandServiceOptions.length > 0 || brandKit?.description || brandKit?.uniqueValue) && (
                <div className="rounded-xl border border-border p-4">
                  <div className="text-sm font-semibold text-foreground">From your brand</div>
                  {brandKit?.name && <p className="mt-1 text-sm text-muted-foreground">{brandKit.name}</p>}
                  {(brandKit?.description || brandKit?.uniqueValue) && (
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{brandKit.uniqueValue || brandKit.description}</p>
                  )}
                  {brandServiceOptions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {brandServiceOptions.map((service) => (
                        <button
                          key={service}
                          type="button"
                          onClick={() => setLeadOfferForm((form) => {
                            if (!form) return form;
                            const selectedServices = toggleArrayValue(form.selectedServices, service);
                            return {
                              ...form,
                              selectedServices,
                              serviceTitle: serviceSummary(selectedServices, form.customAdditions, form.serviceTitle),
                            };
                          })}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-semibold",
                            leadOfferForm.selectedServices.includes(service)
                              ? "border-sky-400 bg-sky-50 text-sky-700"
                              : "border-border bg-background text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {service}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {leadAction.mode === "proposal" && (
                <div className="space-y-1.5">
                  <Label>Proposal types</Label>
                  <div className="flex flex-wrap gap-2">
                    {PROPOSAL_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setLeadOfferForm((form) => {
                          if (!form) return form;
                          const proposalTypes = toggleArrayValue(form.proposalTypes, preset.value, false);
                          return { ...form, proposalTypes, preset: firstProposalPreset(proposalTypes, form.preset) };
                        })}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-semibold",
                          leadOfferForm.proposalTypes.includes(preset.value)
                            ? "border-sky-400 bg-sky-50 text-sky-700"
                            : "border-border bg-background text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Service package</Label>
                  <Input
                    value={leadOfferForm.serviceTitle}
                    onChange={(e) => setLeadOfferForm((form) => form ? { ...form, serviceTitle: e.target.value } : form)}
                    placeholder="Google Business Profile Optimization"
                  />
                  {(leadOfferForm.selectedServices.length > 0 || leadOfferForm.customAdditions.length > 0) && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {[...leadOfferForm.selectedServices, ...leadOfferForm.customAdditions].map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setLeadOfferForm((form) => form
                            ? {
                                ...form,
                                selectedServices: form.selectedServices.filter((service) => service !== item),
                                customAdditions: form.customAdditions.filter((addition) => addition !== item),
                              }
                            : form)}
                          className="inline-flex items-center gap-1 rounded-full border border-sky-400 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700"
                        >
                          {item}
                          <X className="h-3 w-3" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Custom additions</Label>
                  <div className="flex gap-2">
                    <Input
                      value={leadCustomAdditionDraft}
                      onChange={(e) => setLeadCustomAdditionDraft(e.target.value)}
                      placeholder="Add another service, section, deliverable, or offer detail"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const value = leadCustomAdditionDraft.trim();
                        if (!value) return;
                        setLeadOfferForm((form) => {
                          if (!form) return form;
                          const customAdditions = [...form.customAdditions, value];
                          return {
                            ...form,
                            customAdditions,
                            serviceTitle: serviceSummary(form.selectedServices, customAdditions, form.serviceTitle),
                          };
                        });
                        setLeadCustomAdditionDraft("");
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Service details</Label>
                  <Textarea
                    rows={4}
                    value={leadOfferForm.serviceDescription}
                    onChange={(e) => setLeadOfferForm((form) => form ? { ...form, serviceDescription: e.target.value } : form)}
                    placeholder="Confirm the exact offer before AI builds anything."
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Client goals</Label>
                  <Textarea
                    rows={2}
                    value={leadOfferForm.goals}
                    onChange={(e) => setLeadOfferForm((form) => form ? { ...form, goals: e.target.value } : form)}
                    placeholder="What should this offer help the client achieve?"
                  />
                </div>
                {leadAction.mode === "proposal" && (
                  <>
                    <Input
                      type="number"
                      value={leadOfferForm.price}
                      onChange={(e) => setLeadOfferForm((form) => form ? { ...form, price: e.target.value } : form)}
                      placeholder="Price"
                    />
                    <Input
                      type="number"
                      value={leadOfferForm.originalPrice}
                      onChange={(e) => setLeadOfferForm((form) => form ? { ...form, originalPrice: e.target.value } : form)}
                      placeholder="Original price"
                    />
                    <Input
                      value={leadOfferForm.billingInterval}
                      onChange={(e) => setLeadOfferForm((form) => form ? { ...form, billingInterval: e.target.value } : form)}
                      placeholder="month"
                    />
                    <Input
                      value={leadOfferForm.terms}
                      onChange={(e) => setLeadOfferForm((form) => form ? { ...form, terms: e.target.value } : form)}
                      placeholder="Terms"
                    />
                  </>
                )}
              </div>

              {leadActionError && (
                <p className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  {leadActionError}
                </p>
              )}

              {(proposingLead === leadAction.index || pitchingLead === leadAction.index) && (
                <AIGenerationLoader
                  currentStep={leadAction.mode === "proposal" ? "Building proposal" : "Building pitch"}
                  subtitle="Using the confirmed offer details and your brand information"
                />
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setLeadAction(null)}>Cancel</Button>
                <Button type="submit" disabled={proposingLead === leadAction.index || pitchingLead === leadAction.index}>
                  {proposingLead === leadAction.index || pitchingLead === leadAction.index ? <FlowActionSpinner size={16} /> : leadAction.mode === "proposal" ? <FileText className="h-4 w-4" /> : <Briefcase className="h-4 w-4" />}
                  Build {leadAction.mode === "proposal" ? "Proposal" : "Pitch"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
