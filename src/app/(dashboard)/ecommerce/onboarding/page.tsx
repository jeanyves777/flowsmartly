"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Globe,
  CreditCard,
  Palette,
  Package,
  Link2,
  Rocket,
  Loader2,
  Check,
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";
import {
  PAYMENT_METHODS_BY_REGION,
  CURRENCIES_BY_REGION,
  type PaymentMethodConfig,
} from "@/lib/constants/ecommerce";
import { getRegionName, getCountryName } from "@/lib/constants/regions";

// ── Types ──

interface StoreData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  industry: string | null;
  currency: string;
  region: string | null;
  country: string | null;
  ecomSubscriptionStatus: string;
  setupComplete: boolean;
  isActive: boolean;
  theme: Record<string, unknown>;
}

interface BrandSyncResult {
  name: string;
  tagline: string | null;
  description: string | null;
  logo: string | null;
  industry: string | null;
  colors: Record<string, string>;
  fonts: Record<string, string>;
}

interface PaymentMethodSelection extends PaymentMethodConfig {
  enabled: boolean;
}

const STEP_CONFIG = [
  { label: "Region", icon: Globe },
  { label: "Payments", icon: CreditCard },
  { label: "Brand", icon: Palette },
  { label: "Products", icon: Package },
  { label: "Domain", icon: Link2 },
  { label: "Launch", icon: Rocket },
];

