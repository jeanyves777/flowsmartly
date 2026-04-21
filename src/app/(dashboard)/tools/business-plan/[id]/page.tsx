"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Pencil,
  Save,
  X,
  Download,
  Share2,
  RefreshCw,
  Sparkles,
  FileText,
  Check,
  Copy,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/components/shared/rich-text-editor";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AIGenerationLoader } from "@/components/shared/ai-generation-loader";
import { useToast } from "@/hooks/use-toast";

// Load recharts only on the client — server can't prerender canvas/svg state
const ChartRenderer = dynamic(() => import("./chart-renderer").then((m) => m.ChartRenderer), {
  ssr: false,
  loading: () => <div className="h-64 bg-muted/30 rounded-md animate-pulse" />,
});

interface Chart {
  type: "bar" | "line" | "pie";
  title: string;
  yLabel?: string;
  data: Array<{ name: string; value: number; value2?: number; value2Name?: string }>;
}

interface Section {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  body: string;
  charts?: Chart[];
}

interface Plan {
  id: string;
  name: string;
  industry: string | null;
  stage: string | null;
  coverColor: string;
  status: string;
  publicToken: string | null;
  generationCount: number;
  createdAt: string;
  updatedAt: string;
  sections: Section[];
  brandSnapshot: Record<string, unknown>;
}

