"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Layout,
  LayoutGrid,
  FileText,
  Palette,
  Type,
  Sparkles,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Loader2,
  Save,
  AlertCircle,
  Check,
  X,
  GripVertical,
  Eye,
  EyeOff,
  RefreshCw,
  ExternalLink,
  Monitor,
  Tablet,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { STORE_TEMPLATES_FULL, type StoreTemplateConfig } from "@/lib/constants/store-templates";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// ── Types ────────────────────────────────────────────────────────────────────

type TabId = "theme" | "layout" | "sections" | "content" | "policies";

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

interface ThemeFonts {
  heading: string;
  body: string;
}

interface ThemeLayout {
  productGrid: string;
  headerStyle: string;
  heroStyle: string;
  cardStyle: string;
  spacing: string;
}

interface ThemeState {
  template: string;
  colors: ThemeColors;
  fonts: ThemeFonts;
  layout: ThemeLayout;
}

interface HeroContent {
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaLink: string;
  imageUrl?: string;
  imageUrls?: string[];
  videoUrl?: string;
}

interface FeaturedProductsContent {
  title: string;
  count: number;
}

interface AboutContent {
  title: string;
  body: string;
}

interface TestimonialItem {
  name: string;
  text: string;
  rating: number;
}

interface TestimonialsContent {
  title: string;
  items: TestimonialItem[];
}

interface NewsletterContent {
  title: string;
  subtitle: string;
}

interface ContactContent {
  title: string;
  email: string;
  phone: string;
  address: string;
}

interface GenericSectionContent {
  title: string;
  count?: number;
  [key: string]: unknown;
}

type SectionContent =
  | HeroContent
  | FeaturedProductsContent
  | AboutContent
  | TestimonialsContent
  | NewsletterContent
  | ContactContent
  | GenericSectionContent;

interface SectionStyle {
  backgroundColor?: string;
}

interface Section {
  id: string;
  enabled: boolean;
  order: number;
  content: SectionContent;
  style?: SectionStyle;
}

interface FaqItem {
  question: string;
  answer: string;
}

interface StoreContent {
  tagline: string;
  about: string;
  returnPolicy: string;
  shippingPolicy: string;
  termsOfService: string;
  privacyPolicy: string;
  faq: FaqItem[];
  showBrandName: boolean;
}

interface Store {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  theme: Record<string, unknown>;
  settings: Record<string, unknown>;
}

// ── Constants ────────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  hero: "Hero Banner",
  promo_banner: "Promo Banner",
  category_showcase: "Categories",
  featured_products: "Featured Products",
  new_arrivals: "New Arrivals",
  deals: "Deals & Offers",
  about: "About Us",
  testimonials: "Testimonials",
  newsletter: "Newsletter",
  contact: "Contact",
};

const FONT_OPTIONS = [
  "Inter",
  "Playfair Display",
  "Lora",
  "Nunito",
  "Open Sans",
  "Oswald",
  "Roboto",
  "Poppins",
  "Merriweather",
  "Source Sans 3",
  "DM Sans",
  "Space Grotesk",
  "Montserrat",
  "Raleway",
  "Work Sans",
];

const TABS: { id: TabId; label: string; icon: typeof Palette }[] = [
  { id: "theme", label: "Theme", icon: Palette },
  { id: "layout", label: "Layout", icon: LayoutGrid },
  { id: "sections", label: "Sections", icon: Layout },
  { id: "content", label: "Content", icon: Type },
  { id: "policies", label: "Policies", icon: FileText },
];

// ── Defaults ─────────────────────────────────────────────────────────────────

function getDefaultThemeState(): ThemeState {
  return {
    template: "minimal",
    colors: {
      primary: "#111827",
      secondary: "#6b7280",
      accent: "#111827",
      background: "#ffffff",
      text: "#111827",
    },
    fonts: {
      heading: "Inter",
      body: "Inter",
    },
    layout: {
      productGrid: "4",
      headerStyle: "minimal",
      heroStyle: "banner",
      cardStyle: "minimal",
      spacing: "spacious",
    },
  };
}

function getDefaultSections(): Section[] {
  return [
    { id: "hero", enabled: true, order: 0, content: { headline: "", subheadline: "", ctaText: "Shop Now", ctaLink: "" } as HeroContent },
    { id: "category_showcase", enabled: true, order: 1, content: { title: "Shop by Category" } as GenericSectionContent },
    { id: "featured_products", enabled: true, order: 2, content: { title: "Featured Products", count: 8 } as FeaturedProductsContent },
    { id: "new_arrivals", enabled: true, order: 3, content: { title: "New Arrivals", count: 8 } as GenericSectionContent },
    { id: "deals", enabled: true, order: 4, content: { title: "Deals & Offers", count: 8 } as GenericSectionContent },
    { id: "about", enabled: false, order: 5, content: { title: "About Us", body: "" } as AboutContent },
    { id: "testimonials", enabled: false, order: 6, content: { title: "What Customers Say", items: [] } as TestimonialsContent },
    { id: "newsletter", enabled: false, order: 7, content: { title: "Stay Updated", subtitle: "" } as NewsletterContent },
    { id: "contact", enabled: false, order: 8, content: { title: "Contact Us" } as ContactContent },
  ];
}

function getDefaultStoreContent(): StoreContent {
  return {
    tagline: "",
    about: "",
    returnPolicy: "",
    shippingPolicy: "",
    termsOfService: "",
    privacyPolicy: "",
    faq: [],
    showBrandName: true,
  };
}

// ── Page Component ───────────────────────────────────────────────────────────

