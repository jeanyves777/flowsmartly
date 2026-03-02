"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Send,
  Download,
  Globe,
  Mail,
  Phone,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  BarChart3,
  MessageCircle,
  Calendar,
  ShoppingCart,
  Code2,
  Link2,
  TrendingUp,
  AlertTriangle,
  Star,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
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

// ── Types ──────────────────────────────────────────────────────────────────────

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

// ── Status helpers ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Pitch["status"] }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    PENDING:     { label: "Pending",      cls: "bg-gray-100 text-gray-600",   icon: <Clock className="w-3.5 h-3.5" /> },
    RESEARCHING: { label: "Researching…", cls: "bg-blue-100 text-blue-700",   icon: <Loader2 className="w-3.5 h-3.5 animate-spin" /> },
    READY:       { label: "Ready",        cls: "bg-green-100 text-green-700", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    FAILED:      { label: "Failed",       cls: "bg-red-100 text-red-700",     icon: <AlertCircle className="w-3.5 h-3.5" /> },
    SENT:        { label: "Sent",         cls: "bg-purple-100 text-purple-700", icon: <Send className="w-3.5 h-3.5" /> },
  };
  const s = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium", s.cls)}>
      {s.icon} {s.label}
    </span>
  );
}

function BoolBadge({ value, trueLabel = "Yes", falseLabel = "No" }: { value?: boolean; trueLabel?: string; falseLabel?: string }) {
  return value
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-50 text-green-700 font-medium"><CheckCircle2 className="w-3 h-3" />{trueLabel}</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-50 text-red-600 font-medium"><AlertTriangle className="w-3 h-3" />{falseLabel}</span>;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PitchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Send dialog
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [sendForm, setSendForm] = useState({ email: "", name: "", message: "" });
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState(false);

  // Download state
  const [isDownloading, setIsDownloading] = useState(false);

  const loadPitch = useCallback(async () => {
    try {
      const res = await fetch(`/api/pitch/${id}`);
      if (!res.ok) { setError("Pitch not found."); return; }
      const data = await res.json();
      if (data.success) {
        setPitch(data.data.pitch);
        // Pre-fill send form with existing email if any
        if (data.data.pitch.recipientEmail) {
          setSendForm(f => ({ ...f, email: data.data.pitch.recipientEmail || "", name: data.data.pitch.recipientName || "" }));
        }
      }
    } catch {
      setError("Failed to load pitch.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { loadPitch(); }, [loadPitch]);

  // Poll while processing
  useEffect(() => {
    if (!pitch) return;
    if (pitch.status !== "PENDING" && pitch.status !== "RESEARCHING") return;
    const timer = setInterval(loadPitch, 5000);
    return () => clearInterval(timer);
  }, [pitch, loadPitch]);

  // ── Send pitch ─────────────────────────────────────────────────────────────

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSendError("");
    if (!sendForm.email.trim()) { setSendError("Recipient email is required."); return; }
    setIsSending(true);
    try {
      const res = await fetch(`/api/pitch/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: sendForm.email.trim(),
          recipientName: sendForm.name.trim() || undefined,
          message: sendForm.message.trim() || undefined,
        }),
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

  // ── Download PDF ───────────────────────────────────────────────────────────

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

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !pitch) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-gray-600">{error || "Pitch not found."}</p>
          <Button className="mt-4" onClick={() => router.push("/pitch-board")}>Back to Pitch Board</Button>
        </div>
      </div>
    );
  }

  const research = pitch.research || {};
  const pc = pitch.pitchContent || {};
  const isReady = pitch.status === "READY" || pitch.status === "SENT";
  const isProcessing = pitch.status === "PENDING" || pitch.status === "RESEARCHING";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => router.push("/pitch-board")} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 flex-shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-bold text-gray-900 truncate">{pitch.businessName}</h1>
                  <StatusBadge status={pitch.status} />
                </div>
                {pitch.businessUrl && (
                  <a
                    href={pitch.businessUrl.startsWith("http") ? pitch.businessUrl : `https://${pitch.businessUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" /> {pitch.businessUrl.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>
            </div>

            {isReady && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadPDF} disabled={isDownloading}>
                  {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  PDF
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => setShowSendDialog(true)}>
                  <Send className="w-3.5 h-3.5" />
                  {pitch.status === "SENT" ? "Resend" : "Send Pitch"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Processing state */}
      {isProcessing && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            {pitch.status === "PENDING" ? "Queued for research…" : "AI is analyzing this business"}
          </h2>
          <p className="text-gray-500 max-w-md mx-auto">
            {pitch.status === "RESEARCHING"
              ? "We're scanning the website, identifying opportunities, and crafting a personalized pitch. This usually takes 30–60 seconds."
              : "Your pitch is queued and will begin shortly."}
          </p>
        </div>
      )}

      {/* Failed state */}
      {pitch.status === "FAILED" && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Research Failed</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-2">
            {pitch.errorMessage || "An error occurred while researching this business."}
          </p>
          <p className="text-sm text-gray-400">The website may be down, require authentication, or block automated access.</p>
        </div>
      )}

      {/* Main content */}
      {isReady && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* ─── Left: Internal Research Panel ──────────────────────── */}
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-700">Research Findings</h2>
                <span className="px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700 font-medium">Internal Only</span>
              </div>

              {/* Summary */}
              {research.summary && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-gray-400" /> Business Summary
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{research.summary}</p>
                  {research.industry && (
                    <div className="mt-2.5">
                      <span className="px-2.5 py-1 rounded-lg text-xs bg-blue-50 text-blue-700 font-medium">{research.industry}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Tech Scan */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-gray-400" /> Website Analysis
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> SSL</span>
                    <BoolBadge value={research.hasSSL} trueLabel="Secure" falseLabel="No SSL" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 flex items-center gap-1"><Smartphone className="w-3.5 h-3.5" /> Mobile</span>
                    <BoolBadge value={research.hasMobileViewport} trueLabel="Optimized" falseLabel="Not Optimized" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> Analytics</span>
                    <BoolBadge value={research.hasAnalytics} trueLabel="Tracking" falseLabel="Missing" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> Chat</span>
                    <BoolBadge value={research.hasChatWidget} trueLabel="Has Chat" falseLabel="No Chat" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Booking</span>
                    <BoolBadge value={research.hasBookingSystem} trueLabel="Has Booking" falseLabel="No Booking" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Email Capture</span>
                    <BoolBadge value={research.hasEmailCapture} trueLabel="Has Form" falseLabel="No Form" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 flex items-center gap-1"><ShoppingCart className="w-3.5 h-3.5" /> Ecommerce</span>
                    <BoolBadge value={research.hasEcommerce} trueLabel="Yes" falseLabel="No" />
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              {research.contactInfo && (research.contactInfo.email || research.contactInfo.phone || research.contactInfo.address) && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" /> Contact Info Found
                  </h3>
                  <div className="space-y-2 text-sm">
                    {research.contactInfo.email && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Mail className="w-3.5 h-3.5 text-gray-400" />
                        <a href={`mailto:${research.contactInfo.email}`} className="hover:text-blue-600">{research.contactInfo.email}</a>
                      </div>
                    )}
                    {research.contactInfo.phone && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-3.5 h-3.5 text-gray-400" />
                        <a href={`tel:${research.contactInfo.phone}`} className="hover:text-blue-600">{research.contactInfo.phone}</a>
                      </div>
                    )}
                    {research.contactInfo.address && (
                      <div className="flex items-start gap-2 text-gray-600">
                        <Globe className="w-3.5 h-3.5 text-gray-400 mt-0.5" />
                        <span>{research.contactInfo.address}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Social Links */}
              {research.socialLinks && research.socialLinks.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-gray-400" /> Social Presence
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {research.socialLinks.map((link, i) => (
                      <a key={i} href={link} target="_blank" rel="noopener noreferrer"
                        className="px-3 py-1 rounded-lg border border-gray-200 text-xs text-blue-600 hover:bg-blue-50 transition-colors">
                        {link.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Tech Stack */}
              {research.techStack && research.techStack.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-gray-400" /> Tech Stack
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {research.techStack.map((t, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Pain Points */}
              {research.painPoints && research.painPoints.length > 0 && (
                <div className="bg-white rounded-xl border border-red-100 p-5">
                  <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" /> Pain Points ({research.painPoints.length})
                  </h3>
                  <ul className="space-y-2">
                    {research.painPoints.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Opportunities */}
              {research.opportunities && research.opportunities.length > 0 && (
                <div className="bg-white rounded-xl border border-green-100 p-5">
                  <h3 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> Opportunities ({research.opportunities.length})
                  </h3>
                  <ul className="space-y-2">
                    {research.opportunities.map((o, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <Star className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                        {o}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* ─── Right: Client-Facing Pitch Preview ─────────────────────── */}
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-700">Pitch Preview</h2>
                <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 font-medium">Client View</span>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Pitch header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-5 text-white">
                  <div className="text-xs font-semibold tracking-widest opacity-80 mb-2">FLOWSMARTLY · CONFIDENTIAL PROPOSAL</div>
                  <h2 className="text-xl font-bold leading-tight">{pc.headline || `A Growth Strategy Built for ${pitch.businessName}`}</h2>
                  <p className="text-sm text-blue-100 mt-2">Prepared exclusively for <strong>{pitch.businessName}</strong></p>
                </div>

                <div className="p-6 space-y-6">
                  {/* Subject line */}
                  {pc.subject && (
                    <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                      <div className="text-xs text-gray-500 mb-1 font-medium">EMAIL SUBJECT</div>
                      <div className="text-sm font-semibold text-gray-800">{pc.subject}</div>
                    </div>
                  )}

                  {/* Hook */}
                  {pc.personalizedHook && (
                    <div>
                      <p className="text-gray-700 text-sm leading-relaxed">{pc.personalizedHook}</p>
                    </div>
                  )}

                  {/* Key Findings */}
                  {pc.keyFindings && pc.keyFindings.length > 0 && (
                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
                      <div className="text-xs font-bold tracking-widest text-blue-600 mb-3">WHAT WE DISCOVERED</div>
                      <ul className="space-y-2.5">
                        {pc.keyFindings.map((f, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                            <span className="text-blue-500 font-bold flex-shrink-0 mt-0.5">▸</span>
                            {f}
                          </li>
                        ))}
                      </ul>
                      {(pc.hiddenFindingsCount || 0) > 0 && (
                        <p className="text-xs text-gray-400 italic mt-3">
                          + {pc.hiddenFindingsCount} more opportunities we&apos;d love to discuss with you.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Opportunity */}
                  {pc.opportunityParagraph && (
                    <div>
                      <div className="text-xs font-bold tracking-widest text-blue-600 mb-2">THE OPPORTUNITY</div>
                      <p className="text-sm text-gray-700 leading-relaxed">{pc.opportunityParagraph}</p>
                    </div>
                  )}

                  {/* Solution Bullets */}
                  {pc.solutionBullets && pc.solutionBullets.length > 0 && (
                    <div>
                      <div className="text-xs font-bold tracking-widest text-blue-600 mb-3">HOW FLOWSMARTLY CAN HELP</div>
                      <ul className="space-y-2.5">
                        {pc.solutionBullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                            <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 mt-1.5" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Impact */}
                  {pc.impactParagraph && (
                    <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
                      <div className="text-xs font-bold tracking-widest text-blue-600 mb-2">EXPECTED IMPACT</div>
                      <p className="text-sm text-gray-700 leading-relaxed">{pc.impactParagraph}</p>
                    </div>
                  )}

                  {/* CTA */}
                  {pc.ctaText && (
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-5 text-center text-white">
                      <div className="text-base font-bold mb-1">{pc.ctaText}</div>
                      {pc.ctaSubtext && <p className="text-sm text-blue-100">{pc.ctaSubtext}</p>}
                    </div>
                  )}

                  {/* Closing */}
                  {pc.closingLine && (
                    <p className="text-sm text-gray-600 italic">{pc.closingLine}</p>
                  )}

                  {/* Footer */}
                  <div className="border-t border-gray-100 pt-4 text-center">
                    <p className="text-xs text-gray-400">flowsmartly.com · Powered by FlowSmartly AI</p>
                  </div>
                </div>
              </div>

              {/* Send info */}
              {pitch.status === "SENT" && pitch.sentAt && (
                <div className="bg-purple-50 rounded-xl border border-purple-100 px-4 py-3 flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <span className="text-purple-700">
                    Sent to <strong>{pitch.recipientEmail}</strong> on {new Date(pitch.sentAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Send Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-600" /> Send Pitch
            </DialogTitle>
          </DialogHeader>

          {sendSuccess ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="font-semibold text-gray-800">Pitch sent successfully!</p>
              <p className="text-sm text-gray-500 mt-1">The proposal PDF has been delivered.</p>
            </div>
          ) : (
            <form onSubmit={handleSend} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Recipient Email <span className="text-red-500">*</span></Label>
                  <Input
                    type="email"
                    placeholder="owner@business.com"
                    value={sendForm.email}
                    onChange={e => setSendForm(f => ({ ...f, email: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Recipient Name</Label>
                  <Input
                    placeholder="John Smith"
                    value={sendForm.name}
                    onChange={e => setSendForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Personal Message (Optional)</Label>
                <Textarea
                  placeholder="Add a personal note to appear at the top of the email…"
                  rows={3}
                  value={sendForm.message}
                  onChange={e => setSendForm(f => ({ ...f, message: e.target.value }))}
                />
              </div>

              {sendError && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {sendError}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <Button type="button" variant="outline" onClick={() => setShowSendDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={isSending} className="gap-2">
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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
