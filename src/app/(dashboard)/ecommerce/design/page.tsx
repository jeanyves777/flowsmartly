"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ExternalLink, RefreshCw, Loader2, Check, AlertCircle,
  Globe, Save, Plus, Trash2, Eye, Sparkles, HelpCircle, Link2,
  Store, LayoutDashboard, Palette, Image as ImageIcon, FileText, Grid3X3,
} from "lucide-react";
import { SectionUpdater } from "@/components/shared/section-updater";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { PageLoader } from "@/components/shared/page-loader";

interface StoreRecord {
  id: string;
  name: string;
  slug: string;
  buildStatus: string;
  lastBuildAt?: string;
  lastBuildError?: string;
  ssrPort?: number | null;
  ssrStatus?: string | null;
  storeUrl?: string;
  generatorVersion?: string;
}

interface StoreInfo {
  name: string; tagline: string; description: string; about: string;
  mission: string; address: string; ctaText: string; ctaUrl: string;
  logoUrl: string; bannerUrl: string; currency: string;
}

interface HeroConfig {
  headline: string; subheadline: string; ctaText: string; ctaUrl: string;
}

interface StoreData {
  storeInfo: StoreInfo;
  heroConfig: HeroConfig;
  navLinks: Array<{ href: string; label: string }>;
  footerLinks: Array<{ href: string; label: string }>;
  faq: Array<{ question: string; answer: string }>;
  categories: Array<{ id: string; name: string; slug: string; description: string; image: string }>;
  pages: Array<{ slug: string; label: string }>;
}

const TABS = [
  { id: "preview", label: "Preview", icon: Eye },
  { id: "store-info", label: "Store Info", icon: Store },
  { id: "hero", label: "Hero", icon: LayoutDashboard },
  { id: "categories", label: "Categories", icon: Grid3X3 },
  { id: "navigation", label: "Navigation", icon: Link2 },
  { id: "faq", label: "FAQ", icon: HelpCircle },
  { id: "pages", label: "Pages", icon: FileText },
  { id: "ai-update", label: "AI Update", icon: Sparkles },
  { id: "rebuild", label: "Rebuild", icon: RefreshCw },
  { id: "domains", label: "Domains", icon: Globe },
];

