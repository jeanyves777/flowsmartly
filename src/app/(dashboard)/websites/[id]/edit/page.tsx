"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ExternalLink, RefreshCw, Loader2, Check, AlertCircle, Globe,
  FileText, Save, Plus, Trash2, Link2, Upload, X, Image as ImageIcon,
  Phone, Mail, MapPin, Star, Users, MessageSquare, HelpCircle, Flag, AlertTriangle, Sparkles, Rocket,
} from "lucide-react";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { AIGenerationLoader } from "@/components/shared/ai-generation-loader";
import { SectionUpdater } from "@/components/shared/section-updater";

interface Website {
  id: string; name: string; slug: string; status: string; buildStatus: string;
  lastBuildAt?: string; lastBuildError?: string; siteData: string;
  customDomain?: string | null;
  generatorVersion?: string;
  ssrPort?: number | null;
  ssrStatus?: string | null;
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
  const [isUpgrading, setIsUpgrading] = useState(false);
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

  const handleUpgradeToV3 = async () => {
    setIsUpgrading(true);
    setBuildResult(null);
    setBuildStep("Starting V3 SSR upgrade...");
    await fetch(`/api/websites/${id}/upgrade-v3`, { method: "POST" });
    setBuildStep("Converting to V3 SSR — compiling...");
    poll("upgrade");
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
        setIsUpgrading(false);
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

  const busy = rebuilding || fixingLinks || saving || isUpgrading;
  // Build tabs dynamically from detected pages + data sections
  const hasImageHero = !!(data?.heroImages?.length || data?.logo);
  const tabs: Array<{ id: string; label: string; icon: any }> = [
    { id: "preview", label: "Preview", icon: Globe },
  ];
  if (hasImageHero) tabs.push({ id: "hero", label: "Hero & Branding", icon: ImageIcon });
  tabs.push({ id: "company", label: "Company", icon: FileText });
  if (data?.services?.length) tabs.push({ id: "services", label: "Services", icon: Star });
  if (data?.team?.length || pages.some((p) => p.slug === "team")) tabs.push({ id: "team", label: "Team", icon: Users });
  if (data?.testimonials?.length || pages.some((p) => p.slug === "testimonials")) tabs.push({ id: "reviews", label: "Reviews", icon: MessageSquare });
  if (data?.faq?.length || pages.some((p) => p.slug === "faq")) tabs.push({ id: "faq", label: "FAQ", icon: HelpCircle });
  if (data?.blogPosts?.length || pages.some((p) => p.slug === "blog")) tabs.push({ id: "blog", label: "Blog", icon: FileText });
  if (data?.galleryImages?.length || pages.some((p) => p.slug === "gallery")) tabs.push({ id: "gallery", label: "Gallery", icon: ImageIcon });
  tabs.push({ id: "ai-update", label: "AI Update", icon: Sparkles });
  tabs.push({ id: "links", label: "Links", icon: Link2 });
  tabs.push({ id: "domains", label: "Domains", icon: Globe });

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

      {/* V2 → V3 Upgrade Banner */}
      {website.generatorVersion !== "v3" && !isUpgrading && (
        <div className="mb-4 flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Legacy V2 static site</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Upgrade to V3 SSR for a self-contained app with better analytics, API proxy support, and full VPS portability.
            </p>
          </div>
          <button
            onClick={handleUpgradeToV3}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 shrink-0"
          >
            <Rocket className="w-3 h-3" />
            Upgrade to V3 SSR
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* Build Progress Overlay */}
      {(rebuilding || fixingLinks || saving || isUpgrading) && buildStep && (
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
      {activeTab === "hero" && data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Section title="Logo">
              <ImagePicker label="Site Logo" value={data.logo} onChange={(v) => { update("logo", v); }} onBrowse={openPicker} onUpload={(f) => uploadImageToSite(f, "brand")} onAiGenerate={aiGenerateImage} compact square />
            </Section>
            <Section title="About Page Image">
              <p className="text-sm text-muted-foreground mb-3">Replaces the About page illustration with your own photo.</p>
              <ImagePicker
                label=""
                value={data.aboutImage || data.pageImages?.about || ""}
                onChange={(v) => { update("aboutImage", v); update("pageImages", { ...(data.pageImages || {}), about: v }); }}
                onBrowse={openPicker}
                onUpload={(f) => uploadImageToSite(f, "about")}
                onAiGenerate={aiGenerateImage}
              />
            </Section>
          </div>
          <Section title="Hero Slideshow Images">
            <p className="text-sm text-muted-foreground mb-3">Images for the hero section slideshow. Upload your own or pick from your media library.</p>
            <div className="grid grid-cols-2 gap-3">
              {(data.heroImages || []).map((img, i) => (
                <div key={i} className="relative group aspect-video rounded-lg overflow-hidden border border-border bg-muted">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => { const imgs = [...(data.heroImages || [])]; imgs.splice(i, 1); update("heroImages", imgs); }} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                </div>
              ))}
              <button onClick={() => openPicker((url) => update("heroImages", [...(data.heroImages || []), url]))} className="aspect-video rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors">
                <Plus className="w-5 h-5" /><span className="text-xs">Add Image</span>
              </button>
            </div>
          </Section>
        </div>
      )}

      {/* Company */}
      {activeTab === "company" && data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
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
          </div>
          <div className="space-y-6">
            <Section title="Call-to-Action Button">
              <p className="text-sm text-muted-foreground mb-4">
                The main CTA button shown in your header and hero section. Point it to your shop, booking page, or any URL.
              </p>
              <div className="space-y-3">
                <Field label="Button Text" value={data.company.ctaText || ""} onChange={(v) => update("company.ctaText", v)} icon={<Star className="w-4 h-4" />} />
                <Field label="Button URL" value={data.company.ctaUrl || ""} onChange={(v) => update("company.ctaUrl", v)} icon={<ExternalLink className="w-4 h-4" />} />
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Leave empty to link to your contact page.
              </p>
              <div className="mt-4 p-3 bg-muted/40 rounded-lg space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Examples</p>
                <p className="text-xs text-muted-foreground">"Shop Now" → your-store.com</p>
                <p className="text-xs text-muted-foreground">"Book Now" → calendly.com/you</p>
                <p className="text-xs text-muted-foreground">"Get Quote" → /contact</p>
              </div>
            </Section>
            <Section title="About Page Image">
              <p className="text-sm text-muted-foreground mb-3">Replace the About page illustration with your own photo. Also editable in the Hero & Branding tab.</p>
              <ImagePicker
                label=""
                value={data.aboutImage || data.pageImages?.about || ""}
                onChange={(v) => { update("aboutImage", v); update("pageImages", { ...(data.pageImages || {}), about: v }); }}
                onBrowse={openPicker}
                onUpload={(f) => uploadImageToSite(f, "about")}
                onAiGenerate={aiGenerateImage}
              />
            </Section>
          </div>
        </div>
      )}

      {/* Services */}
      {activeTab === "services" && data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Services ({data.services.length})</h2>
            <button onClick={() => { const s = [...data.services, { id: `svc-${Date.now()}`, title: "", shortDescription: "", description: "", icon: "Star", image: "" }]; update("services", s); }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg"><Plus className="w-3.5 h-3.5" /> Add</button>
          </div>
          {data.services.map((svc, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start gap-4">
                {/* Service Image */}
                <ImagePicker label="" value={svc.image} onChange={(v) => { const s = [...data.services]; s[i] = { ...s[i], image: v }; update("services", s); }} onBrowse={openPicker} onUpload={(f) => uploadImageToSite(f, "services")} onAiGenerate={aiGenerateImage} compact />
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Service {i + 1}</span>
                    <button onClick={() => { const s = data.services.filter((_, j) => j !== i); update("services", s); }} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Title" value={svc.title} onChange={(v) => { const s = [...data.services]; s[i] = { ...s[i], title: v }; update("services", s); }} />
                    <Field label="Icon (Lucide)" value={svc.icon} onChange={(v) => { const s = [...data.services]; s[i] = { ...s[i], icon: v }; update("services", s); }} />
                  </div>
                  <Field label="Short Description" value={svc.shortDescription} onChange={(v) => { const s = [...data.services]; s[i] = { ...s[i], shortDescription: v }; update("services", s); }} />
                  <Field label="Full Description" value={svc.description} onChange={(v) => { const s = [...data.services]; s[i] = { ...s[i], description: v }; update("services", s); }} multiline />
                  <Field label="Link URL (optional — e.g. shop product page)" value={svc.link || ""} onChange={(v) => { const s = [...data.services]; s[i] = { ...s[i], link: v }; update("services", s); }} icon={<ExternalLink className="w-4 h-4" />} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Team */}
      {activeTab === "team" && data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Team Members ({data.team?.length || 0})</h2>
            <button onClick={() => update("team", [...(data.team || []), { name: "", role: "", bio: "", image: "" }])} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg"><Plus className="w-3.5 h-3.5" /> Add</button>
          </div>
          {(data.team || []).map((member, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start gap-4">
                <ImagePicker label="" value={member.image} onChange={(v) => { const t = [...(data.team || [])]; t[i] = { ...t[i], image: v }; update("team", t); }} onBrowse={openPicker} onUpload={(f) => uploadImageToSite(f, "team")} onAiGenerate={aiGenerateImage} compact square />
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Member {i + 1}</span>
                    <button onClick={() => { const t = (data.team || []).filter((_, j) => j !== i); update("team", t); }} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Name" value={member.name} onChange={(v) => { const t = [...(data.team || [])]; t[i] = { ...t[i], name: v }; update("team", t); }} />
                    <Field label="Role" value={member.role} onChange={(v) => { const t = [...(data.team || [])]; t[i] = { ...t[i], role: v }; update("team", t); }} />
                  </div>
                  <Field label="Bio" value={member.bio} onChange={(v) => { const t = [...(data.team || [])]; t[i] = { ...t[i], bio: v }; update("team", t); }} multiline />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reviews & Stats */}
      {activeTab === "reviews" && data && (
        <div className="space-y-6">
          <Section title="Statistics">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {data.stats.map((s, i) => (
                <div key={i} className="text-center space-y-1">
                  <input type="number" value={s.value} onChange={(e) => { const st = [...data.stats]; st[i] = { ...st[i], value: Number(e.target.value) || 0 }; update("stats", st); }} className="w-full text-2xl font-bold text-center px-2 py-1 border border-border rounded-lg bg-background" />
                  <input type="text" value={s.label} onChange={(e) => { const st = [...data.stats]; st[i] = { ...st[i], label: e.target.value }; update("stats", st); }} className="w-full text-xs text-center px-2 py-1 border border-border rounded-lg bg-background" />
                </div>
              ))}
            </div>
          </Section>
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Testimonials ({data.testimonials?.length || 0})</h2>
              <button onClick={() => update("testimonials", [...(data.testimonials || []), { name: "", role: "", text: "", rating: 5 }])} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg"><Plus className="w-3.5 h-3.5" /> Add</button>
            </div>
            {(data.testimonials || []).map((t, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground">Review {i + 1}</span>
                  <button onClick={() => update("testimonials", (data.testimonials || []).filter((_, j) => j !== i))} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <Field label="Name" value={t.name} onChange={(v) => { const ts = [...(data.testimonials || [])]; ts[i] = { ...ts[i], name: v }; update("testimonials", ts); }} />
                  <Field label="Role" value={t.role} onChange={(v) => { const ts = [...(data.testimonials || [])]; ts[i] = { ...ts[i], role: v }; update("testimonials", ts); }} />
                  <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Rating</label>
                    <select value={t.rating} onChange={(e) => { const ts = [...(data.testimonials || [])]; ts[i] = { ...ts[i], rating: Number(e.target.value) }; update("testimonials", ts); }} className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background">
                      {[5,4,3,2,1].map((r) => <option key={r} value={r}>{r} Stars</option>)}
                    </select>
                  </div>
                </div>
                <Field label="Review" value={t.text} onChange={(v) => { const ts = [...(data.testimonials || [])]; ts[i] = { ...ts[i], text: v }; update("testimonials", ts); }} multiline />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAQ */}
      {activeTab === "faq" && data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">FAQ ({data.faq?.length || 0})</h2>
            <button onClick={() => update("faq", [...(data.faq || []), { question: "", answer: "" }])} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg"><Plus className="w-3.5 h-3.5" /> Add</button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(data.faq || []).map((item, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground">Question {i + 1}</span>
                  <button onClick={() => update("faq", (data.faq || []).filter((_, j) => j !== i))} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
                <Field label="Question" value={item.question} onChange={(v) => { const f = [...(data.faq || [])]; f[i] = { ...f[i], question: v }; update("faq", f); }} />
                <div className="mt-3"><Field label="Answer" value={item.answer} onChange={(v) => { const f = [...(data.faq || [])]; f[i] = { ...f[i], answer: v }; update("faq", f); }} multiline /></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blog */}
      {activeTab === "blog" && data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Blog Posts ({data.blogPosts?.length || 0})</h2>
            <button onClick={() => update("blogPosts", [...(data.blogPosts || []), { id: `post-${Date.now()}`, title: "", excerpt: "", content: "", category: "", date: new Date().toISOString().split("T")[0], author: "", image: "" }])} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg"><Plus className="w-3.5 h-3.5" /> Add Post</button>
          </div>
          {(data.blogPosts || []).map((post, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start gap-4">
                <ImagePicker label="" value={post.image} onChange={(v) => { const p = [...(data.blogPosts || [])]; p[i] = { ...p[i], image: v }; update("blogPosts", p); }} onBrowse={openPicker} onUpload={(f) => uploadImageToSite(f, "blog")} onAiGenerate={aiGenerateImage} compact />
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Post {i + 1}</span>
                    <button onClick={() => update("blogPosts", (data.blogPosts || []).filter((_, j) => j !== i))} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Title" value={post.title} onChange={(v) => { const p = [...(data.blogPosts || [])]; p[i] = { ...p[i], title: v }; update("blogPosts", p); }} />
                    <Field label="Category" value={post.category} onChange={(v) => { const p = [...(data.blogPosts || [])]; p[i] = { ...p[i], category: v }; update("blogPosts", p); }} />
                    <Field label="Author" value={post.author} onChange={(v) => { const p = [...(data.blogPosts || [])]; p[i] = { ...p[i], author: v }; update("blogPosts", p); }} />
                    <Field label="Date" value={post.date} onChange={(v) => { const p = [...(data.blogPosts || [])]; p[i] = { ...p[i], date: v }; update("blogPosts", p); }} />
                  </div>
                  <Field label="Excerpt" value={post.excerpt} onChange={(v) => { const p = [...(data.blogPosts || [])]; p[i] = { ...p[i], excerpt: v }; update("blogPosts", p); }} />
                  <Field label="Content" value={post.content} onChange={(v) => { const p = [...(data.blogPosts || [])]; p[i] = { ...p[i], content: v }; update("blogPosts", p); }} multiline />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Gallery */}
      {activeTab === "gallery" && data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Gallery Images ({data.galleryImages?.length || 0})</h2>
            <button onClick={() => openPicker((url) => update("galleryImages", [...(data.galleryImages || []), { src: url, alt: "", category: "" }]))} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg"><Plus className="w-3.5 h-3.5" /> Add Image</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {(data.galleryImages || []).map((img, i) => (
              <div key={i} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                  {img.src ? (
                    <img src={img.src} alt={img.alt} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground"><ImageIcon className="w-8 h-8" /></div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button onClick={() => openPicker((url) => { const g = [...(data.galleryImages || [])]; g[i] = { ...g[i], src: url }; update("galleryImages", g); })} className="p-1.5 bg-white/20 backdrop-blur rounded-lg text-white"><ImageIcon className="w-4 h-4" /></button>
                    <button onClick={() => update("galleryImages", (data.galleryImages || []).filter((_, j) => j !== i))} className="p-1.5 bg-white/20 backdrop-blur rounded-lg text-white hover:bg-red-500/50"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <input type="text" value={img.alt || ""} onChange={(e) => { const g = [...(data.galleryImages || [])]; g[i] = { ...g[i], alt: e.target.value }; update("galleryImages", g); }} placeholder="Alt text" className="w-full mt-1 px-2 py-1 text-xs border border-border rounded bg-background" />
                <input type="text" value={img.category || ""} onChange={(e) => { const g = [...(data.galleryImages || [])]; g[i] = { ...g[i], category: e.target.value }; update("galleryImages", g); }} placeholder="Category" className="w-full mt-1 px-2 py-1 text-xs border border-border rounded bg-background" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Domains */}
      {/* Links */}
      {activeTab === "links" && data && (() => {
        // Compute available pages not yet in nav
        const navHrefs = new Set((data.navLinks || []).map((l) => {
          const h = l.href.replace(/^\/sites\/[^/]+/, "");
          return h === "" ? "/" : h;
        }));
        const availablePages = pages.filter((p) => {
          const href = p.slug === "" ? "/" : `/${p.slug}`;
          return !navHrefs.has(href);
        });

        return (
        <div className="space-y-6">
          {/* Available Pages — quick add */}
          {availablePages.length > 0 && (
            <Section title="Available Pages">
              <p className="text-sm text-muted-foreground mb-3">
                These pages are built but not visible in your menu. Click to add them to navigation.
              </p>
              <div className="flex flex-wrap gap-2">
                {availablePages.map((p) => (
                  <button
                    key={p.slug}
                    onClick={() => {
                      const href = p.slug === "" ? "/" : `/${p.slug}`;
                      update("navLinks", [...(data.navLinks || []), { label: p.label, href }]);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-primary/5 text-foreground transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-primary" />
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                <Sparkles className="w-3 h-3 inline mr-1" />
                After adding a page, use the <strong>AI Update</strong> tab to enhance its content with your business info.
              </p>
            </Section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

            <div className="space-y-6">
              <Section title="Footer Links">
                <p className="text-sm text-muted-foreground mb-3">
                  Extra links in the footer (legal pages, external links). Nav links also appear in footer automatically.
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
                  <p><strong>Your shop:</strong> Use full URLs like <code className="px-1 py-0.5 bg-muted rounded text-xs">https://your-store.com</code></p>
                  <p><strong>CTA button:</strong> Edit in the Company tab under "Call-to-Action Button"</p>
                </div>
              </Section>
            </div>
          </div>
        </div>
        );
      })()}

      {/* AI Section Update */}
      {activeTab === "ai-update" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SectionUpdater
              apiBase={`/api/websites/${id}/update-section`}
              onUpdated={() => rebuild()}
            />
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> What can AI update?</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span> Change layouts, colors, fonts, spacing</li>
              <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span> Add new content sections or features</li>
              <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span> Update hero images, slideshow, animations</li>
              <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span> Modify navigation, footer, header</li>
              <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span> Add registration forms, contact forms</li>
              <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span> Update company info, stats, team members</li>
              <li className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span> Any design or content change you can describe</li>
            </ul>
            <div className="mt-5 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-800 dark:text-amber-300 font-medium mb-1">Tip</p>
              <p className="text-xs text-amber-700 dark:text-amber-400">Be specific! "Make the hero section have a dark gradient overlay with white text" works better than "update the hero".</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "domains" && <DomainsTab websiteSlug={website.slug} customDomain={website.customDomain} />}

      {/* Build */}
      {activeTab === "build" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section title="Build Status">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-medium">Status:</span>
              {website.buildStatus === "built" ? <span className="flex items-center gap-1 text-sm text-green-600"><Check className="w-4 h-4" /> Live</span>
               : website.buildStatus === "building" ? <span className="flex items-center gap-1 text-sm text-blue-600"><Loader2 className="w-4 h-4 animate-spin" /> Building...</span>
               : website.buildStatus === "error" ? <span className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="w-4 h-4" /> Error</span>
               : <span className="text-sm text-muted-foreground">Idle</span>}
            </div>

            {/* V3 SSR Process Status */}
            {website.generatorVersion === "v3" && website.ssrStatus && (
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm font-medium">App Process:</span>
                {website.ssrStatus === "running" ? <span className="flex items-center gap-1.5 text-sm text-green-600"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Running on port {website.ssrPort}</span>
                 : website.ssrStatus === "starting" ? <span className="flex items-center gap-1.5 text-sm text-blue-600"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Starting...</span>
                 : website.ssrStatus === "stopped" ? <span className="flex items-center gap-1.5 text-sm text-amber-600"><span className="w-2 h-2 rounded-full bg-amber-500" /> Stopped (auto-starts on visit)</span>
                 : website.ssrStatus === "error" ? <span className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="w-4 h-4" /> Process Error</span>
                 : null}
              </div>
            )}

            {/* Version badge */}
            {website.generatorVersion === "v3" && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">V3 Independent SSR</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Self-Hostable</span>
              </div>
            )}

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
            {website.buildStatus === "built" && (
              <div className="mt-2">
                <button onClick={rebuild} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50">
                  {rebuilding ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Building...</> : <><RefreshCw className="w-3.5 h-3.5" /> Rebuild Site</>}
                </button>
              </div>
            )}
          </Section>

          {/* Deploy to VPS — future feature */}
          {website.generatorVersion === "v3" ? (
            <Section title="Deploy to Your Server">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm mb-1">Self-Host Your Website</h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Your website is a complete, independent application. Deploy it on your own VPS for full control — your own server, zero platform dependency.
                  </p>
                  <button
                    disabled
                    className="flex items-center gap-1.5 px-4 py-2 text-sm border border-border rounded-lg font-medium text-muted-foreground cursor-not-allowed opacity-60"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Deploy to VPS — Coming Soon
                  </button>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Purchase a VPS plan to unlock one-click deployment to your own server.
                  </p>
                </div>
              </div>
            </Section>
          ) : (
            <Section title="When to Rebuild">
              <div className="space-y-3 text-sm text-muted-foreground">
                <p className="flex items-start gap-2"><Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" /> After saving changes to text, images, or links</p>
                <p className="flex items-start gap-2"><Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" /> After using AI Update to redesign a section</p>
                <p className="flex items-start gap-2"><Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" /> When your domain DNS settings are updated</p>
                <p className="flex items-start gap-2"><AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" /> Build takes 30–90 seconds depending on site size</p>
              </div>
            </Section>
          )}
        </div>
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-2">Current URL</h2>
        <p className="text-sm text-muted-foreground mb-4">Your site is accessible at:</p>
        <div className="p-3 bg-muted/30 rounded-lg border border-border mb-5">
          <code className="text-sm font-mono break-all">{customDomain ? `https://${customDomain}` : `flowsmartly.com/sites/${websiteSlug}`}</code>
        </div>
        {customDomain ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 mb-5">
            <Check className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
            <p className="text-sm text-green-700 dark:text-green-300">Custom domain is active</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mb-5">
            To use a custom domain like <strong>yourbusiness.com</strong>, go to the Domains page to register or connect one you own.
          </p>
        )}
        <a href="/domains" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-all">
          <Globe className="w-4 h-4" />
          Manage Domains
        </a>
      </div>
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-2">Custom Domain Setup</h2>
        <p className="text-sm text-muted-foreground mb-4">Steps to connect your own domain:</p>
        <ol className="space-y-4">
          {[
            { step: "1", title: "Register or use existing domain", desc: "Buy a new domain on the Domains page or use one you already own." },
            { step: "2", title: "Add domain to this website", desc: "On the Domains page, click your domain and link it to this website." },
            { step: "3", title: "Update DNS records", desc: "Point your domain's A record to our server IP. Instructions shown after linking." },
            { step: "4", title: "Wait for propagation", desc: "DNS changes take 5–30 minutes to go live worldwide." },
          ].map(({ step, title, desc }) => (
            <li key={step} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{step}</span>
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </li>
          ))}
        </ol>
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