// ── Main Component ──

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [store, setStore] = useState<StoreData | null>(null);

  // Step 1: Region & Currency
  const [region, setRegion] = useState<string>("");
  const [country, setCountry] = useState<string>("");
  const [currency, setCurrency] = useState<string>("USD");

  // Step 2: Payment Methods
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodSelection[]>([]);

  // Step 3: Brand Sync
  const [brandSyncing, setBrandSyncing] = useState(false);
  const [brandSynced, setBrandSynced] = useState(false);
  const [brandData, setBrandData] = useState<BrandSyncResult | null>(null);
  const [storeName, setStoreName] = useState("");
  const [storeIndustry, setStoreIndustry] = useState("");

  // Step 4: Product Strategy
  const [productStrategy, setProductStrategy] = useState<"own" | "ai">("own");

  // Step 5: Store Domain
  const [slug, setSlug] = useState("");
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const slugTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 6: Launching
  const [launching, setLaunching] = useState(false);

  // ── Init: Fetch store + user profile ──

  useEffect(() => {
    initializeOnboarding();
  }, []);

  async function initializeOnboarding() {
    try {
      // Fetch store
      const storeRes = await fetch("/api/ecommerce/store");
      const storeJson = await storeRes.json();

      if (!storeJson.success || !storeJson.data.hasStore) {
        // No store, redirect back to activation
        router.replace("/ecommerce");
        return;
      }

      const s = storeJson.data.store as StoreData;

      if (s.ecomSubscriptionStatus !== "active") {
        router.replace("/ecommerce");
        return;
      }

      if (s.setupComplete) {
        router.replace("/ecommerce/dashboard");
        return;
      }

      setStore(s);
      setStoreName(s.name || "");
      setStoreIndustry(s.industry || "");

      // Fetch user profile for region/country
      const profileRes = await fetch("/api/users/profile");
      const profileJson = await profileRes.json();

      if (profileJson.success) {
        const user = profileJson.data.user;
        const userRegion = s.region || user.region || "";
        const userCountry = s.country || user.country || "";
        setRegion(userRegion);
        setCountry(userCountry);

        // Set currency from region
        const regionCurrency = CURRENCIES_BY_REGION[userRegion];
        setCurrency(regionCurrency?.code || s.currency || "USD");

        // Initialize payment methods for region
        if (userRegion) {
          initPaymentMethods(userRegion);
        }

        // Set default slug from store
        if (s.slug) {
          setSlug(s.slug);
        }
      }
    } catch (error) {
      console.error("Failed to initialize onboarding:", error);
      toast({
        title: "Error",
        description: "Failed to load onboarding data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function initPaymentMethods(regionId: string) {
    const methods = PAYMENT_METHODS_BY_REGION[regionId] || [];
    setPaymentMethods(
      methods.map((m) => ({ ...m, enabled: true }))
    );
  }

  // ── Step 2: Toggle payment method ──

  function togglePaymentMethod(index: number) {
    setPaymentMethods((prev) =>
      prev.map((m, i) => (i === index ? { ...m, enabled: !m.enabled } : m))
    );
  }

  // ── Step 3: Brand Sync ──

  async function handleBrandSync() {
    setBrandSyncing(true);
    try {
      const res = await fetch("/api/ecommerce/store/brand-sync", {
        method: "POST",
      });
      const json = await res.json();

      if (json.success) {
        const bk = json.data.brandKit as BrandSyncResult;
        setBrandData(bk);
        setBrandSynced(true);
        setStoreName(bk.name || storeName);
        setStoreIndustry(bk.industry || storeIndustry);

        toast({ title: "Brand synced", description: "Your brand kit data has been applied." });
      } else {
        toast({
          title: "Sync failed",
          description: json.error?.message || "Could not sync brand kit.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Brand sync error:", error);
      toast({ title: "Error", description: "Failed to sync brand.", variant: "destructive" });
    } finally {
      setBrandSyncing(false);
    }
  }

  // ── Step 5: Slug validation ──

  const checkSlugAvailability = useCallback(
    (value: string) => {
      if (slugTimeoutRef.current) {
        clearTimeout(slugTimeoutRef.current);
      }

      if (!value || value.length < 2) {
        setSlugAvailable(null);
        return;
      }

      setSlugChecking(true);
      setSlugAvailable(null);

      slugTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await fetch(
            `/api/ecommerce/store?checkSlug=true&slug=${encodeURIComponent(value)}`
          );
          const json = await res.json();
          if (json.success) {
            setSlugAvailable(json.data.available);
          }
        } catch {
          setSlugAvailable(null);
        } finally {
          setSlugChecking(false);
        }
      }, 500);
    },
    []
  );

  function handleSlugChange(value: string) {
    // Sanitize slug
    const sanitized = value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    setSlug(sanitized);
    checkSlugAvailability(sanitized);
  }

  // ── Step 6: Launch ──

  async function handleLaunch() {
    setLaunching(true);
    try {
      // 1. Update store settings (name, slug, currency, theme)
      const themeData = brandData
        ? {
            colors: brandData.colors || {},
            fonts: brandData.fonts || {},
          }
        : {};

      const settingsRes = await fetch("/api/ecommerce/store/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: storeName,
          currency,
          industry: storeIndustry || undefined,
          theme: themeData,
        }),
      });

      const settingsJson = await settingsRes.json();
      if (!settingsJson.success) {
        throw new Error(settingsJson.error?.message || "Failed to save store settings");
      }

      // Update slug separately if changed (slug is on the store, not settings)
      if (slug && slug !== store?.slug) {
        // Check availability one more time
        const slugCheckRes = await fetch(
          `/api/ecommerce/store?checkSlug=true&slug=${encodeURIComponent(slug)}`
        );
        const slugCheckJson = await slugCheckRes.json();
        if (!slugCheckJson.success || !slugCheckJson.data.available) {
          throw new Error("Domain slug is no longer available");
        }
      }

      // 2. Complete onboarding with payment methods
      const activePaymentMethods = paymentMethods
        .filter((pm) => pm.enabled)
        .map((pm) => ({
          methodType: pm.methodType,
          provider: pm.provider,
          isActive: true,
        }));

      const onboardRes = await fetch("/api/ecommerce/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethods: activePaymentMethods,
          currency,
        }),
      });

      const onboardJson = await onboardRes.json();
      if (!onboardJson.success) {
        throw new Error(onboardJson.error?.message || "Failed to complete onboarding");
      }

      toast({
        title: "Store launched!",
        description: "Your FlowShop store is ready. Let's add some products!",
      });

      router.push("/ecommerce/dashboard");
    } catch (error) {
      console.error("Launch error:", error);
      toast({
        title: "Launch failed",
        description:
          error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLaunching(false);
    }
  }

  // ── Navigation ──

  function goNext() {
    if (currentStep < 5) setCurrentStep((s) => s + 1);
  }

  function goBack() {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }

  // ── Loading State ──

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Preparing your store setup...</p>
        </div>
      </div>
    );
  }

  // ── Derived state ──

  const regionName = region ? getRegionName(region) : "Unknown";
  const countryName = country ? getCountryName(country) : "Unknown";
  const currencyConfig = CURRENCIES_BY_REGION[region] || { code: "USD", symbol: "$", name: "US Dollar" };
  const enabledPaymentCount = paymentMethods.filter((pm) => pm.enabled).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ShoppingBag className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Set Up FlowShop</h1>
          <p className="text-sm text-muted-foreground">
            Step {currentStep + 1} of 6
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center gap-1">
          {STEP_CONFIG.map((step, i) => (
            <div key={step.label} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "h-2 w-full rounded-full transition-colors",
                  i <= currentStep
                    ? "bg-primary"
                    : "bg-muted"
                )}
              />
              <div className="flex items-center gap-1">
                <step.icon
                  className={cn(
                    "h-3 w-3",
                    i <= currentStep ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium hidden sm:inline",
                    i <= currentStep ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6 pb-6">
          {/* Step 1: Region & Currency */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div>
                <CardTitle className="text-lg mb-1">Region & Currency</CardTitle>
                <CardDescription>
                  Confirm your region and choose your store currency.
                </CardDescription>
              </div>

              {/* Country & Region (read-only) */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Country</label>
                  <div className="mt-1 px-3 py-2.5 rounded-lg border bg-muted/50 text-sm">
                    {countryName}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Region</label>
                  <div className="mt-1 px-3 py-2.5 rounded-lg border bg-muted/50 text-sm">
                    {regionName}
                  </div>
                </div>

                {/* Currency dropdown */}
                <div>
                  <label className="text-sm font-medium">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {Object.entries(CURRENCIES_BY_REGION).map(([rId, c]) => (
                      <option key={rId} value={c.code}>
                        {c.code} — {c.symbol} ({c.name})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Default for {regionName}: {currencyConfig.code} ({currencyConfig.symbol})
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Payment Methods */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <CardTitle className="text-lg mb-1">Payment Methods</CardTitle>
                <CardDescription>
                  Choose which payment methods to accept in your store.
                </CardDescription>
              </div>

              {paymentMethods.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No payment methods available for your region.</p>
                  <p className="text-xs mt-1">Update your region in the previous step.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paymentMethods.map((method, index) => (
                    <div
                      key={`${method.methodType}-${method.provider}-${index}`}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border transition-colors",
                        method.enabled
                          ? "border-primary/30 bg-primary/5"
                          : "border-muted"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center",
                            method.enabled
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          <CreditCard className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium">{method.label}</span>
                      </div>

                      {/* Toggle */}
                      <button
                        type="button"
                        onClick={() => togglePaymentMethod(index)}
                        className={cn(
                          "relative w-11 h-6 rounded-full transition-colors",
                          method.enabled ? "bg-primary" : "bg-muted-foreground/30"
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                            method.enabled ? "translate-x-5" : "translate-x-0"
                          )}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {enabledPaymentCount} of {paymentMethods.length} methods enabled
              </p>
            </div>
          )}

          {/* Step 3: Brand Sync */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <CardTitle className="text-lg mb-1">Brand Identity</CardTitle>
                <CardDescription>
                  Sync your brand kit or customize your store identity manually.
                </CardDescription>
              </div>

              {/* Sync Button */}
              <Button
                onClick={handleBrandSync}
                disabled={brandSyncing}
                variant={brandSynced ? "outline" : "default"}
                className="w-full"
              >
                {brandSyncing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Syncing...
                  </>
                ) : brandSynced ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Re-sync from Brand Kit
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Sync from Brand Kit
                  </>
                )}
              </Button>

              {/* Preview */}
              {brandSynced && brandData && (
                <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Synced from Brand Kit
                  </p>
                  {brandData.logo && (
                    <div className="flex items-center gap-3">
                      <img
                        src={brandData.logo}
                        alt="Brand logo"
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                      <span className="text-sm text-muted-foreground">Logo synced</span>
                    </div>
                  )}
                  {brandData.colors && Object.keys(brandData.colors).length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Colors</p>
                      <div className="flex gap-2">
                        {Object.entries(brandData.colors).map(([key, color]) =>
                          color ? (
                            <div key={key} className="flex items-center gap-1.5">
                              <div
                                className="h-6 w-6 rounded-md border"
                                style={{ backgroundColor: color }}
                              />
                              <span className="text-xs text-muted-foreground capitalize">
                                {key}
                              </span>
                            </div>
                          ) : null
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Manual Override */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Store Name</label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="My Awesome Store"
                    className="mt-1 w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Industry</label>
                  <input
                    type="text"
                    value={storeIndustry}
                    onChange={(e) => setStoreIndustry(e.target.value)}
                    placeholder="e.g. Fashion, Electronics, Food"
                    className="mt-1 w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Product Strategy */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <CardTitle className="text-lg mb-1">Product Strategy</CardTitle>
                <CardDescription>
                  How will you source products for your store?
                </CardDescription>
              </div>

              <div className="grid gap-4">
                {/* Own Products */}
                <button
                  type="button"
                  onClick={() => setProductStrategy("own")}
                  className={cn(
                    "text-left p-4 rounded-lg border-2 transition-colors",
                    productStrategy === "own"
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/30"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
                        productStrategy === "own"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">My Own Products</h3>
                        {productStrategy === "own" && (
                          <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Add and manage your own products, set prices, track inventory.
                      </p>
                    </div>
                  </div>
                </button>

                {/* AI Product Discovery (Coming Soon) */}
                <div
                  className="text-left p-4 rounded-lg border-2 border-muted opacity-60 cursor-not-allowed relative"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted text-muted-foreground flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">AI Product Discovery</h3>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          <Lock className="h-2.5 w-2.5" />
                          Coming Soon
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        AI-powered product recommendations and dropshipping integration.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Store Domain */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <CardTitle className="text-lg mb-1">Store Domain</CardTitle>
                <CardDescription>
                  Choose a custom subdomain for your storefront.
                </CardDescription>
              </div>

              <div>
                <label className="text-sm font-medium">Your store URL</label>
                <div className="mt-1 flex items-center">
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="my-store"
                    className="flex-1 px-3 py-2.5 rounded-l-lg border border-r-0 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <div className="px-3 py-2.5 rounded-r-lg border bg-muted text-sm text-muted-foreground whitespace-nowrap">
                    .flowsmartly.com
                  </div>
                </div>

                {/* Availability indicator */}
                <div className="mt-2 h-5">
                  {slugChecking && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Checking availability...
                    </div>
                  )}
                  {!slugChecking && slugAvailable === true && slug.length >= 2 && (
                    <div className="flex items-center gap-1.5 text-xs text-green-600">
                      <Check className="h-3 w-3" />
                      {slug}.flowsmartly.com is available
                    </div>
                  )}
                  {!slugChecking && slugAvailable === false && (
                    <div className="flex items-center gap-1.5 text-xs text-red-600">
                      <X className="h-3 w-3" />
                      This domain is already taken
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                Your store will be accessible at{" "}
                <span className="font-medium text-foreground">
                  {slug || "your-store"}.flowsmartly.com
                </span>
              </div>
            </div>
          )}

          {/* Step 6: Review & Launch */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <CardTitle className="text-lg mb-1">Review & Launch</CardTitle>
                <CardDescription>
                  Everything looks good? Launch your store!
                </CardDescription>
              </div>

              <div className="space-y-3">
                {/* Region */}
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Region</span>
                  </div>
                  <span className="text-sm font-medium">{regionName}</span>
                </div>

                {/* Currency */}
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Currency</span>
                  </div>
                  <span className="text-sm font-medium">{currency}</span>
                </div>

                {/* Payment Methods */}
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Payment Methods</span>
                  </div>
                  <span className="text-sm font-medium">
                    {enabledPaymentCount} enabled
                  </span>
                </div>

                {/* Brand */}
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Store Name</span>
                  </div>
                  <span className="text-sm font-medium">{storeName || "—"}</span>
                </div>

                {/* Industry */}
                {storeIndustry && (
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Industry</span>
                    </div>
                    <span className="text-sm font-medium">{storeIndustry}</span>
                  </div>
                )}

                {/* Domain */}
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Domain</span>
                  </div>
                  <span className="text-sm font-medium">
                    {slug || store?.slug || "—"}.flowsmartly.com
                  </span>
                </div>
              </div>

              {/* Launch Button */}
              <Button
                onClick={handleLaunch}
                disabled={launching || !storeName}
                className="w-full h-12 text-base"
                size="lg"
              >
                {launching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Launching your store...
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4 mr-2" />
                    Launch Store
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      {currentStep < 5 && (
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={goBack}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <Button onClick={goNext}>
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {currentStep === 5 && (
        <div className="flex justify-start mt-6">
          <Button variant="outline" onClick={goBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>
      )}
    </div>
  );
}
