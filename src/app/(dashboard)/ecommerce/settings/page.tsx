"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Settings,
  Save,
  CreditCard,
  Palette,
  ReceiptText,
  Truck,
  Globe,
  Crown,
  ArrowUpRight,
  AlertCircle,
  Check,
  Loader2,
  X,
  Link2,
  Shield,
  Trash2,
  Star,
  Search,
  Sparkles,
  ImageIcon,
} from "lucide-react";
import {
  PRODUCT_CATEGORIES,
  PAYMENT_METHODS_BY_REGION,
  ECOM_SUBSCRIPTION_PRICE_CENTS,
} from "@/lib/constants/ecommerce";
import {
  ECOM_PLAN_NAMES,
  ECOM_PLAN_FEATURES,
  ECOM_BASIC_PRICE_CENTS,
  ECOM_PRO_PRICE_CENTS,
  type EcomPlan,
} from "@/lib/domains/pricing";
import { STORE_TEMPLATES_FULL, type StoreTemplateConfig } from "@/lib/constants/store-templates";
import { cn } from "@/lib/utils/cn";

type TabId = "general" | "payments" | "shipping" | "branding" | "domain" | "subscription";

interface Store {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  industry: string | null;
  currency: string;
  region: string | null;
  theme: Record<string, unknown>;
  settings: Record<string, unknown>;
  isActive: boolean;
  ecomSubscriptionStatus: string;
  ecomPlan: string;
  freeDomainClaimed: boolean;
  customDomain: string | null;
  freeTrialStartedAt: string | null;
  freeTrialEndsAt: string | null;
}

interface PaymentMethod {
  id: string;
  methodType: string;
  provider: string | null;
  isActive: boolean;
}

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "shipping", label: "Shipping", icon: Truck },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "domain", label: "Domain", icon: Globe },
  { id: "subscription", label: "Subscription", icon: ReceiptText },
];

const BASE_FONT_OPTIONS = [
  "Inter",
  "Poppins",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Playfair Display",
  "Merriweather",
  "Nunito",
  "DM Sans",
  "Lora",
  "Oswald",
  "Source Sans 3",
  "Space Grotesk",
];

// Deduplicate and sort font options (includes all template fonts)
const FONT_OPTIONS = Array.from(new Set([
  ...BASE_FONT_OPTIONS,
  ...STORE_TEMPLATES_FULL.flatMap((t) => [t.fonts.heading, t.fonts.body]),
])).sort();

