"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ExternalLink, RefreshCw, Loader2, Check, AlertCircle, Globe,
  FileText, Save, Plus, Trash2, Link2, X,
  MapPin, Sparkles, AlertTriangle,
} from "lucide-react";
import { AIGenerationLoader } from "@/components/shared/ai-generation-loader";
import { PageLoader } from "@/components/shared/page-loader";
import { SectionUpdater } from "@/components/shared/section-updater";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StoreData {
  id: string;
  name: string;
  slug: string;
  buildStatus: string;
  lastBuildAt?: string;
  lastBuildError?: string;
  generatorVersion: string;
  storeVersion: string;
  customDomain?: string | null;
}

interface SiteData {
  storeInfo?: Record<string, any>;
  heroConfig?: Record<string, any>;
  navLinks?: Array<{ href: string; label: string }>;
  footerLinks?: Array<{ href: string; label: string }>;
  categories?: Array<Record<string, any>>;
  faq?: Array<{ question: string; answer: string }>;
  products?: Array<Record<string, any>>;
  pages?: Array<{ slug: string; label: string }>;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function StoreEditorV2Page() {
  const router = useRouter();
  const [store, setStore] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [activeTab, setActiveTab] = useState("preview");
  const [data, setData] = useState<SiteData | null>(null);
  const [changed, setChanged] = useState(false);
  const [buildStep, setBuildStep] = useState("");
  const [buildResult, setBuildResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ─── Load store + site data ──

  useEffect(() => {
    (async () => {
      try {
        const storeRes = await fetch("/api/ecommerce/store");
        const storeJson = await storeRes.json();
        if (!storeJson.success || !storeJson.data?.store) { router.replace("/ecommerce"); return; }

        const s = storeJson.data.store;
        setStore(s);

        if (s.generatorVersion !== "v2") {
          setNeedsUpgrade(true);
          setLoading(false);
          return;
        }

        const dataRes = await fetch(`/api/ecommerce/store/${s.id}/site-data`);
        if (dataRes.ok) {
          const d = await dataRes.json();
          setData(d);
        }
      } catch {}
      setLoading(false);
    })();
  }, [router]);

  // ─── Save & Rebuild ──

  const save = async () => {
    if (!data || !store) return;
    setSaving(true);
    setBuildResult(null);
    setBuildStep("Saving your changes...");
    await fetch(`/api/ecommerce/store/${store.id}/update-data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setChanged(false);
    setSaving(false);
    setBuildStep("Changes saved. Starting rebuild...");
    rebuild();
  };

  const rebuild = async () => {
    if (!store) return;
    setRebuilding(true);
    setBuildResult(null);
    setBuildStep("Syncing brand data...");
    await fetch(`/api/ecommerce/store/${store.id}/rebuild`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ syncBrandKit: false }),
    });
    setBuildStep("Building store...");

    let elapsed = 0;
    const iv = setInterval(async () => {
      elapsed += 3;
      const res = await fetch(`/api/ecommerce/store/${store.id}/generate`);
      const d = await res.json();

      if (elapsed < 15) setBuildStep("Building your store...");
      else if (elapsed < 30) setBuildStep("Compiling pages...");
      else if (elapsed < 60) setBuildStep("Generating static files...");
      else setBuildStep("Almost done...");

      if (d.buildStatus !== "building") {
        clearInterval(iv);
        setRebuilding(false);
        setBuildStep("");
        setStore((prev) => prev ? { ...prev, buildStatus: d.buildStatus, lastBuildError: d.lastBuildError } : null);

        if (d.buildStatus === "built") {
          setBuildResult({ type: "success", message: "Store updated successfully!" });
          if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
          setTimeout(() => setBuildResult(null), 5000);
        } else {
          setBuildResult({ type: "error", message: d.lastBuildError?.substring(0, 200) || "Build failed." });
        }
      }
    }, 3000);
  };

  // ─── Data update helper ──

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

  // ─── Loading ──

  if (loading) return <PageLoader />;
  if (!store) return null;

  // V1 stores need to upgrade first
  if (needsUpgrade) {
    return (
      <div className="pb-20 px-1 md:px-2">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push("/ecommerce/dashboard")} className="p-2 rounded-lg hover:bg-muted">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold">{store.name}</h1>
            <p className="text-xs text-muted-foreground">Store Editor</p>
          </div>
        </div>
        <div className="rounded-2xl border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 p-10 text-center">
          <Sparkles className="w-12 h-12 text-purple-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Upgrade to FlowShop V2</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-2 max-w-lg mx-auto">
            The new store editor requires a V2 store. Upgrade now to get a stunning AI-designed storefront
            with custom animations, modern layouts, and all your existing products migrated automatically.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">500 credits | Your products, orders, and settings are preserved</p>
          <button
            onClick={() => router.push("/ecommerce/dashboard")}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Go to Dashboard to Upgrade
          </button>
        </div>
      </div>
    );
  }

  const busy = rebuilding || saving;
  const previewUrl = `/stores/${store.slug}/`;

  const tabs: Array<{ id: string; label: string; icon: any }> = [
    { id: "preview", label: "Preview", icon: Globe },
    { id: "store-info", label: "Store Info", icon: FileText },
    { id: "ai-update", label: "AI Update", icon: Sparkles },
    { id: "links", label: "Links", icon: Link2 },
    { id: "domains", label: "Domains", icon: Globe },
    { id: "build", label: "Build", icon: AlertCircle },
  ];

  return (
    <div className="pb-20 px-1 md:px-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/ecommerce/dashboard")} className="p-2 rounded-lg hover:bg-muted">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold">{store.name}</h1>
            <p className="text-xs text-muted-foreground">{store.customDomain || `/stores/${store.slug}`}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {changed && (
            <button onClick={save} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
              <Save className="w-3.5 h-3.5" /> Save & Rebuild
            </button>
          )}
          {store.buildStatus === "built" && (
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted">
              <ExternalLink className="w-3.5 h-3.5" /> View Store
            </a>
          )}
          <button onClick={rebuild} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50">
            {rebuilding ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Building...</> : <><RefreshCw className="w-3.5 h-3.5" /> Rebuild</>}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${
              activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* Build Progress */}
      {(rebuilding || saving) && buildStep && (
        <div className="mb-4">
          <AIGenerationLoader currentStep={buildStep} subtitle="This usually takes 30-60 seconds" compact />
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

      {/* ═══ Preview Tab ═══ */}
      {activeTab === "preview" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
            <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-400" /><div className="w-3 h-3 rounded-full bg-yellow-400" /><div className="w-3 h-3 rounded-full bg-green-400" /></div>
            <span className="text-xs text-muted-foreground flex-1 text-center">{store.customDomain || `flowsmartly.com/stores/${store.slug}`}</span>
          </div>
          {store.buildStatus === "built" ? (
            <iframe ref={iframeRef} src={previewUrl} className="w-full h-[75vh] border-0" />
          ) : store.buildStatus === "error" ? (
            <div className="text-center py-16 px-6">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">Store Build Failed</h3>
              {store.lastBuildError && (
                <pre className="mx-auto max-w-lg text-left p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs rounded-lg overflow-auto max-h-32 mb-4">{store.lastBuildError.substring(0, 300)}</pre>
              )}
              <button onClick={rebuild} disabled={busy} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
                {rebuilding ? <><Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1.5" />Rebuilding...</> : <><RefreshCw className="w-3.5 h-3.5 inline mr-1.5" />Try Rebuild</>}
              </button>
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-muted-foreground mb-4">{store.buildStatus === "building" ? "Building..." : "Not built yet"}</p>
              {store.buildStatus !== "building" && <button onClick={rebuild} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">Build Now</button>}
            </div>
          )}
        </div>
      )}

      {/* ═══ Store Info Tab ═══ */}
      {activeTab === "store-info" && data && (
        <div className="space-y-6">
          <Section title="Store Information">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Store Name" value={data.storeInfo?.name} onChange={(v) => update("storeInfo.name", v)} />
              <Field label="Tagline" value={data.storeInfo?.tagline} onChange={(v) => update("storeInfo.tagline", v)} />
              <Field label="Description" value={data.storeInfo?.description} onChange={(v) => update("storeInfo.description", v)} multiline span={2} />
              <Field label="About" value={data.storeInfo?.about} onChange={(v) => update("storeInfo.about", v)} multiline span={2} />
              <Field label="Mission" value={data.storeInfo?.mission} onChange={(v) => update("storeInfo.mission", v)} multiline span={2} />
              <Field label="Address" value={data.storeInfo?.address} onChange={(v) => update("storeInfo.address", v)} icon={<MapPin className="w-4 h-4" />} span={2} />
            </div>
          </Section>
          <Section title="Call-to-Action Button">
            <p className="text-sm text-muted-foreground mb-3">
              Configure the main CTA button shown in your store header and hero section.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Button Text" value={data.storeInfo?.ctaText} onChange={(v) => update("storeInfo.ctaText", v)} />
              <Field label="Button URL" value={data.storeInfo?.ctaUrl} onChange={(v) => update("storeInfo.ctaUrl", v)} icon={<ExternalLink className="w-4 h-4" />} />
            </div>
          </Section>
        </div>
      )}

      {/* ═══ AI Update Tab ═══ */}
      {activeTab === "ai-update" && store && (
        <div className="space-y-6">
          <SectionUpdater
            apiBase={`/api/ecommerce/store/${store.id}/update-section`}
            onUpdated={() => rebuild()}
          />
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <h3 className="text-sm font-semibold mb-2">What can AI update?</h3>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li>Change hero section, headlines, images, animations</li>
              <li>Update product cards layout, pricing display, badges</li>
              <li>Modify category showcase, featured products section</li>
              <li>Update navigation, footer, header design</li>
              <li>Change colors, fonts, spacing, dark mode</li>
              <li>Add newsletter signup, about section, FAQ</li>
              <li>Any design or content change you can describe</li>
            </ul>
          </div>
        </div>
      )}

      {/* ═══ Links Tab ═══ */}
      {activeTab === "links" && data && (() => {
        // Compute available pages (exist on disk but not in nav)
        const navHrefs = new Set(
          (data.navLinks || []).map((l) => {
            const h = (l.href || "").replace(/^\/stores\/[^/]+/, "");
            return h || "/";
          })
        );
        const availablePages = (data.pages || []).filter((p) => {
          const href = p.slug === "" ? "/" : `/${p.slug}`;
          return !navHrefs.has(href);
        });

        return (
        <div className="space-y-6">
          {/* Available Pages — quick add */}
          {availablePages.length > 0 && (
            <Section title="Available Pages">
              <p className="text-sm text-muted-foreground mb-3">
                These pages exist in your store but are not in the navigation menu. Click to add them.
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
                After adding, use <strong>AI Update</strong> tab to enhance page content.
              </p>
            </Section>
          )}

          <Section title="Navigation Links">
            <p className="text-sm text-muted-foreground mb-3">These appear in the header navbar.</p>
            <div className="space-y-3">
              {(data.navLinks || []).map((link, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                  <Field label="" value={link.label} onChange={(v) => { const links = [...(data.navLinks || [])]; links[i] = { ...links[i], label: v }; update("navLinks", links); }} />
                  <Field label="" value={link.href} onChange={(v) => { const links = [...(data.navLinks || [])]; links[i] = { ...links[i], href: v }; update("navLinks", links); }} />
                  <button onClick={() => update("navLinks", (data.navLinks || []).filter((_, j) => j !== i))} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <button onClick={() => update("navLinks", [...(data.navLinks || []), { label: "New Link", href: "/" }])} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-dashed border-border rounded-lg hover:border-primary/50 text-muted-foreground hover:text-primary">
                <Plus className="w-3.5 h-3.5" /> Add Nav Link
              </button>
            </div>
          </Section>

          <Section title="Footer Links">
            <p className="text-sm text-muted-foreground mb-3">Additional links in the footer. Nav links also appear automatically.</p>
            <div className="space-y-3">
              {(data.footerLinks || []).map((link, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                  <Field label="" value={link.label} onChange={(v) => { const links = [...(data.footerLinks || [])]; links[i] = { ...links[i], label: v }; update("footerLinks", links); }} />
                  <Field label="" value={link.href} onChange={(v) => { const links = [...(data.footerLinks || [])]; links[i] = { ...links[i], href: v }; update("footerLinks", links); }} />
                  <button onClick={() => update("footerLinks", (data.footerLinks || []).filter((_, j) => j !== i))} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <button onClick={() => update("footerLinks", [...(data.footerLinks || []), { label: "New Link", href: "/" }])} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-dashed border-border rounded-lg hover:border-primary/50 text-muted-foreground hover:text-primary">
                <Plus className="w-3.5 h-3.5" /> Add Footer Link
              </button>
            </div>
          </Section>
        </div>
        );
      })()}

      {/* ═══ Domains Tab ═══ */}
      {activeTab === "domains" && (
        <Section title="Custom Domain">
          <p className="text-sm text-muted-foreground mb-4">Your store is currently accessible at:</p>
          <div className="p-3 bg-muted/30 rounded-lg border border-border mb-6">
            <code className="text-sm font-mono">{store.customDomain || `flowsmartly.com/stores/${store.slug}`}</code>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            To use a custom domain, go to the Domains page to register or connect one.
          </p>
          <a href="/ecommerce/domains" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            <Globe className="w-4 h-4" /> Manage Domains
          </a>
        </Section>
      )}

      {/* ═══ Build Tab ═══ */}
      {activeTab === "build" && (
        <Section title="Build Status">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm font-medium">Status:</span>
            {store.buildStatus === "built" ? <span className="flex items-center gap-1 text-sm text-green-600"><Check className="w-4 h-4" /> Live</span>
             : store.buildStatus === "building" ? <span className="flex items-center gap-1 text-sm text-blue-600"><Loader2 className="w-4 h-4 animate-spin" /> Building...</span>
             : store.buildStatus === "error" ? <span className="flex items-center gap-1 text-sm text-red-600"><AlertCircle className="w-4 h-4" /> Error</span>
             : <span className="text-sm text-muted-foreground">Idle</span>}
          </div>
          {store.lastBuildAt && <p className="text-sm text-muted-foreground mb-4">Last build: {new Date(store.lastBuildAt).toLocaleString()}</p>}
          {store.buildStatus === "error" && store.lastBuildError && (
            <pre className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs rounded-lg overflow-auto max-h-60 mb-4">{store.lastBuildError}</pre>
          )}
          <button onClick={rebuild} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-medium disabled:opacity-50">
            {rebuilding ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Rebuilding...</> : <><RefreshCw className="w-3.5 h-3.5" /> {store.buildStatus === "error" ? "Retry Build" : "Rebuild"}</>}
          </button>
        </Section>
      )}

      {/* Unsaved changes bar */}
      {changed && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-amber-50 dark:bg-amber-900/30 border-t border-amber-200 px-6 py-3 flex items-center justify-between">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Unsaved changes</p>
          <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save & Rebuild
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Helper Components (same as website editor) ──────────────────────────────

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
      {label && <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>}
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
