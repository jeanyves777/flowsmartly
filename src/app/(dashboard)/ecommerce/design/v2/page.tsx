"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Eye,
  Store,
  ShoppingBag,
  Type,
  Navigation,
  FileText,
  HelpCircle,
  Globe,
  Wrench,
  Loader2,
  Save,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  AlertCircle,
  Check,
  Monitor,
  Tablet,
  Smartphone,
  Plus,
  Trash2,
  ImageIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageLoader } from "@/components/shared/page-loader";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StoreData {
  id: string;
  name: string;
  slug: string;
  generatorVersion: string;
  buildStatus: string;
  lastBuildError: string | null;
  storeVersion: string;
}

interface SiteData {
  storeInfo?: Record<string, string>;
  heroConfig?: Record<string, string>;
  navLinks?: Array<{ href: string; label: string }>;
  footerLinks?: Array<{ href: string; label: string }>;
  categories?: Array<Record<string, string>>;
  faq?: Array<Record<string, string>>;
  products?: Array<Record<string, string>>;
}

type TabId = "preview" | "store-info" | "hero" | "products" | "categories" | "navigation" | "policies" | "faq" | "build";

const TABS: Array<{ id: TabId; label: string; icon: typeof Eye }> = [
  { id: "preview", label: "Preview", icon: Eye },
  { id: "store-info", label: "Store Info", icon: Store },
  { id: "hero", label: "Hero", icon: Type },
  { id: "products", label: "Products", icon: ShoppingBag },
  { id: "categories", label: "Categories", icon: Navigation },
  { id: "navigation", label: "Links", icon: Globe },
  { id: "faq", label: "FAQ", icon: HelpCircle },
  { id: "policies", label: "Policies", icon: FileText },
  { id: "build", label: "Build", icon: Wrench },
];

// ─── Main Component ──────────────────────────────────────────────────────────

