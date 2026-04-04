"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowLeft, ArrowRight, Loader2, Check, Palette, Globe, Target, Settings, CheckCircle2 } from "lucide-react";
import type { SiteQuestionnaire } from "@/types/website-builder";

interface BrandKit {
  id: string;
  name: string;
  description?: string;
  industry?: string;
  niche?: string;
  targetAudience?: string;
  voiceTone?: string;
  colors: string;
  fonts: string;
  logo?: string;
  products?: string;
  uniqueValue?: string;
  isDefault: boolean;
}

const STEPS = [
  { title: "Business Info", icon: Globe },
  { title: "Goals & Pages", icon: Target },
  { title: "Style & Tone", icon: Palette },
  { title: "Features", icon: Settings },
];

const INDUSTRY_OPTIONS = [
  "Technology", "E-commerce", "Health & Fitness", "Education", "Real Estate",
  "Restaurant/Food", "Legal", "Finance", "Marketing", "Photography",
  "Construction", "Consulting", "Non-profit", "Entertainment", "Travel",
  "Beauty/Salon", "Automotive", "Fashion", "Art & Design", "Other",
];

const GOAL_OPTIONS = [
  { value: "generate-leads", label: "Generate Leads" },
  { value: "sell-products", label: "Sell Products/Services" },
  { value: "portfolio", label: "Showcase Portfolio" },
  { value: "blog", label: "Blog / Content" },
  { value: "membership", label: "Membership / Community" },
  { value: "booking", label: "Booking / Appointments" },
  { value: "informational", label: "Informational / Company" },
];

const PAGE_OPTIONS = [
  "Home", "About", "Services", "Pricing", "Contact", "Blog",
  "Portfolio", "FAQ", "Team", "Testimonials", "Gallery",
];

const TONE_MAP: Record<string, string> = {
  "Professional": "professional",
  "Casual": "casual",
  "Friendly": "friendly",
  "Luxury": "luxury",
  "Playful": "playful",
  "Witty": "playful",
  "Authoritative": "professional",
  "Warm": "friendly",
};