export default function EcommerceSettingsPage() {
  const [store, setStore] = useState<Store | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  // Domain tab state
  const [domains, setDomains] = useState<Array<{
    id: string; domainName: string; tld: string; isPrimary: boolean;
    registrarStatus: string; sslStatus: string; isFree: boolean;
    isConnected: boolean; expiresAt: string | null;
  }>>([]);
  const [domainsLoading, setDomainsLoading] = useState(false);
  const [domainSearch, setDomainSearch] = useState("");
  const [domainResults, setDomainResults] = useState<Array<{
    domain: string; tld: string; available: boolean; retailCents: number; isFreeEligible: boolean;
  }>>([]);
  const [searchingDomains, setSearchingDomains] = useState(false);
  const [byodDomain, setByodDomain] = useState("");
  const [connectingDomain, setConnectingDomain] = useState(false);
  const [dnsInstructions, setDnsInstructions] = useState<{ nameservers: string[] } | null>(null);

  // Upgrade state
  const [upgrading, setUpgrading] = useState(false);

  // General tab fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [industry, setIndustry] = useState("");
  const [showBrandName, setShowBrandName] = useState(true);

  // Brand sync state
  const [brandSyncing, setBrandSyncing] = useState(false);
  const [brandLogos, setBrandLogos] = useState<{ full: string | null; icon: string | null }>({ full: null, icon: null });

  // Shipping tab fields
  const [flatRateCents, setFlatRateCents] = useState(0);
  const [freeShippingThresholdCents, setFreeShippingThresholdCents] = useState(0);
  const [localPickup, setLocalPickup] = useState(false);

  // Branding tab fields
  const [selectedTemplate, setSelectedTemplate] = useState("minimal");
  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [secondaryColor, setSecondaryColor] = useState("#8b5cf6");
  const [accentColor, setAccentColor] = useState("#f59e0b");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [textColor, setTextColor] = useState("#111827");
  const [headingFont, setHeadingFont] = useState("Inter");
  const [bodyFont, setBodyFont] = useState("Inter");

  const loadStore = useCallback(async () => {
    try {
      const res = await fetch("/api/ecommerce/store");
      const data = await res.json();
      if (data.success && data.data?.store) {
        const s = data.data.store;
        setStore(s);
        setName(s.name || "");
        setDescription(s.description || "");
        setLogoUrl(s.logoUrl || "");
        setBannerUrl(s.bannerUrl || "");
        setIndustry(s.industry || "");
        // Parse shipping settings
        const settings = (s.settings || {}) as Record<string, unknown>;
        const shipping = (settings.shipping || {}) as Record<string, unknown>;
        setFlatRateCents(typeof shipping.flatRateCents === "number" ? shipping.flatRateCents : 0);
        setFreeShippingThresholdCents(typeof shipping.freeShippingThresholdCents === "number" ? shipping.freeShippingThresholdCents : 0);
        setLocalPickup(!!shipping.localPickup);
        // Parse showBrandName from storeContent
        const storeContentSettings = (settings.storeContent || {}) as Record<string, unknown>;
        setShowBrandName(storeContentSettings.showBrandName !== false);
        // Parse theme
        const theme = s.theme || {};
        setSelectedTemplate((theme.template as string) || "minimal");
        const colors = (theme.colors || {}) as Record<string, string>;
        setPrimaryColor(colors.primary || "#6366f1");
        setSecondaryColor(colors.secondary || "#8b5cf6");
        setAccentColor(colors.accent || "#f59e0b");
        setBackgroundColor(colors.background || "#ffffff");
        setTextColor(colors.text || "#111827");
        const fonts = (theme.fonts || {}) as Record<string, string>;
        setHeadingFont(fonts.heading || "Inter");
        setBodyFont(fonts.body || "Inter");
      } else {
        setError("No store found.");
      }
    } catch {
      setError("Failed to load store.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDomains = useCallback(async () => {
    setDomainsLoading(true);
    try {
      const res = await fetch("/api/domains");
      const data = await res.json();
      if (data.success) setDomains(data.data?.domains || []);
    } catch { /* silent */ }
    finally { setDomainsLoading(false); }
  }, []);

  async function handleSearchDomains() {
    if (!domainSearch.trim()) return;
    setSearchingDomains(true);
    setDomainResults([]);
    try {
      const res = await fetch("/api/domains/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: domainSearch.trim() }),
      });
      const data = await res.json();
      if (data.success) setDomainResults(data.data?.results || []);
    } catch { /* silent */ }
    finally { setSearchingDomains(false); }
  }

  async function handlePurchaseDomain(domain: string, tld: string, isFree: boolean) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/domains/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, tld, isFree }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(`Domain ${domain}.${tld} ${isFree ? "claimed" : "purchased"} successfully!`);
        setDomainResults([]);
        setDomainSearch("");
        loadDomains();
        loadStore();
      } else {
        setError(data.error?.message || "Failed to register domain");
      }
    } catch {
      setError("Failed to process domain");
    } finally { setSaving(false); }
  }

  async function handleConnectDomain() {
    if (!byodDomain.trim()) return;
    setConnectingDomain(true);
    setError(null);
    try {
      const res = await fetch("/api/domains/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: byodDomain.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setDnsInstructions({ nameservers: data.data?.nameservers || [] });
        setSuccessMessage("Domain connected! Update your nameservers to complete setup.");
        loadDomains();
      } else {
        setError(data.error?.message || "Failed to connect domain");
      }
    } catch {
      setError("Failed to connect domain");
    } finally { setConnectingDomain(false); }
  }

  async function handleSetPrimary(domainId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/domains/${domainId}/set-primary`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage("Primary domain updated!");
        loadDomains();
        loadStore();
      }
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  async function handleDisconnectDomain(domainId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/domains/${domainId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage("Domain disconnected.");
        loadDomains();
        loadStore();
      }
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  async function handleUpgrade(newPlan: EcomPlan) {
    setUpgrading(true);
    setError(null);
    try {
      const res = await fetch("/api/ecommerce/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: newPlan }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(`Plan ${newPlan === "pro" ? "upgraded" : "downgraded"} to ${ECOM_PLAN_NAMES[newPlan]}!`);
        loadStore();
      } else {
        setError(data.error?.message || "Failed to change plan");
      }
    } catch {
      setError("Failed to change plan");
    } finally { setUpgrading(false); }
  }

  const loadPaymentMethods = useCallback(async () => {
    try {
      const res = await fetch("/api/ecommerce/store");
      const data = await res.json();
      if (data.success && data.data?.store) {
        // Payment methods are fetched separately, but since we don't have a dedicated endpoint,
        // we'll handle it via the settings endpoint or show region-available methods
        // For now just set from store data
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadStore();
    loadPaymentMethods();
    loadDomains();
  }, [loadStore, loadPaymentMethods, loadDomains]);

  // Auto-dismiss success message
  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [successMessage]);

  async function handleSaveGeneral() {
    if (!store) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ecommerce/store/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          logoUrl: logoUrl || null,
          bannerUrl: bannerUrl || null,
          industry: industry || null,
          settings: {
            ...store.settings,
            storeContent: {
              ...((store.settings as Record<string, unknown>).storeContent as Record<string, unknown> || {}),
              showBrandName,
            },
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStore(data.data.store);
        setSuccessMessage("General settings saved.");
      } else {
        setError(data.error?.message || "Failed to save.");
      }
    } catch {
      setError("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveBranding() {
    if (!store) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ecommerce/store/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: {
            template: selectedTemplate,
            colors: {
              primary: primaryColor,
              secondary: secondaryColor,
              accent: accentColor,
              background: backgroundColor,
              text: textColor,
            },
            fonts: {
              heading: headingFont,
              body: bodyFont,
            },
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStore(data.data.store);
        setSuccessMessage("Branding settings saved.");
      } else {
        setError(data.error?.message || "Failed to save.");
      }
    } catch {
      setError("Failed to save branding settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveShipping() {
    if (!store) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ecommerce/store/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            ...store.settings,
            shipping: {
              flatRateCents,
              freeShippingThresholdCents,
              localPickup,
            },
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStore(data.data.store);
        setSuccessMessage("Shipping settings saved.");
      } else {
        setError(data.error?.message || "Failed to save.");
      }
    } catch {
      setError("Failed to save shipping settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePaymentMethod(methodType: string, provider: string | null, currentActive: boolean) {
    if (!store) return;
    try {
      const res = await fetch("/api/ecommerce/store/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            ...store.settings,
            paymentMethods: {
              ...((store.settings as Record<string, unknown>).paymentMethods as Record<string, boolean> || {}),
              [`${methodType}_${provider || "none"}`]: !currentActive,
            },
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStore(data.data.store);
        setSuccessMessage("Payment settings updated.");
      }
    } catch {
      setError("Failed to update payment method.");
    }
  }

  async function handleCancelSubscription() {
    setSaving(true);
    try {
      const res = await fetch("/api/ecommerce/store/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            ...store?.settings,
            cancelRequested: true,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage("Cancellation request submitted. Your store will remain active until the end of the billing period.");
        setCancelConfirm(false);
      }
    } catch {
      setError("Failed to process cancellation.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Loading store settings...</div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">{error || "Store not found."}</p>
      </div>
    );
  }

  const regionPaymentMethods = store.region
    ? PAYMENT_METHODS_BY_REGION[store.region] || []
    : PAYMENT_METHODS_BY_REGION["north_america"] || [];

  const pmSettings = ((store.settings as Record<string, unknown>).paymentMethods || {}) as Record<string, boolean>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Store Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your store preferences, branding, and payment options.
        </p>
      </div>

      {/* Success / Error Messages */}
      {successMessage && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300 text-sm">
          <Check className="h-4 w-4" />
          {successMessage}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300 text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="rounded-xl border bg-card p-6">
        {/* GENERAL TAB */}
        {activeTab === "general" && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5">Store Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="My Store"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                placeholder="Tell customers about your store..."
              />
            </div>
            {/* Logo Section */}
            <div className="space-y-3">
              <label className="block text-sm font-medium">Store Logo</label>

              {/* Current logo preview */}
              {logoUrl && (
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <Image src={logoUrl} alt="Current logo" width={48} height={48} className="h-12 w-12 rounded-lg object-contain border" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{logoUrl}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLogoUrl("")}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Sync from Brand Kit */}
              <button
                type="button"
                onClick={async () => {
                  setBrandSyncing(true);
                  try {
                    const res = await fetch("/api/ecommerce/store/brand-sync", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ logoChoice: "full" }),
                    });
                    const json = await res.json();
                    if (json.success) {
                      const bk = json.data.brandKit;
                      setBrandLogos({ full: bk.logo || null, icon: bk.iconLogo || null });
                      if (bk.logo) setLogoUrl(json.data.store.logoUrl || bk.logo);
                    }
                  } catch {}
                  setBrandSyncing(false);
                }}
                disabled={brandSyncing}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50"
              >
                {brandSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Sync Logo from Brand Kit
              </button>

              {/* Logo choice picker — shown after brand sync if both logos exist */}
              {(brandLogos.full || brandLogos.icon) && (
                <div className="flex gap-3">
                  {brandLogos.full && (
                    <button
                      type="button"
                      onClick={async () => {
                        setBrandSyncing(true);
                        try {
                          const res = await fetch("/api/ecommerce/store/brand-sync", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ logoChoice: "full" }),
                          });
                          const json = await res.json();
                          if (json.success) setLogoUrl(json.data.store.logoUrl || "");
                        } catch {}
                        setBrandSyncing(false);
                      }}
                      className={cn(
                        "relative flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-all",
                        logoUrl === brandLogos.full || (!brandLogos.icon && logoUrl)
                          ? "border-brand-500 ring-1 ring-brand-500/20"
                          : "border-border hover:border-brand-500/30"
                      )}
                    >
                      <Image src={brandLogos.full} alt="Full logo" width={100} height={40} className="h-10 w-auto object-contain" />
                      <span className="text-[10px] font-medium">Full Logo</span>
                    </button>
                  )}
                  {brandLogos.icon && (
                    <button
                      type="button"
                      onClick={async () => {
                        setBrandSyncing(true);
                        try {
                          const res = await fetch("/api/ecommerce/store/brand-sync", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ logoChoice: "icon" }),
                          });
                          const json = await res.json();
                          if (json.success) setLogoUrl(json.data.store.logoUrl || "");
                        } catch {}
                        setBrandSyncing(false);
                      }}
                      className={cn(
                        "relative flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-all",
                        logoUrl === brandLogos.icon
                          ? "border-brand-500 ring-1 ring-brand-500/20"
                          : "border-border hover:border-brand-500/30"
                      )}
                    >
                      <Image src={brandLogos.icon} alt="Icon logo" width={40} height={40} className="h-10 w-10 object-contain" />
                      <span className="text-[10px] font-medium">Icon Logo</span>
                    </button>
                  )}
                </div>
              )}

              {/* Manual URL fallback */}
              {!logoUrl && (
                <input
                  type="text"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Or paste a logo URL..."
                />
              )}
            </div>

            {/* Show Brand Name Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="text-sm font-medium">Show Brand Name</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Display your store name next to the logo. Turn off if your logo already includes the name.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBrandName(!showBrandName)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  showBrandName ? "bg-brand-500" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                    showBrandName ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Banner URL</label>
              <input
                type="text"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="https://example.com/banner.png"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Industry</label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Select an industry</option>
                {PRODUCT_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="pt-2">
              <button
                onClick={handleSaveGeneral}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* PAYMENTS TAB */}
        {activeTab === "payments" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Payment methods available for your region{store.region ? ` (${store.region.replace(/_/g, " ")})` : ""}. Toggle methods on or off.
            </p>
            <div className="space-y-3">
              {regionPaymentMethods.map((pm) => {
                const key = `${pm.methodType}_${pm.provider || "none"}`;
                const isActive = pmSettings[key] !== false; // Default active
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{pm.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {pm.provider ? pm.provider.replace(/_/g, " ") : "Manual"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleTogglePaymentMethod(pm.methodType, pm.provider, isActive)}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        isActive ? "bg-brand-500" : "bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                          isActive ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SHIPPING TAB */}
        {activeTab === "shipping" && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Configure shipping rates for your store. These apply to all orders.
            </p>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Flat Rate Shipping ({store.currency})
              </label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={(flatRateCents / 100).toFixed(2)}
                onChange={(e) => setFlatRateCents(Math.round(parseFloat(e.target.value || "0") * 100))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Flat shipping rate charged per order. Set to 0 for free shipping.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Free Shipping Threshold ({store.currency})
              </label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={(freeShippingThresholdCents / 100).toFixed(2)}
                onChange={(e) => setFreeShippingThresholdCents(Math.round(parseFloat(e.target.value || "0") * 100))}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Orders above this amount get free shipping. Set to 0 to disable.
              </p>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="text-sm font-medium">Local Pickup</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Allow customers to pick up orders at your location
                </p>
              </div>
              <button
                onClick={() => setLocalPickup(!localPickup)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  localPickup ? "bg-brand-500" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                    localPickup ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>
            <div className="pt-2">
              <button
                onClick={handleSaveShipping}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Shipping
              </button>
            </div>
          </div>
        )}

        {/* BRANDING TAB */}
        {activeTab === "branding" && (
          <div className="space-y-6">
            {/* Template Selection */}
            <div>
              <label className="block text-sm font-medium mb-3">Store Template</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {STORE_TEMPLATES_FULL.map((template) => {
                  const isSelected = selectedTemplate === template.id;
                  return (
                    <button
                      key={template.id}
                      onClick={() => {
                        setSelectedTemplate(template.id);
                        // Auto-fill colors and fonts from template defaults
                        setPrimaryColor(template.colors.primary);
                        setSecondaryColor(template.colors.secondary);
                        setAccentColor(template.colors.accent);
                        setBackgroundColor(template.colors.background);
                        setTextColor(template.colors.text);
                        setHeadingFont(template.fonts.heading);
                        setBodyFont(template.fonts.body);
                      }}
                      className={cn(
                        "text-left p-4 rounded-lg border-2 transition-all",
                        isSelected
                          ? "border-brand-500 bg-brand-500/5 ring-1 ring-brand-500/20"
                          : "border-border hover:border-brand-500/30"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-sm">{template.name}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                          {template.category}
                        </span>
                      </div>
                      {/* Color preview circles */}
                      <div className="flex items-center gap-1.5 mb-2">
                        {[
                          template.colors.primary,
                          template.colors.secondary,
                          template.colors.accent,
                          template.colors.background,
                          template.colors.text,
                        ].map((color, idx) => (
                          <div
                            key={idx}
                            className="h-4 w-4 rounded-full border border-gray-200 dark:border-gray-700"
                            style={{ backgroundColor: color }}
                            title={["Primary", "Secondary", "Accent", "Background", "Text"][idx]}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Colors */}
            <div>
              <label className="block text-sm font-medium mb-3">Colors</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {([
                  { label: "Primary", value: primaryColor, setter: setPrimaryColor },
                  { label: "Secondary", value: secondaryColor, setter: setSecondaryColor },
                  { label: "Accent", value: accentColor, setter: setAccentColor },
                  { label: "Background", value: backgroundColor, setter: setBackgroundColor },
                  { label: "Text", value: textColor, setter: setTextColor },
                ] as const).map(({ label, value, setter }) => (
                  <div key={label}>
                    <label className="block text-xs text-muted-foreground mb-1">{label}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={value}
                        onChange={(e) => setter(e.target.value)}
                        className="h-9 w-9 rounded border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => setter(e.target.value)}
                        className="flex-1 min-w-0 rounded-lg border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fonts */}
            <div>
              <label className="block text-sm font-medium mb-3">Fonts</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Heading Font</label>
                  <select
                    value={headingFont}
                    onChange={(e) => setHeadingFont(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Body Font</label>
                  <select
                    value={bodyFont}
                    onChange={(e) => setBodyFont(e.target.value)}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleSaveBranding}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Branding
              </button>
            </div>
          </div>
        )}

        {/* DOMAIN TAB */}
        {activeTab === "domain" && (
          <div className="space-y-6">
            {/* Current Domain Status */}
            <div className="p-4 rounded-lg border space-y-2">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-violet-500" />
                <span className="text-sm font-medium">Subdomain:</span>
                <span className="text-sm text-muted-foreground">
                  {store.slug}.flowsmartly.com
                </span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400">
                  Active
                </span>
              </div>
              {store.customDomain && (
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-indigo-500" />
                  <span className="text-sm font-medium">Primary:</span>
                  <span className="text-sm text-muted-foreground">
                    {store.customDomain}
                  </span>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400">
                    Active
                  </span>
                </div>
              )}
            </div>

            {/* Search & Register Domain */}
            <div className="p-4 rounded-lg border space-y-4">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  {store.ecomPlan === "pro" && !store.freeDomainClaimed ? (
                    <>
                      <Star className="h-4 w-4 text-amber-500" />
                      Claim Your FREE Domain
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 text-violet-500" />
                      Buy a Domain
                    </>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {store.ecomPlan === "pro" && !store.freeDomainClaimed
                    ? "You have 1 free domain included with your Pro plan (.com, .store, .shop, .online, .co)"
                    : "Search and register a domain starting at $9.99/year"}
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={domainSearch}
                  onChange={(e) => setDomainSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchDomains()}
                  placeholder="Enter a domain name (e.g. mybrand)"
                  className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button
                  onClick={handleSearchDomains}
                  disabled={searchingDomains || !domainSearch.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
                >
                  {searchingDomains ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Search
                </button>
              </div>

              {/* Search Results */}
              {domainResults.length > 0 && (
                <div className="space-y-2">
                  {domainResults.map((r) => {
                    const isPro = store.ecomPlan === "pro";
                    const canClaimFree = isPro && !store.freeDomainClaimed && r.isFreeEligible && r.available;
                    return (
                      <div
                        key={`${r.domain}.${r.tld}`}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border",
                          r.available ? "border-border" : "border-border opacity-50"
                        )}
                      >
                        <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium">{r.domain}.{r.tld}</span>
                        {r.available ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400">
                            Available
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400">
                            Taken
                          </span>
                        )}
                        <span className="ml-auto text-sm font-semibold">
                          {canClaimFree ? (
                            <span className="text-emerald-600">FREE</span>
                          ) : (
                            `$${(r.retailCents / 100).toFixed(2)}/yr`
                          )}
                        </span>
                        {r.available && (
                          <button
                            onClick={() => handlePurchaseDomain(r.domain, r.tld, canClaimFree)}
                            disabled={saving}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 disabled:opacity-50"
                          >
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                            {canClaimFree ? "Claim Free" : "Purchase"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Upgrade nudge for Basic users */}
              {store.ecomPlan === "basic" && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 border border-violet-200 dark:border-violet-800">
                  <Crown className="h-5 w-5 text-violet-500 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-violet-800 dark:text-violet-300">
                      Get a FREE domain with FlowShop Pro
                    </p>
                    <p className="text-xs text-violet-600 dark:text-violet-400">
                      Upgrade to Pro ($12/mo) and get 1 free domain included
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("subscription")}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700"
                  >
                    Upgrade <ArrowUpRight className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Connect Own Domain (BYOD) */}
            <div className="p-4 rounded-lg border space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Link2 className="h-4 w-4 text-blue-500" />
                Connect My Own Domain
              </h3>
              <p className="text-xs text-muted-foreground">
                Already have a domain? Connect it here and update your DNS settings.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={byodDomain}
                  onChange={(e) => setByodDomain(e.target.value)}
                  placeholder="e.g. mybrandstore.com"
                  className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleConnectDomain}
                  disabled={connectingDomain || !byodDomain.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {connectingDomain ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  Connect
                </button>
              </div>
              {dnsInstructions && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-sm space-y-2">
                  <p className="font-medium text-blue-800 dark:text-blue-300">
                    Update your domain nameservers to:
                  </p>
                  {dnsInstructions.nameservers.map((ns) => (
                    <code key={ns} className="block text-xs bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded">
                      {ns}
                    </code>
                  ))}
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    DNS changes can take up to 24-48 hours to propagate.
                  </p>
                </div>
              )}
            </div>

            {/* Existing Domains */}
            {domains.length > 0 && (
              <div className="p-4 rounded-lg border space-y-3">
                <h3 className="text-sm font-semibold">Your Domains</h3>
                <div className="space-y-2">
                  {domains.map((d) => (
                    <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border">
                      <Globe className="h-4 w-4 text-violet-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{d.domainName}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {d.isPrimary && (
                            <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400 font-medium">
                              Primary
                            </span>
                          )}
                          {d.isFree && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                              Free with Pro
                            </span>
                          )}
                          <span className={cn(
                            "px-1.5 py-0.5 rounded",
                            d.sslStatus === "active"
                              ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400"
                          )}>
                            SSL: {d.sslStatus}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!d.isPrimary && (
                          <button
                            onClick={() => handleSetPrimary(d.id)}
                            disabled={saving}
                            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-violet-600 transition-colors"
                            title="Set as primary"
                          >
                            <Star className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDisconnectDomain(d.id)}
                          disabled={saving}
                          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-red-600 transition-colors"
                          title="Disconnect"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SUBSCRIPTION TAB */}
        {activeTab === "subscription" && (
          <div className="space-y-6">
            {/* Current Plan */}
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{ECOM_PLAN_NAMES[(store.ecomPlan || "basic") as EcomPlan] || "FlowShop Basic"}</p>
                  {store.ecomPlan === "pro" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-xs font-semibold">
                      <Crown className="h-3 w-3" /> PRO
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  ${((store.ecomPlan === "pro" ? ECOM_PRO_PRICE_CENTS : ECOM_BASIC_PRICE_CENTS) / 100).toFixed(2)}/month
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    ["active", "trialing", "free_trial"].includes(store.ecomSubscriptionStatus) ? "bg-green-500" : "bg-red-500"
                  )}
                />
                <span className="text-sm font-medium capitalize">
                  {store.ecomSubscriptionStatus === "free_trial" ? "Free Trial" : store.ecomSubscriptionStatus}
                </span>
              </div>
            </div>

            {/* Free Trial Banner */}
            {store.ecomSubscriptionStatus === "free_trial" && store.freeTrialEndsAt && (
              <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-amber-600" />
                  <h3 className="font-medium text-amber-800 dark:text-amber-300">
                    Free Trial &mdash; {Math.max(0, Math.ceil((new Date(store.freeTrialEndsAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))} days remaining
                  </h3>
                </div>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Your trial ends on {new Date(store.freeTrialEndsAt).toLocaleDateString()}.
                  Add a payment method to keep your store active after the trial.
                </p>
                <button
                  onClick={() => {
                    // Redirect to the payment methods page with convert context
                    window.location.href = "/billing";
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700"
                >
                  <CreditCard className="h-4 w-4" />
                  Add Payment Method
                </button>
              </div>
            )}

            {/* Expired Trial Banner */}
            {store.ecomSubscriptionStatus === "expired" && (
              <div className="p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-red-600" />
                  <h3 className="font-medium text-red-800 dark:text-red-300">
                    Trial Expired &mdash; Store Inactive
                  </h3>
                </div>
                <p className="text-sm text-red-700 dark:text-red-400">
                  Your free trial has ended. Add a payment method to reactivate your store. No data has been lost.
                </p>
                <button
                  onClick={() => {
                    window.location.href = "/billing";
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
                >
                  <CreditCard className="h-4 w-4" />
                  Add Payment Method & Reactivate
                </button>
              </div>
            )}

            {/* Plan Features */}
            <div className="p-4 rounded-lg bg-muted/50">
              <h3 className="text-sm font-medium mb-2">Your plan includes:</h3>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {ECOM_PLAN_FEATURES[(store.ecomPlan || "basic") as EcomPlan]?.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* Upgrade/Downgrade */}
            {store.ecomPlan === "basic" ? (
              <div className="p-4 rounded-lg bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 border border-violet-200 dark:border-violet-800 space-y-3">
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-violet-500" />
                  <h3 className="text-sm font-semibold text-violet-800 dark:text-violet-300">
                    Upgrade to FlowShop Pro — $12/month
                  </h3>
                </div>
                <p className="text-sm text-violet-600 dark:text-violet-400">
                  Get 1 FREE domain, priority AI processing, advanced analytics, AI chatbot, and abandoned cart recovery.
                </p>
                <button
                  onClick={() => handleUpgrade("pro")}
                  disabled={upgrading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-sm font-medium hover:from-violet-600 hover:to-indigo-700 disabled:opacity-50"
                >
                  {upgrading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                  Upgrade to Pro
                </button>
              </div>
            ) : (
              <div>
                <button
                  onClick={() => {
                    if (store.freeDomainClaimed) {
                      if (!confirm("Warning: Your free domain will convert to paid renewal ($14.99/year). Continue?")) return;
                    }
                    handleUpgrade("basic");
                  }}
                  disabled={upgrading}
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                >
                  {upgrading ? "Changing plan..." : "Downgrade to Basic ($5/month)"}
                </button>
              </div>
            )}

            {/* Cancel */}
            {["active", "trialing", "free_trial"].includes(store.ecomSubscriptionStatus) && (
              <div className="pt-2 border-t">
                {!cancelConfirm ? (
                  <button
                    onClick={() => setCancelConfirm(true)}
                    className="text-sm text-red-600 hover:text-red-700 hover:underline"
                  >
                    Cancel Subscription
                  </button>
                ) : (
                  <div className="p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
                    <p className="text-sm font-medium text-red-700 dark:text-red-300">
                      Are you sure you want to cancel your subscription?
                    </p>
                    <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">
                      Your store will remain active until the end of the current billing period.
                      {store.freeDomainClaimed && " Your free domain will convert to paid renewal."}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleCancelSubscription}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        Yes, Cancel
                      </button>
                      <button
                        onClick={() => setCancelConfirm(false)}
                        className="px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-accent"
                      >
                        Keep Subscription
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
