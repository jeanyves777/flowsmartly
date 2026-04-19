"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Briefcase, AlertCircle, CheckCircle2, Clock, Send, Download, Globe, Mail, Phone, ShieldCheck, ShieldAlert, Smartphone, BarChart3, MessageCircle, Calendar, ShoppingCart, Code2, Link2, TrendingUp, AlertTriangle, Star, ExternalLink, MapPin, Trophy, Target, Zap, Users, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";
import { scoreHexColor, scoreLabel } from "@/lib/pitch/scorer";
import { AISpinner } from "@/components/shared/ai-generation-loader";

// ── Types ──────────────────────────────────────────────────────────────────────

interface GooglePlacesData {
  placeId?: string;
  rating?: number;
  reviewCount?: number;
  address?: string;
  phone?: string;
  hours?: string[];
  isOpenNow?: boolean;
  businessStatus?: string;
  types?: string[];
  googleMapsUrl?: string;
  recentReviews?: Array<{ rating: number; text: string; timeAgo: string }>;
  priceLevel?: number;
}

interface ResearchData {
  websiteTitle?: string;
  metaDescription?: string;
  hasSSL?: boolean;
  hasMobileViewport?: boolean;
  hasAnalytics?: boolean;
  hasChatWidget?: boolean;
  hasBookingSystem?: boolean;
  hasEmailCapture?: boolean;
  hasEcommerce?: boolean;
  socialLinks?: string[];
  contactInfo?: { email?: string; phone?: string; address?: string };
  techStack?: string[];
  services?: string[];
  painPoints?: string[];
  opportunities?: string[];
  summary?: string;
  industry?: string;
  googlePlaces?: GooglePlacesData;
  fetchError?: string;
}

interface PitchContent {
  subject?: string;
  headline?: string;
  personalizedHook?: string;
  keyFindings?: string[];
  hiddenFindingsCount?: number;
  opportunityParagraph?: string;
  solutionBullets?: string[];
  impactParagraph?: string;
  ctaText?: string;
  ctaSubtext?: string;
  closingLine?: string;
}

interface Pitch {
  id: string;
  businessName: string;
  businessUrl?: string;
  status: "PENDING" | "RESEARCHING" | "READY" | "FAILED" | "SENT";
  research: ResearchData;
  pitchContent: PitchContent;
  recipientEmail?: string;
  recipientName?: string;
  sentAt?: string;
  errorMessage?: string;
  createdAt: string;
}

// ── Scoring engine ─────────────────────────────────────────────────────────────

interface ScoreCategory {
  name: string;
  score: number;
  weight: number;
  icon: React.ReactNode;
  items: Array<{ label: string; ok: boolean; detail?: string }>;
}