export default function CreateWebsitePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [brandKits, setBrandKits] = useState<BrandKit[]>([]);
  const [selectedBrandKitId, setSelectedBrandKitId] = useState<string>("");
  const [brandKitLoaded, setBrandKitLoaded] = useState(false);
  const [prefilled, setPrefilled] = useState<Set<string>>(new Set());

  const [form, setForm] = useState<SiteQuestionnaire>({
    businessName: "",
    industry: "",
    description: "",
    targetAudience: "",
    goals: [],
    pages: ["Home", "About", "Contact"],
    stylePreference: "modern",
    contentTone: "professional",
    features: ["animations", "contact-form"],
    existingContent: "",
  });

  // Fetch brand kit on mount
  useEffect(() => {
    fetch("/api/brand")
      .then((r) => r.json())
      .then((data) => {
        const kit = data.data?.brandKit;
        if (kit) {
          // Normalize: the API returns parsed JSON objects, but our interface expects raw strings
          const normalized: BrandKit = {
            ...kit,
            colors: typeof kit.colors === "string" ? kit.colors : JSON.stringify(kit.colors || {}),
            fonts: typeof kit.fonts === "string" ? kit.fonts : JSON.stringify(kit.fonts || {}),
            products: typeof kit.products === "string" ? kit.products : JSON.stringify(kit.products || []),
            isDefault: true,
          };
          setBrandKits([normalized]);
          setSelectedBrandKitId(normalized.id);
          applyBrandKit(normalized);
        }
        setBrandKitLoaded(true);
      })
      .catch(() => setBrandKitLoaded(true));
  }, []);

  const applyBrandKit = (kit: BrandKit) => {
    const filled = new Set<string>();
    const updates: Partial<SiteQuestionnaire> = {};

    if (kit.name) {
      updates.businessName = kit.name;
      filled.add("businessName");
    }
    if (kit.industry) {
      // Match to closest option
      const match = INDUSTRY_OPTIONS.find((o) => o.toLowerCase().includes(kit.industry!.toLowerCase()) || kit.industry!.toLowerCase().includes(o.toLowerCase()));
      if (match) {
        updates.industry = match;
        filled.add("industry");
      }
    }
    if (kit.description || kit.uniqueValue) {
      const parts = [];
      if (kit.description) parts.push(kit.description);
      if (kit.uniqueValue) parts.push(kit.uniqueValue);
      updates.description = parts.join("\n\n");
      filled.add("description");
    }
    if (kit.targetAudience) {
      updates.targetAudience = kit.targetAudience;
      filled.add("targetAudience");
    }
    if (kit.voiceTone) {
      const mapped = TONE_MAP[kit.voiceTone] || kit.voiceTone.toLowerCase();
      if (["professional", "casual", "friendly", "luxury", "playful"].includes(mapped)) {
        updates.contentTone = mapped as SiteQuestionnaire["contentTone"];
        filled.add("contentTone");
      }
    }

    // Build existing content from products
    if (kit.products) {
      try {
        const products = JSON.parse(kit.products);
        if (Array.isArray(products) && products.length > 0) {
          updates.existingContent = `Products/Services: ${products.join(", ")}`;
          filled.add("existingContent");
        }
      } catch {}
    }

    updates.brandKitId = kit.id;

    setForm((f) => ({ ...f, ...updates }));
    setPrefilled(filled);
  };

  const handleBrandKitChange = (kitId: string) => {
    setSelectedBrandKitId(kitId);
    if (kitId) {
      const kit = brandKits.find((k) => k.id === kitId);
      if (kit) applyBrandKit(kit);
    } else {
      // Clear prefilled data
      setPrefilled(new Set());
      setForm((f) => ({
        ...f,
        businessName: "",
        industry: "",
        description: "",
        targetAudience: "",
        contentTone: "professional",
        existingContent: "",
        brandKitId: undefined,
      }));
    }
  };

  const updateForm = (field: keyof SiteQuestionnaire, value: unknown) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const toggleArrayItem = (field: "goals" | "pages" | "features", item: string) => {
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(item) ? f[field].filter((i) => i !== item) : [...f[field], item],
    }));
  };

  const handleGenerate = async () => {
    if (!form.businessName.trim()) { setError("Business name is required"); return; }
    setGenerating(true);
    setError("");

    try {
      const createRes = await fetch("/api/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.businessName, brandKitId: selectedBrandKitId || undefined }),
      });
      const { website } = await createRes.json();

      const genRes = await fetch(`/api/websites/${website.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionnaire: form }),
      });

      if (!genRes.ok) {
        const data = await genRes.json();
        throw new Error(data.error || "Generation failed");
      }

      router.push(`/websites/${website.id}/editor`);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setGenerating(false);
    }
  };

  const canProceed = () => {
    if (step === 0) return form.businessName.trim() && form.industry && form.description.trim();
    if (step === 1) return form.goals.length > 0 && form.pages.length > 0;
    return true;
  };

  const prefilledLabel = (field: string) => prefilled.has(field) ? (
    <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 ml-2">
      <CheckCircle2 className="w-3 h-3" /> From Brand Kit
    </span>
  ) : null;

  return (
    <div>
      <button onClick={() => router.push("/websites")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Website Builder
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Main Content */}
        <div>
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Create Your Website with AI</h1>
            <p className="text-muted-foreground text-sm mt-1">Answer a few questions and we'll build your site in seconds</p>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 mb-6">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  onClick={() => i < step && setStep(i)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    i < step ? "bg-primary text-primary-foreground cursor-pointer" : i === step ? "bg-primary/10 text-primary border border-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i < step ? <Check className="w-3.5 h-3.5" /> : <s.icon className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{s.title}</span>
                  <span className="sm:hidden">{i + 1}</span>
                </button>
                {i < STEPS.length - 1 && <div className={`w-6 h-0.5 ${i < step ? "bg-primary" : "bg-border"}`} />}
              </div>
            ))}
          </div>

          {/* Step Content */}
          <div className="bg-card border border-border rounded-xl p-6">
            {step === 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Tell us about your business</h2>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Business Name * {prefilledLabel("businessName")}
                  </label>
                  <input type="text" value={form.businessName} onChange={(e) => updateForm("businessName", e.target.value)} placeholder="e.g. Acme Digital Agency" className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Industry * {prefilledLabel("industry")}
                  </label>
                  <select value={form.industry} onChange={(e) => updateForm("industry", e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg bg-background">
                    <option value="">Select industry...</option>
                    {INDUSTRY_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Describe your business * {prefilledLabel("description")}
                  </label>
                  <textarea value={form.description} onChange={(e) => updateForm("description", e.target.value)} rows={3} placeholder="What does your business do? What makes it special?" className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Target Audience {prefilledLabel("targetAudience")}
                  </label>
                  <input type="text" value={form.targetAudience} onChange={(e) => updateForm("targetAudience", e.target.value)} placeholder="e.g. Small business owners, 25-45 years old" className="w-full px-3 py-2 border border-border rounded-lg bg-background" />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Goals & Pages</h2>
                <div>
                  <label className="text-sm font-medium mb-2 block">Website Goals *</label>
                  <div className="flex flex-wrap gap-2">
                    {GOAL_OPTIONS.map((g) => (
                      <button key={g.value} onClick={() => toggleArrayItem("goals", g.value)} className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${form.goals.includes(g.value) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}>
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Pages to create *</label>
                  <div className="flex flex-wrap gap-2">
                    {PAGE_OPTIONS.map((p) => (
                      <button key={p} onClick={() => toggleArrayItem("pages", p)} className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${form.pages.includes(p) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Style & Tone</h2>
                <div>
                  <label className="text-sm font-medium mb-2 block">Visual Style</label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {(["modern", "classic", "bold", "minimal", "playful", "elegant"] as const).map((s) => (
                      <button key={s} onClick={() => updateForm("stylePreference", s)} className={`p-3 rounded-lg border text-sm font-medium text-center transition-colors capitalize ${form.stylePreference === s ? "bg-primary/10 border-primary text-primary" : "border-border hover:border-primary/50"}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Content Tone {prefilledLabel("contentTone")}
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {(["professional", "casual", "friendly", "luxury", "playful"] as const).map((t) => (
                      <button key={t} onClick={() => updateForm("contentTone", t)} className={`p-3 rounded-lg border text-sm font-medium text-center transition-colors capitalize ${form.contentTone === t ? "bg-primary/10 border-primary text-primary" : "border-border hover:border-primary/50"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Additional Features</h2>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "animations", label: "Animations" },
                    { value: "contact-form", label: "Contact Form" },
                    { value: "member-login", label: "Member Login" },
                    { value: "blog", label: "Blog Section" },
                    { value: "newsletter", label: "Newsletter Signup" },
                    { value: "social-proof", label: "Social Proof" },
                    { value: "seo-optimized", label: "SEO Optimized" },
                  ].map((f) => (
                    <button key={f.value} onClick={() => toggleArrayItem("features", f.value)} className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${form.features.includes(f.value) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}>
                      {f.label}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Existing Content (optional) {prefilledLabel("existingContent")}
                  </label>
                  <textarea value={form.existingContent} onChange={(e) => updateForm("existingContent", e.target.value)} rows={4} placeholder="Paste any existing copy, taglines, descriptions, or information you want to include..." className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <button
                onClick={() => setStep(Math.max(0, step - 1))}
                disabled={step === 0}
                className="flex items-center gap-1 px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>

              {step < STEPS.length - 1 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={!canProceed()}
                  className="flex items-center gap-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate Website</>}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar — Brand Kit Selector */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" />
              Brand Identity
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Select a brand kit to auto-fill your business details. You can edit any field.
            </p>

            {!brandKitLoaded ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading brand kits...
              </div>
            ) : brandKits.length === 0 ? (
              <p className="text-xs text-muted-foreground">No brand kits found. Fill in details manually.</p>
            ) : (
              <div className="space-y-2">
                {brandKits.map((kit) => {
                  let colors: { primary?: string; secondary?: string; accent?: string } = {};
                  try { colors = JSON.parse(kit.colors || "{}"); } catch {}
                  const isSelected = selectedBrandKitId === kit.id;

                  return (
                    <button
                      key={kit.id}
                      onClick={() => handleBrandKitChange(isSelected ? "" : kit.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                        isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"
                      }`}
                    >
                      {/* Color dots */}
                      <div className="flex gap-1 flex-shrink-0">
                        {colors.primary && <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: colors.primary }} />}
                        {colors.secondary && <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: colors.secondary }} />}
                        {colors.accent && <div className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: colors.accent }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{kit.name}</p>
                        {kit.industry && <p className="text-xs text-muted-foreground truncate">{kit.industry}</p>}
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Summary of what's pre-filled */}
          {prefilled.size > 0 && (
            <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-xl p-4">
              <h4 className="text-sm font-medium text-green-800 dark:text-green-300 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Auto-filled from Brand Kit
              </h4>
              <ul className="text-xs text-green-700 dark:text-green-400 space-y-1">
                {prefilled.has("businessName") && <li>Business name</li>}
                {prefilled.has("industry") && <li>Industry</li>}
                {prefilled.has("description") && <li>Business description</li>}
                {prefilled.has("targetAudience") && <li>Target audience</li>}
                {prefilled.has("contentTone") && <li>Content tone</li>}
                {prefilled.has("existingContent") && <li>Products/services</li>}
              </ul>
              <p className="text-xs text-green-600 dark:text-green-500 mt-2">
                Colors, fonts, and logo will be applied to your site automatically.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