export default function EcommerceDesignPage() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [store, setStore] = useState<Store | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("theme");
  const [themeState, setThemeState] = useState<ThemeState>(getDefaultThemeState());
  const [sections, setSections] = useState<Section[]>(getDefaultSections());
  const [storeContent, setStoreContent] = useState<StoreContent>(getDefaultStoreContent());
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingSection, setGeneratingSection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [previewKey, setPreviewKey] = useState(0);
  const [brandTemplate, setBrandTemplate] = useState<StoreTemplateConfig | null>(null);

  // AI Enhance modal state
  const [showAIEnhanceModal, setShowAIEnhanceModal] = useState(false);
  const [aiEnhancePrompt, setAIEnhancePrompt] = useState("");
  const [aiEnhanceUrl, setAIEnhanceUrl] = useState("");
  const [aiEnhanceScope, setAIEnhanceScope] = useState<"theme" | "content" | "products" | "all">("all");
  const [aiEnhancing, setAIEnhancing] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load Store Data ────────────────────────────────────────────────────────

  const loadStore = useCallback(async () => {
    try {
      const res = await fetch("/api/ecommerce/store");
      const data = await res.json();
      if (data.success && data.data?.store) {
        const s = data.data.store;
        setStore(s);

        // Parse theme
        const themeData = typeof s.theme === "string" ? JSON.parse(s.theme) : (s.theme || {});
        setThemeState({
          template: themeData.template || "minimal",
          colors: {
            primary: themeData.colors?.primary || "#111827",
            secondary: themeData.colors?.secondary || "#6b7280",
            accent: themeData.colors?.accent || "#111827",
            background: themeData.colors?.background || "#ffffff",
            text: themeData.colors?.text || "#111827",
          },
          fonts: {
            heading: themeData.fonts?.heading || "Inter",
            body: themeData.fonts?.body || "Inter",
          },
          layout: {
            productGrid: themeData.layout?.productGrid || "4",
            headerStyle: themeData.layout?.headerStyle || "minimal",
            heroStyle: themeData.layout?.heroStyle || "banner",
            cardStyle: themeData.layout?.cardStyle || "minimal",
            spacing: themeData.layout?.spacing || "spacious",
          },
        });

        // Parse settings
        const settings = typeof s.settings === "string" ? JSON.parse(s.settings) : (s.settings || {});
        if (Array.isArray(settings.sections) && settings.sections.length > 0) {
          setSections(
            settings.sections.map((sec: Section, i: number) => ({
              ...sec,
              order: sec.order ?? i,
              style: sec.style || undefined,
            }))
          );
        }
        if (settings.storeContent) {
          setStoreContent({
            tagline: settings.storeContent.tagline || "",
            about: settings.storeContent.about || "",
            returnPolicy: settings.storeContent.returnPolicy || "",
            shippingPolicy: settings.storeContent.shippingPolicy || "",
            termsOfService: settings.storeContent.termsOfService || "",
            privacyPolicy: settings.storeContent.privacyPolicy || "",
            faq: Array.isArray(settings.storeContent.faq) ? settings.storeContent.faq : [],
            showBrandName: settings.storeContent.showBrandName !== false,
          });
        }
      } else {
        setError("No store found. Please create a store first.");
      }

      // After loading store, fetch brand kit
      try {
        const brandRes = await fetch("/api/brand");
        const brandJson = await brandRes.json();
        if (brandJson.success && brandJson.data.brandKit) {
          const bk = brandJson.data.brandKit;
          const colors = typeof bk.colors === 'string' ? JSON.parse(bk.colors) : bk.colors;
          const fonts = typeof bk.fonts === 'string' ? JSON.parse(bk.fonts) : bk.fonts;
          if (colors?.primary) {
            setBrandTemplate({
              id: "my-brand",
              name: "My Brand",
              description: bk.name || "Your brand identity",
              category: "Brand Identity",
              colors: {
                primary: colors.primary || "#4F46E5",
                secondary: colors.secondary || "#818CF8",
                accent: colors.accent || "#6366F1",
                background: "#ffffff",
                text: "#1a1a1a",
              },
              fonts: {
                heading: fonts?.heading || "Inter",
                body: fonts?.body || "Inter",
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
        // Brand kit fetch is optional — ignore errors
      }
    } catch {
      setError("Failed to load store data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStore();
  }, [loadStore]);

  // Auto-dismiss success message
  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [successMessage]);

  // Cleanup save timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // ── Preview Communication ──────────────────────────────────────────────────

  function sendPreviewUpdate(updates: Record<string, unknown>) {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "flowshop-preview-update", ...updates },
        "*"
      );
    }
  }

  // ── Theme Handlers ─────────────────────────────────────────────────────────

  function handleTemplateSelect(template: StoreTemplateConfig) {
    setThemeState((prev) => ({
      template: template.id,
      colors: { ...template.colors },
      fonts: { ...template.fonts },
      layout: { ...prev.layout },
    }));
    sendPreviewUpdate({
      colors: template.colors,
      fonts: template.fonts,
      template: template.id,
    });
  }

  function handleColorChange(key: string, value: string) {
    setThemeState((prev) => ({
      ...prev,
      colors: { ...prev.colors, [key]: value },
    }));
    sendPreviewUpdate({ colors: { [key]: value } });
  }

  function handleFontChange(key: "heading" | "body", value: string) {
    setThemeState((prev) => ({
      ...prev,
      fonts: { ...prev.fonts, [key]: value },
    }));
    sendPreviewUpdate({ fonts: { [key]: value } });
  }

  // ── Layout Handlers ────────────────────────────────────────────────────────

  function handleLayoutChange(key: string, value: string) {
    setThemeState((prev) => ({
      ...prev,
      layout: { ...prev.layout, [key]: value },
    }));
    debouncedSaveAndReload();
  }

  function debouncedSaveAndReload() {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      await saveToApi();
      setPreviewKey((k) => k + 1);
    }, 500);
  }

  async function saveToApi() {
    if (!store) return;
    try {
      const res = await fetch("/api/ecommerce/store/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: themeState,
          settings: { sections, storeContent },
        }),
      });
      const data = await res.json();
      if (data.success && data.data?.store) {
        setStore(data.data.store);
      }
    } catch {
      // Silent fail for auto-save
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!store) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ecommerce/store/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: themeState,
          settings: { sections, storeContent },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStore(data.data.store);
        setSuccessMessage("Design saved.");
        setPreviewKey((k) => k + 1);
      } else {
        setError(data.error?.message || "Failed to save.");
      }
    } catch {
      setError("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  // ── AI Generate Section ────────────────────────────────────────────────────

  async function handleGenerateSection(contentType: string) {
    setGeneratingSection(contentType);
    setError(null);
    try {
      const res = await fetch("/api/ecommerce/ai/store-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentTypes: [contentType] }),
      });
      const data = await res.json();
      if (data.success) {
        applyAiResult(data.data);
        setSuccessMessage(`${contentType.replace(/_/g, " ")} generated!`);
      } else {
        setError(data.error?.message || "Generation failed.");
      }
    } catch {
      setError("Failed to generate content.");
    } finally {
      setGeneratingSection(null);
    }
  }

  function applyAiResult(result: Record<string, unknown>) {
    if (result.hero) {
      const hero = result.hero as { headline: string; subheadline: string };
      setSections((prev) =>
        prev.map((s) =>
          s.id === "hero"
            ? { ...s, content: { ...(s.content as HeroContent), headline: hero.headline, subheadline: hero.subheadline } }
            : s
        )
      );
    }
    if (result.about) {
      setSections((prev) =>
        prev.map((s) =>
          s.id === "about" ? { ...s, content: { ...(s.content as AboutContent), body: result.about as string } } : s
        )
      );
    }
    if (result.tagline) {
      setStoreContent((prev) => ({ ...prev, tagline: result.tagline as string }));
    }
    if (result.about) {
      setStoreContent((prev) => ({ ...prev, about: result.about as string }));
    }
    if (result.returnPolicy) {
      setStoreContent((prev) => ({ ...prev, returnPolicy: result.returnPolicy as string }));
    }
    if (result.shippingPolicy) {
      setStoreContent((prev) => ({ ...prev, shippingPolicy: result.shippingPolicy as string }));
    }
    if (result.termsOfService) {
      setStoreContent((prev) => ({ ...prev, termsOfService: result.termsOfService as string }));
    }
    if (result.privacyPolicy) {
      setStoreContent((prev) => ({ ...prev, privacyPolicy: result.privacyPolicy as string }));
    }
    if (result.faq) {
      setStoreContent((prev) => ({ ...prev, faq: result.faq as FaqItem[] }));
    }
  }

  // ── AI Enhance ─────────────────────────────────────────────────────────────

  async function handleAIEnhance() {
    if (!aiEnhancePrompt.trim()) return;
    setAIEnhancing(true);
    setError(null);
    try {
      const res = await fetch("/api/ecommerce/ai/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiEnhancePrompt.trim(),
          referenceUrl: aiEnhanceUrl.trim() || undefined,
          scope: aiEnhanceScope,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const result = data.data;
        // Apply theme changes
        if (result.theme) {
          setThemeState((prev) => ({
            ...prev,
            colors: { ...prev.colors, ...(result.theme.colors || {}) },
            fonts: { ...prev.fonts, ...(result.theme.fonts || {}) },
          }));
          sendPreviewUpdate({
            colors: { ...themeState.colors, ...(result.theme.colors || {}) },
            fonts: { ...themeState.fonts, ...(result.theme.fonts || {}) },
          });
        }
        // Apply content changes
        if (result.content) {
          applyAiResult(result.content);
        }
        setShowAIEnhanceModal(false);
        setAIEnhancePrompt("");
        setAIEnhanceUrl("");
        const parts: string[] = [];
        if (result.theme) parts.push("theme");
        if (result.content) parts.push("content");
        if (result.newProductIds?.length) parts.push(`${result.newProductIds.length} products`);
        setSuccessMessage(`AI enhanced your store${parts.length ? `: ${parts.join(", ")}` : ""}! Save to keep changes.`);
        setPreviewKey((k) => k + 1);
      } else {
        setError(data.error?.message || "AI enhance failed.");
      }
    } catch {
      setError("Failed to enhance store with AI.");
    } finally {
      setAIEnhancing(false);
    }
  }

  // ── Section Helpers ────────────────────────────────────────────────────────

  function toggleSection(id: string) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)));
  }

  function moveSectionUp(id: string) {
    setSections((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((s) => s.id === id);
      if (idx <= 0) return prev;
      const newOrder = sorted[idx - 1].order;
      sorted[idx - 1].order = sorted[idx].order;
      sorted[idx].order = newOrder;
      return [...sorted];
    });
  }

  function moveSectionDown(id: string) {
    setSections((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((s) => s.id === id);
      if (idx < 0 || idx >= sorted.length - 1) return prev;
      const newOrder = sorted[idx + 1].order;
      sorted[idx + 1].order = sorted[idx].order;
      sorted[idx].order = newOrder;
      return [...sorted];
    });
  }

  function updateSectionContent(id: string, patch: Partial<SectionContent>) {
    setSections((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, content: { ...s.content, ...patch } } : s
      )
    );
  }

  function updateSectionStyle(id: string, patch: Partial<SectionStyle>) {
    setSections((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, style: { ...(s.style || {}), ...patch } } : s
      )
    );
    debouncedSaveAndReload();
  }

  // ── Content Tab Sync Helpers ───────────────────────────────────────────────

  function getHeroSection(): HeroContent {
    const hero = sections.find((s) => s.id === "hero");
    return (hero?.content as HeroContent) || { headline: "", subheadline: "", ctaText: "Shop Now", ctaLink: "" };
  }

  function getAboutSection(): AboutContent {
    const about = sections.find((s) => s.id === "about");
    return (about?.content as AboutContent) || { title: "About Us", body: "" };
  }

  function getContactSection(): ContactContent {
    const contact = sections.find((s) => s.id === "contact");
    return (contact?.content as ContactContent) || { title: "Contact Us", email: "", phone: "", address: "" };
  }

  // ── Testimonial Helpers ────────────────────────────────────────────────────

  function addTestimonial() {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== "testimonials") return s;
        const items = [...(s.content as TestimonialsContent).items, { name: "", text: "", rating: 5 }];
        return { ...s, content: { ...(s.content as TestimonialsContent), items } };
      })
    );
  }

  function removeTestimonial(index: number) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== "testimonials") return s;
        const items = (s.content as TestimonialsContent).items.filter((_, i) => i !== index);
        return { ...s, content: { ...(s.content as TestimonialsContent), items } };
      })
    );
  }

  function updateTestimonial(index: number, patch: Partial<TestimonialItem>) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== "testimonials") return s;
        const items = (s.content as TestimonialsContent).items.map((item, i) =>
          i === index ? { ...item, ...patch } : item
        );
        return { ...s, content: { ...(s.content as TestimonialsContent), items } };
      })
    );
  }

  // ── FAQ Helpers ────────────────────────────────────────────────────────────

  function addFaqItem() {
    setStoreContent((prev) => ({
      ...prev,
      faq: [...prev.faq, { question: "", answer: "" }],
    }));
  }

  function removeFaqItem(index: number) {
    setStoreContent((prev) => ({
      ...prev,
      faq: prev.faq.filter((_, i) => i !== index),
    }));
  }

  function updateFaqItem(index: number, patch: Partial<FaqItem>) {
    setStoreContent((prev) => ({
      ...prev,
      faq: prev.faq.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  // ── Render: Loading / Error ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Loading design studio...</div>
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

  // ── Computed ───────────────────────────────────────────────────────────────

  const sortedSections = [...sections].sort((a, b) => a.order - b.order);
  const previewUrl = store.slug
    ? `/store/${store.slug}?preview=true&_t=${previewKey}`
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3 px-1 pb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold">Store Design</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Customize your store theme, layout, and content with live preview.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview((p) => !p)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
              showPreview
                ? "bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-950/30 dark:border-brand-800 dark:text-brand-300"
                : "hover:bg-muted"
            )}
            title={showPreview ? "Hide preview" : "Show preview"}
          >
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span className="hidden sm:inline">{showPreview ? "Hide" : "Preview"}</span>
          </button>
          <button
            onClick={() => setShowAIEnhanceModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">AI Enhance</span>
            <span className="sm:hidden">AI</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span className="hidden sm:inline">Save</span>
          </button>
        </div>
      </div>

      {/* ── Messages ────────────────────────────────────────────────────────── */}
      <div className="px-1 shrink-0">
        {successMessage && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300 text-sm mb-3">
            <Check className="h-4 w-4" />
            {successMessage}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300 text-sm mb-3">
            <AlertCircle className="h-4 w-4" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── Split Panel ─────────────────────────────────────────────────────── */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* ── Left: Editor Panel ──────────────────────────────────────────── */}
        <div className={cn("flex flex-col min-h-0 shrink-0", showPreview ? "w-[420px]" : "w-full max-w-2xl")}>
          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-lg bg-muted mb-3 shrink-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-xs font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Scrollable editor content */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 pb-4">

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* ── THEME TAB ────────────────────────────────────────────────── */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {activeTab === "theme" && (
              <div className="space-y-6">
                {/* ── Template Picker ──────────────────────────────────────── */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Templates</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {brandTemplate && (
                      <button
                        key="my-brand"
                        onClick={() => handleTemplateSelect(brandTemplate)}
                        className={cn(
                          "relative rounded-xl border-2 p-3 text-left transition-all hover:shadow-md col-span-2",
                          themeState.template === "my-brand"
                            ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/20 shadow-sm"
                            : "border-transparent bg-card hover:border-muted-foreground/20"
                        )}
                      >
                        {themeState.template === "my-brand" && (
                          <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-brand-500 flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1 flex-1">
                            {[brandTemplate.colors.primary, brandTemplate.colors.secondary, brandTemplate.colors.accent, brandTemplate.colors.background].map(
                              (color, i) => (
                                <div key={i} className="h-5 flex-1 rounded-sm border border-black/5" style={{ backgroundColor: color }} />
                              )
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">MY BRAND</span>
                          <span className="text-sm font-medium">{brandTemplate.description}</span>
                        </div>
                      </button>
                    )}
                    {STORE_TEMPLATES_FULL.map((tpl) => {
                      const isSelected = themeState.template === tpl.id;
                      return (
                        <button
                          key={tpl.id}
                          onClick={() => handleTemplateSelect(tpl)}
                          className={cn(
                            "relative rounded-xl border-2 p-3 text-left transition-all hover:shadow-md",
                            isSelected
                              ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/20 shadow-sm"
                              : "border-transparent bg-card hover:border-muted-foreground/20"
                          )}
                        >
                          {/* Selected checkmark */}
                          {isSelected && (
                            <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-brand-500 flex items-center justify-center">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                          {/* Color bar */}
                          <div className="flex gap-1 mb-2.5">
                            {[tpl.colors.primary, tpl.colors.secondary, tpl.colors.accent, tpl.colors.background].map(
                              (color, i) => (
                                <div
                                  key={i}
                                  className="h-4 flex-1 rounded-sm border border-black/5"
                                  style={{ backgroundColor: color }}
                                />
                              )
                            )}
                          </div>
                          {/* Name + Category */}
                          <div className="text-sm font-medium">{tpl.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{tpl.category}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Color Pickers ────────────────────────────────────────── */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Colors</h3>
                  <div className="rounded-xl border bg-card p-4 space-y-3">
                    {(
                      [
                        { key: "primary", label: "Primary" },
                        { key: "secondary", label: "Secondary" },
                        { key: "accent", label: "Accent" },
                        { key: "background", label: "Background" },
                        { key: "text", label: "Text" },
                      ] as const
                    ).map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-3">
                        <input
                          type="color"
                          value={themeState.colors[key]}
                          onChange={(e) => handleColorChange(key, e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                        />
                        <div className="flex-1">
                          <label className="text-xs font-medium opacity-70">{label}</label>
                          <input
                            type="text"
                            value={themeState.colors[key]}
                            onChange={(e) => handleColorChange(key, e.target.value)}
                            className="w-full mt-0.5 px-2 py-1 rounded border bg-background text-xs font-mono"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Font Selectors ───────────────────────────────────────── */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Fonts</h3>
                  <div className="rounded-xl border bg-card p-4 space-y-4">
                    <div>
                      <label className="block text-xs font-medium opacity-70 mb-1.5">Heading Font</label>
                      <select
                        value={themeState.fonts.heading}
                        onChange={(e) => handleFontChange("heading", e.target.value)}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        {FONT_OPTIONS.map((font) => (
                          <option key={font} value={font}>
                            {font}
                          </option>
                        ))}
                      </select>
                      <div className="mt-2 p-3 rounded-lg bg-muted/50 text-center" style={{ fontFamily: themeState.fonts.heading }}>
                        <span className="text-lg font-bold">The Quick Brown Fox</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium opacity-70 mb-1.5">Body Font</label>
                      <select
                        value={themeState.fonts.body}
                        onChange={(e) => handleFontChange("body", e.target.value)}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        {FONT_OPTIONS.map((font) => (
                          <option key={font} value={font}>
                            {font}
                          </option>
                        ))}
                      </select>
                      <div className="mt-2 p-3 rounded-lg bg-muted/50 text-center" style={{ fontFamily: themeState.fonts.body }}>
                        <span className="text-sm">Jumps over the lazy dog. 0123456789</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* ── LAYOUT TAB ───────────────────────────────────────────────── */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {activeTab === "layout" && (
              <div className="space-y-6">
                {/* ── Header Style ─────────────────────────────────────────── */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Header Style</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {(["minimal", "centered", "bold"] as const).map((style) => (
                      <button
                        key={style}
                        onClick={() => handleLayoutChange("headerStyle", style)}
                        className={cn(
                          "rounded-xl border-2 p-3 transition-all",
                          themeState.layout.headerStyle === style
                            ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/20"
                            : "border-transparent bg-card hover:border-muted-foreground/20"
                        )}
                      >
                        {/* Mini header mockup */}
                        <div className="h-10 rounded-md bg-muted/70 flex items-center px-2 mb-2">
                          {style === "minimal" && (
                            <>
                              <div className="h-2 w-8 rounded bg-foreground/30" />
                              <div className="ml-auto flex gap-1">
                                <div className="h-1.5 w-4 rounded bg-foreground/20" />
                                <div className="h-1.5 w-4 rounded bg-foreground/20" />
                              </div>
                            </>
                          )}
                          {style === "centered" && (
                            <div className="w-full text-center">
                              <div className="h-2 w-10 rounded bg-foreground/30 mx-auto" />
                              <div className="flex justify-center gap-1 mt-1">
                                <div className="h-1 w-3 rounded bg-foreground/15" />
                                <div className="h-1 w-3 rounded bg-foreground/15" />
                                <div className="h-1 w-3 rounded bg-foreground/15" />
                              </div>
                            </div>
                          )}
                          {style === "bold" && (
                            <>
                              <div className="h-3 w-12 rounded bg-foreground/40" />
                              <div className="ml-auto flex gap-1.5">
                                <div className="h-2 w-5 rounded bg-foreground/25" />
                                <div className="h-2 w-5 rounded bg-foreground/25" />
                                <div className="h-4 w-8 rounded bg-brand-500/60" />
                              </div>
                            </>
                          )}
                        </div>
                        <span className="text-xs font-medium capitalize">{style}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Show Brand Name Toggle ───────────────────────────────── */}
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">Show Brand Name</p>
                    <p className="text-xs text-muted-foreground">Turn off if your logo already includes the name.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setStoreContent((prev) => ({ ...prev, showBrandName: !prev.showBrandName }));
                      debouncedSaveAndReload();
                    }}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      storeContent.showBrandName ? "bg-brand-500" : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                        storeContent.showBrandName ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>

                {/* ── Hero Style ───────────────────────────────────────────── */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Hero Style</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {(["full-bleed", "split", "overlay", "banner"] as const).map((style) => (
                      <button
                        key={style}
                        onClick={() => handleLayoutChange("heroStyle", style)}
                        className={cn(
                          "rounded-xl border-2 p-3 transition-all",
                          themeState.layout.heroStyle === style
                            ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/20"
                            : "border-transparent bg-card hover:border-muted-foreground/20"
                        )}
                      >
                        {/* Mini hero mockup */}
                        <div className="h-16 rounded-md overflow-hidden mb-2 relative">
                          {style === "full-bleed" && (
                            <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center">
                              <div className="h-2 w-16 rounded bg-white/50" />
                            </div>
                          )}
                          {style === "split" && (
                            <div className="w-full h-full flex">
                              <div className="flex-1 bg-muted/50 flex flex-col items-start justify-center px-2 gap-1">
                                <div className="h-1.5 w-10 rounded bg-foreground/30" />
                                <div className="h-1 w-8 rounded bg-foreground/15" />
                              </div>
                              <div className="w-1/2 bg-gradient-to-br from-muted to-muted-foreground/30" />
                            </div>
                          )}
                          {style === "overlay" && (
                            <div className="w-full h-full bg-gradient-to-br from-muted-foreground/30 to-muted-foreground/10 relative">
                              <div className="absolute inset-0 bg-black/20 flex flex-col items-center justify-center gap-1">
                                <div className="h-1.5 w-14 rounded bg-white/60" />
                                <div className="h-1 w-10 rounded bg-white/40" />
                              </div>
                            </div>
                          )}
                          {style === "banner" && (
                            <div className="w-full h-full bg-muted/50 flex flex-col items-center justify-center gap-1 border border-muted-foreground/10 rounded-md">
                              <div className="h-2 w-20 rounded bg-foreground/25" />
                              <div className="h-1 w-14 rounded bg-foreground/15" />
                              <div className="h-3 w-10 rounded bg-brand-500/40 mt-1" />
                            </div>
                          )}
                        </div>
                        <span className="text-xs font-medium capitalize">{style === "full-bleed" ? "Full Bleed" : style}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Product Grid ─────────────────────────────────────────── */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Product Grid</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {(["2", "3", "4"] as const).map((cols) => (
                      <button
                        key={cols}
                        onClick={() => handleLayoutChange("productGrid", cols)}
                        className={cn(
                          "rounded-xl border-2 p-3 transition-all",
                          themeState.layout.productGrid === cols
                            ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/20"
                            : "border-transparent bg-card hover:border-muted-foreground/20"
                        )}
                      >
                        {/* Mini grid mockup */}
                        <div className={cn("grid gap-1 mb-2", cols === "2" ? "grid-cols-2" : cols === "3" ? "grid-cols-3" : "grid-cols-4")}>
                          {Array.from({ length: parseInt(cols) * 2 }).map((_, i) => (
                            <div key={i} className="aspect-square rounded-sm bg-muted" />
                          ))}
                        </div>
                        <span className="text-xs font-medium">{cols} Columns</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Card Style ───────────────────────────────────────────── */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Card Style</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {(["rounded", "sharp", "shadow", "bordered", "minimal"] as const).map((style) => (
                      <button
                        key={style}
                        onClick={() => handleLayoutChange("cardStyle", style)}
                        className={cn(
                          "rounded-xl border-2 p-3 transition-all",
                          themeState.layout.cardStyle === style
                            ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/20"
                            : "border-transparent bg-card hover:border-muted-foreground/20"
                        )}
                      >
                        {/* Mini card mockup */}
                        <div
                          className={cn(
                            "h-12 w-full bg-muted mb-2",
                            style === "rounded" && "rounded-xl",
                            style === "sharp" && "rounded-none",
                            style === "shadow" && "rounded-lg shadow-md",
                            style === "bordered" && "rounded-lg border-2 border-muted-foreground/20",
                            style === "minimal" && "rounded-lg"
                          )}
                        >
                          <div className="h-2/3 bg-muted-foreground/10 rounded-t-inherit" />
                        </div>
                        <span className="text-xs font-medium capitalize">{style}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Spacing ──────────────────────────────────────────────── */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Spacing</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {(["compact", "normal", "spacious"] as const).map((spacing) => (
                      <button
                        key={spacing}
                        onClick={() => handleLayoutChange("spacing", spacing)}
                        className={cn(
                          "rounded-xl border-2 p-3 transition-all",
                          themeState.layout.spacing === spacing
                            ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/20"
                            : "border-transparent bg-card hover:border-muted-foreground/20"
                        )}
                      >
                        {/* Mini spacing mockup */}
                        <div className={cn("flex flex-col items-center mb-2", spacing === "compact" ? "gap-0.5" : spacing === "normal" ? "gap-1.5" : "gap-3")}>
                          <div className="h-2 w-full rounded bg-muted" />
                          <div className="h-2 w-full rounded bg-muted" />
                          <div className="h-2 w-full rounded bg-muted" />
                        </div>
                        <span className="text-xs font-medium capitalize">{spacing}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* ── SECTIONS TAB ─────────────────────────────────────────────── */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {activeTab === "sections" && (
              <div className="space-y-3">
                {sortedSections.map((section, idx) => (
                  <div key={section.id} className="rounded-xl border bg-card overflow-hidden">
                    {/* Section Header */}
                    <div className="flex items-center gap-3 p-4">
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />

                      {/* Toggle */}
                      <button
                        onClick={() => toggleSection(section.id)}
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0",
                          section.enabled ? "bg-brand-500" : "bg-muted"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                            section.enabled ? "translate-x-6" : "translate-x-1"
                          )}
                        />
                      </button>

                      <span className="font-medium text-sm flex-1">
                        {SECTION_LABELS[section.id] || section.id}
                      </span>

                      {/* Reorder buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveSectionUp(section.id)}
                          disabled={idx === 0}
                          className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                          title="Move up"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => moveSectionDown(section.id)}
                          disabled={idx === sortedSections.length - 1}
                          className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                          title="Move down"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Expand/Collapse */}
                      <button
                        onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
                        className="p-1 rounded hover:bg-muted transition-colors"
                      >
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform",
                            expandedSection === section.id && "rotate-180"
                          )}
                        />
                      </button>
                    </div>

                    {/* Section Content (Expanded) */}
                    {expandedSection === section.id && (
                      <div className="border-t px-4 py-4 space-y-4">
                        {/* Background Color */}
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                            Background Color
                            <span className="ml-1 font-normal opacity-60">
                              {section.id === "hero" ? "(overrides hero gradient)" : "(leave empty to inherit)"}
                            </span>
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={section.style?.backgroundColor || "#ffffff"}
                              onChange={(e) => updateSectionStyle(section.id, { backgroundColor: e.target.value })}
                              className="h-8 w-8 rounded border cursor-pointer bg-transparent"
                            />
                            <input
                              type="text"
                              value={section.style?.backgroundColor || ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "") {
                                  updateSectionStyle(section.id, { backgroundColor: undefined });
                                } else {
                                  updateSectionStyle(section.id, { backgroundColor: v });
                                }
                              }}
                              placeholder="Inherit from theme"
                              className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                            />
                            {section.style?.backgroundColor && (
                              <button
                                onClick={() => updateSectionStyle(section.id, { backgroundColor: undefined })}
                                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                                title="Reset to inherit"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Hero */}
                        {section.id === "hero" && (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Hero Settings</span>
                              <button
                                onClick={() => handleGenerateSection("hero")}
                                disabled={generatingSection === "hero"}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-300 text-xs font-medium hover:bg-purple-100 dark:hover:bg-purple-950/50 disabled:opacity-50 transition-colors"
                              >
                                {generatingSection === "hero" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                AI Generate
                              </button>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Headline</label>
                              <input
                                type="text"
                                value={(section.content as HeroContent).headline}
                                onChange={(e) => updateSectionContent(section.id, { headline: e.target.value })}
                                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                placeholder="Welcome to our store"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Subheadline</label>
                              <input
                                type="text"
                                value={(section.content as HeroContent).subheadline}
                                onChange={(e) => updateSectionContent(section.id, { subheadline: e.target.value })}
                                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                placeholder="Discover amazing products"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium mb-1.5">CTA Text</label>
                                <input
                                  type="text"
                                  value={(section.content as HeroContent).ctaText}
                                  onChange={(e) => updateSectionContent(section.id, { ctaText: e.target.value })}
                                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                  placeholder="Shop Now"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1.5">CTA Link</label>
                                <input
                                  type="text"
                                  value={(section.content as HeroContent).ctaLink}
                                  onChange={(e) => updateSectionContent(section.id, { ctaLink: e.target.value })}
                                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                  placeholder="/products"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Image URL</label>
                              <input
                                type="text"
                                value={(section.content as HeroContent).imageUrl || ""}
                                onChange={(e) => updateSectionContent(section.id, { imageUrl: e.target.value })}
                                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                placeholder="https://example.com/hero.jpg"
                              />
                            </div>
                            {/* Hero Media Type */}
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Hero Media</label>
                              <select
                                value={
                                  (section.content as HeroContent).videoUrl ? "video" :
                                  ((section.content as HeroContent).imageUrls as string[] | undefined)?.length ? "slideshow" :
                                  (section.content as HeroContent).imageUrl ? "image" : "none"
                                }
                                onChange={(e) => {
                                  const type = e.target.value;
                                  if (type === "none") {
                                    updateSectionContent(section.id, { imageUrl: "", imageUrls: [], videoUrl: "" });
                                  }
                                }}
                                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                              >
                                <option value="none">Gradient only</option>
                                <option value="image">Single image</option>
                                <option value="slideshow">Image slideshow</option>
                                <option value="video">Video</option>
                              </select>
                            </div>
                            {/* Video URL */}
                            {(section.content as HeroContent).videoUrl !== undefined && (
                              <div>
                                <label className="block text-sm font-medium mb-1.5">Video URL</label>
                                <input
                                  type="text"
                                  value={(section.content as HeroContent).videoUrl || ""}
                                  onChange={(e) => updateSectionContent(section.id, { videoUrl: e.target.value })}
                                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                  placeholder="https://example.com/hero.mp4"
                                />
                              </div>
                            )}
                          </>
                        )}

                        {/* Promo Banner */}
                        {section.id === "promo_banner" && (
                          <>
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Banner Title</label>
                              <input
                                type="text"
                                value={(section.content as GenericSectionContent).title || ""}
                                onChange={(e) => updateSectionContent(section.id, { title: e.target.value })}
                                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                placeholder="Limited Time Offer"
                              />
                            </div>
                          </>
                        )}

                        {/* Category Showcase */}
                        {section.id === "category_showcase" && (
                          <>
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Section Title</label>
                              <input
                                type="text"
                                value={(section.content as GenericSectionContent).title || ""}
                                onChange={(e) => updateSectionContent(section.id, { title: e.target.value })}
                                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                placeholder="Shop by Category"
                              />
                            </div>
                          </>
                        )}

                        {/* Featured Products */}
                        {section.id === "featured_products" && (
                          <>
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Section Title</label>
                              <input
                                type="text"
                                value={(section.content as FeaturedProductsContent).title}
                                onChange={(e) => updateSectionContent(section.id, { title: e.target.value })}
                                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                placeholder="Featured Products"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Number of Products</label>
                              <input
                                type="number"
                                min={1}
                                max={24}
                                value={(section.content as FeaturedProductsContent).count}
                                onChange={(e) => updateSectionContent(section.id, { count: parseInt(e.target.value) || 8 })}
                                className="w-32 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                              />
                            </div>
                          </>
                        )}

                        {/* New Arrivals */}
                        {section.id === "new_arrivals" && (
                          <>
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Section Title</label>
                              <input
                                type="text"
                                value={(section.content as GenericSectionContent).title || ""}
                                onChange={(e) => updateSectionContent(section.id, { title: e.target.value })}
                                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                placeholder="New Arrivals"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Number of Products</label>
                              <input
                                type="number"
                                min={1}
                                max={24}
                                value={(section.content as GenericSectionContent).count || 8}
                                onChange={(e) => updateSectionContent(section.id, { count: parseInt(e.target.value) || 8 })}
                                className="w-32 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                              />
                            </div>
                          </>
                        )}

                        {/* Deals */}
                        {section.id === "deals" && (
                          <>
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Section Title</label>
                              <input
                                type="text"
                                value={(section.content as GenericSectionContent).title || ""}
                                onChange={(e) => updateSectionContent(section.id, { title: e.target.value })}
                                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                placeholder="Deals & Offers"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Number of Products</label>
                              <input
                                type="number"
                                min={1}
                                max={24}
                                value={(section.content as GenericSectionContent).count || 8}
                                onChange={(e) => updateSectionContent(section.id, { count: parseInt(e.target.value) || 8 })}
                                className="w-32 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                              />
                            </div>
                          </>
                        )}

                        {/* About */}
                        {section.id === "about" && (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">About Section</span>
                              <button
                                onClick={() => handleGenerateSection("about")}
                                disabled={generatingSection === "about"}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-300 text-xs font-medium hover:bg-purple-100 dark:hover:bg-purple-950/50 disabled:opacity-50 transition-colors"
                              >
                                {generatingSection === "about" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                AI Generate
                              </button>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Section Title</label>
                              <input
                                type="text"
                                value={(section.content as AboutContent).title}
                                onChange={(e) => updateSectionContent(section.id, { title: e.target.value })}
                                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                placeholder="About Us"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Body</label>
                              <textarea
                                value={(section.content as AboutContent).body}
                                onChange={(e) => updateSectionContent(section.id, { body: e.target.value })}
                                rows={6}
                                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                                placeholder="Tell your story..."
                              />
                            </div>
                          </>
                        )}

                        {/* Testimonials */}
                        {section.id === "testimonials" && (
                          <>
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Section Title</label>
                              <input
                                type="text"
                                value={(section.content as TestimonialsContent).title}
                                onChange={(e) => updateSectionContent(section.id, { title: e.target.value })}
                                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                placeholder="What Customers Say"
                              />
                            </div>
                            <div className="space-y-3">
                              {(section.content as TestimonialsContent).items.map((item, i) => (
                                <div key={i} className="p-3 rounded-lg border bg-muted/30 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-muted-foreground">Testimonial {i + 1}</span>
                                    <button
                                      onClick={() => removeTestimonial(i)}
                                      className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 transition-colors"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                  <input
                                    type="text"
                                    value={item.name}
                                    onChange={(e) => updateTestimonial(i, { name: e.target.value })}
                                    className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    placeholder="Customer name"
                                  />
                                  <textarea
                                    value={item.text}
                                    onChange={(e) => updateTestimonial(i, { text: e.target.value })}
                                    rows={2}
                                    className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                                    placeholder="What they said..."
                                  />
                                  <div>
                                    <label className="block text-xs text-muted-foreground mb-1">Rating</label>
                                    <input
                                      type="number"
                                      min={1}
                                      max={5}
                                      value={item.rating}
                                      onChange={(e) => updateTestimonial(i, { rating: parseInt(e.target.value) || 5 })}
                                      className="w-20 rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                            <button
                              onClick={addTestimonial}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                            >
                              <Plus className="h-4 w-4" />
                              Add Testimonial
                            </button>
                          </>
                        )}

                        {/* Newsletter */}
                        {section.id === "newsletter" && (
                          <>
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Title</label>
                              <input
                                type="text"
                                value={(section.content as NewsletterContent).title}
                                onChange={(e) => updateSectionContent(section.id, { title: e.target.value })}
                                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                placeholder="Stay Updated"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Subtitle</label>
                              <input
                                type="text"
                                value={(section.content as NewsletterContent).subtitle}
                                onChange={(e) => updateSectionContent(section.id, { subtitle: e.target.value })}
                                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                placeholder="Subscribe for updates and exclusive offers"
                              />
                            </div>
                          </>
                        )}

                        {/* Contact */}
                        {section.id === "contact" && (
                          <>
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Section Title</label>
                              <input
                                type="text"
                                value={(section.content as ContactContent).title}
                                onChange={(e) => updateSectionContent(section.id, { title: e.target.value })}
                                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                placeholder="Contact Us"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium mb-1.5">Email</label>
                                <input
                                  type="email"
                                  value={(section.content as ContactContent).email || ""}
                                  onChange={(e) => updateSectionContent(section.id, { email: e.target.value })}
                                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                  placeholder="hello@store.com"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-1.5">Phone</label>
                                <input
                                  type="text"
                                  value={(section.content as ContactContent).phone || ""}
                                  onChange={(e) => updateSectionContent(section.id, { phone: e.target.value })}
                                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                  placeholder="+1 (555) 123-4567"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1.5">Address</label>
                              <input
                                type="text"
                                value={(section.content as ContactContent).address || ""}
                                onChange={(e) => updateSectionContent(section.id, { address: e.target.value })}
                                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                placeholder="123 Main St, City, State"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* ── CONTENT TAB ──────────────────────────────────────────────── */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {activeTab === "content" && (
              <div className="space-y-6">
                {/* ── Hero Content ─────────────────────────────────────────── */}
                <div className="rounded-xl border bg-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold">Hero</h3>
                    <button
                      onClick={() => handleGenerateSection("hero")}
                      disabled={generatingSection === "hero"}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-300 text-xs font-medium hover:bg-purple-100 dark:hover:bg-purple-950/50 disabled:opacity-50 transition-colors"
                    >
                      {generatingSection === "hero" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      AI Generate
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Headline</label>
                      <input
                        type="text"
                        value={getHeroSection().headline}
                        onChange={(e) => updateSectionContent("hero", { headline: e.target.value })}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="Welcome to our store"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Subheadline</label>
                      <input
                        type="text"
                        value={getHeroSection().subheadline}
                        onChange={(e) => updateSectionContent("hero", { subheadline: e.target.value })}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="Discover amazing products"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1.5">CTA Text</label>
                        <input
                          type="text"
                          value={getHeroSection().ctaText}
                          onChange={(e) => updateSectionContent("hero", { ctaText: e.target.value })}
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          placeholder="Shop Now"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">CTA Link</label>
                        <input
                          type="text"
                          value={getHeroSection().ctaLink}
                          onChange={(e) => updateSectionContent("hero", { ctaLink: e.target.value })}
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          placeholder="/products"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── About Content ────────────────────────────────────────── */}
                <div className="rounded-xl border bg-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold">About</h3>
                    <button
                      onClick={() => handleGenerateSection("about")}
                      disabled={generatingSection === "about"}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-300 text-xs font-medium hover:bg-purple-100 dark:hover:bg-purple-950/50 disabled:opacity-50 transition-colors"
                    >
                      {generatingSection === "about" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      AI Generate
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Title</label>
                      <input
                        type="text"
                        value={getAboutSection().title}
                        onChange={(e) => updateSectionContent("about", { title: e.target.value })}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="About Us"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Body</label>
                      <textarea
                        value={getAboutSection().body}
                        onChange={(e) => updateSectionContent("about", { body: e.target.value })}
                        rows={6}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                        placeholder="Tell your brand story..."
                      />
                    </div>
                  </div>
                </div>

                {/* ── Contact Content ──────────────────────────────────────── */}
                <div className="rounded-xl border bg-card p-5">
                  <h3 className="text-sm font-semibold mb-4">Contact</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Email</label>
                      <input
                        type="email"
                        value={getContactSection().email || ""}
                        onChange={(e) => updateSectionContent("contact", { email: e.target.value })}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="hello@store.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Phone</label>
                      <input
                        type="text"
                        value={getContactSection().phone || ""}
                        onChange={(e) => updateSectionContent("contact", { phone: e.target.value })}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Address</label>
                      <input
                        type="text"
                        value={getContactSection().address || ""}
                        onChange={(e) => updateSectionContent("contact", { address: e.target.value })}
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="123 Main St, City, State"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════ */}
            {/* ── POLICIES TAB ─────────────────────────────────────────────── */}
            {/* ════════════════════════════════════════════════════════════════ */}
            {activeTab === "policies" && (
              <div className="space-y-6">
                {/* Tagline */}
                <div className="rounded-xl border bg-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-medium">Tagline</label>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {storeContent.tagline.length}/80
                      </span>
                      <button
                        onClick={() => handleGenerateSection("tagline")}
                        disabled={generatingSection === "tagline"}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-300 text-xs font-medium hover:bg-purple-100 dark:hover:bg-purple-950/50 disabled:opacity-50 transition-colors"
                      >
                        {generatingSection === "tagline" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        AI Generate
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={storeContent.tagline}
                    onChange={(e) => setStoreContent((prev) => ({ ...prev, tagline: e.target.value.slice(0, 80) }))}
                    maxLength={80}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="Your catchy store tagline"
                  />
                </div>

                {/* About Us */}
                <div className="rounded-xl border bg-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-medium">About Us</label>
                    <button
                      onClick={() => handleGenerateSection("about")}
                      disabled={generatingSection === "about"}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-300 text-xs font-medium hover:bg-purple-100 dark:hover:bg-purple-950/50 disabled:opacity-50 transition-colors"
                    >
                      {generatingSection === "about" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      AI Generate
                    </button>
                  </div>
                  <textarea
                    value={storeContent.about}
                    onChange={(e) => setStoreContent((prev) => ({ ...prev, about: e.target.value }))}
                    rows={8}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                    placeholder="Tell your brand story, mission, and values..."
                  />
                </div>

                {/* Return Policy */}
                <div className="rounded-xl border bg-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-medium">Return Policy</label>
                    <button
                      onClick={() => handleGenerateSection("return_policy")}
                      disabled={generatingSection === "return_policy"}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-300 text-xs font-medium hover:bg-purple-100 dark:hover:bg-purple-950/50 disabled:opacity-50 transition-colors"
                    >
                      {generatingSection === "return_policy" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      AI Generate
                    </button>
                  </div>
                  <textarea
                    value={storeContent.returnPolicy}
                    onChange={(e) => setStoreContent((prev) => ({ ...prev, returnPolicy: e.target.value }))}
                    rows={8}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                    placeholder="Describe your return and refund policy..."
                  />
                </div>

                {/* Shipping Policy */}
                <div className="rounded-xl border bg-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-medium">Shipping Policy</label>
                    <button
                      onClick={() => handleGenerateSection("shipping_policy")}
                      disabled={generatingSection === "shipping_policy"}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-300 text-xs font-medium hover:bg-purple-100 dark:hover:bg-purple-950/50 disabled:opacity-50 transition-colors"
                    >
                      {generatingSection === "shipping_policy" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      AI Generate
                    </button>
                  </div>
                  <textarea
                    value={storeContent.shippingPolicy}
                    onChange={(e) => setStoreContent((prev) => ({ ...prev, shippingPolicy: e.target.value }))}
                    rows={8}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                    placeholder="Describe shipping methods, timeframes, and costs..."
                  />
                </div>

                {/* Terms of Service */}
                <div className="rounded-xl border bg-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-medium">Terms of Service</label>
                    <button
                      onClick={() => handleGenerateSection("terms_of_service")}
                      disabled={generatingSection === "terms_of_service"}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-300 text-xs font-medium hover:bg-purple-100 dark:hover:bg-purple-950/50 disabled:opacity-50 transition-colors"
                    >
                      {generatingSection === "terms_of_service" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      AI Generate
                    </button>
                  </div>
                  <textarea
                    value={storeContent.termsOfService}
                    onChange={(e) => setStoreContent((prev) => ({ ...prev, termsOfService: e.target.value }))}
                    rows={8}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                    placeholder="Terms and conditions for using your store..."
                  />
                </div>

                {/* Privacy Policy */}
                <div className="rounded-xl border bg-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-medium">Privacy Policy</label>
                    <button
                      onClick={() => handleGenerateSection("privacy_policy")}
                      disabled={generatingSection === "privacy_policy"}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-300 text-xs font-medium hover:bg-purple-100 dark:hover:bg-purple-950/50 disabled:opacity-50 transition-colors"
                    >
                      {generatingSection === "privacy_policy" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      AI Generate
                    </button>
                  </div>
                  <textarea
                    value={storeContent.privacyPolicy}
                    onChange={(e) => setStoreContent((prev) => ({ ...prev, privacyPolicy: e.target.value }))}
                    rows={8}
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                    placeholder="How you collect, use, and protect customer data..."
                  />
                </div>

                {/* FAQ */}
                <div className="rounded-xl border bg-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-medium">Frequently Asked Questions</label>
                    <button
                      onClick={() => handleGenerateSection("faq")}
                      disabled={generatingSection === "faq"}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-300 text-xs font-medium hover:bg-purple-100 dark:hover:bg-purple-950/50 disabled:opacity-50 transition-colors"
                    >
                      {generatingSection === "faq" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      AI Generate
                    </button>
                  </div>
                  <div className="space-y-3">
                    {storeContent.faq.map((item, i) => (
                      <div key={i} className="p-3 rounded-lg border bg-muted/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">Question {i + 1}</span>
                          <button
                            onClick={() => removeFaqItem(i)}
                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={item.question}
                          onChange={(e) => updateFaqItem(i, { question: e.target.value })}
                          className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          placeholder="Customer question..."
                        />
                        <textarea
                          value={item.answer}
                          onChange={(e) => updateFaqItem(i, { answer: e.target.value })}
                          rows={2}
                          className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                          placeholder="Your answer..."
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addFaqItem}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Add FAQ Item
                  </button>
                </div>
              </div>
            )}

            {/* ── Bottom Save Button (always visible) ─────────────────────── */}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save & Refresh
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: Live Preview ────────────────────────────────────────── */}
        {showPreview && previewUrl && (
          <div className="flex-1 min-w-0 flex items-start justify-center bg-gray-100 dark:bg-gray-900 p-4 rounded-xl overflow-auto">
            <div
              className={cn(
                "bg-white rounded-xl border shadow-lg overflow-hidden transition-all duration-300 flex flex-col",
              )}
              style={{
                width: previewDevice === "desktop" ? "100%" : previewDevice === "tablet" ? "768px" : "375px",
                maxWidth: "100%",
                height: previewDevice === "desktop" ? "100%" : "auto",
                minHeight: previewDevice !== "desktop" ? "600px" : undefined,
              }}
            >
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/50 shrink-0">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <div className="h-3 w-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 mx-2 px-3 py-1 rounded-md bg-background border text-xs text-muted-foreground truncate font-mono">
                  /store/{store.slug}
                </div>
                <div className="flex items-center gap-0.5">
                  {/* Device toggles */}
                  <button
                    onClick={() => setPreviewDevice("desktop")}
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      previewDevice === "desktop"
                        ? "bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                        : "hover:bg-muted text-muted-foreground"
                    )}
                    title="Desktop"
                  >
                    <Monitor className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setPreviewDevice("tablet")}
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      previewDevice === "tablet"
                        ? "bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                        : "hover:bg-muted text-muted-foreground"
                    )}
                    title="Tablet (768px)"
                  >
                    <Tablet className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setPreviewDevice("mobile")}
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      previewDevice === "mobile"
                        ? "bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                        : "hover:bg-muted text-muted-foreground"
                    )}
                    title="Mobile (375px)"
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                  </button>
                  <div className="w-px h-4 bg-border mx-1" />
                  <button
                    onClick={() => setPreviewKey((k) => k + 1)}
                    className="p-1.5 rounded-md hover:bg-muted transition-colors"
                    title="Refresh preview"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <a
                    href={`/store/${store.slug}?preview=true`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-md hover:bg-muted transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
                </div>
              </div>
              {/* Iframe */}
              <div className="flex-1 bg-white">
                <iframe
                  ref={iframeRef}
                  key={previewKey}
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title="Store preview"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── AI Enhance Modal ─────────────────────────────────────────────── */}
      <Dialog open={showAIEnhanceModal} onOpenChange={setShowAIEnhanceModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand-500" />
              AI Enhance
            </DialogTitle>
            <DialogDescription>
              Tell AI what you&apos;d like to change about your store.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Prompt */}
            <div>
              <label className="block text-sm font-medium mb-1.5">What would you like to change?</label>
              <textarea
                value={aiEnhancePrompt}
                onChange={(e) => setAIEnhancePrompt(e.target.value)}
                rows={3}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                placeholder="e.g. Make my store look more premium, add winter collection products, change to a dark elegant theme..."
              />
            </div>

            {/* Reference URL */}
            <div>
              <label className="block text-sm font-medium mb-1.5">Reference URL <span className="text-muted-foreground font-normal">(optional)</span></label>
              <input
                type="url"
                value={aiEnhanceUrl}
                onChange={(e) => setAIEnhanceUrl(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="https://example.com — for brand or product inspiration"
              />
            </div>

            {/* Scope */}
            <div>
              <label className="block text-sm font-medium mb-2">What to update</label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: "all", label: "Everything" },
                    { value: "theme", label: "Theme only" },
                    { value: "content", label: "Content only" },
                    { value: "products", label: "Products only" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAIEnhanceScope(opt.value)}
                    className={cn(
                      "px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
                      aiEnhanceScope === opt.value
                        ? "bg-brand-50 border-brand-300 text-brand-700 dark:bg-brand-950/30 dark:border-brand-700 dark:text-brand-300"
                        : "hover:bg-muted"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Uses 10 AI credits. Changes are previewed before saving.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setShowAIEnhanceModal(false)}
              disabled={aiEnhancing}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAIEnhance}
              disabled={aiEnhancing || !aiEnhancePrompt.trim()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {aiEnhancing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enhancing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Enhance
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
