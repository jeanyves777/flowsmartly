"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  Globe,
  CreditCard,
  Sparkles,
  Eye,
  Link2,
  Rocket,
  Loader2,
  Check,
  X,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils/cn";
import {
  PAYMENT_METHODS_BY_REGION,
  CURRENCIES_BY_REGION,
  type PaymentMethodConfig,
} from "@/lib/constants/ecommerce";
import { REGIONS, getRegionForCountry, getRegionName } from "@/lib/constants/regions";

import { StoreInfoStep } from "@/components/ecommerce/onboarding/store-info-step";
import { AIBuildStep } from "@/components/ecommerce/onboarding/ai-build-step";
import { PreviewStep } from "@/components/ecommerce/onboarding/preview-step";
import { type StoreTemplateConfig } from "@/lib/constants/store-templates";

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
  ecomPlan: string;
  freeDomainClaimed: boolean;
  setupComplete: boolean;
  isActive: boolean;
  theme: Record<string, unknown>;
  settings: Record<string, unknown>;
}

interface PreviewProduct {
  id: string;
  name: string;
  priceCents: number;
  status: string;
}

interface PaymentMethodSelection extends PaymentMethodConfig {
  enabled: boolean;
}

const STEP_CONFIG = [
  { label: "Store Info", icon: Globe },
  { label: "AI Build", icon: Sparkles },
  { label: "Preview", icon: Eye },
  { label: "Payments", icon: CreditCard },
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

  // Step 1: Store info
  const [storeName, setStoreName] = useState("");
  const [industry, setIndustry] = useState("");
  const [niche, setNiche] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [showBrandName, setShowBrandName] = useState(true);
  const [existingSiteUrl, setExistingSiteUrl] = useState("");
  const [generateImages, setGenerateImages] = useState(false);
  const [includeVariants, setIncludeVariants] = useState(true);

  // Step 2: AI build
  const [aiBuildComplete, setAiBuildComplete] = useState(false);
  const [aiBlueprintData, setAiBlueprintData] = useState<{
    blueprint: { templateId: string; content: { hero: { headline: string; subheadline: string; ctaText: string }; about: { title: string; body: string } } };
    productIds: string[];
    categoryIds: string[];
  } | null>(null);

  // Step 3: Preview
  const [templateId, setTemplateId] = useState("fresh");
  const [heroHeadline, setHeroHeadline] = useState("");
  const [heroSubheadline, setHeroSubheadline] = useState("");
  const [heroCta, setHeroCta] = useState("");
  const [previewProducts, setPreviewProducts] = useState<PreviewProduct[]>([]);

  // Step 4: Payment Methods
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodSelection[]>([]);

  // Step 5: Domain
  const [slug, setSlug] = useState("");
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const slugTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 6: Launching
  const [launching, setLaunching] = useState(false);

  // Brand template
  const [brandTemplate, setBrandTemplate] = useState<StoreTemplateConfig | null>(null);

  // ── Init: Fetch store + detect region ──

  useEffect(() => {
    initializeOnboarding();
  }, []);

  async function initializeOnboarding() {
    try {
      const storeRes = await fetch("/api/ecommerce/store");
      const storeJson = await storeRes.json();

      if (!storeJson.success || !storeJson.data.hasStore) {
        router.replace("/ecommerce");
        return;
      }

      const s = storeJson.data.store as StoreData;

      if (!["active", "trialing", "free_trial"].includes(s.ecomSubscriptionStatus)) {
        router.replace("/ecommerce");
        return;
      }

      if (s.setupComplete) {
        router.replace("/ecommerce/dashboard");
        return;
      }

      setStore(s);
      setStoreName(s.name || "");
      setIndustry(s.industry || "");
      setSlug(s.slug || "");

      // Detect region
      const profileRes = await fetch("/api/users/profile");
      const profileJson = await profileRes.json();

      let userRegion = "";
      let userCountry = "";

      if (profileJson.success) {
        const user = profileJson.data.user;
        userRegion = s.region || user.region || "";
        userCountry = s.country || user.country || "";
      }

      // IP geolocation fallback
      if (!userCountry || !userRegion) {
        try {
          const geoRes = await fetch("https://ipapi.co/json/");
          const geo = await geoRes.json();
          if (geo.country_code) {
            if (!userCountry) userCountry = geo.country_code;
            if (!userRegion) userRegion = getRegionForCountry(geo.country_code) || "";
          }
        } catch {}
      }

      setRegion(userRegion);
      setCountry(userCountry);

      const regionCurrency = CURRENCIES_BY_REGION[userRegion];
      setCurrency(regionCurrency?.code || s.currency || "USD");

      if (userRegion) {
        initPaymentMethods(userRegion);
      }

      // Fetch brand kit for "My Brand" template
      try {
        const brandRes = await fetch("/api/brand");
        const brandJson = await brandRes.json();
        if (brandJson.success && brandJson.data.brandKit) {
          const bk = brandJson.data.brandKit;
          const bColors = typeof bk.colors === 'string' ? JSON.parse(bk.colors) : (bk.colors || {});
          const bFonts = typeof bk.fonts === 'string' ? JSON.parse(bk.fonts) : (bk.fonts || {});
          if (bColors.primary) {
            setBrandTemplate({
              id: "my-brand",
              name: "My Brand",
              description: bk.name || "Your brand identity",
              category: "Brand Identity",
              colors: {
                primary: bColors.primary || "#4F46E5",
                secondary: bColors.secondary || "#818CF8",
                accent: bColors.accent || "#6366F1",
                background: "#ffffff",
                text: "#1a1a1a",
              },
              fonts: {
                heading: bFonts?.heading || "Inter",
                body: bFonts?.body || "Inter",
              },
              layout: {
                productGrid: "3",
                headerStyle: "minimal",
                heroStyle: "banner",
                cardStyle: "rounded",
                spacing: "normal",
              },
            });
          }
        }
      } catch {
        // Brand kit fetch is optional
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
    setPaymentMethods(methods.map((m) => ({ ...m, enabled: true })));
  }

  // ── Step 1 callbacks ──

  function handleStoreInfoFieldChange(field: string, value: string) {
    switch (field) {
      case "storeName": setStoreName(value); break;
      case "industry": setIndustry(value); break;
      case "niche": setNiche(value); break;
      case "targetAudience": setTargetAudience(value); break;
      case "existingSiteUrl": setExistingSiteUrl(value); break;
      case "country": setCountry(value); break;
      case "currency": setCurrency(value); break;
    }
  }

  function handleRegionChange(newRegion: string, newCountry: string, newCurrency: string) {
    setRegion(newRegion);
    setCountry(newCountry);
    setCurrency(newCurrency);
    initPaymentMethods(newRegion);
  }

  // ── Step 2 callbacks ──

  function handleAIBuildComplete(data: unknown) {
    const d = data as typeof aiBlueprintData;
    setAiBuildComplete(true);
    setAiBlueprintData(d);

    if (d?.blueprint) {
      setTemplateId(d.blueprint.templateId || "fresh");
      setHeroHeadline(d.blueprint.content.hero.headline || "");
      setHeroSubheadline(d.blueprint.content.hero.subheadline || "");
      setHeroCta(d.blueprint.content.hero.ctaText || "");
    }

    // Generate product images if enabled
    if (generateImages && d?.productIds?.length) {
      generateProductImagesForBuild(d.productIds);
    }

    // Fetch products created by AI
    fetchPreviewProducts();

    // Auto-advance to preview
    setCurrentStep(2);
  }

  async function generateProductImagesForBuild(productIds: string[]) {
    try {
      const res = await fetch("/api/ecommerce/products?status=DRAFT&limit=50");
      const json = await res.json();
      if (!json.success) return;

      for (const product of json.data.products) {
        if (!productIds.includes(product.id)) continue;
        try {
          const imgRes = await fetch("/api/ecommerce/ai/product-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productName: product.name,
              description: product.shortDescription || product.description?.slice(0, 200),
              style: "studio",
            }),
          });
          const imgJson = await imgRes.json();
          if (imgJson.success && imgJson.data?.imageUrl) {
            await fetch(`/api/ecommerce/products/${product.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                images: JSON.stringify([{ url: imgJson.data.imageUrl, alt: product.name, position: 0 }]),
              }),
            });
          }
        } catch { /* continue with next product */ }
      }
    } catch { /* non-critical */ }
  }

  async function fetchPreviewProducts() {
    try {
      const res = await fetch("/api/ecommerce/products?status=DRAFT&limit=50");
      const json = await res.json();
      if (json.success && json.data?.products) {
        setPreviewProducts(
          json.data.products.map((p: { id: string; name: string; priceCents: number; status: string }) => ({
            id: p.id,
            name: p.name,
            priceCents: p.priceCents,
            status: p.status,
          }))
        );
      }
    } catch {}
  }

  // ── Step 3 callbacks ──

  function handleTemplateChange(newTemplateId: string) {
    setTemplateId(newTemplateId);
  }

  function handleHeroChange(field: "headline" | "subheadline" | "cta", value: string) {
    switch (field) {
      case "headline": setHeroHeadline(value); break;
      case "subheadline": setHeroSubheadline(value); break;
      case "cta": setHeroCta(value); break;
    }
  }

  async function handleSavePreviewSettings() {
    try {
      await fetch("/api/ecommerce/store/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: { template: templateId },
          settings: {
            sections: [
              {
                id: "hero",
                enabled: true,
                order: 0,
                content: {
                  headline: heroHeadline,
                  subheadline: heroSubheadline,
                  ctaText: heroCta,
                  ctaLink: "/products",
                },
              },
              {
                id: "featured_products",
                enabled: true,
                order: 1,
                content: { title: "Featured Products", count: 8 },
              },
              {
                id: "about",
                enabled: true,
                order: 2,
                content: aiBlueprintData?.blueprint?.content?.about || { title: "About Us", body: "" },
              },
            ],
            storeContent: {
              showBrandName,
            },
          },
        }),
      });
    } catch {}
  }

  function handleRemoveProduct(productId: string) {
    setPreviewProducts((prev) => prev.filter((p) => p.id !== productId));
    fetch(`/api/ecommerce/products/${productId}`, { method: "DELETE" }).catch(() => {});
  }

  // ── Step 4: Payment toggle ──

  function togglePaymentMethod(index: number) {
    setPaymentMethods((prev) =>
      prev.map((m, i) => (i === index ? { ...m, enabled: !m.enabled } : m))
    );
  }

  // ── Step 5: Slug validation ──

  const checkSlugAvailability = useCallback((value: string) => {
    if (slugTimeoutRef.current) clearTimeout(slugTimeoutRef.current);
    if (!value || value.length < 2) { setSlugAvailable(null); return; }

    setSlugChecking(true);
    setSlugAvailable(null);

    slugTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ecommerce/store?checkSlug=true&slug=${encodeURIComponent(value)}`);
        const json = await res.json();
        if (json.success) setSlugAvailable(json.data.available);
      } catch { setSlugAvailable(null); }
      finally { setSlugChecking(false); }
    }, 500);
  }, []);

  function handleSlugChange(value: string) {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    setSlug(sanitized);
    checkSlugAvailability(sanitized);
  }

  // ── Step 6: Launch ──

  async function handleLaunch() {
    setLaunching(true);
    try {
      // 1. Bulk activate DRAFT products
      await fetch("/api/ecommerce/products/bulk-activate", { method: "POST" });

      // 2. Save final settings
      const activePaymentMethods = paymentMethods
        .filter((pm) => pm.enabled)
        .map((pm) => ({
          methodType: pm.methodType,
          provider: pm.provider,
          isActive: true,
        }));

      const settingsRes = await fetch("/api/ecommerce/store/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: storeName,
          currency,
          industry: industry || undefined,
          slug: slug || undefined,
        }),
      });

      const settingsJson = await settingsRes.json();
      if (!settingsJson.success) {
        throw new Error(settingsJson.error?.message || "Failed to save settings");
      }

      // 3. Complete onboarding
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
        description: "Your AI-powered store is live. Welcome to FlowShop!",
      });

      router.push("/ecommerce/dashboard");
    } catch (error) {
      console.error("Launch error:", error);
      toast({
        title: "Launch failed",
        description: error instanceof Error ? error.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setLaunching(false);
    }
  }

  // ── Navigation ──

  function canGoNext(): boolean {
    switch (currentStep) {
      case 0: return !!storeName && !!industry;
      case 1: return aiBuildComplete;
      case 2: return true;
      case 3: return true;
      case 4: return true;
      default: return false;
    }
  }

  function goNext() {
    if (currentStep < 5 && canGoNext()) setCurrentStep((s) => s + 1);
  }

  function goBack() {
    if (currentStep > 0) {
      // Skip back over AI build step if already complete
      if (currentStep === 2 && aiBuildComplete) {
        setCurrentStep(0);
      } else {
        setCurrentStep((s) => s - 1);
      }
    }
  }

  // ── Loading ──

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

  // ── Derived ──

  const enabledPaymentCount = paymentMethods.filter((pm) => pm.enabled).length;
  const regionName = region ? getRegionName(region) : "Not set";

  return (
    <div className="w-full px-2 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ShoppingBag className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Set Up FlowShop</h1>
          <p className="text-sm text-muted-foreground">
            Step {currentStep + 1} of 6 — {STEP_CONFIG[currentStep].label}
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
                  i <= currentStep ? "bg-primary" : "bg-muted"
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
          {/* Step 1: Store Info (combined region + brand + details) */}
          {currentStep === 0 && (
            <StoreInfoStep
              storeName={storeName}
              industry={industry}
              niche={niche}
              targetAudience={targetAudience}
              region={region}
              country={country}
              currency={currency}
              existingSiteUrl={existingSiteUrl}
              showBrandName={showBrandName}
              onFieldChange={handleStoreInfoFieldChange}
              onRegionChange={handleRegionChange}
              onShowBrandNameChange={setShowBrandName}
            />
          )}

          {/* Step 2: AI Building Your Store */}
          {currentStep === 1 && (
            <AIBuildStep
              storeName={storeName}
              industry={industry}
              niche={niche}
              targetAudience={targetAudience}
              region={region}
              currency={currency}
              showBrandName={showBrandName}
              existingSiteUrl={existingSiteUrl}
              generateImages={generateImages}
              onToggleGenerateImages={() => setGenerateImages((p) => !p)}
              includeVariants={includeVariants}
              onToggleVariants={() => setIncludeVariants((p) => !p)}
              onComplete={handleAIBuildComplete}
              onError={(err) => {
                toast({
                  title: "AI Build Failed",
                  description: err,
                  variant: "destructive",
                });
              }}
            />
          )}

          {/* Step 3: Preview & Customize */}
          {currentStep === 2 && store && (
            <div>
              <div className="mb-4">
                <h2 className="text-lg font-bold mb-1">Preview & Customize</h2>
                <p className="text-sm text-muted-foreground">
                  Your AI-built store is ready. Customize the theme, hero text, and products below.
                </p>
              </div>
              <PreviewStep
                storeSlug={store.slug}
                templateId={templateId}
                heroHeadline={heroHeadline}
                heroSubheadline={heroSubheadline}
                heroCta={heroCta}
                products={previewProducts}
                currency={currency}
                onTemplateChange={handleTemplateChange}
                onHeroChange={handleHeroChange}
                onSaveSettings={handleSavePreviewSettings}
                onRemoveProduct={handleRemoveProduct}
                brandTemplate={brandTemplate}
              />
            </div>
          )}

          {/* Step 4: Payment Methods */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold mb-1">Payment Methods</h2>
                <p className="text-sm text-muted-foreground">
                  Choose which payment methods to accept in your store.
                </p>
              </div>

              {paymentMethods.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No payment methods available for your region.</p>
                  <p className="text-xs mt-1">Go back and update your region.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paymentMethods.map((method, index) => (
                    <div
                      key={`${method.methodType}-${method.provider}-${index}`}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border transition-colors",
                        method.enabled ? "border-primary/30 bg-primary/5" : "border-muted"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center",
                            method.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                          )}
                        >
                          <CreditCard className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium">{method.label}</span>
                      </div>
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

          {/* Step 5: Store Domain */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold mb-1">Store Domain</h2>
                <p className="text-sm text-muted-foreground">
                  Choose a custom subdomain for your storefront.
                </p>
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
                <h2 className="text-lg font-bold mb-1">Review & Launch</h2>
                <p className="text-sm text-muted-foreground">
                  Everything looks good? Launch your AI-powered store!
                </p>
              </div>

              <div className="space-y-3">
                <SummaryRow icon={Globe} label="Region" value={regionName} />
                <SummaryRow icon={CreditCard} label="Currency" value={currency} />
                <SummaryRow icon={CreditCard} label="Payment Methods" value={`${enabledPaymentCount} enabled`} />
                <SummaryRow icon={ShoppingBag} label="Store Name" value={storeName || "—"} />
                {industry && <SummaryRow icon={Package} label="Industry" value={industry} />}
                <SummaryRow icon={Sparkles} label="Products" value={`${previewProducts.length} AI-generated`} />
                <SummaryRow icon={Link2} label="Domain" value={`${slug || store?.slug || "—"}.flowsmartly.com`} />
              </div>

              {/* Preview thumbnail */}
              {store && (
                <a
                  href={`/store/${store.slug}?preview=true`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border overflow-hidden hover:ring-2 hover:ring-primary/50 transition-all"
                >
                  <div className="h-32 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <div className="text-center">
                      <ExternalLink className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Preview your store</span>
                    </div>
                  </div>
                </a>
              )}

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
                    Publish Store
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
          {/* Hide Next on AI Build step — it auto-advances on completion */}
          {currentStep !== 1 ? (
            <Button onClick={goNext} disabled={!canGoNext()}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <div />
          )}
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

// ── Helper Components ──

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