export default function StoreDesignPage() {
  const searchParams = useSearchParams();
  const [store, setStore] = useState<StoreRecord | null>(null);
  const [data, setData] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [changed, setChanged] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "preview");
  const [buildResult, setBuildResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCallback, setPickerCallback] = useState<((url: string) => void) | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const storeUrl = store?.storeUrl || (store?.slug ? `/stores/${store.slug}/` : null);
  // Route preview through proxy to strip X-Frame-Options headers that nginx may add
  const previewUrl = storeUrl
    ? `/api/proxy?url=${encodeURIComponent(
        storeUrl.startsWith("http") ? storeUrl : `${typeof window !== "undefined" ? window.location.origin : ""}${storeUrl}`
      )}`
    : null;

  async function loadStoreData(storeId: string, forceRefresh = false) {
    const url = `/api/ecommerce/store/${storeId}/site-data${forceRefresh ? "?refresh=true" : ""}`;
    const dr = await fetch(url);
    if (dr.ok) setData(await dr.json());
  }

  useEffect(() => {
    fetch("/api/ecommerce/store")
      .then((r) => r.json())
      .then(async (res) => {
        const s: StoreRecord = res.data?.store ?? res.store;
        setStore(s);
        if (s?.id) {
          try { await loadStoreData(s.id); } catch {}
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function refreshData() {
    if (!store) return;
    setRefreshing(true);
    try { await loadStoreData(store.id, true); } finally { setRefreshing(false); }
  }

  function update<K extends keyof StoreData>(key: K, value: StoreData[K]) {
    setData((prev) => prev ? { ...prev, [key]: value } : prev);
    setChanged(true);
  }

  function updateInfo<K extends keyof StoreInfo>(key: K, value: string) {
    setData((prev) => prev ? { ...prev, storeInfo: { ...prev.storeInfo, [key]: value } } : prev);
    setChanged(true);
  }

  function updateHero<K extends keyof HeroConfig>(key: K, value: string) {
    setData((prev) => prev ? { ...prev, heroConfig: { ...prev.heroConfig, [key]: value } } : prev);
    setChanged(true);
  }

  function updateCategory(index: number, field: string, value: string) {
    setData((prev) => {
      if (!prev) return prev;
      const cats = [...(prev.categories || [])];
      cats[index] = { ...cats[index], [field]: value };
      return { ...prev, categories: cats };
    });
    setChanged(true);
  }

  async function save() {
    if (!store || !data) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/ecommerce/store/${store.id}/update-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (r.ok) {
        setChanged(false);
        await rebuild();
      }
    } finally {
      setSaving(false);
    }
  }

  async function rebuild() {
    if (!store) return;
    setRebuilding(true);
    setBuildResult(null);
    try {
      const r = await fetch(`/api/ecommerce/store/${store.id}/rebuild`, { method: "POST" });
      if (r.ok) {
        setBuildResult({ type: "success", message: "Rebuild started — your store will update shortly." });
      } else {
        const e = await r.json();
        setBuildResult({ type: "error", message: e.error || "Rebuild failed" });
      }
    } catch {
      setBuildResult({ type: "error", message: "Network error" });
    } finally {
      setRebuilding(false);
    }
  }

  function openPicker(cb: (url: string) => void) {
    setPickerCallback(() => cb);
    setPickerOpen(true);
  }

  if (loading) return <PageLoader />;

  if (!store) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <Palette className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-xl font-semibold mb-2">No Store Found</h1>
        <p className="text-muted-foreground mb-6">You don&apos;t have a store yet. Create one to get started.</p>
        <Link href="/ecommerce" className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
          Go to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border px-4 md:px-6 flex items-center gap-3 h-14">
        <Link href="/ecommerce" className="p-1.5 rounded-lg hover:bg-accent transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm truncate">{store.name}</span>
          <span className="text-xs text-muted-foreground ml-2">Store Editor</span>
        </div>
        {storeUrl && (
          <a href={storeUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-accent transition-colors">
            <Eye className="w-3.5 h-3.5" /> View Store
            <ExternalLink className="w-3 h-3 text-muted-foreground" />
          </a>
        )}
        <button onClick={refreshData} disabled={refreshing} title="Refresh store data"
          className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground disabled:opacity-50">
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </button>
        {changed && (
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save & Rebuild
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="border-b border-border bg-background overflow-x-auto">
        <div className="flex gap-0.5 px-4 min-w-max">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}>
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">

        {/* Preview */}
        {activeTab === "preview" && (
          <div className="w-full rounded-xl overflow-hidden border border-border bg-muted" style={{ height: "calc(100vh - 200px)" }}>
            {previewUrl ? (
              <iframe ref={iframeRef} src={previewUrl} className="w-full h-full" title="Store Preview" />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Store not yet deployed</p>
              </div>
            )}
          </div>
        )}

        {/* Store Info */}
        {activeTab === "store-info" && data && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: form fields (2/3 width) */}
            <div className="lg:col-span-2 space-y-6">
              <Section title="Store Information">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Store Name" value={data.storeInfo?.name} onChange={(v) => updateInfo("name", v)} />
                  <Field label="Tagline" value={data.storeInfo?.tagline} onChange={(v) => updateInfo("tagline", v)} />
                  <Field label="Currency" value={data.storeInfo?.currency} onChange={(v) => updateInfo("currency", v)} />
                  <Field label="Region" value={(data.storeInfo as any)?.region} onChange={(v) => updateInfo("currency", v)} />
                  <Field label="Address" value={data.storeInfo?.address} onChange={(v) => updateInfo("address", v)} span={2} />
                  <Field label="Description" value={data.storeInfo?.description} onChange={(v) => updateInfo("description", v)} multiline span={2} />
                  <Field label="About" value={data.storeInfo?.about} onChange={(v) => updateInfo("about", v)} multiline span={2} />
                  <Field label="Mission" value={data.storeInfo?.mission} onChange={(v) => updateInfo("mission", v)} multiline span={2} />
                </div>
              </Section>
              <Section title="Call to Action">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="CTA Button Text" value={data.storeInfo?.ctaText} onChange={(v) => updateInfo("ctaText", v)} />
                  <Field label="CTA URL" value={data.storeInfo?.ctaUrl} onChange={(v) => updateInfo("ctaUrl", v)} />
                </div>
              </Section>
            </div>
            {/* Right: branding sidebar (1/3 width) */}
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-xl p-5 space-y-5">
                <h2 className="text-base font-semibold">Branding</h2>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Logo</label>
                  <div className="flex gap-2 mb-2">
                    <input type="text" value={data.storeInfo?.logoUrl || ""} onChange={(e) => updateInfo("logoUrl", e.target.value)}
                      placeholder="/images/logo.png"
                      className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background min-w-0" />
                    <button onClick={() => openPicker((url) => updateInfo("logoUrl", url))}
                      className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-accent whitespace-nowrap">Browse</button>
                  </div>
                  <div className="h-20 rounded-lg border border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                    {data.storeInfo?.logoUrl
                      ? <img src={data.storeInfo.logoUrl} alt="Logo" className="h-full w-full object-contain p-2" />
                      : <span className="text-xs text-muted-foreground">Logo Preview</span>}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Banner / Hero Image</label>
                  <div className="flex gap-2 mb-2">
                    <input type="text" value={data.storeInfo?.bannerUrl || ""} onChange={(e) => updateInfo("bannerUrl", e.target.value)}
                      placeholder="/images/banner.jpg"
                      className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background min-w-0" />
                    <button onClick={() => openPicker((url) => updateInfo("bannerUrl", url))}
                      className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-accent whitespace-nowrap">Browse</button>
                  </div>
                  <div className="aspect-video rounded-lg border border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                    {data.storeInfo?.bannerUrl
                      ? <img src={data.storeInfo.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                      : <span className="text-xs text-muted-foreground">Banner Preview</span>}
                  </div>
                </div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-xs text-blue-700 dark:text-blue-400 space-y-1">
                <p className="font-semibold text-blue-800 dark:text-blue-300">After editing</p>
                <p>Click <strong>Save &amp; Rebuild</strong> to publish your changes. Rebuilds take 1–2 minutes.</p>
              </div>
            </div>
          </div>
        )}

        {/* Hero */}
        {activeTab === "hero" && data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <Section title="Hero Text">
                <div className="grid grid-cols-1 gap-4">
                  <Field label="Headline" value={data.heroConfig?.headline} onChange={(v) => updateHero("headline", v)} />
                  <Field label="Sub-headline" value={data.heroConfig?.subheadline} onChange={(v) => updateHero("subheadline", v)} multiline />
                  <Field label="CTA Button Text" value={data.heroConfig?.ctaText} onChange={(v) => updateHero("ctaText", v)} />
                  <Field label="CTA URL" value={data.heroConfig?.ctaUrl} onChange={(v) => updateHero("ctaUrl", v)} />
                </div>
              </Section>
            </div>
            <div className="space-y-6">
              <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <h2 className="text-base font-semibold">Hero Background Image</h2>
                <div className="flex gap-2">
                  <input type="text" value={data.storeInfo?.bannerUrl || ""} onChange={(e) => updateInfo("bannerUrl", e.target.value)}
                    placeholder="/images/hero-bg.jpg"
                    className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background min-w-0" />
                  <button onClick={() => openPicker((url) => updateInfo("bannerUrl", url))}
                    className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-accent flex items-center gap-1.5 whitespace-nowrap">
                    <ImageIcon className="w-3.5 h-3.5" /> Browse
                  </button>
                </div>
                <div className="aspect-video rounded-xl border border-dashed border-border bg-muted/30 overflow-hidden relative">
                  {data.storeInfo?.bannerUrl ? (
                    <>
                      <img src={data.storeInfo.bannerUrl} alt="Hero" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex flex-col items-start justify-center p-6">
                        <p className="text-white font-bold text-lg leading-tight mb-1 line-clamp-2">{data.heroConfig?.headline || "Your Headline"}</p>
                        <p className="text-white/80 text-xs mb-3 line-clamp-2">{data.heroConfig?.subheadline || "Sub-headline text"}</p>
                        <span className="px-3 py-1.5 bg-white/20 backdrop-blur-sm text-white text-xs rounded-full border border-white/30">{data.heroConfig?.ctaText || "Shop Now"}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-2">
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Select a background image to preview</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Categories */}
        {activeTab === "categories" && data && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Categories <span className="text-muted-foreground font-normal text-sm">({(data.categories || []).length})</span></h2>
                <p className="text-xs text-muted-foreground mt-0.5">Edit names, images, and descriptions. Changes apply after Save &amp; Rebuild.</p>
              </div>
              <Link href="/ecommerce/categories" className="text-xs text-primary hover:underline flex items-center gap-1">Manage Categories →</Link>
            </div>
            {(data.categories || []).length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <p className="text-sm text-muted-foreground">No categories found. <Link href="/ecommerce/categories" className="text-primary hover:underline">Manage Categories →</Link></p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {(data.categories || []).map((cat, i) => (
                  <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="aspect-video relative bg-muted overflow-hidden">
                      {cat.image
                        ? <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-8 h-8 text-muted-foreground" /></div>}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                        <p className="text-white text-sm font-semibold">{cat.name}</p>
                        <p className="text-white/70 text-xs">{cat.slug}</p>
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      <Field label="Category Name" value={cat.name} onChange={(v) => updateCategory(i, "name", v)} />
                      <Field label="Description" value={cat.description || ""} onChange={(v) => updateCategory(i, "description", v)} multiline />
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Image</label>
                        <div className="flex gap-2">
                          <input type="text" value={cat.image || ""} onChange={(e) => updateCategory(i, "image", e.target.value)}
                            placeholder="/images/category.jpg"
                            className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background min-w-0" />
                          <button onClick={() => openPicker((url) => updateCategory(i, "image", url))}
                            className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-accent flex items-center gap-1 whitespace-nowrap">
                            <ImageIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        {activeTab === "navigation" && data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section title="Header Navigation">
              <p className="text-sm text-muted-foreground mb-3">Links shown in the top menu.</p>
              <div className="space-y-2">
                {(data.navLinks || []).map((link, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    <input type="text" value={link.label} onChange={(e) => {
                      const links = [...(data.navLinks || [])];
                      links[i] = { ...links[i], label: e.target.value };
                      update("navLinks", links);
                    }} placeholder="Label" className="px-3 py-2 text-sm border border-border rounded-lg bg-background" />
                    <input type="text" value={link.href} onChange={(e) => {
                      const links = [...(data.navLinks || [])];
                      links[i] = { ...links[i], href: e.target.value };
                      update("navLinks", links);
                    }} placeholder="/page" className="px-3 py-2 text-sm border border-border rounded-lg bg-background" />
                    <button onClick={() => update("navLinks", (data.navLinks || []).filter((_, j) => j !== i))}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button onClick={() => update("navLinks", [...(data.navLinks || []), { label: "New Page", href: "/" }])}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-dashed border-border rounded-lg hover:border-primary/50 text-muted-foreground hover:text-primary">
                  <Plus className="w-3.5 h-3.5" /> Add Nav Link
                </button>
              </div>
            </Section>

            <div className="space-y-6">
              <Section title="Footer Links">
                <p className="text-sm text-muted-foreground mb-3">Legal pages and extra links in the footer.</p>
                <div className="space-y-2">
                  {(data.footerLinks || []).map((link, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                      <input type="text" value={link.label} onChange={(e) => {
                        const links = [...(data.footerLinks || [])];
                        links[i] = { ...links[i], label: e.target.value };
                        update("footerLinks", links);
                      }} placeholder="Label" className="px-3 py-2 text-sm border border-border rounded-lg bg-background" />
                      <input type="text" value={link.href} onChange={(e) => {
                        const links = [...(data.footerLinks || [])];
                        links[i] = { ...links[i], href: e.target.value };
                        update("footerLinks", links);
                      }} placeholder="/page" className="px-3 py-2 text-sm border border-border rounded-lg bg-background" />
                      <button onClick={() => update("footerLinks", (data.footerLinks || []).filter((_, j) => j !== i))}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => update("footerLinks", [...(data.footerLinks || []), { label: "New Link", href: "/" }])}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm border border-dashed border-border rounded-lg hover:border-primary/50 text-muted-foreground hover:text-primary">
                    <Plus className="w-3.5 h-3.5" /> Add Footer Link
                  </button>
                </div>
              </Section>

              <div className="bg-muted/30 rounded-xl border border-border p-4 space-y-1.5 text-sm">
                <p className="font-medium text-sm text-foreground">Available pages:</p>
                {(data.pages || []).map((p) => (
                  <p key={p.slug} className="text-xs text-muted-foreground"><code className="bg-muted px-1 py-0.5 rounded text-xs">/{p.slug}</code> — {p.label}</p>
                ))}
                <div className="pt-2 flex gap-3 text-xs">
                  <Link href="/ecommerce/products" className="text-primary hover:underline">Products →</Link>
                  <Link href="/ecommerce/categories" className="text-primary hover:underline">Categories →</Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FAQ */}
        {activeTab === "faq" && data && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">FAQ <span className="text-muted-foreground font-normal text-sm">({(data.faq || []).length} items)</span></h2>
              <button onClick={() => update("faq", [...(data.faq || []), { question: "", answer: "" }])}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-dashed border-border rounded-lg hover:border-primary/50 text-muted-foreground hover:text-primary">
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {(data.faq || []).map((item, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground px-2 py-0.5 bg-muted rounded-full">#{i + 1}</span>
                    <button onClick={() => update("faq", (data.faq || []).filter((_, j) => j !== i))}
                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <Field label="Question" value={item.question} onChange={(v) => {
                    const faq = [...(data.faq || [])]; faq[i] = { ...faq[i], question: v }; update("faq", faq);
                  }} />
                  <Field label="Answer" value={item.answer} multiline onChange={(v) => {
                    const faq = [...(data.faq || [])]; faq[i] = { ...faq[i], answer: v }; update("faq", faq);
                  }} />
                </div>
              ))}
              {(data.faq || []).length === 0 && (
                <div className="lg:col-span-2 bg-card border border-dashed border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
                  No FAQ items yet. Click &quot;Add Item&quot; to get started.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pages */}
        {activeTab === "pages" && data && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Store Pages</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Use AI Update to modify any page&apos;s content and design.</p>
              </div>
            </div>
            {(data.pages || []).length === 0 ? (
              <div className="bg-card border border-dashed border-border rounded-xl p-8 text-center text-sm text-muted-foreground">No pages found. Rebuild your store to scan pages.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {(data.pages || []).map((p) => (
                  <div key={p.slug} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-3 hover:border-primary/30 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.label}</p>
                      <code className="text-xs text-muted-foreground">/{p.slug}</code>
                    </div>
                    <button onClick={() => setActiveTab("ai-update")}
                      className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-accent hover:border-primary/30 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Edit
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm">
              <p className="font-medium text-blue-800 dark:text-blue-300 mb-1">Edit any page with AI</p>
              <p className="text-blue-700 dark:text-blue-400 text-xs">Use the <strong>AI Update</strong> tab to describe changes — e.g. &quot;Rewrite the About page with our company story&quot;.</p>
            </div>
          </div>
        )}

        {/* AI Update */}
        {activeTab === "ai-update" && store && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <SectionUpdater
                apiBase={`/api/ecommerce/store/${store.id}/update-section`}
                onUpdated={() => rebuild()}
              />
            </div>
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-3">What AI can update</h3>
                <ul className="text-xs text-muted-foreground space-y-2">
                  {["Change layouts, colors, fonts, and spacing","Update hero section, header, footer design","Modify product cards and category pages","Add banners, announcements, or promotions","Update store data (name, contact, description)","Any visual or content change you can describe"].map((item) => (
                    <li key={item} className="flex items-start gap-2"><span className="text-primary mt-0.5">•</span>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-xs text-amber-800 dark:text-amber-300">
                <p className="font-semibold mb-1">After AI Update</p>
                <p className="text-amber-700 dark:text-amber-400">Changes trigger an automatic rebuild (~1–2 min). Your store stays live during the rebuild.</p>
              </div>
            </div>
          </div>
        )}

        {/* Rebuild */}
        {activeTab === "rebuild" && store && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Section title="Build Status">
              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm text-muted-foreground w-20 shrink-0">Status</span>
                  {store.buildStatus === "built"
                    ? <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium"><Check className="w-4 h-4" /> Live</span>
                    : store.buildStatus === "building"
                    ? <span className="flex items-center gap-1.5 text-sm text-blue-600 font-medium"><Loader2 className="w-4 h-4 animate-spin" /> Building...</span>
                    : store.buildStatus === "error"
                    ? <span className="flex items-center gap-1.5 text-sm text-red-600 font-medium"><AlertCircle className="w-4 h-4" /> Error</span>
                    : <span className="text-sm text-muted-foreground">Idle</span>}
                </div>
                {store.ssrStatus && (
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm text-muted-foreground w-20 shrink-0">Process</span>
                    {store.ssrStatus === "running"
                      ? <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Running · port {store.ssrPort}</span>
                      : <span className="flex items-center gap-1.5 text-sm text-amber-600 font-medium"><span className="w-2 h-2 rounded-full bg-amber-500" /> Stopped</span>}
                  </div>
                )}
                {store.lastBuildAt && (
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm text-muted-foreground w-20 shrink-0">Last build</span>
                    <span className="text-sm">{new Date(store.lastBuildAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
              {store.buildStatus === "error" && store.lastBuildError && (
                <pre className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs rounded-lg overflow-auto max-h-48 mb-4">{store.lastBuildError}</pre>
              )}
              {buildResult && (
                <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm mb-4 ${
                  buildResult.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 text-emerald-800 dark:text-emerald-300"
                    : "bg-red-50 dark:bg-red-950/20 border-red-200 text-red-800 dark:text-red-300"
                }`}>
                  {buildResult.type === "success" ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  {buildResult.message}
                </div>
              )}
              <button onClick={rebuild} disabled={rebuilding}
                className="flex items-center gap-1.5 px-5 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50 hover:opacity-90 transition-opacity">
                {rebuilding ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Rebuilding...</> : <><RefreshCw className="w-3.5 h-3.5" /> Rebuild Store</>}
              </button>
            </Section>
            <div className="bg-muted/30 border border-border rounded-xl p-5 space-y-3 h-fit">
              <h3 className="text-sm font-semibold">When to rebuild</h3>
              <ul className="text-xs text-muted-foreground space-y-2">
                {["After editing store info, hero, or navigation","After adding or editing categories","After an AI Update completes","After uploading new images or logos"].map((item) => (
                  <li key={item} className="flex items-start gap-2"><RefreshCw className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />{item}</li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground pt-1">Builds take 1–3 minutes. Your store stays live during a rebuild.</p>
            </div>
          </div>
        )}

        {/* Domains */}
        {activeTab === "domains" && store && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-1">Store URL</h2>
              <p className="text-sm text-muted-foreground mb-4">Your store is currently live at:</p>
              <div className="p-3 bg-muted/30 rounded-lg border border-border mb-5 flex items-center gap-2">
                <code className="text-sm font-mono flex-1 truncate">{storeUrl ? `flowsmartly.com${storeUrl}` : `flowsmartly.com/stores/${store.slug}/`}</code>
                {storeUrl && (
                  <a href={storeUrl} target="_blank" rel="noopener noreferrer"
                    className="p-1.5 text-muted-foreground hover:text-foreground shrink-0">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              <h2 className="text-base font-semibold mb-1">Custom Domain</h2>
              <p className="text-sm text-muted-foreground mb-4">Connect a domain you own (e.g. <strong>yourstore.com</strong>).</p>
              <a href="/domains" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                <Globe className="w-4 h-4" /> Manage Domains
              </a>
            </div>
            <div className="bg-muted/30 border border-border rounded-xl p-5 space-y-3 h-fit">
              <h3 className="text-sm font-semibold">How custom domains work</h3>
              <ol className="text-xs text-muted-foreground space-y-2 list-none">
                {["Register or point your domain to FlowSmartly","Add it in the Domains page","Set DNS A record or CNAME as instructed","Your store goes live on your domain (SSL included)"].map((item, i) => (
                  <li key={item} className="flex items-start gap-2"><span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">{i+1}</span>{item}</li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>

      {/* Unsaved changes bar */}
      {changed && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-amber-50 dark:bg-amber-900/30 border-t border-amber-200 px-6 py-3 flex items-center justify-between">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Unsaved changes</p>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50">
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, multiline, span }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean; span?: number;
}) {
  return (
    <div className={span === 2 ? "md:col-span-2" : ""}>
      {label && <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>}
      {multiline ? (
        <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={3}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
      ) : (
        <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
      )}
    </div>
  );
}