function computeDigitalScore(r: ResearchData): { overall: number; categories: ScoreCategory[] } {
  const gp = r.googlePlaces;

  // 1. Website Health (20%)
  const websiteItems = [
    { label: "SSL Certificate", ok: !!r.hasSSL, detail: r.hasSSL ? "Secure HTTPS" : "No SSL — browsers show 'Not Secure'" },
    { label: "Mobile Optimized", ok: !!r.hasMobileViewport, detail: r.hasMobileViewport ? "Mobile viewport set" : "Not mobile-friendly" },
    { label: "Website Found", ok: !r.fetchError, detail: r.fetchError ? "Website unreachable" : "Site accessible" },
  ];
  const websiteScore = Math.round(websiteItems.filter(i => i.ok).length / websiteItems.length * 100);

  // 2. Analytics & Tracking (15%)
  const analyticsItems = [
    { label: "Analytics Tracking", ok: !!r.hasAnalytics, detail: r.hasAnalytics ? (r.techStack?.find(t => t.includes("Analytics") || t.includes("Tag Manager")) || "Analytics active") : "No analytics installed" },
    { label: "E-commerce Tracking", ok: !!r.hasEcommerce, detail: r.hasEcommerce ? "E-commerce detected" : "No e-commerce" },
    { label: "Marketing Pixels", ok: !!(r.techStack?.some(t => t.includes("Pixel") || t.includes("Hotjar") || t.includes("Klaviyo"))), detail: "Retargeting pixels" },
  ];
  const analyticsScore = Math.round(analyticsItems.filter(i => i.ok).length / analyticsItems.length * 100);

  // 3. Lead Generation (25%)
  const leadItems = [
    { label: "Email Capture Form", ok: !!r.hasEmailCapture, detail: r.hasEmailCapture ? "Email list building active" : "No email capture — losing leads" },
    { label: "Live Chat Widget", ok: !!r.hasChatWidget, detail: r.hasChatWidget ? (r.techStack?.find(t => t.includes("Chat") || ["Intercom", "Tawk", "Crisp", "Tidio"].some(c => t.includes(c))) || "Live chat active") : "No chat — visitors can't ask questions instantly" },
    { label: "Online Booking", ok: !!r.hasBookingSystem, detail: r.hasBookingSystem ? (r.techStack?.find(t => ["Calendly", "Acuity", "Mindbody", "OpenTable", "Square", "Setmore", "SimplyBook"].some(c => t.includes(c))) || "Booking system active") : "No online booking found" },
  ];
  const leadScore = Math.round(leadItems.filter(i => i.ok).length / leadItems.length * 100);

  // 4. Online Reputation (25%)
  const ratingScore = gp?.rating !== undefined
    ? Math.round((gp.rating / 5) * 100)
    : 0;
  const reviewScore = gp?.reviewCount !== undefined
    ? Math.min(100, Math.round((gp.reviewCount / 100) * 100))
    : 0;
  const hasGoogleListing = !!gp;
  const reputationItems = [
    { label: "Google Business Listing", ok: hasGoogleListing, detail: hasGoogleListing ? `Found: ${gp?.rating ?? "no"} ★ (${gp?.reviewCount ?? 0} reviews)` : "Not found on Google Maps" },
    { label: "Rating ≥ 4.5 stars", ok: (gp?.rating ?? 0) >= 4.5, detail: gp?.rating !== undefined ? `Current: ${gp.rating}/5.0` : "No rating data" },
    { label: "50+ Reviews", ok: (gp?.reviewCount ?? 0) >= 50, detail: gp?.reviewCount !== undefined ? `${gp.reviewCount} reviews` : "No review data" },
  ];
  const reputationScore = hasGoogleListing
    ? Math.round((ratingScore * 0.5 + reviewScore * 0.3 + (hasGoogleListing ? 20 : 0)))
    : 0;

  // 5. Social Presence (15%)
  const socialCount = r.socialLinks?.length ?? 0;
  const socialItems = [
    { label: "Active on Social Media", ok: socialCount > 0, detail: socialCount > 0 ? `${socialCount} platform${socialCount > 1 ? "s" : ""} linked` : "No social links found on site" },
    { label: "Multiple Platforms", ok: socialCount >= 2, detail: socialCount >= 2 ? `${socialCount} channels` : "Only 1 or fewer" },
    { label: "Has Video Presence", ok: !!(r.socialLinks?.some(l => l.includes("youtube") || l.includes("tiktok"))), detail: "Video content present" },
  ];
  const socialScore = Math.round(socialItems.filter(i => i.ok).length / socialItems.length * 100);

  const categories: ScoreCategory[] = [
    { name: "Website Health", score: websiteScore, weight: 20, icon: <Globe className="w-4 h-4" />, items: websiteItems },
    { name: "Analytics & Tracking", score: analyticsScore, weight: 15, icon: <BarChart3 className="w-4 h-4" />, items: analyticsItems },
    { name: "Lead Generation", score: leadScore, weight: 25, icon: <Target className="w-4 h-4" />, items: leadItems },
    { name: "Online Reputation", score: reputationScore, weight: 25, icon: <Star className="w-4 h-4" />, items: reputationItems },
    { name: "Social Presence", score: socialScore, weight: 15, icon: <Link2 className="w-4 h-4" />, items: socialItems },
  ];

  const overall = Math.round(
    categories.reduce((sum, c) => sum + (c.score * c.weight) / 100, 0)
  );

  return { overall, categories };
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-amber-500";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}

function scoreBg(score: number): string {
  const hex = scoreHexColor(score);
  if (hex === "#22c55e") return "bg-green-500";
  if (hex === "#f59e0b") return "bg-amber-500";
  if (hex === "#f97316") return "bg-orange-500";
  return "bg-red-500";
}

// ── Circular progress ring ─────────────────────────────────────────────────────

function CircularScore({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : score >= 40 ? "#f97316" : "#ef4444";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f3f4f6" strokeWidth="8" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wide">/100</span>
      </div>
    </div>
  );
}

// ── Star rating display ────────────────────────────────────────────────────────

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => {
        const filled = rating >= i + 1;
        const half = !filled && rating > i;
        return (
          <Star
            key={i}
            className={cn("w-4 h-4", filled || half ? "text-amber-400 fill-amber-400" : "text-muted fill-muted")}
          />
        );
      })}
    </div>
  );
}

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Pitch["status"] }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    PENDING:     { label: "Pending",      cls: "bg-muted text-muted-foreground",   icon: <Clock className="w-3.5 h-3.5" /> },
    RESEARCHING: { label: "Researching…", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400",   icon: <AISpinner className="w-3.5 h-3.5 animate-spin" /> },
    READY:       { label: "Ready",        cls: "bg-green-500/10 text-green-600 dark:text-green-400", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    FAILED:      { label: "Failed",       cls: "bg-red-500/10 text-red-600 dark:text-red-400",     icon: <AlertCircle className="w-3.5 h-3.5" /> },
    SENT:        { label: "Sent",         cls: "bg-purple-500/10 text-purple-600 dark:text-purple-400", icon: <Send className="w-3.5 h-3.5" /> },
  };
  const s = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium", s.cls)}>
      {s.icon} {s.label}
    </span>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PitchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [brandName, setBrandName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showReviews, setShowReviews] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const [showSendDialog, setShowSendDialog] = useState(false);
  const [sendForm, setSendForm] = useState({ email: "", name: "", message: "" });
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const loadPitch = useCallback(async () => {
    try {
      const [res, brandRes] = await Promise.all([
        fetch(`/api/pitch/${id}`),
        fetch("/api/brand"),
      ]);
      if (!res.ok) { setError("Pitch not found."); return; }
      const data = await res.json();
      if (data.success) {
        const p = data.data.pitch;
        setPitch(p);
        // Pre-fill send form: prefer previously used recipient, fall back to scraped contact info
        setSendForm(f => ({
          ...f,
          email: p.recipientEmail || p.research?.contactInfo?.email || "",
          name: p.recipientName || p.businessName || "",
        }));
      }
      if (brandRes.ok) {
        const brandData = await brandRes.json();
        setBrandName(brandData.data?.brandKit?.name || "");
      }
    } catch {
      setError("Failed to load pitch.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { loadPitch(); }, [loadPitch]);

  useEffect(() => {
    if (!pitch || (pitch.status !== "PENDING" && pitch.status !== "RESEARCHING")) return;
    const timer = setInterval(loadPitch, 5000);
    return () => clearInterval(timer);
  }, [pitch, loadPitch]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSendError("");
    if (!sendForm.email.trim()) { setSendError("Recipient email is required."); return; }
    setIsSending(true);
    try {
      const res = await fetch(`/api/pitch/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail: sendForm.email.trim(), recipientName: sendForm.name.trim() || undefined, message: sendForm.message.trim() || undefined }),
      });
      const data = await res.json();
      if (!data.success) { setSendError(data.error?.message || "Failed to send."); return; }
      setSendSuccess(true);
      loadPitch();
      setTimeout(() => { setShowSendDialog(false); setSendSuccess(false); }, 2000);
    } catch {
      setSendError("Network error.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleDownloadPDF() {
    setIsDownloading(true);
    try {
      const res = await fetch(`/api/pitch/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfOnly: true }),
      });
      if (!res.ok) { alert("Failed to generate PDF."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${pitch?.businessName?.replace(/[^a-z0-9]/gi, "-").toLowerCase() || "pitch"}-proposal.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  }

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><AISpinner className="w-8 h-8 animate-spin text-blue-500" /></div>;
  }

  if (error || !pitch) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-muted-foreground">{error || "Pitch not found."}</p>
          <Button className="mt-4" onClick={() => router.push("/pitch-board")}>Back to Pitch Board</Button>
        </div>
      </div>
    );
  }

  const research = pitch.research || {};
  const pc = pitch.pitchContent || {};
  const gp = research.googlePlaces;
  const isReady = pitch.status === "READY" || pitch.status === "SENT";
  const isProcessing = pitch.status === "PENDING" || pitch.status === "RESEARCHING";
  const { overall, categories } = isReady ? computeDigitalScore(research) : { overall: 0, categories: [] };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => router.push("/pitch-board")} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground flex-shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-bold text-foreground truncate">{pitch.businessName}</h1>
                  <StatusBadge status={pitch.status} />
                  {isReady && research.industry && (
                    <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium">{research.industry}</span>
                  )}
                </div>
                {pitch.businessUrl && (
                  <a href={pitch.businessUrl.startsWith("http") ? pitch.businessUrl : `https://${pitch.businessUrl}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> {pitch.businessUrl.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>
            </div>
            {isReady && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadPDF} disabled={isDownloading}>
                  {isDownloading ? <AISpinner className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} PDF
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => setShowSendDialog(true)}>
                  <Send className="w-3.5 h-3.5" /> {pitch.status === "SENT" ? "Resend" : "Send Pitch"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Processing */}
      {isProcessing && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="w-20 h-20 rounded-3xl bg-blue-50 flex items-center justify-center mx-auto mb-5">
            <AISpinner className="w-10 h-10 animate-spin text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {pitch.status === "PENDING" ? "Queued for research…" : "AI is deeply analyzing this business"}
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
            {pitch.status === "RESEARCHING"
              ? "Scanning the website, pulling Google Business data, checking reviews, analyzing digital presence, and crafting a personalized pitch. This takes 30–90 seconds."
              : "Your pitch is queued and will begin shortly."}
          </p>
          <div className="mt-8 flex justify-center gap-6 text-sm text-muted-foreground/60">
            {["Fetching website", "Google Places lookup", "Analyzing gaps", "Generating pitch"].map((step, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div className={cn("w-2 h-2 rounded-full", pitch.status === "RESEARCHING" ? "bg-blue-500 animate-pulse" : "bg-muted")} />
                {step}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Failed */}
      {pitch.status === "FAILED" && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Research Failed</h2>
          <p className="text-muted-foreground max-w-md mx-auto">{pitch.errorMessage || "An error occurred."}</p>
        </div>
      )}

      {/* Main content */}
      {isReady && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

            {/* ═══ LEFT: Research & Analytics Panel ═══════════════════════ */}
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">Digital Presence Audit</h2>
                <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 font-medium">Internal Only</span>
              </div>

              {/* ── Overall Score Card ── */}
              <div className="bg-card rounded-2xl border border-border p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="font-bold text-foreground text-lg">Digital Health Score</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">Overall online presence assessment</p>
                  </div>
                  <div className="text-right">
                    <div className={cn("text-3xl font-black", scoreColor(overall))}>{overall}</div>
                    <div className="text-xs text-muted-foreground/60">out of 100</div>
                  </div>
                </div>

                {/* Main progress bar */}
                <div className="mb-5">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span className={cn("font-semibold", scoreColor(overall))}>{scoreLabel(overall)}</span>
                    <span>Industry top: 85</span>
                  </div>
                  <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-700", scoreBg(overall))}
                      style={{ width: `${overall}%` }}
                    />
                    {/* Benchmark marker */}
                    <div className="absolute top-0 h-full w-0.5 bg-muted-foreground/40" style={{ left: "85%" }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground/60 mt-1">
                    <span>0</span>
                    <span style={{ marginLeft: `calc(${overall}% - 10px)` }} className={cn("font-bold", scoreColor(overall))}>{overall}</span>
                    <span className="text-muted-foreground/60">100</span>
                  </div>
                </div>

                {/* Comparison with industry */}
                <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
                  <div className="text-center">
                    <div className={cn("text-xl font-black", scoreColor(overall))}>{overall}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{pitch.businessName.split(" ")[0]}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-black text-muted-foreground/60">52</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Industry Avg</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-black text-green-600 dark:text-green-400">85</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Top Performers</div>
                  </div>
                </div>
              </div>

              {/* ── Category Scores ── */}
              <div className="bg-card rounded-2xl border border-border p-5">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-500" /> Score Breakdown
                </h3>
                <div className="space-y-3">
                  {categories.map(cat => (
                    <div key={cat.name}>
                      <button
                        onClick={() => setExpandedCategory(expandedCategory === cat.name ? null : cat.name)}
                        className="w-full"
                      >
                        <div className="flex items-center gap-3 mb-1.5">
                          <span className={cn("text-muted-foreground", scoreColor(cat.score))}>{cat.icon}</span>
                          <span className="text-sm font-medium text-foreground flex-1 text-left">{cat.name}</span>
                          <span className={cn("text-sm font-bold w-10 text-right", scoreColor(cat.score))}>{cat.score}</span>
                          <span className="text-xs text-muted-foreground/60 w-8 text-right">{cat.weight}%</span>
                          {expandedCategory === cat.name
                            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
                            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
                          }
                        </div>
                        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all duration-700", scoreBg(cat.score))}
                            style={{ width: `${cat.score}%` }}
                          />
                        </div>
                      </button>
                      {expandedCategory === cat.name && (
                        <div className="mt-2 ml-7 space-y-1.5 pb-1">
                          {cat.items.map((item, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              {item.ok
                                ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                                : <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                              }
                              <div>
                                <span className={cn("font-medium", item.ok ? "text-foreground" : "text-muted-foreground")}>{item.label}</span>
                                {item.detail && <span className="text-muted-foreground/60 ml-1">— {item.detail}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Google Business Profile ── */}
              <div className={cn("bg-card rounded-2xl border p-5", gp ? "border-border" : "border-red-500/20 bg-red-500/5")}>
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" /> Google Business Profile
                  {gp
                    ? <span className="ml-auto px-2 py-0.5 rounded text-xs bg-green-500/10 text-green-600 dark:text-green-400 font-medium">Found</span>
                    : <span className="ml-auto px-2 py-0.5 rounded text-xs bg-red-500/10 text-red-600 dark:text-red-400 font-medium">Not Found</span>
                  }
                </h3>

                {!gp && (
                  <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>No Google Business listing found. This means they are essentially invisible to local search.</span>
                  </div>
                )}

                {gp && (
                  <div className="space-y-4">
                    {/* Rating display */}
                    {gp.rating !== undefined && (
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className={cn("text-4xl font-black", gp.rating >= 4.5 ? "text-green-600 dark:text-green-400" : gp.rating >= 4.0 ? "text-amber-500" : "text-red-500")}>
                            {gp.rating.toFixed(1)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">out of 5.0</div>
                        </div>
                        <div className="flex-1">
                          <StarRating rating={gp.rating} />
                          <div className="text-sm text-muted-foreground mt-1">
                            <strong>{gp.reviewCount ?? 0}</strong> Google reviews
                          </div>
                          {/* Rating bar */}
                          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full", gp.rating >= 4.5 ? "bg-green-500" : gp.rating >= 4.0 ? "bg-amber-500" : "bg-red-500")}
                              style={{ width: `${(gp.rating / 5) * 100}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground/60 mt-0.5">
                            <span>0</span>
                            <span className="text-muted-foreground/60">Benchmark: 4.5</span>
                            <span>5.0</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Details */}
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      {gp.address && (
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0 mt-0.5" />
                          <span>{gp.address}</span>
                        </div>
                      )}
                      {gp.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
                          <a href={`tel:${gp.phone}`} className="hover:text-blue-600">{gp.phone}</a>
                        </div>
                      )}
                      {gp.googleMapsUrl && (
                        <a href={gp.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-blue-500 hover:text-blue-700 text-sm">
                          <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" /> View on Google Maps
                        </a>
                      )}
                      {gp.isOpenNow !== undefined && (
                        <div className={cn("flex items-center gap-2 text-sm font-medium", gp.isOpenNow ? "text-green-600 dark:text-green-400" : "text-red-500")}>
                          <div className={cn("w-2 h-2 rounded-full", gp.isOpenNow ? "bg-green-500" : "bg-red-500")} />
                          {gp.isOpenNow ? "Open now" : "Closed now"}
                        </div>
                      )}
                    </div>

                    {/* Business hours */}
                    {gp.hours && gp.hours.length > 0 && (
                      <div>
                        <button
                          onClick={() => setShowReviews(v => !v)}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          {showReviews ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {showReviews ? "Hide hours" : "Show hours"}
                        </button>
                        {showReviews && (
                          <div className="mt-2 space-y-0.5">
                            {gp.hours.map((h, i) => (
                              <div key={i} className="text-xs text-muted-foreground">{h}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Recent reviews */}
                    {gp.recentReviews && gp.recentReviews.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-muted-foreground/60" /> Recent Customer Reviews
                        </div>
                        <div className="space-y-2.5">
                          {gp.recentReviews.map((rv, i) => (
                            <div key={i} className={cn("rounded-lg p-3 text-xs", rv.rating >= 4 ? "bg-green-50 border border-green-100" : "bg-red-50 border border-red-100")}>
                              <div className="flex items-center gap-2 mb-1">
                                <div className="flex">
                                  {Array.from({ length: 5 }).map((_, si) => (
                                    <Star key={si} className={cn("w-3 h-3", si < rv.rating ? "text-amber-400 fill-amber-400" : "text-muted fill-muted")} />
                                  ))}
                                </div>
                                <span className="text-muted-foreground/60">{rv.timeAgo}</span>
                              </div>
                              <p className="text-foreground leading-relaxed line-clamp-3">&ldquo;{rv.text}&rdquo;</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Tech Stack ── */}
              {research.techStack && research.techStack.length > 0 && (
                <div className="bg-card rounded-2xl border border-border p-5">
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-muted-foreground/60" /> Detected Tech Stack
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {research.techStack.map((t, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-muted text-muted-foreground text-xs font-medium">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Pain Points ── */}
              {research.painPoints && research.painPoints.length > 0 && (
                <div className="bg-card rounded-2xl border border-red-500/20 p-5">
                  <h3 className="font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" /> Identified Issues ({research.painPoints.length})
                  </h3>
                  <div className="space-y-2">
                    {research.painPoints.map((p, i) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-100">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-foreground">{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Opportunities ── */}
              {research.opportunities && research.opportunities.length > 0 && (
                <div className="bg-card rounded-2xl border border-green-500/20 p-5">
                  <h3 className="font-semibold text-green-600 dark:text-green-400 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> Growth Opportunities ({research.opportunities.length})
                  </h3>
                  <div className="space-y-2">
                    {research.opportunities.map((o, i) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-green-50 border border-green-100">
                        <Zap className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-foreground">{o}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ═══ RIGHT: Client Pitch Preview ════════════════════════════ */}
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">Pitch Preview</h2>
                <span className="px-2 py-0.5 rounded text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">Client Sees This</span>
              </div>

              <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
                {/* Header bar */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-6 text-white">
                  <div className="text-xs font-bold tracking-widest opacity-75 mb-2 uppercase">{brandName || "Confidential Proposal"}</div>
                  <h2 className="text-2xl font-black leading-tight">{pc.headline || `A Growth Strategy Built for ${pitch.businessName}`}</h2>
                  <p className="text-sm text-blue-100 mt-2">Prepared exclusively for <strong>{pitch.businessName}</strong></p>
                </div>

                <div className="p-6 space-y-6">
                  {/* Subject line */}
                  {pc.subject && (
                    <div className="bg-muted/50 rounded-xl px-4 py-3 border border-border">
                      <div className="text-[10px] text-muted-foreground/60 mb-1 font-bold tracking-widest uppercase">Email Subject</div>
                      <div className="text-sm font-semibold text-foreground">{pc.subject}</div>
                    </div>
                  )}

                  {/* Hook */}
                  {pc.personalizedHook && (
                    <p className="text-foreground text-sm leading-relaxed">{pc.personalizedHook}</p>
                  )}

                  {/* Score snapshot in pitch — mini version */}
                  <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl border border-blue-100 p-4">
                    <div className="text-[10px] font-bold tracking-widest text-blue-600 dark:text-blue-400 mb-3 uppercase">Digital Presence Score</div>
                    <div className="flex items-center gap-4 mb-3">
                      <CircularScore score={overall} size={72} />
                      <div className="flex-1">
                        <div className="text-sm font-bold text-foreground mb-0.5">{scoreLabel(overall)} Digital Presence</div>
                        <div className="text-xs text-muted-foreground">vs. 85 for top performers in {research.industry || "your industry"}</div>
                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                          {categories.slice(0, 4).map(cat => (
                            <div key={cat.name} className="flex items-center gap-1.5">
                              <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden flex-shrink-0">
                                <div className={cn("h-full rounded-full", scoreBg(cat.score))} style={{ width: `${cat.score}%` }} />
                              </div>
                              <span className="text-[10px] text-muted-foreground truncate">{cat.name.split(" ")[0]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Key Findings */}
                  {pc.keyFindings && pc.keyFindings.length > 0 && (
                    <div className="bg-muted/50 rounded-xl border border-border p-5">
                      <div className="text-[10px] font-bold tracking-widest text-blue-600 dark:text-blue-400 mb-3 uppercase">What We Discovered</div>
                      <div className="space-y-2.5">
                        {pc.keyFindings.map((f, i) => (
                          <div key={i} className="flex items-start gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                            <span className="text-sm text-foreground">{f}</span>
                          </div>
                        ))}
                      </div>
                      {(pc.hiddenFindingsCount || 0) > 0 && (
                        <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-xs text-muted-foreground/60 italic">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          + {pc.hiddenFindingsCount} more insights we&apos;d love to discuss with you.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Opportunity */}
                  {pc.opportunityParagraph && (
                    <div>
                      <div className="text-[10px] font-bold tracking-widest text-blue-600 dark:text-blue-400 mb-2 uppercase">The Opportunity</div>
                      <p className="text-sm text-foreground leading-relaxed">{pc.opportunityParagraph}</p>
                    </div>
                  )}

                  {/* Solution Bullets */}
                  {pc.solutionBullets && pc.solutionBullets.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold tracking-widest text-blue-600 dark:text-blue-400 mb-3 uppercase">How {brandName || "We"} Can Help</div>
                      <div className="space-y-2.5">
                        {pc.solutionBullets.map((b, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
                            <Zap className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-foreground">{b}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Impact */}
                  {pc.impactParagraph && (
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-5">
                      <div className="text-[10px] font-bold tracking-widest text-blue-600 dark:text-blue-400 mb-2 uppercase flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" /> Expected Impact
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">{pc.impactParagraph}</p>
                    </div>
                  )}

                  {/* CTA */}
                  {pc.ctaText && (
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-5 text-center text-white">
                      <Trophy className="w-6 h-6 mx-auto mb-2 opacity-80" />
                      <div className="text-lg font-black mb-1">{pc.ctaText}</div>
                      {pc.ctaSubtext && <p className="text-sm text-blue-100">{pc.ctaSubtext}</p>}
                    </div>
                  )}

                  {/* Closing */}
                  {pc.closingLine && (
                    <p className="text-sm text-muted-foreground italic">{pc.closingLine}</p>
                  )}

                  <div className="border-t border-border pt-4 text-center">
                    <p className="text-xs text-muted-foreground/60">{brandName || "Powered by FlowSmartly AI"}</p>
                  </div>
                </div>
              </div>

              {/* Sent info */}
              {pitch.status === "SENT" && pitch.sentAt && (
                <div className="bg-purple-50 rounded-xl border border-purple-100 px-4 py-3 flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                  <span className="text-purple-600 dark:text-purple-400">
                    Sent to <strong>{pitch.recipientEmail}</strong> on {new Date(pitch.sentAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Send Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Send Pitch
            </DialogTitle>
          </DialogHeader>
          {sendSuccess ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="font-semibold text-foreground">Pitch sent successfully!</p>
              <p className="text-sm text-muted-foreground mt-1">The proposal PDF has been delivered.</p>
            </div>
          ) : (
            <form onSubmit={handleSend} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Recipient Email <span className="text-red-500">*</span></Label>
                  <Input type="email" placeholder="owner@business.com" value={sendForm.email} onChange={e => setSendForm(f => ({ ...f, email: e.target.value }))} autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label>Recipient Name</Label>
                  <Input placeholder="John Smith" value={sendForm.name} onChange={e => setSendForm(f => ({ ...f, name: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Personal Message (Optional)</Label>
                <Textarea placeholder="Add a personal note…" rows={3} value={sendForm.message} onChange={e => setSendForm(f => ({ ...f, message: e.target.value }))} />
              </div>
              {sendError && <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4 flex-shrink-0" /> {sendError}</p>}
              <div className="flex justify-end gap-3 pt-1">
                <Button type="button" variant="outline" onClick={() => setShowSendDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={isSending} className="gap-2">
                  {isSending ? <AISpinner className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {isSending ? "Sending…" : "Send with PDF"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
