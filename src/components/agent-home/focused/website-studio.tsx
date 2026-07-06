"use client";

import { useCallback, useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import {
  Globe, Sparkles, ExternalLink, RefreshCw, Save, Plus, Trash2, Link2, Upload, X,
  Image as ImageIcon, Phone, Mail, MapPin, Star, Users, MessageSquare, HelpCircle,
  ArrowLeft, Check, AlertTriangle, AlertCircle, FileText, Rocket, Wand2, Flag,
  Palette, Server, ListTree, Building2, Layers,
} from "lucide-react";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Website Studio — the full new-design site editor (replaces the legacy
 * /websites/[id]/edit page). It reuses ALL the existing website APIs
 * (site-data, update-data, update-section, rebuild, publish, generate-image,
 * upload-image, blog-posts, report-error, upgrade-v3) so there is ONE backend
 * and no duplicated build logic — this is purely a robust new-design shell over
 * the same engine. Domains route to the in-app Domains surface (never legacy).
 * [[new-design-no-legacy]] [[full-width-left-menu-layout]]
 */

interface Website {
  id: string; name: string; slug: string; status: string; buildStatus: string;
  lastBuildAt?: string; lastBuildError?: string | null; customDomain?: string | null;
  generatorVersion?: string; ssrPort?: number | null; ssrStatus?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
interface SiteData {
  company: Record<string, Any>;
  heroImages?: string[];
  logo?: string;
  aboutImage?: string;
  pageImages?: Record<string, string>;
  services: Array<Record<string, Any>>;
  stats: Array<{ label: string; value: number }>;
  team?: Array<Record<string, Any>>;
  testimonials?: Array<Record<string, Any>>;
  testimonialsLayout?: string;
  googleReviews?: {
    enabled: boolean; businessName: string; rating: number; totalReviews: number;
    googleUrl: string; reviews: Array<{ name: string; date: string; rating: number; text: string }>;
  };
  contactInfo?: { mapEmbedUrl?: string; mapAddress?: string };
  faq?: Array<{ question: string; answer: string }>;
  blogPosts?: Array<Record<string, Any>>;
  galleryCategories?: string[];
  galleryImages?: Array<Record<string, Any>>;
  navLinks?: Array<{ href: string; label: string }>;
  footerLinks?: Array<{ href: string; label: string }>;
}

interface BlogActivity { id: string; title: string; source: string; status: string; publishedAt?: string | null; createdAt: string; }

const F = "w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60";
const isBuildingStatus = (s?: string) => s === "building" || s === "deploying";

type TabId =
  | "preview" | "hero" | "company" | "services" | "team" | "reviews"
  | "faq" | "blog" | "gallery" | "contact" | "links" | "ai" | "domains" | "status";

export function WebsiteStudio({ siteId, onBack, onOpenView, onAsk }: {
  siteId: string;
  onBack: () => void;
  onOpenView?: (key: string) => void;
  onAsk?: (prompt: string) => void;
}) {
  const [website, setWebsite] = useState<Website | null>(null);
  const [data, setData] = useState<SiteData | null>(null);
  const [pages, setPages] = useState<Array<{ slug: string; label: string }>>([]);
  const [blogActivity, setBlogActivity] = useState<BlogActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("preview");
  const [changed, setChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [buildStep, setBuildStep] = useState("");
  const [buildResult, setBuildResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [previewPage, setPreviewPage] = useState("");
  const [previewNonce, setPreviewNonce] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerCb = useRef<((url: string) => void) | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const busy = saving || rebuilding || upgrading;

  const loadWebsite = useCallback(async () => {
    const r = await fetch(`/api/websites/${siteId}`).then((x) => x.json()).catch(() => null);
    if (r?.website) setWebsite(r.website);
    return r?.website as Website | undefined;
  }, [siteId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      await Promise.all([
        loadWebsite(),
        fetch(`/api/websites/${siteId}/site-data`).then((r) => r.json()).catch(() => null).then((d) => {
          if (!alive || !d) return;
          if (d.data) setData(d.data);
          if (Array.isArray(d.pages)) setPages(d.pages);
        }),
        fetch(`/api/websites/${siteId}/blog-posts`).then((r) => r.json()).catch(() => null).then((d) => {
          if (alive && d?.success) setBlogActivity(d.posts || []);
        }),
      ]);
      if (alive) { setLoading(false); setPreviewNonce(Date.now()); }
    })();
    return () => { alive = false; if (pollRef.current) clearInterval(pollRef.current); };
  }, [siteId, loadWebsite]);

  // Deep-set a value at a dotted path and mark the form dirty.
  const update = useCallback((path: string, value: Any) => {
    setData((prev) => {
      if (!prev) return prev;
      const d = JSON.parse(JSON.stringify(prev));
      const parts = path.split(".");
      let obj: Any = d;
      for (let i = 0; i < parts.length - 1; i++) {
        const k = isNaN(Number(parts[i])) ? parts[i] : Number(parts[i]);
        if (obj[k] == null) obj[k] = isNaN(Number(parts[i + 1])) ? {} : [];
        obj = obj[k];
      }
      obj[parts[parts.length - 1]] = value;
      return d;
    });
    setChanged(true);
  }, []);

  const openPicker = useCallback((cb: (url: string) => void) => { pickerCb.current = cb; setPickerOpen(true); }, []);

  const uploadImageToSite = useCallback(async (file: File, category: string): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", category);
    const d = await fetch(`/api/websites/${siteId}/upload-image`, { method: "POST", body: fd }).then((r) => r.json()).catch(() => null);
    return d?.path || "";
  }, [siteId]);

  const aiGenerateImage = useCallback(async (prompt: string, category: string): Promise<string | null> => {
    const res = await fetch(`/api/websites/${siteId}/generate-image`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, category }),
    });
    const d = await res.json().catch(() => null);
    if (!res.ok) throw new Error(d?.error || "Couldn't generate that image.");
    setBuildResult({ type: "success", message: `Image generated (${d?.cost ?? 15} credits).` });
    setTimeout(() => setBuildResult(null), 3000);
    return d?.path || null;
  }, [siteId]);

  // Poll until the build finishes; refresh the preview iframe on success.
  const startPoll = useCallback(() => {
    if (pollRef.current) return;
    let elapsed = 0;
    pollRef.current = setInterval(async () => {
      elapsed += 3;
      const w = await loadWebsite();
      if (!w) return;
      if (w.buildStatus === "deploying") setBuildStep("Deploying your site…");
      else if (elapsed < 15) setBuildStep("Building your website…");
      else if (elapsed < 45) setBuildStep("Compiling pages…");
      else setBuildStep("Almost done…");
      if (!isBuildingStatus(w.buildStatus)) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        setRebuilding(false); setUpgrading(false); setBuildStep("");
        if (w.buildStatus === "built") {
          const nonce = Date.now();
          setPreviewNonce(nonce);
          if (iframeRef.current) iframeRef.current.src = previewSrc(w, previewPage, nonce);
          setBuildResult({ type: "success", message: "Your site is updated and live." });
          setTimeout(() => setBuildResult(null), 5000);
        } else {
          setBuildResult({ type: "error", message: w.lastBuildError?.substring(0, 200) || "The build failed. Open Status to retry or report it." });
          setActiveTab("preview");
        }
      }
    }, 3000);
  }, [loadWebsite, previewPage]);

  const rebuild = useCallback(async () => {
    setRebuilding(true); setBuildResult(null); setBuildStep("Syncing your content…");
    try {
      const r = await fetch(`/api/websites/${siteId}/rebuild`, { method: "POST" });
      if (!r.ok) { const j = await r.json().catch(() => null); throw new Error(j?.error || "Rebuild failed to start."); }
      setBuildStep("Installing & building…");
      startPoll();
    } catch (e) {
      setRebuilding(false); setBuildStep("");
      setBuildResult({ type: "error", message: e instanceof Error ? e.message : "Rebuild failed." });
    }
  }, [siteId, startPoll]);

  const save = useCallback(async () => {
    if (!data) return;
    setSaving(true); setBuildResult(null); setBuildStep("Saving your changes…");
    try {
      const r = await fetch(`/api/websites/${siteId}/update-data`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || "Couldn't save your changes.");
      setChanged(false);
      setSaving(false);
      await rebuild();
    } catch (e) {
      setSaving(false); setBuildStep("");
      setBuildResult({ type: "error", message: e instanceof Error ? e.message : "Couldn't save." });
    }
  }, [data, siteId, rebuild]);

  const publish = useCallback(async () => {
    setBuildResult(null);
    const r = await fetch(`/api/websites/${siteId}/publish`, { method: "POST" });
    const j = await r.json().catch(() => null);
    if (!r.ok) { setBuildResult({ type: "error", message: j?.error || "Publish failed." }); return; }
    await loadWebsite();
    setBuildResult({ type: "success", message: "Your site is published." });
    setTimeout(() => setBuildResult(null), 4000);
  }, [siteId, loadWebsite]);

  const upgradeV3 = useCallback(async () => {
    setUpgrading(true); setBuildResult(null); setBuildStep("Upgrading to the self-contained V3 engine…");
    await fetch(`/api/websites/${siteId}/upgrade-v3`, { method: "POST" }).catch(() => {});
    startPoll();
  }, [siteId, startPoll]);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Opening the studio…" /></div>;
  }
  if (!website) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center p-8 text-center">
        <div>
          <p className="text-[14px] font-semibold">We couldn&apos;t open that site.</p>
          <button onClick={onBack} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold hover:border-brand-500/60"><ArrowLeft className="h-3.5 w-3.5" /> Back to sites</button>
        </div>
      </div>
    );
  }

  const published = website.status?.toUpperCase() === "PUBLISHED";
  const building = isBuildingStatus(website.buildStatus);
  const buildError = website.buildStatus === "error";
  const liveUrl = website.customDomain ? `https://${website.customDomain}` : `/sites/${website.slug}/`;

  // Tabs are dynamic — only show a content section if the site actually has it.
  const has = (fn: () => boolean) => { try { return fn(); } catch { return false; } };
  const tabs: { id: TabId; label: string; icon: ElementType }[] = [
    { id: "preview", label: "Preview", icon: Globe },
  ];
  if (has(() => !!(data?.heroImages?.length || data?.logo))) tabs.push({ id: "hero", label: "Hero & Branding", icon: ImageIcon });
  tabs.push({ id: "company", label: "Company", icon: Building2 });
  if (has(() => !!data?.services?.length)) tabs.push({ id: "services", label: "Services", icon: Star });
  if (has(() => !!(data?.team?.length || pages.some((p) => p.slug === "team")))) tabs.push({ id: "team", label: "Team", icon: Users });
  if (has(() => !!(data?.testimonials?.length || pages.some((p) => p.slug === "testimonials")))) tabs.push({ id: "reviews", label: "Reviews", icon: MessageSquare });
  if (has(() => !!(data?.faq?.length || pages.some((p) => p.slug === "faq")))) tabs.push({ id: "faq", label: "FAQ", icon: HelpCircle });
  if (has(() => !!(data?.blogPosts?.length || pages.some((p) => p.slug === "blog")))) tabs.push({ id: "blog", label: "Blog", icon: FileText });
  if (has(() => !!(data?.galleryImages?.length || pages.some((p) => p.slug === "gallery")))) tabs.push({ id: "gallery", label: "Gallery", icon: Layers });
  tabs.push({ id: "contact", label: "Contact", icon: MapPin });
  tabs.push({ id: "links", label: "Links", icon: Link2 });
  tabs.push({ id: "ai", label: "AI Redesign", icon: Wand2 });
  tabs.push({ id: "domains", label: "Domains", icon: Globe });
  tabs.push({ id: "status", label: "Status", icon: Server });

  const primaryLabel = busy ? (saving ? "Saving…" : upgrading ? "Upgrading…" : "Building…") : changed ? "Save & rebuild" : "Rebuild";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
        {/* LEFT: sticky header + tab nav */}
        <aside className="space-y-3 lg:sticky lg:top-0 lg:w-[260px] lg:shrink-0">
          <div className="rounded-2xl border border-border bg-card p-3">
            <button onClick={onBack} className="mb-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> All sites</button>
            <div className="flex items-start gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Globe className="h-4.5 w-4.5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold leading-tight">{website.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{website.customDomain || `/sites/${website.slug}`}</p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-1.5">
              <StatusBadge status={website.status} build={website.buildStatus} />
              {changed && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-500">Unsaved</span>}
            </div>
          </div>

          <nav className="rounded-2xl border border-border bg-card p-1.5">
            {tabs.map((t) => {
              const active = activeTab === t.id;
              return (
                <button key={t.id} onClick={() => setActiveTab(t.id)} className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-semibold transition-colors", active ? "bg-brand-500/10 text-brand-500" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}>
                  <t.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-start">{t.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* RIGHT: sticky action bar + tab content */}
        <div className="min-w-0 flex-1 space-y-4">
          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-3.5 py-2.5">
            <h2 className="text-[13px] font-bold">{tabs.find((t) => t.id === activeTab)?.label}</h2>
            <div className="ms-auto flex flex-wrap items-center gap-2">
              {website.buildStatus === "built" && (
                <a href={liveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /> View</a>
              )}
              {!published && website.buildStatus === "built" && (
                <button onClick={publish} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground"><Rocket className="h-3.5 w-3.5" /> Publish</button>
              )}
              <button onClick={changed ? save : rebuild} disabled={busy} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-1.5 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">
                {busy ? <FlowLoader size={14} tone="white" /> : changed ? <Save className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {primaryLabel}
              </button>
            </div>
          </div>

          {/* V2 → V3 upgrade nudge */}
          {website.generatorVersion !== "v3" && !upgrading && (
            <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-amber-600 dark:text-amber-400">Legacy V2 site</p>
                <p className="text-[11.5px] text-muted-foreground">Upgrade to the self-contained V3 engine for better analytics and full portability.</p>
              </div>
              <button onClick={upgradeV3} disabled={busy} className="inline-flex items-center gap-1.5 rounded-[10px] bg-amber-500 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"><Rocket className="h-3.5 w-3.5" /> Upgrade</button>
            </div>
          )}

          {/* Build progress + result toasts */}
          {busy && buildStep && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-brand-500/30 bg-brand-500/5 px-4 py-3 text-[12.5px] text-brand-500"><FlowLoader size={16} /> {buildStep}<span className="ms-auto text-[11px] text-muted-foreground">usually 30–60s</span></div>
          )}
          {buildResult && (
            <div className={cn("flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-[12.5px]", buildResult.type === "success" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400" : "border-rose-500/30 bg-rose-500/5 text-rose-500")}>
              {buildResult.type === "success" ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              <p className="flex-1 font-medium">{buildResult.message}</p>
              <button onClick={() => setBuildResult(null)} className="opacity-70 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}

          {/* ── Tab content ─────────────────────────────────────────────── */}
          {activeTab === "preview" && (
            <PreviewTab website={website} pages={pages} previewPage={previewPage} previewNonce={previewNonce} iframeRef={iframeRef}
              onSelectPage={(slug) => { const nonce = Date.now(); setPreviewNonce(nonce); setPreviewPage(slug); if (iframeRef.current) iframeRef.current.src = previewSrc(website, slug, nonce); }}
              onRebuild={rebuild} busy={busy} rebuilding={rebuilding} siteId={siteId} />
          )}

          {activeTab === "hero" && data && (
            <HeroTab data={data} update={update} openPicker={openPicker} uploadImageToSite={uploadImageToSite} aiGenerateImage={aiGenerateImage} />
          )}
          {activeTab === "company" && data && (
            <CompanyTab data={data} update={update} openPicker={openPicker} uploadImageToSite={uploadImageToSite} aiGenerateImage={aiGenerateImage} />
          )}
          {activeTab === "services" && data && (
            <ServicesTab data={data} update={update} openPicker={openPicker} uploadImageToSite={uploadImageToSite} aiGenerateImage={aiGenerateImage} />
          )}
          {activeTab === "team" && data && (
            <TeamTab data={data} update={update} openPicker={openPicker} uploadImageToSite={uploadImageToSite} aiGenerateImage={aiGenerateImage} />
          )}
          {activeTab === "reviews" && data && (
            <ReviewsTab data={data} update={update} openPicker={openPicker} uploadImageToSite={uploadImageToSite} aiGenerateImage={aiGenerateImage} />
          )}
          {activeTab === "faq" && data && <FaqTab data={data} update={update} />}
          {activeTab === "blog" && data && (
            <BlogTab data={data} update={update} openPicker={openPicker} uploadImageToSite={uploadImageToSite} aiGenerateImage={aiGenerateImage} blogActivity={blogActivity} />
          )}
          {activeTab === "gallery" && data && <GalleryTab data={data} update={update} openPicker={openPicker} />}
          {activeTab === "contact" && data && <ContactTab data={data} update={update} />}
          {activeTab === "links" && data && <LinksTab data={data} update={update} pages={pages} />}
          {activeTab === "ai" && <AiRedesignTab siteId={siteId} onRebuild={rebuild} onAsk={onAsk} siteName={website.name} />}
          {activeTab === "domains" && <DomainsTab website={website} onOpenView={onOpenView} />}
          {activeTab === "status" && <StatusTab website={website} siteId={siteId} onRebuild={rebuild} busy={busy} rebuilding={rebuilding} />}
        </div>
      </div>

      {pickerOpen && (
        <MediaLibraryPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={(url) => { pickerCb.current?.(url); setPickerOpen(false); }}
          filterTypes={["image"]}
        />
      )}
    </div>
  );
}

function previewSrc(w: Website, page: string, nonce: number) {
  const pagePath = page ? `/${page}` : "/";
  return `/sites/${w.slug}${pagePath}?preview=${encodeURIComponent(`${w.lastBuildAt || w.buildStatus}-${nonce}`)}`;
}

/* ── Tabs ─────────────────────────────────────────────────────────────── */

function PreviewTab({ website, pages, previewPage, previewNonce, iframeRef, onSelectPage, onRebuild, busy, rebuilding, siteId }: {
  website: Website; pages: Array<{ slug: string; label: string }>; previewPage: string; previewNonce: number;
  iframeRef: React.RefObject<HTMLIFrameElement | null>; onSelectPage: (slug: string) => void; onRebuild: () => void; busy: boolean; rebuilding: boolean; siteId: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2">
        <div className="flex gap-1.5"><span className="h-3 w-3 rounded-full bg-rose-400" /><span className="h-3 w-3 rounded-full bg-amber-400" /><span className="h-3 w-3 rounded-full bg-emerald-400" /></div>
        <span className="flex-1 truncate text-center text-[11px] text-muted-foreground">{website.customDomain ? `${website.customDomain}/${previewPage}` : `flowsmartly.com/sites/${website.slug}/${previewPage}`}</span>
      </div>
      {pages.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b border-border bg-muted/10 px-3 py-2">
          {pages.map((p) => (
            <button key={p.slug} onClick={() => onSelectPage(p.slug)} className={cn("whitespace-nowrap rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors", previewPage === p.slug ? "bg-brand-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/70")}>{p.label}</button>
          ))}
        </div>
      )}
      {website.buildStatus === "built" ? (
        <iframe key={`${website.slug}-${previewPage}-${previewNonce}`} ref={iframeRef} src={previewSrc(website, previewPage, previewNonce)} className="h-[74vh] w-full border-0" />
      ) : website.buildStatus === "error" ? (
        <div className="px-6 py-16 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-rose-500/10 text-rose-500"><AlertTriangle className="h-7 w-7" /></span>
          <h3 className="mt-3 text-[15px] font-semibold text-rose-600 dark:text-rose-400">Build failed</h3>
          <p className="mx-auto mt-1 max-w-md text-[12.5px] text-muted-foreground">Something broke while building. Rebuild to retry, or report it to our team.</p>
          {website.lastBuildError && <pre className="mx-auto mt-3 max-h-32 max-w-lg overflow-auto rounded-lg bg-rose-500/5 p-3 text-left text-[11px] text-rose-600 dark:text-rose-300">{website.lastBuildError.substring(0, 300)}</pre>}
          <div className="mt-4 flex items-center justify-center gap-2">
            <button onClick={onRebuild} disabled={busy} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60">{rebuilding ? <FlowLoader size={14} tone="white" /> : <RefreshCw className="h-3.5 w-3.5" />} Try rebuild</button>
            <ReportErrorButton siteId={siteId} />
          </div>
        </div>
      ) : (
        <div className="px-6 py-20 text-center">
          <p className="mb-3 text-[13px] text-muted-foreground">{isBuildingStatus(website.buildStatus) ? "Building…" : "Not built yet."}</p>
          {!isBuildingStatus(website.buildStatus) && <button onClick={onRebuild} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white"><RefreshCw className="h-3.5 w-3.5" /> Build now</button>}
        </div>
      )}
    </div>
  );
}

type EditorProps = {
  data: SiteData;
  update: (path: string, value: Any) => void;
  openPicker: (cb: (url: string) => void) => void;
  uploadImageToSite: (file: File, category: string) => Promise<string>;
  aiGenerateImage: (prompt: string, category: string) => Promise<string | null>;
};

function HeroTab({ data, update, openPicker, uploadImageToSite, aiGenerateImage }: EditorProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Section title="Logo" hint="Shown in your header, footer, and browser tab.">
          <ImagePicker value={data.logo && data.logo !== "__svg__" ? data.logo : ""} onChange={(v) => update("logo", v)} onBrowse={openPicker} onUpload={(f) => uploadImageToSite(f, "brand")} onAiGenerate={aiGenerateImage} compact square />
        </Section>
        <Section title="About page image" hint="Replaces the About illustration with your own photo.">
          <ImagePicker value={data.aboutImage || data.pageImages?.about || ""} onChange={(v) => { update("aboutImage", v); update("pageImages", { ...(data.pageImages || {}), about: v }); }} onBrowse={openPicker} onUpload={(f) => uploadImageToSite(f, "about")} onAiGenerate={aiGenerateImage} />
        </Section>
      </div>
      <Section title="Hero slideshow images" hint="Upload your own or pick from your media library.">
        <div className="grid grid-cols-2 gap-3">
          {(data.heroImages || []).map((img, i) => (
            <div key={i} className="group relative aspect-video overflow-hidden rounded-lg border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" className="h-full w-full object-cover" />
              <button onClick={() => { const imgs = [...(data.heroImages || [])]; imgs.splice(i, 1); update("heroImages", imgs); }} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-rose-500 text-white opacity-0 transition-opacity group-hover:opacity-100"><X className="h-3 w-3" /></button>
            </div>
          ))}
          <button onClick={() => openPicker((url) => update("heroImages", [...(data.heroImages || []), url]))} className="grid aspect-video place-items-center gap-1 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-brand-500/50 hover:text-brand-500">
            <Plus className="h-5 w-5" /><span className="text-[11px]">Add image</span>
          </button>
        </div>
      </Section>
    </div>
  );
}

function CompanyTab({ data, update, openPicker, uploadImageToSite, aiGenerateImage }: EditorProps) {
  const c = data.company || {};
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Section title="Company information">
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <Field label="Company name" value={c.name} onChange={(v) => update("company.name", v)} />
            <Field label="Short name" value={c.shortName} onChange={(v) => update("company.shortName", v)} />
            <Field label="Tagline" value={c.tagline} onChange={(v) => update("company.tagline", v)} span={2} />
            <Field label="Description" value={c.description} onChange={(v) => update("company.description", v)} multiline span={2} />
            <Field label="About" value={c.about} onChange={(v) => update("company.about", v)} multiline span={2} />
            <Field label="Mission" value={c.mission} onChange={(v) => update("company.mission", v)} multiline span={2} />
            <Field label="Address" value={c.address} onChange={(v) => update("company.address", v)} icon={MapPin} />
            <Field label="City" value={c.city} onChange={(v) => update("company.city", v)} />
            <Field label="State" value={c.state} onChange={(v) => update("company.state", v)} />
            <Field label="Country" value={c.country} onChange={(v) => update("company.country", v)} />
            <Field label="Phone" value={c.phones?.[0]} onChange={(v) => update("company.phones", [v])} icon={Phone} />
            <Field label="Email" value={c.emails?.[0]} onChange={(v) => update("company.emails", [v])} icon={Mail} />
            <Field label="Website" value={c.website} onChange={(v) => update("company.website", v)} span={2} />
          </div>
        </Section>
      </div>
      <div className="space-y-4">
        <Section title="Call-to-action button" hint="The main button in your header & hero. Point it at your shop, booking page, or any URL.">
          <div className="space-y-3">
            <Field label="Button text" value={c.ctaText || ""} onChange={(v) => update("company.ctaText", v)} icon={Star} />
            <Field label="Button URL" value={c.ctaUrl || ""} onChange={(v) => update("company.ctaUrl", v)} icon={ExternalLink} />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Leave empty to link to your contact page.</p>
        </Section>
        <Section title="About page image">
          <ImagePicker value={data.aboutImage || data.pageImages?.about || ""} onChange={(v) => { update("aboutImage", v); update("pageImages", { ...(data.pageImages || {}), about: v }); }} onBrowse={openPicker} onUpload={(f) => uploadImageToSite(f, "about")} onAiGenerate={aiGenerateImage} />
        </Section>
      </div>
    </div>
  );
}

function ServicesTab({ data, update, openPicker, uploadImageToSite, aiGenerateImage }: EditorProps) {
  const services = data.services || [];
  return (
    <div className="space-y-3">
      <RowHeader title={`Services (${services.length})`} onAdd={() => update("services", [...services, { id: `svc-${Date.now()}`, title: "", shortDescription: "", description: "", icon: "Star", image: "" }])} />
      {services.map((svc, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-4">
            <ImagePicker value={svc.image} onChange={(v) => { const s = [...services]; s[i] = { ...s[i], image: v }; update("services", s); }} onBrowse={openPicker} onUpload={(f) => uploadImageToSite(f, "services")} onAiGenerate={aiGenerateImage} compact />
            <div className="min-w-0 flex-1 space-y-3">
              <ItemHeader label={`Service ${i + 1}`} onRemove={() => update("services", services.filter((_, j) => j !== i))} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Title" value={svc.title} onChange={(v) => { const s = [...services]; s[i] = { ...s[i], title: v }; update("services", s); }} />
                <Field label="Icon (Lucide name)" value={svc.icon} onChange={(v) => { const s = [...services]; s[i] = { ...s[i], icon: v }; update("services", s); }} />
              </div>
              <Field label="Short description" value={svc.shortDescription} onChange={(v) => { const s = [...services]; s[i] = { ...s[i], shortDescription: v }; update("services", s); }} />
              <Field label="Full description" value={svc.description} onChange={(v) => { const s = [...services]; s[i] = { ...s[i], description: v }; update("services", s); }} multiline />
              <Field label="Link URL (optional)" value={svc.link || ""} onChange={(v) => { const s = [...services]; s[i] = { ...s[i], link: v }; update("services", s); }} icon={ExternalLink} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TeamTab({ data, update, openPicker, uploadImageToSite, aiGenerateImage }: EditorProps) {
  const team = data.team || [];
  return (
    <div className="space-y-3">
      <RowHeader title={`Team (${team.length})`} onAdd={() => update("team", [...team, { name: "", role: "", bio: "", image: "" }])} />
      {team.map((m, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-4">
            <ImagePicker value={m.image} onChange={(v) => { const t = [...team]; t[i] = { ...t[i], image: v }; update("team", t); }} onBrowse={openPicker} onUpload={(f) => uploadImageToSite(f, "team")} onAiGenerate={aiGenerateImage} compact square />
            <div className="min-w-0 flex-1 space-y-3">
              <ItemHeader label={`Member ${i + 1}`} onRemove={() => update("team", team.filter((_, j) => j !== i))} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name" value={m.name} onChange={(v) => { const t = [...team]; t[i] = { ...t[i], name: v }; update("team", t); }} />
                <Field label="Role" value={m.role} onChange={(v) => { const t = [...team]; t[i] = { ...t[i], role: v }; update("team", t); }} />
              </div>
              <Field label="Bio" value={m.bio} onChange={(v) => { const t = [...team]; t[i] = { ...t[i], bio: v }; update("team", t); }} multiline />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewsTab({ data, update, openPicker, uploadImageToSite, aiGenerateImage }: EditorProps) {
  const stats = data.stats || [];
  const testimonials = data.testimonials || [];
  const gr = data.googleReviews;
  return (
    <div className="space-y-4">
      <Section title="Statistics">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s, i) => (
            <div key={i} className="space-y-1 text-center">
              <input type="number" value={s.value} onChange={(e) => { const st = [...stats]; st[i] = { ...st[i], value: Number(e.target.value) || 0 }; update("stats", st); }} className="w-full rounded-lg border border-border bg-background px-2 py-1 text-center text-[18px] font-bold outline-none focus:border-brand-500/60" />
              <input type="text" value={s.label} onChange={(e) => { const st = [...stats]; st[i] = { ...st[i], label: e.target.value }; update("stats", st); }} className="w-full rounded-lg border border-border bg-background px-2 py-1 text-center text-[11px] outline-none focus:border-brand-500/60" />
            </div>
          ))}
          {stats.length === 0 && <p className="col-span-full text-[12px] text-muted-foreground">No stats on this site.</p>}
        </div>
      </Section>

      <div>
        <RowHeader title={`Testimonials (${testimonials.length})`} onAdd={() => update("testimonials", [...testimonials, { name: "", role: "", text: "", rating: 5, image: "", video: "" }])} />
        <div className="mb-3 mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Layout:</span>
          {["cards", "carousel", "list", "masonry"].map((l) => (
            <button key={l} onClick={() => update("testimonialsLayout", l)} className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize transition", (data.testimonialsLayout || "cards") === l ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/40")}>{l}</button>
          ))}
        </div>
        <div className="space-y-3">
          {testimonials.map((t, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4">
              <ItemHeader label={`Review ${i + 1}`} onRemove={() => update("testimonials", testimonials.filter((_, j) => j !== i))} />
              <div className="mt-3 flex gap-4">
                <ImagePicker value={t.image || ""} onChange={(v) => { const ts = [...testimonials]; ts[i] = { ...ts[i], image: v }; update("testimonials", ts); }} onBrowse={openPicker} onUpload={(f) => uploadImageToSite(f, "testimonials")} onAiGenerate={aiGenerateImage} compact square />
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label="Name" value={t.name} onChange={(v) => { const ts = [...testimonials]; ts[i] = { ...ts[i], name: v }; update("testimonials", ts); }} />
                    <Field label="Role" value={t.role} onChange={(v) => { const ts = [...testimonials]; ts[i] = { ...ts[i], role: v }; update("testimonials", ts); }} />
                    <label className="block">
                      <span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">Rating</span>
                      <select value={t.rating} onChange={(e) => { const ts = [...testimonials]; ts[i] = { ...ts[i], rating: Number(e.target.value) }; update("testimonials", ts); }} className={F}>{[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} stars</option>)}</select>
                    </label>
                  </div>
                  <Field label="Review text" value={t.text} onChange={(v) => { const ts = [...testimonials]; ts[i] = { ...ts[i], text: v }; update("testimonials", ts); }} multiline />
                  <Field label="Video URL (optional)" value={t.video || ""} onChange={(v) => { const ts = [...testimonials]; ts[i] = { ...ts[i], video: v }; update("testimonials", ts); }} icon={Upload} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Section title="Google Reviews">
        <div className="flex items-center gap-3">
          <Switch on={!!gr?.enabled} onToggle={() => update("googleReviews", { ...(gr || { businessName: "", rating: 5, totalReviews: 0, googleUrl: "", reviews: [] }), enabled: !gr?.enabled })} />
          <span className="text-[12.5px] font-medium">Show a Google Reviews section on your site</span>
        </div>
        {gr?.enabled && (
          <div className="mt-3 space-y-3 border-t border-border pt-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Business name" value={gr.businessName || ""} onChange={(v) => update("googleReviews", { ...gr, businessName: v })} icon={Star} />
              <Field label="Google Maps / Reviews URL" value={gr.googleUrl || ""} onChange={(v) => update("googleReviews", { ...gr, googleUrl: v })} icon={ExternalLink} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">Overall rating</span><input type="number" step="0.1" min="1" max="5" value={gr.rating || 5} onChange={(e) => update("googleReviews", { ...gr, rating: Number(e.target.value) })} className={F} /></label>
              <label className="block"><span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">Total reviews</span><input type="number" min="0" value={gr.totalReviews || 0} onChange={(e) => update("googleReviews", { ...gr, totalReviews: Number(e.target.value) })} className={F} /></label>
            </div>
            <RowHeader small title={`Individual reviews (${gr.reviews?.length || 0})`} onAdd={() => update("googleReviews", { ...gr, reviews: [...(gr.reviews || []), { name: "", date: "", rating: 5, text: "" }] })} />
            {(gr.reviews || []).map((rv, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                <ItemHeader label={`Review ${i + 1}`} onRemove={() => update("googleReviews", { ...gr, reviews: (gr.reviews || []).filter((_, j) => j !== i) })} />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Field label="Name" value={rv.name} onChange={(v) => { const rs = [...(gr.reviews || [])]; rs[i] = { ...rs[i], name: v }; update("googleReviews", { ...gr, reviews: rs }); }} />
                  <Field label="Date" value={rv.date} onChange={(v) => { const rs = [...(gr.reviews || [])]; rs[i] = { ...rs[i], date: v }; update("googleReviews", { ...gr, reviews: rs }); }} />
                  <label className="block"><span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">Rating</span><select value={rv.rating} onChange={(e) => { const rs = [...(gr.reviews || [])]; rs[i] = { ...rs[i], rating: Number(e.target.value) }; update("googleReviews", { ...gr, reviews: rs }); }} className={F}>{[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} stars</option>)}</select></label>
                </div>
                <Field label="Review text" value={rv.text} onChange={(v) => { const rs = [...(gr.reviews || [])]; rs[i] = { ...rs[i], text: v }; update("googleReviews", { ...gr, reviews: rs }); }} multiline />
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function FaqTab({ data, update }: Pick<EditorProps, "data" | "update">) {
  const faq = data.faq || [];
  return (
    <div className="space-y-3">
      <RowHeader title={`FAQ (${faq.length})`} onAdd={() => update("faq", [...faq, { question: "", answer: "" }])} />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {faq.map((item, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4">
            <ItemHeader label={`Question ${i + 1}`} onRemove={() => update("faq", faq.filter((_, j) => j !== i))} />
            <div className="mt-2 space-y-3">
              <Field label="Question" value={item.question} onChange={(v) => { const f = [...faq]; f[i] = { ...f[i], question: v }; update("faq", f); }} />
              <Field label="Answer" value={item.answer} onChange={(v) => { const f = [...faq]; f[i] = { ...f[i], answer: v }; update("faq", f); }} multiline />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BlogTab({ data, update, openPicker, uploadImageToSite, aiGenerateImage, blogActivity }: EditorProps & { blogActivity: BlogActivity[] }) {
  const posts = data.blogPosts || [];
  return (
    <div className="space-y-3">
      <RowHeader title={`Blog posts (${posts.length})`} addLabel="Add post" onAdd={() => update("blogPosts", [...posts, { id: `post-${Date.now()}`, title: "", excerpt: "", content: "", category: "", date: new Date().toISOString().split("T")[0], author: "", image: "" }])} />
      {blogActivity.length > 0 && (
        <Section title="Automation activity" hint={`${blogActivity.length} generated`}>
          <div className="space-y-2">
            {blogActivity.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
                <div className="min-w-0"><p className="truncate text-[12.5px] font-medium">{p.title}</p><p className="text-[11px] text-muted-foreground">{p.source === "AUTOMATION" ? "Strategy automation" : "Manual"} · {new Date(p.publishedAt || p.createdAt).toLocaleDateString()}</p></div>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-600">{p.status}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
      {posts.map((post, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-4">
            <ImagePicker value={post.image} onChange={(v) => { const p = [...posts]; p[i] = { ...p[i], image: v }; update("blogPosts", p); }} onBrowse={openPicker} onUpload={(f) => uploadImageToSite(f, "blog")} onAiGenerate={aiGenerateImage} compact />
            <div className="min-w-0 flex-1 space-y-3">
              <ItemHeader label={`Post ${i + 1}`} onRemove={() => update("blogPosts", posts.filter((_, j) => j !== i))} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Title" value={post.title} onChange={(v) => { const p = [...posts]; p[i] = { ...p[i], title: v }; update("blogPosts", p); }} />
                <Field label="Category" value={post.category} onChange={(v) => { const p = [...posts]; p[i] = { ...p[i], category: v }; update("blogPosts", p); }} />
                <Field label="Author" value={post.author} onChange={(v) => { const p = [...posts]; p[i] = { ...p[i], author: v }; update("blogPosts", p); }} />
                <Field label="Date" value={post.date} onChange={(v) => { const p = [...posts]; p[i] = { ...p[i], date: v }; update("blogPosts", p); }} />
              </div>
              <Field label="Excerpt" value={post.excerpt} onChange={(v) => { const p = [...posts]; p[i] = { ...p[i], excerpt: v }; update("blogPosts", p); }} />
              <Field label="Content" value={post.content} onChange={(v) => { const p = [...posts]; p[i] = { ...p[i], content: v }; update("blogPosts", p); }} multiline />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function GalleryTab({ data, update, openPicker }: Pick<EditorProps, "data" | "update" | "openPicker">) {
  const [active, setActive] = useState("All");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const cats = Array.from(new Set([
    ...(data.galleryCategories || []).map((c) => String(c || "").trim()).filter(Boolean),
    ...(data.galleryImages || []).map((g) => String(g.category || "").trim()).filter(Boolean),
  ]));
  const activeCat = active === "All" || cats.includes(active) ? active : "All";
  const images = (data.galleryImages || []).map((img, index) => ({ img, index })).filter(({ img }) => activeCat === "All" || String(img.category || "").trim() === activeCat);
  const addImage = (category?: string) => {
    const cat = category && category !== "All" ? category : activeCat !== "All" ? activeCat : "";
    openPicker((url) => update("galleryImages", [...(data.galleryImages || []), { src: url, alt: "", category: cat }]));
  };
  const createCat = () => {
    const name = draft.trim().replace(/\s+/g, " ");
    if (!name || cats.some((c) => c.toLowerCase() === name.toLowerCase())) { setAdding(false); setDraft(""); return; }
    update("galleryCategories", [...cats, name]);
    setActive(name); setAdding(false); setDraft("");
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[14px] font-bold">Gallery ({data.galleryImages?.length || 0})</h3>
        <div className="ms-auto flex items-center gap-2">
          {adding ? (
            <div className="flex items-center gap-1.5">
              <input value={draft} autoFocus onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") createCat(); }} placeholder="Category name" className="rounded-[9px] border border-input bg-background px-2.5 py-1.5 text-[12px] outline-none focus:border-brand-500/60" />
              <button onClick={createCat} className="grid h-7 w-7 place-items-center rounded-[8px] bg-brand-500 text-white"><Check className="h-3.5 w-3.5" /></button>
              <button onClick={() => { setAdding(false); setDraft(""); }} className="grid h-7 w-7 place-items-center rounded-[8px] border border-border"><X className="h-3.5 w-3.5" /></button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60"><Plus className="h-3.5 w-3.5" /> New category</button>
          )}
          <button onClick={() => addImage()} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm"><Plus className="h-3.5 w-3.5" /> Add image</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {["All", ...cats].map((c) => (
          <button key={c} onClick={() => setActive(c)} className={cn("rounded-full border px-3 py-1 text-[12px] font-semibold transition", activeCat === c ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/40")}>{c}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map(({ img, index: i }) => (
          <div key={i} className="group">
            <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
              {img.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.src} alt={img.alt || ""} className="h-full w-full object-cover" />
              ) : <div className="grid h-full w-full place-items-center text-muted-foreground"><ImageIcon className="h-7 w-7" /></div>}
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <button onClick={() => openPicker((url) => { const g = [...(data.galleryImages || [])]; g[i] = { ...g[i], src: url }; update("galleryImages", g); })} className="grid h-8 w-8 place-items-center rounded-lg bg-white/20 text-white backdrop-blur"><ImageIcon className="h-4 w-4" /></button>
                <button onClick={() => update("galleryImages", (data.galleryImages || []).filter((_, j) => j !== i))} className="grid h-8 w-8 place-items-center rounded-lg bg-white/20 text-white backdrop-blur hover:bg-rose-500/50"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <input type="text" value={img.alt || ""} onChange={(e) => { const g = [...(data.galleryImages || [])]; g[i] = { ...g[i], alt: e.target.value }; update("galleryImages", g); }} placeholder="Alt text" className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-[11px] outline-none focus:border-brand-500/60" />
          </div>
        ))}
      </div>
      {images.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="mb-3 text-[12.5px] text-muted-foreground">No images{activeCat !== "All" ? " in this category" : ""} yet.</p>
          <button onClick={() => addImage(activeCat)} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3.5 py-2 text-[12.5px] font-semibold text-white"><Plus className="h-3.5 w-3.5" /> Add image</button>
        </div>
      )}
    </div>
  );
}

function ContactTab({ data, update }: Pick<EditorProps, "data" | "update">) {
  const c = data.company || {};
  const ci = data.contactInfo || {};
  return (
    <div className="space-y-4">
      <Section title="Contact information" hint="Shown on your contact page and in the footer.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Address" value={c.address || ""} onChange={(v) => update("company.address", v)} icon={MapPin} span={2} />
          <Field label="City" value={c.city || ""} onChange={(v) => update("company.city", v)} />
          <Field label="State / Province" value={c.state || ""} onChange={(v) => update("company.state", v)} />
          <Field label="Country" value={c.country || ""} onChange={(v) => update("company.country", v)} />
          <Field label="Phone" value={c.phones?.[0] || ""} onChange={(v) => update("company.phones", [v])} icon={Phone} />
          <Field label="Email" value={c.emails?.[0] || ""} onChange={(v) => update("company.emails", [v])} icon={Mail} />
        </div>
      </Section>
      <Section title="Google Map embed" hint="Google Maps → Share → Embed a map → copy the src URL.">
        <div className="space-y-3">
          <Field label="Google Maps embed URL" value={ci.mapEmbedUrl || ""} onChange={(v) => update("contactInfo", { ...ci, mapEmbedUrl: v })} icon={MapPin} />
          <Field label="Map address label" value={ci.mapAddress || ""} onChange={(v) => update("contactInfo", { ...ci, mapAddress: v })} icon={MapPin} />
          {ci.mapEmbedUrl && (
            <div><p className="mb-1.5 text-[11px] text-muted-foreground">Preview:</p><iframe src={ci.mapEmbedUrl} width="100%" height="220" className="rounded-lg border border-border" loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" /></div>
          )}
        </div>
      </Section>
    </div>
  );
}

function LinksTab({ data, update, pages }: Pick<EditorProps, "data" | "update"> & { pages: Array<{ slug: string; label: string }> }) {
  const navLinks = data.navLinks || [];
  const footerLinks = data.footerLinks || [];
  const navHrefs = new Set(navLinks.map((l) => { const h = l.href.replace(/^\/sites\/[^/]+/, ""); return h === "" ? "/" : h; }));
  const availablePages = pages.filter((p) => !navHrefs.has(p.slug === "" ? "/" : `/${p.slug}`));
  return (
    <div className="space-y-4">
      {availablePages.length > 0 && (
        <Section title="Available pages" hint="Built but not in your menu — click to add to navigation.">
          <div className="flex flex-wrap gap-2">
            {availablePages.map((p) => (
              <button key={p.slug} onClick={() => update("navLinks", [...navLinks, { label: p.label, href: p.slug === "" ? "/" : `/${p.slug}` }])} className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 py-2 text-[12.5px] font-semibold hover:border-brand-500/50 hover:bg-brand-500/5"><Plus className="h-3.5 w-3.5 text-brand-500" /> {p.label}</button>
            ))}
          </div>
        </Section>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Navigation links" hint="Shown in your header navbar. Point to pages or external URLs.">
          <LinkRows links={navLinks} onChange={(v) => update("navLinks", v)} addLabel="Add nav link" />
        </Section>
        <Section title="Footer links" hint="Extra footer links (legal, external). Nav links appear in the footer automatically.">
          <LinkRows links={footerLinks} onChange={(v) => update("footerLinks", v)} addLabel="Add footer link" />
        </Section>
      </div>
    </div>
  );
}

function LinkRows({ links, onChange, addLabel }: { links: Array<{ href: string; label: string }>; onChange: (v: Array<{ href: string; label: string }>) => void; addLabel: string }) {
  return (
    <div className="space-y-2.5">
      {links.map((link, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
          <input value={link.label} onChange={(e) => { const l = [...links]; l[i] = { ...l[i], label: e.target.value }; onChange(l); }} placeholder="Label" className={F} />
          <input value={link.href} onChange={(e) => { const l = [...links]; l[i] = { ...l[i], href: e.target.value }; onChange(l); }} placeholder="/about or https://…" className={F} />
          <button onClick={() => { const l = [...links]; l.splice(i, 1); onChange(l); }} className="grid h-8 w-8 place-items-center rounded-[9px] border border-border text-muted-foreground hover:border-rose-500/60 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <button onClick={() => onChange([...links, { label: "New link", href: "/" }])} className="inline-flex items-center gap-1.5 rounded-[10px] border border-dashed border-border px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:border-brand-500/50 hover:text-brand-500"><Plus className="h-3.5 w-3.5" /> {addLabel}</button>
    </div>
  );
}

/* ── AI Redesign tab — drives the SAME update-section engine, new-design UI ── */
function AiRedesignTab({ siteId, onRebuild, onAsk, siteName }: { siteId: string; onRebuild: () => void; onAsk?: (p: string) => void; siteName: string }) {
  const [sections, setSections] = useState<Array<{ id: string; label: string }>>([]);
  const [cost, setCost] = useState(50);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState("");
  const [prompt, setPrompt] = useState("");
  const [updating, setUpdating] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/websites/${siteId}/update-section`).then((r) => r.json()).catch(() => null).then((d) => {
      if (!alive || !d) return;
      setSections(d.sections || []);
      if (d.creditCost) setCost(d.creditCost);
      if (d.sections?.length) setSection(d.sections[0].id);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [siteId]);

  const run = async () => {
    if (!section || !prompt.trim()) return;
    setUpdating(true); setResult(null);
    try {
      const r = await fetch(`/api/websites/${siteId}/update-section`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, prompt: prompt.trim() }),
      });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.success) { setResult({ type: "success", message: d.message || "Section updated — rebuilding to apply." }); setPrompt(""); onRebuild(); }
      else setResult({ type: "error", message: d?.error || "The update failed." });
    } catch { setResult({ type: "error", message: "The update failed." }); }
    finally { setUpdating(false); }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Section title="AI redesign a section" hint="Pick a section and describe the change — AI rewrites the code and rebuilds.">
          {loading ? (
            <div className="grid place-items-center py-8"><FlowLoader size={22} label="Loading sections…" /></div>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">Section</span>
                <select value={section} onChange={(e) => setSection(e.target.value)} disabled={updating} className={F}>{sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">What do you want to change?</span>
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={updating} rows={4} placeholder="e.g. Make the hero a dark gradient with white text and a 3-column feature grid below it…" className={cn(F, "resize-y")} />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={run} disabled={updating || !prompt.trim() || !section} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">{updating ? <FlowLoader size={14} tone="white" /> : <Wand2 className="h-3.5 w-3.5" />} {updating ? "Updating…" : "Update section"}</button>
                <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground"><Palette className="h-3.5 w-3.5 text-amber-500" /> {cost} credits</span>
                {onAsk && <button onClick={() => onAsk(`I'm in the Website Studio for "${siteName}". I want to redesign my site — help me. Use edit_website.`)} className="ms-auto text-[11.5px] font-semibold text-brand-500 hover:underline">Ask the agent instead →</button>}
              </div>
              {result && (
                <div className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px]", result.type === "success" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400" : "border-rose-500/30 bg-rose-500/5 text-rose-500")}>
                  {result.type === "success" ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}<p>{result.message}</p>
                </div>
              )}
            </div>
          )}
        </Section>
      </div>
      <Section title="What AI can change">
        <ul className="space-y-2 text-[12px] text-muted-foreground">
          {["Layouts, colors, fonts, spacing", "Add new content sections or features", "Hero images, slideshows, animations", "Navigation, header, footer", "Contact & registration forms", "Any design change you can describe"].map((t) => (
            <li key={t} className="flex items-start gap-2"><span className="mt-0.5 text-brand-500">•</span> {t}</li>
          ))}
        </ul>
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Tip</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Be specific — &quot;a dark gradient hero with white text&quot; beats &quot;update the hero&quot;.</p>
        </div>
      </Section>
    </div>
  );
}

function DomainsTab({ website, onOpenView }: { website: Website; onOpenView?: (key: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Section title="Current URL" hint="Where your site is live right now.">
        <div className="mb-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5"><code className="break-all text-[12.5px]">{website.customDomain ? `https://${website.customDomain}` : `flowsmartly.com/sites/${website.slug}`}</code></div>
        {website.customDomain ? (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[12px] text-emerald-600 dark:text-emerald-400"><Check className="h-4 w-4 shrink-0" /> Your custom domain is active.</div>
        ) : (
          <p className="mb-3 text-[12.5px] text-muted-foreground">To use a domain like <strong>yourbusiness.com</strong>, register or connect one in the Domains surface, then link it to this site.</p>
        )}
        <button onClick={() => onOpenView?.("domains")} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm"><Globe className="h-4 w-4" /> Manage domains</button>
      </Section>
      <Section title="Custom domain setup">
        <ol className="space-y-3">
          {[
            ["1", "Register or connect a domain", "Buy a new one in Domains, or connect one you already own."],
            ["2", "Link it to this website", "In Domains, open your domain and link it to this site."],
            ["3", "Point your DNS", "Add the record we show you at your DNS provider."],
            ["4", "Wait for propagation", "DNS changes go live worldwide within 5–30 minutes."],
          ].map(([n, t, d]) => (
            <li key={n} className="flex items-start gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-500/10 text-[11px] font-bold text-brand-500">{n}</span>
              <div><p className="text-[12.5px] font-semibold">{t}</p><p className="mt-0.5 text-[11.5px] text-muted-foreground">{d}</p></div>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

function StatusTab({ website, siteId, onRebuild, busy, rebuilding }: { website: Website; siteId: string; onRebuild: () => void; busy: boolean; rebuilding: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Section title="Build status">
        <div className="flex items-center gap-2 text-[12.5px]">
          <span className="font-medium">Status:</span>
          {website.buildStatus === "built" ? <span className="inline-flex items-center gap-1 text-emerald-600"><Check className="h-4 w-4" /> Live</span>
            : isBuildingStatus(website.buildStatus) ? <span className="inline-flex items-center gap-1 text-brand-500"><FlowLoader size={14} /> {website.buildStatus === "deploying" ? "Deploying…" : "Building…"}</span>
            : website.buildStatus === "error" ? <span className="inline-flex items-center gap-1 text-rose-500"><AlertCircle className="h-4 w-4" /> Error</span>
            : <span className="text-muted-foreground">Idle</span>}
        </div>
        {website.generatorVersion === "v3" && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">V3 SSR</span>
            {website.ssrStatus && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-600">{website.ssrStatus}{website.ssrPort ? ` · :${website.ssrPort}` : ""}</span>}
          </div>
        )}
        {website.lastBuildAt && <p className="mt-2 text-[11.5px] text-muted-foreground">Last build: {new Date(website.lastBuildAt).toLocaleString()}</p>}
        {website.buildStatus === "error" && website.lastBuildError && (
          <pre className="mt-3 max-h-52 overflow-auto rounded-lg bg-rose-500/5 p-3 text-[11px] text-rose-600 dark:text-rose-300">{website.lastBuildError}</pre>
        )}
        <div className="mt-3 flex items-center gap-2">
          <button onClick={onRebuild} disabled={busy} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60">{rebuilding ? <FlowLoader size={14} tone="white" /> : <RefreshCw className="h-3.5 w-3.5" />} Rebuild site</button>
          {website.buildStatus === "error" && <ReportErrorButton siteId={siteId} />}
        </div>
      </Section>
      <Section title="When to rebuild">
        <ul className="space-y-2.5 text-[12.5px] text-muted-foreground">
          <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> After editing text, images, or links</li>
          <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> After an AI redesign of a section</li>
          <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> When your domain DNS changes</li>
          <li className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> A build takes 30–90 seconds</li>
        </ul>
      </Section>
    </div>
  );
}

function ReportErrorButton({ siteId }: { siteId: string }) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const report = async () => {
    setSending(true);
    try { await fetch(`/api/websites/${siteId}/report-error`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }); setSent(true); } catch { /* ignore */ }
    setSending(false);
  };
  if (sent) return <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-600 dark:text-emerald-400"><Check className="h-4 w-4" /> Reported — we&apos;ll look into it</span>;
  return (
    <button onClick={report} disabled={sending} className="inline-flex items-center gap-1.5 rounded-[10px] border border-rose-500/40 px-3.5 py-2 text-[12px] font-semibold text-rose-500 hover:bg-rose-500/5 disabled:opacity-60">{sending ? <FlowLoader size={14} /> : <Flag className="h-3.5 w-3.5" />} Report to admin</button>
  );
}

/* ── shared UI ────────────────────────────────────────────────────────── */

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3"><h3 className="text-[13.5px] font-bold">{title}</h3>{hint && <p className="mt-0.5 text-[11.5px] text-muted-foreground">{hint}</p>}</div>
      {children}
    </section>
  );
}

function Field({ label, value, onChange, multiline, span, icon: Icon }: { label: string; value?: string; onChange: (v: string) => void; multiline?: boolean; span?: number; icon?: ElementType }) {
  return (
    <label className={cn("block", span === 2 && "sm:col-span-2")}>
      {label && <span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">{label}</span>}
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />}
        {multiline ? (
          <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={3} className={cn(F, "resize-y")} />
        ) : (
          <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} className={cn(F, Icon && "pl-9")} />
        )}
      </div>
    </label>
  );
}

function ImagePicker({ value, onChange, onBrowse, onUpload, onAiGenerate, compact, square }: {
  value?: string;
  onChange: (url: string) => void;
  onBrowse: (cb: (url: string) => void) => void;
  onUpload: (file: File) => Promise<string>;
  onAiGenerate?: (prompt: string, category: string) => Promise<string | null>;
  compact?: boolean;
  square?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = await onUpload(file);
    if (path) onChange(path);
    setUploading(false);
  };
  const runAi = async () => {
    if (!aiPrompt.trim() || !onAiGenerate) return;
    setAiBusy(true); setAiErr(null);
    try { const path = await onAiGenerate(aiPrompt, "generated"); if (path) { onChange(path); setShowAi(false); setAiPrompt(""); } }
    catch (e) { setAiErr(e instanceof Error ? e.message : "Generation failed."); }
    finally { setAiBusy(false); }
  };
  const size = compact ? (square ? "h-24 w-24" : "h-24 w-32") : "aspect-video w-full";

  return (
    <div>
      <div className={cn("group relative overflow-hidden rounded-lg border border-border bg-muted/30", size)}>
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <IconBtn title="Browse" onClick={() => onBrowse(onChange)}><ImageIcon className="h-4 w-4" /></IconBtn>
              <IconBtn title="Upload" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /></IconBtn>
              {onAiGenerate && <IconBtn title="Generate with AI" tone="ai" onClick={() => setShowAi(true)}><Sparkles className="h-4 w-4" /></IconBtn>}
              <IconBtn title="Remove" onClick={() => onChange("")}><X className="h-4 w-4" /></IconBtn>
            </div>
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1">
            {uploading ? <FlowLoader size={18} /> : (
              <div className="flex gap-1">
                <button onClick={() => onBrowse(onChange)} title="Browse" className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-muted"><ImageIcon className="h-4 w-4" /></button>
                <button onClick={() => fileRef.current?.click()} title="Upload" className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-muted"><Upload className="h-4 w-4" /></button>
                {onAiGenerate && <button onClick={() => setShowAi(true)} title="Generate with AI" className="grid h-7 w-7 place-items-center rounded text-brand-500 hover:bg-brand-500/10"><Sparkles className="h-4 w-4" /></button>}
              </div>
            )}
            <span className="text-[10px] text-muted-foreground">{uploading ? "Uploading…" : "Add image"}</span>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

      {showAi && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => !aiBusy && setShowAi(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {aiBusy ? (
              <div className="grid place-items-center py-8"><FlowLoader size={28} withMark label="Generating your image…" /></div>
            ) : (
              <>
                <div className="mb-3 flex items-center gap-2"><Sparkles className="h-4.5 w-4.5 text-brand-500" /><h3 className="text-[14px] font-bold">Generate an image with AI</h3></div>
                <p className="mb-3 text-[12px] text-muted-foreground">Describe the image you want — AI generates a professional visual.</p>
                <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} rows={3} placeholder="e.g. Modern office interior with warm lighting, team collaborating" className={cn(F, "resize-none")} />
                {aiErr && <p className="mt-2 text-[12px] text-rose-500">{aiErr}</p>}
                <div className="mt-3 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground"><span className="h-2 w-2 rounded-full bg-amber-400" /> ~15 credits</span>
                  <div className="flex gap-2">
                    <button onClick={() => setShowAi(false)} className="rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60">Cancel</button>
                    <button onClick={runAi} disabled={!aiPrompt.trim()} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-1.5 text-[12px] font-semibold text-white shadow-sm disabled:opacity-60"><Sparkles className="h-3.5 w-3.5" /> Generate</button>
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

function IconBtn({ title, onClick, tone, children }: { title: string; onClick: () => void; tone?: "ai"; children: ReactNode }) {
  return (
    <button title={title} onClick={onClick} className={cn("grid h-8 w-8 place-items-center rounded-lg text-white backdrop-blur", tone === "ai" ? "bg-brand-500/50 hover:bg-brand-500/70" : "bg-white/20 hover:bg-white/30")}>{children}</button>
  );
}

function RowHeader({ title, onAdd, addLabel = "Add", small }: { title: string; onAdd: () => void; addLabel?: string; small?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className={cn("font-bold", small ? "text-[12.5px]" : "text-[14px]")}>{title}</h3>
      <button onClick={onAdd} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm"><Plus className="h-3.5 w-3.5" /> {addLabel}</button>
    </div>
  );
}

function ItemHeader({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
      <button onClick={onRemove} className="grid h-7 w-7 place-items-center rounded-[8px] text-muted-foreground hover:bg-rose-500/5 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-pressed={on} className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors", on ? "bg-brand-500" : "bg-muted")}>
      <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", on ? "translate-x-4" : "translate-x-0.5")} />
    </button>
  );
}

function StatusBadge({ status, build }: { status?: string; build?: string }) {
  const published = status?.toUpperCase() === "PUBLISHED";
  const building = isBuildingStatus(build);
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", building ? "bg-amber-500/10 text-amber-500" : published ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>
      {building ? "Building…" : published ? "Live" : "Draft"}
    </span>
  );
}
