"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Layout,
  FileText,
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
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ── Types ────────────────────────────────────────────────────────────────────

type TabId = "sections" | "policies";

interface HeroContent {
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaLink: string;
  imageUrl: string;
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

type SectionContent =
  | HeroContent
  | FeaturedProductsContent
  | AboutContent
  | TestimonialsContent
  | NewsletterContent
  | ContactContent;

interface Section {
  id: string;
  enabled: boolean;
  order: number;
  content: SectionContent;
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
  faq: FaqItem[];
}

interface Store {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  hero: "Hero",
  featured_products: "Featured Products",
  about: "About",
  testimonials: "Testimonials",
  newsletter: "Newsletter",
  contact: "Contact",
};

function getDefaultSections(): Section[] {
  return [
    {
      id: "hero",
      enabled: true,
      order: 0,
      content: { headline: "", subheadline: "", ctaText: "Shop Now", ctaLink: "/products", imageUrl: "" } as HeroContent,
    },
    {
      id: "featured_products",
      enabled: true,
      order: 1,
      content: { title: "Featured Products", count: 8 } as FeaturedProductsContent,
    },
    {
      id: "about",
      enabled: true,
      order: 2,
      content: { title: "About Us", body: "" } as AboutContent,
    },
    {
      id: "testimonials",
      enabled: false,
      order: 3,
      content: { title: "What Our Customers Say", items: [] } as TestimonialsContent,
    },
    {
      id: "newsletter",
      enabled: true,
      order: 4,
      content: { title: "Stay in the Loop", subtitle: "Subscribe to our newsletter for updates and exclusive offers." } as NewsletterContent,
    },
    {
      id: "contact",
      enabled: false,
      order: 5,
      content: { title: "Contact Us", email: "", phone: "", address: "" } as ContactContent,
    },
  ];
}

function getDefaultStoreContent(): StoreContent {
  return {
    tagline: "",
    about: "",
    returnPolicy: "",
    shippingPolicy: "",
    faq: [],
  };
}

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "sections", label: "Sections", icon: Layout },
  { id: "policies", label: "Policies", icon: FileText },
];

// ── Page Component ───────────────────────────────────────────────────────────

export default function EcommerceDesignPage() {
  const [store, setStore] = useState<Store | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("sections");
  const [sections, setSections] = useState<Section[]>(getDefaultSections());
  const [storeContent, setStoreContent] = useState<StoreContent>(getDefaultStoreContent());
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingSection, setGeneratingSection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [previewKey, setPreviewKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ── Load store data ──────────────────────────────────────────────────────

  const loadStore = useCallback(async () => {
    try {
      const res = await fetch("/api/ecommerce/store");
      const data = await res.json();
      if (data.success && data.data?.store) {
        const s = data.data.store;
        setStore(s);
        const settings = s.settings || {};
        // Load sections
        if (Array.isArray(settings.sections) && settings.sections.length > 0) {
          setSections(
            settings.sections.map((sec: Section, i: number) => ({
              ...sec,
              order: sec.order ?? i,
            }))
          );
        }
        // Load store content
        if (settings.storeContent) {
          setStoreContent({
            tagline: settings.storeContent.tagline || "",
            about: settings.storeContent.about || "",
            returnPolicy: settings.storeContent.returnPolicy || "",
            shippingPolicy: settings.storeContent.shippingPolicy || "",
            faq: Array.isArray(settings.storeContent.faq) ? settings.storeContent.faq : [],
          });
        }
      } else {
        setError("No store found. Please create a store first.");
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

  // ── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
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
            sections,
            storeContent,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStore(data.data.store);
        setSuccessMessage("Design settings saved.");
        // Refresh the preview iframe
        setPreviewKey((k) => k + 1);
      } else {
        setError(data.error?.message || "Failed to save.");
      }
    } catch {
      setError("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  // ── AI Generate ──────────────────────────────────────────────────────────

  async function handleGenerateAll() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/ecommerce/ai/store-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentTypes: ["tagline", "about", "hero", "return_policy", "shipping_policy", "faq"],
        }),
      });
      const data = await res.json();
      if (data.success) {
        applyAiResult(data.data);
        setSuccessMessage(`Content generated! (${data.data.creditsUsed} credits used)`);
      } else {
        setError(data.error?.message || "Generation failed.");
      }
    } catch {
      setError("Failed to generate content.");
    } finally {
      setGenerating(false);
    }
  }

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
    // Hero section
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
    // About section
    if (result.about) {
      setSections((prev) =>
        prev.map((s) =>
          s.id === "about" ? { ...s, content: { ...(s.content as AboutContent), body: result.about as string } } : s
        )
      );
    }
    // Policies tab
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
    if (result.faq) {
      setStoreContent((prev) => ({ ...prev, faq: result.faq as FaqItem[] }));
    }
  }

  // ── Section Helpers ──────────────────────────────────────────────────────

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

  // ── Testimonial Helpers ──────────────────────────────────────────────────

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

  // ── FAQ Helpers ──────────────────────────────────────────────────────────

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

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Loading design settings...</div>
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

  const sortedSections = [...sections].sort((a, b) => a.order - b.order);
  const previewUrl = store.slug
    ? `/store/${store.slug}?preview=true&_t=${previewKey}`
    : null;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 px-1 pb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold">Store Design</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Edit sections and see changes live.
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
            onClick={handleGenerateAll}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 transition-all"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span className="hidden sm:inline">Generate All with AI</span>
            <span className="sm:hidden">AI</span>
          </button>
        </div>
      </div>

      {/* Messages */}
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

      {/* Split Panel */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* ── Left: Editor Panel ──────────────────────────────────────────── */}
        <div className={cn(
          "flex flex-col min-h-0 shrink-0",
          showPreview ? "w-[420px]" : "w-full"
        )}>
          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-lg bg-muted mb-3 shrink-0">
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

          {/* Scrollable editor content */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 pb-4">

      {/* ── Sections Tab ──────────────────────────────────────────────────── */}
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                          value={(section.content as HeroContent).imageUrl}
                          onChange={(e) => updateSectionContent(section.id, { imageUrl: e.target.value })}
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          placeholder="https://example.com/hero.jpg"
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
                          placeholder="What Our Customers Say"
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
                          placeholder="Stay in the Loop"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Subtitle</label>
                        <input
                          type="text"
                          value={(section.content as NewsletterContent).subtitle}
                          onChange={(e) => updateSectionContent(section.id, { subtitle: e.target.value })}
                          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          placeholder="Subscribe to our newsletter for updates"
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Email</label>
                          <input
                            type="email"
                            value={(section.content as ContactContent).email}
                            onChange={(e) => updateSectionContent(section.id, { email: e.target.value })}
                            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            placeholder="hello@store.com"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1.5">Phone</label>
                          <input
                            type="text"
                            value={(section.content as ContactContent).phone}
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
                          value={(section.content as ContactContent).address}
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

      {/* ── Policies Tab ──────────────────────────────────────────────────── */}
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

            {/* ── Save Button ───────────────────────────────────────────── */}
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
          <div className="flex-1 min-w-0 flex flex-col rounded-xl border bg-card overflow-hidden">
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
              <div className="flex items-center gap-1">
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
        )}
      </div>
    </div>
  );
}
