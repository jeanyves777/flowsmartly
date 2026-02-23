"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  Save,
  CreditCard,
  Palette,
  ReceiptText,
  Truck,
  AlertCircle,
  Check,
  Loader2,
  X,
} from "lucide-react";
import {
  PRODUCT_CATEGORIES,
  PAYMENT_METHODS_BY_REGION,
  ECOM_SUBSCRIPTION_PRICE_CENTS,
} from "@/lib/constants/ecommerce";
import { STORE_TEMPLATES_FULL, type StoreTemplateConfig } from "@/lib/constants/store-templates";
import { cn } from "@/lib/utils/cn";

type TabId = "general" | "payments" | "shipping" | "branding" | "subscription";

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

  // General tab fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [industry, setIndustry] = useState("");

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
  }, [loadStore, loadPaymentMethods]);

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
            <div>
              <label className="block text-sm font-medium mb-1.5">Logo URL</label>
              <input
                type="text"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="https://example.com/logo.png"
              />
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

        {/* SUBSCRIPTION TAB */}
        {activeTab === "subscription" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="font-medium">FlowShop Subscription</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  ${(ECOM_SUBSCRIPTION_PRICE_CENTS / 100).toFixed(2)}/month
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    store.ecomSubscriptionStatus === "active" ? "bg-green-500" : "bg-red-500"
                  )}
                />
                <span className="text-sm font-medium capitalize">
                  {store.ecomSubscriptionStatus}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/50">
              <h3 className="text-sm font-medium mb-2">What is included:</h3>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Unlimited products
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Custom storefront with your branding
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Order management
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Multiple payment methods
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Delivery tracking (COD regions)
                </li>
              </ul>
            </div>

            {store.ecomSubscriptionStatus === "active" && (
              <div>
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