export default function BusinessPlanViewerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { id } = use(params);

  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [savingEdits, setSavingEdits] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [regenDialogOpen, setRegenDialogOpen] = useState(false);
  const [regenPrompt, setRegenPrompt] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [shareUrl, setShareUrl] = useState<string>("");
  const [nameDraft, setNameDraft] = useState("");
  const [bodyDraft, setBodyDraft] = useState("");

  const printRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/business-plans/${id}`);
        const json = await res.json();
        if (!cancelled && json.success) setPlan(json.plan);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const saveName = async () => {
    if (!plan || !nameDraft.trim()) return;
    setSavingEdits(true);
    const res = await fetch(`/api/business-plans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameDraft.trim() }),
    });
    setSavingEdits(false);
    if (res.ok) {
      setPlan({ ...plan, name: nameDraft.trim() });
      setEditingName(false);
      toast({ title: "Saved" });
    } else {
      toast({ title: "Save failed", variant: "destructive" });
    }
  };

  const saveSectionBody = async () => {
    if (!plan || !editingSectionId) return;
    const sections = plan.sections.map((s) =>
      s.id === editingSectionId ? { ...s, body: bodyDraft } : s,
    );
    setSavingEdits(true);
    const res = await fetch(`/api/business-plans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sections }),
    });
    setSavingEdits(false);
    if (res.ok) {
      setPlan({ ...plan, sections });
      setEditingSectionId(null);
      toast({ title: "Section saved" });
    } else {
      toast({ title: "Save failed", variant: "destructive" });
    }
  };

  const handlePrintPDF = () => {
    // Browser's native print dialog → "Save as PDF". Styled via @media print.
    window.print();
  };

  const handleShare = async () => {
    const res = await fetch(`/api/business-plans/${id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: shareEmail.trim() || undefined,
        message: shareMessage.trim() || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast({ title: "Share failed", variant: "destructive" });
      return;
    }
    setShareUrl(json.shareUrl);
    if (json.emailed) {
      toast({ title: `Shared with ${shareEmail}` });
    } else if (shareEmail) {
      toast({ title: "Link ready but email send failed", description: "Copy link instead.", variant: "destructive" });
    } else {
      toast({ title: "Share link ready" });
    }
  };

  const copyShareLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    toast({ title: "Link copied" });
  };

  const handleRegenerate = async () => {
    if (!regenPrompt.trim()) {
      toast({ title: "Describe the changes you want", variant: "destructive" });
      return;
    }
    setRegenerating(true);
    try {
      const res = await fetch(`/api/business-plans/${id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refinementPrompt: regenPrompt.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Failed");
      toast({ title: "Plan updated", description: `${json.data.creditsUsed} credits used` });
      setRegenDialogOpen(false);
      setRegenPrompt("");
      // Reload plan
      const fresh = await fetch(`/api/business-plans/${id}`).then((r) => r.json());
      if (fresh.success) setPlan(fresh.plan);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Regeneration failed";
      toast({ title: "Regen failed", description: msg, variant: "destructive" });
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <AIGenerationLoader compact currentStep="Loading your business plan…" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Button variant="ghost" onClick={() => router.push("/tools/business-plan")} className="gap-1 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to plans
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Plan not found or you don&apos;t have access to it.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (regenerating) {
    return (
      <div className="p-8 min-h-[60vh]">
        <div className="mx-auto w-full max-w-2xl">
          <AIGenerationLoader
            currentStep="Re-running the strategist with your refinements…"
            subtitle="Rewriting sections and recalculating projections."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bp-viewer-root">
      {/* Top action bar — hidden during print */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b print:hidden">
        <div className="flex items-center justify-between gap-2 p-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => router.push("/tools/business-plan")} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> All plans
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setRegenDialogOpen(true)} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Regenerate (35 cr.)
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShareDialogOpen(true)} className="gap-2">
              <Share2 className="h-4 w-4" /> Share
            </Button>
            <Button variant="default" size="sm" onClick={handlePrintPDF} className="gap-2">
              <Download className="h-4 w-4" /> PDF
            </Button>
          </div>
        </div>
      </div>

      <div ref={printRef} className="bp-print-area p-4 md:p-8 space-y-10">
        {/* Cover */}
        <section
          className="rounded-xl p-10 md:p-14 text-white shadow-xl relative overflow-hidden print:shadow-none print:rounded-none"
          style={{
            background: `linear-gradient(135deg, ${plan.coverColor} 0%, ${darken(plan.coverColor, 0.3)} 100%)`,
          }}
        >
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-medium uppercase tracking-wider mb-6">
              <FileText className="h-3.5 w-3.5" />
              Business Plan
            </div>
            {editingName ? (
              <div className="flex items-center gap-2 mb-4">
                <Input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="text-2xl md:text-4xl h-14 text-slate-900 font-bold"
                  autoFocus
                />
                <Button size="icon" variant="secondary" onClick={saveName} disabled={savingEdits}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="secondary" onClick={() => setEditingName(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 flex items-center gap-3 flex-wrap">
                {decodeEntities(plan.name)}
                <button
                  onClick={() => { setEditingName(true); setNameDraft(decodeEntities(plan.name)); }}
                  className="text-white/70 hover:text-white print:hidden"
                  aria-label="Rename plan"
                >
                  <Pencil className="h-5 w-5" />
                </button>
              </h1>
            )}
            <div className="flex flex-wrap gap-3 text-sm text-white/90">
              {plan.industry && (
                <span className="px-3 py-1 rounded-full bg-white/15 capitalize">
                  {plan.industry.replace(/_/g, " ")}
                </span>
              )}
              {plan.stage && (
                <span className="px-3 py-1 rounded-full bg-white/15 capitalize">{plan.stage}</span>
              )}
              <span className="px-3 py-1 rounded-full bg-white/15">
                Generated {new Date(plan.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          {/* Decorative sparkle */}
          <Sparkles className="absolute right-8 top-8 h-24 w-24 text-white/10" />
        </section>

        {/* Table of contents — on screen only */}
        <nav className="print:hidden">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Table of contents</h2>
          <ol className="grid gap-2 sm:grid-cols-2 text-sm">
            {plan.sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#section-${s.slug}`}
                  className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <span className="w-6 h-6 shrink-0 rounded-full bg-brand-500/10 text-brand-600 flex items-center justify-center text-xs font-semibold">
                    {i + 1}
                  </span>
                  <span className="font-medium">{decodeEntities(s.title)}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Sections */}
        {plan.sections.map((section, idx) => {
          const isEditing = editingSectionId === section.id;
          return (
            <section
              key={section.id}
              id={`section-${section.slug}`}
              className="scroll-mt-20 print:break-before-page"
            >
              <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                <div>
                  <div className="text-xs font-semibold text-brand-500 uppercase tracking-wider mb-1">
                    Section {idx + 1}
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{decodeEntities(section.title)}</h2>
                  {section.summary && (
                    <p className="text-muted-foreground mt-2 text-sm italic">{decodeEntities(section.summary)}</p>
                  )}
                </div>
                {!isEditing ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 print:hidden"
                    onClick={() => { setEditingSectionId(section.id); setBodyDraft(section.body); }}
                  >
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                ) : (
                  <div className="flex gap-2 print:hidden">
                    <Button size="sm" onClick={saveSectionBody} disabled={savingEdits} className="gap-1">
                      <Save className="h-4 w-4" /> Save
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingSectionId(null)} className="gap-1">
                      <X className="h-4 w-4" /> Cancel
                    </Button>
                  </div>
                )}
              </div>

              {isEditing ? (
                // RichTextEditor is mounted with a key so switching between
                // sections resets its innerHTML. Without the key the
                // contenteditable's caret would get confused between edits.
                <RichTextEditor
                  key={section.id}
                  value={bodyDraft}
                  onChange={setBodyDraft}
                  minHeight={320}
                />
              ) : (
                <div
                  className="bp-body prose prose-slate dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: section.body }}
                />
              )}

              {section.charts && section.charts.length > 0 && !isEditing && (
                <div className="grid gap-6 mt-6">
                  {section.charts.map((c, ci) => (
                    <Card key={ci} className="overflow-hidden">
                      <CardContent className="p-4 md:p-6">
                        <div className="text-sm font-semibold mb-3">{c.title}</div>
                        <ChartRenderer chart={c} primaryColor={plan.coverColor} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          );
        })}

        <footer className="text-center text-xs text-muted-foreground pt-6 border-t">
          Generated by FlowSmartly · v{plan.generationCount} · Updated {new Date(plan.updatedAt).toLocaleDateString()}
        </footer>
      </div>

      {/* Share dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share business plan</DialogTitle>
            <DialogDescription>Send a view-only link by email, or copy and share it yourself.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="share-email">Recipient email (optional)</Label>
              <Input
                id="share-email"
                type="email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                placeholder="investor@example.com"
              />
            </div>
            <div>
              <Label htmlFor="share-msg">Message (optional)</Label>
              <Textarea
                id="share-msg"
                value={shareMessage}
                onChange={(e) => setShareMessage(e.target.value)}
                placeholder="Here's the plan we discussed — would love your feedback."
                rows={3}
              />
            </div>
            {shareUrl && (
              <div className="p-3 rounded-md bg-muted/50 border flex items-center gap-2">
                <code className="text-xs break-all flex-1">{shareUrl}</code>
                <Button size="icon" variant="ghost" onClick={copyShareLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShareDialogOpen(false)}>Close</Button>
            <Button onClick={handleShare} className="gap-2">
              <Mail className="h-4 w-4" />
              {shareEmail ? "Send" : "Get link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate dialog */}
      <Dialog open={regenDialogOpen} onOpenChange={setRegenDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Regenerate plan with refinements</DialogTitle>
            <DialogDescription>
              The AI rewrites every section with your new instructions. Your brand identity stays the same.
              Charges 35 credits.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={regenPrompt}
            onChange={(e) => setRegenPrompt(e.target.value)}
            placeholder="e.g. Make the financial projections more aggressive. Pivot competitive analysis to enterprise buyers. Tighten the executive summary."
            rows={5}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRegenDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRegenerate} disabled={!regenPrompt.trim()} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Regenerate (35 cr.)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Body styles — prose rules for agent-generated HTML + print rules */}
      <style jsx global>{`
        .bp-body h2 {
          font-size: 1.25rem;
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
        }
        .bp-body h3 {
          font-size: 1.05rem;
          font-weight: 600;
          margin-top: 1rem;
          margin-bottom: 0.35rem;
        }
        .bp-body p { margin-bottom: 0.75rem; line-height: 1.7; }
        .bp-body ul, .bp-body ol {
          margin-bottom: 0.75rem; padding-left: 1.25rem; list-style: disc;
        }
        .bp-body ol { list-style: decimal; }
        .bp-body li { margin-bottom: 0.25rem; }
        .bp-body blockquote {
          border-left: 3px solid ${plan.coverColor};
          padding-left: 1rem;
          color: hsl(var(--muted-foreground));
          font-style: italic;
          margin: 1rem 0;
        }
        .bp-body table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
          font-size: 0.875rem;
        }
        .bp-body th, .bp-body td {
          border: 1px solid hsl(var(--border));
          padding: 0.5rem 0.75rem;
          text-align: left;
        }
        .bp-body th { background: hsl(var(--muted)); font-weight: 600; }

        @media print {
          .bp-viewer-root { background: white; color: black; }
          .bp-print-area { max-width: none; padding: 0; }
          .print\\:hidden { display: none !important; }
          .print\\:break-before-page { break-before: page; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:rounded-none { border-radius: 0 !important; }
        }
      `}</style>
    </div>
  );
}

// The agent sometimes HTML-encodes strings inside JSON values (e.g.
// "Products &amp; Services" instead of "Products & Services"). React
// renders that literally since it double-escapes. Decode common entities
// when displaying plain-text fields (title, summary, plan name) before
// handing them to React.
function decodeEntities(s: string): string {
  if (!s) return s;
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

// Darken a hex color by a percentage — used for the cover gradient's stop.
function darken(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = Math.max(0, Math.floor(parseInt(h.slice(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.floor(parseInt(h.slice(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.floor(parseInt(h.slice(4, 6), 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
