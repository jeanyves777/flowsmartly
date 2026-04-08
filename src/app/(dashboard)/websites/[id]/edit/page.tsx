"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ExternalLink, RefreshCw, Loader2, Check, AlertCircle, Globe,
  FileText, Save, Plus, Trash2, Link2, Upload, X, Image as ImageIcon,
  Phone, Mail, MapPin, Star, Users, MessageSquare, HelpCircle, Flag, AlertTriangle, Sparkles,
} from "lucide-react";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { AIGenerationLoader } from "@/components/shared/ai-generation-loader";
import { SectionUpdater } from "@/components/shared/section-updater";

interface Website {
  id: string; name: string; slug: string; status: string; buildStatus: string;
  lastBuildAt?: string; lastBuildError?: string; siteData: string;
  customDomain?: string | null;
}

interface SiteData {
  company: Record<string, any>;
  heroImages?: string[];
  logo?: string;
  aboutImage?: string;
  pageImages?: Record<string, string>;
  services: Array<Record<string, any>>;
  stats: Array<{ label: string; value: number }>;
  team?: Array<Record<string, any>>;
  testimonials?: Array<Record<string, any>>;
  faq?: Array<{ question: string; answer: string }>;
  blogPosts?: Array<Record<string, any>>;
  galleryImages?: Array<Record<string, any>>;
  expertise?: string[];
  navLinks?: Array<{ href: string; label: string }>;
  footerLinks?: Array<{ href: string; label: string }>;
}

