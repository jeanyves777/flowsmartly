"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ExternalLink, RefreshCw, Loader2, Check, AlertCircle,
  Globe, Save, Plus, Trash2, Eye, Sparkles, HelpCircle, Link2,
  Store, LayoutDashboard, Palette,
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
  pages: Array<{ slug: string; label: string }>;
}

const TABS = [
  { id: "preview", label: "Preview", icon: Eye },
  { id: "store-info", label: "Store Info", icon: Store },
  { id: "hero", label: "Hero", icon: LayoutDashboard },
  { id: "navigation", label: "Navigation", icon: Link2 },
  { id: "faq", label: "FAQ", icon: HelpCircle },
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
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const storeUrl = store?.storeUrl || (store?.slug ? `/stores/${store.slug}/` : null);

  useEffect(() => {
    fetch("/api/ecommerce/store")
      .then((r) => r.json())
      .then(async (res) => {
        const s: StoreRecord = res.data?.store ?? res.store;
        setStore(s);
        if (s?.id) {
          try {
            const dr = await fetch(`/api/ecommerce/store/${s.id}/site-data`);
            if (dr.ok) setData(await dr.json());
          } catch {}
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
            {storeUrl ? (
              <iframe ref={iframeRef} src={storeUrl} className="w-full h-full" title="Store Preview" />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Store not yet deployed</p>
              </div>
            )}
          </div>
        )}

        {/* Store Info */}
        {activeTab === "store-info" && data && (
          <div className="max-w-2xl space-y-6">
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
            <Section title="Branding">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Logo URL</label>
                  <div className="flex gap-2">
                    <input type="text" value={data.storeInfo?.logoUrl || ""} onChange={(e) => updateInfo("logoUrl", e.target.value)}
                      placeholder="/images/logo.png"
                      className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" />
                    <button onClick={() => openPicker((url) => updateInfo("logoUrl", url))}
                      className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-accent">Browse</button>
                  </div>
                  {data.storeInfo?.logoUrl && (
                    <img src={data.storeInfo.logoUrl} alt="Logo preview" className="mt-2 h-12 object-contain rounded border" />
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Banner URL</label>
                  <div className="flex gap-2">
                    <input type="text" value={data.storeInfo?.bannerUrl || ""} onChange={(e) => updateInfo("bannerUrl", e.target.value)}
                      placeholder="/images/banner.jpg"
                      className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" />
                    <button onClick={() => openPicker((url) => updateInfo("bannerUrl", url))}
                      className="px-3 py-2 text-sm border border-border rounded-lg hover:bg-accent">Browse</button>
                  </div>
                  {data.storeInfo?.bannerUrl && (
                    <img src={data.storeInfo.bannerUrl} alt="Banner preview" className="mt-2 h-20 w-full object-cover rounded border" />
                  )}
                </div>
              </div>
            </Section>
          </div>
        )}

        {/* Hero */}
        {activeTab === "hero" && data && (
          <div className="max-w-2xl">
            <Section title="Hero Section">
              <div className="grid grid-cols-1 gap-4">
                <Field label="Headline" value={data.heroConfig?.headline} onChange={(v) => updateHero("headline", v)} />
                <Field label="Sub-headline" value={data.heroConfig?.subheadline} onChange={(v) => updateHero("subheadline", v)} multiline />
                <Field label="Hero CTA Text" value={data.heroConfig?.ctaText} onChange={(v) => updateHero("ctaText", v)} />
                <Field label="Hero CTA URL" value={data.heroConfig?.ctaUrl} onChange={(v) => updateHero("ctaUrl", v)} />
              </div>
            </Section>
          </div>
        )}

        {/* Navigation */}
        {activeTab === "navigation" && data && (
          <div className="max-w-2xl space-y-6">
            <Section title="Navigation Links">
              <p className="text-sm text-muted-foreground mb-3">Links shown in the header menu.</p>
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

            <Section title="Footer Links">
              <p className="text-sm text-muted-foreground mb-3">Extra links shown in the footer (legal pages, etc).</p>
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

            {/* Quick links */}
            <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-4 space-y-1">
              <p className="font-medium text-foreground">Available store pages:</p>
              {(data.pages || []).map((p) => (
                <p key={p.slug}><code className="text-xs bg-muted px-1 py-0.5 rounded">/{p.slug}</code> — {p.label}</p>
              ))}
              <p className="mt-2"><Link href="/ecommerce/products" className="text-primary hover:underline">Manage Products →</Link></p>
              <p><Link href="/ecommerce/categories" className="text-primary hover:underline">Manage Categories →</Link></p>
            </div>
          </div>
        )}

        {/* FAQ */}
        {activeTab === "faq" && data && (
          <div className="max-w-2xl">
            <Section title={`FAQ (${(data.faq || []).length} items)`}>
              <div className="space-y-4">
                {(data.faq || []).map((item, i) => (
                  <div key={i} className="border border-border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Item {i + 1}</span>
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
                <button onClick={() => update("faq", [...(data.faq || []), { question: "", answer: "" }])}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-dashed border-border rounded-lg hover:border-primary/50 text-muted-foreground hover:text-primary">
                  <Plus className="w-3.5 h-3.5" /> Add FAQ Item
                </button>
              </div>
            </Section>
          </div>
        )}

        {/* AI Update */}
        {activeTab === "ai-update" && store && (
          <div className="max-w-2xl space-y-6">
            <SectionUpdater
              apiBase={`/api/ecommerce/store/${store.id}/update-section`}
              onUpdated={() => rebuild()}
            />
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <h3 className="text-sm font-semibold mb-2">What can AI update?</h3>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                <li>Change layouts, colors, fonts, and spacing</li>
                <li>Update hero section, header, footer design</li>
                <li>Modify product cards, category pages</li>
                <li>Add banners, announcements, or promotions</li>
                <li>Update store data (name, contact, description)</li>
                <li>Any visual or content change you can describe</li>
              </ul>
            </div>
          </div>
        )}

        {/* Rebuild */}
        {activeTab === "rebuild" && store && (
          <div className="max-w-2xl space-y-4">
            <Section title="Build Status">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm font-medium">Status:</span>
                {store.buildStatus === "built"
                  ? <span className="flex items-center gap-1 text-sm text-green-600"><Check className="w-4 h-4" /> Live</span>
                  : store.buildStatus === "building"
                  ? <span className="flex items-center gap-1 text-sm text-blue-600"><Loader2 className="w-4 h-4 animate-spin" /> Building...</span>
                  : store.buildStatus === "error"
                  ? <span className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="w-4 h-4" /> Error</span>
                  : <span className="text-sm text-muted-foreground">Idle</span>
                }
              </div>
              {store.ssrStatus && (
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-sm font-medium">Process:</span>
                  {store.ssrStatus === "running"
                    ? <span className="flex items-center gap-1.5 text-sm text-green-600"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Running on port {store.ssrPort}</span>
                    : store.ssrStatus === "stopped"
                    ? <span className="flex items-center gap-1.5 text-sm text-amber-600"><span className="w-2 h-2 rounded-full bg-amber-500" /> Stopped</span>
                    : <span className="text-sm text-muted-foreground">{store.ssrStatus}</span>
                  }
                </div>
              )}
              {store.lastBuildAt && (
                <p className="text-sm text-muted-foreground mb-4">Last build: {new Date(store.lastBuildAt).toLocaleString()}</p>
              )}
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
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50">
                {rebuilding ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Rebuilding...</> : <><RefreshCw className="w-3.5 h-3.5" /> Rebuild Store</>}
              </button>
            </Section>
          </div>
        )}

        {/* Domains */}
        {activeTab === "domains" && store && (
          <div className="max-w-2xl">
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-2">Custom Domain</h2>
              <p className="text-sm text-muted-foreground mb-4">Your store is currently accessible at:</p>
              <div className="p-3 bg-muted/30 rounded-lg border border-border mb-6">
                <code className="text-sm font-mono">{storeUrl ? `flowsmartly.com${storeUrl}` : `flowsmartly.com/stores/${store.slug}/`}</code>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                To use a custom domain (e.g. <strong>yourstore.com</strong>), go to the Domains page to connect a domain you own.
              </p>
              <a href="/domains" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-all">
                <Globe className="w-4 h-4" />
                Manage Domains
              </a>
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
