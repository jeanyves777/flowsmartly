"use client";

import { useCallback, useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import {
  Store, Globe, ExternalLink, RefreshCw, Save, Plus, Trash2, Link2, X, Check,
  AlertCircle, ArrowLeft, Image as ImageIcon, LayoutDashboard,
  Grid3X3, HelpCircle, FileText, Wand2, Server, Palette, Rocket, ChevronUp, ChevronDown,
  Share2, ScrollText, Droplet, Sparkles,
} from "lucide-react";
import { MediaLibraryPicker } from "@/components/shared/media-library-picker";
import { FlowLoader } from "@/components/shared/flow-loader";
import { cn } from "@/lib/utils/cn";

/**
 * Store Studio — the full new-design storefront editor (replaces the legacy
 * /ecommerce/design page). Reuses the store APIs (site-data, update-data,
 * update-section, rebuild, generate) so there is ONE backend and no duplicated
 * build logic. Domains route to the in-app Domains surface, never legacy.
 * [[new-design-no-legacy]] [[full-width-left-menu-layout]]
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
interface StoreRecord {
  id: string; name: string; slug: string; buildStatus: string; lastBuildAt?: string | null;
  lastBuildError?: string | null; ssrPort?: number | null; ssrStatus?: string | null;
  storeUrl?: string | null; generatorVersion?: string;
}
interface SocialLinks { instagram?: string; facebook?: string; tiktok?: string; twitter?: string }
interface StoreInfo { name: string; tagline: string; description: string; about: string; mission: string; address: string; ctaText: string; ctaUrl: string; logoUrl: string; bannerUrl: string; currency: string; region?: string; socialLinks?: SocialLinks; emails?: string[]; phones?: string[]; }
interface HeroConfig { headline: string; subheadline: string; ctaText: string; ctaUrl: string; slides?: string[]; style?: "slideshow" | "image" | "gradient" | "video"; }
interface Policies { shipping?: string; returns?: string; privacy?: string; terms?: string }
interface ThemeConfig { colors?: { primary?: string; secondary?: string; accent?: string } }
interface StoreData {
  storeInfo: StoreInfo;
  heroConfig: HeroConfig;
  navLinks: Array<{ href: string; label: string }>;
  footerLinks: Array<{ href: string; label: string }>;
  faq: Array<{ question: string; answer: string }>;
  categories: Array<{ id: string; name: string; slug: string; description: string; image: string }>;
  pages: Array<{ slug: string; label: string }>;
  policies?: Policies;
  theme?: ThemeConfig;
}

const F = "w-full rounded-[10px] border border-input bg-background px-3 py-2 text-[13px] outline-none focus:border-brand-500/60";
const isBuildingStatus = (s?: string) => s === "building" || s === "deploying";

type TabId = "preview" | "store-info" | "theme" | "hero" | "categories" | "navigation" | "footer-social" | "policies" | "faq" | "pages" | "ai" | "domains" | "status";

export function StoreStudio({ storeId, onBack, onOpenView, onAsk }: {
  storeId: string;
  onBack: () => void;
  onOpenView?: (key: string) => void;
  onAsk?: (prompt: string) => void;
}) {
  const [store, setStore] = useState<StoreRecord | null>(null);
  const [data, setData] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("preview");
  const [changed, setChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [buildStep, setBuildStep] = useState("");
  const [buildResult, setBuildResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerCb = useRef<((url: string) => void) | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const busy = saving || rebuilding;

  const loadStore = useCallback(async (): Promise<StoreRecord | undefined> => {
    const res = await fetch("/api/ecommerce/store").then((r) => r.json()).catch(() => null);
    const s: StoreRecord | undefined = res?.data?.store ?? res?.store;
    if (s) setStore(s);
    return s;
  }, []);

  const loadData = useCallback(async (forceRefresh = false) => {
    const d = await fetch(`/api/ecommerce/store/${storeId}/site-data${forceRefresh ? "?refresh=true" : ""}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (d && !d.error) setData(d as StoreData);
  }, [storeId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Force a fresh parse on open so the newer fields (theme/social/policies)
      // aren't hidden by an older cached shape.
      await Promise.all([loadStore(), loadData(true)]);
      if (alive) { setLoading(false); setPreviewNonce(Date.now()); }
    })();
    return () => { alive = false; if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadStore, loadData]);

  const update = useCallback(<K extends keyof StoreData>(key: K, value: StoreData[K]) => {
    setData((prev) => (prev ? { ...prev, [key]: value } : prev));
    setChanged(true);
  }, []);
  const updateInfo = useCallback((key: keyof StoreInfo, value: string) => {
    setData((prev) => (prev ? { ...prev, storeInfo: { ...prev.storeInfo, [key]: value } } : prev));
    setChanged(true);
  }, []);
  const updateHero = useCallback(<K extends keyof HeroConfig>(key: K, value: HeroConfig[K]) => {
    setData((prev) => (prev ? { ...prev, heroConfig: { ...prev.heroConfig, [key]: value } } : prev));
    setChanged(true);
  }, []);
  const updateSocial = useCallback((key: keyof SocialLinks, value: string) => {
    setData((prev) => (prev ? { ...prev, storeInfo: { ...prev.storeInfo, socialLinks: { ...prev.storeInfo.socialLinks, [key]: value } } } : prev));
    setChanged(true);
  }, []);
  // emails/phones are arrays; the studio edits the primary (index 0).
  const updateContact = useCallback((key: "emails" | "phones", value: string) => {
    setData((prev) => (prev ? { ...prev, storeInfo: { ...prev.storeInfo, [key]: value ? [value] : [] } } : prev));
    setChanged(true);
  }, []);
  const updatePolicy = useCallback((key: keyof Policies, value: string) => {
    setData((prev) => (prev ? { ...prev, policies: { ...prev.policies, [key]: value } } : prev));
    setChanged(true);
  }, []);
  const updateThemeColor = useCallback((key: "primary" | "secondary" | "accent", value: string) => {
    setData((prev) => (prev ? { ...prev, theme: { ...prev.theme, colors: { ...prev.theme?.colors, [key]: value } } } : prev));
    setChanged(true);
  }, []);

  const openPicker = useCallback((cb: (url: string) => void) => { pickerCb.current = cb; setPickerOpen(true); }, []);

  // Poll /generate until a NEW build finishes (lastBuildAt changes) or errors.
  const startPoll = useCallback((baselineBuildAt: string | null | undefined) => {
    if (pollRef.current) return;
    const start = Date.now();
    pollRef.current = setInterval(async () => {
      const elapsed = (Date.now() - start) / 1000;
      const st = await fetch(`/api/ecommerce/store/${storeId}/generate`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (!st) return;
      if (st.buildStatus === "deploying") setBuildStep("Deploying to your live store…");
      else if (elapsed < 20) setBuildStep("Compiling your store…");
      else setBuildStep("Almost done…");
      const newBuilt = st.buildStatus === "built" && st.lastBuildAt && st.lastBuildAt !== baselineBuildAt;
      const newError = st.buildStatus === "error" && (!baselineBuildAt || st.lastBuildAt !== baselineBuildAt || elapsed > 10);
      if (newBuilt || newError || elapsed > 300) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        setRebuilding(false); setBuildStep("");
        await loadStore();
        if (newBuilt) {
          const nonce = Date.now();
          setPreviewNonce(nonce);
          if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
          setBuildResult({ type: "success", message: "Your store is updated and live." });
          setTimeout(() => setBuildResult(null), 5000);
        } else {
          setBuildResult({ type: "error", message: st.lastBuildError?.substring(0, 200) || "The store update failed. Open Status to retry." });
          setActiveTab("preview");
        }
      }
    }, 3000);
  }, [storeId, loadStore]);

  const rebuild = useCallback(async () => {
    setRebuilding(true); setBuildResult(null); setBuildStep("Starting your store update…");
    const baseline = await fetch(`/api/ecommerce/store/${storeId}/generate`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    try {
      const r = await fetch(`/api/ecommerce/store/${storeId}/rebuild`, { method: "POST" });
      if (!r.ok) { const j = await r.json().catch(() => null); throw new Error(j?.error || "Store update failed to start."); }
      setBuildStep("Compiling your store (30–90s)…");
      startPoll(baseline?.lastBuildAt ?? null);
    } catch (e) {
      setRebuilding(false); setBuildStep("");
      setBuildResult({ type: "error", message: e instanceof Error ? e.message : "Store update failed." });
    }
  }, [storeId, startPoll]);

  const save = useCallback(async () => {
    if (!data) return;
    setSaving(true); setBuildResult(null); setBuildStep("Saving your changes…");
    try {
      const r = await fetch(`/api/ecommerce/store/${storeId}/update-data`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || "Couldn't save your changes.");
      setChanged(false); setSaving(false);
      await rebuild();
    } catch (e) {
      setSaving(false); setBuildStep("");
      setBuildResult({ type: "error", message: e instanceof Error ? e.message : "Couldn't save." });
    }
  }, [data, storeId, rebuild]);

  if (loading) {
    return <div className="grid min-h-0 flex-1 place-items-center"><FlowLoader size={34} withMark label="Opening the store studio…" /></div>;
  }
  if (!store) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center p-8 text-center">
        <div>
          <p className="text-[14px] font-semibold">We couldn&apos;t open your store.</p>
          <button onClick={onBack} className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3.5 py-2 text-[12.5px] font-semibold hover:border-brand-500/60"><ArrowLeft className="h-3.5 w-3.5" /> Back</button>
        </div>
      </div>
    );
  }

  const storeUrl = store.storeUrl || `/stores/${store.slug}/`;
  const absoluteStoreUrl = typeof window !== "undefined" && !storeUrl.startsWith("http") ? `${window.location.origin}${storeUrl}` : storeUrl;
  const previewUrl = `/api/proxy?url=${encodeURIComponent(absoluteStoreUrl)}&preview=${previewNonce}`;

  const tabs: { id: TabId; label: string; icon: ElementType }[] = [
    { id: "preview", label: "Preview", icon: Globe },
    { id: "store-info", label: "Store Info", icon: Store },
    { id: "theme", label: "Theme & colors", icon: Droplet },
    { id: "hero", label: "Hero", icon: LayoutDashboard },
    { id: "categories", label: "Categories", icon: Grid3X3 },
    { id: "navigation", label: "Navigation", icon: Link2 },
    { id: "footer-social", label: "Footer & Social", icon: Share2 },
    { id: "policies", label: "Policies", icon: ScrollText },
    { id: "faq", label: "FAQ", icon: HelpCircle },
    { id: "pages", label: "Pages", icon: FileText },
    { id: "ai", label: "AI Redesign", icon: Wand2 },
    { id: "domains", label: "Domains", icon: Globe },
    { id: "status", label: "Status", icon: Server },
  ];
  const primaryLabel = busy ? (saving ? "Saving…" : "Updating…") : changed ? "Save & update" : "Update store";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start">
        {/* LEFT: sticky header + tab nav */}
        <aside className="space-y-3 lg:sticky lg:top-0 lg:w-[260px] lg:shrink-0">
          <div className="rounded-2xl border border-border bg-card p-3">
            <button onClick={onBack} className="mb-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" /> Back to store</button>
            <div className="flex items-start gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/20 to-violet-500/15 text-brand-500"><Store className="h-4.5 w-4.5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold leading-tight">{store.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">/stores/{store.slug}</p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-1.5">
              <StatusBadge build={store.buildStatus} />
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

        {/* RIGHT: action bar + tab content */}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-3.5 py-2.5">
            <h2 className="text-[13px] font-bold">{tabs.find((t) => t.id === activeTab)?.label}</h2>
            <div className="ms-auto flex flex-wrap items-center gap-2">
              <a href={storeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /> View</a>
              <button onClick={changed ? save : rebuild} disabled={busy} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-1.5 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">
                {busy ? <FlowLoader size={14} tone="white" /> : changed ? <Save className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {primaryLabel}
              </button>
            </div>
          </div>

          {busy && buildStep && (
            <div className="flex items-center gap-2.5 rounded-2xl border border-brand-500/30 bg-brand-500/5 px-4 py-3 text-[12.5px] text-brand-500"><FlowLoader size={16} /> {buildStep}<span className="ms-auto text-[11px] text-muted-foreground">usually 30–90s</span></div>
          )}
          {buildResult && (
            <div className={cn("flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-[12.5px]", buildResult.type === "success" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400" : "border-rose-500/30 bg-rose-500/5 text-rose-500")}>
              {buildResult.type === "success" ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              <p className="flex-1 font-medium">{buildResult.message}</p>
              <button onClick={() => setBuildResult(null)} className="opacity-70 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}

          {activeTab === "preview" && (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2">
                <div className="flex gap-1.5"><span className="h-3 w-3 rounded-full bg-rose-400" /><span className="h-3 w-3 rounded-full bg-amber-400" /><span className="h-3 w-3 rounded-full bg-emerald-400" /></div>
                <span className="flex-1 truncate text-center text-[11px] text-muted-foreground">flowsmartly.com{storeUrl}</span>
              </div>
              {store.buildStatus === "built" || store.buildStatus === "deploying" ? (
                <iframe ref={iframeRef} src={previewUrl} className="h-[74vh] w-full border-0" title="Store preview" />
              ) : (
                <div className="px-6 py-20 text-center">
                  <p className="mb-3 text-[13px] text-muted-foreground">{isBuildingStatus(store.buildStatus) ? "Building…" : store.buildStatus === "error" ? "The last build failed." : "Not built yet."}</p>
                  {!isBuildingStatus(store.buildStatus) && <button onClick={rebuild} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white"><RefreshCw className="h-3.5 w-3.5" /> Build now</button>}
                </div>
              )}
            </div>
          )}

          {activeTab === "store-info" && data && <StoreInfoTab data={data} updateInfo={updateInfo} openPicker={openPicker} />}
          {activeTab === "theme" && data && <ThemeTab data={data} updateThemeColor={updateThemeColor} />}
          {activeTab === "footer-social" && data && <FooterSocialTab data={data} updateSocial={updateSocial} updateContact={updateContact} />}
          {activeTab === "policies" && data && <PoliciesTab data={data} updatePolicy={updatePolicy} />}
          {activeTab === "hero" && data && <HeroTab data={data} updateHero={updateHero} updateInfo={updateInfo} openPicker={openPicker} />}
          {activeTab === "categories" && data && <CategoriesTab data={data} update={update} openPicker={openPicker} onOpenView={onOpenView} />}
          {activeTab === "navigation" && data && <NavigationTab data={data} update={update} />}
          {activeTab === "faq" && data && <FaqTab data={data} update={update} />}
          {activeTab === "pages" && data && <PagesTab data={data} onEdit={() => setActiveTab("ai")} />}
          {activeTab === "ai" && <AiRedesignTab storeId={storeId} onRebuild={rebuild} onAsk={onAsk} storeName={store.name} />}
          {activeTab === "domains" && <DomainsTab store={store} storeUrl={storeUrl} onOpenView={onOpenView} />}
          {activeTab === "status" && <StatusTab store={store} onRebuild={rebuild} busy={busy} rebuilding={rebuilding} />}
        </div>
      </div>

      {pickerOpen && (
        <MediaLibraryPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={(url) => { pickerCb.current?.(url); setPickerOpen(false); }} filterTypes={["image"]} />
      )}
    </div>
  );
}

/* ── AI content assist ────────────────────────────────────────────────── */

type ContentType = "tagline" | "about" | "hero" | "return_policy" | "shipping_policy" | "terms_of_service" | "privacy_policy" | "faq";
interface StoreContentResult {
  tagline?: string; about?: string;
  hero?: { headline?: string; subheadline?: string };
  returnPolicy?: string; shippingPolicy?: string; termsOfService?: string; privacyPolicy?: string;
  faq?: Array<{ question: string; answer: string }>;
}

/** Calls the shared store-content generator. Returns generated text (not saved) or a friendly error. */
async function generateContent(contentTypes: ContentType[]): Promise<{ ok: true; data: StoreContentResult } | { ok: false; error: string }> {
  try {
    const r = await fetch("/api/ecommerce/ai/store-content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentTypes }) });
    const j = await r.json().catch(() => null);
    if (r.ok && j?.success) return { ok: true, data: j.data as StoreContentResult };
    if (r.status === 402) return { ok: false, error: j?.error?.message || "You're out of credits for AI writing." };
    return { ok: false, error: j?.error?.message || "Couldn't generate that — please try again." };
  } catch {
    return { ok: false, error: "Couldn't reach the AI writer — please try again." };
  }
}

/** Small inline "write with AI" button used across the content tabs. */
function AiButton({ onRun, busy, label = "Write with AI", disabled }: { onRun: () => void; busy: boolean; label?: string; disabled?: boolean }) {
  return (
    <button onClick={onRun} disabled={busy || disabled} title="Generate with AI — fills the fields for you to review, then Save to apply" className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-500/40 bg-brand-500/5 px-3 py-1.5 text-[12px] font-semibold text-brand-500 hover:bg-brand-500/10 disabled:opacity-60">
      {busy ? <FlowLoader size={13} /> : <Sparkles className="h-3.5 w-3.5" />} {busy ? "Writing…" : label}
    </button>
  );
}

/** Encapsulates the busy/error state for an AI-assist action in a tab. */
function useAiFill() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = useCallback(async (types: ContentType[], apply: (d: StoreContentResult) => void) => {
    setBusy(true); setError("");
    const res = await generateContent(types);
    if (res.ok) apply(res.data); else setError(res.error);
    setBusy(false);
  }, []);
  return { busy, error, run };
}

function AiError({ error }: { error: string }) {
  if (!error) return null;
  return <p className="flex items-center gap-1.5 text-[11.5px] text-rose-500"><AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}</p>;
}

/* ── Tabs ─────────────────────────────────────────────────────────────── */

function StoreInfoTab({ data, updateInfo, openPicker }: { data: StoreData; updateInfo: (k: keyof StoreInfo, v: string) => void; openPicker: (cb: (url: string) => void) => void }) {
  const si = data.storeInfo;
  const ai = useAiFill();
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Section title="Store information" action={<AiButton busy={ai.busy} label="Write tagline & about" onRun={() => ai.run(["tagline", "about"], (d) => { if (d.tagline) updateInfo("tagline", d.tagline); if (d.about) updateInfo("about", d.about); })} />}>
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <Field label="Store name" value={si.name} onChange={(v) => updateInfo("name", v)} />
            <Field label="Tagline" value={si.tagline} onChange={(v) => updateInfo("tagline", v)} />
            <Field label="Currency" value={si.currency} onChange={(v) => updateInfo("currency", v)} />
            <Field label="Region" value={si.region || ""} onChange={(v) => updateInfo("region", v)} />
            <Field label="Address" value={si.address} onChange={(v) => updateInfo("address", v)} span={2} />
            <Field label="Description" value={si.description} onChange={(v) => updateInfo("description", v)} multiline span={2} />
            <Field label="About" value={si.about} onChange={(v) => updateInfo("about", v)} multiline span={2} />
            <Field label="Mission" value={si.mission} onChange={(v) => updateInfo("mission", v)} multiline span={2} />
          </div>
          <div className="mt-2"><AiError error={ai.error} /></div>
        </Section>
        <Section title="Call-to-action">
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <Field label="CTA button text" value={si.ctaText} onChange={(v) => updateInfo("ctaText", v)} />
            <Field label="CTA URL" value={si.ctaUrl} onChange={(v) => updateInfo("ctaUrl", v)} />
          </div>
        </Section>
      </div>
      <div className="space-y-4">
        <Section title="Branding">
          <div className="space-y-3">
            <ImageField label="Logo" value={si.logoUrl} onChange={(v) => updateInfo("logoUrl", v)} openPicker={openPicker} contain />
            <ImageField label="Banner / hero image" value={si.bannerUrl} onChange={(v) => updateInfo("bannerUrl", v)} openPicker={openPicker} />
          </div>
        </Section>
      </div>
    </div>
  );
}

function HeroTab({ data, updateHero, updateInfo, openPicker }: { data: StoreData; updateHero: <K extends keyof HeroConfig>(k: K, v: HeroConfig[K]) => void; updateInfo: (k: keyof StoreInfo, v: string) => void; openPicker: (cb: (url: string) => void) => void }) {
  const hero = data.heroConfig;
  const slides = hero.slides || [];
  const heroAi = useAiFill();
  const move = (idx: number, dir: -1 | 1) => {
    const cur = [...slides]; const t = idx + dir;
    if (t < 0 || t >= cur.length) return;
    [cur[idx], cur[t]] = [cur[t], cur[idx]];
    updateHero("slides", cur);
  };
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Section title="Hero text" action={<AiButton busy={heroAi.busy} onRun={() => heroAi.run(["hero"], (d) => { if (d.hero?.headline) updateHero("headline", d.hero.headline); if (d.hero?.subheadline) updateHero("subheadline", d.hero.subheadline); })} />}>
        <div className="space-y-3">
          <Field label="Headline" value={hero.headline} onChange={(v) => updateHero("headline", v)} />
          <Field label="Sub-headline" value={hero.subheadline} onChange={(v) => updateHero("subheadline", v)} multiline />
          <Field label="CTA button text" value={hero.ctaText} onChange={(v) => updateHero("ctaText", v)} />
          <Field label="CTA URL" value={hero.ctaUrl} onChange={(v) => updateHero("ctaUrl", v)} />
          <AiError error={heroAi.error} />
        </div>
      </Section>
      <div className="space-y-4">
        <Section title="Hero style" hint="Slideshow rotates the images below. Single image uses the banner. Gradient skips images.">
          <select value={hero.style || "slideshow"} onChange={(e) => updateHero("style", e.target.value as HeroConfig["style"])} className={F}>
            <option value="slideshow">Slideshow (multiple images)</option>
            <option value="image">Single image</option>
            <option value="gradient">Gradient only</option>
            <option value="video">Video background</option>
          </select>
        </Section>
        <Section title={`Slideshow images (${slides.length}/8)`} hint="3–5 banner images to rotate. Reorder with the arrows.">
          <div className="space-y-2">
            {slides.map((url, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded-lg border border-border bg-background p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Slide ${idx + 1}`} className="h-12 w-12 shrink-0 rounded object-cover" />
                <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{url}</span>
                <button onClick={() => move(idx, -1)} disabled={idx === 0} className="grid h-7 w-7 place-items-center rounded border border-border disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                <button onClick={() => move(idx, 1)} disabled={idx === slides.length - 1} className="grid h-7 w-7 place-items-center rounded border border-border disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                <button onClick={() => updateHero("slides", slides.filter((_, i) => i !== idx))} className="grid h-7 w-7 place-items-center rounded border border-border text-muted-foreground hover:border-rose-500/60 hover:text-rose-500"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            {slides.length < 8 && (
              <button onClick={() => openPicker((url) => { if (!slides.includes(url)) updateHero("slides", [...slides, url]); })} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-[12.5px] font-semibold text-muted-foreground hover:border-brand-500/50 hover:text-brand-500"><ImageIcon className="h-4 w-4" /> Add slideshow image</button>
            )}
          </div>
        </Section>
        <Section title="Hero background (fallback)" hint='Used for "Single image" style, or when the slideshow is empty.'>
          <ImageField label="" value={data.storeInfo.bannerUrl} onChange={(v) => updateInfo("bannerUrl", v)} openPicker={openPicker} />
        </Section>
      </div>
    </div>
  );
}

function CategoriesTab({ data, update, openPicker, onOpenView }: { data: StoreData; update: <K extends keyof StoreData>(k: K, v: StoreData[K]) => void; openPicker: (cb: (url: string) => void) => void; onOpenView?: (k: string) => void }) {
  const cats = data.categories || [];
  const set = (i: number, field: string, value: string) => { const c = [...cats]; c[i] = { ...c[i], [field]: value }; update("categories", c); };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div><h3 className="text-[14px] font-bold">Categories ({cats.length})</h3><p className="text-[11.5px] text-muted-foreground">Edit names, images, and descriptions — applied on Save.</p></div>
        {onOpenView && <button onClick={() => onOpenView("sell")} className="text-[11.5px] font-semibold text-brand-500 hover:underline">Manage in Sell →</button>}
      </div>
      {cats.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-[12.5px] text-muted-foreground">No categories yet. Add products with categories in the Sell surface.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {cats.map((cat, i) => (
            <div key={cat.id || i} className="overflow-hidden rounded-2xl border border-border bg-card">
              <button onClick={() => openPicker((url) => set(i, "image", url))} className="relative block aspect-video w-full overflow-hidden bg-muted">
                {cat.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cat.image} alt={cat.name} className="h-full w-full object-cover" />
                ) : <div className="grid h-full w-full place-items-center text-muted-foreground"><ImageIcon className="h-7 w-7" /></div>}
                <span className="absolute bottom-1.5 right-1.5 rounded-md bg-background/80 px-2 py-1 text-[10.5px] font-semibold">Change image</span>
              </button>
              <div className="space-y-2.5 p-3">
                <Field label="Name" value={cat.name} onChange={(v) => set(i, "name", v)} />
                <Field label="Description" value={cat.description || ""} onChange={(v) => set(i, "description", v)} multiline />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NavigationTab({ data, update }: { data: StoreData; update: <K extends keyof StoreData>(k: K, v: StoreData[K]) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Header navigation" hint="Links in the top menu.">
          <LinkRows links={data.navLinks || []} onChange={(v) => update("navLinks", v)} addLabel="Add nav link" />
        </Section>
        <Section title="Footer links" hint="Legal & extra links. Nav links appear in the footer automatically.">
          <LinkRows links={data.footerLinks || []} onChange={(v) => update("footerLinks", v)} addLabel="Add footer link" />
        </Section>
      </div>
      {data.pages?.length > 0 && (
        <Section title="Available pages">
          <div className="flex flex-wrap gap-2">
            {data.pages.map((p) => <span key={p.slug} className="rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-medium text-muted-foreground"><code>/{p.slug}</code> — {p.label}</span>)}
          </div>
        </Section>
      )}
    </div>
  );
}

function LinkRows({ links, onChange, addLabel }: { links: Array<{ href: string; label: string }>; onChange: (v: Array<{ href: string; label: string }>) => void; addLabel: string }) {
  return (
    <div className="space-y-2.5">
      {links.map((link, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
          <input value={link.label} onChange={(e) => { const l = [...links]; l[i] = { ...l[i], label: e.target.value }; onChange(l); }} placeholder="Label" className={F} />
          <input value={link.href} onChange={(e) => { const l = [...links]; l[i] = { ...l[i], href: e.target.value }; onChange(l); }} placeholder="/products or https://…" className={F} />
          <button onClick={() => { const l = [...links]; l.splice(i, 1); onChange(l); }} className="grid h-8 w-8 place-items-center rounded-[9px] border border-border text-muted-foreground hover:border-rose-500/60 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <button onClick={() => onChange([...links, { label: "New link", href: "/" }])} className="inline-flex items-center gap-1.5 rounded-[10px] border border-dashed border-border px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:border-brand-500/50 hover:text-brand-500"><Plus className="h-3.5 w-3.5" /> {addLabel}</button>
    </div>
  );
}

function FaqTab({ data, update }: { data: StoreData; update: <K extends keyof StoreData>(k: K, v: StoreData[K]) => void }) {
  const faq = data.faq || [];
  const ai = useAiFill();
  const generate = () => ai.run(["faq"], (d) => {
    const items = (d.faq || []).filter((x) => x.question && x.answer);
    if (items.length) update("faq", [...faq, ...items]);
  });
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-bold">FAQ ({faq.length})</h3>
        <div className="flex items-center gap-2">
          <AiButton busy={ai.busy} label="Generate FAQ" onRun={generate} />
          <button onClick={() => update("faq", [...faq, { question: "", answer: "" }])} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm"><Plus className="h-3.5 w-3.5" /> Add</button>
        </div>
      </div>
      <AiError error={ai.error} />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {faq.map((item, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-semibold text-muted-foreground">#{i + 1}</span><button onClick={() => update("faq", faq.filter((_, j) => j !== i))} className="grid h-7 w-7 place-items-center rounded-[8px] text-muted-foreground hover:bg-rose-500/5 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button></div>
            <div className="space-y-3">
              <Field label="Question" value={item.question} onChange={(v) => { const f = [...faq]; f[i] = { ...f[i], question: v }; update("faq", f); }} />
              <Field label="Answer" value={item.answer} onChange={(v) => { const f = [...faq]; f[i] = { ...f[i], answer: v }; update("faq", f); }} multiline />
            </div>
          </div>
        ))}
        {faq.length === 0 && <div className="rounded-2xl border border-dashed border-border p-8 text-center text-[12.5px] text-muted-foreground lg:col-span-2">No FAQ items yet — add one.</div>}
      </div>
    </div>
  );
}

function PagesTab({ data, onEdit }: { data: StoreData; onEdit: () => void }) {
  return (
    <div className="space-y-3">
      <div><h3 className="text-[14px] font-bold">Store pages</h3><p className="text-[11.5px] text-muted-foreground">Use AI Redesign to change any page&apos;s content & design.</p></div>
      {(data.pages || []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-[12.5px] text-muted-foreground">No pages detected — update the store to refresh.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.pages.map((p) => (
            <div key={p.slug} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="min-w-0"><p className="truncate text-[13px] font-medium">{p.label}</p><code className="text-[11px] text-muted-foreground">/{p.slug}</code></div>
              <button onClick={onEdit} className="inline-flex shrink-0 items-center gap-1 rounded-[10px] border border-border px-3 py-1.5 text-[12px] font-semibold hover:border-brand-500/60 hover:text-foreground"><Wand2 className="h-3.5 w-3.5" /> Edit</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ThemeTab({ data, updateThemeColor }: { data: StoreData; updateThemeColor: (k: "primary" | "secondary" | "accent", v: string) => void }) {
  const colors = data.theme?.colors || {};
  const primary = colors.primary || "#6366f1";
  const accent = colors.accent || primary;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Section title="Brand colors" hint="The whole storefront themes off these — buttons, links, badges, hero. A tint scale (50–900) is derived automatically.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ColorField label="Primary" value={colors.primary || "#6366f1"} onChange={(v) => updateThemeColor("primary", v)} />
          <ColorField label="Secondary" value={colors.secondary || "#a78bfa"} onChange={(v) => updateThemeColor("secondary", v)} />
          <ColorField label="Accent" value={colors.accent || "#e0651a"} onChange={(v) => updateThemeColor("accent", v)} />
        </div>
        <p className="mt-3 text-[11.5px] text-muted-foreground">Save &amp; update to rebuild the store with the new palette.</p>
      </Section>
      <Section title="Live preview">
        <div className="overflow-hidden rounded-2xl border border-border">
          <div className="px-6 py-8 text-center text-white" style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}>
            <p className="text-[17px] font-extrabold">{data.storeInfo.tagline || data.storeInfo.name}</p>
            <p className="mt-1 text-[12px] opacity-90">{(data.storeInfo.description || "Your storefront").slice(0, 64)}</p>
            <span className="mt-3 inline-block rounded-lg px-4 py-2 text-[12px] font-bold text-white" style={{ background: accent }}>{data.storeInfo.ctaText || "Shop now"}</span>
          </div>
          <div className="flex gap-3 bg-card p-4">
            {[1, 2, 3].map((i) => (<div key={i} className="w-20"><div className="aspect-square rounded-lg bg-muted" /><p className="mt-1 text-[11px] font-bold text-foreground">$20.00</p></div>))}
          </div>
        </div>
      </Section>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#6366f1";
  return (
    <div>
      <span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" value={safe} onChange={(e) => onChange(e.target.value)} className="h-9 w-11 shrink-0 cursor-pointer rounded-[8px] border border-border bg-card p-0.5" />
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#6366f1" className={F} />
      </div>
    </div>
  );
}

function FooterSocialTab({ data, updateSocial, updateContact }: { data: StoreData; updateSocial: (k: keyof SocialLinks, v: string) => void; updateContact: (k: "emails" | "phones", v: string) => void }) {
  const si = data.storeInfo;
  const sl = si.socialLinks || {};
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Section title="Social links" hint="Shown in your storefront footer.">
        <div className="space-y-3">
          <Field label="Instagram" value={sl.instagram || ""} onChange={(v) => updateSocial("instagram", v)} />
          <Field label="Facebook" value={sl.facebook || ""} onChange={(v) => updateSocial("facebook", v)} />
          <Field label="TikTok" value={sl.tiktok || ""} onChange={(v) => updateSocial("tiktok", v)} />
          <Field label="X / Twitter" value={sl.twitter || ""} onChange={(v) => updateSocial("twitter", v)} />
        </div>
      </Section>
      <Section title="Contact" hint="Rendered in the footer contact block.">
        <div className="space-y-3">
          <Field label="Email" value={si.emails?.[0] || ""} onChange={(v) => updateContact("emails", v)} />
          <Field label="Phone" value={si.phones?.[0] || ""} onChange={(v) => updateContact("phones", v)} />
        </div>
      </Section>
    </div>
  );
}

const POLICY_CONTENT_TYPE: Record<keyof Policies, ContentType> = { shipping: "shipping_policy", returns: "return_policy", privacy: "privacy_policy", terms: "terms_of_service" };
const POLICY_RESULT_KEY: Record<keyof Policies, keyof StoreContentResult> = { shipping: "shippingPolicy", returns: "returnPolicy", privacy: "privacyPolicy", terms: "termsOfService" };

function PoliciesTab({ data, updatePolicy }: { data: StoreData; updatePolicy: (k: keyof Policies, v: string) => void }) {
  const [tab, setTab] = useState<keyof Policies>("shipping");
  const pol = data.policies || {};
  const ai = useAiFill();
  const KEYS: { id: keyof Policies; label: string }[] = [{ id: "shipping", label: "Shipping" }, { id: "returns", label: "Returns" }, { id: "privacy", label: "Privacy" }, { id: "terms", label: "Terms" }];
  const genCurrent = () => ai.run([POLICY_CONTENT_TYPE[tab]], (d) => {
    const v = d[POLICY_RESULT_KEY[tab]];
    if (typeof v === "string" && v) updatePolicy(tab, v);
  });
  return (
    <Section title="Store policies" hint="The four legal pages buyers can read. Basic HTML supported (h2, p, ul, li). Applied on Save." action={<AiButton busy={ai.busy} label={`Write ${tab} policy`} onRun={genCurrent} />}>
      <div className="mb-3 flex flex-wrap gap-2">
        {KEYS.map((k) => (
          <button key={k.id} onClick={() => setTab(k.id)} className={cn("rounded-full border px-3 py-1.5 text-[12px] font-semibold", tab === k.id ? "border-transparent bg-brand-500/10 text-brand-500" : "border-border text-muted-foreground hover:border-brand-500/60")}>{k.label}</button>
        ))}
      </div>
      <textarea value={pol[tab] || ""} onChange={(e) => updatePolicy(tab, e.target.value)} rows={14} placeholder="<h2>Shipping Policy</h2><p>…</p>" className={cn(F, "resize-y font-mono !text-[12px] leading-relaxed")} />
      <div className="mt-2"><AiError error={ai.error} /></div>
    </Section>
  );
}

function AiRedesignTab({ storeId, onRebuild, onAsk, storeName }: { storeId: string; onRebuild: () => void; onAsk?: (p: string) => void; storeName: string }) {
  const [sections, setSections] = useState<Array<{ id: string; label: string }>>([]);
  const [cost, setCost] = useState(50);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState("");
  const [prompt, setPrompt] = useState("");
  const [updating, setUpdating] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/ecommerce/store/${storeId}/update-section`).then((r) => r.json()).catch(() => null).then((d) => {
      if (!alive || !d) return;
      setSections(d.sections || []);
      if (d.creditCost) setCost(d.creditCost);
      if (d.sections?.length) setSection(d.sections[0].id);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [storeId]);

  const run = async () => {
    if (!section || !prompt.trim()) return;
    setUpdating(true); setResult(null);
    try {
      const r = await fetch(`/api/ecommerce/store/${storeId}/update-section`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ section, prompt: prompt.trim() }) });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.success) { setResult({ type: "success", message: d.message || "Section updated — updating your store." }); setPrompt(""); onRebuild(); }
      else setResult({ type: "error", message: d?.error || "The update failed." });
    } catch { setResult({ type: "error", message: "The update failed." }); }
    finally { setUpdating(false); }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Section title="AI redesign a section" hint="Pick a section and describe the change — AI rewrites the code and updates your store.">
          {loading ? <div className="grid place-items-center py-8"><FlowLoader size={22} label="Loading sections…" /></div> : (
            <div className="space-y-3">
              <label className="block"><span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">Section</span><select value={section} onChange={(e) => setSection(e.target.value)} disabled={updating} className={F}>{sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
              <label className="block"><span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">What do you want to change?</span><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={updating} rows={4} placeholder="e.g. Make the hero a bold gradient with the slideshow on the right and larger product cards below…" className={cn(F, "resize-y")} /></label>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={run} disabled={updating || !prompt.trim() || !section} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60">{updating ? <FlowLoader size={14} tone="white" /> : <Wand2 className="h-3.5 w-3.5" />} {updating ? "Updating…" : "Update section"}</button>
                <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground"><Palette className="h-3.5 w-3.5 text-amber-500" /> {cost} credits</span>
                {onAsk && <button onClick={() => onAsk(`I'm in the Store Studio for "${storeName}". Help me redesign my storefront. Use edit_store.`)} className="ms-auto text-[11.5px] font-semibold text-brand-500 hover:underline">Ask the agent instead →</button>}
              </div>
              {result && (
                <div className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px]", result.type === "success" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400" : "border-rose-500/30 bg-rose-500/5 text-rose-500")}>{result.type === "success" ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}<p>{result.message}</p></div>
              )}
            </div>
          )}
        </Section>
      </div>
      <Section title="What AI can change">
        <ul className="space-y-2 text-[12px] text-muted-foreground">
          {["Layouts, colors, fonts, spacing", "Hero, header, footer design", "Product cards & category pages", "Banners, announcements, promos", "Store info & contact content", "Any design change you can describe"].map((t) => <li key={t} className="flex items-start gap-2"><span className="mt-0.5 text-brand-500">•</span> {t}</li>)}
        </ul>
      </Section>
    </div>
  );
}

function DomainsTab({ store, storeUrl, onOpenView }: { store: StoreRecord; storeUrl: string; onOpenView?: (k: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Section title="Store URL" hint="Where your store is live right now.">
        <div className="mb-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5"><code className="break-all text-[12.5px]">flowsmartly.com{storeUrl}</code></div>
        <p className="mb-3 text-[12.5px] text-muted-foreground">To use a domain like <strong>yourstore.com</strong>, register or connect one in the Domains surface, then set it as your store domain.</p>
        <button onClick={() => onOpenView?.("domains")} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm"><Globe className="h-4 w-4" /> Manage domains</button>
      </Section>
      <Section title="How custom domains work">
        <ol className="space-y-3">
          {[["1", "Register or connect a domain", "Buy a new one in Domains, or connect one you own."], ["2", '"Use for my store"', "In Domains, open your domain and toggle it to serve your store."], ["3", "Point your DNS", "Add the record we show you at your DNS provider."], ["4", "Go live (SSL included)", "Your store serves on your domain within minutes."]].map(([n, t, d]) => (
            <li key={n} className="flex items-start gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-500/10 text-[11px] font-bold text-brand-500">{n}</span><div><p className="text-[12.5px] font-semibold">{t}</p><p className="mt-0.5 text-[11.5px] text-muted-foreground">{d}</p></div></li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

function StatusTab({ store, onRebuild, busy, rebuilding }: { store: StoreRecord; onRebuild: () => void; busy: boolean; rebuilding: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Section title="Build status">
        <div className="flex items-center gap-2 text-[12.5px]">
          <span className="font-medium">Status:</span>
          {store.buildStatus === "built" ? <span className="inline-flex items-center gap-1 text-emerald-600"><Check className="h-4 w-4" /> Live</span>
            : isBuildingStatus(store.buildStatus) ? <span className="inline-flex items-center gap-1 text-brand-500"><FlowLoader size={14} /> {store.buildStatus === "deploying" ? "Deploying…" : "Building…"}</span>
            : store.buildStatus === "error" ? <span className="inline-flex items-center gap-1 text-rose-500"><AlertCircle className="h-4 w-4" /> Error</span>
            : <span className="text-muted-foreground">Idle</span>}
        </div>
        {store.ssrStatus && <div className="mt-2 flex flex-wrap items-center gap-1.5"><span className="rounded-full bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">V3 SSR</span><span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-600">{store.ssrStatus}{store.ssrPort ? ` · :${store.ssrPort}` : ""}</span></div>}
        {store.lastBuildAt && <p className="mt-2 text-[11.5px] text-muted-foreground">Last build: {new Date(store.lastBuildAt).toLocaleString()}</p>}
        {store.buildStatus === "error" && store.lastBuildError && <pre className="mt-3 max-h-52 overflow-auto rounded-lg bg-rose-500/5 p-3 text-[11px] text-rose-600 dark:text-rose-300">{store.lastBuildError}</pre>}
        <div className="mt-3"><button onClick={onRebuild} disabled={busy} className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-brand-500 to-violet-500 px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60">{rebuilding ? <FlowLoader size={14} tone="white" /> : <RefreshCw className="h-3.5 w-3.5" />} Update store</button></div>
      </Section>
      <Section title="When to update">
        <ul className="space-y-2.5 text-[12.5px] text-muted-foreground">
          <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> After editing store info, hero, or navigation</li>
          <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> After editing categories or FAQ</li>
          <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> After an AI redesign</li>
          <li className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> An update takes 1–3 minutes; your store stays live</li>
        </ul>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-brand-500/20 bg-brand-500/5 px-3 py-2 text-[11.5px] text-muted-foreground"><Rocket className="h-3.5 w-3.5 text-brand-500" /> Changes deploy with zero downtime.</div>
      </Section>
    </div>
  );
}

/* ── shared UI ────────────────────────────────────────────────────────── */

function Section({ title, hint, children, action }: { title: string; hint?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0"><h3 className="text-[13.5px] font-bold">{title}</h3>{hint && <p className="mt-0.5 text-[11.5px] text-muted-foreground">{hint}</p>}</div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, value, onChange, multiline, span }: { label: string; value?: string; onChange: (v: string) => void; multiline?: boolean; span?: number }) {
  return (
    <label className={cn("block", span === 2 && "sm:col-span-2")}>
      {label && <span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">{label}</span>}
      {multiline ? <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={3} className={cn(F, "resize-y")} /> : <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} className={F} />}
    </label>
  );
}

function ImageField({ label, value, onChange, openPicker, contain }: { label: string; value?: string; onChange: (v: string) => void; openPicker: (cb: (url: string) => void) => void; contain?: boolean }) {
  return (
    <div>
      {label && <span className="mb-1 block text-[11.5px] font-semibold text-muted-foreground">{label}</span>}
      <div className="flex gap-2">
        <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder="/images/…" className={cn(F, "min-w-0 flex-1")} />
        <button onClick={() => openPicker(onChange)} className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border border-border px-3 py-2 text-[12px] font-semibold hover:border-brand-500/60"><ImageIcon className="h-3.5 w-3.5" /> Browse</button>
      </div>
      <div className={cn("mt-2 grid place-items-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/30", contain ? "h-20" : "aspect-video")}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className={cn("h-full w-full", contain ? "object-contain p-2" : "object-cover")} />
        ) : <span className="text-[11px] text-muted-foreground">Preview</span>}
      </div>
    </div>
  );
}

function StatusBadge({ build }: { build?: string }) {
  const building = isBuildingStatus(build);
  const built = build === "built";
  const error = build === "error";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", building ? "bg-amber-500/10 text-amber-500" : built ? "bg-emerald-500/10 text-emerald-500" : error ? "bg-rose-500/10 text-rose-500" : "bg-muted text-muted-foreground")}>
      {building ? "Building…" : built ? "Live" : error ? "Error" : "Draft"}
    </span>
  );
}