export default function WebsiteEditPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const searchParams = useSearchParams();
  const [website, setWebsite] = useState<Website | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [fixingLinks, setFixingLinks] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "preview");
  const [data, setData] = useState<SiteData | null>(null);
  const [changed, setChanged] = useState(false);
  const [pages, setPages] = useState<Array<{ slug: string; label: string }>>([]);
  const [previewPage, setPreviewPage] = useState("");
  const [buildStep, setBuildStep] = useState("");
  const [buildResult, setBuildResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCallback, setPickerCallback] = useState<((url: string) => void) | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/websites/${id}`).then((r) => r.json()).then((d) => { setWebsite(d.website); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/websites/${id}/site-data`).then((r) => r.json()).then((d) => { if (d.data) setData(d.data); if (d.pages) setPages(d.pages); }).catch(() => {});
  }, [id]);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    setBuildResult(null);
    setBuildStep("Saving your changes...");
    await fetch(`/api/websites/${id}/update-data`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }) });
    setChanged(false);
    setSaving(false);
    setBuildStep("Changes saved. Starting rebuild...");
    rebuild();
  };

  const rebuild = async () => {
    setRebuilding(true);
    setBuildResult(null);
    setBuildStep("Syncing brand data...");
    await fetch(`/api/websites/${id}/rebuild`, { method: "POST" });
    setBuildStep("Installing dependencies & building site...");
    poll("rebuild");
  };

  const fixLinks = async () => {
    setFixingLinks(true);
    setBuildResult(null);
    setBuildStep("Fixing internal links...");
    await fetch(`/api/websites/${id}/fix-links`, { method: "POST" });
    setBuildStep("Rebuilding site with fixed links...");
    poll("fix-links");
  };

  const poll = (action: string) => {
    let elapsed = 0;
    const iv = setInterval(async () => {
      elapsed += 3;
      const res = await fetch(`/api/websites/${id}`);
      const d = await res.json();
      setWebsite(d.website);

      if (elapsed < 15) setBuildStep(action === "fix-links" ? "Rewriting links and rebuilding..." : "Building your website...");
      else if (elapsed < 30) setBuildStep("Compiling pages...");
      else if (elapsed < 60) setBuildStep("Generating static files...");
      else setBuildStep("Almost done...");

      if (d.website.buildStatus !== "building") {
        clearInterval(iv);
        setRebuilding(false);
        setFixingLinks(false);
        setBuildStep("");

        if (d.website.buildStatus === "built") {
          setBuildResult({ type: "success", message: "Site updated successfully!" });
          if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
          // Auto-dismiss after 5s
          setTimeout(() => setBuildResult(null), 5000);
        } else {
          setBuildResult({ type: "error", message: d.website.lastBuildError?.substring(0, 200) || "Build failed. Check Build tab for details." });
          // Auto-switch to preview to show error state with report button
          if (activeTab !== "build") setActiveTab("preview");
        }
      }
    }, 3000);
  };

  const update = (path: string, value: any) => {
    if (!data) return;
    const d = JSON.parse(JSON.stringify(data));
    const parts = path.split(".");
    let obj: any = d;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = isNaN(Number(parts[i])) ? parts[i] : Number(parts[i]);
      obj = obj[k];
    }
    obj[parts[parts.length - 1]] = value;
    setData(d);
    setChanged(true);
  };

  const openPicker = (callback: (url: string) => void) => {
    setPickerCallback(() => callback);
    setPickerOpen(true);
  };

  const aiGenerateImage = async (prompt: string, category: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/websites/${id}/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, category }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to generate image");
      }
      setBuildResult({ type: "success", message: `Image generated! (${result.cost || 15} credits used)` });
      setTimeout(() => setBuildResult(null), 3000);
      return result.path;
    } catch (err: any) {
      throw new Error(err.message || "Failed to generate image. Please try again.");
    }
  };

  const uploadImageToSite = async (file: File, category: string): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", category);
    const res = await fetch(`/api/websites/${id}/upload-image`, { method: "POST", body: fd });
    const d = await res.json();
    return d.path || "";
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!website) return <div className="text-center py-20"><p className="text-muted-foreground">Website not found</p></div>;

  const busy = rebuilding || fixingLinks || saving;
  // Only show tabs for features that reliably map to the source code.
  // Section-specific editing (Hero, Services, Team, etc.) is done via AI Update tab.
  const tabs: Array<{ id: string; label: string; icon: any }> = [
    { id: "preview", label: "Preview", icon: Globe },
    { id: "company", label: "Company", icon: FileText },
    { id: "ai-update", label: "AI Update", icon: Sparkles },
    { id: "links", label: "Links", icon: Link2 },
    { id: "domains", label: "Domains", icon: Globe },
  ];

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/websites")} className="p-2 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></button>
          <div>
            <h1 className="text-xl font-bold">{website.name}</h1>
            <p className="text-xs text-muted-foreground">{website.customDomain || `/sites/${website.slug}`}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {changed && <button onClick={save} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"><Save className="w-3.5 h-3.5" /> Save & Rebuild</button>}
          {website.buildStatus === "built" && <a href={website.customDomain ? `https://${website.customDomain}` : `/sites/${website.slug}/`} target="_blank" className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted"><ExternalLink className="w-3.5 h-3.5" /> View</a>}
          <button onClick={fixLinks} disabled={busy} className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted disabled:opacity-50">{fixingLinks ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Fix Links"}</button>
          <button onClick={rebuild} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50">{rebuilding ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Building...</> : <><RefreshCw className="w-3.5 h-3.5" /> Rebuild</>}</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* Build Progress Overlay */}
      {(rebuilding || fixingLinks || saving) && buildStep && (
        <div className="mb-4">
          <AIGenerationLoader
            currentStep={buildStep}
            subtitle="This usually takes 30-60 seconds"
            compact
          />
        </div>
      )}

      {/* Build Result Toast */}
      {buildResult && (
        <div className={`mb-4 flex items-center gap-3 px-4 py-3 rounded-xl border ${buildResult.type === "success" ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300" : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"}`}>
          {buildResult.type === "success" ? <Check className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          <p className="text-sm font-medium flex-1">{buildResult.message}</p>
          <button onClick={() => setBuildResult(null)} className="p-1 hover:opacity-70"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Preview */}
      {activeTab === "preview" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
            <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-400" /><div className="w-3 h-3 rounded-full bg-yellow-400" /><div className="w-3 h-3 rounded-full bg-green-400" /></div>
            <span className="text-xs text-muted-foreground flex-1 text-center">{website.customDomain ? `${website.customDomain}/${previewPage}` : `flowsmartly.com/sites/${website.slug}/${previewPage}`}</span>
          </div>
          {/* Page navigation */}
          {pages.length > 1 && (
            <div className="flex gap-1 px-3 py-2 border-b border-border bg-muted/10 overflow-x-auto">
              {pages.map((p) => (
                <button
                  key={p.slug}
                  onClick={() => { setPreviewPage(p.slug); if (iframeRef.current) iframeRef.current.src = `/sites/${website.slug}/${p.slug}`; }}
                  className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${previewPage === p.slug ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-muted-foreground"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
          {website.buildStatus === "built" ? <iframe ref={iframeRef} src={`/sites/${website.slug}/${previewPage}`} className="w-full h-[75vh] border-0" /> : website.buildStatus === "error" ? (
            <div className="text-center py-16 px-6">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">Website Build Failed</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-2">
                Your website encountered an error during the build process. You can try rebuilding, or report this issue to our team for assistance.
              </p>
              {website.lastBuildError && (
                <pre className="mx-auto max-w-lg text-left p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs rounded-lg overflow-auto max-h-32 mb-4">{website.lastBuildError.substring(0, 300)}{website.lastBuildError.length > 300 ? "..." : ""}</pre>
              )}
              <div className="flex items-center justify-center gap-3">
                <button onClick={rebuild} disabled={busy} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
                  {rebuilding ? <><Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1.5" />Rebuilding...</> : <><RefreshCw className="w-3.5 h-3.5 inline mr-1.5" />Try Rebuild</>}
                </button>
                <ReportErrorButton websiteId={id} />
              </div>
            </div>
          ) : (
            <div className="text-center py-20"><p className="text-muted-foreground mb-4">{website.buildStatus === "building" ? "Building..." : "Not built yet"}</p>
              {website.buildStatus !== "building" && <button onClick={rebuild} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">Build Now</button>}
            </div>
          )}
        </div>
      )}

      {/* Hero & Branding */}
      {/* Company */}
      {activeTab === "company" && data && (
        <div className="space-y-6">
          <Section title="Company Information">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Company Name" value={data.company.name} onChange={(v) => update("company.name", v)} />
              <Field label="Short Name" value={data.company.shortName} onChange={(v) => update("company.shortName", v)} />
              <Field label="Tagline" value={data.company.tagline} onChange={(v) => update("company.tagline", v)} span={2} />
              <Field label="Description" value={data.company.description} onChange={(v) => update("company.description", v)} multiline span={2} />
              <Field label="About" value={data.company.about} onChange={(v) => update("company.about", v)} multiline span={2} />
              <Field label="Mission" value={data.company.mission} onChange={(v) => update("company.mission", v)} multiline span={2} />
              <Field label="Address" value={data.company.address} onChange={(v) => update("company.address", v)} icon={<MapPin className="w-4 h-4" />} />
              <Field label="City" value={data.company.city} onChange={(v) => update("company.city", v)} />
              <Field label="State" value={data.company.state} onChange={(v) => update("company.state", v)} />
              <Field label="Country" value={data.company.country} onChange={(v) => update("company.country", v)} />
              <Field label="Phone" value={data.company.phones?.[0]} onChange={(v) => update("company.phones", [v])} icon={<Phone className="w-4 h-4" />} />
              <Field label="Email" value={data.company.emails?.[0]} onChange={(v) => update("company.emails", [v])} icon={<Mail className="w-4 h-4" />} />
              <Field label="Website" value={data.company.website} onChange={(v) => update("company.website", v)} span={2} />
            </div>
          </Section>
          <Section title="Call-to-Action Button">
            <p className="text-sm text-muted-foreground mb-3">
              Configure the main CTA button shown in your site header and hero section. Point it to your online shop, booking page, or any external URL.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Button Text" value={data.company.ctaText || ""} onChange={(v) => update("company.ctaText", v)} icon={<Star className="w-4 h-4" />} />
              <Field label="Button URL" value={data.company.ctaUrl || ""} onChange={(v) => update("company.ctaUrl", v)} icon={<ExternalLink className="w-4 h-4" />} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Examples: "Shop Now" → https://your-store.com &nbsp;|&nbsp; "Book Appointment" → https://calendly.com/you &nbsp;|&nbsp; Leave empty to link to your contact page.
            </p>
          </Section>
          <Section title="About Page Illustration">
            <p className="text-sm text-muted-foreground mb-3">Replace the About page illustration (SVG artwork) with your own image.</p>
            <ImagePicker
              label="About Section Image"
              value={data.aboutImage || data.pageImages?.about || ""}
              onChange={(v) => { update("aboutImage", v); update("pageImages", { ...(data.pageImages || {}), about: v }); }}
              onBrowse={openPicker}
              onUpload={(f) => uploadImageToSite(f, "about")}
              onAiGenerate={aiGenerateImage}
            />
          </Section>
        </div>
      )}

      {/* Links */}
      {activeTab === "links" && data && (
        <div className="space-y-6">
          <Section title="Navigation Links">
            <p className="text-sm text-muted-foreground mb-3">
              These appear in the header navbar. Point them to your site pages or external URLs (e.g. your shop).
            </p>
            <div className="space-y-3">
              {(data.navLinks || []).map((link, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                  <Field label="" value={link.label} onChange={(v) => { const links = [...(data.navLinks || [])]; links[i] = { ...links[i], label: v }; update("navLinks", links); }} />
                  <Field label="" value={link.href} onChange={(v) => { const links = [...(data.navLinks || [])]; links[i] = { ...links[i], href: v }; update("navLinks", links); }} />
                  <button onClick={() => { const links = [...(data.navLinks || [])]; links.splice(i, 1); update("navLinks", links); }} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <button onClick={() => update("navLinks", [...(data.navLinks || []), { label: "New Link", href: "/" }])} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-dashed border-border rounded-lg hover:border-primary/50 text-muted-foreground hover:text-primary">
                <Plus className="w-3.5 h-3.5" /> Add Nav Link
              </button>
            </div>
          </Section>

          <Section title="Footer Links">
            <p className="text-sm text-muted-foreground mb-3">
              Additional links shown in the footer (legal pages, extra pages, external links). Navigation links also appear in the footer automatically.
            </p>
            <div className="space-y-3">
              {(data.footerLinks || []).map((link, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                  <Field label="" value={link.label} onChange={(v) => { const links = [...(data.footerLinks || [])]; links[i] = { ...links[i], label: v }; update("footerLinks", links); }} />
                  <Field label="" value={link.href} onChange={(v) => { const links = [...(data.footerLinks || [])]; links[i] = { ...links[i], href: v }; update("footerLinks", links); }} />
                  <button onClick={() => { const links = [...(data.footerLinks || [])]; links.splice(i, 1); update("footerLinks", links); }} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <button onClick={() => update("footerLinks", [...(data.footerLinks || []), { label: "New Link", href: "/" }])} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-dashed border-border rounded-lg hover:border-primary/50 text-muted-foreground hover:text-primary">
                <Plus className="w-3.5 h-3.5" /> Add Footer Link
              </button>
            </div>
          </Section>

          <Section title="How Links Work">
            <div className="text-sm text-muted-foreground space-y-2">
              <p><strong>Internal pages:</strong> Use paths like <code className="px-1 py-0.5 bg-muted rounded text-xs">/about</code> or <code className="px-1 py-0.5 bg-muted rounded text-xs">/contact</code></p>
              <p><strong>Your shop:</strong> Use full URLs like <code className="px-1 py-0.5 bg-muted rounded text-xs">https://your-store.com</code> or <code className="px-1 py-0.5 bg-muted rounded text-xs">https://your-store.com/products</code></p>
              <p><strong>CTA button:</strong> Edit in the Company tab under "Call-to-Action Button"</p>
            </div>
          </Section>
        </div>
      )}

      {/* AI Section Update */}
      {activeTab === "ai-update" && (
        <div className="space-y-6">
          <SectionUpdater
            apiBase={`/api/websites/${id}/update-section`}
            onUpdated={() => rebuild()}
          />
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <h3 className="text-sm font-semibold mb-2">What can AI update?</h3>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li>Change layouts, colors, fonts, spacing</li>
              <li>Add new content sections or features</li>
              <li>Update hero images, slideshow, animations</li>
              <li>Modify navigation, footer, header</li>
              <li>Add registration forms, contact forms</li>
              <li>Update company info, stats, team members</li>
              <li>Any design or content change you can describe</li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === "domains" && <DomainsTab websiteSlug={website.slug} customDomain={website.customDomain} />}

      {/* Build */}
      {activeTab === "build" && (
        <Section title="Build Status">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-medium">Status:</span>
            {website.buildStatus === "built" ? <span className="flex items-center gap-1 text-sm text-green-600"><Check className="w-4 h-4" /> Live</span>
             : website.buildStatus === "building" ? <span className="flex items-center gap-1 text-sm text-blue-600"><Loader2 className="w-4 h-4 animate-spin" /> Building...</span>
             : website.buildStatus === "error" ? <span className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="w-4 h-4" /> Error</span>
             : <span className="text-sm text-muted-foreground">Idle</span>}
          </div>
          {website.lastBuildAt && <p className="text-sm text-muted-foreground mb-4">Last: {new Date(website.lastBuildAt).toLocaleString()}</p>}
          {website.buildStatus === "error" && website.lastBuildError && (
            <>
              <pre className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs rounded-lg overflow-auto max-h-60 mb-4">{website.lastBuildError}</pre>
              <div className="flex items-center gap-3">
                <button onClick={rebuild} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50">
                  {rebuilding ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Rebuilding...</> : <><RefreshCw className="w-3.5 h-3.5" /> Retry Build</>}
                </button>
                <ReportErrorButton websiteId={id} />
              </div>
            </>
          )}
        </Section>
      )}

      {/* Unsaved bar */}
      {changed && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-amber-50 dark:bg-amber-900/30 border-t border-amber-200 px-6 py-3 flex items-center justify-between">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Unsaved changes</p>
          <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save & Rebuild
          </button>
        </div>
      )}

      {/* Media Library Picker */}
      {pickerOpen && (
        <MediaLibraryPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={(url) => { if (pickerCallback) pickerCallback(url); setPickerOpen(false); }}
          filterTypes={["image"]}
        />
      )}
    </div>
  );
}

// --- Sub-components ---

function ReportErrorButton({ websiteId }: { websiteId: string }) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const report = async () => {
    setSending(true);
    try {
      await fetch(`/api/websites/${websiteId}/report-error`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      setSent(true);
    } catch {}
    setSending(false);
  };

  if (sent) return <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400"><Check className="w-4 h-4" /> Reported — our team will look into it</span>;

  return (
    <button onClick={report} disabled={sending} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50">
      {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-3.5 h-3.5" />}
      Report to Admin
    </button>
  );
}

function DomainsTab({ websiteSlug, customDomain }: { websiteSlug: string; customDomain?: string | null }) {
  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-2">Custom Domain</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Your site is currently accessible at:
        </p>
        <div className="p-3 bg-muted/30 rounded-lg border border-border mb-6">
          <code className="text-sm font-mono">{customDomain || `flowsmartly.com/sites/${websiteSlug}`}</code>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          To use a custom domain (e.g. <strong>yourbusiness.com</strong>), go to the Domains page to register a new domain or connect one you already own. Once set up, your website will be accessible at your custom domain.
        </p>
        <a href="/domains" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-all">
          <Globe className="w-4 h-4" />
          Manage Domains
        </a>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, multiline, span, icon }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; span?: number; icon?: React.ReactNode }) {
  return (
    <div className={span === 2 ? "md:col-span-2" : ""}>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</div>}
        {multiline ? (
          <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={3} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
        ) : (
          <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} className={`w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary ${icon ? "pl-10" : ""}`} />
        )}
      </div>
    </div>
  );
}

function ImagePicker({ label, value, onChange, onBrowse, onUpload, onAiGenerate, compact, square }: {
  label?: string; value?: string; onChange: (url: string) => void;
  onBrowse: (cb: (url: string) => void) => void;
  onUpload: (file: File) => Promise<string>;
  onAiGenerate?: (prompt: string, category: string) => Promise<string | null>;
  compact?: boolean; square?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = await onUpload(file);
    if (path) onChange(path);
    setUploading(false);
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || !onAiGenerate) return;
    setAiGenerating(true);
    setAiError(null);
    try {
      const path = await onAiGenerate(aiPrompt, "generated");
      if (path) { onChange(path); setShowAiDialog(false); setAiPrompt(""); setAiError(null); }
    } catch (err: any) {
      setAiError(err.message || "Generation failed. Please try again.");
    }
    setAiGenerating(false);
  };

  const size = compact ? (square ? "w-24 h-24" : "w-32 h-24") : "w-full aspect-video";

  return (
    <div>
      {label && <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>}
      <div className={`relative group ${size} rounded-lg overflow-hidden border border-border bg-muted/30`}>
        {value ? (
          <>
            <img src={value} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button onClick={() => onBrowse(onChange)} className="p-1.5 bg-white/20 backdrop-blur rounded-lg text-white hover:bg-white/30" title="Browse"><ImageIcon className="w-4 h-4" /></button>
              <button onClick={() => fileRef.current?.click()} className="p-1.5 bg-white/20 backdrop-blur rounded-lg text-white hover:bg-white/30" title="Upload"><Upload className="w-4 h-4" /></button>
              {onAiGenerate && <button onClick={() => setShowAiDialog(true)} className="p-1.5 bg-purple-500/50 backdrop-blur rounded-lg text-white hover:bg-purple-500/70" title="Generate with AI"><Star className="w-4 h-4" /></button>}
              <button onClick={() => onChange("")} className="p-1.5 bg-white/20 backdrop-blur rounded-lg text-white hover:bg-red-500/50" title="Remove"><X className="w-4 h-4" /></button>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1">
            {uploading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : (
              <div className="flex gap-1">
                <button onClick={() => onBrowse(onChange)} className="p-1.5 hover:bg-muted rounded" title="Browse"><ImageIcon className="w-4 h-4 text-muted-foreground" /></button>
                <button onClick={() => fileRef.current?.click()} className="p-1.5 hover:bg-muted rounded" title="Upload"><Upload className="w-4 h-4 text-muted-foreground" /></button>
                {onAiGenerate && <button onClick={() => setShowAiDialog(true)} className="p-1.5 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded" title="AI Generate"><Star className="w-4 h-4 text-purple-500" /></button>}
              </div>
            )}
            <span className="text-[10px] text-muted-foreground">{uploading ? "Uploading..." : "Add image"}</span>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

      {/* AI Image Generation Dialog */}
      {showAiDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => !aiGenerating && setShowAiDialog(false)}>
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            {aiGenerating ? (
              <AIGenerationLoader compact currentStep="Generating image..." subtitle="This may take a few seconds" />
            ) : (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-5 h-5 text-purple-500" />
                  <h3 className="text-lg font-semibold">Generate Image with AI</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">Describe the image you want. AI will generate a professional image.</p>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g., Modern church interior with warm lighting and wooden pews, congregation worshipping together"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-purple-500/30 resize-none mb-4"
                />
                {aiError && (
                  <div className="flex items-start gap-2 p-3 mb-4 text-sm text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{aiError}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
                    Cost: <strong>15 credits ($0.15)</strong>
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setShowAiDialog(false)} className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted">Cancel</button>
                    <button onClick={handleAiGenerate} disabled={!aiPrompt.trim()} className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50">
                      <Star className="w-3.5 h-3.5" /> Generate
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