export default function StoreEditorV2Page() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<StoreData | null>(null);
  const [siteData, setSiteData] = useState<SiteData>({});
  const [activeTab, setActiveTab] = useState<TabId>("preview");
  const [saving, setSaving] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [dirty, setDirty] = useState(false);

  // ─── Load store + site data ──

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const storeRes = await fetch("/api/ecommerce/store");
      const storeJson = await storeRes.json();
      if (!storeJson.success || !storeJson.data.hasStore) {
        router.replace("/ecommerce");
        return;
      }

      const s = storeJson.data.store;
      if (s.generatorVersion !== "v2") {
        router.replace("/ecommerce/design");
        return;
      }

      setStore(s);

      // Load site data
      const dataRes = await fetch(`/api/ecommerce/store/${s.id}/site-data`);
      if (dataRes.ok) {
        const data = await dataRes.json();
        setSiteData(data);
      }
    } catch {
      toast({ title: "Failed to load store data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // ─── Save & Rebuild ──

  const handleSave = useCallback(async () => {
    if (!store) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ecommerce/store/${store.id}/update-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(siteData),
      });
      if (!res.ok) throw new Error("Save failed");

      // Trigger rebuild
      setRebuilding(true);
      const rebuildRes = await fetch(`/api/ecommerce/store/${store.id}/rebuild`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncBrandKit: false }),
      });
      if (!rebuildRes.ok) throw new Error("Rebuild failed");

      setDirty(false);
      toast({ title: "Saved & rebuilding..." });

      // Poll build status
      const pollInterval = setInterval(async () => {
        const statusRes = await fetch(`/api/ecommerce/store/${store.id}/generate`);
        if (statusRes.ok) {
          const status = await statusRes.json();
          if (status.buildStatus === "built") {
            clearInterval(pollInterval);
            setRebuilding(false);
            setStore(prev => prev ? { ...prev, buildStatus: "built" } : null);
            toast({ title: "Store rebuilt successfully" });
          } else if (status.buildStatus === "error") {
            clearInterval(pollInterval);
            setRebuilding(false);
            setStore(prev => prev ? { ...prev, buildStatus: "error", lastBuildError: status.lastBuildError } : null);
            toast({ title: "Build failed", description: status.lastBuildError, variant: "destructive" });
          }
        }
      }, 3000);

      // Safety timeout
      setTimeout(() => clearInterval(pollInterval), 120000);
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [store, siteData, toast]);

  // ─── Field update helper ──

  const updateField = (section: string, field: string, value: string) => {
    setSiteData(prev => ({
      ...prev,
      [section]: { ...(prev as any)[section], [field]: value },
    }));
    setDirty(true);
  };

  // ─── Loading ──

  if (loading) return <PageLoader />;
  if (!store) return null;

  const previewUrl = `/stores/${store.slug}/`;

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Sidebar tabs */}
      <div className="w-14 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col items-center py-3 gap-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
              activeTab === tab.id
                ? "bg-primary text-white"
                : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
            )}
            title={tab.label}
          >
            <tab.icon size={18} />
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 flex">
        {/* Editor panel (all tabs except preview) */}
        {activeTab !== "preview" && (
          <div className="w-[420px] border-r border-gray-200 dark:border-gray-800 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {TABS.find(t => t.id === activeTab)?.label}
              </h2>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !dirty}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-1" />
                )}
                Save & Rebuild
              </Button>
            </div>

            {/* Store Info tab */}
            {activeTab === "store-info" && (
              <div className="space-y-4">
                {["name", "tagline", "description", "about", "mission", "address", "ctaText", "ctaUrl"].map(field => (
                  <div key={field}>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block capitalize">
                      {field.replace(/([A-Z])/g, " $1")}
                    </label>
                    {field === "description" || field === "about" || field === "mission" ? (
                      <textarea
                        value={siteData.storeInfo?.[field] || ""}
                        onChange={(e) => updateField("storeInfo", field, e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm resize-none"
                      />
                    ) : (
                      <input
                        type="text"
                        value={siteData.storeInfo?.[field] || ""}
                        onChange={(e) => updateField("storeInfo", field, e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Hero tab */}
            {activeTab === "hero" && (
              <div className="space-y-4">
                {["headline", "subheadline", "ctaText", "ctaUrl"].map(field => (
                  <div key={field}>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block capitalize">
                      {field.replace(/([A-Z])/g, " $1")}
                    </label>
                    <input
                      type="text"
                      value={siteData.heroConfig?.[field] || ""}
                      onChange={(e) => updateField("heroConfig", field, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Products tab */}
            {activeTab === "products" && (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 mb-4">
                  {siteData.products?.length || 0} products in your store
                </p>
                {siteData.products?.map((product, i) => (
                  <Card key={i}>
                    <CardContent className="p-3 space-y-2">
                      <input
                        type="text"
                        value={product.name || ""}
                        onChange={(e) => {
                          const updated = [...(siteData.products || [])];
                          updated[i] = { ...updated[i], name: e.target.value };
                          setSiteData(prev => ({ ...prev, products: updated }));
                          setDirty(true);
                        }}
                        className="w-full px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium"
                        placeholder="Product name"
                      />
                      <textarea
                        value={product.shortDescription || product.description || ""}
                        onChange={(e) => {
                          const updated = [...(siteData.products || [])];
                          updated[i] = { ...updated[i], shortDescription: e.target.value };
                          setSiteData(prev => ({ ...prev, products: updated }));
                          setDirty(true);
                        }}
                        rows={2}
                        className="w-full px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs resize-none"
                        placeholder="Description"
                      />
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>
                          ${product.priceCents ? (parseInt(product.priceCents) / 100).toFixed(2) : "0.00"}
                        </span>
                        {product.categoryId && <span>| {product.categoryId}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Navigation tab */}
            {activeTab === "navigation" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Header Navigation
                  </h3>
                  {siteData.navLinks?.map((link, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={link.label}
                        onChange={(e) => {
                          const updated = [...(siteData.navLinks || [])];
                          updated[i] = { ...updated[i], label: e.target.value };
                          setSiteData(prev => ({ ...prev, navLinks: updated }));
                          setDirty(true);
                        }}
                        className="flex-1 px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                        placeholder="Label"
                      />
                      <input
                        type="text"
                        value={link.href}
                        onChange={(e) => {
                          const updated = [...(siteData.navLinks || [])];
                          updated[i] = { ...updated[i], href: e.target.value };
                          setSiteData(prev => ({ ...prev, navLinks: updated }));
                          setDirty(true);
                        }}
                        className="flex-1 px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                        placeholder="URL"
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Footer Links
                  </h3>
                  {siteData.footerLinks?.map((link, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={link.label}
                        onChange={(e) => {
                          const updated = [...(siteData.footerLinks || [])];
                          updated[i] = { ...updated[i], label: e.target.value };
                          setSiteData(prev => ({ ...prev, footerLinks: updated }));
                          setDirty(true);
                        }}
                        className="flex-1 px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                        placeholder="Label"
                      />
                      <input
                        type="text"
                        value={link.href}
                        onChange={(e) => {
                          const updated = [...(siteData.footerLinks || [])];
                          updated[i] = { ...updated[i], href: e.target.value };
                          setSiteData(prev => ({ ...prev, footerLinks: updated }));
                          setDirty(true);
                        }}
                        className="flex-1 px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                        placeholder="URL"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FAQ tab */}
            {activeTab === "faq" && (
              <div className="space-y-3">
                {siteData.faq?.map((item, i) => (
                  <Card key={i}>
                    <CardContent className="p-3 space-y-2">
                      <input
                        type="text"
                        value={item.question || ""}
                        onChange={(e) => {
                          const updated = [...(siteData.faq || [])];
                          updated[i] = { ...updated[i], question: e.target.value };
                          setSiteData(prev => ({ ...prev, faq: updated }));
                          setDirty(true);
                        }}
                        className="w-full px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium"
                        placeholder="Question"
                      />
                      <textarea
                        value={item.answer || ""}
                        onChange={(e) => {
                          const updated = [...(siteData.faq || [])];
                          updated[i] = { ...updated[i], answer: e.target.value };
                          setSiteData(prev => ({ ...prev, faq: updated }));
                          setDirty(true);
                        }}
                        rows={2}
                        className="w-full px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs resize-none"
                        placeholder="Answer"
                      />
                    </CardContent>
                  </Card>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSiteData(prev => ({
                      ...prev,
                      faq: [...(prev.faq || []), { question: "", answer: "" }],
                    }));
                    setDirty(true);
                  }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add FAQ
                </Button>
              </div>
            )}

            {/* Policies tab */}
            {activeTab === "policies" && (
              <div className="text-sm text-gray-500">
                <p className="mb-4">
                  Policy pages (Shipping, Returns, Privacy, Terms) are generated by AI and can be
                  edited by rebuilding the store. To update policies, modify the content in your
                  store&apos;s data files.
                </p>
                <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Rebuild Store
                </Button>
              </div>
            )}

            {/* Build tab */}
            {activeTab === "build" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Status:</span>
                  <span className={cn(
                    "text-xs font-medium px-2 py-1 rounded-full",
                    store.buildStatus === "built" ? "bg-green-100 text-green-700" :
                    store.buildStatus === "building" ? "bg-blue-100 text-blue-700" :
                    store.buildStatus === "error" ? "bg-red-100 text-red-700" :
                    "bg-gray-100 text-gray-700"
                  )}>
                    {store.buildStatus}
                  </span>
                </div>

                {store.lastBuildError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <pre className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap overflow-x-auto">
                        {store.lastBuildError}
                      </pre>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave} disabled={rebuilding}>
                    {rebuilding ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-1" />
                    )}
                    Rebuild
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-1" />
                      Open Store
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Preview iframe */}
        <div className="flex-1 bg-gray-100 dark:bg-gray-950 flex flex-col">
          {/* Preview toolbar */}
          <div className="h-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 gap-3">
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
              {[
                { id: "desktop" as const, icon: Monitor },
                { id: "tablet" as const, icon: Tablet },
                { id: "mobile" as const, icon: Smartphone },
              ].map(device => (
                <button
                  key={device.id}
                  onClick={() => setPreviewDevice(device.id)}
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    previewDevice === device.id ? "bg-white dark:bg-gray-700 shadow-sm" : "text-gray-400"
                  )}
                >
                  <device.icon size={14} />
                </button>
              ))}
            </div>

            <span className="text-xs text-gray-400 truncate flex-1">
              {previewUrl}
            </span>

            {rebuilding && (
              <span className="text-xs text-blue-500 flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" />
                Rebuilding...
              </span>
            )}

            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ExternalLink size={14} />
            </a>
          </div>

          {/* Iframe */}
          <div className="flex-1 flex items-start justify-center p-4 overflow-auto">
            <iframe
              key={store.buildStatus} // Force refresh on rebuild
              src={previewUrl}
              className={cn(
                "bg-white rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 transition-all",
                previewDevice === "desktop" ? "w-full h-full" :
                previewDevice === "tablet" ? "w-[768px] h-[1024px]" :
                "w-[375px] h-[812px]"
              )}
              title={`${store.name} preview`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
